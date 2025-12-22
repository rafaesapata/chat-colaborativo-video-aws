import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Users, Video, Trash2, UserX, RefreshCw, 
  Clock, Server, Activity, ArrowLeft, AlertTriangle,
  ChevronDown, ChevronUp, UserPlus, Crown, Calendar,
  Key, Copy, Eye, EyeOff, Plus, ExternalLink, FileText,
  Image, ToggleLeft, ToggleRight, Check, X as XIcon, Brain
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { backgroundService, CustomBackground } from '../services/backgroundService';
import InterviewAIConfigPanel from './InterviewAIConfigPanel';

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

interface ScheduledMeeting {
  scheduleId: string;
  title: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  createdBy: string;
  roomId: string;
  meetingUrl: string;
  participants: string[];
  status: string;
}

interface ApiKey {
  keyId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  isActive: boolean;
  permissions: string[];
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
  const [activeTab, setActiveTab] = useState<'rooms' | 'admins' | 'schedule' | 'apikeys' | 'backgrounds' | 'interviewai'>('rooms');
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  
  // Schedule state
  const [scheduledMeetings, setScheduledMeetings] = useState<ScheduledMeeting[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    description: '',
    scheduledAt: '',
    duration: 60,
    participants: '',
  });
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Backgrounds state
  const [customBackgrounds, setCustomBackgrounds] = useState<CustomBackground[]>([]);
  const [showBackgroundForm, setShowBackgroundForm] = useState(false);
  const [backgroundForm, setBackgroundForm] = useState({ name: '', url: '' });
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundFilePreview, setBackgroundFilePreview] = useState<string | null>(null);
  const [backgroundValidating, setBackgroundValidating] = useState(false);
  const [backgroundPreviewValid, setBackgroundPreviewValid] = useState<boolean | null>(null);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');

  const fetchData = useCallback(async () => {
    if (!user?.login) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [roomsRes, statsRes, adminsRes, scheduleRes, apiKeysRes] = await Promise.all([
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
        fetch(`${CHIME_API_URL}/schedule/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userLogin: user.login }),
        }),
        fetch(`${CHIME_API_URL}/admin/api-keys`, {
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
      const scheduleData = scheduleRes.ok ? await scheduleRes.json() : { meetings: [] };
      const apiKeysData = apiKeysRes.ok ? await apiKeysRes.json() : { apiKeys: [] };

      setRooms(roomsData.rooms || []);
      setStats(statsData.stats || null);
      setAdminUsers(adminsData);
      setScheduledMeetings(scheduleData.meetings || []);
      setApiKeys(apiKeysData.apiKeys || []);
      
      // Buscar backgrounds personalizados
      const backgrounds = await backgroundService.getBackgrounds();
      setCustomBackgrounds(backgrounds);
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

  // Schedule handlers
  const handleCreateSchedule = async () => {
    if (!scheduleForm.title || !scheduleForm.scheduledAt) {
      alert('Preencha título e data/hora');
      return;
    }
    
    setActionLoading('create-schedule');
    try {
      const res = await fetch(`${CHIME_API_URL}/schedule/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userLogin: user?.login,
          title: scheduleForm.title,
          description: scheduleForm.description,
          scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
          duration: scheduleForm.duration,
          participants: scheduleForm.participants.split(',').map(p => p.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao agendar');
      
      setScheduledMeetings(prev => [...prev, data.meeting]);
      setShowScheduleForm(false);
      setScheduleForm({ title: '', description: '', scheduledAt: '', duration: 60, participants: '' });
    } catch (err: any) {
      alert(err.message || 'Erro ao agendar reunião');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    if (!confirm('Cancelar este agendamento?')) return;
    
    setActionLoading(scheduleId);
    try {
      const res = await fetch(`${CHIME_API_URL}/schedule/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin: user?.login, scheduleId }),
      });

      if (!res.ok) throw new Error('Falha ao cancelar');
      
      setScheduledMeetings(prev => prev.filter(m => m.scheduleId !== scheduleId));
    } catch (err) {
      alert('Erro ao cancelar agendamento');
    } finally {
      setActionLoading(null);
    }
  };

  // API Key handlers
  const handleCreateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      alert('Digite um nome para a chave');
      return;
    }
    
    setActionLoading('create-apikey');
    try {
      const res = await fetch(`${CHIME_API_URL}/admin/api-keys/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin: user?.login, name: newApiKeyName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar chave');
      
      setNewApiKey(data.apiKey);
      setApiKeys(prev => [...prev, data.keyInfo]);
      setNewApiKeyName('');
    } catch (err: any) {
      alert(err.message || 'Erro ao criar API Key');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!confirm('Revogar esta chave? Esta ação não pode ser desfeita.')) return;
    
    setActionLoading(keyId);
    try {
      const res = await fetch(`${CHIME_API_URL}/admin/api-keys/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLogin: user?.login, keyId }),
      });

      if (!res.ok) throw new Error('Falha ao revogar');
      
      setApiKeys(prev => prev.map(k => k.keyId === keyId ? { ...k, isActive: false } : k));
    } catch (err) {
      alert('Erro ao revogar chave');
    } finally {
      setActionLoading(null);
    }
  };

  // Background handlers
  const handleValidateBackgroundUrl = async (url: string) => {
    if (!url.trim()) {
      setBackgroundPreviewValid(null);
      return;
    }
    setBackgroundValidating(true);
    const isValid = await backgroundService.validateImageUrl(url);
    setBackgroundPreviewValid(isValid);
    setBackgroundValidating(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Tipo de arquivo não permitido. Use: JPEG, PNG, WebP ou GIF');
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo: 5MB');
      return;
    }

    setBackgroundFile(file);
    
    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setBackgroundFilePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddBackground = async () => {
    if (!backgroundForm.name.trim()) {
      alert('Preencha o nome do background');
      return;
    }

    setActionLoading('add-background');

    let result;
    
    if (uploadMode === 'file' && backgroundFile) {
      // Upload de arquivo
      result = await backgroundService.addBackgroundWithFile(
        user?.login || '',
        backgroundForm.name.trim(),
        backgroundFile
      );
    } else if (uploadMode === 'url' && backgroundForm.url.trim()) {
      // URL externa
      if (backgroundPreviewValid === false) {
        alert('URL da imagem inválida');
        setActionLoading(null);
        return;
      }
      result = await backgroundService.addBackground(
        user?.login || '',
        backgroundForm.name.trim(),
        backgroundForm.url.trim()
      );
    } else {
      alert(uploadMode === 'file' ? 'Selecione uma imagem' : 'Preencha a URL da imagem');
      setActionLoading(null);
      return;
    }
    
    if (result.success && result.background) {
      setCustomBackgrounds(prev => [...prev, result.background!]);
      setBackgroundForm({ name: '', url: '' });
      setBackgroundFile(null);
      setBackgroundFilePreview(null);
      setBackgroundPreviewValid(null);
      setShowBackgroundForm(false);
    } else {
      alert(result.error || 'Erro ao adicionar background');
    }
    setActionLoading(null);
  };

  const handleRemoveBackground = async (backgroundId: string) => {
    if (!confirm('Remover este background?')) return;
    
    setActionLoading(backgroundId);
    const result = await backgroundService.removeBackground(user?.login || '', backgroundId);
    
    if (result.success) {
      setCustomBackgrounds(prev => prev.filter(b => b.id !== backgroundId));
    } else {
      alert(result.error || 'Erro ao remover background');
    }
    setActionLoading(null);
  };

  const handleToggleBackground = async (backgroundId: string, currentActive: boolean) => {
    setActionLoading(backgroundId);
    const result = await backgroundService.toggleBackground(
      user?.login || '',
      backgroundId,
      !currentActive
    );
    
    if (result.success) {
      setCustomBackgrounds(prev => 
        prev.map(b => b.id === backgroundId ? { ...b, isActive: !currentActive } : b)
      );
    } else {
      alert(result.error || 'Erro ao atualizar background');
    }
    setActionLoading(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
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
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'schedule'
                ? darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow'
                : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar size={18} />
            Agendamentos
          </button>
          <button
            onClick={() => setActiveTab('apikeys')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'apikeys'
                ? darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow'
                : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Key size={18} />
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('backgrounds')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'backgrounds'
                ? darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow'
                : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Image size={18} />
            Backgrounds
          </button>
          <button
            onClick={() => setActiveTab('interviewai')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'interviewai'
                ? darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow'
                : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Brain size={18} />
            IA Entrevista
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

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className={`rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar size={20} />
                Agendamentos ({scheduledMeetings.length})
              </h2>
              <button
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                } text-white`}
              >
                <Plus size={18} />
                Agendar Reunião
              </button>
            </div>

            {/* Schedule Form */}
            {showScheduleForm && (
              <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Título *
                    </label>
                    <input
                      type="text"
                      value={scheduleForm.title}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Reunião de Equipe"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Data e Hora *
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduleForm.scheduledAt}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, scheduledAt: e.target.value }))}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Duração (minutos)
                    </label>
                    <input
                      type="number"
                      value={scheduleForm.duration}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                      min={15}
                      max={480}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Participantes (emails separados por vírgula)
                    </label>
                    <input
                      type="text"
                      value={scheduleForm.participants}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, participants: e.target.value }))}
                      placeholder="user1@email.com, user2@email.com"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Descrição
                    </label>
                    <textarea
                      value={scheduleForm.description}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição da reunião..."
                      rows={2}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowScheduleForm(false)}
                    className={`px-4 py-2 rounded-lg ${
                      darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateSchedule}
                    disabled={actionLoading === 'create-schedule'}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                    } text-white ${actionLoading === 'create-schedule' ? 'opacity-50' : ''}`}
                  >
                    <Calendar size={18} />
                    Agendar
                  </button>
                </div>
              </div>
            )}

            {/* Scheduled Meetings List */}
            {scheduledMeetings.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar size={48} className={`mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Nenhuma reunião agendada</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {scheduledMeetings.map(meeting => (
                  <div key={meeting.scheduleId} className={`px-6 py-4 ${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{meeting.title}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            meeting.status === 'scheduled' 
                              ? darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                              : meeting.status === 'completed'
                              ? darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                              : darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
                          }`}>
                            {meeting.status === 'scheduled' ? 'Agendada' : meeting.status === 'completed' ? 'Concluída' : 'Cancelada'}
                          </span>
                        </div>
                        <div className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(meeting.scheduledAt).toLocaleString('pt-BR')} • {meeting.duration} min
                          </span>
                          {meeting.description && (
                            <p className="mt-1">{meeting.description}</p>
                          )}
                        </div>
                        <div className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Sala: <span className="font-mono">{meeting.roomId}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(meeting.meetingUrl)}
                          className={`p-2 rounded-lg transition ${
                            darkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                          }`}
                          title="Copiar link"
                        >
                          <Copy size={18} />
                        </button>
                        <a
                          href={meeting.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`p-2 rounded-lg transition ${
                            darkMode ? 'hover:bg-blue-900/50 text-blue-400' : 'hover:bg-blue-100 text-blue-500'
                          }`}
                          title="Abrir sala"
                        >
                          <ExternalLink size={18} />
                        </a>
                        {meeting.status === 'scheduled' && (
                          <button
                            onClick={() => handleCancelSchedule(meeting.scheduleId)}
                            disabled={actionLoading === meeting.scheduleId}
                            className={`p-2 rounded-lg transition ${
                              darkMode ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500'
                            } ${actionLoading === meeting.scheduleId ? 'opacity-50' : ''}`}
                            title="Cancelar"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'apikeys' && (
          <div className={`rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Key size={20} />
                API Keys ({apiKeys.filter(k => k.isActive).length} ativas)
              </h2>
              <div className="flex items-center gap-2">
                <a
                  href={`${CHIME_API_URL}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                  } text-white`}
                >
                  <FileText size={18} />
                  Documentação API
                </a>
                <button
                  onClick={() => setShowApiKeyForm(!showApiKeyForm)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
                >
                  <Plus size={18} />
                  Nova Chave
                </button>
              </div>
            </div>

            {/* New API Key Form */}
            {showApiKeyForm && (
              <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newApiKeyName}
                    onChange={(e) => setNewApiKeyName(e.target.value)}
                    placeholder="Nome da chave (ex: Integração CRM)"
                    className={`flex-1 px-4 py-2 rounded-lg border ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateApiKey()}
                  />
                  <button
                    onClick={handleCreateApiKey}
                    disabled={actionLoading === 'create-apikey' || !newApiKeyName.trim()}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                    } text-white ${(actionLoading === 'create-apikey' || !newApiKeyName.trim()) ? 'opacity-50' : ''}`}
                  >
                    <Key size={18} />
                    Criar
                  </button>
                </div>
              </div>
            )}

            {/* New API Key Display */}
            {newApiKey && (
              <div className={`px-6 py-4 border-b ${darkMode ? 'border-green-700 bg-green-900/20' : 'border-green-200 bg-green-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                      ✓ Chave criada com sucesso! Copie agora, ela não será exibida novamente.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className={`px-3 py-1 rounded font-mono text-sm ${
                        darkMode ? 'bg-gray-700 text-green-300' : 'bg-white text-green-700'
                      }`}>
                        {showApiKey ? newApiKey : '••••••••••••••••••••••••••••••••'}
                      </code>
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className={`p-1 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(newApiKey)}
                        className={`p-1 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => { setNewApiKey(null); setShowApiKey(false); }}
                    className={`px-3 py-1 rounded text-sm ${
                      darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* API Keys List */}
            {apiKeys.length === 0 ? (
              <div className="p-8 text-center">
                <Key size={48} className={`mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Nenhuma API Key criada</p>
                <p className={`text-sm mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Crie uma chave para integrar sistemas externos
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {apiKeys.map(key => (
                  <div key={key.keyId} className={`px-6 py-4 ${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} ${!key.isActive ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{key.name}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            key.isActive 
                              ? darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                              : darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
                          }`}>
                            {key.isActive ? 'Ativa' : 'Revogada'}
                          </span>
                        </div>
                        <div className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span>Criada em {new Date(key.createdAt).toLocaleDateString('pt-BR')} por {key.createdBy}</span>
                          {key.lastUsed && (
                            <span className="ml-3">• Último uso: {new Date(key.lastUsed).toLocaleDateString('pt-BR')}</span>
                          )}
                          <span className="ml-3">• {key.usageCount} requisições</span>
                        </div>
                        <div className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          ID: <span className="font-mono">{key.keyId}</span>
                        </div>
                      </div>
                      {key.isActive && (
                        <button
                          onClick={() => handleRevokeApiKey(key.keyId)}
                          disabled={actionLoading === key.keyId}
                          className={`p-2 rounded-lg transition ${
                            darkMode ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500'
                          } ${actionLoading === key.keyId ? 'opacity-50' : ''}`}
                          title="Revogar chave"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* API Documentation Info */}
            <div className={`px-6 py-4 ${darkMode ? 'bg-blue-900/20 border-t border-gray-700' : 'bg-blue-50 border-t border-gray-200'}`}>
              <h3 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                Como usar a API
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Adicione o header <code className={`px-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>X-API-Key</code> com sua chave em todas as requisições.
              </p>
              <pre className={`mt-2 p-3 rounded-lg text-xs overflow-x-auto ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
{`curl -X POST ${CHIME_API_URL}/api/v1/meetings/schedule \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sua-chave-aqui" \\
  -d '{"title": "Reunião", "scheduledAt": "2025-01-15T10:00:00Z"}'`}
              </pre>
            </div>
          </div>
        )}

        {/* Backgrounds Tab */}
        {activeTab === 'backgrounds' && (
          <div className={`rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Image size={20} />
                Backgrounds Personalizados ({customBackgrounds.filter(b => b.isActive).length} ativos)
              </h2>
              <button
                onClick={() => setShowBackgroundForm(!showBackgroundForm)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                } text-white`}
              >
                <Plus size={18} />
                Novo Background
              </button>
            </div>

            {/* Add Background Form */}
            {showBackgroundForm && (
              <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                {/* Mode Toggle */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setUploadMode('file')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      uploadMode === 'file'
                        ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                        : darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    📁 Upload de Arquivo
                  </button>
                  <button
                    onClick={() => setUploadMode('url')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      uploadMode === 'url'
                        ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                        : darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    🔗 URL Externa
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Nome *
                    </label>
                    <input
                      type="text"
                      value={backgroundForm.name}
                      onChange={(e) => setBackgroundForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Sala de Reuniões"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>

                  {uploadMode === 'file' ? (
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Imagem * (JPEG, PNG, WebP, GIF - máx 5MB)
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFileSelect}
                        className={`w-full px-4 py-2 rounded-lg border ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-white file:bg-gray-600 file:text-white file:border-0 file:rounded file:px-3 file:py-1 file:mr-3' 
                            : 'bg-white border-gray-300 text-gray-900 file:bg-gray-100 file:text-gray-700 file:border-0 file:rounded file:px-3 file:py-1 file:mr-3'
                        }`}
                      />
                      {backgroundFile && (
                        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {backgroundFile.name} ({(backgroundFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        URL da Imagem *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={backgroundForm.url}
                          onChange={(e) => {
                            setBackgroundForm(prev => ({ ...prev, url: e.target.value }));
                            setBackgroundPreviewValid(null);
                          }}
                          onBlur={(e) => handleValidateBackgroundUrl(e.target.value)}
                          placeholder="https://exemplo.com/imagem.jpg"
                          className={`flex-1 px-4 py-2 rounded-lg border ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                              : 'bg-white border-gray-300 text-gray-900'
                          } ${backgroundPreviewValid === false ? 'border-red-500' : backgroundPreviewValid === true ? 'border-green-500' : ''}`}
                        />
                        {backgroundValidating && (
                          <div className="flex items-center px-2">
                            <RefreshCw size={18} className="animate-spin text-blue-500" />
                          </div>
                        )}
                        {!backgroundValidating && backgroundPreviewValid === true && (
                          <div className="flex items-center px-2">
                            <Check size={18} className="text-green-500" />
                          </div>
                        )}
                        {!backgroundValidating && backgroundPreviewValid === false && (
                          <div className="flex items-center px-2">
                            <XIcon size={18} className="text-red-500" />
                          </div>
                        )}
                      </div>
                      {backgroundPreviewValid === false && (
                        <p className="text-xs text-red-500 mt-1">URL inválida ou imagem não acessível</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Preview */}
                {((uploadMode === 'file' && backgroundFilePreview) || (uploadMode === 'url' && backgroundForm.url && backgroundPreviewValid === true)) && (
                  <div className="mt-4">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Preview
                    </label>
                    <div className="w-48 h-28 rounded-lg overflow-hidden border border-gray-600">
                      <img 
                        src={uploadMode === 'file' ? backgroundFilePreview! : backgroundForm.url} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setShowBackgroundForm(false);
                      setBackgroundForm({ name: '', url: '' });
                      setBackgroundFile(null);
                      setBackgroundFilePreview(null);
                      setBackgroundPreviewValid(null);
                    }}
                    className={`px-4 py-2 rounded-lg ${
                      darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddBackground}
                    disabled={
                      actionLoading === 'add-background' || 
                      !backgroundForm.name.trim() || 
                      (uploadMode === 'file' ? !backgroundFile : (!backgroundForm.url.trim() || backgroundPreviewValid === false))
                    }
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                    } text-white ${(actionLoading === 'add-background' || !backgroundForm.name.trim() || (uploadMode === 'file' ? !backgroundFile : !backgroundForm.url.trim())) ? 'opacity-50' : ''}`}
                  >
                    {actionLoading === 'add-background' ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        {uploadMode === 'file' ? 'Enviando...' : 'Adicionando...'}
                      </>
                    ) : (
                      <>
                        <Image size={18} />
                        {uploadMode === 'file' ? 'Enviar e Adicionar' : 'Adicionar'}
                      </>
                    )}
                  </button>
                </div>

                {/* Dicas */}
                <div className={`mt-4 p-3 rounded-lg ${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                  <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    💡 Dicas: Use imagens de alta qualidade (1280x720 ou maior). Formatos aceitos: JPEG, PNG, WebP, GIF. Tamanho máximo: 5MB.
                  </p>
                </div>
              </div>
            )}

            {/* Backgrounds List */}
            {customBackgrounds.length === 0 ? (
              <div className="p-8 text-center">
                <Image size={48} className={`mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Nenhum background personalizado</p>
                <p className={`text-sm mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Adicione backgrounds que ficarão disponíveis para todos os usuários autenticados
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                {customBackgrounds.map(bg => (
                  <div 
                    key={bg.id} 
                    className={`rounded-xl overflow-hidden border ${
                      bg.isActive 
                        ? darkMode ? 'border-green-600' : 'border-green-400'
                        : darkMode ? 'border-gray-700' : 'border-gray-200'
                    } ${!bg.isActive ? 'opacity-60' : ''}`}
                  >
                    {/* Image Preview */}
                    <div className="relative h-32 bg-gray-900">
                      <img 
                        src={bg.url} 
                        alt={bg.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/><text fill="%23666" x="50%" y="50%" text-anchor="middle" dy=".3em">Erro</text></svg>';
                        }}
                      />
                      {/* Status Badge */}
                      <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                        bg.isActive 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-600 text-gray-300'
                      }`}>
                        {bg.isActive ? 'Ativo' : 'Inativo'}
                      </div>
                    </div>

                    {/* Info */}
                    <div className={`p-3 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <h3 className="font-semibold truncate">{bg.name}</h3>
                      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Por {bg.createdBy} • {new Date(bg.createdAt).toLocaleDateString('pt-BR')}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center justify-between mt-3">
                        <button
                          onClick={() => handleToggleBackground(bg.id, bg.isActive)}
                          disabled={actionLoading === bg.id}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                            bg.isActive
                              ? darkMode ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : darkMode ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-green-100 text-green-700 hover:bg-green-200'
                          } ${actionLoading === bg.id ? 'opacity-50' : ''}`}
                        >
                          {bg.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          {bg.isActive ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleRemoveBackground(bg.id)}
                          disabled={actionLoading === bg.id}
                          className={`p-1.5 rounded-lg transition ${
                            darkMode ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500'
                          } ${actionLoading === bg.id ? 'opacity-50' : ''}`}
                          title="Remover"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info */}
            <div className={`px-6 py-4 ${darkMode ? 'bg-gray-700/30 border-t border-gray-700' : 'bg-gray-50 border-t border-gray-200'}`}>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <strong>ℹ️ Como funciona:</strong> Os backgrounds ativos ficam disponíveis para todos os usuários autenticados 
                na opção "Fundo de Tela" durante as videochamadas. Backgrounds inativos não aparecem para os usuários.
              </p>
            </div>
          </div>
        )}

        {/* Interview AI Config Tab */}
        {activeTab === 'interviewai' && (
          <InterviewAIConfigPanel darkMode={darkMode} userLogin={user?.login || ''} />
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
