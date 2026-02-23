const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CHATROOMS_TABLE = process.env.CHATROOMS_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { action, roomId, roomName, userId, participants } = body;

    switch (action) {
      case 'createRoom':
        return await createRoom(roomName, userId, participants);
      case 'deleteRoom':
        return await deleteRoom(roomId, userId);
      case 'joinRoom':
        return await joinRoom(roomId, userId);
      case 'leaveRoom':
        return await leaveRoom(roomId, userId);
      case 'listRooms':
        return await listRooms();
      case 'getRoomInfo':
        return await getRoomInfo(roomId);
      default:
        return { statusCode: 400, body: 'Invalid action' };
    }
  } catch (error) {
    console.error('Error in room manager:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};

async function createRoom(roomName, creatorId, participants = []) {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Date.now();

  const room = {
    roomId,
    name: roomName,
    creatorId,
    participants: [creatorId, ...participants],
    createdAt: timestamp,
    active: true
  };

  await ddb.send(new PutCommand({
    TableName: CHATROOMS_TABLE,
    Item: room
  }));

  return { statusCode: 200, body: JSON.stringify({ roomId, room }) };
}

async function deleteRoom(roomId, userId) {
  const room = await ddb.send(new GetCommand({
    TableName: CHATROOMS_TABLE,
    Key: { roomId }
  }));

  if (!room.Item) {
    return { statusCode: 404, body: 'Room not found' };
  }

  if (room.Item.creatorId !== userId) {
    return { statusCode: 403, body: 'Only creator can delete room' };
  }

  await ddb.send(new DeleteCommand({
    TableName: CHATROOMS_TABLE,
    Key: { roomId }
  }));

  return { statusCode: 200, body: 'Room deleted' };
}

// L-004: Corrigido - DynamoDBDocumentClient v3 não tem createSet()
// Usar lista simples com list_append ou SET com SS type
async function joinRoom(roomId, userId) {
  await ddb.send(new UpdateCommand({
    TableName: CHATROOMS_TABLE,
    Key: { roomId },
    UpdateExpression: 'SET participants = list_append(if_not_exists(participants, :empty), :userId)',
    ExpressionAttributeValues: {
      ':userId': [userId],
      ':empty': []
    }
  }));

  return { statusCode: 200, body: 'Joined room' };
}

async function leaveRoom(roomId, userId) {
  // Buscar sala para encontrar o índice do participante
  const room = await ddb.send(new GetCommand({
    TableName: CHATROOMS_TABLE,
    Key: { roomId }
  }));

  if (!room.Item || !room.Item.participants) {
    return { statusCode: 404, body: 'Room not found' };
  }

  const index = room.Item.participants.indexOf(userId);
  if (index === -1) {
    return { statusCode: 200, body: 'User not in room' };
  }

  await ddb.send(new UpdateCommand({
    TableName: CHATROOMS_TABLE,
    Key: { roomId },
    UpdateExpression: `REMOVE participants[${index}]`,
  }));

  return { statusCode: 200, body: 'Left room' };
}

async function listRooms() {
  // GSI CreatedAtIndex tem createdAt como HASH key, não suporta query por 'active'
  // Usar Scan com filtro por active=true, ordenar por createdAt desc no código
  const result = await ddb.send(new ScanCommand({
    TableName: CHATROOMS_TABLE,
    FilterExpression: 'active = :active',
    ExpressionAttributeValues: {
      ':active': true
    },
    Limit: 200
  }));

  // Ordenar por createdAt desc (mais recentes primeiro)
  const rooms = (result.Items || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 50);

  return { statusCode: 200, body: JSON.stringify({ rooms }) };
}

async function getRoomInfo(roomId) {
  const room = await ddb.send(new GetCommand({
    TableName: CHATROOMS_TABLE,
    Key: { roomId }
  }));

  if (!room.Item) {
    return { statusCode: 404, body: 'Room not found' };
  }

  return { statusCode: 200, body: JSON.stringify({ room: room.Item }) };
}
