// Sieges (docs/01 §9.4–9.5, docs/02 §12.A.3). Nothing happens outside the owner's daily two-hour window, so
// an island is never raided while its people sleep.
//  1. Declaration — contested water: at a harbour office in the region, 15% of a week's rent (at least
//     10 000); lawless water: the Confederacy's Black Mark, 25 000, at one of its ports. Never on the Crown's
//     coast, never within the 72-hour shield after a siege, one siege per island per week.
//  2. Notice — 24 hours; the owner and their allies are told, and the taverns talk of mercenaries wanted.
//  3. Bombardment (the first window after the notice) — shot that falls on the island batters its batteries
//     (3 000 each) and the fort (12 000); mortars hit three times as hard. Silence them all within the
//     window, or the siege fails and the island is shielded for 72 hours.
//  4. Fortification — 18 to 30 hours: the defenders repair with planks from the store and bring powder.
//  5. The landing (the next window) — hold the landing point for ten minutes with no defending ship within
//     400 m and more hands than the garrison (60 a barracks); each side counts at most 60 fleet points
//     within 3 km (a sloop 1 … a man-o'-war 10, escorts half): a side over the limit neither takes nor holds.
//  6. The victor chooses: capture (the lease to its end, the buildings at half), plunder (30% of the store
//     on the beach and 30% of the treasury as contribution) or raze. Then 72 hours' peace.

import { dist } from '../../../shared/src/math.ts';
import type { SiegeView } from '../../../shared/src/protocol.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { activeWar, guildOfShip } from './guilds.ts';
import { has, holdingsFor, island, mayUse, rentPrice, strength } from './holdings.ts';
import type { Holding, Owner } from './holdings.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import type { ShipEntity } from './ship.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const WINDOW_MS = 2 * HOUR;
export const SHIELD_MS = 72 * HOUR;
export const BATTERY_HP = 3000;
export const FORT_HP = 12000;
export const LANDING_SEC = 600;
export const POINT_LIMIT = 60;
const LANDING_R = 400;

export const FLEET_POINTS: Partial<Record<ShipClassId, number>> = { sloop: 1, cutter: 1, schooner: 2, brigantine: 2, fluyt: 2, brig: 3, frigate: 5, galleon: 6, ghost_ship: 7, man_o_war: 10, xebec: 2, bomb_ketch: 3 };

export interface Siege {
  attacker: Owner;
  declared: number;
  phase: 'notice' | 'bombard' | 'fortify' | 'landing' | 'choose';
  windowStart: number;
  windowEnd: number;
  batteries: number[]; // HP of each battery
  fort: number; // HP of the fort (0 = none or silenced)
  fortMax: number;
  capture: number;
  choiceUntil: number;
  notes: string[];
}

// ------------------------------------------------------------------------------------------ sides

function accountOf(game: Game, ship: ShipEntity): number | null {
  return ship.accountId ?? (ship.ownerId !== null ? game.ships.get(ship.ownerId)?.accountId ?? null : null);
}

/** Whether a ship fights for this side (the captain, or the guild and its allies). */
function onSide(game: Game, side: Owner, ship: ShipEntity): boolean {
  const acct = accountOf(game, ship);
  if (acct === null) return false;
  if (side.kind === 'player') return acct === side.id;
  const g = guildOfShip(game, ship);
  return !!g && (g.id === side.id || g.alliance.includes(side.id));
}

function sideOf(game: Game, s: PlayerSession): Owner {
  const g = game.guilds.of(game, s.accountId);
  return g ? { kind: 'guild', id: g.id, name: `${g.name} [${g.tag}]` } : { kind: 'player', id: s.accountId, name: s.name };
}

function mayCommand(game: Game, side: Owner, s: PlayerSession): boolean {
  if (side.kind === 'player') return side.id === s.accountId;
  const g = game.guilds.of(game, s.accountId);
  const m = g?.members.find((x) => x.account === s.accountId);
  return !!g && g.id === side.id && !!m && ['admiral', 'vice', 'commodore'].includes(m.rank);
}

function tellSide(game: Game, side: Owner, subject: string, body: string): void {
  if (side.kind === 'player') deliver(game, side.id, { from: 'The Harbour Master', subject, body, gold: 0, goods: null });
  else game.guildNotify?.(side.id, subject, body);
}

/** The next start of the owner's daily window at or after `after`. */
export function nextWindow(h: Holding, after: number): number {
  const d = new Date(after);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h.window);
  while (t < after) t += DAY;
  return t;
}

