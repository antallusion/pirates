// The Floating Bazaar (docs/12 P10 #19) on the server: a stall opened in port on her ship — goods from her hold and
// pieces from her locker, at her prices — held in escrow while she sails; the captains in that port buy from it; her
// takings go by letter (the harbour keeps its cut); the stall closes when she closes it there, or after a week, and
// what was left waits for her (her warehouse there, her locker when she is next aboard).

import {
  HARBOUR_CUT, PAY_EVERY_MIN, PRICE_CAP, STALL_DAYS, STALL_FEE, STALL_GOODS, STALL_ITEMS,
} from '../../../shared/src/data/bazaar.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { STASH_SIZE, itemName } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import type { BazaarShadow, BazaarStallView } from '../../../shared/src/protocol.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { giveGoods } from './director.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';

interface Stall {
  owner: number;
  name: string;
  port: string;
  ship: string;
  classId: ShipClassId;
  look: string | null;
  opened: number;
  goods: { good: GoodId; qty: number; price: number }[];
  items: { item: Item; price: number }[];
  sold: number;
  owed: number;
  paidAt: number;
}

interface Returns {
  goods: { port: string; good: GoodId; qty: number }[];
  items: Item[];
}

const DAY = 86_400_000;

function all(game: Game): Record<string, Stall> {
  return game.db.getKv<Record<string, Stall>>('bazaar') ?? {};
}

function save(game: Game, stalls: Record<string, Stall>): void {
  game.db.setKv('bazaar', stalls);
}

export function stallOf(game: Game, owner: number): Stall | null {
  return all(game)[owner] ?? null;
}

function portName(game: Game, id: string): string {
  return game.portById(id)?.name ?? id;
}

/** A stall on her ship in this port. */
export function openStall(game: Game, s: PlayerSession, port: Port): string | null {
  const p = s.profile!;
  const stalls = all(game);
  const had = stalls[s.accountId];
  if (had) return `You already keep a stall at ${portName(game, had.port)}.`;
  if (p.gold < STALL_FEE) return 'Not enough silver';
  p.gold -= STALL_FEE;
  game.db.ledger(s.accountId, 'bazaar_fee', -STALL_FEE, port.id);
  stalls[s.accountId] = {
    owner: s.accountId, name: s.name, port: port.id, ship: p.loadout.name, classId: p.loadout.classId, look: s.ship?.look ?? null,
    opened: game.wallNow(), goods: [], items: [], sold: 0, owed: 0, paidAt: game.wallNow(),
  };
  save(game, stalls);
  game.sendTo(s, { t: 'toast', msg: `You open a stall at ${port.name}.`, kind: 'good' });
  return null;
}

function mine(game: Game, s: PlayerSession, port: Port): { stalls: Record<string, Stall>; st: Stall } | string {
  const stalls = all(game);
  const st = stalls[s.accountId];
  if (!st || st.port !== port.id) return 'You keep no stall here.';
  return { stalls, st };
}

function priceOk(price: number, cap: number): boolean {
  return Number.isFinite(price) && price >= 1 && price <= cap;
}

export function addGood(game: Game, s: PlayerSession, port: Port, good: GoodId, qtyRaw: number, priceRaw: number): string | null {
  const m = mine(game, s, port);
  if (typeof m === 'string') return m;
  const ship = s.ship!;
  const qty = Math.floor(qtyRaw), price = Math.round(priceRaw);
  if (!GOODS[good] || qty <= 0) return 'You have not that much aboard.';
  if (!priceOk(price, GOODS[good].basePrice * PRICE_CAP)) return 'That price will not do.';
  if (Math.floor(ship.cargo[good] ?? 0) < qty) return 'You have not that much aboard.';
  const line = m.st.goods.find((x) => x.good === good);
  if (!line && m.st.goods.length >= STALL_GOODS) return 'The stall is full.';
  ship.cargo[good] = (ship.cargo[good] ?? 0) - qty;
  if (!ship.cargo[good]) delete ship.cargo[good];
  if (line) {
    line.qty += qty;
    line.price = price;
  } else m.st.goods.push({ good, qty, price });
  save(game, m.stalls);
  return null;
}

