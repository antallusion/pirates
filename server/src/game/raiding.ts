// The raider's trade (docs/12 P6): the glass that weighs a merchant's hold; the tavern's tips (a real merchant on a
// real route, sailing at the hour given) and the clerk's manifest; the League's convoys on the lanes of the
// contested seas, with their escorts and their rockets; tribute from a merchant who has struck, and the Code for
// one let go; the heat of a sea's lanes — escorts, League cutters and dearer goods where the raids are; the
// Brethren's fame and ranks; and the mark of a merchant under a friend's guns.

import { targetXp } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import { questEvent } from './quests.ts';
import { BRETHREN_RANKS, CODE_RANK, CONVOY_EVERY, CONVOY_INFAMY, CONVOY_MAX, CONVOY_SPOT_R, DEED_CONVOYS, ESCORT_KEEP_R, ESCORT_SIGN_R, convoyStrongbox, escortPay, FAME, HEAT, MORALE_RANK, TERROR_TITLE, TIP_WINDOW, TITLE_RANK, TRIBUTE, brethrenRank, clerkCost, heatPrices, tipCost } from '../../../shared/src/data/raiding.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { dist, headingOf } from '../../../shared/src/math.ts';
import type { AppraisalView, ConvoyView, RaidView, TipView } from '../../../shared/src/protocol.ts';
import { Rng, hashString } from '../../../shared/src/rng.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { applyDamage } from './combat.ts';
import type { Game } from './Game.ts';
import { planWander, setPath } from './npc.ts';
import { groupOfAccount } from './party.ts';
import type { PlayerSession, Profile } from './player.ts';
import { changeRep } from './player.ts';
import { grantDeed } from './progression.ts';
import type { ShipEntity } from './ship.ts';

interface Convoy {
  id: number;
  region: RegionId;
  from: string;
  to: string;
  members: number[];
  escorts: number[];
  size: number;
  broken: boolean;
  until: number;
  raiders: Set<number>;
  /** Its level ⚓ (of the square it sails from) and its route, a few points, for the chart (docs/16 #6). */
  level: number;
  route: [number, number][];
  /** Captains who know of it: heard of it as it sailed, or saw it. */
  known: Set<number>;
  /** Captains signed on as its escort → the pay promised on arrival; when the first signed on. */
  hired: Map<number, number>;
  hiredAt: number;
  /** The sea has sent raiders at it once while it had an escort of captains. */
  stirred: boolean;
  delivered: boolean;
  /** Game time a raider last fired on it. */
  raidedAt: number;
}

interface Tip {
  id: string;
  port: string;
  to: string;
  good: GoodId;
  qty: number;
  cls: ShipClassId;
  level: number;
  departAt: number;
  ship: number | null;
  buyers: Set<number>;
}

interface RaidState {
  convoys: Map<number, Convoy>;
  heat: Partial<Record<RegionId, number>>;
  tips: Map<string, Tip>;
  manifests: Map<number, { port: string; until: number }>;
  rocketed: Set<number>;
  responders: { at: number; account: number; x: number; y: number }[];
  swivelAt: Map<number, number>;
  tributes: Map<number, Map<number, number>>;
  nextConvoy: number;
  seq: number;
  rng: Rng;
  sent: Map<number, string>;
}

const states = new WeakMap<Game, RaidState>();

function rs(game: Game): RaidState {
  let s = states.get(game);
  if (!s) {
    s = { convoys: new Map(), heat: game.db.getKv<Partial<Record<RegionId, number>>>('lane_heat') ?? {}, tips: new Map(), manifests: new Map(), rocketed: new Set(), responders: [], swivelAt: new Map(), tributes: new Map(), nextConvoy: game.now + 300, seq: 1, rng: new Rng(game.world.seed ^ 0x7a1d), sent: new Map() };
    states.set(game, s);
  }
  return s;
}

// ------------------------------------------------------------------------------------------------ the Brethren

export interface PiracyProfile {
  fame: number;
  honour: number;
  tributes: number;
  convoys: number;
}

export function sanitizePiracy(p: Profile): PiracyProfile {
  return (p.piracy ??= { fame: 0, honour: 0, tributes: 0, convoys: 0 });
}

export function addFame(game: Game, s: PlayerSession, n: number): void {
  const p = s.profile!;
  const pr = sanitizePiracy(p);
  const before = brethrenRank(pr.fame);
  pr.fame += n;
  const after = brethrenRank(pr.fame);
  if (after > before) {
    game.sendTo(s, { t: 'toast', msg: `The Brethren of the Coast: ${['Landlubber', 'Cutthroat', 'Boarder', 'Captain of the Brethren', 'Scourge of the Lanes', 'Terror of the Merchants'][after]}.`, kind: 'gold' });
    if (after >= TITLE_RANK && !p.titles.includes(TERROR_TITLE)) {
      p.titles.push(TERROR_TITLE);
      game.sendTo(s, { t: 'toast', msg: 'The Brethren name you Terror of the Merchants!', kind: 'gold' });
    }
  }
}

/** The Code may be sworn at any haven of the Brethren by one of their captains. */
export function codeAnywhere(p: Profile): boolean {
  return brethrenRank(p.piracy?.fame ?? 0) >= CODE_RANK;
}

function cheer(s: PlayerSession): void {
  const ship = s.ship;
  if (!ship) return;
  const r = brethrenRank(s.profile?.piracy?.fame ?? 0);
  ship.morale = Math.min(100, ship.morale + (r >= MORALE_RANK ? 10 : 5));
}

