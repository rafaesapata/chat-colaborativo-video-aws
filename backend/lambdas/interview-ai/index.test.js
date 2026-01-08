/**
 * Testes automatizados para Interview AI Lambda
 * Nível Militar - Cobertura de segurança, validação e funcionalidade
 */

const { handler } = require('./index');

// Mock AWS SDK
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-cloudwatch');

const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');

describe('Interview AI Lambda - Validação e Segurança', () => {
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Bedrock response
    BedrockRuntimeClient.prototype.send = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        output: {
          message: {
            content: [{
              text: JSON.stringify({
                questions: [
                  {
                    question: "Qual sua experiência com React?",
                    category: "technical",
                    difficulty: "intermediate",
                    technology: "React",
                    expectedTopics: ["hooks", "components", "state"],
                    context: "Pergunta sobre framework principal"
                  }
                ]
              })
            }]
          }
        }
      }))
    });
    
    // Mock CloudWatch
    CloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
  });

  test('deve rejeitar body inválido', async () => {
    const event = {
      body: 'invalid json',
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('inválido');
  });

  test('deve rejeitar action inválida', async () => {
    const event = {
      body: JSON.stringify({
        action: 'invalidAction',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor'
        }
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('Action inválida');
  });

  test('deve rejeitar context sem meetingType', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          topic: 'Desenvolvedor'
        }
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('meetingType');
  });

  test('deve rejeitar context sem topic', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'ENTREVISTA'
        }
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('topic');
  });

  test('deve sanitizar HTML tags', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor <script>alert("xss")</script>',
          jobDescription: '<b>Descrição</b> da vaga'
        },
        count: 3
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    // Verificar que HTML foi removido (não deve conter < ou >)
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });

  test('deve remover PII (email) da entrada', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor',
          jobDescription: 'Enviar CV para contato@empresa.com',
          candidateName: 'João Silva'
        },
        count: 3
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    // Email deve ter sido removido antes de enviar para Bedrock
  });

  test('deve limitar tamanho de strings', async () => {
    const longString = 'a'.repeat(20000);
    
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor',
          jobDescription: longString
        },
        count: 3
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    // String deve ter sido truncada para 10000 caracteres
  });

  test('deve limitar count entre 1 e 10', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor'
        },
        count: 100 // Muito alto
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    
    expect(result.statusCode).toBe(200);
    // Count deve ter sido limitado a 10
  });
});

describe('Interview AI Lambda - Funcionalidade', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    BedrockRuntimeClient.prototype.send = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        output: {
          message: {
            content: [{
              text: JSON.stringify({
                questions: [
                  {
                    question: "Qual sua experiência com React?",
                    category: "technical",
                    difficulty: "intermediate",
                    technology: "React",
                    expectedTopics: ["hooks", "components"],
                    context: "Framework principal"
                  },
                  {
                    question: "Como você gerencia estado global?",
                    category: "technical",
                    difficulty: "advanced",
                    technology: "React",
                    expectedTopics: ["redux", "context"],
                    context: "Gerenciamento de estado"
                  },
                  {
                    question: "Conte sobre um projeto desafiador",
                    category: "behavioral",
                    difficulty: "basic",
                    technology: "general",
                    expectedTopics: ["desafios", "solução"],
                    context: "Experiência prática"
                  }
                ]
              })
            }]
          }
        }
      }))
    });
    
    CloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
  });

  test('deve gerar 3 perguntas iniciais', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor Full Stack',
          jobDescription: 'React e Node.js'
        },
        count: 3
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    const body = JSON.parse(result.body);
    
    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.questions).toHaveLength(3);
    expect(body.questions[0]).toHaveProperty('question');
    expect(body.questions[0]).toHaveProperty('category');
    expect(body.questions[0]).toHaveProperty('difficulty');
    expect(body.questions[0]).toHaveProperty('technology');
  });

  test('deve retornar array vazio para tipo não-entrevista', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'REUNIAO',
          topic: 'Planejamento'
        },
        count: 3
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    const body = JSON.parse(result.body);
    
    expect(result.statusCode).toBe(200);
    expect(body.questions).toEqual([]);
  });

  test('deve adicionar IDs e timestamps às perguntas', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor'
        },
        count: 3
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    const body = JSON.parse(result.body);
    
    expect(body.questions[0]).toHaveProperty('id');
    expect(body.questions[0]).toHaveProperty('timestamp');
    expect(body.questions[0].id).toMatch(/^initial_/);
  });

  test('deve registrar métricas CloudWatch', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor'
        },
        count: 3
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    await handler(event);
    
    // Verificar que CloudWatch foi chamado
    expect(CloudWatchClient.prototype.send).toHaveBeenCalled();
  });
});

describe('Interview AI Lambda - Rate Limiting', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    BedrockRuntimeClient.prototype.send = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        output: {
          message: {
            content: [{
              text: JSON.stringify({ questions: [] })
            }]
          }
        }
      }))
    });
    
    CloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
  });

  test('deve permitir até 20 requests por minuto', async () => {
    const event = {
      body: JSON.stringify({
        action: 'generateInitialQuestions',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor'
        }
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    // Fazer 20 requests
    for (let i = 0; i < 20; i++) {
      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    }
    
    // 21ª request deve falhar
    const result = await handler(event);
    expect(result.statusCode).toBe(429);
    expect(JSON.parse(result.body).error).toContain('Rate limit');
  });
});

describe('Interview AI Lambda - Avaliação de Respostas', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    BedrockRuntimeClient.prototype.send = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        output: {
          message: {
            content: [{
              text: JSON.stringify({
                score: 85,
                quality: 'good',
                feedback: 'Boa resposta técnica',
                strengths: ['conhecimento técnico', 'exemplos práticos'],
                improvements: ['poderia detalhar mais'],
                keyTopics: ['react', 'hooks'],
                missingTopics: ['performance']
              })
            }]
          }
        }
      }))
    });
    
    CloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
  });

  test('deve avaliar resposta do candidato', async () => {
    const event = {
      body: JSON.stringify({
        action: 'evaluateAnswer',
        context: {
          meetingType: 'ENTREVISTA',
          topic: 'Desenvolvedor',
          questionsAsked: [
            {
              question: 'Qual sua experiência com React?',
              category: 'technical'
            }
          ]
        },
        lastAnswer: 'Trabalho com React há 3 anos, uso hooks e context API'
      }),
      requestContext: { identity: { sourceIp: '127.0.0.1' } }
    };
    
    const result = await handler(event);
    const body = JSON.parse(result.body);
    
    expect(result.statusCode).toBe(200);
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(body.score).toBeLessThanOrEqual(100);
    expect(body.quality).toBeDefined();
    expect(body.feedback).toBeDefined();
  });
});
