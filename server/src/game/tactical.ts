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
import { TAC_END_WINDOW, TAC_LEN, TAC_RESIST, kindOfUnit, npcBoardSlots } from '../../../shared/src/data/tactical.ts';
import { npcHeroLevel } from '../../../shared/src/data/hero.ts';
import type { TacAction } from '../../../shared/src/protocol.ts';
import { XP_UNITS, battleXp, targetXp } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import { tx } from '../../../shared/src/sim/shipstats.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import type { NpcRole } from './ship.ts';
import { ladderBetween } from './ladder.ts';
import { beatenJoin, joinsFrom, officerFactor, onFightWon, woundOfficer } from './crew.ts';
import { onCrewKilled } from './mind.ts';
import { bloodAndSalt, drownedTakeLosses } from './bridgefx.ts';
import { afterBattle, heroFace, heroInput, maybeArtifact } from './hero.ts';
import { npcPathOf } from './pathbook.ts';
import { isTrialShip } from './throne.ts'; // docs/19 E3
import { isCastellan, siegeSetup } from './citadels.ts'; // docs/19 E5
import { contractSpellHp } from './admiralty.ts'; // docs/19 E15
import { raidSpellHp } from './abyssraid.ts'; // docs/19 E11
import { arenaResultOf, arenaSettle, arenaSetup, arenaTag, isArenaFight } from './arena.ts'; // docs/19 E14
import { act, endByRansom, killedHp, lossesOf, newBattle, playSince, sideStrength, stepBattle, viewOf } from './tacbattle.ts';
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
  if (isCastellan(b)) return true; // docs/19 E5: a citadel's siege is fought on the hexes, whatever she asked
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

/** docs/25 block Г: a legend of the Admiralty or of the Abyss, a raid's ship, a castellan, a trial, a zone's great one —
 *  long by design (owner, docs/25 §1.2): no tempo, no fatigue, no flag, no chess clock, no quick fight. */
export function longFoe(ship: ShipEntity): boolean {
  return isTrialShip(ship) || raidSpellHp(ship) !== undefined || ship.npcRole === 'boss';
}

/** docs/25 block Г: the length a boarding of these two ships is fought at (startTactical lays it out so; the odds
 *  shown before it, boardodds.ts, the same). */
export function boardLen(a: ShipEntity, b: ShipEntity): 'board' | 'long' {
  return longFoe(a) || longFoe(b) ? 'long' : 'board';
}

/** A man's worth in a boarding (HoMM3's square law: his blows by his hit points, each behind his Attack and Defense). */
function manWorth(u: TacArmyEntry['u']): number {
  const d = UNITS[u];
  const k = 1 + (0.05 * (d.atk + d.def)) / 2;
  return Math.sqrt(d.hp * ((d.dmin + d.dmax) / 2)) * k * (d.shots ? 1.15 : 1) * (d.specials.includes('double_strike') ? 1.2 : 1);
}

/** docs/25 item 64: the stacks of her army an ally brings to a group's boarding — the kinds she chose (in her order),
 *  else her strongest by worth (men × a man's worth), TAC_GROUP.bring at most; never her last man's only stack empty. */
export function pickBring<T extends { u: TacArmyEntry['u']; n: number }>(army: readonly T[], n: number, choice: readonly string[] = []): T[] {
  const live = army.filter((x) => x.n > 0 && UNITS[x.u]);
  const out: T[] = [];
  for (const u of choice) {
    const x = live.find((y) => y.u === u && !out.includes(y));
    if (x && out.length < n) out.push(x);
  }
  for (const x of [...live].sort((p, q) => q.n * manWorth(q.u) - p.n * manWorth(p.u))) if (out.length < n && !out.includes(x)) out.push(x);
  return out;
}

/** A man's hit points behind his Defense, and his mean blow behind his Attack (the stack's own lift on them). */
const manHp = (x: TacArmyEntry) => UNITS[x.u].hp * (1 + 0.05 * UNITS[x.u].def) * (x.hpK ?? 1);
const manBlow = (x: TacArmyEntry) => ((UNITS[x.u].dmin + UNITS[x.u].dmax) / 2) * (1 + 0.05 * UNITS[x.u].atk) * (x.dmgK ?? 1);

