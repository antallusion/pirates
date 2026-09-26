// Situational talent rules (docs/03_TALENT_TREES.md §4): the parts of a talent that depend on where the ship
// is, who is near and what just happened. Static numbers live in the talent data and ShipStats; this module
// turns positions and events into short status effects so the same stat pipeline (and client prediction) applies.

import { TALENTS_BY_ID } from '../../../shared/src/data/talents.ts';
import { angleDiff, dist, headingVec, toShipLocal, wrapAngle } from '../../../shared/src/math.ts';
import type { Side } from '../../../shared/src/protocol.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { applyDamage } from './combat.ts';
import { launchJollyBoat } from './prizes.ts';
import { decoyBarrels, falseColors, slipAway } from './smugglefx.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

const PULSE = 1.6; // seconds a positional effect lasts; refreshed every second while the condition holds

/** Direction the wind blows toward at the ship. */
function windTo(game: Game, ship: ShipEntity): number {
  return game.windFor(ship).dir;
}

/** `a` holds the weather gauge on `b`: the wind blows from a toward b (within 45°). */
export function upwindOf(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  const bearing = Math.atan2(b.state.x - a.state.x, -(b.state.y - a.state.y));
  return Math.abs(angleDiff(bearing, windTo(game, a))) < Math.PI / 4;
}

function pulse(game: Game, ship: ShipEntity, id: string, mods: Record<string, number>, source?: number): void {
  ship.addEffect({ id, until: game.now + PULSE, mods, source }, game.now);
}

/** Once per second for each player ship at sea. */
export function stepTalents(game: Game, ship: ShipEntity): void {
  if (!ship.alive || ship.docked) return;
  const now = game.now;
  const st = ship.stats;
  let hostileNear = false;
  let gauge = false;
  game.forShipsNear(ship.state.x, ship.state.y, 1000, (o) => {
    if (o.id === ship.id || !o.alive || o.docked) return;
    const d = dist(o.state.x, o.state.y, ship.state.x, ship.state.y);
    const hostile = game.isHostile(o, ship);
    if (hostile) hostileNear = true;
    // Wake Rider: within 120 m astern of any ship, roughly on her track.
    if (st.flags.has('wake_rider') && d < 140 + o.stats.length / 2) {
      const local = toShipLocal(ship.state.x, ship.state.y, o.state.x, o.state.y, o.state.heading);
      if (local.y < -o.stats.length / 2 && local.y > -o.stats.length / 2 - 120 && Math.abs(local.x) < o.stats.beam * 1.5) {
        pulse(game, ship, 'wake_rider', { maxSpeed: 0.05 * ship.rank('nav_wake_rider') });
      }
    }
    if (!hostile || !upwindOf(game, ship, o)) return;
    if (st.flags.has('weather_gauge') && d < 450) gauge = true;
    if (st.flags.has('stolen_wind') && d < 250) pulse(game, o, 'stolen_wind', { maxSpeed: -0.15 }, ship.id);
    if (st.flags.has('lee_shore') && d < 450 && leeShore(game, ship, o)) pulse(game, o, 'lee_shore', { accel: -0.2, turnRate: -0.1 }, ship.id);
  });
  if (gauge) pulse(game, ship, 'weather_gauge', { maxSpeed: 0.08 });
  if (st.flags.has('trade_winds') && !hostileNear && !ship.inCombat(now)) pulse(game, ship, 'trade_winds', { maxSpeed: 0.05 * ship.rank('nav_trade_winds') });
  // Second Wind.
  if (st.flags.has('second_wind') && ship.hull < st.hullMax * 0.3 && (ship.talentReady.second_wind ?? 0) <= now) {
    ship.talentReady.second_wind = now + 90;
    ship.addEffect({ id: 'second_wind', until: now + 8, mods: { maxSpeed: 0.25, accel: 0.25 } }, now);
    game.toastShip(ship, 'Second wind! Every hand to the sheets.', 'good');
  }
  stepHeat(game, ship);
  stepSwivels(game, ship);
}

