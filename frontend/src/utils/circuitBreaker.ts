/**
 * Circuit Breaker para Chamadas API
 * Protege contra falhas em cascata e sobrecarga do backend
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailure = 0;
  private halfOpenAttempts = 0;
  private successesInHalfOpen = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure >= this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
        this.successesInHalfOpen = 0;
        console.log('[CircuitBreaker] Transição para HALF_OPEN');
      } else {
        throw new CircuitOpenError('Serviço temporariamente indisponível');
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenAttempts >= this.config.halfOpenRequests) {
      throw new CircuitOpenError('Aguardando recuperação do serviço');
    }

    try {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenAttempts++;
      }

      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successesInHalfOpen++;
      if (this.successesInHalfOpen >= this.config.halfOpenRequests) {
        console.log('[CircuitBreaker] Circuito FECHADO - serviço recuperado');
        this.state = 'CLOSED';
        this.failures = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.state === 'HALF_OPEN') {
      console.warn('[CircuitBreaker] Falha em HALF_OPEN - voltando para OPEN');
      this.state = 'OPEN';
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      console.warn('[CircuitBreaker] Circuito ABERTO - muitas falhas');
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.successesInHalfOpen = 0;
  }
}

// Singleton para Chime API
export const chimeCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000, // 30 segundos
  halfOpenRequests: 2,
});

// Singleton para WebSocket
export const wsCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 15000,
  halfOpenRequests: 1,
});
