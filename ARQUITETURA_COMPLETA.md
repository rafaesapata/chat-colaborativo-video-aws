# 🏗️ Arquitetura Completa - Video Chat Colaborativo

## 📋 Visão Geral do Sistema

Sistema de videoconferência colaborativa 100% serverless na AWS, com transcrição em tempo real, análise de IA e gravação de reuniões.

**URL de Produção:** https://livechat.ai.udstec.io

---

## 🎯 Diagrama de Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USUÁRIOS                                              │
│                    (Navegadores Web - Chrome, Edge, Firefox)                            │
└─────────────────────────────────────┬───────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
            ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
            │   WebRTC      │ │   WebSocket   │ │   HTTPS       │
            │   (P2P)       │ │   (Signaling) │ │   (REST API)  │
            └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
                    │                 │                 │
                    │                 ▼                 ▼
                    │    ┌────────────────────────────────────────┐
                    │    │         AWS CLOUD (us-east-1)          │
                    │    └────────────────────────────────────────┘
                    │                 │                 │
                    │    ┌────────────┴────────────┐    │
                    │    ▼                         ▼    ▼
                    │ ┌─────────────────┐  ┌─────────────────────┐
                    │ │   CloudFront    │  │   API Gateway       │
                    │ │   (CDN + SSL)   │  │   WebSocket + HTTP  │
                    │ └────────┬────────┘  └──────────┬──────────┘
                    │          │                      │
                    │          ▼                      ▼
                    │ ┌─────────────────┐  ┌─────────────────────┐
                    │ │   S3 Bucket     │  │   Lambda Functions  │
                    │ │   (Frontend)    │  │   (8 funções)       │
                    │ └─────────────────┘  └──────────┬──────────┘
                    │                                 │
                    │         ┌───────────────────────┼───────────────────────┐
                    │         │                       │                       │
                    │         ▼                       ▼                       ▼
                    │  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
                    │  │  DynamoDB   │        │     S3      │        │   Cognito   │
                    │  │  (7 tabelas)│        │  (Storage)  │        │   (Auth)    │
                    │  └─────────────┘        └─────────────┘        └─────────────┘
                    │                                │
                    │                    ┌───────────┴───────────┐
                    │                    ▼                       ▼
                    │            ┌─────────────┐        ┌─────────────┐
                    │            │  Transcribe │        │   Bedrock   │
                    │            │  (Speech)   │        │   (Claude)  │
                    │            └─────────────┘        └─────────────┘
                    │
                    └──────────────────────────────────────────────────────────────────────
                                    (Conexão P2P direta entre usuários)
```

---

## 🔧 Componentes AWS Detalhados

### 1. 🌐 Camada de Distribuição (Edge)

#### CloudFront Distribution
- **ID:** `E19FZWDK7MJWSX`
- **Domain:** `dmz2oaky7xb1w.cloudfront.net`
- **Custom Domain:** `livechat.ai.udstec.io`
- **Função:** CDN para distribuição global do frontend
- **Configurações:**
  - Origin Access Control (OAC) para S3
  - HTTPS obrigatório (redirect HTTP → HTTPS)
  - Cache TTL = 0 (desenvolvimento)
  - Custom Error Pages (403/404 → index.html para SPA)
  - Price Class: PriceClass_100 (América do Norte e Europa)

#### Route53 (DNS)
- **Hosted Zone:** `ai.udstec.io`
- **Record:** `livechat.ai.udstec.io` → CloudFront
- **Tipo:** ALIAS record

#### ACM (Certificado SSL)
- **Domínio:** `*.ai.udstec.io`
- **Região:** us-east-1 (obrigatório para CloudFront)

---

### 2. 🔌 Camada de APIs

#### API Gateway WebSocket
- **URL:** `wss://y08b6lfdel.execute-api.us-east-1.amazonaws.com/prod`
- **Protocolo:** WebSocket
- **Rotas:**
  | Rota | Lambda | Descrição |
  |------|--------|-----------|
  | `$connect` | connection-handler | Conexão inicial |
  | `$disconnect` | connection-handler | Desconexão |
  | `sendMessage` | message-handler | Mensagens de chat |
  | `sendAudio` | audio-stream-processor | Streaming de áudio |
  | `manageRoom` | room-manager | Gerenciamento de salas |
  | `webrtc-signal` | message-handler | Sinalização WebRTC |

