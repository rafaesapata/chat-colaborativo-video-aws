/**
 * Distributed Tracing - Request Correlation
 * Correlaciona erros entre frontend e backend
 */

interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  operation: string;
}

function generateId(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

class TracingManager {
  private currentTrace: TraceContext | null = null;
  private spans = new Map<string, TraceContext>();
  private completedSpans: Array<TraceContext & { duration: number; status: string }> = [];
  private readonly MAX_COMPLETED = 100;

  startTrace(operation: string): TraceContext {
    const trace: TraceContext = {
      traceId: generateId(32),
      spanId: generateId(16),
      startTime: performance.now(),
      operation,
    };

    this.currentTrace = trace;
    this.spans.set(trace.spanId, trace);

    console.log(`[Trace:${trace.traceId.substring(0, 8)}] Started: ${operation}`);
    return trace;
  }

  startSpan(operation: string, parentSpanId?: string): TraceContext {
    const parent = parentSpanId ? this.spans.get(parentSpanId) : this.currentTrace;

    const span: TraceContext = {
      traceId: parent?.traceId || generateId(32),
      spanId: generateId(16),
      parentSpanId: parent?.spanId,
      startTime: performance.now(),
      operation,
    };

    this.spans.set(span.spanId, span);
    return span;
  }

  endSpan(
    spanId: string,
    status: 'ok' | 'error',
    metadata?: Record<string, unknown>
  ) {
    const span = this.spans.get(spanId);
    if (!span) return;

    const duration = performance.now() - span.startTime;

    console.log(
      `[Trace:${span.traceId.substring(0, 8)}] ${span.operation} ${status} (${duration.toFixed(2)}ms)`,
      metadata || ''
    );

    // Guardar span completado
    this.completedSpans.push({ ...span, duration, status });
    if (this.completedSpans.length > this.MAX_COMPLETED) {
      this.completedSpans.shift();
    }

    this.spans.delete(spanId);

    if (span.spanId === this.currentTrace?.spanId) {
      this.currentTrace = null;
    }
  }

  getTraceHeaders(): Record<string, string> {
    if (!this.currentTrace) return {};

    return {
      'X-Trace-Id': this.currentTrace.traceId,
      'X-Span-Id': this.currentTrace.spanId,
      'X-Parent-Span-Id': this.currentTrace.parentSpanId || '',
    };
  }

  getCurrentTraceId(): string | null {
    return this.currentTrace?.traceId || null;
  }

  // Middleware para fetch
  async tracedFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const urlPath = new URL(url, window.location.origin).pathname;
    const span = this.startSpan(`fetch:${urlPath}`);

    const headers = {
      ...options.headers,
      ...this.getTraceHeaders(),
    };

    try {
      const response = await fetch(url, { ...options, headers });
      this.endSpan(span.spanId, response.ok ? 'ok' : 'error', {
        status: response.status,
        url: urlPath,
      });
      return response;
    } catch (error) {
      this.endSpan(span.spanId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: urlPath,
      });
      throw error;
    }
  }

  // Obter spans recentes para debugging
  getRecentSpans(count = 10) {
    return this.completedSpans.slice(-count);
  }

  // Limpar tudo
  clear() {
    this.currentTrace = null;
    this.spans.clear();
    this.completedSpans = [];
  }
}

export const tracing = new TracingManager();

// Helper para criar fetch com tracing
export function createTracedFetch() {
  return (url: string, options?: RequestInit) => tracing.tracedFetch(url, options);
}
