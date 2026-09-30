// Letters and the captains' market (docs/01 §6: every market is local, goods are physical).
//  - Letters travel by packet boat: a minute or so to arrive. They carry words, silver (a League draft,
//    collected in any port) or goods lying in one port's warehouse, collected only in that port. Sales,
//    refunds and auction results also come as letters, so nothing waits on a captain being online.
//  - The market board in each port: sell listings (the goods wait in the harbour-master's store), buy
//    orders (the silver waits) — both only for captains in that port — and, in Tidewrack, the trophy
//    auction: lots sold to the highest bid, or at once for the buyout. Listing fee 1% (not returned),
//    sale tax at the port's duty, auction commission 5% (Appraiser: −30%). Listings last 48 hours.
// Mailboxes and boards live in the database's key-value store and survive restarts.

import type { LetterView, ListingView, MarketView } from '../../../shared/src/protocol.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { FACTION_DUTY } from './economy.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { WAREHOUSE_VOLUME, warehouseVolume } from './resources.ts';

export const POSTAGE = 10;
export const DRAFT_FEE = 0.02;
export const PACKET_DELAY_MS = 60_000;
export const LIST_FEE = 0.01;
export const AUCTION_COMMISSION = 0.05;
export const LISTING_MS = 48 * 3_600_000;
export const AUCTION_PORTS = new Set(['tidewrack']);
const MAILBOX_MAX = 100;
const LETTERS_PER_HOUR = 30;
const LISTINGS_PER_PORT = 8;
const BOARD_MAX = 300;

export interface Letter {
  id: number;
  from: string;
  subject: string;
  body: string;
  gold: number;
  goods: { good: GoodId; qty: number; port: string } | null;
  sentAt: number;
  arriveAt: number;
  read: boolean;
  taken: boolean;
}

interface Mailbox {
  next: number;
  letters: Letter[];
}

export interface Listing {
  id: number;
  kind: 'sell' | 'buy' | 'auction';
  seller: number;
  sellerName: string;
  good: GoodId;
  qty: number;
  price: number; // per unit (sell, buy); whole-lot reserve or current bid (auction)
  buyout: number;
  bidder: number | null;
  bidderName: string | null;
  endsAt: number;
}

interface Board {
  next: number;
  listings: Listing[];
}

export class PostOffice {
  private boards = new Map<string, Board>();
  /** Letters on their way to captains who are online: account → arrival times. */
  pending = new Map<number, number[]>();
  sentLog = new Map<number, number[]>();
  nextSweep = 0;

  board(game: Game, port: string): Board {
    let b = this.boards.get(port);
    if (!b) {
      b = game.db.getKv<Board>(`board:${port}`) ?? { next: 1, listings: [] };
      this.boards.set(port, b);
    }
    return b;
  }

  /** Another zone rewrote this port's board: reload on next use. */
  dropBoard(port: string): void {
    this.boards.delete(port);
  }

  saveBoard(game: Game, port: string): void {
    const b = this.boards.get(port);
    if (b) game.db.setKv(`board:${port}`, b);
  }

  /** The boards of the ports this process looks after. */
  allBoards(game: Game): [string, Board][] {
    return game.zonePorts().map((p) => [p.id, this.board(game, p.id)] as [string, Board]);
  }
}

// ------------------------------------------------------------------------------------------ letters

function mailbox(game: Game, accountId: number): Mailbox {
  return game.db.getKv<Mailbox>(`mail:${accountId}`) ?? { next: 1, letters: [] };
}

function saveMailbox(game: Game, accountId: number, box: Mailbox): void {
  // Keep the newest; never drop a letter still holding silver or goods.
  if (box.letters.length > MAILBOX_MAX) {
    const keep = box.letters.filter((l) => (!l.taken && (l.gold > 0 || l.goods)) || !l.read);
    const rest = box.letters.filter((l) => !keep.includes(l)).slice(-Math.max(0, MAILBOX_MAX - keep.length));
    box.letters = [...keep, ...rest].sort((a, b) => a.id - b.id);
  }
  game.db.setKv(`mail:${accountId}`, box);
}

/** The letters that reached her box since a time (wall ms), oldest first (docs/16 #30). */
export function lettersSince(game: Game, accountId: number, since: number): Letter[] {
  return mailbox(game, accountId).letters.filter((l) => l.sentAt >= since);
}

