// Command (docs/03 §4.4): a squadron of hired NPC escorts that sail with the flagship, formations and
// signal flags, Line of Battle, Screen the Flagship, auras and the active orders of the Command tree.

import { pointsInTree } from '../../../shared/src/data/talents.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import type { StatMods } from '../../../shared/src/data/stats.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { fireBroadside, sideHeading } from './combat.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { flagshipYardMods } from './bridgefx.ts';
import { ownPortRepairFleet, ownShipLost } from './baseships.ts';
import { ownParity } from '../../../shared/src/data/baseships.ts';

export type Formation = 'line' | 'wedge' | 'ring';
export const FORMATIONS: Formation[] = ['line', 'wedge', 'ring'];

export interface FleetEscort {
  id: string;
  classId: ShipClassId;
  name: string;
  hull: number; // fraction of her hull, kept while she rides at anchor
  /** One of the captain's own ships from her island's shipyard (docs/15 item 4): her record there, and her level. */
  own?: string;
  level?: number;
}

export interface Fleet {
  escorts: FleetEscort[];
  formation: Formation;
  formationAt: number; // signals take 3 s to be read
}

export const ESCORT_OFFERS: { classId: ShipClassId; price: number; upkeep: number; yard: number }[] = [
  { classId: 'cutter', price: 900, upkeep: 25, yard: 1 },
  { classId: 'brig', price: 1800, upkeep: 40, yard: 2 },
  { classId: 'brigantine', price: 3200, upkeep: 60, yard: 3 },
];

const ESCORT_NAMES = ['Tenacity', 'Warrant', 'Loyal Oath', 'Salt Debt', 'Iron Promise', 'Grey Widow', 'Steadfast', 'Reckoning', 'Hard Bargain', 'Last Word'];

export function newFleet(): Fleet {
  return { escorts: [], formation: 'line', formationAt: 0 };
}

/** Escort berths: ten points in Command open the first; Escort Captain and the Pennant one more each. */
export function escortSlots(p: Profile, ship: ShipEntity): number {
  const n = (pointsInTree(p.talents, 'command') >= 10 ? 1 : 0) + (ship.hasFlag('escort_captain') ? 1 : 0) + (ship.hasFlag('admirals_pennant') ? 1 : 0);
  return Math.min(ship.hasFlag('admirals_pennant') ? 3 : 2, n);
}

export function escortUpkeep(p: Profile, ship: ShipEntity | null): number {
  const logistics = ship ? tx(ship.stats, 'fleetLogistics') : 0;
  let u = 0;
  for (const e of p.fleet.escorts) if (!e.own) u += ESCORT_OFFERS.find((o) => o.classId === e.classId)?.upkeep ?? 40;
  return u * Math.max(0.2, 1 - 0.2 * logistics);
}

export function escortsOf(game: Game, owner: ShipEntity): ShipEntity[] {
  const out: ShipEntity[] = [];
  for (const s of game.ships.values()) if (s.ownerId === owner.id && s.fleetId && s.alive) out.push(s);
  return out.sort((a, b) => a.escortIndex - b.escortIndex);
}

/** Hire an escort at a harbour master with a yard good enough to fit her out. */
export function hireEscort(game: Game, s: PlayerSession, port: Port, classId: ShipClassId): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const offer = ESCORT_OFFERS.find((o) => o.classId === classId);
  if (!offer) return 'No such ship for hire';
  if (port.shipyardTier < offer.yard) return `This yard cannot fit out a ${SHIP_CLASSES[classId].name}`;
  const slots = escortSlots(p, ship);
  if (slots <= 0) return 'Escorts answer only to a commander (10 points in Command)';
  // Her own ships at sea take the berths first (docs/15 item 4).
  if (p.fleet.escorts.length >= slots) return `You have berths for ${slots} escort${slots === 1 ? '' : 's'}`;
  if (p.gold < offer.price) return `A ${SHIP_CLASSES[classId].name} and her crew cost ${offer.price} silver`;
  p.gold -= offer.price;
  game.db.ledger(s.accountId, 'escort', -offer.price, classId);
  const name = `${game.rng.pick(ESCORT_NAMES)}`;
  p.fleet.escorts.push({ id: `e${game.allocId()}`, classId, name, hull: 1 });
  game.toastShip(ship, `The ${SHIP_CLASSES[classId].name} ${name} signs on as your escort. She sails when you do.`, 'good');
  return null;
}

