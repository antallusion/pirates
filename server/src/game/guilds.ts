// Guilds (docs/02 §12, docs/01 §8–9): a captain's company of companies.
//  - Ranks: admiral (1), vice-admirals (≤3), commodores (≤10), captains, bosuns, sailors, cabin boys (7 days'
//    probation). Up to 150 members; alliances of up to three guilds.
//  - The treasury: a tax of 0–15% on members' sales, route tolls, deposits; withdrawals by rank with a daily cap.
//  - Guild offices in ports (2 000 a week): a store in each, deposit by anyone, withdrawal by bosuns and up
//    (a daily value cap by rank, not in the first day of membership), every move in the log. Internal contracts
//    pay members from the treasury for goods delivered into an office.
//  - The guild fleet: members give hulls from their berths; members borrow them against 20% of the value.
//  - The flagship: tier IV or better; the standard gives guild ships within 800 m +5% reload and a morale floor
//    of 20; if she goes down, the guild sails 5% worse for an hour and the victor keeps the torn standard.
//  - Diplomacy: war (50 000, a day to prepare, at least seven days, war score, peace on terms, fourteen days'
//    ban on a new war between the two), alliances, non-aggression pacts. At war, members of the two guilds are
//    fair game in contested water; allies and pact partners cannot fire on each other.
//  - Routes: lighthouse islands in contested and lawless water are nodes. Thirty minutes with only your guild's
//    ships within 1.5 km takes one; the holder sets a toll of 1–5% on passing merchants and hears who sails by.
//  - Islands: up to six guild islands (leased from the treasury by vice-admirals); a base on one raises it through
//    five levels (+2 slots a level, weekly upkeep from the island's treasury).

