interface Props {
  participants: string[];
}

export default function ParticipantsList({ participants }: Props) {
  return (
    <div className="p-4 border-b">
      <h3 className="font-semibold mb-3">👥 Participantes ({participants.length})</h3>
      <div className="space-y-2">
        {participants.map((userId) => (
          <div key={userId} className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm">User {userId.substring(userId.length - 4)}</span>
          </div>
        ))}
        {participants.length === 0 && (
          <p className="text-gray-400 text-sm italic">Nenhum participante</p>
        )}
      </div>
    </div>
  );
}
