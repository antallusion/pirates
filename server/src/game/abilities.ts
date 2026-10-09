// Captain abilities. Data lives in shared/src/data/captains.ts; this module implements the
// non-trivial effects (area damage, delayed strikes, summons, reveals). Simple buffs are pure data.

import { lairImpact } from './wanted.ts';
import { findAbility } from '../../../shared/src/data/captains.ts';
import { dist, headingOf } from '../../../shared/src/math.ts';
import { applyDamage, igniteShip, mastWreck } from './combat.ts';
import { RESOLVE_MAX, callPower, spendDread, witnessMiracle } from './mind.ts';
import { siegeImpact } from './siege.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';

export interface DelayedStrike {
  at: number;
  x: number;
  y: number;
  radius: number;
  hull: number;
  rudder: number;
  owner: number;
  slow: number; // seconds of slow applied
  shells: number; // >1 = barrage split into shells
  fx: 'deep_call' | 'maw' | 'barrage' | 'mortar';
  /** Chance a ship struck catches fire (war rockets). */
  fire?: number;
}

export function useAbility(game: Game, ship: ShipEntity, abilityId: string, tx?: number, ty?: number): string | null {
  const profile = game.profileOf(ship);
  if (!profile) return 'No captain';
  const def = findAbility(ship.captain, abilityId);
  if (!def) return 'Unknown ability';
  const now = game.now;
  if ((profile.cooldowns[def.id] ?? 0) > now) return `${def.name} is not ready`;
  if (!ship.alive || ship.docked) return 'Not at sea';
  if (def.kind === 'ultimate' && profile.level < 6) return 'Ultimates unlock at level 6';
  if (def.goldCost && profile.gold < def.goldCost) return `Needs ${def.goldCost} silver`;
  if (def.kind === 'ultimate' && ship.resolve < RESOLVE_MAX) return `${def.name} needs full resolve (${Math.floor(ship.resolve)}/100) — trade blows to build it`;
  if (def.dreadCost && ship.dread < def.dreadCost) return `${def.name} needs ${def.dreadCost} Dread (${Math.floor(ship.dread)})`;
  const power = callPower(ship);

  let x = tx ?? ship.state.x, y = ty ?? ship.state.y;
  if (def.targeting === 'point' || def.targeting === 'ship') {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 'Choose a target';
    const d = dist(ship.state.x, ship.state.y, x, y);
    const range = def.range ?? 400;
    if (d > range) {
      // Clamp to max range along the aim direction.
      x = ship.state.x + ((x - ship.state.x) / d) * range;
      y = ship.state.y + ((y - ship.state.y) / d) * range;
    }
  }

  // Ability-specific validation and effects.
  switch (def.id) {
    case 'double_shot':
      ship.doubleShotArmed = true;
      break;
    case 'war_cry': {
      ship.morale = Math.min(100, ship.morale + 20);
      game.forShipsNear(ship.state.x, ship.state.y, 300, (o) => {
        if (o.id !== ship.id && game.isHostile(o, ship)) o.morale = Math.max(0, o.morale - 15);
      });
      game.emit({ k: 'fx', fx: 'war_cry', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 300 }, ship.state.x, ship.state.y);
      break;
    }
    case 'star_fix': {
      const n = game.revealAround(ship, 7000);
      game.toastShip(ship, `Star fix taken: ${n} new islands charted.`, 'good');
      game.emit({ k: 'fx', fx: 'star_fix', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 7000 }, ship.state.x, ship.state.y);
      break;
    }
    case 'smoke_pots':
      game.emit({ k: 'fx', fx: 'smoke', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 110 }, ship.state.x, ship.state.y);
      break;
    case 'brine_mend': {
      ship.talentReady.brinePower = power;
      // Two in a hundred go into the water: the sea takes its fee.
      const lost = Math.max(1, Math.round(ship.crew * 0.02));
      if (ship.crew > lost + 1) ship.crew -= lost;
      if (ship.leaks > 0) ship.leaks--;
      ship.rudderHp = Math.min(1, ship.rudderHp + 0.3 * power);
      break;
    }
    case 'undertow': {
      const dir = headingOf(x - ship.state.x, y - ship.state.y);
      // The race starts at your bow and runs 400 m toward the mark.
      const cx = ship.state.x + Math.sin(dir) * 200, cy = ship.state.y - Math.cos(dir) * 200;
      game.zones.push({ kind: 'undertow', x: cx, y: cy, r: 200, dir, start: now, until: now + def.duration, owner: ship.id, power, hit: [] });
      game.emit({ k: 'fx', fx: 'undertow', x: Math.round(cx), y: Math.round(cy), r: 200, dir: Math.round(dir * 1000) / 1000 }, cx, cy);
      break;
    }
    case 'deep_call':
      game.zones.push({ kind: 'hands', x, y, r: 60, start: now + 1, until: now + 7, owner: ship.id, power, hit: [] });
      game.strikes.push({ at: now + 1, x, y, radius: 60, hull: 0, rudder: 0, owner: ship.id, slow: 0, shells: 1, fx: 'deep_call' });
      break;
    case 'maw_of_the_deep':
      game.strikes.push({ at: now + 3, x, y, radius: 45, hull: 0.2 * power, rudder: 0, owner: ship.id, slow: 0, shells: 1, fx: 'maw' });
      game.emit({ k: 'fx', fx: 'maw_warn', x: Math.round(x), y: Math.round(y), r: 45 }, x, y);
      break;
    case 'admiralty_barrage':
      game.strikes.push({ at: now + 3, x, y, radius: 90, hull: 120, rudder: 0, owner: ship.id, slow: 0, shells: 12, fx: 'barrage' });
      break;
    case 'mark_target': {
      let best: ShipEntity | null = null;
      let bd = 260;
      game.forShipsNear(x, y, 260, (o) => {
        if (o.id === ship.id) return;
        const d = dist(o.state.x, o.state.y, x, y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      });
      if (!best) return 'No ship near the mark';
      (best as ShipEntity).addEffect({ id: 'marked', until: now + def.duration, mods: { incomingDamageMul: 0.15 }, source: ship.id }, now);
      break;
    }
    case 'form_line':
      game.forShipsNear(ship.state.x, ship.state.y, 500, (o) => {
        if (o.id !== ship.id && (o.ownerId === ship.id || game.areAllies(o, ship))) {
          o.addEffect({ id: 'form_line', until: now + def.duration, mods: def.mods, source: ship.id }, now);
        }
      });
      break;
    case 'call_escort': {
      const err = game.spawnEscort(ship, def.duration);
      if (err) return err;
      break;
    }
    default:
      break;
  }

  if (def.goldCost) game.spendGold(ship, def.goldCost, `ability:${def.id}`);
  if (def.moraleCost) ship.morale = Math.max(0, ship.morale - def.moraleCost);
  if (def.kind === 'ultimate') ship.resolve = 0;
  if (def.dreadCost) spendDread(ship, def.dreadCost);
  if (ship.captain === 'drowned') witnessMiracle(game, ship, def.kind === 'ultimate');
  if (def.duration > 0 && (def.mods || def.flags)) {
    ship.addEffect({ id: def.id, until: now + def.duration, mods: def.mods, flags: def.flags }, now);
  } else if (def.duration > 0) {
    ship.addEffect({ id: def.id, until: now + def.duration }, now);
  }
  // Faster cooldowns (the Signal Hoist banner and the like) count on Z/X/C/V as on the talents (docs/25 item 10).
  profile.cooldowns[def.id] = now + def.cooldown * ship.stats.cooldownMul;
  game.emit({ k: 'ability', ship: ship.id, id: def.id, x: Math.round(x), y: Math.round(y) }, ship.state.x, ship.state.y);
  return null;
}

export function stepStrikes(game: Game): void {
  const now = game.now;
  const keep: DelayedStrike[] = [];
  for (const s of game.strikes) {
    if (s.at > now) {
      keep.push(s);
      continue;
    }
    const owner = game.ships.get(s.owner) ?? null;
    if (s.shells > 1) {
      for (let i = 0; i < s.shells; i++) {
        const a = game.rng.float() * Math.PI * 2, r = Math.sqrt(game.rng.float()) * s.radius;
        const sx = s.x + Math.sin(a) * r, sy = s.y - Math.cos(a) * r;
        siegeImpact(game, sx, sy, s.hull, s.owner, true); // mortar shells on a besieged island
        lairImpact(game, sx, sy, s.hull, s.owner);
        game.forShipsNear(sx, sy, 60, (o) => {
          if (o.id === s.owner || !o.alive) return;
          if (dist(o.state.x, o.state.y, sx, sy) >= o.stats.length / 2 + 12) return;
          applyDamage(game, o, { hull: s.hull, crew: 1, morale: 2 }, owner);
          if (s.fire && game.rng.chance(s.fire)) igniteShip(game, o, 10, owner);
        });
      }
    } else if (s.fx === 'maw') {
      // The Maw: a fifth of every hull inside (to 4 000, through armour and the volley cap), a mast and two leaks.
      game.forShipsNear(s.x, s.y, s.radius + 40, (o) => {
        if (o.id === s.owner || !o.alive) return;
        if (dist(o.state.x, o.state.y, s.x, s.y) > s.radius + o.stats.length / 3) return;
        applyDamage(game, o, { hull: Math.min(4000, o.stats.hullMax * s.hull), crew: 2, morale: 8 }, owner);
        o.leaks = Math.min(8, o.leaks + 2);
        if (!o.hasFlag('ironbound_masts') && !o.hasEffect('broken_mast')) {
          o.addEffect({ id: 'broken_mast', until: now + 1e9, mods: { maxSpeed: -0.3 }, source: s.owner }, now);
          mastWreck(game, o);
        }
      });
      game.zones.push({ kind: 'maw_pull', x: s.x, y: s.y, r: s.radius * 2, inner: s.radius * 0.5, start: now, until: now + 3, owner: s.owner, power: 1, hit: [] });
      // Everything in the deep within 2 km heard it.
      for (const [id, b] of game.npcs) {
        const o = game.ships.get(id);
        if (b.role === 'ghost' && o && owner && dist(o.state.x, o.state.y, s.x, s.y) < 2000) b.chase = { id: owner.id, until: now + 120 };
      }
    } else if (s.fx === 'deep_call') {
      game.emit({ k: 'fx', fx: 'drowned_hands', x: Math.round(s.x), y: Math.round(s.y), r: s.radius }, s.x, s.y);
    } else {
      siegeImpact(game, s.x, s.y, s.hull, s.owner, true);
      lairImpact(game, s.x, s.y, s.hull, s.owner);
      game.forShipsNear(s.x, s.y, s.radius + 40, (o) => {
        if (o.id === s.owner || !o.alive) return;
        if (dist(o.state.x, o.state.y, s.x, s.y) > s.radius + o.stats.length / 3) return;
        applyDamage(game, o, { hull: s.hull, rudder: s.rudder, crew: 2, morale: 8 }, owner);
        if (s.slow > 0) o.addEffect({ id: 'maw_slow', until: now + s.slow, mods: { maxSpeed: -0.4, turnRate: -0.3 }, source: s.owner }, now);
      });
    }
    game.emit({ k: 'fx', fx: s.fx, x: Math.round(s.x), y: Math.round(s.y), r: s.radius }, s.x, s.y);
  }
  game.strikes = keep;
}
