# 🔧 Troubleshooting - Chat Colaborativo

## 🐛 Problemas Identificados e Soluções

### 1. ❌ "Desconectado do servidor. Tentando reconectar..."

#### Causa:
- WebSocket URL não está definida ou está incorreta
- Variáveis de ambiente com prefixo errado

#### Solução Aplicada:
✅ Corrigido `.env` com prefixo correto:
```env
# ANTES (errado para Vite)
REACT_APP_WEBSOCKET_URL=...

# DEPOIS (correto)
VITE_WEBSOCKET_URL=wss://kb09dca09l.execute-api.us-east-1.amazonaws.com/prod
VITE_USER_POOL_ID=us-east-1_WVRjDM51j
VITE_USER_POOL_CLIENT_ID=4v3cchcg1drvnc3ffu8ej16fpj
```

#### Como Verificar:
1. Abra http://localhost:3000/
2. Clique no botão "🐛 Debug" no canto inferior direito
3. Verifique se "WebSocket URL" está preenchida
4. Verifique se "Status" mostra "✅ CONECTADO"

#### Se ainda não funcionar:
```bash
# 1. Parar servidor
Ctrl+C

# 2. Limpar cache
cd frontend
rm -rf node_modules/.vite

# 3. Reiniciar
npm run dev
```

---

### 2. ❌ Transcrição não aparece

#### Possíveis Causas:
1. **Lambda não está processando áudio**
2. **WebSocket não está enviando dados**
3. **Permissão de microfone negada**
4. **Transcrição não ativada**

#### Verificação Passo a Passo:

##### Passo 1: Verificar se transcrição está ativa
1. Entre em uma sala
2. Clique em "Transcrever" no header
3. Botão deve ficar vermelho "Gravando"
4. Abra Debug Panel (🐛)
5. Verifique "Transcrição: 🎤 ATIVA"

##### Passo 2: Verificar permissão de microfone
1. Navegador deve pedir permissão
2. Clique em "Permitir"
3. Verifique ícone de microfone na barra do navegador

##### Passo 3: Verificar logs do Console
Abra Console (F12) e procure por:
```javascript
// Deve aparecer:
[AudioStream] Gravação iniciada
[AudioStream] Chunk capturado: 8192 bytes
[AudioStream] Enviando chunk base64, tamanho: 10924
[Audio] Enviando dados de áudio: { roomId, userId, dataLength }

// Se aparecer erro:
❌ NotAllowedError: Permission denied
// Solução: Permitir microfone nas configurações do navegador
```

##### Passo 4: Verificar WebSocket
```javascript
// Deve aparecer:
[WebSocket] ✅ Conectado com sucesso!

// Ao enviar áudio:
[WebSocket] Mensagem recebida: { type: 'transcription', data: {...} }

// Se não aparecer:
❌ WebSocket não está recebendo transcrições do Lambda
```

#### Soluções:

**Se microfone não captura:**
```bash
# Chrome/Edge
chrome://settings/content/microphone

# Firefox
about:preferences#privacy
```

**Se WebSocket não conecta:**
1. Verifique `.env` tem `VITE_WEBSOCKET_URL`
2. Verifique URL está correta
3. Teste WebSocket manualmente:
```javascript
// No Console do navegador:
const ws = new WebSocket('wss://kb09dca09l.execute-api.us-east-1.amazonaws.com/prod?userId=test&roomId=test');
ws.onopen = () => console.log('✅ Conectado');
ws.onerror = (e) => console.error('❌ Erro:', e);
```

**Se Lambda não processa:**
1. Verifique logs no CloudWatch
2. Lambda `audio-stream-processor` deve estar rodando
3. Verifique permissões do Lambda para Transcribe

---

### 3. 🔍 Debug Panel

#### Como Usar:
1. Clique no botão "🐛 Debug" (canto inferior direito)
2. Painel mostra:
   - ✅ WebSocket URL
   - ✅ Status da conexão
   - ✅ Room ID
   - ✅ User ID
   - ✅ Estado da transcrição
   - ✅ Contadores de mensagens/transcrições

#### O que verificar:
```
✅ WebSocket URL: wss://kb09dca09l...  (deve estar preenchido)
✅ Status: ✅ CONECTADO                (deve estar verde)
✅ Transcrição: 🎤 ATIVA               (quando ativada)
✅ Transcrições: 0 → 1 → 2...         (deve aumentar ao falar)
```

---

## 🧪 Testes Manuais

