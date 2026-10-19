// The premium shop's catalogue (owner, 2026-10-15: «премиум магазин с возможностью нанимать дополнительных рабочих …
// продавать там паки ресурсов, ускорителей … отсортирован вкладками "море", "абордаж", "остров" … прям все отдельно
// продавать и разными паками»). Everything here is sold for doubloons only (the top-up for Telegram Stars is
// premium.ts DOUBLOON_PACKS); every price is read by the server from this table — a client never names one. The
// premium hulls and creatures stay in their own tables (ShipClassDef.premium, UnitDef.premium) and the shop's window
// shows them beside these goods. docs/32_PREMIUM_SHOP.md has the table in Russian with the reasoning.
//
// A family is one kind of goods on one card (its name, its picture, what it does) and its offers — the single and
// the packs, the larger the better the price (`offerBonus`). Bundles (the starter, the week's chest, the captain's
// subscription, a level's gift, the deal of the day) are families of the «Акции» row, shown on top of every tab.

import type { AmmoId } from './ships.ts';
import type { BaseRes } from './base.ts';
import type { GoodId } from './goods.ts';
import { cosFamilies } from './cosmetics.ts';

type Tr = [string, string];

export type ShopTab = 'sea' | 'board' | 'isle' | 'cos';
export const SHOP_TABS: ShopTab[] = ['sea', 'board', 'isle', 'cos'];

/** The shelves of a tab, in their order (`deals` — the «Акции» row on top of every tab). */
export type ShopSec = 'deals' | 'ships' | 'supply' | 'voyage' | 'units' | 'recruit' | 'battle' | 'build' | 'res' | 'isle'
  | 'cos_titles' | 'cos_frames' | 'cos_flags' | 'cos_trails' | 'cos_emotes' | 'cos_sets';
export const TAB_SECS: Record<ShopTab, ShopSec[]> = {
  sea: ['ships', 'supply', 'voyage'],
  board: ['units', 'recruit', 'battle'],
  isle: ['build', 'res', 'isle'],
  // docs/32 §12: cosmetics other captains see (shared/src/data/cosmetics.ts) — no «Акции» row on this tab
  cos: ['cos_titles', 'cos_frames', 'cos_flags', 'cos_trails', 'cos_emotes', 'cos_sets'],
};

/** What an offer hands over (server/src/game/shop.ts grants it through the game's own systems). */
export type ShopGrant =
  /** Minutes into her bank of speed-ups (spent on the island's work and the yard's refit, a job at a time). */
  | { k: 'speed'; min: number }
  /** A hired builders' brigade for so many days (a second at once at most; a third extends the sooner). */
  | { k: 'builder'; days: number }
  /** A builders' brigade of her own for good (two at most). */
  | { k: 'perm' }
  /** Goods into her island's yard (past its cap: the shop's barge unloads it all). */
  | { k: 'res'; good: BaseRes; n: number }
  /** Her island's producers +PROD_BOOST for so many hours. */
  | { k: 'prod'; hours: number }
  /** No raid and no robber lands on her island for so many hours. */
  | { k: 'shield'; hours: number }
  /** A charter for one move of her island without its fee. */
  | { k: 'move' }
  /** Battle experience +XP_BOOST for so many hours. */
  | { k: 'xp'; hours: number }
  /** A fair wind: +WIND_BOOST speed out of a fight for so many hours. */
  | { k: 'wind'; hours: number }
  /** Charms: +1 luck and +CHARM_MORALE morale for one boarding against the sea's ships (never against a captain). */
  | { k: 'charm'; n: number }
  /** Repair kits: hull, canvas, rudder and guns made whole at once, out of a fight. */
  | { k: 'kit'; n: number }
  /** Auto-battle scrolls (the account's, autoscroll.ts). */
  | { k: 'scrolls'; n: number }
  /** Scrolls of her path's book, pages drawn for her ship's level (pathbook.ts giveScroll). */
  | { k: 'pages'; n: number }
  /** One artifact from a hoard's table (hero.ts artifactFind). */
  | { k: 'art' }
  /** Shot into her magazine. */
  | { k: 'ammo'; ammo: AmmoId; n: number }
  /** Goods into her hold (there must be room for them). */
  | { k: 'cargo'; good: GoodId; n: number }
  /** Hands signed on (deckhands), into her free hammocks up to so many. */
  | { k: 'crew'; n: number }
  /** Fighters of a tier's line kind (RECRUIT_KINDS) into her free hammocks up to so many, sold from the ship level a
   *  premium kind of that tier is. */
  | { k: 'units'; tier: number; n: number }
  /** Her fallen stand again at once, anywhere out of a fight (REFILL_RATE; docs/35, her record of the fallen). */
  | { k: 'refill' }
  /** docs/35: scrolls of resurrection — one raises a stack of the line kinds, anywhere out of a fight. */
  | { k: 'rscroll'; n: number }
  /** Her infamy struck off to a stranger's (ports.ts pardon, without the port). */
  | { k: 'pardon' }
  /** Treasure maps of her waters' tier. */
  | { k: 'map'; n: number }
  /** Parts of a ship's look not yet hers, drawn at random from the shop's own (never a deed's). */
  | { k: 'looks'; n: number }
  /** The captain's subscription for so many days (SUB_*). */
  | { k: 'sub'; days: number }
  /** Cosmetics (docs/32 §12): ownership keys `kind:id` (`pack:<id>` an emote pack's four), the account's for good. */
  | { k: 'cos'; keys: string[] };

