// Serviço de IA para Definição de Escopo de Software
// v1.0.0 - Análise em tempo real de requisitos e features

export interface ScopeRequirement {
  id: string;
  title: string;
  description: string;
  type: 'functional' | 'non-functional' | 'technical' | 'business';
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  status: 'identified' | 'clarified' | 'confirmed';
  relatedFeatures: string[];
  questions: string[]; // Perguntas pendentes sobre este requisito
  timestamp: number;
}

export interface ScopeFeature {
  id: string;
  name: string;
  description: string;
  requirements: string[]; // IDs dos requisitos relacionados
  complexity: 'low' | 'medium' | 'high';
  estimatedEffort?: string;
  status: 'draft' | 'defined' | 'approved';
  acceptanceCriteria: string[];
  timestamp: number;
}

export interface ScopeSuggestion {
  id: string;
  type: 'question' | 'clarification' | 'warning' | 'recommendation';
  text: string;
  context: string;
  priority: 'high' | 'medium' | 'low';
  relatedTo?: string; // ID do requisito ou feature relacionado
  isRead: boolean;
  timestamp: number;
}

export interface ScopeSummary {
  projectName: string;
  objective: string;
  requirements: ScopeRequirement[];
  features: ScopeFeature[];
  openQuestions: string[];
  risks: string[];
  nextSteps: string[];
  completeness: number; // 0-100
  lastUpdated: number;
}

// Palavras-chave para detectar tipos de requisitos
const requirementPatterns = {
  functional: [
    /usuário.*pode|deve.*permitir|sistema.*deve|funcionalidade|cadastr|list|edit|exclu|busca|filtr|relat|export|import|notific|alert|dashboard|login|autenticação|permiss/i,
    /tela.*de|página.*de|formulário|botão|menu|modal|popup|interface/i,
  ],
  nonFunctional: [
    /performance|velocidade|tempo.*resposta|latência|disponibilidade|uptime|segurança|criptografia|backup|recuperação|escalabilidade|concurrent|simultâneo/i,
    /acessibilidade|responsivo|mobile|tablet|desktop|browser|compatibilidade/i,
  ],
  technical: [
    /api|rest|graphql|websocket|banco.*dados|database|sql|nosql|cache|redis|aws|azure|cloud|docker|kubernetes|microserviço|monolito|arquitetura/i,
    /framework|biblioteca|linguagem|typescript|javascript|python|java|\.net|react|angular|vue|node/i,
  ],
  business: [
    /negócio|regra.*negócio|processo|workflow|fluxo|aprovação|validação|cálculo|fórmula|integração.*com|parceiro|cliente|fornecedor/i,
    /relatório.*gerencial|kpi|métrica|indicador|meta|objetivo|roi|custo|prazo|orçamento/i,
  ],
};

// Palavras-chave para detectar prioridade
const priorityPatterns = {
  mustHave: [
    /essencial|obrigatório|crítico|fundamental|imprescindível|não.*pode.*faltar|precisa.*ter|deve.*ter|requisito.*mínimo|mvp|primeira.*fase/i,
  ],
  shouldHave: [
    /importante|deveria|seria.*bom|recomendado|segunda.*fase|próxima.*versão/i,
  ],
  niceToHave: [
    /opcional|se.*possível|futuramente|backlog|seria.*legal|diferencial|plus/i,
  ],
};

