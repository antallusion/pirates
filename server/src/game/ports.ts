// Port services: market, chandlery (ammo), tavern (crew, rumours), shipyard, contracts board,
// harbour master (pardons, insurance). Every action is validated against the docked port.

import { GOODS, GOOD_IDS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { AMMO, AMMO_IDS, GUNS, GUN_IDS, MODULES, MODULE_IDS, MOUNTS, SHIP_CLASSES, SHIP_CLASS_IDS, defaultGunFor, moduleCost } from '../../../shared/src/data/ships.ts';
import type { AmmoId, GunId, ModuleId, ShipClassId } from '../../../shared/src/data/ships.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Contract, PortView, Side, TavernView } from '../../../shared/src/protocol.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { ShipLoadout } from '../../../shared/src/sim/shipstats.ts';
import type { Island, Port } from '../../../shared/src/world/worldgen.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { FACTION_DUTY, LICENCE_SEC, licenceCost, marketRows, midPrice, portIsLawful, quoteBuy, quoteSell, applyTrade } from './economy.ts';
import { wantedLevel } from '../../../shared/src/data/factions.ts';
import type { PriceMods } from './economy.ts';
import type { Game } from './Game.ts';
import { PROFESSIONS } from '../../../shared/src/data/crew.ts';
import type { Profession } from '../../../shared/src/data/crew.ts';
import { hireTrade, recruitCost, tavernOf } from './crew.ts';
import { ESCORT_OFFERS } from './fleet.ts';
import { exoticBonus, noteExoticPurchase } from './bridgefx.ts';
import { poiRumor } from './exploration.ts';
import { mountOffers } from './mounts.ts';
import type { PlayerSession, Profile } from './player.ts';
import { pardonCost } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { onSaleDeeds } from './progression.ts';
import { dealOfDay, onSale, talentPriceMods } from './tradefx.ts';
import { portFence } from './smugglefx.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { bankView, forwardOffers, forwardView, hasExchange, insuranceQuotes, orderView } from './finance.ts';
import { MODULE_MATERIALS, WAREHOUSE_RENT, WAREHOUSE_VOLUME, siteView, sitesNearPort, supplyMaterials } from './resources.ts';

export function hasLicence(p: Profile, faction: string, now: number): boolean {
  // A licence is void for anyone the law is hunting.
  return (p.licences[faction as keyof typeof p.licences] ?? 0) > now && wantedLevel(p.infamy) < 2;
}

export function priceMods(ship: ShipEntity, port: Port, p?: Profile, now = 0, game?: Game): PriceMods {
  const base = basePriceMods(ship, port, p, now);
  return game && p ? talentPriceMods(game, ship, port, p, base) : base;
}

function basePriceMods(ship: ShipEntity, port: Port, p?: Profile, now = 0): PriceMods {
  const licensed = p ? hasLicence(p, port.faction, now) : false;
  return {
    buyMul: ship.stats.buyMul * (ship.captain === 'drowned' && port.faction === 'crown' ? 1.2 : 1) * (licensed ? 0.97 : 1),
    sellMul: ship.stats.sellMul,
    lawfulPort: portIsLawful(port),
    honest: ship.hasFlag('honest_merchant'),
    duty: licensed ? 0 : FACTION_DUTY[port.faction] ?? 0,
  };
}

export function ammoPrice(game: Game, port: Port, ammo: AmmoId): number {
  // Cursed shot is cast only where the Crown does not look: black markets and the Choir.
  if (ammo === 'cursed' && !port.blackMarket && port.faction !== 'choir') return 0;
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
  // Crown yards charge extra to work on a cursed hull.
  const curseMul = ship.curse >= 80 ? 1.5 : ship.curse >= 50 ? 1.2 : 1;
  const guns = (ship.gunsDisabled.port * GUNS[ship.loadout.guns.port].price + ship.gunsDisabled.starboard * GUNS[ship.loadout.guns.starboard].price) * 0.3;
  const mast = ship.hasEffect('broken_mast') ? ship.cls.price * 0.03 : 0;
  const patchwork = ship.hasFlag('patchwork_hull') ? 1.5 : 1;
  return Math.ceil(Math.max(0, ((hull + sails + rudder) * curseMul + guns + mast) * patchwork * yardMul(ship)));
}

export function buildPortView(game: Game, s: PlayerSession, port: Port): PortView {
  const ship = s.ship!;
  const p = s.profile!;
  const market = game.markets.get(port.id)!;
  const mods = priceMods(ship, port, s.profile!, game.now, game);
  const ammoPrices = {} as Record<AmmoId, number>;
  for (const a of AMMO_IDS) ammoPrices[a] = ammoPrice(game, port, a);
  const tier = port.shipyardTier;
  const view: PortView = {
    portId: port.id,
    market: marketRows(market, mods),
    ammoPrices,
    crewAvailable: Math.floor(game.tavernCrew.get(port.id) ?? 0),
    crewHireCost: crewCost(port, p),
    tavern: tavernView(game, port, p, ship),
    escorts: ESCORT_OFFERS.map((o) => ({ classId: o.classId, price: o.price, upkeep: o.upkeep, available: port.shipyardTier >= o.yard })),
    shipyard: {
      tier,
      repairCost: repairCost(ship),
      ships: SHIP_CLASS_IDS.filter((id) => SHIP_CLASSES[id].purchasable && SHIP_CLASSES[id].tier <= tier && (!SHIP_CLASSES[id].factions || SHIP_CLASSES[id].factions!.includes(port.faction))).map((id) => ({
        classId: id, price: SHIP_CLASSES[id].price, tradeIn: Math.round(shipValue(ship) * 0.6),
      })),
      modules: MODULE_IDS.filter((m) => !(m === 'figurehead_kraken' && tier < 2 && !ship.hasFlag('modular_refit')) && (!MODULES[m].blueprint || p.blueprints.includes(m))).map((m) => {
        const level = ship.loadout.modules[m] ?? 0;
        const max = moduleLimit(ship, m);
        return { module: m, level, cost: level >= max ? 0 : Math.round(moduleCost(m, level + 1, ship.cls.tier) * yardMul(ship)), max, excellent: (ship.loadout.excellent ?? []).includes(m) };
      }),
      mounts: mountOffers(ship, port),
      guns: GUN_IDS.filter((g) => GUNS[g].minTier <= Math.max(tier, 1) && GUNS[g].minTier <= ship.cls.tier).map((g) => ({ gun: g, cost: GUNS[g].price * ship.stats.gunsPerSide })),
    },
    contracts: [...hotRun(game, s, port), ...game.contractsAt(port.id)],
    rumors: [poiRumor(game, s, port), ...game.rumorsNear(port.x, port.y, 3)].filter((r): r is string => !!r),
    charts: chartView(game, s, port),
    sites: sitesNearPort(game, port).map((x) => siteView(game, s, x)),
    warehouse: {
      goods: { ...(p.warehouses[port.id] ?? {}) },
      volume: cargoVolume(p.warehouses[port.id] ?? {}),
      capacity: WAREHOUSE_VOLUME,
      rented: !!p.warehouses[port.id],
      rent: feeFor(ship, WAREHOUSE_RENT),
    },
    materialDiscount: MODULE_MATERIALS,
    exchange: hasExchange(port)
      ? { forwards: forwardOffers(game, port).map((f) => forwardView(game, f)), orders: game.orders.filter((o) => o.portId === port.id && !o.closed).map((o) => orderView(o, s.accountId)) }
      : null,
    bank: bankView(p, port, ship),
    insurance: insuranceQuotes(game, s, port),
    duty: mods.duty,
    dealOfDay: ship.rank('trd_local_contacts') >= 3 ? dealOfDay(game, port) : null,
    fence: portFence(game, ship, port),
    licence: port.faction in FACTION_DUTY ? { cost: feeFor(ship, licenceCost(p.level)), until: p.licences[port.faction as keyof typeof p.licences] ?? 0 } : null,
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
  const rows = marketRows(market, priceMods(ship, port, s.profile!, game.now, game));
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
  const mods = priceMods(ship, port, s.profile!, game.now, game);
  if (qty > 0) {
    if (def.contraband && ship.hasFlag('honest_merchant')) return 'An Honest Merchant does not carry contraband';
    if (gm.stock < qty) return 'Not enough in stock';
    const price = quoteBuy(good, gm, qty, mods);
    if (p.gold < price) return 'Not enough silver';
    const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
    const need = qty * def.volume * (def.contraband ? ship.stats.contrabandVolumeMul : 1);
    if (need > free + 1e-6) return 'Not enough room in the hold';
    p.gold -= price;
    const prevQty = ship.cargo[good] ?? 0;
    const prevBasis = game.costBasis(s, good);
    ship.cargo[good] = prevQty + qty;
    game.setCostBasis(s, good, (prevBasis * prevQty + price) / (prevQty + qty));
    applyTrade(market, good, -qty);
    noteExoticPurchase(p, port, good, qty);
    // Forged Papers rank 2: the Brokers stamp what they sell you.
    if (def.contraband && port.faction === 'brokers' && ship.rank('smg_forged_papers') >= 2) p.smuggle.stamped[good] = (p.smuggle.stamped[good] ?? 0) + qty;
    game.db.ledger(s.accountId, 'buy', -price, `${qty} ${good} @ ${port.id}`);
    return null;
  }
  let n = -qty;
  const have = ship.cargo[good] ?? 0;
  if (have < n) return 'You do not carry that much';
  // Stolen goods: customs in lawful ports may seize them; black-market fences take a cut.
  const stolen = Math.min(p.stolen[good] ?? 0, have);
  let fenced = 0;
  if (stolen > 0 && portIsLawful(port)) {
    const exposed = Math.max(0, n - (have - stolen)); // clean units go on the counter first
    if (exposed > 0 && game.rng.chance(ship.hasFlag('false_bottom') ? 0.15 : 0.45)) {
      ship.cargo[good] = have - exposed;
      if (!ship.cargo[good]) delete ship.cargo[good];
      p.stolen[good] = stolen - exposed;
      game.addInfamy(ship, 6, 'selling stolen goods');
      game.adjustRepProfile(s, port.faction, -5);
      game.sendTo(s, { t: 'toast', msg: `Customs recognise plundered ${GOODS[good].name.toLowerCase()} — ${exposed} seized!`, kind: 'bad' });
      n -= exposed;
      if (n <= 0) return null;
    } else if (exposed > 0) p.stolen[good] = stolen - exposed;
  } else if (stolen > 0 && port.blackMarket) {
    fenced = Math.min(n, stolen);
    p.stolen[good] = stolen - fenced;
  } else if (stolen > 0) p.stolen[good] = Math.max(0, stolen - Math.max(0, n - (have - stolen)));
  if (!p.stolen[good]) delete p.stolen[good];
  const full = quoteSell(good, gm, n, mods);
  const price = Math.floor(full - (full / n) * fenced * 0.15);
  const basis = game.costBasis(s, good);
  ship.cargo[good] = (ship.cargo[good] ?? 0) - n;
  if (!ship.cargo[good]) delete ship.cargo[good];
  if (p.smuggle.stamped[good]) p.smuggle.stamped[good] = Math.max(0, p.smuggle.stamped[good]! - n);
  const exotic = exoticBonus(ship, p, port, good, n, price);
  p.gold += price + exotic;
  applyTrade(market, good, n);
  const profit = price - basis * n;
  p.stats.tradeProfit += Math.max(0, profit);
  if (profit > 0) game.grantXp(s, profit / 5, null);
  // Trade builds standing with the port's faction.
  game.adjustRepProfile(s, port.faction, Math.min(3, price / 1500) * (1 + tx(ship.stats, 'tradeRep')));
  game.db.ledger(s.accountId, 'sell', price, `${n} ${good} @ ${port.id}`);
  onSale(game, s, port, good, n, profit);
  onSaleDeeds(game, s, port.id, good, n, price);
  game.checkDeliveries(s, port);
  return null;
}

export function buyAmmo(game: Game, s: PlayerSession, port: Port, ammo: AmmoId, qty: number): string | null {
  const ship = s.ship!;
  if (!AMMO_IDS.includes(ammo) || !Number.isInteger(qty) || qty <= 0 || qty > 500) return 'Bad order';
  if (ammoPrice(game, port, ammo) <= 0) return 'Nobody here will sell you that';
  const cost = Math.ceil(ammoPrice(game, port, ammo) * qty);
  if (s.profile!.gold < cost) return 'Not enough silver';
  s.profile!.gold -= cost;
  ship.ammo[ammo] += qty;
  game.db.ledger(s.accountId, 'ammo', -cost, ammo);
  return null;
}

export function hireCrew(game: Game, s: PlayerSession, port: Port, qty: number, prof: Profession = 'sailor', dregs = false): string | null {
  return hireTrade(game, s, port, prof, qty, dregs);
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
  // A new mast is stepped.
  if (ship.hasEffect('broken_mast')) ship.effects = ship.effects.filter((e) => e.id !== 'broken_mast');
  ship.recompute(game.now);
  game.db.ledger(s.accountId, 'repair', -cost, ship.loadout.classId);
  return null;
}

/** Yard Credit: −10% per rank on every shipyard bill. */
export function yardMul(ship: ShipEntity): number {
  return Math.max(0.5, 1 + tx(ship.stats, 'yardCost'));
}

/** Highest level this ship may fit (Master Fitter: one fitting one level past its limit). */
export function moduleLimit(ship: ShipEntity, module: ModuleId): number {
  const def = MODULES[module];
  const over = ship.hasFlag('master_fitter') && (!ship.loadout.overfit || ship.loadout.overfit === module) ? 1 : 0;
  return def.maxLevel + over;
}

export function shipyardModule(game: Game, s: PlayerSession, port: Port, module: ModuleId): string | null {
  const ship = s.ship!;
  const def = MODULES[module];
  if (!def) return 'Unknown module';
  if (def.blueprint && !s.profile!.blueprints.includes(module)) return 'No yard can build that without the plans';
  if (module === 'figurehead_kraken' && port.shipyardTier < 2 && !ship.hasFlag('modular_refit')) return 'This yard has no carver for that';
  const level = ship.loadout.modules[module] ?? 0;
  if (level >= moduleLimit(ship, module)) return 'Already fully fitted';
  const full = Math.round(moduleCost(module, level + 1, ship.cls.tier) * yardMul(ship));
  // Materials you bring (hold first, then your warehouse here) knock up to 30% off the yard's price.
  const need = MODULE_MATERIALS[module];
  const wh = s.profile!.warehouses[port.id] ?? {};
  const avail = need ? Math.min(need.units, Math.floor(ship.cargo[need.good] ?? 0) + Math.floor(wh[need.good] ?? 0)) / need.units : 0;
  const cost = Math.round(full * (1 - 0.3 * avail));
  if (s.profile!.gold < cost) return `Needs ${cost} silver`;
  if (avail > 0) supplyMaterials(s, port, module);
  s.profile!.gold -= cost;
  ship.loadout.modules[module] = level + 1;
  if (level + 1 > def.maxLevel) ship.loadout.overfit = module;
  // Masterwork: a fitting may come out Excellent (bonus +50%).
  const excellent = 0.05 + tx(ship.stats, 'masterwork');
  if (!(ship.loadout.excellent ?? []).includes(module) && game.rng.chance(excellent)) {
    ship.loadout.excellent = [...(ship.loadout.excellent ?? []), module];
    game.sendTo(s, { t: 'toast', msg: `The yard outdid itself: ${def.name} is Excellent work.`, kind: 'good' });
  }
  const hullFrac = ship.hull / ship.stats.hullMax;
  ship.recompute(game.now);
  ship.hull = Math.round(ship.stats.hullMax * hullFrac);
  game.db.ledger(s.accountId, 'module', -cost, module);
  return null;
}

/** Take out one level of a fitting: the yard charges 10% of its price; Modular Refit does it for nothing. */
export function shipyardUnfit(game: Game, s: PlayerSession, module: ModuleId): string | null {
  const ship = s.ship!;
  const level = ship.loadout.modules[module] ?? 0;
  if (!MODULES[module] || level <= 0) return 'Nothing fitted there';
  const cost = ship.hasFlag('modular_refit') ? 0 : Math.round(moduleCost(module, level, ship.cls.tier) * 0.1 * yardMul(ship));
  if (s.profile!.gold < cost) return `Taking it out costs ${cost} silver`;
  s.profile!.gold -= cost;
  if (cost) game.db.ledger(s.accountId, 'module', -cost, `unfit:${module}`);
  if (level - 1 > 0) ship.loadout.modules[module] = level - 1;
  else delete ship.loadout.modules[module];
  if (ship.loadout.overfit === module && level - 1 <= MODULES[module].maxLevel) delete ship.loadout.overfit;
  if (level - 1 <= 0 && ship.loadout.excellent) ship.loadout.excellent = ship.loadout.excellent.filter((m) => m !== module);
  const hullFrac = ship.hull / ship.stats.hullMax;
  ship.recompute(game.now);
  ship.hull = Math.round(ship.stats.hullMax * hullFrac);
  return null;
}

/** Legendary Keel: lay it in this hull class (once per 7 days). */
export function layKeel(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  if (!ship.hasFlag('legendary_keel')) return 'You need the Legendary Keel talent';
  if (p.keel?.classId === ship.loadout.classId) return 'She already has it';
  if (p.keel && game.now - p.keel.since < 7 * 86400) return `The keel can be moved in ${Math.ceil((7 * 86400 - (game.now - p.keel.since)) / 86400)} days`;
  p.keel = { classId: ship.loadout.classId, since: game.now };
  syncKeel(game, s);
  return null;
}

export function syncKeel(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  if (!ship) return;
  const want = ship.hasFlag('legendary_keel') && s.profile!.keel?.classId === ship.loadout.classId;
  if (!!ship.loadout.keel === want) return;
  ship.loadout.keel = want || undefined;
  const hullFrac = ship.hull / ship.stats.hullMax;
  ship.recompute(game.now);
  ship.hull = Math.round(ship.stats.hullMax * hullFrac);
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
  const cost = Math.max(0, Math.round((def.price * n - old.price * n * 0.5) * yardMul(ship)));
  if (s.profile!.gold < cost) return `Needs ${cost} silver`;
  s.profile!.gold -= cost;
  if (cost) game.db.ledger(s.accountId, 'guns', -cost, gun);
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
  if (def.factions && !def.factions.includes(port.faction)) return `Only ${def.factions.join(', ')} yards build the ${def.name}`;
  if (classId === ship.loadout.classId) return 'You already sail one';
  const tradeIn = Math.round(shipValue(ship) * 0.6);
  const cost = Math.max(0, def.price - tradeIn);
  const p = s.profile!;
  if (p.gold < cost) return `Needs ${cost} silver after trade-in`;
  const gun = defaultGunFor(def);
  const newLoadout: ShipLoadout = { classId, name: ship.loadout.name, guns: { port: gun, starboard: gun }, modules: {}, mount: def.fixedMount };
  p.gold -= cost;
  // The old deck mount is sold back to the yard.
  if (ship.loadout.mount) {
    const back = Math.round(MOUNTS[ship.loadout.mount].price * 0.4);
    p.gold += back;
    game.db.ledger(s.accountId, 'mount_sold', back, ship.loadout.mount);
  }
  ship.loadout = newLoadout;
  p.loadout = newLoadout;
  ship.gunsDisabled = { port: 0, starboard: 0 };
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.sails = ship.stats.sailHpMax;
  ship.rudderHp = 1;
  if (cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul) > ship.stats.holdVolume) {
    // Excess cargo is sold to the yard at a poor price rather than silently vanishing.
    let excess = cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul) - ship.stats.holdVolume;
    let dumped = 0;
    for (const id of Object.keys(ship.cargo) as GoodId[]) {
      while (excess > 0 && (ship.cargo[id] ?? 0) > 0) {
        ship.cargo[id]! -= 1;
        excess -= GOODS[id].volume;
        const back = Math.floor(GOODS[id].basePrice * 0.5);
        p.gold += back;
        dumped += back;
      }
      if (!ship.cargo[id]) delete ship.cargo[id];
    }
    if (dumped) game.db.ledger(s.accountId, 'dumped_cargo', dumped, classId);
  }
  game.db.ledger(s.accountId, 'ship', -cost, classId);
  return null;
}

