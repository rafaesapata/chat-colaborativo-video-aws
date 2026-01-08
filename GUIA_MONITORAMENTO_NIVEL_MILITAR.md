# 📊 Guia de Monitoramento - Nível Militar

**Sistema:** Interview AI Lambda  
**Versão:** 5.0.0  
**Data:** 08/01/2026

---

## 🎯 QUICK START

### Verificar Status do Lambda

```bash
# Status geral
aws lambda get-function \
  --function-name chat-colaborativo-serverless-InterviewAIFunction \
  --region us-east-1

# Últimas invocações
aws lambda get-function-event-invoke-config \
  --function-name chat-colaborativo-serverless-InterviewAIFunction \
  --region us-east-1
```

### Ver Logs em Tempo Real

```bash
# Tail dos logs
aws logs tail /aws/lambda/chat-colaborativo-serverless-InterviewAIFunction \
  --follow \
  --region us-east-1

# Filtrar apenas erros
aws logs tail /aws/lambda/chat-colaborativo-serverless-InterviewAIFunction \
  --follow \
  --filter-pattern "[ERROR]" \
  --region us-east-1

# Filtrar sucessos
aws logs tail /aws/lambda/chat-colaborativo-serverless-InterviewAIFunction \
  --follow \
  --filter-pattern "[SUCCESS]" \
  --region us-east-1
```

### Ver Métricas CloudWatch

```bash
# Listar todas as métricas
aws cloudwatch list-metrics \
  --namespace InterviewAI \
  --region us-east-1

# Ver métrica específica (últimas 24h)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name RequestSuccess \
  --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-east-1
```

---

## 📈 MÉTRICAS PRINCIPAIS

### 1. Taxa de Sucesso

```bash
# Requests bem-sucedidos (última hora)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name RequestSuccess \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1

# Requests com erro (última hora)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name RequestError \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1
```

**Alerta:** Taxa de erro > 5%

### 2. Latência

```bash
# Latência média (última hora)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name ActionLatency \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum \
  --region us-east-1

# Latência do Bedrock (última hora)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name BedrockLatency \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum \
  --region us-east-1
```

**Alerta:** Latência média > 5000ms

### 3. Rate Limiting

```bash
# Rate limit hits (última hora)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name RateLimitExceeded \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1
```

**Alerta:** Rate limit hits > 10/hora (pode indicar abuso)

### 4. Custos

```bash
# Tokens de entrada (último dia)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name InputTokens \
  --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-east-1

# Tokens de saída (último dia)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name OutputTokens \
  --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-east-1

# Custo estimado (último dia)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name EstimatedCost \
  --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-east-1
```

**Alerta:** Custo diário > $10

### 5. Erros do Bedrock

```bash
# Erros do Bedrock (última hora)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name BedrockError \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1

# Retries (última hora)
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name BedrockRetry \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1
```

**Alerta:** Erros Bedrock > 5/hora

---

## 🚨 ALERTAS RECOMENDADOS

### Criar Alarme de Taxa de Erro

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name InterviewAI-HighErrorRate \
  --alarm-description "Taxa de erro > 5%" \
  --metric-name RequestError \
  --namespace InterviewAI \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --region us-east-1
```

### Criar Alarme de Latência

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name InterviewAI-HighLatency \
  --alarm-description "Latência média > 5s" \
  --metric-name ActionLatency \
  --namespace InterviewAI \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5000 \
  --comparison-operator GreaterThanThreshold \
  --region us-east-1
```

### Criar Alarme de Custo

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name InterviewAI-HighCost \
  --alarm-description "Custo diário > $10" \
  --metric-name EstimatedCost \
  --namespace InterviewAI \
  --statistic Sum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --region us-east-1
```

---

## 📊 DASHBOARD CLOUDWATCH

### Criar Dashboard

```bash
# Criar dashboard JSON
cat > dashboard.json << 'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["InterviewAI", "RequestSuccess", {"stat": "Sum"}],
          [".", "RequestError", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Requests (Success vs Error)",
        "yAxis": {"left": {"min": 0}}
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["InterviewAI", "ActionLatency", {"stat": "Average"}],
          ["...", {"stat": "Maximum"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Latência (ms)",
        "yAxis": {"left": {"min": 0}}
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["InterviewAI", "InputTokens", {"stat": "Sum"}],
          [".", "OutputTokens", {"stat": "Sum"}]
        ],
        "period": 3600,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Tokens (Input vs Output)",
        "yAxis": {"left": {"min": 0}}
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["InterviewAI", "EstimatedCost", {"stat": "Sum"}]
        ],
        "period": 3600,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Custo Estimado ($)",
        "yAxis": {"left": {"min": 0}}
      }
    }
  ]
}
EOF