import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { dist } from '../../../shared/src/math.ts';
import type { GuildRank, GuildView, RouteNodeView } from '../../../shared/src/protocol.ts';
import { cargoValue, cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import type { ShipEntity } from './ship.ts';

const DAY = 86_400_000;
const HOUR = 3_600_000;
export const GUILD_COST = 10_000;
export const GUILD_MAX = 150;
export const WAR_COST = 50_000;
export const OFFICE_WEEK = 2_000;
export const NODE_HOLD_SEC = 1800;
export const RANKS: GuildRank[] = ['admiral', 'vice', 'commodore', 'captain', 'bosun', 'sailor', 'cabin_boy'];
const RANK_CAP: Partial<Record<GuildRank, number>> = { admiral: 1, vice: 3, commodore: 10 };
const WITHDRAW_CAP: Partial<Record<GuildRank, number>> = { admiral: Infinity, vice: 200_000, commodore: 50_000, bosun: 20_000 };
const TREASURY_CAP: Partial<Record<GuildRank, number>> = { admiral: Infinity, vice: 50_000 };
export const BASE_COST = [0, 20_000, 60_000, 160_000, 360_000, 600_000];
export const BASE_WEEK = [0, 5_000, 15_000, 40_000, 90_000, 150_000];
export const BASE_NAMES = ['', 'Anchorage', 'Outpost', 'Fortress', 'Citadel', 'Stronghold'];

export interface Member {
  account: number;
  name: string;
  rank: GuildRank;
  joined: number;
  out: { day: number; value: number }; // withdrawn today (goods value + silver)
}

export interface GuildShip {
  id: number;
  loadout: import('../../../shared/src/sim/shipstats.ts').ShipLoadout;
  hull: number;
  port: string;
  lentTo: number | null;
  deposit: number;
  giver: string;
}

export interface War {
  a: number;
  b: number;
  declared: number;
  prepUntil: number;
  minEnd: number;
  score: Record<string, number>;
  terms: { from: number; tribute: number } | null;
}

export interface Guild {
  id: number;
  name: string;
  tag: string;
  created: number;
  members: Member[];
  treasury: number;
  tax: number; // percent of members' sales
  offices: Record<string, number>; // port -> paid until (wall ms)
  stores: Record<string, Cargo>;
  contracts: { id: number; good: GoodId; qty: number; port: string; reward: number; by: string }[];
  fleet: GuildShip[];
  flagship: number | null; // account whose ship flies the standard
  tornUntil: number;
  log: { t: number; text: string }[];
  invites: { account: number; by: string; until: number }[];
  alliance: number[]; // other guild ids
  pacts: number[];
  offers: { kind: 'alliance' | 'pact'; from: number; until: number }[];
  bans: Record<string, number>; // guild id -> no war before (wall ms)
  nextId: number;
}

export interface RouteNode {
  island: number;
  holder: number | null;
  toll: number; // percent
  progress: Record<string, number>; // guild id -> seconds held
  tollToday: { day: number; paid: number };
  seen: Record<string, number>; // account id -> wall ms last reported
}

interface Store {
  next: number;
  guilds: Record<string, Guild>;
  wars: War[];
  nodes: Record<string, RouteNode>;
}

export class GuildHub {
  private data: Store | null = null;
  private byAccount: Map<number, number> | null = null;
  private dirty = false;

  store(game: Game): Store {
    if (!this.data) {
      this.data = game.db.getKv<Store>('guilds') ?? { next: 1, guilds: {}, wars: [], nodes: {} };
      this.byAccount = new Map();
      for (const g of Object.values(this.data.guilds)) for (const m of g.members) this.byAccount.set(m.account, g.id);
      // Route nodes: every lighthouse island in contested and lawless water.
      for (const isl of game.world.islands) {
        if (isl.portId || !isl.features.includes('lighthouse') || REGIONS[isl.region].safety === 'safe') continue;
        this.data.nodes[isl.id] ??= { island: isl.id, holder: null, toll: 2, progress: {}, tollToday: { day: 0, paid: 0 }, seen: {} };
      }
    }
    return this.data;
  }

  touch(): void {
    this.dirty = true;
  }

  save(game: Game): void {
    if (this.dirty && this.data) {
      game.db.setKv('guilds', this.data);
      this.dirty = false;
    }
  }

  of(game: Game, account: number | null): Guild | null {
    if (account === null) return null;
    this.store(game);
    const id = this.byAccount!.get(account);
    return id === undefined ? null : this.data!.guilds[id] ?? null;
  }

  get(game: Game, id: number): Guild | null {
    return this.store(game).guilds[id] ?? null;
  }

  index(account: number, guild: number | null): void {
    if (guild === null) this.byAccount?.delete(account);
    else this.byAccount?.set(account, guild);
  }
}

// ------------------------------------------------------------------------------------------ basics

function member(g: Guild, account: number): Member | undefined {
  return g.members.find((m) => m.account === account);
}

function rankAtLeast(m: Member | undefined, r: GuildRank): boolean {
  return !!m && RANKS.indexOf(m.rank) <= RANKS.indexOf(r);
}

function log(game: Game, g: Guild, text: string): void {
  g.log.push({ t: game.wallNow(), text });
  if (g.log.length > 120) g.log.splice(0, g.log.length - 120);
  game.guilds.touch();
}

export function guildNotify(game: Game, gid: number, subject: string, body: string): void {
  const g = game.guilds.get(game, gid);
  if (!g) return;
  log(game, g, subject);
  for (const m of g.members) if (rankAtLeast(m, 'vice')) deliver(game, m.account, { from: `${g.name} [${g.tag}]`, subject, body, gold: 0, goods: null });
}

function tell(game: Game, g: Guild, msg: string): void {
  for (const m of g.members) {
    const s = game.sessionByAccount(m.account);
    if (s) game.sendTo(s, { t: 'toast', msg, kind: 'info' });
  }
}

/** The guild's tag on its members' ships (resent to everyone who can see them). */
function retag(game: Game, account: number): void {
  const s = game.sessionByAccount(account);
  if (!s?.ship) return;
  s.ship.guildTag = game.guilds.of(game, account)?.tag ?? null;
  for (const o of game.sessions) o.knownEntities.delete(s.ship.id);
}

export function guildOfShip(game: Game, ship: ShipEntity): Guild | null {
  const acct = ship.accountId ?? (ship.ownerId !== null ? game.ships.get(ship.ownerId)?.accountId ?? null : null);
  return game.guilds.of(game, acct);
}

/** Same guild, allied guilds, or a pact: they do not fire on each other. */
export function guildFriends(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  const ga = guildOfShip(game, a), gb = guildOfShip(game, b);
  if (!ga || !gb) return false;
  return ga.id === gb.id || ga.alliance.includes(gb.id) || ga.pacts.includes(gb.id);
}

export function allied(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  const ga = guildOfShip(game, a), gb = guildOfShip(game, b);
  return !!ga && !!gb && (ga.id === gb.id || ga.alliance.includes(gb.id));
}

export function activeWar(game: Game, ga: number, gb: number): War | null {
  const now = game.wallNow();
  return game.guilds.store(game).wars.find((w) => ((w.a === ga && w.b === gb) || (w.a === gb && w.b === ga)) && now >= w.prepUntil) ?? null;
}

/** At war (past the day of preparation): fair game for each other in contested water. */
export function atWar(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  const ga = guildOfShip(game, a), gb = guildOfShip(game, b);
  return !!ga && !!gb && !!activeWar(game, ga.id, gb.id);
}

// ------------------------------------------------------------------------------------------ founding and membership

export function foundGuild(game: Game, s: PlayerSession, rawName: string, rawTag: string): string | null {
  const p = s.profile!;
  if (game.guilds.of(game, s.accountId)) return 'Leave your guild first';
  if (!s.ship?.docked) return 'Guilds are registered at a harbour office';
  const name = String(rawName ?? '').replace(/\s+/g, ' ').trim();
  const tag = String(rawTag ?? '').trim().toUpperCase();
  if (!/^[\p{L}\p{N} '\-]{3,24}$/u.test(name)) return 'A guild name is 3–24 letters';
  if (!/^[A-Z0-9]{2,4}$/.test(tag)) return 'A tag is 2–4 letters or digits';
  const st = game.guilds.store(game);
  for (const g of Object.values(st.guilds)) {
    if (g.name.toLowerCase() === name.toLowerCase()) return 'That name is taken';
    if (g.tag === tag) return 'That tag is taken';
  }
  if (p.gold < GUILD_COST) return `Registering a guild costs ${GUILD_COST} silver`;
  p.gold -= GUILD_COST;
  game.db.ledger(s.accountId, 'guild_found', -GUILD_COST, tag);
  const now = game.wallNow();
  const g: Guild = {
    id: st.next++, name, tag, created: now, members: [{ account: s.accountId, name: s.name, rank: 'admiral', joined: now, out: { day: 0, value: 0 } }],
    treasury: 0, tax: 0, offices: {}, stores: {}, contracts: [], fleet: [], flagship: null, tornUntil: 0, log: [], invites: [], alliance: [], pacts: [], offers: [], bans: {}, nextId: 1,
  };
  st.guilds[g.id] = g;
  game.guilds.index(s.accountId, g.id);
  log(game, g, `${s.name} founds ${name} [${tag}].`);
  retag(game, s.accountId);
  return null;
}

export function invite(game: Game, s: PlayerSession, name: string): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g || !rankAtLeast(member(g, s.accountId), 'commodore')) return 'Commodores and up invite';
  if (g.members.length >= GUILD_MAX) return `A guild holds ${GUILD_MAX}`;
  const t = game.sessionByName(String(name ?? ''));
  if (!t || !t.profile) return 'No captain of that name is at sea';
  if (game.guilds.of(game, t.accountId)) return `${t.name} already has a guild`;
  const now = game.wallNow();
  g.invites = g.invites.filter((i) => i.until > now && i.account !== t.accountId);
  g.invites.push({ account: t.accountId, by: s.name, until: now + DAY });
  game.guilds.touch();
  game.sendTo(t, { t: 'toast', msg: `${s.name} invites you into ${g.name} [${g.tag}]. Answer in the Guild tab [Y].`, kind: 'info' });
  pushGuild(game, t);
  return null;
}

export function answerInvite(game: Game, s: PlayerSession, gid: number, accept: boolean): string | null {
  const g = game.guilds.get(game, gid);
  const now = game.wallNow();
  const inv = g?.invites.find((i) => i.account === s.accountId && i.until > now);
  if (!g || !inv) return 'That invitation has lapsed';
  g.invites = g.invites.filter((i) => i !== inv);
  game.guilds.touch();
  if (!accept) return null;
  if (game.guilds.of(game, s.accountId)) return 'Leave your guild first';
  if (g.members.length >= GUILD_MAX) return 'The guild is full';
  g.members.push({ account: s.accountId, name: s.name, rank: 'cabin_boy', joined: now, out: { day: 0, value: 0 } });
  game.guilds.index(s.accountId, g.id);
  log(game, g, `${s.name} joins (on probation).`);
  tell(game, g, `${s.name} joins ${g.name}.`);
  retag(game, s.accountId);
  return null;
}

export function leaveGuild(game: Game, s: PlayerSession): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g) return 'You belong to no guild';
  const m = member(g, s.accountId)!;
  if (m.rank === 'admiral' && g.members.length > 1) return 'Hand the admiralty to another first (or disband)';
  if (g.fleet.some((f) => f.lentTo === s.accountId)) return 'Return the guild’s hull first';
  removeMember(game, g, s.accountId, `${s.name} leaves.`);
  return null;
}

