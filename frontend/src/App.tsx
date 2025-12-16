import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import VideoCall from './components/VideoCall';
import ChatRoom from './components/ChatRoom';
import LiveTranscription from './components/LiveTranscription';
import ParticipantsList from './components/ParticipantsList';
import AIInsightsPanel from './components/AIInsightsPanel';
import Toast from './components/Toast';
import { useWebSocket } from './hooks/useWebSocket';
import { useVideoCall } from './hooks/useVideoCall';
import { useAudioStream } from './hooks/useAudioStream';
import { useToast } from './hooks/useToast';

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

import Sidebar from './components/Sidebar';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';

function RoomPage() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [roomId] = useState<string>(urlRoomId || '');
  const [userId] = useState<string>('user_' + Math.random().toString(36).substr(2, 9));
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toasts, dismissToast, success, error, warning, info } = useToast();

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
    speakingUsers,
    connectionErrors,
    videoQuality,
  } = useVideoCall({ roomId, userId, sendMessage, onMessage });

  function handleWebSocketMessage(data: any) {
    console.log('[WebSocket] Mensagem recebida:', data);
    
    if (data.type === 'message') {
      console.log('[WebSocket] Nova mensagem:', data.data);
      setMessages(prev => [...prev, data.data]);
    } else if (data.type === 'transcription') {
      console.log('[WebSocket] Nova transcrição:', data.data);
      setTranscriptions(prev => [...prev, data.data]);
    } else if (data.type === 'participants') {
      console.log('[WebSocket] Participantes atualizados:', data.data);
      setParticipants(data.data);
    }
  }

  function sendAudioData(audioData: string) {
    console.log('[Audio] Enviando dados de áudio:', { roomId, userId, dataLength: audioData.length });
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

  // Monitorar erros de conexão e mostrar toasts
  useEffect(() => {
    connectionErrors.forEach((errorMsg, userId) => {
      error(`Erro com usuário ${userId.substr(-4)}: ${errorMsg}`);
    });
  }, [connectionErrors]);

  // Notificar quando usuários entram/saem
  useEffect(() => {
    const currentCount = remoteStreams.size;
    if (currentCount > 0) {
      info(`${currentCount} participante(s) na sala`);
    }
  }, [remoteStreams.size]);

  // Notificar quando conectar/desconectar
  useEffect(() => {
    if (isConnected) {
      success('Conectado ao servidor!');
    } else {
      warning('Desconectado do servidor. Tentando reconectar...');
    }
  }, [isConnected]);

  const copyRoomLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    success('Link da sala copiado!');
  };

  const handleToggleTranscription = () => {
    setTranscriptionEnabled(!transcriptionEnabled);
    if (!transcriptionEnabled) {
      startRecording();
      info('Transcrição ativada');
    } else {
      stopRecording();
      info('Transcrição desativada');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      
      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        roomId={roomId}
        participants={[...Array.from(remoteStreams.keys()), userId]}
        currentUserId={userId}
        onlineCount={remoteStreams.size + 1}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <ChatHeader
          roomId={roomId}
          onlineCount={remoteStreams.size + 1}
          isConnected={isConnected}
          onCopyLink={copyRoomLink}
          transcriptionEnabled={transcriptionEnabled}
          onToggleTranscription={handleToggleTranscription}
        />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            <MessageList
              messages={messages}
              currentUserId={userId}
              speakingUsers={speakingUsers}
            />
            <MessageInput
              onSendMessage={handleSendMessage}
              disabled={!isConnected}
            />
          </div>

          {/* Video Panel */}
          <div className="w-96 flex flex-col border-l border-gray-200 bg-white">
            <div className="flex-1 overflow-hidden">
              <VideoCall
                localStream={localStream}
                remoteStreams={remoteStreams}
                onToggleVideo={toggleVideo}
                onToggleAudio={toggleAudio}
                isVideoEnabled={isVideoEnabled}
                isAudioEnabled={isAudioEnabled}
                speakingUsers={speakingUsers}
                connectionErrors={connectionErrors}
                videoQuality={videoQuality}
              />
            </div>
            <div className="border-t border-gray-200">
              <LiveTranscription 
                transcriptions={transcriptions} 
                speakingUsers={speakingUsers}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');

  const createRoom = () => {
    const newRoomId = 'room_' + Math.random().toString(36).substr(2, 9);
    navigate(`/room/${newRoomId}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const roomIdInput = (e.target as HTMLFormElement).roomId.value;
    if (roomIdInput) {
      navigate(`/room/${roomIdInput}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Chat Colaborativo por Vídeo
          </h1>
          <p className="text-gray-600">
            Crie uma sala ou entre em uma existente
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={createRoom}
            className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition font-semibold text-lg flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Criar Nova Sala
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">ou</span>
            </div>
          </div>

          <form onSubmit={joinRoom} className="space-y-3">
            <input
              type="text"
              name="roomId"
              placeholder="Digite o ID da sala"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition font-semibold flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Entrar na Sala
            </button>
          </form>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Compartilhe o link da sala com outros participantes</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
