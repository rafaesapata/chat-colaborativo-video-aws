import { useState } from 'react';
import { Amplify } from 'aws-amplify';
import VideoCall from './components/VideoCall';
import ChatRoom from './components/ChatRoom';
import LiveTranscription from './components/LiveTranscription';
import ParticipantsList from './components/ParticipantsList';
import AIInsightsPanel from './components/AIInsightsPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useVideoCall } from './hooks/useVideoCall';
import { useAudioStream } from './hooks/useAudioStream';

// Configurar Amplify (substituir com valores reais após deploy)
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || ''
    }
  }
});

interface Message {
  messageId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  type: string;
}

interface Transcription {
  transcriptionId: string;
  userId: string;
  transcribedText: string;
  timestamp: number;
  speakerLabel?: string;
}

function App() {
  const [roomId] = useState<string>('room_default');
  const [userId] = useState<string>('user_' + Math.random().toString(36).substr(2, 9));
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);

  const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || '';
  const { sendMessage, isConnected, onMessage } = useWebSocket(wsUrl, userId, roomId, handleWebSocketMessage);
  const { startRecording, stopRecording, isRecording } = useAudioStream(sendAudioData);
  
  const {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
  } = useVideoCall({ roomId, userId, sendMessage, onMessage });

  function handleWebSocketMessage(data: any) {
    if (data.type === 'message') {
      setMessages(prev => [...prev, data.data]);
    } else if (data.type === 'transcription') {
      setTranscriptions(prev => [...prev, data.data]);
    } else if (data.type === 'participants') {
      setParticipants(data.data);
    }
  }

  function sendAudioData(audioData: string) {
    sendMessage({
      action: 'sendAudio',
      roomId,
      userId,
      audioData,
      language: 'pt-BR'
    });
  }

  const handleSendMessage = (content: string) => {
    sendMessage({
      action: 'sendMessage',
      roomId,
      userId,
      content,
      userName: 'User ' + userId.substr(-4)
    });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 flex flex-col">
        <header className="bg-blue-600 text-white p-4">
          <h1 className="text-2xl font-bold">Chat Colaborativo por Vídeo - AWS</h1>
          <p className="text-sm">
            Status: {isConnected ? '🟢 Conectado' : '🔴 Desconectado'} | 
            Participantes: {remoteStreams.size + 1}
          </p>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Área de vídeo principal */}
          <div className="flex-1 flex flex-col">
            <VideoCall
              localStream={localStream}
              remoteStreams={remoteStreams}
              onToggleVideo={toggleVideo}
              onToggleAudio={toggleAudio}
              isVideoEnabled={isVideoEnabled}
              isAudioEnabled={isAudioEnabled}
            />
            <LiveTranscription transcriptions={transcriptions} />
          </div>

          {/* Sidebar com chat e controles */}
          <aside className="w-96 bg-white border-l flex flex-col">
            <ParticipantsList participants={[...Array.from(remoteStreams.keys()), userId]} />
            <div className="flex-1 overflow-hidden">
              <ChatRoom messages={messages} onSendMessage={handleSendMessage} />
            </div>
            <AIInsightsPanel roomId={roomId} />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default App;
