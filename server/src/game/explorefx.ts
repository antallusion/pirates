// Exploration (docs/03_TALENT_TREES.md §4.9): treasure maps and digs, legendary fragments, sunken wrecks and
// divers, wake trails, soundings, weather forecasts, the gold trail, and the edge of the map.
// The base treasure system lives here; Phase 8 adds multi-part maps, riddles and map theft on top.

import { DEG, dist, headingVec } from '../../../shared/src/math.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { cargoVolume, tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { depthAt } from '../../../shared/src/world/worldgen.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { grantDeed } from './progression.ts';
import { questEvent } from './quests.ts';
import { grantPlan } from './shipbuilding.ts';
import { digOutcome, legendCircle, legendFragment } from './treasure.ts';
import { seasonStat } from './seasons.ts';
import type { ShipEntity } from './ship.ts';

export const MAX_MAPS = 6;
export const DIG_RANGE = 250;
const BASE_RADIUS = [0, 900, 1400, 2000];
const TIER_NAMES = ['', 'Stained', 'Captain\'s', 'Legendary'];

export type MapKind = 'circle' | 'riddle' | 'drawing' | 'landmark' | 'cursed' | 'fragment' | 'player';

export interface TreasureMap {
  id: string;
  tier: number; // 1..3 (a cursed map digs as 4)
  name: string;
  region: RegionId;
  sx: number; // the true spot
  sy: number;
  ox: number; // offset of the drawn circle's centre from the spot, as a share of the radius
  oy: number;
  legendary: boolean;
  /** Phase 8 (treasure.ts): what kind of map it is; the chest every copy of it leads to. */
  kind?: MapKind;
  hoard?: string;
  clue?: string;
  island?: number; // the island the clue is about
  forged?: number; // a forgery: the forger's account (0: unknown hand)
  verdict?: 'genuine' | 'forgery';
  sealed?: boolean; // the Brokers' seal of authenticity
  copy?: boolean;
  set?: string; // a legendary fragment: its chart, its number, how many there are
  piece?: number;
  of?: number;
}

export interface SunkenWreck {
  id: number;
  name: string;
  x: number;
  y: number;
  depth: number;
  tier: number;
}

// ------------------------------------------------------------------ treasure maps

const TIER_REGIONS: RegionId[][] = [
  [],
  ['black_coast', 'gravewater', 'whispering'],
  ['gravewater', 'whispering', 'ashen_isles', 'leviathan_reach'],
  ['dead_mans_expanse', 'drowned_crown', 'ashen_isles', 'leviathan_reach'],
];

/** A spot off the shore of an island where the boats can land. */
function shoreSpot(is: Island, k: number): [number, number] {
  const n = is.poly.length / 2;
  const i = (k % n) * 2;
  const px = is.poly[i], py = is.poly[i + 1];
  const dx = px - is.x, dy = py - is.y, d = Math.hypot(dx, dy) || 1;
  // Just beyond the shoal band (90 m), so a ship can heave to on the spot without grounding.
  return [px + (dx / d) * 110, py + (dy / d) * 110];
}

export function makeMap(game: Game, tier: number, opts: { island?: Island; legendary?: boolean; kind?: MapKind } = {}): TreasureMap {
  const rng = game.rng;
  const kind = opts.kind ?? 'circle';
  let is = opts.island;
  if (!is) {
    const regions = kind === 'cursed' ? (['drowned_crown', 'the_abyss'] as RegionId[]) : TIER_REGIONS[Math.max(1, Math.min(3, tier))];
    const pool = game.world.islands.filter((i) => !i.portId && regions.includes(i.region) && i.radius > 150 && (kind !== 'landmark' || i.features.some((f) => LANDMARKS[f])));
    is = pool[Math.floor(rng.float() * pool.length)] ?? game.world.islands.find((i) => !i.portId && i.radius > 150)!;
  }
  const k = rng.int(0, 999);
  const [sx, sy] = shoreSpot(is, k);
  const a = rng.float() * Math.PI * 2, r = 0.2 + rng.float() * 0.5;
  const id = `m${game.allocId()}`;
  const m: TreasureMap = {
    id, tier, name: `${opts.legendary ? 'Legendary' : TIER_NAMES[Math.min(3, tier)]} map — ${is.name}`, region: is.region,
    sx, sy, ox: Math.sin(a) * r, oy: -Math.cos(a) * r, legendary: !!opts.legendary, kind, hoard: id, island: is.id,
  };
  if (kind !== 'circle') {
    m.clue = clueFor(game, kind, is, sx, sy);
    m.name = { riddle: 'A riddle in verse', drawing: 'A shore drawn from the sea', landmark: 'Landmarks and paces', cursed: 'A map that whispers', circle: m.name, fragment: m.name, player: m.name }[kind];
    if (kind === 'cursed') m.tier = 4;
  }
  return m;
}

