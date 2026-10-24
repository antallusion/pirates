// The island screen in isometry (owner, 2026-10-15: «кнопка входа на остров, нажимаешь и переходишь в отдельное абсолютно
// новое окно с постройками»; the art brief assets/future/isle_iso/HANDOFF_PROMPT.md). The island stands in the night sea
// on one of four painted maps chosen by its biome; the board of docs/29 (6 × 6 spots: the town on its two back edges,
// the base's 5 × 5 plots before it) is laid on the map's plateau through four corners set by hand for each map (the
// plateaus are not perfect diamonds, so a spot's place is found bilinearly between them). Every building's sheet has
// eight pictures — s0 the plot marked out, s1 the frame in scaffolding, l1..l5 its levels, up level 3 in scaffolding —
// and a plot of 4 × 4, 3 × 3 or 2 × 2 cells; a spot of the board is SLOT cells wide, so the biggest fill it.

import type { IslandBiome } from '../world/regions.ts';

export type IsoMap = 'temperate' | 'volcanic' | 'ice' | 'jungle' | 'dry' | 'drowned';
export type IsoStage = 's0' | 's1' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'up';

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
/** The plateau's four corners on each map, in the picture's pixels: the back (top), right, front (bottom), left —
 *  set by eye inside the paving, so no building stands on the cliffs or in the sea (tests/isleiso.test.ts). */
export const ISO_CORNERS: Record<IsoMap, { t: Pt; r: Pt; b: Pt; l: Pt }> = {
  temperate: { t: [745, 200], r: [1255, 460], b: [790, 705], l: [285, 440] },
  volcanic: { t: [760, 180], r: [1275, 430], b: [770, 650], l: [315, 420] },
  ice: { t: [760, 228], r: [1315, 482], b: [790, 718], l: [255, 470] },
  jungle: { t: [765, 215], r: [1170, 440], b: [780, 640], l: [405, 430] },
  dry: { t: [757, 262], r: [1150, 415], b: [776, 598], l: [362, 420] },
  drowned: { t: [725, 205], r: [1200, 412], b: [748, 645], l: [325, 405] },
};

/** One cell of a plot's diamond in the baked pictures, px (tools/art/isle_iso.py UNIT). */
export const ISO_UNIT = 86;

/** The board: BOARD × BOARD spots (isletree.ts BOARD), each SLOT cells of a plot wide. */
export const ISO_BOARD = 6;
export const ISO_SLOT = 4.5;
export const ISO_CELLS = ISO_BOARD * ISO_SLOT;

/** A point of the plateau at (u, v) ∈ [0, 1]² — u along the back-right edge, v along the back-left. */
export function isoPoint(map: IsoMap, u: number, v: number): Pt {
  const { t, r, b, l } = ISO_CORNERS[map];
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
export function isoSpot(map: IsoMap, cell: [number, number], foot = ISO_SLOT): { t: Pt; r: Pt; b: Pt; l: Pt; z: number } {
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
  const L = Math.max(0, Math.min(5, Math.round(level)));
  if (job && (L <= 0 || job.level <= 1)) {
    const prog = (now - job.start) / Math.max(1, job.end - job.start);
    return { stage: prog < 0.5 ? 's0' : 's1', dim: false };
  }
  if (job) return L === 2 || L === 3 ? { stage: 'up', dim: false } : { stage: `l${Math.max(1, L)}` as IsoStage, dim: true };
  return { stage: `l${Math.max(1, L)}` as IsoStage, dim: false };
}
