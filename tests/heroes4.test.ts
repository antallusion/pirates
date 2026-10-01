// docs/17 H4 — the adventure map: where the guards and the things stand (open deep water, by sector level, the same
// world the same map), the guards (put in the water near a captain, never moving, deaf to cannon, fought by boarding,
// fleeing or signing on before a far stronger army, standing again later, barring the mines), the things on the map and
// their rules (a chest's silver or experience each week, an altar's point once, a well each day, a watchtower, the
// mill and the warehouse, a prison's officer, an obelisk a season), the Grail (the chart's pieces, the dig, the
// chronicle, the Grail in the town), the sea's rng untouched, the admin's commands and every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALTAR_POINTS, GRAIL_GROWTH, GRAIL_R, GRAIL_SILVER, GUARDS, GUARD_KINDS, GUARD_RESPAWN_SEC, JOIN_RATIO, OBELISKS, OBJS, OBJ_KINDS, PUZZLE_GRID, REF_MEN, advHour, buildAdv, chestPay, guardArmy, guardMight, openWater } from '../shared/src/data/advmap.ts';
import { armyForLevel, armyMen, armyPower } from '../shared/src/data/army.ts';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import { TOWN, townCost } from '../shared/src/data/town.ts';
import { dist } from '../shared/src/math.ts';
import { sectorAt } from '../shared/src/world/sectors.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { talentPointsAvailable } from '../server/src/game/player.ts';
import { advMap, advOf, cardView, downGuard, guardChoice, guardOffer, guardShip, guardUp, parkNear, quietAdv, stepAdv, visit } from '../server/src/game/advmap.ts';
import { grailSpot, puzzleOf, puzzleView, startDig, stepGrail } from '../server/src/game/grail.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { tacAction } from '../server/src/game/tactical.ts';
import { mineLandable, mineSites, mineState } from '../server/src/game/mines.ts';
import { adminWeek } from '../server/src/game/calendar.ts';
import { buildTown, hallsDay, isleWeekGrowth, townState } from '../server/src/game/town.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { reckonBase, speedup, yardOf } from '../server/src/game/base.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