- **Throttling:**
  - Burst Limit: 5000 requests
  - Rate Limit: 2000 requests/segundo

#### HTTP API (Recording)
- **Protocolo:** HTTP/2
- **Rotas:**
  | Método | Rota | Lambda | Descrição |
  |--------|------|--------|-----------|
  | POST | `/recording/upload-url` | recording-manager | URL pré-assinada para upload |
  | POST | `/recording/playback-url` | recording-manager | URL pré-assinada para playback |
  | POST | `/recording/list` | recording-manager | Listar gravações do usuário |
  | POST | `/turn/credentials` | turn-credentials | Credenciais TURN dinâmicas |

- **CORS:**
  - Origins: `https://livechat.ai.udstec.io`, `http://localhost:5173`
  - Methods: GET, POST, OPTIONS
  - Headers: Content-Type, Authorization

---

### 3. ⚡ Camada de Computação (Lambda Functions)

#### 3.1 connection-handler
```
Função: Gerenciamento de conexões WebSocket
Runtime: Node.js 18.x
Memória: 512 MB
Timeout: 30s
Triggers: $connect, $disconnect

Responsabilidades:
├── Registrar nova conexão no DynamoDB
├── Associar userId + roomId à conexão
├── Atualizar status do usuário (online/offline)
├── Notificar outros usuários da sala
├── Registrar eventos de entrada/saída
└── Limpar conexões stale (TTL)
```

#### 3.2 message-handler
```
Função: Processamento de mensagens e sinalização WebRTC
Runtime: Node.js 18.x
Memória: 512 MB
Timeout: 30s
Triggers: sendMessage, webrtc-signal

Responsabilidades:
├── Receber e sanitizar mensagens de chat
├── Persistir mensagens no DynamoDB
├── Broadcast para participantes da sala
├── Processar sinais WebRTC (offer/answer/ICE)
├── Rotear transcrições em tempo real
├── Responder a requests de lista de participantes
└── Implementar retry com exponential backoff
```

#### 3.3 audio-stream-processor
```
Função: Processamento de streaming de áudio
Runtime: Node.js 18.x
Memória: 1024 MB
Timeout: 300s (5 min)
Triggers: sendAudio

Responsabilidades:
├── Receber chunks de áudio via WebSocket
├── Enviar para Amazon Transcribe Streaming
├── Armazenar áudio no S3
├── Salvar transcrições no DynamoDB
└── Broadcast de transcrições parciais/finais
```

#### 3.4 transcription-aggregator
```
Função: Agregação e análise de transcrições
Runtime: Node.js 18.x
Memória: 512 MB
Timeout: 30s

Responsabilidades:
├── Agregar transcrições por falante
├── Formatar texto para exibição
├── Invocar ai-analysis para insights
└── Enviar resultados via WebSocket
```

#### 3.5 ai-analysis
```
Função: Análise de IA com Amazon Bedrock
Runtime: Node.js 18.x
Memória: 1024 MB
Timeout: 60s

Responsabilidades:
├── Invocar Claude 3 Sonnet via Bedrock
├── Gerar resumos automáticos
├── Análise de sentimento
├── Extração de action items
└── Salvar análises no DynamoDB
```

#### 3.6 room-manager
```
Função: Gerenciamento de salas de chat
Runtime: Node.js 18.x
Memória: 512 MB
Timeout: 30s
Triggers: manageRoom

Responsabilidades:
├── CRUD de salas de chat
├── Gerenciamento de participantes
├── Controle de permissões
└── Listagem de salas ativas
```

#### 3.7 recording-manager
```
Função: Gerenciamento de gravações
Runtime: Node.js 18.x
Memória: 256 MB
Timeout: 30s

Responsabilidades:
├── Gerar URLs pré-assinadas para upload (S3)
├── Gerar URLs pré-assinadas para playback
├── Salvar metadados no DynamoDB
├── Listar gravações por usuário
└── Validar permissões de acesso
```