// Perguntas de clarificação por tipo
const clarificationQuestions: Record<string, string[]> = {
  functional: [
    'Quem são os usuários que vão usar essa funcionalidade?',
    'Qual o fluxo completo dessa funcionalidade?',
    'Existem validações específicas que precisam ser feitas?',
    'Há alguma regra de negócio associada?',
    'Como deve ser o comportamento em caso de erro?',
  ],
  nonFunctional: [
    'Qual o tempo de resposta aceitável?',
    'Quantos usuários simultâneos são esperados?',
    'Qual a disponibilidade esperada (SLA)?',
    'Há requisitos específicos de segurança?',
    'Quais dispositivos/browsers devem ser suportados?',
  ],
  technical: [
    'Há alguma restrição de tecnologia?',
    'Precisa integrar com sistemas existentes?',
    'Qual o ambiente de hospedagem?',
    'Há requisitos de escalabilidade?',
    'Como será feito o deploy?',
  ],
  business: [
    'Pode detalhar essa regra de negócio?',
    'Quem é responsável por aprovar esse fluxo?',
    'Existem exceções a essa regra?',
    'Como funciona esse processo hoje?',
    'Qual o impacto se essa regra não for implementada?',
  ],
  general: [
    'Pode dar um exemplo prático?',
    'Isso é para a primeira versão ou pode ficar para depois?',
    'Há alguma dependência com outras funcionalidades?',
    'Qual a prioridade disso em relação aos outros itens?',
    'Existe algum sistema de referência que podemos usar como base?',
  ],
};

// Detectar tipo de requisito
function detectRequirementType(text: string): ScopeRequirement['type'] {
  const textLower = text.toLowerCase();
  
  for (const pattern of requirementPatterns.technical) {
    if (pattern.test(textLower)) return 'technical';
  }
  for (const pattern of requirementPatterns.business) {
    if (pattern.test(textLower)) return 'business';
  }
  for (const pattern of requirementPatterns.nonFunctional) {
    if (pattern.test(textLower)) return 'non-functional';
  }
  for (const pattern of requirementPatterns.functional) {
    if (pattern.test(textLower)) return 'functional';
  }
  
  return 'functional'; // Default
}

// Detectar prioridade
function detectPriority(text: string): ScopeRequirement['priority'] {
  const textLower = text.toLowerCase();
  
  for (const pattern of priorityPatterns.mustHave) {
    if (pattern.test(textLower)) return 'must-have';
  }
  for (const pattern of priorityPatterns.niceToHave) {
    if (pattern.test(textLower)) return 'nice-to-have';
  }
  for (const pattern of priorityPatterns.shouldHave) {
    if (pattern.test(textLower)) return 'should-have';
  }
  
  return 'should-have'; // Default
}

// Extrair título do requisito
function extractRequirementTitle(text: string): string {
  // Tentar extrair a parte principal
  const cleanText = text.replace(/^(então|aí|e|também|além disso|precisa|precisamos|queremos|quero|deve|deveria)\s*/i, '');
  
  // Pegar as primeiras palavras significativas
  const words = cleanText.split(/\s+/).slice(0, 8);
  let title = words.join(' ');
  
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }
  
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// Detectar se texto contém um requisito
function containsRequirement(text: string): boolean {
  const requirementIndicators = [
    /precisa|precisamos|queremos|quero|deve|deveria|tem que|necessário|importante|essencial/i,
    /funcionalidade|feature|módulo|tela|página|sistema|aplicação/i,
    /usuário.*pode|cliente.*pode|admin.*pode/i,
    /cadastr|list|edit|exclu|busca|filtr|relat|export|import/i,
  ];
  
  return requirementIndicators.some(pattern => pattern.test(text));
}

// Gerar perguntas de clarificação
function generateClarificationQuestions(requirement: ScopeRequirement): string[] {
  const questions: string[] = [];
  const typeQuestions = clarificationQuestions[requirement.type] || [];
  const generalQuestions = clarificationQuestions.general;
  
  // Adicionar 1-2 perguntas específicas do tipo
  const shuffledType = [...typeQuestions].sort(() => Math.random() - 0.5);
  questions.push(...shuffledType.slice(0, 2));
  
  // Adicionar 1 pergunta geral
  const shuffledGeneral = [...generalQuestions].sort(() => Math.random() - 0.5);
  questions.push(shuffledGeneral[0]);
  
  return questions;
}

