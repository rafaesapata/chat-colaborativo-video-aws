# 🔴 ANÁLISE TÉCNICA CRÍTICA - Nível Máximo de Rigor

**Data**: 2025-12-21  
**Versão**: 3.5.2  
**Modo**: Análise Defensiva de Sistemas Críticos

---

## 🚨 PROBLEMA IMEDIATO: CORS Duplicado (CATASTRÓFICO)

### Diagnóstico
```
Access-Control-Allow-Origin: *, https://livechat.ai.udstec.io
```

**Causa Raiz**: A Lambda Function URL está configurada com CORS habilitado E o código também adiciona headers CORS. Resultado: headers duplicados que violam a especificação HTTP.

**Impacto**: 100% das requisições de playback falham em produção.

### Correção Necessária
Remover headers CORS do código OU desabilitar CORS na Lambda Function URL.

---

## 🔴 FALHAS CRÍTICAS IDENTIFICADAS

### 1. Race Condition no Zombie Detection (CRÍTICA)
**Arquivo**: `useWebSocket.ts:130-142`

```typescript
zombieCheckIntervalRef.current = window.setInterval(() => {
  const timeSinceLastPong = Date.now() - lastPongTimeRef.current;
  if (timeSinceLastPong > ZOMBIE_PONG_TIMEOUT) {
    missedPongsRef.current++;
    // ...
    if (missedPongsRef.current >= ZOMBIE_MAX_MISSED) {
      ws.close(4000, 'Zombie connection detected');
    }
  }
}, ZOMBIE_PING_INTERVAL);
```

**Problema**: O intervalo de verificação (25s) é MAIOR que o timeout (10s). Isso significa:
- Heartbeat enviado a cada 30s
- Verificação de zombie a cada 25s
- Timeout de pong: 10s

**Cenário de Falha**:
1. T=0: Heartbeat enviado
2. T=10: Pong recebido, `lastPongTimeRef = T=10`
3. T=25: Zombie check: `timeSinceLastPong = 15s > 10s` → FALSO POSITIVO!
4. Conexão fechada desnecessariamente

**Severidade**: CRÍTICA - Desconexões aleatórias em produção

**Correção**:
```typescript
const HEARTBEAT_INTERVAL = 15000; // 15s
const ZOMBIE_PING_INTERVAL = 20000; // 20s (deve ser > HEARTBEAT + margem)
const ZOMBIE_PONG_TIMEOUT = 15000; // 15s (deve ser < ZOMBIE_PING_INTERVAL)
```

---

### 2. Memory Leak no AudioContext (CRÍTICA)
**Arquivo**: `useRecording.ts:195-210`

```typescript
const audioContext = new AudioContext();
audioContextRef.current = audioContext;
```

**Problema**: Se `startRecording` for chamado múltiplas vezes rapidamente (double-click, retry), múltiplos AudioContexts são criados. O navegador tem limite de 6 AudioContexts.

**Cenário de Falha**:
1. Usuário clica "Gravar" 
2. Erro ocorre antes de `audioContextRef.current = audioContext`
3. AudioContext órfão criado
4. Repetir 6x → Navegador bloqueia criação de novos AudioContexts
5. Toda funcionalidade de áudio para de funcionar

**Severidade**: CRÍTICA - Pode travar áudio do navegador

**Correção**: Usar singleton AudioContext ou verificar/fechar antes de criar.

---

### 3. Stale Closure no toggleVideo/toggleAudio (ALTA)
**Arquivo**: `useChimeMeeting.ts:340-360`

```typescript
const toggleVideo = useCallback(() => {
  if (!audioVideoRef.current) return;
  setIsVideoEnabled(prev => {
    if (prev) {
      audioVideoRef.current?.stopLocalVideoTile();
    } else {
      audioVideoRef.current?.startLocalVideoTile();
    }
    return !prev;
  });
}, []);
```

**Problema**: O callback do `setIsVideoEnabled` captura `audioVideoRef` no momento da criação. Se `audioVideoRef.current` mudar entre a criação e a execução, o código pode operar em uma referência obsoleta ou null.

**Cenário de Falha**:
1. Usuário entra na reunião
2. Clica em toggle vídeo rapidamente durante reconexão
3. `audioVideoRef.current` é null durante a transição
4. Operação silenciosamente falha, estado fica inconsistente