function removeMember(game: Game, g: Guild, account: number, why: string): void {
  g.members = g.members.filter((m) => m.account !== account);
  game.guilds.index(account, null);
  if (g.flagship === account) g.flagship = null;
  log(game, g, why);
  retag(game, account);
  if (!g.members.length) disband(game, g);
}

function disband(game: Game, g: Guild): void {
  const st = game.guilds.store(game);
  for (const m of g.members) {
    game.guilds.index(m.account, null);
    retag(game, m.account);
  }
  // The treasury is shared out among the last members by letter; guild islands go back to the faction.
  const share = g.members.length ? Math.floor(g.treasury / g.members.length) : 0;
  for (const m of g.members) if (share) deliver(game, m.account, { from: `${g.name} [${g.tag}]`, subject: 'The guild is dissolved', body: 'Your share of the treasury is enclosed.', gold: share, goods: null });
  for (const h of Object.values(game.holdings.map(game))) if (h.owner.kind === 'guild' && h.owner.id === g.id) h.until = Math.min(h.until, game.wallNow());
  st.wars = st.wars.filter((w) => w.a !== g.id && w.b !== g.id);
  for (const o of Object.values(st.guilds)) {
    o.alliance = o.alliance.filter((x) => x !== g.id);
    o.pacts = o.pacts.filter((x) => x !== g.id);
  }
  for (const n of Object.values(st.nodes)) if (n.holder === g.id) n.holder = null;
  delete st.guilds[g.id];
  game.guilds.touch();
}

export function disbandGuild(game: Game, s: PlayerSession): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g || member(g, s.accountId)?.rank !== 'admiral') return 'Only the admiral dissolves a guild';
  tell(game, g, `${g.name} is dissolved.`);
  disband(game, g);
  return null;
}

export function kick(game: Game, s: PlayerSession, account: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  const me = g && member(g, s.accountId);
  const them = g && member(g, account);
  if (!g || !me || !them || !rankAtLeast(me, 'vice')) return 'Vice-admirals and up put members ashore';
  if (RANKS.indexOf(them.rank) <= RANKS.indexOf(me.rank)) return 'Only those beneath you';
  if (g.fleet.some((f) => f.lentTo === account)) return 'They still hold a guild hull';
  removeMember(game, g, account, `${them.name} is put ashore by ${s.name}.`);
  return null;
}

export function setRank(game: Game, s: PlayerSession, account: number, rank: GuildRank): string | null {
  const g = game.guilds.of(game, s.accountId);
  const me = g && member(g, s.accountId);
  const them = g && member(g, account);
  if (!g || !me || !them || !RANKS.includes(rank)) return 'No such member';
  if (them === me) return 'Not yourself';
  // The admiral sets anyone; a vice-admiral up to commodore, and only for those beneath.
  if (me.rank !== 'admiral' && !(me.rank === 'vice' && RANKS.indexOf(rank) >= RANKS.indexOf('commodore') && RANKS.indexOf(them.rank) > RANKS.indexOf('vice'))) return 'You cannot give that rank';
  if (rank === 'admiral') {
    me.rank = 'vice';
    them.rank = 'admiral';
    log(game, g, `${s.name} hands the admiralty to ${them.name}.`);
    game.guilds.touch();
    return null;
  }
  const cap = RANK_CAP[rank];
  if (cap && g.members.filter((m) => m.rank === rank && m !== them).length >= cap) return `A guild has at most ${cap} of that rank`;
  them.rank = rank;
  log(game, g, `${them.name} is now ${rank.replace('_', ' ')} (${s.name}).`);
  return null;
}

// ------------------------------------------------------------------------------------------ treasury, tax

function withdrawOk(game: Game, g: Guild, m: Member, value: number, caps: Partial<Record<GuildRank, number>>): string | null {
  const cap = caps[m.rank];
  if (cap === undefined) return 'Your rank may only deposit';
  if (game.wallNow() - m.joined < DAY) return 'New members may not take out in their first day';
  const day = Math.floor(game.wallNow() / DAY);
  if (m.out.day !== day) m.out = { day, value: 0 };
  if (m.out.value + value > cap) return `Your rank may take out ${cap} worth a day (${Math.max(0, cap - m.out.value)} left)`;
  m.out.value += value;
  return null;
}

