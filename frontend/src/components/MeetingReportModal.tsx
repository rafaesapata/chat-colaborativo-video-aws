import { useRef } from 'react';
import { X, Download } from 'lucide-react';

interface MeetingReportData {
  title: string;
  executiveSummary: string;
  keyPoints: Array<{ title: string; description: string; category: string }>;
  decisions: Array<{ description: string; responsible: string; deadline: string }>;
  actionItems: Array<{ task: string; owner: string; priority: string; deadline: string }>;
  risks: Array<{ description: string; severity: string; mitigation: string }>;
  openQuestions: string[];
  sentiment: string;
  sentimentDescription: string;
  generatedAt: string;
  meetingType: string;
  participants: string[];
  transcriptionCount: number;
  duration?: number;
  startTime?: number;
}

interface MeetingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: MeetingReportData | null;
  roomId?: string;
}

const ACCENT = {
  blue:   { solid: '#5B8DEF', dim: 'rgba(91, 141, 239, 0.12)' },
  green:  { solid: '#4ADE80', dim: 'rgba(74, 222, 128, 0.10)' },
  amber:  { solid: '#FBBF24', dim: 'rgba(251, 191, 36, 0.10)' },
  rose:   { solid: '#FB7185', dim: 'rgba(251, 113, 133, 0.10)' },
  violet: { solid: '#A78BFA', dim: 'rgba(167, 139, 250, 0.10)' },
  cyan:   { solid: '#22D3EE', dim: 'rgba(34, 211, 238, 0.10)' },
};

