import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Loading';
import type { AuditLog, UserProfile, AdminWebhook } from '@/lib/types';
import { ShieldAlert, Ban, AlertTriangle, Activity, Webhook, UserX, CheckCircle2 } from 'lucide-react';

export function AdminSecurityPage() {
  const { toast } = useApp();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [webhooks, setWebhooks] = useState<AdminWebhook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: l }, { data: u }, { data: w }] = await Promise.all([
          supabase.rpc('admin_get_audit_logs'),
          supabase.rpc('admin_get_users'),
          supabase.rpc('admin_get_all_webhooks'),
        ]);
        setLogs((l as AuditLog[]) ?? []);
        setUsers((u as UserProfile[]) ?? []);
        setWebhooks((w as AdminWebhook[]) ?? []);
      } catch { toast('error', 'Failed to load security data'); } finally { setLoading(false); }
    })();
  }, [toast]);

  if (loading) return <div className="panel p-10"><Spinner className="mx-auto w-5 h-5" /></div>;

  const bannedUsers = users.filter((u) => u.is_banned);
  const disabledUsers = users.filter((u) => u.is_disabled);
  const errorWebhooks = webhooks.filter((w) => w.status === 'error');
  const recentErrors = logs.filter((l) => l.status === 'error').slice(0, 10);
  const recentActions = logs.slice(0, 10);

  const alerts: { severity: 'high' | 'medium' | 'low'; message: string }[] = [];
  if (bannedUsers.length > 0) alerts.push({ severity: 'high', message: `${bannedUsers.length} banned user(s) on the platform` });
  if (errorWebhooks.length > 0) alerts.push({ severity: 'medium', message: `${errorWebhooks.length} webhook(s) with error status` });
  if (disabledUsers.length > 0) alerts.push({ severity: 'medium', message: `${disabledUsers.length} disabled account(s)` });

  return (
    <div>
      <PageHeader title="Security Center" subtitle="Monitor security events and platform health" />

      {alerts.length > 0 && (
        <div className="space-y-2 mb-4 animate-fade-in">
          {alerts.map((a, i) => (
            <div key={i} className={`panel p-3.5 flex items-center gap-3 ${a.severity === 'high' ? 'border-red-500/20' : 'border-amber-500/20'}`} style={{ borderColor: a.severity === 'high' ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)' }}>
              <ShieldAlert className={`w-4 h-4 ${a.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
              <span className="text-sm text-zinc-300">{a.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="panel p-4 animate-fade-in"><div className="flex items-center justify-between mb-2"><span className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Banned</span><Ban className="w-4 h-4 text-red-400" /></div><div className="font-display text-2xl font-bold text-zinc-100">{bannedUsers.length}</div></div>
        <div className="panel p-4 animate-fade-in"><div className="flex items-center justify-between mb-2"><span className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Disabled</span><UserX className="w-4 h-4 text-amber-400" /></div><div className="font-display text-2xl font-bold text-zinc-100">{disabledUsers.length}</div></div>
        <div className="panel p-4 animate-fade-in"><div className="flex items-center justify-between mb-2"><span className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Error Webhooks</span><Webhook className="w-4 h-4 text-red-400" /></div><div className="font-display text-2xl font-bold text-zinc-100">{errorWebhooks.length}</div></div>
        <div className="panel p-4 animate-fade-in"><div className="flex items-center justify-between mb-2"><span className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Audit Events</span><Activity className="w-4 h-4 text-accent-bright" /></div><div className="font-display text-2xl font-bold text-zinc-100">{logs.length}</div></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="panel animate-fade-in">
          <div className="px-5 py-3 border-b border-kma-border-subtle"><h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Banned Users</h3></div>
          {bannedUsers.length === 0 ? <div className="px-5 py-6 text-center text-sm text-zinc-600 flex flex-col items-center"><CheckCircle2 className="w-6 h-6 text-accent-bright mb-1" />No banned users.</div> : (
            <div className="divide-y divide-kma-border-subtle">
              {bannedUsers.map((u) => (
                <div key={u.id} className="px-5 py-2.5"><div className="text-[13px] text-zinc-200 font-medium">{u.email}</div><div className="text-2xs text-red-400 mt-0.5">{u.ban_reason ?? 'No reason provided'}</div></div>
              ))}
            </div>
          )}
        </div>

        <div className="panel animate-fade-in">
          <div className="px-5 py-3 border-b border-kma-border-subtle"><h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Error Webhooks</h3></div>
          {errorWebhooks.length === 0 ? <div className="px-5 py-6 text-center text-sm text-zinc-600 flex flex-col items-center"><CheckCircle2 className="w-6 h-6 text-accent-bright mb-1" />All webhooks operational.</div> : (
            <div className="divide-y divide-kma-border-subtle">
              {errorWebhooks.map((w) => (
                <div key={w.id} className="px-5 py-2.5"><div className="text-[13px] text-zinc-200 font-medium">{w.name}</div><div className="text-2xs text-zinc-500 mt-0.5">Owner: {w.owner_email} · HTTP {w.last_http_status ?? '—'}</div></div>
              ))}
            </div>
          )}
        </div>

        <div className="panel animate-fade-in">
          <div className="px-5 py-3 border-b border-kma-border-subtle"><h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Recent Errors</h3></div>
          {recentErrors.length === 0 ? <div className="px-5 py-6 text-center text-sm text-zinc-600">No recent errors.</div> : (
            <div className="divide-y divide-kma-border-subtle max-h-[300px] overflow-y-auto">
              {recentErrors.map((l) => (
                <div key={l.id} className="px-5 py-2.5 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" /><span className="text-xs text-zinc-400 truncate">{l.detail || l.action}</span><span className="text-2xs text-zinc-600 font-mono ml-auto whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</span></div>
              ))}
            </div>
          )}
        </div>

        <div className="panel animate-fade-in">
          <div className="px-5 py-3 border-b border-kma-border-subtle"><h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Recent Admin Actions</h3></div>
          {recentActions.length === 0 ? <div className="px-5 py-6 text-center text-sm text-zinc-600">No admin actions logged.</div> : (
            <div className="divide-y divide-kma-border-subtle max-h-[300px] overflow-y-auto">
              {recentActions.map((l) => (
                <div key={l.id} className="px-5 py-2.5 flex items-center gap-2"><span className="tag tag-neutral">{l.action}</span><span className="text-xs text-zinc-400 truncate">{l.user_email ?? 'System'}</span><span className="text-2xs text-zinc-600 font-mono ml-auto whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
