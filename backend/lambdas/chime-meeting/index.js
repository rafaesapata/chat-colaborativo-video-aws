/**
 * Amazon Chime SDK Meeting Manager
 * Gerencia criação de meetings, attendees e tokens
 */

const { 
  ChimeSDKMeetingsClient, 
  CreateMeetingCommand, 
  CreateAttendeeCommand,
  DeleteMeetingCommand,
  GetMeetingCommand,
  ListAttendeesCommand
} = require('@aws-sdk/client-chime-sdk-meetings');

const chimeClient = new ChimeSDKMeetingsClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Cache de meetings ativos (em produção, usar DynamoDB)
const activeMeetings = new Map();

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

exports.handler = async (event) => {
  console.log('Chime Meeting Handler:', JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const path = event.path || event.rawPath || '';
    const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
    const body = event.body ? JSON.parse(event.body) : {};

    // POST /meeting/join - Criar ou entrar em uma reunião
    if (path.includes('/join') && method === 'POST') {
      return await handleJoinMeeting(body);
    }

    // POST /meeting/leave - Sair de uma reunião
    if (path.includes('/leave') && method === 'POST') {
      return await handleLeaveMeeting(body);
    }

    // DELETE /meeting - Encerrar reunião
    if (path.includes('/end') && method === 'POST') {
      return await handleEndMeeting(body);
    }

    // GET /meeting/info - Informações da reunião
    if (path.includes('/info')) {
      return await handleGetMeetingInfo(body);
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Rota não encontrada' }),
    };
  } catch (error) {
    console.error('Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * Criar ou entrar em uma reunião
 */
async function handleJoinMeeting(body) {
  const { roomId, odUserId } = body;

  if (!roomId || !odUserId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'roomId e odUserId são obrigatórios' }),
    };
  }

  try {
    let meeting;
    let isNewMeeting = false;

    // Verificar se já existe uma reunião para esta sala
    const existingMeetingId = activeMeetings.get(roomId);
    
    if (existingMeetingId) {
      try {
        // Verificar se a reunião ainda está ativa
        const getMeetingResponse = await chimeClient.send(new GetMeetingCommand({
          MeetingId: existingMeetingId
        }));
        meeting = getMeetingResponse.Meeting;
        console.log('Reunião existente encontrada:', meeting.MeetingId);
      } catch (e) {
        // Reunião não existe mais, criar nova
        console.log('Reunião expirou, criando nova...');
        activeMeetings.delete(roomId);
        meeting = null;
      }
    }

    // Criar nova reunião se necessário
    if (!meeting) {
      const createMeetingResponse = await chimeClient.send(new CreateMeetingCommand({
        ClientRequestToken: `${roomId}-${Date.now()}`,
        MediaRegion: process.env.AWS_REGION || 'us-east-1',
        ExternalMeetingId: roomId,
        MeetingFeatures: {
          Audio: {
            EchoReduction: 'AVAILABLE'
          },
          Video: {
            MaxResolution: 'HD'
          }
        }
      }));
      
      meeting = createMeetingResponse.Meeting;
      activeMeetings.set(roomId, meeting.MeetingId);
      isNewMeeting = true;
      console.log('Nova reunião criada:', meeting.MeetingId);
    }

    // Criar attendee para o usuário
    const createAttendeeResponse = await chimeClient.send(new CreateAttendeeCommand({
      MeetingId: meeting.MeetingId,
      ExternalUserId: odUserId,
      Capabilities: {
        Audio: 'SendReceive',
        Video: 'SendReceive',
        Content: 'SendReceive'
      }
    }));

    const attendee = createAttendeeResponse.Attendee;
    console.log('Attendee criado:', attendee.AttendeeId);

    // Listar outros participantes
    const listAttendeesResponse = await chimeClient.send(new ListAttendeesCommand({
      MeetingId: meeting.MeetingId
    }));

    const otherAttendees = (listAttendeesResponse.Attendees || [])
      .filter(a => a.ExternalUserId !== odUserId)
      .map(a => ({
        odAttendeeId: a.AttendeeId,
        odExternalUserId: a.ExternalUserId
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        meeting: {
          MeetingId: meeting.MeetingId,
          MediaPlacement: meeting.MediaPlacement,
          MediaRegion: meeting.MediaRegion,
          ExternalMeetingId: meeting.ExternalMeetingId
        },
        attendee: {
          AttendeeId: attendee.AttendeeId,
          ExternalUserId: attendee.ExternalUserId,
          JoinToken: attendee.JoinToken
        },
        isNewMeeting,
        otherAttendees
      }),
    };
  } catch (error) {
    console.error('Erro ao criar/entrar na reunião:', error);
    
    // Se for erro de reunião não encontrada, limpar cache e tentar novamente
    if (error.name === 'NotFoundException') {
      activeMeetings.delete(roomId);
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Sair de uma reunião (não encerra a reunião)
 */
async function handleLeaveMeeting(body) {
  const { meetingId, odAttendeeId } = body;

  // O Chime SDK automaticamente remove o attendee quando ele desconecta
  // Não precisamos fazer nada aqui, mas podemos logar
  console.log('Usuário saindo da reunião:', { meetingId, odAttendeeId });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}

/**
 * Encerrar uma reunião completamente
 */
async function handleEndMeeting(body) {
  const { roomId, meetingId } = body;

  try {
    const meetingIdToDelete = meetingId || activeMeetings.get(roomId);
    
    if (meetingIdToDelete) {
      await chimeClient.send(new DeleteMeetingCommand({
        MeetingId: meetingIdToDelete
      }));
      
      activeMeetings.delete(roomId);
      console.log('Reunião encerrada:', meetingIdToDelete);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Erro ao encerrar reunião:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Obter informações de uma reunião
 */
async function handleGetMeetingInfo(body) {
  const { roomId, meetingId } = body;

  try {
    const meetingIdToGet = meetingId || activeMeetings.get(roomId);
    
    if (!meetingIdToGet) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Reunião não encontrada' }),
      };
    }

    const getMeetingResponse = await chimeClient.send(new GetMeetingCommand({
      MeetingId: meetingIdToGet
    }));

    const listAttendeesResponse = await chimeClient.send(new ListAttendeesCommand({
      MeetingId: meetingIdToGet
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        meeting: getMeetingResponse.Meeting,
        attendees: listAttendeesResponse.Attendees
      }),
    };
  } catch (error) {
    console.error('Erro ao obter info da reunião:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
