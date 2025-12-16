# ⚡ COMANDOS RÁPIDOS

## Deploy e Gerenciamento da Aplicação

---

## 🚀 DEPLOY

### Deploy Completo (Automático)
```bash
./scripts/deploy-complete.sh
```

### Deploy Manual
```bash
# 1. Build
sam build --template infrastructure/complete-stack.yaml

# 2. Deploy
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

---

## 📋 CERTIFICADO SSL

### Criar Certificado
```bash
aws acm request-certificate \
  --domain-name "*.ai.udstec.io" \
  --subject-alternative-names "ai.udstec.io" \
  --validation-method DNS \
  --region us-east-1
```

### Listar Certificados
```bash
aws acm list-certificates --region us-east-1
```

### Ver Status
```bash
aws acm describe-certificate \
  --certificate-arn SEU_CERT_ARN \
  --region us-east-1
```

---

## 🌐 ROUTE53

### Listar Hosted Zones
```bash
aws route53 list-hosted-zones
```

### Obter Hosted Zone ID
```bash
aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='ai.udstec.io.'].Id" \
  --output text
```

### Listar Records
```bash
aws route53 list-resource-record-sets \
  --hosted-zone-id SEU_HOSTED_ZONE_ID
```

---

## 📊 CLOUDFORMATION

### Ver Status da Stack
```bash
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].StackStatus'
```

### Ver Outputs
```bash
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs'
```

### Ver Eventos
```bash
aws cloudformation describe-stack-events \
  --stack-name chat-colaborativo-prod \
  --max-items 20
```

### Deletar Stack
```bash
aws cloudformation delete-stack \
  --stack-name chat-colaborativo-prod
```

---

## 📦 S3

### Listar Buckets
```bash
aws s3 ls | grep chat-colaborativo
```

### Upload Frontend
```bash
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

aws s3 sync frontend/dist/ s3://$BUCKET --delete
```

### Esvaziar Bucket
```bash
aws s3 rm s3://BUCKET_NAME --recursive
```

---

## ☁️ CLOUDFRONT

### Obter Distribution ID
```bash
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text
```

### Invalidar Cache
```bash
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

### Ver Status da Invalidação
```bash
aws cloudfront list-invalidations \
  --distribution-id $DIST_ID
```

---

## 🔐 COGNITO

### Obter User Pool ID
```bash
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text
```

### Criar Usuário
```bash
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username usuario@exemplo.com \
  --user-attributes \
    Name=email,Value=usuario@exemplo.com \
    Name=name,Value="Nome Usuario" \
  --temporary-password "Senha123!" \
  --region us-east-1
```

### Listar Usuários
```bash
aws cognito-idp list-users \
  --user-pool-id $USER_POOL_ID \
  --region us-east-1
```

### Deletar Usuário
```bash
aws cognito-idp admin-delete-user \
  --user-pool-id $USER_POOL_ID \
  --username usuario@exemplo.com \
  --region us-east-1
```

---

## 🔧 LAMBDA

### Listar Funções
```bash
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `chat-colaborativo`)].FunctionName'
```

### Ver Logs
```bash
# Todas as Lambdas
sam logs --stack-name chat-colaborativo-prod --tail

# Lambda específica
aws logs tail /aws/lambda/chat-colaborativo-prod-connection-handler --follow
```

### Invocar Lambda
```bash
aws lambda invoke \
  --function-name chat-colaborativo-prod-connection-handler \
  --payload '{"test": true}' \
  response.json
```

---

## 📊 DYNAMODB

### Listar Tabelas
```bash
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `chat-colaborativo`)]'
```

### Descrever Tabela
```bash
aws dynamodb describe-table \
  --table-name chat-colaborativo-prod-Users
```

### Scan Tabela (cuidado em produção!)
```bash
aws dynamodb scan \
  --table-name chat-colaborativo-prod-Users \
  --max-items 10
```

---

## 🧪 TESTES

### Testar DNS
```bash
dig livechat.ai.udstec.io
nslookup livechat.ai.udstec.io
host livechat.ai.udstec.io
```

### Testar HTTPS
```bash
curl -I https://livechat.ai.udstec.io
```

