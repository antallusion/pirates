// The Regatta of Equal Waters (docs/12 P10 #5). Each three-hour slot lays a course of six buoys off one of four ports;
// captains sign up at that port's harbour; at the start those within two kilometres of the start buoy race, every ship
// lent the same handling and none may fire; round the buoys in order and back to the first. The course keeps its five
// best times; the first three win silver, the first two a pennant colour, the winner a title.

import { unlockDeed } from './looks.ts';
import { BUOY_R, PRIZES, REGATTA_BUOYS, REGATTA_EVERY_MS, REGATTA_LIMIT_S, REGATTA_PORTS, REGATTA_SIGNUP_MS, REGATTA_START_R } from '../../../shared/src/data/regatta.ts';
import type { RegattaView } from '../../../shared/src/protocol.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { sagaNote } from './saga.ts';

interface Entrant {
  account: number;
  name: string;
  /** The buoy she sails for next (0: the finish, once round). */
  next: number;
  passed: number;
  finished: number | null;
  out: boolean;
}

interface Race {
  slot: number;
  port: string;
  buoys: [number, number][];
  phase: 'signup' | 'running' | 'done';
  startWall: number;
  startGame: number;
  entrants: Map<number, Entrant>;
  warned: boolean;
  winner: string | null;
}

interface RegattaState {
  race: Race | null;
  courses: Map<string, [number, number][]>;
}

const states = new WeakMap<Game, RegattaState>();
function rs(game: Game): RegattaState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { race: null, courses: new Map() }));
  return s;
}

/** A port's course: six buoys on a ring of open water offshore (the same on every boot of the world). */
export function courseOf(game: Game, portId: string): [number, number][] {
  const S = rs(game);
  const hit = S.courses.get(portId);
  if (hit) return hit;
  const port = game.portById(portId);
  let buoys: [number, number][] = [];
  if (port) {
    const R = 1500;
    outer: for (let d = 2500; d <= 7000; d += 500) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const cx = port.x + Math.sin(a) * d, cy = port.y - Math.cos(a) * d;
        let water = true;
        for (let j = 0; j < 36 && water; j++) {
          const b = (j / 36) * Math.PI * 2;
          for (const r of [R - 250, R, R + 250]) if (isLand(game.world, cx + Math.sin(b) * r, cy - Math.cos(b) * r)) water = false;
        }
        if (!water) continue;
        // The start buoy on the port's side of the ring, the rest round it.
        const a0 = Math.atan2(port.x - cx, -(port.y - cy));
        buoys = Array.from({ length: REGATTA_BUOYS }, (_, i) => {
          const b = a0 + (i / REGATTA_BUOYS) * Math.PI * 2;
          return [Math.round(cx + Math.sin(b) * R), Math.round(cy - Math.cos(b) * R)] as [number, number];
        });
        break outer;
      }
    }
  }
  S.courses.set(portId, buoys);
  return buoys;
}

function newRace(game: Game, slot: number, startWall: number, portId?: string): Race {
  const port = portId ?? REGATTA_PORTS[((slot % REGATTA_PORTS.length) + REGATTA_PORTS.length) % REGATTA_PORTS.length];
  return { slot, port, buoys: courseOf(game, port), phase: 'signup', startWall, startGame: 0, entrants: new Map(), warned: false, winner: null };
}

/** The race of now: the slot's (made on first asking). */
function current(game: Game): Race {
  const S = rs(game);
  const wall = game.wallNow();
  const slot = Math.floor(wall / REGATTA_EVERY_MS);
  if (!S.race || (S.race.slot !== slot && S.race.phase !== 'running' && S.race.slot >= 0)) S.race = newRace(game, slot, slot * REGATTA_EVERY_MS + REGATTA_SIGNUP_MS);
  return S.race;
}

/** A race off a port starting at once (the tests and the admin). */
export function regattaNow(game: Game, portId: string, delayMs = 0): void {
  rs(game).race = newRace(game, -1, game.wallNow() + delayMs, portId);
}

