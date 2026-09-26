// Port services: market, chandlery (ammo), tavern (crew, rumours), shipyard, contracts board,
// harbour master (pardons, insurance). Every action is validated against the docked port.

import { GOODS, GOOD_IDS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { AMMO, AMMO_IDS, GUNS, GUN_IDS, MODULES, MODULE_IDS, SHIP_CLASSES, SHIP_CLASS_IDS, defaultGunFor, moduleCost } from '../../../shared/src/data/ships.ts';
import type { AmmoId, GunId, ModuleId, ShipClassId } from '../../../shared/src/data/ships.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Contract, PortView, Side } from '../../../shared/src/protocol.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { Island, Port } from '../../../shared/src/world/worldgen.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { marketRows, midPrice, portIsLawful, quoteBuy, quoteSell, applyTrade } from './economy.ts';
import type { PriceMods } from './economy.ts';
import type { Game } from './Game.ts';
import { poiRumor } from './exploration.ts';
import type { PlayerSession, Profile } from './player.ts';
import { pardonCost } from './player.ts';
import type { ShipEntity } from './ship.ts';

export function priceMods(ship: ShipEntity, port: Port): PriceMods {
  return {
    buyMul: ship.stats.buyMul * (ship.captain === 'drowned' && port.faction === 'crown' ? 1.2 : 1),
    sellMul: ship.stats.sellMul,
    lawfulPort: portIsLawful(port),
    honest: ship.hasFlag('honest_merchant'),
  };
}

export function ammoPrice(game: Game, port: Port, ammo: AmmoId): number {
  const m = game.markets.get(port.id);
  const powder = m?.goods.gunpowder;
  const iron = m?.goods.iron;
  const pf = powder ? midPrice('gunpowder', powder) / GOODS.gunpowder.basePrice : 1.2;
  const irf = iron ? midPrice('iron', iron) / GOODS.iron.basePrice : 1.1;
  return Math.max(1, Math.round(AMMO[ammo].price * (0.5 * pf + 0.5 * irf) * 10) / 10);
}

function shipValue(ship: ShipEntity): number {
  let v = SHIP_CLASSES[ship.loadout.classId].price;
  for (const id of MODULE_IDS) {
    const lvl = ship.loadout.modules[id] ?? 0;
    for (let l = 1; l <= lvl; l++) v += moduleCost(id, l, ship.cls.tier) * 0.5;
  }
  return v;
}

export function repairCost(ship: ShipEntity): number {
  const tier = ship.cls.tier;
  const hull = (ship.stats.hullMax - ship.hull) * (0.45 + tier * 0.1);
  const sails = (ship.stats.sailHpMax - ship.sails) * 1.4;
  const rudder = (1 - ship.rudderHp) * 180 * tier;
  const guns = (ship.gunsDisabled.port * GUNS[ship.loadout.guns.port].price + ship.gunsDisabled.starboard * GUNS[ship.loadout.guns.starboard].price) * 0.3;
  return Math.ceil(Math.max(0, hull + sails + rudder + guns));
}

export function buildPortView(game: Game, s: PlayerSession, port: Port): PortView {
  const ship = s.ship!;
  const p = s.profile!;
  const market = game.markets.get(port.id)!;
  const mods = priceMods(ship, port);
  const ammoPrices = {} as Record<AmmoId, number>;
  for (const a of AMMO_IDS) ammoPrices[a] = ammoPrice(game, port, a);
  const tier = port.shipyardTier;
  const view: PortView = {
    portId: port.id,
    market: marketRows(market, mods),
    ammoPrices,
    crewAvailable: Math.floor(game.tavernCrew.get(port.id) ?? 0),
    crewHireCost: crewCost(port, p),
    shipyard: {
      tier,
      repairCost: repairCost(ship),
      ships: SHIP_CLASS_IDS.filter((id) => SHIP_CLASSES[id].purchasable && SHIP_CLASSES[id].tier <= tier).map((id) => ({
        classId: id, price: SHIP_CLASSES[id].price, tradeIn: Math.round(shipValue(ship) * 0.6),
      })),
      modules: MODULE_IDS.filter((m) => !(m === 'figurehead_kraken' && tier < 2)).map((m) => {
        const level = ship.loadout.modules[m] ?? 0;
        return { module: m, level, cost: level >= MODULES[m].maxLevel ? 0 : moduleCost(m, level + 1, ship.cls.tier), max: MODULES[m].maxLevel };
      }),
      guns: GUN_IDS.filter((g) => GUNS[g].minTier <= Math.max(tier, 1) && GUNS[g].minTier <= ship.cls.tier).map((g) => ({ gun: g, cost: GUNS[g].price * ship.stats.gunsPerSide })),
    },
    contracts: game.contractsAt(port.id),
    rumors: [poiRumor(game, s, port), ...game.rumorsNear(port.x, port.y, 3)].filter((r): r is string => !!r),
    charts: chartView(game, s, port),
    pardonCost: port.faction === 'free' || port.faction === 'brokers' || port.faction === 'confederacy' ? pardonCost(p) : null,
  };
  if (ship.hasFlag('market_sense')) {
    const intel: NonNullable<PortView['priceIntel']> = [];
    for (const pid in p.priceIntel) {
      if (pid === port.id) continue;
      const rec = p.priceIntel[pid];
      const other = game.portById(pid);
      if (!other) continue;
      for (const g in rec.sell) intel.push({ portId: pid, name: other.name, good: g as GoodId, sell: rec.sell[g as GoodId] ?? 0, ageSec: Math.round(game.now - rec.t) });
    }
    view.priceIntel = intel.sort((a, b) => b.sell - a.sell).slice(0, 40);
  }
  return view;
}

function crewCost(port: Port, p: Profile): number {
  return Math.round(22 + p.level * 1.5 + (port.size >= 3 ? 6 : 0) + (FACTIONS[port.faction].lawful ? 4 : 0));
}

export function recordIntel(game: Game, s: PlayerSession, port: Port): void {
  const ship = s.ship!;
  const market = game.markets.get(port.id);
  if (!market) return;
  const rows = marketRows(market, priceMods(ship, port));
  const sell: Partial<Record<GoodId, number>> = {};
  for (const r of rows) sell[r.good] = r.sell;
  s.profile!.priceIntel[port.id] = { t: game.now, sell };
}

// ------------------------------------------------------------------ transactions

export function trade(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  if (!GOOD_IDS.includes(good)) return 'Unknown good';
  if (!Number.isInteger(qty) || qty === 0 || Math.abs(qty) > 500) return 'Bad quantity';
  const market = game.markets.get(port.id)!;
  const gm = market.goods[good];
  if (!gm) return `${port.name} does not trade ${GOODS[good].name}`;
  const def = GOODS[good];
  if (def.contraband && !port.blackMarket) return 'Contraband cannot be traded here';
  const mods = priceMods(ship, port);
  if (qty > 0) {
    if (gm.stock < qty) return 'Not enough in stock';
    const price = quoteBuy(good, gm, qty, mods);
    if (p.gold < price) return 'Not enough silver';
    const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul);
    const need = qty * def.volume * (def.contraband ? ship.stats.contrabandVolumeMul : 1);
    if (need > free + 1e-6) return 'Not enough room in the hold';
    p.gold -= price;
    const prevQty = ship.cargo[good] ?? 0;
    const prevBasis = game.costBasis(s, good);
    ship.cargo[good] = prevQty + qty;
    game.setCostBasis(s, good, (prevBasis * prevQty + price) / (prevQty + qty));
    applyTrade(market, good, -qty);
    game.db.ledger(s.accountId, 'buy', -price, `${qty} ${good} @ ${port.id}`);
    return null;
  }
  const n = -qty;
  if ((ship.cargo[good] ?? 0) < n) return 'You do not carry that much';
  const price = quoteSell(good, gm, n, mods);
  const basis = game.costBasis(s, good);
  ship.cargo[good] = (ship.cargo[good] ?? 0) - n;
  if (!ship.cargo[good]) delete ship.cargo[good];
  p.gold += price;
  applyTrade(market, good, n);
  const profit = price - basis * n;
  p.stats.tradeProfit += Math.max(0, profit);
  if (profit > 0) game.grantXp(s, profit / 5, null);
  // Trade builds standing with the port's faction.
  game.adjustRepProfile(s, port.faction, Math.min(3, price / 1500));
  game.db.ledger(s.accountId, 'sell', price, `${n} ${good} @ ${port.id}`);
  game.checkDeliveries(s, port);
  return null;
}

