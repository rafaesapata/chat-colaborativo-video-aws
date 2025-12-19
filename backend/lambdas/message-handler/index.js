const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

// SEC-003: Importar sanitização e validação
const { sanitizeContent, sanitizeUserName } = require('../../shared/lib/sanitizer');
const { validateInput, messageSchema, ValidationError } = require('../../shared/lib/validation');
const { withRetry } = require('../../shared/lib/resilience');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const TRANSCRIPTIONS_TABLE = process.env.TRANSCRIPTIONS_TABLE;
const ROOM_EVENTS_TABLE = process.env.ROOM_EVENTS_TABLE;

// Logger simples
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg, error) => console.error(`[ERROR] ${msg}`, error || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || '')
};

exports.handler = async (event) => {
  const { connectionId, routeKey } = event.requestContext;
  
  logger.info('Message handler invoked', { 
    connectionId, 
    routeKey,
    body: event.body 
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const { action } = body;

    switch (action) {
      case 'sendMessage':
        return await handleSendMessage(event, body);
      case 'sendAudio':
        return await handleSendAudio(event, body);
      case 'webrtc-signal':
        return await handleWebRTCSignal(event, body);
      case 'ping':
        return await handlePing(event, body);
      default:
        logger.warn('Unknown action', { action });
        return { statusCode: 400, body: 'Unknown action' };
    }
  } catch (error) {
    logger.error('Handler error', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

async function handleSendMessage(event, body) {
  const { connectionId } = event.requestContext;
  const { roomId, userId, content, userName, type, transcribedText, isPartial, timestamp } = body;

  logger.info('Handling send message', { connectionId, roomId, userId, userName, type });

  // ✅ Suporte para transcrições
  if (type === 'transcription') {
    return await handleTranscription(event, body);
  }

  if (!roomId || !userId || !content) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  try {
    // SEC-003: SANITIZAÇÃO OBRIGATÓRIA
    const sanitizedContent = sanitizeContent(content);
    const sanitizedUserName = sanitizeUserName(userName);

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const msgTimestamp = Date.now();

    // RES-004: Salvar mensagem com retry
    await withRetry(async () => {
      await ddb.send(new PutCommand({
        TableName: MESSAGES_TABLE,
        Item: {
          messageId,
          roomId,
          userId,
          userName: sanitizedUserName,
          content: sanitizedContent,
          timestamp: msgTimestamp,
          type: 'text',
          ttl: Math.floor(Date.now() / 1000) + 86400 // 24 horas
        }
      }));
    }, { retries: 3 });

    // Enviar para todos na sala com conteúdo sanitizado
    await notifyRoomUsers(roomId, {
      type: 'message',
      data: {
        messageId,
        roomId,
        userId,
        userName: sanitizedUserName,
        content: sanitizedContent,
        timestamp: msgTimestamp
      }
    });

    logger.info('Message sent successfully', { messageId, roomId });
    return { statusCode: 200, body: 'Message sent' };

  } catch (error) {
    if (error instanceof ValidationError) {
      logger.warn('Validation error', { error: error.message });
      return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
    logger.error('Error sending message', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error', requestId: event.requestContext.requestId }) };
  }
}

// ✅ NOVO: Handler para transcrições em tempo real
async function handleTranscription(event, body) {
  const { connectionId } = event.requestContext;
  const { roomId, userId, userName, transcribedText, isPartial, timestamp } = body;

  logger.info('Handling transcription', { connectionId, roomId, userId, userName, isPartial });

  if (!roomId || !userId || !transcribedText) {
    return { statusCode: 400, body: 'Missing required fields for transcription' };
  }

  try {
    const transcriptionId = `trans_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const transcriptionTimestamp = timestamp || Date.now();

    // ✅ SALVAR TRANSCRIÇÃO NO DYNAMODB (apenas transcrições finais, não parciais)
    if (!isPartial && TRANSCRIPTIONS_TABLE) {
      try {
        await ddb.send(new PutCommand({
          TableName: TRANSCRIPTIONS_TABLE,
          Item: {
            transcriptionId,
            roomId,
            userId,
            userName: userName || `User ${userId.substring(userId.length - 4)}`,
            text: transcribedText,
            timestamp: transcriptionTimestamp,
            type: 'speech',
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 dias
          }
        }));
        logger.info('✅ Transcription saved to DynamoDB', { transcriptionId, roomId });
      } catch (dbError) {
        logger.error('❌ Error saving transcription to DynamoDB', dbError);
        // Continuar mesmo se falhar o salvamento
      }
    }

    // Enviar transcrição para todos na sala (incluindo o remetente para confirmação)
    await notifyRoomUsers(roomId, {
      type: 'transcription',
      data: {
        transcriptionId,
        roomId,
        userId,
        userName: userName || `User ${userId.substring(userId.length - 4)}`,
        transcribedText,
        isPartial: isPartial || false,
        timestamp: transcriptionTimestamp
      }
    }, null); // Não excluir ninguém - enviar para todos

    logger.info('Transcription broadcast successfully', { transcriptionId, roomId, isPartial });
    return { statusCode: 200, body: 'Transcription sent' };

  } catch (error) {
    logger.error('Error sending transcription', error);
    return { statusCode: 500, body: 'Failed to send transcription' };
  }
}

async function handleSendAudio(event, body) {
  const { connectionId } = event.requestContext;
  const { roomId, userId, audioData, language } = body;

  logger.info('Handling send audio', { connectionId, roomId, userId, language });

  // Por enquanto, apenas log - implementação completa depois
  logger.info('Audio data received', { 
    roomId, 
    userId, 
    audioDataLength: audioData ? audioData.length : 0 
  });

  return { statusCode: 200, body: 'Audio received' };
}

async function handleWebRTCSignal(event, body) {
  const { connectionId } = event.requestContext;
  const { roomId, userId, targetUserId, signal, type } = body;

  logger.info('🎯 Handling WebRTC signal', { 
    connectionId, 
    roomId, 
    userId, 
    targetUserId, 
    signalType: type,
    hasSignal: !!signal,
    fullBody: JSON.stringify(body)
  });

  try {
    // ✅ NOVO: Tratar request-participants - responder com lista de participantes
    if (type === 'request-participants' || signal?.type === 'request-participants') {
      logger.info('📋 Solicitação de participantes recebida de:', userId);
      
      // Buscar todos os participantes da sala
      const participantsResult = await ddb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        IndexName: 'RoomConnectionsIndex',
        KeyConditionExpression: 'roomId = :roomId',
        ExpressionAttributeValues: { ':roomId': roomId }
      }));

      const participants = (participantsResult.Items || []).map(item => item.userId);
      const existingParticipants = participants.filter(p => p !== userId);

      logger.info('📋 Participantes encontrados:', { 
        total: participants.length, 
        existing: existingParticipants.length,
        existingParticipants 
      });

      // Enviar resposta diretamente para o usuário que solicitou
      const apiGateway = new ApiGatewayManagementApiClient({
        endpoint: `https://${process.env.API_GATEWAY_DOMAIN_NAME}/${process.env.STAGE}`
      });

      const responseMessage = {
        type: 'room_event',
        data: {
          eventType: 'participants_list',
          userId,
          roomId,
          participants,
          existingParticipants,
          timestamp: Date.now()
        }
      };

      await apiGateway.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(responseMessage)
      }));

      logger.info('✅ Lista de participantes enviada para:', userId);
      return { statusCode: 200, body: 'Participants list sent' };
    }

    // ✅ CORREÇÃO: Manter estrutura consistente com o frontend
    const message = {
      type: 'webrtc-signal',
      roomId,
      userId,
      signal: signal || { type }  // Garantir que signal.type existe
    };

    logger.info('📤 Mensagem WebRTC preparada:', JSON.stringify(message));

    if (targetUserId) {
      // Enviar para usuário específico
      logger.info('🎯 Tentando enviar para usuário específico:', targetUserId);
      const sent = await notifySpecificUser(targetUserId, message);
      
      // ✅ CORREÇÃO: Se não encontrar usuário, fazer broadcast para a sala
      if (!sent) {
        logger.warn('⚠️ Target user not found, broadcasting to room', { targetUserId, roomId });
        await notifyRoomUsers(roomId, message, connectionId);
      } else {
        logger.info('✅ Mensagem enviada com sucesso para usuário específico');
      }
    } else {
      // Broadcast para todos na sala (exceto remetente)
      logger.info('📢 Broadcasting para toda a sala:', roomId);
      await notifyRoomUsers(roomId, message, connectionId);
    }

    return { statusCode: 200, body: 'Signal sent' };

  } catch (error) {
    logger.error('❌ Error handling WebRTC signal', error);
    return { statusCode: 500, body: 'Failed to send signal' };
  }
}

