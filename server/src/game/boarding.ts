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

const AGG = {
  careful: { tempo: 0.75, cargo: 0.55, ownLoss: 0.9 },
  standard: { tempo: 1, cargo: 1, ownLoss: 1 },
  brutal: { tempo: 1.45, cargo: 1.6, ownLoss: 1.15 },
} as const;

export function boardingRangeBetween(a: ShipEntity, b: ShipEntity): number {
  return a.stats.boardingRange + (a.stats.beam + b.stats.beam) / 2;
}

export function canBoard(game: Game, a: ShipEntity, b: ShipEntity): string | null {
  if (!a.alive || !b.alive) return 'Nothing left to board';
  if (a.boarding || b.boarding) return 'Already locked in a boarding action';
  if (a.docked || b.docked) return 'Not at sea';
  if (a.surrendered) return 'You struck your colours';
  const blocked = damageBlocked(game, a, b);
  if (blocked && blocked !== 'friendly') return blocked;
  if (blocked === 'friendly') return 'That ship sails with you';
  const anywhere = a.hasFlag('boarding_anywhere');
  const d = dist(a.state.x, a.state.y, b.state.x, b.state.y);
  if (d > boardingRangeBetween(a, b) * (anywhere ? 1 : 1)) return 'Too far to throw grapples';
  if (!anywhere) {
    const relSpeed = Math.abs(a.state.speed - b.state.speed);
    if (relSpeed > 5.5 && !b.surrendered) return 'Match her speed before boarding';
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
  game.emit({ k: 'board_start', a: a.id, b: b.id }, a.state.x, a.state.y);
  game.registerBoardingCrime(a, b);
}

function power(game: Game, s: ShipEntity, enemy: ShipEntity, defending: boolean): number {
  let p = s.crew * (0.45 + s.morale / 180) * s.stats.boardingPower;
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
    // Lock the ships together.
    a.state.speed *= 0.8;
    b.state.speed *= 0.8;
    const d = dist(a.state.x, a.state.y, b.state.x, b.state.y);
    const want = (a.stats.beam + b.stats.beam) / 2 + 4;
    if (d > want) {
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
    const killA = Math.min(a.crew, Math.round(pb * 0.07 * agg.ownLoss * (0.7 + rng.float() * 0.6)));
    // Some always survive to strike the colours or cut the grapples.
    const floorA = Math.max(2, Math.round(bs.startCrew * 0.1));
    const floorB = Math.max(2, Math.round(bs.enemyStartCrew * 0.1));
    const killB2 = Math.max(0, Math.min(killB, b.crew - floorB));
    const killA2 = Math.max(0, Math.min(killA, a.crew - floorA));
    b.crew -= killB2;
    a.crew -= killA2;
    bs.killed += killB2;
    bs.lost += killA2;
    b.morale -= (killB / Math.max(1, bs.enemyStartCrew)) * 90 + 2;
    a.morale -= (killA / Math.max(1, bs.startCrew)) * 70;
    if (a.hasFlag('terror') && b.crew < b.stats.crewMax * 0.3) b.morale -= 6;
    if (a.captain === 'reaver') a.morale += killB * 0.5;
    a.morale = clamp(a.morale, 0, 100);
    b.morale = clamp(b.morale, 0, 100);
    const bBroken = b.crew <= Math.max(floorB, bs.enemyStartCrew * 0.15) || b.morale <= 5 || b.surrendered;
    const aBroken = a.crew <= Math.max(floorA, bs.startCrew * 0.15) || a.morale <= 5;
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
  // Cargo destroyed during the fight (10–25% typical at "standard").
  const lossFrac = clamp(a.stats.boardingCargoLoss * agg.cargo * (b.surrendered ? 0.5 : 1) + bs.rounds * 0.004, 0.02, 0.45);
  const destroyed: Cargo = {};
  const cargo: Cargo = {};
  for (const id in b.cargo) {
    const g = id as GoodId;
    const n = b.cargo[g] ?? 0;
    let lost = 0;
    for (let i = 0; i < n; i++) if (game.rng.float() < lossFrac) lost++;
    if (lost) destroyed[g] = lost;
    if (n - lost > 0) cargo[g] = n - lost;
  }
  b.cargo = cargo;
  const ammo: AmmoStock = emptyAmmo();
  for (const k of AMMO_IDS) ammo[k] = Math.floor(b.ammo[k] * 0.4);
  // Victory effects.
  a.morale = Math.min(100, a.morale + 10 + a.stats.moraleOnBoard);
  if (a.hasFlag('blood_tide')) a.hull = Math.min(a.stats.hullMax, a.hull + a.stats.hullMax * 0.15);
  a.hull -= a.stats.hullMax * 0.02 * agg.cargo; // more brutal fights wreck more of your own ship
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
    crewLost: bs.lost,
    enemyCrewLost: bs.killed,
    ransom: b.isPlayer ? 0 : Math.round(150 + cargoValue(cargo) * 0.08 + b.cls.tier * 120),
    holdFree: Math.max(0, a.stats.holdVolume - cargoVolume(a.cargo, a.stats.contrabandVolumeMul)),
    npc: !b.isPlayer,
  };
  game.onBoardingWon(a, b, result);
}
