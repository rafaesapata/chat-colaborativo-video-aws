# Regra de Conclusão de Features

## ⚠️ REGRA CRÍTICA: Nunca deixar nada incompleto

### Obrigatório:
- Sempre concluir features até o fim antes de passar para outra tarefa
- Não deixar código pela metade ou parcialmente implementado
- Garantir que todas as partes de uma feature estejam funcionando (frontend, backend, integração)
- Testar a feature completa antes de considerar finalizada
- Fazer deploy de todas as partes necessárias (Lambda, Frontend, etc.)

### Checklist de Conclusão:
1. ✅ Código implementado completamente
2. ✅ Integração frontend/backend funcionando
3. ✅ Tratamento de erros implementado
4. ✅ Deploy realizado (backend + frontend)
5. ✅ Cache do CloudFront invalidado (se aplicável)
6. ✅ Testado em produção

### Proibido:
- Deixar TODOs no código sem resolver
- Implementar apenas o frontend sem o backend (ou vice-versa)
- Fazer commit de código que não compila ou não funciona
- Abandonar uma feature no meio para começar outra
- Deixar funções vazias ou com `// implementar depois`

### Exemplo:
```typescript
// ❌ ERRADO - Feature incompleta
async function saveJob(job: Job) {
  // TODO: implementar chamada ao backend
  localStorage.setItem('job', JSON.stringify(job));
}

// ✅ CORRETO - Feature completa
async function saveJob(job: Job): Promise<Job> {
  const response = await fetch(`${API_URL}/jobs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job)
  });
  
  if (!response.ok) {
    throw new Error('Falha ao salvar vaga');
  }
  
  return response.json();
}
```

### Quando uma feature é considerada completa:
- Usuário consegue usar a funcionalidade de ponta a ponta
- Dados são persistidos corretamente no banco de dados
- Erros são tratados e exibidos ao usuário
- Interface reflete o estado real dos dados
