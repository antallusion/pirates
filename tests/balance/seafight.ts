// The sea fight's clock (docs/23 phase 3, item 47): how long two ships of a level take to sink each other with
// broadsides alone, how long a captain takes from «Атаковать» to the grapples, and how many of a green captain's balls
// find her mark. Bot against bot on the open sea of the duel sims (duel.ts), with the events counted as they fly.

import assert from 'node:assert/strict';
import { npcSkill } from '../../shared/src/data/shiplevel.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { canBoard } from '../../server/src/game/boarding.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { engage } from '../../server/src/game/npc.ts';
import type { NpcBrain } from '../../server/src/game/npc.ts';
import type { PlayerSession } from '../../server/src/game/player.ts';
import { startPursuit, stopPursuit } from '../../server/src/game/pursuit.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { join, onHull } from '../helpers.ts';
import { openWater, putSide } from './duel.ts';

/** The hull each level's duel is fought in (the sea's own pirate hulls of that level). */
export const LEVEL_HULL: Record<number, ShipClassId> = { 1: 'sloop', 3: 'schooner', 5: 'brig', 8: 'frigate' };

export interface SeaDuel {
  /** Seconds from the first broadside to the last ship afloat (or the clock running out). */
  fight: number;
  /** Seconds from the start, 900 m apart. */
  total: number;
  sunk: boolean;
  balls: number;
  hits: number;
}

/** Counts the balls each ship throws and the hits each takes (one against one: a hit on her is the other's). */
function counter(game: Game): { balls: Map<number, number>; hits: Map<number, number>; first: number; stop: () => void } {
  const out = { balls: new Map<number, number>(), hits: new Map<number, number>(), first: -1, stop: () => {} };
  const emit = game.emit.bind(game);
  game.emit = (ev, x, y) => {
    if (ev.k === 'volley' && (ev.side === 'port' || ev.side === 'starboard')) {
      out.balls.set(ev.ship, (out.balls.get(ev.ship) ?? 0) + ev.balls.length);
      if (out.first < 0) out.first = game.now;
    } else if (ev.k === 'hit' && !ev.evaded) out.hits.set(ev.ship, (out.hits.get(ev.ship) ?? 0) + 1);
    emit(ev, x, y);
  };
  out.stop = () => {
    game.emit = emit;
  };
  return out;
}

/** Two bots of a level and hull, broadsides only (neither strikes nor boards: the duel's ships are steered here), from
 *  900 m until one is sunk or `maxSec` runs out. */
export function seaDuel(game: Game, cls: ShipClassId, level: number, k: number, maxSec = 300): SeaDuel {
  const at = openWater(game, k);
  const h = (k * 2.399) % (Math.PI * 2);
  const A = putSide(game, { cls, level, craft: 'bot' }, at.x, at.y, h);
  const B = putSide(game, { cls, level, craft: 'bot' }, at.x + Math.sin(h + 1.3) * 900, at.y - Math.cos(h + 1.3) * 900, h + Math.PI);
  B.brain.role = 'hunter';
  const c = counter(game);
  const t0 = game.now;
  const next = new Map<number, number>();
  const think = (me: { ship: ShipEntity; brain: NpcBrain }, foe: ShipEntity) => {
    if ((next.get(me.ship.id) ?? 0) > game.now) return;
    next.set(me.ship.id, game.now + (me.brain.skill?.react ?? 0.5));
    engage(game, me.ship, me.brain, foe, Math.hypot(foe.state.x - me.ship.state.x, foe.state.y - me.ship.state.y));
  };
  while (game.now - t0 < maxSec && A.ship.alive && B.ship.alive) {
    think(A, B.ship);
    think(B, A.ship);
    game.step();
  }
  c.stop();
  const sunk = !A.ship.alive || !B.ship.alive;
  const res: SeaDuel = {
    fight: Math.round((game.now - (c.first >= 0 ? c.first : t0)) * 10) / 10,
    total: Math.round((game.now - t0) * 10) / 10,
    sunk,
    balls: (c.balls.get(A.ship.id) ?? 0) + (c.balls.get(B.ship.id) ?? 0),
    hits: (c.hits.get(A.ship.id) ?? 0) + (c.hits.get(B.ship.id) ?? 0),
  };
  for (const s of [A.ship, B.ship]) if (game.ships.has(s.id)) game.removeShip(s.id);
  return res;
}

