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

/**
 * Calcula a completude da entrevista baseado em cobertura e qualidade
 * Retorna um score de 0-100
 */
function calculateInterviewCompleteness(questionsAsked: QuestionAnswer[]): number {
  if (questionsAsked.length === 0) return 0;
  
  // 1. Cobertura de categorias (40%)
  const categories = new Set(questionsAsked.map(q => q.category));
  const categoryScore = Math.min((categories.size / 4) * 100, 100);
  
  // 2. Qualidade das respostas (35%)
  const qualityWeights: Record<string, number> = {
    'excellent': 100, 'good': 80, 'basic': 50, 'incomplete': 20, 'incorrect': 0
  };
  const answered = questionsAsked.filter(q => q.answer && q.answer.length > 20);
  let qualitySum = 0;
  answered.forEach(q => { qualitySum += qualityWeights[q.answerQuality] || 50; });
  const qualityScore = answered.length > 0 ? qualitySum / answered.length : 0;
  
  // 3. Profundidade (25%) - §7.3 FIX: require 8 questions for 100% (was 5)
  const depthScore = Math.min((questionsAsked.length / 8) * 100, 100);
  
  return (categoryScore * 0.40) + (qualityScore * 0.35) + (depthScore * 0.25);
}

/**
 * Verifica se uma pergunta é similar a outra (para evitar duplicatas)
 */
function isSimilarQuestion(q1: string, q2: string): boolean {
  const normalize = (s: string) => s.toLowerCase().trim();
  const n1 = normalize(q1);
  const n2 = normalize(q2);
  
  // Match exato
  if (n1 === n2) return true;
  
  // Uma contém a outra
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Similaridade por palavras-chave (50%+ de match)
  const words1 = n1.split(/\s+/).filter(w => w.length > 3);
  const words2 = n2.split(/\s+/).filter(w => w.length > 3);
  if (words1.length === 0 || words2.length === 0) return false;
  
  const commonWords = words1.filter(w => words2.some(w2 => w === w2 || w.includes(w2) || w2.includes(w)));
  const similarity = commonWords.length / Math.min(words1.length, words2.length);
  
  return similarity >= 0.5;
}

/**
 * Filtra perguntas que já foram feitas ou já existem nas sugestões
 * §19 NOTE: O(m × (n+k) × len²) due to isSimilarQuestion. Acceptable for n<30 typical interviews.
 * For larger datasets, consider pre-computing word sets or using a hash-based approach.
 */
