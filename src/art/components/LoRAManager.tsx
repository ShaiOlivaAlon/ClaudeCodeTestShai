import { Plus, X } from 'lucide-react';
import { LoRA } from '../types';
import { newId } from '../utils/assets';

interface Props {
  loras: LoRA[];
  onChange: (next: LoRA[]) => void;
}

export default function LoRAManager({ loras, onChange }: Props) {
  const update = (id: string, patch: Partial<LoRA>) =>
    onChange(loras.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => onChange(loras.filter((l) => l.id !== id));
  const add = () =>
    onChange([
      ...loras,
      { id: newId(), name: `LoRA ${loras.length + 1}`, url: '', scale: 1 },
    ]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700">LoRAs</label>
        <button type="button" onClick={add} className="text-xs text-primary-600 font-semibold inline-flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add LoRA
        </button>
      </div>
      {loras.length === 0 && (
        <div className="text-xs text-gray-500 italic">
          No LoRAs. Paste a Civitai or HuggingFace LoRA URL. Most effective with
          FAL flux-lora models.
        </div>
      )}
      {loras.map((l) => (
        <div key={l.id} className="card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={l.name}
              onChange={(e) => update(l.id, { name: e.target.value })}
              className="input-field flex-1"
              placeholder="Name"
            />
            <button
              type="button"
              onClick={() => remove(l.id)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            value={l.url}
            onChange={(e) => update(l.id, { url: e.target.value })}
            className="input-field"
            placeholder="https://… (Civitai download URL or HF .safetensors)"
          />
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600">Scale</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={l.scale}
              onChange={(e) => update(l.id, { scale: parseFloat(e.target.value) })}
              className="flex-1"
            />
            <span className="text-xs font-mono w-10 text-right">{l.scale.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
