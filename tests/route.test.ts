// Route (owner, 2026-10-15): «нажимая на цель из журнала я должен плыть к ближайшей точке выполнения, будь это квест
// потопить кого-то, цель капитана или промысел. ввообще все должно меня вести автоматом к ближайшей подходящей точке.»
// The server resolves a goal's key to its nearest place (goalroute.ts) and the helmsman takes her there; a ship it
// follows sunk or gone gives way to the next; the goal met ends the run; no place — a toast that says why.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import type { QuestDef } from '../shared/src/data/quests.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { autosailOf, stopAutosail } from '../server/src/game/autosail.ts';
import { ROUTE_HINTS, ROUTE_WORDS, ROUTE_VIEW, gotoGoal, pickNearest, resolveGoal, routeFor, routeOf } from '../server/src/game/goalroute.ts';
import { shoalHere } from '../server/src/game/fishing.ts';
import { worldGoals } from '../server/src/game/worldgoals.ts';
import { openSea } from '../server/src/game/wrecks.ts';
import { seaField, fieldDist } from '../server/src/game/nav.ts';
import { RouteRun } from '../client/src/ui/goalrun.ts';
import { SERVER_RU_ROUTE } from '../client/src/lang/server.ru.route.ts';
import { EN as ROUTE_EN, RU as ROUTE_RU } from '../client/src/lang/ui/route.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

function captain(game: Game, name: string, level = 20): { s: PlayerSession; c: FakeConn } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const p = s.profile!;
  p.gold = 1000;
  p.level = level;
  if (p.tutorial) p.tutorial.on = false;
  onHull(game, s.ship!, 'brig', 4);
  runAdmin(game, s, '/tp gravewater');
  const ship = s.ship!;
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  return { s, c };
}

/** Puts her on open water (searching about where she is). */
function atSea(game: Game, s: PlayerSession): { x: number; y: number } {
  const ship = s.ship!;
  const x0 = ship.state.x, y0 = ship.state.y;
  for (let r = 0; r < 30; r++) {
    for (let a = 0; a < 8; a++) {
      const x = x0 + Math.cos(a) * r * 500, y = y0 + Math.sin(a) * r * 500;
      if (openSea(game, x, y) && openSea(game, x + 1500, y) && openSea(game, x - 1500, y)) {
        ship.docked = null;
        ship.state = { ...ship.state, x, y, speed: 0 };
        game.grid.upsert(ship.id, x, y);
        return { x, y };
      }
    }
  }
  throw new Error('no open water');
}

function give(game: Game, s: PlayerSession, id: string, step: QuestDef['steps'][number]): void {
  QUESTS_BY_ID[id] = { id, kind: 'job', name: `Test ${id}`, mentor: 'Tester', port: 'gravewater', summary: '', requires: {}, steps: [step], reward: { xp: 1, silver: 1 } };
  s.profile!.quests.active.push({ id, step: 0, progress: 0, startedAt: game.now });
}

const view = (r: ReturnType<typeof routeFor>) => {
  assert.ok(!('done' in r) && !('none' in r), `a place: ${JSON.stringify(r)}`);
  return r as Exclude<typeof r, { done: true } | { none: string }>;
};

test('a hunt (sink pirates): the nearest pirate in sight; she sinks and the run takes the next; no more in sight — the waters they sail', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Hunt Hana');
  const at = atSea(game, s);
  give(game, s, 'rt_sink', { type: 'sink', count: 3, role: 'pirate', text: 'Sink pirates.' });
  const near = game.spawnNpcShip('pirate', 'brig', 'confederacy', at.x + 1500, at.y, 0);
  const far = game.spawnNpcShip('pirate', 'brig', 'confederacy', at.x - 3500, at.y, 0);
  game.spawnNpcShip('merchant', 'brig', 'league', at.x + 600, at.y, 0); // a merchant nearer still is not the goal
  for (const o of game.ships.values()) game.grid.upsert(o.id, o.state.x, o.state.y);
  const v = view(routeFor(game, s, 'q:rt_sink'));
  assert.equal(v.kind, 'ships');
  assert.equal(v.ship, near.id, 'the nearest pirate');
  // the tap: the helmsman takes her there, the run is on
  c.push({ t: 'goto', key: 'q:rt_sink' });
  assert.equal(routeOf(game, s)?.view.ship, near.id);
  assert.ok(autosailOf(s.ship!), 'the helmsman has the wheel');
  assert.equal(c.last('route')?.on, true);
  // she sinks: the run takes the next nearest
  game.removeShip(near.id);
  steps(game, 3);
  assert.equal(routeOf(game, s)?.view.ship, far.id, 're-targeted to the next pirate');
  assert.ok(c.all('toast').some((m) => m.msg === ROUTE_WORDS.retarget));
  // none left in sight: the waters pirates put out in (never the Crown's)
  game.removeShip(far.id);
  for (const o of game.ships.values()) if (!o.isPlayer && o.npcRole === 'pirate') game.removeShip(o.id);
  const w = view(routeFor(game, s, 'q:rt_sink'));
  assert.equal(w.kind, 'region');
  assert.notEqual(REGIONS[game.regionAt(w.x, w.y)].safety, 'safe');
  // the goal met: the run ends and says so
  s.profile!.quests.active = s.profile!.quests.active.filter((q) => q.id !== 'rt_sink');
  s.profile!.quests.done.push('rt_sink');
  steps(game, 50);
  assert.equal(routeOf(game, s), null);
  assert.equal(c.last('route')?.why, 'done');
});

