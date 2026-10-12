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

test('the helmsman sails on past a shoal of sharks that do not come for her; one that does gives the wheel back', async () => {
  const { autosailDanger } = await import('../server/src/game/autosail.ts');
  const { beastBrain, spawnBeast } = await import('../server/src/game/beasts.ts');
  const { duelSea, openWater } = await import('./balance/duel.ts');
  const { seaCaptain } = await import('./balance/seafight.ts');
  const game = duelSea();
  const at = openWater(game, 41);
  const s = seaCaptain(game, 'sloop', 5, at.x, at.y, 0);
  const ship = s.ship!;
  const sharks = [0, 1, 2].map((k) => spawnBeast(game, 'shark', at.x + 300 + k * 120, at.y + 200, 1));
  const brain = (id: number) => beastBrain(game, id) as { target: number | null };
  for (const sh of sharks) { brain(sh.id).target = null; game.grid.upsert(sh.id, sh.state.x, sh.state.y); }
  assert.equal(autosailDanger(game, s, ship, game.now), null, 'a shoal about, none hunting her');
  brain(sharks[0].id).target = ship.id;
  assert.equal(autosailDanger(game, s, ship, game.now), 'hostile', 'one comes for her');
});

test('a job\'s goods lost with the hold: the job goes back to taking them on, and says where', async () => {
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const { questCargoLost } = await import('../server/src/game/quests.ts');
  const { game } = makeGame();
  const conn = join(game, 'Courier');
  const s = game.sessionByName('Courier')!;
  const q = Object.values(QUESTS_BY_ID).find((x) => x.steps.some((st, i) => st.type === 'deliver' && x.steps.slice(0, i).some((y) => y.type === 'pickup' && y.good === st.good)))!;
  assert.ok(q, 'a job with goods to take on and deliver');
  const di = q.steps.findIndex((st) => st.type === 'deliver');
  const pi = q.steps.findIndex((st) => st.type === 'pickup');
  s.profile!.quests.active.push({ id: q.id, step: di, progress: 0, startedAt: game.now });
  s.ship!.cargo = {};
  questCargoLost(game, s);
  assert.equal(s.profile!.quests.active.find((a) => a.id === q.id)!.step, pi, 'back to the pickup');
  assert.ok(conn.all('toast').some((t) => /is lost: take it on again at/.test(t.msg)), 'said where');
});

test('a lair job\'s mark: a lair under a harbour\'s quays is the last pick (the run ended between the piers, on the rocks)', async () => {
  const { lairList, lairPos } = await import('../server/src/game/beastlairs.ts');
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const { game } = makeGame();
  join(game, 'Lairs');
  const s = game.sessionByName('Lairs')!;
  const quayside = lairList(game).find((l) => { const q = game.nearestPort(l.x, l.y); return !!q && Math.hypot(q.x - l.x, q.y - l.y) < 700; });
  assert.ok(quayside, 'a lair under a harbour in this world');
  const q = Object.values(QUESTS_BY_ID).find((x) => x.steps[0]?.type === 'lair' && x.steps[0].island === undefined && !x.steps[0].kind)!;
  assert.ok(q, 'a lair job of any island');
  s.profile!.quests.active.push({ id: q.id, step: 0, progress: 0, startedAt: game.now });
  const at = lairPos(game, quayside!);
  s.ship!.docked = null;
  s.ship!.state = { ...s.ship!.state, x: at.x + 50, y: at.y };
  const t = game.questTargets(s)[q.id];
  assert.ok(t, 'a mark');
  assert.ok(Math.hypot(t.x - at.x, t.y - at.y) > 10, 'not the harbour\'s own lair while another stands');
});

