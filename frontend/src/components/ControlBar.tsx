import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, MessageCircle, FileText, FileTextIcon, Circle } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

interface ControlBarProps {
  visible: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isTranscriptionActive: boolean;
  isAuthenticated: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleTranscriptionActive: () => void;
  onLeaveMeeting: () => void;
  onToggleChat: () => void;
  onToggleTranscriptionPanel: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecording?: boolean;
  recordingDuration?: number;
  unreadCount: number;
  transcriptionCount: number;
  darkMode: boolean;
}

export default function ControlBar({
  visible,
  isMuted,
  isVideoOff,
  isScreenSharing,
  isTranscriptionActive,
  isAuthenticated,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleTranscriptionActive,
  onLeaveMeeting,
  onToggleChat,
  onToggleTranscriptionPanel,
  onStartRecording,
  onStopRecording,
  isRecording = false,
  recordingDuration = 0,
  unreadCount,
  transcriptionCount,
  darkMode
}: ControlBarProps) {
  const { isMobile, isTouch } = useMobile();
  
  // No mobile/touch, controles sempre visíveis
  const isVisible = isTouch || visible;
  
  // Tamanhos adaptativos
  const buttonSize = isMobile ? 'w-12 h-12' : 'w-13 h-13';
  const iconSize = isMobile ? 18 : 20;
  const roundButtonSize = isMobile ? 'w-11 h-11' : 'w-13 h-13';

  // Formatar duração da gravação
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Main Control Bar */}
      <div
        className={`fixed ${isMobile ? 'bottom-4' : 'bottom-6'} left-1/2 transform -translate-x-1/2 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        <div className={`flex items-center ${isMobile ? 'gap-1.5 px-3 py-2' : 'gap-2 px-6 py-3'} rounded-2xl shadow-lg backdrop-blur-xl ${
          darkMode 
            ? 'bg-gray-900/60 border border-white/10' 
            : 'bg-white/40 border border-white/30'
        }`}
        style={{ 
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}>
          {/* Microphone */}
          <button
            onClick={onToggleMute}
            className={`${buttonSize} rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 ${
              isMuted
                ? 'bg-red-500/90 text-white'
                : darkMode
                ? 'bg-white/10 text-white hover:bg-white/20'
                : 'bg-black/5 text-gray-700 hover:bg-black/10'
            }`}
          >
            {isMuted ? <MicOff size={iconSize} /> : <Mic size={iconSize} />}
          </button>

          {/* Camera */}
          <button
            onClick={onToggleVideo}
            className={`${buttonSize} rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 ${
              isVideoOff
                ? 'bg-red-500/90 text-white'
                : darkMode
                ? 'bg-white/10 text-white hover:bg-white/20'
                : 'bg-black/5 text-gray-700 hover:bg-black/10'
            }`}
          >
            {isVideoOff ? <VideoOff size={iconSize} /> : <Video size={iconSize} />}
          </button>

          {/* Screen Share - esconder no mobile (não suportado na maioria) */}
          {!isMobile && (
            <button
              onClick={onToggleScreenShare}
              className={`${buttonSize} rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 ${
                isScreenSharing
                  ? 'bg-blue-500/90 text-white'
                  : darkMode
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-black/5 text-gray-700 hover:bg-black/10'
              }`}
            >
              <Monitor size={iconSize} />
            </button>
          )}

          {/* Transcription Toggle - só para usuários autenticados */}
          {!isMobile && isAuthenticated && (
            <button
              onClick={onToggleTranscriptionActive}
              className={`${buttonSize} rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 ${
                isTranscriptionActive
                  ? 'bg-green-500/90 text-white'
                  : darkMode
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-black/5 text-gray-700 hover:bg-black/10'
              }`}
              title={isTranscriptionActive ? 'Desativar transcrição' : 'Ativar transcrição'}
            >
              {isTranscriptionActive ? <FileText size={iconSize} /> : <FileTextIcon size={iconSize} className="opacity-50" />}
            </button>
          )}

          {/* Separator */}
          <div className={`w-px ${isMobile ? 'h-6 mx-1' : 'h-8 mx-2'} ${darkMode ? 'bg-white/20' : 'bg-black/10'}`} />

          {/* Leave Meeting */}
          <button
            onClick={onLeaveMeeting}
            className={`${buttonSize} rounded-xl bg-red-500/90 text-white flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 hover:bg-red-600`}
          >
            <PhoneOff size={iconSize} />
          </button>
        </div>
      </div>

      {/* Side Buttons */}
      <div
        className={`fixed ${isMobile ? 'bottom-4 right-3' : 'bottom-6 right-6'} flex flex-col gap-2 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        {/* Recording Button - só para usuários autenticados */}
        {isAuthenticated && onStartRecording && onStopRecording && (
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={`relative ${roundButtonSize} rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 shadow-lg backdrop-blur-xl ${
              isRecording
                ? 'bg-red-500 text-white border border-red-400 animate-pulse'
                : darkMode 
                  ? 'bg-gray-900/60 text-white border border-white/10' 
                  : 'bg-white/40 text-gray-700 border border-white/30'
            }`}
            style={{ 
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}
            title={isRecording ? `Parar gravação (${formatDuration(recordingDuration)})` : 'Iniciar gravação'}
          >
            <Circle size={iconSize} fill={isRecording ? 'white' : 'currentColor'} />
            {isRecording && (
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-red-500 whitespace-nowrap">
                {formatDuration(recordingDuration)}
              </span>
            )}
          </button>
        )}

        {/* Transcription Panel Button - só para usuários autenticados */}
        {isAuthenticated && (
          <button
            onClick={onToggleTranscriptionPanel}
            className={`relative ${roundButtonSize} rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 shadow-lg backdrop-blur-xl ${
              darkMode 
                ? 'bg-gray-900/60 text-white border border-white/10' 
                : 'bg-white/40 text-gray-700 border border-white/30'
            }`}
            style={{ 
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}
            title="Ver transcrições"
          >
            <FileText size={iconSize} />
            
            {/* Transcription Badge */}
            {transcriptionCount > 0 && (
              <div className={`absolute -top-1 -right-1 ${isMobile ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs'} bg-purple-500 text-white rounded-full flex items-center justify-center font-medium`}>
                {transcriptionCount > 9 ? '9+' : transcriptionCount}
              </div>
            )}
          </button>
        )}

        {/* Chat Button */}
        <button
          onClick={onToggleChat}
          className={`relative ${roundButtonSize} rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 shadow-lg backdrop-blur-xl ${
            darkMode 
              ? 'bg-gray-900/60 text-white border border-white/10' 
              : 'bg-white/40 text-gray-700 border border-white/30'
          }`}
          style={{ 
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}
        >
          <MessageCircle size={iconSize} />
          
          {/* Unread Badge */}
          {unreadCount > 0 && (
            <div className={`absolute -top-1 -right-1 ${isMobile ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs'} bg-red-500 text-white rounded-full flex items-center justify-center font-medium`}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      </div>
    </>
  );
}