// Trade empires and the guild wars for regions (docs/02 §14.A.3–4).
//
//  - Governors: in a lawless region, the guild that holds 60% of the route nodes when the week turns governs it
//    for the week — a 1% levy on trade in the region's free ports (the canonical ports are nobody's), first word
//    of the monsters that rise there, the governor's purple pennant. Against the snowball: base upkeep doubles,
//    the colonies riot, and nobody governs more than four weeks running.
//  - Trading houses: a guild may charter itself as a house and run convoys on a schedule — NPC merchantmen with
//    hired escorts carrying goods from one of its office stores to another, through the same sea as everyone.
//  - The Gravesend licence exchange: each week four monopoly licences (a good in a region's lawful ports) go to
//    the highest bidder; the licensee sells at +10%, everyone else pays a 20% unlicensed duty there.
//  - Against monopoly: a captain who floods one port with one good in an hour meets NPC counter-supply, and every
//    further tenth of the market costs another 15% of the price.
//  - The Trade Empires table, for captains who hardly ever fire a gun.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { EmpireView } from '../../../shared/src/protocol.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { log as guildLog, member, rankAtLeast } from './guilds.ts';
import { deliver as mail } from './post.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

const DAY = 24 * 3600_000;
const WEEK = 7 * DAY;
const WEEK_EPOCH = Date.UTC(2026, 0, 5); // a Monday
const GOVERN_SHARE = 0.6;
const MAX_WEEKS = 4;
const LEVY = 0.01;
const HOUSE_CHARTER = 20_000;
const CONVOY_VOLUME = 60;
const LICENCE_GOODS: GoodId[] = ['sugar', 'rum', 'tobacco', 'spices', 'cloth', 'salt', 'timber', 'gunpowder'];
const LICENCE_REGIONS: RegionId[] = ['black_coast', 'gravewater']; // where the Crown's and the League's ports are
export const GOVERNOR_PENNANT = '#5b2a86';

export interface Governor {
  guild: number;
  tag: string;
  since: number; // wall ms (the week it began)
  until: number;
  streak: number; // weeks running
}

interface Riot {
  port: string;
  until: number; // world time
  ships: number[];
  quelled: boolean;
  failed: boolean;
}

export interface Licence {
  good: GoodId;
  region: RegionId;
  bids: Record<string, { name: string; amount: number }>;
  holder?: number;
  holderName?: string;
}

interface LicenceBook {
  week: number; // the week the lots on sale are for
  lots: Licence[];
  active: Licence[]; // this week's licences
}

export interface ConvoyOrder {
  id: number;
  guild: number;
  from: string;
  to: string;
  good: GoodId;
  qty: number;
  everyHours: number;
  next: number; // wall ms
  escorts: number;
}

interface EmpireStore {
  governors: Partial<Record<RegionId, Governor>>;
  history: Partial<Record<RegionId, { guild: number; week: number }[]>>;
  lastWeek: number;
  houses: number[]; // guild ids chartered as trading houses
  orders: ConvoyOrder[];
  seq: number;
}

export function weekOf(wall: number): number {
  return Math.floor((wall - WEEK_EPOCH) / WEEK);
}

export class EmpireHub {
  private data: EmpireStore | null = null;
  riots = new Map<string, Riot>();
  flooding = new Map<string, { t: number; qty: number }[]>(); // `${account}:${port}:${good}` → recent sales

  store(game: Game): EmpireStore {
    if (!this.data) this.data = game.db.getKv<EmpireStore>('empires') ?? { governors: {}, history: {}, lastWeek: weekOf(game.wallNow()), houses: [], orders: [], seq: 1 };
    return this.data;
  }

  save(game: Game): void {
    if (this.data) game.db.setKv('empires', this.data);
  }

  drop(): void {
    this.data = null;
  }

  licences(game: Game): LicenceBook {
    const week = weekOf(game.wallNow());
    let book = game.db.getKv<LicenceBook>('licences');
    if (!book || book.week < week + 1) {
      // The lots on sale this week are for next week; last week's winners hold this week's licences.
      const active = book && book.week === week ? book.lots.filter((l) => l.holder !== undefined) : book?.active ?? [];
      book = { week: week + 1, lots: newLots(week + 1), active: book && book.week === week ? active : [] };
      game.db.setKv('licences', book);
    }
    return book;
  }
}

