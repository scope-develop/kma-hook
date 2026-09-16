import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { sendTemplate } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { EmbedPreview } from '@/components/EmbedPreview';
import { Spinner } from '@/components/Loading';
import { NoActiveWebhook } from '@/components/NoActiveWebhook';
import type { EmbedPayload, Template } from '@/lib/types';
import { FileText, Plus, Send, Pencil, Trash2, Blocks, MessageSquare } from 'lucide-react';

export function TemplatesPage() {
  const { activeWebhook, settings, toast, refreshStats, bumpHistory } = useApp();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [tName, setTName] = useState('');
  const [tKind, setTKind] = useState<'message' | 'embed'>('embed');
  const [tEmbed, setTEmbed] = useState<EmbedPayload>({ title: '', description: '', color: '#10B981', author: '', footer: '', image: '', thumbnail: '', fields: [] });
  const [tMessage, setTMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    setTemplates((data as Template[]) ?? []); setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEditor = (t?: Template) => {
    if (t) { setEditTarget(t); setTName(t.name); setTKind(t.kind);
      if (t.kind === 'embed') setTEmbed(t.payload as EmbedPayload);
      else setTMessage((t.payload as { content: string }).content || '');
    } else { setEditTarget(null); setTName(''); setTKind('embed');
      setTEmbed({ title: '', description: '', color: '#10B981', author: '', footer: '', image: '', thumbnail: '', fields: [] });
      setTMessage('');
    } setShowEditor(true);
  };

  const handleSave = async () => {
    if (!tName.trim()) { toast('error', 'Template name is required'); return; }
    setSaving(true);
    const payload = tKind === 'embed' ? tEmbed : { content: tMessage };
    try {
      if (editTarget) {
        const { error } = await supabase.from('templates').update({ name: tName, kind: tKind, payload, updated_at: new Date().toISOString() }).eq('id', editTarget.id);
        if (error) throw error; toast('success', 'Template updated');
      } else {
        const { error } = await supabase.from('templates').insert({ name: tName, kind: tKind, payload });
        if (error) throw error; toast('success', 'Template created');
      } setShowEditor(false); load();
    } catch { toast('error', 'Failed to save template'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { const { error } = await supabase.from('templates').delete().eq('id', deleteTarget.id);
      if (error) throw error; toast('success', `Template "${deleteTarget.name}" deleted`); setDeleteTarget(null); load();
    } catch { toast('error', 'Failed to delete template'); }
  };

  const handleSend = async (t: Template) => {
    if (!activeWebhook) { toast('error', 'No active webhook'); return; }
    setSendingId(t.id);
    try {
      const res = await sendTemplate({ webhookId: activeWebhook.id, template: { name: t.name, kind: t.kind, payload: t.payload as Record<string, unknown> }, username: settings?.bot_name || undefined, avatarUrl: settings?.avatar_url || undefined });
      if (res.ok) { toast('success', `Template "${t.name}" sent`); refreshStats(); bumpHistory(); }
      else { toast('error', res.message || res.error || 'Failed to send'); refreshStats(); bumpHistory(); }
    } catch { toast('error', 'Network error'); } finally { setSendingId(null); }
  };

  if (!activeWebhook) return <NoActiveWebhook message="Add a webhook in the Webhook Manager before sending templates." />;

  return (
    <div>
      <PageHeader title="Templates" subtitle="Reusable message and embed templates" actions={<button onClick={() => openEditor()} className="btn btn-primary"><Plus className="w-4 h-4" /> New</button>} />

      {loading ? (
        <div className="panel p-10"><Spinner className="mx-auto w-5 h-5" /></div>
      ) : templates.length === 0 ? (
        <div className="panel p-10 text-center animate-fade-in">
          <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-300 mb-1">No templates yet</h3>
          <p className="text-sm text-zinc-600 mb-5">Create a template to reuse later.</p>
          <button onClick={() => openEditor()} className="btn btn-primary mx-auto"><Plus className="w-4 h-4" /> New Template</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="panel p-4 animate-fade-in flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center ${t.kind === 'embed' ? 'bg-accent-bg text-accent-bright' : 'bg-kma-elevated text-zinc-400'}`}>
                    {t.kind === 'embed' ? <Blocks className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-100 text-[13px]">{t.name}</div>
                    <div className="text-2xs text-zinc-600 font-mono">{t.kind} · {new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-[#313338] rounded-md p-3 my-2 min-h-[80px] max-h-[200px] overflow-y-auto">
                {t.kind === 'embed' ? (
                  <div className="scale-90 origin-top-left"><EmbedPreview embed={t.payload as EmbedPayload} botName={settings?.bot_name} avatarUrl={settings?.avatar_url} /></div>
                ) : (
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{(t.payload as { content: string }).content}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button onClick={() => handleSend(t)} disabled={sendingId === t.id} className="btn btn-primary flex-1 py-1.5 text-xs">
                  {sendingId === t.id ? <Spinner /> : <Send className="w-3.5 h-3.5" />} Send
                </button>
                <button onClick={() => openEditor(t)} className="btn btn-ghost py-1.5 px-2.5 text-xs"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteTarget(t)} className="btn btn-danger py-1.5 px-2.5 text-xs"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showEditor} onClose={() => setShowEditor(false)} title={editTarget ? 'Edit Template' : 'New Template'} maxWidth="max-w-2xl">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Template Name</label>
              <input className="input" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="My Template" autoFocus />
            </div>
            <div>
              <label className="label">Type</label>
              <div className="flex gap-2">
                <button onClick={() => setTKind('embed')} className={`btn flex-1 py-1.5 text-xs ${tKind === 'embed' ? 'btn-primary' : 'btn-ghost'}`}><Blocks className="w-3.5 h-3.5" /> Embed</button>
                <button onClick={() => setTKind('message')} className={`btn flex-1 py-1.5 text-xs ${tKind === 'message' ? 'btn-primary' : 'btn-ghost'}`}><MessageSquare className="w-3.5 h-3.5" /> Message</button>
              </div>
            </div>
          </div>
          {tKind === 'embed' ? (
            <>
              <div><label className="label">Title</label><input className="input" value={tEmbed.title} onChange={(e) => setTEmbed({ ...tEmbed, title: e.target.value })} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={tEmbed.description} onChange={(e) => setTEmbed({ ...tEmbed, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Color</label><div className="flex items-center gap-2"><input type="color" value={tEmbed.color} onChange={(e) => setTEmbed({ ...tEmbed, color: e.target.value })} className="w-10 h-9 rounded-md bg-transparent border border-kma-border cursor-pointer" /><input className="input font-mono" value={tEmbed.color} onChange={(e) => setTEmbed({ ...tEmbed, color: e.target.value })} /></div></div>
                <div><label className="label">Footer</label><input className="input" value={tEmbed.footer} onChange={(e) => setTEmbed({ ...tEmbed, footer: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Author</label><input className="input" value={tEmbed.author} onChange={(e) => setTEmbed({ ...tEmbed, author: e.target.value })} /></div>
                <div><label className="label">Thumbnail URL</label><input className="input" value={tEmbed.thumbnail} onChange={(e) => setTEmbed({ ...tEmbed, thumbnail: e.target.value })} /></div>
              </div>
              <div><label className="label">Image URL</label><input className="input" value={tEmbed.image} onChange={(e) => setTEmbed({ ...tEmbed, image: e.target.value })} /></div>
            </>
          ) : (
            <div><label className="label">Message Content</label><textarea className="input" rows={5} value={tMessage} onChange={(e) => setTMessage(e.target.value)} placeholder="Message text..." /></div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowEditor(false)} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">{saving ? <Spinner /> : <Plus className="w-4 h-4" />} {editTarget ? 'Save Changes' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Template">
        <p className="text-sm text-zinc-300 mb-1">Delete template "{deleteTarget?.name}"?</p>
        <p className="text-sm text-zinc-600 mb-5">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} className="btn btn-danger flex-1"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </Modal>
    </div>
  );
}
