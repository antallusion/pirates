// Survival rules (docs/03_TALENT_TREES.md §4.7): the long voyage (weariness, scurvy, sea wear), storm seas,
// the wounded coming back, planking buffers, self-patching hulls, jury-rigged masts, lifeboats and
// scuttle charges, and the damage hooks the survival talents add to every hit.

import { dist } from '../../../shared/src/math.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import type { DamagePacket } from './combat.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import { playerWounded } from './crewlife.ts';

const WEARY_AFTER = 3600; // a crew tires of the sea after an hour away from port
const SCURVY_AFTER = 3600;

/** Seconds at sea since the last port. */
export function atSeaFor(game: Game, ship: ShipEntity): number {
  return ship.voyageStart ? game.now - ship.voyageStart : 0;
}

/** Morale baseline penalty for a long voyage (Long Voyage delays it by 30 min per rank). */
export function weariness(game: Game, ship: ShipEntity): number {
  if (!ship.isPlayer) return 0;
  const grace = WEARY_AFTER + 1800 * tx(ship.stats, 'longVoyage');
  const over = atSeaFor(game, ship) - grace;
  return over > 0 ? Math.min(20, 5 + over / 360) : 0;
}

/** Hull damage multiplier from the sea itself: storm seas, whirlpools, the Maelstrom Wall. */
export function seaDamageMul(ship: ShipEntity): number {
  return Math.max(0, 1 + tx(ship.stats, 'stormHull'));
}

/** Once per second for each ship at sea. */
export function stepSurvival(game: Game, ship: ShipEntity): void {
  const now = game.now;
  const st = ship.stats;
  const w = game.weatherOf(ship);
  // Storm seas break over the bow when she is driven hard.
  if ((w === 'storm' && ship.state.speed > 4) || w === 'black_storm') {
    if (!ship.hasFlag('storm_rider')) ship.hull -= st.hullMax * (w === 'black_storm' ? 0.0005 : 0.0002) * seaDamageMul(ship);
  }
  // Patchwork Hull: constant patching, paused briefly by critical hits.
  if (ship.hasFlag('patchwork_hull') && (ship.talentReady.patchPause ?? 0) <= now && canMend(game, ship)) ship.hull = Math.min(st.hullMax, ship.hull + st.hullMax * 0.0025);
  // Double Planking refills a minute after the fight.
  const planking = tx(st, 'planking');
  if (planking > 0 && now - ship.lastCombat > 60) ship.planking = st.hullMax * planking;
  // The wounded come back on deck two minutes after the fight (a captain's surgeon works on hers: crewlife.ts).
  if (ship.wounded > 0 && now - ship.lastCombat > 120 && !ship.isPlayer) {
    const back = Math.min(ship.wounded, st.crewMax - ship.crew);
    ship.crew += back;
    ship.wounded = 0;
    if (back > 0) game.toastShip(ship, `The surgeon returns ${back} wounded to duty.`, 'good');
  }
  // Damage Control jury-rigs a broken mast at sea.
  const dc = tx(st, 'damageControl');
  if (dc > 0 && ship.hasEffect('broken_mast')) {
    ship.talentReady.juryRig ??= now + 180 * Math.max(0.2, 1 - dc);
    if (now >= ship.talentReady.juryRig) {
      ship.effects = ship.effects.filter((e) => e.id !== 'broken_mast' && e.id !== 'mast_wreck');
      ship.recompute(now);
      delete ship.talentReady.juryRig;
      game.toastShip(ship, 'A jury-rigged mast is stepped. She can run again.', 'good');
    }
  } else delete ship.talentReady.juryRig;
  if (!ship.isPlayer || ship.docked) return;
  const sea = atSeaFor(game, ship);
  // Sea wear: every ten minutes at sea the hull works and weeps (not below 40%).
  if ((ship.talentReady.wear ?? 0) === 0) ship.talentReady.wear = now + 600;
  if (now >= ship.talentReady.wear) {
    ship.talentReady.wear = now + 600;
    if (ship.hull > st.hullMax * 0.4) ship.hull -= st.hullMax * 0.005 * Math.max(0, 1 - 0.15 * tx(st, 'longVoyage')) * (ship.hasFlag('copper_sheathing') ? 0.5 : 1);
  }
  // Scurvy after an hour without making port; Lime and Salt keep it off.
  const scurvyDue = now >= (ship.talentReady.scurvy ?? 0);
  if (scurvyDue) ship.talentReady.scurvy = now + 300;
  if (sea > SCURVY_AFTER && scurvyDue && !ship.hasFlag('lime_and_salt') && !ship.hasFlag('well_fed') && game.rng.chance(0.25) && ship.crew > st.crewMin * 0.5) {
    const n = 1 + game.rng.int(0, 1);
    ship.crew -= n;
    ship.morale = Math.max(0, ship.morale - 3);
    game.toastShip(ship, `Scurvy: ${n} hand${n > 1 ? 's' : ''} too weak to stand. Make port.`, 'bad');
  }
}