function newLots(week: number): Licence[] {
  const out: Licence[] = [];
  for (let i = 0; i < 4; i++) {
    const g = LICENCE_GOODS[(week * 3 + i * 5) % LICENCE_GOODS.length];
    const r = LICENCE_REGIONS[(week + i) % LICENCE_REGIONS.length];
    if (!out.some((l) => l.good === g && l.region === r)) out.push({ good: g, region: r, bids: {} });
  }
  return out;
}

// ================================================================== governors

function lawless(): RegionId[] {
  return REGION_IDS.filter((r) => REGIONS[r].safety === 'lawless');
}

/** The guild that governs a region this week, if any. */
export function governorOf(game: Game, region: RegionId): Governor | null {
  const g = game.empires.store(game).governors[region];
  return g && g.until > game.wallNow() ? g : null;
}

/** When the week turns: count each lawless region's route nodes; 60% makes a governor (four weeks at most). */
export function turnOfTheWeek(game: Game): void {
  const st = game.empires.store(game);
  const week = weekOf(game.wallNow());
  if (week <= st.lastWeek) return;
  st.lastWeek = week;
  const nodes = Object.values(game.guilds.store(game).nodes);
  for (const region of lawless()) {
    const here = nodes.filter((n) => game.world.islands[n.island]?.region === region);
    if (!here.length) continue;
    const count = new Map<number, number>();
    for (const n of here) if (n.holder !== null) count.set(n.holder, (count.get(n.holder) ?? 0) + 1);
    const [best, n] = [...count.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const prev = st.governors[region];
    const hist = (st.history[region] ??= []);
    let gov: Governor | undefined;
    if (best !== null && n / here.length >= GOVERN_SHARE) {
      const streak = prev && prev.guild === best && prev.until >= game.wallNow() - DAY ? prev.streak + 1 : 1;
      const g = game.guilds.store(game).guilds[best];
      if (g && streak <= MAX_WEEKS) {
        gov = { guild: best, tag: g.tag, since: WEEK_EPOCH + week * WEEK, until: WEEK_EPOCH + (week + 1) * WEEK, streak };
        hist.push({ guild: best, week });
      } else if (g) announce(game, `[${g.tag}] has governed ${REGIONS[region].name} four weeks running; the colonies will not have them a fifth.`);
    }
    if (gov) st.governors[region] = gov;
    else delete st.governors[region];
    st.history[region] = hist.slice(-12);
    if (gov) announce(game, `[${gov.tag}] holds ${Math.round((n / here.length) * 100)}% of the route nodes in ${REGIONS[region].name} and governs it this week.`);
  }
  game.empires.save(game);
}

function announce(game: Game, text: string): void {
  for (const p of game.world.ports) game.addRumor(p.x, p.y, text);
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${text}`, kind: 'info' });
}

/** The governor's levy on trade in a free port of the region: 1% of the value (0 where nobody governs). */
export function levyFor(game: Game, port: Port, value: number): number {
  if (port.key || port.faction !== 'free' || REGIONS[port.region].safety !== 'lawless') return 0;
  const gov = governorOf(game, port.region);
  if (!gov || !game.guilds.store(game).guilds[gov.guild]) return 0;
  const riot = game.empires.riots.get(port.id);
  if (riot && (!riot.quelled || riot.failed)) return 0; // a rioting colony pays nobody
  return Math.floor(value * LEVY);
}

/** The levy goes to the governing guild's treasury. */
export function payLevy(game: Game, port: Port, levy: number): void {
  const gov = governorOf(game, port.region);
  const g = gov ? game.guilds.store(game).guilds[gov.guild] : undefined;
  if (!g || levy <= 0) return;
  g.treasury += levy;
  game.guilds.touch();
}

/** Base upkeep doubles for a governing guild. */
export function upkeepMul(game: Game, guildId: number): number {
  for (const r of lawless()) if (governorOf(game, r)?.guild === guildId) return 2;
  return 1;
}

/** Whether a captain's guild governs any region this week. */
export function governsAny(game: Game, accountId: number): boolean {
  const g = game.guilds.of(game, accountId);
  return !!g && lawless().some((r) => governorOf(game, r)?.guild === g.id);
}

/** Governors hear of monsters first. */
export function governorsOfRegion(game: Game, region: RegionId): number | null {
  return governorOf(game, region)?.guild ?? null;
}

/** Every minute: colonies riot against their governors; rioters are sunk or they win. */
function riots(game: Game): void {
  const now = game.now;
  for (const [portId, r] of [...game.empires.riots]) {
    const alive = r.ships.filter((id) => game.ships.get(id)?.alive);
    if (!alive.length && !r.quelled && !r.failed) {
      r.quelled = true;
      const port = game.portById(portId)!;
      announce(game, `The riot in ${port.name} is put down. The governor's levy flows again.`);
    }
    if (now >= r.until) {
      if (!r.quelled && !r.failed) {
        r.failed = true;
        r.until = now + 3 * 24 * 3600;
        for (const id of alive) game.removeShip(id);
        announce(game, `The riot in ${game.portById(portId)!.name} has won: no levy is paid there for three days.`);
      } else game.empires.riots.delete(portId);
    }
  }
  for (const region of lawless()) {
    const gov = governorOf(game, region);
    if (!gov) continue;
    const ports = game.world.ports.filter((p) => p.region === region && !p.key && p.faction === 'free' && game.inZone(p.x, p.y) && !game.empires.riots.has(p.id));
    if (!ports.length || !game.rng.chance(0.3 / 360)) continue; // about one riot in twenty hours of a governorship
    startRiot(game, game.rng.pick(ports), gov);
  }
}

