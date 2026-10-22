// A ceasefire bought from the sea's ships attacking a captain (owner, 2026-10-18; shared/src/data/ceasefire.ts has the
// numbers, docs/31 §11 the rules). She taps a ship firing on her — «Переговоры: прекратить огонь» — and sees every ship
// attacking her now with its price (TRUCE_SHARE of what she carries: her silver and her hold), and the total; she pays
// one, some or all of them, in silver or in goods of her choosing (the rest in silver).
//
// The checks that the ship paid really stops:
//  (a) her hostility to that captain is off for TRUCE_SEC on the server (npcHostileTo, the brain's prey): she takes her
//      for no foe, chases her no more, and her balls already in the air do her no harm (truceHit); nothing but the
//      captain's own fire brings her back;
//  (b) she hoists a white flag (SF.TRUCE, drawn over her) and turns away from her for TURN_AWAY_SEC (npc.ts think);
//  (c) the captain firing on her (or grappling her) breaks the truce, and what was paid is gone (no refund);
//  (d) the ships of a pack are each their own bargain: one paid is one quiet, the rest fire on;
//  (e) a rover in lawless water may refuse, by refuseChance of her strength over the captain's; the price is taken only
//      from those who agree, after every one has answered, and only once the captain was seen to have the whole of it;
//  (f) a talk every TALK_COOLDOWN seconds, and a ship that refused will not talk again for REFUSED_SEC;
//  (g) no bargain with the great ones (bosses, zone bosses, a boss's parts), the beasts and monsters, the dead, the
//      named who have sworn to sink her, nor anything sent for her (a lesson's raider, a quest's or the campaign's foe,
//      a hunter on her trail, a guard of the map, a lair's garrison, the Choir's invaders) — nor a captain's escort.
// What is paid goes nowhere a captain can take it back from (not into her hold or purse): no buying a truce and
// boarding the money back.

import { hullOf, hullsGap } from '../../../shared/src/data/reach.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { REFUSED_SEC, TALK_COOLDOWN, TALK_R, TRUCE_SEC, TURN_AWAY_SEC, refuseChance, trucePrice } from '../../../shared/src/data/ceasefire.ts';
import type { CeasefireView, TruceShip } from '../../../shared/src/data/ceasefire.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { cargoValue } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { npcHostileTo } from './npc.ts';
import { fightingPower } from './struck.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

interface Talk {
  /** No new offer before. */
  cooldown: number;
  /** Ships that refused her: id → until. */
  refused: Map<number, number>;
}

const talks = new WeakMap<Game, Map<number, Talk>>();
function talkOf(game: Game, acc: number): Talk {
  let m = talks.get(game);
  if (!m) talks.set(game, (m = new Map()));
  let t = m.get(acc);
  if (!t) m.set(acc, (t = { cooldown: 0, refused: new Map() }));
  return t;
}

/** A truce of `npc`'s with the ship `other` holds now. */
export function truceHolds(game: Game, npc: ShipEntity, other: ShipEntity): boolean {
  return npc.truceUntil > game.now && (game.npcs.get(npc.id)?.truce?.get(other.id) ?? 0) > game.now;
}

/** Is she firing on the captain now: hostile to her and at her (her mark, her chase), or her shot struck her lately. */
export function attacking(game: Game, npc: ShipEntity, ship: ShipEntity): boolean {
  if (!npc.alive || npc.isPlayer || !npc.npcRole || npc.sinkingUntil || npc.surrendered || npc.docked) return false;
  if (!npcHostileTo(game, npc, ship)) return false;
  const b = game.npcs.get(npc.id);
  return b?.target === ship.id || b?.chase?.id === ship.id || (ship.attackers.get(npc.id) ?? -1e9) > game.now - 30;
}

/** Why she will not bargain at all, or null (check g). */
export function noBargain(game: Game, npc: ShipEntity, ship: ShipEntity): string | null {
  if (npc.bossOf || npc.bossPart || npc.zoneBoss || npc.npcRole === 'boss') return 'The great ones of the sea do not bargain';
  if (npc.npcRole === 'beast' || npc.cls.monster) return 'A beast of the deep does not bargain';
  if (npc.npcRole === 'ghost' || npc.dutchman || npc.cls.passive.id === 'dead_crew' || npc.hasFlag('crew_of_drowned')) return 'The dead do not bargain';
  if (npc.named || npc.namedMate) return 'He has sworn to sink you: no terms';
  if (npc.ownerId !== null) return 'An escort answers to her own captain';
  const b = game.npcs.get(npc.id);
  if (npc.guardOf || npc.invader || npc.lairGuard || b?.practice !== undefined || b?.huntFor !== undefined || b?.keep || b?.huntAccount === ship.accountId) return 'She was sent for you: no terms';
  return null;
}

