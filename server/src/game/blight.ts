// The Blighted Sea («Море Скверны», docs/40): the life of the secret endgame water. An overlay keyed off one circle
// (shared/src/data/blight.ts BLIGHT) — nothing here runs for a captain who is neither inside it nor cleared for it:
//  - the Veil turns back whoever the sea does not yet count its own (as the Maelstrom Wall does, with no hull lost);
//  - inside, her Taint grows with the time under way and every kill, tier by tier without end; hunters of her tier are
//    sent after her out of sight (as the campaign's foes are: huntAccount), marks ride in her hold until she banks
//    them at the Raft (a cut) or across the rim (none), and all of it is lost if she is sunk inside;
//  - captains: every protection off, no infamy, no standing lost; the victor's marks and their anti-farm rules; the
//    Chosen of the Blight; the week's board and its three titles;
//  - the Blight's Heart every three hours, her spoils by each captain's part;
//  - the Raft: the mooring, blackjack against the house, the shop for banked marks, Dead Man's Dice;
//  - the chapter «Зелёный огонь» (fourteen quests of the zone's own steps) and the endless daily contracts.
// Every timer and every reward is here; the client only shows (shared/src/blightproto.ts).

import {
  BJ_HANDS_HOUR, BJ_SILVER_DAY, BJ_STAKES, BLIGHT, BLIGHT_AWAY_MS, BLIGHT_CHAPTER, BLIGHT_PENNANT, BLIGHT_QUESTS, BLIGHT_RAFT, BLIGHT_SHOP, BLIGHT_TITLE, CASK_CHANCE, CASK_MARKS,
  CASK_REACH, CASK_SECS, CASK_TIER, CHOSEN_EARNS, CHOSEN_MIN_TIER, CHOSEN_PAYS, CONTRACTS_A_DAY, HEART_CAPTAIN, HEART_EVERY_MS, HEART_GUNS, HEART_HULL, HEART_MIN_PART, HEART_NAME,
  HEART_POOL, HEART_STAY_S, HEART_WARN_MS, HUNTER_CAPTAIN, HUNTER_FIRST_S, HUNTER_HULL, HUNTER_GAP_S, HUNTER_MARKS, HUNTER_NAMES, LANTERN_SECS, PVP_FRESH_S, PVP_REPEAT_MS, PVP_REPEAT_SHARE,
  RAFT_CUT, RAFT_LEAVE, RAFT_TABLE, RAFT_MOOR_SECS, RAFT_QUIET_SECS, RAFT_REACH, TAINT_CAPTAIN, TAINT_HEART, TAINT_HUNTER, TAINT_PER_SEC, TAINT_PER_TIER, WEEK_MARKS, WEEK_TITLES, bjDealer,
  bjDeck, bjNatural, bjResult, bjReturn, bjTotal, blightMul, blightOpen, blightXpMul, dayContracts, hunterSpec, inBlight, pvpMarks, say, shopPrice, stepNeed, stepText, tierOf,
} from '../../../shared/src/data/blight.ts';
import type { BjCoin, BjResult, BlightContract, BlightStep, BlightWare, BlightWord } from '../../../shared/src/data/blight.ts';
import type { BjView, BlightClientMsg, BlightContractView, BlightTaskView, BlightView, BlightWeekRow } from '../../../shared/src/blightproto.ts';
import { timeOfDay } from '../../../shared/src/constants.ts';
import { lackSilver } from '../../../shared/src/data/buyfail.ts';
import { dayOf } from '../../../shared/src/data/dailies.ts';
import { itemName, reforgeLine } from '../../../shared/src/data/items.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { lumpXp, prizeXp } from '../../../shared/src/data/xpcurve.ts';
import { headingOf } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { adminEnabled } from './admin.ts';
import { grantSpeedups } from './base.ts';
import { logNote } from './captainlog.ts';
import { captainBehind } from './flaglaw.ts';
import type { Game } from './Game.ts';
import { applyWorn, findPiece } from './gear.ts';
import { guildFriends } from './guilds.ts';
import { planWander } from './npc.ts';
import { sameGroupAccounts } from './party.ts';
import type { PlayerSession, Profile } from './player.ts';
import { deliver } from './post.ts';
import { openTables } from './dice.ts';
import { hiddenSpot } from './questspot.ts';
import { relicPartDrop } from './relics.ts';
import type { ShipEntity } from './ship.ts';
import { openSea } from './wrecks.ts';

const WEEK_MS = 7 * 86_400_000;
const HOUR_MS = 3_600_000;

// ================================================================================================ what is kept

/** What a captain's save keeps of the green water (Profile.blight: absent until the sea counts her its own — a
 *  captain who never comes near has none). Every field has its default in `rec`, so an older save reads as it is. */
export interface BlightSave {
  /** The letter of the green fire sent. */
  told: boolean;
  /** An admin's pass through the Veil (`/blight clear`; holds only on a server run with the admin commands). */
  pass?: boolean;
  /** Banked marks. */
  marks: number;
  /** The run: inside now; her Taint; marks in the hold; a cask aboard; when she was last seen inside and when she came
   *  in (wall ms); her kills since. */
  in: boolean;
  taint: number;
  hold: number;
  cask: boolean;
  seen: number;
  since: number;
  kills: number;
  /** The best tier ever. */
  best: number;
  /** The Dark Lantern burns until (wall ms). */
  lantern: number;
  /** The chapter: quests behind her; the one under way (its step, the step's count). */
  ch: { at: number; cur: { step: number; n: number } | null };
  /** The day's contracts: the day, the best tier they were drawn for, each one's count and whether it is paid. */
  day: { d: number; b: number; n: number[]; paid: boolean[] };
  /** The shop: the week, and what she bought in it. */
  shop: { week: number; n: Partial<Record<BlightWare, number>> };
  /** The dealer's limits: the hour and its hands, the day and the silver lost in it (net). */
  bj: { hour: number; hands: number; day: number; lost: number };
  /** Captains who paid her in full, and when (wall ms): the same one pays a quarter for an hour. */
  paid: Record<string, number>;
}

function rec(p: Profile): BlightSave {
  const r = (p.blight ??= { told: false, marks: 0, in: false, taint: 0, hold: 0, cask: false, seen: 0, since: 0, kills: 0, best: 1, lantern: 0, ch: { at: 0, cur: null }, day: { d: -1, b: 1, n: [], paid: [] }, shop: { week: -1, n: {} }, bj: { hour: -1, hands: 0, day: -1, lost: 0 }, paid: {} });
  return r;
}

/** A saved record made sound (player.ts, on loading). */
export function sanitizeBlight(p: Profile): void {
  const r = p.blight;
  if (!r) return;
  r.told ??= false;
  r.marks = Math.max(0, Math.floor(r.marks ?? 0));
  r.in ??= false;
  r.taint = Math.max(0, r.taint ?? 0);
  r.hold = Math.max(0, Math.floor(r.hold ?? 0));
  r.cask ??= false;
  r.seen ??= 0;
  r.since ??= 0;
  r.kills ??= 0;
  r.best = Math.max(1, Math.floor(r.best ?? 1));
  r.lantern ??= 0;
  r.ch ??= { at: 0, cur: null };
  r.ch.at = Math.max(0, Math.min(BLIGHT_QUESTS.length, Math.floor(r.ch.at ?? 0)));
  r.ch.cur ??= null;
  r.day ??= { d: -1, b: 1, n: [], paid: [] };
  r.shop ??= { week: -1, n: {} };
  r.bj ??= { hour: -1, hands: 0, day: -1, lost: 0 };
  r.paid ??= {};
}

interface Hand {
  coin: BjCoin;
  stake: number;
  doubled: boolean;
  deck: number[];
  player: number[];
  dealer: number[];
  result: BjResult | null;
  back: number;
}

interface Cask {
  x: number;
  y: number;
  marks: number;
  until: number;
}

interface Heart {
  id: number;
  until: number;
  /** Hull each captain (her account) took off her. */
  parts: Map<number, number>;
}

interface Loss {
  half: number;
  tier: number;
  fresh: boolean;
  chosen: boolean;
  at: number;
}

interface State {
  rng: Rng;
  /** The hunters afloat: ship → whose, and the tier she was sent at. */
  hunters: Map<number, { account: number; tier: number }>;
  /** Captains inside (account → session), and when each one's next hunter may put out. */
  inside: Map<number, PlayerSession>;
  next: Map<number, number>;
  moored: Set<number>;
  mooring: Map<number, number>;
  casks: Cask[];
  heart: Heart | null;
  heartSlot: number;
  warned: number;
  chosen: number | null;
  hands: Map<number, Hand>;
  /** The next hand's deck, in the order it is dealt (tests). */
  rig: number[] | null;
  /** A captain's hold just lost (her ship → what the victor is paid from). */
  lost: Map<number, Loss>;
  /** Sunk inside: no bubble when she sails again. */
  noBubble: Set<number>;
  /** The Veil a wall (null: not read from the store yet). */
  wall: boolean | null;
}

