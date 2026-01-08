/**
 * Lambda para geração inteligente de perguntas de entrevista usando Bedrock AI
 * Gera perguntas personalizadas baseadas no contexto da vaga e histórico da conversa
 * 
 * v5.0.0 - NÍVEL MILITAR/OURO
 * - Validação rigorosa de entrada
 * - Rate limiting por usuário
 * - Sanitização de PII (dados sensíveis)
 * - Timeout e retry com exponential backoff
 * - Métricas CloudWatch
 * - Logs estruturados
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudwatchClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Modelo Amazon Nova Lite (AWS nativo, sem marketplace)
const MODEL_ID = 'amazon.nova-lite-v1:0';

// Rate limiting (em memória - para produção usar DynamoDB)
const rateLimiter = new Map(); // userId -> { count, resetTime }
const RATE_LIMIT_MAX = 20; // Max 20 requests por minuto
const RATE_LIMIT_WINDOW = 60000; // 1 minuto

// Timeout para Bedrock
const BEDROCK_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 1;

exports.handler = async (event) => {
  const startTime = Date.now();
  console.log('Interview AI Lambda invoked:', JSON.stringify({ 
    path: event.path, 
    httpMethod: event.httpMethod,
    headers: event.headers 
  }));

  try {
    // 1. VALIDAÇÃO DE ENTRADA
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    if (!body || typeof body !== 'object') {
      await recordMetric('ValidationError', 1);
      return errorResponse(400, 'Body inválido');
    }

    // 2. RATE LIMITING
    const userId = event.requestContext?.authorizer?.userId || 
                   event.headers?.['x-user-id'] || 
                   event.requestContext?.identity?.sourceIp || 
                   'anonymous';
    
    try {
      checkRateLimit(userId);
    } catch (error) {
      await recordMetric('RateLimitExceeded', 1);
      return errorResponse(429, error.message);
    }

    // 3. VALIDAR E SANITIZAR ENTRADA
    let validatedInput;
    try {
      validatedInput = validateAndSanitizeInput(body);
    } catch (error) {
      await recordMetric('ValidationError', 1);
      return errorResponse(400, error.message);
    }

    const { action, context, count, lastAnswer } = validatedInput;

    // 4. EXECUTAR AÇÃO
    let result;
    const actionStartTime = Date.now();

    switch (action) {
      case 'generateInitialQuestions':
        result = await generateInitialQuestions(context, count || 3);
        break;
      
      case 'generateFollowUp':
        result = await generateFollowUpQuestion(context, lastAnswer);
        break;
      
      case 'evaluateAnswer':
        result = await evaluateAnswer(context, lastAnswer);
        break;
      
      case 'generateNewQuestions':
        result = await generateNewQuestions(context, count || 3);
        break;
      
      case 'generateReport':
        result = await generateInterviewReport(context);
        break;
      
      default:
        await recordMetric('InvalidAction', 1);
        return errorResponse(400, `Ação inválida: ${action}`);
    }

    // 5. MÉTRICAS DE SUCESSO
    const latency = Date.now() - actionStartTime;
    await recordMetric('RequestSuccess', 1);
    await recordMetric('ActionLatency', latency, 'Milliseconds');
    await recordMetric(`Action_${action}`, 1);

    const totalLatency = Date.now() - startTime;
    console.log(`[SUCCESS] Action: ${action}, Latency: ${totalLatency}ms`);

    return successResponse(result);

  } catch (error) {
    const totalLatency = Date.now() - startTime;
    console.error('[ERROR] Interview AI Lambda:', {
      error: error.message,
      stack: error.stack,
      latency: totalLatency
    });
    
    await recordMetric('RequestError', 1);
    return errorResponse(500, error.message);
  }
};

/**
 * VALIDAÇÃO E SANITIZAÇÃO DE ENTRADA
 */
