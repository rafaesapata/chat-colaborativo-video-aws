import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVideoCallProps {
  roomId: string;
  userId: string;
  sendMessage: (message: any) => void;
  onMessage: (handler: (data: any) => void) => void;
}

export function useVideoCall({ roomId, userId, sendMessage, onMessage }: UseVideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [connectionErrors, setConnectionErrors] = useState<Map<string, string>>(new Map());
  const [videoQuality, setVideoQuality] = useState<'high' | 'medium' | 'low'>('high');
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodes = useRef<Map<string, AnalyserNode>>(new Map());

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Configurações de qualidade adaptativa
  const qualitySettings = {
    high: { width: 1280, height: 720, frameRate: 30, bitrate: 2500000 },
    medium: { width: 640, height: 480, frameRate: 24, bitrate: 1000000 },
    low: { width: 320, height: 240, frameRate: 15, bitrate: 500000 },
  };

  useEffect(() => {
    startLocalStream();
    setupSignaling();
    initAudioContext();

    return () => {
      stopLocalStream();
      closeAllConnections();
      cleanupAudioContext();
    };
  }, [roomId, userId]);

  // Monitorar qualidade da conexão
  useEffect(() => {
    const interval = setInterval(() => {
      monitorConnectionQuality();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const initAudioContext = () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Erro ao criar AudioContext:', error);
    }
  };

  const cleanupAudioContext = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserNodes.current.clear();
  };

  const monitorConnectionQuality = async () => {
    for (const [remoteUserId, pc] of peerConnections.current.entries()) {
      try {
        const stats = await pc.getStats();
        let totalPacketsLost = 0;
        let totalPacketsReceived = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            totalPacketsLost += report.packetsLost || 0;
            totalPacketsReceived += report.packetsReceived || 0;
          }
        });

        const lossRate = totalPacketsReceived > 0 
          ? totalPacketsLost / totalPacketsReceived 
          : 0;

        // Ajustar qualidade baseado na perda de pacotes
        if (lossRate > 0.1 && videoQuality !== 'low') {
          setVideoQuality('low');
          await adjustVideoQuality('low');
        } else if (lossRate > 0.05 && videoQuality === 'high') {
          setVideoQuality('medium');
          await adjustVideoQuality('medium');
        } else if (lossRate < 0.02 && videoQuality !== 'high') {
          setVideoQuality('high');
          await adjustVideoQuality('high');
        }
      } catch (error) {
        console.error('Erro ao monitorar qualidade:', error);
      }
    }
  };

  const adjustVideoQuality = async (quality: 'high' | 'medium' | 'low') => {
    if (!localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const settings = qualitySettings[quality];
    
    try {
      await videoTrack.applyConstraints({
        width: { ideal: settings.width },
        height: { ideal: settings.height },
        frameRate: { ideal: settings.frameRate },
      });

      // Ajustar bitrate nos peer connections
      peerConnections.current.forEach(async (pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }
          parameters.encodings[0].maxBitrate = settings.bitrate;
          await sender.setParameters(parameters);
        }
      });
    } catch (error) {
      console.error('Erro ao ajustar qualidade:', error);
    }
  };

  const setupAudioAnalyser = (stream: MediaStream, userId: string) => {
    if (!audioContextRef.current) return;

    try {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserNodes.current.set(userId, analyser);

      // Monitorar nível de áudio
      const checkAudioLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        setSpeakingUsers(prev => {
          const newSet = new Set(prev);
          if (average > 30) {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          return newSet;
        });
      };

      const intervalId = setInterval(checkAudioLevel, 100);
      return () => clearInterval(intervalId);
    } catch (error) {
      console.error('Erro ao configurar analisador de áudio:', error);
    }
  };

  const startLocalStream = async () => {
    try {
      const settings = qualitySettings[videoQuality];
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: settings.width },
          height: { ideal: settings.height },
          frameRate: { ideal: settings.frameRate },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });
      setLocalStream(stream);
      
      // Configurar analisador de áudio local
      setupAudioAnalyser(stream, userId);
      
      // Notificar outros usuários que entrou na sala
      sendMessage({
        action: 'webrtc-signal',
        type: 'user-joined',
        roomId,
        userId,
      });
    } catch (error) {
      console.error('Erro ao acessar mídia:', error);
      setConnectionErrors(prev => new Map(prev).set('local', 
        'Não foi possível acessar câmera/microfone. Verifique as permissões.'));
    }
  };

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  const closeAllConnections = () => {
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setRemoteStreams(new Map());
  };

  const setupSignaling = () => {
    onMessage((data: any) => {
      if (data.type === 'webrtc-signal' && data.roomId === roomId) {
        handleSignalingMessage(data);
      }
    });
  };

  const handleSignalingMessage = async (data: any) => {
    const { userId: remoteUserId, signal } = data;

    if (remoteUserId === userId) return; // Ignorar próprias mensagens

    switch (signal?.type) {
      case 'user-joined':
        // Criar oferta para novo usuário
        await createOffer(remoteUserId);
        break;

      case 'offer':
        await handleOffer(remoteUserId, signal.offer);
        break;

      case 'answer':
        await handleAnswer(remoteUserId, signal.answer);
        break;

      case 'ice-candidate':
        await handleIceCandidate(remoteUserId, signal.candidate);
        break;
    }
  };

  const createPeerConnection = (remoteUserId: string): RTCPeerConnection => {
    if (peerConnections.current.has(remoteUserId)) {
      return peerConnections.current.get(remoteUserId)!;
    }

    const pc = new RTCPeerConnection(configuration);

    // Adicionar tracks locais
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Receber tracks remotos
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(remoteUserId, remoteStream);
        return newMap;
      });
      
      // Configurar analisador de áudio para stream remoto
      setupAudioAnalyser(remoteStream, remoteUserId);
      
      // Limpar erro de conexão se existir
      setConnectionErrors(prev => {
        const newMap = new Map(prev);
        newMap.delete(remoteUserId);
        return newMap;
      });
    };

    // Enviar ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          action: 'webrtc-signal',
          type: 'ice-candidate',
          roomId,
          userId,
          targetUserId: remoteUserId,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate,
          },
        });
      }
    };

    // Monitorar estado da conexão
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteUserId}:`, pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        setConnectionErrors(prev => new Map(prev).set(remoteUserId, 
          'Conexão falhou. Tentando reconectar...'));
        // Tentar reconectar
        setTimeout(() => {
          if (pc.connectionState === 'failed') {
            removePeerConnection(remoteUserId);
            createOffer(remoteUserId);
          }
        }, 3000);
      } else if (pc.connectionState === 'disconnected') {
        setConnectionErrors(prev => new Map(prev).set(remoteUserId, 
          'Usuário desconectado'));
        setTimeout(() => {
          if (pc.connectionState === 'disconnected') {
            removePeerConnection(remoteUserId);
          }
        }, 5000);
      } else if (pc.connectionState === 'connected') {
        setConnectionErrors(prev => {
          const newMap = new Map(prev);
          newMap.delete(remoteUserId);
          return newMap;
        });
      }
    };

    // Monitorar estado ICE
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state with ${remoteUserId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        setConnectionErrors(prev => new Map(prev).set(remoteUserId, 
          'Falha na conexão ICE. Verifique firewall/NAT.'));
      }
    };

    peerConnections.current.set(remoteUserId, pc);
    return pc;
  };

  const createOffer = async (remoteUserId: string) => {
    const pc = createPeerConnection(remoteUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendMessage({
      action: 'webrtc-signal',
      type: 'offer',
      roomId,
      userId,
      targetUserId: remoteUserId,
      signal: {
        type: 'offer',
        offer,
      },
    });
  };

  const handleOffer = async (remoteUserId: string, offer: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection(remoteUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendMessage({
      action: 'webrtc-signal',
      type: 'answer',
      roomId,
      userId,
      targetUserId: remoteUserId,
      signal: {
        type: 'answer',
        answer,
      },
    });
  };

  const handleAnswer = async (remoteUserId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(remoteUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (remoteUserId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(remoteUserId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const removePeerConnection = (remoteUserId: string) => {
    const pc = peerConnections.current.get(remoteUserId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(remoteUserId);
    }
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(remoteUserId);
      return newMap;
    });
    analyserNodes.current.delete(remoteUserId);
    setSpeakingUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(remoteUserId);
      return newSet;
    });
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  return {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
    speakingUsers,
    connectionErrors,
    videoQuality,
  };
}
