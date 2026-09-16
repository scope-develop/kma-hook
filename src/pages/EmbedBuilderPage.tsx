import { useRef, useState } from 'react';
import { useApp } from '@/lib/context';
import { sendEmbed } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { EmbedField, EmbedPayload } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { NoActiveWebhook } from '@/components/NoActiveWebhook';
import { EmbedPreview } from '@/components/EmbedPreview';
import { VariableHelper } from '@/components/VariableHelper';
import { Spinner } from '@/components/Loading';
import { ThemePicker } from '@/components/ThemePicker';
import { WebhookSelector } from '@/components/WebhookSelector';
import { ImageUpload } from '@/components/ImageUpload';
import { RotateCcw, Save, Send, Plus, Trash2 } from 'lucide-react';

const DEFAULT_EMBED: EmbedPayload = {
  title: '', description: '', color: '#10B981', author: '', footer: '', image: '', thumbnail: '', fields: [],
};

const PRESET_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#F97316'];

export function EmbedBuilderPage() {
  const { webhooks, activeWebhook, settings, toast, refreshStats, bumpHistory } = useApp();
  const [selectedWebhookId, setSelectedWebhookId] = useState(activeWebhook?.id ?? webhooks[0]?.id ?? '');
  const [embed, setEmbed] = useState<EmbedPayload>({ ...DEFAULT_EMBED });
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: Partial<EmbedPayload>) => setEmbed((e) => ({ ...e, ...patch }));

  const addField = () => {
    const field: EmbedField = { name: '', value: '', inline: false };
    update({ fields: [...embed.fields, field] });
  };

  const updateField = (i: number, patch: Partial<EmbedField>) => {
    const fields = [...embed.fields];
    fields[i] = { ...fields[i], ...patch };
    update({ fields });
  };

  const removeField = (i: number) => update({ fields: embed.fields.filter((_, idx) => idx !== i) });

  const insertVariableDesc = (variable: string) => {
    const el = descRef.current;
    if (!el) { update({ description: embed.description + variable }); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = embed.description.slice(0, start) + variable + embed.description.slice(end);
    update({ description: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + variable.length, start + variable.length); });
  };

  const handleSend = async () => {
    const webhookId = selectedWebhookId || activeWebhook?.id;
    if (!webhookId) { toast('error', 'No webhook selected'); return; }
    if (!embed.title && !embed.description) { toast('error', 'Embed needs a title or description'); return; }
    setSending(true);
    try {
      const res = await sendEmbed({ webhookId, embed, username: settings?.bot_name || undefined, avatarUrl: settings?.avatar_url || undefined });
      if (res.ok) { toast('success', 'Embed sent'); refreshStats(); bumpHistory(); }
      else { toast('error', res.message || res.error || 'Failed to send'); refreshStats(); bumpHistory(); }
    } catch { toast('error', 'Network error'); } finally { setSending(false); }
  };

  const handleSave = async () => {
    if (!templateName.trim()) { toast('error', 'Template name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('templates').insert({ name: templateName, kind: 'embed', payload: embed });
      if (error) throw error;
      toast('success', `Template "${templateName}" saved`);
      setTemplateName(''); setShowSave(false);
    } catch { toast('error', 'Failed to save template'); } finally { setSaving(false); }
  };

  if (webhooks.length === 0) return <NoActiveWebhook />;

  return (
    <div>
      <PageHeader
        title="Embed Builder"
        subtitle="Rich Discord embeds with live preview"
        actions={
          <>
            <button onClick={() => setEmbed({ ...DEFAULT_EMBED })} className="btn btn-ghost"><RotateCcw className="w-4 h-4" /> Reset</button>
            <button onClick={() => setShowSave(true)} className="btn btn-ghost"><Save className="w-4 h-4" /> Save</button>
            <button onClick={handleSend} disabled={sending} className="btn btn-primary">
              {sending ? <Spinner /> : <Send className="w-4 h-4" />} {sending ? 'Sending...' : 'Send'}
            </button>
          </>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="panel p-5 animate-fade-in space-y-4">
          <WebhookSelector value={selectedWebhookId} onChange={setSelectedWebhookId} />
          <div>
            <label className="label">Title</label>
            <input className="input" value={embed.title} onChange={(e) => update({ title: e.target.value })} placeholder="Embed title" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0">Description</label>
              <VariableHelper onInsert={insertVariableDesc} />
            </div>
            <textarea ref={descRef} className="input" rows={4} value={embed.description} onChange={(e) => update({ description: e.target.value })} placeholder="Embed description. Use {{date}} or {{greeting}} for dynamic content" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0">Accent Color</label>
              <ThemePicker embed={embed} onApply={(p) => setEmbed(p)} />
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={embed.color} onChange={(e) => update({ color: e.target.value })} className="w-11 h-10 rounded-md bg-transparent border border-kma-border cursor-pointer" />
              <input className="input flex-1 min-w-[120px] font-mono" value={embed.color} onChange={(e) => update({ color: e.target.value })} placeholder="#10B981" />
            </div>
            <div className="flex gap-1.5 mt-2">
              {PRESET_COLORS.map((c) => (
                <button key={c} onClick={() => update({ color: c })} className="w-6 h-6 rounded-md border border-kma-border hover:scale-110 transition-transform" style={{ background: c }} title={c} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Author</label>
              <input className="input" value={embed.author} onChange={(e) => update({ author: e.target.value })} placeholder="Author name" />
            </div>
            <div>
              <label className="label">Footer</label>
              <input className="input" value={embed.footer} onChange={(e) => update({ footer: e.target.value })} placeholder="Footer text" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ImageUpload label="Image" value={embed.image} onChange={(url) => update({ image: url })} />
            <ImageUpload label="Thumbnail" value={embed.thumbnail} onChange={(url) => update({ thumbnail: url })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Fields</label>
              <button onClick={addField} className="btn btn-ghost py-1 px-2.5 text-xs"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            <div className="space-y-2">
              {embed.fields.length === 0 && <p className="text-xs text-zinc-600 py-2">No fields. Click "Add" to include structured data.</p>}
              {embed.fields.map((f, i) => (
                <div key={i} className="rounded-md bg-kma-base border border-kma-border-subtle p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-mono text-zinc-600">#{i + 1}</span>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer ml-auto">
                      <input type="checkbox" checked={f.inline} onChange={(e) => updateField(i, { inline: e.target.checked })} className="accent-accent" />
                      Inline
                    </label>
                    <button onClick={() => removeField(i)} className="text-red-400/70 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <input className="input text-sm" value={f.name} onChange={(e) => updateField(i, { name: e.target.value })} placeholder="Field name" />
                  <textarea className="input text-sm" rows={2} value={f.value} onChange={(e) => updateField(i, { value: e.target.value })} placeholder="Field value" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel p-5 animate-fade-in lg:sticky lg:top-20 self-start">
          <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-3">Live Preview</h3>
          <div className="bg-[#313338] rounded-lg p-4">
            <EmbedPreview embed={embed} botName={settings?.bot_name} avatarUrl={settings?.avatar_url} />
          </div>
        </div>
      </div>

      {showSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSave(false)} />
          <div className="relative panel w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-base font-semibold text-zinc-100 mb-4">Save as Template</h3>
            <label className="label">Template Name</label>
            <input className="input" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="My Embed Template" autoFocus />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowSave(false)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">{saving ? <Spinner /> : <Save className="w-4 h-4" />} Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
