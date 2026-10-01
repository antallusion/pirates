// docs/16 Batch E — islands and the shore: the walk across an island (paths, finds, risks, a cache at the far side),
// captains' caches and the maps to them sold on the boards and alongside, lighthouses that guide at night, lookouts
// on the headlands, and banks the tide or a season bares.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nightFactor } from '../shared/src/constants.ts';
import { LIGHT_PAID_SEC, LIGHT_R, LOOKOUT_R, LOOKOUT_REST, TIDE_SEC, TREK_EVENTS, TREK_EVENT_IDS, TREK_PATHS, TREK_PATH_NAMES, TIDAL_NAMES } from '../shared/src/data/isles.ts';
import type { Tr } from '../shared/src/data/isles.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { SEASON_SEC } from '../shared/src/world/worldgen.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import { seasonIndex, tidalIsles, tidalRise, tidalUp } from '../shared/src/world/tidal.ts';
import type { TrekView } from '../shared/src/protocol.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { findLandable, islandScene } from '../server/src/game/exploration.ts';
import { openMinigame, playMinigame } from '../server/src/game/minigames.ts';
import { openTrek } from '../server/src/game/trek.ts';
import { bankCollide, forceBank, islesView, keeperNear, keeperPrice, lightOf, lookouts } from '../server/src/game/isles.ts';
import { myCaches } from '../server/src/game/chests.ts';
import { lighthouseIslands } from '../server/src/game/havens.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = game.sessionByName(name)!;
  s.profile!.gold = 50_000;
  return { c, s };
}

function place(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = 0;
  ship.lastCombat = -999;
  ship.region = game.regionAt(x, y);
  game.grid.upsert(ship.id, x, y);
}

/** Off an island's shore, `off` metres out along the line from her middle through one of her coast's points. */
function parkOff(game: Game, s: PlayerSession, isId: number, off = 110, k = 0): void {
  const is = game.world.islands[isId];
  const px = is.poly[k * 2], py = is.poly[k * 2 + 1];
  const dx = px - is.x, dy = py - is.y, l = Math.hypot(dx, dy);
  place(game, s, px + (dx / l) * off, py + (dy / l) * off);
}

function dock(game: Game, s: PlayerSession, port: Port): void {
  (game as unknown as { dockShip(x: PlayerSession, p: Port): void }).dockShip(s, port);
}

const both = (t: Tr) => assert.ok(t[0] && t[1] && !/[A-Za-z]{4,}/.test(t[1].replace(/\{\w+\}/g, '')), `both languages: ${t[0]}`);

// ------------------------------------------------------------------ 21. the walk

test('the walk\'s words are in both languages, every path has something on it, every choice leads somewhere', () => {
  for (const p of TREK_PATHS) {
    both(TREK_PATH_NAMES[p]);
    assert.ok(TREK_EVENT_IDS.filter((id) => TREK_EVENTS[id].paths.includes(p) && TREK_EVENTS[id].kind !== 'game').length >= 2, `${p}: two things at least`);
  }
  for (const id of TREK_EVENT_IDS) {
    const e = TREK_EVENTS[id];
    both(e.text);
    for (const o of Object.values(e.outcomes)) {
      both(o.text);
      assert.ok((o.pay.crew ?? 0) <= 2 && (o.pay.xp ?? 0) <= 60 && (o.pay.silver?.[1] ?? 0) <= 250, `${id}: bounded`);
    }
    if (e.kind === 'risk') assert.ok(e.outcomes.ok && e.outcomes.hurt && e.chance! > 0.5 && e.chance! < 1, `${id}: a fair risk`);
    for (const c of e.choices ?? []) {
      both(c.label);
      assert.ok(c.to ? e.outcomes[c.to] : e.outcomes[c.win!] && e.outcomes[c.lose!], `${id}/${c.id}`);
    }
  }
});

/** Plays a walk out through the protocol, the first way and the first choice each time; games walked away from. */
function walk(game: Game, c: FakeConn, s: PlayerSession): TrekView {
  for (let guard = 0; guard < 20; guard++) {
    s.msgCount = 0;
    const v = c.last('trek')!.view!;
    if (v.done) return v;
    const mini = openMinigame(game, s);
    if (mini) {
      assert.equal(playMinigame(game, s, mini.id, 'walk'), null);
      continue;
    }
    if (v.choice) c.push({ t: 'trek', pick: TREK_EVENTS[v.event!].choices![0].id });
    else c.push({ t: 'trek', pick: v.paths![0] });
  }
  throw new Error('the walk never ended');
}

