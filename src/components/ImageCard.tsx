import { Download, Film, Repeat, Loader2, AlertCircle, Play, ExternalLink } from 'lucide-react';
import type { GeneratedImage } from '../types';
import { downloadDataUrl } from '../lib/files';

interface Props {
  image: GeneratedImage;
  onRegenerate: () => void;
  onMakeVideo: () => void;
  onOpenVideo: () => void;
}

const ASPECT_TO_PAD: Record<string, string> = {
  '1:1': '100%',
  '16:9': '56.25%',
  '9:16': '177.78%',
  '4:5': '125%',
  '5:4': '80%',
  '3:4': '133.33%',
  '4:3': '75%',
};

export default function ImageCard({ image, onRegenerate, onMakeVideo, onOpenVideo }: Props) {
  const pad = ASPECT_TO_PAD[image.aspect] || '100%';
  return (
    <div className="group card overflow-hidden">
      <div className="relative w-full bg-black/40" style={{ paddingTop: pad }}>
        <img
          src={image.dataUrl}
          alt={image.prompt.slice(0, 80)}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {image.video && (
          <button
            onClick={onOpenVideo}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition"
            aria-label="Play video"
          >
            <span className="rounded-full bg-white/90 text-black p-3 shadow-glow">
              <Play size={22} />
            </span>
          </button>
        )}

        <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-md bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          {image.aspect}
        </div>

        {image.video && (
          <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            <Film size={10} /> Video
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 p-2.5">
        <div className="flex gap-1">
          <button
            className="btn-icon"
            onClick={() =>
              downloadDataUrl(
                image.dataUrl,
                `playtika-${image.aspect.replace(':', 'x')}-${image.id.slice(0, 6)}.png`
              )
            }
            title="Download image"
          >
            <Download size={14} />
          </button>
          <button className="btn-icon" onClick={onRegenerate} title="Regenerate this slot">
            <Repeat size={14} />
          </button>
        </div>

        {image.videoLoading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-300">
            <Loader2 size={12} className="animate-spin" /> Rendering video…
          </span>
        ) : image.videoError ? (
          <span
            className="inline-flex items-center gap-1.5 text-xs text-hot-400"
            title={image.videoError}
          >
            <AlertCircle size={12} /> Video failed
          </span>
        ) : image.video ? (
          <div className="flex items-center gap-1">
            {image.video.sharepoint?.webUrl && (
              <a
                href={image.video.sharepoint.webUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-icon"
                title="Open in SharePoint"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <a
              href={image.video.url}
              download={`playtika-${image.aspect.replace(':', 'x')}-${image.id.slice(0, 6)}.mp4`}
              className="btn-icon"
              title="Download video"
            >
              <Download size={14} />
            </a>
            <button className="btn-icon" onClick={onOpenVideo} title="Play video">
              <Film size={14} />
            </button>
          </div>
        ) : (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-electric-500/15 text-electric-400 border border-electric-500/30 hover:bg-electric-500/25 transition"
            onClick={onMakeVideo}
          >
            <Film size={12} /> Make video
          </button>
        )}
      </div>
    </div>
  );
}
