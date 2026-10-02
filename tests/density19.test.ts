// docs/19 D: the sea twice as full. Exactly twice the marks, the adventure map's things and guards (the obelisks still
// sixteen), the lairs (a second depth on islands with one), the mines, the hidden islands, the creature jobs and the
// board's places; the old ones where and what they were. The sea's small life, events, drifts and traffic twice as
// often; the far LOD that keeps the tick; the day's caps on a captain's finds; the six small things of D5 on their
// buttons; the admin's commands in both HELPs; every new word in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { OBELISKS, OBJ_KINDS, buildAdv } from '../shared/src/data/advmap.ts';
import { DRIFT_EVERY, DRIFT_OWN } from '../shared/src/data/drifts.ts';
import { buildLairs } from '../shared/src/data/lairs.ts';
import { generateLairJobs } from '../shared/src/data/lairquests.ts';
import { MINES_LEGACY, MINES_PER_REGION, buildMines } from '../shared/src/data/mines.ts';
import { FIND_KINDS, FIND_REACH, boatHands, chestSharks } from '../shared/src/data/seafinds.ts';
import type { FindKind } from '../shared/src/data/seafinds.ts';
import { HAUL, HAUL_THIN, haulMul } from '../shared/src/data/seahaul.ts';
import { MARK_KINDS } from '../shared/src/data/seamarks.ts';
import { HIDDEN_MUL, HIDDEN_WANT } from '../shared/src/world/moreisles.ts';
import { MARKS_MUL } from '../shared/src/world/moremarks.ts';
import { generateWorld, isLand, legacyWorld, marksNear } from '../shared/src/world/worldgen.ts';
import type { World } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { FAR_EVERY, FAR_LOD_R } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { DIRECTOR_MUL } from '../server/src/game/director.ts';
import { QUOTA } from '../server/src/game/npc.ts';
import { BEAST_JOBS_ON_BOARD, JOBS_ON_BOARD, boardJobs } from '../server/src/game/quests.ts';
import { LIFE_EVERY } from '../server/src/game/sealife.ts';
import { TRAFFIC_WANT } from '../server/src/game/traffic.ts';
import { findAtHand, findById, findsOf, putFind, setFindRng, startFind } from '../server/src/game/seafinds.ts';
import { haulLeft, haulOf, haulTake } from '../server/src/game/seahaul.ts';
import { markWithin, startMark } from '../server/src/game/seamarks.ts';
import { landTac } from '../server/src/game/beastlairs.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { Rng } from '../shared/src/rng.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const world: World = generateWorld(WORLD_SEED);

function captain(game: Game, name = 'Density Tester'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 1000;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  return s;
}
const toasts = (s: PlayerSession) => (s as unknown as { conn: { all: (t: string) => { msg: string; kind: string }[] } }).conn.all('toast');

// ------------------------------------------------------------------------------------------------ D1

test('D1: the dense sea\'s marks exactly twice as many, kind by kind; the old ones where they were', () => {
  const old = legacyWorld(world).marks;
  assert.equal(MARKS_MUL, 2);
  assert.equal(world.marksFrom, old.length);
  assert.equal(world.marks.length, old.length * 2);
  assert.deepEqual(world.marks.slice(0, old.length), old, 'the marks of step 5 keep their ids and places');
  for (const k of MARK_KINDS) assert.equal(world.marks.filter((m) => m.kind === k).length, old.filter((m) => m.kind === k).length * 2, k);
  for (const m of world.marks.slice(old.length)) {
    assert.ok(!isLand(world, m.x, m.y), `mark ${m.id} on land`);
    assert.ok(marksNear(world, m.x, m.y, 5).includes(m), `mark ${m.id} in its chunk`);
  }
  // The same seed, the same sea.
  const again = generateWorld(WORLD_SEED);
  assert.deepEqual(again.marks.map((m) => [m.id, m.kind, Math.round(m.x), Math.round(m.y)]), world.marks.map((m) => [m.id, m.kind, Math.round(m.x), Math.round(m.y)]));
  // Other seeds too.
  for (const seed of [1, 7]) {
    const w = generateWorld(seed);
    assert.equal(w.marks.length, 2 * (w.marksFrom ?? 0), `seed ${seed}`);
  }
});

// ------------------------------------------------------------------------------------------------ D2

