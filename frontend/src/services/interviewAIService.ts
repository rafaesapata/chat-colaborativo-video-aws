// Serviço de IA para gerar perguntas de entrevista TÉCNICAS
// v3.0.0 - Avaliação técnica real com perguntas específicas e follow-ups inteligentes

export interface InterviewSuggestion {
  id: string;
  question: string;
  category: 'technical' | 'behavioral' | 'experience' | 'situational' | 'followup';
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
  isRead: boolean;
  context?: string;
  relatedTo?: string;
  expectedAnswer?: string; // Resposta esperada para avaliação
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  technology?: string; // Tecnologia específica da pergunta
  justMarkedAsRead?: boolean; // Flag para animação de "FEITO" piscando
  autoDetected?: boolean; // Se foi detectado automaticamente na transcrição
}

export interface QuestionAnswer {
  questionId: string;
  question: string;
  answer: string;
  timestamp: number;
  category: string;
  answerQuality: 'excellent' | 'good' | 'basic' | 'incomplete' | 'incorrect';
  keyTopics: string[];
  technicalAccuracy?: number; // 0-100
  feedback?: string; // Feedback sobre a resposta
}

export interface InterviewContext {
  meetingType: 'ENTREVISTA' | 'REUNIAO' | 'TREINAMENTO' | 'OUTRO';
  topic: string;
  jobDescription?: string;
  transcriptionHistory: string[];
  questionsAsked: QuestionAnswer[];
  candidateName?: string;
}

// ============ BANCO DE PERGUNTAS TÉCNICAS COM RESPOSTAS ESPERADAS ============

interface TechnicalQuestion {
  question: string;
  expectedAnswer: string;
  keywords: string[]; // Palavras-chave que devem aparecer na resposta
  difficulty: 'basic' | 'intermediate' | 'advanced';
  followUps: string[]; // Perguntas de follow-up se resposta for superficial
}

