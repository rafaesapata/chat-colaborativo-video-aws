/**
 * Hooks de estabilidade para Video Chat
 * Implementa: Heartbeat, ICE Restart, Connection Watchdog, Network Change, etc.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================
// 1. HEARTBEAT BIDIRECIONAL COM RECOVERY
// ============================================
const HEARTBEAT_INTERVAL = 15000;
const HEARTBEAT_TIMEOUT = 5000;
const MAX_MISSED_HEARTBEATS = 3;

export function useHeartbeat(
  ws: WebSocket | null,
  isConnected: boolean,
  onDead: () => void
) {
  const missedHeartbeats = useRef(0);
  const lastPong = useRef(Date.now());

  useEffect(() => {
    if (!ws || !isConnected || ws.readyState !== WebSocket.OPEN) return;

    const sendHeartbeat = () => {
      if (missedHeartbeats.current >= MAX_MISSED_HEARTBEATS) {
        console.error('[Heartbeat] Conexão morta detectada após', MAX_MISSED_HEARTBEATS, 'heartbeats perdidos');
        onDead();
        return;
      }

      try {
        ws.send(JSON.stringify({ action: 'ping', timestamp: Date.now() }));
        missedHeartbeats.current++;
      } catch (e) {
        console.error('[Heartbeat] Erro ao enviar ping:', e);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          missedHeartbeats.current = 0;
          lastPong.current = Date.now();
        }
      } catch {
        // Ignorar erros de parse
      }
    };

    ws.addEventListener('message', handleMessage);
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(interval);
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws, isConnected, onDead]);

  return { lastPong: lastPong.current, missedHeartbeats: missedHeartbeats.current };
}

// ============================================
// 2. CONNECTION WATCHDOG
// ============================================
const CONNECTION_TIMEOUT = 30000;
const STATES_TO_WATCH = ['connecting', 'new'];

export function useConnectionWatchdog(
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>,
  onTimeout: (peerId: string) => void
) {
  const connectionTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const checkConnections = () => {
      const now = Date.now();

      peerConnections.current.forEach((pc, peerId) => {
        if (STATES_TO_WATCH.includes(pc.connectionState)) {
          const startTime = connectionTimers.current.get(peerId);

          if (!startTime) {
            connectionTimers.current.set(peerId, now);
          } else if (now - startTime > CONNECTION_TIMEOUT) {
            console.warn('[Watchdog] Conexão timeout para:', peerId);
            onTimeout(peerId);
            connectionTimers.current.delete(peerId);
          }
        } else {
          connectionTimers.current.delete(peerId);
        }
      });
    };

    const interval = setInterval(checkConnections, 5000);
    return () => clearInterval(interval);
  }, [peerConnections, onTimeout]);
}

// ============================================
// 3. NETWORK CHANGE DETECTION
// ============================================
export function useNetworkChange(onNetworkChange: () => void) {
  const previousType = useRef<string | null>(null);
  const previousOnline = useRef(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      if (!previousOnline.current) {
        console.log('[Network] Conexão restaurada');
        previousOnline.current = true;
        onNetworkChange();
      }
    };

    const handleOffline = () => {
      console.log('[Network] Conexão perdida');
      previousOnline.current = false;
    };

    const connection = (navigator as any).connection;
    
    const handleConnectionChange = () => {
      if (!connection) return;
      
      const currentType = connection.effectiveType;
      if (previousType.current && previousType.current !== currentType) {
        console.log('[Network] Tipo mudou:', previousType.current, '→', currentType);
        onNetworkChange();
      }
      previousType.current = currentType;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
      previousType.current = connection.effectiveType;
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [onNetworkChange]);
}

// ============================================
// 4. ADAPTIVE BITRATE
// ============================================
const QUALITY_PRESETS = {
  excellent: { maxBitrate: 2500000, maxFramerate: 30 },
  good: { maxBitrate: 1500000, maxFramerate: 24 },
  fair: { maxBitrate: 800000, maxFramerate: 15 },
  poor: { maxBitrate: 300000, maxFramerate: 10 },
  unknown: { maxBitrate: 1000000, maxFramerate: 20 },
};

export function useAdaptiveBitrate(
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>,
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
) {
  const lastQuality = useRef(quality);

  useEffect(() => {
    if (quality === lastQuality.current) return;
    lastQuality.current = quality;

    const config = QUALITY_PRESETS[quality];
    console.log('[AdaptiveBitrate] Ajustando para qualidade:', quality, config);

    peerConnections.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = config.maxBitrate;
          params.encodings[0].maxFramerate = config.maxFramerate;
          
          sender.setParameters(params).catch((e) => {
            console.warn('[AdaptiveBitrate] Erro ao ajustar parâmetros:', e);
          });
        }
      });
    });
  }, [peerConnections, quality]);
}

// ============================================
// 5. TAB SYNC (Detecção de Abas Duplicadas)
// ============================================
const TAB_SYNC_CHANNEL = 'videochat-tab-sync';

export function useTabSync(roomId: string, odUserId: string) {
  const [isMainTab, setIsMainTab] = useState(true);
  const tabId = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!roomId) return;

    const channel = new BroadcastChannel(TAB_SYNC_CHANNEL);

    // Anunciar presença
    channel.postMessage({
      type: 'TAB_OPENED',
      roomId,
      odUserId,
      tabId: tabId.current,
      timestamp: Date.now(),
    });

    channel.onmessage = (event) => {
      const { type, roomId: msgRoomId, tabId: msgTabId, timestamp } = event.data;

      if (type === 'TAB_OPENED' && msgRoomId === roomId && msgTabId !== tabId.current) {
        // Aba mais antiga mantém controle
        if (timestamp < Date.now() - 500) {
          console.warn('[TabSync] Outra aba detectada, esta é secundária');
          setIsMainTab(false);
        }
      }

      if (type === 'TAB_CLOSED' && msgRoomId === roomId) {
        // Se a aba principal fechou, esta vira principal
        setIsMainTab(true);
      }
    };

    return () => {
      channel.postMessage({
        type: 'TAB_CLOSED',
        roomId,
        tabId: tabId.current,
      });
      channel.close();
    };
  }, [roomId, odUserId]);

  return { isMainTab };
}

// ============================================
// 6. GRACEFUL SHUTDOWN
// ============================================
export function useGracefulShutdown(
  roomId: string,
  userId: string,
  wsUrl: string,
  cleanup: () => void
) {
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Log de saída
      console.log('[GracefulShutdown] Saindo da sala:', roomId);
      cleanup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[GracefulShutdown] Aba oculta');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [roomId, userId, wsUrl, cleanup]);
}

// ============================================
// 7. STREAM RECOVERY
// ============================================
export function useStreamRecovery(
  localStream: MediaStream | null,
  onStreamRecovered: (newStream: MediaStream) => void
) {
  const [streamHealth, setStreamHealth] = useState<'healthy' | 'degraded' | 'failed'>('healthy');

  useEffect(() => {
    if (!localStream) return;

    const handleTrackEnded = async (track: MediaStreamTrack) => {
      console.warn('[StreamRecovery] Track encerrada:', track.kind);
      setStreamHealth('degraded');

      try {
        const constraints: MediaStreamConstraints = {};
        if (track.kind === 'video') constraints.video = true;
        if (track.kind === 'audio') constraints.audio = true;

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = newStream.getTracks()[0];

        // Substituir track no stream original
        localStream.removeTrack(track);
        localStream.addTrack(newTrack);

        setStreamHealth('healthy');
        console.log('[StreamRecovery] Track recuperada:', track.kind);
        onStreamRecovered(localStream);
      } catch (e) {
        console.error('[StreamRecovery] Falha ao recuperar:', e);
        setStreamHealth('failed');
      }
    };

    localStream.getTracks().forEach((track) => {
      track.onended = () => handleTrackEnded(track);
    });

    // Verificar saúde periodicamente
    const checkHealth = () => {
      const allLive = localStream.getTracks().every((t) => t.readyState === 'live');
      if (!allLive && streamHealth === 'healthy') {
        setStreamHealth('degraded');
      }
    };

    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [localStream, onStreamRecovered, streamHealth]);

  return { streamHealth };
}

// ============================================
// 8. DEVICE CHANGE HANDLING
// ============================================
export function useDeviceChange(
  localStream: MediaStream | null,
  onDeviceChange: () => void
) {
  useEffect(() => {
    const handleDeviceChange = async () => {
      if (!localStream) return;

      const currentVideoId = localStream.getVideoTracks()[0]?.getSettings().deviceId;
      const currentAudioId = localStream.getAudioTracks()[0]?.getSettings().deviceId;

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoExists = !currentVideoId || devices.some(
        (d) => d.kind === 'videoinput' && d.deviceId === currentVideoId
      );
      const audioExists = !currentAudioId || devices.some(
        (d) => d.kind === 'audioinput' && d.deviceId === currentAudioId
      );

      if (!videoExists || !audioExists) {
        console.log('[DeviceChange] Dispositivo desconectado');
        onDeviceChange();
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [localStream, onDeviceChange]);
}