const states = new WeakMap<Game, State>();
function st(game: Game): State {
  let s = states.get(game);
  if (!s) {
    s = { rng: new Rng((game.world.seed ^ 0xb11647) >>> 0), hunters: new Map(), inside: new Map(), next: new Map(), moored: new Set(), mooring: new Map(), casks: [], heart: null, heartSlot: -1, warned: -1, chosen: null, hands: new Map(), rig: null, lost: new Map(), noBubble: new Set(), wall: null };
    states.set(game, s);
  }
  return s;
}

const toast = (game: Game, s: PlayerSession, key: BlightWord, kind: 'info' | 'good' | 'bad' | 'gold', ...a: (string | number)[]): void => game.sendTo(s, { t: 'toast', msg: say(key, ...a), kind });

// ================================================================================================ who may enter

/** The green water is hers: the campaign's 648th quest behind her and the 55th level — each captain earns it herself.
 *  (An admin's pass holds on a server run with the admin commands.) */
export function blightCleared(game: Game, s: PlayerSession): boolean {
  const p = s.profile;
  if (!p) return false;
  if (blightOpen(p.campaign?.at ?? 0, p.level)) return true;
  return !!p.blight?.pass && adminEnabled();
}

/** Her ship lies in the green water now (cleared and counted in). */
export function blightInside(game: Game, ship: ShipEntity | null | undefined): boolean {
  if (!ship || ship.accountId === null) return false;
  return !!game.profileOf(ship)?.blight?.in;
}

/** A ship of any kind within the circle. */
export const blightWater = (ship: ShipEntity): boolean => inBlight(ship.state.x, ship.state.y);

/** The rules of the place hold for this kill (no infamy, no standing lost, no minnow's shame): the killer is counted
 *  in, and her victim lies in the circle — a ship of the sea, or a captain the green water has taken too. For a captain
 *  the sea does not count its own, crossing that water, every rule is as it was. */
export function blightRules(game: Game, killer: ShipEntity, victim: ShipEntity): boolean {
  if (!blightWater(victim) || !blightInside(game, captainBehind(game, killer))) return false;
  return !victim.isPlayer || !!game.profileOf(victim)?.blight?.told;
}

/** Moored at the Raft. */
export function raftMoored(game: Game, s: PlayerSession): boolean {
  return states.get(game)?.moored.has(s.accountId) ?? false;
}

const tierNow = (r: BlightSave): number => tierOf(r.taint);

/** Her marks' multiplier now: her tier (one more under the Dark Lantern), a quarter more for the Chosen. */
function marksMul(game: Game, s: PlayerSession, r: BlightSave): number {
  const lit = r.lantern > game.wallNow() ? 1 : 0;
  return blightMul(tierNow(r) + lit) * (st(game).chosen === s.accountId ? CHOSEN_EARNS : 1);
}

// ================================================================================================ every second, per captain

/** Once a second for each captain aboard (Game.sessionSecond). A captain outside the circle with no run of hers open
 *  leaves here at the first lines. */
export function blightSecond(game: Game, s: PlayerSession): void {
  const ship = s.ship, p = s.profile;
  if (!ship || !p) return;
  const here = !ship.docked && inBlight(ship.state.x, ship.state.y);
  if (here && !ship.alive) return; // going down: her hold is settled by the sinking itself (blightSinking)
  const inside = here;
  const had = p.blight;
  if (!inside && !had?.in && had?.told) return weekSync(game, s, had); // (the common road of a cleared captain elsewhere)
  const cleared = blightCleared(game, s);
  if (!inside && !cleared) return; // (…and of everyone else: nothing is touched)
  // The moment the sea counts her its own: one letter, the chart mark from then on (the view), a line in her log.
  if (cleared && !had?.told) {
    const r = rec(p);
    r.told = true;
    deliver(game, s.accountId, { from: say('letterFrom'), subject: say('letterSubject'), body: say('letterBody'), gold: 0, goods: null });
    logNote(game, s, 'note', [say('logOpen')]);
    toast(game, s, 'logOpen', 'gold');
    game.pushSelf(s, true);
  }
  if (!inside) {
    if (had?.in) leaveAlive(game, s, had);
    return;
  }
  if (!cleared) {
    // The Veil. As a wall it throws her back; left open (the default: see veilWall) the green water is not there for
    // her at all — she crosses it as the lawless water it always was, sees nothing, is hunted by nothing, gathers nothing.
    if (veilWall(game)) veil(game, s, ship);
    return;
  }
  const S = st(game);
  const r = rec(p);
  const wall = game.wallNow();
  // Back after more than five minutes away with a run open: she is treated as having left alive.
  if (r.in && wall - r.seen > BLIGHT_AWAY_MS) leaveAlive(game, s, r);
  if (!r.in) {
    r.in = true;
    r.taint = 0;
    r.kills = 0;
    r.since = wall;
    S.inside.set(s.accountId, s);
    S.next.set(s.accountId, game.now + HUNTER_FIRST_S);
    // Every protection off: the bubble of a sinking elsewhere bursts at the rim.
    ship.protectedUntil = 0;
    p.pvp.bubbleUntil = 0;
    toast(game, s, 'enter', 'bad');
    progress(game, s, { k: 'reach' });
  }
  S.inside.set(s.accountId, s); // (a session made anew on coming back aboard)
  r.seen = wall;
  if (ship.sinkingUntil) return;
  const acc = s.accountId;
  // The Raft: lines being made fast, or made fast.
  const dRaft = Math.hypot(ship.state.x - BLIGHT_RAFT.x, ship.state.y - BLIGHT_RAFT.y);
  const hot = game.now - ship.lastHitAt < 2 || !!ship.boarding || ship.grappled;
  if (S.moored.has(acc)) {
    if (dRaft > RAFT_LEAVE || hot) castOff(game, s, true);
    else return; // moored: the Taint is washed off and gathers none
  }
  const until = S.mooring.get(acc);
  if (until !== undefined) {
    if (dRaft > RAFT_REACH + 40 || Math.abs(ship.state.speed) > 3 || moorHot(game, ship)) {
      S.mooring.delete(acc);
      toast(game, s, 'mooringOff', 'bad');
    } else if (game.now >= until) {
      S.mooring.delete(acc);
      S.moored.add(acc);
      toast(game, s, 'moored', 'good');
      bank(game, s, r, 'raft');
      progress(game, s, { k: 'moor' });
      game.pushSelf(s, true);
      return;
    }
  }
  // The Taint: slowly with the time under way.
  const before = tierNow(r);
  if (Math.abs(ship.state.speed) > 1) r.taint += TAINT_PER_SEC;
  tierCheck(game, s, r, before);
  progress(game, s, { k: 'tick', tier: tierNow(r) });
  // A green cask within reach of her hull.
  for (let i = S.casks.length - 1; i >= 0; i--) {
    const c = S.casks[i];
    if (Math.hypot(c.x - ship.state.x, c.y - ship.state.y) > CASK_REACH + ship.stats.length / 2) continue;
    S.casks.splice(i, 1);
    r.hold += c.marks;
    r.cask = true;
    toast(game, s, 'cask', 'gold', c.marks);
    game.sendTo(s, { t: 'blight_ev', ev: 'cask', n: c.marks });
  }
  hunt(game, s, ship, r);
}

/** Is the Veil a wall? docs/40 §1 asks for one (as the Maelstrom Wall). But the circle is 50 km² of open water in the
 *  middle of a live sea — four towns lie 6–7 km from its middle, the world's waystations and sea marks stand in it,
 *  wrecks and quest fights may fall in it, and the helmsman's courses between those towns run through it: walled, it
 *  would turn back every captain below the gate who sails there today (and a helmsman steering across it for ever).
 *  That breaks the live game's first rule, so the wall is built and tested but stands OPEN until the owner shuts it
 *  (`/blight veil wall`; kept in the store). Open, the zone is simply inert for a captain it has not taken. */
export function veilWall(game: Game): boolean {
  const S = st(game);
  if (S.wall === null) S.wall = game.db.getKv<boolean>('blight_wall') === true;
  return S.wall;
}

export function setVeilWall(game: Game, on: boolean): void {
  st(game).wall = on;
  game.db.setKv('blight_wall', on);
}

/** The Veil: thrown back once, the way she came, just past the rim, and turned about (abyss.ts abyssSecond, the
 *  version of forum 147) — with no hull lost. */