// ------------------------------------------------------------------------------------------------ the heat of the lanes

export function heatOf(game: Game, region: RegionId): number {
  return rs(game).heat[region] ?? 0;
}

function heatUp(game: Game, region: RegionId, n: number): void {
  const S = rs(game);
  const before = S.heat[region] ?? 0;
  S.heat[region] = Math.min(100, before + n);
  if (before < HEAT.escort && S.heat[region]! >= HEAT.escort) {
    for (const s of game.sessions) if (s.ship?.region === region) game.sendTo(s, { t: 'toast', msg: `The lanes of ${REGIONS[region].name} run hot: the League sends escorts.`, kind: 'info' });
  }
}

/** A port's prices in a hot sea (docs/12 P6): dearer to buy; a runner who gets through sells high. */
export function heatPriceMul(game: Game, region: RegionId): { buy: number; sell: number } {
  return heatPrices(heatOf(game, region));
}

/** A merchant putting out into hot lanes takes a League escort (from spawnMerchant). */
export function raidEscort(game: Game, merchant: ShipEntity, region: RegionId): void {
  if (heatOf(game, region) < HEAT.escort || REGIONS[region].safety === 'safe') return;
  const S = rs(game);
  if (!S.rng.chance(Math.min(0.9, heatOf(game, region) / 100 + 0.2))) return;
  const lv = Math.min(10, merchant.shipLevel + 1);
  const e = game.spawnNpcShip('patrol', S.rng.pick(hullsFor('patrol', lv)), 'league', merchant.state.x - 120, merchant.state.y + 80, merchant.state.heading, { ship: `League Escort ${S.rng.pick(['Surety', 'Ledger', 'Tally', 'Warrant', 'Dividend'])}`, captain: 'Escort Master' });
  game.setNpcLevel(e, lv);
  const b = game.npcs.get(e.id)!;
  b.leader = merchant.id;
  b.slot = 1;
  e.escortOf = merchant.id;
}

// ------------------------------------------------------------------------------------------------ appraising a hold

export function cargoValue(ship: ShipEntity): number {
  let v = 0;
  for (const [g, n] of Object.entries(ship.cargo)) v += (GOODS[g as GoodId]?.basePrice ?? 0) * (n ?? 0);
  return Math.round(v + (ship.purse ?? 0));
}

/** The glass on a ship (docs/12 P6): her hold's worth (roughly, unless the clerk's manifest names her port), how
 *  full it is, her escort and her hands. */
export function appraise(game: Game, s: PlayerSession, id: number): AppraisalView | string {
  const S = rs(game);
  const ship = s.ship;
  const t = game.ships.get(id);
  if (!ship || !t || !t.alive || t.cls.monster) return 'Nothing to appraise there.';
  const d = dist(ship.state.x, ship.state.y, t.state.x, t.state.y);
  if (d > ship.stats.detection * 0.85) return 'Too far for the glass.';
  const man = S.manifests.get(s.accountId);
  const exact = !!man && man.until > game.now && t.originPort === man.port;
  const glass = s.profile?.captainGear.spyglass ? 0.05 : 0.15;
  const fuzz = exact ? 1 : 1 + (new Rng((hashString(`${id}:${s.accountId}`) ^ Math.floor(game.now / 30)) >>> 0).float() * 2 - 1) * glass;
  const used = Object.entries(t.cargo).reduce((a, [g, n]) => a + (GOODS[g as GoodId]?.volume ?? 1) * (n ?? 0), 0);
  let escorts = 0;
  for (const o of game.ships.values()) if (o.alive && (o.escortOf === t.id || (t.convoyId && o.convoyId === t.convoyId && o.npcRole === 'patrol'))) escorts++;
  const dest = exact && t.npcRole ? game.npcs.get(t.id)?.destPort ?? null : null;
  return {
    id, value: Math.round((cargoValue(t) * fuzz) / 100) * 100, fill: Math.round(Math.min(1, used / Math.max(1, t.stats.holdVolume)) * 100) / 100,
    escorts, crew: t.crew, exact, dest: dest ? game.portById(dest)?.name ?? null : null,
  };
}

// ------------------------------------------------------------------------------------------------ the tavern

function tipsFor(game: Game, port: Port): Tip[] {
  const S = rs(game);
  const window = Math.floor(game.now / TIP_WINDOW);
  const out: Tip[] = [];
  for (let i = 0; i < 2; i++) {
    const id = `${port.id}:${window}:${i}`;
    let t = S.tips.get(id);
    if (!t) {
      const rng = new Rng(hashString(id) >>> 0);
      const to = game.world.ports.filter((p) => p.id !== port.id && Math.hypot(p.x - port.x, p.y - port.y) > 8000 && Math.hypot(p.x - port.x, p.y - port.y) < 40000 && game.inZone(p.x, p.y));
      if (!to.length) continue;
      const dest = rng.pick(to);
      const goods = (['spices', 'sugar', 'tobacco', 'cloth', 'pearls', 'medicine', 'weapons', 'rum', 'whale_oil'] as GoodId[]);
      const good = rng.pick(goods);
      const band = sectorAt(game.world, port.x, port.y).band; // her port's square of the sea (docs/16 P2)
      const level = rng.int(band[0], band[1]);
      const hulls = hullsFor('merchant', level);
      const cls = hulls.includes('fluyt') ? 'fluyt' : rng.pick(hulls);
      t = { id, port: port.id, to: dest.id, good, qty: rng.int(20, 60), cls, level, departAt: (window + 1) * TIP_WINDOW - rng.int(120, 480), ship: null, buyers: new Set() };
      S.tips.set(id, t);
    }
    out.push(t);
  }
  return out;
}

