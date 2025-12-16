# Guia de Deployment

## Pré-requisitos

1. AWS CLI configurado com credenciais válidas
2. SAM CLI instalado
3. Node.js 18.x ou superior
4. Conta AWS com permissões adequadas

## Instalação do SAM CLI

```bash
# macOS
brew install aws-sam-cli

# Linux
pip install aws-sam-cli

# Verificar instalação
sam --version
```

## Passo a Passo

### 1. Configurar AWS CLI

```bash
aws configure
# AWS Access Key ID: [sua-key]
# AWS Secret Access Key: [seu-secret]
# Default region: us-east-1
# Default output format: json
```

### 2. Clonar e Preparar o Projeto

```bash
git clone <repository-url>
cd chat-colaborativo-serverless
```

### 3. Deploy da Infraestrutura

```bash
# Dar permissão de execução ao script
chmod +x scripts/deploy.sh

# Executar deployment
./scripts/deploy.sh
```

O script irá:
- Instalar dependências das Lambdas
- Build do SAM
- Deploy no CloudFormation
- Criar arquivo .env para o frontend

### 4. Habilitar Amazon Bedrock

```bash
# Acessar console AWS Bedrock
# Região: us-east-1
# Habilitar modelo: Claude 3 Sonnet
```

### 5. Deploy do Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Build de produção
npm run build

# Deploy no S3 + CloudFront (opcional)
aws s3 sync dist/ s3://seu-bucket-frontend --delete
```

## Configuração Manual (Alternativa)

### Deploy com SAM

```bash
# Build
sam build --template infrastructure/template.yaml

# Deploy interativo
sam deploy --guided

# Seguir prompts:
# Stack Name: chat-colaborativo-serverless
# AWS Region: us-east-1
# Confirm changes: Y
# Allow SAM CLI IAM role creation: Y
# Save arguments to config: Y
```

### Obter Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-serverless \
  --query 'Stacks[0].Outputs'
```

## Testes

### Testar WebSocket

```bash
# Instalar dependências
npm install ws

# Configurar URL
export WEBSOCKET_URL="wss://your-api-id.execute-api.us-east-1.amazonaws.com/prod"

# Executar teste
node scripts/test-websocket.js
```

### Testar Frontend Localmente

```bash
cd frontend
npm run dev
# Acessar http://localhost:3000
```

## Monitoramento

### CloudWatch Logs

```bash
# Ver logs de uma Lambda
aws logs tail /aws/lambda/chat-colaborativo-serverless-connection-handler --follow

# Ver logs de todas as Lambdas
sam logs --stack-name chat-colaborativo-serverless --tail
```

### Métricas

Acessar CloudWatch Console:
- Lambda invocations
- API Gateway connections
- DynamoDB read/write capacity
- Transcribe usage

## Troubleshooting

### Erro: "Unable to import module"
```bash
# Reinstalar dependências das Lambdas
cd backend/lambdas/[lambda-name]
rm -rf node_modules package-lock.json
npm install --production
```

### Erro: "Access Denied" no Bedrock
```bash
# Verificar se o modelo está habilitado
aws bedrock list-foundation-models --region us-east-1

# Adicionar permissões IAM se necessário
```

### WebSocket não conecta
```bash
# Verificar URL do WebSocket
aws cloudformation describe-stacks \
  --stack-name chat-colaborativo-serverless \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue'

# Testar conexão
wscat -c "wss://your-api-id.execute-api.us-east-1.amazonaws.com/prod?userId=test"
```

## Limpeza

```bash
# Deletar stack
aws cloudformation delete-stack --stack-name chat-colaborativo-serverless

# Deletar bucket S3 (se criado)
aws s3 rb s3://chat-colaborativo-serverless-audio-ACCOUNT_ID --force
```

## Custos

Monitorar custos no AWS Cost Explorer:
- Lambda invocations
- API Gateway requests
- DynamoDB operations
- Transcribe minutes
- Bedrock tokens
- S3 storage

Configurar alarmes de billing para evitar surpresas.
