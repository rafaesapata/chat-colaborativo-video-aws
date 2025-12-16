# 🌐 Deploy com Domínio Customizado

## Guia Completo para Deploy em livechat.ai.udstec.io

---

## 📋 Pré-requisitos

### 1. Domínio e DNS
- ✅ Domínio: `ai.udstec.io` registrado
- ✅ Hosted Zone no Route53 para `ai.udstec.io`
- ✅ Subdomínio: `livechat.ai.udstec.io` será criado automaticamente

### 2. Ferramentas
- ✅ AWS CLI configurado
- ✅ SAM CLI instalado
- ✅ Node.js 18.x
- ✅ Permissões AWS adequadas

---

## 🚀 Deploy Automático (Recomendado)

### Opção 1: Script Completo

```bash
./scripts/deploy-complete.sh
```

Este script faz TUDO automaticamente:
1. ✅ Verifica pré-requisitos
2. ✅ Cria/valida certificado SSL
3. ✅ Verifica Hosted Zone
4. ✅ Instala dependências
5. ✅ Build do SAM
6. ✅ Deploy da infraestrutura
7. ✅ Build do frontend
8. ✅ Upload para S3
9. ✅ Invalida cache CloudFront
10. ✅ Configura DNS no Route53

**Tempo estimado: 10-15 minutos**

---

## 🔧 Deploy Manual (Passo a Passo)

### Passo 1: Criar Certificado SSL

```bash
# Solicitar certificado para *.ai.udstec.io
aws acm request-certificate \
  --domain-name "*.ai.udstec.io" \
  --subject-alternative-names "ai.udstec.io" \
  --validation-method DNS \
  --region us-east-1

# Anotar o ARN retornado
```

**Validar Certificado:**
1. Acesse: https://console.aws.amazon.com/acm/home?region=us-east-1
2. Clique no certificado criado
3. Copie os registros CNAME de validação
4. Adicione no Route53 (Hosted Zone: ai.udstec.io)
5. Aguarde validação (~5 minutos)

### Passo 2: Obter Hosted Zone ID

```bash
# Buscar ID da Hosted Zone
aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='ai.udstec.io.'].Id" \
  --output text

# Anotar o ID (formato: /hostedzone/Z1234567890ABC)
```

### Passo 3: Instalar Dependências

```bash
# Instalar dependências das Lambdas
for dir in backend/lambdas/*/; do
  (cd "$dir" && npm install --production)
done
```

### Passo 4: Build SAM

```bash
sam build --template infrastructure/complete-stack.yaml
```

### Passo 5: Deploy

```bash
sam deploy \
  --stack-name chat-colaborativo-prod \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --parameter-overrides \
    DomainName=livechat.ai.udstec.io \
    HostedZoneId=Z1234567890ABC \
    CertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/abc-123 \
    Stage=prod
```

**Substitua:**
- `Z1234567890ABC` pelo ID da sua Hosted Zone
- `arn:aws:acm:...` pelo ARN do seu certificado

### Passo 6: Obter Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --region us-east-1 \
  --query 'Stacks[0].Outputs'
```

Anote:
- `WebSocketURL`
- `FrontendBucketName`
- `CloudFrontDistributionId`
- `UserPoolId`
- `UserPoolClientId`

### Passo 7: Configurar Frontend

```bash
# Criar .env
cat > frontend/.env << EOF
VITE_WEBSOCKET_URL=wss://xxxxx.execute-api.us-east-1.amazonaws.com/prod
VITE_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_REGION=us-east-1
EOF

# Build
cd frontend
npm run build
cd ..
```

### Passo 8: Upload Frontend

```bash
# Fazer upload para S3
aws s3 sync frontend/dist/ s3://FRONTEND_BUCKET_NAME --delete

# Invalidar cache CloudFront
aws cloudfront create-invalidation \
  --distribution-id CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"
```

---

## 🎯 Arquitetura Deployada

```
┌─────────────────────────────────────────────────┐
│  livechat.ai.udstec.io (Route53)                │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  CloudFront Distribution                        │
│  - SSL/TLS (ACM Certificate)                    │
│  - Cache otimizado                              │
│  - Compressão Gzip                              │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  S3 Bucket (Frontend)                           │
│  - React App (SPA)                              │
│  - Static Assets                                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  API Gateway WebSocket                          │
│  wss://xxxxx.execute-api.us-east-1.amazonaws... │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Lambda Functions (6)                           │
│  - connection-handler                           │
│  - message-handler                              │
│  - audio-stream-processor                       │
│  - transcription-aggregator                     │
│  - ai-analysis                                  │
│  - room-manager                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  DynamoDB Tables (5)                            │
│  Users, ChatRooms, Messages,                    │
│  Transcriptions, Connections                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Outros Serviços                                │
│  - S3 (áudio)                                   │
│  - Cognito (auth)                               │
│  - Transcribe (transcrição)                     │
│  - Bedrock (IA)                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔐 Segurança

### SSL/TLS
- ✅ Certificado ACM para `*.ai.udstec.io`
- ✅ TLS 1.2+ obrigatório
- ✅ HTTPS redirect automático

