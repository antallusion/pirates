// Boarding: grapple → a deck fight played round by round → surrender. Costly by design: cargo is destroyed in
// the fight, crews die, morale swings and the attacker's hull takes grappling damage. See docs/02 §6.
// Boarding 2.0 (docs/11 P1): each round both captains pick a tactic at once (the circle of four, the special
// orders and the captain's own move bought with momentum); a captain who waits holds the line. Either captain
// may call the other out: a duel of three timed exchanges decides the fight.

import { ladderBetween } from './ladder.ts';
import { inDuel } from './pvp.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { clamp, dist } from '../../../shared/src/math.ts';
import type { Aggression, BoardFightView, BoardingResult, BoardSideView } from '../../../shared/src/protocol.ts';
import { cargoValue, cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { AmmoStock, Cargo } from '../../../shared/src/sim/shipstats.ts';
import { damageBlocked } from './combat.ts';
import { AMMO_IDS, emptyAmmo } from '../../../shared/src/data/ships.ts';
import { BASIC_TACTICS, CAPTAIN_MOVES, DUEL_EXCHANGES, DUEL_GAP, DUEL_SWEEP, FIRST_ROUND, MAX_ROUNDS, ROUND_WINDOW, TACTICS, counterTo, edgeOf } from '../../../shared/src/data/boarding.ts';
import type { BasicTactic, BoardTactic } from '../../../shared/src/data/boarding.ts';
import type { Game } from './Game.ts';
import type { BoardFight, BoardingState, ShipEntity } from './ship.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { onCrewKilled, onGrapple } from './mind.ts';
import { moraleLossMul } from './crew.ts';
import { bloodAndSalt, drownedBoardersRise, drownedTakeLosses } from './bridgefx.ts';
import { closeTac, startTactical, stepTactical, wantsTactical } from './tactical.ts';

const AGG = {
  careful: { tempo: 0.75, cargo: 0.55, ownLoss: 0.9 },
  standard: { tempo: 1, cargo: 1, ownLoss: 1 },
  brutal: { tempo: 1.45, cargo: 1.6, ownLoss: 1.15 },
} as const;

/** Share of a side's fighting power that falls on the other side in a round (before tactics). */
const ROUND_KILL = 0.17;
/** Momentum a side wins for a round it takes, draws or loses. */
const MOMENTUM = { win: 35, even: 15, lose: 5 } as const;
/** Captain's moves that take the round whatever the other side chose. */
const TAKES_ROUND = new Set(['point_blank', 'smoke_and_knives', 'turn_the_flank']);
/** The speed between the hulls the grapples still hold at (knots). */
export const BOARD_REL_SPEED = 8;

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
  if (inDuel(game, a) || inDuel(game, b)) return 'No boarding in a duel';
  if (a.ghost || b.ghost) return 'She is across the line of these waters — close in first';
  if (a.npcRole === 'beast' || b.npcRole === 'beast') return 'There are no decks to board on a creature of the deep';
  if (b.lootLockedFor !== null) return b.lootLockedFor === a.id ? 'She is already yours' : 'She has struck to another captain';
  if (b.prize) return 'She sails under a prize crew';
  const blocked = damageBlocked(game, a, b);
  if (blocked && blocked !== 'friendly') return blocked;
  if (blocked === 'friendly') return 'That ship sails with you';
  // The ladder (canon D12): a lone junior among captains cannot board a senior; nor can one far below at sea.
  if (!ladderBetween(game, a, b).board) return 'She is above your level: your boarders would not reach her deck';
  const anywhere = a.hasFlag('boarding_anywhere');
  const d = dist(a.state.x, a.state.y, b.state.x, b.state.y);
  // Chain and Grapple: tangled rigging is half-way to a grapple already.
  const tangled = a.hasFlag('chain_and_grapple') && b.hasEffect('tangled');
  if (d > boardingRangeBetween(a, b) * (tangled ? 1.5 : 1)) return 'Too far to throw grapples';
  // Kraken's Embrace: the deep holds her still for the grapples.
  const held = b.effects.some((e) => e.id === 'kraken_hold' && e.source === a.id) || tangled;
  // Boarding at once (docs/17 H1): any ship within the grapples' reach, whole or wrecked — the guns only thin her
  // stacks before the battle. Only a ship tearing past faster than the lines can hold slips them.
  if (!anywhere && !held) {
    const relSpeed = Math.abs(a.state.speed - b.state.speed);
    const rammed = a.ramTarget === b.id && a.ramUntil > game.now; // Hull to Hull
    if (relSpeed > BOARD_REL_SPEED * (1 + tx(a.stats, 'matchSpeed')) && !b.surrendered && a.tether?.target !== b.id && !rammed) return 'Match her speed before boarding';
  }
  if (a.crew < Math.max(4, a.stats.crewMin * 0.5)) return 'Not enough hands for a boarding party';
  // A crew with no nerve left breaks in the first rush: say so instead of throwing them over the rail.
  if (a.morale < 15 && !a.surrendered) return 'Your crew has no stomach for boarding — raise their morale first';
  return null;
}

