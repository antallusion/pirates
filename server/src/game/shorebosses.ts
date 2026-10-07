// The great ones that come ashore (owner, 2026-10-03: «еще больше всяких там боссов»; shared/src/data/shorebosses.ts
// says who they are). Two halves:
//
// The world's. Each great one rises on its own calendar of the wall clock — every ten to fourteen hours, the Abbess only
// at night — on an island of its kind and level in its seas, stands on its shore for three hours and goes back into the
// sea. The taverns of its seas hear of it and the rest of the sea hears it as world news; it is on the world map and
// the region's line as a world event while it stands. Any captain whose boats can reach its shore may land against it
// (the land key: the same prompt as a lair's); each fights her own battle ashore with her own landing party
// (startCreatureFight, the battle of docs/18 II), and a captain who beats it has its spoils once a rising — the men a
// strong lair costs and an hour and a quarter at sea over them, a quarter of a level, the land's resources, its trophy
// the first time, and once a week an artifact — and the first to beat each kind on the server is written in the
// chronicle and told to the whole sea.
//
// The battle's. The great one is one stack among its retinue (its stats grown by the island's level, shoreScale), and
// what makes it a boss is played here between the battle's turns: `direct` runs as the fight opens and after every
// turn (ExtFight.onStep), reads the round and the great one's strength, and lays its moves on the battle with the
// battle's own hand (tacHurt, tacPush, the fx of the paths' moves): marks shown as the crosshair, the ground it will fall
// on as warned hexes (TacView.warn), its moves as 'boss' events in the battle's line. Two phases each (the second at
// half its strength, the Abbess's at two fifths); when the great one falls its kin scatter and the fight is won.
// `direct` is pure but for the dice it is handed, so the tests and the balance play the same fight (`simulateShore`).