export interface ShopOffer {
  id: string;
  /** In doubloons. */
  price: number;
  grants: ShopGrant[];
  /** How often she may buy it: once a day, a week, ever. */
  limit?: { n: number; per: 'day' | 'week' | 'ever' };
  /** A bundle's worth at the shop's single prices (its «выгода» badge). */
  worth?: number;
  /** The card's ribbon. */
  tag?: 'best' | 'hot';
  /** A seasonal offer: on the shelf only between these (wall ms, UTC); its card counts down to `until`. */
  from?: number;
  until?: number;
}

export interface ShopFamily {
  id: string;
  tabs: ShopTab[];
  sec: ShopSec;
  /** An icon of the manifest (icon.<name>), or `unit:<id>` for a creature's face. */
  icon: string;
  name: Tr;
  text: Tr;
  offers: ShopOffer[];
  /** A level's gift: shown only for the captain who reached it, for LEVEL_OFFER_H hours. */
  level?: number;
}

// ------------------------------------------------------------------------------------------------ the numbers

/** Battle experience +50 % while the elixir lasts (the subscription adds SUB_XP on top). */
export const XP_BOOST = 0.5;
/** A fair wind: +10 % speed, out of a fight only (docs/32: never a chase's or an escape's edge). */
export const WIND_BOOST = 0.1;
/** The harvest: producers +50 %. */
export const PROD_BOOST = 0.5;
/** A charm's morale. */
export const CHARM_MORALE = 15;
/** Brigades: two of her own for good and two hired at once at most. */
export const PERM_MAX = 2;
export const TEMP_MAX = 2;
/** The island's charter of protection runs no more than two weeks ahead; the boosts no more than thirty days. */
export const SHIELD_MAX_H = 14 * 24;
export const BOOST_MAX_H = 30 * 24;
/** The captain's subscription: 30 days, at most 60 ahead; every day she comes aboard: doubloons and an auto-battle
 *  scroll; while it runs, one more brigade and +20 % battle experience. */
export const SUB_DAYS = 30;
export const SUB_MAX_DAYS = 60;
export const SUB_DAILY = 100;
export const SUB_SCROLLS = 1;
export const SUB_XP = 0.2;
/** A level's gift stays on the shelf three days from the level reached. */
export const LEVEL_OFFER_H = 72;
/** The deal of the day: one offer of DEAL_POOL at this share off, once a day. */
export const DEAL_OFF = 0.4;
/** The first top-up for Stars comes double, the gift up to this many doubloons. */
export const FIRST_PAY_CAP = 2600;
/** The infirmary takes back the fallen of a boarding against the sea for this long after it, at this share of the
 *  line kinds' worth (REFILL_RATE doubloons a thousand silver of men). */
export const REFILL_MINUTES = 60;
export const REFILL_RATE = 16;
/** «Завершить сейчас»: doubloons a minute of work left (36 an hour), and never under the shop's least price (owner,
 *  2026-10-15: «цены должны начинаться от 290 рублей») — 290 finishes up to eight hours, as the 290 speed-ups do. */
export const FINISH_PER_MIN = 0.6;
/** Every price of the shop is between these (owner, 2026-10-15: «от 290 рублей и до 9900 рублей»; a doubloon ≈ 1 ₽). */
export const PRICE_MIN = 290;
export const PRICE_MAX = 9900;
/** The ladder every line climbs, and the bonus each step gives against the line's first (honest: the quantities are
 *  reckoned from the line's single price and this bonus, offerBonus shows what came of the rounding). */
