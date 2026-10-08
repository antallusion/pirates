// The turn-based boarding battle on the ships (docs/16 P4, docs/17 H1): when it is fought instead of the round-by-round
// deck fight, the sides the ships and their armies make — every stack as it stands after the gunnery, her deck as the
// guns left it — the clock (the sea's turns, the captains' 30 s, a captain gone from the helm handing his side to
// auto-battle), the fallen taken off their own stacks as they fall, the ransom, the captains' screens and the end,
// which goes back through the boarding's own finish (the plunder, the prize, the losses) with the experience the
// victor's captain learnt from it.

import { creaturesWon, mixedOf, rankArmy } from './tame.ts'; // docs/18 IV
import { deckGift } from './shipgifts.ts'; // the premium hulls' gifts (docs/02 §1.A.9)
import { FIRST_NAMES, LAST_NAMES } from '../../../shared/src/data/crew.ts';
import type { OfficerRole } from '../../../shared/src/data/crew.ts';
import { armyCost, hasSpecial, UNITS } from '../../../shared/src/data/army.ts';
import { kindOfUnit } from '../../../shared/src/data/tactical.ts';
import type { TacAction } from '../../../shared/src/protocol.ts';
import { XP_UNITS, battleXp, targetXp } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import type { NpcRole } from './ship.ts';
import { ladderBetween } from './ladder.ts';
import { officerFactor, onFightWon, woundOfficer } from './crew.ts';
import { onCrewKilled } from './mind.ts';
import { bloodAndSalt, drownedTakeLosses } from './bridgefx.ts';
import { afterBattle, heroFace, heroInput, maybeArtifact } from './hero.ts';
import { npcPathOf } from './pathbook.ts';
import { isTrialShip } from './throne.ts'; // docs/19 E3
import { act, endByRansom, killedHp, lossesOf, newBattle, stepBattle, viewOf } from './tacbattle.ts';
import type { TacArmyEntry, TacBattle, TacSideInput } from './tacbattle.ts';

/** The sea's crews by role: their veterancy in stars and the officer who leads them. A merchant's hands are no
 *  fighters. (Their men are their army, docs/17 H1: server/src/game/army.ts.) */
const NPC_MIX: Record<NpcRole, { skill: number; officer: OfficerRole | null }> = {
  merchant: { skill: 1, officer: null },
  fisher: { skill: 1, officer: null },
  patrol: { skill: 3, officer: 'lieutenant' },
  pirate: { skill: 3, officer: 'boatswain' },
  hunter: { skill: 3.5, officer: 'lieutenant' },
  ghost: { skill: 3, officer: 'deep_pastor' },
  escort: { skill: 3, officer: 'lieutenant' },
  boss: { skill: 4, officer: 'lieutenant' },
  beast: { skill: 1, officer: null },
};

/** The victor's lesson from the battle itself (HoMM3's: the men cut down), in units of her own level's ship sunk by the
 *  share of the other side's hit points cut down — a small bonus on the prize, never a second prize (docs/26). */
export const TAC_XP_SHARE = XP_UNITS.battle;
/** A ransom is this share of the silver the boarders' living army is worth. */
export const TAC_RANSOM_SHARE = 0.5;

/** Fought turn by turn: a captain on at least one side (who has not asked for the old deck fight), both decks
 *  alongside (a jolly-boat raid keeps the old fight), and the setting on. */
export function wantsTactical(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  if (!game.tacticalBoarding || a.boarding?.remote) return false;
  const sa = game.sessionOf(a), sb = game.sessionOf(b);
  if (!sa && !sb) return false;
  return !(sa?.classicBoarding || sb?.classicBoarding);
}

/** What the guns left of her deck (docs/17 H1): holes by her leaks and the hull lost, the share of her guns dismounted,
 *  a fire aboard. */
