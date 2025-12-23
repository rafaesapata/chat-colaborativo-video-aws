import { useState, useEffect, useCallback, useRef } from 'react';
import {
  scopeAIService,
  ScopeRequirement,
  ScopeFeature,
  ScopeSuggestion,
  ScopeSummary,
} from '../services/scopeAIService';

interface UseScopeAssistantProps {
  isEnabled: boolean;
  meetingType: string;
  projectName: string;
  transcriptions: Array<{
    transcribedText: string;
    speakerLabel?: string;
    isPartial?: boolean;
    timestamp?: number;
  }>;
  roomId?: string;
}

export function useScopeAssistant({
  isEnabled,
  meetingType,
  projectName,
  transcriptions,
  roomId,
}: UseScopeAssistantProps) {
  const [requirements, setRequirements] = useState<ScopeRequirement[]>([]);
  const [features, setFeatures] = useState<ScopeFeature[]>([]);
  const [suggestions, setSuggestions] = useState<ScopeSuggestion[]>([]);
  const [summary, setSummary] = useState<ScopeSummary | null>(null);
  const [objective, setObjective] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const lastTranscriptionCountRef = useRef(0);
  const processedTextsRef = useRef(new Set<string>());
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Analisar novas transcrições
  useEffect(() => {
    if (!isEnabled || meetingType !== 'ESCOPO') {
      return;
    }

    const finalTranscriptions = transcriptions.filter((t) => !t.isPartial);
    
    if (finalTranscriptions.length <= lastTranscriptionCountRef.current) {
      return;
    }

    const newTranscriptions = finalTranscriptions.slice(lastTranscriptionCountRef.current);
    lastTranscriptionCountRef.current = finalTranscriptions.length;

    // Processar novas transcrições
    newTranscriptions.forEach((trans) => {
      const textKey = trans.transcribedText.substring(0, 50);
      if (processedTextsRef.current.has(textKey)) return;
      processedTextsRef.current.add(textKey);

      // Analisar com debounce
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }

      analysisTimeoutRef.current = setTimeout(() => {
        setIsAnalyzing(true);

        const { newRequirement, suggestion } = scopeAIService.analyzeTranscription(
          trans.transcribedText,
          requirements
        );

        if (newRequirement) {
          setRequirements((prev) => {
            const updated = [...prev, newRequirement];
            console.log('[ScopeAssistant] Novo requisito:', newRequirement.title);
            return updated;
          });
        }

        if (suggestion) {
          setSuggestions((prev) => {
            // Evitar duplicatas
            if (prev.some((s) => s.text === suggestion.text)) return prev;
            return [suggestion, ...prev].slice(0, 5);
          });
        }

        // Detectar objetivo se ainda não definido
        if (!objective && trans.transcribedText.length > 50) {
          const objectivePatterns = [
            /objetivo.*é|queremos.*criar|precisamos.*de.*um|vamos.*desenvolver|projeto.*é/i,
          ];
          if (objectivePatterns.some((p) => p.test(trans.transcribedText))) {
            setObjective(trans.transcribedText.substring(0, 200));
          }
        }

        setIsAnalyzing(false);
      }, 1000);
    });
  }, [transcriptions, isEnabled, meetingType, requirements, objective]);

  // Atualizar summary quando requisitos mudam
  useEffect(() => {
    if (!isEnabled || meetingType !== 'ESCOPO') return;

    const newSummary = scopeAIService.generateSummary(
      projectName,
      objective,
      requirements,
      features
    );
    setSummary(newSummary);

    // Gerar novas sugestões
    const newSuggestions = scopeAIService.generateSuggestions(newSummary, '');
    setSuggestions((prev) => {
      const existingTexts = new Set(prev.map((s) => s.text));
      const unique = newSuggestions.filter((s) => !existingTexts.has(s.text));
      return [...prev, ...unique].slice(0, 5);
    });
  }, [requirements, features, projectName, objective, isEnabled, meetingType]);

  // Marcar requisito como clarificado
  const clarifyRequirement = useCallback((reqId: string) => {
    setRequirements((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? { ...r, status: 'clarified' as const, questions: r.questions.slice(1) }
          : r
      )
    );
  }, []);

  // Confirmar requisito
  const confirmRequirement = useCallback((reqId: string) => {
    setRequirements((prev) =>
      prev.map((r) =>
        r.id === reqId ? { ...r, status: 'confirmed' as const } : r
      )
    );
  }, []);

  // Remover requisito
  const removeRequirement = useCallback((reqId: string) => {
    setRequirements((prev) => prev.filter((r) => r.id !== reqId));
  }, []);

  // Atualizar prioridade
  const updatePriority = useCallback(
    (reqId: string, priority: ScopeRequirement['priority']) => {
      setRequirements((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, priority } : r))
      );
    },
    []
  );

  // Agrupar em features
  const groupIntoFeatures = useCallback(() => {
    const newFeatures = scopeAIService.groupRequirementsIntoFeatures(requirements);
    setFeatures(newFeatures);
  }, [requirements]);

  // Marcar sugestão como lida
  const dismissSuggestion = useCallback((suggestionId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  }, []);

  // Exportar como markdown
  const exportMarkdown = useCallback(() => {
    if (!summary) return '';
    return scopeAIService.exportAsMarkdown(summary);
  }, [summary]);

  // Atualizar objetivo manualmente
  const updateObjective = useCallback((newObjective: string) => {
    setObjective(newObjective);
  }, []);

  // Adicionar requisito manualmente
  const addRequirement = useCallback((title: string, description: string) => {
    const newReq: ScopeRequirement = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      description,
      type: 'functional',
      priority: 'should-have',
      status: 'identified',
      relatedFeatures: [],
      questions: [],
      timestamp: Date.now(),
    };
    setRequirements((prev) => [...prev, newReq]);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, []);

  return {
    requirements,
    features,
    suggestions,
    summary,
    objective,
    isAnalyzing,
    // Actions
    clarifyRequirement,
    confirmRequirement,
    removeRequirement,
    updatePriority,
    groupIntoFeatures,
    dismissSuggestion,
    exportMarkdown,
    updateObjective,
    addRequirement,
  };
}
