# 🎖️ Análise Nível Militar - Sistema de IA para Entrevistas

**Data:** 08/01/2026  
**Objetivo:** Elevar o sistema ao padrão militar/ouro de qualidade

---

## ✅ PONTOS FORTES ATUAIS

### 1. Arquitetura
- ✅ Separação clara de responsabilidades (Lambda dedicado para IA)
- ✅ API Gateway com rotas bem definidas
- ✅ Uso de AWS Bedrock (serviço gerenciado, sem infra para manter)
- ✅ Cache inteligente no frontend (30s TTL)
- ✅ Fallback gracioso em caso de erro

### 2. Funcionalidades
- ✅ Geração dinâmica de perguntas (sem hardcoding)
- ✅ Follow-up inteligente baseado em respostas
- ✅ Avaliação automática de respostas
- ✅ Relatório completo com IA
- ✅ Detecção automática de perguntas feitas

### 3. Segurança
- ✅ CORS configurado
- ✅ Validação de entrada
- ✅ Tratamento de erros
- ✅ Logs estruturados

---

## ⚠️ MELHORIAS CRÍTICAS NECESSÁRIAS

### 1. **Validação e Sanitização** 🔴 CRÍTICO

**Problema:** Falta validação rigorosa de entrada
```javascript
// ATUAL - Sem validação
const { action, context, count, lastAnswer } = body;

// DEVE SER:
function validateInput(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Body inválido');
  }
  
  const { action, context, count, lastAnswer } = body;
  
  // Validar action
  const validActions = ['generateInitialQuestions', 'generateFollowUp', 'evaluateAnswer', 'generateNewQuestions', 'generateReport'];
  if (!validActions.includes(action)) {
    throw new Error(`Action inválida: ${action}`);
  }
  
  // Validar context
  if (!context || typeof context !== 'object') {
    throw new Error('Context é obrigatório');
  }
  
  if (!context.meetingType || !context.topic) {
    throw new Error('meetingType e topic são obrigatórios');
  }
  
  // Sanitizar strings para prevenir injection
  const sanitizedContext = {
    ...context,
    topic: sanitizeString(context.topic),
    jobDescription: sanitizeString(context.jobDescription),
    candidateName: sanitizeString(context.candidateName)
  };
  
  return { action, context: sanitizedContext, count, lastAnswer };
}

function sanitizeString(str) {
  if (!str) return '';
  return str
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/[{}]/g, '') // Remove JSON injection
    .substring(0, 10000); // Limitar tamanho
}
```

### 2. **Rate Limiting e Throttling** 🔴 CRÍTICO

**Problema:** Sem proteção contra abuso
```javascript
// ADICIONAR no início do handler:
const rateLimiter = new Map(); // userId -> { count, resetTime }

function checkRateLimit(userId) {
  const now = Date.now();
  const limit = rateLimiter.get(userId);
  
  if (!limit || now > limit.resetTime) {
    rateLimiter.set(userId, { count: 1, resetTime: now + 60000 }); // 1 minuto
    return true;
  }
  
  if (limit.count >= 20) { // Max 20 requests por minuto
    throw new Error('Rate limit excedido. Aguarde 1 minuto.');
  }
  
  limit.count++;
  return true;
}
```

### 3. **Timeout e Retry** 🟡 IMPORTANTE

**Problema:** Sem timeout configurado para Bedrock
```javascript
// ADICIONAR timeout:
async function invokeBedrockModel(prompt, maxTokens = 2000) {
  const timeout = 30000; // 30 segundos
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout ao chamar Bedrock')), timeout)
  );
  
  const bedrockPromise = bedrockClient.send(command);
  
  try {
    const response = await Promise.race([bedrockPromise, timeoutPromise]);
    // ... resto do código
  } catch (error) {
    if (error.message.includes('Timeout')) {
      // Retry com exponential backoff
      await new Promise(r => setTimeout(r, 1000));
      return invokeBedrockModel(prompt, maxTokens); // Retry uma vez
    }
    throw error;
  }
}
```

### 4. **Métricas e Observabilidade** 🟡 IMPORTANTE

**Problema:** Logs básicos, sem métricas
```javascript
// ADICIONAR CloudWatch Metrics:
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

async function recordMetric(metricName, value, unit = 'Count') {
  try {
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'InterviewAI',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date()
      }]
    }));
  } catch (error) {
    console.error('Erro ao enviar métrica:', error);
  }
}

// Usar em pontos críticos:
await recordMetric('QuestionsGenerated', questions.length);
await recordMetric('BedrockLatency', latency, 'Milliseconds');
await recordMetric('ErrorRate', 1);
```

### 5. **Cache Distribuído** 🟢 DESEJÁVEL

