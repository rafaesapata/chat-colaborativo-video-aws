import { useState } from 'react';
import { X, Briefcase, Users, BookOpen, MessageSquare, Mic, Video } from 'lucide-react';

interface MeetingSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: string, topic: string, options?: { autoStartTranscription?: boolean; autoStartRecording?: boolean; jobDescription?: string }) => void;
  darkMode: boolean;
}

const meetingTypes = [
  { value: 'ENTREVISTA', label: 'Entrevista', icon: Briefcase, description: 'Entrevista de emprego com assistente de IA' },
  { value: 'REUNIAO', label: 'Reunião', icon: Users, description: 'Reunião de trabalho ou alinhamento' },
  { value: 'TREINAMENTO', label: 'Treinamento', icon: BookOpen, description: 'Sessão de treinamento ou capacitação' },
  { value: 'OUTRO', label: 'Outro', icon: MessageSquare, description: 'Outro tipo de conversa' },
];

export default function MeetingSetupModal({
  isOpen,
  onClose,
  onConfirm,
  darkMode,
}: MeetingSetupModalProps) {
  const [selectedType, setSelectedType] = useState('REUNIAO');
  const [topic, setTopic] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [autoStartTranscription, setAutoStartTranscription] = useState(true); // Ativo por padrão
  const [autoStartRecording, setAutoStartRecording] = useState(true); // Ativo por padrão

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedType, topic, { autoStartTranscription, autoStartRecording, jobDescription: selectedType === 'ENTREVISTA' ? jobDescription : '' });
    onClose();
  };

  const handleSkip = () => {
    // Mesmo pulando, mantém transcrição e gravação ativas por padrão
    onConfirm('REUNIAO', '', { autoStartTranscription: true, autoStartRecording: true, jobDescription: '' });
    onClose();
  };

  const isInterview = selectedType === 'ENTREVISTA';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${
        darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Configurar Reunião</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition ${
                darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={20} />
            </button>
          </div>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Escolha o tipo de reunião para ativar recursos especiais
          </p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Meeting Type Selection */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Tipo de Reunião
            </label>
            <div className="grid grid-cols-2 gap-2">
              {meetingTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? darkMode
                          ? 'border-purple-500 bg-purple-900/30'
                          : 'border-indigo-500 bg-indigo-50'
                        : darkMode
                        ? 'border-gray-700 hover:border-gray-600 bg-gray-700/50'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={18} className={isSelected 
                        ? darkMode ? 'text-purple-400' : 'text-indigo-600'
                        : darkMode ? 'text-gray-400' : 'text-gray-500'
                      } />
                      <span className={`font-medium ${
                        isSelected
                          ? darkMode ? 'text-purple-300' : 'text-indigo-700'
                          : darkMode ? 'text-gray-200' : 'text-gray-700'
                      }`}>
                        {type.label}
                      </span>
                    </div>
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {type.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic Input - Mostrar sempre, mas destacar para entrevista */}
          <div className={`transition-all ${isInterview ? 'opacity-100' : 'opacity-70'}`}>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {isInterview ? 'Vaga / Cargo *' : 'Tema da Reunião (opcional)'}
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={isInterview 
                ? 'Ex: Desenvolvedor Full Stack Senior' 
                : 'Ex: Alinhamento de projeto'
              }
              className={`w-full px-4 py-3 rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                darkMode 
                  ? 'border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-purple-500' 
                  : 'border border-gray-200 bg-gray-50 focus:ring-indigo-500'
              }`}
            />
            {isInterview && (
              <p className={`text-xs mt-1 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`}>
                ✨ O assistente de IA irá sugerir perguntas baseadas na vaga
              </p>
            )}
          </div>

          {/* Job Description - Apenas para entrevistas */}
          {isInterview && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Descrição da Vaga (contexto para IA)
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Cole aqui a descrição completa da vaga, requisitos técnicos, nível de senioridade, tecnologias esperadas, etc. Quanto mais detalhes, melhores serão as perguntas sugeridas pela IA."
                rows={4}
                className={`w-full px-4 py-3 rounded-xl focus:ring-2 focus:border-transparent transition-all resize-none ${
                  darkMode 
                    ? 'border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-purple-500' 
                    : 'border border-gray-200 bg-gray-50 focus:ring-indigo-500'
                }`}
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                A IA usará estas informações para gerar perguntas técnicas relevantes ao nível do candidato
              </p>
            </div>
          )}

          {/* Interview AI Info */}
          {isInterview && (
            <div className={`p-3 rounded-xl ${
              darkMode ? 'bg-purple-900/30 border border-purple-700/50' : 'bg-indigo-50 border border-indigo-200'
            }`}>
              <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
                darkMode ? 'text-purple-300' : 'text-indigo-700'
              }`}>
                <Briefcase size={16} />
                Modo Entrevista Ativado
              </h4>
              <ul className={`text-xs space-y-1 ${darkMode ? 'text-purple-200/80' : 'text-indigo-600'}`}>
                <li>• Sugestões de perguntas em tempo real</li>
                <li>• Análise da conversa para follow-ups</li>
                <li>• Perguntas técnicas e comportamentais</li>
                <li>• Transcrição automática salva no histórico</li>
              </ul>
            </div>
          )}

          {/* Auto-start Options */}
          <div className={`space-y-3 p-3 rounded-xl ${
            darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
          }`}>
            <h4 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Opções Automáticas
            </h4>
            
            {/* Auto Transcription */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Mic size={16} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Iniciar transcrição automaticamente
                </span>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={autoStartTranscription}
                  onChange={(e) => setAutoStartTranscription(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${
                  autoStartTranscription
                    ? darkMode ? 'bg-purple-600' : 'bg-indigo-600'
                    : darkMode ? 'bg-gray-600' : 'bg-gray-300'
                }`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-1 ${
                    autoStartTranscription ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </div>
              </div>
            </label>

            {/* Auto Recording */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Video size={16} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Iniciar gravação automaticamente
                </span>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={autoStartRecording}
                  onChange={(e) => setAutoStartRecording(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${
                  autoStartRecording
                    ? darkMode ? 'bg-purple-600' : 'bg-indigo-600'
                    : darkMode ? 'bg-gray-600' : 'bg-gray-300'
                }`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-1 ${
                    autoStartRecording ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={handleSkip}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              darkMode 
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            Pular
          </button>
          <button
            onClick={handleConfirm}
            disabled={isInterview && !topic.trim()}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
              darkMode 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
