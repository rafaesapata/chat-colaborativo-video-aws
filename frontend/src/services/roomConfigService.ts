/**
 * Serviço para gerenciar configurações de sala
 * Persiste no DynamoDB via API
 */

const API_URL = import.meta.env.VITE_CHIME_API_URL || import.meta.env.VITE_API_URL || '';

export interface RoomConfig {
  type: 'REUNIAO' | 'ENTREVISTA' | 'APRESENTACAO' | 'TREINAMENTO' | 'OUTRO';
  topic: string;
  jobDescription: string; // Descrição da vaga para entrevistas (contexto para IA)
  autoStartTranscription: boolean;
  autoStartRecording: boolean;
  allowGuestAccess: boolean;
  enableChat: boolean;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

const DEFAULT_CONFIG: RoomConfig = {
  type: 'REUNIAO',
  topic: '',
  jobDescription: '',
  autoStartTranscription: false,
  autoStartRecording: false,
  allowGuestAccess: true,
  enableChat: true,
};

/**
 * Salva configuração da sala no backend (DynamoDB)
 */
export async function saveRoomConfig(
  roomId: string,
  config: Partial<RoomConfig>,
  userLogin?: string
): Promise<{ success: boolean; config?: RoomConfig; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/room/config/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userLogin,
        config: {
          type: config.type || DEFAULT_CONFIG.type,
          topic: config.topic || '',
          jobDescription: config.jobDescription || '',
          autoStartTranscription: config.autoStartTranscription ?? false,
          autoStartRecording: config.autoStartRecording ?? false,
          allowGuestAccess: config.allowGuestAccess ?? true,
          enableChat: config.enableChat ?? true,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Erro ao salvar configuração' };
    }

    return { success: true, config: data.config };
  } catch (error: any) {
    console.error('[RoomConfig] Erro ao salvar:', error);
    return { success: false, error: error.message || 'Erro de conexão' };
  }
}

/**
 * Obtém configuração da sala do backend (DynamoDB)
 */
export async function getRoomConfig(
  roomId: string
): Promise<{ exists: boolean; config: RoomConfig; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/room/config/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { exists: false, config: DEFAULT_CONFIG, error: data.error };
    }

    return {
      exists: data.exists,
      config: data.config || DEFAULT_CONFIG,
    };
  } catch (error: any) {
    console.error('[RoomConfig] Erro ao obter:', error);
    return { exists: false, config: DEFAULT_CONFIG, error: error.message };
  }
}

export { DEFAULT_CONFIG };
