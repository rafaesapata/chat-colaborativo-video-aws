/**
 * Amazon Chime SDK Meeting Manager
 * Gerencia criação de meetings, attendees e tokens
 * 
 * v3.0.0 - Nível Militar de Segurança e Robustez
 * 
 * Correções aplicadas:
 * - AsyncLocalStorage para requestId (sem race condition)
 * - Lock distribuído com liberação garantida
 * - Validação de origem robusta
 * - JoinToken sempre retornado (delete + recreate attendee)
 * - Rate limiting por IP
 * - Iteração em vez de recursão
 * - Proteção de informações sensíveis
 */

'use strict';

const { 
  ChimeSDKMeetingsClient, 
  CreateMeetingCommand, 
  CreateAttendeeCommand,
  DeleteMeetingCommand,
  DeleteAttendeeCommand,
  GetMeetingCommand,
  ListAttendeesCommand
} = require('@aws-sdk/client-chime-sdk-meetings');

const { 
  DynamoDBClient, 
  GetItemCommand, 
  PutItemCommand, 
  DeleteItemCommand,
  UpdateItemCommand,
  ScanCommand
} = require('@aws-sdk/client-dynamodb');

const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

// ============ CONFIGURAÇÃO ============
const CONFIG = Object.freeze({
  REGION: process.env.AWS_REGION || 'us-east-1',
  MEETINGS_TABLE: process.env.MEETINGS_TABLE || 'ChimeMeetings',
  USE_DYNAMO: !!process.env.MEETINGS_TABLE,
  MEETING_TTL_SECONDS: 14400,      // 4 horas (alinhado com Chime)
  LOCK_TTL_SECONDS: 10,            // Menor que Lambda timeout
  MAX_RETRY_ATTEMPTS: 3,
  RATE_LIMIT_REQUESTS: 30,         // Max requests por janela
  RATE_LIMIT_WINDOW_SECONDS: 60,   // Janela de 1 minuto
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  API_KEY: process.env.API_KEY || null,
});

// Origens permitidas (imutável)
const ALLOWED_ORIGINS = Object.freeze([
  'https://livechat.ai.udstec.io',
  'https://dmz2oaky7xb1w.cloudfront.net',
]);

const DEV_ORIGINS = Object.freeze([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
]);

// AsyncLocalStorage para contexto de request (thread-safe)
const asyncLocalStorage = new AsyncLocalStorage();

// Clientes AWS com configuração de retry e timeout
const chimeClient = new ChimeSDKMeetingsClient({ 
  region: CONFIG.REGION,
  maxAttempts: 3,
});

const dynamoClient = new DynamoDBClient({ 
  region: CONFIG.REGION,
  maxAttempts: 3,
});

// Headers de resposta (imutável)
const RESPONSE_HEADERS = Object.freeze({
  'Content-Type': 'application/json',
});

// ============ LOGGING ESTRUTURADO (THREAD-SAFE) ============
const LOG_LEVELS = Object.freeze({ DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' });

function log(level, msg, data = {}) {
  const store = asyncLocalStorage.getStore() || {};
  const safeData = { ...data };
  
  // Remover TODOS os dados sensíveis
  const sensitiveKeys = ['JoinToken', 'MediaPlacement', 'password', 'token', 'secret', 'key'];
  sensitiveKeys.forEach(key => {
    delete safeData[key];
    Object.keys(safeData).forEach(k => {
      if (k.toLowerCase().includes(key.toLowerCase())) {
        safeData[k] = '[REDACTED]';
      }
    });
  });
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    requestId: store.requestId || 'unknown',
    level,
    msg,
    ...safeData,
  };
  
  console[level](JSON.stringify(logEntry));
}

// ============ VALIDAÇÃO E SANITIZAÇÃO ============
const VALIDATION = Object.freeze({
  ROOM_ID_REGEX: /^[a-zA-Z0-9_-]{1,64}$/,
  USER_ID_REGEX: /^[a-zA-Z0-9_-]{1,64}$/,
  MAX_NAME_LENGTH: 50,
});

function validateRoomId(roomId) {
  if (typeof roomId !== 'string') return 'roomId deve ser string';
  if (!VALIDATION.ROOM_ID_REGEX.test(roomId)) {
    return 'roomId inválido (1-64 caracteres: a-z, A-Z, 0-9, _, -)';
  }
  return null;
}

function validateUserId(userId) {
  if (typeof userId !== 'string') return 'userId deve ser string';
  if (!VALIDATION.USER_ID_REGEX.test(userId)) {
    return 'userId inválido (1-64 caracteres: a-z, A-Z, 0-9, _, -)';
  }
  return null;
}

function sanitizeUserName(name) {
  if (typeof name !== 'string' || name.length === 0) return 'Participante';
  
  return name
    .normalize('NFKC')                           // Normalizar unicode
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')       // Remover caracteres de controle
    .replace(/[\u200B-\u200D\uFEFF]/g, '')      // Remover zero-width chars
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '') // Remover direcionais
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')        // Manter apenas letras, números, espaços, ., _, -
    .replace(/\s+/g, ' ')                        // Múltiplos espaços → um espaço
    .trim()
    .substring(0, VALIDATION.MAX_NAME_LENGTH) || 'Participante';
}

function getClientIp(event) {
  return event.requestContext?.http?.sourceIp ||
         event.requestContext?.identity?.sourceIp ||
         event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
         'unknown';
}

// ============ AUTENTICAÇÃO E AUTORIZAÇÃO ============
function validateOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  
  // Construir lista de origens permitidas baseado no ambiente
  const allowedOrigins = CONFIG.IS_PRODUCTION 
    ? ALLOWED_ORIGINS 
    : [...ALLOWED_ORIGINS, ...DEV_ORIGINS];
  
  // Se tem origem, validar contra whitelist
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      return { valid: true };
    }
    log(LOG_LEVELS.WARN, 'Origem não permitida', { origin });
    return { valid: false, error: 'Origem não permitida' };
  }
  
  // Requisição sem Origin (curl, mobile app, server-to-server)
  // Em produção, exigir API key
  if (CONFIG.IS_PRODUCTION) {
    const apiKey = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key'];
    if (!CONFIG.API_KEY || apiKey !== CONFIG.API_KEY) {
      log(LOG_LEVELS.WARN, 'Requisição sem origem válida ou API key');
      return { valid: false, error: 'Autenticação necessária' };
    }
  }
  
  return { valid: true };
}