function validateAndSanitizeInput(body) {
  const { action, context, count, lastAnswer } = body;
  
  // Validar action
  const validActions = [
    'generateInitialQuestions', 
    'generateFollowUp', 
    'evaluateAnswer', 
    'generateNewQuestions', 
    'generateReport'
  ];
  
  if (!action || !validActions.includes(action)) {
    throw new Error(`Action inválida: ${action}. Valores permitidos: ${validActions.join(', ')}`);
  }
  
  // Validar context
  if (!context || typeof context !== 'object') {
    throw new Error('Context é obrigatório e deve ser um objeto');
  }
  
  if (!context.meetingType) {
    throw new Error('context.meetingType é obrigatório');
  }
  
  if (!context.topic || typeof context.topic !== 'string') {
    throw new Error('context.topic é obrigatório e deve ser uma string');
  }
  
  // Sanitizar strings para prevenir injection e remover PII
  const sanitizedContext = {
    meetingType: sanitizeString(context.meetingType, 50),
    topic: sanitizeString(context.topic, 200),
    jobDescription: sanitizePII(sanitizeString(context.jobDescription || '', 10000)),
    candidateName: sanitizeString(context.candidateName || '', 100),
    transcriptionHistory: Array.isArray(context.transcriptionHistory) 
      ? context.transcriptionHistory.slice(-20).map(t => sanitizePII(sanitizeString(t, 1000)))
      : [],
    questionsAsked: Array.isArray(context.questionsAsked)
      ? context.questionsAsked.slice(-20).map(qa => ({
          question: sanitizeString(qa.question || '', 500),
          answer: sanitizePII(sanitizeString(qa.answer || '', 2000)),
          answerQuality: sanitizeString(qa.answerQuality || '', 50),
          category: sanitizeString(qa.category || '', 50)
        }))
      : []
  };
  
  // Validar count
  const validatedCount = count ? Math.min(Math.max(parseInt(count), 1), 10) : 3;
  
  // Validar lastAnswer
  const validatedLastAnswer = lastAnswer 
    ? sanitizePII(sanitizeString(lastAnswer, 5000))
    : '';
  
  return {
    action,
    context: sanitizedContext,
    count: validatedCount,
    lastAnswer: validatedLastAnswer
  };
}

/**
 * Sanitiza string para prevenir injection
 */
function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/[{}]/g, '') // Remove JSON injection
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove caracteres de controle
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitiza PII (Personally Identifiable Information)
 */
function sanitizePII(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Remover emails
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REMOVIDO]');
  
  // Remover telefones brasileiros
  text = text.replace(/\(?\d{2,3}\)?[\s-]?\d{4,5}[\s-]?\d{4}/g, '[TELEFONE_REMOVIDO]');
  
  // Remover CPF
  text = text.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '[CPF_REMOVIDO]');
  
  // Remover números de cartão
  text = text.replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[CARTAO_REMOVIDO]');
  
  // Remover CEP
  text = text.replace(/\d{5}-?\d{3}/g, '[CEP_REMOVIDO]');
  
  return text;
}

/**
 * Rate limiting por usuário
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = rateLimiter.get(userId);
  
  // Limpar rate limiters antigos (garbage collection)
  if (rateLimiter.size > 1000) {
    for (const [key, value] of rateLimiter.entries()) {
      if (now > value.resetTime) {
        rateLimiter.delete(key);
      }
    }
  }
  
  if (!userLimit || now > userLimit.resetTime) {
    // Novo período
    rateLimiter.set(userId, { 
      count: 1, 
      resetTime: now + RATE_LIMIT_WINDOW 
    });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    const waitTime = Math.ceil((userLimit.resetTime - now) / 1000);
    throw new Error(`Rate limit excedido. Aguarde ${waitTime} segundos.`);
  }
  
  userLimit.count++;
  return true;
}

/**
 * Registra métrica no CloudWatch
 */
async function recordMetric(metricName, value, unit = 'Count') {
  try {
    const command = new PutMetricDataCommand({
      Namespace: 'InterviewAI',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        Dimensions: [
          {
            Name: 'Environment',
            Value: process.env.ENVIRONMENT || 'production'
          }
        ]
      }]
    });
    
    await cloudwatchClient.send(command);
  } catch (error) {
    // Não falhar a requisição se métrica falhar
    console.warn('Erro ao enviar métrica:', error.message);
  }
}

/**
 * Gera perguntas iniciais baseadas no contexto da vaga
 */
async function generateInitialQuestions(context, count) {
  const { topic, jobDescription, meetingType } = context;

  // Aceitar tanto 'interview' quanto 'ENTREVISTA'
  const isInterview = meetingType && (
    meetingType.toLowerCase() === 'interview' || 
    meetingType.toUpperCase() === 'ENTREVISTA'
  );

  if (!isInterview) {
    return { questions: [] };
  }

  const prompt = buildInitialQuestionsPrompt(topic, jobDescription, count);
  const response = await invokeBedrockModel(prompt);
  
  return parseQuestionsResponse(response, 'initial');
}

