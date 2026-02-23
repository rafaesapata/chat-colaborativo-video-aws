/**
 * Serviço para gerenciar configurações da IA de Entrevista
 * Permite atualização em tempo real via polling
 */

const API_URL = import.meta.env.VITE_CHIME_API_URL || '';

// §2.1 FIX: Helper to get auth headers
function getAuthHeaders(): Record<string, string> {
  // Dynamic import to avoid circular dependency
  const stored = localStorage.getItem('videochat_auth') || sessionStorage.getItem('videochat_auth');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (stored) {
    try {
      const auth = JSON.parse(stored);
      if (auth?.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      }
    } catch { /* ignore */ }
  }
  return headers;
}

export interface InterviewAIConfig {
  // Timing
  minAnswerLength: number;
  minTimeBetweenSuggestionsMs: number;
  minTranscriptionsForFollowup: number;
  maxUnreadSuggestions: number;
  initialSuggestionsCount: number;
  cooldownAfterSuggestionMs: number;
  saveDebounceMs: number;
  processDelayMs: number;
  autoDetectionDelayMs: number; // Delay antes de marcar pergunta como detectada automaticamente
  
  // Avaliação
  keywordMatchWeight: number; // Peso das keywords na avaliação (0-100)
  lengthBonusMax: number; // Bonus máximo por tamanho
  exampleBonus: number; // Bonus por exemplos
  structureBonus: number; // Bonus por estrutura
  
  // Thresholds de qualidade
  excellentThreshold: number;
  goodThreshold: number;
  basicThreshold: number;
  
  // Detecção de perguntas
  questionSimilarityThreshold: number; // % de similaridade para considerar pergunta como lida (0-100)
  
  // Comportamento
  enableAutoFollowUp: boolean;
  enableTechnicalEvaluation: boolean;
  generateNewQuestionsEveryN: number; // A cada N respostas, gerar novas perguntas
  
  // ============ CONFIGURAÇÕES DE RELATÓRIO ============
  // Thresholds de recomendação
  reportApprovedThreshold: number; // Score mínimo para "Aprovado" (0-100)
  reportApprovedWithReservationsThreshold: number; // Score mínimo para "Aprovado com ressalvas" (0-100)
  reportNeedsSecondInterviewThreshold: number; // Score mínimo para "Necessita segunda entrevista" (0-100)
  
  // Pesos de avaliação do relatório
  reportTechnicalWeight: number; // Peso da avaliação técnica (0-100)
  reportSoftSkillsWeight: number; // Peso das soft skills (0-100)
  reportExperienceWeight: number; // Peso da experiência (0-100)
  reportCommunicationWeight: number; // Peso da comunicação (0-100)
  
  // Instruções customizáveis para a IA
  reportSystemInstructions: string; // Instruções gerais para geração do relatório
  reportEvaluationCriteria: string; // Critérios de avaliação técnica
  reportSoftSkillsCriteria: string; // Critérios de avaliação de soft skills
  reportSeniorityGuidelines: string; // Diretrizes para determinar senioridade
  reportRecommendationGuidelines: string; // Diretrizes para recomendação final
  
  // Modelo de IA
  aiModelId: string; // ID do modelo Bedrock (ex: 'amazon.nova-lite-v1:0')
  
  // Metadata
  lastUpdated?: number;
  updatedBy?: string;
}

