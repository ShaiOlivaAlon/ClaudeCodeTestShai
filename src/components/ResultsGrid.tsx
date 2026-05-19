import { useState } from 'react';
import { X } from 'lucide-react';
import type { GeneratedImage } from '../types';
import ImageCard from './ImageCard';

interface Props {
  images: GeneratedImage[];
  loadingCount: number;
  onRegenerate: (id: string) => void;
  onMakeVideo: (id: string) => void;
}

export default function ResultsGrid({ images, loadingCount, onRegenerate, onMakeVideo }: Props) {
  const [videoOpen, setVideoOpen] = useState<GeneratedImage | null>(null);

  if (!images.length && loadingCount === 0) {
    return (
      <section className="card-pad text-center py-16">
        <h3 className="font-display text-lg font-semibold text-white">No images yet</h3>
        <p className="mt-1 text-sm text-ink-300">
          Fill the brief, pick aspect ratios, then hit <span className="text-white">Generate</span>.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {images.map((img) => (
          <ImageCard
            key={img.id}
            image={img}
            onRegenerate={() => onRegenerate(img.id)}
            onMakeVideo={() => onMakeVideo(img.id)}
            onOpenVideo={() => setVideoOpen(img)}
          />
        ))}
        {Array.from({ length: loadingCount }).map((_, i) => (
          <div key={`skel-${i}`} className="card overflow-hidden">
            <div className="aspect-square skeleton" />
            <div className="p-2.5 h-12" />
          </div>
        ))}
      </div>

      {videoOpen?.video && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVideoOpen(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[92vw] rounded-2xl overflow-hidden bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 z-10 btn-icon bg-black/60"
              onClick={() => setVideoOpen(null)}
            >
              <X size={16} />
            </button>
            <video
              src={videoOpen.video.url}
              controls
              autoPlay
              loop
              className="max-h-[90vh] max-w-[92vw]"
            />
            {videoOpen.video.sharepoint?.webUrl && (
              <a
                href={videoOpen.video.sharepoint.webUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-black/85"
              >
                Open in SharePoint ↗
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
