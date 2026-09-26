// The interface's art: every `ui.*` image (and the panel textures) becomes a CSS variable, `ui.frame` → `--ui-frame`,
// and the body gets `skinned` so the stylesheet swaps its drawn fallbacks for the frames, plates and slots.

import { assetUrl } from '../assets.ts';

const SKIN = [
  'ui.frame', 'ui.plate', 'ui.button', 'ui.slot', 'ui.ring', 'ui.portrait_ring', 'ui.minimap_ring', 'ui.bar', 'ui.close',
  'ui.actionbar', 'ui.helm', 'ui.stick_base', 'tex.ebony', 'tex.chart', 'tex.panel', 'tex.parchment',
  'bg.captain', 'bg.sunk', 'bg.prologue', 'bg.boarding', 'bg.cabin',
];

export function applySkin(): void {
  const root = document.documentElement;
  let n = 0;
  for (const id of SKIN) {
    const url = assetUrl(id);
    if (!url) continue;
    root.style.setProperty(`--${id.replace('.', '-').replace(/_/g, '-')}`, `url('${url}')`);
    n++;
  }
  document.body.classList.toggle('skinned', n > 0);
}
