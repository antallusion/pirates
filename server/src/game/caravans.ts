// Caravans (docs/12 P8). A captain's own cargo hulls, berthed at her island, sail on her business without her: they
// haul the outposts' stores home to one point, sell the island's goods in a port (never below the price she set),
// trade between ports, or buy in a port what the island needs. A skipper takes each (a captive captain for nothing,
// else a hired one), escorts are hired for the voyage, and the League insures the cargo. Away from every captain
// they sail as a line on the chart (the LOD of the sea's merchants); near one, they are ships on the water that can
// be seen — "Ada's Caravan ⚓5" — and attacked by the rules of the waters. The sea's pirates fall on them: far from
// their owner the fight is reckoned (escorts against pirates, with luck) and a letter tells how it went; within
// 25 km of her the alarm sounds and the fight is real.

import { caravanNemesis, caravanNemesisLine } from './nemesis.ts';
import { liveNamed, putToSea } from './wanted.ts';
import { COUNTING_HOUSE_PROFIT, INSURANCE_COVER, INSURANCE_PREMIUM, MAX_ESCORTS, RESCUE_R, RESCUE_SEC, RISK, SKIPPER_COST, TASK_NAMES, defenceOdds, escortCost } from '../../../shared/src/data/caravans.ts';
import type { CaravanTask, OnAttack } from '../../../shared/src/data/caravans.ts';
import { ISLE_LEVELS } from '../../../shared/src/data/estate.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { hullRole, hullsFor, levelPower, levelScale, shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { dist } from '../../../shared/src/math.ts';
import type { CaravanView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Cargo, ShipLoadout } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { applyTrade, bestRoute, midPrice, quoteBuy, quoteSell } from './economy.ts';
import type { PriceMods } from './economy.ts';
import { outposts, ownIsland } from './estate.ts';
import type { Game } from './Game.ts';
import { has, island, storeCapacity } from './holdings.ts';
import { findPath, pointAlong } from './nav.ts';
import type { Path } from './nav.ts';
import { sectorLevel, setPath, spawnPirate } from './npc.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import type { ShipEntity } from './ship.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { SKIPPER_RISK, SKIPPER_SALE, SKIPPER_SKIM, SKIPPER_SPEED } from '../../../shared/src/data/turncoats.ts';
import { skipperHome, takeSkipper } from './turncoats.ts';
import type { Skipper } from './turncoats.ts';
import { SPEED_SCALE } from '../../../shared/src/constants.ts';


type Stop = { kind: 'isle' } | { kind: 'port'; id: string; act: 'sell' | 'buy' | 'trade_buy' | 'trade_sell' } | { kind: 'outpost'; id: string };

interface Leg {
  path: Path;
  length: number;
  stop: Stop;
}

export interface Caravan {
  id: string;
  owner: number;
  ownerName: string;
  name: string;
  skipper: string;
  /** A turned captain at the helm, with his gifts and loyalty (docs/12 P10 #16). */
  skipperRec?: Skipper;
  island: number;
  ships: { loadout: ShipLoadout; hull: number }[];
  escorts: number;
  task: CaravanTask;
  outposts: string[];
  port: string | null;
  port2: string | null;
  goods: GoodId[];
  /** Sell no lower than this share of the market's middle price. */
  minPrice: number;
  orders: { repeat: boolean; avoidLawless: boolean; nightInPort: boolean; onAttack: OnAttack };
  cargo: Cargo;
  insured: boolean;
  legs: Leg[];
  leg: number;
  traveled: number;
  entities: number[];
  farSince: number;
  attack: { until: number; pirates: number[] } | null;
  nextRoll: number;
  log: string[];
  tradeGood: GoodId | null;
}

interface CaravanState {
  all: Record<string, Caravan> | null;
  rng: Rng;
  dirty: boolean;
  seq: number;
  sent: Map<number, string>;
}

const states = new WeakMap<Game, CaravanState>();

function cs(game: Game): CaravanState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { all: null, rng: new Rng(game.world.seed ^ 0xca7a), dirty: false, seq: 1, sent: new Map() }));
  return s;
}

export function caravans(game: Game): Record<string, Caravan> {
  const S = cs(game);
  S.all ??= game.db.getKv<Record<string, Caravan>>('caravans') ?? {};
  return S.all;
}

function touch(game: Game): void {
  cs(game).dirty = true;
}

function note(c: Caravan, line: string): void {
  c.log.push(line);
  if (c.log.length > 6) c.log.shift();
}

// ------------------------------------------------------------------------------------------------ numbers

export function caravanSlots(game: Game, s: PlayerSession): number {
  const h = ownIsland(game, s.accountId);
  if (!h) return 0;
  return ISLE_LEVELS[Math.max(1, Math.min(10, h.level ?? 1))].caravans + (has(h, 'caravan_office') ? 1 : 0) + (s.ship?.hasFlag('counting_house') ? 1 : 0);
}

