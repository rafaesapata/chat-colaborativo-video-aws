# Arquitetura do Sistema

## Visão Geral

```
┌─────────────┐
│   Cliente   │
│  (React)    │
└──────┬──────┘
       │ WebSocket
       ▼
┌─────────────────────────────────────┐
│   API Gateway WebSocket             │
│   - $connect / $disconnect          │
│   - sendMessage / sendAudio         │
│   - manageRoom                      │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Lambda Functions                  │
│   ┌─────────────────────────────┐   │
│   │ connection-handler          │   │
│   │ message-handler             │   │
│   │ audio-stream-processor      │   │
│   │ transcription-aggregator    │   │
│   │ ai-analysis                 │   │
│   │ room-manager                │   │
│   └─────────────────────────────┘   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Serviços AWS                      │
│   ┌─────────────────────────────┐   │
│   │ DynamoDB (5 tabelas)        │   │
│   │ S3 (áudio storage)          │   │
│   │ Transcribe (streaming)      │   │
│   │ Bedrock (IA)                │   │
│   │ Cognito (auth)              │   │
│   │ CloudWatch (logs)           │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Componentes Principais

### 1. Frontend (React + TypeScript)
- Interface de usuário responsiva
- WebSocket client para comunicação em tempo real
- WebRTC para captura de áudio
- Componentes modulares

### 2. API Gateway WebSocket
- Gerenciamento de conexões persistentes
- Roteamento de mensagens
- Autenticação via query parameters

### 3. Lambda Functions

#### connection-handler
- Gerencia conexões WebSocket ($connect/$disconnect)
- Atualiza status online/offline dos usuários
- Registra connectionId no DynamoDB

#### message-handler
- Processa mensagens de texto
- Sanitiza conteúdo
- Broadcast para participantes da sala

#### audio-stream-processor
- Recebe chunks de áudio
- Envia para Amazon Transcribe Streaming
- Salva áudio no S3
- Armazena transcrições no DynamoDB

#### transcription-aggregator
- Agrega transcrições por falante
- Formata e envia via WebSocket
- Trigger análise de IA

#### ai-analysis
- Invoca Amazon Bedrock (Claude)
- Gera resumos automáticos
- Análise de sentimento
- Extração de action items

#### room-manager
- CRUD de salas de chat
- Gerenciamento de participantes
- Controle de permissões

### 4. DynamoDB

#### Tabela: Users
```
PK: userId
Atributos: nome, email, status, connectionId, lastSeen
GSI: EmailIndex (email)
```

#### Tabela: ChatRooms
```
PK: roomId
Atributos: nome, creatorId, participants[], createdAt, active
GSI: CreatedAtIndex (createdAt)
```

#### Tabela: Messages
```
PK: messageId
Atributos: roomId, userId, content, timestamp, type
GSI: RoomMessagesIndex (roomId + timestamp)
```

#### Tabela: Transcriptions
```
PK: transcriptionId
Atributos: roomId, userId, audioUrl, transcribedText, timestamp, speakerLabel
GSI: RoomTranscriptionsIndex (roomId + timestamp)
```

#### Tabela: Connections
```
PK: connectionId
Atributos: userId, roomId, connectedAt, ttl
GSI: UserConnectionsIndex (userId + connectedAt)
```

## Fluxo de Dados

### Fluxo de Mensagem de Texto
1. Cliente envia mensagem via WebSocket
2. API Gateway roteia para message-handler
3. Lambda valida e salva no DynamoDB
4. Lambda busca conexões da sala
5. Broadcast para todos os participantes

### Fluxo de Transcrição de Áudio
1. Cliente captura áudio (WebRTC)
2. Chunks enviados via WebSocket
3. audio-stream-processor recebe
4. Áudio enviado para Transcribe Streaming
5. Transcrição retorna em tempo real
6. Salva no DynamoDB e S3
7. Broadcast para participantes
8. Trigger análise de IA (se aplicável)

### Fluxo de Análise de IA
1. transcription-aggregator coleta transcrições
2. Invoca ai-analysis Lambda
3. Lambda chama Amazon Bedrock
4. IA processa e retorna insights
5. Resultados salvos no DynamoDB
6. Enviados para clientes via WebSocket

## Segurança

- Autenticação via AWS Cognito
- Tokens JWT validados
- Criptografia TLS em trânsito
- Criptografia AES-256 em repouso (S3/DynamoDB)
- IAM roles com least privilege
- Sanitização de inputs
- Rate limiting no API Gateway

## Escalabilidade

- Serverless: escala automaticamente
- DynamoDB: On-Demand billing
- Lambda: concorrência configurável
- API Gateway: 5000 conexões simultâneas por padrão
- CloudWatch: monitoramento e alertas

## Custos Estimados (5 usuários, 8h/dia)

- API Gateway WebSocket: ~$5/mês
- Lambda: ~$10/mês
- DynamoDB: ~$5/mês
- Transcribe: ~$30/mês
- Bedrock: ~$20/mês
- S3: ~$2/mês
- **Total: ~$72/mês**

## Monitoramento

- CloudWatch Logs: todas as Lambdas
- CloudWatch Metrics: latência, erros, throttling
- X-Ray: tracing distribuído
- Alarmes: erros > 1%, latência > 3s
