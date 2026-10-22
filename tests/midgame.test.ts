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
