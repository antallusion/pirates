// What stands on a boarding's decks and what spans the water between them (owner, 2026-10-18: «Предметы на палубах
// должны появляться рандомно всегда, и их не должно быть много, чтобы было интересно»; the boarding pack of 13
// gangplanks and 46 deck props, tools/art/board_pack.py). Laid by the server from the battle's seed (tacbattle.ts
// makeField, newBattle) and sent in the view, so both captains of a fight see one deck.
//
// Each deck keeps her mast and her guns at the bow and the stern; the rest is drawn anew every battle — a FEW more
// things (DECK_PROPS.items) and a little clutter (DECK_PROPS.decor), six at most beside the mast:
//   - cover ('Q': a barricade — sandbags, shields, an overturned table, a wall of barrels; and the barrels 'B', the
//     crates 'K', the gun 'C' and the mast 'M' as before): no way through it, and a shot at a stack beside it on the
//     shooter's side or behind it on the shot's line does TAC_DECK_COVER of its harm (shared deckCover);
//   - an obstacle ('L': a capstan, a ship's wheel, a stove, a rowboat …): no way through it, no cover;
//   - clutter (a coil of rope, a bucket, a grate, nets …): drawn on an open hex and nothing else — a stack stands on it.
// The cells are mirrored (the right deck the left's, as the field always was), so neither side gets the better
// ground; the pictures are each deck's own, by her ship (DeckTheme): the cursed and the drowned for a ghost, the rich
// for a treasure hull, cargo for a trader or a hauler, cover for a warship.

import { Rng } from '../rng.ts';
import { TAC_BLOCKING, TAC_GAP, TAC_H, TAC_W, deployZone, hexIndex, hexMirror, hexNeighbors, hexX, hexY, tacFlagHex } from './tactical.ts';
import type { TacCell } from './tactical.ts';

/** A ship's deck dressing. */
export type DeckTheme = 'war' | 'cargo' | 'rich' | 'cursed' | 'plain';
/** What a hex shows: its hex and its art (an asset id under `prop.`). */
export interface TacProp {
  h: number;
  a: string;
}

/** How many things a deck carries beyond her mast and her two guns (each side the same: the cells are mirrored), the
 *  clutter on each deck (its own; `most` things a deck beside her mast, the guns among them), and how open the deck
 *  must stay. */
export const DECK_PROPS = {
  // (1–2 as the barrels and crates were before: the decks block as much as they did — a third thing on a deck took the
  //  Smugglers' boardings at level 15 from 48% to 42–45% against all paths, tests/balance/paths-balance)
  items: [1, 2] as const,
  decor: [1, 2] as const,
  most: 6,
  /** Of the items: the share that is cover ('Q', 'B', 'K'), the rest obstacles ('L'). */
  cover: 0.7,
  /** The hexes of a side's deployment columns left open at the least (TAC_DEPLOY: 3 columns of 9). */
  deployMin: 22,
} as const;

/** The pictures of each kind of thing by the ship's dressing (asset ids under `prop.`). `bt_*` are the battle's first
 *  props; `bd_*` the boarding pack's. */
