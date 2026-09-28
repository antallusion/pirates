// PvP rules 2.0 (docs/02 §10, docs/01 §11): colours, protection, duels, the price of cruelty and the price
// on a head.
//  - The Black Flag: in contested water anyone may attack you without a crime; NPC plunder +15%, plunder
//    from captains ×1.2. Hoisted anywhere but safe water; struck only in port or after 15 min out of a fight.
//  - The Green Pennant: under level 15 and 20 hours at sea, nobody may attack you in contested water — until
//    you attack a captain yourself (30 min) or hoist the Black Flag. Pennant captains take no goods in barter.
//  - The bubble: 10 min after a sinking, nobody attacks you and you attack nobody; firing, entering lawless
//    water or taking someone else's casks ends it.
//  - Repeat kills: the same victim within 2 h yields plunder ×1 → ×0.5 → ×0.25 → ×0 and costs infamy
//    ×1 → ×1.5 → ×2 → ×3. Hunting minnows (a victim under half your fleet's battle rating): plunder
//    × the ratio (lawless: not below ×0.5), no bounties or rating, and the Shame for an hour (wanted ×2).
//  - Duels by consent anywhere, 1v1 or group against group: a ring of 1 200 m, five minutes, nobody sinks,
//    everything is restored afterwards, nobody else can touch the duellists. 1v1 duels move an ELO rating.
//  - Bounties: the Crown's own on Wanted ≥ 2 (100 × level × Wanted², ×3 at 5, capped weekly per head); and
//    the captains' board — anyone sunk may put silver on the head of who sank them (from 1 000, 10% to the
//    League, free within 24 h), the purse lives 14 days, then half goes back. Paid to the one who sinks the
//    target (taken alive ×1.5); not to their group or anyone who traded or sailed with them in the last day;
//    a fleet three times the target's strength splits half of it.
//  - Right of revenge: for 24 h the sunk captain sees who sank them within 3 km.

import { onLadder } from '../../../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { WANTED_THRESHOLDS, wantedLevel } from '../../../shared/src/data/factions.ts';
import { SF } from '../../../shared/src/protocol.ts';
import type { BountyView, DuelView, PvpView } from '../../../shared/src/protocol.ts';
import { dist } from '../../../shared/src/math.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Game } from './Game.ts';
import { groupOfAccount, sameGroupAccounts } from './party.ts';
import { atWar } from './guilds.ts';
import { ignores } from './friends.ts';
import { changeRep } from './player.ts';
import type { PlayerSession, Profile } from './player.ts';
import { deliver } from './post.ts';
import type { ShipEntity } from './ship.ts';

const H = 3_600_000;
export const PENNANT_LEVEL = 15;
export const PENNANT_SECONDS = 20 * 3600;
export const BUBBLE_MS = 10 * 60_000;
export const FLAG_COOLDOWN_SEC = 900;
export const DUEL_RING = 1200;
export const DUEL_SECONDS = 300;
export const BOUNTY_MIN = 1000;
const REPEAT_LOOT = [1, 0.5, 0.25, 0];
const REPEAT_INFAMY = [1, 1.5, 2, 3];
const HUNTER_REP = 15; // Crown standing "Familiar": a hunter's licence

export interface PvpState {
  played: number; // seconds online, for the Green Pennant
  blackFlag: boolean;
  aggressedAt: number; // wall ms: last attack on a captain
  kills: { v: number; t: number }[];
  shameUntil: number;
  sunkBy: { account: number; name: string; t: number }[];
  bubbleUntil: number;
  rating: number;
  duels: number;
  duelWins: number;
  ties: Record<string, number>; // account id -> wall ms of the last barter or group together
  crownWeek: { week: number; paid: number };
}

export function newPvp(): PvpState {
  return { played: 0, blackFlag: false, aggressedAt: 0, kills: [], shameUntil: 0, sunkBy: [], bubbleUntil: 0, rating: 1000, duels: 0, duelWins: 0, ties: {}, crownWeek: { week: 0, paid: 0 } };
}

interface Snapshot {
  hull: number;
  sails: number;
  rudderHp: number;
  crew: number;
  wounded: number;
  morale: number;
  ammo: ShipEntity['ammo'];
  guns: ShipEntity['gunsDisabled'];
  water: number;
  leaks: number;
  effects: ShipEntity['effects'];
  curse: number;
}

export interface Duel {
  id: number;
  sides: [number[], number[]]; // account ids
  cx: number;
  cy: number;
  r: number;
  startAt: number; // world time the guns may speak
  endAt: number;
  struck: Set<number>;
  outside: Map<number, number>; // account -> world time they left the ring
  snaps: Map<number, Snapshot>;
  ranked: boolean;
}

