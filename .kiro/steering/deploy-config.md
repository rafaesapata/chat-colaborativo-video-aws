---
inclusion: always
---

# Configuração de Deploy - Video Chat

## ⚠️ IMPORTANTE: Usar sempre estes valores para deploy!

### Conta AWS
- **Account ID**: `881786083692`
- **Profile**: `LIVECHAT`
- **Region**: `us-east-1`

### Frontend (Produção)
- **URL**: https://app.livechat.udstec.io
- **S3 Bucket**: `chat-colaborativo-serverless-frontend-881786083692`
- **CloudFront Distribution ID**: `E11O8E42NWLFD3`
- **CloudFront Domain**: `d37akw9cm49a4q.cloudfront.net`

### Backend (API HTTP)
- **API URL**: https://api.livechat.udstec.io
- **API Gateway ID**: `q19gdhzmri`
- **Stack Name**: `chat-colaborativo-serverless`

### Backend (WebSocket)
- **WebSocket URL**: `wss://hkssvtdqz9.execute-api.us-east-1.amazonaws.com/prod`

### Cognito
- **User Pool ID**: `us-east-1_GWOweY3Wk`
- **User Pool Client ID**: `6nouihf5s5mjqd5a9u3g0lqiiu`

### SSL/DNS
- **Certificate ARN**: `arn:aws:acm:us-east-1:881786083692:certificate/6df24931-71a3-4a1a-97a3-0b33b369c9fa`
- **Hosted Zone ID**: `Z057297636BBK9F26RX75`
- **Hosted Zone**: `livechat.udstec.io`

### Comandos de Deploy

```bash
# 1. Build Backend
sam build --template-file infrastructure/complete-stack.yaml --profile LIVECHAT

# 2. Deploy Backend
sam deploy --config-file samconfig.toml --no-confirm-changeset

# 3. Build Frontend
cd frontend && npm run build

# 4. Deploy Frontend para S3
aws s3 sync frontend/dist/ s3://chat-colaborativo-serverless-frontend-881786083692 --delete --profile LIVECHAT

# 5. Invalidar cache CloudFront
aws cloudfront create-invalidation --distribution-id E11O8E42NWLFD3 --paths "/*" --profile LIVECHAT
```

### DynamoDB Tables
- `chat-colaborativo-serverless-ChatRooms` - Meetings/Config/Jobs
- `chat-colaborativo-serverless-Connections` - WebSocket connections
- `chat-colaborativo-serverless-Messages` - Chat messages
- `chat-colaborativo-serverless-Transcriptions` - Transcriptions
- `chat-colaborativo-serverless-Recordings` - Recording metadata
- `chat-colaborativo-serverless-meeting-history` - Meeting history
- `chat-colaborativo-serverless-Users` - Users
- `chat-colaborativo-serverless-RoomEvents` - Room events

### S3 Buckets
- `chat-colaborativo-serverless-frontend-881786083692` - Frontend
- `chat-colaborativo-serverless-recordings-881786083692` - Recordings
- `chat-colaborativo-serverless-audio-881786083692` - Audio/Backgrounds

### Notas
- Cache do CloudFront está com TTL=0 para facilitar testes
- Sempre fazer hard refresh (Cmd+Shift+R) após deploy
