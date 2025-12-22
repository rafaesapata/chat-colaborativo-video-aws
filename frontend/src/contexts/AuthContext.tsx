import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, AuthUser, LoginCredentials } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  continueAsGuest: () => void;
  isGuest: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      // Verificar se há usuário autenticado no localStorage
      const storedAuth = authService.getStoredAuth();
      if (storedAuth && storedAuth.isAuthenticated) {
        // Re-verificar role do usuário (pode ter mudado)
        const role = await authService.checkUserRole(storedAuth.login);
        const updatedUser = { ...storedAuth, role };
        setUser(updatedUser);
        // Atualizar storage com role atualizado
        authService.updateStoredRole(storedAuth.login, role);
      }
      
      // Verificar se entrou como convidado
      const guestMode = sessionStorage.getItem('videochat_guest');
      if (guestMode === 'true') {
        setIsGuest(true);
      }
      
      setIsLoading(false);
    };
    
    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const result = await authService.login(credentials);
    if (result.success) {
      const authUser: AuthUser = {
        login: credentials.login,
        isAuthenticated: true,
        token: result.token,
      };
      setUser(authUser);
      setIsGuest(false);
      sessionStorage.removeItem('videochat_guest');
    }
    return result;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setIsGuest(false);
    sessionStorage.removeItem('videochat_guest');
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    sessionStorage.setItem('videochat_guest', 'true');
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user?.isAuthenticated === true,
        isLoading,
        login,
        logout,
        continueAsGuest,
        isGuest,
        isAdmin,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
