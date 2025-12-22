/**
 * Hook de Transcrição via Amazon Transcribe (Chime SDK)
 * 
 * v1.0.0 - Nível Militar de Qualidade
 * 
 * Usa o Amazon Transcribe integrado ao Chime SDK para transcrição
 * profissional e precisa, processada no servidor (não no navegador).
 * 
 * VANTAGENS:
 * - Transcrição profissional via Amazon Transcribe
 * - Funciona em qualquer navegador
 * - Identifica automaticamente quem está falando
 * - Não depende do Speech Recognition do browser
 * - Suporte a múltiplos idiomas
 * 
 * CUSTO: ~$0.024/minuto de áudio transcrito
 * 
 * SEGURANÇA:
 * - Sanitização de texto para prevenir XSS
 * - Validação de dados recebidos
 * - Limite de transcrições em memória
 * - Cleanup automático ao desmontar
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TranscriptEvent, Transcript } from 'amazon-chime-sdk-js';

// ============ CONFIGURAÇÃO ============
const CONFIG = Object.freeze({
  API_URL: import.meta.env.VITE_CHIME_API_URL || import.meta.env.VITE_API_URL || '',
  MAX_TRANSCRIPTIONS: 500,           // Limite de transcrições em memória
  MAX_TEXT_LENGTH: 5000,             // Limite de caracteres por transcrição
  FETCH_TIMEOUT_MS: 15000,           // Timeout para chamadas API
  LANGUAGE_CODE: 'pt-BR',            // Idioma padrão
  RETRY_ATTEMPTS: 2,                 // Tentativas de retry
  RETRY_DELAY_MS: 1000,              // Delay entre retries
});

// ============ TIPOS ============
export interface ChimeTranscription {
  transcriptionId: string;
  userId: string;
  transcribedText: string;
  timestamp: number;
  speakerLabel?: string;
  isPartial?: boolean;
  attendeeId?: string;
}

interface UseChimeTranscriptionProps {
  roomId: string;
  odUserId: string;
  userName: string;
  meetingId: string | null;
  audioVideo: any; // AudioVideoFacade from Chime SDK
  attendees: Array<{ odAttendeeId: string; odExternalUserId: string; name?: string }>;
}

interface TranscriptionState {
  transcriptions: ChimeTranscription[];
  isEnabled: boolean;
  isStarting: boolean;
  error: string | null;
}

// ============ UTILITÁRIOS ============

/**
 * Sanitiza texto para prevenir XSS
 */
function sanitizeText(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .substring(0, CONFIG.MAX_TEXT_LENGTH);
}

/**
 * Gera ID único para transcrição
 */
function generateTranscriptionId(resultId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 11);
  return `trans_${resultId || timestamp}_${random}`;
}

