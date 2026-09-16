import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/Loading';
import { Upload, Link as LinkIcon, X } from 'lucide-react';

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}

export function ImageUpload({ label, value, onChange, placeholder = 'https://...' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return;

    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;

      const ext = file.name.split('.').pop() || 'png';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from('embed-images')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) return;

      const { data: urlData } = supabase.storage
        .from('embed-images')
        .getPublicUrl(path);

      if (urlData?.publicUrl) onChange(urlData.publicUrl);
    } catch {
      // upload failed silently — UI shows no change
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label !mb-0">{label}</label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`text-2xs px-1.5 py-0.5 rounded transition-colors ${mode === 'url' ? 'text-accent-bright bg-accent-bg' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <LinkIcon className="w-2.5 h-2.5 inline mr-0.5" />URL
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`text-2xs px-1.5 py-0.5 rounded transition-colors ${mode === 'upload' ? 'text-accent-bright bg-accent-bg' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <Upload className="w-2.5 h-2.5 inline mr-0.5" />Upload
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <div className="relative">
          <input className="input pr-8" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className="input cursor-pointer flex items-center justify-center gap-2 text-zinc-500 hover:border-kma-border transition-colors min-h-[42px]"
        >
          {uploading ? (
            <><Spinner className="w-3.5 h-3.5" /> Uploading...</>
          ) : value ? (
            <span className="text-xs text-accent-bright truncate">{value.split('/').pop()}</span>
          ) : (
            <><Upload className="w-3.5 h-3.5" /> <span className="text-xs">Click or drag an image here</span></>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {value && (
        <div className="mt-1.5 rounded-md overflow-hidden border border-kma-border-subtle max-h-20">
          <img src={value} alt="" className="w-full h-auto max-h-20 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
    </div>
  );
}
