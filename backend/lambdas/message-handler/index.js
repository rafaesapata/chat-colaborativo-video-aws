const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

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
  const { roomId, userId, content, userName } = body;

  logger.info('Handling send message', { connectionId, roomId, userId, userName });

  if (!roomId || !userId || !content) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  try {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = Date.now();

    // Salvar mensagem
    await ddb.send(new PutCommand({
      TableName: MESSAGES_TABLE,
      Item: {
        messageId,
        roomId,
        userId,
        userName: userName || `User ${userId.substring(userId.length - 4)}`,
        content,
        timestamp,
        type: 'text',
        ttl: Math.floor(Date.now() / 1000) + 86400 // 24 horas
      }
    }));

    // Enviar para todos na sala
    await notifyRoomUsers(roomId, {
      type: 'message',
      data: {
        messageId,
        roomId,
        userId,
        userName: userName || `User ${userId.substring(userId.length - 4)}`,
        content,
        timestamp
      }
    });

    logger.info('Message sent successfully', { messageId, roomId });
    return { statusCode: 200, body: 'Message sent' };

  } catch (error) {
    logger.error('Error sending message', error);
    return { statusCode: 500, body: 'Failed to send message' };
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

  logger.info('Handling WebRTC signal', { connectionId, roomId, userId, targetUserId, type });

  try {
    // Enviar sinal WebRTC para todos na sala ou usuário específico
    const message = {
      type: 'webrtc-signal',
      roomId,
      userId,
      signal,
      signalType: type
    };

    if (targetUserId) {
      // Enviar para usuário específico
      await notifySpecificUser(targetUserId, message);
    } else {
      // Enviar para todos na sala
      await notifyRoomUsers(roomId, message, connectionId);
    }

    return { statusCode: 200, body: 'Signal sent' };

  } catch (error) {
    logger.error('Error handling WebRTC signal', error);
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
    // Buscar todas as conexões da sala
    const result = await ddb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'RoomConnectionsIndex',
      KeyConditionExpression: 'roomId = :roomId',
      ExpressionAttributeValues: { ':roomId': roomId }
    }));

    const connections = result.Items || [];
    logger.info('Notifying room users', { roomId, connectionCount: connections.length });

    // Criar cliente API Gateway
    const apiGateway = new ApiGatewayManagementApiClient({
      endpoint: `https://${process.env.API_GATEWAY_DOMAIN_NAME}/${process.env.STAGE}`
    });

    // Enviar mensagem para cada conexão
    const promises = connections
      .filter(conn => conn.connectionId !== excludeConnectionId)
      .map(async (connection) => {
        try {
          await apiGateway.send(new PostToConnectionCommand({
            ConnectionId: connection.connectionId,
            Data: JSON.stringify(message)
          }));
        } catch (error) {
          if (error.statusCode === 410) {
            // Conexão morta, remover do banco
            logger.info('Removing stale connection', { connectionId: connection.connectionId });
            await ddb.send(new DeleteCommand({
              TableName: CONNECTIONS_TABLE,
              Key: { connectionId: connection.connectionId }
            }));
          } else {
            logger.error('Error sending message to connection', { 
              connectionId: connection.connectionId, 
              error: error.message 
            });
          }
        }
      });

    await Promise.allSettled(promises);

  } catch (error) {
    logger.error('Error notifying room users', error);
  }
}

async function notifySpecificUser(userId, message) {
  try {
    // Buscar conexão do usuário específico
    const result = await ddb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'UserConnectionsIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    }));

    const connections = result.Items || [];
    
    if (connections.length === 0) {
      logger.warn('No connections found for user', { userId });
      return;
    }

    // Criar cliente API Gateway
    const apiGateway = new ApiGatewayManagementApiClient({
      endpoint: `https://${process.env.API_GATEWAY_DOMAIN_NAME}/${process.env.STAGE}`
    });

    // Enviar para todas as conexões do usuário
    const promises = connections.map(async (connection) => {
      try {
        await apiGateway.send(new PostToConnectionCommand({
          ConnectionId: connection.connectionId,
          Data: JSON.stringify(message)
        }));
      } catch (error) {
        if (error.statusCode === 410) {
          // Conexão morta, remover do banco
          logger.info('Removing stale connection', { connectionId: connection.connectionId });
          await ddb.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: connection.connectionId }
          }));
        } else {
          logger.error('Error sending message to user connection', { 
            connectionId: connection.connectionId, 
            error: error.message 
          });
        }
      }
    });

    await Promise.allSettled(promises);

  } catch (error) {
    logger.error('Error notifying specific user', error);
  }
}