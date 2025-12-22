import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Clock, Brain, Gauge, AlertTriangle } from 'lucide-react';
import {
  InterviewAIConfig,
  DEFAULT_CONFIG,
  getInterviewConfig,
  saveInterviewConfig,
  resetInterviewConfig,
} from '../services/interviewConfigService';

interface InterviewAIConfigPanelProps {
  darkMode: boolean;
  userLogin: string;
}

export default function InterviewAIConfigPanel({ darkMode, userLogin }: InterviewAIConfigPanelProps) {
  const [config, setConfig] = useState<InterviewAIConfig>(DEFAULT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState<InterviewAIConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    setHasChanges(JSON.stringify(config) !== JSON.stringify(originalConfig));
  }, [config, originalConfig]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const loadedConfig = await getInterviewConfig(true);
      setConfig(loadedConfig);
      setOriginalConfig(loadedConfig);
    } catch (err) {
      setError('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    const result = await saveInterviewConfig(config, userLogin);
    
    if (result.success) {
      setSuccess('Configuração salva! Mudanças aplicadas em tempo real.');
      setOriginalConfig(config);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm('Restaurar configurações padrão? Esta ação não pode ser desfeita.')) return;
    
    setSaving(true);
    const result = await resetInterviewConfig(userLogin);
    
    if (result.success) {
      setConfig(DEFAULT_CONFIG);
      setOriginalConfig(DEFAULT_CONFIG);
      setSuccess('Configurações restauradas para o padrão');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Erro ao restaurar');
    }
    setSaving(false);
  };


  const updateConfig = (key: keyof InterviewAIConfig, value: number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className={`rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg p-8 text-center`}>
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg overflow-hidden`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain size={20} className="text-purple-500" />
          Configurações da IA de Entrevista
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
              darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <RotateCcw size={14} />
            Restaurar Padrão
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm ${
              hasChanges
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500 text-sm">
          ✓ {success}
        </div>
      )}

      <div className="p-6 space-y-8">
        {/* Timing Section */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <Clock size={16} className="text-blue-500" />
            Timing e Frequência
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigSlider
              darkMode={darkMode}
              label="Tempo entre sugestões"
              value={config.minTimeBetweenSuggestionsMs}
              min={1000}
              max={30000}
              step={1000}
              unit="ms"
              description="Intervalo mínimo entre novas sugestões"
              onChange={(v) => updateConfig('minTimeBetweenSuggestionsMs', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Delay de processamento"
              value={config.processDelayMs}
              min={100}
              max={3000}
              step={100}
              unit="ms"
              description="Tempo para processar resposta"
              onChange={(v) => updateConfig('processDelayMs', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Tamanho mínimo de resposta"
              value={config.minAnswerLength}
              min={20}
              max={200}
              step={10}
              unit="chars"
              description="Caracteres mínimos para considerar resposta"
              onChange={(v) => updateConfig('minAnswerLength', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Transcrições para follow-up"
              value={config.minTranscriptionsForFollowup}
              min={1}
              max={10}
              step={1}
              unit=""
              description="Mínimo de transcrições antes de gerar follow-up"
              onChange={(v) => updateConfig('minTranscriptionsForFollowup', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Máx. sugestões não lidas"
              value={config.maxUnreadSuggestions}
              min={1}
              max={15}
              step={1}
              unit=""
              description="Limite de sugestões pendentes"
              onChange={(v) => updateConfig('maxUnreadSuggestions', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Sugestões iniciais"
              value={config.initialSuggestionsCount}
              min={1}
              max={10}
              step={1}
              unit=""
              description="Perguntas geradas ao iniciar"
              onChange={(v) => updateConfig('initialSuggestionsCount', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Novas perguntas a cada N respostas"
              value={config.generateNewQuestionsEveryN}
              min={1}
              max={10}
              step={1}
              unit=""
              description="Frequência de novas perguntas técnicas"
              onChange={(v) => updateConfig('generateNewQuestionsEveryN', v)}
            />
          </div>
        </section>


        {/* Evaluation Section */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <Gauge size={16} className="text-orange-500" />
            Avaliação de Respostas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigSlider
              darkMode={darkMode}
              label="Peso das keywords"
              value={config.keywordMatchWeight}
              min={0}
              max={100}
              step={5}
              unit="%"
              description="Importância das palavras-chave na avaliação"
              onChange={(v) => updateConfig('keywordMatchWeight', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Bônus por tamanho"
              value={config.lengthBonusMax}
              min={0}
              max={50}
              step={5}
              unit="pts"
              description="Pontos extras por resposta elaborada"
              onChange={(v) => updateConfig('lengthBonusMax', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Bônus por exemplos"
              value={config.exampleBonus}
              min={0}
              max={50}
              step={5}
              unit="pts"
              description="Pontos extras por exemplos práticos"
              onChange={(v) => updateConfig('exampleBonus', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Bônus por estrutura"
              value={config.structureBonus}
              min={0}
              max={30}
              step={5}
              unit="pts"
              description="Pontos extras por resposta estruturada"
              onChange={(v) => updateConfig('structureBonus', v)}
            />
          </div>
        </section>

        {/* Thresholds Section */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <Settings size={16} className="text-green-500" />
            Thresholds de Qualidade
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConfigSlider
              darkMode={darkMode}
              label="Excelente"
              value={config.excellentThreshold}
              min={60}
              max={100}
              step={5}
              unit="pts"
              description="Score mínimo para 'Excelente'"
              onChange={(v) => updateConfig('excellentThreshold', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Bom"
              value={config.goodThreshold}
              min={40}
              max={90}
              step={5}
              unit="pts"
              description="Score mínimo para 'Bom'"
              onChange={(v) => updateConfig('goodThreshold', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Básico"
              value={config.basicThreshold}
              min={20}
              max={70}
              step={5}
              unit="pts"
              description="Score mínimo para 'Básico'"
              onChange={(v) => updateConfig('basicThreshold', v)}
            />
          </div>
        </section>

        {/* Toggles Section */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <Brain size={16} className="text-purple-500" />
            Comportamento
          </h3>
          <div className="space-y-3">
            <ConfigToggle
              darkMode={darkMode}
              label="Follow-up automático"
              description="Gerar perguntas de acompanhamento automaticamente após cada resposta"
              checked={config.enableAutoFollowUp}
              onChange={(v) => updateConfig('enableAutoFollowUp', v)}
            />
            <ConfigToggle
              darkMode={darkMode}
              label="Avaliação técnica"
              description="Avaliar respostas comparando com respostas esperadas e keywords"
              checked={config.enableTechnicalEvaluation}
              onChange={(v) => updateConfig('enableTechnicalEvaluation', v)}
            />
          </div>
        </section>

        {/* Info */}
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border`}>
          <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
            <strong>💡 Dica:</strong> As mudanças são aplicadas em tempo real para todas as entrevistas ativas. 
            Não é necessário recarregar a página.
          </p>
        </div>
      </div>
    </div>
  );
}


// Componente de Slider
interface ConfigSliderProps {
  darkMode: boolean;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
  onChange: (value: number) => void;
}

function ConfigSlider({ darkMode, label, value, min, max, step, unit, description, onChange }: ConfigSliderProps) {
  return (
    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <label className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          {label}
        </label>
        <span className={`text-sm font-mono ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        {description}
      </p>
    </div>
  );
}

// Componente de Toggle
interface ConfigToggleProps {
  darkMode: boolean;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ConfigToggle({ darkMode, label, description, checked, onChange }: ConfigToggleProps) {
  return (
    <div 
      className={`p-3 rounded-lg flex items-center justify-between cursor-pointer ${
        darkMode ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
      }`}
      onClick={() => onChange(!checked)}
    >
      <div>
        <p className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          {label}
        </p>
        <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {description}
        </p>
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors ${
        checked 
          ? 'bg-green-500' 
          : darkMode ? 'bg-gray-600' : 'bg-gray-300'
      }`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </div>
    </div>
  );
}