# Criar dashboard
aws cloudwatch put-dashboard \
  --dashboard-name InterviewAI-Production \
  --dashboard-body file://dashboard.json \
  --region us-east-1
```

**Acessar:** https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=InterviewAI-Production

---

## 🔍 TROUBLESHOOTING

### Problema: Alta taxa de erro

```bash
# 1. Ver logs de erro
aws logs filter-log-events \
  --log-group-name /aws/lambda/chat-colaborativo-serverless-InterviewAIFunction \
  --filter-pattern "[ERROR]" \
  --start-time $(date -u -v-1H +%s)000 \
  --region us-east-1

# 2. Verificar erros de validação
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name ValidationError \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1

# 3. Verificar erros do Bedrock
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name BedrockError \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1
```

### Problema: Alta latência

```bash
# 1. Verificar latência do Bedrock
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name BedrockLatency \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum \
  --region us-east-1

# 2. Verificar prompts grandes
aws logs filter-log-events \
  --log-group-name /aws/lambda/chat-colaborativo-serverless-InterviewAIFunction \
  --filter-pattern "[WARNING] Prompt muito grande" \
  --start-time $(date -u -v-1H +%s)000 \
  --region us-east-1

# 3. Verificar retries
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name BedrockRetry \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1
```

### Problema: Custo alto

```bash
# 1. Ver tokens consumidos
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name InputTokens \
  --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-east-1

# 2. Verificar prompts grandes
aws cloudwatch get-metric-statistics \
  --namespace InterviewAI \
  --metric-name LargePrompt \
  --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-east-1

# 3. Ver distribuição por action
for action in generateInitialQuestions generateFollowUp evaluateAnswer generateNewQuestions generateReport; do
  echo "=== $action ==="
  aws cloudwatch get-metric-statistics \
    --namespace InterviewAI \
    --metric-name "Action_$action" \
    --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Sum \
    --region us-east-1
done
```

---

## 📱 TESTE RÁPIDO

### Testar Lambda Diretamente

```bash
# Criar payload de teste
cat > test-payload.json << 'EOF'
{
  "body": "{\"action\":\"generateInitialQuestions\",\"context\":{\"meetingType\":\"ENTREVISTA\",\"topic\":\"Desenvolvedor Full Stack\",\"jobDescription\":\"React, Node.js, TypeScript\"},\"count\":3}",
  "requestContext": {
    "identity": {
      "sourceIp": "127.0.0.1"
    }
  }
}
EOF

# Invocar Lambda
aws lambda invoke \
  --function-name chat-colaborativo-serverless-InterviewAIFunction \
  --payload file://test-payload.json \
  --region us-east-1 \
  response.json

# Ver resposta
cat response.json | jq .
```

### Testar via API Gateway

```bash
# Testar endpoint
curl -X POST https://whcl2hzfj9.execute-api.us-east-1.amazonaws.com/prod/interview/ai \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generateInitialQuestions",
    "context": {
      "meetingType": "ENTREVISTA",
      "topic": "Desenvolvedor Full Stack",
      "jobDescription": "React, Node.js, TypeScript"
    },
    "count": 3
  }' | jq .
```

---

## 📋 CHECKLIST DIÁRIO

- [ ] Verificar taxa de erro (deve ser < 5%)
- [ ] Verificar latência média (deve ser < 3s)
- [ ] Verificar custo diário (deve ser < $10)
- [ ] Verificar rate limit hits (deve ser < 10)
- [ ] Verificar logs de erro
- [ ] Verificar métricas do Bedrock

---

## 🔗 LINKS ÚTEIS

- **CloudWatch Logs:** https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fchat-colaborativo-serverless-InterviewAIFunction
- **CloudWatch Metrics:** https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2:graph=~();namespace=InterviewAI
- **Lambda Console:** https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/chat-colaborativo-serverless-InterviewAIFunction
- **API Gateway:** https://console.aws.amazon.com/apigateway/home?region=us-east-1#/apis/whcl2hzfj9

---

## 📞 SUPORTE

Em caso de problemas críticos:
1. Verificar logs em tempo real
2. Verificar métricas CloudWatch
3. Verificar status do Bedrock
4. Rollback se necessário: `sam deploy --stack-name chat-colaborativo-interview-ai --region us-east-1`

---

**Última atualização:** 08/01/2026  
**Versão:** 5.0.0 - Nível Militar
