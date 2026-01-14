import { useState, useEffect } from 'react';
import { X, Clock, Users, FileText, Trash2, Download, ChevronDown, ChevronUp, Play, Video, Brain } from 'lucide-react';
import { meetingHistoryService, MeetingRecord, RecordingFragment } from '../services/meetingHistoryService';
import { getRecordingPlaybackUrl } from '../hooks/useRecording';
import { interviewAIService, InterviewContext, InterviewReport } from '../services/interviewAIService';
import InterviewReportModal from './InterviewReportModal';

interface MeetingHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  userLogin: string;
  darkMode: boolean;
}

export default function MeetingHistory({ isOpen, onClose, userLogin, darkMode }: MeetingHistoryProps) {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [currentFragmentIndex, setCurrentFragmentIndex] = useState(0);
  const [currentFragments, setCurrentFragments] = useState<RecordingFragment[]>([]);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentReport, setCurrentReport] = useState<InterviewReport | null>(null);

  useEffect(() => {
    if (isOpen && userLogin) {
      console.log('[MeetingHistory] Carregando histórico do backend para:', userLogin);
      setMeetings([]); // Limpar enquanto carrega
      meetingHistoryService.getHistoryAsync(userLogin, true)
        .then((history: MeetingRecord[]) => {
          console.log('[MeetingHistory] Reuniões carregadas do backend:', history.length);
          setMeetings(history);
        })
        .catch((err: Error) => {
          console.error('[MeetingHistory] Erro ao carregar histórico:', err);
        });
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

  const handlePlayRecording = async (meeting: MeetingRecord, fragmentIndex: number = 0) => {
    // Obter todos os fragmentos da reunião
    const fragments = meetingHistoryService.getRecordingFragments(userLogin, meeting.id);
    
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
      setShowReportModal(true);
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden ${
        darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock size={24} className={darkMode ? 'text-purple-400' : 'text-indigo-600'} />
            Histórico de Reuniões
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition hover:rotate-90 ${
              darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-4">
          {meetings.length === 0 ? (
            <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Clock size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhuma reunião encontrada</p>
              <p className="text-sm mt-1">Suas reuniões com transcrições aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map(meeting => (
                <div
                  key={meeting.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    darkMode 
                      ? 'bg-gray-700/50 border-gray-600 hover:border-purple-500/50' 
                      : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {/* Meeting Header */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedMeeting(
                      expandedMeeting === meeting.id ? null : meeting.id
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-mono text-sm px-2 py-0.5 rounded ${
                            darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {meeting.roomId}
                          </span>
                          {meeting.recordingKey && (
                            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                              darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
                            }`}>
                              <Video size={12} />
                              {(() => {
                                const fragments = meetingHistoryService.getRecordingFragments(userLogin, meeting.id);
                                const totalDuration = meetingHistoryService.getTotalRecordingDuration(userLogin, meeting.id);
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
                        </div>
                        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {formatDate(meeting.startTime)}
                        </p>
                        <div className={`flex items-center gap-4 mt-2 text-xs ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
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
                      <div className="flex items-center gap-2">
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
                                  ? 'hover:bg-purple-900/50 text-purple-400 hover:text-purple-300' 
                                  : 'hover:bg-purple-100 text-purple-500 hover:text-purple-600'
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
                                  ? 'hover:bg-gray-600 text-gray-400 hover:text-white' 
                                  : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
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
                              ? 'hover:bg-red-900/50 text-gray-400 hover:text-red-400' 
                              : 'hover:bg-red-100 text-gray-500 hover:text-red-600'
                          }`}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                        {expandedMeeting === meeting.id ? (
                          <ChevronUp size={20} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                        ) : (
                          <ChevronDown size={20} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Transcriptions */}
                  {expandedMeeting === meeting.id && meeting.transcriptions.length > 0 && (
                    <div className={`border-t p-4 ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                      <h4 className={`text-sm font-semibold mb-3 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Transcrições
                      </h4>
                      <div className={`max-h-60 overflow-y-auto space-y-2 rounded-lg p-3 ${
                        darkMode ? 'bg-gray-800' : 'bg-white'
                      }`}>
                        {meeting.transcriptions
                          .sort((a, b) => a.timestamp - b.timestamp)
                          .map(t => (
                            <div key={t.id} className="text-sm">
                              <span className={`font-medium ${
                                darkMode ? 'text-purple-400' : 'text-indigo-600'
                              }`}>
                                {t.speaker}
                              </span>
                              <span className={`text-xs ml-2 ${
                                darkMode ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                {new Date(t.timestamp).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                                {t.text}
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
              darkMode ? 'bg-gray-900' : 'bg-black'
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
          />
        )}
      </div>
    </div>
  );
}
