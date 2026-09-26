// Abyssal (docs/03 §4.10): the deep as a bargain. Every gift raises Dread — the Drowned Captain's own resource,
// or for any other captain the sanity the crew has lost (docs/00 D4) — and many grow stronger with it.
// Cursed shot, the rot and the weight of the deep, drowned sailors, black water, the siren, the step into
// the abyss, the Drowned King's return, and the two keystones.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { applyDamage } from './combat.ts';
import type { Game } from './Game.ts';
import { callPower, gainDread, loseSanity } from './mind.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export const ABYSS_TALENTS_PREFIX = 'abs_';

/** The ship's Dread in the abyssal sense (0..100). */
export function abyssDread(ship: ShipEntity): number {
  return ship.captain === 'drowned' ? ship.dread : 100 - ship.sanity;
}

/** Raise the deep's pressure on a ship. */
export function raiseDread(game: Game, ship: ShipEntity, n: number): void {
  if (n <= 0 || !ship.alive) return;
  if (ship.captain === 'drowned') gainDread(game, ship, n);
  else if (ship.isPlayer) loseSanity(ship, n);
  else ship.morale = Math.max(0, ship.morale - n * 0.3); // an NPC crew simply loses its nerve
}

/** Strength of abyssal abilities: Whispers Below, the Call, and the Heart of the Abyss. */
export function abyssPower(ship: ShipEntity): number {
  let p = (1 + tx(ship.stats, 'abyssPower')) * callPower(ship);
  if (ship.hasFlag('heart_of_abyss')) p *= 1 + 0.005 * abyssDread(ship);
  return p;
}

/** Cooldown multiplier of abyssal abilities (Voice of the Choir, Offering); the Heart forbids any cut. */
export function abyssCooldownMul(ship: ShipEntity): number {
  if (ship.hasFlag('heart_of_abyss')) return 1;
  let m = 1;
  if (ship.hasFlag('voice_of_choir') && abyssDread(ship) >= 75) m *= 0.7;
  if (ship.hasEffect('offering')) m *= 0.9;
  return m;
}

// ------------------------------------------------------------------ cursed shot

/** A cursed volley: the crew hates loading it, the Crown hates seeing it, the deep likes it. */
export function onCursedVolley(game: Game, ship: ShipEntity): void {
  if (ship.captain !== 'drowned' && tx(ship.stats, 'drownedShot') <= 0 && !ship.hasFlag('crew_of_drowned')) ship.morale = Math.max(0, ship.morale - 1);
  raiseDread(game, ship, 1);
  if (ship.isPlayer && REGIONS[ship.region].safety !== 'lawless') game.adjustRep(ship, 'crown', -1);
}

/** Damage multiplier for cursed shot fired by this ship (Heart of the Abyss). */
export function cursedDamageMul(ship: ShipEntity): number {
  return ship.hasFlag('heart_of_abyss') ? 1 + 0.005 * abyssDread(ship) : 1;
}

/** A cursed ball strikes: rot, fear, and (with talents) the weight of the deep and sea rot. */
export function onCursedHit(game: Game, shooter: ShipEntity | null, target: ShipEntity): void {
  const now = game.now;
  target.addEffect({ id: 'rot', until: now + 20, source: shooter?.id }, now);
  target.morale = Math.max(0, target.morale - 3);
  if (!shooter) return;
  const ds = tx(shooter.stats, 'drownedShot');
  if (ds > 0) {
    const cur = target.effects.find((e) => e.id === 'depth_weight');
    const stacks = Math.min(2, (cur ? Math.round(-(cur.mods?.maxSpeed ?? 0) / (0.1 * ds)) : 0) + 1);
    target.addEffect({ id: 'depth_weight', until: now + 5, mods: { maxSpeed: -0.1 * ds * stacks }, source: shooter.id }, now);
  }
  const rot = tx(shooter.stats, 'seaRot');
  if (rot > 0) {
    const cur = target.seaRot && target.seaRot.until > now ? target.seaRot.stacks : 0;
    target.seaRot = { stacks: Math.min(rot >= 2 ? 2 : 1, cur + 1), until: now + 4, by: shooter.id };
  }
}

export function seaRotStacks(ship: ShipEntity, now: number): number {
  return ship.seaRot && ship.seaRot.until > now ? ship.seaRot.stacks : 0;
}

