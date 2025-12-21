import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Users, Video, Trash2, UserX, RefreshCw, 
  Clock, Server, Activity, ArrowLeft, AlertTriangle,
  ChevronDown, ChevronUp, UserPlus, Crown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const CHIME_API_URL = import.meta.env.VITE_CHIME_API_URL || '';

interface Attendee {
  attendeeId: string;
  name: string;
  odUserId: string;
}

interface Room {
  roomId: string;
  meetingId: string;
  createdBy: string;
  createdAt: number;
  attendeeCount: number;
  attendees: Attendee[];
  mediaRegion: string;
}

interface Stats {
  totalRooms: number;
  totalAttendees: number;
  roomsByRegion: Record<string, number>;
  averageAttendeesPerRoom: string;
  serverTime: string;
  config: {
    region: string;
    meetingTtlHours: number;
    rateLimitRequests: number;
    isProduction: boolean;
  };
}

interface AdminUsers {
  admins: string[];
  superAdmins: string[];
  canManageAdmins: boolean;
  currentUser: string;
}

interface AdminPanelProps {
  darkMode: boolean;
}

export default function AdminPanel({ darkMode }: AdminPanelProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newAdminInput, setNewAdminInput] = useState('');
  const [activeTab, setActiveTab] = useState<'rooms' | 'admins'>('rooms');
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.login) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [roomsRes, statsRes, adminsRes] = await Promise.all([
        fetch(`${CHIME_API_URL}/admin/rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userLogin: user.login }),
        }),
        fetch(`${CHIME_API_URL}/admin/stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userLogin: user.login }),
        }),
        fetch(`${CHIME_API_URL}/admin/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userLogin: user.login }),
        }),
      ]);

      if (!roomsRes.ok || !statsRes.ok) {
        const errorData = await roomsRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Acesso negado');
      }

      const roomsData = await roomsRes.json();
      const statsData = await statsRes.json();
      const adminsData = adminsRes.ok ? await adminsRes.json() : null;

      setRooms(roomsData.rooms || []);
      setStats(statsData.stats || null);
      setAdminUsers(adminsData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [user?.login]);

  useEffect(() => {
    if (isAuthenticated && user?.login) {
      fetchData();
    }
  }, [isAuthenticated, user?.login, fetchData]);

  const handleEndRoom = async (roomId: string, meetingId: string) => {
    if (!confirm(`Tem certeza que deseja encerrar a sala ${roomId}?`)) return;
    
    setActionLoading(roomId);
    try {
      const res = await fetch(`${CHIME_API_URL}/admin/room/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin: user?.login, roomId, meetingId }),
      });

      if (!res.ok) throw new Error('Falha ao encerrar sala');
      
      setRooms(prev => prev.filter(r => r.roomId !== roomId));
    } catch (err) {
      alert('Erro ao encerrar sala');
    } finally {
      setActionLoading(null);
    }
  };

  const handleKickUser = async (meetingId: string, attendeeId: string, userName: string) => {
    if (!confirm(`Remover ${userName} da sala?`)) return;
    
    setActionLoading(attendeeId);
    try {
      const res = await fetch(`${CHIME_API_URL}/admin/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin: user?.login, meetingId, attendeeId }),
      });

      if (!res.ok) throw new Error('Falha ao remover usuário');
      
      // Atualizar lista local
      setRooms(prev => prev.map(room => {
        if (room.meetingId === meetingId) {
          return {
            ...room,
            attendees: room.attendees.filter(a => a.attendeeId !== attendeeId),
            attendeeCount: room.attendeeCount - 1
          };
        }
        return room;
      }));
    } catch (err) {
      alert('Erro ao remover usuário');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAddAdmin = async () => {
    if (!newAdminInput.trim()) return;
    
    setActionLoading('add-admin');
    try {
      const res = await fetch(`${CHIME_API_URL}/admin/users/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin: user?.login, newAdmin: newAdminInput.trim() }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || 'Falha ao adicionar admin');
        return;
      }
      
      setAdminUsers(prev => prev ? { ...prev, admins: data.admins } : null);
      setNewAdminInput('');
    } catch (err) {
      alert('Erro ao adicionar administrador');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveAdmin = async (adminToRemove: string) => {
    if (!confirm(`Remover ${adminToRemove} dos administradores?`)) return;
    
    setActionLoading(adminToRemove);
    try {
      const res = await fetch(`${CHIME_API_URL}/admin/users/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin: user?.login, adminToRemove }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || 'Falha ao remover admin');
        return;
      }
      
      setAdminUsers(prev => prev ? { ...prev, admins: data.admins } : null);
    } catch (err) {
      alert('Erro ao remover administrador');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanup = async (dryRun = false) => {
    if (!dryRun && !confirm('Executar limpeza de salas abandonadas?')) return;
    
    setActionLoading('cleanup');
    setCleanupResult(null);
    try {
      const res = await fetch(`${CHIME_API_URL}/admin/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin: user?.login, dryRun }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || 'Falha ao executar limpeza');
        return;
      }
      
      setCleanupResult(data.message);
      if (!dryRun) {
        fetchData(); // Recarregar dados após limpeza
      }
    } catch (err) {
      alert('Erro ao executar limpeza');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-yellow-500" />
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Acesso Restrito
          </h2>
          <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Faça login para acessar o painel administrativo
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Fazer Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-800/90' : 'bg-white/90'} backdrop-blur-lg border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="text-red-500" size={24} />
              <h1 className="text-xl font-bold">Painel Administrativo</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCleanup(true)}
              disabled={actionLoading === 'cleanup'}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                darkMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-500 hover:bg-orange-600'
              } text-white ${actionLoading === 'cleanup' ? 'opacity-50' : ''}`}
              title="Limpar salas abandonadas"
            >
              <Trash2 size={16} />
              Cleanup
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
              } ${loading ? 'opacity-50' : ''}`}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {cleanupResult && (
          <div className={`mb-6 p-4 rounded-xl flex items-center justify-between ${
            darkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'
          } border`}>
            <span className={darkMode ? 'text-green-300' : 'text-green-700'}>{cleanupResult}</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleCleanup(false)}
                className={`px-3 py-1 rounded text-sm ${
                  darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                } text-white`}
              >
                Executar
              </button>
              <button
                onClick={() => setCleanupResult(null)}
                className={`px-3 py-1 rounded text-sm ${
                  darkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-300 hover:bg-gray-400'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 flex items-center gap-3">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
                  <Video size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Salas Ativas</p>
                  <p className="text-2xl font-bold">{stats.totalRooms}</p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-green-900/50' : 'bg-green-100'}`}>
                  <Users size={20} className="text-green-500" />
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Participantes</p>
                  <p className="text-2xl font-bold">{stats.totalAttendees}</p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
                  <Activity size={20} className="text-purple-500" />
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Média/Sala</p>
                  <p className="text-2xl font-bold">{stats.averageAttendeesPerRoom}</p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-orange-900/50' : 'bg-orange-100'}`}>
                  <Server size={20} className="text-orange-500" />
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Região</p>
                  <p className="text-2xl font-bold">{stats.config.region}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className={`flex gap-2 mb-6 p-1 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'rooms'
                ? darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow'
                : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Video size={18} />
            Salas
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'admins'
                ? darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow'
                : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Shield size={18} />
            Administradores
          </button>
        </div>

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
        <div className={`rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Video size={20} />
              Salas Ativas ({rooms.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw size={32} className="mx-auto mb-4 animate-spin text-blue-500" />
              <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Carregando...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="p-8 text-center">
              <Video size={48} className={`mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Nenhuma sala ativa no momento</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {rooms.map(room => (
                <div key={room.roomId} className={`${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                  <div 
                    className="px-6 py-4 cursor-pointer"
                    onClick={() => setExpandedRoom(expandedRoom === room.roomId ? null : room.roomId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-sm px-2 py-1 rounded ${
                            darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {room.roomId}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                            darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                          }`}>
                            <Users size={12} />
                            {room.attendeeCount}
                          </span>
                          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {room.mediaRegion}
                          </span>
                        </div>
                        <div className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            Criada em {formatDate(room.createdAt)} por {room.createdBy}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEndRoom(room.roomId, room.meetingId);
                          }}
                          disabled={actionLoading === room.roomId}
                          className={`p-2 rounded-lg transition ${
                            darkMode 
                              ? 'hover:bg-red-900/50 text-red-400' 
                              : 'hover:bg-red-100 text-red-500'
                          } ${actionLoading === room.roomId ? 'opacity-50' : ''}`}
                          title="Encerrar sala"
                        >
                          <Trash2 size={18} />
                        </button>
                        {expandedRoom === room.roomId ? (
                          <ChevronUp size={20} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                        ) : (
                          <ChevronDown size={20} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Attendees List */}
                  {expandedRoom === room.roomId && room.attendees.length > 0 && (
                    <div className={`px-6 pb-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <p className={`text-sm font-medium mt-3 mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Participantes:
                      </p>
                      <div className="space-y-2">
                        {room.attendees.map(attendee => (
                          <div 
                            key={attendee.attendeeId}
                            className={`flex items-center justify-between p-2 rounded-lg ${
                              darkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                darkMode ? 'bg-gray-600' : 'bg-gray-300'
                              }`}>
                                <Users size={14} />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{attendee.name}</p>
                                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {attendee.odUserId}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleKickUser(room.meetingId, attendee.attendeeId, attendee.name)}
                              disabled={actionLoading === attendee.attendeeId}
                              className={`p-1.5 rounded-lg transition ${
                                darkMode 
                                  ? 'hover:bg-red-900/50 text-red-400' 
                                  : 'hover:bg-red-100 text-red-500'
                              } ${actionLoading === attendee.attendeeId ? 'opacity-50' : ''}`}
                              title="Remover usuário"
                            >
                              <UserX size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Admins Tab */}
        {activeTab === 'admins' && (
          <div className={`rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield size={20} />
                Gerenciar Administradores
              </h2>
            </div>

            {/* Add Admin Form */}
            {adminUsers?.canManageAdmins && (
              <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAdminInput}
                    onChange={(e) => setNewAdminInput(e.target.value)}
                    placeholder="Email ou login do novo admin"
                    className={`flex-1 px-4 py-2 rounded-lg border ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin()}
                  />
                  <button
                    onClick={handleAddAdmin}
                    disabled={actionLoading === 'add-admin' || !newAdminInput.trim()}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                      darkMode 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    } ${(actionLoading === 'add-admin' || !newAdminInput.trim()) ? 'opacity-50' : ''}`}
                  >
                    <UserPlus size={18} />
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            {/* Admin List */}
            <div className="divide-y divide-gray-700">
              {adminUsers?.admins.map(admin => {
                const isSuperAdmin = adminUsers.superAdmins.includes(admin.toLowerCase());
                const isCurrentUser = admin.toLowerCase() === adminUsers.currentUser?.toLowerCase();
                const canRemove = adminUsers.canManageAdmins && !isSuperAdmin && !isCurrentUser;
                
                return (
                  <div 
                    key={admin}
                    className={`px-6 py-3 flex items-center justify-between ${
                      darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isSuperAdmin 
                          ? 'bg-yellow-500/20 text-yellow-500' 
                          : darkMode ? 'bg-gray-600' : 'bg-gray-200'
                      }`}>
                        {isSuperAdmin ? <Crown size={18} /> : <Users size={18} />}
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {admin}
                          {isCurrentUser && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                            }`}>
                              Você
                            </span>
                          )}
                        </p>
                        <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {isSuperAdmin ? 'Super Administrador' : 'Administrador'}
                        </p>
                      </div>
                    </div>
                    {canRemove && (
                      <button
                        onClick={() => handleRemoveAdmin(admin)}
                        disabled={actionLoading === admin}
                        className={`p-2 rounded-lg transition ${
                          darkMode 
                            ? 'hover:bg-red-900/50 text-red-400' 
                            : 'hover:bg-red-100 text-red-500'
                        } ${actionLoading === admin ? 'opacity-50' : ''}`}
                        title="Remover admin"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {!adminUsers?.canManageAdmins && (
              <div className={`px-6 py-4 ${darkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
                <p className={`text-sm flex items-center gap-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  <AlertTriangle size={16} />
                  Apenas super administradores podem adicionar ou remover outros admins.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Server Info */}
        {stats && (
          <div className={`mt-6 p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Server size={16} />
              Informações do Servidor
            </h3>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <div>
                <span className="block text-xs uppercase opacity-60">Ambiente</span>
                <span className={stats.config.isProduction ? 'text-green-500' : 'text-yellow-500'}>
                  {stats.config.isProduction ? 'Produção' : 'Desenvolvimento'}
                </span>
              </div>
              <div>
                <span className="block text-xs uppercase opacity-60">TTL Reuniões</span>
                {stats.config.meetingTtlHours}h
              </div>
              <div>
                <span className="block text-xs uppercase opacity-60">Rate Limit</span>
                {stats.config.rateLimitRequests} req/min
              </div>
              <div>
                <span className="block text-xs uppercase opacity-60">Hora do Servidor</span>
                {new Date(stats.serverTime).toLocaleTimeString('pt-BR')}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
