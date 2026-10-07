// docs/19 D7 on the server: the creatures roaming the sea as HoMM3's neutral stacks (shared/src/data/roamers.ts says
// where each stands and what it is, by the world alone). The same stacks for every captain: a stack stands or drifts
// slowly round its spot (the client draws its wander from the same clock), never chases; within a cable her action
// bar has «Атаковать», and the fight is the battle at sea the drifts are fought on (docs/18 IV), her landing party
// against its creatures. While one captain's party fights it, the others see it «в бою» and cannot take it; her group
// mates near when it is beaten share in it. Won: its lesson (the most of it), a little silver and the creatures'
// spoils, now and then an artifact; most of her fallen hauled back from the water; the stack gone, standing again a
// little way off 3–6 minutes later. Lost: the creatures keep what the fight left them for a while. HoMM3's offer at ×3:
// some sign on, or they flee. A stack is a cheap static thing: nothing of it runs but when a captain is near.
//
// Not saved: a stack is down for minutes, and a stack's state is the sea's for that long. Every roll here is on this
// system's own Rng.

import { UNITS, armyMen, armyPower } from '../../../shared/src/data/army.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import { LAND_RES } from '../../../shared/src/data/bestiary.ts';
import type { LandRes } from '../../../shared/src/data/bestiary.ts';
import { landParty } from '../../../shared/src/data/lairs.ts';
import {
  ROAMS, ROAM_ART, ROAM_BATTLE_XP, ROAM_HEAL, ROAM_MATE_XP, ROAM_RAISE, ROAM_REACH, ROAM_SEE, ROAM_SHARE_R, ROAM_SHIFT, ROAM_WANDER,
  buildRoamers, isRoamKind, roamDown, roamGap, roamPay, roamPos, roamRes, roamShift, roamStacks, roamersNear,
} from '../../../shared/src/data/roamers.ts';
import type { RoamIndex, RoamKind, RoamSpot } from '../../../shared/src/data/roamers.ts';
import type { RoamClientMsg, RoamView } from '../../../shared/src/roamproto.ts';
import type { LairLoot } from '../../../shared/src/lairproto.ts';
import { ladder } from '../../../shared/src/data/shiplevel.ts';
import { dist } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { advQuiet, parkNear } from './advmap.ts';
import { landFighting, landTac, startCreatureFight } from './beastlairs.ts';
import { giveGoods } from './director.ts';
import type { Game } from './Game.ts';
import { artifactFind } from './hero.ts';
import { addLand } from './landecon.ts';
import { groupOfAccount } from './party.ts';
import type { PlayerSession } from './player.ts';
import { haulTake } from './seahaul.ts';
import { sideOf } from './tactical.ts';
import type { TacBattle } from './tacbattle.ts';
import { keepsDeep } from './town.ts';

/** What the sea remembers of a stack (only of those touched lately). */
interface RoamState {
  /** Times it has been beaten (or fled, or signed on): its shift off its spot, its next respawn. */
  k: number;
  /** World seconds it stands again (down until then). */
  down?: number;
  /** Its creatures as a fight it won left them, until healAt. */
  left?: number;
  healAt?: number;
  /** The captain whose party is fighting it now. */
  fighter?: number;
}

interface R7 {
  idx: RoamIndex;
  st: Map<number, RoamState>;
  rng: Rng;
  sent: WeakMap<PlayerSession, string>;
  /** A stack's state changed: every captain near is told at once. */
  dirty: boolean;
}

const all = new WeakMap<Game, R7>();
const still = new WeakSet<Game>();

/** The stacks kept still for a game (the tests of other systems keep them still with the adventure map). */
export function quietRoamers(game: Game, on = true): void {
  if (on) still.add(game);
  else still.delete(game);
}
const quiet = (game: Game): boolean => advQuiet(game) || still.has(game);

