// docs/18 V — the tie-in: the land's resources in the economy (the town's upgrades, the settled creature dwellings,
// the island's workshop, the ship's fittings, the store's cap, the market), the paths' favourite creatures, the
// creature weeks of the calendar, the bestiary's pages in the album; the admin's commands and the words in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, armyForLevel } from '../shared/src/data/army.ts';
import { CREATURE_IDS } from '../shared/src/data/bestiary.ts';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import { DRIFTS, DRIFT_CAL, FAV_BONUS, PATH_FAV, armyPeoples, driftCount, favouriteKinds, isFavourite, mixMorale } from '../shared/src/data/drifts.ts';
import { CRAFTS, DWELL_UP, FITTINGS, LAND_RES_CAP, fittingMods, townLand } from '../shared/src/data/landecon.ts';
import { LAIRS, lairArmy } from '../shared/src/data/lairs.ts';
import { setDefs } from '../shared/src/data/renown.ts';
import { WEEKS, WEEK_BEAST_LAIR, WEEK_KINDS, weekBeastGrowth, weekKind, weekOfBeast } from '../shared/src/data/week.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { lyingOff, mine } from '../server/src/game/base.ts';
import { lairById, lairDwellView, lairList, lairMen, lairsOf, settleDwelling, startFight } from '../server/src/game/beastlairs.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { addLand, buyFitting, craftArtifact, sellLand } from '../server/src/game/landecon.ts';
import { mineSites, offIsland } from '../server/src/game/mines.ts';
import { rn, setViews } from '../server/src/game/renown.ts';
import { rankArmy } from '../server/src/game/tame.ts';
import { buildTown, townState } from '../server/src/game/town.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { newBattle } from '../server/src/game/tacbattle.ts';
import { Rng } from '../shared/src/rng.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as V_EN, RU as V_RU } from '../client/src/lang/ui/heroes18v.ts';
import { join, makeGame, onHull } from './helpers.ts';
import { side } from './balance/creatures.ts';

