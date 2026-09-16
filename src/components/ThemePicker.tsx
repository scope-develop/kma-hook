import { useState } from 'react';
import type { EmbedPayload } from '@/lib/types';
import { EMBED_THEME_PRESETS } from '@/lib/embedPresets';
import { Palette, ChevronDown, Check } from 'lucide-react';

interface ThemePickerProps {
  embed: EmbedPayload;
  onApply: (preset: EmbedPayload) => void;
}

export function ThemePicker({ embed, onApply }: ThemePickerProps) {
  const [open, setOpen] = useState(false);

  const activePreset = EMBED_THEME_PRESETS.find((p) => p.color === embed.color);

  const apply = (preset: typeof EMBED_THEME_PRESETS[0]) => {
    onApply({
      ...embed,
      color: preset.color,
      author: preset.author || embed.author,
      footer: preset.footer || embed.footer,
      thumbnail: preset.thumbnail || embed.thumbnail,
      fields: preset.fields.length > 0 ? preset.fields : embed.fields,
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost py-1 px-2.5 text-xs"
      >
        <Palette className="w-3.5 h-3.5" />
        {activePreset ? activePreset.name : 'Themes'}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-72 panel-elevated rounded-lg p-2 shadow-xl">
            <div className="px-2 py-1.5 text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
              Apply a theme preset
            </div>
            {EMBED_THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => apply(preset)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-kma-elevated transition-colors text-left"
              >
                <div
                  className="w-5 h-5 rounded-md shrink-0 border border-kma-border"
                  style={{ background: preset.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-200">{preset.name}</div>
                  <div className="text-2xs text-zinc-600 truncate">{preset.description}</div>
                </div>
                {activePreset?.id === preset.id && <Check className="w-3.5 h-3.5 text-accent-bright shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
