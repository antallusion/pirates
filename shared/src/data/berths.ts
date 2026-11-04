// «Причал» (forum, Нефигугум 2026-10-30, post 26): her stored ships. The owner's numbers (2026-10-30): three berths free («сделай 3 места бесплатно»),
// one more for BERTH_PRICE doubloons each, BERTHS_CAP in all (server/src/game/shipbuilding.ts berthCap;
// client/src/ui/berths.ts).

import { ferryPrice } from './ferry.ts';

export const BERTHS_FREE = 3;
export const BERTHS_CAP = 10;
export const BERTH_PRICE = 300;

/** «Пересесть» takes time (forum 40, approved by the owner: «время на смену корабля … 2 минуты, как для смены флага»):
 *  the berthed ship sails round to her from where she lay and is changed into when she comes, if she is still in that
 *  harbour (server/src/game/shipbuilding.ts callBerth / berthCallSecond). */
export const BERTH_CALL_MS = 120_000;

// A berthed ship lies in THE PORT she was left in (forum, Эдуард, post 70: «берём быстрый пустой корабль, плывём в
// дальний угол карты, вызываем крутой боевой корабль, и он появляется через 2 минуты на другом конце света»). She is
// changed into only there; from any other harbour she may be sent for — «Перегнать сюда»: a delivery crew sails her
// round for the ferry's price between the two harbours (ferry.ts ferryPrice, by the straight distance) and in time by
// the distance (BERTH_MOVE_MS_PER_KM, never under BERTH_MOVE_MIN_MS); she comes into this harbour's berth.

/** A minute for every two kilometres of the straight line, at least ten minutes. */
export const BERTH_MOVE_MS_PER_KM = 30_000;
export const BERTH_MOVE_MIN_MS = 10 * 60_000;

/** The delivery of a berthed ship over `metres`: its price (the ferry's) and how long it takes (ms). */
export function berthMoveQuote(metres: number): { price: number; ms: number } {
  const km = Math.max(0, metres) / 1000;
  return { price: ferryPrice(metres), ms: Math.max(BERTH_MOVE_MIN_MS, Math.round(km * BERTH_MOVE_MS_PER_KM)) };
}

// The men over a smaller hull's hammocks (forum, Эдуард, post 72: «игра предложит уволить 170, и их уже не вернуть»):
// nobody is paid off any more. Changing into a berthed ship, they stay aboard the ship left at the berth (she keeps her
// crew; changing back, they come aboard again as far as there is room). A hull traded in at the yard: they wait ashore
// in that port — «Ваши люди на берегу» in its tavern — for ASHORE_DAYS and sign on again free when there is room.
export const ASHORE_DAYS = 7;
export const ASHORE_MS = ASHORE_DAYS * 86_400_000;
