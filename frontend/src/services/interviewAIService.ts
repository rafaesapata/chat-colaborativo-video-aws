/**
 * Serviço de IA para gerar perguntas de entrevista usando Bedrock AI
 * v4.0.0 - Geração dinâmica e inteligente baseada no contexto real da vaga
 * SEM HARDCODING - Todas as perguntas são geradas pela IA
 */

import { getCurrentConfig, getInterviewConfig } from './interviewConfigService';
import { authService } from './authService';

const API_URL = import.meta.env.VITE_CHIME_API_URL || import.meta.env.VITE_API_URL || '';

export interface InterviewSuggestion {
  id: string;
  question: string;
  category: 'technical' | 'behavioral' | 'experience' | 'situational' | 'followup';
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
  isRead: boolean;
  context?: string;
  relatedTo?: string;
  expectedTopics?: string[]; // Tópicos esperados na resposta
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  technology?: string; // Tecnologia específica da pergunta
  justMarkedAsRead?: boolean; // Flag para animação de "FEITO" piscando
  autoDetected?: boolean; // Se foi detectado automaticamente na transcrição
}

export interface QuestionAnswer {
  questionId: string;
  question: string;
  answer: string;
  timestamp: number;
  category: string;
  answerQuality: 'excellent' | 'good' | 'basic' | 'incomplete' | 'incorrect';
  keyTopics: string[];
  technicalAccuracy?: number; // 0-100
  feedback?: string; // Feedback sobre a resposta
}

export interface InterviewContext {
  meetingType: 'ENTREVISTA' | 'REUNIAO' | 'TREINAMENTO' | 'OUTRO' | 'ESCOPO';
  topic: string;
  jobDescription?: string;
  transcriptionHistory: string[];
  questionsAsked: QuestionAnswer[];
  candidateName?: string;
}

// Tipo para relatório de entrevista (compatibilidade)
export interface InterviewReport {
  overallScore: number;
  recommendation: {
    decision: string;
    status: string;
    title: string;
    description: string;
    details: string[];
  };
  strengths: string[];
  improvements: string[];
  technicalAnalysis: {
    mentionedTechnologies: string[];
    relevantTechnologies?: string[];
    area: string;
    score: number;
    depth: string;
    description: string;
    alignment?: number;
  };
  softSkills: Array<{
    name: string;
    score: number;
    description: string;
  }>;
  jobTechnologies: string[];
  seniorityLevel: {
    level: 'junior' | 'pleno' | 'senior';
    description: string;
  };
  topic: string;
  candidateName: string;
  generatedAt: string;
  transcriptionCount: number;
  candidateResponseCount?: number;
  questionsAskedCount?: number;
  summary?: string;
  scoreBreakdown?: {
    technicalScore: number;
    softSkillsAvg: number;
    experienceScore: number;
    communicationScore: number;
    weights: {
      technical: number;
      softSkills: number;
      experience: number;
      communication: number;
    };
  };
}

// Cache para evitar chamadas duplicadas
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 segundos

/**
 * Limpa cache expirado
 */
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      requestCache.delete(key);
    }
  }
}

/**
/**
 * §8 FIX: Include roomId in cache key to prevent cross-session data leakage
 */
async function callInterviewAI(action: string, context: InterviewContext, params: any = {}): Promise<any> {
  const roomId = params.roomId || context.topic || '';
  const cacheKey = `${action}_${roomId}_${JSON.stringify({ topic: context.topic, jobDescription: context.jobDescription?.substring(0, 100), ...params })}`;
  
  // Verificar cache (não usar cache para relatórios)
  if (action !== 'generateReport') {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[InterviewAI] Usando resposta em cache para:', action);
      return cached.data;
    }
  }
  
  cleanExpiredCache();
  
  try {
    console.log('[InterviewAI] Chamando API:', action, { 
      topic: context.topic, 
      hasJobDescription: !!context.jobDescription,
      transcriptionsCount: context.transcriptionHistory.length,
      questionsCount: context.questionsAsked.length
    });
    
    // §9 FIX: Cap transcriptions for reports to prevent timeout on large payloads
    const transcriptionsToSend = action === 'generateReport' 
      ? context.transcriptionHistory.slice(-150) // Cap at last 150 to prevent Lambda timeout
      : context.transcriptionHistory.slice(-10); // Últimas 10 para outras ações
    
    // §2.1 FIX: Add Authorization header for authenticated requests
    const auth = authService.getStoredAuth();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }

    const response = await fetch(`${API_URL}/interview/ai`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        context: {
          meetingType: context.meetingType,
          topic: context.topic,
          jobDescription: context.jobDescription,
          transcriptionHistory: transcriptionsToSend,
          questionsAsked: context.questionsAsked.map(qa => ({
            question: qa.question,
            answer: qa.answer, // Incluir resposta para relatório
            answerQuality: qa.answerQuality,
            category: qa.category
          })),
          candidateName: context.candidateName
        },
        ...params
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[InterviewAI] Erro na resposta:', response.status, errorText);
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    // Armazenar em cache (exceto relatórios)
    if (action !== 'generateReport') {
      requestCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    
    return result;
    
  } catch (error: any) {
    console.error('[InterviewAI] Erro ao chamar API:', error);
    throw error;
  }
}

