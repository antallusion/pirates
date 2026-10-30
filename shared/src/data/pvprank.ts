// PvP points and the monthly season (owner, 2026-10-30: «введи еще рейтинг пвп, показывай его в статистике типа сколько
// заработано баллов, сколько убито игроков, сделай какие-то ежемесячные награды … это должно на сайте в рейтинге тоже
// отображаться»). The rules and numbers, shared by the server (server/src/game/pvprank.ts), the game's «ПвП» page and
// the site's board. Only victories over other CAPTAINS count; NPCs never do.
//
//  - A captain sunk 10, taken by boarding 14, a 1v1 duel won 5; a guild war's kill ×1.5.
//  - Scaled by the victim's strength against yours (battle rating; a duel: the levels): ratio^0.8, at most ×2.5; under
//    half your strength (the minnow) nothing.
//  - The same victim within 24 h: ×1 → ×0.5 → ×0.25 → nothing.
//  - Nothing at all (and no kill, no death counted) between captains of one group, one guild or its allies, friends on
//    either list, captains tied by a barter or a voyage together in the last day, or two sessions from one address.
//  - An assist (her shots landed in the last minute, another captain sank her): 40% of what the kill would pay her.
//  - The season is the calendar month, Moscow time (UTC+3); at its turn the top ten and everyone of 50 points are paid
//    by letter (silver) and to the account (doubloons), the top three wear their season's title through the next month
//    and keep the season's banner for good.

export const PVP_POINTS = { sunk: 10, boarded: 14, duel: 5 } as const;
export const PVP_WAR_MUL = 1.5;
export const PVP_ASSIST_SHARE = 0.4;
export const PVP_ASSIST_WINDOW_S = 60;
/** The same victim within PVP_REPEAT_MS: the 1st, 2nd, 3rd, 4th+ win's share. */
export const PVP_REPEAT = [1, 0.5, 0.25, 0] as const;
export const PVP_REPEAT_MS = 24 * 3_600_000;
/** Under this share of her strength: a minnow, no points. */
export const PVP_MINNOW = 0.5;
export const PVP_MUL_MAX = 2.5;
/** Points a captain needs for any of the month's rewards. */
export const PVP_REWARD_MIN = 50;
/** Moscow time: UTC+3 the year round. */
export const MSK_MS = 3 * 3_600_000;

/** The strength multiplier: the victim's strength over the winner's. */
export function strengthMul(ratio: number): number {
  if (!(ratio >= PVP_MINNOW)) return 0;
  return Math.min(PVP_MUL_MAX, ratio ** 0.8);
}

export type PvpWin = 'sunk' | 'boarded' | 'duel';

/** A victory's points: its kind, the strength ratio, how many times this victim was beaten in the last day already, a
 *  guild war's kill. */
export function winPoints(kind: PvpWin, ratio: number, repeats: number, war = false): number {
  const rep = PVP_REPEAT[Math.min(PVP_REPEAT.length - 1, Math.max(0, Math.floor(repeats)))];
  return Math.round(PVP_POINTS[kind] * strengthMul(ratio) * rep * (war && kind !== 'duel' ? PVP_WAR_MUL : 1));
}

/** An assist's points (of what the kill would have paid her). */
export function assistPoints(kind: 'sunk' | 'boarded', ratio: number, repeats: number, war = false): number {
  return Math.round(winPoints(kind, ratio, repeats, war) * PVP_ASSIST_SHARE);
}

// ------------------------------------------------------------------------------------------------ the month

