# 🧪 Teste Local - Chat Colaborativo

## ✅ Servidor Rodando

**URL Local**: http://localhost:3000/

## 🎯 Novas Funcionalidades Implementadas

### 1. URLs Únicas por Sala
- Ao criar uma sala, uma URL única é gerada
- Exemplo: `http://localhost:3000/room/room_abc123xyz`
- Compartilhe essa URL com outros participantes
- Todos que acessarem a mesma URL entrarão na mesma sala

### 2. Página Inicial
- **Criar Nova Sala**: Gera uma sala com ID único
- **Entrar na Sala**: Digite o ID de uma sala existente

### 3. Botão de Transcrição
- Botão no header para ativar/desativar transcrição
- Quando ativo: vermelho "Parar Transcrição"
- Quando inativo: branco "Iniciar Transcrição"

### 4. Logs de Debug
- Abra o Console do navegador (F12)
- Veja logs detalhados de:
  - Mensagens WebSocket recebidas
  - Dados de áudio enviados
  - Transcrições recebidas
  - Participantes atualizados

## 📋 Como Testar

### Teste 1: Criar e Entrar em Sala
1. Acesse http://localhost:3000/
2. Clique em "Criar Nova Sala"
3. Observe a URL mudar para `/room/room_XXXXXXX`
4. Copie a URL completa
5. Abra em outra aba/navegador
6. Cole a URL
7. ✅ Ambas as abas devem estar na mesma sala

### Teste 2: Transcrição
1. Entre em uma sala
2. Abra o Console (F12)
3. Clique em "Iniciar Transcrição" no header
4. Permita acesso ao microfone
5. Fale algo
6. Observe no console:
   ```
   [Audio] Enviando dados de áudio: { roomId, userId, dataLength }
   ```
7. Aguarde resposta do WebSocket:
   ```
   [WebSocket] Nova transcrição: { ... }
   ```
8. ✅ Transcrição deve aparecer na seção inferior

### Teste 3: Múltiplos Participantes
1. Crie uma sala na aba 1
2. Copie o link (botão "Copiar Link")
3. Abra em aba 2
4. Cole o link
5. ✅ Ambas devem ver o contador de participantes aumentar
6. ✅ Vídeos devem aparecer em ambas as abas

### Teste 4: Indicadores Visuais
1. Entre em sala com 2 abas
2. Fale na aba 1
3. ✅ Borda verde deve aparecer no vídeo da aba 2
4. ✅ Ícone de microfone deve aparecer

## 🔍 Verificar Logs

### Console do Navegador:
```javascript
// Ao conectar
[WebSocket] Mensagem recebida: { type: 'connected', ... }

// Ao enviar mensagem
[WebSocket] Mensagem recebida: { type: 'message', data: { ... } }

// Ao receber transcrição
[WebSocket] Nova transcrição: { 
  transcriptionId: "...",
  userId: "...",
  transcribedText: "...",
  timestamp: 1234567890
}

// Ao enviar áudio
[Audio] Enviando dados de áudio: { 
  roomId: "room_abc123",
  userId: "user_xyz789",
  dataLength: 8192
}
```

## 🐛 Troubleshooting

### Problema: Transcrição não aparece
**Verificar:**
1. Console mostra `[Audio] Enviando dados de áudio`?
   - ❌ Não: Microfone não está capturando
   - ✅ Sim: Continue

2. Console mostra `[WebSocket] Nova transcrição`?
   - ❌ Não: Lambda não está processando
   - ✅ Sim: Transcrição está chegando

3. Componente LiveTranscription está renderizando?
   - Verifique se `transcriptions.length > 0`
   - Verifique props passadas

### Problema: Vídeo não conecta
**Verificar:**
1. Permissões de câmera/microfone concedidas?
2. Ambas as abas na mesma sala (mesmo roomId)?
3. WebSocket conectado (🟢 Conectado no header)?

### Problema: URL não muda
**Verificar:**
1. React Router instalado? `npm list react-router-dom`
2. BrowserRouter envolvendo App?
3. Navegação usando `navigate()`?

## 📊 Estrutura de Dados

### Transcrição:
```typescript
interface Transcription {
  transcriptionId: string;
  userId: string;
  transcribedText: string;
  timestamp: number;
  speakerLabel?: string;
  isPartial?: boolean;
}
```

### Mensagem WebSocket:
```typescript
{
  type: 'transcription',
  data: {
    transcriptionId: "trans_123",
    userId: "user_abc",
    transcribedText: "Olá, como vai?",
    timestamp: 1734374400000,
    speakerLabel: "Usuário 1234"
  }
}
```

## 🔧 Comandos Úteis

### Parar servidor:
```bash
# Ctrl+C no terminal ou
# Usar Kiro para parar o processo
```

### Limpar cache:
```bash
rm -rf frontend/node_modules/.vite
```

### Reinstalar dependências:
```bash
cd frontend
npm install
```

## 📝 Checklist de Teste

- [ ] Página inicial carrega
- [ ] Botão "Criar Nova Sala" funciona
- [ ] URL muda para `/room/room_XXXXX`
- [ ] Botão "Copiar Link" funciona
- [ ] Entrar com link copiado funciona
- [ ] Múltiplas abas na mesma sala
- [ ] Contador de participantes correto
- [ ] Vídeos aparecem
- [ ] Botão "Iniciar Transcrição" funciona
- [ ] Logs aparecem no console
- [ ] Transcrições aparecem na interface
- [ ] Indicadores de fala funcionam
- [ ] Toasts aparecem

## 🎯 Próximos Passos

Após testar localmente:
1. Build: `npm run build`
2. Deploy para S3
3. Invalidar CloudFront (cache desabilitado)
4. Testar em produção

---

**Servidor Local**: http://localhost:3000/  
**Status**: ✅ Rodando  
**Porta**: 3000
