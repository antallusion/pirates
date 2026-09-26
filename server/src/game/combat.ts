// Naval combat: broadsides, ballistics, hit resolution with angle-of-impact and subsystem damage,
// crimes and kill credit. All numbers come from shared data; nothing here trusts the client.

import { AMMO, ARMOR_PIERCE, CHASER_CONE, CHASER_GUN, CHASER_RELOAD, GUNS } from '../../../shared/src/data/ships.ts';
import type { ChaserEnd } from '../../../shared/src/data/ships.ts';
import type { AmmoId } from '../../../shared/src/data/ships.ts';
import { FACTIONS, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { clamp, DEG, headingVec, segmentHitsHull, toShipLocal, wrapAngle } from '../../../shared/src/math.ts';
import type { Side } from '../../../shared/src/protocol.ts';
import { gunCrewFactor } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { MAX_LEAKS, leakChance } from './damagecontrol.ts';
import type { ShipEntity } from './ship.ts';

export interface Projectile {
  owner: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  dist: number;
  traveled: number;
  ammo: AmmoId;
  damage: number;
  maxRange: number;
  delay: number;
}

export const COMBAT_TAG = 20;

export function sideHeading(ship: ShipEntity, side: Side): number {
  return wrapAngle(ship.state.heading + (side === 'port' ? -Math.PI / 2 : Math.PI / 2));
}

export function effectiveRange(ship: ShipEntity, side: Side, ammo: AmmoId): number {
  const gun = GUNS[ship.loadout.guns[side]];
  return gun.range * ship.stats.rangeMul * AMMO[ammo].rangeMul;
}

export function reloadTime(ship: ShipEntity, side: Side, now: number): number {
  const gun = GUNS[ship.loadout.guns[side]];
  let t = gun.reload * ship.stats.reloadMul / gunCrewFactor(ship.stats, ship.loadout, ship.crew);
  if (ship.morale < 30) t *= 1.25;
  if (ship.captain === 'corsair' && ship.gunsDisabled[side] === 0) t *= 0.85; // Broadside Discipline
  if (ship.cls.passive.id === 'gun_brig' && ship.reload.port === 0 && ship.reload.starboard === 0) t *= 0.92;
  if (ship.ammoSel === 'grape' && ship.hasEffect('grapeshot_frenzy')) t *= 0.5;
  void now;
  return t;
}

/** Fires a broadside. Returns null on success, or a reason string. */
export function fireBroadside(game: Game, ship: ShipEntity, side: Side, aimDist: number): string | null {
  if (!ship.alive || ship.docked || ship.boarding || ship.surrendered) return 'Cannot fire now';
  if (ship.reload[side] > 0) return 'Guns are still loading';
  const guns = ship.stats.gunsPerSide - ship.gunsDisabled[side];
  if (guns <= 0) return 'Every gun on that side is dismounted';
  const ammo = ship.ammoSel;
  const shots = Math.min(guns, ship.ammo[ammo]);
  if (shots <= 0) return `Out of ${AMMO[ammo].name}`;
  const gun = GUNS[ship.loadout.guns[side]];
  const range = effectiveRange(ship, side, ammo);
  const dist = clamp(Number.isFinite(aimDist) ? aimDist : range, 40, range);
  const baseHeading = sideHeading(ship, side);
  const fwd = headingVec(ship.state.heading);
  const outward = headingVec(baseHeading);
  const doubleShot = ship.doubleShotArmed;
  const spreadRad = gun.spreadDeg * DEG * ship.stats.spreadMul * (doubleShot ? 1.4 : 1) * (ship.morale < 25 ? 1.3 : 1) * game.seaSpread(ship);
  const balls: [number, number, number, number, number][] = [];
  const rng = game.rng;
  for (let i = 0; i < shots; i++) {
    const along = shots === 1 ? 0 : (i / (shots - 1) - 0.5) * ship.stats.length * 0.7;
    const bx = ship.state.x + fwd.x * along + outward.x * ship.stats.beam * 0.55;
    const by = ship.state.y + fwd.y * along + outward.y * ship.stats.beam * 0.55;
    const n = doubleShot || rng.chance(ship.stats.doubleShotChance) ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const h = baseHeading + rng.gauss() * spreadRad * 0.5;
      const d = dist * (1 + rng.gauss() * 0.045);
      const delay = Math.round(i * 45 + rng.float() * 60 + k * 90);
      game.projectiles.push({
        owner: ship.id, x: bx, y: by, heading: h, speed: AMMO[ammo].speed, dist: d, traveled: 0, ammo,
        damage: gun.damage * ship.stats.gunDamageMul, maxRange: range, delay: delay / 1000,
      });
      balls.push([Math.round(bx), Math.round(by), Math.round(h * 1000) / 1000, Math.round(d), delay]);
    }
  }
  ship.ammo[ammo] -= shots;
  ship.reload[side] = reloadTime(ship, side, game.now);
  ship.lastReloadTotal[side] = ship.reload[side];
  ship.doubleShotArmed = false;
  ship.lastCombat = game.now;
  ship.protectedUntil = 0;
  ship.repairing = ship.repairing && ship.hasFlag('battle_repair');
  game.emit({ k: 'volley', ship: ship.id, side, ammo, balls }, ship.state.x, ship.state.y);
  return null;
}

