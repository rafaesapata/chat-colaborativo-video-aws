#!/bin/bash

set -e

echo "🚀 Deploy Completo - Chat Colaborativo com Domínio Customizado"
echo "=============================================================="

# Variáveis
STACK_NAME="chat-colaborativo-prod"
REGION="us-east-1"
DOMAIN_NAME="livechat.ai.udstec.io"
PARENT_DOMAIN="ai.udstec.io"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}📋 Passo 1: Verificando pré-requisitos...${NC}"

# Verificar AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI não encontrado. Instale: https://aws.amazon.com/cli/${NC}"
    exit 1
fi

# Verificar SAM CLI
if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ SAM CLI não encontrado. Instale: brew install aws-sam-cli${NC}"
    exit 1
fi

# Verificar credenciais AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Credenciais AWS não configuradas. Execute: aws configure${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pré-requisitos OK${NC}"

echo ""
echo -e "${BLUE}📋 Passo 2: Verificando/Criando Certificado SSL...${NC}"

# Verificar se já existe certificado para *.ai.udstec.io
CERT_ARN=$(aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='*.ai.udstec.io'].CertificateArn" \
  --output text 2>/dev/null || echo "")

if [ -z "$CERT_ARN" ]; then
    echo -e "${YELLOW}⚠️  Certificado não encontrado. Criando...${NC}"
    
    # Solicitar certificado
    CERT_ARN=$(aws acm request-certificate \
      --domain-name "*.ai.udstec.io" \
      --subject-alternative-names "ai.udstec.io" \
      --validation-method DNS \
      --region us-east-1 \
      --query 'CertificateArn' \
      --output text)
    
    echo -e "${GREEN}✅ Certificado solicitado: $CERT_ARN${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANTE: Você precisa validar o certificado!${NC}"
    echo ""
    echo "1. Acesse: https://console.aws.amazon.com/acm/home?region=us-east-1"
    echo "2. Clique no certificado criado"
    echo "3. Copie os registros CNAME de validação"
    echo "4. Adicione-os no Route53 (Hosted Zone: $PARENT_DOMAIN)"
    echo ""
    echo "Aguardando validação do certificado..."
    
    # Aguardar validação (timeout 10 minutos)
    aws acm wait certificate-validated \
      --certificate-arn "$CERT_ARN" \
      --region us-east-1 \
      --cli-read-timeout 600 || {
        echo -e "${RED}❌ Timeout na validação. Valide manualmente e execute novamente.${NC}"
        exit 1
      }
    
    echo -e "${GREEN}✅ Certificado validado!${NC}"
else
    echo -e "${GREEN}✅ Certificado encontrado: $CERT_ARN${NC}"
fi

echo ""
echo -e "${BLUE}📋 Passo 3: Verificando Hosted Zone do Route53...${NC}"

# Buscar Hosted Zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='${PARENT_DOMAIN}.'].Id" \
  --output text | cut -d'/' -f3)

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo -e "${RED}❌ Hosted Zone não encontrada para $PARENT_DOMAIN${NC}"
    echo "Crie uma Hosted Zone no Route53 primeiro."
    exit 1
fi

echo -e "${GREEN}✅ Hosted Zone encontrada: $HOSTED_ZONE_ID${NC}"

echo ""
echo -e "${BLUE}📋 Passo 4: Instalando dependências das Lambdas...${NC}"

for dir in backend/lambdas/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "  - $(basename $dir)"
    (cd "$dir" && npm install --production --silent)
  fi
done

echo -e "${GREEN}✅ Dependências instaladas${NC}"

echo ""
echo -e "${BLUE}📋 Passo 5: Building SAM application...${NC}"

sam build --template infrastructure/complete-stack.yaml

echo -e "${GREEN}✅ Build concluído${NC}"

echo ""
echo -e "${BLUE}📋 Passo 6: Deploying para AWS...${NC}"

sam deploy \
  --stack-name $STACK_NAME \
  --region $REGION \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --resolve-s3 \
  --parameter-overrides \
    DomainName=$DOMAIN_NAME \
    HostedZoneId=$HOSTED_ZONE_ID \
    CertificateArn=$CERT_ARN \
    Stage=prod

echo -e "${GREEN}✅ Deploy concluído!${NC}"

echo ""
echo -e "${BLUE}📋 Passo 7: Obtendo outputs...${NC}"

# Obter outputs
WEBSOCKET_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' \
  --output text)

FRONTEND_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendURL`].OutputValue' \
  --output text)

CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
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

echo ""
echo -e "${BLUE}📋 Passo 8: Atualizando .env do frontend...${NC}"

cat > frontend/.env << EOF
VITE_WEBSOCKET_URL=$WEBSOCKET_URL
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_REGION=$REGION
EOF

echo -e "${GREEN}✅ .env atualizado${NC}"

echo ""
echo -e "${BLUE}📋 Passo 9: Building frontend...${NC}"

cd frontend
npm run build
cd ..

echo -e "${GREEN}✅ Frontend compilado${NC}"

echo ""
echo -e "${BLUE}📋 Passo 10: Fazendo upload do frontend para S3...${NC}"

aws s3 sync frontend/dist/ s3://$FRONTEND_BUCKET --delete

echo -e "${GREEN}✅ Frontend enviado para S3${NC}"

echo ""
echo -e "${BLUE}📋 Passo 11: Invalidando cache do CloudFront...${NC}"

aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*" > /dev/null

echo -e "${GREEN}✅ Cache invalidado${NC}"

echo ""
echo "=============================================================="
echo -e "${GREEN}🎉 DEPLOY COMPLETO COM SUCESSO!${NC}"
echo "=============================================================="
echo ""
echo -e "${BLUE}📊 Informações do Deployment:${NC}"
echo ""
echo -e "🌐 Frontend URL:     ${GREEN}$FRONTEND_URL${NC}"
echo -e "🔌 WebSocket URL:    ${GREEN}$WEBSOCKET_URL${NC}"
echo -e "👤 User Pool ID:     ${GREEN}$USER_POOL_ID${NC}"
echo -e "🔑 Client ID:        ${GREEN}$USER_POOL_CLIENT_ID${NC}"
echo -e "☁️  CloudFront ID:    ${GREEN}$CLOUDFRONT_ID${NC}"
echo -e "📦 Frontend Bucket:  ${GREEN}$FRONTEND_BUCKET${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "1. Habilite Amazon Bedrock (Claude 3 Sonnet) em us-east-1"
echo "2. Aguarde ~5-10 minutos para propagação do CloudFront"
echo "3. Acesse: $FRONTEND_URL"
echo ""
echo -e "${BLUE}📚 Próximos passos:${NC}"
echo "- Criar usuários no Cognito"
echo "- Testar a aplicação"
echo "- Configurar alarmes no CloudWatch"
echo ""
echo -e "${GREEN}✅ Tudo pronto para uso!${NC}"
