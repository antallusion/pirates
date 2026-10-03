// The premium hulls' gifts at work (owner, 2026-10-03; shared/src/data/shipgifts.ts, docs/02 §1.A.9): seven kinds of
// mechanic, each carried out here for every hull whose gift is of that kind, with that hull's numbers —
//
//   rally, toll, sail and muster at sea: once a second for a captain's ship at sea (Game.shipSecond, after the talents);
//   strike: on every ball of her broadside that strikes home (combat.ts, resolveHit);
//   deck: laid on the boarding battle as it is set out (tactical.ts sideOf, tacbattle.ts newHero);
//   trade: folded into her prices in port (ports.ts priceMods);
//
// and, for every premium hull whatever her gift, her own creatures mustered back to their number when she makes port.
// Every effect goes through the stat pipeline as a short status effect, as the talents' do (talentfx.ts), so the
// client's own prediction carries it; the cooldowns are kept on the ship (`talentReady`), as the talents' are.

import { isNight } from '../../../shared/src/constants.ts';
import { GOOD_IDS } from '../../../shared/src/data/goods.ts';
import { SHIP_BEAST_PLURAL, isShipBeast } from '../../../shared/src/data/shipbeasts.ts';
import { OPEN_WATER, giftOf } from '../../../shared/src/data/shipgifts.ts';
import type { DeckGift, MusterGift, RallyGift, SailGift, SailWhen, TollGift } from '../../../shared/src/data/shipgifts.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { dist } from '../../../shared/src/math.ts';
import { applyDamage, damageBlocked, igniteShip } from './combat.ts';
import { reconcile } from './crew.ts';
import type { PriceMods } from './economy.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** The status effects a gift lays: on her, and on the ship it falls on (one of each at a time: a fresh one replaces). */
export const GIFT_SELF = 'ship_gift';
export const GIFT_FOE = 'ship_gift_foe';
/** A positional gift's effect is refreshed every second while its sea holds (as the talents' pulses are). */
const PULSE = 1.6;

const ready = (ship: ShipEntity, now: number): boolean => (ship.talentReady.gift ?? 0) <= now;

/** Two ships in a fight with each other: one has struck the other within the minute. A toll falls only on these, so a
 *  gift never drags a bystander into her fight. */
function engaged(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  const t = game.now - 60;
  return (b.attackers.get(a.id) ?? -999) > t || (a.attackers.get(b.id) ?? -999) > t;
}

// ------------------------------------------------------------------------------------------------ at sea, each second

/** Her gift's second at sea (a captain's ship, afloat and out of port). */
export function stepGifts(game: Game, ship: ShipEntity): void {
  if (!ship.alive || ship.docked) return;
  const g = giftOf(ship.loadout.classId);
  if (!g) return;
  if (g.kind === 'rally') rally(game, ship, g);
  else if (g.kind === 'toll') toll(game, ship, g);
  else if (g.kind === 'sail') sail(game, ship, g);
  else if (g.kind === 'muster') musterAtSea(game, ship, g);
}

/** Rally: in a fight, below her share of hull — what she gains (her guns, her armour, mist), a hull mended at once. */
function rally(game: Game, ship: ShipEntity, g: RallyGift): void {
  const now = game.now;
  if (!ship.inCombat(now) || ship.hull >= ship.stats.hullMax * g.below || !ready(ship, now)) return;
  ship.talentReady.gift = now + g.cd;
  if (g.mend) {
    ship.hull = Math.min(ship.stats.hullMax, ship.hull + ship.stats.hullMax * g.mend);
    ship.leaks = 0;
  }
  if (g.secs > 0 && (g.self || g.selfFlags)) ship.addEffect({ id: GIFT_SELF, until: now + g.secs, mods: g.self, flags: g.selfFlags }, now);
  if (g.fx) game.emit({ k: 'fx', fx: g.fx, x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: Math.round(ship.stats.length * 2) }, ship.state.x, ship.state.y);
  game.toastShip(ship, `${g.name[0]}! ${g.cry[0]}`, 'good');
}

/** Toll: in a fight, every `cd` seconds, every enemy engaged with her within her reach — its hull, its morale, an effect
 *  for a while. */