function R(game: Game): R7 {
  let x = all.get(game);
  if (!x) all.set(game, (x = { idx: buildRoamers(game.world), st: new Map(), rng: new Rng(0x19d7a1), sent: new WeakMap(), dirty: false }));
  return x;
}

export const roamIndex = (game: Game): RoamIndex => R(game).idx;
export const roamSpot = (game: Game, id: number): RoamSpot | undefined => R(game).idx.byId.get(id);
/** The system's own dice (the tests may set them). */
export function setRoamRng(game: Game, rng: Rng): void {
  R(game).rng = rng;
}

/** It stands now (not beaten lately). */
export function roamUp(game: Game, id: number): boolean {
  const st = R(game).st.get(id);
  return !st?.down || game.now >= st.down;
}

/** The spot it wanders round now (its own, or the shift of its last beating). */
export function roamBase(game: Game, sp: RoamSpot): { x: number; y: number } {
  const k = R(game).st.get(sp.id)?.k ?? 0;
  return k ? roamShift(game.world, sp, k) : { x: sp.x, y: sp.y };
}

/** Where it is now. */
export function roamWhere(game: Game, sp: RoamSpot): { x: number; y: number } {
  const b = roamBase(game, sp);
  return roamPos(sp.seed, b.x, b.y, game.now);
}

/** Its creatures now: as a fight it won left them (whole again a while later), else its whole number. */
export function roamMen(game: Game, sp: RoamSpot): number {
  const st = R(game).st.get(sp.id);
  if (st?.left !== undefined && st.healAt !== undefined && game.now < st.healAt) return st.left;
  return sp.n;
}

/** The captain whose party fights it now (null: nobody). */
export function roamFighter(game: Game, id: number): number | null {
  return R(game).st.get(id)?.fighter ?? null;
}

const stateOf = (S: R7, id: number): RoamState => {
  let st = S.st.get(id);
  if (!st) S.st.set(id, (st = { k: 0 }));
  return st;
};

/** It is gone (beaten, fled, signed on): it stands again a little way off a respawn later. */
function roamGone(game: Game, sp: RoamSpot): void {
  const S = R(game);
  const st = stateOf(S, sp.id);
  st.k++;
  st.down = game.now + roamDown(game.world, sp.id, st.k);
  st.left = undefined;
  st.healAt = undefined;
  st.fighter = undefined;
  S.dirty = true;
}

/** The stacks standing about a point (their wander and shift allowed for). */
export function roamersAbout(game: Game, x: number, y: number, r: number): RoamSpot[] {
  return roamersNear(R(game).idx, x, y, r + ROAM_WANDER + ROAM_SHIFT).filter((sp) => roamUp(game, sp.id));
}

// ------------------------------------------------------------------------------------------------ her might, the offer

function partyOf(game: Game, s: PlayerSession): ArmyStack[] {
  return landParty(sideOf(game, s.ship!, s.ship!, true).army ?? []);
}

/** Her landing party's might against the stack's (the ladder counted, as the lairs reckon it). */
export function roamRatio(game: Game, s: PlayerSession, sp: RoamSpot, party = partyOf(game, s)): number {
  const ship = s.ship!;
  const mine = armyPower(party) * (0.5 + ship.morale / 100) * (ladder(ship.shipLevel, sp.level, false).dealt || 0.1);
  const theirs = armyPower(roamStacks(sp.kind, roamMen(game, sp))) * 1.2 * (ladder(sp.level, ship.shipLevel, false).dealt || 0.1);
  return mine / Math.max(1, theirs);
}

/** HoMM3's neutrals before a far stronger army (×3): some sign on (four in ten, by the stack's hash and its beatings),
 *  else they flee; the drowned only with the Choir's and the cursed, the leviathans and the ancient turtles never. */