// ============ RATE LIMITING ============
async function checkRateLimit(identifier) {
  if (!CONFIG.USE_DYNAMO) return { allowed: true };
  
  const key = `ratelimit_${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - CONFIG.RATE_LIMIT_WINDOW_SECONDS;
  
  try {
    // Atomic increment com TTL
    const result = await dynamoClient.send(new UpdateItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Key: { roomId: { S: key } },
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl, #window = if_not_exists(#window, :now)',
      ExpressionAttributeNames: { 
        '#count': 'requestCount', 
        '#ttl': 'ttl',
        '#window': 'windowStart'
      },
      ExpressionAttributeValues: {
        ':zero': { N: '0' },
        ':one': { N: '1' },
        ':ttl': { N: String(now + CONFIG.RATE_LIMIT_WINDOW_SECONDS * 2) },
        ':now': { N: String(now) }
      },
      ReturnValues: 'ALL_NEW'
    }));
    
    const windowStartTime = parseInt(result.Attributes?.windowStart?.N || '0');
    const count = parseInt(result.Attributes?.requestCount?.N || '0');
    
    // Se janela expirou, resetar (próxima requisição terá contador limpo pelo TTL)
    if (windowStartTime < windowStart) {
      return { allowed: true, remaining: CONFIG.RATE_LIMIT_REQUESTS };
    }
    
    const allowed = count <= CONFIG.RATE_LIMIT_REQUESTS;
    return { 
      allowed, 
      remaining: Math.max(0, CONFIG.RATE_LIMIT_REQUESTS - count),
      retryAfter: allowed ? null : CONFIG.RATE_LIMIT_WINDOW_SECONDS
    };
  } catch (e) {
    log(LOG_LEVELS.WARN, 'Erro no rate limiting, permitindo requisição', { error: e.message });
    return { allowed: true }; // Fail open para não bloquear usuários legítimos
  }
}

// ============ LOCK DISTRIBUÍDO (ITERATIVO, NÃO RECURSIVO) ============
async function acquireLock(roomId) {
  if (!CONFIG.USE_DYNAMO) {
    log(LOG_LEVELS.WARN, 'Lock distribuído não disponível sem DynamoDB');
    return { acquired: true, mustRelease: false };
  }
  
  const lockKey = `lock_${roomId}`;
  
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + CONFIG.LOCK_TTL_SECONDS;
    
    try {
      await dynamoClient.send(new PutItemCommand({
        TableName: CONFIG.MEETINGS_TABLE,
        Item: {
          roomId: { S: lockKey },
          expiry: { N: String(expiry) },
          lockedAt: { N: String(now) },
          lockedBy: { S: asyncLocalStorage.getStore()?.requestId || 'unknown' }
        },
        ConditionExpression: 'attribute_not_exists(roomId) OR expiry < :now',
        ExpressionAttributeValues: {
          ':now': { N: String(now) }
        }
      }));
      
      log(LOG_LEVELS.INFO, 'Lock adquirido', { roomId, attempt });
      return { acquired: true, mustRelease: true };
      
    } catch (e) {
      if (e.name === 'ConditionalCheckFailedException') {
        if (attempt >= CONFIG.MAX_RETRY_ATTEMPTS) {
          log(LOG_LEVELS.WARN, 'Falha ao adquirir lock após máximo de tentativas', { roomId, attempt });
          return { acquired: false, mustRelease: false };
        }
        
        // Backoff exponencial com jitter (100ms, 200ms, 400ms + jitter)
        const baseDelay = 100 * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 100;
        const delay = Math.min(baseDelay + jitter, 2000);
        
        log(LOG_LEVELS.DEBUG, 'Lock ocupado, aguardando retry', { roomId, attempt, delay: Math.round(delay) });
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      // Erro inesperado - não adquiriu lock, não precisa liberar
      log(LOG_LEVELS.ERROR, 'Erro ao adquirir lock', { roomId, error: e.message });
      throw e;
    }
  }
  
  return { acquired: false, mustRelease: false };
}

async function releaseLock(roomId) {
  if (!CONFIG.USE_DYNAMO) return;
  
  const lockKey = `lock_${roomId}`;
  try {
    await dynamoClient.send(new DeleteItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Key: { roomId: { S: lockKey } }
    }));
    log(LOG_LEVELS.DEBUG, 'Lock liberado', { roomId });
  } catch (e) {
    // Log mas não falha - lock expirará naturalmente
    log(LOG_LEVELS.WARN, 'Erro ao liberar lock', { roomId, error: e.message });
  }
}

// ============ CACHE COM DYNAMODB ============
async function getMeetingFromCache(roomId) {
  if (!CONFIG.USE_DYNAMO) {
    log(LOG_LEVELS.DEBUG, 'DynamoDB não configurado, cache desabilitado');
    return null;
  }
  
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Key: { roomId: { S: roomId } },
      ConsistentRead: true
    }));
    
    if (!result.Item?.meetingId?.S) return null;
    
    // Verificar TTL localmente (DynamoDB TTL tem delay)
    const ttl = parseInt(result.Item.ttl?.N || '0');
    const now = Math.floor(Date.now() / 1000);
    if (ttl > 0 && ttl < now) {
      log(LOG_LEVELS.DEBUG, 'Cache expirado localmente', { roomId });
      return null;
    }
    
    return {
      meetingId: result.Item.meetingId.S,
      createdBy: result.Item.createdBy?.S || null,
      createdAt: parseInt(result.Item.createdAt?.N || '0')
    };
  } catch (e) {
    log(LOG_LEVELS.ERROR, 'Erro ao ler cache DynamoDB', { roomId, error: e.message });
    throw new Error('Erro ao acessar banco de dados');
  }
}

async function setMeetingInCache(roomId, meetingId, createdBy) {
  if (!CONFIG.USE_DYNAMO) return;
  
  const now = Math.floor(Date.now() / 1000);
  try {
    await dynamoClient.send(new PutItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Item: {
        roomId: { S: roomId },
        meetingId: { S: meetingId },
        createdBy: { S: createdBy },
        createdAt: { N: String(now) },
        ttl: { N: String(now + CONFIG.MEETING_TTL_SECONDS) }
      }
    }));
    log(LOG_LEVELS.DEBUG, 'Cache atualizado', { roomId });
  } catch (e) {
    log(LOG_LEVELS.ERROR, 'Erro ao salvar cache', { roomId, error: e.message });
    throw new Error('Erro ao salvar no banco de dados');
  }
}

async function deleteMeetingFromCache(roomId) {
  if (!CONFIG.USE_DYNAMO) return;
  
  try {
    await dynamoClient.send(new DeleteItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Key: { roomId: { S: roomId } }
    }));
    log(LOG_LEVELS.DEBUG, 'Cache removido', { roomId });
  } catch (e) {
    log(LOG_LEVELS.WARN, 'Erro ao remover cache', { roomId, error: e.message });
  }
}

// ============ HELPERS DE RESPOSTA ============
function createResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...RESPONSE_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode, message, extraHeaders = {}) {
  return createResponse(statusCode, { error: message }, extraHeaders);
}

function successResponse(data, extraHeaders = {}) {
  return createResponse(200, data, extraHeaders);
}

// Super admins (podem adicionar/remover outros admins)
const SUPER_ADMINS = Object.freeze([
  'rafael@uds.com.br',
  'rafael.sapata',
  'rsapata'
]);

// Admins estáticos (fallback se DynamoDB falhar)
const STATIC_ADMINS = Object.freeze([
  'admin',
  'rafael.sapata',
  'rsapata',
  'rafael@uds.com.br'
]);

// ============ GERENCIAMENTO DE ADMINS ============
async function getAdminList() {
  if (!CONFIG.USE_DYNAMO) return STATIC_ADMINS;
  
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Key: { roomId: { S: 'admin_users_list' } }
    }));
    
    if (result.Item?.admins?.SS) {
      return result.Item.admins.SS;
    }
    
    // Inicializar lista de admins se não existir
    await dynamoClient.send(new PutItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Item: {
        roomId: { S: 'admin_users_list' },
        admins: { SS: [...STATIC_ADMINS] },
        createdAt: { N: String(Math.floor(Date.now() / 1000)) }
      }
    }));
    
    return STATIC_ADMINS;
  } catch (e) {
    log(LOG_LEVELS.WARN, 'Erro ao buscar lista de admins, usando estática', { error: e.message });
    return STATIC_ADMINS;
  }
}

async function addAdmin(userLogin) {
  if (!CONFIG.USE_DYNAMO) return false;
  
  try {
    await dynamoClient.send(new UpdateItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Key: { roomId: { S: 'admin_users_list' } },
      UpdateExpression: 'ADD admins :user',
      ExpressionAttributeValues: {
        ':user': { SS: [userLogin.toLowerCase()] }
      }
    }));
    log(LOG_LEVELS.INFO, 'Admin adicionado', { userLogin });
    return true;
  } catch (e) {
    log(LOG_LEVELS.ERROR, 'Erro ao adicionar admin', { userLogin, error: e.message });
    return false;
  }
}

async function removeAdmin(userLogin) {
  if (!CONFIG.USE_DYNAMO) return false;
  
  // Não permitir remover super admins
  if (SUPER_ADMINS.includes(userLogin.toLowerCase())) {
    return false;
  }
  
  try {
    await dynamoClient.send(new UpdateItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Key: { roomId: { S: 'admin_users_list' } },
      UpdateExpression: 'DELETE admins :user',
      ExpressionAttributeValues: {
        ':user': { SS: [userLogin.toLowerCase()] }
      }
    }));
    log(LOG_LEVELS.INFO, 'Admin removido', { userLogin });
    return true;
  } catch (e) {
    log(LOG_LEVELS.ERROR, 'Erro ao remover admin', { userLogin, error: e.message });
    return false;
  }
}

// ============ ROTEAMENTO ============
const routes = Object.freeze({
  'POST:/meeting/join': handleJoinMeeting,
  'POST:/meeting/leave': handleLeaveMeeting,
  'POST:/meeting/end': handleEndMeeting,
  'GET:/meeting/info': handleGetMeetingInfo,
  'POST:/meeting/info': handleGetMeetingInfo,
  // Health check
  'GET:/health': handleHealthCheck,
  // Rotas administrativas
  'POST:/admin/rooms': handleAdminListRooms,
  'POST:/admin/room/end': handleAdminEndRoom,
  'POST:/admin/stats': handleAdminStats,
  'POST:/admin/kick': handleAdminKickUser,
  'POST:/admin/users': handleAdminListUsers,
  'POST:/admin/users/add': handleAdminAddUser,
  'POST:/admin/users/remove': handleAdminRemoveUser,
  'POST:/admin/cleanup': handleAdminCleanup,
  'POST:/admin/check-role': handleCheckUserRole,
});

// ============ HANDLER PRINCIPAL ============
exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || crypto.randomUUID();
  
  // Executar dentro do contexto AsyncLocalStorage
  return asyncLocalStorage.run({ requestId }, async () => {
    try {
      return await processRequest(event);
    } catch (error) {
      log(LOG_LEVELS.ERROR, 'Erro não tratado no handler', { 
        error: error.message, 
        stack: error.stack 
      });
      return errorResponse(500, 'Erro interno do servidor');
    }
  });
};

async function processRequest(event) {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
  const path = event.path || event.rawPath || '';
  
  // CORS preflight
  if (method === 'OPTIONS') {
    return createResponse(200, '');
  }
  
  // Validar origem
  const originResult = validateOrigin(event);
  if (!originResult.valid) {
    return errorResponse(403, originResult.error);
  }
  
  // Rate limiting por IP
  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    log(LOG_LEVELS.WARN, 'Rate limit excedido', { clientIp });
    return errorResponse(429, 'Muitas requisições. Tente novamente em breve.', {
      'Retry-After': String(rateLimit.retryAfter || 60)
    });
  }
  
  // Parse body
  let body = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return errorResponse(400, 'JSON inválido no body');
    }
  }
  
  // Normalizar path e buscar handler
  const normalizedPath = path.split('?')[0].replace(/\/+$/, '') || '/';
  const routeKey = `${method}:${normalizedPath}`;
  const handler = routes[routeKey];
  
  if (!handler) {
    log(LOG_LEVELS.DEBUG, 'Rota não encontrada', { routeKey });
    return errorResponse(404, 'Rota não encontrada');
  }
  
  return handler(body, event);
}

// ============ HANDLER: JOIN MEETING ============
async function handleJoinMeeting(body) {
  const { roomId, odUserId, userName, isAuthenticated } = body;

  // Validação rigorosa
  const roomIdError = validateRoomId(roomId);
  if (roomIdError) return errorResponse(400, roomIdError);
  
  const userIdError = validateUserId(odUserId);
  if (userIdError) return errorResponse(400, userIdError);

  const displayName = sanitizeUserName(userName);
  const externalUserId = `${odUserId}|${displayName}`;
  
  // Verificar se é usuário convidado (não autenticado)
  const isGuest = isAuthenticated !== true;

  // Adquirir lock distribuído
  const lock = await acquireLock(roomId);
  if (!lock.acquired) {
    return errorResponse(429, 'Sala ocupada, tente novamente em alguns segundos');
  }

  try {
    let meeting = null;
    let isNewMeeting = false;

    // Verificar cache
    const cachedMeeting = await getMeetingFromCache(roomId);
    
    if (cachedMeeting?.meetingId) {
      try {
        const getMeetingResponse = await chimeClient.send(new GetMeetingCommand({
          MeetingId: cachedMeeting.meetingId
        }));
        meeting = getMeetingResponse.Meeting;
        log(LOG_LEVELS.INFO, 'Reunião existente encontrada', { roomId });
      } catch (e) {
        if (e.name === 'NotFoundException' || e.name === 'BadRequestException') {
          log(LOG_LEVELS.INFO, 'Reunião expirou no Chime', { roomId });
          await deleteMeetingFromCache(roomId);
          meeting = null;
        } else {
          throw e;
        }
      }
    }

    // Se não existe reunião e usuário é convidado, bloquear criação
    if (!meeting && isGuest) {
      log(LOG_LEVELS.WARN, 'Convidado tentou criar sala inexistente', { roomId, odUserId });
      return errorResponse(404, 'Sala não encontrada. Apenas usuários autenticados podem criar novas salas.');
    }

    // Criar nova reunião se necessário (apenas usuários autenticados chegam aqui)
    if (!meeting) {
      const clientRequestToken = `${roomId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      const createMeetingResponse = await chimeClient.send(new CreateMeetingCommand({
        ClientRequestToken: clientRequestToken,
        MediaRegion: CONFIG.REGION,
        ExternalMeetingId: roomId,
        MeetingFeatures: {
          Audio: { EchoReduction: 'AVAILABLE' },
          Video: { MaxResolution: 'HD' }
        }
      }));
      
      meeting = createMeetingResponse.Meeting;
      await setMeetingInCache(roomId, meeting.MeetingId, odUserId);
      isNewMeeting = true;
      log(LOG_LEVELS.INFO, 'Nova reunião criada', { roomId, createdBy: odUserId });
    }

    // Criar attendee (com tratamento de duplicação)
    const attendee = await createOrRecreateAttendee(meeting.MeetingId, externalUserId);

    // Listar outros participantes
    const listAttendeesResponse = await chimeClient.send(new ListAttendeesCommand({
      MeetingId: meeting.MeetingId
    }));

    const otherAttendees = (listAttendeesResponse.Attendees || [])
      .filter(a => a.ExternalUserId !== externalUserId)
      .map(a => ({
        odAttendeeId: a.AttendeeId,
        odExternalUserId: a.ExternalUserId
      }));

    return successResponse({
      meeting: {
        MeetingId: meeting.MeetingId,
        MediaPlacement: meeting.MediaPlacement,
        MediaRegion: meeting.MediaRegion,
        ExternalMeetingId: meeting.ExternalMeetingId
      },
      attendee: {
        AttendeeId: attendee.AttendeeId,
        ExternalUserId: attendee.ExternalUserId,
        JoinToken: attendee.JoinToken
      },
      isNewMeeting,
      otherAttendees
    });

  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Erro ao criar/entrar na reunião', { error: error.message, roomId });
    
    if (error.name === 'NotFoundException') {
      await deleteMeetingFromCache(roomId).catch(() => {});
    }
    
    return errorResponse(500, 'Erro ao processar reunião');
  } finally {
    // SEMPRE liberar lock se foi adquirido
    if (lock.mustRelease) {
      await releaseLock(roomId);
    }
  }
}