/**
 * Gera pergunta de follow-up baseada na resposta do candidato
 */
async function generateFollowUpQuestion(context, lastAnswer) {
  const { topic, jobDescription, questionsAsked, transcriptionHistory } = context;
  
  const lastQuestion = questionsAsked[questionsAsked.length - 1];
  
  const prompt = buildFollowUpPrompt(
    topic,
    jobDescription,
    lastQuestion,
    lastAnswer,
    transcriptionHistory
  );
  
  const response = await invokeBedrockModel(prompt);
  
  return parseQuestionsResponse(response, 'followup', 1);
}

/**
 * Avalia a resposta do candidato
 */
async function evaluateAnswer(context, answer) {
  const { questionsAsked } = context;
  const lastQuestion = questionsAsked[questionsAsked.length - 1];
  
  const prompt = buildEvaluationPrompt(lastQuestion, answer);
  const response = await invokeBedrockModel(prompt);
  
  return parseEvaluationResponse(response);
}

/**
 * Gera novas perguntas baseadas no progresso da entrevista
 */
async function generateNewQuestions(context, count) {
  const { topic, jobDescription, questionsAsked, transcriptionHistory } = context;
  
  const prompt = buildProgressiveQuestionsPrompt(
    topic,
    jobDescription,
    questionsAsked,
    transcriptionHistory,
    count
  );
  
  const response = await invokeBedrockModel(prompt);
  
  return parseQuestionsResponse(response, 'progressive');
}

/**
 * Constrói prompt para perguntas iniciais
 */
function buildInitialQuestionsPrompt(topic, jobDescription, count) {
  return `Você é um especialista em recrutamento técnico. Sua tarefa é gerar ${count} perguntas PERSONALIZADAS para uma entrevista de emprego.

**CONTEXTO DA VAGA:**
- Cargo: ${topic}
- Descrição completa: ${jobDescription || 'Não fornecida'}

**INSTRUÇÕES:**
1. Analise cuidadosamente a descrição da vaga para identificar:
   - Tecnologias e ferramentas mencionadas (obrigatórias e desejáveis)
   - Nível de senioridade (júnior, pleno, sênior)
   - Responsabilidades principais
   - Soft skills necessárias

2. Gere ${count} perguntas que:
   - Sejam ESPECÍFICAS para esta vaga (não genéricas)
   - Avaliem as competências técnicas mencionadas na descrição
   - Tenham níveis de dificuldade apropriados ao cargo
   - Sejam abertas e permitam ao candidato demonstrar conhecimento
   - Incluam pelo menos 1 pergunta comportamental/situacional

3. Para cada pergunta, forneça:
   - A pergunta em si
   - Categoria (technical, behavioral, experience, situational)
   - Dificuldade (basic, intermediate, advanced)
   - Tecnologia/área específica
   - Pontos-chave que uma boa resposta deveria abordar

**FORMATO DE RESPOSTA (JSON):**
{
  "questions": [
    {
      "question": "texto da pergunta",
      "category": "technical|behavioral|experience|situational",
      "difficulty": "basic|intermediate|advanced",
      "technology": "nome da tecnologia ou área",
      "expectedTopics": ["tópico1", "tópico2", "tópico3"],
      "context": "breve contexto sobre por que essa pergunta é relevante para a vaga"
    }
  ]
}

Responda APENAS com o JSON, sem texto adicional.`;
}

/**
 * Constrói prompt para follow-up
 */
