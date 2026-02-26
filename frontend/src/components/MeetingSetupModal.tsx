import { useState, useRef, useEffect } from 'react';
import { X, Briefcase, Users, BookOpen, MessageSquare, Mic, Video, Target, ChevronDown, Plus, Settings } from 'lucide-react';
import { JobPosition, listJobPositions } from '../services/jobPositionService';

interface MeetingSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: string, topic: string, options?: { autoStartTranscription?: boolean; autoStartRecording?: boolean; jobDescription?: string }) => void;
  darkMode: boolean;
  userLogin?: string;
  onManageJobs?: () => void;
}

const meetingTypes = [
  { value: 'ENTREVISTA', label: 'Entrevista', icon: Briefcase, description: 'Entrevista de emprego com assistente de IA' },
  { value: 'ESCOPO', label: 'Definição de Escopo', icon: Target, description: 'Levantamento de requisitos com IA' },
  { value: 'REUNIAO', label: 'Reunião', icon: Users, description: 'Reunião de trabalho ou alinhamento' },
  { value: 'TREINAMENTO', label: 'Treinamento', icon: BookOpen, description: 'Sessão de treinamento ou capacitação' },
  { value: 'OUTRO', label: 'Outro', icon: MessageSquare, description: 'Outro tipo de conversa' },
];