export function treasury(game: Game, s: PlayerSession, amount: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g) return 'You belong to no guild';
  const p = s.profile!;
  const n = Math.trunc(Number(amount));
  if (!Number.isFinite(n) || n === 0) return 'Bad amount';
  if (!s.ship?.docked) return 'At a harbour office';
  if (n > 0) {
    if (p.gold < n) return 'Not that much silver aboard';
    p.gold -= n;
    g.treasury += n;
    log(game, g, `${s.name} deposits ${n}.`);
    return null;
  }
  const m = member(g, s.accountId)!;
  if (g.treasury < -n) return 'Not that much in the treasury';
  const e = withdrawOk(game, g, m, -n, TREASURY_CAP);
  if (e) return e;
  g.treasury += n;
  p.gold -= n;
  log(game, g, `${s.name} takes ${-n} from the treasury.`);
  return null;
}

export function setTax(game: Game, s: PlayerSession, pct: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g || member(g, s.accountId)?.rank !== 'admiral') return 'Only the admiral sets the tax';
  const t = Math.round(Number(pct));
  if (!(t >= 0 && t <= 15)) return 'The tax is 0–15%';
  g.tax = t;
  log(game, g, `The guild tax is now ${t}%.`);
  return null;
}

/** The guild's share of a member's sale (called by the market). Returns what was taken. */
export function taxSale(game: Game, s: PlayerSession, price: number): number {
  const g = game.guilds.of(game, s.accountId);
  if (!g || g.tax <= 0 || price <= 0) return 0;
  const cut = Math.floor((price * g.tax) / 100);
  if (cut <= 0) return 0;
  s.profile!.gold -= cut;
  g.treasury += cut;
  game.guilds.touch();
  return cut;
}

// ------------------------------------------------------------------------------------------ offices and stores

export function openOffice(game: Game, s: PlayerSession): string | null {
  const g = game.guilds.of(game, s.accountId);
  const port = s.ship?.docked;
  if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up open offices';
  if (!port) return 'In port';
  if (g.treasury < OFFICE_WEEK) return `A week's rent is ${OFFICE_WEEK} from the treasury`;
  g.treasury -= OFFICE_WEEK;
  g.offices[port] = Math.max(g.offices[port] ?? 0, game.wallNow()) + 7 * DAY;
  g.stores[port] ??= {};
  log(game, g, `${s.name} rents the office at ${game.portById(port)?.name ?? port} for a week.`);
  return null;
}

function office(game: Game, g: Guild, port: string | null): string | null {
  if (!port) return 'In port';
  if ((g.offices[port] ?? 0) < game.wallNow()) return 'The guild keeps no office here';
  return null;
}

export function storeMove(game: Game, s: PlayerSession, good: GoodId, qty: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g) return 'You belong to no guild';
  const ship = s.ship!;
  const port = ship.docked;
  const bad = office(game, g, port);
  if (bad) return bad;
  if (!GOODS[good] || !Number.isInteger(qty) || qty === 0 || Math.abs(qty) > 5000) return 'Bad order';
  const store = (g.stores[port!] ??= {});
  const m = member(g, s.accountId)!;
  if (qty > 0) {
    const n = Math.min(qty, Math.floor(ship.cargo[good] ?? 0));
    if (n <= 0) return 'You do not carry that';
    ship.cargo[good] = (ship.cargo[good] ?? 0) - n;
    if (!ship.cargo[good]) delete ship.cargo[good];
    store[good] = (store[good] ?? 0) + n;
    log(game, g, `${s.name} puts ${n} ${GOODS[good].name.toLowerCase()} in the ${game.portById(port!)?.name ?? port} store.`);
    // Contracts for this port and good pay per unit.
    let left = n;
    for (const c of g.contracts) {
      if (c.port !== port || c.good !== good || c.qty <= 0 || left <= 0) continue;
      const k = Math.min(left, c.qty, Math.floor(g.treasury / Math.max(1, c.reward)));
      if (k <= 0) continue;
      c.qty -= k;
      left -= k;
      g.treasury -= k * c.reward;
      s.profile!.gold += k * c.reward;
      game.sendTo(s, { t: 'toast', msg: `Guild contract: ${k * c.reward} silver for ${k} ${GOODS[good].name.toLowerCase()}.`, kind: 'gold' });
    }
    g.contracts = g.contracts.filter((c) => c.qty > 0);
    return null;
  }
  const n = Math.min(-qty, Math.floor(store[good] ?? 0));
  if (n <= 0) return 'None of that in the store';
  const st = ship.stats;
  const free = st.holdVolume - cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
  const fit = Math.min(n, Math.floor((free + 1e-6) / GOODS[good].volume));
  if (fit <= 0) return 'No room in the hold';
  const e = withdrawOk(game, g, m, fit * GOODS[good].basePrice, WITHDRAW_CAP);
  if (e) return e;
  store[good] = (store[good] ?? 0) - fit;
  if (!store[good]) delete store[good];
  ship.cargo[good] = (ship.cargo[good] ?? 0) + fit;
  log(game, g, `${s.name} takes ${fit} ${GOODS[good].name.toLowerCase()} from the ${game.portById(port!)?.name ?? port} store.`);
  return null;
}

export function postContract(game: Game, s: PlayerSession, good: GoodId, qty: number, reward: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  const port = s.ship?.docked ?? null;
  if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up post contracts';
  const bad = office(game, g, port);
  if (bad) return bad;
  if (!GOODS[good] || !(qty >= 1 && qty <= 10_000) || !(reward >= 1 && reward <= 10_000)) return 'Bad contract';
  if (g.contracts.length >= 20) return 'Twenty contracts at most';
  g.contracts.push({ id: g.nextId++, good, qty: Math.trunc(qty), port: port!, reward: Math.trunc(reward), by: s.name });
  log(game, g, `${s.name} posts a contract: ${qty} ${GOODS[good].name.toLowerCase()} to ${game.portById(port!)?.name}, ${reward} each.`);
  return null;
}

export function dropContract(game: Game, s: PlayerSession, id: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up';
  g.contracts = g.contracts.filter((c) => c.id !== id);
  game.guilds.touch();
  return null;
}

