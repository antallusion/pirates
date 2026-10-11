// «Свиток автобоя» on the server (owner, 2026-10-11: «автобой в абордаже только специальной премиум свитками, которую
// можно за дублоны купить»; docs/25 §5). The scrolls are the account's (accounts.autoscrolls, every move a ledger row
// `autoscroll_<why>`), bought only for doubloons in the premium shop (premium.ts buyScrolls), granted by the admin's
// console and, once a week, by a top seal of the deep won in time (seals.ts). In a battle — a boarding, a fight ashore,
// the Colosseum, a legend, a raid, a citadel — the captain's «Авто», and a quick fight that is not the free one against a
// clearly weaker ship of the sea (docs/25 item 49), spend one scroll for that battle: she may take the helm back at
// any time and give «Авто» again in it for nothing more; nothing is refunded. The fallback of a captain gone from the
// helm (her side fights on by itself) costs nothing and ends when she is back.

import { CREDIT_MAX } from '../../../shared/src/data/premium.ts';
import type { TacAction, TacScrolls } from '../../../shared/src/protocol.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { TacHero } from './tacbattle.ts';

/** Her order refused for want of a scroll (her screen shows «Авто» locked with the price and «Купить» beside it). */
export const NO_SCROLL = 'No auto-battle scroll: buy them for doubloons in the shop.';

/** Where scrolls come from besides the shop: the admin's console, a reward (a top seal of the week). */
export type ScrollSource = 'admin' | 'reward';

/** Her account's scrolls. */
export function scrollsOf(game: Game, acc: number): number {
  return game.db.scrolls(acc);
}

/** The count moved and its ledger row written together (null: it would go below nought — nothing written). */
export function moveScrolls(game: Game, acc: number, delta: number, kind: string, detail: string): number | null {
  let n = null as number | null;
  game.db.transaction(() => {
    n = game.db.addScrolls(acc, delta);
    if (n === null) return;
    game.db.ledger(acc, kind, delta, detail.slice(0, 120));
  });
  return n;
}

/** Her scrolls (and doubloons) to her client: the shop, the gear's locker and the battle bar read them. */
export function sendScrolls(game: Game, s: PlayerSession): void {
  if (s.authed) game.sendTo(s, { t: 'doubloons', n: game.db.doubloons(s.accountId), scrolls: game.db.scrolls(s.accountId) });
}

/** Scrolls given (not bought): a whole number up to CREDIT_MAX; the captain told if she is aboard. Null: refused. */
export function grantScrolls(game: Game, acc: number, n: number, source: ScrollSource, ref: string): number | null {
  const k = Math.floor(Number(n));
  if (!(k > 0) || k > CREDIT_MAX || !game.db.accountById(acc)) return null;
  const left = moveScrolls(game, acc, k, `autoscroll_${source}`, String(ref ?? ''));
  const s = game.sessionByAccount(acc);
  if (left !== null && s) sendScrolls(game, s);
  return left;
}

/** What an order asks of the scrolls: «Авто» given, or a quick fight that is not the free one (`freeQuick`: her side
 *  was offered it at once, the foe clearly the weaker — docs/25 item 49). */
export function wantsScroll(a: TacAction, freeQuick: boolean): boolean {
  if (!a || typeof a !== 'object') return false;
  return (a.a === 'auto' && a.on === true) || (a.a === 'quick' && !freeQuick);
}

/** The scroll an order asks for, spent before it is given (once a battle: `h.paid`). `took`: one was spent now (give it
 *  back with giveBack if the battle then refuses the order). `why`: refused — no scroll. */
export function payScroll(game: Game, acc: number, h: TacHero, a: TacAction, freeQuick: boolean, ref: string): { why: string | null; took: boolean } {
  if (!wantsScroll(a, freeQuick) || h.paid) return { why: null, took: false };
  if (moveScrolls(game, acc, -1, 'autoscroll_use', ref) === null) return { why: NO_SCROLL, took: false };
  h.paid = true;
  const s = game.sessionByAccount(acc);
  if (s) sendScrolls(game, s);
  return { why: null, took: true };
}

/** A scroll spent for an order the battle refused after all (it was over a moment before): back, with its row. */
export function giveBack(game: Game, acc: number, h: TacHero, ref: string): void {
  h.paid = false;
  moveScrolls(game, acc, 1, 'autoscroll_back', ref);
  const s = game.sessionByAccount(acc);
  if (s) sendScrolls(game, s);
}

/** The disconnect's fallback, the same everywhere: gone from the helm, her side plays by itself (free); back, the helm
 *  is hers again unless a scroll was spent on the battle. True when it changed anything. */
export function helmFallback(h: TacHero, gone: boolean): boolean {
  if (gone && !h.auto) {
    h.auto = true;
    h.gone = true;
    return true;
  }
  if (!gone && h.gone) {
    h.gone = false;
    if (!h.paid && h.auto) {
      h.auto = false;
      return true;
    }
  }
  return false;
}

/** Her battle bar's scroll line (TacView.scrolls). */
export function scrollView(game: Game, acc: number, h: TacHero | undefined, freeQuick: boolean): TacScrolls {
  return { n: game.db.scrolls(acc), ...(h?.paid ? { paid: true } : {}), ...(freeQuick ? { freeQuick: true } : {}) };
}

/** `/scrolls [N|-N]`: scrolls given to her account (or taken off it, never below nought). */
export function adminScrolls(game: Game, s: PlayerSession, args: string[]): string {
  const n = Math.trunc(Number(args[0]));
  if (!Number.isFinite(n) || n === 0) return `Auto-battle scrolls: ${game.db.scrolls(s.accountId)}. Usage: /scrolls N|-N`;
  const left = n > 0 ? grantScrolls(game, s.accountId, n, 'admin', `console:${s.name}`) : moveScrolls(game, s.accountId, n, 'autoscroll_admin', `console:${s.name}`);
  if (left === null) return n > 0 ? `No more than ${CREDIT_MAX} at once.` : `Not that many: ${game.db.scrolls(s.accountId)} on the account.`;
  sendScrolls(game, s);
  return `Auto-battle scrolls: ${left}.`;
}