#### 3.8 turn-credentials
```
Função: Credenciais TURN dinâmicas
Runtime: Node.js 18.x
Memória: 128 MB
Timeout: 10s

Responsabilidades:
├── Gerar credenciais temporárias TURN
├── Retornar lista de ICE servers
└── Cache de credenciais (TTL)
```

---

### 4. 💾 Camada de Dados (DynamoDB)

#### 4.1 Users Table
```
Nome: chat-colaborativo-serverless-Users
Billing: PAY_PER_REQUEST (On-Demand)

Schema:
├── PK: userId (String) - HASH
├── email (String)
├── connectionId (String)
├── roomId (String)
├── status (String) - online/offline
├── lastSeen (Number) - timestamp
└── ttl (Number) - expiração automática

GSI:
└── EmailIndex: email (HASH) → ALL

Features:
├── Point-in-Time Recovery: ✅
├── DynamoDB Streams: NEW_AND_OLD_IMAGES
└── TTL: 24 horas
```

#### 4.2 ChatRooms Table
```
Nome: chat-colaborativo-serverless-ChatRooms
Billing: PAY_PER_REQUEST

Schema:
├── PK: roomId (String) - HASH
├── nome (String)
├── creatorId (String)
├── participants (List)
├── createdAt (Number)
└── active (Boolean)

GSI:
└── CreatedAtIndex: createdAt (HASH) → ALL

Features:
├── Point-in-Time Recovery: ✅
└── DynamoDB Streams: NEW_AND_OLD_IMAGES
```

#### 4.3 Messages Table
```
Nome: chat-colaborativo-serverless-Messages
Billing: PAY_PER_REQUEST

Schema:
├── PK: messageId (String) - HASH
├── roomId (String)
├── userId (String)
├── userName (String)
├── content (String) - sanitizado
├── timestamp (Number)
├── type (String) - text/transcription
└── ttl (Number)

GSI:
└── RoomMessagesIndex: roomId (HASH) + timestamp (RANGE) → ALL

Features:
├── Point-in-Time Recovery: ✅
├── DynamoDB Streams: NEW_AND_OLD_IMAGES
└── TTL: 24 horas
```

#### 4.4 Transcriptions Table
```
Nome: chat-colaborativo-serverless-Transcriptions
Billing: PAY_PER_REQUEST

Schema:
├── PK: transcriptionId (String) - HASH
├── roomId (String)
├── userId (String)
├── userName (String)
├── text (String)
├── timestamp (Number)
├── speakerLabel (String)
├── type (String) - speech/ai-analysis
└── ttl (Number)

GSI:
└── RoomTranscriptionsIndex: roomId (HASH) + timestamp (RANGE) → ALL

Features:
├── Point-in-Time Recovery: ✅
├── DynamoDB Streams: NEW_AND_OLD_IMAGES
└── TTL: 30 dias
```

#### 4.5 Connections Table
```
Nome: chat-colaborativo-serverless-Connections
Billing: PAY_PER_REQUEST

Schema:
├── PK: connectionId (String) - HASH
├── userId (String)
├── roomId (String)
├── connectedAt (Number)
└── ttl (Number)

GSIs:
├── UserConnectionsIndex: userId (HASH) + connectedAt (RANGE) → ALL
└── RoomConnectionsIndex: roomId (HASH) + connectedAt (RANGE) → ALL

Features:
├── Point-in-Time Recovery: ✅
└── TTL: 24 horas
```

#### 4.6 RoomEvents Table
```
Nome: chat-colaborativo-serverless-RoomEvents
Billing: PAY_PER_REQUEST

Schema:
├── PK: eventId (String) - HASH
├── roomId (String)
├── eventType (String) - user_joined/user_left
├── userId (String)
├── timestamp (Number)
├── participantCount (Number)
└── ttl (Number)

GSI:
└── RoomEventsIndex: roomId (HASH) + timestamp (RANGE) → ALL

Features:
├── Point-in-Time Recovery: ✅
└── TTL: 30 dias
```

