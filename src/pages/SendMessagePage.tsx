import { useRef, useState } from 'react';
import { useApp } from '@/lib/context';
import { sendMessage } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { NoActiveWebhook } from '@/components/NoActiveWebhook';
import { VariableHelper } from '@/components/VariableHelper';
import { WebhookSelector } from '@/components/WebhookSelector';
import { ImageUpload } from '@/components/ImageUpload';
import { Spinner } from '@/components/Loading';
import { Send } from 'lucide-react';

export function SendMessagePage() {
  const { webhooks, activeWebhook, settings, toast, refreshStats, bumpHistory } = useApp();
  const [selectedWebhookId, setSelectedWebhookId] = useState(activeWebhook?.id ?? webhooks[0]?.id ?? '');
  const [botName, setBotName] = useState(settings?.bot_name ?? 'KMA Bot');
  const [content, setContent] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(settings?.avatar_url ?? '');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (!el) { setContent((c) => c + variable); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setContent((c) => c.slice(0, start) + variable + c.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + variable.length, start + variable.length); });
  };

  const handleSend = async () => {
    const webhookId = selectedWebhookId || activeWebhook?.id;
    if (!webhookId) { toast('error', 'No webhook selected'); return; }
    if (!content.trim()) { toast('error', 'Message cannot be empty'); return; }
    setSending(true);
    try {
      const res = await sendMessage({
        webhookId,
        content,
        username: botName || undefined,
        avatarUrl: avatarUrl || undefined,
      });
      if (res.ok) { toast('success', 'Message sent'); setContent(''); refreshStats(); bumpHistory(); }
      else { toast('error', res.message || res.error || 'Failed to send'); refreshStats(); bumpHistory(); }
    } catch { toast('error', 'Network error'); } finally { setSending(false); }
  };

  if (webhooks.length === 0) return <NoActiveWebhook />;

  return (
    <div>
      <PageHeader
        title="Send Message"
        subtitle="Plain text message to any webhook"
        actions={
          <button onClick={handleSend} disabled={sending || !content.trim()} className="btn btn-primary">
            {sending ? <Spinner /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending...' : 'Send'}
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="panel p-5 animate-fade-in">
          <div className="space-y-4">
            <WebhookSelector value={selectedWebhookId} onChange={setSelectedWebhookId} />
            <div>
              <label className="label">Bot Name</label>
              <input className="input" value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="KMA Bot" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0">Message</label>
                <VariableHelper onInsert={insertVariable} />
              </div>
              <textarea ref={textareaRef} className="input" rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type your message... Use {{date}} for today's date" />
              <div className="text-2xs text-zinc-600 mt-1 font-mono">{content.length} chars</div>
            </div>
            <ImageUpload label="Avatar URL (optional)" value={avatarUrl} onChange={setAvatarUrl} />
          </div>
        </div>

        <div className="panel p-5 animate-fade-in">
          <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-3">Preview</h3>
          <div className="bg-[#313338] rounded-lg p-4 min-h-[300px]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-kma-hover shrink-0 overflow-hidden flex items-center justify-center text-white font-semibold text-sm">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  (botName || 'K').charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[15px] font-semibold text-zinc-100">{botName || 'KMA Bot'}</span>
                  <span className="text-2xs bg-zinc-600 text-zinc-300 px-1.5 py-0.5 rounded font-mono">APP</span>
                  <span className="text-xs text-zinc-500">Today</span>
                </div>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                  {content || <span className="text-zinc-600 italic">Message preview appears here...</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