export function buyAmmo(game: Game, s: PlayerSession, port: Port, ammo: AmmoId, qty: number): string | null {
  const ship = s.ship!;
  if (!AMMO_IDS.includes(ammo) || !Number.isInteger(qty) || qty <= 0 || qty > 500) return 'Bad order';
  const cost = Math.ceil(ammoPrice(game, port, ammo) * qty);
  if (s.profile!.gold < cost) return 'Not enough silver';
  s.profile!.gold -= cost;
  ship.ammo[ammo] += qty;
  return null;
}

export function hireCrew(game: Game, s: PlayerSession, port: Port, qty: number): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  if (!Number.isInteger(qty) || qty === 0 || Math.abs(qty) > 400) return 'Bad number';
  if (qty < 0) {
    // Discharge sailors (they leave in port).
    ship.crew = Math.max(1, ship.crew + qty);
    return null;
  }
  const avail = Math.floor(game.tavernCrew.get(port.id) ?? 0);
  const room = ship.stats.crewMax - ship.crew;
  const n = Math.min(qty, avail, room);
  if (n <= 0) return room <= 0 ? 'No hammocks left aboard' : 'No sailors looking for a berth here';
  const cost = n * crewCost(port, p);
  if (p.gold < cost) return 'Not enough silver';
  p.gold -= cost;
  ship.morale = (ship.morale * ship.crew + 62 * n) / (ship.crew + n);
  ship.crew += n;
  game.tavernCrew.set(port.id, avail - n);
  return null;
}

