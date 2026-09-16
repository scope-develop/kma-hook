import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Loading';
import type { AdminHistoryEntry, GlobalStats } from '@/lib/types';
import { Search, Trash2, MessageSquare, Blocks, AlertTriangle } from 'lucide-react';

type ActionFilter = 'ALL' | 'MESSAGE' | 'EMBED' | 'TEMPLATE';
type StatusFilter = 'ALL' | 'success' | 'error';

export function AdminMessagesPage() {
  const { toast } = useApp();
  const [history, setHistory] = useState<AdminHistoryEntry[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<AdminHistoryEntry | null>(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: h }, { data: s }] = await Promise.all([
        supabase.rpc('admin_get_all_history'),
        supabase.rpc('admin_get_global_stats'),
      ]);
      setHistory((h as AdminHistoryEntry[]) ?? []);
      setStats((s as unknown as GlobalStats) ?? null);
    } catch { toast('error', 'Failed to load data'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = history.filter((h) => {
    if (actionFilter !== 'ALL' && h.action !== actionFilter) return false;
    if (statusFilter !== 'ALL' && h.status !== statusFilter) return false;
    if (search && !h.content?.toLowerCase().includes(search.toLowerCase()) && !h.user_email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActing(true);
    try {
      const { error } = await supabase.from('history').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast('success', 'History entry deleted'); setDeleteTarget(null); load();
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  // Simple bar chart data — last 7 days
  const chartData = (() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(); date.setDate(date.getDate() - i);
      const dayStr = date.toLocaleDateString([], { weekday: 'short' });
      const count = history.filter((h) => {
        const hDate = new Date(h.created_at);
        return hDate.toDateString() === date.toDateString();
      }).length;
      days.push({ label: dayStr, value: count });
    }
    return days;
  })();

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);

  const actionIcon = (a: string) => a === 'MESSAGE' ? <MessageSquare className="w-3.5 h-3.5 text-zinc-400" /> : a === 'EMBED' ? <Blocks className="w-3.5 h-3.5 text-accent-bright" /> : <MessageSquare className="w-3.5 h-3.5 text-amber-400" />;

  return (
    <div>
      <PageHeader title="Messages & Embeds" subtitle="Global statistics and message history" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="panel p-4 animate-fade-in"><div className="flex items-center justify-between mb-2"><span className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Messages</span><MessageSquare className="w-4 h-4 text-zinc-400" /></div><div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{stats?.total_messages ?? 0}</div></div>
        <div className="panel p-4 animate-fade-in"><div className="flex items-center justify-between mb-2"><span className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Embeds</span><Blocks className="w-4 h-4 text-accent-bright" /></div><div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{stats?.total_embeds ?? 0}</div></div>
        <div className="panel p-4 animate-fade-in"><div className="flex items-center justify-between mb-2"><span className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Errors</span><AlertTriangle className="w-4 h-4 text-red-400" /></div><div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{stats?.total_errors ?? 0}</div></div>
        <div className="panel p-4 animate-fade-in"><div className="flex items-center justify-between mb-2"><span className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Total Actions</span><MessageSquare className="w-4 h-4 text-zinc-400" /></div><div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{(stats?.total_messages ?? 0) + (stats?.total_embeds ?? 0)}</div></div>
      </div>

      <div className="panel p-5 mb-4 animate-fade-in">
        <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4">Activity (Last 7 Days)</h3>
        <div className="flex items-end gap-2 h-32">
          {chartData.map((d) => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full bg-kma-elevated rounded-t-md relative group" style={{ height: `${(d.value / maxVal) * 100}%`, minHeight: d.value > 0 ? '4px' : '2px' }}>
                <div className="absolute inset-0 bg-accent/20 rounded-t-md group-hover:bg-accent/40 transition-colors" />
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xs text-zinc-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{d.value}</span>
              </div>
              <span className="text-2xs text-zinc-600 font-mono">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-3 mb-4 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input className="input pl-9" placeholder="Search by content or user..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input !w-auto" value={actionFilter} onChange={(e) => setActionFilter(e.target.value as ActionFilter)}>
            <option value="ALL">All Types</option><option value="MESSAGE">Message</option><option value="EMBED">Embed</option><option value="TEMPLATE">Template</option>
          </select>
          <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="ALL">All Status</option><option value="success">Success</option><option value="error">Error</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="panel p-10"><Spinner className="mx-auto w-5 h-5" /></div>
      ) : filtered.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-zinc-600">No entries match your filters.</div>
      ) : (
        <div className="panel overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-kma-border-subtle text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                  <th className="text-left px-4 py-2.5">Time</th>
                  <th className="text-left px-3 py-2.5">User</th>
                  <th className="text-left px-3 py-2.5">Type</th>
                  <th className="text-left px-3 py-2.5">Content</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((h) => (
                  <tr key={h.id} className="border-b border-kma-border-subtle last:border-0 hover:bg-kma-elevated/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap font-mono text-2xs">{new Date(h.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2.5 text-zinc-400 truncate max-w-[160px]">{h.user_email ?? '—'}</td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2">{actionIcon(h.action)}<span className="font-mono text-2xs font-semibold text-zinc-400">{h.action}</span></div></td>
                    <td className="px-3 py-2.5 text-zinc-300 max-w-md truncate">{h.content || '—'}</td>
                    <td className="px-3 py-2.5">{h.status === 'success' ? <span className="tag tag-success">success</span> : <span className="tag tag-error">error</span>}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setDeleteTarget(h)} className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-kma-elevated transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete History Entry">
        <p className="text-sm text-zinc-300 mb-5">Delete this history entry? This cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={acting} className="btn btn-danger flex-1">{acting ? <Spinner /> : <Trash2 className="w-4 h-4" />} Delete</button>
        </div>
      </Modal>
    </div>
  );
}
