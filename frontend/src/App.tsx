import { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { useToast } from './hooks/useToast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Lazy load componentes pesados
const MeetingRoom = lazy(() => import('./components/MeetingRoom'));
const PreviewScreen = lazy(() => import('./components/PreviewScreen'));
const LoginScreen = lazy(() => import('./components/LoginScreen'));
const MeetingHistory = lazy(() => import('./components/MeetingHistory'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

// Loading fallback
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
    <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full"></div>
  </div>
);

// Configurar Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || ''
    }
  }
});

interface HomePageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

function HomePage({ darkMode, onToggleDarkMode }: HomePageProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isGuest, user, logout } = useAuth();
  const [showHistory, setShowHistory] = useState(false);

  const createRoom = () => {
    const newRoomId = 'room_' + Math.random().toString(36).substring(2, 11);
    navigate(`/meeting/${newRoomId}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const roomIdInput = (e.target as HTMLFormElement).roomId.value;
    if (roomIdInput) {
      navigate(`/meeting/${roomIdInput}`);
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900' 
        : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600'
    } flex items-center justify-center p-4`}>
      <div className={`backdrop-blur-sm rounded-3xl shadow-2xl p-8 max-w-md w-full border transition-all duration-300 ${
        darkMode 
          ? 'bg-gray-800/95 border-gray-700/50' 
          : 'bg-white/95 border-white/20'
      }`}>
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all duration-300 ${
            darkMode 
              ? 'bg-gradient-to-r from-purple-500 to-violet-600' 
              : 'bg-gradient-to-r from-indigo-500 to-purple-600'
          }`}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          
          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className={`text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${
              darkMode 
                ? 'from-purple-400 to-violet-400' 
                : 'from-indigo-600 to-purple-600'
            }`}>
              Video Chat
            </h1>
            
            <button
              onClick={onToggleDarkMode}
              className={`p-2 rounded-lg transition-all duration-200 ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              title={darkMode ? 'Modo claro' : 'Modo escuro'}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Status de autenticação */}
          {isAuthenticated && (
            <div className={`flex items-center justify-center gap-2 mb-2 ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Logado como {user?.login}</span>
            </div>
          )}
          {isGuest && (
            <div className={`flex items-center justify-center gap-2 mb-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Modo Convidado</span>
            </div>
          )}
          
          <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
            Conecte-se com qualquer pessoa, em qualquer lugar
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={createRoom}
            className={`w-full py-4 rounded-xl transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
              darkMode 
                ? 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Criar Nova Sala
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className={`px-4 font-medium ${
                darkMode 
                  ? 'bg-gray-800 text-gray-400' 
                  : 'bg-white text-gray-500'
              }`}>ou</span>
            </div>
          </div>

          <form onSubmit={joinRoom} className="space-y-3">
            <input
              type="text"
              name="roomId"
              placeholder="Digite o código da sala"
              className={`w-full px-4 py-3 rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 ${
                darkMode 
                  ? 'border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-purple-500 focus:bg-gray-600' 
                  : 'border border-gray-200 bg-gray-50 focus:ring-indigo-500 focus:bg-white'
              }`}
              required
            />
            <button
              type="submit"
              className={`w-full py-3 rounded-xl transition-all duration-200 font-semibold flex items-center justify-center gap-2 border-2 ${
                darkMode 
                  ? 'bg-gray-800 text-purple-400 border-purple-600 hover:border-purple-500 hover:bg-gray-700' 
                  : 'bg-white text-indigo-600 border-indigo-600 hover:border-indigo-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Entrar na Sala
            </button>
          </form>

          {/* Funcionalidades exclusivas para usuários autenticados */}
          {isAuthenticated && (
            <div className={`mt-6 p-4 rounded-xl border ${
              darkMode 
                ? 'bg-purple-900/30 border-purple-700/50' 
                : 'bg-indigo-50 border-indigo-200'
            }`}>
              <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
                darkMode ? 'text-purple-300' : 'text-indigo-700'
              }`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Recursos Exclusivos
              </h3>
              <div className="space-y-2">
                <button 
                  onClick={() => setShowHistory(true)}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    darkMode 
                      ? 'bg-purple-800/50 hover:bg-purple-800 text-purple-200' 
                      : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Histórico de Reuniões
                </button>
              </div>
            </div>
          )}

          {/* Modal de Histórico */}
          {isAuthenticated && user?.login && (
            <MeetingHistory
              isOpen={showHistory}
              onClose={() => setShowHistory(false)}
              userLogin={user.login}
              darkMode={darkMode}
            />
          )}

          {/* Botão de logout ou login */}
          <div className="pt-4">
            {isAuthenticated ? (
              <button
                onClick={logout}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  darkMode 
                    ? 'text-red-400 hover:bg-red-900/30' 
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair da Conta
              </button>
            ) : isGuest ? (
              <button
                onClick={logout}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  darkMode 
                    ? 'text-purple-400 hover:bg-purple-900/30' 
                    : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Fazer Login
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente wrapper para verificar se o usuário tem nome
function MeetingWrapper({ darkMode }: { darkMode: boolean }) {
  // Verificar nome em sessionStorage ao invés de URL
  const userName = sessionStorage.getItem('videochat_user_name');
  
  // Se não tem nome, mostrar tela de preview com câmera/mic
  if (!userName) {
    return <PreviewScreen darkMode={darkMode} />;
  }
  
  // Se tem nome, mostrar a sala
  return <MeetingRoom darkMode={darkMode} />;
}

// Componente que gerencia a autenticação na rota principal
function AuthenticatedRoutes() {
  const [darkMode, setDarkMode] = useState(false);
  const { isAuthenticated, isGuest, isLoading } = useAuth();

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode 
          ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900' 
          : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600'
      }`}>
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Se não está autenticado e não é convidado, mostrar tela de login
  if (!isAuthenticated && !isGuest) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LoginScreen darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
      </Suspense>
    );
  }

  // Se está autenticado ou é convidado, mostrar as rotas normais
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<HomePage darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
        <Route path="/meeting/:roomId" element={<MeetingWrapper darkMode={darkMode} />} />
        <Route path="/admin" element={<AdminPanel darkMode={darkMode} />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const { toasts, dismissToast } = useToast();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toast toasts={toasts} onDismiss={dismissToast} />
        <BrowserRouter>
          <AuthenticatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