test('a landing at an island\'s haunt: its game first, then three or four steps, a choice of two or three ways each, a cache at the far side', () => {
  const { game } = makeGame();
  for (const id of [...game.npcs.keys()]) game.removeShip(id);
  const { c, s } = captain(game, 'Walker Wynn');
  const L = lookouts(game);
  const is = game.world.islands.find((i) => islandScene(i) && !L.has(i.id) && i.radius >= 350 && game.world.islands.every((o) => o === i || Math.hypot(o.x - i.x, o.y - i.y) > o.radius + i.radius + 900))!;
  assert.ok(is, 'a wide bare island');
  parkOff(game, s, is.id);
  steps(game, 25);
  assert.equal(findLandable(game, s)?.feature, 'scene');
  c.push({ t: 'land' });
  steps(game, 20 * 14);
  const t0 = c.last('trek')?.view;
  assert.ok(t0 && t0.game && t0.steps === 4, 'the walk opens behind the haunt\'s game (four steps on a wide island)');
  assert.ok(openMinigame(game, s), 'the haunt\'s game is open');
  const gold0 = s.profile!.gold;
  const v = walk(game, c, s);
  assert.equal(v.trail.length, 4, 'four steps walked');
  assert.equal(v.trail[0].path, 'landing');
  assert.ok(v.trail.slice(1).every((t) => TREK_PATHS.includes(t.path as never)), 'then paths');
  assert.ok(v.end && (v.end.silver ?? 0) > 0, 'the far side\'s cache');
  assert.ok(s.profile!.gold > gold0, 'silver came of it');
  // Every choice of ways offered two or three paths, never the one just walked.
  const offers = c.all('trek').map((m) => m.view).filter((x): x is TrekView => !!x && !!x.paths);
  assert.ok(offers.length >= 3);
  for (const o of offers) assert.ok(o.paths!.length === 3 && new Set(o.paths).size === 3, 'three ways on a wide island');
  c.push({ t: 'trek', pick: 'close' });
  assert.equal(c.last('trek')!.view, null);
  assert.equal(openTrek(game, s), null);
});

test('the walk back to the boats early keeps what was found and has no cache; a ship that sails off calls the party back', () => {
  const { game } = makeGame();
  for (const id of [...game.npcs.keys()]) game.removeShip(id);
  const { c, s } = captain(game, 'Early Eda');
  const L = lookouts(game);
  const is = game.world.islands.find((i) => islandScene(i) && !L.has(i.id) && i.radius < 350 && i.radius > 120 && game.world.islands.every((o) => o === i || Math.hypot(o.x - i.x, o.y - i.y) > o.radius + i.radius + 900))!;
  parkOff(game, s, is.id);
  steps(game, 25);
  c.push({ t: 'land' });
  steps(game, 20 * 14);
  assert.equal(c.last('trek')!.view!.steps, 3, 'three steps on a small island');
  const mini = openMinigame(game, s);
  if (mini) playMinigame(game, s, mini.id, 'walk');
  const v1 = c.last('trek')!.view!;
  assert.equal(v1.paths!.length, 2, 'two ways on a small island');
  c.push({ t: 'trek', pick: 'back' });
  const v = c.last('trek')!.view!;
  assert.ok(v.done && v.end === null, 'back early: no cache');
  // Another walk, and the ship sails off: the party hurries back.
  game.now += 31 * 60;
  c.push({ t: 'trek', pick: 'close' });
  steps(game, 25);
  c.push({ t: 'land' });
  steps(game, 20 * 14);
  assert.ok(openTrek(game, s) && !openTrek(game, s)!.done);
  const m2 = openMinigame(game, s);
  if (m2) playMinigame(game, s, m2.id, 'walk');
  place(game, s, is.x + 6000, is.y);
  steps(game, 25);
  assert.ok(openTrek(game, s)!.done, 'the party is back aboard');
  assert.ok(c.all('toast').some((t) => /hurries back/.test(t.msg)));
});