test('D2: the adventure map\'s things and guards twice as many (the obelisks still sixteen); the old ones as they were', () => {
  const full = buildAdv(world), was = buildAdv(legacyWorld(world));
  assert.deepEqual(full.objs.slice(0, was.objs.length), was.objs);
  assert.deepEqual(full.guards.slice(0, was.guards.length), was.guards);
  assert.equal(full.guards.length, was.guards.length * 2, 'guards');
  for (const k of OBJ_KINDS) {
    const a = full.objs.filter((o) => o.kind === k).length, b = was.objs.filter((o) => o.kind === k).length;
    assert.equal(a, k === 'obelisk' ? OBELISKS : b * 2, k);
  }
  assert.equal(new Set(full.objs.map((o) => o.id)).size, full.objs.length, 'ids unique');
  for (const o of full.objs.slice(was.objs.length)) assert.ok(!world.islands.some((is) => !is.slot && Math.hypot(is.x - o.x, is.y - o.y) < 60 && isLand(world, o.x, o.y)), `${o.id} off the land`);
});

test('D2: the lairs twice as many; an island keeps a second lair of another depth; the old ones as they were', () => {
  const lairs = buildLairs(world);
  const old = lairs.filter((l) => !l.id.endsWith('d')), more = lairs.filter((l) => l.id.endsWith('d'));
  assert.equal(more.length, old.length, 'as many again');
  const per = new Map<number, number>();
  for (const l of lairs) if (l.island >= 0) per.set(l.island, (per.get(l.island) ?? 0) + 1);
  let second = 0;
  for (const l of more) {
    const first = old.find((o) => o.island === l.island);
    if (!first) continue;
    second++;
    assert.notEqual(l.level, first.level, `${l.id}: another depth`);
    assert.notEqual(l.kind, first.kind, `${l.id}: another kind`);
  }
  assert.ok(second > more.length / 3, `${second} second depths`);
  // The lairs before D2 kept: the same world without step 7's marks gives the same old ones.
  const b = buildLairs(generateWorld(WORLD_SEED)).filter((l) => !l.id.endsWith('d'));
  assert.deepEqual(b.map((l) => [l.id, l.kind, l.x, l.y, l.level]), old.map((l) => [l.id, l.kind, l.x, l.y, l.level]));
});

// ------------------------------------------------------------------------------------------------ D4

test('D4: the mines twelve a region (the first six where they stood), the hidden islands, the creature jobs and the board twice', () => {
  const mines = buildMines(world);
  const regions = new Set(mines.map((m) => m.region));
  assert.equal(MINES_PER_REGION, 2 * MINES_LEGACY);
  assert.equal(mines.length, regions.size * MINES_PER_REGION);
  assert.equal(mines.filter((m) => m.extra).length, mines.length / 2);
  assert.equal(new Set(mines.map((m) => m.id)).size, mines.length, 'one a island');
  const hidden = world.islands.filter((i) => i.hidden), veiled = hidden.filter((i) => i.veil);
  assert.equal(HIDDEN_MUL, 2);
  assert.equal(hidden.length - veiled.length, Object.values(HIDDEN_WANT).reduce((a, b) => a + b, 0));
  assert.equal(veiled.length, hidden.length - veiled.length, 'as many again');
  const jobs = generateLairJobs(world, WORLD_SEED);
  const first = jobs.filter((q) => !q.id.endsWith('_2')), second = jobs.filter((q) => q.id.endsWith('_2'));
  assert.ok(second.length >= first.length * 0.95 && second.length <= first.length, `${first.length} → ${jobs.length} creature jobs`);
  assert.equal(JOBS_ON_BOARD, 10);
  assert.equal(BEAST_JOBS_ON_BOARD, 2);
  const { game } = makeGame();
  const s = captain(game);
  s.profile!.level = 30;
  const port = game.world.ports.find((p) => !p.raft && boardJobs(s.profile!, p, game.now).filter((q) => q.id.startsWith('lj_')).length === 2)!;
  assert.ok(port, 'a port whose board keeps two creature jobs');
  assert.equal(boardJobs(s.profile!, port, game.now).length, JOBS_ON_BOARD);
});

// ------------------------------------------------------------------------------------------------ D3

test('D3: the small life, the events, the drifts and the traffic twice as often or as many', () => {
  assert.deepEqual(LIFE_EVERY, [8, 13]);
  assert.equal(DIRECTOR_MUL, 2);
  assert.deepEqual(DRIFT_EVERY, [120, 210]);
  assert.equal(DRIFT_OWN, 2);
  assert.deepEqual(TRAFFIC_WANT, { safe: 32, contested: 40, lawless: 36 });
  assert.deepEqual(QUOTA, { merchants: 280, pirates: 136, fishers: 80, ghosts: 6 });
});

// ------------------------------------------------------------------------------------------------ D6

