// The QA playthrough A (docs/30_PLAYTHROUGH_A.md): one new captain from the first screen, the faults found on the way.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recruitCost } from '../server/src/game/crew.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';

test('a level gained on the quay sends the port again: the price per man shown is the one the hire takes', () => {
  const { game } = makeGame();
  const conn = join(game, 'Quay');
  const s = [...game.sessions].find((x) => x.name === 'Quay')!;
  assert.ok(s.ship!.docked, 'a new captain begins in port');
  const port = game.portById(s.ship!.docked!)!;
  const before = conn.all('port').length;
  game.grantXp(s, 400, null);
  assert.ok(s.profile!.level >= 2);
  const v = conn.last('port')?.view;
  assert.ok(conn.all('port').length > before && v, 'the port window is sent again');
  assert.equal(v.crewHireCost, recruitCost(game, port, s.profile!, 'sailor', s.ship), 'the price the hire takes');
  const gold = s.profile!.gold;
  conn.push({ t: 'hire', qty: 2 } as never);
  if (s.profile!.gold !== gold) assert.equal(gold - s.profile!.gold, 2 * v.crewHireCost, 'two men at the price shown');
});

test('the First Watch loses nothing in a boarding thrown back: the hold, the chest and the men stay hers, the soft card', () => {
  const { game } = makeGame();
  const conn = new FakeConn();
  game.attach(conn as never);
  conn.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Pupil' });
  conn.push({ t: 'create_captain', captain: 'corsair', shipName: 'Test Wake', tutorial: true } as never);
  const s = [...game.sessions].find((x) => x.name === 'Pupil')!;
  const ship = s.ship!;
  assert.ok(s.profile!.tutorial.on, 'a new captain is in the First Watch');
  steps(game, 25); // the watch notes her men on the quay
  const men = ship.crew, gold = s.profile!.gold;
  ship.cargo = { rum: 6 };
  const foe = game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x + 40, ship.state.y, 0);
  ship.setArmy([{ u: 'deckhand', n: 2 }]);
  game.boardingLost(ship, foe, men - 2, true);
  assert.equal(s.profile!.gold, gold, 'the chest is hers');
  assert.equal(ship.cargo.rum, 6, 'the hold is hers');
  assert.equal(ship.crew, men, 'her men come back');
  const card = conn.last('sunk_self')!;
  assert.ok(card.towed && !card.boarded, 'the First Watch\'s soft card');
  // an old hand loses what the sea takes
  s.profile!.tutorial.on = false;
  ship.cargo = { rum: 6 };
  game.boardingLost(ship, foe, 1, true);
  assert.ok(!ship.cargo.rum && s.profile!.gold < gold, 'out of the First Watch the victors take the hold and a share of the chest');
});

test('every quest giver has a face drawn: a profession of one sex in the art takes the nearest face of the same sex', async () => {
  const { existsSync } = await import('node:fs');
  const { giverPortrait } = await import('../shared/src/data/questgen.ts');
  const profs = ['harbour_master', 'fishwife', 'shipwright', 'priest', 'widow', 'merchant', 'smuggler', 'old_salt', 'apothecary', 'cartographer', 'garrison_captain', 'tavern_keeper', 'pearl_diver', 'fence', 'envoy', 'hermit', 'bosun', 'lighthouse_keeper', 'whaler', 'cultist'] as const;
  const { GIVER_WOMEN, GIVER_MEN } = await import('../shared/src/data/questgen.ts');
  for (const p of profs) for (const who of [`${GIVER_WOMEN[0]} X`, `${GIVER_MEN[0]} X`]) {
    const id = giverPortrait(p, who);
    assert.ok(existsSync(`assets/portraits/${id}.webp`), `${p} / ${who}: ${id}`);
  }
});

test('Russian typesetting: a server name already in quotes is not quoted twice by the template', async () => {
  const { typeset } = await import('../client/src/i18n.ts');
  assert.equal(typeset('Команда ««Чёрный часовой»» обобрала её'), 'Команда «Чёрный часовой» обобрала её');
  assert.equal(typeset('На месте: «Логова вод «Чёрное побережье»».'), 'На месте: «Логова вод «Чёрное побережье»».', 'quotes in quotes stay');
});

test('a crew with no heart for boarding: «Атаковать» to board turns to the guns, said, not grinding alongside her', async () => {
  const { startPursuit, pursuitOf, GUNS_INSTEAD } = await import('../server/src/game/pursuit.ts');
  const { duelSea, openWater, putSide } = await import('./balance/duel.ts');
  const { seaCaptain } = await import('./balance/seafight.ts');
  const game = duelSea();
  const at = openWater(game, 40);
  const s = seaCaptain(game, 'sloop', 3, at.x, at.y, 0);
  const ship = s.ship!;
  const B = putSide(game, { cls: 'sloop', level: 3, craft: 'bot' }, at.x + 60, at.y, Math.PI);
  ship.morale = 5;
  assert.equal(startPursuit(game, s, B.ship.id, 'board'), null);
  for (let i = 0; i < 60 && pursuitOf(ship)?.mode === 'board'; i++) {
    ship.morale = 5;
    game.step();
  }
  assert.equal(pursuitOf(ship)?.mode, 'guns', 'the pursuit turned to the guns');
  const msgs = (s.conn as unknown as FakeConn).all('toast').map((t) => t.msg);
  assert.ok(msgs.includes(GUNS_INSTEAD), 'and said so');
  assert.ok(msgs.some((m) => /no stomach/.test(m)), 'with the reason');
});