### CloudFront
- ✅ Origin Access Control (OAC)
- ✅ S3 bucket privado
- ✅ Compressão habilitada

### Cognito
- ✅ Autenticação JWT
- ✅ Senha forte obrigatória
- ✅ Email verificado

### IAM
- ✅ Least privilege
- ✅ Roles específicas por Lambda
- ✅ Políticas granulares

---

## 📊 Monitoramento

### CloudWatch Logs
```bash
# Ver logs em tempo real
sam logs --stack-name chat-colaborativo-prod --tail

# Lambda específica
aws logs tail /aws/lambda/chat-colaborativo-prod-connection-handler --follow
```

### CloudWatch Metrics
- Lambda Invocations
- Lambda Errors
- Lambda Duration
- API Gateway Connections
- CloudFront Requests
- CloudFront Cache Hit Rate

### Alarmes Recomendados
```bash
# Criar alarme para erros Lambda
aws cloudwatch put-metric-alarm \
  --alarm-name chat-lambda-errors \
  --alarm-description "Lambda errors > 1%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

---

## 🧪 Testes

### Testar WebSocket
```bash
wscat -c "wss://xxxxx.execute-api.us-east-1.amazonaws.com/prod?userId=test&roomId=room1"

# Enviar mensagem
{"action":"sendMessage","roomId":"room1","userId":"test","content":"Olá!","userName":"Teste"}
```

### Testar Frontend
```bash
# Abrir no navegador
open https://livechat.ai.udstec.io
```

### Testar CloudFront
```bash
curl -I https://livechat.ai.udstec.io
# Verificar headers:
# - x-cache: Hit from cloudfront (após primeira requisição)
# - content-encoding: gzip
```

---

## 🔄 Atualizações

### Atualizar Backend
```bash
# Fazer alterações no código
# Rebuild e redeploy
sam build --template infrastructure/complete-stack.yaml
sam deploy --stack-name chat-colaborativo-prod --no-confirm-changeset
```

### Atualizar Frontend
```bash
# Build
cd frontend
npm run build

# Upload
aws s3 sync dist/ s3://FRONTEND_BUCKET_NAME --delete

# Invalidar cache
aws cloudfront create-invalidation \
  --distribution-id CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"
```

---

## 💰 Custos Estimados

### Infraestrutura Base
| Serviço | Custo Mensal |
|---------|--------------|
| CloudFront | $1-5 (depende do tráfego) |
| S3 (Frontend) | $0.50 |
| Route53 | $0.50 |
| ACM Certificate | Grátis |

### Backend (5 usuários, 8h/dia)
| Serviço | Custo Mensal |
|---------|--------------|
| API Gateway WebSocket | $5 |
| Lambda | $10 |
| DynamoDB | $5 |
| Transcribe | $30 |
| Bedrock | $20 |
| S3 (Áudio) | $2 |

**Total: ~$74-78/mês**

---

## 🗑️ Limpeza

### Deletar Stack Completa
```bash
# Esvaziar buckets S3 primeiro
aws s3 rm s3://FRONTEND_BUCKET_NAME --recursive
aws s3 rm s3://AUDIO_BUCKET_NAME --recursive

# Deletar stack
aws cloudformation delete-stack \
  --stack-name chat-colaborativo-prod \
  --region us-east-1

# Deletar certificado (opcional)
aws acm delete-certificate \
  --certificate-arn CERTIFICATE_ARN \
  --region us-east-1
```

---

## 🆘 Troubleshooting

### Certificado não valida
```bash
# Verificar status
aws acm describe-certificate \
  --certificate-arn CERTIFICATE_ARN \
  --region us-east-1

# Verificar registros DNS
aws route53 list-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID
```

### CloudFront não atualiza
```bash
# Forçar invalidação
aws cloudfront create-invalidation \
  --distribution-id CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"

# Aguardar ~5 minutos
```

### DNS não resolve
```bash
# Verificar propagação
dig livechat.ai.udstec.io

# Verificar Route53
aws route53 list-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --query "ResourceRecordSets[?Name=='livechat.ai.udstec.io.']"
```

---

## ✅ Checklist Final

Antes de considerar o deploy completo:

- [ ] Certificado SSL validado
- [ ] Stack CloudFormation: CREATE_COMPLETE
- [ ] Frontend no S3
- [ ] CloudFront distribuído
- [ ] DNS no Route53 configurado
- [ ] WebSocket funcionando
- [ ] Frontend acessível via HTTPS
- [ ] Cognito configurado
- [ ] Bedrock habilitado
- [ ] Alarmes configurados
- [ ] Testes realizados

---

## 🎉 Sucesso!

Após o deploy completo, sua aplicação estará disponível em:

**https://livechat.ai.udstec.io**

Com:
- ✅ SSL/TLS automático
- ✅ CDN global (CloudFront)
- ✅ Alta disponibilidade
- ✅ Escalabilidade automática
- ✅ Monitoramento completo

**Pronto para produção!** 🚀