/** Bow/stern chasers: long guns aimed at a point within a cone along the keel. Great for chases. */
export function fireChaser(game: Game, ship: ShipEntity, end: ChaserEnd, tx: number, ty: number): string | null {
  if (!ship.alive || ship.docked || ship.boarding || ship.surrendered) return 'Cannot fire now';
  const count = end === 'bow' ? ship.cls.bowChasers : ship.cls.sternChasers;
  if (count <= 0) return `No ${end} chasers on a ${ship.cls.name}`;
  if (ship.chaserReload[end] > 0) return 'Chasers are still loading';
  const ammo = ship.ammoSel === 'grape' ? 'round' : ship.ammoSel; // chasers do not load grape
  const shots = Math.min(count, ship.ammo[ammo]);
  if (shots <= 0) return `Out of ${AMMO[ammo].name}`;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return 'No target';
  const keel = end === 'bow' ? ship.state.heading : wrapAngle(ship.state.heading + Math.PI);
  const want = Math.atan2(tx - ship.state.x, -(ty - ship.state.y));
  const off = wrapAngle(want - keel);
  const h = keel + Math.max(-CHASER_CONE, Math.min(CHASER_CONE, off));
  const gun = GUNS[CHASER_GUN];
  const range = gun.range * ship.stats.rangeMul * AMMO[ammo].rangeMul;
  const d = clamp(Math.hypot(tx - ship.state.x, ty - ship.state.y), 40, range);
  const v = headingVec(keel);
  const ox = ship.state.x + v.x * ship.stats.length * 0.5, oy = ship.state.y + v.y * ship.stats.length * 0.5;
  const balls: [number, number, number, number, number][] = [];
  for (let i = 0; i < shots; i++) {
    const bh = h + game.rng.gauss() * gun.spreadDeg * DEG * 0.5 * ship.stats.spreadMul * game.seaSpread(ship);
    const bd = d * (1 + game.rng.gauss() * 0.04);
    const delay = i * 120;
    game.projectiles.push({ owner: ship.id, x: ox, y: oy, heading: bh, speed: AMMO[ammo].speed, dist: bd, traveled: 0, ammo, damage: gun.damage * ship.stats.gunDamageMul, maxRange: range, delay: delay / 1000 });
    balls.push([Math.round(ox), Math.round(oy), Math.round(bh * 1000) / 1000, Math.round(bd), delay]);
  }
  ship.ammo[ammo] -= shots;
  ship.chaserReload[end] = CHASER_RELOAD * ship.stats.reloadMul;
  ship.lastCombat = game.now;
  ship.protectedUntil = 0;
  game.emit({ k: 'volley', ship: ship.id, side: end, ammo, balls }, ship.state.x, ship.state.y);
  return null;
}

