import { useState } from 'react';

interface Props {
  roomId: string;
}

export default function AIInsightsPanel({ }: Props) {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const requestAnalysis = async (type: string) => {
    setLoading(true);
    // Implementar chamada para análise de IA
    setTimeout(() => {
      setInsights({
        type,
        summary: 'Resumo da conversa será exibido aqui...',
        actionItems: ['Item 1', 'Item 2']
      });
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <h3 className="font-semibold mb-3">🤖 Insights de IA</h3>
      
      <div className="space-y-2 mb-4">
        <button
          onClick={() => requestAnalysis('summary')}
          disabled={loading}
          className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition text-sm disabled:opacity-50"
        >
          Gerar Resumo
        </button>
        <button
          onClick={() => requestAnalysis('sentiment')}
          disabled={loading}
          className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition text-sm disabled:opacity-50"
        >
          Análise de Sentimento
        </button>
        <button
          onClick={() => requestAnalysis('actionItems')}
          disabled={loading}
          className="w-full bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition text-sm disabled:opacity-50"
        >
          Extrair Action Items
        </button>
      </div>

      {loading && (
        <div className="text-center text-muted-light text-sm">
          Analisando com IA...
        </div>
      )}

      {insights && !loading && (
        <div className="bg-black/3 rounded-lg p-3 text-sm">
          <h4 className="font-semibold mb-2">Resultado:</h4>
          <p className="text-muted-light">{insights.summary}</p>
        </div>
      )}
    </div>
  );
}
