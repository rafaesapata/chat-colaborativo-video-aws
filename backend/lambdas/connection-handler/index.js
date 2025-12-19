const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, UpdateCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const { createLogger } = require('../../shared/lib/logger');
const { validateInput, connectionSchema, ValidationError } = require('../../shared/lib/validation');
const { sanitizeUserName } = require('../../shared/lib/sanitizer');
const { metrics } = require('../../shared/lib/metrics');
const { withRetry, withTimeout } = require('../../shared/lib/resilience');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;

const logger = createLogger();

exports.handler = async (event) => {
  const { connectionId, eventType, routeKey, requestId } = event.requestContext;
  
  logger.info({ connectionId, eventType, routeKey, requestId }, 'Connection event received');

  try {
    if (routeKey === '$connect') {
      return await handleConnect(event);
    } else if (routeKey === '$disconnect') {
      return await handleDisconnect(event);
    }
    
    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    logger.error({ error: error.message, connectionId, requestId }, 'Connection handler failed');
    metrics.connectionErrors();
    
    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: error.message,
          code: 'VALIDATION_ERROR',
          requestId
        })
      };
    }
    
    return { 
      statusCode: 500, 
      body: JSON.stringify({
        error: 'Internal Server Error',
        requestId
      })
    };
  }
};

async function handleConnect(event) {
  const { connectionId, requestId } = event.requestContext;
  const queryParams = event.queryStringParameters || {};
  
  // Validar parâmetros de conexão
  const validatedParams = await validateInput(queryParams, connectionSchema);
  const { userId, roomId } = validatedParams;

  const timestamp = Date.now();

  logger.info({ userId, roomId, connectionId }, 'User connecting');

  // Salvar conexão com retry
  await withRetry(async () => {
    await ddb.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        userId,
        roomId: roomId || null,
        connectedAt: timestamp,
        ttl: Math.floor(Date.now() / 1000) + 86400 // 24 horas
      }
    }));
  });

  // Atualizar status do usuário para online com retry
  await withRetry(async () => {
    await ddb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET #status = :status, lastSeen = :timestamp, connectionId = :connectionId',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'online',
        ':timestamp': timestamp,
        ':connectionId': connectionId
      }
    }));
  });

  logger.info({ userId, connectionId }, 'User connected successfully');
  metrics.activeConnections(1);

  // Notificar outros participantes da sala se roomId foi fornecido
  if (roomId) {
    await notifyRoomParticipants(event, roomId, userId, 'user_joined');
  }

  return { 
    statusCode: 200, 
    body: JSON.stringify({ 
      success: true, 
      connectionId,
      requestId 
    }) 
  };
}

async function handleDisconnect(event) {
  const { connectionId, requestId } = event.requestContext;

  logger.info({ connectionId }, 'User disconnecting');

  // Buscar informações da conexão com timeout
  const connection = await withTimeout(async () => {
    return await ddb.send(new GetCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));
  }, 5000);

  if (connection.Item) {
    const { userId, roomId } = connection.Item;

    // Remover conexão com retry
    await withRetry(async () => {
      await ddb.send(new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId }
      }));
    });

    // Atualizar status do usuário para offline com retry
    await withRetry(async () => {
      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: 'SET #status = :status, lastSeen = :timestamp REMOVE connectionId',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'offline',
          ':timestamp': Date.now()
        }
      }));
    });

    logger.info({ userId, connectionId }, 'User disconnected successfully');
    metrics.activeConnections(-1);

    // Notificar outros participantes da sala
    if (roomId) {
      await notifyRoomParticipants(event, roomId, userId, 'user_left');
    }
  } else {
    logger.warn({ connectionId }, 'Connection not found in database');
  }

  return { 
    statusCode: 200, 
    body: JSON.stringify({ 
      success: true, 
      requestId 
    }) 
  };
}

async function notifyRoomParticipants(event, roomId, userId, eventType) {
  try {
    const { domainName, stage } = event.requestContext;
    const apigwClient = new ApiGatewayManagementApiClient({
      endpoint: `https://${domainName}/${stage}`
    });

    logger.info({ roomId, userId, eventType }, 'Notifying room participants');

    // Buscar todas as conexões da sala com timeout
    const connections = await withTimeout(async () => {
      return await ddb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        IndexName: 'RoomConnectionsIndex',
        KeyConditionExpression: 'roomId = :roomId',
        ExpressionAttributeValues: {
          ':roomId': roomId
        }
      }));
    }, 5000);

    // Criar lista de participantes ativos
    const participants = connections.Items.map(conn => conn.userId);

    // Notificar todos os participantes
    const message = {
      type: 'room_event',
      data: {
        eventType,
        userId,
        roomId,
        participants,
        timestamp: Date.now()
      }
    };

    const postCalls = connections.Items.map(async ({ connectionId: targetConnectionId }) => {
      try {
        await apigwClient.send(new PostToConnectionCommand({
          ConnectionId: targetConnectionId,
          Data: JSON.stringify(message)
        }));
      } catch (error) {
        if (error.statusCode === 410) {
          logger.info({ connectionId: targetConnectionId }, 'Stale connection detected during notification');
          // Remover conexão obsoleta
          try {
            await ddb.send(new DeleteCommand({
              TableName: CONNECTIONS_TABLE,
              Key: { connectionId: targetConnectionId }
            }));
          } catch (deleteError) {
            logger.error({ error: deleteError.message }, 'Failed to delete stale connection');
          }
        } else {
          logger.error({ 
            error: error.message, 
            connectionId: targetConnectionId 
          }, 'Error posting to connection');
        }
      }
    });

    await Promise.all(postCalls);
    logger.info({ 
      participantCount: connections.Items.length, 
      eventType, 
      userId 
    }, 'Room participants notified');
    
  } catch (error) {
    logger.error({ error: error.message, roomId, userId, eventType }, 'Error notifying room participants');
  }
}
