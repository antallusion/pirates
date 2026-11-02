// «Переход» between hub ports (owner, 2026-10-30, after Нефигугум's post 22 in forum topic 7: «несколько ключевых
// портов … с функцией ПЕРЕХОД, как телепорты … кораблик выплывает из точки отправления и на скорости летит к точке
// прибытия, за какое-то расстояние сбрасывает скорость … кулдаун 30–60 минут … за серебро, но не люто дорого»).
//
// The rules (server-authoritative; tests/ferry.test.ts):
//  - only from a hub port she lies in (shared/src/data/ferry.ts FERRY_HUBS) to another hub;
//  - the price by the straight distance (ferryPrice: ≈800 the nearest pair … 15 000 across the sea), paid when the trip
//    begins; under the pirate flag ×2, to the hub nearest an active quest's goal ×0.25 (post 49, 2026-11-02);
//  - one trip per captain in FERRY_COOLDOWN_SEC (30 min, the wall clock, kept in her save: profile.ferryAt);
//  - refused in a fight (her party ashore, her group's boarding), with a boarding's spoils waiting, in a mutiny, with any
//    skull on her (post 49: «с черепами переход не возьмёт — сначала отмойтесь»), with her TRADE cargo over
//    FERRY_HOLD_MAX of the hold (the ship's stores never count), and whatever keeps her in port (a refit at the yard);
//  - «Тихая гавань» (post 49): within HAVEN_R of every hub no captain attacks another (havenBlocked: combat.ts
//    damageBlocked and the rams), and a captain who came by ferry keeps that peace HAVEN_WARD_SEC after leaving it;
//  - the trip: she casts off (Game.undock), the helmsman takes the course to the other hub's anchorage and the passage
//    (passage.ts) begins at once — ×10, untouchable and unable to act — even with VOYAGE.on off; it ends VOYAGE_TAIL
//    short, her own way back, the helmsman brings her in and she puts in by herself («Причалить» given for her);
//  - only to a hub she has DISCOVERED (Нефигугум, post 24, topic 7: «не активными переходы в порты которые еще закрыты
//    … под туманом»): put in there once, or its water out of her fog of war (fog.ts) — the others greyed on her
//    screens, refused here.

import { FERRY_COOLDOWN_SEC, FERRY_HOLD_MAX, FERRY_HUBS, FERRY_SKULLS_MAX, HAVEN_R, HAVEN_WARD_FX, HAVEN_WARD_SEC, ferryPrice, ferryPriceFor, isFerryHub } from '../../../shared/src/data/ferry.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import { coloursOf } from './colours.ts';
import { captainBehind, skullsOf } from './flaglaw.ts';
import type { FerryView } from '../../../shared/src/protocol.ts';
import { autosailOf, startAutosail, stopAutosail } from './autosail.ts';
import type { Game } from './Game.ts';
import { SELF_IN_BATTLE_WHY, inBattle } from './inbattle.ts';
import { beginFerry, voyaging } from './passage.ts';
import type { PlayerSession } from './player.ts';
import { refitHolds } from './refit.ts';
import { fogSeen } from '../../../shared/src/data/fog.ts';
import { fogState } from './fog.ts';
import { tradeVolume } from '../../../shared/src/sim/shipstats.ts';
import type { ShipEntity } from './ship.ts';

/** The words she is told (client/src/lang/server.ru.passage.ts). */
export const FERRY_WORDS = {
  notHub: 'Passages leave only from a hub port.',
  badTo: 'No passage to that port.',
  wanted: 'The ferry masters will not carry a wanted captain.',
  skulls: 'With skulls on you the ferry will not take you: wash them off first.',
  mutiny: 'Settle the mutiny first.',
  laden: 'No passage with trade goods filling more than 60% of the hold (the ship’s stores do not count): sell or store the cargo first.',
  noWay: 'No open water leads there now: the passage is off, nothing paid.',
  unknown: 'Discover that port first.',
} as const;

/** «The next passage in N min» (translated with its number on the client). */
export function cooldownWords(sec: number): string {
  return `The next passage in ${Math.max(1, Math.ceil(sec / 60))} min.`;
}