function formatDuration(ms?: number): string {
  if (!ms) return '';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function formatDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function categoryIcon(cat: string): string {
  switch (cat) {
    case 'decisao': return '✦';
    case 'problema': return '⚑';
    case 'ideia': return '◆';
    default: return '●';
  }
}

function priorityColor(p: string) {
  switch (p) {
    case 'alta': return ACCENT.rose;
    case 'media': return ACCENT.amber;
    default: return ACCENT.cyan;
  }
}

function severityColor(s: string) {
  switch (s) {
    case 'alto': return ACCENT.rose;
    case 'medio': return ACCENT.amber;
    default: return ACCENT.green;
  }
}

function sentimentInfo(s: string) {
  switch (s) {
    case 'positivo': return { icon: '✦', color: ACCENT.green, label: 'Positivo' };
    case 'negativo': return { icon: '⚑', color: ACCENT.rose, label: 'Negativo' };
    default: return { icon: '◆', color: ACCENT.amber, label: 'Neutro' };
  }
}

function buildReportHTML(report: MeetingReportData, roomId?: string): string {
  const sent = sentimentInfo(report.sentiment);
  const dateStr = formatDate(report.startTime);
  const durStr = formatDuration(report.duration);
  const participantsHTML = report.participants.map(p =>
    `<span class="participant">${p}</span>`
  ).join('');

  const keyPointsHTML = report.keyPoints.map(kp => {
    const catColor = kp.category === 'decisao' ? ACCENT.blue : kp.category === 'problema' ? ACCENT.rose : kp.category === 'ideia' ? ACCENT.violet : ACCENT.cyan;
    return `<li><span class="kp-icon" style="background:${catColor.solid}">${categoryIcon(kp.category)}</span><div><strong style="color:#E8EAF0">${kp.title}</strong><br/><span style="color:#8B8FA3">${kp.description}</span></div></li>`;
  }).join('');

  const decisionsHTML = report.decisions.length > 0 ? report.decisions.map(d =>
    `<div class="step-item"><div class="step-owner">${d.responsible}</div><div class="step-task">${d.description}</div><div><span class="tag" style="background:${ACCENT.blue.dim};color:${ACCENT.blue.solid}">${d.deadline}</span></div></div>`
  ).join('') : '<p class="empty-msg">Nenhuma decisão registrada nesta reunião.</p>';

  const actionsHTML = report.actionItems.length > 0 ? report.actionItems.map(a => {
    const pc = priorityColor(a.priority);
    return `<div class="step-item"><div class="step-owner">${a.owner}</div><div class="step-task">${a.task}</div><div><span class="tag" style="background:${pc.dim};color:${pc.solid}">${a.priority}</span><span class="tag" style="background:${ACCENT.cyan.dim};color:${ACCENT.cyan.solid};margin-left:6px">${a.deadline}</span></div></div>`;
  }).join('') : '<p class="empty-msg">Nenhuma ação pendente identificada.</p>';

  const risksHTML = report.risks.length > 0 ? report.risks.map(r => {
    const sc = severityColor(r.severity);
    return `<div class="callout" style="background:${sc.dim};border-left-color:${sc.solid}"><span class="callout-icon">⚠️</span><div><strong style="color:#E8EAF0">${r.description}</strong><br/><span style="color:#8B8FA3">Severidade: ${r.severity} | Mitigação: ${r.mitigation}</span></div></div>`;
  }).join('') : '';

  const questionsHTML = report.openQuestions.length > 0 ? `<ul class="feature-list">${report.openQuestions.map(q =>
    `<li style="--bullet-color:${ACCENT.amber.solid}">${q}</li>`
  ).join('')}</ul>` : '<p class="empty-msg">Nenhuma questão em aberto.</p>';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0F1117;color:#8B8FA3;font-family:'Source Sans 3',system-ui,sans-serif;font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased}
.noise{position:fixed;top:0;left:0;right:0;bottom:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");pointer-events:none;z-index:9999;opacity:0.03}
.glow-orb{width:600px;height:600px;border-radius:50%;filter:blur(120px);opacity:0.07;position:fixed;pointer-events:none}
.glow-orb.blue{background:#5B8DEF;top:-200px;right:-100px}
.glow-orb.violet{background:#A78BFA;bottom:-200px;left:-100px}
.container{max-width:920px;margin:0 auto;padding:40px 24px 80px;position:relative;z-index:1}
h1{font-family:'DM Serif Display',Georgia,serif;font-size:clamp(32px,5vw,48px);font-weight:400;line-height:1.15;color:#E8EAF0;margin-bottom:8px}
h1 em{color:${ACCENT.blue.solid};font-style:italic}
h2{font-family:'DM Serif Display',Georgia,serif;font-size:24px;font-weight:400;color:#E8EAF0}
.sub-title{font-family:'Source Sans 3';font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:24px 0 12px}
.header{margin-bottom:56px;padding-bottom:40px;border-bottom:1px solid #2A2E3B}
.header-label{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:400;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px}
.meta-row{display:flex;flex-wrap:wrap;gap:24px;margin:16px 0}
.meta-item{display:flex;align-items:center;gap:8px;font-size:14px;color:#8B8FA3}
.meta-item svg{opacity:0.5}
.participants{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.participant{padding:6px 14px;border-radius:100px;border:1px solid #2A2E3B;background:#181B25;color:#8B8FA3;font-size:13px;font-weight:600;transition:all 0.2s}
.section{margin-bottom:48px;animation:fadeUp 0.7s ease-out both}
.section:nth-child(2){animation-delay:0.1s}.section:nth-child(3){animation-delay:0.15s}.section:nth-child(4){animation-delay:0.2s}.section:nth-child(5){animation-delay:0.25s}.section:nth-child(6){animation-delay:0.3s}.section:nth-child(7){animation-delay:0.35s}
.section-header{display:flex;align-items:center;gap:14px;margin-bottom:20px}
.section-num{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;flex-shrink:0}
.card{background:#181B25;border:1px solid #2A2E3B;border-radius:16px;padding:28px 32px;transition:border-color 0.3s,background 0.3s}
.card:hover{border-color:#3B4058;background:#1E2230}
.card p{color:#8B8FA3;font-size:15px;line-height:1.75;margin-bottom:16px}
.card p:last-child{margin-bottom:0}
.card strong{color:#E8EAF0}
.feature-list{list-style:none;display:flex;flex-direction:column;gap:10px;margin:16px 0;padding:0}
.feature-list li{display:flex;gap:12px;align-items:flex-start;font-size:15px;color:#8B8FA3;line-height:1.65}
.feature-list li::before{content:'';flex-shrink:0;width:6px;height:6px;border-radius:50%;margin-top:9px;background:var(--bullet-color,#5B8DEF)}
.kp-list{list-style:none;display:flex;flex-direction:column;gap:14px;margin:16px 0;padding:0}
.kp-list li{display:flex;gap:14px;align-items:flex-start;font-size:15px;line-height:1.65}
.kp-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;color:#fff;margin-top:2px}
.callout{display:flex;gap:14px;padding:18px 20px;border-radius:12px;margin:18px 0;font-size:14px;line-height:1.65;border-left:3px solid}
.callout-icon{font-size:18px;flex-shrink:0}
.verdict{display:flex;align-items:center;gap:10px;padding:14px 20px;border-radius:10px;margin-top:18px;font-size:14px;font-weight:600}
.step-item{display:grid;grid-template-columns:140px 1fr auto;gap:16px;align-items:center;padding:16px 20px;background:#181B25;border:1px solid #2A2E3B;border-radius:12px;margin-bottom:8px;transition:border-color 0.3s,background 0.3s}
.step-item:hover{border-color:#3B4058;background:#1E2230}
.step-owner{font-size:14px;font-weight:700;color:#E8EAF0}
.step-task{font-size:14px;color:#8B8FA3}
.tag{display:inline-block;font-size:11px;font-weight:600;padding:3px 10px;border-radius:6px;letter-spacing:0.5px}
.divider{height:1px;background:linear-gradient(90deg,transparent,#2A2E3B,transparent);margin:40px 0}
.empty-msg{color:#5D6178;font-size:14px;font-style:italic}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:640px){.container{padding:24px 16px 60px}.card{padding:20px}.meta-row{gap:14px}.step-item{grid-template-columns:1fr}}
</style></head><body>
<div class="noise"></div>
<div class="glow-orb blue"></div>
<div class="glow-orb violet"></div>
<div class="container">
  <div class="header">
    <div class="header-label" style="background:${ACCENT.blue.dim};color:${ACCENT.blue.solid}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
      Relatório de Reunião
    </div>
    <h1><em>${report.title}</em></h1>
    <div class="meta-row">
      ${roomId ? `<div class="meta-item"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${roomId}</div>` : ''}
      ${dateStr ? `<div class="meta-item"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${dateStr}</div>` : ''}
      ${durStr ? `<div class="meta-item"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>${durStr}</div>` : ''}
      <div class="meta-item"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${report.transcriptionCount} transcrições</div>
    </div>
    ${participantsHTML ? `<div class="participants">${participantsHTML}</div>` : ''}
  </div>

  <!-- Resumo Executivo -->
  <div class="section">
    <div class="section-header">
      <div class="section-num" style="background:${ACCENT.blue.dim};color:${ACCENT.blue.solid}">01</div>
      <h2>Resumo Executivo</h2>
    </div>
    <div class="card">
      <p>${report.executiveSummary}</p>
      <div class="verdict" style="background:${sent.color.dim};color:${sent.color.solid}">
        <span>${sent.icon}</span> Tom da reunião: ${sent.label}${report.sentimentDescription ? ` — ${report.sentimentDescription}` : ''}
      </div>
    </div>
  </div>

  <!-- Pontos-Chave -->
  ${report.keyPoints.length > 0 ? `<div class="section">
    <div class="section-header">
      <div class="section-num" style="background:${ACCENT.green.dim};color:${ACCENT.green.solid}">02</div>
      <h2>Pontos-Chave Discutidos</h2>
    </div>
    <div class="card">
      <ul class="kp-list">${keyPointsHTML}</ul>
    </div>
  </div>` : ''}

  <!-- Decisões -->
  <div class="section">
    <div class="section-header">
      <div class="section-num" style="background:${ACCENT.amber.dim};color:${ACCENT.amber.solid}">03</div>
      <h2>Decisões Tomadas</h2>
    </div>
    ${decisionsHTML}
  </div>

  <!-- Ações -->
  <div class="section">
    <div class="section-header">
      <div class="section-num" style="background:${ACCENT.cyan.dim};color:${ACCENT.cyan.solid}">04</div>
      <h2>Próximos Passos</h2>
    </div>
    ${actionsHTML}
  </div>

  <!-- Riscos -->
  ${report.risks.length > 0 ? `<div class="section">
    <div class="section-header">
      <div class="section-num" style="background:${ACCENT.rose.dim};color:${ACCENT.rose.solid}">05</div>
      <h2>Riscos e Preocupações</h2>
    </div>
    <div class="card">${risksHTML}</div>
  </div>` : ''}

  <!-- Questões em Aberto -->
  ${report.openQuestions.length > 0 ? `<div class="section">
    <div class="section-header">
      <div class="section-num" style="background:${ACCENT.violet.dim};color:${ACCENT.violet.solid}">${report.risks.length > 0 ? '06' : '05'}</div>
      <h2>Questões em Aberto</h2>
    </div>
    <div class="card">${questionsHTML}</div>
  </div>` : ''}

  <div class="divider"></div>
  <p style="text-align:center;font-size:12px;color:#5D6178;font-family:'JetBrains Mono',monospace;letter-spacing:1px">Relatório gerado automaticamente por IA em ${new Date(report.generatedAt).toLocaleString('pt-BR')}</p>
</div>
</body></html>`;
}

export default function MeetingReportModal({ isOpen, onClose, report, roomId }: MeetingReportModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!isOpen || !report) return null;

  const html = buildReportHTML(report, roomId);

  const handleDownloadPDF = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    
    // Inject print styles for clean PDF output
    const style = iframe.contentDocument?.createElement('style');
    if (style) {
      style.textContent = `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 10mm; size: A4; }
        }
      `;
      iframe.contentDocument?.head?.appendChild(style);
    }
    iframe.contentWindow.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-[1400px] h-[95vh] rounded-2xl overflow-hidden border border-border-dark bg-[#0F1117] shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-dark/50 bg-[#181B25]">
          <h3 className="text-white font-semibold text-lg">Relatório da Reunião</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition text-sm font-medium"
            >
              <Download size={16} />
              Baixar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10/50 text-muted-dark hover:text-white transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          className="flex-1 w-full border-0"
          title="Relatório da Reunião"
          sandbox="allow-same-origin allow-modals"
        />
      </div>
    </div>
  );
}

export type { MeetingReportData };
