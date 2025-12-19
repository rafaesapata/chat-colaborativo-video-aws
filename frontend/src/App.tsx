import { useState } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import Lobby from './components/Lobby';
import MeetingRoom from './components/MeetingRoom';
import Toast from './components/Toast';
import Sidebar from './components/Sidebar';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import VideoCall from './components/VideoCall';
import LiveTranscription from './components/LiveTranscription';
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

// Página antiga (compatível com backend atual)
function RoomPageOld() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const [roomId] = useState<string>(urlRoomId || '');
  const [userId] = useState<string>('user_' + Math.random().toString(36).substring(2, 11));
  const [messages, setMessages] = useState<any[]>([]);
  const [transcriptions, setTranscriptions] = useState<any[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toasts, dismissToast, success, info } = useToast();

  const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || '';
  const { sendMessage, isConnected, onMessage } = useWebSocket(wsUrl, userId, roomId, handleWebSocketMessage);
  const { startRecording, stopRecording } = useAudioStream(sendAudioData);
  
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
      setMessages(prev => [...prev, data.data]);
    } else if (data.type === 'transcription') {
      setTranscriptions(prev => [...prev, data.data]);
    } else if (data.type === 'participants') {
      setParticipants(data.data);
    } else if (data.type === 'room_event') {
      const { eventType, userId: eventUserId, participants: newParticipants } = data.data;
      setParticipants(newParticipants);
      
      if (eventType === 'user_joined' && eventUserId !== userId) {
        info(`Usuário ${eventUserId.substring(eventUserId.length - 4)} entrou na sala`);
      } else if (eventType === 'user_left' && eventUserId !== userId) {
        info(`Usuário ${eventUserId.substring(eventUserId.length - 4)} saiu da sala`);
      }
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
      userName: 'User ' + userId.substring(userId.length - 4)
    });
  };

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
      
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        roomId={roomId}
        participants={participants}
        currentUserId={userId}
        onlineCount={participants.length}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatHeader
          roomId={roomId}
          onlineCount={participants.length}
          isConnected={isConnected}
          onCopyLink={copyRoomLink}
          transcriptionEnabled={transcriptionEnabled}
          onToggleTranscription={handleToggleTranscription}
        />

        <div className="flex-1 flex overflow-hidden">
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

          <div className="w-96 flex flex-col border-l border-gray-200 bg-white">
            <div className="h-80 overflow-hidden border-b border-gray-200">
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
            <div className="flex-1 overflow-auto bg-slate-50">
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
  const [darkMode, setDarkMode] = useState(false);

  const handleJoinMeeting = (name: string, roomId: string) => {
    // Usar a interface antiga que funciona 100% com WebSocket
    navigate(`/room/${roomId}`);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <Lobby 
      onJoinMeeting={handleJoinMeeting}
      darkMode={darkMode}
      toggleDarkMode={toggleDarkMode}
    />
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const { toasts, dismissToast } = useToast();

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<RoomPageOld />} />
          <Route 
            path="/old" 
            element={
              <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Interface Antiga</h1>
                    <p className="text-gray-600">Para testes de compatibilidade</p>
                  </div>
                  <button
                    onClick={() => window.location.href = '/room/room_' + Math.random().toString(36).substring(2, 11)}
                    className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition font-semibold text-lg"
                  >
                    Criar Sala (Interface Antiga)
                  </button>
                </div>
              </div>
            } 
          />
          <Route 
            path="/meeting/:roomId" 
            element={<MeetingRoom darkMode={darkMode} />} 
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
