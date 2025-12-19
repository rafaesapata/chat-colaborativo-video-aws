import { useEffect, useRef } from 'react';

interface Message {
  messageId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  type: string;
}

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  speakingUsers: Set<string>;
}

export default function MessageList({ messages, currentUserId, speakingUsers }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (userId: string) => {
    return userId.substring(userId.length - 2).toUpperCase();
  };

  const getUserColor = (userId: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500',
    ];
    const index = userId.charCodeAt(userId.length - 1) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg font-medium">Nenhuma mensagem ainda</p>
          <p className="text-sm">Seja o primeiro a enviar uma mensagem!</p>
        </div>
      )}

      {messages.map((message) => {
        const isOwn = message.userId === currentUserId;
        const isSpeaking = speakingUsers.has(message.userId);

        return (
          <div
            key={message.messageId}
            className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className={`relative w-10 h-10 rounded-full ${getUserColor(message.userId)} flex items-center justify-center text-white font-semibold text-sm ${
                isSpeaking ? 'ring-4 ring-green-400 ring-opacity-50' : ''
              }`}>
                {getInitials(message.userId)}
                {isSpeaking && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-lg ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-700">
                  {isOwn ? 'Você' : message.userName}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(message.timestamp)}
                </span>
              </div>
              <div
                className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                  isOwn
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white text-gray-800 rounded-tl-sm'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
}