test('«Потопить корабли Хора» (the sea’s goal): the Choir’s ships in sight, else its invasion, else its waters', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Choir Chloe');
  const at = atSea(game, s);
  const wg = worldGoals(game);
  wg.goals = [{ id: 77, kind: 'choir', target: 450, port: null, progress: 0, hands: {}, names: {}, done: false }];
  // no Choir anywhere: its waters (the drowned seas), never the Crown's
  const w = view(routeFor(game, s, 'w:77'));
  assert.ok(['drowned_crown', 'dead_mans_expanse', 'the_abyss'].includes(game.regionAt(w.x, w.y)), game.regionAt(w.x, w.y));
  // an invasion afoot: its gathering
  game.invasions.on = true;
  runAdmin(game, s, '/invasion gravewater');
  const cur = game.invasions.store?.cur;
  assert.ok(cur); {
    const v = view(routeFor(game, s, 'w:77'));
    assert.ok(v.kind === 'event' || v.kind === 'ships', v.kind);
  }
  // a ship of the Choir in sight: that ship
  const o = game.spawnNpcShip('pirate', 'brig', 'choir', at.x + 1200, at.y, 0);
  game.grid.upsert(o.id, o.state.x, o.state.y);
  const v2 = view(routeFor(game, s, 'w:77'));
  assert.equal(v2.ship, o.id);
  // met: done
  wg.goals[0].done = true;
  assert.ok('done' in routeFor(game, s, 'w:77'));
});

test('a delivery: the port that takes it with the cargo aboard, else the port to load it', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Cargo Cora');
  atSea(game, s);
  const [from, to] = game.world.ports.filter((p) => !p.raft).slice(3, 5);
  s.profile!.contracts.push({ id: 'k1', kind: 'delivery', title: 'Test run', fromPort: from.id, toPort: to.id, good: 'rum', qty: 5, reward: 10, xp: 1, expiresAt: 1e12, description: '' } as never);
  let v = view(routeFor(game, s, 'c:k1'));
  assert.deepEqual([v.port, v.act], [from.id, 'dock'], 'not aboard: where it is loaded');
  s.ship!.cargo.rum = 5;
  v = view(routeFor(game, s, 'c:k1'));
  assert.deepEqual([v.port, v.act], [to.id, 'dock'], 'aboard: where it is taken');
  s.profile!.contracts = [];
  assert.ok('done' in routeFor(game, s, 'c:k1'));
});

test('«Взять контракт с доски порта» (a captain’s goal): the nearest port, put in there', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Board Bea');
  const at = atSea(game, s);
  s.profile!.tutorial!.goals.active = ['g_contract', 'g_first_dive'];
  const v = view(routeFor(game, s, 'g:g_contract'));
  assert.equal(v.kind, 'port');
  assert.equal(v.act, 'dock');
  // the nearest by the water among the lawful ones
  const field = seaField(game.world, at.x, at.y);
  const best = Math.min(...game.world.ports.filter((p) => !p.raft && p.faction !== 'confederacy' && p.faction !== 'choir').map((p) => fieldDist(game.world, field, p.x, p.y)));
  assert.ok(v.dist <= best * 1.05 + 400, `${v.dist} vs ${best}`);
  // a dive goal: a wreck, with the divers' word
  const d = view(routeFor(game, s, 'g:g_first_dive'));
  assert.equal(d.kind, 'wreck');
  assert.equal(d.hint, ROUTE_HINTS.dive);
  // a goal of the captain's window, not of the sea: why, no place
  s.profile!.tutorial!.goals.active.push('g_talent', 'g_duel');
  assert.deepEqual(routeFor(game, s, 'g:g_talent'), { none: ROUTE_WORDS.noPlace });
  assert.deepEqual(routeFor(game, s, 'g:g_duel'), { none: ROUTE_WORDS.duel });
  // met: done
  s.profile!.tutorial!.goals.active = [];
  s.profile!.tutorial!.goals.done = ['g_contract'];
  assert.ok('done' in routeFor(game, s, 'g:g_contract'));
});

