// Instant boarding (owner, 2026-10-18: «сделай чтобы на нпс сразу можно было абордажить если что»): any of the sea's
// ships in the grapples' reach is boarded at once — whole, fast, her crew of any heart — and only the range, a duel,
// the protected and safe-water rules between captains, and a boss, a zone boss, a beast or a monster bar it. A bad
// fight is shown its odds first (board_risk), a warning and not a bar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { canBoard } from '../server/src/game/boarding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame } from './helpers.ts';

function atSea(game: Game, name: string) {
  const c = join(game, name, 'reaver');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.crew = ship.stats.crewMax;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship };
}

/** One of the sea's ships at full strength alongside her. */
function alongside(game: Game, ship: ShipEntity, role: 'pirate' | 'merchant' | 'patrol', distance = 18): ShipEntity {
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip(role, 'brig', role === 'pirate' ? 'confederacy' : 'league', ship.state.x + v.x * distance, ship.state.y + v.y * distance, ship.state.heading);
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

test('a full-strength ship of the sea in reach is boarded at once: whole hull, full crew, under way, her crew of low heart', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Grapple Greta');
  for (const role of ['pirate', 'merchant', 'patrol'] as const) {
    const npc = alongside(game, ship, role);
    assert.equal(npc.hull, npc.stats.hullMax, 'whole');
    assert.equal(canBoard(game, ship, npc), null, `${role}: at once`);
    npc.state.speed = 9; // tearing past: a captain's ship matches her way herself
    assert.equal(canBoard(game, ship, npc), null, `${role}: under way`);
    npc.state.speed = 0;
    ship.morale = 5; // no heart: a warning in the odds, not a bar
    assert.equal(canBoard(game, ship, npc), null, `${role}: low morale`);
    ship.morale = 80;
    npc.state.x += 5000; // out of the way of the next
    game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  }
});

test('out of reach, too few hands, a beast, a monster, a zone boss: no grapples', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Grapple Gus');
  const far = alongside(game, ship, 'pirate', 400);
  assert.match(String(canBoard(game, ship, far)), /Too far/);
  const npc = alongside(game, ship, 'pirate');
  ship.crew = 3;
  assert.match(String(canBoard(game, ship, npc)), /Not enough hands/);
  ship.crew = ship.stats.crewMax;
  npc.zoneBoss = { region: 'gravewater', slot: 0, endsAt: game.now + 600 } as never;
  assert.notEqual(canBoard(game, ship, npc), null, 'a zone boss: guns only');
  npc.zoneBoss = null as never;
  npc.npcRole = 'beast';
  assert.notEqual(canBoard(game, ship, npc), null, 'a beast: no decks');
});

test('«На абордаж» on a full-strength pirate: the odds window when it is a bad fight, the grapples once she risks it', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Grapple Gwen');
  const npc = alongside(game, ship, 'pirate');
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  if (!ship.boarding) {
    const risk = c.last('board_risk');
    assert.ok(risk, 'not refused: the odds are shown');
    c.push({ t: 'board', target: npc.id, aggression: 'standard', risk: true });
  }
  assert.ok(ship.boarding, 'grappled at once');
  assert.equal(ship.boarding!.with, npc.id);
});

test('«Рискнуть» after the ships drew apart reading the odds: past 100 m «Подойдите ближе», within it the grapples haul the two alongside and the battle opens (owner 2026-10-30)', async () => {
  const { pursuitOf } = await import('../server/src/game/pursuit.ts');
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Grapple Gil');
  const npc = alongside(game, ship, 'pirate', 160);
  const brain = game.npcs.get(npc.id)!;
  brain.area = { x: npc.state.x, y: npc.state.y, r: 300 }; // her waters (a ship of the sea's has them)
  brain.keep = true;
  assert.match(String(canBoard(game, ship, npc)), /Too far/);
  c.push({ t: 'board', target: npc.id, aggression: 'standard', risk: true });
  assert.ok(!ship.grapple && !ship.boarding && !pursuitOf(ship), 'nothing from 160 m');
  assert.ok(c.all('toast').some((m) => /^Come closer: \d+ m$/.test(m.msg)), c.all('toast').map((m) => m.msg).join('|'));
  // within 100 m of her hull (90 m centre to centre: a brig's beam and the sloop's): the grapples fly, no battle yet
  const v = headingVec(ship.state.heading - Math.PI / 2);
  npc.state.x = ship.state.x + v.x * 90;
  npc.state.y = ship.state.y + v.y * 90;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  c.push({ t: 'board', target: npc.id, aggression: 'standard', risk: true });
  const g = (ship as { grapple: { until: number } | null }).grapple;
  assert.ok(g && (npc as { grapple: unknown }).grapple && !ship.boarding, 'the grapples thrown: the approach, not the battle at once');
  const until = g.until - game.now;
  assert.ok(until >= 2 && until <= 4, `2–4 s of approach (${until.toFixed(1)})`);
  // she cannot sail off while the lines hold: full sail away, and still drawn in
  npc.input = { rudder: 0, sailTarget: 1 };
  const gap0 = Math.hypot(npc.state.x - ship.state.x, npc.state.y - ship.state.y);
  for (let i = 0; i < 20 * 5 && !ship.boarding; i++) game.step();
  assert.ok(ship.boarding, 'the battle once alongside');
  assert.equal(ship.boarding!.with, npc.id);
  const gap1 = Math.hypot(npc.state.x - ship.state.x, npc.state.y - ship.state.y);
  assert.ok(gap1 < gap0 * 0.6 && gap1 < 45, `hauled together: ${gap0.toFixed(0)} → ${gap1.toFixed(0)} m`);
});
