// The premium shop's goods on the server (owner, 2026-10-15; shared/src/data/shop.ts, docs/32_PREMIUM_SHOP.md). The
// server is the only judge: an offer is named by its id and the price read from the table; every check is made before
// a coin moves (a refusal costs nothing); the doubloons, the ledger's row and her stores move in one transaction; the
// goods come through the game's own systems (the army as a tamer's creatures, the hold, the island's yard and its
// builders, the auto-battle scrolls, the path's bag, the locker, the chest of maps). A purchase carries an id of the
// client's own: the same id twice buys once (the ledger row `doubloons_buy` `shop:<offer>:<pid>` is the proof).
//
// Her stores and boosts are the account's (kv `shop:<account>`), so they outlive a captain and an island's move: the
// minutes of speed-ups, the repair kits, the charms, the charters of removal, the brigades (hers for good and hired),
// the elixir, the fair wind, the harvest, the island's charter of protection, the subscription, the level's gifts,
// the first top-up's double, the infirmary's roll of the fallen.

import { lackDoubloons, lackHammocks, lackRoom, lackSlot } from '../../../shared/src/data/buyfail.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { FIELDS, HULLS, LAMPS, LOOK_COLORS, SAILS, EMBLEM_COUNT, DEED_UNLOCKS, STARTING_UNLOCKS } from '../../../shared/src/data/looks.ts';
import { SCROLL_MAX, scrollPool } from '../../../shared/src/data/paths.ts';
import type { PathPageId } from '../../../shared/src/data/paths.ts';
import { premiumFrom } from '../../../shared/src/data/premiumbeasts.ts';
import { STASH_SIZE } from '../../../shared/src/data/items.ts';
import {
  BOOST_MAX_H, BUY_BURST, BUY_MINUTE, CHARM_MORALE, FIRST_PAY_CAP, LEVEL_GIFTS, LEVEL_OFFER_H, OFFERS, PERM_MAX, PROD_BOOST, RECRUIT_KINDS, REFILL_MINUTES,
  PRICE_MAX, PRICE_MIN, REFILL_RATE, SHIELD_MAX_H, SHOP, SUB_DAILY, SUB_MAX_DAYS, SUB_SCROLLS, SUB_XP, TEMP_MAX, WIND_BOOST, XP_BOOST, dayOf, dealOf, finishPrice, weekOf,
} from '../../../shared/src/data/shop.ts';
import type { ShopGrant, ShopOffer } from '../../../shared/src/data/shop.ts';
import type { ShopJobView, ShopView, ShopWhy } from '../../../shared/src/premiumproto.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { baseView, buildersBusy, capOf, crewsBase, mine, reckonBase, yardOf } from './base.ts';
import type { IsleDrop } from '../../../shared/src/data/isleloot.ts';
import { landFighting } from './beastlairs.ts';
import { ownIsland } from './estate.ts';
import { MAX_MAPS, chestCount, grantMap, makeMap } from './explorefx.ts';
import type { Game } from './Game.ts';
import { artifactFind, heroOf } from './hero.ts';
import { giveScroll } from './pathbook.ts';
import type { PlayerSession } from './player.ts';
import { creditPremium, sendBalance, sendPremium } from './premium.ts';
import { stepRefit } from './refit.ts';
import type { ShipEntity } from './ship.ts';
import type { TacSideInput } from './tacbattle.ts';
import { creatureRoom, joinCreatures } from './tame.ts';
import { sanitizeLooks } from './looks.ts';
import { opsPrice, opsShut, saleOf, trackEvent } from './liveops.ts'; // docs/34: the panel's prices, the funnel
import { raiseInstant, recordFallen, resInstant } from './waystations.ts'; // docs/35: the fallen, the scrolls
import { RSCROLL_MAX } from '../../../shared/src/data/resurrect.ts';
import { afterCosBuy, cosWhy, grantCos } from './cosmetics.ts'; // docs/32 §12

const H = 3_600_000;
const D = 86_400_000;

// ------------------------------------------------------------------------------------------------ her stores

interface Buys {
  day: number;
  d: number;
  week: number;
  w: number;
  ever: number;
}

export interface ShopState {
  /** How often each offer was bought: today, this week, ever. */
  buys: Record<string, Buys>;
  /** Brigades of her own; the ends of the hired ones (wall ms). */
  perm: number;
  temp: number[];
  /** Minutes of speed-ups; repair kits; charms; charters of removal. */
  speed: number;
  kits: number;
  charms: number;
  moves: number;
  /** Until when (wall ms): the elixir, the fair wind, the harvest, the island's charter, the subscription. */
  xp: number;
  wind: number;
  prod: number;
  shield: number;
  sub: number;
  /** The last day the subscription's daily gift was handed over. */
  subDay: number;
  /** A level's gift: when it went on the shelf (wall ms), or -1: passed over (a higher level reached first). */
  gifts: Record<string, number>;
  /** The first top-up's double: its gift (to be claimed in the shop) and the payment it came with; claimed, it is taken
   *  back with that payment's refund. */
  firstPay: boolean;
  firstGift?: { ref: string; n: number; claimed: boolean };
  /** docs/35: scrolls of resurrection (one raises a stack of the line kinds, anywhere out of a fight). */
  rscrolls?: number;
}

const fresh = (): ShopState => ({ buys: {}, perm: 0, temp: [], speed: 0, kits: 0, charms: 0, moves: 0, xp: 0, wind: 0, prod: 0, shield: 0, sub: 0, subDay: -1, gifts: {}, firstPay: false });

const cache = new WeakMap<Game, Map<number, ShopState>>();
const key = (accountId: number) => `shop:${accountId}`;

