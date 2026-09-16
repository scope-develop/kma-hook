import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import type { HistoryEntry } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import {
  Send,
  Blocks,
  Activity,
  Webhook,
  MessageSquare,
  AlertTriangle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { DiscordJoinWidget } from '@/components/DiscordJoinWidget';

function MetricRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-kma-border-subtle last:border-0">
      <div>
        <div className="text-[13px] text-zinc-400">{label}</div>
        {sub && <div className="text-2xs text-zinc-600 mt-0.5">{sub}</div>}
      </div>
      <div className="font-display text-xl font-bold text-zinc-100 tabular-nums">{value}</div>
    </div>
  );
}

function actionLabel(action: string) {
  if (action === 'MESSAGE') return 'Message';
  if (action === 'EMBED') return 'Embed';
  return 'Template';
}

export function DashboardPage() {
  const { stats, activeWebhook, setPage, refreshStats } = useApp();
  const [recent, setRecent] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    refreshStats();
    supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setRecent((data as HistoryEntry[]) ?? []));
  }, [refreshStats]);

  const lastActionTime = stats?.last_action_at
    ? new Date(stats.last_action_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Webhook operations overview" />

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Metrics panel */}
        <div className="lg:col-span-2 panel p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Metrics</h2>
            <span className="text-2xs text-zinc-600 font-mono">all time</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="text-2xs uppercase tracking-wider font-medium">Messages</span>
              </div>
              <div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{stats?.messages_sent ?? 0}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                <Blocks className="w-3.5 h-3.5" />
                <span className="text-2xs uppercase tracking-wider font-medium">Embeds</span>
              </div>
              <div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{stats?.embeds_sent ?? 0}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-2xs uppercase tracking-wider font-medium">Errors</span>
              </div>
              <div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{stats?.errors ?? 0}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                <Webhook className="w-3.5 h-3.5" />
                <span className="text-2xs uppercase tracking-wider font-medium">Webhooks</span>
              </div>
              <div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{activeWebhook ? '1' : '0'}</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-kma-border-subtle">
            <MetricRow label="Last action" value={stats?.last_action ?? '—'} />
            <MetricRow label="Last action at" value={lastActionTime} sub={stats?.last_action_at ? new Date(stats.last_action_at).toLocaleDateString() : ''} />
          </div>
        </div>

        {/* Right column: Quick actions + Discord */}
        <div className="space-y-4">
          <div className="panel p-5 animate-fade-in">
            <h2 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="space-y-1.5">
              {[
                { key: 'send' as const, label: 'Send Message', desc: 'Plain text via webhook', icon: Send },
                { key: 'embed' as const, label: 'Build Embed', desc: 'Rich embed with preview', icon: Blocks },
                { key: 'tester' as const, label: 'Test Webhook', desc: 'Check connectivity', icon: Activity },
                { key: 'manager' as const, label: 'Manage Webhooks', desc: 'Add, edit, remove', icon: Webhook },
              ].map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.key}
                    onClick={() => setPage(a.key)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-kma-elevated transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-md bg-kma-elevated flex items-center justify-center text-zinc-400 group-hover:text-accent-bright transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-[13px] font-medium text-zinc-200">{a.label}</div>
                      <div className="text-2xs text-zinc-600">{a.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>

          <DiscordJoinWidget variant="card" />
        </div>
      </div>

      {/* Recent activity table */}
      <div className="panel animate-fade-in">
        <div className="flex items-center justify-between px-5 py-3 border-b border-kma-border-subtle">
          <h2 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Recent Activity</h2>
          <button onClick={() => setPage('history')} className="text-xs text-accent-bright hover:text-accent font-medium">
            View all
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-600">No activity yet. Send a message to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-kma-border-subtle text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                  <th className="text-left px-5 py-2.5 font-semibold">Time</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Content</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((h) => (
                  <tr key={h.id} className="border-b border-kma-border-subtle last:border-0 hover:bg-kma-elevated/50 transition-colors">
                    <td className="px-5 py-2.5 text-zinc-500 whitespace-nowrap font-mono text-2xs">
                      {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="tag tag-neutral">{actionLabel(h.action)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300 max-w-md">
                      <div className="truncate">{h.content || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {h.status === 'success' ? (
                        <span className="tag tag-success">success</span>
                      ) : (
                        <span className="tag tag-error">error</span>
                      )}
                    </td>
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