test('«Промысел · Сети»: the nearest shoal with the net’s word; dailies: the nearest island not charted, a port not seen today', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Net Nell');
  const at = atSea(game, s);
  s.profile!.loadout.gear = { ...(s.profile!.loadout.gear ?? {}), tackle: { uid: 99, base: 'drift_net', ilvl: 1, dur: 50, maxDur: 50 } as never };
  const a = shoalHere(game, at.x + 2000, at.y, 'herring');
  shoalHere(game, at.x - 6000, at.y, 'herring');
  const v = view(routeFor(game, s, 'f'));
  assert.equal(v.kind+v.name,'shoalshoal'); {
    assert.ok(Math.hypot(v.x - a.x, v.y - a.y) < 2, 'the nearest shoal');
    assert.equal(v.hint, ROUTE_HINTS.net);
  }
  // a daily «chart islands»: an island she has not charted, the nearest
  s.profile!.daily.orders = [{ kind: 'chart', need: 2, progress: 0, done: false, silver: 1 } as never, { kind: 'ports', need: 3, progress: 0, done: false, silver: 1, seen: [] } as never];
  const ch = view(routeFor(game, s, 'd:chart'));
  assert.equal(ch.kind, 'island');
  assert.ok(!s.profile!.discovered.includes(ch.island!));
  s.profile!.discovered.push(ch.island!);
  const ch2 = view(routeFor(game, s, 'd:chart'));
  assert.notEqual(ch2.island, ch.island, 'charted: the next one');
  const p1 = view(routeFor(game, s, 'd:ports'));
  (s.profile!.daily.orders[1] as { seen: string[] }).seen = [p1.port!];
  const p2 = view(routeFor(game, s, 'd:ports'));
  assert.notEqual(p2.port, p1.port, 'a port seen today is not the goal');
});

test('a zone boss: where she is while up, else her sea', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Boss Bria');
  const at = atSea(game, s);
  const sea = view(routeFor(game, s, 'zb:gravewater'));
  assert.equal(game.regionAt(sea.x, sea.y), 'gravewater');
  const b = game.spawnNpcShip('boss', 'brig', 'confederacy', at.x + 4000, at.y, 0);
  game.zoneBosses.live.set('gravewater', { id: b.id, region: 'gravewater', slot: 0, endsAt: Date.now() + 1e6, anchor: { x: b.state.x, y: b.state.y }, goal: { x: b.state.x, y: b.state.y } } as never);
  const v = view(routeFor(game, s, 'zb:gravewater'));
  assert.deepEqual([v.kind, v.ship], ['boss', b.id]);
});

test('by the water, not straight through an island; a newcomer is kept out of lawless water and warned of it', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Water Wynn');
  const at = atSea(game, s);
  // a big island: the water on its far side is near in a straight line, far by the water
  const isl = game.world.islands.filter((i) => !i.minor && !i.raft && !i.hidden && i.radius > 1500).sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0];
  assert.ok(isl); {
    const side = (k: number) => {
      for (let d = isl.radius; d < isl.radius + 3000; d += 100) if (openSea(game, isl.x + k * d, isl.y)) return { x: isl.x + k * d, y: isl.y };
      return null;
    };
    const west = side(-1), east = side(1);
    assert.ok(west && east); {
      const ship = s.ship!;
      ship.state = { ...ship.state, x: west.x, y: west.y };
      game.grid.upsert(ship.id, west.x, west.y);
      const straight = Math.hypot(east.x - west.x, east.y - west.y);
      const out = { x: west.x - straight * 1.15, y: west.y };
      assert.ok(openSea(game, out.x, out.y)); {
        const field = seaField(game.world, west.x, west.y);
        assert.ok(fieldDist(game.world, field, east.x, east.y) > straight * 1.15 + 600, `${fieldDist(game.world, field, east.x, east.y)} ${straight}`); {
          const v = pickNearest(game, s, [
            { x: east.x, y: east.y, r: 200, kind: 'place', name: 'east' },
            { x: out.x, y: out.y, r: 200, kind: 'place', name: 'out' },
          ]);
          assert.equal(v?.name, 'out', 'the nearer by the water');
        }
      }
    }
  }
  // a newcomer: of two places, the one in lawless water is taken only if far nearer, and its danger is on the chip
  s.profile!.level = 3;
  const lawless = game.world.ports.find((p) => REGIONS[p.region].safety === 'lawless')!;
  const r = pickNearest(game, s, [{ x: lawless.x, y: lawless.y, r: 400, kind: 'port', name: lawless.name, port: lawless.id }]);
  assert.equal(r?.risk, 2, 'lawless water for a newcomer');
});