export function roamOffer(game: Game, s: PlayerSession, sp: RoamSpot, ratio = roamRatio(game, s, sp)): 'join' | 'flee' | null {
  if (ratio < 3) return null;
  if (sp.kind === 'shoal_leviathan' || sp.kind === 'ancient_turtle') return 'flee';
  if (sp.kind === 'surf_drowned' && !keepsDeep(s)) return 'flee';
  const k = R(game).st.get(sp.id)?.k ?? 0;
  return ((sp.seed + k * 7) % 10) < 4 ? 'join' : 'flee';
}

/** The creatures who would sign on: half of them, as her hammocks and her slots take them. */
export function roamJoiners(game: Game, s: PlayerSession, sp: RoamSpot): ArmyStack[] {
  const ship = s.ship!;
  const u = ROAMS[sp.kind].u as ArmyStack['u'];
  const own = ship.army.some((y) => y.u === u);
  if (!own && ship.army.length >= ship.armySlots) return [];
  const n = Math.min(Math.max(0, ship.stats.crewMax - ship.crew), Math.max(1, Math.floor(roamMen(game, sp) / 2)));
  return n > 0 ? [{ u, n }] : [];
}

// ------------------------------------------------------------------------------------------------ what she sees

function viewOf(game: Game, s: PlayerSession, sp: RoamSpot, party: (() => ArmyStack[]) | null): RoamView {
  const S = R(game);
  const b = roamBase(game, sp);
  const st = S.st.get(sp.id);
  const v: RoamView = { id: sp.id, kind: sp.kind, level: sp.level, size: sp.size, n: roamMen(game, sp), x: b.x, y: b.y, seed: sp.seed };
  if (st?.fighter !== undefined) {
    const mate = st.fighter === s.accountId || sameGroup(game, st.fighter, s.accountId);
    v.fight = mate ? 'mate' : 'other';
  } else if (party) {
    const ratio = roamRatio(game, s, sp, party());
    v.ratio = Math.round(ratio * 10) / 10;
    const offer = roamOffer(game, s, sp, ratio);
    if (offer) {
      v.offer = offer;
      if (offer === 'join') v.joinN = armyMen(roamJoiners(game, s, sp));
    }
  }
  return v;
}

const sameGroup = (game: Game, a: number, b: number): boolean => {
  const g = groupOfAccount(game, a);
  return !!g && g.members.includes(b);
};

/** The stacks about her, nearest first; the near ones (a few) with her might against theirs. */
export function roamsFor(game: Game, s: PlayerSession): RoamView[] {
  const ship = s.ship;
  if (!ship || ship.docked) return [];
  const x = ship.state.x, y = ship.state.y;
  const list = roamersAbout(game, x, y, ROAM_SEE).map((sp) => {
    const b = roamBase(game, sp);
    return { sp, d: Math.abs(b.x - x) + Math.abs(b.y - y) };
  });
  list.sort((a, b) => a.d - b.d);
  // (her landing party reckoned once, and only when a stack is near)
  let mine: ArmyStack[] | null = null;
  const party = () => (mine ??= partyOf(game, s));
  return list.map(({ sp, d }, i) => viewOf(game, s, sp, i < 3 && d < 900 ? party : null));
}

export function sendRoams(game: Game, s: PlayerSession, force: boolean): void {
  const S = R(game);
  const list = roamsFor(game, s);
  const key = list.map((v) => `${v.id}:${v.n}:${v.x}:${v.y}:${v.fight ?? ''}:${v.offer ?? ''}:${v.joinN ?? ''}:${v.ratio ?? ''}`).join('|');
  if (!force && S.sent.get(s) === key) return;
  S.sent.set(s, key);
  game.sendTo(s, { t: 'roams', list });
}

/** Every second: the fights whose captain is gone set loose; every other second (and at once on a change) each
 *  captain at sea told of the stacks about her. Nothing else of them runs. */