function world(): Game {
  const { game } = makeGame();
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

function captain(game: Game, name: string, level = 5, cls = 'brig'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, cls, level);
  s.ship!.setArmy(armyForLevel(level, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  s.profile!.gold = 200_000;
  return s;
}

/** Her own island, the ship lying off it. */
function islander(game: Game, name: string): PlayerSession {
  const s = captain(game, name);
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  offIsland(game, s, home.id);
  assert.equal(buyIsland(game, s, home.id), null);
  offIsland(game, s, home.id);
  assert.ok(lyingOff(game, s, ownIsland(game, s.accountId)!));
  return s;
}

// ------------------------------------------------------------------------------------------------ 43. the land's resources

test('the land\'s resources: the town\'s upgrades ask for them; the store keeps so many and the rest rots', () => {
  const game = world();
  const s = islander(game, 'Shell Keeper');
  const m = mine(game, s);
  assert.ok(typeof m !== 'string');
  const { h, y } = m;
  const t = townState(y);
  t.b.keep = 1;
  t.b.dw2 = 1;
  for (const g of ['timber', 'coal', 'iron', 'tar', 'gunpowder', 'rum', 'pearls'] as const) y.res[g] = 500;
  (h as unknown as { level: number }).level = 10;
  assert.deepEqual(townLand('dw2', 2), { shell: 6 });
  assert.deepEqual(townLand('dw2', 1), {}, 'the first level asks none');
  lairsOf(s.profile!).res.shell = 0;
  assert.match(buildTown(game, s, 'dw2') ?? '', /shell/, 'no shell, no upgrade');
  lairsOf(s.profile!).res.shell = 10;
  assert.equal(buildTown(game, s, 'dw2'), null);
  assert.equal(lairsOf(s.profile!).res.shell, 4, 'six shell went into the guard house');
  // The cap.
  lairsOf(s.profile!).res.bone = LAND_RES_CAP - 5;
  const r = addLand(game, s, 'bone', 20);
  assert.deepEqual(r, { given: 5, rot: 15 });
  assert.equal(lairsOf(s.profile!).res.bone, LAND_RES_CAP);
});

test('the island\'s workshop makes artifacts of them; the carpenters fit the ship; the market buys them', () => {
  const game = world();
  const s = islander(game, 'Bone Carver');
  const m = mine(game, s);
  assert.ok(typeof m !== 'string');
  const st = lairsOf(s.profile!).res;
  st.shell = 40;
  st.bone = 40;
  st.venom = 40;
  assert.match(craftArtifact(game, s, 0) ?? '', /market/, 'the workshop is the market\'s');
  townState(m.y).b.market = 1;
  const gold = s.profile!.gold;
  const stash = s.profile!.stash.length;
  assert.equal(craftArtifact(game, s, 0), null);
  assert.equal(s.profile!.stash.length, stash + 1);
  assert.equal(s.profile!.stash[s.profile!.stash.length - 1].art, CRAFTS[0].art);
  assert.equal(s.profile!.gold, gold - CRAFTS[0].silver);
  assert.equal(st.shell, 40 - (CRAFTS[0].land.shell ?? 0));
  assert.match(craftArtifact(game, s, 2) ?? '', /level 2/, 'the talisman wants a better market');
  // The fittings: a rank at a time, onto her ship's stats.
  const hull = s.ship!.stats.hullMax;
  assert.equal(buyFitting(game, s, 'bone_knees'), null);
  assert.ok(s.ship!.stats.hullMax > hull, `the hull ${hull} → ${s.ship!.stats.hullMax}`);
  assert.deepEqual(fittingMods({ bone_knees: 2, shell_plating: 1 }), { hullMax: 0.06, incomingDamageMul: -0.02 });
  assert.equal(lairsOf(s.profile!).fit?.bone_knees, 1);
  // The market at its poor rate.
  const g2 = s.profile!.gold;
  assert.equal(sellLand(game, s, 'venom', 10), null);
  assert.equal(st.venom, 30);
  assert.ok(s.profile!.gold > g2 && s.profile!.gold - g2 <= 10 * 60 * 0.4 + 1);
  assert.ok(Object.values(FITTINGS).every((f) => f.name[1] && f.text[1]));
});

test('a creature dwelling settled for shell and bone: half as many again each week, three weeks kept, bone a week', () => {
  const game = world();
  const s = captain(game, 'Dwelling Settler');
  s.ship!.setArmy([{ u: 'marine', n: 20 }, { u: 'deckhand', n: 20 }]);
  assert.match(runAdmin(game, s, '/lair dwell') ?? '', /Your flag over/);
  const v = lairDwellView(game, s)!;
  const u = v.rows[0].units[0].u;
  const l = lairList(game).find((x) => LAIRS[x.kind].mix[0][0] === u && Math.hypot(x.x - s.ship!.state.x, x.y - s.ship!.state.y) < 1200)!;
  const st = lairsOf(s.profile!).res;
  st.shell = 0;
  st.bone = 0;
  assert.match(settleDwelling(game, s, l.id) ?? '', /shell|bone/);
  const c = DWELL_UP.cost(UNITS[u].tier);
  st.shell = c.land.shell!;
  st.bone = c.land.bone! + 10;
  assert.equal(settleDwelling(game, s, l.id), null);
  assert.equal(st.shell, 0);
  assert.equal(st.bone, 10);
  const pool = lairDwellView(game, s)!.rows[0].pool;
  runAdmin(game, s, '/week next');
  const after = lairDwellView(game, s)!.rows[0].pool;
  assert.ok(after > pool, `the pool grows (${pool} → ${after})`);
  assert.equal(st.bone, 10 - DWELL_UP.upkeep(UNITS[u].tier), 'and eats its bone');
});

// ------------------------------------------------------------------------------------------------ 44. the favourites

test('the paths\' favourite creatures: the three peoples\' paths love all of theirs, the other three a few kinds; +10% and no morale lost', () => {
  for (const c of CAPTAIN_IDS) assert.ok(favouriteKinds(c).length >= 2, `${c} has favourites`);
  assert.ok(isFavourite('drowned', 'surf_drowned') && isFavourite('navigator', 'mermaid') && isFavourite('reaver', 'crab'));
  assert.ok(isFavourite('corsair', 'reef_shark') && isFavourite('smuggler', 'hermit') && isFavourite('admiral', 'rock_turtle'));
  assert.ok(!isFavourite('corsair', 'crab') && !isFavourite('admiral', 'deckhand'));
  // The mixed army's morale: her favourites fight as the crew.
  const army = [{ u: 'deckhand' as const, n: 30 }, { u: 'reef_shark' as const, n: 4 }];
  assert.equal(mixMorale(army, 'corsair'), 0);
  assert.equal(mixMorale(army, 'admiral'), -1);
  assert.ok(armyPeoples(army, 'corsair').find((p) => p.p === 'sea')!.native);
  // The battle: a favourite stack's attack and defence a tenth higher.
  const p = { captain: 'corsair', tame: { k: {} } } as unknown as Parameters<typeof rankArmy>[0];
  const entries = rankArmy(p, army.map((x) => ({ ...x })));
  assert.ok(entries.find((x) => x.u === 'reef_shark')!.fav && !entries.find((x) => x.u === 'deckhand')!.fav);
  const bt = newBattle(side(entries), side([{ u: 'deckhand', n: 30 }]), 1, 0, new Rng(1));
  const sh = bt.stacks.find((x) => x.unit === 'reef_shark')!;
  assert.ok(Math.abs(sh.atk / (UNITS.reef_shark.atk * 1.0) - (1 + FAV_BONUS)) < 0.15, `attack ${sh.atk}`);
  for (const c of CAPTAIN_IDS) assert.ok(PATH_FAV[c].text[1]);
  assert.ok(V_RU['fav.title'] && V_EN['fav.title']);
});

// ------------------------------------------------------------------------------------------------ 45. the creature weeks

test('the creature weeks: drawn on the week\'s own dice, a quarter more in their lairs and loot, half again in their dwellings', () => {
  const kinds = WEEK_KINDS.filter((k) => WEEKS[k].beasts);
  assert.ok(kinds.length >= 6, 'weeks of the crab, the serpent and the rest');
  const seen = new Set<string>();
  for (let w = 0; w < 600; w++) seen.add(weekKind(w));
  for (const k of kinds) assert.ok(seen.has(k), `${k} comes`);
  assert.equal(weekKind(17), weekKind(17), 'the same week is the same');
  assert.ok(weekOfBeast('crab', 'crab') && !weekOfBeast('crab', 'gull'));
  assert.equal(weekBeastGrowth('serpent', 'young_serpent'), 1.5);
  assert.equal(weekBeastGrowth('marine', 'young_serpent'), 1);
  for (const k of kinds) assert.ok(WEEKS[k].name[1] && WEEKS[k].text[1]);
  // In the game: the week named for the crab — its lairs stand with a quarter more.
  const game = world();
  const s = captain(game, 'Crab Watcher', 3);
  runAdmin(game, s, '/lair crab_beach go');
  const l = lairList(game).find((x) => x.kind === 'crab_beach' && Math.hypot(x.x - s.ship!.state.x, x.y - s.ship!.state.y) < 1500)!;
  const plain = lairArmy(l.kind, l.level, l.size).reduce((a, x) => a + x.n, 0);
  runAdmin(game, s, '/week crab');
  const now = lairMen(game, l).reduce((a, x) => a + x.n, 0);
  assert.ok(Math.abs(now - plain * WEEK_BEAST_LAIR) <= l.size.length, `${plain} → ${now}`);
});

// ------------------------------------------------------------------------------------------------ 46. the bestiary

test('the bestiary: the first fight with a kind writes its page; the whole of it is a set of the album', () => {
  const game = world();
  const s = captain(game, 'Page Writer', 3);
  assert.equal(setDefs(0).bestiary.items.length, CREATURE_IDS.length);
  runAdmin(game, s, '/lair crab_beach go');
  const l = lairList(game).find((x) => x.kind === 'crab_beach' && Math.hypot(x.x - s.ship!.state.x, x.y - s.ship!.state.y) < 1500)!;
  assert.equal(startFight(game, s, l.id, true), null);
  const met = rn(s.profile!).met ?? [];
  for (const [u] of LAIRS.crab_beach.mix) assert.ok(met.includes(u), `${u} written`);
  const v = setViews(game, s.profile!).find((x) => x.id === 'bestiary')!;
  assert.ok(v.have.includes('crab') && !v.done);
  assert.ok(lairById(game, l.id));
  assert.match(runAdmin(game, s, '/bestiary all') ?? '', /18 of 18/);
  assert.equal(setViews(game, s.profile!).find((x) => x.id === 'bestiary')!.have.length, CREATURE_IDS.length);
});

// ------------------------------------------------------------------------------------------------ 47. the drift groups

test('the drift groups are weighed by the battle (DRIFT_CAL): every everyday kind at its levels, a group of one at least', () => {
  for (const [k, row] of Object.entries(DRIFT_CAL)) {
    assert.equal(row!.length, 11, k);
    assert.ok(row!.every((x) => x > 0 && x < 4), k);
    const d = DRIFTS[k as keyof typeof DRIFTS];
    for (let L = d.lv[0]; L <= d.lv[1]; L++) assert.ok(driftCount(k as keyof typeof DRIFTS, L) >= 1);
  }
  assert.deepEqual(DRIFTS.mermaid_net.lv, [4, 9], 'a tier-four shooter from ⚓4');
});

// ------------------------------------------------------------------------------------------------ the admin and the words

test('the admin\'s commands of docs/18 V in HELP in both languages; every new sentence in Russian', () => {
  const game = world();
  const s = captain(game, 'Console V');
  const HELP = runAdmin(game, s, '/help')!;
  for (const c of ['/landecon', '/bestiary']) assert.ok(HELP.includes(c), `${c} in HELP`);
  const ru = SERVER_RU_ADMIN[HELP];
  assert.ok(ru, 'the Russian HELP');
  assert.equal(ru.split(' · ').length, HELP.split(' · ').length, 'command for command');
  // Command for command, in the same places (later batches add theirs after these).
  assert.deepEqual(ru.split(' · ').map((p) => p.split(' ')[0]), HELP.split(' · ').map((p) => p.split(' ')[0]));
  setLang('ru');
  try {
    for (const line of ['/landecon', '/landecon cap', '/landecon fit bone_knees 2', '/bestiary all', '/bestiary clear']) {
      const t = serverText(runAdmin(game, s, line)!);
      assert.ok(!/(the|of|and|your|rank|Store|Fittings)/.test(t), `${line}: ${t}`);
    }
  } finally {
    setLang('en');
  }
  const table = serverTable();
  const mine = extract().filter((p) => /store|fitting|workshop|bestiary|settled|carpenters|market to level|flag over it first|locker/.test(p));
  assert.ok(mine.length >= 12);
  for (const p of mine) assert.ok(table[p] !== undefined, `Russian for ${JSON.stringify(p)}`);
  for (const k of Object.keys(V_EN)) assert.ok(V_RU[k as keyof typeof V_RU], k);
});
