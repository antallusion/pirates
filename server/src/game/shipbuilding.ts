// Building a ship to order (docs/02 §3): plans of four qualities with side-grade lines, frame and planking of
// chosen timber, rare materials, a figurehead, a yard's time and a master's hand. Finished hulls wait at the
// yard; the old ship is berthed there and can be taken out again. Plus the living materials at sea
// (cursed wood, drowned silk) and what the figureheads do.

import { takeGearBack } from './gear.ts';
import { refitHolds } from './refit.ts';
import { pointsInTree } from '../../../shared/src/data/talents.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { SHIP_CLASSES, defaultGunFor } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import {
  BUILD_TIME, FIGUREHEADS, buildMaterials, carvedAt, PLAN_LINES, PLAN_REP, PLAN_USES, RARES, VARIANTS, WOODS, YARD_FACTIONS_WITH_PLANS,
} from '../../../shared/src/data/shipbuild.ts';
import type { FigureheadId, Plan, PlanQuality, RareSlot, ShipBuild, VariantId, WoodId } from '../../../shared/src/data/shipbuild.ts';
import { isNight } from '../../../shared/src/constants.ts';
import type { ShipLoadout } from '../../../shared/src/sim/shipstats.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import { grantDeed } from './progression.ts';

export const MAX_BERTHS = 3;
export const LEVEL_FOR_TIER = [0, 1, 10, 22, 35, 50];

export interface BuildOrder {
  id: string;
  port: string;
  classId: ShipClassId;
  name: string;
  build: ShipBuild;
  start: number;
  done: number;
}

export interface Berth {
  port: string;
  loadout: ShipLoadout;
  hull: number; // fraction
}

export interface BuildRequest {
  classId: ShipClassId;
  name: string;
  frame: WoodId;
  plank: WoodId;
  rares: Partial<Record<RareSlot, GoodId>>;
  figurehead?: FigureheadId;
  planId?: string;
  master?: boolean;
}

export function woodAvailable(port: Port, w: WoodId): boolean {
  const ports = WOODS[w].ports;
  return ports === 'all' || ports.includes(port.id);
}

function have(s: PlayerSession, port: Port, good: GoodId): number {
  return Math.floor(s.ship!.cargo[good] ?? 0) + Math.floor(s.profile!.warehouses[port.id]?.[good] ?? 0);
}

function take(s: PlayerSession, port: Port, good: GoodId, n: number): void {
  const ship = s.ship!;
  const fromHold = Math.min(n, Math.floor(ship.cargo[good] ?? 0));
  ship.cargo[good] = (ship.cargo[good] ?? 0) - fromHold;
  if (!ship.cargo[good]) delete ship.cargo[good];
  const wh = s.profile!.warehouses[port.id];
  if (wh && n - fromHold > 0) {
    wh[good] = (wh[good] ?? 0) - (n - fromHold);
    if (!wh[good]) delete wh[good];
  }
}

export interface BuildQuote {
  cost: number;
  time: number;
  materials: Partial<Record<GoodId, number>>;
  error: string | null;
}

