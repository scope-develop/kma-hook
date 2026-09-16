import { useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { testWebhook } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Loading';
import type { Webhook } from '@/lib/types';
import {
  Webhook as WebhookIcon,
  Plus,
  Trash2,
  CheckCircle2,
  Zap,
  Pencil,
  Eye,
  EyeOff,
  Star,
} from 'lucide-react';

export function WebhookManagerPage() {
  const { webhooks, activeWebhook, toast, refreshWebhooks, settings } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<Webhook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const mask = (u: string) => {
    if (showUrl || !settings?.hide_urls) return u;
    return u.replace(/(https:\/\/discord(app)?\.com\/api\/webhooks\/[0-9]+\/)[^/]+/, '$1••••••••');
  };

  const openAdd = () => { setName(''); setUrl(''); setShowAdd(true); };
  const openEdit = (w: Webhook) => { setEditTarget(w); setName(w.name); setUrl(''); setShowEdit(true); };

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) { toast('error', 'Name and URL are required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('add_webhook', { p_name: name.trim(), p_url: url.trim() });
      if (error) throw error;
      toast('success', `Webhook "${name}" added`);
      setShowAdd(false); refreshWebhooks();
    } catch (err) { toast('error', (err as Error).message || 'Failed to add webhook'); } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editTarget || !name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_webhook', { p_id: editTarget.id, p_name: name.trim(), p_url: url.trim() || null });
      if (error) throw error;
      toast('success', 'Webhook updated'); setShowEdit(false); refreshWebhooks();
    } catch (err) { toast('error', (err as Error).message || 'Failed to update webhook'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.rpc('delete_webhook', { p_id: deleteTarget.id });
      if (error) throw error;
      toast('success', `Webhook "${deleteTarget.name}" deleted`); setDeleteTarget(null); refreshWebhooks();
    } catch (err) { toast('error', (err as Error).message || 'Failed to delete webhook'); }
  };

  const handleSetActive = async (w: Webhook) => {
    try {
      const { error } = await supabase.rpc('set_active_webhook', { p_id: w.id });
      if (error) throw error;
      toast('success', `"${w.name}" is now active`); refreshWebhooks();
    } catch { toast('error', 'Failed to set active webhook'); }
  };

  const handleTest = async (w: Webhook) => {
    setTestingId(w.id);
    try {
      const res = await testWebhook({ webhookId: w.id });
      if (res.reachable) toast('success', `"${w.name}" is reachable (${res.latency_ms}ms)`);
      else toast('error', `"${w.name}" returned HTTP ${res.status}`);
      refreshWebhooks();
    } catch { toast('error', 'Test failed'); } finally { setTestingId(null); }
  };

  const statusDot = (status: string) => {
    const colors: Record<string, string> = { operational: 'bg-accent-bright', error: 'bg-red-400', warning: 'bg-amber-400', unknown: 'bg-zinc-600' };
    return colors[status] ?? 'bg-zinc-600';
  };

  return (
    <div>
      <PageHeader
        title="Webhook Manager"
        subtitle="Add, edit, test, and manage your Discord webhooks"
        actions={
          <>
            <button onClick={() => setShowUrl((v) => !v)} className="btn btn-ghost">
              {showUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showUrl ? 'Hide' : 'Show'}
            </button>
            <button onClick={openAdd} className="btn btn-primary"><Plus className="w-4 h-4" /> Add</button>
          </>
        }
      />

      {webhooks.length === 0 ? (
        <div className="panel p-10 text-center animate-fade-in">
          <WebhookIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-300 mb-1">No webhooks configured</h3>
          <p className="text-sm text-zinc-600 mb-5">Add your first Discord webhook to get started.</p>
          <button onClick={openAdd} className="btn btn-primary mx-auto"><Plus className="w-4 h-4" /> Add Webhook</button>
        </div>
      ) : (
        <div className="panel animate-fade-in overflow-hidden">
          {webhooks.map((w, i) => (
            <div key={w.id} className={`flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 ${i !== webhooks.length - 1 ? 'border-b border-kma-border-subtle' : ''} hover:bg-kma-elevated/40 transition-colors`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-md bg-kma-elevated border border-kma-border flex items-center justify-center">
                    <WebhookIcon className="w-4 h-4 text-zinc-400" />
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-kma-surface ${statusDot(w.status)}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-zinc-100 truncate">{w.name}</span>
                    {w.is_active && <span className="tag tag-accent"><Star className="w-2.5 h-2.5 fill-current" /> active</span>}
                  </div>
                  <div className="text-2xs text-zinc-600 font-mono mt-0.5 truncate">{mask(w.url_masked)}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!w.is_active && (
                  <button onClick={() => handleSetActive(w)} className="btn btn-ghost py-1.5 px-2.5 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Set Active</button>
                )}
                <button onClick={() => handleTest(w)} disabled={testingId === w.id} className="btn btn-ghost py-1.5 px-2.5 text-xs">
                  {testingId === w.id ? <Spinner /> : <Zap className="w-3.5 h-3.5" />} Test
                </button>
                <button onClick={() => openEdit(w)} className="btn btn-ghost py-1.5 px-2.5 text-xs"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteTarget(w)} className="btn btn-danger py-1.5 px-2.5 text-xs"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Webhook">
        <div className="space-y-4">
          <div>
            <label className="label">Webhook Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server Webhook" autoFocus />
          </div>
          <div>
            <label className="label">Discord Webhook URL</label>
            <input className="input font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
            <p className="text-2xs text-zinc-600 mt-1.5">URL is stored securely and never exposed to the browser.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="btn btn-primary flex-1">{saving ? <Spinner /> : <Plus className="w-4 h-4" />} Add</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Webhook">
        <div className="space-y-4">
          <div>
            <label className="label">Webhook Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Discord Webhook URL (leave blank to keep current)</label>
            <input className="input font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Leave blank to keep existing" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowEdit(false)} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleEdit} disabled={saving} className="btn btn-primary flex-1">{saving ? <Spinner /> : <Pencil className="w-4 h-4" />} Save</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Webhook">
        <p className="text-sm text-zinc-300 mb-1">Delete webhook "{deleteTarget?.name}"?</p>
        <p className="text-sm text-zinc-600 mb-5">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} className="btn btn-danger flex-1"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </Modal>
    </div>
  );
}