/** Puts a letter in a captain's box (online or not). */
export function deliver(game: Game, accountId: number, l: Omit<Letter, 'id' | 'sentAt' | 'arriveAt' | 'read' | 'taken'>, delayMs = 0): Letter {
  const box = mailbox(game, accountId);
  const now = game.wallNow();
  const letter: Letter = { ...l, id: box.next++, sentAt: now, arriveAt: now + delayMs, read: false, taken: !(l.gold > 0 || l.goods) };
  box.letters.push(letter);
  saveMailbox(game, accountId, box);
  const s = game.sessionByAccount(accountId);
  if (s && s.disconnectedAt === null) {
    if (delayMs <= 0) announce(game, s, letter);
    else {
      const list = game.post.pending.get(accountId) ?? [];
      list.push(letter.arriveAt);
      game.post.pending.set(accountId, list);
    }
  }
  return letter;
}

function announce(game: Game, s: PlayerSession, l: Letter): void {
  game.sendTo(s, { t: 'toast', msg: `A letter from ${l.from}: “${l.subject}”${l.gold ? ` — ${l.gold} silver enclosed` : ''}${l.goods ? ` — ${l.goods.qty} ${GOODS[l.goods.good].name} await you in port` : ''}. [Y]`, kind: 'info' });
  sendMail(game, s);
}

function view(l: Letter): LetterView {
  return { id: l.id, from: l.from, subject: l.subject, body: l.body, gold: l.gold, goods: l.goods, sentAt: l.sentAt, read: l.read, taken: l.taken };
}

export function sendMail(game: Game, s: PlayerSession): void {
  const now = game.wallNow();
  const arrived = mailbox(game, s.accountId).letters.filter((l) => l.arriveAt <= now);
  game.sendTo(s, { t: 'mail', letters: arrived.slice(-60).reverse().map(view), unread: arrived.filter((l) => !l.read).length });
}

export function mailSend(game: Game, s: PlayerSession, to: string, subject: string, body: string, goldRaw: number): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  if (!ship.docked) return 'Letters go from a harbour office';
  const online = game.sessionByName(String(to ?? ''));
  const acct = online ? { id: online.accountId, name: online.name } : game.db.accountByName(String(to ?? '').trim());
  if (!acct) return 'No captain goes by that name';
  if (acct.id === s.accountId) return 'You need no packet boat to write to yourself';
  const subj = String(subject ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || '(no subject)';
  const text = String(body ?? '').trim().slice(0, 1000);
  const gold = Math.floor(Number(goldRaw) || 0);
  if (gold < 0 || gold > 100_000) return 'A draft is for 0 to 100,000 silver';
  const now = game.wallNow();
  const log = (game.post.sentLog.get(s.accountId) ?? []).filter((t) => now - t < 3_600_000);
  if (log.length >= LETTERS_PER_HOUR) return 'The packet boat will take no more of your letters this hour';
  const fee = POSTAGE + Math.ceil(gold * DRAFT_FEE);
  if (p.gold < gold + fee) return `Postage ${fee} silver${gold ? ` and the draft of ${gold}` : ''} — you have ${p.gold}`;
  p.gold -= gold + fee;
  game.db.ledger(s.accountId, 'postage', -fee, acct.name);
  log.push(now);
  game.post.sentLog.set(s.accountId, log);
  // Same port and ashore there: handed across the counter.
  const sameQuay = online?.ship?.docked === ship.docked;
  deliver(game, acct.id, { from: s.name, subject: subj, body: text, gold, goods: null }, sameQuay ? 10_000 : PACKET_DELAY_MS);
  game.sendTo(s, { t: 'toast', msg: `Your letter to ${acct.name} is aboard the packet${gold ? `, with a draft for ${gold} silver` : ''}.`, kind: 'good' });
  return null;
}

export function mailRead(game: Game, s: PlayerSession, id: number): string | null {
  const box = mailbox(game, s.accountId);
  const l = box.letters.find((x) => x.id === id && x.arriveAt <= game.wallNow());
  if (!l) return 'No such letter';
  if (!l.read) {
    l.read = true;
    saveMailbox(game, s.accountId, box);
  }
  sendMail(game, s);
  return null;
}

