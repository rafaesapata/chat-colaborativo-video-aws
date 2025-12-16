interface Transcription {
  transcriptionId: string;
  userId: string;
  transcribedText: string;
  timestamp: number;
  speakerLabel?: string;
}

interface Props {
  transcriptions: Transcription[];
}

export default function LiveTranscription({ transcriptions }: Props) {
  const recentTranscriptions = transcriptions.slice(-5);

  return (
    <div className="bg-gray-50 border-t p-4">
      <h3 className="font-semibold mb-2 text-sm">📝 Transcrição em Tempo Real</h3>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {recentTranscriptions.map((trans) => (
          <div key={trans.transcriptionId} className="text-sm">
            <span className="font-medium text-purple-600">
              {trans.speakerLabel || 'Falante'}:
            </span>{' '}
            <span className="text-gray-700">{trans.transcribedText}</span>
          </div>
        ))}
        {transcriptions.length === 0 && (
          <p className="text-gray-400 text-sm italic">
            Aguardando transcrições...
          </p>
        )}
      </div>
    </div>
  );
}
