/**
 * Componente para seleção de Background Blur/Virtual Background
 */

import { useState } from 'react';
import { Image, Loader2, X, Check, Lock } from 'lucide-react';
import { BackgroundOption } from '../hooks/useBackgroundEffect';

interface BackgroundSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentBackground: BackgroundOption;
  availableBackgrounds: BackgroundOption[];
  isProcessing: boolean;
  isAuthenticated: boolean;
  error: string | null;
  onSelect: (backgroundId: string) => void;
  darkMode: boolean;
}

export default function BackgroundSelector({
  isOpen,
  onClose,
  currentBackground,
  availableBackgrounds,
  isProcessing,
  isAuthenticated,
  error,
  onSelect,
  darkMode,
}: BackgroundSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-md rounded-2xl shadow-2xl ${
        darkMode ? 'bg-card-dark' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          darkMode ? 'border-border-dark' : 'border-border-light'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-primary-900/50' : 'bg-primary-50'}`}>
              <Image size={20} className="text-primary" />
            </div>
            <div>
              <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-foreground-light'}`}>
                Efeitos de Fundo
              </h2>
              <p className={`text-xs ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                {isAuthenticated ? 'Escolha um fundo virtual' : 'Desfoque disponível'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition ${
              darkMode ? 'hover:bg-white/10 text-muted-dark' : 'hover:bg-black/5 text-muted-light'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className={`mx-6 mt-4 p-3 rounded-lg text-sm ${
            darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'
          }`}>
            {error}
          </div>
        )}

        {/* Background Options */}
        <div className="p-6">
          <div className="grid grid-cols-3 gap-3">
            {availableBackgrounds.map((bg) => {
              const isSelected = currentBackground.id === bg.id;
              const isHovered = hoveredId === bg.id;
              
              return (
                <button
                  key={bg.id}
                  onClick={() => onSelect(bg.id)}
                  onMouseEnter={() => setHoveredId(bg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  disabled={isProcessing}
                  className={`relative aspect-video rounded-xl overflow-hidden transition-all duration-200 ${
                    isSelected 
                      ? 'ring-2 ring-primary ring-offset-2 ' + (darkMode ? 'ring-offset-card-dark' : 'ring-offset-white')
                      : isHovered
                      ? darkMode ? 'ring-1 ring-border-dark' : 'ring-1 ring-border-light'
                      : ''
                  } ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                >
                  {/* Background Preview */}
                  <div className={`absolute inset-0 flex items-center justify-center ${
                    bg.type === 'none' 
                      ? darkMode ? 'bg-white/5' : 'bg-black/5'
                      : bg.type === 'blur'
                      ? 'bg-gradient-to-br from-blue-500/30 to-primary-glow/30 backdrop-blur-sm'
                      : darkMode ? 'bg-white/10' : 'bg-black/5'
                  }`}>
                    {bg.preview ? (
                      <span className="text-2xl">{bg.preview}</span>
                    ) : (
                      <X size={24} className={darkMode ? 'text-muted-light' : 'text-muted-dark'} />
                    )}
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}

                  {/* Processing Indicator */}
                  {isProcessing && isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 size={24} className="text-white animate-spin" />
                    </div>
                  )}

                  {/* Label */}
                  <div className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-xs font-medium truncate ${
                    darkMode ? 'bg-black/60 text-white' : 'bg-white/80 text-muted-light'
                  }`}>
                    {bg.name}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info for guests */}
          {!isAuthenticated && (
            <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
              darkMode ? 'bg-yellow-900/20 text-yellow-300' : 'bg-yellow-50 text-yellow-700'
            }`}>
              <Lock size={16} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs">
                Fundos virtuais personalizados estão disponíveis apenas para usuários autenticados.
                Faça login para acessar mais opções.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>
              Atual: {currentBackground.name}
            </p>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                darkMode 
                  ? 'bg-primary hover:bg-primary-600 text-white' 
                  : 'bg-primary hover:bg-primary text-white'
              }`}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
