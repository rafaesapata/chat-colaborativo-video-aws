# Implementação de IA Generativa para Entrevistas

## 🎯 Objetivo

Remover todo o hardcoding de perguntas e implementar geração dinâmica e inteligente usando **AWS Bedrock (Claude 3.5 Sonnet)** baseada no contexto real da vaga.

## ✅ O que foi implementado

### 1. **Novo Lambda de IA (`interview-ai`)**
- **Localização**: `backend/lambdas/interview-ai/`
- **Modelo**: Claude 3.5 Sonnet (anthropic.claude-3-5-sonnet-20241022-v2:0)
- **Timeout**: 90 segundos
- **Memória**: 2048 MB

**Funcionalidades**:
- ✅ `generateInitialQuestions`: Gera perguntas iniciais personalizadas baseadas na descrição da vaga
- ✅ `generateFollowUp`: Cria follow-ups contextuais baseados na resposta do candidato
- ✅ `evaluateAnswer`: Avalia semanticamente a qualidade da resposta
- ✅ `generateNewQuestions`: Gera novas perguntas adaptadas ao progresso da entrevista

**Prompts Inteligentes**:
- Analisa descrição da vaga para identificar:
  - Tecnologias obrigatórias vs desejáveis
  - Nível de senioridade (júnior, pleno, sênior)
  - Áreas de foco (backend, frontend, fullstack, devops, etc)
  - Responsabilidades principais
- Gera perguntas específicas (não genéricas)
- Adapta dificuldade ao cargo
- Inclui perguntas técnicas e comportamentais

### 2. **Serviço Frontend Reescrito (`interviewAIService.ts`)**
- **Antes**: Banco hardcoded com ~500 perguntas técnicas
- **Depois**: Chamadas assíncronas para API de IA

**Mudanças**:
- ❌ Removido: `technicalQuestionsBank` (banco de perguntas hardcoded)
- ❌ Removido: `techCategoryMap` (mapeamento de tecnologias)
- ❌ Removido: `extractJobRequirements` (parsing manual)
- ✅ Adicionado: Funções assíncronas que chamam Bedrock
- ✅ Adicionado: Cache de 30 segundos para evitar chamadas duplicadas
- ✅ Adicionado: Tratamento de erros robusto

### 3. **Hook Atualizado (`useInterviewAssistant.ts`)**
- Todas as chamadas síncronas convertidas para assíncronas
- Geração de perguntas iniciais com loading state
- Follow-ups automáticos após detecção de pergunta
- Avaliação de respostas com feedback da IA
- Geração progressiva de novas perguntas

### 4. **Integração no Lambda Principal (`chime-meeting`)**
- Novo handler: `handleInterviewAI`
- Faz proxy para o Lambda de IA
- Rota: `POST /interview/ai`
- Validação de ações permitidas
- Logging estruturado

### 5. **Infraestrutura Atualizada (`complete-stack.yaml`)**
- ✅ Novo Lambda: `InterviewAIFunction`
- ✅ Novo Lambda: `ChimeMeetingFunction` (adicionado ao template)
- ✅ Permissões Bedrock configuradas
- ✅ Variável de ambiente: `INTERVIEW_AI_LAMBDA`
- ✅ Rotas HTTP configuradas no Recording API
- ✅ Permissões Lambda para invocação

## 📋 Arquivos Modificados

### Backend
1. ✅ `backend/lambdas/interview-ai/index.js` (NOVO)
2. ✅ `backend/lambdas/interview-ai/package.json` (NOVO)
3. ✅ `backend/lambdas/chime-meeting/index.js` (handler + rota)
4. ✅ `infrastructure/complete-stack.yaml` (Lambda + rotas)

### Frontend
1. ✅ `frontend/src/services/interviewAIService.ts` (reescrito)
2. ✅ `frontend/src/hooks/useInterviewAssistant.ts` (async)

## 🚀 Como Funciona Agora

### Fluxo de Geração de Perguntas