export function mailTake(game: Game, s: PlayerSession, id: number): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  if (!ship.docked) return 'Collect it at a harbour office';
  const box = mailbox(game, s.accountId);
  const l = box.letters.find((x) => x.id === id && x.arriveAt <= game.wallNow());
  if (!l || l.taken) return 'Nothing to collect';
  if (l.goods) {
    if (l.goods.port !== ship.docked) return `The goods wait in ${game.portById(l.goods.port)?.name ?? l.goods.port}`;
    const g = l.goods.good;
    const st = ship.stats;
    const free = st.holdVolume - cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
    const toHold = Math.min(l.goods.qty, Math.floor((free + 1e-6) / GOODS[g].volume));
    const wh = p.warehouses[ship.docked];
    const whFree = wh ? Math.floor((WAREHOUSE_VOLUME - warehouseVolume(wh) + 1e-6) / GOODS[g].volume) : 0;
    if (toHold + whFree < l.goods.qty) return 'No room for it in your hold' + (wh ? ' or your warehouse' : ' (rent a warehouse here for the rest)');
    if (toHold > 0) ship.cargo[g] = (ship.cargo[g] ?? 0) + toHold;
    if (l.goods.qty > toHold) wh![g] = (wh![g] ?? 0) + (l.goods.qty - toHold);
    ship.recompute(game.now);
  }
  p.gold += l.gold;
  l.taken = true;
  l.read = true;
  saveMailbox(game, s.accountId, box);
  game.sendTo(s, { t: 'toast', msg: `Collected${l.gold ? ` ${l.gold} silver` : ''}${l.goods ? ` ${l.goods.qty} ${GOODS[l.goods.good].name}` : ''}.`, kind: 'gold' });
  sendMail(game, s);
  return null;
}

export function mailDelete(game: Game, s: PlayerSession, id: number): string | null {
  const box = mailbox(game, s.accountId);
  const l = box.letters.find((x) => x.id === id);
  if (!l) return 'No such letter';
  if (!l.taken) return 'Collect what it carries first';
  box.letters = box.letters.filter((x) => x !== l);
  saveMailbox(game, s.accountId, box);
  sendMail(game, s);
  return null;
}

/** On sign-in: how many letters wait. */
export function mailOnLogin(game: Game, s: PlayerSession): void {
  const now = game.wallNow();
  const letters = mailbox(game, s.accountId).letters;
  const unread = letters.filter((l) => !l.read && l.arriveAt <= now).length;
  const coming = letters.filter((l) => l.arriveAt > now).map((l) => l.arriveAt);
  if (coming.length) game.post.pending.set(s.accountId, coming);
  if (unread) game.sendTo(s, { t: 'toast', msg: `${unread} letter${unread > 1 ? 's' : ''} wait${unread > 1 ? '' : 's'} for you. [Y]`, kind: 'info' });
  sendMail(game, s);
}

// ------------------------------------------------------------------------------------------ the market

export function saleTax(port: Port): number {
  return FACTION_DUTY[port.faction] ?? 0.02;
}

function commission(s: PlayerSession): number {
  return AUCTION_COMMISSION * (s.ship?.hasFlag('appraiser') ? 0.7 : 1);
}

function listingView(l: Listing, me: number): ListingView {
  return { id: l.id, kind: l.kind, seller: l.sellerName, mine: l.seller === me, good: l.good, qty: l.qty, price: l.price, buyout: l.buyout, bidder: l.bidderName, endsAt: l.endsAt };
}

export function marketView(game: Game, s: PlayerSession, port: Port): MarketView {
  const b = game.post.board(game, port.id);
  return {
    port: port.id,
    auction: AUCTION_PORTS.has(port.id),
    listFee: LIST_FEE,
    saleTax: saleTax(port),
    listings: b.listings.map((l) => listingView(l, s.accountId)),
  };
}

export function sendMarket(game: Game, s: PlayerSession, port: Port): void {
  game.sendTo(s, { t: 'market', view: marketView(game, s, port) });
}

/** Takes goods from the hold or this port's warehouse. */
function takeGoods(s: PlayerSession, port: Port, good: GoodId, qty: number, from: 'hold' | 'warehouse'): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  const store = from === 'warehouse' ? p.warehouses[port.id] : ship.cargo;
  if (!store || (store[good] ?? 0) < qty) return `You have only ${store?.[good] ?? 0} ${GOODS[good].name} in your ${from}`;
  store[good] = (store[good] ?? 0) - qty;
  if (!store[good]) delete store[good];
  if (from === 'hold') {
    // Plunder sold openly on a board is traced: it keeps its taint only in the hold.
    const hot = Math.min(p.stolen[good] ?? 0, qty);
    if (hot > 0) p.stolen[good] = (p.stolen[good] ?? 0) - hot;
  }
  return null;
}

