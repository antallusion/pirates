// Ship levels and the ladder of strength (canon D12, docs/12 §3): every hull has a level ⚓1–⚓10 that all can see.
// A new hull comes at the lowest level of her class; a refit at a yard raises her one level at a time, up to the
// highest of her class; beyond that only a bigger hull goes. Each level multiplies a ship's budget of strength by
// 1.3 (+14% hull, +14% gun damage). Between two captains the ladder is hard: a lone junior never beats a senior —
// his shot is cut by the gap, he makes no criticals, cannot board, and cannot bring her below a floor of hull and
// crew. Against the sea's own ships the ladder is softer: a perfect captain beats one a level above now and then.
// A merchant fights two levels below her own, a fisher one — but carries far more.

import { SHIP_CLASSES } from './ships.ts';
import type { ShipClassId } from './ships.ts';

export const SHIP_LEVEL_MIN = 1;
export const SHIP_LEVEL_MAX = 10;

export type HullRole = 'war' | 'all' | 'trade' | 'fish' | 'special' | 'beast';

/** Each hull's levels: the one she comes at and the highest a refit takes her. */
export const LEVEL_RANGE: Partial<Record<ShipClassId, [number, number]>> = {
  sloop: [1, 3],
  cutter: [1, 3],
  fireship: [1, 2],
  schooner: [3, 5],
  xebec: [3, 5],
  fluyt: [3, 5],
  fishing_ketch: [3, 5],
  harpoon_whaler: [3, 5],
  brigantine: [4, 6],
  brig: [5, 7],
  bomb_ketch: [5, 7],
  frigate: [6, 8],
  galleon: [7, 9],
  ghost_ship: [7, 10],
  man_o_war: [9, 10],
  // The fleet of eighty (owner, 2026-10-03; docs/02 §1.A.9): a new hull has the levels of the old hulls of her tier —
  // the first tier ⚓1–3, the second ⚓3–5 (the war galley a brigantine's ⚓4–6), the third ⚓5–7, the fourth a
  // galleon's ⚓7–9, the fifth a man-o'-war's ⚓9–10. A premium hull's are her tier's, as is the captain she asks.
  gunboat: [1, 3], tartane: [1, 3], hoy: [1, 3], pinnace: [1, 3], felucca: [1, 3], lugger: [1, 3], flying_fish: [1, 3], cog: [1, 3], buss: [1, 3],
  snow: [3, 5], barque: [3, 5], spice_dhow: [3, 5], smugglers_lugger: [3, 5], rum_runner: [3, 5], galiot: [3, 5], topsail_schooner: [3, 5],
  wind_dancer: [3, 5], shark_cutter: [3, 5], mermaid_grace: [3, 5], pink: [3, 5], holk: [3, 5], collier: [3, 5], war_galley: [4, 6],
  corvette: [5, 7], dragon_junk: [5, 7], phantom_brig: [5, 7], carrack: [5, 7], silk_junk: [5, 7], pearl_schooner: [5, 7], tea_clipper: [5, 7],
  treasure_fluyt: [5, 7], baltimore_clipper: [5, 7], sea_hawk: [5, 7], albatross_xebec: [5, 7], storm_petrel: [5, 7], viper: [5, 7],
  storeship: [5, 7], cargo_frigate: [5, 7],
  razee: [7, 9], black_corsair: [7, 9], iron_ram: [7, 9], thunderer: [7, 9], storm_reaver: [7, 9], east_indiaman: [7, 9], golden_carrack: [7, 9],
  floating_bazaar: [7, 9], ledger_galleon: [7, 9], ghost_clipper: [7, 9], silver_arrow: [7, 9], plate_galleon: [7, 9], turtle_barge: [7, 9],
  menagerie: [7, 9], coral_hulk: [7, 9], treasure_junk: [7, 9],
  ship_of_the_line: [9, 10], wyvern_galleass: [9, 10], kraken_hunter: [9, 10], crimson_tide: [9, 10], sun_galleon: [9, 10], great_galleon: [9, 10],
  leviathan_ark: [9, 10], floating_fortress: [9, 10], whale_mother: [9, 10], drowned_cathedral: [9, 10], pirate_haven: [9, 10], iron_whale: [9, 10],
  // The eight that make the lines whole (2026-10-04): the levels of their tiers, as every new hull's.
  sloop_of_war: [3, 5], armed_fluyt: [5, 7], polacre: [7, 9], dunkirk_frigate: [7, 9],
  great_indiaman: [9, 10], manila_galleon: [9, 10], great_xebec: [9, 10], race_galleon: [9, 10],
  // The third batch's premium hulls (2026-10-04): the levels of their tiers, as every new hull's.
  bulldog: [1, 3], lantern_sampan: [1, 3], dolphin: [1, 3], saint_elmo: [3, 5], mimic_barge: [3, 5], icebound_hulk: [5, 7],
  golden_lion: [9, 10], sailfish: [9, 10],
  // The zone bosses (docs/21): each at her sea's one level, never refitted.
  zb_black_coast: [3, 3], zb_gravewater: [5, 5], zb_whispering: [5, 5], zb_leviathan_reach: [6, 6], zb_ashen_isles: [7, 7],
  zb_dead_mans_expanse: [8, 8], zb_drowned_crown: [9, 9], zb_the_abyss: [10, 10],
  // The beasts (docs/12 P4): levels like ships', the ladder between them and a captain as between ships. The sharks from
  // ⚓1 (owner, 2026-10-07): a new captain's sea had none of her level, every shark in it a level and more above her.
  shark: [1, 6],
  orca: [3, 8],
  humpback: [4, 6],
  narwhal: [5, 7],
  sperm_whale: [6, 9],
  young_serpent: [7, 9],
  white_orca: [8, 8],
};

