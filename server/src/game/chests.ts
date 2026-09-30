// Captains' treasure (docs/12 P10 #7): a captain buries her own chest on an island's shore — silver, a good from her
// hold, and a riddle — and gets its map: a circle about the spot and her riddle. She may hand the map over, or post it
// on a port's map board at her price. Whoever digs the chest up takes it; its author gains a cartographer's fame (and
// a title at five). A chest someone has dug is gone for every copy of its map.

import type { GoodId } from '../../../shared/src/data/goods.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { CacheView, MapBoardView, MapOfferView } from '../../../shared/src/protocol.ts';
import { dist } from '../../../shared/src/math.ts';
import { MAX_MAPS, chestCount } from './explorefx.ts';
import type { TreasureMap } from './explorefx.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';

export const CHEST_COST = 50;
export const CHEST_MIN_SILVER = 100;
export const CHEST_MAX_SILVER = 20000;
export const CHEST_MAX = 3;
export const CHEST_R = 300;
export const FAME_TITLE_AT = 5;
export const BOARD_FEE = 0.05;

interface Chest {
  id: number;
  author: number;
  authorName: string;
  x: number;
  y: number;
  island: number;
  silver: number;
  goods: Partial<Record<GoodId, number>>;
  buried: number;
  /** Copies of its map sold (docs/16 #22). */
  sold?: number;
}

interface BoardItem {
  id: number;
  port: string;
  seller: number;
  sellerName: string;
  price: number;
  map: TreasureMap;
}

function chests(game: Game): Record<string, Chest> {
  return game.db.getKv<Record<string, Chest>>('player_chests') ?? {};
}

function board(game: Game): { seq: number; items: BoardItem[] } {
  return game.db.getKv<{ seq: number; items: BoardItem[] }>('map_board') ?? { seq: 1, items: [] };
}

