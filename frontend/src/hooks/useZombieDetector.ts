/**
 * Zombie Connection Detector
 * Detecta conexões que parecem ativas mas estão mortas no servidor
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface ZombieDetectorConfig {
  pingInterval: number;
  pongTimeout: number;
  maxMissedPongs: number;
  onZombieDetected: () => void;
}

interface ZombieDetectorState {
  isAlive: boolean;
  lastPongTime: number;
  missedPongs: number;
}

export function useZombieDetector(
  sendPing: (() => void) | null,
  config: ZombieDetectorConfig
) {
  const [state, setState] = useState<ZombieDetectorState>({
    isAlive: true,
    lastPongTime: Date.now(),
    missedPongs: 0,
  });

  const missedPongsRef = useRef(0);
  const lastPongTimeRef = useRef(Date.now());
  const isAliveRef = useRef(true);
  const intervalsRef = useRef<{ ping?: ReturnType<typeof setInterval>; check?: ReturnType<typeof setInterval> }>({});

  const receivePong = useCallback(() => {
    lastPongTimeRef.current = Date.now();
    missedPongsRef.current = 0;
    isAliveRef.current = true;

    setState({
      isAlive: true,
      lastPongTime: lastPongTimeRef.current,
      missedPongs: 0,
    });
  }, []);

  useEffect(() => {
    if (!sendPing) return;

    const checkAlive = () => {
      const timeSinceLastPong = Date.now() - lastPongTimeRef.current;

      if (timeSinceLastPong > config.pongTimeout) {
        missedPongsRef.current++;
        console.warn('[ZombieDetector] Pong perdido:', missedPongsRef.current);

        setState((prev) => ({
          ...prev,
          missedPongs: missedPongsRef.current,
        }));

        if (missedPongsRef.current >= config.maxMissedPongs) {
          console.error('[ZombieDetector] Conexão zombie detectada!');
          isAliveRef.current = false;
          setState((prev) => ({ ...prev, isAlive: false }));
          config.onZombieDetected();
        }
      }
    };

    const doPing = () => {
      if (!isAliveRef.current) return;

      try {
        sendPing();
      } catch (e) {
        console.warn('[ZombieDetector] Erro ao enviar ping:', e);
      }
    };

    // Iniciar intervalos
    intervalsRef.current.ping = setInterval(doPing, config.pingInterval);
    intervalsRef.current.check = setInterval(checkAlive, config.pongTimeout);

    // Enviar primeiro ping imediatamente
    doPing();

    return () => {
      if (intervalsRef.current.ping) clearInterval(intervalsRef.current.ping);
      if (intervalsRef.current.check) clearInterval(intervalsRef.current.check);
    };
  }, [sendPing, config]);

  const reset = useCallback(() => {
    missedPongsRef.current = 0;
    lastPongTimeRef.current = Date.now();
    isAliveRef.current = true;
    setState({
      isAlive: true,
      lastPongTime: Date.now(),
      missedPongs: 0,
    });
  }, []);

  return {
    ...state,
    receivePong,
    reset,
  };
}

// Configuração padrão
export const defaultZombieConfig: ZombieDetectorConfig = {
  pingInterval: 15000, // 15 segundos
  pongTimeout: 10000, // 10 segundos para resposta
  maxMissedPongs: 3, // 3 pongs perdidos = zombie
  onZombieDetected: () => {
    console.error('[ZombieDetector] Conexão zombie - recarregue a página');
  },
};