/**
 * Detectar se uma pergunta sugerida foi feita na transcrição
 * MELHORADO: Mais sensível e inteligente para detectar variações
 * Usa threshold configurável via painel de configurações
 */
export function detectAskedQuestion(
  transcriptionText: string,
  suggestions: InterviewSuggestion[]
): InterviewSuggestion | null {
  const textLower = transcriptionText.toLowerCase().trim();
  
  // Obter threshold configurável (padrão 25%)
  const config = getCurrentConfig();
  const similarityThreshold = (config.questionSimilarityThreshold || 25) / 100;
  
  // Palavras-chave que indicam uma pergunta (expandido)
  const questionIndicators = [
    'pode me', 'poderia me', 'me conte', 'me fale', 'me explique', 'me diga',
    'qual', 'quais', 'como', 'o que', 'por que', 'porque', 'quando', 'onde',
    'descreva', 'explique', 'conte sobre', 'fale sobre', 'gostaria', 'você pode',
    'você poderia', 'tem como', 'consegue', 'sabe', 'conhece'
  ];
  
  // Verificar se o texto parece ser uma pergunta
  const isQuestion = questionIndicators.some(ind => textLower.includes(ind)) || textLower.includes('?');
  if (!isQuestion) return null;
  
  let bestMatch: { suggestion: InterviewSuggestion; score: number } | null = null;
  
  // Procurar por sugestões não lidas que correspondam
  for (const suggestion of suggestions) {
    if (suggestion.isRead) continue;
    
    // 1. SIMILARIDADE GERAL (usa threshold configurável)
    const similarity = calculateSimilarity(transcriptionText, suggestion.question);
    
    if (similarity > similarityThreshold) {
      const score = similarity;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { suggestion, score };
      }
    }
    
    // 2. KEYWORDS MATCH (threshold = similarityThreshold + 5%)
    const keywordThreshold = similarityThreshold + 0.05;
    const questionKeywords = suggestion.question
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3); // Palavras com 4+ caracteres
    
    const matchedKeywords = questionKeywords.filter(kw => textLower.includes(kw));
    const keywordMatch = matchedKeywords.length / Math.max(questionKeywords.length, 1);
    
    if (keywordMatch > keywordThreshold) {
      const score = keywordMatch * 0.9; // Peso um pouco menor que similaridade
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { suggestion, score };
      }
    }
    
    // 3. CONCEITOS-CHAVE (detectar conceitos técnicos importantes)
    const technicalTerms = extractTechnicalTerms(suggestion.question);
    if (technicalTerms.length > 0) {
      const matchedTerms = technicalTerms.filter(term => textLower.includes(term.toLowerCase()));
      const termMatch = matchedTerms.length / technicalTerms.length;
      
      // Se mencionar 50%+ dos termos técnicos, é provável ser a mesma pergunta
      if (termMatch >= 0.5) {
        const score = 0.7 + (termMatch * 0.3); // Score entre 0.7 e 1.0
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { suggestion, score };
        }
      }
    }
    
    // 4. INTENÇÃO DA PERGUNTA (detectar intenção similar)
    const intentMatch = calculateIntentSimilarity(transcriptionText, suggestion.question);
    if (intentMatch > 0.4) {
      const score = intentMatch * 0.85;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { suggestion, score };
      }
    }
  }
  
  // Retornar melhor match se score >= threshold configurado
  if (bestMatch && bestMatch.score >= similarityThreshold) {
    console.log(`[InterviewAI] 🎯 Pergunta detectada! Score: ${(bestMatch.score * 100).toFixed(0)}% (threshold: ${(similarityThreshold * 100).toFixed(0)}%)`);
    console.log(`  Transcrição: "${transcriptionText.substring(0, 80)}..."`);
    console.log(`  Sugestão: "${bestMatch.suggestion.question.substring(0, 80)}..."`);
    return bestMatch.suggestion;
  }
  
  return null;
}