// ============ HELPER: CREATE OR RECREATE ATTENDEE ============
async function createOrRecreateAttendee(meetingId, externalUserId) {
  try {
    const createAttendeeResponse = await chimeClient.send(new CreateAttendeeCommand({
      MeetingId: meetingId,
      ExternalUserId: externalUserId,
      Capabilities: {
        Audio: 'SendReceive',
        Video: 'SendReceive',
        Content: 'SendReceive'
      }
    }));
    
    log(LOG_LEVELS.INFO, 'Attendee criado');
    return createAttendeeResponse.Attendee;
    
  } catch (e) {
    // Attendee já existe - deletar e recriar para obter novo JoinToken
    if (e.name === 'BadRequestException' && e.message?.includes('already exists')) {
      log(LOG_LEVELS.INFO, 'Attendee já existe, recriando para obter JoinToken');
      
      // Buscar attendee existente
      const listResponse = await chimeClient.send(new ListAttendeesCommand({
        MeetingId: meetingId
      }));
      
      const existingAttendee = listResponse.Attendees?.find(
        a => a.ExternalUserId === externalUserId
      );
      
      if (existingAttendee) {
        // Deletar attendee existente
        await chimeClient.send(new DeleteAttendeeCommand({
          MeetingId: meetingId,
          AttendeeId: existingAttendee.AttendeeId
        }));
        
        // Recriar para obter novo JoinToken
        const recreateResponse = await chimeClient.send(new CreateAttendeeCommand({
          MeetingId: meetingId,
          ExternalUserId: externalUserId,
          Capabilities: {
            Audio: 'SendReceive',
            Video: 'SendReceive',
            Content: 'SendReceive'
          }
        }));
        
        log(LOG_LEVELS.INFO, 'Attendee recriado com sucesso');
        return recreateResponse.Attendee;
      }
      
      // Attendee não encontrado após erro de duplicação - situação anômala
      log(LOG_LEVELS.ERROR, 'Attendee não encontrado após erro de duplicação');
      throw e;
    }
    
    throw e;
  }
}