const technicalQuestionsBank: Record<string, TechnicalQuestion[]> = {
  // ===== REACT / FRONTEND =====
  react: [
    {
      question: 'Qual a diferença entre useEffect e useLayoutEffect no React?',
      expectedAnswer: 'useEffect executa de forma assíncrona após a renderização, enquanto useLayoutEffect executa de forma síncrona antes do browser pintar a tela. useLayoutEffect é usado quando precisa medir DOM ou fazer mudanças visuais síncronas.',
      keywords: ['assíncrono', 'síncrono', 'renderização', 'paint', 'DOM', 'layout'],
      difficulty: 'intermediate',
      followUps: ['Pode dar um exemplo de quando useLayoutEffect seria necessário?', 'Quais problemas de performance podem ocorrer com useLayoutEffect?']
    },
    {
      question: 'Como funciona o Virtual DOM do React e por que ele melhora a performance?',
      expectedAnswer: 'O Virtual DOM é uma representação em memória do DOM real. React compara o Virtual DOM anterior com o novo (diffing/reconciliation) e aplica apenas as mudanças necessárias no DOM real, evitando manipulações custosas.',
      keywords: ['memória', 'diffing', 'reconciliation', 'comparação', 'batch', 'mudanças'],
      difficulty: 'basic',
      followUps: ['Como o algoritmo de reconciliation decide o que atualizar?', 'O que são keys e por que são importantes?']
    },
    {
      question: 'Explique o conceito de closure em JavaScript e como isso afeta hooks do React.',
      expectedAnswer: 'Closure é quando uma função "lembra" do escopo onde foi criada. Em React, isso pode causar stale closures em useEffect/useCallback quando dependências não são atualizadas, fazendo o callback usar valores antigos.',
      keywords: ['escopo', 'stale', 'dependências', 'referência', 'memória', 'atualização'],
      difficulty: 'advanced',
      followUps: ['Como você resolveria um problema de stale closure?', 'Quando usar useRef vs useState para evitar esse problema?']
    },
    {
      question: 'Qual a diferença entre useMemo e useCallback? Quando usar cada um?',
      expectedAnswer: 'useMemo memoriza o resultado de uma computação, useCallback memoriza a referência de uma função. useMemo para cálculos pesados, useCallback para passar callbacks a componentes filhos otimizados com memo.',
      keywords: ['memorização', 'referência', 'computação', 'memo', 'performance', 'dependências'],
      difficulty: 'intermediate',
      followUps: ['Usar memo/useCallback sempre melhora performance?', 'Qual o custo de usar essas otimizações?']
    },
  ],

  // ===== NODE.JS / BACKEND =====
  nodejs: [
    {
      question: 'Explique o Event Loop do Node.js e como ele lida com operações assíncronas.',
      expectedAnswer: 'O Event Loop é single-threaded e processa callbacks em fases: timers, I/O callbacks, idle, poll, check, close. Operações assíncronas são delegadas ao libuv que usa thread pool para I/O, e callbacks são enfileirados para execução.',
      keywords: ['single-thread', 'fases', 'libuv', 'thread pool', 'callbacks', 'poll', 'timers'],
      difficulty: 'intermediate',
      followUps: ['O que acontece se você bloquear o Event Loop?', 'Qual a diferença entre setImmediate e process.nextTick?']
    },
    {
      question: 'Qual a diferença entre process.nextTick() e setImmediate()?',
      expectedAnswer: 'process.nextTick executa antes de qualquer fase do Event Loop, na microtask queue. setImmediate executa na fase check, após I/O. nextTick tem prioridade maior mas pode starvar o loop se usado em excesso.',
      keywords: ['microtask', 'check', 'fase', 'prioridade', 'I/O', 'starve'],
      difficulty: 'advanced',
      followUps: ['Quando você usaria nextTick vs setImmediate?', 'O que são microtasks vs macrotasks?']
    },
    {
      question: 'Como você implementaria rate limiting em uma API Node.js?',
      expectedAnswer: 'Usando algoritmos como Token Bucket ou Sliding Window. Pode usar Redis para armazenar contadores distribuídos, middleware como express-rate-limit, ou implementar manualmente com timestamps e contadores por IP/usuário.',
      keywords: ['token bucket', 'sliding window', 'Redis', 'middleware', 'contador', 'IP', 'distribuído'],
      difficulty: 'intermediate',
      followUps: ['Como funcionaria em ambiente com múltiplas instâncias?', 'Qual a diferença entre rate limit por IP vs por usuário?']
    },
  ],

  // ===== TYPESCRIPT =====
  typescript: [
    {
      question: 'Qual a diferença entre interface e type no TypeScript? Quando usar cada um?',
      expectedAnswer: 'Interfaces são extensíveis (declaration merging) e melhores para objetos/classes. Types são mais flexíveis para unions, intersections, mapped types. Interfaces para contratos de API, types para composições complexas.',
      keywords: ['declaration merging', 'extensível', 'union', 'intersection', 'mapped', 'contrato'],
      difficulty: 'basic',
      followUps: ['O que é declaration merging?', 'Pode dar exemplo de mapped type?']
    },
    {
      question: 'Explique o que são Generics e dê um exemplo prático de uso.',
      expectedAnswer: 'Generics permitem criar componentes reutilizáveis que funcionam com vários tipos mantendo type safety. Exemplo: função identity<T>(arg: T): T ou Array<T>. Permite inferência de tipos e constraints com extends.',
      keywords: ['reutilizável', 'type safety', 'inferência', 'constraints', 'extends', 'T'],
      difficulty: 'intermediate',
      followUps: ['O que são generic constraints?', 'Como usar múltiplos type parameters?']
    },
    {
      question: 'O que são Utility Types? Cite 3 exemplos e quando usá-los.',
      expectedAnswer: 'São tipos built-in para transformações. Partial<T> torna props opcionais, Pick<T,K> seleciona props, Omit<T,K> remove props, Required<T> torna obrigatório, Readonly<T> torna imutável, Record<K,V> cria objeto tipado.',
      keywords: ['Partial', 'Pick', 'Omit', 'Required', 'Readonly', 'Record', 'transformação'],
      difficulty: 'intermediate',
      followUps: ['Como criar seu próprio utility type?', 'O que é um conditional type?']
    },
  ],

  // ===== PYTHON =====
  python: [
    {
      question: 'Explique a diferença entre list, tuple e set em Python. Quando usar cada um?',
      expectedAnswer: 'List é mutável e ordenada, tuple é imutável e ordenada (hashable), set é mutável mas não ordenado e sem duplicatas. List para coleções modificáveis, tuple para dados imutáveis/chaves, set para membership testing O(1).',
      keywords: ['mutável', 'imutável', 'ordenado', 'hashable', 'duplicatas', 'O(1)', 'membership'],
      difficulty: 'basic',
      followUps: ['Por que tuple pode ser chave de dict mas list não?', 'Qual a complexidade de operações em cada estrutura?']
    },
    {
      question: 'O que são decorators em Python e como funcionam?',
      expectedAnswer: 'Decorators são funções que modificam comportamento de outras funções/classes. Usam closure e recebem função como argumento, retornando wrapper. Sintaxe @decorator. Usados para logging, auth, caching, validação.',
      keywords: ['closure', 'wrapper', 'função', 'modificar', '@', 'logging', 'caching'],
      difficulty: 'intermediate',
      followUps: ['Como criar decorator com parâmetros?', 'O que é functools.wraps e por que usar?']
    },
    {
      question: 'Explique GIL (Global Interpreter Lock) e seu impacto em aplicações multi-threaded.',
      expectedAnswer: 'GIL é um mutex que permite apenas uma thread executar bytecode Python por vez. Impacta CPU-bound tasks negativamente. Para I/O-bound é ok pois GIL é liberado. Alternativas: multiprocessing, asyncio, ou implementações sem GIL.',
      keywords: ['mutex', 'thread', 'CPU-bound', 'I/O-bound', 'multiprocessing', 'asyncio', 'bytecode'],
      difficulty: 'advanced',
      followUps: ['Quando usar threading vs multiprocessing vs asyncio?', 'Como o GIL afeta performance em APIs web?']
    },
  ],

  // ===== JAVA =====
  java: [
    {
      question: 'Qual a diferença entre ArrayList e LinkedList? Quando usar cada um?',
      expectedAnswer: 'ArrayList usa array dinâmico, acesso O(1) por índice, inserção/remoção O(n). LinkedList usa nós encadeados, acesso O(n), inserção/remoção O(1) nas pontas. ArrayList para acesso aleatório, LinkedList para muitas inserções/remoções.',
      keywords: ['array', 'nós', 'O(1)', 'O(n)', 'índice', 'inserção', 'acesso'],
      difficulty: 'basic',
      followUps: ['Qual usa mais memória?', 'E para implementar uma fila, qual escolheria?']
    },
    {
      question: 'Explique o conceito de Garbage Collection em Java e os principais algoritmos.',
      expectedAnswer: 'GC libera memória de objetos não referenciados automaticamente. Heap dividido em Young (Eden, Survivor) e Old generation. Algoritmos: Serial, Parallel, CMS, G1, ZGC. Minor GC na Young, Major/Full GC inclui Old.',
      keywords: ['heap', 'Young', 'Old', 'Eden', 'Survivor', 'G1', 'Minor', 'Major'],
      difficulty: 'intermediate',
      followUps: ['Como tunar GC para baixa latência?', 'O que causa memory leaks em Java?']
    },
    {
      question: 'O que são Streams em Java 8+ e quais as vantagens sobre loops tradicionais?',
      expectedAnswer: 'Streams são abstração para processar coleções de forma declarativa e funcional. Suportam operações lazy, parallelismo fácil, encadeamento de operações (map, filter, reduce). Código mais legível e potencialmente mais performático.',
      keywords: ['declarativo', 'funcional', 'lazy', 'parallel', 'map', 'filter', 'reduce'],
      difficulty: 'intermediate',
      followUps: ['Qual a diferença entre stream sequencial e paralelo?', 'O que são operações intermediárias vs terminais?']
    },
  ],

  // ===== SQL / BANCO DE DADOS =====
  sql: [
    {
      question: 'Qual a diferença entre INNER JOIN, LEFT JOIN e FULL OUTER JOIN?',
      expectedAnswer: 'INNER JOIN retorna apenas registros com match em ambas tabelas. LEFT JOIN retorna todos da esquerda + matches da direita (NULL se não houver). FULL OUTER JOIN retorna todos de ambas, com NULL onde não há match.',
      keywords: ['match', 'NULL', 'registros', 'esquerda', 'direita', 'ambas'],
      difficulty: 'basic',
      followUps: ['Quando usar LEFT JOIN vs subquery?', 'O que é CROSS JOIN?']
    },
    {
      question: 'O que são índices em banco de dados e como eles melhoram performance?',
      expectedAnswer: 'Índices são estruturas (geralmente B-tree) que permitem busca O(log n) em vez de O(n) full scan. Aceleram SELECT/WHERE mas tornam INSERT/UPDATE mais lentos. Criar em colunas frequentemente filtradas/ordenadas.',
      keywords: ['B-tree', 'O(log n)', 'full scan', 'SELECT', 'WHERE', 'INSERT', 'UPDATE'],
      difficulty: 'intermediate',
      followUps: ['Quando um índice NÃO é usado?', 'O que é um índice composto e quando usar?']
    },
    {
      question: 'Explique os níveis de isolamento de transações e seus trade-offs.',
      expectedAnswer: 'READ UNCOMMITTED permite dirty reads. READ COMMITTED evita dirty reads. REPEATABLE READ evita non-repeatable reads. SERIALIZABLE evita phantom reads mas tem menor concorrência. Trade-off entre consistência e performance.',
      keywords: ['dirty read', 'phantom', 'repeatable', 'serializable', 'concorrência', 'consistência'],
      difficulty: 'advanced',
      followUps: ['O que é um deadlock e como evitar?', 'Qual nível de isolamento você usaria para relatórios?']
    },
  ],

  // ===== AWS / CLOUD =====
  aws: [
    {
      question: 'Qual a diferença entre EC2, ECS, EKS e Lambda? Quando usar cada um?',
      expectedAnswer: 'EC2 são VMs com controle total. ECS é orquestração de containers gerenciada. EKS é Kubernetes gerenciado. Lambda é serverless para funções event-driven. EC2 para controle, ECS/EKS para containers, Lambda para workloads esporádicos.',
      keywords: ['VM', 'container', 'Kubernetes', 'serverless', 'event-driven', 'orquestração', 'gerenciado'],
      difficulty: 'intermediate',
      followUps: ['Quais os limites do Lambda?', 'Quando ECS Fargate vs EC2 launch type?']
    },
    {
      question: 'Como você projetaria uma arquitetura altamente disponível na AWS?',
      expectedAnswer: 'Multi-AZ para redundância, Auto Scaling para elasticidade, Load Balancer para distribuição, RDS Multi-AZ ou Aurora para banco, S3 para storage durável, CloudFront para CDN, Route53 para DNS failover.',
      keywords: ['Multi-AZ', 'Auto Scaling', 'Load Balancer', 'redundância', 'failover', 'elasticidade'],
      difficulty: 'intermediate',
      followUps: ['Como garantir disaster recovery entre regiões?', 'Qual a diferença entre alta disponibilidade e fault tolerance?']
    },
    {
      question: 'Explique o modelo de responsabilidade compartilhada da AWS.',
      expectedAnswer: 'AWS é responsável pela segurança DA nuvem (hardware, rede, facilities). Cliente é responsável pela segurança NA nuvem (dados, IAM, configs, patches em EC2, encryption). Varia por serviço - Lambda vs EC2.',
      keywords: ['responsabilidade', 'segurança', 'hardware', 'IAM', 'dados', 'encryption', 'patches'],
      difficulty: 'basic',
      followUps: ['Quais controles de segurança você implementaria em uma nova conta AWS?', 'O que é AWS Organizations e SCPs?']
    },
  ],

  // ===== DOCKER / KUBERNETES =====
  docker: [
    {
      question: 'Qual a diferença entre uma imagem Docker e um container?',
      expectedAnswer: 'Imagem é template read-only com layers (filesystem, libs, app). Container é instância executável da imagem com layer writable. Imagem é como classe, container é como objeto. Múltiplos containers podem usar mesma imagem.',
      keywords: ['template', 'read-only', 'layers', 'instância', 'writable', 'executável'],
      difficulty: 'basic',
      followUps: ['O que são multi-stage builds?', 'Como otimizar o tamanho de uma imagem?']
    },
    {
      question: 'Explique a diferença entre CMD e ENTRYPOINT no Dockerfile.',
      expectedAnswer: 'ENTRYPOINT define o executável principal do container, difícil de sobrescrever. CMD define argumentos default que podem ser sobrescritos. Juntos: ENTRYPOINT é o comando, CMD são os argumentos default.',
      keywords: ['executável', 'argumentos', 'sobrescrever', 'default', 'principal'],
      difficulty: 'intermediate',
      followUps: ['Quando usar shell form vs exec form?', 'Como passar variáveis de ambiente?']
    },
  ],

  kubernetes: [
    {
      question: 'Qual a diferença entre Deployment, StatefulSet e DaemonSet no Kubernetes?',
      expectedAnswer: 'Deployment para apps stateless com replicas intercambiáveis. StatefulSet para apps stateful com identidade persistente e storage. DaemonSet garante um pod por node (logs, monitoring). Cada um tem casos de uso específicos.',
      keywords: ['stateless', 'stateful', 'replicas', 'identidade', 'node', 'persistente'],
      difficulty: 'intermediate',
      followUps: ['Como funciona rolling update em Deployment?', 'Quando usar Headless Service?']
    },
    {
      question: 'Como funciona o networking no Kubernetes? Explique Services e Ingress.',
      expectedAnswer: 'Cada pod tem IP único. Service abstrai pods com IP estável e load balancing (ClusterIP interno, NodePort expõe porta, LoadBalancer externo). Ingress é L7 routing HTTP/HTTPS com regras de path/host.',
      keywords: ['pod', 'IP', 'ClusterIP', 'NodePort', 'LoadBalancer', 'L7', 'routing'],
      difficulty: 'intermediate',
      followUps: ['O que é um Service Mesh?', 'Como implementar TLS no Ingress?']
    },
  ],

  // ===== ARQUITETURA / DESIGN =====
  architecture: [
    {
      question: 'Explique os princípios SOLID e dê um exemplo prático de cada.',
      expectedAnswer: 'S-Single Responsibility: classe uma razão para mudar. O-Open/Closed: aberto para extensão, fechado para modificação. L-Liskov: subtipos substituíveis. I-Interface Segregation: interfaces específicas. D-Dependency Inversion: depender de abstrações.',
      keywords: ['responsabilidade', 'extensão', 'modificação', 'substituível', 'segregação', 'abstração', 'inversão'],
      difficulty: 'intermediate',
      followUps: ['Qual princípio você considera mais importante?', 'Como SOLID se aplica em microserviços?']
    },
    {
      question: 'Qual a diferença entre arquitetura monolítica e microserviços? Trade-offs?',
      expectedAnswer: 'Monolito é app única, deploy junto, mais simples inicialmente. Microserviços são serviços independentes, deploy separado, escalabilidade granular. Trade-offs: complexidade operacional, latência de rede, consistência eventual vs simplicidade.',
      keywords: ['independente', 'deploy', 'escalabilidade', 'complexidade', 'latência', 'consistência eventual'],
      difficulty: 'intermediate',
      followUps: ['Quando NÃO usar microserviços?', 'Como lidar com transações distribuídas?']
    },
    {
      question: 'O que é Event-Driven Architecture e quais os padrões comuns?',
      expectedAnswer: 'Arquitetura onde componentes se comunicam via eventos assíncronos. Padrões: Event Sourcing (estado como sequência de eventos), CQRS (separar leitura/escrita), Saga (transações distribuídas), Pub/Sub. Desacoplamento e escalabilidade.',
      keywords: ['eventos', 'assíncrono', 'Event Sourcing', 'CQRS', 'Saga', 'Pub/Sub', 'desacoplamento'],
      difficulty: 'advanced',
      followUps: ['Como garantir ordenação de eventos?', 'Quais os desafios de Event Sourcing?']
    },
  ],

  // ===== API / REST / GRAPHQL =====
  api: [
    {
      question: 'Quais são os principais métodos HTTP e quando usar cada um?',
      expectedAnswer: 'GET para leitura (idempotente, cacheável). POST para criar recursos. PUT para substituir recurso completo (idempotente). PATCH para atualização parcial. DELETE para remover (idempotente). HEAD para metadados. OPTIONS para CORS.',
      keywords: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'idempotente', 'cacheável'],
      difficulty: 'basic',
      followUps: ['O que significa idempotente?', 'Qual a diferença entre PUT e PATCH?']
    },
    {
      question: 'Qual a diferença entre REST e GraphQL? Quando usar cada um?',
      expectedAnswer: 'REST usa múltiplos endpoints com recursos fixos, pode ter over/under-fetching. GraphQL usa endpoint único, cliente especifica campos exatos. REST para APIs simples/cacheáveis, GraphQL para dados complexos/relacionados e mobile.',
      keywords: ['endpoint', 'over-fetching', 'under-fetching', 'campos', 'recursos', 'query'],
      difficulty: 'intermediate',
      followUps: ['Como resolver N+1 problem em GraphQL?', 'Como implementar caching em GraphQL?']
    },
    {
      question: 'Como você implementaria versionamento de API?',
      expectedAnswer: 'Opções: URL path (/v1/users), query param (?version=1), header (Accept-Version), content negotiation. URL path é mais comum e explícito. Manter versões antigas por período, deprecation gradual, documentação clara.',
      keywords: ['URL', 'header', 'path', 'deprecation', 'backward compatible', 'versão'],
      difficulty: 'intermediate',
      followUps: ['Como lidar com breaking changes?', 'Qual estratégia de versionamento você prefere e por quê?']
    },
  ],

  // ===== TESTES =====
  testing: [
    {
      question: 'Qual a diferença entre testes unitários, de integração e E2E?',
      expectedAnswer: 'Unitários testam funções/classes isoladas com mocks, rápidos. Integração testam interação entre componentes/serviços. E2E testam fluxo completo do usuário, mais lentos. Pirâmide: muitos unitários, menos integração, poucos E2E.',
      keywords: ['isolado', 'mock', 'integração', 'fluxo', 'pirâmide', 'componentes'],
      difficulty: 'basic',
      followUps: ['O que é TDD e quais os benefícios?', 'Quando usar mocks vs stubs vs spies?']
    },
    {
      question: 'O que é Test-Driven Development (TDD) e quais os benefícios?',
      expectedAnswer: 'TDD é escrever teste antes do código: Red (teste falha), Green (código mínimo para passar), Refactor (melhorar código). Benefícios: design melhor, cobertura garantida, documentação viva, menos bugs, refactoring seguro.',
      keywords: ['Red', 'Green', 'Refactor', 'antes', 'design', 'cobertura', 'refactoring'],
      difficulty: 'intermediate',
      followUps: ['Quais as desvantagens do TDD?', 'Como aplicar TDD em código legado?']
    },
  ],

  // ===== SEGURANÇA =====
  security: [
    {
      question: 'O que é SQL Injection e como prevenir?',
      expectedAnswer: 'SQL Injection é injetar código SQL malicioso via input do usuário. Prevenção: prepared statements/parameterized queries, ORMs, validação de input, princípio do menor privilégio no banco, WAF. Nunca concatenar input em queries.',
      keywords: ['prepared statements', 'parameterized', 'ORM', 'validação', 'input', 'concatenar'],
      difficulty: 'basic',
      followUps: ['O que é XSS e como prevenir?', 'O que é CSRF?']
    },
    {
      question: 'Explique a diferença entre autenticação e autorização.',
      expectedAnswer: 'Autenticação verifica QUEM você é (login, senha, MFA, OAuth). Autorização verifica O QUE você pode fazer (permissões, roles, policies). Autenticação vem primeiro, depois autorização. JWT pode carregar claims de autorização.',
      keywords: ['quem', 'o que', 'permissões', 'roles', 'JWT', 'OAuth', 'MFA'],
      difficulty: 'basic',
      followUps: ['Como funciona OAuth 2.0?', 'Qual a diferença entre JWT e session-based auth?']
    },
    {
      question: 'Como você implementaria autenticação segura em uma API?',
      expectedAnswer: 'HTTPS obrigatório, hash de senhas com bcrypt/argon2, JWT com expiração curta + refresh token, rate limiting, MFA opcional, validação de input, headers de segurança, audit logs, não expor info sensível em erros.',
      keywords: ['HTTPS', 'bcrypt', 'JWT', 'refresh token', 'rate limiting', 'MFA', 'hash'],
      difficulty: 'intermediate',
      followUps: ['Como armazenar tokens no frontend de forma segura?', 'O que colocar no payload do JWT?']
    },
  ],

  // ===== GIT =====
  git: [
    {
      question: 'Qual a diferença entre git merge e git rebase?',
      expectedAnswer: 'Merge cria commit de merge preservando histórico completo, não-destrutivo. Rebase reescreve histórico movendo commits para nova base, histórico linear. Merge para branches públicas, rebase para branches locais/feature antes de merge.',
      keywords: ['commit', 'histórico', 'linear', 'reescreve', 'preserva', 'branch'],
      difficulty: 'intermediate',
      followUps: ['Quando NÃO usar rebase?', 'O que é interactive rebase?']
    },
    {
      question: 'Explique git flow ou trunk-based development.',
      expectedAnswer: 'Git Flow: branches main, develop, feature, release, hotfix. Mais estruturado, releases planejadas. Trunk-based: commits frequentes na main, feature flags, CI/CD robusto. Trunk é mais ágil, Git Flow para releases formais.',
      keywords: ['main', 'develop', 'feature', 'release', 'trunk', 'feature flags', 'CI/CD'],
      difficulty: 'intermediate',
      followUps: ['Qual estratégia você prefere e por quê?', 'Como lidar com conflitos em equipes grandes?']
    },
  ],

  // ===== PERGUNTAS COMPORTAMENTAIS =====
  behavioral: [
    {
      question: 'Conte sobre um projeto desafiador que você liderou. Quais foram os obstáculos e como superou?',
      expectedAnswer: 'Espera-se descrição específica com contexto, ações tomadas, resultados mensuráveis. Método STAR: Situação, Tarefa, Ação, Resultado.',
      keywords: ['projeto', 'desafio', 'resultado', 'equipe', 'solução', 'aprendi'],
      difficulty: 'intermediate',
      followUps: ['O que você faria diferente hoje?', 'Como você mediu o sucesso do projeto?']
    },
    {
      question: 'Descreva uma situação em que você teve que aprender uma tecnologia nova rapidamente.',
      expectedAnswer: 'Espera-se descrição do contexto, estratégia de aprendizado, recursos utilizados, tempo investido, resultado alcançado.',
      keywords: ['aprendi', 'estudei', 'documentação', 'prática', 'tempo', 'resultado'],
      difficulty: 'basic',
      followUps: ['Qual sua estratégia para se manter atualizado?', 'Como você decide quais tecnologias aprender?']
    },
    {
      question: 'Como você lida com feedback negativo ou críticas ao seu código?',
      expectedAnswer: 'Espera-se maturidade, abertura para aprender, separação entre código e pessoa, foco em melhoria contínua, exemplos concretos.',
      keywords: ['feedback', 'aprendo', 'melhoria', 'code review', 'construtivo', 'crescimento'],
      difficulty: 'intermediate',
      followUps: ['Pode dar um exemplo específico?', 'Como você dá feedback para outros?']
    },
  ],
};

