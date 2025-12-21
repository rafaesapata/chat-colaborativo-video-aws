/**
 * Transcription Deduplicator
 * Previne processamento de transcrições duplicadas
 */

interface TranscriptionData {
  odUserId: string;
  transcribedText: string;
  isPartial?: boolean;
}

class TranscriptionDeduplicator {
  private seen = new Map<string, number>(); // hash -> timestamp
  private readonly TTL = 30000; // 30 segundos
  private readonly MAX_ENTRIES = 1000;

  private hash(transcription: TranscriptionData): string {
    // Hash simples baseado em conteúdo
    const content = `${transcription.odUserId}:${transcription.transcribedText.trim().toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  isDuplicate(transcription: TranscriptionData): boolean {
    // Transcrições parciais sempre passam (serão substituídas)
    if (transcription.isPartial) return false;

    this.cleanup();

    const hash = this.hash(transcription);

    if (this.seen.has(hash)) {
      const lastSeen = this.seen.get(hash)!;
      if (Date.now() - lastSeen < this.TTL) {
        console.log('[Deduplicator] Transcrição duplicada ignorada');
        return true;
      }
    }

    // Marcar como visto
    this.seen.set(hash, Date.now());
    return false;
  }

  private cleanup() {
    if (this.seen.size < this.MAX_ENTRIES) return;

    const now = Date.now();
    const oldKeys: string[] = [];

    for (const [key, timestamp] of this.seen) {
      if (now - timestamp > this.TTL) {
        oldKeys.push(key);
      }
    }

    oldKeys.forEach((key) => this.seen.delete(key));
  }

  clear() {
    this.seen.clear();
  }

  getStats() {
    return {
      entries: this.seen.size,
      maxEntries: this.MAX_ENTRIES,
    };
  }
}

export const transcriptionDeduplicator = new TranscriptionDeduplicator();
