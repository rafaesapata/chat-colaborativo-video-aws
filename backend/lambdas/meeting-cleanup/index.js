/**
 * Meeting Cleanup Lambda
 * Encerra automaticamente salas abandonadas (sem participantes)
 * 
 * Executar via EventBridge Schedule (ex: a cada 15 minutos)
 */

'use strict';

const {
  ChimeSDKMeetingsClient,
  GetMeetingCommand,
  DeleteMeetingCommand,
  ListAttendeesCommand,
} = require('@aws-sdk/client-chime-sdk-meetings');

const {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} = require('@aws-sdk/client-dynamodb');

// Configuração
const CONFIG = {
  REGION: process.env.AWS_REGION || 'us-east-1',
  MEETINGS_TABLE: process.env.MEETINGS_TABLE || 'ChimeMeetings',
  // Tempo mínimo sem participantes antes de encerrar (em segundos)
  EMPTY_ROOM_THRESHOLD_SECONDS: parseInt(process.env.EMPTY_ROOM_THRESHOLD || '300'), // 5 minutos
  // Tempo máximo de vida de uma sala (em segundos)
  MAX_ROOM_AGE_SECONDS: parseInt(process.env.MAX_ROOM_AGE || '14400'), // 4 horas
  // Dry run - apenas logar, não encerrar
  DRY_RUN: process.env.DRY_RUN === 'true',
};

const chimeClient = new ChimeSDKMeetingsClient({ region: CONFIG.REGION });
const dynamoClient = new DynamoDBClient({ region: CONFIG.REGION });

// Logging estruturado
function log(level, msg, data = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...data,
  }));
}

// Buscar todas as salas ativas no DynamoDB
async function getActiveMeetings() {
  const meetings = [];
  
  try {
    const result = await dynamoClient.send(new ScanCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      FilterExpression: 'attribute_exists(meetingId) AND attribute_not_exists(lockedBy)',
    }));
    
    for (const item of result.Items || []) {
      if (item.meetingId?.S && item.roomId?.S) {
        // Ignorar registros de rate limit e admin
        if (item.roomId.S.startsWith('ratelimit_') || 
            item.roomId.S.startsWith('lock_') ||
            item.roomId.S === 'admin_users_list') {
          continue;
        }
        
        meetings.push({
          roomId: item.roomId.S,
          meetingId: item.meetingId.S,
          createdBy: item.createdBy?.S || 'unknown',
          createdAt: parseInt(item.createdAt?.N || '0'),
        });
      }
    }
  } catch (e) {
    log('error', 'Erro ao buscar meetings do DynamoDB', { error: e.message });
    throw e;
  }
  
  return meetings;
}

// Verificar se uma sala deve ser encerrada
async function shouldEndMeeting(meeting) {
  const now = Math.floor(Date.now() / 1000);
  const roomAge = now - meeting.createdAt;
  
  // 1. Verificar idade máxima da sala
  if (roomAge > CONFIG.MAX_ROOM_AGE_SECONDS) {
    return { shouldEnd: true, reason: 'max_age_exceeded', roomAge };
  }
  
  try {
    // 2. Verificar se a reunião ainda existe no Chime
    await chimeClient.send(new GetMeetingCommand({
      MeetingId: meeting.meetingId,
    }));
    
    // 3. Verificar número de participantes
    const attendeesResponse = await chimeClient.send(new ListAttendeesCommand({
      MeetingId: meeting.meetingId,
    }));
    
    const attendeeCount = attendeesResponse.Attendees?.length || 0;
    
    if (attendeeCount === 0) {
      // Sala vazia - verificar há quanto tempo
      // Como não temos timestamp de quando ficou vazia, usamos a idade da sala
      // Se a sala tem mais de EMPTY_ROOM_THRESHOLD_SECONDS, encerrar
      if (roomAge > CONFIG.EMPTY_ROOM_THRESHOLD_SECONDS) {
        return { shouldEnd: true, reason: 'empty_room', attendeeCount, roomAge };
      }
    }
    
    return { shouldEnd: false, attendeeCount, roomAge };
    
  } catch (e) {
    if (e.name === 'NotFoundException') {
      // Reunião não existe mais no Chime - limpar do DynamoDB
      return { shouldEnd: true, reason: 'meeting_not_found', roomAge };
    }
    
    log('warn', 'Erro ao verificar meeting', { 
      roomId: meeting.roomId, 
      error: e.message 
    });
    return { shouldEnd: false, error: e.message };
  }
}

// Encerrar uma sala
async function endMeeting(meeting, reason) {
  if (CONFIG.DRY_RUN) {
    log('info', '[DRY RUN] Sala seria encerrada', { 
      roomId: meeting.roomId, 
      reason 
    });
    return { success: true, dryRun: true };
  }
  
  try {
    // 1. Tentar deletar no Chime (pode já não existir)
    try {
      await chimeClient.send(new DeleteMeetingCommand({
        MeetingId: meeting.meetingId,
      }));
      log('info', 'Reunião encerrada no Chime', { roomId: meeting.roomId });
    } catch (e) {
      if (e.name !== 'NotFoundException') {
        throw e;
      }
      log('debug', 'Reunião já não existia no Chime', { roomId: meeting.roomId });
    }
    
    // 2. Remover do DynamoDB
    await dynamoClient.send(new DeleteItemCommand({
      TableName: CONFIG.MEETINGS_TABLE,
      Key: { roomId: { S: meeting.roomId } },
    }));
    
    log('info', 'Sala removida do cache', { roomId: meeting.roomId, reason });
    return { success: true };
    
  } catch (e) {
    log('error', 'Erro ao encerrar sala', { 
      roomId: meeting.roomId, 
      error: e.message 
    });
    return { success: false, error: e.message };
  }
}

// Handler principal
exports.handler = async (event) => {
  const startTime = Date.now();
  
  log('info', 'Iniciando cleanup de salas', {
    config: {
      emptyRoomThreshold: CONFIG.EMPTY_ROOM_THRESHOLD_SECONDS,
      maxRoomAge: CONFIG.MAX_ROOM_AGE_SECONDS,
      dryRun: CONFIG.DRY_RUN,
    },
  });
  
  const stats = {
    totalMeetings: 0,
    checked: 0,
    ended: 0,
    errors: 0,
    reasons: {
      empty_room: 0,
      max_age_exceeded: 0,
      meeting_not_found: 0,
    },
  };
  
  try {
    // 1. Buscar todas as salas ativas
    const meetings = await getActiveMeetings();
    stats.totalMeetings = meetings.length;
    
    log('info', `Encontradas ${meetings.length} salas para verificar`);
    
    // 2. Verificar cada sala
    for (const meeting of meetings) {
      stats.checked++;
      
      const checkResult = await shouldEndMeeting(meeting);
      
      if (checkResult.shouldEnd) {
        const endResult = await endMeeting(meeting, checkResult.reason);
        
        if (endResult.success) {
          stats.ended++;
          stats.reasons[checkResult.reason] = (stats.reasons[checkResult.reason] || 0) + 1;
        } else {
          stats.errors++;
        }
      }
      
      // Pequeno delay para não sobrecarregar APIs
      await new Promise(r => setTimeout(r, 100));
    }
    
    const duration = Date.now() - startTime;
    
    log('info', 'Cleanup concluído', { stats, durationMs: duration });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        stats,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      }),
    };
    
  } catch (error) {
    log('error', 'Erro no cleanup', { error: error.message, stack: error.stack });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stats,
      }),
    };
  }
};
