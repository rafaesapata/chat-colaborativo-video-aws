#!/bin/bash

set -e

echo "🚀 Iniciando deployment da aplicação..."

# Variáveis
STACK_NAME="chat-colaborativo-serverless"
REGION="us-east-1"

# 1. Instalar dependências das Lambdas
echo "📦 Instalando dependências das Lambdas..."
for dir in backend/lambdas/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "  - $(basename $dir)"
    cd "$dir"
    npm install --production
    cd - > /dev/null
  fi
done

# 2. Build do SAM
echo "🔨 Building SAM application..."
sam build --template infrastructure/template.yaml

# 3. Deploy do SAM
echo "☁️  Deploying to AWS..."
sam deploy \
  --stack-name $STACK_NAME \
  --region $REGION \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

# 4. Obter outputs
echo "📋 Obtendo outputs do CloudFormation..."
WEBSOCKET_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

# 5. Criar arquivo .env para o frontend
echo "📝 Criando arquivo .env para o frontend..."
cat > frontend/.env << EOF
REACT_APP_WEBSOCKET_URL=$WEBSOCKET_URL
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_REGION=$REGION
EOF

echo "✅ Deployment concluído com sucesso!"
echo ""
echo "📊 Informações do deployment:"
echo "  WebSocket URL: $WEBSOCKET_URL"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $USER_POOL_CLIENT_ID"
echo ""
echo "🌐 Para fazer deploy do frontend:"
echo "  cd frontend && npm install && npm run build"