interface Challenge {
  id: number;
  from: number;
  fromName: string;
  to: number;
  fleet: boolean;
  until: number;
}

interface Bounty {
  target: number;
  name: string;
  total: number;
  created: number;
  from: { account: number; name: string; amount: number }[];
}

export class PvpHub {
  duels = new Map<number, Duel>();
  duelOf = new Map<number, Duel>(); // account -> duel
  challenges = new Map<number, Challenge>();
  private bounties: Record<string, Bounty> | null = null;
  private nextId = 1;
  lastMarks = new Map<number, number>();

  id(): number {
    return this.nextId++;
  }

  board(game: Game): Record<string, Bounty> {
    this.bounties ??= game.db.getKv<Record<string, Bounty>>('bounties') ?? {};
    return this.bounties;
  }

  saveBoard(game: Game): void {
    if (this.bounties) game.db.setKv('bounties', this.bounties);
  }

  /** Another zone rewrote the purses: reload on next use. */
  drop(): void {
    this.bounties = null;
  }
}

// ------------------------------------------------------------------------------------------ status

function prof(game: Game, ship: ShipEntity | null): Profile | null {
  return ship ? game.profileOf(ship) : null;
}

/** The captain behind a ship (escorts and prizes answer for their owner). */
export function captainShip(game: Game, ship: ShipEntity | null): ShipEntity | null {
  if (!ship) return null;
  if (ship.isPlayer) return ship;
  if (ship.ownerId !== null) {
    const o = game.ships.get(ship.ownerId);
    return o?.isPlayer ? o : null;
  }
  return null;
}

export function hasPennant(game: Game, p: Profile): boolean {
  return p.level < PENNANT_LEVEL && p.pvp.played < PENNANT_SECONDS && !p.pvp.blackFlag && game.wallNow() - p.pvp.aggressedAt > 30 * 60_000;
}

export function flying(p: Profile | null): boolean {
  return !!p?.pvp.blackFlag;
}

export function shamed(game: Game, p: Profile | null): boolean {
  return !!p && p.pvp.shameUntil > game.wallNow();
}

/**
 * Battle rating: the level she fights at (canon D12), and half of every escort sailing with her. 1.45 a level, so
 * one two levels below is already under half — hunting her is hunting minnows.
 */
export function battleRating(game: Game, ship: ShipEntity): number {
  const one = (sh: ShipEntity) => Math.pow(1.45, sh.combatLevel - 1) * (onLadder(sh.loadout.classId) ? 1 : SHIP_CLASSES[sh.loadout.classId].tier);
  let br = one(ship);
  for (const o of game.ships.values()) if (o.ownerId === ship.id && o.alive) br += one(o) * 0.5;
  return br;
}

function repeats(game: Game, killer: Profile, victim: number): number {
  const now = game.wallNow();
  return killer.pvp.kills.filter((k) => k.v === victim && now - k.t < 2 * H).length;
}

export function hunterLicence(p: Profile): boolean {
  return (p.reputation.crown ?? 0) >= HUNTER_REP;
}

export function bountyOn(game: Game, account: number | null): number {
  if (account === null) return 0;
  return game.pvp.board(game)[account]?.total ?? 0;
}

/** Attacking this captain is no crime: the Black Flag in contested water, Wanted ≥ 2, or a price on the head for a licensed hunter. */
export function legalTarget(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  const pa = prof(game, a), pb = prof(game, b);
  if (!pb) return false;
  if (flying(pb) && REGIONS[b.region].safety === 'contested') return true;
  if (atWar(game, a, b)) return true; // guild war
  if (wantedLevel(pb.infamy) >= 2) return true;
  if (pa && hunterLicence(pa) && bountyOn(game, b.accountId) > 0) return true;
  return false;
}

/** Infamy multiplier for an attack on a captain: repeat victims and the Shame. */
export function crueltyMul(game: Game, a: ShipEntity, b: ShipEntity): number {
  const pa = prof(game, a);
  if (!pa || b.accountId === null) return 1;
  let m = REPEAT_INFAMY[Math.min(3, repeats(game, pa, b.accountId))];
  if (shamed(game, pa) && REGIONS[b.region].safety === 'contested') m *= 2;
  return m;
}

/** Called when a captain attacks another captain (first blow of an engagement). */
export function onPlayerAttack(game: Game, a: ShipEntity, b: ShipEntity): void {
  const pa = prof(game, a);
  if (pa && b.isPlayer) pa.pvp.aggressedAt = game.wallNow(); // the Green Pennant comes down for half an hour
}