export const DECK_ART: Record<'Q' | 'B' | 'K' | 'L' | 'C' | 'd', Record<DeckTheme, readonly string[]>> = {
  Q: {
    war: ['bd_sandbags', 'bd_shields', 'bd_barrel_wall', 'bd_table'],
    cargo: ['bd_barrel_wall', 'bd_sacks', 'bd_lumber', 'bd_table'],
    rich: ['bd_silk', 'bd_table', 'bd_barrel_wall', 'bd_sacks'],
    cursed: ['bd_wreckage', 'bd_table', 'bd_barrel_wall'],
    plain: ['bd_barrel_wall', 'bd_table', 'bd_sandbags', 'bd_shields', 'bd_lumber'],
  },
  B: {
    war: ['bt_barrels', 'bd_powder'],
    cargo: ['bt_barrels', 'bd_rum_rack'],
    rich: ['bd_rum_rack', 'bt_barrels'],
    cursed: ['bd_coral_barrels', 'bd_ice_barrels', 'bd_fire_barrel', 'bd_fuse_keg'],
    plain: ['bt_barrels', 'bd_powder', 'bd_rum_rack'],
  },
  K: {
    war: ['bt_crates', 'bd_musket_crate', 'bd_shot'],
    cargo: ['bt_crates', 'bd_musket_crate', 'bd_coop'],
    rich: ['bd_gold_chest', 'bd_chest', 'bt_crates'],
    cursed: ['bd_kelp_crates', 'bd_chest'],
    plain: ['bt_crates', 'bd_chest', 'bd_shot'],
  },
  L: {
    war: ['bd_capstan', 'bd_swivel', 'bd_arms_rack', 'bd_bell', 'bd_wheel', 'bd_yard'],
    cargo: ['bd_capstan', 'bd_stove', 'bd_rowboat', 'bd_wheel', 'bd_binnacle'],
    rich: ['bd_mermaid', 'bd_binnacle', 'bd_wheel', 'bd_bell', 'bd_capstan', 'bd_lantern'],
    cursed: ['bd_ghost_lamp', 'bd_torn_flag', 'bd_cage', 'bd_harpoons', 'bd_stump', 'bd_mermaid', 'bd_yard'],
    plain: ['bd_capstan', 'bd_wheel', 'bd_stove', 'bd_rowboat', 'bd_lantern', 'bd_stump', 'bd_arms_rack'],
  },
  C: {
    war: ['bt_cannon'], cargo: ['bt_cannon'], rich: ['bt_cannon'], cursed: ['bd_sunk_gun', 'bt_cannon'], plain: ['bt_cannon'],
  },
  d: {
    war: ['bd_rope', 'bd_bucket', 'bd_blocks', 'bd_shot'],
    cargo: ['bd_rope', 'bd_tar', 'bd_blocks', 'bd_hammocks', 'bd_staves', 'bd_grate'],
    rich: ['bd_rope', 'bd_bucket', 'bd_hammocks', 'bd_tar'],
    cursed: ['bd_chain', 'bd_staves', 'bd_nets', 'bd_rope'],
    plain: ['bd_rope', 'bd_bucket', 'bd_nets', 'bd_tar', 'bd_chain'],
  },
};

/** A picture's greatest width and height in hex widths, where the default (1.1 × 1.2) does not suit it. */
export const PROP_SIZE: Record<string, readonly [number, number]> = {
  bd_lantern: [0.9, 1.45], bd_ghost_lamp: [0.95, 1.4], bd_bell: [1.0, 1.35], bd_binnacle: [0.85, 1.3], bd_wheel: [1.0, 1.4],
  bd_arms_rack: [1.05, 1.35], bd_torn_flag: [1.0, 1.45], bd_cage: [0.95, 1.35], bd_stump: [1.1, 1.3], bd_fire_barrel: [0.85, 1.2],
  bd_fuse_keg: [0.85, 1.2], bd_swivel: [0.95, 1.15], bd_harpoons: [1.05, 1.25], bd_rowboat: [1.25, 1.05], bd_yard: [1.3, 1.05],
  bd_mermaid: [1.25, 1.15], bd_sunk_gun: [1.25, 1.05],
};
/** Clutter is smaller than what stands: a coil of rope under a man's feet. */
export const DECOR_SIZE: readonly [number, number] = [0.72, 0.62];

/** A ship's dressing by her hull and, for a ship of the sea, her trade. */
export function deckTheme(hull?: string | null, role?: string | null): DeckTheme {
  const h = hull ?? '';
  if (role === 'ghost' || /ghost|phantom|drowned|coral|icebound|hulk|abyss|wreck|zb_gravewater|zb_dead_mans|zb_the_abyss|mimic/.test(h)) return 'cursed';
  if (/treasure|golden|gold|plate_|manila|ledger|sun_galleon|silk|spice|bazaar|indiaman|^galleon|great_galleon|lion/.test(h)) return 'rich';
  if (role === 'merchant' || role === 'fisher' || /fluyt|cog|buss|pink|holk|collier|storeship|cargo|barque|snow|hoy|tartane|carrack|pinnace|rum_runner|smuggler|fishing|whaler|turtle|ark|menagerie|whale_mother/.test(h)) return 'cargo';
  if (role === 'patrol' || role === 'hunter' || role === 'escort' || /frigate|man_o_war|line|corvette|razee|gunboat|war_|thunderer|iron|fortress|bomb|bulldog|saint_elmo|sloop_of_war|crimson|corsair|reaver|galleass|kraken_hunter|^zb_/.test(h)) return 'war';
  return 'plain';
}