/** Seconds of her cooldown left. */
export function ferryLeft(game: Game, s: PlayerSession): number {
  const at = s.profile?.ferryAt;
  if (!at) return 0;
  return Math.max(0, Math.ceil(FERRY_COOLDOWN_SEC - (game.wallNow() - at) / 1000));
}

/** Whether she knows a port: she has put in there, or its water is out of her fog of war. */
export function portKnown(game: Game, s: PlayerSession, portId: string): boolean {
  const p = s.profile, port = game.portById(portId);
  if (!p || !port) return false;
  if (p.lastPort === portId || p.regionsSeen?.includes(`visited:${portId}`)) return true;
  return fogSeen(fogState(game, s).bits, port.x, port.y);
}

/** The straight distance between two hubs, metres. */
function hubDistance(game: Game, from: string, to: string): number | null {
  const a = game.portById(from), b = game.portById(to);
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
}

/** The price from one hub to another (null: not a route). */
export function ferryCost(game: Game, from: string, to: string): number | null {
  if (!isFerryHub(from) || !isFerryHub(to) || from === to) return null;
  const d = hubDistance(game, from, to);
  return d === null ? null : ferryPrice(d);
}

/** Where her active quests send her now: each one's step's port, island or water (a hunt in the open sea: none). */
function questGoals(game: Game, s: PlayerSession): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const qs of s.profile?.quests.active ?? []) {
    const st = QUESTS_BY_ID[qs.id]?.steps[qs.step];
    if (!st) continue;
    const port = 'port' in st && typeof st.port === 'string' ? game.portById(st.port) : null;
    const isle = 'island' in st && typeof st.island === 'number' && st.island >= 0 ? game.world.islands[st.island] : null;
    if (port) out.push({ x: port.x, y: port.y });
    else if (isle) out.push({ x: isle.x, y: isle.y });
    else if ('near' in st && st.near) out.push({ x: st.near.x, y: st.near.y });
  }
  return out;
}

