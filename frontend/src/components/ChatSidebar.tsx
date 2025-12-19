import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

interface Message {
  id: string;
  author: string;
  text: string;
  time: string;
  isOwn?: boolean;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (text: string) => void;
  darkMode: boolean;
}

export default function ChatSidebar({ isOpen, onClose, messages, onSendMessage, darkMode }: ChatSidebarProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useMobile();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Pequeno delay no mobile para evitar problemas com teclado virtual
      setTimeout(() => inputRef.current?.focus(), isMobile ? 300 : 0);
    }
  }, [isOpen, isMobile]);

  const handleSendMessage = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full z-50 transition-transform duration-350 cubic-bezier(0.4, 0, 0.2, 1) backdrop-blur-xl ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${isMobile ? 'w-full' : 'w-90'} ${darkMode 
        ? 'bg-gray-900/40 border-l border-white/10' 
        : 'bg-white/40 border-l border-white/20'
      }`}
      style={{ 
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)'
      }}
    >
      {/* Header */}
      <div className={`${isMobile ? 'h-14' : 'h-16'} flex items-center justify-between px-4 border-b ${
        darkMode ? 'border-white/10' : 'border-black/5'
      }`}>
        <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Chat
        </h2>
        <button
          onClick={onClose}
          className={`${isMobile ? 'w-9 h-9' : 'w-10 h-10'} rounded-lg flex items-center justify-center transition-all duration-150 hover:rotate-90 ${
            darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <X size={isMobile ? 18 : 20} />
        </button>
      </div>

      {/* Messages */}
      <div 
        className={`flex-1 overflow-y-auto ${isMobile ? 'p-3' : 'p-4'} space-y-3`} 
        style={{ height: `calc(100% - ${isMobile ? '112px' : '128px'})` }}
      >
        {messages.length === 0 ? (
          <div className={`text-center py-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <svg className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} mx-auto mb-3 opacity-50`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'}`}>Nenhuma mensagem ainda</p>
            <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} mt-1 opacity-75`}>Seja o primeiro a enviar!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`animate-message-enter ${message.isOwn ? 'flex justify-end' : 'flex justify-start'}`}
            >
              <div className={`max-w-[85%] ${message.isOwn ? 'order-2' : 'order-1'}`}>
                {/* Nome do autor - sempre visível */}
                <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium mb-1 ${
                  message.isOwn 
                    ? 'text-right text-blue-400' 
                    : darkMode ? 'text-purple-400' : 'text-indigo-600'
                }`}>
                  {message.isOwn ? 'Você' : message.author || 'Usuário'}
                </div>
                <div
                  className={`${isMobile ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'} rounded-2xl ${
                    message.isOwn
                      ? 'bg-blue-500 text-white rounded-br-md'
                      : darkMode
                      ? 'bg-gray-700 text-white rounded-bl-md'
                      : 'bg-gray-100 text-gray-900 rounded-bl-md'
                  }`}
                >
                  {message.text}
                </div>
                <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} mt-1 opacity-60 ${
                  message.isOwn ? 'text-right' : 'text-left'
                } ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {message.time}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`${isMobile ? 'p-3' : 'p-4'} border-t ${darkMode ? 'border-white/10' : 'border-black/5'}`}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite uma mensagem..."
            className={`w-full ${isMobile ? 'h-10 pl-3 pr-10 text-sm' : 'h-11 pl-4 pr-12'} rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              darkMode
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
            }`}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className={`absolute right-1 top-1 ${isMobile ? 'w-8 h-8' : 'w-9 h-9'} rounded-full flex items-center justify-center transition-all duration-150 ${
              inputText.trim()
                ? 'bg-blue-500 text-white hover:scale-110 active:scale-90'
                : darkMode
                ? 'bg-gray-600 text-gray-400'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            <Send size={isMobile ? 14 : 16} style={{ transform: 'rotate(-45deg)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}