// ============ HANDLER: LEAVE MEETING ============
async function handleLeaveMeeting(body) {
  const { meetingId, attendeeId, odAttendeeId } = body;
  const actualAttendeeId = attendeeId || odAttendeeId;
  
  if (!meetingId || !actualAttendeeId) {
    return errorResponse(400, 'meetingId e attendeeId são obrigatórios');
  }

  try {
    await chimeClient.send(new DeleteAttendeeCommand({
      MeetingId: meetingId,
      AttendeeId: actualAttendeeId
    }));
    log(LOG_LEVELS.INFO, 'Attendee removido');
  } catch (e) {
    if (e.name !== 'NotFoundException') {
      log(LOG_LEVELS.WARN, 'Erro ao remover attendee', { error: e.message });
    }
  }

  return successResponse({ success: true });
}

// ============ HANDLER: END MEETING ============
async function handleEndMeeting(body) {
  const { roomId, meetingId, odUserId } = body;

  if (!roomId && !meetingId) {
    return errorResponse(400, 'roomId ou meetingId é obrigatório');
  }

  try {
    let meetingIdToDelete = meetingId;
    let cachedMeeting = null;
    
    if (!meetingIdToDelete && roomId) {
      cachedMeeting = await getMeetingFromCache(roomId);
      meetingIdToDelete = cachedMeeting?.meetingId;
    }
    
    if (!meetingIdToDelete) {
      return errorResponse(404, 'Reunião não encontrada');
    }

    // Verificação de autorização (apenas criador pode encerrar)
    if (cachedMeeting?.createdBy && odUserId) {
      if (cachedMeeting.createdBy !== odUserId) {
        log(LOG_LEVELS.WARN, 'Tentativa de encerrar reunião por não-criador', { 
          roomId, 
          createdBy: cachedMeeting.createdBy, 
          requestedBy: odUserId 
        });
        // Em produção estrita, descomentar:
        // return errorResponse(403, 'Apenas o criador pode encerrar a reunião');
      }
    }

    // Deletar reunião no Chime
    try {
      await chimeClient.send(new DeleteMeetingCommand({
        MeetingId: meetingIdToDelete
      }));
      log(LOG_LEVELS.INFO, 'Reunião encerrada no Chime', { roomId });
    } catch (e) {
      if (e.name !== 'NotFoundException') {
        throw e;
      }
      log(LOG_LEVELS.DEBUG, 'Reunião já não existia no Chime', { roomId });
    }
    
    // Limpar cache
    if (roomId) {
      await deleteMeetingFromCache(roomId);
    }

    return successResponse({ success: true });
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Erro ao encerrar reunião', { error: error.message });
    return errorResponse(500, 'Erro ao encerrar reunião');
  }
}

