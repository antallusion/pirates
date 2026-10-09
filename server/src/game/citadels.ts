// docs/19 E4–E8 on the server: the twelve citadels of the Throne war (shared/src/data/citadels.ts places them).
//  - E4: each citadel's garrison (the sixth and seventh tiers) under its castellan, behind its walls; on the charts and
//    the sea for everyone (the `citadels` message), the Throne's tab for the captains of the cap.
//  - E5: an assault is a boarding: the castellan's ship comes alongside at the anchorage and grapples at once (as a
//    trial's legend does: throne.ts startTrial; abyssraid.ts boardRaid), and the battle is the siege before the walls
//    (tacbattle.ts: the wall line, the gate, the towers, the moat, the catapult; the ship's broadside before the
//    assault). What an assault cuts of the garrison and of the walls stays cut for the next assault of the siege.
//  - E6: a guild that takes a citadel holds it: its sea's tax into the treasury each hour, a titan a week for its
//    captains (titans.ts citadelTitan), the Throne war's points, its flag on the charts; its captains leave men in the
//    garrison, beside the castellan's own guard (filled again each week).
//  - E7: a siege is declared for one of the citadel's two windows a week, an hour ahead at the least; the guild that
//    holds it is summoned (a toast, its journal and its officers' mail, the captain's log, the taverns of its sea).
//    In the window the besiegers' captains assault it one at a time, each once.
//  - E8: the season of the Throne war (seasons.ts's): the guilds by their points; the season's winner into the
//    Pantheon as the Masters of the Throne (a title and a pennant for its captains, its flag crowned on the charts),
//    and its citadels a stone harder and its towers harder the season after.
// Every roll is on this system's own Rng; the clock is the game's wall clock.

import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import {
  CITADELS, CIT_NOTICE_MS, CIT_OWN, CIT_POINTS, CIT_RANGE, CIT_TOWER, CIT_WARD, CIT_WINDOW_MS, THRONE_PENNANT, THRONE_TITLE, addToGarrison, buildCitadels, gatherGarrison,
  castellanOf, citBombard, citGarrison, citName, citNextWindow, citSpellHp, citTax, citWeek, citWindowAt,
} from '../../../shared/src/data/citadels.ts';
import type { CitMark, CitRow, CitView, CitadelDef } from '../../../shared/src/data/citadels.ts';
import { ORDER_IDS, SKILL_IDS, heroBattle, manaMaxOf, startingOrders } from '../../../shared/src/data/hero.ts';
import type { HeroBattle, OrderId, SkillSlot } from '../../../shared/src/data/hero.ts';
import { SIEGE } from '../../../shared/src/data/tactical.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { parkNear } from './advmap.ts';
import { startBoarding } from './boarding.ts';
import { logNote } from './captainlog.ts';
import type { Game } from './Game.ts';
import { relicPartDrop } from './relics.ts';
import { contractCitadel, contractGarrison } from './admiralty.ts'; // docs/19 E15
import { foundGuild, guildNotify, log as guildLog, member, rankAtLeast } from './guilds.ts';
import type { Guild } from './guilds.ts';
import { heroOf } from './hero.ts';
import type { PlayerSession } from './player.ts';
import { chronicle } from './renown.ts';
import { seasonId } from './seasons.ts';
import { SEASON_DAYS, SEASON_EPOCH } from '../../../shared/src/data/seasons.ts';
import type { ShipEntity } from './ship.ts';
import { siegeLeft } from './tacbattle.ts';
import type { SiegeInput, TacBattle } from './tacbattle.ts';
import { citadelTitan, titanWhy } from './titans.ts';
import { isTitan } from '../../../shared/src/data/titans.ts';

const KEY = 'citadels';
const HOUR = 3_600_000;

interface CitRec {
  owner: number | null;
  since: number;
  garrison: ArmyStack[];
  /** The wall line now, stones left in each row (a siege's assaults wear it; it is mended when the window closes). */
  hp: number[];
  /** The week its titan was hired (−1: not yet), and the week its garrison last grew back. */
  titanWeek: number;
  grown: number;
  /** Who of its guild left men in the garrison (by account): her name and how many. */
  left: Record<string, { name: string; men: number }>;
}

interface SiegeRec {
  gid: number;
  tag: string;
  guild: string;
  by: string;
  declared: number;
  start: number;
  end: number;
  /** The captains who have assaulted (each once) and their names; one aboard the castellan now. */
  assaults: number[];
  names: Record<string, string>;
  fighting?: number;
  /** Hit points of the garrison each captain cut down. */
  cut: Record<string, number>;
  /** The window's opening told. */
  told?: boolean;
}

interface Store {
  v: 1;
  season: number;
  cits: CitRec[];
  sieges: Record<string, SiegeRec>;
  /** The Throne war this season: points by guild id, and each guild's tag and name as last seen. */
  points: Record<string, number>;
  guilds: Record<string, { tag: string; name: string }>;
  /** The last season's Masters of the Throne, and every season's. */
  champion?: { gid: number; tag: string; name: string; season: number };
  pantheon: { gid: number; tag: string; name: string; season: number; points: number; members: number[] }[];
  /** The last whole hour of holding paid (wall ms). */
  hourAt: number;
  /** Windows opened by the tester's word; seasons the tester has closed ahead of the calendar. */
  open: { cit: number; start: number; end: number }[];
  shift?: number;
}

/** The Throne war's season: the calendar's (seasons.ts), and as many more as the tester has closed. */
const warSeason = (game: Game): number => seasonId(game) + (stores.get(game)?.shift ?? 0);

const rngs = new WeakMap<Game, Rng>();
function cr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0xc17ade1)));
  return r;
}

