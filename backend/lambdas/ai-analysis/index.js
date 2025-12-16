const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const TRANSCRIPTIONS_TABLE = process.env.TRANSCRIPTIONS_TABLE;

exports.handler = async (event) => {
  try {
    const { roomId, transcriptions, analysisType = 'summary' } = event;

    if (!roomId || !transcriptions) {
      return { statusCode: 400, body: 'Missing required fields' };
    }

    // Preparar texto completo para análise
    const fullText = transcriptions
      .map(t => `${t.speaker}: ${t.fullText}`)
      .join('\n\n');

    let analysis;

    switch (analysisType) {
      case 'summary':
        analysis = await generateSummary(fullText);
        break;
      case 'sentiment':
        analysis = await analyzeSentiment(fullText);
        break;
      case 'actionItems':
        analysis = await extractActionItems(fullText);
        break;
      default:
        analysis = await generateSummary(fullText);
    }

    // Salvar análise no DynamoDB
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await ddb.send(new PutCommand({
      TableName: TRANSCRIPTIONS_TABLE,
      Item: {
        transcriptionId: analysisId,
        roomId,
        type: 'ai-analysis',
        analysisType,
        result: analysis,
        timestamp: Date.now()
      }
    }));

    console.log('AI analysis completed:', analysisId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        analysisId,
        analysisType,
        result: analysis
      })
    };
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};

async function generateSummary(text) {
  const prompt = `Analise a seguinte transcrição de uma reunião e forneça:
1. Um resumo executivo (2-3 parágrafos)
2. Principais tópicos discutidos
3. Decisões tomadas
4. Action items identificados

Transcrição:
${text}

Responda em formato JSON estruturado.`;

  const response = await invokeBedrockModel(prompt);
  return response;
}

async function analyzeSentiment(text) {
  const prompt = `Analise o sentimento geral da seguinte conversa e classifique como:
- Positivo
- Neutro
- Negativo

Também identifique os principais sentimentos expressos (ex: entusiasmo, preocupação, frustração).

Conversa:
${text}

Responda em formato JSON.`;

  const response = await invokeBedrockModel(prompt);
  return response;
}

async function extractActionItems(text) {
  const prompt = `Extraia todos os action items, tarefas e compromissos mencionados na seguinte conversa.
Para cada item, identifique:
- Descrição da tarefa
- Responsável (se mencionado)
- Prazo (se mencionado)
- Prioridade (se mencionado)

Conversa:
${text}

Responda em formato JSON com array de action items.`;

  const response = await invokeBedrockModel(prompt);
  return response;
}

async function invokeBedrockModel(prompt) {
  try {
    // Usar Claude 3 Sonnet
    const modelId = 'anthropic.claude-3-sonnet-20240229-v1:0';

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody.content[0].text;
  } catch (error) {
    console.error('Bedrock invocation error:', error);
    
    // Fallback para resposta simples se Bedrock falhar
    return {
      summary: 'Análise não disponível no momento',
      error: error.message
    };
  }
}
