// A guard hired at sea (owner, 2026-10-25: «он бы плыл рядом и охранял меня»): how much easier a fight is with a hired
// ship of her own ⚓ beside her. A captain's warship of her ⚓ (fought by the sea's fighting mind with an average
// captain's craft, as tests/balance/seakit.ts underway) against a rover of her ⚓, 900 m apart under way, with and without
// a patrol of her ⚓ hired through the real contract (server/src/game/seahire.ts), steered by her own brain (npc.ts).
// The rover fights the nearer of the two once the guard has fired on her.
//
//   node --disable-warning=ExperimentalWarning tests/balance/seahire.ts [runs]

import { hullsFor } from '../../shared/src/data/shiplevel.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { engage, newBrain } from '../../server/src/game/npc.ts';
import type { NpcBrain } from '../../server/src/game/npc.ts';
import { hire } from '../../server/src/game/seahire.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { CRAFT, openWater } from './duel.ts';
import { bench, captainShip, clearSea, npcShip } from './seakit.ts';
import type { Gear } from './seakit.ts';

export interface GuardRun {
  win: boolean;
  /** Seconds from the start to the rover down (or the clock). */
  sec: number;
  /** Her hull lost, a share. */
  lost: number;
  /** The guard's hull lost, a share (NaN: no guard). */
  guardLost: number;
}

/** One fight: her warship of ⚓`anchor` in `gear` against a rover of ⚓`anchor` (an elite if asked), a guard or not. */
export function guardFight(game: Game, anchor: number, gear: Gear, guard: boolean, k: number, elite = false, maxSec = 300): GuardRun {
  clearSea(game);
  const at = openWater(game, k);
  const h = (k * 2.399) % (Math.PI * 2);
  const { s, ship: A } = captainShip(game, { anchor, gear, kit: true }, at.x, at.y, h);
  const B = npcShip(game, anchor, at.x + Math.sin(h + 1.3) * 900, at.y - Math.cos(h + 1.3) * 900, elite, h + Math.PI);
  let E: ShipEntity | null = null;
  if (guard) {
    const e = game.spawnNpcShip('patrol', hullsFor('patrol', anchor)[0], 'league', at.x + Math.sin(h + Math.PI / 2) * 95, at.y - Math.cos(h + Math.PI / 2) * 95, h);
    game.setNpcLevel(e, anchor);
    e.region = game.regionAt(e.state.x, e.state.y);
    game.npcs.get(e.id)!.active = true;
    game.grid.upsert(e.id, e.state.x, e.state.y);
    const err = hire(game, s, e.id, 20);
    if (err) throw new Error(`⚓${anchor}: ${err}`);
    E = e;
  }
  for (const x of [A, B]) {
    x.state.speed = x.stats.maxSpeed * 0.7;
    x.input = { rudder: 0, sailTarget: 0.75 };
    x.region = game.regionAt(x.state.x, x.state.y);
  }
  if (E) {
    E.state.speed = A.state.speed;
    E.state.heading = A.state.heading;
  }
  const brains = new Map<number, NpcBrain>();
  for (const x of [A, B]) {
    const b = newBrain(x.id, 'hunter', game.now);
    b.active = true;
    if (x.isPlayer) {
      b.skill = CRAFT.average;
      b.captain = true;
    }
    brains.set(x.id, b);
    game.npcs.delete(x.id);
  }
  const next = new Map<number, number>();
  const think = (me: ShipEntity, foe: ShipEntity) => {
    const b = brains.get(me.id)!;
    if ((next.get(me.id) ?? 0) > game.now) return;
    next.set(me.id, game.now + (b.skill?.react ?? 0.5));
    engage(game, me, b, foe, Math.hypot(foe.state.x - me.state.x, foe.state.y - me.state.y));
  };
  const down = (x: ShipEntity) => !x.alive || x.hull <= 1 || x.surrendered;
  const t0 = game.now;
  const company = s.profile?.company;
  while (game.now - t0 < maxSec && !down(A) && !down(B)) {
    think(A, B);
    // the rover: the nearer of the two once the guard has fired on her
    const onE = E && E.alive && (B.attackers.get(E.id) ?? -999) > game.now - 60 && Math.hypot(E.state.x - B.state.x, E.state.y - B.state.y) < Math.hypot(A.state.x - B.state.x, A.state.y - B.state.y);
    think(B, onE ? E! : A);
    if (company) {
      company.course = null;
      company.mutiny = null;
      company.loyalty = 100;
      company.unrest = { phase: 0, t: 0 };
    }
    game.step();
  }
  return {
    win: down(B) && !down(A),
    sec: Math.round(game.now - t0),
    lost: Math.round((1 - Math.max(0, A.hull) / A.stats.hullMax) * 100) / 100,
    guardLost: E ? Math.round((1 - Math.max(0, E.hull) / Math.max(1, E.stats.hullMax)) * 100) / 100 : NaN,
  };
}

export interface GuardRow {
  anchor: number;
  gear: Gear;
  elite: boolean;
  guard: boolean;
  wins: number;
  runs: number;
  sec: number;
  lost: number;
  /** Her hull lost, the mean over the runs (a share). */
  meanLost: number;
  guardLost: number;
}

const med = (xs: number[]) => (xs.length ? [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)] : NaN);

export function guardTable(anchors: number[], runs: number, cases: { gear: Gear; elite: boolean }[]): GuardRow[] {
  const game = bench();
  const out: GuardRow[] = [];
  for (const anchor of anchors) for (const c of cases) for (const guard of [false, true]) {
    const rs: GuardRun[] = [];
    for (let k = 0; k < runs; k++) rs.push(guardFight(game, anchor, c.gear, guard, 500 + anchor * 31 + k, c.elite));
    out.push({ anchor, gear: c.gear, elite: c.elite, guard, runs, wins: rs.filter((r) => r.win).length, sec: med(rs.filter((r) => r.win).map((r) => r.sec)), lost: med(rs.map((r) => r.lost)), meanLost: rs.reduce((a, r) => a + r.lost, 0) / Math.max(1, rs.length), guardLost: med(rs.map((r) => r.guardLost)) });
  }
  return out;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('seahire.ts')) {
  const runs = Number(process.argv[2] ?? 6);
  const rows = guardTable([3, 5, 8], runs, [{ gear: 'full', elite: false }, { gear: 'level', elite: true }]);
  for (const r of rows) console.log(`⚓${r.anchor} ${r.gear}${r.elite ? ' vs elite' : ''} ${r.guard ? 'GUARD' : 'solo '}  wins ${r.wins}/${r.runs}  sec ${r.sec}  her hull lost ${Math.round(r.lost * 100)}%${r.guard ? `  guard lost ${Math.round(r.guardLost * 100)}%` : ''}`);
}
