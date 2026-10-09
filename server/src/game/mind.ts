// The three minds of a ship (docs/00 D3/D4):
//  - resolve (0..100): the charge an Ultimate needs, earned by trading blows (docs/02 §0.3);
//  - dread (0..100): The Drowned Captain's own resource, fed by her losses and the dark (docs/02 §7.5);
//  - sanity (0..100): what the deep does to a crew over hours (docs/01 §13.3). Every player ship has it.
// Also the Drowned Captain's zones (Deep Call hands, Undertow strips, the Maw's pull).

import { isNight } from '../../../shared/src/constants.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { whirlpoolAt } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import { madnessCheck } from './crew.ts';
import { applyDamage } from './combat.ts';
import { dotNumber } from './seaskill.ts';

export const RESOLVE_MAX = 100;
export const CALL_THRESHOLD = 80;

/** Background sanity loss per 10 minutes by region (docs/01 §3.13). */
export const SANITY_DRAIN: Record<RegionId, number> = {
  black_coast: 0, gravewater: 0, ashen_isles: 0.5, whispering: 1, leviathan_reach: 1.5, dead_mans_expanse: 2, drowned_crown: 4, the_abyss: 8,
};

export type SanityState = 'clear' | 'uneasy' | 'afraid' | 'terror' | 'madness';

export function sanityState(v: number): SanityState {
  return v > 75 ? 'clear' : v > 50 ? 'uneasy' : v > 25 ? 'afraid' : v > 10 ? 'terror' : 'madness';
}

// ------------------------------------------------------------------ resolve

export function gainResolve(ship: ShipEntity, n: number): void {
  if (n <= 0 || !ship.alive) return;
  ship.resolve = Math.min(RESOLVE_MAX, ship.resolve + n);
}

/** The ultimate charges from the damage she deals (docs/25 item 40): her share of the hull she struck, the part the
 *  alpha limit cut off it too, at this rate a point (her gear, which deals more, charges it sooner). Taking a blow
 *  charges it at one a point, as it always did. */
export const RESOLVE_DEALT = 1.5;

/** Hull damage: both sides steel themselves; the Drowned Captain's losses feed her Dread. `cut`: the hull the alpha
 *  limit took off the blow (item 40: it charges the dealer's ultimate all the same). */
export function onHullDamage(game: Game, target: ShipEntity, hull: number, source: ShipEntity | null, cut = 0): void {
  if (hull <= 0) return;
  const pct = (hull / target.stats.hullMax) * 100;
  gainResolve(target, pct);
  if (source && source !== target) gainResolve(source, ((hull + Math.max(0, cut)) / target.stats.hullMax) * 100 * RESOLVE_DEALT);
  if (target.captain === 'drowned') gainDread(game, target, pct / 2);
}

/** Enemy crew killed: +5 resolve per ten, and +5 Dread per ten for the Drowned. */
export function onCrewKilled(game: Game, victim: ShipEntity, killed: number, killer: ShipEntity | null): void {
  if (killed <= 0) return;
  if (killer && killer !== victim) {
    killer.killTally += killed;
    while (killer.killTally >= 10) {
      killer.killTally -= 10;
      gainResolve(killer, 5);
      if (killer.captain === 'drowned') gainDread(game, killer, 5);
    }
  }
  // Losing shipmates shakes the rest: −3 sanity for every 5% of the crew.
  if (victim.isPlayer) {
    loseSanity(victim, (killed / Math.max(1, victim.stats.crewMax)) * 60);
    victim.crewDeaths += killed;
  }
}

/** A subsystem crit (mast, rudder, guns, magazine). */
export function onCrit(source: ShipEntity | null): void {
  if (source) gainResolve(source, 8);
}

/** Grapples bite. */
export function onGrapple(a: ShipEntity): void {
  gainResolve(a, 15);
}

// ------------------------------------------------------------------ dread

export function gainDread(game: Game, ship: ShipEntity, n: number): void {
  if (ship.captain !== 'drowned' || n <= 0) return;
  // Below half sanity the deep pays better (docs/01 §13.3 side-grade).
  const mul = (ship.isPlayer && ship.sanity < 50 ? 1.25 : 1) * Math.max(0, 1 + tx(ship.stats, 'dreadGain'));
  const before = ship.dread;
  ship.dread = Math.min(100, ship.dread + n * mul);
  if (before < CALL_THRESHOLD && ship.dread >= CALL_THRESHOLD) {
    game.toastShip(ship, 'THE CALL. The drowned sing under the keel — your miracles are stronger, and the crew hears it too.', 'bad');
  }
}

