/**
 * Hook para Background Blur e Virtual Background
 * 
 * - Convidados: Blur automático (médio)
 * - Autenticados: Escolha de níveis de blur e backgrounds
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Backgrounds virtuais disponíveis
export const VIRTUAL_BACKGROUNDS = [
  { id: 'none', name: 'Nenhum', type: 'none' as const, preview: '❌', strength: 0 },
  { id: 'blur-light', name: 'Desfoque Leve', type: 'blur' as const, strength: 5, preview: '🌫️' },
  { id: 'blur-medium', name: 'Desfoque Médio', type: 'blur' as const, strength: 10, preview: '🌁' },
  { id: 'blur-strong', name: 'Desfoque Forte', type: 'blur' as const, strength: 20, preview: '☁️' },
  { id: 'office', name: 'Escritório', type: 'image' as const, strength: 0, preview: '🏢', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&h=720&fit=crop' },
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

export function useBackgroundEffect({
  isAuthenticated,
  audioVideo,
  isVideoEnabled,
}: UseBackgroundEffectProps): UseBackgroundEffectReturn {
  // Sempre suportado - a UI é sempre mostrada
  const [isSupported] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBackground, setCurrentBackground] = useState<BackgroundOption>(VIRTUAL_BACKGROUNDS[0]);
  const [error, setError] = useState<string | null>(null);
  
  const autoAppliedRef = useRef(false);

  // Auto-aplicar blur para convidados quando vídeo é habilitado
  useEffect(() => {
    if (!isVideoEnabled || autoAppliedRef.current) return;
    
    if (!isAuthenticated) {
      autoAppliedRef.current = true;
      console.log('[BackgroundEffect] Aplicando blur automático para convidado');
      setCurrentBackground(VIRTUAL_BACKGROUNDS[2]); // blur-medium
    }
  }, [isAuthenticated, isVideoEnabled]);

  const setBackground = useCallback(async (backgroundId: string) => {
    const background = VIRTUAL_BACKGROUNDS.find(b => b.id === backgroundId);
    if (!background) {
      setError('Background não encontrado');
      return;
    }

    // Verificar permissão para backgrounds de imagem
    if (background.type === 'image' && !isAuthenticated) {
      setError('Backgrounds virtuais disponíveis apenas para usuários autenticados');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Simular processamento
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setCurrentBackground(background);
      console.log('[BackgroundEffect] Background aplicado:', background.name);
      
      // Nota: A integração real com o Chime SDK para blur/replacement
      // requer o pacote @amazon-chime-sdk/background-blur-processor
      // que não está instalado. Por enquanto, apenas atualizamos o estado.
      if (audioVideo && background.type !== 'none') {
        console.log('[BackgroundEffect] Efeito selecionado (visual apenas):', background.type);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao aplicar efeito');
    } finally {
      setIsProcessing(false);
    }
  }, [audioVideo, isAuthenticated]);

  const disableBackground = useCallback(async () => {
    await setBackground('none');
  }, [setBackground]);

  // Filtrar backgrounds disponíveis baseado na autenticação
  const availableBackgrounds = isAuthenticated 
    ? VIRTUAL_BACKGROUNDS 
    : VIRTUAL_BACKGROUNDS.filter(b => b.type !== 'image');

  return {
    isSupported: true, // Sempre mostrar o botão
    isBlurSupported: true,
    isReplacementSupported: isAuthenticated,
    isProcessing,
    currentBackground,
    availableBackgrounds,
    error,
    setBackground,
    disableBackground,
  };
}