// Configuração padrão
export const DEFAULT_CONFIG: InterviewAIConfig = {
  minAnswerLength: 50,
  minTimeBetweenSuggestionsMs: 8000, // Aumentado de 5s para 8s
  minTranscriptionsForFollowup: 1,
  maxUnreadSuggestions: 5,
  initialSuggestionsCount: 3,
  cooldownAfterSuggestionMs: 10000, // Aumentado de 8s para 10s
  saveDebounceMs: 2000,
  processDelayMs: 1000, // Aumentado de 500ms para 1s
  autoDetectionDelayMs: 3000, // 3 segundos de delay antes de marcar como detectada
  
  keywordMatchWeight: 60,
  lengthBonusMax: 20,
  exampleBonus: 15,
  structureBonus: 5,
  
  excellentThreshold: 80,
  goodThreshold: 60,
  basicThreshold: 40,
  
  questionSimilarityThreshold: 25, // 25% de similaridade para detectar pergunta como lida
  
  enableAutoFollowUp: true,
  enableTechnicalEvaluation: true,
  generateNewQuestionsEveryN: 3,
  
  // ============ CONFIGURAÇÕES DE RELATÓRIO ============
  reportApprovedThreshold: 75,
  reportApprovedWithReservationsThreshold: 55,
  reportNeedsSecondInterviewThreshold: 40,
  
  reportTechnicalWeight: 40,
  reportSoftSkillsWeight: 25,
  reportExperienceWeight: 20,
  reportCommunicationWeight: 15,
  
  reportSystemInstructions: `Você é um especialista em recrutamento técnico com vasta experiência em avaliação de candidatos.
Sua análise deve ser:
- Objetiva e baseada em evidências das respostas
- Construtiva, destacando pontos fortes e áreas de melhoria
- Alinhada com os requisitos específicos da vaga
- Justa e imparcial, considerando o contexto das respostas`,

  reportEvaluationCriteria: `Critérios de Avaliação Técnica:
1. Correção conceitual: O candidato demonstra conhecimento correto dos conceitos?
2. Profundidade: As respostas são superficiais ou demonstram domínio do assunto?
3. Aplicação prática: O candidato consegue relacionar teoria com prática?
4. Atualização: O conhecimento está atualizado com as práticas do mercado?
5. Resolução de problemas: Demonstra capacidade de análise e solução?`,

  reportSoftSkillsCriteria: `Critérios de Avaliação de Soft Skills:
1. Comunicação: Clareza, objetividade e articulação das ideias
2. Trabalho em equipe: Menções a colaboração e experiências em grupo
3. Adaptabilidade: Capacidade de lidar com mudanças e novos desafios
4. Proatividade: Iniciativa e autonomia demonstradas
5. Pensamento crítico: Capacidade de análise e questionamento`,

  reportSeniorityGuidelines: `Diretrizes para Determinar Senioridade:
- JÚNIOR: Conhecimento básico, necessita supervisão, foco em aprendizado
- PLENO: Conhecimento sólido, autonomia moderada, resolve problemas comuns
- SÊNIOR: Conhecimento avançado, alta autonomia, mentoria, decisões arquiteturais`,

  reportRecommendationGuidelines: `Diretrizes para Recomendação:
- APROVADO (75%+): Atende ou supera os requisitos, pronto para contribuir
- APROVADO COM RESSALVAS (55-74%): Potencial, mas precisa de desenvolvimento em áreas específicas
- SEGUNDA ENTREVISTA (40-54%): Inconclusivo, necessita avaliação adicional
- NÃO APROVADO (<40%): Não atende aos requisitos mínimos da vaga`,

  // Modelo de IA
  aiModelId: 'amazon.nova-lite-v1:0',
};


// Cache local da configuração
let cachedConfig: InterviewAIConfig = { ...DEFAULT_CONFIG };
let lastFetchTime = 0;
const CACHE_TTL_MS = 5000; // Revalidar a cada 5 segundos

// Listeners para mudanças de configuração
type ConfigListener = (config: InterviewAIConfig) => void;
const listeners: Set<ConfigListener> = new Set();

/**
 * Registra um listener para mudanças de configuração
 */
