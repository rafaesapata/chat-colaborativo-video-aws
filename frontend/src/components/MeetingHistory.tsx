import { useState, useEffect, useMemo } from 'react';
import { X, Clock, Users, FileText, Trash2, Download, ChevronDown, ChevronUp, Play, Video, Brain, Search, MessageSquare } from 'lucide-react';
import { meetingHistoryService, MeetingRecord, RecordingFragment } from '../services/meetingHistoryService';
import { getRecordingPlaybackUrl } from '../hooks/useRecording';
import { interviewAIService, InterviewContext, InterviewReport } from '../services/interviewAIService';
import InterviewReportModal from './InterviewReportModal';
import MeetingReportModal, { MeetingReportData } from './MeetingReportModal';
import { SkeletonMeetingCard } from './Skeleton';

interface MeetingHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  userLogin: string;
  darkMode: boolean;
}

export default function MeetingHistory({ isOpen, onClose, userLogin, darkMode }: MeetingHistoryProps) {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [currentFragmentIndex, setCurrentFragmentIndex] = useState(0);
  const [currentFragments, setCurrentFragments] = useState<RecordingFragment[]>([]);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentReport, setCurrentReport] = useState<InterviewReport | null>(null);
  const [currentReportMeetingId, setCurrentReportMeetingId] = useState<string | null>(null);
  const [showMeetingReportModal, setShowMeetingReportModal] = useState(false);
  const [currentMeetingReport, setCurrentMeetingReport] = useState<MeetingReportData | null>(null);
  const [currentMeetingReportRoomId, setCurrentMeetingReportRoomId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredMeetings = useMemo(() => {
    if (!searchQuery.trim()) return meetings;
    const q = searchQuery.toLowerCase().trim();
    return meetings.filter(m =>
      m.roomId.toLowerCase().includes(q) ||
      m.roomName?.toLowerCase().includes(q) ||
      m.meetingTopic?.toLowerCase().includes(q) ||
      m.participants.some(p => p.toLowerCase().includes(q)) ||
      formatDate(m.startTime).toLowerCase().includes(q)
    );
  }, [meetings, searchQuery]);

  useEffect(() => {
    if (isOpen && userLogin) {
      console.log('[MeetingHistory] Carregando histórico do backend para:', userLogin);
      setLoading(true);
      setMeetings([]);
      meetingHistoryService.getHistoryAsync(userLogin, true)
        .then((history: MeetingRecord[]) => {
          console.log('[MeetingHistory] Reuniões carregadas do backend:', history.length);
          setMeetings(history);
        })
        .catch((err: Error) => {
          console.error('[MeetingHistory] Erro ao carregar histórico:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, userLogin]);

  const handleDelete = (meetingId: string) => {
    if (confirm('Tem certeza que deseja excluir esta reunião do histórico?')) {
      meetingHistoryService.deleteMeeting(userLogin, meetingId);
      setMeetings(prev => prev.filter(m => m.id !== meetingId));
    }
  };

  const handleExport = (meeting: MeetingRecord) => {
    const content = meetingHistoryService.exportTranscriptions(meeting);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao_${meeting.roomId}_${new Date(meeting.startTime).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFragmentsFromMeeting = (meeting: MeetingRecord): RecordingFragment[] => {
    if (meeting.recordingFragments && meeting.recordingFragments.length > 0) {
      return [...meeting.recordingFragments].sort((a, b) => a.fragmentIndex - b.fragmentIndex);
    }
    if (meeting.recordingKey) {
      return [{
        recordingKey: meeting.recordingKey,
        recordingDuration: meeting.recordingDuration || 0,
        recordingId: meeting.recordingId,
        fragmentIndex: 0,
        timestamp: meeting.startTime,
      }];
    }
    return [];
  };

  const handlePlayRecording = async (meeting: MeetingRecord, fragmentIndex: number = 0) => {
    // Extrair fragmentos diretamente do objeto meeting (dados do backend)
    const fragments = getFragmentsFromMeeting(meeting);
    
    if (fragments.length === 0) return;
    
    const fragment = fragments[fragmentIndex];
    if (!fragment) return;
    
    setLoadingVideo(true);
    setCurrentFragments(fragments);
    setCurrentFragmentIndex(fragmentIndex);
    
    try {
      const url = await getRecordingPlaybackUrl(fragment.recordingKey, userLogin);
      if (url) {
        setVideoUrl(url);
        setPlayingVideo(meeting.id);
      }
    } catch (error) {
      console.error('Erro ao carregar vídeo:', error);
    } finally {
      setLoadingVideo(false);
    }
  };

  const handlePlayNextFragment = async () => {
    if (currentFragmentIndex < currentFragments.length - 1) {
      const nextIndex = currentFragmentIndex + 1;
      const fragment = currentFragments[nextIndex];
      
      setLoadingVideo(true);
      setCurrentFragmentIndex(nextIndex);
      
      try {
        const url = await getRecordingPlaybackUrl(fragment.recordingKey, userLogin);
        if (url) {
          setVideoUrl(url);
        }
      } catch (error) {
        console.error('Erro ao carregar próximo fragmento:', error);
      } finally {
        setLoadingVideo(false);
      }
    }
  };

  const handlePlayPrevFragment = async () => {
    if (currentFragmentIndex > 0) {
      const prevIndex = currentFragmentIndex - 1;
      const fragment = currentFragments[prevIndex];
      
      setLoadingVideo(true);
      setCurrentFragmentIndex(prevIndex);
      
      try {
        const url = await getRecordingPlaybackUrl(fragment.recordingKey, userLogin);
        if (url) {
          setVideoUrl(url);
        }
      } catch (error) {
        console.error('Erro ao carregar fragmento anterior:', error);
      } finally {
        setLoadingVideo(false);
      }
    }
  };

  const handleCloseVideo = () => {
    setPlayingVideo(null);
    setVideoUrl(null);
    setCurrentFragments([]);
    setCurrentFragmentIndex(0);
  };

  const handleGenerateReport = async (meeting: MeetingRecord) => {
    if (meeting.transcriptions.length === 0) {
      alert('Esta reunião não possui transcrições para gerar relatório.');
      return;
    }

    // Para reuniões não-entrevista, gerar relatório de reunião
    if (meeting.meetingType !== 'ENTREVISTA') {
      setGeneratingReport(meeting.id);
      try {
        const context = {
          meetingType: (meeting.meetingType || 'REUNIAO') as InterviewContext['meetingType'],
          topic: meeting.meetingTopic || meeting.roomId || 'Reunião',
          jobDescription: '',
          transcriptionHistory: meeting.transcriptions.map(t => t.text),
          questionsAsked: [],
          candidateName: '',
          participants: meeting.participants,
          duration: meeting.duration,
          startTime: meeting.startTime,
        };
        const report = await interviewAIService.generateMeetingReport(context);
        setCurrentMeetingReport(report);
        setCurrentMeetingReportRoomId(meeting.roomId);
        setShowMeetingReportModal(true);
      } catch (error) {
        console.error('Erro ao gerar relatório de reunião:', error);
        alert('Erro ao gerar relatório. Por favor, tente novamente.');
      } finally {
        setGeneratingReport(null);
      }
      return;
    }

    // Para entrevistas, manter fluxo existente
    setGeneratingReport(meeting.id);
    try {
      // Extrair informações da reunião
      const context: InterviewContext = {
        meetingType: (meeting.meetingType || 'ENTREVISTA') as InterviewContext['meetingType'],
        topic: meeting.meetingTopic || 'Entrevista',
        jobDescription: meeting.jobDescription || '',
        transcriptionHistory: meeting.transcriptions.map(t => t.text),
        questionsAsked: (meeting.questionsAsked || []).map((q, idx) => ({
          questionId: `q_${idx}`,
          question: q,
          answer: '', // Não temos as respostas separadas no histórico
          timestamp: Date.now(),
          category: 'general',
          answerQuality: 'good' as const,
          keyTopics: []
        })),
        candidateName: meeting.participants.find(p => p !== userLogin) || 'Candidato'
      };

      const report = await interviewAIService.generateInterviewReport(context);
      setCurrentReport(report);
      setCurrentReportMeetingId(meeting.id);
      setShowReportModal(true);

      // Persistir relatório no DynamoDB
      interviewAIService.saveReport(meeting.id, report, userLogin)
        .catch(err => console.error('[MeetingHistory] Erro ao persistir relatório:', err));
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Por favor, tente novamente.');
    } finally {
      setGeneratingReport(null);
    }
  };

  const handleCloseReport = () => {
    setShowReportModal(false);
    setCurrentReport(null);
    setCurrentReportMeetingId(null);
  };

  const formatRecordingDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'Em andamento';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}min`;
    }
    return `${minutes} min`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
      <div className={`relative w-full max-w-[95vw] xl:max-w-7xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-fade-in-scale ${
        darkMode ? 'bg-card-dark text-white' : 'bg-white text-foreground-light'
      }`}>
        {/* Header */}
        <div className={`shrink-0 sticky top-0 z-10 flex flex-col gap-3 p-4 border-b ${
          darkMode ? 'bg-card-dark border-border-dark' : 'bg-white border-border-light'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock size={24} className={darkMode ? 'text-primary-300' : 'text-primary'} />
              Histórico de Reuniões
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition hover:rotate-90 ${
                darkMode ? 'hover:bg-white/10 text-muted-dark' : 'hover:bg-black/5 text-muted-light'
              }`}
            >
              <X size={20} />
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              darkMode ? 'text-muted-dark' : 'text-muted-dark'
            }`} />
            <input
              type="text"
              placeholder="Buscar por código, participante, data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border outline-none transition ${
                darkMode
                  ? 'bg-white/5 border-border-dark text-white placeholder-muted-dark focus:border-primary'
                  : 'bg-black/3 border-border-light text-foreground-light placeholder-muted-dark focus:border-primary'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${
                  darkMode ? 'text-muted-dark hover:text-white' : 'text-muted-dark hover:text-muted-light'
                }`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <SkeletonMeetingCard key={i} darkMode={darkMode} />
              ))}
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className={`text-center py-12 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
              {searchQuery ? (
                <>
                  <Search size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhum resultado para "{searchQuery}"</p>
                  <p className="text-sm mt-1">Tente buscar por outro termo</p>
                </>
              ) : (
                <>
                  <Clock size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhuma reunião encontrada</p>
                  <p className="text-sm mt-1">Suas reuniões com transcrições aparecerão aqui</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMeetings.map((meeting, idx) => (
                <div
                  key={meeting.id}
                  className={`rounded-xl border overflow-hidden transition-all animate-fade-in-up ${
                    darkMode 
                      ? 'bg-white/5 border-border-dark hover:border-primary/50' 
                      : 'bg-black/3 border-border-light hover:border-primary-300'
                  }`}
                  style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
                >
                  {/* Meeting Header */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedMeeting(
                      expandedMeeting === meeting.id ? null : meeting.id
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`font-mono text-sm px-2 py-0.5 rounded ${
                            darkMode ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-50 text-primary-700'
                          }`}>
                            {meeting.roomId}
                          </span>
                          {meeting.recordingKey && (
                            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                              darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
                            }`}>
                              <Video size={12} />
                              {(() => {
                                const fragments = getFragmentsFromMeeting(meeting);
                                const totalDuration = fragments.reduce((total, f) => total + f.recordingDuration, 0);
                                if (fragments.length > 1) {
                                  return `${fragments.length} partes (${formatRecordingDuration(totalDuration)})`;
                                }
                                return totalDuration ? formatRecordingDuration(totalDuration) : 'Gravado';
                              })()}
                            </span>
                          )}
                          {meeting.transcriptions.length > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                              darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                            }`}>
                              <FileText size={12} />
                              {meeting.transcriptions.length} transcrições
                            </span>
                          )}
                          {(meeting.chatMessages?.length || 0) > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                              darkMode ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-50 text-primary-700'
                            }`}>
                              <MessageSquare size={12} />
                              {meeting.chatMessages!.length} msgs
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
                          {formatDate(meeting.startTime)}
                        </p>
                        <div className={`flex items-center gap-4 mt-2 text-xs ${
                          darkMode ? 'text-muted-dark' : 'text-muted-light'
                        }`}>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDuration(meeting.duration)}
                          </span>
                          {meeting.participants.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users size={12} />
                              {meeting.participants.length} participantes
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {meeting.recordingKey && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayRecording(meeting);
                            }}
                            disabled={loadingVideo}
                            className={`p-2 rounded-lg transition ${
                              darkMode 
                                ? 'hover:bg-red-900/50 text-red-400 hover:text-red-300' 
                                : 'hover:bg-red-100 text-red-500 hover:text-red-600'
                            } ${loadingVideo ? 'opacity-50' : ''}`}
                            title="Assistir gravação"
                          >
                            <Play size={16} />
                          </button>
                        )}
                        {meeting.transcriptions.length > 0 && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateReport(meeting);
                              }}
                              disabled={generatingReport === meeting.id}
                              className={`p-2 rounded-lg transition ${
                                darkMode 
                                  ? 'hover:bg-primary-900/50 text-primary-300 hover:text-primary-300' 
                                  : 'hover:bg-primary-50 text-primary hover:text-primary'
                              } ${generatingReport === meeting.id ? 'opacity-50 animate-pulse' : ''}`}
                              title="Gerar relatório com IA"
                            >
                              <Brain size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExport(meeting);
                              }}
                              className={`p-2 rounded-lg transition ${
                                darkMode 
                                  ? 'hover:bg-white/15 text-muted-dark hover:text-white' 
                                  : 'hover:bg-black/5 text-muted-light hover:text-muted-light'
                              }`}
                              title="Exportar transcrições"
                            >
                              <Download size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(meeting.id);
                          }}
                          className={`p-2 rounded-lg transition ${
                            darkMode 
                              ? 'hover:bg-red-900/50 text-muted-dark hover:text-red-400' 
                              : 'hover:bg-red-100 text-muted-light hover:text-red-600'
                          }`}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                        {expandedMeeting === meeting.id ? (
                          <ChevronUp size={20} className={darkMode ? 'text-muted-dark' : 'text-muted-light'} />
                        ) : (
                          <ChevronDown size={20} className={darkMode ? 'text-muted-dark' : 'text-muted-light'} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Transcriptions */}
                  {expandedMeeting === meeting.id && meeting.transcriptions.length > 0 && (
                    <div className={`border-t p-4 ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
                      <h4 className={`text-sm font-semibold mb-3 ${
                        darkMode ? 'text-foreground-dark' : 'text-muted-light'
                      }`}>
                        Transcrições
                      </h4>
                      <div className={`max-h-60 overflow-y-auto space-y-2 rounded-lg p-3 ${
                        darkMode ? 'bg-card-dark' : 'bg-white'
                      }`}>
                        {meeting.transcriptions
                          .sort((a, b) => a.timestamp - b.timestamp)
                          .map(t => (
                            <div key={t.id} className="text-sm">
                              <span className={`font-medium ${
                                darkMode ? 'text-primary-300' : 'text-primary'
                              }`}>
                                {t.speaker}
                              </span>
                              <span className={`text-xs ml-2 ${
                                darkMode ? 'text-muted-light' : 'text-muted-dark'
                              }`}>
                                {new Date(t.timestamp).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <p className={darkMode ? 'text-foreground-dark' : 'text-muted-light'}>
                                {t.text}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded Chat Messages */}
                  {expandedMeeting === meeting.id && (meeting.chatMessages?.length || 0) > 0 && (
                    <div className={`border-t p-4 ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`text-sm font-semibold flex items-center gap-2 ${
                          darkMode ? 'text-foreground-dark' : 'text-muted-light'
                        }`}>
                          <MessageSquare size={14} />
                          Chat ({meeting.chatMessages!.length} mensagens)
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const content = meetingHistoryService.exportChat(meeting);
                            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `chat_${meeting.roomId}_${new Date(meeting.startTime).toISOString().split('T')[0]}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 transition ${
                            darkMode
                              ? 'hover:bg-white/10 text-muted-dark hover:text-white'
                              : 'hover:bg-black/5 text-muted-light hover:text-foreground-light'
                          }`}
                          title="Exportar chat"
                        >
                          <Download size={12} />
                          Exportar
                        </button>
                      </div>
                      <div className={`max-h-60 overflow-y-auto space-y-2 rounded-lg p-3 ${
                        darkMode ? 'bg-card-dark' : 'bg-white'
                      }`}>
                        {meeting.chatMessages!
                          .sort((a, b) => a.timestamp - b.timestamp)
                          .map(m => (
                            <div key={m.id} className="text-sm">
                              <span className={`font-medium ${
                                darkMode ? 'text-primary-300' : 'text-primary'
                              }`}>
                                {m.author}
                              </span>
                              <span className={`text-xs ml-2 ${
                                darkMode ? 'text-muted-light' : 'text-muted-dark'
                              }`}>
                                {new Date(m.timestamp).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <p className={darkMode ? 'text-foreground-dark' : 'text-muted-light'}>
                                {m.text}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Player Modal */}
        {playingVideo && videoUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`relative w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden ${
              darkMode ? 'bg-surface-dark' : 'bg-black'
            }`}>
              <button
                onClick={handleCloseVideo}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition"
              >
                <X size={20} />
              </button>
              
              {/* Fragment Navigation */}
              {currentFragments.length > 1 && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/50 rounded-lg px-3 py-2">
                  <button
                    onClick={handlePlayPrevFragment}
                    disabled={currentFragmentIndex === 0 || loadingVideo}
                    className={`p-1 rounded transition ${
                      currentFragmentIndex === 0 || loadingVideo
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-white/20'
                    }`}
                  >
                    <ChevronUp size={16} className="text-white rotate-[-90deg]" />
                  </button>
                  <span className="text-white text-sm font-medium">
                    Parte {currentFragmentIndex + 1} de {currentFragments.length}
                  </span>
                  <button
                    onClick={handlePlayNextFragment}
                    disabled={currentFragmentIndex === currentFragments.length - 1 || loadingVideo}
                    className={`p-1 rounded transition ${
                      currentFragmentIndex === currentFragments.length - 1 || loadingVideo
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-white/20'
                    }`}
                  >
                    <ChevronDown size={16} className="text-white rotate-[-90deg]" />
                  </button>
                </div>
              )}
              
              {loadingVideo ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  className="w-full max-h-[80vh]"
                  onEnded={() => {
                    // Auto-play próximo fragmento quando terminar
                    if (currentFragmentIndex < currentFragments.length - 1) {
                      handlePlayNextFragment();
                    }
                  }}
                >
                  Seu navegador não suporta reprodução de vídeo.
                </video>
              )}
            </div>
          </div>
        )}

        {/* Report Modal */}
        {showReportModal && currentReport && (
          <InterviewReportModal
            isOpen={showReportModal}
            onClose={handleCloseReport}
            report={currentReport}
            darkMode={darkMode}
            meetingId={currentReportMeetingId || undefined}
            userLogin={userLogin}
          />
        )}
        {showMeetingReportModal && currentMeetingReport && (
          <MeetingReportModal
            isOpen={showMeetingReportModal}
            onClose={() => { setShowMeetingReportModal(false); setCurrentMeetingReport(null); }}
            report={currentMeetingReport}
            roomId={currentMeetingReportRoomId}
          />
        )}
      </div>
    </div>
  );
}
