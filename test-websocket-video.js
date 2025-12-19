const WebSocket = require('ws');

const WEBSOCKET_URL = 'wss://y08b6lfdel.execute-api.us-east-1.amazonaws.com/prod';
const userId = 'test_user_' + Math.random().toString(36).substring(2, 11);
const roomId = 'test_room_video';

console.log('🧪 Testando WebSocket para funcionalidade de vídeo...');
console.log(`👤 User ID: ${userId}`);
console.log(`🏠 Room ID: ${roomId}`);

const ws = new WebSocket(`${WEBSOCKET_URL}?userId=${userId}&roomId=${roomId}`);

ws.on('open', () => {
  console.log('✅ WebSocket conectado com sucesso!');
  
  // Simular entrada de usuário com vídeo
  setTimeout(() => {
    console.log('📹 Enviando sinal WebRTC de entrada...');
    ws.send(JSON.stringify({
      action: 'webrtc-signal',
      type: 'user-joined',
      roomId: roomId,
      userId: userId,
      signal: {
        type: 'user-joined'
      }
    }));
  }, 1000);
  
  // Simular oferta WebRTC
  setTimeout(() => {
    console.log('🤝 Enviando oferta WebRTC simulada...');
    ws.send(JSON.stringify({
      action: 'webrtc-signal',
      type: 'offer',
      roomId: roomId,
      userId: userId,
      targetUserId: 'test_target_user',
      signal: {
        type: 'offer',
        offer: {
          type: 'offer',
          sdp: 'v=0\r\no=- 123456789 123456789 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
        }
      }
    }));
  }, 2000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Mensagem recebida:', JSON.stringify(message, null, 2));
  } catch (error) {
    console.log('📨 Mensagem recebida (raw):', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ Erro WebSocket:', error);
});

ws.on('close', (code, reason) => {
  console.log(`🔴 WebSocket fechado. Código: ${code}, Razão: ${reason}`);
});

// Fechar após 10 segundos
setTimeout(() => {
  console.log('⏰ Fechando conexão de teste...');
  ws.close();
  process.exit(0);
}, 10000);