export const HULL_ROLE: Partial<Record<ShipClassId, HullRole>> = {
  sloop: 'all',
  schooner: 'all',
  brigantine: 'all',
  xebec: 'all',
  cutter: 'war',
  brig: 'war',
  frigate: 'war',
  bomb_ketch: 'war',
  man_o_war: 'war',
  fluyt: 'trade',
  galleon: 'trade',
  fishing_ketch: 'fish',
  harpoon_whaler: 'all',
  orca: 'beast',
  white_orca: 'beast',
  humpback: 'beast',
  sperm_whale: 'beast',
  narwhal: 'beast',
  shark: 'beast',
  young_serpent: 'beast',
  fireship: 'special',
  ghost_ship: 'special',
  // The fleet of eighty (docs/02 §1.A.9), by list: the warships fight at their level, the runners as all-rounders; the
  // traders and the haulers are merchants — two levels below theirs, with two and a half times a warship's hold.
  gunboat: 'war', war_galley: 'war', corvette: 'war', razee: 'war', ship_of_the_line: 'war', black_corsair: 'war', dragon_junk: 'war', iron_ram: 'war',
  thunderer: 'war', wyvern_galleass: 'war', kraken_hunter: 'war', crimson_tide: 'war', phantom_brig: 'war', storm_reaver: 'war', sun_galleon: 'war',
  tartane: 'trade', hoy: 'trade', pinnace: 'trade', snow: 'trade', barque: 'trade', carrack: 'trade', east_indiaman: 'trade', golden_carrack: 'trade',
  spice_dhow: 'trade', silk_junk: 'trade', smugglers_lugger: 'trade', pearl_schooner: 'trade', floating_bazaar: 'trade', rum_runner: 'trade',
  ledger_galleon: 'trade', tea_clipper: 'trade', treasure_fluyt: 'trade',
  felucca: 'all', lugger: 'all', galiot: 'all', topsail_schooner: 'all', baltimore_clipper: 'all', sea_hawk: 'all', wind_dancer: 'all', shark_cutter: 'all',
  ghost_clipper: 'all', flying_fish: 'all', albatross_xebec: 'all', silver_arrow: 'all', storm_petrel: 'all', mermaid_grace: 'all', viper: 'all',
  cog: 'trade', buss: 'trade', pink: 'trade', holk: 'trade', collier: 'trade', storeship: 'trade', cargo_frigate: 'trade', plate_galleon: 'trade',
  great_galleon: 'trade', leviathan_ark: 'trade', turtle_barge: 'trade', floating_fortress: 'trade', menagerie: 'trade', whale_mother: 'trade',
  coral_hulk: 'trade', drowned_cathedral: 'trade', treasure_junk: 'trade', pirate_haven: 'trade', iron_whale: 'trade',
  // The eight that make the lines whole (2026-10-04), by their lists.
  sloop_of_war: 'war', great_indiaman: 'trade', manila_galleon: 'trade', polacre: 'all', dunkirk_frigate: 'all', great_xebec: 'all', race_galleon: 'all',
  armed_fluyt: 'trade',
  // The third batch's premium hulls (2026-10-04), by their lists.
  bulldog: 'war', saint_elmo: 'war', lantern_sampan: 'trade', golden_lion: 'trade', dolphin: 'all', sailfish: 'all', mimic_barge: 'trade',
  icebound_hulk: 'trade',
};

