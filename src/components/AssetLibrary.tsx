import { useEffect, useRef, useState } from 'react';
import { Upload, X, Crown, Box, Image as ImageIcon, Sparkles, Trash2 } from 'lucide-react';
import type { Asset, AssetCategory } from '../types';
import { deleteAsset, putAsset } from '../lib/storage';
import { fileToDataUrl, imageDimensions, uid, cls } from '../lib/utils';
import { useStore } from '../state/store';
import { EmptyState } from './ui';

const TABS: { id: AssetCategory; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'character', label: 'Characters', icon: <Crown size={14} />, hint: 'Heroes, mascots, NPCs.' },
  { id: 'item',      label: 'Items',      icon: <Box size={14} />,  hint: 'Coins, gems, power-ups, props.' },
  { id: 'logo',      label: 'Logos',      icon: <Sparkles size={14} />, hint: 'Game logos & brand marks.' },
  { id: 'reference', label: 'References', icon: <ImageIcon size={14} />, hint: 'Mood/style references.' },
];

export function AssetLibrary() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<AssetCategory>('character');
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const visibleAssets = state.assets.filter((a) => a.category === tab);

  async function ingest(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return;
    for (const f of arr) {
      try {
        const dataUrl = await fileToDataUrl(f);
        const { width, height } = await imageDimensions(dataUrl);
        const asset: Asset = {
          id: uid('asset'),
          category: tab,
          name: f.name.replace(/\.[^.]+$/, ''),
          dataUrl,
          width,
          height,
          createdAt: Date.now(),
        };
        await putAsset(asset);
        dispatch({ type: 'assets/add', asset });
        // Auto-include newly uploaded character/logo into the brief.
        if (tab === 'character' || tab === 'logo') {
          dispatch({ type: 'brief/toggleAsset', assetId: asset.id });
        }
      } catch (err) {
        console.error(err);
        dispatch({ type: 'ui/toast', toast: { kind: 'error', message: `Failed to import ${f.name}` } });
      }
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) ingest(e.target.files);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) ingest(e.dataTransfer.files);
  }

  async function remove(id: string) {
    await deleteAsset(id);
    dispatch({ type: 'assets/remove', id });
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      const files = Array.from(e.clipboardData.files);
      if (files.length) ingest(files);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [tab]);

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-ink-800 bg-ink-900">
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">Library</div>
          <div className="text-xs text-ink-400">{state.assets.length} assets</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-ink-800 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cls(
              'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition',
              tab === t.id ? 'bg-brand-500/20 text-white shadow-[inset_0_0_0_1px_rgba(168,117,255,0.4)]' : 'text-ink-300 hover:bg-ink-800 hover:text-white'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cls(
          'mx-3 mt-3 cursor-pointer rounded-lg border border-dashed p-4 text-center transition',
          dragOver ? 'border-brand-400 bg-brand-500/10' : 'border-ink-600 hover:border-brand-400 hover:bg-ink-800/60'
        )}
        onClick={() => fileRef.current?.click()}
      >
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 text-brand-200">
          <Upload size={16} />
        </div>
        <div className="mt-2 text-sm font-medium text-white">Drop {TABS.find((t) => t.id === tab)!.label.toLowerCase()}</div>
        <div className="text-xs text-ink-400">or click to upload · paste from clipboard</div>
        <div className="mt-1 text-[10px] text-ink-500">{TABS.find((t) => t.id === tab)!.hint}</div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {visibleAssets.length === 0 ? (
          <EmptyState icon={<ImageIcon size={24} />} title="No assets yet" hint="Upload to start building briefs." />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {visibleAssets.map((a) => {
              const selected = state.brief.selectedAssetIds.includes(a.id);
              return (
                <div key={a.id} className="group relative">
                  <button
                    onClick={() => dispatch({ type: 'brief/toggleAsset', assetId: a.id })}
                    className={cls(
                      'block w-full overflow-hidden rounded-lg border bg-ink-800 transition',
                      selected ? 'border-brand-400 shadow-glow' : 'border-ink-700 hover:border-ink-500'
                    )}
                  >
                    <div className="relative aspect-square">
                      <img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover" />
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">IN</span>
                      )}
                    </div>
                    <div className="truncate px-2 py-1 text-left text-[11px] text-ink-200">{a.name}</div>
                  </button>
                  <button
                    title="Delete asset"
                    onClick={(e) => { e.stopPropagation(); remove(a.id); }}
                    className="absolute left-1 top-1 rounded-md bg-black/60 p-1 text-ink-200 opacity-0 transition group-hover:opacity-100 hover:text-white"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {state.brief.selectedAssetIds.length > 0 && (
        <div className="border-t border-ink-800 bg-ink-850 px-3 py-2 text-xs text-ink-300">
          <span className="text-ink-100">{state.brief.selectedAssetIds.length}</span> selected for brief
          <button
            onClick={() => state.brief.selectedAssetIds.forEach((id) => dispatch({ type: 'brief/toggleAsset', assetId: id }))}
            className="ml-2 inline-flex items-center gap-1 text-ink-400 hover:text-white"
          >
            <X size={10} /> clear
          </button>
        </div>
      )}
    </aside>
  );
}
