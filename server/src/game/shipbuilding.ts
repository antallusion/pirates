// Building a ship to order (docs/02 §3): plans of four qualities with side-grade lines, frame and planking of
// chosen timber, rare materials, a figurehead, a yard's time and a master's hand. Finished hulls wait at the
// yard; the old ship is berthed there and can be taken out again. Plus the living materials at sea
// (cursed wood, drowned silk) and what the figureheads do.

import { lackMore } from '../../../shared/src/data/buyfail.ts';
import { researchWhy } from './research.ts';
import { takeGearBack } from './gear.ts';
import { refitHolds } from './refit.ts';
import { pointsInTree } from '../../../shared/src/data/talents.ts';
import { BERTH_CALL_MS, BERTH_PRICE, BERTHS_CAP, BERTHS_FREE } from '../../../shared/src/data/berths.ts';
import { cargoVolume, computeShipStats } from '../../../shared/src/sim/shipstats.ts';
import { move as moveDoubloons, sendBalance } from './premium.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { SHIP_CLASSES, defaultGunFor } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { PRIZE_COURT } from '../../../shared/src/data/silverpay.ts';
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

/** «Причал» (forum, Нефигугум 2026-10-30: «купив новый корабль старый пропадает навсегда? нет ни какого ангара»): BERTHS_FREE
 *  berths free (two, the owner 2026-10-30), one more for BERTH_PRICE doubloons each (300), BERTHS_CAP in all. */
export const MAX_BERTHS = BERTHS_FREE;
export { BERTHS_CAP, BERTH_PRICE };

/** Her berths: the free ones and those she bought. */
export function berthCap(p: Pick<Profile, 'berthsBought'> | null | undefined): number {
  return Math.min(BERTHS_CAP, MAX_BERTHS + Math.max(0, Math.floor(p?.berthsBought ?? 0)));
}

/** Every berth of hers taken. */
export function berthsFull(p: { berths?: readonly unknown[]; berthsBought?: number }): boolean {
  return (p.berths?.length ?? 0) >= berthCap(p);
}

/** The words when they are. */
export function berthsFullWhy(p: Pick<Profile, 'berthsBought'>): string {
  return `You already berth ${berthCap(p)} ships — sell or take one out first`;
}
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
  const unknown = researchWhy(p, r.classId); // the yard's tree of hulls (docs/20)
  if (unknown) return { ...out, error: unknown };
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
  if (berthsFull(p)) return berthsFullWhy(p);
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

/** What changing into this hull would leave behind: the men over her hammocks, the hold over hers (the army and the cargo
 *  go across with the captain; forum 2026-10-30). */
export function berthFit(s: PlayerSession, loadout: ShipLoadout): { menOver: number; holdOver: number; hold: number } {
  const ship = s.ship!;
  const st = computeShipStats(loadout, ship.captain, ship.talents, ship.effects, ship.worn, ship.hero);
  const vol = cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
  return { menOver: Math.max(0, ship.crew - st.crewMax), holdOver: Math.max(0, Math.ceil(vol - st.holdVolume)), hold: Math.floor(st.holdVolume) };
}

/** Words the client asks again with (`force`): men who will not fit are paid off ashore. */
export const BERTH_MEN_ASK = 'men will not fit';

/** Why she cannot change into berth `index` here now, or null (or the men's question: `${n} ${BERTH_MEN_ASK}`). */
function swapWhy(game: Game, s: PlayerSession, port: Port, index: number, force: boolean): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const b = p.berths[index];
  if (!b) return 'No such berth';
  if (b.port !== port.id && b.port.startsWith('isle:')) return 'She is berthed at your island: take her out at its yard';
  if (b.port !== port.id && !(port.shipyardTier > 0)) return 'No yard here: change ships at a harbour with a shipyard';
  const refitting = refitHolds(game, p);
  if (refitting) return refitting; // the yard has her on the ways
  if (ship.loadout.legendary && b.loadout.legendary) return 'Cannot do that now';
  const fit = berthFit(s, b.loadout);
  if (fit.holdOver > 0) return `Her hold takes ${fit.hold}: sell or store ${fit.holdOver} more in the warehouse first`;
  if (fit.menOver > 0 && !force) return `${fit.menOver} ${BERTH_MEN_ASK}`;
  return null;
}

