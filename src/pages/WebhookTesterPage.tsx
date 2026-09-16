import { useState } from 'react';
import { useApp } from '@/lib/context';
import { testWebhook } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { NoActiveWebhook } from '@/components/NoActiveWebhook';
import { Spinner } from '@/components/Loading';
import { Zap, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export function WebhookTesterPage() {
  const { activeWebhook, toast, refreshWebhooks } = useApp();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ reachable: boolean; status: number; latency_ms: number } | null>(null);

  const handleTest = async () => {
    if (!activeWebhook) return;
    setTesting(true); setResult(null);
    try {
      const res = await testWebhook({ webhookId: activeWebhook.id });
      if (res.reachable !== undefined) {
        setResult({ reachable: res.reachable, status: res.status, latency_ms: res.latency_ms ?? 0 });
        if (res.reachable) toast('success', 'Webhook is reachable');
        else toast('error', `Webhook returned HTTP ${res.status}`);
      } else { toast('error', res.error || 'Test failed'); }
      refreshWebhooks();
    } catch { toast('error', 'Network error'); } finally { setTesting(false); }
  };

  if (!activeWebhook) return <NoActiveWebhook />;

  const statusColor = result ? (result.reachable ? 'text-accent-bright' : result.status >= 500 ? 'text-red-400' : 'text-amber-400') : 'text-zinc-500';
  const StatusIcon = result ? (result.reachable ? CheckCircle2 : result.status >= 500 ? XCircle : AlertTriangle) : Zap;

  return (
    <div>
      <PageHeader
        title="Webhook Tester"
        subtitle="Test connectivity and measure latency"
        actions={
          <button onClick={handleTest} disabled={testing} className="btn btn-primary">
            {testing ? <Spinner /> : <Zap className="w-4 h-4" />} {testing ? 'Testing...' : 'Test Webhook'}
          </button>
        }
      />

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="panel p-5 animate-fade-in">
          <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold mb-2">Target</div>
          <div className="text-base font-semibold text-zinc-100">{activeWebhook.name}</div>
          <div className="text-xs text-zinc-500 font-mono mt-1 break-all">{activeWebhook.url_masked}</div>
        </div>

        <div className="panel p-5 animate-fade-in">
          <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold mb-2">Current Status</div>
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-5 h-5 ${statusColor}`} />
            <span className={`text-base font-semibold capitalize ${statusColor}`}>
              {result ? (result.reachable ? 'Operational' : result.status >= 500 ? 'Error' : 'Warning') : activeWebhook.status}
            </span>
          </div>
          <div className="text-xs text-zinc-600 mt-1">
            {result ? 'Last tested just now' : activeWebhook.last_tested_at ? `Last tested ${new Date(activeWebhook.last_tested_at).toLocaleString()}` : 'Not tested yet'}
          </div>
        </div>
      </div>

      {result && (
        <div className="panel p-5 animate-slide-up">
          <h3 className="text-[13px] font-semibold text-zinc-200 uppercase tracking-wider mb-4">Test Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-4">
              <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Reachable</div>
              <div className="flex items-center gap-2 mt-1.5">
                {result.reachable ? <CheckCircle2 className="w-5 h-5 text-accent-bright" /> : <XCircle className="w-5 h-5 text-red-400" />}
                <span className={`text-lg font-bold ${result.reachable ? 'text-accent-bright' : 'text-red-400'}`}>{result.reachable ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-4">
              <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">HTTP Status</div>
              <div className="text-lg font-bold text-zinc-100 mt-1.5 font-mono">{result.status}</div>
            </div>
            <div className="rounded-md bg-kma-base border border-kma-border-subtle p-4 col-span-2 md:col-span-1">
              <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Latency</div>
              <div className="flex items-center gap-2 mt-1.5">
                <Clock className="w-4 h-4 text-accent-bright" />
                <span className="text-lg font-bold text-accent-bright font-mono">{result.latency_ms}ms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!result && !testing && (
        <div className="panel p-8 text-center animate-fade-in">
          <Zap className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-sm text-zinc-600">Click "Test Webhook" to check connectivity and measure latency.</p>
        </div>
      )}
    </div>
  );
}
