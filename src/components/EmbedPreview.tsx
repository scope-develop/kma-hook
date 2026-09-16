import type { EmbedPayload } from '@/lib/types';

interface EmbedPreviewProps {
  embed: EmbedPayload;
  botName?: string;
  avatarUrl?: string | null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = (hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function EmbedPreview({ embed, botName = 'KMA Bot', avatarUrl }: EmbedPreviewProps) {
  const rgb = hexToRgb(embed.color);
  const borderColor = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '#5865f2';

  const fields = (embed.fields || []).filter((f) => f.name || f.value);

  return (
    <div className="font-sans">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-kma-hover shrink-0 overflow-hidden flex items-center justify-center text-white font-bold text-sm">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            botName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[15px] font-semibold text-slate-100">{botName}</span>
            <span className="text-[10px] bg-accent-bg text-accent-bright border border-accent-border px-1.5 py-0.5 rounded font-semibold font-mono">APP</span>
            <span className="text-xs text-slate-500">Today</span>
          </div>

          <div
            className="rounded-lg overflow-hidden bg-[#2b2d31] border-l-4 max-w-[480px]"
            style={{ borderLeftColor: borderColor }}
          >
            <div className="p-3.5 space-y-2.5">
              {embed.author && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-300">
                    {embed.author.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-slate-200">{embed.author}</span>
                </div>
              )}

              {embed.title && (
                <h3 className="text-[15px] font-semibold text-slate-100 leading-snug">{embed.title}</h3>
              )}

              {embed.description && (
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{embed.description}</p>
              )}

              {fields.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {fields.map((f, i) => (
                    <div key={i} className={f.inline ? 'col-span-1' : 'col-span-3'}>
                      <div className="text-xs font-semibold text-slate-100 mb-0.5">{f.name || '\u200b'}</div>
                      <div className="text-xs text-slate-400 leading-relaxed">{f.value || '\u200b'}</div>
                    </div>
                  ))}
                </div>
              )}

              {embed.image && (
                <div className="rounded-md overflow-hidden max-w-full mt-1">
                  <img
                    src={embed.image}
                    alt=""
                    className="w-full h-auto"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {embed.thumbnail && (
                <div className="float-right ml-3 mb-1">
                  <img
                    src={embed.thumbnail}
                    alt=""
                    className="w-20 h-20 rounded-md object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {embed.footer && (
                <div className="text-xs text-slate-400 pt-0.5">{embed.footer}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
