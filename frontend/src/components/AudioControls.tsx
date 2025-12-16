interface Props {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export default function AudioControls({ isRecording, onStartRecording, onStopRecording }: Props) {
  return (
    <div className="p-4 border-t">
      <h3 className="font-semibold mb-3">Controles de Áudio</h3>
      <div className="flex flex-col gap-2">
        {!isRecording ? (
          <button
            onClick={onStartRecording}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            🎤 Iniciar Gravação
          </button>
        ) : (
          <button
            onClick={onStopRecording}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2 animate-pulse"
          >
            ⏹️ Parar Gravação
          </button>
        )}
        <div className="text-xs text-gray-500 text-center">
          {isRecording ? 'Gravando com transcrição em tempo real...' : 'Clique para começar a falar'}
        </div>
      </div>
    </div>
  );
}
