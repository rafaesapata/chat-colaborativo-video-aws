const { handler } = require('../connection-handler/index');

describe('Connection Handler', () => {
  test('should handle $connect event', async () => {
    const event = {
      requestContext: {
        connectionId: 'test-connection-123',
        routeKey: '$connect',
        eventType: 'CONNECT'
      },
      queryStringParameters: {
        userId: 'user-123',
        roomId: 'room-456'
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  test('should reject connection without userId', async () => {
    const event = {
      requestContext: {
        connectionId: 'test-connection-123',
        routeKey: '$connect'
      },
      queryStringParameters: {}
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});