import { isNight } from '../../../shared/src/constants.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import type { LandRes } from '../../../shared/src/data/bestiary.ts';
import { SHORE_BOSSES, SHORE_BOSS_IDS, isShoreBoss, shoreArmy, shorePay, shoreScale, shoreSummon } from '../../../shared/src/data/shorebosses.ts';
import type { ShoreBossId, ShoreMove } from '../../../shared/src/data/shorebosses.ts';
import { TAC_BLOCKING, hexDist, hexNeighbors } from '../../../shared/src/data/tactical.ts';
import type { TacCell } from '../../../shared/src/data/tactical.ts';
import type { LairLoot } from '../../../shared/src/lairproto.ts';
import { closestOnPolygon, dist, pointInPolygon } from '../../../shared/src/math.ts';
import type { WorldEventView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { isleLevel, isleType } from '../../../shared/src/world/archipelago.ts';
import type { IsleType } from '../../../shared/src/world/archipelago.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { parkNear } from './advmap.ts';
import { closeFight, landFighting, startCreatureFight } from './beastlairs.ts';
import { logNote } from './captainlog.ts';
import { giveGoods } from './director.ts';
import { eventsChanged } from './events.ts';
import type { Game } from './Game.ts';
import { artifactFind } from './hero.ts';
import { addLand } from './landecon.ts';
import { maybeScroll } from './pathbook.ts';
import type { PlayerSession } from './player.ts';
import { chronicle } from './renown.ts';
import { seasonStat } from './seasons.ts';
import { aiAct, blow, buildStacks, checkOver, isShooter, lossesOf, newBattle, stackById, tacHp, tacHurt, tacPush } from './tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from './tacbattle.ts';
import { tattooCount } from './tattoos.ts';

/** Within this of the great one's spot (and the boats' reach of its island's shore) the land key lands against it. */
export const SHORE_BOSS_REACH = 1100;
const LAND_REACH = 260;
/** Rare spoils (the artifact) once a week a captain a kind, as the sea's bosses' plans (BOSS_LOCKOUT). */
const SHORE_LOCKOUT = 7 * 24 * 3600 * 1000;

// ================================================================================================ the world's half

/** A great one standing on its shore. */
export interface Rising {
  id: number;
  kind: ShoreBossId;
  island: number;
  /** Where it stands on the shore, the island's level and kind (its battle's field). */
  x: number;
  y: number;
  level: number;
  type: IsleType;
  /** Wall-clock ms it goes back into the sea. */
  until: number;
  /** The captains (accounts) who have beaten it this rising. */
  beaten: number[];
}

interface Store {
  /** Wall-clock ms of each kind's next rising. */
  next: Partial<Record<ShoreBossId, number>>;
  risen: Rising[];
  seq: number;
}

const KEY = 'shore_bosses';
const stores = new WeakMap<Game, Store>();

function store(game: Game): Store {
  let st = stores.get(game);
  if (!st) {
    const saved = game.db.getKv<Store>(`${KEY}:${game.zone?.id ?? 'world'}`);
    st = { next: saved?.next ?? {}, risen: Array.isArray(saved?.risen) ? saved!.risen : [], seq: saved?.seq ?? 0 };
    const wall = game.wallNow();
    // The first risings spread by the world seed (not the game's dice), as the sea's bosses' are.
    SHORE_BOSS_IDS.forEach((id, i) => {
      const u = ((game.world.seed * 7919 + (i + 3) * 104729) % 233280) / 233280;
      st!.next[id] ??= wall + Math.round((0.1 + 0.6 * u) * SHORE_BOSSES[id].every * 1000);
    });
    stores.set(game, st);
  }
  return st;
}

const save = (game: Game) => game.db.setKv(`${KEY}:${game.zone?.id ?? 'world'}`, store(game));

/** The great ones standing now. */
export const shoreRisings = (game: Game): readonly Rising[] => store(game).risen;
/** Each kind's next rising (wall-clock ms): the tests' and the tester's console's hand on the calendar. */
export const shoreCalendar = (game: Game): Partial<Record<ShoreBossId, number>> => store(game).next;

const nameOf = (k: ShoreBossId): string => SHORE_BOSSES[k].name[0];
const islandOf = (game: Game, r: Rising): Island | undefined => game.world.islands[r.island];
const islandName = (game: Game, r: Rising): string => islandOf(game, r)?.name ?? 'an island';

/** Once a second: the great ones that go back into the sea, and those whose hour has come. */
export function stepShoreBosses(game: Game): void {
  const st = store(game);
  const wall = game.wallNow();
  let dirty = false;
  for (const r of [...st.risen]) {
    if (wall < r.until) continue;
    st.risen = st.risen.filter((x) => x !== r);
    dirty = true;
    game.addRumor(r.x, r.y, `${nameOf(r.kind)} has gone back into the sea from ${islandName(game, r)}.`);
    game.log(`[shoreboss] ${r.kind} left ${islandName(game, r)}`);
  }
  for (const id of SHORE_BOSS_IDS) {
    if (st.risen.some((r) => r.kind === id)) continue;
    const def = SHORE_BOSSES[id];
    const next = st.next[id] ?? wall;
    if (wall < next) continue;
    // The Abbess waits for the night (half her round of days at most; then she comes as she can).
    if (def.window === 'night' && !isNight(game.now) && wall - next < def.every * 500) continue;
    st.next[id] = wall + Math.round(def.every * 1000 * game.rng.range(0.85, 1.15));
    dirty = true;
    riseShore(game, id);
  }
  if (dirty) {
    save(game);
    eventsChanged(game);
  }
}

/** An island it may come ashore on: of its kind and levels, in its seas (anywhere when raised near a point), not
 *  hidden, nobody's home, in this zone, no other great one on it. */
function shoreIsles(game: Game, kind: ShoreBossId, anywhere: boolean): Island[] {
  const def = SHORE_BOSSES[kind];
  const st = store(game);
  return game.world.islands.filter((is) => {
    if (!is || is.hidden || !def.types.includes(isleType(is))) return false;
    if (!anywhere && !def.regions.includes(is.region)) return false;
    const L = isleLevel(game.world, is);
    if (!anywhere && (L < def.lv[0] || L > def.lv[1])) return false;
    if (game.holdings.get(game, is.id) || !game.inZone(is.x, is.y)) return false;
    return !st.risen.some((r) => r.island === is.id) && is.poly.length >= 6;
  });
}

/** It comes ashore now: on an island of its kind (the nearest to `near`, for a test or the tester's console), the
 *  taverns told. Null when no island will have it. */
export function riseShore(game: Game, kind: ShoreBossId, near?: { x: number; y: number }): Rising | null {
  const def = SHORE_BOSSES[kind];
  const st = store(game);
  let list = shoreIsles(game, kind, false);
  if (near) {
    const any = list.length ? list : shoreIsles(game, kind, true);
    list = any.length ? [any.reduce((a, b) => (dist(b.x, b.y, near.x, near.y) < dist(a.x, a.y, near.x, near.y) ? b : a))] : [];
  }
  if (!list.length) {
    game.log(`[shoreboss] ${kind}: no island will have it`);
    return null;
  }
  const is = near ? list[0] : game.rng.pick(list);
  // Its spot: a point of the island's own shore, the side toward `near` when there is one.
  const n = is.poly.length / 2;
  let k = game.rng.int(0, n - 1);
  if (near) {
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = dist(is.poly[2 * i], is.poly[2 * i + 1], near.x, near.y);
      if (d < bd) [bd, k] = [d, i];
    }
  }
  const level = Math.max(def.lv[0], Math.min(def.lv[1], isleLevel(game.world, is)));
  const r: Rising = { id: ++st.seq, kind, island: is.id, x: is.poly[2 * k], y: is.poly[2 * k + 1], level, type: isleType(is), until: game.wallNow() + def.lifetime * 1000, beaten: [] };
  st.risen.push(r);
  save(game);
  announce(game, r);
  eventsChanged(game);
  return r;
}

function announce(game: Game, r: Rising): void {
  const is = islandOf(game, r);
  const region = REGIONS[is?.region ?? 'black_coast'].name;
  const hours = Math.round(SHORE_BOSSES[r.kind].lifetime / 3600);
  const text = `${nameOf(r.kind)} has come ashore on ${islandName(game, r)} (${region}, ⚓${r.level}). Any captain may land against it for the next ${hours} hours.`;
  for (const p of game.world.ports) if ((is && p.region === is.region) || dist(p.x, p.y, r.x, r.y) < 30000) game.addRumor(p.x, p.y, text);
  for (const s of game.sessions) {
    const sh = s.ship;
    if (!sh) continue;
    const near = (is && sh.region === is.region) || dist(sh.state.x, sh.state.y, r.x, r.y) < 20000;
    game.sendTo(s, { t: 'toast', msg: near ? `Tavern talk: ${text}` : `WORLD: ${text}`, kind: near ? 'info' : 'bad' });
  }
  game.log(`[shoreboss] ${r.kind} ashore on ${islandName(game, r)} ⚓${r.level} at ${Math.round(r.x)},${Math.round(r.y)}`);
}

