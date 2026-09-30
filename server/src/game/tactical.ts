// The turn-based boarding battle on the ships (docs/16 P4): when it is fought instead of the round-by-round deck
// fight, the sides the ships and their crews make, the clock (the sea's turns, the captains' 30 s, a captain gone
// from the helm handing his side to auto-battle), the fallen taken off the crews as they fall, the captains' screens
// and the end, which goes back through the boarding's own finish (the plunder, the prize, the losses).

import { FIRST_NAMES, LAST_NAMES } from '../../../shared/src/data/crew.ts';
import type { OfficerRole } from '../../../shared/src/data/crew.ts';
import type { TacAction } from '../../../shared/src/protocol.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import type { NpcRole } from './ship.ts';
import { ladderBetween } from './ladder.ts';
import { officerFactor, onFightWon, woundOfficer } from './crew.ts';
import { onCrewKilled } from './mind.ts';
import { bloodAndSalt, drownedTakeLosses } from './bridgefx.ts';
import { act, newBattle, stepBattle, viewOf } from './tacbattle.ts';
import type { TacBattle, TacSideInput } from './tacbattle.ts';

/** The sea's crews by role: the share of marines and musketeers, and their veterancy in stars. A merchant's hands
 *  are no fighters. */
const NPC_MIX: Record<NpcRole, { marines: number; gunners: number; skill: number; officer: OfficerRole | null }> = {
  merchant: { marines: 0, gunners: 0.08, skill: 1, officer: null },
  fisher: { marines: 0, gunners: 0.05, skill: 1, officer: null },
  patrol: { marines: 0.25, gunners: 0.2, skill: 3, officer: 'lieutenant' },
  pirate: { marines: 0.2, gunners: 0.15, skill: 3, officer: 'boatswain' },
  hunter: { marines: 0.25, gunners: 0.2, skill: 3.5, officer: 'lieutenant' },
  ghost: { marines: 0.15, gunners: 0.1, skill: 3, officer: 'deep_pastor' },
  escort: { marines: 0.2, gunners: 0.2, skill: 3, officer: 'lieutenant' },
  boss: { marines: 0.3, gunners: 0.2, skill: 4, officer: 'lieutenant' },
  beast: { marines: 0, gunners: 0, skill: 1, officer: null },
};

/** Fought turn by turn: a captain on at least one side (who has not asked for the old deck fight), both decks
 *  alongside (a jolly-boat raid keeps the old fight), and the setting on. */
export function wantsTactical(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  if (!game.tacticalBoarding || a.boarding?.remote) return false;
  const sa = game.sessionOf(a), sb = game.sessionOf(b);
  if (!sa && !sb) return false;
  return !(sa?.classicBoarding || sb?.classicBoarding);
}

/** What a ship and her crew bring to the battle. */
export function sideOf(game: Game, ship: ShipEntity, enemy: ShipEntity, attacker: boolean): TacSideInput {
  const s = game.sessionOf(ship);
  const c = s?.profile?.company;
  const men = Math.max(1, ship.crew);
  let hands = men, marines = 0, gunners = 0, skill = 2;
  const officers: TacSideInput['officers'] = [];
  const now = game.now;
  if (c) {
    const p = c.pools;
    const total = Math.max(1, p.sailor + p.gunner + p.helmsman + p.carpenter + p.surgeon + p.marine + p.cook);
    marines = Math.round((p.marine / total) * men);
    gunners = Math.round((p.gunner / total) * men);
    skill = c.skill;
    for (const o of [...c.officers].filter((x) => officerFactor(x, now) > 0).sort((x, y) => y.level - x.level).slice(0, 2)) {
      officers.push({ id: o.id, role: o.role, name: o.name, level: o.level, ...(o.unique ? { unique: o.unique } : {}), lucky: o.traits.includes('lucky') });
    }
  } else {
    const mix = NPC_MIX[ship.npcRole ?? 'pirate'];
    marines = Math.round(men * mix.marines);
    gunners = Math.round(men * mix.gunners);
    skill = mix.skill;
    if (mix.officer && men >= 12) {
      const name = `${FIRST_NAMES[ship.id % FIRST_NAMES.length]} ${LAST_NAMES[(ship.id * 7) % LAST_NAMES.length]}`;
      officers.push({ id: `npc-${ship.id}`, role: mix.officer, name, level: Math.max(1, Math.min(20, Math.round(ship.level / 4))), lucky: false });
    }
  }
  // The Marines talent: a tenth of the crew a rank fights as marines.
  const drilled = Math.min(men - marines - gunners, Math.round(men * Math.min(0.3, tx(ship.stats, 'marines'))));
  marines += Math.max(0, drilled);
  hands = Math.max(0, men - marines - gunners);
  return {
    name: s?.name ?? ship.captainName, ship: ship.name, captain: ship.captain ?? null, hands, marines, gunners, officers, skill, morale: ship.morale,
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
  };
}