export function stepRoamers(game: Game): void {
  if (quiet(game)) return;
  const S = R(game);
  for (const [id, st] of S.st) {
    if (st.fighter !== undefined) {
      const f = game.sessionByAccount(st.fighter);
      if (!f || !landFighting(game, f)) {
        st.fighter = undefined;
        S.dirty = true;
      }
    }
    // (forgotten once nothing about it differs from a fresh one but its shift)
    if (st.fighter === undefined && (st.down === undefined || game.now >= st.down) && (st.healAt === undefined || game.now >= st.healAt) && st.left !== undefined) {
      st.left = undefined;
      st.healAt = undefined;
      S.dirty = true;
    }
    if (st.k === 0 && st.fighter === undefined && st.left === undefined && st.down === undefined) S.st.delete(id);
  }
  const even = Math.floor(game.now) % 2 === 0;
  const dirty = S.dirty;
  S.dirty = false;
  if (!even && !dirty) return;
  for (const s of game.sessions) {
    if (!s.profile || !s.ship || s.ship.ghost) continue;
    if (s.ship.docked) {
      if (S.sent.get(s)) {
        S.sent.set(s, '');
        game.sendTo(s, { t: 'roams', list: [] });
      }
      continue;
    }
    sendRoams(game, s, false);
  }
}

// ------------------------------------------------------------------------------------------------ the fight

/** The stack within her reach (the nearest standing one). */
export function roamAtHand(game: Game, s: PlayerSession, slack = 30): RoamSpot | null {
  const ship = s.ship;
  if (!ship || ship.docked) return null;
  let best: RoamSpot | null = null, bd = ROAM_REACH + slack;
  for (const sp of roamersAbout(game, ship.state.x, ship.state.y, ROAM_REACH + slack)) {
    const p = roamWhere(game, sp);
    const d = dist(p.x, p.y, ship.state.x, ship.state.y);
    if (d <= bd) [best, bd] = [sp, d];
  }
  return best;
}

/** Where a stack (by its id) is now; undefined for no such stack. */
export function roamWhereId(game: Game, id: number): { x: number; y: number } | undefined {
  const sp = R(game).idx.byId.get(id);
  return sp ? roamWhere(game, sp) : undefined;
}

/** Why «Атаковать» on a stack cannot be given now from wherever she lies in sight of it — the helmsman sails her in
 *  (pursuit.ts startRoamRun, owner 2026-10-07) — or null: what the fight itself asks but the cable's reach. */
export function roamRunWhy(game: Game, s: PlayerSession, id: number): string | null {
  return fightWhy(game, s, R(game).idx.byId.get(id), false);
}

function fightWhy(game: Game, s: PlayerSession, sp: RoamSpot | undefined, reach = true): string | null {
  const ship = s.ship;
  if (!ship || ship.docked || !ship.alive || ship.ghost) return 'Put to sea first.';
  if (!sp || !roamUp(game, sp.id)) return 'They are gone';
  const f = roamFighter(game, sp.id);
  if (f !== null) return f === s.accountId ? 'Your party is at them already.' : sameGroup(game, f, s.accountId) ? 'Your group mate is fighting them: the spoils will be shared.' : 'Another captain is fighting them.';
  const p = roamWhere(game, sp);
  const d = dist(p.x, p.y, ship.state.x, ship.state.y);
  if (reach && d > ROAM_REACH + 30) return 'Come within a cable of them first.';
  if (!reach && d > ROAM_SEE) return 'They are gone';
  if (ship.inCombat(game.now)) return 'Not while under fire';
  if (ship.boarding || ship.grappled || ship.landing) return 'Not now';
  if (landFighting(game, s)) return 'Your party is ashore already.';
  if (ship.crew < 3) return 'Too few hands to spare a landing party';
  return null;
}

