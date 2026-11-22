// The island screen in isometry (owner, 2026-10-15: «кнопка входа на остров, нажимаешь и переходишь в отдельное абсолютно
// новое окно с постройками»; the art brief assets/future/isle_iso/HANDOFF_PROMPT.md). The island stands in the night sea
// on one of four painted maps chosen by its biome; the board of docs/29 (6 × 6 spots: the town on its two back edges,
// the base's 5 × 5 plots before it) is laid on the map's plateau through four corners set by hand for each map (the
// plateaus are not perfect diamonds, so a spot's place is found bilinearly between them). Every building's sheet has
// eight pictures — s0 the plot marked out, s1 the frame in scaffolding, l1..l5 its levels, up level 3 in scaffolding —
// and a plot of 4 × 4, 3 × 3 or 2 × 2 cells; a spot of the board is SLOT cells wide, so the biggest fill it.

import type { IslandBiome } from '../world/regions.ts';

export type IsoMap = 'temperate' | 'volcanic' | 'ice' | 'jungle' | 'dry' | 'drowned';
export type IsoStage = 's0' | 's1' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7' | 'l8' | 'l9' | 'l10' | 'up';
/** The greatest level a building's picture is asked at (docs/38: the tree's 10; a level not painted yet falls back to the
 *  highest painted one below it, isoPic). */
export const ISO_LEVELS = 10;

/** The map an island of a biome is painted on (HANDOFF_PROMPT.md §2). */
export const ISO_MAP_OF: Record<IslandBiome, IsoMap> = {
  temperate: 'temperate', mossy: 'temperate',
  volcanic: 'volcanic', blacksand: 'volcanic',
  // (their own maps since 2026-10-24: the salt flats and the bare rock on the dry one, the drowned ruins on the drowned one)
  saltflat: 'dry', barren: 'dry',
  ruins: 'drowned', bone: 'drowned', crystal: 'drowned',
  ice: 'ice',
  jungle: 'jungle', mangrove: 'jungle', atoll: 'jungle', fungal: 'jungle',
};

/** A map's picture size (px). */
export const ISO_W = 1536;
export const ISO_H = 1024;

export type Pt = [number, number];
/** A map as drawn: its biome's map at the island's size (owner 2026-11-22: «три разных острова, маленький, средний,
 *  большой»): the middling island on the biome's own picture, the small and large on their own (isle.map.<view>). */
export type IsoView = IsoMap | `${IsoMap}_small` | `${IsoMap}_large`;
/** The biome's map of a view (the sea's effects are the biome's). */
export function isoBase(view: IsoView): IsoMap {
  return view.replace(/_(small|large)$/, '') as IsoMap;
}
/** The view of an island: its size's own picture when there is one (`has`: the manifest holds isle.map.<view>). */
export function isoView(map: IsoMap, size: 'small' | 'medium' | 'large' | undefined, has: (id: string) => boolean): IsoView {
  const v = size === 'small' || size === 'large' ? (`${map}_${size}` as IsoView) : map;
  return v !== map && ISO_CORNERS[v] && has(`isle.map.${v}`) ? v : map;
}
/** The plateau's four corners on each map, in the picture's pixels: the back (top), right, front (bottom), left —
 *  set by eye inside the paving, so no building stands on the cliffs or in the sea (tests/isleiso.test.ts). */
export const ISO_CORNERS: Record<IsoMap, { t: Pt; r: Pt; b: Pt; l: Pt }> & Partial<Record<IsoView, { t: Pt; r: Pt; b: Pt; l: Pt }>> = {
  temperate: { t: [745, 200], r: [1255, 460], b: [790, 705], l: [285, 440] },
  temperate_large: { t: [738, 263], r: [1409, 605], b: [797, 928], l: [133, 579] },
  temperate_small: { t: [752, 294], r: [1109, 476], b: [783, 647], l: [430, 462] },
  volcanic: { t: [760, 180], r: [1275, 430], b: [770, 650], l: [315, 420] },
  volcanic_small: { t: [762, 280], r: [1123, 455], b: [769, 609], l: [451, 448] },
  volcanic_large: { t: [758, 237], r: [1436, 566], b: [771, 855], l: [172, 553] },
  ice: { t: [760, 228], r: [1315, 482], b: [790, 718], l: [255, 470] },
  ice_small: { t: [762, 313], r: [1151, 491], b: [783, 656], l: [409, 483] },
  ice_large: { t: [758, 300], r: [1488, 634], b: [797, 945], l: [93, 618] },
  jungle: { t: [765, 215], r: [1170, 440], b: [780, 640], l: [405, 430] },
  jungle_small: { t: [766, 304], r: [1049, 462], b: [776, 602], l: [514, 455] },
  jungle_large: { t: [764, 283], r: [1297, 579], b: [784, 842], l: [291, 566] },
  dry: { t: [757, 262], r: [1150, 415], b: [776, 598], l: [362, 420] },
  dry_small: { t: [760, 337], r: [1035, 444], b: [774, 572], l: [484, 448] },
  dry_large: { t: [754, 345], r: [1271, 546], b: [779, 787], l: [234, 553] },
  drowned: { t: [725, 205], r: [1200, 412], b: [748, 645], l: [325, 405] },
  drowned_small: { t: [738, 297], r: [1070, 442], b: [754, 605], l: [458, 437] },
  drowned_large: { t: [712, 270], r: [1337, 542], b: [742, 849], l: [186, 533] },
};