#### 4.7 Recordings Table
```
Nome: chat-colaborativo-serverless-Recordings
Billing: PAY_PER_REQUEST

Schema:
├── PK: recordingId (String) - HASH
├── userLogin (String)
├── roomId (String)
├── meetingId (String)
├── recordingKey (String) - S3 key
├── duration (Number) - segundos
├── createdAt (Number)
├── status (String) - uploading/completed
└── ttl (Number)

GSI:
└── UserRecordingsIndex: userLogin (HASH) + createdAt (RANGE) → ALL

Features:
├── Point-in-Time Recovery: ✅
└── TTL: 90 dias
```

---

### 5. 📦 Camada de Storage (S3)

#### 5.1 Frontend Bucket
```
Nome: chat-colaborativo-prod-frontend-383234048592
Região: us-east-1

Configuração:
├── Website Hosting: index.html / index.html (error)
├── Encryption: AES-256 (SSE-S3)
├── Versioning: Desabilitado
├── Public Access: Bloqueado
└── Access: Via CloudFront OAC

Conteúdo:
├── index.html
└── assets/
    ├── *.js (React bundle)
    ├── *.css (Tailwind)
    └── *.svg (ícones)
```

#### 5.2 Audio Bucket
```
Nome: chat-colaborativo-serverless-audio-{account-id}
Região: us-east-1

Configuração:
├── Encryption: AES-256 (SSE-S3)
├── Versioning: Habilitado
├── Public Access: Bloqueado
├── Lifecycle: Expiração em 90 dias
└── CORS: Habilitado para frontend

Estrutura:
└── audio/
    └── {roomId}/
        └── {timestamp}_{userId}.webm
```

#### 5.3 Recordings Bucket
```
Nome: chat-colaborativo-serverless-recordings-{account-id}
Região: us-east-1

Configuração:
├── Encryption: AES-256 (SSE-S3)
├── Versioning: Habilitado
├── Public Access: Bloqueado
├── Lifecycle: Expiração em 90 dias
└── CORS: Origins específicos

Estrutura:
└── recordings/
    └── {userLogin}/
        └── {roomId}/
            └── {meetingId}_{timestamp}.webm
```

---

### 6. 🔐 Camada de Autenticação (Cognito)

#### User Pool
```
Nome: chat-colaborativo-serverless-users
Região: us-east-1

Configuração:
├── Auto-verified: email
├── Required Attributes: email, name
├── Password Policy:
│   ├── Mínimo: 8 caracteres
│   ├── Uppercase: ✅
│   ├── Lowercase: ✅
│   ├── Numbers: ✅
│   └── Symbols: ✅
├── Account Recovery: verified_email
└── MFA: Opcional

Token Validity:
├── Access Token: 60 minutos
├── ID Token: 60 minutos
└── Refresh Token: 30 dias

Auth Flows:
├── ALLOW_USER_SRP_AUTH
├── ALLOW_REFRESH_TOKEN_AUTH
└── ALLOW_USER_PASSWORD_AUTH
```

#### User Pool Client
```
Nome: chat-colaborativo-serverless-client
Generate Secret: Não
Prevent User Existence Errors: Habilitado
```

---

### 7. 🤖 Serviços de IA

#### Amazon Transcribe Streaming
```
Uso: Transcrição de áudio em tempo real
Idiomas: pt-BR, en-US
Latência: < 3 segundos
Speaker Identification: Até 5 falantes

Fluxo:
1. Frontend captura áudio via Web Audio API
2. Chunks enviados via WebSocket
3. Lambda processa e envia para Transcribe
4. Transcrições parciais retornam em tempo real
5. Transcrições finais persistidas no DynamoDB
```

#### Amazon Bedrock (Claude 3 Sonnet)
```
Modelo: anthropic.claude-3-sonnet-20240229-v1:0
Uso: Análise inteligente de reuniões

Funcionalidades:
├── Resumos automáticos de reuniões
├── Análise de sentimento
├── Extração de action items
├── Busca semântica em transcrições
└── Sugestões de perguntas (entrevistas)

Configuração:
├── Max Tokens: 2000
├── Temperature: 0.7
└── Fallback: Resposta padrão se indisponível
```

---

## 🖥️ Arquitetura do Frontend

### Stack Tecnológico
```
Framework: React 18 + TypeScript
Build Tool: Vite
Styling: Tailwind CSS
Routing: React Router DOM v6
State: React Hooks + Context API
Auth: AWS Amplify (Cognito)
Icons: Lucide React
```

