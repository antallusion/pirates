// A small PostgreSQL client on the frontend/backend wire protocol v3 (no dependencies): startup, cleartext / MD5 /
// SCRAM-SHA-256 authentication, and the extended query protocol with text parameters. Queries run one at a time
// in order on a single connection — enough for a write-behind persistence layer.

import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { connect } from 'node:net';
import type { Socket } from 'node:net';

export interface PgResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

interface Pending {
  sql: string;
  params: unknown[];
  resolve: (r: PgResult) => void;
  reject: (e: Error) => void;
}

const INT_TYPES = new Set([20, 21, 23, 26]); // int8, int2, int4, oid
const FLOAT_TYPES = new Set([700, 701, 1700]); // float4, float8, numeric
const BOOL = 16;
const JSON_TYPES = new Set([114, 3802]);

export class PgClient {
  private sock!: Socket;
  private buf = Buffer.alloc(0);
  private queue: Pending[] = [];
  private busy: Pending | null = null;
  private fields: { name: string; type: number }[] = [];
  private rows: Record<string, unknown>[] = [];
  private rowCount = 0;
  private error: Error | null = null;
  private onReady: (() => void) | null = null;
  private onAuthError: ((e: Error) => void) | null = null;
  private scram: { nonce: string; clientFirstBare: string; password: string } | null = null;
  private user = '';
  private password = '';
  closed = false;

  static async connect(url: string): Promise<PgClient> {
    const c = new PgClient();
    await c.open(url);
    return c;
  }

  private open(url: string): Promise<void> {
    const u = new URL(url);
    this.user = decodeURIComponent(u.username);
    this.password = decodeURIComponent(u.password);
    const database = decodeURIComponent(u.pathname.replace(/^\//, '')) || this.user;
    return new Promise((resolve, reject) => {
      this.onReady = resolve;
      this.onAuthError = reject;
      this.sock = connect({ host: u.hostname, port: Number(u.port || 5432) });
      this.sock.on('connect', () => {
        const params = Buffer.from(`user\0${this.user}\0database\0${database}\0client_encoding\0UTF8\0\0`);
        const head = Buffer.alloc(8);
        head.writeInt32BE(8 + params.length, 0);
        head.writeInt32BE(196608, 4); // protocol 3.0
        this.sock.write(Buffer.concat([head, params]));
      });
      this.sock.on('data', (d) => this.onData(d as Buffer));
      this.sock.on('error', (e) => this.fail(e));
      this.sock.on('close', () => {
        this.closed = true;
        this.fail(new Error('PostgreSQL connection closed'));
      });
    });
  }

  private fail(e: Error): void {
    if (this.onAuthError) {
      this.onAuthError(e);
      this.onAuthError = null;
    }
    if (this.busy) {
      this.busy.reject(e);
      this.busy = null;
    }
    for (const q of this.queue) q.reject(e);
    this.queue = [];
  }

  /** Run a statement with $1.. parameters (sent as text; objects as JSON). */
  query(sql: string, params: unknown[] = []): Promise<PgResult> {
    if (this.closed) return Promise.reject(new Error('PostgreSQL connection closed'));
    return new Promise((resolve, reject) => {
      this.queue.push({ sql, params, resolve, reject });
      this.pump();
    });
  }

  async end(): Promise<void> {
    if (this.closed) return;
    await new Promise<void>((resolve) => {
      const drain = () => (this.busy || this.queue.length ? setTimeout(drain, 5) : resolve());
      drain();
    });
    this.sock.end(msg('X', Buffer.alloc(0)));
    this.closed = true;
  }

  private pump(): void {
    if (this.busy || !this.queue.length || this.onReady) return;
    const q = (this.busy = this.queue.shift()!);
    this.fields = [];
    this.rows = [];
    this.rowCount = 0;
    this.error = null;
    const parse = msg('P', Buffer.concat([cstr(''), cstr(q.sql), int16(0)]));
    const vals = q.params.map((v) => (v === null || v === undefined ? null : Buffer.from(typeof v === 'object' ? JSON.stringify(v) : String(v))));
    const bindParts: Buffer[] = [cstr(''), cstr(''), int16(0), int16(vals.length)];
    for (const v of vals) {
      if (v === null) bindParts.push(int32(-1));
      else bindParts.push(int32(v.length), v);
    }
    bindParts.push(int16(0));
    const bind = msg('B', Buffer.concat(bindParts));
    const describe = msg('D', Buffer.concat([Buffer.from('P'), cstr('')]));
    const execute = msg('E', Buffer.concat([cstr(''), int32(0)]));
    const sync = msg('S', Buffer.alloc(0));
    this.sock.write(Buffer.concat([parse, bind, describe, execute, sync]));
  }

  private onData(d: Buffer): void {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 5) {
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < 1 + len) return;
      const type = String.fromCharCode(this.buf[0]);
      const body = this.buf.subarray(5, 1 + len);
      this.buf = this.buf.subarray(1 + len);
      this.handle(type, body);
    }
  }

