import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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
      className={`fixed right-0 top-0 h-full w-90 z-50 transition-transform duration-350 cubic-bezier(0.4, 0, 0.2, 1) ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${darkMode ? 'bg-gray-800 border-l border-gray-700' : 'bg-white border-l border-gray-200'}`}
    >
      {/* Header */}
      <div className={`h-16 flex items-center justify-between px-5 border-b ${
        darkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Chat
        </h2>
        <button
          onClick={onClose}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150 hover:rotate-90 ${
            darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100% - 128px)' }}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`animate-message-enter ${message.isOwn ? 'flex justify-end' : 'flex justify-start'}`}
          >
            <div className={`max-w-xs ${message.isOwn ? 'order-2' : 'order-1'}`}>
              {!message.isOwn && (
                <div className={`text-xs mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {message.author}
                </div>
              )}
              <div
                className={`px-3 py-2 rounded-lg text-sm ${
                  message.isOwn
                    ? 'bg-blue-500 text-white'
                    : darkMode
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.text}
              </div>
              <div className={`text-xs mt-1 opacity-60 ${
                message.isOwn ? 'text-right' : 'text-left'
              } ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {message.time}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite uma mensagem..."
            className={`w-full h-11 pl-4 pr-12 rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              darkMode
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
            }`}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className={`absolute right-1 top-1 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 ${
              inputText.trim()
                ? 'bg-blue-500 text-white hover:scale-110 active:scale-90'
                : darkMode
                ? 'bg-gray-600 text-gray-400'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            <Send size={16} style={{ transform: 'rotate(-45deg)' }} />
          </button>
        </div>
      </div>


    </div>
  );
}