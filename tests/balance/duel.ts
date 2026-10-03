// The balance sims' duel (docs/12 §3.6): two ships alone on open water, each steered and fought by the sea's own
// fighting mind (engage), one of them under a scripted captain's craft — a perfect one (true lead, no range error,
// a held broadside in the perfect window every time, a dash out of danger), an average one, or an idle one who
// does nothing at all. The rest of the sea is cleared and nothing new puts out while they fight.

import type { NpcSkill } from '../../shared/src/data/shiplevel.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { buildNavGrid, isLand } from '../../shared/src/world/worldgen.ts';
import { SPEED_SCALE } from '../../shared/src/constants.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { engage, newBrain } from '../../server/src/game/npc.ts';
import type { NpcBrain } from '../../server/src/game/npc.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { makeGame } from '../helpers.ts';

export type Craft = 'perfect' | 'average' | 'idle' | 'bot';

/** A scripted captain's craft (a bot's is her level's). */
export const CRAFT: Record<'perfect' | 'average', NpcSkill> = {
  perfect: { lead: 1, rangeErr: 0, arcDeg: 8, spread: 0, react: 0.25, dash: true },
  average: { lead: 0.75, rangeErr: 0.1, arcDeg: 18, spread: 0.15, react: 1.0, dash: false },
};

export interface Side {
  cls: ShipClassId;
  level: number;
  craft: Craft;
  /** A bot's craft other than her level's (tuning). */
  skill?: NpcSkill;
}

export interface DuelResult {
  winner: 'a' | 'b' | 'draw';
  sec: number;
  hullA: number;
  hullB: number;
}

/** A sea emptied for duels: every NPC gone, nothing more to put out. */
/** A fight's time: fifteen minutes at the old pace of six, as long again as the sea is slower (the same sea-miles). */
export const FIGHT_SEC = Math.round((900 * 6) / SPEED_SCALE);

export function duelSea(): Game {
  const { game } = makeGame();
  // The sims weigh ship against ship on the open sea they were tuned on: the dense sea's stacks and reefs (docs/16 P3)
  // are taken off their chart (and the islands of docs/18 III).
  const w = game.world;
  w.islands.length = w.isleFrom; // nor the small islands, atolls and ridges of docs/18 III
  w.ports.length = w.portsFrom ?? w.ports.length; // nor the twenty towns of step 8 (their islands went with the line above)
  for (const [k, list] of w.chunks) w.chunks.set(k, list.filter((id) => id < w.minorFrom));
  for (const [k, list] of w.reefChunks) w.reefChunks.set(k, list.filter((id) => id < w.reefsFrom));
  w.navGrid = buildNavGrid(w, false, w.minorFrom, w.reefsFrom);
  for (const id of [...game.npcs.keys()]) game.removeShip(id);
  (game as unknown as { quota: () => number }).quota = () => 0;
  (game as unknown as { patrolsSpawnedAt: number }).patrolsSpawnedAt = 1e15;
  return game;
}

/** Open water in the Black Coast, clear of land for a mile around. */
function openWater(game: Game, k: number): { x: number; y: number } {
  for (let i = 0; i < 400; i++) {
    const x = 12_000 + ((k * 7919 + i * 104_729) % 20_000);
    const y = 60_000 + ((k * 6007 + i * 130_363) % 20_000);
    let clear = true;
    for (let a = 0; a < 16 && clear; a++) for (const r of [300, 800, 1400]) if (isLand(game.world, x + Math.cos(a) * r, y + Math.sin(a) * r)) clear = false;
    if (clear) return { x, y };
  }
  return { x: 20_000, y: 70_000 };
}

function put(game: Game, side: Side, role: 'patrol' | 'hunter', x: number, y: number, h: number): { ship: ShipEntity; brain: NpcBrain } {
  const ship = game.spawnNpcShip(role, side.cls, role === 'patrol' ? 'crown' : 'confederacy', x, y, h);
  game.npcs.delete(ship.id); // steered here, not by the sea's own brains
  game.setNpcLevel(ship, side.level);
  const brain = newBrain(ship.id, role, game.now);
  brain.active = true;
  if (side.skill) {
    brain.skill = side.skill;
    ship.effects = ship.effects.filter((e) => e.id !== 'npc_craft');
    if (side.skill.spread) ship.effects.push({ id: 'npc_craft', until: 1e12, mods: { spreadMul: side.skill.spread } });
    ship.recompute(game.now);
  } else if (side.craft === 'perfect' || side.craft === 'average') {
    brain.skill = CRAFT[side.craft];
    ship.effects = ship.effects.filter((e) => e.id !== 'npc_craft');
    // The perfect captain lets every broadside go in the charged window: tighter and harder (docs/11 P2).
    if (side.craft === 'perfect') ship.effects.push({ id: 'perfect_window', until: 1e12, mods: { gunDamageMul: 0.12, spreadMul: -0.45 } });
    else ship.effects.push({ id: 'npc_craft', until: 1e12, mods: { spreadMul: CRAFT.average.spread } });
    ship.recompute(game.now);
  }
  ship.crew = ship.stats.crewMax;
  ship.morale = 80;
  ship.ammo.round = 999;
  ship.hull = ship.stats.hullMax;
  game.grid.upsert(ship.id, x, y);
  return { ship, brain };
}

