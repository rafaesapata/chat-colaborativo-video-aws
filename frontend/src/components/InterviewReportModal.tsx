import { useRef } from 'react';
import { X, Download, User, Briefcase, Brain, Target, TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { InterviewReport } from '../services/interviewAIService';

interface InterviewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: InterviewReport | null;
  darkMode: boolean;
}

export default function InterviewReportModal({
  isOpen,
  onClose,
  report,
  darkMode,
}: InterviewReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !report) return null;

  const getScoreColor = (score: number) => {
    if (score >= 70) return darkMode ? 'text-green-400' : 'text-green-600';
    if (score >= 50) return darkMode ? 'text-yellow-400' : 'text-yellow-600';
    return darkMode ? 'text-red-400' : 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return darkMode ? 'bg-green-900/30' : 'bg-green-100';
    if (score >= 50) return darkMode ? 'bg-yellow-900/30' : 'bg-yellow-100';
    return darkMode ? 'bg-red-900/30' : 'bg-red-100';
  };

  const getRecommendationIcon = () => {
    switch (report.recommendation.status) {
      case 'recommended':
        return <CheckCircle size={24} className="text-green-500" />;
      case 'consider':
        return <AlertCircle size={24} className="text-yellow-500" />;
      default:
        return <XCircle size={24} className="text-red-500" />;
    }
  };

  const getRecommendationBg = () => {
    switch (report.recommendation.status) {
      case 'recommended':
        return darkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200';
      case 'consider':
        return darkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-200';
      default:
        return darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200';
    }
  };

  const getSeniorityBadge = () => {
    const colors = {
      junior: darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700',
      pleno: darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700',
      senior: darkMode ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-700',
    };
    return colors[report.seniorityLevel.level];
  };

  const handleDownloadPDF = () => {
    // Criar conteúdo do PDF como HTML
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Entrevista - ${report.candidateName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; }
          h2 { color: #374151; margin-top: 30px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .score { font-size: 48px; font-weight: bold; color: #4F46E5; }
          .skill-bar { height: 8px; background: #E5E7EB; border-radius: 4px; margin: 5px 0; }
          .skill-fill { height: 100%; border-radius: 4px; }
          .green { background: #10B981; }
          .yellow { background: #F59E0B; }
          .red { background: #EF4444; }
          .recommendation { padding: 20px; border-radius: 10px; margin: 20px 0; }
          .recommended { background: #D1FAE5; border: 1px solid #10B981; }
          .consider { background: #FEF3C7; border: 1px solid #F59E0B; }
          .not_recommended { background: #FEE2E2; border: 1px solid #EF4444; }
          ul { padding-left: 20px; }
          li { margin: 8px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #9CA3AF; }
        </style>
      </head>
      <body>
        <h1>📋 Relatório de Entrevista</h1>
        
        <div class="header">
          <div>
            <p><strong>Vaga:</strong> ${report.topic}</p>
            <p><strong>Candidato:</strong> ${report.candidateName}</p>
            <p><strong>Data:</strong> ${new Date(report.generatedAt).toLocaleDateString('pt-BR')}</p>
          </div>
          <div style="text-align: right;">
            <div class="score">${report.overallScore}</div>
            <p>Score Geral</p>
          </div>
        </div>

        <h2>🎯 Nível de Senioridade</h2>
        <p><span class="badge" style="background: #EDE9FE; color: #7C3AED;">${report.seniorityLevel.level.toUpperCase()}</span></p>
        <p>${report.seniorityLevel.description}</p>

        <h2>🧠 Soft Skills</h2>
        ${report.softSkills.map(skill => `
          <div style="margin: 15px 0;">
            <div style="display: flex; justify-content: space-between;">
              <span>${skill.name}</span>
              <span>${skill.score}%</span>
            </div>
            <div class="skill-bar">
              <div class="skill-fill ${skill.score >= 70 ? 'green' : skill.score >= 50 ? 'yellow' : 'red'}" style="width: ${skill.score}%"></div>
            </div>
            <p style="font-size: 12px; color: #6B7280;">${skill.description}</p>
          </div>
        `).join('')}

        <h2>💻 Análise Técnica</h2>
        <p><strong>Área:</strong> ${report.technicalAnalysis.area}</p>
        <p><strong>Score:</strong> ${report.technicalAnalysis.score}%</p>
        <p><strong>Profundidade:</strong> ${report.technicalAnalysis.depth === 'deep' ? 'Profundo' : report.technicalAnalysis.depth === 'medium' ? 'Médio' : 'Básico'}</p>
        <p>${report.technicalAnalysis.description}</p>
        ${report.technicalAnalysis.mentionedTechnologies.length > 0 ? `
          <p><strong>Tecnologias mencionadas:</strong> ${report.technicalAnalysis.mentionedTechnologies.join(', ')}</p>
        ` : ''}

        <h2>✅ Pontos Fortes</h2>
        <ul>
          ${report.strengths.map(s => `<li>${s}</li>`).join('')}
        </ul>

        <h2>📈 Pontos a Desenvolver</h2>
        <ul>
          ${report.improvements.map(i => `<li>${i}</li>`).join('')}
        </ul>

        <h2>📊 Recomendação</h2>
        <div class="recommendation ${report.recommendation.status}">
          <h3>${report.recommendation.title}</h3>
          <p>${report.recommendation.description}</p>
        </div>

        <div class="footer">
          <p>Relatório gerado automaticamente pelo Video Chat AI</p>
          <p>Total de transcrições analisadas: ${report.transcriptionCount}</p>
        </div>
      </body>
      </html>
    `;

    // Abrir em nova janela para impressão/PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className={`relative w-full max-w-3xl my-8 rounded-2xl shadow-2xl overflow-hidden ${
        darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 p-4 border-b flex items-center justify-between ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <Briefcase size={24} className={darkMode ? 'text-purple-400' : 'text-purple-600'} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Relatório de Entrevista</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {report.topic}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                darkMode 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              <Download size={18} />
              Baixar PDF
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition ${
                darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={reportRef} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl text-center ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
              <User size={24} className={`mx-auto mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Candidato</p>
              <p className="font-semibold">{report.candidateName}</p>
            </div>
            <div className={`p-4 rounded-xl text-center ${getScoreBg(report.overallScore)}`}>
              <Target size={24} className={`mx-auto mb-2 ${getScoreColor(report.overallScore)}`} />
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Score Geral</p>
              <p className={`text-2xl font-bold ${getScoreColor(report.overallScore)}`}>{report.overallScore}</p>
            </div>
            <div className={`p-4 rounded-xl text-center ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
              <TrendingUp size={24} className={`mx-auto mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Senioridade</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getSeniorityBadge()}`}>
                {report.seniorityLevel.level.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Recommendation */}
          <div className={`p-4 rounded-xl border ${getRecommendationBg()}`}>
            <div className="flex items-start gap-3">
              {getRecommendationIcon()}
              <div>
                <h3 className="font-semibold">{report.recommendation.title}</h3>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {report.recommendation.description}
                </p>
              </div>
            </div>
          </div>

          {/* Soft Skills */}
          <div>
            <h3 className={`flex items-center gap-2 text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              <Brain size={20} className={darkMode ? 'text-purple-400' : 'text-purple-600'} />
              Soft Skills
            </h3>
            <div className="space-y-4">
              {report.softSkills.map((skill, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {skill.name}
                    </span>
                    <span className={`text-sm font-semibold ${getScoreColor(skill.score)}`}>
                      {skill.score}%
                    </span>
                  </div>
                  <div className={`h-2 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        skill.score >= 70 ? 'bg-green-500' : skill.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${skill.score}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {skill.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Analysis */}
          <div>
            <h3 className={`flex items-center gap-2 text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              <Briefcase size={20} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
              Análise Técnica
            </h3>
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                  Área: <strong>{report.technicalAnalysis.area}</strong>
                </span>
                <span className={`font-semibold ${getScoreColor(report.technicalAnalysis.score)}`}>
                  {report.technicalAnalysis.score}%
                </span>
              </div>
              
              {/* Alinhamento com a vaga */}
              {report.technicalAnalysis.alignment !== undefined && (
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Alinhamento com a vaga
                    </span>
                    <span className={`text-sm font-semibold ${getScoreColor(report.technicalAnalysis.alignment)}`}>
                      {report.technicalAnalysis.alignment}%
                    </span>
                  </div>
                  <div className={`h-2 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        report.technicalAnalysis.alignment >= 70 ? 'bg-green-500' : 
                        report.technicalAnalysis.alignment >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${report.technicalAnalysis.alignment}%` }}
                    />
                  </div>
                </div>
              )}
              
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {report.technicalAnalysis.description}
              </p>
              
              {/* Tecnologias da vaga */}
              {report.jobTechnologies && report.jobTechnologies.length > 0 && (
                <div className="mt-3">
                  <p className={`text-xs mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Tecnologias requeridas pela vaga:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {report.jobTechnologies.map((tech, i) => {
                      const isRelevant = report.technicalAnalysis.relevantTechnologies?.includes(tech);
                      return (
                        <span
                          key={i}
                          className={`px-2 py-1 rounded text-xs ${
                            isRelevant
                              ? darkMode ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-green-100 text-green-700 border border-green-300'
                              : darkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {isRelevant ? '✓ ' : ''}{tech}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Tecnologias mencionadas pelo candidato */}
              {report.technicalAnalysis.mentionedTechnologies.length > 0 && (
                <div className="mt-3">
                  <p className={`text-xs mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Tecnologias mencionadas pelo candidato:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {report.technicalAnalysis.mentionedTechnologies.map((tech, i) => (
                      <span
                        key={i}
                        className={`px-2 py-1 rounded text-xs ${
                          darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Strengths & Improvements */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-green-900/20' : 'bg-green-50'}`}>
              <h4 className={`font-semibold mb-3 flex items-center gap-2 ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                <CheckCircle size={18} />
                Pontos Fortes
              </h4>
              <ul className="space-y-2">
                {report.strengths.map((strength, i) => (
                  <li key={i} className={`text-sm flex items-start gap-2 ${darkMode ? 'text-green-300' : 'text-green-600'}`}>
                    <span>•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
              <h4 className={`font-semibold mb-3 flex items-center gap-2 ${darkMode ? 'text-orange-400' : 'text-orange-700'}`}>
                <TrendingUp size={18} />
                Pontos a Desenvolver
              </h4>
              <ul className="space-y-2">
                {report.improvements.map((improvement, i) => (
                  <li key={i} className={`text-sm flex items-start gap-2 ${darkMode ? 'text-orange-300' : 'text-orange-600'}`}>
                    <span>•</span>
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Summary */}
          {report.summary && (
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {report.summary}
              </p>
            </div>
          )}

          {/* Recommendation Details */}
          {report.recommendation.details && report.recommendation.details.length > 0 && (
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Detalhes da avaliação:
              </p>
              <ul className="space-y-1">
                {report.recommendation.details.map((detail, i) => (
                  <li key={i} className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    • {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer */}
          <div className={`text-center text-xs pt-4 border-t ${darkMode ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
            <p>Relatório gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')}</p>
            <p>
              {report.candidateResponseCount !== undefined 
                ? `${report.candidateResponseCount} respostas do candidato analisadas`
                : `${report.transcriptionCount} transcrições analisadas`
              }
              {report.questionsAskedCount !== undefined && ` • ${report.questionsAskedCount} perguntas feitas`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
