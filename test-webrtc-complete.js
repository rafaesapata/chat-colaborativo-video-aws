const WebSocket = require('ws');

const WEBSOCKET_URL = 'wss://y08b6lfdel.execute-api.us-east-1.amazonaws.com/prod';

// Simular dois usuários
const user1 = {
  id: 'user_' + Math.random().toString(36).substring(2, 11),
  roomId: 'room_video_test'
};

const user2 = {
  id: 'user_' + Math.random().toString(36).substring(2, 11),
  roomId: 'room_video_test'
};

console.log('🧪 Teste completo de WebRTC com dois usuários');
console.log(`👤 Usuário 1: ${user1.id}`);
console.log(`👤 Usuário 2: ${user2.id}`);
console.log(`🏠 Sala: ${user1.roomId}`);

let ws1, ws2;
let user1Connected = false;
let user2Connected = false;

// Conectar usuário 1
ws1 = new WebSocket(`${WEBSOCKET_URL}?userId=${user1.id}&roomId=${user1.roomId}`);

ws1.on('open', () => {
  console.log('✅ Usuário 1 conectado');
  user1Connected = true;
  
  // Conectar usuário 2 após usuário 1 estar conectado
  setTimeout(() => {
    ws2 = new WebSocket(`${WEBSOCKET_URL}?userId=${user2.id}&roomId=${user2.roomId}`);
    
    ws2.on('open', () => {
      console.log('✅ Usuário 2 conectado');
      user2Connected = true;
      
      // Usuário 2 anuncia entrada com vídeo
      setTimeout(() => {
        console.log('📹 Usuário 2 anunciando entrada com vídeo...');
        ws2.send(JSON.stringify({
          action: 'webrtc-signal',
          type: 'user-joined',
          roomId: user2.roomId,
          userId: user2.id,
          signal: {
            type: 'user-joined'
          }
        }));
      }, 500);
    });
    
    ws2.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 Usuário 2 recebeu:`, message.type, message.data?.eventType || message.signalType || '');
        
        // Se recebeu evento de entrada de usuário, criar oferta
        if (message.type === 'room_event' && message.data?.eventType === 'user_joined' && message.data.userId === user1.id) {
          console.log('🤝 Usuário 2 criando oferta para Usuário 1...');
          setTimeout(() => {
            ws2.send(JSON.stringify({
              action: 'webrtc-signal',
              type: 'offer',
              roomId: user2.roomId,
              userId: user2.id,
              targetUserId: user1.id,
              signal: {
                type: 'offer',
                offer: {
                  type: 'offer',
                  sdp: 'v=0\r\no=- 123456789 123456789 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
                }
              }
            }));
          }, 100);
        }
      } catch (error) {
        console.log(`📨 Usuário 2 recebeu (raw):`, data.toString());
      }
    });
    
    ws2.on('error', (error) => {
      console.error('❌ Erro Usuário 2:', error);
    });
    
    ws2.on('close', (code, reason) => {
      console.log(`🔴 Usuário 2 desconectado. Código: ${code}`);
    });
  }, 1000);
});

ws1.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`📨 Usuário 1 recebeu:`, message.type, message.data?.eventType || message.signalType || '');
    
    // Se recebeu oferta, responder com answer
    if (message.type === 'webrtc-signal' && message.signal?.type === 'offer') {
      console.log('📞 Usuário 1 respondendo à oferta...');
      setTimeout(() => {
        ws1.send(JSON.stringify({
          action: 'webrtc-signal',
          type: 'answer',
          roomId: user1.roomId,
          userId: user1.id,
          targetUserId: message.userId,
          signal: {
            type: 'answer',
            answer: {
              type: 'answer',
              sdp: 'v=0\r\no=- 987654321 987654321 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
            }
          }
        }));
      }, 100);
    }
    
    // Se recebeu evento de entrada de usuário, anunciar própria entrada
    if (message.type === 'room_event' && message.data?.eventType === 'user_joined' && message.data.userId === user2.id) {
      console.log('📹 Usuário 1 anunciando entrada com vídeo...');
      setTimeout(() => {
        ws1.send(JSON.stringify({
          action: 'webrtc-signal',
          type: 'user-joined',
          roomId: user1.roomId,
          userId: user1.id,
          signal: {
            type: 'user-joined'
          }
        }));
      }, 100);
    }
  } catch (error) {
    console.log(`📨 Usuário 1 recebeu (raw):`, data.toString());
  }
});

ws1.on('error', (error) => {
  console.error('❌ Erro Usuário 1:', error);
});

ws1.on('close', (code, reason) => {
  console.log(`🔴 Usuário 1 desconectado. Código: ${code}`);
});

// Fechar após 15 segundos
setTimeout(() => {
  console.log('⏰ Finalizando teste...');
  if (ws1) ws1.close();
  if (ws2) ws2.close();
  process.exit(0);
}, 15000);