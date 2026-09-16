import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import type { HistoryEntry } from '@/lib/types';
import { History as HistoryIcon, Search, Download, Trash2, MessageSquare, Blocks, FileText, CheckCircle2, XCircle } from 'lucide-react';

type ActionFilter = 'ALL' | 'MESSAGE' | 'EMBED' | 'TEMPLATE';
type StatusFilter = 'ALL' | 'success' | 'error';

export function HistoryPage() {
  const { historyVersion, toast } = useApp();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showClear, setShowClear] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('history').select('*').order('created_at', { ascending: false }).limit(200);
    setEntries((data as HistoryEntry[]) ?? []); setLoading(false);
  };

  useEffect(() => { load(); }, [historyVersion]);

  const filtered = entries.filter((e) => {
    if (actionFilter !== 'ALL' && e.action !== actionFilter) return false;
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (search && !e.content.toLowerCase().includes(search.toLowerCase()) && !e.detail?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleClear = async () => {
    try { const { error } = await supabase.rpc('clear_history'); if (error) throw error;
      toast('success', 'History cleared'); setShowClear(false); load();
    } catch { toast('error', 'Failed to clear history'); }
  };

  const handleExport = () => {
    const lines = filtered.map((e) => {
      const time = new Date(e.created_at).toLocaleString();
      return `[${time}] ${e.action} | ${e.status.toUpperCase()} | ${e.content}${e.detail ? ' | ' + e.detail : ''}`;
    });
    const text = `KMA TOOLS — History Export\nGenerated: ${new Date().toLocaleString()}\nEntries: ${lines.length}\n${'='.repeat(60)}\n\n${lines.join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `kma-history-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
    URL.revokeObjectURL(url); toast('success', `Exported ${lines.length} entries`);
  };

  const actionIcon = (a: string) => {
    if (a === 'MESSAGE') return <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />;
    if (a === 'EMBED') return <Blocks className="w-3.5 h-3.5 text-accent-bright" />;
    return <FileText className="w-3.5 h-3.5 text-amber-400" />;
  };

  return (
    <div>
      <PageHeader
        title="History"
        subtitle="Complete log of all webhook actions"
        actions={
          <>
            <button onClick={handleExport} disabled={filtered.length === 0} className="btn btn-ghost"><Download className="w-4 h-4" /> Export</button>
            <button onClick={() => setShowClear(true)} disabled={entries.length === 0} className="btn btn-danger"><Trash2 className="w-4 h-4" /> Clear</button>
          </>
        }
      />

      <div className="panel p-3 mb-4 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input className="input pl-9" placeholder="Search history..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <select className="input !w-auto" value={actionFilter} onChange={(e) => setActionFilter(e.target.value as ActionFilter)}>
              <option value="ALL">All Types</option><option value="MESSAGE">Message</option><option value="EMBED">Embed</option><option value="TEMPLATE">Template</option>
            </select>
            <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="ALL">All Status</option><option value="success">Success</option><option value="error">Error</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="panel p-10 text-center text-sm text-zinc-600">Loading history...</div>
      ) : filtered.length === 0 ? (
        <div className="panel p-10 text-center animate-fade-in">
          <HistoryIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-600">{entries.length === 0 ? 'No history yet. Send a message or embed to see it here.' : 'No entries match your filters.'}</p>
        </div>
      ) : (
        <div className="panel overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-kma-border-subtle text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                  <th className="text-left px-4 py-2.5">Time</th>
                  <th className="text-left px-3 py-2.5">Action</th>
                  <th className="text-left px-3 py-2.5">Content</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-kma-border-subtle last:border-0 hover:bg-kma-elevated/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap font-mono text-2xs">{new Date(e.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2">{actionIcon(e.action)}<span className="font-mono text-2xs font-semibold text-zinc-400">{e.action}</span></div></td>
                    <td className="px-3 py-2.5 text-zinc-300 max-w-md"><div className="truncate">{e.content || '—'}</div>{e.detail && <div className="text-2xs text-zinc-600 truncate mt-0.5">{e.detail}</div>}</td>
                    <td className="px-3 py-2.5">{e.status === 'success' ? <span className="tag tag-success"><CheckCircle2 className="w-3 h-3" /> success</span> : <span className="tag tag-error"><XCircle className="w-3 h-3" /> error</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showClear} onClose={() => setShowClear(false)} title="Clear History">
        <p className="text-sm text-zinc-300 mb-1">Clear all history entries?</p>
        <p className="text-sm text-zinc-600 mb-5">This will permanently remove all {entries.length} entries. This cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setShowClear(false)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleClear} className="btn btn-danger flex-1"><Trash2 className="w-4 h-4" /> Clear All</button>
        </div>
      </Modal>
    </div>
  );
}
