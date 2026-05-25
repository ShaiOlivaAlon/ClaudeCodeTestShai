import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Sparkles, X } from 'lucide-react';
import { useStore } from '../state/store';
import { Button, Spinner, TextInput } from './ui';
import { MaskCanvas, type MaskCanvasHandle } from './MaskCanvas';
import { generateImageInpaint } from '../lib/api';
import { putGeneration } from '../lib/storage';
import { uid } from '../lib/utils';
import type { Generation } from '../types';

export function EditMaskModal() {
  const { state, dispatch } = useStore();
  const id = state.ui.editMaskGenerationId;
  const g = state.generations.find((x) => x.id === id);
  if (!g || !g.imageUrl) return null;
  return <EditMaskBody key={g.id} g={g} onClose={() => dispatch({ type: 'ui/openEditMask', id: null })} />;
}

function EditMaskBody({ g, onClose }: { g: Generation; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const maskRef = useRef<MaskCanvasHandle>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [busy, setBusy] = useState(false);

  const isDataUrl = g.imageUrl!.startsWith('data:');
  const canInpaint = state.settings.apiKeys.image?.provider === 'fal';

  async function loadSourceAsDataUrl(): Promise<string> {
    if (isDataUrl) return g.imageUrl!;
    const res = await fetch(g.imageUrl!);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  async function apply() {
    if (!maskRef.current?.hasContent()) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Paint over the area you want to change first.' } });
      return;
    }
    if (!editPrompt.trim()) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Describe the change in the prompt field.' } });
      return;
    }
    if (!canInpaint) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Region edit needs fal.ai as the Image provider. Open Settings to switch.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    setBusy(true);
    try {
      const sourceDataUrl = await loadSourceAsDataUrl();
      const maskDataUrl = maskRef.current!.getMaskDataUrl()!;

      const newId = uid('gen');
      const queued: Generation = {
        id: newId,
        title: `${g.title} — edit`,
        prompt: editPrompt.trim(),
        enhancedPrompt: editPrompt.trim(),
        imageModel: 'fal-ai/flux-pro/v1/fill',
        aspectRatio: g.aspectRatio,
        status: 'generating',
        createdAt: Date.now(),
        referenceAssetIds: [],
        parentId: g.id,
        editNote: editPrompt.trim(),
        chosenSeason: g.chosenSeason,
        chosenTheme: g.chosenTheme,
        chosenStyle: g.chosenStyle,
      };
      dispatch({ type: 'generations/upsert', generation: queued });
      dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'Inpainting… should finish in ~30s.' } });

      const { url } = await generateImageInpaint({
        apiKeys: state.settings.apiKeys,
        sourceImageDataUrl: sourceDataUrl,
        maskDataUrl,
        prompt: editPrompt.trim(),
        aspectRatio: g.aspectRatio,
      });
      const done: Generation = { ...queued, status: 'done', imageUrl: url };
      dispatch({ type: 'generations/upsert', generation: done });
      putGeneration(done);
      dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Edit applied — new image in the gallery.' } });
      onClose();
      dispatch({ type: 'ui/openDetail', id: newId });
    } catch (err: any) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: err?.message ?? 'Inpaint failed.' } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 px-2 py-4 backdrop-blur-sm sm:px-4 sm:py-10" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-5xl rounded-2xl border border-ink-700 bg-ink-900 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-5 py-3">
          <h2 className="flex items-center gap-2 truncate font-display text-lg font-semibold text-white">
            <Pencil size={18} className="text-brand-300" /> Edit area — {g.title}
          </h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-white" title="Close">
            <X size={18} />
          </button>
        </div>

        {!canInpaint && (
          <div className="mx-5 mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Region edit currently requires <strong>fal.ai</strong> as your Image provider. You can still paint to preview, but Apply will be blocked until you switch in Settings.
          </div>
        )}

        <div className="grid gap-4 p-5 lg:grid-cols-[1.6fr_1fr]">
          <MaskCanvas ref={maskRef} imageUrl={g.imageUrl!} onLoadError={() => { dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Could not load source image.' } }); onClose(); }} />

          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-200">What should the painted area become?</div>
              <TextInput
                value={editPrompt}
                onChange={setEditPrompt}
                placeholder='e.g. "a glowing wizard hat" / "replace logo with new game logo"'
              />
              <p className="mt-1 text-[10px] text-ink-400">
                Paint <span className="text-fuchsia-300">magenta</span> over the area you want to change, then describe what should appear there.
              </p>
            </div>

            <div className="rounded-md border border-ink-700 bg-ink-850 p-3 text-[11px] text-ink-300">
              <div className="mb-1 font-semibold text-ink-100">Tips</div>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Bigger brush for broad changes, smaller for fine detail.</li>
                <li>You can re-edit the result — each edit creates a new gallery card linked to the source.</li>
                <li>Results take ~20–60s on fal.ai FLUX Pro Fill.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={apply} disabled={busy}>
                {busy ? <Spinner size={14} /> : <Sparkles size={14} />}
                {busy ? 'Applying…' : 'Apply edit'}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
