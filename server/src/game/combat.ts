// Naval combat: broadsides, ballistics, hit resolution with angle-of-impact and subsystem damage,
// crimes and kill credit. All numbers come from shared data; nothing here trusts the client.

import { regattaBlocked } from './regatta.ts';
import { tributeBroken } from './raiding.ts';
import { lairImpact } from './wanted.ts';
import { ladderBetween } from './ladder.ts';
import { AIM_CHARGE, DASH_COOLDOWN, DASH_EVADE, DASH_EVADE_CHANCE, DASH_TIME, aimFocus, windDriftAngle } from '../../../shared/src/data/gunnery.ts';
import { onboardingVolley } from './onboarding.ts';
import { AMMO, ARMOR_PIERCE, CHASER_CONE, CHASER_GUN, CHASER_RELOAD, GUNS } from '../../../shared/src/data/ships.ts';
import type { ChaserEnd, GunId } from '../../../shared/src/data/ships.ts';
import type { AmmoId } from '../../../shared/src/data/ships.ts';
import { FACTIONS, WANTED_THRESHOLDS, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { clamp, DEG, headingVec, segmentHitsHull, toShipLocal, wrapAngle } from '../../../shared/src/math.ts';
import type { Side } from '../../../shared/src/protocol.ts';
import { gunCrewFactor, tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { crueltyMul, inDuel, legalTarget, onPlayerAttack, pvpBlocked } from './pvp.ts';
import { sameGroup } from './party.ts';
import { siegeImpact } from './siege.ts';
import { guildFriends } from './guilds.ts';
import type { Game } from './Game.ts';
import { MAX_LEAKS, leakChance } from './damagecontrol.ts';
import type { ShipEntity } from './ship.ts';
import { addHeat, upwindOf } from './talentfx.ts';
import { callPatrols } from './tradefx.ts';
import { unmask } from './smugglefx.ts';
import { survivalOnHit, woundedOf } from './survivalfx.ts';
import { gunPractice } from './crewlife.ts';
import { isMonster } from './explorefx.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { onCrewKilled, onCrit, onHullDamage } from './mind.ts';
import { moraleLossMul, onMagazineBlast } from './crew.ts';
import { screenFlagship } from './fleet.ts';
import { grandBattery, nightRaider, stormGunnerRange } from './bridgefx.ts';
import { cursedDamageMul, onCursedHit, onCursedVolley, onOwnCrewKilled, pactDamageMul } from './abyssfx.ts';
import { bossIncoming, innerVolley, swallowedShield } from './bosses.ts';
import { zbCredit } from './zonebosses.ts';
import { kegImpact } from './holidays.ts';
import { SPEED_SCALE } from '../../../shared/src/constants.ts';
import { killFactor, menLost, wallsOf } from './army.ts';
import { giftOnHit } from './shipgifts.ts';

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
  volley?: number; // broadside this ball belongs to (Thunderous Broadside, Spotter, Splinter Storm)
  ignore?: number; // ship this ball has already missed (Serpentine)
  skipped?: boolean; // Skipping Shot: already bounced once
  gun?: GunId; // the broadside gun that threw it (its own trade: pierce, shatter, shells…)
}

/** Bookkeeping for one broadside until its last ball lands. */
export interface VolleyRec {
  owner: number;
  total: number;
  left: number;
  hits: Map<number, number>;
  counts: boolean; // counts as a full volley (not a plain rolling fire)
  demoralised: Set<number>; // Splinter Storm: targets already shaken by this volley
  dealt: Map<number, number>; // hull damage per target (volley cap)
  t: number;
  battery?: Set<number>; // Grand Battery: targets already shaken by this volley
  men?: Map<number, number>; // men killed per target (docs/17 H1: one "−N" a broadside)
}

export const COMBAT_TAG = 20;

/** Critical hits on her parts (docs/16 #2). Chain shot amidships into rigging already half torn brings a topmast down
 *  (the chance a hit, the seconds and the share of her speed it costs); a heavy ball may find her powder room. All
 *  times the ladder's share of criticals (a junior makes fewer, or none). Tuned against tests/balance: three of a
 *  level still beat one a level up. */
export const MAST_CRIT_CHAIN = 0.04;
export const MAST_CRIT_TIME = 20;
export const MAST_CRIT_SLOW = 0.1;
export const MAGAZINE_CRIT_HEAVY = 0.01;

export function sideHeading(ship: ShipEntity, side: Side): number {
  return wrapAngle(ship.state.heading + (side === 'port' ? -Math.PI / 2 : Math.PI / 2));
}

export function effectiveRange(ship: ShipEntity, side: Side, ammo: AmmoId): number {
  const gun = GUNS[ship.loadout.guns[side]];
  const chain = ammo === 'chain' ? 1 + tval(ship.stats, 'chainRange') : 1;
  return gun.range * ship.stats.rangeMul * AMMO[ammo].rangeMul * chain;
}

/** Nearest hostile inside a broadside's arc and range — the ship the gunners are laying on. */
export function aimTarget(game: Game, ship: ShipEntity, side: Side, range: number): ShipEntity | null {
  const h = sideHeading(ship, side);
  let best: ShipEntity | null = null;
  let bd = range + 40;
  game.forShipsNear(ship.state.x, ship.state.y, range + 40, (o) => {
    if (o.id === ship.id || !o.alive || o.docked || !game.isHostile(o, ship)) return;
    const bearing = Math.atan2(o.state.x - ship.state.x, -(o.state.y - ship.state.y));
    if (Math.abs(wrapAngle(bearing - h)) > Math.PI / 3) return;
    const d = Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

export function reloadTime(ship: ShipEntity, side: Side, now: number): number {
  const gun = GUNS[ship.loadout.guns[side]];
  // Gun Crew Drill: a short-handed crew loses less.
  const gcf = 1 - (1 - gunCrewFactor(ship.stats, ship.loadout, ship.crew)) * Math.max(0, 1 - tval(ship.stats, 'gunCrewDrill'));
  let t = gun.reload * ship.stats.reloadMul / gcf * (AMMO[ship.ammoSel].reloadMul ?? 1);
  const fullVolley = !ship.rollingFire || ship.hasFlag('rolling_broadside');
  if (ship.captain === 'corsair' && ship.gunsDisabled[side] === 0 && fullVolley) t *= 0.85; // Broadside Discipline
  if (ship.rollingFire) t *= 0.85; // guns reload as they fire
  if (ship.swapBonus) t *= 1 - 0.05 * ship.rank('gun_quick_swap'); // Quick Swap: 10% at rank 2
  if (ship.cls.passive.id === 'gun_brig' && ship.reload.port === 0 && ship.reload.starboard === 0) t *= 0.92;
  if (ship.ammoSel === 'grape' && ship.hasEffect('grapeshot_frenzy')) t *= 0.5;
  void now;
  return t;
}

/** How far the cross wind turns a ball's line (docs/16 #1), less what her gunners allow for it (`allow` 0..1: a
 *  captain aims off herself — 0; the sea's gunners allow by their craft). */
export function shotDrift(game: Game, ship: ShipEntity, heading: number, dist: number, ammo: AmmoId, allow = 0, gunSpeed = 1): number {
  const w = game.windFor(ship);
  const speed = AMMO[ammo].speed * (1 + tval(ship.stats, 'shotSpeed')) * gunSpeed;
  return windDriftAngle(w.dir, w.strength, heading, dist, speed) * (1 - clamp(allow, 0, 1));
}

/** Fires a broadside. Returns null on success, or a reason string. `windAllow`: how much of the wind's drift her
 *  gunners aim off for (0 for a captain, who sees the drift on her mark and leads it herself). */
export function fireBroadside(game: Game, ship: ShipEntity, side: Side, aimDist: number, aimAt?: { x: number; y: number }, windAllow = 0): string | null {
  if (!ship.alive || ship.docked || ship.grappled || ship.surrendered) return 'Cannot fire now';
  if (ship.hasEffect('submerged') || ship.hasEffect('ghost_return')) return 'The guns are under black water';
  if (ship.reload[side] > 0) return 'Guns are still loading';
  const guns = ship.stats.gunsPerSide - ship.gunsDisabled[side];
  if (guns <= 0) return 'Every gun on that side is dismounted';
  const ammo = ship.ammoSel;
  const shots = Math.min(guns, ship.ammo[ammo]);
  if (shots <= 0) return `Out of ${AMMO[ammo].name}`;
  const gun = GUNS[ship.loadout.guns[side]];
  // Swallowed by the Lantern Maw: the broadside goes into its gut.
  if (innerVolley(game, ship, shots * gun.damage * ship.stats.gunDamageMul * AMMO[ammo].hullMul)) {
    ship.ammo[ammo] -= shots;
    ship.reload[side] = reloadTime(ship, side, game.now);
    ship.lastReloadTotal[side] = ship.reload[side];
    ship.lastCombat = game.now;
    return null;
  }
  const range = effectiveRange(ship, side, ammo) * stormGunnerRange(game, ship);
  const dist = clamp(Number.isFinite(aimDist) ? aimDist : range, 40, range);
  let baseHeading = sideHeading(ship, side);
  // Improved Carriages: the guns train toward the aim point.
  const train = tval(ship.stats, 'gunTrain') * DEG;
  if (aimAt && train > 0) {
    const want = Math.atan2(aimAt.x - ship.state.x, -(aimAt.y - ship.state.y));
    baseHeading = wrapAngle(baseHeading + clamp(wrapAngle(want - baseHeading), -train, train));
  }
  const fwd = headingVec(ship.state.heading);
  const outward = headingVec(baseHeading);
  const doubleShot = ship.doubleShotArmed;
  const target = aimTarget(game, ship, side, range);
  const rolling = ship.rollingFire;
  const rollMul = rolling ? (ship.hasFlag('rolling_broadside') ? 0.8 : 1.15) : 1;
  const rangedIn = target?.hasEffect('ranged_in') ? 0.85 : 1;
  // A held broadside (dynamic combat): released in its window the balls fly tight and hit harder.
  // A hold left over from an order that never fired (the guns were not ready) is stale, not a long aim.
  const held = ship.aimStart[side] >= 0 ? game.now - ship.aimStart[side] : 0;
  const focus = aimFocus(held > AIM_CHARGE * 4 ? 0 : held);
  ship.aimStart[side] = -1;
  const spreadRad = gun.spreadDeg * DEG * ship.stats.spreadMul * (doubleShot ? 1.4 : 1) * (ship.morale < 25 ? 1.3 : 1) * game.seaSpread(ship) * rollMul * rangedIn * focus.spread;
  // Shadow Strike: the first broadside from hiding, before she has seen you.
  const hiding = ship.hasFlag('hidden') || isNight(game.now) || game.weatherOf(ship) === 'fog';
  const shadowStrike = !!target && ship.hasFlag('shadow_strike') && hiding && !target.attackers.has(ship.id) && !ship.attackers.has(target.id) ? 1.3 : 1;
  // Night Raider: the larger of the two counts.
  const shadow = Math.max(shadowStrike, nightRaider(game, ship, target, hiding)) * (ship.hasFlag('false_bulwark') && game.now - ship.lastCombat > 60 ? 1.25 : 1); // the false bulwark drops: the first broadside strikes harder
  if (shadowStrike > 1 && target) {
    ship.addEffect({ id: 'shadow', until: game.now + 4, flags: ['hidden'] }, game.now);
    const tb = game.npcs.get(target.id);
    if (tb) tb.spared.set(ship.id, game.now + 4);
  }
  unmask(game, ship, 'you opened fire');
  if (ship.hasEffect('slip_away')) {
    ship.effects = ship.effects.filter((e) => e.id !== 'slip_away');
    ship.recompute(game.now);
  }
  const volley = game.allocId();
  const rec: VolleyRec = { owner: ship.id, total: 0, left: 0, hits: new Map(), counts: !rolling || ship.hasFlag('rolling_broadside'), demoralised: new Set(), dealt: new Map(), t: game.now };
  // A culverin's ball flies faster than her other guns' (and drifts the less for it).
  const gunSpeed = 1 + (gun.shotSpeed ?? 0);
  const shotSpeed = (1 + tval(ship.stats, 'shotSpeed')) * gunSpeed;
  const balls: [number, number, number, number, number][] = [];
  const rng = game.rng;
  for (let i = 0; i < shots; i++) {
    const along = shots === 1 ? 0 : (i / (shots - 1) - 0.5) * ship.stats.length * 0.7;
    const bx = ship.state.x + fwd.x * along + outward.x * ship.stats.beam * 0.55;
    const by = ship.state.y + fwd.y * along + outward.y * ship.stats.beam * 0.55;
    const n = doubleShot || rng.chance(ship.stats.doubleShotChance) ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const h0 = baseHeading + rng.gauss() * spreadRad * 0.5;
      const d = dist * (1 + rng.gauss() * 0.045);
      const h = h0 + shotDrift(game, ship, h0, d, ammo, windAllow, gunSpeed); // the cross wind carries her downwind
      const delay = Math.round((rolling ? (i * 2500) / Math.max(1, shots) : i * 45) + rng.float() * 60 + k * 90);
      game.projectiles.push({
        owner: ship.id, x: bx, y: by, heading: h, speed: AMMO[ammo].speed * shotSpeed * SPEED_SCALE, dist: d, traveled: 0, ammo,
        damage: gun.damage * ship.stats.gunDamageMul * shadow * focus.damage * (ammo === 'cursed' ? cursedDamageMul(ship) : 1), maxRange: range, delay: delay / 1000, volley, gun: gun.id,
      });
      rec.total++;
      balls.push([Math.round(bx), Math.round(by), Math.round(h * 1000) / 1000, Math.round(d), delay]);
    }
  }
  rec.left = rec.total;
  game.volleys.set(volley, rec);
  ship.ammo[ammo] -= shots;
  gunPractice(game, ship, shots, 0); // and from every shot fired (docs/16 #18)
  if (ammo === 'cursed') onCursedVolley(game, ship);
  ship.reload[side] = reloadTime(ship, side, game.now);
  ship.lastReloadTotal[side] = ship.reload[side];
  ship.swapBonus = false;
  ship.doubleShotArmed = false;
  addHeat(game, ship, side);
  // Overgunned: a full broadside makes the hull groan.
  if (ship.hasFlag('overgunned') && ship.gunsDisabled[side] === 0) ship.hull -= ship.stats.hullMax * 0.005;
  // Weather Gauge: the powder smoke blows down onto the enemy.
  if (target && ship.hasFlag('weather_gauge') && upwindOf(game, ship, target) && Math.hypot(target.state.x - ship.state.x, target.state.y - ship.state.y) < 450) {
    target.addEffect({ id: 'gun_smoke', until: game.now + 3, mods: { spreadMul: 0.1 }, source: ship.id }, game.now);
  }
  ship.lastCombat = game.now;
  ship.protectedUntil = 0;
  ship.repairing = ship.repairing && ship.hasFlag('battle_repair');
  game.emit({ k: 'volley', ship: ship.id, side, ammo, balls, spd: shotSpeed !== 1 ? shotSpeed : undefined, ...(focus.perfect ? { perfect: true as const } : {}) }, ship.state.x, ship.state.y);
  return null;
}

/** The broadside's order is held: the charge counts from when the guns are loaded. */
export function holdAim(game: Game, ship: ShipEntity, side: Side): void {
  if (!ship.alive || ship.docked) return;
  ship.aimStart[side] = game.now + Math.max(0, ship.reload[side]);
}

/** A hard turn with every hand on the braces: a burst of speed, a sharp helm, and for a moment half the balls
 *  aimed at her fly wide. */
export function dash(game: Game, ship: ShipEntity): string | null {
  if (!ship.alive || ship.docked || ship.grappled || ship.surrendered || ship.boarding) return 'Cannot manoeuvre now';
  const now = game.now;
  if (now < ship.dashReadyAt) return `The crew is still hauling the braces (${Math.ceil(ship.dashReadyAt - now)} s)`;
  ship.dashReadyAt = now + DASH_COOLDOWN;
  ship.addEffect({ id: 'dash', until: now + DASH_TIME, mods: { maxSpeed: 0.45, accel: 1.5, turnRate: 0.7 } }, now);
  ship.addEffect({ id: 'evasive', until: now + DASH_EVADE, flags: ['evasive'] }, now);
  ship.state.speed = Math.min(ship.stats.maxSpeed * 1.3, ship.state.speed + 3);
  ship.lastCombat = Math.max(ship.lastCombat, now - 1);
  game.emit({ k: 'dash', ship: ship.id, x: Math.round(ship.state.x), y: Math.round(ship.state.y), h: Math.round(ship.state.heading * 1000) / 1000 }, ship.state.x, ship.state.y);
  return null;
}

/** Bow/stern chasers: long guns aimed at a point within a cone along the keel. Great for chases. */
export function fireChaser(game: Game, ship: ShipEntity, end: ChaserEnd, tx: number, ty: number, windAllow = 0): string | null {
  if (!ship.alive || ship.docked || ship.grappled || ship.surrendered) return 'Cannot fire now';
  const count = end === 'bow' ? ship.stats.bowChasers : ship.cls.sternChasers;
  if (count <= 0) return `No ${end} chasers on a ${ship.cls.name}`;
  if (ship.chaserReload[end] > 0) return 'Chasers are still loading';
  const ammo = ship.ammoSel === 'grape' ? 'round' : ship.ammoSel; // chasers do not load grape
  const shots = Math.min(count, ship.ammo[ammo]);
  if (shots <= 0) return `Out of ${AMMO[ammo].name}`;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return 'No target';
  const keel = end === 'bow' ? ship.state.heading : wrapAngle(ship.state.heading + Math.PI);
  const want = Math.atan2(tx - ship.state.x, -(ty - ship.state.y));
  const off = wrapAngle(want - keel);
  const cone = CHASER_CONE + tval(ship.stats, 'chaserArc') * DEG;
  const h = keel + Math.max(-cone, Math.min(cone, off));
  const gun = GUNS[CHASER_GUN];
  const range = gun.range * ship.stats.rangeMul * AMMO[ammo].rangeMul;
  const d = clamp(Math.hypot(tx - ship.state.x, ty - ship.state.y), 40, range);
  const v = headingVec(keel);
  const ox = ship.state.x + v.x * ship.stats.length * 0.5, oy = ship.state.y + v.y * ship.stats.length * 0.5;
  const balls: [number, number, number, number, number][] = [];
  for (let i = 0; i < shots; i++) {
    const bh0 = h + game.rng.gauss() * gun.spreadDeg * DEG * 0.5 * ship.stats.spreadMul * game.seaSpread(ship);
    const bd = d * (1 + game.rng.gauss() * 0.04);
    const bh = bh0 + shotDrift(game, ship, bh0, bd, ammo, windAllow);
    const delay = i * 120;
    game.projectiles.push({ owner: ship.id, x: ox, y: oy, heading: bh, speed: AMMO[ammo].speed * (1 + tval(ship.stats, 'shotSpeed')) * SPEED_SCALE, dist: bd, traveled: 0, ammo, damage: gun.damage * ship.stats.gunDamageMul * (1 + tval(ship.stats, 'chaserDamage')), maxRange: range, delay: delay / 1000 });
    balls.push([Math.round(ox), Math.round(oy), Math.round(bh * 1000) / 1000, Math.round(bd), delay]);
  }
  ship.ammo[ammo] -= shots;
  ship.chaserReload[end] = CHASER_RELOAD * ship.stats.reloadMul;
  ship.lastCombat = game.now;
  ship.protectedUntil = 0;
  const spd = 1 + tval(ship.stats, 'shotSpeed');
  game.emit({ k: 'volley', ship: ship.id, side: end, ammo, balls, spd: spd !== 1 ? spd : undefined }, ship.state.x, ship.state.y);
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
    game.grid.query((p.x + nx) / 2, (p.y + ny) / 2, step + 90, (id) => {
      if (id === p.owner || id === p.ignore) return;
      const s = game.ships.get(id);
      if (!s || s.docked || !s.alive) return;
      // A beast in the water is hurt by a ball striking close by, not only square on its back (docs/12 P4).
      const beast = s.npcRole === 'beast';
      const t = segmentHitsHull(p.x, p.y, nx, ny, s.state.x, s.state.y, s.state.heading, beast ? Math.max(s.stats.length / 2 + 3, 9) : s.stats.length / 2, beast ? Math.max(s.stats.beam / 2 + 3, 5) : s.stats.beam / 2);
      if (t >= 0 && t < bestT) {
        bestT = t;
        hit = s;
      }
    });
    if (hit) {
      const h = hit as ShipEntity;
      // Serpentine: a ship slewing hard under full rudder throws the gunners off.
      const evade = tval(h.stats, 'evasion');
      if (evade > 0 && Math.abs(h.state.rudder) > 0.5 && game.rng.chance(evade)) {
        p.ignore = h.id;
      } else {
        const hx = p.x + (nx - p.x) * bestT, hy = p.y + (ny - p.y) * bestT;
        p.traveled += step * bestT;
        resolveHit(game, p, h, hx, hy);
        volleyBall(game, p, h);
        continue;
      }
    }
    p.x = nx;
    p.y = ny;
    p.traveled += step;
    if (p.traveled >= p.dist - 0.01) {
      // Skipping Shot: a ball that falls just short bounces on into the hull.
      if (!p.skipped && game.ships.get(p.owner)?.hasFlag('skipping_shot') && skip(game, p)) continue;
      volleyBall(game, p, null);
      siegeImpact(game, p.x, p.y, p.damage, p.owner, false); // shot falling on a besieged island
      lairImpact(game, p.x, p.y, p.damage, p.owner); // or on a pirate lair's battery (docs/12 P5)
      kegImpact(game, p.x, p.y, p.owner); // or by a powder keg on Powder Night (docs/12 P10 #18)
      continue; // splash (clients simulate splashes themselves)
    }
    if (isLand(game.world, p.x, p.y)) {
      volleyBall(game, p, null);
      continue;
    }
    list[w++] = p;
  }
  list.length = w;
}

function skip(game: Game, p: Projectile): boolean {
  const v = headingVec(p.heading);
  const ex = p.x + v.x * 30, ey = p.y + v.y * 30;
  let hit: ShipEntity | null = null;
  let bestT = 2;
  game.grid.query((p.x + ex) / 2, (p.y + ey) / 2, 80, (id) => {
    if (id === p.owner) return;
    const s = game.ships.get(id);
    if (!s || s.docked || !s.alive) return;
    const t = segmentHitsHull(p.x, p.y, ex, ey, s.state.x, s.state.y, s.state.heading, s.stats.length / 2, s.stats.beam / 2);
    if (t >= 0 && t < bestT) {
      bestT = t;
      hit = s;
    }
  });
  if (!hit) return false;
  p.skipped = true;
  const h = hit as ShipEntity;
  resolveHit(game, { ...p, damage: p.damage * 0.6 }, h, p.x + (ex - p.x) * bestT, p.y + (ey - p.y) * bestT);
  volleyBall(game, p, h);
  return true;
}

/** A ball of a broadside has landed (on a ship or in the sea); settle volley-wide talents at the last one. */
function volleyBall(game: Game, p: Projectile, target: ShipEntity | null): void {
  if (p.volley === undefined) return;
  const rec = game.volleys.get(p.volley);
  if (!rec) return;
  if (target) rec.hits.set(target.id, (rec.hits.get(target.id) ?? 0) + 1);
  if (--rec.left > 0) return;
  game.volleys.delete(p.volley);
  if (rec.men) for (const [id, n] of rec.men) {
    const t = game.ships.get(id);
    if (t) menLost(game, t, n);
  }
  const owner = game.ships.get(rec.owner);
  if (!owner) return;
  if (owner.isPlayer) onboardingVolley(game, owner, [...rec.hits.values()].reduce((x, y) => x + y, 0));
  let top = 0, topId = 0;
  for (const [id, n] of rec.hits) if (n > top) {
    top = n;
    topId = id;
  }
  const victim = topId ? game.ships.get(topId) : undefined;
  // Thunderous Broadside: every ball of a full volley (6+) into one ship.
  if (victim && rec.counts && owner.hasFlag('thunder_broadside') && rec.total >= 6 && top === rec.total && rec.hits.size === 1) {
    victim.addEffect({ id: 'stunned_crew', until: game.now + 5, mods: { reloadMul: 0.25 }, source: owner.id }, game.now);
    game.toastShip(owner, `Thunderous broadside! ${victim.name}'s gun crews reel.`, 'good');
  }
  // Spotter: three broadsides in a row on the same ship.
  if (owner.hasFlag('spotter')) {
    if (victim) {
      owner.spotter = owner.spotter.target === victim.id ? { target: victim.id, count: owner.spotter.count + 1 } : { target: victim.id, count: 1 };
      if (owner.spotter.count >= 3) {
        victim.addEffect({ id: 'ranged_in', until: game.now + 10, source: owner.id }, game.now);
        owner.spotter.count = 0;
      }
    } else owner.spotter = { target: 0, count: 0 };
  }
}

/** Whether `a` may damage `b` at all (protection rules). Returns a reason when blocked. */
export function damageBlocked(game: Game, a: ShipEntity | null, b: ShipEntity): string | null {
  if (b.docked) return 'docked';
  // Two ships lashed in a boarding are out of the sea's fight until it is over (owner, 2026-10-01): no third ship
  // may fire on, ram or board either of them.
  if (b.grappled && (!a || b.boarding!.with !== a.id)) return 'She is locked in a boarding: no one may touch her until it is over.';
  if (!a) return null;
  // Duels, the Green Pennant (pvp.ts).
  const pv = pvpBlocked(game, a, b);
  if (pv === 'duel_ok') return null;
  if (pv) return pv;
  if (b.protectedUntil > game.now) return 'protected';
  if (regattaBlocked(a, b)) return 'No firing in a regatta.'; // equal waters (docs/12 P10 #5)
  if (a.isPlayer && (b.isPlayer || b.caravanId)) {
    const safety = REGIONS[b.region].safety;
    if (safety === 'safe') return 'Safe waters: no PvP here.';
  }
  if (a.isPlayer && a.hasFlag('honest_merchant') && b.npcRole !== 'beast' && !game.isHostile(b, a) && !b.attackers.has(a.id)) {
    return 'Honest Merchant: you do not fire on peaceful ships.';
  }
  if (a.ownerId !== null && a.ownerId === b.id) return 'friendly';
  if (b.ownerId !== null && b.ownerId === a.id) return 'friendly';
  if (sameGroup(game, a, b)) return 'friendly'; // a group does not fire on its own
  if (guildFriends(game, a, b)) return 'friendly'; // nor a guild, its allies or its pact partners
  return null;
}

function resolveHit(game: Game, p: Projectile, target: ShipEntity, hx: number, hy: number): void {
  const shooter = game.ships.get(p.owner) ?? null;
  // The Cannon tattoo counts the hits (docs/12 P9).
  if (shooter?.isPlayer) {
    const sp = game.profileOf(shooter);
    if (sp) {
      sp.tattoos ??= { owned: [], pending: [], active: [], counts: {} };
      sp.tattoos.counts.hits = (sp.tattoos.counts.hits ?? 0) + 1;
    }
    gunPractice(game, shooter, 0, 1); // the gunners learn from every hit (docs/16 #18)
  }
  // A ship in the moment of her dash: half the balls fly wide.
  if (target.hasFlag('evasive') && game.rng.chance(DASH_EVADE_CHANCE)) {
    game.emit({ k: 'hit', x: Math.round(hx), y: Math.round(hy), ship: target.id, dmg: 0, ammo: p.ammo, evaded: true }, hx, hy);
    return;
  }
  const blocked = damageBlocked(game, shooter, target);
  if (blocked) {
    if (shooter?.isPlayer && blocked.length > 12) game.toastShip(shooter, blocked, 'bad');
    game.emit({ k: 'hit', x: Math.round(hx), y: Math.round(hy), ship: target.id, dmg: 0, ammo: p.ammo }, hx, hy);
    return;
  }
  const ammo = AMMO[p.ammo];
  const gd = p.gun ? GUNS[p.gun] : undefined; // the gun's own trade (ships.ts), on a broadside's balls
  if (target.named && shooter?.isPlayer) target.scar = p.ammo === 'incendiary' ? 'fire' : 'cannon'; // the scar he will carry (docs/12 P10 #1)
  const falloff = 1 - 0.3 * clamp(p.traveled / Math.max(1, p.maxRange), 0, 1);
  // Angle of impact: how closely the ball travels along the target's keel line.
  const ball = headingVec(p.heading);
  const keel = headingVec(target.state.heading);
  const along = Math.abs(ball.x * keel.x + ball.y * keel.y);
  const local = toShipLocal(hx, hy, target.state.x, target.state.y, target.state.heading);
  const fromBow = local.y > 0;
  let raking = along > 0.87;
  if (raking && fromBow && target.cls.passive.id === 'line') raking = false;
  // Raking Fire: shot along the keel from astern.
  const sst = shooter?.stats;
  const sternRake = raking && !fromBow && sst ? 1 + tval(sst, 'rakingFire') : 1;
  const rakeMul = (raking ? 1.25 : 1) * sternRake;
  // Glancing blows off a steeply angled hull skip away.
  const glance = along > 0.5 && !raking ? 0.8 : 1;

  // Iron Strapping: extra armour against armour-piercing shot.
  const strap = p.ammo === 'heavy' ? 1 + tval(target.stats, 'strapping') : 1;
  const armor = Math.min(0.85, target.stats.armor * strap * (1 - (ARMOR_PIERCE[p.ammo] ?? 0)) * (1 - (gd?.pierce ?? 0)));
  const lore = (shooter?.hasFlag('leviathan_lore') && isMonster(target) ? 1.1 : 1) * (shooter?.hasFlag('fh_harpooneer') && isMonster(target) ? 1.1 : 1) * (shooter?.hasFlag('fh_white_orca') && target.npcRole === 'beast' ? 1.1 : 1) * (shooter?.hasFlag('tattoo_orca') && target.npcRole === 'beast' ? 1.1 : 1) * (shooter?.hasFlag('saint_maws_bell') && isMonster(target) ? 1.2 : 1) // Leviathan Lore, the Harpooneer, Saint Maw's Bell
    * (isMonster(target) ? (gd?.monster ?? 1) * (p.ammo === 'salt' ? 2.5 : 1) : 1); // the bomb-lance gun; blessed salt for the deep and the dead
  // The ladder (canon D12): the gap of levels cuts or swells the shot, and a junior makes fewer criticals, or none.
  const lad = ladderBetween(game, shooter, target);
  const cx = lad.crits;
  let hullDmg = p.damage * ammo.hullMul * falloff * rakeMul * glance * (1 - armor) * target.stats.incomingDamageMul * lore * lad.dealt;
  // No single broadside may take more than 30% of a hull (Iron Coffin: 20%).
  if (p.volley !== undefined) {
    const rec = game.volleys.get(p.volley);
    if (rec) {
      const cap = target.stats.hullMax * (target.hasFlag('iron_coffin') ? 0.2 : 0.3);
      const done = rec.dealt.get(target.id) ?? 0;
      hullDmg = Math.max(0, Math.min(hullDmg, cap - done));
      rec.dealt.set(target.id, done + hullDmg);
    }
  }
  const chain = p.ammo === 'chain' ? 1 + (sst ? tval(sst, 'chainSail') : 0) : 1;
  const sailDmg = p.damage * ammo.sailMul * falloff * (sst?.sailDamageMul ?? 1) * chain * lad.dealt * (gd?.sailMul ?? 1);
  const grape = p.ammo === 'grape' ? 1 + (sst ? tval(sst, 'grapeCrew') : 0) : 1;
  // Splinter Storm: every ball into the hull sends splinters through the gun deck.
  const splinters = sst?.flags.has('splinter_storm') && p.ammo !== 'grape' && hullDmg > 5 ? 1 : 0;
  // The hull is the wall the stacks stand behind (docs/17 H1): grape sweeps the open deck, a ball kills more through a
  // shattered side than through a sound one; and the men fall out of her stacks, the tougher and the better covered
  // her army the fewer.
  const crewKill = (ammo.crewKill * (sst?.crewKillMul ?? 1) * grape * (gd?.crewMul ?? 1) * (raking ? 1.8 : 1) * (0.5 + game.rng.float()) + splinters) * lad.dealt * wallsOf(target, p.ammo === 'grape') * killFactor(target);

  let crit: string | undefined;
  let rudderDmg = 0;
  // Bar shot spins as it flies: a hit astern fouls the rudder twice as often.
  const rudderChance = (0.14 + (raking && !fromBow && sst ? tval(sst, 'rakingFire') : 0)) * (p.ammo === 'bar' ? 2 : 1);
  if (p.ammo !== 'grape' && local.y < -target.stats.length * 0.33 && !target.hasFlag('iron_tiller') && game.rng.chance(rudderChance * cx)) {
    rudderDmg = 0.2 + game.rng.float() * 0.15;
    crit = 'rudder';
  }
  // A gunbreaker's ball, laid low across the gun deck, dismounts a gun the oftener (heavy shot: by the gun alone).
  const dismount = p.ammo === 'round' ? 0.06 + (gd?.dismount ?? 0) : p.ammo === 'heavy' ? gd?.dismount ?? 0 : 0;
  if (dismount > 0 && game.rng.chance(dismount * cx)) {
    const side: Side = local.x < 0 ? 'port' : 'starboard';
    if (target.gunsDisabled[side] < target.stats.gunsPerSide) {
      target.gunsDisabled[side]++;
      crit = 'gun';
    }
  }
  // A mast shot through (docs/16 #2): chain shot amidships into rigging already torn — the topmast comes down, the
  // canvas with it, and she is slower for a while.
  const midships = Math.abs(local.y) < target.stats.length * 0.22;
  if (midships && p.ammo === 'chain' && target.sails < target.stats.sailHpMax * 0.5 && !target.hasFlag('ironbound_masts') && !target.hasEffect('broken_mast') && !target.hasEffect('topmast_down') && target.npcRole !== 'beast' && !target.cls.monster && game.rng.chance(MAST_CRIT_CHAIN * cx)) {
    target.addEffect({ id: 'topmast_down', until: game.now + MAST_CRIT_TIME, mods: { maxSpeed: -MAST_CRIT_SLOW }, source: shooter?.id }, game.now);
    target.sails = Math.max(0, target.sails - target.stats.sailHpMax * 0.06);
    game.toastShip(target, 'The topmast is shot away: she loses way for a while.', 'bad');
    crit = 'mast';
  }
  if (raking) crit = crit ?? 'raked';
  if (crit && crit !== 'raked') target.talentReady.patchPause = game.now + 3; // Patchwork Hull pauses
  if ((p.ammo === 'round' || p.ammo === 'heavy') && hullDmg > 15 && target.leaks < MAX_LEAKS && game.rng.chance(leakChance(target, p.ammo === 'heavy') * cx)) {
    target.leaks++;
    crit = 'leak';
  }

  // Waterline Gunner: a breach below the waterline leaks through any armour.
  if (sst && p.ammo !== 'grape' && hullDmg > 5 && game.rng.chance(tval(sst, 'breachChance') * cx)) {
    target.addEffect({ id: 'breach', until: game.now + 10 * Math.max(0.2, 1 - tval(target.stats, 'damageControl')), source: shooter!.id }, game.now);
    crit = 'breach';
  }
  const grapeMorale = p.ammo === 'grape' && sst ? tval(sst, 'grapeMorale') : 0;
  // Grand Battery: three allied ships on one target within two seconds.
  let battery = 0;
  if (shooter && grandBattery(game, shooter, target)) {
    hullDmg *= 1.1;
    const rec = p.volley !== undefined ? game.volleys.get(p.volley) : undefined;
    if (!rec || !rec.battery?.has(target.id)) {
      battery = 10;
      if (rec) (rec.battery ??= new Set()).add(target.id);
    }
  }
  // Drowned bronze shakes a crew; a stinkpot chokes it.
  const dread = (gd?.morale ?? 0) + (p.ammo === 'stinkpot' ? 2 : 0);
  const men = applyDamage(game, target, { hull: hullDmg, sails: sailDmg, crew: crewKill, rudder: rudderDmg, morale: (0.35 + grapeMorale + battery + dread) * lad.dealt, laddered: true }, shooter, { x: hx, y: hy });
  if (men > 0) {
    const rec = p.volley !== undefined ? game.volleys.get(p.volley) : undefined;
    if (rec) (rec.men ??= new Map()).set(target.id, (rec.men.get(target.id) ?? 0) + men);
    else menLost(game, target, men);
  }
  if (shooter && p.volley !== undefined && sst?.flags.has('splinter_storm') && target.crew < target.stats.crewMax * 0.3) {
    const rec = game.volleys.get(p.volley);
    if (rec && !rec.demoralised.has(target.id)) {
      rec.demoralised.add(target.id);
      target.morale = Math.max(0, target.morale - 5);
    }
  }
  let mastByTalent = false;
  if (shooter && talentHitEffects(game, shooter, target, p)) {
    crit = 'mast';
    mastByTalent = true; // Mast Breaker counts its own critical
  }
  if (p.ammo === 'cursed') onCursedHit(game, shooter, target);
  if (p.ammo === 'star' || p.ammo === 'stinkpot' || p.ammo === 'drag') shotEffects(game, p.ammo, shooter, target);
  if (shooter) giftOnHit(game, shooter, target); // a premium hull's strike (docs/02 §1.A.9)

  // Cargo destroyed by hull hits; powder may go up.
  if (p.ammo !== 'grape' && hullDmg > 10) {
    const deepHold = target.cls.passive.id === 'deep_hold' ? 0.5 : 1;
    if (game.rng.chance(0.07 * deepHold)) destroyRandomCargo(game, target, 1 + game.rng.int(0, 2));
    // Fire shot in the magazine burns like powder.
    const powder = (target.cargo.gunpowder ?? 0) + target.ammo.incendiary / 10;
    const sealed = target.hasFlag('sealed_magazine') ? 0.25 : 1;
    const hold = powder >= 5 ? cx * 0.012 * GOODS.gunpowder.danger * Math.min(3, powder / 10) * sealed : 0;
    // Her own magazine (docs/16 #2): a forged ball that goes deep amidships may find the powder room itself.
    const magazine = p.ammo === 'heavy' && midships && hullDmg > 15 && !target.cls.monster && target.npcRole !== 'beast' ? cx * MAGAZINE_CRIT_HEAVY * sealed : 0;
    if ((hold > 0 || magazine > 0) && game.rng.chance(hold + magazine)) {
      if (target.cargo.gunpowder) target.cargo.gunpowder = Math.floor(target.cargo.gunpowder * 0.4);
      applyDamage(game, target, { hull: target.stats.hullMax * 0.14, crew: 3, morale: 12, sails: 10 }, shooter);
      igniteShip(game, target, 12, null);
      game.emit({ k: 'fx', fx: 'explosion', x: Math.round(target.state.x), y: Math.round(target.state.y), r: 40 }, target.state.x, target.state.y);
      game.toastShip(target, hold > 0 ? 'Powder explosion in the hold!' : 'A ball in the powder room — the magazine goes up!', 'bad');
      const ts = game.sessionOf(target);
      if (ts?.profile) onMagazineBlast(game, ts);
      crit = 'powder';
    }
  }
  const fireRisk = Math.max(0, 1 + tval(target.stats, 'fireRisk'));
  const shell = gd?.fire && p.ammo !== 'grape' && p.ammo !== 'chain' ? gd.fire : 0; // a shell gun's hollow shot
  const ignite = ((p.ammo === 'incendiary' ? 0.25 * (shooter?.hasFlag('alchemist') ? 1.2 : 1) : p.ammo === 'round' && sst ? tval(sst, 'heatedShot') : 0) + shell) * fireRisk;
  if (ignite > 0 && hullDmg > 5 && game.rng.chance(ignite * cx)) {
    igniteShip(game, target, 10 + game.rng.float() * 6, shooter);
    crit = 'fire';
  }
  if (p.ammo === 'chain' && shooter?.hasFlag('tangled_rigging')) {
    target.addEffect({ id: 'tangled', until: game.now + 6, mods: { turnRate: -0.35 }, source: shooter.id }, game.now);
  }
  if (crit === 'rudder' || crit === 'gun' || crit === 'powder' || crit === 'fire' || (crit === 'mast' && !mastByTalent)) onCrit(shooter);
  game.emit({ k: 'hit', x: Math.round(hx), y: Math.round(hy), ship: target.id, dmg: Math.round(hullDmg), ammo: p.ammo, crit }, hx, hy);
}

/** The rarer shot at work on the ship it strikes: a star lights her up, a stinkpot chokes her gun crews, a drag hook
 *  slows her. Each a short status effect, so the stat pipeline (and the client's prediction) carries it. */
function shotEffects(game: Game, ammo: AmmoId, shooter: ShipEntity | null, target: ShipEntity): void {
  const now = game.now, source = shooter?.id;
  if (ammo === 'star') {
    // Lit: smoke and the dark no longer hide her, she is seen from afar, and every gunner lays tighter on her.
    if (target.effects.some((e) => e.flags?.includes('hidden'))) target.effects = target.effects.filter((e) => !e.flags?.includes('hidden'));
    target.addEffect({ id: 'starlit', until: now + 20, mods: { signature: 0.5 }, source }, now);
    target.addEffect({ id: 'ranged_in', until: now + 10, source }, now);
  } else if (ammo === 'stinkpot') target.addEffect({ id: 'stinkpot', until: now + 6, mods: { reloadMul: 0.3 }, source }, now);
  else if (ammo === 'drag') target.addEffect({ id: 'dragged', until: now + 8, mods: { maxSpeed: -0.15 }, source }, now);
}

/** Sets a ship on fire; Powder Discipline shortens the blaze. */
export function igniteShip(game: Game, target: ShipEntity, seconds: number, source: ShipEntity | null): void {
  const dur = seconds * Math.max(0.2, 1 + tval(target.stats, 'fireRisk') + tval(target.stats, 'fireFight') - tval(target.stats, 'damageControl'));
  target.addEffect({ id: 'fire', until: game.now + dur, source: source?.id }, game.now);
}

/** Per-hit talent rules of the shooter: Mast Breaker and Crossfire. True when a mast went by the board. */
function talentHitEffects(game: Game, shooter: ShipEntity, target: ShipEntity, p: Projectile): boolean {
  const now = game.now;
  let mast = false;
  if (p.ammo === 'chain' && !target.hasFlag('ironbound_masts') && target.sails < target.stats.sailHpMax * 0.5 && !target.hasEffect('broken_mast') && game.rng.chance(tval(shooter.stats, 'mastBreak'))) {
    // Stays until a shipyard steps a new mast (cleared by port repairs).
    target.addEffect({ id: 'broken_mast', until: now + 1e9, mods: { maxSpeed: -0.3 }, source: shooter.id }, now);
    mastWreck(game, target);
    game.emit({ k: 'fx', fx: 'broken_mast', x: Math.round(target.state.x), y: Math.round(target.state.y) }, target.state.x, target.state.y);
    game.toastShip(target, 'A mast goes by the board!', 'bad');
    onCrit(shooter);
    mast = true;
  }
  target.recentHits = target.recentHits.filter((h) => now - h.t < 3);
  if (shooter.hasFlag('crossfire') && (target.talentReady.crossfire ?? 0) <= now) {
    const cross = target.recentHits.some((h) => Math.abs(wrapAngle(h.dir - p.heading)) >= Math.PI / 2 && (h.shooter === shooter.id || !game.isHostile(game.ships.get(h.shooter) ?? shooter, shooter)));
    if (cross) {
      target.talentReady.crossfire = now + 20;
      target.addEffect({ id: 'crossfire', until: now + 6, mods: { incomingDamageMul: 0.12 }, source: shooter.id }, now);
      target.morale = Math.max(0, target.morale - 10);
      game.emit({ k: 'fx', fx: 'crossfire', x: Math.round(target.state.x), y: Math.round(target.state.y) }, target.state.x, target.state.y);
    }
  }
  target.recentHits.push({ t: now, dir: p.heading, shooter: shooter.id });
  return mast;
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
  /** The ladder of strength is already reckoned in (a cannonball, capped per broadside after it). */
  laddered?: boolean;
}

/** A mast gone by the board: its wreckage drags alongside — the helm answers slowly, but the tangle of spars and
 *  canvas shields that side — until the captain cuts it away (a choice: the shield or the helm). */
export function mastWreck(game: Game, ship: ShipEntity): void {
  ship.addEffect({ id: 'mast_wreck', until: game.now + 1e9, mods: { turnRate: -0.3, incomingDamageMul: -0.15 } }, game.now);
  game.toastShip(ship, 'The mast goes by the board! Her wreckage drags alongside — cut it away to free the helm.', 'bad');
}

/** Axes on the lanyards: the wreckage goes, and with it the drag on the helm and the shield on the side. */
export function cutMastWreck(game: Game, ship: ShipEntity): string | null {
  if (!ship.hasEffect('mast_wreck')) return 'No wreckage to cut away';
  ship.effects = ship.effects.filter((e) => e.id !== 'mast_wreck');
  const mast = ship.effects.find((e) => e.id === 'broken_mast');
  if (mast) mast.mods = { maxSpeed: -0.2 }; // a jury rig on the stump
  ship.recompute(game.now);
  game.emit({ k: 'fx', fx: 'broken_mast', x: Math.round(ship.state.x), y: Math.round(ship.state.y) }, ship.state.x, ship.state.y);
  game.toastShip(ship, 'The wreckage is cut away: the helm answers again, but that side lies open.', 'info');
  return null;
}

/** Central damage entry point for cannon fire, abilities, collisions and hazards. Returns the men it killed. */
export function applyDamage(game: Game, target: ShipEntity, d: DamagePacket, source: ShipEntity | null, at?: { x: number; y: number }): number {
  if (!target.alive || target.docked || target.god) return 0;
  // Locked in a boarding: nothing from outside lands on her (see damageBlocked).
  if (target.grappled && (!source || target.boarding!.with !== source.id)) return 0;
  // A ship across a zone line: the hit is hers to take in her own zone.
  if (target.ghost) {
    game.zone?.forwardHit(target, d, source);
    return 0;
  }
  // Under black water (Abyss Step, the Drowned King) nothing can touch her.
  if (target.hasEffect('submerged') || target.hasEffect('ghost_return')) return 0;
  // Inside the Lantern Maw nothing reaches her but the Maw; a boss decides how a hit lands on it.
  if (swallowedShield(target, source)) return 0;
  if (target.bossOf) {
    const landed = bossIncoming(game, target, d, source, at);
    if (!landed) return 0;
    d = landed;
  }
  const now = game.now;
  // Pact of Salt and Bone: the monsters of the deep bite softer.
  if (source && isMonster(source) && d.hull) d = { ...d, hull: d.hull * pactDamageMul(target) };
  // The Drowned Man on the bow: the Drowned Captain enters every fight with 10 Dread.
  for (const x of [source, target]) if (x && x.captain === 'drowned' && x.hasFlag('fh_drowned_man') && !x.inCombat(now)) x.dread = Math.max(x.dread, 10);
  // Nobody reaches into a duel, and duellists reach nobody else.
  if (source && source !== target) {
    const pv = pvpBlocked(game, source, target);
    if (pv && pv !== 'duel_ok') return 0;
  }
  if (source) {
    registerAggression(game, source, target);
    source.lastCombat = now;
  }
  target.lastCombat = now;
  target.protectedUntil = 0;
  // The ladder of strength (canon D12): the gap of levels cuts or swells the blow; a junior cannot bring a senior
  // below her floor of hull and crew.
  const lad = source && source !== target ? ladderBetween(game, source, target) : null;
  if (lad && lad.dealt !== 1 && !d.laddered) d = { ...d, hull: (d.hull ?? 0) * lad.dealt, sails: (d.sails ?? 0) * lad.dealt, crew: (d.crew ?? 0) * lad.dealt, morale: (d.morale ?? 0) * lad.dealt };
  survivalOnHit(game, target, d);
  if (d.hull) {
    let hull = screenFlagship(game, target, d.hull);
    if (lad?.floorHull) hull = Math.min(hull, Math.max(0, target.hull - lad.floorHull * target.stats.hullMax));
    if (target.zoneBoss) zbCredit(game, target, source, Math.min(Math.max(0, target.hull), hull)); // each captain's part of her (docs/21)
    target.hull -= hull;
    onHullDamage(game, target, hull, source);
  }
  if (d.sails) target.sails = Math.max(0, target.sails - d.sails);
  if (d.rudder && !target.hasFlag('iron_tiller')) target.rudderHp = Math.max(0, target.rudderHp - d.rudder);
  let fell = 0;
  if (d.crew) {
    let killed = Math.floor(d.crew);
    if (game.rng.float() < d.crew - killed) killed++;
    killed = Math.min(killed, target.crew);
    if (lad?.floorCrew) killed = Math.min(killed, Math.max(0, target.crew - Math.ceil(lad.floorCrew * target.stats.crewMax)));
    // The First Watch's raider: the lesson's guns thin her men, but leave enough for the hex battle to be a real one.
    const floor = target.npcRole ? game.npcs.get(target.id)?.practiceFloor : undefined;
    if (floor !== undefined) killed = Math.min(killed, Math.max(0, target.crew - floor));
    fell = killMen(game, target, killed, source);
  }
  if (d.morale) target.morale -= d.morale * moraleLossMul(target);
  // Terror: crews under 30% break twice as fast.
  if (source && source.hasFlag('terror') && target.crew < target.stats.crewMax * 0.3) target.morale -= (d.morale ?? 0) + 0.8;
  target.morale = clamp(target.morale, 0, 100);
  if (target.hasFlag('rule_of_the_lash')) target.morale = Math.max(50, target.morale); // the lash holds them in a fight
  if (target.cls.passive.id === 'dead_crew') target.morale = Math.max(target.morale, 60);

  if (target.hull <= 0) {
    if (target.lastStandUntil > now) {
      target.hull = 1;
    } else if (target.hasFlag('unsinkable') && target.unsinkableReadyAt <= now) {
      target.hull = 1;
      target.unsinkableReadyAt = now + 300;
      if (target.captain === 'drowned') {
        // Drowned Once: 12 s between water and light. Mend her to 10% or the sea keeps her.
        target.lastStandUntil = now + 12;
        target.addEffect({ id: 'between_worlds', until: now + 1e9, mods: { incomingDamageMul: -0.5, boardingPower: -0.3 } }, now);
        game.emit({ k: 'fx', fx: 'between_worlds', x: Math.round(target.state.x), y: Math.round(target.state.y), r: 40 }, target.state.x, target.state.y);
        game.toastShip(target, 'Between water and light: 12 s. Mend her to a tenth of her hull or the sea keeps her.', 'bad');
      } else {
        target.lastStandUntil = now + 6;
        game.toastShip(target, 'Unsinkable! Hold her together!', 'good');
      }
    } else {
      target.hull = 0;
      game.beginSinking(target);
    }
  }
  if (target.npcRole) game.npcOnDamaged(target, source);
  else if (source && target.isPlayer && (target.talentReady.patrols ?? 0) <= now) {
    target.talentReady.patrols = now + 10;
    callPatrols(game, target, source);
  }
  return fell;
}

/** `killed` men fall from her stacks (by their exposure): the wounded among them, the crew's nerve, the Drowned's
 *  rising dead. No dice: every roll was made before. Returns the men actually lost. */
export function killMen(game: Game, target: ShipEntity, killed: number, source: ShipEntity | null): number {
  killed = Math.max(0, Math.min(Math.floor(killed), target.crew));
  if (!killed) return 0;
  const before = target.crew;
  target.loseMen(killed);
  target.wounded += woundedOf(game, target, killed);
  onCrewKilled(game, target, killed, source);
  onOwnCrewKilled(target, killed, game.now);
  // Crew of the Drowned: the fallen rise; the crew never drops under 40%.
  if (target.hasFlag('crew_of_drowned')) target.crew = Math.max(target.crew, Math.ceil(target.stats.crewMax * 0.4));
  target.morale -= killed * 0.8 * moraleLossMul(target);
  return Math.max(0, before - target.crew);
}

/** First blood between two ships decides crimes, reputation and self-defence windows. */
function registerAggression(game: Game, a: ShipEntity, b: ShipEntity): void {
  const now = game.now;
  const prev = b.attackers.get(a.id);
  b.attackers.set(a.id, now);
  if (a.isPlayer && !b.isPlayer && b.npcRole === 'merchant' && prev === undefined) tributeBroken(game, a, b); // a word given for tribute
  if (b.npcRole === 'boss' || a.npcRole === 'boss' || b.cls.monster) return; // no law and no flag at sea against the deep
  if (prev !== undefined && now - prev < 60) return; // same engagement
  if (inDuel(game, a) && inDuel(game, a) === inDuel(game, b)) return; // a duel is no crime
  const pa = a.isPlayer ? game.profileOf(a) : null;
  if (!pa) return;
  // Self defence: b attacked a recently.
  const selfDefence = (a.attackers.get(b.id) ?? -999) > now - 90;
  if (selfDefence) return;
  const safety = REGIONS[b.region].safety;
  const zoneMul = safety === 'safe' ? 2 : safety === 'contested' ? 1 : 0.3;
  let infamy = 0;
  if (b.isPlayer) {
    onPlayerAttack(game, a, b);
    // Fair game (the Black Flag, Wanted 2+, a price on the head for a licensed hunter) costs nothing.
    if (!legalTarget(game, a, b)) infamy = 18 * zoneMul * crueltyMul(game, a, b);
  } else if (b.caravanId) {
    // A captain's caravan (docs/12 P8): a crime in contested water, fair game in lawless.
    infamy = REGIONS[b.region].safety === 'lawless' ? 0 : 14 * zoneMul;
  } else if (b.faction !== 'player' && FACTIONS[b.faction].lawful) {
    infamy = (b.npcRole === 'patrol' ? 26 : 14) * zoneMul;
    game.adjustRep(a, b.faction, -8);
  } else if (b.faction !== 'player') {
    game.adjustRep(a, b.faction, -4);
  }
  // Black Flag in contested water: the first attack under it costs a whole wanted level.
  if (a.hasEffect('aggressor') && REGIONS[b.region].safety === 'contested') {
    const lvl = wantedLevel(pa.infamy);
    if (lvl < 5) infamy = Math.max(infamy, WANTED_THRESHOLDS[lvl + 1] - pa.infamy + 1);
    a.effects = a.effects.filter((e) => e.id !== 'aggressor');
  }
  if (infamy > 0) game.addInfamy(a, infamy, `attacked ${b.name}`);
}
