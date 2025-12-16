# 🌐 Deploy com Domínio Customizado - livechat.ai.udstec.io

## ✅ TUDO PRONTO PARA DEPLOY!

---

## 🎯 O QUE VOCÊ TEM AGORA

### ✅ CloudFormation Template Completo
**Arquivo:** `infrastructure/complete-stack.yaml`
- 45+ recursos AWS
- Frontend + Backend integrados
- CloudFront + Route53 + SSL
- 100% automatizado

### ✅ Script de Deploy Automático
**Arquivo:** `scripts/deploy-complete.sh`
- Um comando faz tudo
- Validação automática
- Upload frontend
- Configuração DNS

### ✅ Documentação Completa
- `DEPLOY_AGORA.md` - **COMECE AQUI** ⭐
- `DEPLOY_DOMINIO.md` - Guia completo
- `RESUMO_DEPLOY_DOMINIO.md` - Resumo técnico
- `COMANDOS_RAPIDOS.md` - Comandos úteis

---

## 🚀 DEPLOY EM 1 COMANDO

```bash
./scripts/deploy-complete.sh
```

**Isso vai:**
1. ✅ Criar certificado SSL para *.ai.udstec.io
2. ✅ Validar certificado automaticamente
3. ✅ Deploy de 45+ recursos AWS
4. ✅ Build e upload do frontend
5. ✅ Configurar CloudFront
6. ✅ Configurar Route53
7. ✅ Invalidar cache

**Tempo:** 10-15 minutos

**Resultado:** https://livechat.ai.udstec.io funcionando!

---

## 📋 Pré-requisitos

### Você precisa ter:

1. **Domínio ai.udstec.io no Route53**
   ```bash
   # Verificar
   aws route53 list-hosted-zones \
     --query "HostedZones[?Name=='ai.udstec.io.']"
   ```

2. **AWS CLI configurado**
   ```bash
   aws sts get-caller-identity
   # ✅ Já está configurado!
   ```

3. **SAM CLI instalado**
   ```bash
   sam --version
   # ✅ Já está instalado!
   ```

---

## 🌐 Arquitetura

```
Internet
   │
   ▼
livechat.ai.udstec.io (Route53)
   │
   ▼
CloudFront (CDN + SSL)
   │
   ├─► S3 (Frontend React)
   │
   └─► API Gateway WebSocket
        │
        ▼
     Lambda Functions (6)
        │
        ├─► DynamoDB (5 tabelas)
        ├─► S3 (áudio)
        ├─► Transcribe
        ├─► Bedrock
        └─► Cognito
```

---

## 📊 Recursos Criados

### Frontend
- ✅ S3 Bucket (privado)
- ✅ CloudFront Distribution
- ✅ Route53 A Record
- ✅ ACM Certificate (SSL)

### Backend
- ✅ 6 Lambda Functions
- ✅ 5 DynamoDB Tables
- ✅ API Gateway WebSocket
- ✅ S3 Bucket (áudio)
- ✅ Cognito User Pool
- ✅ 6 IAM Roles

**Total: ~45 recursos**

---

## 💰 Custos

### Frontend (Novo)
- CloudFront: $1-5/mês
- S3: $0.50/mês
- Route53: $0.50/mês
- SSL: Grátis

### Backend (Existente)
- Lambda: $10/mês
- DynamoDB: $5/mês
- Transcribe: $30/mês
- Bedrock: $20/mês
- Outros: $7/mês

**Total: ~$74-78/mês**

---

## 🔐 Segurança

- ✅ SSL/TLS automático (ACM)
- ✅ HTTPS obrigatório
- ✅ S3 bucket privado
- ✅ CloudFront OAC
- ✅ Cognito JWT
- ✅ IAM least privilege

---

## 🧪 Após o Deploy

### 1. Aguardar Propagação
- CloudFront: ~5-10 minutos
- DNS: ~5-60 minutos

### 2. Testar
```bash
# DNS
dig livechat.ai.udstec.io

# HTTPS
curl -I https://livechat.ai.udstec.io

# Abrir no navegador
open https://livechat.ai.udstec.io
```