/** Every walkable hex reaches a plank (a fire is no way through). */
function open(cells: readonly string[]): boolean {
  const walk = (i: number) => !TAC_BLOCKING.has(cells[i] as TacCell) && cells[i] !== 'F';
  const start = cells.indexOf('=');
  if (start < 0) return true;
  const seen = new Set<number>([start]);
  const q = [start];
  while (q.length) for (const j of hexNeighbors(q.pop()!)) if (!seen.has(j) && walk(j)) {
    seen.add(j);
    q.push(j);
  }
  for (let i = 0; i < cells.length; i++) if (walk(i) && !seen.has(i)) return false;
  return true;
}

const STANDS = new Set(['M', 'C', 'B', 'K', 'Q', 'L']);

/** The things on both decks (the left's, mirrored onto the right): the mast amidships two hexes in from the rail, the
 *  guns at the bow and the stern, DECK_PROPS.items more — cover or obstacles — in the waist (the fourth column from the rail),
 *  none beside a plank or beside another (a way round each), every hex still reaching the planks and the deployment
 *  columns left open. `cells` holds the water and the planks already. */
export function layDeck(cells: TacCell[], rng: Rng): void {
  const set = (i: number, c: TacCell) => {
    cells[i] = c;
    cells[hexMirror(i)] = c;
  };
  set(hexIndex(2, rng.pick([3, 4, 5])), 'M');
  // Her guns run in at the bow and the stern, as they always stood: they cover the back rows' corners (a deck without
  // the one or the other swung the ladder's boardings at ⚓5 from 45% to 37%, tests/heroes6).
  set(hexIndex(2, 0), 'C');
  set(hexIndex(2, TAC_H - 1), 'C');
  let n = rng.int(DECK_PROPS.items[0], DECK_PROPS.items[1]);
  for (let tries = 0; n > 0 && tries < 60; tries++) {
    // (the waist — the fourth column from the rail, between the bow's and the stern's rows — where the barrels and the
    //  crates always stood: anywhere in the second and third columns took the Smugglers' boardings against the Reavers
    //  at level 15 from 38% to 31% in tools/balance-paths.ts --check)
    const i = hexIndex(3, rng.int(1, TAC_H - 2));
    const kind: TacCell = rng.chance(DECK_PROPS.cover) ? rng.pick(['Q', 'Q', 'B', 'K'] as const) : 'L';
    if (cells[i] !== '.' || hexNeighbors(i).some((j) => cells[j] === '=' || STANDS.has(cells[j]))) continue;
    set(i, kind);
    if (!open(cells) || deployZone(cells, 0).length < DECK_PROPS.deployMin) {
      set(i, '.');
      continue;
    }
    n--;
  }
}

/** Each deck's pictures for what stands on it, by her dressing, and her clutter on a few open hexes (never on a plank,
 *  a flag's hex, beside a plank or beside what stands). Run once the guns' holes and fires are on the deck. */