async function handlePing(event, body) {
  const { connectionId } = event.requestContext;
  const { userId, roomId } = body;

  logger.info('Handling ping', { connectionId, userId, roomId });

  try {
    // Responder com pong
    const apiGateway = new ApiGatewayManagementApiClient({
      endpoint: `https://${process.env.API_GATEWAY_DOMAIN_NAME}/${process.env.STAGE}`
    });

    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({ type: 'pong', timestamp: Date.now() })
    }));

    return { statusCode: 200, body: 'Pong sent' };

  } catch (error) {
    logger.error('Error handling ping', error);
    return { statusCode: 500, body: 'Failed to send pong' };
  }
}

async function notifyRoomUsers(roomId, message, excludeConnectionId = null) {
  try {
    logger.info('🔍 Buscando conexões da sala:', roomId);
    
    // Buscar todas as conexões da sala
    const result = await ddb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'RoomConnectionsIndex',
      KeyConditionExpression: 'roomId = :roomId',
      ExpressionAttributeValues: { ':roomId': roomId }
    }));

    const connections = result.Items || [];
    logger.info('📋 Conexões encontradas na sala', { 
      roomId, 
      connectionCount: connections.length,
      connections: connections.map(c => ({ connectionId: c.connectionId, userId: c.userId }))
    });

    // Criar cliente API Gateway
    const apiGateway = new ApiGatewayManagementApiClient({
      endpoint: `https://${process.env.API_GATEWAY_DOMAIN_NAME}/${process.env.STAGE}`
    });

    // Enviar mensagem para cada conexão
    const promises = connections
      .filter(conn => {
        const shouldSend = conn.connectionId !== excludeConnectionId;
        if (!shouldSend) {
          logger.info('⏭️ Pulando conexão (remetente):', conn.connectionId);
        }
        return shouldSend;
      })
      .map(async (connection) => {
        try {
          logger.info('📤 Enviando mensagem para conexão:', { 
            connectionId: connection.connectionId, 
            userId: connection.userId 
          });
          
          await apiGateway.send(new PostToConnectionCommand({
            ConnectionId: connection.connectionId,
            Data: JSON.stringify(message)
          }));
          
          logger.info('✅ Mensagem enviada com sucesso para:', connection.connectionId);
        } catch (error) {
          if (error.statusCode === 410) {
            // Conexão morta, remover do banco
            logger.info('🗑️ Removing stale connection', { connectionId: connection.connectionId });
            await ddb.send(new DeleteCommand({
              TableName: CONNECTIONS_TABLE,
              Key: { connectionId: connection.connectionId }
            }));
          } else {
            logger.error('❌ Error sending message to connection', { 
              connectionId: connection.connectionId, 
              error: error.message 
            });
          }
        }
      });

    await Promise.allSettled(promises);
    logger.info('✅ Notificação da sala concluída');

  } catch (error) {
    logger.error('❌ Error notifying room users', error);
  }
}

