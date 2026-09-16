import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import type { GlobalStats, AdminHistoryEntry } from '@/lib/types';
import { Users, Webhook, MessageSquare, Blocks, AlertTriangle, Ban, UserX, FileText, Activity } from 'lucide-react';

export function AdminOverviewPage() {
  const { toast } = useApp();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AdminHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: s }, { data: h }] = await Promise.all([
          supabase.rpc('admin_get_global_stats'),
          supabase.rpc('admin_get_all_history'),
        ]);
        setStats((s as unknown as GlobalStats) ?? null);
        setRecentActivity(((h as unknown as AdminHistoryEntry[]) ?? []).slice(0, 10));
      } catch { toast('error', 'Failed to load admin data'); } finally { setLoading(false); }
    })();
  }, [toast]);

  if (loading) return <div className="panel p-10 text-center text-sm text-zinc-600">Loading admin data...</div>;

  const cards = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: Users, color: 'text-zinc-300' },
    { label: 'Webhooks', value: stats?.total_webhooks ?? 0, icon: Webhook, color: 'text-accent-bright' },
    { label: 'Messages Sent', value: stats?.total_messages ?? 0, icon: MessageSquare, color: 'text-zinc-300' },
    { label: 'Embeds Sent', value: stats?.total_embeds ?? 0, icon: Blocks, color: 'text-accent-bright' },
    { label: 'Errors', value: stats?.total_errors ?? 0, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Templates', value: stats?.total_templates ?? 0, icon: FileText, color: 'text-zinc-300' },
    { label: 'Banned', value: stats?.banned_users ?? 0, icon: Ban, color: 'text-red-400' },
    { label: 'Disabled', value: stats?.disabled_users ?? 0, icon: UserX, color: 'text-amber-400' },
  ];

  return (
    <div>
      <PageHeader title="Admin Overview" subtitle="Platform-wide statistics and recent activity" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="panel p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">{c.label}</span>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="panel animate-fade-in">
        <div className="flex items-center justify-between px-5 py-3 border-b border-kma-border-subtle">
          <h2 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Recent Platform Activity</h2>
          <Activity className="w-4 h-4 text-zinc-600" />
        </div>
        {recentActivity.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-600">No activity recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-kma-border-subtle text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                  <th className="text-left px-5 py-2.5">Time</th>
                  <th className="text-left px-3 py-2.5">User</th>
                  <th className="text-left px-3 py-2.5">Action</th>
                  <th className="text-left px-3 py-2.5">Content</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((h) => (
                  <tr key={h.id} className="border-b border-kma-border-subtle last:border-0 hover:bg-kma-elevated/40 transition-colors">
                    <td className="px-5 py-2.5 text-zinc-500 whitespace-nowrap font-mono text-2xs">{new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2.5 text-zinc-400 truncate max-w-[160px]">{h.user_email ?? '—'}</td>
                    <td className="px-3 py-2.5"><span className="tag tag-neutral">{h.action}</span></td>
                    <td className="px-3 py-2.5 text-zinc-300 max-w-md truncate">{h.content || '—'}</td>
                    <td className="px-3 py-2.5">{h.status === 'success' ? <span className="tag tag-success">success</span> : <span className="tag tag-error">error</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
