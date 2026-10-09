// docs/19 E4–E8: the twelve citadels of the Throne war. Two in each of the six wild seas (the Crown's coast and the trade
// artery keep none), each on a great island of its sea's deepest squares, by the world's seed alone: the first a citadel
// of ⚓10, the second a fort of ⚓9. A citadel stands behind its walls (the siege of tacbattle.ts: a wall line with its
// gate and two arrow towers, a moat), held by a garrison of the sixth and seventh tiers under a castellan; a guild that
// takes it holds its sea's tax, a titan a week for its captains, the Throne war's points and its flag on the charts —
// and keeps it with what its captains leave in the garrison. It is besieged only in its two windows a week, announced.
// Everything here is a function of the world and the clock, the same for the server, the client and the balance tools.

import { UNITS, armyForLevel, armyWeight } from './army.ts';
import type { ArmyStack, UnitId } from './army.ts';
import { RAID_REF } from './abyssraid.ts';
import { buildAdv, offshore } from './advmap.ts';
import type { CaptainId } from './captains.ts';
import type { Tr } from './estate.ts';
import { buildMines } from './mines.ts';
import { seaHourOf } from './seamarks.ts';
import { pointInPolygon } from '../math.ts';
import { hashString } from '../rng.ts';
import { isleType } from '../world/archipelago.ts';
import type { RegionId } from '../world/regions.ts';
import { sectorAt } from '../world/sectors.ts';
import { legacyIslands, legacyWorld } from '../world/worldgen.ts';
import type { Island, World } from '../world/worldgen.ts';

/** The six seas that keep two citadels each (the Crown's Black Coast and Gravewater, the trade artery, keep none). On the
 *  game's seed only the Drowned Crown and the Abyss have squares of ⚓9–10: a citadel stands in the deepest squares of its
 *  own sea, and its garrison is of ⚓9–10 whatever the water about it. */
export const CIT_REGIONS: RegionId[] = ['whispering', 'leviathan_reach', 'ashen_isles', 'dead_mans_expanse', 'drowned_crown', 'the_abyss'];
export const CITADELS = 12;
/** An island great enough to carry a citadel, and the second of a sea at least this far from the first. */
export const CIT_MIN_RADIUS = 300;
export const CIT_APART = 8000;
/** Within this of a citadel's anchorage a captain may declare, assault, leave men and hire its titan. */
export const CIT_RANGE = 1200;

export interface CitadelDef {
  id: number;
  region: RegionId;
  /** Its island (an index of the world's islands, as she stood before docs/18 III), her name, her kind of ground. */
  island: number;
  isle: string;
  type: string;
  /** The anchorage before its gate, and the fort on the island. */
  x: number;
  y: number;
  fx: number;
  fy: number;
  level: 9 | 10;
}

const cache = new WeakMap<World, CitadelDef[]>();
/** The islands a citadel stands on (nobody rents, claims or builds on them). */
const citIslands = new WeakSet<Island>();
export const isCitadelIsland = (isl: Island): boolean => citIslands.has(isl);

/** The twelve citadels of a world (the same for every call). */
export function buildCitadels(world: World): CitadelDef[] {
  const hit = cache.get(world);
  if (hit) return hit;
  const base = legacyWorld(world);
  const adv = buildAdv(world);
  const taken: [number, number][] = [...adv.objs.map((o) => [o.x, o.y] as [number, number]), ...adv.guards.map((g) => [g.x, g.y] as [number, number]), ...buildMines(world).map((m) => [m.x, m.y] as [number, number])];
  const ports = base.ports.filter((p) => !p.raft);
  const out: CitadelDef[] = [];
  for (const region of CIT_REGIONS) {
    const list = legacyIslands(base).filter((is) => is.region === region && !is.portId && !is.minor && !is.raft && !is.hidden && !is.isle && !is.slot && is.radius >= CIT_MIN_RADIUS
      && !is.features.includes('lighthouse') && ports.every((p) => Math.hypot(p.x - is.x, p.y - is.y) > is.radius + 2500));
    const lv = (is: Island) => sectorAt(base, is.x, is.y).level;
    list.sort((a, b) => lv(b) - lv(a) || b.radius - a.radius || hashString(`cit:${base.seed}:${a.id}`) - hashString(`cit:${base.seed}:${b.id}`));
    const picked: CitadelDef[] = [];
    for (const is of list) {
      if (picked.length >= 2) break;
      if (picked.some((c) => Math.hypot(c.x - is.x, c.y - is.y) < CIT_APART)) continue;
      const at = anchorage(base, is, taken);
      if (!at) continue;
      picked.push({
        id: out.length + picked.length, region, island: is.id, isle: is.name, type: isleType(is), x: at[0], y: at[1], fx: at[2], fy: at[3], level: picked.length ? 9 : 10,
      });
    }
    out.push(...picked);
  }
  for (const c of out) for (const w of [world, base]) if (w.islands[c.island]) citIslands.add(w.islands[c.island]);
  cache.set(world, out);
  return out;
}