/** Her account's stores (made on first sight; kept in the kv table). */
export function shopState(game: Game, accountId: number): ShopState {
  let m = cache.get(game);
  if (!m) cache.set(game, (m = new Map()));
  let st = m.get(accountId);
  if (!st) {
    st = { ...fresh(), ...(game.db.getKv<Partial<ShopState>>(key(accountId)) ?? {}) } as ShopState;
    st.buys ??= {};
    st.temp = (st.temp ?? []).filter((x) => Number.isFinite(x));
    st.gifts ??= {};
    m.set(accountId, st);
  }
  return st;
}

function save(game: Game, accountId: number, st: ShopState): void {
  game.db.setKv(key(accountId), st);
}

/** For the tests and the admin: her stores forgotten (the next look reads the kv table again). */
export function forgetShop(game: Game, accountId?: number): void {
  if (accountId === undefined) cache.delete(game);
  else cache.get(game)?.delete(accountId);
}

const tempLive = (st: ShopState, now: number) => st.temp.filter((t) => t > now);

// ------------------------------------------------------------------------------------------------ hooks of the game

/** The builders her shop adds to her island's own: hers for good, the hired ones still running, the subscription's. */
export function extraCrews(game: Game, accountId: number): number {
  const st = shopState(game, accountId);
  const now = game.wallNow();
  return Math.min(PERM_MAX, st.perm) + Math.min(TEMP_MAX, tempLive(st, now).length) + (st.sub > now ? 1 : 0);
}

/** The harvest's end on her island (0: none), for the producers' reckoning. */
export function harvestUntil(game: Game, accountId: number): number {
  return shopState(game, accountId).prod;
}
export const HARVEST = PROD_BOOST;

/** Her island's charter of protection holds now. */
export function shielded(game: Game, accountId: number): boolean {
  return shopState(game, accountId).shield > game.wallNow();
}

/** Battle experience's boost now: the elixir and the subscription's. */
export function xpBoost(game: Game, accountId: number): number {
  const st = shopState(game, accountId);
  const now = game.wallNow();
  return (st.xp > now ? XP_BOOST : 0) + (st.sub > now ? SUB_XP : 0);
}

/** A charter of removal in hand: the next move is free of its fee. */
export function hasMoveCharter(game: Game, accountId: number): boolean {
  return shopState(game, accountId).moves > 0;
}

/** The charter spent on a move. */
export function spendMoveCharter(game: Game, accountId: number): void {
  const st = shopState(game, accountId);
  if (st.moves <= 0) return;
  st.moves--;
  save(game, accountId, st);
}

/** A charm on her side of a boarding against the sea's ship (never a captain's): +1 luck, +CHARM_MORALE morale, one
 *  charm spent. The battle's input is changed in place. */
export function charmSide(game: Game, ship: ShipEntity, enemy: ShipEntity, side: TacSideInput): void {
  const s = game.sessionOf(ship);
  if (!s?.authed || game.sessionOf(enemy)) return;
  const st = shopState(game, s.accountId);
  if (st.charms <= 0) return;
  st.charms--;
  save(game, s.accountId, st);
  side.morale = Math.min(100, side.morale + CHARM_MORALE);
  if (side.hero) side.hero.luck = (side.hero.luck ?? 0) + 1;
  game.sendTo(s, { t: 'toast', msg: `A lucky charm: +1 luck and +${CHARM_MORALE} morale for this boarding (${st.charms} left).`, kind: 'gold' });
}

/** After a battle: her fallen (those First Aid and the wounded did not bring back) on her record of the fallen —
 *  docs/35 (waystations.ts): a captain's fight too, raised only after it. Kept for the tests' old word. */
export function noteFallen(game: Game, s: PlayerSession, lost: readonly { u: string; n: number }[], raise: number, _pvp: boolean): void {
  const raised = new Map<string, number>();
  for (const x of lost) raised.set(x.u, (raised.get(x.u) ?? 0) + Math.floor(x.n * Math.max(0, raise)));
  recordFallen(game, s, lost, raised);
}

/** docs/35: her scrolls of resurrection (kept in her shop's store), and one spent by the waystations. */
export function rscrollsOf(game: Game, acc: number): number {
  return Math.max(0, Math.floor(shopState(game, acc).rscrolls ?? 0));
}
export function spendRScroll(game: Game, acc: number): void {
  const st = shopState(game, acc);
  st.rscrolls = Math.max(0, (st.rscrolls ?? 0) - 1);
  save(game, acc, st);
}

/** A payment credited (premium.ts creditPremium): the first of the account lays its gift in the shop — as many
 *  doubloons again, up to FIRST_PAY_CAP — to be claimed there («Забрать»). */
export function notePay(game: Game, accountId: number, n: number, ref: string): void {
  const st = shopState(game, accountId);
  if (st.firstPay) return;
  st.firstPay = true;
  st.firstGift = { ref, n: Math.min(FIRST_PAY_CAP, Math.max(0, Math.floor(n))), claimed: false };
  save(game, accountId, st);
  const s = game.sessionByAccount(accountId);
  if (s) game.sendTo(s, { t: 'toast', msg: `Your first top-up comes double: ${st.firstGift.n} doubloons wait for you in the shop.`, kind: 'gold' });
}

/** The first top-up's gift claimed: credited once, its own ledger row (`doubloons_bonus`). */
export function claimFirstGift(game: Game, s: PlayerSession): string | null {
  const st = shopState(game, s.accountId);
  const g = st.firstGift;
  if (!g || g.claimed || g.n <= 0) return 'There is nothing for it to do now.';
  g.claimed = true;
  save(game, s.accountId, st);
  creditPremium(game, s.accountId, g.n, 'bonus', `first:${g.ref}`);
  return null;
}

/** A refunded payment's first-top-up gift, if it was claimed (taken back with it), or 0. */
export function firstGiftOf(game: Game, accountId: number, ref: string): number {
  const g = shopState(game, accountId).firstGift;
  return g && g.claimed && g.ref === ref ? g.n : 0;
}

