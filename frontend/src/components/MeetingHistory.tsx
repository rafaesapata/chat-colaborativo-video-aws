import { useState, useEffect } from 'react';
import { X, Clock, Users, FileText, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { meetingHistoryService, MeetingRecord } from '../services/meetingHistoryService';

interface MeetingHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  userLogin: string;
  darkMode: boolean;
}

export default function MeetingHistory({ isOpen, onClose, userLogin, darkMode }: MeetingHistoryProps) {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userLogin) {
      const history = meetingHistoryService.getHistory(userLogin);
      setMeetings(history);
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
      <div className={`relative w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden ${
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
        <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
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
                        {meeting.transcriptions.length > 0 && (
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
      </div>
    </div>
  );
}