/** What share of her hold floats up for the killer. */
export function lootMul(game: Game, killerShip: ShipEntity | null, victim: ShipEntity): number {
  const killer = captainShip(game, killerShip);
  const pk = prof(game, killer);
  if (!killer || !pk) return 1;
  if (!victim.isPlayer) return flying(pk) ? 1.15 : 1;
  const pv = prof(game, victim);
  if (!pv || victim.accountId === null) return 1;
  let m = REPEAT_LOOT[Math.min(3, repeats(game, pk, victim.accountId))];
  const ratio = battleRating(game, victim) / Math.max(0.1, battleRating(game, killer));
  if (ratio < 0.5) m *= REGIONS[victim.region].safety === 'lawless' ? Math.max(0.5, ratio) : ratio;
  if (flying(pk)) m *= 1.2;
  return m;
}

/** The snapshot flags this captain shows everyone. */
export function pvpFlags(game: Game, ship: ShipEntity): number {
  const p = prof(game, ship);
  let f = 0;
  if (p) {
    if (p.pvp.blackFlag) f |= SF.BLACK_FLAG;
    if (hasPennant(game, p) && REGIONS[ship.region].safety !== 'lawless') f |= SF.GREEN_PENNANT;
    if (shamed(game, p)) f |= SF.SHAME;
    if (bountyOn(game, ship.accountId) > 0 || wantedLevel(p.infamy) >= 2) f |= SF.BOUNTY;
  }
  if (ship.accountId !== null && game.pvp.duelOf.has(ship.accountId)) f |= SF.DUEL;
  return f;
}

// ------------------------------------------------------------------------------------------ the Black Flag

export function setBlackFlag(game: Game, s: PlayerSession, on: boolean): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  if (on === p.pvp.blackFlag) return null;
  if (on) {
    if (!ship.docked && REGIONS[ship.region].safety === 'safe') return 'Not in the Crown’s own waters — they would hang you from the yardarm';
    p.pvp.blackFlag = true;
    game.sendTo(s, { t: 'toast', msg: 'The Black Flag goes up. In contested water any captain may come for you — and the plunder is richer.', kind: 'bad' });
  } else {
    if (!ship.docked && game.now - ship.lastCombat < FLAG_COOLDOWN_SEC) return `You may strike the Black Flag in port, or after ${Math.ceil((FLAG_COOLDOWN_SEC - (game.now - ship.lastCombat)) / 60)} more minutes out of a fight`;
    p.pvp.blackFlag = false;
    game.sendTo(s, { t: 'toast', msg: 'The Black Flag comes down.', kind: 'info' });
  }
  game.pushSelf(s, true);
  return null;
}

// ------------------------------------------------------------------------------------------ protection

/** Where damage between two ships is blocked by PvP rules; null = allowed. (Called from damageBlocked.) */
export function pvpBlocked(game: Game, a: ShipEntity, b: ShipEntity): string | null | 'duel_ok' {
  const ca = captainShip(game, a), cb = captainShip(game, b);
  const da = ca?.accountId != null ? game.pvp.duelOf.get(ca.accountId) : undefined;
  const db = cb?.accountId != null ? game.pvp.duelOf.get(cb.accountId) : undefined;
  if (da || db) {
    // Only the duellists touch each other, only once it has begun, only across the sides, never escorts.
    if (da !== db || !a.isPlayer || !b.isPlayer) return 'A duel is being fought: stand clear';
    if (game.now < da!.startAt) return 'The duel has not begun';
    if (da!.struck.has(a.accountId!) || da!.struck.has(b.accountId!)) return 'She has struck';
    const sa = da!.sides[0].includes(a.accountId!) ? 0 : 1;
    if (da!.sides[sa].includes(b.accountId!)) return 'friendly';
    return 'duel_ok';
  }
  if (!ca || !cb || !a.isPlayer || !b.isPlayer) return null;
  const pb = prof(game, b);
  const safety = REGIONS[b.region].safety;
  if (pb && safety === 'contested' && hasPennant(game, pb)) return 'Green Pennant: a young captain sails under protection here.';
  return null;
}

export function inDuel(game: Game, ship: ShipEntity): Duel | null {
  return ship.accountId !== null ? game.pvp.duelOf.get(ship.accountId) ?? null : null;
}

/** A duellist's hull gives out: she strikes instead of sinking. Returns true when the duel took the blow. */
export function duelIntercept(game: Game, ship: ShipEntity): boolean {
  const d = inDuel(game, ship);
  if (!d || game.now < d.startAt) return false;
  ship.hull = Math.max(1, ship.hull);
  strike(game, d, ship.accountId!, 'strikes her colours');
  return true;
}

function strike(game: Game, d: Duel, account: number, how: string): void {
  if (d.struck.has(account)) return;
  d.struck.add(account);
  const s = game.sessionByAccount(account);
  if (s?.ship) s.ship.surrendered = true;
  duelNotice(game, d, `${s?.name ?? 'A captain'} ${how}.`);
  for (const side of [0, 1] as const) {
    if (d.sides[side].every((m) => d.struck.has(m))) return endDuel(game, d, side === 0 ? 1 : 0);
  }
}

