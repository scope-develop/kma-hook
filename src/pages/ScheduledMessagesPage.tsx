import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { processScheduled } from '@/lib/api';
import type { ScheduledMessage } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Loading';
import { Calendar, Clock, Repeat, Trash2, Play, Plus, X } from 'lucide-react';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `in ${days}d ${hours % 24}h`;
}

export function ScheduledMessagesPage() {
  const { webhooks, toast, bumpHistory } = useApp();
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [form, setForm] = useState({
    webhookId: '',
    kind: 'message' as 'message' | 'embed',
    content: '',
    scheduledFor: '',
    recurrence: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
  embedTitle: '',
    embedDescription: '',
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_scheduled_messages');
    if (!error && data) setScheduled(data as ScheduledMessage[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = async () => {
    if (!form.webhookId) { toast('error', 'Select a webhook'); return; }
    if (!form.scheduledFor) { toast('error', 'Pick a date and time'); return; }
    if (form.kind === 'message' && !form.content.trim()) { toast('error', 'Message cannot be empty'); return; }
    if (form.kind === 'embed' && !form.embedTitle.trim() && !form.embedDescription.trim()) { toast('error', 'Embed needs a title or description'); return; }

    const payload = form.kind === 'message'
      ? { content: form.content }
      : { title: form.embedTitle, description: form.embedDescription, color: '#10B981', author: '', footer: '', image: '', thumbnail: '', fields: [] };

    const { data, error } = await supabase.rpc('create_scheduled_message', {
      p_webhook_id: form.webhookId,
      p_kind: form.kind,
      p_payload: payload,
      p_scheduled_for: new Date(form.scheduledFor).toISOString(),
      p_recurrence: form.recurrence,
    });

    if (error) { toast('error', 'Failed to schedule message'); return; }
    toast('success', 'Message scheduled');
    setShowCreate(false);
    setForm({ webhookId: '', kind: 'message', content: '', scheduledFor: '', recurrence: 'none', embedTitle: '', embedDescription: '' });
    refresh();
    bumpHistory();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.rpc('cancel_scheduled_message', { p_id: id });
    if (error) { toast('error', 'Failed to cancel'); return; }
    toast('success', 'Scheduled message cancelled');
    refresh();
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await processScheduled();
      if (res.ok) {
        toast('success', `Processed ${res.processed ?? 0} message(s)`);
        refresh();
        bumpHistory();
      } else {
        toast('error', res.message || res.error || 'Processing failed');
      }
    } catch { toast('error', 'Network error'); } finally { setProcessing(false); }
  };

  const statusColor: Record<string, string> = {
    pending: 'tag-accent',
    sent: 'tag-success',
    failed: 'tag-error',
    cancelled: 'tag-neutral',
  };

  const recurrenceIcon: Record<string, string> = {
    none: 'Once',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };

  return (
    <div>
      <PageHeader
        title="Scheduled Messages"
        subtitle="Queue messages and embeds for future delivery"
        actions={
          <>
            <button onClick={handleProcess} disabled={processing} className="btn btn-ghost">
              {processing ? <Spinner /> : <Play className="w-4 h-4" />}
              Process Due
            </button>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> Schedule
            </button>
          </>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner className="w-5 h-5" /></div>
      ) : scheduled.length === 0 ? (
        <div className="panel p-10 flex flex-col items-center text-center animate-fade-in">
          <div className="w-10 h-10 rounded-md bg-kma-elevated border border-kma-border flex items-center justify-center mb-4">
            <Calendar className="w-5 h-5 text-zinc-500" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200 mb-1">No scheduled messages</h3>
          <p className="text-sm text-zinc-600 max-w-sm mb-5">Schedule a message or embed to be sent automatically at a future date and time.</p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">Schedule a Message</button>
        </div>
      ) : (
        <div className="space-y-2 animate-fade-in">
          {scheduled.map((msg) => (
            <div key={msg.id} className="panel p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-md bg-kma-elevated border border-kma-border flex items-center justify-center shrink-0">
                {msg.kind === 'embed' ? <Calendar className="w-4 h-4 text-accent-bright" /> : <Clock className="w-4 h-4 text-accent-bright" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-zinc-200 truncate">{msg.webhook_name}</span>
                  <span className={`tag ${statusColor[msg.status]}`}>{msg.status}</span>
                  {msg.recurrence !== 'none' && (
                    <span className="tag tag-neutral"><Repeat className="w-2.5 h-2.5" />{recurrenceIcon[msg.recurrence]}</span>
                  )}
                </div>
                <div className="text-2xs text-zinc-600">
                  {msg.kind === 'message'
                    ? String((msg.payload as Record<string, unknown>).content || '').slice(0, 80)
                    : String((msg.payload as Record<string, unknown>).title || 'Embed')}
                  {' — '}
                  {formatDateTime(msg.scheduled_for)} ({relativeTime(msg.scheduled_for)})
                </div>
              </div>
              {msg.status === 'pending' && (
                <button onClick={() => handleCancel(msg.id)} className="btn btn-danger py-1 px-2.5 text-xs shrink-0">
                  <Trash2 className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative panel w-full max-w-lg p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-zinc-100">Schedule a Message</h3>
              <button onClick={() => setShowCreate(false)} className="text-zinc-600 hover:text-zinc-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Webhook</label>
                <select className="input" value={form.webhookId} onChange={(e) => setForm({ ...form, webhookId: e.target.value })}>
                  <option value="">Select a webhook...</option>
                  {webhooks.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <div className="flex gap-2">
                  <button onClick={() => setForm({ ...form, kind: 'message' })} className={`btn flex-1 ${form.kind === 'message' ? 'btn-primary' : 'btn-ghost'}`}>Message</button>
                  <button onClick={() => setForm({ ...form, kind: 'embed' })} className={`btn flex-1 ${form.kind === 'embed' ? 'btn-primary' : 'btn-ghost'}`}>Embed</button>
                </div>
              </div>
              {form.kind === 'message' ? (
                <div>
                  <label className="label">Message Content</label>
                  <textarea className="input" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Type your message... Use {{date}} for dynamic content" />
                </div>
              ) : (
                <>
                  <div>
                    <label className="label">Embed Title</label>
                    <input className="input" value={form.embedTitle} onChange={(e) => setForm({ ...form, embedTitle: e.target.value })} placeholder="Embed title" />
                  </div>
                  <div>
                    <label className="label">Embed Description</label>
                    <textarea className="input" rows={3} value={form.embedDescription} onChange={(e) => setForm({ ...form, embedDescription: e.target.value })} placeholder="Embed description" />
                  </div>
                </>
              )}
              <div>
                <label className="label">Send At</label>
                <input type="datetime-local" className="input" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
              </div>
              <div>
                <label className="label">Recurrence</label>
                <select className="input" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as 'none' | 'daily' | 'weekly' | 'monthly' })}>
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleCreate} className="btn btn-primary flex-1"><Calendar className="w-4 h-4" /> Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
