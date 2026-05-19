import { useEffect, useState } from 'react';
import { Key, ExternalLink, Eye, EyeOff, ImageIcon, Type, Video } from 'lucide-react';
import { getStoredKey, emitKeyChange } from '../lib/apiKey';

interface Props {
  open: boolean;
  onClose: () => void;
  canClose?: boolean;
}

export default function ApiKeyModal({ open, onClose, canClose = true }: Props) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [shared, setShared] = useState(true);
  const [imageKey, setImageKey] = useState('');
  const [textKey, setTextKey] = useState('');
  const [videoKey, setVideoKey] = useState('');

  useEffect(() => {
    if (open) {
      const stored = getStoredKey();
      setValue(stored);
      setImageKey(stored);
      setTextKey(stored);
      setVideoKey(stored);
    }
  }, [open]);

  if (!open) return null;

  const effectiveKey = shared ? value.trim() : (imageKey || textKey || videoKey).trim();
  const canSave = effectiveKey.length > 10;

  function save() {
    if (!canSave) return;
    // We only store one key — Gemini's same key works for all three. The
    // per-service fields are a UX courtesy in case the user wants to use
    // different keys, in which case we still pick one (image, then text,
    // then video) since the server uses one project per request.
    const chosen = shared ? value.trim() : (imageKey.trim() || textKey.trim() || videoKey.trim());
    emitKeyChange(chosen);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => canClose && onClose()}
      />
      <div className="relative w-full max-w-lg card-pad space-y-5 animate-[fadeIn_.25s_ease]">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent-gradient flex items-center justify-center shadow-glow">
            <Key size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold text-white">
              Connect your Gemini API key
            </h2>
            <p className="text-xs text-ink-300 mt-1">
              The same key works for image, text, and video generation. It stays in your browser —
              we only forward it to Google's API.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-ink-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          Use one key for all three (recommended)
        </label>

        {shared ? (
          <div>
            <div className="label mb-1.5">Gemini API key</div>
            <div className="relative">
              <input
                autoFocus
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="AIza…"
                className="input pr-10 font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-300 hover:text-white"
                aria-label={show ? 'Hide key' : 'Show key'}
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <KeyField icon={<ImageIcon size={14} />} label="Image (Imagen)" value={imageKey} onChange={setImageKey} />
            <KeyField icon={<Type size={14} />} label="Text (Gemini)" value={textKey} onChange={setTextKey} />
            <KeyField icon={<Video size={14} />} label="Video (Veo)" value={videoKey} onChange={setVideoKey} />
            <p className="text-[11px] text-ink-400">
              Heads-up: only one key is actually stored. We'll use the image key first, then text,
              then video, so put your most-used key in the top field.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-ink-300 hover:text-white inline-flex items-center gap-1"
          >
            Get a free key <ExternalLink size={11} />
          </a>
          <div className="flex items-center gap-2">
            {canClose && (
              <button className="btn-ghost text-sm" onClick={onClose}>
                Cancel
              </button>
            )}
            <button className="btn-primary text-sm disabled:opacity-50" onClick={save} disabled={!canSave}>
              Save & continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyField({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="label mb-1.5 flex items-center gap-1.5 text-ink-300">
        {icon} {label}
      </div>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="AIza…"
        className="input font-mono text-sm"
      />
    </div>
  );
}
