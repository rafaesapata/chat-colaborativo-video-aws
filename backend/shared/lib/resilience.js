const retry = require('async-retry');
const CircuitBreaker = require('opossum');
const { metrics } = require('./metrics');

// Configuração de retry exponencial
const withRetry = async (fn, options = {}) => {
  return retry(async (bail, attempt) => {
    try {
      return await fn();
    } catch (error) {
      // Não fazer retry para erros de validação
      if (error.statusCode >= 400 && error.statusCode < 500) {
        bail(error);
        return;
      }
      
      console.log(`Attempt ${attempt} failed:`, error.message);
      throw error;
    }
  }, {
    retries: options.retries || 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000,
    randomize: true,
    ...options
  });
};

// Circuit Breaker para serviços externos
const createCircuitBreaker = (fn, options = {}) => {
  const breaker = new CircuitBreaker(fn, {
    timeout: options.timeout || 10000,
    errorThresholdPercentage: options.errorThreshold || 50,
    resetTimeout: options.resetTimeout || 30000,
    volumeThreshold: options.volumeThreshold || 10
  });

  breaker.on('open', () => {
    console.warn('Circuit breaker opened');
    metrics.circuitBreakerOpened?.();
  });

  breaker.on('halfOpen', () => {
    console.info('Circuit breaker half-open');
  });

  breaker.on('close', () => {
    console.info('Circuit breaker closed');
  });

  return breaker;
};

// Timeout wrapper
const withTimeout = (fn, timeoutMs = 30000) => {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    )
  ]);
};

module.exports = { withRetry, createCircuitBreaker, withTimeout };