function veil(game: Game, s: PlayerSession, ship: ShipEntity): void {
  const h = ship.state.heading;
  const bx = -Math.sin(h), by = Math.cos(h);
  let out = false;
  for (let k = 1; k <= 200 && !out; k++) {
    const x = ship.state.x + bx * 50 * k, y = ship.state.y + by * 50 * k;
    if (inBlight(x, y) || !openSea(game, x, y)) continue;
    ship.state.x = x + bx * 150;
    ship.state.y = y + by * 150;
    ship.state.heading = h + Math.PI;
    out = true;
  }
  if (!out) {
    // (the way she came is barred by land or leads across the whole circle: straight out by the nearest rim)
    const dx = ship.state.x - BLIGHT.x, dy = ship.state.y - BLIGHT.y, d = Math.hypot(dx, dy) || 1;
    ship.state.x = BLIGHT.x + (dx / d) * (BLIGHT.r + 200);
    ship.state.y = BLIGHT.y + (dy / d) * (BLIGHT.r + 200);
    ship.state.heading = Math.atan2(dx, -dy);
  }
  ship.state.speed *= 0.3;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  if ((ship.talentReady.veilMsg ?? 0) <= game.now) {
    ship.talentReady.veilMsg = game.now + 5;
    toast(game, s, 'veil', 'bad');
    game.sendTo(s, { t: 'blight_ev', ev: 'veil' });
  }
}

/** A tier reached: told, the best kept, the week's board, the steps that ask for it. */
function tierCheck(game: Game, s: PlayerSession, r: BlightSave, before: number): void {
  const now = tierNow(r);
  if (now <= before) return;
  toast(game, s, 'tier', 'bad', now, Math.round(blightMul(now) * 100) / 100);
  game.sendTo(s, { t: 'blight_ev', ev: 'tier', n: now });
  if (now > r.best) r.best = now;
  weekBump(game, s, { tier: now });
  progress(game, s, { k: 'tier', n: now });
}

/** Out across the rim alive (or away too long, or brought out of it by anything but a sinking): her hold banked with
 *  no cut, the Taint washed off, her hunters called home. */
function leaveAlive(game: Game, s: PlayerSession, r: BlightSave): void {
  const cask = r.cask;
  castOff(game, s, false);
  bank(game, s, r, 'rim');
  r.in = false;
  end(game, s.accountId);
  if (cask) progress(game, s, { k: 'cask' });
  game.pushSelf(s, true);
}

/** The run's own state gone: no longer counted inside, her hunters give up the chase. */
function end(game: Game, acc: number): void {
  const S = st(game);
  S.inside.delete(acc);
  S.next.delete(acc);
  S.mooring.delete(acc);
  release(game, acc);
}

/** Her hold banked: at the Raft less its cut, across the rim whole. The Taint is washed off either way. */
function bank(game: Game, s: PlayerSession, r: BlightSave, how: 'rim' | 'raft'): void {
  const n = r.hold;
  const cut = how === 'raft' ? Math.floor(n * RAFT_CUT) : 0;
  const before = r.taint;
  r.hold = 0;
  r.taint = 0;
  r.cask = false;
  r.marks += n - cut;
  if (how === 'raft') release(game, s.accountId);
  if (n <= 0) {
    if (before > 0) game.pushSelf(s, true);
    return;
  }
  game.db.ledger(s.accountId, 'blight_marks', n - cut, how);
  weekBump(game, s, { banked: n - cut });
  if (how === 'raft') toast(game, s, 'bankRaft', 'gold', n - cut, cut);
  else toast(game, s, 'bankRim', 'gold', n);
  game.sendTo(s, { t: 'blight_ev', ev: 'bank', n: n - cut, cut });
  progress(game, s, { k: 'bank', n });
}

// ================================================================================================ the hunters

/** A ship of the green water's own at a ⚓, with an elite's hull and guns on the broadside table (seabalance.ts
 *  npcSeaScale) — and nothing else of an elite's: her wreck gives the gear of a common ship (gear.ts rollDrop), so the
 *  zone sells no power by the kill. */
function eliteScale(game: Game, ship: ShipEntity, anchor: number): void {
  ship.elite = true;
  game.setNpcLevel(ship, anchor);
  ship.elite = false;
}

/** A hunter of a tier on the water at a spot (the balance bench puts her where it wants). */
export function blightHunterAt(game: Game, tier: number, x: number, y: number, heading: number): ShipEntity {
  const S = st(game);
  const spec = hunterSpec(tier);
  // A ghost ship of the sea's own yards under the Choir's flag, fought as a ship of the ladder (the role «hunter»: the
  // role «ghost» is off the broadside table and falls to five broadsides at any ⚓ — measured), an elite of ⚓10, her
  // hull and guns by the tier. (The premium ghost hulls of docs/40 §3 are never sailed by the sea: Game.spawnNpcShip.)
  const name = S.rng.pick(HUNTER_NAMES)[0];
  const ship = game.spawnNpcShip('hunter', HUNTER_HULL as ShipClassId, 'choir', x, y, heading, { ship: name, captain: HUNTER_CAPTAIN[0] });
  ship.abyssSpawn = true; // (no hull to raise, none put out in her place: density.ts, Game.beginSinking)
  eliteScale(game, ship, spec.anchor);
  ship.effects.push({ id: 'blight_tier', until: 1e12, mods: { hullMax: spec.hull - 1, gunDamageMul: spec.guns - 1 } });
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.crew = ship.stats.crewMax;
  ship.morale = 100;
  ship.removeAt = game.now + 1500;
  S.hunters.set(ship.id, { account: -1, tier: Math.max(1, Math.floor(tier)) });
  game.grid.upsert(ship.id, x, y);
  return ship;
}

/** Her hunters kept to her tier's number: one more put out of sight within the circle when one is owed. */
function hunt(game: Game, s: PlayerSession, ship: ShipEntity, r: BlightSave): void {
  const S = st(game);
  const acc = s.accountId;
  if ((S.next.get(acc) ?? 0) > game.now) return;
  const tier = tierNow(r);
  let mine = 0;
  for (const [id, h] of S.hunters) {
    if (h.account !== acc) continue;
    const o = game.ships.get(id);
    if (o && o.alive && !o.sinkingUntil) mine++;
  }
  if (mine >= hunterSpec(tier).n) return;
  S.next.set(acc, game.now + HUNTER_GAP_S);
  const spot = hiddenSpot(game, { x: ship.state.x, y: ship.state.y }, 1700, 2300, (x, y) => Math.hypot(x - BLIGHT.x, y - BLIGHT.y) < BLIGHT.r - 150 && Math.hypot(x - BLIGHT_RAFT.x, y - BLIGHT_RAFT.y) > 700 && openSea(game, x, y) && game.inZone(x, y));
  if (!spot) return;
  const foe = blightHunterAt(game, tier, spot.x, spot.y, headingOf(ship.state.x - spot.x, ship.state.y - spot.y));
  S.hunters.get(foe.id)!.account = acc;
  const brain = game.npcs.get(foe.id);
  if (brain) {
    brain.huntAccount = acc;
    brain.area = { x: BLIGHT.x, y: BLIGHT.y, r: BLIGHT.r };
    brain.expiresAt = game.now + 900;
    planWander(game, foe, brain);
  }
  if (mine === 0 && r.kills === 0) toast(game, s, 'hunter', 'bad');
}

/** The hunters sent after a captain give up and leave the sea a minute later. */
function release(game: Game, acc: number): void {
  const S = states.get(game);
  if (!S) return;
  for (const [id, h] of S.hunters) {
    if (h.account !== acc) continue;
    h.account = -1;
    const b = game.npcs.get(id);
    if (!b) continue;
    b.huntAccount = null;
    b.target = null;
    b.chase = null;
    b.expiresAt = Math.min(b.expiresAt || Infinity, game.now + 60);
    const o = game.ships.get(id);
    if (o) o.removeAt = Math.min(o.removeAt || Infinity, game.now + 120);
  }
}

// ================================================================================================ kills

/** A ship sunk or taken by a captain (Game.creditKill, after the sea's own prize is paid): a hunter's marks and the
 *  Taint of it; a captain's marks by the zone's rules. Outside the green water nothing. */
