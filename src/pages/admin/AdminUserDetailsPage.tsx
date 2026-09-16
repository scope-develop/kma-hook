import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Loading';
import type { AdminUserDetails, AdminHistoryEntry, AdminWebhook, AuditLog } from '@/lib/types';
import { ArrowLeft, Ban, UserCheck, UserX, Trash2, Shield, Crown, Webhook, MessageSquare, Blocks, AlertTriangle } from 'lucide-react';

export function AdminUserDetailsPage() {
  const { adminUserId, toast, setAdminPage } = useApp();
  const [user, setUser] = useState<AdminUserDetails | null>(null);
  const [webhooks, setWebhooks] = useState<AdminWebhook[]>([]);
  const [history, setHistory] = useState<AdminHistoryEntry[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [acting, setActing] = useState(false);
  const [banModal, setBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    if (!adminUserId) { setAdminPage('admin-users'); return; }
    (async () => {
      setLoading(true);
      try {
        const [{ data: ud }, { data: allH }, { data: allW }, { data: allL }] = await Promise.all([
          supabase.rpc('admin_get_user_details', { p_user_id: adminUserId }),
          supabase.rpc('admin_get_all_history'),
          supabase.rpc('admin_get_all_webhooks'),
          supabase.rpc('admin_get_audit_logs'),
        ]);
        setUser((ud as unknown as AdminUserDetails[])?.[0] ?? null);
        setWebhooks(((allW as unknown as AdminWebhook[]) ?? []).filter((w) => w.owner_id === adminUserId));
        setHistory(((allH as unknown as AdminHistoryEntry[]) ?? []).filter((h) => h.user_id === adminUserId).slice(0, 20));
        setLogs(((allL as unknown as AuditLog[]) ?? []).filter((l) => l.user_id === adminUserId || l.target_user_id === adminUserId).slice(0, 20));
      } catch { toast('error', 'Failed to load user details'); } finally { setLoading(false); }
    })();
  }, [adminUserId, setAdminPage, toast]);

  if (loading) return <div className="panel p-10"><Spinner className="mx-auto w-5 h-5" /></div>;
  if (!user) return <div className="panel p-10 text-center text-sm text-zinc-600">User not found.</div>;

  const handleBan = async () => {
    setActing(true);
    try {
      const { error } = await supabase.rpc('admin_ban_user', { p_user_id: user.id, p_reason: banReason || 'Banned by admin' });
      if (error) throw error;
      toast('success', 'User banned'); setBanModal(false); setBanReason('');
      const { data } = await supabase.rpc('admin_get_user_details', { p_user_id: user.id });
      setUser((data as unknown as AdminUserDetails[])?.[0] ?? user);
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  const handleUnban = async () => {
    setActing(true);
    try {
      const { error } = await supabase.rpc('admin_unban_user', { p_user_id: user.id });
      if (error) throw error;
      toast('success', 'User unbanned');
      const { data } = await supabase.rpc('admin_get_user_details', { p_user_id: user.id });
      setUser((data as unknown as AdminUserDetails[])?.[0] ?? user);
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  const handleToggleDisable = async () => {
    setActing(true);
    try {
      const { error } = await supabase.rpc('admin_set_user_disabled', { p_user_id: user.id, p_disabled: !user.is_disabled });
      if (error) throw error;
      toast('success', `User ${user.is_disabled ? 'enabled' : 'disabled'}`);
      const { data } = await supabase.rpc('admin_get_user_details', { p_user_id: user.id });
      setUser((data as unknown as AdminUserDetails[])?.[0] ?? user);
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  const handleDelete = async () => {
    setActing(true);
    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: user.id });
      if (error) throw error;
      toast('success', 'User deleted'); setAdminPage('admin-users');
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  const roleIcon = (role: string) => role === 'super_admin' ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : role === 'admin' ? <Shield className="w-3.5 h-3.5 text-accent-bright" /> : null;

  return (
    <div>
      <PageHeader
        title="User Details"
        subtitle={user.email}
        actions={<button onClick={() => setAdminPage('admin-users')} className="btn btn-ghost"><ArrowLeft className="w-4 h-4" /> Back to Users</button>}
      />

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="panel p-5 animate-fade-in">
          <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4">Account Info</h3>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-2xs uppercase text-zinc-600 font-semibold">Email</dt><dd className="text-zinc-200 mt-0.5">{user.email}</dd></div>
            <div><dt className="text-2xs uppercase text-zinc-600 font-semibold">Role</dt><dd className="mt-0.5 flex items-center gap-1.5"><span className="tag tag-neutral">{roleIcon(user.role)} {user.role}</span></dd></div>
            <div><dt className="text-2xs uppercase text-zinc-600 font-semibold">Status</dt><dd className="mt-0.5">{user.is_banned ? <span className="tag tag-error">banned</span> : user.is_disabled ? <span className="tag tag-neutral" style={{ color: '#fbbf24' }}>disabled</span> : <span className="tag tag-success">active</span>}</dd></div>
            {user.ban_reason && <div><dt className="text-2xs uppercase text-zinc-600 font-semibold">Ban Reason</dt><dd className="text-red-400 mt-0.5 text-xs">{user.ban_reason}</dd></div>}
            <div><dt className="text-2xs uppercase text-zinc-600 font-semibold">Created</dt><dd className="text-zinc-400 mt-0.5 font-mono text-2xs">{new Date(user.created_at).toLocaleString()}</dd></div>
            <div><dt className="text-2xs uppercase text-zinc-600 font-semibold">Last Sign In</dt><dd className="text-zinc-400 mt-0.5 font-mono text-2xs">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}</dd></div>
          </dl>
        </div>

        <div className="panel p-5 animate-fade-in">
          <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4">Usage Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-3">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1"><Webhook className="w-3.5 h-3.5" /><span className="text-2xs uppercase font-semibold">Webhooks</span></div>
              <div className="font-display text-xl font-bold text-zinc-100">{user.webhook_count}</div>
            </div>
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-3">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1"><MessageSquare className="w-3.5 h-3.5" /><span className="text-2xs uppercase font-semibold">Messages</span></div>
              <div className="font-display text-xl font-bold text-zinc-100">{user.messages_sent}</div>
            </div>
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-3">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1"><Blocks className="w-3.5 h-3.5" /><span className="text-2xs uppercase font-semibold">Embeds</span></div>
              <div className="font-display text-xl font-bold text-zinc-100">{user.embeds_sent}</div>
            </div>
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-3">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1"><AlertTriangle className="w-3.5 h-3.5" /><span className="text-2xs uppercase font-semibold">Errors</span></div>
              <div className="font-display text-xl font-bold text-zinc-100">{user.errors}</div>
            </div>
          </div>
        </div>

        <div className="panel p-5 animate-fade-in">
          <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4">Actions</h3>
          <div className="space-y-2">
            {user.is_banned ? (
              <button onClick={handleUnban} disabled={acting} className="btn btn-ghost w-full justify-start"><UserCheck className="w-4 h-4" /> Unban User</button>
            ) : (
              <button onClick={() => setBanModal(true)} disabled={acting} className="btn btn-danger w-full justify-start"><Ban className="w-4 h-4" /> Ban User</button>
            )}
            <button onClick={handleToggleDisable} disabled={acting} className="btn btn-ghost w-full justify-start">
              {user.is_disabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
              {user.is_disabled ? 'Enable Account' : 'Disable Account'}
            </button>
            <button onClick={() => setDeleteConfirm(true)} disabled={acting} className="btn btn-danger w-full justify-start"><Trash2 className="w-4 h-4" /> Delete User</button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="panel animate-fade-in">
          <div className="px-5 py-3 border-b border-kma-border-subtle"><h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Associated Webhooks</h3></div>
          {webhooks.length === 0 ? <div className="px-5 py-6 text-center text-sm text-zinc-600">No webhooks.</div> : (
            <div className="divide-y divide-kma-border-subtle">
              {webhooks.map((w) => (
                <div key={w.id} className="px-5 py-2.5 flex items-center justify-between">
                  <div><div className="text-[13px] text-zinc-200 font-medium">{w.name}</div><div className="text-2xs text-zinc-600 font-mono mt-0.5">{w.status} · {new Date(w.created_at).toLocaleDateString()}</div></div>
                  <span className={`w-2 h-2 rounded-full ${w.is_active ? 'bg-accent-bright' : 'bg-zinc-600'}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel animate-fade-in">
          <div className="px-5 py-3 border-b border-kma-border-subtle"><h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Action History</h3></div>
          {history.length === 0 ? <div className="px-5 py-6 text-center text-sm text-zinc-600">No history.</div> : (
            <div className="divide-y divide-kma-border-subtle max-h-[300px] overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="px-5 py-2.5">
                  <div className="flex items-center gap-2"><span className="tag tag-neutral">{h.action}</span><span className={h.status === 'success' ? 'tag tag-success' : 'tag tag-error'}>{h.status}</span><span className="text-2xs text-zinc-600 font-mono ml-auto">{new Date(h.created_at).toLocaleString()}</span></div>
                  <div className="text-xs text-zinc-400 mt-1 truncate">{h.content || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel animate-fade-in lg:col-span-2">
          <div className="px-5 py-3 border-b border-kma-border-subtle"><h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Security Logs</h3></div>
          {logs.length === 0 ? <div className="px-5 py-6 text-center text-sm text-zinc-600">No security logs.</div> : (
            <div className="divide-y divide-kma-border-subtle max-h-[300px] overflow-y-auto">
              {logs.map((l) => (
                <div key={l.id} className="px-5 py-2.5 flex items-center gap-3">
                  <span className="text-2xs text-zinc-600 font-mono whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</span>
                  <span className="tag tag-neutral">{l.action}</span>
                  <span className="text-xs text-zinc-400 truncate">{l.detail || '—'}</span>
                  <span className={`tag ml-auto ${l.status === 'success' ? 'tag-success' : 'tag-error'}`}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={banModal} onClose={() => setBanModal(false)} title="Ban User">
        <p className="text-sm text-zinc-300 mb-4">Ban <span className="font-semibold text-zinc-100">{user.email}</span>?</p>
        <label className="label">Reason</label>
        <input className="input" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason for ban" autoFocus />
        <div className="flex gap-2 mt-4">
          <button onClick={() => setBanModal(false)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleBan} disabled={acting} className="btn btn-danger flex-1">{acting ? <Spinner /> : <Ban className="w-4 h-4" />} Ban</button>
        </div>
      </Modal>

      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Delete User">
        <p className="text-sm text-red-400 font-semibold mb-2">This action is irreversible</p>
        <p className="text-sm text-zinc-300 mb-1">Delete <span className="font-semibold text-zinc-100">{user.email}</span>?</p>
        <p className="text-sm text-zinc-600 mb-5">All associated data will be permanently removed.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteConfirm(false)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={acting} className="btn btn-danger flex-1">{acting ? <Spinner /> : <Trash2 className="w-4 h-4" />} Delete</button>
        </div>
      </Modal>
    </div>
  );
}
