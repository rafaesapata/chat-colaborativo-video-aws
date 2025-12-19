import { useEffect, useRef } from 'react';

interface Transcription {
  transcriptionId: string;
  userId: string;
  transcribedText: string;
  timestamp: number;
  speakerLabel?: string;
  isPartial?: boolean;
}

interface Props {
  transcriptions: Transcription[];
  speakingUsers: Set<string>;
}

export default function LiveTranscription({ transcriptions, speakingUsers }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const recentTranscriptions = transcriptions.slice(-10);

  useEffect(() => {
    console.log('[LiveTranscription] Transcrições atualizadas:', transcriptions.length);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions]);

  useEffect(() => {
    console.log('[LiveTranscription] Componente montado');
    return () => console.log('[LiveTranscription] Componente desmontado');
  }, []);

  const getUserName = (userId: string) => {
    return `Usuário ${userId.substring(userId.length - 4)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getUserColor = (userId: string) => {
    const colors = [
      'text-blue-600',
      'text-purple-600',
      'text-green-600',
      'text-orange-600',
      'text-pink-600',
      'text-indigo-600',
    ];
    const index = userId.charCodeAt(userId.length - 1) % colors.length;
    return colors[index];
  };

  return (
    <div className="h-full flex flex-col bg-white p-4">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
        <h3 className="font-bold text-base flex items-center gap-2">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Transcrições
          <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
            {transcriptions.length}
          </span>
        </h3>
        {speakingUsers.size > 0 && (
          <div className="flex items-center gap-1 text-xs text-green-600 animate-pulse">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>Gravando</span>
          </div>
        )}
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar"
      >
        {recentTranscriptions.map((trans) => {
          const isSpeaking = speakingUsers.has(trans.userId);
          const userColor = getUserColor(trans.userId);
          
          return (
            <div 
              key={trans.transcriptionId} 
              className={`text-sm p-3 rounded-lg transition-all duration-200 ${
                trans.isPartial 
                  ? 'bg-yellow-50 border border-yellow-200' 
                  : 'bg-white border border-gray-200 shadow-sm'
              } ${isSpeaking ? 'ring-2 ring-green-400' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {isSpeaking && (
                    <span className="animate-pulse">🎤</span>
                  )}
                  <span className={`font-semibold ${userColor}`}>
                    {trans.speakerLabel || getUserName(trans.userId)}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTimestamp(trans.timestamp)}
                </span>
              </div>
              <p className={`text-gray-700 leading-relaxed ${
                trans.isPartial ? 'italic text-gray-500' : ''
              }`}>
                {trans.transcribedText || '(sem texto)'}
                {trans.isPartial && (
                  <span className="ml-1 text-yellow-600">...</span>
                )}
              </p>
            </div>
          );
        })}
        
        {transcriptions.length === 0 && (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-gray-400 text-sm font-semibold mb-2">
              Nenhuma transcrição ainda
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left text-xs space-y-2">
              <p className="font-semibold text-blue-900">💡 Como testar:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Clique no botão <span className="font-bold">🧪 Testar Transcrição</span> (roxo, canto inferior direito)</li>
                <li>Clique em "▶️ Adicionar Todas"</li>
                <li>Veja as transcrições aparecerem aqui!</li>
              </ol>
            </div>
          </div>
        )}
        
        {transcriptions.length > 0 && transcriptions.every(t => !t.transcribedText) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold text-yellow-900 mb-1">⚠️ Transcrições sem texto</p>
                <p className="text-yellow-700 text-xs">
                  As transcrições estão sendo criadas mas sem conteúdo. 
                  Use o botão <span className="font-bold">🧪 Testar Transcrição</span> para adicionar textos de exemplo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
}
