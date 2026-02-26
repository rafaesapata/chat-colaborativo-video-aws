// Serviço para gerenciar histórico de reuniões - Backend DynamoDB como fonte de verdade
// Sem localStorage - usa Map em memória como buffer durante reunião ativa
import { ScopeSummary } from './scopeAIService';

const CHIME_API_URL = import.meta.env.VITE_CHIME_API_URL || '';

export interface MeetingTranscription {
  id: string;
  text: string;
  speaker: string;
  timestamp: number;
}

export interface RecordingFragment {
  recordingKey: string;
  recordingDuration: number;
  recordingId?: string;
  fragmentIndex: number;
  timestamp: number;
}

export interface MeetingRecord {
  id: string;
  roomId: string;
  roomName?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  participants: string[];
  transcriptions: MeetingTranscription[];
  transcriptionCount?: number;
  userLogin: string;
  recordingKey?: string;
  recordingDuration?: number;
  recordingId?: string;
  recordingFragments?: RecordingFragment[];
  meetingType?: 'ENTREVISTA' | 'ESCOPO' | 'REUNIAO' | 'TREINAMENTO' | 'OUTRO';
  meetingTopic?: string;
  jobDescription?: string;
  questionsAsked?: string[];
  scopeReport?: ScopeSummary;
}

// Buffer em memória para reuniões ativas (durante a sessão)
const activeMeetings = new Map<string, MeetingRecord>();

