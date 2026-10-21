// The premium captains cost money (owner, 2026-10-19: «Сейчас премиум героев можно на старте выбрать бесплатно, а они
// должны стоить денег. Примерно 2500 руб за героя»). Before she takes command the choice screen asks which premium
// captains her account owns; one is bought for CAPTAIN_PRICE doubloons (the shop's own top-up when short: the `premium`
// stars invoice, then this buy again — client/src/ui/price.ts topUpThenBuy). Owned is a ledger row of its own,
// `doubloons_captain` with the captain's id, so the purchase and the ownership are one transaction and a database
// keeps it with the account. The server refuses a premium captain her account does not own (onCreateCaptain); a
// captain picked free before the change stays hers — the check is at the choice only, never on a saved captain.

import { lackDoubloons } from '../../../shared/src/data/buyfail.ts';
import { CAPTAINS, CAPTAIN_IDS, captainPrice } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { move, paymentsOpen, sendBalance, webPayOpen } from './premium.ts';
import { trackEvent } from './liveops.ts';

/** The ledger's kind of a captain's purchase (or grant): its detail is the captain's id. */
export const CAPTAIN_KIND = 'doubloons_captain';

/** Whether her account may take this captain: a free one always, a premium one once bought (or granted). */
export function ownsCaptain(game: Game, accountId: number, id: CaptainId): boolean {
  if (!Object.hasOwn(CAPTAINS, id)) return false;
  if (!CAPTAINS[id].premium) return true;
  return game.db.doubloonRef(accountId, CAPTAIN_KIND, id);
}

/** The premium captains her account owns. */
export function ownedCaptains(game: Game, accountId: number): CaptainId[] {
  return CAPTAIN_IDS.filter((id) => CAPTAINS[id].premium && ownsCaptain(game, accountId, id));
}

/** A premium captain given without pay (the tester's console, the tests, a support's grant): a ledger row of nought. */
export function grantCaptain(game: Game, accountId: number, id: CaptainId): void {
  if (!CAPTAINS[id]?.premium || ownsCaptain(game, accountId, id)) return;
  game.db.ledger(accountId, CAPTAIN_KIND, 0, id);
}

/** Her account's captains, its doubloons and whether payments are open, to the choice screen. */
export function sendCaptainShop(game: Game, s: PlayerSession, o: { bought?: CaptainId; why?: string } = {}): void {
  game.sendTo(s, { t: 'captain_shop', owned: ownedCaptains(game, s.accountId), balance: game.db.doubloons(s.accountId), pay: paymentsOpen(game), web: webPayOpen(game, s.accountId), ...(o.bought ? { bought: o.bought } : {}), ...(o.why ? { why: o.why } : {}) });
}

/** A premium captain bought for doubloons (null: done; else why not — every check before a coin moves). */
export function buyCaptain(game: Game, s: PlayerSession, id: CaptainId): string | null {
  return buyCaptainFor(game, s.accountId, id);
}

/** The same purchase by the account alone (the website's shop delivers it so, aboard or not: server/src/game/webshop.ts). */
export function buyCaptainFor(game: Game, accountId: number, id: CaptainId): string | null {
  if (!Object.hasOwn(CAPTAINS, id)) return 'Unknown captain';
  if (!CAPTAINS[id].premium) return 'That captain is free to choose';
  if (ownsCaptain(game, accountId, id)) return 'That captain is yours already';
  const price = captainPrice(id);
  if (game.db.doubloons(accountId) < price) return `${lackDoubloons(price, game.db.doubloons(accountId))} — top up your account first.`;
  if (move(game, accountId, -price, CAPTAIN_KIND, id) === null) return 'Not enough doubloons: top up your account first.';
  trackEvent(game, accountId, 'buy', { amount: price, product: `captain:${id}` }); // docs/34: the funnel's purchases
  return null;
}

/** The choice screen's word: `view`, or `buy` a captain (the answer comes back either way, a refusal in its `why`). */
export function captainShopMessage(game: Game, s: PlayerSession, msg: { action: 'view' | 'buy'; captain?: CaptainId }): void {
  if (msg.action !== 'buy') return sendCaptainShop(game, s);
  const why = buyCaptain(game, s, msg.captain as CaptainId);
  if (!why) sendBalance(game, s);
  sendCaptainShop(game, s, why ? { why } : { bought: msg.captain });
}