**Problema:** Cache apenas no frontend (não compartilhado)
```javascript
// ADICIONAR ElastiCache/DynamoDB para cache:
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

async function getCachedResponse(cacheKey) {
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: 'InterviewAICache',
      Key: { cacheKey: { S: cacheKey } }
    }));
    
    if (result.Item && result.Item.ttl.N > Date.now() / 1000) {
      return JSON.parse(result.Item.data.S);
    }
  } catch (error) {
    console.warn('Cache miss:', error);
  }
  return null;
}

async function setCachedResponse(cacheKey, data, ttlSeconds = 300) {
  try {
    await dynamodb.send(new PutItemCommand({
      TableName: 'InterviewAICache',
      Item: {
        cacheKey: { S: cacheKey },
        data: { S: JSON.stringify(data) },
        ttl: { N: String(Math.floor(Date.now() / 1000) + ttlSeconds) }
      }
    }));
  } catch (error) {
    console.error('Erro ao salvar cache:', error);
  }
}
```

### 6. **Versionamento de Prompts** 🟢 DESEJÁVEL

**Problema:** Prompts hardcoded, difícil de testar/melhorar
```javascript
// MOVER prompts para DynamoDB/S3:
const PROMPTS = {
  v1: {
    initialQuestions: `prompt v1...`,
    followUp: `prompt v1...`,
    evaluation: `prompt v1...`,
    report: `prompt v1...`
  },
  v2: {
    // Versão melhorada
  }
};

async function getPrompt(type, version = 'v1') {
  // Buscar do DynamoDB/S3
  // Permite A/B testing e rollback
}
```

### 7. **Testes Automatizados** 🔴 CRÍTICO

**Problema:** Sem testes
```javascript
// ADICIONAR testes unitários e integração:
// tests/interview-ai.test.js

describe('Interview AI Lambda', () => {
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
      })
    };
    
    const result = await handler(event);
    const body = JSON.parse(result.body);
    
    expect(result.statusCode).toBe(200);
    expect(body.questions).toHaveLength(3);
    expect(body.questions[0]).toHaveProperty('question');
    expect(body.questions[0]).toHaveProperty('category');
  });
  
  test('deve rejeitar action inválida', async () => {
    const event = {
      body: JSON.stringify({
        action: 'invalidAction',
        context: {}
      })
    };
    
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});
```

### 8. **Monitoramento de Custos** 🟡 IMPORTANTE

**Problema:** Sem controle de custos do Bedrock
```javascript
// ADICIONAR tracking de tokens:
function estimateTokens(text) {
  // Aproximação: 1 token ≈ 4 caracteres
  return Math.ceil(text.length / 4);
}

async function invokeBedrockModel(prompt, maxTokens = 2000) {
  const inputTokens = estimateTokens(prompt);
  
  // Alertar se muito grande
  if (inputTokens > 5000) {
    console.warn('Prompt muito grande:', inputTokens, 'tokens');
    await recordMetric('LargePrompt', 1);
  }
  
  const startTime = Date.now();
  const response = await bedrockClient.send(command);
  const latency = Date.now() - startTime;
  
  const outputTokens = estimateTokens(text);
  
  // Registrar métricas de custo
  await recordMetric('InputTokens', inputTokens);
  await recordMetric('OutputTokens', outputTokens);
  await recordMetric('BedrockLatency', latency, 'Milliseconds');
  
  // Custo estimado (Amazon Nova Lite)
  const estimatedCost = (inputTokens * 0.00006 + outputTokens * 0.00024) / 1000;
  await recordMetric('EstimatedCost', estimatedCost, 'None');
  
  return text;
}
```

### 9. **Fallback para Modelo Alternativo** 🟢 DESEJÁVEL

**Problema:** Se Bedrock falhar, sistema para
```javascript
// ADICIONAR fallback:
async function invokeBedrockModel(prompt, maxTokens = 2000, retryCount = 0) {
  try {
    return await invokeBedrockPrimary(MODEL_ID, prompt, maxTokens);
  } catch (error) {
    console.error('Erro no modelo primário:', error);
    
    if (retryCount < 1) {
      // Tentar modelo alternativo
      console.log('Tentando modelo alternativo...');
      return await invokeBedrockModel(prompt, maxTokens, retryCount + 1);
    }
    
    // Fallback para resposta genérica
    console.error('Todos os modelos falharam, usando fallback');
    return getFallbackResponse(prompt);
  }
}

function getFallbackResponse(prompt) {
  // Retornar perguntas genéricas mas válidas
  if (prompt.includes('perguntas iniciais')) {
    return JSON.stringify({
      questions: [
        {
          question: "Conte-me sobre sua experiência profissional mais relevante para esta vaga.",
          category: "experience",
          difficulty: "basic",
          technology: "general",
          expectedTopics: ["experiência", "projetos", "responsabilidades"],
          context: "Pergunta genérica de fallback"
        }
      ]
    });
  }
  throw new Error('Não foi possível gerar resposta');
}
```

