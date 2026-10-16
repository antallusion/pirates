// Owner, 2026-10-16: «задания … можно брать сколько угодно, главное своего диапазона уровня. то есть в последних там
// локациях корабль 1 взять ничего не сможет»; «переходя на остров корабль должен останавливаться»; «причаливание и
// отплытие по кнопкам только сделать, чтобы с территории меня автоматом в гавань не портовало».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PORT_DOCK_RADIUS } from '../shared/src/constants.ts';
import { sectorAt } from '../shared/src/world/sectors.ts';
import { LEVEL_RANGE, shipLevelOf } from '../shared/src/data/shiplevel.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { buildPortView } from '../server/src/game/ports.ts';
import { MAX_ACTIVE_QUESTS, questBand, questBandBlocked, questsUnderWay } from '../server/src/game/quests.ts';
import { autosailOf } from '../server/src/game/autosail.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

function captain(game: Game, name: string, level = 10) {
  const c = join(game, name, 'corsair');
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = level;
  s.profile!.gold = 1e6;
  return { c, s, p: s.profile! };
}

function dockAt(game: Game, s: PlayerSession, id: string) {
  const port = game.portById(id)!;
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  return port;
}

/** Her ship at a ⚓ (a hull whose ladder reaches it). */
function shipAt(game: Game, s: PlayerSession, level: number): void {
  const cls = (Object.entries(LEVEL_RANGE) as [ShipClassId, [number, number]][]).find(([, r]) => r[0] <= level && r[1] >= level)![0];
  onHull(game, s.ship!, cls, level);
  s.profile!.loadout = s.ship!.loadout;
  assert.equal(shipLevelOf(s.profile!.loadout), level);
}

const lowPorts = (game: Game) => game.world.ports.filter((pt) => sectorAt(game.world, pt.x, pt.y).level === 1).map((pt) => pt.id);
const highPort = (game: Game) => game.world.ports.find((pt) => sectorAt(game.world, pt.x, pt.y).level >= 8)!;

test('no cap of five: a captain takes every quest of her band the boards offer — six and more, all in her journal', () => {
  const { game } = makeGame();
  const { c, s, p } = captain(game, 'Many');
  for (const id of lowPorts(game)) {
    const port = dockAt(game, s, id);
    for (const o of buildPortView(game, s, port).questOffers) if (!o.blocked) c.push({ t: 'quest', action: 'accept', id: o.id });
    if (questsUnderWay(p) >= 8) break;
  }
  assert.ok(questsUnderWay(p) >= 8, `took ${questsUnderWay(p)}`);
  assert.ok(MAX_ACTIVE_QUESTS >= 50, 'only a ceiling against a runaway ledger');
  game.pushSelf(s, true);
  const self = c.last('self')!.self;
  assert.deepEqual(self.quests.map((q) => q.id).sort(), p.quests.active.map((a) => a.id).sort(), 'every one of them goes to the journal');
  assert.ok(!c.all('toast').some((t) => /At most \d+ quests/.test(t.msg)));
});

test('the band: a ⚓1 ship in the last waters can take nothing there, and the card says why', () => {
  const { game } = makeGame();
  const { c, s, p } = captain(game, 'Low', 60);
  const port = dockAt(game, s, highPort(game).id);
  const v = buildPortView(game, s, port);
  assert.ok(v.questOffers.length > 0);
  for (const o of v.questOffers.filter((x) => QUESTS_BY_ID[x.id]?.kind === 'job')) {
    assert.match(o.blocked ?? '', /^Not your level: ⚓\d+–\d+$/, o.id);
    assert.ok(o.band && o.band[0] > 1, 'the band is on the card');
  }
  for (const k of v.contracts) assert.match(k.blocked ?? '', /^Not your level: ⚓/);
  const job = v.questOffers.find((x) => QUESTS_BY_ID[x.id]?.kind === 'job')!;
  c.push({ t: 'quest', action: 'accept', id: job.id });
  assert.equal(p.quests.active.length, 0);
  if (v.contracts[0]) {
    c.push({ t: 'contract', action: 'accept', id: v.contracts[0].id });
    assert.equal(p.contracts.length, 0, 'nor a contract of the port');
  }
  // the same captain on a ship of the waters' band takes it
  const band = questBand(game, QUESTS_BY_ID[job.id]);
  shipAt(game, s, band[0]);
  assert.equal(questBandBlocked(game, p, QUESTS_BY_ID[job.id]), null);
});