/** What the yard asks for this build, and whether it can be done. */
export function quoteBuild(game: Game, s: PlayerSession, port: Port, r: BuildRequest): BuildQuote {
  const p = s.profile!;
  const cls = SHIP_CLASSES[r.classId];
  const out: BuildQuote = { cost: 0, time: 0, materials: {}, error: null };
  if (!cls || !cls.purchasable) return { ...out, error: 'No yard builds that' };
  const frame = WOODS[r.frame], plank = WOODS[r.plank];
  if (!frame || !plank) return { ...out, error: 'Choose the timber' };
  out.materials = buildMaterials(cls.tier);
  for (const [slot, good] of Object.entries(r.rares)) {
    const def = RARES[slot as RareSlot]?.find((x) => x.good === good);
    if (def) out.materials[def.good] = (out.materials[def.good] ?? 0) + def.units;
  }
  const master = r.master && port.shipyardTier >= 3;
  out.cost = Math.round(cls.price * ((frame.cost + plank.cost) / 2) * (master ? 1.25 : 1) + (r.figurehead ? FIGUREHEADS[r.figurehead].price : 0));
  // Shipwrights build faster: 1% per point in the tree, to 35%; an NPC master takes another quarter off.
  const skill = Math.min(0.35, 0.01 * pointsInTree(p.talents, 'shipwright'));
  out.time = Math.round(BUILD_TIME[cls.tier] * Math.max(frame.time, plank.time) * (1 - skill) * (master ? 0.75 : 1));
  if (cls.tier > port.shipyardTier) return { ...out, error: `${port.name} cannot build a ${cls.name}` };
  if (cls.factions && !cls.factions.includes(port.faction)) return { ...out, error: `Only ${cls.factions.join(', ')} yards build the ${cls.name}` };
  if (p.level < LEVEL_FOR_TIER[cls.tier]) return { ...out, error: `A ${cls.name} needs captain level ${LEVEL_FOR_TIER[cls.tier]}` };
  if (!woodAvailable(port, r.frame)) return { ...out, error: `No ${frame.name.toLowerCase()} in this yard` };
  if (!woodAvailable(port, r.plank)) return { ...out, error: `No ${plank.name.toLowerCase()} in this yard` };
  if (r.figurehead && FIGUREHEADS[r.figurehead].port !== port.id && !p.figureheads.includes(r.figurehead)) return { ...out, error: 'That figurehead is carved elsewhere' };
  if (r.planId && !p.plans.some((x) => x.id === r.planId && (x.classId === null || x.classId === r.classId))) return { ...out, error: 'You hold no such plan for this hull' };
  if (p.builds.length >= 1) return { ...out, error: 'The yard is still busy with your last order' };
  for (const [good, n] of Object.entries(out.materials)) {
    if (have(s, port, good as GoodId) < (n ?? 0)) return { ...out, error: `Needs ${n} ${GOODS[good as GoodId].name.toLowerCase()} in your hold or warehouse here` };
  }
  if (p.gold < out.cost) return { ...out, error: `The yard wants ${out.cost} silver` };
  return out;
}

/** Lay down a hull. */
export function orderBuild(game: Game, s: PlayerSession, port: Port, r: BuildRequest): string | null {
  const p = s.profile!;
  const q = quoteBuild(game, s, port, r);
  if (q.error) return q.error;
  const name = String(r.name ?? '').replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 28) || SHIP_CLASSES[r.classId].name;
  p.gold -= q.cost;
  game.db.ledger(s.accountId, 'build', -q.cost, `${r.classId} @ ${port.id}`);
  for (const [good, n] of Object.entries(q.materials)) take(s, port, good as GoodId, n ?? 0);
  let quality: PlanQuality = 'common';
  let variants: VariantId[] = [];
  if (r.planId) {
    const plan = p.plans.find((x) => x.id === r.planId)!;
    quality = plan.quality;
    variants = [...plan.variants];
    plan.uses--;
    if (plan.uses <= 0) p.plans = p.plans.filter((x) => x !== plan);
  }
  // Excellence: the Masterwork talent, a legendary plan, and luck.
  const excellentChance = 0.05 + 0.1 * (p.talents.shp_masterwork ?? 0) + (quality === 'legendary' ? 0.1 : quality === 'masterwork' ? 0.05 : 0);
  const excellent = game.rng.chance(excellentChance);
  const rares = Object.entries(r.rares).filter(([, g]) => g).map(([slot, good]) => ({ slot: slot as RareSlot, good: good as GoodId }));
  if (r.figurehead && FIGUREHEADS[r.figurehead].port !== port.id) p.figureheads = p.figureheads.filter((f) => f !== r.figurehead);
  p.builds.push({
    id: `b${game.allocId()}`, port: port.id, classId: r.classId, name,
    build: { frame: r.frame, plank: r.plank, rares, figurehead: r.figurehead, quality, variants, excellent, builder: port.id },
    start: game.now, done: game.now + q.time,
  });
  game.toastShip(s.ship!, `The keel of the ${name} is laid at ${port.name}. Ready in ${Math.ceil(q.time / 60)} min.`, 'good');
  return null;
}