/** The creatures' name the server's lines use (the client words them in Russian). */
export const ROAM_NAME: Record<RoamKind, string> = {
  gull: 'Gulls on the Swell', seal: 'Seals at Sea', reef_shark: 'Sharks of the Open Water', sea_turtle: 'Sea Turtles', marsh_serpent: 'Sea Snakes',
  lagoon_tentacle: 'Tentacles from the Deep', mermaid: 'Mermaids', surf_drowned: 'The Drowned Adrift', young_serpent: 'Young Serpents', lantern_maw: 'Lantern Maws',
  shoal_leviathan: 'A Leviathan', ancient_turtle: 'Ancient Turtles',
  barracuda: 'Barracudas in a Shoal', albatross: 'Albatrosses in the Wake', moray: 'Morays of the Reef', giant_octopus: 'Giant Octopuses',
};

/** «Атаковать»: her party against the stack, on its kind's field of the battle at sea. */
export function attackRoam(game: Game, s: PlayerSession, id: number): string | null {
  if (!s.ship || !s.profile) return 'No captain';
  const S = R(game);
  const sp = S.idx.byId.get(id);
  const why = fightWhy(game, s, sp);
  if (why) return why;
  const ship = s.ship;
  const n = roamMen(game, sp!);
  const gap = roamGap(ship.shipLevel, sp!.level);
  const e = startCreatureFight(game, s, {
    type: ROAMS[sp!.kind].field, kind: `roam_${sp!.kind}`, place: ROAM_NAME[sp!.kind], level: sp!.level, xpMul: ROAM_BATTLE_XP * gap,
    onEnd: (g, ss, won, bt) => roamEnd(g, ss, sp!, won, bt.stacks.filter((x) => x.side === 1 && x.count > 0).reduce((a, x) => a + x.count, 0), bt),
  }, ROAM_NAME[sp!.kind], roamStacks(sp!.kind, n), UNITS[ROAMS[sp!.kind].u as ArmyStack['u']].art, sp!.level);
  if (e) return e;
  stateOf(S, sp!.id).fighter = s.accountId;
  S.dirty = true;
  game.toastShip(ship, `Boats away: your party falls on the ${ROAM_NAME[sp!.kind]} (⚓${sp!.level}).`, 'info');
  return null;
}


/** The mates of her group at sea near the stack when it is beaten (they share in it). */
function matesNear(game: Game, s: PlayerSession, x: number, y: number): PlayerSession[] {
  const g = groupOfAccount(game, s.accountId);
  if (!g) return [];
  const out: PlayerSession[] = [];
  for (const m of g.members) {
    if (m === s.accountId) continue;
    const ms = game.sessionByAccount(m);
    if (ms?.ship && ms.profile && ms.ship.alive && !ms.ship.docked && dist(ms.ship.state.x, ms.ship.state.y, x, y) <= ROAM_SHARE_R) out.push(ms);
  }
  return out;
}

/** Silver, the creatures' spoils, to one captain at a share (past her day's count: half — the lesson never). */
function giveSpoils(game: Game, s: PlayerSession, silver: number, res: Partial<Record<LandRes | 'pearls', number>>, share: number): { silver: number; res: Partial<Record<LandRes | 'pearls', number>>; thin: boolean } {
  const thin = haulTake(game, s, 'roam');
  const k = share * thin;
  const out: Partial<Record<LandRes | 'pearls', number>> = {};
  const sil = Math.max(1, Math.round(silver * k));
  s.profile!.gold += sil;
  game.db.ledger(s.accountId, 'roam', sil, 'stack');
  for (const [r, n] of Object.entries(res) as [LandRes | 'pearls', number][]) {
    const want = Math.floor(n * k);
    if (want <= 0) continue;
    if (r === 'pearls') {
      const q = giveGoods(s.ship!, 'pearls', want);
      if (q > 0) out.pearls = q;
    } else if ((LAND_RES as string[]).includes(r)) {
      const got = addLand(game, s, r, want).given;
      if (got > 0) out[r] = got;
    }
  }
  return { silver: sil, res: out, thin: thin < 1 };
}

/** The fight is over: won — its lesson, silver and spoils (shared with her mates near), most of her fallen hauled
 *  back, an artifact now and then, the stack gone; lost — it keeps what is left of it a while. */