function level(c: Caravan): number {
  return Math.min(...c.ships.map((x) => shipLevelOf(x.loadout)));
}

function holdOf(c: Caravan): number {
  return c.ships.reduce((a, x) => a + SHIP_CLASSES[x.loadout.classId].holdVolume * levelScale(x.loadout.classId, shipLevelOf(x.loadout)).hold, 0);
}

function speedOf(game: Game, c: Caravan): number {
  const slowest = Math.min(...c.ships.map((x) => SHIP_CLASSES[x.loadout.classId].maxSpeed));
  const h = island(game, c.island) ? game.holdings.get(game, c.island) : undefined;
  const pilot = h?.residents?.some((r) => r.prof === 'pilot') ? 1.1 : 1;
  const nav = c.skipperRec?.traits.includes('navigator') ? SKIPPER_SPEED : 1;
  return slowest * 0.55 * pilot * nav * SPEED_SCALE;
}

function value(cargo: Cargo): number {
  let v = 0;
  for (const [g, n] of Object.entries(cargo)) v += (GOODS[g as GoodId]?.basePrice ?? 0) * (n ?? 0);
  return v;
}

function room(c: Caravan): number {
  return Math.max(0, holdOf(c) - cargoVolume(c.cargo));
}

// ------------------------------------------------------------------------------------------------ places

/** A sea point just off an island's shore. */
function offShore(game: Game, islandId: number): [number, number] {
  const is = island(game, islandId)!;
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 200), y = is.y - Math.cos(a) * (is.radius + 200);
    if (!isLand(game.world, x, y) && !isLand(game.world, x + Math.sin(a) * 80, y - Math.cos(a) * 80)) return [x, y];
  }
  return [is.x + is.radius + 250, is.y];
}

function placeOf(game: Game, c: Caravan, stop: Stop): [number, number] {
  if (stop.kind === 'isle') return offShore(game, c.island);
  if (stop.kind === 'outpost') {
    const o = outposts(game)[stop.id];
    return offShore(game, o ? o.island : c.island);
  }
  const p = game.portById(stop.id)!;
  return [p.x, p.y];
}

function labelOf(game: Game, c: Caravan, stop: Stop): string {
  if (stop.kind === 'isle') return island(game, c.island)?.name ?? '';
  if (stop.kind === 'outpost') return island(game, outposts(game)[stop.id]?.island ?? c.island)?.name ?? '';
  return game.portById(stop.id)?.name ?? stop.id;
}

/** The legs of a voyage, from her island round her stops and home. */
function plan(game: Game, c: Caravan): boolean {
  const stops: Stop[] = [];
  switch (c.task) {
    case 'haul':
      for (const o of c.outposts) stops.push({ kind: 'outpost', id: o });
      break;
    case 'sell':
      if (c.port) stops.push({ kind: 'port', id: c.port, act: 'sell' });
      break;
    case 'supply':
      if (c.port) stops.push({ kind: 'port', id: c.port, act: 'buy' });
      break;
    case 'trade':
      if (c.port) stops.push({ kind: 'port', id: c.port, act: 'trade_buy' });
      if (c.port2) stops.push({ kind: 'port', id: c.port2, act: 'trade_sell' });
      break;
  }
  if (!stops.length) return false;
  stops.push({ kind: 'isle' });
  const legs: Leg[] = [];
  let [x, y] = offShore(game, c.island);
  for (const st of stops) {
    const [tx, ty] = placeOf(game, c, st);
    const path = findPath(game.world, x, y, tx, ty, 90000) ?? [[x, y], [tx, ty]];
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    // Keeping out of lawless water is a longer way round.
    if (c.orders.avoidLawless) length *= 1.2;
    legs.push({ path, length, stop: st });
    [x, y] = [tx, ty];
  }
  c.legs = legs;
  c.leg = 0;
  c.traveled = 0;
  return true;
}

// ------------------------------------------------------------------------------------------------ launching

export interface LaunchOrder {
  ships: number[];
  task: CaravanTask;
  outposts?: string[];
  port?: string;
  port2?: string;
  goods?: GoodId[];
  minPrice?: number;
  escorts: number;
  insured: boolean;
  orders: Caravan['orders'];
}

