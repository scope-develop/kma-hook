import { useApp } from '@/lib/context';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <div key={t.id} className="panel-elevated px-3.5 py-3 flex items-start gap-2.5 animate-slide-up shadow-lg">
          <div className="mt-0.5 shrink-0">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-accent-bright" />}
            {t.type === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-accent-bright" />}
          </div>
          <p className="text-[13px] text-zinc-200 flex-1 leading-snug">{t.message}</p>
          <button onClick={() => dismissToast(t.id)} className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
