import type { Asset } from '../types';
import AssetUploader from './AssetUploader';

interface Props {
  assets: Asset[];
  onChange: (assets: Asset[]) => void;
}

export default function BrandKit({ assets, onChange }: Props) {
  const byKind = (k: Asset['kind']) => assets.filter((a) => a.kind === k);

  const add = (newOnes: Asset[]) => onChange([...assets, ...newOnes]);
  const remove = (id: string) => onChange(assets.filter((a) => a.id !== id));

  return (
    <aside className="card-pad space-y-5 sticky top-4 h-fit">
      <header>
        <div className="section-title">Brand Kit</div>
        <p className="mt-1 text-sm text-ink-300">
          Drop your game's IP. References stay local in the browser.
        </p>
      </header>

      <AssetUploader
        title="Characters"
        hint="Heroes, mascots"
        kind="character"
        assets={byKind('character')}
        onAdd={add}
        onRemove={remove}
      />
      <AssetUploader
        title="Items & Props"
        hint="Coins, chests, power-ups"
        kind="item"
        assets={byKind('item')}
        onAdd={add}
        onRemove={remove}
      />
      <AssetUploader
        title="Game Logo"
        hint="PNG with transparency"
        kind="logo"
        assets={byKind('logo')}
        onAdd={add}
        onRemove={remove}
        multiple={false}
      />
      <AssetUploader
        title="Style References"
        hint="Mood / palette"
        kind="reference"
        assets={byKind('reference')}
        onAdd={add}
        onRemove={remove}
      />
    </aside>
  );
}
