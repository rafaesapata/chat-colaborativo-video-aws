/**
 * Hook para Amazon Chime SDK
 * Substitui o WebRTC P2P por infraestrutura gerenciada da AWS
 * 
 * v3.5.0 - Integração com utilitários de estabilidade
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
  AudioVideoFacade,
  MeetingSessionStatus,
  MeetingSessionStatusCode,
  VideoTileState,
  DefaultActiveSpeakerPolicy,
  AudioVideoObserver,
} from 'amazon-chime-sdk-js';

// Utilitários de estabilidade
import { chimeCircuitBreaker, CircuitOpenError } from '../utils/circuitBreaker';
import { requestCoalescer } from '../utils/requestCoalescer';
import { createReconnectionStrategy, ReconnectionStrategy } from '../utils/reconnectionStrategy';
import { tracing } from '../utils/tracing';

const CHIME_API_URL = import.meta.env.VITE_CHIME_API_URL || import.meta.env.VITE_API_URL || '';
const FETCH_TIMEOUT = 15000; // 15 segundos

// Helper para fetch com timeout e tracing
async function fetchWithTimeout(url: string, options: RequestInit, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    // Adicionar headers de tracing
    const headers = {
      ...options.headers,
      ...tracing.getTraceHeaders(),
    };
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface UseChimeMeetingProps {
  roomId: string;
  odUserId: string;
  userName?: string;
  isAuthenticated?: boolean;
}

interface ChimeAttendee {
  odAttendeeId: string;
  odExternalUserId: string;
  name?: string;
}

interface VideoTile {
  odTileId: number;
  odAttendeeId: string;
  odExternalUserId: string;
  isLocal: boolean;
  isContent: boolean;
}

export function useChimeMeeting({ roomId, odUserId, userName = 'Usuário', isAuthenticated = false }: UseChimeMeetingProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<ChimeAttendee[]>([]);
  const [videoTiles, setVideoTiles] = useState<VideoTile[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'unknown'>('unknown');
  const [isSpeakerMode, setIsSpeakerMode] = useState(true); // Alto-falante por padrão no mobile
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);

  const meetingSessionRef = useRef<DefaultMeetingSession | null>(null);
  const audioVideoRef = useRef<AudioVideoFacade | null>(null);
  const deviceControllerRef = useRef<DefaultDeviceController | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const odAttendeeIdRef = useRef<string | null>(null);
  const videoElementsRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  
  // Refs para utilitários de estabilidade
  const observerRef = useRef<AudioVideoObserver | null>(null);
  const reconnectionStrategyRef = useRef<ReconnectionStrategy | null>(null);
  const isCleaningUpRef = useRef(false);
  const localAudioStreamRef = useRef<MediaStream | null>(null); // Ref para cleanup síncrono

  // Criar sessão do Chime
  const joinMeeting = useCallback(async () => {
    if (isJoining || isJoined || isCleaningUpRef.current) return;
    
    // Usar request coalescing para evitar chamadas duplicadas
    const coalesceKey = `join-meeting-${roomId}-${odUserId}`;
    if (requestCoalescer.isInflight(coalesceKey)) {
      console.log('[Chime] Request já em andamento, ignorando duplicata');
      return;
    }

    setIsJoining(true);
    setError(null);

    // Iniciar trace
    const trace = tracing.startTrace('joinMeeting');

    try {
      console.log('[Chime] Entrando na reunião:', roomId);

      // 1. Obter credenciais do backend (com Circuit Breaker e Request Coalescing)
      const response = await requestCoalescer.coalesce(coalesceKey, async () => {
        return chimeCircuitBreaker.execute(async () => {
          return fetchWithTimeout(`${CHIME_API_URL}/meeting/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, odUserId, userName, isAuthenticated }),
          });
        });
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao criar/entrar na reunião');
      }

      const { meeting, attendee, otherAttendees } = await response.json();
      
      meetingIdRef.current = meeting.MeetingId;
      odAttendeeIdRef.current = attendee.AttendeeId;

      console.log('[Chime] Meeting:', meeting.MeetingId);
      console.log('[Chime] Attendee:', attendee.AttendeeId);

      // 2. Configurar logger
      const logger = new ConsoleLogger('ChimeMeeting', LogLevel.WARN);

      // 3. Criar device controller
      const deviceController = new DefaultDeviceController(logger);
      deviceControllerRef.current = deviceController;

      // 4. Criar configuração da sessão
      const configuration = new MeetingSessionConfiguration(meeting, attendee);

      // 5. Criar sessão
      const meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);
      meetingSessionRef.current = meetingSession;
      audioVideoRef.current = meetingSession.audioVideo;

      // 6. Configurar observers
      setupObservers(meetingSession);

      // 7. Selecionar dispositivos
      await selectDevices(meetingSession);

      // 8. Iniciar sessão
      meetingSession.audioVideo.start();

      // 9. Iniciar vídeo local
      meetingSession.audioVideo.startLocalVideoTile();

      setIsJoined(true);
      setIsJoining(false);

      // Adicionar outros participantes já na sala
      if (otherAttendees && otherAttendees.length > 0) {
        setAttendees(otherAttendees.map((a: any) => ({
          odAttendeeId: a.odAttendeeId,
          odExternalUserId: a.odExternalUserId,
          name: a.odExternalUserId
        })));
      }

      // Finalizar trace com sucesso
      tracing.endSpan(trace.spanId, 'ok', { meetingId: meeting.MeetingId });
      console.log('[Chime] ✅ Conectado com sucesso!');
    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      console.error('[Chime] Erro ao entrar:', error);
      
      // Finalizar trace com erro
      tracing.endSpan(trace.spanId, 'error', { error: error.message });
      
      // Tratamento especial para Circuit Breaker aberto
      if (error instanceof CircuitOpenError) {
        setError('Serviço temporariamente indisponível. Tente novamente em alguns segundos.');
      } else {
        setError(error.message || 'Erro ao entrar na reunião');
      }
      setIsJoining(false);
    }
  }, [roomId, odUserId, userName, isAuthenticated, isJoining, isJoined]);

  // Configurar observers do Chime (com referência para cleanup)
  const setupObservers = useCallback((session: DefaultMeetingSession) => {
    const audioVideo = session.audioVideo;

    // Remover observer anterior se existir
    if (observerRef.current) {
      audioVideo.removeObserver(observerRef.current);
    }

    // Criar observer nomeado para poder remover depois
    const observer: AudioVideoObserver = {
      audioVideoDidStart: () => {
        console.log('[Chime] Sessão de áudio/vídeo iniciada');
        setIsReconnecting(false);
        setReconnectAttempt(0);
      },
      audioVideoDidStop: (sessionStatus: MeetingSessionStatus) => {
        const code = sessionStatus.statusCode();
        console.log('[Chime] Sessão parou:', code);
        
        if (code === MeetingSessionStatusCode.MeetingEnded) {
          setIsJoined(false);
          setError('A reunião foi encerrada');
        } else if (code === MeetingSessionStatusCode.AudioDisconnectAudio ||
                   code === MeetingSessionStatusCode.ConnectionHealthReconnect) {
          // Tentar reconectar automaticamente
          console.log('[Chime] Tentando reconectar...');
          reconnectionStrategyRef.current?.trigger(`status_code_${code}`);
        }
      },
      audioVideoDidStartConnecting: (reconnecting: boolean) => {
        console.log('[Chime] Conectando...', reconnecting ? '(reconectando)' : '');
        if (reconnecting) {
          setIsReconnecting(true);
        }
      },
      connectionDidBecomePoor: () => {
        console.warn('[Chime] Conexão ficou ruim');
        setConnectionQuality('poor');
      },
      connectionDidSuggestStopVideo: () => {
        console.warn('[Chime] Sugestão para parar vídeo');
        setConnectionQuality('fair');
      },
      connectionDidBecomeGood: () => {
        console.log('[Chime] Conexão boa');
        setConnectionQuality('good');
      },
      videoTileDidUpdate: (tileState: VideoTileState) => {
        console.log('[Chime] Video tile atualizado:', tileState.tileId, tileState.localTile);
        
        if (!tileState.tileId) return;

        setVideoTiles(prev => {
          const existing = prev.find(t => t.odTileId === tileState.tileId);
          const newTile: VideoTile = {
            odTileId: tileState.tileId!,
            odAttendeeId: tileState.boundAttendeeId || '',
            odExternalUserId: tileState.boundExternalUserId || '',
            isLocal: tileState.localTile || false,
            isContent: tileState.isContent || false,
          };

          if (existing) {
            return prev.map(t => t.odTileId === tileState.tileId ? newTile : t);
          }
          return [...prev, newTile];
        });

        // Bind video element se existir
        const videoElement = videoElementsRef.current.get(tileState.tileId!);
        if (videoElement && tileState.tileId) {
          audioVideo.bindVideoElement(tileState.tileId, videoElement);
        }
      },
      videoTileWasRemoved: (tileId: number) => {
        console.log('[Chime] Video tile removido:', tileId);
        setVideoTiles(prev => prev.filter(t => t.odTileId !== tileId));
        videoElementsRef.current.delete(tileId);
      },
    };

    // Registrar observer
    observerRef.current = observer;
    audioVideo.addObserver(observer);

    // Observer de participantes
    audioVideo.realtimeSubscribeToAttendeeIdPresence((attendeeId: string, present: boolean, externalUserId?: string) => {
      console.log('[Chime] Participante:', attendeeId, present ? 'entrou' : 'saiu', externalUserId);
      
      if (present) {
        setAttendees(prev => {
          if (prev.some(a => a.odAttendeeId === attendeeId)) return prev;
          return [...prev, {
            odAttendeeId: attendeeId,
            odExternalUserId: externalUserId || attendeeId,
            name: externalUserId || attendeeId
          }];
        });
      } else {
        setAttendees(prev => prev.filter(a => a.odAttendeeId !== attendeeId));
      }
    });

    // Observer de quem está falando
    audioVideo.subscribeToActiveSpeakerDetector(
      new DefaultActiveSpeakerPolicy(),
      (attendeeIds: string[]) => {
        setActiveSpeakers(attendeeIds);
      }
    );
  }, []);

  // Selecionar dispositivos de áudio/vídeo
  const selectDevices = useCallback(async (session: DefaultMeetingSession) => {
    const audioVideo = session.audioVideo;

    try {
      // Obter dispositivos salvos
      const savedVideoDevice = sessionStorage.getItem('videochat_video_device');
      const savedAudioDevice = sessionStorage.getItem('videochat_audio_device');
      const savedVideoEnabled = sessionStorage.getItem('videochat_video_enabled');
      const savedAudioEnabled = sessionStorage.getItem('videochat_audio_enabled');

      // Listar dispositivos disponíveis
      const audioInputDevices = await audioVideo.listAudioInputDevices();
      const videoInputDevices = await audioVideo.listVideoInputDevices();
      const audioOutputDevices = await audioVideo.listAudioOutputDevices();

      console.log('[Chime] Dispositivos de áudio:', audioInputDevices.length);
      console.log('[Chime] Dispositivos de vídeo:', videoInputDevices.length);

      // Selecionar microfone
      if (audioInputDevices.length > 0) {
        const audioDevice = savedAudioDevice 
          ? audioInputDevices.find(d => d.deviceId === savedAudioDevice) || audioInputDevices[0]
          : audioInputDevices[0];
        await audioVideo.startAudioInput(audioDevice.deviceId);
        
        // Criar stream de áudio local para transcrição
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: audioDevice.deviceId }
          });
          localAudioStreamRef.current = audioStream; // Guardar na ref para cleanup
          setLocalAudioStream(audioStream);
          console.log('[Chime] Stream de áudio local criado para transcrição');
        } catch (e) {
          console.warn('[Chime] Não foi possível criar stream para transcrição:', e);
        }
      }

      // Selecionar câmera
      if (videoInputDevices.length > 0) {
        const videoDevice = savedVideoDevice
          ? videoInputDevices.find(d => d.deviceId === savedVideoDevice) || videoInputDevices[0]
          : videoInputDevices[0];
        await audioVideo.startVideoInput(videoDevice.deviceId);
      }

      // Selecionar saída de áudio
      if (audioOutputDevices.length > 0) {
        setAudioOutputDevices(audioOutputDevices);
        await audioVideo.chooseAudioOutput(audioOutputDevices[0].deviceId);
      }

      // Aplicar configurações salvas
      if (savedVideoEnabled === 'false') {
        audioVideo.stopLocalVideoTile();
        setIsVideoEnabled(false);
      }
      if (savedAudioEnabled === 'false') {
        audioVideo.realtimeMuteLocalAudio();
        setIsAudioEnabled(false);
      }
    } catch (err) {
      console.error('[Chime] Erro ao selecionar dispositivos:', err);
    }
  }, []);

  // Sair da reunião
  const leaveMeeting = useCallback(async () => {
    console.log('[Chime] Saindo da reunião...');

    if (audioVideoRef.current) {
      audioVideoRef.current.stop();
    }

    if (deviceControllerRef.current) {
      await deviceControllerRef.current.destroy();
    }

    // Notificar backend (best effort, não bloqueia)
    if (meetingIdRef.current && odAttendeeIdRef.current) {
      fetchWithTimeout(`${CHIME_API_URL}/meeting/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: meetingIdRef.current,
          odAttendeeId: odAttendeeIdRef.current
        }),
      }, 5000).catch(e => console.warn('[Chime] Erro ao notificar saída:', e));
    }

    meetingSessionRef.current = null;
    audioVideoRef.current = null;
    deviceControllerRef.current = null;
    meetingIdRef.current = null;
    odAttendeeIdRef.current = null;
    videoElementsRef.current.clear();

    // Limpar stream de áudio local - usar ref para garantir cleanup síncrono
    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach(t => t.stop());
      localAudioStreamRef.current = null;
    }
    setLocalAudioStream(null);

    setIsJoined(false);
    setAttendees([]);
    setVideoTiles([]);
    setActiveSpeakers([]);
  }, []);

  // Toggle vídeo - usando setState callback para evitar stale closure
  const toggleVideo = useCallback(() => {
    if (!audioVideoRef.current) return;

    setIsVideoEnabled(prev => {
      if (prev) {
        audioVideoRef.current?.stopLocalVideoTile();
      } else {
        audioVideoRef.current?.startLocalVideoTile();
      }
      return !prev;
    });
  }, []);

  // Toggle áudio - usando setState callback para evitar stale closure
  const toggleAudio = useCallback(() => {
    if (!audioVideoRef.current) return;

    setIsAudioEnabled(prev => {
      if (prev) {
        audioVideoRef.current?.realtimeMuteLocalAudio();
      } else {
        audioVideoRef.current?.realtimeUnmuteLocalAudio();
      }
      return !prev;
    });
  }, []);

  // Compartilhar tela
  const startScreenShare = useCallback(async () => {
    if (!audioVideoRef.current) return false;

    try {
      await audioVideoRef.current.startContentShareFromScreenCapture();
      setIsScreenSharing(true);
      return true;
    } catch (err) {
      console.error('[Chime] Erro ao compartilhar tela:', err);
      return false;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (!audioVideoRef.current) return;
    audioVideoRef.current.stopContentShare();
    setIsScreenSharing(false);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  // Toggle alto-falante (para mobile)
  const toggleSpeakerMode = useCallback(async () => {
    if (!audioVideoRef.current || audioOutputDevices.length < 2) {
      // Se não há dispositivos alternativos, tentar via setSinkId no elemento de áudio
      setIsSpeakerMode(prev => !prev);
      return;
    }

    try {
      // Alternar entre dispositivos de saída
      // Geralmente: índice 0 = fone/earpiece, índice 1 = alto-falante
      const newMode = !isSpeakerMode;
      const deviceIndex = newMode ? 0 : 1; // Alto-falante geralmente é o primeiro
      
      if (audioOutputDevices[deviceIndex]) {
        await audioVideoRef.current.chooseAudioOutput(audioOutputDevices[deviceIndex].deviceId);
      }
      
      setIsSpeakerMode(newMode);
      console.log('[Chime] Modo de áudio alterado:', newMode ? 'Alto-falante' : 'Fone');
    } catch (err) {
      console.error('[Chime] Erro ao alternar saída de áudio:', err);
      // Fallback: apenas alternar o estado para UI
      setIsSpeakerMode(prev => !prev);
    }
  }, [isSpeakerMode, audioOutputDevices]);

  // Bind video element para um tile
  const bindVideoElement = useCallback((tileId: number, element: HTMLVideoElement | null) => {
    if (!element) {
      videoElementsRef.current.delete(tileId);
      return;
    }

    videoElementsRef.current.set(tileId, element);
    
    if (audioVideoRef.current) {
      audioVideoRef.current.bindVideoElement(tileId, element);
    }
  }, []);

  // Bind elemento de áudio
  const bindAudioElement = useCallback((element: HTMLAudioElement | null) => {
    if (!element || !audioVideoRef.current) return;
    audioVideoRef.current.bindAudioElement(element);
  }, []);

  // Auto-join quando o hook é montado
  useEffect(() => {
    if (roomId && odUserId && !isJoined && !isJoining) {
      // Pequeno delay para garantir que o componente está montado
      const timer = setTimeout(() => {
        joinMeeting();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [roomId, odUserId, isJoined, isJoining, joinMeeting]);

  // Inicializar estratégia de reconexão
  useEffect(() => {
    reconnectionStrategyRef.current = createReconnectionStrategy(
      async () => {
        // Tentar reconectar
        try {
          await joinMeeting();
          return isJoined;
        } catch {
          return false;
        }
      },
      () => {
        // Máximo de tentativas atingido
        setError('Não foi possível reconectar. Recarregue a página.');
        setIsReconnecting(false);
      },
      (status, attempt) => {
        // Callback de status
        setIsReconnecting(status === 'reconnecting');
        setReconnectAttempt(attempt);
      }
    );

    return () => {
      reconnectionStrategyRef.current?.abort();
    };
  }, [joinMeeting, isJoined]);

  // Cleanup ao desmontar - síncrono para garantir limpeza
  useEffect(() => {
    return () => {
      isCleaningUpRef.current = true;
      
      // Abortar reconexão em andamento
      reconnectionStrategyRef.current?.abort();
      
      // Remover observer se existir
      if (observerRef.current && audioVideoRef.current) {
        try {
          audioVideoRef.current.removeObserver(observerRef.current);
        } catch (e) {
          console.warn('[Chime] Erro ao remover observer:', e);
        }
        observerRef.current = null;
      }
      
      // Cleanup síncrono imediato
      if (audioVideoRef.current) {
        try {
          audioVideoRef.current.stop();
        } catch (e) {
          console.warn('[Chime] Erro ao parar audioVideo:', e);
        }
      }
      
      // Limpar streams - usar ref para garantir cleanup síncrono
      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getTracks().forEach(t => t.stop());
        localAudioStreamRef.current = null;
      }
      setLocalAudioStream(null);
      
      // Cleanup async em background (best effort)
      deviceControllerRef.current?.destroy().catch(console.warn);
      
      // Limpar refs
      meetingSessionRef.current = null;
      audioVideoRef.current = null;
      deviceControllerRef.current = null;
      videoElementsRef.current.clear();
    };
  }, []);

  return {
    // Estado
    isJoined,
    isJoining,
    isReconnecting,
    reconnectAttempt,
    error,
    attendees,
    videoTiles,
    activeSpeakers,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    connectionQuality,
    localAudioStream, // Stream para transcrição
    isSpeakerMode, // Modo alto-falante (mobile)
    
    // Ações
    joinMeeting,
    leaveMeeting,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    toggleSpeakerMode, // Toggle alto-falante (mobile)
    bindVideoElement,
    bindAudioElement,
    
    // Refs para componentes
    meetingSession: meetingSessionRef.current,
    audioVideo: audioVideoRef.current,
  };
}
