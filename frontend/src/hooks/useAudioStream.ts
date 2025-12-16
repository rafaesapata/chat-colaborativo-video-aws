import { useRef, useState } from 'react';

export function useAudioStream(onAudioData: (data: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log('[AudioStream] Chunk capturado:', event.data.size, 'bytes');
          const base64Audio = await blobToBase64(event.data);
          console.log('[AudioStream] Enviando chunk base64, tamanho:', base64Audio.length);
          onAudioData(base64Audio);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[AudioStream] Gravação parada');
      };

      mediaRecorder.start(1000); // Capturar chunks a cada 1 segundo
      console.log('[AudioStream] Gravação iniciada');
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  return { startRecording, stopRecording, isRecording };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
