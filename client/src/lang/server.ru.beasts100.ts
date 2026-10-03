// The server's lines of the hundred creatures (owner, 2026-10-03; docs/18 VII), English → Russian: the premium shop's
// twenty kinds as a sentence counts them (they join an army, go to a pen, are let go, are hungry), the shop's tier
// gate, and why the tamer and the trading table pass them over. The world's armies' new kinds are named with their
// siblings (server.ru.h3.ts reads FACTION_NAMES).

import { PREMIUM_PLURAL } from '../../../shared/src/data/premiumbeasts.ts';

const names: Record<string, string> = {};
for (const [en, ru] of Object.values(PREMIUM_PLURAL)) names[en] = ru;

export const SERVER_RU_BEASTS100: Record<string, string> = {
  ...names,
  'Creatures of tier {0} serve a ship of level {1} and up.': 'Существа уровня {0} служат на корабле уровня {1} и выше.',
  'The {0} are hungry: fish for them in the hold, or they win no ranks.': '{0} голодны: держите для них рыбу в трюме, иначе им не расти в ранге.',
  'The tamer will not buy the shop’s creatures: doubloons never turn into silver.': 'Укротитель не покупает существ из лавки: дублоны не превращаются в серебро.',
  'The shop’s creatures do not change hands': 'Существа из лавки не переходят из рук в руки',
};
