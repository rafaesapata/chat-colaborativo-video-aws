/**
 * Hook para Background Blur e Virtual Background usando Amazon Chime SDK
 * 
 * - Convidados: Blur automático (médio)
 * - Autenticados: Escolha de níveis de blur e backgrounds virtuais
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BackgroundBlurVideoFrameProcessor,
  BackgroundReplacementVideoFrameProcessor,
  DefaultVideoTransformDevice,
  VideoFrameProcessor,
  ConsoleLogger,
  LogLevel,
} from 'amazon-chime-sdk-js';

// Backgrounds virtuais disponíveis
export const VIRTUAL_BACKGROUNDS = [
  { id: 'none', name: 'Nenhum', type: 'none' as const, preview: '❌', strength: 0 },
  { id: 'blur-light', name: 'Desfoque Leve', type: 'blur' as const, strength: 7, preview: '🌫️' },
  { id: 'blur-medium', name: 'Desfoque Médio', type: 'blur' as const, strength: 15, preview: '🌁' },
  { id: 'blur-strong', name: 'Desfoque Forte', type: 'blur' as const, strength: 25, preview: '☁️' },
  { id: 'office', name: 'Escritório', type: 'image' as const, strength: 0, preview: '🏢', url: 'https://images.unsplash.com/photo-497366216548-37526070297c?w=1280&h=720&fit=crop' },
  { id: 'nature', name: 'Natureza', type: 'image' as const, strength: 0, preview: '🌿', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1280&h=720&fit=crop' },
  { id: 'abstract', name: 'Abstrato', type: 'image' as const, strength: 0, preview: '🎨', url: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1280&h=720&fit=crop' },
];

export type BackgroundType = 'none' | 'blur' | 'image';

export interface BackgroundOption {
  id: string;
  name: string;
  type: BackgroundType;
  strength?: number;
  url?: string;
  preview: string | null;
}

interface UseBackgroundEffectProps {
  isAuthenticated: boolean;
  audioVideo: any;
  isVideoEnabled: boolean;
}

interface UseBackgroundEffectReturn {
  isSupported: boolean;
  isBlurSupported: boolean;
  isReplacementSupported: boolean;
  isProcessing: boolean;
  currentBackground: BackgroundOption;
  availableBackgrounds: BackgroundOption[];
  error: string | null;
  setBackground: (backgroundId: string) => Promise<void>;
  disableBackground: () => Promise<void>;
}

// Verificar suporte a background blur
async function checkBackgroundBlurSupport(): Promise<boolean> {
  try {
    if (typeof OffscreenCanvas === 'undefined') return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    return await BackgroundBlurVideoFrameProcessor.isSupported();
  } catch {
    return false;
  }
}

// Verificar suporte a background replacement
async function checkBackgroundReplacementSupport(): Promise<boolean> {
  try {
    if (typeof OffscreenCanvas === 'undefined') return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    return await BackgroundReplacementVideoFrameProcessor.isSupported();
  } catch {
    return false;
  }
}

// Carregar imagem como blob
async function loadImageBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  return await response.blob();
}

export function useBackgroundEffect({
  isAuthenticated,
  audioVideo,
  isVideoEnabled,
}: UseBackgroundEffectProps): UseBackgroundEffectReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isBlurSupported, setIsBlurSupported] = useState(false);
  const [isReplacementSupported, setIsReplacementSupported] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBackground, setCurrentBackground] = useState<BackgroundOption>(VIRTUAL_BACKGROUNDS[0]);
  const [error, setError] = useState<string | null>(null);
  
  const processorRef = useRef<VideoFrameProcessor | null>(null);
  const transformDeviceRef = useRef<DefaultVideoTransformDevice | null>(null);
  const originalDeviceRef = useRef<string | null>(null);
  const autoAppliedRef = useRef(false);
  const loggerRef = useRef<ConsoleLogger | null>(null);

  // Criar logger uma vez
  useEffect(() => {
    if (!loggerRef.current) {
      loggerRef.current = new ConsoleLogger('BackgroundEffect', LogLevel.ERROR);
    }
  }, []);

  // Verificar suporte ao inicializar
  useEffect(() => {
    const checkSupport = async () => {
      const blurSupported = await checkBackgroundBlurSupport();
      const replacementSupported = await checkBackgroundReplacementSupport();
      setIsBlurSupported(blurSupported);
      setIsReplacementSupported(replacementSupported);
      setIsSupported(blurSupported || replacementSupported);
    };
    checkSupport();
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (processorRef.current && typeof (processorRef.current as any).destroy === 'function') {
        (processorRef.current as any).destroy();
        processorRef.current = null;
      }
      if (transformDeviceRef.current) {
        transformDeviceRef.current.stop();
        transformDeviceRef.current = null;
      }
    };
  }, []);

  // Auto-aplicar blur para convidados quando vídeo é habilitado
  useEffect(() => {
    if (!isVideoEnabled || autoAppliedRef.current || !isBlurSupported) return;
    
    if (!isAuthenticated && audioVideo) {
      autoAppliedRef.current = true;
      setBackground('blur-medium').catch(() => {});
    }
  }, [isAuthenticated, isVideoEnabled, isBlurSupported, audioVideo]);

  const setBackground = useCallback(async (backgroundId: string) => {
    const background = VIRTUAL_BACKGROUNDS.find(b => b.id === backgroundId);
    if (!background) {
      setError('Background não encontrado');
      return;
    }

    if (background.type === 'image' && !isAuthenticated) {
      setError('Backgrounds virtuais disponíveis apenas para usuários autenticados');
      return;
    }

    if (!audioVideo) {
      setCurrentBackground(background);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Limpar processador anterior
      if (processorRef.current && typeof (processorRef.current as any).destroy === 'function') {
        (processorRef.current as any).destroy();
        processorRef.current = null;
      }

      // Se for "none", restaurar dispositivo original
      if (background.type === 'none') {
        if (transformDeviceRef.current) {
          await transformDeviceRef.current.stop();
          transformDeviceRef.current = null;
        }
        
        if (originalDeviceRef.current) {
          try {
            await audioVideo.startVideoInput(originalDeviceRef.current);
          } catch {
            // Ignorar erro
          }
        }
        
        setCurrentBackground(background);
        return;
      }

      // Obter dispositivo de vídeo atual
      let currentDeviceId = originalDeviceRef.current;
      
      if (!currentDeviceId) {
        currentDeviceId = sessionStorage.getItem('videochat_video_device') || null;
        
        if (!currentDeviceId) {
          try {
            const videoDevices = await audioVideo.listVideoInputDevices();
            if (videoDevices && videoDevices.length > 0) {
              currentDeviceId = videoDevices[0].deviceId;
            }
          } catch {
            // Ignorar erro
          }
        }
      }
      
      if (!currentDeviceId) {
        throw new Error('Nenhum dispositivo de vídeo encontrado');
      }

      if (!originalDeviceRef.current) {
        originalDeviceRef.current = currentDeviceId;
      }

      let processor: VideoFrameProcessor | undefined;

      if (background.type === 'blur') {
        if (!isBlurSupported) {
          throw new Error('Background blur não suportado neste navegador');
        }
        
        const blurProcessor = await BackgroundBlurVideoFrameProcessor.create(undefined, {
          blurStrength: background.strength || 15,
        });
        
        if (!blurProcessor) {
          throw new Error('Falha ao criar processador de blur');
        }
        
        processor = blurProcessor as unknown as VideoFrameProcessor;
        
      } else if (background.type === 'image') {
        if (!isReplacementSupported) {
          throw new Error('Background replacement não suportado neste navegador');
        }
        
        if (!background.url) {
          throw new Error('URL da imagem não definida');
        }

        const imageBlob = await loadImageBlob(background.url);
        
        const replacementProcessor = await BackgroundReplacementVideoFrameProcessor.create(undefined, {
          imageBlob,
        });
        
        if (!replacementProcessor) {
          throw new Error('Falha ao criar processador de replacement');
        }
        
        processor = replacementProcessor as unknown as VideoFrameProcessor;
        
      } else {
        throw new Error('Tipo de background inválido');
      }

      if (!processor) {
        throw new Error('Processador não criado');
      }

      processorRef.current = processor;

      const deviceId = originalDeviceRef.current;
      if (!deviceId) {
        throw new Error('Device ID não encontrado');
      }

      const logger = loggerRef.current || new ConsoleLogger('BackgroundEffect', LogLevel.ERROR);

      const transformDevice = new DefaultVideoTransformDevice(
        logger,
        deviceId,
        [processor]
      );

      if (transformDeviceRef.current) {
        await transformDeviceRef.current.stop();
      }

      transformDeviceRef.current = transformDevice;
      await audioVideo.startVideoInput(transformDevice);
      setCurrentBackground(background);
      
    } catch (e: any) {
      setError(e.message || 'Erro ao aplicar efeito de fundo');
      
      if (originalDeviceRef.current && audioVideo) {
        try {
          await audioVideo.startVideoInput(originalDeviceRef.current);
        } catch {
          // Ignorar erro de restauração
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }, [audioVideo, isAuthenticated, isBlurSupported, isReplacementSupported]);

  const disableBackground = useCallback(async () => {
    await setBackground('none');
  }, [setBackground]);

  const availableBackgrounds = VIRTUAL_BACKGROUNDS.filter(b => {
    if (b.type === 'none') return true;
    if (b.type === 'blur') return isBlurSupported;
    if (b.type === 'image') return isAuthenticated && isReplacementSupported;
    return false;
  });

  return {
    isSupported,
    isBlurSupported,
    isReplacementSupported,
    isProcessing,
    currentBackground,
    availableBackgrounds,
    error,
    setBackground,
    disableBackground,
  };
}
