import { useState } from 'react';

interface DebugPanelProps {
  wsUrl: string;
  isConnected: boolean;
  roomId: string;
  userId: string;
  transcriptionEnabled: boolean;
  messagesCount: number;
  transcriptionsCount: number;
}

export default function DebugPanel({
  wsUrl,
  isConnected,
  roomId,
  userId,
  transcriptionEnabled,
  messagesCount,
  transcriptionsCount
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-card-dark text-white px-3 py-2 rounded-lg shadow-lg text-xs font-mono hover:bg-white/10 transition z-50"
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-surface-dark text-white p-4 rounded-lg shadow-2xl max-w-md z-50 font-mono text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">🐛 Debug Panel</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-muted-dark hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <div className="border-b border-border-dark pb-2">
          <div className="text-muted-dark">WebSocket URL:</div>
          <div className="text-green-400 break-all">{wsUrl || '❌ NÃO DEFINIDO'}</div>
        </div>

        <div className="border-b border-border-dark pb-2">
          <div className="text-muted-dark">Status:</div>
          <div className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? '✅ CONECTADO' : '❌ DESCONECTADO'}
          </div>
        </div>

        <div className="border-b border-border-dark pb-2">
          <div className="text-muted-dark">Room ID:</div>
          <div className="text-blue-400">{roomId}</div>
        </div>

        <div className="border-b border-border-dark pb-2">
          <div className="text-muted-dark">User ID:</div>
          <div className="text-primary-300">{userId}</div>
        </div>

        <div className="border-b border-border-dark pb-2">
          <div className="text-muted-dark">Transcrição:</div>
          <div className={transcriptionEnabled ? 'text-green-400' : 'text-muted-light'}>
            {transcriptionEnabled ? '🎤 ATIVA' : '⏸️ INATIVA'}
          </div>
        </div>

        <div className="border-b border-border-dark pb-2">
          <div className="text-muted-dark">Mensagens:</div>
          <div className="text-yellow-400">{messagesCount}</div>
        </div>

        <div className="pb-2">
          <div className="text-muted-dark">Transcrições:</div>
          <div className="text-yellow-400">{transcriptionsCount}</div>
        </div>

        <div className="pt-2 border-t border-border-dark">
          <div className="text-muted-dark text-[10px]">
            Abra o Console (F12) para ver logs detalhados
          </div>
        </div>
      </div>
    </div>
  );
}