export function deckState(ship: ShipEntity): { holes: number; gunsOut: number; fire: boolean } {
  const lost = 1 - Math.max(0, Math.min(1, ship.hull / Math.max(1, ship.stats.hullMax)));
  const per = Math.max(1, ship.stats.gunsPerSide);
  return {
    holes: Math.min(4, Math.floor(lost * 4 + 0.25) + Math.min(2, ship.leaks)),
    gunsOut: Math.max(0, Math.min(1, (ship.gunsDisabled.port + ship.gunsDisabled.starboard) / (2 * per))),
    fire: ship.hasEffect('fire'),
  };
}

/** What a ship and her army bring to the battle. */
export function sideOf(game: Game, ship: ShipEntity, enemy: ShipEntity, attacker: boolean): TacSideInput {
  const s = game.sessionOf(ship);
  const c = s?.profile?.company;
  let skill = 2;
  const officers: TacSideInput['officers'] = [];
  const now = game.now;
  if (c) {
    skill = c.skill;
    for (const o of [...c.officers].filter((x) => officerFactor(x, now) > 0).sort((x, y) => y.level - x.level).slice(0, 2)) {
      officers.push({ id: o.id, role: o.role, name: o.name, level: o.level, ...(o.unique ? { unique: o.unique } : {}), lucky: o.traits.includes('lucky') });
    }
  } else {
    const mix = NPC_MIX[ship.npcRole ?? 'pirate'];
    skill = mix.skill;
    if (mix.officer && ship.crew >= 12) {
      const name = `${FIRST_NAMES[ship.id % FIRST_NAMES.length]} ${LAST_NAMES[(ship.id * 7) % LAST_NAMES.length]}`;
      officers.push({ id: `npc-${ship.id}`, role: mix.officer, name, level: Math.max(1, Math.min(20, Math.round(ship.level / 4))), lucky: false });
    }
  }
  // Every stack of her army goes on deck (a ship without men still sends her last hand); a tamed kind with its rank
  // (docs/18 #39).
  const army: TacArmyEntry[] = rankArmy(s?.profile, ship.army.map((x) => ({ u: x.u, n: x.n, src: x.u })));
  if (!army.length) army.push({ u: 'deckhand', n: 1, src: 'deckhand' });
  // The Marines talent: a tenth of the hands a rank are drilled to fight as marines (for the fight; they stay hands).
  const men = army.reduce((n, x) => n + x.n, 0);
  const hands = army.filter((x) => UNITS[x.u].tier === 1).sort((x, y) => y.n - x.n)[0];
  const drilled = hands ? Math.min(hands.n - 1, Math.round(men * Math.min(0.3, tx(ship.stats, 'marines')))) : 0;
  if (hands && drilled > 0) {
    hands.n -= drilled;
    army.push({ u: 'marine', n: drilled, src: hands.u });
  }
  const count = (f: (x: TacArmyEntry) => boolean) => army.filter(f).reduce((n, x) => n + x.n, 0);
  const deck = deckState(ship);
  return {
    name: s?.name ?? ship.captainName, ship: ship.name, hull: ship.loadout.classId, captain: (s ? null : npcPathOf(ship)) ?? ship.captain ?? null,
    hands: count((x) => UNITS[x.u].tier === 1), marines: count((x) => kindOfUnit(x.u) === 'marines'), gunners: count((x) => hasSpecial(x.u, 'shooter')),
    army, officers, skill, morale: ship.morale,
    dealt: ladderBetween(game, ship, enemy).dealt || 0.1,
    power: Math.max(0.3, ship.stats.boardingPower) * (ship.captain === 'reaver' && enemy.crew < enemy.stats.crewMax * 0.5 ? 1.2 : 1),
    melee: 1 + tx(ship.stats, 'meleeDamage'),
    extraShots: (ship.cargo.weapons ?? 0) >= 5 ? 1 : 0,
    firstRush: attacker && ship.hasFlag('first_over_rail') ? 1.25 : 1,
    nets: attacker ? 0 : tx(ship.stats, 'boardingNets'),
    blooded: tx(ship.stats, 'blooded'),
    castle: !attacker && ship.cls.passive.id === 'castle',
    struck: ship.surrendered,
    human: !!s,
    holes: deck.holes,
    gunsOut: deck.gunsOut,
    fire: deck.fire,
    hero: heroInput(game, ship), // docs/17 H2
    mixed: mixedOf(s?.profile, ship.army), // docs/18 #38: the peoples of a mixed army
    ...(deckGift(ship) ? { gift: deckGift(ship) } : {}), // a premium hull's deck gift (docs/02 §1.A.9)
    ...(heroFace(game, ship) ? { face: heroFace(game, ship) } : {}), // docs/18 item 8: a named captain's own face
  };
}

