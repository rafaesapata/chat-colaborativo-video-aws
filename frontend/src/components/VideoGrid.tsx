import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { MicOff, Maximize2, PictureInPicture2, Pin, PinOff } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  hasVideo: boolean;
  stream?: MediaStream;
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
  onTogglePiP
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
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all duration-300 ${
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
      
      {participant.hasVideo && stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center ${
          darkMode ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          <div className={`${isMobile ? 'w-12 h-12 text-base' : 'w-16 h-16 text-xl'} rounded-full flex items-center justify-center font-semibold ${
            darkMode ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
          } ${isSpeaking ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-700' : ''}`}>
            {getParticipantInitials(participant.name)}
          </div>
        </div>
      )}

      {participant.isMuted && (
        <div className={`absolute top-2 right-2 ${isMobile ? 'w-6 h-6' : 'w-8 h-8'} bg-red-500 rounded-full flex items-center justify-center`}>
          <MicOff size={isMobile ? 12 : 16} className="text-white" />
        </div>
      )}

      {/* Indicador de áudio ativo (pequenas barras) */}
      {isSpeaking && !participant.isMuted && (
        <div className={`absolute top-2 ${participant.isMuted ? 'right-12' : 'right-2'} flex items-end gap-0.5 h-4`}>
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
          
          {/* Controles de vídeo */}
          {!isMobile && isHovered && stream && (
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleSpotlight}
                className={`p-1.5 rounded-lg transition-all ${
                  isSpotlight 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-black/30 text-white/80 hover:bg-black/50'
                }`}
                title={isSpotlight ? 'Remover destaque' : 'Destacar participante'}
              >
                {isSpotlight ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              {document.pictureInPictureEnabled && (
                <button
                  onClick={handlePiP}
                  className="p-1.5 rounded-lg bg-black/30 text-white/80 hover:bg-black/50 transition-all"
                  title="Picture-in-Picture"
                >
                  <PictureInPicture2 size={14} />
                </button>
              )}
            </div>
          )}
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
}

export default function VideoGrid({ participants, localStream, remoteStreams, darkMode, speakingUsers = new Set(), localUserId }: VideoGridProps) {
  const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null);
  const [spotlightParticipant, setSpotlightParticipant] = useState<string | null>(null);
  const { isMobile, isTablet, isLandscape } = useMobile();

  const handleToggleSpotlight = useCallback((participantId: string) => {
    setSpotlightParticipant(prev => prev === participantId ? null : participantId);
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
          
          console.log(`[VideoGrid] Renderizando ${participant.name} (${participant.id}):`, stream ? 'com stream' : 'SEM STREAM');
          
          return (
            <VideoCard
              key={participant.id}
              participant={participant}
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
            />
          );
        })}
      </div>
    </div>
  );
}