export function launchCaravan(game: Game, s: PlayerSession, o: LaunchOrder): string | null {
  const p = s.profile!;
  const h = ownIsland(game, s.accountId);
  if (!h) return 'You have no island of your own.';
  const mine = Object.values(caravans(game)).filter((c) => c.owner === s.accountId);
  const slots = caravanSlots(game, s);
  if (mine.length >= slots) return `Your island sends no more caravans: ${mine.length} at sea.`;
  const key = `isle:${h.island}`;
  const idx = [...new Set((o.ships ?? []).map((i) => Math.trunc(Number(i))))].filter((i) => p.berths[i]?.port === key && ['trade', 'all', 'fish'].includes(hullRole(p.berths[i].loadout.classId)));
  if (!idx.length) return 'Only cargo hulls berthed at your island sail in a caravan.';
  const escorts = Math.max(0, Math.min(MAX_ESCORTS, Math.trunc(Number(o.escorts) || 0)));
  const S = cs(game);
  const c: Caravan = {
    id: `cv_${s.accountId}_${S.seq++}_${Math.floor(game.now)}`, owner: s.accountId, ownerName: s.name, name: `${s.name}'s Caravan`, skipper: '', island: h.island,
    ships: idx.map((i) => ({ loadout: p.berths[i].loadout, hull: p.berths[i].hull })), escorts, task: o.task,
    outposts: (o.outposts ?? []).filter((id) => outposts(game)[id]?.owner === s.accountId), port: o.port && game.portById(o.port) ? o.port : null, port2: o.port2 && game.portById(o.port2) ? o.port2 : null,
    goods: (o.goods ?? []).filter((g) => GOODS[g]), minPrice: Math.max(0.5, Math.min(1.5, Number(o.minPrice) || 0.9)),
    orders: { repeat: !!o.orders?.repeat, avoidLawless: !!o.orders?.avoidLawless, nightInPort: !!o.orders?.nightInPort, onAttack: (['fight', 'flee', 'dump', 'surrender'] as OnAttack[]).includes(o.orders?.onAttack) ? o.orders.onAttack : 'flee' },
    cargo: {}, insured: !!o.insured, legs: [], leg: 0, traveled: 0, entities: [], farSince: game.now, attack: null, nextRoll: game.now + 60, log: [], tradeGood: null,
  };
  if (c.task === 'haul' && !c.outposts.length) {
    c.outposts = Object.values(outposts(game)).filter((x) => x.owner === s.accountId).map((x) => x.id);
    if (!c.outposts.length) return 'No outposts to haul from.';
  }
  if ((c.task === 'sell' || c.task === 'supply' || c.task === 'trade') && !c.port) return 'A caravan wants a destination.';
  if (c.task === 'trade' && !c.port2) return 'A caravan wants a destination.';
  // The skipper: a turned captain of her own for nothing (docs/12 P10 #16), else one hired.
  const lvl = level(c);
  const cost = escorts * escortCost(lvl) + ((p.skippers ?? []).length ? 0 : SKIPPER_COST);
  if (p.gold < cost) return `Needs ${cost} silver`;
  // What the island sends: the goods to sell.
  if (c.task === 'sell') {
    const list = c.goods.length ? c.goods : (Object.keys(h.store) as GoodId[]);
    for (const g of list) {
      const per = GOODS[g].volume;
      const k = Math.min(h.store[g] ?? 0, Math.floor(room(c) / per));
      if (k <= 0) continue;
      c.cargo[g] = (c.cargo[g] ?? 0) + k;
      h.store[g] = (h.store[g] ?? 0) - k;
      if (!h.store[g]) delete h.store[g];
    }
    if (!Object.keys(c.cargo).length) return 'Nothing in the island’s store to sell.';
    game.holdings.touch();
  }
  if (!plan(game, c)) return 'A caravan wants a destination.';
  p.gold -= cost;
  game.db.ledger(s.accountId, 'caravan_fit', -cost, c.id);
  const rec = takeSkipper(p);
  if (rec) {
    c.skipper = rec.name;
    c.skipperRec = rec;
  } else c.skipper = S.rng.pick(['Aldous Crane', 'Bess Marlow', 'Cato Wrenfield', 'Dagny Holt', 'Esme Varga', 'Fenwick Pryce']);
  // The ships leave their berths for the voyage.
  for (const i of [...idx].sort((a, b) => b - a)) p.berths.splice(i, 1);
  insure(game, s, c, value(c.cargo));
  caravans(game)[c.id] = c;
  touch(game);
  note(c, `Skipper ${c.skipper} takes the helm.`);
  game.sendTo(s, { t: 'toast', msg: `Caravan ${c.name} sails: ${TASK_NAMES[c.task][0]}.`, kind: 'good' });
  sendCaravans(game, s, true);
  return null;
}

/** The League's premium on a load (the insured value grows with every load taken on). */
function insure(game: Game, s: PlayerSession | null | undefined, c: Caravan, v: number): void {
  if (!c.insured || v <= 0) return;
  const premium = Math.round(v * INSURANCE_PREMIUM);
  const sess = s ?? game.sessionByAccount(c.owner);
  if (sess?.profile) {
    sess.profile.gold -= premium;
    game.db.ledger(c.owner, 'caravan_insurance', -premium, c.id);
  } else {
    const h = ownIsland(game, c.owner);
    if (h) h.treasury -= premium;
  }
}