export function blightKill(game: Game, s: PlayerSession, killer: ShipEntity, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  const S = states.get(game);
  const r = s.profile?.blight;
  if (!S || !r) return;
  if (victim.isPlayer) return captainKill(game, S, s, r, killer, victim, how);
  const h = S.hunters.get(victim.id);
  if (!h) return;
  S.hunters.delete(victim.id);
  if (!r.in) return;
  const before = tierNow(r);
  const n = Math.max(1, Math.round(HUNTER_MARKS * marksMul(game, s, r)));
  r.hold += n;
  r.kills++;
  toast(game, s, 'marks', 'gold', n, r.hold);
  // (the sea's own prize is paid by Game.creditKill; the green water's share on top of it, capped at ×4 in all)
  const base = prizeXp(s.profile!.level, victim.onLadder ? victim.combatLevel : null, how);
  const extra = base * (blightXpMul(before) - 1);
  if (extra >= 1) game.grantXp(s, extra, say('xp'), true);
  // A green cask now and then from the second water on — and always when a step of hers asks for one she lacks.
  const wants = !r.cask && wantsCask(game, s, r);
  if (wants || (before >= CASK_TIER && S.rng.chance(CASK_CHANCE))) S.casks.push({ x: victim.state.x, y: victim.state.y, marks: Math.max(1, Math.round(CASK_MARKS * blightMul(before))), until: game.now + CASK_SECS });
  r.taint += TAINT_HUNTER;
  tierCheck(game, s, r, before);
  progress(game, s, { k: 'sink', tier: before });
  if (S.next.get(s.accountId) === undefined || (S.next.get(s.accountId) ?? 0) < game.now + 8) S.next.set(s.accountId, game.now + 8);
  game.pushSelf(s, true);
}

/** A captain's hold as it is lost (her sinking, or her ship taken): all of it — half floats as a green cask, half is
 *  the victor's if a captain did it. Done once for a ship; the record waits a few seconds for the victor's pay. */
function lose(game: Game, S: State, vs: PlayerSession, victim: ShipEntity): Loss | null {
  const r = vs.profile?.blight;
  if (!r?.in) return null;
  const n = r.hold;
  const half = Math.floor(n / 2);
  const loss: Loss = { half, tier: tierNow(r), fresh: r.kills === 0 && game.wallNow() - r.since < PVP_FRESH_S * 1000, chosen: S.chosen === vs.accountId, at: game.now };
  S.lost.set(victim.id, loss);
  if (n - half > 0) S.casks.push({ x: victim.state.x, y: victim.state.y, marks: n - half, until: game.now + CASK_SECS });
  r.hold = 0;
  r.taint = 0;
  r.cask = false;
  r.in = false;
  S.noBubble.add(vs.accountId);
  const hand = S.hands.get(vs.accountId);
  if (hand && !hand.result) settle(game, vs, hand);
  castOff(game, vs, false);
  end(game, vs.accountId);
  if (n > 0) {
    toast(game, vs, 'sunkLost', 'bad', n);
    game.sendTo(vs, { t: 'blight_ev', ev: 'lost', n });
  }
  return loss;
}

/** A ship going down (Game.beginSinking, before the kill is credited): a captain's hold inside is lost; the Heart's
 *  spoils are shared. */
export function blightSinking(game: Game, ship: ShipEntity): void {
  const S = states.get(game);
  if (!S) return;
  if (S.heart?.id === ship.id) return heartSunk(game, S);
  if (!ship.isPlayer) return;
  const vs = game.sessionOf(ship);
  if (vs) lose(game, S, vs, ship);
}

/** Sunk inside the green water: no bubble on sailing again (asked once, by Game.playerDeath). */
export function blightNoBubble(game: Game, acc: number): boolean {
  return states.get(game)?.noBubble.delete(acc) ?? false;
}

function captainKill(game: Game, S: State, ks: PlayerSession, kr: BlightSave, killer: ShipEntity, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  const vs = game.sessionOf(victim);
  if (!vs) return;
  const loss = S.lost.get(victim.id) ?? lose(game, S, vs, victim);
  S.lost.delete(victim.id);
  if (!loss || !kr.in) return;
  // Group-mates and guild-mates pay nothing.
  if (sameGroupAccounts(game, ks.accountId, vs.accountId) || guildFriends(game, killer, victim)) return toast(game, ks, 'pvpNone', 'info', vs.name);
  const wall = game.wallNow();
  const again = wall - (kr.paid[vs.accountId] ?? 0) < PVP_REPEAT_MS;
  const share = again ? PVP_REPEAT_SHARE : 1;
  if (!again) kr.paid[vs.accountId] = wall;
  for (const k of Object.keys(kr.paid)) if (wall - kr.paid[k] > PVP_REPEAT_MS) delete kr.paid[k];
  const before = tierNow(kr);
  const base = loss.fresh ? 0 : pvpMarks(loss.tier) * (loss.chosen ? CHOSEN_PAYS : 1) * share * (S.chosen === ks.accountId ? CHOSEN_EARNS : 1);
  const n = Math.round(base) + loss.half;
  kr.hold += n;
  kr.kills++;
  if (loss.fresh && !loss.half) toast(game, ks, 'pvpNone', 'info', vs.name);
  else {
    if (again) toast(game, ks, 'pvpRepeat', 'info', vs.name);
    toast(game, ks, 'pvpPaid', 'gold', vs.name, n);
  }
  // Experience ×2 of the usual prize, by her tier (capped): the usual one is paid already (Game.creditKill).
  const usual = prizeXp(ks.profile!.level, victim.onLadder ? victim.combatLevel : null, how);
  const extra = usual * (2 * blightXpMul(before) * share - 1);
  if (extra >= 1) game.grantXp(ks, extra, say('xp'), true);
  kr.taint += TAINT_CAPTAIN;
  tierCheck(game, ks, kr, before);
  weekBump(game, ks, { sunk: 1 });
  progress(game, ks, { k: 'captain' });
  game.pushSelf(ks, true);
}

// ================================================================================================ the Raft

const moorHot = (game: Game, ship: ShipEntity): boolean => game.now - ship.lastHitAt < RAFT_QUIET_SECS || game.now - ship.lastCombat < RAFT_QUIET_SECS;

/** «Пришвартоваться»: five seconds hove to within the Raft's reach, no shot given or taken for half a minute. */
export function blightMoor(game: Game, s: PlayerSession): string | null {
  const ship = s.ship, r = s.profile?.blight;
  if (!ship || !r?.in || !blightCleared(game, s)) return say('notCleared');
  const S = st(game);
  if (S.moored.has(s.accountId) || S.mooring.has(s.accountId)) return null;
  if (!ship.alive || ship.sinkingUntil || ship.boarding || ship.grappled) return say('moorBusy');
  if (Math.hypot(ship.state.x - BLIGHT_RAFT.x, ship.state.y - BLIGHT_RAFT.y) > RAFT_REACH) return say('moorFar');
  if (moorHot(game, ship)) return say('moorHot');
  S.mooring.set(s.accountId, game.now + RAFT_MOOR_SECS);
  ship.input = { rudder: 0, sailTarget: 0 };
  s.sailHold = s.lastSail;
  toast(game, s, 'mooring', 'info');
  game.pushSelf(s, true);
  return null;
}

/** Cast off: her own «В море», or the lines parted (she drifted off, a boarding, her sinking). A hand on the table is
 *  stood on as it is. */
function castOff(game: Game, s: PlayerSession, tell: boolean): void {
  const S = st(game);
  S.mooring.delete(s.accountId);
  if (!S.moored.delete(s.accountId)) return;
  const hand = S.hands.get(s.accountId);
  if (hand && !hand.result) settle(game, s, hand);
  S.hands.delete(s.accountId);
  game.sendTo(s, { t: 'blight_bj', view: null });
  if (tell) toast(game, s, 'castOff', 'info');
  // (the hunters come again in their own time)
  if (s.profile?.blight?.in) S.next.set(s.accountId, game.now + HUNTER_FIRST_S);
  game.pushSelf(s, true);
}

/** No gun is fired at the Raft: a moored captain's ship (and those that sail with her) neither takes a shot nor gives
 *  one (combat.ts damageBlocked). */
export function raftBlocked(game: Game, a: ShipEntity, b: ShipEntity): string | null {
  const S = states.get(game);
  if (!S || !S.moored.size) return null;
  const ca = captainBehind(game, a), cb = captainBehind(game, b);
  if ((cb && cb.accountId !== null && S.moored.has(cb.accountId)) || (ca && ca.accountId !== null && S.moored.has(ca.accountId))) return say('raftPeace');
  return null;
}

/** The ships the green water sends — its hunters, its Heart — are fought with the guns alone: they board nobody and
 *  no deck of theirs is taken (boarding.ts canBoard). So no ghost ship is ever had as a prize here, and a captain's
 *  marks are lost only by her sinking or to another captain. */
export function heartBoardBlocked(game: Game, a: ShipEntity, b: ShipEntity): string | null {
  const S = states.get(game);
  if (!S) return null;
  const own = (x: ShipEntity): boolean => S.heart?.id === x.id || S.hunters.has(x.id);
  return own(a) || own(b) ? say('heartNoBoard') : null;
}

