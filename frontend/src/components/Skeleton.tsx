// Componentes de Skeleton Loading reutilizáveis
interface SkeletonProps {
  className?: string;
  darkMode?: boolean;
}

const base = (darkMode?: boolean) =>
  `animate-skeleton-shimmer bg-gradient-to-r ${
    darkMode
      ? 'from-[hsl(220,22%,15%)] via-[hsl(220,22%,20%)] to-[hsl(220,22%,15%)]'
      : 'from-[hsl(220,18%,92%)] via-[hsl(220,18%,96%)] to-[hsl(220,18%,92%)]'
  } bg-[length:200%_100%] rounded`;

export function SkeletonBox({ className = '', darkMode }: SkeletonProps) {
  return <div className={`${base(darkMode)} ${className}`} />;
}

export function SkeletonText({ className = '', darkMode }: SkeletonProps) {
  return <div className={`${base(darkMode)} h-4 ${className}`} />;
}

export function SkeletonCircle({ className = '', darkMode }: SkeletonProps) {
  return <div className={`${base(darkMode)} rounded-full ${className}`} />;
}

export function SkeletonRoomCard({ darkMode }: SkeletonProps) {
  return (
    <div className={`px-6 py-4 animate-fade-in ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <SkeletonCircle darkMode={darkMode} className="w-8 h-8" />
            <SkeletonText darkMode={darkMode} className="w-32" />
            <SkeletonBox darkMode={darkMode} className="w-16 h-5 rounded-full" />
          </div>
          <div className="flex gap-4">
            <SkeletonText darkMode={darkMode} className="w-24" />
            <SkeletonText darkMode={darkMode} className="w-20" />
          </div>
        </div>
        <SkeletonBox darkMode={darkMode} className="w-8 h-8 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonMeetingCard({ darkMode }: SkeletonProps) {
  return (
    <div className={`p-4 rounded-xl animate-fade-in ${darkMode ? 'bg-[hsl(220,22%,12%)]/50' : 'bg-[hsl(220,30%,96%)]'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonBox darkMode={darkMode} className="w-20 h-5 rounded-full" />
            <SkeletonText darkMode={darkMode} className="w-40" />
          </div>
          <div className="flex gap-3">
            <SkeletonText darkMode={darkMode} className="w-28" />
            <SkeletonText darkMode={darkMode} className="w-20" />
            <SkeletonText darkMode={darkMode} className="w-24" />
          </div>
        </div>
        <div className="flex gap-1">
          <SkeletonBox darkMode={darkMode} className="w-7 h-7 rounded" />
          <SkeletonBox darkMode={darkMode} className="w-7 h-7 rounded" />
          <SkeletonBox darkMode={darkMode} className="w-7 h-7 rounded" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonJobCard({ darkMode }: SkeletonProps) {
  return (
    <div className={`p-4 rounded-xl animate-fade-in ${darkMode ? 'bg-[hsl(220,22%,12%)]/50' : 'bg-[hsl(220,30%,96%)]'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SkeletonText darkMode={darkMode} className="w-48" />
          <SkeletonBox darkMode={darkMode} className="w-14 h-5 rounded-full" />
        </div>
        <div className="flex gap-1">
          <SkeletonBox darkMode={darkMode} className="w-7 h-7 rounded" />
          <SkeletonBox darkMode={darkMode} className="w-7 h-7 rounded" />
        </div>
      </div>
      <SkeletonText darkMode={darkMode} className="w-full mb-1.5" />
      <SkeletonText darkMode={darkMode} className="w-3/4" />
    </div>
  );
}

export function SkeletonHistoryRow({ darkMode }: SkeletonProps) {
  return (
    <div className={`px-4 py-3 animate-fade-in ${darkMode ? 'border-border-dark' : 'border-border-light'}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonBox darkMode={darkMode} className="w-16 h-5 rounded-full" />
            <SkeletonText darkMode={darkMode} className="w-36" />
          </div>
          <div className="flex gap-3">
            <SkeletonText darkMode={darkMode} className="w-24" />
            <SkeletonText darkMode={darkMode} className="w-16" />
            <SkeletonText darkMode={darkMode} className="w-20" />
          </div>
        </div>
        <div className="flex gap-1">
          <SkeletonBox darkMode={darkMode} className="w-7 h-7 rounded" />
          <SkeletonBox darkMode={darkMode} className="w-7 h-7 rounded" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonStatsCard({ darkMode }: SkeletonProps) {
  return (
    <div className={`p-4 rounded-xl animate-fade-in ${darkMode ? 'bg-[hsl(220,22%,12%)]/50' : 'bg-[hsl(220,30%,96%)]'}`}>
      <SkeletonText darkMode={darkMode} className="w-20 mb-2 h-3" />
      <SkeletonText darkMode={darkMode} className="w-12 h-7" />
    </div>
  );
}
