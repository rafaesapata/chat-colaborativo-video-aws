# 🎥 Video Chat Colaborativo - Código Fonte

Sistema completo de video chat com WebRTC, WebSocket e transcrição em tempo real.

## 📋 Estrutura do Projeto

```
├── frontend/                    # Aplicação React + TypeScript
│   ├── src/
│   │   ├── components/         # Componentes React
│   │   │   ├── MeetingRoom.tsx # Sala de reunião principal
│   │   │   ├── VideoGrid.tsx   # Grid de vídeos
│   │   │   ├── ChatSidebar.tsx # Chat lateral
│   │   │   ├── ControlBar.tsx  # Controles de vídeo/áudio
│   │   │   └── ...
│   │   ├── hooks/              # React Hooks customizados
│   │   │   ├── useVideoCall.ts # Lógica WebRTC
│   │   │   ├── useWebSocket.ts # Conexão WebSocket
│   │   │   └── useTranscription.ts # Transcrição
│   │   └── App.tsx             # Componente principal
│   ├── .env                    # Variáveis de ambiente
│   └── package.json            # Dependências frontend
│
├── backend/lambdas/            # Funções Lambda AWS
│   ├── connection-handler/     # Gerencia conexões WebSocket
│   ├── message-handler/        # Processa mensagens e WebRTC
│   ├── audio-stream-processor/ # Processa áudio para transcrição
│   ├── transcription-aggregator/ # Agrega transcrições
│   ├── ai-analysis/            # Análise de IA (AWS Bedrock)
│   └── room-manager/           # Gerencia salas
│
└── infrastructure/
    └── complete-stack.yaml     # CloudFormation template completo
```

## 🚀 Tecnologias Utilizadas

### Frontend
- **React 18** com TypeScript
- **Vite** - Build tool
- **Tailwind CSS** - Estilização
- **WebRTC** - Comunicação peer-to-peer de vídeo/áudio
- **WebSocket** - Comunicação em tempo real
- **Web Speech API** - Transcrição de voz

### Backend (AWS)
- **API Gateway WebSocket** - Comunicação bidirecional
- **Lambda Functions** (Node.js 18)
- **DynamoDB** - Banco de dados NoSQL
- **S3** - Armazenamento de áudio
- **CloudFront** - CDN para frontend
- **Cognito** - Autenticação (opcional)
- **AWS Transcribe** - Transcrição de áudio
- **AWS Bedrock** - Análise de IA

## 📦 Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- AWS CLI configurado
- SAM CLI instalado
- Conta AWS ativa

### 1. Instalar Dependências do Frontend

```bash
cd frontend
npm install
```

### 2. Configurar Variáveis de Ambiente

Edite `frontend/.env`:

```env
VITE_WEBSOCKET_URL=wss://seu-websocket-url.execute-api.us-east-1.amazonaws.com/prod
VITE_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_REGION=us-east-1
```

### 3. Deploy do Backend (AWS)

```bash
# Build das funções Lambda
sam build -t infrastructure/complete-stack.yaml

# Deploy na AWS
sam deploy --config-file samconfig.toml
```

Após o deploy, anote os outputs:
- `WebSocketURL` - URL do WebSocket
- `FrontendBucketName` - Nome do bucket S3
- `CloudFrontDistributionId` - ID da distribuição CloudFront

### 4. Atualizar Frontend com URLs do Backend

Atualize `frontend/.env` com a `WebSocketURL` obtida no deploy.

### 5. Build e Deploy do Frontend

```bash
cd frontend
npm run build

# Upload para S3
aws s3 sync dist/ s3://NOME-DO-BUCKET-FRONTEND --delete

# Invalidar cache do CloudFront
aws cloudfront create-invalidation --distribution-id ID-DA-DISTRIBUICAO --paths "/*"
```

## 🎮 Como Usar

### Desenvolvimento Local

```bash
cd frontend
npm run dev
```

Acesse: http://localhost:3000

**Nota**: Para testar WebRTC localmente, você precisa:
1. Usar HTTPS ou localhost
2. Ter o backend já deployado na AWS
3. Configurar o `.env` com a URL do WebSocket

