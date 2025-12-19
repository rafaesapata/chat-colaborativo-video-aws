const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

// Mock dos clientes AWS
const ddbMock = mockClient(DynamoDBDocumentClient);
const apigwMock = mockClient(ApiGatewayManagementApiClient);

// Mock das dependências compartilhadas
jest.mock('../../shared/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  })
}));

jest.mock('../../shared/lib/metrics', () => ({
  metrics: {
    messagesSent: jest.fn(),
    messagesPerRoom: jest.fn(),
    messageLatency: jest.fn(),
    sanitizationEvents: jest.fn(),
    validationErrors: jest.fn()
  }
}));

const { handler } = require('../message-handler');

describe('MessageHandler Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    apigwMock.reset();
    process.env.MESSAGES_TABLE = 'test-messages';
    process.env.CONNECTIONS_TABLE = 'test-connections';
  });

  describe('sendMessage action', () => {
    const validEvent = {
      requestContext: {
        connectionId: 'conn-123',
        domainName: 'api.test.com',
        stage: 'prod',
        requestId: 'req-123'
      },
      body: JSON.stringify({
        action: 'sendMessage',
        roomId: 'room_abc123def',
        userId: 'user_xyz789abc',
        content: 'Hello, world!',
        userName: 'TestUser'
      })
    };

    it('should persist message to DynamoDB', async () => {
      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(validEvent);

      expect(result.statusCode).toBe(200);
      expect(ddbMock.calls()).toHaveLength(2);
      
      const putCall = ddbMock.call(0);
      expect(putCall.args[0].input.TableName).toBe('test-messages');
      expect(putCall.args[0].input.Item.content).toBe('Hello, world!');
    });

    it('should sanitize XSS attempts', async () => {
      const xssEvent = {
        ...validEvent,
        body: JSON.stringify({
          action: 'sendMessage',
          roomId: 'room_abc123def',
          userId: 'user_xyz789abc',
          content: '<script>alert("xss")</script>',
          userName: 'Attacker'
        })
      };

      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await handler(xssEvent);

      const putCall = ddbMock.call(0);
      expect(putCall.args[0].input.Item.content).not.toContain('<script>');
    });

    it('should reject invalid roomId format', async () => {
      const invalidEvent = {
        ...validEvent,
        body: JSON.stringify({
          action: 'sendMessage',
          roomId: 'invalid-room-id',
          userId: 'user_xyz789abc',
          content: 'Test'
        })
      };

      const result = await handler(invalidEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid room ID');
    });

    it('should handle DynamoDB failures gracefully', async () => {
      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(validEvent);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body.requestId).toBeDefined();
    });

    it('should broadcast to all room participants', async () => {
      const connections = [
        { connectionId: 'conn-1', userId: 'user_1' },
        { connectionId: 'conn-2', userId: 'user_2' },
        { connectionId: 'conn-3', userId: 'user_3' }
      ];

      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(QueryCommand).resolves({ Items: connections });
      apigwMock.on(PostToConnectionCommand).resolves({});

      await handler(validEvent);

      expect(apigwMock.calls()).toHaveLength(3);
    });

    it('should handle stale connections (410)', async () => {
      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(QueryCommand).resolves({ 
        Items: [{ connectionId: 'stale-conn' }] 
      });
      apigwMock.on(PostToConnectionCommand).rejects({ statusCode: 410 });

      const result = await handler(validEvent);

      // Should not fail, just log and continue
      expect(result.statusCode).toBe(200);
    });
  });

  describe('webrtc-signal action', () => {
    const webrtcEvent = {
      requestContext: {
        connectionId: 'conn-123',
        domainName: 'api.test.com',
        stage: 'prod',
        requestId: 'req-123'
      },
      body: JSON.stringify({
        action: 'webrtc-signal',
        roomId: 'room_abc123def',
        userId: 'user_xyz789abc',
        targetUserId: 'user_target123',
        signal: { type: 'offer', sdp: 'mock-sdp' },
        type: 'offer'
      })
    };

    it('should forward WebRTC signals', async () => {
      const connections = [
        { connectionId: 'conn-target', userId: 'user_target123' }
      ];

      ddbMock.on(QueryCommand).resolves({ Items: connections });
      apigwMock.on(PostToConnectionCommand).resolves({});

      const result = await handler(webrtcEvent);

      expect(result.statusCode).toBe(200);
      expect(apigwMock.calls()).toHaveLength(1);
      
      const postCall = apigwMock.call(0);
      const message = JSON.parse(postCall.args[0].input.Data);
      expect(message.type).toBe('webrtc-signal');
      expect(message.signalType).toBe('offer');
    });
  });

  describe('Input validation', () => {
    it('should reject malformed JSON', async () => {
      const invalidEvent = {
        requestContext: {
          connectionId: 'conn-123',
          domainName: 'api.test.com',
          stage: 'prod',
          requestId: 'req-123'
        },
        body: 'invalid json'
      };

      const result = await handler(invalidEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid JSON');
    });

    it('should reject missing required fields', async () => {
      const incompleteEvent = {
        requestContext: {
          connectionId: 'conn-123',
          domainName: 'api.test.com',
          stage: 'prod',
          requestId: 'req-123'
        },
        body: JSON.stringify({
          action: 'sendMessage',
          roomId: 'room_abc123def'
          // Missing userId and content
        })
      };

      const result = await handler(incompleteEvent);

      expect(result.statusCode).toBe(400);
    });
  });
});