/** A colony rises against its governor: three rioters' ships on the roads; sink them within two hours. */
export function startRiot(game: Game, port: Port, gov: Governor): void {
  const now = game.now;
  const ids: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const r = game.spawnNpcShip('pirate', 'brigantine', 'confederacy', port.x + Math.sin(a) * 1200, port.y - Math.cos(a) * 1200, a, { ship: `Rioters of ${port.name}`, captain: 'the Colony' });
    const b = game.npcs.get(r.id);
    if (b) {
      b.active = true;
      b.area = { x: port.x, y: port.y, r: 2500 };
    }
    game.grid.upsert(r.id, r.state.x, r.state.y);
    ids.push(r.id);
  }
  game.empires.riots.set(port.id, { port: port.id, until: now + 7200, ships: ids, quelled: false, failed: false });
  announce(game, `${port.name} riots against the governors [${gov.tag}]! No levy until the rioters are sunk — two hours, or the colony wins.`);
}

// ================================================================== trading houses and convoys

export function isHouse(game: Game, guildId: number): boolean {
  return game.empires.store(game).houses.includes(guildId);
}

export function empireAction(game: Game, s: PlayerSession, port: Port | null, msg: { action: string; from?: string; to?: string; good?: string; qty?: number; every?: number; escorts?: number; id?: number; amount?: number; lot?: number }): string | null {
  const st = game.empires.store(game);
  const g = game.guilds.of(game, s.accountId);
  switch (msg.action) {
    case 'charter': {
      if (!g || !rankAtLeast(member(g, s.accountId), 'admiral')) return 'Only the admiral charters a trading house';
      if (st.houses.includes(g.id)) return 'Your guild is already a trading house';
      if (g.treasury < HOUSE_CHARTER) return `A charter costs ${HOUSE_CHARTER} from the treasury`;
      g.treasury -= HOUSE_CHARTER;
      st.houses.push(g.id);
      game.guilds.touch();
      game.empires.save(game);
      announce(game, `[${g.tag}] is chartered as a trading house.`);
      return null;
    }
    case 'convoy': {
      if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up order convoys';
      if (!st.houses.includes(g.id)) return 'Only a chartered trading house runs convoys';
      const from = game.portById(String(msg.from)), to = game.portById(String(msg.to));
      const good = msg.good as GoodId;
      const qty = Math.trunc(Number(msg.qty));
      if (!from || !to || from === to) return 'Two different ports';
      if ((g.offices[from.id] ?? 0) < game.wallNow() || (g.offices[to.id] ?? 0) < game.wallNow()) return 'The house needs an office in both ports';
      if (!GOODS[good] || !(qty > 0) || cargoVolume({ [good]: qty }) > CONVOY_VOLUME) return `A convoy carries up to ${CONVOY_VOLUME} m³`;
      const every = Math.max(0, Math.min(48, Math.trunc(Number(msg.every ?? 0))));
      const escorts = Math.max(0, Math.min(2, Math.trunc(Number(msg.escorts ?? 1))));
      const order: ConvoyOrder = { id: st.seq++, guild: g.id, from: from.id, to: to.id, good, qty, everyHours: every, next: game.wallNow(), escorts };
      st.orders.push(order);
      game.empires.save(game);
      return sailConvoy(game, order) ?? null;
    }
    case 'cancel': {
      if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up cancel convoys';
      st.orders = st.orders.filter((o) => !(o.id === msg.id && o.guild === g.id));
      game.empires.save(game);
      return null;
    }
    case 'bid': {
      if (!port || port.id !== 'gravesend') return 'Licences are sold only at the Gravesend exchange';
      const book = game.empires.licences(game);
      const lot = book.lots[Math.trunc(Number(msg.lot))];
      const amount = Math.trunc(Number(msg.amount));
      if (!lot) return 'No such licence';
      const p = s.profile!;
      const prev = lot.bids[s.accountId]?.amount ?? 0;
      const top = Math.max(0, ...Object.values(lot.bids).map((b) => b.amount));
      if (!(amount > top) || amount < 500) return `Bid more than ${Math.max(499, top)} silver`;
      if (p.gold < amount - prev) return 'You cannot cover the bid';
      p.gold -= amount - prev; // held in escrow
      lot.bids[s.accountId] = { name: s.name, amount };
      game.db.ledger(s.accountId, 'licence_bid', -(amount - prev), `${lot.good}@${lot.region}`);
      game.db.setKv('licences', book);
      return null;
    }
  }
  return 'Unknown order';
}