export function caravanOrder(game: Game, s: PlayerSession, id: string, action: string): string | null {
  const c = caravans(game)[id];
  if (!c || c.owner !== s.accountId) return 'No such caravan';
  if (action === 'recall') {
    // Home from where she is: the rest of the stops are dropped.
    const [x, y] = here(game, c);
    const [tx, ty] = offShore(game, c.island);
    const path = findPath(game.world, x, y, tx, ty, 90000) ?? [[x, y], [tx, ty]];
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    dematerialize(game, c);
    c.legs = [{ path, length, stop: { kind: 'isle' } }];
    c.leg = 0;
    c.traveled = 0;
    c.orders.repeat = false;
    touch(game);
    game.sendTo(s, { t: 'toast', msg: `Caravan ${c.name} is recalled.`, kind: 'info' });
    return null;
  }
  if (action === 'repeat') {
    c.orders.repeat = !c.orders.repeat;
    touch(game);
    return null;
  }
  return 'Unknown order';
}

// ------------------------------------------------------------------------------------------------ at sea

function here(game: Game, c: Caravan): [number, number] {
  const leg = c.legs[c.leg];
  if (!leg) return offShore(game, c.island);
  const lead = c.entities.length ? game.ships.get(c.entities[0]) : undefined;
  if (lead?.alive) return [lead.state.x, lead.state.y];
  const pt = pointAlong(leg.path, Math.min(leg.length, c.traveled) * (leg.path.length > 1 ? 1 : 0) / (c.orders.avoidLawless ? 1.2 : 1));
  return [pt.x, pt.y];
}

/** Ships on the water for a caravan near a captain: her cargo hulls in a column and her escorts. */
function materialize(game: Game, c: Caravan): void {
  if (c.entities.length) return;
  const leg = c.legs[c.leg];
  if (!leg) return;
  const S = cs(game);
  const base = c.traveled / (c.orders.avoidLawless ? 1.2 : 1);
  // The rest of the leg from where she is.
  const at = pointAlong(leg.path, base);
  const rest: Path = [[at.x, at.y], ...leg.path.slice(at.index + 1)];
  const lvl = level(c);
  c.ships.forEach((x, i) => {
    const e = game.spawnNpcShip('merchant', x.loadout.classId, 'free', at.x - Math.sin(at.heading) * 160 * i, at.y + Math.cos(at.heading) * 160 * i, at.heading, { ship: c.name, captain: c.skipper });
    game.setNpcLevel(e, shipLevelOf(x.loadout));
    e.hull = e.stats.hullMax * Math.max(0.1, x.hull);
    e.caravanId = c.id;
    e.caravanOf = null;
    const b = game.npcs.get(e.id)!;
    setPath(b, rest);
    b.destPort = null;
    b.active = true;
    c.entities.push(e.id);
  });
  for (let i = 0; i < c.escorts; i++) {
    const e = game.spawnNpcShip('patrol', S.rng.pick(hullsFor('patrol', lvl)), 'free', at.x + 120 * (i + 1), at.y, at.heading, { ship: `${c.name}`, captain: 'Escort Master' });
    game.setNpcLevel(e, lvl);
    e.caravanId = c.id;
    const b = game.npcs.get(e.id)!;
    b.leader = c.entities[0];
    b.slot = i + 1;
    c.entities.push(e.id);
  }
  c.farSince = game.now;
}

/** Back into a line on the chart: hulls' state written back (a sunk one is gone with her share of the cargo). */
function dematerialize(game: Game, c: Caravan): void {
  if (!c.entities.length) return;
  const lead = game.ships.get(c.entities[0]);
  if (lead?.alive) {
    const b = game.npcs.get(lead.id);
    if (b) c.traveled = Math.max(c.traveled, b.traveled * (c.orders.avoidLawless ? 1.2 : 1));
  }
  const cargoShips = c.ships.length;
  for (let i = 0; i < cargoShips; i++) {
    const e = game.ships.get(c.entities[i]);
    if (e?.alive) c.ships[i].hull = e.hull / Math.max(1, e.stats.hullMax);
  }
  for (const id of c.entities) game.removeShip(id);
  c.entities = [];
}

/** A caravan's hull gone down on the water (from beginSinking): her part of the cargo with her. */
export function caravanShipLost(game: Game, ship: ShipEntity): void {
  const c = ship.caravanId ? caravans(game)[ship.caravanId] : undefined;
  if (!c) return;
  const i = c.entities.indexOf(ship.id);
  if (i < 0 || i >= c.ships.length) return;
  const share = 1 / c.ships.length;
  const lost: Cargo = {};
  for (const [g, n] of Object.entries(c.cargo) as [GoodId, number][]) {
    const k = Math.floor(n * share);
    lost[g] = k;
    c.cargo[g] = n - k;
  }
  c.ships.splice(i, 1);
  c.entities.splice(i, 1);
  payInsurance(game, c, value(lost));
  touch(game);
}

