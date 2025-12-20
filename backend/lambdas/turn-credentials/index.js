/**
 * Lambda para fornecer credenciais TURN dinâmicas
 * Usa servidores TURN públicos confiáveis + opção de configurar servidor próprio
 */

const TURN_SECRET = process.env.TURN_SECRET || '';
const TURN_SERVER = process.env.TURN_SERVER || '';
const CREDENTIAL_TTL = 86400; // 24 horas

// Gerar credenciais TURN temporárias (TURN REST API - RFC 5766)
function generateTurnCredentials(userId) {
  const timestamp = Math.floor(Date.now() / 1000) + CREDENTIAL_TTL;
  const username = `${timestamp}:${userId}`;
  
  if (TURN_SECRET) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha1', TURN_SECRET);
    hmac.update(username);
    const credential = hmac.digest('base64');
    return { username, credential };
  }
  
  return null;
}

// Servidores STUN/TURN públicos confiáveis
function getPublicIceServers() {
  return [
    // Google STUN (sempre disponível)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    
    // Cloudflare STUN
    { urls: 'stun:stun.cloudflare.com:3478' },
    
    // Open Relay Project TURN (público, limitado)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    
    // Metered TURN (público, limitado)
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'e8dd65c92eb0c9e6e3c6e8f0',
      credential: 'uWdWNmkhvyqTmhD0'
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: 'e8dd65c92eb0c9e6e3c6e8f0',
      credential: 'uWdWNmkhvyqTmhD0'
    },
    {
      urls: 'turn:a.relay.metered.ca:443?transport=tcp',
      username: 'e8dd65c92eb0c9e6e3c6e8f0',
      credential: 'uWdWNmkhvyqTmhD0'
    }
  ];
}

exports.handler = async (event) => {
  console.log('[TURN] Request:', JSON.stringify(event));
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
  
  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    let body = {};
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }
    
    const userId = body.userId || 'anonymous';
    const iceServers = [];
    
    // Se temos servidor TURN próprio configurado, usar credenciais dinâmicas
    if (TURN_SERVER && TURN_SECRET) {
      const creds = generateTurnCredentials(userId);
      if (creds) {
        iceServers.push(
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: `turn:${TURN_SERVER}:3478`,
            username: creds.username,
            credential: creds.credential
          },
          {
            urls: `turn:${TURN_SERVER}:3478?transport=tcp`,
            username: creds.username,
            credential: creds.credential
          },
          {
            urls: `turns:${TURN_SERVER}:5349`,
            username: creds.username,
            credential: creds.credential
          }
        );
      }
    }
    
    // Adicionar servidores públicos como fallback
    const publicServers = getPublicIceServers();
    
    // Se não temos servidor próprio, usar apenas públicos
    if (iceServers.length === 0) {
      iceServers.push(...publicServers);
    } else {
      // Adicionar públicos como fallback
      iceServers.push(...publicServers.slice(0, 4)); // Apenas STUN públicos
    }
    
    const response = {
      iceServers,
      ttl: CREDENTIAL_TTL,
      timestamp: Date.now()
    };
    
    console.log('[TURN] Response:', JSON.stringify({ serverCount: iceServers.length }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };
    
  } catch (error) {
    console.error('[TURN] Error:', error);
    
    // Em caso de erro, retornar servidores públicos
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        iceServers: getPublicIceServers(),
        ttl: CREDENTIAL_TTL,
        timestamp: Date.now(),
        fallback: true
      })
    };
  }
};