export function shipyardRepair(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const cost = repairCost(ship);
  if (cost <= 0) return 'She is already sound';
  const p = s.profile!;
  if (p.gold < cost) return `Repairs cost ${cost} silver`;
  p.gold -= cost;
  ship.hull = ship.stats.hullMax;
  ship.sails = ship.stats.sailHpMax;
  ship.rudderHp = 1;
  ship.gunsDisabled = { port: 0, starboard: 0 };
  game.db.ledger(s.accountId, 'repair', -cost, ship.loadout.classId);
  return null;
}

export function shipyardModule(game: Game, s: PlayerSession, port: Port, module: ModuleId): string | null {
  const ship = s.ship!;
  const def = MODULES[module];
  if (!def) return 'Unknown module';
  if (module === 'figurehead_kraken' && port.shipyardTier < 2) return 'This yard has no carver for that';
  const level = ship.loadout.modules[module] ?? 0;
  if (level >= def.maxLevel) return 'Already fully fitted';
  const cost = moduleCost(module, level + 1, ship.cls.tier);
  if (s.profile!.gold < cost) return `Needs ${cost} silver`;
  s.profile!.gold -= cost;
  ship.loadout.modules[module] = level + 1;
  const hullFrac = ship.hull / ship.stats.hullMax;
  ship.recompute(game.now);
  ship.hull = Math.round(ship.stats.hullMax * hullFrac);
  game.db.ledger(s.accountId, 'module', -cost, module);
  return null;
}

export function shipyardGuns(game: Game, s: PlayerSession, port: Port, side: Side, gun: GunId): string | null {
  const ship = s.ship!;
  const def = GUNS[gun];
  if (!def || (side !== 'port' && side !== 'starboard')) return 'Unknown gun';
  if (def.minTier > ship.cls.tier) return `${ship.cls.name} decks cannot carry ${def.name}s`;
  if (def.minTier > Math.max(1, port.shipyardTier)) return 'This yard cannot supply that gun';
  const old = GUNS[ship.loadout.guns[side]];
  if (old.id === gun) return 'Already mounted';
  const n = ship.stats.gunsPerSide;
  const cost = Math.max(0, Math.round(def.price * n - old.price * n * 0.5));
  if (s.profile!.gold < cost) return `Needs ${cost} silver`;
  s.profile!.gold -= cost;
  ship.loadout.guns[side] = gun;
  ship.gunsDisabled[side] = 0;
  ship.recompute(game.now);
  return null;
}