### 3. Habilitar Bedrock
1. Acesse: https://console.aws.amazon.com/bedrock/
2. Região: us-east-1
3. Model access → Request model access
4. Selecione: Claude 3 Sonnet

### 4. Criar Usuário
```bash
# Ver comando completo em COMANDOS_RAPIDOS.md
```

---

## 📚 Documentação

### Guias de Deploy
1. **DEPLOY_AGORA.md** ⭐ - Comece aqui!
2. **DEPLOY_DOMINIO.md** - Guia completo
3. **RESUMO_DEPLOY_DOMINIO.md** - Resumo técnico

### Referência
4. **COMANDOS_RAPIDOS.md** - Comandos úteis
5. **STATUS_FINAL.md** - Status do deploy anterior
6. **COMO_USAR.md** - Como usar a aplicação

### Técnica
7. **docs/ARCHITECTURE.md** - Arquitetura
8. **docs/API.md** - API WebSocket
9. **docs/DEPLOYMENT.md** - Deployment

---

## 🔄 Diferenças do Deploy Anterior

### Antes (template.yaml)
- ❌ Sem CloudFront
- ❌ Sem domínio customizado
- ❌ Sem SSL customizado
- ❌ Frontend manual
- ✅ Backend completo

### Agora (complete-stack.yaml)
- ✅ CloudFront Distribution
- ✅ Domínio customizado
- ✅ SSL/TLS automático
- ✅ Frontend automatizado
- ✅ Backend completo
- ✅ Script de deploy automático

---

## 🎯 Próximos Passos

### 1. Deploy
```bash
./scripts/deploy-complete.sh
```

### 2. Aguardar
- ~10-15 minutos para deploy completo
- ~5-10 minutos para CloudFront
- ~5-60 minutos para DNS

### 3. Acessar
```bash
open https://livechat.ai.udstec.io
```

### 4. Configurar
- Habilitar Bedrock
- Criar usuários
- Testar funcionalidades

---

## 🆘 Problemas?

### Certificado não valida
```bash
# Ver status
aws acm describe-certificate \
  --certificate-arn SEU_CERT_ARN \
  --region us-east-1
```
Solução: Adicione registros CNAME no Route53

### Stack falha
```bash
# Ver eventos
aws cloudformation describe-stack-events \
  --stack-name chat-colaborativo-prod \
  --max-items 20
```

### DNS não resolve
```bash
# Verificar
dig livechat.ai.udstec.io
```
Solução: Aguarde propagação (até 1h)

### CloudFront não atualiza
```bash
# Invalidar cache
aws cloudfront create-invalidation \
  --distribution-id SEU_DIST_ID \
  --paths "/*"
```

---

## ✅ Checklist

- [ ] Hosted Zone ai.udstec.io existe
- [ ] AWS CLI configurado
- [ ] SAM CLI instalado
- [ ] Executar `./scripts/deploy-complete.sh`
- [ ] Aguardar conclusão (~15 min)
- [ ] Testar DNS
- [ ] Testar HTTPS
- [ ] Habilitar Bedrock
- [ ] Criar usuário teste
- [ ] Testar aplicação

---

## 🎉 EXECUTE AGORA!

```bash
./scripts/deploy-complete.sh
```

**Em 15 minutos você terá:**

✅ https://livechat.ai.udstec.io funcionando
✅ SSL/TLS automático
✅ CDN global (CloudFront)
✅ Backend serverless completo
✅ Chat em tempo real
✅ Transcrição de áudio
✅ Análise de IA

**Pronto para produção!** 🚀

---

## 📞 Suporte

- **Guia rápido:** DEPLOY_AGORA.md
- **Guia completo:** DEPLOY_DOMINIO.md
- **Comandos:** COMANDOS_RAPIDOS.md
- **Arquitetura:** docs/ARCHITECTURE.md

---

*CloudFormation Template Completo*
*Deploy Automatizado*
*Domínio Customizado*
*SSL/TLS Gerenciado*
*CDN Global*
*100% Serverless*
*Pronto para Produção*