### Estrutura de Componentes
```
frontend/src/
├── App.tsx                    # Roteamento principal
├── main.tsx                   # Entry point
├── index.css                  # Tailwind imports
│
├── components/
│   ├── MeetingRoom.tsx        # Sala de reunião principal
│   ├── VideoCall.tsx          # Grid de vídeos
│   ├── VideoGrid.tsx          # Layout responsivo de vídeos
│   ├── ChatRoom.tsx           # Chat lateral
│   ├── ChatSidebar.tsx        # Sidebar do chat
│   ├── MessageList.tsx        # Lista de mensagens
│   ├── MessageInput.tsx       # Input de mensagem
│   ├── ControlBar.tsx         # Controles de mídia
│   ├── LiveTranscription.tsx  # Transcrição em tempo real
│   ├── TranscriptionPanel.tsx # Painel de transcrições
│   ├── ParticipantsList.tsx   # Lista de participantes
│   ├── RecordingControl.tsx   # Controle de gravação
│   ├── PreviewScreen.tsx      # Preview de câmera/mic
│   ├── LoginScreen.tsx        # Tela de login
│   ├── Lobby.tsx              # Lobby de entrada
│   ├── NameEntry.tsx          # Entrada de nome
│   ├── AIInsightsPanel.tsx    # Insights de IA
│   ├── InterviewSuggestions.tsx # Sugestões para entrevistas
│   ├── InterviewReportModal.tsx # Relatório de entrevista
│   ├── MeetingHistory.tsx     # Histórico de reuniões
│   ├── MeetingSetupModal.tsx  # Configuração de reunião
│   ├── EndMeetingModal.tsx    # Modal de encerramento
│   ├── DebugPanel.tsx         # Painel de debug
│   ├── Toast.tsx              # Notificações
│   └── ErrorBoundary.tsx      # Tratamento de erros
│
├── hooks/
│   ├── useWebSocket.ts        # Conexão WebSocket
│   ├── useVideoCall.ts        # WebRTC + streams
│   ├── useTranscription.ts    # Speech Recognition
│   ├── useRecording.ts        # Gravação de reunião
│   ├── useAudioStream.ts      # Streaming de áudio
│   ├── useInterviewAssistant.ts # Assistente de entrevista
│   ├── useConnectionQuality.ts # Qualidade de conexão
│   ├── useNotifications.ts    # Notificações
│   ├── useToast.ts            # Sistema de toasts
│   └── useMobile.ts           # Detecção mobile
│
├── services/
│   ├── authService.ts         # Autenticação Cognito
│   ├── turnService.ts         # Credenciais TURN
│   ├── interviewAIService.ts  # IA para entrevistas
│   └── meetingHistoryService.ts # Histórico local
│
├── contexts/
│   └── AuthContext.tsx        # Contexto de autenticação
│
├── utils/
│   ├── sanitize.ts            # Sanitização XSS
│   ├── rateLimiter.ts         # Rate limiting
│   └── secureStorage.ts       # Storage seguro
│
└── types/
    └── speech-recognition.d.ts # Tipos Web Speech API
```

### Fluxo de Dados do Frontend
```
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    AuthProvider                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │              BrowserRouter                       │    │    │
│  │  │  ┌─────────────────────────────────────────┐    │    │    │
│  │  │  │           Routes                         │    │    │    │
│  │  │  │  ├── / → HomePage                        │    │    │    │
│  │  │  │  └── /meeting/:roomId → MeetingRoom      │    │    │    │
│  │  │  └─────────────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

MeetingRoom
├── useWebSocket() ──────────────────────────────────────────────┐
│   ├── Conexão: wss://...?userId=X&roomId=Y                     │
│   ├── Eventos: onMessage, onConnect, onDisconnect              │
│   └── Métodos: sendMessage(), addMessageHandler()              │
│                                                                 │
├── useVideoCall() ──────────────────────────────────────────────┤
│   ├── getUserMedia() → localStream                             │
│   ├── RTCPeerConnection → remoteStreams                        │
│   ├── ICE Candidates via WebSocket                             │
│   └── Métodos: toggleVideo(), toggleAudio(), toggleScreenShare()│
│                                                                 │
├── useTranscription() ──────────────────────────────────────────┤
│   ├── Web Speech API (SpeechRecognition)                       │
│   ├── Transcrições parciais/finais                             │
│   └── Broadcast via WebSocket                                  │
│                                                                 │
└── useRecording() ──────────────────────────────────────────────┘
    ├── Canvas compositing de vídeos
    ├── MediaRecorder API
    └── Upload para S3 via URL pré-assinada
```

