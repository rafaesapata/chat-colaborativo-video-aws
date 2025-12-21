/**
 * Grid de vídeos usando Amazon Chime SDK
 */

import { useEffect, useRef, memo } from 'react';
import { MicOff, Video, VideoOff, User, Volume2 } from 'lucide-react';

interface VideoTile {
  odTileId: number;
  odAttendeeId: string;
  odExternalUserId: string;
  isLocal: boolean;
  isContent: boolean;
}

interface ChimeVideoGridProps {
  videoTiles: VideoTile[];
  activeSpeakers: string[];
  localUserId: string;
  isLocalVideoEnabled: boolean;
  isLocalAudioEnabled: boolean;
  bindVideoElement: (tileId: number, element: HTMLVideoElement | null) => void;
  bindAudioElement: (element: HTMLAudioElement | null) => void;
  darkMode: boolean;
}

// Componente individual de vídeo
const VideoTileComponent = memo(({ 
  tile, 
  isActiveSpeaker,
  isLocal,
  userName,
  isVideoEnabled,
  isAudioEnabled,
  bindVideoElement,
  darkMode,
  gridSize
}: {
  tile: VideoTile;
  isActiveSpeaker: boolean;
  isLocal: boolean;
  userName: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  bindVideoElement: (tileId: number, element: HTMLVideoElement | null) => void;
  darkMode: boolean;
  gridSize: number;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      bindVideoElement(tile.odTileId, videoRef.current);
    }
    return () => {
      bindVideoElement(tile.odTileId, null);
    };
  }, [tile.odTileId, bindVideoElement]);

  // Calcular tamanho baseado no grid
  const getGridClass = () => {
    if (gridSize === 1) return 'col-span-1 row-span-1';
    if (gridSize === 2) return 'col-span-1 row-span-1';
    if (gridSize <= 4) return 'col-span-1 row-span-1';
    return 'col-span-1 row-span-1';
  };

  return (
    <div 
      className={`relative rounded-2xl overflow-hidden ${getGridClass()} ${
        isActiveSpeaker 
          ? 'ring-4 ring-green-500 ring-opacity-75' 
          : ''
      } ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}
      style={{ minHeight: '200px' }}
    >
      {/* Vídeo */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${
          isLocal ? 'transform scale-x-[-1]' : ''
        }`}
        style={{ 
          display: isVideoEnabled || !isLocal ? 'block' : 'none',
          backgroundColor: darkMode ? '#1f2937' : '#e5e7eb'
        }}
      />

      {/* Placeholder quando vídeo está desligado */}
      {!isVideoEnabled && isLocal && (
        <div className={`absolute inset-0 flex items-center justify-center ${
          darkMode ? 'bg-gray-800' : 'bg-gray-300'
        }`}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
            darkMode ? 'bg-gray-700' : 'bg-gray-400'
          }`}>
            <User size={48} className={darkMode ? 'text-gray-500' : 'text-gray-600'} />
          </div>
        </div>
      )}

      {/* Indicador de quem está falando */}
      {isActiveSpeaker && (
        <div className="absolute top-3 right-3 bg-green-500 rounded-full p-1.5 animate-pulse">
          <Volume2 size={16} className="text-white" />
        </div>
      )}

      {/* Nome e status */}
      <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t ${
        darkMode ? 'from-black/80 to-transparent' : 'from-black/60 to-transparent'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium truncate">
            {isLocal ? 'Você' : userName}
            {tile.isContent && ' (Tela)'}
          </span>
          <div className="flex items-center gap-1.5">
            {!isAudioEnabled && isLocal && (
              <div className="bg-red-500 rounded-full p-1">
                <MicOff size={12} className="text-white" />
              </div>
            )}
            {!isVideoEnabled && isLocal && (
              <div className="bg-red-500 rounded-full p-1">
                <VideoOff size={12} className="text-white" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

VideoTileComponent.displayName = 'VideoTileComponent';

// Sanitizar nome para evitar XSS
const sanitizeName = (name: string): string => {
  if (!name) return 'Participante';
  return name.replace(/[<>"'&]/g, '').substring(0, 50) || 'Participante';
};

export default function ChimeVideoGrid({
  videoTiles,
  activeSpeakers,
  localUserId,
  isLocalVideoEnabled,
  isLocalAudioEnabled,
  bindVideoElement,
  bindAudioElement,
  darkMode
}: ChimeVideoGridProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Bind audio element
  useEffect(() => {
    if (audioRef.current) {
      bindAudioElement(audioRef.current);
    }
  }, [bindAudioElement]);

  // Separar tiles locais e remotos
  const localTiles = videoTiles.filter(t => t.isLocal && !t.isContent);
  const remoteTiles = videoTiles.filter(t => !t.isLocal && !t.isContent);
  const contentTiles = videoTiles.filter(t => t.isContent);

  // Todos os tiles para exibir
  const allTiles = [...contentTiles, ...remoteTiles, ...localTiles];
  const gridSize = allTiles.length;

  // Calcular grid layout
  const getGridCols = () => {
    if (gridSize === 1) return 'grid-cols-1';
    if (gridSize === 2) return 'grid-cols-2';
    if (gridSize <= 4) return 'grid-cols-2';
    if (gridSize <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  const getGridRows = () => {
    if (gridSize === 1) return 'grid-rows-1';
    if (gridSize === 2) return 'grid-rows-1';
    if (gridSize <= 4) return 'grid-rows-2';
    if (gridSize <= 6) return 'grid-rows-2';
    return 'grid-rows-2';
  };

  // Se não há tiles, mostrar placeholder
  if (allTiles.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center ${
        darkMode ? 'bg-gray-900' : 'bg-gray-100'
      }`}>
        <div className="text-center">
          <div className={`w-32 h-32 mx-auto mb-4 rounded-full flex items-center justify-center ${
            darkMode ? 'bg-gray-800' : 'bg-gray-200'
          }`}>
            <Video size={48} className={darkMode ? 'text-gray-600' : 'text-gray-400'} />
          </div>
          <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Conectando à reunião...
          </p>
        </div>
        {/* Audio element oculto */}
        <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
      </div>
    );
  }

  return (
    <div className={`h-full p-2 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Audio element oculto para receber áudio remoto */}
      <audio ref={audioRef} autoPlay style={{ display: 'none' }} />

      {/* Grid de vídeos */}
      <div className={`grid ${getGridCols()} ${getGridRows()} gap-2 h-full`}>
        {allTiles.map((tile) => {
          // Verificar se é local: pode ser pelo flag isLocal ou pelo userId no ExternalUserId
          const externalUserIdPart = tile.odExternalUserId?.split('|')[0] || '';
          const isLocal = tile.isLocal || externalUserIdPart === localUserId;
          const isActiveSpeaker = activeSpeakers.includes(tile.odAttendeeId);
          
          // Extrair nome do ExternalUserId (formato: odUserId|userName)
          let userName = 'Participante';
          if (tile.odExternalUserId) {
            const parts = tile.odExternalUserId.split('|');
            if (parts.length > 1) {
              userName = sanitizeName(parts[1]); // Nome está após o pipe
            } else {
              // Fallback para formato antigo
              userName = sanitizeName(tile.odExternalUserId.split('_').pop() || 'Participante');
            }
          }

          return (
            <VideoTileComponent
              key={tile.odTileId}
              tile={tile}
              isActiveSpeaker={isActiveSpeaker}
              isLocal={isLocal}
              userName={userName}
              isVideoEnabled={isLocal ? isLocalVideoEnabled : true}
              isAudioEnabled={isLocal ? isLocalAudioEnabled : true}
              bindVideoElement={bindVideoElement}
              darkMode={darkMode}
              gridSize={gridSize}
            />
          );
        })}
      </div>
    </div>
  );
}