test('money at ⚓1–2 (docs/30): shot never past the market cap, a small hull\'s repairs cheaper, a green captain\'s hands cheaper', async () => {
  const { AMMO } = await import('../shared/src/data/ships.ts');
  const { AMMO_MARKET_CAP, ammoPrice, repairCost, repairLowMul } = await import('../server/src/game/ports.ts');
  const { recruitCost } = await import('../server/src/game/crew.ts');
  const { game } = makeGame();
  for (const port of game.world.ports) {
    const r = ammoPrice(game, port, 'round');
    assert.ok(r <= AMMO.round.price * AMMO_MARKET_CAP + 0.05, `${port.id}: round shot ${r}`);
  }
  join(game, 'Purse');
  const s = game.sessionByName('Purse')!;
  const ship = s.ship!;
  ship.hull = ship.stats.hullMax - 300;
  const lv1 = repairCost(ship);
  assert.equal(repairLowMul(1), 0.6);
  assert.equal(repairLowMul(5), 1);
  assert.ok(lv1 <= 0.6 * 300 * (0.45 + ship.cls.tier * 0.1) + 1, `300 hull on a ⚓1 sloop: ${lv1}`);
  const port = game.portById(ship.docked!)!;
  const p = s.profile!;
  const at = (L: number) => { p.level = L; return recruitCost(game, port, p, 'sailor', ship); };
  assert.ok(at(1) < at(5) && at(5) < at(10), 'hands dearer as she rises');
  assert.ok(at(7) <= 32, `a man at 7: ${at(7)}`);
  assert.equal(at(12) - at(10), 3, 'from 10 on, the old rise of 1.5 a level');
});

test('a race taken in port: its clock starts when she casts off, and its time is a starter sloop’s run (docs/30)', async () => {
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const { RACE_KNOTS } = await import('../shared/src/data/questgen.ts');
  const { SPEED_SCALE } = await import('../shared/src/constants.ts');
  const { acceptQuest, questEvent } = await import('../server/src/game/quests.ts');
  const { buildPortView } = await import('../server/src/game/ports.ts');
  const { game } = makeGame();
  const conn = join(game, 'Racer');
  const s = game.sessionByName('Racer')!;
  s.profile!.level = 6;
  let q = null as (typeof QUESTS_BY_ID)[string] | null, from: ReturnType<typeof game.portById> = undefined;
  for (const port of game.world.ports.filter((x) => x.region === 'black_coast')) {
    (game as unknown as { refitAndDock(a: unknown, b: unknown, c: unknown): void }).refitAndDock(s, s.ship, port);
    const offer = buildPortView(game, s, port).questOffers.find((o) => QUESTS_BY_ID[o.id]?.steps[0]?.type === 'race' && !o.blocked);
    if (offer) { q = QUESTS_BY_ID[offer.id]; from = port; break; }
  }
  assert.ok(q && from, 'a race on a board of the Black Coast');
  const st = q!.steps[0];
  assert.ok(st.type === 'race');
  const to = game.portById(st.port)!;
  const run = Math.hypot(to.x - from!.x, to.y - from!.y) / (RACE_KNOTS * SPEED_SCALE);
  assert.ok(st.seconds >= run, `${st.seconds} s for a run of ${Math.round(run)} s at ${RACE_KNOTS} kn`);
  assert.equal(acceptQuest(game, s, from!, q!.id), null);
  game.now += st.seconds + 100; // a long time buying stores on the quay
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.ok(s.profile!.quests.active.some((a) => a.id === q!.id), 'the clock does not run in port');
  s.ship!.docked = null;
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.ok(conn.all('toast').some((t) => /The race is on/.test(t.msg)), 'the start said');
  game.now += st.seconds + 1;
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.ok(!s.profile!.quests.active.some((a) => a.id === q!.id), 'out of time at sea: lost');
});

test('lairs beside a harbour stand on their island\'s far side, not under its quays (docs/30)', async () => {
  const { lairList } = await import('../server/src/game/beastlairs.ts');
  const { game } = makeGame();
  const close = lairList(game).filter((l) => { const q = game.nearestPort(l.x, l.y); return l.island >= 0 && !!q && Math.hypot(q.x - l.x, q.y - l.y) < 300; });
  assert.ok(close.length < 50, `lairs within 300 m of a harbour: ${close.length} (were 109)`);
});
