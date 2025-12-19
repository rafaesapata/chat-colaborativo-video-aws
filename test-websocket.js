const WebSocket = require('ws');

const wsUrl = 'wss://kb09dca09l.execute-api.us-east-1.amazonaws.com/prod?userId=user_test123&roomId=room_test456';

console.log('🔌 Conectando ao WebSocket:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
  console.log('✅ Conectado com sucesso!');
  
  // Enviar ping
  ws.send(JSON.stringify({
    action: 'ping',
    userId: 'user_test123',
    roomId: 'room_test456'
  }));
  
  // Enviar mensagem de teste
  setTimeout(() => {
    ws.send(JSON.stringify({
      action: 'sendMessage',
      userId: 'user_test123',
      roomId: 'room_test456',
      userName: 'Test User',
      content: 'Mensagem de teste!'
    }));
  }, 1000);
});

ws.on('message', function message(data) {
  console.log('📨 Mensagem recebida:', JSON.parse(data.toString()));
});

ws.on('error', function error(err) {
  console.error('❌ Erro:', err);
});

ws.on('close', function close(code, reason) {
  console.log('🔴 Desconectado:', { code, reason: reason.toString() });
});

// Fechar após 10 segundos
setTimeout(() => {
  console.log('⏰ Fechando conexão...');
  ws.close();
}, 10000);