export function shipyardBuy(game: Game, s: PlayerSession, port: Port, classId: ShipClassId): string | null {
  const ship = s.ship!;
  const def = SHIP_CLASSES[classId];
  if (!def || !def.purchasable) return 'Not for sale';
  if (def.tier > port.shipyardTier) return `${port.name} cannot build a ${def.name}`;
  if (classId === ship.loadout.classId) return 'You already sail one';
  const tradeIn = Math.round(shipValue(ship) * 0.6);
  const cost = Math.max(0, def.price - tradeIn);
  const p = s.profile!;
  if (p.gold < cost) return `Needs ${cost} silver after trade-in`;
  const gun = defaultGunFor(def);
  const newLoadout = { classId, name: ship.loadout.name, guns: { port: gun, starboard: gun }, modules: {} };
  p.gold -= cost;
  ship.loadout = newLoadout;
  p.loadout = newLoadout;
  ship.gunsDisabled = { port: 0, starboard: 0 };
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.sails = ship.stats.sailHpMax;
  ship.rudderHp = 1;
  if (cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul) > ship.stats.holdVolume) {
    // Excess cargo is sold to the yard at a poor price rather than silently vanishing.
    let excess = cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul) - ship.stats.holdVolume;
    for (const id of Object.keys(ship.cargo) as GoodId[]) {
      while (excess > 0 && (ship.cargo[id] ?? 0) > 0) {
        ship.cargo[id]! -= 1;
        excess -= GOODS[id].volume;
        p.gold += Math.floor(GOODS[id].basePrice * 0.5);
      }
      if (!ship.cargo[id]) delete ship.cargo[id];
    }
  }
  game.db.ledger(s.accountId, 'ship', -cost, classId);
  return null;
}

export function pardon(game: Game, s: PlayerSession, port: Port): string | null {
  if (!(port.faction === 'free' || port.faction === 'brokers' || port.faction === 'confederacy')) return 'No one here sells pardons';
  const p = s.profile!;
  if (p.infamy < 20) return 'You are not wanted';
  const cost = pardonCost(p);
  if (p.gold < cost) return `Forged letters of pardon cost ${cost} silver`;
  p.gold -= cost;
  p.infamy = 10;
  game.db.ledger(s.accountId, 'pardon', -cost, port.id);
  return null;
}

// ------------------------------------------------------------------ contracts

let contractSeq = 1;

export function generateContracts(game: Game, port: Port): Contract[] {
  const out: Contract[] = [];
  const rng = game.rng;
  const now = game.now;
  const others = game.world.ports.filter((p) => p.id !== port.id && dist(p.x, p.y, port.x, port.y) < 32000 && dist(p.x, p.y, port.x, port.y) > 4000);
  const lawful = FACTIONS[port.faction].lawful;
  for (let i = 0; i < 4; i++) {
    const kind = rng.weighted<Contract['kind']>([['delivery', 3], ['courier', 1.5], ['bounty', lawful ? 2 : 0.2]]);
    if (kind === 'bounty') {
      const kills = rng.int(1, 3);
      out.push({
        id: `c${contractSeq++}`, kind, title: `Bounty: ${kills} pirate ship${kills > 1 ? 's' : ''}`, fromPort: port.id, targetFaction: 'confederacy', kills, progress: 0,
        reward: 320 * kills + rng.int(0, 150), xp: 180 * kills, expiresAt: now + 3600,
        description: `The ${FACTIONS[port.faction].short} pays for every Red Tide hull sunk or taken. Bring proof — or don't come back.`,
      });
      continue;
    }
    if (!others.length) continue;
    const dest = rng.pick(others);
    const d = dist(dest.x, dest.y, port.x, port.y);
    if (kind === 'courier') {
      out.push({
        id: `c${contractSeq++}`, kind, title: `Sealed letters to ${dest.name}`, fromPort: port.id, toPort: dest.id,
        reward: Math.round(120 + d / 55), xp: Math.round(60 + d / 120), expiresAt: now + 1800 + d / 8,
        description: `Wax-sealed dispatches for ${dest.name}. No questions, no delays.`,
      });
      continue;
    }
    const wants = Object.keys(dest.profile.consumes).filter((g) => !GOODS[g as GoodId].contraband) as GoodId[];
    if (!wants.length) continue;
    const good = rng.pick(wants);
    const qty = rng.int(6, 18);
    out.push({
      id: `c${contractSeq++}`, kind: 'delivery', title: `Deliver ${qty} ${GOODS[good].name} to ${dest.name}`, fromPort: port.id, toPort: dest.id, good, qty,
      reward: Math.round(qty * GOODS[good].basePrice * (0.35 + d / 30000)), xp: Math.round(qty * 6 + d / 100), expiresAt: now + 2400 + d / 6,
      description: `${dest.name} is short of ${GOODS[good].name.toLowerCase()}. Buy it anywhere — the buyer pays on delivery, on top of market price.`,
    });
  }
  return out;
}