function newFight(now: number): BoardFight {
  return { round: 0, opened: now, deadline: now + FIRST_ROUND, log: [], last: null, fires: 0, duel: null, duelDone: false, endsAt: null, winner: null };
}

function sideState(fight: BoardFight, s: Omit<BoardingState, 'fight' | 'pick' | 'lastPick' | 'momentum' | 'won' | 'lostRounds' | 'moves'>): BoardingState {
  return { ...s, fight, pick: null, lastPick: null, momentum: 0, won: 0, lostRounds: 0, moves: 0 };
}

export function startBoarding(game: Game, a: ShipEntity, b: ShipEntity, aggression: Aggression): void {
  const now = game.now;
  const fight = newFight(now);
  a.boarding = sideState(fight, { with: b.id, attacker: true, aggression, startedAt: now, nextRound: fight.deadline, rounds: 0, startCrew: a.crew, enemyStartCrew: b.crew, killed: 0, lost: 0 });
  b.boarding = sideState(fight, { with: a.id, attacker: false, aggression, startedAt: now, nextRound: fight.deadline, rounds: 0, startCrew: b.crew, enemyStartCrew: a.crew, killed: 0, lost: 0 });
  a.repairing = false;
  b.repairing = false;
  if (b.named && a.isPlayer) b.scar = 'boarding';
  if (a.named && b.isPlayer) a.scar = 'boarding';
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
  // Turn by turn on the hexes (docs/16 P4) when a captain is aboard; the round-by-round fight otherwise.
  if (wantsTactical(game, a, b)) startTactical(game, a, b);
  else openRound(game, a, b);
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
  const fight = newFight(now);
  a.boarding = sideState(fight, { with: b.id, attacker: true, aggression: 'standard', startedAt: now, nextRound: fight.deadline, rounds: 0, startCrew: party, enemyStartCrew: b.crew, killed: 0, lost: 0, remote: true, party });
  b.boarding = sideState(fight, { with: a.id, attacker: false, aggression: 'standard', startedAt: now, nextRound: fight.deadline, rounds: 0, startCrew: b.crew, enemyStartCrew: party, killed: 0, lost: 0 });
  b.repairing = false;
  a.lastCombat = now;
  b.lastCombat = now;
  openingMoves(game, a, b);
  game.emit({ k: 'board_start', a: a.id, b: b.id }, b.state.x, b.state.y);
  game.registerBoardingCrime(a, b);
  openRound(game, a, b);
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
  // In the turn-based battle the axemen try once a round.
  const tac = bs.fight.tac;
  if (tac) {
    if (tac.heroes[1].cutTried >= tac.round) return 'Your axemen try again next round';
    tac.heroes[1].cutTried = tac.round;
  }
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
  closeFight(game, a);
  closeFight(game, b);
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
  // The ladder (canon D12): the gap of levels weighs on the boarders as on the guns.
  p *= ladderBetween(game, s, enemy).dealt || 0.1;
  return Math.max(0.1, p);
}