  private handle(type: string, body: Buffer): void {
    switch (type) {
      case 'R':
        return this.auth(body);
      case 'Z': // ReadyForQuery
        if (this.onReady) {
          const r = this.onReady;
          this.onReady = null;
          this.onAuthError = null;
          r();
        } else if (this.busy) {
          const q = this.busy;
          this.busy = null;
          if (this.error) q.reject(this.error);
          else q.resolve({ rows: this.rows, rowCount: this.rowCount });
        }
        return this.pump();
      case 'T': { // RowDescription
        const n = body.readInt16BE(0);
        let o = 2;
        this.fields = [];
        for (let i = 0; i < n; i++) {
          const end = body.indexOf(0, o);
          const name = body.toString('utf8', o, end);
          o = end + 1;
          const typeOid = body.readInt32BE(o + 6);
          o += 18;
          this.fields.push({ name, type: typeOid });
        }
        return;
      }
      case 'D': { // DataRow
        const n = body.readInt16BE(0);
        let o = 2;
        const row: Record<string, unknown> = {};
        for (let i = 0; i < n; i++) {
          const len = body.readInt32BE(o);
          o += 4;
          const f = this.fields[i];
          if (len < 0) {
            row[f.name] = null;
            continue;
          }
          const text = body.toString('utf8', o, o + len);
          o += len;
          row[f.name] = INT_TYPES.has(f.type) || FLOAT_TYPES.has(f.type) ? Number(text) : f.type === BOOL ? text === 't' : JSON_TYPES.has(f.type) ? JSON.parse(text) : text;
        }
        this.rows.push(row);
        return;
      }
      case 'C': { // CommandComplete
        const tag = body.toString('utf8', 0, body.length - 1);
        const n = Number(tag.split(' ').pop());
        this.rowCount = Number.isFinite(n) ? n : this.rows.length;
        return;
      }
      case 'E': { // ErrorResponse
        const e = new Error(errorText(body));
        if (this.onAuthError) {
          this.onAuthError(e);
          this.onAuthError = null;
          this.onReady = null;
          this.sock.destroy();
          return;
        }
        this.error = e;
        return;
      }
      default:
        return; // ParameterStatus, BackendKeyData, NoticeResponse, ParseComplete, BindComplete, NoData…
    }
  }

  private auth(body: Buffer): void {
    const kind = body.readInt32BE(0);
    if (kind === 0) return; // AuthenticationOk
    if (kind === 3) {
      this.sock.write(msg('p', cstr(this.password)));
      return;
    }
    if (kind === 5) {
      const salt = body.subarray(4, 8);
      const inner = createHash('md5').update(this.password + this.user).digest('hex');
      const outer = createHash('md5').update(Buffer.concat([Buffer.from(inner), salt])).digest('hex');
      this.sock.write(msg('p', cstr('md5' + outer)));
      return;
    }
    if (kind === 10) { // SASL: pick SCRAM-SHA-256
      const nonce = randomBytes(18).toString('base64');
      const clientFirstBare = `n=,r=${nonce}`;
      this.scram = { nonce, clientFirstBare, password: this.password };
      const first = Buffer.from(`n,,${clientFirstBare}`);
      this.sock.write(msg('p', Buffer.concat([cstr('SCRAM-SHA-256'), int32(first.length), first])));
      return;
    }
    if (kind === 11) { // SASLContinue
      const s = this.scram!;
      const serverFirst = body.toString('utf8', 4);
      const attrs = Object.fromEntries(serverFirst.split(',').map((kv) => [kv[0], kv.slice(2)]));
      if (!attrs.r?.startsWith(s.nonce)) return this.fail(new Error('SCRAM: bad server nonce'));
      const salted = pbkdf2Sync(s.password.normalize('NFKC'), Buffer.from(attrs.s, 'base64'), Number(attrs.i), 32, 'sha256');
      const clientKey = createHmac('sha256', salted).update('Client Key').digest();
      const storedKey = createHash('sha256').update(clientKey).digest();
      const finalNoProof = `c=biws,r=${attrs.r}`;
      const authMessage = `${s.clientFirstBare},${serverFirst},${finalNoProof}`;
      const sig = createHmac('sha256', storedKey).update(authMessage).digest();
      const proof = Buffer.alloc(clientKey.length);
      for (let i = 0; i < proof.length; i++) proof[i] = clientKey[i] ^ sig[i];
      this.sock.write(msg('p', Buffer.from(`${finalNoProof},p=${proof.toString('base64')}`)));
      return;
    }
    if (kind === 12) return; // SASLFinal (server signature; the TLS-less channel is trusted as configured)
    this.fail(new Error(`PostgreSQL auth method ${kind} not supported`));
  }
}

function msg(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(5);
  head.write(type, 0, 'ascii');
  head.writeInt32BE(4 + body.length, 1);
  return Buffer.concat([head, body]);
}

function cstr(s: string): Buffer {
  return Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
}

function int16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeInt16BE(n, 0);
  return b;
}

function int32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n, 0);
  return b;
}

function errorText(body: Buffer): string {
  const parts: Record<string, string> = {};
  let o = 0;
  while (o < body.length && body[o] !== 0) {
    const code = String.fromCharCode(body[o]);
    const end = body.indexOf(0, o + 1);
    parts[code] = body.toString('utf8', o + 1, end);
    o = end + 1;
  }
  return `${parts.S ?? 'ERROR'} ${parts.C ?? ''}: ${parts.M ?? 'unknown error'}`;
}
