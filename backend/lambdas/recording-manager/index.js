const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const RECORDINGS_BUCKET = process.env.RECORDINGS_BUCKET;
const RECORDINGS_TABLE = process.env.RECORDINGS_TABLE;

exports.handler = async (event) => {
  console.log('Recording Manager Event:', JSON.stringify(event, null, 2));

  // NOTA: NÃO adicionar headers CORS aqui se a Lambda Function URL já está configurada com CORS
  // Headers CORS duplicados causam erro: "multiple values '*, https://...'"
  // A Lambda Function URL já adiciona Access-Control-Allow-Origin automaticamente
  const headers = {
    'Content-Type': 'application/json',
    // CORS headers removidos - gerenciados pela Lambda Function URL
  };

  // Handle CORS preflight - retornar vazio, Lambda Function URL adiciona headers
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const path = event.path || event.rawPath || '';
    const body = event.body ? JSON.parse(event.body) : {};

    // Rota: Obter URL de upload
    if (path.includes('/upload-url')) {
      return await handleUploadUrl(body, headers);
    }

    // Rota: Obter URL de playback
    if (path.includes('/playback-url')) {
      return await handlePlaybackUrl(body, headers);
    }

    // Rota: Listar gravações do usuário
    if (path.includes('/list')) {
      return await handleListRecordings(body, headers);
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

// Gerar URL pré-assinada para upload
async function handleUploadUrl(body, headers) {
  const { filename, contentType, userLogin, roomId, meetingId, duration } = body;

  if (!filename || !userLogin || !roomId || !meetingId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Parâmetros obrigatórios: filename, userLogin, roomId, meetingId' }),
    };
  }

  const recordingKey = `recordings/${filename}`;
  const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Gerar URL pré-assinada para upload (válida por 1 hora)
  const command = new PutObjectCommand({
    Bucket: RECORDINGS_BUCKET,
    Key: recordingKey,
    ContentType: contentType || 'video/webm',
    Metadata: {
      userLogin,
      roomId,
      meetingId,
      recordingId,
    },
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  // Salvar metadados no DynamoDB
  await docClient.send(new PutCommand({
    TableName: RECORDINGS_TABLE,
    Item: {
      recordingId,
      userLogin,
      roomId,
      meetingId,
      recordingKey,
      duration: duration || 0,
      createdAt: Date.now(),
      status: 'uploading',
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 dias
    },
  }));

  console.log('URL de upload gerada:', recordingId);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      uploadUrl,
      recordingKey,
      recordingId,
    }),
  };
}

// Gerar URL pré-assinada para playback
async function handlePlaybackUrl(body, headers) {
  const { recordingKey, userLogin, recordingId, isAdmin } = body;

  if (!userLogin) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'userLogin é obrigatório' }),
    };
  }

  // Sanitizar userLogin da mesma forma que no upload
  const sanitizedUserLogin = userLogin.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 64);
  
  let key = recordingKey;

  // Se passou recordingId, buscar a key no DynamoDB
  if (recordingId && !recordingKey) {
    const result = await docClient.send(new GetCommand({
      TableName: RECORDINGS_TABLE,
      Key: { recordingId },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Gravação não encontrada' }),
      };
    }

    // Verificar se o usuário tem acesso (admin pode acessar qualquer gravação)
    if (!isAdmin) {
      const savedUserLogin = result.Item.userLogin;
      if (savedUserLogin !== userLogin && savedUserLogin !== sanitizedUserLogin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Acesso negado' }),
        };
      }
    }

    key = result.Item.recordingKey;
  }

  if (!key) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'recordingKey ou recordingId é obrigatório' }),
    };
  }

  // Verificar se a key pertence ao usuário (segurança) - admin pode acessar qualquer gravação
  if (!isAdmin && !key.includes(userLogin) && !key.includes(sanitizedUserLogin)) {
    console.log('Acesso negado - key:', key, 'userLogin:', userLogin, 'sanitized:', sanitizedUserLogin);
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Acesso negado a esta gravação' }),
    };
  }

  // Gerar URL pré-assinada para download (válida por 2 horas)
  const command = new GetObjectCommand({
    Bucket: RECORDINGS_BUCKET,
    Key: key,
  });

  const playbackUrl = await getSignedUrl(s3Client, command, { expiresIn: 7200 });

  console.log('URL de playback gerada para:', key);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ playbackUrl }),
  };
}

// Listar gravações do usuário
async function handleListRecordings(body, headers) {
  const { userLogin, isAdmin } = body;

  if (!userLogin) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'userLogin é obrigatório' }),
    };
  }

  // Se é admin, listar todas as gravações
  if (isAdmin) {
    const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
    const result = await docClient.send(new ScanCommand({
      TableName: RECORDINGS_TABLE,
      Limit: 200,
    }));
    
    // Ordenar por data (mais recentes primeiro)
    const recordings = (result.Items || []).sort((a, b) => b.createdAt - a.createdAt);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        recordings,
      }),
    };
  }

  const result = await docClient.send(new QueryCommand({
    TableName: RECORDINGS_TABLE,
    IndexName: 'UserRecordingsIndex',
    KeyConditionExpression: 'userLogin = :userLogin',
    ExpressionAttributeValues: {
      ':userLogin': userLogin,
    },
    ScanIndexForward: false, // Mais recentes primeiro
    Limit: 50,
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      recordings: result.Items || [],
    }),
  };
}