```
1. Usuário cria entrevista
   ├─ Informa: Cargo (ex: "Desenvolvedor Full Stack Sênior")
   └─ Informa: Descrição completa da vaga

2. Frontend chama: generateInitialQuestions
   ├─ Envia contexto completo para Bedrock
   ├─ IA analisa requisitos da vaga
   ├─ IA identifica tecnologias e nível
   └─ IA gera 3 perguntas personalizadas

3. Durante a entrevista:
   ├─ Detecção automática de pergunta feita
   ├─ Avaliação da resposta do candidato
   ├─ Geração de follow-up se resposta incompleta
   └─ Novas perguntas a cada N respostas

4. Avaliação contínua:
   ├─ Score de 0-100
   ├─ Qualidade: excellent/good/basic/incomplete
   ├─ Feedback construtivo
   ├─ Pontos fortes identificados
   └─ Áreas de melhoria sugeridas
```

### Exemplo de Prompt Enviado ao Bedrock

```
Você é um especialista em recrutamento técnico. Sua tarefa é gerar 3 perguntas 
PERSONALIZADAS para uma entrevista de emprego.

CONTEXTO DA VAGA:
- Cargo: Desenvolvedor Full Stack Sênior
- Descrição completa: Buscamos desenvolvedor com 5+ anos de experiência em React, 
  Node.js, TypeScript, AWS. Experiência com arquitetura de microserviços, Docker, 
  Kubernetes. Desejável: GraphQL, Redis, MongoDB.

INSTRUÇÕES:
1. Analise cuidadosamente a descrição da vaga para identificar:
   - Tecnologias obrigatórias e desejáveis
   - Nível de senioridade
   - Responsabilidades principais
   - Soft skills necessárias

2. Gere 3 perguntas que:
   - Sejam ESPECÍFICAS para esta vaga (não genéricas)
   - Avaliem as competências técnicas mencionadas
   - Tenham dificuldade apropriada (sênior = intermediate/advanced)
   - Sejam abertas e permitam demonstrar conhecimento
   - Incluam pelo menos 1 pergunta comportamental

3. Para cada pergunta, forneça:
   - A pergunta em si
   - Categoria (technical, behavioral, experience, situational)
   - Dificuldade (basic, intermediate, advanced)
   - Tecnologia/área específica
   - Pontos-chave que uma boa resposta deveria abordar

FORMATO DE RESPOSTA (JSON):
{
  "questions": [
    {
      "question": "Como você estruturaria uma arquitetura de microserviços...",
      "category": "technical",
      "difficulty": "advanced",
      "technology": "architecture",
      "expectedTopics": ["API Gateway", "Service Discovery", "Event-driven"],
      "context": "Avalia experiência com arquitetura distribuída"
    }
  ]
}
```

## 🔧 Configuração Necessária

### Permissões IAM

O Lambda `InterviewAIFunction` precisa de:
```yaml
- bedrock:InvokeModel
- bedrock:InvokeModelWithResponseStream
```

### Variáveis de Ambiente

No `ChimeMeetingFunction`:
```yaml
INTERVIEW_AI_LAMBDA: !GetAtt InterviewAIFunction.Arn
```

### Modelo Bedrock

- **Modelo**: `anthropic.claude-3-5-sonnet-20241022-v2:0`
- **Região**: us-east-1
- **Acesso**: Deve estar habilitado no console AWS Bedrock

## 📦 Deploy

### 1. Instalar dependências do novo Lambda

```bash
cd backend/lambdas/interview-ai
npm install
cd ../../..
```

### 2. Build e Deploy do Backend

```bash
# Build
sam build --template-file infrastructure/complete-stack.yaml

# Deploy
sam deploy --config-file samconfig.toml --no-confirm-changeset
```

### 3. Build e Deploy do Frontend

```bash
# Build
cd frontend && npm run build

# Deploy para S3
aws s3 sync dist/ s3://chat-colaborativo-prod-frontend-383234048592 --delete

# Invalidar cache CloudFront
aws cloudfront create-invalidation --distribution-id E19FZWDK7MJWSX --paths "/*"
```

## 🧪 Testando

### 1. Criar uma entrevista

