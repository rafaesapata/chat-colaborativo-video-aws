import { useState, useEffect, useRef, useCallback } from 'react';

// SEC-004: Sanitização básica de texto (sem dependência externa)
const sanitizeText = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .substring(0, 5000); // Limitar tamanho
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
}

export function useTranscription({
  roomId,
  userId,
  userName,
  sendMessage,
  addMessageHandler,
  localStream
}: UseTranscriptionProps) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isInitializedRef = useRef(false);
  const isTranscriptionEnabledRef = useRef(false);
  const restartAttemptsRef = useRef(0);
  const MAX_RESTART_ATTEMPTS = 5;

  // Manter ref sincronizada com state
  useEffect(() => {
    isTranscriptionEnabledRef.current = isTranscriptionEnabled;
  }, [isTranscriptionEnabled]);

  // Verificar suporte do navegador
  const isSpeechRecognitionSupported = useCallback(() => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }, []);

  // Handler para mensagens de transcrição via WebSocket
  const handleTranscriptionMessage = useCallback((data: any) => {
    if ((data.type === 'transcription' || data.data?.type === 'transcription') && (data.roomId === roomId || data.data?.roomId === roomId)) {
      const transcriptionData = data.data || data;
      
      // Determinar o nome do locutor corretamente
      const speakerId = transcriptionData.userId;
      const isLocalUser = speakerId === userId;
      
      // Usar o nome que veio na mensagem, ou "Você" se for o usuário local
      let speakerName = transcriptionData.userName || transcriptionData.speakerLabel;
      if (isLocalUser) {
        speakerName = 'Você';
      } else if (!speakerName) {
        speakerName = `Participante ${speakerId.substring(speakerId.length - 4)}`;
      }
      
      const newTranscription: Transcription = {
        transcriptionId: transcriptionData.transcriptionId || `trans_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: speakerId,
        // SEC-004: SANITIZAÇÃO OBRIGATÓRIA
        transcribedText: sanitizeText(transcriptionData.transcribedText || transcriptionData.text || ''),
        timestamp: transcriptionData.timestamp || Date.now(),
        speakerLabel: sanitizeText(speakerName),
        isPartial: transcriptionData.isPartial || false
      };

      console.log('[Transcription] Nova transcrição recebida:', {
        from: speakerName,
        isLocal: isLocalUser,
        text: newTranscription.transcribedText?.substring(0, 50)
      });

      setTranscriptions(prev => {
        // Se é uma transcrição parcial, substituir a última parcial do mesmo usuário
        if (newTranscription.isPartial) {
          const filtered = prev.filter(t => !(t.userId === newTranscription.userId && t.isPartial));
          return [...filtered, newTranscription];
        }
        
        // Se é final, remover qualquer parcial do mesmo usuário e adicionar a final
        const filtered = prev.filter(t => !(t.userId === newTranscription.userId && t.isPartial));
        return [...filtered, newTranscription];
      });
    }
  }, [roomId, userId]);

  // Inicializar Speech Recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (!isSpeechRecognitionSupported() || recognitionRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onstart = () => {
      console.log('[Transcription] Speech recognition started');
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
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

      // Enviar transcrição parcial
      if (interimTranscript) {
        const transcriptionData = {
          action: 'sendMessage',
          type: 'transcription',
          roomId,
          userId,
          userName,
          transcribedText: interimTranscript,
          isPartial: true,
          timestamp: Date.now()
        };
        sendMessage(transcriptionData);
      }

      // Enviar transcrição final
      if (finalTranscript) {
        const transcriptionData = {
          action: 'sendMessage',
          type: 'transcription',
          roomId,
          userId,
          userName,
          transcribedText: finalTranscript,
          isPartial: false,
          timestamp: Date.now()
        };
        sendMessage(transcriptionData);
      }
    };

    recognition.onerror = (event) => {
      console.error('[Transcription] Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setIsTranscriptionEnabled(false);
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      console.log('[Transcription] Speech recognition ended');
      setIsRecording(false);
      
      // Reiniciar se ainda estiver habilitado (com limite) - usar ref para valor atual
      if (isTranscriptionEnabledRef.current && restartAttemptsRef.current < MAX_RESTART_ATTEMPTS) {
        restartAttemptsRef.current++;
        setTimeout(() => {
          if (recognitionRef.current && isTranscriptionEnabledRef.current) {
            try {
              recognitionRef.current.start();
              // Reset contador após start bem-sucedido
              setTimeout(() => { restartAttemptsRef.current = 0; }, 5000);
            } catch (error) {
              console.error('[Transcription] Error restarting recognition:', error);
              if (!(error as Error).message?.includes('already started')) {
                restartAttemptsRef.current++;
              }
            }
          }
        }, 100);
      } else if (restartAttemptsRef.current >= MAX_RESTART_ATTEMPTS) {
        console.error('[Transcription] Max restart attempts reached, disabling');
        setIsTranscriptionEnabled(false);
        restartAttemptsRef.current = 0;
      }
    };

    recognitionRef.current = recognition;
  }, [isSpeechRecognitionSupported, roomId, userId, userName, sendMessage]);

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
        // Inicializar e começar
        if (!recognitionRef.current) {
          initializeSpeechRecognition();
        }
        
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error('[Transcription] Error starting recognition:', error);
            }
          }
        }, 100);
      } else {
        // Parar
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        setIsRecording(false);
      }
      
      return newState;
    });
  }, [isSpeechRecognitionSupported, localStream, initializeSpeechRecognition]);

  // Adicionar transcrição de teste (para desenvolvimento)
  const addTestTranscription = useCallback((text: string) => {
    const testTranscription: Transcription = {
      transcriptionId: `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      transcribedText: text,
      timestamp: Date.now(),
      speakerLabel: userName,
      isPartial: false
    };

    setTranscriptions(prev => [...prev, testTranscription]);

    // Também enviar via WebSocket para outros participantes
    sendMessage({
      action: 'sendMessage',
      type: 'transcription',
      roomId,
      userId,
      userName,
      transcribedText: text,
      isPartial: false,
      timestamp: Date.now()
    });
  }, [userId, userName, roomId, sendMessage]);

  // Inicialização
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Registrar handler de mensagens
    const unsubscribe = addMessageHandler(handleTranscriptionMessage);

    return () => {
      unsubscribe();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [addMessageHandler, handleTranscriptionMessage]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
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