function payInsurance(game: Game, c: Caravan, lost: number): void {
  if (!c.insured || lost <= 0) return;
  const pay = Math.round(lost * INSURANCE_COVER);
  const s = game.sessionByAccount(c.owner);
  if (s?.profile) s.profile.gold += pay;
  else {
    const h = ownIsland(game, c.owner);
    if (h) h.treasury += pay;
  }
  game.db.ledger(c.owner, 'caravan_claim', pay, c.id);
  mail(game, c, `The League pays ${pay} silver on the insurance of ${c.name}.`);
}

function mail(game: Game, c: Caravan, line: string): void {
  note(c, line);
  const s = game.sessionByAccount(c.owner);
  if (s) game.sendTo(s, { t: 'toast', msg: line, kind: 'info' });
  deliver(game, c.owner, { from: `Skipper ${c.skipper}`, subject: c.name, body: line, gold: 0, goods: null });
}

/** The sea's pirates fall on a caravan: reckoned far from her owner, fought for real near her. */
function rollAttack(game: Game, c: Caravan): void {
  const S = cs(game);
  if (game.now < c.nextRoll || c.attack) return;
  c.nextRoll = game.now + 60;
  if (!game.directorOn) return;
  const [x, y] = here(game, c);
  const region = regionAt(game.world, x, y);
  let risk = RISK[REGIONS[region].safety] ?? 0;
  if (c.orders.avoidLawless && REGIONS[region].safety === 'lawless') risk *= 0.3;
  if (c.orders.nightInPort) risk *= 0.6;
  const h = game.holdings.get(game, c.island);
  if (h && has(h, 'signal_tower') && island(game, c.island)?.region === region) risk *= 0.67;
  if (c.skipperRec?.traits.includes('wary')) risk *= SKIPPER_RISK;
  if (!S.rng.chance(risk / 60)) return;
  attackNow(game, c);
}

/** An attack on a caravan now (the roll's, or a test's). */
export function attackNow(game: Game, c: Caravan): void {
  const [x, y] = here(game, c);
  const nearOwner = game.sessionByAccount(c.owner)?.ship;
  const nameAt = game.nearestIslandName(x, y);
  const nem = caravanNemesis(game, c.owner); // her nemesis, now and then (docs/12 P10 #1)
  if (nearOwner && !nearOwner.docked && dist(nearOwner.state.x, nearOwner.state.y, x, y) < RESCUE_R) {
    materialize(game, c);
    if (nem) {
      const lead = game.ships.get(c.entities[0]);
      if (lead && !liveNamed(game).some((l) => l.id === nem.np.id)) putToSea(game, nem.np, nearOwner);
      game.sendTo(game.sessionByAccount(c.owner)!, { t: 'toast', msg: caravanNemesisLine(nem.np, nem.rec, c.name, nameAt), kind: 'bad' });
    }
    const pirates: number[] = [];
    for (let i = 0; i < 2 + (cs(game).rng.chance(0.4) ? 1 : 0); i++) {
      const sp = spawnPirate(game);
      if (!sp) break;
      const a = cs(game).rng.float() * Math.PI * 2;
      sp.state.x = x + Math.sin(a) * 600;
      sp.state.y = y - Math.cos(a) * 600;
      game.grid.upsert(sp.id, sp.state.x, sp.state.y);
      const lead = game.ships.get(c.entities[0]);
      const b = game.npcs.get(sp.id);
      if (b && lead) b.chase = { id: lead.id, until: game.now + RESCUE_SEC };
      pirates.push(sp.id);
    }
    c.attack = { until: game.now + RESCUE_SEC, pirates };
    const line = `Caravan ${c.name} is attacked near ${nameAt}: come to the rescue — five minutes!`;
    note(c, line);
    game.sendTo(game.sessionByAccount(c.owner)!, { t: 'toast', msg: line, kind: 'bad' });
    touch(game);
    return;
  }
  if (nem) mail(game, c, caravanNemesisLine(nem.np, nem.rec, c.name, nameAt));
  resolveAttack(game, c, nameAt, nem ? 1 + 0.25 * nem.rec.rank : 1);
}