/**
 * Extrai termos técnicos importantes de uma pergunta
 */
function extractTechnicalTerms(question: string): string[] {
  const techKeywords = [
    // Linguagens
    'javascript', 'typescript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin',
    // Frameworks/Libs
    'react', 'vue', 'angular', 'node', 'express', 'django', 'flask', 'spring', 'laravel',
    // Conceitos
    'api', 'rest', 'graphql', 'microservices', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
    'database', 'sql', 'nosql', 'mongodb', 'postgresql', 'redis', 'git', 'ci/cd', 'agile', 'scrum',
    'hooks', 'components', 'state', 'props', 'context', 'redux', 'async', 'promise', 'callback',
    'class', 'function', 'arrow', 'closure', 'prototype', 'inheritance', 'polymorphism',
    'test', 'tdd', 'unit', 'integration', 'e2e', 'jest', 'cypress', 'selenium'
  ];
  
  const questionLower = question.toLowerCase();
  return techKeywords.filter(term => questionLower.includes(term));
}

/**
 * Calcula similaridade de intenção entre duas perguntas
 */
function calculateIntentSimilarity(text1: string, text2: string): number {
  const t1 = text1.toLowerCase().trim();
  const t2 = text2.toLowerCase().trim();
  
  // Extrair verbos de ação (intenção da pergunta)
  const actionVerbs = [
    'explique', 'descreva', 'conte', 'fale', 'diga', 'mostre', 'demonstre',
    'compare', 'diferencie', 'liste', 'mencione', 'cite', 'exemplifique'
  ];
  
  const verbs1 = actionVerbs.filter(v => t1.includes(v));
  const verbs2 = actionVerbs.filter(v => t2.includes(v));
  
  // Se ambos têm o mesmo verbo de ação, aumenta similaridade
  const commonVerbs = verbs1.filter(v => verbs2.includes(v));
  if (commonVerbs.length > 0) {
    return 0.6; // Intenção similar
  }
  
  // Verificar se ambos perguntam sobre o mesmo conceito
  const concepts1 = extractTechnicalTerms(text1);
  const concepts2 = extractTechnicalTerms(text2);
  
  if (concepts1.length > 0 && concepts2.length > 0) {
    const commonConcepts = concepts1.filter(c => concepts2.includes(c));
    if (commonConcepts.length > 0) {
      return 0.5 + (commonConcepts.length / Math.max(concepts1.length, concepts2.length)) * 0.3;
    }
  }
  
  return 0;
}

/**
 * Calcula similaridade entre duas strings
 * MELHORADO: Mais inteligente para detectar variações
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Verificar se uma contém a outra (aumentado de 0.8 para 0.9)
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Remover stop words comuns para melhor comparação
  const stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'na', 'no', 'para', 'com', 'por', 'sobre', 'sua', 'seu'];
  
  const words1 = s1.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w)); // Reduzido de 3 para 2
  const words2 = s2.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Contar palavras em comum (com match parcial melhorado)
  let matchCount = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      // Match exato
      if (w1 === w2) {
        matchCount += 1;
        break;
      }
      // Match parcial (uma palavra contém a outra)
      if (w1.length >= 4 && w2.length >= 4) {
        if (w1.includes(w2) || w2.includes(w1)) {
          matchCount += 0.8; // Peso um pouco menor para match parcial
          break;
        }
      }
      // Match de raiz (primeiras 4 letras iguais)
      if (w1.length >= 4 && w2.length >= 4 && w1.substring(0, 4) === w2.substring(0, 4)) {
        matchCount += 0.6;
        break;
      }
    }
  }
  
  // Calcular similaridade (Jaccard melhorado)
  const similarity = (matchCount * 2) / (words1.length + words2.length);
  
  return Math.min(similarity, 1); // Garantir que não ultrapasse 1
}

/**
 * Serviço principal de IA para entrevistas
 */
