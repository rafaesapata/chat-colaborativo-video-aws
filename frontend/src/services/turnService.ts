/**
 * Serviço para obter credenciais TURN dinâmicas
 */

// URL da Lambda TURN (Function URL)
const TURN_API_URL = 'https://wuac3rstsdvwuqjbkyevqh73ne0ienpy.lambda-url.us-east-1.on.aws';
const CACHE_KEY = 'videochat_turn_credentials';
const CACHE_TTL = 3600000; // 1 hora em ms

interface TurnCredentials {
  iceServers: RTCIceServer[];
  ttl: number;
  timestamp: number;
}

interface CachedCredentials extends TurnCredentials {
  cachedAt: number;
}

// Credenciais fallback (servidores públicos)
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

export const turnService = {
  /**
   * Obtém credenciais TURN (do cache ou da API)
   */
  async getIceServers(userId?: string): Promise<RTCIceServer[]> {
    // Verificar cache
    const cached = this.getCachedCredentials();
    if (cached) {
      console.log('[TURN] Usando credenciais do cache');
      return cached.iceServers;
    }

    // Se não há API configurada, usar fallback
    if (!TURN_API_URL) {
      console.log('[TURN] API não configurada, usando fallback');
      return FALLBACK_ICE_SERVERS;
    }

    try {
      const response = await fetch(TURN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'anonymous' })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: TurnCredentials = await response.json();
      
      // Salvar no cache
      this.cacheCredentials(data);
      
      console.log('[TURN] Credenciais obtidas da API:', data.iceServers.length, 'servidores');
      return data.iceServers;

    } catch (error) {
      console.warn('[TURN] Erro ao obter credenciais, usando fallback:', error);
      return FALLBACK_ICE_SERVERS;
    }
  },

  /**
   * Obtém credenciais do cache se ainda válidas
   */
  getCachedCredentials(): CachedCredentials | null {
    try {
      const stored = sessionStorage.getItem(CACHE_KEY);
      if (!stored) return null;

      const cached: CachedCredentials = JSON.parse(stored);
      const age = Date.now() - cached.cachedAt;

      // Verificar se ainda é válido (usa TTL do servidor ou 1 hora)
      const maxAge = Math.min(cached.ttl * 1000, CACHE_TTL);
      if (age > maxAge) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }

      return cached;
    } catch {
      return null;
    }
  },

  /**
   * Salva credenciais no cache
   */
  cacheCredentials(credentials: TurnCredentials): void {
    try {
      const cached: CachedCredentials = {
        ...credentials,
        cachedAt: Date.now()
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch (e) {
      console.warn('[TURN] Erro ao salvar cache:', e);
    }
  },

  /**
   * Limpa o cache de credenciais
   */
  clearCache(): void {
    sessionStorage.removeItem(CACHE_KEY);
  }
};