/** How many levels below her own a hull of this role fights. */
const ROLE_SHIFT: Record<HullRole, number> = { war: 0, all: 0, trade: 2, fish: 1, special: 0, beast: 0 };

/** Monsters, boss parts and wreck hulks stand outside the ladder: they are balanced as raids of their own. */
export function onLadder(classId: ShipClassId): boolean {
  return LEVEL_RANGE[classId] !== undefined;
}

export function levelRange(classId: ShipClassId): [number, number] {
  return LEVEL_RANGE[classId] ?? [SHIP_LEVEL_MAX, SHIP_LEVEL_MAX];
}

export function hullRole(classId: ShipClassId): HullRole {
  return HULL_ROLE[classId] ?? 'special';
}

export function clampLevel(classId: ShipClassId, level: number): number {
  const [lo, hi] = levelRange(classId);
  return Math.max(lo, Math.min(hi, Math.round(level)));
}

/** A ship's level: what her loadout says, kept within her class. */
export function shipLevelOf(loadout: { classId: ShipClassId; level?: number }): number {
  return clampLevel(loadout.classId, loadout.level ?? levelRange(loadout.classId)[0]);
}

/** The level she fights at: a merchant two below, a fisher one below. */
export function combatLevelOf(classId: ShipClassId, level: number): number {
  return Math.max(0, level - ROLE_SHIFT[hullRole(classId)]);
}

/** A ship's budget of strength by level (1.3 per level). */
export function levelPower(level: number): number {
  return Math.pow(1.3, level - 1);
}

/** Per level above her class's first: hull and guns +14% each. */
export const LEVEL_STEP = 1.14;

/** How a level above the class's first scales a ship. */
export function levelScale(classId: ShipClassId, level: number): { hull: number; guns: number; crew: number; hold: number; speed: number } {
  if (!onLadder(classId)) return { hull: 1, guns: 1, crew: 1, hold: 1, speed: 1 };
  const up = clampLevel(classId, level) - levelRange(classId)[0];
  return { hull: Math.pow(LEVEL_STEP, up), guns: Math.pow(LEVEL_STEP, up), crew: 1 + 0.05 * up, hold: 1 + 0.05 * up, speed: 1 + 0.01 * up };
}

/** The captain's level needed to command a ship of each level (index = ship level). */
export const CAPTAIN_LEVEL_FOR_SHIP = [0, 1, 4, 8, 13, 19, 26, 33, 41, 49, 56];

export function captainLevelFor(shipLevel: number): number {
  return CAPTAIN_LEVEL_FOR_SHIP[Math.max(1, Math.min(SHIP_LEVEL_MAX, shipLevel))];
}

/** A refit up to `level`: silver, materials and the yard's time in seconds. */
export interface RefitCost {
  silver: number;
  goods: { good: 'planks' | 'iron' | 'sailcloth' | 'timber' | 'leviathan_bone' | 'sulfur_iron'; qty: number }[];
  sec: number;
  /** Hearts of the storm in her keel (docs/12 P10 #14): the tenth level wants one. */
  hearts?: number;
}