export default function MeetingSetupModal({
  isOpen,
  onClose,
  onConfirm,
  darkMode,
  userLogin,
  onManageJobs,
}: MeetingSetupModalProps) {
  const [selectedType, setSelectedType] = useState('REUNIAO');
  const [topic, setTopic] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [autoStartTranscription, setAutoStartTranscription] = useState(true);
  const [autoStartRecording, setAutoStartRecording] = useState(true);
  const [width, setWidth] = useState(1000);
  const [isResizing, setIsResizing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);

  useEffect(() => {
    if (isOpen && userLogin && selectedType === 'ENTREVISTA') {
      loadJobPositions();
    }
  }, [isOpen, userLogin, selectedType]);

  const loadJobPositions = async () => {
    if (!userLogin) return;
    setLoadingJobs(true);
    try {
      const positions = await listJobPositions(userLogin, true);
      setJobPositions(positions);
    } catch (error) {
      console.error('Erro ao carregar vagas:', error);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowJobDropdown(false);
    if (jobId) {
      const job = jobPositions.find(j => j.id === jobId);
      if (job) {
        setTopic(job.title);
        const fullDescription = [
          job.description,
          job.requirements ? `\n\nRequisitos:\n${job.requirements}` : '',
          job.level ? `\n\nNível: ${job.level}` : '',
          job.department ? `\nDepartamento: ${job.department}` : '',
        ].join('');
        setJobDescription(fullDescription);
        setUseManualInput(false);
      }
    }
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (modalRef.current) {
        const newWidth = e.clientX - modalRef.current.getBoundingClientRect().left;
        if (newWidth >= 600 && newWidth <= window.innerWidth - 100) {
          setWidth(newWidth);
        }
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedJobId('');
      setUseManualInput(false);
      setTopic('');
      setJobDescription('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedType, topic, { 
      autoStartTranscription, 
      autoStartRecording, 
      jobDescription: selectedType === 'ENTREVISTA' ? jobDescription : '' 
    });
    onClose();
  };

  const handleSkip = () => {
    onConfirm('REUNIAO', '', { autoStartTranscription: true, autoStartRecording: true, jobDescription: '' });
    onClose();
  };

  const isInterview = selectedType === 'ENTREVISTA';
  const isScope = selectedType === 'ESCOPO';
  const selectedJob = jobPositions.find(j => j.id === selectedJobId);
  const hasJobPositions = jobPositions.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        ref={modalRef}
        style={{ width: `${width}px` }}
        className={`relative max-h-[85vh] rounded-2xl shadow-2xl flex flex-col ${
          darkMode ? 'bg-card-dark text-white' : 'bg-white text-foreground-light'
        }`}
      >
        <div
          onMouseDown={() => setIsResizing(true)}
          className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary-500/20 transition-colors ${
            isResizing ? 'bg-primary-500/30' : ''
          }`}
          style={{ zIndex: 10 }}
        />

        <div className={`p-4 border-b flex-shrink-0 ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Configurar Reunião</h2>
            <button onClick={onClose} className={`p-2 rounded-full transition ${darkMode ? 'hover:bg-white/10 text-muted-dark' : 'hover:bg-black/5 text-muted-light'}`}>
              <X size={20} />
            </button>
          </div>
          <p className={`text-sm mt-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
            Escolha o tipo de reunião para ativar recursos especiais
          </p>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>Tipo de Reunião</label>
            <div className="grid grid-cols-5 gap-2">
              {meetingTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? darkMode ? 'border-primary bg-primary-900/30' : 'border-primary bg-primary-50'
                        : darkMode ? 'border-border-dark hover:border-border-dark bg-white/5' : 'border-border-light hover:border-border-light bg-black/3'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={18} className={isSelected ? (darkMode ? 'text-primary-300' : 'text-primary') : (darkMode ? 'text-muted-dark' : 'text-muted-light')} />
                      <span className={`font-medium ${isSelected ? (darkMode ? 'text-primary-300' : 'text-primary-700') : (darkMode ? 'text-foreground-dark' : 'text-muted-light')}`}>{type.label}</span>
                    </div>
                    <p className={`text-xs ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>{type.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {isInterview && userLogin && (
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-primary-900/20 border border-primary-700/50' : 'bg-primary-50 border border-primary-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>Selecionar Vaga Cadastrada</label>
                {onManageJobs && (
                  <button onClick={onManageJobs} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition ${darkMode ? 'text-primary-300 hover:bg-primary-800/50' : 'text-primary hover:bg-primary-50'}`}>
                    <Settings size={14} />
                    Gerenciar Vagas
                  </button>
                )}
              </div>

              {loadingJobs ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span className={`text-sm ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>Carregando vagas...</span>
                </div>
              ) : hasJobPositions ? (
                <div className="space-y-3">
                  <div className="relative">
                    <button
                      onClick={() => setShowJobDropdown(!showJobDropdown)}
                      disabled={useManualInput}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition ${
                        useManualInput
                          ? darkMode ? 'bg-white/5 text-muted-light' : 'bg-black/5 text-muted-dark'
                          : darkMode ? 'bg-white/5 hover:bg-white/15 text-white' : 'bg-white hover:bg-black/3 text-foreground-light border border-border-light'
                      }`}
                    >
                      <span className={selectedJob ? '' : darkMode ? 'text-muted-dark' : 'text-muted-light'}>
                        {selectedJob ? selectedJob.title : 'Selecione uma vaga...'}
                      </span>
                      <ChevronDown size={18} className={`transition-transform ${showJobDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showJobDropdown && (
                      <div className={`absolute z-10 w-full mt-2 rounded-xl shadow-lg max-h-60 overflow-y-auto ${darkMode ? 'bg-white/5 border border-border-dark' : 'bg-white border border-border-light'}`}>
                        {jobPositions.map((job) => (
                          <button
                            key={job.id}
                            onClick={() => handleJobSelect(job.id)}
                            className={`w-full px-4 py-3 text-left transition ${selectedJobId === job.id ? (darkMode ? 'bg-primary-900/50' : 'bg-primary-50') : (darkMode ? 'hover:bg-white/15' : 'hover:bg-black/3')}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${darkMode ? 'text-white' : 'text-foreground-light'}`}>{job.title}</span>
                              {job.level && <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-white/10 text-foreground-dark' : 'bg-black/5 text-muted-light'}`}>{job.level}</span>}
                            </div>
                            {job.department && <p className={`text-xs mt-0.5 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>{job.department}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedJob && !useManualInput && (
                    <div className={`p-3 rounded-lg text-sm ${darkMode ? 'bg-white/5' : 'bg-white border border-border-light'}`}>
                      <p className={`line-clamp-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>{selectedJob.description.substring(0, 150)}...</p>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useManualInput}
                      onChange={(e) => {
                        setUseManualInput(e.target.checked);
                        if (e.target.checked) { setSelectedJobId(''); setTopic(''); setJobDescription(''); }
                      }}
                      className="w-4 h-4 rounded border-border-light text-primary focus:ring-primary"
                    />
                    <span className={`text-sm ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>Preencher manualmente</span>
                  </label>
                </div>
              ) : (
                <div className={`text-center py-4 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
                  <Briefcase size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-2">Nenhuma vaga cadastrada</p>
                  {onManageJobs && (
                    <button onClick={onManageJobs} className="flex items-center gap-1 mx-auto text-sm px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-600 text-white transition">
                      <Plus size={16} />
                      Cadastrar Vaga
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {(!isInterview || useManualInput || !hasJobPositions || !userLogin) && (
            <div className={`transition-all ${isInterview || isScope ? 'opacity-100' : 'opacity-70'}`}>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>
                {isInterview ? 'Vaga / Cargo *' : isScope ? 'Nome do Projeto *' : 'Tema da Reunião (opcional)'}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={isInterview ? 'Ex: Desenvolvedor Full Stack Senior' : isScope ? 'Ex: Sistema de Gestão de Pedidos' : 'Ex: Alinhamento de projeto'}
                className={`w-full px-4 py-3 rounded-xl focus:ring-2 focus:border-transparent transition-all ${darkMode ? 'border border-border-dark bg-white/5 text-white placeholder-muted-dark focus:ring-primary' : 'border border-border-light bg-black/3 focus:ring-primary'}`}
              />
              {isInterview && <p className={`text-xs mt-1 ${darkMode ? 'text-primary-300' : 'text-primary'}`}>✨ O assistente de IA irá sugerir perguntas baseadas na vaga</p>}
              {isScope && <p className={`text-xs mt-1 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`}>🎯 A IA irá identificar requisitos e gerar uma LRD automaticamente</p>}
            </div>
          )}

          {isInterview && (useManualInput || !hasJobPositions || !userLogin) && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>Descrição da Vaga (contexto para IA)</label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Cole aqui a descrição completa da vaga, requisitos técnicos, nível de senioridade, tecnologias esperadas, etc."
                rows={4}
                className={`w-full px-4 py-3 rounded-xl focus:ring-2 focus:border-transparent transition-all resize-none ${darkMode ? 'border border-border-dark bg-white/5 text-white placeholder-muted-dark focus:ring-primary' : 'border border-border-light bg-black/3 focus:ring-primary'}`}
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-muted-light' : 'text-muted-dark'}`}>A IA usará estas informações para gerar perguntas técnicas relevantes</p>
            </div>
          )}

          {isInterview && (
            <div className={`p-3 rounded-xl ${darkMode ? 'bg-primary-900/30 border border-primary-700/50' : 'bg-primary-50 border border-primary-200'}`}>
              <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}><Briefcase size={16} />Modo Entrevista Ativado</h4>
              <ul className={`text-xs space-y-1 ${darkMode ? 'text-primary-200/80' : 'text-primary'}`}>
                <li>• Sugestões de perguntas em tempo real</li>
                <li>• Análise da conversa para follow-ups</li>
                <li>• Perguntas técnicas e comportamentais</li>
                <li>• Transcrição automática salva no histórico</li>
              </ul>
            </div>
          )}

          {isScope && (
            <div className={`p-3 rounded-xl ${darkMode ? 'bg-teal-900/30 border border-teal-700/50' : 'bg-teal-50 border border-teal-200'}`}>
              <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-teal-300' : 'text-teal-700'}`}><Target size={16} />Modo Definição de Escopo Ativado</h4>
              <ul className={`text-xs space-y-1 ${darkMode ? 'text-teal-200/80' : 'text-teal-600'}`}>
                <li>• Identificação automática de requisitos</li>
                <li>• Sugestões de perguntas para clarificação</li>
                <li>• Agrupamento em features/módulos</li>
                <li>• Geração de LRD ao final da reunião</li>
              </ul>
            </div>
          )}

          <div className={`space-y-3 p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-black/3'}`}>
            <h4 className={`text-sm font-medium ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>Opções Automáticas</h4>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Mic size={16} className={darkMode ? 'text-muted-dark' : 'text-muted-light'} />
                <span className={`text-sm ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>Iniciar transcrição automaticamente</span>
              </div>
              <div className="relative">
                <input type="checkbox" checked={autoStartTranscription} onChange={(e) => setAutoStartTranscription(e.target.checked)} className="sr-only" />
                <div className={`w-10 h-6 rounded-full transition-colors ${autoStartTranscription ? (darkMode ? 'bg-primary' : 'bg-primary') : (darkMode ? 'bg-white/10' : 'bg-black/10')}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-1 ${autoStartTranscription ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Video size={16} className={darkMode ? 'text-muted-dark' : 'text-muted-light'} />
                <span className={`text-sm ${darkMode ? 'text-foreground-dark' : 'text-muted-light'}`}>Iniciar gravação automaticamente</span>
              </div>
              <div className="relative">
                <input type="checkbox" checked={autoStartRecording} onChange={(e) => setAutoStartRecording(e.target.checked)} className="sr-only" />
                <div className={`w-10 h-6 rounded-full transition-colors ${autoStartRecording ? (darkMode ? 'bg-primary' : 'bg-primary') : (darkMode ? 'bg-white/10' : 'bg-black/10')}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-1 ${autoStartRecording ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className={`p-4 border-t flex justify-between flex-shrink-0 ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
          <button onClick={handleSkip} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${darkMode ? 'text-muted-dark hover:text-foreground-dark hover:bg-white/10' : 'text-muted-light hover:text-muted-light hover:bg-black/5'}`}>Pular</button>
          <button
            onClick={handleConfirm}
            disabled={(isInterview || isScope) && !topic.trim()}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${darkMode ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-primary hover:bg-primary-600 text-white'}`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
