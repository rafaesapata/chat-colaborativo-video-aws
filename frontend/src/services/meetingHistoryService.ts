// Serviço para gerenciar histórico de reuniões e transcrições
import { ScopeSummary } from './scopeAIService';

const CHIME_API_URL = import.meta.env.VITE_CHIME_API_URL || '';

export interface MeetingTranscription {
  id: string;
  text: string;
  speaker: string;
  timestamp: number;
}

// Interface para fragmento de gravação
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
  // Campos de gravação (legado - mantido para compatibilidade)
  recordingKey?: string;
  recordingDuration?: number;
  recordingId?: string;
  // Array de fragmentos de gravação (novo)
  recordingFragments?: RecordingFragment[];
  // Campos de tipo de reunião
  meetingType?: 'ENTREVISTA' | 'ESCOPO' | 'REUNIAO' | 'TREINAMENTO' | 'OUTRO';
  meetingTopic?: string;
  jobDescription?: string;
  questionsAsked?: string[]; // Array de perguntas como strings
  // LRD para reuniões de escopo
  scopeReport?: ScopeSummary;
}

const HISTORY_STORAGE_KEY = 'videochat_meeting_history';

export const meetingHistoryService = {
  // Obter todo o histórico de um usuário
  // Obter histórico do backend (async) - FONTE PRINCIPAL
  async getHistoryAsync(userLogin: string, _forceRefresh = false): Promise<MeetingRecord[]> {
    if (!userLogin) return [];
    if (!CHIME_API_URL) {
      console.warn('[MeetingHistory] CHIME_API_URL não configurada');
      return this.getHistory(userLogin);
    }
    try {
      console.log('[MeetingHistory] Buscando histórico do backend para:', userLogin);
      const response = await fetch(`${CHIME_API_URL}/admin/history/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin, filters: { userLogin } }),
      });
      if (response.ok) {
        const data = await response.json();
        const history = (data.history || []).map((h: MeetingRecord & { meetingId?: string }) => ({
          ...h,
          id: h.meetingId || h.id,
          transcriptions: h.transcriptions || [],
        }));
        console.log('[MeetingHistory] Histórico carregado:', history.length, 'reuniões');
        return history;
      }
      console.warn('[MeetingHistory] Erro ao buscar histórico, usando localStorage');
      return this.getHistory(userLogin);
    } catch (error) {
      console.error('[MeetingHistory] Erro ao buscar histórico:', error);
      return this.getHistory(userLogin);
    }
  },

  // Obter todo o histórico de um usuário
  getHistory(userLogin: string): MeetingRecord[] {
    const stored = localStorage.getItem(`${HISTORY_STORAGE_KEY}_${userLogin}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  },

  // Salvar uma reunião no histórico
  saveMeeting(meeting: MeetingRecord): void {
    const history = this.getHistory(meeting.userLogin);
    
    // Verificar se já existe (atualizar) ou adicionar nova
    const existingIndex = history.findIndex(m => m.id === meeting.id);
    if (existingIndex >= 0) {
      history[existingIndex] = meeting;
    } else {
      history.unshift(meeting); // Adicionar no início
    }
    
    // Limitar a 50 reuniões
    const limitedHistory = history.slice(0, 50);
    
    localStorage.setItem(
      `${HISTORY_STORAGE_KEY}_${meeting.userLogin}`,
      JSON.stringify(limitedHistory)
    );
  },

  // Obter uma reunião específica
  getMeeting(userLogin: string, meetingId: string): MeetingRecord | null {
    const history = this.getHistory(userLogin);
    return history.find(m => m.id === meetingId) || null;
  },

  // Deletar uma reunião do histórico
  deleteMeeting(userLogin: string, meetingId: string): void {
    const history = this.getHistory(userLogin);
    const filtered = history.filter(m => m.id !== meetingId);
    localStorage.setItem(
      `${HISTORY_STORAGE_KEY}_${userLogin}`,
      JSON.stringify(filtered)
    );
  },

  // Adicionar transcrição a uma reunião existente
  addTranscription(
    userLogin: string,
    meetingId: string,
    transcription: MeetingTranscription
  ): void {
    const history = this.getHistory(userLogin);
    const meetingIndex = history.findIndex(m => m.id === meetingId);
    
    if (meetingIndex >= 0) {
      // Evitar duplicatas
      const exists = history[meetingIndex].transcriptions.some(
        t => t.id === transcription.id
      );
      if (!exists) {
        history[meetingIndex].transcriptions.push(transcription);
        localStorage.setItem(
          `${HISTORY_STORAGE_KEY}_${userLogin}`,
          JSON.stringify(history)
        );
      }
    }
  },

  // Criar uma nova reunião
  createMeeting(
    userLogin: string,
    roomId: string,
    participants: string[] = []
  ): MeetingRecord {
    const meeting: MeetingRecord = {
      id: `meeting_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      roomId,
      startTime: Date.now(),
      participants,
      transcriptions: [],
      userLogin,
    };
    
    this.saveMeeting(meeting);
    return meeting;
  },

  // Finalizar uma reunião
  endMeeting(userLogin: string, meetingId: string): void {
    const history = this.getHistory(userLogin);
    const meetingIndex = history.findIndex(m => m.id === meetingId);
    
    if (meetingIndex >= 0) {
      history[meetingIndex].endTime = Date.now();
      history[meetingIndex].duration = 
        history[meetingIndex].endTime! - history[meetingIndex].startTime;
      
      localStorage.setItem(
        `${HISTORY_STORAGE_KEY}_${userLogin}`,
        JSON.stringify(history)
      );
      
      // Salvar no backend de forma assíncrona
      this.saveToBackend(history[meetingIndex]).catch(err => {
        console.warn('[MeetingHistory] Erro ao salvar no backend:', err);
      });
    }
  },

  // Adicionar gravação a uma reunião (suporta múltiplos fragmentos)
  addRecording(
    userLogin: string,
    meetingId: string,
    recordingKey: string,
    recordingDuration: number,
    recordingId?: string
  ): void {
    const history = this.getHistory(userLogin);
    const meetingIndex = history.findIndex(m => m.id === meetingId);
    
    if (meetingIndex >= 0) {
      // Inicializar array de fragmentos se não existir
      if (!history[meetingIndex].recordingFragments) {
        history[meetingIndex].recordingFragments = [];
        
        // Migrar gravação legada para o array de fragmentos (se existir)
        if (history[meetingIndex].recordingKey) {
          history[meetingIndex].recordingFragments.push({
            recordingKey: history[meetingIndex].recordingKey!,
            recordingDuration: history[meetingIndex].recordingDuration || 0,
            recordingId: history[meetingIndex].recordingId,
            fragmentIndex: 0,
            timestamp: history[meetingIndex].startTime,
          });
        }
      }
      
      // Verificar se este fragmento já existe (evitar duplicatas)
      const existingFragment = history[meetingIndex].recordingFragments!.find(
        f => f.recordingKey === recordingKey
      );
      
      if (!existingFragment) {
        // Adicionar novo fragmento
        const fragmentIndex = history[meetingIndex].recordingFragments!.length;
        history[meetingIndex].recordingFragments!.push({
          recordingKey,
          recordingDuration,
          recordingId,
          fragmentIndex,
          timestamp: Date.now(),
        });
        
        console.log('[MeetingHistory] Fragmento de gravação adicionado:', {
          recordingKey,
          fragmentIndex,
          totalFragments: history[meetingIndex].recordingFragments!.length
        });
      }
      
      // Manter campos legados atualizados com o último fragmento (compatibilidade)
      history[meetingIndex].recordingKey = recordingKey;
      history[meetingIndex].recordingDuration = recordingDuration;
      if (recordingId) {
        history[meetingIndex].recordingId = recordingId;
      }
      
      localStorage.setItem(
        `${HISTORY_STORAGE_KEY}_${userLogin}`,
        JSON.stringify(history)
      );
      
      // Salvar no backend de forma assíncrona
      this.saveToBackend(history[meetingIndex]).catch(err => {
        console.warn('[MeetingHistory] Erro ao salvar gravação no backend:', err);
      });
    } else {
      console.warn('[MeetingHistory] Reunião não encontrada para adicionar gravação:', meetingId);
    }
  },

  // Obter todos os fragmentos de gravação de uma reunião
  getRecordingFragments(userLogin: string, meetingId: string): RecordingFragment[] {
    const meeting = this.getMeeting(userLogin, meetingId);
    if (!meeting) return [];
    
    // Se tem array de fragmentos, retornar
    if (meeting.recordingFragments && meeting.recordingFragments.length > 0) {
      return meeting.recordingFragments.sort((a, b) => a.fragmentIndex - b.fragmentIndex);
    }
    
    // Fallback para gravação legada
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
  },

  // Obter duração total de todas as gravações
  getTotalRecordingDuration(userLogin: string, meetingId: string): number {
    const fragments = this.getRecordingFragments(userLogin, meetingId);
    return fragments.reduce((total, f) => total + f.recordingDuration, 0);
  },

  // Limpar todo o histórico de um usuário
  clearHistory(userLogin: string): void {
    localStorage.removeItem(`${HISTORY_STORAGE_KEY}_${userLogin}`);
  },

  // Salvar LRD (Scope Report) em uma reunião e finalizar
  saveScopeReport(
    userLogin: string,
    meetingId: string,
    scopeReport: ScopeSummary
  ): void {
    const history = this.getHistory(userLogin);
    const meetingIndex = history.findIndex(m => m.id === meetingId);
    
    if (meetingIndex >= 0) {
      history[meetingIndex].scopeReport = scopeReport;
      history[meetingIndex].meetingType = 'ESCOPO';
      
      // Também finalizar a reunião para evitar condição de corrida
      if (!history[meetingIndex].endTime) {
        history[meetingIndex].endTime = Date.now();
        history[meetingIndex].duration = 
          history[meetingIndex].endTime! - history[meetingIndex].startTime;
      }
      
      localStorage.setItem(
        `${HISTORY_STORAGE_KEY}_${userLogin}`,
        JSON.stringify(history)
      );
      console.log('[MeetingHistory] LRD salva:', scopeReport.projectName);
      
      // Salvar no backend de forma assíncrona
      this.saveToBackend(history[meetingIndex]).catch(err => {
        console.warn('[MeetingHistory] Erro ao salvar LRD no backend:', err);
      });
    } else {
      console.warn('[MeetingHistory] Reunião não encontrada para salvar LRD:', meetingId);
    }
  },

  // Atualizar metadados da reunião (tipo, tópico, descrição da vaga, perguntas)
  updateMeetingMetadata(
    userLogin: string,
    meetingId: string,
    metadata: {
      meetingType?: 'ENTREVISTA' | 'ESCOPO' | 'REUNIAO' | 'TREINAMENTO' | 'OUTRO';
      meetingTopic?: string;
      jobDescription?: string;
      questionsAsked?: string[];
    }
  ): void {
    const history = this.getHistory(userLogin);
    const meetingIndex = history.findIndex(m => m.id === meetingId);
    
    if (meetingIndex >= 0) {
      if (metadata.meetingType) history[meetingIndex].meetingType = metadata.meetingType;
      if (metadata.meetingTopic) history[meetingIndex].meetingTopic = metadata.meetingTopic;
      if (metadata.jobDescription) history[meetingIndex].jobDescription = metadata.jobDescription;
      if (metadata.questionsAsked) history[meetingIndex].questionsAsked = metadata.questionsAsked;
      
      localStorage.setItem(
        `${HISTORY_STORAGE_KEY}_${userLogin}`,
        JSON.stringify(history)
      );
      console.log('[MeetingHistory] Metadados atualizados:', meetingId);
    } else {
      console.warn('[MeetingHistory] Reunião não encontrada para atualizar metadados:', meetingId);
    }
  },

  // Obter reuniões de escopo com LRD
  getScopeReports(userLogin: string): MeetingRecord[] {
    const history = this.getHistory(userLogin);
    return history.filter(m => m.meetingType === 'ESCOPO' && m.scopeReport);
  },

  // Atualizar tipo e tópico da reunião
  updateMeetingInfo(
    userLogin: string,
    meetingId: string,
    meetingType: MeetingRecord['meetingType'],
    meetingTopic?: string
  ): void {
    const history = this.getHistory(userLogin);
    const meetingIndex = history.findIndex(m => m.id === meetingId);
    
    if (meetingIndex >= 0) {
      history[meetingIndex].meetingType = meetingType;
      if (meetingTopic) {
        history[meetingIndex].meetingTopic = meetingTopic;
      }
      
      localStorage.setItem(
        `${HISTORY_STORAGE_KEY}_${userLogin}`,
        JSON.stringify(history)
      );
    }
  },

  // Exportar transcrições de uma reunião como texto
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
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        return `[${time}] ${t.speaker}: ${t.text}`;
      })
      .join('\n');
    
    return header + date + duration + separator + transcriptions;
  },

  // Obter todos os históricos de todos os usuários (para admin)
  getAllUsersHistory(): MeetingRecord[] {
    const allMeetings: MeetingRecord[] = [];
    
    // Iterar por todas as chaves do localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(HISTORY_STORAGE_KEY)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const meetings: MeetingRecord[] = JSON.parse(data);
            allMeetings.push(...meetings);
          }
        } catch (error) {
          console.warn('[MeetingHistory] Erro ao ler histórico:', key, error);
        }
      }
    }
    
    // Ordenar por data mais recente
    return allMeetings.sort((a, b) => b.startTime - a.startTime);
  },

  // Salvar histórico no backend (DynamoDB)
  async saveToBackend(meeting: MeetingRecord): Promise<boolean> {
    if (!CHIME_API_URL) {
      console.warn('[MeetingHistory] CHIME_API_URL não configurada');
      return false;
    }

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
        console.log('[MeetingHistory] Histórico salvo no backend:', meeting.id);
        return true;
      } else {
        console.warn('[MeetingHistory] Erro ao salvar no backend:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('[MeetingHistory] Erro ao salvar no backend:', error);
      return false;
    }
  },

  // Buscar histórico do backend (admin)
  async getAdminHistory(userLogin: string, filters?: {
    userLogin?: string;
    meetingType?: string;
    startDate?: number;
    endDate?: number;
  }): Promise<{ history: MeetingRecord[]; uniqueUsers: string[] }> {
    if (!CHIME_API_URL) {
      console.warn('[MeetingHistory] CHIME_API_URL não configurada');
      return { history: [], uniqueUsers: [] };
    }

    try {
      const response = await fetch(`${CHIME_API_URL}/admin/history/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userLogin,
          filters,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Mapear meetingId para id para compatibilidade
        const history = (data.history || []).map((h: any) => ({
          ...h,
          id: h.meetingId || h.id,
        }));
        return { 
          history, 
          uniqueUsers: data.uniqueUsers || [] 
        };
      } else {
        console.warn('[MeetingHistory] Erro ao buscar histórico do backend:', await response.text());
        return { history: [], uniqueUsers: [] };
      }
    } catch (error) {
      console.error('[MeetingHistory] Erro ao buscar histórico do backend:', error);
      return { history: [], uniqueUsers: [] };
    }
  },
};
