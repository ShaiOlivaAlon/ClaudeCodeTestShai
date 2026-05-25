import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import type { LayerTransform } from '../types';
import { Button } from './ui';
import { cls } from '../lib/utils';

export interface CompositeCanvasProps {
  backgroundUrl?: string;
  sculptureUrl?: string;
  transform: LayerTransform;
  onTransformChange: (t: LayerTransform) => void;
  /** Aspect ratio of the underlying composition (w/h). */
  aspectRatio: number;
  /** When true, the sculpture can't be moved/scaled (e.g. layer is generating). */
  locked?: boolean;
  className?: string;
}

const DEFAULT_TRANSFORM: LayerTransform = { x: 0.5, y: 0.5, scale: 0.8 };

export const COMPOSITE_DEFAULTS = DEFAULT_TRANSFORM;

/** Interactive composite: shows the background image with the sculpture overlaid at the
 *  given transform, and lets the user drag the sculpture to reposition it. */
export function CompositeCanvas({
  backgroundUrl, sculptureUrl, transform, onTransformChange, aspectRatio, locked, className,
}: CompositeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (locked || !sculptureUrl) return;
    const c = containerRef.current!;
    const rect = c.getBoundingClientRect();
    dragStateRef.current = {
      ox: e.clientX,
      oy: e.clientY,
      sx: transform.x,
      sy: transform.y,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    void rect; // computed in onPointerMove for live dims
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = dragStateRef.current;
    if (!s || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - s.ox) / rect.width;
    const dy = (e.clientY - s.oy) / rect.height;
    const nx = clamp(s.sx + dx, 0, 1);
    const ny = clamp(s.sy + dy, 0, 1);
    onTransformChange({ ...transform, x: nx, y: ny });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    setDragging(false);
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* */ }
  }

  // Pinch-to-zoom support on touch devices.
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (locked || e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: transform.scale };
  }
  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!pinchRef.current || e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const factor = dist / pinchRef.current.startDist;
    onTransformChange({ ...transform, scale: clamp(pinchRef.current.startScale * factor, 0.1, 1.5) });
  }
  function onTouchEnd() { pinchRef.current = null; }

  // Mouse wheel = zoom on desktop.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (locked || !sculptureUrl) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.06 : 0.94;
      onTransformChange({ ...transform, scale: clamp(transform.scale * factor, 0.1, 1.5) });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [transform, onTransformChange, locked, sculptureUrl]);

  const sculpturePct = clamp(transform.scale, 0.05, 1.5) * 100;

  return (
    <div className={cls('space-y-2', className)}>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border border-ink-700 bg-checker"
        style={{
          aspectRatio: `${aspectRatio}`,
          // Subtle checker so transparency is obvious when background is missing.
          backgroundImage: backgroundUrl
            ? undefined
            : 'linear-gradient(45deg, #2a2a35 25%, transparent 25%), linear-gradient(-45deg, #2a2a35 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a35 75%), linear-gradient(-45deg, transparent 75%, #2a2a35 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {backgroundUrl && (
          <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        )}
        {sculptureUrl && (
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cls(
              'absolute touch-none select-none',
              locked ? 'cursor-not-allowed' : (dragging ? 'cursor-grabbing' : 'cursor-grab'),
            )}
            style={{
              left: `${transform.x * 100}%`,
              top: `${transform.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              height: `${sculpturePct}%`,
            }}
          >
            <img
              src={sculptureUrl}
              alt=""
              draggable={false}
              className={cls(
                'h-full w-auto max-w-none object-contain transition-shadow',
                dragging && !locked && 'shadow-[0_0_0_2px_rgba(168,117,255,0.7)]',
              )}
              style={{ filter: locked ? 'opacity(0.6)' : undefined }}
            />
          </div>
        )}
        {!backgroundUrl && !sculptureUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-400">
            Generate a background and a sculpture to start composing.
          </div>
        )}
      </div>

      {sculptureUrl && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-300">
          <div className="flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-2 py-1">
            <Minimize2 size={12} />
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.01}
              value={transform.scale}
              disabled={locked}
              onChange={(e) => onTransformChange({ ...transform, scale: Number(e.target.value) })}
              className="w-32 accent-brand-500"
            />
            <Maximize2 size={12} />
            <span className="w-10 text-right text-[10px] text-ink-400">{Math.round(transform.scale * 100)}%</span>
          </div>
          <Button size="sm" variant="ghost" disabled={locked} onClick={() => onTransformChange(DEFAULT_TRANSFORM)}>
            <RotateCcw size={12} /> Reset position
          </Button>
          <span className="text-[10px] text-ink-500">Drag to move · scroll / pinch to zoom</span>
        </div>
      )}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
