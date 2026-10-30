// What a port's shipyard sells, by its rank (Нефигугум, forum post 26: «корабли ⚓4–6 в портах 2 и выше … портов 2 я
// не нашел»): the hulls a yard of that rank builds for silver (server: ports.ts shipyardBuy, portinfo.ts — without a
// career's extra rank) and the span of their levels, for the chart's «Верфи» filter and the port's card.

import { SHIP_CLASSES, SHIP_CLASS_IDS } from './ships.ts';
import type { ShipClassId } from './ships.ts';
import { levelRange } from './shiplevel.ts';

/** The hulls a yard of this rank sells in a port of this flag. */
export function yardHulls(tier: number, faction: string): ShipClassId[] {
  if (tier <= 0) return [];
  return SHIP_CLASS_IDS.filter((id) => {
    const c = SHIP_CLASSES[id];
    return c.purchasable && c.tier <= tier && (!c.factions || c.factions.includes(faction));
  });
}

/** The levels (⚓) of those hulls, lowest to highest; null when the yard sells none. */
export function yardSpan(tier: number, faction: string): [number, number] | null {
  const ids = yardHulls(tier, faction);
  if (!ids.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const id of ids) {
    const [a, b] = levelRange(id);
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  return [lo, hi];
}

/** «1–6» (or «3» for one level). */
export function anchorSpan(s: [number, number]): string {
  return s[0] === s[1] ? String(s[0]) : `${s[0]}–${s[1]}`;
}
