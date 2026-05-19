import type { OutputSpec as Spec } from '../types';
import Chip from './Chip';

const ASPECTS = ['1:1', '9:16', '16:9', '4:5', '3:4', '4:3'];

interface Props {
  spec: Spec;
  onChange: (spec: Spec) => void;
}

export default function OutputSpec({ spec, onChange }: Props) {
  const toggleAspect = (a: string) =>
    onChange({
      ...spec,
      aspects: spec.aspects.includes(a)
        ? spec.aspects.filter((x) => x !== a)
        : [...spec.aspects, a],
    });

  return (
    <section className="card-pad space-y-5">
      <header>
        <div className="section-title">Output</div>
        <h2 className="mt-1 font-display text-xl font-semibold text-white">
          Sizes, models, and how many
        </h2>
      </header>

      <div className="space-y-2">
        <label className="label">Aspect ratios</label>
        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <Chip
              key={a}
              label={a}
              active={spec.aspects.includes(a)}
              onClick={() => toggleAspect(a)}
            />
          ))}
        </div>
        <p className="text-[11px] text-ink-400">
          One image per aspect, multiplied by count below.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        <div className="space-y-2">
          <label className="label">Image model</label>
          <select
            className="input"
            value={spec.imageModel}
            onChange={(e) =>
              onChange({ ...spec, imageModel: e.target.value as Spec['imageModel'] })
            }
          >
            <option value="imagen-4">Imagen 4 (best quality)</option>
            <option value="imagen-3">Imagen 3 (fast)</option>
            <option value="gemini-image">Gemini 2.5 Flash Image (uses refs)</option>
          </select>
          <p className="text-[11px] text-ink-400">
            If you upload references, Gemini Image is used automatically.
          </p>
        </div>
        <div className="space-y-2">
          <label className="label">Video model</label>
          <select
            className="input"
            value={spec.videoModel}
            onChange={(e) =>
              onChange({ ...spec, videoModel: e.target.value as Spec['videoModel'] })
            }
          >
            <option value="veo-3">Veo 3 (preview)</option>
            <option value="veo-2">Veo 2</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="label">Variations per size</label>
          <input
            type="number"
            min={1}
            max={4}
            className="input"
            value={spec.count}
            onChange={(e) =>
              onChange({ ...spec, count: Math.max(1, Math.min(4, Number(e.target.value) || 1)) })
            }
          />
        </div>
      </div>
    </section>
  );
}
