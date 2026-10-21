// Owner, 2026-10-22: «квест на нападение. там горела атака и я плыл к кораблю, но чтобы атаковать надо было выделить цель,
// и нажать на корабль а не на кнопку атаки (круглую)». The round «Огонь» with no mark of hers takes the best foe —
// her quest's ship, else the nearest at war with her — and the helmsman lays the guns on it; with nobody in sight it
// says so. The opening's «Первый залп» is done by that button alone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICK_RATE } from '../shared/src/constants.ts';
import { campaignFoes } from '../server/src/game/campaign.ts';
import { NO_FOE, fireFoe, pursuitOf } from '../server/src/game/pursuit.ts';
import { SERVER_RU_BATTLE } from '../client/src/lang/server.ru.battle.ts';
import { join, makeGame } from './helpers.ts';

test('the opening’s «Первый залп» is done by the round «Огонь» alone — no tap on the ship', () => {
  const { game } = makeGame();
  const conn = join(game, 'Roundy', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Roundy')!;
  const p = s.profile!;
  const ship = () => s.ship!;
  const run = (sec: number) => {
    for (let i = 0; i < sec * TICK_RATE; i++) game.step();
  };
  const until = (cond: () => boolean, sec: number, what: string) => {
    for (let i = 0; i < sec * TICK_RATE && !cond(); i++) game.step();
    assert.ok(cond(), what);
  };
  // the shops (as tests/opening.test.ts)
  const good = (Object.entries(game.markets.get('saltmarrow')!.goods) as [string, { stock: number }][]).map(([g]) => g).find((g) => !['provisions', 'sailcloth', 'planks', 'timber', 'tar'].includes(g) && (game.markets.get('saltmarrow')!.goods[g as 'rum']?.stock ?? 0) > 1)!;
  for (const m of [{ t: 'trade', good: 'provisions', qty: 1 }, { t: 'trade', good: 'sailcloth', qty: 1 }, { t: 'hire_crew', qty: 1, prof: 'sailor' }, { t: 'trade', good, qty: 1 }] as const) {
    conn.push(m as never);
    run(15);
  }
  assert.equal(p.campaign!.at, 1, 'the shops done');
  conn.push({ t: 'undock' });
  run(2);
  conn.push({ t: 'goto', key: 'q:c01_02' });
  const foe = () => campaignFoes(game, s).map((id) => game.ships.get(id)!).find((o) => o?.alive && Math.hypot(o.state.x - ship().state.x, o.state.y - ship().state.y) < 1400);
  until(() => !!foe(), 240, 'a wreckers’ tender comes');
  const first = foe()!;
  // her screen marks it a foe (the target frame takes it by itself, «Огонь» shows)
  assert.ok(game.isHostile(first, ship()), 'the tender sent for her is at war with her, even in the Crown’s quiet water');
  // only the round button, pressed now and then as a player would — never a tap on the ship
  let presses = 0;
  for (let i = 0; i < 240 * TICK_RATE && p.campaign!.at < 2; i++) {
    if (i % (2 * TICK_RATE) === 0) {
      conn.push({ t: 'volley' });
      presses++;
      if (presses === 1) assert.equal(pursuitOf(ship())?.target, first.id, 'the first press lays her guns on the tender');
    }
    game.step();
  }
  assert.equal(p.campaign!.at, 2, `the tender sunk by «Огонь» alone (${presses} presses; ${conn.all('toast').slice(-3).map((e) => e.msg).join('; ')})`);
});

test('«Огонь» with no foe in sight says so; and the words are Russian too', () => {
  const { game } = makeGame();
  const conn = join(game, 'Lonely', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Lonely')!;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  conn.push({ t: 'undock' });
  for (let i = 0; i < 40; i++) game.step();
  assert.equal(fireFoe(game, s), null);
  conn.push({ t: 'volley' });
  assert.equal(conn.last('toast')?.msg, NO_FOE, 'said in words (a toast), not a buzz');
  assert.ok(SERVER_RU_BATTLE[NO_FOE] && !/[A-Za-z]/.test(SERVER_RU_BATTLE[NO_FOE]));
});