const LANDMARKS: Partial<Record<string, string>> = { lighthouse: 'the lighthouse', ruins: 'the ruined chapel', shrine: 'the drowned shrine', wreck: 'the beached wreck', grove: 'the tall grove', mine: 'the old mine' };
const SIDES = ['northern', 'north-eastern', 'eastern', 'south-eastern', 'southern', 'south-western', 'western', 'north-western'];
const SUN = ['toward the pole star', 'toward the morning gale', 'toward the sunrise', 'toward the warm wind', 'toward the noon sun', 'toward the rain', 'toward the sunset', 'toward the cold wind'];
const BIOME_WORDS: Record<string, string> = { temperate: 'green', mossy: 'mossy', volcanic: 'ashen', ice: 'frozen', ruins: 'broken-spired', bone: 'bone-white', barren: 'bare', jungle: 'jungled', mangrove: 'mangrove-rooted', atoll: 'coral-ringed', saltflat: 'salt-white', blacksand: 'black-sanded', fungal: 'fungus-grown', crystal: 'crystal-crowned' };

function octant(fromX: number, fromY: number, toX: number, toY: number): number {
  const b = Math.atan2(toX - fromX, -(toY - fromY)) / DEG;
  return Math.round(((b + 360) % 360) / 45) % 8;
}

/** The words on a clue map: verse about landmarks, paces from a named mark, a region's ink, or whispers. */
function clueFor(game: Game, kind: MapKind, is: Island, sx: number, sy: number): string {
  const rng = game.rng;
  const side = octant(is.x, is.y, sx, sy);
  const region = REGIONS[is.region].name;
  const size = is.radius > 700 ? 'a great' : is.radius > 350 ? 'a middling' : 'a little';
  const mark = is.features.map((f) => LANDMARKS[f]).find(Boolean);
  switch (kind) {
    case 'riddle':
      return rng.pick([
        `In ${region} lies ${size} ${BIOME_WORDS[is.biome] ?? ''} isle${mark ? ` that keeps ${mark}` : ' with no name on the charts'}; on her ${SIDES[side]} shore, where the tide forgets the sand, the chest was laid.`,
        `Seek ${size} island of ${region}${mark ? `, ${mark} upon her,` : ','} and walk her ${SIDES[side]} strand. Dead men count their paces there.`,
      ]);
    case 'landmark': {
      const paces = Math.round(dist(is.x, is.y, sx, sy) / 0.8 / 10) * 10;
      return `From ${mark ?? 'the heart'} of ${is.name}, ${paces} paces ${SUN[side]}, to the water's edge.`;
    }
    case 'drawing':
      return `A shore sketched from the sea; the ink smells of ${region}. The cross is on the ${SIDES[side]} side.`;
    case 'cursed':
      return 'The parchment is cold and wet whatever the weather. At night it whispers a bearing.';
  }
  return '';
}

/** The circle as this captain reads it (Treasure Hunter shrinks it; Legend Seeker pins a legendary map). */
export function mapCircle(m: TreasureMap, ship: ShipEntity | null): { x: number; y: number; r: number } {
  if (m.legendary && ship?.hasFlag('legend_seeker')) return { x: m.sx, y: m.sy, r: 0 };
  const shrink = Math.max(0.2, 1 - 0.2 * (ship ? tx(ship.stats, 'treasureHunter') : 0));
  const r = BASE_RADIUS[m.tier] * shrink;
  return { x: m.sx + m.ox * r, y: m.sy + m.oy * r, r };
}

