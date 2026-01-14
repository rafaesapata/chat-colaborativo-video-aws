import { useState, useRef, useCallback, useEffect } from 'react';
import { meetingHistoryService } from '../services/meetingHistoryService';
import { audioContextManager } from '../utils/audioContextManager';

interface UseRecordingProps {
  roomId: string;
  userLogin: string;
  meetingId: string;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  recordingId: string | null;
}

const RECORDING_API_URL = import.meta.env.VITE_API_URL || '';

// Flag para usar S3 ou download local
const USE_S3_STORAGE = !!RECORDING_API_URL;

// Intervalo de auto-save em ms (30 segundos)
const AUTO_SAVE_INTERVAL = 30000;

// IndexedDB para backup local temporário
const DB_NAME = 'recording_backup';
const DB_VERSION = 1;
const STORE_NAME = 'chunks';

async function openBackupDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function saveChunksToIndexedDB(recordingId: string, chunks: Blob[], duration: number): Promise<void> {
  try {
    // Converter chunks para ArrayBuffer ANTES de abrir a transação
    const chunkData = await Promise.all(chunks.map(chunk => chunk.arrayBuffer()));
    const mimeType = chunks[0]?.type || 'video/webm';
    
    // Agora abrir a transação e fazer o put de forma síncrona
    const db = await openBackupDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Put deve ser chamado sincronamente após abrir a transação
    store.put({
      id: recordingId,
      chunks: chunkData,
      duration,
      timestamp: Date.now(),
      mimeType,
    });
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    db.close();
    console.log('[Recording] Backup salvo no IndexedDB:', recordingId);
  } catch (error) {
    console.warn('[Recording] Erro ao salvar backup no IndexedDB:', error);
  }
}

