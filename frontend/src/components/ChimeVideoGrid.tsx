/**
 * Grid de vídeos usando Amazon Chime SDK
 * Suporta PIN (spotlight) de participante
 */

import { useEffect, useRef, useState, memo } from 'react';
import { MicOff, VideoOff, User, Volume2, Pin, PinOff } from 'lucide-react';

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
  isPinned,
  onTogglePin,
  isSpotlight,
}: {
  tile: VideoTile;
  isActiveSpeaker: boolean;
  isLocal: boolean;
  userName: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  bindVideoElement: (tileId: number, element: HTMLVideoElement | null) => void;
  darkMode: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  isSpotlight: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      bindVideoElement(tile.odTileId, videoRef.current);
    }
    return () => {
      bindVideoElement(tile.odTileId, null);
    };
  }, [tile.odTileId, bindVideoElement]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
        isActiveSpeaker ? 'ring-4 ring-green-500 ring-opacity-75' : ''
      } ${isPinned ? 'ring-2 ring-primary/60' : ''}`}
      style={{ minHeight: isSpotlight ? undefined : '160px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Video element - always present for remote tiles */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${isLocal ? 'transform scale-x-[-1]' : ''}`}
        style={{
          display: isVideoEnabled || !isLocal ? 'block' : 'none',
          backgroundColor: 'transparent',
        }}
      />

      {/* Placeholder quando vídeo está desligado - design system colors */}
      {!isVideoEnabled && isLocal && (
        <div className={`absolute inset-0 flex items-center justify-center ${
          darkMode
            ? 'bg-gradient-to-br from-surface-dark via-card-dark to-surface-dark'
            : 'bg-gradient-to-br from-black/5 via-black/8 to-black/5'
        }`}>
          <div className={`${isSpotlight ? 'w-28 h-28' : 'w-20 h-20'} rounded-full flex items-center justify-center ${
            darkMode ? 'bg-primary/10 border border-primary/20' : 'bg-primary/5 border border-primary/15'
          }`}>
            <User size={isSpotlight ? 56 : 40} className="text-primary/60" />
          </div>
        </div>
      )}

      {/* Placeholder para tiles remotos sem vídeo */}
      {!tile.isContent && !isLocal && (
        <div className={`absolute inset-0 flex items-center justify-center -z-10 ${
          darkMode
            ? 'bg-gradient-to-br from-surface-dark via-card-dark to-surface-dark'
            : 'bg-gradient-to-br from-black/5 via-black/8 to-black/5'
        }`}>
          <div className={`${isSpotlight ? 'w-28 h-28' : 'w-20 h-20'} rounded-full flex items-center justify-center ${
            darkMode ? 'bg-primary/10 border border-primary/20' : 'bg-primary/5 border border-primary/15'
          }`}>
            <User size={isSpotlight ? 56 : 40} className="text-primary/60" />
          </div>
        </div>
      )}

      {/* PIN button - only on hover */}
      {isHovered && !tile.isContent && (
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={`absolute top-3 left-3 z-10 p-2 rounded-xl transition-all duration-200 backdrop-blur-sm ${
            isPinned
              ? 'bg-primary/90 text-white shadow-glow'
              : 'bg-black/40 text-white/80 hover:bg-black/60 hover:text-white'
          }`}
          title={isPinned ? 'Desafixar' : 'Fixar em destaque'}
        >
          {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      )}

      {/* Active speaker indicator */}
      {isActiveSpeaker && (
        <div className="absolute top-3 right-3 bg-green-500 rounded-full p-1.5 animate-pulse">
          <Volume2 size={16} className="text-white" />
        </div>
      )}

      {/* Name and status bar */}
      <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t ${
        darkMode ? 'from-black/80 to-transparent' : 'from-black/60 to-transparent'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium truncate">
            {isLocal ? 'Você' : userName}
            {tile.isContent && ' (Tela)'}
            {isPinned && ' 📌'}
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
  darkMode,
}: ChimeVideoGridProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [pinnedTileId, setPinnedTileId] = useState<number | null>(null);

  // Bind audio element
  useEffect(() => {
    if (audioRef.current) {
      bindAudioElement(audioRef.current);
    }
  }, [bindAudioElement]);

  // Separar tiles
  const localTiles = videoTiles.filter(t => t.isLocal && !t.isContent);
  const remoteTiles = videoTiles.filter(t => !t.isLocal && !t.isContent);
  const contentTiles = videoTiles.filter(t => t.isContent);
  const allTiles = [...contentTiles, ...remoteTiles, ...localTiles];

  // Se o tile pinado saiu, limpar
  useEffect(() => {
    if (pinnedTileId !== null && !allTiles.find(t => t.odTileId === pinnedTileId)) {
      setPinnedTileId(null);
    }
  }, [allTiles, pinnedTileId]);

  const pinnedTile = pinnedTileId !== null ? allTiles.find(t => t.odTileId === pinnedTileId) : null;
  const unpinnedTiles = pinnedTile ? allTiles.filter(t => t.odTileId !== pinnedTileId) : allTiles;
  const hasPinned = !!pinnedTile;

  // Grid layout for unpinned tiles
  const getGridCols = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  const renderTile = (tile: VideoTile, isSpotlight: boolean) => {
    const externalUserIdPart = tile.odExternalUserId?.split('|')[0] || '';
    const isLocal = tile.isLocal || externalUserIdPart === localUserId;
    const isActiveSpeaker = activeSpeakers.includes(tile.odAttendeeId);
    let userName = 'Participante';
    if (tile.odExternalUserId) {
      const parts = tile.odExternalUserId.split('|');
      if (parts.length > 1) {
        userName = sanitizeName(parts[1]);
      } else {
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
        isPinned={tile.odTileId === pinnedTileId}
        onTogglePin={() => setPinnedTileId(prev => prev === tile.odTileId ? null : tile.odTileId)}
        isSpotlight={isSpotlight}
      />
    );
  };

  // Empty state
  if (allTiles.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center ${
        darkMode ? 'bg-surface-dark' : 'bg-black/3'
      }`}>
        <div className="text-center animate-fade-in">
          <div className={`w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center ${
            darkMode ? 'bg-primary/10 border border-primary/20' : 'bg-primary/5 border border-primary/15'
          }`}>
            <User size={40} className="text-primary/60" />
          </div>
          <p className={`text-lg ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
            Conectando à reunião...
          </p>
        </div>
        <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
      </div>
    );
  }

  // Layout with pinned tile (spotlight mode)
  if (hasPinned && pinnedTile) {
    return (
      <div className={`h-full flex flex-col gap-2 p-2 ${darkMode ? 'bg-surface-dark' : 'bg-black/3'}`}>
        <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
        {/* Spotlight - pinned tile takes most space */}
        <div className="flex-1 min-h-0">
          {renderTile(pinnedTile, true)}
        </div>
        {/* Filmstrip - unpinned tiles in a row at the bottom */}
        {unpinnedTiles.length > 0 && (
          <div className="flex gap-2 h-32 flex-shrink-0 overflow-x-auto">
            {unpinnedTiles.map(tile => (
              <div key={tile.odTileId} className="h-full aspect-video flex-shrink-0">
                {renderTile(tile, false)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Normal grid layout (no pin)
  return (
    <div className={`h-full p-2 ${darkMode ? 'bg-surface-dark' : 'bg-black/3'}`}>
      <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
      <div className={`grid ${getGridCols(allTiles.length)} gap-2 h-full auto-rows-fr`}>
        {allTiles.map(tile => renderTile(tile, false))}
      </div>
    </div>
  );
}

