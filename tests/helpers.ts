// Test helpers: an in-memory game with fake connections that speak the real protocol.

import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { decodeSnap } from '../shared/src/codec.ts';
import type { ClientMsg, ServerMsg } from '../shared/src/protocol.ts';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { Database } from '../server/src/persistence/db.ts';

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
  return { game, db };
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
