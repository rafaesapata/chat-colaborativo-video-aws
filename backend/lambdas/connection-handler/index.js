const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, UpdateCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;
const ROOM_EVENTS_TABLE = process.env.ROOM_EVENTS_TABLE;

// Logger simples
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg, error) => console.error(`[ERROR] ${msg}`, error || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || '')
};

exports.handler = async (event) => {
  const { connectionId, eventType, routeKey, requestId } = event.requestContext;
  
  logger.info('Connection handler invoked', { 
    connectionId, 
    eventType, 
    routeKey,
    requestId 
  });

  try {
    switch (eventType) {
      case 'CONNECT':
        return await handleConnect(event);
      case 'DISCONNECT':
        return await handleDisconnect(event);
      default:
        logger.warn('Unknown event type', { eventType });
        return { statusCode: 400, body: 'Unknown event type' };
    }
  } catch (error) {
    logger.error('Handler error', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

async function handleConnect(event) {
  const { connectionId } = event.requestContext;
  const queryParams = event.queryStringParameters || {};
  const { userId, roomId } = queryParams;

  logger.info('Handling connect', { connectionId, userId, roomId });

  if (!userId || !roomId) {
    logger.error('Missing required parameters', { userId, roomId });
    return { statusCode: 400, body: 'Missing userId or roomId' };
  }

  try {
    // Salvar conexão
    await ddb.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        userId,
        roomId,
        connectedAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 86400 // 24 horas
      }
    }));

    // Salvar/atualizar usuário
    await ddb.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        userId,
        connectionId,
        roomId,
        status: 'online',
        lastSeen: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 86400
      }
    }));

    // Buscar todos os participantes da sala
    const participantsResult = await ddb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'RoomConnectionsIndex',
      KeyConditionExpression: 'roomId = :roomId',
      ExpressionAttributeValues: { ':roomId': roomId }
    }));

    const participants = (participantsResult.Items || []).map(item => item.userId);
    const existingParticipants = participants.filter(p => p !== userId);

    logger.info('Participantes na sala', { 
      roomId, 
      total: participants.length, 
      existing: existingParticipants.length,
      participants 
    });

    // ✅ SALVAR EVENTO DE ENTRADA NO DYNAMODB
    if (ROOM_EVENTS_TABLE) {
      try {
        const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        await ddb.send(new PutCommand({
          TableName: ROOM_EVENTS_TABLE,
          Item: {
            eventId,
            roomId,
            eventType: 'user_joined',
            userId,
            timestamp: Date.now(),
            participantCount: participants.length,
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 dias
          }
        }));
        logger.info('✅ Room event saved to DynamoDB', { eventId, eventType: 'user_joined' });
      } catch (dbError) {
        logger.error('❌ Error saving room event to DynamoDB', dbError);
      }
    }

    // Notificar outros usuários na sala sobre o novo usuário
    // ✅ IMPORTANTE: Incluir lista de participantes existentes na notificação
    // O novo usuário receberá isso via broadcast quando os outros responderem
    await notifyRoomUsers(roomId, {
      type: 'room_event',
      data: {
        eventType: 'user_joined',
        userId,
        roomId,
        participants,
        existingParticipants, // ✅ Incluir para que o novo usuário saiba quem já está
        timestamp: Date.now()
      }
    }, null); // ✅ NÃO excluir ninguém - enviar para TODOS incluindo o novo usuário

    logger.info('Connection established successfully', { connectionId, userId, roomId });
    return { statusCode: 200, body: 'Connected' };

  } catch (error) {
    logger.error('Error handling connect', error);
    return { statusCode: 500, body: 'Failed to connect' };
  }
}

async function handleDisconnect(event) {
  const { connectionId } = event.requestContext;

  logger.info('Handling disconnect', { connectionId });

  try {
    // Buscar informações da conexão
    const connectionResult = await ddb.send(new GetCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));

    if (connectionResult.Item) {
      const { userId, roomId } = connectionResult.Item;

      // Remover conexão
      await ddb.send(new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId }
      }));

      // Atualizar status do usuário
      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: 'SET #status = :status, lastSeen = :lastSeen',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'offline',
          ':lastSeen': Date.now()
        }
      }));

      // Buscar participantes restantes da sala
      const participantsResult = await ddb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        IndexName: 'RoomConnectionsIndex',
        KeyConditionExpression: 'roomId = :roomId',
        ExpressionAttributeValues: { ':roomId': roomId }
      }));

      const participants = (participantsResult.Items || [])
        .filter(item => item.connectionId !== connectionId)
        .map(item => item.userId);

      // ✅ SALVAR EVENTO DE SAÍDA NO DYNAMODB
      if (ROOM_EVENTS_TABLE) {
        try {
          const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          await ddb.send(new PutCommand({
            TableName: ROOM_EVENTS_TABLE,
            Item: {
              eventId,
              roomId,
              eventType: 'user_left',
              userId,
              timestamp: Date.now(),
              participantCount: participants.length,
              ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 dias
            }
          }));
          logger.info('✅ Room event saved to DynamoDB', { eventId, eventType: 'user_left' });
        } catch (dbError) {
          logger.error('❌ Error saving room event to DynamoDB', dbError);
        }
      }

      // Notificar outros usuários na sala
      await notifyRoomUsers(roomId, {
        type: 'room_event',
        data: {
          eventType: 'user_left',
          userId,
          roomId,
          participants,
          timestamp: Date.now()
        }
      }, connectionId);

      logger.info('Disconnection handled successfully', { connectionId, userId, roomId });
    }

    return { statusCode: 200, body: 'Disconnected' };

  } catch (error) {
    logger.error('Error handling disconnect', error);
    return { statusCode: 500, body: 'Failed to disconnect' };
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