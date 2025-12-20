// Serviço para gerenciar histórico de reuniões e transcrições

export interface MeetingTranscription {
  id: string;
  text: string;
  speaker: string;
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
  userLogin: string;
  // Campos de gravação
  recordingKey?: string;
  recordingDuration?: number;
  recordingId?: string;
}

const HISTORY_STORAGE_KEY = 'videochat_meeting_history';

export const meetingHistoryService = {
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
    }
  },

  // Limpar todo o histórico de um usuário
  clearHistory(userLogin: string): void {
    localStorage.removeItem(`${HISTORY_STORAGE_KEY}_${userLogin}`);
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
};
