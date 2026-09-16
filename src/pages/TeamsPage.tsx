import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import type { Team, TeamMember, TeamRole } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Loading';
import {
  Users, Plus, Trash2, Pencil, Crown, Shield, User as UserIcon,
  UserPlus, X, ChevronRight, Webhook,
} from 'lucide-react';

const ROLE_STYLES: Record<TeamRole, { tag: string; icon: typeof Crown; label: string }> = {
  owner: { tag: 'tag tag-accent', icon: Crown, label: 'Owner' },
  admin: { tag: 'tag tag-teal', icon: Shield, label: 'Admin' },
  member: { tag: 'tag tag-neutral', icon: UserIcon, label: 'Member' },
};

export function TeamsPage() {
  const { toast } = useApp();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' as 'admin' | 'member' });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_teams');
    if (!error && data) setTeams(data as Team[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshMembers = useCallback(async (teamId: string) => {
    setLoadingMembers(true);
    const { data, error } = await supabase.rpc('get_team_members', { p_team_id: teamId });
    if (!error && data) setMembers(data as TeamMember[]);
    setLoadingMembers(false);
  }, []);

  const openTeam = (team: Team) => {
    setSelectedTeam(team);
    refreshMembers(team.id);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast('error', 'Team name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('create_team', { p_name: form.name.trim(), p_description: form.description.trim() });
      if (error) throw error;
      toast('success', `Team "${form.name}" created`);
      setShowCreate(false); setForm({ name: '', description: '' }); refresh();
    } catch (err) { toast('error', (err as Error).message || 'Failed to create team'); } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!selectedTeam || !editForm.name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_team', {
        p_id: selectedTeam.id, p_name: editForm.name.trim(), p_description: editForm.description.trim(),
      });
      if (error) throw error;
      toast('success', 'Team updated');
      setShowEdit(false); refresh();
    } catch (err) { toast('error', (err as Error).message || 'Failed to update'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.rpc('delete_team', { p_id: deleteTarget.id });
      if (error) throw error;
      toast('success', `Team "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      if (selectedTeam?.id === deleteTarget.id) setSelectedTeam(null);
      refresh();
    } catch (err) { toast('error', (err as Error).message || 'Failed to delete'); }
  };

  const handleInvite = async () => {
    if (!selectedTeam || !inviteForm.email.trim()) { toast('error', 'Email is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('add_team_member', {
        p_team_id: selectedTeam.id, p_user_email: inviteForm.email.trim(), p_role: inviteForm.role,
      });
      if (error) throw error;
      toast('success', `Invited ${inviteForm.email} as ${inviteForm.role}`);
      setShowInvite(false); setInviteForm({ email: '', role: 'member' });
      refreshMembers(selectedTeam.id); refresh();
    } catch (err) { toast('error', (err as Error).message || 'Failed to add member'); } finally { setSaving(false); }
  };

  const handleRoleChange = async (memberId: string, role: 'admin' | 'member') => {
    try {
      const { error } = await supabase.rpc('update_team_member', { p_id: memberId, p_role: role });
      if (error) throw error;
      toast('success', 'Role updated');
      if (selectedTeam) refreshMembers(selectedTeam.id);
    } catch (err) { toast('error', (err as Error).message || 'Failed to update role'); }
  };

  const handleRemove = async (memberId: string) => {
    try {
      const { error } = await supabase.rpc('remove_team_member', { p_id: memberId });
      if (error) throw error;
      toast('success', 'Member removed');
      if (selectedTeam) refreshMembers(selectedTeam.id);
      refresh();
    } catch (err) { toast('error', (err as Error).message || 'Failed to remove member'); }
  };

  const canManage = (team: Team | null) => team?.role === 'owner' || team?.role === 'admin';

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner className="w-5 h-5" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Teams"
        subtitle="Organize webhooks into teams with role-based access"
        actions={
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Create Team
          </button>
        }
      />

      {teams.length === 0 ? (
        <div className="panel p-10 flex flex-col items-center text-center animate-fade-in">
          <div className="w-10 h-10 rounded-md bg-kma-elevated border border-kma-border flex items-center justify-center mb-4">
            <Users className="w-5 h-5 text-zinc-500" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200 mb-1">No teams yet</h3>
          <p className="text-sm text-zinc-600 max-w-sm mb-5">Create a team to organize webhooks and collaborate with other members.</p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">Create a Team</button>
        </div>
      ) : !selectedTeam ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
          {teams.map((team) => {
            const RoleIcon = ROLE_STYLES[team.role].icon;
            return (
              <button
                key={team.id}
                onClick={() => openTeam(team)}
                className="panel p-5 text-left hover:border-kma-border transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-md bg-kma-elevated border border-kma-border flex items-center justify-center">
                    <Users className="w-4 h-4 text-accent-bright" />
                  </div>
                  <span className={`tag ${ROLE_STYLES[team.role].tag}`}>
                    <RoleIcon className="w-2.5 h-2.5" />
                    {ROLE_STYLES[team.role].label}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">{team.name}</h3>
                {team.description && <p className="text-xs text-zinc-600 mb-3 line-clamp-2">{team.description}</p>}
                <div className="flex items-center gap-3 text-2xs text-zinc-600">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{team.member_count} members</span>
                  <span className="flex items-center gap-1"><Webhook className="w-3 h-3" />{team.webhook_count} webhooks</span>
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs text-accent-bright opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage <ChevronRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setSelectedTeam(null)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              All Teams
            </button>
            <ChevronRight className="w-3 h-3 text-zinc-700" />
            <span className="text-xs text-zinc-300 font-medium">{selectedTeam.name}</span>
          </div>

          <div className="panel p-5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">{selectedTeam.name}</h2>
                {selectedTeam.description && <p className="text-sm text-zinc-500 mt-0.5">{selectedTeam.description}</p>}
              </div>
              {canManage(selectedTeam) && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditForm({ name: selectedTeam.name, description: selectedTeam.description }); setShowEdit(true); }}
                    className="btn btn-ghost py-1.5 px-2.5 text-xs"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {selectedTeam.role === 'owner' && (
                    <button onClick={() => setDeleteTarget(selectedTeam)} className="btn btn-danger py-1.5 px-2.5 text-xs">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="flex items-center justify-between px-5 py-3 border-b border-kma-border-subtle">
              <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Members</h3>
              {canManage(selectedTeam) && (
                <button onClick={() => setShowInvite(true)} className="btn btn-primary py-1.5 px-3 text-xs">
                  <UserPlus className="w-3.5 h-3.5" /> Invite
                </button>
              )}
            </div>

            {loadingMembers ? (
              <div className="flex justify-center py-8"><Spinner className="w-5 h-5" /></div>
            ) : members.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-600">No members yet</div>
            ) : (
              <div>
                {members.map((m, i) => {
                  const RoleIcon = ROLE_STYLES[m.role].icon;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-3 px-5 py-3 ${i !== members.length - 1 ? 'border-b border-kma-border-subtle' : ''} hover:bg-kma-elevated/40 transition-colors`}
                    >
                      <div className="w-8 h-8 rounded-md bg-kma-elevated flex items-center justify-center text-steel-bright font-semibold text-xs shrink-0">
                        {m.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-zinc-100 truncate">{m.email}</div>
                        <div className="text-2xs text-zinc-600">Joined {new Date(m.created_at).toLocaleDateString()}</div>
                      </div>
                      <span className={`tag ${ROLE_STYLES[m.role].tag}`}>
                        <RoleIcon className="w-2.5 h-2.5" />
                        {ROLE_STYLES[m.role].label}
                      </span>
                      {canManage(selectedTeam) && m.role !== 'owner' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as 'admin' | 'member')}
                            className="input py-1 px-2 text-2xs w-auto"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => handleRemove(m.id)} className="text-red-400/70 hover:text-red-400 p-1 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Team">
        <div className="space-y-4">
          <div>
            <label className="label">Team Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Team" autoFocus />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this team for?" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Spinner /> : <Plus className="w-4 h-4" />} Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Team Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Team">
        <div className="space-y-4">
          <div>
            <label className="label">Team Name</label>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowEdit(false)} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleEdit} disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Spinner /> : <Pencil className="w-4 h-4" />} Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Invite Member Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Member">
        <div className="space-y-4">
          <div>
            <label className="label">User Email</label>
            <input className="input" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="user@example.com" autoFocus />
            <p className="text-2xs text-zinc-600 mt-1.5">The user must have a KMA Tools account with this email.</p>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'admin' | 'member' })}>
              <option value="member">Member — can view team and use shared webhooks</option>
              <option value="admin">Admin — can invite and manage members</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowInvite(false)} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleInvite} disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Spinner /> : <UserPlus className="w-4 h-4" />} Invite
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Team Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Team">
        <p className="text-sm text-zinc-300 mb-1">Delete team "{deleteTarget?.name}"?</p>
        <p className="text-sm text-zinc-600 mb-5">All members will be removed. Webhooks will remain but will be unassigned from the team.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} className="btn btn-danger flex-1"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </Modal>
    </div>
  );
}