// Mapeamento de tecnologias para categorias
const techCategoryMap: Record<string, string[]> = {
  react: ['react', 'reactjs', 'react.js', 'hooks', 'redux', 'next', 'nextjs', 'gatsby'],
  nodejs: ['node', 'nodejs', 'node.js', 'express', 'nestjs', 'fastify', 'koa'],
  typescript: ['typescript', 'ts', 'tipos', 'tipagem'],
  python: ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy'],
  java: ['java', 'spring', 'springboot', 'maven', 'gradle', 'jvm'],
  sql: ['sql', 'mysql', 'postgresql', 'postgres', 'oracle', 'sqlserver', 'banco de dados', 'database'],
  aws: ['aws', 'amazon', 'ec2', 'lambda', 's3', 'dynamodb', 'cloudformation', 'cloud'],
  docker: ['docker', 'container', 'dockerfile', 'compose'],
  kubernetes: ['kubernetes', 'k8s', 'kubectl', 'helm', 'eks', 'aks', 'gke'],
  architecture: ['arquitetura', 'design', 'solid', 'patterns', 'microserviços', 'microservices', 'monolito'],
  api: ['api', 'rest', 'restful', 'graphql', 'grpc', 'websocket'],
  testing: ['teste', 'testes', 'testing', 'tdd', 'bdd', 'jest', 'cypress', 'selenium'],
  security: ['segurança', 'security', 'auth', 'oauth', 'jwt', 'criptografia'],
  git: ['git', 'github', 'gitlab', 'bitbucket', 'versionamento'],
  behavioral: ['comportamental', 'soft skills', 'liderança', 'comunicação'],
};


// ============ FUNÇÕES DE ANÁLISE E AVALIAÇÃO ============

// Detectar tecnologias mencionadas no texto
function detectTechnologies(text: string): string[] {
  const textLower = text.toLowerCase();
  const detected: string[] = [];
  
  for (const [category, keywords] of Object.entries(techCategoryMap)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      detected.push(category);
    }
  }
  
  return [...new Set(detected)];
}

