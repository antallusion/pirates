// Owner, 2026-10-27 (the boarding's hexes «в воздухе»: «тебе нужно все карты найти и на них расставить поля вручную
// четко там, где может пройти кто-то»): each deck painting (assets/art/deck_<hull>.webp, 1024×1536, the bow up) laid on
// its half of the field so the hexes stand on its planks, and the hexes it has no planks under taken off the field.
//
// Laid as it was (cover over the half-deck's box), the painting's rails, lanterns and cargo ran down the outer columns
// and the bow's corners were sea: a stack stood on the rail or in the air. Now the painting is zoomed so its plank band
// at the waist (the inner faces of the two rails, `hw` of the image's width either side of its middle) spans DECK_PW of
// the box's five hex widths, and set `dy` of the box's height lower (the stern rail under the last row). What still has
// no planks under it — the bow's corners, the stern's balustrade posts — is `void`: one digit a row, the hexes off each
// end of that row (the decks are drawn symmetric), turned to water ('~') by the server (no footing, nobody deploys or
// is set there), not drawn by the client.
//
// Authored by looking at every painting with the grid over it: tools/art/deckmaps_sheet.py draws the contact sheet.

import { deckArt, FLEET_STAND_IN } from './fleet.ts';
import { TAC_GAP, TAC_H, TAC_W, hexIndex, hexMirror } from './tactical.ts';

export interface DeckMap {
  /** Half the plank band's width at the waist, a share of the painting's width. */
  hw: number;
  /** The painting set lower by this share of the box's height. */
  dy: number;
  /** Per row (bow first), the hexes off each end of the row that have no planks. */
  void: string;
}

/** The plank band's width on the field, in hex widths (the half-deck's box is five). */
export const DECK_PW = 4.5;

const BASE: DeckMap = { hw: 0.33, dy: 0.025, void: '100000000' };
/** Paintings whose rails, ladders or cargo stand further in (their band is narrower). */
const NARROW = [
  'bomb_ketch', 'brigantine', 'carrack', 'collier', 'cutter', 'golden_lion', 'great_xebec', 'hoy', 'hulk', 'icebound_hulk',
  'iron_ram', 'kraken_hunter', 'pearl_schooner', 'schooner', 'sloop', 'storeship', 'storm_reaver', 'sun_galleon', 'tartane',
  'tea_clipper', 'treasure_fluyt', 'viper', 'war_galley', 'wind_dancer', 'wyvern_galleass',
];
/** Paintings with a balustrade's posts or a great lantern at the stern's corners (the last row's ends off). */
const STERN_POSTS = [
  'galleon', 'golden_carrack', 'golden_lion', 'leviathan_ark', 'man_o_war', 'plate_galleon', 'polacre', 'silk_junk',
  'sloop_of_war', 'storm_reaver', 'sun_galleon', 'thunderer', 'treasure_junk',
];
/** Each painting's own, where it is not BASE (by its art name: assets/art/deck_<name>.webp). */
export const DECK_MAPS: Record<string, Partial<DeckMap>> = {
  ...Object.fromEntries(NARROW.map((n) => [n, { hw: 0.3 }])),
  golden_carrack: { dy: 0.045 },
  war_galley: { hw: 0.27 }, // her oar-ladders down both sides
};
for (const n of STERN_POSTS) DECK_MAPS[n] = { ...DECK_MAPS[n], void: '100000001' };
/** The tall balustrades and stairs of the great sterns (the row before the last too). */
for (const n of ['galleon', 'sloop_of_war']) DECK_MAPS[n] = { ...DECK_MAPS[n], void: '100000011' };

/** The painting a hull's deck is drawn with (her own, or the one standing in for it), without `bg.deck_`. */
export function deckArtName(hull: string | undefined): string {
  const id = deckArt(hull ?? 'brig');
  return (FLEET_STAND_IN[id] ?? id).replace(/^bg\.deck_/, '');
}

/** How a hull's deck painting lies on the field. */
export function deckMap(hull: string | undefined): DeckMap {
  return { ...BASE, ...DECK_MAPS[deckArtName(hull)] };
}

/** The hexes of side `side`'s deck that have no planks under them (her hull's painting, her half of the field). The
 *  last row's second hex is never one (side 0's flag stands there: tacFlagHex). */
export function deckVoids(hull: string | undefined, side: 0 | 1): number[] {
  const m = deckMap(hull);
  const out: number[] = [];
  for (let y = 0; y < TAC_H; y++) {
    const n = y & 1 ? TAC_GAP - 1 : TAC_GAP; // hexes in the row on her deck: 5, the odd rows 4
    const k = Math.min(y === TAC_H - 1 ? 1 : 2, Number(m.void[y] ?? 0));
    for (let j = 0; j < k; j++) for (const x of [j, n - 1 - j]) {
      const l = hexIndex(x, y);
      out.push(side ? hexMirror(l) : l);
    }
  }
  return [...new Set(out)].filter((i) => i >= 0 && i < TAC_W * TAC_H).sort((a, b) => a - b);
}
