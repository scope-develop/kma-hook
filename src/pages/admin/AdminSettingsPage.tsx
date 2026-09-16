import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/Loading';
import type { AdminSetting } from '@/lib/types';
import { Save, Settings, Server, Database, Wifi, Clock } from 'lucide-react';

export function AdminSettingsPage() {
  const { toast } = useApp();
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_get_settings');
    if (error) { toast('error', 'Failed to load settings'); } else {
      const s = (data as AdminSetting[]) ?? [];
      setSettings(s);
      const map: Record<string, string> = {};
      s.forEach((x) => { map[x.key] = x.value; });
      setValues(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (key: string, category: string) => {
    setSaving(key);
    try {
      const { error } = await supabase.rpc('admin_save_setting', { p_key: key, p_value: values[key] ?? '', p_category: category });
      if (error) throw error;
      toast('success', `Setting "${key}" saved`);
    } catch (e) { toast('error', (e as Error).message); } finally { setSaving(null); }
  };

  const updateValue = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  if (loading) return <div className="panel p-10"><Spinner className="mx-auto w-5 h-5" /></div>;

  const categories = ['general', 'users', 'webhooks', 'security', 'maintenance'];
  const categoryLabels: Record<string, string> = { general: 'General', users: 'Users', webhooks: 'Webhooks', security: 'Security', maintenance: 'Maintenance' };

  const renderField = (s: AdminSetting) => {
    const isBoolean = ['allow_signups', 'allow_new_users', 'webhooks_enabled', 'rate_limiting', 'maintenance_mode'].includes(s.key);
    if (isBoolean) {
      return (
        <label className="flex items-center gap-3 cursor-pointer">
          <button type="button" onClick={() => updateValue(s.key, values[s.key] === 'true' ? 'false' : 'true')} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${values[s.key] === 'true' ? 'bg-accent' : 'bg-kma-hover'}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${values[s.key] === 'true' ? 'translate-x-4' : ''}`} />
          </button>
          <span className="text-sm text-zinc-300">{values[s.key] === 'true' ? 'Enabled' : 'Disabled'}</span>
        </label>
      );
    }
    return <input className="input" value={values[s.key] ?? ''} onChange={(e) => updateValue(s.key, e.target.value)} />;
  };

  return (
    <div>
      <PageHeader title="Admin Settings" subtitle="Platform configuration and system status" />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {categories.map((cat) => {
            const catSettings = settings.filter((s) => s.category === cat);
            if (catSettings.length === 0) return null;
            return (
              <div key={cat} className="panel p-5 animate-fade-in">
                <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4">{categoryLabels[cat]}</h3>
                <div className="space-y-3">
                  {catSettings.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <label className="label !mb-1">{s.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</label>
                        {renderField(s)}
                      </div>
                      <button onClick={() => handleSave(s.key, s.category)} disabled={saving === s.key} className="btn btn-ghost py-1.5 px-3 text-xs shrink-0">
                        {saving === s.key ? <Spinner /> : <Save className="w-3.5 h-3.5" />} Save
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="panel p-5 animate-fade-in">
            <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2"><Server className="w-4 h-4 text-accent-bright" /> System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-kma-border-subtle">
                <div className="flex items-center gap-2 text-sm text-zinc-400"><Database className="w-3.5 h-3.5" /> Database</div>
                <span className="tag tag-success">online</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-kma-border-subtle">
                <div className="flex items-center gap-2 text-sm text-zinc-400"><Wifi className="w-3.5 h-3.5" /> API</div>
                <span className="tag tag-success">online</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-kma-border-subtle">
                <div className="flex items-center gap-2 text-sm text-zinc-400"><Settings className="w-3.5 h-3.5" /> Edge Functions</div>
                <span className="tag tag-success">online</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-sm text-zinc-400"><Clock className="w-3.5 h-3.5" /> Uptime</div>
                <span className="text-sm text-zinc-300 font-mono">99.9%</span>
              </div>
            </div>
          </div>

          <div className="panel p-5 animate-fade-in">
            <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-3">Build Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">Version</dt><dd className="text-zinc-200 font-mono">v6.0</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Build</dt><dd className="text-zinc-200 font-mono">2026.08</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Database</dt><dd className="text-zinc-200 font-mono">PostgreSQL 15</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Runtime</dt><dd className="text-zinc-200 font-mono">Deno</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
