/**
 * Serviço para gerenciar backgrounds personalizados
 * Os backgrounds são armazenados no localStorage e sincronizados entre usuários
 */

export interface CustomBackground {
  id: string;
  name: string;
  url: string;
  preview: string;
  s3Key?: string;
  createdBy: string;
  createdAt: number;
  isActive: boolean;
}

const STORAGE_KEY = 'videochat_custom_backgrounds';
const CHIME_API_URL = import.meta.env.VITE_CHIME_API_URL || '';

export const backgroundService = {
  // Obter backgrounds do servidor (para todos os usuários autenticados)
  async getBackgrounds(): Promise<CustomBackground[]> {
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/backgrounds`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Salvar localmente para cache
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.backgrounds || []));
        return data.backgrounds || [];
      }
    } catch (error) {
      console.warn('[BackgroundService] Erro ao buscar backgrounds do servidor');
    }
    
    // Fallback para localStorage
    return this.getLocalBackgrounds();
  },

  // Obter backgrounds do localStorage (cache)
  getLocalBackgrounds(): CustomBackground[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignorar erro de parse
    }
    return [];
  },

  // Obter URL pré-assinada para upload
  async getUploadUrl(
    userLogin: string,
    filename: string,
    contentType: string
  ): Promise<{ success: boolean; uploadUrl?: string; s3Key?: string; publicUrl?: string; error?: string }> {
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/backgrounds/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin, filename, contentType }),
      });

      const data = await response.json();
      
      if (response.ok) {
        return { 
          success: true, 
          uploadUrl: data.uploadUrl, 
          s3Key: data.s3Key,
          publicUrl: data.publicUrl 
        };
      }
      
      return { success: false, error: data.error || 'Erro ao obter URL de upload' };
    } catch (error) {
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  },

  // Upload de arquivo para S3
  async uploadFile(
    uploadUrl: string,
    file: File
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (response.ok) {
        return { success: true };
      }
      
      return { success: false, error: 'Erro ao fazer upload do arquivo' };
    } catch (error) {
      return { success: false, error: 'Erro de conexão durante upload' };
    }
  },

  // Adicionar novo background (apenas admin) - com upload de arquivo
  async addBackgroundWithFile(
    userLogin: string,
    name: string,
    file: File
  ): Promise<{ success: boolean; background?: CustomBackground; error?: string }> {
    try {
      // 1. Obter URL de upload
      const uploadUrlResult = await this.getUploadUrl(userLogin, file.name, file.type);
      if (!uploadUrlResult.success || !uploadUrlResult.uploadUrl) {
        return { success: false, error: uploadUrlResult.error || 'Erro ao obter URL de upload' };
      }

      // 2. Fazer upload do arquivo
      const uploadResult = await this.uploadFile(uploadUrlResult.uploadUrl, file);
      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error || 'Erro no upload' };
      }

      // 3. Registrar background no banco
      const response = await fetch(`${CHIME_API_URL}/admin/backgrounds/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userLogin, 
          name, 
          s3Key: uploadUrlResult.s3Key 
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Atualizar cache local
        const backgrounds = this.getLocalBackgrounds();
        backgrounds.push(data.background);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(backgrounds));
        return { success: true, background: data.background };
      }
      
      return { success: false, error: data.error || 'Erro ao registrar background' };
    } catch (error) {
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  },

  // Adicionar novo background via URL (apenas admin)
  async addBackground(
    userLogin: string,
    name: string,
    url: string
  ): Promise<{ success: boolean; background?: CustomBackground; error?: string }> {
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/backgrounds/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin, name, url }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Atualizar cache local
        const backgrounds = this.getLocalBackgrounds();
        backgrounds.push(data.background);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(backgrounds));
        return { success: true, background: data.background };
      }
      
      return { success: false, error: data.error || 'Erro ao adicionar background' };
    } catch (error) {
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  },

  // Remover background (apenas admin)
  async removeBackground(
    userLogin: string,
    backgroundId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/backgrounds/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin, backgroundId }),
      });

      if (response.ok) {
        // Atualizar cache local
        const backgrounds = this.getLocalBackgrounds();
        const filtered = backgrounds.filter(b => b.id !== backgroundId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        return { success: true };
      }
      
      const data = await response.json();
      return { success: false, error: data.error || 'Erro ao remover background' };
    } catch (error) {
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  },

  // Toggle ativo/inativo (apenas admin)
  async toggleBackground(
    userLogin: string,
    backgroundId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/backgrounds/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin, backgroundId, isActive }),
      });

      if (response.ok) {
        // Atualizar cache local
        const backgrounds = this.getLocalBackgrounds();
        const updated = backgrounds.map(b => 
          b.id === backgroundId ? { ...b, isActive } : b
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return { success: true };
      }
      
      const data = await response.json();
      return { success: false, error: data.error || 'Erro ao atualizar background' };
    } catch (error) {
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  },

  // Validar URL de imagem
  async validateImageUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      // Timeout de 5 segundos
      setTimeout(() => resolve(false), 5000);
    });
  },

  // Gerar preview da imagem (thumbnail)
  generatePreview(url: string): string {
    // Para URLs do Unsplash, podemos usar parâmetros de redimensionamento
    if (url.includes('unsplash.com')) {
      return url.replace(/w=\d+/, 'w=100').replace(/h=\d+/, 'h=60');
    }
    return url;
  },
};
