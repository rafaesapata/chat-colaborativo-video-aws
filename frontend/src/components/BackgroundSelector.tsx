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
        darkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <Image size={20} className="text-purple-500" />
            </div>
            <div>
              <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Efeitos de Fundo
              </h2>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {isAuthenticated ? 'Escolha um fundo virtual' : 'Desfoque disponível'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition ${
              darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
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
                      ? 'ring-2 ring-purple-500 ring-offset-2 ' + (darkMode ? 'ring-offset-gray-800' : 'ring-offset-white')
                      : isHovered
                      ? darkMode ? 'ring-1 ring-gray-600' : 'ring-1 ring-gray-300'
                      : ''
                  } ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                >
                  {/* Background Preview */}
                  <div className={`absolute inset-0 flex items-center justify-center ${
                    bg.type === 'none' 
                      ? darkMode ? 'bg-gray-700' : 'bg-gray-100'
                      : bg.type === 'blur'
                      ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/30 backdrop-blur-sm'
                      : darkMode ? 'bg-gray-600' : 'bg-gray-200'
                  }`}>
                    {bg.preview ? (
                      <span className="text-2xl">{bg.preview}</span>
                    ) : (
                      <X size={24} className={darkMode ? 'text-gray-500' : 'text-gray-400'} />
                    )}
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
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
                    darkMode ? 'bg-black/60 text-white' : 'bg-white/80 text-gray-700'
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
        <div className={`px-6 py-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Atual: {currentBackground.name}
            </p>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                darkMode 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
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
