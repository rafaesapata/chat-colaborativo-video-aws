import { useState } from 'react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  roomId: string;
  participants: string[];
  currentUserId: string;
  onlineCount: number;
}

export default function Sidebar({ 
  isCollapsed, 
  onToggleCollapse, 
  roomId,
  participants,
  currentUserId,
  onlineCount 
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const getInitials = (userId: string) => {
    return userId.substring(userId.length - 2).toUpperCase();
  };

  const getStatusColor = (userId: string) => {
    // Simular status - em produção viria do WebSocket
    return userId === currentUserId ? 'bg-green-500' : 'bg-gray-400';
  };

  return (
    <aside 
      className={`bg-slate-800 text-slate-100 transition-all duration-300 ease-in-out flex flex-col ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-700">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold">
              C
            </div>
            <span className="font-bold text-lg">CHAT CORP</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-slate-700 rounded-lg transition"
          title={isCollapsed ? 'Expandir' : 'Colapsar'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="p-3">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 text-slate-100 pl-10 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="p-2 flex justify-center">
          <button className="p-2 hover:bg-slate-700 rounded-lg transition">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      )}

      {/* Sala Atual */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          {!isCollapsed && (
            <div className="text-xs font-semibold text-slate-400 mb-2">SALA ATUAL</div>
          )}
          <div className={`flex items-center gap-3 p-2 bg-blue-600 rounded-lg ${isCollapsed ? 'justify-center' : ''}`}>
            {isCollapsed ? (
              <div className="relative">
                <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center text-xs font-bold">
                  #
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full"></div>
              </div>
            ) : (
              <>
                <div className="text-xl">#</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-sm">
                    {roomId.replace('room_', '')}
                  </div>
                  <div className="text-xs text-blue-200">
                    {onlineCount} online
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Participantes */}
        <div className="p-3">
          {!isCollapsed && (
            <div className="text-xs font-semibold text-slate-400 mb-2">
              PARTICIPANTES ({participants.length})
            </div>
          )}
          <div className="space-y-1">
            {participants.map((userId) => (
              <div
                key={userId}
                className={`flex items-center gap-3 p-2 hover:bg-slate-700 rounded-lg transition cursor-pointer ${
                  isCollapsed ? 'justify-center' : ''
                }`}
                title={isCollapsed ? `Usuário ${userId.substring(userId.length - 4)}` : ''}
              >
                {isCollapsed ? (
                  <div className="relative">
                    <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-xs font-semibold">
                      {getInitials(userId)}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getStatusColor(userId)} rounded-full border-2 border-slate-800`}></div>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center text-sm font-semibold">
                        {getInitials(userId)}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getStatusColor(userId)} rounded-full border-2 border-slate-800`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">
                        {userId === currentUserId ? 'Você' : `Usuário ${userId.substring(userId.length - 4)}`}
                      </div>
                      <div className="text-xs text-slate-400">
                        {userId === currentUserId ? 'Online' : 'Ativo'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-slate-700">
        <div className={`flex items-center gap-3 p-2 hover:bg-slate-700 rounded-lg transition cursor-pointer ${
          isCollapsed ? 'justify-center' : ''
        }`}>
          {isCollapsed ? (
            <div className="relative">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">
                  Usuário {currentUserId.substring(currentUserId.length - 4)}
                </div>
                <div className="text-xs text-green-400">
                  🟢 Online
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