/** A side put on the water alone (the hunt's sims). */
export function putSide(game: Game, side: Side, x: number, y: number, h: number): { ship: ShipEntity; brain: NpcBrain } {
  return put(game, side, 'patrol', x, y, h);
}

/** One duel: `a` against `b`, 900 m apart, until one is sunk or `maxSec` runs out. */
export function duel(game: Game, a: Side, b: Side, k: number, maxSec = FIGHT_SEC): DuelResult {
  const at = openWater(game, k);
  const h = ((k * 2.399) % (Math.PI * 2));
  const A = put(game, a, 'patrol', at.x, at.y, h);
  const B = put(game, b, 'hunter', at.x + Math.sin(h + 1.3) * 900, at.y - Math.cos(h + 1.3) * 900, h + Math.PI);
  const t0 = game.now;
  const next = new Map<number, number>();
  const think = (me: { ship: ShipEntity; brain: NpcBrain }, foe: ShipEntity, craft: Craft) => {
    if (craft === 'idle') {
      me.ship.input = { rudder: 0, sailTarget: 0 };
      return;
    }
    if ((next.get(me.ship.id) ?? 0) > game.now) return;
    next.set(me.ship.id, game.now + (me.brain.skill?.react ?? 0.5));
    const d = Math.hypot(foe.state.x - me.ship.state.x, foe.state.y - me.ship.state.y);
    engage(game, me.ship, me.brain, foe, d);
  };
  while (game.now - t0 < maxSec && A.ship.alive && B.ship.alive) {
    think(A, B.ship, a.craft);
    think(B, A.ship, b.craft);
    game.step();
  }
  const res: DuelResult = {
    winner: !B.ship.alive && A.ship.alive ? 'a' : !A.ship.alive && B.ship.alive ? 'b' : 'draw',
    sec: Math.round(game.now - t0),
    hullA: Math.round((A.ship.hull / A.ship.stats.hullMax) * 100),
    hullB: Math.round((B.ship.hull / B.ship.stats.hullMax) * 100),
  };
  for (const s of [A.ship, B.ship]) game.removeShip(s.id);
  return res;
}

/** Share of duels `a` wins out of `n`. */
export function winRate(game: Game, a: Side, b: Side, n: number, from = 0): { wins: number; losses: number; draws: number; rate: number } {
  let wins = 0, losses = 0, draws = 0;
  for (let k = from; k < from + n; k++) {
    const r = duel(game, a, b, k);
    if (r.winner === 'a') wins++;
    else if (r.winner === 'b') losses++;
    else draws++;
  }
  return { wins, losses, draws, rate: wins / n };
}

/** Several ships against one (docs/12 §3.6: three of a level against one a level up). Each side's ships all take the
 *  nearest foe; `many` wins when `one` is sunk, `one` when all of `many` are. */
export function squad(game: Game, many: Side, count: number, one: Side, k: number, maxSec = FIGHT_SEC): 'many' | 'one' | 'draw' {
  const at = openWater(game, k);
  const h = ((k * 2.399) % (Math.PI * 2));
  const team = Array.from({ length: count }, (_, i) => put(game, many, 'patrol', at.x + Math.sin(h + Math.PI / 2) * (i - (count - 1) / 2) * 160, at.y - Math.cos(h + Math.PI / 2) * (i - (count - 1) / 2) * 160, h));
  const B = put(game, one, 'hunter', at.x + Math.sin(h + 1.3) * 900, at.y - Math.cos(h + 1.3) * 900, h + Math.PI);
  const t0 = game.now;
  const next = new Map<number, number>();
  const think = (me: { ship: ShipEntity; brain: NpcBrain }, foes: ShipEntity[]) => {
    if ((next.get(me.ship.id) ?? 0) > game.now) return;
    next.set(me.ship.id, game.now + (me.brain.skill?.react ?? 0.5));
    let foe = foes[0], bd = Infinity;
    for (const f of foes) {
      const d = Math.hypot(f.state.x - me.ship.state.x, f.state.y - me.ship.state.y);
      if (d < bd) {
        bd = d;
        foe = f;
      }
    }
    if (foe) engage(game, me.ship, me.brain, foe, bd);
  };
  const alive = () => team.filter((t) => t.ship.alive);
  while (game.now - t0 < maxSec && B.ship.alive && alive().length) {
    for (const t of alive()) think(t, [B.ship]);
    think(B, alive().map((t) => t.ship));
    game.step();
  }
  const res = !B.ship.alive && alive().length ? 'many' : B.ship.alive && !alive().length ? 'one' : 'draw';
  for (const s of [...team.map((t) => t.ship), B.ship]) if (game.ships.has(s.id)) game.removeShip(s.id);
  return res;
}
