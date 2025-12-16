# Documentação da API WebSocket

## Conexão

```
wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}?userId={userId}&roomId={roomId}
```

### Parâmetros de Query
- `userId` (obrigatório): ID único do usuário
- `roomId` (opcional): ID da sala para entrar automaticamente

## Rotas WebSocket

### 1. sendMessage
Enviar mensagem de texto para a sala.

**Payload:**
```json
{
  "action": "sendMessage",
  "roomId": "room_123",
  "userId": "user_456",
  "userName": "João Silva",
  "content": "Olá, pessoal!"
}
```

**Resposta:**
```json
{
  "type": "message",
  "data": {
    "messageId": "msg_789",
    "roomId": "room_123",
    "userId": "user_456",
    "userName": "João Silva",
    "content": "Olá, pessoal!",
    "timestamp": 1703001234567,
    "type": "text"
  }
}
```

### 2. sendAudio
Enviar chunk de áudio para transcrição.

**Payload:**
```json
{
  "action": "sendAudio",
  "roomId": "room_123",
  "userId": "user_456",
  "audioData": "base64_encoded_audio_data",
  "language": "pt-BR",
  "sessionId": "session_789"
}
```

**Resposta:**
```json
{
  "type": "transcription",
  "data": {
    "transcriptionId": "trans_123",
    "roomId": "room_123",
    "userId": "user_456",
    "transcribedText": "Olá, como vocês estão?",
    "confidence": 0.95,
    "speakerLabel": "spk_0",
    "timestamp": 1703001234567,
    "isPartial": false
  }
}
```

### 3. manageRoom
Gerenciar salas de chat.

**Criar Sala:**
```json
{
  "action": "manageRoom",
  "operation": "createRoom",
  "roomName": "Reunião de Projeto",
  "userId": "user_456",
  "participants": ["user_789", "user_012"]
}
```

**Entrar na Sala:**
```json
{
  "action": "manageRoom",
  "operation": "joinRoom",
  "roomId": "room_123",
  "userId": "user_456"
}
```

**Listar Salas:**
```json
{
  "action": "manageRoom",
  "operation": "listRooms"
}
```

### 4. getTranscriptions
Obter transcrições agregadas de uma sala.

**Payload:**
```json
{
  "action": "getTranscriptions",
  "roomId": "room_123",
  "startTime": 1703000000000,
  "endTime": 1703010000000
}
```

**Resposta:**
```json
{
  "type": "transcriptions",
  "data": {
    "roomId": "room_123",
    "transcriptions": [
      {
        "speaker": "spk_0",
        "segments": [...],
        "fullText": "Texto completo do falante"
      }
    ],
    "count": 42
  }
}
```

## Eventos Recebidos

### message
Nova mensagem de texto na sala.

### transcription
Nova transcrição de áudio disponível.

### participants
Lista atualizada de participantes na sala.

### ai-analysis
Resultado de análise de IA (resumo, sentimento, action items).

## Códigos de Status

- `200`: Sucesso
- `400`: Requisição inválida
- `403`: Não autorizado
- `404`: Recurso não encontrado
- `500`: Erro interno do servidor

## Configuração do Amazon Transcribe

```json
{
  "LanguageCode": "pt-BR",
  "MediaSampleRateHertz": 48000,
  "MediaEncoding": "pcm",
  "EnablePartialResultsStabilization": true,
  "PartialResultsStability": "high",
  "ShowSpeakerLabel": true,
  "MaxSpeakerLabels": 5
}
```

## Limites

- Tamanho máximo de mensagem: 5000 caracteres
- Tamanho máximo de chunk de áudio: 10MB
- Conexões simultâneas por sala: 100
- Taxa de mensagens: 10 msg/segundo por conexão
