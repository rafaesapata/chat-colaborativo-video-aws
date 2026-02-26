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
        className="fixed bottom-20 right-4 bg-primary text-white px-4 py-3 rounded-lg shadow-2xl text-sm font-semibold hover:bg-primary-600 transition z-50 animate-pulse hover:animate-none flex items-center gap-2"
      >
        <span className="text-lg">🧪</span>
        <div className="text-left">
          <div>Testar Transcrição</div>
          <div className="text-xs font-normal opacity-90">Clique aqui!</div>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 bg-primary-900 text-white p-4 rounded-lg shadow-2xl max-w-md z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">🧪 Teste de Transcrição</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-primary-300 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-primary-200 mb-3">
          Clique para adicionar transcrições de teste:
        </p>
        {testTranscriptions.map((text, index) => (
          <button
            key={index}
            onClick={() => {
              onAddTranscription(text);
              console.log('[TEST] Transcrição adicionada:', text);
            }}
            className="w-full text-left px-3 py-2 bg-primary-800 hover:bg-primary-600 rounded text-sm transition"
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
