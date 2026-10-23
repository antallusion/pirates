// The leftovers of the mid-game QA pass (2026-10-23), each with its regression: group invitations that outlive a
// window and a /speed, the build step's «Плыть» at her own island, the guild's price told before the refusal, the
// starting sea's sharks, Russian plurals in the server's lines, the Whispering Archipelago's pirates who struck at
// 1200 m.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_MS, stepSocial } from '../server/src/game/party.ts';
import { InviteQueue } from '../client/src/ui/invitequeue.ts';
import { join, makeGame, steps } from './helpers.ts';

// ------------------------------------------------------------------ 2. group invitations

test('a group invitation stands three minutes of real time — not a minute of the game’s clock (/speed, a window open)', () => {
  const { game } = makeGame();
  const a = join(game, 'Inv Anne'), b = join(game, 'Inv Bram');
  let wall = Date.now();
  game.wallNow = () => wall + game.wallSkew;
  a.push({ t: 'group', action: 'invite', name: 'Inv Bram' });
  assert.equal(b.last('party')!.invites.length, 1);
  // the game's clock runs on (and /speed runs the wall clock ahead with it): the invitation stands
  game.now += 600;
  game.wallSkew += 600_000;
  wall += 60_000;
  stepSocial(game);
  assert.equal(b.last('party')!.invites.length, 1, 'a minute of real time, ten of the game’s');
  wall += INVITE_MS - 60_000 - 1000;
  stepSocial(game);
  assert.equal(b.last('party')!.invites.length, 1, 'still under three minutes');
  wall += 2000;
  stepSocial(game);
  assert.equal(b.last('party')!.invites.length, 0, 'lapsed after three minutes');
  assert.ok(INVITE_MS >= 170_000 && INVITE_MS <= 200_000);
});

test('an invitation that comes while a window is open is told when the window closes (unless answered or lapsed)', () => {
  const q = new InviteQueue();
  q.note([{ id: 1, from: 'Anne' }], 'daily');
  q.note([{ id: 1, from: 'Anne' }, { id: 2, from: 'Bram' }], 'port');
  q.note([{ id: 3, from: 'Cole', ask: true }], 'port'); // (a captain asking to join: the leader's card, not this)
  assert.deepEqual(q.due([{ id: 1, from: 'Anne' }]), [{ id: 1, from: 'Anne' }], 'Bram’s lapsed meanwhile');
  assert.deepEqual(q.due([{ id: 1, from: 'Anne' }]), [], 'told once');
  q.note([{ id: 4, from: 'Dora' }], null);
  q.note([{ id: 5, from: 'Ezra' }], 'company');
  assert.deepEqual(q.due([{ id: 4, from: 'Dora' }, { id: 5, from: 'Ezra' }]), [], 'no window, or the Company screen itself: the toast and the card do');
});

// ------------------------------------------------------------------ 3. «Заложите постройки» at her island