function mineHere(b: Board, accountId: number): number {
  return b.listings.filter((l) => l.seller === accountId).length;
}

function listCheck(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number, price: number): string | null {
  if (!GOODS[good]) return 'Unknown goods';
  if (!Number.isInteger(qty) || qty < 1 || qty > 10_000) return 'Quantity 1–10,000';
  if (!Number.isInteger(price) || price < 1 || price > 1_000_000) return 'Price 1–1,000,000';
  const b = game.post.board(game, port.id);
  if (mineHere(b, s.accountId) >= LISTINGS_PER_PORT) return `${LISTINGS_PER_PORT} listings per port at most`;
  if (b.listings.length >= BOARD_MAX) return 'The board is full; try again later';
  if (GOODS[good].contraband && port.faction === 'crown') return 'The Crown’s harbour-master will not post contraband';
  return null;
}

function listFee(value: number): number {
  return Math.max(5, Math.ceil(value * LIST_FEE));
}

export function marketSell(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number, price: number, from: 'hold' | 'warehouse' = 'hold'): string | null {
  const bad = listCheck(game, s, port, good, qty, price);
  if (bad) return bad;
  const fee = listFee(price * qty);
  if (s.profile!.gold < fee) return `The listing fee is ${fee} silver`;
  const e = takeGoods(s, port, good, qty, from);
  if (e) return e;
  s.profile!.gold -= fee;
  game.db.ledger(s.accountId, 'market_fee', -fee, port.id);
  const b = game.post.board(game, port.id);
  b.listings.push({ id: b.next++, kind: 'sell', seller: s.accountId, sellerName: s.name, good, qty, price, buyout: 0, bidder: null, bidderName: null, endsAt: game.wallNow() + LISTING_MS });
  game.post.saveBoard(game, port.id);
  sendMarket(game, s, port);
  return null;
}

export function marketBuyOrder(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number, price: number): string | null {
  const bad = listCheck(game, s, port, good, qty, price);
  if (bad) return bad;
  const total = price * qty;
  const fee = listFee(total);
  if (s.profile!.gold < total + fee) return `The order needs ${total} silver held against it, and ${fee} for the listing`;
  s.profile!.gold -= total + fee;
  game.db.ledger(s.accountId, 'market_fee', -fee, port.id);
  const b = game.post.board(game, port.id);
  b.listings.push({ id: b.next++, kind: 'buy', seller: s.accountId, sellerName: s.name, good, qty, price, buyout: 0, bidder: null, bidderName: null, endsAt: game.wallNow() + LISTING_MS });
  game.post.saveBoard(game, port.id);
  sendMarket(game, s, port);
  return null;
}

export function marketAuction(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number, reserve: number, buyout: number, hours: number, from: 'hold' | 'warehouse' = 'hold'): string | null {
  if (!AUCTION_PORTS.has(port.id)) return 'The trophy auction sits in Tidewrack';
  const bad = listCheck(game, s, port, good, qty, reserve);
  if (bad) return bad;
  const bo = Math.floor(Number(buyout) || 0);
  if (bo && bo < reserve) return 'The buyout cannot be below the reserve';
  if (![2, 8, 24].includes(hours)) return 'An auction runs 2, 8 or 24 hours';
  const fee = listFee(reserve);
  if (s.profile!.gold < fee) return `The listing fee is ${fee} silver`;
  const e = takeGoods(s, port, good, qty, from);
  if (e) return e;
  s.profile!.gold -= fee;
  game.db.ledger(s.accountId, 'market_fee', -fee, port.id);
  const b = game.post.board(game, port.id);
  b.listings.push({ id: b.next++, kind: 'auction', seller: s.accountId, sellerName: s.name, good, qty, price: reserve, buyout: bo, bidder: null, bidderName: null, endsAt: game.wallNow() + hours * 3_600_000 });
  game.post.saveBoard(game, port.id);
  sendMarket(game, s, port);
  return null;
}