/** The hub nearest a point. */
export function nearestHub(game: Game, x: number, y: number): string | null {
  let best: string | null = null, bd = Infinity;
  for (const id of FERRY_HUBS) {
    const p = game.portById(id);
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

/** The hubs nearest the goals of her active quests: a passage to one is «за задание», a quarter of the price. */
export function questHubs(game: Game, s: PlayerSession): Set<string> {
  const out = new Set<string>();
  for (const g of questGoals(game, s)) {
    const h = nearestHub(game, g.x, g.y);
    if (h) out.add(h);
  }
  return out;
}

/** Her price from one hub to another: the base, her flag's and her quest's (null: not a route). */
export function ferryQuote(game: Game, s: PlayerSession, from: string, to: string, hubs = questHubs(game, s)): { price: number; base: number; quest: boolean; pirate: boolean } | null {
  const base = ferryCost(game, from, to);
  if (base === null) return null;
  const pirate = coloursOf(s.profile) === 'pirate';
  const quest = hubs.has(to);
  return { price: ferryPriceFor(base, { pirate, quest }), base, quest, pirate };
}

/** Why she may not take a passage now (beyond the silver and the route), or null. */
function blocked(game: Game, s: PlayerSession, ship: ShipEntity): string | null {
  const p = s.profile!;
  const left = ferryLeft(game, s);
  if (left > 0) return cooldownWords(left);
  if (inBattle(game, ship) || ship.underFire(game.now)) return SELF_IN_BATTLE_WHY;
  if (s.pendingBoarding) return SELF_IN_BATTLE_WHY;
  if (p.company?.mutiny) return FERRY_WORDS.mutiny;
  if (skullsOf(p) >= FERRY_SKULLS_MAX) return FERRY_WORDS.skulls;
  const st = ship.stats;
  if (st.holdVolume > 0 && tradeVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul) > st.holdVolume * FERRY_HOLD_MAX + 1e-9) return FERRY_WORDS.laden;
  return refitHolds(game, p);
}

/** A hub's «Переход» for her screens (the harbour window, the port card); null in any other port. */
export function ferryView(game: Game, s: PlayerSession, portId: string): FerryView | null {
  if (!isFerryHub(portId) || !game.portById(portId)) return null;
  const routes: FerryView['routes'] = [];
  const hubs = questHubs(game, s);
  const pirate = coloursOf(s.profile) === 'pirate';
  for (const to of FERRY_HUBS) {
    if (to === portId) continue;
    const d = hubDistance(game, portId, to);
    if (d === null) continue;
    const base = ferryPrice(d), quest = hubs.has(to);
    routes.push({ to, km: Math.round(d / 100) / 10, price: ferryPriceFor(base, { pirate, quest }), base, ...(quest ? { quest: true } : {}), ...(portKnown(game, s, to) ? {} : { locked: true }) });
  }
  routes.sort((a, b) => Number(!!a.locked) - Number(!!b.locked) || a.km - b.km);
  const ship = s.ship;
  return { routes, left: ferryLeft(game, s), why: ship && ship.docked === portId ? blocked(game, s, ship) : null, ...(pirate ? { pirate: true } : {}) };
}

/** Her trips under way to their hub, to put her in on arrival. */
const bound = new WeakMap<Game, Map<PlayerSession, { to: string; until: number }>>();
function book(game: Game): Map<PlayerSession, { to: string; until: number }> {
  let m = bound.get(game);
  if (!m) bound.set(game, (m = new Map()));
  return m;
}

/** The destination of her trip (tests). */
export function ferryBound(game: Game, s: PlayerSession): string | null {
  return book(game).get(s)?.to ?? null;
}

/** «Переход»: from the hub she lies in to another. Null, or why not. */
export function ferryGo(game: Game, s: PlayerSession, to: string): string | null {
  const ship = s.ship, p = s.profile;
  if (!ship || !p) return 'No ship';
  const from = ship.docked;
  if (!from || !isFerryHub(from)) return FERRY_WORDS.notHub;
  to = String(to ?? '');
  const quote = ferryQuote(game, s, from, to);
  const dest = game.portById(to);
  if (quote === null || !dest) return FERRY_WORDS.badTo;
  const price = quote.price;
  if (!portKnown(game, s, to)) return FERRY_WORDS.unknown;
  const why = blocked(game, s, ship);
  if (why) return why;
  if (p.gold < price) return `The passage costs ${price} silver.`;
  const out = game.undock(s);
  if (out) return out;
  // the course to the other hub's anchorage, then the passage at once from the harbour mouth
  const e = startAutosail(game, s, dest.x, dest.y, 4);
  const run = autosailOf(ship);
  const fail = e ?? (run ? beginFerry(game, s, ship, [run.end?.[0] ?? run.x, run.end?.[1] ?? run.y], to) : 'no run');
  if (fail) {
    if (run) stopAutosail(game, s, 'manual');
    game.log(`[ferry] ${s.name} ${from}→${to} refused at the mouth: ${fail}`);
    return FERRY_WORDS.noWay;
  }
  p.gold -= price;
  p.ferryAt = game.wallNow();
  game.db.ledger(s.accountId, 'ferry', -price, `${from}>${to}`);
  book(game).set(s, { to, until: game.now + 1800 });
  armWard(game, ship); // «Тихая гавань»: her peace from the passage until HAVEN_WARD_SEC after she leaves the hub's ring
  game.pushSelf(s, true);
  return null;
}

/** Each tick: a trip whose passage is over is brought in — «Причалить» given for her once she is by the hub. */
export function stepFerry(game: Game): void {
  stepWards(game);
  const m = bound.get(game);
  if (!m?.size) return;
  for (const [s, t] of m) {
    const ship = s.ship;
    if (!ship || !ship.alive || ship.docked || !game.sessions.has(s) || game.now > t.until) {
      m.delete(s);
      continue;
    }
    if (voyaging(ship)) continue;
    const port = game.portById(t.to);
    if (!port) {
      m.delete(s);
      continue;
    }
    const d = Math.hypot(port.x - ship.state.x, port.y - ship.state.y);
    // (the helmsman's last stretch at her own way: in once she is by the quays, or his run is over)
    if (d > 380 && autosailOf(ship)) continue;
    m.delete(s);
    if (s.disconnectedAt !== null) continue;
    game.redo(s, { t: 'dock' });
  }
}

// ------------------------------------------------------------------ «Тихая гавань» (post 49, 2026-11-02)

/** Words for a blow refused in the quiet water (client/src/lang/server.ru.passage.ts). */
export const HAVEN_SAY = 'Quiet harbour: no captain attacks another by a ferry hub.';

/** The hubs' places (cached a game). */
const hubPlaces = new WeakMap<Game, { x: number; y: number }[]>();
function hubsOf(game: Game): { x: number; y: number }[] {
  let h = hubPlaces.get(game);
  if (!h) {
    h = [];
    for (const id of FERRY_HUBS) {
      const p = game.portById(id);
      if (p) h.push({ x: p.x, y: p.y });
    }
    hubPlaces.set(game, h);
  }
  return h;
}

/** Whether a point is in a hub's quiet water (within HAVEN_R of it). */
export function inHaven(game: Game, x: number, y: number): boolean {
  for (const h of hubsOf(game)) if (Math.hypot(h.x - x, h.y - y) <= HAVEN_R) return true;
  return false;
}

/** The captains who came by ferry and keep the hub's peace for now. */
const wards = new WeakMap<Game, Set<ShipEntity>>();

/** Her ship keeps the hub's peace (she came by ferry): the ward's effect on her, its clock full. */
function armWard(game: Game, ship: ShipEntity): void {
  let w = wards.get(game);
  if (!w) wards.set(game, (w = new Set()));
  w.add(ship);
  setWard(game, ship);
}

function setWard(game: Game, ship: ShipEntity): void {
  const until = game.now + HAVEN_WARD_SEC;
  const e = ship.effects.find((x) => x.id === HAVEN_WARD_FX);
  if (e) e.until = until; // (no numbers on it: no recompute)
  else ship.addEffect({ id: HAVEN_WARD_FX, until }, game.now);
}

/** Whether her ferry ward is on now. */
export function warded(game: Game, ship: ShipEntity | null | undefined): boolean {
  return !!ship && ship.effects.some((e) => e.id === HAVEN_WARD_FX && e.until > game.now);
}

/** Once a second: a warded captain's clock stands full while she lies in port, is on her passage or in the quiet water,
 *  and runs out HAVEN_WARD_SEC after she leaves it — then she is the sea's again. */
const lastWardStep = new WeakMap<Game, number>();
function stepWards(game: Game): void {
  const set = wards.get(game);
  if (!set?.size) return;
  const t = Math.floor(game.now);
  if (lastWardStep.get(game) === t) return;
  lastWardStep.set(game, t);
  for (const ship of set) {
    if (!ship.alive || game.ships.get(ship.id) !== ship) {
      set.delete(ship);
      continue;
    }
    if (ship.docked || voyaging(ship) || inHaven(game, ship.state.x, ship.state.y)) setWard(game, ship);
    else if (!warded(game, ship)) set.delete(ship);
  }
}

/** Why the quiet water keeps `a` off `b` (two captains' ships, or theirs: escorts, prizes, guards), or null: either in a
 *  hub's ring, or either captain under her ferry ward. The sea's own ships (pirates, beasts, patrols) are as ever. */
export function havenBlocked(game: Game, a: ShipEntity, b: ShipEntity): string | null {
  const ca = captainBehind(game, a), cb = captainBehind(game, b);
  if (!ca || !cb || ca === cb) return null;
  if (ca.accountId !== null && ca.accountId === cb.accountId) return null;
  if (inHaven(game, a.state.x, a.state.y) || inHaven(game, b.state.x, b.state.y)) return HAVEN_SAY;
  if (warded(game, ca) || warded(game, cb)) return HAVEN_SAY;
  return null;
}
