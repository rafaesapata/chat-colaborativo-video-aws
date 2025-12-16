const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({});

const TRANSCRIPTIONS_TABLE = process.env.TRANSCRIPTIONS_TABLE;

exports.handler = async (event) => {
  const { connectionId, domainName, stage } = event.requestContext;
  
  const apigwClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });

  try {
    const body = JSON.parse(event.body);
    const { action, roomId, startTime, endTime } = body;

    if (action !== 'getTranscriptions') {
      return { statusCode: 400, body: 'Invalid action' };
    }

    if (!roomId) {
      return { statusCode: 400, body: 'Missing roomId' };
    }

    // Buscar transcrições da sala
    const transcriptions = await ddb.send(new QueryCommand({
      TableName: TRANSCRIPTIONS_TABLE,
      IndexName: 'RoomTranscriptionsIndex',
      KeyConditionExpression: 'roomId = :roomId AND #ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':roomId': roomId,
        ':start': startTime || 0,
        ':end': endTime || Date.now()
      },
      ScanIndexForward: true
    }));

    // Agrupar por falante e formatar
    const formattedTranscriptions = formatTranscriptions(transcriptions.Items);

    // Enviar transcrições agregadas
    const message = {
      type: 'transcriptions',
      data: {
        roomId,
        transcriptions: formattedTranscriptions,
        count: transcriptions.Items.length
      }
    };

    await apigwClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(message)
    }));

    // Trigger análise de IA se houver transcrições suficientes
    if (transcriptions.Items.length >= 10) {
      await triggerAIAnalysis(roomId, formattedTranscriptions);
    }

    return { statusCode: 200, body: 'Transcriptions sent' };
  } catch (error) {
    console.error('Error aggregating transcriptions:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};

function formatTranscriptions(items) {
  const grouped = {};

  items.forEach(item => {
    const speaker = item.speakerLabel || item.userId;
    
    if (!grouped[speaker]) {
      grouped[speaker] = [];
    }

    grouped[speaker].push({
      text: item.transcribedText,
      timestamp: item.timestamp,
      confidence: item.confidence
    });
  });

  return Object.entries(grouped).map(([speaker, segments]) => ({
    speaker,
    segments,
    fullText: segments.map(s => s.text).join(' ')
  }));
}

async function triggerAIAnalysis(roomId, transcriptions) {
  try {
    const payload = {
      roomId,
      transcriptions,
      analysisType: 'summary'
    };

    await lambdaClient.send(new InvokeCommand({
      FunctionName: process.env.AI_ANALYSIS_FUNCTION,
      InvocationType: 'Event', // Async
      Payload: JSON.stringify(payload)
    }));

    console.log('AI analysis triggered for room:', roomId);
  } catch (error) {
    console.error('Error triggering AI analysis:', error);
  }
}
