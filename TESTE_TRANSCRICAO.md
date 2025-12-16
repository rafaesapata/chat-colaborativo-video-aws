# 🧪 Como Testar Transcrições

## 🎯 Problema: Transcrições não aparecem

### ✅ Solução: Botão de Teste Adicionado!

Adicionei um botão **"🧪 Testar Transcrição"** para você testar sem precisar do Lambda.

---

## 📍 Onde Encontrar

### 1. Botão de Teste
- **Localização**: Canto inferior direito (acima do botão Debug)
- **Cor**: Roxo
- **Texto**: "🧪 Testar Transcrição"

### 2. Painel de Transcrições
- **Localização**: Painel direito, abaixo do vídeo
- **Título**: "Transcrição em Tempo Real"
- **Ícone**: 📝

---

## 🧪 Como Testar (Passo a Passo)

### Teste 1: Adicionar Transcrição Manual
1. Acesse http://localhost:3000/
2. Entre em uma sala
3. Clique no botão **"🧪 Testar Transcrição"** (roxo, canto inferior direito)
4. Painel roxo abre com 5 opções de texto
5. Clique em qualquer texto (ex: "Olá, como estão todos?")
6. ✅ Transcrição deve aparecer no painel direito

### Teste 2: Adicionar Todas Automaticamente
1. No painel de teste, clique em **"▶️ Adicionar Todas (1s cada)"**
2. 5 transcrições serão adicionadas automaticamente (1 por segundo)
3. ✅ Você verá as transcrições aparecendo uma por uma

### Teste 3: Verificar Logs
1. Abra Console (F12)
2. Adicione uma transcrição de teste
3. Procure por:
   ```javascript
   [TEST] Transcrição adicionada: "Olá, como estão todos?"
   [LiveTranscription] Transcrições atualizadas: 1
   ```

### Teste 4: Verificar Debug Panel
1. Clique no botão **"🐛 Debug"**
2. Verifique "Transcrições: 0 → 1 → 2..."
3. Contador deve aumentar ao adicionar transcrições

---

## 🔍 O que Verificar

### ✅ Funcionando Corretamente:
- [ ] Botão "🧪 Testar Transcrição" aparece
- [ ] Painel roxo abre ao clicar
- [ ] Transcrições aparecem no painel direito
- [ ] Contador no Debug Panel aumenta
- [ ] Logs aparecem no Console
- [ ] Scroll automático funciona
- [ ] Cores diferentes por usuário
- [ ] Timestamps aparecem

### ❌ Se Não Funcionar:
1. **Botão não aparece**:
   - Recarregue a página (Ctrl+R)
   - Verifique se está em uma sala (não na home)

2. **Transcrições não aparecem**:
   - Abra Console (F12)
   - Procure por erros
   - Verifique se componente está montado:
     ```javascript
     [LiveTranscription] Componente montado
     ```

3. **Painel vazio**:
   - Verifique se está no painel direito (ao lado do vídeo)
   - Role para baixo se necessário
   - Adicione transcrição de teste

---

## 📊 Layout da Tela

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar  │  Header                                     │
├───────────┼─────────────────────────────────────────────┤
│           │                                             │
│  Canais   │  Mensagens                │  Vídeo         │
│           │                            │                │
│  Users    │                            │  ┌──────────┐ │
│           │                            │  │ Vídeos   │ │
│           │                            │  └──────────┘ │
│           │                            │                │
│           │                            │  ┌──────────┐ │
│           │                            │  │📝 Trans- │ │
│           │                            │  │  crição  │ │
│           │                            │  └──────────┘ │
└───────────┴────────────────────────────┴────────────────┘
                                              ↑
                                    Transcrições aqui!
```

---

## 🎤 Testar com Áudio Real

### Pré-requisitos:
1. WebSocket conectado (🟢 no Debug Panel)
2. Lambda `audio-stream-processor` funcionando
3. Permissão de microfone concedida

### Passos:
1. Clique em **"Transcrever"** no header
2. Botão fica vermelho "Gravando"
3. Permita acesso ao microfone
4. Fale algo em português
5. Aguarde 2-3 segundos
6. Verifique Console:
   ```javascript
   [AudioStream] Gravação iniciada
   [AudioStream] Chunk capturado: 8192 bytes
   [Audio] Enviando dados de áudio: {...}
   ```
7. Se Lambda processar, verá:
   ```javascript
   [WebSocket] Nova transcrição: { transcribedText: "..." }
   ```

---

## 🐛 Troubleshooting

### Problema: Botão de teste não aparece
**Solução**:
```bash
# Limpar cache e reiniciar
cd frontend
rm -rf node_modules/.vite
npm run dev
```

### Problema: Transcrições não aparecem no painel
**Verificar**:
1. Console mostra `[LiveTranscription] Componente montado`?
2. Console mostra `[TEST] Transcrição adicionada`?
3. Debug Panel mostra contador aumentando?

**Se sim mas não aparece visualmente**:
- Verifique se está olhando no painel direito
- Role para baixo no painel de transcrições
- Recarregue a página

### Problema: Áudio real não transcreve
**Verificar**:
1. WebSocket conectado? (Debug Panel)
2. Lambda funcionando? (CloudWatch Logs)
3. Microfone permitido? (Ícone no navegador)
4. Chunks sendo enviados? (Console)

---

## 📝 Logs Esperados

### Ao Adicionar Transcrição de Teste:
```javascript
[TEST] Transcrição adicionada: "Olá, como estão todos?"
[LiveTranscription] Transcrições atualizadas: 1
```

### Ao Montar Componente:
```javascript
[LiveTranscription] Componente montado
```

### Ao Receber do WebSocket:
```javascript
[WebSocket] Nova transcrição: {
  transcriptionId: "trans_123",
  userId: "user_abc",
  transcribedText: "olá",
  timestamp: 1734374400000
}
[LiveTranscription] Transcrições atualizadas: 1
```

---

## ✅ Checklist de Teste

- [ ] Servidor local rodando (http://localhost:3000/)
- [ ] Entrei em uma sala
- [ ] Botão "🧪 Testar Transcrição" aparece
- [ ] Cliquei no botão e painel abriu
- [ ] Adicionei uma transcrição de teste
- [ ] Transcrição apareceu no painel direito
- [ ] Contador no Debug Panel aumentou
- [ ] Logs aparecem no Console
- [ ] Testei "Adicionar Todas"
- [ ] Todas as 5 transcrições apareceram

---

## 🎉 Resultado Esperado

Após clicar em "Adicionar Todas":
```
┌─────────────────────────────────┐
│ 📝 Transcrição em Tempo Real    │
├─────────────────────────────────┤
│ 🎤 Teste         16:48:00       │
│ Olá, como estão todos?          │
├─────────────────────────────────┤
│ Teste            16:48:01       │
│ Bom dia equipe!                 │
├─────────────────────────────────┤
│ Teste            16:48:02       │
│ Vamos começar a reunião         │
├─────────────────────────────────┤
│ Teste            16:48:03       │
│ Alguém tem alguma dúvida?       │
├─────────────────────────────────┤
│ Teste            16:48:04       │
│ Perfeito, obrigado!             │
└─────────────────────────────────┘
```

---

**Teste agora e me avise se as transcrições aparecem!** 🚀

**Botões**:
- 🐛 Debug (canto inferior direito)
- 🧪 Testar Transcrição (acima do Debug)

**Painel**: Lado direito, abaixo do vídeo