/** Buy from a sell listing, or sell into a buy order. */
export function marketFill(game: Game, s: PlayerSession, port: Port, id: number, qtyRaw: number): string | null {
  const b = game.post.board(game, port.id);
  const l = b.listings.find((x) => x.id === id);
  if (!l || l.kind === 'auction') return 'That listing is gone';
  if (l.seller === s.accountId) return 'That is your own listing';
  const qty = Math.min(l.qty, Math.floor(Number(qtyRaw)));
  if (!Number.isFinite(qty) || qty < 1) return 'Bad quantity';
  const p = s.profile!;
  const ship = s.ship!;
  const tax = saleTax(port);
  const gross = l.price * qty;
  const net = Math.floor(gross * (1 - tax));
  if (l.kind === 'sell') {
    if (p.gold < gross) return `That costs ${gross} silver`;
    const st = ship.stats;
    const free = st.holdVolume - cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
    if (qty * GOODS[l.good].volume > free + 1e-6) return 'No room in your hold';
    p.gold -= gross;
    ship.cargo[l.good] = (ship.cargo[l.good] ?? 0) + qty;
    const had = (ship.cargo[l.good] ?? 0) - qty;
    p.costBasis[l.good] = Math.round(((p.costBasis[l.good] ?? l.price) * had + l.price * qty) / Math.max(1, had + qty));
    ship.recompute(game.now);
    game.db.ledger(l.seller, 'market_fee', -(gross - net), port.id);
    deliver(game, l.seller, { from: `Harbour-master of ${port.name}`, subject: `Sold: ${qty} ${GOODS[l.good].name}`, body: `${s.name} bought ${qty} ${GOODS[l.good].name} at ${l.price} a unit. Less ${Math.round(tax * 100)}% duty, your draft is enclosed.`, gold: net, goods: null });
  } else {
    const e = takeGoods(s, port, l.good, qty, (ship.cargo[l.good] ?? 0) >= qty ? 'hold' : 'warehouse');
    if (e) return e;
    p.gold += net;
    game.db.ledger(s.accountId, 'market_fee', -(gross - net), port.id);
    deliver(game, l.seller, { from: `Harbour-master of ${port.name}`, subject: `Bought: ${qty} ${GOODS[l.good].name}`, body: `${s.name} filled your order: ${qty} ${GOODS[l.good].name} at ${l.price} a unit wait for you in ${port.name}.`, gold: 0, goods: { good: l.good, qty, port: port.id } });
  }
  l.qty -= qty;
  if (l.qty <= 0) b.listings = b.listings.filter((x) => x !== l);
  game.post.saveBoard(game, port.id);
  game.sendTo(s, { t: 'toast', msg: l.kind === 'sell' ? `Bought ${qty} ${GOODS[l.good].name} for ${gross} silver.` : `Sold ${qty} ${GOODS[l.good].name} for ${net} silver (after duty).`, kind: 'gold' });
  sendMarket(game, s, port);
  return null;
}

export function marketBid(game: Game, s: PlayerSession, port: Port, id: number, priceRaw: number): string | null {
  const b = game.post.board(game, port.id);
  const l = b.listings.find((x) => x.id === id);
  if (!l || l.kind !== 'auction' || l.endsAt <= game.wallNow()) return 'That lot is closed';
  if (l.seller === s.accountId) return 'You cannot bid on your own lot';
  if (l.bidder === s.accountId) return 'Yours is already the best bid';
  let price = Math.floor(Number(priceRaw));
  const min = l.bidder === null ? l.price : Math.max(l.price + 1, Math.ceil(l.price * 1.05));
  if (l.buyout && price >= l.buyout) price = l.buyout;
  else if (!Number.isFinite(price) || price < min) return `The next bid is at least ${min} silver`;
  const p = s.profile!;
  if (p.gold < price) return `You have ${p.gold} silver`;
  p.gold -= price;
  if (l.bidder !== null) {
    deliver(game, l.bidder, { from: 'Tidewrack Auction House', subject: `Outbid: ${l.qty} ${GOODS[l.good].name}`, body: `${s.name} bid ${price}. Your ${l.price} silver is returned.`, gold: l.price, goods: null });
  }
  l.price = price;
  l.bidder = s.accountId;
  l.bidderName = s.name;
  if (l.buyout && price >= l.buyout) {
    closeAuction(game, port, l);
    b.listings = b.listings.filter((x) => x !== l);
  } else if (l.endsAt - game.wallNow() < 5 * 60_000) l.endsAt = game.wallNow() + 5 * 60_000; // no sniping: a late bid holds the lot open
  game.post.saveBoard(game, port.id);
  sendMarket(game, s, port);
  return null;
}