/** An attack reckoned: escorts and hulls against the pirates, with luck; the standing orders decide the rest. */
function resolveAttack(game: Game, c: Caravan, nameAt: string, strength = 1): void {
  const S = cs(game);
  const [x, y] = here(game, c);
  const region = regionAt(game.world, x, y);
  const lvl = level(c);
  const band = sectorLevel(game, x, y); // the square of the sea she is in (docs/16 P2)
  const win = defenceOdds({ escorts: c.escorts, ships: c.ships.length, level: lvl, band, pirates: S.rng.int(2, 3), flee: c.orders.onAttack === 'flee', strength });
  if (S.rng.chance(win)) {
    mail(game, c, `Caravan ${c.name} fought them off near ${nameAt}.`);
    return;
  }
  const before = value(c.cargo);
  let shipsLost = 0;
  const take = (share: number) => {
    for (const g of Object.keys(c.cargo) as GoodId[]) {
      c.cargo[g] = Math.floor((c.cargo[g] ?? 0) * (1 - share));
      if (!c.cargo[g]) delete c.cargo[g];
    }
  };
  switch (c.orders.onAttack) {
    case 'fight':
    case 'flee':
      if (c.orders.onAttack === 'flee' && S.rng.chance(0.5)) take(0.2);
      else {
        shipsLost = 1;
        take(1 / c.ships.length);
        c.ships.splice(S.rng.int(0, c.ships.length - 1), 1);
        take(0.3);
      }
      break;
    case 'dump':
      take(0.4);
      break;
    case 'surrender':
      take(0.6);
      break;
  }
  const lost = before - value(c.cargo);
  const saved = before > 0 ? Math.round((value(c.cargo) / before) * 100) : 100;
  if (!c.ships.length) {
    mail(game, c, `Caravan ${c.name} is lost with all hands.`);
    payInsurance(game, c, before);
    dematerialize(game, c);
    delete caravans(game)[c.id];
    touch(game);
    return;
  }
  mail(game, c, `Caravan ${c.name} was beaten near ${nameAt}: ${shipsLost} ships lost, ${saved}% of the cargo saved.`);
  payInsurance(game, c, lost);
  touch(game);
}

// ------------------------------------------------------------------------------------------------ the stops

function neutralMods(): PriceMods {
  return { buyMul: 1, sellMul: 1, lawfulPort: false, honest: false, duty: 0, goodSell: {}, goodBuy: {} };
}

function arriveAt(game: Game, c: Caravan, stop: Stop): void {
  const s = game.sessionByAccount(c.owner);
  if (stop.kind === 'outpost') {
    const o = outposts(game)[stop.id];
    if (!o) return;
    const v0 = value(c.cargo);
    for (const [g, n] of Object.entries(o.store) as [GoodId, number][]) {
      const k = Math.min(Math.floor(n), Math.floor(room(c) / GOODS[g].volume));
      if (k <= 0) continue;
      c.cargo[g] = (c.cargo[g] ?? 0) + k;
      o.store[g] = n - k;
      if ((o.store[g] ?? 0) < 1) delete o.store[g];
    }
    insure(game, s, c, value(c.cargo) - v0);
    note(c, `Caravan ${c.name} took on the store of the outpost on ${island(game, o.island)?.name ?? ''}.`);
    return;
  }
  if (stop.kind === 'isle') {
    const h = game.holdings.get(game, c.island);
    if (!h) return;
    for (const [g, n] of Object.entries(c.cargo) as [GoodId, number][]) {
      const free = Math.floor((storeCapacity(h) - cargoVolume(h.store)) / GOODS[g].volume);
      const k = Math.max(0, Math.min(free, n));
      if (k > 0) h.store[g] = (h.store[g] ?? 0) + k;
      c.cargo[g] = n - k;
      if (!c.cargo[g]) delete c.cargo[g];
    }
    game.holdings.touch();
    return;
  }
  const port = game.portById(stop.id);
  const market = port ? game.markets.get(port.id) : undefined;
  if (!port || !market) return;
  const mods = neutralMods();
  const sellAll = (floor: number, profitMul = 1) => {
    for (const [g, n] of Object.entries(c.cargo) as [GoodId, number][]) {
      const gm = market.goods[g];
      if (!gm || n <= 0) continue;
      if (midPrice(g, gm) < GOODS[g].basePrice * floor) {
        note(c, `${c.name} will not sell below ${Math.round(GOODS[g].basePrice * floor)}: the goods come home.`);
        continue;
      }
      const t = c.skipperRec?.traits ?? [];
      const got = Math.round(quoteSell(g, gm, n, mods) * profitMul * (t.includes('trader') ? SKIPPER_SALE : 1) * (t.includes('light_fingered') ? SKIPPER_SKIM : 1));
      applyTrade(market, g, n);
      delete c.cargo[g];
      if (s?.profile) s.profile.gold += got;
      else {
        const h = ownIsland(game, c.owner);
        if (h) h.treasury += got;
      }
      game.db.ledger(c.owner, 'caravan_sale', got, `${n} ${g} ${port.id}`);
      note(c, `Caravan ${c.name} sold ${n} ${GOODS[g].name.toLowerCase()} in ${port.name} for ${got} silver.`);
    }
  };
  switch (stop.act) {
    case 'sell':
      sellAll(c.minPrice);
      break;
    case 'trade_sell':
      sellAll(0, 1 + (s?.ship?.hasFlag('counting_house') ? COUNTING_HOUSE_PROFIT : 0));
      break;
    case 'buy':
    case 'trade_buy': {
      // Supply: the listed goods for the island, paid from its treasury; trade: the best good for the next port.
      const h = ownIsland(game, c.owner);
      let list: GoodId[] = c.goods;
      if (stop.act === 'trade_buy') {
        const to = c.port2 ? game.portById(c.port2) : undefined;
        const r = to ? bestRoute(port, game.markets, [to], () => cs(game).rng.float(), 999999) : null;
        list = r ? [r.good] : [];
        c.tradeGood = r?.good ?? null;
      }
      const v0 = value(c.cargo);
      for (const g of list) {
        const gm = market.goods[g];
        if (!gm) continue;
        let k = Math.min(Math.floor(room(c) / GOODS[g].volume), Math.floor(gm.stock * 0.5));
        if (k <= 0) continue;
        let cost = quoteBuy(g, gm, k, mods);
        const purse = stop.act === 'buy' ? h?.treasury ?? 0 : s?.profile?.gold ?? h?.treasury ?? 0;
        while (k > 0 && cost > purse) {
          k = Math.floor(k * 0.7);
          cost = quoteBuy(g, gm, k, mods);
        }
        if (k <= 0) continue;
        if (stop.act === 'buy' && h) h.treasury -= cost;
        else if (s?.profile) s.profile.gold -= cost;
        else if (h) h.treasury -= cost;
        applyTrade(market, g, -k);
        c.cargo[g] = (c.cargo[g] ?? 0) + k;
        game.db.ledger(c.owner, 'caravan_buy', -cost, `${k} ${g} ${port.id}`);
        note(c, `Caravan ${c.name} bought ${k} ${GOODS[g].name.toLowerCase()} in ${port.name}.`);
      }
      insure(game, s, c, value(c.cargo) - v0);
      game.holdings.touch();
      break;
    }
  }
}