// ------------------------------------------------------------------ cartography: information is a resource

/** Silver a cartographer pays for a fresh chart of one island. */
export function islandChartValue(is: Island, port: Port): number {
  const strange = REGIONS[is.region].strangeness;
  let v = 8 + Math.min(40, is.radius / 25) + strange * 60;
  for (const f of is.features) v += f === 'ruins' || f === 'shrine' ? 20 : f === 'wreck' || f === 'cache' ? 12 : f === 'pearl_bank' || f === 'mine' ? 10 : 4;
  v *= is.region === port.region ? 1.4 : 0.7;
  if (port.faction === 'brokers') v *= 1.5; // the Fog Brokers trade in information
  return Math.round(v);
}

function sellableCharts(game: Game, s: PlayerSession, port: Port): Island[] {
  const sold = new Set(s.profile!.chartSales[port.id] ?? []);
  // Copies of bought charts are worthless to a cartographer: only first-hand surveys sell.
  for (const id of s.profile!.chartsBought) sold.add(id);
  const out: Island[] = [];
  for (const id of s.discovered) {
    const is = game.world.islands[id];
    if (!is || is.portId || sold.has(id)) continue;
    out.push(is);
  }
  return out;
}

/** Undiscovered islands a cartographer here can sell for a region, closest to the port first. */
function chartForRegion(game: Game, s: PlayerSession, port: Port, region: RegionId): Island[] {
  return game.world.islands
    .filter((is) => is.region === region && !s.discovered.has(is.id))
    .sort((a, b) => dist(a.x, a.y, port.x, port.y) - dist(b.x, b.y, port.x, port.y))
    .slice(0, 15);
}

function chartRegions(port: Port): RegionId[] {
  return REGION_IDS.filter((r) => r === port.region || dist(REGIONS[r].center[0], REGIONS[r].center[1], port.x, port.y) < 42000);
}

function chartPrice(list: Island[], port: Port): number {
  return Math.round(list.reduce((a, is) => a + islandChartValue(is, port), 0) * 0.8 + 40);
}

export function chartView(game: Game, s: PlayerSession, port: Port): PortView['charts'] {
  const sellable = sellableCharts(game, s, port);
  return {
    sellable: sellable.length,
    sellValue: sellable.reduce((a, is) => a + islandChartValue(is, port), 0),
    offers: chartRegions(port)
      .map((region) => {
        const list = chartForRegion(game, s, port, region);
        const price = chartPrice(list, port);
        return { region, name: `Chart of ${REGIONS[region].name}`, islands: list.length, price };
      })
      .filter((o) => o.islands > 0),
  };
}

export function sellCharts(game: Game, s: PlayerSession, port: Port): string | null {
  const list = sellableCharts(game, s, port);
  if (!list.length) return 'The cartographer already has everything you know';
  const value = list.reduce((a, is) => a + islandChartValue(is, port), 0);
  const p = s.profile!;
  (p.chartSales[port.id] ??= []).push(...list.map((is) => is.id));
  p.gold += value;
  game.grantXp(s, value / 6, null);
  game.db.ledger(s.accountId, 'charts_sold', value, `${list.length} islands @ ${port.id}`);
  game.sendTo(s, { t: 'toast', msg: `The cartographer copies ${list.length} of your charts: +${value} silver.`, kind: 'gold' });
  return null;
}

export function buyChart(game: Game, s: PlayerSession, port: Port, region: RegionId): string | null {
  if (!chartRegions(port).includes(region)) return 'No chart of those waters here';
  const list = chartForRegion(game, s, port, region);
  if (!list.length) return 'You already know everything this chart shows';
  const price = chartPrice(list, port);
  const p = s.profile!;
  if (p.gold < price) return `The chart costs ${price} silver`;
  p.gold -= price;
  // Bought knowledge charts the islands but earns no discovery experience — you did not sail there.
  for (const is of list) game.chartIsland(s, is);
  p.chartsBought.push(...list.map((is) => is.id));
  game.db.ledger(s.accountId, 'chart_bought', -price, `${region} @ ${port.id}`);
  game.sendTo(s, { t: 'toast', msg: `${list.length} islands inked onto your chart.`, kind: 'info' });
  return null;
}
