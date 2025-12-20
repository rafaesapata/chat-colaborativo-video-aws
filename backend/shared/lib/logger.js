/**
 * Módulo de Logging Estruturado
 */

const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'apiKey', 'credential'];

function redact(obj, depth = 0) {
  if (depth > 10) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) return obj.map(item => redact(item, depth + 1));

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    if (sensitiveFields.some(field => keyLower.includes(field))) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redact(value, depth + 1);
    }
  }
  return result;
}

function createLogger(options = {}) {
  const { service = 'video-chat', environment = process.env.STAGE || 'dev' } = options;

  function formatLog(level, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      service,
      environment,
      ...redact(data)
    });
  }

  return {
    info(message, data) { console.log(formatLog('INFO', message, data)); },
    warn(message, data) { console.warn(formatLog('WARN', message, data)); },
    error(message, error, data = {}) {
      console.error(formatLog('ERROR', message, {
        ...data,
        error: { name: error?.name, message: error?.message }
      }));
    },
    debug(message, data) {
      if (environment !== 'prod') console.log(formatLog('DEBUG', message, data));
    }
  };
}

module.exports = { createLogger, redact };
