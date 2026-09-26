// Boarding: grapple → melee rounds → surrender. Costly by design: cargo is destroyed in the fight,
// crews die, morale swings and the attacker's hull takes grappling damage. See docs/02 §6.

import type { GoodId } from '../../../shared/src/data/goods.ts';
import { clamp, dist } from '../../../shared/src/math.ts';
import type { Aggression, BoardingResult } from '../../../shared/src/protocol.ts';
import { cargoValue, cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { AmmoStock, Cargo } from '../../../shared/src/sim/shipstats.ts';
import { damageBlocked } from './combat.ts';
import { AMMO_IDS, emptyAmmo } from '../../../shared/src/data/ships.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { onCrewKilled, onGrapple } from './mind.ts';
import { moraleLossMul } from './crew.ts';
import { bloodAndSalt, drownedBoardersRise, drownedTakeLosses } from './bridgefx.ts';

const AGG = {
  careful: { tempo: 0.75, cargo: 0.55, ownLoss: 0.9 },
  standard: { tempo: 1, cargo: 1, ownLoss: 1 },
  brutal: { tempo: 1.45, cargo: 1.6, ownLoss: 1.15 },
} as const;

export function boardingRangeBetween(a: ShipEntity, b: ShipEntity): number {
  // Bow and Stern: the reach runs the length of both hulls, not just the beams.
  const span = a.hasFlag('bow_and_stern') ? Math.max((a.stats.beam + b.stats.beam) / 2, (a.stats.length + b.stats.length) * 0.45) : (a.stats.beam + b.stats.beam) / 2;
  return a.stats.boardingRange + span;
}

export function canBoard(game: Game, a: ShipEntity, b: ShipEntity): string | null {
  if (!a.alive || !b.alive) return 'Nothing left to board';
  if (a.boarding || b.boarding) return 'Already locked in a boarding action';
  if (a.docked || b.docked) return 'Not at sea';
  if (a.surrendered) return 'You struck your colours';
  if (b.lootLockedFor !== null) return b.lootLockedFor === a.id ? 'She is already yours' : 'She has struck to another captain';
  if (b.prize) return 'She sails under a prize crew';
  const blocked = damageBlocked(game, a, b);
  if (blocked && blocked !== 'friendly') return blocked;
  if (blocked === 'friendly') return 'That ship sails with you';
  const anywhere = a.hasFlag('boarding_anywhere');
  const d = dist(a.state.x, a.state.y, b.state.x, b.state.y);
  // Chain and Grapple: tangled rigging is half-way to a grapple already.
  const tangled = a.hasFlag('chain_and_grapple') && b.hasEffect('tangled');
  if (d > boardingRangeBetween(a, b) * (tangled ? 1.5 : 1)) return 'Too far to throw grapples';
  // Kraken's Embrace: the deep holds her still for the grapples.
  const held = b.effects.some((e) => e.id === 'kraken_hold' && e.source === a.id) || tangled;
  if (!anywhere && !held) {
    const relSpeed = Math.abs(a.state.speed - b.state.speed);
    const rammed = a.ramTarget === b.id && a.ramUntil > game.now; // Hull to Hull
    if (relSpeed > 5.5 * (1 + tx(a.stats, 'matchSpeed')) && !b.surrendered && a.tether?.target !== b.id && !rammed) return 'Match her speed before boarding';
    const weakened =
      b.surrendered ||
      b.hull <= b.stats.hullMax * 0.6 ||
      b.crew <= b.stats.crewMax * 0.5 ||
      b.sails <= b.stats.sailHpMax * 0.35 ||
      b.state.speed < 2;
    if (!weakened) return 'She is too strong to board — cripple her hull, sails or crew first';
  }
  if (a.crew < Math.max(4, a.stats.crewMin * 0.5)) return 'Not enough hands for a boarding party';
  return null;
}

export function startBoarding(game: Game, a: ShipEntity, b: ShipEntity, aggression: Aggression): void {
  const now = game.now;
  a.boarding = { with: b.id, attacker: true, aggression, startedAt: now, nextRound: now + 1.2, rounds: 0, startCrew: a.crew, enemyStartCrew: b.crew, killed: 0, lost: 0 };
  b.boarding = { with: a.id, attacker: false, aggression, startedAt: now, nextRound: now + 1.2, rounds: 0, startCrew: b.crew, enemyStartCrew: a.crew, killed: 0, lost: 0 };
  a.repairing = false;
  b.repairing = false;
  a.lastCombat = now;
  b.lastCombat = now;
  // Grappling impact.
  a.hull -= a.stats.hullMax * 0.03;
  b.hull -= b.stats.hullMax * 0.02;
  openingMoves(game, a, b);
  onGrapple(a);
  drownedBoardersRise(game, a);
  drownedBoardersRise(game, b);
  game.emit({ k: 'board_start', a: a.id, b: b.id }, a.state.x, a.state.y);
  game.registerBoardingCrime(a, b);
}

/** Pistol Volley and Boarding Axes fire the moment the grapples (or the boat) bite. */
function openingMoves(game: Game, a: ShipEntity, b: ShipEntity): void {
  if (a.hasFlag('pistol_volley')) {
    const n = Math.min(b.crew - 1, Math.max(2, Math.round(b.crew * 0.06)));
    if (n > 0) {
      b.crew -= n;
      b.morale = Math.max(0, b.morale - n * 0.8);
      if (a.boarding) a.boarding.killed += n;
    }
  }
  const axes = tx(a.stats, 'boardingAxes');
  if (axes > 0) b.sails = Math.max(0, b.sails - b.stats.sailHpMax * axes);
}

/** Jolly Boat Raid: a boat party boards while the mother ship keeps sailing and firing. */
export function startBoatBoarding(game: Game, a: ShipEntity, b: ShipEntity, party: number): void {
  const now = game.now;
  a.boarding = { with: b.id, attacker: true, aggression: 'standard', startedAt: now, nextRound: now + 1.2, rounds: 0, startCrew: party, enemyStartCrew: b.crew, killed: 0, lost: 0, remote: true, party };
  b.boarding = { with: a.id, attacker: false, aggression: 'standard', startedAt: now, nextRound: now + 1.2, rounds: 0, startCrew: b.crew, enemyStartCrew: party, killed: 0, lost: 0 };
  b.repairing = false;
  a.lastCombat = now;
  b.lastCombat = now;
  openingMoves(game, a, b);
  game.emit({ k: 'board_start', a: a.id, b: b.id }, b.state.x, b.state.y);
  game.registerBoardingCrime(a, b);
}

/** The defender (or the attacker, unless No Quarter) tries to cut the grapples. */
export function cutGrapples(game: Game, ship: ShipEntity): string | null {
  const bs = ship.boarding;
  if (!bs) return 'You are not grappled';
  const other = game.ships.get(bs.with);
  if (!other) return 'Nothing to cut';
  const now = game.now;
  const a = bs.attacker ? ship : other, b = bs.attacker ? other : ship;
  if (bs.attacker) {
    if (ship.hasFlag('no_quarter')) return 'No Quarter: there is no retreat';
    endBoarding(game, a, b);
    a.morale = Math.max(0, a.morale - 10);
    game.toastShip(a, 'Your boarders fall back and cut the grapples.', 'bad');
    return null;
  }
  // Iron Grip: the attacker's grapnels cannot be cut at first.
  const grip = Math.max(tx(a.stats, 'ironGrip'), a.hasFlag('chain_and_grapple') && b.hasEffect('tangled') ? 5 : 0);
  if (now - a.boarding!.startedAt < grip) return 'The grapnels are chained — they will not part yet';
  const pa = power(game, a, b, false), pb = power(game, b, a, true);
  const chance = clamp(0.35 + (pb / pa - 1) * 0.3, 0.1, 0.8);
  if (!game.rng.chance(chance)) {
    b.morale = Math.max(0, b.morale - 5);
    return 'The boarders beat your axemen back from the lines';
  }
  endBoarding(game, a, b);
  game.toastShip(b, 'Grapples cut! She drifts free.', 'good');
  game.toastShip(a, 'They cut our grapples!', 'bad');
  return null;
}

function endBoarding(game: Game, a: ShipEntity, b: ShipEntity): void {
  const bs = a.boarding;
  if (bs?.remote && bs.party) a.crew += bs.party; // the boat pulls back
  a.boarding = null;
  b.boarding = null;
  a.state.speed = 0;
  game.emit({ k: 'board_end', a: a.id, b: b.id, winner: 0 }, a.state.x, a.state.y);
}

function power(game: Game, s: ShipEntity, enemy: ShipEntity, defending: boolean): number {
  const bs = s.boarding;
  const now = game.now;
  const men = bs?.remote ? bs.party ?? 0 : s.crew;
  // Marines count one and a half.
  const fighters = men * (1 + 0.5 * Math.min(1, tx(s.stats, 'marines')));
  let p = fighters * (0.45 + s.morale / 180) * s.stats.boardingPower * (1 + tx(s.stats, 'meleeDamage'));
  if (bs) {
    const t = now - bs.startedAt;
    if (!defending && s.hasFlag('first_over_rail') && t < 8) p *= 1.25;
    p *= 1 + Math.min(0.2, bs.killed * tx(s.stats, 'blooded'));
    // Boarding Nets on the other side blunt the first rush.
    if (!defending && t < 10) p *= Math.max(0.2, 1 - tx(enemy.stats, 'boardingNets'));
  }
  if ((s.cargo.weapons ?? 0) >= 5) p *= 1.08;
  if (s.captain === 'reaver' && enemy.crew < enemy.stats.crewMax * 0.5) p *= 1.2; // Blood in the Water
  if (defending && s.cls.passive.id === 'castle') p *= 1.25;
  if (s.surrendered) p *= 0.1;
  void game;
  return Math.max(0.1, p);
}

/** Advance all boarding actions; returns finished pairs. */
export function stepBoarding(game: Game): void {
  const now = game.now;
  for (const a of game.ships.values()) {
    const bs = a.boarding;
    if (!bs || !bs.attacker) continue;
    const b = game.ships.get(bs.with);
    if (!b || !b.alive || !a.alive) {
      a.boarding = null;
      if (b) b.boarding = null;
      continue;
    }
    // Lock the ships together (a jolly-boat raid leaves the mother ship free).
    if (!bs.remote) a.state.speed *= 0.8;
    b.state.speed *= 0.8;
    const d = dist(a.state.x, a.state.y, b.state.x, b.state.y);
    const want = (a.stats.beam + b.stats.beam) / 2 + 4;
    if (d > want && !bs.remote) {
      const k = Math.min(1, 0.08);
      const mx = (b.state.x - a.state.x) * k, my = (b.state.y - a.state.y) * k;
      a.state.x += mx * 0.5;
      a.state.y += my * 0.5;
      b.state.x -= mx * 0.5;
      b.state.y -= my * 0.5;
    }
    if (now < bs.nextRound) continue;
    const agg = AGG[bs.aggression];
    bs.rounds++;
    bs.nextRound = now + 1 / agg.tempo;
    const pa = power(game, a, b, false), pb = power(game, b, a, true);
    const rng = game.rng;
    const killB = Math.min(b.crew, Math.round(pa * 0.075 * agg.tempo * (0.7 + rng.float() * 0.6)));
    const aMen = bs.remote ? bs.party ?? 0 : a.crew;
    const killA = Math.min(aMen, Math.round(pb * 0.07 * agg.ownLoss * (0.7 + rng.float() * 0.6)));
    // Some always survive to strike the colours or cut the grapples.
    const floorA = Math.max(2, Math.round(bs.startCrew * 0.1));
    const floorB = Math.max(2, Math.round(bs.enemyStartCrew * 0.1));
    const killB2 = Math.max(0, Math.min(killB, b.crew - floorB));
    const killA2 = Math.max(0, Math.min(killA, aMen - (bs.remote ? 0 : floorA)));
    // Drowned Boarders: for the first six seconds the dead take the losses.
    const livingA = drownedTakeLosses(game, a, killA2);
    const livingB = drownedTakeLosses(game, b, killB2);
    b.crew -= killB2;
    if (bs.remote) bs.party = (bs.party ?? 0) - killA2;
    else a.crew -= killA2;
    bs.killed += killB2;
    bs.lost += killA2;
    onCrewKilled(game, b, livingB, a);
    onCrewKilled(game, a, livingA, b);
    // Blood and Salt: every foe that falls mends the victor's hull.
    bloodAndSalt(a, killB2);
    bloodAndSalt(b, killA2);
    b.morale -= ((killB / Math.max(1, bs.enemyStartCrew)) * 90 + 2) * moraleLossMul(b);
    a.morale -= (killA / Math.max(1, bs.startCrew)) * 70 * moraleLossMul(a);
    if (a.hasFlag('terror') && b.crew < b.stats.crewMax * 0.3) b.morale -= 6;
    if (a.hasFlag('no_quarter')) b.morale -= killB2; // every man that falls unnerves the rest
    // First Over the Rail: a quarter of her crew down in the first rush breaks her nerve.
    if (a.hasFlag('first_over_rail') && !bs.railChecked && now - bs.startedAt >= 8) {
      bs.railChecked = true;
      if (bs.killed >= bs.enemyStartCrew * 0.25) b.morale -= 15;
    }
    // Hold the Line: the defenders' nerve holds for the first 20 s.
    const hold = tx(b.stats, 'holdTheLine');
    if (hold > 0 && now - bs.startedAt < 20) b.morale = Math.max(b.morale, hold >= 2 ? 35 : 20);
    // NPC defenders try to cut loose while they still have fight in them.
    if (!b.isPlayer && !b.surrendered && b.morale > 30 && now - bs.startedAt >= tx(a.stats, 'ironGrip') && pb >= pa * 0.7 && rng.chance(0.08)) {
      if (cutGrapples(game, b) === null) continue;
    }
    if (a.captain === 'reaver') a.morale += killB * 0.5;
    a.morale = clamp(a.morale, 0, 100);
    b.morale = clamp(b.morale, 0, 100);
    const bBroken = b.crew <= Math.max(floorB, bs.enemyStartCrew * 0.15) || b.morale <= 5 || b.surrendered;
    const aBroken = bs.remote ? (bs.party ?? 0) <= Math.max(1, bs.startCrew * 0.25) : a.crew <= Math.max(floorA, bs.startCrew * 0.15) || a.morale <= 5;
    if (bBroken || aBroken || bs.rounds >= 25) {
      const attackerWins = bBroken && !aBroken ? true : aBroken && !bBroken ? false : pa >= pb;
      finishBoarding(game, a, b, attackerWins);
    }
  }
}

function finishBoarding(game: Game, a: ShipEntity, b: ShipEntity, attackerWins: boolean): void {
  const bs = a.boarding!;
  a.boarding = null;
  b.boarding = null;
  if (bs.remote) a.crew += Math.max(0, bs.party ?? 0); // survivors row back (or stay as the prize crew)
  game.emit({ k: 'board_end', a: a.id, b: b.id, winner: attackerWins ? a.id : b.id }, a.state.x, a.state.y);
  if (!attackerWins) {
    a.morale = Math.max(0, a.morale - 15);
    b.morale = Math.min(100, b.morale + 15);
    game.toastShip(a, 'Boarders repelled! Cut the grapples!', 'bad');
    game.toastShip(b, 'Boarders repelled!', 'good');
    // Push apart.
    a.state.speed = 0;
    return;
  }
  const agg = AGG[bs.aggression];
  // Cargo destroyed during the fight (10–25% typical at "standard"). Careful Hands can take it to nothing.
  const lossFrac = clamp(a.stats.boardingCargoLoss * agg.cargo * (b.surrendered ? 0.5 : 1) + bs.rounds * 0.004, 0, 0.45);
  claimPrize(game, a, b, lossFrac, bs.lost, bs.killed, bs.aggression);
}

/** A ship that struck (boarded, or surrendered on terms) hands her hold to the victor. */
export function claimPrize(game: Game, a: ShipEntity, b: ShipEntity, lossFrac: number, lost: number, killed: number, aggression: Aggression = 'standard'): void {
  const agg = AGG[aggression];
  const destroyed: Cargo = {};
  const cargo: Cargo = {};
  for (const id in b.cargo) {
    const g = id as GoodId;
    const n = b.cargo[g] ?? 0;
    let gone = 0;
    for (let i = 0; i < n; i++) if (game.rng.float() < lossFrac) gone++;
    if (gone) destroyed[g] = gone;
    if (n - gone > 0) cargo[g] = n - gone;
  }
  b.cargo = cargo;
  const ammo: AmmoStock = emptyAmmo();
  for (const k of AMMO_IDS) ammo[k] = Math.floor(b.ammo[k] * 0.4);
  // Victory effects.
  a.morale = Math.min(100, a.morale + 10 + a.stats.moraleOnBoard);
  if (a.hasFlag('blood_tide') && !(a.hasFlag('iron_coffin') && a.inCombat(game.now))) a.hull = Math.min(a.stats.hullMax, a.hull + a.stats.hullMax * 0.15);
  if (lost + killed > 0) a.hull -= a.stats.hullMax * 0.02 * agg.cargo; // the fight wrecks some of your own ship
  // Warlord: Glory for every ship taken.
  if (a.hasFlag('warlord')) {
    a.gloryStacks = a.hasEffect('glory') ? Math.min(3, a.gloryStacks + 1) : 1;
    a.addEffect({ id: 'glory', until: game.now + 600, mods: { meleeDamage: 0.04 * a.rank('brd_warlord') * a.gloryStacks } }, game.now);
    a.morale = Math.min(100, a.morale + 3 * a.gloryStacks);
  }
  // No Quarter: no prizes, no prisoners — she goes down within the minute.
  if (a.hasFlag('no_quarter')) b.sinkAt = game.now + 60;
  b.surrendered = true;
  b.state.speed = 0;
  b.input = { rudder: 0, sailTarget: 0 };
  b.lootLockedFor = a.id;
  const purse = b.isPlayer ? Math.floor((game.profileOf(b)?.gold ?? 0) * 0.08) : b.purse;
  const result: BoardingResult = {
    targetName: b.name,
    targetClass: b.loadout.classId,
    cargo,
    destroyed,
    gold: purse,
    ammo,
    crewLost: lost,
    enemyCrewLost: killed,
    ransom: b.isPlayer ? 0 : Math.round(150 + cargoValue(cargo) * 0.08 + b.cls.tier * 120),
    holdFree: Math.max(0, a.stats.holdVolume - cargoVolume(a.cargo, a.stats.contrabandVolumeMul, a.stats.materialVolumeMul, a.stats.provisionVolumeMul, a.stats.cursedVolumeMul)),
    npc: !b.isPlayer,
    prize: null,
    captive: false,
    recruits: 0,
    noQuarter: a.hasFlag('no_quarter'),
  };
  game.onBoardingWon(a, b, result);
}
