// The guard on every form that sends a letter to an address typed into it (owner, 2026-10-11: «у нас уже был
// инцидент со Spamhaus из-за формы "вход по коду"»): a honeypot and a time trap against bots, and at most 3 letters an
// hour to one address and 10 an hour from one IP. Kept in memory per process (a restart forgets it — the hour is
// short); the addresses are kept as SHA-256 hashes, not as they were typed.

import { createHash } from 'node:crypto';

export const MAIL_PER_ADDRESS = 3;
export const MAIL_PER_IP = 10;
const HOUR = 3_600_000;
/** A form filled faster than this (ms since it was shown) is a bot's. */
export const FORM_MIN_MS = 1500;

/** The trap: the hidden field («website») filled, or the form answered faster than a hand can (`t` ms since shown). */
export function formTrapped(body: Record<string, unknown>): boolean {
  if (String(body.website ?? '').trim() !== '') return true;
  const t = Number(body.t);
  return Number.isFinite(t) && t >= 0 && t < FORM_MIN_MS;
}

export class MailGuard {
  private byAddress = new Map<string, number[]>();
  private byIp = new Map<string, number[]>();
  private now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }
  private recent(map: Map<string, number[]>, key: string, t: number): number[] {
    const list = (map.get(key) ?? []).filter((x) => t - x < HOUR);
    if (list.length) map.set(key, list);
    else map.delete(key);
    return list;
  }
  /** May one more letter go to `email` from `ip`? If so it is counted. */
  take(ip: string, email: string): boolean {
    const t = this.now();
    const a = createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
    const byA = this.recent(this.byAddress, a, t);
    const byI = this.recent(this.byIp, ip, t);
    if (byA.length >= MAIL_PER_ADDRESS || byI.length >= MAIL_PER_IP) return false;
    this.byAddress.set(a, [...byA, t]);
    this.byIp.set(ip, [...byI, t]);
    if (this.byAddress.size > 50_000 || this.byIp.size > 50_000) this.sweep(t);
    return true;
  }
  private sweep(t: number): void {
    for (const m of [this.byAddress, this.byIp]) for (const [k, v] of m) if (!v.some((x) => t - x < HOUR)) m.delete(k);
  }
}