/** A convoy puts to sea: goods from the house's store, a merchantman and her escorts, through the open sea. */
function sailConvoy(game: Game, o: ConvoyOrder): string | null {
  const g = game.guilds.store(game).guilds[o.guild];
  const from = game.portById(o.from)!, to = game.portById(o.to)!;
  if (!g) return 'No such guild';
  const store = (g.stores[from.id] ??= {});
  const have = Math.floor(store[o.good] ?? 0);
  if (have <= 0) return `The store at ${from.name} holds no ${GOODS[o.good].name.toLowerCase()}`;
  const cost = 800 + 400 * o.escorts;
  if (g.treasury < cost) return `A convoy costs ${cost} from the treasury (hire and wages)`;
  if (!game.inZone(from.x, from.y)) return 'That port lies in another zone of the sea';
  const path = game.routes.between(from, to);
  if (!path) return 'No sea road between them';
  const qty = Math.min(have, o.qty);
  store[o.good] = have - qty;
  if (!store[o.good]) delete store[o.good];
  g.treasury -= cost;
  const m = game.spawnNpcShip('merchant', 'fluyt', 'free', from.x, from.y, 0, { ship: `[${g.tag}] ${GOODS[o.good].name} Convoy`, captain: `Factor of [${g.tag}]` });
  m.cargo = { [o.good]: qty };
  m.convoyOf = { guild: g.id, to: to.id };
  const brain = game.npcs.get(m.id)!;
  brain.active = true;
  brain.destPort = to.id;
  brain.path = path;
  brain.traveled = 0;
  brain.length = path.reduce((a, pt, i) => (i ? a + Math.hypot(pt[0] - path[i - 1][0], pt[1] - path[i - 1][1]) : 0), 0);
  brain.wp = 1;
  game.grid.upsert(m.id, m.state.x, m.state.y);
  for (let i = 0; i < o.escorts; i++) {
    const e = game.spawnNpcShip('escort', 'brig', 'free', from.x + (i + 1) * 60, from.y, 0, { ship: `[${g.tag}] Convoy Escort ${i + 1}`, captain: 'Hired Master' });
    e.ownerId = m.id;
    const eb = game.npcs.get(e.id)!;
    eb.active = true;
    game.grid.upsert(e.id, e.state.x, e.state.y);
  }
  o.next = o.everyHours > 0 ? game.wallNow() + o.everyHours * 3600_000 : Infinity;
  game.guilds.touch();
  guildLog(game, g, `A convoy of ${qty} ${GOODS[o.good].name.toLowerCase()} sails from ${from.name} for ${to.name}.`);
  return null;
}