/** Every second for a captain aboard: the subscription's day, the fair wind (still under fire), a level's gift. */
export function stepShop(game: Game, s: PlayerSession): void {
  if (!s.authed || !s.profile) return;
  const st = shopState(game, s.accountId);
  const wall = game.wallNow();
  subDaily(game, s, st, wall);
  const ship = s.ship;
  if (ship) {
    const on = st.wind > wall && ship.alive && !ship.boarding && !ship.underFire(game.now);
    const has = ship.hasEffect('fair_wind');
    if (on && !has) ship.addEffect({ id: 'fair_wind', until: game.now + Math.min(60, (st.wind - wall) / 1000), mods: { maxSpeed: WIND_BOOST } }, game.now);
    else if (!on && has) {
      ship.effects = ship.effects.filter((e) => e.id !== 'fair_wind');
      ship.recompute(game.now);
    }
  }
}

/** The subscription's gift of the day, once a day she is aboard while it runs. */
function subDaily(game: Game, s: PlayerSession, st: ShopState, wall: number): void {
  const day = dayOf(wall);
  if (st.sub <= wall || st.subDay >= day) return;
  st.subDay = day;
  save(game, s.accountId, st);
  creditPremium(game, s.accountId, SUB_DAILY, 'sub', `sub:${day}`);
  game.db.transaction(() => {
    if (game.db.addScrolls(s.accountId, SUB_SCROLLS) !== null) game.db.ledger(s.accountId, 'autoscroll_sub', SUB_SCROLLS, `sub:${day}`);
  });
  sendBalance(game, s);
  game.sendTo(s, { t: 'toast', msg: `The captain’s subscription: ${SUB_DAILY} doubloons and an auto-battle scroll for today.`, kind: 'gold' });
}

/** A level's gift goes on the shelf when she reaches its level (only the highest reached, the lower passed over). */
export function levelGifts(game: Game, s: PlayerSession, say = false): void {
  if (!s.authed || !s.profile) return;
  const st = shopState(game, s.accountId);
  const lv = s.profile.level;
  const reached = LEVEL_GIFTS.filter((l) => l <= lv);
  const top = reached[reached.length - 1];
  let changed = false;
  for (const l of reached) {
    if (st.gifts[l] !== undefined) continue;
    st.gifts[l] = l === top ? game.wallNow() : -1;
    changed = true;
    if (l === top && say) game.sendTo(s, { t: 'toast', msg: `A gift for level ${l} is in the shop for three days.`, kind: 'gold' });
  }
  if (changed) save(game, s.accountId, st);
}

// ------------------------------------------------------------------------------------------------ what stands in the way

const inFight = (game: Game, s: PlayerSession): boolean => {
  const ship = s.ship;
  return !ship || !ship.alive || !!ship.boarding || ship.underFire(game.now) || landFighting(game, s);
};

/** Buys left of an offer in its period (Infinity: no limit). */
function leftOf(st: ShopState, offer: ShopOffer, wall: number): number {
  if (!offer.limit) return Infinity;
  const b = st.buys[offer.id];
  const day = dayOf(wall), week = weekOf(wall);
  const had = !b ? 0 : offer.limit.per === 'day' ? (b.day === day ? b.d : 0) : offer.limit.per === 'week' ? (b.week === week ? b.w : 0) : b.ever;
  return Math.max(0, offer.limit.n - had);
}

/** The pages of her path's book a scroll may still be drawn from (five of a kind at most), with room for each. */
function pageRoom(s: PlayerSession): { id: PathPageId; room: number }[] {
  const h = heroOf(s.profile!);
  const top = Math.max(1, Math.min(5, Math.ceil((s.ship?.shipLevel ?? 1) / 2)));
  return scrollPool(top).map((id) => ({ id, room: SCROLL_MAX - (h.scrolls?.[id] ?? 0) })).filter((x) => x.room > 0);
}

/** The parts of a ship's look the shop sells (never a deed's), and those of them not yet hers. */
const DEED_KEYS = new Set(Object.entries(DEED_UNLOCKS).filter(([k]) => k !== 'quest').flatMap(([, v]) => v));
export const SHOP_LOOKS: string[] = [
  ...SAILS.map((_, i) => `sail:${i}`), ...HULLS.map((_, i) => `hull:${i}`), ...LAMPS.map((_, i) => `lamp:${i}`),
  ...LOOK_COLORS.map((_, i) => `color:${i}`), ...FIELDS.map((_, i) => `field:${i}`), ...Array.from({ length: EMBLEM_COUNT }, (_, i) => `emblem:${i}`),
].filter((k) => !DEED_KEYS.has(k) && !STARTING_UNLOCKS.includes(k));

function looksLeft(s: PlayerSession): string[] {
  const { unlocks } = sanitizeLooks(s.profile!);
  return SHOP_LOOKS.filter((k) => !unlocks.includes(k));
}

/** The infirmary as it stands (null: nothing to bring back), what comes aboard and its price: her record of the
 *  fallen's line kinds, at once and anywhere (docs/35, waystations.ts resInstant). */
function fallenNow(game: Game, s: PlayerSession, _st: ShopState): { units: { u: UnitId; n: number }[]; n: number; price: number; until: number } | null {
  return resInstant(game, s);
}

