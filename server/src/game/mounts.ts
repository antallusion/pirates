// Deck mounts: special weapons on a pivot, one per ship, fired at the cursor (right mouse).
//  mortar      — indirect bomb at a point, long flight, scatter grows with range
//  harpoon     — cable tether: the target cannot run, the pair is pulled together
//  chain_gun   — swivel firing three chain balls in any direction
//  abyssal_lance — a cold beam that needs (and feeds) the curse

import { harpoonBeast } from './beasts.ts';
import { AMMO, MOUNTS } from '../../../shared/src/data/ships.ts';
import type { MountId } from '../../../shared/src/data/ships.ts';
import { DEG, dist, headingVec, segmentHitsHull } from '../../../shared/src/math.ts';
import { curseStage } from '../../../shared/src/protocol.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { applyDamage, damageBlocked } from './combat.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';

export interface Tether {
  target: number;
  until: number;
  length: number;
  strain: number;
}

export function mountReloadTime(ship: ShipEntity): number {
  if (!ship.loadout.mount) return 1;
  const bomb = ship.cls.passive.id === 'bomb_vessel' && ship.loadout.mount === 'mortar' ? 0.5 : 1;
  const lore = ship.loadout.mount === 'mortar' && ship.hasFlag('mortar_lore') ? 0.8 : 1;
  return MOUNTS[ship.loadout.mount].reload * ship.stats.reloadMul * bomb * lore;
}

/** A fireship's charges go off: everything close burns, the hulk is gone. */
export function detonateFireship(game: Game, ship: ShipEntity): void {
  ship.fuseAt = 0;
  const now = game.now;
  game.forShipsNear(ship.state.x, ship.state.y, 150, (o) => {
    if (o.id === ship.id || !o.alive || o.docked) return;
    const d = dist(o.state.x, o.state.y, ship.state.x, ship.state.y) - o.stats.length / 3;
    if (d > 90) return;
    const f = 1 - Math.max(0, d) / 110;
    applyDamage(game, o, { hull: 700 * f, sails: 60 * f, crew: 4 * f, morale: 25 * f }, ship);
    o.addEffect({ id: 'fire', until: now + 15, source: ship.id }, now);
  });
  game.emit({ k: 'fx', fx: 'explosion', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 90 }, ship.state.x, ship.state.y);
  ship.hull = 0;
  game.beginSinking(ship);
}