/** Survival talents on the receiving end of any damage. Mutates the packet. */
export function survivalOnHit(game: Game, target: ShipEntity, d: DamagePacket): void {
  if (d.hull && d.hull > 0) {
    if (target.hasEffect('brace')) d.hull *= 0.7;
    const grim = tx(target.stats, 'grimEndurance');
    if (grim > 0 && target.hull < target.stats.hullMax * 0.35) d.hull *= 1 - grim;
    if (target.planking > 0) {
      const soak = Math.min(target.planking, d.hull);
      target.planking -= soak;
      d.hull -= soak;
    }
  }
  if (d.crew && d.crew > 0) {
    d.crew *= Math.max(0, 1 + tx(target.stats, 'hardenedCrew'));
  }
  void game;
}

/** Ship's Surgeon: part of the dead were only wounded. */
export function woundedOf(game: Game, target: ShipEntity, killed: number): number {
  if (target.hasFlag('crew_of_drowned')) return 0; // the dead rise instead
  if (target.isPlayer) return playerWounded(target, killed); // a quarter and more of hers are only wounded (docs/16 #19)
  const share = tx(target.stats, 'surgeon');
  if (share <= 0 || killed <= 0) return 0;
  const x = killed * share;
  return Math.floor(x) + (game.rng.float() < x % 1 ? 1 : 0);
}

/** Iron Coffin: nothing restores the hull while the fight is on. */
export function canMend(game: Game, ship: ShipEntity): boolean {
  // Black water and cursed rot: nothing knits a hull there.
  if (ship.hasEffect('black_water') || ship.hasEffect('rot')) return false;
  return !(ship.hasFlag('iron_coffin') && ship.inCombat(game.now));
}

/** Plug the Breach: +8% hull, every leak and breach stopped. */
export function plugTheBreach(game: Game, ship: ShipEntity): void {
  if (canMend(game, ship)) ship.hull = Math.min(ship.stats.hullMax, ship.hull + ship.stats.hullMax * 0.08);
  ship.leaks = 0;
  ship.effects = ship.effects.filter((e) => e.id !== 'breach');
  ship.recompute(game.now);
}

/** Brace for Impact: 3 s of −30% hull damage; the guns stop loading. */
export function brace(game: Game, ship: ShipEntity): void {
  ship.addEffect({ id: 'brace', until: game.now + 3 }, game.now);
}

/** Scuttle Charges: the magazine goes up — nothing left for anyone, and ships alongside pay for it. */
export function blowMagazine(game: Game, ship: ShipEntity): void {
  ship.scuttleAt = 0;
  ship.cargo = {};
  game.forShipsNear(ship.state.x, ship.state.y, 120, (o) => {
    if (o.id === ship.id || !o.alive || o.docked) return;
    if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) - o.stats.length / 2 > 60) return;
    o.hull -= o.stats.hullMax * 0.1;
    o.morale = Math.max(0, o.morale - 10);
    if (o.hull <= 0) {
      o.hull = 0;
      game.beginSinking(o);
    }
  });
  game.emit({ k: 'fx', fx: 'explosion', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 70 }, ship.state.x, ship.state.y);
}

/** Light the fuse: 3 s, at any morale (Scuttle Charges). */
export function lightFuse(game: Game, ship: ShipEntity): string | null {
  if (!ship.hasFlag('scuttle_charges')) return 'You need Scuttle Charges';
  if (ship.scuttleAt) return 'The fuse is already burning';
  ship.scuttleAt = game.now + 3;
  game.toastShip(ship, 'The fuse is lit! Three seconds…', 'bad');
  return null;
}
