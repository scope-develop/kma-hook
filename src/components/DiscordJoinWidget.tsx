import { useEffect, useState } from 'react';
import { EDGE_URL } from '@/lib/supabase';
import { Users, Wifi, ArrowUpRight, Loader2 } from 'lucide-react';

interface DiscordServerInfo {
  ok: boolean;
  server_name: string;
  icon_url: string | null;
  member_count: number;
  online_count: number;
  invite_url: string;
}

export function DiscordJoinWidget({ variant = 'card' }: { variant?: 'card' | 'compact' }) {
  const [info, setInfo] = useState<DiscordServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${EDGE_URL}/discord-server?code=fANjVMzAS`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setInfo(data);
        else setError(true);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
    return n.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-600">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading server...
      </div>
    );
  }

  if (error || !info) {
    return (
      <a
        href="https://discord.gg/fANjVMzAS"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <Users className="w-3.5 h-3.5" />
        Join Discord
        <ArrowUpRight className="w-3 h-3 opacity-50" />
      </a>
    );
  }

  if (variant === 'compact') {
    return (
      <a
        href={info.invite_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-[#5865F2]/10 border border-[#5865F2]/20 hover:bg-[#5865F2]/20 transition-all group"
      >
        {info.icon_url ? (
          <img src={info.icon_url} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-md bg-[#5865F2] flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-zinc-200 truncate">{info.server_name}</div>
          <div className="flex items-center gap-2 text-2xs text-zinc-500">
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {formatCount(info.online_count)}
            </span>
            <span className="text-zinc-700">|</span>
            <span>{formatCount(info.member_count)} members</span>
          </div>
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
      </a>
    );
  }

  return (
    <div className="panel p-5 animate-fade-in">
      <div className="flex items-start gap-3 mb-4">
        {info.icon_url ? (
          <img src={info.icon_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-[#5865F2] flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">{info.server_name}</h3>
          <p className="text-2xs text-zinc-600 mt-0.5">Discord Community</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-md bg-kma-base border border-kma-border-subtle px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
            <Wifi className="w-3 h-3 text-green-500" />
            <span className="text-2xs uppercase tracking-wider font-medium">Online</span>
          </div>
          <div className="font-display text-lg font-bold text-zinc-100 tabular-nums">{formatCount(info.online_count)}</div>
        </div>
        <div className="rounded-md bg-kma-base border border-kma-border-subtle px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
            <Users className="w-3 h-3 text-[#5865F2]" />
            <span className="text-2xs uppercase tracking-wider font-medium">Members</span>
          </div>
          <div className="font-display text-lg font-bold text-zinc-100 tabular-nums">{formatCount(info.member_count)}</div>
        </div>
      </div>

      <a
        href={info.invite_url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium transition-colors group"
      >
        <Users className="w-4 h-4" />
        Join Server
        <ArrowUpRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </a>
    </div>
  );
}
