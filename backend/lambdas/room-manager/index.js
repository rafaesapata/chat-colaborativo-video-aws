const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

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

async function joinRoom(roomId, userId) {
  await ddb.send(new UpdateCommand({
    TableName: CHATROOMS_TABLE,
    Key: { roomId },
    UpdateExpression: 'ADD participants :userId',
    ExpressionAttributeValues: {
      ':userId': ddb.createSet([userId])
    }
  }));

  return { statusCode: 200, body: 'Joined room' };
}

async function leaveRoom(roomId, userId) {
  await ddb.send(new UpdateCommand({
    TableName: CHATROOMS_TABLE,
    Key: { roomId },
    UpdateExpression: 'DELETE participants :userId',
    ExpressionAttributeValues: {
      ':userId': ddb.createSet([userId])
    }
  }));

  return { statusCode: 200, body: 'Left room' };
}

async function listRooms() {
  const result = await ddb.send(new QueryCommand({
    TableName: CHATROOMS_TABLE,
    IndexName: 'CreatedAtIndex',
    KeyConditionExpression: 'active = :active',
    ExpressionAttributeValues: {
      ':active': true
    },
    ScanIndexForward: false,
    Limit: 50
  }));

  return { statusCode: 200, body: JSON.stringify({ rooms: result.Items }) };
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