export const LADDER = [290, 590, 990, 1990, 4990, 9900];
export const STEP_BONUS: Record<number, number> = { 290: 0, 590: 0.1, 990: 0.2, 1990: 0.35, 2990: 0.4, 4990: 0.5, 9900: 0.7 };
/** A premium creature by packs of stacks: the first as many stacks as reach PRICE_MIN, then three and five times
 *  that, these shares off. */
export const UNIT_PACK_OFF = [0, 0.08, 0.15];
/** Buys a captain may send: so many in two seconds, so many a minute (the session's flood guard is far above). */
export const BUY_BURST = 5;
export const BUY_MINUTE = 40;

/** Doubloons to finish a work of `secs` now. */
export function finishPrice(secs: number): number {
  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.ceil((Math.max(0, secs) / 60) * FINISH_PER_MIN)));
}

/** A premium creature's packs for a stack of this price: its stacks and the pack's price. */
export function unitPacks(price: number): { k: number; price: number }[] {
  const k1 = Math.max(1, Math.ceil(PRICE_MIN / Math.max(1, price)));
  return [k1, k1 * 3, k1 * 5].map((k, i) => ({ k, price: Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.round(price * k * (1 - UNIT_PACK_OFF[i])))) }));
}

/** The line kind of each tier the recruiters sign on (army.ts TIER_BASE). */
export const RECRUIT_KINDS = ['deckhand', 'marine', 'musketeer', 'gunner', 'boarder', 'guard', 'drowned'] as const;
/** Their silver worth a man (UNITS[..].cost), kept here so the catalogue is pure. */
const RECRUIT_COST = [20, 60, 70, 120, 180, 300, 450];
/** Silver of men a doubloon signs on (a recruit's pack up to so many: 290 → ~11 600 silver of men, an hour or two of
 *  the waters' income at the middle levels — docs/32). */
const RECRUIT_SILVER = 40;

/** The single price of each kind of goods (doubloons a unit of its measure): the base the ladders and the bundles'
 *  worth are reckoned from. */
export const UNIT_PRICE = {
  speed: 0.6, // a minute
  builder: 90, // a day
  perm: 1990,
  timber: 0.075, coal: 0.075, provisions: 0.075, tar: 0.09, iron: 0.11, // a unit into the yard
  prod: 90 / 24, shield: 80 / 24, xp: 30, wind: 20, // an hour
  move: 2490, charm: 17, kit: 27, scrolls: 20, pages: 26, art: 150, map: 58, looks: 15,
  crate: 20, crate2: 35, // a crate of shot
  rscroll: 95, // docs/35: a scroll of resurrection (shared/src/data/resurrect.ts RSCROLL_PRICE)
} as const;

/** What a bundle's goods are worth at the single prices (its «Выгода ×N»). */
export function worthOf(grants: readonly ShopGrant[]): number {
  let w = 0;
  for (const g of grants) {
    switch (g.k) {
      case 'speed': w += g.min * UNIT_PRICE.speed; break;
      case 'builder': w += g.days * UNIT_PRICE.builder; break;
      case 'perm': w += UNIT_PRICE.perm; break;
      case 'res': w += g.n * UNIT_PRICE[g.good]; break;
      case 'prod': w += g.hours * UNIT_PRICE.prod; break;
      case 'shield': w += g.hours * UNIT_PRICE.shield; break;
      case 'xp': w += g.hours * UNIT_PRICE.xp; break;
      case 'wind': w += g.hours * UNIT_PRICE.wind; break;
      case 'move': w += UNIT_PRICE.move; break;
      case 'charm': w += g.n * UNIT_PRICE.charm; break;
      case 'kit': w += g.n * UNIT_PRICE.kit; break;
      case 'rscroll': w += g.n * UNIT_PRICE.rscroll; break;
      case 'scrolls': w += g.n * UNIT_PRICE.scrolls; break;
      case 'pages': w += g.n * UNIT_PRICE.pages; break;
      case 'art': w += UNIT_PRICE.art; break;
      case 'map': w += g.n * UNIT_PRICE.map; break;
      case 'looks': w += g.n * UNIT_PRICE.looks; break;
      default: break;
    }
  }
  return Math.round(w);
}

// ------------------------------------------------------------------------------------------------ the families