/** One cell of a plot's diamond in the baked pictures, px (tools/art/isle_iso.py UNIT). */
export const ISO_UNIT = 86;

/** The board: BOARD × BOARD spots (isletree.ts BOARD), each SLOT cells of a plot wide. */
export const ISO_BOARD = 6;
export const ISO_SLOT = 4.5;
export const ISO_CELLS = ISO_BOARD * ISO_SLOT;

/** A point of the plateau at (u, v) ∈ [0, 1]² — u along the back-right edge, v along the back-left. */
export function isoPoint(map: IsoView, u: number, v: number): Pt {
  const { t, r, b, l } = ISO_CORNERS[map] ?? ISO_CORNERS[isoBase(map)];
  const x = t[0] + u * (r[0] - t[0]) + v * (l[0] - t[0]) + u * v * (b[0] - r[0] - l[0] + t[0]);
  const y = t[1] + u * (r[1] - t[1]) + v * (l[1] - t[1]) + u * v * (b[1] - r[1] - l[1] + t[1]);
  return [x, y];
}

/** A plot's size in cells (HANDOFF_PROMPT.md §2). */
const FOOT4 = new Set(['hall', 'keep', 'fort', 'dry_dock']);
const FOOT2 = new Set(['battery', 'residents_house', 'smokehouse', 'lighthouse', 'signal_tower', 'chart_house', 'smuggler_store']);
export function isoFoot(sheet: string): 2 | 3 | 4 {
  return FOOT4.has(sheet) ? 4 : FOOT2.has(sheet) ? 2 : 3;
}

/** A thing's sheet: a producer's by its kind ('p:lumber' → lumber), a building's by its id; the pen and the Grail have
 *  none (null: drawn from their icons). */
export function isoSheet(what: string): string | null {
  if (what === 'pen' || what === 'grail') return null;
  return what.startsWith('p:') ? what.slice(2) : what;
}

/** Where a spot of the board stands: its footprint's four corners and its depth (the back first). A building of `foot`
 *  cells stands in the middle of its spot. */
export function isoSpot(map: IsoView, cell: [number, number], foot = ISO_SLOT): { t: Pt; r: Pt; b: Pt; l: Pt; z: number } {
  const [i, j] = cell;
  const pad = (ISO_SLOT - foot) / 2;
  const u0 = (i * ISO_SLOT + pad) / ISO_CELLS, u1 = (i * ISO_SLOT + pad + foot) / ISO_CELLS;
  const v0 = (j * ISO_SLOT + pad) / ISO_CELLS, v1 = (j * ISO_SLOT + pad + foot) / ISO_CELLS;
  return { t: isoPoint(map, u0, v0), r: isoPoint(map, u1, v0), b: isoPoint(map, u1, v1), l: isoPoint(map, u0, v1), z: (i + j) * 10 + i + 1 };
}

/** The picture of a building at its stage (HANDOFF_PROMPT.md §4):
 *  - founding: s0 under half done, s1 past it;
 *  - raising L → L+1: `up` (level 3 in scaffolding) from levels 2 and 3, else its level now, dimmed under the work;
 *  - standing: its level. */
export function isoStage(level: number, job: { start: number; end: number; level: number } | null, now: number): { stage: IsoStage; dim: boolean } {
  const L = Math.max(0, Math.min(ISO_LEVELS, Math.round(level)));
  if (job && (L <= 0 || job.level <= 1)) {
    const prog = (now - job.start) / Math.max(1, job.end - job.start);
    return { stage: prog < 0.5 ? 's0' : 's1', dim: false };
  }
  if (job) return L === 2 || L === 3 ? { stage: 'up', dim: false } : { stage: `l${Math.max(1, L)}` as IsoStage, dim: true };
  return { stage: `l${Math.max(1, L)}` as IsoStage, dim: false };
}

/** A building's picture id at its stage (`isle.<sheet>.<stage>`), a level not painted yet (docs/38: the levels 6..10 come
 *  sheet by sheet) as the highest painted level below it — `has` tells whether the manifest holds an id. */
export function isoPic(sheet: string, stage: IsoStage, has: (id: string) => boolean): string {
  const id = `isle.${sheet}.${stage}`;
  const m = /^l(\d+)$/.exec(stage);
  if (!m || has(id)) return id;
  for (let l = Number(m[1]) - 1; l >= 1; l--) if (has(`isle.${sheet}.l${l}`)) return `isle.${sheet}.l${l}`;
  return id;
}
