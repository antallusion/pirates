// Owner, 2026-10-16 (played in the Telegram Mini App): «у нпс корабля противника (моба) 15 юнг убили моих 21, это вообще
// норма? … это бред, где баланс-то?» His captain then: the 5th level on the Admiral's path (Attack 3, Defense 5, Armour
// at expert, Boarding basic), his first sloop still (⚓1), 21–26 deckhands. Two things together made it:
//  · the moment's lifts multiplied — a ship of the sea outnumbered fights with her backs to the rail (+40%), a blow from
//    behind +30%, luck ×2: ×3.6 on one blow, and 14 deckhands felled 11–18 of his 26 (luck no longer stacks on the
//    flank: TAC_LUCK_ALONE);
//  · his hull's ladder: a ⚓2 pirate (a captain of the 4th, a level below his) cut his men's blows to 0.7 (the deck now
//    stands at the ⚓ his level has earned against the sea: deckLadder).
// The very fight: his 21 deckhands against a ship of the sea's 15 deckhands, at ⚓1 and ⚓2, boarding and boarded.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';
import { aiAct, newBattle } from '../server/src/game/tacbattle.ts';
import { sideOf } from '../server/src/game/tactical.ts';
import { deckLadder, earnedShipLevel } from '../server/src/game/ladder.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame, onHull } from './helpers.ts';

/** The owner's captain as the prod record had him, on his ⚓1 sloop with `men` deckhands. */
function owner(game: Game, men: number): ShipEntity {
  join(game, 'Owner Probe', 'admiral');
  const s = game.sessionByName('Owner Probe')!;
  const p = s.profile!;
  p.level = 5;
  p.hero = { ...(p.hero ?? {}), prim: { atk: 3, def: 5, pow: 1, will: 1 }, primLv: 5, skills: [{ id: 'armor', r: 3 }, { id: 'boarding', r: 1 }], picked: 5, mana: 10, orders: ['iron_discipline', 'grenades', 'double_shot', 'war_cry'] } as typeof p.hero;
  if (p.tutorial) p.tutorial.on = false;
  const ship = s.ship!;
  if (ship.docked) game.undock(s);
  onHull(game, ship, 'sloop', 1);
  p.loadout = ship.loadout;
  ship.setArmy([{ u: 'deckhand', n: men }]);
  ship.crew = men;
  ship.morale = 60;
  return ship;
}

/** A pirate of the sea at ⚓`lv` on `cls`, her deckhands `deck` (the rest of her army as her level makes it, or none). */
function pirate(game: Game, me: ShipEntity, cls: ShipClassId, lv: number, deck: number, alone: boolean): ShipEntity {
  const npc = game.spawnNpcShip('pirate', cls, 'confederacy', me.state.x + 300, me.state.y, 0);
  game.setNpcLevel(npc, lv);
  const army: ArmyStack[] = alone ? [{ u: 'deckhand', n: deck }] : npc.army.map((x) => (x.u === 'deckhand' ? { u: x.u, n: deck } : { ...x }));
  npc.setArmy(army);
  npc.crew = army.reduce((n, x) => n + x.n, 0);
  return npc;
}

interface Run {
  win: number;
  lost: number;
  /** The most of his men one blow of the deckhands felled. */
  worst: number;
}

/** `n` boardings fought out by both minds; his side `mine`. */
function fights(game: Game, me: ShipEntity, npc: ShipEntity, boarding: boolean, n: number): Run {
  const a = boarding ? me : npc, b = boarding ? npc : me;
  const sa = sideOf(game, a, b, true), sb = sideOf(game, b, a, false);
  const mine = boarding ? 0 : 1;
  let win = 0, lost = 0, worst = 0;
  for (let k = 0; k < n; k++) {
    const rng = new Rng(4000 + k * 31);
    const bt = newBattle(sa, sb, k + 1, 0, rng, { len: 'board' });
    let seen = 0;
    for (let i = 0; i < 5000 && !bt.over && bt.active !== null; i++) {
      aiAct(bt, 0, rng);
      for (const e of bt.log) {
        if (e.i <= seen) continue;
        const st = bt.stacks.find((x) => x.id === e.s);
        if ((e.k === 'hit' || e.k === 'ret') && e.side !== mine && st?.unit === 'deckhand') worst = Math.max(worst, e.kills ?? 0);
      }
      seen = bt.log.at(-1)?.i ?? seen;
    }
    if (bt.over?.winner === mine) win++;
    lost += bt.stacks.filter((x) => x.side === mine).reduce((m, x) => m + x.start - x.count, 0);
  }
  return { win: win / n, lost: lost / n, worst };
}

test('a captain of the 5th has earned the ⚓2: on a deck against the sea his ⚓1 sloop is no junior to a ⚓2 crew (his guns keep the hull\'s ladder)', () => {
  assert.equal(earnedShipLevel(1), 1);
  assert.equal(earnedShipLevel(4), 2);
  assert.equal(earnedShipLevel(5), 2);
  assert.equal(earnedShipLevel(8), 3);
  const { game } = makeGame();
  const me = owner(game, 21);
  const p2 = pirate(game, me, 'cutter', 2, 15, true);
  assert.equal(deckLadder(game, me, p2), 1, 'his blows on the ⚓2 pirate\'s deck');
  assert.equal(deckLadder(game, p2, me), 1, 'theirs on his');
  // A ⚓3 is still above what he has earned: the junior's cut stands (a level, not two).
  const p3 = pirate(game, me, 'sloop', 3, 15, true);
  assert.ok(deckLadder(game, me, p3) < 1);
  // No senior's lift either: against a ⚓1 he strikes as a ⚓1.
  const p1 = pirate(game, me, 'cutter', 1, 15, true);
  assert.equal(deckLadder(game, me, p1), 1);
});

test('the owner\'s case: 15 deckhands of a ship of the sea against his 21 at ⚓1 and ⚓2 — they lose, and no blow of theirs fells more than ~60% of their own number', () => {
  const { game } = makeGame();
  const me = owner(game, 21);
  const out: string[] = [];
  for (const lv of [1, 2]) for (const alone of [true, false]) for (const boarding of [true, false]) {
    const npc = pirate(game, me, 'cutter', lv, 15, alone);
    const r = fights(game, me, npc, boarding, 60);
    const tag = `⚓${lv} ${alone ? 'deckhands×15' : npc.army.map((x) => `${x.u}×${x.n}`).join('+')} ${boarding ? 'boarded by him' : 'boarding him'}`;
    out.push(`${tag}: he wins ${Math.round(r.win * 100)}%, loses ${r.lost.toFixed(1)}/21, worst blow ${r.worst}`);
    // He wins (a ⚓2 crew with her musketeer, marine and sailor beside the fifteen still makes it a fight).
    assert.ok(r.win >= (alone ? 0.95 : 0.85), tag + `: he won ${Math.round(r.win * 100)}%`);
    // It costs him a share, not the deck: two in five at most at ⚓1, at most seven in ten against the whole ⚓2 crew.
    assert.ok(r.lost <= 21 * (lv === 1 ? 0.4 : alone ? 0.5 : 0.7), tag + `: he lost ${r.lost.toFixed(1)} of 21`);
    // No absurd blow: the fifteen never fell more than 60% of their own number of his in one blow (luck and all).
    assert.ok(r.worst <= Math.ceil(15 * 0.6), tag + `: one blow felled ${r.worst}`);
    game.removeShip(npc.id);
  }
  if (process.env.SHOW) console.log(out.join('\n'));
});
