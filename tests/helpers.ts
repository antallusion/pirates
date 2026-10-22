// Test helpers: an in-memory game with fake connections that speak the real protocol.

import { SHIP_CLASS_IDS } from '../shared/src/data/ships.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';
import { LEVEL_RANGE } from '../shared/src/data/shiplevel.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { decodeSnap, SnapState } from '../shared/src/codec.ts';
import type { ClientMsg, ServerMsg } from '../shared/src/protocol.ts';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import { grantCaptain } from '../server/src/game/captainshop.ts';
import { CAPTAINS } from '../shared/src/data/captains.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { Database } from '../server/src/persistence/db.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { holidayAt } from '../shared/src/data/holidays.ts';
import { gapToShore } from '../shared/src/data/reach.ts';
import { isLand } from '../shared/src/world/worldgen.ts';

export class FakeConn {
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};
  closed = false;
  remote = 'test';
  bytesOut = 0;
  buffered = 0;
  inbox: ServerMsg[] = [];
  /** The snapshot codec's base, as the client keeps it (codec v7). */
  snapBase = new SnapState();
  send(text: string): void {
    const m = JSON.parse(text) as ServerMsg;
    if (m.t === 'init') this.snapBase.reset();
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
    this.inbox.push(decodeSnap(bytes, this.snapBase));
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
  // The zone bosses' calendar (docs/21) keeps still too: by the wall clock one of the eight is up two hours in three
  // (tests/zonebosses.test.ts turns it on).
  game.zoneBosses.on = false;
  // The Choir's invasions (docs/19 E16) wait for their own tests (tests/invasions.test.ts).
  game.invasions.on = false;
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
  const s = game.attach(conn as unknown as WsConnection);
  conn.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  // a premium captain is bought before she takes command (owner, 2026-10-19): the tests' captains are given hers
  if (CAPTAINS[captain].premium && s.authed) grantCaptain(game, s.accountId, captain);
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

/** Her ship at a ⚓ on a hull whose ladder reaches it, the profile's loadout with it (owner, 2026-10-16: a job is taken
 *  only by a ship of its band). */
export function shipAtLevel(game: Game, s: { ship: Parameters<typeof onHull>[1] | null; profile: { loadout: unknown } | null }, level: number): void {
  const cls = (Object.entries(LEVEL_RANGE) as [ShipClassId, [number, number]][]).find(([, r]) => r[0] <= level && r[1] >= level)![0];
  onHull(game, s.ship!, cls, level);
  s.profile!.loadout = s.ship!.loadout;
}

/** The yard's tree of hulls (docs/20) known whole: for the tests of the yard's other gates. */
export function knowHulls(p: { research?: { xp: Record<string, number>; free: number; done: string[] } }): void {
  p.research = { xp: {}, free: 0, done: [...SHIP_CLASS_IDS] };
}

/** «Свиток автобоя» (owner, 2026-10-11: «автобой в абордаже только специальной премиум свитками»): a test that fights a
 *  battle out by «Авто», or by a quick fight that is not the free one against a clearly weaker ship of the sea, gives
 *  the captain's account (by name; none named: every captain aboard) the scrolls a player would have bought. */
export function giveScrolls(game: Game, name?: string, n = 50): void {
  for (const s of game.sessions) if (s.authed && (!name || s.name === name)) game.db.addScrolls(s.accountId, n);
}

/** Her ship hove to off an island's coast, her beam to it, `gap` metres of water between her hull and the coast (owner,
 *  2026-10-22: every island's dealing is within thirty metres of the hull — shared/src/data/reach.ts). Out of the island's
 *  coves: a stretch where the coast lies about her as the reach measures it. True when such water was found. */
export function offCoast(game: Game, ship: { state: { x: number; y: number; heading: number; speed: number }; stats: { length: number; beam: number }; id: number; docked?: string | null }, is: { x: number; y: number; poly: ArrayLike<number> }, gap = 14): boolean {
  const n = is.poly.length / 2;
  // (the stretch of coast nearest where she lies first: the test's own side of the island)
  const order = [...Array(n).keys()].sort((a, b) => Math.hypot(is.poly[a * 2] - ship.state.x, is.poly[a * 2 + 1] - ship.state.y) - Math.hypot(is.poly[b * 2] - ship.state.x, is.poly[b * 2 + 1] - ship.state.y));
  for (const i of order) {
    const vx = is.poly[i * 2], vy = is.poly[i * 2 + 1];
    const dx = vx - is.x, dy = vy - is.y, l = Math.hypot(dx, dy) || 1;
    const nx = dx / l, ny = dy / l;
    const x = vx + nx * (gap + ship.stats.beam / 2 + 2), y = vy + ny * (gap + ship.stats.beam / 2 + 2);
    if (isLand(game.world, x, y)) continue;
    const heading = Math.atan2(-ny, -nx); // her keel along the coast
    const g = gapToShore({ x, y, heading, length: ship.stats.length, beam: ship.stats.beam }, is.poly);
    if (g < gap - 6 || g > gap + 6) continue;
    if ('docked' in ship) ship.docked = null;
    ship.state.x = x;
    ship.state.y = y;
    ship.state.heading = heading;
    ship.state.speed = 0;
    game.grid.upsert(ship.id, x, y);
    return true;
  }
  return false;
}
