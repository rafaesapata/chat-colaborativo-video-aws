# 🎥 Chat Colaborativo por Vídeo - AWS Serverless

Aplicação profissional de chat colaborativo por vídeo, 100% serverless na AWS, com transcrição em tempo real usando IA.

[![Deploy Status](https://img.shields.io/badge/deploy-success-brightgreen)]()
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## 🌐 Demo

**URL:** https://livechat.ai.udstec.io

---

## ✨ Funcionalidades

### 🎥 Vídeo Conferência
- **WebRTC** para comunicação peer-to-peer
- Suporte a **múltiplos participantes** simultâneos (5-100)
- Controles de **câmera e microfone**
- **Picture-in-picture** para vídeo local
- Grid responsivo de vídeos

### 💬 Chat em Tempo Real
- Mensagens instantâneas via **WebSocket**
- Histórico persistente no **DynamoDB**
- Status online/offline
- Indicadores de digitação

### 🎤 Transcrição de Áudio
- **Amazon Transcribe Streaming**
- Suporte a **PT-BR** e **EN-US**
- Latência < 3 segundos
- Identificação de até **5 falantes**
- Legendas em tempo real

### 🤖 Análise de IA
- **Amazon Bedrock** (Claude 3 Sonnet)
- Resumos automáticos
- Análise de sentimento
- Extração de action items
- Busca semântica

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│  Usuários (WebRTC + WebSocket)          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  CloudFront + Route53 + SSL             │
│  livechat.ai.udstec.io                  │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│  S3 Bucket   │  │  API Gateway     │
│  (Frontend)  │  │  WebSocket       │
└──────────────┘  └────────┬─────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Lambda Functions│
                  │  (6 funções)    │
                  └────────┬────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  DynamoDB    │  │  Transcribe  │  │   Bedrock    │
│  (5 tabelas) │  │  Streaming   │  │   (Claude)   │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Backend (AWS Serverless)
- **6 Lambda Functions** (Node.js 18.x)
  - connection-handler
  - message-handler (com suporte WebRTC)
  - audio-stream-processor
  - transcription-aggregator
  - ai-analysis
  - room-manager
- **5 DynamoDB Tables**
  - Users, ChatRooms, Messages, Transcriptions, Connections
- **API Gateway WebSocket**
- **S3** para áudio e frontend
- **CloudFront** para CDN
- **Cognito** para autenticação

### Frontend (React + TypeScript)
- **React 18** + **TypeScript**
- **Tailwind CSS** para estilização
- **WebRTC** para vídeo P2P
- **WebSocket** para sinalização
- Componentes modulares

---

## 🚀 Deploy

### Pré-requisitos
- AWS CLI configurado
- SAM CLI instalado
- Node.js 18.x
- Domínio no Route53 (opcional)

### Deploy Automático

```bash
# 1. Clonar repositório
git clone https://github.com/rafaesapata/chat-colaborativo-video-aws.git
cd chat-colaborativo-video-aws

# 2. Deploy completo (com domínio)
./scripts/deploy-complete.sh
```

### Deploy Manual

```bash
# 1. Instalar dependências
for dir in backend/lambdas/*/; do
  (cd "$dir" && npm install --production)
done

# 2. Build SAM
sam build --template infrastructure/complete-stack.yaml

# 3. Deploy
sam deploy \
  --stack-name chat-colaborativo-prod \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  --guided

# 4. Build e deploy frontend
cd frontend
npm install
npm run build
aws s3 sync dist/ s3://FRONTEND_BUCKET --delete
```

---

## 📊 Recursos AWS Criados

- **43 recursos** no total
- **6 Lambda Functions**
- **5 DynamoDB Tables**
- **2 S3 Buckets**
- **1 CloudFront Distribution**
- **1 API Gateway WebSocket**
- **1 Cognito User Pool**
- **6 IAM Roles**
- **1 Route53 Record** (se configurado)

---

## 💰 Custos Estimados

Para **5 usuários**, **8h/dia**, **20 dias/mês**:

| Serviço | Custo Mensal |
|---------|--------------|
| CloudFront | $1-5 |
| API Gateway WebSocket | $5 |
| Lambda | $10 |
| DynamoDB | $5 |
| Amazon Transcribe | $30 |
| Amazon Bedrock | $20 |
| S3 | $2.50 |
| Route53 | $0.50 |
| **TOTAL** | **~$74-78/mês** |

---

## 🧪 Testes

### Testar WebSocket
```bash
node test-connection.js
```

### Testar Frontend Local
```bash
cd frontend
npm run dev
# Acesse: http://localhost:3000
```

### Testar Aplicação Deployada
```bash
open https://livechat.ai.udstec.io
```

---

## 📚 Documentação

- **[DEPLOY_AGORA.md](DEPLOY_AGORA.md)** - Guia rápido de deploy
- **[COMO_USAR.md](COMO_USAR.md)** - Como usar a aplicação
- **[docs/API.md](docs/API.md)** - Documentação da API WebSocket
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Arquitetura detalhada
- **[COMANDOS_RAPIDOS.md](COMANDOS_RAPIDOS.md)** - Comandos úteis

---

## 🔐 Segurança

- ✅ SSL/TLS automático (ACM)
- ✅ Autenticação JWT (Cognito)
- ✅ Criptografia em trânsito e repouso
- ✅ IAM roles com least privilege
- ✅ S3 buckets privados
- ✅ CloudFront OAC
- ✅ Sanitização de inputs
- ✅ Rate limiting

---

## 🛠️ Tecnologias

### Backend
- Node.js 18.x
- AWS Lambda
- DynamoDB
- API Gateway WebSocket
- Amazon Transcribe
- Amazon Bedrock (Claude 3)
- S3
- CloudFront
- Route53
- Cognito

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- WebRTC
- Vite

---

## 📝 Estrutura do Projeto

```
├── backend/
│   └── lambdas/
│       ├── connection-handler/
│       ├── message-handler/
│       ├── audio-stream-processor/
│       ├── transcription-aggregator/
│       ├── ai-analysis/
│       └── room-manager/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── VideoCall.tsx
│       │   ├── ChatRoom.tsx
│       │   ├── LiveTranscription.tsx
│       │   └── ...
│       └── hooks/
│           ├── useVideoCall.ts
│           ├── useWebSocket.ts
│           └── useAudioStream.ts
├── infrastructure/
│   ├── template.yaml
│   └── complete-stack.yaml
├── scripts/
│   ├── deploy-complete.sh
│   └── deploy.sh
└── docs/
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👨‍💻 Autor

**Rafael Sapata**

- GitHub: [@rafaesapata](https://github.com/rafaesapata)
- LinkedIn: [Rafael Sapata](https://linkedin.com/in/rafaelsapata)

---

## 🙏 Agradecimentos

- AWS por fornecer serviços serverless incríveis
- Comunidade open source
- Todos os contribuidores

---

## 📞 Suporte

Para dúvidas ou problemas:
- Abra uma [issue](https://github.com/rafaesapata/chat-colaborativo-video-aws/issues)
- Consulte a [documentação](docs/)
- Entre em contato via LinkedIn

---

**⭐ Se este projeto foi útil, considere dar uma estrela!**

---

*Desenvolvido com ❤️ usando AWS Serverless*
