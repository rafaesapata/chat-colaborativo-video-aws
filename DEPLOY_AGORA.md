# 🚀 DEPLOY COM DOMÍNIO - EXECUTE AGORA

## ⚡ Deploy Automático em livechat.ai.udstec.io

---

## 🎯 Opção 1: Deploy Automático (RECOMENDADO)

### Um único comando faz TUDO:

```bash
./scripts/deploy-complete.sh
```

**O script faz automaticamente:**
1. ✅ Verifica pré-requisitos (AWS CLI, SAM CLI)
2. ✅ Cria/valida certificado SSL para *.ai.udstec.io
3. ✅ Verifica Hosted Zone do Route53
4. ✅ Instala dependências das Lambdas
5. ✅ Build do SAM
6. ✅ Deploy da infraestrutura completa
7. ✅ Build do frontend React
8. ✅ Upload para S3
9. ✅ Invalida cache CloudFront
10. ✅ Configura DNS no Route53

**Tempo: 10-15 minutos**

---

## 📋 Pré-requisitos

### Você precisa ter:

1. **Domínio ai.udstec.io no Route53**
   - Hosted Zone criada
   - NS records configurados

2. **AWS CLI configurado**
   ```bash
   aws configure
   # Já está configurado ✅
   ```

3. **Permissões AWS**
   - CloudFormation
   - Lambda
   - API Gateway
   - S3
   - CloudFront
   - Route53
   - ACM (Certificate Manager)
   - Cognito
   - DynamoDB

---

## 🔧 Opção 2: Deploy Manual

### Se preferir fazer passo a passo:

#### 1. Criar Certificado SSL

```bash
# Solicitar certificado
aws acm request-certificate \
  --domain-name "*.ai.udstec.io" \
  --subject-alternative-names "ai.udstec.io" \
  --validation-method DNS \
  --region us-east-1
```

**Validar:**
1. Acesse: https://console.aws.amazon.com/acm/home?region=us-east-1
2. Copie registros CNAME de validação
3. Adicione no Route53 (Hosted Zone: ai.udstec.io)
4. Aguarde ~5 minutos

#### 2. Obter IDs Necessários

```bash
# Hosted Zone ID
aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='ai.udstec.io.'].Id" \
  --output text

# Certificate ARN (após validação)
aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='*.ai.udstec.io'].CertificateArn" \
  --output text
```

#### 3. Deploy

```bash
# Build
sam build --template infrastructure/complete-stack.yaml

# Deploy
sam deploy \
  --stack-name chat-colaborativo-prod \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --parameter-overrides \
    DomainName=livechat.ai.udstec.io \
    HostedZoneId=SEU_HOSTED_ZONE_ID \
    CertificateArn=SEU_CERTIFICATE_ARN \
    Stage=prod
```

#### 4. Deploy Frontend

```bash
# Obter bucket name
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

# Build e upload
cd frontend
npm run build
aws s3 sync dist/ s3://$BUCKET --delete

# Invalidar CloudFront
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

---

## 🌐 Arquitetura Deployada

```
Internet
   │
   ▼
Route53 (livechat.ai.udstec.io)
   │
   ▼
CloudFront (CDN Global)
   │
   ├─► S3 Bucket (Frontend React)
   │
   └─► API Gateway WebSocket
        │
        ▼
     Lambda Functions (6)
        │
        ├─► DynamoDB (5 tabelas)
        ├─► S3 (áudio)
        ├─► Transcribe (transcrição)
        ├─► Bedrock (IA)
        └─► Cognito (auth)
```

---

## ✅ Recursos Criados

### Frontend
- ✅ S3 Bucket (privado)
- ✅ CloudFront Distribution
- ✅ Route53 Record (A - Alias)
- ✅ SSL Certificate (ACM)

### Backend
- ✅ 6 Lambda Functions
- ✅ 5 DynamoDB Tables
- ✅ API Gateway WebSocket
- ✅ S3 Bucket (áudio)
- ✅ Cognito User Pool
- ✅ IAM Roles (6)
- ✅ CloudWatch Logs

**Total: ~45 recursos AWS**

---

## 🧪 Após o Deploy

### 1. Aguardar Propagação
```bash
# CloudFront leva ~5-10 minutos para distribuir
# DNS pode levar até 48h (geralmente < 1h)
```

### 2. Testar DNS
```bash
dig livechat.ai.udstec.io
nslookup livechat.ai.udstec.io
```

### 3. Acessar Aplicação
```bash
open https://livechat.ai.udstec.io
```

### 4. Habilitar Bedrock
1. Acesse: https://console.aws.amazon.com/bedrock/
2. Região: us-east-1
3. Model access → Request model access
4. Selecione: Claude 3 Sonnet
5. Aguarde aprovação (~1 minuto)

### 5. Criar Usuário Teste
```bash
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username teste@exemplo.com \
  --user-attributes \
    Name=email,Value=teste@exemplo.com \
    Name=name,Value="Usuário Teste" \
  --temporary-password "Teste123!" \
  --region us-east-1