export function regattaSignUp(game: Game, s: PlayerSession): string | null {
  const r = current(game);
  const port = game.portById(r.port);
  if (r.phase !== 'signup') return 'The sign-up is closed: the regatta is under way.';
  if (s.ship?.docked !== r.port) return `Sign-up is at the harbour of ${port?.name ?? r.port}.`;
  if (r.entrants.has(s.accountId)) return 'You are signed up already.';
  r.entrants.set(s.accountId, { account: s.accountId, name: s.name, next: 1, passed: 0, finished: null, out: false });
  game.sendTo(s, { t: 'toast', msg: `You are signed up for the regatta off ${port?.name ?? r.port}. Be within two kilometres of the start buoy when it begins.`, kind: 'good' });
  sendRegatta(game, s);
  return null;
}

function leave(game: Game, s: PlayerSession | null | undefined, e: Entrant, why: string): void {
  e.out = true;
  if (!s) return;
  s.ship?.addEffect({ id: 'regatta', until: 0, mods: {} }, game.now);
  s.ship?.recompute(game.now);
  game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60), ss = Math.floor(sec % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

/** Every second: the countdown, the start, the buoys, the finish, the end. */
export function stepRegatta(game: Game): void {
  const r = current(game);
  const wall = game.wallNow();
  const port = game.portById(r.port);
  if (r.phase === 'signup') {
    if (!r.warned && wall >= r.startWall - 60_000) {
      r.warned = true;
      for (const e of r.entrants.values()) {
        const s = game.sessionByAccount(e.account);
        if (s) game.sendTo(s, { t: 'toast', msg: `The regatta off ${port?.name ?? r.port} starts in a minute: to the start buoy!`, kind: 'info' });
      }
    }
    if (wall < r.startWall) return;
    r.phase = 'running';
    r.startGame = game.now;
    const [bx, by] = r.buoys[0] ?? [0, 0];
    for (const e of r.entrants.values()) {
      const s = game.sessionByAccount(e.account);
      const ship = s?.ship;
      if (!s || !ship || ship.docked || !ship.alive || Math.hypot(ship.state.x - bx, ship.state.y - by) > REGATTA_START_R) {
        e.out = true;
        if (s) game.sendTo(s, { t: 'toast', msg: 'You are not at the start: the regatta goes without you.', kind: 'bad' });
        continue;
      }
      // Equal waters: the same handling for all, and no guns.
      ship.addEffect({ id: 'regatta', until: game.now + REGATTA_LIMIT_S, mods: {}, flags: ['regatta_equal'] }, game.now);
      game.sendTo(s, { t: 'toast', msg: 'The regatta starts! Every ship sails the same now: sail and wind decide.', kind: 'gold' });
    }
  }
  if (r.phase === 'running') {
    let racing = 0;
    for (const e of r.entrants.values()) {
      if (e.out || e.finished !== null) continue;
      const s = game.sessionByAccount(e.account);
      const ship = s?.ship;
      if (!s || !ship || ship.docked || !ship.alive || !ship.hasEffect('regatta')) {
        leave(game, s, e, 'You left the race.');
        continue;
      }
      racing++;
      const [x, y] = r.buoys[e.next];
      if (Math.hypot(ship.state.x - x, ship.state.y - y) > BUOY_R) continue;
      e.passed++;
      if (e.next === 0) {
        // Round and home: her time, her place, her prize.
        e.finished = game.now - r.startGame;
        const place = [...r.entrants.values()].filter((o) => o.finished !== null).length;
        finish(game, s, r, e, place);
        racing--;
      } else {
        game.sendTo(s, { t: 'toast', msg: `Buoy ${e.passed} of ${REGATTA_BUOYS}.`, kind: 'good' });
        e.next = (e.next + 1) % REGATTA_BUOYS;
      }
    }
    if (racing <= 0 || game.now - r.startGame > REGATTA_LIMIT_S) {
      r.phase = 'done';
      for (const e of r.entrants.values()) {
        const s = game.sessionByAccount(e.account);
        if (!e.out && e.finished === null) leave(game, s, e, 'The regatta’s time is up: you did not finish.');
        if (s && e.finished !== null) {
          s.ship?.addEffect({ id: 'regatta', until: 0, mods: {} }, game.now);
          s.ship?.recompute(game.now);
        }
      }
      if (r.winner) for (const o of game.sessions) if (r.entrants.has(o.accountId) || o.ship?.docked === r.port) game.sendTo(o, { t: 'toast', msg: `The regatta off ${port?.name ?? r.port} is over. First: ${r.winner}.`, kind: 'info' });
    }
  }
  if (Math.floor(game.now) % 2 === 0) for (const e of r.entrants.values()) {
    const s = game.sessionByAccount(e.account);
    if (s) sendRegatta(game, s);
  }
}

function finish(game: Game, s: PlayerSession, r: Race, e: Entrant, place: number): void {
  const p = s.profile!;
  const time = fmtTime(e.finished!);
  game.sendTo(s, { t: 'toast', msg: `You finish ${place}: ${time}.`, kind: 'gold' });
  if (place === 1) r.winner = s.name;
  const prize = PRIZES[place - 1];
  if (prize) {
    p.gold += prize.silver;
    game.db.ledger(s.accountId, 'regatta', prize.silver, r.port);
    game.sendTo(s, { t: 'toast', msg: `Prize: ${prize.silver} silver.`, kind: 'gold' });
    if (prize.pennant && !p.pennants.includes(prize.pennant)) {
      p.pennants.push(prize.pennant);
      game.sendTo(s, { t: 'toast', msg: 'A new pennant colour: the regatta’s.', kind: 'gold' });
    }
    if (prize.title && !p.titles.includes(prize.title)) p.titles.push(prize.title);
    if (place === 1) sagaNote(game, s, 'regatta', [game.portById(r.port)?.name ?? r.port]);
  }
  game.grantXp(s, 400 - Math.min(300, (place - 1) * 50), 'Regatta', true);
  if (place <= 3) unlockDeed(game, s, 'regatta'); // the regatta's sails and colours (docs/12 P10 #12)
  // The course's records.
  const recs = game.db.getKv<Record<string, { name: string; sec: number }[]>>('regatta_records') ?? {};
  const list = recs[r.port] ?? [];
  const best = list[0]?.sec ?? Infinity;
  list.push({ name: s.name, sec: Math.round(e.finished! * 10) / 10 });
  recs[r.port] = list.sort((a, b) => a.sec - b.sec).slice(0, 5);
  game.db.setKv('regatta_records', recs);
  if (e.finished! < best) game.sendTo(s, { t: 'toast', msg: `A course record: ${time}!`, kind: 'gold' });
  s.ship?.addEffect({ id: 'regatta', until: 0, mods: {} }, game.now);
  s.ship?.recompute(game.now);
}

/** A racer may not fire, nor be fired on (equal waters). */
export function regattaBlocked(a: { hasEffect(id: string): boolean }, b: { hasEffect(id: string): boolean }): boolean {
  return a.hasEffect('regatta') || b.hasEffect('regatta');
}

export function regattaView(game: Game, s: PlayerSession): RegattaView {
  const r = current(game);
  const e = r.entrants.get(s.accountId);
  const recs = game.db.getKv<Record<string, { name: string; sec: number }[]>>('regatta_records') ?? {};
  return {
    port: r.port, phase: r.phase, startsIn: Math.max(0, Math.round((r.startWall - game.wallNow()) / 1000)), signedUp: !!e,
    buoys: r.buoys, next: e && !e.out && e.finished === null && r.phase === 'running' ? e.next : null, passed: e?.passed ?? 0,
    time: r.phase === 'running' && e && e.finished === null ? Math.round(game.now - r.startGame) : e?.finished ?? null,
    entrants: r.entrants.size, records: recs[r.port] ?? [],
  };
}

export function sendRegatta(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'regatta', view: regattaView(game, s) });
}