// ------------------------------------------------------------------ 22. captains' caches

test('a buried chest is listed with its map; its author sells copies on a board and keeps hers; a copy bought counts', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Riddler Rue');
  const is = game.world.islands.find((i) => !i.portId && !i.minor && i.radius > 200 && REGIONS[i.region].safety === 'safe')!;
  parkOff(game, s, is.id, 150);
  c.push({ t: 'chest', silver: 800, riddle: 'Where the gulls go quiet at noon', good: null, qty: 0 });
  const caches = myCaches(game, s);
  assert.equal(caches.length, 1);
  assert.equal(caches[0].island, is.name);
  assert.ok(caches[0].mapHeld && caches[0].silver === 800);
  const map = s.profile!.explore.maps.find((m) => m.kind === 'player')!;
  const port = game.world.ports.find((p) => p.key)!;
  dock(game, s, port);
  s.msgCount = 0;
  c.push({ t: 'mapboard', action: 'post', id: map.id, price: 300, copy: true });
  assert.ok(s.profile!.explore.maps.some((m) => m.id === map.id), 'her own map stays with her');
  assert.deepEqual(myCaches(game, s)[0].posted, [port.name]);
  // Another captain buys the copy.
  const b = captain(game, 'Buyer Bo');
  dock(game, b.s, port);
  const board = b.c.all('port').map((m) => m.view?.tavern?.maps).filter(Boolean).pop() ?? [];
  const item = board.find((x) => x.copy && x.chest);
  assert.ok(item, 'the board shows a copy of a captain\'s chest map');
  b.c.push({ t: 'mapboard', action: 'buy', id: String(item!.id) });
  assert.ok(b.s.profile!.explore.maps.some((m) => m.kind === 'player' && m.hoard === map.hoard), 'the buyer has the map');
  assert.equal(myCaches(game, s)[0].sold, 1);
  // Only the author sells copies.
  b.s.msgCount = 0;
  const bm = b.s.profile!.explore.maps.find((m) => m.kind === 'player')!;
  b.c.push({ t: 'mapboard', action: 'post', id: bm.id, price: 300, copy: true });
  assert.ok(b.c.all('toast').some((t) => /Only the author/.test(t.msg)));
});

test('a map sold alongside: the offer, the answer, the silver; not from beyond a kilometre', () => {
  const { game } = makeGame();
  const a = captain(game, 'Seller Sal');
  const b = captain(game, 'Taker Tam');
  const is = game.world.islands.find((i) => !i.portId && !i.minor && i.radius > 200 && REGIONS[i.region].safety === 'safe')!;
  parkOff(game, a.s, is.id, 150);
  a.c.push({ t: 'chest', silver: 500, riddle: 'Under the one-eyed rock', good: null, qty: 0 });
  const map = a.s.profile!.explore.maps.find((m) => m.kind === 'player')!;
  place(game, b.s, a.s.ship!.state.x + 3000, a.s.ship!.state.y);
  a.s.msgCount = 0;
  a.c.push({ t: 'mapsell', map: map.id, to: b.s.ship!.id, price: 700 });
  assert.ok(a.c.all('toast').some((t) => /within a kilometre/.test(t.msg)), 'too far');
  place(game, b.s, a.s.ship!.state.x + 400, a.s.ship!.state.y);
  a.c.push({ t: 'mapsell', map: map.id, to: b.s.ship!.id, price: 700 });
  const offer = b.c.last('mapoffer')?.offer;
  assert.ok(offer && offer.price === 700 && offer.chest && offer.riddle === 'Under the one-eyed rock');
  const ga = a.s.profile!.gold, gb = b.s.profile!.gold;
  b.c.push({ t: 'mapdeal', id: offer!.id, accept: true });
  assert.equal(b.s.profile!.gold, gb - 700);
  assert.equal(a.s.profile!.gold, ga + 700);
  assert.ok(b.s.profile!.explore.maps.some((m) => m.hoard === map.hoard));
  assert.ok(!a.s.profile!.explore.maps.some((m) => m.id === map.id), 'the original changed hands');
  assert.equal(myCaches(game, a.s)[0].mapHeld, false);
});

// ------------------------------------------------------------------ 23. lighthouses