const defs = (game: Game): CitadelDef[] => buildCitadels(game.world);
const baseHp = (): number[] => Array(9).fill(SIEGE.hp);

const stores = new WeakMap<Game, Store>();
function store(game: Game): Store {
  let s = stores.get(game);
  if (s) return s;
  s = game.db.getKv<Store>(KEY) ?? undefined;
  const now = game.wallNow();
  if (!s || s.v !== 1 || !Array.isArray(s.cits)) {
    s = { v: 1, season: seasonId(game), cits: [], sieges: {}, points: {}, guilds: {}, pantheon: [], hourAt: Math.floor(now / HOUR) * HOUR, open: [] };
  }
  const week = citWeek(now);
  for (const c of defs(game)) s.cits[c.id] ??= { owner: null, since: now, garrison: citGarrison(c.level), hp: baseHp(), titanWeek: -1, grown: week, left: {} };
  s.open ??= [];
  stores.set(game, s);
  return s;
}
const save = (game: Game) => game.db.setKv(KEY, stores.get(game)!);

const hpOf = (army: readonly ArmyStack[]): number => army.reduce((a, x) => a + x.n * (UNITS[x.u]?.hp ?? 0), 0);

/** The Masters of the Throne's ward on a citadel this season: theirs, and the season after their winning. */
function warded(game: Game, rec: CitRec): boolean {
  const S = store(game);
  return !!S.champion && rec.owner === S.champion.gid && S.season === S.champion.season + 1;
}
const maxOf = (game: Game, rec: CitRec): number[] => Array(9).fill(SIEGE.hp + (warded(game, rec) ? CIT_WARD.hp : 0));
/** The wall line whole (the ward's stone with it). */
const mend = (game: Game, rec: CitRec): void => {
  rec.hp = maxOf(game, rec);
};

const nameOf = (c: CitadelDef): string => citName(c, 0);

function guildOf(game: Game, gid: number | null): Guild | null {
  return gid === null ? null : game.guilds.get(game, gid);
}
function tagOf(game: Game, gid: number): { tag: string; name: string } {
  const g = guildOf(game, gid);
  if (g) store(game).guilds[gid] = { tag: g.tag, name: g.name };
  return store(game).guilds[gid] ?? { tag: '?', name: '?' };
}

/** The window open now at a citadel (the tester's too), or null. */
function windowNow(game: Game, id: number): { start: number; end: number } | null {
  const now = game.wallNow();
  const t = store(game).open.find((x) => x.cit === id && now >= x.start && now < x.end);
  return t ?? citWindowAt(id, now);
}

/** The siege of a citadel in force now (declared for the window open now). */
function siegeNow(game: Game, id: number): SiegeRec | null {
  const sg = store(game).sieges[id];
  if (!sg) return null;
  const now = game.wallNow();
  return now >= sg.start && now < sg.end ? sg : null;
}

