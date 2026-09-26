// Authentication service boundary. The prototype uses guest accounts with a random bearer token
// (stored only as a SHA-256 hash). Production swaps this module for OAuth/e-mail login behind the same API.

import { createHash, randomBytes } from 'node:crypto';
import type { Db } from './persistence/db.ts';

export interface AuthResult {
  accountId: number;
  name: string;
  token: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const NAME_RE = /^[\p{L}\p{N} _'-]{3,20}$/u;

export function sanitizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  return NAME_RE.test(name) ? name : null;
}

export class AuthService {
  private db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  resume(token: string): AuthResult | null {
    if (typeof token !== 'string' || token.length < 20 || token.length > 128) return null;
    const row = this.db.accountByToken(hashToken(token));
    if (!row) return null;
    this.db.touchAccount(row.id);
    return { accountId: row.id, name: row.name, token };
  }

  register(rawName: string): AuthResult | { error: string } {
    const name = sanitizeName(rawName ?? '');
    if (!name) return { error: 'Name must be 3–20 letters, digits, spaces, apostrophes or dashes.' };
    if (this.db.accountByName(name)) return { error: 'That name is already sailing these waters.' };
    const token = randomBytes(24).toString('base64url');
    const accountId = this.db.createAccount(name, hashToken(token));
    return { accountId, name, token };
  }
}