test('lighthouses: the Crown keeps its own lit, a keeper elsewhere lights his for pay; the light reaches 3.5 km', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Lamp Lark');
  const ids = lighthouseIslands(game).map((id) => game.world.islands[id]);
  const crown = ids.find((is) => REGIONS[is.region].safety === 'safe');
  const wild = ids.find((is) => REGIONS[is.region].safety !== 'safe')!;
  if (crown) assert.equal(lightOf(game, crown, s.accountId).lit, 'crown');
  assert.equal(lightOf(game, wild, s.accountId).lit, null, 'dark until paid');
  let t = game.now;
  while (nightFactor(t) < 0.8) t += 30;
  game.now = t;
  parkOff(game, s, wild.id, 600);
  assert.equal(keeperNear(game, s)?.id, wild.id);
  steps(game, 25);
  assert.equal(s.landable?.action, 'keeper', 'the land key hails the keeper');
  const gold = s.profile!.gold, price = keeperPrice(game, wild);
  c.push({ t: 'land' });
  assert.equal(s.profile!.gold, gold - price);
  const l = lightOf(game, wild, s.accountId);
  assert.equal(l.lit, 'paid');
  assert.ok(Math.abs(l.until! - (game.now + LIGHT_PAID_SEC)) < 2);
  const v = islesView(game, s).lights.find((x) => x.island === wild.id)!;
  assert.ok(v.lit === 'paid' && v.r === LIGHT_R);
  assert.equal(keeperNear(game, s), null, 'lit now');
  // Half an hour later it has burnt out.
  game.now += LIGHT_PAID_SEC + 1;
  assert.equal(lightOf(game, wild, s.accountId).lit, null);
});

// ------------------------------------------------------------------ 24. lookouts

test('a lookout on a headland: climbed first, it charts the islands, reefs and wrecks within 5 km, then rests two hours', () => {
  const { game } = makeGame();
  for (const id of [...game.npcs.keys()]) game.removeShip(id);
  const { c, s } = captain(game, 'Scout Sim');
  const L = lookouts(game);
  assert.ok(L.size >= 40, `${L.size} lookouts`);
  // One with uncharted islands about it and no other landing in the way nearer.
  const [id, [lx, ly]] = [...L].find(([i]) => {
    const is = game.world.islands[i];
    return game.world.islands.filter((o) => !o.minor && o.id !== i && Math.hypot(o.x - is.x, o.y - is.y) < LOOKOUT_R).length >= 3 && game.world.islands.every((o) => o.id === i || Math.hypot(o.x - is.x, o.y - is.y) > o.radius + is.radius + 700);
  })!;
  const is = game.world.islands[id];
  // Park off the headland itself.
  const dx = lx - is.x, dy = ly - is.y, d = Math.hypot(dx, dy);
  place(game, s, lx + (dx / d) * 150, ly + (dy / d) * 150);
  steps(game, 25);
  assert.equal(findLandable(game, s)?.feature, 'lookout');
  const before = s.discovered.size;
  c.push({ t: 'land' });
  steps(game, 20 * 17);
  assert.equal(s.ship!.landing, null);
  assert.ok(s.discovered.size >= before + 2, `islands charted (${s.discovered.size - before})`);
  const within = game.world.islands.filter((o) => !o.minor && Math.hypot(o.x - is.x, o.y - is.y) < LOOKOUT_R - o.radius);
  assert.ok(within.every((o) => s.discovered.has(o.id)), 'every island within 5 km is on her chart');
  const chunk = c.all('chunk').filter((m) => m.key === -1 && (m.reefs?.length ?? 0) > 0).pop();
  assert.ok(chunk, 'the reefs about sent to her chart');
  assert.ok(c.all('toast').some((t) => /From the lookout/.test(t.msg)));
  assert.ok(islesView(game, s).lookouts.find((x) => x.island === id)?.at !== undefined, 'marked climbed');
  steps(game, 25);
  assert.notEqual(findLandable(game, s)?.feature, 'lookout', 'it rests');
  game.now += LOOKOUT_REST + 1;
  assert.equal(findLandable(game, s)?.feature, 'lookout', 'two hours later');
});

// ------------------------------------------------------------------ 25. banks the tide raises

