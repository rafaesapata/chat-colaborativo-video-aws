import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Info, X, ShieldCheck, User, Wifi, WifiOff } from 'lucide-react';
import VideoGrid from './VideoGrid';
import ControlBar from './ControlBar';
import ChatSidebar from './ChatSidebar';
import TranscriptionPanel from './TranscriptionPanel';
import MeetingSetupModal from './MeetingSetupModal';
import InterviewSuggestions from './InterviewSuggestions';
import EndMeetingModal from './EndMeetingModal';
import InterviewReportModal from './InterviewReportModal';
import { useWebSocket } from '../hooks/useWebSocket';
import { useVideoCall } from '../hooks/useVideoCall';
import { useTranscription } from '../hooks/useTranscription';
import { useInterviewAssistant } from '../hooks/useInterviewAssistant';
import { useMobile } from '../hooks/useMobile';
import { useAuth } from '../contexts/AuthContext';
import { useRecording } from '../hooks/useRecording';
import { meetingHistoryService } from '../services/meetingHistoryService';
import { interviewAIService, InterviewReport } from '../services/interviewAIService';
import RecordingControl from './RecordingControl';

// Versão do aplicativo - atualizar a cada deploy
const APP_VERSION = '2.16.6';
const BUILD_DATE = '2025-12-20 18:30';

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
  const navigate = useNavigate();
  const { isMobile, isTouch } = useMobile();
  const { isAuthenticated, user, isGuest } = useAuth();
  
  // Ler nome de sessionStorage ao invés de URL
  const userName = sessionStorage.getItem('videochat_user_name') || 'Usuário';
  
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
  const [isTranscriptionOpen, setIsTranscriptionOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showVersionInfo, setShowVersionInfo] = useState(false);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  // Carregar configuração da reunião do localStorage (persistência)
  const [showMeetingSetup, setShowMeetingSetup] = useState(false);
  const [meetingType, setMeetingType] = useState(() => {
    const saved = localStorage.getItem(`meeting_config_${roomId}`);
    if (saved) {
      try {
        return JSON.parse(saved).type || 'REUNIAO';
      } catch { return 'REUNIAO'; }
    }
    return 'REUNIAO';
  });
  const [meetingTopic, setMeetingTopic] = useState(() => {
    const saved = localStorage.getItem(`meeting_config_${roomId}`);
    if (saved) {
      try {
        return JSON.parse(saved).topic || '';
      } catch { return ''; }
    }
    return '';
  });
  const [hasSetupCompleted, setHasSetupCompleted] = useState(() => {
    return !!localStorage.getItem(`meeting_config_${roomId}`);
  });
  const [showEndModal, setShowEndModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [interviewReport, setInterviewReport] = useState<InterviewReport | null>(null);
  
  const controlsTimeoutRef = useRef<number>();
  const mouseAreaRef = useRef<HTMLDivElement>(null);
  const isChatOpenRef = useRef(isChatOpen);

  // Manter ref atualizada
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // CORREÇÃO: Handler estável com useCallback
  const handleWebSocketMessage = useCallback((data: any) => {
    console.log('[MeetingRoom] 📨 Mensagem recebida:', data.type, data);
    
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
      const { eventType, userId: eventUserId, participants: roomParticipants, existingParticipants } = data.data;
      
      console.log('[MeetingRoom] 🏠 Room event:', eventType, { eventUserId, roomParticipants, existingParticipants });
      
      // ✅ NOVO: Resposta à solicitação de participantes (após câmera estar pronta)
      if (eventType === 'participants_list' && existingParticipants && existingParticipants.length > 0) {
        console.log('[MeetingRoom] 📋 Lista de participantes recebida:', existingParticipants);
        
        setParticipants(prev => {
          const newParticipants = [...prev];
          
          existingParticipants.forEach((participantId: string) => {
            if (participantId !== userId && !newParticipants.some(p => p.id === participantId)) {
              console.log('[MeetingRoom] ➕ Adicionando participante:', participantId);
              newParticipants.push({
                id: participantId,
                name: `Usuário ${participantId.substring(participantId.length - 4)}`,
                isMuted: false,
                hasVideo: true
              });
            }
          });
          
          console.log('[MeetingRoom] 📋 Total de participantes:', newParticipants.length);
          return newParticipants;
        });
      }
      else if (eventType === 'user_joined') {
        // ✅ NOVO: Se EU sou o novo usuário e há participantes existentes, adicionar todos
        if (eventUserId === userId && existingParticipants && existingParticipants.length > 0) {
          console.log('[MeetingRoom] 👥 EU entrei! Participantes existentes:', existingParticipants);
          
          setParticipants(prev => {
            const newParticipants = [...prev];
            
            existingParticipants.forEach((participantId: string) => {
              if (participantId !== userId && !newParticipants.some(p => p.id === participantId)) {
                console.log('[MeetingRoom] ➕ Adicionando participante existente:', participantId);
                newParticipants.push({
                  id: participantId,
                  name: `Usuário ${participantId.substring(participantId.length - 4)}`,
                  isMuted: false,
                  hasVideo: true
                });
              }
            });
            
            console.log('[MeetingRoom] 📋 Lista atualizada de participantes:', newParticipants.length);
            return newParticipants;
          });
        } 
        // Se OUTRO usuário entrou
        else if (eventUserId !== userId) {
          console.log('[MeetingRoom] ➕ Novo usuário entrou:', eventUserId);
          const eventUserName = data.data.userName;
          
          setParticipants(prev => {
            if (prev.some(p => p.id === eventUserId)) {
              console.log('[MeetingRoom] ⏭️ Usuário já existe na lista');
              return prev;
            }
            return [
              ...prev,
              { 
                id: eventUserId, 
                name: eventUserName || `Usuário ${eventUserId.substring(eventUserId.length - 4)}`, 
                isMuted: false, 
                hasVideo: true
              }
            ];
          });
        }
      } else if (eventType === 'existing_participants' && roomParticipants) {
        // Manter compatibilidade com o evento antigo
        console.log('[MeetingRoom] 👥 Participantes existentes (evento legado):', roomParticipants);
        
        setParticipants(prev => {
          const newParticipants = [...prev];
          
          roomParticipants.forEach((participantId: string) => {
            if (participantId !== userId && !newParticipants.some(p => p.id === participantId)) {
              console.log('[MeetingRoom] ➕ Adicionando participante existente:', participantId);
              newParticipants.push({
                id: participantId,
                name: `Usuário ${participantId.substring(participantId.length - 4)}`,
                isMuted: false,
                hasVideo: true
              });
            }
          });
          
          console.log('[MeetingRoom] 📋 Lista atualizada de participantes:', newParticipants.length);
          return newParticipants;
        });
      } else if (eventType === 'user_left') {
        console.log('[MeetingRoom] ➖ Usuário saiu:', eventUserId);
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
    isScreenSharing: screenShareActive,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    connectionErrors,
    speakingUsers,
    overallQuality,
    participantNames,
  } = useVideoCall({ 
    roomId: roomId || '', 
    userId,
    userName,
    sendMessage, 
    addMessageHandler 
  });

  const {
    transcriptions,
    isTranscriptionEnabled,
    isRecording,
    toggleTranscription,
    isSpeechRecognitionSupported
  } = useTranscription({
    roomId: roomId || '',
    userId,
    userName,
    sendMessage,
    addMessageHandler,
    localStream
  });

  // Hook do assistente de entrevista
  const {
    suggestions: interviewSuggestions,
    unreadSuggestions,
    isGenerating: isGeneratingSuggestions,
    markAsRead: markSuggestionAsRead,
    dismissSuggestion,
  } = useInterviewAssistant({
    isEnabled: isAuthenticated && meetingType === 'ENTREVISTA' && hasSetupCompleted,
    meetingType,
    topic: meetingTopic,
    transcriptions,
  });

  // Hook de gravação - só para usuários autenticados
  const {
    isRecording: isRecordingMeeting,
    isPaused: isRecordingPaused,
    duration: recordingDuration,
    startRecording,
    stopRecording,
    togglePause: toggleRecordingPause,
  } = useRecording({
    roomId: roomId || '',
    userLogin: user?.login || '',
    meetingId: currentMeetingId || '',
  });

  // Mostrar modal de configuração para usuários autenticados
  useEffect(() => {
    if (isAuthenticated && !hasSetupCompleted && localStream) {
      // Aguardar um pouco para o usuário se situar
      const timer = setTimeout(() => {
        setShowMeetingSetup(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasSetupCompleted, localStream]);

  // Handler para configuração da reunião
  const handleMeetingSetup = useCallback((type: string, topic: string) => {
    setMeetingType(type);
    setMeetingTopic(topic);
    setHasSetupCompleted(true);
    setShowMeetingSetup(false);
    
    // Persistir configuração no localStorage
    localStorage.setItem(`meeting_config_${roomId}`, JSON.stringify({
      type,
      topic,
      createdAt: Date.now()
    }));
  }, [roomId]);

  // Criar registro de reunião para usuários autenticados
  useEffect(() => {
    if (isAuthenticated && user?.login && roomId && !currentMeetingId) {
      const meeting = meetingHistoryService.createMeeting(user.login, roomId, [userName]);
      setCurrentMeetingId(meeting.id);
      
      // Ativar transcrição automaticamente para usuários autenticados
      if (isSpeechRecognitionSupported && localStream && !isTranscriptionEnabled) {
        setTimeout(() => {
          toggleTranscription();
        }, 2000); // Aguardar stream estar pronto
      }
    }
  }, [isAuthenticated, user?.login, roomId, localStream, isSpeechRecognitionSupported]);

  // Salvar transcrições no histórico
  useEffect(() => {
    if (isAuthenticated && user?.login && currentMeetingId && transcriptions.length > 0) {
      const lastTranscription = transcriptions[transcriptions.length - 1];
      if (!lastTranscription.isPartial) {
        meetingHistoryService.addTranscription(user.login, currentMeetingId, {
          id: lastTranscription.transcriptionId,
          text: lastTranscription.transcribedText,
          speaker: lastTranscription.speakerLabel || 'Desconhecido',
          timestamp: lastTranscription.timestamp
        });
      }
    }
  }, [transcriptions, isAuthenticated, user?.login, currentMeetingId]);

  // Sincronizar streams remotos com participantes
  useEffect(() => {
    setParticipants(prev => 
      prev.map(participant => ({
        ...participant,
        stream: participant.id === userId ? localStream || undefined : remoteStreams.get(participant.id)
      }))
    );
  }, [remoteStreams, localStream, userId]);

  // Sincronizar estado de vídeo/áudio com useVideoCall
  useEffect(() => {
    setIsVideoOff(!isVideoEnabled);
  }, [isVideoEnabled]);

  useEffect(() => {
    setIsMuted(!isAudioEnabled);
  }, [isAudioEnabled]);

  // Controle de visibilidade dos controles - apenas na parte inferior da tela (desktop)
  // No mobile/touch, controles são sempre visíveis (gerenciado pelo ControlBar)
  useEffect(() => {
    // No mobile/touch, não precisamos do listener de mouse
    if (isTouch) {
      setControlsVisible(true);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const windowHeight = window.innerHeight;
      const bottomThreshold = windowHeight - 150; // 150px da parte inferior
      
      if (e.clientY >= bottomThreshold) {
        // Mouse na parte inferior - mostrar controles
        setControlsVisible(true);
        
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        
        controlsTimeoutRef.current = window.setTimeout(() => {
          setControlsVisible(false);
        }, 3000);
      }
    };

    const handleMouseLeave = () => {
      // Mouse saiu da janela - esconder controles após delay
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 1000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isTouch]);

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
    // Sincronizar com o estado real do vídeo
    setIsVideoOff(!isVideoEnabled);
  }, [toggleVideo, isVideoEnabled]);

  const handleToggleScreenShare = useCallback(async () => {
    await toggleScreenShare();
    setIsScreenSharing(prev => !prev);
  }, [toggleScreenShare]);

  // Handler para PiP
  const handleTogglePiP = useCallback(async () => {
    if (!document.pictureInPictureEnabled) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else {
        // Encontrar o melhor vídeo para PiP
        const videos = Array.from(document.querySelectorAll('video'));
        const video = videos.find(v => 
          v.srcObject && 
          (v.srcObject as MediaStream).getVideoTracks().some(t => t.enabled)
        );
        
        if (video && video.readyState >= 2) {
          await video.requestPictureInPicture();
          setIsPiPActive(true);
        }
      }
    } catch (e) {
      console.error('[MeetingRoom] Erro ao alternar PiP:', e);
    }
  }, []);

  // Listener para quando PiP é fechado externamente
  useEffect(() => {
    const handlePiPChange = () => {
      setIsPiPActive(!!document.pictureInPictureElement);
    };
    
    document.addEventListener('enterpictureinpicture', handlePiPChange);
    document.addEventListener('leavepictureinpicture', handlePiPChange);
    
    return () => {
      document.removeEventListener('enterpictureinpicture', handlePiPChange);
      document.removeEventListener('leavepictureinpicture', handlePiPChange);
    };
  }, []);

  const handleLeaveMeeting = useCallback(() => {
    // Para usuários autenticados, mostrar modal de opções
    if (isAuthenticated) {
      setShowEndModal(true);
      return;
    }
    
    // Para convidados, sair diretamente
    sessionStorage.removeItem(`video-chat-userId-${roomId}`);
    sessionStorage.removeItem('videochat_user_name');
    navigate('/');
  }, [navigate, roomId, isAuthenticated]);

  // Handler para apenas sair (sem encerrar sala)
  const handleLeaveOnly = useCallback(() => {
    // Finalizar reunião no histórico
    if (isAuthenticated && user?.login && currentMeetingId) {
      meetingHistoryService.endMeeting(user.login, currentMeetingId);
    }
    
    // Limpar dados da sessão
    sessionStorage.removeItem(`video-chat-userId-${roomId}`);
    sessionStorage.removeItem('videochat_user_name');
    setShowEndModal(false);
    navigate('/');
  }, [navigate, roomId, isAuthenticated, user?.login, currentMeetingId]);

  // Handler para encerrar sala (gera relatório se for entrevista)
  const handleEndRoom = useCallback(async () => {
    // Se for entrevista, gerar relatório
    if (meetingType === 'ENTREVISTA' && transcriptions.length > 0) {
      setIsGeneratingReport(true);
      
      // Simular tempo de processamento da IA
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Gerar relatório
      const report = interviewAIService.generateInterviewReport(
        meetingTopic,
        transcriptions.map(t => ({
          text: t.transcribedText,
          speaker: t.speakerLabel || 'Desconhecido',
          timestamp: t.timestamp
        }))
      );
      
      setInterviewReport(report);
      setIsGeneratingReport(false);
      setShowEndModal(false);
      setShowReportModal(true);
    } else {
      // Não é entrevista, apenas sair
      handleLeaveOnly();
    }
  }, [meetingType, meetingTopic, transcriptions, handleLeaveOnly]);

  // Handler para fechar relatório e sair
  const handleCloseReport = useCallback(() => {
    setShowReportModal(false);
    
    // Finalizar reunião no histórico
    if (isAuthenticated && user?.login && currentMeetingId) {
      meetingHistoryService.endMeeting(user.login, currentMeetingId);
    }
    
    // Limpar dados da sessão
    sessionStorage.removeItem(`video-chat-userId-${roomId}`);
    sessionStorage.removeItem('videochat_user_name');
    navigate('/');
  }, [navigate, roomId, isAuthenticated, user?.login, currentMeetingId]);

  const handleToggleChat = useCallback(() => {
    setIsChatOpen(prev => {
      if (!prev) {
        setUnreadCount(0);
      }
      return !prev;
    });
  }, []);

  const handleToggleTranscription = useCallback(() => {
    setIsTranscriptionOpen(prev => !prev);
  }, []);

  const handleToggleTranscriptionActive = useCallback(() => {
    toggleTranscription();
  }, [toggleTranscription]);

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
        <div className={`absolute ${isMobile ? 'top-2 left-2 right-2' : 'top-4 left-1/2 transform -translate-x-1/2'} z-50`}>
          <div className={`${isMobile ? 'px-3 py-2' : 'px-6 py-3'} rounded-lg shadow-lg border ${
            darkMode 
              ? 'bg-red-900/90 border-red-700 text-red-200' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
              <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-red-500 flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium flex-1`}>
                {isMobile ? 'Permita acesso à câmera' : 'Clique no ícone da câmera na barra de endereços para permitir acesso'}
              </span>
              <button
                onClick={() => window.location.reload()}
                className={`${isMobile ? 'px-2 py-0.5 text-[10px]' : 'ml-2 px-3 py-1 text-xs'} rounded ${
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

      <div className={`h-full ${isMobile ? 'p-1' : 'p-4'}`}>
        <VideoGrid 
          participants={participants}
          localStream={localStream}
          remoteStreams={remoteStreams}
          darkMode={darkMode}
          speakingUsers={speakingUsers}
          localUserId={userId}
          isLocalVideoEnabled={!isVideoOff}
          localUserName={userName}
        />
      </div>

      {!isTouch && (
        <div
          ref={mouseAreaRef}
          className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-10"
        />
      )}

      {/* Recording Control - só para usuários autenticados */}
      {isAuthenticated && currentMeetingId && (
        <div className={`fixed ${isMobile ? 'top-12 right-2' : 'top-4 right-48'} z-40`}>
          <RecordingControl
            isRecording={isRecordingMeeting}
            isPaused={isRecordingPaused}
            duration={recordingDuration}
            onStart={startRecording}
            onStop={stopRecording}
            onTogglePause={toggleRecordingPause}
            darkMode={darkMode}
            disabled={!localStream}
          />
        </div>
      )}

      <ControlBar
        visible={controlsVisible}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        isTranscriptionActive={isTranscriptionEnabled}
        isAuthenticated={isAuthenticated}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleTranscriptionActive={handleToggleTranscriptionActive}
        onLeaveMeeting={handleLeaveMeeting}
        onToggleChat={handleToggleChat}
        onToggleTranscriptionPanel={handleToggleTranscription}
        onTogglePiP={handleTogglePiP}
        isPiPActive={isPiPActive}
        unreadCount={unreadCount}
        transcriptionCount={transcriptions.length}
        darkMode={darkMode}
      />

      <ChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        darkMode={darkMode}
      />

      <TranscriptionPanel
        isOpen={isTranscriptionOpen}
        onClose={() => setIsTranscriptionOpen(false)}
        transcriptions={transcriptions}
        isTranscriptionEnabled={isTranscriptionEnabled}
        isRecording={isRecording}
        onToggleTranscription={toggleTranscription}
        speakingUsers={speakingUsers || new Set()}
        darkMode={darkMode}
        isSpeechRecognitionSupported={isSpeechRecognitionSupported}
      />

      {/* Meeting Setup Modal - só para usuários autenticados */}
      {isAuthenticated && (
        <MeetingSetupModal
          isOpen={showMeetingSetup}
          onClose={() => {
            setShowMeetingSetup(false);
            setHasSetupCompleted(true);
          }}
          onConfirm={handleMeetingSetup}
          darkMode={darkMode}
        />
      )}

      {/* Interview Suggestions - só para entrevistas */}
      {isAuthenticated && meetingType === 'ENTREVISTA' && hasSetupCompleted && (
        <InterviewSuggestions
          suggestions={interviewSuggestions}
          isGenerating={isGeneratingSuggestions}
          onMarkAsRead={markSuggestionAsRead}
          onDismiss={dismissSuggestion}
          darkMode={darkMode}
          meetingTopic={meetingTopic}
        />
      )}

      {/* End Meeting Modal - só para usuários autenticados */}
      <EndMeetingModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        onLeave={handleLeaveOnly}
        onEndRoom={handleEndRoom}
        isAuthenticated={isAuthenticated}
        isGeneratingReport={isGeneratingReport}
        meetingType={meetingType}
        darkMode={darkMode}
      />

      {/* Interview Report Modal */}
      <InterviewReportModal
        isOpen={showReportModal}
        onClose={handleCloseReport}
        report={interviewReport}
        darkMode={darkMode}
      />

      {/* Version Info Button */}
      <button
        onClick={() => setShowVersionInfo(true)}
        className={`fixed ${isMobile ? 'top-2 left-2 w-7 h-7' : 'top-4 left-4 w-8 h-8'} rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110 z-40 backdrop-blur-xl ${
          darkMode 
            ? 'bg-gray-900/60 text-white/70 hover:text-white border border-white/10' 
            : 'bg-white/40 text-gray-500 hover:text-gray-700 border border-white/30'
        }`}
        title="Informações da versão"
      >
        <Info size={isMobile ? 14 : 16} />
      </button>

      {/* Auth Status Badge */}
      <div
        className={`fixed ${isMobile ? 'top-2 left-11' : 'top-4 left-14'} z-40 flex items-center gap-2 ${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-full backdrop-blur-xl transition-all duration-150 ${
          isAuthenticated
            ? darkMode 
              ? 'bg-green-900/60 text-green-400 border border-green-700/50' 
              : 'bg-green-100/80 text-green-700 border border-green-300/50'
            : darkMode 
              ? 'bg-gray-900/60 text-gray-400 border border-gray-700/50' 
              : 'bg-gray-100/80 text-gray-500 border border-gray-300/50'
        }`}
        title={isAuthenticated ? `Autenticado como ${user?.login}` : 'Modo Convidado'}
      >
        {isAuthenticated ? (
          <>
            <ShieldCheck size={isMobile ? 12 : 14} className="text-green-500" />
            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium`}>
              {isMobile ? user?.login?.substring(0, 8) : user?.login}
            </span>
          </>
        ) : (
          <>
            <User size={isMobile ? 12 : 14} />
            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium`}>
              Convidado
            </span>
          </>
        )}
      </div>

      {/* Connection Quality Indicator - só mostra quando há problemas */}
      {(overallQuality === 'fair' || overallQuality === 'poor') && (
        <div
          className={`fixed ${isMobile ? 'top-2 right-2' : 'top-4 right-4'} z-40 flex items-center gap-2 ${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-full backdrop-blur-xl transition-all duration-150 ${
            overallQuality === 'poor'
              ? darkMode 
                ? 'bg-red-900/60 border border-red-500/30' 
                : 'bg-red-100/80 border border-red-300/50'
              : darkMode 
                ? 'bg-yellow-900/60 border border-yellow-500/30' 
                : 'bg-yellow-100/80 border border-yellow-300/50'
          }`}
          title={`Qualidade: ${overallQuality === 'fair' ? 'Regular' : 'Ruim'}`}
        >
          {overallQuality === 'fair' && <Wifi size={isMobile ? 12 : 14} className="text-yellow-500" />}
          {overallQuality === 'poor' && <WifiOff size={isMobile ? 12 : 14} className="text-red-500" />}
          <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium ${
            overallQuality === 'fair' ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {overallQuality === 'fair' ? 'Conexão Regular' : 'Conexão Ruim'}
          </span>
        </div>
      )}

      {/* Version Info Modal */}
      {showVersionInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`relative ${isMobile ? 'w-full max-w-xs' : 'w-80'} rounded-2xl shadow-2xl ${isMobile ? 'p-4' : 'p-6'} ${
            darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
          }`}>
            <button
              onClick={() => setShowVersionInfo(false)}
              className={`absolute ${isMobile ? 'top-2 right-2 w-7 h-7' : 'top-3 right-3 w-8 h-8'} rounded-full flex items-center justify-center transition hover:rotate-90 ${
                darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={isMobile ? 16 : 18} />
            </button>
            
            <div className="text-center">
              <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center`}>
                <span className={isMobile ? 'text-xl' : 'text-2xl'}>📹</span>
              </div>
              
              <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold mb-1`}>Video Chat</h3>
              <p className={`${isMobile ? 'text-xs' : 'text-sm'} mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Conferência em tempo real
              </p>
              
              <div className={`rounded-xl ${isMobile ? 'p-3' : 'p-4'} mb-3 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Versão</span>
                  <span className={`font-mono font-bold text-blue-500 ${isMobile ? 'text-sm' : ''}`}>{APP_VERSION}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Build</span>
                  <span className={`font-mono ${isMobile ? 'text-xs' : 'text-sm'} ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{BUILD_DATE}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>WebSocket</span>
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                    {isConnected ? '● Conectado' : '○ Desconectado'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Dispositivo</span>
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {isMobile ? '📱 Mobile' : '💻 Desktop'}
                  </span>
                </div>
              </div>
              
              <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>Sala: {roomId}</p>
                <p>Participantes: {participants.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}