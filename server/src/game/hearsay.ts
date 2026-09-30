// The tavern's whispers for silver (docs/16 #14): a man in the corner sells where a smugglers' cache lies ashore (a
// real island with a cache) or where a merchant caravan was seen and which way she was bound (a real ship at sea) —
// the place goes on her chart and becomes her mark. Not every whisper is true: the surer the teller, the dearer the
// word. A true cache is freshly stocked and fatter for those who heard of it; a false one was dug out long ago; a false
// caravan never was. She learns which when she gets there.

import { HEARSAY_ARRIVE, HEARSAY_PRICE, HEARSAY_SLOTS, HEARSAY_TTL, RELIABILITY } from '../../../shared/src/data/dealings.ts';
import type { HearsayKind, Reliability } from '../../../shared/src/data/dealings.ts';
import { WORLD_SIZE } from '../../../shared/src/constants.ts';
import { dist } from '../../../shared/src/math.ts';
import type { HearsayOfferView } from '../../../shared/src/protocol.ts';
import { cargoValue } from '../../../shared/src/sim/shipstats.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { exploredKey } from './exploration.ts';
import type { Game } from './Game.ts';
import { dealings } from './player.ts';
import type { Hearsay, PlayerSession } from './player.ts';

interface Offer {
  id: string;
  kind: HearsayKind;
  reliability: Reliability;
  truth: boolean;
  price: number;
  /** A cache's island, or a caravan's ship (and, for a false one, the sea where she never was). */
  islandId?: number;
  shipId?: number;
  x: number;
  y: number;
  buyers: Set<number>;
}

const REFRESH = 900;
const RANGE = 26_000;
const boards = new WeakMap<Game, Map<string, { list: Offer[]; refreshAt: number }>>();
let seq = 1;

/** Silver the cache on the far side of a whisper is worth, and a caravan's hold (the price is a share of it). */
const CACHE_WORTH = 240;
function caravanWorth(v: number): number {
  return Math.max(300, Math.min(1600, v));
}

function grade(game: Game): Reliability {
  return game.rng.weighted<Reliability>([['sure', 1], ['likely', 2], ['doubtful', 2]]);
}

/** A point of open sea a few kilometres off the port (where a false caravan was "seen"). */
function openSea(game: Game, port: Port): { x: number; y: number } {
  for (let i = 0; i < 20; i++) {
    const a = game.rng.float() * Math.PI * 2, r = game.rng.range(5000, 20000);
    const x = port.x + Math.sin(a) * r, y = port.y - Math.cos(a) * r;
    if (!isLand(game.world, x, y) && x > 3000 && y > 3000 && x < WORLD_SIZE - 3000 && y < WORLD_SIZE - 3000) return { x, y };
  }
  return { x: port.x + 6000, y: port.y };
}

function makeOffers(game: Game, port: Port): Offer[] {
  const out: Offer[] = [];
  const caches = game.world.islands.filter((is) => !is.portId && is.features.includes('cache') && dist(is.x, is.y, port.x, port.y) < RANGE);
  for (let i = 0; i < 2 && caches.length; i++) {
    const is = caches.splice(game.rng.int(0, caches.length - 1), 1)[0];
    const reliability = grade(game);
    out.push({ id: `hs${seq++}`, kind: 'cache', reliability, truth: game.rng.chance(RELIABILITY[reliability]), price: Math.max(10, Math.round(CACHE_WORTH * HEARSAY_PRICE[reliability])), islandId: is.id, x: is.x, y: is.y, buyers: new Set() });
  }
  const merchants = [...game.ships.values()].filter((sh) => sh.npcRole === 'merchant' && sh.alive && !sh.docked && dist(sh.state.x, sh.state.y, port.x, port.y) < RANGE);
  if (merchants.length) {
    const sh = game.rng.pick(merchants);
    const reliability = grade(game);
    const truth = game.rng.chance(RELIABILITY[reliability]);
    const at = truth ? { x: sh.state.x, y: sh.state.y } : openSea(game, port);
    out.push({ id: `hs${seq++}`, kind: 'caravan', reliability, truth, price: Math.max(10, Math.round(caravanWorth(cargoValue(sh.cargo)) * HEARSAY_PRICE[reliability])), shipId: sh.id, x: at.x, y: at.y, buyers: new Set() });
  }
  return out;
}

function offersAt(game: Game, port: Port): Offer[] {
  let all = boards.get(game);
  if (!all) boards.set(game, (all = new Map()));
  let b = all.get(port.id);
  if (!b || b.refreshAt <= game.now) {
    b = { list: makeOffers(game, port), refreshAt: game.now + REFRESH };
    all.set(port.id, b);
  }
  return b.list;
}

export function hearsayView(game: Game, s: PlayerSession, port: Port): HearsayOfferView[] {
  return offersAt(game, port).map((o) => {
    const dx = o.x - port.x, dy = o.y - port.y;
    return { id: o.id, kind: o.kind, reliability: o.reliability, price: o.price, bearing: Math.atan2(dx, -dy), km: Math.max(1, Math.round(Math.hypot(dx, dy) / 1000)), bought: o.buyers.has(s.accountId) };
  });
}

