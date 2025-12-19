import { useState, useEffect, useCallback, useRef } from 'react';
import { interviewAIService, InterviewSuggestion, InterviewContext } from '../services/interviewAIService';

interface UseInterviewAssistantProps {
  isEnabled: boolean;
  meetingType: string;
  topic: string;
  transcriptions: Array<{ transcribedText: string; isPartial?: boolean }>;
}

export function useInterviewAssistant({
  isEnabled,
  meetingType,
  topic,
  transcriptions,
}: UseInterviewAssistantProps) {
  const [suggestions, setSuggestions] = useState<InterviewSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const lastTranscriptionCountRef = useRef(0);
  const processedTranscriptionsRef = useRef(new Set<string>());

  // Gerar sugestões iniciais quando a entrevista começar
  useEffect(() => {
    if (!isEnabled || meetingType !== 'ENTREVISTA' || !topic) {
      return;
    }

    // Gerar sugestões iniciais
    const context: InterviewContext = {
      meetingType: meetingType as InterviewContext['meetingType'],
      topic,
      transcriptionHistory: [],
    };

    const initialSuggestions = interviewAIService.generateSuggestions(context, 2);
    setSuggestions(initialSuggestions);
  }, [isEnabled, meetingType, topic]);

  // Monitorar transcrições e gerar novas sugestões
  useEffect(() => {
    if (!isEnabled || meetingType !== 'ENTREVISTA' || !topic) {
      return;
    }

    // Filtrar apenas transcrições finais (não parciais)
    const finalTranscriptions = transcriptions.filter(t => !t.isPartial);
    
    // Verificar se há novas transcrições
    if (finalTranscriptions.length <= lastTranscriptionCountRef.current) {
      return;
    }

    // Processar novas transcrições
    const newTranscriptions = finalTranscriptions.slice(lastTranscriptionCountRef.current);
    lastTranscriptionCountRef.current = finalTranscriptions.length;

    // Verificar se já processamos essas transcrições
    const unprocessed = newTranscriptions.filter(t => !processedTranscriptionsRef.current.has(t.transcribedText));
    if (unprocessed.length === 0) {
      return;
    }

    // Marcar como processadas
    unprocessed.forEach(t => processedTranscriptionsRef.current.add(t.transcribedText));

    setIsGenerating(true);

    // Simular delay de "pensamento" da IA
    setTimeout(() => {
      const context: InterviewContext = {
        meetingType: meetingType as InterviewContext['meetingType'],
        topic,
        transcriptionHistory: finalTranscriptions.map(t => t.transcribedText),
      };

      // Tentar gerar follow-up baseado na última resposta
      const lastResponse = unprocessed[unprocessed.length - 1]?.transcribedText;
      const followUp = interviewAIService.generateFollowUp(lastResponse, context);

      if (followUp) {
        setSuggestions(prev => {
          // Limitar a 5 sugestões não lidas
          const unreadCount = prev.filter(s => !s.isRead).length;
          if (unreadCount >= 5) {
            return prev;
          }
          return [followUp, ...prev];
        });
      }

      // A cada 5 transcrições, gerar novas sugestões gerais
      if (finalTranscriptions.length % 5 === 0) {
        const newSuggestions = interviewAIService.generateSuggestions(context, 2);
        setSuggestions(prev => {
          const existingQuestions = new Set(prev.map(s => s.question));
          const uniqueNew = newSuggestions.filter(s => !existingQuestions.has(s.question));
          return [...uniqueNew, ...prev].slice(0, 10); // Manter máximo de 10
        });
      }

      setIsGenerating(false);
    }, 1500);
  }, [transcriptions, isEnabled, meetingType, topic]);

  // Marcar sugestão como lida
  const markAsRead = useCallback((suggestionId: string) => {
    setSuggestions(prev =>
      prev.map(s =>
        s.id === suggestionId ? { ...s, isRead: true } : s
      )
    );
  }, []);

  // Remover sugestão
  const dismissSuggestion = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  // Limpar todas as sugestões lidas
  const clearReadSuggestions = useCallback(() => {
    setSuggestions(prev => prev.filter(s => !s.isRead));
  }, []);

  // Obter apenas sugestões não lidas
  const unreadSuggestions = suggestions.filter(s => !s.isRead);

  return {
    suggestions,
    unreadSuggestions,
    isGenerating,
    markAsRead,
    dismissSuggestion,
    clearReadSuggestions,
  };
}
