import { Rng } from '../../../shared/src/rng.ts';
// The trophy auction of the free ports (docs/16 #13): rare pieces on the block with a clock — the house's own (rare,
// epic, now and then a legendary) and captains' — the sea's bidders in the room raising too, each up to what the
// piece is worth to them. A bid holds the silver; outbid, it comes back at once (by letter to a captain away). A bid in
// the last minute holds the lot open a minute more. Sold, the piece goes to the winner's locker and the seller is paid
// less the house's tenth; unsold, a captain's piece comes back to her.

import {
  AUCTION_BIDDERS, AUCTION_CUT, HOUSE_LOTS, HOUSE_OPEN, LOT_TIME, OWN_LOTS, RESERVE_MAX, RESERVE_MIN, SNIPE_WINDOW, hasAuction, minRaise,
} from '../../../shared/src/data/dealings.ts';
import { STASH_SIZE, itemName, itemValue, makeItem } from '../../../shared/src/data/items.ts';
import type { Item, Rarity } from '../../../shared/src/data/items.ts';
import { watersBand } from '../../../shared/src/data/shiplevel.ts';
import type { AuctionView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { dealings } from './player.ts';
import type { PlayerSession } from './player.ts';

/** The auction house's own dice: its lots and bidders don't draw on the sea's stream (the fights, the landings). */
const rngs = new WeakMap<Game, Rng>();
function ar(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x0a0c7104)));
  return r;
}
import { deliver } from './post.ts';

export interface Lot {
  id: string;
  port: string;
  item: Item;
  seller: number | null;
  sellerName: string | null;
  /** The opening price (the reserve of a captain's lot). */
  open: number;
  bid: number; // 0 while no one has bid
  leader: number | null; // a captain's account
  leaderName: string | null; // hers, or the bidder of the room's
  bids: number;
  endsAt: number; // wall-clock ms
  worth: number;
  /** How far the room will go for it, and when it next stirs. */
  cap: number;
  roomAt: number;
}

interface House {
  lots: Lot[];
  seq: number;
  /** Pieces owed to captains who were away (won, or their own unsold). */
  owed: Record<string, Item[]>;
}

const houses = new WeakMap<Game, House>();

function house(game: Game): House {
  let h = houses.get(game);
  if (!h) {
    const kept = game.db.getKv<House>('auction');
    h = { lots: kept?.lots ?? [], seq: kept?.seq ?? 1, owed: kept?.owed ?? {} };
    houses.set(game, h);
  }
  return h;
}

function save(game: Game): void {
  game.db.setKv('auction', house(game));
}

/** The captains in that port see the block as it stands now. */
function refresh(game: Game, ports: Set<string>): void {
  if (!ports.size) return;
  for (const s of game.sessions) if (s.ship?.docked && ports.has(s.ship.docked)) game.pushPort(s);
}

/** The next bid the lot will take. */
export function nextBid(l: Lot): number {
  return l.bid > 0 ? l.bid + minRaise(l.bid) : l.open;
}

function portName(game: Game, id: string): string {
  return game.portById(id)?.name ?? id;
}

/** Silver to a captain: at once if she is about, by letter if she is away. */
function pay(game: Game, accountId: number, amount: number, subject: string, body: string): void {
  if (amount <= 0) return;
  const s = game.sessionByAccount(accountId);
  if (s?.profile) {
    s.profile.gold += amount;
    game.sendTo(s, { t: 'toast', msg: body, kind: 'gold' });
    game.pushSelf(s, true);
  } else deliver(game, accountId, { from: 'The Auction House', subject, body, gold: amount, goods: null });
  game.db.ledger(accountId, 'auction', amount, subject);
}

/** A piece to a captain: into her locker, or held for her till there is room. */
function hand(game: Game, accountId: number, item: Item): void {
  const s = game.sessionByAccount(accountId);
  if (s?.profile) {
    dealings(s.profile).held.push(item);
    claimAuction(game, s);
  } else {
    const h = house(game);
    (h.owed[accountId] ??= []).push(item);
  }
}