function toll(game: Game, ship: ShipEntity, g: TollGift): void {
  const now = game.now;
  if (!ship.inCombat(now) || !ready(ship, now)) return;
  const hit: ShipEntity[] = [];
  game.forShipsNear(ship.state.x, ship.state.y, g.r + 80, (o) => {
    if (o.id === ship.id || !o.alive || o.docked || !engaged(game, ship, o) || damageBlocked(game, ship, o)) return;
    if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) - o.stats.length / 2 > g.r) return;
    hit.push(o);
  });
  if (!hit.length) return;
  ship.talentReady.gift = now + g.cd;
  const each = g.fx === 'lightning' || g.fx === 'mortar';
  for (const o of hit) {
    applyDamage(game, o, { hull: (g.hull ?? 0) * o.stats.hullMax, morale: g.morale ?? 0 }, ship);
    if (g.foe && g.secs > 0 && o.alive) o.addEffect({ id: GIFT_FOE, until: now + g.secs, mods: g.foe, source: ship.id }, now);
    if (each) game.emit({ k: 'fx', fx: g.fx, x: Math.round(o.state.x), y: Math.round(o.state.y), r: 30 }, o.state.x, o.state.y);
  }
  if (!each) game.emit({ k: 'fx', fx: g.fx, x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: g.r }, ship.state.x, ship.state.y);
}

/** Whether the sea is as a `sail` gift likes it, where she is now. */
export function sailHolds(game: Game, ship: ShipEntity, when: SailWhen): boolean {
  switch (when) {
    case 'storm': {
      const w = game.weatherOf(ship);
      return w === 'storm' || w === 'black_storm';
    }
    case 'calm':
      return game.windFor(ship).strength < 0.5;
    case 'night':
      return isNight(game.now);
    case 'fog':
      return game.weatherOf(ship) === 'fog';
    case 'open': {
      if (ship.inCombat(game.now)) return false;
      let near = false;
      game.forShipsNear(ship.state.x, ship.state.y, OPEN_WATER, (o) => {
        if (o.id !== ship.id && o.alive && !o.docked && game.isHostile(o, ship) && dist(o.state.x, o.state.y, ship.state.x, ship.state.y) <= OPEN_WATER) near = true;
      });
      return !near;
    }
  }
}

/** Sail: while her sea holds, her gift on her stats (a pulse, refreshed each second). */
function sail(game: Game, ship: ShipEntity, g: SailGift): void {
  if (!sailHolds(game, ship, g.when)) return;
  ship.addEffect({ id: GIFT_SELF, until: game.now + PULSE, mods: g.self, flags: g.selfFlags }, game.now);
}

/** Muster at sea, out of a fight: one of her own kind back every `every` seconds (up to her number), or a hand signed
 *  on (up to her share of the hammocks). The clock runs while nothing is missing too: the first comes within `every`. */
function musterAtSea(game: Game, ship: ShipEntity, g: MusterGift): void {
  const now = game.now;
  if (ship.inCombat(now) || ship.boarding || !ready(ship, now)) return;
  ship.talentReady.gift = now + g.every;
  const s = game.sessionOf(ship);
  if (!s?.profile) return;
  if (g.who === 'hands') {
    if (ship.crew >= Math.floor(ship.stats.crewMax * (g.upTo ?? 1))) return;
    const c = s.profile.company;
    reconcile(game, c, ship.crew);
    ship.crew += 1; // signs on as her roster's hand
    c.pools.sailor += 1;
    ship.companyKey = '';
    return;
  }
  for (const b of SHIP_CLASSES[ship.loadout.classId].premium?.beasts ?? []) {
    const have = ship.army.find((x) => x.u === b.u)?.n ?? 0;
    if (have >= b.n || bringAboard(game, s, b.u, 1) <= 0) continue;
    game.toastShip(ship, `${g.name[0]}! ${g.cry[0]}`, 'good');
    return;
  }
}

// ------------------------------------------------------------------------------------------------ her own, in port

/** Her own kind aboard, as far as a slot and the hammocks go (they come as the ship's company: the crew's pools take
 *  them in). How many came. */
