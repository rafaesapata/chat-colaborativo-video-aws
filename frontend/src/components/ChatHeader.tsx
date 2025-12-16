interface ChatHeaderProps {
  roomId: string;
  onlineCount: number;
  isConnected: boolean;
  onCopyLink: () => void;
  transcriptionEnabled: boolean;
  onToggleTranscription: () => void;
}

export default function ChatHeader({
  roomId,
  onlineCount,
  isConnected,
  onCopyLink,
  transcriptionEnabled,
  onToggleTranscription
}: ChatHeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xl text-gray-600">#</span>
          <h1 className="text-lg font-semibold text-gray-800">
            {roomId.replace('room_', '')}
          </h1>
          <span className={`ml-2 w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Sala de vídeo conferência • {onlineCount} participantes online
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTranscription}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            transcriptionEnabled
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={transcriptionEnabled ? 'Parar transcrição' : 'Iniciar transcrição'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          {transcriptionEnabled ? 'Gravando' : 'Transcrever'}
        </button>

        <button
          onClick={onCopyLink}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
          title="Copiar link da sala"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Compartilhar
        </button>

        <button
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Mais opções"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
