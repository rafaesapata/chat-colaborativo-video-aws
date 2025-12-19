import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import VideoGrid from './VideoGrid';
import ControlBar from './ControlBar';
import ChatSidebar from './ChatSidebar';
import { useWebSocket } from '../hooks/useWebSocket';
import { useVideoCall } from '../hooks/useVideoCall';

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  hasVideo: boolean;
  stream?: MediaStream;
}

interface Message {
  id: string;
  author: string;
  text: string;
  time: string;
  isOwn?: boolean;
}

export default function MeetingRoom({ darkMode }: { darkMode: boolean }) {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const userName = searchParams.get('name') || 'Usuário';
  
  // CORREÇÃO: userId estável usando useMemo + sessionStorage
  const userId = useMemo(() => {
    const storageKey = `video-chat-userId-${roomId}`;
    const storedId = sessionStorage.getItem(storageKey);
    if (storedId) return storedId;
    
    const newId = 'user_' + Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem(storageKey, newId);
    return newId;
  }, [roomId]);
  
  const [participants, setParticipants] = useState<Participant[]>(() => [
    { id: userId, name: 'Você', isMuted: false, hasVideo: true }
  ]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const controlsTimeoutRef = useRef<number>();
  const mouseAreaRef = useRef<HTMLDivElement>(null);
  const isChatOpenRef = useRef(isChatOpen);

  // Manter ref atualizada
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // CORREÇÃO: Handler estável com useCallback
  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.type === 'message') {
      const newMessage: Message = {
        id: data.data.messageId,
        author: data.data.userName,
        text: data.data.content,
        time: new Date(data.data.timestamp).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: data.data.userId === userId
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      if (!isChatOpenRef.current && data.data.userId !== userId) {
        setUnreadCount(prev => prev + 1);
      }
    } else if (data.type === 'room_event') {
      const { eventType, userId: eventUserId, participants: newParticipants } = data.data;
      
      if (eventType === 'user_joined' && eventUserId !== userId) {
        setParticipants(prev => {
          if (prev.some(p => p.id === eventUserId)) return prev;
          return [
            ...prev,
            { 
              id: eventUserId, 
              name: `Usuário ${eventUserId.substring(eventUserId.length - 4)}`, 
              isMuted: false, 
              hasVideo: true 
            }
          ];
        });
      } else if (eventType === 'user_left') {
        setParticipants(prev => prev.filter(p => p.id !== eventUserId));
      }
    }
  }, [userId]);

  const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || '';
  const { sendMessage, isConnected, addMessageHandler } = useWebSocket(
    wsUrl, 
    userId, 
    roomId || '', 
    handleWebSocketMessage
  );
  
  const {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
    connectionErrors,
  } = useVideoCall({ 
    roomId: roomId || '', 
    userId, 
    sendMessage, 
    addMessageHandler 
  });

  // Controle de visibilidade dos controles
  useEffect(() => {
    const handleMouseMove = () => {
      setControlsVisible(true);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      controlsTimeoutRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    sendMessage({
      action: 'sendMessage',
      roomId: roomId || '',
      userId,
      content: text,
      userName
    });
  }, [sendMessage, roomId, userId, userName]);

  const handleToggleMute = useCallback(() => {
    toggleAudio();
    setIsMuted(prev => !prev);
  }, [toggleAudio]);

  const handleToggleVideo = useCallback(() => {
    toggleVideo();
    setIsVideoOff(prev => !prev);
  }, [toggleVideo]);

  const handleToggleScreenShare = useCallback(() => {
    setIsScreenSharing(prev => !prev);
  }, []);

  const handleLeaveMeeting = useCallback(() => {
    sessionStorage.removeItem(`video-chat-userId-${roomId}`);
    navigate('/');
  }, [navigate, roomId]);

  const handleToggleChat = useCallback(() => {
    setIsChatOpen(prev => {
      if (!prev) {
        setUnreadCount(0);
      }
      return !prev;
    });
  }, []);

  // Verificar se há erro de permissão
  const hasPermissionError = Array.from(connectionErrors.entries()).some(([key, error]) => 
    key === 'local' && error.includes('Permissão negada')
  );

  return (
    <div className={`h-screen w-screen overflow-hidden transition-colors duration-300 ${
      darkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Mostrar aviso de permissão se necessário */}
      {hasPermissionError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className={`px-6 py-3 rounded-lg shadow-lg border ${
            darkMode 
              ? 'bg-red-900/90 border-red-700 text-red-200' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-medium">
                Clique no ícone da câmera na barra de endereços para permitir acesso
              </span>
              <button
                onClick={() => window.location.reload()}
                className={`ml-2 px-3 py-1 text-xs rounded ${
                  darkMode 
                    ? 'bg-red-800 hover:bg-red-700 text-red-200' 
                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
              >
                Recarregar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-full p-4">
        <VideoGrid 
          participants={participants}
          localStream={localStream}
          remoteStreams={remoteStreams}
          darkMode={darkMode}
        />
      </div>

      <div
        ref={mouseAreaRef}
        className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-10"
      />

      <ControlBar
        visible={controlsVisible}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onLeaveMeeting={handleLeaveMeeting}
        onToggleChat={handleToggleChat}
        unreadCount={unreadCount}
        darkMode={darkMode}
      />

      <ChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        darkMode={darkMode}
      />
    </div>
  );
}