/** Maps in the chest (the pieces of the legendary chart are kept apart, in oilcloth). */
export function chestCount(maps: TreasureMap[]): number {
  return maps.filter((m) => m.kind !== 'fragment').length;
}

/** A map changes hands. Returns false when the chest of maps is full. */
export function grantMap(game: Game, s: PlayerSession, m: TreasureMap, source: string): boolean {
  const p = s.profile!;
  if (m.kind !== 'fragment' && chestCount(p.explore.maps) >= MAX_MAPS) {
    game.sendTo(s, { t: 'toast', msg: 'Your map chest is full — dig one up or sell one.', kind: 'bad' });
    return false;
  }
  p.explore.maps.push(m);
  game.sendTo(s, { t: 'toast', msg: `${source}: a treasure map! ${m.name}. (M to see the circle)`, kind: 'gold' });
  return true;
}

/** Roll for a map from ordinary finds; Gold Fever doubles the chance. */
export function mapChance(game: Game, s: PlayerSession, chance: number, tier: number, source: string, kind?: MapKind): void {
  const ship = s.ship!;
  const c = chance * (ship.hasFlag('gold_fever') ? 2 : 1);
  if (game.rng.chance(c)) grantMap(game, s, makeMap(game, tier, { kind }), source);
}

/** Fragments of a legendary map (Legend Seeker: three times as often). */
export function fragmentChance(game: Game, s: PlayerSession, chance: number): void {
  const c = Math.min(1, chance * (s.ship!.hasFlag('legend_seeker') ? 3 : 1));
  if (!game.rng.chance(c)) return;
  s.profile!.explore.fragments++;
  game.sendTo(s, { t: 'toast', msg: `A torn fragment of a legendary map (${s.profile!.explore.fragments}/3). A cartographer can piece three together.`, kind: 'gold' });
}

/** What the digging party is going after, if anything: a map whose search area covers the ship. */
export function mapHere(game: Game, s: PlayerSession): TreasureMap | null {
  const ship = s.ship!;
  for (const m of s.profile!.explore.maps) {
    const c = mapReach(game, s, m);
    if (c && dist(c.x, c.y, ship.state.x, ship.state.y) <= c.r + DIG_RANGE) return m;
  }
  return null;
}

/** Where a map lets the boats go digging: its circle, or the island its clue is about, or (cursed) the spot. */
export function mapReach(game: Game, s: PlayerSession, m: TreasureMap): { x: number; y: number; r: number } | null {
  const kind = m.kind ?? 'circle';
  if (kind === 'circle') return mapCircle(m, s.ship);
  if (kind === 'fragment') return legendCircle(game, s, m);
  if (kind === 'cursed') return { x: m.sx, y: m.sy, r: 350 };
  const is = m.island !== undefined ? game.world.islands[m.island] : undefined;
  return is ? { x: is.x, y: is.y, r: is.radius + 1500 } : { x: m.sx, y: m.sy, r: 1500 };
}

/** 60–180 s of digging by the size of the hoard (Treasure Hunter hurries it). */
export function digTime(ship: ShipEntity, tier = 1): number {
  return (25 + 35 * Math.min(4, tier)) * Math.max(0.4, 1 - 0.15 * tx(ship.stats, 'treasureHunter'));
}

/** Digging done: the hoard, or a hint toward the true spot. */
export function resolveDig(game: Game, s: PlayerSession, mapId: string, share: number): void {
  const p = s.profile!;
  const ship = s.ship!;
  const m = p.explore.maps.find((x) => x.id === mapId);
  if (!m) return;
  const d = dist(m.sx, m.sy, ship.state.x, ship.state.y);
  if (d <= DIG_RANGE && digOutcome(game, s, m, share)) return; // shared chests, forgeries, curses, the legend
  if (d > DIG_RANGE) {
    const bearing = Math.atan2(m.sx - ship.state.x, -(m.sy - ship.state.y)) / DEG;
    const dir = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((bearing + 360) % 360) / 45) % 8];
    game.toastShip(ship, `Nothing but sand. The landmarks on the map point further ${dir}.`, 'info');
    return;
  }
  p.explore.maps = p.explore.maps.filter((x) => x !== m);
  hoard(game, s, m.tier + (ship.hasFlag('gold_fever') ? 1 : 0), share);
  if (m.tier >= 3) grantDeed(game, s, 'deed_legendary_hoard');
  game.grantXp(s, 150 * m.tier, `Dug up the ${m.name}`);
}

