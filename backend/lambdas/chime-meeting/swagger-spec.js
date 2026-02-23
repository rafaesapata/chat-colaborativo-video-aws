'use strict';

function buildSwaggerSpec(baseUrl) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Video Chat API',
      version: '2.0.0',
      description: 'API completa do sistema de Video Chat. Inclui endpoints internos (autenticação Cognito) e API externa (autenticação via API Key).',
      contact: { name: 'UDS Tecnologia', url: 'https://udstec.io' },
    },
    servers: [
      { url: baseUrl, description: 'Produção' },
    ],
    tags: [
      { name: 'Health', description: 'Status do sistema' },
      { name: 'Meetings', description: 'Gerenciamento de reuniões (Chime SDK)' },
      { name: 'Transcription', description: 'Transcrição ao vivo (Amazon Transcribe)' },
      { name: 'Schedule', description: 'Agendamento de reuniões' },
      { name: 'Admin', description: 'Painel administrativo (requer admin)' },
      { name: 'Admin - Users', description: 'Gerenciamento de administradores' },
      { name: 'Admin - API Keys', description: 'Gerenciamento de chaves de API' },
      { name: 'Admin - Backgrounds', description: 'Backgrounds virtuais customizáveis' },
      { name: 'Admin - History', description: 'Histórico de reuniões' },
      { name: 'Room Config', description: 'Configuração de salas' },
      { name: 'Interview', description: 'IA de entrevistas (Bedrock)' },
      { name: 'Jobs', description: 'Gerenciamento de vagas' },
      { name: 'External API', description: 'API de integração externa (autenticação via X-Api-Key)' },
    ],
    components: {
      securitySchemes: {
        CognitoAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token JWT do Cognito' },
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Api-Key', description: 'Chave de API gerada no painel admin (prefixo vck_)' },
      },
      schemas: {
        Error: { type: 'object', properties: { error: { type: 'string' } } },
        Success: { type: 'object', properties: { success: { type: 'boolean' } } },
        UserLogin: { type: 'object', required: ['userLogin'], properties: { userLogin: { type: 'string', example: 'usuario@empresa.com' } } },
      },
    },
    paths: {
      // ===== HEALTH =====
      '/health': {
        get: {
          summary: 'Health check do sistema',
          tags: ['Health'],
          security: [],
          responses: {
            '200': { description: 'Status do sistema', content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['healthy', 'degraded'] },
                timestamp: { type: 'string', format: 'date-time' },
                version: { type: 'string' },
                region: { type: 'string' },
                dynamodb: { type: 'string' },
                chime: { type: 'string' },
              }
            } } } }
          }
        }
      },

      // ===== MEETINGS =====
      '/meeting/join': {
        post: {
          summary: 'Entrar ou criar uma reunião',
          description: 'Se a sala não existe, cria uma nova reunião no Chime SDK. Se já existe, adiciona o participante.',
          tags: ['Meetings'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['roomId', 'odUserId', 'userName'],
            properties: {
              roomId: { type: 'string', example: 'sala-projeto-x' },
              odUserId: { type: 'string', example: 'usuario@empresa.com' },
              userName: { type: 'string', example: 'João Silva' },
              isAuthenticated: { type: 'boolean', default: false },
            }
          } } } },
          responses: {
            '200': { description: 'Dados da reunião e attendee', content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                meeting: { type: 'object', properties: { MeetingId: { type: 'string' }, MediaPlacement: { type: 'object' }, MediaRegion: { type: 'string' }, ExternalMeetingId: { type: 'string' } } },
                attendee: { type: 'object', properties: { AttendeeId: { type: 'string' }, ExternalUserId: { type: 'string' }, JoinToken: { type: 'string' } } },
                isNewMeeting: { type: 'boolean' },
                otherAttendees: { type: 'array', items: { type: 'object' } },
              }
            } } } },
            '403': { description: 'Convidado sem permissão para criar sala' },
            '404': { description: 'Sala não encontrada (convidado)' },
            '429': { description: 'Sala ocupada (lock)' },
          }
        }
      },
      '/meeting/leave': {
        post: {
          summary: 'Sair de uma reunião',
          tags: ['Meetings'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['meetingId', 'attendeeId'],
            properties: {
              meetingId: { type: 'string' },
              attendeeId: { type: 'string' },
            }
          } } } },
          responses: { '200': { description: 'Saiu com sucesso' } }
        }
      },
      '/meeting/end': {
        post: {
          summary: 'Encerrar uma reunião',
          description: 'Notifica todos os participantes via WebSocket e deleta a reunião no Chime.',
          tags: ['Meetings'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              roomId: { type: 'string' },
              meetingId: { type: 'string' },
              odUserId: { type: 'string' },
            }
          } } } },
          responses: { '200': { description: 'Reunião encerrada' } }
        }
      },
      '/meeting/info': {
        post: {
          summary: 'Obter informações de uma reunião',
          tags: ['Meetings'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              roomId: { type: 'string' },
              meetingId: { type: 'string' },
              odUserId: { type: 'string' },
            }
          } } } },
          responses: {
            '200': { description: 'Informações da reunião', content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                meeting: { type: 'object' },
                attendeeCount: { type: 'integer' },
                attendees: { type: 'array', items: { type: 'object', properties: { AttendeeId: { type: 'string' }, name: { type: 'string' } } } },
              }
            } } } },
          }
        }
      },

      // ===== TRANSCRIPTION =====
      '/meeting/transcription/start': {
        post: {
          summary: 'Iniciar transcrição ao vivo',
          description: 'Inicia transcrição via Amazon Transcribe. Custo: ~$0.024/min.',
          tags: ['Transcription'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              meetingId: { type: 'string' },
              roomId: { type: 'string' },
              userLogin: { type: 'string' },
              languageCode: { type: 'string', default: 'pt-BR', enum: ['pt-BR','en-US','en-GB','es-ES','es-US','fr-FR','de-DE','it-IT','ja-JP','ko-KR','zh-CN'] },
            }
          } } } },
          responses: { '200': { description: 'Transcrição iniciada' } }
        }
      },
      '/meeting/transcription/stop': {
        post: {
          summary: 'Parar transcrição ao vivo',
          tags: ['Transcription'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            properties: { meetingId: { type: 'string' }, roomId: { type: 'string' }, userLogin: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Transcrição parada' } }
        }
      },

      // ===== SCHEDULE =====
      '/schedule/create': {
        post: {
          summary: 'Agendar nova reunião',
          tags: ['Schedule'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'title', 'scheduledAt'],
            properties: {
              userLogin: { type: 'string' },
              title: { type: 'string', example: 'Entrevista - Dev Senior' },
              description: { type: 'string' },
              scheduledAt: { type: 'string', format: 'date-time' },
              duration: { type: 'integer', default: 60 },
              participants: { type: 'array', items: { type: 'string' } },
              notifyEmail: { type: 'boolean', default: true },
              meetingType: { type: 'string', enum: ['REUNIAO', 'ENTREVISTA', 'ESCOPO'], default: 'REUNIAO' },
              jobDescription: { type: 'string', description: 'Descrição da vaga (para entrevistas)' },
            }
          } } } },
          responses: {
            '200': { description: 'Reunião agendada', content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                scheduleId: { type: 'string' },
                roomId: { type: 'string' },
                meetingUrl: { type: 'string' },
                title: { type: 'string' },
                scheduledAt: { type: 'string', format: 'date-time' },
                duration: { type: 'integer' },
              }
            } } } }
          }
        }
      },
      '/schedule/list': {
        post: {
          summary: 'Listar reuniões agendadas',
          tags: ['Schedule'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin'],
            properties: {
              userLogin: { type: 'string' },
              status: { type: 'string', enum: ['scheduled', 'cancelled'] },
              fromDate: { type: 'string', format: 'date-time' },
              toDate: { type: 'string', format: 'date-time' },
              includePast: { type: 'boolean', default: false },
            }
          } } } },
          responses: { '200': { description: 'Lista de reuniões agendadas' } }
        }
      },
      '/schedule/cancel': {
        post: {
          summary: 'Cancelar reunião agendada',
          tags: ['Schedule'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'scheduleId'],
            properties: { userLogin: { type: 'string' }, scheduleId: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Reunião cancelada' } }
        }
      },
      '/schedule/update': {
        post: {
          summary: 'Atualizar reunião agendada',
          tags: ['Schedule'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'scheduleId'],
            properties: {
              userLogin: { type: 'string' },
              scheduleId: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              scheduledAt: { type: 'string', format: 'date-time' },
              duration: { type: 'integer' },
              participants: { type: 'array', items: { type: 'string' } },
            }
          } } } },
          responses: { '200': { description: 'Reunião atualizada' } }
        }
      },

      // ===== ADMIN =====
      '/admin/rooms': {
        post: {
          summary: 'Listar salas ativas',
          tags: ['Admin'],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UserLogin' } } } },
          responses: { '200': { description: 'Lista de salas ativas com participantes' } }
        }
      },
      '/admin/room/end': {
        post: {
          summary: 'Encerrar sala (admin)',
          tags: ['Admin'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin'],
            properties: { userLogin: { type: 'string' }, roomId: { type: 'string' }, meetingId: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Sala encerrada' } }
        }
      },
      '/admin/stats': {
        post: {
          summary: 'Estatísticas do sistema',
          tags: ['Admin'],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UserLogin' } } } },
          responses: { '200': { description: 'Estatísticas (salas ativas, participantes, regiões)' } }
        }
      },
      '/admin/kick': {
        post: {
          summary: 'Remover usuário de uma sala',
          tags: ['Admin'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'meetingId', 'attendeeId'],
            properties: { userLogin: { type: 'string' }, meetingId: { type: 'string' }, attendeeId: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Usuário removido' } }
        }
      },
      '/admin/cleanup': {
        post: {
          summary: 'Limpar salas abandonadas',
          tags: ['Admin'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin'],
            properties: { userLogin: { type: 'string' }, dryRun: { type: 'boolean', default: false } }
          } } } },
          responses: { '200': { description: 'Resultado da limpeza' } }
        }
      },
      '/admin/check-role': {
        post: {
          summary: 'Verificar role do usuário',
          tags: ['Admin'],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UserLogin' } } } },
          responses: { '200': { description: 'Role do usuário (superadmin, admin, user)' } }
        }
      },

      // ===== ADMIN - USERS =====
      '/admin/users': {
        post: {
          summary: 'Listar administradores',
          tags: ['Admin - Users'],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UserLogin' } } } },
          responses: { '200': { description: 'Lista de admins e super admins' } }
        }
      },
      '/admin/users/add': {
        post: {
          summary: 'Adicionar administrador (super admin only)',
          tags: ['Admin - Users'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'newAdmin'],
            properties: { userLogin: { type: 'string' }, newAdmin: { type: 'string', example: 'novo.admin@empresa.com' } }
          } } } },
          responses: { '200': { description: 'Admin adicionado' } }
        }
      },
      '/admin/users/remove': {
        post: {
          summary: 'Remover administrador (super admin only)',
          tags: ['Admin - Users'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'adminToRemove'],
            properties: { userLogin: { type: 'string' }, adminToRemove: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Admin removido' } }
        }
      },

      // ===== ADMIN - API KEYS =====
      '/admin/api-keys': {
        post: {
          summary: 'Listar API Keys',
          tags: ['Admin - API Keys'],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UserLogin' } } } },
          responses: { '200': { description: 'Lista de API Keys' } }
        }
      },
      '/admin/api-keys/create': {
        post: {
          summary: 'Criar nova API Key (super admin only)',
          tags: ['Admin - API Keys'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'name'],
            properties: {
              userLogin: { type: 'string' },
              name: { type: 'string', example: 'Sistema RH' },
              permissions: { type: 'array', items: { type: 'string', enum: ['schedule', 'rooms', 'recordings'] }, default: ['schedule'] },
            }
          } } } },
          responses: { '200': { description: 'API Key criada (exibida apenas uma vez)', content: { 'application/json': { schema: {
            type: 'object',
            properties: { keyId: { type: 'string' }, apiKey: { type: 'string', description: 'Guarde esta chave!' }, name: { type: 'string' } }
          } } } } }
        }
      },
      '/admin/api-keys/revoke': {
        post: {
          summary: 'Revogar API Key',
          tags: ['Admin - API Keys'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'keyId'],
            properties: { userLogin: { type: 'string' }, keyId: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'API Key revogada' } }
        }
      },

      // ===== ADMIN - BACKGROUNDS =====
      '/admin/backgrounds': {
        get: {
          summary: 'Listar backgrounds virtuais',
          tags: ['Admin - Backgrounds'],
          responses: { '200': { description: 'Lista de backgrounds disponíveis' } }
        }
      },
      '/admin/backgrounds/add': {
        post: {
          summary: 'Adicionar background virtual',
          tags: ['Admin - Backgrounds'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'name', 'imageUrl'],
            properties: { userLogin: { type: 'string' }, name: { type: 'string' }, imageUrl: { type: 'string' }, category: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Background adicionado' } }
        }
      },
      '/admin/backgrounds/upload-url': {
        post: {
          summary: 'Obter URL de upload para background',
          tags: ['Admin - Backgrounds'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'fileName', 'contentType'],
            properties: { userLogin: { type: 'string' }, fileName: { type: 'string' }, contentType: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'URL pré-assinada para upload' } }
        }
      },
      '/admin/backgrounds/remove': {
        post: {
          summary: 'Remover background virtual',
          tags: ['Admin - Backgrounds'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'backgroundId'],
            properties: { userLogin: { type: 'string' }, backgroundId: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Background removido' } }
        }
      },
      '/admin/backgrounds/toggle': {
        post: {
          summary: 'Ativar/desativar background virtual',
          tags: ['Admin - Backgrounds'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'backgroundId'],
            properties: { userLogin: { type: 'string' }, backgroundId: { type: 'string' }, enabled: { type: 'boolean' } }
          } } } },
          responses: { '200': { description: 'Background atualizado' } }
        }
      },

      // ===== ADMIN - HISTORY =====
      '/admin/history/list': {
        post: {
          summary: 'Listar histórico de reuniões',
          tags: ['Admin - History'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin'],
            properties: {
              userLogin: { type: 'string' },
              filters: { type: 'object', properties: {
                userLogin: { type: 'string' },
                fromDate: { type: 'string' },
                toDate: { type: 'string' },
                meetingType: { type: 'string' },
              } },
              limit: { type: 'integer', default: 50 },
              lastKey: { type: 'object', description: 'Paginação' },
            }
          } } } },
          responses: { '200': { description: 'Histórico de reuniões com transcrições e gravações' } }
        }
      },
      '/admin/history/save': {
        post: {
          summary: 'Salvar histórico de reunião',
          tags: ['Admin - History'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'roomId', 'title'],
            properties: {
              userLogin: { type: 'string' },
              roomId: { type: 'string' },
              title: { type: 'string' },
              meetingType: { type: 'string' },
              duration: { type: 'integer' },
              participants: { type: 'array', items: { type: 'string' } },
              transcriptions: { type: 'array', items: { type: 'object' } },
              aiAnalysis: { type: 'string' },
              jobDescription: { type: 'string' },
              questionsAsked: { type: 'array', items: { type: 'string' } },
              recordingKey: { type: 'string' },
              recordingDuration: { type: 'integer' },
              recordingId: { type: 'string' },
            }
          } } } },
          responses: { '200': { description: 'Histórico salvo' } }
        }
      },

      // ===== ROOM CONFIG =====
      '/room/config/save': {
        post: {
          summary: 'Salvar configuração de sala',
          tags: ['Room Config'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'roomId', 'config'],
            properties: {
              userLogin: { type: 'string' },
              roomId: { type: 'string' },
              config: { type: 'object', properties: {
                meetingType: { type: 'string', enum: ['REUNIAO', 'ENTREVISTA', 'ESCOPO'] },
                jobDescription: { type: 'string' },
                autoStartTranscription: { type: 'boolean' },
                autoStartRecording: { type: 'boolean' },
                allowGuestAccess: { type: 'boolean' },
                enableChat: { type: 'boolean' },
              } },
            }
          } } } },
          responses: { '200': { description: 'Configuração salva' } }
        }
      },
      '/room/config/get': {
        post: {
          summary: 'Obter configuração de sala',
          tags: ['Room Config'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['roomId'],
            properties: { roomId: { type: 'string' }, userLogin: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Configuração da sala' } }
        }
      },

      // ===== INTERVIEW =====
      '/interview/data/save': {
        post: {
          summary: 'Salvar dados de entrevista (sugestões IA)',
          tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['roomId'],
            properties: { roomId: { type: 'string' }, userLogin: { type: 'string' }, suggestions: { type: 'array', items: { type: 'object' } }, questions: { type: 'array', items: { type: 'object' } } }
          } } } },
          responses: { '200': { description: 'Dados salvos' } }
        }
      },
      '/interview/data/get': {
        post: {
          summary: 'Obter dados de entrevista',
          tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['roomId'],
            properties: { roomId: { type: 'string' }, userLogin: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Dados da entrevista' } }
        }
      },
      '/interview/data/clear': {
        post: {
          summary: 'Limpar dados de entrevista',
          tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['roomId'],
            properties: { roomId: { type: 'string' }, userLogin: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Dados limpos' } }
        }
      },
      '/interview/config/get': {
        post: {
          summary: 'Obter configuração de IA para entrevistas',
          tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UserLogin' } } } },
          responses: { '200': { description: 'Configuração de IA' } }
        }
      },
      '/interview/config/save': {
        post: {
          summary: 'Salvar configuração de IA para entrevistas (admin)',
          tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'config'],
            properties: {
              userLogin: { type: 'string' },
              config: { type: 'object', description: 'Configurações de IA (modelo, temperatura, prompts, etc.)' },
            }
          } } } },
          responses: { '200': { description: 'Configuração salva' } }
        }
      },
      '/interview/ai': {
        post: {
          summary: 'Gerar perguntas/análise com IA (Bedrock)',
          tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['roomId', 'action'],
            properties: {
              roomId: { type: 'string' },
              userLogin: { type: 'string' },
              action: { type: 'string', enum: ['generate_questions', 'analyze_response', 'generate_report'] },
              context: { type: 'object', description: 'Contexto para a IA (transcrições, vaga, etc.)' },
            }
          } } } },
          responses: { '200': { description: 'Resposta da IA' } }
        }
      },
      '/interview/report/save': {
        post: { summary: 'Salvar relatório de entrevista', tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['roomId', 'action'], properties: { roomId: { type: 'string' }, action: { type: 'string' }, userLogin: { type: 'string' }, report: { type: 'object' } } } } } },
          responses: { '200': { description: 'Relatório salvo' } } }
      },
      '/interview/report/get': {
        post: { summary: 'Obter relatório de entrevista', tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['roomId', 'action'], properties: { roomId: { type: 'string' }, action: { type: 'string' }, userLogin: { type: 'string' } } } } } },
          responses: { '200': { description: 'Relatório da entrevista' } } }
      },
      '/interview/report/compare': {
        post: { summary: 'Comparar relatórios de entrevistas', tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string' }, userLogin: { type: 'string' }, reportIds: { type: 'array', items: { type: 'string' } } } } } } },
          responses: { '200': { description: 'Comparação de relatórios' } } }
      },
      '/interview/calibration/submit': {
        post: { summary: 'Submeter calibração de entrevista', tags: ['Interview'],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string' }, userLogin: { type: 'string' }, calibration: { type: 'object' } } } } } },
          responses: { '200': { description: 'Calibração submetida' } } }
      },

      // ===== JOBS =====
      '/jobs/list': {
        post: {
          summary: 'Listar vagas',
          tags: ['Jobs'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin'],
            properties: { userLogin: { type: 'string' }, status: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Lista de vagas' } }
        }
      },
      '/jobs/create': {
        post: {
          summary: 'Criar vaga',
          tags: ['Jobs'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'title'],
            properties: {
              userLogin: { type: 'string' },
              title: { type: 'string', example: 'Desenvolvedor Full Stack Senior' },
              description: { type: 'string' },
              requirements: { type: 'array', items: { type: 'string' } },
              department: { type: 'string' },
              location: { type: 'string' },
              salary: { type: 'string' },
              status: { type: 'string', enum: ['open', 'closed', 'paused'], default: 'open' },
            }
          } } } },
          responses: { '200': { description: 'Vaga criada' } }
        }
      },
      '/jobs/update': {
        post: {
          summary: 'Atualizar vaga',
          tags: ['Jobs'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'jobId'],
            properties: {
              userLogin: { type: 'string' },
              jobId: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              requirements: { type: 'array', items: { type: 'string' } },
              status: { type: 'string' },
            }
          } } } },
          responses: { '200': { description: 'Vaga atualizada' } }
        }
      },
      '/jobs/delete': {
        post: {
          summary: 'Deletar vaga',
          tags: ['Jobs'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'jobId'],
            properties: { userLogin: { type: 'string' }, jobId: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Vaga deletada' } }
        }
      },
      '/jobs/get': {
        post: {
          summary: 'Obter detalhes de uma vaga',
          tags: ['Jobs'],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['userLogin', 'jobId'],
            properties: { userLogin: { type: 'string' }, jobId: { type: 'string' } }
          } } } },
          responses: { '200': { description: 'Detalhes da vaga' } }
        }
      },

      // ===== EXTERNAL API (API Key auth) =====
      '/api/v1/meetings/schedule': {
        post: {
          summary: 'Agendar reunião via API externa',
          tags: ['External API'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['title', 'scheduledAt'],
            properties: {
              title: { type: 'string', example: 'Reunião de Alinhamento' },
              description: { type: 'string' },
              scheduledAt: { type: 'string', format: 'date-time', example: '2026-03-15T14:00:00Z' },
              duration: { type: 'integer', default: 60 },
              participants: { type: 'array', items: { type: 'string' }, example: ['user1@email.com'] },
              callbackUrl: { type: 'string', example: 'https://seu-sistema.com/webhook' },
            }
          } } } },
          responses: {
            '200': { description: 'Reunião agendada', content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                scheduleId: { type: 'string' },
                roomId: { type: 'string' },
                meetingUrl: { type: 'string', example: 'https://app.livechat.udstec.io/meeting/room_abc123' },
                title: { type: 'string' },
                scheduledAt: { type: 'string', format: 'date-time' },
                duration: { type: 'integer' },
              }
            } } } },
            '401': { description: 'API Key inválida' },
            '403': { description: 'Permissão negada' },
          }
        }
      },
      '/api/v1/meetings/scheduled': {
        get: {
          summary: 'Listar reuniões agendadas via API externa',
          tags: ['External API'],
          security: [{ ApiKeyAuth: [] }],
          responses: {
            '200': { description: 'Lista de reuniões agendadas pela API Key' },
            '401': { description: 'API Key inválida' },
          }
        }
      },
      '/api/v1/meetings/scheduled/{scheduleId}': {
        delete: {
          summary: 'Cancelar reunião agendada via API externa',
          tags: ['External API'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ name: 'scheduleId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Reunião cancelada' },
            '401': { description: 'API Key inválida' },
            '403': { description: 'Acesso negado (não pertence a esta API Key)' },
          }
        }
      },
      '/api/v1/rooms/create': {
        post: {
          summary: 'Criar sala de reunião instantânea via API externa',
          description: 'Cria uma sala no Chime SDK imediatamente, pronta para uso. Retorna o meetingId e a URL de acesso.',
          tags: ['External API'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['title'],
            properties: {
              title: { type: 'string', example: 'Sala de Entrevista' },
              description: { type: 'string' },
              meetingType: { type: 'string', enum: ['REUNIAO', 'ENTREVISTA', 'ESCOPO'], default: 'REUNIAO' },
              jobDescription: { type: 'string', description: 'Descrição da vaga (para entrevistas)' },
              participants: { type: 'array', items: { type: 'string' } },
            }
          } } } },
          responses: {
            '200': { description: 'Sala criada', content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                roomId: { type: 'string' },
                meetingId: { type: 'string' },
                meetingUrl: { type: 'string', example: 'https://app.livechat.udstec.io/meeting/room_abc123' },
                title: { type: 'string' },
                mediaRegion: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                createdBy: { type: 'string' },
              }
            } } } },
            '401': { description: 'API Key inválida' },
            '403': { description: 'Permissão negada (necessário: rooms ou schedule)' },
          }
        }
      },
      '/api/v1/meetings/download': {
        post: {
          summary: 'Obter URL de download de gravação via API externa',
          description: 'Gera uma URL pré-assinada (válida por 2h) para download da gravação de uma reunião.',
          tags: ['External API'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              recordingId: { type: 'string', description: 'ID da gravação no DynamoDB' },
              recordingKey: { type: 'string', description: 'Chave S3 da gravação (alternativa ao recordingId)' },
            }
          } } } },
          responses: {
            '200': { description: 'URL de download gerada', content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                downloadUrl: { type: 'string', description: 'URL pré-assinada para download' },
                expiresIn: { type: 'integer', example: 7200, description: 'Tempo de expiração em segundos' },
                recordingId: { type: 'string' },
                recordingKey: { type: 'string' },
                fileSize: { type: 'integer' },
                duration: { type: 'integer' },
                roomId: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              }
            } } } },
            '401': { description: 'API Key inválida' },
            '403': { description: 'Permissão negada (necessário: recordings ou schedule)' },
            '404': { description: 'Gravação não encontrada' },
            '503': { description: 'Serviço de gravações não configurado' },
          }
        }
      },
    },
  };
}

module.exports = { buildSwaggerSpec };