function buildFollowUpPrompt(topic, jobDescription, lastQuestion, lastAnswer, transcriptionHistory) {
  const recentTranscriptions = transcriptionHistory.slice(-5).join('\n');
  
  return `Você é um especialista em entrevistas técnicas. Analise a resposta do candidato e gere UMA pergunta de aprofundamento.

**CONTEXTO DA VAGA:**
- Cargo: ${topic}
- Descrição: ${jobDescription || 'Não fornecida'}

**PERGUNTA FEITA:**
${lastQuestion.question}

**RESPOSTA DO CANDIDATO:**
${lastAnswer}

**TRANSCRIÇÕES RECENTES:**
${recentTranscriptions}

**INSTRUÇÕES:**
1. Analise a qualidade e profundidade da resposta
2. Identifique pontos que podem ser aprofundados
3. Gere UMA pergunta de follow-up que:
   - Explore aspectos não mencionados ou superficiais
   - Peça exemplos práticos se a resposta foi teórica
   - Aprofunde em detalhes técnicos se relevante
   - Seja natural e conversacional

**FORMATO DE RESPOSTA (JSON):**
{
  "questions": [
    {
      "question": "texto da pergunta de follow-up",
      "category": "followup",
      "difficulty": "basic|intermediate|advanced",
      "technology": "mesma da pergunta anterior",
      "expectedTopics": ["tópico1", "tópico2"],
      "context": "por que esse follow-up é importante"
    }
  ]
}

Responda APENAS com o JSON, sem texto adicional.`;
}

/**
 * Constrói prompt para avaliação de resposta
 */
function buildEvaluationPrompt(question, answer) {
  return `Você é um especialista em avaliação de entrevistas técnicas. Avalie a resposta do candidato.

**PERGUNTA:**
${question.question}

**RESPOSTA DO CANDIDATO:**
${answer}

**INSTRUÇÕES:**
Avalie a resposta considerando:
1. Correção técnica (conceitos corretos?)
2. Profundidade (superficial ou detalhada?)
3. Exemplos práticos (mencionou experiências reais?)
4. Clareza de comunicação
5. Completude (abordou os pontos principais?)

**FORMATO DE RESPOSTA (JSON):**
{
  "score": 0-100,
  "quality": "excellent|good|basic|incomplete|incorrect",
  "feedback": "feedback construtivo sobre a resposta",
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "improvements": ["área de melhoria 1", "área de melhoria 2"],
  "keyTopics": ["tópico mencionado 1", "tópico mencionado 2"],
  "missingTopics": ["tópico não mencionado 1", "tópico não mencionado 2"]
}

Responda APENAS com o JSON, sem texto adicional.`;
}

/**
 * Constrói prompt para perguntas progressivas
 */
function buildProgressiveQuestionsPrompt(topic, jobDescription, questionsAsked, transcriptionHistory, count) {
  const askedQuestions = questionsAsked.map(qa => `- ${qa.question} (Qualidade: ${qa.answerQuality})`).join('\n');
  const recentTranscriptions = transcriptionHistory.slice(-10).join('\n');
  
  return `Você é um especialista em entrevistas técnicas. Gere ${count} NOVAS perguntas baseadas no progresso da entrevista.

**CONTEXTO DA VAGA:**
- Cargo: ${topic}
- Descrição: ${jobDescription || 'Não fornecida'}

**PERGUNTAS JÁ FEITAS:**
${askedQuestions}

**TRANSCRIÇÕES RECENTES:**
${recentTranscriptions}

**INSTRUÇÕES:**
1. Analise as perguntas já feitas e as respostas do candidato
2. Identifique áreas ainda não exploradas da descrição da vaga
3. Gere ${count} NOVAS perguntas que:
   - NÃO repitam temas já abordados
   - Explorem competências ainda não avaliadas
   - Aumentem gradualmente a dificuldade se as respostas foram boas
   - Sejam relevantes para a vaga específica
   - Incluam variedade (técnicas, comportamentais, situacionais)

**FORMATO DE RESPOSTA (JSON):**
{
  "questions": [
    {
      "question": "texto da pergunta",
      "category": "technical|behavioral|experience|situational",
      "difficulty": "basic|intermediate|advanced",
      "technology": "nome da tecnologia ou área",
      "expectedTopics": ["tópico1", "tópico2", "tópico3"],
      "context": "por que essa pergunta é relevante agora"
    }
  ]
}

Responda APENAS com o JSON, sem texto adicional.`;
}

/**
 * Invoca o modelo Bedrock com timeout e retry
 */