function finish(game: Game, c: Caravan): void {
  dematerialize(game, c);
  const s = game.sessionByAccount(c.owner);
  if (c.orders.repeat && plan(game, c)) {
    if (c.task === 'sell') {
      // A standing sale takes the island's goods again.
      const h = game.holdings.get(game, c.island);
      if (h) for (const g of c.goods.length ? c.goods : (Object.keys(h.store) as GoodId[])) {
        const k = Math.min(h.store[g] ?? 0, Math.floor(room(c) / GOODS[g].volume));
        if (k <= 0) continue;
        c.cargo[g] = (c.cargo[g] ?? 0) + k;
        h.store[g] = (h.store[g] ?? 0) - k;
        if (!h.store[g]) delete h.store[g];
      }
    }
    touch(game);
    return;
  }
  // Home: her own skipper back to her pool — or, of low loyalty, gone with a hull (docs/12 P10 #16).
  if (c.skipperRec) {
    const took = skipperHome(game, c.owner, c.skipperRec, c.ships);
    if (took >= 0) c.ships.splice(took, 1);
  }
  // The hulls to their berths, what she could not unload with them.
  const p = s?.profile;
  const key = `isle:${c.island}`;
  if (p) for (const x of c.ships) p.berths.push({ port: key, loadout: x.loadout, hull: x.hull });
  else pendingBerths(game, c.owner, c.ships.map((x) => ({ port: key, loadout: x.loadout, hull: x.hull })));
  delete caravans(game)[c.id];
  touch(game);
  if (s) game.sendTo(s, { t: 'toast', msg: `Caravan ${c.name} is home.`, kind: 'good' });
  deliver(game, c.owner, { from: `Skipper ${c.skipper}`, subject: c.name, body: `Caravan ${c.name} is home.\n\n${c.log.join('\n')}`, gold: 0, goods: null });
}

/** Berths waiting for an owner who was away when her caravan came home. */
function pendingBerths(game: Game, account: number, list: { port: string; loadout: ShipLoadout; hull: number }[]): void {
  const all = game.db.getKv<Record<string, { port: string; loadout: ShipLoadout; hull: number }[]>>('caravan_berths') ?? {};
  all[account] = [...(all[account] ?? []), ...list];
  game.db.setKv('caravan_berths', all);
}

/** On a captain's return: the hulls that came home while she was away. */
export function claimBerths(game: Game, s: PlayerSession): void {
  const all = game.db.getKv<Record<string, { port: string; loadout: ShipLoadout; hull: number }[]>>('caravan_berths');
  const mine = all?.[s.accountId];
  if (!mine?.length || !s.profile) return;
  s.profile.berths.push(...mine);
  delete all![s.accountId];
  game.db.setKv('caravan_berths', all!);
}

// ------------------------------------------------------------------------------------------------ the second

