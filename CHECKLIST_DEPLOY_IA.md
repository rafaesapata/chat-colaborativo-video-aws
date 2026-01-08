# ✅ Checklist de Deploy - IA para Entrevistas

## 📋 Pré-requisitos

- [ ] AWS CLI configurado
- [ ] SAM CLI instalado
- [ ] Acesso à conta AWS (383234048592)
- [ ] Permissões para deploy no CloudFormation
- [ ] Acesso ao Bedrock habilitado

## 🔧 Configuração AWS Bedrock

### 1. Habilitar Modelo Claude 3.5 Sonnet

```bash
# Acessar console AWS Bedrock
# Região: us-east-1
# Model access → Request model access
# Selecionar: Claude 3.5 Sonnet v2
# Aguardar aprovação (geralmente instantâneo)
```

- [ ] Modelo `anthropic.claude-3-5-sonnet-20241022-v2:0` habilitado
- [ ] Região: us-east-1
- [ ] Status: Available

### 2. Verificar Permissões IAM

```bash
# Verificar se a role do Lambda tem permissões Bedrock
aws iam get-role --role-name chat-colaborativo-serverless-InterviewAIFunction-Role
```

- [ ] Permissão: `bedrock:InvokeModel`
- [ ] Permissão: `bedrock:InvokeModelWithResponseStream`

## 📦 Deploy Backend

### 1. Instalar Dependências

```bash
cd backend/lambdas/interview-ai
npm install
cd ../../..
```

- [ ] Dependências instaladas
- [ ] Arquivo `node_modules/` criado

### 2. Build SAM

```bash
sam build --template-file infrastructure/complete-stack.yaml
```

**Verificar**:
- [ ] Build bem-sucedido
- [ ] Pasta `.aws-sam/build/` criada
- [ ] Lambda `InterviewAIFunction` no build
- [ ] Lambda `ChimeMeetingFunction` no build

### 3. Deploy SAM

```bash
sam deploy --config-file samconfig.toml --no-confirm-changeset
```

**Verificar**:
- [ ] Stack: `chat-colaborativo-serverless`
- [ ] Região: `us-east-1`
- [ ] Status: `CREATE_COMPLETE` ou `UPDATE_COMPLETE`
- [ ] Novos recursos criados:
  - [ ] `InterviewAIFunction`
  - [ ] `ChimeMeetingFunction`
  - [ ] Rotas HTTP atualizadas

### 4. Verificar Lambdas

```bash
# Verificar Interview AI Lambda
aws lambda get-function \
  --function-name chat-colaborativo-serverless-InterviewAIFunction \
  --region us-east-1

# Verificar Chime Meeting Lambda
aws lambda get-function \
  --function-name chat-colaborativo-serverless-chime-meeting \
  --region us-east-1
```

- [ ] Interview AI Lambda existe
- [ ] Chime Meeting Lambda existe
- [ ] Timeout: 90s (Interview AI)
- [ ] Memória: 2048 MB (Interview AI)
- [ ] Variável `INTERVIEW_AI_LAMBDA` configurada

## 🌐 Deploy Frontend

### 1. Build Frontend

```bash
cd frontend
npm run build
```

**Verificar**:
- [ ] Build bem-sucedido
- [ ] Pasta `dist/` criada
- [ ] Arquivos JS/CSS gerados

### 2. Deploy para S3

```bash
aws s3 sync dist/ s3://chat-colaborativo-prod-frontend-383234048592 --delete
```

- [ ] Arquivos enviados
- [ ] Bucket: `chat-colaborativo-prod-frontend-383234048592`
- [ ] Flag `--delete` usada (remove arquivos antigos)

### 3. Invalidar CloudFront

```bash
aws cloudfront create-invalidation \
  --distribution-id E19FZWDK7MJWSX \
  --paths "/*"
```

- [ ] Invalidação criada
- [ ] Distribution ID: `E19FZWDK7MJWSX`
- [ ] Status: `InProgress` ou `Completed`

### 4. Aguardar Propagação

```bash
# Verificar status da invalidação
aws cloudfront get-invalidation \
  --distribution-id E19FZWDK7MJWSX \
  --id <INVALIDATION_ID>
```

- [ ] Status: `Completed`
- [ ] Tempo estimado: 2-5 minutos

## 🧪 Testes

### 1. Teste de API Direta

```bash
curl -X POST https://y08b6lfdel.execute-api.us-east-1.amazonaws.com/prod/interview/ai \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generateInitialQuestions",
    "context": {
      "meetingType": "ENTREVISTA",
      "topic": "Desenvolvedor Full Stack Sênior",
      "jobDescription": "Buscamos desenvolvedor com 5+ anos de experiência em React, Node.js, TypeScript, AWS. Experiência com Docker e Kubernetes.",
      "transcriptionHistory": [],
      "questionsAsked": []
    },
    "count": 3
  }'
```