/** The season's id: the calendar month in Moscow (year × 12 + month). */
export function monthOf(wallMs: number): number {
  const d = new Date(wallMs + MSK_MS);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** When a season begins (wall ms, UTC). */
export function monthStart(m: number): number {
  return Date.UTC(Math.floor(m / 12), m % 12, 1) - MSK_MS;
}

/** «2026-10». */
export function monthLabel(m: number): string {
  return `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
}

/** Whole days left in the season (the last day: 1). */
export function daysLeft(wallMs: number): number {
  return Math.max(1, Math.ceil((monthStart(monthOf(wallMs) + 1) - wallMs) / 86_400_000));
}

export const MONTH_NAMES: [string, string][] = [
  ['January', 'Январь'], ['February', 'Февраль'], ['March', 'Март'], ['April', 'Апрель'], ['May', 'Май'], ['June', 'Июнь'],
  ['July', 'Июль'], ['August', 'Август'], ['September', 'Сентябрь'], ['October', 'Октябрь'], ['November', 'Ноябрь'], ['December', 'Декабрь'],
];

// ------------------------------------------------------------------------------------------------ the rewards

/** The season's titles (cosmetics.ts TITLES, `only: PVP_SEASON`) by place, worn through the next month. */
export const PVP_SEASON = 'pvp_season';
export const PVP_TITLES = ['pvp1', 'pvp2', 'pvp3'] as const;
/** The season's banner (a flag's cloth): the top three's for good. */
export const PVP_CLOTH = 'pvp';

export interface PvpReward {
  place: number;
  silver: number;
  doubloons: number;
  /** The season's title (cosmetics' id) through the next month. */
  title?: (typeof PVP_TITLES)[number];
  /** The season's banner, for good. */
  banner?: boolean;
}

/** Places 1–10 (each needs PVP_REWARD_MIN points). */
export const PVP_REWARDS: PvpReward[] = [
  { place: 1, silver: 30_000, doubloons: 500, title: 'pvp1', banner: true },
  { place: 2, silver: 25_000, doubloons: 300, title: 'pvp2', banner: true },
  { place: 3, silver: 22_000, doubloons: 200, title: 'pvp3', banner: true },
  { place: 4, silver: 20_000, doubloons: 50 },
  { place: 5, silver: 16_000, doubloons: 40 },
  { place: 6, silver: 13_000, doubloons: 30 },
  { place: 7, silver: 10_000, doubloons: 25 },
  { place: 8, silver: 8_000, doubloons: 20 },
  { place: 9, silver: 6_000, doubloons: 20 },
  { place: 10, silver: 5_000, doubloons: 20 },
];

/** Everyone else of PVP_REWARD_MIN points: a share of silver. */
export const PVP_PARTICIPATION = { silver: 3_000 } as const;

/** What a place pays (null: nothing — under the minimum). */
export function rewardFor(place: number, points: number): PvpReward | null {
  if (points < PVP_REWARD_MIN || place < 1) return null;
  return PVP_REWARDS.find((r) => r.place === place) ?? { place, silver: PVP_PARTICIPATION.silver, doubloons: 0 };
}

// ------------------------------------------------------------------------------------------------ the server's words

export const PVP_LETTER_FROM = 'The Admiralty of the Sea';
export const PVP_LETTER_FROM_RU = 'Адмиралтейство моря';

/** Everything the server says about PvP points (English → Russian; {0}… are the parts). */
export function pvpRankPatterns(): [string, string][] {
  return [
    [PVP_LETTER_FROM, PVP_LETTER_FROM_RU],
    ['PvP: +{0} points for {1}.', 'ПвП: +{0} очк. за капитана {1}.'],
    ['PvP: +{0} points, an assist on {1}.', 'ПвП: +{0} очк. за помощь в бою с {1}.'],
    ['PvP: +{0} points for the duel with {1}.', 'ПвП: +{0} очк. за дуэль с {1}.'],
    ['PvP: no points for {0} — she was far weaker than you.', 'ПвП: за {0} очков нет — противник намного слабее вас.'],
    ['PvP: no points for {0} — beaten too often today.', 'ПвП: за {0} очков нет — сегодня вы побеждали его слишком часто.'],
    ['PvP season {0}: place {1}', 'ПвП-сезон {0}: место {1}'],
    ['PvP season {0}: your share', 'ПвП-сезон {0}: ваша доля'],
    ['The PvP season {0} is over. You took place {1} with {2} points. Enclosed: {3} silver.', 'ПвП-сезон {0} завершён. Вы заняли {1} место, набрав {2} очк. В письме: {3} серебра.'],
    ['The PvP season {0} is over. You took place {1} with {2} points. Enclosed: {3} silver; {4} doubloons are on your account.', 'ПвП-сезон {0} завершён. Вы заняли {1} место, набрав {2} очк. В письме: {3} серебра; {4} дублонов зачислено на счёт.'],
    ['The PvP season {0} is over. You took place {1} with {2} points. Enclosed: {3} silver; {4} doubloons are on your account. The title «{5}» is yours for the month, and the season’s banner for good.', 'ПвП-сезон {0} завершён. Вы заняли {1} место, набрав {2} очк. В письме: {3} серебра; {4} дублонов зачислено на счёт. Звание «{5}» — ваше на весь месяц, а знамя сезона — навсегда.'],
    ['The PvP season {0} is over. 1st {1}, 2nd {2}, 3rd {3}.', 'ПвП-сезон {0} завершён. 1-е место — {1}, 2-е — {2}, 3-е — {3}.'],
    ['The PvP season {0} is over. The champion: {1}.', 'ПвП-сезон {0} завершён. Чемпион — {1}.'],
    ['The season’s title «{0}» is yours this month.', 'Звание сезона «{0}» ваше на этот месяц.'],
    ['The season’s banner is yours.', 'Знамя сезона теперь ваше.'],
    ['PvP: {0} points this month, {1} in all.', 'ПвП: {0} очк. в этом месяце, {1} за всё время.'],
    ['PvP season {0} closed.', 'ПвП-сезон {0} закрыт.'],
  ];
}