// Extrair requisitos técnicos da descrição da vaga - VERSÃO MELHORADA
function extractJobRequirements(jobDescription: string): {
  technologies: string[];
  level: 'junior' | 'pleno' | 'senior';
  keywords: string[];
  focusAreas: string[];
  mustHaveTechs: string[];
  niceToHaveTechs: string[];
} {
  if (!jobDescription) {
    return { technologies: [], level: 'pleno', keywords: [], focusAreas: [], mustHaveTechs: [], niceToHaveTechs: [] };
  }
  
  const textLower = jobDescription.toLowerCase();
  const technologies = detectTechnologies(textLower);
  
  // Detectar nível com mais precisão
  let level: 'junior' | 'pleno' | 'senior' = 'pleno';
  const seniorIndicators = ['senior', 'sênior', 'sr.', 'lead', 'principal', 'staff', 'arquiteto', 'tech lead', '5+ anos', '6+ anos', '7+ anos', '8+ anos', '10+ anos'];
  const juniorIndicators = ['junior', 'júnior', 'jr.', 'estágio', 'trainee', 'entry', 'iniciante', '1 ano', '2 anos', 'sem experiência'];
  
  if (seniorIndicators.some(ind => textLower.includes(ind))) {
    level = 'senior';
  } else if (juniorIndicators.some(ind => textLower.includes(ind))) {
    level = 'junior';
  }
  
  // Identificar tecnologias obrigatórias vs desejáveis
  const mustHaveTechs: string[] = [];
  const niceToHaveTechs: string[] = [];
  
  // Padrões para identificar obrigatório
  const mustHavePatterns = [
    /obrigatório[:\s]+([^.]+)/gi,
    /necessário[:\s]+([^.]+)/gi,
    /requisitos[:\s]+([^.]+)/gi,
    /experiência\s+(?:sólida\s+)?(?:em|com)\s+([^.]+)/gi,
    /conhecimento\s+(?:avançado\s+)?(?:em|de)\s+([^.]+)/gi,
    /domínio\s+(?:em|de)\s+([^.]+)/gi,
  ];
  
  // Padrões para identificar desejável
  const niceToHavePatterns = [
    /desejável[:\s]+([^.]+)/gi,
    /diferencial[:\s]+([^.]+)/gi,
    /plus[:\s]+([^.]+)/gi,
    /será\s+um\s+diferencial[:\s]+([^.]+)/gi,
  ];
  
  // Extrair tecnologias obrigatórias
  for (const pattern of mustHavePatterns) {
    const matches = textLower.matchAll(pattern);
    for (const match of matches) {
      const techs = detectTechnologies(match[1]);
      mustHaveTechs.push(...techs);
    }
  }
  
  // Extrair tecnologias desejáveis
  for (const pattern of niceToHavePatterns) {
    const matches = textLower.matchAll(pattern);
    for (const match of matches) {
      const techs = detectTechnologies(match[1]);
      niceToHaveTechs.push(...techs);
    }
  }
  
  // Se não encontrou padrões específicos, usar todas as tecnologias detectadas como obrigatórias
  const uniqueMustHave = [...new Set(mustHaveTechs)];
  const uniqueNiceToHave = [...new Set(niceToHaveTechs.filter(t => !uniqueMustHave.includes(t)))];
  
  // Se não detectou nada específico, usar as tecnologias gerais
  const finalMustHave = uniqueMustHave.length > 0 ? uniqueMustHave : technologies;
  
  // Identificar áreas de foco baseado no contexto
  const focusAreas: string[] = [];
  
  const areaPatterns: Record<string, string[]> = {
    'backend': ['backend', 'back-end', 'api', 'servidor', 'microserviços', 'microsserviços'],
    'frontend': ['frontend', 'front-end', 'interface', 'ui', 'ux', 'web'],
    'fullstack': ['fullstack', 'full-stack', 'full stack'],
    'mobile': ['mobile', 'android', 'ios', 'react native', 'flutter'],
    'devops': ['devops', 'infraestrutura', 'ci/cd', 'deploy', 'kubernetes', 'docker'],
    'data': ['dados', 'data', 'analytics', 'bi', 'etl', 'pipeline'],
    'cloud': ['cloud', 'aws', 'azure', 'gcp', 'nuvem'],
    'security': ['segurança', 'security', 'pentest', 'vulnerabilidade'],
  };
  
  for (const [area, patterns] of Object.entries(areaPatterns)) {
    if (patterns.some(p => textLower.includes(p))) {
      focusAreas.push(area);
    }
  }
  
  // Extrair palavras-chave importantes
  const importantKeywords = [
    'experiência', 'conhecimento', 'domínio', 'proficiência',
    'obrigatório', 'necessário', 'desejável', 'diferencial'
  ];
  const keywords = importantKeywords.filter(kw => textLower.includes(kw));
  
  return { 
    technologies, 
    level, 
    keywords, 
    focusAreas,
    mustHaveTechs: finalMustHave,
    niceToHaveTechs: uniqueNiceToHave
  };
}

// Avaliar resposta técnica comparando com resposta esperada
function evaluateTechnicalAnswer(
  answer: string,
  expectedAnswer: string,
  keywords: string[]
): { score: number; feedback: string; missingTopics: string[] } {
  if (!answer || answer.length < 20) {
    return {
      score: 0,
      feedback: 'Resposta muito curta ou ausente',
      missingTopics: keywords
    };
  }
  
  const answerLower = answer.toLowerCase();
  const matchedKeywords = keywords.filter(kw => answerLower.includes(kw.toLowerCase()));
  const missingTopics = keywords.filter(kw => !answerLower.includes(kw.toLowerCase()));
  
  // Calcular score baseado em keywords encontradas
  const keywordScore = (matchedKeywords.length / keywords.length) * 60;
  
  // Bonus por resposta elaborada
  const lengthBonus = Math.min(20, answer.length / 20);
  
  // Bonus por exemplos práticos
  const hasExample = /exemplo|caso|projeto|implementei|desenvolvi|quando|situação/i.test(answer);
  const exampleBonus = hasExample ? 15 : 0;
  
  // Bonus por estrutura
  const hasStructure = /primeiro|segundo|além|também|por outro lado|portanto|então/i.test(answer);
  const structureBonus = hasStructure ? 5 : 0;
  
  const totalScore = Math.min(100, Math.round(keywordScore + lengthBonus + exampleBonus + structureBonus));
  
  // Gerar feedback
  let feedback = '';
  if (totalScore >= 80) {
    feedback = 'Excelente resposta! Demonstrou conhecimento sólido.';
  } else if (totalScore >= 60) {
    feedback = 'Boa resposta, mas poderia aprofundar em: ' + missingTopics.slice(0, 2).join(', ');
  } else if (totalScore >= 40) {
    feedback = 'Resposta básica. Faltou mencionar: ' + missingTopics.slice(0, 3).join(', ');
  } else {
    feedback = 'Resposta incompleta. Conceitos importantes não abordados: ' + missingTopics.join(', ');
  }
  
  return { score: totalScore, feedback, missingTopics };
}

// Determinar qualidade da resposta
function determineAnswerQuality(score: number): QuestionAnswer['answerQuality'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'basic';
  if (score >= 20) return 'incomplete';
  return 'incorrect';
}

// Detectar se texto é uma pergunta
function isQuestion(text: string): boolean {
  const questionPatterns = [
    /\?$/,
    /^(como|qual|quais|o que|por que|porque|quando|onde|quem|pode|poderia|conte|descreva|explique|fale|me diga)/i,
    /me (conte|fale|diga|explique)/i,
  ];
  return questionPatterns.some(pattern => pattern.test(text.trim()));
}

// Extrair tópicos da resposta
function extractTopicsFromAnswer(answer: string): string[] {
  const topics: string[] = [];
  const answerLower = answer.toLowerCase();
  
  const topicKeywords: Record<string, string[]> = {
    'liderança': ['liderei', 'coordenei', 'gerenciei', 'equipe', 'time', 'mentor'],
    'arquitetura': ['arquitetura', 'design', 'padrão', 'pattern', 'estrutura', 'sistema'],
    'performance': ['performance', 'otimização', 'velocidade', 'cache', 'latência'],
    'testes': ['teste', 'tdd', 'unit', 'integração', 'e2e', 'coverage'],
    'deploy': ['deploy', 'ci/cd', 'pipeline', 'release', 'produção'],
    'banco de dados': ['banco', 'sql', 'nosql', 'query', 'índice', 'modelagem'],
    'api': ['api', 'rest', 'graphql', 'endpoint', 'integração'],
    'segurança': ['segurança', 'autenticação', 'autorização', 'token', 'criptografia'],
    'cloud': ['aws', 'azure', 'gcp', 'cloud', 'serverless', 'lambda'],
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => answerLower.includes(kw))) {
      topics.push(topic);
    }
  }
  
  return topics;
}


// ============ SERVIÇO PRINCIPAL ============

// Função para calcular similaridade entre duas strings (Levenshtein simplificado)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Verificar se uma contém a outra
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Contar palavras em comum
  const words1 = s1.split(/\s+/).filter(w => w.length > 3);
  const words2 = s2.split(/\s+/).filter(w => w.length > 3);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  const similarity = (commonWords.length * 2) / (words1.length + words2.length);
  
  return similarity;
}

// Detectar se uma pergunta sugerida foi feita na transcrição
export function detectAskedQuestion(
  transcriptionText: string,
  suggestions: InterviewSuggestion[]
): InterviewSuggestion | null {
  const textLower = transcriptionText.toLowerCase();
  
  // Palavras-chave que indicam uma pergunta
  const questionIndicators = [
    'pode me', 'poderia me', 'me conte', 'me fale', 'me explique',
    'qual', 'quais', 'como', 'o que', 'por que', 'quando', 'onde',
    'descreva', 'explique', 'conte sobre', 'fale sobre'
  ];
  
  // Verificar se o texto parece ser uma pergunta
  const isQuestion = questionIndicators.some(ind => textLower.includes(ind)) || textLower.includes('?');
  if (!isQuestion) return null;
  
  // Procurar por sugestões não lidas que correspondam
  for (const suggestion of suggestions) {
    if (suggestion.isRead) continue;
    
    const similarity = calculateSimilarity(transcriptionText, suggestion.question);
    
    // Se similaridade > 40%, considerar como a mesma pergunta
    if (similarity > 0.4) {
      console.log(`[InterviewAI] Pergunta detectada! Similaridade: ${(similarity * 100).toFixed(0)}%`);
      console.log(`  Transcrição: "${transcriptionText.substring(0, 100)}..."`);
      console.log(`  Sugestão: "${suggestion.question.substring(0, 100)}..."`);
      return suggestion;
    }
    
    // Verificar palavras-chave específicas da pergunta
    const questionKeywords = suggestion.question
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4);
    
    const matchedKeywords = questionKeywords.filter(kw => textLower.includes(kw));
    const keywordMatch = matchedKeywords.length / questionKeywords.length;
    
    if (keywordMatch > 0.5) {
      console.log(`[InterviewAI] Pergunta detectada por keywords! Match: ${(keywordMatch * 100).toFixed(0)}%`);
      return suggestion;
    }
  }
  
  return null;
}

