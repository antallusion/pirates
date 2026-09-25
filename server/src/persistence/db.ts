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
];

export interface AccountRow {
  id: number;
  name: string;
  token_hash: string;
}

export interface CaptainRow {
  account_id: number;
  data: string;
  x: number;
  y: number;
  heading: number;
}

export class Database {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
    for (const m of MIGRATIONS) this.db.exec(m);
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
    return this.db.prepare('SELECT id, name, token_hash FROM accounts WHERE token_hash = ?').get(tokenHash) as AccountRow | undefined;
  }

  accountByName(name: string): AccountRow | undefined {
    return this.db.prepare('SELECT id, name, token_hash FROM accounts WHERE name = ?').get(name) as AccountRow | undefined;
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
