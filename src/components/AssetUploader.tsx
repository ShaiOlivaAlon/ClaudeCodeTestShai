import { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import type { Asset, AssetKind } from '../types';
import { fileToDataUrl } from '../lib/files';

interface Props {
  title: string;
  hint: string;
  kind: AssetKind;
  assets: Asset[];
  onAdd: (assets: Asset[]) => void;
  onRemove: (id: string) => void;
  multiple?: boolean;
}

export default function AssetUploader({
  title,
  hint,
  kind,
  assets,
  onAdd,
  onRemove,
  multiple = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const next: Asset[] = [];
    for (const f of Array.from(files)) {
      const dataUrl = await fileToDataUrl(f);
      next.push({
        id: crypto.randomUUID(),
        kind,
        name: f.name,
        dataUrl,
        mimeType: f.type || 'image/png',
      });
    }
    onAdd(next);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <span className="text-[11px] text-ink-400">{hint}</span>
      </div>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="grid grid-cols-3 gap-2"
      >
        {assets.map((a) => (
          <div
            key={a.id}
            className="group relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40"
          >
            <img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(a.id)}
              className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white opacity-0 group-hover:opacity-100 transition"
              aria-label="Remove"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="aspect-square rounded-lg border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-accent-500/50 flex items-center justify-center text-ink-300 transition"
        >
          <Plus size={20} />
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
