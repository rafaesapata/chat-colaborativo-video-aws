/**
 * Stability Utilities - Exportações centralizadas
 * Video Chat v3.5.0 - Enterprise Grade Stability
 */

// Circuit Breaker
export { CircuitBreaker, CircuitOpenError, chimeCircuitBreaker, wsCircuitBreaker } from '../circuitBreaker';

// Request Coalescing
export { requestCoalescer } from '../requestCoalescer';

// Message Queue com Backpressure
export { MessageQueue, createMessageQueue, getMessagePriority } from '../messageQueue';

// AudioContext Manager
export { audioContextManager } from '../audioContextManager';

// Reconnection Strategy
export { ReconnectionStrategy, createReconnectionStrategy } from '../reconnectionStrategy';

// Feature Detection
export { featureDetector } from '../featureDetection';

// Transcription Deduplication
export { transcriptionDeduplicator } from '../transcriptionDeduplicator';

// Distributed Tracing
export { tracing, createTracedFetch } from '../tracing';
