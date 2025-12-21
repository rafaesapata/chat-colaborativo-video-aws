// Serviço de autenticação com o backoffice
import { secureStorage } from '../utils/secureStorage';

export interface LoginCredentials {
  login: string;
  password: string;
}

export interface AuthUser {
  login: string;
  isAuthenticated: boolean;
  token?: string;
  role?: 'user' | 'admin' | 'superadmin';
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
}

const AUTH_STORAGE_KEY = 'videochat_auth';
const USER_NAME_PREFIX = 'videochat_username_';
const CHIME_API_URL = import.meta.env.VITE_CHIME_API_URL || import.meta.env.VITE_API_URL || '';

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await fetch('https://backoffice.udstec.io/Account/Login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        
        // SEC-002: Validar estrutura do token (se for JWT)
        const token = data.token;
        if (token && typeof token === 'string' && token !== 'authenticated') {
          const parts = token.split('.');
          if (parts.length !== 3) {
            console.warn('[Auth] Token não é JWT padrão');
          }
        }
        
        // Verificar role do usuário no backend de video chat
        const role = await this.checkUserRole(credentials.login);
        
        const authUser: AuthUser = {
          login: credentials.login,
          isAuthenticated: true,
          token: typeof token === 'string' ? token : 'authenticated',
          role,
        };
        // ✅ Usar secureStorage
        secureStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        return { success: true, token: typeof token === 'string' ? token : undefined };
      } else {
        return { success: false, message: 'Credenciais inválidas' };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, message: 'Erro ao conectar com o servidor' };
    }
  },

  async checkUserRole(userLogin: string): Promise<'user' | 'admin' | 'superadmin'> {
    try {
      const response = await fetch(`${CHIME_API_URL}/admin/check-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.role || 'user';
      }
    } catch (error) {
      console.warn('[Auth] Erro ao verificar role:', error);
    }
    return 'user';
  },

  logout(): void {
    // ✅ Usar secureStorage
    secureStorage.removeItem(AUTH_STORAGE_KEY);
  },

  getStoredAuth(): AuthUser | null {
    // ✅ Usar secureStorage
    const stored = secureStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  },

  isAuthenticated(): boolean {
    const auth = this.getStoredAuth();
    return auth?.isAuthenticated === true;
  },

  // Salvar nome preferido do usuário autenticado
  saveUserName(login: string, name: string): void {
    if (login && name) {
      // ✅ Usar secureStorage
      secureStorage.setItem(`${USER_NAME_PREFIX}${login}`, name);
    }
  },

  // Recuperar nome preferido do usuário autenticado
  getSavedUserName(login: string): string | null {
    if (!login) return null;
    // ✅ Usar secureStorage
    return secureStorage.getItem(`${USER_NAME_PREFIX}${login}`);
  },
};
