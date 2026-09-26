// The internal link between the Gateway and a world (zone) process: one TCP connection per gateway carries
// every player session it routes there. Frames: [u32 length][u8 type][u32 session id][payload].
//   HELLO  gateway → world  {secret, v}         READY  world → gateway  {zone, v}
//   OPEN   gateway → world  player address      CLOSE  either way       u16 code + reason
//   TEXT / BIN              a game message      PING / PONG             keep-alive (id 0)
// A link must present the shared secret first; a silent link is dropped after 15 s.

import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:net';
import type { AddressInfo, Server, Socket } from 'node:net';
import type { GameConn } from './conn.ts';

export const F = { HELLO: 1, READY: 2, OPEN: 3, CLOSE: 4, TEXT: 5, BIN: 6, PING: 7, PONG: 8 } as const;

export const LINK_VERSION = 1;
const MAX_FRAME = 8 * 1024 * 1024;
export const LINK_IDLE_MS = 15_000;
export const LINK_PING_MS = 5_000;

export function frame(type: number, id: number, payload: Uint8Array | string = ''): Buffer {
  const body = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  const head = Buffer.allocUnsafe(9);
  head.writeUInt32BE(body.length + 5, 0);
  head[4] = type;
  head.writeUInt32BE(id >>> 0, 5);
  return Buffer.concat([head, body]);
}

export function closePayload(code: number, reason: string): Buffer {
  const r = Buffer.from(reason.slice(0, 120), 'utf8');
  const p = Buffer.allocUnsafe(2 + r.length);
  p.writeUInt16BE(code, 0);
  r.copy(p, 2);
  return p;
}

export function readClose(p: Buffer): { code: number; reason: string } {
  return p.length >= 2 ? { code: p.readUInt16BE(0), reason: p.subarray(2).toString('utf8') } : { code: 1000, reason: '' };
}

/** Cuts a byte stream into frames. Throws on a frame too large to be honest. */
export class FrameReader {
  private buf: Buffer = Buffer.alloc(0);

  push(chunk: Buffer, on: (type: number, id: number, payload: Buffer) => void): void {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32BE(0);
      if (len < 5 || len > MAX_FRAME) throw new Error(`bad link frame (${len} bytes)`);
      if (this.buf.length < 4 + len) return;
      const type = this.buf[4];
      const id = this.buf.readUInt32BE(5);
      const payload = this.buf.subarray(9, 4 + len);
      this.buf = this.buf.subarray(4 + len);
      on(type, id, payload);
    }
  }
}

export function secretsMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

// ------------------------------------------------------------------------------------------ world side

/** A player session that lives on the Gateway; the world talks to it through the link. */
export class RemoteConnection implements GameConn {
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};
  readonly remote: string;
  closed = false;
  readonly id: number;
  private peer: LinkPeer;

  constructor(peer: LinkPeer, id: number, remote: string) {
    this.peer = peer;
    this.id = id;
    this.remote = remote;
  }

  send(text: string): void {
    if (!this.closed) this.peer.write(frame(F.TEXT, this.id, text));
  }

  sendBinary(bytes: Uint8Array): void {
    if (!this.closed) this.peer.write(frame(F.BIN, this.id, bytes));
  }

  close(code = 1000, reason = ''): void {
    if (this.closed) return;
    this.peer.write(frame(F.CLOSE, this.id, closePayload(code, reason)));
    this.finish();
  }

  /** The player is gone (their socket closed, or the link fell). */
  finish(): void {
    if (this.closed) return;
    this.closed = true;
    this.peer.conns.delete(this.id);
    this.onClose();
  }
}

/** One gateway connected to this world. */
class LinkPeer {
  readonly conns = new Map<number, RemoteConnection>();
  private socket: Socket;
  private server: LinkServer;
  private reader = new FrameReader();
  private authed = false;
  private lastIn = Date.now();
  private timer: ReturnType<typeof setInterval>;
  gone = false;

