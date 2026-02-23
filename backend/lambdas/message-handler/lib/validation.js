/**
 * Módulo de Validação - SEC-003
 */

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

const patterns = {
  roomId: /^room_[a-zA-Z0-9]{6,20}$/,
  userId: /^user_[a-zA-Z0-9]{6,20}$/,
  messageId: /^msg_[a-zA-Z0-9_]+$/,
  connectionId: /^[a-zA-Z0-9_=-]+$/
};

const schemas = {
  message: {
    roomId: { required: true, pattern: 'roomId' },
    userId: { required: true, pattern: 'userId' },
    content: { required: true, type: 'string', minLength: 1, maxLength: 10000 },
    userName: { required: false, type: 'string', maxLength: 50 }
  },
  transcription: {
    roomId: { required: true, pattern: 'roomId' },
    userId: { required: true, pattern: 'userId' },
    transcribedText: { required: true, type: 'string', maxLength: 50000 }
  },
  webrtcSignal: {
    roomId: { required: true, pattern: 'roomId' },
    userId: { required: true, pattern: 'userId' },
    type: { required: true, type: 'string' }
  }
};

function validateField(value, rules, fieldName) {
  if (rules.required && (value === undefined || value === null || value === '')) {
    throw new ValidationError(`Campo obrigatório: ${fieldName}`, fieldName);
  }
  if (value === undefined || value === null) return true;
  
  if (rules.type && typeof value !== rules.type) {
    throw new ValidationError(`${fieldName} deve ser do tipo ${rules.type}`, fieldName);
  }
  if (rules.pattern && typeof value === 'string') {
    const pattern = patterns[rules.pattern];
    if (pattern && !pattern.test(value)) {
      throw new ValidationError(`${fieldName} tem formato inválido`, fieldName);
    }
  }
  if (rules.minLength !== undefined && value.length < rules.minLength) {
    throw new ValidationError(`${fieldName} deve ter pelo menos ${rules.minLength} caracteres`, fieldName);
  }
  if (rules.maxLength !== undefined && value.length > rules.maxLength) {
    throw new ValidationError(`${fieldName} deve ter no máximo ${rules.maxLength} caracteres`, fieldName);
  }
  return true;
}

function validateInput(input, schema) {
  const schemaObj = typeof schema === 'string' ? schemas[schema] : schema;
  if (!schemaObj) throw new Error(`Schema não encontrado: ${schema}`);
  
  const errors = [];
  const validated = {};
  
  for (const [fieldName, rules] of Object.entries(schemaObj)) {
    try {
      validateField(input[fieldName], rules, fieldName);
      if (input[fieldName] !== undefined) validated[fieldName] = input[fieldName];
    } catch (error) {
      if (error instanceof ValidationError) errors.push({ field: fieldName, message: error.message });
      else throw error;
    }
  }
  
  if (errors.length > 0) {
    const error = new ValidationError('Validação falhou: ' + errors.map(e => e.message).join('; '));
    error.errors = errors;
    throw error;
  }
  return { valid: true, data: validated };
}

const messageSchema = schemas.message;

module.exports = { ValidationError, validateInput, validateField, messageSchema, patterns, schemas };
