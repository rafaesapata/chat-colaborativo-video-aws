#!/usr/bin/env node

const WebSocket = require('ws');

// Configuração
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'wss://b6ng074r5i.execute-api.us-east-1.amazonaws.com/prod';
const ROOM_ID = 'test-room-' + Date.now();

console.log('🧪 Testando conexões de múltiplos usuários na mesma sala');
console.log(`📍 Sala: ${ROOM_ID}`);
console.log(`🔗 WebSocket: ${WEBSOCKET_URL}`);
console.log('');

// Criar múltiplos usuários
const users = [
  { id: 'user1', name: 'Alice' },
  { id: 'user2', name: 'Bob' },
  { id: 'user3', name: 'Charlie' }
];

const connections = new Map();

async function connectUser(user) {
  return new Promise((resolve, reject) => {
    const wsUrl = `${WEBSOCKET_URL}?userId=${user.id}&roomId=${ROOM_ID}`;
    console.log(`🔌 Conectando ${user.name} (${user.id})...`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log(`✅ ${user.name} conectado!`);
      connections.set(user.id, ws);
      resolve(ws);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 ${user.name} recebeu:`, {
          type: message.type,
          from: message.data?.userId || 'sistema',
          content: message.data?.content || message.data?.eventType || 'evento'
        });
      } catch (error) {
        console.log(`📨 ${user.name} recebeu (raw):`, data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.error(`❌ Erro ${user.name}:`, error.message);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log(`🔴 ${user.name} desconectado`);
      connections.delete(user.id);
    });
  });
}

async function sendMessage(userId, content) {
  const ws = connections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    const message = {
      action: 'sendMessage',
      roomId: ROOM_ID,
      userId: userId,
      content: content,
      userName: users.find(u => u.id === userId)?.name || userId
    };
    
    console.log(`📤 ${users.find(u => u.id === userId)?.name} enviando: "${content}"`);
    ws.send(JSON.stringify(message));
  } else {
    console.error(`❌ Conexão ${userId} não disponível`);
  }
}

async function runTest() {
  try {
    console.log('🚀 Iniciando teste...\n');
    
    // Conectar todos os usuários
    console.log('1️⃣ Conectando usuários...');
    for (const user of users) {
      await connectUser(user);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1s entre conexões
    }
    
    console.log(`\n✅ ${connections.size} usuários conectados na sala ${ROOM_ID}\n`);
    
    // Aguardar um pouco para estabilizar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Enviar mensagens de teste
    console.log('2️⃣ Enviando mensagens de teste...\n');
    
    await sendMessage('user1', 'Olá pessoal! Alguém me escuta?');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await sendMessage('user2', 'Oi Alice! Eu te escuto sim!');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await sendMessage('user3', 'Oi galera! Também estou aqui!');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await sendMessage('user1', 'Perfeito! O chat está funcionando!');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n3️⃣ Teste de desconexão...\n');
    
    // Desconectar um usuário
    const user2Ws = connections.get('user2');
    if (user2Ws) {
      console.log('🔌 Desconectando Bob...');
      user2Ws.close();
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Enviar mais uma mensagem
    await sendMessage('user1', 'Bob saiu da sala?');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await sendMessage('user3', 'Parece que sim!');
    
    console.log('\n✅ Teste concluído! Aguardando 5 segundos antes de finalizar...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    // Fechar todas as conexões
    console.log('\n🧹 Limpando conexões...');
    for (const [userId, ws] of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    
    console.log('🏁 Teste finalizado!');
    process.exit(0);
  }
}

// Executar teste
runTest().catch(console.error);