/** «Пересесть» (forum 2026-10-30): swap the ship she sails for one of her berths — at any harbour with a yard (the berth
 *  sends her round), not an island's caravan hull (taken out at the island). The ship she leaves takes the berth here, her
 *  fittings, guns, gear and level with her. Her army and her hold go across with the captain: a hold the new hull cannot
 *  take is refused (sell or store the rest first); men she has no hammocks for are asked about once (`force`: paid off).
 *  At once: her island's yard, where the hull lies by her (forum 40: a harbour's «Пересесть» is callBerth's). */
export function swapBerth(game: Game, s: PlayerSession, port: Port, index: number, force = false): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const why = swapWhy(game, s, port, index, force);
  if (why) return why;
  const b = p.berths[index];
  p.berths.splice(index, 1, { port: port.id, loadout: ship.loadout, hull: ship.hull / ship.stats.hullMax });
  setShip(game, s, b.loadout, b.hull);
  game.toastShip(ship, `You take the ${b.loadout.name} out of her berth.`, 'info');
  return null;
}

/** A berthed ship on her way to her captain (forum 40, approved by the owner: «Добавьте время на смену корабля в
 *  «Причал» 2 минуты (как для смены флага)… Корабль плывёт к вам с места предыдущей стоянки. Прибудет через …»): which
 *  berth (its index and, against a list changed meanwhile, her class and name), the harbour she comes to, when she comes
 *  (wall ms: a reload, a restart keep the clock), and the men's answer given. Saved with the captain. */
export interface BerthCall {
  index: number;
  classId: ShipClassId;
  name: string;
  port: string;
  at: number;
  force: boolean;
}

/** The berth a call is for, found again if the list changed (a berth sold, a ship given): -1 if she is gone. */
export function calledBerth(p: Pick<Profile, 'berths' | 'berthCall'>): number {
  const c = p.berthCall;
  if (!c) return -1;
  const same = (i: number) => p.berths[i]?.loadout.classId === c.classId && p.berths[i]?.loadout.name === c.name;
  if (same(c.index)) return c.index;
  return p.berths.findIndex((_, i) => same(i));
}

/** «Пересесть» in a harbour (forum 40): the berthed ship is sent for — she sails round from her berth and comes in
 *  BERTH_CALL_MS (two minutes, as new colours go up), and is changed into then if her captain is still in this harbour;
 *  casting off calls her back. Everything is asked now (and again when she comes). «Пересесть» on the ship already on
 *  her way calls her off; on another, sends for that one instead. */
export function callBerth(game: Game, s: PlayerSession, port: Port, index: number, force = false): string | null {
  const p = s.profile!;
  if (p.berthCall && calledBerth(p) === index && p.berthCall.port === port.id) {
    const name = p.berthCall.name;
    p.berthCall = null;
    game.toastShip(s.ship!, `The ${name} goes back to her berth.`, 'info');
    game.pushSelf(s, true);
    return null;
  }
  const why = swapWhy(game, s, port, index, force);
  if (why) return why;
  const b = p.berths[index];
  p.berthCall = { index, classId: b.loadout.classId, name: b.loadout.name, port: port.id, at: game.wallNow() + BERTH_CALL_MS, force };
  const mins = Math.ceil(BERTH_CALL_MS / 60_000);
  const from = game.portById(b.port)?.name ?? b.port;
  game.toastShip(s.ship!, b.port === port.id ? `The ${b.loadout.name} is warped round from her berth: she comes alongside in ${mins} min, if you are still in port.` : `The ${b.loadout.name} sails to you from ${from}: she comes in ${mins} min, if you are still in port.`, 'info');
  game.pushSelf(s, true);
  return null;
}