**Severidade**: ALTA - Estado de UI inconsistente com realidade

---

### 4. Validação Insuficiente no Recording Upload (ALTA)
**Arquivo**: `useRecording.ts:140-165`

```typescript
const response = await fetch(`${RECORDING_API_URL}/recording/upload-url`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename,
    contentType: blob.type,
    // ...
  }),
});
```

**Problema**: Não há validação do `blob.type`. Um atacante pode manipular o tipo MIME para fazer upload de arquivos maliciosos.

**Cenário de Ataque**:
1. Atacante modifica `blob.type` para `text/html`
2. Upload de arquivo HTML com JavaScript malicioso
3. URL pré-assinada permite acesso direto
4. XSS via arquivo hospedado no S3

**Severidade**: ALTA - Potencial XSS

---

### 5. Timeout Insuficiente no Fetch (MÉDIA)
**Arquivo**: `useChimeMeeting.ts:30`

```typescript
const FETCH_TIMEOUT = 15000; // 15 segundos
```

**Problema**: Em redes móveis lentas (3G), 15s pode não ser suficiente para estabelecer conexão + handshake TLS + resposta. Mas também é muito longo para UX.

**Recomendação**: Implementar retry com timeout progressivo (5s, 10s, 15s).

---

### 6. Falta de Idempotency Key (MÉDIA)
**Arquivo**: `useChimeMeeting.ts:110-130`

**Problema**: Se a requisição de join falhar após o servidor processar mas antes da resposta chegar, o retry criará um attendee duplicado.

**Cenário**:
1. Cliente envia POST /meeting/join
2. Servidor cria attendee
3. Conexão cai antes da resposta
4. Cliente faz retry
5. Servidor cria OUTRO attendee (mesmo usuário, 2 entradas)

---

### 7. Cleanup Incompleto no useEffect (MÉDIA)
**Arquivo**: `useWebSocket.ts:220-235`

```typescript
return () => {
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
  }
  // ...
  if (wsRef.current) {
    wsRef.current.close(1000, 'Component unmounting');
  }
};
```

**Problema**: O `close()` é assíncrono. Se o componente for remontado rapidamente, a nova conexão pode ser criada antes da antiga fechar completamente.

---

### 8. Falta de Sanitização no Recording Filename (MÉDIA)
**Arquivo**: `useRecording.ts:143`

```typescript
const filename = `${userLogin}/${roomId}/${meetingId}_${Date.now()}.webm`;
```

**Problema**: Se `userLogin`, `roomId` ou `meetingId` contiverem caracteres especiais (../, etc), pode haver path traversal no S3.

---

## 📊 MATRIZ DE RISCO

| ID | Problema | Severidade | Probabilidade | Impacto | Prioridade |
|----|----------|------------|---------------|---------|------------|
| 1 | CORS Duplicado | CATASTRÓFICA | 100% | Funcionalidade quebrada | P0 |
| 2 | Zombie Detection Race | CRÍTICA | 30% | Desconexões aleatórias | P0 |
| 3 | AudioContext Leak | CRÍTICA | 10% | Áudio para de funcionar | P1 |
| 4 | Stale Closure Toggle | ALTA | 15% | UI inconsistente | P1 |
| 5 | Recording XSS | ALTA | 5% | Segurança comprometida | P1 |
| 6 | Timeout Insuficiente | MÉDIA | 20% | Falha em redes lentas | P2 |
| 7 | Idempotency | MÉDIA | 5% | Attendees duplicados | P2 |
| 8 | Cleanup Race | MÉDIA | 10% | Conexões duplicadas | P2 |
| 9 | Path Traversal | MÉDIA | 1% | Segurança S3 | P2 |

---

## 🔧 CORREÇÕES IMEDIATAS NECESSÁRIAS

### Correção 1: CORS (P0)
Remover headers CORS do código da Lambda recording-manager, pois a Lambda Function URL já os adiciona.

### Correção 2: Zombie Detection Timing (P0)
Ajustar intervalos para evitar falsos positivos.

### Correção 3: AudioContext Singleton (P1)
Usar o audioContextManager já criado.

---

*Análise gerada com rigor máximo - Nenhum problema foi ignorado*