/** Spend Dread on a miracle; every 10 spent costs the crew 1 morale. */
export function spendDread(ship: ShipEntity, n: number): void {
  ship.dread = Math.max(0, ship.dread - n);
  ship.dreadSpent += n;
  const mul = Math.max(0.2, 1 + tx(ship.stats, 'mysticMorale'));
  while (ship.dreadSpent >= 10) {
    ship.dreadSpent -= 10;
    ship.morale = Math.max(0, ship.morale - mul);
  }
}

/** The Call (Dread ≥ 80): +20% to the Drowned Captain's miracles. */
export function callPower(ship: ShipEntity): number {
  return ship.captain === 'drowned' && ship.dread >= CALL_THRESHOLD ? 1.2 : 1;
}

/** A miracle seen by the Crown in its own waters costs standing; the Choir approves. */
export function witnessMiracle(game: Game, ship: ShipEntity, ultimate: boolean): void {
  const safety = REGIONS[ship.region].safety;
  let crown = false, choir = false;
  game.forShipsNear(ship.state.x, ship.state.y, 1500, (o) => {
    if (o.id === ship.id || !o.alive) return;
    if (o.faction === 'crown') crown = true;
    if (o.faction === 'choir') choir = true;
  });
  for (const p of game.world.ports) {
    if (dist(p.x, p.y, ship.state.x, ship.state.y) > 2500) continue;
    if (p.faction === 'crown') crown = true;
    if (p.faction === 'choir') choir = true;
  }
  if (crown && safety !== 'lawless') {
    game.adjustRep(ship, 'crown', ultimate ? -50 : -15);
    game.toastShip(ship, 'Crown eyes saw that. The Admiralty will hear of the drowned woman\'s witchcraft.', 'bad');
  }
  if (choir) game.adjustRep(ship, 'choir', 5);
}

// ------------------------------------------------------------------ sanity

export function loseSanity(ship: ShipEntity, n: number): void {
  if (n <= 0) return;
  const mul = Math.max(0.1, 1 + tx(ship.stats, 'sanityLoss'));
  ship.sanity = Math.max(0, ship.sanity - n * mul);
}

export function gainSanity(ship: ShipEntity, n: number): void {
  // Still Waters eases it faster; the Heart of the Abyss holds on to it.
  const mul = (1 + 0.2 * tx(ship.stats, 'stillWaters')) * (ship.hasFlag('heart_of_abyss') ? 0.5 : 1);
  ship.sanity = Math.min(100, ship.sanity + n * mul);
}

/** Sanity lost per second at sea, before talents and wards. */
export function sanityDrain(game: Game, ship: ShipEntity): number {
  const now = game.now;
  let per10 = SANITY_DRAIN[ship.region];
  const night = isNight(now);
  const dark = ship.hasFlag('dark_running');
  // Lanterns comfort a crew at night; running dark frays them.
  if (night && !dark) per10 *= 0.7;
  if (night && dark) per10 += 1;
  // Cursed cargo whispers (a dead crew does not listen).
  if (ship.cls.passive.id !== 'dead_crew') per10 += Math.min(5, (ship.cargo.cursed_relics ?? 0) * 0.5) * Math.max(0, 1 - 0.5 * tx(ship.stats, 'cursedCargo'));
  const w = game.weatherOf(ship);
  if (w === 'calm' && REGIONS[ship.region].strangeness >= 0.2) per10 += 1;
  if (w === 'black_storm') per10 += 30; // −3 a minute
  if (whirlpoolAt(game.world.whirlpools, ship.state.x, ship.state.y).core) per10 += 20;
  return per10 / 600;
}

/** Once a second for a player ship: resolve decay, Dread tides, the crew's nerve. */
export function stepMind(game: Game, ship: ShipEntity): void {
  const now = game.now;
  // Resolve drains 2/s after 30 s out of combat.
  if (now - ship.lastCombat > 30) ship.resolve = Math.max(0, ship.resolve - 2);
  if (ship.captain === 'drowned') stepDread(game, ship);
  if (ship.lastStandUntil && ship.lastStandUntil <= now && ship.hasEffect('between_worlds')) endBetweenWorlds(game, ship);
  if (!ship.isPlayer) return;
  stepSanity(game, ship);
}

