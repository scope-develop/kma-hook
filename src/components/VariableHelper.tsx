import { useState } from 'react';
import { AVAILABLE_VARIABLES } from '@/lib/api';
import { ChevronDown, Variable } from 'lucide-react';

export function VariableHelper({ onInsert }: { onInsert: (variable: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost py-1 px-2.5 text-xs"
      >
        <Variable className="w-3.5 h-3.5" />
        Variables
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-80 max-h-64 overflow-y-auto panel-elevated rounded-lg p-2 shadow-xl">
            <div className="px-2 py-1.5 text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
              Click to insert into your message
            </div>
            {AVAILABLE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => {
                  onInsert(`{{${v.key}}}`);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-kma-elevated transition-colors text-left"
              >
                <code className="text-xs font-mono text-accent-bright shrink-0">{v.example}</code>
                <span className="text-2xs text-zinc-500 truncate">{v.description}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
