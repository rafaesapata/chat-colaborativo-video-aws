import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import MeetingRoom from './components/MeetingRoom';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';

// Configurar Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || ''
    }
  }
});

function HomePage() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);

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

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
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
              onClick={toggleDarkMode}
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
        </div>

        <div className={`mt-8 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <p>🔒 Seguro • 🚀 Rápido • 🌐 Gratuito</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { toasts, dismissToast } = useToast();

  return (
    <div>
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/meeting/:roomId" element={<MeetingRoom darkMode={false} />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;