export function fireMount(game: Game, ship: ShipEntity, tx: number, ty: number): string | null {
  const id = ship.loadout.mount;
  if (!id) return 'No deck mount fitted — see a shipyard';
  if (!ship.alive || ship.docked || ship.grappled || ship.surrendered) return 'Cannot fire now';
  if (ship.mountReload > 0) return `${MOUNTS[id].name} is not ready`;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return 'No target';
  const def = MOUNTS[id];
  const d = dist(ship.state.x, ship.state.y, tx, ty);
  if (d < def.minRange) return `Too close for the ${def.name}`;
  const h = Math.atan2(tx - ship.state.x, -(ty - ship.state.y));
  const reach = Math.min(d, def.range * (id === 'harpoon' && ship.hasFlag('harpooner') ? 1.25 : 1));
  const now = game.now;
  switch (id) {
    case 'mortar': {
      const bombs = ship.cls.passive.id === 'bomb_vessel' ? 2 : 1;
      for (let i = 0; i < bombs; i++) {
        const scatter = (reach / def.range) * 60 * game.seaSpread(ship) * (i ? 1.4 : 1);
        const x = ship.state.x + Math.sin(h) * reach + game.rng.gauss() * scatter;
        const y = ship.state.y - Math.cos(h) * reach + game.rng.gauss() * scatter;
        game.strikes.push({ at: now + 3 + i * 0.4, x, y, radius: ship.hasFlag('mortar_lore') ? 69 : 55, hull: 280, rudder: 0.1, owner: ship.id, slow: 0, shells: 1, fx: 'mortar' });
      }
      game.emit({ k: 'fx', fx: 'mortar_launch', x: Math.round(ship.state.x), y: Math.round(ship.state.y) }, ship.state.x, ship.state.y);
      break;
    }
    case 'chain_gun': {
      if (ship.ammo.chain < 3) return 'The chain gun needs chain shot';
      ship.ammo.chain -= 3;
      const balls: [number, number, number, number, number][] = [];
      for (let i = 0; i < 3; i++) {
        const bh = h + game.rng.gauss() * 3 * DEG * ship.stats.spreadMul;
        game.projectiles.push({ owner: ship.id, x: ship.state.x, y: ship.state.y, heading: bh, speed: AMMO.chain.speed, dist: reach, traveled: 0, ammo: 'chain', damage: 34 * ship.stats.gunDamageMul, maxRange: def.range, delay: i * 0.15 });
        balls.push([Math.round(ship.state.x), Math.round(ship.state.y), Math.round(bh * 1000) / 1000, Math.round(reach), i * 150]);
      }
      game.emit({ k: 'volley', ship: ship.id, side: 'bow', ammo: 'chain', balls }, ship.state.x, ship.state.y);
      break;
    }
    case 'harpoon': {
      const target = firstHit(game, ship, h, reach);
      if (!target) {
        game.emit({ k: 'fx', fx: 'harpoon_miss', x: Math.round(ship.state.x + Math.sin(h) * reach), y: Math.round(ship.state.y - Math.cos(h) * reach) }, ship.state.x, ship.state.y);
        break;
      }
      const blocked = damageBlocked(game, ship, target);
      if (blocked && blocked !== 'friendly') return blocked;
      // A beast of the sea: the line with the winch (docs/12 P4), not the tether.
      if (target.npcRole === 'beast') {
        const why = harpoonBeast(game, ship, target);
        if (why) return why;
        break;
      }
      applyDamage(game, target, { hull: 40, crew: 1 }, ship);
      ship.tether = { target: target.id, until: now + 20, length: Math.max(40, dist(ship.state.x, ship.state.y, target.state.x, target.state.y)), strain: 0 };
      game.emit({ k: 'tether', a: ship.id, b: target.id, until: Math.round(now + 20) }, ship.state.x, ship.state.y);
      game.toastShip(target, `Harpooned by ${ship.name}! Cut the line or be boarded.`, 'bad');
      break;
    }
    case 'fire_charge': {
      if (ship.fuseAt) return 'The fuses are already burning';
      ship.fuseAt = now + 8;
      ship.addEffect({ id: 'fire', until: now + 9 }, now);
      game.toastShip(ship, 'Fuses lit! 8 seconds — steer her into them and take to the boats!', 'bad');
      break;
    }
    case 'abyssal_lance': {
      if (curseStage(ship.curse) < 1) return 'The lance does not answer a clean hull';
      const target = firstHit(game, ship, h, reach);
      const hx = target ? target.state.x : ship.state.x + Math.sin(h) * reach;
      const hy = target ? target.state.y : ship.state.y - Math.cos(h) * reach;
      if (target && !damageBlocked(game, ship, target)) {
        applyDamage(game, target, { hull: 170, crew: 3, morale: 20 }, ship);
        target.addEffect({ id: 'undertow', until: now + 5, mods: { maxSpeed: -0.25 }, source: ship.id }, now);
      }
      ship.curse = Math.min(100, ship.curse + 5);
      game.emit({ k: 'lance', x: Math.round(ship.state.x), y: Math.round(ship.state.y), x2: Math.round(hx), y2: Math.round(hy) }, ship.state.x, ship.state.y);
      break;
    }
  }
  ship.mountReload = mountReloadTime(ship);
  ship.lastCombat = now;
  ship.protectedUntil = 0;
  return null;
}

function firstHit(game: Game, ship: ShipEntity, h: number, reach: number): ShipEntity | null {
  const v = headingVec(h);
  const x1 = ship.state.x + v.x * reach, y1 = ship.state.y + v.y * reach;
  let best: ShipEntity | null = null, bt = 2;
  game.forShipsNear((ship.state.x + x1) / 2, (ship.state.y + y1) / 2, reach / 2 + 60, (o) => {
    if (o.id === ship.id || !o.alive || o.docked) return;
    const t = segmentHitsHull(ship.state.x, ship.state.y, x1, y1, o.state.x, o.state.y, o.state.heading, o.stats.length / 2, o.stats.beam / 2);
    if (t >= 0 && t < bt) {
      bt = t;
      best = o;
    }
  });
  return best;
}

