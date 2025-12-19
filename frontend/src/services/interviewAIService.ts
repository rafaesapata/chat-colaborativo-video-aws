// Serviço de IA para gerar perguntas de entrevista

export interface InterviewSuggestion {
  id: string;
  question: string;
  category: 'technical' | 'behavioral' | 'experience' | 'situational';
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
  isRead: boolean;
}

export interface InterviewContext {
  meetingType: 'ENTREVISTA' | 'REUNIAO' | 'TREINAMENTO' | 'OUTRO';
  topic: string; // Ex: "Desenvolvedor Full Stack Senior"
  transcriptionHistory: string[];
}

// Banco de perguntas por categoria e área
const questionBank = {
  technical: {
    'desenvolvedor': [
      'Pode me explicar a diferença entre REST e GraphQL e quando usar cada um?',
      'Como você lida com gerenciamento de estado em aplicações complexas?',
      'Descreva sua experiência com testes automatizados. Quais tipos você utiliza?',
      'Como você abordaria a otimização de performance de uma aplicação lenta?',
      'Pode explicar o conceito de SOLID e dar um exemplo prático?',
      'Como você implementaria autenticação e autorização em uma API?',
      'Qual sua experiência com CI/CD? Descreva um pipeline que você configurou.',
      'Como você lida com débito técnico em projetos?',
    ],
    'frontend': [
      'Qual sua experiência com React Hooks? Pode dar exemplos de uso?',
      'Como você otimiza o bundle size de uma aplicação React?',
      'Explique a diferença entre SSR, SSG e CSR.',
      'Como você implementa acessibilidade em suas aplicações?',
      'Qual sua abordagem para gerenciamento de estado global?',
    ],
    'backend': [
      'Como você projeta uma API escalável?',
      'Qual sua experiência com bancos de dados NoSQL vs SQL?',
      'Como você implementa cache em aplicações backend?',
      'Descreva sua experiência com microserviços.',
      'Como você lida com transações distribuídas?',
    ],
    'devops': [
      'Qual sua experiência com Kubernetes?',
      'Como você implementa monitoramento e observabilidade?',
      'Descreva sua experiência com Infrastructure as Code.',
      'Como você lida com secrets e configurações sensíveis?',
    ],
    'dados': [
      'Qual sua experiência com ETL e pipelines de dados?',
      'Como você otimiza queries em grandes volumes de dados?',
      'Descreva sua experiência com ferramentas de BI.',
    ],
    'default': [
      'Pode me contar sobre um projeto técnico desafiador que você liderou?',
      'Como você se mantém atualizado com novas tecnologias?',
      'Qual foi o bug mais difícil que você já resolveu?',
    ],
  },
  behavioral: [
    'Conte-me sobre uma situação em que você teve que lidar com um conflito na equipe.',
    'Descreva um momento em que você teve que aprender algo novo rapidamente.',
    'Como você lida com prazos apertados e pressão?',
    'Conte sobre uma vez que você falhou e o que aprendeu com isso.',
    'Como você prioriza suas tarefas quando tem múltiplas demandas?',
    'Descreva uma situação em que você teve que dar feedback difícil.',
    'Como você lida com mudanças de requisitos no meio do projeto?',
  ],
  experience: [
    'O que te motivou a se candidatar para esta vaga?',
    'Onde você se vê profissionalmente em 5 anos?',
    'Qual foi sua maior conquista profissional?',
    'Por que você está deixando seu emprego atual?',
    'O que você sabe sobre nossa empresa?',
  ],
  situational: [
    'Se você discordasse de uma decisão técnica do seu líder, como abordaria?',
    'Como você reagiria se um colega não estivesse entregando sua parte do trabalho?',
    'Se tivesse que escolher entre entregar rápido ou entregar perfeito, o que escolheria?',
    'Como você lidaria com um cliente insatisfeito?',
  ],
};

// Detectar área técnica baseado no tema
function detectTechnicalArea(topic: string): string {
  const topicLower = topic.toLowerCase();
  
  if (topicLower.includes('frontend') || topicLower.includes('react') || topicLower.includes('vue') || topicLower.includes('angular')) {
    return 'frontend';
  }
  if (topicLower.includes('backend') || topicLower.includes('api') || topicLower.includes('node') || topicLower.includes('java') || topicLower.includes('python')) {
    return 'backend';
  }
  if (topicLower.includes('devops') || topicLower.includes('sre') || topicLower.includes('cloud') || topicLower.includes('aws') || topicLower.includes('azure')) {
    return 'devops';
  }
  if (topicLower.includes('dados') || topicLower.includes('data') || topicLower.includes('analytics') || topicLower.includes('bi')) {
    return 'dados';
  }
  if (topicLower.includes('desenvolvedor') || topicLower.includes('developer') || topicLower.includes('programador') || topicLower.includes('full stack')) {
    return 'desenvolvedor';
  }
  
  return 'default';
}

