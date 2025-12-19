import { useState, useEffect, useRef } from 'react';
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
  const userId = 'user_' + Math.random().toString(36).substring(2, 11);
  
  const [participants, setParticipants] = useState<Participant[]>([
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

  const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || '';
  const { sendMessage, isConnected } = useWebSocket(wsUrl, userId, roomId || '', handleWebSocketMessage);
  
  const {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
  } = useVideoCall({ roomId: roomId || '', userId, sendMessage, onMessage: () => {} });

  function handleWebSocketMessage(data: any) {
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
      
      if (!isChatOpen && data.data.userId !== userId) {
        setUnreadCount(prev => prev + 1);
      }
    } else if (data.type === 'room_event') {
      const { eventType, userId: eventUserId, participants: newParticipants } = data.data;
      
      if (eventType === 'user_joined' && eventUserId !== userId) {
        setParticipants(prev => [
          ...prev,
          { 
            id: eventUserId, 
            name: `Usuário ${eventUserId.substring(eventUserId.length - 4)}`, 
            isMuted: false, 
            hasVideo: true 
          }
        ]);
      } else if (eventType === 'user_left') {
        setParticipants(prev => prev.filter(p => p.id !== eventUserId));
      }
    }
  }

  // Controle de visibilidade dos controles
  useEffect(() => {
    const handleMouseMove = () => {
      setControlsVisible(true);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    };

    const handleMouseEnterBottom = () => {
      setControlsVisible(true);
    };

    const handleMouseLeaveBottom = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 1500);
    };

    document.addEventListener('mousemove', handleMouseMove);
    
    const mouseArea = mouseAreaRef.current;
    if (mouseArea) {
      mouseArea.addEventListener('mouseenter', handleMouseEnterBottom);
      mouseArea.addEventListener('mouseleave', handleMouseLeaveBottom);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (mouseArea) {
        mouseArea.removeEventListener('mouseenter', handleMouseEnterBottom);
        mouseArea.removeEventListener('mouseleave', handleMouseLeaveBottom);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = (text: string) => {
    sendMessage({
      action: 'sendMessage',
      roomId: roomId || '',
      userId,
      content: text,
      userName
    });
  };

  const handleToggleMute = () => {
    toggleAudio();
    setIsMuted(!isAudioEnabled);
  };

  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoOff(!isVideoEnabled);
  };

  const handleToggleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
    // Implementar lógica de compartilhamento de tela
  };

  const handleLeaveMeeting = () => {
    navigate('/');
  };

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (!isChatOpen) {
      setUnreadCount(0);
    }
  };

  return (
    <div className={`h-screen w-screen overflow-hidden transition-colors duration-300 ${
      darkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Video Grid */}
      <div className="h-full p-4">
        <VideoGrid 
          participants={participants}
          localStream={localStream}
          remoteStreams={remoteStreams}
          darkMode={darkMode}
        />
      </div>

      {/* Mouse Detection Area for Controls */}
      <div
        ref={mouseAreaRef}
        className="fixed bottom-0 left-0 right-0 h-30 pointer-events-none z-10"
      />

      {/* Control Bar */}
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

      {/* Chat Sidebar */}
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