/** Take the finished ship; the old one is berthed here. */
export function launchBuild(game: Game, s: PlayerSession, port: Port, orderId: string): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const o = p.builds.find((x) => x.id === orderId);
  if (!o) return 'No such order';
  if (o.port !== port.id) return `She is being built at ${game.portById(o.port)?.name ?? o.port}`;
  if (o.done > game.now) return `Not finished yet (${Math.ceil((o.done - game.now) / 60)} min)`;
  if (p.berths.length >= MAX_BERTHS) return `You already berth ${MAX_BERTHS} ships — sell or take one out first`;
  p.berths.push({ port: port.id, loadout: ship.loadout, hull: ship.hull / ship.stats.hullMax });
  const cls = SHIP_CLASSES[o.classId];
  const gun = defaultGunFor(cls);
  const loadout: ShipLoadout = { classId: o.classId, name: o.name, guns: { port: gun, starboard: gun }, modules: {}, mount: cls.fixedMount, build: o.build };
  p.builds = p.builds.filter((x) => x !== o);
  setShip(game, s, loadout, 1);
  if (o.build.excellent) grantDeed(game, s, 'deed_masterwork_ship');
  game.toastShip(ship, `The ${o.name} slides down the ways${o.build.excellent ? ' — Excellent work, the yard will talk of her for years' : ''}. Your old ship is berthed here.`, 'gold');
  return null;
}

/** Swap the ship you sail for one berthed in this port. */
export function swapBerth(game: Game, s: PlayerSession, port: Port, index: number): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const b = p.berths[index];
  if (!b) return 'No such berth';
  if (b.port !== port.id) return `She is berthed at ${game.portById(b.port)?.name ?? b.port}`;
  const refitting = refitHolds(game, p);
  if (refitting) return refitting; // the yard has her on the ways
  p.berths.splice(index, 1, { port: port.id, loadout: ship.loadout, hull: ship.hull / ship.stats.hullMax });
  setShip(game, s, b.loadout, b.hull);
  game.toastShip(ship, `You take the ${b.loadout.name} out of her berth.`, 'info');
  return null;
}

/** Sell a berthed hull to the yard for 40% of her class price. */
export function sellBerth(game: Game, s: PlayerSession, port: Port, index: number): string | null {
  const p = s.profile!;
  const b = p.berths[index];
  if (!b || b.port !== port.id) return 'No such ship berthed here';
  if (b.loadout.legendary) return 'No yard would buy her, and no captain should sell her';
  // Doubloons are never turned into silver (docs/01 P7): no yard buys a hull bought with them.
  if (SHIP_CLASSES[b.loadout.classId]?.premium) return 'No yard buys a hull bought with doubloons';
  const back = takeGearBack(p, b.loadout); // her gear comes ashore first
  if (back) return back;
  const v = Math.round(SHIP_CLASSES[b.loadout.classId].price * 0.4 * Math.max(0.3, b.hull));
  p.gold += v;
  game.db.ledger(s.accountId, 'ship_sold', v, b.loadout.classId);
  p.berths.splice(index, 1);
  game.toastShip(s.ship!, `The yard buys the ${b.loadout.name}: ${v} silver.`, 'gold');
  return null;
}

/** Her ship becomes this hull (a launch, a berth swapped, a premium hull bought): sound sails and rudder, the crew she
 *  has hammocks for. */
export function setShip(game: Game, s: PlayerSession, loadout: ShipLoadout, hullFrac: number): void {
  const ship = s.ship!;
  const p = s.profile!;
  ship.loadout = loadout;
  p.loadout = loadout;
  ship.gunsDisabled = { port: 0, starboard: 0 };
  ship.companyKey = '';
  ship.recompute(game.now);
  ship.hull = Math.max(1, ship.stats.hullMax * hullFrac);
  ship.sails = ship.stats.sailHpMax;
  ship.rudderHp = 1;
  ship.crew = Math.min(ship.crew, ship.stats.crewMax);
}

