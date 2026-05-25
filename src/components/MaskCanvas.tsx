import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Brush, Eraser, Eye, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from './ui';
import { cls } from '../lib/utils';

type Tool = 'brush' | 'eraser';

export interface MaskCanvasHandle {
  /** Returns a PNG data URL of the mask (white = regenerate, black = keep). */
  getMaskDataUrl(): string | null;
  hasContent(): boolean;
  clear(): void;
}

export interface MaskCanvasProps {
  imageUrl: string;
  /** Called when the source image errors and the modal should be closed. */
  onLoadError?: () => void;
  className?: string;
}

/** Canvas-based mask painter: shows a source image with a translucent overlay
 *  the user can paint on. The actual mask (white/black PNG) is exposed via the
 *  imperative handle so callers can submit it to an inpaint API. */
export const MaskCanvas = forwardRef<MaskCanvasHandle, MaskCanvasProps>(function MaskCanvas(
  { imageUrl, onLoadError, className },
  ref,
) {
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(40);
  const [showMask, setShowMask] = useState(true);
  const [history, setHistory] = useState<ImageData[]>([]);

  useImperativeHandle(ref, () => ({
    getMaskDataUrl() {
      return maskCanvasRef.current ? maskCanvasRef.current.toDataURL('image/png') : null;
    },
    hasContent() {
      if (!dims || !maskCanvasRef.current) return false;
      const data = maskCanvasRef.current.getContext('2d')!.getImageData(0, 0, dims.w, dims.h).data;
      for (let i = 0; i < data.length; i += 256) if (data[i] > 128) return true;
      return false;
    },
    clear() { clearMask(); },
  }), [dims]);

  // Lay out the canvases at natural image dimensions once decoded.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = imageUrl.startsWith('data:') ? '' : 'anonymous';
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => onLoadError?.();
    img.src = imageUrl;
  }, [imageUrl, onLoadError]);

  // Initialise the mask canvas to all-black (= keep everything) once dims are known.
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
    const out = ctx.createImageData(dims.w, dims.h);
    for (let i = 0; i < data.data.length; i += 4) {
      if (data.data[i] > 128) {
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
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
    };
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
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(1, brushSize / 4);
      const steps = Math.ceil(dist / step);
      for (let i = 1; i <= steps; i++) paintAt(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
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

  return (
    <div className={cls('space-y-3', className)}>
      <div className="relative overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
        {!dims ? (
          <div className="flex aspect-square items-center justify-center text-xs text-ink-400">Loading image…</div>
        ) : (
          <div className="relative w-full" style={{ aspectRatio: `${dims.w} / ${dims.h}` }}>
            <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
            <canvas ref={maskCanvasRef} width={dims.w} height={dims.h} className="hidden" />
            <canvas
              ref={overlayCanvasRef}
              width={dims.w}
              height={dims.h}
              className={cls(
                'absolute inset-0 h-full w-full touch-none',
                tool === 'brush' ? 'cursor-crosshair' : 'cursor-cell',
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
  );
});

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition active:scale-95',
        active ? 'border-brand-400 bg-brand-500/15 text-brand-100' : 'border-ink-700 text-ink-200 hover:border-ink-500 hover:text-white',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
