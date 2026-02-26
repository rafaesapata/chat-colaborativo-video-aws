import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, Settings, RefreshCw, Shield, ShieldCheck, ShieldAlert, Info, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';
interface PermissionsState { camera: PermissionStatus; microphone: PermissionStatus; }
interface PreviewScreenProps { darkMode: boolean; onJoin?: () => void; }

async function checkPermissions(): Promise<PermissionsState> {
  const result: PermissionsState = { camera: 'unknown', microphone: 'unknown' };
  try {
    if (navigator.permissions && navigator.permissions.query) {
      try { const p = await navigator.permissions.query({ name: 'camera' as PermissionName }); result.camera = p.state as PermissionStatus; } catch {}
      try { const p = await navigator.permissions.query({ name: 'microphone' as PermissionName }); result.microphone = p.state as PermissionStatus; } catch {}
    }
  } catch {}
  return result;
}

export default function PreviewScreen({ darkMode, onJoin }: PreviewScreenProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isAuthenticated, user } = useAuth();
  const getSavedName = () => (isAuthenticated && user?.login) ? (authService.getSavedUserName(user.login) || '') : '';

  const [name, setName] = useState(getSavedName);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<{ video: MediaDeviceInfo[], audio: MediaDeviceInfo[], audioOutput: MediaDeviceInfo[] }>({ video: [], audio: [], audioOutput: [] });
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsState>({ camera: 'unknown', microphone: 'unknown' });
  const [showPermissionTip, setShowPermissionTip] = useState(false);
  const [permissionTipDismissed, setPermissionTipDismissed] = useState(() => sessionStorage.getItem('permission_tip_dismissed') === 'true');
  const [isJoining, setIsJoining] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const checkAndSetPermissions = async () => {
      const perms = await checkPermissions();
      setPermissions(perms);
      if ((perms.camera === 'prompt' || perms.microphone === 'prompt') && !permissionTipDismissed) {
        setShowPermissionTip(true);
      }
    };
    checkAndSetPermissions();
    const setupListeners = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          try { const p = await navigator.permissions.query({ name: 'camera' as PermissionName }); p.addEventListener('change', checkAndSetPermissions); } catch {}
          try { const p = await navigator.permissions.query({ name: 'microphone' as PermissionName }); p.addEventListener('change', checkAndSetPermissions); } catch {}
        }
      } catch {}
    };
    setupListeners();
  }, [permissionTipDismissed]);

  const dismissPermissionTip = () => {
    setShowPermissionTip(false);
    setPermissionTipDismissed(true);
    sessionStorage.setItem('permission_tip_dismissed', 'true');
  };

  const setVideoRef2 = useCallback((node: HTMLVideoElement | null) => {
    if (node && streamRef.current) { node.srcObject = streamRef.current; node.play().catch(() => {}); }
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
  }, [stream]);

  useEffect(() => {
    let isMounted = true;
    const initMedia = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        const constraints: MediaStreamConstraints = {
          video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true }
        };
        const localStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) { localStream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = localStream;
        setStream(localStream);
        setHasInitialized(true);
        const perms = await checkPermissions();
        setPermissions(perms);
        if (perms.camera === 'granted' && perms.microphone === 'granted') setShowPermissionTip(false);
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        if (isMounted) setDevices({ video: deviceList.filter(d => d.kind === 'videoinput'), audio: deviceList.filter(d => d.kind === 'audioinput'), audioOutput: deviceList.filter(d => d.kind === 'audiooutput') });
        try {
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') await audioContextRef.current.close();
          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(localStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
          const checkLevel = () => {
            if (!isMounted || !analyserRef.current) return;
            const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(arr);
            setAudioLevel(Math.min(100, (arr.reduce((a, b) => a + b) / arr.length) * 2));
            animationRef.current = requestAnimationFrame(checkLevel);
          };
          checkLevel();
        } catch {}
      } catch (err) {
        if (!isMounted) return;
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') setError('Permissão negada. Clique no ícone da câmera na barra de endereços.');
          else if (err.name === 'NotFoundError') setError('Câmera ou microfone não encontrados.');
          else if (err.name === 'NotReadableError') setError('Câmera em uso por outro aplicativo.');
          else if (err.name === 'OverconstrainedError') setError('Dispositivo selecionado não disponível.');
          else setError(`Erro ao acessar câmera: ${err.message}`);
        }
      } finally { if (isMounted) setIsLoading(false); }
    };
    const timer = setTimeout(initMedia, 200);
    return () => { isMounted = false; clearTimeout(timer); if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [selectedVideoDevice, selectedAudioDevice]);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
    };
  }, []);

  const toggleVideo = () => { if (streamRef.current) { const t = streamRef.current.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setIsVideoEnabled(t.enabled); } } };
  const toggleAudio = () => { if (streamRef.current) { const t = streamRef.current.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setIsAudioEnabled(t.enabled); } } };

  const handleJoin = async () => {
    if (!name.trim() || isJoining) return;
    setIsJoining(true);
    try {
      if (isAuthenticated && user?.login) authService.saveUserName(user.login, name.trim());
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = undefined; }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') await audioContextRef.current.close().catch(() => {});
      sessionStorage.setItem('videochat_user_name', name.trim());
      sessionStorage.setItem('videochat_video_enabled', String(isVideoEnabled));
      sessionStorage.setItem('videochat_audio_enabled', String(isAudioEnabled));
      if (selectedVideoDevice) sessionStorage.setItem('videochat_video_device', selectedVideoDevice);
      if (selectedAudioDevice) sessionStorage.setItem('videochat_audio_device', selectedAudioDevice);
      if (selectedAudioOutput) sessionStorage.setItem('videochat_audio_output', selectedAudioOutput);
      if (onJoin) onJoin(); else navigate(`/meeting/${roomId}`);
    } catch { setIsJoining(false); }
  };

  const handleGoHome = () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); navigate('/'); };

  const permBadge = (status: PermissionStatus, label: string) => (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
      status === 'granted' ? 'bg-success/15 text-success'
      : status === 'denied' ? 'bg-destructive/15 text-destructive'
      : darkMode ? 'bg-white/5 text-muted-dark' : 'bg-black/5 text-muted-light'
    }`}>
      {status === 'granted' ? <ShieldCheck size={12} /> : status === 'denied' ? <ShieldAlert size={12} /> : <Shield size={12} />}
      {label}: {status === 'granted' ? 'OK' : status === 'denied' ? 'Bloqueado' : status === 'prompt' ? 'Pendente' : '...'}
    </div>
  );

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <div className="glass-card p-6 max-w-2xl w-full animate-fade-in-scale">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold gradient-primary-text mb-2">Preparar para Entrar</h1>
          <p className={`text-sm ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>
            Sala: <span className="font-mono font-semibold text-primary">{roomId}</span>
          </p>
          <div className="flex items-center justify-center gap-3 mt-3">
            {permBadge(permissions.camera, 'Câmera')}
            {permBadge(permissions.microphone, 'Microfone')}
          </div>
        </div>

        {showPermissionTip && (
          <div className={`mb-4 p-3 rounded-xl flex items-start gap-3 border animate-fade-in ${darkMode ? 'bg-primary/5 border-primary/20' : 'bg-primary-50 border-primary/20'}`}>
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${darkMode ? 'text-foreground-dark' : 'text-foreground-light'}`}>Dica: Permita o acesso permanentemente</p>
              <p className={`text-xs mt-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>Clique no ícone de cadeado 🔒 na barra de endereços e selecione "Permitir".</p>
            </div>
            <button onClick={dismissPermissionTip} className={`p-1 rounded-full hover:bg-black/10 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}><X size={16} /></button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="relative">
            <div className={`aspect-video rounded-2xl overflow-hidden ${darkMode ? 'bg-surface-dark' : 'bg-black/5'}`}>
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin text-primary/50" /></div>
              ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center p-4"><p className="text-destructive text-sm text-center">{error}</p></div>
              ) : (
                <>
                  <video ref={setVideoRef2} autoPlay playsInline muted className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`} style={{ transform: 'scaleX(-1)' }} />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center ${darkMode ? 'bg-white/10' : 'bg-black/10'}`}>
                        <VideoOff className={`w-8 h-8 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-center gap-3 mt-4">
              <button onClick={toggleAudio} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${!isAudioEnabled ? 'bg-destructive text-white' : darkMode ? 'bg-white/10 text-foreground-dark hover:bg-white/15' : 'bg-black/5 text-foreground-light hover:bg-black/10'}`}>
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${!isVideoEnabled ? 'bg-destructive text-white' : darkMode ? 'bg-white/10 text-foreground-dark hover:bg-white/15' : 'bg-black/5 text-foreground-light hover:bg-black/10'}`}>
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${showSettings ? 'bg-primary/15 text-primary' : darkMode ? 'bg-white/10 text-foreground-dark hover:bg-white/15' : 'bg-black/5 text-foreground-light hover:bg-black/10'}`}>
                <Settings size={20} />
              </button>
            </div>

            <div className="mt-3">
              <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-white/10' : 'bg-black/5'}`}>
                <div className="h-full bg-success transition-all duration-75 rounded-full" style={{ width: `${audioLevel}%` }} />
              </div>
              <p className={`text-xs mt-1 text-center ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>Nível do microfone</p>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-foreground-dark' : 'text-foreground-light'}`}>Seu nome</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite seu nome" className="input-glass" maxLength={50} autoFocus />
              </div>

              {showSettings && (
                <div className="space-y-3 animate-fade-in">
                  {[
                    { label: 'Câmera', val: selectedVideoDevice, set: setSelectedVideoDevice, opts: devices.video, pfx: 'Câmera' },
                    { label: 'Microfone', val: selectedAudioDevice, set: setSelectedAudioDevice, opts: devices.audio, pfx: 'Microfone' },
                    { label: 'Saída de Áudio', val: selectedAudioOutput, set: setSelectedAudioOutput, opts: devices.audioOutput, pfx: 'Saída' },
                  ].map(({ label, val, set, opts, pfx }) => (
                    <div key={label}>
                      <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-muted-dark' : 'text-muted-light'}`}>{label}</label>
                      <select value={val} onChange={(e) => set(e.target.value)} className="input-glass text-sm">
                        <option value="">Padrão</option>
                        {opts.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `${pfx} ${d.deviceId.slice(0, 8)}`}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handleJoin} disabled={!name.trim() || isLoading || isJoining}
                className="btn-primary w-full py-3.5 text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                {isJoining ? <><RefreshCw size={24} className="animate-spin" /> Entrando...</> : <><Video size={24} /> Entrar na Sala</>}
              </button>

              <button onClick={handleGoHome} className="btn-outline w-full py-3 flex items-center justify-center gap-2">Voltar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
