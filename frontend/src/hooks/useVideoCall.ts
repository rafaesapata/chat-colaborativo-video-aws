import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVideoCallProps {
  roomId: string;
  userId: string;
  sendMessage: (message: any) => boolean;
  addMessageHandler: (handler: (data: any) => void) => () => void;
}

export function useVideoCall({ roomId, userId, sendMessage, addMessageHandler }: UseVideoCallProps) {
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
  const localStreamRef = useRef<MediaStream | null>(null);
  const isInitializedRef = useRef(false);

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const qualitySettings = {
    high: { width: 1280, height: 720, frameRate: 30, bitrate: 2500000 },
    medium: { width: 640, height: 480, frameRate: 24, bitrate: 1000000 },
    low: { width: 320, height: 240, frameRate: 15, bitrate: 500000 },
  };

  // Funções estáveis com useCallback
  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return;
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Erro ao criar AudioContext:', error);
    }
  }, []);

  const cleanupAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserNodes.current.clear();
  }, []);

  const setupAudioAnalyser = useCallback((stream: MediaStream, streamUserId: string) => {
    if (!audioContextRef.current) return;

    try {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserNodes.current.set(streamUserId, analyser);

      const checkAudioLevel = () => {
        if (!analyserNodes.current.has(streamUserId)) return;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        setSpeakingUsers(prev => {
          const newSet = new Set(prev);
          if (average > 30) {
            newSet.add(streamUserId);
          } else {
            newSet.delete(streamUserId);
          }
          return newSet;
        });
      };

      const intervalId = setInterval(checkAudioLevel, 100);
      return () => clearInterval(intervalId);
    } catch (error) {
      console.error('Erro ao configurar analisador de áudio:', error);
    }
  }, []);

  const closeAllConnections = useCallback(() => {
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setRemoteStreams(new Map());
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const createPeerConnection = useCallback((remoteUserId: string): RTCPeerConnection => {
    if (peerConnections.current.has(remoteUserId)) {
      return peerConnections.current.get(remoteUserId)!;
    }

    const pc = new RTCPeerConnection(configuration);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(remoteUserId, remoteStream);
        return newMap;
      });
      setupAudioAnalyser(remoteStream, remoteUserId);
      setConnectionErrors(prev => {
        const newMap = new Map(prev);
        newMap.delete(remoteUserId);
        return newMap;
      });
    };

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

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteUserId}:`, pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        setConnectionErrors(prev => new Map(prev).set(remoteUserId, 
          'Conexão falhou. Tentando reconectar...'));
      } else if (pc.connectionState === 'connected') {
        setConnectionErrors(prev => {
          const newMap = new Map(prev);
          newMap.delete(remoteUserId);
          return newMap;
        });
      }
    };

    peerConnections.current.set(remoteUserId, pc);
    return pc;
  }, [roomId, userId, sendMessage, setupAudioAnalyser]);

  const createOffer = useCallback(async (remoteUserId: string) => {
    try {
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
    } catch (error) {
      console.error('Erro ao criar oferta:', error);
    }
  }, [createPeerConnection, roomId, userId, sendMessage]);

  const handleOffer = useCallback(async (remoteUserId: string, offer: RTCSessionDescriptionInit) => {
    try {
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
    } catch (error) {
      console.error('Erro ao processar oferta:', error);
    }
  }, [createPeerConnection, roomId, userId, sendMessage]);

  const handleAnswer = useCallback(async (remoteUserId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnections.current.get(remoteUserId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Erro ao processar resposta:', error);
    }
  }, []);

  const handleIceCandidate = useCallback(async (remoteUserId: string, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnections.current.get(remoteUserId);
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Erro ao adicionar ICE candidate:', error);
    }
  }, []);

  const handleSignalingMessage = useCallback(async (data: any) => {
    if (data.type !== 'webrtc-signal' || data.roomId !== roomId) return;

    const { userId: remoteUserId, signal } = data;
    if (remoteUserId === userId) return;

    switch (signal?.type) {
      case 'user-joined':
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
  }, [roomId, userId, createOffer, handleOffer, handleAnswer, handleIceCandidate]);

  // Inicialização única
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialize = async () => {
      try {
        initAudioContext();

        // Verificar se as permissões já foram concedidas
        const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
        console.log('[VideoCall] Permissão da câmera:', permissions.state);

        const settings = qualitySettings[videoQuality];
        
        console.log('[VideoCall] Solicitando acesso à mídia...');
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
          },
        });

        console.log('[VideoCall] ✅ Acesso à mídia concedido!');
        localStreamRef.current = stream;
        setLocalStream(stream);
        setupAudioAnalyser(stream, userId);

        sendMessage({
          action: 'webrtc-signal',
          type: 'user-joined',
          roomId,
          userId,
        });
      } catch (error) {
        console.error('Erro ao acessar mídia:', error);
        
        let errorMessage = 'Erro desconhecido ao acessar mídia.';
        
        if (error instanceof Error) {
          switch (error.name) {
            case 'NotAllowedError':
              errorMessage = 'Permissão negada. Clique no ícone da câmera na barra de endereços e permita o acesso.';
              break;
            case 'NotFoundError':
              errorMessage = 'Câmera ou microfone não encontrados. Verifique se estão conectados.';
              break;
            case 'NotReadableError':
              errorMessage = 'Câmera ou microfone já estão sendo usados por outro aplicativo.';
              break;
            case 'OverconstrainedError':
              errorMessage = 'Configurações de vídeo não suportadas pelo dispositivo.';
              break;
            case 'SecurityError':
              errorMessage = 'Acesso negado por questões de segurança. Use HTTPS.';
              break;
            default:
              errorMessage = `Erro: ${error.message}`;
          }
        }
        
        setConnectionErrors(prev => new Map(prev).set('local', errorMessage));
      }
    };

    // Aguardar um pouco antes de solicitar permissões para dar tempo da UI carregar
    const timeoutId = setTimeout(initialize, 1000);

    // Registrar handler de mensagens
    const unsubscribe = addMessageHandler(handleSignalingMessage);

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
      stopLocalStream();
      closeAllConnections();
      cleanupAudioContext();
      isInitializedRef.current = false;
    };
  }, [roomId, userId, addMessageHandler, handleSignalingMessage]); // Dependências mínimas necessárias

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

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