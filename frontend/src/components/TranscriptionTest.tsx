import { useState } from 'react';

interface TranscriptionTestProps {
  onAddTranscription: (text: string) => void;
}

export default function TranscriptionTest({ onAddTranscription }: TranscriptionTestProps) {
  const [isOpen, setIsOpen] = useState(false);

  const testTranscriptions = [
    "Olá, como estão todos?",
    "Bom dia equipe!",
    "Vamos começar a reunião",
    "Alguém tem alguma dúvida?",
    "Perfeito, obrigado!"
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 bg-purple-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-mono hover:bg-purple-700 transition z-50"
      >
        🧪 Testar Transcrição
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 bg-purple-900 text-white p-4 rounded-lg shadow-2xl max-w-md z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">🧪 Teste de Transcrição</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-purple-300 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-purple-200 mb-3">
          Clique para adicionar transcrições de teste:
        </p>
        {testTranscriptions.map((text, index) => (
          <button
            key={index}
            onClick={() => {
              onAddTranscription(text);
              console.log('[TEST] Transcrição adicionada:', text);
            }}
            className="w-full text-left px-3 py-2 bg-purple-800 hover:bg-purple-700 rounded text-sm transition"
          >
            {text}
          </button>
        ))}
        
        <button
          onClick={() => {
            testTranscriptions.forEach((text, index) => {
              setTimeout(() => {
                onAddTranscription(text);
                console.log('[TEST] Transcrição adicionada:', text);
              }, index * 1000);
            });
          }}
          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold mt-3"
        >
          ▶️ Adicionar Todas (1s cada)
        </button>
      </div>
    </div>
  );
}
