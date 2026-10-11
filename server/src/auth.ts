// Accounts. Three ways aboard, one bearer token for the game socket (stored only as a SHA-256 hash):
//  - guest: a captain's name, nothing else (the prototype's way; can be claimed later with an e-mail);
//  - e-mail and password (scrypt), with verification and password-reset letters;
//  - OAuth (GitHub, Google, Discord — see oauth.ts), linked by the provider's user id.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Mailer } from './mail.ts';
import { MailRejected, OutboxMailer } from './mail.ts';
import type { AccountRow, Db } from './persistence/db.ts';

export interface AuthResult {
  accountId: number;
  name: string;
  token: string;
}

export type AuthError = { error: string };

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const NAME_RE = /^[\p{L}\p{N} _'-]{3,20}$/u;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
/** The tongue of a letter (the captain's game language). */
export type MailLocale = 'ru' | 'en';
export const mailLocale = (v: unknown): MailLocale => (v === 'ru' ? 'ru' : 'en');
/** A 422 from the mail service: the address is unknown, mistyped or throwaway (owner: «покажи "проверьте email"»). */
export const CHECK_EMAIL = 'Check the e-mail address: letters cannot be delivered to it.';
export const isEmail = (v: string): boolean => EMAIL_RE.test(v);
const VERIFY_TTL = 3 * 86_400_000;
const RESET_TTL = 3_600_000;

export function sanitizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  return NAME_RE.test(name) ? name : null;
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [kind, saltB64, hashB64] = stored.split('$');
  if (kind !== 'scrypt' || !saltB64 || !hashB64) return false;
  const want = Buffer.from(hashB64, 'base64');
  const got = scryptSync(pw, Buffer.from(saltB64, 'base64'), want.length, { N: 16384, r: 8, p: 1 });
  return got.length === want.length && timingSafeEqual(got, want);
}

function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'A password needs at least 8 characters.';
  if (pw.length > 200) return 'That password is too long.';
  return null;
}

export class AuthService {
  private db: Db;
  readonly mailer: Mailer;
  /** Public address of the game, for the links in letters. */
  publicUrl: string;

  constructor(db: Db, mailer: Mailer = new OutboxMailer(() => {}), publicUrl = 'http://localhost:8080') {
    this.db = db;
    this.mailer = mailer;
    this.publicUrl = publicUrl;
  }

  resume(token: string): AuthResult | null {
    if (typeof token !== 'string' || token.length < 20 || token.length > 128) return null;
    const row = this.db.accountByToken(hashToken(token));
    if (!row) return null;
    this.db.touchAccount(row.id);
    return { accountId: row.id, name: row.name, token };
  }

  /** Guest: a name and nothing else. */
  register(rawName: string): AuthResult | AuthError {
    const name = sanitizeName(rawName ?? '');
    if (!name) return { error: 'Name must be 3–20 letters, digits, spaces, apostrophes or dashes.' };
    if (this.db.accountByName(name)) return { error: 'That name is already sailing these waters.' };
    const token = randomBytes(24).toString('base64url');
    const accountId = this.db.createAccount(name, hashToken(token));
    return { accountId, name, token };
  }

  /** A fresh game token for an account (logging in rotates it). */
  private issue(a: AccountRow): AuthResult {
    const token = randomBytes(24).toString('base64url');
    this.db.setTokenHash(a.id, hashToken(token));
    this.db.touchAccount(a.id);
    return { accountId: a.id, name: a.name, token };
  }

  async registerEmail(rawEmail: string, password: string, rawName: string, locale: MailLocale = 'en'): Promise<AuthResult | AuthError> {
    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { error: 'That does not look like an e-mail address.' };
    const bad = passwordProblem(password);
    if (bad) return { error: bad };
    if (this.db.accountByEmail(email)) return { error: 'An account with that e-mail already exists.' };
    // (the name is checked before a letter goes: a refused name sends nothing)
    const name = sanitizeName(rawName ?? '');
    if (!name || this.db.accountByName(name)) return this.register(rawName) as AuthError;
    // The letter goes first (owner, 2026-10-11): an address the mail service refuses makes no account at all.
    const raw = randomBytes(24).toString('base64url');
    if ((await this.mailVerification(email, raw, locale)) === 'invalid') return { error: CHECK_EMAIL };
    const r = this.register(rawName);
    if ('error' in r) return r;
    this.db.setEmail(r.accountId, email, hashPassword(password));
    this.db.putAuthToken(hashToken(raw), r.accountId, 'verify', Date.now() + VERIFY_TTL);
    return r;
  }

  async loginEmail(rawEmail: string, password: string): Promise<AuthResult | AuthError> {
    const a = this.db.accountByEmail(String(rawEmail ?? '').trim().toLowerCase());
    if (!a || !verifyPassword(String(password ?? ''), a.pass_hash)) return { error: 'Wrong e-mail or password.' };
    return this.issue(a);
  }

