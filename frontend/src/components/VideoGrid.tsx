import { useState, useRef, useEffect } from 'react';
import { MicOff } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  hasVideo: boolean;
  stream?: MediaStream;
}

interface VideoGridProps {
  participants: Participant[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  darkMode: boolean;
}

export default function VideoGrid({ participants, localStream, remoteStreams, darkMode }: VideoGridProps) {
  const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null);

  const getGridLayout = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-2 grid-rows-2';
    if (count === 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-4';
  };

  const getParticipantInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const VideoCard = ({ participant, isLocal = false }: { participant: Participant; isLocal?: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const stream = isLocal ? localStream : remoteStreams.get(participant.id);

    useEffect(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
    }, [stream]);

    return (
      <div
        className={`relative rounded-xl overflow-hidden transition-all duration-300 animate-participant-enter ${
          darkMode ? 'bg-gray-800' : 'bg-gray-100'
        } ${participants.length === 3 && participant.id === participants[0].id ? 'row-span-2' : ''}`}
        onMouseEnter={() => setHoveredParticipant(participant.id)}
        onMouseLeave={() => setHoveredParticipant(null)}
      >
        {/* Video or Avatar */}
        {participant.hasVideo && stream ? (
          <video
            ref={videoRef}
            autoPlay
            muted={isLocal}
            playsInline
            className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${
            darkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold ${
              darkMode ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
            }`}>
              {getParticipantInitials(participant.name)}
            </div>
          </div>
        )}

        {/* Muted Indicator */}
        {participant.isMuted && (
          <div className="absolute top-3 right-3 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <MicOff size={16} className="text-white" />
          </div>
        )}

        {/* Name Overlay (on hover) */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 transition-opacity duration-200 ${
            hoveredParticipant === participant.id ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-white text-sm font-medium">{participant.name}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className={`grid gap-2 w-full h-full ${getGridLayout(participants.length)}`}>
        {participants.map((participant, index) => (
          <VideoCard
            key={participant.id}
            participant={participant}
            isLocal={participant.name === 'Você'}
          />
        ))}
      </div>


    </div>
  );
}