// ------------------------------------------------------------------------------------------------ blackjack

function bjLimits(game: Game, r: BlightSave): BlightSave['bj'] {
  const wall = game.wallNow();
  const hour = Math.floor(wall / HOUR_MS), day = dayOf(wall);
  if (r.bj.hour !== hour) {
    r.bj.hour = hour;
    r.bj.hands = 0;
  }
  if (r.bj.day !== day) {
    r.bj.day = day;
    r.bj.lost = 0;
  }
  return r.bj;
}

function bjView(h: Hand, r: BlightSave, gold: number): BjView {
  const over = h.result !== null;
  const t = bjTotal(h.player);
  const shown = over ? h.dealer : h.dealer.slice(0, 1);
  const can = !over && h.player.length === 2 && !h.doubled && (h.coin === 'silver' ? gold >= h.stake && r.bj.lost + h.stake * 2 <= BJ_SILVER_DAY : r.marks >= h.stake);
  return { coin: h.coin, stake: h.stake, doubled: h.doubled, player: [...h.player], dealer: over ? [...h.dealer] : [h.dealer[0], -1], total: t.total, soft: t.soft, dealerTotal: bjTotal(shown).total, canDouble: can, result: h.result, back: h.back };
}

function sendHand(game: Game, s: PlayerSession, h: Hand): void {
  game.sendTo(s, { t: 'blight_bj', view: bjView(h, s.profile!.blight!, s.profile!.gold) });
}

/** The hand's end: the dealer plays his out (unless she broke or holds a natural), the stake comes back by the rules,
 *  the ledger has its line. */
function settle(game: Game, s: PlayerSession, h: Hand): void {
  const p = s.profile!, r = p.blight!;
  const mine = bjTotal(h.player).total;
  if (mine <= 21 && !bjNatural(h.player)) h.dealer = bjDealer(h.dealer, h.deck);
  h.result = bjResult(h.player, h.dealer);
  h.back = bjReturn(h.result, h.stake);
  if (h.coin === 'silver') {
    p.gold += h.back;
    bjLimits(game, r).lost += h.stake - h.back;
    game.db.ledger(s.accountId, 'blackjack', h.back - h.stake, `raft ${h.result}`);
  } else {
    r.marks += h.back;
    game.db.ledger(s.accountId, 'blackjack_marks', h.back - h.stake, `raft ${h.result}`);
  }
  const won = h.back - h.stake;
  if (h.result === 'blackjack') toast(game, s, 'bjNatural', 'gold', won);
  else if (h.result === 'win') toast(game, s, 'bjWin', 'gold', won);
  else if (h.result === 'push') toast(game, s, 'bjPush', 'info');
  else toast(game, s, h.result === 'bust' ? 'bjBust' : 'bjLose', 'bad');
  if (h.result === 'blackjack' || h.result === 'win') progress(game, s, { k: 'bj' });
}

/** The next hand dealt from these cards in this order (tests: every outcome from a fixed deck). */
export function blightRigDeck(game: Game, cards: number[] | null): void {
  st(game).rig = cards ? [...cards] : null;
}

function bjOrder(game: Game, s: PlayerSession, msg: Extract<BlightClientMsg, { action: 'bj' }>): string | null {
  const p = s.profile!, r = p.blight;
  const S = st(game);
  if (!r || !S.moored.has(s.accountId)) return say('raftOnly');
  const cur = S.hands.get(s.accountId);
  if (msg.op === 'deal') {
    if (cur && !cur.result) return say('bjBusy');
    const coin: BjCoin = msg.coin === 'marks' ? 'marks' : 'silver';
    const stake = Math.trunc(Number(msg.stake));
    if (!BJ_STAKES[coin].includes(stake)) return say('bjStake');
    const lim = bjLimits(game, r);
    if (lim.hands >= BJ_HANDS_HOUR) return say('bjHour');
    if (coin === 'silver') {
      if (lim.lost + stake > BJ_SILVER_DAY) return say('bjDay');
      if (p.gold < stake) return lackSilver(stake, p.gold);
      p.gold -= stake;
    } else {
      if (r.marks < stake) return say('bjMarks', stake);
      r.marks -= stake;
    }
    lim.hands++;
    // One deck shuffled for the hand on the table's own Rng; dealt her, him, her, him.
    const deck = S.rig ? [...S.rig].reverse() : bjDeck(S.rng);
    S.rig = null;
    const h: Hand = { coin, stake, doubled: false, deck, player: [], dealer: [], result: null, back: 0 };
    h.player.push(deck.pop()!);
    h.dealer.push(deck.pop()!);
    h.player.push(deck.pop()!);
    h.dealer.push(deck.pop()!);
    S.hands.set(s.accountId, h);
    if (bjNatural(h.player) || bjNatural(h.dealer)) settle(game, s, h);
    sendHand(game, s, h);
    return null;
  }
  if (!cur || cur.result) return say('bjNone');
  if (msg.op === 'hit') {
    cur.player.push(cur.deck.pop()!);
    if (bjTotal(cur.player).total >= 21) settle(game, s, cur);
  } else if (msg.op === 'double') {
    if (cur.player.length !== 2 || cur.doubled) return say('bjDouble');
    if (cur.coin === 'silver') {
      if (bjLimits(game, r).lost + cur.stake * 2 > BJ_SILVER_DAY) return say('bjDay');
      if (p.gold < cur.stake) return lackSilver(cur.stake, p.gold);
      p.gold -= cur.stake;
    } else {
      if (r.marks < cur.stake) return say('bjMarks', cur.stake);
      r.marks -= cur.stake;
    }
    cur.stake *= 2;
    cur.doubled = true;
    cur.player.push(cur.deck.pop()!);
    settle(game, s, cur);
  } else if (msg.op === 'stand') settle(game, s, cur);
  else return say('bjNone');
  sendHand(game, s, cur);
  return null;
}

// ------------------------------------------------------------------------------------------------ the shop

function shopWeek(game: Game, r: BlightSave): BlightSave['shop'] {
  const week = Math.floor(game.wallNow() / WEEK_MS);
  if (r.shop.week !== week) r.shop = { week, n: {} };
  return r.shop;
}

function owned(p: Profile, id: BlightWare): boolean {
  return id === 'title' ? p.titles.includes(BLIGHT_TITLE[0]) : id === 'pennant' ? p.pennants.includes(BLIGHT_PENNANT) : false;
}

function buy(game: Game, s: PlayerSession, id: string, uid: number, line: number): string | null {
  const p = s.profile!, r = p.blight;
  const S = st(game);
  if (!r || !S.moored.has(s.accountId)) return say('raftOnly');
  const w = BLIGHT_SHOP.find((x) => x.id === id);
  if (!w) return say('shopNone');
  if (w.once && owned(p, w.id)) return say('shopOwned');
  const shop = shopWeek(game, r);
  const price = shopPrice(w.price, shop.n[w.id] ?? 0);
  if (r.marks < price) return say('bjMarks', price);
  let what = w.name[0];
  switch (w.id) {
    case 'title':
      p.titles.push(BLIGHT_TITLE[0]);
      break;
    case 'pennant':
      p.pennants.push(BLIGHT_PENNANT);
      break;
    case 'speedup':
      if (grantSpeedups(p, 1) < 1) return say('shopFull');
      break;
    case 'relic':
      if (!relicPartDrop(game, s, 'contract', 1)) return say('shopNoRelic');
      break;
    case 'reroll': {
      const it = findPiece(p, Math.trunc(uid));
      const roll = it ? reforgeLine(S.rng, it, Math.trunc(line)) : null;
      if (!it || !roll) return say('shopNoPiece');
      it.affixes[Math.trunc(line)] = roll;
      applyWorn(game, s);
      what = itemName(it);
      toast(game, s, 'rerolled', 'good', what);
      break;
    }
    case 'lantern':
      r.lantern = Math.max(r.lantern, game.wallNow()) + LANTERN_SECS * 1000;
      toast(game, s, 'shopLantern', 'good');
      break;
  }
  r.marks -= price;
  shop.n[w.id] = (shop.n[w.id] ?? 0) + 1;
  game.db.ledger(s.accountId, 'blight_shop', -price, w.id);
  toast(game, s, 'shopBought', 'good', w.name[0], price);
  game.sendTo(s, { t: 'blight_ev', ev: 'bought', id: w.id, n: price });
  return null;
}

// ================================================================================================ the chapter, the contracts