function captain(game: Game, name = 'Map Tester', level = 5, cls = 'brig'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, cls, level);
  s.ship!.setArmy(armyForLevel(level, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  s.profile!.gold = 100_000;
  return s;
}

/** Second by second, as the game runs its systems. */
function seconds(game: Game, n: number): void {
  steps(game, Math.round(n * 20));
}

// ------------------------------------------------------------------------------------------------ where they stand

test('the map: the same world puts the same things in the same places; sixteen obelisks, every kind in every region', () => {
  const game = world();
  const a = buildAdv(game.world), b = buildAdv(makeGame().game.world);
  assert.deepEqual(a.objs.map((o) => [o.id, o.kind, o.x, o.y]), b.objs.map((o) => [o.id, o.kind, o.x, o.y]));
  assert.equal(a.objs.filter((o) => o.kind === 'obelisk').length, OBELISKS);
  assert.equal(OBELISKS, PUZZLE_GRID * PUZZLE_GRID, 'a piece for every obelisk');
  const regions = new Set(a.objs.map((o) => o.region));
  assert.ok(regions.size >= 7 && !regions.has('the_abyss'));
  for (const r of regions) for (const k of OBJ_KINDS) assert.ok(a.objs.some((o) => o.region === r && o.kind === k), `${r}: ${k}`);
  assert.ok(a.guards.length >= 60 && a.guards.length <= 110, `${a.guards.length} guards`);
  assert.ok(a.guards.some((g) => g.at?.startsWith('m')) && a.guards.some((g) => !g.at) && a.guards.some((g) => g.at?.startsWith('o')), 'at mines, at things, in straits');
});

test('the map: never on land, on a reef or under a port\'s guns; each at its own sector\'s level; apart from each other', () => {
  const game = world();
  const a = buildAdv(game.world);
  const ports = game.world.ports.filter((p) => !p.raft);
  for (const x of [...a.objs, ...a.guards]) {
    assert.ok(!isLand(game.world, x.x, x.y), `${x.id} on land`);
    assert.ok(openWater(game.world, x.x, x.y), `${x.id} not in open deep water`);
    assert.ok(ports.every((p) => dist(p.x, p.y, x.x, x.y) >= 1600), `${x.id} under a port`);
    assert.equal(x.level, sectorAt(game.world, x.x, x.y).level, `${x.id} level`);
  }
  for (let i = 0; i < a.objs.length; i++) for (let j = i + 1; j < a.objs.length; j++) assert.ok(dist(a.objs[i].x, a.objs[i].y, a.objs[j].x, a.objs[j].y) >= 650, `${a.objs[i].id}/${a.objs[j].id}`);
  // Guarded things have their guard close by, between them and the sea.
  for (const o of a.objs.filter((x) => x.guard)) {
    const g = a.guards.find((x) => x.id === o.guard)!;
    assert.equal(g.at, o.id);
    assert.ok(dist(g.x, g.y, o.x, o.y) < 400, `${o.id}: its guard ${Math.round(dist(g.x, g.y, o.x, o.y))} m off`);
  }
});

// ------------------------------------------------------------------------------------------------ 14. the guards

test('guards scale with the sector: their might grows with the level, whatever they are made of; the deep\'s things only in deep waters', () => {
  for (let L = 2; L <= 10; L++) assert.ok(guardMight(L, 'avg') > guardMight(L - 1, 'avg'), `⚓${L}`);
  for (const L of [3, 6, 9]) for (const kind of GUARD_KINDS) {
    if ((kind === 'wreck' && L < 4) || (kind === 'beasts' && L < 6)) continue; // the deep's things keep to deeper waters
    const army = guardArmy(kind, L, 'avg');
    const p = armyPower(army), want = guardMight(L, 'avg');
    assert.ok(p > want * 0.6 && p < want * 1.6, `${kind} ⚓${L}: ${Math.round(p)} of ${Math.round(want)}`);
    assert.ok(army.length >= 1 && army.length <= 7);
  }
  assert.ok(armyMen(guardArmy('hulk', 5, 'avg')) > armyMen(guardArmy('wreck', 5, 'avg')), 'a hulk crowds many green men, a wreck a few dead ones');
  assert.ok(guardArmy('beasts', 8, 'avg').every((s) => s.u === 'drowned' || s.u === 'deep_spawn'), 'the pack of the deep is the deep\'s own');
  assert.ok(guardArmy('wreck', 6, 'avg').some((s) => s.u === 'drowned' || s.u === 'deep_spawn'));
  const a = buildAdv(world().world);
  for (const g of a.guards) if (g.kind === 'beasts') assert.ok(g.level >= 6, `${g.id}: beasts at ⚓${g.level}`);
  for (const k of GUARD_KINDS) assert.ok(GUARDS[k].name[1] && !/[a-z]/i.test(GUARDS[k].name[1]) && /[а-я]/i.test(GUARDS[k].text[1]), k);
  for (const k of OBJ_KINDS) assert.ok(OBJS[k].name[1] && !/[a-z]/i.test(OBJS[k].name[1]) && /[а-я]/i.test(OBJS[k].text[1]), k);
});

test('a guard stands in the water near a captain, never moves, takes no shot, is left alone by the sea\'s ships; out again when all have gone', () => {
  const game = world();
  const s = captain(game);
  assert.match(runAdmin(game, s, '/guard go')!, /^Off the /);
  seconds(game, 3);
  const g = advMap(game).guards.find((x) => guardShip(game, x.id))!;
  assert.ok(g, 'a guard in the water');
  const gs = guardShip(game, g.id)!;
  assert.equal(gs.guardOf, g.id);
  assert.equal(gs.shipLevel, g.level, 'on the ladder at its waters\' level');
  seconds(game, 20);
  assert.ok(dist(gs.state.x, gs.state.y, g.x, g.y) < 1, 'it has not moved');
  assert.equal(gs.state.speed, 0);
  const men = gs.crew;
  assert.equal(applyDamage(game, gs, { hull: 500, crew: 40 }, s.ship), 0, 'cannon do nothing to it');
  assert.equal(gs.crew, men);
  assert.ok(npcHostileTo(game, gs, s.ship!), 'it bars her way');
  const patrol = game.spawnNpcShip('patrol', 'brig', 'crown', g.x + 300, g.y, 0);
  assert.ok(!npcHostileTo(game, patrol, gs), 'the sea\'s ships leave it be');
  // She sails far off: it is taken out of the water, its men kept.
  parkNear(game, s, g.x + 20_000, g.y, 1);
  s.ship!.state.x = Math.min(90_000, g.x + 20_000);
  seconds(game, 4);
  assert.equal(guardShip(game, g.id), null, 'out of the water');
});

function alongside(game: Game, s: PlayerSession, id: string) {
  const gs = guardShip(game, id)!;
  s.ship!.state = { ...s.ship!.state, x: gs.state.x + 18, y: gs.state.y, speed: 0, sail: 0 };
  s.ship!.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  return gs;
}

test('fighting a guard opens the boarding battle against its stacks; won, it pays its chest, takes no prize and stands again later', () => {
  const game = world();
  game.tacticalBoarding = true;
  const s = captain(game);
  runAdmin(game, s, '/guard go');
  seconds(game, 3);
  const g = advMap(game).guards.find((x) => guardShip(game, x.id))!;
  runAdmin(game, s, '/guard weak');
  const gs = alongside(game, s, g.id);
  // Much the stronger, she is offered their flight or their men; she fights all the same.
  assert.ok(guardOffer(game, s, g), 'an offer before a far stronger army');
  assert.equal(guardChoice(game, s, g.id, 'fight'), null);
  assert.ok(s.ship!.boarding && gs.boarding, 'grappled');
  assert.ok(s.ship!.boarding!.fight.tac, 'the boarding battle of H1');
  assert.deepEqual(s.ship!.boarding!.fight.tac!.stacks.filter((x) => x.side === 1).map((x) => x.unit).sort(), gs.army.map((x) => x.u).sort(), 'its own stacks on deck');
  const gold = s.profile!.gold;
  assert.equal(tacAction(game, s.ship!, { a: 'quick' }), null);
  seconds(game, 5);
  assert.ok(!s.ship!.boarding, 'the battle is over');
  assert.ok(!guardUp(game, g), 'beaten');
  assert.equal(guardShip(game, g.id), null, 'gone from the water');
  assert.ok(s.profile!.gold > gold, 'its chest');
  assert.ok(![...game.ships.values()].some((x) => x.lootLockedFor === s.ship!.id), 'no prize to take');
  game.now += GUARD_RESPAWN_SEC + 1;
  assert.ok(guardUp(game, g), 'it stands again two days of the sea later');
});

test('HoMM3\'s offer: before three times their might they flee, or some sign on into her stacks; the deep\'s things never join the living', () => {
  const game = world();
  const s = captain(game, 'Strong Captain', 8, 'frigate');
  // A weak guard of the low waters against a frigate's army.
  const g = advMap(game).guards.find((x) => x.level <= 2 && x.kind !== 'wreck' && x.kind !== 'beasts')!;
  parkNear(game, s, g.x, g.y, 120);
  seconds(game, 3);
  const offer = guardOffer(game, s, g);
  assert.ok(offer === 'join' || offer === 'flee', 'an offer');
  const card = cardView(game, s)!;
  const gc = card.guard ?? card.obj?.guard;
  assert.ok(gc && gc.ratio >= JOIN_RATIO && gc.offer === offer, JSON.stringify(gc));
  const men = s.ship!.crew;
  s.ship!.loseMen(Math.round(men * 0.3)); // room aboard for them
  const before = s.ship!.crew;
  if (offer === 'join') {
    assert.equal(guardChoice(game, s, g.id, 'join'), null);
    assert.ok(s.ship!.crew > before, 'some signed on');
  } else {
    assert.equal(guardChoice(game, s, g.id, 'join'), 'They will not sail with you.');
    assert.equal(guardChoice(game, s, g.id, 'flee'), null);
  }
  assert.ok(!guardUp(game, g), 'gone for now');
  // A weak captain gets no offer.
  const w = captain(game, 'Weak Captain', 1, 'sloop');
  const g2 = advMap(game).guards.find((x) => x.level >= 4 && guardUp(game, x))!;
  parkNear(game, w, g2.x, g2.y, 150);
  seconds(game, 3);
  assert.equal(guardOffer(game, w, g2), null);
  assert.equal(guardChoice(game, w, g2.id, 'flee'), 'They will not yield to you.');
  assert.equal(GUARDS.beasts.join, 'never');
});

test('a guard bars its thing and its mine: no visit and no flag until it is beaten', () => {
  const game = world();
  const s = captain(game);
  const o = advMap(game).objs.find((x) => x.guard && x.kind === 'chest')!;
  parkNear(game, s, o.x, o.y, 100);
  seconds(game, 2);
  assert.equal(visit(game, s, o.id, 'silver'), 'A guard stands before it: beat them first.');
  const g = advMap(game).guards.find((x) => x.id === o.guard)!;
  assert.ok(guardUp(game, g));
  downGuard(game, g.id);
  assert.ok(!guardUp(game, g));
  assert.equal(visit(game, s, o.id, 'silver'), null);
  // A mine's guard: the flag waits for it.
  const mg = advMap(game).guards.find((x) => x.at?.startsWith('m') && mineState(game, x.at).owner === undefined)!;
  const site = mineSites(game).find((m) => m.id === mg.at)!;
  const is = game.world.islands[site.islandId];
  parkNear(game, s, mg.x, mg.y, 40);
  // Bring her within the boats' reach of the mine's shore.
  for (let k = 0; k < 40 && !mineLandable(game, s); k++) {
    s.ship!.state.x += (is.x - s.ship!.state.x) * 0.05;
    s.ship!.state.y += (is.y - s.ship!.state.y) * 0.05;
  }
  const land = mineLandable(game, s);
  if (land) assert.equal(land.blocked, 'A guard stands off the mine: beat them first.');
});

// ------------------------------------------------------------------------------------------------ 15. the visits

/** Off the nearest thing of a kind, its guard (if any) down. */
function go(game: Game, s: PlayerSession, kind: string): string {
  runAdmin(game, s, `/obj ${kind} go`);
  const ship = s.ship!;
  const o = advMap(game).objs.filter((x) => x.kind === kind).sort((a, b) => dist(a.x, a.y, ship.state.x, ship.state.y) - dist(b.x, b.y, ship.state.x, ship.state.y))[0];
  if (o.guard) downGuard(game, o.guard);
  return o.id;
}

test('a chest: silver or experience, once a week of the calendar, more behind a guard', () => {
  const game = world();
  const s = captain(game);
  const id = go(game, s, 'chest');
  const o = advMap(game).objs.find((x) => x.id === id)!;
  const card = cardView(game, s)!.obj!;
  assert.equal(card.kind, 'chest');
  assert.equal(card.rule, 'week');
  assert.equal(visit(game, s, id), 'Silver or experience?');
  const gold = s.profile!.gold;
  assert.equal(visit(game, s, id, 'silver'), null);
  assert.equal(s.profile!.gold, gold + chestPay(o.level, !!o.guard).silver);
  assert.equal(visit(game, s, id, 'xp'), 'Nothing new here yet.', 'once a week');
  adminWeek(game, 'next');
  const xp = s.profile!.xp, lvl = s.profile!.level;
  assert.equal(visit(game, s, id, 'xp'), null);
  assert.ok(s.profile!.xp !== xp || s.profile!.level > lvl, 'experience');
  assert.ok(chestPay(5, true).silver > chestPay(5, false).silver);
});

test('an altar teaches a talent point once (four from the altars in all, then experience); a well each day; a tower charts the sea', () => {
  const game = world();
  const s = captain(game);
  const id = go(game, s, 'altar');
  const pts = talentPointsAvailable(s.profile!);
  assert.equal(visit(game, s, id), null);
  assert.equal(talentPointsAvailable(s.profile!), pts + 1, 'a talent point');
  assert.equal(visit(game, s, id), 'You have been here already.');
  // Her four points spent at the altars, the next one teaches experience.
  advOf(s.profile!).pts = ALTAR_POINTS;
  const other = advMap(game).objs.filter((x) => x.kind === 'altar' && x.id !== id)[0];
  if (other.guard) downGuard(game, other.guard);
  parkNear(game, s, other.x, other.y, 150);
  const before = talentPointsAvailable(s.profile!), xp = s.profile!.xp, lvl = s.profile!.level;
  assert.equal(cardView(game, s)!.obj!.altar!.point, false);
  assert.equal(visit(game, s, other.id), null);
  assert.equal(talentPointsAvailable(s.profile!) - (s.profile!.level - lvl), before, 'no more points from the altars');
  assert.ok(s.profile!.xp !== xp || s.profile!.level > lvl);
  const w = go(game, s, 'well');
  s.ship!.morale = 30;
  const nerve = (s.ship!.sanity = 40);
  assert.equal(visit(game, s, w), null);
  assert.ok(s.ship!.morale >= 95 && s.ship!.sanity > nerve);
  assert.equal(visit(game, s, w), 'Nothing new here yet.');
  game.now += DAY_LENGTH_SEC;
  assert.equal(visit(game, s, w), null, 'again the next day');
  const t = go(game, s, 'tower');
  const known = s.discovered.size;
  assert.equal(visit(game, s, t), null);
  assert.ok(s.discovered.size > known, 'islands charted');
  assert.ok(advOf(s.profile!).seen.length > 3, 'guards and things on her chart');
});

test('a windmill and a warehouse load a resource each week; a prison frees an officer once', () => {
  const game = world();
  const s = captain(game);
  for (const kind of ['mill', 'store'] as const) {
    const id = go(game, s, kind);
    const card = cardView(game, s)!.obj!;
    assert.equal(card.kind, kind);
    const good = card.load!.good;
    const had = s.ship!.cargo[good] ?? 0;
    assert.equal(visit(game, s, id), null);
    assert.equal((s.ship!.cargo[good] ?? 0) - had, card.load!.n);
    assert.equal(visit(game, s, id), 'Nothing new here yet.');
  }
  const p = go(game, s, 'prison');
  s.profile!.company.officers = [];
  const n = s.profile!.company.officers.length;
  assert.equal(visit(game, s, p), null);
  assert.equal(s.profile!.company.officers.length, n + 1, 'an officer freed');
  assert.equal(visit(game, s, p), 'You have been here already.');
});

// ------------------------------------------------------------------------------------------------ 16. the Grail

test('the obelisks: a piece each, once a season; the chart opens from its edges, its coasts only in her open pieces', () => {
  const game = world();
  const s = captain(game);
  const id = go(game, s, 'obelisk');
  assert.equal(visit(game, s, id), null);
  assert.equal(visit(game, s, id), 'You have read this stone this season.');
  let v = puzzleView(game, s);
  assert.equal(v.n, 1);
  assert.equal(v.of, 16);
  assert.equal(v.x, undefined, 'the spot is hidden');
  const { order, spot, ox, oy } = puzzleOf(game, s.accountId);
  const cell = v.w / v.grid;
  const spotPiece = Math.floor((spot.y - oy) / cell) * v.grid + Math.floor((spot.x - ox) / cell);
  assert.equal(order[order.length - 1], spotPiece, 'the spot\'s own piece opens last');
  assert.ok(spot.x - ox >= v.w * 0.25 && spot.x - ox <= v.w * 0.75);
  runAdmin(game, s, '/obelisk 7');
  v = puzzleView(game, s);
  assert.equal(v.n, 8);
  assert.ok(v.region, 'the waters named at half the chart');
  runAdmin(game, s, '/obelisk all');
  v = puzzleView(game, s);
  assert.equal(v.n, 16);
  assert.ok(v.x, 'the spot marked');
  assert.ok(v.coasts.length >= 1);
  // Another captain's Grail lies elsewhere.
  const other = captain(game, 'Other Hunter');
  assert.ok(grailSpot(game, other.accountId).x !== spot.x || grailSpot(game, other.accountId).y !== spot.y);
});

test('the dig: sand where it is not, the Grail where it is — the chronicle tells it — and it is raised in her town: growth ×1.5, 500 a day', () => {
  const game = world();
  const s = captain(game, 'Grail Seeker');
  // Her own island first.
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  parkNear(game, s, home.x, home.y, home.radius + 120);
  assert.equal(buyIsland(game, s, home.id), null);
  // A wrong shore: sand.
  const spot = grailSpot(game, s.accountId);
  const wrong = game.world.islands.find((i) => !i.portId && !i.minor && i.id !== spot.island.id && dist(i.x, i.y, spot.x, spot.y) > 5000 && i.radius > 150)!;
  parkNear(game, s, wrong.x, wrong.y, wrong.radius + 80);
  for (let k = 0; k < 30 && startDig(game, s) === 'No shore within reach of the boats to dig.'; k++) parkNear(game, s, wrong.x, wrong.y, wrong.radius + 60 - k * 5);
  seconds(game, 22);
  assert.ok(!advOf(s.profile!).found, 'nothing found');
  assert.equal(startDig(game, s), 'The diggers are still resting from the last hole.');
  // The spot.
  game.now += 120;
  assert.match(runAdmin(game, s, '/grail go')!, /^Off the Grail/);
  assert.ok(dist(s.ship!.state.x, s.ship!.state.y, spot.x, spot.y) <= GRAIL_R);
  assert.equal(startDig(game, s), null);
  seconds(game, 22);
  stepGrail(game);
  assert.ok(advOf(s.profile!).held, 'the Grail is hers to raise');
  const chron = game.db.getKv<{ msg: string }[]>('world_chronicle') ?? [];
  assert.ok(chron.some((c) => /Grail Seeker has found the first Grail of the season/.test(c.msg)), 'the chronicle');
  assert.equal(startDig(game, s), 'You have found this season’s Grail already.');
  // Raised in the town.
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  for (const g of Object.keys(townCost('grail', 1).goods)) y.res[g as 'timber'] = 500;
  runAdmin(game, s, '/town 1');
  s.profile!.gold = 100_000;
  const before = isleWeekGrowth(game, y, 1);
  assert.equal(buildTown(game, s, 'grail'), null);
  assert.ok(!advOf(s.profile!).held && advOf(s.profile!).built);
  for (const j of [...y.jobs]) speedup(game, s, j.id, 'silver');
  reckonBase(game, h);
  assert.equal(townState(y).b.grail, 1);
  assert.ok(Math.abs(isleWeekGrowth(game, y, 1) - before * GRAIL_GROWTH) < 1e-9, 'every dwelling ×1.5');
  const t0 = h.treasury;
  hallsDay(game, 0);
  assert.ok(h.treasury - t0 >= GRAIL_SILVER, 'the Grail\'s silver');
  assert.equal(TOWN.grail.max, 1);
  assert.equal(buildTown(game, s, 'grail'), 'It is at its greatest');
});

// ------------------------------------------------------------------------------------------------ the rest

test('the sea\'s rng is left where it was: the guards come and go and the visits pay on their own hashes', () => {
  const run = (busy: boolean) => {
    const game = world();
    const s = captain(game, 'Rng Keeper');
    if (busy) {
      runAdmin(game, s, '/guard go');
      for (let k = 0; k < 40; k++) stepAdv(game);
      const w = go(game, s, 'well');
      visit(game, s, w);
      const m = go(game, s, 'mill');
      visit(game, s, m);
      cardView(game, s);
    }
    return [game.rng.float(), game.rng.float(), game.rng.float()];
  };
  assert.deepEqual(run(true), run(false));
});

test('the tick stays light: forty captains at sea, the guards, the cards and the charts in under 5 ms a second', () => {
  const game = world();
  const caps: PlayerSession[] = [];
  for (let i = 0; i < 40; i++) caps.push(captain(game, `Crowd ${i}`));
  const objs = advMap(game).objs;
  caps.forEach((s, i) => parkNear(game, s, objs[(i * 3) % objs.length].x, objs[(i * 3) % objs.length].y, 300));
  stepAdv(game);
  stepAdv(game);
  const t0 = performance.now();
  for (let k = 0; k < 20; k++) {
    game.now += 1;
    stepAdv(game);
  }
  const ms = (performance.now() - t0) / 20;
  assert.ok(ms < 5, `${ms.toFixed(2)} ms a second`);
});

test('the admin: /guard, /obj, /obelisk, /grail in HELP, command for command in Russian', () => {
  const game = world();
  const s = captain(game);
  assert.match(runAdmin(game, s, '/guard')!, /^Guards: \d+/);
  assert.match(runAdmin(game, s, '/obj')!, /^Things on the map: \d+/);
  assert.match(runAdmin(game, s, '/obelisk 3')!, /^Pieces of the Grail’s chart: 3 of 16/);
  assert.match(runAdmin(game, s, '/grail')!, /^Your Grail lies on /);
  assert.match(runAdmin(game, s, '/guard reset')!, /guards stand again/);
  const help = runAdmin(game, s, '/help')!;
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the HELP has its Russian twin');
  const cmds = (x: string) => [...x.matchAll(/\/[a-z]+/g)].map((m) => m[0]);
  assert.deepEqual(cmds(ru), cmds(help), 'command for command');
  for (const c of ['/guard', '/obj', '/obelisk', '/grail']) assert.ok(cmds(help).includes(c), c);
});

test('every sentence of the adventure map reads in Russian, with no English left', () => {
  const table = serverTable();
  const mine = extract('server/src/game').filter((p) => /guard|Grail|obelisk|altar|chest|windmill|warehouse|bell|diggers|spades|sign on with you|flees|Shot is wasted|lies open|strait/i.test(p));
  const missing = mine.filter((p) => table[p] === undefined);
  assert.ok(missing.length <= 4, `untranslated: ${JSON.stringify(missing)}`);
  setLang('ru');
  applyDataLocale('ru');
  try {
    const lines = [
      'The Rotting Hulk is beaten: 120 silver in its chest. The Treasure Chest lies open.',
      '9 of the Pirate Hold-out sign on with you; the rest row away. The mine lies open for your flag.',
      'The Pack of the Deep sees your strength and flees. The strait is clear.',
      'From the chest: 750 silver.',
      'From the windmill into the hold: 14 timber.',
      'The obelisk’s carving is a piece of the Grail’s chart (3 of 16).',
      'Only sand and crabs. The Grail lies elsewhere.',
      'Ansel Kell, a lieutenant, is freed and signs on with you.',
      'Rotting Hulk',
      'Wreck of the Drowned',
    ];
    for (const l of lines) {
      const r = serverText(l);
      assert.notEqual(r, l, l);
      assert.ok(!/[A-Za-z]{3,}/.test(r.replace(/Ansel|Kell/g, '')), `${l} → ${r}`);
    }
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});

test('balance: a chest is a part of the hour at sea of its waters; a guard\'s reference army is the ladder\'s usual crew', () => {
  for (let L = 1; L <= 10; L++) {
    const c = chestPay(L, true);
    assert.ok(c.silver >= advHour(L) * 0.3 && c.silver <= advHour(L) * 0.5, `⚓${L}: ${c.silver} of ${advHour(L)}`);
    assert.ok(chestPay(L, false).silver <= advHour(L) * 0.2);
  }
  assert.equal(REF_MEN.length, 11);
});