function stepDread(game: Game, ship: ShipEntity): void {
  const now = game.now;
  const w = game.weatherOf(ship);
  const dark = isNight(now) || w === 'fog' || ship.region === 'drowned_crown' || ship.region === 'the_abyss';
  if (dark && (ship.talentReady.dreadTide ?? 0) <= now) {
    ship.talentReady.dreadTide = now + 10;
    gainDread(game, ship, 2);
  }
  if (!ship.inCombat(now) && !ship.hasFlag('heart_of_abyss') && (ship.talentReady.dreadEbb ?? 0) <= now) {
    ship.talentReady.dreadEbb = now + 3;
    ship.dread = Math.max(0, ship.dread - 1);
  }
  if (ship.dread >= CALL_THRESHOLD) {
    if ((ship.talentReady.callMorale ?? 0) <= now) {
      ship.talentReady.callMorale = now + 10;
      ship.morale = Math.max(0, ship.morale - 1);
    }
    // Things in the deep hear it: ghosts within 1.5 km come for her.
    for (const [id, b] of game.npcs) {
      if (b.role !== 'ghost' || b.chase || b.target !== null) continue;
      const o = game.ships.get(id);
      if (o && dist(o.state.x, o.state.y, ship.state.x, ship.state.y) < 1500) b.chase = { id: ship.id, until: now + 60 };
    }
  }
}

function stepSanity(game: Game, ship: ShipEntity): void {
  const now = game.now;
  if (ship.docked) {
    // A tavern, a chapel, solid ground: +30 in ten minutes, whole again in half an hour.
    gainSanity(ship, 100 / 1800);
    return;
  }
  loseSanity(ship, sanityDrain(game, ship));
  // Rations for the nerves: a tot of rum or a pipe of dreamleaf, each at most every 20 minutes.
  if (ship.sanity < 75 && (ship.cargo.rum ?? 0) >= 1 && (ship.talentReady.rumTot ?? 0) <= now) {
    ship.talentReady.rumTot = now + 1200;
    ship.cargo.rum = (ship.cargo.rum ?? 0) - 1;
    if (ship.cargo.rum <= 0) delete ship.cargo.rum;
    gainSanity(ship, 10);
    // A drunkard officer makes a party of it.
    const drunk = game.sessionOf(ship)?.profile?.company.officers.some((o) => o.traits.includes('drunkard')) ?? false;
    ship.morale = Math.min(100, ship.morale + 5 + (drunk ? 10 : 0));
    game.toastShip(ship, 'A tot of rum all round steadies the hands. (+10 sanity)', 'info');
  }
  if (ship.sanity < 60 && (ship.cargo.dreamleaf ?? 0) >= 1 && (ship.talentReady.leafPipe ?? 0) <= now) {
    ship.talentReady.leafPipe = now + 1200;
    ship.cargo.dreamleaf = (ship.cargo.dreamleaf ?? 0) - 1;
    if (ship.cargo.dreamleaf <= 0) delete ship.cargo.dreamleaf;
    gainSanity(ship, 10);
    game.toastShip(ship, 'Dreamleaf smoke drifts below decks. The whispering fades a little. (+10 sanity)', 'info');
  }
  // Still Waters: the thresholds come 5 points later per rank.
  const state = sanityState(ship.sanity + 5 * tx(ship.stats, 'stillWaters'));
  // Salt Ward softens every penalty; Voice of the Choir halves terror and madness past 75 Dread.
  const dreadNow = ship.captain === 'drowned' ? ship.dread : 100 - ship.sanity;
  const soft = Math.max(0, 1 - 0.2 * tx(ship.stats, 'saltWard')) * (ship.hasFlag('voice_of_choir') && dreadNow >= 75 && (state === 'terror' || state === 'madness') ? 0.5 : 1);
  const dead = ship.hasFlag('crew_of_drowned'); // the dead do not fear
  if (state !== ship.sanityState) {
    const worse = ['clear', 'uneasy', 'afraid', 'terror', 'madness'].indexOf(state) > ['clear', 'uneasy', 'afraid', 'terror', 'madness'].indexOf(ship.sanityState);
    ship.sanityState = state;
    if (worse) {
      const msg: Record<SanityState, string> = {
        clear: '',
        uneasy: 'The crew is uneasy. Men whisper at the rail and will not say why.',
        afraid: 'The crew is afraid. Lookouts call sails that are not there; the compass wanders.',
        terror: 'Terror aboard. Men hide in the cable tier — some go over the side.',
        madness: 'Madness. The crew hears the call of the deep and may seize the helm.',
      };
      game.toastShip(ship, msg[state], 'bad');
    } else if (state === 'clear') game.toastShip(ship, 'The crew breathes easier. Clear heads again.', 'good');
  }
  // Morale bleeds by the state of their nerves (per 10 minutes: 1 / 2 / 4 / 4).
  const bleed = { clear: 0, uneasy: 1, afraid: 2, terror: 4, madness: 4 }[state];
  if (bleed && !dead) ship.morale = Math.max(0, ship.morale - (bleed * soft) / 600);
  // Fear: shaky hands on the guns, slow work below.
  if (state === 'afraid' || state === 'terror' || state === 'madness') {
    if (soft > 0) ship.addEffect({ id: 'fear', until: now + 1.6, mods: { spreadMul: 0.1 * soft, repairRate: -0.3 * soft } }, now);
  }
  if ((state === 'terror' || state === 'madness') && !dead) {
    if ((ship.talentReady.overboard ?? 0) === 0) ship.talentReady.overboard = now + 120;
    if (now >= ship.talentReady.overboard) {
      ship.talentReady.overboard = now + 120;
      if (ship.crew > 1 && game.rng.chance(soft)) {
        ship.crew--;
        game.toastShip(ship, game.rng.chance(0.5) ? 'A sailor throws himself over the side, screaming about bells.' : 'A sailor hides in the bilge and will not come out.', 'bad');
      }
    }
    // The wheel jerks in a frightened hand.
    if (game.rng.chance(0.05 * soft)) ship.state.rudder = game.rng.chance(0.5) ? 1 : -1;
  } else ship.talentReady.overboard = 0;
  if (state === 'madness' && !dead && (ship.talentReady.madness ?? 0) <= now) {
    ship.talentReady.madness = now + 60;
    if (game.rng.chance(0.3 * soft)) {
      // They steer for the source of the call: the nearest maelstrom, or the Abyss itself.
      let tx0 = REGIONS.the_abyss.center[0], ty0 = REGIONS.the_abyss.center[1], bd = 6000;
      for (const wp of game.world.whirlpools) {
        const d = dist(wp.x, wp.y, ship.state.x, ship.state.y);
        if (d < bd) {
          bd = d;
          tx0 = wp.x;
          ty0 = wp.y;
        }
      }
      ship.seizedHelm = { until: now + 12, x: tx0, y: ty0 };
      ship.morale = Math.max(0, ship.morale - 5);
      game.toastShip(ship, 'The crew has seized the helm and steers for the call!', 'bad');
    }
    // Madness tests their loyalty every minute.
    const sess = game.sessionOf(ship);
    if (sess?.profile) madnessCheck(game, sess);
  }
}