/** What a captain carries: her silver and her hold at the goods' base prices. */
export function carried(s: PlayerSession): { silver: number; cargo: number } {
  return { silver: Math.max(0, Math.floor(s.profile?.gold ?? 0)), cargo: Math.round(cargoValue(s.ship?.cargo ?? {})) };
}

/** The ships attacking her within TALK_R, the nearest first. */
export function attackersOf(game: Game, ship: ShipEntity): ShipEntity[] {
  const out: { o: ShipEntity; d: number }[] = [];
  game.forShipsNear(ship.state.x, ship.state.y, TALK_R, (o) => {
    if (o === ship) return;
    const d = Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y);
    if (d <= TALK_R && attacking(game, o, ship)) out.push({ o, d });
  });
  return out.sort((a, b) => a.d - b.d).map((x) => x.o);
}

/** The chance she refuses: a rover in lawless water, by her strength over the captain's (check e); else none. */
export function riskOf(npc: ShipEntity, ship: ShipEntity): number {
  if (npc.npcRole !== 'pirate' || REGIONS[npc.region]?.safety !== 'lawless') return 0;
  return refuseChance(fightingPower(npc) / Math.max(1, fightingPower(ship)));
}

function shipView(game: Game, s: PlayerSession, npc: ShipEntity, price: number): TruceShip {
  const ship = s.ship!;
  const t = talkOf(game, s.accountId);
  const no = noBargain(game, npc, ship);
  const refused = (t.refused.get(npc.id) ?? 0) > game.now;
  return { id: npc.id, name: npc.name, price, ok: !no && !refused, ...(no ? { why: no } : refused ? { why: 'She refused you: she will not talk again so soon' } : {}), risk: Math.round(riskOf(npc, ship) * 100) / 100 };
}

/** The talk as she sees it: the ships attacking her now (the one she tapped first), each price, the total. */
export function quote(game: Game, s: PlayerSession, focus?: number): CeasefireView | string {
  const ship = s.ship;
  if (!ship || !s.profile || !ship.alive || ship.docked) return 'Cannot do that now';
  const list = attackersOf(game, ship);
  const f = focus !== undefined ? game.ships.get(focus) : undefined;
  if (f && !list.includes(f)) {
    if (f.alive && f.npcRole && truceHolds(game, f, ship)) return 'She is under a white flag to you already';
    return 'She is not firing on you';
  }
  if (f) list.sort((a, b) => (a === f ? -1 : b === f ? 1 : 0));
  const c = carried(s);
  const price = trucePrice(c.silver + c.cargo);
  const ships = list.map((o) => shipView(game, s, o, price));
  // (nobody firing on her: an empty talk — the card keeps the last answers, and says so)
  return { ships, silver: c.silver, cargo: c.cargo, total: ships.filter((x) => x.ok).reduce((n, x) => n + x.price, 0), cooldown: talkOf(game, s.accountId).cooldown, ...(f ? { focus: f.id } : {}) };
}

/** The goods she offered, valued at base prices, unit by unit until `owed` is met (the dearest first): what to take. */
function goodsFor(ship: ShipEntity, goods: readonly GoodId[], owed: number): { take: Cargo; value: number } {
  const take: Cargo = {};
  let value = 0;
  const list = [...new Set(goods)].filter((g) => GOODS[g] && (ship.cargo[g] ?? 0) >= 1).sort((a, b) => GOODS[b].basePrice - GOODS[a].basePrice);
  for (const g of list) {
    if (value >= owed) break;
    const per = GOODS[g].basePrice;
    const n = Math.min(Math.floor(ship.cargo[g] ?? 0), Math.ceil((owed - value) / per));
    if (n <= 0) continue;
    take[g] = n;
    value += n * per;
  }
  return { take, value };
}