/** What the house holds for her goes into her locker as far as it has room. */
export function claimAuction(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p) return;
  const h = house(game);
  const d = dealings(p);
  const owed = h.owed[s.accountId];
  if (owed?.length) {
    d.held.push(...owed);
    delete h.owed[s.accountId];
    save(game);
  }
  while (d.held.length && p.stash.length < STASH_SIZE) {
    const it = d.held.shift()!;
    p.stash.push({ ...it, uid: p.itemSeq++ });
    game.sendTo(s, { t: 'toast', msg: `${itemName(it)} is in your locker.`, kind: 'good' });
  }
}

/** A new piece for the house to sell here: rare or better, of the level of these waters. */
function houseLot(game: Game, port: Port): Lot {
  const h = house(game);
  const band = watersBand(REGIONS[port.region].safety, port.region === 'the_abyss');
  const rarity = ar(game).weighted<Rarity>([[2, 60], [3, 32], [4, 8]]);
  const item = makeItem(ar(game), 0, { ilvl: ar(game).int(band[0], band[1]), rarity });
  const worth = itemValue(item);
  return {
    id: `lot${h.seq++}`, port: port.id, item, seller: null, sellerName: null, open: Math.max(10, Math.round(worth * HOUSE_OPEN)), bid: 0, leader: null, leaderName: null, bids: 0,
    endsAt: game.wallNow() + LOT_TIME * 1000 * (0.6 + ar(game).float() * 0.8), worth, cap: Math.round(worth * (0.55 + ar(game).float() * 0.6)), roomAt: game.wallNow() + ar(game).int(20, 120) * 1000,
  };
}

/** The house keeps its lots on the block in each free port. */
function stock(game: Game): boolean {
  const h = house(game);
  let changed = false;
  for (const port of game.world.ports) {
    if (!hasAuction(port)) continue;
    while (h.lots.filter((l) => l.port === port.id && l.seller === null).length < HOUSE_LOTS) {
      h.lots.push(houseLot(game, port));
      changed = true;
    }
  }
  return changed;
}

/** A bid is placed (hers or the room's): the silver of the last captain who led comes back, the clock holds. */
function place(game: Game, l: Lot, amount: number, who: { account: number | null; name: string }): void {
  const prev = l.leader;
  if (prev !== null) pay(game, prev, l.bid, `Outbid at ${portName(game, l.port)}`, `Outbid on ${itemName(l.item)} at ${portName(game, l.port)}: your ${l.bid} silver back.`);
  l.bid = amount;
  l.leader = who.account;
  l.leaderName = who.name;
  l.bids++;
  const now = game.wallNow();
  if (l.endsAt - now < SNIPE_WINDOW * 1000) l.endsAt = now + SNIPE_WINDOW * 1000;
  // The room answers a captain's bid after a while, if the piece is still worth it to them.
  l.roomAt = now + ar(game).int(8, 30) * 1000;
}

export function bid(game: Game, s: PlayerSession, port: Port, id: string, amountRaw: number): string | null {
  const l = house(game).lots.find((x) => x.id === id && x.port === port.id);
  if (!l || game.wallNow() >= l.endsAt) return 'That lot is closed';
  if (l.seller === s.accountId) return 'You cannot bid on your own lot';
  if (l.leader === s.accountId) return 'Your bid leads already';
  const amount = Math.floor(Number(amountRaw));
  const least = nextBid(l);
  if (!Number.isFinite(amount) || amount < least) return `The least bid is ${least} silver`;
  const p = s.profile!;
  if (p.gold < amount) return 'Not enough silver';
  p.gold -= amount;
  game.db.ledger(s.accountId, 'auction_bid', -amount, l.id);
  place(game, l, amount, { account: s.accountId, name: s.name });
  save(game);
  refresh(game, new Set([port.id]));
  return null;
}

