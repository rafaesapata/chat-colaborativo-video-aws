const WebSocket = require('ws');

const wsUrl = 'wss://kb09dca09l.execute-api.us-east-1.amazonaws.com/prod?userId=user_test123&roomId=room_test456';

console.log('🔌 Conectando ao WebSocket:', wsUrl);

const ws = new WebSocket(wsUrl);

let messageCount = 0;

ws.on('open', function open() {
  console.log('✅ Conectado com sucesso!');
  
  // Enviar mensagem de teste
  setTimeout(() => {
    console.log('📤 Enviando mensagem...');
    ws.send(JSON.stringify({
      action: 'sendMessage',
      userId: 'user_test123',
      roomId: 'room_test456',
      userName: 'Test User',
      content: 'Mensagem de teste do WebSocket!'
    }));
  }, 1000);
  
  // Enviar sinal WebRTC de teste
  setTimeout(() => {
    console.log('📤 Enviando sinal WebRTC...');
    ws.send(JSON.stringify({
      action: 'webrtc-signal',
      type: 'user-joined',
      userId: 'user_test123',
      roomId: 'room_test456'
    }));
  }, 2000);
});

ws.on('message', function message(data) {
  messageCount++;
  const parsed = JSON.parse(data.toString());
  console.log(`📨 Mensagem ${messageCount} recebida:`, parsed);
  
  // Se recebeu mensagem de volta, o sistema está funcionando
  if (parsed.type === 'message' && parsed.data.content === 'Mensagem de teste do WebSocket!') {
    console.log('🎉 SUCESSO! Mensagem enviada e recebida corretamente!');
  }
});

ws.on('error', function error(err) {
  console.error('❌ Erro:', err);
});

ws.on('close', function close(code, reason) {
  console.log('🔴 Desconectado:', { code, reason: reason.toString() });
  console.log(`📊 Total de mensagens recebidas: ${messageCount}`);
  
  if (messageCount > 0) {
    console.log('✅ WebSocket funcionando corretamente!');
  } else {
    console.log('❌ WebSocket não está funcionando corretamente');
  }
});

// Fechar após 8 segundos
setTimeout(() => {
  console.log('⏰ Fechando conexão...');
  ws.close();
}, 8000);