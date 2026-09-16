import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { broadcastMessage } from '@/lib/api';
import type { BroadcastLog, EmbedField, EmbedPayload } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { VariableHelper } from '@/components/VariableHelper';
import { Spinner } from '@/components/Loading';
import { Radio, Check, Send, History as HistoryIcon } from 'lucide-react';

const DEFAULT_EMBED: EmbedPayload = {
  title: '', description: '', color: '#10B981', author: '', footer: '', image: '', thumbnail: '', fields: [],
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

export function BroadcastPage() {
  const { webhooks, settings, toast, refreshStats, bumpHistory } = useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [kind, setKind] = useState<'message' | 'embed'>('message');
  const [content, setContent] = useState('');
  const [embed, setEmbed] = useState<EmbedPayload>({ ...DEFAULT_EMBED });
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<BroadcastLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const refreshLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase.rpc('get_broadcast_logs');
    if (!error && data) setLogs(data as BroadcastLog[]);
    setLoadingLogs(false);
  }, []);

  useEffect(() => { refreshLogs(); }, [refreshLogs]);

  const toggleWebhook = (id: string) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };

  const selectAll = () => setSelectedIds(webhooks.map((w) => w.id));
  const deselectAll = () => setSelectedIds([]);

  const insertVariable = (variable: string) => {
    const el = contentRef.current;
    if (!el) { setContent((c) => c + variable); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setContent((c) => c.slice(0, start) + variable + c.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + variable.length, start + variable.length); });
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) { toast('error', 'Select at least one webhook'); return; }
    if (kind === 'message' && !content.trim()) { toast('error', 'Message cannot be empty'); return; }
    if (kind === 'embed' && !embed.title && !embed.description) { toast('error', 'Embed needs a title or description'); return; }

    setSending(true);
    try {
      const res = await broadcastMessage({
        webhookIds: selectedIds,
        kind,
        content: kind === 'message' ? content : undefined,
        embed: kind === 'embed' ? embed : undefined,
        username: settings?.bot_name || undefined,
        avatarUrl: settings?.avatar_url || undefined,
      });
      if (res.ok || (res.succeeded !== undefined && res.succeeded > 0)) {
        const msg = res.succeeded !== undefined && res.failed !== undefined
          ? `Broadcast: ${res.succeeded} sent, ${res.failed} failed`
          : 'Broadcast sent';
        toast(res.failed ? 'error' : 'success', msg);
        if (kind === 'message') setContent('');
        refreshStats(); bumpHistory(); refreshLogs();
      } else {
        toast('error', res.message || res.error || 'Broadcast failed');
        refreshStats(); bumpHistory();
      }
    } catch { toast('error', 'Network error'); } finally { setSending(false); }
  };

  const updateEmbed = (patch: Partial<EmbedPayload>) => setEmbed((e) => ({ ...e, ...patch }));

  return (
    <div>
      <PageHeader
        title="Broadcast"
        subtitle="Send a single message or embed to multiple webhooks at once"
        actions={
          <>
            <button onClick={() => setShowHistory((v) => !v)} className="btn btn-ghost">
              <HistoryIcon className="w-4 h-4" /> History
            </button>
            <button onClick={handleSend} disabled={sending || selectedIds.length === 0} className="btn btn-primary">
              {sending ? <Spinner /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending...' : `Broadcast to ${selectedIds.length}`}
            </button>
          </>
        }
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        {/* Webhook selector */}
        <div className="panel p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider">Webhooks</h3>
            <div className="flex gap-1.5">
              <button onClick={selectAll} className="text-2xs text-accent-bright hover:underline">All</button>
              <span className="text-zinc-700">|</span>
              <button onClick={deselectAll} className="text-2xs text-zinc-500 hover:underline">None</button>
            </div>
          </div>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {webhooks.length === 0 && <p className="text-xs text-zinc-600 py-3 text-center">No webhooks available</p>}
            {webhooks.map((w) => {
              const selected = selectedIds.includes(w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => toggleWebhook(w.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border ${
                    selected
                      ? 'bg-accent-bg border-accent-border'
                      : 'bg-kma-base border-kma-border-subtle hover:border-kma-border'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-accent border-accent' : 'border-zinc-700'}`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-[13px] font-medium truncate ${selected ? 'text-accent-bright' : 'text-steel-dim'}`}>{w.name}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-kma-border-subtle">
            <div className="text-2xs text-zinc-600">{selectedIds.length} of {webhooks.length} selected</div>
          </div>
        </div>

        {/* Content builder */}
        <div className="panel p-5 animate-fade-in space-y-4">
          <div>
            <label className="label">Type</label>
            <div className="flex gap-2">
              <button onClick={() => setKind('message')} className={`btn flex-1 ${kind === 'message' ? 'btn-primary' : 'btn-ghost'}`}>
                <Radio className="w-4 h-4" /> Message
              </button>
              <button onClick={() => setKind('embed')} className={`btn flex-1 ${kind === 'embed' ? 'btn-primary' : 'btn-ghost'}`}>
                <Radio className="w-4 h-4" /> Embed
              </button>
            </div>
          </div>

          {kind === 'message' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0">Message Content</label>
                <VariableHelper onInsert={insertVariable} />
              </div>
              <textarea ref={contentRef} className="input" rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type your broadcast message... Use {{date}} or {{greeting}} for dynamic content" />
              <div className="text-2xs text-zinc-600 mt-1 font-mono">{content.length} chars</div>
            </div>
          ) : (
            <>
              <div>
                <label className="label">Embed Title</label>
                <input className="input" value={embed.title} onChange={(e) => updateEmbed({ title: e.target.value })} placeholder="Embed title" />
              </div>
              <div>
                <label className="label">Embed Description</label>
                <textarea className="input" rows={4} value={embed.description} onChange={(e) => updateEmbed({ description: e.target.value })} placeholder="Embed description" />
              </div>
              <div>
                <label className="label">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={embed.color} onChange={(e) => updateEmbed({ color: e.target.value })} className="w-11 h-10 rounded-md bg-transparent border border-kma-border cursor-pointer" />
                  <input className="input flex-1 font-mono" value={embed.color} onChange={(e) => updateEmbed({ color: e.target.value })} placeholder="#10B981" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Author</label>
                  <input className="input" value={embed.author} onChange={(e) => updateEmbed({ author: e.target.value })} placeholder="Author name" />
                </div>
                <div>
                  <label className="label">Footer</label>
                  <input className="input" value={embed.footer} onChange={(e) => updateEmbed({ footer: e.target.value })} placeholder="Footer text" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Broadcast history drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-md h-full bg-kma-surface border-l border-kma-border-subtle overflow-y-auto animate-slide-right">
            <div className="flex items-center justify-between h-14 px-5 border-b border-kma-border-subtle sticky top-0 bg-kma-surface z-10">
              <h3 className="text-sm font-semibold text-zinc-200">Broadcast History</h3>
              <button onClick={() => setShowHistory(false)} className="text-zinc-600 hover:text-zinc-300">Close</button>
            </div>
            <div className="p-4 space-y-2">
              {loadingLogs ? (
                <div className="flex justify-center py-8"><Spinner className="w-5 h-5" /></div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-zinc-600 text-center py-8">No broadcasts yet</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="panel p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`tag ${log.failed === 0 ? 'tag-success' : 'tag-error'}`}>
                        {log.succeeded}/{log.total} sent
                      </span>
                      <span className="tag tag-neutral">{log.kind}</span>
                    </div>
                    <div className="text-xs text-zinc-400 truncate mb-0.5">{log.content || 'Embed broadcast'}</div>
                    <div className="text-2xs text-zinc-600">{formatDateTime(log.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