/** Black Ledger: the Brokers keep a hot contraband run for their own. */
function hotRun(game: Game, s: PlayerSession, port: Port): Contract[] {
  const ship = s.ship!;
  const p = s.profile!;
  if (!ship.hasFlag('black_ledger') || port.faction !== 'brokers') return [];
  if (p.smuggle.hotRun && p.smuggle.hotRun.expiresAt > game.now) return [p.smuggle.hotRun];
  const dests = game.world.ports.filter((q) => q.blackMarket && q.id !== port.id && dist(q.x, q.y, port.x, port.y) < 45000);
  if (!dests.length) return [];
  const dest = dests[Math.floor(game.rng.float() * dests.length)];
  const good: GoodId = game.rng.chance(0.5) ? 'dreamleaf' : 'cursed_relics';
  const qty = game.rng.int(6, 16);
  const d = dist(dest.x, dest.y, port.x, port.y);
  p.smuggle.hotRun = {
    id: `hot${game.allocId()}`, kind: 'delivery', title: `Hot run: ${qty} ${GOODS[good].name} to ${dest.name}`, fromPort: port.id, toPort: dest.id, good, qty,
    reward: Math.round(qty * GOODS[good].basePrice * (0.6 + d / 25000)), xp: Math.round(qty * 10 + d / 80), expiresAt: game.now + 1800 + d / 5,
    description: 'The Brokers want this moved quietly. No questions, no receipts, a fat purse.',
  };
  return [p.smuggle.hotRun];
}