// ------------------------------------------------------------------------------------------ duels

function duelNotice(game: Game, d: Duel, msg: string): void {
  for (const m of [...d.sides[0], ...d.sides[1]]) {
    const s = game.sessionByAccount(m);
    if (s) game.sendTo(s, { t: 'toast', msg, kind: 'info' });
  }
}

function duelSide(game: Game, s: PlayerSession, fleet: boolean): PlayerSession[] {
  if (!fleet) return [s];
  const g = groupOfAccount(game, s.accountId);
  if (!g) return [s];
  const out = [s];
  for (const m of g.members) {
    const ms = game.sessionByAccount(m);
    if (!ms || ms === s || !ms.ship || ms.ship.docked || !ms.ship.alive || ms.disconnectedAt !== null) continue;
    if (dist(ms.ship.state.x, ms.ship.state.y, s.ship!.state.x, s.ship!.state.y) <= 1500) out.push(ms);
  }
  return out;
}

function duelReady(game: Game, list: PlayerSession[]): string | null {
  for (const x of list) {
    const sh = x.ship;
    if (!sh || !sh.alive || sh.docked) return `${x.name} must be at sea`;
    if (game.pvp.duelOf.has(x.accountId)) return `${x.name} is already fighting a duel`;
    if (sh.inCombat(game.now)) return `${x.name} is in a fight`;
    if (sh.boarding) return `${x.name} is locked in a boarding action`;
  }
  return null;
}

export function challengeDuel(game: Game, s: PlayerSession, name: string, fleet: boolean): string | null {
  const t = game.sessionByName(String(name ?? ''));
  if (!t || !t.profile || t === s) return 'No captain of that name is at sea';
  if (ignores(t, s.accountId)) return `${t.name} is not listening to you`;
  if (fleet) {
    const ga = groupOfAccount(game, s.accountId), gb = groupOfAccount(game, t.accountId);
    if (!ga || ga.leader !== s.accountId || !gb || gb.leader !== t.accountId) return 'A fleet duel is between two group leaders';
    if (ga === gb) return 'Not against your own group';
  }
  const bad = duelReady(game, [s, t]);
  if (bad) return bad;
  if (dist(s.ship!.state.x, s.ship!.state.y, t.ship!.state.x, t.ship!.state.y) > 1500) return 'Come within 1,500 m to send a challenge';
  for (const c of game.pvp.challenges.values()) if (c.from === s.accountId && c.to === t.accountId) return 'Your challenge is already on its way';
  const c: Challenge = { id: game.pvp.id(), from: s.accountId, fromName: s.name, to: t.accountId, fleet, until: game.now + 60 };
  game.pvp.challenges.set(c.id, c);
  game.sendTo(t, { t: 'toast', msg: `${s.name} challenges you to a ${fleet ? 'fleet ' : ''}duel. Answer under Colours & Law [Y].`, kind: 'info' });
  game.sendTo(s, { t: 'toast', msg: `Challenge sent to ${t.name}.`, kind: 'info' });
  game.pushSelf(t, true);
  return null;
}

export function answerDuel(game: Game, s: PlayerSession, id: number, accept: boolean): string | null {
  const c = game.pvp.challenges.get(id);
  if (!c || c.to !== s.accountId) return 'That challenge has lapsed';
  game.pvp.challenges.delete(id);
  const from = game.sessionByAccount(c.from);
  if (!accept) {
    if (from) game.sendTo(from, { t: 'toast', msg: `${s.name} declines your challenge.`, kind: 'info' });
    game.pushSelf(s, true);
    return null;
  }
  if (!from || !from.ship) return `${c.fromName} is gone`;
  const A = duelSide(game, from, c.fleet), B = duelSide(game, s, c.fleet);
  const bad = duelReady(game, [...A, ...B]);
  if (bad) return bad;
  const ax = from.ship.state.x, ay = from.ship.state.y, bx = s.ship!.state.x, by = s.ship!.state.y;
  const d: Duel = {
    id: game.pvp.id(),
    sides: [A.map((x) => x.accountId), B.map((x) => x.accountId)],
    cx: (ax + bx) / 2,
    cy: (ay + by) / 2,
    r: Math.max(DUEL_RING, dist(ax, ay, bx, by) / 2 + 500),
    startAt: game.now + 5,
    endAt: game.now + 5 + DUEL_SECONDS,
    struck: new Set(),
    outside: new Map(),
    snaps: new Map(),
    ranked: !c.fleet,
  };
  for (const x of [...A, ...B]) {
    const sh = x.ship!;
    d.snaps.set(x.accountId, { hull: sh.hull, sails: sh.sails, rudderHp: sh.rudderHp, crew: sh.crew, wounded: sh.wounded, morale: sh.morale, ammo: { ...sh.ammo }, guns: { ...sh.gunsDisabled }, water: sh.water, leaks: sh.leaks, effects: sh.effects.map((e) => ({ ...e })), curse: sh.curse });
    game.pvp.duelOf.set(x.accountId, d);
  }
  game.pvp.duels.set(d.id, d);
  duelNotice(game, d, `The duel is agreed: ${A.map((x) => x.name).join(', ')} against ${B.map((x) => x.name).join(', ')}. Guns in five seconds; stay inside the ring.`);
  for (const x of [...A, ...B]) pushDuel(game, x);
  return null;
}

