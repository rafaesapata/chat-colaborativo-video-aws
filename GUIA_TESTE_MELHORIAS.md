# 🧪 Guia de Teste - Melhorias Implementadas

## Como Testar as Novas Funcionalidades

### 🌐 URL da Aplicação
**https://livechat.ai.udstec.io**

---

## 1. 🎤 Indicadores Visuais de Quem Está Falando

### Como Testar:
1. Abra a aplicação em **2 abas diferentes** (ou 2 navegadores)
2. Permita acesso à câmera e microfone em ambas
3. **Fale em uma das abas**
4. Observe na outra aba:
   - ✅ Borda verde pulsante ao redor do vídeo
   - ✅ Ícone de microfone (🎤) aparece
   - ✅ Efeito de pulso no fundo do vídeo

### O que Verificar:
- [ ] Indicador aparece em < 200ms após começar a falar
- [ ] Indicador desaparece quando para de falar
- [ ] Funciona para múltiplos usuários simultaneamente
- [ ] Vídeo local também mostra indicador

---

## 2. 🔴 Sistema de Notificações (Toasts)

### Como Testar:

#### Teste 1: Conexão
1. Abra a aplicação
2. **Observe**: Toast verde "Conectado ao servidor!"
3. Desconecte a internet
4. **Observe**: Toast amarelo "Desconectado do servidor..."

#### Teste 2: Participantes
1. Abra em 2 abas
2. **Observe**: Toast azul "X participante(s) na sala"

#### Teste 3: Erro de Permissão
1. Bloqueie permissões de câmera/microfone no navegador
2. Recarregue a página
3. **Observe**: Toast vermelho com erro de permissão

### O que Verificar:
- [ ] Toasts aparecem no topo da tela
- [ ] Cores corretas (verde/vermelho/amarelo/azul)
- [ ] Desaparecem automaticamente após 5s
- [ ] Podem ser fechados manualmente (X)
- [ ] Múltiplos toasts empilham verticalmente

---

## 3. 📊 Qualidade Adaptativa de Vídeo

### Como Testar:

#### Teste 1: Indicador de Qualidade
1. Abra a aplicação
2. **Observe** no canto superior direito:
   - 🟢 HD (conexão boa)
   - 🟡 SD (conexão média)
   - 🔴 Baixa (conexão ruim)

#### Teste 2: Simulação de Conexão Ruim
1. Abra DevTools (F12)
2. Vá em **Network** → **Throttling**
3. Selecione "Fast 3G" ou "Slow 3G"
4. **Observe**: Qualidade diminui automaticamente
5. Volte para "No throttling"
6. **Observe**: Qualidade aumenta gradualmente

### O que Verificar:
- [ ] Badge de qualidade sempre visível
- [ ] Ajuste automático em ~5-10 segundos
- [ ] Vídeo não trava durante ajuste
- [ ] Qualidade melhora quando conexão estabiliza

---

## 4. 📝 Transcrição em Tempo Real Melhorada

### Como Testar:

#### Teste 1: Interface
1. Abra a aplicação
2. Role até a seção "Transcrição em Tempo Real"
3. **Observe**:
   - ✅ Ícone de documento
   - ✅ Mensagem "Aguardando transcrições..."
   - ✅ Design limpo com gradiente

#### Teste 2: Transcrições
1. Fale algo (se transcrição estiver ativa)
2. **Observe**:
   - ✅ Card com sua transcrição
   - ✅ Nome do usuário colorido
   - ✅ Timestamp (HH:MM:SS)
   - ✅ Ícone de microfone se estiver falando
   - ✅ Borda verde quando falando

#### Teste 3: Múltiplos Usuários
1. Abra em 2 abas
2. Fale em cada uma alternadamente
3. **Observe**:
   - ✅ Cores diferentes para cada usuário
   - ✅ Scroll automático para última transcrição
   - ✅ Histórico das últimas 10 transcrições

### O que Verificar:
- [ ] Cores consistentes por usuário
- [ ] Timestamps corretos
- [ ] Scroll automático funciona
- [ ] Indicador de gravação (ponto verde) quando alguém fala
- [ ] Scrollbar customizada (cinza suave)

