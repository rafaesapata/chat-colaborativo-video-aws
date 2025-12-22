/**
 * Serviço para persistir dados de entrevista no DynamoDB
 * Inclui sugestões de IA, perguntas feitas e avaliações
 */

import { InterviewSuggestion, QuestionAnswer } from './interviewAIService';

const API_URL = import.meta.env.VITE_CHIME_API_URL || import.meta.env.VITE_API_URL || '';

export interface InterviewData {
  roomId: string;
  suggestions: InterviewSuggestion[];
  questionsAsked: QuestionAnswer[];
  lastUpdated: number;
  createdBy?: string;
}

/**
 * Salva dados da entrevista no DynamoDB
 */
export async function saveInterviewData(
  roomId: string,
  data: {
    suggestions: InterviewSuggestion[];
    questionsAsked: QuestionAnswer[];
  },
  userLogin?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/interview/data/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userLogin,
        suggestions: data.suggestions,
        questionsAsked: data.questionsAsked,
        lastUpdated: Date.now(),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Erro ao salvar dados da entrevista' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[InterviewData] Erro ao salvar:', error);
    return { success: false, error: error.message || 'Erro de conexão' };
  }
}

/**
 * Obtém dados da entrevista do DynamoDB
 */
export async function getInterviewData(
  roomId: string
): Promise<{ exists: boolean; data?: InterviewData; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/interview/data/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { exists: false, error: result.error };
    }

    return {
      exists: result.exists,
      data: result.data,
    };
  } catch (error: any) {
    console.error('[InterviewData] Erro ao obter:', error);
    return { exists: false, error: error.message };
  }
}

/**
 * Limpa dados da entrevista do DynamoDB
 */
export async function clearInterviewData(
  roomId: string,
  userLogin?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/interview/data/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userLogin }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Erro ao limpar dados' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[InterviewData] Erro ao limpar:', error);
    return { success: false, error: error.message };
  }
}