/** Lay the battle out on the fight both boarding states share. Its dice are its own (seeded from the sea's once), so
 *  a battle never shifts the rest of the world's. */
export function startTactical(game: Game, a: ShipEntity, b: ShipEntity): void {
  const fight = a.boarding!.fight;
  const seed = game.rng.int(1, 1e9);
  const rng = new Rng(seed ^ 0x7ac7);
  fight.tacRng = rng;
  fight.tac = newBattle(sideOf(game, a, b, true), sideOf(game, b, a, false), seed, game.now, rng);
  fight.tacSync = [0, 0];
  fight.tacSeen = new Map(fight.tac.stacks.map((s) => [s.id, s.count]));
  sendTac(game, a, b);
}

const rngOf = (game: Game, a: ShipEntity): Rng => a.boarding?.fight.tacRng ?? game.rng;

/** The fallen come off their own stacks as they fall (some always live to strike the colours); the risen stand in
 *  them again; the crews' heart follows the battle's. */
function sync(game: Game, a: ShipEntity, b: ShipEntity, bt: TacBattle): void {
  const fight = a.boarding!.fight;
  const synced = (fight.tacSync ??= [0, 0]);
  const seen = (fight.tacSeen ??= new Map(bt.stacks.map((s) => [s.id, s.start])));
  for (const side of [0, 1] as const) {
    const ship = side ? b : a, other = side ? a : b;
    const st = ship.boarding!, ot = other.boarding!;
    ship.morale = bt.heroes[side].morale;
    const d = bt.dead[side] - synced[side];
    synced[side] = bt.dead[side];
    // Each stack's change since last seen: its dead to take off, its risen to stand again.
    const deltas: { src: TacArmyEntry['u']; d: number }[] = [];
    for (const s of bt.stacks) {
      if (s.side !== side) continue;
      const was = seen.get(s.id) ?? s.start;
      if (was !== s.count) deltas.push({ src: s.src, d: was - s.count });
      seen.set(s.id, s.count);
    }
    if (!d) continue;
    if (d < 0) {
      // Rallied: the lightly hurt stand up again, in their own stacks.
      let room = Math.max(0, ship.stats.crewMax - ship.crew);
      for (const x of deltas) if (x.d < 0 && room > 0) {
        const k = Math.min(room, -x.d);
        ship.addMen(x.src, k);
        room -= k;
      }
      st.lost = Math.max(0, st.lost + d);
      ot.killed = Math.max(0, ot.killed + d);
      continue;
    }
    const floor = Math.max(2, Math.round(st.startCrew * 0.1));
    let n = Math.max(0, Math.min(d, ship.crew - floor));
    const total = n;
    const living = drownedTakeLosses(game, ship, n);
    for (const x of deltas) {
      if (x.d <= 0 || n <= 0) continue;
      n -= ship.loseFrom(x.src, Math.min(n, x.d));
    }
    if (n > 0) ship.loseMen(n); // a stack already gone ashore in the ship's books: the loss falls where it can
    st.lost += total;
    ot.killed += total;
    onCrewKilled(game, ship, living, other);
    bloodAndSalt(other, total);
  }
}

/** The battle's clock, from the boarding's step. */
export function stepTactical(game: Game, a: ShipEntity, b: ShipEntity): void {
  const fight = a.boarding!.fight;
  const bt = fight.tac!;
  // A captain gone from the helm: his side fights on by itself.
  for (const side of [0, 1] as const) {
    const h = bt.heroes[side];
    if (h.input.human && !h.auto && !game.sessionOf(side ? b : a)) h.auto = true;
  }
  const seq = bt.seq;
  stepBattle(bt, game.now, rngOf(game, a));
  settle(game, a, b, bt, seq);
}