const T = (en: string, ru: string): Tr => [en, ru];
const o = (id: string, price: number, grants: ShopGrant[], extra: Partial<ShopOffer> = {}): ShopOffer => ({ id, price, grants, ...extra });
const res = (good: BaseRes, n: number): ShopGrant => ({ k: 'res', good, n });
/** A count rounded as a shop prints it: whole under a hundred, to tens under a thousand, to hundreds above. */
const nice = (x: number): number => (x < 100 ? Math.max(1, Math.round(x)) : x < 1000 ? Math.round(x / 10) * 10 : Math.round(x / 100) * 100);
/** A line of the ladder: at each price, the quantity its single price buys and the step's bonus (rounded by `round`),
 *  the grants made of it; the last step marked the best. */
const line = (idp: string, prices: number[], unit: number, mk: (q: number) => ShopGrant[], round: (x: number) => number = nice): ShopOffer[] =>
  prices.map((p, i) => o(`${idp}_${p}`, p, mk(round((p / unit) * (1 + (STEP_BONUS[p] ?? 0)))), i === prices.length - 1 && prices.length > 1 ? { tag: 'best' } : {}));
const hours = (x: number) => Math.max(1, Math.round(x));
const days = (x: number) => Math.max(1, Math.round(x));

const RES_NAMES: Record<BaseRes, Tr> = {
  timber: T('Timber', 'Брёвна'),
  coal: T('Coal and stone', 'Уголь и камень'),
  tar: T('Pine tar', 'Смола'),
  iron: T('Iron', 'Железо'),
  provisions: T('Island provisions', 'Провизия острова'),
};

/** Recruits of a tier: hands of its line kind up to so many, into the free hammocks (as many as there is room for). */
const recruit = (tier: number): ShopFamily => {
  const prices = tier <= 3 ? [290, 990] : tier <= 5 ? [590, 1990] : [990, 4990];
  return {
    id: `rec${tier}`, tabs: ['board'], sec: 'recruit', icon: `unit:${RECRUIT_KINDS[tier - 1]}`,
    name: T(`Recruits, tier ${tier}`, `Наём: уровень ${tier}`),
    text: T('Fighters of the line kind of this tier fill your free hammocks at once, up to the pack’s number.', 'Линейные бойцы этого уровня сразу занимают свободные койки — до числа в наборе.'),
    offers: line(`rec${tier}`, prices, RECRUIT_COST[tier - 1] / RECRUIT_SILVER, (n) => [{ k: 'units', tier, n }]),
  };
};

const resFamily = (good: BaseRes): ShopFamily => ({
  id: `res_${good}`, tabs: ['isle'], sec: 'res', icon: `good_${good}`, name: RES_NAMES[good],
  text: T('Unloaded into your island’s yard at once, past its cap.', 'Выгружается во двор острова сразу, сверх его вместимости.'),
  offers: line(good, [290, 590, 990, 1990], UNIT_PRICE[good], (n) => [res(good, n)]),
});

const ALL_RES = ['timber', 'coal', 'tar', 'iron', 'provisions'] as BaseRes[];
const mixed = (n: number): ShopGrant[] => ALL_RES.map((g) => res(g, n));

/** A level's gift (LEVEL_OFFER_H hours from the level reached, once). */
const levelGift = (lv: number, price: number, grants: ShopGrant[]): ShopFamily => ({
  id: `lv${lv}`, tabs: ['sea', 'board', 'isle'], sec: 'deals', icon: 'tattoo_star', level: lv,
  name: T(`Level ${lv} gift`, `Подарок к уровню ${lv}`),
  text: T('For reaching the level: three days on the shelf, once.', 'За новый уровень: три дня на прилавке, один раз.'),
  offers: [o(`lv${lv}`, price, grants, { limit: { n: 1, per: 'ever' }, worth: worthOf(grants), tag: 'hot' })],
});

const STARTER: ShopGrant[] = [{ k: 'builder', days: 7 }, { k: 'speed', min: 480 }, { k: 'scrolls', n: 15 }, { k: 'charm', n: 15 }, { k: 'xp', hours: 24 }, { k: 'kit', n: 5 }];
const WEEKLY: ShopGrant[] = [{ k: 'builder', days: 7 }, { k: 'speed', min: 1080 }, { k: 'scrolls', n: 30 }, { k: 'prod', hours: 72 }, { k: 'shield', hours: 72 }];