function closeAuction(game: Game, port: Port, l: Listing): void {
  const good = GOODS[l.good].name;
  if (l.bidder === null) {
    deliver(game, l.seller, { from: 'Tidewrack Auction House', subject: `Unsold: ${l.qty} ${good}`, body: `No bid reached your reserve. The lot waits for you in ${port.name}.`, gold: 0, goods: { good: l.good, qty: l.qty, port: port.id } });
    return;
  }
  const seller = game.sessionByAccount(l.seller);
  const cut = Math.ceil(l.price * (seller ? commission(seller) : AUCTION_COMMISSION));
  game.db.ledger(l.seller, 'market_fee', -cut, port.id);
  deliver(game, l.seller, { from: 'Tidewrack Auction House', subject: `Sold at auction: ${l.qty} ${good}`, body: `${l.bidderName} took the lot for ${l.price} silver. Less the house's commission, your draft is enclosed.`, gold: l.price - cut, goods: null });
  deliver(game, l.bidder, { from: 'Tidewrack Auction House', subject: `Won: ${l.qty} ${good}`, body: `The lot is yours for ${l.price} silver. It waits for you in ${port.name}.`, gold: 0, goods: { good: l.good, qty: l.qty, port: port.id } });
}

export function marketCancel(game: Game, s: PlayerSession, port: Port, id: number): string | null {
  const b = game.post.board(game, port.id);
  const l = b.listings.find((x) => x.id === id);
  if (!l || l.seller !== s.accountId) return 'Not your listing';
  if (l.kind === 'auction' && l.bidder !== null) return 'A lot with bids on it cannot be withdrawn';
  b.listings = b.listings.filter((x) => x !== l);
  returnListing(game, port, l, true);
  game.post.saveBoard(game, port.id);
  sendMarket(game, s, port);
  return null;
}

/** Hands back what a closed listing held: silver as a draft, goods to collect in the port. */
function returnListing(game: Game, port: Port, l: Listing, withdrawn: boolean): void {
  const why = withdrawn ? 'Withdrawn' : 'Expired';
  if (l.kind === 'buy') {
    deliver(game, l.seller, { from: `Harbour-master of ${port.name}`, subject: `${why}: order for ${l.qty} ${GOODS[l.good].name}`, body: 'The silver held against your order is returned.', gold: l.price * l.qty, goods: null });
  } else {
    deliver(game, l.seller, { from: `Harbour-master of ${port.name}`, subject: `${why}: ${l.qty} ${GOODS[l.good].name}`, body: `Your goods wait for you in ${port.name}.`, gold: 0, goods: { good: l.good, qty: l.qty, port: port.id } });
  }
}

// ------------------------------------------------------------------------------------------ upkeep

/** Called every second: letters arriving for captains online; every ten, listings running out. */
export function stepPost(game: Game): void {
  const now = game.wallNow();
  for (const [acct, times] of game.post.pending) {
    const due = times.filter((t) => t <= now);
    if (!due.length) continue;
    const left = times.filter((t) => t > now);
    if (left.length) game.post.pending.set(acct, left);
    else game.post.pending.delete(acct);
    const s = game.sessionByAccount(acct);
    if (!s || s.disconnectedAt !== null) continue;
    const letters = mailbox(game, acct).letters.filter((l) => l.arriveAt <= now && !l.read).slice(-due.length);
    for (const l of letters) announce(game, s, l);
  }
  if (game.now < game.post.nextSweep) return;
  game.post.nextSweep = game.now + 10;
  for (const [portId, b] of game.post.allBoards(game)) {
    const done = b.listings.filter((l) => l.endsAt <= now);
    if (!done.length) continue;
    const port = game.portById(portId);
    if (!port) continue;
    b.listings = b.listings.filter((l) => l.endsAt > now);
    for (const l of done) {
      if (l.kind === 'auction') closeAuction(game, port, l);
      else returnListing(game, port, l, false);
    }
    game.post.saveBoard(game, portId);
  }
}