/** The contents of a hoard by grade (4 = Gold Fever on a legendary map). */
export function hoard(game: Game, s: PlayerSession, grade: number, share: number): void {
  const p = s.profile!;
  const ship = s.ship!;
  const rng = game.rng;
  const got: string[] = [];
  const give = (good: GoodId, n: number) => {
    const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
    const fit = Math.max(0, Math.min(Math.round(n * share), Math.floor((free + 1e-6) / GOODS[good].volume)));
    if (fit > 0) {
      ship.cargo[good] = (ship.cargo[good] ?? 0) + fit;
      got.push(`${fit} ${GOODS[good].name}`);
    }
  };
  seasonStat(game, s, 'treasure', 1);
  const silver = Math.round([0, rng.int(300, 700), rng.int(1000, 2500), rng.int(4000, 8000), rng.int(9000, 14000)][Math.min(4, grade)] * share);
  if (grade === 1) give('spices', rng.int(5, 10));
  if (grade === 2) {
    give('pearls', rng.int(5, 10));
    give('cursed_relics', rng.int(0, 3));
  }
  if (grade >= 3) {
    give('pearls', rng.int(12, 20) * (grade >= 4 ? 1.5 : 1));
    give('cursed_relics', rng.int(4, 8));
    give('abyssal_ore', rng.int(2, 5));
  }
  // Lucky Dig: one more piece, a grade finer.
  if (ship.hasFlag('lucky_dig') && rng.chance(0.15)) give(grade >= 2 ? 'abyssal_ore' : 'pearls', grade >= 2 ? 3 : 6);
  p.gold += silver;
  game.db.ledger(s.accountId, 'treasure', silver, `grade ${grade}`);
  fragmentChance(game, s, [0, 0.2, 0.35, 0.6, 0.8][Math.min(4, grade)]);
  // The great hoards may hold a piece of the season's legendary chart.
  if (grade >= 3) legendFragment(game, s, 0.5, 'Wrapped in oilcloth at the bottom of the chest');
  // Hoards hold plans: masterwork now and then, a legendary one in the great hoards.
  if (grade >= 3) grantPlan(game, s, 'legendary');
  else if (grade === 2 && rng.chance(0.2)) grantPlan(game, s, 'masterwork');
  if (ship.hasFlag('gold_fever')) p.explore.hoardAboard = true;
  game.sendTo(s, { t: 'toast', msg: `TREASURE! ${silver} silver${got.length ? `, ${got.join(', ')}` : ''}.`, kind: 'gold' });
}

/** At a cartographer: three fragments make a legendary map; Map of the Dead merges three maps of a tier. */
export function cartographerAction(game: Game, s: PlayerSession, action: 'assemble' | 'merge', tier: number): string | null {
  const p = s.profile!;
  if (action === 'assemble') {
    if (p.explore.fragments < 3) return 'Three fragments make a map';
    p.explore.fragments -= 3;
    grantMap(game, s, makeMap(game, 3, { legendary: true }), 'The cartographer pieces it together');
    return null;
  }
  if (!s.ship!.hasFlag('map_of_the_dead')) return 'Only a reader of dead men\'s maps can merge them';
  if (tier < 1 || tier > 2) return 'Only stained and captain\'s maps merge';
  const same = p.explore.maps.filter((m) => m.tier === tier && !m.legendary);
  if (same.length < 3) return `You need three ${TIER_NAMES[tier].toLowerCase()} maps`;
  const drop = new Set(same.slice(0, 3).map((m) => m.id));
  p.explore.maps = p.explore.maps.filter((m) => !drop.has(m.id));
  grantMap(game, s, makeMap(game, tier + 1), 'Three maps become one');
  return null;
}