function tipValue(t: Tip): number {
  return GOODS[t.good].basePrice * t.qty;
}

export function tipViews(game: Game, s: PlayerSession, port: Port): { tips: TipView[]; clerk: { cost: number; until: number } } {
  const S = rs(game);
  const man = S.manifests.get(s.accountId);
  return {
    tips: tipsFor(game, port).filter((t) => t.departAt > game.now || t.buyers.has(s.accountId)).map((t) => ({
      id: t.id, good: t.good, cls: t.cls, level: t.level, to: game.portById(t.to)?.name ?? t.to, departIn: Math.max(0, Math.round(t.departAt - game.now)),
      value: Math.round(tipValue(t) / 100) * 100, cost: tipCost(tipValue(t)), bought: t.buyers.has(s.accountId), from: game.portById(t.port)?.name ?? t.port,
    })),
    clerk: { cost: clerkCost(port.size), until: man && man.port === port.id && man.until > game.now ? Math.round(man.until - game.now) : 0 },
  };
}

export function buyTip(game: Game, s: PlayerSession, port: Port, id: string): string | null {
  const t = tipsFor(game, port).find((x) => x.id === id);
  if (!t || t.departAt <= game.now) return 'That tip has gone cold.';
  if (t.buyers.has(s.accountId)) return 'The tip is yours already.';
  const cost = tipCost(tipValue(t));
  const p = s.profile!;
  if (p.gold < cost) return `Needs ${cost} silver`;
  p.gold -= cost;
  game.db.ledger(s.accountId, 'tip', -cost, id);
  t.buyers.add(s.accountId);
  const dest = game.portById(t.to);
  game.sendTo(s, { t: 'toast', msg: `The tip: ${t.cls === 'fluyt' ? 'a fluyt' : 'a merchantman'} leaves ${port.name} for ${dest?.name ?? t.to} in ${Math.max(1, Math.round((t.departAt - game.now) / 60))} min.`, kind: 'info' });
  return null;
}

export function bribeClerk(game: Game, s: PlayerSession, port: Port): string | null {
  const S = rs(game);
  const cost = clerkCost(port.size);
  const p = s.profile!;
  if (p.gold < cost) return `Needs ${cost} silver`;
  p.gold -= cost;
  game.db.ledger(s.accountId, 'clerk', -cost, port.id);
  S.manifests.set(s.accountId, { port: port.id, until: game.now + 3600 });
  game.sendTo(s, { t: 'toast', msg: `The clerk slips you the manifest: every merchant out of ${port.name} this hour is an open book.`, kind: 'info' });
  return null;
}

/** A tip's merchant puts out at her hour, for whoever bought it. */
function sailTips(game: Game): void {
  const S = rs(game);
  for (const t of S.tips.values()) {
    if (t.ship !== null || !t.buyers.size || game.now < t.departAt) continue;
    const from = game.portById(t.port), to = game.portById(t.to);
    if (!from || !to) {
      t.ship = -1;
      continue;
    }
    const m = game.spawnNpcShip('merchant', t.cls, from.faction === 'crown' ? 'league' : from.faction === 'confederacy' || from.faction === 'choir' ? 'free' : from.faction, from.x, from.y, headingOf(to.x - from.x, to.y - from.y));
    game.setNpcLevel(m, t.level);
    m.cargo = { [t.good]: t.qty };
    m.purse = 200 + 60 * t.level;
    m.originPort = from.id;
    const b = game.npcs.get(m.id)!;
    const path = game.routes.between(from, to);
    if (!path) {
      game.removeShip(m.id);
      t.ship = -1;
      continue;
    }
    setPath(b, path);
    b.destPort = to.id;
    t.ship = m.id;
    for (const acc of t.buyers) {
      const s = game.sessionByAccount(acc);
      if (s) game.sendTo(s, { t: 'toast', msg: `The tipped merchant puts to sea: ${m.name}.`, kind: 'gold' });
    }
  }
  // Old tips go.
  for (const [id, t] of S.tips) if (game.now - t.departAt > 3600) S.tips.delete(id);
}

// ------------------------------------------------------------------------------------------------ convoys

function lawfulPorts(game: Game, region: RegionId): Port[] {
  return game.world.ports.filter((p) => p.region === region && (p.faction === 'crown' || p.faction === 'league') && game.inZone(p.x, p.y));
}

/** A route of many nodes cut to a few points for the chart. */
function thinRoute(path: [number, number][], most = 20): [number, number][] {
  if (path.length <= most) return path.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const out: [number, number][] = [];
  for (let i = 0; i < most - 1; i++) {
    const [x, y] = path[Math.floor((i * (path.length - 1)) / (most - 1))];
    out.push([Math.round(x), Math.round(y)]);
  }
  const [lx, ly] = path[path.length - 1];
  out.push([Math.round(lx), Math.round(ly)]);
  return out;
}

/** A League convoy on the lanes of the contested and lawless seas (docs/12 P6, docs/16 #6): three to five
 *  merchantmen of one hull, one or two escorts, at the level of the square it sails from. */