// ------------------------------------------------------------------------------------------ the fleet and the flagship

export function giveShip(game: Game, s: PlayerSession, berth: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  const p = s.profile!;
  if (!g || !rankAtLeast(member(g, s.accountId), 'captain')) return 'Captains and up give hulls to the guild';
  const b = p.berths[berth];
  if (!b || b.port !== s.ship?.docked) return 'No ship of yours berthed here';
  if (b.loadout.guild) return 'That hull already belongs to a guild';
  p.berths.splice(berth, 1);
  g.fleet.push({ id: g.nextId++, loadout: b.loadout, hull: b.hull, port: b.port, lentTo: null, deposit: 0, giver: s.name });
  log(game, g, `${s.name} gives the ${b.loadout.name} to the guild fleet.`);
  return null;
}

export function borrowShip(game: Game, s: PlayerSession, id: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  const p = s.profile!;
  if (!g || !rankAtLeast(member(g, s.accountId), 'captain')) return 'Captains and up borrow guild hulls';
  const f = g.fleet.find((x) => x.id === id);
  if (!f || f.lentTo !== null) return 'That hull is out';
  if (f.port !== s.ship?.docked) return `She lies at ${game.portById(f.port)?.name ?? f.port}`;
  if (p.berths.length >= 3) return 'Your berths are full';
  const deposit = Math.round(SHIP_CLASSES[f.loadout.classId].price * 0.2);
  if (p.gold < deposit) return `The deposit is ${deposit} silver`;
  p.gold -= deposit;
  f.lentTo = s.accountId;
  f.deposit = deposit;
  p.berths.push({ port: f.port, loadout: { ...f.loadout, guild: { g: g.id, id: f.id } }, hull: f.hull });
  log(game, g, `${s.name} takes out the ${f.loadout.name} (deposit ${deposit}).`);
  game.sendTo(s, { t: 'toast', msg: `The ${f.loadout.name} is berthed for you here; take her out at the yard.`, kind: 'good' });
  return null;
}

export function returnShip(game: Game, s: PlayerSession): string | null {
  const g = game.guilds.of(game, s.accountId);
  const p = s.profile!;
  if (!g) return 'You belong to no guild';
  const i = p.berths.findIndex((b) => b.loadout.guild?.g === g.id && b.port === s.ship?.docked);
  if (i < 0) return 'Berth the guild’s hull here first (swap her out at the yard)';
  const b = p.berths[i];
  const f = g.fleet.find((x) => x.id === b.loadout.guild!.id);
  p.berths.splice(i, 1);
  if (f) {
    const { guild: _g, ...loadout } = b.loadout;
    void _g;
    f.loadout = loadout;
    f.hull = b.hull;
    f.port = b.port;
    f.lentTo = null;
    p.gold += f.deposit;
    f.deposit = 0;
    log(game, g, `${s.name} returns the ${b.loadout.name}.`);
  }
  return null;
}

export function setFlagship(game: Game, s: PlayerSession, account: number | null): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g || member(g, s.accountId)?.rank !== 'admiral') return 'The admiral names the flagship';
  if (account === null) {
    g.flagship = null;
    game.guilds.touch();
    return null;
  }
  const m = member(g, account);
  const ship = game.sessionByAccount(account)?.ship;
  if (!m || !ship) return 'That captain must be at sea or in port with their ship';
  if (ship.cls.tier < 4) return 'The flagship must be a hull of tier IV or better';
  g.flagship = account;
  log(game, g, `The standard flies from the ${ship.name} (${m.name}).`);
  tell(game, g, `The guild standard flies from the ${ship.name}.`);
  return null;
}

/** The flagship is sunk: the guild sails worse for an hour; the victor keeps the torn standard. */
export function onShipSunk(game: Game, ship: ShipEntity, killer: ShipEntity | null): void {
  if (ship.accountId === null) return;
  const g = game.guilds.of(game, ship.accountId);
  if (!g || g.flagship !== ship.accountId) return;
  g.tornUntil = game.wallNow() + HOUR;
  log(game, g, `The flagship ${ship.name} is sunk: the standard is torn.`);
  tell(game, g, `The flagship ${ship.name} is lost — the guild's standard is torn for an hour.`);
  const vs = killer ? game.sessionOf(killer) : null;
  if (vs) deliver(game, vs.accountId, { from: 'The Harbour Master', subject: `The Torn Standard of ${g.name}`, body: `A strip of ${g.name}'s standard, cut from the flagship ${ship.name} as she went down. A keepsake of a famous fight.`, gold: 0, goods: null });
  const wars = game.guilds.store(game).wars;
  const vg = vs ? game.guilds.of(game, vs.accountId) : null;
  if (vg) for (const w of wars) if ((w.a === vg.id && w.b === g.id) || (w.b === vg.id && w.a === g.id)) w.score[vg.id] = (w.score[vg.id] ?? 0) + 30;
}

/** War score for sinking or taking a member of a guild at war with yours. */
export function onWarKill(game: Game, killer: ShipEntity, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  const gk = guildOfShip(game, killer), gv = guildOfShip(game, victim);
  if (!gk || !gv) return;
  const w = activeWar(game, gk.id, gv.id);
  if (!w) return;
  w.score[gk.id] = (w.score[gk.id] ?? 0) + (how === 'boarded' ? 15 : 10);
  game.guilds.touch();
}

// ------------------------------------------------------------------------------------------ diplomacy

