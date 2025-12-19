const jwt = require('jsonwebtoken');
const { createLogger } = require('../../shared/lib/logger');

const logger = createLogger();

// SEC-001: Validação obrigatória do JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key' || JWT_SECRET === 'your-secret-key-change-in-production') {
  console.error('FATAL: JWT_SECRET não configurado ou usando valor padrão inseguro');
  // Em produção, isso deve falhar. Em dev, permitir com aviso
  if (process.env.STAGE === 'prod') {
    throw new Error('JWT_SECRET must be configured in production');
  }
}

exports.handler = async (event) => {
  logger.info({ event }, 'WebSocket authorization request');
  
  try {
    const token = event.queryStringParameters?.token;
    
    if (!token) {
      logger.warn('No token provided');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // Verificar e decodificar o JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded.userId) {
      logger.warn('Invalid token: missing userId');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    logger.info({ userId: decoded.userId }, 'User authorized');
    
    return generatePolicy(decoded.userId, 'Allow', event.methodArn, {
      userId: decoded.userId,
      userName: decoded.userName || 'Anonymous'
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Authorization failed');
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

function generatePolicy(principalId, effect, resource, context = {}) {
  const authResponse = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    }
  };

  if (Object.keys(context).length > 0) {
    authResponse.context = context;
  }

  return authResponse;
}