export function dismissEscort(game: Game, s: PlayerSession, id: string): string | null {
  const p = s.profile!;
  const e = p.fleet.escorts.find((x) => x.id === id);
  if (!e) return 'No such escort';
  if (e.own) return 'She is your own ship: send her home from the island’s shipyard.';
  if (!s.ship!.docked) return 'Pay her off in port';
  p.fleet.escorts = p.fleet.escorts.filter((x) => x !== e);
  game.toastShip(s.ship!, `${e.name} is paid off.`, 'info');
  return null;
}

/** Setting sail: the squadron weighs anchor and takes station. */
export function launchFleet(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const owner = s.ship!;
  owner.formation = p.fleet.formation;
  p.fleet.escorts.forEach((e, i) => spawnEscortShip(game, s, e, i));
}

/** One ship of the squadron put to sea at her station (a hired escort at her commander's level, her own at hers). */
export function spawnEscortShip(game: Game, s: PlayerSession, e: FleetEscort, i: number): ShipEntity {
  const p = s.profile!;
  const owner = s.ship!;
  const off = formationOffset(p.fleet.formation, i);
  const f = headingVec(owner.state.heading), r = headingVec(owner.state.heading + Math.PI / 2);
  const x = owner.state.x + f.x * off.y + r.x * off.x, y = owner.state.y + f.y * off.y + r.y * off.x;
  const esc = game.spawnNpcShip('escort', e.classId, 'free', x, y, owner.state.heading, { ship: e.name, captain: 'Sailing Master' });
  game.setNpcLevel(esc, e.own ? (e.level ?? 1) : owner.shipLevel); // she sails at her commander's level, as far as her hull allows
  // Her own ship is worth no more than 1.3 hired escorts of her level (docs/15 item 8): the island's frigate sails
  // lighter built and lighter gunned.
  const parity = e.own ? ownParity(esc.loadout.classId, esc.shipLevel) : 1;
  if (parity < 1) {
    esc.effects.push({ id: 'own_parity', until: 1e12, mods: { hullMax: parity - 1, gunDamageMul: parity - 1 } });
    esc.recompute(game.now);
  }
  esc.ownerId = owner.id;
  esc.fleetId = e.id;
  esc.escortIndex = i;
  esc.hull = Math.max(1, esc.stats.hullMax * e.hull);
  const brain = game.npcs.get(esc.id);
  if (brain) brain.active = true;
  game.grid.upsert(esc.id, x, y);
  return esc;
}

/** Making port (or leaving the sea): the squadron anchors and remembers her damage. */
export function anchorFleet(game: Game, s: PlayerSession, hullCap = 1): void {
  const p = s.profile!;
  const owner = s.ship;
  if (!owner) return;
  for (const esc of escortsOf(game, owner)) {
    const rec = p.fleet.escorts.find((e) => e.id === esc.fleetId);
    if (rec) rec.hull = Math.min(hullCap, Math.max(0.05, esc.hull / esc.stats.hullMax));
    game.removeShip(esc.id);
  }
}

/** In port the yard patches the squadron, if you pay. */
export function repairFleet(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  ownPortRepairFleet(game, s); // her own ships: by their own reckoning (docs/15 item 4)
  for (const e of p.fleet.escorts) {
    if (e.hull >= 0.999 || e.own) continue;
    const price = ESCORT_OFFERS.find((o) => o.classId === e.classId)?.price ?? 1800;
    const cost = Math.round((1 - e.hull) * price * 0.15);
    if (p.gold < cost) continue;
    p.gold -= cost;
    game.db.ledger(s.accountId, 'escort_repair', -cost, e.name);
    e.hull = 1;
  }
}

/** An escort went down. */
export function escortLost(game: Game, esc: ShipEntity): void {
  const owner = esc.ownerId !== null ? game.ships.get(esc.ownerId) : undefined;
  const s = owner ? game.sessionOf(owner) : null;
  if (!s?.profile || !esc.fleetId) return;
  // Her own ship is not lost: she is towed home and laid up at the island (docs/15 item 4).
  if (s.profile.fleet.escorts.some((e) => e.id === esc.fleetId && e.own)) return ownShipLost(game, s, esc);
  s.profile.fleet.escorts = s.profile.fleet.escorts.filter((e) => e.id !== esc.fleetId);
  game.toastShip(owner!, `Your escort ${esc.name} is lost with all hands.`, 'bad');
}