export function declareWar(game: Game, s: PlayerSession, targetTag: string): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g || member(g, s.accountId)?.rank !== 'admiral') return 'Only the admiral declares war';
  const st = game.guilds.store(game);
  const t = Object.values(st.guilds).find((x) => x.tag === String(targetTag ?? '').toUpperCase());
  if (!t || t.id === g.id) return 'No such guild';
  if (g.alliance.includes(t.id)) return 'Not on an ally — leave the alliance first';
  if (g.pacts.includes(t.id)) return 'You have a pact with them';
  if (st.wars.some((w) => (w.a === g.id && w.b === t.id) || (w.a === t.id && w.b === g.id))) return 'You are already at war';
  const now = game.wallNow();
  if ((g.bans[t.id] ?? 0) > now) return 'The peace forbids a new war yet';
  if (g.treasury < WAR_COST) return `Declaring war costs ${WAR_COST} from the treasury`;
  g.treasury -= WAR_COST;
  st.wars.push({ a: g.id, b: t.id, declared: now, prepUntil: now + DAY, minEnd: now + 8 * DAY, score: { [g.id]: 0, [t.id]: 0 }, terms: null });
  guildNotify(game, g.id, `War declared on ${t.name} [${t.tag}]`, 'Hostilities open in 24 hours and last at least seven days.');
  guildNotify(game, t.id, `${g.name} [${g.tag}] declares war on you`, 'Hostilities open in 24 hours. Mercenaries can be hired at Tidewrack.');
  tell(game, t, `${g.name} [${g.tag}] declares war! Hostilities open in 24 hours.`);
  return null;
}

export function proposePeace(game: Game, s: PlayerSession, targetTag: string, tribute: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g || member(g, s.accountId)?.rank !== 'admiral') return 'Only the admiral makes peace';
  const st = game.guilds.store(game);
  const t = Object.values(st.guilds).find((x) => x.tag === String(targetTag ?? '').toUpperCase());
  const w = t && st.wars.find((x) => (x.a === g.id && x.b === t.id) || (x.a === t.id && x.b === g.id));
  if (!t || !w) return 'You are not at war with them';
  if (game.wallNow() < w.minEnd) return 'A war runs at least seven days';
  const pay = Math.max(0, Math.trunc(Number(tribute) || 0));
  if (pay > g.treasury) return 'The treasury cannot pay that tribute';
  // If they already offered peace, this settles it.
  if (w.terms && w.terms.from === t.id) return settlePeace(game, w, t, g);
  w.terms = { from: g.id, tribute: pay };
  game.guilds.touch();
  guildNotify(game, t.id, `${g.name} [${g.tag}] offers peace`, pay ? `They offer a tribute of ${pay}. Offer peace back to accept.` : 'Offer peace back to accept.');
  return null;
}

function settlePeace(game: Game, w: War, proposer: Guild, accepter: Guild): string | null {
  const st = game.guilds.store(game);
  const tribute = Math.min(proposer.treasury, w.terms?.tribute ?? 0);
  proposer.treasury -= tribute;
  accepter.treasury += tribute;
  st.wars = st.wars.filter((x) => x !== w);
  const ban = game.wallNow() + 14 * DAY;
  proposer.bans[accepter.id] = ban;
  accepter.bans[proposer.id] = ban;
  const score = `${proposer.tag} ${w.score[proposer.id] ?? 0} — ${accepter.tag} ${w.score[accepter.id] ?? 0}`;
  guildNotify(game, proposer.id, `Peace with ${accepter.name}`, `Score ${score}. Tribute paid: ${tribute}. No new war for fourteen days.`);
  guildNotify(game, accepter.id, `Peace with ${proposer.name}`, `Score ${score}. Tribute received: ${tribute}. No new war for fourteen days.`);
  return null;
}

export function offerTreaty(game: Game, s: PlayerSession, kind: 'alliance' | 'pact', targetTag: string): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up make treaties';
  const st = game.guilds.store(game);
  const t = Object.values(st.guilds).find((x) => x.tag === String(targetTag ?? '').toUpperCase());
  if (!t || t.id === g.id) return 'No such guild';
  if (st.wars.some((w) => (w.a === g.id && w.b === t.id) || (w.a === t.id && w.b === g.id))) return 'Not while at war';
  if (kind === 'alliance' && (g.alliance.length >= 2 || t.alliance.length >= 2)) return 'An alliance is at most three guilds';
  if ((kind === 'alliance' ? g.alliance : g.pacts).includes(t.id)) return 'Already agreed';
  const now = game.wallNow();
  // They offered the same: agreed.
  const theirs = g.offers.find((o) => o.from === t.id && o.kind === kind && o.until > now);
  if (theirs) {
    g.offers = g.offers.filter((o) => o !== theirs);
    if (kind === 'alliance') {
      // Everyone in either alliance is allied with everyone.
      const all = [...new Set([g.id, t.id, ...g.alliance, ...t.alliance])];
      if (all.length > 3) return 'An alliance is at most three guilds';
      for (const id of all) {
        const x = st.guilds[id];
        if (x) x.alliance = all.filter((y) => y !== id);
      }
    } else {
      g.pacts.push(t.id);
      t.pacts.push(g.id);
    }
    guildNotify(game, g.id, `${kind === 'alliance' ? 'Alliance' : 'Non-aggression pact'} with ${t.name}`, 'Agreed.');
    guildNotify(game, t.id, `${kind === 'alliance' ? 'Alliance' : 'Non-aggression pact'} with ${g.name}`, 'Agreed.');
    return null;
  }
  t.offers = t.offers.filter((o) => o.until > now && !(o.from === g.id && o.kind === kind));
  t.offers.push({ kind, from: g.id, until: now + 3 * DAY });
  game.guilds.touch();
  guildNotify(game, t.id, `${g.name} [${g.tag}] offers ${kind === 'alliance' ? 'an alliance' : 'a non-aggression pact'}`, 'Offer the same back to agree.');
  return null;
}

export function breakTreaty(game: Game, s: PlayerSession, kind: 'alliance' | 'pact', targetTag: string): string | null {
  const g = game.guilds.of(game, s.accountId);
  if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up';
  const st = game.guilds.store(game);
  const t = Object.values(st.guilds).find((x) => x.tag === String(targetTag ?? '').toUpperCase());
  if (!t) return 'No such guild';
  if (kind === 'alliance') {
    // Leaving the alliance: we part from all of them.
    for (const id of g.alliance) {
      const x = st.guilds[id];
      if (x) x.alliance = x.alliance.filter((y) => y !== g.id);
    }
    g.alliance = [];
  } else {
    g.pacts = g.pacts.filter((x) => x !== t.id);
    t.pacts = t.pacts.filter((x) => x !== g.id);
  }
  guildNotify(game, t.id, `${g.name} ends the ${kind}`, '');
  return null;
}