export function subscribeToConfigChanges(listener: ConfigListener): () => void {
  listeners.add(listener);
  // Notificar imediatamente com config atual
  listener(cachedConfig);
  
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Notifica todos os listeners sobre mudança de configuração
 */
function notifyListeners(config: InterviewAIConfig) {
  listeners.forEach(listener => {
    try {
      listener(config);
    } catch (e) {
      console.error('[InterviewConfig] Erro ao notificar listener:', e);
    }
  });
}

/**
 * Obtém a configuração atual (do cache ou do servidor)
 */
export async function getInterviewConfig(forceRefresh = false): Promise<InterviewAIConfig> {
  const now = Date.now();
  
  // Usar cache se ainda válido
  if (!forceRefresh && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }
  
  try {
    const response = await fetch(`${API_URL}/interview/config/get`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      console.warn('[InterviewConfig] Erro ao buscar config, usando default');
      return cachedConfig;
    }
    
    const result = await response.json();
    
    if (result.config) {
      const newConfig = { ...DEFAULT_CONFIG, ...result.config };
      
      // Verificar se houve mudança
      const configChanged = JSON.stringify(newConfig) !== JSON.stringify(cachedConfig);
      
      cachedConfig = newConfig;
      lastFetchTime = now;
      
      // Notificar listeners se houve mudança
      if (configChanged) {
        console.log('[InterviewConfig] Configuração atualizada:', newConfig);
        notifyListeners(newConfig);
      }
    }
    
    return cachedConfig;
  } catch (error) {
    console.error('[InterviewConfig] Erro ao buscar configuração:', error);
    return cachedConfig;
  }
}

/**
 * Salva a configuração no servidor
 */
export async function saveInterviewConfig(
  config: Partial<InterviewAIConfig>,
  userLogin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/interview/config/save`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        userLogin,
        config: {
          ...config,
          lastUpdated: Date.now(),
          updatedBy: userLogin,
        },
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return { success: false, error: result.error || 'Erro ao salvar configuração' };
    }
    
    // Atualizar cache local
    cachedConfig = { ...cachedConfig, ...config, lastUpdated: Date.now(), updatedBy: userLogin };
    lastFetchTime = Date.now();
    
    // Notificar listeners
    notifyListeners(cachedConfig);
    
    return { success: true };
  } catch (error: any) {
    console.error('[InterviewConfig] Erro ao salvar:', error);
    return { success: false, error: error.message || 'Erro de conexão' };
  }
}

/**
 * Reseta a configuração para os valores padrão
 */
export async function resetInterviewConfig(
  userLogin: string
): Promise<{ success: boolean; error?: string }> {
  return saveInterviewConfig(DEFAULT_CONFIG, userLogin);
}

/**
 * Obtém a configuração atual do cache (síncrono)
 */
export function getCurrentConfig(): InterviewAIConfig {
  return cachedConfig;
}

/**
 * Inicia polling para verificar mudanças de configuração
 * §16 FIX: Exponential backoff on errors
 */
let pollingInterval: NodeJS.Timeout | null = null;
let pollingErrorCount = 0;
const MAX_POLLING_INTERVAL = 60000; // Max 60s between polls

export function startConfigPolling(intervalMs = 5000): void {
  if (pollingInterval) return;
  
  const poll = () => {
    getInterviewConfig(true)
      .then(() => {
        pollingErrorCount = 0; // Reset on success
        // Schedule next poll at normal interval
        pollingInterval = setTimeout(poll, intervalMs);
      })
      .catch((err) => {
        console.error('[InterviewConfig] Polling error:', err);
        pollingErrorCount++;
        // Exponential backoff: intervalMs * 2^errorCount, capped at MAX_POLLING_INTERVAL
        const backoffMs = Math.min(intervalMs * Math.pow(2, pollingErrorCount), MAX_POLLING_INTERVAL);
        pollingInterval = setTimeout(poll, backoffMs);
      });
  };
  
  pollingInterval = setTimeout(poll, intervalMs);
  console.log('[InterviewConfig] Polling iniciado');
}

export function stopConfigPolling(): void {
  if (pollingInterval) {
    clearTimeout(pollingInterval);
    pollingInterval = null;
    pollingErrorCount = 0;
    console.log('[InterviewConfig] Polling parado');
  }
}
