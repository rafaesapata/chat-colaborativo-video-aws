import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Sparkles, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { InterviewSuggestion } from '../services/interviewAIService';

interface InterviewSuggestionsProps {
  suggestions: InterviewSuggestion[];
  isGenerating: boolean;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  darkMode: boolean;
  meetingTopic: string;
  recentlyMarkedIds?: Set<string>; // IDs das sugestões recém-marcadas automaticamente
}

export default function InterviewSuggestions({
  suggestions,
  isGenerating,
  onMarkAsRead,
  onDismiss,
  darkMode,
  meetingTopic,
  recentlyMarkedIds = new Set(),
}: InterviewSuggestionsProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 320, height: 480 }); // Tamanho inicial
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Inicializar posição e tamanho
  useEffect(() => {
    const savedPos = sessionStorage.getItem('interview_suggestions_pos');
    const savedSize = sessionStorage.getItem('interview_suggestions_size');
    
    if (savedPos) {
      try {
        setPosition(JSON.parse(savedPos));
      } catch { /* ignore */ }
    }
    
    if (savedSize) {
      try {
        setSize(JSON.parse(savedSize));
      } catch { /* ignore */ }
    }
  }, []);

  // Salvar posição e tamanho
  useEffect(() => {
    if (position.x !== 0 || position.y !== 0) {
      sessionStorage.setItem('interview_suggestions_pos', JSON.stringify(position));
    }
  }, [position]);

  useEffect(() => {
    sessionStorage.setItem('interview_suggestions_size', JSON.stringify(size));
  }, [size]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y
    };
  }, [position]);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    resizeStartRef.current = {
      x: clientX,
      y: clientY,
      width: size.width,
      height: size.height
    };
  }, [size]);

  // Drag effect
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      setPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Resize effect
  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const deltaX = clientX - resizeStartRef.current.x;
      const deltaY = clientY - resizeStartRef.current.y;
      
      // Limites mínimos e máximos
      const newWidth = Math.max(280, Math.min(600, resizeStartRef.current.width + deltaX));
      const newHeight = Math.max(300, Math.min(800, resizeStartRef.current.height + deltaY));
      
      setSize({
        width: newWidth,
        height: newHeight
      });
    };

    const handleEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isResizing]);

  const unreadSuggestions = suggestions.filter(s => !s.isRead);
  
  // Incluir também as sugestões recém-marcadas (para mostrar animação de "FEITO")
  const recentlyMarkedSuggestions = suggestions.filter(s => 
    s.isRead && (s.justMarkedAsRead || recentlyMarkedIds.has(s.id))
  );

  // DEBUG: Log quando props mudam
  useEffect(() => {
    console.log('[InterviewSuggestions] 📦 Props atualizadas:', {
      suggestionsLength: suggestions.length,
      recentlyMarkedIdsSize: recentlyMarkedIds.size,
      recentlyMarkedIdsArray: Array.from(recentlyMarkedIds),
    });
  }, [suggestions, recentlyMarkedIds]);

  // DEBUG: Log para verificar estado
  console.log('[InterviewSuggestions] 🎨 Renderizando:', {
    totalSuggestions: suggestions.length,
    unreadCount: unreadSuggestions.length,
    recentlyMarkedCount: recentlyMarkedSuggestions.length,
    recentlyMarkedIdsSize: recentlyMarkedIds.size,
    suggestions: suggestions.map(s => ({
      id: s.id.substring(0, 20),
      question: s.question.substring(0, 40),
      isRead: s.isRead,
      justMarkedAsRead: s.justMarkedAsRead,
      autoDetected: s.autoDetected
    }))
  });

  if (unreadSuggestions.length === 0 && recentlyMarkedSuggestions.length === 0 && !isGenerating) {
    return null;
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical':
        return darkMode ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-700 border-blue-300';
      case 'behavioral':
        return darkMode ? 'bg-purple-900/50 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-700 border-purple-300';
      case 'experience':
        return darkMode ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-700 border-green-300';
      case 'situational':
        return darkMode ? 'bg-orange-900/50 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-700 border-orange-300';
      default:
        return darkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'technical': return 'Técnica';
      case 'behavioral': return 'Comportamental';
      case 'experience': return 'Experiência';
      case 'situational': return 'Situacional';
      default: return category;
    }
  };

  const getPriorityIndicator = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />;
      case 'medium':
        return <span className="w-2 h-2 rounded-full bg-yellow-500" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  return (
    <div 
      ref={dragRef}
      className={`fixed z-40 transition-all duration-300 ${
        isMinimized ? 'h-auto' : ''
      } ${isDragging ? 'cursor-grabbing' : ''} ${isResizing ? 'cursor-nwse-resize' : ''}`}
      style={{
        top: `calc(5rem + ${position.y}px)`,
        right: `calc(1rem - ${position.x}px)`,
        width: `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100vh - 7rem)',
      }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 rounded-t-xl ${
          darkMode
            ? 'bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-700/50'
            : 'bg-gradient-to-r from-indigo-500 to-purple-500 border border-indigo-300'
        } ${isMinimized ? 'rounded-b-xl' : ''}`}
      >
        {/* Drag Handle */}
        <div
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 mr-1 text-white/60 hover:text-white/90 transition touch-none"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          title="Arrastar para mover"
        >
          <GripVertical size={16} />
        </div>
        
        <div 
          className="flex items-center gap-2 flex-1 cursor-pointer"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <Sparkles size={18} className="text-yellow-400" />
          <span className="text-white font-semibold text-sm">
            Assistente de Entrevista
          </span>
          {unreadSuggestions.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
              {unreadSuggestions.length}
            </span>
          )}
        </div>
        <button 
          className="text-white/80 hover:text-white transition"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          {isMinimized ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className={`rounded-b-xl overflow-hidden ${
          darkMode
            ? 'bg-gray-800/95 border border-t-0 border-purple-700/50'
            : 'bg-white/95 border border-t-0 border-indigo-300'
        }`}>
          {/* Topic */}
          <div className={`px-3 py-2 text-xs border-b ${
            darkMode ? 'bg-gray-700/50 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}>
            📋 {meetingTopic}
          </div>

          {/* Suggestions List */}
          <div 
            className="overflow-y-auto"
            style={{
              maxHeight: `calc(${size.height}px - 8rem)` // Altura total menos header e topic
            }}
          >
            {isGenerating && (
              <div className={`p-4 flex items-center gap-3 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm">Analisando conversa...</span>
              </div>
            )}

            {unreadSuggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className={`p-3 border-b last:border-b-0 transition-all ${
                  darkMode ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-100 hover:bg-gray-50'
                } ${index === 0 ? 'animate-slideIn' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {getPriorityIndicator(suggestion.priority)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getCategoryColor(suggestion.category)}`}>
                        {getCategoryLabel(suggestion.category)}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed ${
                      darkMode ? 'text-gray-200' : 'text-gray-700'
                    } ${expandedId === suggestion.id ? '' : 'line-clamp-2'}`}>
                      {suggestion.question}
                    </p>
                    {suggestion.question.length > 80 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expandedId === suggestion.id ? null : suggestion.id);
                        }}
                        className={`text-xs mt-1 ${
                          darkMode ? 'text-purple-400 hover:text-purple-300' : 'text-indigo-600 hover:text-indigo-700'
                        }`}
                      >
                        {expandedId === suggestion.id ? 'Ver menos' : 'Ver mais'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={() => onMarkAsRead(suggestion.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
                      darkMode
                        ? 'bg-green-900/50 text-green-400 hover:bg-green-900'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title="Marcar como lida"
                  >
                    <Check size={12} />
                    Feito
                  </button>
                  <button
                    onClick={() => onDismiss(suggestion.id)}
                    className={`p-1 rounded transition ${
                      darkMode
                        ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Dispensar"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Sugestões recém-marcadas automaticamente (com animação de FEITO piscando) */}
            {recentlyMarkedSuggestions.length > 0 && (
              <div className={`px-3 py-2 text-xs font-semibold ${
                darkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-50 text-green-700'
              }`}>
                ✓ Perguntas Realizadas
              </div>
            )}
            {recentlyMarkedSuggestions.map((suggestion) => (
              <div
                key={`marked-${suggestion.id}`}
                className={`p-3 border-b last:border-b-0 transition-all animate-feitoBlink ${
                  darkMode 
                    ? 'border-gray-700 bg-green-900/30' 
                    : 'border-gray-100 bg-green-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getCategoryColor(suggestion.category)}`}>
                        {getCategoryLabel(suggestion.category)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold animate-feitoBadge ${
                        darkMode 
                          ? 'bg-green-500 text-white' 
                          : 'bg-green-500 text-white'
                      }`}>
                        ✓ FEITO
                      </span>
                      {suggestion.autoDetected && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-600'
                        }`}>
                          Auto-detectado
                        </span>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed line-through opacity-70 ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {suggestion.question.length > 60 
                        ? suggestion.question.substring(0, 60) + '...' 
                        : suggestion.question}
                    </p>
                    <p className={`text-xs mt-1 ${
                      darkMode ? 'text-green-400' : 'text-green-600'
                    }`}>
                      Gerando follow-up...
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {unreadSuggestions.length === 0 && recentlyMarkedSuggestions.length === 0 && !isGenerating && (
              <div className={`p-6 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aguardando conversa para gerar sugestões...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resize Handle */}
      {!isMinimized && (
        <div
          className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize touch-none ${
            darkMode ? 'text-purple-400/50 hover:text-purple-400' : 'text-indigo-400/50 hover:text-indigo-600'
          }`}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          title="Arrastar para redimensionar"
        >
          <svg
            className="w-full h-full"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15l-6 6M21 9l-12 12" />
          </svg>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @keyframes feitoBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes feitoBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .animate-feitoBlink {
          animation: feitoBlink 0.8s ease-in-out 3;
        }
        .animate-feitoBadge {
          animation: feitoBadgePulse 0.5s ease-in-out 4;
        }
      `}</style>
    </div>
  );
}