/** A convoy made port: the goods go into the house's store there; the escorts are paid off. */
export function convoyArrived(game: Game, ship: ShipEntity): void {
  const c = ship.convoyOf!;
  const g = game.guilds.store(game).guilds[c.guild];
  const to = game.portById(c.to);
  if (g && to) {
    const store = (g.stores[to.id] ??= {});
    for (const [good, n] of Object.entries(ship.cargo) as [GoodId, number][]) store[good] = (store[good] ?? 0) + n;
    game.guilds.touch();
    guildLog(game, g, `The convoy reached ${to.name}: ${Object.entries(ship.cargo).map(([k, n]) => `${n} ${GOODS[k as GoodId].name.toLowerCase()}`).join(', ')} into the store.`);
  }
  for (const e of game.ships.values()) if (e.ownerId === ship.id) game.removeShip(e.id);
  ship.cargo = {};
  game.removeShip(ship.id);
}

// ================================================================== licences and monopoly

/** Price multiplier on a captain's sale: the licence (yours +10%, another's −20%) and the flood of one market. */
export function saleMul(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number): number {
  let mul = 1;
  const lawful = port.faction === 'crown' || port.faction === 'league';
  if (lawful) {
    const lic = game.empires.licences(game).active.find((l) => l.good === good && l.region === port.region);
    if (lic) mul *= lic.holder === s.accountId ? 1.1 : 0.8;
  }
  // Counter-supply: past 40% of the market in an hour, every further tenth costs another 15%.
  const gm = game.markets.get(port.id)?.goods[good];
  if (gm) {
    const key = `${s.accountId}:${port.id}:${good}`;
    const log = (game.empires.flooding.get(key) ?? []).filter((e) => game.now - e.t < 3600);
    const sold = log.reduce((a, e) => a + e.qty, 0) + qty;
    const over = sold / Math.max(1, gm.target) - 0.4;
    if (over > 0) mul *= Math.pow(0.85, Math.ceil(over / 0.1));
  }
  return mul;
}

export function noteSale(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number): void {
  const key = `${s.accountId}:${port.id}:${good}`;
  const log = (game.empires.flooding.get(key) ?? []).filter((e) => game.now - e.t < 3600);
  log.push({ t: game.now, qty });
  game.empires.flooding.set(key, log);
  // NPC counter-supply: the market fills from elsewhere when one captain floods it.
  const gm = game.markets.get(port.id)?.goods[good];
  const sold = log.reduce((a, e) => a + e.qty, 0);
  if (gm && sold > gm.target * 0.4) gm.stock += Math.min(qty, sold - gm.target * 0.4) * 0.5;
}

/** The week turns at the exchange: the highest bid takes each licence; the rest get their silver back. */
function settleLicences(game: Game): void {
  const week = weekOf(game.wallNow());
  const book = game.db.getKv<LicenceBook>('licences');
  if (!book || book.week > week) return;
  for (const lot of book.lots) {
    const bids = Object.entries(lot.bids).sort((a, b) => b[1].amount - a[1].amount);
    if (bids.length) {
      lot.holder = Number(bids[0][0]);
      lot.holderName = bids[0][1].name;
    }
    for (const [acct, b] of bids.slice(1)) refund(game, Number(acct), b.amount, `Outbid for the ${GOODS[lot.good].name} licence`);
    if (lot.holder !== undefined) announce(game, `${lot.holderName} holds the Crown's licence for ${GOODS[lot.good].name.toLowerCase()} in ${REGIONS[lot.region].name} this week.`);
  }
  const next: LicenceBook = { week: week + 1, lots: newLots(week + 1), active: book.lots.filter((l) => l.holder !== undefined) };
  game.db.setKv('licences', next);
}

