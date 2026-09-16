import { useApp } from '@/lib/context';
import { Webhook } from 'lucide-react';

interface WebhookSelectorProps {
  value: string;
  onChange: (id: string) => void;
}

export function WebhookSelector({ value, onChange }: WebhookSelectorProps) {
  const { webhooks } = useApp();

  if (webhooks.length === 0) return null;

  return (
    <div>
      <label className="label">Webhook</label>
      <div className="relative">
        <Webhook className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          className="input pl-9 appearance-none cursor-pointer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {webhooks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}{w.is_active ? ' (active)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
