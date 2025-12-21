/**
 * Reconnection Strategy com Exponential Backoff e Jitter
 * Gerencia reconexões automáticas de forma inteligente
 */

interface ReconnectionConfig {
  baseDelay: number;
  maxDelay: number;
  maxAttempts: number;
  jitterFactor: number;
}

type ReconnectionStatus = 'idle' | 'reconnecting' | 'success' | 'failed' | 'aborted';

export class ReconnectionStrategy {
  private attempts = 0;
  private status: ReconnectionStatus = 'idle';
  private aborted = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private config: ReconnectionConfig,
    private onReconnect: () => Promise<boolean>,
    private onMaxAttemptsReached: () => void,
    private onStatusChange?: (status: ReconnectionStatus, attempt: number) => void
  ) {}

  async trigger(reason: string): Promise<boolean> {
    if (this.status === 'reconnecting' || this.aborted) {
      return false;
    }

    this.status = 'reconnecting';
    this.onStatusChange?.('reconnecting', 0);
    console.log('[Reconnection] Iniciando por:', reason);

    while (this.attempts < this.config.maxAttempts && !this.aborted) {
      this.attempts++;
      this.onStatusChange?.('reconnecting', this.attempts);

      const delay = this.calculateDelay();
      console.log(
        `[Reconnection] Tentativa ${this.attempts}/${this.config.maxAttempts} em ${delay}ms`
      );

      await this.sleep(delay);

      if (this.aborted) break;

      try {
        const success = await this.onReconnect();
        if (success) {
          console.log('[Reconnection] Sucesso!');
          this.status = 'success';
          this.onStatusChange?.('success', this.attempts);
          this.reset();
          return true;
        }
      } catch (e) {
        console.warn('[Reconnection] Falha:', e);
      }
    }

    if (!this.aborted) {
      console.error('[Reconnection] Máximo de tentativas atingido');
      this.status = 'failed';
      this.onStatusChange?.('failed', this.attempts);
      this.onMaxAttemptsReached();
    }

    return false;
  }

  private calculateDelay(): number {
    // Exponential backoff com jitter
    const exponential = Math.min(
      this.config.baseDelay * Math.pow(2, this.attempts - 1),
      this.config.maxDelay
    );

    const jitter = exponential * this.config.jitterFactor * Math.random();
    return Math.round(exponential + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timeoutId = setTimeout(resolve, ms);
    });
  }

  abort() {
    this.aborted = true;
    this.status = 'aborted';
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.onStatusChange?.('aborted', this.attempts);
  }

  reset() {
    this.attempts = 0;
    this.status = 'idle';
    this.aborted = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  getAttempts(): number {
    return this.attempts;
  }

  getStatus(): ReconnectionStatus {
    return this.status;
  }

  isReconnecting(): boolean {
    return this.status === 'reconnecting';
  }
}

// Factory com configuração padrão
export function createReconnectionStrategy(
  onReconnect: () => Promise<boolean>,
  onMaxAttemptsReached: () => void,
  onStatusChange?: (status: ReconnectionStatus, attempt: number) => void
): ReconnectionStrategy {
  return new ReconnectionStrategy(
    {
      baseDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 5,
      jitterFactor: 0.3,
    },
    onReconnect,
    onMaxAttemptsReached,
    onStatusChange
  );
}
