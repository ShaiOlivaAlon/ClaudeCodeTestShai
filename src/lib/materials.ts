export interface MaterialDef {
  id: string;
  label: string;
  /** Phrase injected into the sculpture prompt. */
  promptFragment: string;
  /** Optional swatch colour for the UI preview chip. */
  swatch: string;
}

export const SCULPTURE_MATERIALS: MaterialDef[] = [
  { id: 'marble',    label: 'White marble', promptFragment: 'polished white marble, classical sculpture style, subtle veining', swatch: '#ece9e0' },
  { id: 'gold',      label: 'Solid gold',   promptFragment: 'gleaming solid gold with sharp specular highlights, ornate detail', swatch: '#e6c061' },
  { id: 'bronze',    label: 'Aged bronze',  promptFragment: 'aged bronze with green patina, antique sculpture', swatch: '#7a5a3d' },
  { id: 'stone',     label: 'Carved stone', promptFragment: 'weathered grey stone, chiseled, ancient temple feel', swatch: '#8e8b87' },
  { id: 'ice',       label: 'Clear ice',    promptFragment: 'translucent clear ice sculpture, faceted, glistening, cold blue tones', swatch: '#bfe8f6' },
  { id: 'jade',      label: 'Green jade',   promptFragment: 'translucent green jade, smooth polished surface, subtle internal glow', swatch: '#4f9d6a' },
  { id: 'obsidian',  label: 'Obsidian',     promptFragment: 'black volcanic obsidian, glossy, sharp edges, glassy reflections', swatch: '#1f1c24' },
  { id: 'crystal',   label: 'Crystal',      promptFragment: 'clear faceted crystal, refractive, rainbow caustics', swatch: '#dceaff' },
  { id: 'wood',      label: 'Carved wood',  promptFragment: 'dark polished hardwood, fine grain, hand-carved', swatch: '#6a3f1f' },
  { id: 'iron',      label: 'Wrought iron', promptFragment: 'wrought iron, dark grey, slightly rusted, hammered texture', swatch: '#3a3a3f' },
  { id: 'sandstone', label: 'Sandstone',    promptFragment: 'warm sandstone, sun-bleached, ancient ruin feel', swatch: '#d6a86b' },
  { id: 'silver',    label: 'Polished silver', promptFragment: 'bright polished silver, mirror-like reflections', swatch: '#d6d6dc' },
];

export function findMaterial(id: string): MaterialDef | undefined {
  return SCULPTURE_MATERIALS.find((m) => m.id === id);
}