```javascript
// No frontend, ao criar reunião:
{
  meetingType: 'ENTREVISTA',
  topic: 'Desenvolvedor Full Stack Sênior',
  jobDescription: `
    Buscamos desenvolvedor com 5+ anos de experiência.
    
    Obrigatório:
    - React, Node.js, TypeScript
    - AWS (Lambda, DynamoDB, S3)
    - Docker, Kubernetes
    
    Desejável:
    - GraphQL, Redis, MongoDB
    - Experiência com arquitetura de microserviços
  `
}
```

### 2. Verificar logs do Lambda

```bash
# Logs do Interview AI
aws logs tail /aws/lambda/chat-colaborativo-serverless-InterviewAIFunction --follow

# Logs do Chime Meeting
aws logs tail /aws/lambda/chat-colaborativo-serverless-chime-meeting --follow
```

### 3. Testar API diretamente

```bash
curl -X POST https://y08b6lfdel.execute-api.us-east-1.amazonaws.com/prod/interview/ai \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generateInitialQuestions",
    "context": {
      "meetingType": "ENTREVISTA",
      "topic": "Desenvolvedor Full Stack Sênior",
      "jobDescription": "Buscamos desenvolvedor com 5+ anos...",
      "transcriptionHistory": [],
      "questionsAsked": []
    },
    "count": 3
  }'
```

## 🎯 Benefícios

### Antes (Hardcoded)
- ❌ Perguntas genéricas
- ❌ Não considera contexto da vaga
- ❌ Banco limitado (~500 perguntas)
- ❌ Avaliação por keywords simples
- ❌ Sem adaptação ao progresso

### Depois (IA Generativa)
- ✅ Perguntas personalizadas para cada vaga
- ✅ Analisa descrição completa
- ✅ Infinitas possibilidades de perguntas
- ✅ Avaliação semântica inteligente
- ✅ Adapta-se ao contexto da conversa
- ✅ Follow-ups contextuais
- ✅ Feedback construtivo

## 📊 Custos Estimados

### AWS Bedrock (Claude 3.5 Sonnet)
- **Input**: $0.003 por 1K tokens
- **Output**: $0.015 por 1K tokens

**Estimativa por entrevista**:
- Perguntas iniciais: ~2K tokens input + 500 tokens output = $0.01
- Follow-ups (3x): ~1.5K tokens input + 300 tokens output = $0.01
- Avaliações (5x): ~1K tokens input + 200 tokens output = $0.01
- **Total por entrevista**: ~$0.03

**Para 100 entrevistas/mês**: ~$3.00

### Lambda
- Interview AI: 90s timeout, 2048MB = ~$0.0003 por invocação
- **Total por entrevista**: ~$0.003 (10 invocações)

**Custo total estimado**: $3.30/mês para 100 entrevistas

## 🔒 Segurança

- ✅ Validação de ações permitidas
- ✅ Timeout configurado (90s)
- ✅ Rate limiting no API Gateway
- ✅ CORS configurado
- ✅ Logs estruturados
- ✅ Tratamento de erros robusto
- ✅ Cache para evitar chamadas duplicadas

## 📝 Próximos Passos (Opcional)

1. **Análise de sentimento**: Avaliar tom e confiança do candidato
2. **Comparação entre candidatos**: Ranking automático
3. **Relatório final**: Resumo executivo da entrevista
4. **Perguntas em múltiplos idiomas**: Suporte internacional
5. **Fine-tuning**: Treinar modelo específico para sua empresa

## 🐛 Troubleshooting

### Erro: "Bedrock model not found"
- Verificar se o modelo está habilitado no console Bedrock
- Região correta: us-east-1

### Erro: "Lambda timeout"
- Aumentar timeout do InterviewAIFunction (já está em 90s)
- Verificar se Bedrock está respondendo

### Perguntas não aparecem
- Verificar logs do Lambda
- Verificar se INTERVIEW_AI_LAMBDA está configurado
- Testar API diretamente com curl

### Cache muito agressivo
- Ajustar CACHE_TTL em interviewAIService.ts (padrão: 30s)
- Limpar cache: `interviewAIService.clearCache()`

## 📚 Referências

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude 3.5 Sonnet Model Card](https://www.anthropic.com/claude)
- [SAM CLI Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