async function invokeBedrockModel(prompt, maxTokens = 2000, retryCount = 0) {
  const startTime = Date.now();
  
  try {
    // Estimar tokens de entrada
    const inputTokens = estimateTokens(prompt);
    
    // Alertar se prompt muito grande
    if (inputTokens > 5000) {
      console.warn(`[WARNING] Prompt muito grande: ${inputTokens} tokens`);
      await recordMetric('LargePrompt', 1);
    }
    
    // Registrar tokens de entrada
    await recordMetric('InputTokens', inputTokens);
    
    // Amazon Nova usa formato diferente do Claude
    const payload = {
      messages: [
        {
          role: 'user',
          content: [
            {
              text: prompt
            }
          ]
        }
      ],
      inferenceConfig: {
        max_new_tokens: maxTokens,
        temperature: 0.7,
        top_p: 0.9
      }
    };

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    console.log(`[Bedrock] Invoking model: ${MODEL_ID} (attempt ${retryCount + 1})`);
    
    // Implementar timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout ao chamar Bedrock')), BEDROCK_TIMEOUT)
    );
    
    const bedrockPromise = bedrockClient.send(command);
    
    const response = await Promise.race([bedrockPromise, timeoutPromise]);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Amazon Nova retorna no formato: { output: { message: { content: [{ text: "..." }] } } }
    const text = responseBody.output?.message?.content?.[0]?.text || responseBody.content?.[0]?.text;
    
    if (!text) {
      console.error('Unexpected response format:', JSON.stringify(responseBody));
      throw new Error('Formato de resposta inesperado do Bedrock');
    }
    
    // Calcular métricas
    const latency = Date.now() - startTime;
    const outputTokens = estimateTokens(text);
    
    // Registrar métricas
    await recordMetric('BedrockLatency', latency, 'Milliseconds');
    await recordMetric('OutputTokens', outputTokens);
    await recordMetric('BedrockSuccess', 1);
    
    // Estimar custo (Amazon Nova Lite: $0.06/1M input, $0.24/1M output)
    const estimatedCost = (inputTokens * 0.00006 + outputTokens * 0.00024) / 1000;
    await recordMetric('EstimatedCost', estimatedCost, 'None');
    
    console.log(`[Bedrock] Success - Latency: ${latency}ms, Input: ${inputTokens} tokens, Output: ${outputTokens} tokens, Cost: $${estimatedCost.toFixed(6)}`);
    
    return text;

  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`[Bedrock] Error after ${latency}ms:`, error.message);
    
    await recordMetric('BedrockError', 1);
    
    // Retry com exponential backoff
    if (error.message.includes('Timeout') && retryCount < MAX_RETRIES) {
      const backoffTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s...
      console.log(`[Bedrock] Retrying after ${backoffTime}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      await recordMetric('BedrockRetry', 1);
      
      return invokeBedrockModel(prompt, maxTokens, retryCount + 1);
    }
    
    // Se todas as tentativas falharam
    if (retryCount >= MAX_RETRIES) {
      console.error('[Bedrock] Todas as tentativas falharam');
      await recordMetric('BedrockMaxRetriesExceeded', 1);
    }
    
    throw new Error(`Erro ao invocar Bedrock: ${error.message}`);
  }
}

/**
 * Estima número de tokens (aproximação: 1 token ≈ 4 caracteres)
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Parse resposta de perguntas
 */
function parseQuestionsResponse(response, type, maxQuestions = 10) {
  try {
    // Extrair JSON da resposta (pode vir com texto antes/depois)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta não contém JSON válido');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Formato de resposta inválido');
    }
    
    // Adicionar IDs e timestamps
    const questions = parsed.questions.slice(0, maxQuestions).map(q => ({
      id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      question: q.question,
      category: q.category || 'technical',
      priority: 'medium',
      timestamp: Date.now(),
      isRead: false,
      context: q.context || '',
      expectedTopics: q.expectedTopics || [],
      difficulty: q.difficulty || 'intermediate',
      technology: q.technology || 'general'
    }));
    
    return { questions };
    
  } catch (error) {
    console.error('Error parsing questions response:', error);
    console.error('Raw response:', response);
    throw new Error(`Erro ao processar resposta da IA: ${error.message}`);
  }
}

/**
 * Parse resposta de avaliação
 */
function parseEvaluationResponse(response) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta não contém JSON válido');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      score: parsed.score || 0,
      quality: parsed.quality || 'incomplete',
      feedback: parsed.feedback || '',
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      keyTopics: parsed.keyTopics || [],
      missingTopics: parsed.missingTopics || []
    };
    
  } catch (error) {
    console.error('Error parsing evaluation response:', error);
    console.error('Raw response:', response);
    throw new Error(`Erro ao processar avaliação: ${error.message}`);
  }
}

/**
 * Gera relatório completo da entrevista
 */
async function generateInterviewReport(context) {
  const { topic, jobDescription, questionsAsked, transcriptionHistory, candidateName } = context;

  const prompt = `Você é um especialista em recrutamento técnico. Analise esta entrevista completa e gere um relatório detalhado.

**CONTEXTO DA VAGA:**
- Cargo: ${topic}
- Descrição: ${jobDescription || 'Não fornecida'}

**PERGUNTAS FEITAS E RESPOSTAS:**
${questionsAsked.map((qa, i) => `
${i + 1}. Pergunta (${qa.category}): ${qa.question}
   Resposta: ${qa.answer || 'Não respondida'}
   Qualidade: ${qa.answerQuality || 'Não avaliada'}
`).join('\n')}

**TRANSCRIÇÃO COMPLETA:**
${transcriptionHistory.slice(-20).join('\n')}

**INSTRUÇÕES:**
Gere um relatório JSON completo com:

1. **overallScore** (0-100): Pontuação geral do candidato
2. **recommendation**: 
   - decision: "Aprovado", "Aprovado com ressalvas", "Não aprovado", ou "Necessita segunda entrevista"
   - status: "approved", "approved_with_reservations", "rejected", ou "needs_second_interview"
   - title: Título da recomendação
   - description: Descrição detalhada (2-3 frases)
   - details: Array com 3-5 pontos específicos

3. **strengths**: Array com 5-7 pontos fortes demonstrados

4. **improvements**: Array com 3-5 áreas de melhoria

5. **technicalAnalysis**:
   - mentionedTechnologies: Array de tecnologias mencionadas pelo candidato
   - relevantTechnologies: Array de tecnologias relevantes da vaga
   - area: Área técnica principal
   - score: Pontuação técnica (0-100)
   - depth: "basic", "intermediate", ou "advanced"
   - description: Análise detalhada (2-3 frases)
   - alignment: Alinhamento com a vaga (0-100)

6. **softSkills**: Array de 4-6 soft skills com:
   - name: Nome da habilidade
   - score: Pontuação (0-100)
   - description: Evidência observada

7. **seniorityLevel**:
   - level: "junior", "pleno", ou "senior"
   - description: Justificativa (2-3 frases)

8. **summary**: Resumo executivo da entrevista (3-4 frases)

**IMPORTANTE:**
- Base a análise APENAS nas respostas e transcrição fornecidas
- Seja específico e cite exemplos das respostas
- Compare com os requisitos da vaga
- Seja honesto e construtivo

Retorne APENAS o JSON, sem texto adicional.`;

  const response = await invokeBedrockModel(prompt, 3000);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta não contém JSON válido');
    }
    
    const report = JSON.parse(jsonMatch[0]);
    
    // Adicionar metadados
    report.topic = topic;
    report.candidateName = candidateName || 'Candidato';
    report.generatedAt = new Date().toISOString();
    report.transcriptionCount = transcriptionHistory.length;
    report.questionsAskedCount = questionsAsked.length;
    report.candidateResponseCount = questionsAsked.filter(qa => qa.answer).length;
    
    // Extrair tecnologias da descrição da vaga
    if (jobDescription) {
      const techKeywords = [
        'javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'python', 'java',
        'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'sql', 'nosql', 'mongodb',
        'postgresql', 'mysql', 'redis', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
        'git', 'ci/cd', 'agile', 'scrum', 'rest', 'graphql', 'microservices'
      ];
      
      const jobTechs = techKeywords.filter(tech => 
        jobDescription.toLowerCase().includes(tech)
      );
      
      report.jobTechnologies = jobTechs;
    } else {
      report.jobTechnologies = [];
    }
    
    console.log('Relatório gerado com sucesso');
    return { report };
    
  } catch (error) {
    console.error('Error parsing report response:', error);
    console.error('Raw response:', response);
    throw new Error(`Erro ao processar relatório: ${error.message}`);
  }
}

/**
 * Resposta de sucesso
 */
function successResponse(data) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify({
      success: true,
      ...data
    })
  };
}

/**
 * Resposta de erro
 */
function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify({
      success: false,
      error: message
    })
  };
}
