const Joi = require('joi');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

// Schemas de validação
const messageSchema = Joi.object({
  action: Joi.string().valid('sendMessage', 'webrtc-signal').required(),
  roomId: Joi.string()
    .pattern(/^room_[a-z0-9]{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid room ID format'
    }),
  userId: Joi.string()
    .pattern(/^user_[a-z0-9]{9}$/)
    .required(),
  content: Joi.string()
    .min(1)
    .max(5000)
    .when('type', {
      is: 'transcription',
      then: Joi.optional(),
      otherwise: Joi.when('action', {
        is: 'sendMessage',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    }),
  userName: Joi.string()
    .min(1)
    .max(100)
    .default('Anonymous'),
  targetUserId: Joi.string()
    .pattern(/^user_[a-z0-9]{9}$/)
    .optional(),
  signal: Joi.object().optional(),
  type: Joi.string().valid('transcription', 'user-joined', 'offer', 'answer', 'ice-candidate').optional(),
  transcribedText: Joi.string()
    .min(1)
    .max(5000)
    .when('type', {
      is: 'transcription',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  isPartial: Joi.boolean().optional(),
  timestamp: Joi.number().optional()
});

const connectionSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^user_[a-z0-9]{9}$/)
    .required(),
  roomId: Joi.string()
    .pattern(/^room_[a-z0-9]{9}$/)
    .optional(),
  token: Joi.string().optional()
});

const roomSchema = Joi.object({
  action: Joi.string().valid('createRoom', 'joinRoom', 'leaveRoom').required(),
  roomId: Joi.string()
    .pattern(/^room_[a-z0-9]{9}$/)
    .when('action', {
      is: 'createRoom',
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
  userId: Joi.string()
    .pattern(/^user_[a-z0-9]{9}$/)
    .required(),
  roomName: Joi.string()
    .min(1)
    .max(100)
    .when('action', {
      is: 'createRoom',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
});

async function validateInput(body, schema) {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    const { value, error } = schema.validate(parsed, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      throw new ValidationError(
        error.details.map(d => d.message).join(', ')
      );
    }
    
    return value;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new ValidationError('Invalid JSON payload');
    }
    throw e;
  }
}

module.exports = {
  ValidationError,
  messageSchema,
  connectionSchema,
  roomSchema,
  validateInput
};