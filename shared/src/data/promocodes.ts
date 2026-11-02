// Promo codes (owner, 2026-11-02: «добавим в игру возможность вставлять промокоды где-то в настройках. Отдельно функция
// промокоды. И сделаем три разных промокода. На что-то для новичков полезное»). A code is typed in «Настройки →
// Промокод» (client/src/ui/promocode.ts); the server (server/src/game/promocodes.ts) checks it and hands its rewards over
// the way the game's other rewards go: silver to the purse, doubloons through creditPremium (source 'gift', ref
// 'promo:<CODE>'), the shop's goods into their stores (grantGoods), the island's goods into its yard, goods into the hold
// and men by a letter. Each code once an account; an optional end, an optional top level, an optional cap on its uses.
// The words of the answers live in the client (client/src/lang/ui/promocode.ts): the server sends their keys.

import type { ShopGrant } from './shop.ts';
import type { UnitId } from './army.ts';
import type { GiftRes } from './dailygift.ts';

export interface PromoReward {
  /** Silver into her purse. */
  silver?: number;
  /** Doubloons to her account (creditPremium, source 'gift'). */
  doubloons?: number;
  /** The shop's own goods: speed-ups, repair kits, the elixir of experience, charms, scrolls, a treasure map… */
  grants?: ShopGrant[];
  /** The island's goods into its yard (no island yet: paid in silver at their worth, as the daily gift does). */
  res?: Partial<Record<GiftRes, number>>;
  /** Goods into her hold (no room for them: paid in silver at their base price). */
  cargo?: { good: 'provisions' | 'planks' | 'sailcloth'; n: number }[];
  /** Men by a letter: a stack of their own (a gift's: its losses are never made good), taken in any port. */
  unit?: { u: UnitId; n: number };
}

export interface PromoCode {
  /** Upper-case Latin and digits, as she types it (case and spaces do not matter). */
  code: string;
  rewards: PromoReward;
  /** Taken until this moment (wall ms; none: no end). */
  until?: number;
  /** Only for captains of this level or lower. */
  maxLevel?: number;
  /** All the accounts together may take it so many times at most. */
  cap?: number;
}

/** Through the 31st of January 2027 (Moscow): far enough for the winter's newcomers. */
const UNTIL = Date.UTC(2027, 0, 31, 21, 0, 0);

export const PROMO_CODES: readonly PromoCode[] = [
  // 1. «Первый рейс»: the start — silver, food for the crew, stores to mend her and two repair kits.
  {
    code: 'PERVYYREYS',
    rewards: {
      silver: 5_000,
      cargo: [{ good: 'provisions', n: 50 }, { good: 'planks', n: 20 }, { good: 'sailcloth', n: 20 }],
      grants: [{ k: 'kit', n: 2 }],
    },
    until: UNTIL,
    maxLevel: 15,
  },
  // 2. «Морской волк»: the army — a gift stack of eight musketeers, two hours of the elixir of experience, three charms.
  {
    code: 'MORSKOYVOLK',
    rewards: {
      unit: { u: 'musketeer', n: 8 },
      grants: [{ k: 'xp', hours: 2 }, { k: 'charm', n: 3 }],
    },
    until: UNTIL,
    maxLevel: 15,
  },
  // 3. «GRAVETIDE2026»: the island — two hours of speed-ups, a treasure map, timber, coal and iron for the first
  //    buildings, and 50 doubloons.
  {
    code: 'GRAVETIDE2026',
    rewards: {
      doubloons: 50,
      grants: [{ k: 'speed', min: 120 }, { k: 'map', n: 1 }],
      res: { timber: 200, coal: 100, iron: 50 },
    },
    until: UNTIL,
  },
];

/** How a code is typed: trimmed, inner spaces and dashes dropped, upper case (Cyrillic look-alikes made Latin). */
export function normCode(raw: unknown): string {
  const LOOK: Record<string, string> = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X' };
  return String(raw ?? '')
    .slice(0, 64)
    .toUpperCase()
    .replace(/[\s\-_]+/g, '')
    .replace(/[АВЕКМНОРСТУХ]/g, (c) => LOOK[c] ?? c)
    .slice(0, 32);
}

export function promoByCode(code: string): PromoCode | undefined {
  const c = normCode(code);
  return PROMO_CODES.find((p) => p.code === c);
}

/** Tries a captain may make, and in how long (brute force kept off). */
export const PROMO_TRIES = 10;
export const PROMO_TRY_WINDOW = 10 * 60_000;

/** Why a code is refused (the client's words by these keys). */
export type PromoWhy = 'unknown' | 'used' | 'expired' | 'level' | 'cap' | 'rate' | 'fight' | 'empty' | 'signin';

/** What a code really handed over (shown in its result line). */
export interface PromoGot {
  silver?: number;
  doubloons?: number;
  speed?: number;
  kit?: number;
  xp?: number;
  charm?: number;
  scrolls?: number;
  map?: number;
  res?: Partial<Record<GiftRes, number>>;
  cargo?: Partial<Record<'provisions' | 'planks' | 'sailcloth', number>>;
  unit?: { u: UnitId; n: number };
}

/** The server's answer to a typed code. */
export type PromoResult = { ok: true; code: string; got: PromoGot } | { ok: false; code: string; why: PromoWhy; maxLevel?: number; wait?: number };

/** The letter that brings a code's men. */
export const PROMO_LETTER = {
  subject: 'Promo code reward',
  body: 'Men of your promo code: a stack of their own. Collect this letter in any port; if there is no room aboard, make room in the Crew window.',
};
/** A map that finds no room in her chest is paid in silver. */
export const PROMO_MAP_SILVER = 1_000;

/** The server's words of promo codes in Russian (client/src/lang/server.ts TABLE). */
export function promoPatterns(): [string, string][] {
  return [
    [PROMO_LETTER.subject, 'Награда за промокод'],
    [PROMO_LETTER.body, 'Бойцы по вашему промокоду — отдельным отрядом. Заберите письмо в любом порту; если на корабле нет места, освободите его в окне «Команда».'],
    ['Promo code', 'Промокод'],
    ['Promo codes taken: {0}.', 'Промокоды активированы: {0}.'],
    ['Usage: /promo list|stats|grant CODE name', 'Формат: /promo list|stats|grant КОД имя'],
    ['No captain aboard by that name: {0}.', 'Капитана с таким именем нет в игре: {0}.'],
    ['The code is refused for {0}: {1}.', 'Код не выдан капитану {0}: {1}.'],
    ['Code {0} granted to {1}.', 'Код {0} выдан капитану {1}.'],
    ['Promo codes (≤ top level, ⌛ until, × taken): {0}.', 'Промокоды (≤ макс. уровень, ⌛ срок, × активаций): {0}.'],
  ];
}
