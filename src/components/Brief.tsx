import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Brief as BriefT } from '../types';
import Chip from './Chip';

const SEASONS = [
  'Spring',
  'Summer',
  'Fall',
  'Winter',
  'Christmas',
  'Halloween',
  'Valentine',
  'St. Patrick',
  'Easter',
  'New Year',
  'Lunar New Year',
];
const STYLES = [
  'Cartoon',
  '3D render',
  'Hand-painted',
  'Cinematic',
  'Pixar-like',
  'Stylized realism',
  'Vector flat',
  'Anime',
  'Neon retro',
  'Pop-art',
];
const FEATURES = [
  'Pop-up',
  'In-game banner',
  'Store ad',
  'Performance ad',
  'Social post',
  'Story / Reel',
  'Push notification',
  'Promo bundle',
  'Cross-promo',
];

interface Props {
  brief: BriefT;
  onChange: (brief: BriefT) => void;
}

export default function Brief({ brief, onChange }: Props) {
  const [newTitle, setNewTitle] = useState('');

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const addTitle = () => {
    const t = newTitle.trim();
    if (!t) return;
    onChange({ ...brief, titles: [...brief.titles, t] });
    setNewTitle('');
  };

  return (
    <section className="card-pad space-y-5">
      <header>
        <div className="section-title">The Brief</div>
        <h2 className="mt-1 font-display text-xl font-semibold text-white">
          What are we making?
        </h2>
      </header>

      <div className="space-y-2">
        <label className="label">Theme / Concept</label>
        <input
          className="input-lg"
          placeholder="e.g. Mega Win celebration with confetti and gold coins"
          value={brief.theme}
          onChange={(e) => onChange({ ...brief, theme: e.target.value })}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="label">Use case</label>
          <div className="flex flex-wrap gap-1.5">
            {FEATURES.map((f) => (
              <Chip
                key={f}
                label={f}
                active={brief.features.includes(f)}
                onClick={() =>
                  onChange({ ...brief, features: toggle(brief.features, f) })
                }
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="label">Seasonal</label>
          <div className="flex flex-wrap gap-1.5">
            {SEASONS.map((s) => (
              <Chip
                key={s}
                label={s}
                active={brief.seasons.includes(s)}
                onClick={() => onChange({ ...brief, seasons: toggle(brief.seasons, s) })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="label">Style</label>
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => (
            <Chip
              key={s}
              label={s}
              active={brief.styles.includes(s)}
              onClick={() => onChange({ ...brief, styles: toggle(brief.styles, s) })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="label">Titles / headlines to render</label>
        <div className="flex flex-wrap gap-1.5">
          {brief.titles.map((t, i) => (
            <Chip
              key={`${t}-${i}`}
              label={t}
              onRemove={() =>
                onChange({ ...brief, titles: brief.titles.filter((_, idx) => idx !== i) })
              }
            />
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder='e.g. "Mega Win!" or "Limited Time -50%"'
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTitle();
              }
            }}
          />
          <button type="button" className="btn-ghost" onClick={addTitle}>
            <Plus size={16} /> Add
          </button>
        </div>
        <p className="text-[11px] text-ink-400">
          Each title will be rotated across the generated set so you get coverage.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="label">Copy voice examples</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Sample copy lines you like — tone / cadence"
            value={brief.copyExamples}
            onChange={(e) => onChange({ ...brief, copyExamples: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="label">Extra notes</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Must-haves, avoid-list, audience, anything else"
            value={brief.notes}
            onChange={(e) => onChange({ ...brief, notes: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}