test('banks the tide raises: twenty on the dense sea\'s reefs, apart; a tide bank stands a third of each tide, a season bank its season', () => {
  const { game } = makeGame();
  // The twenty of docs/16 #25 first; docs/18 #31's sandbars of the low tide follow them (tests/islands18.test.ts).
  const banks = tidalIsles(game.world).slice(0, 20);
  assert.equal(tidalIsles(game.world).length, 32);
  for (const b of banks) {
    const rf = game.world.reefs[b.reef];
    assert.ok(rf.id >= game.world.reefsFrom && rf.region !== 'the_abyss', 'on a dense-sea reef');
    assert.ok(banks.every((o) => o === b || Math.hypot(o.x - b.x, o.y - b.y) >= 7000), 'apart');
    both(TIDAL_NAMES[b.name]);
  }
  const tide = banks.find((b) => b.kind === 'tide')!, season = banks.find((b) => b.kind === 'season')!;
  let up = 0, n = 0;
  for (let t = 0; t < TIDE_SEC * 4; t += 10, n++) if (tidalUp(tide, t)) up++;
  assert.ok(Math.abs(up / n - 1 / 3) < 0.02, `up ${Math.round((up / n) * 100)}% of the time`);
  for (let t = 0; t < SEASON_SEC * 4; t += 600) assert.equal(tidalUp(season, t), seasonIndex(t) === season.season);
  // One rise is one rise: the same number all the time it stands.
  let t = 0;
  while (!tidalUp(tide, t)) t += 10;
  const r = tidalRise(tide, t);
  while (tidalUp(tide, t)) {
    assert.equal(tidalRise(tide, t), r);
    t += 10;
  }
  while (!tidalUp(tide, t)) t += 10;
  assert.notEqual(tidalRise(tide, t), r, 'the next rise is a new one');
});

test('a bared bank strikes like land; a landing party combs it once a rise; the sea back first costs hands', () => {
  const { game } = makeGame();
  for (const id of [...game.npcs.keys()]) game.removeShip(id);
  const { c, s } = captain(game, 'Comber Cam');
  const b = tidalIsles(game.world)[0];
  forceBank(game, b.id, true);
  // Sailing onto it: put back off the sand.
  place(game, s, b.x, b.y);
  const ship = s.ship!;
  ship.state.speed = 5;
  assert.ok(bankCollide(game, ship, [[ship.state.x, ship.state.y]]), 'struck');
  assert.ok(Math.hypot(ship.state.x - b.x, ship.state.y - b.y) > b.r * 0.5, 'put back off it');
  // Off its edge: the land key rows for it.
  const px = b.poly[0], py = b.poly[1], dx = px - b.x, dy = py - b.y, d = Math.hypot(dx, dy);
  place(game, s, px + (dx / d) * 120, py + (dy / d) * 120);
  steps(game, 25);
  assert.ok(s.landable && /bank/.test(s.landable.feature), 'the HUD offers the bank');
  const gold = s.profile!.gold, hold = JSON.stringify(ship.cargo);
  c.push({ t: 'land' });
  assert.equal(ship.landing?.feature, 'tidal');
  steps(game, 20 * 20);
  assert.equal(ship.landing, null);
  assert.ok(s.profile!.gold > gold, 'silver');
  assert.notEqual(JSON.stringify(ship.cargo), hold, 'something rare in the hold');
  assert.ok(islesView(game, s).tidal[b.id].combed, 'combed this rise');
  steps(game, 25);
  assert.ok(!/bank/.test(s.landable?.feature ?? ''), `nothing more there this rise (${s.landable?.feature})`);
  // Another rise: the sea comes back while the boats are ashore.
  delete s.profile!.isles!.tides[b.id];
  s.profile!.explore.maps = []; // a map found on the bank would send the boats digging instead
  steps(game, 25);
  c.push({ t: 'land' });
  const crew = ship.crew;
  steps(game, 20 * 5);
  forceBank(game, b.id, false);
  steps(game, 25);
  assert.equal(ship.landing, null);
  assert.ok(ship.crew < crew, 'hands swept away');
  assert.ok(c.all('toast').some((t) => /comes back over/.test(t.msg)));
  // The chart shows it only while it stands.
  assert.equal(islesView(game, s).tidal[b.id].up, false);
});
