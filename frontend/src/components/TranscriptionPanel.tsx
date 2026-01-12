import { X, Mic, MicOff } from 'lucide-react';
import LiveTranscription from './LiveTranscription';
import { useMobile } from '../hooks/useMobile';

interface Transcription {
  transcriptionId: string;
  userId: string;
  transcribedText: string;
  timestamp: number;
  speakerLabel?: string;
  isPartial?: boolean;
}

interface TranscriptionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transcriptions: Transcription[];
  isTranscriptionEnabled: boolean;
  isRecording: boolean;
  onToggleTranscription: () => void;
  speakingUsers: Set<string>;
  darkMode: boolean;
  isSpeechRecognitionSupported: boolean;
}

export default function TranscriptionPanel({
  isOpen,
  onClose,
  transcriptions,
  isTranscriptionEnabled,
  isRecording,
  onToggleTranscription,
  speakingUsers,
  darkMode,
  isSpeechRecognitionSupported
}: TranscriptionPanelProps) {
  const { isMobile } = useMobile();

  return (
    <>
      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full z-50 transition-transform duration-350 cubic-bezier(0.4, 0, 0.2, 1) backdrop-blur-xl flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isMobile ? 'w-full' : 'w-96'} ${darkMode 
          ? 'bg-gray-900/40 border-l border-white/10' 
          : 'bg-white/40 border-l border-white/20'
        }`}
        style={{ 
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)'
        }}
      >
        {/* Header */}
        <div className={`${isMobile ? 'h-14' : 'h-16'} flex-shrink-0 flex items-center justify-between px-4 border-b ${
          darkMode ? 'border-white/10' : 'border-black/5'
        }`}>
          <div className="flex items-center gap-2">
            <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Transcrições
            </h2>
            {isRecording && (
              <div className={`flex items-center gap-1 ${isMobile ? 'text-[10px]' : 'text-xs'} text-green-600 animate-pulse`}>
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                <span>Gravando</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Toggle Transcription Button */}
            <button
              onClick={onToggleTranscription}
              disabled={!isSpeechRecognitionSupported}
              className={`${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-lg font-medium transition flex items-center gap-1.5 ${
                !isSpeechRecognitionSupported
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isTranscriptionEnabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : darkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={
                !isSpeechRecognitionSupported
                  ? 'Reconhecimento de voz não suportado'
                  : isTranscriptionEnabled 
                  ? 'Parar transcrição' 
                  : 'Iniciar transcrição'
              }
            >
              {isTranscriptionEnabled ? <MicOff size={isMobile ? 14 : 16} /> : <Mic size={isMobile ? 14 : 16} />}
              {isTranscriptionEnabled ? 'Parar' : 'Iniciar'}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`${isMobile ? 'w-9 h-9' : 'w-10 h-10'} rounded-lg flex items-center justify-center transition-all duration-150 hover:rotate-90 ${
                darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={isMobile ? 18 : 20} />
            </button>
          </div>
        </div>

        {/* Content - com flex-1 e overflow-y-auto */}
        <div className="flex-1 overflow-y-auto">
          <LiveTranscription 
            transcriptions={transcriptions}
            speakingUsers={speakingUsers}
          />
        </div>

        {/* Footer with info */}
        <div className={`${isMobile ? 'p-3' : 'p-4'} flex-shrink-0 border-t ${darkMode ? 'border-white/10' : 'border-black/5'}`}>
          {!isSpeechRecognitionSupported ? (
            <div className={`bg-yellow-50 border border-yellow-200 rounded-lg ${isMobile ? 'p-2' : 'p-3'} text-sm`}>
              <div className="flex items-start gap-2">
                <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-yellow-600 flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className={`font-semibold text-yellow-900 ${isMobile ? 'text-xs' : 'text-sm'} mb-1`}>⚠️ Não suportado</p>
                  <p className={`text-yellow-700 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                    Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <p className="mb-1">
                🎤 {isTranscriptionEnabled ? 'Transcrição ativa' : 'Transcrição desativada'}
              </p>
              <p>
                {transcriptions.length} transcrição{transcriptions.length !== 1 ? 'ões' : ''} registrada{transcriptions.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}