async function getChunksFromIndexedDB(recordingId: string): Promise<{ chunks: Blob[], duration: number, mimeType: string } | null> {
  try {
    const db = await openBackupDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const result = await new Promise<{ chunks: ArrayBuffer[], duration: number, mimeType: string } | undefined>((resolve, reject) => {
      const request = store.get(recordingId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    
    if (!result) return null;
    
    // Converter ArrayBuffer de volta para Blob
    const chunks = result.chunks.map(buffer => new Blob([buffer], { type: result.mimeType }));
    
    return { chunks, duration: result.duration, mimeType: result.mimeType };
  } catch (error) {
    console.warn('[Recording] Erro ao recuperar backup do IndexedDB:', error);
    return null;
  }
}

async function clearBackupFromIndexedDB(recordingId: string): Promise<void> {
  try {
    const db = await openBackupDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(recordingId);
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    db.close();
    console.log('[Recording] Backup removido do IndexedDB:', recordingId);
  } catch (error) {
    console.warn('[Recording] Erro ao limpar backup do IndexedDB:', error);
  }
}

// Limpar backups antigos (mais de 24 horas)
async function cleanOldBackups(): Promise<void> {
  try {
    const db = await openBackupDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result || [];
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas
      
      records.forEach((record: { id: string; timestamp: number }) => {
        if (now - record.timestamp > maxAge) {
          store.delete(record.id);
          console.log('[Recording] Backup antigo removido:', record.id);
        }
      });
    };
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    db.close();
  } catch (error) {
    console.warn('[Recording] Erro ao limpar backups antigos:', error);
  }
}

export function useRecording({ roomId, userLogin, meetingId }: UseRecordingProps) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    recordingId: null,
  });
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const durationIntervalRef = useRef<number>();
  const autoSaveIntervalRef = useRef<number>(); // Intervalo de auto-save
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextIdRef = useRef<string | null>(null); // ID para AudioContext Manager
  const isRecordingRef = useRef(false); // Ref para controle de animação
  const currentRecordingIdRef = useRef<string | null>(null); // ID da gravação atual para backup
  const currentDurationRef = useRef(0); // Duração atual para backup
  const mimeTypeRef = useRef<string>('video/webm'); // Tipo MIME para backup
  
  // Refs para valores atuais (evitar stale closures)
  const roomIdRef = useRef(roomId);
  const userLoginRef = useRef(userLogin);
  const meetingIdRef = useRef(meetingId);
  
  // Atualizar refs quando props mudam
  useEffect(() => {
    roomIdRef.current = roomId;
    userLoginRef.current = userLogin;
    meetingIdRef.current = meetingId;
    console.log('[Recording] Props atualizadas:', { roomId, userLogin, meetingId });
  }, [roomId, userLogin, meetingId]);

  // Criar canvas para composição de vídeos
  const createCompositeCanvas = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    canvasRef.current = canvas;
    return canvas;
  }, []);

  // Desenhar todos os vídeos no canvas (usa ref ao invés de state)
  const drawVideosToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isRecordingRef.current) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fundo escuro
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Encontrar todos os vídeos na página
    const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
    const activeVideos = videos.filter(v => v.srcObject && !v.paused && v.readyState >= 2);

    if (activeVideos.length === 0) {
      // Sem vídeos, mostrar mensagem
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Aguardando vídeos...', canvas.width / 2, canvas.height / 2);
    } else {
      // Calcular layout do grid
      const cols = Math.ceil(Math.sqrt(activeVideos.length));
      const rows = Math.ceil(activeVideos.length / cols);
      const cellWidth = canvas.width / cols;
      const cellHeight = canvas.height / rows;
      const padding = 4;

      activeVideos.forEach((video, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * cellWidth + padding;
        const y = row * cellHeight + padding;
        const w = cellWidth - padding * 2;
        const h = cellHeight - padding * 2;

        // Desenhar vídeo mantendo aspect ratio
        const videoAspect = video.videoWidth / video.videoHeight || 16/9;
        const cellAspect = w / h;
        
        let drawWidth = w;
        let drawHeight = h;
        let drawX = x;
        let drawY = y;

        if (videoAspect > cellAspect) {
          drawHeight = w / videoAspect;
          drawY = y + (h - drawHeight) / 2;
        } else {
          drawWidth = h * videoAspect;
          drawX = x + (w - drawWidth) / 2;
        }

        // Borda arredondada
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, drawWidth, drawHeight, 8);
        ctx.clip();
        
        try {
          ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
        } catch {
          // Vídeo pode não estar pronto
          ctx.fillStyle = '#2d2d44';
          ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
        }
        
        ctx.restore();
      });
    }

    // Timestamp no canto
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, canvas.height - 30, 150, 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(new Date().toLocaleTimeString('pt-BR'), 15, canvas.height - 12);

    // Continuar animação se ainda estiver gravando
    if (isRecordingRef.current) {
      animationFrameRef.current = requestAnimationFrame(drawVideosToCanvas);
    }
  }, []);

  // Salvar referência no histórico usando o service
  const saveRecordingToHistory = useCallback((recordingKey: string, duration: number, recordingId?: string) => {
    const currentUserLogin = userLoginRef.current;
    const currentMeetingId = meetingIdRef.current;
    
    console.log('[Recording] saveRecordingToHistory chamado:', {
      userLogin: currentUserLogin,
      meetingId: currentMeetingId,
      recordingKey,
      duration,
      recordingId
    });
    
    if (!currentUserLogin || !currentMeetingId) {
      console.warn('[Recording] userLogin ou meetingId não disponível para salvar no histórico', {
        userLogin: currentUserLogin,
        meetingId: currentMeetingId
      });
      return;
    }
    
    meetingHistoryService.addRecording(currentUserLogin, currentMeetingId, recordingKey, duration, recordingId);
  }, []); // Sem dependências - usa refs

  // Upload para S3 via URL pré-assinada
  const uploadRecording = useCallback(async (blob: Blob, duration: number): Promise<string> => {
    const currentUserLogin = userLoginRef.current;
    const currentRoomId = roomIdRef.current;
    const currentMeetingId = meetingIdRef.current;
    
    try {
      console.log('[Recording] Iniciando upload...', {
        blobSize: blob.size,
        userLogin: currentUserLogin,
        roomId: currentRoomId,
        meetingId: currentMeetingId
      });
      
      // Validar tipo MIME (segurança)
      const allowedTypes = ['video/webm', 'video/mp4', 'video/ogg', 'audio/webm'];
      const contentType = allowedTypes.includes(blob.type) ? blob.type : 'video/webm';
      
      // Sanitizar componentes do filename (prevenir path traversal)
      const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 64);
      const safeUserLogin = sanitize(currentUserLogin);
      const safeRoomId = sanitize(currentRoomId);
      const safeMeetingId = sanitize(currentMeetingId);
      
      // Gerar nome do arquivo
      const filename = `${safeUserLogin}/${safeRoomId}/${safeMeetingId}_${Date.now()}.webm`;
      
      // Obter URL pré-assinada do backend
      const response = await fetch(`${RECORDING_API_URL}/recording/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          contentType,
          userLogin: safeUserLogin,
          roomId: safeRoomId,
          meetingId: safeMeetingId,
          duration,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao obter URL de upload');
      }

      const { uploadUrl, recordingKey, recordingId } = await response.json();

      // Upload direto para S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': blob.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Falha no upload para S3');
      }

      console.log('[Recording] Upload para S3 concluído, confirmando...');
      
      // IMPORTANTE: Confirmar upload no backend para atualizar status para "completed"
      try {
        const confirmResponse = await fetch(`${RECORDING_API_URL}/recording/confirm-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordingId,
            userLogin: safeUserLogin,
            fileSize: blob.size,
            duration,
          }),
        });
        
        if (confirmResponse.ok) {
          console.log('[Recording] Upload confirmado com sucesso');
        } else {
          console.warn('[Recording] Falha ao confirmar upload, mas arquivo foi enviado');
        }
      } catch (confirmError) {
        console.warn('[Recording] Erro ao confirmar upload:', confirmError);
        // Não falhar o upload por causa disso - o job de correção vai resolver
      }
      
      // Salvar referência no histórico local
      saveRecordingToHistory(recordingKey, duration, recordingId);
      
      return recordingKey;
    } catch (error) {
      console.error('[Recording] Erro no upload:', error);
      throw error;
    }
  }, [saveRecordingToHistory]); // Removidas dependências de props - usa refs

  // Auto-save: salva chunks no IndexedDB periodicamente
  const performAutoSave = useCallback(async () => {
    if (!isRecordingRef.current || chunksRef.current.length === 0 || !currentRecordingIdRef.current) {
      return;
    }
    
    console.log('[Recording] Executando auto-save...');
    await saveChunksToIndexedDB(
      currentRecordingIdRef.current,
      [...chunksRef.current], // Cópia dos chunks
      currentDurationRef.current
    );
  }, []);

  // Handler para beforeunload - tenta salvar quando navegador está fechando
  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (!isRecordingRef.current || chunksRef.current.length === 0) {
      return;
    }
    
    console.log('[Recording] Navegador fechando, salvando backup...');
    
    // Salvar no IndexedDB de forma síncrona (melhor esforço)
    if (currentRecordingIdRef.current) {
      // Usar sendBeacon para tentar upload rápido se possível
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      
      // Salvar no IndexedDB (assíncrono, mas iniciamos antes de sair)
      saveChunksToIndexedDB(
        currentRecordingIdRef.current,
        [...chunksRef.current],
        currentDurationRef.current
      );
      
      // Tentar upload via sendBeacon (limitado a ~64KB, então só funciona para gravações curtas)
      if (USE_S3_STORAGE && blob.size < 64000) {
        const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 64);
        navigator.sendBeacon(
          `${RECORDING_API_URL}/recording/emergency-save`,
          JSON.stringify({
            recordingId: currentRecordingIdRef.current,
            userLogin: sanitize(userLoginRef.current),
            roomId: sanitize(roomIdRef.current),
            meetingId: sanitize(meetingIdRef.current),
            duration: currentDurationRef.current,
          })
        );
      }
    }
    
    // Mostrar aviso ao usuário
    event.preventDefault();
    event.returnValue = 'Você tem uma gravação em andamento. Tem certeza que deseja sair?';
    return event.returnValue;
  }, []); // Sem dependências - usa refs

  // Registrar/desregistrar beforeunload listener
  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Limpar backups antigos ao iniciar
    cleanOldBackups();
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  // Recuperar gravação do backup (chamado externamente se necessário)
  const recoverRecording = useCallback(async (recordingId: string): Promise<boolean> => {
    try {
      const backup = await getChunksFromIndexedDB(recordingId);
      if (!backup || backup.chunks.length === 0) {
        console.log('[Recording] Nenhum backup encontrado para:', recordingId);
        return false;
      }
      
      console.log('[Recording] Recuperando gravação do backup:', recordingId);
      
      const blob = new Blob(backup.chunks, { type: backup.mimeType });
      
      if (USE_S3_STORAGE && blob.size > 0) {
        try {
          await uploadRecording(blob, backup.duration);
          await clearBackupFromIndexedDB(recordingId);
          console.log('[Recording] Gravação recuperada e enviada para S3');
          return true;
        } catch (error) {
          console.error('[Recording] Erro ao enviar gravação recuperada:', error);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[Recording] Erro ao recuperar gravação:', error);
      return false;
    }
  }, [uploadRecording]);

  // Iniciar gravação
  const startRecording = useCallback(async () => {
    // Prevenir múltiplas gravações simultâneas
    if (isRecordingRef.current) {
      console.warn('[Recording] Gravação já em andamento');
      return false;
    }

    try {
      const currentRoomId = roomIdRef.current;
      const currentUserLogin = userLoginRef.current;
      const currentMeetingId = meetingIdRef.current;
      
      console.log('[Recording] Iniciando gravação...', {
        roomId: currentRoomId,
        userLogin: currentUserLogin,
        meetingId: currentMeetingId,
        RECORDING_API_URL,
        USE_S3_STORAGE
      });
      
      // Liberar AudioContext anterior se existir
      if (audioContextIdRef.current) {
        audioContextManager.release(audioContextIdRef.current);
        audioContextIdRef.current = null;
      }
      
      // Criar canvas de composição
      const canvas = createCompositeCanvas();
      
      // Capturar stream do canvas
      const canvasStream = canvas.captureStream(30); // 30 FPS
      
      // Usar AudioContext Manager (singleton) para evitar limite de 6 contextos
      const contextId = `recording_${Date.now()}`;
      audioContextIdRef.current = contextId;
      const audioContext = audioContextManager.acquire(contextId);
      const destination = audioContext.createMediaStreamDestination();
      
      // Capturar áudio de todos os vídeos E do elemento de áudio do Chime
      const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
      const audios = Array.from(document.querySelectorAll('audio')) as HTMLAudioElement[];
      
      let hasAudio = false;
      
      // Capturar áudio dos vídeos
      videos.forEach(video => {
        if (video.srcObject) {
          try {
            const stream = video.srcObject as MediaStream;
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
              const source = audioContext.createMediaStreamSource(stream);
              source.connect(destination);
              hasAudio = true;
            }
          } catch (e) {
            console.warn('[Recording] Erro ao conectar áudio de vídeo:', e);
          }
        }
      });

      // Capturar áudio dos elementos <audio> (Chime SDK usa isso)
      audios.forEach(audio => {
        if (audio.srcObject) {
          try {
            const stream = audio.srcObject as MediaStream;
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
              const source = audioContext.createMediaStreamSource(stream);
              source.connect(destination);
              hasAudio = true;
              console.log('[Recording] Áudio do Chime conectado');
            }
          } catch (e) {
            console.warn('[Recording] Erro ao conectar áudio do Chime:', e);
          }
        }
      });

      // Se não encontrou áudio nos elementos, tentar capturar do microfone
      if (!hasAudio) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const source = audioContext.createMediaStreamSource(micStream);
          source.connect(destination);
          hasAudio = true;
          console.log('[Recording] Usando microfone como fallback');
        } catch (e) {
          console.warn('[Recording] Não foi possível capturar áudio:', e);
        }
      }

      // Combinar vídeo do canvas com áudio
      const tracks = [...canvasStream.getVideoTracks()];
      if (hasAudio) {
        tracks.push(...destination.stream.getAudioTracks());
      }
      const combinedStream = new MediaStream(tracks);
      
      streamRef.current = combinedStream;

      // Configurar MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      chunksRef.current = [];
      let finalDuration = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const currentUserLogin = userLoginRef.current;
        const currentMeetingId = meetingIdRef.current;
        
        console.log('[Recording] MediaRecorder parou, processando...', {
          chunksLength: chunksRef.current.length,
          currentRecordingId: currentRecordingIdRef.current,
          userLogin: currentUserLogin,
          meetingId: currentMeetingId,
          USE_S3_STORAGE
        });
        
        // Parar animação
        isRecordingRef.current = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        // Parar auto-save
        if (autoSaveIntervalRef.current) {
          clearInterval(autoSaveIntervalRef.current);
          autoSaveIntervalRef.current = undefined;
        }
        
        // SEMPRE fazer upload quando a gravação parar (não importa como parou)
        // Isso garante que a gravação seja salva mesmo se o usuário fechar o navegador
        
        // Criar blob final
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('[Recording] Blob criado:', blob.size, 'bytes');
        
        // Validar tamanho do blob
        const MAX_BLOB_SIZE = 500 * 1024 * 1024; // 500MB
        if (blob.size === 0) {
          console.log('[Recording] Gravação vazia, ignorando');
        } else if (blob.size > MAX_BLOB_SIZE) {
          console.warn('[Recording] Gravação muito grande, salvando backup no IndexedDB');
          // Salvar backup no IndexedDB para recuperação posterior
          if (currentRecordingIdRef.current) {
            await saveChunksToIndexedDB(
              currentRecordingIdRef.current,
              [...chunksRef.current],
              currentDurationRef.current
            );
          }
          saveRecordingToHistory(`discarded_too_large_${Date.now()}`, finalDuration);
        } else if (USE_S3_STORAGE) {
          // Upload para S3
          console.log('[Recording] Iniciando upload para S3...', {
            blobSize: blob.size,
            finalDuration,
            userLogin: currentUserLogin,
            roomId: roomIdRef.current,
            meetingId: currentMeetingId,
            RECORDING_API_URL
          });
          try {
            const recordingKey = await uploadRecording(blob, finalDuration);
            console.log('[Recording] Upload para S3 concluído:', recordingKey);
            // O uploadRecording já salva no histórico
            
            // Limpar backup do IndexedDB após upload bem-sucedido
            if (currentRecordingIdRef.current) {
              await clearBackupFromIndexedDB(currentRecordingIdRef.current);
            }
          } catch (error) {
            console.warn('[Recording] Falha no upload, salvando backup no IndexedDB');
            // Salvar backup no IndexedDB para recuperação posterior
            if (currentRecordingIdRef.current) {
              await saveChunksToIndexedDB(
                currentRecordingIdRef.current,
                [...chunksRef.current],
                currentDurationRef.current
              );
            }
            saveRecordingToHistory(`upload_failed_${Date.now()}`, finalDuration);
          }
        } else {
          // Sem API configurada - salvar backup no IndexedDB
          console.log('[Recording] API não configurada, salvando backup no IndexedDB');
          if (currentRecordingIdRef.current) {
            await saveChunksToIndexedDB(
              currentRecordingIdRef.current,
              [...chunksRef.current],
              currentDurationRef.current
            );
          }
          saveRecordingToHistory(`no_api_${Date.now()}`, finalDuration);
        }
        
        // Limpar recursos
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach(t => t.stop());
        // Liberar AudioContext via Manager (não fechar diretamente)
        if (audioContextIdRef.current) {
          audioContextManager.release(audioContextIdRef.current);
          audioContextIdRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      
      // IMPORTANTE: Atualizar ref ANTES de iniciar animação
      isRecordingRef.current = true;
      
      // Iniciar gravação
      mediaRecorder.start(1000); // Chunk a cada 1 segundo
      console.log('[Recording] MediaRecorder iniciado');
      
      // Iniciar desenho no canvas
      drawVideosToCanvas();
      
      // Iniciar contador de duração
      durationIntervalRef.current = window.setInterval(() => {
        setState(prev => {
          finalDuration = prev.duration + 1;
          currentDurationRef.current = prev.duration + 1; // Atualizar ref para backup
          return { ...prev, duration: prev.duration + 1 };
        });
      }, 1000);

      const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      currentRecordingIdRef.current = recordingId; // Salvar para backup
      mimeTypeRef.current = mimeType; // Salvar tipo MIME para backup
      
      // Iniciar auto-save periódico
      autoSaveIntervalRef.current = window.setInterval(() => {
        performAutoSave();
      }, AUTO_SAVE_INTERVAL);
      
      // Atualizar estado
      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        recordingId,
      });

      console.log('[Recording] Gravação iniciada:', recordingId);
      return true;
    } catch (error) {
      console.error('[Recording] Erro ao iniciar gravação:', error);
      isRecordingRef.current = false;
      return false;
    }
  }, [createCompositeCanvas, drawVideosToCanvas, uploadRecording, saveRecordingToHistory]);

  // Pausar/Retomar gravação
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (state.isPaused) {
      mediaRecorderRef.current.resume();
      isRecordingRef.current = true;
      drawVideosToCanvas();
      durationIntervalRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      isRecordingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }

    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, [state.isPaused, drawVideosToCanvas]);

  // Parar gravação (salva a gravação)
  const stopRecording = useCallback(() => {
    console.log('[Recording] Parando gravação...');
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = undefined;
    }

    isRecordingRef.current = false;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
    }));

    console.log('[Recording] Gravação parada');
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      // Liberar AudioContext via Manager
      if (audioContextIdRef.current) {
        audioContextManager.release(audioContextIdRef.current);
        audioContextIdRef.current = null;
      }
    };
  }, []);

  return {
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    duration: state.duration,
    recordingId: state.recordingId,
    startRecording,
    stopRecording,
    togglePause,
    recoverRecording, // Função para recuperar gravação do backup
  };
}

// Função para obter URL de playback
export async function getRecordingPlaybackUrl(
  recordingKey: string,
  userLogin: string
): Promise<string | null> {
  try {
    const response = await fetch(`${RECORDING_API_URL}/recording/playback-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingKey, userLogin }),
    });

    if (!response.ok) {
      throw new Error('Falha ao obter URL de playback');
    }

    const { playbackUrl } = await response.json();
    return playbackUrl;
  } catch (error) {
    console.error('[Recording] Erro ao obter URL de playback:', error);
    return null;
  }
}
