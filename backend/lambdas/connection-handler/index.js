const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;

exports.handler = async (event) => {
  const { connectionId, eventType, routeKey } = event.requestContext;
  
  console.log('Connection event:', { connectionId, eventType, routeKey });

  try {
    if (routeKey === '$connect') {
      return await handleConnect(event);
    } else if (routeKey === '$disconnect') {
      return await handleDisconnect(event);
    }
    
    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('Error handling connection:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};

async function handleConnect(event) {
  const { connectionId } = event.requestContext;
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId;
  const roomId = queryParams.roomId;

  if (!userId) {
    return { statusCode: 400, body: 'Missing userId' };
  }

  const timestamp = Date.now();

  // Salvar conexão
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

  // Atualizar status do usuário para online
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

  console.log(`User ${userId} connected with connectionId ${connectionId}`);

  return { statusCode: 200, body: 'Connected' };
}

async function handleDisconnect(event) {
  const { connectionId } = event.requestContext;

  // Buscar informações da conexão
  const connection = await ddb.send(new GetCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId }
  }));

  if (connection.Item) {
    const { userId } = connection.Item;

    // Remover conexão
    await ddb.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));

    // Atualizar status do usuário para offline
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

    console.log(`User ${userId} disconnected`);
  }

  return { statusCode: 200, body: 'Disconnected' };
}