/** Drowned Once: after 12 s between water and light the ship lives only if the hull is back to 10%. */
function endBetweenWorlds(game: Game, ship: ShipEntity): void {
  ship.effects = ship.effects.filter((e) => e.id !== 'between_worlds');
  ship.recompute(game.now);
  if (ship.hull < ship.stats.hullMax * 0.1) {
    ship.hull = 0;
    game.toastShip(ship, 'The light goes out. The sea takes back what it lent.', 'bad');
    game.beginSinking(ship);
  } else game.toastShip(ship, 'You come back to the light. The drowned will wait.', 'good');
}

// ------------------------------------------------------------------ the Drowned Captain's zones

export interface DeepZone {
  kind: 'hands' | 'undertow' | 'maw_pull' | 'black_water' | 'siren';
  /** The Deep Call's leak (docs/25 item 34): a share of a caught ship's hull a second, for the hands' seconds after she
   *  is caught; the ships caught and until when. */
  leak?: number;
  caught?: Record<number, number>;
  /** The Undertow's facets: its half-width (m), the turn lost against it, the way she gains in it. */
  width?: number;
  rip?: number;
  ride?: number;
  target?: number; // the siren's listener
  x: number;
  y: number;
  r: number; // radius (hands, maw ring outer) or half-length (undertow)
  inner?: number; // maw ring inner radius
  dir?: number; // undertow heading
  start: number;
  until: number;
  owner: number;
  power: number;
  hit: number[]; // ships already holed by the hands
}

