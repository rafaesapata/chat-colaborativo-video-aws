import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface NameEntryProps {
  darkMode: boolean;
}

export default function NameEntry({ darkMode }: NameEntryProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsLoading(true);
    
    // Redirecionar para a sala com o nome como parâmetro
    navigate(`/meeting/${roomId}?name=${encodeURIComponent(name.trim())}`);
  };

  const handleGoHome = () => {
    navigate('/');
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          
          <h1 className={`text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent mb-2 ${
            darkMode 
              ? 'from-purple-400 to-violet-400' 
              : 'from-indigo-600 to-purple-600'
          }`}>
            Entrar na Sala
          </h1>
          
          <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Como você gostaria de ser chamado?
          </p>
          
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Sala: <span className="font-mono font-semibold">{roomId}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome"
              className={`w-full px-4 py-4 rounded-xl text-lg focus:ring-2 focus:border-transparent transition-all duration-200 ${
                darkMode 
                  ? 'border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-purple-500 focus:bg-gray-600' 
                  : 'border border-gray-200 bg-gray-50 focus:ring-indigo-500 focus:bg-white'
              }`}
              required
              maxLength={50}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className={`w-full py-4 rounded-xl transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                darkMode 
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white disabled:hover:from-purple-600 disabled:hover:to-violet-600' 
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:hover:from-indigo-600 disabled:hover:to-purple-600'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Entrando...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Entrar na Sala
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleGoHome}
              disabled={isLoading}
              className={`w-full py-3 rounded-xl transition-all duration-200 font-semibold flex items-center justify-center gap-2 border-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                darkMode 
                  ? 'bg-gray-800 text-purple-400 border-purple-600 hover:border-purple-500 hover:bg-gray-700 disabled:hover:bg-gray-800 disabled:hover:border-purple-600' 
                  : 'bg-white text-indigo-600 border-indigo-600 hover:border-indigo-700 hover:bg-gray-50 disabled:hover:bg-white disabled:hover:border-indigo-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Voltar ao Início
            </button>
          </div>
        </form>

        <div className={`mt-8 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <p>🔒 Seu nome será visível para outros participantes</p>
        </div>
      </div>
    </div>
  );
}