export const interviewAIService = {
  /**
   * Gera perguntas iniciais baseadas no contexto da vaga
   * Usa IA generativa - SEM HARDCODING
   */
  async generateSuggestions(context: InterviewContext, count: number = 3): Promise<InterviewSuggestion[]> {
    if (context.meetingType !== 'ENTREVISTA') {
      return [];
    }

    try {
      const result = await callInterviewAI('generateInitialQuestions', context, { count });
      
      if (!result.questions || !Array.isArray(result.questions)) {
        console.error('[InterviewAI] Resposta inválida:', result);
        return [];
      }
      
      console.log(`[InterviewAI] ${result.questions.length} perguntas geradas pela IA`);
      return result.questions;
      
    } catch (error: any) {
      console.error('[InterviewAI] Erro ao gerar perguntas:', error);
      // Retornar array vazio em caso de erro
      return [];
    }
  },

  /**
   * Gera pergunta de follow-up baseada na resposta do candidato
   * Usa IA para análise contextual
   */
  async generateFollowUp(lastResponse: string, context: InterviewContext): Promise<InterviewSuggestion | null> {
    if (context.meetingType !== 'ENTREVISTA' || !lastResponse || lastResponse.length < 30) {
      return null;
    }

    try {
      const result = await callInterviewAI('generateFollowUp', context, { lastAnswer: lastResponse });
      
      if (!result.questions || result.questions.length === 0) {
        return null;
      }
      
      console.log('[InterviewAI] Follow-up gerado pela IA');
      return result.questions[0];
      
    } catch (error: any) {
      console.error('[InterviewAI] Erro ao gerar follow-up:', error);
      return null;
    }
  },

  /**
   * Processa transcrição e avalia resposta do candidato
   * Usa IA para avaliação semântica com configurações customizáveis
   */
  async processTranscription(
    transcription: string,
    context: InterviewContext,
    currentQuestion?: QuestionAnswer
  ): Promise<{ shouldGenerateFollowUp: boolean; evaluation?: any }> {
    if (!currentQuestion || transcription.length < 50) {
      return { shouldGenerateFollowUp: false };
    }

    try {
      // Buscar configurações de avaliação do painel de admin
      const config = getCurrentConfig();
      
      const evaluationConfig = {
        // Pesos de avaliação
        keywordMatchWeight: config.keywordMatchWeight,
        lengthBonusMax: config.lengthBonusMax,
        exampleBonus: config.exampleBonus,
        structureBonus: config.structureBonus,
        // Thresholds de qualidade
        excellentThreshold: config.excellentThreshold,
        goodThreshold: config.goodThreshold,
        basicThreshold: config.basicThreshold,
      };
      
      const result = await callInterviewAI('evaluateAnswer', context, { 
        lastAnswer: transcription,
        evaluationConfig // Passar configurações para a IA
      });
      
      console.log('[InterviewAI] Resposta avaliada pela IA:', result);
      
      // Atualizar qualidade da resposta
      if (currentQuestion && result.quality) {
        currentQuestion.answerQuality = result.quality;
        currentQuestion.feedback = result.feedback;
        currentQuestion.keyTopics = result.keyTopics || [];
        currentQuestion.technicalAccuracy = result.score;
      }
      
      // Gerar follow-up se resposta foi incompleta ou básica
      const shouldGenerateFollowUp = ['basic', 'incomplete'].includes(result.quality);
      
      return { shouldGenerateFollowUp, evaluation: result };
      
    } catch (error: any) {
      console.error('[InterviewAI] Erro ao processar transcrição:', error);
      return { shouldGenerateFollowUp: false };
    }
  },

  /**
   * Gera novas perguntas baseadas no progresso da entrevista
   * Usa IA para adaptar perguntas ao contexto
   */
  async generateNewQuestions(context: InterviewContext, count: number = 3): Promise<InterviewSuggestion[]> {
    if (context.meetingType !== 'ENTREVISTA') {
      return [];
    }

    try {
      const result = await callInterviewAI('generateNewQuestions', context, { count });
      
      if (!result.questions || !Array.isArray(result.questions)) {
        console.error('[InterviewAI] Resposta inválida:', result);
        return [];
      }
      
      console.log(`[InterviewAI] ${result.questions.length} novas perguntas geradas pela IA`);
      return result.questions;
      
    } catch (error: any) {
      console.error('[InterviewAI] Erro ao gerar novas perguntas:', error);
      return [];
    }
  },

  /**
   * Limpa o cache de requisições
   */
  clearCache() {
    requestCache.clear();
    console.log('[InterviewAI] Cache limpo');
  },

  /**
   * Gera relatório completo da entrevista usando IA
   * Busca configurações customizáveis do painel de admin
   */
  async generateInterviewReport(context: InterviewContext): Promise<InterviewReport> {
    if (context.meetingType !== 'ENTREVISTA') {
      console.warn('[InterviewAI] Relatório só disponível para entrevistas');
      return this._getEmptyReport(context);
    }

    try {
      console.log('[InterviewAI] Gerando relatório completo com IA...');
      
      // Buscar configurações atualizadas do servidor
      const config = await getInterviewConfig(true);
      
      // Extrair apenas as configurações de relatório para enviar
      const reportConfig = {
        reportApprovedThreshold: config.reportApprovedThreshold,
        reportApprovedWithReservationsThreshold: config.reportApprovedWithReservationsThreshold,
        reportNeedsSecondInterviewThreshold: config.reportNeedsSecondInterviewThreshold,
        reportTechnicalWeight: config.reportTechnicalWeight,
        reportSoftSkillsWeight: config.reportSoftSkillsWeight,
        reportExperienceWeight: config.reportExperienceWeight,
        reportCommunicationWeight: config.reportCommunicationWeight,
        reportSystemInstructions: config.reportSystemInstructions,
        reportEvaluationCriteria: config.reportEvaluationCriteria,
        reportSoftSkillsCriteria: config.reportSoftSkillsCriteria,
        reportSeniorityGuidelines: config.reportSeniorityGuidelines,
        reportRecommendationGuidelines: config.reportRecommendationGuidelines,
      };
      
      console.log('[InterviewAI] Usando configurações customizáveis:', {
        approvedThreshold: reportConfig.reportApprovedThreshold,
        technicalWeight: reportConfig.reportTechnicalWeight,
        hasCustomInstructions: !!reportConfig.reportSystemInstructions
      });
      
      const result = await callInterviewAI('generateReport', context, { reportConfig });
      
      if (!result.report) {
        console.error('[InterviewAI] Resposta inválida:', result);
        return this._getEmptyReport(context);
      }
      
      console.log('[InterviewAI] Relatório gerado com sucesso pela IA');
      return result.report;
      
    } catch (error: any) {
      console.error('[InterviewAI] Erro ao gerar relatório:', error);
      return this._getEmptyReport(context);
    }
  },

  /**
   * Retorna relatório vazio em caso de erro
   */
  _getEmptyReport(context: InterviewContext): InterviewReport {
    return {
      overallScore: 0,
      recommendation: { 
        decision: 'Pendente', 
        status: 'pending',
        title: 'Avaliação Pendente',
        description: 'Não foi possível gerar o relatório automaticamente',
        details: ['Relatório não disponível'] 
      },
      strengths: [],
      improvements: [],
      technicalAnalysis: { 
        mentionedTechnologies: [],
        area: 'Não avaliado',
        score: 0,
        depth: 'basic',
        description: 'Análise técnica não disponível'
      },
      softSkills: [],
      jobTechnologies: [],
      seniorityLevel: { 
        level: 'pleno',
        description: 'Nível não avaliado'
      },
      topic: context.topic || '',
      candidateName: context.candidateName || 'Candidato',
      generatedAt: new Date().toISOString(),
      transcriptionCount: context.transcriptionHistory.length,
      questionsAskedCount: context.questionsAsked.length
    };
  },

  getInterviewProgress(context: InterviewContext): any {
    console.warn('[InterviewAI] getInterviewProgress não implementado com IA');
    return { 
      progress: 0,
      questionsAsked: context.questionsAsked.length,
      totalQuestions: 10
    };
  }
};
