import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Info, X, ShieldCheck, User, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import ChimeVideoGrid from './ChimeVideoGrid';
import ControlBar from './ControlBar';
import ChatSidebar from './ChatSidebar';
import TranscriptionPanel from './TranscriptionPanel';
import MeetingSetupModal from './MeetingSetupModal';
import InterviewSuggestions from './InterviewSuggestions';
import EndMeetingModal from './EndMeetingModal';
import InterviewReportModal from './InterviewReportModal';
import ScopeAssistantPanel from './ScopeAssistantPanel';
import ScopeReportModal from './ScopeReportModal';
import BackgroundSelector from './BackgroundSelector';
import { FeatureErrorBoundary } from './FeatureErrorBoundary';
import { useWebSocket } from '../hooks/useWebSocket';
import { useChimeMeeting } from '../hooks/useChimeMeeting';
import { useChimeTranscription } from '../hooks/useChimeTranscription';
import { useInterviewAssistant } from '../hooks/useInterviewAssistant';
import { useScopeAssistant } from '../hooks/useScopeAssistant';
import { useBackgroundEffect } from '../hooks/useBackgroundEffect';
import { useMobile } from '../hooks/useMobile';
import { useAuth } from '../contexts/AuthContext';
import { useRecording } from '../hooks/useRecording';
import { useTabSync } from '../hooks/useStability';
import { meetingHistoryService } from '../services/meetingHistoryService';
import { interviewAIService, InterviewReport } from '../services/interviewAIService';
import { featureDetector } from '../utils/featureDetection';
import { getRoomConfig, saveRoomConfig, RoomConfig } from '../services/roomConfigService';

