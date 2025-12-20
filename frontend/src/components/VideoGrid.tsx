import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { MicOff, Pin, PinOff } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  hasVideo: boolean;
  stream?: MediaStream;
  displayName?: string;
}

interface VideoCardProps {
  participant: Participant;
  isLocal: boolean;
  stream: MediaStream | null | undefined;
  darkMode: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isSpanning: boolean;
  isMobile: boolean;
  isSpeaking: boolean;
  isSpotlight: boolean;
  onToggleSpotlight: () => void;
  onTogglePiP: () => void;
  isVideoEnabled: boolean;
}

// MOVER PARA FORA DO COMPONENTE E USAR memo
const VideoCard = memo(function VideoCard({
  participant,
  isLocal,
  stream,
  darkMode,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  isSpanning,
  isMobile,
  isSpeaking,
  isSpotlight,
  onToggleSpotlight,
  onTogglePiP,
  isVideoEnabled
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handlePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (e) {
        console.error('PiP error:', e);
      }
    }
    onTogglePiP();
  };

  const getParticipantInitials = (name: string) => {
    // Usar displayName se disponível (nome real), senão usar name
    const nameToUse = participant.displayName || name;
    return nameToUse.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Verificar se deve mostrar vídeo ou avatar
  const showVideo = stream && isVideoEnabled && participant.hasVideo;

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all duration-300 group ${
        darkMode ? 'bg-gray-800' : 'bg-gray-100'
      } ${isSpanning || isSpotlight ? 'row-span-2 col-span-2' : ''} ${
        isSpeaking ? 'speaking-indicator' : ''
      } ${isSpotlight ? 'z-10' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Borda animada quando está falando */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-xl pointer-events-none z-10">
          <div className="absolute inset-0 rounded-xl border-2 border-green-400 animate-speaking-pulse" />
        </div>
      )}

      {/* Botão de Pin no canto superior direito */}
      {!isMobile && stream && (
        <button
          onClick={onToggleSpotlight}
          className={`absolute top-2 right-2 z-20 p-1.5 rounded-lg transition-all ${
            isSpotlight 
              ? 'bg-blue-500 text-white opacity-100' 
              : 'bg-black/40 text-white/80 hover:bg-black/60 opacity-0 group-hover:opacity-100'
          } ${isHovered ? 'opacity-100' : ''}`}
          title={isSpotlight ? 'Remover destaque' : 'Destacar participante'}
        >
          {isSpotlight ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
      )}
      
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center ${
          darkMode ? 'bg-gray-700' : 'bg-gray-300'
        }`}>
          <div className={`${isMobile ? 'w-16 h-16 text-xl' : 'w-24 h-24 text-3xl'} rounded-full flex items-center justify-center font-bold ${
            darkMode ? 'bg-gray-600 text-white' : 'bg-gray-400 text-gray-700'
          } ${isSpeaking ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-700' : ''}`}>
            {getParticipantInitials(participant.name)}
          </div>
        </div>
      )}

      {participant.isMuted && (
        <div className={`absolute top-2 ${!isMobile && stream ? 'right-12' : 'right-2'} ${isMobile ? 'w-6 h-6' : 'w-8 h-8'} bg-red-500 rounded-full flex items-center justify-center`}>
          <MicOff size={isMobile ? 12 : 16} className="text-white" />
        </div>
      )}

      {/* Indicador de áudio ativo (pequenas barras) */}
      {isSpeaking && !participant.isMuted && (
        <div className={`absolute top-2 ${participant.isMuted ? 'right-12' : (!isMobile && stream ? 'right-24' : 'right-12')} flex items-end gap-0.5 h-4`}>
          <div className="w-1 bg-green-400 rounded-full animate-audio-bar-1" style={{ height: '40%' }} />
          <div className="w-1 bg-green-400 rounded-full animate-audio-bar-2" style={{ height: '70%' }} />
          <div className="w-1 bg-green-400 rounded-full animate-audio-bar-3" style={{ height: '50%' }} />
        </div>
      )}

      {/* Nome sempre visível no mobile, hover no desktop */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent ${isMobile ? 'p-2' : 'p-3'} transition-opacity duration-200 ${
          isMobile || isHovered || isSpeaking ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-white font-medium ${isMobile ? 'text-xs' : 'text-sm'} flex items-center gap-1.5`}>
            {participant.name}
            {isSpeaking && (
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </span>
        </div>
      </div>
    </div>
  );
});

interface VideoGridProps {
  participants: Participant[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  darkMode: boolean;
  speakingUsers?: Set<string>;
  localUserId?: string;
  isLocalVideoEnabled?: boolean;
  localUserName?: string;
}

export default function VideoGrid({ participants, localStream, remoteStreams, darkMode, speakingUsers = new Set(), localUserId, isLocalVideoEnabled = true, localUserName }: VideoGridProps) {
  const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null);
  const [spotlightParticipant, setSpotlightParticipant] = useState<string | null>(null);
  const [autoPiPVideoRef, setAutoPiPVideoRef] = useState<HTMLVideoElement | null>(null);
  const { isMobile, isTablet, isLandscape } = useMobile();

  const handleToggleSpotlight = useCallback((participantId: string) => {
    setSpotlightParticipant(prev => prev === participantId ? null : participantId);
  }, []);

  // PiP automático quando a janela perde foco
  useEffect(() => {
    // Verificar se PiP é suportado
    if (!document.pictureInPictureEnabled) {
      console.log('[VideoGrid] PiP não suportado neste navegador');
      return;
    }

    let isPiPActive = false;
    let wasManuallyClosedByUser = false;

    const findBestVideoForPiP = (): HTMLVideoElement | null => {
      const videoElements = document.querySelectorAll('video');
      const videos = Array.from(videoElements);
      
      // Primeiro, tentar encontrar um vídeo remoto com stream
      const remoteVideo = videos.find(v => 
        v.srcObject && 
        !v.muted && 
        (v.srcObject as MediaStream).getVideoTracks().some(t => t.enabled)
      );
      
      if (remoteVideo) return remoteVideo;
      
      // Se não houver remoto, usar o local
      const localVideo = videos.find(v => 
        v.srcObject && 
        (v.srcObject as MediaStream).getVideoTracks().some(t => t.enabled)
      );
      
      return localVideo || null;
    };

    const enterPiP = async () => {
      if (isPiPActive || document.pictureInPictureElement || wasManuallyClosedByUser) return;
      
      const video = findBestVideoForPiP();
      if (!video) {
        console.log('[VideoGrid] Nenhum vídeo disponível para PiP');
        return;
      }

      try {
        if (video.readyState < 2) {
          console.log('[VideoGrid] Vídeo não está pronto para PiP');
          return;
        }
        
        await video.requestPictureInPicture();
        isPiPActive = true;
        setAutoPiPVideoRef(video);
        console.log('[VideoGrid] PiP ativado automaticamente');
      } catch (e: any) {
        if (e.name !== 'NotAllowedError') {
          console.log('[VideoGrid] Erro ao ativar PiP:', e.message);
        }
      }
    };

    const exitPiP = async () => {
      if (!document.pictureInPictureElement) {
        isPiPActive = false;
        return;
      }

      try {
        await document.exitPictureInPicture();
        isPiPActive = false;
        setAutoPiPVideoRef(null);
        console.log('[VideoGrid] PiP desativado automaticamente');
      } catch (e: any) {
        console.log('[VideoGrid] Erro ao sair do PiP:', e.message);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTimeout(() => {
          if (document.hidden && !wasManuallyClosedByUser) {
            enterPiP();
          }
        }, 300);
      } else {
        // Quando volta para a página, resetar flag e sair do PiP
        wasManuallyClosedByUser = false;
        exitPiP();
      }
    };

    const handleWindowBlur = () => {
      setTimeout(() => {
        if (!document.hasFocus() && !wasManuallyClosedByUser) {
          enterPiP();
        }
      }, 500);
    };

    const handleWindowFocus = () => {
      // Quando a janela ganha foco, resetar flag e sair do PiP
      wasManuallyClosedByUser = false;
      exitPiP();
    };

    // Listener para quando o PiP é fechado manualmente pelo usuário
    const handlePiPClose = () => {
      console.log('[VideoGrid] PiP fechado pelo usuário');
      isPiPActive = false;
      setAutoPiPVideoRef(null);
      
      // Se a página ainda está oculta, significa que o usuário fechou manualmente
      if (document.hidden || !document.hasFocus()) {
        wasManuallyClosedByUser = true;
        console.log('[VideoGrid] PiP fechado manualmente enquanto página oculta');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('leavepictureinpicture', handlePiPClose);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('leavepictureinpicture', handlePiPClose);
      
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, []);

  // Log para debug
  useEffect(() => {
    console.log('[VideoGrid] Participantes:', participants.length);
    console.log('[VideoGrid] Local stream:', localStream ? 'disponível' : 'não disponível');
    console.log('[VideoGrid] Remote streams:', remoteStreams.size);
    remoteStreams.forEach((stream, odUserId) => {
      console.log(`[VideoGrid] Stream remoto de ${odUserId}:`, stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
    });
  }, [participants, localStream, remoteStreams]);

  const getGridLayout = (count: number) => {
    // Mobile portrait: layout vertical
    if (isMobile && !isLandscape) {
      if (count === 1) return 'grid-cols-1';
      if (count === 2) return 'grid-cols-1 grid-rows-2';
      return 'grid-cols-1';
    }
    
    // Mobile landscape ou tablet
    if (isMobile && isLandscape) {
      if (count === 1) return 'grid-cols-1';
      if (count === 2) return 'grid-cols-2';
      return 'grid-cols-2';
    }
    
    if (isTablet) {
      if (count === 1) return 'grid-cols-1';
      if (count === 2) return 'grid-cols-2';
      if (count <= 4) return 'grid-cols-2 grid-rows-2';
      return 'grid-cols-3';
    }
    
    // Desktop
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-4';
  };

  // No mobile portrait com muitos participantes, limitar altura
  const gridStyle = isMobile && !isLandscape && participants.length > 2 
    ? { maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' as const }
    : {};

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div 
        className={`grid ${isMobile ? 'gap-1' : 'gap-2'} w-full h-full ${getGridLayout(participants.length)}`}
        style={gridStyle}
      >
        {participants.map((participant, index) => {
          const isLocal = participant.name === 'Você';
          const stream = isLocal ? localStream : remoteStreams.get(participant.id);
          const isSpeaking = isLocal 
            ? speakingUsers.has(localUserId || participant.id) 
            : speakingUsers.has(participant.id);
          const isVideoEnabled = isLocal ? isLocalVideoEnabled : participant.hasVideo;
          
          // Usar nome real para iniciais (não "Você")
          const displayParticipant = isLocal && localUserName 
            ? { ...participant, name: participant.name, displayName: localUserName }
            : { ...participant, displayName: participant.name };
          
          console.log(`[VideoGrid] Renderizando ${participant.name} (${participant.id}):`, stream ? 'com stream' : 'SEM STREAM');
          
          return (
            <VideoCard
              key={participant.id}
              participant={displayParticipant}
              isLocal={isLocal}
              stream={stream}
              darkMode={darkMode}
              isHovered={hoveredParticipant === participant.id}
              onMouseEnter={() => setHoveredParticipant(participant.id)}
              onMouseLeave={() => setHoveredParticipant(null)}
              isSpanning={!isMobile && participants.length === 3 && index === 0}
              isMobile={isMobile || isTablet}
              isSpeaking={isSpeaking}
              isSpotlight={spotlightParticipant === participant.id}
              onToggleSpotlight={() => handleToggleSpotlight(participant.id)}
              onTogglePiP={() => {}}
              isVideoEnabled={isVideoEnabled}
            />
          );
        })}
      </div>
    </div>
  );
}