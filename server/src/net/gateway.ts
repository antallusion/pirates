// The Gateway (docs/04 §1): takes the players' WebSockets, checks the protocol version, rate-limits, and
// routes each session to a world (zone) process over the internal link (net/link.ts). It remembers which
// world a captain sails in, so a reconnect lands in the same ocean; when a world restarts its players are
// told so and their clients reconnect on their own. Worlds can come and go without restarting the gateway.

import { createHash } from 'node:crypto';
import { request } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { connect } from 'node:net';
import type { Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { PROTOCOL_VERSION } from '../../../shared/src/constants.ts';
import { closePayload, F, frame, FrameReader, LINK_IDLE_MS, LINK_PING_MS, LINK_VERSION, readClose } from './link.ts';
import { clientIp } from './conn.ts';
import { acceptUpgrade } from './websocket.ts';
import type { WsConnection } from './websocket.ts';

export interface ZoneSpec {
  name: string;
  host: string;
  port: number;
  /** The world's HTTP address, for the routes the gateway passes through (accounts, health). */
  http?: string;
}

/** Close codes the client understands. */
export const CLOSE_OUTDATED = 4002; // do not reconnect: reload the page
export const CLOSE_RESTART = 1012; // the world is restarting: reconnect
export const CLOSE_TRY_LATER = 1013; // no world is up right now: reconnect

const HELLO_TIMEOUT_MS = 5000;
const SLOW_CLIENT_BYTES = 4 * 1024 * 1024;

class ClientSession {
  readonly id: number;
  readonly ws: WsConnection;
  readonly ip: string;
  zone: ZoneLink | null = null;
  tokens: number;
  lastRefill = Date.now();
  dropped = 0;
  timer: ReturnType<typeof setTimeout> | null = null;

  constructor(id: number, ws: WsConnection, ip: string, burst: number) {
    this.id = id;
    this.ws = ws;
    this.ip = ip;
    this.tokens = burst;
  }
}

/** The gateway's end of the link to one world. Reconnects with backoff while the world is away. */
export class ZoneLink {
  readonly spec: ZoneSpec;
  readonly sessions = new Map<number, ClientSession>();
  up = false;
  private socket: Socket | null = null;
  private reader = new FrameReader();
  private gw: Gateway;
  private backoff = 250;
  private lastIn = 0;
  private pinger: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(gw: Gateway, spec: ZoneSpec) {
    this.gw = gw;
    this.spec = spec;
  }

  start(): void {
    this.stopped = false;
    this.dial();
  }

  private dial(): void {
    if (this.stopped) return;
    this.reader = new FrameReader();
    const sock = connect(this.spec.port, this.spec.host);
    this.socket = sock;
    sock.setNoDelay(true);
    sock.on('connect', () => {
      this.lastIn = Date.now();
      sock.write(frame(F.HELLO, 0, JSON.stringify({ secret: this.gw.secret, v: LINK_VERSION })));
    });
    sock.on('data', (d: Buffer) => {
      this.lastIn = Date.now();
      try {
        this.reader.push(d, (t, id, p) => this.onFrame(t, id, p));
      } catch (e) {
        this.gw.log(`[gateway] ${this.spec.name}: ${(e as Error).message}`);
        sock.destroy();
      }
    });
    sock.on('error', () => {});
    sock.on('close', () => this.lost(sock));
    this.pinger ??= setInterval(() => {
      if (!this.up || !this.socket) return;
      if (Date.now() - this.lastIn > LINK_IDLE_MS) this.socket.destroy();
      else this.socket.write(frame(F.PING, 0));
    }, LINK_PING_MS);
  }

  private lost(sock: Socket): void {
    if (this.socket !== sock) return;
    const wasUp = this.up;
    this.up = false;
    this.socket = null;
    if (wasUp) this.gw.log(`[gateway] lost world ${this.spec.name}; reconnecting`);
    for (const s of [...this.sessions.values()]) this.gw.kick(s, CLOSE_RESTART, 'The world is restarting');
    if (this.stopped) return;
    this.retry = setTimeout(() => this.dial(), this.backoff);
    this.backoff = Math.min(5000, this.backoff * 2);
  }

  private onFrame(type: number, id: number, p: Buffer): void {
    if (type === F.READY) {
      this.up = true;
      this.backoff = 250;
      this.gw.log(`[gateway] linked to world ${this.spec.name} (${this.spec.host}:${this.spec.port})`);
      return;
    }
    if (!this.up) return;
    switch (type) {
      case F.TEXT: {
        const s = this.sessions.get(id);
        if (!s) return;
        const text = p.toString('utf8');
        if (text.startsWith('{"t":"welcome"')) this.gw.remember(text, this.spec.name);
        s.ws.send(text);
        return;
      }
      case F.BIN: {
        const s = this.sessions.get(id);
        if (!s) return;
        if (s.ws.buffered > SLOW_CLIENT_BYTES) return this.gw.kick(s, 1008, 'Too slow to keep up', true);
        s.ws.sendBinary(p);
        return;
      }
      case F.CLOSE: {
        const s = this.sessions.get(id);
        if (!s) return;
        const c = readClose(p);
        this.sessions.delete(id);
        s.zone = null;
        s.ws.close(c.code, c.reason);
        return;
      }
      case F.PING:
        this.socket?.write(frame(F.PONG, 0));
        return;
      default:
        return;
    }
  }

  write(b: Buffer): void {
    if (this.up) this.socket?.write(b);
  }

  stop(): void {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = null;
    this.socket?.destroy();
  }
}

export interface GatewayOpts {
  zones: ZoneSpec[];
  secret: string;
  log?: (s: string) => void;
  /** Concurrent sockets per address. */
  perIp?: number;
  /** Messages per second a player may send (sustained) and in a burst. */
  rate?: number;
  burst?: number;
}

export class Gateway {
  readonly zones: ZoneLink[];
  readonly secret: string;
  readonly log: (s: string) => void;
  private sessions = new Map<number, ClientSession>();
  private perIpCount = new Map<string, number>();
  /** Which world a captain sails in: SHA-256 of their token → zone name. */
  private route = new Map<string, { zone: string; at: number }>();
  private nextId = 1;
  private perIp: number;
  private rate: number;
  private burst: number;
  kicked = { flood: 0, outdated: 0, slow: 0, perIp: 0 };

  constructor(o: GatewayOpts) {
    if (!o.zones.length) throw new Error('the gateway needs at least one world');
    this.secret = o.secret;
    this.log = o.log ?? ((s) => console.log(s));
    this.perIp = o.perIp ?? 16;
    this.rate = o.rate ?? 60;
    this.burst = o.burst ?? 120;
    this.zones = o.zones.map((z) => new ZoneLink(this, z));
  }

  start(): void {
    for (const z of this.zones) z.start();
  }

  stop(): void {
    for (const s of [...this.sessions.values()]) this.kick(s, 1001, 'The gateway is shutting down');
    for (const z of this.zones) z.stop();
  }

  /** For the HTTP server's 'upgrade' event. */
  handleUpgrade(req: IncomingMessage, socket: Duplex): void {
    if (!req.url?.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    const ip = clientIp(req);
    if ((this.perIpCount.get(ip) ?? 0) >= this.perIp) {
      this.kicked.perIp++;
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }
    const ws = acceptUpgrade(req, socket);
    if (!ws) return;
    const s = new ClientSession(this.nextId++, ws, ip, this.burst);
    if (this.nextId > 0x7fffffff) this.nextId = 1;
    this.sessions.set(s.id, s);
    this.perIpCount.set(ip, (this.perIpCount.get(ip) ?? 0) + 1);
    s.timer = setTimeout(() => this.kick(s, 1008, 'Say hello first'), HELLO_TIMEOUT_MS);
    ws.onMessage = (text) => this.onClientMessage(s, text);
    ws.onClose = () => this.onClientClose(s);
  }

  private onClientMessage(s: ClientSession, text: string): void {
    // Token bucket: `rate` per second, `burst` at once; a client that keeps pushing past it is cut off.
    const now = Date.now();
    s.tokens = Math.min(this.burst, s.tokens + ((now - s.lastRefill) / 1000) * this.rate);
    s.lastRefill = now;
    if (s.tokens < 1) {
      if (++s.dropped > this.burst * 2) {
        this.kicked.flood++;
        this.kick(s, 1008, 'flood');
      }
      return;
    }
    s.tokens--;
    if (s.zone) {
      s.zone.write(frame(F.TEXT, s.id, text));
      return;
    }
    // The first message must be a hello in this protocol version.
    let hello: { t?: string; v?: number; token?: string } | null = null;
    try {
      hello = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    if (!hello || hello.t !== 'hello') return this.kick(s, 1008, 'Say hello first');
    if (hello.v !== PROTOCOL_VERSION) {
      this.kicked.outdated++;
      s.ws.send(JSON.stringify({ t: 'err', msg: `Client out of date (protocol ${hello.v}, server ${PROTOCOL_VERSION}). Reload the page.` }));
      return this.kick(s, CLOSE_OUTDATED, 'outdated');
    }
    const zone = this.pick(typeof hello.token === 'string' ? hello.token : null);
    if (!zone) {
      s.ws.send(JSON.stringify({ t: 'err', msg: 'The world is restarting — reconnecting…' }));
      return this.kick(s, CLOSE_TRY_LATER, 'no world');
    }
    if (s.timer) clearTimeout(s.timer);
    s.timer = null;
    s.zone = zone;
    zone.sessions.set(s.id, s);
    zone.write(frame(F.OPEN, s.id, s.ip));
    zone.write(frame(F.TEXT, s.id, text));
  }

  /** The captain's own world if we know it and it is up, else the least crowded one. */
  pick(token: string | null): ZoneLink | null {
    if (token) {
      const r = this.route.get(hashToken(token));
      const z = r && this.zones.find((z) => z.spec.name === r.zone && z.up);
      if (z) return z;
    }
    let best: ZoneLink | null = null;
    for (const z of this.zones) if (z.up && (!best || z.sessions.size < best.sessions.size)) best = z;
    return best;
  }

  /** Learns the route from a world's welcome (it carries the session token). */
  remember(welcomeJson: string, zone: string): void {
    try {
      const m = JSON.parse(welcomeJson) as { token?: string };
      if (typeof m.token !== 'string') return;
      const now = Date.now();
      this.route.set(hashToken(m.token), { zone, at: now });
      if (this.route.size > 200_000) for (const [k, v] of this.route) if (now - v.at > 30 * 86_400_000) this.route.delete(k);
    } catch {
      /* ignore */
    }
  }

  kick(s: ClientSession, code: number, reason: string, slow = false): void {
    if (slow) this.kicked.slow++;
    if (s.zone) {
      s.zone.write(frame(F.CLOSE, s.id, closePayload(code, reason)));
      s.zone.sessions.delete(s.id);
      s.zone = null;
    }
    s.ws.close(code, reason);
  }

  private onClientClose(s: ClientSession): void {
    if (!this.sessions.delete(s.id)) return;
    if (s.timer) clearTimeout(s.timer);
    const n = (this.perIpCount.get(s.ip) ?? 1) - 1;
    if (n > 0) this.perIpCount.set(s.ip, n);
    else this.perIpCount.delete(s.ip);
    if (s.zone) {
      s.zone.write(frame(F.CLOSE, s.id, closePayload(1001, 'gone')));
      s.zone.sessions.delete(s.id);
      s.zone = null;
    }
  }

  /** A world with an HTTP address, for the routes passed through. */
  httpTarget(): string | null {
    return (this.zones.find((z) => z.up && z.spec.http) ?? this.zones.find((z) => z.spec.http))?.spec.http ?? null;
  }

  stats() {
    return {
      sessions: this.sessions.size,
      routes: this.route.size,
      kicked: { ...this.kicked },
      zones: this.zones.map((z) => ({ name: z.spec.name, up: z.up, sessions: z.sessions.size })),
    };
  }
}

function hashToken(t: string): string {
  return createHash('sha256').update(t).digest('base64url');
}

/** "name=host:port@http://host:port,…" → zones (LINK_ZONES). */
export function parseZones(spec: string): ZoneSpec[] {
  return spec
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x, i) => {
      const m = /^(?:([\w-]+)=)?([^:@\s]+):(\d+)(?:@(\S+))?$/.exec(x);
      if (!m) throw new Error(`bad zone "${x}" (want name=host:port@http://host:port)`);
      return { name: m[1] ?? `world-${i + 1}`, host: m[2], port: Number(m[3]), http: m[4]?.replace(/\/$/, '') };
    });
}

/** Passes a request through to a world, with the player's address in X-Forwarded-For. */
export function passThrough(req: IncomingMessage, res: ServerResponse, target: string): void {
  const url = new URL(req.url ?? '/', target);
  const headers = { ...req.headers, host: url.host, 'x-forwarded-for': clientIp(req) };
  const up = request(url, { method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.setTimeout(15_000, () => up.destroy(new Error('timeout')));
  up.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'The world is not answering. Try again in a moment.' }));
  });
  req.pipe(up);
}