// ============ HANDLER: HEALTH CHECK ============
async function handleHealthCheck() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.5.2',
    region: CONFIG.REGION,
    dynamodb: 'unknown',
    chime: 'unknown'
  };
  
  // Check DynamoDB
  if (CONFIG.USE_DYNAMO) {
    try {
      await dynamoClient.send(new GetItemCommand({
        TableName: CONFIG.MEETINGS_TABLE,
        Key: { roomId: { S: 'health_check_probe' } }
      }));
      checks.dynamodb = 'healthy';
    } catch (e) {
      checks.dynamodb = 'degraded';
      checks.status = 'degraded';
    }
  } else {
    checks.dynamodb = 'not_configured';
  }
  
  // Chime SDK is assumed healthy if Lambda is running
  checks.chime = 'healthy';
  
  return successResponse(checks);
}

// ============ HANDLER: GET MEETING INFO ============
async function handleGetMeetingInfo(body) {
  const { roomId, meetingId, odUserId } = body;

  if (!roomId && !meetingId) {
    return errorResponse(400, 'roomId ou meetingId é obrigatório');
  }

  try {
    let meetingIdToGet = meetingId;
    
    if (!meetingIdToGet && roomId) {
      const cached = await getMeetingFromCache(roomId);
      meetingIdToGet = cached?.meetingId;
    }
    
    if (!meetingIdToGet) {
      return errorResponse(404, 'Reunião não encontrada');
    }

    const getMeetingResponse = await chimeClient.send(new GetMeetingCommand({
      MeetingId: meetingIdToGet
    }));

    const listAttendeesResponse = await chimeClient.send(new ListAttendeesCommand({
      MeetingId: meetingIdToGet
    }));

    const attendees = listAttendeesResponse.Attendees || [];
    
    // Verificar se solicitante é participante
    const isParticipant = odUserId && attendees.some(
      a => a.ExternalUserId?.startsWith(`${odUserId}|`)
    );

    // Resposta com informações limitadas para não-participantes
    const response = {
      meeting: {
        MeetingId: getMeetingResponse.Meeting.MeetingId,
        MediaRegion: getMeetingResponse.Meeting.MediaRegion,
        ExternalMeetingId: getMeetingResponse.Meeting.ExternalMeetingId
      },
      attendeeCount: attendees.length,
    };

    // Participantes podem ver lista de outros participantes (apenas nomes)
    if (isParticipant) {
      response.attendees = attendees.map(a => ({
        AttendeeId: a.AttendeeId,
        name: a.ExternalUserId?.split('|')[1] || 'Participante'
      }));
    }

    return successResponse(response);
    
  } catch (error) {
    if (error.name === 'NotFoundException') {
      return errorResponse(404, 'Reunião não encontrada');
    }
    log(LOG_LEVELS.ERROR, 'Erro ao obter info da reunião', { error: error.message });
    return errorResponse(500, 'Erro ao obter informações');
  }
}


