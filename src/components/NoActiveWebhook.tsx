import { useApp } from '@/lib/context';
import { Webhook as WebhookIcon } from 'lucide-react';

export function NoActiveWebhook({ message }: { message?: string }) {
  const { setPage } = useApp();
  return (
    <div className="panel p-10 flex flex-col items-center text-center animate-fade-in">
      <div className="w-10 h-10 rounded-md bg-kma-elevated border border-kma-border flex items-center justify-center mb-4">
        <WebhookIcon className="w-5 h-5 text-zinc-500" />
      </div>
      <h3 className="text-base font-semibold text-zinc-200 mb-1">No active webhook</h3>
      <p className="text-sm text-zinc-600 max-w-sm mb-5">{message ?? 'You need an active webhook to send messages. Add one in the Webhook Manager.'}</p>
      <button onClick={() => setPage('manager')} className="btn btn-primary">Go to Webhook Manager</button>
    </div>
  );
}
