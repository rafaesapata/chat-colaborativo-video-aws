import { useState } from 'react';
import { X, Mic, MicOff } from 'lucide-react';
import LiveTranscription from './LiveTranscription';
import TranscriptionTest from './TranscriptionTest';

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
  onAddTestTranscription: (text: string) => void;
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
  onAddTestTranscription,
  speakingUsers,
  darkMode,
  isSpeechRecognitionSupported
}: TranscriptionPanelProps) {
  const [showTest, setShowTest] = useState(false);

  return (
    <>
      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-96 z-50 transition-transform duration-350 cubic-bezier(0.4, 0, 0.2, 1) ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${darkMode ? 'bg-gray-800 border-l border-gray-700' : 'bg-white border-l border-gray-200'}`}
      >
        {/* Header */}
        <div className={`h-16 flex items-center justify-between px-5 border-b ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Transcrições
            </h2>
            {isRecording && (
              <div className="flex items-center gap-1 text-xs text-green-600 animate-pulse">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Gravando</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Toggle Transcription Button */}
            <button
              onClick={onToggleTranscription}
              disabled={!isSpeechRecognitionSupported}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
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
              {isTranscriptionEnabled ? <MicOff size={16} /> : <Mic size={16} />}
              {isTranscriptionEnabled ? 'Parar' : 'Iniciar'}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150 hover:rotate-90 ${
                darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <LiveTranscription 
            transcriptions={transcriptions}
            speakingUsers={speakingUsers}
          />
        </div>

        {/* Footer with info */}
        <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          {!isSpeechRecognitionSupported ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-semibold text-yellow-900 mb-1">⚠️ Não suportado</p>
                  <p className="text-yellow-700 text-xs">
                    Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge para esta funcionalidade.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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

      {/* Test Component */}
      {showTest && (
        <TranscriptionTest onAddTranscription={onAddTestTranscription} />
      )}

      {/* Test Button */}
      <button
        onClick={() => setShowTest(!showTest)}
        className="fixed bottom-32 right-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium z-40"
      >
        <span className="text-lg">🧪</span>
        <div className="text-left">
          <div>Testar Transcrição</div>
          <div className="text-xs font-normal opacity-90">Clique aqui!</div>
        </div>
      </button>
    </>
  );
}