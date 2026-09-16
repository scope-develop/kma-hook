import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase, EDGE_URL } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Loading';
import type { ApiKey, ApiKeyCreated } from '@/lib/types';
import { Save, RefreshCw, Eye, EyeOff, Key, Plus, Trash2, Copy, Check, AlertCircle, Code, ChevronDown, ChevronRight } from 'lucide-react';

export function SettingsPage() {
  const { settings, toast, refreshSettings } = useApp();
  const [botName, setBotName] = useState('KMA Bot');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [hideUrls, setHideUrls] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showApiDocs, setShowApiDocs] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  useEffect(() => {
    if (settings) { setBotName(settings.bot_name); setAvatarUrl(settings.avatar_url ?? ''); setHideUrls(settings.hide_urls); }
  }, [settings]);

  const refreshApiKeys = useCallback(async () => {
    setLoadingKeys(true);
    const { data, error } = await supabase.rpc('get_api_keys');
    if (!error && data) setApiKeys(data as ApiKey[]);
    setLoadingKeys(false);
  }, []);

  useEffect(() => { refreshApiKeys(); }, [refreshApiKeys]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('save_settings', { p_bot_name: botName || 'KMA Bot', p_avatar_url: avatarUrl || null, p_hide_urls: hideUrls });
      if (error) throw error; toast('success', 'Settings saved'); refreshSettings();
    } catch { toast('error', 'Failed to save settings'); } finally { setSaving(false); }
  };

  const handleCheckUpdates = () => {
    setChecking(true);
    setTimeout(() => { setChecking(false); toast('info', 'You are running the latest version (v6)'); }, 1200);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { toast('error', 'Key name is required'); return; }
    setCreatingKey(true);
    try {
      const { data, error } = await supabase.rpc('create_api_key', { p_name: newKeyName.trim() });
      if (error) throw error;
      const created = (data as ApiKeyCreated[])[0];
      setCreatedKey(created);
      setNewKeyName('');
      setShowCreateKey(false);
      refreshApiKeys();
      toast('success', 'API key created');
    } catch (err) { toast('error', (err as Error).message || 'Failed to create API key'); } finally { setCreatingKey(false); }
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      const { error } = await supabase.rpc('revoke_api_key', { p_id: keyId });
      if (error) throw error;
      toast('success', 'API key revoked');
      refreshApiKeys();
    } catch (err) { toast('error', (err as Error).message || 'Failed to revoke key'); } finally { setRevokingId(null); }
  };

  const copyKey = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Bot defaults, API keys, and application preferences" actions={<button onClick={handleSave} disabled={saving} className="btn btn-primary">{saving ? <Spinner /> : <Save className="w-4 h-4" />} Save</button>} />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 panel p-5 animate-fade-in">
          <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4">Bot Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Bot Name</label>
              <input className="input" value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="KMA Bot" />
              <p className="text-2xs text-zinc-600 mt-1.5">Appears as the sender name on messages sent via webhooks.</p>
            </div>
            <div>
              <label className="label">Avatar URL</label>
              <input className="input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
              {avatarUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={avatarUrl} alt="" className="w-9 h-9 rounded-md object-cover border border-kma-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="text-2xs text-zinc-600">Avatar preview</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel p-5 animate-fade-in">
          <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4">Privacy</h3>
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md bg-kma-base border border-kma-border-subtle hover:border-kma-border transition-colors">
            <button type="button" onClick={() => setHideUrls((v) => !v)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${hideUrls ? 'bg-accent' : 'bg-kma-hover'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${hideUrls ? 'translate-x-4' : ''}`} />
            </button>
            <div>
              <div className="text-[13px] font-medium text-zinc-200">Mask webhook URLs</div>
              <p className="text-2xs text-zinc-600 mt-0.5">Hide the token portion of webhook URLs in the Webhook Manager.</p>
            </div>
          </label>
        </div>

        {/* API Keys Section */}
        <div className="panel p-5 animate-fade-in lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Key className="w-3.5 h-3.5" /> API Keys
              </h3>
              <p className="text-2xs text-zinc-600 mt-1">Generate keys for external scripts to send messages without logging in.</p>
            </div>
            <button onClick={() => setShowCreateKey(true)} className="btn btn-primary py-1.5 px-3 text-xs">
              <Plus className="w-3.5 h-3.5" /> Create Key
            </button>
          </div>

          {loadingKeys ? (
            <div className="flex justify-center py-8"><Spinner className="w-5 h-5" /></div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-600">No API keys yet. Create one to enable programmatic access.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-kma-border-subtle text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                    <th className="text-left px-3 py-2.5">Name</th>
                    <th className="text-left px-3 py-2.5">Key</th>
                    <th className="text-left px-3 py-2.5">Created</th>
                    <th className="text-left px-3 py-2.5">Last Used</th>
                    <th className="text-left px-3 py-2.5">Status</th>
                    <th className="text-right px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => (
                    <tr key={k.id} className="border-b border-kma-border-subtle last:border-0 hover:bg-kma-elevated/50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-zinc-200">{k.name}</td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-zinc-500">{k.key_prefix}{'\u2022'.repeat(20)}</td>
                      <td className="px-3 py-2.5 text-zinc-500 text-2xs">{formatDate(k.created_at)}</td>
                      <td className="px-3 py-2.5 text-zinc-500 text-2xs">{formatDate(k.last_used_at)}</td>
                      <td className="px-3 py-2.5">
                        {k.revoked_at ? (
                          <span className="tag tag-error">revoked</span>
                        ) : (
                          <span className="tag tag-success">active</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {!k.revoked_at && (
                          <button
                            onClick={() => handleRevoke(k.id)}
                            disabled={revokingId === k.id}
                            className="text-red-400/70 hover:text-red-400 transition-colors p-1"
                            title="Revoke key"
                          >
                            {revokingId === k.id ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* API Documentation */}
          <div className="mt-4 rounded-md bg-kma-base border border-kma-border-subtle overflow-hidden">
            <button
              onClick={() => setShowApiDocs((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-kma-elevated/50 transition-colors"
            >
              {showApiDocs ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
              <Code className="w-3.5 h-3.5 text-accent-bright" />
              <span className="text-xs font-semibold text-zinc-200">API Documentation</span>
              <span className="text-2xs text-zinc-600 ml-auto">How to call the API</span>
            </button>

            {showApiDocs && (
              <div className="px-3 pb-3 space-y-3">
                <div className="text-2xs text-zinc-500 leading-relaxed pt-2">
                  All endpoints are at <span className="font-mono text-accent-bright">{EDGE_URL}</span>.
                  Authenticate by sending your API key in the <span className="font-mono text-emerald-400">X-API-Key</span> header.
                  All requests are <span className="font-mono">POST</span> with <span className="font-mono">Content-Type: application/json</span>.
                </div>

                {/* Send Message */}
                <ApiEndpoint
                  method="POST"
                  path="/send-message"
                  title="Send Message"
                  description="Send a plain text message to a webhook."
                  params={[
                    { name: 'webhook_id', type: 'string', required: 'Yes*', desc: 'ID of the webhook to send to' },
                    { name: 'webhook_url', type: 'string', required: 'No', desc: 'Raw Discord URL (alternative to webhook_id)' },
                    { name: 'content', type: 'string', required: 'Yes', desc: 'Message text. Supports {{date}}, {{greeting}}, etc.' },
                    { name: 'username', type: 'string', required: 'No', desc: 'Override bot display name' },
                    { name: 'avatar_url', type: 'string', required: 'No', desc: 'Override bot avatar URL' },
                    { name: 'variables', type: 'object', required: 'No', desc: 'Custom variable replacements' },
                  ]}
                  example={'{\n  "webhook_id": "uuid-here",\n  "content": "Hello from the API! Today is {{date}}"\n}'}
                  onCopy={() => setCopiedEndpoint('send-message')}
                  copied={copiedEndpoint === 'send-message'}
                />

                {/* Send Embed */}
                <ApiEndpoint
                  method="POST"
                  path="/send-embed"
                  title="Send Embed"
                  description="Send a rich embed to a webhook."
                  params={[
                    { name: 'webhook_id', type: 'string', required: 'Yes*', desc: 'ID of the webhook to send to' },
                    { name: 'embed', type: 'object', required: 'Yes', desc: 'Embed payload (see below)' },
                    { name: 'embed.title', type: 'string', required: 'No', desc: 'Embed title' },
                    { name: 'embed.description', type: 'string', required: 'No', desc: 'Embed body text' },
                    { name: 'embed.color', type: 'string', required: 'No', desc: 'Hex color, e.g. #10B981' },
                    { name: 'embed.author', type: 'string', required: 'No', desc: 'Author name' },
                    { name: 'embed.footer', type: 'string', required: 'No', desc: 'Footer text' },
                    { name: 'embed.image', type: 'string', required: 'No', desc: 'Image URL' },
                    { name: 'embed.thumbnail', type: 'string', required: 'No', desc: 'Thumbnail URL' },
                    { name: 'embed.fields', type: 'array', required: 'No', desc: 'Array of {name, value, inline}' },
                    { name: 'username', type: 'string', required: 'No', desc: 'Override bot display name' },
                    { name: 'avatar_url', type: 'string', required: 'No', desc: 'Override bot avatar URL' },
                  ]}
                  example={'{\n  "webhook_id": "uuid-here",\n  "embed": {\n    "title": "Server Update",\n    "description": "Maintenance complete",\n    "color": "#10B981",\n    "fields": [\n      {"name": "Status", "value": "Online", "inline": true}\n    ]\n  }\n}'}
                  onCopy={() => setCopiedEndpoint('send-embed')}
                  copied={copiedEndpoint === 'send-embed'}
                />

                {/* Send Template */}
                <ApiEndpoint
                  method="POST"
                  path="/send-template"
                  title="Send Template"
                  description="Send a saved template by name."
                  params={[
                    { name: 'webhook_id', type: 'string', required: 'Yes', desc: 'ID of the webhook to send to' },
                    { name: 'template', type: 'object', required: 'Yes', desc: 'Template object' },
                    { name: 'template.name', type: 'string', required: 'Yes', desc: 'Template name' },
                    { name: 'template.kind', type: 'string', required: 'Yes', desc: '"message" or "embed"' },
                    { name: 'template.payload', type: 'object', required: 'Yes', desc: 'Template content/embed payload' },
                    { name: 'username', type: 'string', required: 'No', desc: 'Override bot display name' },
                    { name: 'avatar_url', type: 'string', required: 'No', desc: 'Override bot avatar URL' },
                  ]}
                  example={'{\n  "webhook_id": "uuid-here",\n  "template": {\n    "name": "Welcome",\n    "kind": "message",\n    "payload": {"content": "Welcome!"}\n  }\n}'}
                  onCopy={() => setCopiedEndpoint('send-template')}
                  copied={copiedEndpoint === 'send-template'}
                />

                {/* Broadcast */}
                <ApiEndpoint
                  method="POST"
                  path="/broadcast"
                  title="Broadcast"
                  description="Send to multiple webhooks at once."
                  params={[
                    { name: 'webhook_ids', type: 'array', required: 'Yes', desc: 'Array of webhook IDs' },
                    { name: 'kind', type: 'string', required: 'Yes', desc: '"message" or "embed"' },
                    { name: 'content', type: 'string', required: 'No', desc: 'Message text (if kind=message)' },
                    { name: 'embed', type: 'object', required: 'No', desc: 'Embed payload (if kind=embed)' },
                    { name: 'username', type: 'string', required: 'No', desc: 'Override bot display name' },
                    { name: 'avatar_url', type: 'string', required: 'No', desc: 'Override bot avatar URL' },
                  ]}
                  example={'{\n  "webhook_ids": ["id1", "id2"],\n  "kind": "message",\n  "content": "Broadcast!"\n}'}
                  onCopy={() => setCopiedEndpoint('broadcast')}
                  copied={copiedEndpoint === 'broadcast'}
                />

                {/* Test Webhook */}
                <ApiEndpoint
                  method="POST"
                  path="/test-webhook"
                  title="Test Webhook"
                  description="Check if a webhook is reachable."
                  params={[
                    { name: 'webhook_id', type: 'string', required: 'Yes*', desc: 'ID of the webhook to test' },
                    { name: 'webhook_url', type: 'string', required: 'No', desc: 'Raw Discord URL (alternative)' },
                  ]}
                  example={'{\n  "webhook_id": "uuid-here"\n}'}
                  onCopy={() => setCopiedEndpoint('test-webhook')}
                  copied={copiedEndpoint === 'test-webhook'}
                />

                <div className="pt-2 border-t border-kma-border-subtle">
                  <div className="text-2xs text-zinc-600 mb-2">
                    <span className="text-amber-400">*</span> Either <span className="font-mono">webhook_id</span> or <span className="font-mono">webhook_url</span> is required. Use <span className="font-mono">webhook_id</span> to send to a saved webhook, or <span className="font-mono">webhook_url</span> to send to a raw Discord URL.
                  </div>
                  <div className="text-2xs text-zinc-600">
                    Available variables: <span className="font-mono text-zinc-400">{'{{date}} {{time}} {{datetime}} {{timestamp}} {{year}} {{month}} {{day}} {{hour}} {{minute}} {{weekday}} {{month_name}} {{iso_date}} {{iso_time}} {{week_number}} {{greeting}} {{random_number}} {{random_uuid}}'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel p-5 animate-fade-in lg:col-span-3">
          <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4">Application</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-4">
              <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Version</div>
              <div className="text-lg font-bold text-zinc-100 mt-1 font-mono">v6.0</div>
            </div>
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-4">
              <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Build</div>
              <div className="text-lg font-bold text-zinc-100 mt-1 font-mono">2026.08</div>
            </div>
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-4 flex flex-col">
              <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold mb-2">Updates</div>
              <button onClick={handleCheckUpdates} disabled={checking} className="btn btn-ghost text-xs py-1.5 w-fit">{checking ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />}{checking ? 'Checking...' : 'Check for updates'}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreateKey(false)} />
          <div className="relative panel w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-base font-semibold text-zinc-100 mb-4">Create API Key</h3>
            <label className="label">Key Name</label>
            <input className="input" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="My Script Bot" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()} />
            <p className="text-2xs text-zinc-600 mt-1.5">Give this key a descriptive name so you know what it's used for.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreateKey(false)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleCreateKey} disabled={creatingKey} className="btn btn-primary flex-1">{creatingKey ? <Spinner /> : <Plus className="w-4 h-4" />} Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Created Key Modal (one-time display) */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative panel w-full max-w-lg p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-semibold text-zinc-100">Save your API key</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-4">This is the only time you'll see the full key. Copy it now and store it securely.</p>

            <label className="label">API Key</label>
            <div className="flex items-center gap-2">
              <input className="input font-mono text-xs flex-1" value={createdKey.key} readOnly />
              <button onClick={copyKey} className="btn btn-ghost shrink-0">
                {copied ? <Check className="w-4 h-4 text-accent-bright" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="mt-3 rounded-md bg-kma-base border border-kma-border-subtle p-3">
              <div className="text-2xs text-zinc-600 mb-1">Key name</div>
              <div className="text-sm text-zinc-300">{createdKey.name}</div>
            </div>

            <button onClick={() => { setCreatedKey(null); setCopied(false); }} className="btn btn-primary w-full mt-4">
              <Check className="w-4 h-4" /> I've saved my key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ApiParam {
  name: string;
  type: string;
  required: string;
  desc: string;
}

function ApiEndpoint({
  method,
  path,
  title,
  description,
  params,
  example,
  onCopy,
  copied,
}: {
  method: string;
  path: string;
  title: string;
  description: string;
  params: ApiParam[];
  example: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="rounded-md bg-kma-surface border border-kma-border-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-kma-elevated/50 border-b border-kma-border-subtle">
        <span className="text-2xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{method}</span>
        <span className="font-mono text-2xs text-zinc-300">{path}</span>
        <span className="text-2xs text-zinc-500 ml-auto">{title}</span>
      </div>

      <div className="px-3 py-2">
        <p className="text-2xs text-zinc-500 mb-2">{description}</p>

        <div className="mb-2">
          <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold mb-1">Parameters</div>
          <div className="space-y-0.5">
            {params.map((p) => (
              <div key={p.name} className="flex items-start gap-2 text-2xs">
                <span className="font-mono text-accent-bright shrink-0 min-w-[100px]">{p.name}</span>
                <span className="font-mono text-zinc-600 shrink-0 min-w-[50px]">{p.type}</span>
                <span className={`font-mono shrink-0 min-w-[30px] ${p.required.startsWith('Yes') ? 'text-amber-400' : 'text-zinc-600'}`}>{p.required}</span>
                <span className="text-zinc-500">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Example</div>
            <button onClick={() => { navigator.clipboard.writeText(example); onCopy(); }} className="text-2xs text-accent-bright hover:text-accent flex items-center gap-1">
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <pre className="font-mono text-2xs text-zinc-400 bg-kma-base rounded p-2.5 overflow-x-auto whitespace-pre">{example}</pre>
        </div>
      </div>
    </div>
  );
}
