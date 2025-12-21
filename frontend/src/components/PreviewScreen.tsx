import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, Settings, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

interface PreviewScreenProps {
  darkMode: boolean;
  onJoin?: () => void;
}

export default function PreviewScreen({ darkMode, onJoin }: PreviewScreenProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isAuthenticated, user } = useAuth();
  
  // Carregar nome salvo para usuário autenticado
  const getSavedName = () => {
    if (isAuthenticated && user?.login) {
      return authService.getSavedUserName(user.login) || '';
    }
    return '';
  };
  
  const [name, setName] = useState(getSavedName);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<{ video: MediaDeviceInfo[], audio: MediaDeviceInfo[] }>({ video: [], audio: [] });
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  // Carregar dispositivos disponíveis e inicializar stream
  useEffect(() => {
    let isMounted = true;
    let localStream: MediaStream | null = null;
    
    const initMedia = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Parar stream anterior se existir
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Obter stream de mídia
        const constraints: MediaStreamConstraints = {
          video: selectedVideoDevice 
            ? { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: selectedAudioDevice
            ? { deviceId: { exact: selectedAudioDevice }, echoCancellation: true, noiseSuppression: true }
            : { echoCancellation: true, noiseSuppression: true }
        };

        console.log('[PreviewScreen] Solicitando mídia...');
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[PreviewScreen] Mídia obtida:', localStream.getTracks().map(t => t.kind));
        
        if (!isMounted) {
          localStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        streamRef.current = localStream;
        setStream(localStream);
        setHasInitialized(true);

        // Listar dispositivos após obter permissão
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        if (isMounted) {
          setDevices({
            video: deviceList.filter(d => d.kind === 'videoinput'),
            audio: deviceList.filter(d => d.kind === 'audioinput')
          });
        }

        // Conectar ao elemento de vídeo
        if (videoRef.current && isMounted) {
          console.log('[PreviewScreen] Conectando stream ao elemento de vídeo');
          videoRef.current.srcObject = localStream;
          videoRef.current.onloadedmetadata = () => {
            console.log('[PreviewScreen] Video metadata carregado, iniciando play');
            videoRef.current?.play()
              .then(() => console.log('[PreviewScreen] Video play iniciado com sucesso'))
              .catch(e => console.warn('[PreviewScreen] Play error:', e));
          };
        } else {
          console.warn('[PreviewScreen] videoRef ou isMounted inválido:', { 
            hasVideoRef: !!videoRef.current, 
            isMounted 
          });
        }

        // Configurar analisador de áudio
        try {
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close();
          }
          
          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          
          const source = audioCtx.createMediaStreamSource(localStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          // Monitorar nível de áudio
          const checkAudioLevel = () => {
            if (!isMounted || !analyserRef.current) return;
            
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setAudioLevel(Math.min(100, average * 2));
            
            animationRef.current = requestAnimationFrame(checkAudioLevel);
          };
          checkAudioLevel();
        } catch (audioErr) {
          console.warn('Erro ao configurar analisador de áudio:', audioErr);
        }

      } catch (err) {
        console.error('[PreviewScreen] Erro ao acessar mídia:', err);
        if (!isMounted) return;
        
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setError('Permissão negada. Clique no ícone da câmera na barra de endereços e permita o acesso.');
          } else if (err.name === 'NotFoundError') {
            setError('Câmera ou microfone não encontrados.');
          } else if (err.name === 'NotReadableError') {
            setError('Câmera em uso por outro aplicativo. Feche outros apps que usam a câmera.');
          } else if (err.name === 'OverconstrainedError') {
            setError('Dispositivo selecionado não disponível.');
          } else {
            setError(`Erro ao acessar câmera: ${err.message}`);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Iniciar após pequeno delay
    const timer = setTimeout(initMedia, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Não parar o stream aqui - será parado no cleanup geral ou ao trocar dispositivo
    };
  }, [selectedVideoDevice, selectedAudioDevice]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!name.trim() || isJoining) return;
    
    setIsJoining(true);
    
    try {
      // Salvar nome para usuário autenticado
      if (isAuthenticated && user?.login) {
        authService.saveUserName(user.login, name.trim());
      }
      
      // Parar stream de preview (será recriado na sala)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Parar animação de áudio
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      
      // Fechar AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close().catch(() => {});
      }
      
      // Salvar preferências e nome em sessionStorage (não na URL)
      sessionStorage.setItem('videochat_user_name', name.trim());
      sessionStorage.setItem('videochat_video_enabled', String(isVideoEnabled));
      sessionStorage.setItem('videochat_audio_enabled', String(isAudioEnabled));
      if (selectedVideoDevice) sessionStorage.setItem('videochat_video_device', selectedVideoDevice);
      if (selectedAudioDevice) sessionStorage.setItem('videochat_audio_device', selectedAudioDevice);
      
      // Notificar o wrapper que o nome foi definido (força re-render)
      if (onJoin) {
        onJoin();
      } else {
        // Fallback: navegar (não deve acontecer, mas por segurança)
        navigate(`/meeting/${roomId}`);
      }
    } catch (err) {
      console.error('Erro ao entrar na sala:', err);
      setIsJoining(false);
    }
  };

  const handleGoHome = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    navigate('/');
  };

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900' 
        : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600'
    } flex items-center justify-center p-4`}>
      <div className={`backdrop-blur-sm rounded-3xl shadow-2xl p-6 max-w-2xl w-full border transition-all duration-300 ${
        darkMode 
          ? 'bg-gray-800/95 border-gray-700/50' 
          : 'bg-white/95 border-white/20'
      }`}>
        <div className="text-center mb-6">
          <h1 className={`text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent mb-2 ${
            darkMode 
              ? 'from-purple-400 to-violet-400' 
              : 'from-indigo-600 to-purple-600'
          }`}>
            Preparar para Entrar
          </h1>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Sala: <span className="font-mono font-semibold">{roomId}</span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Preview de Vídeo */}
          <div className="relative">
            <div className={`aspect-video rounded-2xl overflow-hidden ${
              darkMode ? 'bg-gray-900' : 'bg-gray-100'
            }`}>
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <p className="text-red-500 text-sm text-center">{error}</p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                        darkMode ? 'bg-gray-700' : 'bg-gray-300'
                      }`}>
                        <VideoOff className="w-8 h-8 text-gray-500" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Controles de preview */}
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={toggleAudio}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  !isAudioEnabled
                    ? 'bg-red-500 text-white'
                    : darkMode
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  !isVideoEnabled
                    ? 'bg-red-500 text-white'
                    : darkMode
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  darkMode
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Settings size={20} />
              </button>
            </div>

            {/* Indicador de áudio */}
            <div className="mt-3">
              <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div 
                  className="h-full bg-green-500 transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
              <p className={`text-xs mt-1 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Nível do microfone
              </p>
            </div>
          </div>

          {/* Formulário */}
          <div className="flex flex-col justify-center">
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Seu nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite seu nome"
                  className={`w-full px-4 py-3 rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                    darkMode 
                      ? 'border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-purple-500' 
                      : 'border border-gray-200 bg-gray-50 focus:ring-indigo-500'
                  }`}
                  maxLength={50}
                  autoFocus
                />
              </div>

              {/* Configurações de dispositivo */}
              {showSettings && (
                <div className="space-y-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Câmera
                    </label>
                    <select
                      value={selectedVideoDevice}
                      onChange={(e) => setSelectedVideoDevice(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-sm ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <option value="">Padrão</option>
                      {devices.video.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Câmera ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Microfone
                    </label>
                    <select
                      value={selectedAudioDevice}
                      onChange={(e) => setSelectedAudioDevice(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-sm ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <option value="">Padrão</option>
                      {devices.audio.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microfone ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={!name.trim() || isLoading || isJoining}
                className={`w-full py-4 rounded-xl transition-all font-semibold text-lg flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  darkMode 
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white' 
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
                }`}
              >
                {isJoining ? (
                  <>
                    <RefreshCw size={24} className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <Video size={24} />
                    Entrar na Sala
                  </>
                )}
              </button>

              <button
                onClick={handleGoHome}
                className={`w-full py-3 rounded-xl transition-all font-semibold flex items-center justify-center gap-2 border-2 ${
                  darkMode 
                    ? 'bg-gray-800 text-purple-400 border-purple-600 hover:border-purple-500 hover:bg-gray-700' 
                    : 'bg-white text-indigo-600 border-indigo-600 hover:border-indigo-700 hover:bg-gray-50'
                }`}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