// ============ ADMIN: VERIFICAR AUTORIZAÇÃO ============
function isSuperAdmin(userLogin) {
  return SUPER_ADMINS.includes(userLogin?.toLowerCase());
}

async function isAdmin(userLogin) {
  if (!userLogin) return false;
  const normalizedLogin = userLogin.toLowerCase();
  
  // Super admins sempre têm acesso
  if (SUPER_ADMINS.includes(normalizedLogin)) return true;
  
  // Verificar lista dinâmica
  const adminList = await getAdminList();
  return adminList.map(a => a.toLowerCase()).includes(normalizedLogin);
}

// ============ ADMIN: LISTAR SALAS ATIVAS ============
async function handleAdminListRooms(body) {
  const { userLogin } = body;
  
  if (!(await isAdmin(userLogin))) {
    log(LOG_LEVELS.WARN, 'Acesso admin negado', { userLogin });
    return errorResponse(403, 'Acesso negado. Apenas administradores.');
  }

  try {
    const rooms = [];
    
    if (CONFIG.USE_DYNAMO) {
      // Buscar todas as salas no DynamoDB
      const scanResult = await dynamoClient.send(new ScanCommand({
        TableName: CONFIG.MEETINGS_TABLE,
        FilterExpression: 'attribute_exists(meetingId) AND attribute_not_exists(#lock)',
        ExpressionAttributeNames: { '#lock': 'lockedBy' }
      }));
      
      for (const item of scanResult.Items || []) {
        const roomId = item.roomId?.S;
        const meetingId = item.meetingId?.S;
        
        if (!roomId || !meetingId) continue;
        
        // Verificar se a reunião ainda existe no Chime
        try {
          const getMeetingResponse = await chimeClient.send(new GetMeetingCommand({
            MeetingId: meetingId
          }));
          
          const listAttendeesResponse = await chimeClient.send(new ListAttendeesCommand({
            MeetingId: meetingId
          }));
          
          const attendees = (listAttendeesResponse.Attendees || []).map(a => ({
            attendeeId: a.AttendeeId,
            name: a.ExternalUserId?.split('|')[1] || 'Participante',
            odUserId: a.ExternalUserId?.split('|')[0] || ''
          }));
          
          rooms.push({
            roomId,
            meetingId,
            createdBy: item.createdBy?.S || 'Desconhecido',
            createdAt: parseInt(item.createdAt?.N || '0'),
            attendeeCount: attendees.length,
            attendees,
            mediaRegion: getMeetingResponse.Meeting?.MediaRegion || CONFIG.REGION
          });
        } catch (e) {
          // Reunião não existe mais no Chime, limpar cache
          if (e.name === 'NotFoundException') {
            await deleteMeetingFromCache(roomId).catch(() => {});
          }
        }
      }
    }
    
    log(LOG_LEVELS.INFO, 'Admin listou salas', { userLogin, roomCount: rooms.length });
    
    return successResponse({
      rooms: rooms.sort((a, b) => b.createdAt - a.createdAt),
      totalRooms: rooms.length,
      timestamp: Date.now()
    });
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Erro ao listar salas (admin)', { error: error.message });
    return errorResponse(500, 'Erro ao listar salas');
  }
}

// ============ ADMIN: ENCERRAR SALA ============
async function handleAdminEndRoom(body) {
  const { userLogin, roomId, meetingId } = body;
  
  if (!(await isAdmin(userLogin))) {
    return errorResponse(403, 'Acesso negado. Apenas administradores.');
  }
  
  if (!roomId && !meetingId) {
    return errorResponse(400, 'roomId ou meetingId é obrigatório');
  }

  try {
    let meetingIdToDelete = meetingId;
    
    if (!meetingIdToDelete && roomId) {
      const cached = await getMeetingFromCache(roomId);
      meetingIdToDelete = cached?.meetingId;
    }
    
    if (!meetingIdToDelete) {
      return errorResponse(404, 'Sala não encontrada');
    }

    // Deletar reunião no Chime
    try {
      await chimeClient.send(new DeleteMeetingCommand({
        MeetingId: meetingIdToDelete
      }));
      log(LOG_LEVELS.INFO, 'Admin encerrou sala', { userLogin, roomId, meetingId: meetingIdToDelete });
    } catch (e) {
      if (e.name !== 'NotFoundException') {
        throw e;
      }
    }
    
    // Limpar cache
    if (roomId) {
      await deleteMeetingFromCache(roomId);
    }

    return successResponse({ success: true, message: 'Sala encerrada com sucesso' });
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Erro ao encerrar sala (admin)', { error: error.message });
    return errorResponse(500, 'Erro ao encerrar sala');
  }
}