export function stepProjectiles(game: Game, dt: number): void {
  const list = game.projectiles;
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.delay > 0) {
      p.delay -= dt;
      list[w++] = p;
      continue;
    }
    const step = Math.min(p.speed * dt, p.dist - p.traveled);
    const v = headingVec(p.heading);
    const nx = p.x + v.x * step, ny = p.y + v.y * step;
    let hit: ShipEntity | null = null;
    let bestT = 2;
    game.grid.query((p.x + nx) / 2, (p.y + ny) / 2, step + 60, (id) => {
      if (id === p.owner) return;
      const s = game.ships.get(id);
      if (!s || s.docked || !s.alive) return;
      const t = segmentHitsHull(p.x, p.y, nx, ny, s.state.x, s.state.y, s.state.heading, s.stats.length / 2, s.stats.beam / 2);
      if (t >= 0 && t < bestT) {
        bestT = t;
        hit = s;
      }
    });
    if (hit) {
      const hx = p.x + (nx - p.x) * bestT, hy = p.y + (ny - p.y) * bestT;
      p.traveled += step * bestT;
      resolveHit(game, p, hit, hx, hy);
      continue;
    }
    p.x = nx;
    p.y = ny;
    p.traveled += step;
    if (p.traveled >= p.dist - 0.01) continue; // splash (clients simulate splashes themselves)
    if (isLand(game.world, p.x, p.y)) continue;
    list[w++] = p;
  }
  list.length = w;
}

/** Whether `a` may damage `b` at all (protection rules). Returns a reason when blocked. */
export function damageBlocked(game: Game, a: ShipEntity | null, b: ShipEntity): string | null {
  if (b.docked) return 'docked';
  if (!a) return null;
  if (b.protectedUntil > game.now) return 'protected';
  if (a.isPlayer && b.isPlayer) {
    const safety = REGIONS[b.region].safety;
    if (safety === 'safe') return 'Safe waters: no PvP here.';
    const pa = game.profileOf(a), pb = game.profileOf(b);
    if (safety !== 'lawless' && pa && pb && (pa.level < 5 || pb.level < 5)) return 'Young captains are protected outside lawless waters.';
  }
  if (a.isPlayer && a.hasFlag('honest_merchant') && !game.isHostile(b, a) && !b.attackers.has(a.id)) {
    return 'Honest Merchant: you do not fire on peaceful ships.';
  }
  if (a.ownerId !== null && a.ownerId === b.id) return 'friendly';
  if (b.ownerId !== null && b.ownerId === a.id) return 'friendly';
  return null;
}

