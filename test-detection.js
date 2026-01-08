// Teste de detecção de perguntas
// Simula o caso real reportado

const suggestion = {
  question: "Como você garantiria que todas as medidas de segurança necessárias são seguidas ao transportar cargas perigosas em seu caminhão?",
  isRead: false
};

const transcription = "Como você garantiria que todas as medias de seguranças necessárias são seguidas ao transportar cargas perigosas em seu caminhão";

// Função de similaridade (copiada do código)
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Verificar se uma contém a outra
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Remover stop words
  const stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'na', 'no', 'para', 'com', 'por', 'sobre', 'sua', 'seu'];
  
  const words1 = s1.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  const words2 = s2.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Contar palavras em comum
  let matchCount = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      // Match exato
      if (w1 === w2) {
        matchCount += 1;
        break;
      }
      // Match parcial
      if (w1.length >= 4 && w2.length >= 4) {
        if (w1.includes(w2) || w2.includes(w1)) {
          matchCount += 0.8;
          break;
        }
      }
      // Match de raiz
      if (w1.length >= 4 && w2.length >= 4 && w1.substring(0, 4) === w2.substring(0, 4)) {
        matchCount += 0.6;
        break;
      }
    }
  }
  
  const similarity = (matchCount * 2) / (words1.length + words2.length);
  return Math.min(similarity, 1);
}

// Testar
const similarity = calculateSimilarity(transcription, suggestion.question);

console.log('=== TESTE DE DETECÇÃO ===\n');
console.log('Sugestão:', suggestion.question);
console.log('\nTranscrição:', transcription);
console.log('\n=== ANÁLISE ===');
console.log('Similaridade:', (similarity * 100).toFixed(2) + '%');
console.log('Threshold:', '25%');
console.log('Detectado?', similarity >= 0.25 ? '✅ SIM' : '❌ NÃO');

// Análise detalhada
const s1 = transcription.toLowerCase().trim();
const s2 = suggestion.question.toLowerCase().trim();
const stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'na', 'no', 'para', 'com', 'por', 'sobre', 'sua', 'seu'];

const words1 = s1.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
const words2 = s2.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

console.log('\n=== PALAVRAS COMPARADAS ===');
console.log('Transcrição:', words1.length, 'palavras:', words1.join(', '));
console.log('Sugestão:', words2.length, 'palavras:', words2.join(', '));

// Encontrar matches
console.log('\n=== MATCHES ===');
for (const w1 of words1) {
  for (const w2 of words2) {
    if (w1 === w2) {
      console.log(`✅ Exato: "${w1}" = "${w2}"`);
    } else if (w1.length >= 4 && w2.length >= 4) {
      if (w1.includes(w2) || w2.includes(w1)) {
        console.log(`🟡 Parcial: "${w1}" ≈ "${w2}"`);
      } else if (w1.substring(0, 4) === w2.substring(0, 4)) {
        console.log(`🟠 Raiz: "${w1}" ~ "${w2}"`);
      }
    }
  }
}