export const SHOP: ShopFamily[] = [
  // ---------------------------------------------------------------------------------------------- the «Акции» row
  {
    id: 'starter', tabs: ['sea', 'board', 'isle'], sec: 'deals', icon: 'item_lucky_doubloon',
    name: T('Starter chest', 'Набор новичка'),
    text: T('Once per account: a hired brigade for a week, eight hours of speed-ups, auto-battle scrolls, charms, a day of the elixir and repair kits.', 'Один раз на счёт: наёмная бригада на неделю, восемь часов ускорений, свитки автобоя, талисманы, сутки эликсира и ремкомплекты.'),
    offers: [o('starter', 290, STARTER, { limit: { n: 1, per: 'ever' }, worth: worthOf(STARTER), tag: 'hot' })],
  },
  {
    id: 'sub', tabs: ['sea', 'board', 'isle'], sec: 'deals', icon: 'tattoo_crown',
    name: T('Captain’s subscription', 'Капитанская подписка'),
    text: T(`30 days: ${SUB_DAILY} doubloons and an auto-battle scroll every day you come aboard, one more builders’ brigade and +20% battle experience.`, `30 дней: ${SUB_DAILY} дублонов и свиток автобоя каждый день, когда вы в игре, ещё одна бригада строителей и +20% опыта за бои.`),
    // (its worth: the thirty days' doubloons and scrolls and the brigade's month at the single prices)
    offers: [o('sub30', 990, [{ k: 'sub', days: SUB_DAYS }], { worth: SUB_DAYS * (SUB_DAILY + SUB_SCROLLS * UNIT_PRICE.scrolls + UNIT_PRICE.builder), tag: 'best' })],
  },
  {
    id: 'weekly', tabs: ['sea', 'board', 'isle'], sec: 'deals', icon: 'ui_chest',
    name: T('Week’s chest', 'Недельный сундук'),
    text: T('Once a week: a brigade for a week, eighteen hours of speed-ups, thirty auto-battle scrolls, three days of harvest and of the island’s charter.', 'Раз в неделю: бригада на неделю, восемнадцать часов ускорений, тридцать свитков автобоя, трое суток урожая и охранной грамоты.'),
    offers: [o('weekly', 590, WEEKLY, { limit: { n: 1, per: 'week' }, worth: worthOf(WEEKLY) })],
  },
  levelGift(10, 290, [{ k: 'speed', min: 480 }, { k: 'scrolls', n: 15 }, { k: 'charm', n: 10 }, { k: 'pages', n: 5 }]),
  levelGift(20, 590, [{ k: 'builder', days: 7 }, { k: 'speed', min: 1080 }, { k: 'scrolls', n: 20 }, { k: 'xp', hours: 10 }]),
  levelGift(30, 990, [{ k: 'builder', days: 13 }, { k: 'speed', min: 1980 }, { k: 'scrolls', n: 30 }, { k: 'pages', n: 10 }]),
  levelGift(40, 1990, [{ k: 'builder', days: 30 }, { k: 'speed', min: 4500 }, { k: 'scrolls', n: 60 }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'xp', hours: 40 }]),
  levelGift(50, 2990, [{ k: 'builder', days: 30 }, { k: 'speed', min: 7200 }, { k: 'scrolls', n: 90 }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'charm', n: 60 }]),
  levelGift(60, 4990, [{ k: 'builder', days: 30 }, { k: 'speed', min: 12_480 }, { k: 'scrolls', n: 135 }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'art' }, { k: 'pages', n: 40 }, { k: 'shield', hours: 168 }]),

  // ---------------------------------------------------------------------------------------------- the sea
  {
    id: 'ammo', tabs: ['sea'], sec: 'supply', icon: 'ammo_round',
    name: T('Crates of shot', 'Ящики ядер'),
    text: T('Round, chain and grape into your magazine: a crate is 150, 50 and 50.', 'Ядра, книппели и картечь — в крюйт-камеру: в ящике 150, 50 и 50.'),
    offers: line('ammo', [290, 590, 990], UNIT_PRICE.crate, (n) => [{ k: 'ammo', ammo: 'round', n: 150 * n }, { k: 'ammo', ammo: 'chain', n: 50 * n }, { k: 'ammo', ammo: 'grape', n: 50 * n }]),
  },
  {
    id: 'ammo2', tabs: ['sea'], sec: 'supply', icon: 'ammo_incendiary',
    name: T('Crates of special shot', 'Ящики особых снарядов'),
    text: T('Fire shot, heavy shot and long shot: a crate is 40, 40 and 20.', 'Зажигательные, тяжёлые и дальнобойные снаряды: в ящике 40, 40 и 20.'),
    offers: line('ammo2', [290, 590, 990], UNIT_PRICE.crate2, (n) => [{ k: 'ammo', ammo: 'incendiary', n: 40 * n }, { k: 'ammo', ammo: 'heavy', n: 40 * n }, { k: 'ammo', ammo: 'long_shot', n: 20 * n }]),
  },
  {
    id: 'kit', tabs: ['sea'], sec: 'supply', icon: 'sp_mend_hull',
    name: T('Repair kits', 'Ремкомплекты'),
    text: T('Kept in store: one makes hull, canvas, rudder and guns whole at once, out of a fight.', 'Хранятся в запасе: один чинит корпус, паруса, руль и пушки сразу, вне боя.'),
    offers: line('kit', [290, 590, 990], UNIT_PRICE.kit, (n) => [{ k: 'kit', n }]),
  },
  {
    id: 'crew', tabs: ['sea'], sec: 'supply', icon: 'prof_sailor',
    name: T('Press of hands', 'Вербовщики'),
    text: T('Deckhands fill your free hammocks at once, up to the pack’s number.', 'Матросы сразу занимают свободные койки — до числа в наборе.'),
    offers: line('crew', [290, 990], RECRUIT_COST[0] / RECRUIT_SILVER, (n) => [{ k: 'crew', n }]),
  },
  {
    id: 'wind', tabs: ['sea'], sec: 'voyage', icon: 'sp_fair_wind',
    name: T('Fair wind', 'Попутный ветер'),
    text: T('+10% speed on a voyage. Falls still while you are under fire.', '+10% к скорости в походе. Стихает, пока по вам стреляют.'),
    offers: line('wind', [290, 590, 990], UNIT_PRICE.wind, (h) => [{ k: 'wind', hours: h }], hours),
  },
  {
    id: 'pardon', tabs: ['sea'], sec: 'voyage', icon: 'tab_law',
    name: T('Letters of pardon', 'Помилование'),
    text: T('Your infamy struck off, anywhere at sea. Once a day.', 'Ваша дурная слава стёрта — где угодно в море. Раз в день.'),
    offers: [o('pardon', 290, [{ k: 'pardon' }], { limit: { n: 1, per: 'day' } })],
  },
  {
    id: 'map', tabs: ['sea'], sec: 'voyage', icon: 'map_treasure',
    name: T('Treasure maps', 'Карты сокровищ'),
    text: T('Five maps of your waters’ tier into your chest of maps (room for them needed). Once a day.', 'Пять карт по силам ваших вод — в ларец с картами (нужно место). Раз в день.'),
    offers: [o('map_290', 290, [{ k: 'map', n: 5 }], { limit: { n: 1, per: 'day' } })],
  },
  {
    id: 'looks', tabs: ['sea'], sec: 'voyage', icon: 'item_silk_sails',
    name: T('Ship’s finery', 'Облик корабля'),
    text: T('Sails, hull paints, lanterns, colours and flags not yet yours, drawn at random; the deeds’ own are never sold.', 'Паруса, краски корпуса, фонари, цвета и флаги, которых у вас ещё нет, — наугад; знаки подвигов не продаются.'),
    offers: line('looks', [290, 590], UNIT_PRICE.looks, (n) => [{ k: 'looks', n }]),
  },

  // ---------------------------------------------------------------------------------------------- the boarding
  ...[1, 2, 3, 4, 5, 6, 7].map(recruit),
  {
    id: 'ascroll', tabs: ['board'], sec: 'battle', icon: 'tab_contracts',
    name: T('Auto-battle scrolls', 'Свитки автобоя'),
    text: T('One scroll for one battle: «Auto» fights your side to the end.', 'Один свиток — один бой: «Авто» ведёт вашу сторону до конца.'),
    offers: line('as', [290, 590, 990, 1990], UNIT_PRICE.scrolls, (n) => [{ k: 'scrolls', n }]),
  },
  {
    id: 'charm', tabs: ['board'], sec: 'battle', icon: 'item_rabbit_foot',
    name: T('Lucky charms', 'Талисманы удачи'),
    text: T('+1 luck and +15 morale for one boarding against the sea’s ships; never against a captain.', '+1 к удаче и +15 к боевому духу на один абордаж с кораблями моря; против капитанов не действует.'),
    offers: line('charm', [290, 590, 990, 1990], UNIT_PRICE.charm, (n) => [{ k: 'charm', n }]),
  },
  {
    id: 'refill', tabs: ['board'], sec: 'battle', icon: 'ui_phial',
    name: T('Infirmary: at once', 'Лазарет: мгновенно'),
    text: T('Your fallen of the last day stand again at once, anywhere at sea, with no waystation or port. The price is by their worth, 290 at the least.', 'Павшие за последние сутки сразу снова в строю — где угодно в море, без плавучего дома и порта. Цена — по их стоимости, не меньше 290.'),
    offers: [o('refill', 0, [{ k: 'refill' }])],
  },
  {
    // docs/35: a scroll raises one stack of the line kinds anywhere out of a fight (the shop's creatures: doubloons only).
    id: 'rscroll', tabs: ['board'], sec: 'battle', icon: 'ui_phial',
    name: T('Scrolls of resurrection', 'Свитки воскрешения'),
    text: T('One scroll raises one stack of your fallen in full, anywhere out of a fight. Not for the shop’s creatures.', 'Один свиток поднимает один отряд павших целиком — где угодно вне боя. Кроме существ из магазина.'),
    offers: line('rs', [290, 590, 990, 1990, 4990, 9900], UNIT_PRICE.rscroll, (n) => [{ k: 'rscroll', n }]),
  },
  {
    id: 'xp', tabs: ['board'], sec: 'battle', icon: 'xp',
    name: T('Elixir of experience', 'Эликсир опыта'),
    text: T('+50% experience for battles while it lasts.', '+50% опыта за бои, пока действует.'),
    offers: line('xp', [290, 590, 990, 1990], UNIT_PRICE.xp, (h) => [{ k: 'xp', hours: h }], hours),
  },
  {
    id: 'pages', tabs: ['board'], sec: 'battle', icon: 'bt_book',
    name: T('Scrolls of the path', 'Свитки техник'),
    text: T('Scrolls of your path’s book, drawn for your ship’s level: five of a kind at most.', 'Свитки страниц книги вашего пути — по уровню корабля; не больше пяти одного вида.'),
    offers: line('pages', [290, 590, 990], UNIT_PRICE.pages, (n) => [{ k: 'pages', n }]),
  },
  {
    id: 'art', tabs: ['board'], sec: 'battle', icon: 'item_saint_medal',
    name: T('Chest of finds', 'Сундук находок'),
    text: T('Artifacts from a hoard’s table into your locker.', 'Артефакты из таблицы кладов — в ваш сундук снаряжения.'),
    offers: [o('art_290', 290, [{ k: 'art' }, { k: 'art' }], { limit: { n: 1, per: 'day' } }), o('art_990', 990, Array.from({ length: 8 }, () => ({ k: 'art' }) as ShopGrant), { limit: { n: 1, per: 'week' }, tag: 'best' })],
  },

  // ---------------------------------------------------------------------------------------------- the island
  {
    id: 'btemp', tabs: ['isle'], sec: 'build', icon: 'ui_brigade',
    name: T('Hired brigade', 'Наёмная бригада'),
    text: T('One more building goes up at once while it is hired; two hired at most (a third extends the sooner).', 'Пока бригада нанята, ещё одна постройка строится одновременно; нанять можно две (третья продлит ту, что кончается раньше).'),
    offers: line('btemp', [290, 590, 990, 1990], UNIT_PRICE.builder, (d) => [{ k: 'builder', days: d }], days),
  },
  {
    id: 'bperm', tabs: ['isle'], sec: 'build', icon: 'build_workshop',
    name: T('Brigade for good', 'Своя бригада'),
    text: T('A builders’ brigade of your own for good: it moves with you to a new island. Two at most.', 'Своя бригада строителей навсегда: переезжает с вами на новый остров. Не больше двух.'),
    offers: [o('bperm_1', 1990, [{ k: 'perm' }]), o('bperm_2', 2990, [{ k: 'perm' }])],
  },
  {
    id: 'speed', tabs: ['isle', 'sea'], sec: 'build', icon: 'ui_hourglass',
    name: T('Speed-ups', 'Ускорения'),
    text: T('Hours into your store of speed-ups: spend them on any work on the island or the yard’s refit, a job at a time — nothing is lost.', 'Часы в запас ускорений: тратьте на любую стройку острова и перестройку корабля, по одной работе — ничего не сгорает.'),
    offers: line('sp', [290, 590, 990, 1990, 4990], UNIT_PRICE.speed, (m) => [{ k: 'speed', min: m }], (x) => Math.max(60, Math.round(x / 60) * 60)),
  },
  ...ALL_RES.map(resFamily),
  {
    id: 'resmix', tabs: ['isle'], sec: 'res', icon: 'tab_holdings',
    name: T('Builder’s crate', 'Ящик строителя'),
    text: T('All five of the island’s goods at once, into its yard.', 'Все пять товаров острова сразу — во двор.'),
    offers: line('mix', [290, 590, 990, 1990, 4990], ALL_RES.reduce((a, g) => a + UNIT_PRICE[g], 0), mixed),
  },
  {
    id: 'prod', tabs: ['isle'], sec: 'isle', icon: 'build_farm',
    name: T('Harvest season', 'Урожайный сезон'),
    text: T('+50% from every producer of your island while it lasts.', '+50% к добыче всех промыслов острова, пока действует.'),
    offers: line('prod', [290, 590, 990, 1990], UNIT_PRICE.prod * 24, (d) => [{ k: 'prod', hours: d * 24 }], (x) => Math.min(30, days(x))),
  },
  {
    id: 'shield', tabs: ['isle'], sec: 'isle', icon: 'build_fort',
    name: T('Charter of protection', 'Охранная грамота'),
    text: T('No raiders and no robbers land on your island while it holds; two weeks ahead at most.', 'Пока грамота действует, ни налётчики, ни грабители не высадятся на ваш остров; не больше двух недель вперёд.'),
    offers: line('shield', [290, 590, 990], UNIT_PRICE.shield * 24, (d) => [{ k: 'shield', hours: d * 24 }], (x) => Math.min(14, Math.max(1, Math.floor(x)))),
  },
  {
    id: 'move', tabs: ['isle'], sec: 'isle', icon: 'tab_isles',
    name: T('Charter of removal', 'Грамота на переезд'),
    text: T('Your island’s next move without its fee (2 600 doubloons when paid at the move).', 'Следующий переезд острова без платы (при переезде — 2 600 дублонов).'),
    offers: [o('move_2490', 2490, [{ k: 'move' }])],
  },
  // ---------------------------------------------------------------------------------------------- cosmetics (docs/32 §12)
  ...cosFamilies(),
];

