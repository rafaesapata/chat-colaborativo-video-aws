import { useState, useRef, useCallback, useEffect } from 'react';
import { meetingHistoryService } from '../services/meetingHistoryService';

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
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef(false); // Ref para controle de animação

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
    if (!userLogin || !meetingId) {
      console.warn('[Recording] userLogin ou meetingId não disponível para salvar no histórico');
      return;
    }
    
    meetingHistoryService.addRecording(userLogin, meetingId, recordingKey, duration, recordingId);
  }, [userLogin, meetingId]);

  // Fallback: salvar localmente
  const saveRecordingLocally = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reuniao_${roomId}_${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [roomId]);

  // Upload para S3 via URL pré-assinada
  const uploadRecording = useCallback(async (blob: Blob, duration: number): Promise<string> => {
    try {
      console.log('[Recording] Iniciando upload...', blob.size, 'bytes');
      
      // Gerar nome do arquivo
      const filename = `${userLogin}/${roomId}/${meetingId}_${Date.now()}.webm`;
      
      // Obter URL pré-assinada do backend
      const response = await fetch(`${RECORDING_API_URL}/recording/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          contentType: blob.type,
          userLogin,
          roomId,
          meetingId,
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

      console.log('[Recording] Upload concluído:', recordingKey);
      
      // Salvar referência no histórico local
      saveRecordingToHistory(recordingKey, duration, recordingId);
      
      return recordingKey;
    } catch (error) {
      console.error('[Recording] Erro no upload:', error);
      throw error;
    }
  }, [userLogin, roomId, meetingId, saveRecordingToHistory]);

  // Iniciar gravação
  const startRecording = useCallback(async () => {
    // Prevenir múltiplas gravações simultâneas
    if (isRecordingRef.current) {
      console.warn('[Recording] Gravação já em andamento');
      return false;
    }

    try {
      console.log('[Recording] Iniciando gravação...');
      
      // Limpar AudioContext anterior se existir
      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
        } catch (e) {
          console.warn('[Recording] Erro ao fechar AudioContext anterior:', e);
        }
        audioContextRef.current = null;
      }
      
      // Criar canvas de composição
      const canvas = createCompositeCanvas();
      
      // Capturar stream do canvas
      const canvasStream = canvas.captureStream(30); // 30 FPS
      
      // Capturar áudio de todos os vídeos E do elemento de áudio do Chime
      const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
      const audios = Array.from(document.querySelectorAll('audio')) as HTMLAudioElement[];
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      
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
        console.log('[Recording] MediaRecorder parou, processando...');
        
        // Parar animação
        isRecordingRef.current = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        // Criar blob final
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('[Recording] Blob criado:', blob.size, 'bytes');
        
        // Validar tamanho do blob
        const MAX_BLOB_SIZE = 500 * 1024 * 1024; // 500MB
        if (blob.size > MAX_BLOB_SIZE) {
          console.warn('[Recording] Gravação muito grande, salvando localmente');
          saveRecordingLocally(blob);
          saveRecordingToHistory(`local_${Date.now()}`, finalDuration);
        } else if (USE_S3_STORAGE && blob.size > 0) {
          // Upload para S3
          try {
            const recordingKey = await uploadRecording(blob, finalDuration);
            console.log('[Recording] Upload para S3 concluído:', recordingKey);
            // O uploadRecording já salva no histórico
          } catch (error) {
            console.warn('[Recording] Falha no upload, salvando localmente');
            saveRecordingLocally(blob);
            saveRecordingToHistory(`local_${Date.now()}`, finalDuration);
          }
        } else if (blob.size > 0) {
          // Sem API configurada, salvar localmente
          saveRecordingLocally(blob);
          saveRecordingToHistory(`local_${Date.now()}`, finalDuration);
        }
        
        // Limpar recursos
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (audioContextRef.current) {
          try {
            await audioContextRef.current.close();
          } catch (e) {
            console.warn('[Recording] Erro ao fechar AudioContext:', e);
          }
          audioContextRef.current = null;
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
          return { ...prev, duration: prev.duration + 1 };
        });
      }, 1000);

      const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
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
  }, [createCompositeCanvas, drawVideosToCanvas, uploadRecording, saveRecordingLocally, saveRecordingToHistory]);

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

  // Parar gravação
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
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
