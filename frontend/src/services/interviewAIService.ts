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
};