export function forfeitDuel(game: Game, s: PlayerSession): string | null {
  const d = game.pvp.duelOf.get(s.accountId);
  if (!d) return 'You are not fighting a duel';
  strike(game, d, s.accountId, 'yields');
  return null;
}

function endDuel(game: Game, d: Duel, winner: 0 | 1 | null): void {
  if (!game.pvp.duels.has(d.id)) return;
  game.pvp.duels.delete(d.id);
  const everyone = [...d.sides[0], ...d.sides[1]];
  for (const m of everyone) {
    game.pvp.duelOf.delete(m);
    const s = game.sessionByAccount(m);
    const snap = d.snaps.get(m);
    if (s?.ship && snap) {
      // Nothing lost: the ship is as she was.
      const sh = s.ship;
      sh.effects = snap.effects.filter((e) => e.until > game.now);
      sh.recompute(game.now);
      Object.assign(sh, { hull: snap.hull, sails: snap.sails, rudderHp: snap.rudderHp, crew: snap.crew, wounded: snap.wounded, morale: snap.morale, water: snap.water, leaks: snap.leaks, curse: snap.curse });
      sh.ammo = { ...snap.ammo };
      sh.gunsDisabled = { ...snap.guns };
      sh.surrendered = false;
      for (const o of everyone) {
        const os = game.sessionByAccount(o)?.ship;
        if (os) sh.attackers.delete(os.id);
      }
    }
    if (s?.profile) {
      s.profile.pvp.duels++;
      if (winner !== null && d.sides[winner].includes(m)) s.profile.pvp.duelWins++;
    }
  }
  // 1v1: an ELO rating.
  if (d.ranked && winner !== null) {
    const w = game.sessionByAccount(d.sides[winner][0])?.profile, l = game.sessionByAccount(d.sides[winner === 0 ? 1 : 0][0])?.profile;
    if (w && l) {
      const exp = 1 / (1 + 10 ** ((l.pvp.rating - w.pvp.rating) / 400));
      const k = Math.round(32 * (1 - exp));
      w.pvp.rating += k;
      l.pvp.rating -= k;
    }
  }
  const names = (side: number[]) => side.map((m) => game.sessionByAccount(m)?.name ?? '?').join(', ');
  duelNotice(game, d, winner === null ? 'The duel ends: honours even.' : `The duel goes to ${names(d.sides[winner])}.`);
  for (const m of everyone) {
    const s = game.sessionByAccount(m);
    if (!s) continue;
    if (winner !== null && d.sides[winner].includes(m)) game.shared?.bump('duels', m, s.name, 1);
    game.sendTo(s, { t: 'duel', view: null });
    game.pushSelf(s, true);
  }
}

function duelView(game: Game, d: Duel): DuelView {
  const side = (list: number[]) => list.map((m) => ({ name: game.sessionByAccount(m)?.name ?? '?', struck: d.struck.has(m) }));
  return { id: d.id, cx: Math.round(d.cx), cy: Math.round(d.cy), r: Math.round(d.r), startsIn: Math.max(0, Math.ceil(d.startAt - game.now)), endsIn: Math.max(0, Math.ceil(d.endAt - game.now)), sides: [side(d.sides[0]), side(d.sides[1])] };
}

function pushDuel(game: Game, s: PlayerSession): void {
  const d = game.pvp.duelOf.get(s.accountId);
  game.sendTo(s, { t: 'duel', view: d ? duelView(game, d) : null });
}

// ------------------------------------------------------------------------------------------ kills

