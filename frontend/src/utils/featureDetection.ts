/**
 * Feature Detection com Progressive Enhancement
 * Detecta suporte a features e oferece fallbacks
 */

interface Feature {
  name: string;
  isSupported: () => boolean;
  fallback?: () => void;
  degradedMode?: boolean;
}

const features: Record<string, Feature> = {
  speechRecognition: {
    name: 'Transcrição por Voz',
    isSupported: () =>
      'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
    fallback: () => {
      console.log('[Feature] Transcrição por voz não disponível');
    },
    degradedMode: true,
  },

  mediaRecorder: {
    name: 'Gravação de Reunião',
    isSupported: () => 'MediaRecorder' in window,
    fallback: () => {
      console.log('[Feature] Gravação não disponível');
    },
  },

  pictureInPicture: {
    name: 'Picture-in-Picture',
    isSupported: () => 'pictureInPictureEnabled' in document,
    degradedMode: true,
  },

  screenCapture: {
    name: 'Compartilhamento de Tela',
    isSupported: () =>
      'mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices,
  },

  webGL: {
    name: 'Efeitos Visuais',
    isSupported: () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(
          canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        );
      } catch {
        return false;
      }
    },
    degradedMode: true,
  },

  webRTC: {
    name: 'Chamadas de Vídeo',
    isSupported: () => 'RTCPeerConnection' in window,
  },

  getUserMedia: {
    name: 'Acesso à Câmera/Microfone',
    isSupported: () =>
      'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
  },

  audioContext: {
    name: 'Processamento de Áudio',
    isSupported: () =>
      'AudioContext' in window ||
      'webkitAudioContext' in (window as unknown as Record<string, unknown>),
  },

  indexedDB: {
    name: 'Armazenamento Local',
    isSupported: () => 'indexedDB' in window,
    degradedMode: true,
  },

  serviceWorker: {
    name: 'Modo Offline',
    isSupported: () => 'serviceWorker' in navigator,
    degradedMode: true,
  },
};

class FeatureDetector {
  private cache = new Map<string, boolean>();
  private degradedFeatures = new Set<string>();

  check(featureName: string): boolean {
    if (this.cache.has(featureName)) {
      return this.cache.get(featureName)!;
    }

    const feature = features[featureName];
    if (!feature) {
      console.warn('[FeatureDetector] Unknown feature:', featureName);
      return false;
    }

    const supported = feature.isSupported();
    this.cache.set(featureName, supported);

    if (!supported) {
      console.log(`[FeatureDetector] ${feature.name} não suportado`);

      if (feature.degradedMode) {
        this.degradedFeatures.add(featureName);
      }

      feature.fallback?.();
    }

    return supported;
  }

  isDegraded(featureName: string): boolean {
    return this.degradedFeatures.has(featureName);
  }

  getUnsupportedFeatures(): string[] {
    return Object.entries(features)
      .filter(([name]) => !this.check(name))
      .map(([, feature]) => feature.name);
  }

  getSupportedFeatures(): string[] {
    return Object.entries(features)
      .filter(([name]) => this.check(name))
      .map(([, feature]) => feature.name);
  }

  checkCriticalFeatures(): { supported: boolean; missing: string[] } {
    const critical = ['webRTC', 'getUserMedia', 'audioContext'];
    const missing = critical.filter((f) => !this.check(f));

    return {
      supported: missing.length === 0,
      missing: missing.map((f) => features[f]?.name || f),
    };
  }

  showCompatibilityWarning(): void {
    const unsupported = this.getUnsupportedFeatures();
    if (unsupported.length > 0) {
      console.warn(
        '[FeatureDetector] Algumas funcionalidades não estão disponíveis:',
        unsupported
      );
    }
  }
}

export const featureDetector = new FeatureDetector();

// Verificar features críticas no carregamento
if (typeof window !== 'undefined') {
  const { supported, missing } = featureDetector.checkCriticalFeatures();
  if (!supported) {
    console.error('[FeatureDetector] Features críticas não suportadas:', missing);
  }
}