function filterDuplicateQuestions(
  newQuestions: InterviewSuggestion[],
  existingSuggestions: InterviewSuggestion[],
  questionsAsked: QuestionAnswer[]
): InterviewSuggestion[] {
  return newQuestions.filter(newQ => {
    // Verificar contra sugestões existentes
    const existsInSuggestions = existingSuggestions.some(
      existing => isSimilarQuestion(existing.question, newQ.question)
    );
    if (existsInSuggestions) {
      console.log('[InterviewAssistant] ⏭️ Pergunta já existe nas sugestões:', newQ.question.substring(0, 50));
      return false;
    }
    
    // Verificar contra perguntas já feitas
    const alreadyAsked = questionsAsked.some(
      asked => isSimilarQuestion(asked.question, newQ.question)
    );
    if (alreadyAsked) {
      console.log('[InterviewAssistant] ⏭️ Pergunta já foi feita:', newQ.question.substring(0, 50));
      return false;
    }
    
    return true;
  });
}

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
  // §18 FIX: Limit processedTranscriptionsRef to prevent unbounded growth
  const processedTranscriptionsRef = useRef(new Set<string>());
  const MAX_PROCESSED_TRANSCRIPTIONS = 500;

  // §18 FIX: Helper to add to processedTranscriptionsRef with size limit
  const addToProcessed = (value: string) => {
    if (processedTranscriptionsRef.current.size >= MAX_PROCESSED_TRANSCRIPTIONS) {
      // Remove oldest entries (first 100) to make room
      const iterator = processedTranscriptionsRef.current.values();
      for (let i = 0; i < 100; i++) {
        const next = iterator.next();
        if (next.done) break;
        processedTranscriptionsRef.current.delete(next.value);
      }
    }
    processedTranscriptionsRef.current.add(value);
  };
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
          console.log('[InterviewAssistant] 💾 Salvando no DynamoDB:', {
            suggestions: newSuggestions.length,
            questionsAsked: newQuestionsAsked.length,
            suggestionsRead: newSuggestions.filter(s => s.isRead).length,
            suggestionsDetails: newSuggestions.map(s => ({
              id: s.id.substring(0, 15),
              question: s.question.substring(0, 30),
              isRead: s.isRead
            }))
          });
          
          // §17 FIX: Retry logic with localStorage backup on failure
          let lastError: Error | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
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
              console.log('[InterviewAssistant] ✅ Dados salvos no DynamoDB com sucesso');
              lastError = null;
              break;
            } catch (err: any) {
              lastError = err;
              console.warn(`[InterviewAssistant] ⚠️ Tentativa ${attempt + 1}/3 falhou:`, err.message);
              if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
          }
          
          if (lastError) {
            // Backup to localStorage as fallback
            try {
              localStorage.setItem(`interview_backup_${roomId}`, JSON.stringify({
                suggestions: newSuggestions,
                questionsAsked: newQuestionsAsked,
                savedAt: Date.now()
              }));
              console.warn('[InterviewAssistant] 💾 Backup salvo em localStorage após falha no DynamoDB');
            } catch { /* localStorage full or unavailable */ }
          }
        } catch (error) {
          console.error('[InterviewAssistant] ❌ Erro ao salvar dados:', error);
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
          
          console.log('[InterviewAssistant] 📥 Carregando dados do DynamoDB:', {
            suggestions: result.data.suggestions?.length || 0,
            questionsAsked: result.data.questionsAsked?.length || 0,
            suggestionsRead: result.data.suggestions?.filter(s => s.isRead).length || 0,
          });
          
          setSuggestions(result.data.suggestions || []);
          setQuestionsAsked(result.data.questionsAsked || []);

          result.data.questionsAsked?.forEach((qa) => {
            addToProcessed(qa.answer);
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
        console.log('[InterviewAssistant] 🎯 Pergunta detectada, aguardando confirmação...:', detectedSuggestion.question.substring(0, 50));
        
        // Marcar como processada para não detectar novamente
        addToProcessed(transKey);
        
        // DELAY antes de marcar como realizada (para dar tempo de confirmar)
        const detectionDelay = configRef.current.autoDetectionDelayMs || 3000;
        
        setTimeout(() => {
          console.log('[InterviewAssistant] ⏰ Confirmando detecção após delay:', detectedSuggestion.question.substring(0, 50));
          console.log('[InterviewAssistant] Speaker:', trans.speakerLabel, '| Entrevistador:', userName);
          
          // Verificar se a sugestão ainda existe e não foi marcada manualmente
          setSuggestions((prev) => {
            const currentSuggestion = prev.find(s => s.id === detectedSuggestion.id);
            
            // Se já foi marcada como lida (manualmente), não fazer nada
            if (!currentSuggestion || currentSuggestion.isRead) {
              console.log('[InterviewAssistant] ⏭️ Sugestão já foi marcada ou removida, ignorando');
              return prev;
            }
            
            console.log('[InterviewAssistant] 🔄 Marcando como realizada após delay');
            
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
              if (qa.some(q => q.questionId === detectedSuggestion.id)) return qa;
              const updatedQA = [...qa, newQA];
              saveDataToDynamoDB(updated, updatedQA);
              return updatedQA;
            });
            
            setRecentlyMarkedIds((prevIds) => {
              const newSet = new Set([...prevIds, detectedSuggestion.id]);
              return newSet;
            });
            
            // Remover animação após 5 segundos
            setTimeout(() => {
              setRecentlyMarkedIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(detectedSuggestion.id);
                return newSet;
              });
              
              setSuggestions((prev) => {
                const suggestion = prev.find(s => s.id === detectedSuggestion.id);
                if (!suggestion || !suggestion.isRead) return prev;
                
                return prev.map((s) =>
                  s.id === detectedSuggestion.id 
                    ? { ...s, justMarkedAsRead: false }
                    : s
                );
              });
            }, 5000);
            
            return updated;
          });
          
          // Gerar follow-up após mais um delay
          setTimeout(() => {
            if (configRef.current.enableAutoFollowUp) {
              const context: InterviewContext = {
                meetingType: meetingType as InterviewContext['meetingType'],
                topic,
                jobDescription,
                transcriptionHistory: transcriptions.filter(t => !t.isPartial).map((t) => t.transcribedText),
                questionsAsked: questionsAsked,
              };
              
              interviewAIService.generateFollowUp(trans.transcribedText, context)
                .then((followUp) => {
                  if (followUp) {
                    setSuggestions((prev) => {
                      const filtered = filterDuplicateQuestions([followUp], prev, questionsAsked);
                      if (filtered.length === 0) return prev;
                      
                      console.log('[InterviewAssistant] 🔄 Follow-up gerado:', followUp.question.substring(0, 50));
                      lastSuggestionTimeRef.current = Date.now();
                      const newSuggestions = [followUp, ...prev].slice(0, 10);
                      
                      setQuestionsAsked((qa) => {
                        saveDataToDynamoDB(newSuggestions, qa);
                        return qa;
                      });
                      
                      return newSuggestions;
                    });
                  }
                })
                .catch(console.error);
            }
          }, 2000);
          
        }, detectionDelay);
        
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

    unprocessed.forEach((t) => addToProcessed(t.transcribedText));

    const newAnswerLength = unprocessed.reduce((sum, t) => sum + t.transcribedText.length, 0);
    totalAnswerLengthRef.current += newAnswerLength;    if (finalTranscriptions.length < currentConfig.minTranscriptionsForFollowup) {
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
      // MAS só se a completude ainda não estiver muito alta (< 85%)
      const completenessForFollowUp = calculateInterviewCompleteness(updatedQA);
      
      if (cfg.enableAutoFollowUp && completenessForFollowUp < 85) {
        try {
          const followUp = await interviewAIService.generateFollowUp(lastResponse, context);

          if (followUp) {
            // Usar filtro de duplicatas (verifica sugestões existentes E perguntas já feitas)
            const filtered = filterDuplicateQuestions([followUp], suggestions, updatedQA);

            if (filtered.length > 0) {
              const currentUnread = suggestions.filter((s) => !s.isRead);
              if (currentUnread.length < cfg.maxUnreadSuggestions) {
                lastSuggestionTimeRef.current = Date.now();
                newSuggestions = [followUp, ...suggestions].slice(0, 10);
                suggestionAdded = true;
                console.log('[InterviewAssistant] Follow-up gerado:', followUp.question);
              }
            } else {
              console.log('[InterviewAssistant] ⏭️ Follow-up descartado (duplicata)');
            }
          }
        } catch (error) {
          console.error('[InterviewAssistant] Erro ao gerar follow-up:', error);
        }
      } else if (completenessForFollowUp >= 85) {
        console.log('[InterviewAssistant] ✅ Completude alta (' + Math.round(completenessForFollowUp) + '%), não gerando follow-up');
      }

      // Gerar novas perguntas a cada N respostas (configurável)
      // MAS só se a completude ainda não estiver alta (< 75%)
      const currentCompleteness = calculateInterviewCompleteness(updatedQA);
      const shouldGenerateMore = currentCompleteness < 75;
      
      if (!suggestionAdded && updatedQA.length > 0 && updatedQA.length % cfg.generateNewQuestionsEveryN === 0 && shouldGenerateMore) {
        try {
          const newSuggestionsFromAI = await interviewAIService.generateNewQuestions(context, 2);
          
          // Usar filtro de duplicatas (verifica sugestões existentes E perguntas já feitas)
          const uniqueNew = filterDuplicateQuestions(newSuggestionsFromAI, newSuggestions, updatedQA);

          if (uniqueNew.length > 0) {
            lastSuggestionTimeRef.current = Date.now();
            newSuggestions = [...uniqueNew, ...newSuggestions].slice(0, 10);
            console.log('[InterviewAssistant] Novas perguntas geradas:', uniqueNew.length);
          } else {
            console.log('[InterviewAssistant] ⏭️ Todas as novas perguntas eram duplicatas');
          }
        } catch (error) {
          console.error('[InterviewAssistant] Erro ao gerar novas perguntas:', error);
        }
      } else if (!shouldGenerateMore) {
        console.log('[InterviewAssistant] ✅ Completude alta (' + Math.round(currentCompleteness) + '%), não gerando mais perguntas');
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
        
        // Atualizar suggestions com isRead: true
        const updatedSuggestions = prev.map((s) =>
          s.id === suggestionId ? { ...s, isRead: true } : s
        );
        
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
            // §7.1 FIX: Check for duplicate QA entries before adding
            if (qa.some(q => q.questionId === suggestionId)) {
              saveDataToDynamoDB(updatedSuggestions, qa);
              return qa;
            }
            const updatedQA = [...qa, newQA];
            // Salvar ambos no DynamoDB
            saveDataToDynamoDB(updatedSuggestions, updatedQA);
            console.log('[InterviewAssistant] 📝 Pergunta marcada como lida e salva:', suggestionId.substring(0, 20));
            return updatedQA;
          });
        } else {
          // Se já estava lida, apenas salvar o estado atualizado
          saveDataToDynamoDB(updatedSuggestions, questionsAsked);
          console.log('[InterviewAssistant] 📝 Estado de leitura atualizado:', suggestionId.substring(0, 20));
        }
        
        return updatedSuggestions;
      });
    },
    [saveDataToDynamoDB, questionsAsked]
  );

  // Remover sugestão
  // §7.2 FIX: Use functional update for questionsAsked to avoid stale closure
  const dismissSuggestion = useCallback(
    (suggestionId: string) => {
      setSuggestions((prev) => {
        const newSuggestions = prev.filter((s) => s.id !== suggestionId);
        setQuestionsAsked((currentQA) => {
          saveDataToDynamoDB(newSuggestions, currentQA);
          return currentQA;
        });
        return newSuggestions;
      });
    },
    [saveDataToDynamoDB]
  );

  // Limpar sugestões lidas
  const clearReadSuggestions = useCallback(() => {
    setSuggestions((prev) => {
      const newSuggestions = prev.filter((s) => !s.isRead);
      setQuestionsAsked((currentQA) => {
        saveDataToDynamoDB(newSuggestions, currentQA);
        return currentQA;
      });
      return newSuggestions;
    });
  }, [saveDataToDynamoDB]);

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
