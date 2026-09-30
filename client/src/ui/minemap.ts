// The mines on the chart (docs/17 H3 item 12): each one's outpost picture where it stands, with a pennant in its
// holder's colour — hers gold, another captain's blue, the raiders' red, nobody's grey — and her own named.

import { MINES } from '../../../shared/src/data/mines.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h3.ts';
import type { ClientState } from '../state.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);

const COLOUR = { you: '#e0b862', raiders: '#d0503c', other: '#6fa3d8', free: 'rgba(210,200,180,0.7)' } as const;

export function drawMines(
  g: CanvasRenderingContext2D, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, zoom: number, ms: number,
  mark: (id: string, x: number, y: number, size?: number) => boolean, label: (text: string, x: number, y: number, color?: string) => void,
): void {
  const ru = lang() === 'ru' ? 1 : 0;
  for (const m of state.mines) {
    const mine = m.holder === 'you';
    // Others' mines only once the chart is looked at closely, and on charted islands' waters.
    if (!mine && zoom < 1.5) continue;
    const x = tx(m.x), y = ty(m.y);
    const size = ms * (mine ? 1.15 : 0.85);
    const col = mine ? COLOUR.you : m.holder === 'raiders' ? COLOUR.raiders : m.holder ? COLOUR.other : COLOUR.free;
    // A pale disc under the outpost's picture, ringed in its holder's colour: the dark art reads on the dark chart.
    g.beginPath();
    g.arc(x, y, size * 0.48, 0, Math.PI * 2);
    g.fillStyle = 'rgba(232, 220, 190, 0.28)';
    g.fill();
    g.lineWidth = mine ? 2 : 1.2;
    g.strokeStyle = col;
    g.stroke();
    mark(`icon.${MINES[m.kind].art}`, x, y, size);
    const px = x + size * 0.35, py = y - size * 0.5;
    g.fillStyle = col;
    g.fillRect(px - 1, py, 2, size * 0.5);
    g.beginPath();
    g.moveTo(px + 1, py);
    g.lineTo(px + 9, py + 3.5);
    g.lineTo(px + 1, py + 7);
    g.closePath();
    g.fill();
    if (mine || zoom >= 2.5) {
      const kind = MINES[m.kind].name[ru];
      const text = mine ? L('map.mine.you', { kind }) : m.holder === 'raiders' ? L('map.mine.raiders', { kind }) : m.holder ? L('map.mine.other', { kind, who: m.holder }) : L('map.mine.free', { kind });
      g.font = '600 10px Inter, system-ui, sans-serif';
      label(mine ? `${text} · ${placeName(m.island)}` : text, x, y + size * 0.75, col);
    }
  }
}