/** Lay the battle out on the fight both boarding states share. */
export function startTactical(game: Game, a: ShipEntity, b: ShipEntity): void {
  const fight = a.boarding!.fight;
  fight.tac = newBattle(sideOf(game, a, b, true), sideOf(game, b, a, false), game.rng.int(1, 1e9), game.now, game.rng);
  fight.tacSync = [0, 0];
  sendTac(game, a, b);
}

/** The fallen come off the crews as they fall (some always live to strike the colours); the crews' heart follows
 *  the battle's. */
function sync(game: Game, a: ShipEntity, b: ShipEntity, bt: TacBattle): void {
  const fight = a.boarding!.fight;
  const synced = (fight.tacSync ??= [0, 0]);
  for (const side of [0, 1] as const) {
    const ship = side ? b : a, other = side ? a : b;
    const st = ship.boarding!, ot = other.boarding!;
    ship.morale = bt.heroes[side].morale;
    const d = bt.dead[side] - synced[side];
    if (!d) continue;
    synced[side] = bt.dead[side];
    if (d < 0) {
      ship.crew = Math.min(ship.stats.crewMax, ship.crew - d); // rallied: the lightly hurt stand up again
      st.lost = Math.max(0, st.lost + d);
      ot.killed = Math.max(0, ot.killed + d);
      continue;
    }
    const floor = Math.max(2, Math.round(st.startCrew * 0.1));
    const n = Math.max(0, Math.min(d, ship.crew - floor));
    const living = drownedTakeLosses(game, ship, n);
    ship.crew -= n;
    st.lost += n;
    ot.killed += n;
    onCrewKilled(game, ship, living, other);
    bloodAndSalt(other, n);
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
  stepBattle(bt, game.now, game.rng);
  settle(game, a, b, bt, seq);
}

/** After the battle moved: the crews, the screens, and the end held a moment so both captains see it. */
function settle(game: Game, a: ShipEntity, b: ShipEntity, bt: TacBattle, seq: number): void {
  const fight = a.boarding?.fight;
  if (!fight) return;
  sync(game, a, b, bt);
  if (bt.over && fight.endsAt === null) {
    const winner = bt.over.winner === 0 ? a : b;
    fight.endsAt = game.now + 2.5;
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
    // Boarders thrown back: the defenders' fight won (the victor's is counted with the prize).
    if (winner === b) {
      const s = game.sessionOf(b);
      if (s?.profile) {
        onFightWon(game, s);
        game.grantXp(s, Math.round(40 * Math.max(1, a.cls.tier) * (1 + a.level / 12)), `Threw back the boarders of ${a.name}`, true);
      }
    }
  }
  if (bt.seq !== seq || (bt.over && fight.endsAt !== null)) sendTac(game, a, b);
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
  // Quick combat against the sea; against a captain it hands your side to auto-battle.
  if (action.a === 'quick' && (game.sessionOf(other) || other.isPlayer)) action = { a: 'auto', on: true };
  const seq = bt.seq;
  const why = act(bt, side, action, game.now, game.rng);
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
    if (ses) game.sendTo(ses, { t: 'board_tac', view: viewOf(bt, st.attacker ? 0 : 1, game.now, st.attacker ? !s.hasFlag('no_quarter') : true) });
  }
}

export function closeTac(game: Game, s: ShipEntity): void {
  if (!s.isPlayer) return;
  const ses = game.sessionOf(s);
  if (ses) game.sendTo(ses, { t: 'board_tac', view: null });
}
