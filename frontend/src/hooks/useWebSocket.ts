import { useEffect, useRef, useState, useCallback } from 'react';
import { createMessageQueue, MessageQueue } from '../utils/messageQueue';
import { wsCircuitBreaker } from '../utils/circuitBreaker';

// Buffer de mensagens offline
interface BufferedMessage {
  id: string;
  payload: unknown;
  timestamp: number;
  retries: number;
}

const MAX_BUFFER_SIZE = 50;
const MAX_RETRIES = 3;
const MESSAGE_TTL = 30000; // 30 segundos
const ZOMBIE_PING_INTERVAL = 25000; // 25 segundos
const ZOMBIE_PONG_TIMEOUT = 10000; // 10 segundos para resposta
const ZOMBIE_MAX_MISSED = 3; // 3 pongs perdidos = zombie

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
  const isConnectingRef = useRef(false); // Mutex para evitar conexões simultâneas
  const pendingMessages = useRef<unknown[]>([]); // Fila de mensagens recebidas pendentes
  const offlineBuffer = useRef<BufferedMessage[]>([]); // Buffer de mensagens para enviar
  const messageQueueRef = useRef<MessageQueue | null>(null); // Message queue com backpressure
  const lastPongTimeRef = useRef<number>(Date.now()); // Zombie detection
  const missedPongsRef = useRef<number>(0); // Zombie detection
  const zombieCheckIntervalRef = useRef<number>(); // Zombie detection interval
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;
  const HEARTBEAT_INTERVAL = 30000; // 30 segundos

  // Atualizar a ref quando onMessage mudar, sem causar re-render
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Inicializar message queue
  useEffect(() => {
    messageQueueRef.current = createMessageQueue((data) => {
      onMessageRef.current(data);
      messageHandlers.current.forEach(handler => handler(data as Record<string, unknown>));
    });

    return () => {
      messageQueueRef.current?.clear();
    };
  }, []);

  useEffect(() => {
    if (!url || !userId) {
      console.warn('[WebSocket] URL ou userId não definidos:', { url, userId });
      return;
    }

    // Evitar múltiplas conexões simultâneas (race condition fix)
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Conexão já em andamento, aguardando...');
      return;
    }
    
    if (isConnectingRef.current) {
      console.log('[WebSocket] Mutex ativo, ignorando tentativa de conexão');
      return;
    }

    const connect = () => {
      // Verificar mutex novamente dentro da função
      if (isConnectingRef.current) {
        console.log('[WebSocket] Mutex ativo dentro de connect(), abortando');
        return;
      }
      isConnectingRef.current = true;
      
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
          isConnectingRef.current = false; // Liberar mutex
          
          // Flush buffer de mensagens offline
          if (offlineBuffer.current.length > 0) {
            const now = Date.now();
            const validMessages = offlineBuffer.current.filter(
              msg => now - msg.timestamp < MESSAGE_TTL && msg.retries < MAX_RETRIES
            );
            
            console.log(`[WebSocket] 📤 Enviando ${validMessages.length} mensagens do buffer offline`);
            validMessages.forEach(msg => {
              msg.retries++;
              try {
                ws.send(JSON.stringify(msg.payload));
              } catch (e) {
                console.warn('[WebSocket] Erro ao enviar mensagem do buffer:', e);
              }
            });
            offlineBuffer.current = [];
          }
          
          // Iniciar heartbeat para manter conexão ativa
          heartbeatIntervalRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: 'ping', userId, roomId }));
            }
          }, HEARTBEAT_INTERVAL);
          
          // Iniciar zombie detection
          zombieCheckIntervalRef.current = window.setInterval(() => {
            const timeSinceLastPong = Date.now() - lastPongTimeRef.current;
            if (timeSinceLastPong > ZOMBIE_PONG_TIMEOUT) {
              missedPongsRef.current++;
              console.warn('[WebSocket] 🧟 Pong perdido:', missedPongsRef.current);
              
              if (missedPongsRef.current >= ZOMBIE_MAX_MISSED) {
                console.error('[WebSocket] 🧟 Conexão zombie detectada! Reconectando...');
                missedPongsRef.current = 0;
                ws.close(4000, 'Zombie connection detected');
              }
            }
          }, ZOMBIE_PING_INTERVAL);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket] 📨 Mensagem recebida:', data);
            
            // Se receber mensagem de erro, logar detalhes e tratar como erro
            if (data.error || data.message === 'Forbidden' || data.message === 'Internal server error') {
              console.error('[WebSocket] ❌ Erro do servidor:', data);
              console.log('[WebSocket] URL usada:', wsUrl);
              console.log('[WebSocket] Parâmetros:', { userId, roomId });
              
              // Se for Forbidden, desconectar e tentar reconectar
              if (data.message === 'Forbidden') {
                console.warn('[WebSocket] Forbidden - fechando conexão para reconectar');
                ws.close(3000, 'Forbidden error - reconnecting');
              }
              return;
            }
            
            // Ignorar mensagens de pong (mas registrar para zombie detection)
            if (data.type === 'pong') {
              lastPongTimeRef.current = Date.now();
              missedPongsRef.current = 0;
              return;
            }
            
            // Usar message queue com backpressure para processar mensagens
            if (messageQueueRef.current) {
              messageQueueRef.current.enqueue(data);
            } else {
              // Fallback se queue não inicializada
              onMessageRef.current(data);
              messageHandlers.current.forEach(handler => handler(data));
            }
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error, 'Raw data:', event.data);
          }
        };

        ws.onerror = (error) => {
          console.error('[WebSocket] ❌ Erro de conexão:', error);
          console.log('[WebSocket] URL tentada:', wsUrl);
          console.log('[WebSocket] Parâmetros enviados:', { userId, roomId });
          console.log('[WebSocket] Estado da conexão:', ws.readyState);
          isConnectingRef.current = false; // Liberar mutex em caso de erro
        };

        ws.onclose = (event) => {
          console.log('[WebSocket] 🔴 Desconectado:', { 
            code: event.code, 
            reason: event.reason,
            wasClean: event.wasClean 
          });
          setIsConnected(false);
          isConnectingRef.current = false; // Liberar mutex
          
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
          
          // RES-001: Exponential backoff com jitter
          if (!shouldNotReconnect && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            const baseDelay = RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1);
            const jitter = Math.random() * 1000;
            const delay = Math.min(baseDelay + jitter, 30000); // Max 30 segundos
            console.log(`[WebSocket] Tentando reconectar (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) em ${Math.round(delay)}ms...`);
            reconnectTimeoutRef.current = window.setTimeout(connect, delay);
          } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log('[WebSocket] ❌ Máximo de tentativas de reconexão atingido');
            // Notificar usuário
            window.dispatchEvent(new CustomEvent('websocket-max-retries'));
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
      if (zombieCheckIntervalRef.current) {
        clearInterval(zombieCheckIntervalRef.current);
      }
      isConnectingRef.current = false;
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [url, userId, roomId]); // NÃO incluir onMessage aqui!

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] 📤 Enviando mensagem:', message);
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    
    // Adicionar ao buffer offline (exceto pings)
    if (message.action !== 'ping') {
      if (offlineBuffer.current.length >= MAX_BUFFER_SIZE) {
        offlineBuffer.current.shift(); // Remover mais antigo
      }
      offlineBuffer.current.push({
        id: crypto.randomUUID(),
        payload: message,
        timestamp: Date.now(),
        retries: 0
      });
      console.log('[WebSocket] 📦 Mensagem adicionada ao buffer offline:', message.action);
    }
    
    return false;
  }, []);

  const addMessageHandler = useCallback((handler: (data: any) => void) => {
    messageHandlers.current.add(handler);
    
    // ✅ Processar mensagens pendentes quando um handler é registrado
    if (pendingMessages.current.length > 0) {
      console.log(`[WebSocket] 🔄 Processando ${pendingMessages.current.length} mensagens pendentes`);
      const messages = [...pendingMessages.current];
      pendingMessages.current = [];
      messages.forEach(msg => {
        const typedMsg = msg as { type?: string };
        console.log('[WebSocket] 📨 Reprocessando mensagem pendente:', typedMsg.type);
        handler(msg);
      });
    }
    
    return () => messageHandlers.current.delete(handler);
  }, []);

  return { sendMessage, isConnected, addMessageHandler };
}