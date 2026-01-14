/**
 * Serviço para gerenciar vagas de emprego por usuário
 * Cada usuário logado tem suas próprias vagas cadastradas
 */

const API_URL = import.meta.env.VITE_CHIME_API_URL || '';

export interface JobPosition {
  id: string;
  title: string;           // Ex: "Desenvolvedor Full Stack Senior"
  description: string;     // Descrição completa da vaga
  requirements?: string;   // Requisitos técnicos
  level?: 'junior' | 'pleno' | 'senior' | 'especialista' | 'lead';
  department?: string;     // Ex: "Tecnologia", "Produto"
  createdAt: number;
  updatedAt: number;
}

export interface JobPositionInput {
  title: string;
  description: string;
  requirements?: string;
  level?: 'junior' | 'pleno' | 'senior' | 'especialista' | 'lead';
  department?: string;
}

// Cache local das vagas
let cachedPositions: JobPosition[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 30000; // 30 segundos

/**
 * Lista todas as vagas do usuário
 */
export async function listJobPositions(userLogin: string, forceRefresh = false): Promise<JobPosition[]> {
  if (!userLogin) {
    console.warn('[JobPositionService] userLogin é obrigatório');
    return [];
  }

  const now = Date.now();
  
  // Usar cache se ainda válido
  if (!forceRefresh && now - lastFetchTime < CACHE_TTL_MS && cachedPositions.length > 0) {
    return cachedPositions;
  }

  try {
    const response = await fetch(`${API_URL}/jobs/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userLogin }),
    });

    if (!response.ok) {
      console.error('[JobPositionService] Erro ao listar vagas:', response.status);
      return cachedPositions; // Retornar cache em caso de erro
    }

    const result = await response.json();
    
    if (result.positions) {
      cachedPositions = result.positions;
      lastFetchTime = now;
    }

    return cachedPositions;
  } catch (error) {
    console.error('[JobPositionService] Erro ao listar vagas:', error);
    return cachedPositions;
  }
}

/**
 * Cria uma nova vaga
 */
export async function createJobPosition(
  userLogin: string,
  position: JobPositionInput
): Promise<{ success: boolean; position?: JobPosition; error?: string }> {
  if (!userLogin) {
    return { success: false, error: 'userLogin é obrigatório' };
  }

  if (!position.title?.trim()) {
    return { success: false, error: 'Título da vaga é obrigatório' };
  }

  if (!position.description?.trim()) {
    return { success: false, error: 'Descrição da vaga é obrigatória' };
  }

  try {
    const response = await fetch(`${API_URL}/jobs/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userLogin,
        position: {
          title: position.title.trim(),
          description: position.description.trim(),
          requirements: position.requirements?.trim() || '',
          level: position.level || 'pleno',
          department: position.department?.trim() || '',
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Erro ao criar vaga' };
    }

    // Invalidar cache
    lastFetchTime = 0;

    return { success: true, position: result.position };
  } catch (error: any) {
    console.error('[JobPositionService] Erro ao criar vaga:', error);
    return { success: false, error: error.message || 'Erro de conexão' };
  }
}

/**
 * Atualiza uma vaga existente
 */
export async function updateJobPosition(
  userLogin: string,
  positionId: string,
  updates: Partial<JobPositionInput>
): Promise<{ success: boolean; position?: JobPosition; error?: string }> {
  if (!userLogin || !positionId) {
    return { success: false, error: 'userLogin e positionId são obrigatórios' };
  }

  try {
    const response = await fetch(`${API_URL}/jobs/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userLogin,
        positionId,
        updates,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Erro ao atualizar vaga' };
    }

    // Invalidar cache
    lastFetchTime = 0;

    return { success: true, position: result.position };
  } catch (error: any) {
    console.error('[JobPositionService] Erro ao atualizar vaga:', error);
    return { success: false, error: error.message || 'Erro de conexão' };
  }
}

/**
 * Remove uma vaga
 */
export async function deleteJobPosition(
  userLogin: string,
  positionId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userLogin || !positionId) {
    return { success: false, error: 'userLogin e positionId são obrigatórios' };
  }

  try {
    const response = await fetch(`${API_URL}/jobs/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userLogin,
        positionId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Erro ao remover vaga' };
    }

    // Invalidar cache
    lastFetchTime = 0;

    return { success: true };
  } catch (error: any) {
    console.error('[JobPositionService] Erro ao remover vaga:', error);
    return { success: false, error: error.message || 'Erro de conexão' };
  }
}

/**
 * Obtém uma vaga específica pelo ID
 */
export async function getJobPosition(
  userLogin: string,
  positionId: string
): Promise<JobPosition | null> {
  if (!userLogin || !positionId) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/jobs/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userLogin,
        positionId,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.position || null;
  } catch (error) {
    console.error('[JobPositionService] Erro ao obter vaga:', error);
    return null;
  }
}

/**
 * Limpa o cache local
 */
export function clearJobPositionsCache(): void {
  cachedPositions = [];
  lastFetchTime = 0;
}