/** Station relative to the flagship: x to starboard, y ahead (negative astern). */
export function formationOffset(f: Formation, i: number): { x: number; y: number } {
  if (f === 'wedge') return [{ x: -130, y: -110 }, { x: 130, y: -110 }, { x: 0, y: -240 }][i] ?? { x: 0, y: -240 - i * 100 };
  if (f === 'ring') return [{ x: -160, y: 0 }, { x: 160, y: 0 }, { x: 0, y: -190 }][i] ?? { x: 0, y: -190 - i * 100 };
  return { x: 0, y: -(170 + i * 150) };
}

export function setFormation(game: Game, s: PlayerSession, f: Formation): string | null {
  const ship = s.ship!;
  if (!ship.hasFlag('signal_flags')) return 'You need Signal Flags to order a formation';
  if (!FORMATIONS.includes(f)) return 'Unknown formation';
  s.profile!.fleet.formation = f;
  s.profile!.fleet.formationAt = game.now;
  ship.formation = f;
  game.toastShip(ship, `Signal: form ${f === 'line' ? 'line ahead' : f === 'wedge' ? 'a wedge' : 'a ring'}.`, 'info');
  return null;
}

const FORMATION_MODS: Record<Formation, StatMods> = { line: { gunDamageMul: 0.1 }, wedge: { maxSpeed: 0.1 }, ring: { armorPct: 0.1 } };

/** Once a second for a commander: formations, the pennant, logistics, auras and the lash. */
export function stepFleet(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  const p = s.profile!;
  const now = game.now;
  const escorts = escortsOf(game, ship);
  const signals = ship.hasFlag('signal_flags') && now - p.fleet.formationAt >= 3;
  const pennant = ship.hasFlag('admirals_pennant');
  const logistics = tx(ship.stats, 'fleetLogistics');
  for (const e of escorts) {
    // Flagship Yard: half your fittings' bonuses; then the formation signal.
    const mods: StatMods = { ...flagshipYardMods(ship) };
    if (signals) for (const [k, v] of Object.entries(FORMATION_MODS[p.fleet.formation])) mods[k as keyof StatMods] = (mods[k as keyof StatMods] ?? 0) + (v ?? 0);
    if (pennant) {
      mods.hullMax = (mods.hullMax ?? 0) + 0.2;
      mods.gunDamageMul = (mods.gunDamageMul ?? 0) + 0.2;
      mods.reloadMul = (mods.reloadMul ?? 0) - 0.2;
    }
    const cur = e.effects.find((x) => x.id === 'squadron');
    if (JSON.stringify(cur?.mods ?? {}) !== JSON.stringify(mods)) e.addEffect({ id: 'squadron', until: Infinity, mods }, now);
    if (logistics > 0 && !e.inCombat(now)) e.hull = Math.min(e.stats.hullMax, e.hull + e.stats.hullMax * 0.003 * logistics);
  }
  // Inspiring Presence: 400 m aura on yourself, your escorts and allies (the strongest captain counts).
  const inspire = tx(ship.stats, 'inspire');
  if (inspire > 0) {
    game.forShipsNear(ship.state.x, ship.state.y, 400, (o) => {
      if (!o.alive || (o !== ship && o.ownerId !== ship.id && !game.areAllies(o, ship))) return;
      const cur = o.effects.find((x) => x.id === 'inspired');
      if (cur && (cur.mods?.moraleLoss ?? 0) < -0.03 * inspire - 1e-9) return;
      o.addEffect({ id: 'inspired', until: now + 1.6, mods: { moraleLoss: -0.03 * inspire } }, now);
      o.morale = Math.min(100, o.morale + inspire / 60);
    });
  }
  // Iron Discipline: a steady crew works faster.
  const disc = tx(ship.stats, 'discipline');
  if (disc > 0 && ship.morale > 70) ship.addEffect({ id: 'iron_discipline', until: now + 1.6, mods: { reloadMul: -disc, repairRate: disc } }, now);
  // Legend at the Helm: pirates know the name.
  if (ship.hasFlag('legend_at_helm')) {
    game.forShipsNear(ship.state.x, ship.state.y, 800, (o) => {
      if (o.npcRole !== 'pirate' || o.talentReady[`legend:${ship.id}`]) return;
      o.talentReady[`legend:${ship.id}`] = 1;
      o.morale = Math.max(0, o.morale - 15);
    });
  }
  // Rule of the Lash.
  if (ship.hasFlag('rule_of_the_lash')) {
    if (ship.inCombat(now)) ship.morale = Math.max(50, ship.morale);
    else if (!ship.docked) {
      ship.morale = Math.min(60, ship.morale);
      if (now - ship.lastCombat > 600 && (ship.talentReady.lash ?? 0) <= now) {
        if (ship.talentReady.lash) ship.morale = Math.max(0, ship.morale - 3);
        ship.talentReady.lash = now + 600;
      }
    }
  }
}

