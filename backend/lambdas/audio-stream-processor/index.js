const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

const TRANSCRIPTIONS_TABLE = process.env.TRANSCRIPTIONS_TABLE;
const AUDIO_BUCKET = process.env.AUDIO_BUCKET;

exports.handler = async (event) => {
  const { connectionId, domainName, stage } = event.requestContext;
  
  const apigwClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });

  try {
    const body = JSON.parse(event.body);
    const { action, roomId, userId, audioData, language = 'pt-BR', sessionId } = body;

    if (action !== 'sendAudio') {
      return { statusCode: 400, body: 'Invalid action' };
    }

    if (!roomId || !userId || !audioData) {
      return { statusCode: 400, body: 'Missing required fields' };
    }

    // Decodificar audio base64
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Salvar audio no S3 (opcional)
    const audioKey = `${roomId}/${sessionId || Date.now()}_${userId}.webm`;
    await s3Client.send(new PutObjectCommand({
      Bucket: AUDIO_BUCKET,
      Key: audioKey,
      Body: audioBuffer,
      ContentType: 'audio/webm'
    }));

    // Processar transcrição
    const transcription = await transcribeAudio(audioBuffer, language);

    if (transcription) {
      const transcriptionId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = Date.now();

      // Salvar transcrição no DynamoDB
      const transcriptionItem = {
        transcriptionId,
        roomId,
        userId,
        audioUrl: `s3://${AUDIO_BUCKET}/${audioKey}`,
        transcribedText: transcription.text,
        confidence: transcription.confidence,
        speakerLabel: transcription.speakerLabel,
        timestamp,
        language,
        isPartial: transcription.isPartial || false
      };

      await ddb.send(new PutCommand({
        TableName: TRANSCRIPTIONS_TABLE,
        Item: transcriptionItem
      }));

      // Enviar transcrição em tempo real via WebSocket
      const message = {
        type: 'transcription',
        data: transcriptionItem
      };

      await apigwClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(message)
      }));

      console.log('Transcription saved:', transcriptionId);
    }

    return { statusCode: 200, body: 'Audio processed' };
  } catch (error) {
    console.error('Error processing audio:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};

async function transcribeAudio(audioBuffer, language) {
  try {
    const transcribeClient = new TranscribeStreamingClient({ region: process.env.AWS_REGION });

    // Configurar stream de transcrição
    const audioStream = async function* () {
      yield { AudioEvent: { AudioChunk: audioBuffer } };
    };

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: language,
      MediaSampleRateHertz: 48000,
      MediaEncoding: 'pcm',
      EnablePartialResultsStabilization: true,
      PartialResultsStability: 'high',
      ShowSpeakerLabel: true,
      MaxSpeakerLabels: 5,
      AudioStream: audioStream()
    });

    const response = await transcribeClient.send(command);

    // Processar resultados
    let transcribedText = '';
    let confidence = 0;
    let speakerLabel = null;
    let isPartial = false;

    for await (const event of response.TranscriptResultStream) {
      if (event.TranscriptEvent) {
        const results = event.TranscriptEvent.Transcript.Results;
        
        if (results && results.length > 0) {
          const result = results[0];
          isPartial = result.IsPartial;
          
          if (result.Alternatives && result.Alternatives.length > 0) {
            const alternative = result.Alternatives[0];
            transcribedText = alternative.Transcript;
            confidence = alternative.Confidence || 0;
            
            if (alternative.Items && alternative.Items.length > 0) {
              speakerLabel = alternative.Items[0].SpeakerLabel;
            }
          }
        }
      }
    }

    return {
      text: transcribedText,
      confidence,
      speakerLabel,
      isPartial
    };
  } catch (error) {
    console.error('Transcription error:', error);
    return null;
  }
}