test('D6: a ship of the sea out of every captain\'s sight steps at a quarter of the rate; one near her every tick', () => {
  assert.ok(FAR_LOD_R > 1600 && FAR_EVERY === 4);
  const { game } = makeGame();
  const s = captain(game);
  runAdmin(game, s, '/tp gravewater'); // (out of port: a captain at sea is whom the LOD reckons by)
  const ship = s.ship!;
  const near = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x + 600, ship.state.y, 0);
  const far = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x + 2900, ship.state.y + 400, 0);
  for (const o of [near, far]) {
    game.npcs.get(o.id)!.active = true;
    game.grid.upsert(o.id, o.state.x, o.state.y);
  }
  steps(game, 25); // a second's reckoning of the nearest captain
  const lod = (game as unknown as { lodStep: Map<number, number> }).lodStep;
  const seen = { near: new Set<number>(), far: new Set<number>() };
  for (let i = 0; i < 16; i++) {
    game.step();
    seen.near.add(lod.get(near.id)!);
    seen.far.add(lod.get(far.id)!);
  }
  assert.deepEqual([...seen.near], [1]);
  assert.ok(seen.far.has(0) && [...seen.far].every((k) => k === 0 || k === 4 || k === 8), `far: ${[...seen.far]}`);
  // The far one still sails: it moves, four ticks at a time.
  const x0 = far.state.x, y0 = far.state.y;
  steps(game, 80);
  assert.ok(Math.hypot(far.state.x - x0, far.state.y - y0) > 5, 'and still makes way');
});

// ------------------------------------------------------------------------------------------------ the caps

test('the caps: so many finds at the full worth for each hour at sea in a day, the rest half; a word the first time', () => {
  assert.equal(HAUL_THIN, 0.5);
  assert.equal(haulMul(0, 'marks'), 1);
  assert.equal(haulMul(HAUL.marks, 'marks'), HAUL_THIN);
  assert.equal(haulMul(HAUL.marks, 'marks', 2 * 3600), 1, 'two hours at sea: twice the count');
  const { game } = makeGame();
  const s = captain(game);
  for (let i = 0; i < HAUL.marks; i++) assert.equal(haulTake(game, s, 'marks'), 1);
  assert.equal(haulTake(game, s, 'marks'), HAUL_THIN);
  assert.equal(haulLeft(game, s.profile!).marks, 0);
  haulOf(game, s.profile!).sec = 3 * 3600;
  assert.equal(haulLeft(game, s.profile!).marks, HAUL.marks * 2, 'her hours at sea grow the count');
  // At a mark: past the count the boats' find pays half, and the lookout says why, once.
  const { game: g2 } = makeGame();
  const c = captain(g2, 'Cap Tester');
  haulOf(g2, c.profile!).n.marks = HAUL.marks;
  runAdmin(g2, c, '/seamark wreck go');
  const m = markWithin(g2, c)!;
  assert.equal(startMark(g2, c, m.id), null);
  steps(g2, 20 * 6);
  assert.ok(toasts(c).some((t) => /picked over today/.test(t.msg)), 'the word why');
  // The day's count is the real calendar's: a new day forgets it.
  const h = haulOf(g2, c.profile!);
  h.day -= 1;
  assert.equal(haulOf(g2, c.profile!).n.marks ?? 0, 0);
});

// ------------------------------------------------------------------------------------------------ D5

function at(game: Game, s: PlayerSession, k: FindKind) {
  const out = runAdmin(game, s, `/find ${k}`)!;
  assert.match(out, /Beside you/, out);
  const f = findAtHand(game, s);
  assert.ok(f && f.kind === k, `${k}: at hand (${out})`);
  return f!;
}

