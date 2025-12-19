const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const { createLogger } = require('../../shared/lib/logger');
const { validateInput, messageSchema, ValidationError } = require('../../shared/lib/validation');
const { sanitizeContent, sanitizeUserName } = require('../../shared/lib/sanitizer');
const { metrics } = require('../../shared/lib/metrics');
const { withRetry, withTimeout } = require('../../shared/lib/resilience');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

const logger = createLogger();

exports.handler = async (event) => {
  const startTime = Date.now();
  const { connectionId, domainName, stage } = event.requestContext;
  const requestId = event.requestContext.requestId;
  
  logger.info({ connectionId, requestId }, 'Message handler invoked');
  
  const apigwClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });

  try {
    // Validação de entrada com schema
    const validatedInput = await validateInput(event.body, messageSchema);
    const { action, roomId, userId, content, userName } = validatedInput;

    if (action === 'webrtc-signal') {
      // Encaminhar sinalização WebRTC
      return await handleWebRTCSignal(validatedInput, apigwClient);
    }
    
    if (action !== 'sendMessage') {
      metrics.validationErrors();
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Invalid action', requestId }) 
      };
    }

    // Sanitizar conteúdo
    const sanitizedContent = sanitizeContent(content);
    const sanitizedUserName = sanitizeUserName(userName);
    
    metrics.sanitizationEvents();

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Salvar mensagem no DynamoDB com retry
    const message = {
      messageId,
      roomId,
      userId,
      userName: sanitizedUserName,
      content: sanitizedContent,
      timestamp,
      type: 'text',
      requestId
    };

    await withRetry(async () => {
      await ddb.send(new PutCommand({
        TableName: MESSAGES_TABLE,
        Item: message
      }));
    });

    logger.info({ messageId, roomId }, 'Message saved to DynamoDB');

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

    // Broadcast para todos os participantes
    const broadcastMessage = {
      type: 'message',
      data: message
    };

    await broadcastToConnections(connections.Items, broadcastMessage, apigwClient);

    // Métricas
    metrics.messagesSent();
    metrics.messagesPerRoom(roomId);
    metrics.messageLatency(Date.now() - startTime);

    logger.info({ messageId, participantCount: connections.Items.length }, 'Message broadcast completed');

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        success: true, 
        messageId,
        requestId 
      }) 
    };
    
  } catch (error) {
    logger.error({ error: error.message, requestId }, 'Message handler failed');
    
    if (error instanceof ValidationError) {
      metrics.validationErrors();
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

async function handleWebRTCSignal(body, apigwClient) {
  const { roomId, userId, targetUserId, signal, type } = body;

  logger.info({ roomId, userId, targetUserId, signalType: type }, 'Handling WebRTC signal');

  // Buscar conexões da sala com timeout
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

  // Se tem targetUserId, enviar apenas para ele, senão broadcast
  const message = {
    type: 'webrtc-signal',
    roomId,
    userId,
    targetUserId,
    signal,
    signalType: type,
    timestamp: Date.now()
  };

  const targetConnections = connections.Items
    .filter(conn => !targetUserId || conn.userId === targetUserId);

  await broadcastToConnections(targetConnections, message, apigwClient);

  metrics.webrtcSignalingEvents(type);

  logger.info({ targetCount: targetConnections.length }, 'WebRTC signal sent');

  return { 
    statusCode: 200, 
    body: JSON.stringify({ success: true, targetCount: targetConnections.length }) 
  };
}

// Função auxiliar para broadcast com tratamento de conexões obsoletas
async function broadcastToConnections(connections, message, apigwClient) {
  const postCalls = connections.map(async ({ connectionId: targetConnectionId }) => {
    try {
      await apigwClient.send(new PostToConnectionCommand({
        ConnectionId: targetConnectionId,
        Data: JSON.stringify(message)
      }));
    } catch (error) {
      if (error.statusCode === 410) {
        logger.info({ connectionId: targetConnectionId }, 'Stale connection detected');
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
}
