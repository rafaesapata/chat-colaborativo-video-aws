import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, MessageCircle, FileText, FileTextIcon, Circle, Volume2, VolumeX, Image, Settings, X, Headphones, ChevronRight } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

interface ControlBarProps {
  visible: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isTranscriptionActive: boolean;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  isSpeakerMode?: boolean;
  hasBackgroundEffect?: boolean;
  // Dispositivos
  audioInputDevices?: MediaDeviceInfo[];
  audioOutputDevices?: MediaDeviceInfo[];
  videoInputDevices?: MediaDeviceInfo[];
  selectedAudioInput?: string;
  selectedAudioOutput?: string;
  selectedVideoInput?: string;
  onChangeAudioInput?: (deviceId: string) => void;
  onChangeAudioOutput?: (deviceId: string) => void;
  onChangeVideoInput?: (deviceId: string) => void;
  // Ações
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleTranscriptionActive: () => void;
  onToggleSpeakerMode?: () => void;
  onToggleBackgroundSelector?: () => void;
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
  isAdmin = false,
  isSpeakerMode = true,
  hasBackgroundEffect = false,
  // Dispositivos
  audioInputDevices = [],
  audioOutputDevices = [],
  videoInputDevices = [],
  selectedAudioInput = '',
  selectedAudioOutput = '',
  selectedVideoInput = '',
  onChangeAudioInput,
  onChangeAudioOutput,
  onChangeVideoInput,
  // Ações
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleTranscriptionActive,
  onToggleSpeakerMode,
  onToggleBackgroundSelector,
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
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDevicesSubmenu, setShowDevicesSubmenu] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  
  // No mobile/touch, controles sempre visíveis
  const isVisible = isTouch || visible;
  
  // Tamanhos adaptativos - reduzidos em 20%
  const buttonSize = isMobile ? 'w-10 h-10' : 'w-11 h-11';
  const iconSize = isMobile ? 15 : 16;
  const roundButtonSize = isMobile ? 'w-9 h-9' : 'w-10 h-10';

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsMenu]);

  // Formatar duração da gravação
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Verificar se alguma configuração está ativa
  const hasActiveSettings = isScreenSharing || hasBackgroundEffect || isTranscriptionActive;

  return (
    <>
      {/* Main Control Bar */}
      <div
        className={`fixed ${isMobile ? 'bottom-4' : 'bottom-6'} left-1/2 transform -translate-x-1/2 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        <div className={`flex items-center ${isMobile ? 'gap-1 px-2.5 py-1.5' : 'gap-1.5 px-4 py-2'} rounded-xl shadow-lg backdrop-blur-xl ${
          darkMode 
            ? 'bg-gray-900/40 border border-white/10' 
            : 'bg-white/30 border border-white/20'
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
            title={isMuted ? 'Ativar microfone' : 'Desativar microfone'}
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
            title={isVideoOff ? 'Ativar câmera' : 'Desativar câmera'}
          >
            {isVideoOff ? <VideoOff size={iconSize} /> : <Video size={iconSize} />}
          </button>

          {/* Speaker Mode - apenas no mobile */}
          {isMobile && onToggleSpeakerMode && (
            <button
              onClick={onToggleSpeakerMode}
              className={`${buttonSize} rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 ${
                isSpeakerMode
                  ? darkMode
                    ? 'bg-blue-500/90 text-white'
                    : 'bg-blue-500/90 text-white'
                  : darkMode
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-black/5 text-gray-700 hover:bg-black/10'
              }`}
              title={isSpeakerMode ? 'Alto-falante ativo' : 'Fone de ouvido'}
            >
              {isSpeakerMode ? <Volume2 size={iconSize} /> : <VolumeX size={iconSize} />}
            </button>
          )}

          {/* Settings Button with Submenu */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`${buttonSize} rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 ${
                hasActiveSettings || showSettingsMenu
                  ? 'bg-blue-500/90 text-white'
                  : darkMode
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-black/5 text-gray-700 hover:bg-black/10'
              }`}
              title="Configurações"
            >
              <Settings size={iconSize} className={showSettingsMenu ? 'rotate-90' : ''} style={{ transition: 'transform 0.2s' }} />
            </button>

            {/* Settings Submenu */}
            {showSettingsMenu && (
              <div 
                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 rounded-xl shadow-xl overflow-hidden ${
                  darkMode 
                    ? 'bg-gray-900/40 border border-white/10' 
                    : 'bg-white/30 border border-white/20'
                }`}
                style={{ 
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  minWidth: '180px'
                }}
              >
                <div className={`px-2.5 py-1.5 border-b ${darkMode ? 'border-white/10' : 'border-black/10'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold ${darkMode ? 'text-white/70' : 'text-gray-600'}`}>
                      Configurações
                    </span>
                    <button 
                      onClick={() => setShowSettingsMenu(false)}
                      className={`p-0.5 rounded hover:bg-white/10 ${darkMode ? 'text-white/70' : 'text-gray-500'}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                <div className="py-0.5">
                  {/* Screen Share - esconder no mobile */}
                  {!isMobile && (
                    <button
                      onClick={() => { onToggleScreenShare(); setShowSettingsMenu(false); }}
                      className={`w-full px-2.5 py-2 flex items-center gap-2.5 transition-colors ${
                        darkMode 
                          ? 'hover:bg-white/10 text-white' 
                          : 'hover:bg-black/5 text-gray-700'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                        isScreenSharing 
                          ? 'bg-blue-500/90 text-white' 
                          : darkMode ? 'bg-white/10' : 'bg-black/10'
                      }`}>
                        <Monitor size={13} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          Compartilhar Tela
                        </div>
                        <div className={`text-[10px] ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>
                          {isScreenSharing ? 'Compartilhando' : 'Desativado'}
                        </div>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${isScreenSharing ? 'bg-blue-500' : darkMode ? 'bg-white/30' : 'bg-gray-400'}`} />
                    </button>
                  )}

                  {/* Background Effect */}
                  {onToggleBackgroundSelector && (
                    <button
                      onClick={() => { onToggleBackgroundSelector(); setShowSettingsMenu(false); }}
                      className={`w-full px-2.5 py-2 flex items-center gap-2.5 transition-colors ${
                        darkMode 
                          ? 'hover:bg-white/10 text-white' 
                          : 'hover:bg-black/5 text-gray-700'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                        hasBackgroundEffect 
                          ? 'bg-purple-500/90 text-white' 
                          : darkMode ? 'bg-white/10' : 'bg-black/10'
                      }`}>
                        <Image size={13} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          Fundo de Tela
                        </div>
                        <div className={`text-[10px] ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>
                          {hasBackgroundEffect ? 'Efeito ativo' : 'Sem efeito'}
                        </div>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasBackgroundEffect ? 'bg-purple-500' : darkMode ? 'bg-white/30' : 'bg-gray-400'}`} />
                    </button>
                  )}

                  {/* Transcription Toggle - só para usuários autenticados */}
                  {isAuthenticated && (
                    <button
                      onClick={() => { onToggleTranscriptionActive(); setShowSettingsMenu(false); }}
                      className={`w-full px-2.5 py-2 flex items-center gap-2.5 transition-colors ${
                        darkMode 
                          ? 'hover:bg-white/10 text-white' 
                          : 'hover:bg-black/5 text-gray-700'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                        isTranscriptionActive 
                          ? 'bg-green-500/90 text-white' 
                          : darkMode ? 'bg-white/10' : 'bg-black/10'
                      }`}>
                        {isTranscriptionActive ? <FileText size={13} /> : <FileTextIcon size={13} />}
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          Transcrição
                        </div>
                        <div className={`text-[10px] ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>
                          {isTranscriptionActive ? 'Ativa' : 'Desativada'}
                        </div>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${isTranscriptionActive ? 'bg-green-500' : darkMode ? 'bg-white/30' : 'bg-gray-400'}`} />
                    </button>
                  )}

                  {/* Dispositivos - submenu */}
                  {(audioInputDevices.length > 0 || audioOutputDevices.length > 0 || videoInputDevices.length > 0) && (
                    <div className="relative">
                      <button
                        onClick={() => setShowDevicesSubmenu(!showDevicesSubmenu)}
                        className={`w-full px-2.5 py-2 flex items-center gap-2.5 transition-colors ${
                          darkMode 
                            ? 'hover:bg-white/10 text-white' 
                            : 'hover:bg-black/5 text-gray-700'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                          darkMode ? 'bg-white/10' : 'bg-black/10'
                        }`}>
                          <Headphones size={13} />
                        </div>
                        <div className="flex-1 text-left">
                          <div className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            Dispositivos
                          </div>
                          <div className={`text-[10px] ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>
                            Câmera, Mic, Áudio
                          </div>
                        </div>
                        <ChevronRight size={14} className={`transition-transform ${showDevicesSubmenu ? 'rotate-90' : ''}`} />
                      </button>

                      {/* Submenu de dispositivos */}
                      {showDevicesSubmenu && (
                        <div className={`mt-1 mx-2 p-2 rounded-lg ${
                          darkMode ? 'bg-white/5' : 'bg-black/5'
                        }`}>
                          {/* Câmera */}
                          {videoInputDevices.length > 0 && onChangeVideoInput && (
                            <div className="mb-2">
                              <label className={`block text-[10px] font-medium mb-1 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                                Câmera
                              </label>
                              <select
                                value={selectedVideoInput}
                                onChange={(e) => onChangeVideoInput(e.target.value)}
                                className={`w-full px-2 py-1.5 rounded text-xs ${
                                  darkMode 
                                    ? 'bg-gray-800 border-gray-700 text-white' 
                                    : 'bg-white border-gray-200 text-gray-900'
                                } border`}
                              >
                                {videoInputDevices.map(device => (
                                  <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Câmera ${device.deviceId.slice(0, 8)}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Microfone */}
                          {audioInputDevices.length > 0 && onChangeAudioInput && (
                            <div className="mb-2">
                              <label className={`block text-[10px] font-medium mb-1 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                                Microfone
                              </label>
                              <select
                                value={selectedAudioInput}
                                onChange={(e) => onChangeAudioInput(e.target.value)}
                                className={`w-full px-2 py-1.5 rounded text-xs ${
                                  darkMode 
                                    ? 'bg-gray-800 border-gray-700 text-white' 
                                    : 'bg-white border-gray-200 text-gray-900'
                                } border`}
                              >
                                {audioInputDevices.map(device => (
                                  <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Microfone ${device.deviceId.slice(0, 8)}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Saída de Áudio */}
                          {audioOutputDevices.length > 0 && onChangeAudioOutput && (
                            <div>
                              <label className={`block text-[10px] font-medium mb-1 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                                Saída de Áudio
                              </label>
                              <select
                                value={selectedAudioOutput}
                                onChange={(e) => onChangeAudioOutput(e.target.value)}
                                className={`w-full px-2 py-1.5 rounded text-xs ${
                                  darkMode 
                                    ? 'bg-gray-800 border-gray-700 text-white' 
                                    : 'bg-white border-gray-200 text-gray-900'
                                } border`}
                              >
                                {audioOutputDevices.map(device => (
                                  <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Saída ${device.deviceId.slice(0, 8)}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className={`w-px ${isMobile ? 'h-5 mx-0.5' : 'h-6 mx-1'} ${darkMode ? 'bg-white/20' : 'bg-black/10'}`} />

          {/* Leave Meeting */}
          <button
            onClick={onLeaveMeeting}
            className={`${buttonSize} rounded-xl bg-red-500/90 text-white flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 hover:bg-red-600`}
            title="Sair da reunião"
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
        {/* Recording Button - só para admins e super admins */}
        {isAdmin && onStartRecording && onStopRecording && (
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
          title="Chat"
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
