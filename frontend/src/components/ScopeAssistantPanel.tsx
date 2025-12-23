import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Target,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Check,
  AlertCircle,
  HelpCircle,
  Layers,
  FileText,
  Trash2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  ScopeRequirement,
  ScopeFeature,
  ScopeSuggestion,
  ScopeSummary,
} from '../services/scopeAIService';

interface ScopeAssistantPanelProps {
  requirements: ScopeRequirement[];
  features: ScopeFeature[];
  suggestions: ScopeSuggestion[];
  summary: ScopeSummary | null;
  objective: string;
  isAnalyzing: boolean;
  darkMode: boolean;
  projectName: string;
  // Actions
  onClarifyRequirement: (id: string) => void;
  onConfirmRequirement: (id: string) => void;
  onRemoveRequirement: (id: string) => void;
  onUpdatePriority: (id: string, priority: ScopeRequirement['priority']) => void;
  onGroupIntoFeatures: () => void;
  onDismissSuggestion: (id: string) => void;
  onUpdateObjective: (objective: string) => void;
}

export default function ScopeAssistantPanel({
  requirements,
  features,
  suggestions,
  summary,
  objective,
  isAnalyzing,
  darkMode,
  projectName,
  onClarifyRequirement,
  onConfirmRequirement,
  onRemoveRequirement,
  onUpdatePriority,
  onGroupIntoFeatures,
  onDismissSuggestion,
  onUpdateObjective,
}: ScopeAssistantPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'requirements' | 'suggestions' | 'features'>('requirements');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [editingObjective, setEditingObjective] = useState(false);
  const [tempObjective, setTempObjective] = useState(objective);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Inicializar posição
  useEffect(() => {
    const savedPos = sessionStorage.getItem('scope_assistant_pos');
    if (savedPos) {
      try {
        setPosition(JSON.parse(savedPos));
      } catch { /* ignore */ }
    }
  }, []);

  // Salvar posição
  useEffect(() => {
    if (position.x !== 0 || position.y !== 0) {
      sessionStorage.setItem('scope_assistant_pos', JSON.stringify(position));
    }
  }, [position]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY, posX: position.x, posY: position.y };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      setPosition({ x: dragStartRef.current.posX + deltaX, y: dragStartRef.current.posY + deltaY });
    };
    const handleEnd = () => setIsDragging(false);
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'must-have': return darkMode ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-700 border-red-300';
      case 'should-have': return darkMode ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'nice-to-have': return darkMode ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-700 border-green-300';
      default: return darkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'functional': return '⚙️';
      case 'non-functional': return '📊';
      case 'technical': return '🔧';
      case 'business': return '💼';
      default: return '📋';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <Check size={12} className="text-green-500" />;
      case 'clarified': return <HelpCircle size={12} className="text-yellow-500" />;
      default: return <AlertCircle size={12} className="text-gray-400" />;
    }
  };

  const completeness = summary?.completeness || 0;

  return (
    <div
      ref={dragRef}
      className={`fixed z-40 w-96 max-w-[calc(100vw-2rem)] transition-all duration-300 ${
        isMinimized ? 'h-auto' : 'max-h-[70vh]'
      } ${isDragging ? 'cursor-grabbing' : ''}`}
      style={{ top: `calc(5rem + ${position.y}px)`, right: `calc(1rem - ${position.x}px)` }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between p-3 rounded-t-xl ${
        darkMode
          ? 'bg-gradient-to-r from-teal-900 to-cyan-900 border border-teal-700/50'
          : 'bg-gradient-to-r from-teal-500 to-cyan-500 border border-teal-300'
      } ${isMinimized ? 'rounded-b-xl' : ''}`}>
        <div
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 mr-1 text-white/60 hover:text-white/90 transition touch-none"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <GripVertical size={16} />
        </div>
        <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
          <Target size={18} className="text-white" />
          <span className="text-white font-semibold text-sm">Assistente de Escopo</span>
          {requirements.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold">
              {requirements.length}
            </span>
          )}
        </div>
        <button className="text-white/80 hover:text-white transition" onClick={() => setIsMinimized(!isMinimized)}>
          {isMinimized ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className={`rounded-b-xl overflow-hidden ${
          darkMode ? 'bg-gray-800/95 border border-t-0 border-teal-700/50' : 'bg-white/95 border border-t-0 border-teal-300'
        }`}>
          {/* Progress Bar */}
          <div className={`px-3 py-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Completude do Escopo
              </span>
              <span className={`text-xs font-bold ${
                completeness >= 70 ? 'text-green-500' : completeness >= 40 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {completeness}%
              </span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div
                className={`h-full transition-all duration-500 ${
                  completeness >= 70 ? 'bg-green-500' : completeness >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>

          {/* Objective */}
          <div className={`px-3 py-2 border-b ${darkMode ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                📎 Objetivo do Projeto
              </span>
              {!editingObjective && (
                <button
                  onClick={() => { setEditingObjective(true); setTempObjective(objective); }}
                  className={`text-xs ${darkMode ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'}`}
                >
                  Editar
                </button>
              )}
            </div>
            {editingObjective ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempObjective}
                  onChange={(e) => setTempObjective(e.target.value)}
                  className={`flex-1 text-xs px-2 py-1 rounded ${
                    darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'
                  } border`}
                  placeholder="Descreva o objetivo..."
                  autoFocus
                />
                <button
                  onClick={() => { onUpdateObjective(tempObjective); setEditingObjective(false); }}
                  className="px-2 py-1 bg-teal-500 text-white text-xs rounded hover:bg-teal-600"
                >
                  OK
                </button>
              </div>
            ) : (
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} ${!objective ? 'italic' : ''}`}>
                {objective || 'Aguardando detecção automática...'}
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className={`flex border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {[
              { key: 'requirements', label: 'Requisitos', count: requirements.length },
              { key: 'suggestions', label: 'Sugestões', count: suggestions.filter(s => !s.isRead).length },
              { key: 'features', label: 'Features', count: features.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 px-2 py-2 text-xs font-medium transition ${
                  activeTab === tab.key
                    ? darkMode ? 'text-teal-400 border-b-2 border-teal-400' : 'text-teal-600 border-b-2 border-teal-600'
                    : darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === tab.key
                      ? darkMode ? 'bg-teal-900 text-teal-300' : 'bg-teal-100 text-teal-700'
                      : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="max-h-[35vh] overflow-y-auto">
            {/* Analyzing indicator */}
            {isAnalyzing && (
              <div className={`p-3 flex items-center gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs">Analisando conversa...</span>
              </div>
            )}

            {/* Requirements Tab */}
            {activeTab === 'requirements' && (
              <div className="p-2 space-y-2">
                {requirements.length === 0 ? (
                  <div className={`p-4 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Layers size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Aguardando requisitos...</p>
                    <p className="text-[10px] mt-1">Fale sobre funcionalidades do sistema</p>
                  </div>
                ) : (
                  requirements.map((req) => (
                    <div
                      key={req.id}
                      className={`p-2 rounded-lg border ${
                        darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm">{getTypeIcon(req.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            {getStatusIcon(req.status)}
                            <span className={`text-xs font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                              {req.title}
                            </span>
                          </div>
                          <p className={`text-[10px] line-clamp-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {req.description}
                          </p>
                          <div className="flex items-center gap-1 mt-2">
                            <select
                              value={req.priority}
                              onChange={(e) => onUpdatePriority(req.id, e.target.value as ScopeRequirement['priority'])}
                              className={`text-[10px] px-1 py-0.5 rounded border ${getPriorityColor(req.priority)}`}
                            >
                              <option value="must-have">Must Have</option>
                              <option value="should-have">Should Have</option>
                              <option value="nice-to-have">Nice to Have</option>
                            </select>
                            {req.status === 'identified' && (
                              <button
                                onClick={() => onClarifyRequirement(req.id)}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  darkMode ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                Clarificar
                              </button>
                            )}
                            {req.status !== 'confirmed' && (
                              <button
                                onClick={() => onConfirmRequirement(req.id)}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                                }`}
                              >
                                Confirmar
                              </button>
                            )}
                            <button
                              onClick={() => onRemoveRequirement(req.id)}
                              className={`p-0.5 rounded ${darkMode ? 'text-red-400 hover:bg-red-900/50' : 'text-red-500 hover:bg-red-100'}`}
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {requirements.length >= 3 && features.length === 0 && (
                  <button
                    onClick={onGroupIntoFeatures}
                    className={`w-full p-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 ${
                      darkMode
                        ? 'bg-teal-900/50 text-teal-300 hover:bg-teal-900'
                        : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                    }`}
                  >
                    <Layers size={14} />
                    Agrupar em Features
                  </button>
                )}
              </div>
            )}

            {/* Suggestions Tab */}
            {activeTab === 'suggestions' && (
              <div className="p-2 space-y-2">
                {suggestions.filter(s => !s.isRead).length === 0 ? (
                  <div className={`p-4 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Nenhuma sugestão no momento</p>
                  </div>
                ) : (
                  suggestions.filter(s => !s.isRead).map((sug) => (
                    <div
                      key={sug.id}
                      className={`p-2 rounded-lg border ${
                        sug.type === 'warning'
                          ? darkMode ? 'bg-orange-900/30 border-orange-700' : 'bg-orange-50 border-orange-200'
                          : sug.type === 'question'
                          ? darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'
                          : darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm">
                          {sug.type === 'warning' ? '⚠️' : sug.type === 'question' ? '❓' : sug.type === 'recommendation' ? '💡' : '📝'}
                        </span>
                        <div className="flex-1">
                          <p className={`text-xs ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{sug.text}</p>
                          <p className={`text-[10px] mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{sug.context}</p>
                        </div>
                        <button
                          onClick={() => onDismissSuggestion(sug.id)}
                          className={`p-1 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Features Tab */}
            {activeTab === 'features' && (
              <div className="p-2 space-y-2">
                {features.length === 0 ? (
                  <div className={`p-4 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <FileText size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Nenhuma feature definida</p>
                    <p className="text-[10px] mt-1">Adicione requisitos e agrupe em features</p>
                  </div>
                ) : (
                  features.map((feat) => (
                    <div
                      key={feat.id}
                      className={`p-2 rounded-lg border ${darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <ChevronRight size={12} className={darkMode ? 'text-teal-400' : 'text-teal-600'} />
                        <span className={`text-xs font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          {feat.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          feat.complexity === 'high'
                            ? darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
                            : feat.complexity === 'medium'
                            ? darkMode ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                            : darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                        }`}>
                          {feat.complexity === 'high' ? 'Alta' : feat.complexity === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                      </div>
                      <p className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {feat.requirements.length} requisito(s)
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