function bringAboard(game: Game, s: PlayerSession, u: UnitId, n: number): number {
  const ship = s.ship!;
  const own = ship.army.some((x) => x.u === u);
  if (!own && ship.army.length >= ship.armySlots) return 0;
  const k = Math.max(0, Math.min(Math.floor(n), ship.stats.crewMax - ship.crew));
  if (k <= 0) return 0;
  const c = s.profile!.company;
  reconcile(game, c, ship.crew);
  ship.addMen(u, k);
  c.pools.sailor += k;
  ship.companyKey = '';
  return k;
}

/** Making port aboard a premium hull: her own creatures lost since come back to her, up to the number she came with
 *  (docs/02 §1.A.9) — only aboard their own hull, and only as far as a slot and the hammocks go. */
export function musterInPort(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  const cls = ship ? SHIP_CLASSES[ship.loadout.classId] : undefined;
  if (!ship || !cls?.premium?.beasts) return;
  for (const b of cls.premium.beasts) {
    if (!isShipBeast(b.u)) continue;
    const have = ship.army.find((x) => x.u === b.u)?.n ?? 0;
    if (have >= b.n) continue;
    const k = bringAboard(game, s, b.u, b.n - have);
    if (k > 0) game.toastShip(ship, `${k} ${SHIP_BEAST_PLURAL[b.u][0]} come back aboard the ${cls.name}.`, 'good');
  }
}

// ------------------------------------------------------------------------------------------------ her broadside

/** Strike: a ball of her broadside struck home — now and then (her chance, not oftener than her cooldown) it brings
 *  her gift on the ship it struck. */
export function giftOnHit(game: Game, shooter: ShipEntity, target: ShipEntity): void {
  const g = giftOf(shooter.loadout.classId);
  if (!g || g.kind !== 'strike' || !target.alive) return;
  const now = game.now;
  if (!ready(shooter, now) || !game.rng.chance(g.chance)) return;
  shooter.talentReady.gift = now + g.cd;
  if (g.foe) target.addEffect({ id: GIFT_FOE, until: now + g.secs, mods: g.foe, source: shooter.id }, now);
  if (g.fire) igniteShip(game, target, g.secs, shooter);
  if (g.sails) target.sails = Math.max(0, target.sails - target.stats.sailHpMax * g.sails);
  if (g.morale) target.morale = Math.max(0, target.morale - g.morale);
  game.emit({ k: 'fx', fx: 'crossfire', x: Math.round(target.state.x), y: Math.round(target.state.y) }, target.state.x, target.state.y);
}

// ------------------------------------------------------------------------------------------------ the boarding battle

/** Deck: what her hull lays on the boarding battle from its first round (her side's, and the other side's). */
export function deckGift(ship: ShipEntity): { rounds: number; mine?: DeckGift['mine']; theirs?: DeckGift['theirs'] } | undefined {
  const g = giftOf(ship.loadout.classId);
  if (g?.kind !== 'deck') return undefined;
  return { rounds: g.rounds, ...(g.mine ? { mine: g.mine } : {}), ...(g.theirs ? { theirs: g.theirs } : {}) };
}

// ------------------------------------------------------------------------------------------------ the market

/** Trade: her prices in port with her gift on them — the goods of her trade sold dearer, bought cheaper, or the port's
 *  duty on them waived (on every good: no duty at all). */
export function giftPriceMods(ship: ShipEntity, mods: PriceMods): PriceMods {
  const g = giftOf(ship.loadout.classId);
  if (!g || g.kind !== 'trade') return mods;
  const all = g.goods === 'all';
  const goods = all ? GOOD_IDS : (g.goods as typeof GOOD_IDS);
  const goodSell = { ...(mods.goodSell ?? {}) }, goodBuy = { ...(mods.goodBuy ?? {}) };
  // A good's duty waived: what she is paid for it is lifted back to the duty-free price (as the whaling licence does).
  const waive = !all && g.duty && mods.duty > 0 && mods.duty < 1 ? (1 - mods.duty * (1 - g.duty)) / (1 - mods.duty) : 1;
  for (const x of goods) {
    if (g.sell || waive !== 1) goodSell[x] = (goodSell[x] ?? 1) * (g.sell ?? 1) * waive;
    if (g.buy) goodBuy[x] = (goodBuy[x] ?? 1) * g.buy;
  }
  return { ...mods, duty: all && g.duty ? mods.duty * (1 - g.duty) : mods.duty, goodSell, goodBuy };
}
