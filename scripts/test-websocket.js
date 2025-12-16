const WebSocket = require('ws');

const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'wss://your-api-id.execute-api.us-east-1.amazonaws.com/prod';
const USER_ID = 'test_user_' + Math.random().toString(36).substr(2, 9);
const ROOM_ID = 'test_room_123';

console.log('🧪 Testando WebSocket...');
console.log('URL:', WEBSOCKET_URL);
console.log('User ID:', USER_ID);
console.log('Room ID:', ROOM_ID);

const ws = new WebSocket(`${WEBSOCKET_URL}?userId=${USER_ID}&roomId=${ROOM_ID}`);

ws.on('open', () => {
  console.log('✅ Conectado ao WebSocket');

  // Enviar mensagem de teste
  setTimeout(() => {
    const message = {
      action: 'sendMessage',
      roomId: ROOM_ID,
      userId: USER_ID,
      content: 'Olá! Esta é uma mensagem de teste.',
      userName: 'Test User'
    };
    
    console.log('📤 Enviando mensagem:', message);
    ws.send(JSON.stringify(message));
  }, 1000);
});

ws.on('message', (data) => {
  console.log('📥 Mensagem recebida:', data.toString());
});

ws.on('error', (error) => {
  console.error('❌ Erro:', error);
});

ws.on('close', () => {
  console.log('🔌 Conexão fechada');
});

// Manter conexão por 10 segundos
setTimeout(() => {
  console.log('⏱️  Encerrando teste...');
  ws.close();
  process.exit(0);
}, 10000);
