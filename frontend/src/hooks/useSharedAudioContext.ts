/**
 * Hook para AudioContext Compartilhado
 * Usa o singleton AudioContextManager
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { audioContextManager } from '../utils/audioContextManager';

type AudioContextState = 'suspended' | 'running' | 'closed';

export function useSharedAudioContext(componentId: string) {
  const [state, setState] = useState<AudioContextState>('suspended');
  const contextRef = useRef<AudioContext | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    contextRef.current = audioContextManager.acquire(componentId);

    audioContextManager.onStateChange(componentId, (newState) => {
      if (mountedRef.current) {
        setState(newState);
      }
    });

    return () => {
      mountedRef.current = false;
      audioContextManager.release(componentId);
    };
  }, [componentId]);

  const resume = useCallback(async () => {
    if (contextRef.current?.state === 'suspended') {
      await contextRef.current.resume();
    }
  }, []);

  const suspend = useCallback(async () => {
    if (contextRef.current?.state === 'running') {
      await contextRef.current.suspend();
    }
  }, []);

  return {
    context: contextRef.current,
    state,
    resume,
    suspend,
    isRunning: state === 'running',
    isSuspended: state === 'suspended',
  };
}
