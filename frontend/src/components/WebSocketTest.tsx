import { useState, useRef } from 'react';

export default function WebSocketTest() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  const connect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');
    setError('');
    setMessages([]);

    // Gerar IDs de teste no formato correto com timestamp para unicidade
    const timestamp = Date.now().toString(36);
    const testUserId = `user_${timestamp}_${Math.random().toString(36).substring(2, 11)}`;
    const testRoomId = `room_${timestamp}_${Math.random().toString(36).substring(2, 11)}`;
    
    const wsUrl = `${import.meta.env.VITE_WEBSOCKET_URL}?userId=${testUserId}&roomId=${testRoomId}`;
    
    console.log('[WebSocketTest] Conectando em:', wsUrl);
    console.log('[WebSocketTest] IDs gerados:', { testUserId, testRoomId });

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocketTest] ✅ Conectado!');
        setStatus('connected');
        addMessage('✅ Conectado com sucesso!');
      };

      ws.onmessage = (event) => {
        console.log('[WebSocketTest] 📨 Mensagem:', event.data);
        addMessage(`📨 Recebido: ${event.data}`);
      };

      ws.onerror = (error) => {
        console.error('[WebSocketTest] ❌ Erro:', error);
        setStatus('error');
        setError('Erro de conexão WebSocket');
        addMessage('❌ Erro de conexão');
      };

      ws.onclose = (event) => {
        console.log('[WebSocketTest] 🔴 Desconectado:', event);
        setStatus('disconnected');
        addMessage(`🔴 Desconectado: ${event.code} - ${event.reason}`);
        
        if (event.code === 1006) {
          setError('Conexão fechada anormalmente - possível problema de rede ou servidor');
        } else if (event.code === 1002) {
          setError('Erro de protocolo WebSocket');
        } else if (event.code === 1003) {
          setError('Dados não aceitos pelo servidor');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocketTest] Erro ao criar WebSocket:', error);
      setStatus('error');
      setError(`Erro ao criar WebSocket: ${error}`);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Teste finalizado');
      wsRef.current = null;
    }
  };

  const sendTestMessage = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const testMessage = {
        action: 'sendMessage',
        roomId: 'room_test12345',
        userId: 'user_test12345',
        content: 'Mensagem de teste',
        userName: 'Teste'
      };
      
      wsRef.current.send(JSON.stringify(testMessage));
      addMessage(`📤 Enviado: ${JSON.stringify(testMessage)}`);
    }
  };

  const addMessage = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return '🟢 Conectado';
      case 'connecting': return '🟡 Conectando...';
      case 'error': return '🔴 Erro';
      default: return '⚪ Desconectado';
    }
  };

  return (
    <div className="fixed top-4 left-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-md z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">🧪 Teste WebSocket</h3>
        <div className={`font-semibold ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <button
          onClick={connect}
          disabled={status === 'connecting'}
          className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {status === 'connecting' ? 'Conectando...' : 'Conectar'}
        </button>

        <button
          onClick={sendTestMessage}
          disabled={status !== 'connected'}
          className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Enviar Teste
        </button>

        <button
          onClick={disconnect}
          disabled={status === 'disconnected'}
          className="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          Desconectar
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <strong>Erro:</strong> {error}
        </div>
      )}

      <div className="border-t pt-4">
        <h4 className="font-semibold mb-2">Log de Mensagens:</h4>
        <div className="max-h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono">
          {messages.length === 0 ? (
            <div className="text-gray-500">Nenhuma mensagem ainda...</div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="mb-1">
                {msg}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <div><strong>URL:</strong> {import.meta.env.VITE_WEBSOCKET_URL}</div>
        <div><strong>Formato esperado:</strong> user_[a-z0-9]{9}</div>
      </div>
    </div>
  );
}