# Regras de Implementação - Sem Mocks ou Simulações

## ⚠️ REGRA CRÍTICA: Nunca usar dados mockados ou simulados

### Proibido:
- Dados hardcoded ou mockados
- Funções que retornam dados fake/simulados
- localStorage como fonte principal de dados (usar apenas como cache temporário)
- Respostas simuladas de API
- Dados de exemplo estáticos

### Obrigatório:
- Sempre integrar com o backend real (DynamoDB, APIs, etc.)
- Buscar dados do servidor/banco de dados
- Implementar chamadas de API reais
- Usar cache apenas como otimização, não como fonte de verdade
- Tratar erros de conexão adequadamente

### Fontes de Dados:
- **Histórico de reuniões**: DynamoDB via `/admin/history/list` e `/admin/history/save`
- **Vagas de emprego**: DynamoDB via `/jobs/list`, `/jobs/create`, `/jobs/update`, `/jobs/delete`
- **Configurações de IA**: DynamoDB via `/interview/config/get` e `/interview/config/save`
- **Gravações**: S3 + DynamoDB via Recording API
- **Usuários/Auth**: Cognito + backoffice.udstec.io

### Exemplo de implementação correta:
```typescript
// ✅ CORRETO - Buscar do backend
async function getHistory(userLogin: string): Promise<MeetingRecord[]> {
  const response = await fetch(`${API_URL}/admin/history/list`, {
    method: 'POST',
    body: JSON.stringify({ userLogin, filters: { userLogin } })
  });
  return (await response.json()).history;
}

// ❌ ERRADO - Dados mockados
function getHistory(userLogin: string): MeetingRecord[] {
  return localStorage.getItem(`history_${userLogin}`) || [];
}
```
