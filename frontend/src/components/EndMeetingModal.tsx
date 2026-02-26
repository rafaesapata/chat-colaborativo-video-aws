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
        darkMode ? 'bg-card-dark text-white' : 'bg-white text-foreground-light'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Encerrar Reunião</h2>
            <button
              onClick={onClose}
              disabled={isGeneratingReport}
              className={`p-2 rounded-full transition ${
                darkMode ? 'hover:bg-white/10 text-muted-dark' : 'hover:bg-black/5 text-muted-light'
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
              <Loader2 size={48} className="mx-auto mb-4 animate-spin text-primary" />
              <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-foreground-light'}`}>
                Gerando Relatório...
              </h3>
              <p className={`text-sm ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                A IA está analisando a entrevista e gerando o relatório do candidato.
              </p>
            </div>
          ) : (
            <>
              <p className={`text-sm ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
                O que você deseja fazer?
              </p>

              {/* Opção: Apenas Sair */}
              <button
                onClick={onLeave}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${
                  darkMode
                    ? 'border-border-dark hover:border-border-dark hover:bg-white/10/50'
                    : 'border-border-light hover:border-border-light hover:bg-black/3'
                }`}
              >
                <div className={`p-3 rounded-xl ${
                  darkMode ? 'bg-blue-900/50' : 'bg-blue-100'
                }`}>
                  <LogOut size={24} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-foreground-light'}`}>
                    Apenas Sair
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
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
                    <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-foreground-light'}`}>
                      Encerrar Sala
                    </h3>
                    <p className={`text-sm ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                      A sala será encerrada para todos. Novos participantes não poderão entrar.
                      {isInterview && (
                        <span className={`block mt-1 ${darkMode ? 'text-primary-300' : 'text-primary'}`}>
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
          <div className={`p-4 border-t ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
            <button
              onClick={onClose}
              className={`w-full py-2 rounded-lg text-sm font-medium transition ${
                darkMode 
                  ? 'text-muted-dark hover:text-foreground-dark hover:bg-white/10' 
                  : 'text-muted-light hover:text-muted-light hover:bg-black/5'
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