/** Median and 90th percentile. */
export function pct(xs: number[]): { med: number; p90: number } {
  const s = [...xs].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
  return { med: at(0.5), p90: at(0.9) };
}

let captains = 0;

/** A captain's ship of a hull and level on the duels' open water, auto-fire on (a phone's default), her crew full. */
export function seaCaptain(game: Game, cls: ShipClassId, level: number, x: number, y: number, h: number): PlayerSession {
  const name = `Sim Captain ${++captains}`;
  join(game, name);
  const s = game.sessionByName(name)!;
  const sh = s.ship!;
  sh.docked = null;
  s.profile!.docked = null;
  s.profile!.level = 60;
  sh.level = 60;
  onHull(game, sh, cls, level);
  sh.crew = sh.stats.crewMax;
  sh.morale = 80;
  sh.ammo.round = 999;
  sh.ammo.chain = 200;
  sh.ammo.grape = 200;
  sh.state.x = x;
  sh.state.y = y;
  sh.state.heading = h;
  sh.state.speed = 0;
  sh.protectedUntil = 0;
  s.autoFire = true;
  game.grid.upsert(sh.id, x, y);
  return s;
}

export interface CaptainRun {
  /** Seconds from «Атаковать» to the grapples in reach (board) or to her sunk (guns); -1 if never. */
  sec: number;
  balls: number;
  hits: number;
}

/** «Атаковать» on a bot of her own hull and level 700 m off, who fights back with the guns: `board` until the
 *  grapples would bite (canBoard says yes), `guns` until one of them is sunk. The captain's balls and hits counted. */
export function captainRun(game: Game, cls: ShipClassId, level: number, k: number, mode: 'board' | 'guns', maxSec = 120): CaptainRun {
  const at = openWater(game, k);
  const h = (k * 2.399) % (Math.PI * 2);
  const s = seaCaptain(game, cls, level, at.x, at.y, h);
  const me = s.ship!;
  const B = putSide(game, { cls, level, craft: 'bot' }, at.x + Math.sin(h + 1.3) * 700, at.y - Math.cos(h + 1.3) * 700, h + Math.PI);
  B.brain.role = 'hunter';
  // Both under way at a cruise, as ships meet at sea.
  for (const x of [me, B.ship]) {
    x.state.speed = x.stats.maxSpeed * 0.7;
    x.input = { rudder: 0, sailTarget: 0.75 };
  }
  const c = counter(game);
  const t0 = game.now;
  assert(startPursuit(game, s, B.ship.id, mode) === null);
  let next = 0, sec = -1;
  me.lastStandUntil = Infinity; // the sims' captain is never sent home: beaten to a plank, she has lost the run
  while (game.now - t0 < maxSec && me.alive && me.hull > 1 && B.ship.alive) {
    if (game.now >= next) {
      next = game.now + (B.brain.skill?.react ?? npcSkill(level).react);
      engage(game, B.ship, B.brain, me, Math.hypot(me.state.x - B.ship.state.x, me.state.y - B.ship.state.y));
    }
    game.step();
    if (mode === 'board' && canBoard(game, me, B.ship) === null) {
      sec = game.now - t0;
      break;
    }
  }
  if (mode === 'guns' && !B.ship.alive) sec = game.now - t0;
  c.stop();
  const res: CaptainRun = { sec: Math.round(sec * 10) / 10, balls: c.balls.get(me.id) ?? 0, hits: c.hits.get(B.ship.id) ?? 0 };
  stopPursuit(game, s, 'off');
  if (game.ships.has(B.ship.id)) game.removeShip(B.ship.id);
  me.lastStandUntil = 0;
  me.state.x = 1000 + captains * 50; // out of the way of the next duels
  me.docked = 'saltmarrow';
  return res;
}