/** The water before the citadel's gate (clear of the adventure map, the mines and the ports) and its fort on the shore
 *  behind it: the first of twelve bearings round the island, from one of her own. */
function anchorage(world: World, is: Island, taken: readonly [number, number][]): [number, number, number, number] | null {
  const a0 = (hashString(`citA:${is.id}`) % 628) / 100;
  for (let k = 0; k < 12; k++) {
    const a = a0 + (k * Math.PI) / 6;
    const p = offshore(world, is, a, 240);
    if (!p || taken.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < 700)) continue;
    // The fort: inland from the anchorage, a little past the shore.
    const dx = is.x - p[0], dy = is.y - p[1], d = Math.hypot(dx, dy) || 1;
    let shore = 0;
    while (shore < d && !pointInPolygon(p[0] + (dx / d) * shore, p[1] + (dy / d) * shore, is.poly)) shore += 15;
    const inland = Math.min(d, shore + Math.min(180, is.radius * 0.35));
    return [p[0], p[1], Math.round(p[0] + (dx / d) * inland), Math.round(p[1] + (dy / d) * inland)];
  }
  return null;
}

// ------------------------------------------------------------------ the garrison

/** A neutral citadel's garrison: H1's sixth and seventh tiers in seven stacks, weighing `CIT_WEIGHT` of the ladder's ⚓10
 *  crew in a boarding (a fort of ⚓9 a fifth less), the men found to the weight (as the Abyss's tiers are). */
export const CIT_STACKS: { u: UnitId; share: number }[] = [
  { u: 'life_guard', share: 0.18 }, { u: 'deep_spawn', share: 0.14 }, { u: 'guard', share: 0.16 }, { u: 'drowned', share: 0.16 },
  { u: 'life_guard', share: 0.13 }, { u: 'deep_spawn', share: 0.1 }, { u: 'drowned', share: 0.13 },
];
/** balance: tests/balance/citadels.ts — a lone geared captain of the cap never takes a full garrison in her one assault;
 *  three of them now and then, five most times. */
export const CIT_WEIGHT = 4.2;
export const CIT_LEVEL_MUL: Record<9 | 10, number> = { 9: 0.8, 10: 1 };
/** An owned citadel's own guard (the castellan's men, filled again each week): this share of a neutral one's. */
export const CIT_OWN = 0.4;

function garrisonOf(men: number): ArmyStack[] {
  return CIT_STACKS.map((x) => ({ u: x.u, n: Math.max(1, Math.round(men * x.share)) }));
}

const garrisons = new Map<number, ArmyStack[]>();

/** A neutral citadel's full garrison at its level (× `mul`: the own guard of an owned one, the tools' trials). */
export function citGarrison(level: 9 | 10, mul = 1): ArmyStack[] {
  const want = CIT_WEIGHT * CIT_LEVEL_MUL[level] * RAID_REF;
  let g = garrisons.get(level);
  if (!g) {
    let lo = 10, hi = 20000;
    while (hi - lo > 2) {
      const mid = Math.round((lo + hi) / 2);
      if (armyWeight(garrisonOf(mid)) < want) lo = mid;
      else hi = mid;
    }
    garrisons.set(level, (g = garrisonOf(hi)));
  }
  return g.map((x) => ({ u: x.u, n: Math.max(1, Math.round(x.n * mul)) }));
}

/** Two stacks of a kind gathered into one (in place): a garrison held by a guild keeps a stack a kind, so its
 *  captains' men have room beside the castellan's. */
export function gatherGarrison(g: ArmyStack[]): ArmyStack[] {
  const out: ArmyStack[] = [];
  for (const x of g) {
    const same = out.find((y) => y.u === x.u);
    if (same) same.n += x.n;
    else if (x.n > 0) out.push({ ...x });
  }
  g.splice(0, g.length, ...out);
  return g;
}

/** Men into a garrison of at most seven stacks: into the stack of their kind, or a free slot (two stacks of a kind
 *  gathered to make one); false when seven kinds stand there already. */