/** Why one grant cannot be had now (null: it can). */
function grantWhy(game: Game, s: PlayerSession, st: ShopState, g: ShopGrant, offer: ShopOffer, count: Map<string, number>): ShopWhy | null {
  const wall = game.wallNow();
  const p = s.profile!;
  const ship = s.ship;
  switch (g.k) {
    case 'speed':
    case 'builder':
    case 'scrolls':
      return null;
    case 'perm': {
      const need = offer.id === 'bperm_2' ? 1 : 0;
      if (st.perm > need || st.perm >= PERM_MAX) return 'max';
      return st.perm < need ? 'order' : null;
    }
    // (the harvest and the charter in a bundle are kept for the island to come; sold alone, they need one)
    case 'res':
    case 'prod':
      if (!ownIsland(game, s.accountId) && (g.k === 'res' || offer.grants.length === 1)) return 'island';
      return g.k === 'prod' && Math.max(wall, st.prod) + g.hours * H > wall + BOOST_MAX_H * H ? 'max' : null;
    case 'shield':
      if (!ownIsland(game, s.accountId) && offer.grants.length === 1) return 'island';
      return Math.max(wall, st.shield) + g.hours * H > wall + SHIELD_MAX_H * H ? 'max' : null;
    case 'move':
      return st.moves >= 3 ? 'max' : null;
    case 'xp':
      return Math.max(wall, st.xp) + g.hours * H > wall + BOOST_MAX_H * H ? 'max' : null;
    case 'wind':
      return Math.max(wall, st.wind) + g.hours * H > wall + BOOST_MAX_H * H ? 'max' : null;
    case 'charm':
      return st.charms + g.n > 999 ? 'max' : null;
    case 'kit':
      return st.kits + g.n > 999 ? 'max' : null;
    case 'rscroll':
      return (st.rscrolls ?? 0) + g.n > RSCROLL_MAX ? 'max' : null;
    case 'pages': {
      const n = (count.get('pages') ?? 0) + g.n;
      count.set('pages', n);
      return pageRoom(s).reduce((a, x) => a + x.room, 0) < n ? 'room' : null;
    }
    case 'art': {
      const n = (count.get('art') ?? 0) + 1;
      count.set('art', n);
      return p.stash.length + n > STASH_SIZE ? 'room' : null;
    }
    case 'ammo':
      return !ship || !ship.alive || ship.boarding ? 'fight' : null;
    case 'cargo': {
      if (!ship || !ship.alive || ship.boarding) return 'fight';
      const v = (count.get('vol') ?? 0) + cargoVolume({ [g.good]: g.n }, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
      count.set('vol', v);
      const used = cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
      return used + v > ship.stats.holdVolume ? 'hold' : null;
    }
    case 'crew':
    case 'units': {
      if (inFight(game, s)) return 'fight';
      const u: UnitId = g.k === 'crew' ? 'deckhand' : RECRUIT_KINDS[g.tier - 1];
      if (g.k === 'units' && ship!.shipLevel < premiumFrom(g.tier)) return 'tier';
      const room = creatureRoom(ship!, u);
      if (room <= 0 && ship!.army.length >= ship!.armySlots && !ship!.army.some((x) => x.u === u && !x.g)) return 'slot';
      // (a pack signs on as many as the free hammocks hold, up to its number: room for one at least)
      return room < 1 ? 'room' : null;
    }
    case 'refill': {
      if (inFight(game, s)) return 'fight';
      const f = fallenNow(game, s, st);
      return !f || f.n <= 0 ? 'none' : null;
    }
    case 'pardon':
      return p.infamy < 20 ? 'none' : null;
    case 'map':
      return chestCount(p.explore.maps) + g.n > MAX_MAPS ? 'room' : null;
    case 'looks':
      return looksLeft(s).length ? null : 'none';
    case 'sub':
      return Math.max(wall, st.sub) + g.days * D > wall + SUB_MAX_DAYS * D ? 'max' : null;
    case 'cos':
      return cosWhy(game, s.accountId, g.keys); // docs/32 §12: all of it hers already
  }
}

/** The price of an offer for her now (the deal's, the infirmary's by her fallen). */
function priceOf(game: Game, s: PlayerSession, st: ShopState, offer: ShopOffer, deal = false): number {
  if (deal) return dealOf(dayOf(game.wallNow())).price;
  if (offer.id === 'refill') return fallenNow(game, s, st)?.price ?? 0;
  return opsPrice(game, offer); // (the catalog's, unless the live ops' panel set its own or a sale runs: docs/34)
}

/** Why an offer cannot be bought now (null: it can). */
function offerWhy(game: Game, s: PlayerSession, st: ShopState, offer: ShopOffer, deal = false): ShopWhy | null {
  const wall = game.wallNow();
  const fam = OFFERS.get(offer.id)!.fam;
  if (opsShut(game, offer.id)) return 'gone'; // taken off the shelves by the live ops' panel (docs/34)
  if ((offer.from !== undefined && wall < offer.from) || (offer.until !== undefined && wall >= offer.until)) return 'gone'; // a season's bundle (docs/32 §12)
  if (fam.level) {
    const at = st.gifts[fam.level];
    if (at === undefined || at < 0 || wall > at + LEVEL_OFFER_H * H) return 'gone';
  }
  if (deal ? (st.buys.deal?.day === dayOf(wall) && st.buys.deal.d >= 1) : leftOf(st, offer, wall) <= 0) return 'limit';
  const count = new Map<string, number>();
  for (const g of offer.grants) {
    // (by the account alone — the website's shop for a captain not aboard: her ship's goods wait for her, unjudged)
    if (!s.profile && !ACCOUNT_GRANTS.has(g.k)) continue;
    const why = grantWhy(game, s, st, g, offer, count);
    if (why) return why;
  }
  return game.db.doubloons(s.accountId) < priceOf(game, s, st, offer, deal) ? 'poor' : null;
}

/** Why an offer of the shelves cannot be had now, the purse aside (null: it can) — for the personal offers (promo.ts). */
export function offerShut(game: Game, s: PlayerSession, offer: ShopOffer): ShopWhy | null {
  const why = offerWhy(game, s, shopState(game, s.accountId), offer);
  return why === 'poor' ? null : why;
}

// ------------------------------------------------------------------------------------------------ granting

const shopRng = new WeakMap<Game, Rng>();
function sr(game: Game): Rng {
  let r = shopRng.get(game);
  if (!r) shopRng.set(game, (r = new Rng(0x5409e)));
  return r;
}

/** One grant handed over (every check made already). */
function grant(game: Game, s: PlayerSession, st: ShopState, g: ShopGrant, offerId: string): void {
  const wall = game.wallNow();
  const p = s.profile!;
  const ship = s.ship;
  switch (g.k) {
    case 'speed':
      st.speed += g.min;
      return;
    case 'builder': {
      const live = tempLive(st, wall);
      if (live.length < TEMP_MAX) live.push(wall + g.days * D);
      else {
        const i = live.indexOf(Math.min(...live));
        live[i] += g.days * D;
      }
      st.temp = live;
      return;
    }
    case 'perm':
      st.perm = Math.min(PERM_MAX, st.perm + 1);
      return;
    case 'res': {
      const h = ownIsland(game, s.accountId)!;
      reckonBase(game, h);
      const y = yardOf(game, h);
      y.res[g.good] = (y.res[g.good] ?? 0) + g.n;
      game.holdings.touch();
      return;
    }
    case 'prod': {
      // the yield up to now at the old rate, then the harvest from here
      const h = ownIsland(game, s.accountId);
      if (h) reckonBase(game, h);
      st.prod = Math.max(wall, st.prod) + g.hours * H;
      return;
    }
    case 'shield':
      st.shield = Math.max(wall, st.shield) + g.hours * H;
      return;
    case 'move':
      st.moves++;
      return;
    case 'xp':
      st.xp = Math.max(wall, st.xp) + g.hours * H;
      return;
    case 'wind':
      st.wind = Math.max(wall, st.wind) + g.hours * H;
      return;
    case 'charm':
      st.charms += g.n;
      return;
    case 'kit':
      st.kits += g.n;
      return;
    case 'scrolls':
      if (game.db.addScrolls(s.accountId, g.n) === null) throw new Error('auto-battle scrolls: no such account');
      game.db.ledger(s.accountId, 'autoscroll_buy', g.n, offerId);
      return;
    case 'pages':
      for (let i = 0; i < g.n; i++) {
        const room = pageRoom(s);
        if (!room.length) break;
        giveScroll(game, s, sr(game).pick(room).id, true);
      }
      return;
    case 'art':
      artifactFind(game, s, 'chest');
      return;
    case 'ammo':
      ship!.ammo[g.ammo] = (ship!.ammo[g.ammo] ?? 0) + g.n;
      return;
    case 'cargo':
      ship!.cargo[g.good] = (ship!.cargo[g.good] ?? 0) + g.n;
      return;
    case 'crew':
      joinCreatures(game, s, 'deckhand', g.n);
      return;
    case 'units':
      joinCreatures(game, s, RECRUIT_KINDS[g.tier - 1], g.n);
      return;
    case 'refill': {
      const f = fallenNow(game, s, st);
      raiseInstant(game, s, f?.units ?? []);
      return;
    }
    case 'rscroll':
      st.rscrolls = Math.min(RSCROLL_MAX, (st.rscrolls ?? 0) + g.n);
      return;
    case 'pardon':
      p.infamy = Math.min(p.infamy, 10);
      return;
    case 'map':
      for (let i = 0; i < g.n; i++) grantMap(game, s, makeMap(game, Math.max(1, Math.min(3, Math.ceil((ship?.shipLevel ?? 1) / 3)))), 'The shop');
      return;
    case 'looks': {
      const left = looksLeft(s);
      const { unlocks } = sanitizeLooks(p);
      for (let i = 0; i < g.n && left.length; i++) unlocks.push(left.splice(sr(game).int(0, left.length - 1), 1)[0]);
      return;
    }
    case 'sub':
      st.sub = Math.max(wall, st.sub) + g.days * D;
      return;
    case 'cos':
      grantCos(game, s, g.keys);
      return;
  }
}

/** The bought counted against the offer's limit. */
function count(st: ShopState, id: string, wall: number): void {
  const b = st.buys[id] ?? { day: -1, d: 0, week: -1, w: 0, ever: 0 };
  const day = dayOf(wall), week = weekOf(wall);
  if (b.day !== day) {
    b.day = day;
    b.d = 0;
  }
  if (b.week !== week) {
    b.week = week;
    b.w = 0;
  }
  b.d++;
  b.w++;
  b.ever++;
  st.buys[id] = b;
}

// ------------------------------------------------------------------------------------------------ the flood guard

const buyTimes = new WeakMap<PlayerSession, number[]>();

/** Whether this buy is within her pace (BUY_BURST in two seconds, BUY_MINUTE a minute); counted if it is. */
export function buyPace(game: Game, s: PlayerSession): boolean {
  const now = Date.now();
  const list = (buyTimes.get(s) ?? []).filter((t) => now - t < 60_000);
  if (list.filter((t) => now - t < 2000).length >= BUY_BURST || list.length >= BUY_MINUTE) {
    buyTimes.set(s, list);
    return false;
  }
  list.push(now);
  buyTimes.set(s, list);
  return true;
}

const PID = /^[A-Za-z0-9_-]{6,40}$/;

/** A purchase's id checked, and whether it was spent already (the ledger's row). */
function spentPid(game: Game, s: PlayerSession, detail: string): boolean {
  return game.db.doubloonRef(s.accountId, 'doubloons_buy', detail);
}

/** A refusal in words (her window says the same in her language). */
export function shopWhyText(why: ShopWhy): string {
  switch (why) {
    case 'poor': return 'Not enough doubloons: top up your account first.';
    case 'limit': return 'Bought as often as it may be for now.';
    case 'island': return 'This is for your own island: claim one first.';
    case 'fight': return 'Not in the middle of a fight.';
    case 'slot': return 'No free slot in the army for a new kind of man.';
    case 'room': return 'No room for it: make room first.';
    case 'hold': return 'No room in the hold for it.';
    case 'tier': return 'Your ship’s level is too low for this tier.';
    case 'max': return 'You have as much of it as may be held.';
    case 'none': return 'There is nothing for it to do now.';
    case 'gone': return 'This offer is gone.';
    case 'order': return 'Buy the first brigade of your own before the second.';
  }
}

/** A refusal with its numbers (owner, 2026-10-21): the doubloons missing, the hold's m³ wanted against its free, the
 *  hammocks wanted against the free; the rest as shopWhyText says it. */
function whyNumbers(game: Game, s: PlayerSession, offer: ShopOffer, why: ShopWhy, price: number): string {
  const ship = s.ship;
  if (why === 'poor' && price > 0) return `${lackDoubloons(price, game.db.doubloons(s.accountId))} — top up your account first.`;
  if (why === 'hold' && ship) {
    const st = ship.stats;
    let need = 0;
    for (const g of offer.grants) if (g.k === 'cargo') need += cargoVolume({ [g.good]: g.n }, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
    const free = st.holdVolume - cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
    return lackRoom(need, free);
  }
  if (why === 'room' && ship && offer.grants.some((g) => g.k === 'crew' || g.k === 'units')) return lackHammocks(1, ship.crew, ship.stats.crewMax);
  if (why === 'slot' && ship) return lackSlot(ship.army.length, ship.armySlots);
  return shopWhyText(why);
}

/** An offer of the shop bought (or the deal of the day: `deal`): every check, then the doubloons, the ledger's row,
 *  her stores and the goods together. Null: bought (or bought already by this purchase id); else the refusal. */
export function buyOffer(game: Game, s: PlayerSession, offerId: string, pid: string, promo?: { price: number; tag: string; done: () => void; count?: string }, quiet = false): string | null {
  if (!s.authed || !s.profile) return 'Not for sale';
  return buyCore(game, s, true, offerId, pid, promo, quiet);
}

/** The goods that are the account's alone — its stores, its scrolls, its wardrobe, its island by the account — and need
 *  nothing of a captain aboard: an offer made only of them can be bought for a captain who is not at sea (the website's
 *  shop, server/src/game/webshop.ts). */
const ACCOUNT_GRANTS = new Set<ShopGrant['k']>(['speed', 'builder', 'perm', 'res', 'prod', 'shield', 'move', 'xp', 'wind', 'charm', 'kit', 'scrolls', 'rscroll', 'sub', 'cos']);
export const accountOffer = (offer: ShopOffer): boolean => offer.grants.every((g) => ACCOUNT_GRANTS.has(g.k));

/** Why an offer cannot be had by this account now, the purse aside (null: it can) — aboard through her session, else by
 *  the account (an offer of the account's goods only; anything else: 'gone'). */
export function accountOfferWhy(game: Game, accountId: number, offerId: string, deal = false): ShopWhy | null {
  const found = deal ? { offer: dealOf(dayOf(game.wallNow())).offer } : OFFERS.get(String(offerId ?? ''));
  if (!found) return 'gone';
  const s = game.sessionByAccount(accountId);
  // (not aboard: the account's own checks — its limits, its level's gift, its stores; the goods of her ship are judged
  // when she comes aboard to take them: server/src/game/webshop.ts)
  const who = s?.authed && s.profile ? s : standIn(accountId);
  const why = offerWhy(game, who, shopState(game, accountId), found.offer, deal);
  return why === 'poor' ? null : why;
}

/** The account in a session's stead: the account's goods read nothing of a session but its account. */
const standIn = (accountId: number) => ({ accountId, authed: true, profile: null, ship: null }) as unknown as PlayerSession;

/** An offer bought for an account (the website's shop): through her session if she is aboard — the very purchase of the
 *  shop's window — else by the account, for an offer of the account's goods only. Null: bought; else the refusal. */
export function buyForAccount(game: Game, accountId: number, offerId: string, pid: string, promo?: { price: number; tag: string; done: () => void; count?: string }, quiet = false): string | null {
  const s = game.sessionByAccount(accountId);
  if (s?.authed && s.profile) return buyOffer(game, s, offerId, pid, promo, quiet);
  const found = OFFERS.get(String(offerId ?? ''));
  if (!found || !accountOffer(found.offer) || !game.db.accountById(accountId)) return 'Not for sale';
  return buyCore(game, standIn(accountId), false, offerId, pid, promo, true);
}

function buyCore(game: Game, s: PlayerSession, aboard: boolean, offerId: string, pid: string, promo: { price: number; tag: string; done: () => void; count?: string } | undefined, quiet: boolean): string | null {
  const deal = offerId === 'deal';
  const day = dayOf(game.wallNow());
  const found = deal ? { offer: dealOf(day).offer } : OFFERS.get(String(offerId ?? ''));
  if (!found) return 'Not for sale';
  if (!PID.test(String(pid ?? ''))) return 'Not for sale';
  const offer = found.offer;
  const detail = `shop:${promo ? promo.tag : deal ? `deal${day}` : offer.id}:${pid}`;
  if (spentPid(game, s, detail)) return null;
  const st = shopState(game, s.accountId);
  // (a personal offer, promo.ts: its own price — the balance is checked against it, every other check as a buy's)
  const why = promo ? offerShut(game, s, offer) ?? (game.db.doubloons(s.accountId) < promo.price ? 'poor' : null) : offerWhy(game, s, st, offer, deal);
  if (why) return whyNumbers(game, s, offer, why, promo ? promo.price : priceOf(game, s, st, offer, deal));
  const price = promo ? promo.price : priceOf(game, s, st, offer, deal);
  if (!(price > 0)) return 'Not for sale';
  const wall = game.wallNow();
  let done = false;
  game.db.transaction(() => {
    if (game.db.addDoubloons(s.accountId, -price) === null) return;
    game.db.ledger(s.accountId, 'doubloons_buy', -price, detail);
    for (const g of offer.grants) grant(game, s, st, g, offer.id);
    count(st, promo?.count ?? (deal ? 'deal' : offer.id), wall);
    save(game, s.accountId, st);
    promo?.done();
    if (aboard) game.saveSession(s);
    done = true;
  });
  if (!done) return shopWhyText('poor');
  if (aboard) afterBuy(game, s, offer);
  trackEvent(game, s.accountId, 'buy', { amount: price, product: promo ? `${promo.tag.split(':')[0]}:${offer.id}` : deal ? `deal:${offer.id}` : offer.id }); // docs/34
  if (aboard && !quiet) game.sendTo(s, { t: 'toast', msg: `Bought for ${price} doubloons.`, kind: 'gold' });
  return null;
}

/** After a purchase: her balance, her ship, her island's window, the battle's screen (the scrolls). */
function afterBuy(game: Game, s: PlayerSession, offer?: ShopOffer): void {
  sendBalance(game, s);
  if (offer?.grants.some((g) => g.k === 'cos')) afterCosBuy(game, s); // docs/32 §12: her wardrobe
  game.pushSelf(s, true);
  if (offer?.grants.some((g) => g.k === 'res' || g.k === 'builder' || g.k === 'perm' || g.k === 'prod' || g.k === 'sub' || g.k === 'speed')) {
    const v = baseView(game, s);
    if (v) game.sendTo(s, { t: 'base', view: v });
  }
}

// ------------------------------------------------------------------------------------------------ the creatures' loot

/** docs/29 §9 (owner, 2026-10-17): a drop of the island's loot from a creature of the islands, into the same stores as
 *  the shop's goods — the minutes of speed-ups, a day's brigade, the harvest, the yard. False: nothing to put it in (no
 *  island for the yard's goods, the harvest or a brigade; the yard full). */
export function isleLootGrant(game: Game, s: PlayerSession, d: IsleDrop): boolean {
  const st = shopState(game, s.accountId);
  const wall = game.wallNow();
  const h = ownIsland(game, s.accountId);
  switch (d.k) {
    case 'speed':
      st.speed += d.min;
      break;
    case 'builder': {
      if (!h) return false;
      const live = tempLive(st, wall);
      if (live.length < TEMP_MAX) live.push(wall + d.hours * H);
      else {
        const i = live.indexOf(Math.min(...live));
        live[i] += d.hours * H;
      }
      st.temp = live;
      break;
    }
    case 'prod':
      if (!h) return false;
      reckonBase(game, h);
      st.prod = Math.min(wall + BOOST_MAX_H * H, Math.max(wall, st.prod) + d.hours * H);
      break;
    case 'res': {
      if (!h) return false;
      reckonBase(game, h);
      const y = yardOf(game, h);
      const room = Math.max(0, Math.floor(capOf(h) - (y.res[d.good] ?? 0)));
      const k = Math.min(room, d.n);
      if (k <= 0) return false;
      y.res[d.good] = (y.res[d.good] ?? 0) + k;
      d.n = k;
      game.holdings.touch();
      break;
    }
  }
  save(game, s.accountId, st);
  return true;
}

/** Minutes of her speed-ups spent on a job (-1: the yard's refit of her ship), as many as it needs. */
export function useSpeed(game: Game, s: PlayerSession, jobId: number): string | null {
  if (!s.authed || !s.profile) return 'Not for sale';
  const st = shopState(game, s.accountId);
  if (st.speed <= 0) return 'No speed-ups in store: buy them in the shop.';
  const wall = game.wallNow();
  const p = s.profile;
  if (Math.trunc(jobId) === -1) {
    if (!p.refit || p.refit.until <= wall) return 'That work is done.';
    const k = Math.min(st.speed, Math.ceil((p.refit.until - wall) / 60_000));
    st.speed -= k;
    p.refit.until = Math.max(wall, p.refit.until - k * 60_000);
    save(game, s.accountId, st);
    stepRefit(game, s);
    return null;
  }
  const m = mine(game, s);
  if (typeof m === 'string') return m;
  const j = m.y.jobs.find((x) => x.id === Math.trunc(jobId));
  if (!j || j.end <= wall) return 'That work is done.';
  const k = Math.min(st.speed, Math.ceil((j.end - wall) / 60_000));
  st.speed -= k;
  j.end = Math.max(wall, j.end - k * 60_000);
  save(game, s.accountId, st);
  game.holdings.touch();
  reckonBase(game, m.h);
  const v = baseView(game, s);
  if (v) game.sendTo(s, { t: 'base', view: v });
  return null;
}

/** A job finished now for doubloons (FINISH_PER_MIN a minute left); the purchase id as a buy's. */
export function finishNow(game: Game, s: PlayerSession, jobId: number, pid: string): string | null {
  if (!s.authed || !s.profile || !PID.test(String(pid ?? ''))) return 'Not for sale';
  const wall = game.wallNow();
  const p = s.profile;
  const id = Math.trunc(jobId);
  const detail = `finish:${id}:${pid}`;
  if (spentPid(game, s, detail)) return null;
  let end: number;
  let set: (t: number) => void;
  let after: () => void;
  if (id === -1) {
    if (!p.refit || p.refit.until <= wall) return 'That work is done.';
    end = p.refit.until;
    set = (t) => (p.refit!.until = t);
    after = () => stepRefit(game, s);
  } else {
    const m = mine(game, s);
    if (typeof m === 'string') return m;
    const j = m.y.jobs.find((x) => x.id === id);
    if (!j || j.end <= wall) return 'That work is done.';
    end = j.end;
    set = (t) => (j.end = t);
    after = () => {
      game.holdings.touch();
      reckonBase(game, m.h);
      const v = baseView(game, s);
      if (v) game.sendTo(s, { t: 'base', view: v });
    };
  }
  const price = finishPrice((end - wall) / 1000);
  let done = false;
  game.db.transaction(() => {
    if (game.db.addDoubloons(s.accountId, -price) === null) return;
    game.db.ledger(s.accountId, 'doubloons_buy', -price, detail);
    set(wall);
    done = true;
  });
  if (!done) return shopWhyText('poor');
  trackEvent(game, s.accountId, 'buy', { amount: price, product: 'finish' }); // docs/34
  after();
  sendBalance(game, s);
  return null;
}

/** A repair kit used: hull, canvas, rudder and guns whole at once, out of a fight. */
export function useKit(game: Game, s: PlayerSession): string | null {
  if (!s.authed || !s.profile) return 'Not for sale';
  const st = shopState(game, s.accountId);
  if (st.kits <= 0) return 'No repair kits in store: buy them in the shop.';
  if (inFight(game, s)) return shopWhyText('fight');
  const ship = s.ship!;
  if (ship.hull >= ship.stats.hullMax && ship.sails >= ship.stats.sailHpMax && ship.rudderHp >= 1 && !ship.gunsDisabled.port && !ship.gunsDisabled.starboard) return 'She is already sound';
  st.kits--;
  save(game, s.accountId, st);
  ship.hull = ship.stats.hullMax;
  ship.sails = ship.stats.sailHpMax;
  ship.rudderHp = 1;
  ship.gunsDisabled = { port: 0, starboard: 0 };
  ship.water = 0;
  ship.leaks = 0;
  if (ship.hasEffect('broken_mast')) ship.effects = ship.effects.filter((e) => e.id !== 'broken_mast' && e.id !== 'mast_wreck');
  ship.recompute(game.now);
  game.pushSelf(s, true);
  game.sendTo(s, { t: 'toast', msg: `A repair kit: she is whole again (${st.kits} left).`, kind: 'good' });
  return null;
}

// ------------------------------------------------------------------------------------------------ the view

export function shopView(game: Game, s: PlayerSession): ShopView {
  levelGifts(game, s);
  const st = shopState(game, s.accountId);
  const wall = game.wallNow();
  const day = dayOf(wall);
  const why: Record<string, ShopWhy> = {};
  const left: Record<string, number> = {};
  const price: Record<string, number> = {};
  const sale: NonNullable<ShopView['sale']> = {};
  for (const fam of SHOP) for (const offer of fam.offers) {
    // (the live ops' panel: its own price and a sale running — docs/34; none: nothing sent, the catalog's stands)
    const p = opsPrice(game, offer);
    if (p !== offer.price) price[offer.id] = p;
    const sl = saleOf(game, offer);
    if (sl) sale[offer.id] = sl;
    const w = offerWhy(game, s, st, offer);
    if (w) why[offer.id] = w;
    const l = leftOf(st, offer, wall);
    if (Number.isFinite(l)) left[offer.id] = l;
  }
  const f = fallenNow(game, s, st);
  price.refill = f?.price ?? 0;
  const d = dealOf(day);
  const h = ownIsland(game, s.accountId);
  let crews: ShopView['crews'] = null;
  const jobs: ShopJobView[] = [];
  if (h) {
    reckonBase(game, h);
    const y = yardOf(game, h);
    const live = tempLive(st, wall).sort((a, b) => a - b);
    const base = crewsBase(h);
    const sub = st.sub > wall ? 1 : 0;
    crews = { base, perm: Math.min(PERM_MAX, st.perm), temp: live.slice(0, TEMP_MAX), sub, n: base + Math.min(PERM_MAX, st.perm) + Math.min(TEMP_MAX, live.length) + sub, busy: buildersBusy(y) };
    for (const j of y.jobs) if (j.end > wall) jobs.push({ id: j.id, what: j.ship ? 'ship' : j.what, level: j.level, start: j.start, end: j.end, finish: finishPrice((j.end - wall) / 1000) });
  }
  const r = s.profile!.refit;
  if (r && r.until > wall) jobs.push({ id: -1, what: 'refit', level: r.to, start: wall, end: r.until, finish: finishPrice((r.until - wall) / 1000) });
  jobs.sort((a, b) => a.end - b.end);
  return {
    now: wall, dayEnds: (day + 1) * D, why, left, price, ...(Object.keys(sale).length ? { sale } : {}),
    deal: { id: d.offer.id, price: d.price, why: offerWhy(game, s, st, d.offer, true) },
    gifts: LEVEL_GIFTS.filter((l) => (st.gifts[l] ?? -1) >= 0 && wall <= st.gifts[l] + LEVEL_OFFER_H * H && why[`lv${l}`] !== 'limit').map((l) => ({ id: `lv${l}`, until: st.gifts[l] + LEVEL_OFFER_H * H })),
    inv: { speed: st.speed, kits: st.kits, charms: st.charms, moves: st.moves, rs: Math.floor(st.rscrolls ?? 0) },
    boosts: { xp: st.xp > wall ? st.xp : 0, wind: st.wind > wall ? st.wind : 0, prod: st.prod > wall ? st.prod : 0, shield: st.shield > wall ? st.shield : 0, sub: st.sub > wall ? st.sub : 0 },
    crews, jobs,
    fallen: f && f.n > 0 ? { n: f.n, until: f.until } : null,
    firstPay: !st.firstPay,
    gift: st.firstGift && !st.firstGift.claimed ? st.firstGift.n : 0,
  };
}

/** Her client's word to the shop's goods (the view comes back after it, premium.ts). */
export function shopMessage(game: Game, s: PlayerSession, action: 'shop' | 'speed' | 'finish' | 'kit' | 'gift', msg: { offer?: string; pid?: string; job?: number }): void {
  if ((action === 'shop' || action === 'finish') && !buyPace(game, s)) {
    game.sendTo(s, { t: 'toast', msg: 'Slowly: one purchase at a time.', kind: 'bad' });
    return;
  }
  const why = action === 'shop' ? buyOffer(game, s, String(msg.offer ?? ''), String(msg.pid ?? ''))
    : action === 'speed' ? useSpeed(game, s, Number(msg.job))
    : action === 'finish' ? finishNow(game, s, Number(msg.job), String(msg.pid ?? ''))
    : action === 'gift' ? claimFirstGift(game, s)
    : useKit(game, s);
  if (why) game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
  sendPremium(game, s);
}