---

## 5. 🔄 Reconexão Automática

### Como Testar:

#### Teste 1: Falha de Conexão WebRTC
1. Abra em 2 abas
2. Feche uma aba abruptamente
3. Na outra aba, **observe**:
   - ✅ Toast vermelho "Usuário desconectado"
   - ✅ Vídeo removido após 5 segundos

#### Teste 2: Falha de Rede
1. Durante uma chamada, desconecte a internet por 5 segundos
2. Reconecte
3. **Observe**:
   - ✅ Toast "Tentando reconectar..."
   - ✅ Reconexão automática em ~3 segundos
   - ✅ Toast verde "Conectado ao servidor!"

### O que Verificar:
- [ ] Reconexão automática funciona
- [ ] Não precisa recarregar a página
- [ ] Vídeos voltam após reconexão
- [ ] Notificações claras do que está acontecendo

---

## 🎯 Checklist Completo de Testes

### Funcionalidades Básicas:
- [ ] Vídeo local aparece (canto inferior direito)
- [ ] Vídeos remotos aparecem (grid principal)
- [ ] Botões de mute/unmute funcionam
- [ ] Botões de câmera on/off funcionam
- [ ] Chat de texto funciona

### Novas Funcionalidades:
- [ ] Indicador de quem está falando (borda verde)
- [ ] Toasts de notificação aparecem
- [ ] Badge de qualidade visível
- [ ] Qualidade ajusta automaticamente
- [ ] Transcrições aparecem formatadas
- [ ] Cores diferentes por usuário
- [ ] Timestamps corretos
- [ ] Reconexão automática funciona

### Performance:
- [ ] Latência de vídeo < 500ms
- [ ] Indicadores de áudio < 200ms
- [ ] Ajuste de qualidade em ~5s
- [ ] Sem travamentos ou lags
- [ ] CPU < 50% (verificar no Task Manager)

---

## 🐛 Problemas Conhecidos

### Safari:
- ⚠️ AudioContext pode precisar de interação do usuário primeiro
- ⚠️ Permissões de mídia mais restritivas

### Firefox:
- ✅ Totalmente funcional
- ⚠️ Indicadores de áudio podem ter delay de ~100ms

### Chrome/Edge:
- ✅ Melhor performance
- ✅ Todas funcionalidades suportadas

---

## 📊 Métricas Esperadas

### Latência:
- Vídeo: < 500ms
- Áudio: < 300ms
- Indicadores visuais: < 200ms
- Toasts: < 100ms

### Qualidade:
- HD (boa conexão): 1280x720 @ 30fps
- SD (média conexão): 640x480 @ 24fps
- Baixa (ruim conexão): 320x240 @ 15fps

### Uso de Recursos:
- CPU: 30-50%
- RAM: ~200MB por aba
- Bandwidth: 500KB/s - 2.5MB/s (dependendo da qualidade)

---

## 🆘 Troubleshooting

### Problema: Indicadores de áudio não aparecem
**Solução**: 
1. Verifique se o microfone está funcionando
2. Fale mais alto (threshold é 30dB)
3. Recarregue a página

### Problema: Qualidade não ajusta
**Solução**:
1. Aguarde 10-15 segundos
2. Verifique conexão de internet
3. Abra DevTools e veja console para erros

### Problema: Toasts não aparecem
**Solução**:
1. Verifique se há bloqueador de pop-ups
2. Limpe cache do navegador
3. Recarregue a página

### Problema: Vídeo não conecta
**Solução**:
1. Verifique permissões de câmera/microfone
2. Teste em navegador diferente
3. Verifique firewall/VPN

---

## 📞 Suporte

Para reportar bugs ou problemas:
1. Abra DevTools (F12)
2. Vá em Console
3. Copie os logs de erro
4. Crie uma issue no GitHub: https://github.com/rafaesapata/chat-colaborativo-video-aws/issues

---

**Última atualização**: 16/12/2024
**Versão**: 2.0.0