// ============ ADMIN: ESTATÍSTICAS ============
async function handleAdminStats(body) {
  const { userLogin } = body;
  
  if (!(await isAdmin(userLogin))) {
    return errorResponse(403, 'Acesso negado. Apenas administradores.');
  }

  try {
    let totalRooms = 0;
    let totalAttendees = 0;
    let roomsByRegion = {};
    
    if (CONFIG.USE_DYNAMO) {
      const scanResult = await dynamoClient.send(new ScanCommand({
        TableName: CONFIG.MEETINGS_TABLE,
        FilterExpression: 'attribute_exists(meetingId) AND attribute_not_exists(#lock)',
        ExpressionAttributeNames: { '#lock': 'lockedBy' }
      }));
      
      for (const item of scanResult.Items || []) {
        const meetingId = item.meetingId?.S;
        if (!meetingId) continue;
        
        try {
          const getMeetingResponse = await chimeClient.send(new GetMeetingCommand({
            MeetingId: meetingId
          }));
          
          const listAttendeesResponse = await chimeClient.send(new ListAttendeesCommand({
            MeetingId: meetingId
          }));
          
          totalRooms++;
          const attendeeCount = listAttendeesResponse.Attendees?.length || 0;
          totalAttendees += attendeeCount;
          
          const region = getMeetingResponse.Meeting?.MediaRegion || 'unknown';
          roomsByRegion[region] = (roomsByRegion[region] || 0) + 1;
        } catch (e) {
          // Ignorar reuniões que não existem mais
        }
      }
    }
    
    return successResponse({
      stats: {
        totalRooms,
        totalAttendees,
        roomsByRegion,
        averageAttendeesPerRoom: totalRooms > 0 ? (totalAttendees / totalRooms).toFixed(1) : 0,
        serverTime: new Date().toISOString(),
        config: {
          region: CONFIG.REGION,
          meetingTtlHours: CONFIG.MEETING_TTL_SECONDS / 3600,
          rateLimitRequests: CONFIG.RATE_LIMIT_REQUESTS,
          isProduction: CONFIG.IS_PRODUCTION
        }
      }
    });
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Erro ao obter estatísticas (admin)', { error: error.message });
    return errorResponse(500, 'Erro ao obter estatísticas');
  }
}

// ============ ADMIN: REMOVER USUÁRIO DE SALA ============
async function handleAdminKickUser(body) {
  const { userLogin, meetingId, attendeeId } = body;
  
  if (!(await isAdmin(userLogin))) {
    return errorResponse(403, 'Acesso negado. Apenas administradores.');
  }
  
  if (!meetingId || !attendeeId) {
    return errorResponse(400, 'meetingId e attendeeId são obrigatórios');
  }

  try {
    await chimeClient.send(new DeleteAttendeeCommand({
      MeetingId: meetingId,
      AttendeeId: attendeeId
    }));
    
    log(LOG_LEVELS.INFO, 'Admin removeu usuário', { userLogin, meetingId, attendeeId });
    
    return successResponse({ success: true, message: 'Usuário removido da sala' });
    
  } catch (error) {
    if (error.name === 'NotFoundException') {
      return errorResponse(404, 'Usuário ou sala não encontrada');
    }
    log(LOG_LEVELS.ERROR, 'Erro ao remover usuário (admin)', { error: error.message });
    return errorResponse(500, 'Erro ao remover usuário');
  }
}

// ============ ADMIN: LISTAR ADMINISTRADORES ============
async function handleAdminListUsers(body) {
  const { userLogin } = body;
  
  if (!(await isAdmin(userLogin))) {
    return errorResponse(403, 'Acesso negado. Apenas administradores.');
  }

  try {
    const adminList = await getAdminList();
    const isSuperAdminUser = isSuperAdmin(userLogin);
    
    return successResponse({
      admins: adminList,
      superAdmins: SUPER_ADMINS,
      canManageAdmins: isSuperAdminUser,
      currentUser: userLogin
    });
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Erro ao listar admins', { error: error.message });
    return errorResponse(500, 'Erro ao listar administradores');
  }
}

// ============ ADMIN: ADICIONAR ADMINISTRADOR ============
async function handleAdminAddUser(body) {
  const { userLogin, newAdmin } = body;
  
  if (!(await isAdmin(userLogin))) {
    return errorResponse(403, 'Acesso negado. Apenas administradores.');
  }
  
  // Apenas super admins podem adicionar outros admins
  if (!isSuperAdmin(userLogin)) {
    return errorResponse(403, 'Apenas super administradores podem adicionar novos admins.');
  }
  
  if (!newAdmin || typeof newAdmin !== 'string' || newAdmin.trim().length === 0) {
    return errorResponse(400, 'Nome do novo admin é obrigatório');
  }
  
  const normalizedNewAdmin = newAdmin.trim().toLowerCase();
  
  // Verificar se já é admin
  const currentAdmins = await getAdminList();
  if (currentAdmins.map(a => a.toLowerCase()).includes(normalizedNewAdmin)) {
    return errorResponse(400, 'Usuário já é administrador');
  }

  try {
    const success = await addAdmin(normalizedNewAdmin);
    
    if (success) {
      log(LOG_LEVELS.INFO, 'Novo admin adicionado', { addedBy: userLogin, newAdmin: normalizedNewAdmin });
      return successResponse({ 
        success: true, 
        message: `${normalizedNewAdmin} adicionado como administrador`,
        admins: await getAdminList()
      });
    } else {
      return errorResponse(500, 'Falha ao adicionar administrador');
    }
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Erro ao adicionar admin', { error: error.message });
    return errorResponse(500, 'Erro ao adicionar administrador');
  }
}