// ------------------------------------------------------------------ actives

export function abyssalActive(game: Game, s: PlayerSession, id: string, x?: number, y?: number): string | null {
  const ship = s.ship!;
  const now = game.now;
  const pw = abyssPower(ship);
  const px = Number.isFinite(x) ? x! : ship.state.x, py = Number.isFinite(y) ? y! : ship.state.y;
  const nearest = (range: number, fromX: number, fromY: number): ShipEntity | null => {
    let best: ShipEntity | null = null;
    let bd = range;
    game.forShipsNear(fromX, fromY, range, (o) => {
      if (o.id === ship.id || o.ownerId === ship.id || !o.alive || o.docked) return;
      if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) > 300) return;
      const d = dist(o.state.x, o.state.y, fromX, fromY);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    return best;
  };
  switch (id) {
    case 'abs_grasp_of_the_deep': {
      const t = nearest(400, px, py);
      if (!t) return 'Nothing within 300 m for the deep to seize';
      t.addEffect({ id: 'grasped', until: now + 3, mods: { maxSpeed: -0.4 * pw }, source: ship.id }, now);
      if (ship.hasFlag('krakens_embrace')) {
        t.addEffect({ id: 'kraken_hold', until: now + (t.isPlayer ? 0.75 : 1.5), mods: { maxSpeed: -1 }, source: ship.id }, now);
        t.state.speed = 0;
      }
      t.lastCombat = now;
      t.attackers.set(ship.id, now);
      game.emit({ k: 'fx', fx: 'drowned_hands', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 30 }, t.state.x, t.state.y);
      raiseDread(game, ship, 8);
      return null;
    }
    case 'abs_hymn_of_the_choir': {
      game.forShipsNear(ship.state.x, ship.state.y, 400, (o) => {
        if (o.id === ship.id || o.ownerId === ship.id || !o.alive || !(game.isHostile(o, ship) || game.isHostile(ship, o))) return;
        if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) > 400) return;
        o.morale = Math.max(0, o.morale - 15 * pw);
        raiseDread(game, o, 10 * pw);
        if (!o.isPlayer && o.morale < 30) o.addEffect({ id: 'panic', until: now + 6, mods: { reloadMul: 0.4, boardingPower: -0.3 }, source: ship.id }, now);
      });
      game.emit({ k: 'fx', fx: 'war_cry', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 400 }, ship.state.x, ship.state.y);
      raiseDread(game, ship, 12);
      return null;
    }
    case 'abs_small_bargain': {
      const lost = Math.max(1, Math.round(ship.crew * 0.03));
      if (ship.crew <= lost + 1) return 'Too few hands to give';
      ship.crew -= lost;
      ship.hull = Math.min(ship.stats.hullMax, ship.hull + ship.stats.hullMax * 0.06 * ship.rank('abs_small_bargain') * pw);
      game.toastShip(ship, `${lost} men go over the side without a word. The planks close up behind them.`, 'info');
      raiseDread(game, ship, 6);
      return null;
    }
    case 'abs_black_water': {
      const d = dist(px, py, ship.state.x, ship.state.y);
      const k = d > 350 ? 350 / d : 1;
      const cx = ship.state.x + (px - ship.state.x) * k, cy = ship.state.y + (py - ship.state.y) * k;
      game.zones.push({ kind: 'black_water', x: cx, y: cy, r: 40, start: now, until: now + 8, owner: ship.id, power: pw, hit: [] });
      game.emit({ k: 'fx', fx: 'drowned_hands', x: Math.round(cx), y: Math.round(cy), r: 40 }, cx, cy);
      raiseDread(game, ship, 15);
      return null;
    }
    case 'abs_sirens_call': {
      const t = nearest(400, px, py);
      if (!t) return 'No ship within 300 m hears the song';
      if (t.isPlayer) game.zones.push({ kind: 'siren', x: ship.state.x, y: ship.state.y, r: 0, target: t.id, start: now, until: now + 2, owner: ship.id, power: pw, hit: [] });
      else t.seizedHelm = { until: now + 4, x: ship.state.x, y: ship.state.y };
      t.attackers.set(ship.id, now);
      raiseDread(game, ship, 15);
      return null;
    }
    case 'abs_abyss_step': {
      if (ship.boarding || ship.grappled) return 'Not while grappled';
      ship.addEffect({ id: 'submerged', until: now + 2, mods: { maxSpeed: -1 } }, now);
      ship.abyssStepAt = now + 2;
      game.emit({ k: 'fx', fx: 'between_worlds', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 40 }, ship.state.x, ship.state.y);
      raiseDread(game, ship, 20);
      return null;
    }
  }
  return 'Unknown abyssal gift';
}