const hhmm = (ms: number): string => {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

// ------------------------------------------------------------------ the castellan

/** The orders of a wall's keeper: her path's own, then those that hold a wall — the shields, the steel, the mending, the
 *  dread from the battlements, the wind against the besiegers — none that rains on a whole field. */
const KEEPER: OrderId[] = ['shield_wall', 'mark_target', 'brine_mend', 'dread', 'head_wind', 'war_cry', 'tide_returns', 'iron_discipline', 'fury'];

/** The castellan of a citadel as a hero: her path's book and a keeper's orders by the citadel's level, primaries over
 *  the cap's, the sea's skills at her rank. */
export function castellanHero(id: number, level: 9 | 10): HeroBattle {
  const c = castellanOf(id, level);
  const p = 8 + c.prim;
  const prim = { atk: p, def: p, pow: p, will: p };
  const skills: SkillSlot[] = SKILL_IDS.filter((x) => x !== 'trading' && x !== 'navigation').slice(0, level === 10 ? 4 : 3).map((x) => ({ id: x, r: c.rank }));
  const own = startingOrders(c.path);
  const keep = KEEPER.filter((x) => ORDER_IDS.includes(x) && !own.includes(x));
  const book: OrderId[] = [...own, ...keep.slice(0, Math.ceil(keep.length * c.book * 2))];
  return heroBattle(prim, skills, null, book, manaMaxOf(prim.will) * 2, { path: c.path, level: MAX_LEVEL });
}

/** The castellans alongside now: whose assault, which citadel, the garrison as it came aboard. */
const castellans = new WeakMap<ShipEntity, { cit: number; acc: number; before: ArmyStack[] }>();
const heroes = new WeakMap<ShipEntity, { hero: HeroBattle; face: string }>();

/** A castellan's ship alongside (throne.ts isTrialShip: no artifact on her, none of hers joins). */
export const isCastellan = (ship: ShipEntity): boolean => castellans.has(ship);
/** The hero a castellan brings aboard (hero.ts heroInput), and her face (heroFace). */
export const castellanHeroOf = (ship: ShipEntity): HeroBattle | undefined => heroes.get(ship)?.hero;
export const castellanFaceOf = (ship: ShipEntity): string | undefined => heroes.get(ship)?.face;

/** The siege's own field for a boarding of a castellan's ship (tactical.ts startTactical): the walls as the siege left
 *  them, her ship's broadside, her catapult (a second stone with Artillery advanced), the towers; and the garrison in
 *  its own seven stacks. Null for any other boarding. */
export function siegeSetup(game: Game, a: ShipEntity, b: ShipEntity): { siege: SiegeInput; army: ArmyStack[]; spellHp: number } | null {
  const L = castellans.get(b);
  if (!L) return null;
  const c = defs(game)[L.cit];
  const S = store(game);
  const rec = S.cits[L.cit];
  const s = game.sessionOf(a);
  const art = s?.profile ? heroOf(s.profile).skills.find((x) => x.id === 'artillery')?.r ?? 0 : 0;
  const max = maxOf(game, rec);
  return {
    siege: {
      type: c.type, hp: rec.hp.map((h, y) => Math.min(max[y], h)), max, bombard: citBombard(a.stats.gunsPerSide, a.stats.gunDamageMul),
      catapult: art >= 2 ? 2 : 1, tower: CIT_TOWER * (warded(game, rec) ? CIT_WARD.tower : 1), name: nameOf(c),
    },
    army: L.before.map((x) => ({ ...x })),
    spellHp: citSpellHp(c.level),
  };
}

// ------------------------------------------------------------------ the siege declared (E7)

/** Why she may not declare a siege on this citadel now (null: she may). */
function declareWhy(game: Game, s: PlayerSession, id: number): string | null {
  const p = s.profile;
  if (!p || p.level < MAX_LEVEL) return `The Throne war opens at level ${MAX_LEVEL}.`;
  const g = game.guilds.of(game, s.accountId);
  if (!g) return 'Only a guild may besiege a citadel.';
  if (!rankAtLeast(member(g, s.accountId), 'captain')) return 'Only a captain of your guild or above may declare a siege.';
  const S = store(game);
  const rec = S.cits[id];
  if (rec.owner === g.id) return 'Your guild holds it already.';
  if (rec.owner !== null && g.alliance.includes(rec.owner)) return 'Your ally holds it.';
  const sg = S.sieges[id];
  if (sg) return sg.gid === g.id ? 'Your guild has declared a siege on it already.' : `[${sg.tag}] has declared a siege on it already.`;
  if (Object.values(S.sieges).filter((x) => x.gid === g.id).length >= 2) return 'Two sieges at a time at the most for a guild.';
  return null;
}

/** A siege declared for the citadel's next window an hour ahead at the least (the tester's `now`: for the window open
 *  now), and the holders summoned. */
export function declareSiege(game: Game, s: PlayerSession, id: number, now = false): string | null {
  if (!defs(game)[id]) return 'No such citadel.';
  const why = declareWhy(game, s, id);
  if (why) return why;
  const S = store(game);
  const g = game.guilds.of(game, s.accountId)!;
  const w = now ? windowNow(game, id) ?? openWindow(game, id) : citNextWindow(id, game.wallNow(), CIT_NOTICE_MS);
  const c = defs(game)[id];
  S.sieges[id] = { gid: g.id, tag: g.tag, guild: g.name, by: s.name, declared: game.wallNow(), start: w.start, end: w.end, assaults: [], names: {}, cut: {} };
  tagOf(game, g.id);
  guildLog(game, g, `${s.name} declares a siege on the ${nameOf(c)}.`);
  game.sendTo(s, { t: 'toast', msg: `Your guild besieges the ${nameOf(c)}. The window opens in ${hhmm(w.start - game.wallNow())}.`, kind: 'gold' });
  summon(game, id, S.sieges[id]);
  save(game);
  touch(game);
  return null;
}

/** The holders of a besieged citadel summoned: a toast to every captain of theirs at sea, their journal and their
 *  officers' mail, a line in each one's log; the taverns of its sea talk of it. */
function summon(game: Game, id: number, sg: SiegeRec): void {
  const c = defs(game)[id];
  const rec = store(game).cits[id];
  const when = hhmm(Math.max(0, sg.start - game.wallNow()));
  const g = guildOf(game, rec.owner);
  if (g) {
    guildNotify(game, g.id, `Summons: [${sg.tag}] besieges the ${nameOf(c)}`, `[${sg.tag}] ${sg.guild} declares a siege on the ${nameOf(c)}. The window opens in ${when}: leave men in its garrison before then.`);
    for (const m of g.members) {
      const ms = game.sessionByAccount(m.account);
      if (!ms) continue;
      game.sendTo(ms, { t: 'toast', msg: `Summons: [${sg.tag}] besieges the ${nameOf(c)}. The window opens in ${when}.`, kind: 'bad' });
      logNote(game, ms, 'siege', [sg.tag, nameOf(c)]);
    }
  }
  for (const port of game.world.ports) if (port.region === c.region) game.addRumor(port.x, port.y, `[${sg.tag}] gathers to besiege the ${nameOf(c)}.`);
}

/** A window opened by the tester's word now, two hours long. */
function openWindow(game: Game, id: number): { start: number; end: number } {
  const S = store(game);
  const w = { cit: id, start: game.wallNow() - 1000, end: game.wallNow() + CIT_WINDOW_MS };
  S.open = S.open.filter((x) => x.cit !== id && x.end > game.wallNow());
  S.open.push(w);
  if (S.sieges[id]) Object.assign(S.sieges[id], { start: w.start, end: w.end });
  save(game);
  touch(game);
  return { start: w.start, end: w.end };
}

// ------------------------------------------------------------------ the assault (E5)

/** Why she may not assault this citadel now (null: she may). */
function assaultWhy(game: Game, s: PlayerSession, id: number): string | null {
  const p = s.profile, ship = s.ship;
  if (!p || p.level < MAX_LEVEL) return `The Throne war opens at level ${MAX_LEVEL}.`;
  const g = game.guilds.of(game, s.accountId);
  if (!g) return 'Only a guild may besiege a citadel.';
  const S = store(game);
  const sg = S.sieges[id];
  if (!sg || (sg.gid !== g.id && !g.alliance.includes(sg.gid))) return 'Declare a siege on it first: only the besiegers assault it.';
  const now = game.wallNow();
  if (now < sg.start) return `The window opens in ${hhmm(sg.start - now)}.`;
  if (now >= sg.end) return 'The window is closed.';
  if (sg.assaults.includes(s.accountId)) return 'You have assaulted it once in this siege.';
  if (sg.fighting !== undefined && sg.fighting !== s.accountId) return 'Another captain of the siege is at the walls now.';
  if (!ship || !ship.alive || ship.docked) return 'Put to sea first.';
  if (ship.boarding || ship.grappled || ship.landing) return 'Not in the middle of a boarding';
  if (!game.tacticalBoarding) return 'The siege is fought on the hexes.';
  const c = defs(game)[id];
  if (dist(c.x, c.y, ship.state.x, ship.state.y) > CIT_RANGE) return 'Come to its anchorage: the assault begins before its gate.';
  if (ship.underFire(game.now)) return 'Not while under fire';
  if (!S.cits[id].garrison.some((x) => x.n > 0)) return 'Its garrison is gone: it is yours to take.';
  return null;
}

/** Her assault: the castellan's ship comes alongside at the anchorage and grapples; the battle is before the walls. */
export function assaultCitadel(game: Game, s: PlayerSession, id: number): string | null {
  if (!defs(game)[id]) return 'No such citadel.';
  const S = store(game);
  const rec = S.cits[id];
  // An empty garrison: the besiegers walk in.
  const sg = S.sieges[id];
  const g = game.guilds.of(game, s.accountId);
  if (!rec.garrison.some((x) => x.n > 0) && sg && g && (sg.gid === g.id || g.alliance.includes(sg.gid)) && siegeNow(game, id) && dist(defs(game)[id].x, defs(game)[id].y, s.ship?.state.x ?? 0, s.ship?.state.y ?? 0) <= CIT_RANGE) {
    capture(game, id, sg.gid);
    return null;
  }
  const why = assaultWhy(game, s, id);
  if (why) return why;
  const c = defs(game)[id];
  const ship = s.ship!;
  const cas = castellanOf(id, c.level);
  const side = cr(game).chance(0.5) ? 1 : -1;
  const v = headingVec(ship.state.heading + (side * Math.PI) / 2);
  const o = game.spawnNpcShip('hunter', 'man_o_war', 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading, { ship: nameOf(c), captain: cas.name[0] });
  game.setNpcLevel(o, c.level);
  const before = rec.garrison.filter((x) => x.n > 0).map((x) => ({ ...x }));
  o.setArmy(before);
  o.god = true;
  o.morale = 90;
  o.purse = 0;
  o.input = { rudder: 0, sailTarget: 0 };
  o.state.speed = ship.state.speed = 0;
  const brain = game.npcs.get(o.id);
  if (brain) brain.active = true;
  game.grid.upsert(o.id, o.state.x, o.state.y);
  castellans.set(o, { cit: id, acc: s.accountId, before });
  heroes.set(o, { hero: castellanHero(id, c.level), face: `portrait.${cas.path}` });
  sg!.fighting = s.accountId;
  sg!.assaults.push(s.accountId);
  sg!.names[s.accountId] = s.name;
  save(game);
  touch(game);
  game.sendTo(s, { t: 'toast', msg: `${cas.name[0]} holds the ${nameOf(c)}: the assault begins before its walls.`, kind: 'gold' });
  startBoarding(game, ship, o, 'standard');
  return null;
}

/** An assault over (boarding.ts finishBoarding, before any prize): what she cut of the garrison and of the walls stays
 *  cut for the next of the siege; the garrison struck — the citadel taken. True when it was one. */
export function assaultOver(game: Game, a: ShipEntity, b: ShipEntity, attackerWins: boolean, bt?: TacBattle): boolean {
  const cas = castellans.has(b) ? b : castellans.has(a) ? a : null;
  if (!cas) return false;
  const L = castellans.get(cas)!;
  const mine = cas === b ? a : b;
  const won = cas === b ? attackerWins : !attackerWins;
  castellans.delete(cas);
  heroes.delete(cas);
  game.removeShip(cas.id);
  const S = store(game);
  const rec = S.cits[L.cit];
  const c = defs(game)[L.cit];
  const sg = S.sieges[L.cit];
  const side = cas === b ? 1 : 0;
  const left = won ? [] : bt ? bt.stacks.filter((x) => x.side === side && x.count > 0).map((x) => ({ u: x.unit, n: x.count })) : L.before;
  const cut = Math.max(0, hpOf(L.before) - hpOf(left));
  rec.garrison = left;
  const walls = bt ? siegeLeft(bt) : null;
  if (walls) rec.hp = walls;
  contractCitadel(game, L.acc, 'assault'); // docs/19 E15: a watch on the walls for the Admiralty
  if (sg) {
    if (sg.fighting === L.acc) sg.fighting = undefined;
    sg.cut[L.acc] = (sg.cut[L.acc] ?? 0) + cut;
  }
  if (mine.alive) mine.state.speed = 0;
  const s = game.sessionOf(mine);
  if (won && sg) capture(game, L.cit, sg.gid);
  else if (won && s) {
    const g = game.guilds.of(game, s.accountId);
    if (g) capture(game, L.cit, g.id);
  } else if (s) {
    const share = Math.round((cut / Math.max(1, hpOf(L.before))) * 100);
    game.toastShip(mine, `The garrison of the ${nameOf(c)} holds. Your assault cut ${share}% of it; what is left of it and of its walls waits for the next of your siege.`, 'bad');
  }
  save(game);
  touch(game);
  if (s) game.pushSelf(s, true);
  return true;
}

/** A citadel taken by a guild: its castellan's own guard raised for the new holders, the walls mended, the war's
 *  points, the chronicle and the news; the old holders told. */
function capture(game: Game, id: number, gid: number): void {
  const S = store(game);
  const rec = S.cits[id];
  const c = defs(game)[id];
  const prev = rec.owner;
  const t = tagOf(game, gid);
  rec.owner = gid;
  rec.since = game.wallNow();
  rec.garrison = gatherGarrison(citGarrison(c.level, CIT_OWN));
  mend(game, rec);
  rec.left = {};
  rec.titanWeek = -1;
  const besiegers = S.sieges[id]?.assaults ?? [];
  delete S.sieges[id];
  S.points[gid] = (S.points[gid] ?? 0) + CIT_POINTS.take;
  chronicle(game, `[${t.tag}] takes the ${nameOf(c)}.`);
  for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: [${t.tag}] ${t.name} takes the ${nameOf(c)}.`, kind: 'gold' });
  if (prev !== null && prev !== gid) guildNotify(game, prev, `The ${nameOf(c)} has fallen`, `[${t.tag}] ${t.name} has taken the ${nameOf(c)} from your guild.`);
  const g = guildOf(game, gid);
  if (g) guildLog(game, g, `Your guild takes the ${nameOf(c)}.`);
  for (const acc of besiegers) {
    contractCitadel(game, acc, 'take'); // docs/19 E15
    const bs = game.sessionByAccount(acc);
    if (!bs) continue;
    game.sendTo(bs, { t: 'toast', msg: `The ${nameOf(c)} is your guild’s: your assault was one of those that broke it.`, kind: 'gold' });
    relicPartDrop(game, bs, 'citadel', 0.35); // docs/19 E12: a part of a relic to each who broke it, a chance in three
  }
  save(game);
  touch(game);
}

// ------------------------------------------------------------------ holding it (E6)

/** Why she may not leave men in the garrison or hire its titan: her guild's, and her ship lying off it. */
function holdWhy(game: Game, s: PlayerSession, id: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  const rec = store(game).cits[id];
  if (!g || rec.owner !== g.id) return 'Only its guild’s captains may do that.';
  const ship = s.ship;
  if (!ship || !ship.alive || ship.docked) return 'Put to sea first.';
  if (ship.boarding || ship.grappled) return 'Not in the middle of a boarding';
  const c = defs(game)[id];
  if (dist(c.x, c.y, ship.state.x, ship.state.y) > CIT_RANGE) return 'Bring your ship to its anchorage.';
  if (store(game).sieges[id]?.fighting !== undefined) return 'Not while its walls are under assault.';
  return null;
}

/** `n` of her men of a kind left in the garrison of her guild's citadel she lies off. */
export function leaveInGarrison(game: Game, s: PlayerSession, id: number, u: string, n: number): string | null {
  if (!defs(game)[id]) return 'No such citadel.';
  const why = holdWhy(game, s, id);
  if (why) return why;
  const ship = s.ship!;
  const have = ship.army.find((x) => x.u === u)?.n ?? 0;
  const k = Math.max(0, Math.min(have, Math.floor(Number(n) || 0)));
  if (!k) return 'You have none of them aboard.';
  if (ship.crew - k < Math.max(1, ship.stats.crewMin)) return 'Keep hands enough aboard to sail her.';
  const rec = store(game).cits[id];
  if (!addToGarrison(rec.garrison, u as UnitId, k)) return 'Seven kinds of men in a garrison at the most.';
  ship.loseFrom(u as UnitId, k);
  ship.companyKey = '';
  const was = rec.left[s.accountId];
  rec.left[s.accountId] = { name: s.name, men: (was?.men ?? 0) + k };
  save(game);
  touch(game);
  game.toastShip(ship, `${k} of your men stand in the garrison of the ${nameOf(defs(game)[id])} now.`, 'good');
  game.pushSelf(s, true);
  return null;
}

/** The citadel's titan of the week, hired by a captain of its guild lying off it. */
export function hireCitadelTitan(game: Game, s: PlayerSession, id: number, u: string): string | null {
  if (!defs(game)[id]) return 'No such citadel.';
  const why = holdWhy(game, s, id);
  if (why) return why;
  const rec = store(game).cits[id];
  const week = citWeek(game.wallNow());
  if (rec.titanWeek === week) return 'Its titan of the week is taken: another rises next week.';
  if (!isTitan(u)) return 'No such titan.';
  const e = citadelTitan(game, s, u);
  if (e) return e;
  rec.titanWeek = week;
  save(game);
  return null;
}

// ------------------------------------------------------------------ the clock

/** Every second: a window's opening told, a siege's window closed, the hours of holding paid, the week's growth, the
 *  season's turn, a boarding long over forgotten, the charts sent. */
export function stepCitadels(game: Game): void {
  const S = store(game);
  const now = game.wallNow();
  let dirty = false;
  if (S.season !== warSeason(game)) {
    closeWar(game);
    dirty = true;
  }
  const week = citWeek(now);
  defs(game).forEach((c) => {
    const rec = S.cits[c.id];
    // A guild that is no more holds nothing: its castellan's men take the walls back.
    if (rec.owner !== null && !guildOf(game, rec.owner)) {
      rec.owner = null;
      rec.garrison = citGarrison(c.level);
      rec.left = {};
      mend(game, rec);
      dirty = true;
    }
    if (rec.grown < week && !siegeNow(game, c.id)) {
      // The week's growth: a neutral garrison whole again, an owned one's own guard filled; the walls mended.
      const own = citGarrison(c.level, rec.owner === null ? 1 : CIT_OWN);
      if (rec.owner === null) rec.garrison = own;
      else for (const x of own) {
        const have = rec.garrison.filter((y) => y.u === x.u).reduce((a, y) => a + y.n, 0);
        if (have < x.n) addToGarrison(rec.garrison, x.u, x.n - have);
      }
      mend(game, rec);
      rec.grown = week;
      dirty = true;
    }
  });
  for (const [k, sg] of Object.entries(S.sieges)) {
    const id = Number(k);
    const c = defs(game)[id];
    if (!c) continue;
    if (sg.fighting !== undefined) {
      const fs = game.sessionByAccount(sg.fighting);
      if (!fs?.ship?.boarding) sg.fighting = undefined;
    }
    if (!sg.told && now >= sg.start && now < sg.end) {
      sg.told = true;
      dirty = true;
      tellGuild(game, sg.gid, `The window of the ${nameOf(c)} is open: assault it before ${hhmm(sg.end - now)} are out.`);
      const holder = S.cits[id].owner;
      if (holder !== null) tellGuild(game, holder, `[${sg.tag}] is at the walls of the ${nameOf(c)}.`);
    }
    if (now >= sg.end && sg.fighting === undefined) {
      // The window closed and the garrison stands: the siege is lifted, the walls mended.
      const rec = S.cits[id];
      mend(game, rec);
      if (rec.owner !== null) {
        S.points[rec.owner] = (S.points[rec.owner] ?? 0) + CIT_POINTS.hold;
        tellGuild(game, rec.owner, `The siege of the ${nameOf(c)} is lifted: its garrison held.`);
      }
      tellGuild(game, sg.gid, `The siege of the ${nameOf(c)} is lifted: its garrison held.`);
      // docs/19 E12: its defenders — the captains who left men in it — a part of a relic each, a chance in seven.
      for (const acc of Object.keys(rec.left)) {
        contractCitadel(game, Number(acc), 'hold'); // docs/19 E15
        const ds = game.sessionByAccount(Number(acc));
        if (ds) relicPartDrop(game, ds, 'citadel', 0.15);
      }
      delete S.sieges[id];
      dirty = true;
    }
  }
  S.open = S.open.filter((x) => x.end > now);
  // The hours of holding: the sea's tax into the treasury, the war's points (a day's worth at the most after a stop).
  const hour = Math.floor(now / HOUR) * HOUR;
  if (hour > S.hourAt) {
    const n = Math.min(24, Math.round((hour - S.hourAt) / HOUR));
    S.hourAt = hour;
    for (const c of defs(game)) {
      const rec = S.cits[c.id];
      const g = guildOf(game, rec.owner);
      if (!g) continue;
      g.treasury += citTax(c.level) * n;
      S.points[g.id] = (S.points[g.id] ?? 0) + CIT_POINTS.hour[c.level] * n;
      tagOf(game, g.id);
      contractGarrison(game, rec.left, n); // docs/19 E15: the hours of her men in the garrison
    }
    game.guilds.touch();
    dirty = true;
  }
  if (dirty) {
    save(game);
    touch(game);
  }
  sendMarks(game);
}

function tellGuild(game: Game, gid: number, msg: string): void {
  const g = guildOf(game, gid);
  if (!g) return;
  for (const m of g.members) {
    const s = game.sessionByAccount(m.account);
    if (s) game.sendTo(s, { t: 'toast', msg, kind: 'info' });
  }
}

// ------------------------------------------------------------------ the season (E8)

/** The season's turn: the guild with the most points are the Masters of the Throne — the Pantheon, the chronicle, the
 *  title and the pennant for its captains, and the ward on its citadels the season after; the table begins again. */
function closeWar(game: Game): void {
  const S = store(game);
  const best = Object.entries(S.points).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0];
  if (best) {
    const gid = Number(best[0]);
    const t = tagOf(game, gid);
    const g = guildOf(game, gid);
    S.champion = { gid, tag: t.tag, name: t.name, season: S.season };
    S.pantheon.push({ gid, tag: t.tag, name: t.name, season: S.season, points: best[1], members: g?.members.map((m) => m.account) ?? [] });
    S.pantheon = S.pantheon.slice(-40);
    chronicle(game, `[${t.tag}] ${t.name} are the Masters of the Throne of season ${S.season + 1}.`);
    for (const o of game.sessions) {
      game.sendTo(o, { t: 'toast', msg: `WORLD: [${t.tag}] ${t.name} are the Masters of the Throne of season ${S.season + 1}.`, kind: 'gold' });
      applyThroneTitles(game, o);
    }
  }
  S.points = {};
  S.season = warSeason(game);
  save(game);
  touch(game);
}

/** A captain of the Masters of the Throne: the title and the pennant, once a season won (seasons.ts applyPantheon). */
export function applyThroneTitles(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p) return;
  for (const m of store(game).pantheon) {
    if (!m.members.includes(s.accountId)) continue;
    const key = `throne:${m.season}`;
    if (p.pantheon.includes(key)) continue;
    p.pantheon.push(key);
    const title = THRONE_TITLE[0];
    if (!p.titles.includes(title)) p.titles.push(title);
    if (!p.pennants.includes(THRONE_PENNANT)) p.pennants.push(THRONE_PENNANT);
    game.sendTo(s, { t: 'toast', msg: `Your guild are the Masters of the Throne: the Pantheon, a title and the Throne’s pennant are yours.`, kind: 'gold' });
  }
}

/** The Hall of the Throne in the Pantheon (seasons.ts seasonView): each season's Masters. */
export function throneHall(game: Game): { name: string; season: number }[] {
  return store(game).pantheon.map((m) => ({ name: `[${m.tag}] ${m.name}`, season: m.season + 1 }));
}

// ------------------------------------------------------------------ what the charts and the tab show

const sent = new WeakMap<PlayerSession, string>();
let lastMarks: { game: Game; at: number; json: string } | null = null;

function marks(game: Game): CitMark[] {
  const S = store(game);
  return defs(game).map((c) => {
    const rec = S.cits[c.id];
    const t = rec.owner !== null ? tagOf(game, rec.owner) : null;
    const sg = siegeNow(game, c.id);
    return {
      id: c.id, x: c.x, y: c.y, fx: c.fx, fy: c.fy, level: c.level, region: c.region, isle: c.isle,
      ...(t ? { tag: t.tag, guild: t.name } : {}), ...(warded(game, rec) ? { crown: true } : {}),
      ...(windowNow(game, c.id) ? { open: true } : {}), ...(sg ? { siege: sg.tag } : {}),
    };
  });
}

/** The charts' citadels to every captain who has not seen them as they stand (every few seconds at the most). */
function sendMarks(game: Game): void {
  const now = game.now;
  if (!lastMarks || lastMarks.game !== game || now - lastMarks.at >= 5) lastMarks = { game, at: now, json: JSON.stringify(marks(game)) };
  for (const s of game.sessions) {
    if (!s.profile || sent.get(s) === lastMarks.json) continue;
    sent.set(s, lastMarks.json);
    game.sendTo(s, { t: 'citadels', list: JSON.parse(lastMarks.json) as CitMark[] });
  }
}
/** A change the charts should show at once. */
function touch(game: Game): void {
  if (lastMarks?.game === game) lastMarks.at = -Infinity;
}

/** The Throne's citadels and war tabs (undefined below level 55, as the Throne itself). */
export function citView(game: Game, s: PlayerSession): CitView | undefined {
  const p = s.profile;
  if (!p || p.level < MAX_LEVEL - 5) return undefined;
  const S = store(game);
  const now = game.wallNow();
  const g = game.guilds.of(game, s.accountId);
  const ship = s.ship;
  const week = citWeek(now);
  const rows: CitRow[] = marks(game).map((m) => {
    const c = defs(game)[m.id];
    const rec = S.cits[m.id];
    const sg = S.sieges[m.id];
    const w = windowNow(game, m.id);
    const next = citNextWindow(m.id, w ? w.end : now);
    const ws = [...(w ? [w] : []), next, citNextWindow(m.id, next.end)].slice(0, 2);
    const mine = !!g && rec.owner === g.id;
    const full = hpOf(citGarrison(c.level));
    const hw = holdWhy(game, s, m.id);
    const titanFree = rec.owner !== null && rec.titanWeek !== week;
    return {
      ...m, ...(mine ? { mine: true } : {}), garrison: rec.garrison.filter((x) => x.n > 0).map((x) => ({ u: x.u, n: x.n })), share: Math.round((hpOf(rec.garrison) / Math.max(1, full)) * 100),
      hp: [...rec.hp], max: maxOf(game, rec), windows: ws,
      ...(sg ? { siegeOf: { tag: sg.tag, guild: sg.guild, start: sg.start, end: sg.end, assaults: sg.assaults.map((a) => sg.names[a] ?? '?'), ...(sg.fighting !== undefined ? { fighting: sg.names[sg.fighting] ?? '?' } : {}), ...(g && sg.gid === g.id ? { mine: true } : {}) } } : {}),
      why: {
        declare: declareWhy(game, s, m.id), assault: assaultWhy(game, s, m.id), leave: hw,
        titan: hw ?? (!titanFree ? 'Its titan of the week is taken: another rises next week.' : titanWhyAny(game, s)),
      },
      titan: titanFree, tax: citTax(c.level), points: CIT_POINTS.hour[c.level],
    };
  });
  const war = Object.entries(S.points).map(([k, pts]) => {
    const gid = Number(k);
    const t = S.guilds[gid] ?? { tag: '?', name: '?' };
    return { tag: t.tag, name: t.name, points: pts, cits: S.cits.filter((r) => r.owner === gid).length, ...(g && g.id === gid ? { you: true } : {}) };
  }).sort((a, b) => b.points - a.points).slice(0, 12);
  const place = g ? Object.entries(S.points).sort((a, b) => b[1] - a[1]).findIndex(([k]) => Number(k) === g.id) + 1 : 0;
  const seasonEnd = SEASON_EPOCH + (seasonId(game) + 1) * SEASON_DAYS * 86_400_000;
  return {
    rows, guild: g ? { tag: g.tag, name: g.name, points: S.points[g.id] ?? 0, place } : null, war,
    ...(S.champion ? { champion: { tag: S.champion.tag, name: S.champion.name, season: S.champion.season + 1 } } : {}),
    // (by the minute: a count of seconds sent every second sent the whole tab with it — docs/19 E19)
    season: S.season + 1, endsIn: Math.max(0, Math.round((seasonEnd - now) / 60_000) * 60),
    army: (ship?.army ?? []).filter((x) => x.n > 0).map((x) => ({ u: x.u, n: x.n })),
  };
}

/** Why no titan of any kind may come aboard her ship now (the first kind she may take clears it). */
function titanWhyAny(game: Game, s: PlayerSession): string | null {
  if (!s.ship) return 'Put to sea first.';
  let first: string | null = null;
  for (const u of ['titan_kraken', 'titan_leviathan', 'titan_whale', 'titan_turtle', 'titan_wrecks'] as const) {
    const w = titanWhy(game, s, u, false);
    if (!w) return null;
    first ??= w;
  }
  return first;
}

/** A captain's word in the Throne's citadel tab (throne.ts throneMessage). */
export function citMessage(game: Game, s: PlayerSession, op: string | undefined, id: number, u?: string, n?: number): string | null {
  switch (op) {
    case 'declare':
      return declareSiege(game, s, id);
    case 'assault':
      return assaultCitadel(game, s, id);
    case 'leave':
      return leaveInGarrison(game, s, id, u ?? '', n ?? 0);
    case 'titan':
      return hireCitadelTitan(game, s, id, u ?? '');
  }
  return 'No such order.';
}

// ------------------------------------------------------------------ the tester's command

/** The citadel nearest her (or the n-th, 1–12). */
function pick(game: Game, s: PlayerSession, arg?: string): CitadelDef {
  const n = Number(arg);
  if (n >= 1 && n <= CITADELS) return defs(game)[n - 1];
  const ship = s.ship!;
  return [...defs(game)].sort((a, b) => dist(a.x, a.y, ship.state.x, ship.state.y) - dist(b.x, b.y, ship.state.x, ship.state.y))[0];
}

/** A guild of her own for the tester (as /gyard founds one). */
function testGuild(game: Game, s: PlayerSession): string | null {
  if (game.guilds.of(game, s.accountId)) return null;
  const ship = s.ship!;
  const was = ship.docked;
  ship.docked = ship.docked ?? 'admin';
  s.profile!.gold += 20_000;
  const tag = `C${String(s.accountId % 1000).padStart(3, '0')}`.slice(0, 4);
  const e = foundGuild(game, s, `${s.name.slice(0, 18)} Guild`.slice(0, 24), tag);
  ship.docked = was;
  return e;
}

/** `/cit [go|guild|window|siege|win|own|lose|free|points N|season|reset] [n]` (admin.ts). */
export function adminCit(game: Game, s: PlayerSession, args: string[]): string {
  const S = store(game);
  const op = args[0];
  const c = pick(game, s, op === 'points' ? undefined : args[1] ?? (Number(op) ? op : undefined));
  const rec = S.cits[c.id];
  const label = `${c.id + 1}. ${nameOf(c)}`;
  switch (op) {
    case undefined:
    case 'list':
      return `Citadels: ${defs(game).map((x) => `${x.id + 1} ⚓${x.level}${S.cits[x.id].owner !== null ? ` [${tagOf(game, S.cits[x.id].owner!).tag}]` : ''}`).join(' · ')}`;
    case 'go':
      parkNear(game, s, c.x, c.y, 90, Math.atan2(c.x - c.fx, -(c.y - c.fy)));
      return `At the anchorage of the ${nameOf(c)}.`;
    case 'guild':
      return testGuild(game, s) ?? `Your guild: [${game.guilds.of(game, s.accountId)!.tag}].`;
    case 'window':
      openWindow(game, c.id);
      return `The window of the ${nameOf(c)} is open for two hours.`;
    case 'siege': {
      if ((s.profile?.level ?? 0) < MAX_LEVEL) return `The Throne war opens at level ${MAX_LEVEL} (/level ${MAX_LEVEL}).`;
      const e = testGuild(game, s);
      if (e) return e;
      if (rec.owner === game.guilds.of(game, s.accountId)!.id) rec.owner = null;
      const sg = S.sieges[c.id];
      if (sg && sg.gid !== game.guilds.of(game, s.accountId)!.id) delete S.sieges[c.id];
      openWindow(game, c.id);
      if (!S.sieges[c.id]) {
        const d = declareSiege(game, s, c.id, true);
        if (d) return d;
      }
      S.sieges[c.id].assaults = S.sieges[c.id].assaults.filter((a) => a !== s.accountId);
      parkNear(game, s, c.x, c.y, 90, Math.atan2(c.x - c.fx, -(c.y - c.fy)));
      game.tacticalBoarding = true;
      return assaultCitadel(game, s, c.id) ?? `The assault on the ${nameOf(c)} begins.`;
    }
    case 'win':
    case 'own': {
      const e = testGuild(game, s);
      if (e) return e;
      capture(game, c.id, game.guilds.of(game, s.accountId)!.id);
      return `Your guild holds the ${nameOf(c)}.`;
    }
    case 'lose':
      rec.garrison = rec.garrison.map((x) => ({ ...x, n: Math.max(1, Math.round(x.n / 2)) }));
      save(game);
      return `${label}: its garrison halved.`;
    case 'free':
      rec.owner = null;
      rec.garrison = citGarrison(c.level);
      mend(game, rec);
      rec.left = {};
      delete S.sieges[c.id];
      save(game);
      touch(game);
      return `${label}: its castellan holds it again.`;
    case 'points': {
      const g = game.guilds.of(game, s.accountId);
      if (!g) return 'Found a guild of your own first.';
      S.points[g.id] = (S.points[g.id] ?? 0) + Math.round(Number(args[1]) || 100);
      tagOf(game, g.id);
      save(game);
      return `Your guild has ${S.points[g.id]} points of the Throne war.`;
    }
    case 'season':
      // The season closed ahead of the calendar: the next one begins now.
      S.shift = (S.shift ?? 0) + 1;
      closeWar(game);
      return S.champion ? `The season is closed: [${S.champion.tag}] are the Masters of the Throne.` : 'The season is closed: nobody held a citadel.';
    case 'reset':
      stores.delete(game);
      game.db.setKv(KEY, null);
      store(game);
      save(game);
      touch(game);
      return 'Every citadel is its castellan’s again.';
  }
  return 'Usage: /cit [go|guild|window|siege|win|own|lose|free|points N|season|reset] [n]';
}

/** The region a citadel stands in, for the tests' and the tools' words. */
export const citRegion = (game: Game, id: number): string => REGIONS[defs(game)[id].region].name;
