// The balance of the hunt (docs/12 P4): a captain's ship under the sea's fighting mind (engage) against a pod of
// orcas or a lone great whale that she has provoked — the pod circles and bites, the whale rams. Scripted craft as
// in the duels (docs/12 §3.6).

import type { BeastId } from '../../shared/src/data/beasts.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { beastBrain, clearBeasts, spawnGroup } from '../../server/src/game/beasts.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { engage } from '../../server/src/game/npc.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { isLand } from '../../shared/src/world/worldgen.ts';
import type { Craft } from './duel.ts';
import { putSide } from './duel.ts';

export interface HuntResult {
  won: boolean;
  sec: number;
  hull: number;
}

function openWater(game: Game, k: number): { x: number; y: number } {
  for (let i = 0; i < 400; i++) {
    const x = 50_000 + ((k * 7919 + i * 104_729) % 14_000);
    const y = 66_000 + ((k * 6007 + i * 130_363) % 14_000);
    let clear = true;
    for (let a = 0; a < 16 && clear; a++) for (const r of [300, 800, 1400]) if (isLand(game.world, x + Math.cos(a) * r, y + Math.sin(a) * r)) clear = false;
    if (clear) return { x, y };
  }
  return { x: 56_000, y: 74_000 };
}

/** One hunt: the ship against a group of beasts 500 m off, which she has fired on first. */
export function hunt(game: Game, cls: ShipClassId, level: number, craft: Craft, beast: BeastId, blevel: number, n: number, k: number, maxSec = 600): HuntResult {
  const at = openWater(game, k);
  const h = (k * 2.399) % (Math.PI * 2);
  const me = putSide(game, { cls, level, craft }, at.x, at.y, h);
  const group = spawnGroup(game, beast, at.x + Math.sin(h + 1.3) * 500, at.y - Math.cos(h + 1.3) * 500, blevel, n);
  for (const b of group) b.attackers.set(me.ship.id, game.now); // provoked
  const t0 = game.now;
  let next = 0;
  const alive = () => group.filter((b) => b.alive && game.ships.has(b.id));
  const fled = () => alive().every((b) => beastBrain(game, b.id)?.mode === 'flee' && Math.hypot(b.state.x - me.ship.state.x, b.state.y - me.ship.state.y) > 1200);
  while (game.now - t0 < maxSec && me.ship.alive && alive().length && !fled()) {
    if (craft !== 'idle' && game.now >= next) {
      next = game.now + (me.brain.skill?.react ?? 0.5);
      let foe: ShipEntity | null = null, bd = Infinity;
      for (const b of alive()) {
        const d = Math.hypot(b.state.x - me.ship.state.x, b.state.y - me.ship.state.y);
        if (d < bd) {
          bd = d;
          foe = b;
        }
      }
      if (foe) engage(game, me.ship, me.brain, foe, bd);
    }
    // Keep them provoked: a pod that has not lost heart keeps fighting.
    for (const b of alive()) if ((b.attackers.get(me.ship.id) ?? -1e9) < game.now - 50) b.attackers.set(me.ship.id, game.now);
    game.step();
  }
  const res = { won: me.ship.alive && (!alive().length || fled()), sec: Math.round(game.now - t0), hull: Math.round((me.ship.hull / me.ship.stats.hullMax) * 100) };
  game.removeShip(me.ship.id);
  clearBeasts(game);
  return res;
}

export function huntRate(game: Game, cls: ShipClassId, level: number, craft: Craft, beast: BeastId, blevel: number, n: number, runs: number, from = 0): { wins: number; rate: number; hull: number } {
  let wins = 0, hull = 0;
  for (let k = from; k < from + runs; k++) {
    const r = hunt(game, cls, level, craft, beast, blevel, n, k);
    if (r.won) wins++;
    hull += r.hull;
  }
  return { wins, rate: wins / runs, hull: Math.round(hull / runs) };
}