### 10. **Segurança de Dados Sensíveis** 🔴 CRÍTICO

**Problema:** Transcrições podem conter dados sensíveis
```javascript
// ADICIONAR sanitização de PII:
function sanitizePII(text) {
  if (!text) return text;
  
  // Remover emails
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  
  // Remover telefones
  text = text.replace(/\(?\d{2,3}\)?[\s-]?\d{4,5}[\s-]?\d{4}/g, '[TELEFONE]');
  
  // Remover CPF
  text = text.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '[CPF]');
  
  // Remover números de cartão
  text = text.replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[CARTAO]');
  
  return text;
}

// Aplicar antes de enviar para Bedrock:
const sanitizedTranscriptions = transcriptionHistory.map(sanitizePII);
```

---

## 📊 PRIORIZAÇÃO DE IMPLEMENTAÇÃO

### 🔴 FASE 1 - CRÍTICO (Implementar AGORA)
1. Validação e sanitização de entrada
2. Rate limiting
3. Testes automatizados
4. Sanitização de PII

### 🟡 FASE 2 - IMPORTANTE (Próxima semana)
5. Timeout e retry
6. Métricas e observabilidade
7. Monitoramento de custos

### 🟢 FASE 3 - DESEJÁVEL (Próximo mês)
8. Cache distribuído
9. Versionamento de prompts
10. Fallback para modelo alternativo

---

## 🎯 CHECKLIST NÍVEL MILITAR

- [ ] **Segurança**
  - [ ] Validação rigorosa de entrada
  - [ ] Sanitização de PII
  - [ ] Rate limiting por usuário
  - [ ] Timeout configurado
  - [ ] HTTPS obrigatório
  - [ ] Logs sem dados sensíveis

- [ ] **Confiabilidade**
  - [ ] Retry com exponential backoff
  - [ ] Fallback para modelo alternativo
  - [ ] Circuit breaker
  - [ ] Health checks
  - [ ] Graceful degradation

- [ ] **Observabilidade**
  - [ ] Métricas no CloudWatch
  - [ ] Logs estruturados
  - [ ] Tracing distribuído (X-Ray)
  - [ ] Alertas configurados
  - [ ] Dashboard de monitoramento

- [ ] **Performance**
  - [ ] Cache distribuído
  - [ ] Otimização de prompts
  - [ ] Compressão de payloads
  - [ ] Connection pooling
  - [ ] Lazy loading

- [ ] **Qualidade**
  - [ ] Testes unitários (>80% cobertura)
  - [ ] Testes de integração
  - [ ] Testes de carga
  - [ ] Code review obrigatório
  - [ ] Linting e formatação

- [ ] **Custos**
  - [ ] Monitoramento de tokens
  - [ ] Alertas de custo
  - [ ] Otimização de prompts
  - [ ] Cache agressivo
  - [ ] Budget limits

---

## 💰 ESTIMATIVA DE CUSTOS ATUAL

**Amazon Nova Lite:**
- Input: $0.06 por 1M tokens
- Output: $0.24 por 1M tokens

**Cenário: 100 entrevistas/dia**
- 3 perguntas iniciais: ~500 tokens input, ~300 tokens output
- 5 follow-ups: ~800 tokens input, ~200 tokens output
- 1 relatório: ~2000 tokens input, ~1500 tokens output
- **Total por entrevista:** ~3300 tokens input, ~2000 tokens output
- **Custo por entrevista:** ~$0.0007 (menos de 1 centavo!)
- **Custo mensal (100/dia):** ~$21/mês

**Muito barato! Mas ainda assim deve ser monitorado.**

---

## 🚀 PRÓXIMOS PASSOS

1. Implementar validação e sanitização (2h)
2. Adicionar rate limiting (1h)
3. Criar testes automatizados (4h)
4. Configurar métricas CloudWatch (2h)
5. Adicionar timeout e retry (1h)
6. Implementar sanitização de PII (2h)

**Total estimado:** 12 horas de desenvolvimento

---

## 📝 CONCLUSÃO

O sistema atual está **funcional e bem arquitetado**, mas precisa de **melhorias críticas de segurança e confiabilidade** para atingir nível militar.

**Pontuação atual:** 7/10  
**Pontuação alvo:** 10/10

**Principais gaps:**
- Falta validação rigorosa
- Sem rate limiting
- Sem testes automatizados
- Sem métricas detalhadas
- Sem proteção de PII

Implementando as melhorias da Fase 1, o sistema atinge **9/10**.  
Com Fase 2 e 3, atinge **10/10 - Nível Militar**.