export function sailConvoy(game: Game, region: RegionId): Convoy | null {
  const S = rs(game);
  const froms = lawfulPorts(game, region).concat(game.world.ports.filter((p) => p.region === region && p.faction === 'free' && !p.raft && game.inZone(p.x, p.y)));
  if (!froms.length) return null;
  const from = S.rng.pick(froms);
  const tos = game.world.ports.filter((p) => p.id !== from.id && !p.raft && (p.faction === 'crown' || p.faction === 'league' || p.faction === 'free') && Math.hypot(p.x - from.x, p.y - from.y) > 12000 && Math.hypot(p.x - from.x, p.y - from.y) < 50000 && game.inZone(p.x, p.y));
  if (!tos.length) return null;
  const to = S.rng.pick(tos);
  const path = game.routes.between(from, to);
  if (!path) return null;
  const band = sectorAt(game.world, from.x, from.y).band; // her port's square of the sea (docs/16 P2)
  const level = S.rng.int(band[0], band[1]);
  const cls: ShipClassId = level >= 7 ? 'galleon' : 'fluyt';
  const n = S.rng.int(3, 5);
  const id = S.seq++;
  const c: Convoy = {
    id, region, from: from.id, to: to.id, members: [], escorts: [], size: n, broken: false, until: game.now + 5400, raiders: new Set(),
    level, route: thinRoute(path), known: new Set(), hired: new Map(), hiredAt: 0, stirred: false, delivered: false, raidedAt: -1e9,
  };
  const h = headingOf(to.x - from.x, to.y - from.y);
  for (let i = 0; i < n; i++) {
    const m = game.spawnNpcShip('merchant', cls, 'league', from.x, from.y, h);
    game.setNpcLevel(m, level);
    m.convoyId = id;
    m.originPort = from.id;
    // A convoy carries the League's silver as well as its goods: a richer prize than a lone merchantman.
    m.purse = 500 + 120 * level;
    const good = S.rng.pick(['spices', 'sugar', 'cloth', 'tobacco', 'medicine', 'rum'] as GoodId[]);
    m.cargo = { [good]: Math.floor(m.stats.holdVolume * 0.9 / GOODS[good].volume) };
    const b = game.npcs.get(m.id)!;
    setPath(b, path);
    b.destPort = to.id;
    // They sail in a column, a cable apart.
    b.traveled = Math.max(0, (n - i) * 180);
    c.members.push(m.id);
  }
  const escorts = S.rng.int(1, 2);
  for (let i = 0; i < escorts; i++) {
    const lv = Math.min(10, level + 1);
    const e = game.spawnNpcShip('patrol', S.rng.pick(hullsFor('patrol', lv)), 'league', from.x, from.y, h, { ship: `League Escort ${S.rng.pick(['Surety', 'Ledger', 'Tally', 'Warrant', 'Dividend', 'Bond'])}`, captain: 'Commodore of the Convoy' });
    game.setNpcLevel(e, lv);
    e.convoyId = id;
    const b = game.npcs.get(e.id)!;
    b.leader = c.members[0];
    b.slot = i + 1;
    c.escorts.push(e.id);
  }
  keepEscorts(game, c);
  S.convoys.set(id, c);
  // The word of its sailing goes round the sea it sails in: those captains know of it (its route is on their chart).
  for (const s of game.sessions) {
    if (s.ship?.region !== region) continue;
    c.known.add(s.accountId);
    game.sendTo(s, { t: 'toast', msg: `A League convoy of ${n} sails from ${from.name} for ${to.name}.`, kind: 'info' });
  }
  return c;
}

/** Whether a captain has fired on any ship of a convoy (its escorts answer her). */
export function convoyFoe(game: Game, convoyId: number, other: ShipEntity): boolean {
  const c = rs(game).convoys.get(convoyId);
  if (!c || other.accountId === null) return false;
  return c.raiders.has(other.accountId);
}

/** Its merchantmen still sailing under the League's flag. */
function standingOf(game: Game, c: Convoy): ShipEntity[] {
  const out: ShipEntity[] = [];
  for (const mid of c.members) {
    const m = game.ships.get(mid);
    if (m && m.alive && !m.surrendered && !m.prize && !m.lootLockedFor) out.push(m);
  }
  return out;
}

/** The escorts keep to the first merchantman still sailing: in formation when near a captain, along her route when
 *  the convoy is far from everyone (they would wander off on their own otherwise). */
function keepEscorts(game: Game, c: Convoy): void {
  const lead = standingOf(game, c)[0];
  if (!lead) return;
  const lb = game.npcs.get(lead.id);
  for (const e of c.escorts) {
    const b = game.npcs.get(e);
    if (!b) continue;
    b.leader = lead.id;
    if (!b.active && lb?.path) {
      b.path = lb.path;
      b.length = lb.length;
      b.traveled = Math.max(0, lb.traveled - 200 * (b.slot ?? 1));
      b.destPort = null;
    }
  }
}

/** A captain learns of a convoy (a tavern's word, a lookout's): its route goes on her chart. */
export function learnConvoy(game: Game, accountId: number, convoyId: number): boolean {
  const c = rs(game).convoys.get(convoyId);
  if (!c || c.broken || c.delivered) return false;
  c.known.add(accountId);
  return true;
}

/** The convoy a captain at sea could sign on to escort, if any: near one of its ships, not a raider of it, not
 *  already its escort. `blocked` says why the commodore will not have her. */
