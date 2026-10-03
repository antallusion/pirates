// Test helpers: an in-memory game with fake connections that speak the real protocol.

import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { decodeSnap } from '../shared/src/codec.ts';
import type { ClientMsg, ServerMsg } from '../shared/src/protocol.ts';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { Database } from '../server/src/persistence/db.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { holidayAt } from '../shared/src/data/holidays.ts';

export class FakeConn {
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};
  closed = false;
  remote = 'test';
  bytesOut = 0;
  buffered = 0;
  inbox: ServerMsg[] = [];
  send(text: string): void {
    const m = JSON.parse(text) as ServerMsg;
    // Like the client: a patch is merged into the private state it holds.
    if (m.t === 'self_patch') {
      const base = this.last('self')?.self ?? this.last('init')?.self;
      if (base) this.inbox.push({ t: 'self', self: { ...base, ...m.patch } });
      return;
    }
    this.inbox.push(m);
  }
  sendBinary(bytes: Uint8Array): void {
    this.bytesOut += bytes.byteLength;
    this.inbox.push(decodeSnap(bytes));
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onClose();
  }
  /** Client → server. */
  push(m: ClientMsg): void {
    this.onMessage(JSON.stringify(m));
  }
  last<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }> | undefined {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (this.inbox[i].t === t) return this.inbox[i] as Extract<ServerMsg, { t: T }>;
    return undefined;
  }
  all<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }>[] {
    return this.inbox.filter((m) => m.t === t) as Extract<ServerMsg, { t: T }>[];
  }
}

export function makeGame(): { game: Game; db: Database } {
  const db = new Database(':memory:');
  const game = new Game({ db, auth: new AuthService(db), log: () => {} });
  // The sea director keeps still in tests of other systems (its own tests start it: tests/director.test.ts).
  game.directorOn = false;
  // The older rules' tests fight the round-by-round deck fight; tests/tactical-boarding.test.ts turns the hexes on.
  game.tacticalBoarding = false;
  // The adventure map's guards stay out of the water in tests of other systems (tests/heroes4.test.ts wakes them).
  quietAdv(game);
  return { game, db };
}

/** The game's wall clock moved off the weekend: every Saturday and Sunday is one of the sea's holidays (pet fairs,
 *  holiday chapters, the tournaments), so a test of the weekday's rules keeps to a weekday whatever day it runs on —
 *  the coming Monday, the clock still running. */
export function onWeekday(game: Game): void {
  const h = holidayAt(Date.now());
  const shift = h ? h.end - Date.now() + 3_600_000 : 0;
  game.wallNow = () => Date.now() + shift;
}

export function join(game: Game, name: string, captain: 'corsair' | 'reaver' | 'smuggler' | 'navigator' | 'drowned' | 'admiral' = 'corsair'): FakeConn {
  const conn = new FakeConn();
  game.attach(conn as unknown as WsConnection);
  conn.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  conn.push({ t: 'create_captain', captain, shipName: 'Test Wake' });
  return conn;
}

export function steps(game: Game, n: number): void {
  for (let i = 0; i < n; i++) game.step();
}

/**
 * Puts a captain's ship on another hull at a level (canon D12: the ladder of levels weighs on every blow, so tests
 * of other rules fight dummies on even terms).
 */
export function onHull(game: Game, ship: { loadout: { classId: string; level?: number }; recompute(now: number): void; hull: number; sails: number; stats: { hullMax: number; sailHpMax: number } }, classId: string, level?: number): void {
  ship.loadout.classId = classId;
  ship.loadout.level = level;
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.sails = ship.stats.sailHpMax;
}