/** docs/25 item 50: the sea's army in `slots` stacks for the battle only (her ship keeps hers): the weakest stack
 *  stands in, man for man, with the kind of hers nearest it in worth (a shooter with a shooter), and that stack carries
 *  their hit points and blows with it — the same head count and the same strength in fewer, fuller stacks. */
export function battleFit(army: TacArmyEntry[], slots: number): TacArmyEntry[] {
  const out = army.map((x) => ({ ...x }));
  const worth = (x: TacArmyEntry) => x.n * manWorth(x.u);
  while (out.length > Math.max(1, slots)) {
    let small = 0;
    for (let i = 1; i < out.length; i++) if (worth(out[i]) < worth(out[small])) small = i;
    const [s] = out.splice(small, 1);
    const shoots = hasSpecial(s.u, 'shooter');
    const same = out.filter((x) => hasSpecial(x.u, 'shooter') === shoots);
    const w = manWorth(s.u);
    const into = (same.length ? same : out).reduce((b, x) => {
      const dx = Math.abs(manWorth(x.u) - w), db = Math.abs(manWorth(b.u) - w);
      return dx < db || (dx === db && x.n > b.n) ? x : b;
    });
    const n = into.n + s.n;
    const hp = into.n * manHp(into) + s.n * manHp(s), blows = into.n * manBlow(into) + s.n * manBlow(s);
    const base = { ...into, hpK: 1, dmgK: 1 };
    into.hpK = Math.round((hp / (n * manHp(base))) * 1000) / 1000;
    into.dmgK = Math.round((blows / (n * manBlow(base))) * 1000) / 1000;
    into.n = n;
  }
  return out;
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
  const hero = heroInput(game, ship); // docs/17 H2
  // docs/25 item 50: a ship of the sea brings a stack or two fewer than a captain of her level (not a legend's).
  const fielded = s || longFoe(ship) ? army : battleFit(army, npcBoardSlots(hero?.level ?? npcHeroLevel(ship.shipLevel)));
  return {
    name: s?.name ?? ship.captainName, ship: ship.name, hull: ship.loadout.classId, captain: (s ? null : npcPathOf(ship)) ?? ship.captain ?? null,
    hands: count((x) => UNITS[x.u].tier === 1), marines: count((x) => kindOfUnit(x.u) === 'marines'), gunners: count((x) => hasSpecial(x.u, 'shooter')),
    army: fielded, officers, skill, morale: ship.morale,
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
    hero, // docs/17 H2
    mixed: mixedOf(s?.profile, ship.army), // docs/18 #38: the peoples of a mixed army
    ...(deckGift(ship) ? { gift: deckGift(ship) } : {}), // a premium hull's deck gift (docs/02 §1.A.9)
    ...(heroFace(game, ship) ? { face: heroFace(game, ship) } : {}), // docs/18 item 8: a named captain's own face
    // docs/25 item 56: a legend of the trials and a great ship of the sea shrug off a share of a captain's orders.
    ...(!s && isTrialShip(ship) ? { resist: TAC_RESIST.legend } : !s && ship.npcRole === 'boss' ? { resist: TAC_RESIST.boss } : {}),
  };
}

/** Lay the battle out on the fight both boarding states share. Its dice are its own (seeded from the sea's once), so
 *  a battle never shifts the rest of the world's. */