// ------------------------------------------------------------------------------------------ islands and bases

/** Guild islands: a vice-admiral leases from the treasury (up to six). Called by holdings. */
export function guildCanLease(game: Game, s: PlayerSession): { gid: number; name: string } | string {
  const g = game.guilds.of(game, s.accountId);
  if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up lease islands for the guild';
  const held = Object.values(game.holdings.map(game)).filter((h) => h.owner.kind === 'guild' && h.owner.id === g.id).length;
  if (held >= 6) return 'A guild holds six islands at most';
  return { gid: g.id, name: `${g.name} [${g.tag}]` };
}

export function guildPay(game: Game, gid: number, amount: number): boolean {
  const g = game.guilds.get(game, gid);
  if (!g || g.treasury < amount) return false;
  g.treasury -= amount;
  game.guilds.touch();
  return true;
}

export function raiseBase(game: Game, s: PlayerSession, islandId: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  const h = game.holdings.get(game, islandId);
  if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up build bases';
  if (!h || h.owner.kind !== 'guild' || h.owner.id !== g.id) return 'Not a guild island';
  const isl = game.world.islands[islandId];
  if (REGIONS[isl.region].safety === 'safe') return 'No bases on the Crown’s coast';
  const lvl = (h.base ?? 0) + 1;
  if (lvl > 5) return 'The base is a Stronghold already';
  // Each further base costs half again to keep.
  const cost = BASE_COST[lvl];
  if (g.treasury < cost) return `A ${BASE_NAMES[lvl]} costs ${cost} from the guild treasury`;
  g.treasury -= cost;
  h.base = lvl;
  game.holdings.touch();
  log(game, g, `${isl.name} is raised to a ${BASE_NAMES[lvl]} (${s.name}).`);
  return null;
}

/** Weekly base upkeep (as a daily share), with each further base a half again dearer. */
export function baseUpkeepPerDay(game: Game, gid: number, level: number, islandId: number): number {
  const bases = Object.values(game.holdings.map(game)).filter((h) => h.owner.kind === 'guild' && h.owner.id === gid && (h.base ?? 0) > 0).sort((a, b) => a.since - b.since);
  const order = Math.max(0, bases.findIndex((h) => h.island === islandId));
  return Math.round((BASE_WEEK[level] / 7) * 1.5 ** order);
}

// ------------------------------------------------------------------------------------------ routes

export function setToll(game: Game, s: PlayerSession, islandId: number, pct: number): string | null {
  const g = game.guilds.of(game, s.accountId);
  const n = game.guilds.store(game).nodes[islandId];
  if (!g || !rankAtLeast(member(g, s.accountId), 'vice')) return 'Vice-admirals and up set tolls';
  if (!n || n.holder !== g.id) return 'Your guild does not hold that node';
  const t = Math.round(Number(pct));
  if (!(t >= 1 && t <= 5)) return 'A toll is 1–5%';
  n.toll = t;
  game.guilds.touch();
  return null;
}

/** Every second: route nodes (presence, capture, tolls, intel), the standard's aura. */
export function stepGuilds(game: Game): void {
  const hub = game.guilds;
  const st = hub.store(game);
  const wall = game.wallNow();
  const now = game.now;
  // Nodes.
  for (const n of Object.values(st.nodes)) {
    const isl = game.world.islands[n.island];
    const present = new Set<number>();
    game.forShipsNear(isl.x, isl.y, isl.radius + 1500, (o) => {
      if (!o.alive || o.docked || !o.isPlayer) return;
      if (dist(o.state.x, o.state.y, isl.x, isl.y) - isl.radius > 1500) return;
      const g = guildOfShip(game, o);
      if (g) present.add(g.id);
      // The holder hears who sails by (once an hour per captain).
      if (n.holder !== null && (!g || g.id !== n.holder) && o.accountId !== null && wall - (n.seen[o.accountId] ?? 0) > HOUR) {
        n.seen[o.accountId] = wall;
        const holder = st.guilds[n.holder];
        if (holder) log(game, holder, `Lookouts at ${isl.name}: ${o.captainName}'s ${o.name}${g ? ` [${g.tag}]` : ''} passed.`);
      }
    });
    // Allies count as one side.
    const sides = new Set([...present].map((id) => Math.min(id, ...(st.guilds[id]?.alliance ?? []))));
    if (sides.size === 1) {
      const gid = [...present][0];
      const side = [...sides][0];
      const holderSide = n.holder === null ? null : Math.min(n.holder, ...(st.guilds[n.holder]?.alliance ?? []));
      if (holderSide !== side) {
        n.progress[gid] = (n.progress[gid] ?? 0) + 1;
        if (n.progress[gid] >= NODE_HOLD_SEC) {
          const prev = n.holder;
          n.holder = gid;
          n.progress = {};
          const g = st.guilds[gid];
          if (g) {
            log(game, g, `${isl.name} is taken: the route is ours.`);
            tell(game, g, `${g.name} takes the route node at ${isl.name}.`);
            if (prev !== null) {
              const w = activeWar(game, gid, prev);
              if (w) w.score[gid] = (w.score[gid] ?? 0) + 20;
              guildNotify(game, prev, `${isl.name} is lost`, `${g.name} [${g.tag}] holds the route now.`);
            }
          }
          hub.touch();
        }
      }
    } else if (sides.size === 0) {
      for (const k of Object.keys(n.progress)) n.progress[k] = Math.max(0, n.progress[k] - 2); // the claim fades when nobody keeps it
    }
    // Tolls from passing merchants, once a minute.
    if (n.holder !== null && Math.floor(now) % 60 === 0) {
      const day = Math.floor(wall / DAY);
      if (n.tollToday.day !== day) n.tollToday = { day, paid: 0 };
      const g = st.guilds[n.holder];
      if (g) {
        game.forShipsNear(isl.x, isl.y, isl.radius + 3000, (o) => {
          if (o.npcRole !== 'merchant' || !o.alive || n.tollToday.paid >= 5000) return;
          const brain = game.npcs.get(o.id);
          if (!brain || brain.tolledNode === n.island) return;
          brain.tolledNode = n.island;
          const fee = Math.min(5000 - n.tollToday.paid, Math.round((cargoValue(o.cargo) * n.toll) / 100));
          if (fee <= 0) return;
          n.tollToday.paid += fee;
          g.treasury += fee;
          hub.touch();
        });
      }
    }
  }
  // The standard.
  for (const g of Object.values(st.guilds)) {
    const flag = g.flagship !== null ? game.sessionByAccount(g.flagship)?.ship : null;
    const torn = g.tornUntil > wall;
    for (const m of g.members) {
      const ship = game.sessionByAccount(m.account)?.ship;
      if (!ship || !ship.alive || ship.docked) continue;
      if (torn) ship.addEffect({ id: 'standard_torn', until: now + 1.6, mods: { reloadMul: 0.05, gunDamageMul: -0.05 } }, now);
      else if (flag && flag.alive && !flag.docked && flag.cls.tier >= 4 && dist(flag.state.x, flag.state.y, ship.state.x, ship.state.y) <= 800) {
        ship.addEffect({ id: 'guild_standard', until: now + 1.6, mods: { reloadMul: -0.05 } }, now);
        ship.morale = Math.max(ship.morale, 20);
      }
    }
  }
  // The calendar: probation ends, offices lapse, stale offers go.
  if (Math.floor(now) % 30 === 0) {
    for (const g of Object.values(st.guilds)) {
      for (const m of g.members) if (m.rank === 'cabin_boy' && wall - m.joined > 7 * DAY) {
        m.rank = 'sailor';
        log(game, g, `${m.name}'s probation ends.`);
      }
      for (const [port, until] of Object.entries(g.offices)) if (until < wall - 30 * DAY) delete g.offices[port]; // a lapsed office keeps its store a month
      g.offers = g.offers.filter((o) => o.until > wall);
      g.invites = g.invites.filter((i) => i.until > wall);
    }
    hub.save(game);
  }
}