/** A tavern drunk sells a stained map (one per port per game day). Rumor Hound: once a day, free. */
export function tavernMap(game: Game, s: PlayerSession, portId: string): string | null {
  const p = s.profile!;
  const day = Math.floor(game.now / 7200);
  const key = `${portId}:${day}`;
  if (p.explore.tavernDeals.includes(key)) return 'Nobody here has another map to sell today';
  const free = s.ship!.hasFlag('rumor_hound') && p.explore.rumorDay !== day;
  const price = free ? 0 : 350;
  if (p.gold < price) return `The map costs ${price} silver`;
  if (chestCount(p.explore.maps) >= MAX_MAPS) return 'Your map chest is full';
  p.gold -= price;
  if (price) game.db.ledger(s.accountId, 'map', -price, portId);
  if (free) p.explore.rumorDay = day;
  p.explore.tavernDeals = [...p.explore.tavernDeals.slice(-20), key];
  // Half the maps in taverns are verse: a riddle leads to a finer hoard than a stained circle.
  const riddle = game.rng.chance(0.4);
  grantMap(game, s, riddle ? makeMap(game, 2, { kind: 'riddle' }) : makeMap(game, 1), free ? 'Tavern rumour' : 'A drunk sailor sells');
  return null;
}

// ------------------------------------------------------------------ sunken wrecks

/** Two dozen old wrecks on the sea floor, the same in every world with this seed. */
export function buildWrecks(game: Game): SunkenWreck[] {
  const out: SunkenWreck[] = [];
  const names = ['Saint Brendan', 'Gloria Regis', 'Merciful Anne', 'Black Tithe', 'Silver Hind', 'Grey Widow', 'Constance', 'Lamentation', 'Ninth Hour', 'Iron Psalm', 'Tidecaller', 'Wandering Jew'];
  let seed = game.world.seed >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let tries = 0; out.length < 24 && tries < 2000; tries++) {
    const x = 6000 + rnd() * 84000, y = 6000 + rnd() * 84000;
    const depth = depthAt(game.world, x, y);
    if (depth < 4 || depth > 45) continue;
    const region = REGIONS[game.regionAt(x, y)];
    out.push({ id: out.length, name: `wreck of the ${names[out.length % names.length]}`, x, y, depth: Math.round(depth), tier: region.safety === 'lawless' ? 3 : region.safety === 'contested' ? 2 : 1 });
  }
  return out;
}

export function diveDepth(ship: ShipEntity): number {
  const r = tx(ship.stats, 'diveDepth');
  return r >= 2 ? 40 : r >= 1 ? 20 : 8;
}

export function wreckHere(game: Game, ship: ShipEntity): SunkenWreck | null {
  for (const w of game.wrecks) if (dist(w.x, w.y, ship.state.x, ship.state.y) < 150) return w;
  return null;
}

/** Divers come up from the wreck (at most once per wreck every two hours). */
export function resolveDive(game: Game, s: PlayerSession, wreckId: number, share: number): void {
  const w = game.wrecks[wreckId];
  const p = s.profile!;
  if (!w) return;
  p.explore.dived[w.id] = game.now;
  questEvent(game, s, { k: 'dive' });
  const rng = game.rng;
  const ship = s.ship!;
  const goods: GoodId[] = w.tier >= 3 ? ['cursed_relics', 'abyssal_ore', 'pearls'] : w.tier === 2 ? ['weapons', 'spices', 'pearls'] : ['rum', 'iron', 'cloth'];
  const g = rng.pick(goods);
  const n = Math.max(1, Math.round(rng.int(3, 8) * (4 - Math.min(3, GOODS[g].volume * 2)) * share / 2));
  const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
  const fit = Math.max(0, Math.min(n, Math.floor((free + 1e-6) / GOODS[g].volume)));
  if (fit > 0) ship.cargo[g] = (ship.cargo[g] ?? 0) + fit;
  const silver = Math.round(rng.int(50, 200) * w.tier * share);
  p.gold += silver;
  game.db.ledger(s.accountId, 'dive', silver, w.name);
  mapChance(game, s, 0.1 * w.tier, Math.min(3, w.tier), 'In a sea chest on the wreck', w.tier >= 2 ? 'drawing' : 'circle');
  // Old ships keep old plans; the graveyard keeps its serpents.
  if (game.rng.chance(0.05 * w.tier)) grantPlan(game, s, 'masterwork');
  if (ship.region === 'dead_mans_expanse' && !p.figureheads.includes('fh_serpent') && game.rng.chance(0.1)) {
    p.figureheads.push('fh_serpent');
    game.toastShip(ship, 'The divers bring up a carved sea serpent from her bow. A yard can fit it.', 'gold');
  }
  fragmentChance(game, s, 0.04 * w.tier);
  game.toastShip(ship, `The divers come up from the ${w.name}: ${fit} ${GOODS[g].name.toLowerCase()} and ${silver} silver.`, 'gold');
  game.grantXp(s, 60 * w.tier, null);
}

