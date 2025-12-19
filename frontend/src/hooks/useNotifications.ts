import { useCallback, useRef } from 'react';

// Som de notificação (base64 encoded beep)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQYAQKPd7qJhAQBBqODxnVoAAEKs4/OYUwAARLDl9JNMAARGtOf1jkUACEi46PaJPgAMSrvp94Q3ABBNvur4fzAAFE/A6/l6KQAYUcLs+nUiABxTxO37cBsAIFXG7vxrFAAkV8jv/WYNAChZyu/+YQYALFvM8P9cAAAwXc7xAFcAADRf0PIBVAAAOGHQ8wJPAAA8Y9L0A0oAAEBl1PUERQAARGfW9gVAAABIadf3BjsAAExr2fgHNgAAUG3a+QgxAABUb9z6CSYAAFZ';

export function useNotifications() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotificationRef = useRef<number>(0);

  const playSound = useCallback(() => {
    // Evitar sons muito frequentes (mínimo 2 segundos entre notificações)
    const now = Date.now();
    if (now - lastNotificationRef.current < 2000) return;
    lastNotificationRef.current = now;

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND);
        audioRef.current.volume = 0.3;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (e) {
      console.warn('Não foi possível tocar som de notificação');
    }
  }, []);

  const notifyUserJoined = useCallback((userName: string) => {
    playSound();
    
    // Mostrar notificação do navegador se permitido
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Video Chat', {
        body: `${userName} entrou na sala`,
        icon: '📹',
        silent: true
      });
    }
  }, [playSound]);

  const notifyUserLeft = useCallback((userName: string) => {
    // Apenas som, sem notificação visual para saída
    playSound();
  }, [playSound]);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  return {
    notifyUserJoined,
    notifyUserLeft,
    requestNotificationPermission,
    playSound
  };
}
