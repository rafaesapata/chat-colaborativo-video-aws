/**
 * Hook de Transcrição com Detecção de Voz Ativa (VAD)
 * 
 * PROBLEMA RESOLVIDO:
 * A Web Speech API captura TODO o áudio do microfone, incluindo vozes de outros
 * participantes que saem pelo alto-falante. Isso causava confusão de speakers.
 * 
 * SOLUÇÃO:
 * Usar o Amazon Chime SDK activeSpeakers para detectar quando o usuário LOCAL
 * está realmente falando. Só processamos transcrições quando:
 * 1. O Chime detecta que o usuário local está falando (activeSpeakers inclui o userId)
 * 2. Ou dentro de um período de debounce após parar de falar (para capturar o final)
 * 
 * Isso garante que cada transcrição seja atribuída corretamente ao speaker.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { transcriptionDeduplicator } from '../utils/transcriptionDeduplicator';

// Sanitização de texto para segurança
const sanitizeText = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .substring(0, 5000);
};

interface Transcription {
  transcriptionId: string;
  userId: string;
  transcribedText: string;
  timestamp: number;
  speakerLabel?: string;
  isPartial?: boolean;
}

interface UseTranscriptionProps {
  roomId: string;
  userId: string;
  userName: string;
  sendMessage: (message: any) => boolean;
  addMessageHandler: (handler: (data: any) => void) => () => void;
  localStream: MediaStream | null;
  isLocalUserSpeaking?: boolean;
}

// Configurações
const CONFIG = {
  MAX_RESTART_ATTEMPTS: 5,
  SPEAKING_DEBOUNCE_MS: 800,      // Tempo após parar de falar para ainda aceitar transcrições
  SPEECH_LANG: 'pt-BR',
  MIN_TRANSCRIPT_LENGTH: 2,       // Mínimo de caracteres para considerar válido
};

export function useTranscription({
  roomId,
  userId,
  userName,
  sendMessage,
  addMessageHandler,
  localStream,
  isLocalUserSpeaking = false
}: UseTranscriptionProps) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs para valores que precisam ser acessados em callbacks
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isInitializedRef = useRef(false);
  const isTranscriptionEnabledRef = useRef(false);
  const restartAttemptsRef = useRef(0);
  const isLocalUserSpeakingRef = useRef(false);
  const speakingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const canProcessRef = useRef(false);


  // Sincronizar refs com props/state
  useEffect(() => {
    isTranscriptionEnabledRef.current = isTranscriptionEnabled;
  }, [isTranscriptionEnabled]);

  // Gerenciar estado de fala com debounce inteligente
  useEffect(() => {
    isLocalUserSpeakingRef.current = isLocalUserSpeaking;
    
    if (isLocalUserSpeaking) {
      // Usuário começou a falar - permitir processamento imediatamente
      canProcessRef.current = true;
      
      // Cancelar qualquer debounce pendente
      if (speakingDebounceRef.current) {
        clearTimeout(speakingDebounceRef.current);
        speakingDebounceRef.current = null;
      }
    } else {
      // Usuário parou de falar - manter processamento ativo por um período
      // para capturar o final da frase que pode chegar com delay
      speakingDebounceRef.current = setTimeout(() => {
        canProcessRef.current = false;
        speakingDebounceRef.current = null;
      }, CONFIG.SPEAKING_DEBOUNCE_MS);
    }
    
    return () => {
      if (speakingDebounceRef.current) {
        clearTimeout(speakingDebounceRef.current);
      }
    };
  }, [isLocalUserSpeaking]);

  // Verificar suporte do navegador
  const isSpeechRecognitionSupported = useCallback(() => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }, []);

  // Handler para mensagens de transcrição via WebSocket (de outros usuários)
  const handleTranscriptionMessage = useCallback((data: any) => {
    const isTranscriptionMsg = data.type === 'transcription' || data.data?.type === 'transcription';
    const matchesRoom = data.roomId === roomId || data.data?.roomId === roomId;
    
    if (!isTranscriptionMsg || !matchesRoom) return;
    
    const transcriptionData = data.data || data;
    const speakerId = transcriptionData.userId;
    
    // Ignorar transcrições do próprio usuário (já adicionadas localmente)
    if (speakerId === userId) return;
    
    // Determinar nome do speaker
    const speakerName = transcriptionData.userName || 
                        transcriptionData.speakerLabel || 
                        `Participante ${speakerId.slice(-4)}`;
    
    const newTranscription: Transcription = {
      transcriptionId: transcriptionData.transcriptionId || `trans_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      userId: speakerId,
      transcribedText: sanitizeText(transcriptionData.transcribedText || transcriptionData.text || ''),
      timestamp: transcriptionData.timestamp || Date.now(),
      speakerLabel: sanitizeText(speakerName),
      isPartial: transcriptionData.isPartial || false
    };

    // Verificar duplicação
    if (transcriptionDeduplicator.isDuplicate({
      odUserId: newTranscription.userId,
      transcribedText: newTranscription.transcribedText,
      isPartial: newTranscription.isPartial
    })) return;

    setTranscriptions(prev => {
      // Substituir parcial do mesmo usuário ou adicionar nova
      const filtered = prev.filter(t => !(t.userId === speakerId && t.isPartial));
      return [...filtered, newTranscription];
    });
  }, [roomId, userId]);

  // Adicionar transcrição local (do usuário atual)
  const addLocalTranscription = useCallback((text: string, isPartial: boolean) => {
    if (!text || text.trim().length < CONFIG.MIN_TRANSCRIPT_LENGTH) return;
    
    const transcriptionId = `trans_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const timestamp = Date.now();
    
    // Adicionar localmente
    setTranscriptions(prev => {
      const filtered = prev.filter(t => !(t.userId === userId && t.isPartial));
      return [...filtered, {
        transcriptionId,
        userId,
        transcribedText: text,
        timestamp,
        speakerLabel: 'Você',
        isPartial
      }];
    });
    
    // Enviar para outros participantes via WebSocket
    sendMessage({
      action: 'sendMessage',
      type: 'transcription',
      roomId,
      userId,
      userName,
      transcribedText: text,
      isPartial,
      timestamp
    });
  }, [userId, userName, roomId, sendMessage]);


  // Inicializar Speech Recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (!isSpeechRecognitionSupported() || recognitionRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = CONFIG.SPEECH_LANG;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      // CRÍTICO: Verificar se o usuário local está falando usando a ref atualizada
      // Isso evita processar áudio de outros participantes captado pelo microfone
      if (!canProcessRef.current && !isLocalUserSpeakingRef.current) {
        return;
      }

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Processar transcrição parcial
      if (interimTranscript.trim()) {
        addLocalTranscription(interimTranscript.trim(), true);
      }

      // Processar transcrição final
      if (finalTranscript.trim()) {
        addLocalTranscription(finalTranscript.trim(), false);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setIsTranscriptionEnabled(false);
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      
      // Auto-reiniciar se ainda habilitado
      if (isTranscriptionEnabledRef.current && restartAttemptsRef.current < CONFIG.MAX_RESTART_ATTEMPTS) {
        restartAttemptsRef.current++;
        setTimeout(() => {
          if (recognitionRef.current && isTranscriptionEnabledRef.current) {
            try {
              recognitionRef.current.start();
              setTimeout(() => { restartAttemptsRef.current = 0; }, 5000);
            } catch (e) {
              if (!(e as Error).message?.includes('already started')) {
                restartAttemptsRef.current++;
              }
            }
          }
        }, 100);
      } else if (restartAttemptsRef.current >= CONFIG.MAX_RESTART_ATTEMPTS) {
        setIsTranscriptionEnabled(false);
        restartAttemptsRef.current = 0;
      }
    };

    recognitionRef.current = recognition;
  }, [isSpeechRecognitionSupported, addLocalTranscription]);

  // Toggle transcrição
  const toggleTranscription = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      alert('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }

    if (!localStream) {
      alert('Microfone não disponível. Permita o acesso ao microfone primeiro.');
      return;
    }

    setIsTranscriptionEnabled(prev => {
      const newState = !prev;
      
      if (newState) {
        if (!recognitionRef.current) {
          initializeSpeechRecognition();
        }
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            // Ignorar erro se já iniciado
          }
        }, 100);
      } else {
        recognitionRef.current?.stop();
        setIsRecording(false);
      }
      
      return newState;
    });
  }, [isSpeechRecognitionSupported, localStream, initializeSpeechRecognition]);

  // Função de teste
  const addTestTranscription = useCallback((text: string) => {
    addLocalTranscription(text, false);
  }, [addLocalTranscription]);

  // Inicialização e cleanup
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const unsubscribe = addMessageHandler(handleTranscriptionMessage);

    return () => {
      unsubscribe();
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      isInitializedRef.current = false;
      if (speakingDebounceRef.current) {
        clearTimeout(speakingDebounceRef.current);
      }
    };
  }, [addMessageHandler, handleTranscriptionMessage]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    transcriptions,
    isTranscriptionEnabled,
    isRecording,
    toggleTranscription,
    addTestTranscription,
    isSpeechRecognitionSupported: isSpeechRecognitionSupported()
  };
}