/** The landing point: off the beach on the island's seaward side. */
export function landingPoint(isl: Island): { x: number; y: number } {
  return { x: isl.x + isl.radius + 150, y: isl.y };
}

// ------------------------------------------------------------------------------------------ declaring

export function declareSiege(game: Game, s: PlayerSession, islandId: number): string | null {
  const h = game.holdings.get(game, islandId);
  const isl = island(game, islandId);
  if (!h || !isl) return 'Nobody holds that island';
  const side = sideOf(game, s);
  if (!mayCommand(game, side, s)) return 'Commodores and up lead a guild’s siege';
  if (mayUse(game, h, s.accountId)) return 'That island is yours';
  const safety = REGIONS[isl.region].safety;
  if (safety === 'safe') return 'No sieges on the Crown’s coast';
  const port = s.ship?.docked ? game.portById(s.ship.docked) : undefined;
  if (safety === 'contested' && port?.region !== isl.region) return `Declare at a harbour office in ${REGIONS[isl.region].name}`;
  if (safety === 'lawless' && port?.faction !== 'confederacy') return 'The Black Mark is bought from the Confederacy, in one of its ports';
  if (h.siege) return 'The island is already under siege';
  const now = game.wallNow();
  if (h.shieldUntil > now) return `The island is shielded until ${new Date(h.shieldUntil).toUTCString().slice(5, 22)} UTC`;
  if (now - h.lastSiege < 7 * DAY) return 'One siege a week on any island';
  if (h.owner.kind === 'guild' && side.kind === 'guild') {
    const g = game.guilds.get(game, side.id);
    if (g && (g.alliance.includes(h.owner.id) || g.pacts.includes(h.owner.id))) return 'Not against an ally or a pact';
  }
  const cost = safety === 'lawless' ? 25_000 : Math.max(10_000, Math.round(rentPrice(isl, 7) * 0.15));
  if (side.kind === 'guild') {
    const g = game.guilds.get(game, side.id)!;
    if (g.treasury < cost) return `The declaration costs ${cost} from the guild treasury`;
    g.treasury -= cost;
    game.guilds.touch();
  } else {
    if (s.profile!.gold < cost) return `The declaration costs ${cost} silver`;
    s.profile!.gold -= cost;
  }
  game.db.ledger(s.accountId, 'siege_declared', side.kind === 'player' ? -cost : 0, `${isl.id}:${cost}`);
  const start = nextWindow(h, now + DAY);
  const batteries = h.buildings.filter((b) => b.id === 'battery').map((b) => Math.round(BATTERY_HP * b.condition));
  const fortMax = has(h, 'fort') ? FORT_HP : 0;
  h.siege = { attacker: side, declared: now, phase: 'notice', windowStart: start, windowEnd: start + WINDOW_MS, batteries, fort: Math.round(fortMax * (has(h, 'fort')?.condition ?? 0)), fortMax, capture: 0, choiceUntil: 0, notes: [] };
  game.holdings.touch();
  const when = `${new Date(start).toUTCString().slice(5, 22)} UTC`;
  tellSide(game, h.owner, `${isl.name} is besieged`, `${side.name} declares a siege. The bombardment may begin in your window, ${when}. Mercenaries are being sought in the taverns.`);
  tellSide(game, side, `Siege declared: ${isl.name}`, `The bombardment opens at ${when} and lasts two hours. Silence the batteries${fortMax ? ' and the fort' : ''}.`);
  game.addRumor(isl.x, isl.y, `${side.name} will lay siege to ${isl.name}; its holders pay well for guns.`);
  return null;
}

// ------------------------------------------------------------------------------------------ the fighting

/** Shot or a mortar shell lands at (x, y): if it falls on an island in its bombardment, it batters the defences. */
export function siegeImpact(game: Game, x: number, y: number, damage: number, owner: number, mortar: boolean): void {
  if (damage <= 0) return;
  const holdings = game.holdings.map(game);
  for (const h of Object.values(holdings)) {
    const sg = h.siege;
    if (!sg || sg.phase !== 'bombard') continue;
    const isl = island(game, h.island);
    if (!isl || dist(isl.x, isl.y, x, y) > isl.radius + 40) continue;
    const shooter = game.ships.get(owner);
    if (!shooter || !onSide(game, sg.attacker, shooter)) return;
    let d = damage * (mortar ? 3 : 1);
    // The batteries first, then the fort walls.
    for (let i = 0; i < sg.batteries.length && d > 0; i++) {
      const take = Math.min(sg.batteries[i], d);
      sg.batteries[i] -= take;
      d -= take;
      if (take > 0 && sg.batteries[i] <= 0) silence(game, h, 'battery', i);
    }
    if (d > 0 && sg.fort > 0) {
      sg.fort = Math.max(0, sg.fort - d);
      if (sg.fort <= 0) silence(game, h, 'fort', 0);
    }
    game.holdings.touch();
    return;
  }
}

