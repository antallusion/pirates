// Castaways (seaux, owner 2026-10-11: «в море должны быть сгенерированы плавающие матросы, проплывая мимо них их можно на
// борт поднимать, это решит вопрос нехватки постоянной людей на корабле»). shared/src/data/wrecks.ts has the numbers.
//
// Men clinging to a spar turn up for a captain under way — hers only, ahead of her course, on open water — every few
// minutes, sooner when her crew is thin; none while her berths are full. Passing within CAST_PICK of one hauls him
// aboard (no button; one tap on him sails her there); they sign on as deckhands, never past her crew's room, and no
// more than CAST_HOURLY men an hour come from the sea: enough to ease a short crew, not to stand for the tavern.

import { CAST_AT, CAST_HOURLY, CAST_MEN, CAST_PICK, CAST_TTL, castWait } from '../../../shared/src/data/wrecks.ts';
import type { CastawayView } from '../../../shared/src/data/wrecks.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { reconcile } from './crew.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { openSea } from './wrecks.ts';
import { questEvent } from './quests.ts';

export interface Castaway {
  id: number;
  owner: number;
  x: number;
  y: number;
  n: number;
  until: number;
}

interface CS {
  rng: Rng;
  seq: number;
  list: Map<number, Castaway>;
  /** Each captain's own (by account): what she is looked at against, never the whole sea's. */
  mine: Map<number, Map<number, Castaway>>;
  /** When the next one is due for a captain (sea seconds). */
  next: Map<number, number>;
  /** The men hauled aboard this hour (from when the hour began). */
  hour: Map<number, { start: number; men: number }>;
  /** Where she was last looked at, and what she was last sent. */
  last: Map<number, { x: number; y: number; sent: string }>;
}

const states = new WeakMap<Game, CS>();

function C(game: Game): CS {
  let c = states.get(game);
  if (!c) states.set(game, (c = { rng: new Rng(0xca57a7a1), seq: 1, list: new Map(), mine: new Map(), next: new Map(), hour: new Map(), last: new Map() }));
  return c;
}

/** Tests: the dice. */
export function setCastRng(game: Game, rng: Rng): void {
  C(game).rng = rng;
}

export const castawaysOf = (game: Game, s: PlayerSession): Castaway[] => [...(C(game).mine.get(s.accountId)?.values() ?? [])];

function drop(S: CS, c: Castaway): void {
  S.list.delete(c.id);
  const m = S.mine.get(c.owner);
  m?.delete(c.id);
  if (m && !m.size) S.mine.delete(c.owner);
}

/** Men she may still take from the sea this hour. */
export function castRoomHour(game: Game, s: PlayerSession): number {
  const h = C(game).hour.get(s.accountId);
  if (!h || game.now - h.start >= 3600) return CAST_HOURLY;
  return Math.max(0, CAST_HOURLY - h.men);
}

/** One put on the water ahead of her (null: no open water there). */
export function putCastaway(game: Game, s: PlayerSession, at?: { x: number; y: number }, n?: number): Castaway | null {
  const S = C(game);
  const ship = s.ship!;
  let spot = at ?? null;
  for (let k = 0; k < 10 && !spot; k++) {
    const v = headingVec(ship.state.heading + S.rng.range(-0.7, 0.7));
    const far = S.rng.range(CAST_AT[0], CAST_AT[1]);
    const x = ship.state.x + v.x * far, y = ship.state.y + v.y * far;
    if (openSea(game, x, y)) spot = { x, y };
  }
  if (!spot) return null;
  const c: Castaway = { id: S.seq++, owner: s.accountId, x: Math.round(spot.x), y: Math.round(spot.y), n: n ?? S.rng.int(CAST_MEN[0], CAST_MEN[1]), until: game.now + CAST_TTL };
  S.list.set(c.id, c);
  let m = S.mine.get(c.owner);
  if (!m) S.mine.set(c.owner, (m = new Map()));
  m.set(c.id, c);
  sendCastaways(game, s, true);
  return c;
}

