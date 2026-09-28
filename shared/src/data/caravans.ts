// Caravans (docs/12 P8): a captain's own cargo hulls, berthed at her island, sailing on her business without her —
// hauling the outposts' stores home, selling the island's goods in a port, trading between ports, fetching what
// the island needs — under a skipper, with hired escorts and the League's insurance, on standing orders.

export type Tr = [string, string];
export type CaravanTask = 'haul' | 'sell' | 'trade' | 'supply';
export const CARAVAN_TASKS: CaravanTask[] = ['haul', 'sell', 'trade', 'supply'];
export type OnAttack = 'fight' | 'flee' | 'dump' | 'surrender';
export const ON_ATTACK: OnAttack[] = ['fight', 'flee', 'dump', 'surrender'];

export const TASK_NAMES: Record<CaravanTask, Tr> = {
  haul: ['Haul the outposts home', 'Вывоз с аванпостов'],
  sell: ['Sell the island’s goods in a port', 'Поставка в порт'],
  trade: ['Trade between ports', 'Торговый рейс'],
  supply: ['Buy in a port for the island', 'Снабжение острова'],
};

/** A hired escort for one voyage, by the caravan's level. */
export function escortCost(level: number): number {
  return 400 + 250 * level;
}
export const MAX_ESCORTS = 3;
/** A skipper hired for a caravan (a captive captain serves for nothing). */
export const SKIPPER_COST = 1000;
/** The League's insurance: this share of the cargo's worth at the start of a leg, and this share of a loss paid. */
export const INSURANCE_PREMIUM = 0.05;
export const INSURANCE_COVER = 0.6;
/** Trade voyages under the Counting House keystone: more profit. */
export const COUNTING_HOUSE_PROFIT = 0.15;
/** Hourly chance of an attack by the sea's pirates, by the waters. */
export const RISK: Record<string, number> = { safe: 0, contested: 0.06, lawless: 0.18 };
/** Owner within this reach: the attack is fought for real, with an alarm. */
export const RESCUE_R = 25000;
export const RESCUE_SEC = 300;

export function caravanPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const t of Object.values(TASK_NAMES)) out.push(t);
  out.push(
    ["{0}'s Caravan", 'Караван: {0}'],
    ['Caravan {0} sails: {1}.', '«{0}» выходит: {1}.'],
    ['Caravan {0} is home.', '«{0}» вернулся домой.'],
    ['Caravan {0} sold {1} {2} in {3} for {4} silver.', '«{0}» продал в {3}: {2} — {1} ед. за {4} серебра.'],
    ['Caravan {0} bought {1} {2} in {3}.', '«{0}» купил в {3}: {2} — {1} ед.'],
    ['Caravan {0} took on the store of the outpost on {1}.', '«{0}» принял склад аванпоста на острове {1}.'],
    ['Caravan {0} is attacked near {1}!', 'На «{0}» напали у острова {1}!'],
    ['Caravan {0} is attacked near {1}: come to the rescue — five minutes!', 'На «{0}» напали у острова {1}: на выручку — пять минут!'],
    ['Caravan {0} fought them off near {1}.', '«{0}» отбился у острова {1}.'],
    ['Caravan {0} was beaten near {1}: {2} ships lost, {3}% of the cargo saved.', '«{0}» разбит у острова {1}: потеряно кораблей — {2}, спасено {3}% груза.'],
    ['Caravan {0} is lost with all hands.', '«{0}» погиб со всей командой.'],
    ['The League pays {0} silver on the insurance of {1}.', 'Лига платит {0} серебра по страховке: «{1}».'],
    ['Only cargo hulls berthed at your island sail in a caravan.', 'В караван идут только грузовые корабли у причала вашего острова.'],
    ['Your island sends no more caravans: {0} at sea.', 'Ваш остров больше караванов не отправит: в море уже {0}.'],
    ['No such caravan', 'Такого каравана нет'],
    ['Caravan {0} is recalled.', '«{0}» отозван домой.'],
    ['A caravan wants a destination.', 'Каравану нужна цель.'],
    ['No outposts to haul from.', 'Нет аванпостов для вывоза.'],
    ['Nothing in the island’s store to sell.', 'На складе острова нечего продавать.'],
    ['{0} will not sell below {1}: the goods come home.', '«{0}» не продаёт дешевле {1}: товар возвращается домой.'],
    ['Skipper {0} takes the helm.', 'Шкипер {0} встаёт к штурвалу.'],
    ['The island’s store is full: caravan {0} lies at anchor with the rest.', 'Склад острова полон: «{0}» стоит на якоре с остатком груза.'],
  );
  return out;
}
