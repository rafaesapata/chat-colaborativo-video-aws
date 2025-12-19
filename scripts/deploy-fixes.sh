#!/bin/bash

echo "🔧 Deployando correções para o problema de usuários não se encontrarem"
echo ""

# Verificar se AWS CLI está instalado
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI não encontrado. Instalando..."
    
    # Detectar sistema operacional
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            echo "📦 Instalando AWS CLI via Homebrew..."
            brew install awscli
        else
            echo "📦 Instalando AWS CLI via curl..."
            curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
            sudo installer -pkg AWSCLIV2.pkg -target /
            rm AWSCLIV2.pkg
        fi
    else
        # Linux
        echo "📦 Instalando AWS CLI via curl..."
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf awscliv2.zip aws/
    fi
fi

# Verificar se SAM CLI está instalado
if ! command -v sam &> /dev/null; then
    echo "❌ SAM CLI não encontrado. Por favor, instale o SAM CLI:"
    echo "   https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

echo "✅ Ferramentas verificadas"
echo ""

# Verificar credenciais AWS
echo "🔐 Verificando credenciais AWS..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ Credenciais AWS não configuradas ou expiradas"
    echo "Configure com: aws configure"
    echo "Ou defina as variáveis de ambiente:"
    echo "  export AWS_ACCESS_KEY_ID=..."
    echo "  export AWS_SECRET_ACCESS_KEY=..."
    exit 1
fi

echo "✅ Credenciais AWS válidas"
echo ""

# Verificar stack atual
echo "📊 Verificando stack atual..."
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name chat-colaborativo-prod \
    --region us-east-1 \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
    echo "⚠️  Stack chat-colaborativo-prod não encontrada"
    echo "Verificando stack alternativa..."
    
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name chat-colaborativo-serverless \
        --region us-east-1 \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
        echo "❌ Nenhuma stack encontrada. Execute primeiro o deploy inicial."
        exit 1
    else
        STACK_NAME="chat-colaborativo-serverless"
        echo "✅ Stack encontrada: $STACK_NAME (Status: $STACK_STATUS)"
    fi
else
    STACK_NAME="chat-colaborativo-prod"
    echo "✅ Stack encontrada: $STACK_NAME (Status: $STACK_STATUS)"
fi

echo ""

# Instalar dependências das Lambdas
echo "📦 Instalando dependências das Lambdas..."
for dir in backend/lambdas/*/; do
    if [ -f "$dir/package.json" ]; then
        echo "  📁 $(basename "$dir")"
        (cd "$dir" && npm install --production --silent)
    fi
done

echo "✅ Dependências instaladas"
echo ""

# Build SAM
echo "🔨 Fazendo build do SAM..."
sam build --template infrastructure/complete-stack.yaml

if [ $? -ne 0 ]; then
    echo "❌ Erro no build do SAM"
    exit 1
fi

echo "✅ Build concluído"
echo ""

# Deploy
echo "🚀 Fazendo deploy das correções..."

# Obter parâmetros da stack existente
echo "📋 Obtendo parâmetros da stack existente..."
EXISTING_PARAMS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region us-east-1 \
    --query 'Stacks[0].Parameters' \
    --output json)

# Extrair valores dos parâmetros
DOMAIN_NAME=$(echo "$EXISTING_PARAMS" | jq -r '.[] | select(.ParameterKey=="DomainName") | .ParameterValue // "livechat.ai.udstec.io"')
HOSTED_ZONE_ID=$(echo "$EXISTING_PARAMS" | jq -r '.[] | select(.ParameterKey=="HostedZoneId") | .ParameterValue // ""')
CERTIFICATE_ARN=$(echo "$EXISTING_PARAMS" | jq -r '.[] | select(.ParameterKey=="CertificateArn") | .ParameterValue // ""')
STAGE=$(echo "$EXISTING_PARAMS" | jq -r '.[] | select(.ParameterKey=="Stage") | .ParameterValue // "prod"')

echo "  🌐 Domain: $DOMAIN_NAME"
echo "  🏷️  Stage: $STAGE"

# Fazer deploy
if [ -n "$HOSTED_ZONE_ID" ] && [ -n "$CERTIFICATE_ARN" ]; then
    echo "🚀 Deploy com domínio customizado..."
    sam deploy \
        --stack-name "$STACK_NAME" \
        --region us-east-1 \
        --capabilities CAPABILITY_IAM \
        --no-confirm-changeset \
        --resolve-s3 \
        --parameter-overrides \
            DomainName="$DOMAIN_NAME" \
            HostedZoneId="$HOSTED_ZONE_ID" \
            CertificateArn="$CERTIFICATE_ARN" \
            Stage="$STAGE"
else
    echo "🚀 Deploy sem domínio customizado..."
    sam deploy \
        --stack-name "$STACK_NAME" \
        --region us-east-1 \
        --capabilities CAPABILITY_IAM \
        --no-confirm-changeset \
        --resolve-s3
fi

if [ $? -ne 0 ]; then
    echo "❌ Erro no deploy"
    exit 1
fi

echo ""
echo "✅ Deploy concluído com sucesso!"
echo ""

# Obter outputs
echo "📊 Informações da aplicação:"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].[OutputKey,OutputValue]' \
    --output table

echo ""
echo "🧪 Para testar as correções:"
echo "  1. Abra duas abas do navegador"
echo "  2. Acesse a mesma sala em ambas"
echo "  3. Envie mensagens - agora devem aparecer em ambas!"
echo ""
echo "🔗 URL da aplicação:"
if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "null" ]; then
    echo "  https://$DOMAIN_NAME"
else
    echo "  Verifique o CloudFront Distribution URL nos outputs acima"
fi