  constructor(server: LinkServer, socket: Socket) {
    this.server = server;
    this.socket = socket;
    socket.setNoDelay(true);
    socket.on('data', (d: Buffer) => {
      this.lastIn = Date.now();
      try {
        this.reader.push(d, (t, id, p) => this.onFrame(t, id, p));
      } catch (e) {
        this.server.log(`[link] ${(e as Error).message}; dropping the gateway`);
        this.drop();
      }
    });
    socket.on('close', () => this.drop());
    socket.on('error', () => this.drop());
    this.timer = setInterval(() => {
      if (Date.now() - this.lastIn > (this.authed ? LINK_IDLE_MS : 5000)) this.drop();
      else if (this.authed) this.write(frame(F.PING, 0));
    }, this.server.pingMs);
  }

  write(b: Buffer): void {
    if (!this.gone) this.socket.write(b);
  }

  private onFrame(type: number, id: number, p: Buffer): void {
    if (!this.authed) {
      if (type !== F.HELLO) return this.drop();
      let hello: { secret?: string; v?: number };
      try {
        hello = JSON.parse(p.toString('utf8'));
      } catch {
        return this.drop();
      }
      if (typeof hello.secret !== 'string' || !secretsMatch(hello.secret, this.server.secret) || hello.v !== LINK_VERSION) {
        this.server.log('[link] a gateway was refused (wrong secret or version)');
        return this.drop();
      }
      this.authed = true;
      this.write(frame(F.READY, 0, JSON.stringify({ zone: this.server.zone, v: LINK_VERSION })));
      return;
    }
    switch (type) {
      case F.OPEN: {
        if (this.conns.has(id)) return;
        const c = new RemoteConnection(this, id, p.toString('utf8').slice(0, 80) || '?');
        this.conns.set(id, c);
        this.server.attach(c);
        return;
      }
      case F.TEXT:
        this.conns.get(id)?.onMessage(p.toString('utf8'));
        return;
      case F.CLOSE:
        this.conns.get(id)?.finish();
        return;
      case F.PING:
        this.write(frame(F.PONG, 0));
        return;
      default:
        return; // PONG, BIN from a gateway: nothing to do
    }
  }

  drop(): void {
    if (this.gone) return;
    this.gone = true;
    clearInterval(this.timer);
    this.socket.destroy();
    for (const c of [...this.conns.values()]) c.finish();
    this.server.peers.delete(this);
  }
}

export interface LinkServerOpts {
  secret: string;
  zone: string;
  /** Hands each relayed session to the world (Game.attach). */
  attach: (c: GameConn) => void;
  log?: (s: string) => void;
  pingMs?: number;
}

/** Listens for gateways. */
export class LinkServer {
  readonly peers = new Set<LinkPeer>();
  readonly secret: string;
  readonly zone: string;
  readonly attach: (c: GameConn) => void;
  readonly log: (s: string) => void;
  readonly pingMs: number;
  private server: Server;

  constructor(o: LinkServerOpts) {
    if (!o.secret || o.secret.length < 16) throw new Error('LINK_SECRET must be at least 16 characters');
    this.secret = o.secret;
    this.zone = o.zone;
    this.attach = o.attach;
    this.log = o.log ?? ((s) => console.log(s));
    this.pingMs = o.pingMs ?? LINK_PING_MS;
    this.server = createServer((sock) => this.peers.add(new LinkPeer(this, sock)));
  }

  listen(port: number, host = '127.0.0.1'): Promise<number> {
    return new Promise((res, rej) => {
      this.server.once('error', rej);
      this.server.listen(port, host, () => res((this.server.address() as AddressInfo).port));
    });
  }

  get sessions(): number {
    let n = 0;
    for (const p of this.peers) n += p.conns.size;
    return n;
  }

  close(): Promise<void> {
    for (const p of [...this.peers]) p.drop();
    return new Promise((r) => this.server.close(() => r()));
  }
}
