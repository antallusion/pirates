// The mid-game QA (2026-10-22, tools/mobile/ux/midgame.mjs: the campaign's chapters 2–6 played on a phone in Telegram,
// the island, the fleet, the group): the faults found on the way, each held here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r/g, '');

test('a struck ship’s two choices are hers from afar: the helmsman lays her alongside and the terms are taken there', async () => {
  // She strikes 160 m off and her captor lies still (allstop.ts); the card's buttons were dead until she was steered by
  // hand within 30 m of the hull — the server takes the order from afar and sails her in (Game.acceptSurrender).
  const card = src('client/src/ui/surrender.ts');
  assert.doesNotMatch(card, /!near \? ' disabled'/, 'no choice disabled for the distance');
  assert.doesNotMatch(card, /b\.disabled = !near/, 'nor turned off as she drifts');
  const { EN, RU } = await import('../client/src/lang/ui/colours.ts');
  assert.match(RU['sur.far'], /подвед/, 'the far line tells the helmsman takes her there');
  assert.match(EN['sur.far'], /helmsman/);
  assert.deepEqual([...RU['sur.far'].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), [...EN['sur.far'].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort());
  // the server's side: an order from afar is an approach, not a refusal
  const game = src('server/src/game/Game.ts');
  assert.match(game, /if \(why === SURRENDER_FAR && target\) return approach\(/);
});

test('the Tide of the Dead: the drowned pass a captain by in the Crown’s safe water, and sail a hull of their waters’ level', async () => {
  const { makeGame, join } = await import('./helpers.ts');
  const { REGIONS } = await import('../shared/src/world/regions.ts');
  const { spawnGhost } = await import('../server/src/game/npc.ts');
  const { levelRange } = await import('../shared/src/data/shiplevel.ts');
  const { game } = makeGame();
  join(game, 'Newcomer');
  const s = game.sessionByName('Newcomer')!;
  const ship = s.ship!;
  ship.docked = null;
  // by Saltmarrow (safe water): a ghost alongside is no foe of hers
  const [bx, by] = REGIONS.black_coast.center;
  ship.state.x = bx; ship.state.y = by;
  ship.region = 'black_coast';
  const ghost = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', bx + 300, by, 0);
  assert.equal(game.isHostile(ghost, ship), false, 'safe water: the drowned do not come for her');
  // fired on by her, the ghost answers
  ghost.attackers.set(ship.id, game.now);
  assert.equal(game.isHostile(ghost, ship), true, 'a ghost she fired on fights back');
  // in contested water the drowned come for her as before
  const [gx, gy] = REGIONS.gravewater.center;
  ship.state.x = gx; ship.state.y = gy;
  ship.region = 'gravewater';
  const ghost2 = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', gx + 300, gy, 0);
  assert.equal(game.isHostile(ghost2, ship), true, 'contested water: hers to fear');
  // the season's ghosts in every sea: their hulls of their waters' level (the great ghost ship only at ⚓7 and above)
  const before = new Set(game.ships.keys());
  for (let i = 0; i < 400; i++) spawnGhost(game, true);
  const made = [...game.ships.values()].filter((x) => !before.has(x.id) && x.npcRole === 'ghost');
  assert.ok(made.length > 20, `ghosts put out (${made.length})`);
  for (const g of made) {
    const [lo, hi] = levelRange(g.loadout.classId);
    assert.ok(g.shipLevel >= lo && g.shipLevel <= hi, `${g.loadout.classId} at ⚓${g.shipLevel} (${lo}–${hi})`);
  }
  const low = made.filter((g) => g.region === 'black_coast');
  assert.ok(low.length && low.every((g) => g.loadout.classId !== 'ghost_ship' && g.shipLevel <= 4), `the Black Coast's ghosts small: ${low.map((g) => `${g.loadout.classId}⚓${g.shipLevel}`).join(', ')}`);
});

test('the Russian of the landing’s boats and the tavern’s word of a boss: no noun left in the wrong case', async () => {
  const { setLang } = await import('../client/src/i18n.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  setLang('ru');
  try {
    // «гребут к костёр отшельника на Рейвенрок-Рок» — the site's name is a nominative the line cannot decline
    const boats = serverText('Boats away: 8 hands row for the hermit\'s fire on Ravenrock Rock (12s). The ship lies at anchor.');
    assert.doesNotMatch(boats, /гребут к /, boats);
    assert.match(boats, /^Шлюпки спущены: 8 человек гребут на /, boats);
    // «Старый Швартов шевелится в Чёрное побережье»
    const boss = serverText('Old Hawser stirs in The Black Coast. Whalers mark the water 26 km east, 78 km south — within the half hour.');
    assert.doesNotMatch(boss, / в Чёрное/, boss);
    assert.match(boss, /от угла карты/, boss);
  } finally {
    setLang('en');
  }
});

test('a walk across an island ended and left alone: its card goes from her screen when the walk is dropped', async () => {
  const { makeGame, join, steps } = await import('./helpers.ts');
  const { startTrek, openTrek, playTrek } = await import('../server/src/game/trek.ts');
  const { game } = makeGame();
  const c = join(game, 'Walker');
  const s = game.sessionByName('Walker')!;
  s.ship!.docked = null;
  const is = game.world.islands.find((i) => !i.portId && !i.minor && !i.hidden && i.region === 'black_coast')!;
  s.ship!.state.x = is.x + is.radius + 60;
  s.ship!.state.y = is.y;
  const t = startTrek(game, s, is, 1)!;
  assert.ok(t);
  // walked back at once (the game at the haunt passed by, the path not taken): the end card, «На борт»
  if (t.game !== null) { t.game = null; }
  playTrek(game, s, 'back');
  const tv = openTrek(game, s);
  assert.ok(tv?.done, 'the walk is over');
  assert.ok(c.last('trek')?.view?.done, 'her end card');
  steps(game, 20 * 70);
  assert.equal(openTrek(game, s), null, 'dropped');
  assert.equal(c.last('trek')?.view, null, 'and her card closed with it');
});

test('«Плыть» to a campaign lair names its island, not «место»', async () => {
  const { makeGame, join } = await import('./helpers.ts');
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const { campaignOf } = await import('../server/src/game/campaign.ts');
  const { resolveGoal } = await import('../server/src/game/goalroute.ts');
  const { game } = makeGame();
  join(game, 'Lairer');
  const s = game.sessionByName('Lairer')!;
  s.profile!.level = 8;
  const q = campaignOf(game).quests.find((x) => x.steps.some((st) => st.type === 'lair' && st.island === undefined && 'near' in st && st.near))!;
  assert.ok(q, 'a campaign quest with a lair of its location');
  const i = q.steps.findIndex((st) => st.type === 'lair');
  s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: 0 }];
  s.ship!.docked = null;
  const near = (q.steps[i] as { near: { x: number; y: number } }).near;
  s.ship!.state.x = near.x + 900;
  s.ship!.state.y = near.y;
  const t = game.questTargets(s)[q.id];
  assert.ok(t && t.island !== undefined, `the target carries the lair's island (${JSON.stringify(t)})`);
  const r = resolveGoal(game, s, `q:${q.id}`) as { cands?: { kind: string; name: string }[] };
  assert.ok(r.cands?.length, JSON.stringify(r));
  assert.equal(r.cands![0].kind, 'lair');
  assert.equal(r.cands![0].name, game.world.islands[t.island!].name, 'its island by name');
  assert.ok(QUESTS_BY_ID[q.id]);
});

test('the autosail pill at the run’s place says «на месте», not «пауза»', async () => {
  const { pillTail } = await import('../client/src/ui/ease.ts');
  const { RU, EN } = await import('../client/src/lang/ui/ease.ts');
  assert.equal(pillTail({ paused: false }, 3000, { r: 260 }), null, 'under way: no word');
  assert.equal(pillTail({ paused: true }, 40, { r: 260 }), 'here', '40 m off a lair’s beach: at the place');
  assert.equal(pillTail({ paused: true }, 2500, { r: 260 }), 'paused', 'broken off short of it');
  assert.equal(pillTail({ paused: true }, 60, null), 'paused', 'a course of her own (no goal) keeps «пауза»');
  assert.equal(RU.as_here, 'на месте');
  assert.equal(EN.as_here, 'here');
});

test('a campaign lair step points at a lair of the quest’s own level in its waters, when one stands there', async () => {
  const { makeGame, join, steps } = await import('./helpers.ts');
  const { campaignOf } = await import('../server/src/game/campaign.ts');
  const { lairList, lairBeach } = await import('../server/src/game/beastlairs.ts');
  const { shipBandOf } = await import('../shared/src/data/xpcurve.ts');
  const { game } = makeGame();
  (await import('../server/src/game/advmap.ts')).quietAdv(game, false); // (the lairs awake, as on the live sea)
  join(game, 'Hermit');
  const s = game.sessionByName('Hermit')!;
  // «За серой тканью» (chapter 2, the fourth level): a ⚓3 hermits' camp nearest, a ⚓2 bat cave in the same waters
  const q = campaignOf(game).quests.find((x) => x.id === 'c02_08')!;
  const i = q.steps.findIndex((st) => st.type === 'lair');
  s.profile!.level = q.requires.level ?? 4;
  s.profile!.quests.active = [{ id: q.id, step: i, progress: 0, startedAt: 0 }];
  s.ship!.docked = null;
  const t = game.questTargets(s)[q.id];
  const l = lairList(game).find((x) => { const lp = lairBeach(game, x); return Math.hypot(lp.x - t.x, lp.y - t.y) < 1; })!;
  assert.ok(l, 'the mark is a lair’s beach');
  // her run's end there: «Штурм» on her bar (an inland camp's point left the run 100 m off with nothing to press)
  const is = game.world.islands[l.island];
  const a = Math.atan2(t.x - is.x, -(t.y - is.y));
  for (const off of [20, 30, 40, 55]) {
    s.ship!.state.x = t.x + Math.sin(a) * off;
    s.ship!.state.y = t.y - Math.cos(a) * off;
    s.ship!.state.speed = 0;
    s.ship!.state.heading = a + Math.PI / 2;
    const { isLand } = await import('../shared/src/world/worldgen.ts');
    if (!isLand(game.world, s.ship!.state.x, s.ship!.state.y)) break;
  }
  steps(game, 25);
  assert.equal(s.landable?.action, 'lair', `the lair in her boats' reach at the mark (${JSON.stringify(s.landable)})`);
  assert.ok(l.level <= shipBandOf(q.requires.level ?? 4), `a lair of her band (⚓${l.level} ${l.kind})`);
  const near = (q.steps[i] as { near: { x: number; y: number; r: number } }).near;
  assert.ok(Math.hypot(t.x - near.x, t.y - near.y) <= near.r, 'within the location’s waters');
  // the second word: «Потери врага» on the battle's card, not «Её потери» (a lair's creatures, an arena's captain)
  const { RU } = await import('../client/src/lang/ui/tactical.ts');
  assert.equal(RU['res.killed'], 'Потери врага');
});
