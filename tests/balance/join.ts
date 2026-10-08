// The beaten who come over after a boarding won (owner, 2026-10-08: «при успешном абордаже я должен забирать часть
// команды убитого корабля к себе, небольшую, чтобы поддерживать состав как-то и чтобы не посещать острова»): a captain
// of a level boarding the ships of her waters one after another, KILLS_HOUR boardings an hour, her men lost against the
// beaten who come over to her (server/src/game/crew.ts beatenJoin: JOIN_SHARE and JOIN_LEAD a rank of her Leadership,
// never past her hammocks) — and the old prisoners' offer on top (30% of the survivors of a ship taken). Her crew is not
// refilled in port: what the boardings leave her is what she boards the next with. The report: node tools/balance-join.ts.

import { armyForLevel, armyMen } from '../../shared/src/data/army.ts';
import type { ArmyMix, ArmyStack, UnitId } from '../../shared/src/data/army.ts';
import { ladder } from '../../shared/src/data/shiplevel.ts';
import { Rng } from '../../shared/src/rng.ts';
import { newBattle, quickFinish } from '../../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../../server/src/game/tacbattle.ts';
import { joinCount, joinKinds } from '../../server/src/game/crew.ts';
import { KILLS_HOUR } from './island.ts';

export const HAMMOCKS = [0, 40, 60, 80, 110, 140, 180, 220, 300, 400, 600];

export interface Traffic {
  role: string;
  w: number;
  mix: ArmyMix;
  /** Levels below her it fights at (canon D12: a merchant two, a fisher one). */
  gap: number;
  /** Its men, a share of her hammocks. */
  men: number;
}
/** The contested waters' traffic (server/src/game/traffic.ts MIX): what she meets and boards. */
export const TRAFFIC: Traffic[] = [
  { role: 'merchant', w: 40, mix: 'merchant', gap: 2, men: 1 },
  { role: 'fisher', w: 20, mix: 'merchant', gap: 1, men: 0.5 },
  { role: 'patrol', w: 15, mix: 'navy', gap: 0, men: 1 },
  { role: 'pirate', w: 25, mix: 'pirate', gap: 0, men: 1 },
  { role: 'hunter', w: 8, mix: 'navy', gap: 0, men: 1 },
];
/** The trade of her waters, which she always takes: its merchants and fishers. */
export const TRADE = TRAFFIC.filter((t) => t.mix === 'merchant');

const side = (army: ArmyStack[], dealt: number): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false,
});

const tidy = (a: ArmyStack[]): ArmyStack[] => {
  const by = new Map<UnitId, number>();
  for (const x of a) if (x.n > 0) by.set(x.u, (by.get(x.u) ?? 0) + x.n);
  return [...by].map(([u, n]) => ({ u, n }));
};

export interface Boarding {
  won: boolean;
  lost: number;
  joined: number;
  prisoners: number;
  after: ArmyStack[];
}

/** One boarding: her army of ⚓L against a ship of the traffic, fought out; a win and every man of the ship beaten. */
export function board(me: ArmyStack[], L: number, t: Traffic, seed: number, lead: number): Boarding {
  const foe = armyForLevel(Math.max(1, L - t.gap), Math.round(HAMMOCKS[L] * t.men), 7, t.mix);
  const rng = new Rng(seed);
  const bt = newBattle(side(me, ladder(L, L - t.gap, false).dealt), side(foe, ladder(L - t.gap, L, false).dealt), seed, 0, rng);
  quickFinish(bt, 0, rng);
  const won = bt.over?.winner === 0;
  const left = tidy(bt.stacks.filter((s) => s.side === 0).map((s) => ({ u: s.src, n: s.count })));
  const lost = armyMen(me) - armyMen(left);
  if (!won) return { won, lost, joined: 0, prisoners: 0, after: left };
  // Every man of the ship she took was beaten; a tenth of them live on her books to strike (tactical.ts sync), and the
  // survivors' part of those who came over comes off them before the prisoners are offered.
  const pool = armyMen(foe);
  const came = joinKinds(foe, joinCount(pool, lead, HAMMOCKS[L] - armyMen(left)), false);
  const joined = came.reduce((a, x) => a + x.n, 0);
  const floor = Math.max(2, Math.round(pool * 0.1));
  const survivors = floor - Math.round((joined * floor) / Math.max(1, pool));
  const prisoners = Math.max(0, Math.min(Math.floor(survivors * 0.3), HAMMOCKS[L] - armyMen(left) - joined));
  return { won, lost, joined, prisoners, after: tidy([...left, ...came]) };
}

export interface SteadyHour {
  /** Her men lost an hour in the boardings she won, and in all of them. */
  lostWon: number;
  lostAll: number;
  /** The beaten who came over an hour, and with the prisoners' offer taken. */
  joined: number;
  withPrisoners: number;
  /** Her crew at the end of the run, a share of her hammocks; the share of boardings she lost. */
  crewAfter: number;
  defeats: number;
  /** Her crew never past her hammocks. */
  over: number;
}

/** `chains` runs of `hours` without a port at ⚓L, boarding ships of `prey` as they come (a boarding lost: she limps to
 *  port, and the run goes on from a full crew). */
export function steady(L: number, prey: readonly Traffic[], chains: number, lead: number, hours = 2): SteadyHour {
  let lostAll = 0, lostWon = 0, joined = 0, pris = 0, fights = 0, defeats = 0, endMen = 0, over = 0;
  for (let c = 0; c < chains; c++) {
    let me = armyForLevel(L, HAMMOCKS[L], 7, 'player');
    const pick = new Rng(L * 7919 + c * 104729);
    for (let k = 0; k < KILLS_HOUR * hours; k++) {
      const t = pick.weighted(prey.map((x) => [x, x.w] as const));
      const r = board(me, L, t, L * 1000003 + c * 9973 + k * 31 + 1, lead);
      fights++;
      lostAll += r.lost;
      if (!r.won) {
        defeats++;
        me = armyForLevel(L, HAMMOCKS[L], 7, 'player');
        continue;
      }
      lostWon += r.lost;
      joined += r.joined;
      pris += r.prisoners;
      me = r.after;
      over = Math.max(over, armyMen(me) - HAMMOCKS[L]);
    }
    endMen += armyMen(me) / HAMMOCKS[L];
  }
  const h = chains * hours;
  return { lostWon: lostWon / h, lostAll: lostAll / h, joined: joined / h, withPrisoners: (joined + pris) / h, crewAfter: endMen / chains, defeats: defeats / fights, over };
}