// ------------------------------------------------------------------ per-second rules

/** For every ship: sea rot eats the hull; a stepping ship surfaces. */
export function stepAbyssShip(game: Game, ship: ShipEntity): void {
  const now = game.now;
  const rot = seaRotStacks(ship, now);
  if (rot > 0) {
    const by = game.ships.get(ship.seaRot!.by) ?? null;
    ship.hull -= ship.stats.hullMax * 0.005 * rot;
    if (by) ship.attackers.set(by.id, now);
    if (ship.hull <= 0) applyDamage(game, ship, { hull: 1 }, by);
  }
  if (ship.abyssStepAt && now >= ship.abyssStepAt) {
    ship.abyssStepAt = 0;
    const v = headingVec(ship.state.heading);
    let d = 200;
    while (d > 0 && isLand(game.world, ship.state.x + v.x * d, ship.state.y + v.y * d)) d -= 25;
    ship.state.x += v.x * d;
    ship.state.y += v.y * d;
    game.grid.upsert(ship.id, ship.state.x, ship.state.y);
    game.emit({ k: 'fx', fx: 'maw_warn', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 30 }, ship.state.x, ship.state.y);
  }
  // Drowned sailors go back to the sea when their time is up.
  if (ship.drownedCrew.length) {
    const keep = ship.drownedCrew.filter((d) => d.until > now);
    for (const d of ship.drownedCrew) if (d.until <= now) ship.crew = Math.max(1, ship.crew - d.n);
    ship.drownedCrew = keep;
  }
  for (const r of ship.risingQueue) {
    if (r.at > now) continue;
    const room = ship.stats.crewMax - ship.crew;
    const n = Math.min(r.n, room);
    if (n > 0) {
      ship.crew += n;
      ship.drownedCrew.push({ n, until: now + 180 + 60 * tx(ship.stats, 'hollowMen') });
      game.toastShip(ship, `${n} of the dead climb back over the rail, streaming water.`, 'info');
    }
  }
  ship.risingQueue = ship.risingQueue.filter((r) => r.at > now);
  const hollow = tx(ship.stats, 'hollowMen');
  if (hollow > 0 && ship.drownedCrew.length) ship.addEffect({ id: 'hollow_men', until: now + 1.6, mods: { meleeDamage: 0.2 * hollow } }, now);
}

/** Once a second for a player: fear that spreads, the keystones, and the spawn. */
export function stepAbyss(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  const now = game.now;
  const dread = abyssDread(ship);
  // Creeping Horror.
  const ch = tx(ship.stats, 'creepingHorror');
  if (ch > 0 && dread >= 50 && !ship.docked) {
    const tick3 = (ship.talentReady.horror ?? 0) <= now;
    const tick10 = (ship.talentReady.horrorDread ?? 0) <= now;
    if (tick3) ship.talentReady.horror = now + 3;
    if (tick10) ship.talentReady.horrorDread = now + 10;
    if (tick3 || tick10) {
      game.forShipsNear(ship.state.x, ship.state.y, 250, (o) => {
        if (o.id === ship.id || o.ownerId === ship.id || !o.alive || !(game.isHostile(o, ship) || game.isHostile(ship, o))) return;
        if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) > 250) return;
        if (tick3) o.morale = Math.max(0, o.morale - ch);
        if (tick10) raiseDread(game, o, 1);
      });
    }
  }
  // Crew of the Drowned: the dead keep the numbers up; the morale is the morale of the dead.
  if (ship.hasFlag('crew_of_drowned')) {
    ship.morale = 50;
    const floor = Math.ceil(ship.stats.crewMax * 0.4);
    if (ship.crew < floor) ship.crew = floor;
  }
  // Heart of the Abyss: at 100 the deep sends something up — and the pressure breaks.
  if (ship.hasFlag('heart_of_abyss') && dread >= 100 && !ship.docked) {
    const v = headingVec(game.rng.float() * Math.PI * 2);
    const spawn = game.spawnNpcShip('ghost', 'ghost_ship', 'free', ship.state.x + v.x * 350, ship.state.y + v.y * 350, 0, { ship: 'Abyss Spawn', captain: 'the Deep' });
    spawn.abyssSpawn = true;
    spawn.level = 30;
    spawn.addEffect({ id: 'spawn', until: Infinity, mods: { hullMax: 0.5, gunDamageMul: 0.3 } }, now);
    spawn.hull = spawn.stats.hullMax;
    spawn.removeAt = now + 600;
    const brain = game.npcs.get(spawn.id);
    if (brain) {
      brain.active = true;
      brain.chase = { id: ship.id, until: now + 600 };
    }
    game.grid.upsert(spawn.id, spawn.state.x, spawn.state.y);
    if (ship.captain === 'drowned') ship.dread = 0;
    else ship.sanity = 100;
    game.toastShip(ship, 'The water heaves. Something vast rises — an Abyss Spawn, and it hates everything that floats.', 'bad');
    game.emit({ k: 'fx', fx: 'maw', x: Math.round(spawn.state.x), y: Math.round(spawn.state.y), r: 60 }, spawn.state.x, spawn.state.y);
  }
}