/** He is hauled aboard: deckhands, as many as her berths take (the rest given water and a course home). */
export function haulCastaway(game: Game, s: PlayerSession, c: Castaway): number {
  const S = C(game);
  const ship = s.ship!, p = s.profile!;
  drop(S, c);
  const room = Math.max(0, ship.stats.crewMax - ship.crew);
  const k = Math.min(c.n, room, castRoomHour(game, s));
  if (k > 0) {
    reconcile(game, p.company, ship.crew);
    ship.addMen('deckhand', k);
    p.company.pools.sailor += k;
    ship.companyKey = '';
    p.rescued = (p.rescued ?? 0) + k;
    const h = S.hour.get(s.accountId);
    if (!h || game.now - h.start >= 3600) S.hour.set(s.accountId, { start: game.now, men: k });
    else h.men += k;
    game.toastShip(ship, k === 1 ? 'A castaway hauled aboard off a spar: he signs on as a deckhand.' : `${k} castaways hauled aboard off a spar: they sign on as deckhands.`, 'good');
    game.pushSelf(s, true);
  } else {
    ship.morale = Math.min(100, ship.morale + 1);
    game.toastShip(ship, 'No hammocks for the castaways: you give them water and a course for the nearest port.', 'info');
  }
  questEvent(game, s, { k: 'rescue', n: Math.max(1, c.n) }); // docs/36: souls saved from the sea (the quests' «rescue»)
  sendCastaways(game, s, true);
  return k;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2)) : 0;
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

/** Every second: those she passed hauled aboard, the sea's own taken, the next one put out for each captain under way. */
export function stepCastaways(game: Game): void {
  const S = C(game);
  const now = game.now;
  for (const c of S.list.values()) {
    if (now < c.until && game.sessionByAccount(c.owner)?.ship) continue;
    drop(S, c);
    const o = game.sessionByAccount(c.owner);
    if (o) sendCastaways(game, o);
  }
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !s.profile || s.disconnectedAt !== null) continue;
    const last = S.last.get(s.accountId) ?? { x: ship.state.x, y: ship.state.y, sent: '' };
    if (Math.hypot(ship.state.x - last.x, ship.state.y - last.y) > 250) [last.x, last.y] = [ship.state.x, ship.state.y];
    const atSea = ship.alive && !ship.docked && !ship.ghost && !ship.boarding;
    if (atSea) {
      const reach = Math.max(CAST_PICK, ship.stats.length / 2 + 30);
      for (const c of castawaysOf(game, s)) if (segDist(c.x, c.y, last.x, last.y, ship.state.x, ship.state.y) <= reach) haulCastaway(game, s, c);
    }
    last.x = ship.state.x;
    last.y = ship.state.y;
    S.last.set(s.accountId, last);
    if (!game.directorOn || !atSea) continue;
    // Under way, out of a fight, with a berth free and the hour's men not all come: the next one when due.
    const room = ship.stats.crewMax - ship.crew;
    const full = ship.crew / Math.max(1, ship.stats.crewMax);
    const due = S.next.get(s.accountId);
    if (due === undefined) {
      S.next.set(s.accountId, now + castWait(full, S.rng.float()));
      continue;
    }
    if (now < due) continue;
    if (room <= 0 || castRoomHour(game, s) <= 0 || ship.state.speed < 1.5 || ship.inCombat(now) || castawaysOf(game, s).length >= 2) {
      S.next.set(s.accountId, now + 30);
      continue;
    }
    S.next.set(s.accountId, now + castWait(full, S.rng.float()));
    putCastaway(game, s);
  }
}

/** Her castaways to her client, when they changed. */
export function sendCastaways(game: Game, s: PlayerSession, force = false): void {
  const S = C(game);
  const list: CastawayView[] = castawaysOf(game, s).map((c) => ({ id: c.id, x: c.x, y: c.y, n: c.n, left: Math.max(0, Math.round(c.until - game.now)) }));
  const key = list.map((c) => c.id).join(',');
  const last = S.last.get(s.accountId);
  if (!force && last && last.sent === key) return;
  if (last) last.sent = key;
  else S.last.set(s.accountId, { x: s.ship?.state.x ?? 0, y: s.ship?.state.y ?? 0, sent: key });
  game.sendTo(s, { t: 'castaways', list });
}