// Versão do aplicativo - atualizar a cada deploy
const APP_VERSION = '3.8.0';
const BUILD_DATE = '2025-12-23 10:30';

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
  const { isAuthenticated, user, isAdmin } = useAuth();
  
  const userName = sessionStorage.getItem('videochat_user_name') || 'Usuário';
  
  // Verificar features críticas no início
  const criticalFeaturesCheck = useMemo(() => {
    return featureDetector.checkCriticalFeatures();
  }, []);
  
  const userId = useMemo(() => {
    const storageKey = `video-chat-userId-${roomId}`;
    const storedId = sessionStorage.getItem(storageKey);
    if (storedId) return storedId;
    
    const newId = 'user_' + Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem(storageKey, newId);
    return newId;
  }, [roomId]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTranscriptionOpen, setIsTranscriptionOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [showVersionInfo, setShowVersionInfo] = useState(false);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [showMeetingSetup, setShowMeetingSetup] = useState(false);
  const [meetingType, setMeetingType] = useState<string>('REUNIAO');
  const [meetingTopic, setMeetingTopic] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [hasSetupCompleted, setHasSetupCompleted] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [autoStartTranscription, setAutoStartTranscription] = useState(false);
  const [autoStartRecording, setAutoStartRecording] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [interviewReport, setInterviewReport] = useState<InterviewReport | null>(null);
  const [showScopeReportModal, setShowScopeReportModal] = useState(false);
  
  const controlsTimeoutRef = useRef<number>();
  const isChatOpenRef = useRef(isChatOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // Carregar configuração da sala do DynamoDB
  useEffect(() => {
    if (!roomId || !isAuthenticated) {
      setIsLoadingConfig(false);
      return;
    }

    const loadConfig = async () => {
      try {
        const result = await getRoomConfig(roomId);
        if (result.exists && result.config) {
          setMeetingType(result.config.type);
          setMeetingTopic(result.config.topic);
          setJobDescription(result.config.jobDescription || '');
          setAutoStartTranscription(result.config.autoStartTranscription);
          setAutoStartRecording(result.config.autoStartRecording);
          setHasSetupCompleted(true);
        }
      } catch (error) {
        console.error('[MeetingRoom] Erro ao carregar config:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadConfig();
  }, [roomId, isAuthenticated]);
  // ============ AMAZON CHIME SDK ============
  const {
    isJoined,
    isJoining,
    error: chimeError,
    videoTiles,
    activeSpeakers,
    attendees,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    connectionQuality,
    localAudioStream,
    isSpeakerMode,
    meetingId: chimeMeetingId,
    // Dispositivos
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    // Ações
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    toggleSpeakerMode,
    changeAudioInput,
    changeAudioOutput,
    changeVideoInput,
    leaveMeeting: leaveChimeMeeting,
    bindVideoElement,
    bindAudioElement,
    audioVideo, // Para background effect e transcrição
  } = useChimeMeeting({
    roomId: roomId || '',
    odUserId: userId,
    userName,
    isAuthenticated,
  });

  // WebSocket para chat
  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.type === 'message') {
      const newMessage: Message = {
        id: data.data.messageId,
        author: data.data.userName,
        text: data.data.content,
        time: new Date(data.data.timestamp).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', minute: '2-digit' 
        }),
        isOwn: data.data.userId === userId
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      if (!isChatOpenRef.current && data.data.userId !== userId) {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [userId]);

  const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || '';
  const { sendMessage, isConnected, addMessageHandler } = useWebSocket(
    wsUrl, userId, roomId || '', handleWebSocketMessage
  );

  // Tab sync
  const { isMainTab } = useTabSync(roomId || '', userId);

  // Transcrição via Amazon Transcribe (server-side, não usa browser Speech Recognition)
  const {
    transcriptions,
    isTranscriptionEnabled,
    isStarting: isTranscriptionStarting,
    toggleTranscription,
    isSpeechRecognitionSupported
  } = useChimeTranscription({
    roomId: roomId || '',
    odUserId: userId,
    userName,
    meetingId: chimeMeetingId,
    audioVideo,
    attendees,
  });

  // Flag para indicar se está gravando transcrição (para UI)
  const isRecording = isTranscriptionEnabled;

  // Assistente de entrevista
  const {
    suggestions: interviewSuggestions,
    isGenerating: isGeneratingSuggestions,
    recentlyMarkedIds,
    markAsRead: markSuggestionAsRead,
    dismissSuggestion,
  } = useInterviewAssistant({
    isEnabled:
      isAuthenticated && meetingType === 'ENTREVISTA' && hasSetupCompleted,
    meetingType,
    topic: meetingTopic,
    jobDescription,
    transcriptions,
    roomId: roomId || '',
    userLogin: user?.login,
    userName, // Nome do entrevistador para filtrar transcrições
  });

  // Assistente de escopo
  const {
    requirements: scopeRequirements,
    features: scopeFeatures,
    suggestions: scopeSuggestions,
    summary: scopeSummary,
    objective: scopeObjective,
    isAnalyzing: isScopeAnalyzing,
    clarifyRequirement,
    confirmRequirement,
    removeRequirement,
    updatePriority,
    groupIntoFeatures,
    dismissSuggestion: dismissScopeSuggestion,
    updateObjective,
  } = useScopeAssistant({
    isEnabled: isAuthenticated && meetingType === 'ESCOPO' && hasSetupCompleted,
    meetingType,
    projectName: meetingTopic,
    transcriptions,
    roomId: roomId || '',
  });

  // Gravação
  const {
    isRecording: isRecordingMeeting,
    duration: recordingDuration,
    startRecording,
    stopRecording,
  } = useRecording({
    roomId: roomId || '',
    userLogin: user?.login || '',
    meetingId: currentMeetingId || '',
  });

  // Background Effect (blur/virtual background)
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);
  const {
    isSupported: isBackgroundSupported,
    isProcessing: isBackgroundProcessing,
    currentBackground,
    availableBackgrounds,
    error: backgroundError,
    setBackground,
  } = useBackgroundEffect({
    isAuthenticated,
    audioVideo,
    isVideoEnabled,
  });



  // Ref para controlar se a gravação automática já foi iniciada
  const autoRecordingStartedRef = useRef(false);
  const autoTranscriptionStartedRef = useRef(false);

  // Auto-iniciar transcrição quando configurado
  useEffect(() => {
    if (!isJoined || !isAuthenticated || !chimeMeetingId || !autoStartTranscription) {
      return;
    }
    
    if (autoTranscriptionStartedRef.current || isTranscriptionEnabled) {
      return;
    }
    
    autoTranscriptionStartedRef.current = true;
    
    const timer = setTimeout(async () => {
      try {
        await toggleTranscription();
        console.log('[MeetingRoom] Auto-transcrição iniciada');
      } catch (err) {
        console.error('[MeetingRoom] Erro ao auto-iniciar transcrição:', err);
        autoTranscriptionStartedRef.current = false;
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [isJoined, isAuthenticated, chimeMeetingId, autoStartTranscription, isTranscriptionEnabled, toggleTranscription]);

  // Auto-iniciar gravação quando entrar na sala (se configurado)
  useEffect(() => {
    // Aguardar todas as condições estarem prontas
    if (!isJoined || !isAuthenticated || !user?.login || !currentMeetingId) {
      return;
    }
    
    // Verificar se auto-gravação está habilitada
    if (!autoStartRecording) {
      console.log('[MeetingRoom] Auto-gravação não habilitada para esta sala');
      return;
    }
    
    // Evitar múltiplas tentativas
    if (autoRecordingStartedRef.current || isRecordingMeeting) {
      return;
    }
    
    autoRecordingStartedRef.current = true;
    console.log('[MeetingRoom] Iniciando auto-gravação...');
    
    // Delay maior para garantir que vídeos estão prontos
    const timer = setTimeout(async () => {
      try {
        const success = await startRecording();
        if (success) {
          console.log('[MeetingRoom] Auto-gravação iniciada com sucesso');
        } else {
          console.warn('[MeetingRoom] Falha ao iniciar auto-gravação');
          // Reset para permitir tentativa manual
          autoRecordingStartedRef.current = false;
        }
      } catch (err) {
        console.error('[MeetingRoom] Erro ao auto-iniciar gravação:', err);
        autoRecordingStartedRef.current = false;
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [isJoined, isAuthenticated, user?.login, currentMeetingId, isRecordingMeeting, startRecording, autoStartRecording]);


  // Setup modal para usuários autenticados
  useEffect(() => {
    if (isAuthenticated && !hasSetupCompleted && isJoined && !isLoadingConfig) {
      const timer = setTimeout(() => setShowMeetingSetup(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasSetupCompleted, isJoined, isLoadingConfig]);

  const handleMeetingSetup = useCallback(async (type: string, topic: string, options?: { autoStartTranscription?: boolean; autoStartRecording?: boolean; jobDescription?: string }) => {
    setMeetingType(type);
    setMeetingTopic(topic);
    setJobDescription(options?.jobDescription || '');
    setHasSetupCompleted(true);
    setShowMeetingSetup(false);
    
    if (options?.autoStartTranscription) {
      setAutoStartTranscription(true);
    }
    if (options?.autoStartRecording) {
      setAutoStartRecording(true);
    }
    
    // Salvar no DynamoDB
    if (roomId) {
      const result = await saveRoomConfig(roomId, {
        type: type as RoomConfig['type'],
        topic,
        jobDescription: options?.jobDescription || '',
        autoStartTranscription: options?.autoStartTranscription ?? false,
        autoStartRecording: options?.autoStartRecording ?? false,
        allowGuestAccess: true,
        enableChat: true,
      }, user?.login);
      
      if (!result.success) {
        console.error('[MeetingRoom] Erro ao salvar config:', result.error);
      }
    }
  }, [roomId, user?.login]);

  // Criar registro de reunião
  useEffect(() => {
    if (isAuthenticated && user?.login && roomId && !currentMeetingId && isJoined) {
      const meeting = meetingHistoryService.createMeeting(user.login, roomId, [userName]);
      setCurrentMeetingId(meeting.id);
    }
  }, [isAuthenticated, user?.login, roomId, isJoined, currentMeetingId, userName]);

  // Salvar transcrições
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

  // Controles visíveis
  useEffect(() => {
    if (isTouch) {
      setControlsVisible(true);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const windowHeight = window.innerHeight;
      if (e.clientY >= windowHeight - 150) {
        setControlsVisible(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = window.setTimeout(() => setControlsVisible(false), 3000);
      }
    };

    const handleMouseLeave = () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = window.setTimeout(() => setControlsVisible(false), 1000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
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
  }, [toggleAudio]);

  const handleToggleVideo = useCallback(() => {
    toggleVideo();
  }, [toggleVideo]);

  const handleToggleScreenShare = useCallback(async () => {
    await toggleScreenShare();
  }, [toggleScreenShare]);

  const handleLeaveMeeting = useCallback(() => {
    if (isAuthenticated) {
      setShowEndModal(true);
      return;
    }
    leaveChimeMeeting();
    sessionStorage.removeItem(`video-chat-userId-${roomId}`);
    sessionStorage.removeItem('videochat_user_name');
    navigate('/');
  }, [navigate, roomId, isAuthenticated, leaveChimeMeeting]);

  const handleLeaveOnly = useCallback(() => {
    if (isAuthenticated && user?.login && currentMeetingId) {
      meetingHistoryService.endMeeting(user.login, currentMeetingId);
    }
    leaveChimeMeeting();
    sessionStorage.removeItem(`video-chat-userId-${roomId}`);
    sessionStorage.removeItem('videochat_user_name');
    setShowEndModal(false);
    navigate('/');
  }, [navigate, roomId, isAuthenticated, user?.login, currentMeetingId, leaveChimeMeeting]);

  const handleEndRoom = useCallback(async () => {
    if (meetingType === 'ENTREVISTA' && transcriptions.length > 0) {
      setIsGeneratingReport(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Passar jobDescription e nome do entrevistador para identificação correta
      const report = interviewAIService.generateInterviewReport(
        meetingTopic,
        transcriptions.map(t => ({
          text: t.transcribedText,
          speaker: t.speakerLabel || 'Desconhecido',
          timestamp: t.timestamp
        })),
        jobDescription, // Descrição da vaga para análise técnica focada
        userName // Nome do entrevistador para identificar corretamente o candidato
      );
      
      setInterviewReport(report);
      setIsGeneratingReport(false);
      setShowEndModal(false);
      setShowReportModal(true);
    } else if (meetingType === 'ESCOPO' && scopeSummary) {
      // Mostrar modal de LRD para reuniões de escopo
      setShowEndModal(false);
      setShowScopeReportModal(true);
    } else {
      handleLeaveOnly();
    }
  }, [meetingType, meetingTopic, transcriptions, handleLeaveOnly, jobDescription, userName, scopeSummary]);

  const handleCloseReport = useCallback(() => {
    setShowReportModal(false);
    if (isAuthenticated && user?.login && currentMeetingId) {
      meetingHistoryService.endMeeting(user.login, currentMeetingId);
    }
    leaveChimeMeeting();
    sessionStorage.removeItem(`video-chat-userId-${roomId}`);
    sessionStorage.removeItem('videochat_user_name');
    navigate('/');
  }, [navigate, roomId, isAuthenticated, user?.login, currentMeetingId, leaveChimeMeeting]);

  const handleCloseScopeReport = useCallback(() => {
    setShowScopeReportModal(false);
    // Salvar LRD no histórico
    if (isAuthenticated && user?.login && currentMeetingId && scopeSummary) {
      meetingHistoryService.saveScopeReport(user.login, currentMeetingId, scopeSummary);
      meetingHistoryService.endMeeting(user.login, currentMeetingId);
    }
    leaveChimeMeeting();
    sessionStorage.removeItem(`video-chat-userId-${roomId}`);
    sessionStorage.removeItem('videochat_user_name');
    navigate('/');
  }, [navigate, roomId, isAuthenticated, user?.login, currentMeetingId, leaveChimeMeeting, scopeSummary]);

  const handleToggleChat = useCallback(() => {
    setIsChatOpen(prev => {
      if (!prev) setUnreadCount(0);
      return !prev;
    });
  }, []);

  const handleToggleTranscription = useCallback(() => {
    setIsTranscriptionOpen(prev => !prev);
  }, []);

  const handleToggleTranscriptionActive = useCallback(() => {
    toggleTranscription();
  }, [toggleTranscription]);

  const handleToggleSpeakerMode = useCallback(() => {
    toggleSpeakerMode();
  }, [toggleSpeakerMode]);


  // Se não é a aba principal
  if (!isMainTab) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${
        darkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`text-center p-8 rounded-2xl ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        } shadow-xl max-w-md mx-4`}>
          <AlertTriangle size={48} className="mx-auto mb-4 text-yellow-500" />
          <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Sala aberta em outra aba
          </h2>
          <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Esta sala já está aberta em outra aba do navegador.
          </p>
          <button
            onClick={() => navigate('/')}
            className={`px-6 py-2 rounded-lg font-medium ${
              darkMode ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                       : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  // Se features críticas não são suportadas
  if (!criticalFeaturesCheck.supported) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${
        darkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`text-center p-8 rounded-2xl ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        } shadow-xl max-w-md mx-4`}>
          <AlertTriangle size={48} className="mx-auto mb-4 text-orange-500" />
          <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Navegador Incompatível
          </h2>
          <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Seu navegador não suporta as funcionalidades necessárias para videochamadas:
          </p>
          <ul className={`text-left mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {criticalFeaturesCheck.missing.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 mb-1">
                <span className="text-red-500">✗</span> {feature}
              </li>
            ))}
          </ul>
          <p className={`text-sm mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Recomendamos usar Chrome, Firefox, Edge ou Safari atualizados.
          </p>
          <button
            onClick={() => navigate('/')}
            className={`px-6 py-2 rounded-lg font-medium ${
              darkMode ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                       : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  // Tela de carregamento enquanto conecta ao Chime
  if (isJoining) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${
        darkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Conectando à reunião...
          </h2>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Aguarde enquanto estabelecemos a conexão
          </p>
        </div>
      </div>
    );
  }

  // Erro ao conectar
  if (chimeError) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${
        darkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`text-center p-8 rounded-2xl ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        } shadow-xl max-w-md mx-4`}>
          <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
          <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Erro ao conectar
          </h2>
          <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {chimeError}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className={`px-6 py-2 rounded-lg font-medium ${
                darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                         : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => navigate('/')}
              className={`px-6 py-2 rounded-lg font-medium ${
                darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                         : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen overflow-hidden transition-colors duration-300 ${
      darkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Video Grid usando Chime SDK */}
      <FeatureErrorBoundary feature="VideoGrid" darkMode={darkMode}>
        <div className={`h-full ${isMobile ? 'p-1' : 'p-4'}`}>
          <ChimeVideoGrid
            videoTiles={videoTiles}
            activeSpeakers={activeSpeakers}
            localUserId={userId}
            isLocalVideoEnabled={isVideoEnabled}
            isLocalAudioEnabled={isAudioEnabled}
            bindVideoElement={bindVideoElement}
            bindAudioElement={bindAudioElement}
            darkMode={darkMode}
          />
        </div>
      </FeatureErrorBoundary>

      <FeatureErrorBoundary feature="ControlBar" darkMode={darkMode}>
        <ControlBar
          visible={controlsVisible}
          isMuted={!isAudioEnabled}
          isVideoOff={!isVideoEnabled}
          isScreenSharing={isScreenSharing}
          isTranscriptionActive={isTranscriptionEnabled}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          isSpeakerMode={isSpeakerMode}
          hasBackgroundEffect={currentBackground.type !== 'none'}
          // Dispositivos
          audioInputDevices={audioInputDevices}
          audioOutputDevices={audioOutputDevices}
          videoInputDevices={videoInputDevices}
          selectedAudioInput={selectedAudioInput}
          selectedAudioOutput={selectedAudioOutput}
          selectedVideoInput={selectedVideoInput}
          onChangeAudioInput={changeAudioInput}
          onChangeAudioOutput={changeAudioOutput}
          onChangeVideoInput={changeVideoInput}
          // Ações
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleTranscriptionActive={handleToggleTranscriptionActive}
          onToggleSpeakerMode={handleToggleSpeakerMode}
          onToggleBackgroundSelector={isBackgroundSupported ? () => setShowBackgroundSelector(true) : undefined}
          onLeaveMeeting={handleLeaveMeeting}
          onToggleChat={handleToggleChat}
          onToggleTranscriptionPanel={handleToggleTranscription}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          isRecording={isRecordingMeeting}
          recordingDuration={recordingDuration}
          unreadCount={unreadCount}
          transcriptionCount={transcriptions.length}
          darkMode={darkMode}
        />
      </FeatureErrorBoundary>

      <FeatureErrorBoundary feature="ChatSidebar" darkMode={darkMode}>
        <ChatSidebar
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          onSendMessage={handleSendMessage}
          darkMode={darkMode}
        />
      </FeatureErrorBoundary>

      {/* TranscriptionPanel - apenas para usuários autenticados (criador da sala) */}
      {isAuthenticated && (
        <FeatureErrorBoundary feature="TranscriptionPanel" darkMode={darkMode}>
          <TranscriptionPanel
            isOpen={isTranscriptionOpen}
            onClose={() => setIsTranscriptionOpen(false)}
            transcriptions={transcriptions}
            isTranscriptionEnabled={isTranscriptionEnabled}
            isRecording={isRecording}
            onToggleTranscription={toggleTranscription}
            speakingUsers={new Set(activeSpeakers)}
            darkMode={darkMode}
            isSpeechRecognitionSupported={isSpeechRecognitionSupported}
          />
        </FeatureErrorBoundary>
      )}


      {/* Meeting Setup Modal */}
      {isAuthenticated && (
        <FeatureErrorBoundary feature="MeetingSetupModal" darkMode={darkMode}>
          <MeetingSetupModal
            isOpen={showMeetingSetup}
            onClose={() => { setShowMeetingSetup(false); setHasSetupCompleted(true); }}
            onConfirm={handleMeetingSetup}
            darkMode={darkMode}
          />
        </FeatureErrorBoundary>
      )}

      {/* Interview Suggestions */}
      {isAuthenticated && meetingType === 'ENTREVISTA' && hasSetupCompleted && (
        <FeatureErrorBoundary feature="InterviewSuggestions" darkMode={darkMode}>
          <InterviewSuggestions
            suggestions={interviewSuggestions}
            isGenerating={isGeneratingSuggestions}
            onMarkAsRead={markSuggestionAsRead}
            onDismiss={dismissSuggestion}
            darkMode={darkMode}
            meetingTopic={meetingTopic}
            recentlyMarkedIds={recentlyMarkedIds}
          />
        </FeatureErrorBoundary>
      )}

      {/* Scope Assistant Panel */}
      {isAuthenticated && meetingType === 'ESCOPO' && hasSetupCompleted && (
        <FeatureErrorBoundary feature="ScopeAssistantPanel" darkMode={darkMode}>
          <ScopeAssistantPanel
            requirements={scopeRequirements}
            features={scopeFeatures}
            suggestions={scopeSuggestions}
            summary={scopeSummary}
            objective={scopeObjective}
            isAnalyzing={isScopeAnalyzing}
            darkMode={darkMode}
            projectName={meetingTopic}
            onClarifyRequirement={clarifyRequirement}
            onConfirmRequirement={confirmRequirement}
            onRemoveRequirement={removeRequirement}
            onUpdatePriority={updatePriority}
            onGroupIntoFeatures={groupIntoFeatures}
            onDismissSuggestion={dismissScopeSuggestion}
            onUpdateObjective={updateObjective}
          />
        </FeatureErrorBoundary>
      )}

      {/* End Meeting Modal */}
      <FeatureErrorBoundary feature="EndMeetingModal" darkMode={darkMode}>
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
      </FeatureErrorBoundary>

      {/* Interview Report Modal */}
      <FeatureErrorBoundary feature="InterviewReportModal" darkMode={darkMode}>
        <InterviewReportModal
          isOpen={showReportModal}
          onClose={handleCloseReport}
          report={interviewReport}
          darkMode={darkMode}
        />
      </FeatureErrorBoundary>

      {/* Scope Report Modal (LRD) */}
      <FeatureErrorBoundary feature="ScopeReportModal" darkMode={darkMode}>
        <ScopeReportModal
          isOpen={showScopeReportModal}
          onClose={handleCloseScopeReport}
          summary={scopeSummary}
          darkMode={darkMode}
        />
      </FeatureErrorBoundary>

      {/* Background Selector Modal */}
      {isBackgroundSupported && (
        <BackgroundSelector
          isOpen={showBackgroundSelector}
          onClose={() => setShowBackgroundSelector(false)}
          currentBackground={currentBackground}
          availableBackgrounds={availableBackgrounds}
          isProcessing={isBackgroundProcessing}
          isAuthenticated={isAuthenticated}
          error={backgroundError}
          onSelect={setBackground}
          darkMode={darkMode}
        />
      )}

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
            ? darkMode ? 'bg-green-900/60 text-green-400 border border-green-700/50' 
                       : 'bg-green-100/80 text-green-700 border border-green-300/50'
            : darkMode ? 'bg-gray-900/60 text-gray-400 border border-gray-700/50' 
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
            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium`}>Convidado</span>
          </>
        )}
      </div>

      {/* Connection Quality Indicator */}
      {(connectionQuality === 'fair' || connectionQuality === 'poor') && (
        <div
          className={`fixed ${isMobile ? 'top-2 right-2' : 'top-4 right-4'} z-40 flex items-center gap-2 ${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-full backdrop-blur-xl transition-all duration-150 ${
            connectionQuality === 'poor'
              ? darkMode ? 'bg-red-900/60 border border-red-500/30' 
                         : 'bg-red-100/80 border border-red-300/50'
              : darkMode ? 'bg-yellow-900/60 border border-yellow-500/30' 
                         : 'bg-yellow-100/80 border border-yellow-300/50'
          }`}
        >
          {connectionQuality === 'fair' && <Wifi size={isMobile ? 12 : 14} className="text-yellow-500" />}
          {connectionQuality === 'poor' && <WifiOff size={isMobile ? 12 : 14} className="text-red-500" />}
          <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium ${
            connectionQuality === 'fair' ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {connectionQuality === 'fair' ? 'Conexão Regular' : 'Conexão Ruim'}
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
                Powered by Amazon Chime SDK
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
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Chat</span>
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                    {isConnected ? '● Conectado' : '○ Desconectado'}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Mídia</span>
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${isJoined ? 'text-green-500' : 'text-yellow-500'}`}>
                    {isJoined ? '● Chime SDK' : '○ Conectando...'}
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
                <p>Participantes: {videoTiles.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