### Teste 1: Conexão WebSocket
```bash
# Terminal
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  wss://kb09dca09l.execute-api.us-east-1.amazonaws.com/prod
```

### Teste 2: Lambda Connection Handler
```bash
# Verificar logs
aws logs tail /aws/lambda/chat-colaborativo-prod-connection-handler --follow
```

### Teste 3: Lambda Audio Processor
```bash
# Verificar logs
aws logs tail /aws/lambda/chat-colaborativo-prod-audio-stream-processor --follow
```

---

## 📊 Logs Esperados

### Console do Navegador (Sucesso):
```javascript
[WebSocket] Conectando em: wss://kb09dca09l...
[WebSocket] ✅ Conectado com sucesso!
[AudioStream] Gravação iniciada
[AudioStream] Chunk capturado: 8192 bytes
[AudioStream] Enviando chunk base64, tamanho: 10924
[Audio] Enviando dados de áudio: { roomId: "room_abc", userId: "user_xyz", dataLength: 10924 }
[WebSocket] Mensagem recebida: { type: 'transcription', data: {...} }
[WebSocket] Nova transcrição: { transcribedText: "olá", userId: "user_xyz", ... }
```

### Console do Navegador (Erro):
```javascript
❌ [WebSocket] URL ou userId não definidos: { url: undefined, userId: "user_xyz" }
// Solução: Verificar .env

❌ [WebSocket] 🔴 Desconectado: { code: 1006, reason: "" }
// Solução: WebSocket API não está respondendo

❌ NotAllowedError: Permission denied
// Solução: Permitir microfone
```

---

## 🔧 Comandos Úteis

### Reiniciar Servidor:
```bash
# Parar (Ctrl+C) e depois:
cd frontend
npm run dev
```

### Limpar Cache:
```bash
cd frontend
rm -rf node_modules/.vite
rm -rf dist
npm run dev
```

### Verificar Variáveis de Ambiente:
```bash
cd frontend
cat .env
# Deve mostrar VITE_* (não REACT_APP_*)
```

### Testar Build:
```bash
cd frontend
npm run build
# Deve compilar sem erros
```

---

## 📱 Teste em Diferentes Navegadores

### Chrome/Edge (Recomendado):
- ✅ Melhor suporte WebRTC
- ✅ Web Audio API completa
- ✅ Permissões claras

### Firefox:
- ✅ Funciona bem
- ⚠️ Pode ter delay em indicadores de áudio

### Safari:
- ⚠️ Requer interação do usuário para AudioContext
- ⚠️ Permissões mais restritivas
- ⚠️ Pode não funcionar em modo privado

---

## 🆘 Checklist de Diagnóstico

Quando algo não funciona, verifique na ordem:

- [ ] 1. Servidor local rodando? (http://localhost:3000/)
- [ ] 2. Console sem erros? (F12)
- [ ] 3. `.env` com `VITE_*` correto?
- [ ] 4. Debug Panel mostra URL preenchida?
- [ ] 5. Debug Panel mostra "✅ CONECTADO"?
- [ ] 6. Permissão de microfone concedida?
- [ ] 7. Botão "Transcrever" está vermelho?
- [ ] 8. Debug Panel mostra "🎤 ATIVA"?
- [ ] 9. Console mostra "[AudioStream] Gravação iniciada"?
- [ ] 10. Console mostra chunks sendo enviados?
- [ ] 11. Console mostra transcrições recebidas?
- [ ] 12. Contador de transcrições aumenta?

---

## 📞 Suporte

### Logs Importantes:
1. **Console do Navegador** (F12)
2. **Debug Panel** (botão 🐛)
3. **CloudWatch Logs** (AWS)

### Informações para Reportar:
- Navegador e versão
- Sistema operacional
- Mensagens de erro do console
- Screenshot do Debug Panel
- Logs do CloudWatch (se tiver acesso)

---

## ✅ Status Atual

### Implementado:
- ✅ Debug Panel com informações em tempo real
- ✅ Logs detalhados no console
- ✅ Correção de variáveis de ambiente (.env)
- ✅ Validação de WebSocket URL
- ✅ Indicadores visuais de conexão

### Próximos Passos:
1. Testar com Debug Panel aberto
2. Verificar logs no console
3. Confirmar se WebSocket conecta
4. Testar transcrição com microfone
5. Verificar se transcrições aparecem

---

**Última Atualização**: 16/12/2024  
**Servidor Local**: http://localhost:3000/  
**Debug Panel**: Clique no botão 🐛 no canto inferior direito