/** Advance all boarding actions: the rounds, the duels, the ends. */
export function stepBoarding(game: Game): void {
  const now = game.now;
  for (const a of game.ships.values()) {
    const bs = a.boarding;
    if (!bs || !bs.attacker) continue;
    const b = game.ships.get(bs.with);
    if (!b || !b.alive || !a.alive || !b.boarding) {
      a.boarding = null;
      closeFight(game, a);
      if (b) {
        b.boarding = null;
        closeFight(game, b);
      }
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
    const fight = bs.fight;
    // Decided (the duel's last blow): held a moment so both captains see how.
    if (fight.endsAt !== null) {
      if (now >= fight.endsAt) {
        // Bought off (docs/17 H1): the boarders go back over the rail with the silver, and no prize is taken.
        if (fight.tac?.over?.why === 'ransom') {
          endBoarding(game, a, b);
          game.toastShip(a, 'The ransom is paid: your boarders come back with the silver.', 'good');
        } else finishBoarding(game, a, b, fight.winner === a.id);
      }
      continue;
    }
    if (fight.tac) {
      stepTactical(game, a, b);
      continue;
    }
    if (fight.duel && fight.duel.state !== 'done') {
      stepDuel(game, a, b);
      continue;
    }
    // A round resolves at its deadline, or as soon as every captain aboard has given the order.
    const sb = b.boarding;
    const chosen = (!a.isPlayer || bs.pick !== null) && (!b.isPlayer || sb.pick !== null);
    if (now < fight.deadline && !(chosen && now >= fight.opened + 1)) continue;
    const over = resolveRound(game, a, b);
    if (over === 'cut') continue;
    if (over !== null) finishBoarding(game, a, b, over);
    else if (a.boarding && !a.boarding.fight.duel) openRound(game, a, b);
  }
}

/** A new round: NPC captains decide at once, players have the window to. */
function openRound(game: Game, a: ShipEntity, b: ShipEntity): void {
  const fight = a.boarding!.fight;
  fight.opened = game.now;
  fight.deadline = game.now + (fight.round === 0 ? FIRST_ROUND : ROUND_WINDOW);
  for (const [s, e] of [[a, b], [b, a]] as const) {
    const st = s.boarding!;
    st.nextRound = fight.deadline;
    st.pick = s.isPlayer ? null : aiPick(game, s, e);
  }
  sendFight(game, a, b);
}

/** An NPC captain's order: the captain's move when it is ready, the special orders when they would bite, a
 *  counter to what the other side did last (cunning by trade), a closed line when the crew is thin. */
export function aiPick(game: Game, ship: ShipEntity, enemy: ShipEntity): BoardTactic {
  const rng = game.rng;
  const st = ship.boarding!, foe = enemy.boarding!;
  if (st.momentum >= TACTICS.captain.cost && rng.chance(0.8)) return 'captain';
  if (st.momentum >= TACTICS.colours.cost && enemy.morale < 55 && rng.chance(0.5)) return 'colours';
  if (st.momentum >= TACTICS.officers.cost && foe.momentum >= 60 && rng.chance(0.5)) return 'officers';
  const role = ship.npcRole;
  const cunning = role === 'pirate' || role === 'hunter' || role === 'boss' || role === 'escort' ? 0.5 : role === 'patrol' || role === 'ghost' ? 0.4 : 0.25;
  const last = foe.lastPick;
  if (last && (BASIC_TACTICS as readonly string[]).includes(last) && rng.chance(cunning)) return counterTo(last as BasicTactic);
  const men = st.remote ? st.party ?? 0 : ship.crew;
  if (men < st.startCrew * 0.45 && rng.chance(0.4)) return 'hold';
  return rng.pick(BASIC_TACTICS);
}

function legal(st: BoardingState, t: BoardTactic | null): BoardTactic {
  if (!t) return 'hold';
  return st.momentum >= TACTICS[t].cost ? t : 'hold';
}

/** One round of the deck fight. Returns who won the fight when it is over (true: the attacker), 'cut' when the
 *  grapples parted, null to fight on. */
function resolveRound(game: Game, a: ShipEntity, b: ShipEntity): boolean | null | 'cut' {
  const now = game.now;
  const rng = game.rng;
  const bs = a.boarding!, sb = b.boarding!, fight = bs.fight;
  fight.round++;
  bs.rounds = sb.rounds = fight.round;
  if (a.isPlayer && bs.pick === null) fight.log.push({ code: 'waited', by: a.id });
  if (b.isPlayer && sb.pick === null) fight.log.push({ code: 'waited', by: b.id });
  const ta = legal(bs, bs.pick), tb = legal(sb, sb.pick);
  bs.momentum -= TACTICS[ta].cost;
  sb.momentum -= TACTICS[tb].cost;
  const moveA = ta === 'captain' ? CAPTAIN_MOVES[a.captain].id : null;
  const moveB = tb === 'captain' ? CAPTAIN_MOVES[b.captain].id : null;
  let edge = edgeOf(ta, tb);
  const takeA = moveA !== null && TAKES_ROUND.has(moveA), takeB = moveB !== null && TAKES_ROUND.has(moveB);
  if (takeA !== takeB) edge = takeA ? 1 : -1;
  else if (takeA && takeB) edge = 0;
  const agg = AGG[bs.aggression];
  const pa = power(game, a, b, false), pb = power(game, b, a, true);
  // What each side's order does to the dead on both sides.
  let byA = TACTICS[ta].kill * (edge > 0 ? 1.5 : edge < 0 ? 0.6 : 1) * TACTICS[tb].loss;
  let byB = TACTICS[tb].kill * (edge < 0 ? 1.5 : edge > 0 ? 0.6 : 1) * TACTICS[ta].loss;
  for (const [move, mine] of [[moveA, true], [moveB, false]] as const) {
    if (!move) continue;
    const own = (k: number) => (mine ? (byA *= k) : (byB *= k));
    const theirs = (k: number) => (mine ? (byB *= k) : (byA *= k));
    if (move === 'point_blank') own(2);
    else if (move === 'smoke_and_knives') theirs(0.33);
    else if (move === 'red_harvest') own(1.8);
    else if (move === 'iron_discipline') {
      own(1.3);
      theirs(0.4);
    }
  }
  const aMen = bs.remote ? bs.party ?? 0 : a.crew;
  let killB = Math.min(b.crew, Math.round(pa * ROUND_KILL * agg.tempo * byA * (0.7 + rng.float() * 0.6)));
  let killA = Math.min(aMen, Math.round(pb * ROUND_KILL * agg.ownLoss * byB * (0.7 + rng.float() * 0.6)));
  if (moveA === 'call_of_the_deep') killB = Math.min(b.crew, killB + Math.round(b.crew * 0.1));
  if (moveB === 'call_of_the_deep') killA = Math.min(aMen, killA + Math.round(aMen * 0.1));
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
  sb.killed += killA2;
  sb.lost += killB2;
  onCrewKilled(game, b, livingB, a);
  onCrewKilled(game, a, livingA, b);
  // Blood and Salt: every foe that falls mends the victor's hull.
  bloodAndSalt(a, killB2);
  bloodAndSalt(b, killA2);
  b.morale -= ((killB / Math.max(1, bs.enemyStartCrew)) * 90 + 4) * moraleLossMul(b);
  a.morale -= (killA / Math.max(1, bs.startCrew)) * 70 * moraleLossMul(a);
  if (a.hasFlag('terror') && b.crew < b.stats.crewMax * 0.3) b.morale -= 6;
  if (a.hasFlag('no_quarter')) b.morale -= killB2; // every man that falls unnerves the rest
  // The special orders and the captains' moves.
  for (const [s, e, t, move, st, et] of [[a, b, ta, moveA, bs, sb], [b, a, tb, moveB, sb, bs]] as const) {
    if (t === 'officers') {
      e.morale -= 15;
      et.momentum = Math.max(0, et.momentum - 30);
      fight.log.push({ code: 'officers', by: s.id });
    } else if (t === 'colours') {
      e.morale -= e.morale < 50 ? 40 : 25;
      fight.log.push({ code: 'colours', by: s.id });
    }
    if (!move) continue;
    st.moves++;
    fight.log.push({ code: `move.${move}`, by: s.id });
    if (move === 'red_harvest') {
      s.morale += 20;
      e.morale -= 15;
    } else if (move === 'call_of_the_deep') e.morale -= 25;
    else if (move === 'iron_discipline') s.morale += 30;
  }
  // Momentum: a round taken is worth most; the orders that cost it earn none back.
  const gain = (t: BoardTactic, e: number) => ((BASIC_TACTICS as readonly string[]).includes(t) ? (e > 0 ? MOMENTUM.win : e < 0 ? MOMENTUM.lose : MOMENTUM.even) : 0);
  bs.momentum = clamp(bs.momentum + gain(ta, edge) + (moveA === 'turn_the_flank' ? 40 : 0), 0, 100);
  sb.momentum = clamp(sb.momentum + gain(tb, -edge) + (moveB === 'turn_the_flank' ? 40 : 0), 0, 100);
  if (edge > 0) {
    bs.won++;
    sb.lostRounds++;
  } else if (edge < 0) {
    sb.won++;
    bs.lostRounds++;
  }
  bs.lastPick = ta;
  sb.lastPick = tb;
  bs.pick = sb.pick = null;
  if (ta === 'grenades') fight.fires++;
  if (tb === 'grenades') fight.fires++;
  fight.last = { ta, tb, ka: killA2, kb: killB2, edge };
  if (fight.log.length > 12) fight.log.splice(0, fight.log.length - 12);
  game.emit({ k: 'board_round', a: a.id, b: b.id, x: (a.state.x + b.state.x) / 2, y: (a.state.y + b.state.y) / 2, ta, tb, ka: killA2, kb: killB2 }, a.state.x, a.state.y);
  // First Over the Rail: a quarter of her crew down in the first rush breaks her nerve.
  if (a.hasFlag('first_over_rail') && !bs.railChecked && now - bs.startedAt >= 8) {
    bs.railChecked = true;
    if (bs.killed >= bs.enemyStartCrew * 0.25) b.morale -= 15;
  }
  // Hold the Line: the defenders' nerve holds for the first 20 s.
  const hold = tx(b.stats, 'holdTheLine');
  if (hold > 0 && now - bs.startedAt < 20) b.morale = Math.max(b.morale, hold >= 2 ? 35 : 20);
  // NPC defenders try to cut loose while they still have fight in them.
  if (!b.isPlayer && !b.surrendered && b.morale > 30 && now - bs.startedAt >= tx(a.stats, 'ironGrip') && pb >= pa * 0.7 && rng.chance(0.15)) {
    if (cutGrapples(game, b) === null) return 'cut';
  }
  if (a.captain === 'reaver') a.morale += killB * 0.5;
  a.morale = clamp(a.morale, 0, 100);
  b.morale = clamp(b.morale, 0, 100);
  const bBroken = b.crew <= Math.max(floorB, bs.enemyStartCrew * 0.15) || b.morale <= 5 || b.surrendered;
  const aBroken = bs.remote ? (bs.party ?? 0) <= Math.max(1, bs.startCrew * 0.25) : a.crew <= Math.max(floorA, bs.startCrew * 0.15) || a.morale <= 5;
  if (bBroken || aBroken || fight.round >= MAX_ROUNDS) return bBroken && !aBroken ? true : aBroken && !bBroken ? false : pa >= pb;
  // An NPC captain on the losing side may call the other out: one throw of the dice.
  for (const [s, e] of [[a, b], [b, a]] as const) {
    if (s.isPlayer || fight.duel || fight.duelDone || fight.round < 3) continue;
    const mine = menOf(s) / Math.max(1, s.boarding!.startCrew);
    const theirs = menOf(e) / Math.max(1, e.boarding!.startCrew);
    if (mine < 0.55 && theirs > mine && rng.chance(0.3)) offerDuel(game, s, e);
  }
  return null;
}

function menOf(s: ShipEntity): number {
  const st = s.boarding;
  return st?.remote ? st.party ?? 0 : s.crew;
}

// ------------------------------------------------------------------ orders and the captains' duel

/** A captain's order for this round (players; NPC captains decide in openRound). */
export function setTactic(game: Game, ship: ShipEntity, tactic: BoardTactic): string | null {
  const st = ship.boarding;
  if (!st) return 'You are not grappled';
  if (!(tactic in TACTICS)) return 'No such order';
  const fight = st.fight;
  if (fight.tac) return 'This boarding is fought turn by turn';
  if (fight.duel && fight.duel.state !== 'done') return 'The captains are fighting — wait for the duel';
  if (fight.endsAt !== null) return null;
  if (st.momentum < TACTICS[tactic].cost) return 'Not enough momentum for that order';
  st.pick = tactic;
  const other = game.ships.get(st.with);
  if (other) sendFight(game, ship, null);
  return null;
}

/** The captains' duel: call the other out, answer a challenge, or swing the blade. */
export function duelAction(game: Game, ship: ShipEntity, action: 'challenge' | 'accept' | 'decline' | 'strike', at?: number): string | null {
  const st = ship.boarding;
  if (!st) return 'You are not grappled';
  const other = game.ships.get(st.with);
  if (!other?.boarding) return 'Nothing to fight';
  const a = st.attacker ? ship : other, b = st.attacker ? other : ship;
  const fight = st.fight;
  if (fight.tac) return 'This boarding is fought turn by turn';
  const d = fight.duel;
  const now = game.now;
  if (fight.endsAt !== null) return null;
  switch (action) {
    case 'challenge':
      if (fight.duelDone || d) return 'One duel to a fight';
      if (fight.round < 2) return 'Let the steel speak first — a duel after the second round';
      offerDuel(game, ship, other);
      return null;
    case 'accept':
    case 'decline':
      if (!d || d.state !== 'offered' || d.by === ship.id) return 'No challenge to answer';
      if (action === 'accept') startDuel(game, a, b);
      else declineDuel(game, ship);
      return null;
    case 'strike': {
      if (!d || d.state !== 'running') return 'No blade to swing';
      const t = clamp(at ?? now, now - 1.5, now + 0.3);
      const score = strikeScore(d.opens, d.closes, d.sweet, t);
      if (ship === a) d.struckA ??= score;
      else d.struckB ??= score;
      sendFight(game, a, b);
      return null;
    }
  }
}

/** How well a blade swung at time `t` lands: 1 on the sweet spot, nothing a third of the sweep away or outside. */
export function strikeScore(opens: number, closes: number, sweet: number, t: number): number {
  if (t < opens - 0.15 || t > closes + 0.15) return 0;
  const f = (t - opens) / (closes - opens);
  return Math.round(clamp(1 - Math.abs(f - sweet) / 0.35, 0, 1) * 100) / 100;
}

function offerDuel(game: Game, by: ShipEntity, to: ShipEntity): void {
  const fight = by.boarding!.fight;
  fight.duel = { by: by.id, state: 'offered', answerBy: game.now + 6, exchange: 0, opens: 0, closes: 0, sweet: 0.5, a: [], b: [], struckA: null, struckB: null, winner: null };
  fight.log.push({ code: 'duel_offer', by: by.id });
  const a = by.boarding!.attacker ? by : to, b = by.boarding!.attacker ? to : by;
  // An NPC captain answers at once: pride accepts, a broken crew's captain declines.
  if (!to.isPlayer) {
    if (to.morale >= 20 || to.npcRole === 'boss') startDuel(game, a, b);
    else declineDuel(game, to);
    return;
  }
  sendFight(game, a, b);
}

function declineDuel(game: Game, who: ShipEntity): void {
  const st = who.boarding!;
  const fight = st.fight;
  fight.duel = null;
  fight.duelDone = true;
  who.morale = Math.max(0, who.morale - 15);
  fight.log.push({ code: 'duel_decline', by: who.id });
  const other = game.ships.get(st.with)!;
  const a = st.attacker ? who : other, b = st.attacker ? other : who;
  openRound(game, a, b);
}

function startDuel(game: Game, a: ShipEntity, b: ShipEntity): void {
  const d = a.boarding!.fight.duel!;
  d.state = 'running';
  nextExchange(game, d);
  sendFight(game, a, b);
}

function nextExchange(game: Game, d: NonNullable<BoardFight['duel']>): void {
  d.opens = game.now + DUEL_GAP;
  d.closes = d.opens + DUEL_SWEEP;
  d.sweet = Math.round((0.25 + game.rng.float() * 0.5) * 100) / 100;
  d.struckA = d.struckB = null;
}

/** An NPC captain's blade: steadier with the years at sea. */
function npcBlade(game: Game, ship: ShipEntity): number {
  return Math.round(clamp(0.2 + game.rng.float() * 0.55 + Math.min(0.2, ship.level / 300), 0, 0.95) * 100) / 100;
}

function stepDuel(game: Game, a: ShipEntity, b: ShipEntity): void {
  const fight = a.boarding!.fight;
  const d = fight.duel!;
  const now = game.now;
  if (d.state === 'offered') {
    if (now > d.answerBy) declineDuel(game, d.by === a.id ? b : a);
    return;
  }
  if (now < d.closes + 0.35) return;
  d.a.push(d.struckA ?? (a.isPlayer ? 0 : npcBlade(game, a)));
  d.b.push(d.struckB ?? (b.isPlayer ? 0 : npcBlade(game, b)));
  d.exchange++;
  if (d.exchange < DUEL_EXCHANGES) {
    nextExchange(game, d);
    sendFight(game, a, b);
    return;
  }
  const sa = d.a.reduce((x, y) => x + y, 0), sbs = d.b.reduce((x, y) => x + y, 0);
  d.winner = Math.abs(sa - sbs) < 1e-6 ? (a.morale >= b.morale ? a.id : b.id) : sa > sbs ? a.id : b.id;
  d.state = 'done';
  fight.duelDone = true;
  fight.log.push({ code: 'duel_won', by: d.winner });
  const [w, l] = d.winner === a.id ? [a, b] : [b, a];
  w.morale = Math.min(100, w.morale + 20);
  l.morale = 0;
  // The fallen captain's crew throws down its arms: the fight ends on the duel's last blow.
  fight.endsAt = now + 1.8;
  fight.winner = w.id;
  sendFight(game, a, b);
}

// ------------------------------------------------------------------ what each captain sees

/** The deck fight from one captain's side. */
export function fightView(game: Game, ship: ShipEntity): BoardFightView | null {
  const st = ship.boarding;
  const other = st ? game.ships.get(st.with) : undefined;
  const ost = other?.boarding;
  if (!st || !other || !ost) return null;
  const fight = st.fight;
  const side = (s: ShipEntity, x: BoardingState): BoardSideView => ({ name: s.name, captain: s.captain ?? null, crew: menOf(s), crewStart: x.startCrew, morale: Math.round(s.morale), momentum: Math.round(x.momentum) });
  const me = st.attacker;
  const l = fight.last;
  const d = fight.duel;
  return {
    attacker: me,
    round: fight.round,
    maxRounds: MAX_ROUNDS,
    ends: fight.deadline,
    choice: st.pick,
    you: side(ship, st),
    foe: side(other, ost),
    last: l ? { you: me ? l.ta : l.tb, foe: me ? l.tb : l.ta, edge: me ? l.edge : ((-l.edge) as 1 | 0 | -1), killed: me ? l.kb : l.ka, lost: me ? l.ka : l.kb } : null,
    log: fight.log.slice(-5).map((e) => ({ code: e.code, you: e.by === ship.id, ...(e.n !== undefined ? { n: e.n } : {}) })),
    duel: d
      ? {
          by: d.by === ship.id ? 'you' : 'foe', state: d.state, answerBy: d.answerBy, exchange: d.exchange, opens: d.opens, closes: d.closes, sweet: d.sweet,
          struck: (me ? d.struckA : d.struckB) !== null, you: me ? d.a : d.b, foe: me ? d.b : d.a, winner: d.winner === null ? null : d.winner === ship.id ? 'you' : 'foe',
        }
      : null,
    canDuel: !fight.duelDone && !d && fight.round >= 2 && fight.endsAt === null,
    canCut: me ? !ship.hasFlag('no_quarter') : true,
  };
}

/** Tell the captains aboard how the fight stands (`b` null: only `a`). */
function sendFight(game: Game, a: ShipEntity, b: ShipEntity | null): void {
  for (const s of b ? [a, b] : [a]) {
    if (!s.isPlayer || s.boarding?.fight.tac) continue;
    const ses = game.sessionOf(s);
    if (ses) game.sendTo(ses, { t: 'board_fight', view: fightView(game, s) });
  }
}

function closeFight(game: Game, s: ShipEntity): void {
  if (!s.isPlayer) return;
  closeTac(game, s);
  const ses = game.sessionOf(s);
  if (ses) game.sendTo(ses, { t: 'board_fight', view: null });
}

function finishBoarding(game: Game, a: ShipEntity, b: ShipEntity, attackerWins: boolean): void {
  const bs = a.boarding!;
  const fight = bs.fight;
  a.boarding = null;
  b.boarding = null;
  closeFight(game, a);
  closeFight(game, b);
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
  // Cargo destroyed during the fight (10–25% typical at "standard"); grenades set fires below. Careful Hands can
  // take it to nothing.
  const lossFrac = clamp(a.stats.boardingCargoLoss * agg.cargo * (b.surrendered ? 0.5 : 1) + bs.rounds * 0.012 + fight.fires * 0.015, 0, 0.45);
  const duel = fight.duel?.winner != null ? (fight.duel.winner === a.id ? 'won' : 'lost') : null;
  claimPrize(game, a, b, lossFrac, bs.lost, bs.killed, bs.aggression, { rounds: fight.round, won: bs.won, lost: bs.lostRounds, duel, moves: bs.moves, ...(fight.tac ? { tac: true } : {}) });
}

/** A ship that struck (boarded, or surrendered on terms) hands her hold to the victor. */
export function claimPrize(game: Game, a: ShipEntity, b: ShipEntity, lossFrac: number, lost: number, killed: number, aggression: Aggression = 'standard', report?: BoardingResult['report']): void {
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
    ...(report ? { report } : {}),
  };
  game.onBoardingWon(a, b, result);
}