/** Bury a chest on the nearest island's shore (from a ship at sea within 400 m of it). */
export function buryChest(game: Game, s: PlayerSession, silverRaw: number, riddleRaw: string, good: GoodId | null, qtyRaw: number): string | null {
  const p = s.profile!, ship = s.ship;
  if (!ship || ship.docked) return 'A chest is buried from a boat off an island’s shore.';
  const all = chests(game);
  if (Object.values(all).filter((c) => c.author === s.accountId).length >= CHEST_MAX) return 'Three chests of yours are buried already.';
  if (chestCount(p.explore.maps) >= MAX_MAPS) return 'Your map chest is full';
  const silver = Math.floor(Number(silverRaw) || 0);
  if (silver < CHEST_MIN_SILVER || silver > CHEST_MAX_SILVER) return `A chest holds ${CHEST_MIN_SILVER} to ${CHEST_MAX_SILVER} silver.`;
  const riddle = String(riddleRaw ?? '').replace(/[<>{}`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (riddle.length < 8) return 'Write a riddle for the map (eight letters at least).';
  const qty = good ? Math.max(0, Math.floor(Number(qtyRaw) || 0)) : 0;
  if (good && qty > 0 && (ship.cargo[good] ?? 0) < qty) return 'Not that much in the hold.';
  if (p.gold < silver + CHEST_COST) return 'Not enough silver';
  // The island: the nearest shore within 400 m; the spot a little inland from where the boat lands.
  let best = null as null | { id: number; x: number; y: number };
  let bd = Infinity;
  for (const is of game.world.islands) {
    if (is.portId || is.minor) continue;
    const d = Math.hypot(is.x - ship.state.x, is.y - ship.state.y) - is.radius;
    if (d < bd) {
      bd = d;
      best = { id: is.id, x: is.x, y: is.y };
    }
  }
  if (!best || bd > 400) return 'A chest is buried from a boat off an island’s shore.';
  const is = game.world.islands[best.id];
  let sx = ship.state.x, sy = ship.state.y;
  const dx = is.x - sx, dy = is.y - sy, L = Math.hypot(dx, dy) || 1;
  for (let k = 0; k < 400 && !isLand(game.world, sx, sy); k++) {
    sx += (dx / L) * 10;
    sy += (dy / L) * 10;
  }
  sx += (dx / L) * 40;
  sy += (dy / L) * 40;
  if (!isLand(game.world, sx, sy)) return 'A chest is buried from a boat off an island’s shore.';
  p.gold -= silver + CHEST_COST;
  if (good && qty > 0) {
    ship.cargo[good] = (ship.cargo[good] ?? 0) - qty;
    if (!ship.cargo[good]) delete ship.cargo[good];
  }
  const seq = (game.db.getKv<number>('player_chest_seq') ?? 1);
  game.db.setKv('player_chest_seq', seq + 1);
  const chest: Chest = { id: seq, author: s.accountId, authorName: s.name, x: Math.round(sx), y: Math.round(sy), island: is.id, silver, goods: good && qty > 0 ? { [good]: qty } : {}, buried: game.wallNow() };
  all[String(seq)] = chest;
  game.db.setKv('player_chests', all);
  game.db.ledger(s.accountId, 'chest_buried', -(silver + CHEST_COST), String(seq));
  const m: TreasureMap = {
    id: `pc_${seq}`, tier: 2, name: `${s.name}'s Chest on ${is.name}`, region: is.region, sx: chest.x, sy: chest.y,
    ox: game.rng.range(-0.45, 0.45), oy: game.rng.range(-0.45, 0.45), legendary: false, kind: 'player', clue: riddle, island: is.id, hoard: `pc_${seq}`,
  };
  p.explore.maps.push(m);
  game.sendTo(s, { t: 'toast', msg: `The chest is buried on ${is.name}. Its map is in your chest of maps.`, kind: 'gold' });
  game.pushSelf(s, true);
  return null;
}

/** She digs where a captain's map points: the chest, or an empty pit if someone was quicker. */
export function digPlayerChest(game: Game, s: PlayerSession, m: TreasureMap): boolean {
  const p = s.profile!, ship = s.ship!;
  p.explore.maps = p.explore.maps.filter((x) => x.id !== m.id);
  const all = chests(game);
  const key = (m.hoard ?? m.id).replace(/^pc_/, '');
  const c = all[key];
  if (!c) {
    game.toastShip(ship, 'A pit, a broken chest, footprints. Someone with a copy of this map got here first.', 'bad');
    return true;
  }
  delete all[key];
  game.db.setKv('player_chests', all);
  p.gold += c.silver;
  game.db.ledger(s.accountId, 'chest_found', c.silver, key);
  for (const [g, n] of Object.entries(c.goods)) ship.cargo[g as GoodId] = (ship.cargo[g as GoodId] ?? 0) + (n ?? 0);
  game.toastShip(ship, `${c.authorName}'s chest! ${c.silver} silver inside.`, 'gold');
  if (c.author !== s.accountId) {
    // The author's fame: a chest of hers found.
    const as = game.sessionByAccount(c.author);
    const ap = as?.profile;
    if (ap) {
      ap.cartoFame = (ap.cartoFame ?? 0) + 1;
      if (ap.cartoFame >= FAME_TITLE_AT && !ap.titles.includes('Riddle-Maker')) ap.titles.push('Riddle-Maker');
    }
    deliver(game, c.author, { from: 'The sea', subject: 'Your chest was found', body: `Your chest on ${game.world.islands[c.island]?.name ?? '?'} was dug up by ${s.name}. Your fame as a cartographer grows.`, gold: 0, goods: null });
    game.grantXp(s, 300, `Dug up ${c.authorName}'s chest`, true);
  }
  game.pushSelf(s, true);
  return true;
}

/** The map board of a port: post a map at a price, take it down, or buy one. */
export function boardAction(game: Game, s: PlayerSession, action: string, idRaw: string, priceRaw: number, copy = false): string | null {
  const p = s.profile!, ship = s.ship!;
  const port = ship.docked ? game.portById(ship.docked) : undefined;
  if (!port) return 'Only in port';
  const b = board(game);
  switch (action) {
    case 'post': {
      const m = p.explore.maps.find((x) => x.id === idRaw);
      if (!m) return 'No such map';
      const price = Math.floor(Number(priceRaw) || 0);
      if (price < 10 || price > 100000) return 'A price of 10 to 100000 silver.';
      // The author of a buried chest may sell copies of its map and keep her own (docs/16 #22); whoever digs first
      // takes the chest.
      if (copy) {
        if (!ownChest(game, s, m)) return 'Only the author of a chest may sell copies of its map.';
        if (b.items.filter((x) => x.seller === s.accountId && x.map.hoard === m.hoard).length >= 3) return 'Three copies of that map are on the boards already.';
        const id = b.seq++;
        b.items.push({ id, port: port.id, seller: s.accountId, sellerName: s.name, price, map: { ...m, id: `${m.id}_c${id}`, copy: true } });
        break;
      }
      p.explore.maps = p.explore.maps.filter((x) => x !== m);
      b.items.push({ id: b.seq++, port: port.id, seller: s.accountId, sellerName: s.name, price, map: m });
      break;
    }
    case 'unpost': {
      const it = b.items.find((x) => x.id === Number(idRaw) && x.seller === s.accountId);
      if (!it) return 'No such map';
      // A copy taken down is only torn up: her own map never left her.
      if (!it.map.copy && chestCount(p.explore.maps) >= MAX_MAPS) return 'Your map chest is full';
      b.items = b.items.filter((x) => x !== it);
      if (!it.map.copy) p.explore.maps.push(it.map);
      break;
    }
    case 'buy': {
      const it = b.items.find((x) => x.id === Number(idRaw) && x.port === port.id);
      if (!it) return 'No such map';
      if (it.seller === s.accountId) return 'That map is yours.';
      if (p.gold < it.price) return 'Not enough silver';
      if (chestCount(p.explore.maps) >= MAX_MAPS) return 'Your map chest is full';
      p.gold -= it.price;
      b.items = b.items.filter((x) => x !== it);
      p.explore.maps.push({ ...it.map, copy: undefined });
      countSale(game, it.map);
      const paid = Math.floor(it.price * (1 - BOARD_FEE));
      deliver(game, it.seller, { from: `The map board, ${port.name}`, subject: 'Your map is sold', body: `${s.name} bought your map "${it.map.name}".`, gold: paid, goods: null });
      game.db.ledger(s.accountId, 'map_bought', -it.price, it.map.id);
      game.sendTo(s, { t: 'toast', msg: `A map bought: ${it.map.name}.`, kind: 'gold' });
      break;
    }
    default:
      return 'Unknown map order';
  }
  game.db.setKv('map_board', b);
  game.pushSelf(s, true);
  return null;
}

/** A port's board as a captain sees it. */
export function boardView(game: Game, s: PlayerSession, portId: string): MapBoardView[] {
  return board(game).items.filter((x) => x.port === portId).map((x) => ({ id: x.id, name: x.map.name, seller: x.sellerName, price: x.price, mine: x.seller === s.accountId, riddle: x.map.clue ?? null, ...(x.map.kind === 'player' ? { chest: true } : {}), ...(x.map.copy ? { copy: true } : {}) }));
}

// ------------------------------------------------------------------ docs/16 #22: her caches, and a map sold alongside

function chestKey(m: TreasureMap): string {
  return (m.hoard ?? m.id).replace(/^pc_/, '');
}

/** Whether a map leads to a chest she buried herself (and still lies buried). */
function ownChest(game: Game, s: PlayerSession, m: TreasureMap): boolean {
  if (m.kind !== 'player') return false;
  const c = chests(game)[chestKey(m)];
  return !!c && c.author === s.accountId;
}

/** A copy of a chest's map sold: its author's tally. */
function countSale(game: Game, m: TreasureMap): void {
  if (m.kind !== 'player') return;
  const all = chests(game);
  const c = all[chestKey(m)];
  if (!c) return;
  c.sold = (c.sold ?? 0) + 1;
  game.db.setKv('player_chests', all);
}

/** Her own buried chests, where they lie and where their maps are. */
export function myCaches(game: Game, s: PlayerSession): CacheView[] {
  const all = Object.values(chests(game)).filter((c) => c.author === s.accountId);
  if (!all.length) return [];
  const items = board(game).items;
  const maps = s.profile?.explore.maps ?? [];
  return all.map((c) => ({
    id: c.id, island: game.world.islands[c.island]?.name ?? '?', x: c.x, y: c.y, silver: c.silver, goods: c.goods, buried: c.buried,
    mapHeld: maps.some((m) => m.kind === 'player' && chestKey(m) === String(c.id)),
    posted: [...new Set(items.filter((x) => x.seller === s.accountId && x.map.kind === 'player' && chestKey(x.map) === String(c.id)).map((x) => game.portById(x.port)?.name ?? x.port))],
    sold: c.sold ?? 0,
  }));
}

interface MapOffer {
  id: number;
  from: number;
  fromName: string;
  to: number;
  map: TreasureMap;
  price: number;
  copy: boolean;
  until: number;
}

const OFFER_SEC = 60;
export const SELL_RANGE = 1000;
const offers = new WeakMap<Game, { seq: number; list: MapOffer[] }>();
function offerBook(game: Game): { seq: number; list: MapOffer[] } {
  let o = offers.get(game);
  if (!o) offers.set(game, (o = { seq: 1, list: [] }));
  o.list = o.list.filter((x) => x.until > game.now);
  return o;
}

function offerView(o: MapOffer): MapOfferView {
  return { id: o.id, from: o.fromName, name: o.map.name, riddle: o.map.clue ?? null, price: o.price, chest: o.map.kind === 'player', until: o.until };
}

/** Whether two captains are alongside for a trade: both at sea within a kilometre, or in the same port. */
function alongside(a: PlayerSession, b: PlayerSession): boolean {
  const x = a.ship, y = b.ship;
  if (!x || !y || !x.alive || !y.alive) return false;
  if (x.docked || y.docked) return !!x.docked && x.docked === y.docked;
  return dist(x.state.x, x.state.y, y.state.x, y.state.y) <= SELL_RANGE;
}

/** She offers a map (or, her own chest's, a copy) to a captain alongside at her price. */
export function sellMap(game: Game, s: PlayerSession, mapId: string, toShip: number, priceRaw: number, copy: boolean): string | null {
  const p = s.profile!;
  const m = p.explore.maps.find((x) => x.id === mapId);
  if (!m) return 'No such map';
  const price = Math.floor(Number(priceRaw) || 0);
  if (price < 10 || price > 100000) return 'A price of 10 to 100000 silver.';
  if (copy && !ownChest(game, s, m)) return 'Only the author of a chest may sell copies of its map.';
  const target = game.sessionOf(game.ships.get(Math.trunc(Number(toShip))) ?? null);
  if (!target || target === s || !target.profile) return 'No such captain alongside';
  if (!alongside(s, target)) return 'Come within a kilometre of her first (or meet in port).';
  const book = offerBook(game);
  if (book.list.some((o) => o.from === s.accountId && o.to === target.accountId)) return 'She is still thinking over your last offer.';
  const id = book.seq++;
  const o: MapOffer = { id, from: s.accountId, fromName: s.name, to: target.accountId, map: copy ? { ...m, id: `${m.id}_x${id}`, copy: true } : m, price, copy, until: game.now + OFFER_SEC };
  book.list.push(o);
  game.sendTo(target, { t: 'mapoffer', offer: offerView(o) });
  game.sendTo(s, { t: 'toast', msg: `Your offer is made to ${target.name}: ${m.name} for ${price} silver.`, kind: 'info' });
  return null;
}

/** Her answer to a map offered alongside. */
export function answerMapOffer(game: Game, s: PlayerSession, idRaw: number, accept: boolean): string | null {
  const book = offerBook(game);
  const o = book.list.find((x) => x.id === Math.trunc(Number(idRaw)) && x.to === s.accountId);
  game.sendTo(s, { t: 'mapoffer', offer: null });
  if (!o) return 'That offer has lapsed';
  book.list = book.list.filter((x) => x !== o);
  const seller = game.sessionByAccount(o.from);
  if (!accept) {
    if (seller) game.sendTo(seller, { t: 'toast', msg: `${s.name} turns down your map.`, kind: 'info' });
    return null;
  }
  const p = s.profile!;
  if (!seller || !seller.profile || !alongside(s, seller)) return 'The seller is no longer alongside';
  if (p.gold < o.price) return 'Not enough silver';
  if (chestCount(p.explore.maps) >= MAX_MAPS) return 'Your map chest is full';
  const sp = seller.profile;
  if (!o.copy) {
    const had = sp.explore.maps.find((x) => x.id === o.map.id);
    if (!had) return 'The seller no longer has that map';
    sp.explore.maps = sp.explore.maps.filter((x) => x !== had);
  } else if (!ownChest(game, seller, o.map)) return 'That chest is dug up already';
  p.gold -= o.price;
  sp.gold += o.price;
  p.explore.maps.push({ ...o.map, copy: undefined });
  countSale(game, o.map);
  game.db.ledger(s.accountId, 'map_bought', -o.price, o.map.id);
  game.db.ledger(seller.accountId, 'map_sold', o.price, o.map.id);
  game.sendTo(s, { t: 'toast', msg: `A map bought: ${o.map.name}.`, kind: 'gold' });
  game.sendTo(seller, { t: 'toast', msg: `${s.name} buys your map "${o.map.name}" for ${o.price} silver.`, kind: 'gold' });
  game.pushSelf(s, true);
  game.pushSelf(seller, true);
  return null;
}

