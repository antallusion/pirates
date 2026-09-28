// Letters of marque (docs/12 P10 #15): service under the Crown, the League or the Brethren, with ranks from midshipman
// to commodore, a livery for her ship, fleet orders to be done by sunset, a day's pay, the service's own quartermaster,
// and the letter taken away for crimes against the flag.

import type { FactionId } from './factions.ts';
import type { GoodId } from './goods.ts';
import type { Look } from './looks.ts';

type Tr = [string, string];

export type ServiceId = 'crown' | 'league' | 'confederacy';
export const SERVICE_IDS: ServiceId[] = ['crown', 'league', 'confederacy'];

export type OrderKind = 'intercept' | 'hunt' | 'deliver' | 'patrol';

export interface ServiceDef {
  id: ServiceId;
  name: Tr;
  /** "of the Crown": the titles' tail. */
  of: Tr;
  /** Standing wanted to enlist; the most wanted she may be while serving. */
  rep: number;
  maxWanted: number;
  /** Whom she hunts. */
  enemies: FactionId[];
  /** Whom she must never sink or take. */
  friends: FactionId[];
  /** The quarry of an interception: its role, faction and what she is called. */
  quarry: { role: 'merchant' | 'pirate'; faction: FactionId; what: Tr };
  /** Goods the service asks to be brought. */
  wants: GoodId[];
  orders: OrderKind[];
  livery: Look;
}

export const SERVICES: Record<ServiceId, ServiceDef> = {
  crown: {
    id: 'crown', name: ['The Crown Admiralty', 'Адмиралтейство Короны'], of: ['of the Crown', 'Короны'], rep: 10, maxWanted: 1,
    enemies: ['confederacy', 'brokers'], friends: ['crown', 'league'],
    quarry: { role: 'merchant', faction: 'brokers', what: ['a smuggler', 'контрабандиста'] },
    wants: ['gunpowder', 'provisions', 'weapons'], orders: ['intercept', 'hunt', 'deliver', 'patrol'],
    livery: { field: 6, c1: 3, c2: 1, c3: 5, emblem: 42, hull: 3, sail: 4, lamp: 0 },
  },
  league: {
    id: 'league', name: ['The Gilded Ledger', 'Золочёный Гроссбух'], of: ['of the League', 'Лиги'], rep: 10, maxWanted: 2,
    enemies: ['confederacy'], friends: ['league', 'crown'],
    quarry: { role: 'pirate', faction: 'confederacy', what: ['a pirate', 'пирата'] },
    wants: ['spices', 'cloth', 'sugar', 'medicine'], orders: ['intercept', 'hunt', 'deliver', 'deliver'],
    livery: { field: 2, c1: 5, c2: 0, c3: 1, emblem: 45, hull: 6, sail: 3, lamp: 0 },
  },
  confederacy: {
    id: 'confederacy', name: ['The Brethren of the Red Tide', 'Братство Красного прилива'], of: ['of the Brethren', 'Братства'], rep: 10, maxWanted: 5,
    enemies: ['crown', 'league'], friends: ['confederacy'],
    quarry: { role: 'merchant', faction: 'league', what: ['a League merchant', 'купца Лиги'] },
    wants: ['gunpowder', 'rum', 'weapons'], orders: ['intercept', 'hunt', 'hunt', 'patrol'],
    livery: { field: 0, c1: 2, c2: 0, c3: 1, emblem: 48, hull: 1, sail: 2, lamp: 3 },
  },
};

export const RANKS: Tr[] = [['Midshipman', 'Мичман'], ['Lieutenant', 'Лейтенант'], ['Commander', 'Капитан-лейтенант'], ['Captain', 'Капитан'], ['Commodore', 'Коммодор']];
/** Merit wanted for each rank. */
export const RANK_MERIT = [0, 120, 350, 800, 1600];
/** Silver a day by rank, drawn at any port of the service. */
export const RANK_PAY = [150, 400, 900, 1800, 3500];
/** The quartermaster's price off by rank, and the quality of his stores. */
export const RANK_DISCOUNT = [0, 0.05, 0.1, 0.15, 0.2];
export const RANK_RARITY = [1, 1, 2, 2, 3];

export function rankOf(merit: number): number {
  let r = 0;
  for (let i = 1; i < RANK_MERIT.length; i++) if (merit >= RANK_MERIT[i]) r = i;
  return r;
}

/** Her title in the service, e.g. "Lieutenant of the Crown". */
export function serviceTitle(id: ServiceId, rank: number): string {
  return `${RANKS[rank][0]} ${SERVICES[id].of[0]}`;
}