**Resultado esperado**:
```json
{
  "success": true,
  "questions": [
    {
      "id": "...",
      "question": "Como você estruturaria...",
      "category": "technical",
      "difficulty": "advanced",
      "technology": "architecture",
      "expectedTopics": ["..."],
      "context": "..."
    }
  ]
}
```

- [ ] Status: 200
- [ ] 3 perguntas retornadas
- [ ] Perguntas específicas para a vaga
- [ ] Tempo de resposta < 10 segundos

### 2. Teste no Frontend

1. Acessar: https://livechat.ai.udstec.io
2. Fazer login
3. Criar nova reunião:
   - Tipo: **ENTREVISTA**
   - Cargo: "Desenvolvedor Full Stack Sênior"
   - Descrição: Incluir tecnologias, requisitos, nível
4. Iniciar reunião
5. Verificar painel de sugestões

**Verificar**:
- [ ] 3 perguntas aparecem automaticamente
- [ ] Perguntas são específicas para a vaga
- [ ] Perguntas mencionam tecnologias da descrição
- [ ] Loading state aparece durante geração
- [ ] Sem erros no console

### 3. Teste de Follow-up

1. Na reunião, fazer uma pergunta sugerida
2. Candidato responde (simular com transcrição)
3. Aguardar 1-2 segundos

**Verificar**:
- [ ] Pergunta marcada como "lida" automaticamente
- [ ] Follow-up gerado após resposta
- [ ] Follow-up é contextual à resposta

### 4. Teste de Avaliação

1. Após resposta do candidato
2. Verificar painel de Q&A

**Verificar**:
- [ ] Resposta avaliada (score 0-100)
- [ ] Qualidade atribuída (excellent/good/basic/incomplete)
- [ ] Feedback construtivo exibido
- [ ] Tópicos identificados

## 📊 Monitoramento

### 1. CloudWatch Logs

```bash
# Logs do Interview AI
aws logs tail /aws/lambda/chat-colaborativo-serverless-InterviewAIFunction --follow

# Logs do Chime Meeting
aws logs tail /aws/lambda/chat-colaborativo-serverless-chime-meeting --follow
```

**Verificar**:
- [ ] Logs aparecem em tempo real
- [ ] Sem erros críticos
- [ ] Tempo de execução < 10s
- [ ] Bedrock invocado com sucesso

### 2. Métricas CloudWatch

```bash
# Verificar invocações
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=chat-colaborativo-serverless-InterviewAIFunction \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

- [ ] Invocações registradas
- [ ] Taxa de erro < 1%
- [ ] Duração média < 10s

### 3. Custos

```bash
# Verificar custos Bedrock
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d '1 day ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --filter file://bedrock-filter.json
```

- [ ] Custos dentro do esperado (~$0.03 por entrevista)
- [ ] Sem picos inesperados

## 🔄 Rollback (se necessário)

### Se algo der errado:

```bash
# 1. Reverter stack CloudFormation
aws cloudformation update-stack \
  --stack-name chat-colaborativo-serverless \
  --use-previous-template \
  --capabilities CAPABILITY_IAM

# 2. Reverter frontend (deploy versão anterior)
aws s3 sync s3://chat-colaborativo-prod-frontend-383234048592-backup/ \
  s3://chat-colaborativo-prod-frontend-383234048592/ --delete

# 3. Invalidar CloudFront
aws cloudfront create-invalidation \
  --distribution-id E19FZWDK7MJWSX \
  --paths "/*"
```

## ✅ Checklist Final

- [ ] Backend deployado com sucesso
- [ ] Frontend deployado com sucesso
- [ ] CloudFront invalidado
- [ ] Testes de API passando
- [ ] Testes de UI passando
- [ ] Logs sem erros
- [ ] Métricas normais
- [ ] Custos dentro do esperado
- [ ] Documentação atualizada
- [ ] Time notificado

## 📞 Contatos de Suporte

- **AWS Support**: https://console.aws.amazon.com/support/
- **Bedrock Documentation**: https://docs.aws.amazon.com/bedrock/
- **Documentação do Projeto**: `IMPLEMENTACAO_IA_ENTREVISTAS.md`

## 🎉 Deploy Concluído!

Se todos os itens estão marcados, o deploy foi bem-sucedido! 🚀

**Próximos passos**:
1. Monitorar logs por 24h
2. Coletar feedback dos usuários
3. Ajustar prompts se necessário
4. Otimizar custos se necessário