// ------------------------------------------------------------------------------------------ views

export function guildView(game: Game, s: PlayerSession): { guild: GuildView | null; invites: { id: number; name: string; tag: string; by: string }[] } {
  const st = game.guilds.store(game);
  const wall = game.wallNow();
  const invites = Object.values(st.guilds).flatMap((g) => g.invites.filter((i) => i.account === s.accountId && i.until > wall).map((i) => ({ id: g.id, name: g.name, tag: g.tag, by: i.by })));
  const g = game.guilds.of(game, s.accountId);
  if (!g) return { guild: null, invites };
  const me = member(g, s.accountId)!;
  const port = s.ship?.docked ?? null;
  const name = (id: number) => st.guilds[id] ? `${st.guilds[id].name} [${st.guilds[id].tag}]` : '?';
  const nodes: RouteNodeView[] = Object.values(st.nodes).map((n) => {
    const isl = game.world.islands[n.island];
    return { island: n.island, name: isl.name, region: isl.region, x: Math.round(isl.x), y: Math.round(isl.y), holder: n.holder !== null ? name(n.holder) : null, ours: n.holder === g.id, toll: n.toll, progress: Math.round(((n.progress[g.id] ?? 0) / NODE_HOLD_SEC) * 100) };
  });
  return {
    invites,
    guild: {
      id: g.id, name: g.name, tag: g.tag, rank: me.rank, treasury: g.treasury, tax: g.tax,
      members: g.members.map((m) => ({ account: m.account, name: m.name, rank: m.rank, online: !!game.sessionByAccount(m.account) && game.sessionByAccount(m.account)!.disconnectedAt === null })),
      offices: Object.entries(g.offices).map(([p, until]) => ({ port: p, until, store: g.stores[p] ?? {} })),
      here: port && (g.offices[port] ?? 0) >= wall ? port : null,
      contracts: g.contracts,
      fleet: g.fleet.map((f) => ({ id: f.id, name: f.loadout.name, classId: f.loadout.classId, hull: Math.round(f.hull * 100), port: f.port, lentTo: f.lentTo !== null ? g.members.find((m) => m.account === f.lentTo)?.name ?? '?' : null, giver: f.giver })),
      flagship: g.flagship !== null ? g.members.find((m) => m.account === g.flagship)?.name ?? null : null,
      torn: g.tornUntil > wall,
      alliance: g.alliance.map(name),
      pacts: g.pacts.map(name),
      offers: g.offers.filter((o) => o.until > wall).map((o) => ({ kind: o.kind, from: name(o.from) })),
      wars: st.wars.filter((w) => w.a === g.id || w.b === g.id).map((w) => {
        const other = w.a === g.id ? w.b : w.a;
        return { with: name(other), tag: st.guilds[other]?.tag ?? '', active: wall >= w.prepUntil, opensAt: w.prepUntil, minEnd: w.minEnd, ours: w.score[g.id] ?? 0, theirs: w.score[other] ?? 0, terms: w.terms ? { fromUs: w.terms.from === g.id, tribute: w.terms.tribute } : null };
      }),
      nodes,
      islands: Object.values(game.holdings.map(game)).filter((h) => h.owner.kind === 'guild' && h.owner.id === g.id).map((h) => ({ island: h.island, name: game.world.islands[h.island].name, base: h.base ?? 0 })),
      log: g.log.slice(-40).reverse(),
    },
  };
}

export function pushGuild(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'guild', ...guildView(game, s) });
}