export function addToGarrison(g: ArmyStack[], u: UnitId, n: number): boolean {
  if (!(n > 0)) return false;
  const same = g.find((x) => x.u === u);
  if (same) same.n += n;
  else {
    if (g.length >= 7) gatherGarrison(g);
    if (g.length >= 7) return false;
    g.push({ u, n });
  }
  return true;
}

// ------------------------------------------------------------------ the castellan

let crewHp = 0;
/** The hit points a castellan's orders are reckoned from (tacbattle.ts spellPower): the ladder's crew of her level —
 *  she commands a garrison many times a captain's, but her orders are a captain's. */
export function citSpellHp(level: 9 | 10): number {
  crewHp ||= armyForLevel(10, 600, 7, 'player').reduce((a, x) => a + x.n * UNITS[x.u].hp, 0);
  return Math.round(crewHp * CIT_LEVEL_MUL[level]);
}

export interface CastellanDef {
  path: CaptainId;
  name: Tr;
  prim: number;
  rank: 2 | 3;
  book: number;
}

/** The twelve castellans' names, a citadel's own by its index (English, Russian). */
export const CASTELLAN_NAMES: Tr[] = [
  ['Castellan Varro', 'Кастелян Варро'], ['Castellan Mirelle', 'Кастелянша Мирель'], ['Castellan Hask', 'Кастелян Хаск'], ['Castellan Odile', 'Кастелянша Одиль'],
  ['Castellan Brannoc', 'Кастелян Браннок'], ['Castellan Sabeth', 'Кастелянша Сабет'], ['Castellan Teodor', 'Кастелян Теодор'], ['Castellan Ysolde', 'Кастелянша Изольда'],
  ['Castellan Gaunt', 'Кастелян Гонт'], ['Castellan Rhoswen', 'Кастелянша Росвен'], ['Castellan Malk', 'Кастелян Мальк'], ['Castellan Ilse', 'Кастелянша Ильзе'],
];

/** The castellan of each citadel (by its index): the path she walks, her name, primaries over the cap's, the rank of her
 *  skills and the share of the book she carries. */
export function castellanOf(id: number, level: 9 | 10): CastellanDef {
  const paths: CaptainId[] = ['admiral', 'corsair', 'drowned', 'navigator', 'reaver', 'smuggler'];
  return { path: paths[id % paths.length], name: CASTELLAN_NAMES[id % CASTELLAN_NAMES.length], prim: level === 10 ? 4 : 2, rank: 2, book: level === 10 ? 0.4 : 0.3 };
}

// ------------------------------------------------------------------ the siege

/** A tower's shot in hit points, before her stack's defence: a share of the ladder's ⚓10 crew's (balance: the siege of a
 *  garrison as strong as the attacker goes to the attacker 35–45% of the time, docs/19 E17). */
export const CIT_TOWER = 75;
/** Under the Masters of the Throne (the last season's winner): a stone more in every part of the wall line, the
 *  towers this much harder. */
export const CIT_WARD = { hp: 1, tower: 1.3 } as const;

/** The broadside's balls on the wall before the assault: a ball a fifth of her guns' weight a side (gunsPerSide by the
 *  guns' harm), four at the most. */
export function citBombard(gunsPerSide: number, gunMul: number): number {
  return Math.max(0, Math.min(4, Math.floor((gunsPerSide * gunMul) / 12)));
}

// ------------------------------------------------------------------ the windows

export const CIT_WEEK_MS = 7 * 86_400_000;
/** The wall clock's week, as the empires count it (a Monday). */
export const CIT_WEEK_EPOCH = Date.UTC(2026, 0, 5);
export const CIT_WINDOW_MS = 2 * 3_600_000;
/** A siege is declared at least this long before its window opens: the defenders' time to gather. */
export const CIT_NOTICE_MS = 3_600_000;

/** A citadel's two windows in a week (wall ms): on two days three or four apart, in the evening (UTC 16–21, Moscow
 *  19–24), each two hours. */
export function citWindows(id: number, week: number): { start: number; end: number }[] {
  const d1 = (id * 3) % 7, d2 = (d1 + 3 + (id % 2)) % 7;
  const hour = 16 + ((id * 5) % 6);
  return [d1, d2].sort((a, b) => a - b).map((d) => {
    const start = CIT_WEEK_EPOCH + week * CIT_WEEK_MS + d * 86_400_000 + hour * 3_600_000;
    return { start, end: start + CIT_WINDOW_MS };
  });
}