export function canDive(game: Game, s: PlayerSession, w: SunkenWreck): string | null {
  if (w.depth > diveDepth(s.ship!)) return `The ${w.name} lies at ${w.depth} m — too deep for your divers`;
  if (game.now - (s.profile!.explore.dived[w.id] ?? -1e9) < 7200) return 'Your divers have already stripped that wreck for now';
  return null;
}

// ------------------------------------------------------------------ sight, tracks, soundings

export interface Trail {
  id: number;
  classId: string;
  pts: [number, number, number][]; // x, y, time
}

/** Every 5 s: remember where ships went (for trackers). */
export function recordTrails(game: Game): void {
  const now = game.now;
  for (const ship of game.ships.values()) {
    if (!ship.alive || ship.docked) continue;
    const brain = game.npcs.get(ship.id);
    if (brain && !brain.active) continue;
    let tr = game.trails.get(ship.id);
    if (!tr) game.trails.set(ship.id, (tr = { id: ship.id, classId: ship.loadout.classId, pts: [] }));
    tr.pts.push([Math.round(ship.state.x), Math.round(ship.state.y), now]);
    while (tr.pts.length && now - tr.pts[0][2] > 130) tr.pts.shift();
  }
  for (const [id, tr] of game.trails) if (!game.ships.has(id) || !tr.pts.length || now - tr.pts[tr.pts.length - 1][2] > 130) game.trails.delete(id);
}

/** Wakes a tracker can read: within sight, no older than the talent allows (a Ghost Wake fades in 20 s). */
export function trailsFor(game: Game, ship: ShipEntity): { classId: string; pts: [number, number][] }[] {
  const window = tx(ship.stats, 'tracking');
  if (window <= 0) return [];
  const out: { classId: string; pts: [number, number][] }[] = [];
  const range = ship.stats.detection * 1.2;
  for (const tr of game.trails.values()) {
    if (tr.id === ship.id) continue;
    const other = game.ships.get(tr.id);
    const limit = other && tx(other.stats, 'ghostWake') > 0 ? Math.min(window, 20) : window;
    const pts = tr.pts.filter((p) => game.now - p[2] <= limit && dist(p[0], p[1], ship.state.x, ship.state.y) < range).map((p) => [p[0], p[1]] as [number, number]);
    if (pts.length >= 2) out.push({ classId: tr.classId, pts });
  }
  return out;
}

/** Sounding Line: water too shallow for the keel within 800 m, on a 100 m grid. */
export function soundings(game: Game, ship: ShipEntity): [number, number][] {
  if (!ship.hasFlag('sounding_line')) return [];
  const draft = ship.cls.draft * Math.max(0.5, 1 + tx(ship.stats, 'draftMul'));
  const out: [number, number][] = [];
  const x0 = Math.round(ship.state.x / 100) * 100, y0 = Math.round(ship.state.y / 100) * 100;
  for (let dx = -800; dx <= 800; dx += 100) {
    for (let dy = -800; dy <= 800; dy += 100) {
      const x = x0 + dx, y = y0 + dy;
      const d = depthAt(game.world, x, y);
      if (d > 0 && d < draft) out.push([x, y]);
    }
  }
  return out;
}

/** Weather Eye: the next weather in this region, if it comes within the forecast window. */
export function forecast(game: Game, ship: ShipEntity): { kind: string; in: number } | null {
  const win = tx(ship.stats, 'forecast');
  if (win <= 0) return null;
  const w = game.weather[ship.region];
  const left = w.until - game.now;
  if (!w.next || left > win) return null;
  return { kind: w.next, in: Math.max(0, Math.round(left)) };
}

// ------------------------------------------------------------------ the edge, charted waters, gold trail