function refund(game: Game, account: number, amount: number, why: string): void {
  const s = game.sessionByAccount(account);
  if (s?.profile) {
    s.profile.gold += amount;
    game.sendTo(s, { t: 'toast', msg: `${why}: ${amount} silver returned.`, kind: 'info' });
  } else mail(game, account, { from: 'The Gravesend Exchange', subject: why, body: 'Your bid is returned.', gold: amount, goods: null });
  game.db.ledger(account, 'licence_refund', amount, why);
}

// ================================================================== the calendar and the view

const minuteAt = new WeakMap<Game, number>();

export function stepEmpires(game: Game): void {
  if ((minuteAt.get(game) ?? 0) > game.now) return;
  minuteAt.set(game, game.now + 60);
  if (game.zoneLead) {
    turnOfTheWeek(game);
    settleLicences(game);
    // The trade empires table.
    updateEmpireBoard(game);
  }
  riots(game);
  const st = game.empires.store(game);
  const wall = game.wallNow();
  for (const o of st.orders) {
    if (o.next > wall) continue;
    const why = sailConvoy(game, o);
    if (why) o.next = wall + 3600_000; // try again in an hour
  }
  st.orders = st.orders.filter((o) => o.next !== Infinity);
  game.empires.save(game);
}

function updateEmpireBoard(game: Game): void {
  const board = game.db.getKv<Record<string, { name: string; profit: number }>>('trade_empires') ?? {};
  for (const s of game.sessions) if (s.profile) board[s.accountId] = { name: s.name, profit: Math.round(s.profile.stats.tradeProfit) };
  game.db.setKv('trade_empires', board);
}

export function empireView(game: Game, s: PlayerSession): EmpireView {
  const st = game.empires.store(game);
  const g = game.guilds.of(game, s.accountId);
  const book = game.empires.licences(game);
  const board = game.db.getKv<Record<string, { name: string; profit: number }>>('trade_empires') ?? {};
  return {
    governors: lawless().map((r) => {
      const gov = governorOf(game, r);
      const nodes = Object.values(game.guilds.store(game).nodes).filter((n) => game.world.islands[n.island]?.region === r);
      const mine = g ? nodes.filter((n) => n.holder === g.id).length : 0;
      return { region: REGIONS[r].name, tag: gov?.tag ?? null, until: gov?.until ?? 0, streak: gov?.streak ?? 0, nodes: nodes.length, mine };
    }),
    riots: [...game.empires.riots.values()].filter((r) => !r.failed || r.until > game.now).map((r) => ({ port: game.portById(r.port)?.name ?? r.port, quelled: r.quelled, failed: r.failed })),
    house: !!g && st.houses.includes(g.id),
    orders: g ? st.orders.filter((o) => o.guild === g.id).map((o) => ({ id: o.id, from: game.portById(o.from)?.name ?? o.from, to: game.portById(o.to)?.name ?? o.to, good: GOODS[o.good].name, qty: o.qty, everyHours: o.everyHours, escorts: o.escorts })) : [],
    offices: g ? Object.keys(g.offices).filter((p) => (g.offices[p] ?? 0) >= game.wallNow()) : [],
    lots: book.lots.map((l, i) => ({ index: i, good: GOODS[l.good].name, region: REGIONS[l.region].name, top: Math.max(0, ...Object.values(l.bids).map((b) => b.amount)), mine: l.bids[s.accountId]?.amount ?? 0 })),
    licences: book.active.map((l) => ({ good: GOODS[l.good].name, region: REGIONS[l.region].name, holder: l.holderName ?? '', mine: l.holder === s.accountId })),
    empires: Object.values(board).sort((a, b) => b.profit - a.profit).slice(0, 10),
  };
}
