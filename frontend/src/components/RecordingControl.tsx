import { Circle, Square, Pause, Play } from 'lucide-react';

interface RecordingControlProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  onStart: () => void;
  onStop: () => void;
  onTogglePause: () => void;
  darkMode: boolean;
  disabled?: boolean;
}

export default function RecordingControl({
  isRecording,
  isPaused,
  duration,
  onStart,
  onStop,
  onTogglePause,
  darkMode,
  disabled = false,
}: RecordingControlProps) {
  // Formatar duração
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <button
        onClick={onStart}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-150 hover:scale-105 active:scale-95 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : darkMode
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
        title="Iniciar gravação"
      >
        <Circle size={16} className="fill-current" />
        <span className="text-sm font-medium">Gravar</span>
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
      darkMode ? 'bg-gray-800/80' : 'bg-white/80'
    } backdrop-blur-sm border ${
      darkMode ? 'border-red-500/50' : 'border-red-300'
    }`}>
      {/* Indicador de gravação */}
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'
        }`} />
        <span className={`text-sm font-mono font-medium ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {formatDuration(duration)}
        </span>
      </div>

      {/* Botão Pausar/Retomar */}
      <button
        onClick={onTogglePause}
        className={`p-1.5 rounded-full transition-all hover:scale-110 ${
          darkMode
            ? 'hover:bg-gray-700 text-gray-300'
            : 'hover:bg-gray-200 text-gray-600'
        }`}
        title={isPaused ? 'Retomar' : 'Pausar'}
      >
        {isPaused ? <Play size={14} /> : <Pause size={14} />}
      </button>

      {/* Botão Parar */}
      <button
        onClick={onStop}
        className={`p-1.5 rounded-full transition-all hover:scale-110 ${
          darkMode
            ? 'hover:bg-red-900/50 text-red-400'
            : 'hover:bg-red-100 text-red-600'
        }`}
        title="Parar gravação"
      >
        <Square size={14} className="fill-current" />
      </button>
    </div>
  );
}