```

---

## 📊 Outputs Importantes

Após o deploy, você terá:

```bash
# Ver todos os outputs
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs'
```

**Outputs:**
- `FrontendURL`: https://livechat.ai.udstec.io
- `WebSocketURL`: wss://xxxxx.execute-api.us-east-1.amazonaws.com/prod
- `UserPoolId`: us-east-1_xxxxxxxxx
- `UserPoolClientId`: xxxxxxxxxxxxxxxxxxxxxxxxxx
- `CloudFrontDistributionId`: EXXXXXXXXXXXXX
- `FrontendBucketName`: chat-colaborativo-prod-frontend-418272799411

---

## 💰 Custos

### Infraestrutura
- CloudFront: $1-5/mês (depende do tráfego)
- S3 Frontend: $0.50/mês
- Route53: $0.50/mês
- ACM Certificate: Grátis

### Backend (5 usuários, 8h/dia)
- API Gateway: $5/mês
- Lambda: $10/mês
- DynamoDB: $5/mês
- Transcribe: $30/mês
- Bedrock: $20/mês
- S3 Áudio: $2/mês

**Total: ~$74-78/mês**

---

## 🔄 Atualizações Futuras

### Atualizar Backend
```bash
# Fazer alterações no código
sam build --template infrastructure/complete-stack.yaml
sam deploy --stack-name chat-colaborativo-prod --no-confirm-changeset
```

### Atualizar Frontend
```bash
cd frontend
npm run build

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

aws s3 sync dist/ s3://$BUCKET --delete

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

---

## 🗑️ Deletar Tudo

```bash
# Esvaziar buckets
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

AUDIO_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`AudioBucketName`].OutputValue' \
  --output text)

aws s3 rm s3://$FRONTEND_BUCKET --recursive
aws s3 rm s3://$AUDIO_BUCKET --recursive

# Deletar stack
aws cloudformation delete-stack \
  --stack-name chat-colaborativo-prod \
  --region us-east-1
```

---

## 🆘 Troubleshooting

### Certificado não valida
```bash
# Verificar status
aws acm describe-certificate \
  --certificate-arn SEU_CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.Status'

# Se "PENDING_VALIDATION", adicione registros CNAME no Route53
```

### Stack falha no deploy
```bash
# Ver eventos
aws cloudformation describe-stack-events \
  --stack-name chat-colaborativo-prod \
  --max-items 20

# Ver logs
sam logs --stack-name chat-colaborativo-prod --tail
```

### CloudFront não atualiza
```bash
# Forçar invalidação
aws cloudfront create-invalidation \
  --distribution-id SEU_DIST_ID \
  --paths "/*"

# Aguardar 5-10 minutos
```

### DNS não resolve
```bash
# Verificar registro
aws route53 list-resource-record-sets \
  --hosted-zone-id SEU_HOSTED_ZONE_ID \
  --query "ResourceRecordSets[?Name=='livechat.ai.udstec.io.']"

# Testar propagação
dig livechat.ai.udstec.io @8.8.8.8
```

---

## ✅ Checklist de Deploy

- [ ] AWS CLI configurado
- [ ] SAM CLI instalado
- [ ] Hosted Zone ai.udstec.io existe
- [ ] Certificado SSL criado e validado
- [ ] Stack deployada com sucesso
- [ ] Frontend no S3
- [ ] CloudFront distribuído
- [ ] DNS configurado
- [ ] Bedrock habilitado
- [ ] Usuário teste criado
- [ ] Aplicação acessível via HTTPS

---

## 🎉 EXECUTE AGORA!

```bash
./scripts/deploy-complete.sh
```

**Aguarde 10-15 minutos e sua aplicação estará no ar em:**

**https://livechat.ai.udstec.io** 🚀

---

*Deploy automatizado com CloudFormation + SAM*
*Infraestrutura como código*
*100% Serverless*