/** Ledger Keeper: port fees −15% per rank. */
export function feeFor(ship: ShipEntity, fee: number): number {
  return Math.round(fee * Math.max(0, 1 + tx(ship.stats, 'dutyMul')));
}

export function buyLicence(game: Game, s: PlayerSession, port: Port): string | null {
  const p = s.profile!;
  if (!(port.faction in FACTION_DUTY)) return 'This harbour levies no duties to be licensed against';
  if (wantedLevel(p.infamy) >= 2) return 'The clerks will not license a wanted captain';
  const cost = feeFor(s.ship!, licenceCost(p.level));
  if (p.gold < cost) return `A licence costs ${cost} silver`;
  p.gold -= cost;
  const f = port.faction as keyof typeof p.licences;
  p.licences[f] = Math.max(game.now, p.licences[f] ?? 0) + LICENCE_SEC;
  game.db.ledger(s.accountId, 'licence', -cost, port.faction);
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
        reward: Math.round((320 * kills + rng.int(0, 150)) * game.econRewardMul), xp: 180 * kills, expiresAt: now + 3600,
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
        reward: Math.round((120 + d / 55) * game.econRewardMul), xp: Math.round(60 + d / 120), expiresAt: now + 1800 + d / 8,
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
      reward: Math.round(qty * GOODS[good].basePrice * (0.35 + d / 30000) * game.econRewardMul), xp: Math.round(qty * 6 + d / 100), expiresAt: now + 2400 + d / 6,
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
  const value = Math.round(list.reduce((a, is) => a + islandChartValue(is, port), 0) * (s.ship!.hasFlag('appraiser') ? 1.15 : 1) * (1 + 0.15 * s.ship!.rank('exp_cartographer')) * (s.ship!.hasFlag('exotic_goods') ? 1.15 : 1));
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

function tavernView(game: Game, port: Port, p: Profile, ship: ShipEntity): TavernView {
  const t = tavernOf(game, port);
  const costs = {} as Record<Profession, number>;
  for (const k of PROFESSIONS) costs[k] = recruitCost(game, port, p, k, ship);
  return {
    stars: Math.round(t.stars * 10) / 10,
    stock: Object.fromEntries(Object.entries(t.stock).map(([k, v]) => [k, Math.floor(v ?? 0)])),
    costs,
    officers: t.officers.map((o) => ({ ...o, taken: t.hired.includes(o.id) || (!!o.unique && (p.company.uniquesGone.includes(o.unique) || p.company.officers.some((x) => x.unique === o.unique))) })),
    pressGang: REGIONS[port.region].safety === 'lawless',
    dregs: REGIONS[port.region].safety === 'lawless' && ship.rank('cmd_press_gang') >= 2,
  };
}
