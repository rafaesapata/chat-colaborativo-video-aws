const pino = require('pino');
const { v4: uuidv4 } = require('uuid');

const createLogger = (context = {}) => {
  const correlationId = context.correlationId || uuidv4();
  
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service: 'chat-colaborativo',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.STAGE || 'development',
      correlationId,
      region: process.env.AWS_REGION
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
      bindings: (bindings) => ({
        ...bindings,
        pid: undefined,
        hostname: undefined
      })
    },
    redact: {
      paths: [
        'userId',
        'connectionId',
        'audioData',
        'content',
        '*.password',
        '*.token',
        '*.authorization'
      ],
      censor: '[REDACTED]'
    },
    mixin: () => ({
      timestamp: new Date().toISOString(),
      traceId: process.env._X_AMZN_TRACE_ID
    })
  });
};

module.exports = { createLogger };