/** Every second: the ship sent for comes alongside (and is changed into), or her captain sailed first (she goes back). */
export function berthCallSecond(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  const c = p?.berthCall;
  if (!p || !ship || !c) return;
  if (ship.docked !== c.port) return berthCallOff(game, s);
  if (game.wallNow() < c.at) return;
  p.berthCall = null;
  const i = calledBerth({ berths: p.berths, berthCall: c });
  const port = game.portById(c.port);
  const why = i < 0 || !port ? 'No such berth' : swapBerth(game, s, port, i, c.force);
  if (why) {
    // (the reason in its own line, as the yard says it: the men's count since grown is the hammocks' words)
    game.toastShip(ship, `The ${c.name} came, but you cannot change into her now: she goes back to her berth.`, 'bad');
    game.toastShip(ship, why.endsWith(` ${BERTH_MEN_ASK}`) ? `${parseInt(why, 10) || 1} of your men will not fit her: send for her again.` : why, 'bad');
  }
  game.saveSession(s);
  game.pushSelf(s, true);
}

/** She cast off before the ship she sent for came: the order is struck, the ship goes back to her berth. */
export function berthCallOff(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p?.berthCall) return;
  const name = p.berthCall.name;
  p.berthCall = null;
  game.toastShip(s.ship, `You sailed before the ${name} came: she goes back to her berth.`, 'bad');
  game.pushSelf(s, true);
}

/** One more berth for BERTH_PRICE doubloons, to BERTHS_CAP. */
export function buyBerth(game: Game, s: PlayerSession): string | null {
  const p = s.profile!;
  if (berthCap(p) >= BERTHS_CAP) return `${BERTHS_CAP} berths at most`;
  const bal = moveDoubloons(game, s.accountId, -BERTH_PRICE, 'doubloons_buy', `berth:${berthCap(p) + 1}`, () => {
    p.berthsBought = Math.max(0, Math.floor(p.berthsBought ?? 0)) + 1;
    game.saveSession(s);
  });
  if (bal === null) return `A berth costs ${BERTH_PRICE} doubloons`;
  sendBalance(game, s);
  game.toastShip(s.ship, `A new berth is yours: ${berthCap(p)} in all.`, 'good');
  return null;
}

/** Sell a berthed hull to the yard for 40% of her class price; a trophy taken by boarding at the prize court's rate
 *  (docs/31 §9: a frigate taken and sold out of her berth paid 0.8 of an hour at sea, past the court and the crew's share). */
export function sellBerth(game: Game, s: PlayerSession, port: Port, index: number): string | null {
  const p = s.profile!;
  const b = p.berths[index];
  if (!b || b.port !== port.id) return 'No such ship berthed here';
  if (p.berthCall && calledBerth(p) === index) return 'She is on her way to you: call her off first';
  if (b.loadout.legendary) return 'No yard would buy her, and no captain should sell her';
  // Doubloons are never turned into silver (docs/01 P7): no yard buys a hull bought with them.
  if (SHIP_CLASSES[b.loadout.classId]?.premium) return 'No yard buys a hull bought with doubloons';
  const back = takeGearBack(p, b.loadout); // her gear comes ashore first
  if (back) return back;
  const v = Math.round(SHIP_CLASSES[b.loadout.classId].price * (b.loadout.trophy ? PRIZE_COURT : 0.4) * Math.max(0.3, b.hull));
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
  if (p.gold < price) return lackMore(`The plan costs ${price} silver`, price, p.gold);
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
  if (p.gold < fh.price) return lackMore(`The carver wants ${fh.price} silver`, fh.price, p.gold);
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
  // (a ship sent for, saved: kept if it still names a berth, else dropped — forum 40)
  const c = p.berthCall;
  if (c && !(typeof c === 'object' && Number.isFinite(c.at) && typeof c.port === 'string' && typeof c.name === 'string' && calledBerth(p) >= 0)) p.berthCall = null;
}