/** After the battle moved: the crews, the screens, and the end held a moment so both captains see it. */
function settle(game: Game, a: ShipEntity, b: ShipEntity, bt: TacBattle, seq: number): void {
  const fight = a.boarding?.fight;
  if (!fight) return;
  sync(game, a, b, bt);
  if (bt.over && fight.endsAt === null) {
    const winner = bt.over.winner === 0 ? a : b;
    fight.endsAt = game.now + (bt.over.why === 'ransom' ? 1.5 : 2.5);
    fight.winner = winner.id;
    fight.round = bt.round;
    a.boarding!.rounds = b.boarding!.rounds = bt.round;
    a.boarding!.won = b.boarding!.lostRounds = bt.broken[1];
    a.boarding!.lostRounds = b.boarding!.won = bt.broken[0];
    fight.fires = bt.log.filter((e) => e.k === 'spell' && e.id === 'grenades').length;
    a.boarding!.moves = bt.log.filter((e) => e.k === 'spell' && e.side === 0).length;
    // Officers whose parties were cut down are carried below.
    for (const hurt of bt.hurt) {
      const s = game.sessionOf(hurt.side ? b : a);
      const o = s?.profile?.company.officers.find((x) => x.id === hurt.id);
      if (s && o) woundOfficer(game, s, hurt.heavy, 'in the boarding', o);
    }
    // The heroes' will spent, First Aid's patched-up men, a guarded ship's artifact (docs/17 H2).
    for (const side of [0, 1] as const) {
      const ship = side ? b : a;
      afterBattle(game, ship, bt.heroes[side].mana, lossesOf(bt, side), bt.heroes[side].input.hero?.raise ?? 0, bt.heroes[side].stam, bt.heroes[side].scrollsUsed);
    }
    {
      const w = bt.over.winner === 0 ? a : b, l = w === a ? b : a;
      const ws0 = game.sessionOf(w);
      if (ws0?.profile && !game.sessionOf(l) && bt.over.why !== 'ransom' && !isTrialShip(l)) maybeArtifact(game, ws0, 'guard', l.elite ? 0.6 : Math.min(0.3, bt.heroes[w === a ? 1 : 0].startMen / 400));
    }
    // The victor's captain learns from the men his side cut down (HoMM3: the experience of a battle won).
    const wSide = bt.over.winner;
    creaturesWon(game, winner, bt.stacks.filter((x) => x.side === wSide).map((x) => x.src)); // docs/18 #39
    const ws = game.sessionOf(winner);
    const lost = winner === a ? b : a;
    const xp = ws?.profile ? battleXp(ws.profile.level, lost.onLadder ? lost.combatLevel : null, killedHp(bt, wSide), bt.stacks.reduce((n, x) => n + (x.side !== wSide ? x.start * x.hpMax : 0), 0), TAC_XP_SHARE) : 0;
    fight.tacXp = [wSide === 0 ? xp : 0, wSide === 1 ? xp : 0];
    if (ws?.profile && xp > 0) game.grantXp(ws, xp, `Won the boarding battle with ${(winner === a ? b : a).name}`, true);
    // Boarders thrown back: the defenders' fight won (the victor's is counted with the prize).
    if (winner === b && bt.over.why !== 'ransom') {
      const s = game.sessionOf(b);
      if (s?.profile) {
        onFightWon(game, s);
        game.grantXp(s, targetXp(s.profile.level, a.onLadder ? a.combatLevel : null, XP_UNITS.repelled), `Threw back the boarders of ${a.name}`, true);
      }
    }
  }
  if (bt.seq !== seq || (bt.over && fight.endsAt !== null)) sendTac(game, a, b);
}

/** Silver the side of `ship` would pay to buy the other side off (HoMM3's surrender): half what the other side's
 *  living men are worth, and never less than a hundred. Null when she cannot (a boarder is not offered it, nor a
 *  captain without a purse). */