/** A captain sank or took another captain. `killer` is the captain's own ship. */
export function onPlayerKill(game: Game, killer: ShipEntity, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  const ks = game.sessionOf(killer), vs = game.sessionOf(victim);
  const pk = ks?.profile, pv = vs?.profile;
  if (!ks || !vs || !pk || !pv) return;
  const now = game.wallNow();
  const n = repeats(game, pk, vs.accountId);
  const legal = legalTarget(game, killer, victim);
  const kBR = battleRating(game, killer), vBR = battleRating(game, victim);
  const minnow = vBR / Math.max(0.1, kBR) < 0.5;
  pk.pvp.kills = [...pk.pvp.kills.filter((k) => now - k.t < 2 * H), { v: vs.accountId, t: now }].slice(-40);
  pv.pvp.sunkBy = [...pv.pvp.sunkBy.filter((k) => now - k.t < 14 * 24 * H && k.account !== ks.accountId), { account: ks.accountId, name: ks.name, t: now }].slice(-20);
  game.sendTo(vs, { t: 'toast', msg: `${ks.name} sank you. For a day you will see them within 3 km — and you may put a price on their head, free of the League's cut.`, kind: 'bad' });
  const safety = REGIONS[victim.region].safety;
  if (minnow) {
    pk.pvp.shameUntil = now + H;
    changeRep(pk, 'confederacy', -10); // the Code despises minnow-hunting
    game.sendTo(ks, { t: 'toast', msg: 'Shame: she was no match for you. No bounty, poor plunder, and every captain sees it for an hour.', kind: 'bad' });
  }
  // Infamy for sinking a captain who was not fair game.
  if (!legal && safety !== 'lawless') {
    const zone = safety === 'contested' ? 1 : 2;
    game.addInfamy(killer, 12 * zone * REPEAT_INFAMY[Math.min(3, n)] * (shamed(game, pk) && safety === 'contested' ? 2 : 1), `${how === 'sunk' ? 'sank' : 'took'} ${vs.name}`);
  } else if (!legal && minnow) game.addInfamy(killer, 12, `shamed by ${vs.name}`);
  if (minnow) return; // no bounties for minnows
  payBounties(game, ks, vs, victim, how);
}

function tied(game: Game, a: Profile, bAccount: number): boolean {
  const t = a.pvp.ties[bAccount];
  return t !== undefined && game.wallNow() - t < 24 * H;
}

/** Barter and sailing together tie two captains for a day (no bounties between them). */
export function tie(game: Game, a: PlayerSession, b: PlayerSession): void {
  const now = game.wallNow();
  for (const [x, y] of [[a, b], [b, a]] as const) {
    if (!x.profile) continue;
    x.profile.pvp.ties[y.accountId] = now;
    for (const [k, t] of Object.entries(x.profile.pvp.ties)) if (now - t > 24 * H) delete x.profile.pvp.ties[k];
  }
}

function payBounties(game: Game, ks: PlayerSession, vs: PlayerSession, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  const pk = ks.profile!, pv = vs.profile!;
  if (sameGroupAccounts(game, ks.accountId, vs.accountId) || tied(game, pk, vs.accountId)) return;
  // Who fought her: captains whose shots (or escorts') landed in the last minute.
  const hunters = new Map<number, PlayerSession>([[ks.accountId, ks]]);
  let fleetBR = 0;
  const counted = new Set<number>();
  for (const [id, t] of victim.attackers) {
    if (t < game.now - 60) continue;
    const cap = captainShip(game, game.ships.get(id) ?? null);
    const hs = cap ? game.sessionOf(cap) : null;
    if (!cap || !hs || !hs.profile || counted.has(cap.id)) continue;
    counted.add(cap.id);
    fleetBR += battleRating(game, cap);
    if (!sameGroupAccounts(game, hs.accountId, vs.accountId) && !tied(game, hs.profile, vs.accountId)) hunters.set(hs.accountId, hs);
  }
  if (!counted.size) fleetBR = battleRating(game, captainShip(game, ks.ship) ?? victim);
  const overwhelming = fleetBR >= 3 * battleRating(game, victim);
  const pay = (amount: number, source: string) => {
    if (amount <= 0) return;
    const share = overwhelming ? Math.floor(amount / 2 / hunters.size) : amount;
    for (const hs of overwhelming ? hunters.values() : [ks]) {
      hs.profile!.gold += share;
      game.db.ledger(hs.accountId, 'bounty', share, `${source}:${vs.name}`);
      game.sendTo(hs, { t: 'toast', msg: `${source === 'crown' ? 'The Crown pays' : 'The bounty board pays'} ${share} silver for ${vs.name}${overwhelming ? ' (shared: the odds were long in your favour)' : ''}.`, kind: 'gold' });
    }
  };
  // The Crown's bounty on a wanted captain (a faucet, capped each week per head).
  const w = wantedLevel(pv.infamy);
  if (w >= 2) {
    const week = Math.floor(game.wallNow() / (7 * 24 * H));
    if (pv.pvp.crownWeek.week !== week) pv.pvp.crownWeek = { week, paid: 0 };
    let crown = 100 * pv.level * w * w * (w >= 5 ? 3 : 1);
    if (how === 'boarded') crown = Math.round(crown * 1.5);
    const cap = 15_000 * pv.level; // twice the Wanted 5 bounty per head per week
    crown = Math.max(0, Math.min(crown, cap - pv.pvp.crownWeek.paid));
    pv.pvp.crownWeek.paid += crown;
    pay(crown, 'crown');
    // The law's grip loosens: one level for a sinking, two for being taken alive.
    const drop = how === 'boarded' ? 2 : 1;
    pv.infamy = Math.min(pv.infamy, WANTED_THRESHOLDS[Math.max(0, w - drop)]);
    victim.wantedCache = wantedLevel(pv.infamy);
  }
  // The captains' purse.
  const board = game.pvp.board(game);
  const b = board[vs.accountId];
  if (b && b.total > 0) {
    const extra = how === 'boarded' ? Math.round(b.total * 0.5) : 0; // taken alive: the Crown adds half
    delete board[vs.accountId];
    game.pvp.saveBoard(game);
    pay(b.total + extra, 'board');
    for (const c of b.from) {
      if (c.account === ks.accountId) continue;
      deliver(game, c.account, { from: 'The League Bounty Office', subject: `${vs.name} has paid`, body: `${ks.name} ${how === 'sunk' ? 'sank' : 'took'} ${vs.name}. Your ${c.amount} silver bought it.`, gold: 0, goods: null });
    }
  }
}