export function dressDeck(cells: readonly string[], seed: number, themes: readonly [DeckTheme, DeckTheme]): TacProp[] {
  const out: TacProp[] = [];
  for (const side of [0, 1] as const) {
    const rng = new Rng((seed ^ (side ? 0xdec2 : 0xdec1)) >>> 0);
    const th = themes[side];
    const mine = (i: number) => (side ? hexX(i) > TAC_GAP : hexX(i) < TAC_GAP);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!mine(i) || c === 'M') continue;
      const pool = (DECK_ART as Record<string, Record<DeckTheme, readonly string[]>>)[c]?.[th];
      if (pool) out.push({ h: i, a: rng.pick(pool) });
    }
    const stands = out.filter((p) => mine(p.h)).length;
    let n = Math.min(rng.int(DECK_PROPS.decor[0], DECK_PROPS.decor[1]), DECK_PROPS.most - stands);
    const used = new Set<string>();
    const flags = [tacFlagHex(0), tacFlagHex(1)];
    for (let tries = 0; n > 0 && tries < 40; tries++) {
      const l = hexIndex(rng.int(1, 3), rng.int(0, TAC_H - 1));
      const i = side ? hexMirror(l) : l;
      if (cells[i] !== '.' || flags.includes(i) || out.some((p) => p.h === i) || hexNeighbors(i).some((j) => cells[j] === '=' || STANDS.has(cells[j]) || out.some((p) => p.h === j))) continue;
      const pool = DECK_ART.d[th].filter((a) => !used.has(a));
      const a = rng.pick(pool.length ? pool : DECK_ART.d[th]);
      used.add(a);
      out.push({ h: i, a });
      n--;
    }
  }
  return out.sort((p, q) => p.h - q.h);
}

/** The boarding pack's gangplanks: their art (under `prop.`) and their length over their width as cut. */
export const PLANKS: readonly { a: string; r: number }[] = [
  { a: 'plank_w1', r: 4.15 }, { a: 'plank_w2', r: 4.08 }, { a: 'plank_w3', r: 3.41 }, { a: 'plank_w4', r: 3.82 },
  { a: 'plank_w5', r: 3.36 }, { a: 'plank_w6', r: 3.4 },
  { a: 'plank_l1', r: 5.03 }, { a: 'plank_l2', r: 5.89 }, { a: 'plank_l3', r: 3.89 }, { a: 'plank_l4', r: 4.86 },
  { a: 'plank_l5', r: 4.49 }, { a: 'plank_l6', r: 4.56 }, { a: 'plank_l7', r: 3.82 },
];
/** A gangway as drawn: from 0.45 of a hex onto one deck, across `span` hexes of water, to 0.45 onto the other; its width
 *  across the row (the picture's own at that length, a little taller — `stretch` — and held within `minWidth`–`maxWidth`
 *  of a hex: the boards themselves are about two thirds of a picture's height, the rest its hooks, ropes and weed). Shared
 *  by the field (client/src/ui/tactical.ts) and the choice below. */
export const PLANK_DRAW = { over: 0.45, width: 0.52, stretch: 1.15, minWidth: 0.5, maxWidth: 0.72 } as const;
/** The length over the width a gangway of `span` water hexes is drawn at. */
export function plankWant(span: number): number {
  return (span + PLANK_DRAW.over * 2) / PLANK_DRAW.width;
}
/** The gangplank a run of `span` plank hexes takes in a battle (by its seed): one whose own proportion lies near the
 *  run's — the short broad ones for a hex of water, the long ones for a longer reach. */
export function plankArt(seed: number, span: number): string {
  const want = plankWant(Math.max(1, span));
  const pool = PLANKS.filter((p) => p.r >= want * 0.8 && p.r <= want * 1.4);
  const rng = new Rng((seed ^ 0x9a4c) >>> 0);
  rng.float();
  return rng.pick(pool.length ? pool : PLANKS).a;
}
/** The planks of a field as runs along their rows: each run's first hex, its length in hexes, its art. */
export function plankRuns(cells: readonly string[], seed: number): TacProp[] {
  const out: TacProp[] = [];
  for (let y = 0; y < TAC_H; y++) {
    for (let x = 0; x < TAC_W; x++) {
      const i = hexIndex(x, y);
      if (cells[i] !== '=' || (x > 0 && cells[hexIndex(x - 1, y)] === '=')) continue;
      let span = 1;
      while (x + span < TAC_W && cells[hexIndex(x + span, y)] === '=') span++;
      out.push({ h: i, a: plankArt(seed, span) });
    }
  }
  return out;
}
/** A run's length in hexes from its first hex. */
export function plankSpan(cells: ArrayLike<string>, first: number): number {
  let n = 1;
  while (hexX(first) + n < TAC_W && cells[hexIndex(hexX(first) + n, hexY(first))] === '=') n++;
  return n;
}