function inZone(z: DeepZone, x: number, y: number): boolean {
  if (z.kind === 'undertow') {
    const v = headingVec(z.dir ?? 0);
    const dx = x - z.x, dy = y - z.y;
    const along = dx * v.x + dy * v.y;
    const across = Math.abs(dx * -v.y + dy * v.x);
    return Math.abs(along) <= z.r && across <= (z.width ?? 30);
  }
  const d = dist(x, y, z.x, z.y);
  return d <= z.r && d >= (z.inner ?? 0);
}

/** Every tick: the zones grip the ships inside them. */
export function stepZones(game: Game, dt: number): void {
  const now = game.now;
  game.zones = game.zones.filter((z) => z.until > now);
  for (const z of game.zones) {
    if (z.start > now) continue;
    const owner = game.ships.get(z.owner);
    if (z.kind === 'siren') {
      // The song draws her toward the singer at a fifth of her speed.
      const t = z.target !== undefined ? game.ships.get(z.target) : undefined;
      if (t && t.alive && owner) {
        const d = dist(t.state.x, t.state.y, owner.state.x, owner.state.y) || 1;
        const step = Math.min(d - 20, Math.max(1, Math.abs(t.state.speed)) * 0.2 * z.power * dt);
        if (step > 0) {
          t.state.x += ((owner.state.x - t.state.x) / d) * step;
          t.state.y += ((owner.state.y - t.state.y) / d) * step;
        }
      }
      continue;
    }
    game.forShipsNear(z.x, z.y, z.r + 60, (o) => {
      if (!o.alive || o.docked || !inZone(z, o.state.x, o.state.y)) return;
      if (z.kind !== 'undertow' && (o.id === z.owner || (owner && game.areAllies(o, owner)))) return;
      if (z.kind === 'black_water') {
        o.addEffect({ id: 'black_water', until: now + 0.3, mods: { maxSpeed: -0.3 * z.power }, source: z.owner }, now);
        o.lastCombat = now;
      } else if (z.kind === 'hands') {
        o.addEffect({ id: 'drowned_hands', until: now + 0.3, mods: { maxSpeed: -0.4 * z.power, turnRate: -0.3 * z.power }, source: z.owner }, now);
        if (!z.hit.includes(o.id)) {
          z.hit.push(o.id);
          if (o.leaks < 8) o.leaks++;
          if (z.leak) (z.caught ??= {})[o.id] = now + (z.until - z.start);
          o.lastCombat = now;
          if (owner) o.attackers.set(owner.id, now);
        }
      } else if (z.kind === 'undertow') {
        const v = headingVec(z.dir ?? 0);
        const h = headingVec(o.state.heading);
        const cos = h.x * v.x + h.y * v.y;
        const m = cos > 0.3 ? 0.3 : cos < -0.3 ? -0.3 : 0;
        // Her facets (docs/25 item 38): a rip that takes the helm of those against it; her own way in it.
        const ride = o.id === z.owner && m > 0 && z.ride ? z.ride : 0;
        const rip = m < 0 && z.rip && o.id !== z.owner ? -z.rip : 0;
        if (m) o.addEffect({ id: 'undertow_strip', until: now + 0.3, mods: { maxSpeed: m * z.power + ride, ...(rip ? { turnRate: rip } : {}) }, source: z.owner }, now);
        // A ship with no way on is dragged along.
        if (Math.abs(o.state.speed) < 1) {
          o.state.x += v.x * 2 * z.power * dt;
          o.state.y += v.y * 2 * z.power * dt;
        }
      } else {
        // The Maw drags the ring toward its throat.
        const d = dist(o.state.x, o.state.y, z.x, z.y) || 1;
        const pull = Math.min(d - 1, 8 * dt);
        o.state.x += ((z.x - o.state.x) / d) * pull;
        o.state.y += ((z.y - o.state.y) / d) * pull;
      }
    });
    // The Deep Call's leak (docs/25 item 34): every ship the hands caught bleeds her share a second, for their seconds.
    if (z.kind === 'hands' && z.leak && z.caught) {
      for (const id in z.caught) {
        const o = game.ships.get(Number(id));
        if (!o || !o.alive || now > z.caught[id]) continue;
        const h0 = o.hull;
        applyDamage(game, o, { hull: z.leak * o.stats.hullMax * dt }, owner ?? null);
        if (h0 > o.hull) dotNumber(game, o, 'deep_call', h0 - o.hull);
      }
    }
  }
}