/** She pays for a whisper: its place goes on her chart. */
export function buyHearsay(game: Game, s: PlayerSession, port: Port, id: string): string | null {
  const o = offersAt(game, port).find((x) => x.id === id);
  if (!o) return 'That whisper has gone cold';
  if (o.buyers.has(s.accountId)) return 'You have heard that one already';
  const p = s.profile!;
  const d = dealings(p);
  if (d.hearsay.length >= HEARSAY_SLOTS) return `You can follow at most ${HEARSAY_SLOTS} whispers at a time`;
  let h: Hearsay;
  if (o.kind === 'cache') {
    const is = game.world.islands[o.islandId!];
    // True: the cache there is freshly hidden (whatever she took from it before). False: dug out long ago.
    const key = exploredKey(is.id, 'cache');
    if (o.truth) delete p.explored[key];
    else p.explored[key] = game.now;
    game.chartIsland(s, is);
    h = { id: o.id, kind: 'cache', reliability: o.reliability, truth: o.truth, x: Math.round(is.x), y: Math.round(is.y), r: Math.round(is.radius + HEARSAY_ARRIVE.cache), name: is.name, islandId: is.id, t: game.now, expiresAt: game.now + HEARSAY_TTL.cache };
  } else {
    const sh = game.ships.get(o.shipId!);
    if (o.truth && (!sh || !sh.alive)) return 'That whisper has gone cold';
    const at = o.truth ? { x: sh!.state.x, y: sh!.state.y } : { x: o.x, y: o.y };
    const heading = o.truth ? sh!.state.heading : game.rng.float() * Math.PI * 2;
    const speed = o.truth ? Math.max(3, sh!.state.speed) : game.rng.range(5, 9);
    h = { id: o.id, kind: 'caravan', reliability: o.reliability, truth: o.truth, x: Math.round(at.x), y: Math.round(at.y), r: HEARSAY_ARRIVE.caravan, heading: Math.round(heading * 100) / 100, speed: Math.round(speed * 10) / 10, name: sh?.name ?? 'a merchantman', shipId: o.truth ? o.shipId : undefined, t: game.now, expiresAt: game.now + HEARSAY_TTL.caravan };
  }
  if (p.gold < o.price) return 'Not enough silver';
  p.gold -= o.price;
  game.db.ledger(s.accountId, 'hearsay', -o.price, o.id);
  o.buyers.add(s.accountId);
  d.hearsay.push(h);
  game.sendTo(s, { t: 'toast', msg: o.kind === 'cache' ? `A smugglers' cache on ${h.name}: marked on your chart.` : `A merchant caravan seen at sea: marked on your chart. She sails on — make haste.`, kind: 'info' });
  return null;
}

export function forgetHearsay(game: Game, s: PlayerSession, id: string): string | null {
  const d = dealings(s.profile!);
  if (!d.hearsay.some((h) => h.id === id)) return 'No such whisper';
  d.hearsay = d.hearsay.filter((h) => h.id !== id);
  void game;
  return null;
}

/** Every second at sea: she has come where a whisper led — and finds out whether it was true. */
export function stepHearsay(game: Game, s: PlayerSession): void {
  const d = s.profile?.dealings;
  const ship = s.ship;
  if (!d?.hearsay.length || !ship) return;
  for (const h of [...d.hearsay]) {
    const drop = () => (d.hearsay = d.hearsay.filter((x) => x !== h));
    if (game.now >= h.expiresAt) {
      drop();
      game.sendTo(s, { t: 'toast', msg: h.kind === 'cache' ? `The whisper of a cache on ${h.name} has gone cold.` : 'The whisper of a caravan has gone cold.', kind: 'info' });
      continue;
    }
    if (ship.docked) continue;
    const there = dist(ship.state.x, ship.state.y, h.x, h.y) < h.r;
    if (h.kind === 'cache') {
      if (!there) continue;
      // A true one stays on her chart till she lands for it (the landing pays the finder's share on top).
      if (h.truth) {
        if (!h.told) game.sendTo(s, { t: 'toast', msg: `The whisper was true: a cache on ${h.name}. Land to dig it out.`, kind: 'good' });
        h.told = true;
        continue;
      }
      drop();
      game.sendTo(s, { t: 'toast', msg: `Only old spade-marks on ${h.name}: someone dug the cache out long ago. The whisper was false.`, kind: 'bad' });
      continue;
    }
    // A caravan: found when she is in sight of the ship itself, or at the place, where the wake tells the rest.
    const sh = h.truth && h.shipId !== undefined ? game.ships.get(h.shipId) : null;
    if (sh && sh.alive && dist(ship.state.x, ship.state.y, sh.state.x, sh.state.y) < Math.max(1500, ship.stats.detection)) {
      drop();
      game.sendTo(s, { t: 'toast', msg: `The whisper was true: the ${sh.name} is in sight.`, kind: 'good' });
      continue;
    }
    if (!there) continue;
    drop();
    if (h.truth) game.sendTo(s, { t: 'toast', msg: sh && sh.alive ? `The whisper was true: the ${sh.name} passed here — her wake is fresh.` : 'The whisper was true, but the caravan is gone from these waters.', kind: 'info' });
    else game.sendTo(s, { t: 'toast', msg: 'An empty sea: the caravan of the whisper never was.', kind: 'bad' });
  }
}

/** A landing at a cache a true whisper led her to: the finder's share on top, and the whisper is spent. */
export function hearsayCacheBonus(game: Game, s: PlayerSession, islandId: number): number {
  const d = s.profile?.dealings;
  const h = d?.hearsay.find((x) => x.kind === 'cache' && x.islandId === islandId && x.truth);
  if (!d || !h) return 0;
  d.hearsay = d.hearsay.filter((x) => x !== h);
  return game.rng.int(80, 180);
}
