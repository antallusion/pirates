// Persistence layer on Node's built-in SQLite. The game talks to repositories, never to SQL,
// so the backend can move to PostgreSQL (see docs/04_TECHNICAL_ARCHITECTURE.md) without touching systems.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS accounts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE COLLATE NOCASE,
     token_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     last_seen INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS captains (
     account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
     data TEXT NOT NULL,
     x REAL NOT NULL,
     y REAL NOT NULL,
     heading REAL NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS kv (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS ledger (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     account_id INTEGER NOT NULL,
     kind TEXT NOT NULL,
     amount INTEGER NOT NULL,
     detail TEXT,
     at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS ledger_account ON ledger(account_id, at)`,
  `CREATE TABLE IF NOT EXISTS oauth_links (
     provider TEXT NOT NULL,
     subject TEXT NOT NULL,
     account_id INTEGER NOT NULL REFERENCES accounts(id),
     PRIMARY KEY (provider, subject)
   )`,
  `CREATE TABLE IF NOT EXISTS auth_tokens (
     token_hash TEXT PRIMARY KEY,
     account_id INTEGER NOT NULL,
     kind TEXT NOT NULL,
     expires INTEGER NOT NULL
   )`,
];

/** Columns added to `accounts` after the first release (e-mail sign-in). */
const ACCOUNT_COLUMNS: [string, string][] = [
  ['email', 'TEXT'],
  ['pass_hash', 'TEXT'],
  ['email_verified', 'INTEGER NOT NULL DEFAULT 0'],
];

export interface AccountRow {
  id: number;
  name: string;
  token_hash: string;
  email?: string | null;
  pass_hash?: string | null;
  email_verified?: boolean;
}

export interface CaptainRow {
  account_id: number;
  data: string;
  x: number;
  y: number;
  heading: number;
}

/** What the game needs from persistence. SQLite (`Database`) and PostgreSQL (`PgDatabase`) both provide it synchronously. */
export interface Db {
  close(): void | Promise<void>;
  createAccount(name: string, tokenHash: string): number;
  accountByToken(tokenHash: string): AccountRow | undefined;
  accountByName(name: string): AccountRow | undefined;
  touchAccount(id: number): void;
  loadCaptain(accountId: number): CaptainRow | undefined;
  saveCaptain(accountId: number, data: unknown, x: number, y: number, heading: number): void;
  getKv<T>(key: string): T | undefined;
  setKv(key: string, value: unknown): void;
  ledger(accountId: number, kind: string, amount: number, detail: string): void;
  ledgerFlows(sinceMs: number): { kind: string; inflow: number; outflow: number; n: number }[];
  silverHoldings(): { account_id: number; gold: number; bank: number }[];
  transaction(fn: () => void): void;
  // e-mail and OAuth sign-in
  accountById(id: number): AccountRow | undefined;
  accountByEmail(email: string): AccountRow | undefined;
  setEmail(id: number, email: string, passHash: string): void;
  setPassword(id: number, passHash: string): void;
  setEmailVerified(id: number): void;
  setTokenHash(id: number, tokenHash: string): void;
  linkOAuth(provider: string, subject: string, accountId: number): void;
  accountByOAuth(provider: string, subject: string): AccountRow | undefined;
  putAuthToken(tokenHash: string, accountId: number, kind: string, expires: number): void;
  /** Consumes a one-time token: returns its account if it exists, is of this kind and has not expired. */
  takeAuthToken(tokenHash: string, kind: string): number | undefined;
}

export class Database implements Db {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    // busy_timeout: zone processes share one database file and take turns writing.
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
    for (const m of MIGRATIONS) this.db.exec(m);
    const cols = new Set((this.db.prepare('PRAGMA table_info(accounts)').all() as { name: string }[]).map((c) => c.name));
    for (const [c, def] of ACCOUNT_COLUMNS) if (!cols.has(c)) this.db.exec(`ALTER TABLE accounts ADD COLUMN ${c} ${def}`);
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts(email COLLATE NOCASE) WHERE email IS NOT NULL');
  }

  private row(r: Record<string, unknown> | undefined): AccountRow | undefined {
    if (!r) return undefined;
    return { id: Number(r.id), name: String(r.name), token_hash: String(r.token_hash), email: (r.email as string | null) ?? null, pass_hash: (r.pass_hash as string | null) ?? null, email_verified: !!r.email_verified };
  }

  accountById(id: number): AccountRow | undefined {
    return this.row(this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Record<string, unknown> | undefined);
  }

  accountByEmail(email: string): AccountRow | undefined {
    return this.row(this.db.prepare('SELECT * FROM accounts WHERE email = ? COLLATE NOCASE').get(email) as Record<string, unknown> | undefined);
  }

  setEmail(id: number, email: string, passHash: string): void {
    this.db.prepare('UPDATE accounts SET email = ?, pass_hash = ?, email_verified = 0 WHERE id = ?').run(email, passHash, id);
  }

  setPassword(id: number, passHash: string): void {
    this.db.prepare('UPDATE accounts SET pass_hash = ? WHERE id = ?').run(passHash, id);
  }

  setEmailVerified(id: number): void {
    this.db.prepare('UPDATE accounts SET email_verified = 1 WHERE id = ?').run(id);
  }

  setTokenHash(id: number, tokenHash: string): void {
    this.db.prepare('UPDATE accounts SET token_hash = ? WHERE id = ?').run(tokenHash, id);
  }

  linkOAuth(provider: string, subject: string, accountId: number): void {
    this.db.prepare('INSERT OR REPLACE INTO oauth_links (provider, subject, account_id) VALUES (?, ?, ?)').run(provider, subject, accountId);
  }

  accountByOAuth(provider: string, subject: string): AccountRow | undefined {
    const r = this.db.prepare('SELECT account_id FROM oauth_links WHERE provider = ? AND subject = ?').get(provider, subject) as { account_id: number } | undefined;
    return r ? this.accountById(Number(r.account_id)) : undefined;
  }

  putAuthToken(tokenHash: string, accountId: number, kind: string, expires: number): void {
    this.db.prepare('INSERT OR REPLACE INTO auth_tokens (token_hash, account_id, kind, expires) VALUES (?, ?, ?, ?)').run(tokenHash, accountId, kind, expires);
  }

  takeAuthToken(tokenHash: string, kind: string): number | undefined {
    const r = this.db.prepare('SELECT account_id, kind, expires FROM auth_tokens WHERE token_hash = ?').get(tokenHash) as { account_id: number; kind: string; expires: number } | undefined;
    if (!r) return undefined;
    this.db.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').run(tokenHash);
    return r.kind === kind && r.expires > Date.now() ? Number(r.account_id) : undefined;
  }

  close(): void {
    this.db.close();
  }

  // ---------------------------------------------------------------- accounts
  createAccount(name: string, tokenHash: string): number {
    const now = Date.now();
    const r = this.db.prepare('INSERT INTO accounts (name, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?)').run(name, tokenHash, now, now);
    return Number(r.lastInsertRowid);
  }

  accountByToken(tokenHash: string): AccountRow | undefined {
    return this.row(this.db.prepare('SELECT * FROM accounts WHERE token_hash = ?').get(tokenHash) as Record<string, unknown> | undefined);
  }

  accountByName(name: string): AccountRow | undefined {
    return this.row(this.db.prepare('SELECT * FROM accounts WHERE name = ?').get(name) as Record<string, unknown> | undefined);
  }

  touchAccount(id: number): void {
    this.db.prepare('UPDATE accounts SET last_seen = ? WHERE id = ?').run(Date.now(), id);
  }

  // ---------------------------------------------------------------- captains
  loadCaptain(accountId: number): CaptainRow | undefined {
    return this.db.prepare('SELECT account_id, data, x, y, heading FROM captains WHERE account_id = ?').get(accountId) as CaptainRow | undefined;
  }

  saveCaptain(accountId: number, data: unknown, x: number, y: number, heading: number): void {
    this.db
      .prepare(
        `INSERT INTO captains (account_id, data, x, y, heading, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, x = excluded.x, y = excluded.y, heading = excluded.heading, updated_at = excluded.updated_at`,
      )
      .run(accountId, JSON.stringify(data), x, y, heading, Date.now());
  }

  // ---------------------------------------------------------------- key/value world state
  getKv<T>(key: string): T | undefined {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : undefined;
  }

  setKv(key: string, value: unknown): void {
    this.db
      .prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .run(key, JSON.stringify(value), Date.now());
  }

  // ---------------------------------------------------------------- economy audit trail
  ledger(accountId: number, kind: string, amount: number, detail: string): void {
    this.db.prepare('INSERT INTO ledger (account_id, kind, amount, detail, at) VALUES (?, ?, ?, ?, ?)').run(accountId, kind, Math.round(amount), detail, Date.now());
  }

  /** Inflow and outflow per ledger kind since `sinceMs` (epoch ms). */
  ledgerFlows(sinceMs: number): { kind: string; inflow: number; outflow: number; n: number }[] {
    return this.db
      .prepare(
        `SELECT kind, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS outflow, COUNT(*) AS n
         FROM ledger WHERE at >= ? GROUP BY kind`,
      )
      .all(sinceMs) as { kind: string; inflow: number; outflow: number; n: number }[];
  }

  /** Silver held by every saved captain: purse and League bank balance. */
  silverHoldings(): { account_id: number; gold: number; bank: number }[] {
    return this.db
      .prepare(`SELECT account_id, COALESCE(json_extract(data, '$.gold'), 0) AS gold, COALESCE(json_extract(data, '$.bank'), 0) AS bank FROM captains`)
      .all() as { account_id: number; gold: number; bank: number }[];
  }

  transaction(fn: () => void): void {
    this.db.exec('BEGIN');
    try {
      fn();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}
