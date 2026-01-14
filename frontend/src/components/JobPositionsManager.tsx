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
      <div className={`rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg p-8 text-center`}>
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Carregando vagas...</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg overflow-hidden`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase size={20} className="text-purple-500" />
          Minhas Vagas
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetForm();
              setIsCreating(true);
            }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm bg-purple-600 hover:bg-purple-700 text-white transition"
          >
            <Plus size={16} />
            Nova Vaga
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
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
              darkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <Search size={18} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar vagas..."
                className={`flex-1 bg-transparent outline-none text-sm ${
                  darkMode ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
          </div>
        )}

        {/* Form (Create/Edit) */}
        {(isCreating || editingId) && (
          <div className={`mb-6 p-4 rounded-xl ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              {isCreating ? 'Nova Vaga' : 'Editar Vaga'}
            </h3>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Título da Vaga *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Desenvolvedor Full Stack Senior"
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    darkMode 
                      ? 'bg-gray-600 text-white placeholder-gray-400 border-gray-500' 
                      : 'bg-white text-gray-900 placeholder-gray-400 border-gray-200'
                  } border focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
              </div>

              {/* Level & Department */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Nível
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value as any })}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      darkMode 
                        ? 'bg-gray-600 text-white border-gray-500' 
                        : 'bg-white text-gray-900 border-gray-200'
                    } border focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  >
                    {LEVELS.map(level => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Departamento
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Ex: Tecnologia"
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      darkMode 
                        ? 'bg-gray-600 text-white placeholder-gray-400 border-gray-500' 
                        : 'bg-white text-gray-900 placeholder-gray-400 border-gray-200'
                    } border focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Descrição da Vaga *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva as responsabilidades, atividades e contexto da vaga..."
                  rows={4}
                  className={`w-full px-3 py-2 rounded-lg text-sm resize-none ${
                    darkMode 
                      ? 'bg-gray-600 text-white placeholder-gray-400 border-gray-500' 
                      : 'bg-white text-gray-900 placeholder-gray-400 border-gray-200'
                  } border focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
              </div>

              {/* Requirements */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Requisitos Técnicos
                </label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  placeholder="Liste as tecnologias, experiências e habilidades necessárias..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg text-sm resize-none ${
                    darkMode 
                      ? 'bg-gray-600 text-white placeholder-gray-400 border-gray-500' 
                      : 'bg-white text-gray-900 placeholder-gray-400 border-gray-200'
                  } border focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetForm}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={isCreating ? handleCreate : handleUpdate}
                  disabled={saving || !formData.title.trim() || !formData.description.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
                {filteredPositions.map((position) => (
                  <div
                    key={position.id}
                    className={`rounded-xl border transition-all ${
                      darkMode 
                        ? 'bg-gray-700/30 border-gray-600 hover:border-gray-500' 
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Header */}
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === position.id ? null : position.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {position.title}
                          </h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {getLevelLabel(position.level)}
                          </span>
                        </div>
                        {position.department && (
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
                            darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
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
                          <ChevronUp size={20} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                        ) : (
                          <ChevronDown size={20} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedId === position.id && (
                      <div className={`px-4 pb-4 pt-0 border-t ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                        <div className="pt-4 space-y-3">
                          <div>
                            <h5 className={`text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              Descrição
                            </h5>
                            <p className={`text-sm whitespace-pre-wrap ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {position.description}
                            </p>
                          </div>
                          {position.requirements && (
                            <div>
                              <h5 className={`text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Requisitos
                              </h5>
                              <p className={`text-sm whitespace-pre-wrap ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {position.requirements}
                              </p>
                            </div>
                          )}
                          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
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
        <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-50 border-purple-200'} border`}>
          <p className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
            <strong>💡 Dica:</strong> Cadastre suas vagas aqui e selecione-as rapidamente ao iniciar uma entrevista. 
            A descrição será usada pela IA para gerar perguntas relevantes.
          </p>
        </div>
      </div>
    </div>
  );
}