function silence(game: Game, h: Holding, what: 'battery' | 'fort', index: number): void {
  const list = h.buildings.filter((b) => b.id === what);
  const b = list[Math.min(index, list.length - 1)];
  if (b) b.condition = 0.01; // silenced, not gone: the defenders can rebuild in the lull
  const isl = island(game, h.island)!;
  h.siege?.notes.push(`${what === 'fort' ? 'The fort' : 'A battery'} on ${isl.name} is silenced.`);
  game.emit({ k: 'fx', fx: 'barrage', x: Math.round(isl.x), y: Math.round(isl.y), r: 120 }, isl.x, isl.y);
}

/** In the lull: planks from the store raise a silenced battery (50) or the fort (200). */
export function fortify(game: Game, s: PlayerSession, islandId: number): string | null {
  const h = game.holdings.get(game, islandId);
  const isl = island(game, islandId);
  if (!h || !isl || !mayUse(game, h, s.accountId)) return 'Not your island';
  const sg = h.siege;
  if (!sg || sg.phase !== 'fortify') return 'Repairs under siege are made in the lull between the windows';
  if (s.ship?.docked || !s.ship || dist(s.ship.state.x, s.ship.state.y, isl.x, isl.y) - isl.radius > 800) return `At ${isl.name}`;
  let done = 0;
  for (let i = 0; i < sg.batteries.length; i++) {
    if (sg.batteries[i] >= BATTERY_HP || (h.store.planks ?? 0) < 50) continue;
    h.store.planks = (h.store.planks ?? 0) - 50;
    sg.batteries[i] = BATTERY_HP;
    const b = h.buildings.filter((x) => x.id === 'battery')[i];
    if (b) b.condition = 1;
    done++;
  }
  if (sg.fortMax && sg.fort < sg.fortMax && (h.store.planks ?? 0) >= 200) {
    h.store.planks = (h.store.planks ?? 0) - 200;
    sg.fort = sg.fortMax;
    const f = h.buildings.find((x) => x.id === 'fort');
    if (f) f.condition = 1;
    done++;
  }
  if (!h.store.planks) delete h.store.planks;
  if (!done) return 'Nothing to repair, or not enough planks in the store (50 a battery, 200 the fort)';
  game.holdings.touch();
  return null;
}

function points(game: Game, side: Owner, isl: Island): { points: number; crew: number; near: ShipEntity[] } {
  let pts = 0, crew = 0;
  const near: ShipEntity[] = [];
  game.forShipsNear(isl.x, isl.y, isl.radius + 3000, (o) => {
    if (!o.alive || o.docked || !onSide(game, side, o)) return;
    if (dist(o.state.x, o.state.y, isl.x, isl.y) - isl.radius > 3000) return;
    const p = FLEET_POINTS[o.loadout.classId] ?? o.cls.tier;
    pts += o.isPlayer ? p : p * 0.5;
    near.push(o);
    crew += o.crew;
  });
  return { points: pts, crew, near };
}

/** The island's guns turn on the besiegers while the siege is on. */
export function besieging(game: Game, h: Holding, ship: ShipEntity): boolean {
  const sg = h.siege;
  if (!sg || sg.phase === 'notice' || sg.phase === 'choose') return false;
  return onSide(game, sg.attacker, ship);
}

