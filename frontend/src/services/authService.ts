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
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
}

const AUTH_STORAGE_KEY = 'videochat_auth';
const USER_NAME_PREFIX = 'videochat_username_';

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
        
        // SEC-002: Validar estrutura do token
        const token = data.token;
        if (token && token !== 'authenticated') {
          const parts = token.split('.');
          if (parts.length !== 3) {
            console.warn('[Auth] Token inválido recebido');
          }
        }
        
        const authUser: AuthUser = {
          login: credentials.login,
          isAuthenticated: true,
          token: token || 'authenticated',
        };
        // ✅ Usar secureStorage
        secureStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        return { success: true, token: data.token };
      } else {
        return { success: false, message: 'Credenciais inválidas' };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, message: 'Erro ao conectar com o servidor' };
    }
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