/** The value of the goods offered, all of them (what she could pay in goods at most). */
function goodsValue(ship: ShipEntity, goods: readonly GoodId[]): number {
  let v = 0;
  for (const g of new Set(goods)) if (GOODS[g]) v += Math.floor(ship.cargo[g] ?? 0) * GOODS[g].basePrice;
  return v;
}

/** Her offer to the ships `ids` (each must be attacking her and willing to bargain), paid in silver, or in the goods
 *  `goods` she chose with the rest in silver. Each ship answers; those who agree are paid — only they, all at once, and
 *  only when she was seen to have the price of all she asked — and hoist the white flag. The talk with the answers, or
 *  why nothing was asked. */
export function negotiate(game: Game, s: PlayerSession, ids: readonly number[], pay: 'silver' | 'cargo', goods: readonly GoodId[] = []): CeasefireView | string {
  const ship = s.ship, p = s.profile;
  if (!ship || !p || !ship.alive || ship.docked) return 'Cannot do that now';
  const now = game.now;
  const t = talkOf(game, s.accountId);
  if (t.cooldown > now) return `Your herald was answered only now: talk again in ${Math.ceil(t.cooldown - now)} s`; // (f)
  const want = [...new Set(ids.map((x) => Math.trunc(Number(x))).filter(Number.isFinite))];
  if (!want.length) return 'Choose a ship to talk to';
  const asked: ShipEntity[] = [];
  for (const id of want) {
    const o = game.ships.get(id);
    if (!o || !attacking(game, o, ship)) return o && truceHolds(game, o, ship) ? `${o.name} is under a white flag to you already` : 'She is not firing on you';
    if (hullsGap(hullOf(o), hullOf(ship)) > TALK_R) return 'She is too far off to hail';
    const no = noBargain(game, o, ship); // (g)
    if (no) return `${o.name}: ${no}`;
    if ((t.refused.get(o.id) ?? 0) > now) return `${o.name} refused you: she will not talk again so soon`; // (f)
    asked.push(o);
  }
  // The price, on the server, of what she carries now: each ship the same share.
  const c = carried(s);
  const price = trucePrice(c.silver + c.cargo);
  const total = price * asked.length;
  // (e) The whole of it must be hers before anyone answers: no asking, being refused, and asking again with nothing.
  const offered = pay === 'cargo' ? goodsValue(ship, goods) : 0;
  if (pay === 'cargo' && offered <= 0) return 'Choose the goods to pay with';
  if (offered + c.silver < total) {
    if (pay === 'cargo') return `Not enough to pay: ${total} silver asked, you have ${c.silver} silver and ${offered} in goods`;
    return `Not enough to pay: ${total} silver asked, you have ${c.silver} silver`;
  }
  // Each answers.
  t.cooldown = now + TALK_COOLDOWN;
  const result: NonNullable<CeasefireView['result']> = [];
  const agreed: ShipEntity[] = [];
  for (const o of asked) {
    const risk = riskOf(o, ship);
    if (risk > 0 && game.rng.chance(risk)) {
      t.refused.set(o.id, now + REFUSED_SEC);
      result.push({ id: o.id, name: o.name, agreed: false, why: 'She laughs at your herald and runs out her guns' });
      continue;
    }
    agreed.push(o);
    result.push({ id: o.id, name: o.name, agreed: true });
  }
  // Paid by those who agreed only, at once: the goods first (as far as they go), the rest in silver.
  let owed = price * agreed.length;
  let paidGoods = 0;
  if (owed > 0 && pay === 'cargo') {
    const g = goodsFor(ship, goods, owed);
    for (const id in g.take) {
      const k = id as GoodId;
      ship.cargo[k] = (ship.cargo[k] ?? 0) - (g.take[k] ?? 0);
      if ((ship.cargo[k] ?? 0) <= 0) delete ship.cargo[k];
    }
    paidGoods = g.value;
    owed = Math.max(0, owed - g.value);
  }
  const paidSilver = Math.min(owed, Math.floor(p.gold));
  p.gold -= paidSilver;
  if (paidSilver + paidGoods > 0) game.db.ledger(s.accountId, 'ceasefire', -paidSilver, agreed.map((o) => o.name).join(', ').slice(0, 120));
  for (const o of agreed) hoistWhite(game, o, ship);
  if (agreed.length) game.toastShip(ship, agreed.length === 1 ? `${agreed[0].name} hoists a white flag and turns away.` : `${agreed.length} ships hoist white flags and turn away.`, 'good');
  const refused = result.filter((r) => !r.agreed);
  if (refused.length) game.toastShip(ship, refused.length === 1 ? `${refused[0].name} refuses your terms.` : `${refused.length} ships refuse your terms.`, 'bad');
  game.pushSelf(s, true);
  const view = quote(game, s);
  const after = typeof view === 'string' ? { ships: [], silver: carried(s).silver, cargo: carried(s).cargo, total: 0, cooldown: t.cooldown } : view;
  return { ...after, result, paid: { silver: paidSilver, cargo: paidGoods } };
}

