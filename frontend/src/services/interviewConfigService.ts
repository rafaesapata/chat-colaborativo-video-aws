/**
 * Serviço para gerenciar configurações da IA de Entrevista
 * Permite atualização em tempo real via polling
 */

const API_URL = import.meta.env.VITE_CHIME_API_URL || '';

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
  
  // Avaliação
  keywordMatchWeight: number; // Peso das keywords na avaliação (0-100)
  lengthBonusMax: number; // Bonus máximo por tamanho
  exampleBonus: number; // Bonus por exemplos
  structureBonus: number; // Bonus por estrutura
  
  // Thresholds de qualidade
  excellentThreshold: number;
  goodThreshold: number;
  basicThreshold: number;
  
  // Comportamento
  enableAutoFollowUp: boolean;
  enableTechnicalEvaluation: boolean;
  generateNewQuestionsEveryN: number; // A cada N respostas, gerar novas perguntas
  
  // Metadata
  lastUpdated?: number;
  updatedBy?: string;
}

// Configuração padrão
export const DEFAULT_CONFIG: InterviewAIConfig = {
  minAnswerLength: 50,
  minTimeBetweenSuggestionsMs: 5000,
  minTranscriptionsForFollowup: 1,
  maxUnreadSuggestions: 5,
  initialSuggestionsCount: 3,
  cooldownAfterSuggestionMs: 8000,
  saveDebounceMs: 2000,
  processDelayMs: 500,
  
  keywordMatchWeight: 60,
  lengthBonusMax: 20,
  exampleBonus: 15,
  structureBonus: 5,
  
  excellentThreshold: 80,
  goodThreshold: 60,
  basicThreshold: 40,
  
  enableAutoFollowUp: true,
  enableTechnicalEvaluation: true,
  generateNewQuestionsEveryN: 3,
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
 */
let pollingInterval: NodeJS.Timeout | null = null;

export function startConfigPolling(intervalMs = 5000): void {
  if (pollingInterval) return;
  
  pollingInterval = setInterval(() => {
    getInterviewConfig(true).catch(console.error);
  }, intervalMs);
  
  console.log('[InterviewConfig] Polling iniciado');
}

export function stopConfigPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[InterviewConfig] Polling parado');
  }
}
