import { Check, Trash2 } from 'lucide-react';
import { Asset } from '../types';

interface Props {
  assets: Asset[];
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onRemove?: (id: string) => void;
  emptyHint?: string;
}

export default function AssetGrid({
  assets,
  selectedIds,
  onToggle,
  onRemove,
  emptyHint = 'No assets yet.',
}: Props) {
  if (assets.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic py-6 text-center">{emptyHint}</div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {assets.map((a) => {
        const selected = selectedIds?.has(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={onToggle ? () => onToggle(a.id) : undefined}
            className={`group relative card overflow-hidden text-left ${
              onToggle ? 'cursor-pointer' : 'cursor-default'
            } ${selected ? 'ring-2 ring-primary-500' : ''}`}
          >
            <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src={a.previewUrl}
                alt={a.name}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="p-2">
              <div className="text-xs font-medium text-gray-800 truncate">
                {a.path}
              </div>
              <div className="text-[10px] text-gray-500">
                {a.width}×{a.height} · {(a.bytes / 1024).toFixed(0)} KB
              </div>
            </div>
            {selected && (
              <div className="absolute top-2 left-2 bg-primary-500 text-white rounded-full p-1">
                <Check className="w-3 h-3" />
              </div>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(a.id);
                }}
                className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </button>
        );
      })}
    </div>
  );
}
