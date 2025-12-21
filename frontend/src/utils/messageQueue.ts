/**
 * Message Queue com Backpressure
 * Limita taxa de processamento de mensagens WebSocket
 */

interface QueueConfig {
  maxSize: number;
  processingRate: number; // msgs por segundo
  priorityFn?: (msg: unknown) => number; // maior = mais prioritário
}

interface QueuedMessage {
  msg: unknown;
  priority: number;
  timestamp: number;
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private dropped = 0;
  private processed = 0;
  private paused = false;

  constructor(
    private config: QueueConfig,
    private handler: (msg: unknown) => void
  ) {}

  enqueue(msg: unknown) {
    if (this.paused) return;

    const priority = this.config.priorityFn?.(msg) ?? 50;

    // Se fila cheia, dropar mensagens de menor prioridade
    if (this.queue.length >= this.config.maxSize) {
      // Ordenar por prioridade (menor primeiro para remoção)
      this.queue.sort((a, b) => a.priority - b.priority);

      if (priority > this.queue[0].priority) {
        this.queue.shift(); // Remove menos prioritário
        this.dropped++;
        if (this.dropped % 10 === 0) {
          console.warn('[MessageQueue] Dropped messages:', this.dropped);
        }
      } else {
        this.dropped++;
        return; // Dropar mensagem nova se for menos prioritária
      }
    }

    this.queue.push({ msg, priority, timestamp: Date.now() });

    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    this.processing = true;
    const interval = 1000 / this.config.processingRate;

    while (this.queue.length > 0 && !this.paused) {
      // Processar em ordem de prioridade (maior primeiro)
      this.queue.sort((a, b) => b.priority - a.priority);
      const { msg } = this.queue.shift()!;

      try {
        this.handler(msg);
        this.processed++;
      } catch (e) {
        console.error('[MessageQueue] Handler error:', e);
      }

      // Pequeno delay para não bloquear a UI
      if (this.queue.length > 0) {
        await new Promise((r) => setTimeout(r, interval));
      }
    }

    this.processing = false;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    if (this.queue.length > 0 && !this.processing) {
      this.processQueue();
    }
  }

  clear() {
    this.queue = [];
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      dropped: this.dropped,
      processed: this.processed,
      isProcessing: this.processing,
    };
  }
}

// Prioridades por tipo de mensagem
export function getMessagePriority(msg: unknown): number {
  const data = msg as { type?: string; isPartial?: boolean };

  switch (data.type) {
    case 'webrtc-signal':
      return 100; // Crítico
    case 'room_event':
      return 80;
    case 'user_joined':
    case 'user_left':
      return 75;
    case 'message':
      return 50;
    case 'transcription':
      return data.isPartial ? 10 : 30;
    case 'pong':
      return 5;
    default:
      return 20;
  }
}

// Factory com configuração padrão
export function createMessageQueue(handler: (msg: unknown) => void): MessageQueue {
  return new MessageQueue(
    {
      maxSize: 100,
      processingRate: 60, // 60 msgs/segundo
      priorityFn: getMessagePriority,
    },
    handler
  );
}
