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
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-mono hover:bg-gray-700 transition z-50"
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-2xl max-w-md z-50 font-mono text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">🐛 Debug Panel</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <div className="border-b border-gray-700 pb-2">
          <div className="text-gray-400">WebSocket URL:</div>
          <div className="text-green-400 break-all">{wsUrl || '❌ NÃO DEFINIDO'}</div>
        </div>

        <div className="border-b border-gray-700 pb-2">
          <div className="text-gray-400">Status:</div>
          <div className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? '✅ CONECTADO' : '❌ DESCONECTADO'}
          </div>
        </div>

        <div className="border-b border-gray-700 pb-2">
          <div className="text-gray-400">Room ID:</div>
          <div className="text-blue-400">{roomId}</div>
        </div>

        <div className="border-b border-gray-700 pb-2">
          <div className="text-gray-400">User ID:</div>
          <div className="text-purple-400">{userId}</div>
        </div>

        <div className="border-b border-gray-700 pb-2">
          <div className="text-gray-400">Transcrição:</div>
          <div className={transcriptionEnabled ? 'text-green-400' : 'text-gray-500'}>
            {transcriptionEnabled ? '🎤 ATIVA' : '⏸️ INATIVA'}
          </div>
        </div>

        <div className="border-b border-gray-700 pb-2">
          <div className="text-gray-400">Mensagens:</div>
          <div className="text-yellow-400">{messagesCount}</div>
        </div>

        <div className="pb-2">
          <div className="text-gray-400">Transcrições:</div>
          <div className="text-yellow-400">{transcriptionsCount}</div>
        </div>

        <div className="pt-2 border-t border-gray-700">
          <div className="text-gray-400 text-[10px]">
            Abra o Console (F12) para ver logs detalhados
          </div>
        </div>
      </div>
    </div>
  );
}