/** Land or shoal within 250 m downwind of the victim. */
function leeShore(game: Game, ship: ShipEntity, victim: ShipEntity): boolean {
  const v = headingVec(windTo(game, ship));
  for (let d = 50; d <= 250; d += 50) {
    const x = victim.state.x + v.x * d, y = victim.state.y + v.y * d;
    if (isLand(game.world, x, y)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ status effects that tick

/** Breaches leak hull through the armour; called once per second for every ship. */
export function stepTalentEffects(game: Game, ship: ShipEntity): void {
  for (const e of ship.effects) {
    if (e.id === 'breach' && e.until > game.now) {
      const src = e.source !== undefined ? game.ships.get(e.source) ?? null : null;
      applyDamage(game, ship, { hull: ship.stats.hullMax * 0.01 }, src);
    }
  }
}

// ------------------------------------------------------------------ Red-Hot Barrels

export function addHeat(game: Game, ship: ShipEntity, side: Side): void {
  if (!ship.hasFlag('red_hot')) return;
  ship.heat[side] += 12;
  if (ship.heat[side] >= 70) game.emit({ k: 'fx', fx: 'hot_barrels', x: Math.round(ship.state.x), y: Math.round(ship.state.y) }, ship.state.x, ship.state.y);
  if (ship.heat[side] >= 100) {
    ship.heat[side] = 50;
    if (ship.gunsDisabled[side] < ship.stats.gunsPerSide) ship.gunsDisabled[side]++;
    applyDamage(game, ship, { hull: ship.stats.hullMax * 0.04, crew: 3, morale: 4 }, null);
    game.emit({ k: 'fx', fx: 'explosion', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 18 }, ship.state.x, ship.state.y);
    game.toastShip(ship, `A ${side} gun bursts from the heat!`, 'bad');
  }
}

function stepHeat(game: Game, ship: ShipEntity): void {
  if (!ship.hasFlag('red_hot')) return;
  for (const side of ['port', 'starboard'] as Side[]) {
    if (ship.reload[side] > 0) continue;
    // A loaded side holding its fire for 10 s cools down.
    if (game.now - ship.loadedSince[side] >= 10) ship.heat[side] = Math.max(0, ship.heat[side] - 10);
  }
}

// ------------------------------------------------------------------ Swivel Guns

function stepSwivels(game: Game, ship: ShipEntity): void {
  const shots = tx(ship.stats, 'swivels');
  if (shots <= 0 || (ship.talentReady.swivels ?? 0) > game.now || ship.boarding) return;
  const targets: ShipEntity[] = [];
  game.forShipsNear(ship.state.x, ship.state.y, 60 + ship.stats.length, (o) => {
    if (o.id === ship.id || !o.alive || o.docked || !game.isHostile(o, ship)) return;
    if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) - o.stats.length / 2 <= 60) targets.push(o);
  });
  if (!targets.length) return;
  ship.talentReady.swivels = game.now + 4;
  for (let i = 0; i < shots; i++) {
    const o = targets[i % targets.length];
    if (game.rng.chance(0.75)) applyDamage(game, o, { crew: 1, morale: 1 }, ship);
    game.emit({ k: 'hit', x: Math.round(o.state.x), y: Math.round(o.state.y), ship: o.id, dmg: 1, ammo: 'grape' }, o.state.x, o.state.y);
  }
}

// ------------------------------------------------------------------ active talents

export function useTalentActive(game: Game, s: PlayerSession, id: string): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  const def = TALENTS_BY_ID[id];
  if (!def?.active) return 'Not an active talent';
  if (ship.rank(id) <= 0) return `You have not learned ${def.name}`;
  if (!ship.alive || ship.docked || ship.boarding || ship.landing) return 'Not now';
  const now = game.now;
  if ((p.talentCooldowns[id] ?? 0) > now) return `${def.name} is not ready`;
  switch (id) {
    case 'nav_spill_the_wind':
      ship.state.speed *= 0.5;
      ship.addEffect({ id: 'spill_the_wind', until: now + 1.5, mods: { maxSpeed: -0.5 } }, now);
      ship.addEffect({ id: 'spill_turn', until: now + 5.5, mods: { turnRate: 0.4 } }, now);
      break;
    case 'nav_anchor_pivot': {
      const dir = ship.input.rudder < 0 ? -1 : 1;
      const angle = (Math.PI / 2) * (1 + Math.min(1, Math.abs(ship.input.rudder)));
      ship.pivot = { until: now + 2.5, rate: (dir * angle) / 2.5 };
      applyDamage(game, ship, { hull: ship.stats.hullMax * 0.02 }, null);
      break;
    }
    case 'smg_false_colors': {
      const why = falseColors(game, ship);
      if (why) return why;
      break;
    }
    case 'smg_slip_away': {
      const why = slipAway(game, ship);
      if (why) return why;
      break;
    }
    case 'smg_decoy_barrels':
      decoyBarrels(game, ship);
      break;
    case 'brd_jolly_boat': {
      const why = launchJollyBoat(game, ship);
      if (why) return why;
      break;
    }
    default:
      return 'Unknown active talent';
  }
  p.talentCooldowns[id] = now + def.active.cooldown * ship.stats.cooldownMul;
  game.emit({ k: 'ability', ship: ship.id, id, x: Math.round(ship.state.x), y: Math.round(ship.state.y) }, ship.state.x, ship.state.y);
  return null;
}

/** Anchor Pivot: the ship swings round her anchor and stops dead. Called in physics after sailing. */
export function stepPivot(game: Game, ship: ShipEntity, dt: number): void {
  const pv = ship.pivot;
  if (!pv) return;
  if (game.now >= pv.until) {
    ship.pivot = null;
    return;
  }
  ship.state.heading = wrapAngle(ship.state.heading + pv.rate * dt);
  ship.state.speed = Math.max(0, ship.state.speed - 6 * dt);
}
