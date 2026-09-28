// Captive captains in service (docs/12 P10 #16): a captain taken at a boarding may be ransomed, handed over — or turned.
// He signs on as an officer with his own traits (and the mark of a former enemy), or as a skipper of her caravans with
// a skipper's gifts; his loyalty decides whether he signs, refuses, or slips his irons and is gone; and a skipper of low
// loyalty may one day sail off with a hull of her caravan.

import type { OfficerRole } from './crew.ts';

type Tr = [string, string];

export type SkipperTrait = 'navigator' | 'trader' | 'wary' | 'light_fingered';

export const SKIPPER_TRAITS: Record<SkipperTrait, { name: Tr; text: Tr; good: boolean }> = {
  navigator: { name: ['Navigator', 'Штурман'], text: ['Her caravans sail 12% faster', 'Караваны идут на 12% быстрее'], good: true },
  trader: { name: ['Trader', 'Торгаш'], text: ['Sells 6% dearer', 'Продаёт на 6% дороже'], good: true },
  wary: { name: ['Wary', 'Осторожный'], text: ['Pirates find the caravan 30% less often', 'Пираты находят караван на 30% реже'], good: true },
  light_fingered: { name: ['Light-fingered', 'Нечист на руку'], text: ['5% of every sale sticks to his fingers', '5% каждой продажи прилипает к его рукам'], good: false },
};
export const SKIPPER_TRAIT_IDS = Object.keys(SKIPPER_TRAITS) as SkipperTrait[];

/** What a skipper's gifts do to a caravan. */
export const SKIPPER_SPEED = 1.12;
export const SKIPPER_SALE = 1.06;
export const SKIPPER_RISK = 0.7;
export const SKIPPER_SKIM = 0.95;

/** The officer a taken captain makes, by what he commanded. */
export function captiveRoles(npcRole: string): OfficerRole[] {
  switch (npcRole) {
    case 'pirate': return ['master_gunner', 'boatswain', 'lieutenant'];
    case 'merchant': return ['quartermaster', 'pilot', 'sailmaker'];
    case 'patrol': case 'hunter': case 'escort': return ['lieutenant', 'master_gunner', 'pilot'];
    case 'fisher': return ['harpooner', 'pilot'];
    default: return ['boatswain', 'lieutenant'];
  }
}

/** A signing bounty for every rate of the ship he lost. */
export const TURN_COST_PER_TIER = 150;
/** Below this loyalty a refusal may be an escape (one time in two); a skipper below that may run off with a hull. */
export const ESCAPE_BELOW = 25;
export const ESCAPE_CHANCE = 0.5;
export const DESERT_BELOW = 35;
export const DESERT_CHANCE = 0.25;
/** Loyalty a captive gains each game day in irons (up to), and a skipper with each voyage home. */
export const LOYALTY_PER_DAY = 5;
export const LOYALTY_DAYS_MAX = 20;
export const LOYALTY_PER_VOYAGE = 6;
export const MAX_SKIPPERS = 5;

export function turncoatPatterns(): [string, string][] {
  return [
    ['{0} signs the articles: your {1}.', 'Капитан {0} подписал договор: теперь он ваш {1}.'],
    ['{0} will skipper your caravans.', 'Капитан {0} будет водить ваши караваны.'],
    ['{0} spits on the deck: not yet.', 'Капитан {0} плюёт на палубу: не сейчас.'],
    ['{0} slips his irons in the night and is gone.', 'Капитан {0} ночью сбросил кандалы и сбежал.'],
    ['He will not hear of it again today.', 'Сегодня он и слушать об этом не станет.'],
    ['No such captive', 'Нет такого пленника'],
    ['You have skippers enough.', 'Шкиперов у вас достаточно.'],
    ['Skipper {0} took the {1} and ran.', 'Шкипер {0} увёл «{1}» и сбежал.'],
    ['{0} is clapped in irons below.', 'Капитан {0} в кандалах в трюме.'],
    ['Your ship has berths for {0} officers', 'На вашем корабле мест для офицеров: {0}'],
    ['{0} watches the horizon for his old flag. (Loyalty {1} — a game day to win him back.)', '{0} всё высматривает на горизонте свой старый флаг. (Верность {1} — нужен игровой день, чтобы вернуть его.)'],
  ];
}