---

## 🔄 Fluxos de Comunicação

### 1. Fluxo de Conexão WebSocket
```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Client  │     │ API Gateway │     │ connection-  │     │ DynamoDB │
│          │     │  WebSocket  │     │   handler    │     │          │
└────┬─────┘     └──────┬──────┘     └──────┬───────┘     └────┬─────┘
     │                  │                   │                  │
     │ CONNECT          │                   │                  │
     │ ?userId&roomId   │                   │                  │
     │─────────────────>│                   │                  │
     │                  │ $connect          │                  │
     │                  │──────────────────>│                  │
     │                  │                   │ PutItem          │
     │                  │                   │ (Connections)    │
     │                  │                   │─────────────────>│
     │                  │                   │                  │
     │                  │                   │ PutItem          │
     │                  │                   │ (Users)          │
     │                  │                   │─────────────────>│
     │                  │                   │                  │
     │                  │                   │ Query            │
     │                  │                   │ (RoomConnections)│
     │                  │                   │─────────────────>│
     │                  │                   │<─────────────────│
     │                  │                   │                  │
     │                  │ Notify room users │                  │
     │                  │<──────────────────│                  │
     │ room_event       │                   │                  │
     │ (user_joined)    │                   │                  │
     │<─────────────────│                   │                  │
     │                  │                   │                  │
```

### 2. Fluxo WebRTC (Sinalização)
```
┌──────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────────┐
│ Client A │     │ Client B │     │ API Gateway │     │ message-     │
│ (Caller) │     │ (Callee) │     │  WebSocket  │     │   handler    │
└────┬─────┘     └────┬─────┘     └──────┬──────┘     └──────┬───────┘
     │                │                  │                   │
     │ createOffer()  │                  │                   │
     │────────────────│                  │                   │
     │                │                  │                   │
     │ webrtc-signal  │                  │                   │
     │ (offer)        │                  │                   │
     │───────────────────────────────────>│                  │
     │                │                  │ webrtc-signal     │
     │                │                  │──────────────────>│
     │                │                  │                   │
     │                │                  │ PostToConnection  │
     │                │                  │<──────────────────│
     │                │ webrtc-signal    │                   │
     │                │ (offer)          │                   │
     │                │<─────────────────│                   │
     │                │                  │                   │
     │                │ createAnswer()   │                   │
     │                │──────────────────│                   │
     │                │                  │                   │
     │                │ webrtc-signal    │                   │
     │                │ (answer)         │                   │
     │                │─────────────────────────────────────>│
     │                │                  │                   │
     │ webrtc-signal  │                  │                   │
     │ (answer)       │                  │                   │
     │<──────────────────────────────────│                   │
     │                │                  │                   │
     │ ICE Candidates │                  │                   │
     │<═══════════════════════════════════════════════════>  │
     │                │                  │                   │
     │ P2P Connection │                  │                   │
     │<══════════════>│                  │                   │
     │  (Audio/Video) │                  │                   │
```

