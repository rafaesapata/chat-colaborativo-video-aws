import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Clock, Brain, Gauge, AlertTriangle, FileText, Scale, MessageSquare } from 'lucide-react';
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


  const updateConfig = (key: keyof InterviewAIConfig, value: number | boolean | string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className={`rounded-xl ${darkMode ? 'bg-card-dark' : 'bg-white'} shadow-lg p-8 text-center`}>
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className={darkMode ? 'text-muted-dark' : 'text-muted-light'}>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl ${darkMode ? 'bg-card-dark' : 'bg-white'} shadow-lg overflow-hidden`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${darkMode ? 'border-border-dark' : 'border-border-light'} flex items-center justify-between`}>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain size={20} className="text-primary" />
          Configurações da IA de Entrevista
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
              darkMode ? 'bg-white/5 hover:bg-white/15' : 'bg-black/5 hover:bg-black/5'
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
                : darkMode ? 'bg-white/5 text-muted-light' : 'bg-black/5 text-muted-dark'
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
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
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
            <ConfigSlider
              darkMode={darkMode}
              label="Delay de detecção automática"
              value={config.autoDetectionDelayMs}
              min={1000}
              max={10000}
              step={500}
              unit="ms"
              description="Tempo antes de marcar pergunta como detectada"
              onChange={(v) => updateConfig('autoDetectionDelayMs', v)}
            />
          </div>
        </section>


        {/* Evaluation Section */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
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
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
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

        {/* Detecção de Perguntas Section */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
            <Brain size={16} className="text-cyan-500" />
            Detecção de Perguntas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigSlider
              darkMode={darkMode}
              label="Similaridade para detecção"
              value={config.questionSimilarityThreshold}
              min={10}
              max={80}
              step={5}
              unit="%"
              description="% mínimo de similaridade para marcar pergunta como lida"
              onChange={(v) => updateConfig('questionSimilarityThreshold', v)}
            />
          </div>
          <p className={`text-xs mt-3 ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>
            💡 Valores mais baixos detectam perguntas com mais facilidade (mais sensível). 
            Valores mais altos exigem maior correspondência entre a fala e a pergunta sugerida.
          </p>
        </section>

        {/* Toggles Section */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
            <Brain size={16} className="text-primary" />
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

        {/* ============ CONFIGURAÇÕES DE RELATÓRIO ============ */}
        <div className={`border-t ${darkMode ? 'border-border-dark' : 'border-border-light'} pt-6 mt-6`}>
          <h2 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-foreground-light'}`}>
            <FileText size={20} className="text-primary" />
            Configurações de Relatório de Entrevista
          </h2>
        </div>

        {/* Modelo de IA */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
            <Brain size={16} className="text-primary" />
            Modelo de IA
          </h3>
          <div className="space-y-2">
            <label className={`block text-sm ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
              Selecione o modelo Bedrock para geração de perguntas e relatórios
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'amazon.nova-lite-v1:0', name: 'Amazon Nova Lite', desc: 'Rápido e econômico. Disponível sem EULA.', cost: '$0.06/1M input' },
                { id: 'us.anthropic.claude-3-5-haiku-20241022-v1:0', name: 'Claude 3.5 Haiku', desc: 'Melhor qualidade em PT-BR. Requer ativação no Bedrock.', cost: '$0.80/1M input' },
              ].map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => updateConfig('aiModelId', model.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    config.aiModelId === model.id
                      ? 'border-primary bg-primary/10'
                      : darkMode ? 'border-border-dark hover:border-border-dark' : 'border-border-light hover:border-border-light'
                  }`}
                >
                  <div className={`font-medium text-sm ${darkMode ? 'text-foreground-dark' : 'text-foreground-light'}`}>
                    {model.name}
                    {config.aiModelId === model.id && <span className="ml-2 text-primary">✓</span>}
                  </div>
                  <div className={`text-xs mt-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>{model.desc}</div>
                  <div className={`text-xs mt-1 ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>{model.cost}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Thresholds de Recomendação */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
            <Scale size={16} className="text-primary" />
            Thresholds de Recomendação
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConfigSlider
              darkMode={darkMode}
              label="Aprovado"
              value={config.reportApprovedThreshold}
              min={50}
              max={100}
              step={5}
              unit="%"
              description="Score mínimo para 'Aprovado'"
              onChange={(v) => updateConfig('reportApprovedThreshold', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Aprovado c/ Ressalvas"
              value={config.reportApprovedWithReservationsThreshold}
              min={30}
              max={80}
              step={5}
              unit="%"
              description="Score mínimo para 'Aprovado com ressalvas'"
              onChange={(v) => updateConfig('reportApprovedWithReservationsThreshold', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Segunda Entrevista"
              value={config.reportNeedsSecondInterviewThreshold}
              min={20}
              max={60}
              step={5}
              unit="%"
              description="Score mínimo para 'Necessita segunda entrevista'"
              onChange={(v) => updateConfig('reportNeedsSecondInterviewThreshold', v)}
            />
          </div>
          <p className={`text-xs mt-3 ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>
            💡 Candidatos abaixo do threshold de "Segunda Entrevista" serão marcados como "Não Aprovado"
          </p>
        </section>

        {/* Pesos de Avaliação */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
            <Gauge size={16} className="text-amber-500" />
            Pesos de Avaliação (devem somar 100%)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigSlider
              darkMode={darkMode}
              label="Habilidades Técnicas"
              value={config.reportTechnicalWeight}
              min={0}
              max={100}
              step={5}
              unit="%"
              description="Peso da avaliação técnica no score final"
              onChange={(v) => updateConfig('reportTechnicalWeight', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Soft Skills"
              value={config.reportSoftSkillsWeight}
              min={0}
              max={100}
              step={5}
              unit="%"
              description="Peso das habilidades interpessoais"
              onChange={(v) => updateConfig('reportSoftSkillsWeight', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Experiência"
              value={config.reportExperienceWeight}
              min={0}
              max={100}
              step={5}
              unit="%"
              description="Peso da experiência profissional"
              onChange={(v) => updateConfig('reportExperienceWeight', v)}
            />
            <ConfigSlider
              darkMode={darkMode}
              label="Comunicação"
              value={config.reportCommunicationWeight}
              min={0}
              max={100}
              step={5}
              unit="%"
              description="Peso da clareza e articulação"
              onChange={(v) => updateConfig('reportCommunicationWeight', v)}
            />
          </div>
          {(() => {
            const total = config.reportTechnicalWeight + config.reportSoftSkillsWeight + 
                         config.reportExperienceWeight + config.reportCommunicationWeight;
            const isValid = total === 100;
            return (
              <div className={`mt-3 p-2 rounded-lg text-sm ${
                isValid 
                  ? darkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-50 text-green-700'
                  : darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-700'
              }`}>
                {isValid ? '✓' : '⚠️'} Total: {total}% {!isValid && '(deve ser 100%)'}
              </div>
            );
          })()}
        </section>

        {/* Instruções Customizáveis */}
        <section>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
            <MessageSquare size={16} className="text-cyan-500" />
            Instruções para a IA (Prompts Customizáveis)
          </h3>
          <div className="space-y-4">
            <ConfigTextArea
              darkMode={darkMode}
              label="Instruções Gerais do Sistema"
              value={config.reportSystemInstructions}
              placeholder="Instruções gerais para a IA ao gerar relatórios..."
              description="Define o tom e abordagem geral da IA na avaliação"
              onChange={(v) => updateConfig('reportSystemInstructions', v)}
            />
            <ConfigTextArea
              darkMode={darkMode}
              label="Critérios de Avaliação Técnica"
              value={config.reportEvaluationCriteria}
              placeholder="Critérios para avaliar conhecimento técnico..."
              description="Como a IA deve avaliar as competências técnicas"
              onChange={(v) => updateConfig('reportEvaluationCriteria', v)}
            />
            <ConfigTextArea
              darkMode={darkMode}
              label="Critérios de Soft Skills"
              value={config.reportSoftSkillsCriteria}
              placeholder="Critérios para avaliar habilidades interpessoais..."
              description="Como a IA deve avaliar soft skills"
              onChange={(v) => updateConfig('reportSoftSkillsCriteria', v)}
            />
            <ConfigTextArea
              darkMode={darkMode}
              label="Diretrizes de Senioridade"
              value={config.reportSeniorityGuidelines}
              placeholder="Como determinar o nível de senioridade..."
              description="Critérios para classificar júnior, pleno ou sênior"
              onChange={(v) => updateConfig('reportSeniorityGuidelines', v)}
            />
            <ConfigTextArea
              darkMode={darkMode}
              label="Diretrizes de Recomendação"
              value={config.reportRecommendationGuidelines}
              placeholder="Como formular a recomendação final..."
              description="Critérios para a decisão final de aprovação"
              onChange={(v) => updateConfig('reportRecommendationGuidelines', v)}
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
    <div className={`p-3 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-black/3'}`}>
      <div className="flex items-center justify-between mb-1">
        <label className={`text-sm font-medium ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
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
        className="w-full h-2 bg-black/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
      <p className={`text-xs mt-1 ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>
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
        darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-black/3 hover:bg-black/5'
      }`}
      onClick={() => onChange(!checked)}
    >
      <div>
        <p className={`text-sm font-medium ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
          {label}
        </p>
        <p className={`text-xs ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>
          {description}
        </p>
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors ${
        checked 
          ? 'bg-green-500' 
          : darkMode ? 'bg-white/10' : 'bg-black/10'
      }`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </div>
    </div>
  );
}

// Componente de TextArea para instruções customizáveis
interface ConfigTextAreaProps {
  darkMode: boolean;
  label: string;
  value: string;
  placeholder: string;
  description: string;
  onChange: (value: string) => void;
}

function ConfigTextArea({ darkMode, label, value, placeholder, description, onChange }: ConfigTextAreaProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={`p-3 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-black/3'}`}>
      <div className="flex items-center justify-between mb-2">
        <label className={`text-sm font-medium ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`text-xs px-2 py-1 rounded ${
            darkMode ? 'bg-white/10 hover:bg-black/30 text-foreground-dark' : 'bg-black/5 hover:bg-black/10 text-muted-light'
          }`}
        >
          {isExpanded ? 'Recolher' : 'Expandir'}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={isExpanded ? 8 : 3}
        className={`w-full px-3 py-2 rounded-lg text-sm resize-none transition-all ${
          darkMode 
            ? 'bg-card-dark border-border-dark text-foreground-dark placeholder-muted-light' 
            : 'bg-white border-border-light text-foreground-light placeholder-muted-dark'
        } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
      />
      <p className={`text-xs mt-1 ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>
        {description}
      </p>
    </div>
  );
}
