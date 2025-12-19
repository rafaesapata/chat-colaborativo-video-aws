import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(
  url: string,
  userId: string,
  roomId: string,
  onMessage: (data: any) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messageHandlers = useRef<Set<(data: any) => void>>(new Set());
  const onMessageRef = useRef(onMessage);
  const reconnectTimeoutRef = useRef<number>();
  const heartbeatIntervalRef = useRef<number>();
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;
  const HEARTBEAT_INTERVAL = 30000; // 30 segundos

  // Atualizar a ref quando onMessage mudar, sem causar re-render
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!url || !userId) {
      console.warn('[WebSocket] URL ou userId não definidos:', { url, userId });
      return;
    }

    // Evitar múltiplas conexões
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Conexão já em andamento, aguardando...');
      return;
    }

    const connect = () => {
      // Limpar conexão anterior se existir
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        console.log('[WebSocket] Fechando conexão anterior...');
        wsRef.current.close(1000, 'Reconnecting');
        wsRef.current = null;
      }

      const wsUrl = `${url}?userId=${userId}&roomId=${roomId}`;
      console.log('[WebSocket] Conectando em:', wsUrl);
      
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[WebSocket] ✅ Conectado com sucesso!');
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;
          
          // Iniciar heartbeat para manter conexão ativa
          heartbeatIntervalRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: 'ping', userId, roomId }));
            }
          }, HEARTBEAT_INTERVAL);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket] 📨 Mensagem recebida:', data);
            
            // Ignorar mensagens de pong
            if (data.type === 'pong') return;
            
            // Usar a ref para evitar dependência
            onMessageRef.current(data);
            messageHandlers.current.forEach(handler => handler(data));
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error, 'Raw data:', event.data);
          }
        };

        ws.onerror = (error) => {
          console.error('[WebSocket] ❌ Erro de conexão:', error);
        };

        ws.onclose = (event) => {
          console.log('[WebSocket] 🔴 Desconectado:', { 
            code: event.code, 
            reason: event.reason,
            wasClean: event.wasClean 
          });
          setIsConnected(false);
          
          // Códigos que NÃO devem reconectar:
          // 1000 = fechamento normal
          // 1001 = endpoint indo embora  
          // 1006 = conexão perdida anormalmente (pode reconectar)
          const shouldNotReconnect = [1000, 1001].includes(event.code);
          
          // Se foi um fechamento limpo com código 1000, não reconectar
          if (event.wasClean && event.code === 1000) {
            console.log('[WebSocket] Fechamento limpo, não reconectando');
            return;
          }
          
          if (!shouldNotReconnect && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            const delay = RECONNECT_DELAY * reconnectAttemptsRef.current; // Backoff exponencial
            console.log(`[WebSocket] Tentando reconectar (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) em ${delay}ms...`);
            reconnectTimeoutRef.current = window.setTimeout(connect, delay);
          } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log('[WebSocket] ❌ Máximo de tentativas de reconexão atingido');
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('[WebSocket] Erro ao criar conexão:', error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [url, userId, roomId]); // NÃO incluir onMessage aqui!

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('[WebSocket] Tentativa de enviar mensagem com conexão fechada');
    return false;
  }, []);

  const addMessageHandler = useCallback((handler: (data: any) => void) => {
    messageHandlers.current.add(handler);
    return () => messageHandlers.current.delete(handler);
  }, []);

  return { sendMessage, isConnected, addMessageHandler };
}