export function stepCaravans(game: Game): void {
  const S = cs(game);
  const night = isNight(game.now);
  for (const c of Object.values(caravans(game))) {
    const isl = island(game, c.island);
    if (!isl || (game.zone && !game.zone.regions.has(isl.region))) continue;
    const leg = c.legs[c.leg];
    if (!leg) {
      // Home, but the island's store is full: she lies at anchor with the rest until there is room.
      if (Object.keys(c.cargo).length && !c.orders.repeat) {
        arriveAt(game, c, { kind: 'isle' });
        if (Object.keys(c.cargo).length) {
          if (!c.log.some((l) => l.startsWith('The island’s store is full'))) mail(game, c, `The island’s store is full: caravan ${c.name} lies at anchor with the rest.`);
          continue;
        }
      }
      finish(game, c);
      continue;
    }
    // Near a captain: ships on the water; far from all: a line on the chart.
    const [x, y] = here(game, c);
    let near = false;
    for (const s of game.sessions) if (s.ship && !s.ship.docked && dist(s.ship.state.x, s.ship.state.y, x, y) < 6000) {
      near = true;
      break;
    }
    if (near) {
      materialize(game, c);
      c.farSince = game.now;
    } else if (c.entities.length && game.now - c.farSince > 30 && !c.attack) dematerialize(game, c);
    if (c.entities.length) {
      // Afloat: the lead's own progress (a sunk lead hands the column to the next).
      c.entities = c.entities.filter((id) => game.ships.get(id)?.alive);
      if (!c.ships.length) {
        mail(game, c, `Caravan ${c.name} is lost with all hands.`);
        for (const id of c.entities) game.removeShip(id);
        delete caravans(game)[c.id];
        touch(game);
        continue;
      }
      const lead = game.ships.get(c.entities[0]);
      const b = lead ? game.npcs.get(lead.id) : undefined;
      if (lead && b) {
        const done = dist(lead.state.x, lead.state.y, leg.path[leg.path.length - 1][0], leg.path[leg.path.length - 1][1]) < 250 || b.traveled >= b.length - 5;
        if (done) c.traveled = leg.length;
      }
    } else if (!(c.orders.nightInPort && night)) c.traveled += speedOf(game, c);
    // The live fight near her owner.
    if (c.attack) {
      const alive = c.attack.pirates.filter((id) => game.ships.get(id)?.alive);
      if (!alive.length) {
        c.attack = null;
        mail(game, c, `Caravan ${c.name} fought them off near ${game.nearestIslandName(x, y)}.`);
      } else if (game.now > c.attack.until) {
        for (const id of alive) game.removeShip(id);
        c.attack = null;
        resolveAttack(game, c, game.nearestIslandName(x, y));
      }
    } else rollAttack(game, c);
    if (!caravans(game)[c.id]) continue;
    if (c.traveled >= leg.length) {
      dematerialize(game, c);
      arriveAt(game, c, leg.stop);
      c.leg++;
      c.traveled = 0;
      touch(game);
    }
  }
  if (Math.floor(game.now) % 5 === 0) for (const s of game.sessions) sendCaravans(game, s);
  if (Math.floor(game.now) % 60 === 0 && S.dirty) {
    S.dirty = false;
    game.db.setKv('caravans', caravans(game));
  }
}

// ------------------------------------------------------------------------------------------------ what she sees

export function caravanViews(game: Game, s: PlayerSession): CaravanView[] {
  return Object.values(caravans(game)).filter((c) => c.owner === s.accountId).map((c) => {
    const leg = c.legs[c.leg];
    const [x, y] = here(game, c);
    const rest = leg ? leg.length - c.traveled : 0;
    let eta = rest;
    for (let i = c.leg + 1; i < c.legs.length; i++) eta += c.legs[i].length;
    const sp = Math.max(0.1, speedOf(game, c));
    const path = leg ? leg.path.filter((_, i) => i % 3 === 0 || i === leg.path.length - 1).map(([px, py]) => [Math.round(px), Math.round(py)] as [number, number]) : [];
    return {
      id: c.id, name: c.name, task: c.task, skipper: c.skipper, ships: c.ships.map((x) => x.loadout.classId), escorts: c.escorts, level: level(c),
      from: c.leg > 0 ? labelOf(game, c, c.legs[c.leg - 1].stop) : island(game, c.island)?.name ?? '', to: leg ? labelOf(game, c, leg.stop) : '',
      progress: leg ? Math.round((c.traveled / Math.max(1, leg.length)) * 100) / 100 : 1, eta: Math.round(eta / sp), x: Math.round(x), y: Math.round(y), path,
      cargo: Object.entries(c.cargo).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => ({ good: g as GoodId, n: n ?? 0 })), attack: c.attack ? Math.max(0, Math.round(c.attack.until - game.now)) : null,
      log: c.log.slice(-3), repeat: c.orders.repeat, insured: c.insured, onAttack: c.orders.onAttack,
    };
  });
}

export function sendCaravans(game: Game, s: PlayerSession, force = false): void {
  if (!s.profile) return;
  const S = cs(game);
  const list = caravanViews(game, s);
  const key = JSON.stringify(list) + caravanSlots(game, s);
  if (!force && S.sent.get(s.accountId) === key) return;
  S.sent.set(s.accountId, key);
  game.sendTo(s, { t: 'caravans', list, slots: caravanSlots(game, s) });
}

export function caravanById(game: Game, id: string): Caravan | undefined {
  return caravans(game)[id];
}

export function clearCaravans(game: Game): void {
  const S = cs(game);
  for (const c of Object.values(caravans(game))) for (const id of c.entities) game.removeShip(id);
  S.all = {};
}