export const citWeek = (wall: number): number => Math.floor((wall - CIT_WEEK_EPOCH) / CIT_WEEK_MS);

/** The window open at `wall` (null: none), and the first that opens after it at least `lead` ms on. */
export function citWindowAt(id: number, wall: number): { start: number; end: number } | null {
  const w = citWeek(wall);
  for (const x of [...citWindows(id, w - 1), ...citWindows(id, w)]) if (wall >= x.start && wall < x.end) return x;
  return null;
}
export function citNextWindow(id: number, wall: number, lead = 0): { start: number; end: number } {
  const w = citWeek(wall);
  for (const x of [...citWindows(id, w), ...citWindows(id, w + 1), ...citWindows(id, w + 2)]) if (x.start >= wall + lead) return x;
  return citWindows(id, w + 3)[0];
}

// ------------------------------------------------------------------ what holding one brings

/** The sea's tax a citadel pays its guild's treasury each hour held: a tenth of an hour at sea at its level. */
export const citTax = (level: 9 | 10): number => Math.round(seaHourOf(level) * 0.1);
/** The Throne war's points: each hour a citadel is held, its taking, a siege thrown back in its window. */
export const CIT_POINTS = { hour: { 9: 1, 10: 2 } as Record<9 | 10, number>, take: 60, hold: 25 } as const;
/** The citadel's titan: one a week to its guild's captains, at the Grail's price. */
export const CIT_TITAN_WEEKLY = 1;
/** The Masters of the Throne's pennant: the season's winner flies it. */
export const THRONE_PENNANT = '#b88a2c';
export const THRONE_TITLE: Tr = ['Masters of the Throne', 'Хозяева Престола'];

/** A guild's colour on the charts (by its tag): a muted heraldic hue. */
export function guildColour(tag: string): string {
  const hues = [8, 32, 48, 140, 190, 215, 265, 300, 350];
  const h = hues[hashString(`tag:${tag}`) % hues.length];
  return `hsl(${h}, 42%, 58%)`;
}

// ------------------------------------------------------------------ the views

/** A citadel as every chart shows it. */
export interface CitMark {
  id: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
  level: 9 | 10;
  region: RegionId;
  isle: string;
  /** Its guild's tag and name (none: the castellan's own). */
  tag?: string;
  guild?: string;
  /** The Masters of the Throne hold it. */
  crown?: boolean;
  /** A window open now; the guild besieging it now (its tag). */
  open?: boolean;
  siege?: string;
}

export interface CitRow extends CitMark {
  /** Her guild holds it. */
  mine?: boolean;
  garrison: { u: UnitId; n: number }[];
  /** What stands of a full neutral garrison (%). */
  share: number;
  /** The wall line as the last assault of the siege left it. */
  hp: number[];
  max: number[];
  /** The window open now or the next (wall ms), and the next two. */
  windows: { start: number; end: number }[];
  /** A siege declared on it: by whom, for which window, the captains who have assaulted, one aboard now. */
  siegeOf?: { tag: string; guild: string; start: number; end: number; assaults: string[]; fighting?: string; mine?: boolean };
  /** Her distance from its anchorage (m). */
  d: number;
  /** Why she may not declare, assault, leave men or hire its titan now (null: she may). */
  why: { declare: string | null; assault: string | null; leave: string | null; titan: string | null };
  /** Its titan this week: still to be hired. */
  titan: boolean;
  tax: number;
  points: number;
}

export interface CitView {
  rows: CitRow[];
  /** Her guild and its place in the war. */
  guild: { tag: string; name: string; points: number; place: number } | null;
  /** The Throne war's table this season: guilds by points, the citadels each holds. */
  war: { tag: string; name: string; points: number; cits: number; you?: boolean }[];
  /** The last season's Masters of the Throne. */
  champion?: { tag: string; name: string; season: number };
  season: number;
  /** Seconds to the season's end. */
  endsIn: number;
  /** Her army (to leave men in her guild's citadel she lies off). */
  army: { u: UnitId; n: number }[];
}

/** The citadels' words the client and the server share (English, Russian). */
export const CIT_NAME: Tr = ['Citadel of {isle}', 'Цитадель {isle}'];
export const FORT_NAME: Tr = ['Fort of {isle}', 'Форт {isle}'];
export const citName = (c: { level: 9 | 10; isle: string }, ru: 0 | 1, isle = c.isle): string => (c.level === 10 ? CIT_NAME : FORT_NAME)[ru].replace('{isle}', isle);