export function startTactical(game: Game, a: ShipEntity, b: ShipEntity): void {
  const fight = a.boarding!.fight;
  // docs/19 E14: a bout of the Colosseum — the drafted armies and the template heroes on its sand, its own seed.
  const arena = arenaSetup(game, a, b);
  const seed = arena ? arena.seed : game.rng.int(1, 1e9);
  const rng = new Rng(seed ^ 0x7ac7);
  fight.tacRng = rng;
  // docs/25 block Г: a boarding's length by its level; the legends, the raid, the citadels and the trials long by design.
  // A bout of the Colosseum keeps its own short length (a drafted army, template captains, its pairs evened at it): the
  // boarding's reckoning of Attack and Defense, guards and orders (items 45–47), not its tempo, clocks or flag.
  if (arena) fight.tac = newBattle(arena.sides[0], arena.sides[1], seed, game.now, rng, { arena: true, len: 'long' });
  else {
    // docs/19 E5: a castellan alongside — the siege before her citadel's walls, its garrison in its own seven stacks.
    const so = siegeSetup(game, a, b);
    const bIn = sideOf(game, b, a, false);
    if (so) {
      bIn.army = so.army.map((x) => ({ u: x.u, n: x.n, src: x.u }));
      bIn.spellHp = so.spellHp;
    }
    bIn.spellHp ??= contractSpellHp(b) ?? raidSpellHp(b); // docs/19 E15, E11: a legend of the Admiralty or of the Abyss orders as a captain, not as her army
    const len = so ? 'long' : boardLen(a, b);
    const bt = newBattle(sideOf(game, a, b, true), bIn, seed, game.now, rng, { ...(so ? { siege: so.siege } : {}), len });
    fight.tac = bt;
    // docs/25 item 49: a captain against a clearly weaker ship of the sea is offered the quick fight at once.
    if (len === 'board') {
      const st = [sideStrength(bt, 0), sideStrength(bt, 1)];
      bt.quick = [0, 1].map((x) => bt.heroes[x].input.human && !bt.heroes[1 - x].input.human && st[x] >= TAC_LEN.quick * st[1 - x]) as [boolean, boolean];
    }
  }
  fight.tacSync = [0, 0];
  fight.tacSeen = new Map(fight.tac.stacks.map((s) => [s.id, s.count]));
  sendTac(game, a, b);
}

const rngOf = (game: Game, a: ShipEntity): Rng => a.boarding?.fight.tacRng ?? game.rng;

/** The fallen come off their own stacks as they fall (some always live to strike the colours); the risen stand in
 *  them again; the crews' heart follows the battle's. */