/**
 * Fetch com timeout e retry
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = CONFIG.RETRY_ATTEMPTS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (retries > 0 && error.name !== 'AbortError') {
      const attemptNum = CONFIG.RETRY_ATTEMPTS - retries + 1;
      console.log(`[ChimeTranscription] Retry ${attemptNum}/${CONFIG.RETRY_ATTEMPTS}`);
      await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY_MS));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// ============ HOOK PRINCIPAL ============
export function useChimeTranscription({
  roomId,
  odUserId,
  userName,
  meetingId,
  audioVideo,
  attendees,
}: UseChimeTranscriptionProps) {
  // Estado consolidado para reduzir re-renders
  const [state, setState] = useState<TranscriptionState>({
    transcriptions: [],
    isEnabled: false,
    isStarting: false,
    error: null,
  });

  // Refs para evitar stale closures e garantir cleanup
  const isEnabledRef = useRef(false);
  const isMountedRef = useRef(true);
  const transcriptionControllerRef = useRef<any>(null);
  const attendeesRef = useRef(attendees);

  // Manter ref de attendees atualizada
  useEffect(() => {
    attendeesRef.current = attendees;
  }, [attendees]);

  // ============ HELPERS ============

  /**
   * Obtém nome do participante pelo attendeeId
   */
  const getAttendeeNameById = useCallback((attendeeId: string): string => {
    if (!attendeeId) return 'Participante';
    
    const attendee = attendeesRef.current.find(a => a.odAttendeeId === attendeeId);
    if (attendee) {
      // ExternalUserId format: "userId|userName"
      const parts = attendee.odExternalUserId?.split('|');
      const name = parts?.[1] || attendee.name;
      return name ? sanitizeText(name) : 'Participante';
    }
    return 'Participante';
  }, []);

  /**
   * Adiciona transcrição ao estado com limite de memória
   */
  const addTranscription = useCallback((transcription: ChimeTranscription) => {
    if (!isMountedRef.current) return;

    setState(prev => {
      // Remover parciais do mesmo speaker se for final
      let filtered = prev.transcriptions;
      if (!transcription.isPartial) {
        filtered = filtered.filter(t => 
          !(t.attendeeId === transcription.attendeeId && t.isPartial)
        );
      } else {
        // Se é parcial, substituir a última parcial do mesmo speaker
        filtered = filtered.filter(t => 
          !(t.attendeeId === transcription.attendeeId && t.isPartial)
        );
      }

      // Adicionar nova transcrição
      const updated = [...filtered, transcription];

      // Limitar quantidade em memória (remover mais antigas)
      if (updated.length > CONFIG.MAX_TRANSCRIPTIONS) {
        return {
          ...prev,
          transcriptions: updated.slice(-CONFIG.MAX_TRANSCRIPTIONS),
        };
      }

      return { ...prev, transcriptions: updated };
    });
  }, []);

  // ============ HANDLER DE EVENTOS ============

  /**
   * Processa eventos de transcrição do Chime SDK
   * Suporta múltiplos formatos: TranscriptEvent nativo e JSON de data messages
   */
  const handleTranscriptEvent = useCallback((transcriptEvent: TranscriptEvent | any) => {
    if (!isMountedRef.current) return;

    console.log('[ChimeTranscription] Processing transcript event:', JSON.stringify(transcriptEvent).substring(0, 500));

    // Tentar extrair resultados de diferentes formatos
    let results: any[] = [];

    // Formato 1: TranscriptEvent nativo do Chime SDK
    if (transcriptEvent.results && Array.isArray(transcriptEvent.results)) {
      results = transcriptEvent.results;
    }
    // Formato 2: Wrapper com transcript.results
    else if (transcriptEvent.transcript?.results) {
      results = transcriptEvent.transcript.results;
    }
    // Formato 3: TranscriptionStatus (apenas log)
    else if (transcriptEvent.transcriptionStatus || transcriptEvent.status) {
      console.log('[ChimeTranscription] Status event:', transcriptEvent.transcriptionStatus || transcriptEvent.status);
      return;
    }
    // Formato 4: Array direto de resultados
    else if (Array.isArray(transcriptEvent)) {
      results = transcriptEvent;
    }

    if (results.length === 0) {
      console.log('[ChimeTranscription] No results in event');
      return;
    }

    for (const result of results) {
      // Validar estrutura do resultado
      if (!result.alternatives || result.alternatives.length === 0) continue;

      const alternative = result.alternatives[0];
      const rawText = alternative.transcript;
      
      // Validar texto
      if (!rawText || typeof rawText !== 'string') continue;
      const text = rawText.trim();
      if (text.length === 0) continue;

      // Extrair informações do speaker
      const isPartial = result.isPartial === true;
      
      // Tentar obter attendeeId de diferentes locais
      const attendeeId = 
        alternative.items?.[0]?.attendee?.attendeeId ||
        alternative.items?.[0]?.speakerId ||
        result.channelId ||
        '';
      
      const speakerName = attendeeId ? getAttendeeNameById(attendeeId) : 'Participante';

      // Criar objeto de transcrição
      const transcription: ChimeTranscription = {
        transcriptionId: generateTranscriptionId(result.resultId),
        userId: attendeeId,
        transcribedText: sanitizeText(text),
        timestamp: Date.now(),
        speakerLabel: speakerName,
        isPartial,
        attendeeId,
      };

      console.log('[ChimeTranscription] Adding transcription:', transcription.transcribedText.substring(0, 50));
      addTranscription(transcription);
    }
  }, [getAttendeeNameById, addTranscription]);

  // ============ AÇÕES ============

  /**
   * Inicia transcrição via API
   */
  const startTranscription = useCallback(async (): Promise<boolean> => {
    // Validações
    if (!meetingId) {
      console.warn('[ChimeTranscription] Cannot start: no meetingId');
      return false;
    }
    if (isEnabledRef.current) {
      console.log('[ChimeTranscription] Already enabled');
      return true;
    }
    if (state.isStarting) {
      console.log('[ChimeTranscription] Already starting');
      return false;
    }

    setState(prev => ({ ...prev, isStarting: true, error: null }));

    try {
      console.log('[ChimeTranscription] Starting transcription for meeting:', meetingId);

      const response = await fetchWithRetry(`${CONFIG.API_URL}/meeting/transcription/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          roomId,
          userLogin: userName,
          languageCode: CONFIG.LANGUAGE_CODE,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log('[ChimeTranscription] Transcription started:', data);
      
      if (isMountedRef.current) {
        isEnabledRef.current = true;
        setState(prev => ({ ...prev, isEnabled: true, isStarting: false }));
      }
      return true;

    } catch (err: any) {
      console.error('[ChimeTranscription] Error starting:', err);
      
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          isStarting: false,
          error: err.message || 'Erro ao iniciar transcrição',
        }));
      }
      return false;
    }
  }, [meetingId, roomId, userName, state.isStarting]);

  /**
   * Para transcrição via API
   */
  const stopTranscription = useCallback(async (): Promise<boolean> => {
    if (!meetingId) return false;

    try {
      console.log('[ChimeTranscription] Stopping transcription for meeting:', meetingId);

      const response = await fetchWithRetry(`${CONFIG.API_URL}/meeting/transcription/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          roomId,
          userLogin: userName,
        }),
      });

      const data = await response.json();

      // Aceitar sucesso mesmo se já estava parada
      if (!response.ok && !data.alreadyStopped) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log('[ChimeTranscription] Transcription stopped:', data);
      
      if (isMountedRef.current) {
        isEnabledRef.current = false;
        setState(prev => ({ ...prev, isEnabled: false }));
      }
      return true;

    } catch (err: any) {
      console.error('[ChimeTranscription] Error stopping:', err);
      
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          error: err.message || 'Erro ao parar transcrição',
        }));
      }
      return false;
    }
  }, [meetingId, roomId, userName]);

  /**
   * Toggle transcrição
   */
  const toggleTranscription = useCallback(async (): Promise<boolean> => {
    if (isEnabledRef.current) {
      return stopTranscription();
    } else {
      return startTranscription();
    }
  }, [startTranscription, stopTranscription]);

  // ============ EFFECTS ============

  /**
   * Registrar handler de transcrição quando audioVideo estiver disponível
   * 
   * O Amazon Chime SDK envia eventos de transcrição via Data Messages
   * com o tópico "aws:chime:transcription"
   */
  useEffect(() => {
    if (!audioVideo) return;

    console.log('[ChimeTranscription] Setting up transcription event handler via data messages');

    // Handler para data messages de transcrição
    const handleDataMessage = (dataMessage: any) => {
      try {
        // Verificar se é uma mensagem de transcrição
        if (dataMessage.topic !== 'aws:chime:transcription') {
          return;
        }

        // Decodificar a mensagem
        const text = new TextDecoder().decode(dataMessage.data);
        const transcriptEvent = JSON.parse(text);
        
        console.log('[ChimeTranscription] Received transcription event:', transcriptEvent);
        handleTranscriptEvent(transcriptEvent);
      } catch (err) {
        console.warn('[ChimeTranscription] Error parsing data message:', err);
      }
    };

    // Método 1: Tentar usar transcriptionController (Chime SDK >= 3.x)
    try {
      const controller = audioVideo.transcriptionController;
      if (controller && typeof controller.subscribeToTranscriptEvent === 'function') {
        const callback = (event: TranscriptEvent) => handleTranscriptEvent(event);
        controller.subscribeToTranscriptEvent(callback);
        transcriptionControllerRef.current = { controller, callback };
        console.log('[ChimeTranscription] ✅ Subscribed via transcriptionController');
        
        return () => {
          try {
            if (transcriptionControllerRef.current) {
              const { controller: ctrl, callback: cb } = transcriptionControllerRef.current;
              ctrl?.unsubscribeFromTranscriptEvent?.(cb);
              console.log('[ChimeTranscription] Unsubscribed from transcriptionController');
            }
          } catch (err) {
            console.warn('[ChimeTranscription] Error unsubscribing:', err);
          }
          transcriptionControllerRef.current = null;
        };
      }
    } catch (err) {
      console.log('[ChimeTranscription] transcriptionController not available, trying data messages');
    }

    // Método 2: Usar realtimeSubscribeToReceiveDataMessage (fallback)
    try {
      if (typeof audioVideo.realtimeSubscribeToReceiveDataMessage === 'function') {
        audioVideo.realtimeSubscribeToReceiveDataMessage('aws:chime:transcription', handleDataMessage);
        transcriptionControllerRef.current = { topic: 'aws:chime:transcription', handler: handleDataMessage };
        console.log('[ChimeTranscription] ✅ Subscribed via realtimeSubscribeToReceiveDataMessage');
        
        return () => {
          try {
            if (transcriptionControllerRef.current?.topic) {
              audioVideo.realtimeUnsubscribeFromReceiveDataMessage?.('aws:chime:transcription');
              console.log('[ChimeTranscription] Unsubscribed from data messages');
            }
          } catch (err) {
            console.warn('[ChimeTranscription] Error unsubscribing from data messages:', err);
          }
          transcriptionControllerRef.current = null;
        };
      }
    } catch (err) {
      console.warn('[ChimeTranscription] Error subscribing to data messages:', err);
    }

    console.warn('[ChimeTranscription] ⚠️ No transcription subscription method available');
    return () => {
      transcriptionControllerRef.current = null;
    };
  }, [audioVideo, handleTranscriptEvent]);

  /**
   * Cleanup ao desmontar - parar transcrição se ativa
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Best effort para parar transcrição ao sair
      if (isEnabledRef.current && meetingId) {
        fetch(`${CONFIG.API_URL}/meeting/transcription/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId, roomId }),
        }).catch(() => {
          // Ignorar erros no cleanup
        });
      }
    };
  }, [meetingId, roomId]);

  // ============ RETORNO ============
  return {
    // Estado
    transcriptions: state.transcriptions,
    isTranscriptionEnabled: state.isEnabled,
    isStarting: state.isStarting,
    error: state.error,
    
    // Ações
    startTranscription,
    stopTranscription,
    toggleTranscription,
    
    // Compatibilidade com interface anterior
    isSpeechRecognitionSupported: true, // Sempre suportado (server-side)
  };
}
