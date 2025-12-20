/**
 * Hook para Amazon Chime SDK
 * Substitui o WebRTC P2P por infraestrutura gerenciada da AWS
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
} from 'amazon-chime-sdk-js';

const CHIME_API_URL = import.meta.env.VITE_CHIME_API_URL || import.meta.env.VITE_API_URL || '';

interface UseChimeMeetingProps {
  roomId: string;
  odUserId: string;
  userName?: string;
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

export function useChimeMeeting({ roomId, odUserId, userName = 'Usuário' }: UseChimeMeetingProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<ChimeAttendee[]>([]);
  const [videoTiles, setVideoTiles] = useState<VideoTile[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'unknown'>('unknown');

  const meetingSessionRef = useRef<DefaultMeetingSession | null>(null);
  const audioVideoRef = useRef<AudioVideoFacade | null>(null);
  const deviceControllerRef = useRef<DefaultDeviceController | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const odAttendeeIdRef = useRef<string | null>(null);
  const videoElementsRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);

  // Criar sessão do Chime
  const joinMeeting = useCallback(async () => {
    if (isJoining || isJoined) return;
    
    setIsJoining(true);
    setError(null);

    try {
      console.log('[Chime] Entrando na reunião:', roomId);

      // 1. Obter credenciais do backend
      const response = await fetch(`${CHIME_API_URL}/meeting/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, odUserId, userName }),
      });

      if (!response.ok) {
        throw new Error('Falha ao criar/entrar na reunião');
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

      console.log('[Chime] ✅ Conectado com sucesso!');
    } catch (err: any) {
      console.error('[Chime] Erro ao entrar:', err);
      setError(err.message || 'Erro ao entrar na reunião');
      setIsJoining(false);
    }
  }, [roomId, odUserId, userName, isJoining, isJoined]);

  // Configurar observers do Chime
  const setupObservers = useCallback((session: DefaultMeetingSession) => {
    const audioVideo = session.audioVideo;

    // Observer de status da sessão
    audioVideo.addObserver({
      audioVideoDidStart: () => {
        console.log('[Chime] Sessão de áudio/vídeo iniciada');
      },
      audioVideoDidStop: (sessionStatus: MeetingSessionStatus) => {
        console.log('[Chime] Sessão parou:', sessionStatus.statusCode());
        if (sessionStatus.statusCode() === MeetingSessionStatusCode.MeetingEnded) {
          setIsJoined(false);
          setError('A reunião foi encerrada');
        }
      },
      audioVideoDidStartConnecting: (reconnecting: boolean) => {
        console.log('[Chime] Conectando...', reconnecting ? '(reconectando)' : '');
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
    });

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

    // Notificar backend
    if (meetingIdRef.current && odAttendeeIdRef.current) {
      try {
        await fetch(`${CHIME_API_URL}/meeting/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingId: meetingIdRef.current,
            odAttendeeId: odAttendeeIdRef.current
          }),
        });
      } catch (e) {
        console.warn('[Chime] Erro ao notificar saída:', e);
      }
    }

    meetingSessionRef.current = null;
    audioVideoRef.current = null;
    deviceControllerRef.current = null;
    meetingIdRef.current = null;
    odAttendeeIdRef.current = null;
    videoElementsRef.current.clear();

    // Limpar stream de áudio local
    if (localAudioStream) {
      localAudioStream.getTracks().forEach(t => t.stop());
      setLocalAudioStream(null);
    }

    setIsJoined(false);
    setAttendees([]);
    setVideoTiles([]);
    setActiveSpeakers([]);
  }, []);

  // Toggle vídeo
  const toggleVideo = useCallback(() => {
    if (!audioVideoRef.current) return;

    if (isVideoEnabled) {
      audioVideoRef.current.stopLocalVideoTile();
      setIsVideoEnabled(false);
    } else {
      audioVideoRef.current.startLocalVideoTile();
      setIsVideoEnabled(true);
    }
  }, [isVideoEnabled]);

  // Toggle áudio
  const toggleAudio = useCallback(() => {
    if (!audioVideoRef.current) return;

    if (isAudioEnabled) {
      audioVideoRef.current.realtimeMuteLocalAudio();
      setIsAudioEnabled(false);
    } else {
      audioVideoRef.current.realtimeUnmuteLocalAudio();
      setIsAudioEnabled(true);
    }
  }, [isAudioEnabled]);

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

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (isJoined) {
        leaveMeeting();
      }
    };
  }, [isJoined, leaveMeeting]);

  return {
    // Estado
    isJoined,
    isJoining,
    error,
    attendees,
    videoTiles,
    activeSpeakers,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    connectionQuality,
    localAudioStream, // Stream para transcrição
    
    // Ações
    joinMeeting,
    leaveMeeting,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    bindVideoElement,
    bindAudioElement,
    
    // Refs para componentes
    meetingSession: meetingSessionRef.current,
    audioVideo: audioVideoRef.current,
  };
}
