---
inclusion: always
---

# Correções e Estado Atual - Video Chat

## Conta AWS: 881786083692 (Profile: LIVECHAT)
## Data do último deploy: 22/02/2026

### URLs de Produção
- **Frontend**: https://app.livechat.udstec.io
- **API**: https://api.livechat.udstec.io
- **WebSocket**: wss://hkssvtdqz9.execute-api.us-east-1.amazonaws.com/prod

### Variáveis de Ambiente Frontend (.env)
```bash
VITE_WEBSOCKET_URL=wss://hkssvtdqz9.execute-api.us-east-1.amazonaws.com/prod
VITE_USER_POOL_ID=us-east-1_GWOweY3Wk
VITE_USER_POOL_CLIENT_ID=6nouihf5s5mjqd5a9u3g0lqiiu
VITE_REGION=us-east-1
VITE_API_URL=https://app.livechat.udstec.io/api
VITE_CHIME_API_URL=https://app.livechat.udstec.io/api
VITE_TURN_API_URL=https://app.livechat.udstec.io/api
VITE_BACKOFFICE_URL=https://backoffice.udstec.io
```

### Features Implementadas
1. Video conferência WebRTC via Amazon Chime SDK
2. Chat em tempo real via WebSocket
3. Transcrição ao vivo (Amazon Transcribe)
4. Análise de IA (Amazon Bedrock - Claude 3 Sonnet)
5. Modo entrevista com sugestões de perguntas
6. Modo escopo com análise de requisitos
7. Gravação de reuniões (S3 + DynamoDB)
8. Histórico de reuniões com relatórios
9. Painel administrativo
10. Gerenciamento de vagas
11. Agendamento de reuniões
12. Backgrounds virtuais customizáveis
13. API de integração externa com API Keys

### Eventos WebSocket
- `room_ended` - Sala encerrada pelo admin/host
- `user_joined` / `user_left` - Entrada/saída de participantes
- `webrtc-signal` - Sinalização WebRTC

### Lambdas
- `chat-colaborativo-serverless-chime-meeting` - API principal
- `chat-colaborativo-serverless-InterviewAIFunction` - IA de entrevistas
- `chat-colaborativo-serverless-connection-handler` - WebSocket
- `chat-colaborativo-serverless-message-handler` - Mensagens
- `chat-colaborativo-serverless-recording-manager` - Gravações
- `chat-colaborativo-serverless-ai-analysis` - Análise IA
- `chat-colaborativo-serverless-audio-stream-processor` - Audio
- `chat-colaborativo-serverless-transcription-aggregator` - Transcrições
- `chat-colaborativo-serverless-room-manager` - Salas
- `chat-colaborativo-serverless-turn-credentials` - TURN
