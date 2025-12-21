/**
 * AudioContext Manager - Singleton
 * Gerencia um único AudioContext compartilhado para evitar limite do navegador
 */

type AudioContextState = 'suspended' | 'running' | 'closed';

class AudioContextManager {
  private static instance: AudioContextManager;
  private context: AudioContext | null = null;
  private users = new Set<string>();
  private stateListeners = new Map<string, (state: AudioContextState) => void>();
  private closeTimeout: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  acquire(userId: string): AudioContext {
    // Cancelar fechamento pendente
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }

    this.users.add(userId);

    if (!this.context || this.context.state === 'closed') {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioContextClass();

      this.context.onstatechange = () => {
        const state = this.context?.state as AudioContextState;
        this.stateListeners.forEach((listener) => listener(state));
      };

      console.log('[AudioContextManager] Context criado');
    }

    // Resumir se suspenso (política de autoplay)
    if (this.context.state === 'suspended') {
      this.context.resume().catch(console.warn);
    }

    console.log('[AudioContextManager] Acquired by:', userId, 'Users:', this.users.size);
    return this.context;
  }

  release(userId: string) {
    this.users.delete(userId);
    this.stateListeners.delete(userId);

    console.log('[AudioContextManager] Released by:', userId, 'Users:', this.users.size);

    // Fechar apenas se ninguém mais estiver usando (com delay)
    if (this.users.size === 0 && this.context) {
      this.closeTimeout = setTimeout(() => {
        if (this.users.size === 0 && this.context) {
          this.context.close().catch(console.warn);
          this.context = null;
          console.log('[AudioContextManager] Context closed');
        }
      }, 5000);
    }
  }

  onStateChange(userId: string, listener: (state: AudioContextState) => void) {
    this.stateListeners.set(userId, listener);

    // Notificar estado atual
    if (this.context) {
      listener(this.context.state as AudioContextState);
    }
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  isActive(): boolean {
    return this.context !== null && this.context.state !== 'closed';
  }

  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  getUserCount(): number {
    return this.users.size;
  }
}

export const audioContextManager = AudioContextManager.getInstance();