export function ransomCost(game: Game, ship: ShipEntity): number | null {
  const st = ship.boarding;
  const bt = st?.fight.tac;
  if (!st || !bt || st.attacker || bt.over) return null;
  const s = game.sessionOf(ship);
  if (!s?.profile) return null;
  const foe = bt.stacks.filter((x) => x.side === 0 && x.count > 0).map((x) => ({ u: x.unit, n: x.count }));
  return Math.max(100, Math.round(armyCost(foe) * TAC_RANSOM_SHARE));
}

function payRansom(game: Game, ship: ShipEntity, other: ShipEntity, bt: TacBattle): string | null {
  const cost = ransomCost(game, ship);
  const s = game.sessionOf(ship);
  if (cost === null || !s?.profile) return 'No ransom to pay';
  if (s.profile.gold < cost) return 'Not enough silver for the ransom';
  s.profile.gold -= cost;
  game.db.ledger(s.accountId, 'ransom', -cost, other.name);
  // The boarders take the silver: a captain's purse, or the sea's own.
  const os = game.sessionOf(other);
  if (os?.profile) {
    os.profile.gold += cost;
    game.db.ledger(os.accountId, 'ransom', cost, ship.name);
  } else other.purse += cost;
  ship.boarding!.fight.tacPaid = cost;
  endByRansom(bt, 1);
  game.toastShip(ship, `You pay ${cost} silver and the boarders go back over the rail.`, 'info');
  return null;
}

/** A captain's order in the battle. */
export function tacAction(game: Game, ship: ShipEntity, action: TacAction): string | null {
  const st = ship.boarding;
  const bt = st?.fight.tac;
  if (!st || !bt) return 'You are not in a boarding battle';
  const other = game.ships.get(st.with);
  if (!other?.boarding) return 'Nothing to fight';
  const a = st.attacker ? ship : other, b = st.attacker ? other : ship;
  const side = st.attacker ? 0 : 1;
  if (!action || typeof action !== 'object') return 'No such order';
  if (action.a === 'surrender' && side === 0) return 'Boarders do not strike: fall back instead';
  const seq = bt.seq;
  if (action.a === 'ransom') {
    if (side === 0) return 'Boarders do not pay: fall back instead';
    const why = payRansom(game, ship, other, bt);
    settle(game, a, b, bt, seq);
    if (why) sendTac(game, a, b);
    return why;
  }
  // Quick combat against the sea; against a captain it hands your side to auto-battle.
  if (action.a === 'quick' && (game.sessionOf(other) || other.isPlayer)) action = { a: 'auto', on: true };
  const why = act(bt, side, action, game.now, rngOf(game, a));
  settle(game, a, b, bt, seq);
  if (why) sendTac(game, a, b);
  return why;
}

/** One captain's view (`b` null: only `a`). */
export function sendTac(game: Game, a: ShipEntity, b: ShipEntity | null): void {
  for (const s of b ? [a, b] : [a]) {
    const st = s.boarding;
    const bt = st?.fight.tac;
    if (!s.isPlayer || !st || !bt) continue;
    const ses = game.sessionOf(s);
    if (!ses) continue;
    const side = st.attacker ? 0 : 1;
    const f = st.fight;
    const result = bt.over ? { lost: lossesOf(bt, side), killed: lossesOf(bt, (1 - side) as 0 | 1), xp: f.tacXp?.[side] ?? 0, ...(f.tacPaid && side === 1 ? { paid: f.tacPaid } : {}) } : undefined;
    game.sendTo(ses, { t: 'board_tac', view: viewOf(bt, side, game.now, st.attacker ? !s.hasFlag('no_quarter') : true, { ransom: ransomCost(game, s), ...(result ? { result } : {}) }) });
  }
}

export function closeTac(game: Game, s: ShipEntity): void {
  if (!s.isPlayer) return;
  const ses = game.sessionOf(s);
  if (ses) game.sendTo(ses, { t: 'board_tac', view: null });
}
