import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Loading';
import type { AdminWebhook } from '@/lib/types';
import { Search, Trash2, Zap } from 'lucide-react';

type StatusFilter = 'ALL' | 'operational' | 'error' | 'warning' | 'unknown';

export function AdminWebhooksPage() {
  const { toast } = useApp();
  const [webhooks, setWebhooks] = useState<AdminWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<AdminWebhook | null>(null);
  const [acting, setActing] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_get_all_webhooks');
    if (error) { toast('error', 'Failed to load webhooks'); } else { setWebhooks((data as AdminWebhook[]) ?? []); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = webhooks.filter((w) => {
    if (statusFilter !== 'ALL' && w.status !== statusFilter) return false;
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.owner_email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc('admin_delete_webhook', { p_webhook_id: deleteTarget.id });
      if (error) throw error;
      toast('success', 'Webhook deleted'); setDeleteTarget(null); load();
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  const handleTest = async (w: AdminWebhook) => {
    setTestingId(w.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kma-webhook/test-webhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: token },
        body: JSON.stringify({ webhook_id: w.id }),
      });
      const result = await res.json();
      if (result.reachable) toast('success', `"${w.name}" is reachable (${result.latency_ms}ms)`);
      else toast('error', `"${w.name}" returned HTTP ${result.status}`);
      load();
    } catch { toast('error', 'Test failed'); } finally { setTestingId(null); }
  };

  const statusDot = (status: string) => {
    const colors: Record<string, string> = { operational: 'bg-accent-bright', error: 'bg-red-400', warning: 'bg-amber-400', unknown: 'bg-zinc-600' };
    return colors[status] ?? 'bg-zinc-600';
  };

  return (
    <div>
      <PageHeader title="Webhook Management" subtitle="All webhooks across all users" />

      <div className="panel p-3 mb-4 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input className="input pl-9" placeholder="Search by name or owner..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="ALL">All Status</option><option value="operational">Operational</option><option value="error">Error</option><option value="warning">Warning</option><option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="panel p-10"><Spinner className="mx-auto w-5 h-5" /></div>
      ) : filtered.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-zinc-600">No webhooks match your filters.</div>
      ) : (
        <div className="panel overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-kma-border-subtle text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                  <th className="text-left px-4 py-2.5">Name</th>
                  <th className="text-left px-3 py-2.5">Owner</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Active</th>
                  <th className="text-left px-3 py-2.5">Last Test</th>
                  <th className="text-left px-3 py-2.5">Created</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} className="border-b border-kma-border-subtle last:border-0 hover:bg-kma-elevated/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-200 font-medium">{w.name}</td>
                    <td className="px-3 py-2.5 text-zinc-400 truncate max-w-[180px]">{w.owner_email}</td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${statusDot(w.status)}`} /><span className="text-zinc-400">{w.status}</span></div></td>
                    <td className="px-3 py-2.5">{w.is_active ? <span className="tag tag-success">active</span> : <span className="tag tag-neutral">inactive</span>}</td>
                    <td className="px-3 py-2.5 text-zinc-500 font-mono text-2xs whitespace-nowrap">{w.last_tested_at ? new Date(w.last_tested_at).toLocaleString() : 'Never'}</td>
                    <td className="px-3 py-2.5 text-zinc-500 font-mono text-2xs whitespace-nowrap">{new Date(w.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleTest(w)} disabled={testingId === w.id} className="p-1.5 rounded-md text-zinc-500 hover:text-accent-bright hover:bg-kma-elevated transition-colors" title="Test">
                          {testingId === w.id ? <Spinner /> : <Zap className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setDeleteTarget(w)} className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-kma-elevated transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Webhook">
        <p className="text-sm text-zinc-300 mb-1">Delete webhook <span className="font-semibold text-zinc-100">{deleteTarget?.name}</span>?</p>
        <p className="text-sm text-zinc-600 mb-1">Owner: {deleteTarget?.owner_email}</p>
        <p className="text-sm text-zinc-600 mb-5">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={acting} className="btn btn-danger flex-1">{acting ? <Spinner /> : <Trash2 className="w-4 h-4" />} Delete</button>
        </div>
      </Modal>
    </div>
  );
}
