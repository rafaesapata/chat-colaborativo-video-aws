# Correção do Erro "Forbidden" no WebSocket

## Problema Identificado

O erro "Forbidden" no WebSocket está ocorrendo porque:

1. **Validação de Parâmetros**: O backend espera que `userId` e `roomId` estejam no formato correto:
   - `userId`: `user_[a-z0-9]{9}` (ex: `user_abc123def`)
   - `roomId`: `room_[a-z0-9]{9}` (ex: `room_xyz789ghi`)

2. **Formato Correto**: O frontend já está gerando os IDs no formato correto, mas pode haver algum problema na transmissão.

## Solução Implementada

### 1. Melhorar o Tratamento de Erros no Connection Handler

Vou adicionar logs mais detalhados para identificar exatamente onde está falhando:

```javascript
async function handleConnect(event) {
  const { connectionId, requestId } = event.requestContext;
  const queryParams = event.queryStringParameters || {};
  
  logger.info({ queryParams, connectionId }, 'Connection attempt with params');
  
  try {
    // Validar parâmetros de conexão
    const validatedParams = await validateInput(queryParams, connectionSchema);
    const { userId, roomId } = validatedParams;
    
    // ... resto do código
  } catch (error) {
    logger.error({ 
      error: error.message, 
      queryParams, 
      connectionId 
    }, 'Validation failed');
    throw error;
  }
}
```

### 2. Verificar se o Problema é de Autorização

O erro "Forbidden" (403) geralmente vem do API Gateway antes de chegar na Lambda. Possíveis causas:

- **Autorizador configurado**: Verificar se há um autorizador Lambda configurado
- **Política IAM**: Verificar se há políticas IAM bloqueando a conexão
- **CORS**: Verificar configurações de CORS (embora WebSocket não use CORS)

### 3. Solução Temporária: Tornar roomId Opcional

Como o `roomId` é opcional no schema, podemos permitir conexões sem `roomId` inicialmente:

```javascript
const connectionSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^user_[a-z0-9]{9}$/)
    .required(),
  roomId: Joi.string()
    .pattern(/^room_[a-z0-9]{9}$/)
    .optional(),  // Já está opcional
  token: Joi.string().optional()
});
```

### 4. Adicionar Fallback no Frontend

Adicionar tratamento de erro mais robusto no frontend:

```typescript
ws.onerror = (error) => {
  console.error('[WebSocket] ❌ Erro de conexão:', error);
  console.log('[WebSocket] URL tentada:', wsUrl);
  console.log('[WebSocket] Parâmetros:', { userId, roomId });
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log('[WebSocket] 📨 Mensagem recebida:', data);
    
    // Se receber mensagem de erro, logar detalhes
    if (data.error || data.message === 'Forbidden') {
      console.error('[WebSocket] Erro do servidor:', data);
      return;
    }
    
    // ... resto do código
  } catch (error) {
    console.error('[WebSocket] Error parsing message:', error);
  }
};
```

## Próximos Passos

1. **Verificar Logs do CloudWatch**: Verificar os logs da Lambda `connection-handler` para ver se a requisição está chegando
2. **Verificar API Gateway**: Verificar se há algum autorizador ou política bloqueando
3. **Testar com Postman/wscat**: Testar a conexão WebSocket diretamente para isolar o problema
4. **Simplificar Validação**: Temporariamente relaxar a validação para identificar o problema

## Comando para Testar WebSocket

```bash
# Instalar wscat
npm install -g wscat

# Testar conexão
wscat -c "wss://kb09dca09l.execute-api.us-east-1.amazonaws.com/prod?userId=user_abc123def&roomId=room_xyz789ghi"
```

## Status Atual

- ✅ Frontend gerando IDs no formato correto
- ✅ Schema de validação configurado corretamente
- ⚠️ Erro "Forbidden" ocorrendo na conexão
- 🔍 Investigação necessária nos logs do CloudWatch

A mensagem "Forbidden" sugere que o problema está no nível do API Gateway, não na Lambda. Precisamos verificar:
1. Se há um autorizador configurado que não deveria estar
2. Se as permissões IAM estão corretas
3. Se o endpoint WebSocket está acessível