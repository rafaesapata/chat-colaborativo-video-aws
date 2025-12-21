/**
 * Request Coalescer - Deduplicação de Requisições
 * Previne múltiplas requisições idênticas simultâneas
 */

type InflightRequest<T> = {
  promise: Promise<T>;
  timestamp: number;
};

class RequestCoalescer {
  private inflight = new Map<string, InflightRequest<unknown>>();
  private readonly TTL = 5000; // 5 segundos

  async coalesce<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Limpar requests expirados
    this.cleanup();

    // Se já existe request em andamento, retornar a mesma promise
    const existing = this.inflight.get(key);
    if (existing) {
      console.log('[Coalescer] Reutilizando request:', key);
      return existing.promise as Promise<T>;
    }

    // Criar nova request
    const promise = operation().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, { promise, timestamp: Date.now() });
    return promise;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, request] of this.inflight) {
      if (now - request.timestamp > this.TTL) {
        this.inflight.delete(key);
      }
    }
  }

  isInflight(key: string): boolean {
    return this.inflight.has(key);
  }

  cancel(key: string) {
    this.inflight.delete(key);
  }

  clear() {
    this.inflight.clear();
  }
}

export const requestCoalescer = new RequestCoalescer();
