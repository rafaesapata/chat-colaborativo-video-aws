import { useState } from 'react';
import { X, LogOut, Power, Loader2 } from 'lucide-react';

interface EndMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeave: () => void;
  onEndRoom: () => void;
  isAuthenticated: boolean;
  isGeneratingReport: boolean;
  meetingType: string;
  darkMode: boolean;
}

export default function EndMeetingModal({
  isOpen,
  onClose,
  onLeave,
  onEndRoom,
  isAuthenticated,
  isGeneratingReport,
  meetingType,
  darkMode,
}: EndMeetingModalProps) {
  if (!isOpen) return null;

  const isInterview = meetingType === 'ENTREVISTA';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
        darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Encerrar Reunião</h2>
            <button
              onClick={onClose}
              disabled={isGeneratingReport}
              className={`p-2 rounded-full transition ${
                darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              } ${isGeneratingReport ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isGeneratingReport ? (
            <div className="text-center py-8">
              <Loader2 size={48} className="mx-auto mb-4 animate-spin text-purple-500" />
              <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Gerando Relatório...
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                A IA está analisando a entrevista e gerando o relatório do candidato.
              </p>
            </div>
          ) : (
            <>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                O que você deseja fazer?
              </p>

              {/* Opção: Apenas Sair */}
              <button
                onClick={onLeave}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${
                  darkMode
                    ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-700/50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`p-3 rounded-xl ${
                  darkMode ? 'bg-blue-900/50' : 'bg-blue-100'
                }`}>
                  <LogOut size={24} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Apenas Sair
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Você sai da reunião, mas ela continua ativa para outros participantes.
                  </p>
                </div>
              </button>

              {/* Opção: Encerrar Sala (só para autenticados) */}
              {isAuthenticated && (
                <button
                  onClick={onEndRoom}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${
                    darkMode
                      ? 'border-red-900/50 hover:border-red-700 hover:bg-red-900/20'
                      : 'border-red-200 hover:border-red-300 hover:bg-red-50'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${
                    darkMode ? 'bg-red-900/50' : 'bg-red-100'
                  }`}>
                    <Power size={24} className={darkMode ? 'text-red-400' : 'text-red-600'} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Encerrar Sala
                    </h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      A sala será encerrada para todos. Novos participantes não poderão entrar.
                      {isInterview && (
                        <span className={`block mt-1 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                          ✨ Um relatório da entrevista será gerado automaticamente.
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isGeneratingReport && (
          <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={onClose}
              className={`w-full py-2 rounded-lg text-sm font-medium transition ${
                darkMode 
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
