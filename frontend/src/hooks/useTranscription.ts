/**
 * Hook de Transcrição Sincronizada para Sala
 * 
 * FUNCIONALIDADE:
 * Quando um usuário ativa a transcrição, TODOS os participantes da sala
 * automaticamente ativam suas transcrições locais. Cada participante
 * transcreve sua própria voz e compartilha via WebSocket.
 * 
 * FLUXO:
 * 1. Usuário A clica em "Ativar Transcrição"
 * 2. Envia comando 'transcription_sync' para todos via WebSocket
 * 3. Todos os participantes ativam Speech Recognition local
 * 4. Cada um transcreve sua própria voz e envia para os outros
 * 5. Resultado: transcrição de TODOS os participantes
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { transcriptionDeduplicator } from '../utils/transcriptionDeduplicator';

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

const CONFIG = {
  MAX_RESTART_ATTEMPTS: 5,
  SPEAKING_DEBOUNCE_MS: 1500,
  SPEECH_LANG: 'pt-BR',
  MIN_TRANSCRIPT_LENGTH: 2,
  USE_VAD_FILTER: false,
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
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isInitializedRef = useRef(false);
  const isTranscriptionEnabledRef = useRef(false);
  const restartAttemptsRef = useRef(0);
  const isLocalUserSpeakingRef = useRef(false);
  const speakingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const canProcessRef = useRef(false);
  const activatedByRemoteRef = useRef(false);
  const pendingSyncEnableRef = useRef(false);

  useEffect(() => {
    isTranscriptionEnabledRef.current = isTranscriptionEnabled;
  }, [isTranscriptionEnabled]);

  useEffect(() => {
    isLocalUserSpeakingRef.current = isLocalUserSpeaking;
    
    if (isLocalUserSpeaking) {
      canProcessRef.current = true;
      if (speakingDebounceRef.current) {
        clearTimeout(speakingDebounceRef.current);
        speakingDebounceRef.current = null;
      }
    } else {
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

  const isSpeechRecognitionSupported = useCallback(() => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }, []);

  const addLocalTranscription = useCallback((text: string, isPartial: boolean) => {
    if (!text || text.trim().length < CONFIG.MIN_TRANSCRIPT_LENGTH) return;
    
    const transcriptionId = `trans_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const timestamp = Date.now();
    
    setTranscriptions(prev => {
      const filtered = prev.filter(t => !(t.userId === userId && t.isPartial));
      return [...filtered, {
        transcriptionId,
        userId,
        transcribedText: text,
        timestamp,
        speakerLabel: userName,
        isPartial
      }];
    });
    
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

  // Função para iniciar o recognition (usada internamente)
  const startRecognitionInternal = useCallback(() => {
    if (!isSpeechRecognitionSupported()) return;
    
    if (!recognitionRef.current) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = CONFIG.SPEECH_LANG;

      recognition.onstart = () => {
        setIsRecording(true);
        console.log('[Transcription] Recording started');
      };

      recognition.onresult = (event) => {
        if (CONFIG.USE_VAD_FILTER && !canProcessRef.current && !isLocalUserSpeakingRef.current) {
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

        if (interimTranscript.trim()) {
          addLocalTranscription(interimTranscript.trim(), true);
        }

        if (finalTranscript.trim()) {
          addLocalTranscription(finalTranscript.trim(), false);
        }
      };

      recognition.onerror = (event) => {
        console.log('[Transcription] Error:', event.error);
        if (event.error === 'not-allowed') {
          setIsTranscriptionEnabled(false);
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        
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
    }

    setTimeout(() => {
      try {
        recognitionRef.current?.start();
        setIsTranscriptionEnabled(true);
      } catch (e) {
        // Ignorar se já iniciado
      }
    }, 100);
  }, [isSpeechRecognitionSupported, addLocalTranscription]);

  // Handler para mensagens WebSocket
  const handleTranscriptionMessage = useCallback((data: any) => {
    // Sincronização de transcrição na sala
    const isSyncMsg = data.type === 'transcription_sync' || data.data?.type === 'transcription_sync';
    if (isSyncMsg) {
      const syncData = data.data || data;
      const matchesRoom = syncData.roomId === roomId;
      
      if (matchesRoom && syncData.userId !== userId) {
        const shouldEnable = syncData.syncAction === 'enable';
        
        console.log(`[Transcription] Sync: ${shouldEnable ? 'ENABLE' : 'DISABLE'} from ${syncData.userName}`);
        
        if (shouldEnable && !isTranscriptionEnabledRef.current) {
          activatedByRemoteRef.current = true;
          pendingSyncEnableRef.current = true;
        } else if (!shouldEnable && activatedByRemoteRef.current) {
          recognitionRef.current?.stop();
          setIsRecording(false);
          setIsTranscriptionEnabled(false);
          activatedByRemoteRef.current = false;
        }
      }
      return;
    }
    
    // Mensagens de transcrição
    const isTranscriptionMsg = data.type === 'transcription' || data.data?.type === 'transcription';
    const matchesRoom = data.roomId === roomId || data.data?.roomId === roomId;
    
    if (!isTranscriptionMsg || !matchesRoom) return;
    
    const transcriptionData = data.data || data;
    const speakerId = transcriptionData.userId;
    
    if (speakerId === userId) return;
    
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

    if (transcriptionDeduplicator.isDuplicate({
      odUserId: newTranscription.userId,
      transcribedText: newTranscription.transcribedText,
      isPartial: newTranscription.isPartial
    })) return;

    setTranscriptions(prev => {
      const filtered = prev.filter(t => !(t.userId === speakerId && t.isPartial));
      return [...filtered, newTranscription];
    });
  }, [roomId, userId]);

  // Processar sync pendente
  useEffect(() => {
    if (pendingSyncEnableRef.current && localStream) {
      pendingSyncEnableRef.current = false;
      startRecognitionInternal();
    }
  }, [localStream, startRecognitionInternal]);

  // Toggle transcrição (ativa para TODA a sala)
  const toggleTranscription = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      alert('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }

    if (!localStream) {
      alert('Microfone não disponível. Permita o acesso ao microfone primeiro.');
      return;
    }

    const newState = !isTranscriptionEnabledRef.current;
    
    // Enviar comando de sincronização para TODOS na sala
    sendMessage({
      action: 'sendMessage',
      type: 'transcription_sync',
      roomId,
      userId,
      userName,
      syncAction: newState ? 'enable' : 'disable',
      timestamp: Date.now()
    });
    
    console.log(`[Transcription] Sending sync: ${newState ? 'ENABLE' : 'DISABLE'}`);
    
    if (newState) {
      startRecognitionInternal();
    } else {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setIsTranscriptionEnabled(false);
      activatedByRemoteRef.current = false;
    }
  }, [isSpeechRecognitionSupported, localStream, sendMessage, roomId, userId, userName, startRecognitionInternal]);

  const addTestTranscription = useCallback((text: string) => {
    addLocalTranscription(text, false);
  }, [addLocalTranscription]);

  // Inicialização
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
