// The treasure search's feel (Нефигугум, forum post 34: «точное место убило весь интерес»): the chart draws a map's
// search circle only; sailing into it says so once («Вы в районе клада — ищите свиток на воде»), and the moment her
// lookouts see the scroll on the water (the server sends the spot then, MapView.spot) says that once too. Hysteresis on
// the circle's edge, so a ship running along it is not told every second.

import type { MapView } from '../../../shared/src/protocol.ts';

/** Out of a circle again only this far past its edge (metres, and a share of the radius). */
const LEAVE_PAD = 60;
const LEAVE_K = 1.05;

export interface SearchMemo {
  inside: Set<string>;
  seen: Set<string>;
}

export function searchMemo(): SearchMemo {
  return { inside: new Set(), seen: new Set() };
}

/** One look at her maps from where she is: the maps whose circle she has just come into, and those whose scroll has
 *  just come in sight. A map gone from the chest is forgotten. */
export function searchStep(memo: SearchMemo, maps: readonly MapView[], x: number, y: number): { entered: MapView[]; sighted: MapView[] } {
  const entered: MapView[] = [], sighted: MapView[] = [];
  const ids = new Set(maps.map((m) => m.id));
  for (const id of [...memo.inside]) if (!ids.has(id)) memo.inside.delete(id);
  for (const id of [...memo.seen]) if (!ids.has(id)) memo.seen.delete(id);
  for (const m of maps) {
    if (m.r > 0) {
      const d = Math.hypot(m.x - x, m.y - y);
      if (!memo.inside.has(m.id) && d <= m.r) {
        memo.inside.add(m.id);
        if (!m.spot) entered.push(m);
      } else if (memo.inside.has(m.id) && d > m.r * LEAVE_K + LEAVE_PAD) memo.inside.delete(m.id);
    }
    // (a circle drawn to a point has its spot always: that is no sighting)
    if (m.spot && m.r !== 0 && !memo.seen.has(m.id)) {
      memo.seen.add(m.id);
      sighted.push(m);
    } else if (!m.spot) memo.seen.delete(m.id);
  }
  return { entered, sighted };
}

/** The chip over the sea while she searches (a phone has no «Сейчас» line): the scroll in sight, else the hottest
 *  warm/cold step of the circles she is in; null when neither. */
export function searchChip(maps: readonly MapView[]): { heat: 1 | 2 | 3 } | { seen: true } | null {
  if (maps.some((m) => m.spot && m.r !== 0)) return { seen: true };
  let heat = 0;
  for (const m of maps) heat = Math.max(heat, m.heat ?? 0);
  return heat ? { heat: heat as 1 | 2 | 3 } : null;
}

/** The chip's markup (empty: hidden). `w` gives the words. */
export function searchChipHtml(c: ReturnType<typeof searchChip>, w: (k: 'heat.1' | 'heat.2' | 'heat.3' | 'look' | 'inSight') => string): string {
  if (!c) return '';
  if ('seen' in c) return `<b class="tm-heat h3">${w('inSight')}</b>`;
  return `<b class="tm-heat h${c.heat}">${w(`heat.${c.heat}`)}</b><span>${w('look')}</span>`;
}