### 3. Fluxo de Transcrição em Tempo Real
```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Client  │     │ API Gateway │     │ message-     │     │ DynamoDB │
│          │     │  WebSocket  │     │   handler    │     │          │
└────┬─────┘     └──────┬──────┘     └──────┬───────┘     └────┬─────┘
     │                  │                   │                  │
     │ SpeechRecognition│                   │                  │
     │ (browser API)    │                   │                  │
     │────────────────  │                   │                  │
     │                  │                   │                  │
     │ sendMessage      │                   │                  │
     │ type:transcription                   │                  │
     │ isPartial: true  │                   │                  │
     │─────────────────>│                   │                  │
     │                  │ sendMessage       │                  │
     │                  │──────────────────>│                  │
     │                  │                   │                  │
     │                  │                   │ (não salva       │
     │                  │                   │  parciais)       │
     │                  │                   │                  │
     │                  │ Broadcast to room │                  │
     │                  │<──────────────────│                  │
     │ transcription    │                   │                  │
     │ (partial)        │                   │                  │
     │<─────────────────│                   │                  │
     │                  │                   │                  │
     │ sendMessage      │                   │                  │
     │ type:transcription                   │                  │
     │ isPartial: false │                   │                  │
     │─────────────────>│                   │                  │
     │                  │ sendMessage       │                  │
     │                  │──────────────────>│                  │
     │                  │                   │ PutItem          │
     │                  │                   │ (Transcriptions) │
     │                  │                   │─────────────────>│
     │                  │                   │                  │
     │                  │ Broadcast to room │                  │
     │                  │<──────────────────│                  │
     │ transcription    │                   │                  │
     │ (final)          │                   │                  │
     │<─────────────────│                   │                  │
```

### 4. Fluxo de Gravação
```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Client  │     │  HTTP API   │     │ recording-   │     │    S3    │
│          │     │             │     │   manager    │     │          │
└────┬─────┘     └──────┬──────┘     └──────┬───────┘     └────┬─────┘
     │                  │                   │                  │
     │ Canvas composite │                   │                  │
     │ (all videos)     │                   │                  │
     │────────────────  │                   │                  │
     │                  │                   │                  │
     │ MediaRecorder    │                   │                  │
     │ start()          │                   │                  │
     │────────────────  │                   │                  │
     │                  │                   │                  │
     │ ... recording ...│                   │                  │
     │                  │                   │                  │
     │ MediaRecorder    │                   │                  │
     │ stop()           │                   │                  │
     │────────────────  │                   │                  │
     │                  │                   │                  │
     │ POST /recording/ │                   │                  │
     │ upload-url       │                   │                  │
     │─────────────────>│                   │                  │
     │                  │ invoke            │                  │
     │                  │──────────────────>│                  │
     │                  │                   │ getSignedUrl()   │
     │                  │                   │─────────────────>│
     │                  │                   │<─────────────────│
     │                  │                   │                  │
     │                  │                   │ PutItem          │
     │                  │                   │ (Recordings)     │
     │                  │                   │─────────────────>│
     │                  │<──────────────────│                  │
     │ { uploadUrl }    │                   │                  │
     │<─────────────────│                   │                  │
     │                  │                   │                  │
     │ PUT uploadUrl    │                   │                  │
     │ (video blob)     │                   │                  │
     │────────────────────────────────────────────────────────>│
     │                  │                   │                  │
```

---

## 🔒 Arquitetura de Segurança

### Camadas de Segurança
```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE EDGE                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CloudFront                                               │   │
│  │ ├── HTTPS obrigatório (TLS 1.2+)                        │   │
│  │ ├── Origin Access Control (OAC)                         │   │
│  │ └── Custom Headers                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE AUTENTICAÇÃO                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Cognito User Pool                                        │   │
│  │ ├── JWT Tokens (Access, ID, Refresh)                    │   │
│  │ ├── Password Policy (8+ chars, upper, lower, num, sym)  │   │
│  │ ├── Account Recovery via Email                          │   │
│  │ └── Prevent User Existence Errors                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE API                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ API Gateway                                              │   │
│  │ ├── Throttling (5000 burst, 2000 rate)                  │   │
│  │ ├── CORS restritivo (origins específicos)               │   │
│  │ └── Request Validation                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE APLICAÇÃO                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Lambda Functions                                         │   │
│  │ ├── Input Validation (Joi schemas)                      │   │
│  │ ├── Sanitização (DOMPurify + validator.js)              │   │
│  │ ├── Logging Seguro (redação de PII)                     │   │
│  │ └── IAM Roles (least privilege)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE DADOS                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DynamoDB + S3                                            │   │
│  │ ├── Encryption at Rest (AES-256)                        │   │
│  │ ├── Encryption in Transit (TLS)                         │   │
│  │ ├── VPC Endpoints (opcional)                            │   │
│  │ └── Point-in-Time Recovery                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Sanitização de Dados
```javascript
// Backend (shared/lib/sanitizer.js)
const sanitizeContent = (content) => {
  // DOMPurify para HTML
  // validator.js para formatos
  // Limite de tamanho
  // Remoção de scripts
};