function roamEnd(game: Game, s: PlayerSession, sp: RoamSpot, won: boolean, left: number, bt: TacBattle): LairLoot | undefined {
  const S = R(game);
  const st = stateOf(S, sp.id);
  st.fighter = undefined;
  S.dirty = true;
  const ship = s.ship!;
  if (!won) {
    if (left > 0) {
      st.left = left;
      st.healAt = game.now + ROAM_HEAL;
    }
    game.toastShip(ship, `The ${ROAM_NAME[sp.kind]} throw your party back into the sea.`, 'bad');
    return undefined;
  }
  // Most of her fallen are hauled back out of the water.
  let room = Math.max(0, ship.stats.crewMax - ship.crew), raised = 0;
  for (const st0 of bt.stacks) {
    if (st0.side !== 0) continue;
    const d = st0.start - st0.count;
    const k = Math.min(room, Math.floor(d * ROAM_RAISE));
    if (k <= 0) continue;
    ship.addMen(st0.src as ArmyStack['u'], k);
    room -= k;
    raised += k;
  }
  if (raised > 0) ship.companyKey = '';
  const where = roamWhere(game, sp);
  const mates = matesNear(game, s, where.x, where.y);
  const pay = roamPay(sp.level, sp.size);
  const res = roamRes(sp.kind, roamMen(game, sp));
  roamGone(game, sp);
  const gap = roamGap(ship.shipLevel, sp.level);
  const xp = Math.round(pay.xp * gap);
  if (xp > 0) game.grantXp(s, xp, `Roaming stack beaten: ${ROAM_NAME[sp.kind]}`, true);
  const share = 1 / (1 + mates.length);
  const mine = giveSpoils(game, s, pay.silver, res, share);
  for (const m of mates) {
    const mx = Math.round(pay.xp * ROAM_MATE_XP * roamGap(m.ship!.shipLevel, sp.level));
    if (mx > 0) game.grantXp(m, mx, `${s.name} beat a roaming stack: ${ROAM_NAME[sp.kind]}`, true);
    const got = giveSpoils(game, m, pay.silver, res, share);
    game.toastShip(m.ship!, `Your share of the ${ROAM_NAME[sp.kind]}: ${got.silver} silver.`, 'gold');
    game.pushSelf(m, true);
  }
  let artifact: string | undefined;
  if (S.rng.chance(ROAM_ART[sp.size])) {
    const it = artifactFind(game, s, 'guard');
    if (it?.art) artifact = it.art;
  }
  s.profile!.roamWins = (s.profile!.roamWins ?? 0) + 1;
  game.toastShip(ship, raised > 0 ? `The ${ROAM_NAME[sp.kind]} are beaten: ${mine.silver} silver; ${raised} of your fallen are hauled back from the water.` : `The ${ROAM_NAME[sp.kind]} are beaten: ${mine.silver} silver.`, 'gold');
  return { silver: 0, xp: 0, goods: [], res: {}, roam: { xp, silver: mine.silver, res: mine.res, ...(artifact ? { artifact } : {}), raised, mates: mates.length, ...(mine.thin ? { thin: true } : {}), ...(gap <= 0 ? { grey: true } : {}) } };
}

/** HoMM3's offer taken: half of them sign on (no lesson), or she lets them flee. */
export function roamChoice(game: Game, s: PlayerSession, id: number, choice: 'join' | 'flee'): string | null {
  const S = R(game);
  const sp = S.idx.byId.get(id);
  const why = fightWhy(game, s, sp);
  if (why) return why;
  const offer = roamOffer(game, s, sp!);
  if (!offer) return 'They will not yield to you.';
  const ship = s.ship!;
  if (choice === 'join') {
    if (offer !== 'join') return 'They will not go with you.';
    const men = roamJoiners(game, s, sp!);
    const n = armyMen(men);
    if (n <= 0) return 'No hammocks or slots for them aboard.';
    for (const x of men) ship.addMen(x.u, x.n);
    ship.companyKey = '';
    roamGone(game, sp!);
    game.toastShip(ship, `${n} of the ${ROAM_NAME[sp!.kind]} follow your ship; the rest scatter.`, 'good');
  } else {
    roamGone(game, sp!);
    game.toastShip(ship, `The ${ROAM_NAME[sp!.kind]} see your strength and scatter.`, 'good');
  }
  sendRoams(game, s, true);
  game.pushSelf(s, true);
  return null;
}