/** Every second. */
export function stepSieges(game: Game): void {
  const wall = game.wallNow();
  for (const h of Object.values(game.holdings.map(game))) {
    const sg = h.siege;
    if (!sg) continue;
    const isl = island(game, h.island)!;
    if (game.zone && !game.zone.regions.has(isl.region)) continue; // the island's own zone runs its siege
    switch (sg.phase) {
      case 'notice':
        if (wall < sg.windowStart) break;
        if (sg.batteries.every((x) => x <= 0) && sg.fort <= 0) {
          sg.phase = 'landing'; // nothing to bombard: straight to the landing, in this window
          announce(game, h, isl, `The siege of ${isl.name}: no guns to silence — the landing is on.`);
        } else {
          sg.phase = 'bombard';
          announce(game, h, isl, `The bombardment of ${isl.name} begins: two hours to silence its guns.`);
        }
        game.holdings.touch();
        break;
      case 'bombard':
        if (sg.batteries.every((x) => x <= 0) && sg.fort <= 0) {
          sg.phase = 'fortify';
          const lull = (18 + game.rng.float() * 12) * HOUR;
          sg.windowStart = nextWindow(h, wall + lull);
          sg.windowEnd = sg.windowStart + WINDOW_MS;
          announce(game, h, isl, `${isl.name}'s guns are silent. The landing comes in the window of ${new Date(sg.windowStart).toUTCString().slice(5, 22)} UTC.`);
          game.holdings.touch();
        } else if (wall >= sg.windowEnd) end(game, h, isl, false, 'The guns held out through the window.');
        break;
      case 'fortify':
        if (wall >= sg.windowStart) {
          sg.phase = 'landing';
          sg.capture = 0;
          announce(game, h, isl, `The landing at ${isl.name} begins: ten minutes on the beach decide it.`);
          game.holdings.touch();
        }
        break;
      case 'landing': {
        if (wall >= sg.windowEnd) {
          end(game, h, isl, false, 'The landing party never held the beach.');
          break;
        }
        const pt = landingPoint(isl);
        const att = points(game, sg.attacker, isl);
        const def = points(game, h.owner, isl);
        const attAt = att.near.filter((o) => dist(o.state.x, o.state.y, pt.x, pt.y) < LANDING_R);
        const defAt = def.points <= POINT_LIMIT ? def.near.filter((o) => dist(o.state.x, o.state.y, pt.x, pt.y) < LANDING_R) : [];
        const garrison = 60 * strength(h, 'barracks');
        const hands = attAt.reduce((a, o) => a + o.crew, 0);
        if (attAt.length && !defAt.length && att.points <= POINT_LIMIT && hands > garrison) {
          sg.capture++;
          if (sg.capture % 5 === 0) pushParties(game, h, sg.attacker);
          if (sg.capture >= LANDING_SEC) {
            sg.phase = 'choose';
            sg.choiceUntil = wall + 10 * 60_000;
            tellSide(game, sg.attacker, `${isl.name} has fallen`, 'Choose: capture, plunder or raze (ten minutes; plunder if you do not).');
            announce(game, h, isl, `${isl.name} falls to ${sg.attacker.name}.`);
            // War score for guilds at war.
            if (sg.attacker.kind === 'guild' && h.owner.kind === 'guild') {
              const w = activeWar(game, sg.attacker.id, h.owner.id);
              if (w) w.score[sg.attacker.id] = (w.score[sg.attacker.id] ?? 0) + 50;
            }
          }
          game.holdings.touch();
        }
        break;
      }
      case 'choose':
        if (wall >= sg.choiceUntil) settle(game, h, isl, 'plunder');
        break;
    }
  }
}

/** Both sides' Islands screens follow the siege. */
function pushParties(game: Game, h: Holding, side: Owner | undefined): void {
  for (const s of game.sessions) {
    if (!s.ship || s.disconnectedAt !== null) continue;
    if (mayUse(game, h, s.accountId) || (side && onSide(game, side, s.ship))) game.sendTo(s, { t: 'holdings', ...holdingsFor(game, s) });
  }
}

function announce(game: Game, h: Holding, isl: Island, msg: string): void {
  h.siege?.notes.push(msg);
  pushParties(game, h, h.siege?.attacker);
  for (const s of game.sessions) {
    if (!s.ship || s.disconnectedAt !== null) continue;
    const near = dist(s.ship.state.x, s.ship.state.y, isl.x, isl.y) < isl.radius + 6000;
    const party = mayUse(game, h, s.accountId) || (h.siege && onSide(game, h.siege.attacker, s.ship));
    if (near || party) game.sendTo(s, { t: 'toast', msg, kind: 'info' });
  }
}

function end(game: Game, h: Holding, isl: Island, _won: boolean, why: string): void {
  const sg = h.siege!;
  h.siege = undefined;
  h.lastSiege = game.wallNow();
  h.shieldUntil = game.wallNow() + SHIELD_MS;
  game.holdings.touch();
  tellSide(game, h.owner, `The siege of ${isl.name} is broken`, `${why} The island is shielded for 72 hours.`);
  tellSide(game, sg.attacker, `The siege of ${isl.name} has failed`, why);
  announce(game, h, isl, `The siege of ${isl.name} has failed. ${why}`);
  pushParties(game, h, sg.attacker);
}