const REFIT: Record<number, RefitCost> = {
  2: { silver: 800, goods: [{ good: 'planks', qty: 40 }, { good: 'iron', qty: 10 }], sec: 120 },
  3: { silver: 2000, goods: [{ good: 'planks', qty: 80 }, { good: 'iron', qty: 20 }, { good: 'sailcloth', qty: 10 }], sec: 300 },
  4: { silver: 4500, goods: [{ good: 'planks', qty: 120 }, { good: 'iron', qty: 40 }, { good: 'sailcloth', qty: 20 }], sec: 600 },
  5: { silver: 9000, goods: [{ good: 'planks', qty: 180 }, { good: 'iron', qty: 60 }, { good: 'sailcloth', qty: 30 }], sec: 1200 },
  6: { silver: 18000, goods: [{ good: 'planks', qty: 260 }, { good: 'iron', qty: 90 }, { good: 'sailcloth', qty: 40 }, { good: 'timber', qty: 40 }], sec: 2400 },
  7: { silver: 32000, goods: [{ good: 'planks', qty: 360 }, { good: 'iron', qty: 130 }, { good: 'sailcloth', qty: 60 }, { good: 'timber', qty: 70 }], sec: 3600 },
  8: { silver: 55000, goods: [{ good: 'planks', qty: 480 }, { good: 'iron', qty: 180 }, { good: 'sailcloth', qty: 80 }, { good: 'leviathan_bone', qty: 10 }], sec: 7200 },
  9: { silver: 90000, goods: [{ good: 'planks', qty: 650 }, { good: 'iron', qty: 250 }, { good: 'sailcloth', qty: 110 }, { good: 'leviathan_bone', qty: 20 }], sec: 10800 },
  10: { silver: 150000, goods: [{ good: 'planks', qty: 900 }, { good: 'iron', qty: 320 }, { good: 'sailcloth', qty: 150 }, { good: 'leviathan_bone', qty: 30 }, { good: 'sulfur_iron', qty: 5 }], sec: 14400, hearts: 1 },
};