/** The world events' list: each great one standing, its flag on the chart (events.ts). */
export function shoreEvents(game: Game): WorldEventView[] {
  const wall = game.wallNow();
  return store(game).risen.map((r) => ({
    id: -1000 - r.id, kind: 'boss_ashore' as const, title: `${nameOf(r.kind)} ashore on ${islandName(game, r)}`, region: islandOf(game, r)?.region ?? 'black_coast',
    x: Math.round(r.x), y: Math.round(r.y), endsIn: Math.max(0, Math.round((r.until - wall) / 1000)),
  }));
}

/** The great one whose shore her boats can reach, if any. */
function risingInReach(game: Game, s: PlayerSession): Rising | null {
  const ship = s.ship;
  if (!ship || ship.docked) return null;
  const x = ship.state.x, y = ship.state.y;
  for (const r of store(game).risen) {
    if (Math.abs(r.x - x) > SHORE_BOSS_REACH || Math.abs(r.y - y) > SHORE_BOSS_REACH || dist(r.x, r.y, x, y) > SHORE_BOSS_REACH) continue;
    const is = islandOf(game, r);
    if (is && Math.sqrt(closestOnPolygon(x, y, is.poly).d2) <= LAND_REACH) return r;
  }
  return null;
}

/** Why she cannot land against it now (null: she can). */
function fightWhy(game: Game, s: PlayerSession, r: Rising, force: boolean): string | null {
  const ship = s.ship;
  if (!ship || ship.docked) return 'Put to sea first.';
  if (ship.boarding || ship.landing) return 'Not now';
  if (landFighting(game, s)) return 'Your party is ashore already.';
  if (game.wallNow() >= r.until) return 'It has gone back into the sea.';
  if (r.beaten.includes(s.accountId) && !force) return `You have beaten ${nameOf(r.kind)} already: it waits for others now.`;
  if (force) return null;
  if (ship.underFire(game.now)) return 'Not while under fire';
  if (ship.state.speed > 2.5) return 'Heave to first — the boats cannot be lowered at speed';
  if (ship.crew < 3) return 'Too few hands to spare a landing party';
  return null;
}

/** The land key's prompt off a great one's shore (null: none in reach). */
export function shoreBossPrompt(game: Game, s: PlayerSession): { island: string; feature: string; action: 'lair'; lv: number; danger?: 'warn' | 'deadly'; blocked?: string } | null {
  const r = risingInReach(game, s);
  if (!r) return null;
  const d = r.level - (s.ship?.shipLevel ?? 1);
  const why = r.beaten.includes(s.accountId) ? `You have beaten ${nameOf(r.kind)} already: it waits for others now.` : null;
  return { island: islandName(game, r), feature: nameOf(r.kind), action: 'lair', lv: r.level, ...(d >= 3 ? { danger: 'deadly' as const } : d >= 2 ? { danger: 'warn' as const } : {}), ...(why ? { blocked: why } : {}) };
}

/** The land key off a great one's shore: the boats go ashore against it (undefined: none here, the landing goes on). */
export function shoreBossLanding(game: Game, s: PlayerSession): string | null | undefined {
  const r = risingInReach(game, s);
  if (!r) return undefined;
  return startShoreFight(game, s, r, false);
}

/** Her landing party against the great one and its retinue. */
export function startShoreFight(game: Game, s: PlayerSession, r: Rising, force: boolean): string | null {
  const why = fightWhy(game, s, r, force);
  if (why) return why;
  const def = SHORE_BOSSES[r.kind];
  const place = islandName(game, r);
  const e = startCreatureFight(game, s, {
    type: r.type, kind: r.kind, place, level: r.level,
    onStep: (_g, _s, bt, rng) => {
      if (!duels.has(bt)) startDuel(bt, r.kind, r.level);
      direct(bt, rng);
    },
    quick: (bt, rng) => playOut(bt, rng, game.now),
    onEnd: (g, ss, won, bt) => shoreEnd(g, ss, r, won, bt),
  }, def.name[0], shoreArmy(r.kind, r.level), `unit.${r.kind}`, r.level);
  if (e) return e;
  game.toastShip(s.ship!, `Boats away against ${def.name[0]} on ${place}. ${def.hint[0]}`, 'info');
  return null;
}

