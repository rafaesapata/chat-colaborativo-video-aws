const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

exports.handler = async (event) => {
  const { connectionId, domainName, stage } = event.requestContext;
  
  const apigwClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });

  try {
    const body = JSON.parse(event.body);
    const { action, roomId, userId, content, userName } = body;

    if (action === 'webrtc-signal') {
      // Encaminhar sinalização WebRTC
      return await handleWebRTCSignal(body, apigwClient);
    }
    
    if (action !== 'sendMessage') {
      return { statusCode: 400, body: 'Invalid action' };
    }

    if (!roomId || !userId || !content) {
      return { statusCode: 400, body: 'Missing required fields' };
    }

    // Sanitizar conteúdo
    const sanitizedContent = sanitizeContent(content);

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Salvar mensagem no DynamoDB
    const message = {
      messageId,
      roomId,
      userId,
      userName: userName || 'Anonymous',
      content: sanitizedContent,
      timestamp,
      type: 'text'
    };

    await ddb.send(new PutCommand({
      TableName: MESSAGES_TABLE,
      Item: message
    }));

    // Buscar todas as conexões da sala
    const connections = await ddb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'UserConnectionsIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    // Broadcast para todos os participantes
    const broadcastMessage = {
      type: 'message',
      data: message
    };

    const postCalls = connections.Items.map(async ({ connectionId: targetConnectionId }) => {
      try {
        await apigwClient.send(new PostToConnectionCommand({
          ConnectionId: targetConnectionId,
          Data: JSON.stringify(broadcastMessage)
        }));
      } catch (error) {
        if (error.statusCode === 410) {
          console.log(`Stale connection: ${targetConnectionId}`);
        } else {
          console.error(`Error posting to ${targetConnectionId}:`, error);
        }
      }
    });

    await Promise.all(postCalls);

    return { statusCode: 200, body: 'Message sent' };
  } catch (error) {
    console.error('Error handling message:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};

async function handleWebRTCSignal(body, apigwClient) {
  const { roomId, userId, targetUserId, signal, type } = body;

  if (!roomId || !userId) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  // Buscar conexões da sala
  const connections = await ddb.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: 'UserConnectionsIndex',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }));

  // Se tem targetUserId, enviar apenas para ele, senão broadcast
  const message = {
    type: 'webrtc-signal',
    roomId,
    userId,
    targetUserId,
    signal,
    signalType: type
  };

  const postCalls = connections.Items
    .filter(conn => !targetUserId || conn.userId === targetUserId)
    .map(async ({ connectionId: targetConnectionId }) => {
      try {
        await apigwClient.send(new PostToConnectionCommand({
          ConnectionId: targetConnectionId,
          Data: JSON.stringify(message)
        }));
      } catch (error) {
        if (error.statusCode === 410) {
          console.log(`Stale connection: ${targetConnectionId}`);
        } else {
          console.error(`Error posting to ${targetConnectionId}:`, error);
        }
      }
    });

  await Promise.all(postCalls);

  return { statusCode: 200, body: 'Signal sent' };
}

function sanitizeContent(content) {
  // Remover scripts e tags HTML perigosas
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .trim()
    .substring(0, 5000); // Limitar tamanho
}
