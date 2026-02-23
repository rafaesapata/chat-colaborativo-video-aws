/**
 * Módulo de Resiliência - RES-004
 */

async function withRetry(fn, options = {}) {
  const {
    retries = 3,
    baseDelay = 100,
    maxDelay = 5000,
    exponentialBase = 2,
    retryableErrors = ['ProvisionedThroughputExceededException', 'ThrottlingException', 'ServiceUnavailable']
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRetryable = retryableErrors.some(errType =>
        error.name === errType || error.code === errType || error.message?.includes(errType)
      );

      if (!isRetryable || attempt === retries) throw error;

      const exponentialDelay = baseDelay * Math.pow(exponentialBase, attempt);
      const jitter = Math.random() * 100;
      const delay = Math.min(exponentialDelay + jitter, maxDelay);

      console.log(`[Retry] Tentativa ${attempt + 1}/${retries}, aguardando ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
  throw lastError;
}

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.state = 'CLOSED';
    this.failures = 0;
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) this.state = 'OPEN';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { withRetry, CircuitBreaker, sleep };