type Ev =
  | { k: 'reach' } | { k: 'moor' } | { k: 'bj' } | { k: 'heart' } | { k: 'captain' } | { k: 'cask' }
  | { k: 'sink'; tier: number } | { k: 'tier'; n: number } | { k: 'bank'; n: number } | { k: 'tick'; tier: number };

/** What an event adds to a step's count (0: nothing; Infinity: done at once). */
function counts(step: BlightStep, ev: Ev): number {
  switch (step.k) {
    case 'reach': return ev.k === 'reach' ? 1 : 0;
    case 'moor': return ev.k === 'moor' ? 1 : 0;
    case 'sink': return ev.k === 'sink' && ev.tier >= (step.tier ?? 1) ? 1 : 0;
    case 'tier': return ev.k === 'tier' && ev.n >= step.n ? 1 : 0;
    case 'bank': return ev.k === 'bank' && ev.n >= step.n ? 1 : 0;
    case 'bj': return ev.k === 'bj' ? 1 : 0;
    case 'heart': return ev.k === 'heart' ? 1 : 0;
    case 'duel': return ev.k === 'captain' ? Infinity : ev.k === 'sink' && ev.tier >= step.tier ? 1 : 0;
    case 'survive': return ev.k === 'tick' && ev.tier >= step.tier ? 1 : 0;
    case 'cask': return ev.k === 'cask' ? 1 : 0;
  }
}

/** A step that is true of her already (she takes «reach the third water» in the fourth): done as it comes up. */
function already(game: Game, s: PlayerSession, r: BlightSave, step: BlightStep): boolean {
  return (step.k === 'reach' && r.in) || (step.k === 'moor' && raftMoored(game, s)) || (step.k === 'tier' && r.in && tierNow(r) >= step.n);
}

/** Her contracts of the day (the chapter behind her), the day's record made anew at its turn. */
function contractsOf(game: Game, s: PlayerSession, r: BlightSave): BlightContract[] {
  if (r.ch.at < BLIGHT_QUESTS.length) return [];
  const d = dayOf(game.wallNow());
  if (r.day.d !== d) r.day = { d, b: r.best, n: Array.from({ length: CONTRACTS_A_DAY }, () => 0), paid: Array.from({ length: CONTRACTS_A_DAY }, () => false) };
  return dayContracts(d, s.accountId, r.day.b);
}

/** Does a step of hers want a green cask (her quest's, or an unpaid contract's)? */
function wantsCask(game: Game, s: PlayerSession, r: BlightSave): boolean {
  const q = r.ch.cur ? BLIGHT_QUESTS[r.ch.at] : undefined;
  if (q && r.ch.cur && q.s[r.ch.cur.step]?.k === 'cask') return true;
  return contractsOf(game, s, r).some((c) => c.step.k === 'cask' && !r.day.paid[c.id] && (r.day.n[c.id] ?? 0) < 1);
}

/** Something happened: her quest's step and her contracts count it. */
function progress(game: Game, s: PlayerSession, ev: Ev): void {
  const r = s.profile?.blight;
  if (!r) return;
  const cur = r.ch.cur;
  const q = cur ? BLIGHT_QUESTS[r.ch.at] : undefined;
  if (cur && q && cur.step < q.s.length) {
    const step = q.s[cur.step];
    const add = counts(step, ev);
    if (add > 0) {
      cur.n = Math.min(stepNeed(step), cur.n + add);
      if (cur.n >= stepNeed(step)) advance(game, s, r);
      else if (ev.k !== 'tick') game.pushSelf(s, true);
    }
  }
  if (r.ch.at >= BLIGHT_QUESTS.length) {
    for (const c of contractsOf(game, s, r)) {
      if (r.day.paid[c.id]) continue;
      const need = stepNeed(c.step);
      if ((r.day.n[c.id] ?? 0) >= need) continue;
      const add = counts(c.step, ev);
      if (add > 0) r.day.n[c.id] = Math.min(need, (r.day.n[c.id] ?? 0) + add);
    }
  }
}

/** The step she was on is done: told, the next comes up (and is done at once if it is true of her already). */
function advance(game: Game, s: PlayerSession, r: BlightSave): void {
  const q = BLIGHT_QUESTS[r.ch.at];
  for (let guard = 0; guard < 8 && r.ch.cur && r.ch.cur.step < q.s.length; guard++) {
    const step = q.s[r.ch.cur.step];
    if (r.ch.cur.n < stepNeed(step) && !already(game, s, r, step)) break;
    toast(game, s, 'qStep', 'good', stepText(step)[0]);
    r.ch.cur.step++;
    r.ch.cur.n = 0;
  }
  game.pushSelf(s, true);
}

function take(game: Game, s: PlayerSession): string | null {
  if (!blightCleared(game, s)) return say('notCleared');
  const r = rec(s.profile!);
  if (r.ch.at >= BLIGHT_QUESTS.length) return say('qNone');
  if (r.ch.cur) return say('qHave');
  r.ch.cur = { step: 0, n: 0 };
  toast(game, s, 'qTaken', 'info', BLIGHT_QUESTS[r.ch.at].t[0]);
  advance(game, s, r);
  return null;
}

function claim(game: Game, s: PlayerSession): string | null {
  const p = s.profile!, r = p.blight;
  if (!r?.ch.cur) return say('qNone');
  const q = BLIGHT_QUESTS[r.ch.at];
  if (r.ch.cur.step < q.s.length) return say('qUndone');
  if (!raftMoored(game, s)) return say('raftOnly');
  r.ch.cur = null;
  r.ch.at++;
  r.marks += q.marks;
  game.db.ledger(s.accountId, 'blight_marks', q.marks, `quest ${r.ch.at}`);
  toast(game, s, 'qDone', 'gold', q.t[0], q.marks);
  game.grantXp(s, lumpXp(p.level, q.units), q.t[0], false, true);
  game.sendTo(s, { t: 'blight_ev', ev: 'quest', n: q.marks });
  if (r.ch.at >= BLIGHT_QUESTS.length) {
    const title = BLIGHT_CHAPTER.reward.title[0];
    if (!p.titles.includes(title)) p.titles.push(title);
    if (!p.pennants.includes(BLIGHT_CHAPTER.reward.pennant)) p.pennants.push(BLIGHT_CHAPTER.reward.pennant);
    toast(game, s, 'chapterDone', 'gold');
    logNote(game, s, 'quest', [say('chapterDone')]);
  }
  game.pushSelf(s, true);
  return null;
}

function claimContract(game: Game, s: PlayerSession, id: number): string | null {
  const p = s.profile!, r = p.blight;
  if (!r) return say('cNone');
  const c = contractsOf(game, s, r).find((x) => x.id === Math.trunc(id));
  if (!c || r.day.paid[c.id]) return say('cNone');
  if ((r.day.n[c.id] ?? 0) < stepNeed(c.step)) return say('qUndone');
  if (!raftMoored(game, s)) return say('raftOnly');
  r.day.paid[c.id] = true;
  r.marks += c.marks;
  game.db.ledger(s.accountId, 'blight_marks', c.marks, 'contract');
  toast(game, s, 'cDone', 'gold', c.marks);
  game.grantXp(s, lumpXp(p.level, c.units), say('xp'), false, true);
  game.sendTo(s, { t: 'blight_ev', ev: 'contract', n: c.marks });
  game.pushSelf(s, true);
  return null;
}

// ================================================================================================ the Heart

/** The Blight's Heart rises by the Raft (her calendar's hour, or an admin's word). */
export function blightHeartRise(game: Game): ShipEntity | null {
  const S = st(game);
  if (S.heart && game.ships.get(S.heart.id)?.alive) return game.ships.get(S.heart.id)!;
  const x = BLIGHT_RAFT.x, y = BLIGHT_RAFT.y - 900;
  const ship = game.spawnNpcShip('hunter', HUNTER_HULL as ShipClassId, 'choir', x, y, Math.PI, { ship: HEART_NAME[0], captain: HEART_CAPTAIN[0] });
  ship.abyssSpawn = true;
  eliteScale(game, ship, 10);
  ship.effects.push({ id: 'blight_heart', until: 1e12, mods: { hullMax: HEART_HULL - 1, gunDamageMul: HEART_GUNS - 1 } });
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.crew = ship.stats.crewMax;
  ship.morale = 100;
  ship.removeAt = game.now + HEART_STAY_S + 60;
  const brain = game.npcs.get(ship.id);
  if (brain) {
    brain.area = { x: BLIGHT_RAFT.x, y: BLIGHT_RAFT.y, r: 1400 };
    brain.keep = true;
    brain.active = true;
    planWander(game, ship, brain);
  }
  game.grid.upsert(ship.id, x, y);
  S.heart = { id: ship.id, until: game.now + HEART_STAY_S, parts: new Map() };
  for (const o of game.sessions) if (o.profile?.blight?.told && blightCleared(game, o)) toast(game, o, 'heartUp', 'bad');
  return ship;
}