test('D5: the six small things, each a button at hand and its modest reward on its own dice', () => {
  const { game } = makeGame();
  const s = captain(game, 'Small Things');
  onHull(game, s.ship!, 'brig', 4);
  runAdmin(game, s, '/tp gravewater');
  const ship = s.ship!;
  ship.setArmy([{ u: 'deckhand', n: 10 }, { u: 'marine', n: 20 }]);
  for (const k of FIND_KINDS) setFindRng(game, k, new Rng(3));
  // The bottle: a hint, a piece of a map or coins.
  let f = at(game, s, 'bottle');
  const charted = s.discovered.size, gold = s.profile!.gold, maps = s.profile!.explore.maps.length;
  assert.equal(startFind(game, s, f.id), null);
  steps(game, 20 * 3);
  assert.ok(s.discovered.size > charted || s.profile!.gold > gold || s.profile!.explore.maps.length > maps, 'the bottle gave something');
  assert.equal(findById(game, f.id), undefined, 'and is gone');
  // The flying fish: provisions at once, at any speed.
  f = at(game, s, 'flyfish');
  const prov = ship.cargo.provisions ?? 0;
  ship.state.speed = 9;
  assert.equal(startFind(game, s, f.id), null);
  assert.ok((ship.cargo.provisions ?? 0) > prov);
  ship.state.speed = 0;
  // The fog bank: a few seconds of rowing, a cache or nothing.
  f = at(game, s, 'calm');
  assert.equal(startFind(game, s, f.id), null);
  steps(game, 20 * 7);
  assert.ok(toasts(s).some((t) => /dead calm|fog bank/.test(t.msg)));
  // The gulls: the shoal marked.
  f = at(game, s, 'gulls');
  assert.equal(startFind(game, s, f.id), null);
  assert.ok(toasts(s).some((t) => /gulls/.test(t.msg)));
  // The sinking boat: deckhands for nothing.
  f = at(game, s, 'boat');
  const men = ship.crew, silver = s.profile!.gold;
  assert.equal(startFind(game, s, f.id), null);
  steps(game, 20 * 4);
  assert.ok(ship.crew > men && ship.crew - men <= boatHands(f.level), `${ship.crew - men} deckhands`);
  assert.equal(s.profile!.gold, silver, 'for nothing');
  // The chest: a fight with the sharks, the chest the prize.
  f = at(game, s, 'chest');
  assert.equal(f.n, chestSharks(f.level));
  const before = s.profile!.gold;
  assert.equal(startFind(game, s, f.id), null);
  assert.equal(landTac(game, s, { a: 'quick' } as never), null);
  steps(game, 20 * 2);
  assert.ok(s.profile!.gold > before, 'the chest hauled up');
  assert.deepEqual(Object.keys(s.profile!.seaFinds ?? {}).sort(), [...FIND_KINDS].sort());
});

test('D5: within reach and hove to; one of hers at a time in quiet sailing; on the action bar', () => {
  const { game } = makeGame();
  const s = captain(game, 'Reach Tester');
  runAdmin(game, s, '/tp gravewater');
  const ship = s.ship!;
  const f = putFind(game, s, 'bottle', { x: ship.state.x + 900, y: ship.state.y })!;
  assert.match(startFind(game, s, f.id)!, /within a cable/);
  ship.state.x = f.x - FIND_REACH.bottle + 20;
  ship.state.y = f.y;
  ship.state.speed = 8;
  assert.match(startFind(game, s, f.id)!, /Shorten sail/);
  // The bar's button.
  const acts = buildActs({ find: { id: f.id, kind: 'bottle' } });
  assert.equal(acts[0].id, 'find');
  assert.equal(acts[0].key, 'land');
  assert.equal(buildActs({ find: { id: f.id, kind: 'bottle', busy: true } }).length, 0, 'not while the boats are at it');
  // In quiet sailing the sea puts them out by itself, one of hers at a time.
  runAdmin(game, s, '/find reset');
  quietAdv(game, false);
  game.directorOn = true;
  ship.state.speed = 10;
  ship.input = { rudder: 0.02, sailTarget: 1 };
  let most = 0;
  for (let t = 0; t < 700; t++) {
    steps(game, 20);
    most = Math.max(most, findsOf(game, s).length);
  }
  assert.equal(most, 1);
});

// ------------------------------------------------------------------------------------------------ words

test('D: the admin\'s commands in both HELPs, and every new line of the server in Russian', () => {
  const helpEn = Object.keys(SERVER_RU_ADMIN).find((k) => k.startsWith('/speed N'))!;
  for (const c of ['/find [bottle|flyfish|calm|gulls|boat|chest] [go|done|reset]', '/haul [reset]']) {
    assert.ok(helpEn.includes(c), `HELP: ${c}`);
    assert.ok(SERVER_RU_ADMIN[helpEn].includes(c), `the Russian HELP: ${c}`);
  }
  const table = serverTable();
  const lines = extract().filter((p) => /bottle|flying fish|fog bank|gulls|sinking boat|sharks|picked over today|thin today|hunted out today|small things?|full worth/.test(p));
  const missing = lines.filter((p) => table[p] === undefined);
  assert.deepEqual(missing, []);
  // (as the client does: the data's names in Russian, so the goods inside a sentence are too)
  const sentence = 'The sharks are driven off and the chest hauled up: 236 silver and 4 sugar.';
  applyDataLocale('ru');
  setLang('ru');
  try {
    const ru = serverText(sentence);
    assert.ok(!/[a-z]{3,}/i.test(ru), ru);
  } finally {
    setLang('en');
    applyDataLocale('en');
  }
});