// Frontend (utils/sanitize.ts)
const sanitizeText = (text) => {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .substring(0, 5000);
};
```

### IAM Policies (Least Privilege)
```yaml
# Exemplo: message-handler
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref MessagesTable
  - DynamoDBCrudPolicy:
      TableName: !Ref ConnectionsTable
  - Statement:
      - Effect: Allow
        Action:
          - execute-api:ManageConnections
        Resource: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*'
```

---

## 📊 Observabilidade

### CloudWatch Logs
```
Log Groups:
├── /aws/lambda/chat-colaborativo-serverless-connection-handler
├── /aws/lambda/chat-colaborativo-serverless-message-handler
├── /aws/lambda/chat-colaborativo-serverless-audio-stream-processor
├── /aws/lambda/chat-colaborativo-serverless-transcription-aggregator
├── /aws/lambda/chat-colaborativo-serverless-ai-analysis
├── /aws/lambda/chat-colaborativo-serverless-room-manager
├── /aws/lambda/chat-colaborativo-serverless-recording-manager
└── /aws/lambda/chat-colaborativo-serverless-turn-credentials

Retention: 30 dias
```

### Métricas Customizadas
```
Namespace: ChatColaborativo

Métricas:
├── ConnectionCount (por sala)
├── MessageCount (por sala)
├── TranscriptionLatency
├── WebRTCSignalingLatency
├── RecordingUploadSize
└── AIAnalysisLatency
```

### Alertas (CloudWatch Alarms)
```
Alertas Configurados:
├── Lambda Errors > 1% (5 min)
├── Lambda Duration > 3s (p95)
├── API Gateway 5xx > 1%
├── DynamoDB Throttling > 0
└── S3 4xx Errors > 10
```

---

## 💰 Estimativa de Custos

### Para 5 usuários, 8h/dia, 20 dias/mês

| Serviço | Uso Estimado | Custo Mensal |
|---------|--------------|--------------|
| CloudFront | 10 GB transfer | $1-5 |
| API Gateway WebSocket | 1M messages | $5 |
| Lambda | 500K invocations | $10 |
| DynamoDB | 5 GB storage, 1M requests | $5 |
| Amazon Transcribe | 160 horas | $30 |
| Amazon Bedrock | 100K tokens | $20 |
| S3 | 50 GB storage | $2.50 |
| Route53 | 1 hosted zone | $0.50 |
| **TOTAL** | | **~$74-78/mês** |

---

## 🚀 Deploy

### Comandos de Deploy (Produção)
```bash
# 1. Build Frontend
cd frontend && npm run build

# 2. Deploy Frontend para S3
aws s3 sync frontend/dist/ s3://chat-colaborativo-prod-frontend-383234048592 --delete

# 3. Invalidar cache CloudFront
aws cloudfront create-invalidation --distribution-id E19FZWDK7MJWSX --paths "/*"

# 4. Build Backend
cd backend && sam build --template-file ../infrastructure/complete-stack.yaml

# 5. Deploy Backend
sam deploy --config-file samconfig.toml --no-confirm-changeset
```

### Ambientes
| Ambiente | Frontend | Backend |
|----------|----------|---------|
| **Produção** | `chat-colaborativo-prod-frontend-383234048592` | `chat-colaborativo-serverless` |
| Desenvolvimento | `chat-colaborativo-serverless-frontend-383234048592` | - |

---

## 📝 Resumo de Recursos AWS

| Categoria | Quantidade | Recursos |
|-----------|------------|----------|
| Compute | 8 | Lambda Functions |
| Database | 7 | DynamoDB Tables |
| Storage | 3 | S3 Buckets |
| Networking | 2 | API Gateway (WebSocket + HTTP) |
| CDN | 1 | CloudFront Distribution |
| Auth | 1 | Cognito User Pool |
| AI/ML | 2 | Transcribe, Bedrock |
| DNS | 1 | Route53 Hosted Zone |
| Security | 1 | ACM Certificate |
| **TOTAL** | **~43** | Recursos |

---

*Documento gerado em: Dezembro 2024*
*Versão: 2.15.3*