/** The service's flag by rank: the first to a commander, the second to a captain, the third to a commodore. */
export function liveryOf(id: ServiceId, rank: number): Look {
  const l = { ...SERVICES[id].livery };
  l.emblem += rank >= 4 ? 2 : rank >= 3 ? 1 : 0;
  return l;
}

/** Orders: how many, and what they pay (silver, merit) at rank 0 (each rank +25% silver). */
export const ORDER_NEED: Record<OrderKind, number> = { intercept: 1, hunt: 2, deliver: 20, patrol: 3 };
export const ORDER_PAY: Record<OrderKind, { silver: number; merit: number }> = {
  intercept: { silver: 900, merit: 40 },
  hunt: { silver: 800, merit: 35 },
  deliver: { silver: 500, merit: 25 },
  patrol: { silver: 400, merit: 20 },
};
/** Merit lost for an order not done by sunset. */
export const ORDER_FAIL_MERIT = 15;
/** The game hour of sunset (orders are "by sunset"); an order is never shorter than this many real seconds. */
export const SUNSET_HOUR = 19;
export const ORDER_MIN_SEC = 15 * 60;
/** Within this of a patrol mark it is passed; the quarry waits within this of its port. */
export const MARK_R = 500;
export const QUARRY_R = 2500;
/** After a letter is taken away, a day before any service takes her again. */
export const BAN_MS = 24 * 3600_000;

export function servicePatterns(): [string, string][] {
  const out: [string, string][] = [
    ['You enter the service: {0}.', 'Вы поступили на службу: {0}.'],
    ['You are promoted: {0}.', 'Вас произвели в чин: {0}.'],
    ['Your letter of marque is revoked: {0}.', 'У вас отобрали каперский патент: {0}.'],
    ['you fired on your own flag', 'вы подняли оружие на свой флаг'],
    ['you are wanted', 'вас разыскивают'],
    ['You leave the service.', 'Вы уходите со службы.'],
    ['Your pay: {0} silver.', 'Жалованье: {0} серебра.'],
    ['Order done: {0} silver and merit.', 'Приказ выполнен: {0} серебра и заслуги.'],
    ['The order is failed: sunset came first.', 'Приказ провален: закат наступил раньше.'],
    ['You already serve.', 'Вы уже на службе.'],
    ['You serve no one.', 'Вы ни у кого не служите.'],
    ['No service is taken here.', 'Здесь на службу не берут.'],
    ['This is not a port of your service.', 'Это не порт вашей службы.'],
    ['You already have an order.', 'У вас уже есть приказ.'],
    ['No service takes you yet: wait a day after losing a letter.', 'Пока вас никуда не возьмут: после лишения патента нужно выждать сутки.'],
    ['Your standing is too low (needs {0}).', 'Слишком низкая репутация (нужно {0}).'],
    ['Not while you are wanted.', 'Не пока вас разыскивают.'],
    ['A captain sworn to the Code serves no lawful flag.', 'Капитан, присягнувший Кодексу, не служит законному флагу.'],
    ['A captain under a Crown letter does not serve the Brethren.', 'Капитан с патентом Короны не служит Братству.'],
    ['The quartermaster has nothing more for you today.', 'Сегодня у интенданта для вас больше ничего нет.'],
    ['Your locker is full', 'Ваш рундук полон'],
    ['Not enough silver', 'Не хватает серебра'],
    ['The service livery is flown.', 'Подняты цвета службы.'],
    ['The livery is flown in port.', 'Цвета службы поднимают в порту.'],
    ['Intercept {0} off {1} by sunset.', 'Перехватить {0} до заката — {1}.'],
    ['Sink {0} enemy ships in {1} by sunset.', 'Потопить вражеских кораблей в водах «{1}»: {0} — до заката.'],
    ['Bring {0} {1} to {2} by sunset.', 'Доставить до заката — {2}: {1}, {0} ед.'],
    ['Patrol off {0}: pass {1} marks by sunset.', 'Патруль до заката — {0}, отметок: {1}.'],
    ['Your quarry is at sea off {0}.', 'Ваша цель вышла в море — {0}.'],
    ['Delivered for the service: {0} {1}.', 'Доставлено для службы: {1} — {0} ед.'],
  ];
  for (const id of SERVICE_IDS) for (let r = 0; r < RANKS.length; r++) out.push([serviceTitle(id, r), `${RANKS[r][1]} ${SERVICES[id].of[1]}`]);
  for (const id of SERVICE_IDS) out.push([SERVICES[id].quarry.what[0], SERVICES[id].quarry.what[1]], [SERVICES[id].name[0], SERVICES[id].name[1]]);
  return out;
}