/** She agreed (checks a, b): no foe of the captain's ship for TRUCE_SEC, her mark and her chase dropped, her memory of
 *  the fight wiped on both sides, a white flag up, and her bow turned away. */
export function hoistWhite(game: Game, npc: ShipEntity, ship: ShipEntity): void {
  const b = game.npcs.get(npc.id);
  if (!b) return;
  const until = game.now + TRUCE_SEC;
  (b.truce ??= new Map()).set(ship.id, until);
  npc.truceUntil = Math.max(npc.truceUntil, until);
  if (b.target === ship.id) b.target = null;
  if (b.chase?.id === ship.id) b.chase = null;
  b.preySince = undefined;
  b.spared.set(ship.id, until);
  b.truceAway = { id: ship.id, until: game.now + TURN_AWAY_SEC };
  npc.attackers.delete(ship.id);
  ship.attackers.delete(npc.id);
}

/** The truce of `npc` with the captain's ship is over: she fired (check c). Nothing paid comes back. */
export function breakTruce(game: Game, npc: ShipEntity, ship: ShipEntity): void {
  const b = game.npcs.get(npc.id);
  if (!b?.truce?.has(ship.id)) return;
  b.truce.delete(ship.id);
  b.spared.delete(ship.id);
  if (b.truceAway?.id === ship.id) b.truceAway = undefined;
  let last = 0;
  for (const u of b.truce.values()) last = Math.max(last, u);
  npc.truceUntil = last;
  game.toastShip(ship, `You fired on ${npc.name} under her white flag: the truce is broken, and what you paid is gone.`, 'bad');
}

/** A hit between two ships (combat.ts applyDamage): true when it does not land — her ball (in the air when she agreed, or
 *  after) on the captain she has a truce with (check a). The captain's own on the ship under a white flag to her lands
 *  and breaks the truce (check c). */
export function truceHit(game: Game, source: ShipEntity, target: ShipEntity): boolean {
  if (source.npcRole && !source.isPlayer && truceHolds(game, source, target)) return true;
  if (source.isPlayer && target.npcRole && truceHolds(game, target, source)) breakTruce(game, target, source);
  return false;
}

/** The captain grapples a ship under her white flag (boarding.ts): the truce is broken. */
export function truceBoarded(game: Game, a: ShipEntity, b: ShipEntity): void {
  if (a.isPlayer && b.npcRole && truceHolds(game, b, a)) breakTruce(game, b, a);
}

/** The client's messages. */
export function ceasefireMessage(game: Game, s: PlayerSession, msg: { op?: unknown; id?: unknown; ids?: unknown; pay?: unknown; goods?: unknown }): void {
  let out: CeasefireView | string;
  if (msg.op === 'pay') {
    const ids = Array.isArray(msg.ids) ? (msg.ids as unknown[]).slice(0, 12).map((x) => Number(x)) : [];
    const goods = Array.isArray(msg.goods) ? (msg.goods as unknown[]).filter((g): g is GoodId => typeof g === 'string' && g in GOODS).slice(0, 40) : [];
    out = negotiate(game, s, ids, msg.pay === 'cargo' ? 'cargo' : 'silver', goods);
  } else out = quote(game, s, Number.isFinite(Number(msg.id)) && msg.id !== undefined && msg.id !== null ? Number(msg.id) : undefined);
  if (typeof out === 'string') {
    game.sendTo(s, { t: 'toast', msg: out, kind: 'bad' });
    if (msg.op !== 'pay') game.sendTo(s, { t: 'ceasefire', view: null });
    return;
  }
  game.sendTo(s, { t: 'ceasefire', view: out });
}

/** Tests: forget a captain's talks. */
export function resetTalks(game: Game, acc: number): void {
  talks.get(game)?.delete(acc);
}