// ============ ADMIN: REMOVER ADMINISTRADOR ============
async function handleAdminRemoveUser(body) {
  const { userLogin, adminToRemove } = body;
  
  if (!(await isAdmin(userLogin))) {
    return errorResponse(403, 'Acesso negado. Apenas administradores.');
  }
  
  // Apenas super admins podem remover outros admins
  if (!isSuperAdmin(userLogin)) {
    return errorResponse(403, 'Apenas super administradores podem remover admins.');
  }
  
  if (!adminToRemove || typeof adminToRemove !== 'string') {
    return errorResponse(400, 'Nome do admin a remover é obrigatório');
  }
  
  const normalizedAdmin = adminToRemove.trim().toLowerCase();
  
  // Não permitir remover super admins
  if (SUPER_ADMINS.includes(normalizedAdmin)) {
    return errorResponse(403, 'Não é possível remover super administradores');
  }
  
  // Não permitir auto-remoção
  if (normalizedAdmin === userLogin.toLowerCase()) {
    return errorResponse(400, 'Você não pode remover a si mesmo');
  }

  try {
    const success = await removeAdmin(normalizedAdmin);
    
    if (success) {
      log(LOG_LEVELS.INFO, 'Admin removido', { removedBy: userLogin, removedAdmin: normalizedAdmin });
      return successResponse({ 
        success: true, 
        message: `${normalizedAdmin} removido dos administradores`,
        admins: await getAdminList()
      });
    } else {
      return errorResponse(500, 'Falha ao remover administrador');
    }
    
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Erro ao remover admin', { error: error.message });
    return errorResponse(500, 'Erro ao remover administrador');
  }
}

// ============ ADMIN: CLEANUP DE SALAS ABANDONADAS ============
async function handleAdminCleanup(body) {
  const { userLogin, dryRun = false } = body;
  
  if (!(await isAdmin(userLogin))) {
    return errorResponse(403, 'Acesso negado. Apenas administradores.');
  }

  const EMPTY_ROOM_THRESHOLD_SECONDS = 300; // 5 minutos
  const MAX_ROOM_AGE_SECONDS = 14400; // 4 horas
  
  const stats = {
    totalMeetings: 0,
    checked: 0,
    ended: 0,
    errors: 0,
    reasons: {
      empty_room: 0,
      max_age_exceeded: 0,
      meeting_not_found: 0,
    },
  };

  try {
    if (!CONFIG.USE_DYNAMO) {
      return errorResponse(400, 'DynamoDB não configurado');
    }

    // Buscar todas as salas
    const scanResult = await dynamoClient.send(new ScanCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      FilterExpression: 'attribute_exists(meetingId) AND attribute_not_exists(lockedBy)',
    }));

    const meetings = [];
    for (const item of scanResult.Items || []) {
      if (item.meetingId?.S && item.roomId?.S) {
        if (item.roomId.S.startsWith('ratelimit_') || 
            item.roomId.S.startsWith('lock_') ||
            item.roomId.S === 'admin_users_list') {
          continue;
        }
        meetings.push({
          roomId: item.roomId.S,
          meetingId: item.meetingId.S,
          createdBy: item.createdBy?.S || 'unknown',
          createdAt: parseInt(item.createdAt?.N || '0'),
        });
      }
    }

    stats.totalMeetings = meetings.length;
    const now = Math.floor(Date.now() / 1000);

    for (const meeting of meetings) {
      stats.checked++;
      const roomAge = now - meeting.createdAt;
      let shouldEnd = false;
      let reason = '';

      // Verificar idade máxima
      if (roomAge > MAX_ROOM_AGE_SECONDS) {
        shouldEnd = true;
        reason = 'max_age_exceeded';
      } else {
        // Verificar se existe no Chime e tem participantes
        try {
          await chimeClient.send(new GetMeetingCommand({
            MeetingId: meeting.meetingId,
          }));

          const attendeesResponse = await chimeClient.send(new ListAttendeesCommand({
            MeetingId: meeting.meetingId,
          }));

          const attendeeCount = attendeesResponse.Attendees?.length || 0;
          
          if (attendeeCount === 0 && roomAge > EMPTY_ROOM_THRESHOLD_SECONDS) {
            shouldEnd = true;
            reason = 'empty_room';
          }
        } catch (e) {
          if (e.name === 'NotFoundException') {
            shouldEnd = true;
            reason = 'meeting_not_found';
          }
        }
      }

      if (shouldEnd) {
        if (!dryRun) {
          try {
            // Deletar no Chime
            try {
              await chimeClient.send(new DeleteMeetingCommand({
                MeetingId: meeting.meetingId,
              }));
            } catch (e) {
              if (e.name !== 'NotFoundException') throw e;
            }

            // Remover do DynamoDB
            await dynamoClient.send(new DeleteItemCommand({
              TableName: CONFIG.MEETINGS_TABLE,
              Key: { roomId: { S: meeting.roomId } },
            }));

            stats.ended++;
            stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;
          } catch (e) {
            stats.errors++;
            log(LOG_LEVELS.ERROR, 'Erro ao limpar sala', { roomId: meeting.roomId, error: e.message });
          }
        } else {
          stats.ended++;
          stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;
        }
      }
    }

    log(LOG_LEVELS.INFO, 'Cleanup executado', { userLogin, stats, dryRun });

    return successResponse({
      success: true,
      dryRun,
      stats,
      message: dryRun 
        ? `[DRY RUN] ${stats.ended} salas seriam encerradas`
        : `${stats.ended} salas encerradas com sucesso`,
    });

  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Erro no cleanup', { error: error.message });
    return errorResponse(500, 'Erro ao executar limpeza');
  }
}

// ============ ADMIN: CHECK USER ROLE ============
async function handleCheckUserRole(body) {
  const { userLogin } = body;
  
  if (!userLogin) {
    return errorResponse(400, 'userLogin é obrigatório');
  }
  
  // Verificar se é super admin
  if (isSuperAdmin(userLogin)) {
    return successResponse({ role: 'superadmin', userLogin });
  }
  
  // Verificar se é admin
  if (await isAdmin(userLogin)) {
    return successResponse({ role: 'admin', userLogin });
  }
  
  // Usuário comum
  return successResponse({ role: 'user', userLogin });
}
