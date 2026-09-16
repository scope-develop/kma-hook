import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Loading';
import type { UserProfile } from '@/lib/types';
import { Search, ChevronRight, Ban, Trash2, UserX, UserCheck, Shield, Crown, Pencil } from 'lucide-react';

type RoleFilter = 'ALL' | 'user' | 'admin' | 'super_admin';
type StatusFilter = 'ALL' | 'active' | 'banned' | 'disabled';

export function AdminUsersPage() {
  const { toast, setAdminPage, setAdminUserId } = useApp();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const [banTarget, setBanTarget] = useState<UserProfile | null>(null);
  const [banReason, setBanReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<'user' | 'admin' | 'super_admin'>('user');
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_get_users');
    if (error) { toast('error', 'Failed to load users'); } else { setUsers((data as UserProfile[]) ?? []); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && (u.is_banned || u.is_disabled)) return false;
    if (statusFilter === 'banned' && !u.is_banned) return false;
    if (statusFilter === 'disabled' && !u.is_disabled) return false;
    if (search && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleBan = async () => {
    if (!banTarget) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc('admin_ban_user', { p_user_id: banTarget.id, p_reason: banReason || 'Banned by admin' });
      if (error) throw error;
      toast('success', `User ${banTarget.email} banned`); setBanTarget(null); setBanReason(''); load();
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  const handleUnban = async (u: UserProfile) => {
    try {
      const { error } = await supabase.rpc('admin_unban_user', { p_user_id: u.id });
      if (error) throw error;
      toast('success', `User ${u.email} unbanned`); load();
    } catch (e) { toast('error', (e as Error).message); }
  };

  const handleToggleDisable = async (u: UserProfile) => {
    try {
      const { error } = await supabase.rpc('admin_set_user_disabled', { p_user_id: u.id, p_disabled: !u.is_disabled });
      if (error) throw error;
      toast('success', `User ${u.email} ${u.is_disabled ? 'enabled' : 'disabled'}`); load();
    } catch (e) { toast('error', (e as Error).message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: deleteTarget.id });
      if (error) throw error;
      toast('success', `User ${deleteTarget.email} deleted`); setDeleteTarget(null); load();
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  const handleRoleChange = async () => {
    if (!roleTarget) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc('admin_update_user_role', { p_user_id: roleTarget.id, p_role: newRole });
      if (error) throw error;
      toast('success', `Role updated to ${newRole}`); setRoleTarget(null); load();
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  const roleIcon = (role: string) => {
    if (role === 'super_admin') return <Crown className="w-3 h-3 text-amber-400" />;
    if (role === 'admin') return <Shield className="w-3 h-3 text-accent-bright" />;
    return null;
  };

  const openUserDetails = (u: UserProfile) => { setAdminUserId(u.id); setAdminPage('admin-user-details'); };

  return (
    <div>
      <PageHeader title="User Management" subtitle="Search, filter, and manage all platform users" />

      <div className="panel p-3 mb-4 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input className="input pl-9" placeholder="Search by email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input !w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}>
            <option value="ALL">All Roles</option><option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option>
          </select>
          <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="ALL">All Status</option><option value="active">Active</option><option value="banned">Banned</option><option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="panel p-10"><Spinner className="mx-auto w-5 h-5" /></div>
      ) : filtered.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-zinc-600">No users match your filters.</div>
      ) : (
        <div className="panel overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-kma-border-subtle text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                  <th className="text-left px-4 py-2.5">Email</th>
                  <th className="text-left px-3 py-2.5">Role</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Created</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-kma-border-subtle last:border-0 hover:bg-kma-elevated/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <button onClick={() => openUserDetails(u)} className="text-zinc-200 font-medium hover:text-accent-bright transition-colors flex items-center gap-1.5">
                        {u.email}
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`tag ${u.role === 'super_admin' ? 'tag-accent' : u.role === 'admin' ? 'tag-success' : 'tag-neutral'}`} style={u.role === 'super_admin' ? { background: 'rgba(245,158,11,0.08)', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.15)' } : undefined}>
                        {roleIcon(u.role)} {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {u.is_banned ? <span className="tag tag-error">banned</span> : u.is_disabled ? <span className="tag tag-neutral" style={{ color: '#fbbf24' }}>disabled</span> : <span className="tag tag-success">active</span>}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-500 font-mono text-2xs whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setRoleTarget(u); setNewRole(u.role); }} className="p-1.5 rounded-md text-zinc-500 hover:text-accent-bright hover:bg-kma-elevated transition-colors" title="Change role"><Pencil className="w-3.5 h-3.5" /></button>
                        {u.is_banned ? (
                          <button onClick={() => handleUnban(u)} className="p-1.5 rounded-md text-zinc-500 hover:text-accent-bright hover:bg-kma-elevated transition-colors" title="Unban"><UserCheck className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button onClick={() => setBanTarget(u)} className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-kma-elevated transition-colors" title="Ban"><Ban className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => handleToggleDisable(u)} className="p-1.5 rounded-md text-zinc-500 hover:text-amber-400 hover:bg-kma-elevated transition-colors" title={u.is_disabled ? 'Enable' : 'Disable'}>
                          {u.is_disabled ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setDeleteTarget(u)} className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-kma-elevated transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ban modal */}
      <Modal open={!!banTarget} onClose={() => setBanTarget(null)} title="Ban User">
        <p className="text-sm text-zinc-300 mb-1">Ban <span className="font-semibold text-zinc-100">{banTarget?.email}</span>?</p>
        <p className="text-sm text-zinc-600 mb-4">The user will lose access immediately.</p>
        <label className="label">Reason</label>
        <input className="input" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason for ban" autoFocus />
        <div className="flex gap-2 mt-4">
          <button onClick={() => setBanTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleBan} disabled={acting} className="btn btn-danger flex-1">{acting ? <Spinner /> : <Ban className="w-4 h-4" />} Ban User</button>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete User">
        <p className="text-sm text-red-400 font-semibold mb-2">This action is irreversible</p>
        <p className="text-sm text-zinc-300 mb-1">Delete <span className="font-semibold text-zinc-100">{deleteTarget?.email}</span>?</p>
        <p className="text-sm text-zinc-600 mb-5">All associated data (webhooks, templates, history) will be permanently removed.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={acting} className="btn btn-danger flex-1">{acting ? <Spinner /> : <Trash2 className="w-4 h-4" />} Delete Permanently</button>
        </div>
      </Modal>

      {/* Role change modal */}
      <Modal open={!!roleTarget} onClose={() => setRoleTarget(null)} title="Change User Role">
        <p className="text-sm text-zinc-300 mb-4">User: <span className="font-semibold text-zinc-100">{roleTarget?.email}</span></p>
        <label className="label">New Role</label>
        <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as 'user' | 'admin' | 'super_admin')}>
          <option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option>
        </select>
        <div className="flex gap-2 mt-4">
          <button onClick={() => setRoleTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleRoleChange} disabled={acting} className="btn btn-primary flex-1">{acting ? <Spinner /> : <Shield className="w-4 h-4" />} Apply</button>
        </div>
      </Modal>
    </div>
  );
}
