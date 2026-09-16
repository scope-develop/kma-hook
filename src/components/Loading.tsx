import { Loader2 } from 'lucide-react';

export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-zinc-500">
      <Loader2 className="w-4 h-4 animate-spin mr-2 text-accent-bright" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`w-4 h-4 animate-spin ${className}`} />;
}
