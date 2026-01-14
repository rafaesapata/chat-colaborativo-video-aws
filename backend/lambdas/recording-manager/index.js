const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

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

    // Rota: Confirmar upload concluído
    if (path.includes('/confirm-upload')) {
      return await handleConfirmUpload(body, headers);
    }

    // Rota: Verificar e corrigir gravações órfãs (admin/cron)
    if (path.includes('/fix-orphaned')) {
      return await handleFixOrphanedRecordings(body, headers);
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
  let recording = null;

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

    recording = result.Item;

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
    
    // AUTO-FIX: Se status é "uploading", verificar se arquivo existe no S3 e corrigir
    if (recording.status === 'uploading') {
      console.log('Gravação com status uploading, verificando S3...', recordingId);
      try {
        const headResult = await s3Client.send(new HeadObjectCommand({
          Bucket: RECORDINGS_BUCKET,
          Key: key,
        }));
        
        const fileSize = headResult.ContentLength || 0;
        if (fileSize > 0) {
          // Arquivo existe! Corrigir status automaticamente
          const estimatedDuration = Math.round(fileSize / 300000); // ~300KB/s
          
          await docClient.send(new UpdateCommand({
            TableName: RECORDINGS_TABLE,
            Key: { recordingId },
            UpdateExpression: 'SET #status = :status, #fileSize = :fileSize, #duration = :duration, #autoFixedAt = :autoFixedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#fileSize': 'fileSize',
              '#duration': 'recordingDuration',
              '#autoFixedAt': 'autoFixedAt',
            },
            ExpressionAttributeValues: {
              ':status': 'completed',
              ':fileSize': fileSize,
              ':duration': recording.duration || estimatedDuration,
              ':autoFixedAt': Date.now(),
            },
          }));
          console.log('Status corrigido automaticamente para completed:', recordingId);
        }
      } catch (s3Error) {
        console.log('Arquivo não encontrado no S3 para gravação com status uploading:', recordingId);
        // Não retornar erro - deixar o fluxo continuar para mostrar mensagem apropriada
      }
    }
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

