import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Brush, Eraser, Eye, EyeOff, Pencil, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { useStore } from '../state/store';
import { Button, Spinner, TextInput } from './ui';
import { generateImageInpaint } from '../lib/api';
import { putGeneration } from '../lib/storage';
import { uid, cls } from '../lib/utils';
import type { Generation } from '../types';

type Tool = 'brush' | 'eraser';

export function EditMaskModal() {
  const { state, dispatch } = useStore();
  const id = state.ui.editMaskGenerationId;
  const g = state.generations.find((x) => x.id === id);
  if (!g || !g.imageUrl) return null;
  return <EditMaskBody key={g.id} g={g} onClose={() => dispatch({ type: 'ui/openEditMask', id: null })} />;
}

function EditMaskBody({ g, onClose }: { g: Generation; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(40);
  const [editPrompt, setEditPrompt] = useState('');
  const [showMask, setShowMask] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);

  const isDataUrl = g.imageUrl!.startsWith('data:');
  const imageProvider = state.settings.apiKeys.image?.provider;
  const canInpaint = imageProvider === 'fal';

  // Lay out the canvases at natural image dimensions once the image is decoded.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = isDataUrl ? '' : 'anonymous';
    img.onload = () => {
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
      imgRef.current = img;
    };
    img.onerror = () => {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Could not load the source image for editing.' } });
      onClose();
    };
    img.src = g.imageUrl!;
  }, [g.imageUrl, isDataUrl, dispatch, onClose]);

  // Initialise the mask canvas (black = keep) once dims are known.
  useEffect(() => {
    if (!dims || !maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d')!;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, dims.w, dims.h);
    drawOverlay();
    setHistory([ctx.getImageData(0, 0, dims.w, dims.h)]);
  }, [dims]);

  function drawOverlay() {
    if (!dims || !overlayCanvasRef.current || !maskCanvasRef.current) return;
    const ctx = overlayCanvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, dims.w, dims.h);
    if (!showMask) return;
    const maskCtx = maskCanvasRef.current.getContext('2d')!;
    const data = maskCtx.getImageData(0, 0, dims.w, dims.h);
    // Paint a translucent magenta over the "white" (regenerate) parts of the mask.
    const out = ctx.createImageData(dims.w, dims.h);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = data.data[i];
      if (v > 128) {
        out.data[i + 0] = 230;
        out.data[i + 1] = 80;
        out.data[i + 2] = 230;
        out.data[i + 3] = 130;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  useEffect(() => { drawOverlay(); }, [showMask]); // eslint-disable-line react-hooks/exhaustive-deps

  function localXY(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const c = overlayCanvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function paintAt(x: number, y: number) {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'brush' ? 'white' : 'black';
    ctx.fill();
    drawOverlay();
  }

  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dims) return;
    drawingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = localXY(e);
    paintAt(p.x, p.y);
    lastPtRef.current = p;
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !dims) return;
    const p = localXY(e);
    const last = lastPtRef.current;
    if (last) {
      // Bresenham-ish smoothing: paint along the line between last and current.
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(1, brushSize / 4);
      const steps = Math.ceil(dist / step);
      for (let i = 1; i <= steps; i++) {
        paintAt(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
      }
    }
    lastPtRef.current = p;
  }
  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPtRef.current = null;
    if (!maskCanvasRef.current || !dims) return;
    const snap = maskCanvasRef.current.getContext('2d')!.getImageData(0, 0, dims.w, dims.h);
    setHistory((h) => [...h.slice(-19), snap]);
  }

  function undo() {
    if (history.length <= 1 || !dims || !maskCanvasRef.current) return;
    const next = history.slice(0, -1);
    setHistory(next);
    maskCanvasRef.current.getContext('2d')!.putImageData(next[next.length - 1], 0, 0);
    drawOverlay();
  }

  function clearMask() {
    if (!dims || !maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d')!;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, dims.w, dims.h);
    setHistory([ctx.getImageData(0, 0, dims.w, dims.h)]);
    drawOverlay();
  }

  function hasMaskContent(): boolean {
    if (!dims || !maskCanvasRef.current) return false;
    const data = maskCanvasRef.current.getContext('2d')!.getImageData(0, 0, dims.w, dims.h).data;
    // Sample every 64th pixel — fast enough and any white-painted area gets hit.
    for (let i = 0; i < data.length; i += 256) {
      if (data[i] > 128) return true;
    }
    return false;
  }

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
    if (!hasMaskContent()) {
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
      const maskDataUrl = maskCanvasRef.current!.toDataURL('image/png');

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
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
              {!dims ? (
                <div className="flex aspect-square items-center justify-center text-ink-400"><Spinner size={28} /></div>
              ) : (
                <div className="relative w-full" style={{ aspectRatio: `${dims.w} / ${dims.h}` }}>
                  {/* Source image, always rendered. */}
                  <img src={g.imageUrl!} alt={g.title} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
                  {/* The actual mask canvas — hidden, used only as the source of truth. */}
                  <canvas
                    ref={maskCanvasRef}
                    width={dims.w}
                    height={dims.h}
                    className="hidden"
                  />
                  {/* Visible coloured overlay + pointer surface. */}
                  <canvas
                    ref={overlayCanvasRef}
                    width={dims.w}
                    height={dims.h}
                    className={cls(
                      'absolute inset-0 h-full w-full touch-none',
                      tool === 'brush' ? 'cursor-crosshair' : 'cursor-cell'
                    )}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onPointerLeave={onPointerUp}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ToolButton active={tool === 'brush'} onClick={() => setTool('brush')} icon={<Brush size={14} />} label="Brush" />
              <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={<Eraser size={14} />} label="Eraser" />
              <div className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-xs text-ink-200">
                <span>Size</span>
                <input
                  type="range" min={6} max={120} step={2} value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-28 accent-brand-500"
                />
                <span className="w-6 text-right text-[10px] text-ink-400">{brushSize}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={undo} disabled={history.length <= 1}><RotateCcw size={14} /> Undo</Button>
              <Button size="sm" variant="ghost" onClick={clearMask}><Trash2 size={14} /> Clear</Button>
              <button
                onClick={() => setShowMask((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-200 hover:border-ink-500 hover:text-white"
                title={showMask ? 'Hide mask overlay' : 'Show mask overlay'}
              >
                {showMask ? <Eye size={13} /> : <EyeOff size={13} />}
                {showMask ? 'Mask visible' : 'Mask hidden'}
              </button>
            </div>
          </div>

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

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition active:scale-95',
        active ? 'border-brand-400 bg-brand-500/15 text-brand-100' : 'border-ink-700 text-ink-200 hover:border-ink-500 hover:text-white'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
