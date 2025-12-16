import { useEffect, useRef, useState } from 'react';

export function useWebSocket(
  url: string,
  userId: string,
  roomId: string,
  onMessage: (data: any) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messageHandlers = useRef<Set<(data: any) => void>>(new Set());

  useEffect(() => {
    if (!url || !userId) {
      console.warn('[WebSocket] URL ou userId não definidos:', { url, userId });
      return;
    }

    const wsUrl = `${url}?userId=${userId}&roomId=${roomId}`;
    console.log('[WebSocket] Conectando em:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] ✅ Conectado com sucesso!');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
        // Notificar handlers adicionais (para WebRTC)
        messageHandlers.current.forEach(handler => handler(data));
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] ❌ Erro:', error);
    };

    ws.onclose = (event) => {
      console.log('[WebSocket] 🔴 Desconectado:', { code: event.code, reason: event.reason });
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [url, userId, roomId]);

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const addMessageHandler = (handler: (data: any) => void) => {
    messageHandlers.current.add(handler);
    return () => messageHandlers.current.delete(handler);
  };

  return { sendMessage, isConnected, onMessage: addMessageHandler };
}