/** Every offer by its id, with its family. */
export const OFFERS: Map<string, { fam: ShopFamily; offer: ShopOffer }> = new Map(SHOP.flatMap((fam) => fam.offers.map((offer) => [offer.id, { fam, offer }] as const)));

/** The levels with a gift. */
export const LEVEL_GIFTS = SHOP.filter((f) => f.level).map((f) => f.level!);

/** What the deal of the day is drawn from: offers of the shelves dear enough to stay at PRICE_MIN or more after the
 *  discount (never a bundle, a brigade for good nor the charter of removal). */
export const DEAL_POOL = ['btemp_590', 'sp_590', 'sp_990', 'xp_590', 'charm_590', 'as_590', 'mix_590', 'prod_590', 'shield_590', 'wind_590', 'ammo_590', 'kit_590', 'pages_590', 'iron_990', 'btemp_990', 'mix_990'];

/** The day (UTC) and the week (from Monday) of a wall time. */
export const dayOf = (ms: number): number => Math.floor(ms / 86_400_000);
export const weekOf = (ms: number): number => Math.floor((dayOf(ms) + 3) / 7);

/** The deal of a day: an offer of the pool (by a hash of the day, the same for every captain) and its price. */
export function dealOf(day: number): { offer: ShopOffer; price: number } {
  let h = (day * 2654435761) >>> 0;
  h ^= h >>> 15;
  const offer = OFFERS.get(DEAL_POOL[(h >>> 0) % DEAL_POOL.length])!.offer;
  return { offer, price: Math.max(PRICE_MIN, Math.round(offer.price * (1 - DEAL_OFF))) };
}

/** How much of the family's measure an offer holds (its first grant's kind, summed). */
function measure(offer: ShopOffer): number {
  const k = offer.grants[0]?.k;
  let n = 0;
  for (const g of offer.grants) {
    if (g.k !== k) continue;
    if ('min' in g) n += g.min;
    else if ('days' in g) n += g.days;
    else if ('hours' in g) n += g.hours;
    else if ('n' in g) n += g.n;
    else n += 1;
  }
  return n;
}

/** The bonus of an offer against the family's first, in percent (0 for the first; a bundle's: its worth). */
export function offerBonus(fam: ShopFamily, offer: ShopOffer): number {
  if (offer.worth) return Math.round((offer.worth / Math.max(1, offer.price) - 1) * 100);
  const first = fam.offers[0];
  if (first === offer || !first.price || !offer.price) return 0;
  return Math.max(0, Math.round(((measure(offer) / offer.price) / (measure(first) / first.price) - 1) * 100));
}