// Estimar complexidade de feature
function estimateComplexity(feature: Partial<ScopeFeature>, requirements: ScopeRequirement[]): ScopeFeature['complexity'] {
  const relatedReqs = requirements.filter(r => feature.requirements?.includes(r.id));
  
  // Fatores de complexidade
  let score = 0;
  
  // Número de requisitos
  score += relatedReqs.length * 2;
  
  // Tipos de requisitos
  if (relatedReqs.some(r => r.type === 'technical')) score += 3;
  if (relatedReqs.some(r => r.type === 'non-functional')) score += 2;
  if (relatedReqs.some(r => r.type === 'business')) score += 2;
  
  // Prioridade
  if (relatedReqs.some(r => r.priority === 'must-have')) score += 2;
  
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}


// ============ SERVIÇO PRINCIPAL ============

export const scopeAIService = {
  // Analisar transcrição e extrair requisitos
  analyzeTranscription(
    text: string,
    existingRequirements: ScopeRequirement[]
  ): { newRequirement: ScopeRequirement | null; suggestion: ScopeSuggestion | null } {
    if (!text || text.length < 20) {
      return { newRequirement: null, suggestion: null };
    }

    // Verificar se contém um requisito
    if (containsRequirement(text)) {
      // Verificar se não é duplicado
      const isDuplicate = existingRequirements.some(r => 
        r.title.toLowerCase().includes(extractRequirementTitle(text).toLowerCase().substring(0, 20)) ||
        text.toLowerCase().includes(r.title.toLowerCase().substring(0, 20))
      );

      if (!isDuplicate) {
        const type = detectRequirementType(text);
        const priority = detectPriority(text);
        const title = extractRequirementTitle(text);
        
        const newRequirement: ScopeRequirement = {
          id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title,
          description: text,
          type,
          priority,
          status: 'identified',
          relatedFeatures: [],
          questions: generateClarificationQuestions({ type, title, description: text } as ScopeRequirement),
          timestamp: Date.now(),
        };

        // Gerar sugestão de clarificação
        const suggestion: ScopeSuggestion = {
          id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'question',
          text: newRequirement.questions[0] || 'Pode detalhar melhor esse requisito?',
          context: `Novo requisito identificado: ${title}`,
          priority: priority === 'must-have' ? 'high' : 'medium',
          relatedTo: newRequirement.id,
          isRead: false,
          timestamp: Date.now(),
        };

        return { newRequirement, suggestion };
      }
    }

    return { newRequirement: null, suggestion: null };
  },

  // Gerar sugestões baseadas no contexto
  generateSuggestions(
    summary: ScopeSummary,
    recentText: string
  ): ScopeSuggestion[] {
    const suggestions: ScopeSuggestion[] = [];

    // Verificar requisitos sem clarificação
    const unclarifiedReqs = summary.requirements.filter(r => r.status === 'identified');
    if (unclarifiedReqs.length > 0) {
      const req = unclarifiedReqs[0];
      if (req.questions.length > 0) {
        suggestions.push({
          id: `sug_${Date.now()}_clarify`,
          type: 'clarification',
          text: req.questions[0],
          context: `Requisito pendente: ${req.title}`,
          priority: 'high',
          relatedTo: req.id,
          isRead: false,
          timestamp: Date.now(),
        });
      }
    }

    // Verificar se falta informação importante
    if (summary.requirements.length > 0 && summary.features.length === 0) {
      suggestions.push({
        id: `sug_${Date.now()}_features`,
        type: 'recommendation',
        text: 'Já temos alguns requisitos. Que tal agrupar em features/módulos?',
        context: 'Organização do escopo',
        priority: 'medium',
        isRead: false,
        timestamp: Date.now(),
      });
    }

    // Verificar requisitos não-funcionais
    const hasNonFunctional = summary.requirements.some(r => r.type === 'non-functional');
    if (summary.requirements.length >= 3 && !hasNonFunctional) {
      suggestions.push({
        id: `sug_${Date.now()}_nfr`,
        type: 'warning',
        text: 'Não identificamos requisitos não-funcionais. Qual a expectativa de performance e segurança?',
        context: 'Requisitos não-funcionais',
        priority: 'medium',
        isRead: false,
        timestamp: Date.now(),
      });
    }

    // Verificar priorização
    const mustHaveCount = summary.requirements.filter(r => r.priority === 'must-have').length;
    if (summary.requirements.length >= 5 && mustHaveCount === 0) {
      suggestions.push({
        id: `sug_${Date.now()}_priority`,
        type: 'question',
        text: 'Quais desses requisitos são essenciais para a primeira versão (MVP)?',
        context: 'Priorização',
        priority: 'high',
        isRead: false,
        timestamp: Date.now(),
      });
    }

    return suggestions.slice(0, 3); // Máximo 3 sugestões
  },

  // Agrupar requisitos em features
  groupRequirementsIntoFeatures(requirements: ScopeRequirement[]): ScopeFeature[] {
    const features: ScopeFeature[] = [];
    const usedReqIds = new Set<string>();

    // Agrupar por palavras-chave comuns
    const featureKeywords: Record<string, string[]> = {
      'Autenticação e Usuários': ['login', 'usuário', 'senha', 'autenticação', 'permissão', 'perfil', 'cadastro.*usuário'],
      'Dashboard e Relatórios': ['dashboard', 'relatório', 'gráfico', 'indicador', 'kpi', 'métrica'],
      'Cadastros': ['cadastro', 'crud', 'listar', 'editar', 'excluir', 'formulário'],
      'Integrações': ['integração', 'api', 'importar', 'exportar', 'sincronizar'],
      'Notificações': ['notificação', 'alerta', 'email', 'sms', 'push'],
      'Configurações': ['configuração', 'parâmetro', 'ajuste', 'preferência'],
    };

    for (const [featureName, keywords] of Object.entries(featureKeywords)) {
      const relatedReqs = requirements.filter(req => {
        if (usedReqIds.has(req.id)) return false;
        const text = `${req.title} ${req.description}`.toLowerCase();
        return keywords.some(kw => new RegExp(kw, 'i').test(text));
      });

      if (relatedReqs.length > 0) {
        const feature: ScopeFeature = {
          id: `feat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: featureName,
          description: `Funcionalidades relacionadas a ${featureName.toLowerCase()}`,
          requirements: relatedReqs.map(r => r.id),
          complexity: 'medium',
          status: 'draft',
          acceptanceCriteria: [],
          timestamp: Date.now(),
        };
        
        feature.complexity = estimateComplexity(feature, requirements);
        features.push(feature);
        
        relatedReqs.forEach(r => usedReqIds.add(r.id));
      }
    }

    // Requisitos não agrupados viram feature "Outros"
    const ungroupedReqs = requirements.filter(r => !usedReqIds.has(r.id));
    if (ungroupedReqs.length > 0) {
      features.push({
        id: `feat_${Date.now()}_other`,
        name: 'Outras Funcionalidades',
        description: 'Requisitos ainda não categorizados',
        requirements: ungroupedReqs.map(r => r.id),
        complexity: estimateComplexity({ requirements: ungroupedReqs.map(r => r.id) }, requirements),
        status: 'draft',
        acceptanceCriteria: [],
        timestamp: Date.now(),
      });
    }

    return features;
  },

  // Calcular completude do escopo
  calculateCompleteness(summary: ScopeSummary): number {
    let score = 0;
    const maxScore = 100;

    // Tem objetivo definido (20%)
    if (summary.objective && summary.objective.length > 10) score += 20;

    // Tem requisitos (30%)
    if (summary.requirements.length > 0) {
      score += Math.min(30, summary.requirements.length * 5);
    }

    // Requisitos clarificados (15%)
    const clarifiedCount = summary.requirements.filter(r => r.status !== 'identified').length;
    if (summary.requirements.length > 0) {
      score += Math.round((clarifiedCount / summary.requirements.length) * 15);
    }

    // Tem features definidas (20%)
    if (summary.features.length > 0) {
      score += Math.min(20, summary.features.length * 5);
    }

    // Tem requisitos não-funcionais (10%)
    if (summary.requirements.some(r => r.type === 'non-functional')) score += 10;

    // Poucas questões abertas (5%)
    if (summary.openQuestions.length <= 2) score += 5;

    return Math.min(maxScore, score);
  },

  // Gerar resumo do escopo
  generateSummary(
    projectName: string,
    objective: string,
    requirements: ScopeRequirement[],
    features: ScopeFeature[]
  ): ScopeSummary {
    const openQuestions: string[] = [];
    requirements.forEach(r => {
      if (r.status === 'identified' && r.questions.length > 0) {
        openQuestions.push(`[${r.title}] ${r.questions[0]}`);
      }
    });

    const risks: string[] = [];
    
    // Identificar riscos
    if (requirements.filter(r => r.priority === 'must-have').length === 0) {
      risks.push('Priorização não definida - risco de escopo indefinido');
    }
    if (!requirements.some(r => r.type === 'non-functional')) {
      risks.push('Requisitos não-funcionais não identificados');
    }
    if (requirements.length > 10 && features.length === 0) {
      risks.push('Muitos requisitos sem agrupamento em features');
    }

    const nextSteps: string[] = [];
    if (requirements.some(r => r.status === 'identified')) {
      nextSteps.push('Clarificar requisitos pendentes');
    }
    if (features.length === 0 && requirements.length > 3) {
      nextSteps.push('Agrupar requisitos em features');
    }
    if (!requirements.some(r => r.type === 'non-functional')) {
      nextSteps.push('Definir requisitos não-funcionais');
    }
    nextSteps.push('Validar escopo com stakeholders');

    const summary: ScopeSummary = {
      projectName,
      objective,
      requirements,
      features,
      openQuestions: openQuestions.slice(0, 5),
      risks,
      nextSteps,
      completeness: 0,
      lastUpdated: Date.now(),
    };

    summary.completeness = this.calculateCompleteness(summary);

    return summary;
  },

  // Exportar escopo como markdown
  exportAsMarkdown(summary: ScopeSummary): string {
    let md = `# Documento de Escopo: ${summary.projectName}\n\n`;
    md += `**Gerado em:** ${new Date(summary.lastUpdated).toLocaleString('pt-BR')}\n`;
    md += `**Completude:** ${summary.completeness}%\n\n`;

    md += `## Objetivo\n${summary.objective || 'A definir'}\n\n`;

    md += `## Requisitos (${summary.requirements.length})\n\n`;
    
    const reqsByType = {
      'must-have': summary.requirements.filter(r => r.priority === 'must-have'),
      'should-have': summary.requirements.filter(r => r.priority === 'should-have'),
      'nice-to-have': summary.requirements.filter(r => r.priority === 'nice-to-have'),
    };

    for (const [priority, reqs] of Object.entries(reqsByType)) {
      if (reqs.length > 0) {
        md += `### ${priority === 'must-have' ? '🔴 Must Have' : priority === 'should-have' ? '🟡 Should Have' : '🟢 Nice to Have'}\n\n`;
        reqs.forEach(r => {
          md += `- **${r.title}** [${r.type}]\n`;
          md += `  ${r.description}\n\n`;
        });
      }
    }

    if (summary.features.length > 0) {
      md += `## Features (${summary.features.length})\n\n`;
      summary.features.forEach(f => {
        md += `### ${f.name}\n`;
        md += `- **Complexidade:** ${f.complexity}\n`;
        md += `- **Requisitos:** ${f.requirements.length}\n`;
        md += `- **Status:** ${f.status}\n\n`;
      });
    }

    if (summary.openQuestions.length > 0) {
      md += `## Questões em Aberto\n\n`;
      summary.openQuestions.forEach(q => md += `- ${q}\n`);
      md += '\n';
    }

    if (summary.risks.length > 0) {
      md += `## Riscos Identificados\n\n`;
      summary.risks.forEach(r => md += `- ⚠️ ${r}\n`);
      md += '\n';
    }

    if (summary.nextSteps.length > 0) {
      md += `## Próximos Passos\n\n`;
      summary.nextSteps.forEach((s, i) => md += `${i + 1}. ${s}\n`);
    }

    return md;
  },
};

export default scopeAIService;
