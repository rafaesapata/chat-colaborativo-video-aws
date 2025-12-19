import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, MessageCircle, FileText } from 'lucide-react';

interface ControlBarProps {
  visible: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeaveMeeting: () => void;
  onToggleChat: () => void;
  onToggleTranscription: () => void;
  unreadCount: number;
  transcriptionCount: number;
  isTranscriptionEnabled: boolean;
  darkMode: boolean;
}

export default function ControlBar({
  visible,
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveMeeting,
  onToggleChat,
  onToggleTranscription,
  unreadCount,
  transcriptionCount,
  isTranscriptionEnabled,
  darkMode
}: ControlBarProps) {
  return (
    <>
      {/* Main Control Bar */}
      <div
        className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        style={{ backdropFilter: 'blur(12px)' }}
      >
        <div className={`flex items-center gap-2 px-6 py-3 rounded-2xl shadow-lg ${
          darkMode 
            ? 'bg-gray-800/95 border border-gray-700/50' 
            : 'bg-white/95 border border-gray-200/50'
        }`}>
          {/* Microphone */}
          <button
            onClick={onToggleMute}
            className={`w-13 h-13 rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 ${
              isMuted
                ? 'bg-red-500 text-white'
                : darkMode
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Camera */}
          <button
            onClick={onToggleVideo}
            className={`w-13 h-13 rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 ${
              isVideoOff
                ? 'bg-red-500 text-white'
                : darkMode
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={onToggleScreenShare}
            className={`w-13 h-13 rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 ${
              isScreenSharing
                ? 'bg-blue-500 text-white'
                : darkMode
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Monitor size={20} />
          </button>

          {/* Separator */}
          <div className={`w-px h-8 mx-2 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />

          {/* Leave Meeting */}
          <button
            onClick={onLeaveMeeting}
            className="w-13 h-13 rounded-xl bg-red-500 text-white flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 hover:bg-red-600"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {/* Side Buttons */}
      <div
        className={`fixed bottom-6 right-6 flex flex-col gap-3 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        {/* Transcription Button */}
        <button
          onClick={onToggleTranscription}
          className={`relative w-13 h-13 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 shadow-lg ${
            isTranscriptionEnabled
              ? 'bg-green-500 text-white border border-green-400/50'
              : darkMode 
              ? 'bg-gray-800/95 text-white border border-gray-700/50' 
              : 'bg-white/95 text-gray-700 border border-gray-200/50'
          }`}
          style={{ backdropFilter: 'blur(12px)' }}
          title={isTranscriptionEnabled ? 'Parar transcrição' : 'Iniciar transcrição'}
        >
          <FileText size={20} />
          
          {/* Transcription Badge */}
          {transcriptionCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {transcriptionCount > 9 ? '9+' : transcriptionCount}
            </div>
          )}
        </button>

        {/* Chat Button */}
        <button
          onClick={onToggleChat}
          className={`relative w-13 h-13 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 shadow-lg ${
            darkMode 
              ? 'bg-gray-800/95 text-white border border-gray-700/50' 
              : 'bg-white/95 text-gray-700 border border-gray-200/50'
          }`}
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <MessageCircle size={20} />
          
          {/* Unread Badge */}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      </div>
    </>
  );
}