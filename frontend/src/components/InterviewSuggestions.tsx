import { useState } from 'react';
import { X, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { InterviewSuggestion } from '../services/interviewAIService';

interface InterviewSuggestionsProps {
  suggestions: InterviewSuggestion[];
  isGenerating: boolean;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  darkMode: boolean;
  meetingTopic: string;
}

export default function InterviewSuggestions({
  suggestions,
  isGenerating,
  onMarkAsRead,
  onDismiss,
  darkMode,
  meetingTopic,
}: InterviewSuggestionsProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const unreadSuggestions = suggestions.filter(s => !s.isRead);

  if (unreadSuggestions.length === 0 && !isGenerating) {
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
    <div className={`fixed top-20 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] transition-all duration-300 ${
      isMinimized ? 'h-auto' : 'max-h-[60vh]'
    }`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 rounded-t-xl cursor-pointer ${
          darkMode
            ? 'bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-700/50'
            : 'bg-gradient-to-r from-indigo-500 to-purple-500 border border-indigo-300'
        } ${isMinimized ? 'rounded-b-xl' : ''}`}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
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
        <button className="text-white/80 hover:text-white transition">
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
          <div className="max-h-[40vh] overflow-y-auto">
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

            {unreadSuggestions.length === 0 && !isGenerating && (
              <div className={`p-6 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aguardando conversa para gerar sugestões...</p>
              </div>
            )}
          </div>
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
      `}</style>
    </div>
  );
}