/** Hull taken off the Heart, to the captain behind the gun (combat.ts, where the zone bosses' parts are counted). */
export function blightCredit(game: Game, target: ShipEntity, source: ShipEntity | null, hull: number): void {
  const h = states.get(game)?.heart;
  if (!h || h.id !== target.id || hull <= 0) return;
  const cap = captainBehind(game, source);
  if (!cap || cap.accountId === null) return;
  h.parts.set(cap.accountId, (h.parts.get(cap.accountId) ?? 0) + hull);
}

/** The Heart goes down: the marks by each captain's part of her (a part under three hundredths: nothing), the Taint
 *  of it, the experience; only those still inside are paid. */
function heartSunk(game: Game, S: State): void {
  const h = S.heart!;
  S.heart = null;
  let total = 0;
  for (const v of h.parts.values()) total += v;
  for (const o of S.inside.values()) toast(game, o, 'heartDown', 'good');
  for (const [acc, part] of h.parts) {
    const s = S.inside.get(acc);
    const r = s?.profile?.blight;
    if (!s || !r?.in || total <= 0 || part / total < HEART_MIN_PART) continue;
    const before = tierNow(r);
    const n = Math.max(1, Math.round(HEART_POOL * (part / total) * marksMul(game, s, r)));
    r.hold += n;
    r.kills++;
    toast(game, s, 'heartShare', 'gold', n);
    game.grantXp(s, lumpXp(s.profile!.level, 30 * (part / total)) * blightXpMul(before), HEART_NAME[0], true);
    r.taint += TAINT_HEART;
    tierCheck(game, s, r, before);
    progress(game, s, { k: 'heart' });
    game.pushSelf(s, true);
  }
}

// ================================================================================================ every second, the zone

/** Once a second (Game.everySecond): the Heart's calendar, the casks, the hunters' roll, the Chosen, the week. With
 *  no captain cleared and aboard it does nothing but look at the clock. */
export function stepBlight(game: Game): void {
  const S = st(game);
  const wall = game.wallNow();
  const slot = Math.floor(wall / HEART_EVERY_MS);
  if (S.heartSlot < 0) S.heartSlot = slot; // (a server just started raises nothing)
  const anyone = (): boolean => [...game.sessions].some((o) => !!o.profile?.blight?.told && o.disconnectedAt === null && blightCleared(game, o));
  if ((slot + 1) * HEART_EVERY_MS - wall <= HEART_WARN_MS && S.warned !== slot + 1) {
    S.warned = slot + 1;
    for (const o of game.sessions) if (o.profile?.blight?.told && blightCleared(game, o)) toast(game, o, 'heartSoon', 'info');
  }
  if (slot !== S.heartSlot) {
    S.heartSlot = slot;
    if (anyone()) blightHeartRise(game);
  }
  if (S.heart) {
    const ship = game.ships.get(S.heart.id);
    if (!ship || !ship.alive) S.heart = null;
    else if (game.now >= S.heart.until && !ship.sinkingUntil) {
      for (const o of S.inside.values()) toast(game, o, 'heartGone', 'info');
      S.heart = null;
      game.removeShip(ship.id);
    }
  }
  if (S.casks.length) S.casks = S.casks.filter((c) => c.until > game.now);
  if (S.hunters.size) for (const id of [...S.hunters.keys()]) if (!game.ships.has(id)) S.hunters.delete(id);
  if (S.lost.size) for (const [id, l] of S.lost) if (game.now - l.at > 30) S.lost.delete(id);
  // Captains gone from the game with a run open: their place in the roll is given up (the run itself waits five
  // minutes in the save).
  let top: PlayerSession | null = null, topTier = 0;
  for (const [acc, s] of S.inside) {
    const r = s.profile?.blight;
    if (!r?.in || !game.sessions.has(s)) {
      end(game, acc);
      S.moored.delete(acc);
      continue;
    }
    const t = tierNow(r);
    if (t > topTier || (t === topTier && top && r.taint > (top.profile!.blight!.taint))) {
      top = s;
      topTier = t;
    }
  }
  // «Избранник Скверны»: the highest tier of two captains or more inside, from the third water.
  const chosen = top && S.inside.size >= 2 && topTier >= CHOSEN_MIN_TIER ? top.accountId : null;
  if (chosen !== S.chosen) {
    S.chosen = chosen;
    if (top && chosen !== null) {
      toast(game, top, 'chosen', 'gold');
      for (const o of S.inside.values()) if (o !== top) toast(game, o, 'chosenOther', 'info', top.name);
    }
  }
  if (Math.floor(game.now) % 60 === 7) weekTurn(game);
}

// ================================================================================================ the week

interface WeekRow {
  name: string;
  tier: number;
  banked: number;
  sunk: number;
}
interface Week {
  week: number;
  rows: Record<string, WeekRow>;
}
/** The week before: who holds which title, and whether her marks are paid. */
interface Honours {
  week: number;
  top: Record<string, { place: number; paid: boolean }>;
}

/** The week's board and the week before's honours, read from the store once and kept (every change is written through). */
const boards = new WeakMap<Game, { week: Week; hon: Honours | null }>();
function board(game: Game): { week: Week; hon: Honours | null } {
  let b = boards.get(game);
  if (!b) boards.set(game, (b = { week: game.db.getKv<Week>('blight_week') ?? { week: Math.floor(game.wallNow() / WEEK_MS), rows: {} }, hon: game.db.getKv<Honours>('blight_honours') ?? null }));
  return b;
}
const weekOf = (game: Game): Week => board(game).week;
const honoursOf = (game: Game): Honours | null => board(game).hon;

function weekBump(game: Game, s: PlayerSession, d: { tier?: number; banked?: number; sunk?: number }): void {
  const w = weekOf(game);
  const row = (w.rows[s.accountId] ??= { name: s.name, tier: 1, banked: 0, sunk: 0 });
  row.name = s.name;
  if (d.tier) row.tier = Math.max(row.tier, d.tier);
  row.banked += d.banked ?? 0;
  row.sunk += d.sunk ?? 0;
  game.db.setKv('blight_week', w);
}

/** The board's order: marks banked, then the highest tier, then captains sunk. */
function ranked(w: Week): [string, WeekRow][] {
  return Object.entries(w.rows).sort((a, b) => b[1].banked - a[1].banked || b[1].tier - a[1].tier || b[1].sunk - a[1].sunk);
}

/** The week turns: its three are named, their titles theirs for the week to come, their marks owed (paid when each
 *  is next aboard), a letter to each. */
function weekTurn(game: Game, force = false): void {
  const w = weekOf(game);
  const now = Math.floor(game.wallNow() / WEEK_MS);
  if (w.week === now && !force) return;
  const top = ranked(w).filter(([, r]) => r.banked > 0 || r.sunk > 0 || r.tier > 1).slice(0, 3);
  const hon: Honours = { week: now, top: {} };
  top.forEach(([acc, row], i) => {
    hon.top[acc] = { place: i, paid: false };
    deliver(game, Number(acc), { from: say('letterFrom'), subject: say('weekLetter'), body: say('weekBody', i + 1), gold: 0, goods: null });
    if (i === 0) for (const o of game.sessions) if (o.profile?.blight?.told) toast(game, o, 'weekTop', 'gold', row.name, WEEK_TITLES[0][0]);
  });
  board(game).hon = hon;
  board(game).week = { week: now, rows: {} };
  game.db.setKv('blight_honours', hon);
  game.db.setKv('blight_week', board(game).week);
}

/** Her title of the week kept true to the board (given, and taken back when the week is another's); her marks of it
 *  paid once. Looked at once a minute for a cleared captain. */
function weekSync(game: Game, s: PlayerSession, r: BlightSave, now = false): void {
  if (!now && Math.floor(game.now) % 60 !== (s.accountId % 60)) return;
  const p = s.profile!;
  const hon = honoursOf(game);
  const mine = hon?.top[s.accountId];
  WEEK_TITLES.forEach(([title], i) => {
    const has = p.titles.includes(title);
    if (mine?.place === i && !has) p.titles.push(title);
    else if (mine?.place !== i && has) {
      p.titles = p.titles.filter((x) => x !== title);
      if (p.title === title) p.title = null;
    }
  });
  if (hon && mine && !mine.paid) {
    mine.paid = true;
    game.db.setKv('blight_honours', hon);
    r.marks += WEEK_MARKS[mine.place];
    toast(game, s, 'weekPaid', 'gold', mine.place + 1, WEEK_MARKS[mine.place]);
    game.pushSelf(s, true);
  }
}