async function notifySpecificUser(userId, message) {
  try {
    logger.info('🔍 Buscando conexões do usuário:', userId);
    
    // Buscar conexão do usuário específico
    const result = await ddb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'UserConnectionsIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    }));

    const connections = result.Items || [];
    
    if (connections.length === 0) {
      logger.warn('⚠️ No connections found for user', { userId });
      return false;  // ✅ RETORNAR false para indicar falha
    }

    logger.info('📋 Found connections for user', { 
      userId, 
      count: connections.length,
      connections: connections.map(c => ({ connectionId: c.connectionId, roomId: c.roomId }))
    });

    // Criar cliente API Gateway
    const apiGateway = new ApiGatewayManagementApiClient({
      endpoint: `https://${process.env.API_GATEWAY_DOMAIN_NAME}/${process.env.STAGE}`
    });

    let successCount = 0;

    // Enviar para todas as conexões do usuário
    const promises = connections.map(async (connection) => {
      try {
        logger.info('📤 Enviando para conexão do usuário:', { 
          connectionId: connection.connectionId,
          userId 
        });
        
        await apiGateway.send(new PostToConnectionCommand({
          ConnectionId: connection.connectionId,
          Data: JSON.stringify(message)
        }));
        
        successCount++;
        logger.info('✅ Message sent to connection', { connectionId: connection.connectionId });
      } catch (error) {
        if (error.statusCode === 410) {
          // Conexão morta, remover do banco
          logger.info('🗑️ Removing stale connection', { connectionId: connection.connectionId });
          await ddb.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: connection.connectionId }
          }));
        } else {
          logger.error('❌ Error sending message to user connection', { 
            connectionId: connection.connectionId, 
            error: error.message 
          });
        }
      }
    });

    await Promise.allSettled(promises);
    
    logger.info(`✅ Notificação específica concluída - ${successCount}/${connections.length} enviadas`);
    
    return successCount > 0;  // ✅ RETORNAR true se pelo menos uma mensagem foi enviada

  } catch (error) {
    logger.error('❌ Error notifying specific user', error);
    return false;  // ✅ RETORNAR false em caso de erro
  }
}