export function chooseOutcome(game: Game, s: PlayerSession, islandId: number, choice: 'capture' | 'plunder' | 'raze'): string | null {
  const h = game.holdings.get(game, islandId);
  const isl = island(game, islandId);
  if (!h || !isl || !h.siege || h.siege.phase !== 'choose') return 'Nothing to decide';
  if (!mayCommand(game, h.siege.attacker, s)) return 'Your commander decides';
  if (!['capture', 'plunder', 'raze'].includes(choice)) return 'Capture, plunder or raze';
  settle(game, h, isl, choice);
  return null;
}

function settle(game: Game, h: Holding, isl: Island, choice: 'capture' | 'plunder' | 'raze'): void {
  const sg = h.siege!;
  const loser = h.owner;
  h.siege = undefined;
  h.lastSiege = game.wallNow();
  h.shieldUntil = game.wallNow() + SHIELD_MS;
  let what = '';
  if (choice === 'capture') {
    h.owner = sg.attacker;
    for (const b of h.buildings) b.condition = Math.max(0.05, b.condition * 0.5);
    h.base = 0;
    what = `${sg.attacker.name} takes ${isl.name}: the lease runs to its end, the buildings stand at half.`;
  } else if (choice === 'plunder') {
    // A third of the store on the beach, and a contribution of 30% of the treasury.
    const loot: Cargo = {};
    for (const [g, n] of Object.entries(h.store)) {
      const k = Math.floor((n ?? 0) * 0.3);
      if (k <= 0) continue;
      loot[g as GoodId] = k;
      h.store[g as GoodId] = (n ?? 0) - k;
    }
    if (Object.keys(loot).length) {
      const id = game.allocId();
      const pt = landingPoint(isl);
      game.loot.set(id, { id, x: pt.x, y: pt.y, cargo: loot, gold: 0, expires: game.now + 1800 });
    }
    const contribution = Math.floor(h.treasury * 0.3);
    h.treasury -= contribution;
    if (sg.attacker.kind === 'guild') {
      const g = game.guilds.get(game, sg.attacker.id);
      if (g) g.treasury += contribution;
      game.guilds.touch();
    } else deliver(game, sg.attacker.id, { from: `The people of ${isl.name}`, subject: 'Contribution', body: 'Paid to be spared.', gold: contribution, goods: null });
    what = `${sg.attacker.name} plunders ${isl.name}: ${contribution} in contribution, and a third of the store lies on the beach.`;
  } else {
    h.buildings = [];
    h.base = 0;
    what = `${sg.attacker.name} razes ${isl.name} to the rock.`;
  }
  game.holdings.touch();
  tellSide(game, loser, `${isl.name}: the siege is lost`, what);
  tellSide(game, sg.attacker, `${isl.name}: the siege is won`, what);
  announce(game, h, isl, what);
  pushParties(game, h, sg.attacker);
}

// ------------------------------------------------------------------------------------------ views

export function siegeView(game: Game, h: Holding, accountId: number): SiegeView | null {
  const sg = h.siege;
  if (!sg) return null;
  const isl = island(game, h.island)!;
  const pt = landingPoint(isl);
  const s = game.sessionByAccount(accountId);
  const attacking = !!s?.ship && (sg.attacker.kind === 'player' ? sg.attacker.id === accountId : game.guilds.of(game, accountId)?.id === sg.attacker.id);
  return {
    island: h.island, name: isl.name, attacker: sg.attacker.name, defender: h.owner.name, attacking, phase: sg.phase,
    windowStart: sg.windowStart, windowEnd: sg.windowEnd, batteries: sg.batteries.map((b) => Math.round((b / BATTERY_HP) * 100)), fort: sg.fortMax ? Math.round((sg.fort / sg.fortMax) * 100) : null,
    capture: Math.round((sg.capture / LANDING_SEC) * 100), landing: { x: Math.round(pt.x), y: Math.round(pt.y) }, choiceUntil: sg.choiceUntil, notes: sg.notes.slice(-6),
  };
}

/** Sieges this captain is part of, on either side. */
export function siegesFor(game: Game, s: PlayerSession): SiegeView[] {
  const out: SiegeView[] = [];
  const g = game.guilds.of(game, s.accountId);
  for (const h of Object.values(game.holdings.map(game))) {
    const sg = h.siege;
    if (!sg) continue;
    const mine = mayUse(game, h, s.accountId) || (sg.attacker.kind === 'player' ? sg.attacker.id === s.accountId : g?.id === sg.attacker.id || !!g?.alliance.includes(sg.attacker.id));
    if (mine) out.push(siegeView(game, h, s.accountId)!);
  }
  return out;
}