/** The fight is over: the spoils won (once a rising), the trophy, the artifact once a week, the chronicle. */
function shoreEnd(game: Game, s: PlayerSession, r: Rising, won: boolean, bt: TacBattle): LairLoot | undefined {
  const def = SHORE_BOSSES[r.kind];
  const ship = s.ship!;
  const p = s.profile!;
  const name = def.name[0];
  if (!won) {
    game.toastShip(ship, `${name} throws your party back into the surf. It stands on ${islandName(game, r)} a while yet.`, 'bad');
    return undefined;
  }
  const st = store(game);
  const live = st.risen.find((x) => x.id === r.id) ?? r;
  if (!live.beaten.includes(s.accountId)) live.beaten.push(s.accountId);
  save(game);
  const loot: LairLoot = { silver: 0, xp: 0, goods: [], res: {}, shore: { kind: r.kind } };
  const pay = shorePay(r.kind, r.level, r.type);
  p.gold += pay.silver;
  game.db.ledger(s.accountId, 'shore_boss', pay.silver, r.kind);
  loot.silver = pay.silver;
  const k = giveGoods(ship, pay.good, pay.goods);
  if (k > 0) loot.goods.push({ g: pay.good, n: k });
  for (const [res, n] of Object.entries(pay.res) as [LandRes | 'pearls', number][]) {
    if (res === 'pearls') {
      const q = giveGoods(ship, 'pearls', n);
      if (q > 0) loot.res.pearls = q;
    } else {
      const got = addLand(game, s, res, n).given;
      if (got > 0) loot.res[res] = got;
    }
  }
  loot.xp = pay.xp;
  game.grantXp(s, pay.xp, `${name} beaten`, true);
  const trophy = def.trophy[0];
  if (!p.trophies.includes(trophy)) {
    p.trophies.push(trophy);
    loot.shore!.trophy = true;
  }
  // The rare spoils: an artifact, once a week a captain a kind.
  const lock = `shore:${r.kind}`;
  const wall = game.wallNow();
  if ((p.bossLocks[lock] ?? 0) <= wall) {
    p.bossLocks[lock] = wall + SHORE_LOCKOUT;
    const it = artifactFind(game, s, 'boss');
    if (it?.art) loot.artifact = it.art;
  }
  maybeScroll(game, s, 'boss');
  p.bossKills[lock] = (p.bossKills[lock] ?? 0) + 1;
  tattooCount(game, s, 'boss');
  seasonStat(game, s, 'monsters', 40);
  logNote(game, s, 'boss', [name]);
  const isl = islandName(game, r);
  game.toastShip(ship, `${name} is beaten on ${isl}: ${pay.silver} silver, the land's spoils${loot.shore!.trophy ? ` and a trophy: ${trophy}` : ''}.`, 'gold');
  game.addRumor(r.x, r.y, `${s.name} beat ${name} on ${isl}.`);
  // The first on the server goes in the book, and the whole sea hears of it.
  const firsts = game.db.getKv<Record<string, { name: string; at: number }>>('shore_firsts') ?? {};
  if (!firsts[r.kind]) {
    firsts[r.kind] = { name: s.name, at: wall };
    game.db.setKv('shore_firsts', firsts);
    loot.shore!.first = true;
    chronicle(game, `${s.name} was the first to beat ${name}, on ${isl}.`);
    for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `FIRST ON THE SEAS: ${name} is beaten for the first time — by ${s.name}, on ${isl}.`, kind: 'gold' });
  } else {
    for (const o of game.sessions) if (o !== s && o.ship && dist(o.ship.state.x, o.ship.state.y, r.x, r.y) < 20000) game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} has beaten ${name} on ${isl}.`, kind: 'info' });
  }
  game.log(`[shoreboss] ${r.kind} beaten by ${s.name} (lost ${lossesOf(bt, 0).reduce((a, x) => a + x.n, 0)})`);
  game.saveSession(s);
  return loot;
}

/** `/shoreboss [kind] [go|fight|beat|reset]`: the great ones ashore — raised on the nearest island of its kind (and
 *  off its shore: go), landed against at once (fight), its spoils hers at once (beat), every rising cleared (reset). */
export function adminShoreBoss(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship!;
  const st = store(game);
  const kind = args.find((a) => isShoreBoss(a)) as ShoreBossId | undefined;
  const order = args.find((a) => ['go', 'fight', 'beat', 'reset', 'rise'].includes(a)) ?? (kind ? 'go' : 'list');
  if (order === 'reset') {
    st.risen = [];
    for (const id of SHORE_BOSS_IDS) st.next[id] = game.wallNow() + SHORE_BOSSES[id].every * 1000;
    save(game);
    eventsChanged(game);
    return 'Every great one is back in the sea.';
  }
  if (!kind) {
    const up = st.risen.map((r) => `${nameOf(r.kind)} on ${islandName(game, r)} (⚓${r.level})`).join('; ');
    return `Great ones ashore: ${SHORE_BOSS_IDS.join(', ')}. Standing: ${up || 'none'}. Usage: /shoreboss kind [go|fight|beat|rise|reset]`;
  }
  if (ship.docked) game.undock(s);
  const fight = landFighting(game, s);
  if (fight) closeFight(game, s);
  let r = st.risen.find((x) => x.kind === kind);
  if (!r || order === 'rise') {
    if (r) st.risen = st.risen.filter((x) => x !== r);
    r = riseShore(game, kind, { x: ship.state.x, y: ship.state.y }) ?? undefined;
  }
  if (!r) return `No island will have ${nameOf(kind)}.`;
  if (order === 'beat') {
    if (!r.beaten.includes(s.accountId)) r.beaten.push(s.accountId);
    save(game);
    return `${nameOf(kind)} on ${islandName(game, r)} is beaten for you.`;
  }
  r.beaten = r.beaten.filter((a) => a !== s.accountId);
  offShore(game, s, r);
  if (order === 'fight') return startShoreFight(game, s, r, true) ?? `Ashore: ${nameOf(kind)} on ${islandName(game, r)} (⚓${r.level}).`;
  return `Off the shore where ${nameOf(kind)} stands, on ${islandName(game, r)} (⚓${r.level}).`;
}

/** Her ship set down in the water off the great one's shore, within the boats' reach. */
function offShore(game: Game, s: PlayerSession, r: Rising): void {
  const is = islandOf(game, r);
  let x = r.x, y = r.y;
  if (is) {
    const ax = r.x - is.x, ay = r.y - is.y, al = Math.hypot(ax, ay) || 1;
    for (let d = 20; d < 1500; d += 10) {
      const px = r.x + (ax / al) * d, py = r.y + (ay / al) * d;
      if (!pointInPolygon(px, py, is.poly) && !isLand(game.world, px, py) && Math.sqrt(closestOnPolygon(px, py, is.poly).d2) >= 110) {
        [x, y] = [px, py];
        break;
      }
    }
  }
  parkNear(game, s, x, y, 1);
  s.ship!.state.speed = 0;
  game.pushSelf(s, true);
}

// ================================================================================================ the battle's half

/** What the director keeps of one fight. */
export interface Duel {
  kind: ShoreBossId;
  level: number;
  /** The great one's stack, and its whole strength (hit points) as the fight opened. */
  boss: number;
  hp0: number;
  /** The last round whose opening was played; the phase; the battle's last event read. */
  round: number;
  phase: 0 | 1;
  seen: number;
  /** The stack its tongue or its tusks are on (marked last round). */
  marked: number | null;
  /** The hexes warned last round (the breath, the toll). */
  pending: number[] | null;
  /** Ground set burning, what it was, and the last round it burns. */
  fires: { hex: number; was: TacCell; until: number }[];
  broods: number;
  warded: boolean;
  /** How often each move was played (the tests, the balance). */
  moves: Partial<Record<ShoreMove, number>>;
}

const duels = new WeakMap<TacBattle, Duel>();
export const duelOf = (bt: TacBattle): Duel | undefined => duels.get(bt);

/** The fight opens: the great one grown to its island's level. */
export function startDuel(bt: TacBattle, kind: ShoreBossId, level: number): Duel {
  const b = bt.stacks.find((x) => x.side === 1 && x.unit === kind)!;
  const k = shoreScale(kind, level);
  b.hpMax = Math.round(b.hpMax * k.hp);
  b.hpTop = b.hpMax;
  b.dmin = Math.max(1, Math.round(b.dmin * k.dmg));
  b.dmax = Math.max(b.dmin, Math.round(b.dmax * k.dmg));
  bt.heroes[1].startHp = bt.stacks.filter((x) => x.side === 1).reduce((n, x) => n + tacHp(x), 0);
  const d: Duel = { kind, level, boss: b.id, hp0: tacHp(b), round: 0, phase: 0, seen: bt.events, marked: null, pending: null, fires: [], broods: 0, warded: false, moves: {} };
  duels.set(bt, d);
  return d;
}

const ground = (bt: TacBattle, i: number): boolean => i >= 0 && i < bt.cells.length && !TAC_BLOCKING.has(bt.cells[i]);
const occupied = (bt: TacBattle, i: number): boolean => bt.stacks.some((x) => x.count > 0 && x.hex === i);
const free = (bt: TacBattle, i: number): boolean => ground(bt, i) && !occupied(bt, i);
const foes = (bt: TacBattle): TacStack[] => bt.stacks.filter((x) => x.side === 0 && x.count > 0);
const beside = (bt: TacBattle, at: number): TacStack[] => foes(bt).filter((x) => hexNeighbors(at).includes(x.hex));
/** A rock or a palm beside the hex (the land's cover, docs/18 #15). */
const byCover = (bt: TacBattle, i: number): boolean => hexNeighbors(i).some((j) => bt.cells[j] === 'R' || bt.cells[j] === 'P');

/** The free hex nearest to `at` (null: none on the field). */
function freeNear(bt: TacBattle, at: number): number | null {
  let best: number | null = null, bd = Infinity;
  for (let i = 0; i < bt.cells.length; i++) {
    if (!free(bt, i)) continue;
    const d = hexDist(at, i);
    if (d < bd) [best, bd] = [i, d];
  }
  return best;
}

function say(bt: TacBattle, d: Duel, id: ShoreMove, on: number[] = []): void {
  d.moves[id] = (d.moves[id] ?? 0) + 1;
  tacPush(bt, { k: 'boss', side: 1, s: d.boss, id, ...(on.length ? { on } : {}) });
}

/** A side of creatures with no captain (a brood's, a lair's). */
function beastSide(army: ArmyStack[]): TacSideInput {
  return {
    name: '', ship: '', captain: null, hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3,
    morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, noBook: true,
  };
}

/** A fresh stack of the great one's side beside `near` (a brood hatched, the drowned called up out of the surf). */
function summon(bt: TacBattle, u: UnitId, n: number, near: number): TacStack | null {
  const at = freeNear(bt, near);
  if (at === null) return null;
  const id = Math.max(...bt.stacks.map((x) => x.id)) + 1;
  const [st] = buildStacks(beastSide([{ u, n }]), 1, bt.cells, id);
  if (!st) return null;
  st.hex = at;
  bt.stacks.push(st);
  tacPush(bt, { k: 'move', side: 1, s: st.id, hex: at });
  return st;
}

/** A stack of hers marked (the crosshair over it): the great one's blows on it land a third harder till it is played. */
function mark(bt: TacBattle, t: TacStack): void {
  bt.heroes[1].fx = bt.heroes[1].fx.filter((f) => f.id !== 'mark_target');
  bt.heroes[1].fx.push({ id: 'mark_target', until: bt.round + 1, on: t.id });
}

/** One of hers held still this round (a blow or a shot wakes her, as the Siren Song's sleepers wake). */
function still(bt: TacBattle, t: TacStack, id: string): void {
  bt.heroes[1].fx.push({ id, until: bt.round, on: t.id, foe: true, mods: { still: true } });
}

/** The great one plays its part: called as the fight opens and after every turn (idempotent within a turn). */
export function direct(bt: TacBattle, rng: Rng): void {
  const d = duels.get(bt);
  if (!d || bt.over) return;
  const boss = stackById(bt, d.boss);
  if (!boss) {
    // The great one is down: its kin scatter.
    bt.warn = undefined;
    bt.over = { winner: 0, why: 'rout' };
    bt.active = null;
    bt.seq++;
    return;
  }
  if (d.phase === 0 && tacHp(boss) <= d.hp0 * SHORE_BOSSES[d.kind].turn) {
    d.phase = 1;
    turn(bt, d, boss);
  }
  everyTurn(bt, d, boss);
  if (bt.round > d.round && !bt.over) {
    d.round = bt.round;
    for (const f of d.fires) if (f.until < bt.round && bt.cells[f.hex] === 'F') bt.cells[f.hex] = f.was;
    d.fires = d.fires.filter((f) => f.until >= bt.round);
    if (stackById(bt, d.boss)) roundOpens(bt, d, stackById(bt, d.boss)!, rng);
  }
  d.seen = bt.events;
  checkOver(bt);
  if (!bt.over && !stackById(bt, d.boss)) direct(bt, rng);
}

/** The second phase opens. */
function turn(bt: TacBattle, d: Duel, boss: TacStack): void {
  const h = bt.heroes[1];
  switch (d.kind) {
    case 'mire_mother':
      // The Bloat: her hide swells a quarter thicker.
      h.fx.push({ id: 'mire_bloat', until: 999, on: boss.id, mods: { taken: -0.25 } });
      say(bt, d, 'bloat');
      break;
    case 'cinder_salamander':
      say(bt, d, 'hide');
      break;
    case 'drowned_abbess':
      say(bt, d, 'choir');
      break;
    case 'walrus_tyrant':
      h.fx.push({ id: 'walrus_rut', until: 999, on: boss.id, mods: { init: 2, melee: 0.15 } });
      say(bt, d, 'rut');
      break;
  }
}

/** After every turn: the Abbess's ward kept while a bell-ringer stands; the Salamander's molten hide answering blows. */
function everyTurn(bt: TacBattle, d: Duel, boss: TacStack): void {
  if (d.kind === 'drowned_abbess') {
    const h = bt.heroes[1];
    const ringers = bt.stacks.some((x) => x.side === 1 && x.count > 0 && x.unit === 'cultist');
    h.fx = h.fx.filter((f) => f.id !== 'ringers_ward');
    if (ringers) h.fx.push({ id: 'ringers_ward', until: bt.round, on: boss.id, mods: { taken: -0.65 } });
    if (d.warded && !ringers) say(bt, d, 'ward'); // the prayer is broken
    d.warded = ringers;
  }
  if (d.kind === 'cinder_salamander' && d.phase === 1) {
    // Molten Hide: a fifth of every blow struck on her comes back on the striker as fire.
    for (const e of bt.log) {
      if (e.i <= d.seen || e.k !== 'hit' || e.side !== 0 || e.t !== boss.id || e.s === undefined) continue;
      const a = stackById(bt, e.s);
      if (!a) continue;
      const dmg = Math.max(1, Math.round((e.dmg ?? 0) * 0.2));
      const kills = tacHurt(bt, a, dmg, 1);
      tacPush(bt, { k: 'burn', side: a.side, s: a.id, dmg, kills, hex: a.hex });
    }
  }
}

/** A round opens: the move warned last round falls; the next is warned. */
function roundOpens(bt: TacBattle, d: Duel, boss: TacStack, rng: Rng): void {
  const R = bt.round;
  switch (d.kind) {
    case 'mire_mother': {
      if (d.marked !== null) tongue(bt, d, boss, d.marked);
      d.marked = null;
      if (bt.over) return;
      // The brood: every third round (the second, bloated), three broods (five).
      if (R > 1 && R % (d.phase ? 2 : 3) === 0 && d.broods < (d.phase ? 5 : 3)) {
        const st = summon(bt, 'giant_toad', shoreSummon(d.kind, 'giant_toad', d.level, 0.22), boss.hex);
        if (st) {
          d.broods++;
          say(bt, d, 'brood', [st.id]);
        }
      }
      // Bloated, she weeps poison on everything beside her.
      if (d.phase) {
        const near = beside(bt, boss.hex);
        for (const t of near) t.poison = { dmg: Math.max(1, Math.round(tacHp(t) * 0.05)), left: 2, by: 1 };
        if (near.length) say(bt, d, 'bloat', near.map((t) => t.id));
      }
      // The next mark: her farthest stack (a shooter before steel), every other round (bloated, every round).
      if (d.phase || R % 2 === 1) {
        const far = foes(bt).filter((t) => hexDist(t.hex, boss.hex) > 1).sort((a, b) => hexDist(b.hex, boss.hex) - hexDist(a.hex, boss.hex) || Number(isShooter(b)) - Number(isShooter(a)))[0];
        if (far) {
          mark(bt, far);
          d.marked = far.id;
          say(bt, d, 'aim', [far.id]);
        }
      }
      return;
    }
    case 'cinder_salamander': {
      if (d.pending) breathe(bt, d, d.pending);
      d.pending = null;
      bt.warn = undefined;
      if (bt.over) return;
      // The ground she will breathe on: under her strongest stacks (two; three wounded) and a hex beside each.
      if (d.phase ? R % 2 === 1 : R % 3 === 1) {
        const targets = foes(bt).sort((a, b) => tacHp(b) - tacHp(a)).slice(0, d.phase ? 3 : 2);
        const hexes = new Set<number>();
        for (const t of targets) {
          hexes.add(t.hex);
          const nb = hexNeighbors(t.hex).filter((j) => ground(bt, j) && !hexes.has(j));
          if (nb.length) hexes.add(rng.pick(nb));
        }
        if (hexes.size) {
          d.pending = [...hexes];
          bt.warn = [...hexes];
          say(bt, d, 'mark', targets.map((t) => t.id));
        }
      }
      return;
    }
    case 'drowned_abbess': {
      if (d.pending) toll(bt, d, boss, d.pending);
      d.pending = null;
      bt.warn = undefined;
      if (bt.over) return;
      // The bell swings back: the ground within two hexes of her (every third round; the choir's, every other).
      if (d.phase ? R % 2 === 0 : R % 3 === 2) {
        const hexes: number[] = [];
        for (let i = 0; i < bt.cells.length; i++) if (ground(bt, i) && hexDist(i, boss.hex) <= 2 && i !== boss.hex) hexes.push(i);
        d.pending = hexes;
        bt.warn = hexes;
      }
      return;
    }
    case 'walrus_tyrant': {
      if (d.marked !== null) charge(bt, d, boss, d.marked, rng);
      d.marked = null;
      if (bt.over || !stackById(bt, d.boss)) return;
      // The next: her strongest stack, every other round (in the rut, every round).
      if (d.phase || R % 2 === 1) {
        const t = foes(bt).sort((a, b) => tacHp(b) - tacHp(a))[0];
        if (t) {
          mark(bt, t);
          d.marked = t.id;
          say(bt, d, 'aim', [t.id]);
        }
      }
      return;
    }
  }
}

/** The Mire Mother's tongue: the marked stack dragged in beside her, struck and held — unless it stands by a rock or
 *  a palm, and holds fast. */
function tongue(bt: TacBattle, d: Duel, boss: TacStack, id: number): void {
  const t = stackById(bt, id);
  if (!t || t.side !== 0 || hexDist(t.hex, boss.hex) <= 1) return;
  if (byCover(bt, t.hex)) return say(bt, d, 'hold', [t.id]);
  const spots = hexNeighbors(boss.hex).filter((j) => free(bt, j)).sort((a, b) => hexDist(a, t.hex) - hexDist(b, t.hex));
  if (!spots.length) return;
  t.hex = spots[0];
  tacPush(bt, { k: 'move', side: 0, s: t.id, hex: t.hex });
  const dmg = Math.max(t.hpMax, Math.round(tacHp(t) * 0.08));
  const kills = tacHurt(bt, t, dmg, 1);
  tacPush(bt, { k: 'hit', side: 1, s: boss.id, t: t.id, dmg, kills, hex: t.hex });
  if (t.count > 0) still(bt, t, 'mire_held');
  say(bt, d, 'tongue', [t.id]);
}

/** The Salamander's breath on the warned ground: it burns for two rounds, and whatever of hers stands there now burns. */
function breathe(bt: TacBattle, d: Duel, hexes: number[]): void {
  const hit: number[] = [];
  for (const i of hexes) {
    if (!ground(bt, i)) continue;
    if (bt.cells[i] !== 'F') {
      d.fires.push({ hex: i, was: bt.cells[i], until: bt.round + 1 });
      bt.cells[i] = 'F';
    }
    const t = foes(bt).find((x) => x.hex === i);
    if (!t) continue;
    const dmg = Math.max(t.hpMax, Math.round(tacHp(t) * 0.15));
    const kills = tacHurt(bt, t, dmg, 1);
    tacPush(bt, { k: 'burn', side: 0, s: t.id, dmg, kills, hex: i });
    hit.push(t.id);
  }
  say(bt, d, 'breath', hit);
}

/** The Abbess's toll: the living of hers on the warned ground stand still this round; her drowned rise; the choir
 *  calls more up out of the surf. */
function toll(bt: TacBattle, d: Duel, boss: TacStack, hexes: number[]): void {
  const stilled: number[] = [];
  for (const t of foes(bt)) {
    if (!hexes.includes(t.hex) || t.sp.includes('undead') || t.sp.includes('steady')) continue;
    still(bt, t, 'abbess_toll');
    stilled.push(t.id);
  }
  for (const x of bt.stacks) {
    if (x.side !== 1 || x.unit !== 'surf_drowned' || x.count >= x.start) continue;
    if (x.count === 0) {
      const at = occupied(bt, x.hex) || !ground(bt, x.hex) ? freeNear(bt, boss.hex) : x.hex;
      if (at === null) continue;
      x.hex = at;
    }
    const was = x.count, hp = tacHp(x);
    const tot = hp + Math.min(x.start * x.hpMax - hp, Math.round(x.start * x.hpMax * 0.3));
    x.count = Math.ceil(tot / x.hpMax);
    x.hpTop = tot - (x.count - 1) * x.hpMax;
    bt.dead[1] = Math.max(0, bt.dead[1] - (x.count - was));
    tacPush(bt, { k: 'regen', side: 1, s: x.id, dmg: tot - hp, hex: x.hex });
  }
  say(bt, d, 'toll', stilled);
  if (d.phase) {
    const st = summon(bt, 'surf_drowned', shoreSummon(d.kind, 'surf_drowned', d.level, 0.2), boss.hex);
    if (st) say(bt, d, 'choir', [st.id]);
  }
}

/** The Walrus's charge on the stack marked last round: down beside it, a double blow (half on a stack that braced),
 *  half-blows on the rest of hers about him. Boxed in — no room beside it — he breaks on the wall of them. */
function charge(bt: TacBattle, d: Duel, boss: TacStack, id: number, rng: Rng): void {
  const t = stackById(bt, id);
  if (!t || t.side !== 0) return;
  const spots = hexNeighbors(t.hex).filter((j) => free(bt, j) || j === boss.hex);
  if (!spots.length) {
    const dmg = Math.round(d.hp0 * 0.1);
    const kills = tacHurt(bt, boss, dmg, 0);
    tacPush(bt, { k: 'hit', side: 0, s: t.id, t: boss.id, dmg, kills, hex: boss.hex });
    if (boss.count > 0) bt.heroes[1].fx.push({ id: 'walrus_dazed', until: bt.round, on: boss.id, mods: { still: true } });
    return say(bt, d, 'broke', [t.id]);
  }
  const dest = spots.sort((a, b) => hexDist(boss.hex, a) - hexDist(boss.hex, b))[0];
  if (dest !== boss.hex) {
    boss.hex = dest;
    tacPush(bt, { k: 'move', side: 1, s: boss.id, hex: dest });
  }
  const dmg = Math.max(1, Math.round(blow(bt, boss, t, 'melee', rng).dmg * 1.6 * (t.defending ? 0.5 : 1)));
  const kills = tacHurt(bt, t, dmg, 1);
  tacPush(bt, { k: 'hit', side: 1, s: boss.id, t: t.id, dmg, kills, hex: t.hex });
  for (const o of beside(bt, boss.hex)) {
    if (o === t) continue;
    const b = Math.max(1, Math.round(blow(bt, boss, o, 'melee', null).dmg * 0.5));
    const k2 = tacHurt(bt, o, b, 1);
    tacPush(bt, { k: 'hit', side: 1, s: boss.id, t: o.id, dmg: b, kills: k2, hex: o.hex });
  }
  say(bt, d, 'charge', [t.id]);
}

// ================================================================================================ the tests' and the balance's

/** The fight played out at once (quick combat; a captain gone from the sea; the tests and the balance): both sides by
 *  the sea's mind, the great one's moves between the turns. */
export function playOut(bt: TacBattle, rng: Rng, now: number): void {
  direct(bt, rng);
  for (let i = 0; i < 5000 && !bt.over; i++) {
    if (bt.active === null) break;
    aiAct(bt, now, rng);
    direct(bt, rng);
  }
  if (!bt.over) {
    bt.over = { winner: 1, why: 'rounds' };
    bt.active = null;
    bt.seq++;
  }
}

/** A captain's side as the balance reckons it (no hero, no ladder). */
function captainSide(army: ArmyStack[]): TacSideInput {
  return { ...beastSide(army), captain: 'corsair', morale: 70, noBook: undefined };
}

/** One battle ashore of a party against a great one at a level, both sides played by the sea's mind, the great one's
 *  moves by the director: who won, the share of her men she lost, the rounds, the moves played. */
export function simulateShore(kind: ShoreBossId, level: number, party: ArmyStack[], seed: number): { won: boolean; lost: number; rounds: number; moves: Partial<Record<ShoreMove, number>> } {
  const rng = new Rng(seed);
  const def = SHORE_BOSSES[kind];
  const bt = newBattle(captainSide(party), { ...beastSide(shoreArmy(kind, level)), name: def.name[0] }, seed, 0, rng, { land: def.types[0] });
  const d = startDuel(bt, kind, level);
  playOut(bt, rng, 0);
  const men = party.reduce((a, x) => a + x.n, 0);
  const lost = lossesOf(bt, 0).reduce((a, x) => a + x.n, 0);
  return { won: bt.over?.winner === 0, lost: lost / Math.max(1, men), rounds: bt.round, moves: { ...d.moves } };
}
