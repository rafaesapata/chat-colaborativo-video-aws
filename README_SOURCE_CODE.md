# 📦 Chat Colaborativo por Vídeo - Código Fonte

## 📋 Conteúdo do Pacote

Este arquivo contém **apenas o código fonte** do projeto, sem dependências.

### Estrutura:
```
├── backend/
│   └── lambdas/              # 6 Lambda Functions (Node.js)
│       ├── connection-handler/
│       ├── message-handler/
│       ├── audio-stream-processor/
│       ├── transcription-aggregator/
│       ├── ai-analysis/
│       └── room-manager/
│
├── frontend/
│   ├── src/
│   │   ├── components/       # 12 componentes React
│   │   └── hooks/            # 4 hooks customizados
│   ├── package.json
│   └── vite.config.ts
│
├── infrastructure/
│   ├── template.yaml         # SAM template básico
│   └── complete-stack.yaml   # CloudFormation completo
│
├── scripts/
│   ├── deploy.sh
│   └── deploy-complete.sh
│
└── docs/                     # Documentação completa
```

---

## 🚀 Como Usar

### 1. Instalar Dependências

#### Frontend:
```bash
cd frontend
npm install
```

#### Backend (cada Lambda):
```bash
cd backend/lambdas/connection-handler
npm install

cd ../message-handler
npm install

# Repetir para todas as Lambdas
```

---

## 🔧 Configuração

### 1. Variáveis de Ambiente

Crie `frontend/.env`:
```env
VITE_WEBSOCKET_URL=wss://SEU-API-ID.execute-api.us-east-1.amazonaws.com/prod
VITE_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_REGION=us-east-1
```

### 2. AWS Credentials

Configure suas credenciais AWS:
```bash
aws configure
```

---

## 📦 Deploy

### Opção 1: Deploy Completo (Recomendado)
```bash
cd infrastructure
sam deploy --template-file complete-stack.yaml \
  --stack-name chat-colaborativo-prod \
  --parameter-overrides \
    HostedZoneId=SEU_HOSTED_ZONE_ID \
    CertificateArn=SEU_CERTIFICATE_ARN \
  --capabilities CAPABILITY_IAM
```

### Opção 2: Deploy Básico
```bash
cd infrastructure
sam build
sam deploy --guided
```

### Opção 3: Script Automatizado
```bash
chmod +x scripts/deploy-complete.sh
./scripts/deploy-complete.sh
```

---

## 🏃 Desenvolvimento Local

### Frontend:
```bash
cd frontend
npm run dev
# Acesse: http://localhost:3000/
```

### Backend:
```bash
# Usar SAM Local
sam local start-api
```

---

## 📚 Documentação Incluída

### Guias Principais:
- `README.md` - Visão geral do projeto
- `COMO_USAR.md` - Como usar a aplicação
- `DEPLOYMENT.md` - Guia de deploy completo
- `TROUBLESHOOTING.md` - Solução de problemas

### Documentação Técnica:
- `docs/ARCHITECTURE.md` - Arquitetura do sistema
- `docs/API.md` - Documentação da API
- `NOVA_INTERFACE_CORPORATIVA.md` - Interface implementada
- `MELHORIAS_IMPLEMENTADAS.md` - Melhorias e features

### Guias de Deploy:
- `DEPLOY_DOMINIO.md` - Deploy com domínio customizado
- `COMANDOS_RAPIDOS.md` - Comandos úteis
- `TESTE_LOCAL.md` - Como testar localmente

---

## 🎯 Funcionalidades

### ✅ Implementadas:
- Chat de texto em tempo real
- Vídeo conferência WebRTC (múltiplos participantes)
- Transcrição de áudio com Amazon Transcribe
- Análise IA com Amazon Bedrock
- URLs únicas por sala
- Interface corporativa moderna
- Indicadores visuais de quem está falando
- Qualidade adaptativa de vídeo
- Reconexão automática
- Toast notifications
- Debug Panel

### 🏗️ Infraestrutura:
- 6 Lambda Functions (Node.js 18.x)
- 5 Tabelas DynamoDB
- API Gateway WebSocket
- CloudFront + S3
- Cognito User Pool
- Route53 + ACM