// ------------------------------------------------------------------------------------------ the bounty board

export function postBounty(game: Game, s: PlayerSession, name: string, amountRaw: number): string | null {
  const p = s.profile!;
  if (!s.ship?.docked) return 'Bounties are posted at a harbour office';
  const now = game.wallNow();
  const rec = p.pvp.sunkBy.find((k) => k.name.toLowerCase() === String(name ?? '').trim().toLowerCase() && now - k.t < 14 * 24 * H);
  if (!rec) return 'You may only put a price on a captain who sank you in the last fortnight';
  const amount = Math.floor(Number(amountRaw));
  if (!Number.isFinite(amount) || amount < BOUNTY_MIN) return `A bounty starts at ${BOUNTY_MIN} silver`;
  const free = now - rec.t < 24 * H; // the right of revenge
  const fee = free ? 0 : Math.ceil(amount * 0.1);
  if (p.gold < amount + fee) return `That needs ${amount + fee} silver${fee ? ` (with the League's ${fee})` : ''}`;
  p.gold -= amount + fee;
  if (fee) game.db.ledger(s.accountId, 'bounty_fee', -fee, rec.name);
  const board = game.pvp.board(game);
  const b = (board[rec.account] ??= { target: rec.account, name: rec.name, total: 0, created: now, from: [] });
  b.total += amount;
  const mine = b.from.find((f) => f.account === s.accountId);
  if (mine) mine.amount += amount;
  else b.from.push({ account: s.accountId, name: s.name, amount });
  game.pvp.saveBoard(game);
  const t = game.sessionByAccount(rec.account);
  if (t) game.sendTo(t, { t: 'toast', msg: `${s.name} has put ${amount} silver on your head. The purse now stands at ${b.total}.`, kind: 'bad' });
  game.sendTo(s, { t: 'toast', msg: `The price on ${rec.name}'s head stands at ${b.total} silver.`, kind: 'good' });
  sendBounties(game, s);
  return null;
}

export function sendBounties(game: Game, s: PlayerSession): void {
  const board = game.pvp.board(game);
  const list: BountyView[] = Object.values(board)
    .sort((a, b) => b.total - a.total)
    .slice(0, 40)
    .map((b) => {
      const t = game.sessionByAccount(b.target);
      return { name: b.name, total: b.total, backers: b.from.length, wanted: t?.profile ? wantedLevel(t.profile.infamy) : 0, atSea: !!t?.ship && !t.ship.docked && t.disconnectedAt === null };
    });
  game.sendTo(s, { t: 'bounties', list });
}

// ------------------------------------------------------------------------------------------ the private view

export function pvpView(game: Game, s: PlayerSession): PvpView {
  const p = s.profile!;
  const now = game.wallNow();
  return {
    blackFlag: p.pvp.blackFlag,
    pennant: hasPennant(game, p),
    pennantHoursLeft: Math.max(0, Math.round((PENNANT_SECONDS - p.pvp.played) / 360) / 10),
    shameUntil: p.pvp.shameUntil,
    bubbleUntil: p.pvp.bubbleUntil,
    rating: p.pvp.rating,
    duels: p.pvp.duels,
    duelWins: p.pvp.duelWins,
    bounty: bountyOn(game, s.accountId),
    hunter: hunterLicence(p),
    sunkBy: p.pvp.sunkBy.filter((k) => now - k.t < 14 * 24 * H).map((k) => ({ name: k.name, t: k.t, free: now - k.t < 24 * H })),
    challenges: [...game.pvp.challenges.values()].filter((c) => c.to === s.accountId).map((c) => ({ id: c.id, from: c.fromName, fleet: c.fleet })),
  };
}

// ------------------------------------------------------------------------------------------ upkeep

/** Called every second. */
export function stepPvp(game: Game): void {
  const hub = game.pvp;
  const wall = game.wallNow();
  for (const [k, c] of hub.challenges) if (c.until <= game.now) hub.challenges.delete(k);
  for (const d of [...hub.duels.values()]) {
    for (const m of [...d.sides[0], ...d.sides[1]]) {
      const s = game.sessionByAccount(m);
      if (!s || !s.ship || s.disconnectedAt !== null || s.ship.docked) {
        strike(game, d, m, 'has left the duel');
        continue;
      }
      if (d.struck.has(m)) continue;
      const out = dist(s.ship.state.x, s.ship.state.y, d.cx, d.cy) > d.r;
      if (!out) d.outside.delete(m);
      else if (!d.outside.has(m)) {
        d.outside.set(m, game.now);
        game.sendTo(s, { t: 'toast', msg: 'You are outside the ring: come back within 10 seconds or yield.', kind: 'bad' });
      } else if (game.now - d.outside.get(m)! > 10) strike(game, d, m, 'fled the ring');
    }
    if (!hub.duels.has(d.id)) continue;
    if (game.now >= d.endAt) endDuel(game, d, null);
    else for (const m of [...d.sides[0], ...d.sides[1]]) {
      const s = game.sessionByAccount(m);
      if (s) pushDuel(game, s);
    }
  }
  // Every five seconds: bubbles, pennant time, revenge marks, the shape of each captain's colours.
  if (Math.floor(game.now) % 5 !== 0) return;
  for (const s of game.sessions) {
    const p = s.profile, ship = s.ship;
    if (!p || !ship || s.disconnectedAt !== null) continue;
    p.pvp.played += 5;
    // The bubble ends in lawless water.
    if (ship.protectedUntil > game.now && REGIONS[ship.region].safety === 'lawless' && p.pvp.bubbleUntil > wall) {
      ship.protectedUntil = 0;
      p.pvp.bubbleUntil = 0;
      game.sendTo(s, { t: 'toast', msg: 'Lawless water: no protection here.', kind: 'bad' });
    }
    // Right of revenge.
    const marks: { name: string; x: number; y: number }[] = [];
    for (const k of p.pvp.sunkBy) {
      if (wall - k.t > 24 * H) continue;
      const ks = game.sessionByAccount(k.account)?.ship;
      if (ks && !ks.docked && ks.alive && dist(ks.state.x, ks.state.y, ship.state.x, ship.state.y) <= 3000) marks.push({ name: k.name, x: Math.round(ks.state.x), y: Math.round(ks.state.y) });
    }
    if (marks.length || hub.lastMarks.get(s.accountId)) {
      game.sendTo(s, { t: 'marks', list: marks });
      hub.lastMarks.set(s.accountId, marks.length);
    }
  }
  // Purses older than 14 days: half goes back to those who paid, the rest to the League (one zone keeps it).
  if (Math.floor(game.now) % 60 === 0 && game.zoneLead) {
    const board = hub.board(game);
    let changed = false;
    for (const [k, b] of Object.entries(board)) {
      if (wall - b.created < 14 * 24 * H) continue;
      for (const c of b.from) deliver(game, c.account, { from: 'The League Bounty Office', subject: `The purse on ${b.name} has lapsed`, body: 'Nobody collected in a fortnight. Half of your silver is returned; the rest is the Office’s.', gold: Math.floor(c.amount / 2), goods: null });
      delete board[k];
      changed = true;
    }
    if (changed) hub.saveBoard(game);
  }
}

/** After a sinking: the bubble (the ship is placed back in port; it starts when she sails). */
export function grantBubble(game: Game, s: PlayerSession): void {
  if (s.profile) s.profile.pvp.bubbleUntil = game.wallNow() + BUBBLE_MS;
}

/** On sailing: the bubble covers the rest of its time. */
export function bubbleOnUndock(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return;
  const left = (p.pvp.bubbleUntil - game.wallNow()) / 1000;
  if (left > 0) ship.protectedUntil = Math.max(ship.protectedUntil, game.now + left);
}

/** Taking someone else's casks bursts the bubble. */
export function bubbleOnLoot(game: Game, ship: ShipEntity, ownDrop: boolean): void {
  if (ownDrop || ship.protectedUntil <= game.now) return;
  const p = prof(game, ship);
  if (!p || p.pvp.bubbleUntil <= game.wallNow()) return;
  ship.protectedUntil = 0;
  p.pvp.bubbleUntil = 0;
}