/** A yard whose faction respects you (30+) sells good plans for its hulls. */
export function buyPlan(game: Game, s: PlayerSession, port: Port, classId: ShipClassId): string | null {
  const p = s.profile!;
  const cls = SHIP_CLASSES[classId];
  if (!cls || !cls.purchasable || cls.tier > port.shipyardTier) return 'This yard has no plans for her';
  if (!YARD_FACTIONS_WITH_PLANS.includes(port.faction as never)) return 'This yard sells no plans';
  if ((p.reputation[port.faction as never] ?? 0) < PLAN_REP) return `The yard shows its plans only to friends (standing ${PLAN_REP})`;
  const price = Math.round(cls.price * 0.3);
  if (p.gold < price) return `The plan costs ${price} silver`;
  p.gold -= price;
  game.db.ledger(s.accountId, 'plan', -price, classId);
  const plan = rollPlan(game, 'good', classId);
  p.plans.push(plan);
  game.toastShip(s.ship!, `A good plan for a ${cls.name}: ${plan.variants.map((v) => VARIANTS[v].name).join(', ')}.`, 'good');
  return null;
}

export function rollPlan(game: Game, quality: PlanQuality, classId: ShipClassId | null): Plan {
  const all = Object.keys(VARIANTS) as VariantId[];
  const variants: VariantId[] = [];
  while (variants.length < PLAN_LINES[quality]) {
    const v = game.rng.pick(all);
    if (!variants.includes(v)) variants.push(v);
  }
  return { id: `pl${game.allocId()}`, classId, quality, variants, uses: PLAN_USES[quality] === Infinity ? 1e9 : PLAN_USES[quality] };
}

/** Found in a sea chest or a hoard. */
export function grantPlan(game: Game, s: PlayerSession, quality: PlanQuality): void {
  const p = s.profile!;
  if (p.plans.length >= 8) return;
  const plan = rollPlan(game, quality, null);
  p.plans.push(plan);
  game.toastShip(s.ship!, `Among the papers: a ${quality} ship plan (${plan.variants.map((v) => VARIANTS[v].name).join(', ')}).`, 'gold');
}

/** Buy one of the port's figureheads (the first, unless named) for the ship you sail. */
export function buyFigurehead(game: Game, s: PlayerSession, port: Port, id?: FigureheadId): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const here = carvedAt(port.id);
  if (!here.length) return 'No carver works here';
  if (id !== undefined && !here.includes(id)) return 'That figurehead is carved elsewhere';
  const fh = FIGUREHEADS[id ?? here[0]];
  if (ship.loadout.build?.figurehead === fh.id) return 'She already carries it';
  if (p.gold < fh.price) return `The carver wants ${fh.price} silver`;
  p.gold -= fh.price;
  game.db.ledger(s.accountId, 'figurehead', -fh.price, fh.id);
  const build: ShipBuild = ship.loadout.build ?? { frame: 'oak', plank: 'oak', rares: [], quality: 'common', variants: [], builder: port.id };
  ship.loadout = { ...ship.loadout, build: { ...build, figurehead: fh.id } };
  p.loadout = ship.loadout;
  ship.recompute(game.now);
  game.toastShip(ship, `The ${fh.name} is fixed under the bowsprit.`, 'good');
  return null;
}

// ------------------------------------------------------------------ living materials at sea

/** Once a second: cursed wood heals itself in the dark and unsettles the crew; drowned silk mends itself. */
export function stepBuiltShip(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  const now = game.now;
  if (ship.docked) return;
  const pastor = ship.hasFlag('deep_pastor');
  if (ship.hasFlag('cursed_wood')) {
    if (isNight(now) || game.weatherOf(ship) === 'fog') ship.hull = Math.min(ship.stats.hullMax, ship.hull + (ship.stats.hullMax * 0.005) / 60);
    if (!pastor && (ship.talentReady.cursedWood ?? 0) <= now) {
      if (ship.talentReady.cursedWood) ship.morale = Math.max(0, ship.morale - 1);
      ship.talentReady.cursedWood = now + 600;
    }
  }
  if (ship.hasFlag('drowned_silk')) {
    if ((ship.talentReady.silk ?? 0) <= now) {
      ship.talentReady.silk = now + 10;
      ship.sails = Math.min(ship.stats.sailHpMax, ship.sails + ship.stats.sailHpMax * 0.01);
    }
    if ((ship.talentReady.silkMorale ?? 0) <= now) {
      if (ship.talentReady.silkMorale) ship.morale = Math.max(0, ship.morale - 1);
      ship.talentReady.silkMorale = now + 3600;
    }
  }
}

export function sanitizeShipbuilding(p: Profile): void {
  p.builds ??= [];
  p.plans ??= [];
  p.berths ??= [];
  p.figureheads ??= [];
}