/** Rule of the Lash in port: pay the fear bonus or lose 4% of the crew. */
export function lashInPort(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  if (!ship.hasFlag('rule_of_the_lash')) return;
  const p = s.profile!;
  const cost = ship.crew * 10;
  if (p.gold >= cost) {
    p.gold -= cost;
    game.db.ledger(s.accountId, 'fear_bonus', -cost, '');
    game.toastShip(ship, `The fear bonus is paid: ${cost} silver. Nobody slips ashore tonight.`, 'info');
  } else {
    const gone = Math.max(1, Math.floor(ship.crew * 0.04));
    ship.crew = Math.max(1, ship.crew - gone);
    game.toastShip(ship, `${gone} men slip ashore rather than face the lash again.`, 'bad');
  }
}

/** Line of Battle: escorts in line fire with the flagship's broadside, at her target, 10% harder. */
export function lineOfBattle(game: Game, owner: ShipEntity, side: 'port' | 'starboard', d: number): void {
  if (!owner.hasFlag('line_of_battle') || owner.formation !== 'line') return;
  const h = sideHeading(owner, side);
  const v = headingVec(h);
  const ax = owner.state.x + v.x * d, ay = owner.state.y + v.y * d;
  let target: ShipEntity | null = null;
  let bd = 250;
  game.forShipsNear(ax, ay, 250, (o) => {
    if (o.id === owner.id || o.ownerId === owner.id || !o.alive) return;
    const dd = dist(o.state.x, o.state.y, ax, ay);
    if (dd < bd) {
      bd = dd;
      target = o;
    }
  });
  const tgt = target as ShipEntity | null;
  if (!tgt) return;
  for (const e of escortsOf(game, owner)) {
    const brain = game.npcs.get(e.id);
    if (brain) brain.target = tgt.id;
    const de = dist(e.state.x, e.state.y, tgt.state.x, tgt.state.y);
    if (de > 900) continue;
    // Whichever battery bears.
    const bearing = Math.atan2(tgt.state.x - e.state.x, -(tgt.state.y - e.state.y));
    const rel = Math.sin(bearing - e.state.heading);
    const eside: 'port' | 'starboard' = rel >= 0 ? 'starboard' : 'port';
    if (e.reload[eside] > 0) continue;
    e.addEffect({ id: 'synchronised', until: game.now + 3, mods: { gunDamageMul: 0.1 } }, game.now);
    fireBroadside(game, e, eside, de, undefined, 1); // her escorts' gunners know the wind
  }
}

