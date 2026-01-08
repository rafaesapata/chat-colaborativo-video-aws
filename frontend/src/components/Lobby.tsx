import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Sun, Moon } from 'lucide-react';

interface LobbyProps {
  onJoinMeeting: (name: string, roomId: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Lobby({ onJoinMeeting, darkMode, toggleDarkMode }: LobbyProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Inicializar preview da câmera
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Erro ao acessar câmera:', error);
      }
    };

    initializeCamera();

    return () => {
      // Limpar stream ao desmontar
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraEnabled(videoTrack.enabled);
      }
    }
  };

  const handleJoinMeeting = () => {
    if (name.trim()) {
      // Gerar roomId único com timestamp + random para garantir unicidade
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 11);
      const roomId = `room_${timestamp}_${random}`;
      navigate(`/meeting/${roomId}?name=${encodeURIComponent(name)}`);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-8 transition-colors duration-300 ${
      darkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Toggle Dark/Light Mode */}
      <button
        onClick={toggleDarkMode}
        className={`absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 ${
          darkMode ? 'bg-gray-800 text-yellow-400' : 'bg-white text-gray-600 shadow-sm'
        }`}
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Main Container */}
      <div className="w-full max-w-md animate-fade-in">
        {/* Camera Preview */}
        <div className={`relative w-full aspect-video rounded-2xl overflow-hidden mb-6 ${
          darkMode ? 'bg-gray-800' : 'bg-gray-100'
        }`}>
          {isCameraEnabled && localStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]" // Mirror effect
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${
              darkMode ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              <Video size={48} className={darkMode ? 'text-gray-600' : 'text-gray-400'} />
            </div>
          )}
        </div>

        {/* Preview Controls */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 ${
              isMicEnabled
                ? darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 shadow-sm'
                : 'bg-red-500 text-white'
            }`}
          >
            {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 ${
              isCameraEnabled
                ? darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 shadow-sm'
                : 'bg-red-500 text-white'
            }`}
          >
            {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </div>

        {/* Name Input */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className={`w-full h-12 px-4 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            darkMode 
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' 
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'
          }`}
        />

        {/* Join Button */}
        <button
          onClick={handleJoinMeeting}
          disabled={!name.trim()}
          className="w-full h-13 mt-4 bg-blue-600 text-white font-semibold rounded-xl transition-all duration-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          Entrar na reunião
        </button>
      </div>


    </div>
  );
}