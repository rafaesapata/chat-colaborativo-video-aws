import { useState, useEffect } from 'react';
import { 
  Briefcase, Plus, Edit2, Trash2, X, Save, 
  ChevronDown, ChevronUp, Search, AlertCircle 
} from 'lucide-react';
import {
  JobPosition,
  JobPositionInput,
  listJobPositions,
  createJobPosition,
  updateJobPosition,
  deleteJobPosition,
} from '../services/jobPositionService';
import { SkeletonJobCard } from './Skeleton';

interface JobPositionsManagerProps {
  darkMode: boolean;
  userLogin: string;
  onClose?: () => void;
}

const LEVELS = [
  { value: 'junior', label: 'Júnior' },
  { value: 'pleno', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
  { value: 'especialista', label: 'Especialista' },
  { value: 'lead', label: 'Tech Lead' },
];

export default function JobPositionsManager({ 
  darkMode, 
  userLogin,
  onClose 
}: JobPositionsManagerProps) {
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Form state
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<JobPositionInput>({
    title: '',
    description: '',
    requirements: '',
    level: 'pleno',
    department: '',
  });

  useEffect(() => {
    loadPositions();
  }, [userLogin]);

  const loadPositions = async () => {
    setLoading(true);
    try {
      const data = await listJobPositions(userLogin, true);
      setPositions(data);
    } catch (err) {
      setError('Erro ao carregar vagas');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      requirements: '',
      level: 'pleno',
      department: '',
    });
    setIsCreating(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    
    const result = await createJobPosition(userLogin, formData);
    
    if (result.success) {
      setSuccess('Vaga criada com sucesso!');
      resetForm();
      loadPositions();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Erro ao criar vaga');
    }
    
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    
    setSaving(true);
    setError(null);
    
    const result = await updateJobPosition(userLogin, editingId, formData);
    
    if (result.success) {
      setSuccess('Vaga atualizada com sucesso!');
      resetForm();
      loadPositions();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Erro ao atualizar vaga');
    }
    
    setSaving(false);
  };

  const handleDelete = async (positionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta vaga?')) return;
    
    const result = await deleteJobPosition(userLogin, positionId);
    
    if (result.success) {
      setSuccess('Vaga excluída com sucesso!');
      loadPositions();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Erro ao excluir vaga');
    }
  };

  const startEdit = (position: JobPosition) => {
    setFormData({
      title: position.title,
      description: position.description,
      requirements: position.requirements || '',
      level: position.level || 'pleno',
      department: position.department || '',
    });
    setEditingId(position.id);
    setIsCreating(false);
  };

  const filteredPositions = positions.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLevelLabel = (level?: string) => {
    return LEVELS.find(l => l.value === level)?.label || 'Pleno';
  };

  if (loading) {
    return (
      <div className={`rounded-xl ${darkMode ? 'bg-card-dark' : 'bg-white'} shadow-lg overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${darkMode ? 'border-border-dark' : 'border-border-light'} flex items-center gap-2`}>
          <Briefcase size={20} className="text-primary" />
          <div className={`h-5 w-28 rounded ${darkMode ? 'bg-white/5' : 'bg-black/5'} animate-skeleton-shimmer bg-gradient-to-r ${darkMode ? 'from-white/5 via-white/10 to-white/5' : 'from-black/5 via-black/3 to-black/5'} bg-[length:200%_100%]`} />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <SkeletonJobCard key={i} darkMode={darkMode} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl ${darkMode ? 'bg-card-dark' : 'bg-white'} shadow-lg overflow-hidden`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${darkMode ? 'border-border-dark' : 'border-border-light'} flex items-center justify-between`}>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase size={20} className="text-primary" />
          Minhas Vagas
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetForm();
              setIsCreating(true);
            }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm bg-primary hover:bg-primary-600 text-white transition"
          >
            <Plus size={16} />
            Nova Vaga
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500 text-sm">
          ✓ {success}
        </div>
      )}

      <div className="p-6">
        {/* Search */}
        {positions.length > 0 && !isCreating && !editingId && (
          <div className="mb-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              darkMode ? 'bg-white/5' : 'bg-black/5'
            }`}>
              <Search size={18} className={darkMode ? 'text-muted-dark' : 'text-muted-light'} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar vagas..."
                className={`flex-1 bg-transparent outline-none text-sm ${
                  darkMode ? 'text-white placeholder-muted-dark' : 'text-foreground-light placeholder-muted-light'
                }`}
              />
            </div>
          </div>
        )}

        {/* Form (Create/Edit) */}
        {(isCreating || editingId) && (
          <div className={`mb-6 p-4 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-black/3'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
              {isCreating ? 'Nova Vaga' : 'Editar Vaga'}
            </h3>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                  Título da Vaga *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Desenvolvedor Full Stack Senior"
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    darkMode 
                      ? 'bg-white/10 text-white placeholder-muted-dark border-border-dark' 
                      : 'bg-white text-foreground-light placeholder-muted-dark border-border-light'
                  } border focus:ring-2 focus:ring-primary focus:border-transparent`}
                />
              </div>

              {/* Level & Department */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                    Nível
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value as any })}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      darkMode 
                        ? 'bg-white/10 text-white border-border-dark' 
                        : 'bg-white text-foreground-light border-border-light'
                    } border focus:ring-2 focus:ring-primary focus:border-transparent`}
                  >
                    {LEVELS.map(level => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                    Departamento
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Ex: Tecnologia"
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      darkMode 
                        ? 'bg-white/10 text-white placeholder-muted-dark border-border-dark' 
                        : 'bg-white text-foreground-light placeholder-muted-dark border-border-light'
                    } border focus:ring-2 focus:ring-primary focus:border-transparent`}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                  Descrição da Vaga *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva as responsabilidades, atividades e contexto da vaga..."
                  rows={4}
                  className={`w-full px-3 py-2 rounded-lg text-sm resize-none ${
                    darkMode 
                      ? 'bg-white/10 text-white placeholder-muted-dark border-border-dark' 
                      : 'bg-white text-foreground-light placeholder-muted-dark border-border-light'
                  } border focus:ring-2 focus:ring-primary focus:border-transparent`}
                />
              </div>

              {/* Requirements */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                  Requisitos Técnicos
                </label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  placeholder="Liste as tecnologias, experiências e habilidades necessárias..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg text-sm resize-none ${
                    darkMode 
                      ? 'bg-white/10 text-white placeholder-muted-dark border-border-dark' 
                      : 'bg-white text-foreground-light placeholder-muted-dark border-border-light'
                  } border focus:ring-2 focus:ring-primary focus:border-transparent`}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetForm}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    darkMode ? 'hover:bg-white/15' : 'hover:bg-black/5'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={isCreating ? handleCreate : handleUpdate}
                  disabled={saving || !formData.title.trim() || !formData.description.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary hover:bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Positions List */}
        {!isCreating && !editingId && (
          <>
            {filteredPositions.length === 0 ? (
              <div className={`text-center py-12 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                <Briefcase size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">
                  {searchTerm ? 'Nenhuma vaga encontrada' : 'Nenhuma vaga cadastrada'}
                </p>
                <p className="text-sm">
                  {searchTerm 
                    ? 'Tente buscar com outros termos' 
                    : 'Clique em "Nova Vaga" para cadastrar sua primeira vaga'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPositions.map((position, idx) => (
                  <div
                    key={position.id}
                    className={`rounded-xl border transition-all animate-fade-in-up ${
                      darkMode 
                        ? 'bg-white/5 border-border-dark hover:border-border-dark' 
                        : 'bg-black/3 border-border-light hover:border-border-light'
                    }`}
                    style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
                  >
                    {/* Header */}
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === position.id ? null : position.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-foreground-light'}`}>
                            {position.title}
                          </h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            darkMode ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-50 text-primary-700'
                          }`}>
                            {getLevelLabel(position.level)}
                          </span>
                        </div>
                        {position.department && (
                          <p className={`text-sm ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                            {position.department}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(position);
                          }}
                          className={`p-2 rounded-lg transition ${
                            darkMode ? 'hover:bg-white/15' : 'hover:bg-black/5'
                          }`}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(position.id);
                          }}
                          className={`p-2 rounded-lg transition text-red-500 ${
                            darkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-50'
                          }`}
                        >
                          <Trash2 size={16} />
                        </button>
                        {expandedId === position.id ? (
                          <ChevronUp size={20} className={darkMode ? 'text-muted-dark' : 'text-muted-light'} />
                        ) : (
                          <ChevronDown size={20} className={darkMode ? 'text-muted-dark' : 'text-muted-light'} />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedId === position.id && (
                      <div className={`px-4 pb-4 pt-0 border-t ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
                        <div className="pt-4 space-y-3">
                          <div>
                            <h5 className={`text-xs font-semibold mb-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                              Descrição
                            </h5>
                            <p className={`text-sm whitespace-pre-wrap ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
                              {position.description}
                            </p>
                          </div>
                          {position.requirements && (
                            <div>
                              <h5 className={`text-xs font-semibold mb-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                                Requisitos
                              </h5>
                              <p className={`text-sm whitespace-pre-wrap ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
                                {position.requirements}
                              </p>
                            </div>
                          )}
                          <p className={`text-xs ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>
                            Criada em {new Date(position.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Info */}
        <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-primary-900/20 border-primary-800' : 'bg-primary-50 border-primary-200'} border`}>
          <p className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
            <strong>💡 Dica:</strong> Cadastre suas vagas aqui e selecione-as rapidamente ao iniciar uma entrevista. 
            A descrição será usada pela IA para gerar perguntas relevantes.
          </p>
        </div>
      </div>
    </div>
  );
}
