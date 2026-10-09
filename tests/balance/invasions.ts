// docs/19 E16 (balance): a wave of the Choir's invasion against a group of captains of the waters' level, at sea.
// Every ship on open water (the duels' sea, duel.ts), steered and fought by the sea's fighting mind (engage): the
// captains with an average captain's craft (duel.ts CRAFT.average), the Choir's ships with their level's own; each
// takes the nearest foe. The group wins when the whole wave is sunk while one of them is afloat, in FIGHT_SEC × 2.
// The last wave's first ship is the flagship, a level above the waters (invasions.ts).
//   node tools/balance-invasions.ts [fights a cell]

import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { hullsFor } from '../../shared/src/data/shiplevel.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { engage } from '../../server/src/game/npc.ts';
import type { NpcBrain } from '../../server/src/game/npc.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { FIGHT_SEC, openWater, putSide } from './duel.ts';

type Unit = { ship: ShipEntity; brain: NpcBrain };

/** The hull of the waters' level the sea's raiders sail (the Choir's and the captains' alike). */
export const hullOf = (level: number): ShipClassId => hullsFor('pirate', level)[0];

/** One fight: `captains` of `level` against a wave of `ships` (with the flagship a level up when `flag`). */
export function waveFight(game: Game, level: number, captains: number, ships: number, flag: boolean, k: number, maxSec = FIGHT_SEC * 2): 'won' | 'lost' | 'draw' {
  const at = openWater(game, k);
  const h = (k * 2.399) % (Math.PI * 2);
  const across = (i: number, n: number) => (i - (n - 1) / 2) * 180;
  const us: Unit[] = Array.from({ length: captains }, (_, i) => putSide(game, { cls: hullOf(level), level, craft: 'average' }, at.x + Math.sin(h + Math.PI / 2) * across(i, captains), at.y - Math.cos(h + Math.PI / 2) * across(i, captains), h));
  const fx = at.x + Math.sin(h) * 1100, fy = at.y - Math.cos(h) * 1100;
  const them: Unit[] = Array.from({ length: ships }, (_, i) => {
    const lv = flag && i === 0 ? Math.min(10, level + 1) : level;
    return putSide(game, { cls: hullOf(lv), level: lv, craft: 'bot' }, fx + Math.sin(h + Math.PI / 2) * across(i, ships), fy - Math.cos(h + Math.PI / 2) * across(i, ships), h + Math.PI);
  });
  for (const t of them) t.brain.role = 'hunter';
  const next = new Map<number, number>();
  const think = (me: Unit, foes: Unit[]) => {
    if ((next.get(me.ship.id) ?? 0) > game.now) return;
    next.set(me.ship.id, game.now + (me.brain.skill?.react ?? 0.5));
    let foe: ShipEntity | null = null, bd = Infinity;
    for (const f of foes) {
      if (!f.ship.alive) continue;
      const d = Math.hypot(f.ship.state.x - me.ship.state.x, f.ship.state.y - me.ship.state.y);
      if (d < bd) {
        bd = d;
        foe = f.ship;
      }
    }
    if (foe) engage(game, me.ship, me.brain, foe, bd);
  };
  const t0 = game.now;
  const alive = (xs: Unit[]) => xs.filter((x) => x.ship.alive);
  while (game.now - t0 < maxSec && alive(us).length && alive(them).length) {
    for (const u of alive(us)) think(u, them);
    for (const t of alive(them)) think(t, us);
    game.step();
  }
  const res = !alive(them).length && alive(us).length ? 'won' : alive(them).length && !alive(us).length ? 'lost' : 'draw';
  for (const x of [...us, ...them]) if (game.ships.has(x.ship.id)) game.removeShip(x.ship.id);
  return res;
}

/** The share of fights the group wins. */
export function waveShare(game: Game, level: number, captains: number, ships: number, flag: boolean, n: number, from = 0): number {
  let w = 0;
  for (let k = from; k < from + n; k++) if (waveFight(game, level, captains, ships, flag, k) === 'won') w++;
  return w / n;
}