export const interviewAIService = {
  // Gerar perguntas técnicas baseadas na vaga - VERSÃO MELHORADA
  generateSuggestions(context: InterviewContext, count: number = 3): InterviewSuggestion[] {
    if (context.meetingType !== 'ENTREVISTA') {
      return [];
    }

    const suggestions: InterviewSuggestion[] = [];
    const usedQuestions = new Set<string>(
      context.questionsAsked?.map(qa => qa.question.toLowerCase()) || []
    );
    
    const jobReqs = extractJobRequirements(context.jobDescription || context.topic);
    const questionCount = context.questionsAsked?.length || 0;
    
    console.log('[InterviewAI] Requisitos da vaga detectados:', {
      mustHaveTechs: jobReqs.mustHaveTechs,
      niceToHaveTechs: jobReqs.niceToHaveTechs,
      level: jobReqs.level,
      focusAreas: jobReqs.focusAreas
    });
    
    // Determinar dificuldade baseada no nível da vaga e progresso
    let targetDifficulty: TechnicalQuestion['difficulty'][] = ['basic', 'intermediate'];
    if (jobReqs.level === 'senior') {
      targetDifficulty = ['intermediate', 'advanced'];
    } else if (jobReqs.level === 'junior') {
      targetDifficulty = ['basic'];
      if (questionCount > 3) targetDifficulty.push('intermediate');
    } else {
      // Pleno - começar com básico/intermediário, avançar para avançado
      if (questionCount > 5) {
        targetDifficulty = ['intermediate', 'advanced'];
      }
    }
    
    // PRIORIDADE 1: Tecnologias obrigatórias da vaga (mustHaveTechs)
    // PRIORIDADE 2: Tecnologias desejáveis (niceToHaveTechs)
    // PRIORIDADE 3: Áreas de foco (focusAreas)
    // PRIORIDADE 4: Fallback genérico
    
    const priorityTechs: string[] = [];
    
    // Adicionar tecnologias obrigatórias primeiro
    if (jobReqs.mustHaveTechs.length > 0) {
      priorityTechs.push(...jobReqs.mustHaveTechs);
    }
    
    // Adicionar tecnologias desejáveis
    if (jobReqs.niceToHaveTechs.length > 0) {
      priorityTechs.push(...jobReqs.niceToHaveTechs.filter(t => !priorityTechs.includes(t)));
    }
    
    // Se não tem tecnologias específicas, usar áreas de foco
    if (priorityTechs.length === 0 && jobReqs.focusAreas.length > 0) {
      // Mapear áreas de foco para categorias de perguntas
      const areaToTech: Record<string, string[]> = {
        'backend': ['nodejs', 'java', 'python', 'api', 'sql'],
        'frontend': ['react', 'typescript'],
        'fullstack': ['react', 'nodejs', 'typescript', 'api'],
        'mobile': ['react'], // React Native
        'devops': ['docker', 'kubernetes', 'aws'],
        'data': ['sql', 'python'],
        'cloud': ['aws'],
        'security': ['security'],
      };
      
      for (const area of jobReqs.focusAreas) {
        const techs = areaToTech[area] || [];
        priorityTechs.push(...techs.filter(t => !priorityTechs.includes(t)));
      }
    }
    
    // Fallback: se ainda não tem nada, usar genéricos
    if (priorityTechs.length === 0) {
      priorityTechs.push('architecture', 'api', 'testing');
    }
    
    console.log('[InterviewAI] Tecnologias priorizadas para perguntas:', priorityTechs);
    
    // Coletar perguntas disponíveis COM PESO por prioridade
    const availableQuestions: Array<TechnicalQuestion & { category: string; weight: number }> = [];
    
    for (let i = 0; i < priorityTechs.length; i++) {
      const tech = priorityTechs[i];
      const questions = technicalQuestionsBank[tech] || [];
      // Peso maior para tecnologias mais prioritárias (primeiras da lista)
      const weight = Math.max(1, 10 - i * 2);
      
      for (const q of questions) {
        if (!usedQuestions.has(q.question.toLowerCase()) && targetDifficulty.includes(q.difficulty)) {
          availableQuestions.push({ ...q, category: tech, weight });
        }
      }
    }
    
    // Adicionar perguntas comportamentais APENAS se já fez várias técnicas
    // E apenas 1 a cada 5 perguntas técnicas
    if (questionCount >= 4 && questionCount % 5 === 0) {
      const behavioralQs = technicalQuestionsBank.behavioral || [];
      for (const q of behavioralQs) {
        if (!usedQuestions.has(q.question.toLowerCase())) {
          availableQuestions.push({ ...q, category: 'behavioral', weight: 3 });
        }
      }
    }
    
    // Ordenar por peso (maior primeiro) e depois randomizar dentro do mesmo peso
    const sortedByWeight = availableQuestions.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return Math.random() - 0.5;
    });
    
    // Selecionar perguntas priorizando as de maior peso
    for (let i = 0; i < Math.min(count, sortedByWeight.length); i++) {
      const q = sortedByWeight[i];
      suggestions.push({
        id: `suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        question: q.question,
        category: q.category === 'behavioral' ? 'behavioral' : 'technical',
        priority: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
        timestamp: Date.now(),
        isRead: false,
        context: `Pergunta de ${q.category} - Nível ${q.difficulty}`,
        expectedAnswer: q.expectedAnswer,
        difficulty: q.difficulty,
        technology: q.category,
      });
      usedQuestions.add(q.question.toLowerCase());
    }
    
    return suggestions;
  },

  // Gerar follow-up inteligente baseado na última resposta
  generateFollowUp(lastResponse: string, context: InterviewContext): InterviewSuggestion | null {
    if (context.meetingType !== 'ENTREVISTA' || !lastResponse || lastResponse.length < 30) {
      return null;
    }

    const lastQA = context.questionsAsked?.[context.questionsAsked.length - 1];
    const jobReqs = extractJobRequirements(context.jobDescription || context.topic);
    
    // Encontrar a pergunta original para avaliar a resposta
    let originalQuestion: TechnicalQuestion | null = null;
    if (lastQA) {
      for (const category of Object.keys(technicalQuestionsBank)) {
        const found = technicalQuestionsBank[category]?.find(
          q => q.question.toLowerCase() === lastQA.question.toLowerCase()
        );
        if (found) {
          originalQuestion = found;
          break;
        }
      }
    }
    
    // Se encontrou a pergunta original, avaliar e gerar follow-up específico
    if (originalQuestion) {
      const evaluation = evaluateTechnicalAnswer(
        lastResponse,
        originalQuestion.expectedAnswer,
        originalQuestion.keywords
      );
      
      // Se resposta foi fraca, usar follow-up predefinido
      if (evaluation.score < 60 && originalQuestion.followUps.length > 0) {
        const followUpQuestion = originalQuestion.followUps[0];
        return {
          id: `followup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          question: followUpQuestion,
          category: 'followup',
          priority: 'high',
          timestamp: Date.now(),
          isRead: false,
          context: `Aprofundando: ${evaluation.feedback}`,
          difficulty: originalQuestion.difficulty,
          technology: lastQA?.category,
        };
      }
      
      // Se resposta foi boa mas faltou algo específico
      if (evaluation.missingTopics.length > 0 && evaluation.score < 80) {
        const missingTopic = evaluation.missingTopics[0];
        return {
          id: `followup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          question: `Você pode elaborar mais sobre ${missingTopic}?`,
          category: 'followup',
          priority: 'high',
          timestamp: Date.now(),
          isRead: false,
          context: `Tópico não abordado: ${missingTopic}`,
        };
      }
    }
    
    // Análise contextual da resposta para gerar follow-up dinâmico
    const answerLower = lastResponse.toLowerCase();
    const detectedTechs = detectTechnologies(answerLower);
    
    // Se mencionou tecnologia da vaga, aprofundar
    const relevantTech = detectedTechs.find(t => jobReqs.technologies.includes(t));
    if (relevantTech && technicalQuestionsBank[relevantTech]) {
      const usedQuestions = new Set(context.questionsAsked?.map(qa => qa.question.toLowerCase()) || []);
      const nextQuestion = technicalQuestionsBank[relevantTech].find(
        q => !usedQuestions.has(q.question.toLowerCase())
      );
      
      if (nextQuestion) {
        return {
          id: `followup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          question: nextQuestion.question,
          category: 'followup',
          priority: 'high',
          timestamp: Date.now(),
          isRead: false,
          context: `Aprofundando em ${relevantTech} mencionado na resposta`,
          expectedAnswer: nextQuestion.expectedAnswer,
          difficulty: nextQuestion.difficulty,
          technology: relevantTech,
        };
      }
    }
    
    // Se mencionou projeto/experiência, pedir detalhes
    if (/projeto|sistema|aplicação|desenvolvi|implementei|criei/i.test(answerLower)) {
      if (!/resultado|impacto|métrica|\d+/i.test(answerLower)) {
        return {
          id: `followup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          question: 'Quais foram os resultados mensuráveis desse projeto? Teve impacto em métricas de negócio?',
          category: 'followup',
          priority: 'high',
          timestamp: Date.now(),
          isRead: false,
          context: 'Buscando resultados quantificáveis',
        };
      }
    }
    
    // Se mencionou desafio/problema, pedir solução
    if (/desafio|problema|difícil|complexo/i.test(answerLower)) {
      if (!/solução|resolvi|consegui|resultado/i.test(answerLower)) {
        return {
          id: `followup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          question: 'Como você resolveu esse desafio? Quais alternativas considerou?',
          category: 'followup',
          priority: 'high',
          timestamp: Date.now(),
          isRead: false,
          context: 'Explorando resolução de problema',
        };
      }
    }
    
    return null;
  },


  // Processar transcrição e avaliar respostas
  processTranscription(
    transcriptions: Array<{ text: string; speaker: string; timestamp: number }>,
    existingQA: QuestionAnswer[]
  ): QuestionAnswer[] {
    const newQA: QuestionAnswer[] = [...existingQA];
    let currentQuestion: { text: string; timestamp: number } | null = null;
    
    for (const trans of transcriptions) {
      const text = trans.text.trim();
      if (!text || text.length < 10) continue;
      
      if (isQuestion(text)) {
        currentQuestion = { text, timestamp: trans.timestamp };
      } else if (currentQuestion && text.length > 30) {
        const existingIndex = newQA.findIndex(qa => 
          qa.question === currentQuestion!.text
        );
        
        if (existingIndex === -1) {
          // Encontrar pergunta no banco para avaliar
          let evaluation = { score: 50, feedback: '', missingTopics: [] as string[] };
          let foundQuestion: TechnicalQuestion | null = null;
          
          for (const category of Object.keys(technicalQuestionsBank)) {
            const found = technicalQuestionsBank[category]?.find(
              q => q.question.toLowerCase() === currentQuestion!.text.toLowerCase()
            );
            if (found) {
              foundQuestion = found;
              evaluation = evaluateTechnicalAnswer(text, found.expectedAnswer, found.keywords);
              break;
            }
          }
          
          newQA.push({
            questionId: `qa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            question: currentQuestion.text,
            answer: text,
            timestamp: trans.timestamp,
            category: foundQuestion ? 'technical' : 'detected',
            answerQuality: determineAnswerQuality(evaluation.score),
            keyTopics: extractTopicsFromAnswer(text),
            technicalAccuracy: evaluation.score,
            feedback: evaluation.feedback,
          });
        } else {
          // Atualizar resposta existente
          newQA[existingIndex].answer += ' ' + text;
          
          // Reavaliar com resposta completa
          for (const category of Object.keys(technicalQuestionsBank)) {
            const found = technicalQuestionsBank[category]?.find(
              q => q.question.toLowerCase() === newQA[existingIndex].question.toLowerCase()
            );
            if (found) {
              const evaluation = evaluateTechnicalAnswer(
                newQA[existingIndex].answer,
                found.expectedAnswer,
                found.keywords
              );
              newQA[existingIndex].answerQuality = determineAnswerQuality(evaluation.score);
              newQA[existingIndex].technicalAccuracy = evaluation.score;
              newQA[existingIndex].feedback = evaluation.feedback;
              break;
            }
          }
          
          newQA[existingIndex].keyTopics = extractTopicsFromAnswer(newQA[existingIndex].answer);
        }
        
        currentQuestion = null;
      }
    }
    
    return newQA;
  },

  // Analisar qualidade de uma resposta
  analyzeAnswer(answer: string, question?: string): {
    quality: QuestionAnswer['answerQuality'];
    topics: string[];
    suggestions: string[];
    score: number;
    feedback: string;
  } {
    // Tentar encontrar a pergunta no banco
    let evaluation = { score: 50, feedback: 'Resposta analisada', missingTopics: [] as string[] };
    
    if (question) {
      for (const category of Object.keys(technicalQuestionsBank)) {
        const found = technicalQuestionsBank[category]?.find(
          q => q.question.toLowerCase() === question.toLowerCase()
        );
        if (found) {
          evaluation = evaluateTechnicalAnswer(answer, found.expectedAnswer, found.keywords);
          break;
        }
      }
    }
    
    const quality = determineAnswerQuality(evaluation.score);
    const topics = extractTopicsFromAnswer(answer);
    const suggestions: string[] = [];
    
    if (evaluation.missingTopics.length > 0) {
      suggestions.push(`Aprofundar em: ${evaluation.missingTopics.slice(0, 2).join(', ')}`);
    }
    if (quality === 'incomplete' || quality === 'incorrect') {
      suggestions.push('Pedir exemplo prático');
      suggestions.push('Solicitar mais detalhes técnicos');
    } else if (quality === 'basic') {
      suggestions.push('Explorar casos de uso');
      suggestions.push('Pedir comparação com alternativas');
    }
    
    return {
      quality,
      topics,
      suggestions,
      score: evaluation.score,
      feedback: evaluation.feedback,
    };
  },

  // Obter progresso da entrevista
  getInterviewProgress(context: InterviewContext): {
    questionsAsked: number;
    topicsExplored: string[];
    topicsRemaining: string[];
    overallQuality: QuestionAnswer['answerQuality'];
    averageScore: number;
    recommendations: string[];
  } {
    const questionsAsked = context.questionsAsked?.length || 0;
    const allTopics = context.questionsAsked?.flatMap(qa => qa.keyTopics) || [];
    const topicsExplored = [...new Set(allTopics)];
    
    const jobReqs = extractJobRequirements(context.jobDescription || context.topic);
    const topicsRemaining = jobReqs.technologies.filter(t => !topicsExplored.includes(t));
    
    // Calcular score médio
    const scores = context.questionsAsked
      ?.filter(qa => qa.technicalAccuracy !== undefined)
      .map(qa => qa.technicalAccuracy!) || [];
    const averageScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    
    const overallQuality = determineAnswerQuality(averageScore);
    
    const recommendations: string[] = [];
    if (topicsRemaining.length > 0) {
      recommendations.push(`Explorar: ${topicsRemaining.slice(0, 3).join(', ')}`);
    }
    if (questionsAsked < 5) {
      recommendations.push('Fazer mais perguntas técnicas');
    }
    if (averageScore < 60) {
      recommendations.push('Aprofundar nas respostas fracas');
    }
    if (questionsAsked > 0 && questionsAsked % 5 === 0) {
      recommendations.push('Considerar pergunta comportamental');
    }
    
    return {
      questionsAsked,
      topicsExplored,
      topicsRemaining,
      overallQuality,
      averageScore,
      recommendations,
    };
  },

  // Obter tipos de reunião
  getMeetingTypes(): Array<{ value: string; label: string; icon: string }> {
    return [
      { value: 'ENTREVISTA', label: 'Entrevista', icon: '👔' },
      { value: 'REUNIAO', label: 'Reunião', icon: '📋' },
      { value: 'TREINAMENTO', label: 'Treinamento', icon: '📚' },
      { value: 'OUTRO', label: 'Outro', icon: '💬' },
    ];
  },


  // Gerar relatório de entrevista - VERSÃO MILITAR PADRÃO OURO
  generateInterviewReport(
    topic: string,
    transcriptions: Array<{ text: string; speaker: string; timestamp: number }>,
    jobDescription?: string,
    interviewerName?: string
  ): InterviewReport {
    // 1. IDENTIFICAR PARTICIPANTES CORRETAMENTE
    const { candidateName, candidateResponses, interviewerQuestions } = 
      this.identifyParticipants(transcriptions, interviewerName);
    
    // 2. EXTRAIR TECNOLOGIAS RELEVANTES DA VAGA
    const jobTechnologies = this.extractJobTechnologies(topic, jobDescription);
    
    // 3. ANALISAR APENAS AS RESPOSTAS DO CANDIDATO
    const candidateText = candidateResponses.map(r => r.text).join(' ').toLowerCase();
    
    // 4. AVALIAR SOFT SKILLS DO CANDIDATO
    const softSkills = this.analyzeSoftSkillsAdvanced(candidateText, candidateResponses);
    
    // 5. AVALIAR SKILLS TÉCNICAS BASEADO NA VAGA
    const technicalAnalysis = this.analyzeTechnicalSkillsAdvanced(
      candidateText, 
      candidateResponses,
      jobTechnologies,
      topic,
      jobDescription
    );
    
    // 6. DETECTAR SENIORIDADE
    const seniorityLevel = this.detectSeniorityAdvanced(candidateText, candidateResponses, interviewerQuestions);
    
    // 7. IDENTIFICAR PONTOS FORTES E MELHORIAS
    const strengths = this.identifyStrengthsAdvanced(candidateText, candidateResponses, jobTechnologies);
    const improvements = this.identifyImprovementsAdvanced(candidateText, candidateResponses, jobTechnologies);
    
    // 8. GERAR RECOMENDAÇÃO FINAL
    const recommendation = this.generateRecommendationAdvanced(
      softSkills, 
      technicalAnalysis, 
      seniorityLevel,
      jobTechnologies
    );
    
    // 9. GERAR RESUMO DA ENTREVISTA
    const summary = this.generateInterviewSummary(
      candidateResponses,
      interviewerQuestions,
      jobTechnologies
    );
    
    return {
      id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      topic,
      jobDescription: jobDescription || topic,
      generatedAt: Date.now(),
      candidateName,
      seniorityLevel,
      softSkills,
      technicalAnalysis,
      strengths,
      improvements,
      recommendation,
      overallScore: this.calculateOverallScoreAdvanced(softSkills, technicalAnalysis, seniorityLevel),
      transcriptionCount: transcriptions.length,
      candidateResponseCount: candidateResponses.length,
      questionsAskedCount: interviewerQuestions.length,
      summary,
      jobTechnologies,
    };
  },

  // Identificar participantes corretamente
  identifyParticipants(
    transcriptions: Array<{ text: string; speaker: string; timestamp: number }>,
    knownInterviewerName?: string
  ): {
    candidateName: string;
    candidateResponses: Array<{ text: string; speaker: string; timestamp: number }>;
    interviewerQuestions: Array<{ text: string; speaker: string; timestamp: number }>;
  } {
    // Agrupar por speaker
    const speakerStats: Record<string, { 
      count: number; 
      totalLength: number; 
      questionCount: number;
      texts: Array<{ text: string; speaker: string; timestamp: number }>;
    }> = {};
    
    for (const trans of transcriptions) {
      const speaker = trans.speaker.trim();
      if (!speakerStats[speaker]) {
        speakerStats[speaker] = { count: 0, totalLength: 0, questionCount: 0, texts: [] };
      }
      speakerStats[speaker].count++;
      speakerStats[speaker].totalLength += trans.text.length;
      speakerStats[speaker].texts.push(trans);
      
      // Contar perguntas
      if (isQuestion(trans.text)) {
        speakerStats[speaker].questionCount++;
      }
    }
    
    const speakers = Object.keys(speakerStats);
    
    // Se temos o nome do entrevistador, usar para identificar
    let interviewerSpeaker = '';
    let candidateSpeaker = '';
    
    if (knownInterviewerName) {
      // Encontrar speaker que corresponde ao entrevistador
      interviewerSpeaker = speakers.find(s => 
        s.toLowerCase().includes(knownInterviewerName.toLowerCase()) ||
        knownInterviewerName.toLowerCase().includes(s.toLowerCase().split(' ')[0])
      ) || '';
    }
    
    // Se não encontrou pelo nome, usar heurísticas
    if (!interviewerSpeaker && speakers.length >= 2) {
      // O entrevistador geralmente:
      // 1. Faz mais perguntas
      // 2. Tem falas mais curtas (perguntas)
      // 3. Fala primeiro
      
      const sortedByQuestions = speakers.sort((a, b) => 
        speakerStats[b].questionCount - speakerStats[a].questionCount
      );
      
      // Quem faz mais perguntas é provavelmente o entrevistador
      const topQuestioner = sortedByQuestions[0];
      const avgLengthTop = speakerStats[topQuestioner].totalLength / speakerStats[topQuestioner].count;
      
      // Verificar se faz sentido (entrevistador faz perguntas curtas)
      if (speakerStats[topQuestioner].questionCount > 0) {
        interviewerSpeaker = topQuestioner;
      } else {
        // Fallback: quem tem média de texto menor é entrevistador
        const sortedByAvgLength = speakers.sort((a, b) => {
          const avgA = speakerStats[a].totalLength / speakerStats[a].count;
          const avgB = speakerStats[b].totalLength / speakerStats[b].count;
          return avgA - avgB;
        });
        interviewerSpeaker = sortedByAvgLength[0];
      }
    }
    
    // O candidato é quem não é o entrevistador
    candidateSpeaker = speakers.find(s => s !== interviewerSpeaker) || speakers[0] || 'Candidato';
    
    // Filtrar respostas
    const candidateResponses = transcriptions.filter(t => 
      t.speaker === candidateSpeaker && !isQuestion(t.text) && t.text.length > 20
    );
    
    const interviewerQuestions = transcriptions.filter(t => 
      t.speaker === interviewerSpeaker && isQuestion(t.text)
    );
    
    console.log('[InterviewReport] Participantes identificados:');
    console.log(`  Entrevistador: ${interviewerSpeaker} (${speakerStats[interviewerSpeaker]?.questionCount || 0} perguntas)`);
    console.log(`  Candidato: ${candidateSpeaker} (${candidateResponses.length} respostas)`);
    
    return {
      candidateName: candidateSpeaker || 'Candidato',
      candidateResponses,
      interviewerQuestions,
    };
  },

  // Extrair tecnologias da vaga
  extractJobTechnologies(topic: string, jobDescription?: string): string[] {
    const fullText = `${topic} ${jobDescription || ''}`.toLowerCase();
    const technologies: string[] = [];
    
    // Mapeamento de tecnologias por categoria
    const techPatterns: Record<string, string[]> = {
      'dotnet': ['.net', 'dotnet', 'c#', 'csharp', 'asp.net', 'entity framework', 'blazor', 'wpf', 'wcf', 'linq'],
      'java': ['java', 'spring', 'springboot', 'maven', 'gradle', 'hibernate', 'jpa', 'junit'],
      'python': ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy', 'pytorch', 'tensorflow'],
      'javascript': ['javascript', 'js', 'node', 'nodejs', 'express', 'nestjs'],
      'typescript': ['typescript', 'ts'],
      'react': ['react', 'reactjs', 'redux', 'next', 'nextjs'],
      'angular': ['angular', 'angularjs', 'rxjs'],
      'vue': ['vue', 'vuejs', 'nuxt'],
      'sql': ['sql', 'mysql', 'postgresql', 'postgres', 'sqlserver', 'oracle', 'banco de dados', 'database'],
      'nosql': ['mongodb', 'dynamodb', 'redis', 'cassandra', 'nosql'],
      'aws': ['aws', 'amazon', 'ec2', 'lambda', 's3', 'cloudformation', 'ecs', 'eks'],
      'azure': ['azure', 'microsoft cloud', 'azure devops'],
      'docker': ['docker', 'container', 'kubernetes', 'k8s'],
      'devops': ['ci/cd', 'jenkins', 'gitlab', 'github actions', 'devops', 'terraform'],
      'mobile': ['android', 'ios', 'react native', 'flutter', 'swift', 'kotlin'],
    };
    
    for (const [tech, patterns] of Object.entries(techPatterns)) {
      if (patterns.some(p => fullText.includes(p))) {
        technologies.push(tech);
      }
    }
    
    // Se não encontrou nada específico, tentar detectar área geral
    if (technologies.length === 0) {
      if (fullText.includes('backend') || fullText.includes('back-end') || fullText.includes('api')) {
        technologies.push('backend');
      }
      if (fullText.includes('frontend') || fullText.includes('front-end') || fullText.includes('interface')) {
        technologies.push('frontend');
      }
      if (fullText.includes('fullstack') || fullText.includes('full-stack') || fullText.includes('full stack')) {
        technologies.push('fullstack');
      }
    }
    
    console.log('[InterviewReport] Tecnologias da vaga:', technologies);
    return technologies;
  },

  // ============ FUNÇÕES AVANÇADAS DE ANÁLISE - PADRÃO MILITAR OURO ============

  // Análise avançada de Soft Skills - APENAS do candidato
  analyzeSoftSkillsAdvanced(
    candidateText: string, 
    candidateResponses: Array<{ text: string }>
  ): SoftSkillAnalysis[] {
    const skills: SoftSkillAnalysis[] = [];
    
    // 1. COMUNICAÇÃO
    const avgResponseLength = candidateResponses.length > 0 
      ? candidateResponses.reduce((sum, r) => sum + r.text.length, 0) / candidateResponses.length 
      : 0;
    const hasStructuredResponses = candidateResponses.some(r => 
      /primeiro|segundo|além disso|por exemplo|em resumo/i.test(r.text)
    );
    const hasClearExplanations = candidateResponses.some(r => 
      /porque|pois|então|portanto|dessa forma/i.test(r.text)
    );
    
    let communicationScore = Math.min(40, Math.round(avgResponseLength / 5));
    if (hasStructuredResponses) communicationScore += 30;
    if (hasClearExplanations) communicationScore += 20;
    communicationScore = Math.min(100, communicationScore + 10);
    
    skills.push({
      name: 'Comunicação',
      score: communicationScore,
      description: communicationScore >= 80 
        ? 'Excelente comunicação - respostas claras e bem estruturadas' 
        : communicationScore >= 60 
        ? 'Boa comunicação - explica conceitos adequadamente'
        : communicationScore >= 40
        ? 'Comunicação adequada'
        : 'Respostas curtas e pouco elaboradas',
    });

    // 2. PROATIVIDADE
    const proactivePatterns = [
      { pattern: /sugeri|propus|tomei a iniciativa/i, weight: 20 },
      { pattern: /criei|desenvolvi|implementei/i, weight: 15 },
      { pattern: /identifiquei.*problema|percebi.*oportunidade/i, weight: 15 },
      { pattern: /melhorei|otimizei|automatizei/i, weight: 15 },
    ];
    
    let proactiveScore = 25;
    for (const { pattern, weight } of proactivePatterns) {
      if (pattern.test(candidateText)) proactiveScore += weight;
    }
    proactiveScore = Math.min(100, proactiveScore);
    
    skills.push({
      name: 'Proatividade',
      score: proactiveScore,
      description: proactiveScore >= 70 
        ? 'Alta proatividade - demonstra iniciativa' 
        : proactiveScore >= 50 
        ? 'Boa proatividade'
        : 'Pode desenvolver mais iniciativa',
    });

    // 3. TRABALHO EM EQUIPE
    const teamPatterns = [
      { pattern: /equipe|time|squad|grupo/i, weight: 15 },
      { pattern: /colabor|junto com|parceria/i, weight: 15 },
      { pattern: /ajudei|apoiei|contribuí/i, weight: 15 },
      { pattern: /compartilh|ensinei|mentoria/i, weight: 15 },
    ];
    
    let teamScore = 30;
    for (const { pattern, weight } of teamPatterns) {
      if (pattern.test(candidateText)) teamScore += weight;
    }
    teamScore = Math.min(100, teamScore);
    
    skills.push({
      name: 'Trabalho em Equipe',
      score: teamScore,
      description: teamScore >= 70 
        ? 'Forte orientação colaborativa' 
        : teamScore >= 50 
        ? 'Bom trabalho em equipe'
        : 'Trabalha adequadamente em equipe',
    });

    // 4. RESOLUÇÃO DE PROBLEMAS
    const problemPatterns = [
      { pattern: /resolvi|solucionei|corrigi/i, weight: 15 },
      { pattern: /analisei.*problema|investiguei/i, weight: 15 },
      { pattern: /debug|troubleshoot|diagnóstico/i, weight: 15 },
      { pattern: /resultado|consegui|sucesso/i, weight: 10 },
    ];
    
    let problemScore = 25;
    for (const { pattern, weight } of problemPatterns) {
      if (pattern.test(candidateText)) problemScore += weight;
    }
    problemScore = Math.min(100, problemScore);
    
    skills.push({
      name: 'Resolução de Problemas',
      score: problemScore,
      description: problemScore >= 70 
        ? 'Excelente capacidade analítica' 
        : problemScore >= 50 
        ? 'Boa capacidade de resolver problemas'
        : 'Resolve problemas adequadamente',
    });

    // 5. ADAPTABILIDADE
    const adaptPatterns = [
      { pattern: /aprendi|estudei|me adaptei/i, weight: 15 },
      { pattern: /mudança|novo.*tecnologia|migr/i, weight: 15 },
      { pattern: /flexível|versátil|diferentes/i, weight: 15 },
    ];
    
    let adaptScore = 30;
    for (const { pattern, weight } of adaptPatterns) {
      if (pattern.test(candidateText)) adaptScore += weight;
    }
    adaptScore = Math.min(100, adaptScore);
    
    skills.push({
      name: 'Adaptabilidade',
      score: adaptScore,
      description: adaptScore >= 70 
        ? 'Alta adaptabilidade' 
        : adaptScore >= 50 
        ? 'Boa adaptabilidade'
        : 'Adaptabilidade adequada',
    });

    return skills;
  },

  // Análise técnica avançada - FOCADA nas tecnologias da vaga
  analyzeTechnicalSkillsAdvanced(
    candidateText: string,
    candidateResponses: Array<{ text: string }>,
    jobTechnologies: string[],
    topic: string,
    jobDescription?: string
  ): TechnicalAnalysis {
    const mentionedTechs = detectTechnologies(candidateText);
    const relevantMentions = mentionedTechs.filter(t => 
      jobTechnologies.includes(t) || jobTechnologies.length === 0
    );
    
    let techRelevanceScore = 0;
    if (jobTechnologies.length > 0) {
      techRelevanceScore = (relevantMentions.length / jobTechnologies.length) * 40;
    } else {
      techRelevanceScore = Math.min(40, mentionedTechs.length * 10);
    }
    
    const technicalDepthPatterns = [
      /arquitetura|design pattern|solid|clean/i,
      /performance|otimização|cache|índice/i,
      /teste|tdd|unit|integração|coverage/i,
      /ci\/cd|deploy|pipeline|devops/i,
      /segurança|autenticação|autorização/i,
      /escalabilidade|microserviço|distribuído/i,
    ];
    
    const depthMatches = technicalDepthPatterns.filter(p => p.test(candidateText)).length;
    const depthScore = Math.min(30, depthMatches * 6);
    
    const hasExamples = /projeto|sistema|aplicação|implementei|desenvolvi|criei/i.test(candidateText);
    const hasMetrics = /\d+%|\d+\s*(usuários|requests|ms|segundos)/i.test(candidateText);
    const exampleScore = (hasExamples ? 15 : 0) + (hasMetrics ? 15 : 0);
    
    const totalScore = Math.round(techRelevanceScore + depthScore + exampleScore);
    
    let depth: 'shallow' | 'medium' | 'deep' = 'shallow';
    if (totalScore >= 70) depth = 'deep';
    else if (totalScore >= 40) depth = 'medium';
    
    let description = '';
    if (jobTechnologies.length > 0) {
      const mainTech = jobTechnologies[0];
      const hasMentioned = relevantMentions.length > 0;
      
      if (totalScore >= 70) {
        description = `Sólido conhecimento em ${mainTech}. Apresentou exemplos práticos relevantes.`;
      } else if (totalScore >= 50) {
        description = hasMentioned 
          ? `Conhecimento adequado em ${mainTech}.`
          : `Conhecimento técnico bom, mas não demonstrou experiência específica em ${mainTech}.`;
      } else {
        description = hasMentioned
          ? `Conhecimento básico em ${mainTech}.`
          : `Não demonstrou experiência relevante em ${mainTech} durante a entrevista.`;
      }
    } else {
      description = totalScore >= 70 
        ? 'Conhecimento técnico sólido'
        : totalScore >= 40
        ? 'Conhecimento técnico adequado'
        : 'Conhecimento técnico básico';
    }
    
    return {
      area: jobTechnologies[0] || mentionedTechs[0] || 'general',
      score: totalScore,
      mentionedTechnologies: mentionedTechs,
      relevantTechnologies: relevantMentions,
      jobTechnologies,
      depth,
      description,
      alignment: jobTechnologies.length > 0 
        ? Math.round((relevantMentions.length / Math.max(1, jobTechnologies.length)) * 100)
        : 100,
    };
  },

  // Detectar senioridade avançada
  detectSeniorityAdvanced(
    candidateText: string, 
    candidateResponses: Array<{ text: string }>,
    interviewerQuestions: Array<{ text: string }>
  ): SeniorityLevel {
    let score = 0;
    const indicators: string[] = [];
    
    const yearsMatch = candidateText.match(/(\d+)\s*(anos?|years?)/i);
    if (yearsMatch) {
      const years = parseInt(yearsMatch[1]);
      if (years >= 8) { score += 35; indicators.push(`${years} anos de experiência`); }
      else if (years >= 5) { score += 25; indicators.push(`${years} anos de experiência`); }
      else if (years >= 3) { score += 15; indicators.push(`${years} anos de experiência`); }
      else { score += 5; indicators.push(`${years} anos de experiência`); }
    }

    const leadershipPatterns = [
      { pattern: /liderei|liderança|líder/i, points: 15, indicator: 'Liderança' },
      { pattern: /gerenciei|gestão|gerente/i, points: 15, indicator: 'Gestão' },
      { pattern: /coordenei|coordenação/i, points: 12, indicator: 'Coordenação' },
      { pattern: /mentor|orientei|ensinei/i, points: 10, indicator: 'Mentoria' },
      { pattern: /arquitet|defini.*arquitetura/i, points: 15, indicator: 'Arquitetura' },
    ];
    
    for (const { pattern, points, indicator } of leadershipPatterns) {
      if (pattern.test(candidateText)) {
        score += points;
        indicators.push(indicator);
      }
    }

    const avgLength = candidateResponses.length > 0 
      ? candidateResponses.reduce((sum, r) => sum + r.text.length, 0) / candidateResponses.length 
      : 0;
    if (avgLength > 200) { score += 10; indicators.push('Respostas elaboradas'); }
    else if (avgLength > 120) { score += 5; }

    if (/negócio|stakeholder|requisito|impacto/i.test(candidateText)) {
      score += 8;
      indicators.push('Visão de negócio');
    }

    let level: 'junior' | 'pleno' | 'senior' = 'junior';
    let description = '';
    
    if (score >= 65) {
      level = 'senior';
      description = `Perfil Sênior - ${indicators.slice(0, 3).join(', ')}`;
    } else if (score >= 35) {
      level = 'pleno';
      description = `Perfil Pleno - ${indicators.slice(0, 2).join(', ') || 'Experiência intermediária'}`;
    } else {
      level = 'junior';
      description = `Perfil Júnior - ${indicators[0] || 'Em desenvolvimento'}`;
    }
    
    return { level, score: Math.min(100, score), description, indicators };
  },

  // Identificar pontos fortes avançado
  identifyStrengthsAdvanced(
    candidateText: string, 
    candidateResponses: Array<{ text: string }>,
    jobTechnologies: string[]
  ): string[] {
    const strengths: string[] = [];
    
    const mentionedTechs = detectTechnologies(candidateText);
    const relevantTechs = mentionedTechs.filter(t => jobTechnologies.includes(t));
    if (relevantTechs.length > 0) {
      strengths.push(`Experiência em ${relevantTechs.join(', ')}`);
    }
    
    const strengthPatterns = [
      { pattern: /liderei|liderança|coordenei/i, strength: 'Liderança técnica' },
      { pattern: /resolvi.*problema|solucionei/i, strength: 'Resolução de problemas' },
      { pattern: /aprendi.*rápido|adaptei/i, strength: 'Rápido aprendizado' },
      { pattern: /equipe|colabor|junto/i, strength: 'Trabalho em equipe' },
      { pattern: /resultado|impacto|melhoria/i, strength: 'Foco em resultados' },
      { pattern: /arquitetura|design|padrão/i, strength: 'Arquitetura de software' },
      { pattern: /teste|qualidade|coverage/i, strength: 'Qualidade de código' },
    ];
    
    for (const { pattern, strength } of strengthPatterns) {
      if (pattern.test(candidateText) && !strengths.includes(strength)) {
        strengths.push(strength);
      }
    }
    
    const avgLength = candidateResponses.length > 0 
      ? candidateResponses.reduce((sum, r) => sum + r.text.length, 0) / candidateResponses.length 
      : 0;
    if (avgLength > 150) {
      strengths.push('Boa comunicação');
    }
    
    if (strengths.length === 0) {
      strengths.push('Demonstrou interesse na vaga');
    }
    
    return strengths.slice(0, 6);
  },

  // Identificar melhorias avançado
  identifyImprovementsAdvanced(
    candidateText: string, 
    candidateResponses: Array<{ text: string }>,
    jobTechnologies: string[]
  ): string[] {
    const improvements: string[] = [];
    
    const mentionedTechs = detectTechnologies(candidateText);
    const missingTechs = jobTechnologies.filter(t => !mentionedTechs.includes(t));
    if (missingTechs.length > 0 && jobTechnologies.length > 0) {
      improvements.push(`Desenvolver experiência em ${missingTechs.slice(0, 2).join(', ')}`);
    }
    
    const avgLength = candidateResponses.length > 0 
      ? candidateResponses.reduce((sum, r) => sum + r.text.length, 0) / candidateResponses.length 
      : 0;
    
    if (avgLength < 80) {
      improvements.push('Elaborar mais as respostas');
    }
    
    if (!/exemplo|caso|projeto|situação/i.test(candidateText)) {
      improvements.push('Incluir mais exemplos práticos');
    }
    
    if (!/resultado|impacto|métrica|\d+%/i.test(candidateText)) {
      improvements.push('Destacar resultados alcançados');
    }
    
    if (improvements.length === 0) {
      improvements.push('Continuar desenvolvendo experiência');
    }
    
    return improvements.slice(0, 5);
  },

  // Gerar recomendação avançada
  generateRecommendationAdvanced(
    softSkills: SoftSkillAnalysis[], 
    technical: TechnicalAnalysis, 
    seniority: SeniorityLevel,
    jobTechnologies: string[]
  ): RecommendationType {
    const avgSoftSkill = softSkills.reduce((sum, s) => sum + s.score, 0) / softSkills.length;
    const techAlignment = technical.alignment || 50;
    const techScore = technical.score;
    
    const weightedScore = (
      avgSoftSkill * 0.25 +
      techScore * 0.35 +
      techAlignment * 0.25 +
      seniority.score * 0.15
    );

    let status: 'recommended' | 'consider' | 'not_recommended';
    let title: string;
    let description: string;
    const details: string[] = [];

    if (weightedScore >= 65 && techAlignment >= 50) {
      status = 'recommended';
      title = '✅ Recomendado';
      description = 'Bom alinhamento com os requisitos da vaga.';
      details.push(`Score: ${Math.round(weightedScore)}%`);
      details.push(`Alinhamento técnico: ${techAlignment}%`);
    } else if (weightedScore >= 45 || (techAlignment >= 30 && avgSoftSkill >= 60)) {
      status = 'consider';
      title = '🤔 Considerar';
      description = 'Tem potencial, avaliar fit cultural.';
      details.push(`Score: ${Math.round(weightedScore)}%`);
    } else {
      status = 'not_recommended';
      title = '❌ Não Recomendado';
      description = 'Alinhamento insuficiente com a vaga.';
      details.push(`Score: ${Math.round(weightedScore)}%`);
    }

    return { status, title, description, details, score: Math.round(weightedScore) };
  },

  // Calcular score geral avançado
  calculateOverallScoreAdvanced(
    softSkills: SoftSkillAnalysis[], 
    technical: TechnicalAnalysis,
    seniority: SeniorityLevel
  ): number {
    const avgSoftSkill = softSkills.reduce((sum, s) => sum + s.score, 0) / softSkills.length;
    return Math.round(avgSoftSkill * 0.3 + technical.score * 0.5 + seniority.score * 0.2);
  },

  // Gerar resumo da entrevista
  generateInterviewSummary(
    candidateResponses: Array<{ text: string }>,
    interviewerQuestions: Array<{ text: string }>,
    jobTechnologies: string[]
  ): string {
    const totalResponses = candidateResponses.length;
    const totalQuestions = interviewerQuestions.length;
    const avgResponseLength = totalResponses > 0
      ? Math.round(candidateResponses.reduce((sum, r) => sum + r.text.length, 0) / totalResponses)
      : 0;
    
    let summary = `Entrevista com ${totalQuestions} perguntas e ${totalResponses} respostas do candidato. `;
    
    if (avgResponseLength > 150) {
      summary += 'Respostas elaboradas e detalhadas. ';
    } else if (avgResponseLength > 80) {
      summary += 'Respostas adequadas. ';
    } else {
      summary += 'Respostas breves. ';
    }
    
    if (jobTechnologies.length > 0) {
      summary += `Foco: ${jobTechnologies.join(', ')}.`;
    }
    
    return summary;
  },
};


// ============ TIPOS ADICIONAIS ============

export interface SoftSkillAnalysis {
  name: string;
  score: number;
  description: string;
}

export interface TechnicalAnalysis {
  area: string;
  score: number;
  mentionedTechnologies: string[];
  relevantTechnologies?: string[];
  jobTechnologies?: string[];
  depth: 'shallow' | 'medium' | 'deep';
  description: string;
  alignment?: number;
}

export interface SeniorityLevel {
  level: 'junior' | 'pleno' | 'senior';
  score: number;
  description: string;
  indicators?: string[];
}

export interface RecommendationType {
  status: 'recommended' | 'consider' | 'not_recommended';
  title: string;
  description: string;
  details?: string[];
  score?: number;
}

export interface InterviewReport {
  id: string;
  topic: string;
  jobDescription?: string;
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
  candidateResponseCount?: number;
  questionsAskedCount?: number;
  summary?: string;
  jobTechnologies?: string[];
}
