import { useEffect, useRef, useState } from 'react';

interface Props {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  speakingUsers: Set<string>;
  connectionErrors: Map<string, string>;
  videoQuality: 'high' | 'medium' | 'low';
}

export default function VideoCall({
  localStream,
  remoteStreams,
  onToggleVideo,
  onToggleAudio,
  isVideoEnabled,
  isAudioEnabled,
  speakingUsers,
  connectionErrors,
  videoQuality
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteVideoRefs] = useState<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const qualityLabels = {
    high: '🟢 HD',
    medium: '🟡 SD',
    low: '🔴 Baixa'
  };

  return (
    <div className="flex-1 bg-gray-900 relative">
      {/* Indicador de qualidade */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 px-3 py-2 rounded-lg text-white text-sm">
        Qualidade: {qualityLabels[videoQuality]}
      </div>

      {/* Notificações de erro */}
      {Array.from(connectionErrors.entries()).map(([userId, error]) => (
        <div key={userId} className="absolute top-16 right-4 z-10 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg max-w-xs">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      ))}

      {/* Grid de vídeos remotos */}
      <div className="grid grid-cols-2 gap-2 p-4 h-full">
        {Array.from(remoteStreams.entries()).map(([userId, stream]) => {
          const isSpeaking = speakingUsers.has(userId);
          return (
            <div 
              key={userId} 
              className={`relative bg-gray-800 rounded-lg overflow-hidden transition-all duration-200 ${
                isSpeaking ? 'ring-4 ring-green-500 shadow-lg shadow-green-500/50' : ''
              }`}
            >
              <video
                ref={(el) => {
                  if (el) {
                    el.srcObject = stream;
                    remoteVideoRefs.set(userId, el);
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-3 py-1 rounded-full text-white text-sm flex items-center gap-2">
                {isSpeaking && (
                  <span className="flex items-center">
                    <span className="animate-pulse">🎤</span>
                  </span>
                )}
                <span>Usuário {userId.substr(-4)}</span>
              </div>
              {isSpeaking && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-green-500 opacity-10 animate-pulse"></div>
                </div>
              )}
            </div>
          );
        })}
        
        {remoteStreams.size === 0 && (
          <div className="col-span-2 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-lg">Aguardando outros participantes...</p>
            </div>
          </div>
        )}
      </div>

      {/* Vídeo local (picture-in-picture) */}
      <div className={`absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-all duration-200 ${
        speakingUsers.has('local') ? 'ring-4 ring-green-500 shadow-green-500/50' : 'border-2 border-gray-700'
      }`}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover mirror"
        />
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-3 py-1 rounded-full text-white text-xs flex items-center gap-1">
          {speakingUsers.has('local') && (
            <span className="animate-pulse">🎤</span>
          )}
          <span>Você</span>
        </div>
        {!isVideoEnabled && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        )}
      </div>

      {/* Controles de vídeo */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
        <button
          onClick={onToggleAudio}
          className={`p-4 rounded-full ${
            isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
          } text-white transition shadow-lg`}
          title={isAudioEnabled ? 'Desligar microfone' : 'Ligar microfone'}
        >
          {isAudioEnabled ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </button>

        <button
          onClick={onToggleVideo}
          className={`p-4 rounded-full ${
            isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
          } text-white transition shadow-lg`}
          title={isVideoEnabled ? 'Desligar câmera' : 'Ligar câmera'}
        >
          {isVideoEnabled ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          )}
        </button>
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