test('one request per tap; no place — a toast that says why; her own hand ends the run', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Tap Tess');
  atSea(game, s);
  s.profile!.tutorial!.goals.active = ['g_contract', 'g_talent'];
  c.push({ t: 'goto', key: 'g:g_contract' });
  c.push({ t: 'goto', key: 'g:g_contract' });
  assert.equal(c.all('route').length, 1, 'a bounced finger sends one');
  // her own hand on the wheel ends it
  stopAutosail(game, s, 'manual');
  steps(game, 2);
  assert.equal(routeOf(game, s), null);
  // a goal with no place at sea: a toast with the reason
  c.inbox.length = 0;
  c.push({ t: 'goto', key: 'g:g_talent' });
  assert.ok(c.all('err').some((m) => (m as { msg?: string }).msg === ROUTE_WORDS.noPlace) || c.all('toast').some((m) => m.msg === ROUTE_WORDS.noPlace), JSON.stringify(c.inbox.slice(-3)));
  assert.equal(c.last('route')?.why, 'none');
  // nonsense keys are refused, never thrown on
  assert.ok('none' in resolveGoal(game, s, 'zz:1'));
  assert.ok('none' in resolveGoal(game, s, 'q:no_such'));
  void ROUTE_VIEW;
});

test('the client: on arrival it puts in at a port, lands at an island, says the trade’s word once', () => {
  const r = new RouteRun('f', 0, 420);
  const base = { now: 1000, docked: null, region: 'gravewater', autosail: null, stop: null, landable: false };
  const shoal = { x: 1000, y: 1000, r: 100, hint: ROUTE_HINTS.net };
  assert.deepEqual(r.step({ ...base, own: { x: 5000, y: 1000 }, place: shoal }), { do: 'none' });
  assert.deepEqual(r.step({ ...base, own: { x: 1050, y: 1000 }, place: shoal }), { do: 'arrived', hint: ROUTE_HINTS.net });
  assert.deepEqual(r.step({ ...base, own: { x: 1050, y: 1000 }, place: shoal }), { do: 'none' }, 'said once');
  const port = new RouteRun('g:g_contract', 0, 420);
  assert.equal(port.step({ ...base, own: { x: 1200, y: 1000 }, place: { x: 1000, y: 1000, r: 400, act: 'dock', port: 'p' } }).do, 'dock');
  const land = new RouteRun('d:land', 0, 420);
  assert.equal(land.step({ ...base, landable: true, own: { x: 1200, y: 1000 }, place: { x: 1000, y: 1000, r: 600, act: 'land' } }).do, 'land');
});

test('every word of the route has its Russian, with no Latin; every goal line of the journal carries its key', () => {
  for (const w of [...Object.values(ROUTE_WORDS), ...Object.values(ROUTE_HINTS)]) {
    if (w === ROUTE_WORDS.noShip) continue;
    assert.ok(SERVER_RU_ROUTE[w], w);
    assert.ok(!/[A-Za-z]/.test(SERVER_RU_ROUTE[w]), SERVER_RU_ROUTE[w]);
  }
  for (const k of Object.keys(ROUTE_EN) as (keyof typeof ROUTE_EN)[]) assert.ok(!/[A-Za-z]/.test(ROUTE_RU[k].replace(/\{\w+\}/g, '')), k);
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(src('client/src/ui/daily.ts'), /data-goal="d:/);
  assert.match(src('client/src/ui/daily.ts'), /data-goal="cm"/);
  assert.match(src('client/src/ui/social.ts'), /data-goal="w:/);
  assert.match(src('client/src/ui/renown.ts'), /data-goal="r:/);
  assert.match(src('client/src/ui/invasion.ts'), /data-goal="inv"/);
  assert.match(src('client/src/ui/worldmap.ts'), /data-goal="t:/);
  assert.match(src('client/src/ui/onboarding.ts'), /this\.onGoal\(`g:/);
  assert.match(src('client/src/main.ts'), /startGoal\('f'\)/);
});
