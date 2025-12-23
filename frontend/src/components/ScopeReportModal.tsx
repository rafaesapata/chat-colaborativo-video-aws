import { useRef } from 'react';
import {
  X,
  Download,
  FileText,
  Target,
  Layers,
  AlertTriangle,
  CheckCircle,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import { useState } from 'react';
import { ScopeSummary, ScopeRequirement, ScopeFeature } from '../services/scopeAIService';

interface ScopeReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ScopeSummary | null;
  darkMode: boolean;
}

export default function ScopeReportModal({
  isOpen,
  onClose,
  summary,
  darkMode,
}: ScopeReportModalProps) {
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !summary) return null;

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'must-have': return '🔴 Must Have';
      case 'should-have': return '🟡 Should Have';
      case 'nice-to-have': return '🟢 Nice to Have';
      default: return priority;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'functional': return 'Funcional';
      case 'non-functional': return 'Não-Funcional';
      case 'technical': return 'Técnico';
      case 'business': return 'Negócio';
      default: return type;
    }
  };

  const getComplexityLabel = (complexity: string) => {
    switch (complexity) {
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return complexity;
    }
  };

  const groupedRequirements = {
    'must-have': summary.requirements.filter(r => r.priority === 'must-have'),
    'should-have': summary.requirements.filter(r => r.priority === 'should-have'),
    'nice-to-have': summary.requirements.filter(r => r.priority === 'nice-to-have'),
  };

  const generateMarkdown = () => {
    let md = `# LRD - Lista de Requisitos de Desenvolvimento\n\n`;
    md += `## ${summary.projectName || 'Projeto'}\n\n`;
    md += `**Data:** ${new Date(summary.lastUpdated).toLocaleDateString('pt-BR')}\n`;
    md += `**Completude:** ${summary.completeness}%\n\n`;
    md += `---\n\n`;
    md += `## 1. Objetivo\n\n${summary.objective || 'A definir'}\n\n`;
    md += `---\n\n`;
    md += `## 2. Requisitos\n\n`;

    Object.entries(groupedRequirements).forEach(([priority, reqs]) => {
      if (reqs.length > 0) {
        md += `### ${getPriorityLabel(priority)}\n\n`;
        reqs.forEach((r, i) => {
          md += `#### ${i + 1}. ${r.title}\n`;
          md += `- **Tipo:** ${getTypeLabel(r.type)}\n`;
          md += `- **Status:** ${r.status === 'confirmed' ? '✅ Confirmado' : r.status === 'clarified' ? '🔄 Clarificado' : '⏳ Identificado'}\n`;
          md += `- **Descrição:** ${r.description}\n\n`;
        });
      }
    });

    if (summary.features.length > 0) {
      md += `---\n\n## 3. Features\n\n`;
      summary.features.forEach((f, i) => {
        md += `### ${i + 1}. ${f.name}\n`;
        md += `- **Complexidade:** ${getComplexityLabel(f.complexity)}\n`;
        md += `- **Requisitos:** ${f.requirements.length}\n`;
        md += `- **Descrição:** ${f.description}\n\n`;
      });
    }

    if (summary.openQuestions.length > 0) {
      md += `---\n\n## 4. Questões em Aberto\n\n`;
      summary.openQuestions.forEach((q, i) => { md += `${i + 1}. ${q}\n`; });
      md += '\n';
    }

    if (summary.risks.length > 0) {
      md += `---\n\n## 5. Riscos Identificados\n\n`;
      summary.risks.forEach((r, i) => { md += `${i + 1}. ⚠️ ${r}\n`; });
      md += '\n';
    }

    if (summary.nextSteps.length > 0) {
      md += `---\n\n## 6. Próximos Passos\n\n`;
      summary.nextSteps.forEach((s, i) => { md += `${i + 1}. ${s}\n`; });
    }

    return md;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(generateMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = () => {
    const printContent = reportRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>LRD - ${summary.projectName || 'Projeto'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; }
          h1 { font-size: 24px; margin-bottom: 8px; color: #0d9488; }
          h2 { font-size: 18px; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #0d9488; }
          h3 { font-size: 14px; margin: 16px 0 8px; color: #374151; }
          p { margin: 8px 0; font-size: 13px; }
          .header { text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
          .meta { display: flex; justify-content: center; gap: 24px; font-size: 12px; color: #6b7280; margin-top: 8px; }
          .section { margin-bottom: 24px; }
          .requirement { background: #f9fafb; padding: 12px; border-radius: 8px; margin: 8px 0; border-left: 4px solid #0d9488; }
          .requirement-title { font-weight: 600; margin-bottom: 4px; }
          .requirement-meta { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
          .feature { background: #f0fdfa; padding: 12px; border-radius: 8px; margin: 8px 0; }
          .priority-must { border-left-color: #ef4444; }
          .priority-should { border-left-color: #f59e0b; }
          .priority-nice { border-left-color: #22c55e; }
          .risk { background: #fef3c7; padding: 8px 12px; border-radius: 6px; margin: 4px 0; font-size: 12px; }
          .question { background: #dbeafe; padding: 8px 12px; border-radius: 6px; margin: 4px 0; font-size: 12px; }
          .step { padding: 8px 0; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
          .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin: 8px 0; }
          .progress-fill { height: 100%; background: #0d9488; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          .badge-must { background: #fee2e2; color: #dc2626; }
          .badge-should { background: #fef3c7; color: #d97706; }
          .badge-nice { background: #dcfce7; color: #16a34a; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 LRD - Lista de Requisitos de Desenvolvimento</h1>
          <p style="font-size: 16px; color: #374151; margin-top: 8px;">${summary.projectName || 'Projeto'}</p>
          <div class="meta">
            <span>📅 ${new Date(summary.lastUpdated).toLocaleDateString('pt-BR')}</span>
            <span>📊 Completude: ${summary.completeness}%</span>
            <span>📝 ${summary.requirements.length} requisitos</span>
            <span>📦 ${summary.features.length} features</span>
          </div>
          <div class="progress-bar" style="max-width: 300px; margin: 16px auto;">
            <div class="progress-fill" style="width: ${summary.completeness}%;"></div>
          </div>
        </div>

        <div class="section">
          <h2>1. Objetivo do Projeto</h2>
          <p>${summary.objective || 'A ser definido durante o levantamento.'}</p>
        </div>

        <div class="section">
          <h2>2. Requisitos Identificados</h2>
          ${Object.entries(groupedRequirements).map(([priority, reqs]) => reqs.length > 0 ? `
            <h3>${getPriorityLabel(priority)} (${reqs.length})</h3>
            ${reqs.map(r => `
              <div class="requirement priority-${priority === 'must-have' ? 'must' : priority === 'should-have' ? 'should' : 'nice'}">
                <div class="requirement-title">${r.title}</div>
                <div class="requirement-meta">
                  <span class="badge badge-${priority === 'must-have' ? 'must' : priority === 'should-have' ? 'should' : 'nice'}">${getTypeLabel(r.type)}</span>
                  ${r.status === 'confirmed' ? '✅ Confirmado' : r.status === 'clarified' ? '🔄 Clarificado' : '⏳ Identificado'}
                </div>
                <p>${r.description}</p>
              </div>
            `).join('')}
          ` : '').join('')}
        </div>

        ${summary.features.length > 0 ? `
        <div class="section">
          <h2>3. Features / Módulos</h2>
          ${summary.features.map((f, i) => `
            <div class="feature">
              <div class="requirement-title">${i + 1}. ${f.name}</div>
              <div class="requirement-meta">Complexidade: ${getComplexityLabel(f.complexity)} | ${f.requirements.length} requisito(s)</div>
              <p>${f.description}</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${summary.openQuestions.length > 0 ? `
        <div class="section">
          <h2>4. Questões em Aberto</h2>
          ${summary.openQuestions.map((q, i) => `<div class="question">${i + 1}. ${q}</div>`).join('')}
        </div>
        ` : ''}

        ${summary.risks.length > 0 ? `
        <div class="section">
          <h2>5. Riscos Identificados</h2>
          ${summary.risks.map((r, i) => `<div class="risk">⚠️ ${r}</div>`).join('')}
        </div>
        ` : ''}

        ${summary.nextSteps.length > 0 ? `
        <div class="section">
          <h2>6. Próximos Passos</h2>
          ${summary.nextSteps.map((s, i) => `<div class="step">${i + 1}. ${s}</div>`).join('')}
        </div>
        ` : ''}

        <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af;">
          Documento gerado automaticamente pelo Assistente de Escopo | ${new Date().toLocaleString('pt-BR')}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
        darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          darkMode ? 'border-gray-700 bg-gradient-to-r from-teal-900 to-cyan-900' : 'border-gray-200 bg-gradient-to-r from-teal-500 to-cyan-500'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">LRD - Lista de Requisitos</h2>
              <p className="text-xs text-white/70">{summary.projectName || 'Documento de Escopo'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30 transition"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar MD'}
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-teal-700 text-sm font-medium hover:bg-gray-100 transition"
            >
              <Download size={16} />
              Exportar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={reportRef} className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-teal-500" />
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Completude</span>
              </div>
              <div className="text-2xl font-bold">{summary.completeness}%</div>
              <div className={`h-2 rounded-full mt-2 ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                <div className={`h-full rounded-full ${
                  summary.completeness >= 70 ? 'bg-green-500' : summary.completeness >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`} style={{ width: `${summary.completeness}%` }} />
              </div>
            </div>
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-green-500" />
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Requisitos</span>
              </div>
              <div className="text-2xl font-bold">{summary.requirements.length}</div>
              <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {summary.requirements.filter(r => r.status === 'confirmed').length} confirmados
              </div>
            </div>
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Layers size={16} className="text-blue-500" />
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Features</span>
              </div>
              <div className="text-2xl font-bold">{summary.features.length}</div>
              <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                módulos identificados
              </div>
            </div>
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-orange-500" />
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Pendências</span>
              </div>
              <div className="text-2xl font-bold">{summary.openQuestions.length + summary.risks.length}</div>
              <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                questões/riscos
              </div>
            </div>
          </div>

          {/* Objective */}
          <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-teal-900/30 border border-teal-700/50' : 'bg-teal-50 border border-teal-200'}`}>
            <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-teal-300' : 'text-teal-700'}`}>
              <Target size={16} /> Objetivo do Projeto
            </h3>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {summary.objective || 'Objetivo a ser definido durante o levantamento de requisitos.'}
            </p>
          </div>

          {/* Requirements by Priority */}
          <div className="mb-6">
            <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              📋 Requisitos por Prioridade
            </h3>
            {Object.entries(groupedRequirements).map(([priority, reqs]) => reqs.length > 0 && (
              <div key={priority} className="mb-4">
                <div className={`text-xs font-medium mb-2 ${
                  priority === 'must-have' ? 'text-red-500' : priority === 'should-have' ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {getPriorityLabel(priority)} ({reqs.length})
                </div>
                <div className="space-y-2">
                  {reqs.map((req) => (
                    <div key={req.id} className={`p-3 rounded-lg border-l-4 ${
                      priority === 'must-have'
                        ? darkMode ? 'bg-red-900/20 border-red-500' : 'bg-red-50 border-red-500'
                        : priority === 'should-have'
                        ? darkMode ? 'bg-yellow-900/20 border-yellow-500' : 'bg-yellow-50 border-yellow-500'
                        : darkMode ? 'bg-green-900/20 border-green-500' : 'bg-green-50 border-green-500'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          {req.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                            {getTypeLabel(req.type)}
                          </span>
                          <span className={`text-[10px] ${
                            req.status === 'confirmed' ? 'text-green-500' : req.status === 'clarified' ? 'text-yellow-500' : 'text-gray-400'
                          }`}>
                            {req.status === 'confirmed' ? '✅' : req.status === 'clarified' ? '🔄' : '⏳'}
                          </span>
                        </div>
                      </div>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{req.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Features */}
          {summary.features.length > 0 && (
            <div className="mb-6">
              <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                📦 Features / Módulos
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {summary.features.map((feat) => (
                  <div key={feat.id} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {feat.name}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
                        feat.complexity === 'high'
                          ? darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
                          : feat.complexity === 'medium'
                          ? darkMode ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                          : darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                      }`}>
                        {getComplexityLabel(feat.complexity)}
                      </span>
                    </div>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{feat.description}</p>
                    <div className={`text-[10px] mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {feat.requirements.length} requisito(s) associado(s)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open Questions & Risks */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {summary.openQuestions.length > 0 && (
              <div>
                <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  <Clock size={14} /> Questões em Aberto
                </h3>
                <div className="space-y-2">
                  {summary.openQuestions.map((q, i) => (
                    <div key={i} className={`p-2 rounded text-xs ${darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                      {q}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.risks.length > 0 && (
              <div>
                <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  <AlertTriangle size={14} /> Riscos
                </h3>
                <div className="space-y-2">
                  {summary.risks.map((r, i) => (
                    <div key={i} className={`p-2 rounded text-xs ${darkMode ? 'bg-orange-900/30 text-orange-300' : 'bg-orange-50 text-orange-700'}`}>
                      ⚠️ {r}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Next Steps */}
          {summary.nextSteps.length > 0 && (
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                🚀 Próximos Passos
              </h3>
              <div className="space-y-2">
                {summary.nextSteps.map((step, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      darkMode ? 'bg-teal-900 text-teal-300' : 'bg-teal-100 text-teal-700'
                    }`}>{i + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Gerado em {new Date(summary.lastUpdated).toLocaleString('pt-BR')}
            </span>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                darkMode ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
            >
              Fechar e Salvar no Histórico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
