import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { StyleRef } from '../types';
import { blobToDataUrl, newId } from '../utils/assets';

interface Props {
  refs: StyleRef[];
  onChange: (refs: StyleRef[]) => void;
}

export default function StyleRefPicker({ refs, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    if (!files) return;
    const added: StyleRef[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const dataUrl = await blobToDataUrl(f);
      added.push({
        id: newId(),
        name: f.name,
        previewUrl: URL.createObjectURL(f),
        dataUrl,
        weight: 0.7,
      });
    }
    onChange([...refs, ...added]);
  };

  const update = (id: string, patch: Partial<StyleRef>) =>
    onChange(refs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(refs.filter((r) => r.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700">Style references</label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs text-primary-600 font-semibold inline-flex items-center gap-1"
        >
          <ImagePlus className="w-3 h-3" /> Add image
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void add(e.currentTarget.files);
            e.currentTarget.value = '';
          }}
        />
      </div>
      {refs.length === 0 ? (
        <div className="text-xs text-gray-500 italic">
          Optional. Reference images steer style; the first one is used as the primary
          style image when the model supports image conditioning.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {refs.map((r) => (
            <div key={r.id} className="card overflow-hidden relative">
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                <img src={r.previewUrl} alt={r.name} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="p-1">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={r.weight}
                  onChange={(e) => update(r.id, { weight: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="text-[10px] text-center font-mono">w {r.weight.toFixed(2)}</div>
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                className="absolute top-1 right-1 bg-white/90 text-red-600 rounded-full p-1 hover:bg-red-50"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
