// «Причал» (forum, Нефигугум 2026-10-30, post 26): her stored ships. The owner's numbers (2026-10-30): three berths free («сделай 3 места бесплатно»),
// one more for BERTH_PRICE doubloons each, BERTHS_CAP in all (server/src/game/shipbuilding.ts berthCap;
// client/src/ui/berths.ts).

export const BERTHS_FREE = 3;
export const BERTHS_CAP = 10;
export const BERTH_PRICE = 300;

/** «Пересесть» takes time (forum 40, approved by the owner: «время на смену корабля … 2 минуты, как для смены флага»):
 *  the berthed ship sails round to her from where she lay and is changed into when she comes, if she is still in that
 *  harbour (server/src/game/shipbuilding.ts callBerth / berthCallSecond). */
export const BERTH_CALL_MS = 120_000;
