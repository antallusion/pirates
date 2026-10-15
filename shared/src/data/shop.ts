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

type Tr = [string, string];

export type ShopTab = 'sea' | 'board' | 'isle';
export const SHOP_TABS: ShopTab[] = ['sea', 'board', 'isle'];

/** The shelves of a tab, in their order (`deals` — the «Акции» row on top of every tab). */
export type ShopSec = 'deals' | 'ships' | 'supply' | 'voyage' | 'units' | 'recruit' | 'battle' | 'build' | 'res' | 'isle';
export const TAB_SECS: Record<ShopTab, ShopSec[]> = {
  sea: ['ships', 'supply', 'voyage'],
  board: ['units', 'recruit', 'battle'],
  isle: ['build', 'res', 'isle'],
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
  /** Hands signed on (deckhands, into her hammocks). */
  | { k: 'crew'; n: number }
  /** A stack of a tier's line kind (RECRUIT_KINDS), sold from the ship level a premium kind of that tier is. */
  | { k: 'units'; tier: number; n: number }
  /** Her fallen of the last boarding against the sea stand again (REFILL_*). */
  | { k: 'refill' }
  /** Her infamy struck off to a stranger's (ports.ts pardon, without the port). */
  | { k: 'pardon' }
  /** A treasure map of her waters' tier. */
  | { k: 'map' }
  /** Parts of a ship's look not yet hers, drawn at random from the shop's own (never a deed's). */
  | { k: 'looks'; n: number }
  /** The captain's subscription for so many days (SUB_*). */
  | { k: 'sub'; days: number };

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
export const SUB_DAILY = 50;
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
/** «Завершить сейчас»: doubloons a minute of work left (36 an hour, two at the least). */
export const FINISH_PER_MIN = 0.6;
/** A creature of the shop by threes and fives: the discount. */
export const UNIT_PACKS: { k: number; off: number }[] = [{ k: 1, off: 0 }, { k: 3, off: 0.08 }, { k: 5, off: 0.15 }];
/** Buys a captain may send: so many in two seconds, so many a minute (the session's flood guard is far above). */
export const BUY_BURST = 5;
export const BUY_MINUTE = 40;

/** Doubloons to finish a work of `secs` now. */
export function finishPrice(secs: number): number {
  return Math.max(2, Math.ceil((Math.max(0, secs) / 60) * FINISH_PER_MIN));
}

/** A premium creature's pack of `k` stacks: its price. */
export function unitPackPrice(price: number, k: number): number {
  const p = UNIT_PACKS.find((x) => x.k === k);
  return p ? Math.round(price * k * (1 - p.off)) : 0;
}

/** The line kind of each tier the recruiters sign on (army.ts TIER_BASE). */
export const RECRUIT_KINDS = ['deckhand', 'marine', 'musketeer', 'gunner', 'boarder', 'guard', 'drowned'] as const;
/** Their silver worth a man (UNITS[..].cost), kept here so the catalogue is pure. */
const RECRUIT_COST = [20, 60, 70, 120, 180, 300, 450];

// ------------------------------------------------------------------------------------------------ the families

const T = (en: string, ru: string): Tr => [en, ru];
const o = (id: string, price: number, grants: ShopGrant[], extra: Partial<ShopOffer> = {}): ShopOffer => ({ id, price, grants, ...extra });
const res = (good: BaseRes, n: number): ShopGrant => ({ k: 'res', good, n });

const RES_NAMES: Record<BaseRes, [Tr, number]> = {
  timber: [T('Timber', 'Брёвна'), 1],
  coal: [T('Coal and stone', 'Уголь и камень'), 1],
  tar: [T('Pine tar', 'Смола'), 1.2],
  iron: [T('Iron', 'Железо'), 1.5],
  provisions: [T('Island provisions', 'Провизия острова'), 1],
};

const recruit = (tier: number): ShopFamily => {
  const n1 = Math.max(1, Math.round(1000 / RECRUIT_COST[tier - 1]));
  return {
    id: `rec${tier}`, tabs: ['board'], sec: 'recruit', icon: `unit:${RECRUIT_KINDS[tier - 1]}`,
    name: T(`Recruits, tier ${tier}`, `Наём: уровень ${tier}`),
    text: T('A stack of the line kind of this tier signs on at once: a slot and hammocks for them.', 'Отряд линейных бойцов этого уровня встаёт в армию сразу: нужен слот и койки.'),
    offers: [o(`rec${tier}_s`, 20, [{ k: 'units', tier, n: n1 }]), o(`rec${tier}_m`, 54, [{ k: 'units', tier, n: n1 * 3 }]), o(`rec${tier}_l`, 150, [{ k: 'units', tier, n: n1 * 10 }], { tag: 'best' })],
  };
};

const resFamily = (good: BaseRes): ShopFamily => {
  const [name, mul] = RES_NAMES[good];
  const p = (x: number) => Math.round(x * mul);
  return {
    id: `res_${good}`, tabs: ['isle'], sec: 'res', icon: `good_${good}`, name,
    text: T('Unloaded into your island’s yard at once, past its cap.', 'Выгружается во двор острова сразу, сверх его вместимости.'),
    offers: [o(`${good}_s`, p(15), [res(good, 200)]), o(`${good}_m`, p(40), [res(good, 600)]), o(`${good}_l`, p(110), [res(good, 2000)], { tag: 'best' })],
  };
};

const mixed = (n: number): ShopGrant[] => (['timber', 'coal', 'tar', 'iron', 'provisions'] as BaseRes[]).map((g) => res(g, n));

/** A level's gift (LEVEL_OFFER_H hours from the level reached, once). */
const levelGift = (lv: number, price: number, worth: number, grants: ShopGrant[]): ShopFamily => ({
  id: `lv${lv}`, tabs: ['sea', 'board', 'isle'], sec: 'deals', icon: 'tattoo_star', level: lv,
  name: T(`Level ${lv} gift`, `Подарок к уровню ${lv}`),
  text: T('For reaching the level: three days on the shelf, once.', 'За новый уровень: три дня на прилавке, один раз.'),
  offers: [o(`lv${lv}`, price, grants, { limit: { n: 1, per: 'ever' }, worth, tag: 'hot' })],
});

export const SHOP: ShopFamily[] = [
  // ---------------------------------------------------------------------------------------------- the «Акции» row
  {
    id: 'starter', tabs: ['sea', 'board', 'isle'], sec: 'deals', icon: 'item_lucky_doubloon',
    name: T('Starter chest', 'Набор новичка'),
    text: T('Once per account: a hired brigade for three days, two hours of speed-ups, auto-battle scrolls, charms, an elixir and repair kits.', 'Один раз на счёт: наёмная бригада на три дня, два часа ускорений, свитки автобоя, талисманы, эликсир и ремкомплекты.'),
    offers: [o('starter', 149, [{ k: 'builder', days: 3 }, { k: 'speed', min: 120 }, { k: 'scrolls', n: 5 }, { k: 'charm', n: 5 }, { k: 'xp', hours: 8 }, { k: 'kit', n: 2 }], { limit: { n: 1, per: 'ever' }, worth: 690, tag: 'hot' })],
  },
  {
    id: 'sub', tabs: ['sea', 'board', 'isle'], sec: 'deals', icon: 'tattoo_crown',
    name: T('Captain’s subscription', 'Капитанская подписка'),
    text: T(`30 days: ${SUB_DAILY} doubloons and an auto-battle scroll every day you come aboard, one more builders’ brigade and +20% battle experience.`, `30 дней: ${SUB_DAILY} дублонов и свиток автобоя каждый день, когда вы в игре, ещё одна бригада строителей и +20% опыта за бои.`),
    offers: [o('sub30', 490, [{ k: 'sub', days: SUB_DAYS }], { worth: 2250, tag: 'best' })],
  },
  {
    id: 'weekly', tabs: ['sea', 'board', 'isle'], sec: 'deals', icon: 'tab_holdings',
    name: T('Week’s chest', 'Недельный сундук'),
    text: T('Once a week: a brigade for three days, three hours of speed-ups, ten auto-battle scrolls, a day of harvest and of the island’s charter.', 'Раз в неделю: бригада на три дня, три часа ускорений, десять свитков автобоя, сутки урожая и охранной грамоты.'),
    offers: [o('weekly', 290, [{ k: 'builder', days: 3 }, { k: 'speed', min: 180 }, { k: 'scrolls', n: 10 }, { k: 'prod', hours: 24 }, { k: 'shield', hours: 24 }], { limit: { n: 1, per: 'week' }, worth: 690 })],
  },
  levelGift(10, 99, 330, [{ k: 'speed', min: 120 }, { k: 'scrolls', n: 5 }, { k: 'charm', n: 5 }, { k: 'pages', n: 2 }]),
  levelGift(20, 199, 690, [{ k: 'builder', days: 3 }, { k: 'speed', min: 240 }, { k: 'scrolls', n: 10 }, { k: 'xp', hours: 8 }]),
  levelGift(30, 299, 1050, [{ k: 'builder', days: 7 }, { k: 'speed', min: 480 }, { k: 'scrolls', n: 10 }, { k: 'pages', n: 5 }]),
  levelGift(40, 399, 1400, [{ k: 'builder', days: 7 }, { k: 'speed', min: 720 }, { k: 'scrolls', n: 20 }, { k: 'art' }, { k: 'xp', hours: 24 }]),
  levelGift(50, 499, 1750, [{ k: 'builder', days: 7 }, { k: 'speed', min: 1440 }, { k: 'scrolls', n: 20 }, { k: 'art' }, { k: 'charm', n: 15 }]),
  levelGift(60, 599, 2100, [{ k: 'builder', days: 7 }, { k: 'speed', min: 1440 }, { k: 'scrolls', n: 30 }, { k: 'art' }, { k: 'pages', n: 10 }, { k: 'shield', hours: 72 }]),

  // ---------------------------------------------------------------------------------------------- the sea
  {
    id: 'ammo', tabs: ['sea'], sec: 'supply', icon: 'ammo_round',
    name: T('Crate of shot', 'Ящик ядер'),
    text: T('Round, chain and grape into your magazine.', 'Ядра, книппели и картечь — в крюйт-камеру.'),
    offers: [
      o('ammo_s', 20, [{ k: 'ammo', ammo: 'round', n: 150 }, { k: 'ammo', ammo: 'chain', n: 50 }, { k: 'ammo', ammo: 'grape', n: 50 }]),
      o('ammo_m', 50, [{ k: 'ammo', ammo: 'round', n: 450 }, { k: 'ammo', ammo: 'chain', n: 150 }, { k: 'ammo', ammo: 'grape', n: 150 }]),
      o('ammo_l', 150, [{ k: 'ammo', ammo: 'round', n: 1500 }, { k: 'ammo', ammo: 'chain', n: 500 }, { k: 'ammo', ammo: 'grape', n: 500 }], { tag: 'best' }),
    ],
  },
  {
    id: 'ammo2', tabs: ['sea'], sec: 'supply', icon: 'ammo_incendiary',
    name: T('Special shot', 'Особые снаряды'),
    text: T('Fire shot, heavy shot and long shot.', 'Зажигательные, тяжёлые и дальнобойные снаряды.'),
    offers: [
      o('ammo2_s', 35, [{ k: 'ammo', ammo: 'incendiary', n: 40 }, { k: 'ammo', ammo: 'heavy', n: 40 }, { k: 'ammo', ammo: 'long_shot', n: 20 }]),
      o('ammo2_m', 90, [{ k: 'ammo', ammo: 'incendiary', n: 120 }, { k: 'ammo', ammo: 'heavy', n: 120 }, { k: 'ammo', ammo: 'long_shot', n: 60 }]),
      o('ammo2_l', 260, [{ k: 'ammo', ammo: 'incendiary', n: 400 }, { k: 'ammo', ammo: 'heavy', n: 400 }, { k: 'ammo', ammo: 'long_shot', n: 200 }], { tag: 'best' }),
    ],
  },
  {
    id: 'prov', tabs: ['sea'], sec: 'supply', icon: 'good_provisions',
    name: T('Provisions', 'Провиант'),
    text: T('Into your hold, if there is room for it.', 'В трюм, если для него есть место.'),
    offers: [o('prov_s', 12, [{ k: 'cargo', good: 'provisions', n: 100 }]), o('prov_m', 30, [{ k: 'cargo', good: 'provisions', n: 300 }]), o('prov_l', 80, [{ k: 'cargo', good: 'provisions', n: 1000 }], { tag: 'best' })],
  },
  {
    id: 'stores', tabs: ['sea'], sec: 'supply', icon: 'good_planks',
    name: T('Carpenter’s stores', 'Плотницкий запас'),
    text: T('Planks and sailcloth for mending at sea.', 'Доски и парусина для ремонта в море.'),
    offers: [
      o('stores_s', 20, [{ k: 'cargo', good: 'planks', n: 40 }, { k: 'cargo', good: 'sailcloth', n: 20 }]),
      o('stores_m', 50, [{ k: 'cargo', good: 'planks', n: 120 }, { k: 'cargo', good: 'sailcloth', n: 60 }]),
      o('stores_l', 140, [{ k: 'cargo', good: 'planks', n: 400 }, { k: 'cargo', good: 'sailcloth', n: 200 }], { tag: 'best' }),
    ],
  },
  {
    id: 'kit', tabs: ['sea'], sec: 'supply', icon: 'sp_mend_hull',
    name: T('Repair kit', 'Ремкомплект'),
    text: T('Kept in store: one makes hull, canvas, rudder and guns whole at once, out of a fight.', 'Хранится в запасе: один чинит корпус, паруса, руль и пушки сразу, вне боя.'),
    offers: [o('kit_s', 30, [{ k: 'kit', n: 1 }]), o('kit_m', 75, [{ k: 'kit', n: 3 }]), o('kit_l', 200, [{ k: 'kit', n: 10 }], { tag: 'best' })],
  },
  {
    id: 'crew', tabs: ['sea'], sec: 'supply', icon: 'prof_sailor',
    name: T('Press of hands', 'Вербовщики'),
    text: T('Deckhands into your hammocks at once — there must be room for all of them.', 'Матросы встают на ваши койки сразу — места должно хватить всем.'),
    offers: [o('crew_s', 15, [{ k: 'crew', n: 25 }]), o('crew_m', 50, [{ k: 'crew', n: 100 }]), o('crew_l', 120, [{ k: 'crew', n: 300 }], { tag: 'best' })],
  },
  {
    id: 'wind', tabs: ['sea'], sec: 'voyage', icon: 'sp_fair_wind',
    name: T('Fair wind', 'Попутный ветер'),
    text: T('+10% speed on a voyage. Falls still while you are under fire.', '+10% к скорости в походе. Стихает, пока по вам стреляют.'),
    offers: [o('wind_1', 20, [{ k: 'wind', hours: 1 }]), o('wind_3', 50, [{ k: 'wind', hours: 3 }]), o('wind_8', 110, [{ k: 'wind', hours: 8 }]), o('wind_24', 280, [{ k: 'wind', hours: 24 }], { tag: 'best' })],
  },
  {
    id: 'pardon', tabs: ['sea'], sec: 'voyage', icon: 'tab_law',
    name: T('Letters of pardon', 'Помилование'),
    text: T('Your infamy struck off, anywhere at sea. Once a day.', 'Ваша дурная слава стёрта — где угодно в море. Раз в день.'),
    offers: [o('pardon', 90, [{ k: 'pardon' }], { limit: { n: 1, per: 'day' } })],
  },
  {
    id: 'map', tabs: ['sea'], sec: 'voyage', icon: 'map_treasure',
    name: T('Treasure map', 'Карта сокровищ'),
    text: T('A map of your waters’ tier into your chest of maps. Three a day.', 'Карта по силам ваших вод — в ларец с картами. Три в день.'),
    offers: [o('map_1', 60, [{ k: 'map' }], { limit: { n: 3, per: 'day' } })],
  },
  {
    id: 'looks', tabs: ['sea'], sec: 'voyage', icon: 'item_silk_sails',
    name: T('Ship’s finery', 'Облик корабля'),
    text: T('Sails, hull paints, lanterns, colours and flags not yet yours, drawn at random; the deeds’ own are never sold.', 'Паруса, краски корпуса, фонари, цвета и флаги, которых у вас ещё нет, — наугад; знаки подвигов не продаются.'),
    offers: [o('looks_3', 45, [{ k: 'looks', n: 3 }]), o('looks_10', 120, [{ k: 'looks', n: 10 }], { tag: 'best' })],
  },

  // ---------------------------------------------------------------------------------------------- the boarding
  ...[1, 2, 3, 4, 5, 6, 7].map(recruit),
  {
    id: 'ascroll', tabs: ['board'], sec: 'battle', icon: 'tab_contracts',
    name: T('Auto-battle scroll', 'Свиток автобоя'),
    text: T('One scroll for one battle: «Auto» fights your side to the end.', 'Один свиток — один бой: «Авто» ведёт вашу сторону до конца.'),
    offers: [o('as1', 25, [{ k: 'scrolls', n: 1 }]), o('as5', 100, [{ k: 'scrolls', n: 5 }]), o('as20', 300, [{ k: 'scrolls', n: 20 }]), o('as50', 650, [{ k: 'scrolls', n: 50 }], { tag: 'best' })],
  },
  {
    id: 'charm', tabs: ['board'], sec: 'battle', icon: 'item_rabbit_foot',
    name: T('Lucky charm', 'Талисман удачи'),
    text: T('+1 luck and +15 morale for one boarding against the sea’s ships; never against a captain.', '+1 к удаче и +15 к боевому духу на один абордаж с кораблями моря; против капитанов не действует.'),
    offers: [o('charm_1', 20, [{ k: 'charm', n: 1 }]), o('charm_5', 85, [{ k: 'charm', n: 5 }]), o('charm_15', 220, [{ k: 'charm', n: 15 }], { tag: 'best' })],
  },
  {
    id: 'refill', tabs: ['board'], sec: 'battle', icon: 'prof_surgeon',
    name: T('Infirmary', 'Лазарет'),
    text: T('The fallen of your last boarding against the sea stand again, within an hour of it. The price is by their worth.', 'Павшие в последнем абордаже с кораблями моря снова в строю — в течение часа после боя. Цена — по их стоимости.'),
    offers: [o('refill', 0, [{ k: 'refill' }])],
  },
  {
    id: 'xp', tabs: ['board'], sec: 'battle', icon: 'xp',
    name: T('Elixir of experience', 'Эликсир опыта'),
    text: T('+50% experience for battles while it lasts.', '+50% опыта за бои, пока действует.'),
    offers: [o('xp_1', 30, [{ k: 'xp', hours: 1 }]), o('xp_3', 75, [{ k: 'xp', hours: 3 }]), o('xp_8', 160, [{ k: 'xp', hours: 8 }]), o('xp_24', 390, [{ k: 'xp', hours: 24 }], { tag: 'best' })],
  },
  {
    id: 'pages', tabs: ['board'], sec: 'battle', icon: 'bt_book',
    name: T('Scrolls of the path', 'Свитки техник'),
    text: T('Scrolls of your path’s book, drawn for your ship’s level: five of a kind at most.', 'Свитки страниц книги вашего пути — по уровню корабля; не больше пяти одного вида.'),
    offers: [o('pages_1', 30, [{ k: 'pages', n: 1 }]), o('pages_5', 130, [{ k: 'pages', n: 5 }]), o('pages_15', 330, [{ k: 'pages', n: 15 }], { tag: 'best' })],
  },
  {
    id: 'art', tabs: ['board'], sec: 'battle', icon: 'item_saint_medal',
    name: T('Chest of finds', 'Сундук находок'),
    text: T('An artifact from a hoard’s table into your locker.', 'Артефакт из таблицы кладов — в ваш сундук снаряжения.'),
    offers: [o('art_1', 150, [{ k: 'art' }], { limit: { n: 1, per: 'day' } }), o('art_3', 400, [{ k: 'art' }, { k: 'art' }, { k: 'art' }], { limit: { n: 1, per: 'week' } })],
  },

  // ---------------------------------------------------------------------------------------------- the island
  {
    id: 'btemp', tabs: ['isle'], sec: 'build', icon: 'prof_carpenter',
    name: T('Hired brigade', 'Наёмная бригада'),
    text: T('One more building goes up at once while it is hired; two hired at most (a third extends the sooner).', 'Пока бригада нанята, ещё одна постройка строится одновременно; нанять можно две (третья продлит ту, что кончается раньше).'),
    offers: [o('btemp_1', 90, [{ k: 'builder', days: 1 }]), o('btemp_3', 220, [{ k: 'builder', days: 3 }]), o('btemp_7', 420, [{ k: 'builder', days: 7 }], { tag: 'best' })],
  },
  {
    id: 'bperm', tabs: ['isle'], sec: 'build', icon: 'build_workshop',
    name: T('Brigade for good', 'Своя бригада'),
    text: T('A builders’ brigade of your own for good: it moves with you to a new island. Two at most.', 'Своя бригада строителей навсегда: переезжает с вами на новый остров. Не больше двух.'),
    offers: [o('bperm_1', 1200, [{ k: 'perm' }]), o('bperm_2', 2000, [{ k: 'perm' }])],
  },
  {
    id: 'speed', tabs: ['isle', 'sea'], sec: 'build', icon: 'item_storm_glass',
    name: T('Speed-ups', 'Ускорения'),
    text: T('Minutes into your store of speed-ups: spend them on any work on the island or the yard’s refit, a job at a time — nothing is lost.', 'Минуты в запас ускорений: тратьте на любую стройку острова и перестройку корабля, по одной работе — ничего не сгорает.'),
    offers: [o('sp_5m', 4, [{ k: 'speed', min: 5 }]), o('sp_1h', 35, [{ k: 'speed', min: 60 }]), o('sp_8h', 240, [{ k: 'speed', min: 480 }]), o('sp_24h', 600, [{ k: 'speed', min: 1440 }], { tag: 'best' })],
  },
  ...(['timber', 'coal', 'tar', 'iron', 'provisions'] as BaseRes[]).map(resFamily),
  {
    id: 'resmix', tabs: ['isle'], sec: 'res', icon: 'tab_holdings',
    name: T('Builder’s crate', 'Ящик строителя'),
    text: T('All five of the island’s goods at once, into its yard.', 'Все пять товаров острова сразу — во двор.'),
    offers: [o('mix_s', 60, mixed(200)), o('mix_m', 160, mixed(600)), o('mix_l', 450, mixed(2000), { tag: 'best' })],
  },
  {
    id: 'prod', tabs: ['isle'], sec: 'isle', icon: 'build_farm',
    name: T('Harvest season', 'Урожайный сезон'),
    text: T('+50% from every producer of your island while it lasts.', '+50% к добыче всех промыслов острова, пока действует.'),
    offers: [o('prod_1', 90, [{ k: 'prod', hours: 24 }]), o('prod_3', 220, [{ k: 'prod', hours: 72 }]), o('prod_7', 450, [{ k: 'prod', hours: 168 }], { tag: 'best' })],
  },
  {
    id: 'shield', tabs: ['isle'], sec: 'isle', icon: 'build_fort',
    name: T('Charter of protection', 'Охранная грамота'),
    text: T('No raiders and no robbers land on your island while it holds; two weeks ahead at most.', 'Пока грамота действует, ни налётчики, ни грабители не высадятся на ваш остров; не больше двух недель вперёд.'),
    offers: [o('shield_1', 80, [{ k: 'shield', hours: 24 }]), o('shield_3', 200, [{ k: 'shield', hours: 72 }]), o('shield_7', 400, [{ k: 'shield', hours: 168 }], { tag: 'best' })],
  },
  {
    id: 'move', tabs: ['isle'], sec: 'isle', icon: 'tab_isles',
    name: T('Charter of removal', 'Грамота на переезд'),
    text: T('Your island’s next move without its fee (2 600 doubloons when paid at the move).', 'Следующий переезд острова без платы (при переезде — 2 600 дублонов).'),
    offers: [o('move_1', 2400, [{ k: 'move' }])],
  },
];

/** Every offer by its id, with its family. */
export const OFFERS: Map<string, { fam: ShopFamily; offer: ShopOffer }> = new Map(SHOP.flatMap((fam) => fam.offers.map((offer) => [offer.id, { fam, offer }] as const)));

/** The levels with a gift. */
export const LEVEL_GIFTS = SHOP.filter((f) => f.level).map((f) => f.level!);

/** What the deal of the day is drawn from: single offers of the shelves (never a bundle, a brigade for good nor the
 *  charter of removal). */
export const DEAL_POOL = ['btemp_1', 'sp_1h', 'sp_8h', 'xp_3', 'charm_5', 'as5', 'mix_s', 'prod_1', 'shield_1', 'wind_3', 'ammo_m', 'kit_m', 'pages_5', 'iron_m'];

/** The day (UTC) and the week (from Monday) of a wall time. */
export const dayOf = (ms: number): number => Math.floor(ms / 86_400_000);
export const weekOf = (ms: number): number => Math.floor((dayOf(ms) + 3) / 7);

/** The deal of a day: an offer of the pool (by a hash of the day, the same for every captain) and its price. */
export function dealOf(day: number): { offer: ShopOffer; price: number } {
  let h = (day * 2654435761) >>> 0;
  h ^= h >>> 15;
  const offer = OFFERS.get(DEAL_POOL[(h >>> 0) % DEAL_POOL.length])!.offer;
  return { offer, price: Math.max(1, Math.round(offer.price * (1 - DEAL_OFF))) };
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
