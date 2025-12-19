#!/bin/bash

# Script de Deploy Seguro - Padrão Ouro
# Este script implementa as correções críticas de segurança

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
STACK_NAME=${1:-chat-colaborativo}
STAGE=${2:-prod}
REGION=${3:-us-east-1}
EMAIL=${4:-admin@example.com}

echo -e "${BLUE}🚀 Iniciando deploy seguro do Chat Colaborativo${NC}"
echo -e "${BLUE}Stack: ${STACK_NAME}${NC}"
echo -e "${BLUE}Stage: ${STAGE}${NC}"
echo -e "${BLUE}Region: ${REGION}${NC}"

# Verificar se AWS CLI está configurado
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI não está configurado. Execute 'aws configure' primeiro.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI configurado${NC}"

# Instalar dependências das lambdas
echo -e "${YELLOW}📦 Instalando dependências das lambdas...${NC}"

# Shared libraries
cd backend/shared
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ../..

# Lambda functions
for lambda_dir in backend/lambdas/*/; do
    if [ -f "${lambda_dir}package.json" ]; then
        echo -e "${BLUE}Instalando dependências em ${lambda_dir}${NC}"
        cd "${lambda_dir}"
        npm install
        cd - > /dev/null
    fi
done

echo -e "${GREEN}✅ Dependências instaladas${NC}"

# Executar testes
echo -e "${YELLOW}🧪 Executando testes...${NC}"
cd backend/lambdas/tests
if [ ! -d "node_modules" ]; then
    npm install
fi
npm test
cd ../../..

echo -e "${GREEN}✅ Testes passaram${NC}"

# Build do SAM
echo -e "${YELLOW}🔨 Fazendo build do SAM...${NC}"
sam build --template-file infrastructure/template.yaml

echo -e "${GREEN}✅ Build concluído${NC}"

# Deploy da infraestrutura principal
echo -e "${YELLOW}🚀 Fazendo deploy da infraestrutura...${NC}"
sam deploy \
    --template-file infrastructure/template.yaml \
    --stack-name "${STACK_NAME}" \
    --parameter-overrides \
        Stage="${STAGE}" \
        JWTSecret="$(openssl rand -base64 32)" \
    --capabilities CAPABILITY_IAM \
    --region "${REGION}" \
    --no-fail-on-empty-changeset

echo -e "${GREEN}✅ Infraestrutura deployada${NC}"

# Deploy do dashboard
echo -e "${YELLOW}📊 Deployando dashboard de observabilidade...${NC}"
aws cloudformation deploy \
    --template-file infrastructure/dashboard.yaml \
    --stack-name "${STACK_NAME}-dashboard" \
    --parameter-overrides \
        StackName="${STACK_NAME}" \
        Stage="${STAGE}" \
    --region "${REGION}" \
    --no-fail-on-empty-changeset

echo -e "${GREEN}✅ Dashboard deployado${NC}"

# Deploy dos alertas
echo -e "${YELLOW}🚨 Deployando alertas...${NC}"
aws cloudformation deploy \
    --template-file infrastructure/alarms.yaml \
    --stack-name "${STACK_NAME}-alarms" \
    --parameter-overrides \
        StackName="${STACK_NAME}" \
        Stage="${STAGE}" \
        AlertEmail="${EMAIL}" \
    --region "${REGION}" \
    --no-fail-on-empty-changeset

echo -e "${GREEN}✅ Alertas deployados${NC}"

# Obter outputs
echo -e "${YELLOW}📋 Obtendo informações do deploy...${NC}"

WEBSOCKET_URL=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' \
    --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)

DASHBOARD_URL="https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${STACK_NAME}-overview"

# Salvar configurações
cat > deployment-config.json << EOF
{
  "stackName": "${STACK_NAME}",
  "stage": "${STAGE}",
  "region": "${REGION}",
  "websocketUrl": "${WEBSOCKET_URL}",
  "userPoolId": "${USER_POOL_ID}",
  "userPoolClientId": "${USER_POOL_CLIENT_ID}",
  "dashboardUrl": "${DASHBOARD_URL}",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo ""
echo -e "${BLUE}📋 Informações do Deploy:${NC}"
echo -e "${BLUE}WebSocket URL: ${WEBSOCKET_URL}${NC}"
echo -e "${BLUE}User Pool ID: ${USER_POOL_ID}${NC}"
echo -e "${BLUE}User Pool Client ID: ${USER_POOL_CLIENT_ID}${NC}"
echo -e "${BLUE}Dashboard: ${DASHBOARD_URL}${NC}"
echo ""
echo -e "${YELLOW}⚠️  Próximos passos:${NC}"
echo -e "${YELLOW}1. Confirme a inscrição no email de alertas${NC}"
echo -e "${YELLOW}2. Configure o frontend com as credenciais acima${NC}"
echo -e "${YELLOW}3. Execute testes de integração${NC}"
echo -e "${YELLOW}4. Configure monitoramento adicional se necessário${NC}"
echo ""
echo -e "${GREEN}🎉 Sistema deployado com Padrão Ouro de Segurança!${NC}"