/** Screen the Flagship: the nearest escort within 150 m takes a quarter of the blow. Returns hull left for the flagship. */
export function screenFlagship(game: Game, target: ShipEntity, hull: number): number {
  if (!target.hasFlag('screen_flagship') || hull <= 0) return hull;
  let best: ShipEntity | null = null;
  let bd = 150;
  for (const e of escortsOf(game, target)) {
    const d = dist(e.state.x, e.state.y, target.state.x, target.state.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  if (!best) return hull;
  const share = hull * 0.25;
  best.hull -= share;
  best.lastCombat = game.now;
  if (best.hull <= 0) {
    best.hull = 0;
    game.beginSinking(best);
  }
  return hull - share;
}

/** Admiral's Eye: what your glass (and at rank 2 your escorts) can read of every ship near. */
export function admiralsEye(game: Game, ship: ShipEntity): { id: number; hull: number; crew: number; morale: number; port: boolean; starboard: boolean }[] {
  const r = tx(ship.stats, 'admiralsEye');
  if (r <= 0) return [];
  const out: { id: number; hull: number; crew: number; morale: number; port: boolean; starboard: boolean }[] = [];
  const seen = new Set<number>();
  const eyes = [ship, ...(r >= 2 ? escortsOf(game, ship) : [])];
  const range = r >= 2 ? 900 : 600;
  for (const eye of eyes) {
    game.forShipsNear(eye.state.x, eye.state.y, range, (o) => {
      if (o.id === ship.id || seen.has(o.id) || !o.alive || o.hasFlag('hidden')) return;
      if (dist(o.state.x, o.state.y, eye.state.x, eye.state.y) > range) return;
      seen.add(o.id);
      out.push({ id: o.id, hull: Math.round((o.hull / o.stats.hullMax) * 100), crew: o.crew, morale: Math.round(o.morale), port: o.reload.port <= 0, starboard: o.reload.starboard <= 0 });
    });
  }
  return out;
}

// ------------------------------------------------------------------ Command actives

export function commandActive(game: Game, s: PlayerSession, id: string, x?: number, y?: number): string | null {
  const ship = s.ship!;
  const now = game.now;
  switch (id) {
    case 'cmd_rally':
      ship.morale = Math.min(100, ship.morale + 20);
      ship.effects = ship.effects.filter((e) => e.id !== 'panic');
      ship.recompute(now);
      return null;
    case 'cmd_sea_shanty': {
      if (ship.inCombat(now)) return 'Not with shot flying';
      const r = ship.rank('cmd_sea_shanty');
      ship.sanity = Math.min(100, ship.sanity + 15);
      ship.morale = Math.min(100, ship.morale + 5 * r);
      game.toastShip(ship, '"Haul away, joe!" The whole crew joins the shanty.', 'good');
      return null;
    }
    case 'cmd_cat_o_nine_tails': {
      ship.morale = Math.min(100, ship.morale + 30);
      const out = Math.max(1, Math.round(ship.crew * 0.03));
      if (ship.crew > out + 1) {
        const hurt = Math.ceil(out / 2);
        ship.crew -= out;
        ship.wounded += hurt;
      }
      game.toastShip(ship, 'A flogging before the mast. Nobody meets your eye; everybody jumps to it.', 'info');
      return null;
    }
    case 'cmd_concentrate_fire': {
      const px = Number.isFinite(x) ? x! : ship.state.x, py = Number.isFinite(y) ? y! : ship.state.y;
      let best: ShipEntity | null = null;
      let bd = 300;
      game.forShipsNear(px, py, 300, (o) => {
        if (o.id === ship.id || o.ownerId === ship.id || !o.alive) return;
        const d = dist(o.state.x, o.state.y, px, py);
        if (d < bd) {
          bd = d;
          best = o;
        }
      });
      if (!best) return 'No ship near the mark';
      const t = best as ShipEntity;
      // The same mark as the Admiral's Mark Target: the stronger (they are equal) simply refreshes.
      t.addEffect({ id: 'marked', until: now + 10, mods: { incomingDamageMul: 0.15 }, source: ship.id }, now);
      for (const e of escortsOf(game, ship)) {
        const b = game.npcs.get(e.id);
        if (b) b.target = t.id;
      }
      return null;
    }
    case 'cmd_black_flag': {
      ship.addEffect({ id: 'black_flag', until: now + 20 }, now);
      game.forShipsNear(ship.state.x, ship.state.y, 500, (o) => {
        if (o.id === ship.id || !o.alive || o.ownerId === ship.id) return;
        const d = dist(o.state.x, o.state.y, ship.state.x, ship.state.y);
        if (o.npcRole === 'merchant' && o.morale < 60) {
          const b = game.npcs.get(o.id);
          if (game.rng.chance(0.5)) {
            o.surrendered = true;
            if (b) b.surrenderedAt = now;
            game.toastNear(o, `${o.name} sees the black flag and strikes her colours!`);
          } else if (b) b.fleeFrom = ship.id;
        }
        if (d <= 300 && (game.isHostile(o, ship) || o.npcRole === 'merchant')) o.morale = Math.max(0, o.morale - 10);
      });
      if (REGIONS[ship.region].safety === 'contested') ship.addEffect({ id: 'aggressor', until: now + 300 }, now);
      game.emit({ k: 'fx', fx: 'war_cry', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 500 }, ship.state.x, ship.state.y);
      return null;
    }
  }
  return 'Unknown order';
}