/** Once a second for explorers: positional effects. */
export function stepExplorer(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  const now = game.now;
  const safety = REGIONS[ship.region].safety;
  // Charted Waters: a fully charted region is home water.
  const cw = tx(ship.stats, 'chartedWaters');
  if (cw > 0 && regionCharted(game, s, ship.region)) {
    ship.addEffect({ id: 'charted_waters', until: now + 1.6, mods: { maxSpeed: 0.03 * cw, signature: -0.1 * cw } }, now);
  }
  // Beyond the Edge.
  if (ship.hasFlag('beyond_the_edge')) {
    const edge = ship.region === 'dead_mans_expanse' || ship.region === 'drowned_crown' || ship.region === 'the_abyss' || !chunkCharted(game, s);
    if (edge) ship.addEffect({ id: 'beyond_edge', until: now + 1.6, mods: { maxSpeed: 0.1, reloadMul: -0.1, detection: 0.15, stormHull: -0.25 } }, now);
    else if (safety !== 'lawless') {
      ship.addEffect({ id: 'beyond_edge', until: now + 1.6, mods: { maxSpeed: -0.1, reloadMul: 0.1 } }, now);
      if ((ship.talentReady.pine ?? 0) <= now) {
        ship.talentReady.pine = now + 300;
        ship.morale = Math.max(0, ship.morale - 1);
      }
    }
  }
  // Gold Fever: a hoard aboard leaves a gold trail every 30 s.
  const p = s.profile!;
  if (p.explore.hoardAboard && (ship.talentReady.goldTrail ?? 0) <= now) {
    ship.talentReady.goldTrail = now + 30;
    for (const [id, b] of game.npcs) {
      if (b.role !== 'pirate' && b.role !== 'hunter') continue;
      const o = game.ships.get(id);
      if (!o || o.region !== ship.region || b.target !== null || b.chase) continue;
      if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) > 8000) continue;
      b.chase = { id: ship.id, until: now + 120 };
    }
  }
}

export function regionCharted(game: Game, s: PlayerSession, region: RegionId): boolean {
  const cache = s.chartedCache;
  if (cache.region === region && cache.size === s.discovered.size) return cache.full;
  const isl = game.world.islands.filter((i) => i.region === region);
  const full = isl.length > 0 && isl.every((i) => s.discovered.has(i.id));
  s.chartedCache = { region, size: s.discovered.size, full };
  return full;
}

/** Uncharted water: no island of this 3 km chunk is on your chart yet. */
function chunkCharted(game: Game, s: PlayerSession): boolean {
  const ship = s.ship!;
  const is = game.world.islands.find((i) => Math.abs(i.x - ship.state.x) < 3000 && Math.abs(i.y - ship.state.y) < 3000);
  return !is || s.discovered.has(is.id);
}

/** Players who can see a gold trail (Wanted 2+): rough positions of hoard carriers. */
export function goldTrailsFor(game: Game, viewer: ShipEntity): [number, number][] {
  if (viewer.wantedCache < 2) return [];
  const out: [number, number][] = [];
  for (const s of game.sessions) {
    if (!s.ship || s.ship.id === viewer.id || !s.profile?.explore.hoardAboard || s.ship.docked) continue;
    out.push([Math.round(s.ship.state.x / 500) * 500, Math.round(s.ship.state.y / 500) * 500]);
  }
  return out;
}

/** Eye of the Storm rank 2: when a storm leaves a region, wreckage with rare goods floats up for you alone. */
export function stormDebris(game: Game, region: RegionId): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || ship.docked || ship.region !== region || tx(ship.stats, 'eyeOfStorm') < 2) continue;
    const v = headingVec(game.rng.float() * Math.PI * 2);
    game.dropPrivateLoot(s.accountId, ship.state.x + v.x * 250, ship.state.y + v.y * 250, { [game.rng.pick(['pearls', 'abyssal_ore', 'spices'] as GoodId[])]: game.rng.int(3, 8) }, 300);
    game.toastShip(ship, 'The storm has passed. Something floats where it raged.', 'good');
  }
}

/** Monsters of the deep for Leviathan Lore: ghost ships, the great bosses and the beasts of the sea. */
export function isMonster(ship: ShipEntity): boolean {
  return ship.npcRole === 'ghost' || ship.npcRole === 'boss' || ship.npcRole === 'beast';
}