export function addItem(game: Game, s: PlayerSession, port: Port, uid: number, priceRaw: number): string | null {
  const m = mine(game, s, port);
  if (typeof m === 'string') return m;
  const p = s.profile!;
  const i = p.stash.findIndex((x) => x.uid === uid);
  if (i < 0) return 'No such piece in your locker';
  const it = p.stash[i];
  if (it.bound) return 'A bound piece is not for sale.';
  const price = Math.round(priceRaw);
  if (!priceOk(price, 10_000_000)) return 'That price will not do.';
  if (m.st.items.length >= STALL_ITEMS) return 'The stall is full.';
  p.stash.splice(i, 1);
  m.st.items.push({ item: it, price });
  save(game, m.stalls);
  return null;
}

/** A line back aboard: goods to the hold (what does not fit, to her warehouse here), a piece to the locker. */
export function removeLine(game: Game, s: PlayerSession, port: Port, kind: 'good' | 'item', index: number): string | null {
  const m = mine(game, s, port);
  if (typeof m === 'string') return m;
  if (kind === 'item') {
    const line = m.st.items[index];
    if (!line) return 'No such line at that stall.';
    if (s.profile!.stash.length >= STASH_SIZE) return 'Your locker is full';
    m.st.items.splice(index, 1);
    s.profile!.stash.push({ ...line.item, uid: s.profile!.itemSeq++ });
  } else {
    const line = m.st.goods[index];
    if (!line) return 'No such line at that stall.';
    m.st.goods.splice(index, 1);
    backAboard(s, port, line.good, line.qty);
  }
  save(game, m.stalls);
  return null;
}

function backAboard(s: PlayerSession, port: Port, good: GoodId, qty: number): void {
  const got = s.ship ? giveGoods(s.ship, good, qty) : 0;
  const rest = qty - got;
  if (rest > 0) {
    const wh = (s.profile!.warehouses[port.id] ??= {});
    wh[good] = (wh[good] ?? 0) + rest;
  }
}

/** She closes her stall here: all of it back aboard; the takings still owed go by letter. */
export function closeStall(game: Game, s: PlayerSession, port: Port): string | null {
  const m = mine(game, s, port);
  if (typeof m === 'string') return m;
  const p = s.profile!;
  if (p.stash.length + m.st.items.length > STASH_SIZE) return 'Your locker is full';
  for (const g of m.st.goods) backAboard(s, port, g.good, g.qty);
  for (const it of m.st.items) p.stash.push({ ...it.item, uid: p.itemSeq++ });
  pay(game, m.st);
  delete m.stalls[s.accountId];
  save(game, m.stalls);
  game.sendTo(s, { t: 'toast', msg: 'You close your stall: what was left is back aboard.', kind: 'info' });
  return null;
}

/** A captain in port buys from another's stall. */
export function buyAtStall(game: Game, s: PlayerSession, port: Port, owner: number, kind: 'good' | 'item', index: number, qtyRaw: number): string | null {
  const stalls = all(game);
  const st = stalls[owner];
  if (!st || st.port !== port.id) return 'No such line at that stall.';
  if (owner === s.accountId) return 'That is your own stall.';
  const p = s.profile!;
  let price = 0;
  let what = '';
  if (kind === 'good') {
    const line = st.goods[index];
    const qty = Math.max(1, Math.min(Math.floor(qtyRaw), line?.qty ?? 0));
    if (!line) return 'No such line at that stall.';
    price = line.price * qty;
    if (p.gold < price) return 'Not enough silver';
    const got = s.ship ? giveGoods(s.ship, line.good, qty) : 0;
    if (got <= 0) return 'Your hold has no room for it.';
    price = line.price * got;
    line.qty -= got;
    if (line.qty <= 0) st.goods.splice(index, 1);
    what = `${got} ${GOODS[line.good].name}`;
  } else {
    const line = st.items[index];
    if (!line) return 'No such line at that stall.';
    price = line.price;
    if (p.gold < price) return 'Not enough silver';
    if (p.stash.length >= STASH_SIZE) return 'Your locker is full';
    p.stash.push({ ...line.item, uid: p.itemSeq++ });
    st.items.splice(index, 1);
    what = itemName(line.item);
  }
  p.gold -= price;
  game.db.ledger(s.accountId, 'bazaar_buy', -price, `${owner}:${what}`);
  const take = Math.floor(price * (1 - HARBOUR_CUT));
  st.sold += take;
  st.owed += take;
  save(game, stalls);
  const o = game.sessionByAccount(owner);
  if (o) game.sendTo(o, { t: 'toast', msg: `${s.name} buys at your stall in ${port.name}: ${take} silver.`, kind: 'gold' });
  return null;
}

