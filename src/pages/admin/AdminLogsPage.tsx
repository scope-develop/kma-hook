import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Loading';
import type { AuditLog } from '@/lib/types';
import { Search, ScrollText } from 'lucide-react';

type ActionFilter = 'ALL' | 'USER_BAN' | 'USER_UNBAN' | 'USER_DELETE' | 'ROLE_CHANGE' | 'WEBHOOK_DELETE' | 'TEMPLATE_CREATE' | 'SETTING_CHANGE' | 'USER_DISABLE' | 'USER_ENABLE';

export function AdminLogsPage() {
  const { toast } = useApp();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_get_audit_logs');
    if (error) { toast('error', 'Failed to load audit logs'); } else { setLogs((data as AuditLog[]) ?? []); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter((l) => {
    if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
    if (search && !l.user_email?.toLowerCase().includes(search.toLowerCase()) && !l.action.toLowerCase().includes(search.toLowerCase()) && !l.detail?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const actionColor = (action: string) => {
    if (action.includes('BAN') || action.includes('DELETE')) return 'tag-error';
    if (action.includes('DISABLE')) return 'tag-neutral';
    if (action.includes('CREATE') || action.includes('ENABLE') || action.includes('UNBAN')) return 'tag-success';
    return 'tag-neutral';
  };

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Persistent record of all administrative actions" />

      <div className="panel p-3 mb-4 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input className="input pl-9" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input !w-auto" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="ALL">All Actions</option>
            <option value="USER_BAN">Ban</option><option value="USER_UNBAN">Unban</option><option value="USER_DELETE">Delete User</option>
            <option value="ROLE_CHANGE">Role Change</option><option value="WEBHOOK_DELETE">Webhook Delete</option>
            <option value="TEMPLATE_CREATE">Template Create</option><option value="TEMPLATE_UPDATE">Template Update</option>
            <option value="TEMPLATE_DELETE">Template Delete</option><option value="SETTING_CHANGE">Setting Change</option>
            <option value="USER_DISABLE">User Disable</option><option value="USER_ENABLE">User Enable</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="panel p-10"><Spinner className="mx-auto w-5 h-5" /></div>
      ) : filtered.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-zinc-600">
          <ScrollText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          No audit logs found.
        </div>
      ) : (
        <div className="panel overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-kma-border-subtle text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                  <th className="text-left px-4 py-2.5">Timestamp</th>
                  <th className="text-left px-3 py-2.5">Admin</th>
                  <th className="text-left px-3 py-2.5">Action</th>
                  <th className="text-left px-3 py-2.5">Target</th>
                  <th className="text-left px-3 py-2.5">Detail</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-kma-border-subtle last:border-0 hover:bg-kma-elevated/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap font-mono text-2xs">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-zinc-400 truncate max-w-[160px]">{l.user_email ?? 'System'}</td>
                    <td className="px-3 py-2.5"><span className={`tag ${actionColor(l.action)}`}>{l.action}</span></td>
                    <td className="px-3 py-2.5 text-zinc-500 text-xs">{l.target_type ?? '—'}</td>
                    <td className="px-3 py-2.5 text-zinc-400 max-w-xs truncate">{l.detail || '—'}</td>
                    <td className="px-3 py-2.5">{l.status === 'success' ? <span className="tag tag-success">success</span> : <span className="tag tag-error">error</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
