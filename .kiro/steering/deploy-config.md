# Configuração de Deploy - Video Chat

## ⚠️ IMPORTANTE: Usar sempre estes valores para deploy!

### Frontend (Produção)
- **URL**: https://livechat.ai.udstec.io
- **S3 Bucket**: `chat-colaborativo-prod-frontend-383234048592`
- **CloudFront Distribution ID**: `E19FZWDK7MJWSX`
- **CloudFront Domain**: `dmz2oaky7xb1w.cloudfront.net`

### Backend (WebSocket)
- **WebSocket URL**: `wss://y08b6lfdel.execute-api.us-east-1.amazonaws.com/prod`
- **Stack Name**: `chat-colaborativo-serverless`
- **Region**: `us-east-1`

### Comandos de Deploy

```bash
# 1. Build Frontend
cd frontend && npm run build

# 2. Deploy Frontend para S3 (PRODUÇÃO)
aws s3 sync frontend/dist/ s3://chat-colaborativo-prod-frontend-383234048592 --delete

# 3. Invalidar cache CloudFront (PRODUÇÃO)
aws cloudfront create-invalidation --distribution-id E19FZWDK7MJWSX --paths "/*"

# 4. Build Backend
cd backend && sam build --template-file ../infrastructure/complete-stack.yaml

# 5. Deploy Backend
sam deploy --config-file samconfig.toml --no-confirm-changeset
```

### ❌ NÃO USAR (ambiente de desenvolvimento/teste)
- S3: `chat-colaborativo-serverless-frontend-383234048592`
- CloudFront: `EN3HOQQ3NL8CG` / `d25xyqrafs14xk.cloudfront.net`

### Notas
- Cache do CloudFront está desabilitado (TTL=0) para facilitar testes
- Sempre fazer hard refresh (Cmd+Shift+R) após deploy para garantir nova versão
