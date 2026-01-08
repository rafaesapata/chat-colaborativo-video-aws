# 🔓 Como Habilitar Modelos do AWS Bedrock

## ⚠️ AÇÃO NECESSÁRIA

Os modelos do AWS Bedrock precisam ser habilitados manualmente no console da AWS antes de poderem ser usados.

## 📋 Passos para Habilitar

### 1. Acessar o Console do Bedrock
```
https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess
```

### 2. Solicitar Acesso aos Modelos

1. No console do Bedrock, clique em **"Model access"** no menu lateral
2. Clique no botão **"Manage model access"** (laranja)
3. Selecione os modelos que deseja habilitar:

#### ✅ Modelos Recomendados (escolha UM):

**Opção 1 - Claude 3 Sonnet (Anthropic)** - Melhor qualidade
- ☑️ `Claude 3 Sonnet`
- Custo: ~$3 por 1M tokens input, ~$15 por 1M tokens output
- Qualidade: Excelente para entrevistas

**Opção 2 - Amazon Nova Lite (AWS)** - Mais barato
- ☑️ `Amazon Nova Lite`
- Custo: Mais barato que Claude
- Qualidade: Boa para uso geral

**Opção 3 - Claude 3 Haiku (Anthropic)** - Rápido e barato
- ☑️ `Claude 3 Haiku`
- Custo: ~$0.25 por 1M tokens input, ~$1.25 por 1M tokens output
- Qualidade: Boa e muito rápida

4. Clique em **"Request model access"**
5. Aguarde alguns segundos (geralmente é instantâneo)
6. Verifique se o status mudou para **"Access granted"** (verde)

### 3. Verificar Acesso

Após habilitar, execute este comando para testar:

```bash
# Testar Claude 3 Sonnet
aws bedrock-runtime invoke-model \
  --model-id us.anthropic.claude-3-sonnet-20240229-v1:0 \
  --region us-east-1 \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/test.json && cat /tmp/test.json
```

## 🔧 Após Habilitar

Depois de habilitar o modelo, me avise qual modelo você habilitou e eu vou:
1. Atualizar o código do Lambda para usar o modelo correto
2. Fazer o deploy
3. Testar a geração de perguntas

## 💡 Dica

Se você já tem experiência com algum modelo específico ou preferência, pode habilitar esse. O código funciona com qualquer modelo de texto do Bedrock, basta ajustar o ID do modelo.

## 📊 Comparação de Modelos

| Modelo | Velocidade | Qualidade | Custo | Recomendação |
|--------|-----------|-----------|-------|--------------|
| Claude 3 Sonnet | Média | Excelente | Alto | ⭐ Melhor para entrevistas |
| Claude 3 Haiku | Rápida | Boa | Baixo | ⭐ Melhor custo-benefício |
| Amazon Nova Lite | Rápida | Boa | Baixo | ⭐ Opção AWS nativa |

## ❓ Problemas Comuns

**Erro: "Model access is denied"**
- Solução: Você precisa habilitar o modelo no console (passos acima)

**Erro: "on-demand throughput isn't supported"**
- Solução: Use o inference profile (ex: `us.anthropic.claude-3-sonnet-20240229-v1:0`)

**Erro: "AWS Marketplace actions"**
- Solução: Alguns modelos requerem aceitar termos no AWS Marketplace. Siga o link no console.