  /** A guest keeps their captain and adds an e-mail and a password. */
  async claim(gameToken: string, rawEmail: string, password: string, locale: MailLocale = 'en'): Promise<AuthResult | AuthError> {
    const cur = this.resume(gameToken);
    if (!cur) return { error: 'Sign in first.' };
    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { error: 'That does not look like an e-mail address.' };
    const bad = passwordProblem(password);
    if (bad) return { error: bad };
    const other = this.db.accountByEmail(email);
    if (other && other.id !== cur.accountId) return { error: 'An account with that e-mail already exists.' };
    const raw = randomBytes(24).toString('base64url');
    if ((await this.mailVerification(email, raw, locale)) === 'invalid') return { error: CHECK_EMAIL };
    this.db.setEmail(cur.accountId, email, hashPassword(password));
    this.db.putAuthToken(hashToken(raw), cur.accountId, 'verify', Date.now() + VERIFY_TTL);
    return cur;
  }

  /** The verification letter (Sendersy's own, in her tongue; plain words for the other mailers): 'invalid' when the
   *  mail service refuses the address (a 422 — told to her, not retried), 'failed' when it could not be reached. */
  private async mailVerification(email: string, raw: string, locale: MailLocale): Promise<'ok' | 'invalid' | 'failed'> {
    const url = `${this.publicUrl}/auth/verify?token=${raw}`;
    try {
      await this.mailer.send({
        to: email,
        subject: locale === 'ru' ? 'GRAVETIDE — подтвердите почту' : 'GRAVETIDE — confirm your e-mail',
        text: `Captain,\n\nConfirm this address for your GRAVETIDE account:\n${url}\n\nThe link is good for three days. If you did not ask for this, ignore the letter.\n\n— The Harbour Master`,
        template: 'sendersy/email-verify--gaming',
        locale,
        variables: { verify_url: url },
      });
      return 'ok';
    } catch (e) {
      return e instanceof MailRejected && e.kind === 'invalid' ? 'invalid' : 'failed';
    }
  }

  verifyEmail(raw: string): boolean {
    const id = this.db.takeAuthToken(hashToken(String(raw ?? '')), 'verify');
    if (id === undefined) return false;
    this.db.setEmailVerified(id);
    return true;
  }

  /** Always answers the same, so nobody can probe which addresses have accounts. */
  async forgot(rawEmail: string, locale: MailLocale = 'en'): Promise<void> {
    const a = this.db.accountByEmail(String(rawEmail ?? '').trim().toLowerCase());
    if (!a || !a.email) return;
    const raw = randomBytes(24).toString('base64url');
    this.db.putAuthToken(hashToken(raw), a.id, 'reset', Date.now() + RESET_TTL);
    const url = `${this.publicUrl}/#reset=${raw}`;
    await this.mailer.send({
      to: a.email,
      subject: locale === 'ru' ? 'GRAVETIDE — новый пароль' : 'GRAVETIDE — reset your password',
      text: `Captain ${a.name},\n\nSet a new password here (good for one hour):\n${url}\n\nIf you did not ask for this, ignore the letter; your password stays as it is.\n\n— The Harbour Master`,
      template: 'sendersy/password-reset--gaming',
      locale,
      variables: { reset_url: url },
    }).catch(() => undefined);
  }

  reset(raw: string, password: string): AuthResult | AuthError {
    const bad = passwordProblem(password);
    if (bad) return { error: bad };
    const id = this.db.takeAuthToken(hashToken(String(raw ?? '')), 'reset');
    const a = id === undefined ? undefined : this.db.accountById(id);
    if (!a) return { error: 'That link has expired. Ask for a new one.' };
    this.db.setPassword(a.id, hashPassword(password));
    this.db.setEmailVerified(a.id); // the letter reached them
    return this.issue(a);
  }

  /** OAuth: sign in with the provider's user id; a new account takes the provider's name (made unique). */
  oauthLogin(provider: string, subject: string, email: string | null, displayName: string): AuthResult {
    const linked = this.db.accountByOAuth(provider, subject);
    if (linked) return this.issue(linked);
    const byEmail = email ? this.db.accountByEmail(email.toLowerCase()) : undefined;
    if (byEmail && byEmail.email_verified) {
      this.db.linkOAuth(provider, subject, byEmail.id);
      return this.issue(byEmail);
    }
    let base = sanitizeName(displayName.replace(/[^\p{L}\p{N} _'-]/gu, ' ').slice(0, 16)) ?? 'Captain';
    if (base.length < 3) base = 'Captain';
    let name = base;
    for (let i = 2; this.db.accountByName(name); i++) name = `${base.slice(0, 16)} ${i}`;
    const r = this.register(name) as AuthResult;
    this.db.linkOAuth(provider, subject, r.accountId);
    if (email && !this.db.accountByEmail(email.toLowerCase())) {
      this.db.setEmail(r.accountId, email.toLowerCase(), '');
      this.db.setEmailVerified(r.accountId); // the provider vouches for it
    }
    return r;
  }
}