export function refitCost(toLevel: number): RefitCost | null {
  return REFIT[toLevel] ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// The ladder of strength.

/** What a shot from one ship does to another across a gap of levels. */
export interface LadderMods {
  /** Damage multiplier for the shooter's hull, sail and crew damage. */
  dealt: number;
  /** Multiplier on the shooter's chance of a critical (0 = none). */
  crits: number;
  /** May the shooter throw grapples? */
  board: boolean;
  /** The target's hull and crew cannot be brought below these fractions by this shooter. */
  floorHull: number;
  floorCrew: number;
}

const NONE: LadderMods = { dealt: 1, crits: 1, board: true, floorHull: 0, floorCrew: 0 };

/** Between two captains' ships: the junior's shot is cut hard and cannot finish the senior. */
const PVP_JUNIOR = [1, 0.5, 0.2, 0];
const PVP_SENIOR = [1, 1.25, 1.5, 2];
const PVP_FLOOR_HULL = [0, 0.25, 0.5, 1];
const PVP_FLOOR_CREW = [0, 0.5, 0.7, 1];
/** Against the sea's ships: softer, so a perfect captain wins now and then one level up. */
/** Tuned by the duel sims (tests/balance): a perfect captain wins about one fight in ten a level up, an average one hardly any.
 *  Re-weighed for the quick sea fight and the laid broadsides (docs/23 item 45): 0.5/0.3/0.15 let a perfect captain win
 *  two in five a level up; 0.4 still one in three once the bots fired within 30° and the fight held inside the guns'
 *  reach (item 47). */
export const PVE_JUNIOR = [1, 0.33, 0.2, 0.1];
export const PVE_SENIOR = [1, 1.2, 1.35, 1.6];
export const PVE_CRITS = [1, 0.35, 0, 0];
/** Juniors who together outweigh a ship of the sea (a company against one a level up) are cut less; three levels
 *  up she is a skull to a company too. */
export const PVE_GROUP = [1, 1, 0.6, 0.15];

/**
 * The ladder between a shooter at combat level `a` and a target at combat level `b`.
 * `pvp`: both are captains' ships. `group`: the juniors attacking together outweigh the target (between captains no
 * floor then; against the sea's ships a softer cut, a skull still floored).
 */
export function ladder(a: number, b: number, pvp: boolean, group = false): LadderMods {
  const gap = b - a;
  if (gap === 0) return NONE;
  const d = Math.min(3, Math.abs(gap));
  if (gap < 0) return { ...NONE, dealt: pvp ? PVP_SENIOR[d] : PVE_SENIOR[d] };
  if (pvp) {
    return { dealt: PVP_JUNIOR[d], crits: 0, board: false, floorHull: group ? 0 : PVP_FLOOR_HULL[d], floorCrew: group ? 0 : PVP_FLOOR_CREW[d] };
  }
  return { dealt: (group ? PVE_GROUP : PVE_JUNIOR)[d], crits: PVE_CRITS[d], board: d < 2, floorHull: d >= 3 ? 0.4 : 0, floorCrew: d >= 3 ? 0.6 : 0 };
}

/** Juniors together beat a senior when their budgets reach 1.2 of hers. */
export const GROUP_OUTWEIGHS = 1.2;

// ---------------------------------------------------------------------------------------------------------------
// Colours of danger, as WoW's: by how far the other ship stands above yours.

export type Threat = 'trivial' | 'easy' | 'even' | 'hard' | 'deadly' | 'skull';

export function threatOf(mine: number, theirs: number): Threat {
  const d = theirs - mine;
  return d <= -3 ? 'trivial' : d < 0 ? 'easy' : d === 0 ? 'even' : d === 1 ? 'hard' : d === 2 ? 'deadly' : 'skull';
}

/** Experience for a prize by how far she stood above (+) or below (−) the victor: none for a grey one. */
export function xpForGap(gap: number): number {
  return gap <= -3 ? 0 : gap === -2 ? 0.6 : gap === -1 ? 0.8 : gap === 0 ? 1 : gap === 1 ? 1.25 : gap === 2 ? 1.5 : 2;
}

export const THREAT_COLOR: Record<Threat, string> = {
  trivial: '#9d9d9d',
  easy: '#40bf40',
  even: '#f0d040',
  hard: '#ff8c1a',
  deadly: '#ff3030',
  skull: '#ff3030',
};

/** A migrated or unknown ship: the class's first level, one more when her yard fittings are nearly all in. */
export function initialLevel(classId: ShipClassId, modules: Record<string, number | undefined>): number {
  const [lo] = levelRange(classId);
  const basic = ['hull_plating', 'sail_plan', 'rudder', 'hold_expansion', 'crew_quarters'];
  const sum = basic.reduce((n, id) => n + (modules[id] ?? 0), 0);
  return clampLevel(classId, lo + (sum >= 8 ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------------------------
// The sea's own ships.

/** The levels of the sea's ships by the safety of the waters (the Abyss deepest of all). */
export function watersBand(safety: string, abyss = false): [number, number] {
  if (abyss) return [8, 10];
  return safety === 'safe' ? [1, 3] : safety === 'contested' ? [3, 6] : [5, 9];
}

/** The hulls each kind of the sea's ship sails, by level. */
const ROLE_HULLS: Record<string, ShipClassId[]> = {
  pirate: ['sloop', 'cutter', 'schooner', 'xebec', 'brigantine', 'brig', 'frigate', 'man_o_war'],
  merchant: ['sloop', 'schooner', 'fluyt', 'galleon'],
  patrol: ['cutter', 'brig', 'frigate', 'man_o_war'],
  hunter: ['brigantine', 'brig', 'frigate', 'man_o_war'],
  fisher: ['cutter', 'sloop'],
  escort: ['cutter', 'brigantine', 'brig', 'frigate'],
  ghost: ['sloop', 'brig', 'ghost_ship'],
};

/** The hulls of a role that can sail at this level (nearest levels if none). A hull sold for doubloons is never the
 *  sea's (docs/01 P7): no captain of the sea sails one, so none is ever taken as a prize. */
export function hullsFor(role: string, level: number): ShipClassId[] {
  const pool = (ROLE_HULLS[role] ?? ROLE_HULLS.pirate).filter((c) => !SHIP_CLASSES[c].premium);
  const fit = pool.filter((c) => { const [lo, hi] = levelRange(c); return level >= lo && level <= hi; });
  if (fit.length) return fit;
  const gap = (c: ShipClassId) => { const [lo, hi] = levelRange(c); return level < lo ? lo - level : level - hi; };
  const best = Math.min(...pool.map(gap));
  return pool.filter((c) => gap(c) === best);
}

/** A bot's craft by her level (docs/12 §3.3): how well she leads and ranges, how wide she lets fly, her tricks. */
export interface NpcSkill {
  /** Share of the true lead she allows for the target's way. */
  lead: number;
  /** Error of her range estimate, as a fraction. */
  rangeErr: number;
  /** She fires once the target is within this many degrees of her beam. */
  arcDeg: number;
  /** Extra spread of her shot. */
  spread: number;
  /** Seconds she needs to answer a change. */
  react: number;
  /** She dashes out of a held broadside. */
  dash: boolean;
}

/**
 * Tuned by the duel sims (tests/balance): a bot a little below an average captain of her level, so that one wins
 * about seven fights in ten against her; a little craftier the higher she sails.
 */
export function npcSkill(level: number): NpcSkill {
  // docs/23 item 36: the sea's gunners lay their broadsides on the mark now (the guns train onto her); a green crew still
  // misjudges her range and her way more than a seasoned one. Item 47: they let fly within 30° of the beam (a captain's
  // gun captains within AUTO_ARC_DEG, 36°: her edge over a bot of her level, about seven fights in ten).
  if (level <= 2) return { lead: 0.6, rangeErr: 0.12, arcDeg: 30, spread: 0.3, react: 1.4, dash: false };
  if (level <= 4) return { lead: 0.62, rangeErr: 0.12, arcDeg: 30, spread: 0.28, react: 1.3, dash: false };
  if (level <= 6) return { lead: 0.65, rangeErr: 0.12, arcDeg: 30, spread: 0.26, react: 1.2, dash: false };
  if (level <= 8) return { lead: 0.68, rangeErr: 0.12, arcDeg: 30, spread: 0.24, react: 1.1, dash: true };
  return { lead: 0.7, rangeErr: 0.12, arcDeg: 30, spread: 0.2, react: 1.0, dash: true };
}

/** An elite ⚔ (group contracts, barons): built for a company — hull ×2.5, guns ×1.5. */
// (Her hull and guns are the broadside table's now, docs/25 item 7: as a captain in full gear of her ⚓ —
// shared/src/data/seabalance.ts ELITE_SEA; they were hull ×2.5, guns ×1.5.)

/** The ship level a captain of this level is likely to sail (for quests and tasks written by captain level). */
export function shipLevelForCaptain(captainLevel: number): number {
  return Math.max(1, Math.min(SHIP_LEVEL_MAX, Math.ceil(captainLevel / 6)));
}

/** A group contract's flagship by the waters: near the top of their band (an elite on top of that). */
export function eliteShipLevel(safety: string): number {
  const [, hi] = watersBand(safety);
  return safety === 'lawless' ? hi - 1 : hi;
}

/**
 * The ship level a quest with a fight in it asks for (canon D12): by the captain's level it is written for and the
 * waters it sends you to; a group contract's flagship names her own. Null for a quest with no fight.
 */
export function questShipLevel(q: { requires: { level?: number }; steps: { type: string; role?: string; region?: string }[] }, safetyOf: (region: string) => string): number | null {
  const fights = q.steps.filter((x) => x.type === 'sink' || x.type === 'board' || x.type === 'prize' || x.type === 'fleet_win');
  if (!fights.length) return null;
  let lv = shipLevelForCaptain(q.requires.level ?? 1);
  for (const f of fights) {
    if (!f.region) continue;
    const safety = safetyOf(f.region);
    lv = Math.max(lv, f.role === 'elite' ? eliteShipLevel(safety) : watersBand(safety, f.region === 'the_abyss')[0]);
  }
  return lv;
}

/** The server's lines about ship levels and refits, English → Russian. */
export function levelPatterns(): [string, string][] {
  return [
    ['She is above your level: your boarders would not reach her deck', 'Она выше вас уровнем: ваша абордажная команда не доберётся до её палубы'],
    ['She is at the height of her class: only a bigger hull goes higher', 'Она на вершине своего класса: выше — только на корпусе крупнее'],
    ['The yard is already at work on her', 'Верфь уже работает над ней'],
    ['{0} cannot take a {1} in hand', 'Верфь порта {0} не возьмётся за корабль класса «{1}»'],
    ['A legendary ship is not rebuilt', 'Легендарный корабль не перестраивают'],
    ['A guild hull on loan is not yours to rebuild', 'Гильдейский корпус взят взаймы — перестраивать его не вам'],
    ['Captain level {0} is needed to command her at level {1}', 'Чтобы командовать ею на уровне {1}, нужен уровень капитана {0}'],
    ['Needs {0} silver', 'Нужно {0} серебра'],
    ['Needs {0} {1} (in the hold or your warehouse here)', 'Нужно: {1} — {0} (в трюме или на вашем складе в этом порту)'],
    ['The yard takes the {0} in hand: level {1} in {2} min. She stays in harbour till then.', 'Верфь берётся за «{0}»: уровень {1} через {2} мин. До тех пор она остаётся в гавани.'],
    ['The yard is still at work on her: {0} min more', 'Верфь ещё работает над ней: осталось {0} мин'],
    ['The yard is done: the {0} is level {1} now.', 'Верфь закончила: «{0}» теперь уровня {1}.'],
    ['Captain level {0} is needed to command a {1}', 'Чтобы командовать кораблём класса «{1}», нужен уровень капитана {0}'],
  ];
}