function resolveHit(game: Game, p: Projectile, target: ShipEntity, hx: number, hy: number): void {
  const shooter = game.ships.get(p.owner) ?? null;
  const blocked = damageBlocked(game, shooter, target);
  if (blocked) {
    if (shooter?.isPlayer && blocked.length > 12) game.toastShip(shooter, blocked, 'bad');
    game.emit({ k: 'hit', x: Math.round(hx), y: Math.round(hy), ship: target.id, dmg: 0, ammo: p.ammo }, hx, hy);
    return;
  }
  const ammo = AMMO[p.ammo];
  const falloff = 1 - 0.3 * clamp(p.traveled / Math.max(1, p.maxRange), 0, 1);
  // Angle of impact: how closely the ball travels along the target's keel line.
  const ball = headingVec(p.heading);
  const keel = headingVec(target.state.heading);
  const along = Math.abs(ball.x * keel.x + ball.y * keel.y);
  const local = toShipLocal(hx, hy, target.state.x, target.state.y, target.state.heading);
  const fromBow = local.y > 0;
  let raking = along > 0.87;
  if (raking && fromBow && target.cls.passive.id === 'line') raking = false;
  const rakeMul = raking ? 1.25 : 1;
  // Glancing blows off a steeply angled hull skip away.
  const glance = along > 0.5 && !raking ? 0.8 : 1;

  const armor = target.stats.armor * (1 - (ARMOR_PIERCE[p.ammo] ?? 0));
  const hullDmg = p.damage * ammo.hullMul * falloff * rakeMul * glance * (1 - armor) * target.stats.incomingDamageMul;
  const sailDmg = p.damage * ammo.sailMul * falloff * (shooter?.stats.sailDamageMul ?? 1);
  const crewKill = ammo.crewKill * (shooter?.stats.crewKillMul ?? 1) * (raking ? 1.8 : 1) * (0.5 + game.rng.float());

  let crit: string | undefined;
  let rudderDmg = 0;
  if (p.ammo !== 'grape' && local.y < -target.stats.length * 0.33 && game.rng.chance(0.14)) {
    rudderDmg = 0.2 + game.rng.float() * 0.15;
    crit = 'rudder';
  }
  if (p.ammo === 'round' && game.rng.chance(0.06)) {
    const side: Side = local.x < 0 ? 'port' : 'starboard';
    if (target.gunsDisabled[side] < target.stats.gunsPerSide) {
      target.gunsDisabled[side]++;
      crit = 'gun';
    }
  }
  if (raking) crit = crit ?? 'raked';
  if ((p.ammo === 'round' || p.ammo === 'heavy') && hullDmg > 15 && target.leaks < MAX_LEAKS && game.rng.chance(leakChance(target, p.ammo === 'heavy'))) {
    target.leaks++;
    crit = 'leak';
  }

  applyDamage(game, target, { hull: hullDmg, sails: sailDmg, crew: crewKill, rudder: rudderDmg, morale: 0.35 }, shooter);

  // Cargo destroyed by hull hits; powder may go up.
  if (p.ammo !== 'grape' && hullDmg > 10) {
    const deepHold = target.cls.passive.id === 'deep_hold' ? 0.5 : 1;
    if (game.rng.chance(0.07 * deepHold)) destroyRandomCargo(game, target, 1 + game.rng.int(0, 2));
    // Fire shot in the magazine burns like powder.
    const powder = (target.cargo.gunpowder ?? 0) + target.ammo.incendiary / 10;
    if (powder >= 5 && game.rng.chance(0.012 * GOODS.gunpowder.danger * Math.min(3, powder / 10))) {
      target.cargo.gunpowder = Math.floor(powder * 0.4);
      applyDamage(game, target, { hull: target.stats.hullMax * 0.14, crew: 3, morale: 12, sails: 10 }, shooter);
      target.addEffect({ id: 'fire', until: game.now + 12 }, game.now);
      game.emit({ k: 'fx', fx: 'explosion', x: Math.round(target.state.x), y: Math.round(target.state.y), r: 40 }, target.state.x, target.state.y);
      game.toastShip(target, 'Powder explosion in the hold!', 'bad');
      crit = 'powder';
    }
  }
  if (p.ammo === 'incendiary' && hullDmg > 5 && game.rng.chance(0.25)) {
    target.addEffect({ id: 'fire', until: game.now + 10 + game.rng.float() * 6, source: shooter?.id }, game.now);
    crit = 'fire';
  }
  if (p.ammo === 'chain' && shooter?.hasFlag('tangled_rigging')) {
    target.addEffect({ id: 'tangled', until: game.now + 6, mods: { turnRate: -0.35 }, source: shooter.id }, game.now);
  }
  game.emit({ k: 'hit', x: Math.round(hx), y: Math.round(hy), ship: target.id, dmg: Math.round(hullDmg), ammo: p.ammo, crit }, hx, hy);
}