### Produção

Acesse a URL do CloudFront fornecida no output do deploy.

## 🔧 Funcionalidades

### ✅ Implementadas
- [x] Video chat em tempo real (WebRTC)
- [x] Chat de texto
- [x] Controles de áudio/vídeo
- [x] Múltiplos participantes
- [x] Interface responsiva (dark/light mode)
- [x] Transcrição em tempo real (Web Speech API)
- [x] Notificações de entrada/saída de usuários
- [x] Grid dinâmico de vídeos (1-10+ participantes)
- [x] Indicador de quem está falando
- [x] Compartilhamento de tela (preparado)

### 🔄 Fluxo de Conexão WebRTC

1. Usuário entra na sala → WebSocket conecta
2. Backend notifica outros usuários (room_event)
3. Novo usuário anuncia entrada com vídeo (webrtc-signal)
4. Usuários existentes criam ofertas WebRTC
5. Novo usuário responde com answer
6. ICE candidates são trocados
7. Conexão P2P estabelecida → vídeo flui

## 🐛 Debug e Logs

O sistema possui logs detalhados no console do navegador:

```javascript
[WebSocket] ✅ Conectado com sucesso!
[VideoCall] 📹 Adicionando tracks locais para user_xxx
[VideoCall] 🤝 Criando oferta para user_xxx
[VideoCall] 📺 Stream remoto recebido de user_xxx!
[VideoCall] ✅ Conectado com sucesso a user_xxx!
```

### Problemas Comuns

**Vídeo não aparece:**
- Verifique permissões de câmera/microfone
- Confirme que o WebSocket está conectado
- Verifique logs do console para erros WebRTC
- Teste em HTTPS (WebRTC requer conexão segura)

**WebSocket desconecta:**
- Verifique se o Lambda tem permissões corretas
- Confirme que as variáveis de ambiente estão configuradas
- Verifique logs do CloudWatch

**Chat funciona mas vídeo não:**
- Problema no signaling WebRTC
- Verifique se a rota `webrtc-signal` está configurada
- Confirme que os ICE candidates estão sendo trocados

## 📊 Arquitetura

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐
│ CloudFront  │
│     CDN     │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│     S3      │      │  API Gateway │
│  (Static)   │      │  (WebSocket) │
└─────────────┘      └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Lambda     │
                     │  Functions   │
                     └──────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌─────────┐         ┌─────────┐        ┌─────────┐
   │DynamoDB │         │   S3    │        │ Cognito │
   │ Tables  │         │ Audio   │        │  Auth   │
   └─────────┘         └─────────┘        └─────────┘
```

## 🔐 Segurança

- Conexões WebSocket autenticadas por userId
- HTTPS obrigatório para WebRTC
- Dados temporários (TTL em DynamoDB)
- CORS configurado
- Validação de entrada em todas as Lambdas

## 💰 Custos AWS (Estimativa)

Para uso moderado (~100 usuários/mês):
- API Gateway WebSocket: ~$1-5
- Lambda: ~$0-2 (free tier)
- DynamoDB: ~$0-1 (free tier)
- S3: ~$0-1
- CloudFront: ~$0-2
- **Total: ~$2-11/mês**

## 📝 Licença

Este código é fornecido como está, sem garantias.

## 🤝 Suporte

Para problemas ou dúvidas:
1. Verifique os logs do console do navegador
2. Verifique os logs do CloudWatch (AWS)
3. Revise a documentação do WebRTC
4. Teste a conectividade WebSocket

## 🔄 Atualizações

Para atualizar o sistema:

```bash
# Backend
sam build -t infrastructure/complete-stack.yaml
sam deploy --config-file samconfig.toml

# Frontend
cd frontend
npm run build
aws s3 sync dist/ s3://BUCKET-NAME --delete
aws cloudfront create-invalidation --distribution-id DIST-ID --paths "/*"
```

---

**Desenvolvido com ❤️ usando React, WebRTC e AWS**