/** Harpoon cables: a spring that drags the lighter ship; strain snaps it. */
export function stepTethers(game: Game, dt: number): void {
  for (const a of game.ships.values()) {
    const t = a.tether;
    if (!t) continue;
    const b = game.ships.get(t.target);
    if (!b || !b.alive || !a.alive || game.now > t.until || b.docked || a.docked) {
      a.tether = null;
      continue;
    }
    const dx = b.state.x - a.state.x, dy = b.state.y - a.state.y;
    const d = Math.hypot(dx, dy) || 1;
    // The winch reels in slowly; beyond the cable length both ships are pulled together.
    t.length = Math.max(30, t.length - 4 * dt);
    const over = d - t.length;
    if (over > 0) {
      const ma = a.stats.hullMax, mb = b.stats.hullMax;
      const k = Math.min(1, over * 0.2 * dt * 5);
      const nx = dx / d, ny = dy / d;
      b.state.x -= nx * over * k * (ma / (ma + mb));
      b.state.y -= ny * over * k * (ma / (ma + mb));
      a.state.x += nx * over * k * (mb / (ma + mb));
      a.state.y += ny * over * k * (mb / (ma + mb));
      b.state.speed *= 1 - 0.3 * dt;
      t.strain += over * dt;
      if (t.strain > 260) {
        a.tether = null;
        game.toastShip(a, 'The harpoon line parts!', 'bad');
        game.toastShip(b, 'The harpoon line parts — you are free!', 'good');
      }
    } else t.strain = Math.max(0, t.strain - 20 * dt);
    game.grid.upsert(a.id, a.state.x, a.state.y);
    game.grid.upsert(b.id, b.state.x, b.state.y);
  }
}

export function isTethered(game: Game, ship: ShipEntity): boolean {
  if (ship.tether) return true;
  for (const o of game.ships.values()) if (o.tether?.target === ship.id) return true;
  return false;
}

export function mountOffers(ship: ShipEntity, port: Port): { mount: MountId; cost: number }[] {
  return (Object.keys(MOUNTS) as MountId[])
    // Mortar Lore: any hull can carry a mortar pit.
    .filter((m) => MOUNTS[m].minTier <= Math.max(ship.cls.tier, port.shipyardTier) && (MOUNTS[m].minTier <= ship.cls.tier || (m === 'mortar' && ship.hasFlag('mortar_lore'))) && (MOUNTS[m].factions.length === 0 || MOUNTS[m].factions.includes(port.faction)))
    .map((m) => ({ mount: m, cost: MOUNTS[m].price }));
}

export function shipyardMount(game: Game, s: PlayerSession, port: Port, mount: MountId): string | null {
  const ship = s.ship!;
  if (!MOUNTS[mount]) return 'Unknown mount';
  if (ship.cls.fixedMount) return `The ${ship.cls.name}'s ${MOUNTS[ship.cls.fixedMount].name} cannot be replaced`;
  if (!mountOffers(ship, port).some((o) => o.mount === mount)) return `${port.name} cannot fit a ${MOUNTS[mount].name} to a ${ship.cls.name}`;
  if (ship.loadout.mount === mount) return 'Already fitted';
  const refund = ship.loadout.mount ? Math.round(MOUNTS[ship.loadout.mount].price * 0.4) : 0;
  const cost = Math.max(0, Math.round((MOUNTS[mount].price - refund) * Math.max(0.5, 1 + tx(ship.stats, 'yardCost'))));
  if (s.profile!.gold < cost) return `Needs ${cost} silver`;
  s.profile!.gold -= cost;
  ship.loadout.mount = mount;
  ship.mountReload = 0;
  game.db.ledger(s.accountId, 'mount', -cost, mount);
  return null;
}

