import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Loading';
import type { AdminTemplate, EmbedPayload } from '@/lib/types';
import { Plus, Trash2, Pencil, Blocks, MessageSquare, Globe, Lock, Star } from 'lucide-react';

export function AdminTemplatesPage() {
  const { toast } = useApp();
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTemplate | null>(null);
  const [acting, setActing] = useState(false);

  const [tName, setTName] = useState('');
  const [tKind, setTKind] = useState<'message' | 'embed'>('embed');
  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tColor, setTColor] = useState('#10B981');
  const [tContent, setTContent] = useState('');
  const [tActive, setTActive] = useState(true);
  const [tDefault, setTDefault] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_get_all_templates');
    if (error) { toast('error', 'Failed to load templates'); } else { setTemplates((data as AdminTemplate[]) ?? []); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEditor = (t?: AdminTemplate) => {
    if (t) {
      setEditTarget(t); setTName(t.name); setTKind(t.kind); setTActive(t.is_active); setTDefault(t.is_default);
      if (t.kind === 'embed') {
        const p = t.payload as unknown as EmbedPayload;
        setTTitle(p.title || ''); setTDesc(p.description || ''); setTColor(p.color || '#10B981');
      } else {
        const p = t.payload as unknown as { content: string };
        setTContent(p.content || '');
      }
    } else {
      setEditTarget(null); setTName(''); setTKind('embed'); setTTitle(''); setTDesc(''); setTColor('#10B981'); setTContent(''); setTActive(true); setTDefault(false);
    }
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!tName.trim()) { toast('error', 'Name is required'); return; }
    setActing(true);
    const payload = tKind === 'embed'
      ? { title: tTitle, description: tDesc, color: tColor, author: '', footer: '', image: '', thumbnail: '', fields: [] }
      : { content: tContent };

    try {
      if (editTarget) {
        const { error } = await supabase.rpc('admin_update_template', {
          p_id: editTarget.id, p_name: tName, p_kind: tKind, p_payload: payload as unknown as Record<string, never>,
          p_is_active: tActive, p_is_default: tDefault,
        });
        if (error) throw error;
        toast('success', 'Template updated');
      } else {
        const { error } = await supabase.rpc('admin_create_template', { p_name: tName, p_kind: tKind, p_payload: payload as unknown as Record<string, never> });
        if (error) throw error;
        toast('success', 'Global template created');
      }
      setShowEditor(false); load();
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc('admin_delete_template', { p_id: deleteTarget.id });
      if (error) throw error;
      toast('success', 'Template deleted'); setDeleteTarget(null); load();
    } catch (e) { toast('error', (e as Error).message); } finally { setActing(false); }
  };

  return (
    <div>
      <PageHeader title="Template Management" subtitle="All templates across the platform" actions={<button onClick={() => openEditor()} className="btn btn-primary"><Plus className="w-4 h-4" /> New Global</button>} />

      {loading ? (
        <div className="panel p-10"><Spinner className="mx-auto w-5 h-5" /></div>
      ) : templates.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-zinc-600">No templates found.</div>
      ) : (
        <div className="panel overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-kma-border-subtle text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                  <th className="text-left px-4 py-2.5">Name</th>
                  <th className="text-left px-3 py-2.5">Type</th>
                  <th className="text-left px-3 py-2.5">Scope</th>
                  <th className="text-left px-3 py-2.5">Owner</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Created</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-kma-border-subtle last:border-0 hover:bg-kma-elevated/40 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-200 font-medium flex items-center gap-1.5">
                      {t.is_default && <Star className="w-3 h-3 text-amber-400 fill-current" />}
                      {t.name}
                    </td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-1.5">{t.kind === 'embed' ? <Blocks className="w-3.5 h-3.5 text-accent-bright" /> : <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />}<span className="text-zinc-400">{t.kind}</span></div></td>
                    <td className="px-3 py-2.5">{t.is_global ? <span className="tag tag-accent"><Globe className="w-2.5 h-2.5" /> global</span> : <span className="tag tag-neutral"><Lock className="w-2.5 h-2.5" /> private</span>}</td>
                    <td className="px-3 py-2.5 text-zinc-400 truncate max-w-[160px]">{t.owner_email}</td>
                    <td className="px-3 py-2.5">{t.is_active ? <span className="tag tag-success">active</span> : <span className="tag tag-neutral">inactive</span>}</td>
                    <td className="px-3 py-2.5 text-zinc-500 font-mono text-2xs whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditor(t)} className="p-1.5 rounded-md text-zinc-500 hover:text-accent-bright hover:bg-kma-elevated transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-kma-elevated transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showEditor} onClose={() => setShowEditor(false)} title={editTarget ? 'Edit Template' : 'New Global Template'} maxWidth="max-w-lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="Template name" autoFocus /></div>
            <div><label className="label">Type</label><div className="flex gap-2"><button onClick={() => setTKind('embed')} className={`btn flex-1 py-1.5 text-xs ${tKind === 'embed' ? 'btn-primary' : 'btn-ghost'}`}><Blocks className="w-3.5 h-3.5" /> Embed</button><button onClick={() => setTKind('message')} className={`btn flex-1 py-1.5 text-xs ${tKind === 'message' ? 'btn-primary' : 'btn-ghost'}`}><MessageSquare className="w-3.5 h-3.5" /> Message</button></div></div>
          </div>
          {tKind === 'embed' ? (
            <>
              <div><label className="label">Title</label><input className="input" value={tTitle} onChange={(e) => setTTitle(e.target.value)} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={tDesc} onChange={(e) => setTDesc(e.target.value)} /></div>
              <div><label className="label">Color</label><div className="flex items-center gap-2"><input type="color" value={tColor} onChange={(e) => setTColor(e.target.value)} className="w-10 h-9 rounded-md bg-transparent border border-kma-border cursor-pointer" /><input className="input font-mono" value={tColor} onChange={(e) => setTColor(e.target.value)} /></div></div>
            </>
          ) : (
            <div><label className="label">Message Content</label><textarea className="input" rows={4} value={tContent} onChange={(e) => setTContent(e.target.value)} /></div>
          )}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"><input type="checkbox" checked={tActive} onChange={(e) => setTActive(e.target.checked)} className="accent-accent" /> Active</label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"><input type="checkbox" checked={tDefault} onChange={(e) => setTDefault(e.target.checked)} className="accent-accent" /> Default</label>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowEditor(false)} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleSave} disabled={acting} className="btn btn-primary flex-1">{acting ? <Spinner /> : <Plus className="w-4 h-4" />} {editTarget ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Template">
        <p className="text-sm text-zinc-300 mb-5">Delete template <span className="font-semibold text-zinc-100">{deleteTarget?.name}</span>? This cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={acting} className="btn btn-danger flex-1">{acting ? <Spinner /> : <Trash2 className="w-4 h-4" />} Delete</button>
        </div>
      </Modal>
    </div>
  );
}
