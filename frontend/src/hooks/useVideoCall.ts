import { useState, useEffect, useRef, useCallback } from 'react';
import { turnService } from '../services/turnService';

interface UseVideoCallProps {
  roomId: string;
  userId: string;
  userName?: string;
  sendMessage: (message: any) => boolean;
  addMessageHandler: (handler: (data: any) => void) => () => void;
}

export interface ConnectionStats {
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  rtt: number;
  packetLoss: number;
}

// Configuração padrão (será atualizada com credenciais dinâmicas)
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useVideoCall({ roomId, userId, userName = 'Usuário', sendMessage, addMessageHandler }: UseVideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [connectionErrors, setConnectionErrors] = useState<Map<string, string>>(new Map());
  const [connectionStats, setConnectionStats] = useState<Map<string, ConnectionStats>>(new Map());
  const [overallQuality, setOverallQuality] = useState<ConnectionStats['quality']>('unknown');
  const [participantNames, setParticipantNames] = useState<Map<string, string>>(new Map());
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodes = useRef<Map<string, AnalyserNode>>(new Map());
  const audioIntervals = useRef<Map<string, number>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isInitializedRef = useRef(false);
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingOffers = useRef<Set<string>>(new Set());
  const reconnectAttempts = useRef<Map<string, number>>(new Map());
  const statsIntervalRef = useRef<number>();
  const pipOperationInProgress = useRef(false);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

  // Carregar credenciais TURN dinâmicas
  useEffect(() => {
    turnService.getIceServers(userId).then(servers => {
      iceServersRef.current = servers;
      console.log('[WebRTC] ICE servers carregados:', servers.length);
    });
  }, [userId]);

  const getConfiguration = useCallback((): RTCConfiguration => ({
    iceServers: iceServersRef.current,
    iceCandidatePoolSize: 10,
  }), []);

  const collectConnectionStats = useCallback(async () => {
    const newStats = new Map<string, ConnectionStats>();
    for (const [peerId, pc] of peerConnections.current.entries()) {
      if (pc.connectionState !== 'connected') continue;
      try {
        const report = await pc.getStats();
        let rtt = 0, packetLoss = 0, packetsLost = 0, packetsReceived = 0;
        report.forEach((stat) => {
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded') rtt = stat.currentRoundTripTime ? stat.currentRoundTripTime * 1000 : 0;
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') { packetsLost = stat.packetsLost || 0; packetsReceived = stat.packetsReceived || 0; }
        });
        if (packetsReceived > 0) packetLoss = (packetsLost / (packetsLost + packetsReceived)) * 100;
        let quality: ConnectionStats['quality'] = 'unknown';
        if (rtt < 100 && packetLoss < 1) quality = 'excellent';
        else if (rtt < 200 && packetLoss < 3) quality = 'good';
        else if (rtt < 400 && packetLoss < 8) quality = 'fair';
        else if (rtt > 0) quality = 'poor';
        newStats.set(peerId, { quality, rtt: Math.round(rtt), packetLoss: Math.round(packetLoss * 10) / 10 });
      } catch (e) { console.warn('Stats error:', e); }
    }
    setConnectionStats(newStats);
    if (newStats.size === 0) setOverallQuality('unknown');
    else {
      const qualities = Array.from(newStats.values()).map(s => s.quality);
      const order = ['poor', 'fair', 'good', 'excellent', 'unknown'];
      const worst = qualities.reduce((w, c) => order.indexOf(c) < order.indexOf(w) ? c : w, 'excellent' as ConnectionStats['quality']);
      setOverallQuality(worst);
    }
  }, []);

  const performIceRestart = useCallback(async (remoteUserId: string) => {
    const pc = peerConnections.current.get(remoteUserId);
    if (!pc) return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      sendMessage({ action: 'webrtc-signal', type: 'offer', roomId, userId, targetUserId: remoteUserId, signal: { type: 'offer', offer } });
    } catch (e) { console.error('ICE restart error:', e); }
  }, [roomId, userId, sendMessage]);

  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return;
    try { audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch (e) { console.error(e); }
  }, []);

  const cleanupAudioContext = useCallback(() => {
    // Limpar TODOS os intervals de audio
    audioIntervals.current.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    audioIntervals.current.clear();
    
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    analyserNodes.current.clear();
  }, []);

  const setupAudioAnalyser = useCallback((stream: MediaStream, streamUserId: string) => {
    if (!audioContextRef.current) return;
    
    // Limpar interval anterior se existir
    const existingInterval = audioIntervals.current.get(streamUserId);
    if (existingInterval) {
      clearInterval(existingInterval);
      audioIntervals.current.delete(streamUserId);
    }
    
    try {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserNodes.current.set(streamUserId, analyser);
      const check = () => {
        if (!analyserNodes.current.has(streamUserId)) {
          // Limpar interval se usuário não existe mais
          const interval = audioIntervals.current.get(streamUserId);
          if (interval) {
            clearInterval(interval);
            audioIntervals.current.delete(streamUserId);
          }
          return;
        }
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b) / data.length;
        setSpeakingUsers(prev => { const s = new Set(prev); avg > 30 ? s.add(streamUserId) : s.delete(streamUserId); return s; });
      };
      // Armazenar referência do interval
      const intervalId = window.setInterval(check, 100);
      audioIntervals.current.set(streamUserId, intervalId);
    } catch (e) { console.error(e); }
  }, []);

  const processPendingIceCandidates = useCallback(async (remoteUserId: string) => {
    const pc = peerConnections.current.get(remoteUserId);
    const candidates = pendingIceCandidates.current.get(remoteUserId) || [];
    if (pc && pc.remoteDescription && candidates.length > 0) {
      for (const c of candidates) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn(e); } }
      pendingIceCandidates.current.delete(remoteUserId);
    }
  }, []);

  const closeAllConnections = useCallback(() => {
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setRemoteStreams(new Map());
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; setLocalStream(null); }
  }, []);

  const createPeerConnection = useCallback((remoteUserId: string): RTCPeerConnection => {
    if (peerConnections.current.has(remoteUserId)) return peerConnections.current.get(remoteUserId)!;
    const pc = new RTCPeerConnection(getConfiguration());
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => pc.addTrack(t, screenStreamRef.current!));
    pc.ontrack = (e) => {
      const [rs] = e.streams;
      setRemoteStreams(prev => new Map(prev).set(remoteUserId, rs));
      setupAudioAnalyser(rs, remoteUserId);
      setConnectionErrors(prev => { const m = new Map(prev); m.delete(remoteUserId); return m; });
    };
    pc.onicecandidate = (e) => { if (e.candidate) sendMessage({ action: 'webrtc-signal', type: 'ice-candidate', roomId, userId, targetUserId: remoteUserId, signal: { type: 'ice-candidate', candidate: e.candidate } }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        const att = reconnectAttempts.current.get(remoteUserId) || 0;
        if (att < 3) { reconnectAttempts.current.set(remoteUserId, att + 1); setConnectionErrors(prev => new Map(prev).set(remoteUserId, 'Reconectando... (' + (att + 1) + '/3)')); setTimeout(() => performIceRestart(remoteUserId), 1000); }
        else setConnectionErrors(prev => new Map(prev).set(remoteUserId, 'Conexão falhou.'));
      } else if (pc.connectionState === 'connected') { reconnectAttempts.current.set(remoteUserId, 0); setConnectionErrors(prev => { const m = new Map(prev); m.delete(remoteUserId); return m; }); }
    };
    pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'disconnected') setConnectionErrors(prev => new Map(prev).set(remoteUserId, 'Conexão instável...')); };
    peerConnections.current.set(remoteUserId, pc);
    return pc;
  }, [roomId, userId, sendMessage, setupAudioAnalyser, performIceRestart, getConfiguration]);

  const createOffer = useCallback(async (remoteUserId: string) => {
    // Verificar se já há oferta pendente (race condition fix)
    if (pendingOffers.current.has(remoteUserId)) {
      console.log('[WebRTC] Oferta já pendente para:', remoteUserId);
      return;
    }
    
    pendingOffers.current.add(remoteUserId);
    
    try {
      const pc = createPeerConnection(remoteUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendMessage({ action: 'webrtc-signal', type: 'offer', roomId, userId, userName, targetUserId: remoteUserId, signal: { type: 'offer', offer } });
    } catch (e) { 
      console.error(e); 
    } finally {
      pendingOffers.current.delete(remoteUserId);
    }
  }, [createPeerConnection, roomId, userId, userName, sendMessage]);

  const handleOffer = useCallback(async (remoteUserId: string, offer: RTCSessionDescriptionInit) => {
    try {
      const pc = createPeerConnection(remoteUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await processPendingIceCandidates(remoteUserId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendMessage({ action: 'webrtc-signal', type: 'answer', roomId, userId, userName, targetUserId: remoteUserId, signal: { type: 'answer', answer } });
    } catch (e) { console.error(e); }
  }, [createPeerConnection, roomId, userId, userName, sendMessage, processPendingIceCandidates]);

  const handleAnswer = useCallback(async (remoteUserId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnections.current.get(remoteUserId);
      if (pc && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(new RTCSessionDescription(answer)); await processPendingIceCandidates(remoteUserId); }
    } catch (e) { console.error(e); }
  }, [processPendingIceCandidates]);

  const handleIceCandidate = useCallback(async (remoteUserId: string, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnections.current.get(remoteUserId);
      if (!pc || !pc.remoteDescription) { const p = pendingIceCandidates.current.get(remoteUserId) || []; p.push(candidate); pendingIceCandidates.current.set(remoteUserId, p); return; }
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) { console.error(e); }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } as any, audio: false });
      screenStreamRef.current = stream; setScreenStream(stream); setIsScreenSharing(true);
      const vt = stream.getVideoTracks()[0];
      peerConnections.current.forEach(pc => { const s = pc.getSenders().find(s => s.track?.kind === 'video'); if (s && localStreamRef.current) s.replaceTrack(vt); });
      vt.onended = () => stopScreenShare();
      return true;
    } catch (e) { console.error(e); return false; }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; setScreenStream(null); setIsScreenSharing(false);
      if (localStreamRef.current) { const vt = localStreamRef.current.getVideoTracks()[0]; if (vt) peerConnections.current.forEach(pc => { const s = pc.getSenders().find(s => s.track?.kind === 'video'); if (s) s.replaceTrack(vt); }); }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => { isScreenSharing ? stopScreenShare() : await startScreenShare(); }, [isScreenSharing, startScreenShare, stopScreenShare]);

  const handleSignalingMessage = useCallback(async (data: any) => {
    if (data.type === 'webrtc-signal' && data.roomId === roomId) {
      const { userId: ruid, signal, userName: run } = data;
      if (ruid === userId) return;
      if (run) setParticipantNames(prev => new Map(prev).set(ruid, run));
      switch (signal?.type) {
        case 'user-joined': if (localStreamRef.current) await createOffer(ruid); else { const i = setInterval(async () => { if (localStreamRef.current) { clearInterval(i); await createOffer(ruid); } }, 500); setTimeout(() => clearInterval(i), 10000); } break;
        case 'offer': await handleOffer(ruid, signal.offer); break;
        case 'answer': await handleAnswer(ruid, signal.answer); break;
        case 'ice-candidate': await handleIceCandidate(ruid, signal.candidate); break;
      }
    }
    if (data.type === 'room_event' && data.data.roomId === roomId) {
      const { eventType, userId: euid, existingParticipants, userName: eun } = data.data;
      if (eun && euid) setParticipantNames(prev => new Map(prev).set(euid, eun));
      if (eventType === 'participants_list' && existingParticipants?.length > 0) {
        const fn = async () => { for (const p of existingParticipants) { if (p !== userId && !peerConnections.current.has(p)) { try { await createOffer(p); } catch (e) { console.error(e); } await new Promise(r => setTimeout(r, 200)); } } };
        if (localStreamRef.current) await fn(); else { let a = 0; const i = setInterval(async () => { a++; if (localStreamRef.current) { clearInterval(i); await fn(); } else if (a >= 20) clearInterval(i); }, 500); }
      } else if (eventType === 'user_joined' && euid === userId && existingParticipants?.length > 0) {
        const fn = async () => { for (const p of existingParticipants) { if (p !== userId) { try { await createOffer(p); } catch (e) { console.error(e); } await new Promise(r => setTimeout(r, 100)); } } };
        if (localStreamRef.current) await fn(); else { let a = 0; const i = setInterval(async () => { a++; if (localStreamRef.current) { clearInterval(i); await fn(); } else if (a >= 20) clearInterval(i); }, 500); }
      } else if (eventType === 'user_joined' && euid !== userId) {
        if (localStreamRef.current) setTimeout(async () => { if (!peerConnections.current.has(euid)) await createOffer(euid); }, 500);
      } else if (eventType === 'user_left' && euid !== userId) {
        const pc = peerConnections.current.get(euid);
        if (pc) { pc.close(); peerConnections.current.delete(euid); setRemoteStreams(prev => { const m = new Map(prev); m.delete(euid); return m; }); analyserNodes.current.delete(euid); setParticipantNames(prev => { const m = new Map(prev); m.delete(euid); return m; }); }
      }
    }
  }, [roomId, userId, createOffer, handleOffer, handleAnswer, handleIceCandidate]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    const init = async () => {
      try {
        initAudioContext();
        const svd = sessionStorage.getItem('videochat_video_device'), sad = sessionStorage.getItem('videochat_audio_device');
        const sve = sessionStorage.getItem('videochat_video_enabled'), sae = sessionStorage.getItem('videochat_audio_enabled');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: svd ? { exact: svd } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' }, audio: { deviceId: sad ? { exact: sad } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        if (sve === 'false') { stream.getVideoTracks().forEach(t => t.enabled = false); setIsVideoEnabled(false); }
        if (sae === 'false') { stream.getAudioTracks().forEach(t => t.enabled = false); setIsAudioEnabled(false); }
        localStreamRef.current = stream; setLocalStream(stream); setupAudioAnalyser(stream, userId);
        sendMessage({ action: 'webrtc-signal', type: 'user-joined', roomId, userId, userName, signal: { type: 'user-joined' } });
        sendMessage({ action: 'webrtc-signal', type: 'request-participants', roomId, userId, userName, signal: { type: 'request-participants' } });
      } catch (e: any) {
        let msg = 'Erro ao acessar mídia.';
        if (e.name === 'NotAllowedError') msg = 'Permissão negada. Clique no ícone da câmera na barra de endereços.';
        else if (e.name === 'NotFoundError') msg = 'Câmera ou microfone não encontrados.';
        else if (e.name === 'NotReadableError') msg = 'Câmera ou microfone já em uso.';
        setConnectionErrors(prev => new Map(prev).set('local', msg));
      }
    };
    const tid = setTimeout(init, 1000);
    const unsub = addMessageHandler(handleSignalingMessage);
    statsIntervalRef.current = window.setInterval(collectConnectionStats, 3000);
    return () => { clearTimeout(tid); unsub(); stopLocalStream(); closeAllConnections(); cleanupAudioContext(); if (statsIntervalRef.current) clearInterval(statsIntervalRef.current); isInitializedRef.current = false; };
  }, [roomId, userId, userName, addMessageHandler, handleSignalingMessage, collectConnectionStats, initAudioContext, setupAudioAnalyser, sendMessage, stopLocalStream, closeAllConnections, cleanupAudioContext]);

  const toggleVideo = useCallback(() => { if (localStreamRef.current) { const t = localStreamRef.current.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setIsVideoEnabled(t.enabled); } } }, []);
  const toggleAudio = useCallback(() => { if (localStreamRef.current) { const t = localStreamRef.current.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setIsAudioEnabled(t.enabled); } } }, []);
  const getPeerConnections = useCallback(() => peerConnections.current, []);

  return { localStream, screenStream, remoteStreams, isVideoEnabled, isAudioEnabled, isScreenSharing, toggleVideo, toggleAudio, toggleScreenShare, speakingUsers, connectionErrors, connectionStats, overallQuality, participantNames, getPeerConnections };
}