test('«Заложите постройки»: at her island (or in a harbour by it) «Цели и вести» draws «Строить», which opens the island; elsewhere «Плыть»', async () => {
  const { questAct } = await import('../shared/src/data/questact.ts');
  const { goalSheetView } = await import('../client/src/ui/goalsheet.ts');
  const { actButton } = await import('../client/src/ui/questact.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  const act = questAct({ type: 'build', count: 1, text: 'Lay works on your island: 1.' })!;
  assert.deepEqual(act, { verb: 'build', how: 'isle' });
  const q = { id: 'c06_07', name: 'A Room Beneath the Floor', kind: 'campaign' as const, step: 0, steps: 2, text: 'Lay works on your island: 1.', progress: 0, need: 1, act };
  const there = goalSheetView({ quests: [q], dockedAt: null, nearIsle: true });
  assert.deepEqual(there.campaign?.line?.here ?? there.active[0]?.here, act, 'by her island: the verb');
  const away = goalSheetView({ quests: [q], dockedAt: 'fogmouth', nearIsle: false });
  assert.equal(away.campaign?.line?.here ?? away.active[0]?.here, undefined, 'far from it: «Плыть»');
  setLang('ru');
  const btn = actButton(q.id, act, 'btn');
  assert.match(btn, /data-act="quest_isle"/);
  assert.match(btn, /Строить/);
  setLang('en');
  assert.match(actButton(q.id, act, 'btn'), />Build</);
});

// ------------------------------------------------------------------ 4. the guild's price told first

test('the guild founding card tells its price and the rest before «Основать» (RU+EN), on every screen; short of silver the button says why', async () => {
  const { foundCard } = await import('../client/src/ui/company.ts');
  const { GUILD_COST } = await import('../shared/src/data/social.ts');
  const { GUILD_COST: SERVER_COST } = await import('../server/src/game/guilds.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  assert.equal(GUILD_COST, SERVER_COST, 'one price');
  setLang('ru');
  const poor = foundCard('gravesend', 3200).replace(/ /g, ' '); // (the typography's no-break spaces read as spaces)
  const req = poor.slice(poor.indexOf('g-req'), poor.indexOf('g-found'));
  assert.match(req, /10[\s  ]?000 серебра \(у вас 3[\s  ]?200\)/, 'the price and her silver');
  assert.match(req, /в портовой конторе/);
  assert.match(req, /название из 3–24 букв/);
  assert.doesNotMatch(req, /w-desk/, 'not the desk’s alone');
  assert.match(poor, /id="g-found" disabled title="Не хватает серебра: ещё 6[\s  ]?800"/);
  const rich = foundCard('gravesend', 12000);
  assert.doesNotMatch(rich, /id="g-found" disabled/);
  assert.match(foundCard(null, 12000), /id="g-found" disabled title="В\sпорту"/);
  setLang('en');
  assert.match(foundCard('gravesend', 0), /10[,\s  ]?000 silver \(you have 0\)/);
});

// ------------------------------------------------------------------ 5. the starting sea's sharks

test('sharks (and the other hunters) leave a newcomer in the starting sea be — bleeding, her helmsman sails on; past it, or once she strikes, they come', async () => {
  const { spawnGroup, stepBeasts, beastSecond, beastBrain, SHELTER_LEVEL } = await import('../server/src/game/beasts.ts');
  const { startAutosail, autosailOf } = await import('../server/src/game/autosail.ts');
  const { REGIONS } = await import('../shared/src/world/regions.ts');
  const { regionAt, isLand } = await import('../shared/src/world/worldgen.ts');
  const { game } = makeGame();
  const at = (name: string, region: 'black_coast' | 'gravewater', level: number) => {
    join(game, name);
    const s = game.sessionByName(name)!, ship = s.ship!;
    ship.docked = null;
    s.profile!.docked = null;
    s.profile!.level = level;
    const [cx, cy] = REGIONS[region].center;
    for (let k = 0; k < 400; k++) {
      const x = cx + ((k * 7919) % 16000) - 8000, y = cy + ((k * 104729) % 16000) - 8000;
      let clear = regionAt(game.world, x, y) === region;
      for (let a = 0; a < 8 && clear; a++) for (const r of [300, 700, 1500]) if (isLand(game.world, x + Math.cos(a) * r, y + Math.sin(a) * r)) clear = false;
      if (!clear) continue;
      ship.state.x = x;
      ship.state.y = y;
      break;
    }
    ship.region = region;
    ship.hull = ship.stats.hullMax * 0.3; // bleeding: a shark's prey anywhere else
    ship.protectedUntil = 0;
    game.grid.upsert(ship.id, ship.state.x, ship.state.y);
    return { s, ship };
  };
  const run = (sec: number) => steps(game, Math.round(sec * 20)); // (the whole sea: the beasts, her helmsman)
  void stepBeasts;
  void beastSecond;
  const fresh = at('Shark Novice', 'black_coast', 4);
  const sharks = spawnGroup(game, 'shark', fresh.ship.state.x + 300, fresh.ship.state.y, 2, 3);
  assert.equal(startAutosail(game, fresh.s, fresh.ship.state.x, fresh.ship.state.y - 3000, 3), null);
  const h0 = fresh.ship.hull;
  run(20);
  assert.equal(fresh.ship.hull, h0, 'not bitten');
  for (const b of sharks) assert.notEqual(beastBrain(game, b.id)?.target, fresh.ship.id, 'not hunted');
  assert.ok(autosailOf(fresh.ship), 'her helmsman sails on');
  assert.ok(SHELTER_LEVEL >= 8);
  // a captain of the contested sea, bleeding: the sharks come
  const wild = at('Shark Veteran', 'gravewater', 4);
  const pack = spawnGroup(game, 'shark', wild.ship.state.x + 300, wild.ship.state.y, 2, 3);
  const w0 = wild.ship.hull;
  run(20);
  assert.ok(pack.some((b) => beastBrain(game, b.id)?.target === wild.ship.id) || wild.ship.hull < w0, 'hunted out of the starting sea');
});

// ------------------------------------------------------------------ 6. Russian plurals in the server's lines

test('a count in a server line reads in Russian with its noun in the number’s form (men, silver, units, days, minutes, ships…)', async () => {
  const { ruCounts, countForm, COUNT_WORDS } = await import('../client/src/lang/counts.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  assert.equal(ruCounts('Яма обваливается: 22 человек погребены под песком.'), 'Яма обваливается: 22 человека погребены под песком.');
  assert.equal(ruCounts('21 человек, 11 человек, 5 человека'), '21 человек, 11 человек, 5 человек');
  assert.equal(ruCounts('Призовая команда из 22 человек оставит вас без рук'), 'Призовая команда из 22 человек оставит вас без рук', 'after «из»: as written');
  assert.equal(ruCounts('стоит 1 серебра, 2 серебра, 1 001 серебра'), 'стоит 1 серебро, 2 серебра, 1 001 серебро');
  assert.equal(ruCounts('3 единиц, 1 единиц, 12 единиц'), '3 единицы, 1 единица, 12 единиц');
  assert.equal(ruCounts('через 3 дней, 1 дней, 25 дней'), 'через 3 дня, 1 день, 25 дней');
  assert.equal(ruCounts('2 минут, 1,5 минут, 21 минут'), '2 минуты, 1,5 минуты, 21 минута');
  assert.equal(ruCounts('Потоплено 1 кораблей, 4 кораблей, 14 кораблей'), 'Потоплено 1 корабль, 4 корабля, 14 кораблей');
  assert.equal(ruCounts('в 2 раз больше'), 'в 2 раза больше');
  assert.equal(countForm('104', COUNT_WORDS[0]), 'человека');
  // through the server's own table
  setLang('ru');
  try {
    assert.equal(serverText('The pit caves in: 22 men buried with the sand.'), 'Яма обваливается: 22 человека погребены под песком.');
    assert.match(serverText('{0} men go over the side without a word. The planks close up behind them.'.replace('{0}', '3')), /^3 человека молча/);
    assert.match(serverText('The raiders off Saltmarrow are beaten! 21 silver of their plunder is yours.'), /21 серебро/);
  } finally {
    setLang('en');
  }
});

// ------------------------------------------------------------------ 8. the Whispering Archipelago's pirates

test('a pirate battered by the sea’s own fights strikes only after a real fight at close range — not to one ball from 1200 m', async () => {
  const { wouldStrike, STRIKE_RANGE, STRIKE_FIGHT_SEC } = await import('../server/src/game/struck.ts');
  const { applyDamage } = await import('../server/src/game/combat.ts');
  const { onHull } = await import('./helpers.ts');
  const { game } = makeGame();
  join(game, 'Whisper Hunter');
  const s = game.sessionByName('Whisper Hunter')!, ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.region = 'whispering';
  const npc = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 1200, ship.state.y, 0);
  onHull(game, ship, 'brig', npc.shipLevel);
  ship.crew = ship.stats.crewMax;
  game.npcs.get(npc.id)!.active = true;
  // battered by the sea's merchants and patrols before she came: a fifth of her hull
  npc.hull = npc.stats.hullMax * 0.2;
  // one ball of hers from 1200 m
  applyDamage(game, npc, { hull: 5 }, ship);
  ship.lastCombat = game.now;
  assert.equal(wouldStrike(game, npc, ship), false, 'not at 1200 m, after one ball');
  // close in: within the guns' reach, but the fight only begun
  npc.state.x = ship.state.x + 180;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  applyDamage(game, npc, { hull: npc.stats.hullMax * 0.02 }, ship);
  assert.equal(wouldStrike(game, npc, ship), false, 'a blow or two close by is no fight yet');
  // a real fight: her guns on her for a while, a good share of what is left of the hull taken
  npc.hull = npc.stats.hullMax * 0.6;
  for (let t = 0; t <= STRIKE_FIGHT_SEC + 2; t += 2) {
    game.now += 2;
    applyDamage(game, npc, { hull: npc.stats.hullMax * 0.05 }, ship);
    ship.lastCombat = game.now;
  }
  assert.ok(npc.hull < npc.stats.hullMax * 0.25);
  assert.equal(wouldStrike(game, npc, ship), true, 'battered by her, close by, after a fight');
  // the same fight, but she has fallen far astern: no
  npc.state.x = ship.state.x + STRIKE_RANGE + 600;
  assert.equal(wouldStrike(game, npc, ship), false, 'not from afar');
});
