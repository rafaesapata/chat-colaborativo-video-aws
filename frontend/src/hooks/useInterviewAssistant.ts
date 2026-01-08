import { useState, useEffect, useCallback, useRef } from 'react';
import {
  interviewAIService,
  InterviewSuggestion,
  InterviewContext,
  QuestionAnswer,
  detectAskedQuestion,
} from '../services/interviewAIService';
import {
  saveInterviewData,
  getInterviewData,
} from '../services/interviewDataService';
import {
  InterviewAIConfig,
  DEFAULT_CONFIG,
  subscribeToConfigChanges,
  getInterviewConfig,
  startConfigPolling,
  stopConfigPolling,
} from '../services/interviewConfigService';

interface UseInterviewAssistantProps {
  isEnabled: boolean;
  meetingType: string;
  topic: string;
  jobDescription?: string;
  transcriptions: Array<{
    transcribedText: string;
    speakerLabel?: string;
    isPartial?: boolean;
    timestamp?: number;
  }>;
  roomId?: string;
  userLogin?: string;
  userName?: string; // Nome do usuário autenticado (entrevistador) para filtrar transcrições
}

export function useInterviewAssistant({
  isEnabled,
  meetingType,
  topic,
  jobDescription,
  transcriptions,
  roomId,
  userLogin,
  userName,
}: UseInterviewAssistantProps) {
  const [suggestions, setSuggestions] = useState<InterviewSuggestion[]>([]);
  const [questionsAsked, setQuestionsAsked] = useState<QuestionAnswer[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recentlyMarkedIds, setRecentlyMarkedIds] = useState<Set<string>>(new Set());
  
  // Configuração dinâmica - atualizada em tempo real
  const [config, setConfig] = useState<InterviewAIConfig>(DEFAULT_CONFIG);

  const lastTranscriptionCountRef = useRef(0);
  const processedTranscriptionsRef = useRef(new Set<string>());
  const lastProcessedAnswerRef = useRef<string>('');
  const lastSuggestionTimeRef = useRef<number>(0);
  const totalAnswerLengthRef = useRef<number>(0);
  const isInitializedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dataLoadedRef = useRef(false);
  const configRef = useRef<InterviewAIConfig>(DEFAULT_CONFIG);

  // Manter ref atualizada com config
  useEffect(() => {
    configRef.current = config;
  }, [config]);


  // Carregar e escutar mudanças de configuração em tempo real
  useEffect(() => {
    if (!isEnabled) return;

    // Carregar configuração inicial
    getInterviewConfig().then(setConfig);

    // Iniciar polling para mudanças
    startConfigPolling(5000);

    // Escutar mudanças de configuração
    const unsubscribe = subscribeToConfigChanges((newConfig) => {
      console.log('[InterviewAssistant] Configuração atualizada em tempo real:', newConfig);
      setConfig(newConfig);
    });

    return () => {
      unsubscribe();
      stopConfigPolling();
    };
  }, [isEnabled]);

  // Função para salvar dados no DynamoDB com debounce
  const saveDataToDynamoDB = useCallback(
    (newSuggestions: InterviewSuggestion[], newQuestionsAsked: QuestionAnswer[]) => {
      if (!roomId) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await saveInterviewData(
            roomId,
            { 
              suggestions: newSuggestions, 
              questionsAsked: newQuestionsAsked,
              context: { topic, meetingType, jobDescription } // Salvar contexto
            },
            userLogin
          );
          console.log('[InterviewAssistant] Dados salvos no DynamoDB');
        } catch (error) {
          console.error('[InterviewAssistant] Erro ao salvar dados:', error);
        }
      }, configRef.current.saveDebounceMs);
    },
    [roomId, userLogin, topic, meetingType, jobDescription]
  );

  // Carregar dados do DynamoDB ao iniciar
  useEffect(() => {
    if (!isEnabled || !roomId || dataLoadedRef.current) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const result = await getInterviewData(roomId);
        if (result.exists && result.data) {
          console.log('[InterviewAssistant] Dados carregados do DynamoDB');
          
          // VALIDAR SE O CONTEXTO MUDOU
          // Se o topic ou meetingType mudou, não carregar dados antigos
          const contextChanged = 
            result.data.context?.topic !== topic ||
            result.data.context?.meetingType !== meetingType;
          
          if (contextChanged) {
            console.log('[InterviewAssistant] ⚠️ Contexto mudou, ignorando dados antigos');
            console.log('  Antigo:', result.data.context);
            console.log('  Novo:', { topic, meetingType });
            // Não carregar dados antigos, deixar vazio para gerar novos
            dataLoadedRef.current = true;
            setIsLoading(false);
            return;
          }
          
          setSuggestions(result.data.suggestions || []);
          setQuestionsAsked(result.data.questionsAsked || []);

          result.data.questionsAsked?.forEach((qa) => {
            processedTranscriptionsRef.current.add(qa.answer);
          });

          if (result.data.suggestions?.length > 0 || result.data.questionsAsked?.length > 0) {
            isInitializedRef.current = true;
          }
        }
        dataLoadedRef.current = true;
      } catch (error) {
        console.error('[InterviewAssistant] Erro ao carregar dados:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isEnabled, roomId, topic, meetingType]);

  // Gerar sugestões iniciais
  useEffect(() => {
    if (!isEnabled || meetingType !== 'ENTREVISTA' || !topic || isInitializedRef.current || isLoading) {
      return;
    }

    isInitializedRef.current = true;

    const context: InterviewContext = {
      meetingType: meetingType as InterviewContext['meetingType'],
      topic,
      jobDescription,
      transcriptionHistory: [],
      questionsAsked: [],
    };

    // Gerar perguntas iniciais usando IA (assíncrono)
    setIsGenerating(true);
    interviewAIService.generateSuggestions(context, configRef.current.initialSuggestionsCount)
      .then((initialSuggestions) => {
        setSuggestions(initialSuggestions);
        lastSuggestionTimeRef.current = Date.now();
        saveDataToDynamoDB(initialSuggestions, []);
      })
      .catch((error) => {
        console.error('[InterviewAssistant] Erro ao gerar perguntas iniciais:', error);
      })
      .finally(() => {
        setIsGenerating(false);
      });
  }, [isEnabled, meetingType, topic, jobDescription, isLoading, saveDataToDynamoDB]);

  // Detectar automaticamente quando o entrevistador faz uma pergunta sugerida
  // IMPORTANTE: Só considera transcrições do usuário autenticado (entrevistador)
  useEffect(() => {
    if (!isEnabled || meetingType !== 'ENTREVISTA' || isLoading || !userName) {
      return;
    }

    const finalTranscriptions = transcriptions.filter((t) => !t.isPartial);
    if (finalTranscriptions.length === 0) return;

    // FILTRAR: Apenas transcrições do entrevistador (usuário autenticado)
    // Comparar speakerLabel com userName (case-insensitive, parcial)
    const interviewerTranscriptions = finalTranscriptions.filter((t) => {
      if (!t.speakerLabel) return false;
      const speaker = t.speakerLabel.toLowerCase().trim();
      const interviewer = userName.toLowerCase().trim();
      // Verificar se o speaker contém o nome do entrevistador ou vice-versa
      return speaker.includes(interviewer) || 
             interviewer.includes(speaker.split(' ')[0]) ||
             speaker.split(' ')[0] === interviewer.split(' ')[0];
    });

    console.log('[InterviewAssistant] 🔍 Detecção automática:', {
      totalTranscriptions: finalTranscriptions.length,
      interviewerTranscriptions: interviewerTranscriptions.length,
      userName,
      unreadSuggestions: suggestions.filter(s => !s.isRead).length
    });

    if (interviewerTranscriptions.length === 0) {
      console.log('[InterviewAssistant] ⚠️ Nenhuma transcrição do entrevistador encontrada');
      return;
    }

    // Pegar as últimas 3 transcrições DO ENTREVISTADOR para verificar
    const recentTranscriptions = interviewerTranscriptions.slice(-3);
    
    for (const trans of recentTranscriptions) {
      // Verificar se essa transcrição já foi processada para detecção
      const transKey = `detected_${trans.transcribedText.substring(0, 50)}`;
      if (processedTranscriptionsRef.current.has(transKey)) {
        console.log('[InterviewAssistant] ⏭️ Transcrição já processada:', trans.transcribedText.substring(0, 50));
        continue;
      }
      
      console.log('[InterviewAssistant] 🔎 Analisando transcrição:', {
        speaker: trans.speakerLabel,
        text: trans.transcribedText.substring(0, 80) + '...'
      });
      
      // Detectar se alguma sugestão foi feita
      const detectedSuggestion = detectAskedQuestion(trans.transcribedText, suggestions);
      
      if (detectedSuggestion && !detectedSuggestion.isRead) {
        console.log('[InterviewAssistant] 🎯 Pergunta detectada automaticamente (entrevistador):', detectedSuggestion.question.substring(0, 50));
        console.log('[InterviewAssistant] Speaker:', trans.speakerLabel, '| Entrevistador:', userName);
        
        // Marcar como processada
        processedTranscriptionsRef.current.add(transKey);
        
        // Marcar a sugestão como lida com flag de animação
        setSuggestions((prev) => {
          const updated = prev.map((s) =>
            s.id === detectedSuggestion.id
              ? { ...s, isRead: true, justMarkedAsRead: true, autoDetected: true }
              : s
          );
          
          // Adicionar ao QA
          const newQA: QuestionAnswer = {
            questionId: detectedSuggestion.id,
            question: detectedSuggestion.question,
            answer: '',
            timestamp: Date.now(),
            category: detectedSuggestion.category,
            answerQuality: 'incomplete',
            keyTopics: [],
          };
          
          setQuestionsAsked((qa) => {
            // Evitar duplicatas
            if (qa.some(q => q.questionId === detectedSuggestion.id)) return qa;
            const updatedQA = [...qa, newQA];
            saveDataToDynamoDB(updated, updatedQA);
            return updatedQA;
          });
          
          // Adicionar ao set de recém-marcados para animação
          setRecentlyMarkedIds((prev) => new Set([...prev, detectedSuggestion.id]));
          
          // Remover da animação após 3 segundos
          setTimeout(() => {
            setRecentlyMarkedIds((prev) => {
              const newSet = new Set(prev);
              newSet.delete(detectedSuggestion.id);
              return newSet;
            });
            // Remover flag justMarkedAsRead
            setSuggestions((prev) =>
              prev.map((s) =>
                s.id === detectedSuggestion.id ? { ...s, justMarkedAsRead: false } : s
              )
            );
          }, 3000);
          
          return updated;
        });
        
        // Gerar follow-up automaticamente após detectar a pergunta
        setTimeout(() => {
          const context: InterviewContext = {
            meetingType: meetingType as InterviewContext['meetingType'],
            topic,
            jobDescription,
            transcriptionHistory: finalTranscriptions.map((t) => t.transcribedText),
            questionsAsked: questionsAsked,
          };
          
          if (configRef.current.enableAutoFollowUp) {
            interviewAIService.generateFollowUp(trans.transcribedText, context)
              .then((followUp) => {
                if (followUp) {
                  setSuggestions((prev) => {
                    const isDuplicate = prev.some(
                      (s) => s.question.toLowerCase() === followUp.question.toLowerCase()
                    );
                    if (isDuplicate) return prev;
                    
                    console.log('[InterviewAssistant] 🔄 Follow-up automático gerado:', followUp.question.substring(0, 50));
                    lastSuggestionTimeRef.current = Date.now();
                    const newSuggestions = [followUp, ...prev].slice(0, 10);
                    saveDataToDynamoDB(newSuggestions, questionsAsked);
                    return newSuggestions;
                  });
                }
              })
              .catch((error) => {
                console.error('[InterviewAssistant] Erro ao gerar follow-up automático:', error);
              });
          }
        }, 1500); // Delay para dar tempo de processar a resposta
        
        break; // Processar apenas uma detecção por vez
      } else if (detectedSuggestion && detectedSuggestion.isRead) {
        console.log('[InterviewAssistant] ℹ️ Pergunta já foi marcada como lida:', detectedSuggestion.question.substring(0, 50));
      } else {
        console.log('[InterviewAssistant] ❌ Nenhuma pergunta detectada nesta transcrição');
      }
    }
  }, [transcriptions, isEnabled, meetingType, isLoading, suggestions, questionsAsked, topic, jobDescription, saveDataToDynamoDB, userName]);

  // Monitorar transcrições - usa config dinâmica
  useEffect(() => {
    if (!isEnabled || meetingType !== 'ENTREVISTA' || !topic || isLoading) {
      return;
    }

    const currentConfig = configRef.current;
    const finalTranscriptions = transcriptions.filter((t) => !t.isPartial);

    if (finalTranscriptions.length <= lastTranscriptionCountRef.current) {
      return;
    }

    // Verificar cooldown usando config dinâmica
    const timeSinceLastSuggestion = Date.now() - lastSuggestionTimeRef.current;
    if (timeSinceLastSuggestion < currentConfig.minTimeBetweenSuggestionsMs) {
      lastTranscriptionCountRef.current = finalTranscriptions.length;
      return;
    }

    // Verificar limite de sugestões não lidas
    const unreadCount = suggestions.filter((s) => !s.isRead).length;
    if (unreadCount >= currentConfig.maxUnreadSuggestions) {
      lastTranscriptionCountRef.current = finalTranscriptions.length;
      return;
    }

    const newTranscriptions = finalTranscriptions.slice(lastTranscriptionCountRef.current);
    lastTranscriptionCountRef.current = finalTranscriptions.length;

    const unprocessed = newTranscriptions.filter(
      (t) => !processedTranscriptionsRef.current.has(t.transcribedText)
    );
    if (unprocessed.length === 0) return;

    unprocessed.forEach((t) => processedTranscriptionsRef.current.add(t.transcribedText));

    const newAnswerLength = unprocessed.reduce((sum, t) => sum + t.transcribedText.length, 0);
    totalAnswerLengthRef.current += newAnswerLength;

    if (finalTranscriptions.length < currentConfig.minTranscriptionsForFollowup) {
      return;
    }

    // Usar minAnswerLength da config
    const lastResponse = unprocessed
      .filter((t) => t.transcribedText.length >= currentConfig.minAnswerLength)
      .pop()?.transcribedText || '';

    if (!lastResponse || lastResponse === lastProcessedAnswerRef.current) {
      return;
    }

    lastProcessedAnswerRef.current = lastResponse;
    setIsGenerating(true);

    // Usar processDelayMs da config
    setTimeout(async () => {
      const cfg = configRef.current; // Pegar config mais recente
      
      const transcriptionsForProcessing = finalTranscriptions.map((t) => ({
        text: t.transcribedText,
        speaker: t.speakerLabel || 'Participante',
        timestamp: t.timestamp || Date.now(),
      }));

      // Processar transcrição e avaliar resposta (assíncrono)
      const context: InterviewContext = {
        meetingType: meetingType as InterviewContext['meetingType'],
        topic,
        jobDescription,
        transcriptionHistory: finalTranscriptions.map((t) => t.transcribedText),
        questionsAsked: questionsAsked,
      };

      let updatedQA = questionsAsked;
      const lastQA = questionsAsked[questionsAsked.length - 1];
      
      if (lastQA && cfg.enableTechnicalEvaluation) {
        try {
          const { evaluation } = await interviewAIService.processTranscription(
            lastResponse,
            context,
            lastQA
          );
          
          if (evaluation) {
            updatedQA = questionsAsked.map((qa, idx) => 
              idx === questionsAsked.length - 1 
                ? { ...qa, ...evaluation, answer: lastResponse }
                : qa
            );
            setQuestionsAsked(updatedQA);
          }
        } catch (error) {
          console.error('[InterviewAssistant] Erro ao avaliar resposta:', error);
        }
      }

      let newSuggestions = [...suggestions];
      let suggestionAdded = false;

      // Gerar follow-up se habilitado na config
      if (cfg.enableAutoFollowUp) {
        try {
          const followUp = await interviewAIService.generateFollowUp(lastResponse, context);

          if (followUp) {
            const isDuplicate = suggestions.some(
              (s) => s.question.toLowerCase() === followUp.question.toLowerCase()
            );

            if (!isDuplicate) {
              const currentUnread = suggestions.filter((s) => !s.isRead);
              if (currentUnread.length < cfg.maxUnreadSuggestions) {
                lastSuggestionTimeRef.current = Date.now();
                newSuggestions = [followUp, ...suggestions].slice(0, 10);
                suggestionAdded = true;
                console.log('[InterviewAssistant] Follow-up gerado:', followUp.question);
              }
            }
          }
        } catch (error) {
          console.error('[InterviewAssistant] Erro ao gerar follow-up:', error);
        }
      }

      // Gerar novas perguntas a cada N respostas (configurável)
      if (!suggestionAdded && updatedQA.length > 0 && updatedQA.length % cfg.generateNewQuestionsEveryN === 0) {
        try {
          const newSuggestionsFromAI = await interviewAIService.generateNewQuestions(context, 2);
          const existingQuestions = new Set(newSuggestions.map((s) => s.question.toLowerCase()));
          const uniqueNew = newSuggestionsFromAI.filter(
            (s) => !existingQuestions.has(s.question.toLowerCase())
          );

          if (uniqueNew.length > 0) {
            lastSuggestionTimeRef.current = Date.now();
            newSuggestions = [...uniqueNew, ...newSuggestions].slice(0, 10);
            console.log('[InterviewAssistant] Novas perguntas geradas:', uniqueNew.length);
          }
        } catch (error) {
          console.error('[InterviewAssistant] Erro ao gerar novas perguntas:', error);
        }
      }

      setSuggestions(newSuggestions);
      saveDataToDynamoDB(newSuggestions, updatedQA);
      setIsGenerating(false);
    }, currentConfig.processDelayMs);
  }, [
    transcriptions,
    isEnabled,
    meetingType,
    topic,
    jobDescription,
    questionsAsked,
    suggestions,
    isLoading,
    saveDataToDynamoDB,
  ]);


  // Marcar sugestão como lida
  const markAsRead = useCallback(
    (suggestionId: string) => {
      setSuggestions((prev) => {
        const suggestion = prev.find((s) => s.id === suggestionId);
        if (suggestion && !suggestion.isRead) {
          const newQA: QuestionAnswer = {
            questionId: suggestionId,
            question: suggestion.question,
            answer: '',
            timestamp: Date.now(),
            category: suggestion.category,
            answerQuality: 'incomplete',
            keyTopics: [],
          };
          setQuestionsAsked((qa) => {
            const updatedQA = [...qa, newQA];
            const updatedSuggestions = prev.map((s) =>
              s.id === suggestionId ? { ...s, isRead: true } : s
            );
            saveDataToDynamoDB(updatedSuggestions, updatedQA);
            return updatedQA;
          });
        }
        return prev.map((s) => (s.id === suggestionId ? { ...s, isRead: true } : s));
      });
    },
    [saveDataToDynamoDB]
  );

  // Remover sugestão
  const dismissSuggestion = useCallback(
    (suggestionId: string) => {
      setSuggestions((prev) => {
        const newSuggestions = prev.filter((s) => s.id !== suggestionId);
        saveDataToDynamoDB(newSuggestions, questionsAsked);
        return newSuggestions;
      });
    },
    [questionsAsked, saveDataToDynamoDB]
  );

  // Limpar sugestões lidas
  const clearReadSuggestions = useCallback(() => {
    setSuggestions((prev) => {
      const newSuggestions = prev.filter((s) => !s.isRead);
      saveDataToDynamoDB(newSuggestions, questionsAsked);
      return newSuggestions;
    });
  }, [questionsAsked, saveDataToDynamoDB]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Obter progresso
  const getProgress = useCallback(() => {
    const context: InterviewContext = {
      meetingType: meetingType as InterviewContext['meetingType'],
      topic,
      jobDescription,
      transcriptionHistory: transcriptions.filter((t) => !t.isPartial).map((t) => t.transcribedText),
      questionsAsked,
    };
    return interviewAIService.getInterviewProgress(context);
  }, [meetingType, topic, jobDescription, transcriptions, questionsAsked]);

  const unreadSuggestions = suggestions.filter((s) => !s.isRead);

  return {
    suggestions,
    unreadSuggestions,
    questionsAsked,
    isGenerating,
    isLoading,
    config, // Expor config atual para debug/UI
    recentlyMarkedIds, // IDs das sugestões recém-marcadas (para animação)
    markAsRead,
    dismissSuggestion,
    clearReadSuggestions,
    getProgress,
  };
}