function sync(game: Game, a: ShipEntity, b: ShipEntity, bt: TacBattle): void {
  const fight = a.boarding!.fight;
  if (isArenaFight(fight)) return; // docs/19 E14: a bout touches neither ship's men nor her heart
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

/** Seconds the screens still play of the battle's last blows (TAC_PACE), so its end is held as long before the
 *  boarding closes (owner, 2026-10-08: the pace slowed to be read). */
function playLeft(bt: TacBattle): number {
  return playSince(bt, bt.beatFrom ?? 0, TAC_END_WINDOW);
}

/** After the battle moved: the crews, the screens, and the end held a moment so both captains see it. */
function settle(game: Game, a: ShipEntity, b: ShipEntity, bt: TacBattle, seq: number): void {
  const fight = a.boarding?.fight;
  if (!fight) return;
  sync(game, a, b, bt);
  if (bt.over && fight.endsAt === null) {
    const winner = bt.over.winner === 0 ? a : b;
    // Held a moment so both captains see it — once its last blows are played (owner, 2026-10-08).
    fight.endsAt = game.now + playLeft(bt) + (bt.over.why === 'ransom' ? 1.5 : 2.5);
    fight.winner = winner.id;
    fight.round = bt.round;
    a.boarding!.rounds = b.boarding!.rounds = bt.round;
    a.boarding!.won = b.boarding!.lostRounds = bt.broken[1];
    a.boarding!.lostRounds = b.boarding!.won = bt.broken[0];
    fight.fires = bt.log.filter((e) => e.k === 'spell' && e.id === 'grenades').length;
    a.boarding!.moves = bt.log.filter((e) => e.k === 'spell' && e.side === 0).length;
    // docs/19 E14: a bout of the Colosseum moves the ratings and nothing of the sea's (no officer hurt, no will spent, no
    // experience, no artifact, nobody coming over).
    if (isArenaFight(fight)) arenaSettle(game, fight, bt.over.winner);
    else {
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
      // The beaten who come over (owner, 2026-10-08): to a captain who won the boarding against a ship's crew — every man
      // of a ship of the sea she took (the fallen who were only wounded and those who struck), the fallen of any other.
      const loser = winner === a ? b : a;
      if (bt.over.why !== 'ransom' && !isTrialShip(loser) && joinsFrom(loser)) {
        const lSide = (1 - wSide) as 0 | 1;
        const all = wSide === 0 && !loser.isPlayer;
        const beaten = bt.stacks.filter((x) => x.side === lSide).map((x) => ({ u: x.src, n: all ? x.start : x.start - x.count }));
        const came = beatenJoin(game, winner, beaten, all ? loser : undefined);
        if (came.length) {
          fight.tacJoined = [[], []];
          fight.tacJoined[wSide] = came;
        }
      }
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
  }
  if (bt.seq !== seq || (bt.over && fight.endsAt !== null)) sendTac(game, a, b);
}

/** Silver the side of `ship` would pay to buy the other side off (HoMM3's surrender): half what the other side's
 *  living men are worth, and never less than a hundred. Null when she cannot (a boarder is not offered it, nor a
 *  captain without a purse). */
export function ransomCost(game: Game, ship: ShipEntity): number | null {
  const st = ship.boarding;
  const bt = st?.fight.tac;
  if (!st || !bt || st.attacker || bt.over || isArenaFight(st.fight)) return null; // docs/19 E14: no silver on the sand
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
  // docs/19 E14: on the sand of the Colosseum either side may yield the bout.
  if (action.a === 'surrender' && side === 0 && !isArenaFight(st.fight)) return 'Boarders do not strike: fall back instead';
  const seq = bt.seq;
  if (action.a === 'ransom') {
    if (side === 0) return 'Boarders do not pay: fall back instead';
    const why = payRansom(game, ship, other, bt);
    settle(game, a, b, bt, seq);
    if (why) sendTac(game, a, b);
    return why;
  }
  // docs/25 item 49: no quick fight with a legend, the Abyss raid, a citadel, the Colosseum or a trial.
  if (action.a === 'quick' && noQuick(st.fight, bt)) return 'No quick fight here: this one is fought to the end';
  // Quick combat against the sea; against a captain it hands your side to auto-battle.
  if (action.a === 'quick' && (game.sessionOf(other) || other.isPlayer)) action = { a: 'auto', on: true };
  const why = act(bt, side, action, game.now, rngOf(game, a));
  settle(game, a, b, bt, seq);
  if (why) sendTac(game, a, b);
  return why;
}

/** docs/25 item 49: a fight with no quick fight — long by design (a legend, the raid, a citadel, a trial) or a bout. */
function noQuick(fight: Parameters<typeof isArenaFight>[0], bt: TacBattle): boolean {
  return bt.len === 'long' || !!bt.siege || isArenaFight(fight);
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
    const joined = f.tacJoined?.[side];
    // docs/19 E14: a bout of the Colosseum — no grapples to cut, either side may yield, its rating on the end screen.
    const arena = arenaTag(f);
    const ar = arena ? arenaResultOf(f, side) : undefined;
    const result = bt.over ? { lost: lossesOf(bt, side), killed: lossesOf(bt, (1 - side) as 0 | 1), xp: f.tacXp?.[side] ?? 0, ...(f.tacPaid && side === 1 ? { paid: f.tacPaid } : {}), ...(joined?.length ? { joined } : {}), ...(ar ? { arena: ar } : {}) } : undefined;
    // docs/25 item 49: the quick fight offered at once (in the first round) against a clearly weaker ship of the sea;
    // none at all against a legend, the raid, a citadel, on the sand or in a trial.
    const quick = noQuick(f, bt) ? { noQuick: true } : bt.quick?.[side] && bt.round <= 1 && !bt.over ? { quickNow: true } : {};
    game.sendTo(ses, { t: 'board_tac', view: viewOf(bt, side, game.now, arena ? false : st.attacker ? !s.hasFlag('no_quarter') : true, { ransom: ransomCost(game, s), ...(result ? { result } : {}), ...(arena ? { canStrike: true, arena } : {}), ...quick }) });
  }
}

export function closeTac(game: Game, s: ShipEntity): void {
  if (!s.isPlayer) return;
  const ses = game.sessionOf(s);
  if (ses) game.sendTo(ses, { t: 'board_tac', view: null });
}