---

## 📊 Tamanho do Pacote

- **Código Fonte**: ~129KB
- **Após npm install**: ~500MB (node_modules)
- **Build Frontend**: ~220KB (gzipped)

---

## 🔑 Requisitos

### Software:
- Node.js 18.x ou superior
- AWS CLI configurado
- SAM CLI (opcional, para deploy)
- Git (opcional)

### AWS Services:
- Lambda
- DynamoDB
- API Gateway
- S3
- CloudFront
- Cognito
- Transcribe
- Bedrock
- Route53 (opcional)
- ACM (opcional)

---

## 🌐 URLs Importantes

### Produção (exemplo):
- Frontend: https://livechat.ai.udstec.io
- WebSocket: wss://kb09dca09l.execute-api.us-east-1.amazonaws.com/prod

### Local:
- Frontend: http://localhost:3000/
- Backend: http://localhost:3001/ (SAM Local)

---

## 🛠️ Comandos Úteis

### Frontend:
```bash
npm run dev      # Desenvolvimento
npm run build    # Build para produção
npm run preview  # Preview do build
```

### Backend:
```bash
sam build        # Build Lambdas
sam deploy       # Deploy para AWS
sam local start-api  # Testar localmente
```

### AWS:
```bash
# Upload frontend para S3
aws s3 sync frontend/dist/ s3://BUCKET-NAME/ --delete

# Invalidar cache CloudFront
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION-ID \
  --paths "/*"

# Ver logs Lambda
aws logs tail /aws/lambda/FUNCTION-NAME --follow
```

---

## 🐛 Troubleshooting

### Problema: npm install falha
```bash
# Limpar cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Problema: Deploy falha
```bash
# Verificar credenciais
aws sts get-caller-identity

# Verificar região
aws configure get region
```

### Problema: WebSocket não conecta
1. Verifique `.env` tem `VITE_WEBSOCKET_URL`
2. Verifique URL está correta
3. Teste manualmente no Console do navegador

---

## 📞 Suporte

### Documentação:
- Leia `TROUBLESHOOTING.md` para problemas comuns
- Veja `docs/` para documentação técnica
- Consulte `README.md` para visão geral

### Logs:
- Frontend: Console do navegador (F12)
- Backend: CloudWatch Logs
- Debug: Botão 🐛 na aplicação

---

## 📝 Notas Importantes

### Custos AWS:
- Lambda: Pay-per-use
- DynamoDB: On-Demand
- Transcribe: ~$0.024/min
- Bedrock: ~$0.003/1K tokens
- CloudFront: ~$0.085/GB

### Segurança:
- Cognito para autenticação
- IAM roles com least privilege
- Criptografia em trânsito (TLS)
- Criptografia em repouso (S3, DynamoDB)

### Performance:
- CloudFront CDN global
- DynamoDB com GSI otimizados
- Lambda com 512MB RAM
- WebRTC P2P (baixa latência)

---

## 🎓 Tecnologias Utilizadas

### Frontend:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- WebRTC
- Web Audio API

### Backend:
- Node.js 18.x
- AWS SDK v3
- WebSocket API
- Amazon Transcribe
- Amazon Bedrock

### Infrastructure:
- AWS SAM
- CloudFormation
- Serverless

---

## ✅ Checklist de Setup

- [ ] Extrair arquivo zip
- [ ] Instalar Node.js 18.x
- [ ] Configurar AWS CLI
- [ ] Instalar dependências frontend
- [ ] Instalar dependências backend
- [ ] Criar arquivo `.env`
- [ ] Fazer deploy da infraestrutura
- [ ] Fazer build do frontend
- [ ] Upload para S3
- [ ] Testar aplicação

---

## 🎉 Resultado Final

Após seguir os passos, você terá:
- ✅ Aplicação de vídeo chat funcionando
- ✅ Interface corporativa moderna
- ✅ Transcrição em tempo real
- ✅ Análise IA das conversas
- ✅ URLs únicas por sala
- ✅ Totalmente serverless na AWS

---

**Versão**: 3.0.0  
**Data**: 16/12/2024  
**Tamanho**: 129KB (código fonte)  
**Licença**: MIT