### Testar WebSocket
```bash
# Instalar wscat
npm install -g wscat

# Conectar
WEBSOCKET_URL=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' \
  --output text)

wscat -c "$WEBSOCKET_URL?userId=test&roomId=room1"

# Enviar mensagem
{"action":"sendMessage","roomId":"room1","userId":"test","content":"Olá!","userName":"Teste"}
```

### Testar com Script
```bash
node test-connection.js
```

---

## 🔍 MONITORAMENTO

### Ver Métricas Lambda
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=chat-colaborativo-prod-connection-handler \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Ver Logs CloudWatch
```bash
aws logs tail /aws/lambda/chat-colaborativo-prod-connection-handler \
  --follow \
  --format short
```

### Criar Alarme
```bash
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

## 🔄 ATUALIZAÇÃO

### Atualizar Backend
```bash
# 1. Fazer alterações no código
# 2. Rebuild
sam build --template infrastructure/complete-stack.yaml

# 3. Redeploy
sam deploy --stack-name chat-colaborativo-prod --no-confirm-changeset
```

### Atualizar Frontend
```bash
# 1. Build
cd frontend
npm run build
cd ..

# 2. Upload
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

aws s3 sync frontend/dist/ s3://$BUCKET --delete

# 3. Invalidar cache
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

---

## 🗑️ LIMPEZA

### Deletar Tudo
```bash
# 1. Esvaziar buckets
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

# 2. Deletar stack
aws cloudformation delete-stack \
  --stack-name chat-colaborativo-prod \
  --region us-east-1

# 3. Aguardar conclusão
aws cloudformation wait stack-delete-complete \
  --stack-name chat-colaborativo-prod \
  --region us-east-1

# 4. Deletar certificado (opcional)
aws acm delete-certificate \
  --certificate-arn SEU_CERT_ARN \
  --region us-east-1
```

---

## 🤖 BEDROCK

### Listar Modelos
```bash
aws bedrock list-foundation-models --region us-east-1
```

### Verificar Claude
```bash
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query "modelSummaries[?contains(modelId, 'claude')]"
```

### Invocar Bedrock
```bash
aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-sonnet-20240229-v1:0 \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Olá!"}]}' \
  --region us-east-1 \
  output.json
```

---

## 📱 FRONTEND LOCAL

### Desenvolvimento
```bash
cd frontend
npm run dev
# Acesse: http://localhost:3000
```

### Build
```bash
cd frontend
npm run build
# Output: frontend/dist/
```

### Preview
```bash
cd frontend
npm run preview
# Acesse: http://localhost:4173
```

---

## 🔑 VARIÁVEIS DE AMBIENTE

### Obter Todas
```bash
WEBSOCKET_URL=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

echo "VITE_WEBSOCKET_URL=$WEBSOCKET_URL"
echo "VITE_USER_POOL_ID=$USER_POOL_ID"
echo "VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID"
echo "VITE_REGION=us-east-1"
```

### Criar .env
```bash
cat > frontend/.env << EOF
VITE_WEBSOCKET_URL=$WEBSOCKET_URL
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_REGION=us-east-1
EOF
```

---

## 📊 STATUS RÁPIDO

### Ver Tudo de Uma Vez
```bash
echo "=== STACK STATUS ==="
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].StackStatus'

echo -e "\n=== OUTPUTS ==="
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table

echo -e "\n=== LAMBDAS ==="
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `chat-colaborativo-prod`)].FunctionName' \
  --output table

echo -e "\n=== DYNAMODB TABLES ==="
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `chat-colaborativo-prod`)]' \
  --output table
```

---

## 🎯 COMANDOS MAIS USADOS

```bash
# Deploy completo
./scripts/deploy-complete.sh

# Ver outputs
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs'

# Ver logs
sam logs --stack-name chat-colaborativo-prod --tail

# Atualizar frontend
cd frontend && npm run build && cd .. && \
aws s3 sync frontend/dist/ s3://$(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text) --delete

# Invalidar CloudFront
aws cloudfront create-invalidation \
  --distribution-id $(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text) \
  --paths "/*"

# Testar WebSocket
node test-connection.js

# Criar usuário
aws cognito-idp admin-create-user \
  --user-pool-id $(aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text) \
  --username teste@exemplo.com \
  --user-attributes Name=email,Value=teste@exemplo.com Name=name,Value="Teste" \
  --temporary-password "Teste123!"
```

---

*Comandos prontos para copiar e colar*
*Substitua valores conforme necessário*