/** She puts a piece of her own on the block, at her reserve. */
export function putUp(game: Game, s: PlayerSession, port: Port, uid: number, reserveRaw: number): string | null {
  if (!hasAuction(port)) return 'There is no auction house here';
  const h = house(game);
  if (h.lots.filter((l) => l.seller === s.accountId).length >= OWN_LOTS) return `At most ${OWN_LOTS} of your lots at a time`;
  const p = s.profile!;
  const i = p.stash.findIndex((x) => x.uid === uid);
  if (i < 0) return 'No such piece in your locker';
  const item = p.stash[i];
  if (item.bound) return 'A bound piece is not for sale.';
  const worth = itemValue(item);
  const reserve = Math.round(Number(reserveRaw));
  const lo = Math.max(10, Math.round(worth * RESERVE_MIN)), hi = Math.round(worth * RESERVE_MAX);
  if (!Number.isFinite(reserve) || reserve < lo || reserve > hi) return `The reserve must be from ${lo} to ${hi} silver`;
  p.stash.splice(i, 1);
  const now = game.wallNow();
  h.lots.push({
    id: `lot${h.seq++}`, port: port.id, item, seller: s.accountId, sellerName: s.name, open: reserve, bid: 0, leader: null, leaderName: null, bids: 0,
    endsAt: now + LOT_TIME * 1000, worth, cap: Math.round(worth * (0.55 + ar(game).float() * 0.6)), roomAt: now + ar(game).int(20, 90) * 1000,
  });
  save(game);
  game.sendTo(s, { t: 'toast', msg: `${itemName(item)} goes on the block at ${reserve} silver.`, kind: 'info' });
  return null;
}

/** The hammer falls on a lot whose clock has run out. */
function close(game: Game, l: Lot): void {
  const where = portName(game, l.port);
  const name = itemName(l.item);
  if (l.bid > 0) {
    if (l.leader !== null) {
      hand(game, l.leader, l.item);
      const w = game.sessionByAccount(l.leader);
      if (w) game.sendTo(w, { t: 'toast', msg: `Sold to you: ${name} for ${l.bid} silver at ${where}.`, kind: 'gold' });
    }
    if (l.seller !== null) {
      const net = Math.floor(l.bid * (1 - AUCTION_CUT));
      pay(game, l.seller, net, `Sold at ${where}`, `${name} sold at ${where} to ${l.leaderName ?? 'a bidder'}: ${net} silver (the house kept its tenth).`);
    }
  } else if (l.seller !== null) {
    hand(game, l.seller, l.item);
    const o = game.sessionByAccount(l.seller);
    if (o) game.sendTo(o, { t: 'toast', msg: `No one met your reserve for ${name}: it comes back to you.`, kind: 'info' });
  }
}

/** Every second: the room bids, the hammer falls, the house restocks. */
export function stepAuction(game: Game): void {
  const h = house(game);
  const now = game.wallNow();
  let changed = stock(game);
  const moved = new Set<string>();
  for (const l of [...h.lots]) {
    if (now >= l.endsAt) {
      close(game, l);
      h.lots = h.lots.filter((x) => x !== l);
      changed = true;
      moved.add(l.port);
      continue;
    }
    // The room: it bids when a captain leads (or no one has bid), up to what the piece is worth to it.
    if (now >= l.roomAt && (l.leader !== null || l.bid === 0) && nextBid(l) <= l.cap) {
      if (l.bid === 0 && ar(game).chance(0.35)) {
        l.roomAt = now + ar(game).int(30, 90) * 1000; // the room is in no hurry to open
        continue;
      }
      const who = ar(game).pick(AUCTION_BIDDERS)[0];
      place(game, l, nextBid(l), { account: null, name: who });
      changed = true;
      moved.add(l.port);
    }
  }
  if (changed) save(game);
  if (moved.size && stock(game)) save(game);
  refresh(game, moved);
}

export function auctionView(game: Game, s: PlayerSession, port: Port): AuctionView | null {
  if (!hasAuction(port)) return null;
  const h = house(game);
  if (stock(game)) save(game);
  const now = game.wallNow();
  return {
    lots: h.lots.filter((l) => l.port === port.id).map((l) => ({
      id: l.id, item: l.item, seller: l.sellerName, mine: l.seller === s.accountId, bid: l.bid || l.open, bids: l.bids, leader: l.leaderName,
      leading: l.leader === s.accountId, endsAt: l.endsAt, next: nextBid(l), worth: l.worth,
    })),
    own: h.lots.filter((l) => l.seller === s.accountId).length,
    cut: AUCTION_CUT,
    wall: now,
  };
}

/** For tests and the admin: the lots on the block. */
export function lotsOf(game: Game): Lot[] {
  return house(game).lots;
}
