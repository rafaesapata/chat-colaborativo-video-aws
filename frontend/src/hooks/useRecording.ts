import { useState, useRef, useCallback, useEffect } from 'react';

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

  // Criar canvas para composição de vídeos
  const createCompositeCanvas = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    canvasRef.current = canvas;
    return canvas;
  }, []);

  // Desenhar todos os vídeos no canvas
  const drawVideosToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
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
      return;
    }

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
      const videoAspect = video.videoWidth / video.videoHeight;
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
      } catch (e) {
        // Vídeo pode não estar pronto
        ctx.fillStyle = '#2d2d44';
        ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
      }
      
      ctx.restore();
    });

    // Timestamp no canto
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, canvas.height - 30, 150, 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(new Date().toLocaleTimeString('pt-BR'), 15, canvas.height - 12);

    // Continuar animação
    if (state.isRecording && !state.isPaused) {
      animationFrameRef.current = requestAnimationFrame(drawVideosToCanvas);
    }
  }, [state.isRecording, state.isPaused]);

  // Iniciar gravação
  const startRecording = useCallback(async () => {
    try {
      // Criar canvas de composição
      const canvas = createCompositeCanvas();
      
      // Capturar stream do canvas
      const canvasStream = canvas.captureStream(30); // 30 FPS
      
      // Capturar áudio de todos os vídeos
      const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      
      videos.forEach(video => {
        if (video.srcObject) {
          try {
            const source = audioContext.createMediaStreamSource(video.srcObject as MediaStream);
            source.connect(destination);
          } catch (e) {
            console.warn('[Recording] Erro ao conectar áudio:', e);
          }
        }
      });

      // Combinar vídeo do canvas com áudio
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);
      
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

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Parar animação
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        // Criar blob final
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        // Upload para S3 ou salvar localmente
        if (USE_S3_STORAGE) {
          try {
            await uploadRecording(blob);
          } catch (error) {
            console.warn('[Recording] Falha no upload, salvando localmente');
            saveRecordingLocally(blob);
          }
        } else {
          // Sem API configurada, salvar localmente
          saveRecordingLocally(blob);
          saveRecordingToHistory(`local_${Date.now()}`);
        }
        
        // Limpar
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach(t => t.stop());
        audioContext.close();
      };

      mediaRecorderRef.current = mediaRecorder;
      
      // Iniciar gravação
      mediaRecorder.start(1000); // Chunk a cada 1 segundo
      
      // Iniciar desenho no canvas
      drawVideosToCanvas();
      
      // Iniciar contador de duração
      durationIntervalRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
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
      return false;
    }
  }, [createCompositeCanvas, drawVideosToCanvas]);

  // Pausar/Retomar gravação
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (state.isPaused) {
      mediaRecorderRef.current.resume();
      drawVideosToCanvas();
      durationIntervalRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
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
    if (!mediaRecorderRef.current) return;

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    mediaRecorderRef.current.stop();
    
    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
    }));

    console.log('[Recording] Gravação parada');
  }, []);

  // Upload para S3 via URL pré-assinada
  const uploadRecording = useCallback(async (blob: Blob) => {
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
          duration: state.duration,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao obter URL de upload');
      }

      const { uploadUrl, recordingKey } = await response.json();

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
      saveRecordingToHistory(recordingKey);
      
      return recordingKey;
    } catch (error) {
      console.error('[Recording] Erro no upload:', error);
      
      // Fallback: salvar localmente
      saveRecordingLocally(blob);
      throw error;
    }
  }, [userLogin, roomId, meetingId, state.duration]);

  // Salvar referência no histórico
  const saveRecordingToHistory = useCallback((recordingKey: string) => {
    const historyKey = `videochat_meeting_history_${userLogin}`;
    const stored = localStorage.getItem(historyKey);
    
    if (stored) {
      try {
        const history = JSON.parse(stored);
        const meetingIndex = history.findIndex((m: any) => m.id === meetingId);
        
        if (meetingIndex >= 0) {
          history[meetingIndex].recordingKey = recordingKey;
          history[meetingIndex].recordingDuration = state.duration;
          localStorage.setItem(historyKey, JSON.stringify(history));
        }
      } catch (e) {
        console.error('[Recording] Erro ao salvar no histórico:', e);
      }
    }
  }, [userLogin, meetingId, state.duration]);

  // Fallback: salvar localmente
  const saveRecordingLocally = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reuniao_${roomId}_${new Date().toISOString().slice(0, 10)}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [roomId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (mediaRecorderRef.current && state.isRecording) {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [state.isRecording]);

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