export function escortOffer(game: Game, s: PlayerSession): { id: number; to: string; pay: number; blocked?: string } | null {
  const ship = s.ship;
  if (!ship || ship.docked || !ship.alive || !s.profile) return null;
  for (const c of rs(game).convoys.values()) {
    if (c.broken || c.delivered || c.hired.has(s.accountId)) continue;
    const near = standingOf(game, c).some((m) => Math.abs(m.state.x - ship.state.x) < ESCORT_SIGN_R && Math.abs(m.state.y - ship.state.y) < ESCORT_SIGN_R && dist(m.state.x, m.state.y, ship.state.x, ship.state.y) < ESCORT_SIGN_R);
    if (!near) continue;
    const to = game.portById(c.to)?.name ?? c.to;
    const pay = escortPay(c.level);
    if (c.raiders.has(s.accountId)) return { id: c.id, to, pay, blocked: 'the commodore does not sign on those who fired on his ships' };
    if (ship.wantedCache >= 2) return { id: c.id, to, pay, blocked: 'the commodore does not sign on a wanted captain' };
    if ((s.profile.reputation.league ?? 0) <= -30) return { id: c.id, to, pay, blocked: 'the League does not trust you with its convoy' };
    return { id: c.id, to, pay };
  }
  return null;
}

/** She signs on as escort (the land key by a convoy): paid on arrival if she is with it when it comes in. */
export function signEscort(game: Game, s: PlayerSession): string | null {
  const o = escortOffer(game, s);
  if (!o) return 'No convoy within hail';
  if (o.blocked) return o.blocked;
  const c = rs(game).convoys.get(o.id)!;
  if (!c.hired.size) c.hiredAt = game.now;
  c.hired.set(s.accountId, o.pay);
  c.known.add(s.accountId);
  game.sendTo(s, { t: 'toast', msg: `You sign on as escort of the League convoy for ${o.to}: ${o.pay} silver on arrival. Keep with it.`, kind: 'good' });
  sendRaid(game, s, true);
  return null;
}

/** The sea sends raiders at a convoy a captain escorts, once, a minute or so after she signs on. */
function stirConvoy(game: Game, c: Convoy, lead: ShipEntity): void {
  const S = rs(game);
  c.stirred = true;
  const h = lead.state.heading;
  let sent = 0;
  for (let k = 0; k < 10 && sent < 2; k++) {
    const a = h + S.rng.range(-1.2, 1.2);
    const x = lead.state.x + Math.sin(a) * 2000, y = lead.state.y - Math.cos(a) * 2000;
    if (isLand(game.world, x, y) || !game.inZone(x, y)) continue;
    const lv = Math.max(1, Math.min(10, c.level + S.rng.int(-1, 0)));
    const p = game.spawnNpcShip('pirate', S.rng.pick(hullsFor('pirate', lv)), 'confederacy', x, y, headingOf(lead.state.x - x, lead.state.y - y));
    game.setNpcLevel(p, lv);
    p.purse = 150 + 60 * lv;
    const b = game.npcs.get(p.id)!;
    b.area = { x: lead.state.x, y: lead.state.y, r: 4000 };
    b.chase = { id: lead.id, until: game.now + 300 };
    b.expiresAt = game.now + 600;
    planWander(game, p, b);
    sent++;
  }
  if (!sent) return;
  for (const acc of c.hired.keys()) {
    const s = game.sessionByAccount(acc);
    if (s) game.sendTo(s, { t: 'toast', msg: 'Sails on the horizon: raiders bear down on the convoy!', kind: 'bad' });
  }
}

/** The convoy is in: its escorts of captains are paid, by the share of its hulls brought in. */
function deliverConvoy(game: Game, c: Convoy, standing: number): void {
  c.delivered = true;
  const port = game.portById(c.to);
  const name = port?.name ?? c.to;
  const share = standing / Math.max(1, c.size);
  for (const [acc, pay] of c.hired) {
    const s = game.sessionByAccount(acc);
    const ship = s?.ship;
    if (!s?.profile || !ship || !ship.alive) continue;
    const near = (port && dist(ship.state.x, ship.state.y, port.x, port.y) < ESCORT_KEEP_R) || c.members.some((mid) => {
      const m = game.ships.get(mid);
      return !!m && dist(ship.state.x, ship.state.y, m.state.x, m.state.y) < ESCORT_KEEP_R;
    });
    if (!near || c.raiders.has(acc)) {
      game.sendTo(s, { t: 'toast', msg: `The convoy made ${name} without you: no pay.`, kind: 'bad' });
      continue;
    }
    const n = Math.round(pay * (0.5 + 0.5 * share));
    s.profile.gold += n;
    game.db.ledger(acc, 'convoy_escort', n, c.to);
    changeRep(s.profile, 'league', 4);
    game.grantXp(s, targetXp(s.profile!.level, c.level, 2), 'Escorted a League convoy');
    game.sendTo(s, { t: 'toast', msg: `The League convoy is in at ${name}: ${n} silver for the escort (${standing} of ${c.size} hulls brought in).`, kind: 'gold' });
  }
}

