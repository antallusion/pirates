// The painted fields ashore, hex by hex (owner, 2026-10-27: «есть поля карты, где ты поля рисуешь прям в воздухе
// заполняя всю карту. тебе нужно все карты найти и на них расставить поля вручную четко там, где может пройти кто-то»).
// Each painting (assets/art/field_<type>.webp, 1672×941) has its hex grid laid by hand on its walkable ground — the sand,
// the rock floor, the mud, the courtyard's flagstones — never on its sky, its sea, its cliffs or its trees; the painting
// over the grid (the far shore, the sky) is the room the top row's tall figures stand up into. Read by the server
// (tacbattle.ts makeLandField / makeSiegeField / makeArenaField: the void hexes, the pools) and the client
// (tactical.ts: where the painting lies under the hexes).

import { TAC_H, TAC_W, hexIndex } from './tactical.ts';
import type { TacCell } from './tactical.ts';

export interface FieldMap {
  /** The board's box on the painting, in fractions of its width and height: its left and top edge, and its width
   *  (its height follows from the board's own shape, the painting laid uniformly — never stretched). */
  x0: number;
  y0: number;
  gw: number;
  /** One string a row, TAC_W characters: '.' ground, '#' void (no hex is drawn there, nobody stands or flies there),
   *  'W' water truly painted under the hex (the surf a diver goes through). Odd rows' last hex is off the field. */
  mask: readonly string[];
}

/** The paintings' size (all of field_*.webp). */
export const FIELD_ART = { w: 1672, h: 941 } as const;

const G = '...........'; // a whole row of ground (an odd row's last hex is cut off by the field itself)

/** Looked at painting by painting (2026-10-27, tools: the grid drawn over each at its box). */
export const FIELD_MAPS: Record<string, FieldMap> = {
  // A dark beach: the sand from the driftwood line down to the foot of the painting; the jungle's rocks to the left,
  // the surf and the palms to the right lie outside the box.
  tropical: { x0: 0.2, y0: 0.2, gw: 0.6, mask: [G, G, G, G, G, G, G, G, G] },
  // A tidal rock shelf: the broken shelf under the breakers above, the barnacled rocks at the foot; a tide pool under
  // the hex at the left of the seventh row, the barnacle heap in the corner below it.
  rocky: { x0: 0.175, y0: 0.14, gw: 0.65, mask: [G, G, G, G, G, G, G, 'W..........', '#..........'] },
  // Black lava flats: the crags at the foot of the left edge.
  volcanic: { x0: 0.2, y0: 0.2, gw: 0.6, mask: [G, G, G, G, G, G, G, G, '#..........'] },
  // A mangrove marsh: the mud between the roots; the pond at the left of the second row and the pool right of the
  // middle are water.
  swamp: { x0: 0.21, y0: 0.22, gw: 0.58, mask: [G, 'W..........', G, G, '.......W...', G, G, G, G] },
  // The ship graveyard's yard: the mud inside the fence, the gate and the lanterns above it.
  graveyard: { x0: 0.21, y0: 0.22, gw: 0.58, mask: [G, G, G, G, G, G, G, G, G] },
  // The Choir's dead isle: the cracked ash; the driftwood heap at the foot of the left edge.
  dead: { x0: 0.2, y0: 0.2, gw: 0.6, mask: [G, G, G, G, G, G, G, G, '#..........'] },
  // The fort's courtyard (the Colosseum's sand): the flagstones under the wall; the gallows' foot and its barrels at
  // the top right, and the same at the top left (a bout is the same seen from either side).
  fort: { x0: 0.22, y0: 0.26, gw: 0.56, mask: ['##.......##', G, G, G, G, G, G, G, G] },
};

/** The field's painting for a battle's ground ('arena' → the fort). */
export const fieldArt = (type: string): string => (type === 'arena' ? 'fort' : type);
/** The map of a ground, the rocky shelf's for one not drawn. */
export function fieldMap(type: string): FieldMap {
  return FIELD_MAPS[fieldArt(type)] ?? FIELD_MAPS.rocky;
}

/** The cells a battle ashore starts from: ground, the void and the painted water, by the map. */
export function fieldCells(type: string): TacCell[] {
  const m = fieldMap(type);
  const cells: TacCell[] = Array.from({ length: TAC_W * TAC_H }, () => '.');
  for (let y = 0; y < TAC_H; y++) for (let x = 0; x < TAC_W; x++) {
    const c = (y & 1) && x === TAC_W - 1 ? '#' : m.mask[y]?.[x] ?? '.';
    cells[hexIndex(x, y)] = c === '#' || c === 'W' ? c : '.';
  }
  return cells;
}

/** The board's box on the painting in its pixels: the painting is laid at `k` screen px to its px. Board size is in
 *  hex widths: `bw` = TAC_W, `bh` its depth. */
export function fieldBox(type: string): { x: number; y: number; w: number } {
  const m = fieldMap(type);
  return { x: m.x0 * FIELD_ART.w, y: m.y0 * FIELD_ART.h, w: m.gw * FIELD_ART.w };
}
