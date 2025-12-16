import { useState, useEffect, useRef } from 'react';

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
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    startLocalStream();
    setupSignaling();

    return () => {
      stopLocalStream();
      closeAllConnections();
    };
  }, [roomId, userId]);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setLocalStream(stream);
      
      // Notificar outros usuários que entrou na sala
      sendMessage({
        action: 'webrtc-signal',
        type: 'user-joined',
        roomId,
        userId,
      });
    } catch (error) {
      console.error('Erro ao acessar mídia:', error);
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
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removePeerConnection(remoteUserId);
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
  };
}
