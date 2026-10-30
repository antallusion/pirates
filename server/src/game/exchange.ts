// The exchange (owner, 2026-10-30: «реализуй обмен дублонов на серебро»): doubloons into the captain's silver at
// EXCHANGE_SILVER_PER_DOUBLOON, one way only — nothing anywhere turns silver back into doubloons. Every check is made
// before a coin moves; then, in one transaction, the doubloons off the account with their `doubloons_buy` row
// (`exchange:silver:<n>:<pid>`, as every doubloon spend is written), the silver into her purse with its own ledger row
// (`exchange`, a faucet of the silver report) and her save. A purchase id spent once already buys nothing more.

import { EXCHANGE_MAX, EXCHANGE_SILVER_PER_DOUBLOON, exchangeSilver } from '../../../shared/src/data/premium.ts';
import { lackDoubloons } from '../../../shared/src/data/buyfail.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { trackEvent } from './liveops.ts';
import { buyPace, inFight } from './shop.ts';

const PID = /^[A-Za-z0-9_-]{6,40}$/;

/** The ledger's reference of an exchange (the doubloons' row). */
export const exchangeRef = (n: number, pid: string): string => `exchange:silver:${n}:${pid}`;

/** `n` doubloons into silver for her captain. Null: exchanged (or exchanged already by this purchase id); else the
 *  refusal (nothing moved). */
export function exchangeDoubloons(game: Game, s: PlayerSession, n: number, pid: string): string | null {
  if (!s.authed || !s.profile || !s.ship) return 'Not for sale';
  if (!PID.test(String(pid ?? ''))) return 'Not for sale';
  if (!Number.isInteger(n) || n < 1) return 'Name a whole number of doubloons.';
  if (n > EXCHANGE_MAX) return `No more than ${EXCHANGE_MAX} doubloons at one exchange.`;
  const detail = exchangeRef(n, pid);
  if (game.db.doubloonRef(s.accountId, 'doubloons_buy', detail)) return null;
  if (inFight(game, s)) return 'Not in the middle of a fight.';
  const bal = game.db.doubloons(s.accountId);
  if (bal < n) return `${lackDoubloons(n, bal)} — top up your account first.`;
  const silver = exchangeSilver(n);
  let done = false;
  game.db.transaction(() => {
    if (game.db.addDoubloons(s.accountId, -n) === null) return;
    game.db.ledger(s.accountId, 'doubloons_buy', -n, detail);
    s.profile!.gold += silver;
    game.db.ledger(s.accountId, 'exchange', silver, `doubloons:${n}:${pid}`);
    game.saveSession(s);
    done = true;
  });
  if (!done) return 'Not enough doubloons: top up your account first.';
  trackEvent(game, s.accountId, 'buy', { amount: n, product: 'exchange:silver' });
  game.toastShip(s.ship, `Exchanged ${n} doubloons for ${silver} silver.`, 'gold');
  return null;
}

/** Her client's word: the exchange made or refused, its answer to her window (the balance and the purse after it). */
export function exchangeMessage(game: Game, s: PlayerSession, msg: { doubloons?: unknown; pid?: unknown }, after: () => void): void {
  const n = Number(msg.doubloons);
  const pid = String(msg.pid ?? '');
  if (!buyPace(game, s)) {
    game.sendTo(s, { t: 'premium_exchange', pid, doubloons: 0, silver: 0, why: 'Slowly: one purchase at a time.' });
    return;
  }
  const why = exchangeDoubloons(game, s, n, pid);
  if (why) game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
  game.sendTo(s, why ? { t: 'premium_exchange', pid, doubloons: 0, silver: 0, why } : { t: 'premium_exchange', pid, doubloons: n, silver: n * EXCHANGE_SILVER_PER_DOUBLOON });
  if (!why) game.pushSelf(s, true);
  after();
}
