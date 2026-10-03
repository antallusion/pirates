// PostgreSQL persistence (docs/04: the durable store for accounts, captains, world state and the economy ledger).
// The world simulation must never wait on a database: this layer loads what the game reads at startup, answers
// reads from memory, and writes behind — every change is queued and flushed in order, a batch per transaction.

import type { AccountRow, CaptainRow, Db } from './db.ts';
import { PgClient } from './pg.ts';

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS accounts (
     id BIGINT PRIMARY KEY,
     name TEXT NOT NULL,
     token_hash TEXT NOT NULL,
     created_at BIGINT NOT NULL,
     last_seen BIGINT NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS accounts_name ON accounts (lower(name))`,
  `CREATE INDEX IF NOT EXISTS accounts_token ON accounts (token_hash)`,
  `CREATE TABLE IF NOT EXISTS captains (
     account_id BIGINT PRIMARY KEY REFERENCES accounts(id),
     data JSONB NOT NULL,
     x DOUBLE PRECISION NOT NULL,
     y DOUBLE PRECISION NOT NULL,
     heading DOUBLE PRECISION NOT NULL,
     updated_at BIGINT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS kv (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL,
     updated_at BIGINT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS ledger (
     id BIGSERIAL PRIMARY KEY,
     account_id BIGINT NOT NULL,
     kind TEXT NOT NULL,
     amount BIGINT NOT NULL,
     detail TEXT,
     at BIGINT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS ledger_account ON ledger (account_id, at)`,
  `CREATE INDEX IF NOT EXISTS ledger_at ON ledger (at)`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email TEXT`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pass_hash TEXT`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts (lower(email)) WHERE email IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS oauth_links (
     provider TEXT NOT NULL,
     subject TEXT NOT NULL,
     account_id BIGINT NOT NULL REFERENCES accounts(id),
     PRIMARY KEY (provider, subject)
   )`,
  `CREATE TABLE IF NOT EXISTS auth_tokens (
     token_hash TEXT PRIMARY KEY,
     account_id BIGINT NOT NULL,
     kind TEXT NOT NULL,
     expires BIGINT NOT NULL
   )`,
  // The premium shop's doubloons (docs/01 P7): the account's, never below nought.
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS doubloons BIGINT NOT NULL DEFAULT 0 CHECK (doubloons >= 0)`,
  `CREATE INDEX IF NOT EXISTS ledger_doubloons ON ledger (account_id) WHERE kind LIKE 'doubloons%'`,
];

const BUCKET_MS = 60_000;
const LEDGER_WINDOW_MS = 30 * 86_400_000;

interface Op {
  sql: string;
  params: unknown[];
}

export class PgDatabase implements Db {
  private client: PgClient;
  private accounts = new Map<number, AccountRow>();
  private byToken = new Map<string, AccountRow>();
  private byName = new Map<string, AccountRow>();
  private byEmail = new Map<string, AccountRow>();
  private oauth = new Map<string, number>();
  private authTokens = new Map<string, { account: number; kind: string; expires: number }>();
  /** Each account's doubloons, and the references of its doubloons ledger rows (`account:kind:ref`). */
  private balances = new Map<number, number>();
  private doubloonRefs = new Set<string>();
  private captains = new Map<number, CaptainRow & { gold: number; bank: number }>();
  private kv = new Map<string, string>();
  private buckets = new Map<number, Map<string, { inflow: number; outflow: number; n: number }>>();
  private nextId = 1;
  private ops: Op[] = [];
  private flushing: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval>;
  private inTx = false;
  /** Errors from background writes (surfaced in logs and /health). */
  writeErrors = 0;
  log: (msg: string) => void = (m) => console.error(m);

  private constructor(client: PgClient) {
    this.client = client;
    this.timer = setInterval(() => void this.flush(), 200);
    this.timer.unref?.();
  }

  static async open(url: string): Promise<PgDatabase> {
    const client = await PgClient.connect(url);
    for (const m of MIGRATIONS) await client.query(m);
    const db = new PgDatabase(client);
    await db.preload();
    return db;
  }

  private async preload(): Promise<void> {
    const acc = await this.client.query('SELECT id, name, token_hash, email, pass_hash, email_verified, doubloons FROM accounts');
    for (const r of acc.rows) {
      this.indexAccount({ id: Number(r.id), name: String(r.name), token_hash: String(r.token_hash), email: (r.email as string | null) ?? null, pass_hash: (r.pass_hash as string | null) ?? null, email_verified: !!r.email_verified });
      this.balances.set(Number(r.id), Number(r.doubloons ?? 0));
    }
    for (const r of (await this.client.query(`SELECT account_id, kind, detail FROM ledger WHERE kind LIKE 'doubloons%'`)).rows) this.doubloonRefs.add(`${r.account_id}:${r.kind}:${r.detail}`);
    for (const r of (await this.client.query('SELECT provider, subject, account_id FROM oauth_links')).rows) this.oauth.set(`${r.provider}:${r.subject}`, Number(r.account_id));
    for (const r of (await this.client.query('SELECT token_hash, account_id, kind, expires FROM auth_tokens WHERE expires > $1', [Date.now()])).rows) {
      this.authTokens.set(String(r.token_hash), { account: Number(r.account_id), kind: String(r.kind), expires: Number(r.expires) });
    }
    const caps = await this.client.query('SELECT account_id, data::text AS data, x, y, heading FROM captains');
    for (const r of caps.rows) {
      const data = String(r.data);
      const parsed = JSON.parse(data) as { gold?: number; bank?: number };
      this.captains.set(Number(r.account_id), { account_id: Number(r.account_id), data, x: Number(r.x), y: Number(r.y), heading: Number(r.heading), gold: parsed.gold ?? 0, bank: parsed.bank ?? 0 });
    }
    const kv = await this.client.query('SELECT key, value::text AS value FROM kv');
    for (const r of kv.rows) this.kv.set(String(r.key), String(r.value));
    const since = Date.now() - LEDGER_WINDOW_MS;
    const led = await this.client.query(
      `SELECT (at / ${BUCKET_MS})::bigint AS minute, kind,
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS outflow, COUNT(*) AS n
       FROM ledger WHERE at >= $1 GROUP BY 1, 2`,
      [since],
    );
    for (const r of led.rows) this.bucket(Number(r.minute), String(r.kind), Number(r.inflow), Number(r.outflow), Number(r.n));
    const max = await this.client.query('SELECT COALESCE(MAX(id), 0) AS m FROM accounts');
    this.nextId = Number(max.rows[0].m) + 1;
  }

  private indexAccount(a: AccountRow): void {
    this.accounts.set(a.id, a);
    this.byToken.set(a.token_hash, a);
    this.byName.set(a.name.toLowerCase(), a);
    if (a.email) this.byEmail.set(a.email.toLowerCase(), a);
  }

  // ---------------------------------------------------------------- e-mail and OAuth sign-in
  accountById(id: number): AccountRow | undefined {
    return this.accounts.get(id);
  }

  accountByEmail(email: string): AccountRow | undefined {
    return this.byEmail.get(email.toLowerCase());
  }

  setEmail(id: number, email: string, passHash: string): void {
    const a = this.accounts.get(id);
    if (!a) return;
    if (a.email) this.byEmail.delete(a.email.toLowerCase());
    a.email = email;
    a.pass_hash = passHash;
    a.email_verified = false;
    this.byEmail.set(email.toLowerCase(), a);
    this.write('UPDATE accounts SET email = $1, pass_hash = $2, email_verified = FALSE WHERE id = $3', [email, passHash, id]);
  }

  setPassword(id: number, passHash: string): void {
    const a = this.accounts.get(id);
    if (a) a.pass_hash = passHash;
    this.write('UPDATE accounts SET pass_hash = $1 WHERE id = $2', [passHash, id]);
  }

  setEmailVerified(id: number): void {
    const a = this.accounts.get(id);
    if (a) a.email_verified = true;
    this.write('UPDATE accounts SET email_verified = TRUE WHERE id = $1', [id]);
  }

  setTokenHash(id: number, tokenHash: string): void {
    const a = this.accounts.get(id);
    if (!a) return;
    this.byToken.delete(a.token_hash);
    a.token_hash = tokenHash;
    this.byToken.set(tokenHash, a);
    this.write('UPDATE accounts SET token_hash = $1 WHERE id = $2', [tokenHash, id]);
  }

  linkOAuth(provider: string, subject: string, accountId: number): void {
    this.oauth.set(`${provider}:${subject}`, accountId);
    this.write('INSERT INTO oauth_links (provider, subject, account_id) VALUES ($1, $2, $3) ON CONFLICT (provider, subject) DO UPDATE SET account_id = EXCLUDED.account_id', [provider, subject, accountId]);
  }

  accountByOAuth(provider: string, subject: string): AccountRow | undefined {
    const id = this.oauth.get(`${provider}:${subject}`);
    return id === undefined ? undefined : this.accounts.get(id);
  }

  putAuthToken(tokenHash: string, accountId: number, kind: string, expires: number): void {
    this.authTokens.set(tokenHash, { account: accountId, kind, expires });
    this.write('INSERT INTO auth_tokens (token_hash, account_id, kind, expires) VALUES ($1, $2, $3, $4) ON CONFLICT (token_hash) DO UPDATE SET account_id = EXCLUDED.account_id, kind = EXCLUDED.kind, expires = EXCLUDED.expires', [tokenHash, accountId, kind, expires]);
  }

  takeAuthToken(tokenHash: string, kind: string): number | undefined {
    const t = this.authTokens.get(tokenHash);
    if (!t) return undefined;
    this.authTokens.delete(tokenHash);
    this.write('DELETE FROM auth_tokens WHERE token_hash = $1', [tokenHash]);
    return t.kind === kind && t.expires > Date.now() ? t.account : undefined;
  }

  private bucket(minute: number, kind: string, inflow: number, outflow: number, n: number): void {
    let m = this.buckets.get(minute);
    if (!m) this.buckets.set(minute, (m = new Map()));
    const b = m.get(kind) ?? { inflow: 0, outflow: 0, n: 0 };
    b.inflow += inflow;
    b.outflow += outflow;
    b.n += n;
    m.set(kind, b);
  }

  private write(sql: string, params: unknown[]): void {
    this.ops.push({ sql, params });
    if (this.ops.length > 500 && !this.inTx) void this.flush();
  }

  /** Send everything queued so far, in order, as one transaction. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing.then(() => (this.ops.length ? this.flush() : undefined));
    if (!this.ops.length || this.client.closed) return Promise.resolve();
    const batch = this.ops;
    this.ops = [];
    this.flushing = (async () => {
      try {
        await this.client.query('BEGIN');
        for (const op of batch) await this.client.query(op.sql, op.params);
        await this.client.query('COMMIT');
      } catch (e) {
        this.writeErrors++;
        this.log(`[pg] write batch failed (${batch.length} ops): ${(e as Error).message}`);
        try {
          await this.client.query('ROLLBACK');
        } catch {
          // connection gone: nothing more to do here
        }
        // Retry one statement at a time so a single bad row does not lose the rest.
        for (const op of batch) {
          try {
            await this.client.query(op.sql, op.params);
          } catch (e2) {
            this.log(`[pg] dropped write: ${(e2 as Error).message}`);
          }
        }
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
    await this.client.end();
  }

  // ---------------------------------------------------------------- accounts
  createAccount(name: string, tokenHash: string): number {
    const id = this.nextId++;
    const now = Date.now();
    this.indexAccount({ id, name, token_hash: tokenHash });
    this.balances.set(id, 0);
    this.write('INSERT INTO accounts (id, name, token_hash, created_at, last_seen) VALUES ($1, $2, $3, $4, $5)', [id, name, tokenHash, now, now]);
    return id;
  }

  accountByToken(tokenHash: string): AccountRow | undefined {
    return this.byToken.get(tokenHash);
  }

  accountByName(name: string): AccountRow | undefined {
    return this.byName.get(name.toLowerCase());
  }

  touchAccount(id: number): void {
    this.write('UPDATE accounts SET last_seen = $1 WHERE id = $2', [Date.now(), id]);
  }

  // ---------------------------------------------------------------- captains
  loadCaptain(accountId: number): CaptainRow | undefined {
    const c = this.captains.get(accountId);
    return c ? { account_id: c.account_id, data: c.data, x: c.x, y: c.y, heading: c.heading } : undefined;
  }

  saveCaptain(accountId: number, data: unknown, x: number, y: number, heading: number): void {
    const json = JSON.stringify(data);
    const d = data as { gold?: number; bank?: number };
    this.captains.set(accountId, { account_id: accountId, data: json, x, y, heading, gold: d.gold ?? 0, bank: d.bank ?? 0 });
    this.write(
      `INSERT INTO captains (account_id, data, x, y, heading, updated_at) VALUES ($1, $2::jsonb, $3, $4, $5, $6)
       ON CONFLICT (account_id) DO UPDATE SET data = EXCLUDED.data, x = EXCLUDED.x, y = EXCLUDED.y, heading = EXCLUDED.heading, updated_at = EXCLUDED.updated_at`,
      [accountId, json, x, y, heading, Date.now()],
    );
  }

  // ---------------------------------------------------------------- world state
  getKv<T>(key: string): T | undefined {
    const v = this.kv.get(key);
    return v === undefined ? undefined : (JSON.parse(v) as T);
  }

  setKv(key: string, value: unknown): void {
    const json = JSON.stringify(value);
    this.kv.set(key, json);
    this.write('INSERT INTO kv (key, value, updated_at) VALUES ($1, $2::jsonb, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at', [key, json, Date.now()]);
  }

  // ---------------------------------------------------------------- ledger
  ledger(accountId: number, kind: string, amount: number, detail: string): void {
    const at = Date.now();
    const a = Math.round(amount);
    this.bucket(Math.floor(at / BUCKET_MS), kind, a > 0 ? a : 0, a < 0 ? -a : 0, 1);
    if (kind.startsWith('doubloons')) this.doubloonRefs.add(`${accountId}:${kind}:${detail}`);
    this.write('INSERT INTO ledger (account_id, kind, amount, detail, at) VALUES ($1, $2, $3, $4, $5)', [accountId, kind, a, detail, at]);
  }

  // ---------------------------------------------------------------- doubloons
  doubloons(accountId: number): number {
    return this.balances.get(accountId) ?? 0;
  }

  /** Checked against the balance held here (one process owns an account at a time); the row moves by the delta, so a
   *  write that lands late never overwrites another's. */
  addDoubloons(accountId: number, delta: number): number | null {
    if (!this.accounts.has(accountId)) return null;
    const d = Math.trunc(delta);
    const next = (this.balances.get(accountId) ?? 0) + d;
    if (next < 0) return null;
    this.balances.set(accountId, next);
    this.write('UPDATE accounts SET doubloons = doubloons + $1 WHERE id = $2', [d, accountId]);
    return next;
  }

  doubloonRef(accountId: number, kind: string, ref: string): boolean {
    return this.doubloonRefs.has(`${accountId}:${kind}:${ref}`);
  }

  ledgerFlows(sinceMs: number): { kind: string; inflow: number; outflow: number; n: number }[] {
    const from = Math.floor(sinceMs / BUCKET_MS);
    const cutoff = Math.floor((Date.now() - LEDGER_WINDOW_MS) / BUCKET_MS);
    const out = new Map<string, { kind: string; inflow: number; outflow: number; n: number }>();
    for (const [minute, kinds] of this.buckets) {
      if (minute < cutoff) {
        this.buckets.delete(minute);
        continue;
      }
      if (minute < from) continue;
      for (const [kind, b] of kinds) {
        const o = out.get(kind) ?? { kind, inflow: 0, outflow: 0, n: 0 };
        o.inflow += b.inflow;
        o.outflow += b.outflow;
        o.n += b.n;
        out.set(kind, o);
      }
    }
    return [...out.values()];
  }

  silverHoldings(): { account_id: number; gold: number; bank: number }[] {
    return [...this.captains.values()].map((c) => ({ account_id: c.account_id, gold: c.gold, bank: c.bank }));
  }

  /** Writes queued inside `fn` are flushed together (every flush is one transaction anyway). */
  transaction(fn: () => void): void {
    this.inTx = true;
    try {
      fn();
    } finally {
      this.inTx = false;
    }
  }
}
