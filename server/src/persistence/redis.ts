// A small Redis client on RESP2 (no dependencies): commands with pipelined replies, and a subscriber mode.
// GRAVETIDE uses Redis for what several processes must share: who is online, the chat bus between gateways and
// world servers, and the leaderboards (docs/04).

import { connect } from 'node:net';
import type { Socket } from 'node:net';

export type RedisReply = string | number | null | RedisReply[];

export class RedisClient {
  private sock!: Socket;
  private buf = Buffer.alloc(0);
  private waiting: { resolve: (r: RedisReply) => void; reject: (e: Error) => void }[] = [];
  private onMessage: ((channel: string, message: string) => void) | null = null;
  closed = false;

  static async connect(url: string): Promise<RedisClient> {
    const c = new RedisClient();
    const u = new URL(url);
    await new Promise<void>((resolve, reject) => {
      c.sock = connect({ host: u.hostname, port: Number(u.port || 6379) }, resolve);
      c.sock.once('error', reject);
    });
    c.sock.on('data', (d) => c.onData(d as Buffer));
    c.sock.on('error', (e) => c.failAll(e));
    c.sock.on('close', () => {
      c.closed = true;
      c.failAll(new Error('Redis connection closed'));
    });
    if (u.password) await c.command(...(u.username ? ['AUTH', decodeURIComponent(u.username), decodeURIComponent(u.password)] : ['AUTH', decodeURIComponent(u.password)]));
    const db = u.pathname.replace(/^\//, '');
    if (db) await c.command('SELECT', db);
    return c;
  }

  command(...args: (string | number)[]): Promise<RedisReply> {
    if (this.closed) return Promise.reject(new Error('Redis connection closed'));
    const parts = [`*${args.length}\r\n`];
    for (const a of args) {
      const s = String(a);
      parts.push(`$${Buffer.byteLength(s)}\r\n${s}\r\n`);
    }
    return new Promise((resolve, reject) => {
      this.waiting.push({ resolve, reject });
      this.sock.write(parts.join(''));
    });
  }

  /** Switch this connection to subscriber mode. */
  async subscribe(channel: string, onMessage: (channel: string, message: string) => void): Promise<void> {
    this.onMessage = onMessage;
    await this.command('SUBSCRIBE', channel);
  }

  async quit(): Promise<void> {
    if (this.closed) return;
    try {
      if (!this.onMessage) await this.command('QUIT');
    } catch {
      // closing anyway
    }
    this.sock.destroy();
    this.closed = true;
  }

  private failAll(e: Error): void {
    for (const w of this.waiting) w.reject(e);
    this.waiting = [];
  }

  private onData(d: Buffer): void {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      const r = parse(this.buf, 0);
      if (!r) return;
      this.buf = this.buf.subarray(r.end);
      const v = r.value;
      // Pushed pub/sub messages: ["message", channel, payload]
      if (this.onMessage && Array.isArray(v) && v[0] === 'message') {
        this.onMessage(String(v[1]), String(v[2]));
        continue;
      }
      const w = this.waiting.shift();
      if (!w) continue;
      if (v instanceof Error) w.reject(v);
      else w.resolve(v as RedisReply);
    }
  }
}

function parse(buf: Buffer, at: number): { value: RedisReply | Error; end: number } | null {
  if (at >= buf.length) return null;
  const nl = buf.indexOf('\r\n', at);
  if (nl < 0) return null;
  const type = String.fromCharCode(buf[at]);
  const line = buf.toString('utf8', at + 1, nl);
  const next = nl + 2;
  switch (type) {
    case '+':
      return { value: line, end: next };
    case '-':
      return { value: new Error(line), end: next };
    case ':':
      return { value: Number(line), end: next };
    case '$': {
      const len = Number(line);
      if (len < 0) return { value: null, end: next };
      if (buf.length < next + len + 2) return null;
      return { value: buf.toString('utf8', next, next + len), end: next + len + 2 };
    }
    case '*': {
      const n = Number(line);
      if (n < 0) return { value: null, end: next };
      const out: RedisReply[] = [];
      let o = next;
      for (let i = 0; i < n; i++) {
        const r = parse(buf, o);
        if (!r) return null;
        out.push(r.value instanceof Error ? r.value.message : r.value);
        o = r.end;
      }
      return { value: out, end: o };
    }
    default:
      return { value: new Error(`Unknown RESP type ${type}`), end: buf.length };
  }
}

/** Shared state across processes: presence, the chat bus, leaderboards. All best-effort: the game never waits. */
export class SharedState {
  private cmd: RedisClient;
  private sub: RedisClient;
  readonly origin: string;
  private onChat: (from: string, text: string) => void = () => {};
  onlineCount = 0;

  private constructor(cmd: RedisClient, sub: RedisClient, origin: string) {
    this.cmd = cmd;
    this.sub = sub;
    this.origin = origin;
  }

  static async open(url: string, origin: string): Promise<SharedState> {
    const cmd = await RedisClient.connect(url);
    const sub = await RedisClient.connect(url);
    const st = new SharedState(cmd, sub, origin);
    await sub.subscribe('gt:chat', (_ch, raw) => {
      try {
        const m = JSON.parse(raw) as { origin: string; from: string; text: string };
        if (m.origin !== origin) st.onChat(m.from, m.text);
      } catch {
        // ignore malformed messages
      }
    });
    return st;
  }

  /** Chat from other processes arrives here. */
  listenChat(fn: (from: string, text: string) => void): void {
    this.onChat = fn;
  }

  publishChat(from: string, text: string): void {
    void this.cmd.command('PUBLISH', 'gt:chat', JSON.stringify({ origin: this.origin, from, text })).catch(() => {});
  }

  /** Heartbeat for the captains sailing in this process; prunes the silent. */
  heartbeat(online: { id: number; name: string }[]): void {
    const now = Date.now();
    const args: (string | number)[] = ['ZADD', 'gt:online'];
    for (const o of online) args.push(now, `${o.id}:${o.name}`);
    const run = async () => {
      if (online.length) await this.cmd.command(...args);
      await this.cmd.command('ZREMRANGEBYSCORE', 'gt:online', 0, now - 30_000);
      this.onlineCount = Number(await this.cmd.command('ZCARD', 'gt:online'));
    };
    void run().catch(() => {});
  }

  leave(id: number, name: string): void {
    void this.cmd.command('ZREM', 'gt:online', `${id}:${name}`).catch(() => {});
  }

  /** Leaderboards: sorted sets by stat. */
  bump(board: string, id: number, name: string, by: number): void {
    void this.cmd.command('ZINCRBY', `gt:board:${board}`, by, `${id}:${name}`).catch(() => {});
  }

  async top(board: string, n = 10): Promise<{ name: string; score: number }[]> {
    const r = (await this.cmd.command('ZREVRANGE', `gt:board:${board}`, 0, n - 1, 'WITHSCORES')) as string[];
    const out: { name: string; score: number }[] = [];
    for (let i = 0; i < r.length; i += 2) out.push({ name: r[i].split(':').slice(1).join(':'), score: Number(r[i + 1]) });
    return out;
  }

  async close(): Promise<void> {
    await this.sub.quit();
    await this.cmd.quit();
  }
}