export const meetingHistoryService = {
  // Buscar histórico do backend (fonte principal)
  async getHistory(userLogin: string): Promise<MeetingRecord[]> {
    if (!userLogin || !CHIME_API_URL) return [];
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/history/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin, filters: { userLogin } }),
      });
      if (response.ok) {
        const data = await response.json();
        return (data.history || []).map((h: MeetingRecord & { meetingId?: string }) => ({
          ...h,
          id: h.meetingId || h.id,
          transcriptions: h.transcriptions || [],
        }));
      }
      console.warn('[MeetingHistory] Erro ao buscar histórico:', response.status);
      return [];
    } catch (error) {
      console.error('[MeetingHistory] Erro ao buscar histórico:', error);
      return [];
    }
  },

  // Alias para compatibilidade
  async getHistoryAsync(userLogin: string, _forceRefresh = false): Promise<MeetingRecord[]> {
    return this.getHistory(userLogin);
  },

  // Criar reunião (buffer em memória + salvar no backend)
  createMeeting(userLogin: string, roomId: string, participants: string[] = []): MeetingRecord {
    const meeting: MeetingRecord = {
      id: `meeting_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      roomId,
      startTime: Date.now(),
      participants,
      transcriptions: [],
      userLogin,
    };
    activeMeetings.set(meeting.id, meeting);
    // Salvar no backend imediatamente (fire-and-forget)
    this.saveToBackend(meeting).catch(err =>
      console.warn('[MeetingHistory] Erro ao salvar reunião criada:', err)
    );
    return meeting;
  },

  // Obter reunião ativa do buffer em memória
  getActiveMeeting(meetingId: string): MeetingRecord | null {
    return activeMeetings.get(meetingId) || null;
  },

  // Adicionar transcrição à reunião ativa
  addTranscription(userLogin: string, meetingId: string, transcription: MeetingTranscription): void {
    const meeting = activeMeetings.get(meetingId);
    if (!meeting) return;
    const exists = meeting.transcriptions.some(t => t.id === transcription.id);
    if (!exists) {
      meeting.transcriptions.push(transcription);
    }
  },

  // Atualizar metadados da reunião ativa
  updateMeetingMetadata(userLogin: string, meetingId: string, metadata: {
    meetingType?: MeetingRecord['meetingType'];
    meetingTopic?: string;
    jobDescription?: string;
    questionsAsked?: string[];
  }): void {
    const meeting = activeMeetings.get(meetingId);
    if (!meeting) return;
    if (metadata.meetingType) meeting.meetingType = metadata.meetingType;
    if (metadata.meetingTopic) meeting.meetingTopic = metadata.meetingTopic;
    if (metadata.jobDescription) meeting.jobDescription = metadata.jobDescription;
    if (metadata.questionsAsked) meeting.questionsAsked = metadata.questionsAsked;
  },

  // Adicionar gravação à reunião ativa
  addRecording(userLogin: string, meetingId: string, recordingKey: string, recordingDuration: number, recordingId?: string): void {
    const meeting = activeMeetings.get(meetingId);
    if (!meeting) {
      console.warn('[MeetingHistory] Reunião não encontrada para adicionar gravação:', meetingId);
      return;
    }
    if (!meeting.recordingFragments) meeting.recordingFragments = [];
    const exists = meeting.recordingFragments.find(f => f.recordingKey === recordingKey);
    if (!exists) {
      meeting.recordingFragments.push({
        recordingKey,
        recordingDuration,
        recordingId,
        fragmentIndex: meeting.recordingFragments.length,
        timestamp: Date.now(),
      });
    }
    meeting.recordingKey = recordingKey;
    meeting.recordingDuration = recordingDuration;
    if (recordingId) meeting.recordingId = recordingId;
    // Salvar gravação no backend imediatamente
    this.saveToBackend(meeting).catch(err =>
      console.warn('[MeetingHistory] Erro ao salvar gravação no backend:', err)
    );
  },

  // Finalizar reunião (salvar no backend e limpar buffer)
  endMeeting(userLogin: string, meetingId: string): void {
    const meeting = activeMeetings.get(meetingId);
    if (!meeting) return;
    meeting.endTime = Date.now();
    meeting.duration = meeting.endTime - meeting.startTime;
    this.saveToBackend(meeting).then(() => {
      activeMeetings.delete(meetingId);
    }).catch(err => {
      console.warn('[MeetingHistory] Erro ao salvar reunião finalizada:', err);
      activeMeetings.delete(meetingId);
    });
  },

  // Salvar LRD (Scope Report) e finalizar
  saveScopeReport(userLogin: string, meetingId: string, scopeReport: ScopeSummary): void {
    const meeting = activeMeetings.get(meetingId);
    if (!meeting) {
      console.warn('[MeetingHistory] Reunião não encontrada para salvar LRD:', meetingId);
      return;
    }
    meeting.scopeReport = scopeReport;
    meeting.meetingType = 'ESCOPO';
    if (!meeting.endTime) {
      meeting.endTime = Date.now();
      meeting.duration = meeting.endTime - meeting.startTime;
    }
    this.saveToBackend(meeting).then(() => {
      activeMeetings.delete(meetingId);
    }).catch(err => {
      console.warn('[MeetingHistory] Erro ao salvar LRD no backend:', err);
      activeMeetings.delete(meetingId);
    });
  },

  // Deletar reunião do backend
  async deleteMeeting(userLogin: string, meetingId: string): Promise<void> {
    if (!CHIME_API_URL) return;
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/history/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin, meetingId }),
      });
      if (!response.ok) {
        console.warn('[MeetingHistory] Erro ao deletar:', response.status);
      }
    } catch (error) {
      console.error('[MeetingHistory] Erro ao deletar reunião:', error);
    }
  },

  // Exportar transcrições como texto
  exportTranscriptions(meeting: MeetingRecord): string {
    const header = `Reunião: ${meeting.roomId}\n`;
    const date = `Data: ${new Date(meeting.startTime).toLocaleString('pt-BR')}\n`;
    const duration = meeting.duration
      ? `Duração: ${Math.round(meeting.duration / 60000)} minutos\n`
      : '';
    const separator = '─'.repeat(50) + '\n\n';
    const transcriptions = meeting.transcriptions
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(t => {
        const time = new Date(t.timestamp).toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        return `[${time}] ${t.speaker}: ${t.text}`;
      })
      .join('\n');
    return header + date + duration + separator + transcriptions;
  },

  // Buscar histórico do backend (admin)
  async getAdminHistory(userLogin: string, filters?: {
    userLogin?: string;
    meetingType?: string;
    startDate?: number;
    endDate?: number;
  }): Promise<{ history: MeetingRecord[]; uniqueUsers: string[] }> {
    if (!CHIME_API_URL) return { history: [], uniqueUsers: [] };
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/history/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin, filters }),
      });
      if (response.ok) {
        const data = await response.json();
        const history = (data.history || []).map((h: any) => ({
          ...h,
          id: h.meetingId || h.id,
        }));
        return { history, uniqueUsers: data.uniqueUsers || [] };
      }
      console.warn('[MeetingHistory] Erro ao buscar histórico admin:', response.status);
      return { history: [], uniqueUsers: [] };
    } catch (error) {
      console.error('[MeetingHistory] Erro ao buscar histórico admin:', error);
      return { history: [], uniqueUsers: [] };
    }
  },

  // Salvar no backend (DynamoDB)
  async saveToBackend(meeting: MeetingRecord): Promise<boolean> {
    if (!CHIME_API_URL) return false;
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/history/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userLogin: meeting.userLogin,
          meetingId: meeting.id,
          roomId: meeting.roomId,
          roomName: meeting.roomName || meeting.roomId,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          duration: meeting.duration,
          participants: meeting.participants,
          transcriptions: meeting.transcriptions,
          meetingType: meeting.meetingType,
          meetingTopic: meeting.meetingTopic,
          jobDescription: meeting.jobDescription,
          questionsAsked: meeting.questionsAsked,
          recordingKey: meeting.recordingKey,
          recordingDuration: meeting.recordingDuration,
          recordingId: meeting.recordingId,
          recordingFragments: meeting.recordingFragments,
        }),
      });
      if (response.ok) {
        console.log('[MeetingHistory] Salvo no backend:', meeting.id);
        return true;
      }
      console.warn('[MeetingHistory] Erro ao salvar no backend:', await response.text());
      return false;
    } catch (error) {
      console.error('[MeetingHistory] Erro ao salvar no backend:', error);
      return false;
    }
  },
};