function weekView(game: Game, acc: number): BlightWeekRow[] {
  const all = ranked(weekOf(game));
  const out: BlightWeekRow[] = all.slice(0, 10).map(([a, r]) => ({ name: r.name, tier: r.tier, banked: r.banked, sunk: r.sunk, ...(Number(a) === acc ? { me: true as const } : {}) }));
  if (!out.some((x) => x.me)) {
    const mine = all.find(([a]) => Number(a) === acc);
    if (mine) out.push({ name: mine[1].name, tier: mine[1].tier, banked: mine[1].banked, sunk: mine[1].sunk, me: true });
  }
  return out;
}

// ================================================================================================ her orders, her view

export function blightMessage(game: Game, s: PlayerSession, msg: BlightClientMsg): void {
  if (!s.profile || !s.ship) return;
  const err = (r: string | null): void => {
    if (r) game.sendTo(s, { t: 'toast', msg: r, kind: 'bad' });
  };
  if (!blightCleared(game, s)) return err(say('notCleared'));
  switch (msg.action) {
    case 'moor': return err(blightMoor(game, s));
    case 'leave': return castOff(game, s, true);
    case 'bj': err(bjOrder(game, s, msg)); return game.pushSelf(s, true);
    case 'buy': err(buy(game, s, String(msg.id), Number(msg.uid), Number(msg.line))); return game.pushSelf(s, true);
    case 'take': return err(take(game, s));
    case 'claim': return err(claim(game, s));
    case 'contract': return err(claimContract(game, s, Number(msg.id)));
  }
}

function taskView(steps: BlightStep[], step: number, n: number): BlightTaskView {
  const at = steps[Math.min(step, steps.length - 1)];
  return { step, steps: steps.length, progress: step >= steps.length ? stepNeed(at) : n, need: stepNeed(at) };
}

/** PrivateState.blight: null for a captain the green water has not taken. */
export function blightView(game: Game, s: PlayerSession): BlightView | null {
  const p = s.profile, ship = s.ship;
  if (!p || !blightCleared(game, s)) return null;
  const S = st(game);
  const r = rec(p);
  const wall = game.wallNow();
  const inside = r.in;
  const tier = inside ? tierNow(r) : 1;
  const q = BLIGHT_QUESTS[r.ch.at];
  const moored = S.moored.has(s.accountId);
  const cs = contractsOf(game, s, r);
  const lim = bjLimits(game, r);
  const shop = shopWeek(game, r);
  const chosen = inside && S.chosen !== null ? S.inside.get(S.chosen) : undefined;
  const heartShip = S.heart ? game.ships.get(S.heart.id) : undefined;
  const toRise = (Math.floor(wall / HEART_EVERY_MS) + 1) * HEART_EVERY_MS - wall;
  const hon = honoursOf(game)?.top[s.accountId];
  const mooring = S.mooring.get(s.accountId);
  const contracts: BlightContractView[] = cs.map((c) => ({ id: c.id, ask: c.step, marks: c.marks, xp: lumpXp(p.level, c.units), paid: !!r.day.paid[c.id], step: (r.day.n[c.id] ?? 0) >= stepNeed(c.step) ? 1 : 0, steps: 1, progress: r.day.n[c.id] ?? 0, need: stepNeed(c.step) }));
  const tod = timeOfDay(game.now); // (the sea's clock, as dice.ts reads it for Davy's hour)
  return {
    zone: { x: BLIGHT.x, y: BLIGHT.y, r: BLIGHT.r }, raft: { x: BLIGHT_RAFT.x, y: BLIGHT_RAFT.y },
    inside, tier, taint: inside ? Math.floor(r.taint % TAINT_PER_TIER) : 0, per: TAINT_PER_TIER, hold: r.hold, marks: r.marks,
    mul: Math.round((inside ? marksMul(game, s, r) : blightMul(1)) * 100) / 100, xpMul: Math.round(blightXpMul(tier) * 100) / 100, best: r.best,
    lantern: r.lantern > wall ? r.lantern : 0,
    moored, mooring: mooring !== undefined ? Math.round(mooring * 10) / 10 : 0,
    atRaft: !!ship && inside && Math.hypot(ship.state.x - BLIGHT_RAFT.x, ship.state.y - BLIGHT_RAFT.y) <= RAFT_REACH,
    chosen: chosen?.ship ? { name: chosen.name, x: Math.round(chosen.ship.state.x), y: Math.round(chosen.ship.state.y), tier: tierNow(chosen.profile!.blight!), ...(chosen === s ? { me: true as const } : {}) } : null,
    heart: heartShip ? { id: heartShip.id, x: Math.round(heartShip.state.x), y: Math.round(heartShip.state.y), hp: Math.round((Math.max(0, heartShip.hull) / Math.max(1, heartShip.stats.hullMax)) * 100) / 100, until: Math.round(S.heart!.until) }
      : toRise <= HEART_WARN_MS ? { at: wall + toRise } : null,
    casks: inside ? S.casks.map((c) => [Math.round(c.x), Math.round(c.y), c.marks] as [number, number, number]) : [],
    cask: r.cask,
    hunters: inside ? [...S.hunters].filter(([id, h]) => h.account === s.accountId && game.ships.has(id)).map(([id]) => id) : [],
    ch: { at: r.ch.at, size: BLIGHT_QUESTS.length, cur: r.ch.cur && q ? taskView(q.s, r.ch.cur.step, r.ch.cur.n) : null, canClaim: !!r.ch.cur && !!q && r.ch.cur.step >= q.s.length && moored },
    contracts,
    shop: BLIGHT_SHOP.map((w) => ({ id: w.id, price: shopPrice(w.price, shop.n[w.id] ?? 0), owned: !!w.once && owned(p, w.id) })),
    bj: { hands: Math.max(0, BJ_HANDS_HOUR - lim.hands), silver: Math.max(0, BJ_SILVER_DAY - lim.lost) },
    week: weekView(game, s.accountId),
    weekTitle: hon ? WEEK_TITLES[hon.place][0] : null,
    dice: moored, davy: moored && (tod < 1.5 / 24 || tod > 23.5 / 24), tables: moored ? openTables(game, RAFT_TABLE) : [],
  };
}

// ================================================================================================ the admin's word

/** `/blight [go|clear|tier N|marks N|heart|week|veil wall|open|status]`. */
export function adminBlight(game: Game, s: PlayerSession, args: string[]): string {
  const p = s.profile!, ship = s.ship!;
  const r = rec(p);
  const n = Number(args[1]);
  switch ((args[0] ?? 'status').toLowerCase()) {
    case 'go': {
      // (the rim on the side of Wrecktide: just outside it, her bow to the middle)
      const a = Math.atan2(1, 0.6);
      ship.docked = null;
      p.docked = null;
      ship.state.x = BLIGHT.x + Math.cos(a) * (BLIGHT.r + 250);
      ship.state.y = BLIGHT.y + Math.sin(a) * (BLIGHT.r + 250);
      ship.state.heading = headingOf(BLIGHT.x - ship.state.x, BLIGHT.y - ship.state.y);
      ship.state.speed = 0;
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      return say('adminGo');
    }
    case 'clear':
      r.pass = true;
      return say('adminClear');
    case 'tier': {
      const t = Math.max(1, Math.min(99, Math.trunc(n) || 1));
      const before = tierNow(r);
      r.taint = (t - 1) * TAINT_PER_TIER;
      if (r.in) tierCheck(game, s, r, Math.min(before, t - 1));
      game.pushSelf(s, true);
      return say('adminTier', t);
    }
    case 'marks':
      r.marks = Math.max(0, r.marks + (Math.trunc(n) || 0));
      game.pushSelf(s, true);
      return say('adminMarks', r.marks);
    case 'heart':
      blightHeartRise(game);
      return say('adminHeart');
    case 'week':
      weekTurn(game, true);
      return say('adminWeek');
    case 'veil':
      if (args[1] === 'wall' || args[1] === 'open') setVeilWall(game, args[1] === 'wall');
      return say(veilWall(game) ? 'adminVeilWall' : 'adminVeilOpen');
    case 'status':
      return say('adminStatus', blightCleared(game, s) ? 1 : 0, r.in ? 1 : 0, tierNow(r), r.hold, r.marks, r.ch.at + 1);
    default:
      return say('adminHelp');
  }
}

/** The tests' hands on the zone's inner state. */
export const blightTest = {
  state: (game: Game) => st(game),
  rec: (p: Profile) => rec(p),
  weekTurn: (game: Game) => weekTurn(game, true),
  weekSyncNow: (game: Game, s: PlayerSession) => weekSync(game, s, rec(s.profile!), true),
};