/** Rising Dead: some of the fallen come back. */
export function onOwnCrewKilled(ship: ShipEntity, killed: number, now: number): void {
  const share = tx(ship.stats, 'risingDead');
  if (share <= 0 || killed <= 0) return;
  const n = Math.floor(killed * share + ship.risingFrac);
  ship.risingFrac = killed * share + ship.risingFrac - n;
  if (n > 0) ship.risingQueue.push({ n, at: now + 10 });
}

/** Offering: cargo over the side feeds the deep. */
export function makeOffering(game: Game, ship: ShipEntity, good: GoodId, n: number): void {
  const r = tx(ship.stats, 'offering');
  if (r <= 0 || n <= 0) return;
  const value = GOODS[good].basePrice * n;
  raiseDread(game, ship, Math.min(20, value / 50));
  if (r >= 2) ship.addEffect({ id: 'offering', until: game.now + 30 }, game.now);
  game.toastShip(ship, 'The sea takes the offering. Something below is pleased.', 'info');
}

/** Pact of Salt and Bone: monsters hurt less; at rank 2 they leave a deep-touched ship alone. */
export function pactDamageMul(target: ShipEntity): number {
  return Math.max(0.1, 1 - 0.15 * tx(target.stats, 'pact'));
}

export function pactNeutral(ship: ShipEntity, monster: ShipEntity, now: number): boolean {
  if (monster.abyssSpawn || tx(ship.stats, 'pact') < 2 || abyssDread(ship) < 60) return false;
  return (monster.attackers.get(ship.id) ?? -999) < now - 120;
}

/** Mark of the Drowned King: once an hour the sea sends her back. Returns true if she rose. */
export function drownedKingRises(game: Game, s: PlayerSession): boolean {
  const ship = s.ship!;
  const now = game.now;
  if (!ship.hasFlag('drowned_king')) return false;
  if ((ship.talentReady.drownedKing ?? 0) > now) return false;
  // Not in the same fight as Drowned Once or Unsinkable.
  if (ship.unsinkableReadyAt && now - (ship.unsinkableReadyAt - 300) < 120) return false;
  ship.talentReady.drownedKing = now + 3600;
  // Her cargo stays on the water.
  game.dropHold(ship);
  ship.cargo = {};
  ship.sinkingUntil = 0;
  ship.hull = ship.stats.hullMax * 0.3;
  ship.leaks = 0;
  ship.water = 0;
  ship.effects = ship.effects.filter((e) => e.id !== 'fire');
  ship.addEffect({ id: 'submerged', until: now + 15, mods: { maxSpeed: -1 } }, now);
  ship.addEffect({ id: 'ghost_return', until: now + 25, mods: { incomingDamageMul: -1 } }, now);
  game.toastShip(ship, 'The Drowned King does not let you go. In fifteen seconds you rise again.', 'good');
  return true;
}
