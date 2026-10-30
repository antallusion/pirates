// «Переход» between hub ports (owner, 2026-10-30, after Нефигугум's post 22 in forum topic 7: «несколько ключевых
// портов … с функцией ПЕРЕХОД, как телепорты … кораблик выплывает из точки отправления и на скорости летит к точке
// прибытия, за какое-то расстояние сбрасывает скорость … кулдаун 30–60 минут … за серебро, но не люто дорого»).
//
// The rules (server-authoritative; tests/ferry.test.ts):
//  - only from a hub port she lies in (shared/src/data/ferry.ts FERRY_HUBS) to another hub;
//  - the price by the straight distance (ferryPrice: 30 + 2.5 a km, to 5, at most 200), paid when the trip begins;
//  - one trip per captain in FERRY_COOLDOWN_SEC (1 h, the wall clock, kept in her save: profile.ferryAt);
//  - refused in a fight (her party ashore, her group's boarding), with a boarding's spoils waiting, in a mutiny, wanted
//    at ★FERRY_WANTED_MAX or more (the hunters keep their prey), and whatever keeps her in port (a refit at the yard);
//    an overloaded hold sails as ever;
//  - the trip: she casts off (Game.undock), the helmsman takes the course to the other hub's anchorage and the passage
//    (passage.ts) begins at once — ×10, untouchable and unable to act — even with VOYAGE.on off; it ends VOYAGE_TAIL
//    short, her own way back, the helmsman brings her in and she puts in by herself («Причалить» given for her);
//  - only to a hub she has DISCOVERED (Нефигугум, post 24, topic 7: «не активными переходы в порты которые еще закрыты
//    … под туманом»): put in there once, or its water out of her fog of war (fog.ts) — the others greyed on her
//    screens, refused here.

import { FERRY_COOLDOWN_SEC, FERRY_HOLD_MAX, FERRY_HUBS, FERRY_WANTED_MAX, ferryPrice, isFerryHub } from '../../../shared/src/data/ferry.ts';
import { wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FerryView } from '../../../shared/src/protocol.ts';
import { autosailOf, startAutosail, stopAutosail } from './autosail.ts';
import type { Game } from './Game.ts';
import { SELF_IN_BATTLE_WHY, inBattle } from './inbattle.ts';
import { beginFerry, voyaging } from './passage.ts';
import type { PlayerSession } from './player.ts';
import { refitHolds } from './refit.ts';
import { fogSeen } from '../../../shared/src/data/fog.ts';
import { fogState } from './fog.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { ShipEntity } from './ship.ts';

/** The words she is told (client/src/lang/server.ru.passage.ts). */
export const FERRY_WORDS = {
  notHub: 'Passages leave only from a hub port.',
  badTo: 'No passage to that port.',
  wanted: 'The ferry masters will not carry a wanted captain.',
  mutiny: 'Settle the mutiny first.',
  laden: 'No passage with the hold more than 60% full: sell or store the cargo first.',
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

/** Why she may not take a passage now (beyond the silver and the route), or null. */
function blocked(game: Game, s: PlayerSession, ship: ShipEntity): string | null {
  const p = s.profile!;
  const left = ferryLeft(game, s);
  if (left > 0) return cooldownWords(left);
  if (inBattle(game, ship) || ship.underFire(game.now)) return SELF_IN_BATTLE_WHY;
  if (s.pendingBoarding) return SELF_IN_BATTLE_WHY;
  if (p.company?.mutiny) return FERRY_WORDS.mutiny;
  if (wantedLevel(p.infamy) >= FERRY_WANTED_MAX) return FERRY_WORDS.wanted;
  const st = ship.stats;
  if (st.holdVolume > 0 && cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul) > st.holdVolume * FERRY_HOLD_MAX + 1e-9) return FERRY_WORDS.laden;
  return refitHolds(game, p);
}

/** A hub's «Переход» for her screens (the harbour window, the port card); null in any other port. */
export function ferryView(game: Game, s: PlayerSession, portId: string): FerryView | null {
  if (!isFerryHub(portId) || !game.portById(portId)) return null;
  const routes: FerryView['routes'] = [];
  for (const to of FERRY_HUBS) {
    if (to === portId) continue;
    const d = hubDistance(game, portId, to);
    if (d === null) continue;
    routes.push({ to, km: Math.round(d / 100) / 10, price: ferryPrice(d), ...(portKnown(game, s, to) ? {} : { locked: true }) });
  }
  routes.sort((a, b) => Number(!!a.locked) - Number(!!b.locked) || a.km - b.km);
  const ship = s.ship;
  return { routes, left: ferryLeft(game, s), why: ship && ship.docked === portId ? blocked(game, s, ship) : null };
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
  const price = ferryCost(game, from, to);
  const dest = game.portById(to);
  if (price === null || !dest) return FERRY_WORDS.badTo;
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
  game.pushSelf(s, true);
  return null;
}

/** Each tick: a trip whose passage is over is brought in — «Причалить» given for her once she is by the hub. */
export function stepFerry(game: Game): void {
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