export function destroyRandomCargo(game: Game, ship: ShipEntity, units: number): void {
  const goods = Object.keys(ship.cargo).filter((g) => (ship.cargo[g as GoodId] ?? 0) > 0) as GoodId[];
  if (!goods.length) return;
  const g = game.rng.pick(goods);
  ship.cargo[g] = Math.max(0, (ship.cargo[g] ?? 0) - units);
  if (!ship.cargo[g]) delete ship.cargo[g];
}

export interface DamagePacket {
  hull?: number;
  sails?: number;
  crew?: number;
  rudder?: number;
  morale?: number;
}

/** Central damage entry point for cannon fire, abilities, collisions and hazards. */
export function applyDamage(game: Game, target: ShipEntity, d: DamagePacket, source: ShipEntity | null): void {
  if (!target.alive || target.docked) return;
  const now = game.now;
  if (source) {
    registerAggression(game, source, target);
    source.lastCombat = now;
  }
  target.lastCombat = now;
  target.protectedUntil = 0;
  if (d.hull) target.hull -= d.hull;
  if (d.sails) target.sails = Math.max(0, target.sails - d.sails);
  if (d.rudder) target.rudderHp = Math.max(0, target.rudderHp - d.rudder);
  if (d.crew) {
    let killed = Math.floor(d.crew);
    if (game.rng.float() < d.crew - killed) killed++;
    killed = Math.min(killed, target.crew);
    target.crew -= killed;
    target.morale -= killed * 0.8;
  }
  if (d.morale) target.morale -= d.morale;
  // Terror: crews under 30% break twice as fast.
  if (source && source.hasFlag('terror') && target.crew < target.stats.crewMax * 0.3) target.morale -= (d.morale ?? 0) + 0.8;
  target.morale = clamp(target.morale, 0, 100);
  if (target.cls.passive.id === 'dead_crew') target.morale = Math.max(target.morale, 60);

  if (target.hull <= 0) {
    if (target.lastStandUntil > now) {
      target.hull = 1;
    } else if (target.hasFlag('unsinkable') && target.unsinkableReadyAt <= now) {
      target.hull = 1;
      target.unsinkableReadyAt = now + 300;
      target.lastStandUntil = now + (target.captain === 'drowned' ? 10 : 6);
      game.toastShip(target, target.captain === 'drowned' ? 'The sea refuses you. Again.' : 'Unsinkable! Hold her together!', 'good');
    } else {
      target.hull = 0;
      game.beginSinking(target);
    }
  }
  if (target.npcRole) game.npcOnDamaged(target, source);
}

/** First blood between two ships decides crimes, reputation and self-defence windows. */
function registerAggression(game: Game, a: ShipEntity, b: ShipEntity): void {
  const now = game.now;
  const prev = b.attackers.get(a.id);
  b.attackers.set(a.id, now);
  if (prev !== undefined && now - prev < 60) return; // same engagement
  const pa = a.isPlayer ? game.profileOf(a) : null;
  if (!pa) return;
  // Self defence: b attacked a recently.
  const selfDefence = (a.attackers.get(b.id) ?? -999) > now - 90;
  if (selfDefence) return;
  const safety = REGIONS[b.region].safety;
  const zoneMul = safety === 'safe' ? 2 : safety === 'contested' ? 1 : 0.3;
  let infamy = 0;
  if (b.isPlayer) {
    const pb = game.profileOf(b);
    if (pb && wantedLevel(pb.infamy) < 2) infamy = 18 * zoneMul;
  } else if (b.faction !== 'player' && FACTIONS[b.faction].lawful) {
    infamy = (b.npcRole === 'patrol' ? 26 : 14) * zoneMul;
    game.adjustRep(a, b.faction, -8);
  } else if (b.faction !== 'player') {
    game.adjustRep(a, b.faction, -4);
  }
  if (infamy > 0) game.addInfamy(a, infamy, `attacked ${b.name}`);
}