export function roamMessage(game: Game, s: PlayerSession, msg: RoamClientMsg): void {
  if (!s.ship || !s.profile) return;
  const id = Math.trunc(Number(msg.id));
  const e = msg.action === 'attack' ? attackRoam(game, s, id) : msg.action === 'join' || msg.action === 'flee' ? roamChoice(game, s, id, msg.action) : null;
  if (e) game.refuse(s, e);
}

// ------------------------------------------------------------------------------------------------ the tester's console

/** `/stack [kind] [go|fight|beat|reset]`: hove to within reach of the nearest stack (of a kind), beat the one at hand at
 *  once (gone, to stand again), fight it out at once (quick combat), every stack whole and standing again (and her day's count of them forgotten); without
 *  an order, what is at hand. */
export function adminStack(game: Game, s: PlayerSession, args: string[]): string {
  const S = R(game);
  const ship = s.ship!;
  const kind = args.find((a) => isRoamKind(a)) as RoamKind | undefined;
  const order = args.find((a) => ['go', 'beat', 'reset', 'fight'].includes(a)) ?? (kind ? 'go' : 'info');
  if (order === 'reset') {
    S.st.clear();
    S.dirty = true;
    const h = s.profile?.seaHaul;
    if (h) h.n.roam = 0;
    sendRoams(game, s, true);
    return 'Every roaming stack stands again, whole; the day’s count of yours is forgotten.';
  }
  if (order === 'go') {
    let best: RoamSpot | null = null, bd = Infinity;
    for (const sp of S.idx.list) {
      if (kind && sp.kind !== kind) continue;
      if (!roamUp(game, sp.id) || roamFighter(game, sp.id) !== null) continue;
      const d = Math.abs(sp.x - ship.state.x) + Math.abs(sp.y - ship.state.y);
      if (d < bd) [best, bd] = [sp, d];
    }
    if (!best) return kind ? `No ${kind} stands anywhere.` : 'No stack stands anywhere.';
    const p = roamWhere(game, best);
    parkNear(game, s, p.x, p.y, 150);
    ship.state.speed = 0;
    ship.input = { rudder: 0, sailTarget: 0 };
    sendRoams(game, s, true);
    game.pushSelf(s, true);
    return `Beside you: the ${ROAM_NAME[best.kind]} (stack ${best.id}, ⚓${best.level}, ${roamMen(game, best)}).`;
  }
  const sp = roamAtHand(game, s, 400);
  if (!sp) return 'No roaming stack within reach.';
  if (order === 'beat') {
    roamGone(game, sp);
    sendRoams(game, s, true);
    return `The ${ROAM_NAME[sp.kind]} (stack ${sp.id}) are beaten: they stand again in ${Math.round((S.st.get(sp.id)!.down! - game.now))} s.`;
  }
  if (order === 'fight') {
    const e = attackRoam(game, s, sp.id);
    if (e) return e;
    landTac(game, s, { a: 'quick' });
    return `The ${ROAM_NAME[sp.kind]} (stack ${sp.id}) fought out at once.`;
  }
  return `The ${ROAM_NAME[sp.kind]} (stack ${sp.id}, ⚓${sp.level}, ${sp.size}): ${roamMen(game, sp)} creatures${roamFighter(game, sp.id) !== null ? ', in battle' : ''}.`;
}

