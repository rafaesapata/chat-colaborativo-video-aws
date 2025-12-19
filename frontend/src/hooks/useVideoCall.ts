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
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const configuration: RTCConfiguration = {
    iceServers: [
      // STUN servers (gratuitos - para descoberta de IP)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // TURN server (relay para garantir conectividade)
      {
        urls: 'turn:a.relay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:a.relay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:a.relay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all'
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

  const processPendingIceCandidates = useCallback(async (remoteUserId: string) => {
    const pc = peerConnections.current.get(remoteUserId);
    const candidates = pendingIceCandidates.current.get(remoteUserId) || [];
    
    if (pc && pc.remoteDescription && candidates.length > 0) {
      console.log(`[VideoCall] 🧊 Processando ${candidates.length} ICE candidates pendentes para ${remoteUserId}`);
      
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`[VideoCall] ✅ ICE candidate pendente adicionado para ${remoteUserId}`);
        } catch (error) {
          console.warn(`[VideoCall] ⚠️ Erro ao adicionar ICE candidate pendente:`, error);
        }
      }
      
      // Limpar a fila após processar
      pendingIceCandidates.current.delete(remoteUserId);
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
      console.log(`[VideoCall] ♻️ Reutilizando PeerConnection existente para ${remoteUserId}`);
      return peerConnections.current.get(remoteUserId)!;
    }

    console.log(`[VideoCall] 🔗 Criando nova PeerConnection para ${remoteUserId}`);
    const pc = new RTCPeerConnection(configuration);

    if (localStreamRef.current) {
      console.log(`[VideoCall] 📹 Adicionando tracks locais para ${remoteUserId}`);
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`[VideoCall] Adicionando track ${track.kind} para ${remoteUserId}`);
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      console.log(`[VideoCall] ⚠️ Nenhum stream local disponível para ${remoteUserId}`);
    }

    pc.ontrack = (event) => {
      console.log(`[VideoCall] 📺 Stream remoto recebido de ${remoteUserId}!`);
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(remoteUserId, remoteStream);
        console.log(`[VideoCall] Stream de ${remoteUserId} adicionado ao mapa`);
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
        console.log(`[VideoCall] 🧊 Enviando ICE candidate para ${remoteUserId}`);
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
      console.log(`[VideoCall] 🔗 Estado da conexão com ${remoteUserId}:`, pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        console.log(`[VideoCall] ❌ Conexão falhou com ${remoteUserId}`);
        setConnectionErrors(prev => new Map(prev).set(remoteUserId, 
          'Conexão falhou. Tentando reconectar...'));
      } else if (pc.connectionState === 'connected') {
        console.log(`[VideoCall] ✅ Conectado com sucesso a ${remoteUserId}!`);
        setConnectionErrors(prev => {
          const newMap = new Map(prev);
          newMap.delete(remoteUserId);
          return newMap;
        });
      }
    };

    peerConnections.current.set(remoteUserId, pc);
    console.log(`[VideoCall] PeerConnection armazenada para ${remoteUserId}`);
    return pc;
  }, [roomId, userId, sendMessage, setupAudioAnalyser]);

  const createOffer = useCallback(async (remoteUserId: string) => {
    try {
      console.log(`[VideoCall] 🤝 Criando oferta para ${remoteUserId}...`);
      const pc = createPeerConnection(remoteUserId);
      console.log(`[VideoCall] PeerConnection criada para ${remoteUserId}`);
      
      const offer = await pc.createOffer();
      console.log(`[VideoCall] Oferta criada para ${remoteUserId}:`, offer.type);
      
      await pc.setLocalDescription(offer);
      console.log(`[VideoCall] LocalDescription definida para ${remoteUserId}`);

      const message = {
        action: 'webrtc-signal',
        type: 'offer',
        roomId,
        userId,
        targetUserId: remoteUserId,
        signal: {
          type: 'offer',
          offer,
        },
      };
      
      console.log(`[VideoCall] 📤 Enviando oferta para ${remoteUserId}`);
      const sent = sendMessage(message);
      console.log(`[VideoCall] Oferta enviada:`, sent);
    } catch (error) {
      console.error(`[VideoCall] ❌ Erro ao criar oferta para ${remoteUserId}:`, error);
    }
  }, [createPeerConnection, roomId, userId, sendMessage]);

  const handleOffer = useCallback(async (remoteUserId: string, offer: RTCSessionDescriptionInit) => {
    try {
      console.log(`[VideoCall] 📞 Processando oferta de ${remoteUserId}`);
      const pc = createPeerConnection(remoteUserId);
      
      console.log(`[VideoCall] Definindo RemoteDescription para ${remoteUserId}`);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // ✅ CRÍTICO: Processar ICE candidates pendentes APÓS setRemoteDescription
      await processPendingIceCandidates(remoteUserId);
      
      console.log(`[VideoCall] Criando resposta para ${remoteUserId}`);
      const answer = await pc.createAnswer();
      
      console.log(`[VideoCall] Definindo LocalDescription para ${remoteUserId}`);
      await pc.setLocalDescription(answer);

      const message = {
        action: 'webrtc-signal',
        type: 'answer',
        roomId,
        userId,
        targetUserId: remoteUserId,
        signal: {
          type: 'answer',
          answer,
        },
      };
      
      console.log(`[VideoCall] 📤 Enviando resposta para ${remoteUserId}`);
      const sent = sendMessage(message);
      console.log(`[VideoCall] Resposta enviada:`, sent);
    } catch (error) {
      console.error(`[VideoCall] ❌ Erro ao processar oferta de ${remoteUserId}:`, error);
    }
  }, [createPeerConnection, roomId, userId, sendMessage, processPendingIceCandidates]);

  const handleAnswer = useCallback(async (remoteUserId: string, answer: RTCSessionDescriptionInit) => {
    try {
      console.log(`[VideoCall] 📞 Processando resposta de ${remoteUserId}`);
      const pc = peerConnections.current.get(remoteUserId);
      
      if (!pc) {
        console.log(`[VideoCall] ⚠️ PeerConnection não encontrada para ${remoteUserId}`);
        return;
      }
      
      console.log(`[VideoCall] Estado do signaling para ${remoteUserId}:`, pc.signalingState);
      
      if (pc.signalingState === 'have-local-offer') {
        console.log(`[VideoCall] Definindo RemoteDescription (resposta) para ${remoteUserId}`);
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // ✅ CRÍTICO: Processar ICE candidates pendentes APÓS setRemoteDescription
        await processPendingIceCandidates(remoteUserId);
        
        console.log(`[VideoCall] ✅ Resposta processada para ${remoteUserId}`);
      } else {
        console.log(`[VideoCall] ⚠️ Estado inválido para processar resposta de ${remoteUserId}: ${pc.signalingState}`);
      }
    } catch (error) {
      console.error(`[VideoCall] ❌ Erro ao processar resposta de ${remoteUserId}:`, error);
    }
  }, [processPendingIceCandidates]);

  const handleIceCandidate = useCallback(async (remoteUserId: string, candidate: RTCIceCandidateInit) => {
    try {
      console.log(`[VideoCall] 🧊 Processando ICE candidate de ${remoteUserId}`);
      const pc = peerConnections.current.get(remoteUserId);
      
      // Se não existe PeerConnection ainda, enfileirar
      if (!pc) {
        console.log(`[VideoCall] 📦 Enfileirando ICE candidate (sem PC) para ${remoteUserId}`);
        const pending = pendingIceCandidates.current.get(remoteUserId) || [];
        pending.push(candidate);
        pendingIceCandidates.current.set(remoteUserId, pending);
        return;
      }
      
      // Se tem PC mas não tem remoteDescription, enfileirar
      if (!pc.remoteDescription) {
        console.log(`[VideoCall] 📦 Enfileirando ICE candidate (sem remoteDesc) para ${remoteUserId}`);
        const pending = pendingIceCandidates.current.get(remoteUserId) || [];
        pending.push(candidate);
        pendingIceCandidates.current.set(remoteUserId, pending);
        return;
      }
      
      // Pode adicionar diretamente
      console.log(`[VideoCall] ✅ Adicionando ICE candidate diretamente para ${remoteUserId}`);
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      
    } catch (error) {
      console.error(`[VideoCall] ❌ Erro ao processar ICE candidate de ${remoteUserId}:`, error);
    }
  }, []);

  const handleSignalingMessage = useCallback(async (data: any) => {
    console.log('[VideoCall] 📨 Mensagem recebida:', JSON.stringify(data, null, 2));
    
    // Handle WebRTC signaling messages
    if (data.type === 'webrtc-signal' && data.roomId === roomId) {
      const { userId: remoteUserId, signal } = data;
      
      console.log(`[VideoCall] 🔍 Dados extraídos - remoteUserId: ${remoteUserId}, signal:`, signal);
      
      if (remoteUserId === userId) {
        console.log(`[VideoCall] ⏭️ Ignorando mensagem própria`);
        return;
      }

      console.log(`[VideoCall] 🎯 Processando sinal WebRTC de ${remoteUserId}:`, signal?.type);

      switch (signal?.type) {
        case 'user-joined':
          console.log(`[VideoCall] ${remoteUserId} entrou com vídeo`);
          // Verificar se já temos stream local antes de criar oferta
          if (localStreamRef.current) {
            console.log(`[VideoCall] Stream local disponível, criando oferta para ${remoteUserId}...`);
            await createOffer(remoteUserId);
          } else {
            console.log(`[VideoCall] ⚠️ Stream local ainda não disponível, aguardando...`);
            // Aguardar stream local e então criar oferta
            const checkStream = setInterval(async () => {
              if (localStreamRef.current) {
                clearInterval(checkStream);
                console.log(`[VideoCall] Stream local agora disponível, criando oferta para ${remoteUserId}...`);
                await createOffer(remoteUserId);
              }
            }, 500);
            // Timeout de 10 segundos
            setTimeout(() => clearInterval(checkStream), 10000);
          }
          break;
        case 'offer':
          console.log(`[VideoCall] Recebida oferta de ${remoteUserId}`);
          await handleOffer(remoteUserId, signal.offer);
          break;
        case 'answer':
          console.log(`[VideoCall] Recebida resposta de ${remoteUserId}`);
          await handleAnswer(remoteUserId, signal.answer);
          break;
        case 'ice-candidate':
          console.log(`[VideoCall] Recebido ICE candidate de ${remoteUserId}`);
          await handleIceCandidate(remoteUserId, signal.candidate);
          break;
      }
    }
    
    // Handle room events and initiate WebRTC connections
    if (data.type === 'room_event' && data.data.roomId === roomId) {
      const { eventType, userId: eventUserId, participants: roomParticipants, existingParticipants } = data.data;
      
      // ✅ NOVO: Resposta à solicitação de participantes (após câmera estar pronta)
      if (eventType === 'participants_list' && existingParticipants && existingParticipants.length > 0) {
        console.log(`[VideoCall] �  Lista de participantes recebida:`, existingParticipants);
        
        // Criar ofertas para todos os participantes existentes
        const createOffersForExisting = async () => {
          console.log(`[VideoCall] 🚀 Criando ofertas para ${existingParticipants.length} participantes existentes`);
          
          for (const participantId of existingParticipants) {
            if (participantId !== userId && !peerConnections.current.has(participantId)) {
              console.log(`[VideoCall] 🤝 Criando oferta para: ${participantId}`);
              try {
                await createOffer(participantId);
                console.log(`[VideoCall] ✅ Oferta criada para: ${participantId}`);
              } catch (error) {
                console.error(`[VideoCall] ❌ Erro ao criar oferta para ${participantId}:`, error);
              }
              // Pequeno delay entre ofertas
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        };
        
        // A câmera já deve estar pronta pois solicitamos após inicialização
        if (localStreamRef.current) {
          await createOffersForExisting();
        } else {
          console.log(`[VideoCall] ⏳ Aguardando stream local...`);
          let attempts = 0;
          const checkStream = setInterval(async () => {
            attempts++;
            if (localStreamRef.current) {
              clearInterval(checkStream);
              await createOffersForExisting();
            } else if (attempts >= 20) {
              clearInterval(checkStream);
              console.error(`[VideoCall] ❌ Timeout aguardando stream local`);
            }
          }, 500);
        }
      }
      // ✅ NOVO: Quando EU entro e há participantes existentes, criar ofertas para todos
      else if (eventType === 'user_joined' && eventUserId === userId && existingParticipants && existingParticipants.length > 0) {
        console.log(`[VideoCall] 👥 EU entrei! Participantes existentes:`, existingParticipants);
        
        // Aguardar stream local estar disponível com retry
        const createOffersForExisting = async () => {
          console.log(`[VideoCall] �a Iniciando criação de ofertas para participantes existentes`);
          
          for (const participantId of existingParticipants) {
            if (participantId !== userId) {
              console.log(`[VideoCall] 🤝 Criando oferta para participante existente: ${participantId}`);
              try {
                await createOffer(participantId);
                console.log(`[VideoCall] ✅ Oferta criada com sucesso para: ${participantId}`);
              } catch (error) {
                console.error(`[VideoCall] ❌ Erro ao criar oferta para ${participantId}:`, error);
              }
              // Pequeno delay entre ofertas para evitar race conditions
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        };
        
        // Tentar criar ofertas imediatamente ou aguardar stream local
        if (localStreamRef.current) {
          console.log(`[VideoCall] ✅ Stream local já disponível, criando ofertas...`);
          await createOffersForExisting();
        } else {
          console.log(`[VideoCall] ⏳ Aguardando stream local para criar ofertas...`);
          let attempts = 0;
          const maxAttempts = 20; // 10 segundos
          
          const checkStream = setInterval(async () => {
            attempts++;
            if (localStreamRef.current) {
              clearInterval(checkStream);
              console.log(`[VideoCall] ✅ Stream local disponível após ${attempts * 500}ms`);
              await createOffersForExisting();
            } else if (attempts >= maxAttempts) {
              clearInterval(checkStream);
              console.error(`[VideoCall] ❌ Timeout aguardando stream local`);
            }
          }, 500);
        }
      } 
      // Manter compatibilidade com evento legado existing_participants
      else if (eventType === 'existing_participants' && roomParticipants) {
        console.log(`[VideoCall] � Parti cipantes existentes (legado):`, roomParticipants);
        
        const createOffersForExisting = async () => {
          for (const participantId of roomParticipants) {
            if (participantId !== userId) {
              try {
                await createOffer(participantId);
              } catch (error) {
                console.error(`[VideoCall] ❌ Erro ao criar oferta para ${participantId}:`, error);
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        };
        
        if (localStreamRef.current) {
          await createOffersForExisting();
        } else {
          let attempts = 0;
          const checkStream = setInterval(async () => {
            attempts++;
            if (localStreamRef.current) {
              clearInterval(checkStream);
              await createOffersForExisting();
            } else if (attempts >= 20) {
              clearInterval(checkStream);
            }
          }, 500);
        }
      }
      // Quando OUTRO usuário entra
      else if (eventType === 'user_joined' && eventUserId !== userId) {
        console.log(`[VideoCall] 🆕 Novo usuário entrou via room_event: ${eventUserId}`);
        
        // ✅ IMPORTANTE: O usuário que já está na sala deve criar uma oferta para o novo usuário
        if (localStreamRef.current) {
          console.log(`[VideoCall] 🤝 Criando oferta para novo usuário: ${eventUserId}`);
          // Pequeno delay para garantir que o novo usuário já processou seu evento
          setTimeout(async () => {
            // Verificar se já não temos uma conexão com esse usuário
            if (!peerConnections.current.has(eventUserId)) {
              console.log(`[VideoCall] 📤 Enviando oferta para novo usuário: ${eventUserId}`);
              await createOffer(eventUserId);
            } else {
              console.log(`[VideoCall] ⏭️ Já existe conexão com ${eventUserId}, não criando nova oferta`);
            }
          }, 500);
        }
      } else if (eventType === 'user_left' && eventUserId !== userId) {
        console.log(`[VideoCall] Usuário saiu: ${eventUserId}, fechando conexão WebRTC`);
        // Fechar conexão WebRTC com o usuário que saiu
        const pc = peerConnections.current.get(eventUserId);
        if (pc) {
          pc.close();
          peerConnections.current.delete(eventUserId);
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(eventUserId);
            return newMap;
          });
          analyserNodes.current.delete(eventUserId);
        }
      }
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

        // ✅ IMPORTANTE: Anunciar que o usuário entrou na sala com vídeo
        // Este sinal vai para o message-handler e será broadcast para todos na sala
        // Os usuários existentes vão criar ofertas WebRTC para este novo usuário
        console.log('[VideoCall] 📢 Anunciando entrada na sala com vídeo...');
        sendMessage({
          action: 'webrtc-signal',
          type: 'user-joined',
          roomId,
          userId,
          signal: {
            type: 'user-joined'
          }
        });

        // ✅ NOVO: Solicitar lista de participantes existentes APÓS câmera estar pronta
        // Isso garante que quando recebermos a resposta, já teremos o stream local
        console.log('[VideoCall] 📋 Solicitando lista de participantes existentes...');
        sendMessage({
          action: 'webrtc-signal',
          type: 'request-participants',
          roomId,
          userId,
          signal: {
            type: 'request-participants'
          }
        });

        console.log('[VideoCall] ✅ Usuário anunciado na sala para WebRTC');
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