function stepConvoys(game: Game): void {
  const S = rs(game);
  for (const [id, c] of S.convoys) {
    // Who has fired on it: the League marks them.
    for (const mid of [...c.members, ...c.escorts]) {
      const m = game.ships.get(mid);
      if (!m) continue;
      for (const [aid, t] of m.attackers) {
        if (t < game.now - 5) continue;
        const acc = game.ships.get(aid)?.accountId;
        if (acc === null || acc === undefined) continue;
        c.raidedAt = game.now;
        if (c.raiders.has(acc)) continue;
        c.raiders.add(acc);
        c.known.add(acc);
        const s = game.sessionByAccount(acc);
        if (s?.profile) {
          changeRep(s.profile, 'league', -CONVOY_INFAMY);
          game.sendTo(s, { t: 'toast', msg: `The League marks your name: you fired on its convoy (−${CONVOY_INFAMY} League standing).`, kind: 'bad' });
          if (c.hired.delete(acc)) game.sendTo(s, { t: 'toast', msg: 'You turned on the convoy you were paid to guard: the contract is void.', kind: 'bad' });
        }
      }
    }
    const standing = standingOf(game, c);
    if (!c.broken && !standing.length && c.raiders.size) {
      c.broken = true;
      heatUp(game, c.region, HEAT.convoy);
      const names: string[] = [];
      // The strongbox: the League's silver, shared among the raiders still about the wrecks.
      const near: PlayerSession[] = [];
      for (const acc of c.raiders) {
        const s = game.sessionByAccount(acc);
        if (!s?.profile) continue;
        names.push(s.name);
        const pr = sanitizePiracy(s.profile);
        pr.convoys++;
        addFame(game, s, FAME.convoy);
        if (pr.convoys >= DEED_CONVOYS) grantDeed(game, s, 'deed_convoy_breaker');
        const ship = s.ship;
        if (ship?.alive && c.members.some((mid) => {
          const m = game.ships.get(mid);
          return !!m && dist(ship.state.x, ship.state.y, m.state.x, m.state.y) < 3000;
        })) near.push(s);
      }
      if (near.length) {
        const each = Math.round(convoyStrongbox(c.level) / near.length);
        for (const s of near) {
          s.profile!.gold += each;
          game.db.ledger(s.accountId, 'convoy_strongbox', each, String(c.id));
          game.sendTo(s, { t: 'toast', msg: `The convoy's strongbox: ${each} silver.`, kind: 'gold' });
        }
      }
      if (names.length) for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${names.join(', ')} broke a League convoy in ${REGIONS[c.region].name}!`, kind: 'gold' });
    }
    // In port: a merchantman of it has reached its harbour and planned her next voyage.
    if (!c.broken && !c.delivered && standing.some((m) => {
      const b = game.npcs.get(m.id);
      return !!b && b.destPort !== c.to;
    })) deliverConvoy(game, c, standing.length);
    // Seen: a captain within sight of it has its route on her chart.
    const lead = standing[0];
    if (lead && !c.broken && !c.delivered) {
      for (const s of game.sessions) {
        const ship = s.ship;
        if (!ship || ship.docked || c.known.has(s.accountId)) continue;
        if (Math.abs(ship.state.x - lead.state.x) < CONVOY_SPOT_R && Math.abs(ship.state.y - lead.state.y) < CONVOY_SPOT_R) c.known.add(s.accountId);
      }
      keepEscorts(game, c);
      if (c.hired.size && !c.stirred && game.now - c.hiredAt > 50 && game.npcs.get(lead.id)?.active) stirConvoy(game, c, lead);
    }
    // Delivered, broken or old: the convoy's story ends; its ships sail on as the sea's own.
    if (c.broken || c.delivered || game.now > c.until || !c.members.some((mid) => game.ships.has(mid))) {
      for (const e of c.escorts) {
        const s = game.ships.get(e);
        if (s) {
          s.convoyId = undefined;
          const b = game.npcs.get(e);
          if (b) {
            b.leader = undefined;
            planWander(game, s, b);
            b.expiresAt = game.now + 300;
          }
        }
      }
      for (const acc of c.hired.keys()) {
        const s = game.sessionByAccount(acc);
        if (s && !c.delivered) game.sendTo(s, { t: 'toast', msg: 'The convoy you escorted is lost: no pay.', kind: 'bad' });
        if (s) sendRaid(game, s, true);
      }
      S.convoys.delete(id);
    }
  }
  if (game.directorOn && game.now >= S.nextConvoy) {
    S.nextConvoy = game.now + S.rng.range(CONVOY_EVERY[0], CONVOY_EVERY[1]);
    const busy = new Set([...S.convoys.values()].map((c) => c.region));
    const regions = REGION_IDS.filter((r) => REGIONS[r].safety !== 'safe' && r !== 'the_abyss' && !busy.has(r) && (!game.zone || game.zone.regions.has(r)) && [...game.sessions].some((s) => s.ship?.region === r));
    if (regions.length && S.convoys.size < CONVOY_MAX) sailConvoy(game, S.rng.pick(regions));
  }
}

/** The convoys a captain knows of, for her chart (docs/16 #6). */
function convoyViews(game: Game, s: PlayerSession): ConvoyView[] {
  const out: ConvoyView[] = [];
  const ship = s.ship;
  for (const c of rs(game).convoys.values()) {
    if (c.broken || c.delivered || (!c.known.has(s.accountId) && !c.hired.has(s.accountId))) continue;
    const standing = standingOf(game, c);
    const lead = standing[0] ?? game.ships.get(c.members.find((mid) => game.ships.has(mid)) ?? -1);
    if (!lead) continue;
    const seen = !!ship && !ship.docked && dist(ship.state.x, ship.state.y, lead.state.x, lead.state.y) < CONVOY_SPOT_R;
    out.push({
      id: c.id, x: Math.round(lead.state.x / 10) * 10, y: Math.round(lead.state.y / 10) * 10,
      from: game.portById(c.from)?.name ?? c.from, to: game.portById(c.to)?.name ?? c.to,
      level: c.level, hulls: standing.length, size: c.size, escorts: c.escorts.filter((e) => game.ships.get(e)?.alive).length,
      route: c.route, seen, mine: c.hired.has(s.accountId), pay: c.hired.get(s.accountId) ?? escortPay(c.level), raided: game.now - c.raidedAt < 30,
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the merchant's answer

/** A merchant under a captain's guns in contested water sends up a rocket (a convoy always): a League cutter comes
 *  a minute or so later. Fleeing, she answers with her swivels. */
function merchantsAnswer(game: Game): void {
  const S = rs(game);
  const now = game.now;
  for (const [id, b] of game.npcs) {
    if (b.role !== 'merchant' || !b.active) continue;
    const m = game.ships.get(id);
    if (!m || !m.alive || m.surrendered) continue;
    let raider: ShipEntity | null = null;
    for (const [aid, t] of m.attackers) {
      if (t < now - 5) continue;
      const a = game.ships.get(aid);
      if (a?.isPlayer) raider = a;
    }
    if (!raider) continue;
    if (!S.rocketed.has(id) && REGIONS[m.region].safety === 'contested') {
      S.rocketed.add(id);
      if (m.convoyId || S.rng.chance(0.35)) {
        game.emit({ k: 'fx', fx: 'rocket', x: Math.round(m.state.x), y: Math.round(m.state.y) }, m.state.x, m.state.y);
        game.toastShip(raider, `${m.name} sends up a rocket — a patrol will come!`, 'bad');
        if (raider.accountId !== null) S.responders.push({ at: now + S.rng.range(60, 90), account: raider.accountId, x: m.state.x, y: m.state.y });
      }
    }
    // Swivels at close quarters.
    const d = dist(m.state.x, m.state.y, raider.state.x, raider.state.y);
    if (d < 150 && now >= (S.swivelAt.get(id) ?? 0)) {
      S.swivelAt.set(id, now + 4);
      applyDamage(game, raider, { crew: 1, hull: raider.stats.hullMax * 0.005 }, m);
      if (!S.swivelAt.has(-id)) {
        S.swivelAt.set(-id, now);
        game.toastShip(raider, 'Swivel guns bark from her rail!', 'bad');
      }
    }
  }
  // The rockets answered.
  for (const r of [...S.responders]) {
    if (now < r.at) continue;
    S.responders.splice(S.responders.indexOf(r), 1);
    const prey = game.shipOfAccount(r.account);
    if (!prey || !prey.alive || prey.docked) continue;
    respond(game, prey, r.account);
  }
}

function respond(game: Game, prey: ShipEntity, account: number): ShipEntity | null {
  const S = rs(game);
  for (let k = 0; k < 8; k++) {
    const a = S.rng.float() * Math.PI * 2;
    const x = prey.state.x + Math.sin(a) * 2400, y = prey.state.y - Math.cos(a) * 2400;
    if (isLand(game.world, x, y)) continue;
    const lv = Math.min(10, prey.combatLevel + 1);
    const ship = game.spawnNpcShip('hunter', S.rng.pick(hullsFor('hunter', lv)), 'league', x, y, headingOf(prey.state.x - x, prey.state.y - y), { ship: `League Cutter ${S.rng.pick(['Audit', 'Recoup', 'Lien', 'Foreclosure', 'Collector'])}`, captain: 'Revenue Captain' });
    game.setNpcLevel(ship, lv);
    const b = game.npcs.get(ship.id)!;
    b.huntAccount = account;
    b.area = { x: prey.state.x, y: prey.state.y, r: 6000 };
    b.expiresAt = game.now + 420;
    planWander(game, ship, b);
    game.toastShip(prey, `A League cutter answers the rocket: ${ship.name}.`, 'bad');
    return ship;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ tribute

/** A merchant who has struck pays a share of what she carries and sails on (docs/12 P6). */
export function demandTribute(game: Game, s: PlayerSession, id: number): string | null {
  const S = rs(game);
  const ship = s.ship!;
  const m = game.ships.get(id);
  if (!m || !m.alive || m.isPlayer || m.npcRole !== 'merchant' || !m.surrendered) return 'Only a merchant who has struck pays tribute.';
  if (dist(ship.state.x, ship.state.y, m.state.x, m.state.y) > 400) return 'Come within hail of her first.';
  const paid = S.tributes.get(m.id);
  if (paid?.has(s.accountId)) return 'She has paid you already.';
  const p = s.profile!;
  const share = S.rng.range(TRIBUTE[0], TRIBUTE[1]);
  const pay = Math.round(cargoValue(m) * share);
  // From her purse first, then her hold.
  const fromPurse = Math.min(m.purse ?? 0, pay);
  m.purse = (m.purse ?? 0) - fromPurse;
  const rest = pay - fromPurse;
  if (rest > 0) for (const g of Object.keys(m.cargo) as GoodId[]) m.cargo[g] = Math.floor((m.cargo[g] ?? 0) * (1 - share));
  p.gold += pay;
  game.db.ledger(s.accountId, 'tribute', pay, m.name);
  (S.tributes.get(m.id) ?? S.tributes.set(m.id, new Map()).get(m.id)!).set(s.accountId, game.now);
  p.infamy += 4;
  if (m.faction === 'league') changeRep(p, 'league', -2);
  const pr = sanitizePiracy(p);
  pr.tributes++;
  questEvent(game, s, { k: 'tribute' });
  addFame(game, s, FAME.tribute);
  cheer(s);
  heatUp(game, m.region, HEAT.tribute);
  // She sails on, and is let be for a while.
  m.surrendered = false;
  m.protectedUntil = game.now + 60;
  const b = game.npcs.get(m.id);
  if (b) {
    b.fleeFrom = null;
    b.surrenderedAt = 0;
  }
  game.sendTo(s, { t: 'toast', msg: `${m.name} pays tribute: ${pay} silver. She sails on.`, kind: 'gold' });
  maybeHunters(game, s, m.region);
  return null;
}

/** A captain who fires on a merchant that paid her: her word is broken. */
export function tributeBroken(game: Game, attacker: ShipEntity, victim: ShipEntity): void {
  const S = rs(game);
  const t = S.tributes.get(victim.id)?.get(attacker.accountId ?? -1);
  if (t === undefined || game.now - t > 600) return;
  S.tributes.get(victim.id)!.delete(attacker.accountId!);
  const p = game.profileOf(attacker);
  if (!p) return;
  p.infamy += 10;
  const pr = sanitizePiracy(p);
  pr.honour = Math.max(0, pr.honour - 3);
  game.toastShip(attacker, `You broke your word to ${victim.name}: the lanes will remember.`, 'bad');
}

/** After a raid in lanes that run hot, the League sends a cutter after the raider. */
function maybeHunters(game: Game, s: PlayerSession, region: RegionId): void {
  if (heatOf(game, region) < HEAT.hunters || !s.ship) return;
  if (rs(game).rng.chance(0.5)) respond(game, s.ship, s.accountId);
}

// ------------------------------------------------------------------------------------------------ hooks

/** A merchant boarded, sunk or taken by a captain (creditKill): fame and heat. */
export function raidKill(game: Game, s: PlayerSession, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  if (victim.isPlayer || victim.npcRole !== 'merchant') return;
  heatUp(game, victim.region, HEAT.raid);
  if (how === 'boarded') {
    addFame(game, s, FAME.board);
    cheer(s);
  }
  maybeHunters(game, s, victim.region);
}

/** A prize taken or a merchant let go (resolveLoot). */
export function raidFate(game: Game, s: PlayerSession, victim: ShipEntity, fate: 'prize' | 'release' | 'sink' | 'ransom'): void {
  if (victim.isPlayer) return;
  if (fate === 'prize') addFame(game, s, FAME.prize);
  if (fate === 'release') {
    const p = s.profile!;
    const pr = sanitizePiracy(p);
    pr.honour++;
    if (p.oath === 'code') {
      addFame(game, s, FAME.release);
      game.sendTo(s, { t: 'toast', msg: 'The Brethren hear you kept the Code.', kind: 'good' });
    }
  }
}

// ------------------------------------------------------------------------------------------------ guarded

/** A merchant with a friend's warship within half a mile sails "under guard": the sea's pirates think twice. */
function markGuarded(game: Game): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || ship.docked || !ship.alive) continue;
    let guard = false;
    for (const o of game.ships.values()) {
      if (o === ship || !o.alive || o.docked) continue;
      if (o.ownerId === ship.id && !o.prize) guard = true;
      else if (o.isPlayer && o.accountId !== null && dist(o.state.x, o.state.y, ship.state.x, ship.state.y) < 800) {
        const g = groupOfAccount(game, s.accountId);
        if (g && g.members.includes(o.accountId) && o.stats.gunsPerSide >= ship.stats.gunsPerSide) guard = true;
      }
      if (guard) break;
    }
    ship.guardedUntil = guard ? game.now + 2 : 0;
  }
}

// ------------------------------------------------------------------------------------------------ the second

export function stepRaiding(game: Game): void {
  const S = rs(game);
  stepConvoys(game);
  merchantsAnswer(game);
  sailTips(game);
  markGuarded(game);
  // The lanes cool.
  for (const r of Object.keys(S.heat) as RegionId[]) {
    S.heat[r] = Math.max(0, (S.heat[r] ?? 0) - HEAT.coolPerHour / 3600);
    if (!S.heat[r]) delete S.heat[r];
  }
  for (const id of [...S.rocketed]) if (!game.ships.has(id)) S.rocketed.delete(id);
  for (const [acc, m] of S.manifests) if (game.now > m.until) S.manifests.delete(acc);
  if (Math.floor(game.now) % 60 === 0) game.db.setKv('lane_heat', S.heat);
  if (Math.floor(game.now) % 5 === 0) for (const s of game.sessions) sendRaid(game, s);
}

export function raidView(game: Game, s: PlayerSession): RaidView {
  const S = rs(game);
  const p = s.profile!;
  const pr = sanitizePiracy(p);
  const rank = brethrenRank(pr.fame);
  const marks: RaidView['marks'] = [];
  for (const t of S.tips.values()) {
    if (!t.buyers.has(s.accountId) || t.ship === null || t.ship < 0) continue;
    const m = game.ships.get(t.ship);
    if (m?.alive) marks.push({ id: m.id, x: Math.round(m.state.x), y: Math.round(m.state.y) });
  }
  const heat: RaidView['heat'] = {};
  for (const [r, h] of Object.entries(S.heat)) if ((h ?? 0) >= 1) heat[r as RegionId] = Math.round(h!);
  return { fame: pr.fame, rank, next: BRETHREN_RANKS[Math.min(5, rank + 1)], honour: pr.honour, tributes: pr.tributes, convoys: pr.convoys, marks, heat, known: convoyViews(game, s) };
}

function sendRaid(game: Game, s: PlayerSession, force = false): void {
  if (!s.profile) return;
  const S = rs(game);
  const v = raidView(game, s);
  const key = JSON.stringify(v);
  if (!force && S.sent.get(s.accountId) === key) return;
  S.sent.set(s.accountId, key);
  game.sendTo(s, { t: 'raid', view: v });
}

/** Tests. */
export function convoysAt(game: Game): Readonly<Convoy>[] {
  return [...rs(game).convoys.values()];
}

export function respondersDue(game: Game): number {
  return rs(game).responders.length;
}