function pay(game: Game, st: Stall): void {
  if (st.owed <= 0) return;
  const port = portName(game, st.port);
  deliver(game, st.owner, { from: 'The Floating Bazaar', subject: `Takings at ${port}`, body: `Your stall at ${port} took ${st.owed} silver (the harbour kept its cut).`, gold: st.owed, goods: null });
  game.db.ledger(st.owner, 'bazaar_takings', st.owed, st.port);
  st.owed = 0;
  st.paidAt = game.wallNow();
}

/** Every minute: takings by letter; a week-old stall closes and what was left waits for her. */
export function stepBazaar(game: Game): void {
  const stalls = all(game);
  let changed = false;
  for (const st of Object.values(stalls)) {
    if (st.owed > 0 && game.wallNow() - st.paidAt >= PAY_EVERY_MIN * 60_000) {
      pay(game, st);
      changed = true;
    }
    if (game.wallNow() - st.opened >= STALL_DAYS * DAY) {
      pay(game, st);
      const ret = game.db.getKv<Record<string, Returns>>('bazaar_returns') ?? {};
      const r = (ret[st.owner] ??= { goods: [], items: [] });
      for (const g of st.goods) r.goods.push({ port: st.port, good: g.good, qty: g.qty });
      for (const it of st.items) r.items.push(it.item);
      game.db.setKv('bazaar_returns', ret);
      delete stalls[st.owner];
      changed = true;
      const port = portName(game, st.port);
      deliver(game, st.owner, { from: 'The Floating Bazaar', subject: `Takings at ${port}`, body: `Your stall at ${port} has closed after a week: what was left waits for you.`, gold: 0, goods: null });
      const o = game.sessionByAccount(st.owner);
      if (o) claimBazaar(game, o);
    }
  }
  if (changed) save(game, stalls);
}

/** What a closed stall left: goods to her warehouse there, pieces to her locker (as far as it holds). */
export function claimBazaar(game: Game, s: PlayerSession): void {
  const ret = game.db.getKv<Record<string, Returns>>('bazaar_returns');
  const r = ret?.[s.accountId];
  if (!r || !s.profile) return;
  const p = s.profile;
  for (const g of r.goods) {
    const wh = (p.warehouses[g.port] ??= {});
    wh[g.good] = (wh[g.good] ?? 0) + g.qty;
  }
  r.goods = [];
  while (r.items.length && p.stash.length < STASH_SIZE) p.stash.push({ ...r.items.shift()!, uid: p.itemSeq++ });
  if (!r.items.length) delete ret![s.accountId];
  game.db.setKv('bazaar_returns', ret!);
}

function view(game: Game, st: Stall): BazaarStallView {
  return {
    owner: st.owner, name: st.name, ship: st.ship, classId: st.classId, goods: st.goods, items: st.items, sold: st.sold,
    daysLeft: Math.max(0, Math.ceil((st.opened + STALL_DAYS * DAY - game.wallNow()) / DAY)),
  };
}

export function bazaarPortView(game: Game, s: PlayerSession, port: Port): { stalls: BazaarStallView[]; mine: BazaarStallView | null; elsewhere: { port: string; sold: number } | null } {
  const stalls = Object.values(all(game));
  const own = stalls.find((x) => x.owner === s.accountId) ?? null;
  return {
    stalls: stalls.filter((x) => x.port === port.id && x.owner !== s.accountId).map((x) => view(game, x)),
    mine: own && own.port === port.id ? view(game, own) : null,
    elsewhere: own && own.port !== port.id ? { port: own.port, sold: own.sold } : null,
  };
}

/** The shadows at the ports near her (every ten seconds). */
export function sendBazaarShadows(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  if (!ship) return;
  const shadows: BazaarShadow[] = [];
  for (const st of Object.values(all(game))) {
    const port = game.portById(st.port);
    if (!port || Math.hypot(port.x - ship.state.x, port.y - ship.state.y) > 6000) continue;
    shadows.push({ owner: st.owner, port: st.port, name: st.name, ship: st.ship, classId: st.classId, look: st.look });
  }
  game.sendTo(s, { t: 'bazaar', shadows });
}