// Analisar transcrição para entender contexto
function analyzeTranscription(transcriptions: string[]): {
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  depth: 'shallow' | 'medium' | 'deep';
} {
  const allText = transcriptions.join(' ').toLowerCase();
  
  // Detectar tópicos mencionados
  const topics: string[] = [];
  if (allText.includes('experiência') || allText.includes('trabalhei')) topics.push('experience');
  if (allText.includes('projeto') || allText.includes('desenvolvi')) topics.push('projects');
  if (allText.includes('equipe') || allText.includes('time')) topics.push('teamwork');
  if (allText.includes('problema') || allText.includes('desafio')) topics.push('challenges');
  
  // Detectar profundidade da resposta
  const avgLength = transcriptions.length > 0 
    ? transcriptions.reduce((sum, t) => sum + t.length, 0) / transcriptions.length 
    : 0;
  
  let depth: 'shallow' | 'medium' | 'deep' = 'shallow';
  if (avgLength > 200) depth = 'deep';
  else if (avgLength > 100) depth = 'medium';
  
  return { topics, sentiment: 'neutral', depth };
}

export const interviewAIService = {
  // Gerar próximas perguntas baseado no contexto
  generateSuggestions(context: InterviewContext, count: number = 3): InterviewSuggestion[] {
    if (context.meetingType !== 'ENTREVISTA') {
      return [];
    }

    const suggestions: InterviewSuggestion[] = [];
    const usedQuestions = new Set<string>();
    const analysis = analyzeTranscription(context.transcriptionHistory);
    const technicalArea = detectTechnicalArea(context.topic);
    
    // Determinar categorias baseado no progresso da entrevista
    const transcriptionCount = context.transcriptionHistory.length;
    let categories: Array<'technical' | 'behavioral' | 'experience' | 'situational'>;
    
    if (transcriptionCount < 3) {
      // Início: foco em experiência e quebra-gelo
      categories = ['experience', 'behavioral'];
    } else if (transcriptionCount < 10) {
      // Meio: foco técnico
      categories = ['technical', 'technical', 'behavioral'];
    } else {
      // Final: situacional e comportamental
      categories = ['situational', 'behavioral', 'technical'];
    }
    
    // Gerar perguntas
    for (let i = 0; i < count && categories.length > 0; i++) {
      const category = categories[i % categories.length];
      let questionPool: string[];
      
      if (category === 'technical') {
        const techQuestions = questionBank.technical as Record<string, string[]>;
        const areaQuestions = techQuestions[technicalArea] || questionBank.technical.default;
        questionPool = [...areaQuestions, ...questionBank.technical.default];
      } else {
        questionPool = questionBank[category];
      }
      
      // Filtrar perguntas já usadas
      const availableQuestions = questionPool.filter(q => !usedQuestions.has(q));
      
      if (availableQuestions.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        const question = availableQuestions[randomIndex];
        usedQuestions.add(question);
        
        suggestions.push({
          id: `suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          question,
          category,
          priority: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
          timestamp: Date.now(),
          isRead: false,
        });
      }
    }
    
    return suggestions;
  },

  // Gerar pergunta de follow-up baseada na última resposta
  generateFollowUp(lastResponse: string, context: InterviewContext): InterviewSuggestion | null {
    if (context.meetingType !== 'ENTREVISTA' || !lastResponse) {
      return null;
    }

    const responseLower = lastResponse.toLowerCase();
    let followUpQuestion = '';
    let category: 'technical' | 'behavioral' | 'experience' | 'situational' = 'behavioral';
    
    // Detectar oportunidades de follow-up
    if (responseLower.includes('projeto') || responseLower.includes('desenvolvi')) {
      followUpQuestion = 'Pode me dar mais detalhes sobre os desafios técnicos desse projeto?';
      category = 'technical';
    } else if (responseLower.includes('equipe') || responseLower.includes('time')) {
      followUpQuestion = 'Como era a dinâmica de trabalho com essa equipe?';
      category = 'behavioral';
    } else if (responseLower.includes('problema') || responseLower.includes('erro') || responseLower.includes('bug')) {
      followUpQuestion = 'Como você identificou a causa raiz desse problema?';
      category = 'technical';
    } else if (responseLower.includes('aprendi') || responseLower.includes('aprendizado')) {
      followUpQuestion = 'Como você aplicou esse aprendizado em situações posteriores?';
      category = 'experience';
    } else if (responseLower.length < 50) {
      // Resposta curta - pedir mais detalhes
      followUpQuestion = 'Pode elaborar um pouco mais sobre isso?';
      category = 'behavioral';
    } else {
      return null; // Não gerar follow-up se não houver gatilho claro
    }
    
    return {
      id: `followup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      question: followUpQuestion,
      category,
      priority: 'high',
      timestamp: Date.now(),
      isRead: false,
    };
  },

  // Obter tipos de reunião disponíveis
  getMeetingTypes(): Array<{ value: string; label: string; icon: string }> {
    return [
      { value: 'ENTREVISTA', label: 'Entrevista', icon: '👔' },
      { value: 'REUNIAO', label: 'Reunião', icon: '📋' },
      { value: 'TREINAMENTO', label: 'Treinamento', icon: '📚' },
      { value: 'OUTRO', label: 'Outro', icon: '💬' },
    ];
  },

  // Gerar relatório de entrevista
  generateInterviewReport(
    topic: string,
    transcriptions: Array<{ text: string; speaker: string; timestamp: number }>
  ): InterviewReport {
    const allText = transcriptions.map(t => t.text).join(' ').toLowerCase();
    const candidateResponses = transcriptions.filter(t => 
      !t.speaker.toLowerCase().includes('você') && 
      !t.speaker.toLowerCase().includes('entrevistador')
    );
    
    // Análise de soft skills
    const softSkills = this.analyzeSoftSkills(allText, candidateResponses);
    
    // Análise técnica
    const technicalAnalysis = this.analyzeTechnicalSkills(allText, topic);
    
    // Detectar nível de senioridade
    const seniorityLevel = this.detectSeniority(allText, candidateResponses);
    
    // Pontos fortes e fracos
    const strengths = this.identifyStrengths(allText, candidateResponses);
    const improvements = this.identifyImprovements(allText, candidateResponses);
    
    // Recomendação geral
    const recommendation = this.generateRecommendation(softSkills, technicalAnalysis, seniorityLevel);
    
    return {
      id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      topic,
      generatedAt: Date.now(),
      candidateName: this.extractCandidateName(transcriptions),
      seniorityLevel,
      softSkills,
      technicalAnalysis,
      strengths,
      improvements,
      recommendation,
      overallScore: this.calculateOverallScore(softSkills, technicalAnalysis),
      transcriptionCount: transcriptions.length,
    };
  },

  analyzeSoftSkills(text: string, responses: Array<{ text: string }>): SoftSkillAnalysis[] {
    const skills: SoftSkillAnalysis[] = [];
    
    // Comunicação
    const avgResponseLength = responses.length > 0 
      ? responses.reduce((sum, r) => sum + r.text.length, 0) / responses.length 
      : 0;
    const communicationScore = Math.min(100, Math.round(avgResponseLength / 2));
    skills.push({
      name: 'Comunicação',
      score: communicationScore,
      description: communicationScore > 70 
        ? 'Respostas claras e bem elaboradas' 
        : communicationScore > 40 
        ? 'Comunicação adequada, pode melhorar detalhamento'
        : 'Respostas curtas, precisa desenvolver mais',
    });

    // Proatividade
    const proactiveKeywords = ['sugeri', 'propus', 'iniciei', 'criei', 'desenvolvi', 'implementei'];
    const proactiveCount = proactiveKeywords.filter(k => text.includes(k)).length;
    const proactiveScore = Math.min(100, proactiveCount * 20 + 30);
    skills.push({
      name: 'Proatividade',
      score: proactiveScore,
      description: proactiveScore > 70 
        ? 'Demonstra iniciativa e autonomia' 
        : proactiveScore > 40 
        ? 'Mostra alguma iniciativa'
        : 'Pode desenvolver mais proatividade',
    });

    // Trabalho em equipe
    const teamKeywords = ['equipe', 'time', 'colabor', 'junto', 'parceria', 'colegas'];
    const teamCount = teamKeywords.filter(k => text.includes(k)).length;
    const teamScore = Math.min(100, teamCount * 15 + 40);
    skills.push({
      name: 'Trabalho em Equipe',
      score: teamScore,
      description: teamScore > 70 
        ? 'Forte orientação para colaboração' 
        : teamScore > 40 
        ? 'Trabalha bem em equipe'
        : 'Pode desenvolver mais habilidades colaborativas',
    });

    // Resolução de problemas
    const problemKeywords = ['resolvi', 'solucion', 'problema', 'desafio', 'superei', 'consegui'];
    const problemCount = problemKeywords.filter(k => text.includes(k)).length;
    const problemScore = Math.min(100, problemCount * 15 + 35);
    skills.push({
      name: 'Resolução de Problemas',
      score: problemScore,
      description: problemScore > 70 
        ? 'Excelente capacidade analítica' 
        : problemScore > 40 
        ? 'Boa capacidade de resolver problemas'
        : 'Pode desenvolver pensamento analítico',
    });

    // Adaptabilidade
    const adaptKeywords = ['mudança', 'adaptei', 'aprendi', 'novo', 'diferente', 'flexível'];
    const adaptCount = adaptKeywords.filter(k => text.includes(k)).length;
    const adaptScore = Math.min(100, adaptCount * 15 + 40);
    skills.push({
      name: 'Adaptabilidade',
      score: adaptScore,
      description: adaptScore > 70 
        ? 'Alta capacidade de adaptação' 
        : adaptScore > 40 
        ? 'Adapta-se bem a mudanças'
        : 'Pode desenvolver mais flexibilidade',
    });

    return skills;
  },

  analyzeTechnicalSkills(text: string, topic: string): TechnicalAnalysis {
    const area = detectTechnicalArea(topic);
    const technicalKeywords: Record<string, string[]> = {
      'frontend': ['react', 'vue', 'angular', 'javascript', 'typescript', 'css', 'html', 'redux', 'hooks'],
      'backend': ['api', 'rest', 'graphql', 'banco', 'sql', 'node', 'java', 'python', 'microserviços'],
      'devops': ['docker', 'kubernetes', 'ci/cd', 'aws', 'azure', 'terraform', 'jenkins', 'pipeline'],
      'dados': ['sql', 'etl', 'pipeline', 'analytics', 'bi', 'python', 'spark', 'hadoop'],
      'desenvolvedor': ['código', 'arquitetura', 'design patterns', 'solid', 'testes', 'git', 'agile'],
    };

    const relevantKeywords = technicalKeywords[area] || technicalKeywords['desenvolvedor'];
    const mentionedTech = relevantKeywords.filter(k => text.includes(k));
    const techScore = Math.min(100, mentionedTech.length * 12 + 30);

    return {
      area,
      score: techScore,
      mentionedTechnologies: mentionedTech,
      depth: techScore > 70 ? 'deep' : techScore > 40 ? 'medium' : 'shallow',
      description: techScore > 70 
        ? 'Demonstra conhecimento técnico sólido na área' 
        : techScore > 40 
        ? 'Conhecimento técnico adequado'
        : 'Conhecimento técnico básico, pode aprofundar',
    };
  },

  detectSeniority(text: string, responses: Array<{ text: string }>): SeniorityLevel {
    let score = 0;
    
    // Anos de experiência mencionados
    const yearsMatch = text.match(/(\d+)\s*(anos?|years?)/i);
    if (yearsMatch) {
      const years = parseInt(yearsMatch[1]);
      if (years >= 8) score += 40;
      else if (years >= 5) score += 30;
      else if (years >= 3) score += 20;
      else score += 10;
    }

    // Palavras de liderança
    const leadershipKeywords = ['liderei', 'gerenciei', 'coordenei', 'mentor', 'arquitet'];
    score += leadershipKeywords.filter(k => text.includes(k)).length * 10;

    // Complexidade das respostas
    const avgLength = responses.length > 0 
      ? responses.reduce((sum, r) => sum + r.text.length, 0) / responses.length 
      : 0;
    if (avgLength > 150) score += 15;
    else if (avgLength > 100) score += 10;

    // Menção a decisões estratégicas
    const strategicKeywords = ['estratégia', 'decisão', 'planejamento', 'roadmap', 'visão'];
    score += strategicKeywords.filter(k => text.includes(k)).length * 8;

    if (score >= 60) return { level: 'senior', score, description: 'Perfil sênior com experiência consolidada' };
    if (score >= 35) return { level: 'pleno', score, description: 'Perfil pleno com boa experiência' };
    return { level: 'junior', score, description: 'Perfil júnior em desenvolvimento' };
  },

  identifyStrengths(text: string, responses: Array<{ text: string }>): string[] {
    const strengths: string[] = [];
    
    if (text.includes('liderei') || text.includes('coordenei')) strengths.push('Experiência em liderança');
    if (text.includes('resolvi') || text.includes('solucionei')) strengths.push('Capacidade de resolução de problemas');
    if (text.includes('aprendi') || text.includes('estudei')) strengths.push('Disposição para aprender');
    if (text.includes('equipe') || text.includes('colabor')) strengths.push('Trabalho em equipe');
    if (text.includes('entreguei') || text.includes('concluí')) strengths.push('Foco em resultados');
    if (responses.some(r => r.text.length > 200)) strengths.push('Comunicação detalhada');
    
    return strengths.length > 0 ? strengths : ['Demonstrou interesse na vaga'];
  },

  identifyImprovements(text: string, responses: Array<{ text: string }>): string[] {
    const improvements: string[] = [];
    
    const avgLength = responses.length > 0 
      ? responses.reduce((sum, r) => sum + r.text.length, 0) / responses.length 
      : 0;
    
    if (avgLength < 80) improvements.push('Desenvolver respostas mais elaboradas');
    if (!text.includes('exemplo') && !text.includes('caso')) improvements.push('Incluir mais exemplos práticos');
    if (!text.includes('resultado') && !text.includes('impacto')) improvements.push('Destacar resultados alcançados');
    if (!text.includes('métrica') && !text.includes('número')) improvements.push('Quantificar conquistas');
    
    return improvements.length > 0 ? improvements : ['Continuar desenvolvendo experiência'];
  },

  generateRecommendation(
    softSkills: SoftSkillAnalysis[], 
    technical: TechnicalAnalysis, 
    seniority: SeniorityLevel
  ): RecommendationType {
    const avgSoftSkill = softSkills.reduce((sum, s) => sum + s.score, 0) / softSkills.length;
    const overallScore = (avgSoftSkill + technical.score + seniority.score) / 3;

    if (overallScore >= 70) {
      return {
        status: 'recommended',
        title: 'Recomendado para Próxima Fase',
        description: 'Candidato demonstrou bom alinhamento com a vaga. Recomenda-se avançar no processo.',
      };
    }
    if (overallScore >= 50) {
      return {
        status: 'consider',
        title: 'Considerar com Ressalvas',
        description: 'Candidato tem potencial, mas há pontos a desenvolver. Avaliar fit cultural.',
      };
    }
    return {
      status: 'not_recommended',
      title: 'Não Recomendado',
      description: 'Candidato não demonstrou alinhamento suficiente com os requisitos da vaga.',
    };
  },

  calculateOverallScore(softSkills: SoftSkillAnalysis[], technical: TechnicalAnalysis): number {
    const avgSoftSkill = softSkills.reduce((sum, s) => sum + s.score, 0) / softSkills.length;
    return Math.round((avgSoftSkill * 0.4 + technical.score * 0.6));
  },

  extractCandidateName(transcriptions: Array<{ speaker: string }>): string {
    const speakers = [...new Set(transcriptions.map(t => t.speaker))];
    const candidate = speakers.find(s => 
      !s.toLowerCase().includes('você') && 
      !s.toLowerCase().includes('entrevistador')
    );
    return candidate || 'Candidato';
  },
};

// Tipos adicionais para o relatório
export interface SoftSkillAnalysis {
  name: string;
  score: number;
  description: string;
}

export interface TechnicalAnalysis {
  area: string;
  score: number;
  mentionedTechnologies: string[];
  depth: 'shallow' | 'medium' | 'deep';
  description: string;
}

export interface SeniorityLevel {
  level: 'junior' | 'pleno' | 'senior';
  score: number;
  description: string;
}

export interface RecommendationType {
  status: 'recommended' | 'consider' | 'not_recommended';
  title: string;
  description: string;
}

export interface InterviewReport {
  id: string;
  topic: string;
  generatedAt: number;
  candidateName: string;
  seniorityLevel: SeniorityLevel;
  softSkills: SoftSkillAnalysis[];
  technicalAnalysis: TechnicalAnalysis;
  strengths: string[];
  improvements: string[];
  recommendation: RecommendationType;
  overallScore: number;
  transcriptionCount: number;
}