// Confirmar que o upload foi concluído com sucesso
async function handleConfirmUpload(body, headers) {
  const { recordingId, userLogin, fileSize, duration } = body;

  if (!recordingId || !userLogin) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'recordingId e userLogin são obrigatórios' }),
    };
  }

  try {
    // Buscar registro no DynamoDB
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

    const recording = result.Item;

    // Verificar se o usuário é o dono
    const sanitizedUserLogin = userLogin.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 64);
    if (recording.userLogin !== userLogin && recording.userLogin !== sanitizedUserLogin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Acesso negado' }),
      };
    }

    // Verificar se o arquivo existe no S3
    let s3FileSize = 0;
    try {
      const headResult = await s3Client.send(new HeadObjectCommand({
        Bucket: RECORDINGS_BUCKET,
        Key: recording.recordingKey,
      }));
      s3FileSize = headResult.ContentLength || 0;
      console.log('Arquivo encontrado no S3:', recording.recordingKey, 'Tamanho:', s3FileSize);
    } catch (s3Error) {
      console.error('Arquivo não encontrado no S3:', recording.recordingKey, s3Error.message);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Arquivo não encontrado no S3' }),
      };
    }

    // Atualizar status para completed
    await docClient.send(new UpdateCommand({
      TableName: RECORDINGS_TABLE,
      Key: { recordingId },
      UpdateExpression: 'SET #status = :status, #fileSize = :fileSize, #duration = :duration, #completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#fileSize': 'fileSize',
        '#duration': 'recordingDuration',
        '#completedAt': 'completedAt',
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':fileSize': fileSize || s3FileSize,
        ':duration': duration || recording.duration || 0,
        ':completedAt': Date.now(),
      },
    }));

    console.log('Upload confirmado:', recordingId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Upload confirmado',
        recordingId,
        fileSize: fileSize || s3FileSize,
      }),
    };
  } catch (error) {
    console.error('Erro ao confirmar upload:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Verificar e corrigir gravações órfãs (status "uploading" mas arquivo existe no S3)
async function handleFixOrphanedRecordings(body, headers) {
  const { maxAge = 3600000 } = body; // Default: 1 hora

  try {
    console.log('Verificando gravações órfãs... maxAge:', maxAge);

    // Buscar todas as gravações com status "uploading"
    const result = await docClient.send(new ScanCommand({
      TableName: RECORDINGS_TABLE,
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'uploading' },
    }));

    const orphanedRecordings = result.Items || [];
    console.log('Gravações com status uploading:', orphanedRecordings.length);

    const now = Date.now();
    console.log('Timestamp atual:', now);
    
    const fixed = [];
    const failed = [];
    const tooRecent = [];

    for (const recording of orphanedRecordings) {
      const age = now - recording.createdAt;
      console.log('Processando:', recording.recordingId, 'createdAt:', recording.createdAt, 'age:', age, 'maxAge:', maxAge);
      
      // Ignorar gravações muito recentes (podem estar em upload ainda)
      if (age < maxAge) {
        console.log('Gravação muito recente, ignorando:', recording.recordingId);
        tooRecent.push(recording.recordingId);
        continue;
      }

      try {
        console.log('Verificando S3 para:', recording.recordingKey);
        // Verificar se o arquivo existe no S3
        const headResult = await s3Client.send(new HeadObjectCommand({
          Bucket: RECORDINGS_BUCKET,
          Key: recording.recordingKey,
        }));

        const fileSize = headResult.ContentLength || 0;
        console.log('Arquivo encontrado no S3:', recording.recordingKey, 'Tamanho:', fileSize);

        // Arquivo existe! Atualizar status para completed
        if (fileSize > 0) {
          // Estimar duração baseado no tamanho (aproximadamente 300KB/s para video/webm)
          const estimatedDuration = Math.round(fileSize / 300000);

          await docClient.send(new UpdateCommand({
            TableName: RECORDINGS_TABLE,
            Key: { recordingId: recording.recordingId },
            UpdateExpression: 'SET #status = :status, #fileSize = :fileSize, #duration = :duration, #fixedAt = :fixedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#fileSize': 'fileSize',
              '#duration': 'recordingDuration',
              '#fixedAt': 'fixedAt',
            },
            ExpressionAttributeValues: {
              ':status': 'completed',
              ':fileSize': fileSize,
              ':duration': recording.duration || estimatedDuration,
              ':fixedAt': now,
            },
          }));

          fixed.push({
            recordingId: recording.recordingId,
            recordingKey: recording.recordingKey,
            fileSize,
            estimatedDuration,
          });
          console.log('Gravação corrigida:', recording.recordingId);
        }
      } catch (s3Error) {
        console.log('Erro S3 para', recording.recordingId, ':', s3Error.name, s3Error.message);
        // Arquivo não existe no S3 ou acesso negado - marcar como failed
        const isNotFound = s3Error.name === 'NotFound' || 
                          s3Error.$metadata?.httpStatusCode === 404 ||
                          s3Error.$metadata?.httpStatusCode === 403 ||
                          s3Error.name === '403';
        
        if (isNotFound) {
          await docClient.send(new UpdateCommand({
            TableName: RECORDINGS_TABLE,
            Key: { recordingId: recording.recordingId },
            UpdateExpression: 'SET #status = :status, #failedAt = :failedAt, #failReason = :failReason',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#failedAt': 'failedAt',
              '#failReason': 'failReason',
            },
            ExpressionAttributeValues: {
              ':status': 'failed',
              ':failedAt': now,
              ':failReason': s3Error.$metadata?.httpStatusCode === 403 ? 'Arquivo não encontrado no S3 (403)' : 'Arquivo não encontrado no S3',
            },
          }));

          failed.push({
            recordingId: recording.recordingId,
            recordingKey: recording.recordingKey,
            reason: s3Error.$metadata?.httpStatusCode === 403 ? 'Arquivo não encontrado no S3 (403)' : 'Arquivo não encontrado no S3',
          });
          console.log('Gravação marcada como failed:', recording.recordingId);
        } else {
          console.log('Erro S3 não tratado:', s3Error.name);
        }
      }
    }

    console.log('Resultado final - fixed:', fixed.length, 'failed:', failed.length, 'tooRecent:', tooRecent.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        summary: {
          total: orphanedRecordings.length,
          fixed: fixed.length,
          failed: failed.length,
          tooRecent: tooRecent.length,
        },
        fixed,
        failed,
        tooRecent,
      }),
    };
  } catch (error) {
    console.error('Erro ao verificar gravações órfãs:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