test('above the band: a job of the first waters is not for a ⚓6 ship; a Path or a story stays hers to take', () => {
  const { game } = makeGame();
  const { s, p } = captain(game, 'High', 40);
  shipAt(game, s, 6);
  const port = dockAt(game, s, 'gravesend');
  const v = buildPortView(game, s, port);
  const jobs = v.questOffers.filter((o) => QUESTS_BY_ID[o.id]?.kind === 'job' && o.band![1] < 6);
  assert.ok(jobs.length && jobs.every((o) => /^Not your level/.test(o.blocked ?? '')));
  const story = v.questOffers.filter((o) => QUESTS_BY_ID[o.id]?.kind !== 'job');
  for (const o of story) assert.ok(!/^Not your level/.test(o.blocked ?? ''), o.id);
  void p;
});

test('no auto-dock: sailing through a harbour\'s waters leaves her at sea; «Причалить» docks her, «В море» puts her out past the mouth', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Harbour');
  const port = game.portById('saltmarrow')!;
  c.push({ t: 'undock' });
  const ship = s.ship!;
  assert.equal(ship.docked, null);
  // put out past the quays, her head to the sea, with way on
  const out = Math.hypot(ship.state.x - port.x, ship.state.y - port.y);
  assert.ok(out >= 60 && out < PORT_DOCK_RADIUS, `${out}`);
  assert.ok(ship.state.speed >= 3 && ship.state.sail > 0);
  // in the harbour's reach, slow, for a long while: still at sea
  ship.state.x = port.x + 150;
  ship.state.y = port.y;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.state.speed = 0;
  steps(game, 100);
  assert.equal(ship.docked, null, 'nothing docks her but the button');
  // the button
  ship.state.x = port.x + 150;
  ship.state.y = port.y;
  ship.state.speed = 0;
  c.push({ t: 'dock' });
  assert.equal(ship.docked, port.id);
  assert.ok(c.last('port')?.view, 'the harbour opens');
  c.push({ t: 'undock' });
  assert.equal(ship.docked, null);
  assert.equal(c.last('port')?.view, null);
});

test('the island screen stops her: sails down, no way on, the helmsman\'s course dropped', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Isle');
  c.push({ t: 'undock' });
  steps(game, 5);
  const ship = s.ship!;
  c.push({ t: 'input', seq: 1, rudder: 0, sail: 3 });
  c.push({ t: 'autosail', x: Math.round(ship.state.x + 3000), y: Math.round(ship.state.y) });
  steps(game, 40);
  assert.ok(ship.state.speed > 1);
  c.push({ t: 'halt' });
  assert.equal(ship.state.speed, 0);
  assert.equal(ship.state.sail, 0);
  assert.equal(ship.input.sailTarget, 0);
  assert.equal(autosailOf(ship), null, 'the helmsman lets go');
  // the idle helm's beat after it (sail 0) keeps her still
  c.push({ t: 'input', seq: 2, rudder: 0, sail: 0 });
  steps(game, 40);
  assert.ok(ship.state.speed < 0.5, `${ship.state.speed}`);
  // in port it changes nothing
  const port = dockAt(game, s, 'saltmarrow');
  c.push({ t: 'halt' });
  assert.equal(ship.docked, port.id);
});

test('no cap of three contracts: a captain holds every contract of her band she takes; the Broker pays +10% a rank', async () => {
  const { MAX_CONTRACTS, brokerPay } = await import('../server/src/game/Game.ts');
  const { game } = makeGame();
  const { c, s, p } = captain(game, 'Courier');
  for (const id of lowPorts(game)) {
    const port = dockAt(game, s, id);
    for (const k of buildPortView(game, s, port).contracts) if (!k.blocked) c.push({ t: 'contract', action: 'accept', id: k.id });
    if (p.contracts.length >= 6) break;
  }
  assert.ok(p.contracts.length >= 6, `held ${p.contracts.length}`);
  assert.ok(!c.all('toast').some((t) => /at most \d+ contracts/.test(t.msg)));
  assert.ok(MAX_CONTRACTS >= 50);
  assert.deepEqual([brokerPay(0), brokerPay(1), brokerPay(2)].map((x) => Math.round(x * 100)), [100, 110, 120]);
});
