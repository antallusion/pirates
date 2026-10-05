// Fixes found in the full playthrough (level 1 to the endgame, in the browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dict, fill, setLang } from '../client/src/i18n.ts';

test('playthrough: an abbreviation at a sentence\'s end keeps one dot («через 5 дн.», not «дн..»)', () => {
  assert.equal(fill('Next: {name}, in {left}.', { name: 'X', left: '5 дн.' }), 'Next: X, in 5 дн.');
  assert.equal(fill('in {left}.', { left: '3 h' }), 'in 3 h.');
  assert.equal(fill('{a}.{b}', { a: '1', b: '2' }), '1.2');
  assert.equal(fill('{a}', {}), '{a}');
  setLang('ru');
  const L = dict({ next: 'Next: {name}, in {left}.' }, { next: 'Следующий: {name}, через {left}.' });
  assert.ok(!L('next', { name: 'Пороховая ночь', left: '5 дн.' }).includes('..'));
  setLang('en');
});

test('playthrough: a phone on its side gives the harbour\'s page room (head in one band, no 118 px painted head)', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8').replace(/\r/g, '');
  const m = css.match(/@media \(max-height: 520px\) and \(min-width: 600px\) and \(orientation: landscape\) \{\n  #modal-panel\[data-modal="port"\] \.modal-head[^{]*\{ min-height: 0; \}[\s\S]*?\n\}/);
  assert.ok(m, 'the landscape harbour head rule');
  assert.match(m[0], /\.port-head \{ grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(m[0], /\.ph-sail \{ flex: 0 0 auto;/);
  assert.match(css, /\.skinned \.icon-tabs \.tab\.active \.ico \{ filter: brightness/);
});

test('playthrough: the First Watch\'s raider never boards her pupil, even broken, and calls no pirate pack', async () => {
  const { makeGame, FakeConn, steps } = await import('./helpers.ts');
  const { PROTOCOL_VERSION } = await import('../shared/src/constants.ts');
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const c = new FakeConn();
  game.attach(c as never);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Pupil Pew' });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'First Watch', tutorial: true });
  const s = game.sessionByName('Pupil Pew')!;
  const ship = s.ship!;
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  assert.equal(c.last('onboarding')!.view.stage, 'gunnery');
  const raider = [...game.ships.values()].find((x) => x.name === 'Red Novice')!;
  assert.ok(raider);
  // Two idle pirates near: no pack may come.
  const idle = [0, 1].map((i) => game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x + 1500 + i * 200, ship.state.y + 1500, 0));
  // The pupil broken (a third of her men, half her hull) and the raider alongside her.
  ship.crew = Math.floor(ship.stats.crewMax * 0.3);
  ship.hull = ship.stats.hullMax * 0.4;
  raider.state.x = ship.state.x + 40;
  raider.state.y = ship.state.y;
  ship.state.speed = 0;
  ship.state.sail = 0;
  ship.protectedUntil = 0; // past her first seconds' grace
  for (let i = 0; i < 20 * 60; i++) {
    steps(game, 1);
    assert.ok(!ship.boarding && !raider.boarding, `no boarding at tick ${i}`);
  }
  for (const x of idle) assert.notEqual(game.npcs.get(x.id)?.target, ship.id, 'no wolf pack round the lesson');
  assert.ok(!c.all('toast').some((m) => /pirate pack/.test(m.msg)), 'no pack warning');
});

test('playthrough: the First Watch\'s lesson is never folded away, and on a short screen it sits beside the fold', async () => {
  const { readFileSync } = await import('node:fs');
  const hud = readFileSync(new URL('../client/src/ui/hud.ts', import.meta.url), 'utf8');
  const folded = hud.match(/const FOLDED = \[([^\]]*)\]/)![1];
  assert.ok(!folded.includes('hud-watch'), 'the lesson is not behind the fold');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8').replace(/\r/g, '');
  const rule = css.match(/body\.hud-folded #hud-stack > :is\(([^)]*)\) \{ display: none !important; \}/)![1];
  assert.ok(!rule.includes('#hud-watch'));
  assert.match(css, /#hud #hud-stack:has\(> #hud-watch:not\(\.hidden\):not\(\.tut-hidden\)\) \{ display: grid; grid-template-columns: 40px minmax\(0, 1fr\);/);
});

test('playthrough: the cast-off check\'s «Buy N · price» is the harbour\'s own walked quote (never under it, within a silver a unit)', async () => {
  const { makeGame, join } = await import('./helpers.ts');
  const { quoteBuy, marketRows } = await import('../server/src/game/economy.ts');
  const { priceMods } = await import('../server/src/game/ports.ts');
  const { walkBuyCost } = await import('../shared/src/data/goods.ts');
  const { game } = makeGame();
  join(game, 'Quill Quay');
  const s = game.sessionByName('Quill Quay')!;
  const port = game.portById('saltmarrow')!;
  const market = game.markets.get(port.id)!;
  const gm = market.goods.provisions!;
  for (const stock of [354, 200, 115, 92, 40, 12]) {
    gm.stock = stock;
    const mods = priceMods(s.ship!, port, s.profile!, game.now, game);
    const row = marketRows(market, mods).find((r) => r.good === 'provisions')!;
    for (const n of [1, 5, 10]) {
      if (n > stock) continue;
      const real = quoteBuy('provisions', gm, n, mods), shown = walkBuyCost('provisions', row.buy, row.stock, n);
      assert.ok(shown >= real && shown <= real + n, `stock ${stock}, ${n}: shown ${shown}, charged ${real}`);
    }
  }
});

test('playthrough: the glass\'s own «too far» never reaches the toasts (the server refuses by toast, not err)', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8').replace(/\r/g, '');
  assert.match(main, /case 'toast':\n(\s*\/\/[^\n]*\n)*\s*if \(GLASS_QUIET\.has\(m\.msg\)\) break;/);
  const raiding = readFileSync(new URL('../server/src/game/raiding.ts', import.meta.url), 'utf8');
  for (const m of main.match(/const GLASS_QUIET = new Set\(\[([^\]]*)\]\)/)![1].match(/'[^']*'/g)!) assert.ok(raiding.includes(`return ${m};`), m);
});

test('playthrough: a First Watch tow gives back the men the lesson\'s guns cut down (towed home with 3 of 24)', async () => {
  const { makeGame, FakeConn, steps } = await import('./helpers.ts');
  const { PROTOCOL_VERSION } = await import('../shared/src/constants.ts');
  const { game } = makeGame();
  const c = new FakeConn();
  game.attach(c as never);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Towed Tam' });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'First Watch', tutorial: true });
  const s = game.sessionByName('Towed Tam')!;
  const ship = s.ship!;
  steps(game, 21); // a second in port: her men as they stand
  const men = ship.crew;
  assert.ok(men >= 20);
  c.push({ t: 'undock' });
  steps(game, 21);
  ship.crew = 3; // grape and round shot
  ship.hull = 0;
  game.beginSinking(ship);
  steps(game, 20 * 8);
  assert.equal(c.last('sunk_self')!.towed, true);
  assert.ok(ship.docked);
  assert.equal(ship.crew, men, 'her men back with the tow');
});

test('playthrough: a boarding\'s spoils on a phone on its side — the hold and the coin | her fate, the fates two to a row', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8').replace(/\r/g, '');
  assert.match(css, /#modal-panel\[data-modal="boarding"\] \.modal-head[^{]*\{ min-height: 0; \}/);
  assert.match(css, /#modal-panel\[data-modal="boarding"\] \.cols > div:last-child > \.card:last-child \{ grid-column: 2; grid-row: 1 \/ span 4; \}/);
  assert.match(css, /#modal-panel\[data-modal="boarding"\] \.choice-grid\.one \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  const { DIALOGS_RU } = await import('../client/src/lang/ui/dialogs.ts').then((m) => ({ DIALOGS_RU: (m as Record<string, Record<string, string>>)[Object.keys(m).find((k) => /RU/.test(k))!] }));
  assert.match(DIALOGS_RU['board.sub'], /Их потери: \{theirs\} чел\./);
});

test('playthrough: she lies to beside her prize while the spoils are open — the helm held full sail and the prize «drifted too far»', async () => {
  const { makeGame, join, steps } = await import('./helpers.ts');
  const { headingVec } = await import('../shared/src/math.ts');
  const { tacAction } = await import('../server/src/game/tactical.ts');
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const c = join(game, 'Spoils Sal', 'reaver');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === 'Spoils Sal')!;
  const ship = s.ship!;
  Object.assign(ship.state, { x: 30000, y: 80000, heading: 0, speed: 0 });
  ship.protectedUntil = 0;
  s.profile!.level = 30;
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const v = headingVec(-Math.PI / 2);
  const npc = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x + v.x * 18, ship.state.y + v.y * 18, 0);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.cargo = { rum: 10 };
  npc.hull = npc.stats.hullMax * 0.4;
  npc.crew = 4;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  for (let i = 0; i < 20 * 120 && !s.pendingBoarding; i++) {
    if (ship.boarding) tacAction(game, ship, { a: 'quick' });
    steps(game, 1);
  }
  assert.ok(s.pendingBoarding, 'won, the spoils open');
  // The captain's helm still asks for full sail (the touch wheel's course, the keys) for a minute of reading.
  for (let i = 0; i < 60; i++) {
    c.push({ t: "input", seq: 100 + i, rudder: 0, sail: 3 });
    steps(game, 20);
  }
  const d = Math.hypot(npc.state.x - ship.state.x, npc.state.y - ship.state.y);
  assert.ok(d < 400, `still by her prize: ${Math.round(d)} m`);
  const gold = s.profile!.gold;
  c.push({ t: 'loot_take', take: { rum: 5 }, fate: 'ransom' });
  assert.ok(!c.all('toast').some((m) => /drifted too far|slipped away/.test(m.msg)));
  assert.ok(s.profile!.gold > gold, 'the purse and the ransom paid');
  // Settled: the helm is hers again.
  c.push({ t: 'input', seq: 200, rudder: 0, sail: 3 });
  assert.ok(ship.input.sailTarget > 0);
});

test('playthrough: the cabin\'s twelve doors on a phone on its side, two rows of six; the lessons name the real buttons', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8').replace(/\r/g, '');
  assert.match(css, /#modal-panel\[data-modal="menu"\] \.menu-grid \{ grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);/);
  const { RU } = await import('../client/src/lang/ru.ts');
  const { EN } = await import('../client/src/lang/en.ts');
  assert.match(RU['stage.recruit.touch'], /«В порт»/);
  assert.match(RU['stage.recruit.touch'], /«Нанять армию»/);
  assert.match(EN['stage.recruit.touch'], /«Recruit an army»/);
  assert.match(RU['stage.cast_off.touch'], /«Поднять паруса»/);
});

test('playthrough: a drift\'s card leads a lair\'s, and on a short screen its ways and «Fight» stand two by two in the top band', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../client/src/ui/advcard.ts', import.meta.url), 'utf8');
  assert.ok(src.indexOf('if (dc) html += driftBlock') < src.indexOf('if (lc) html += lairBlock'), 'the drift first');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8').replace(/\r/g, '');
  assert.match(css, /#advcard \.ac-dcard:not\(\.open\) \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test('playthrough: a rescue\'s needle game stays on the folded card of a short screen (the fold hid the whole game)', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8').replace(/\r/g, '');
  assert.match(css, /#advcard \.ac-card:not\(\.open\) > \.dm-mini \{ display: block !important;/);
  assert.match(css, /#advcard \.ac-card:not\(\.open\) \.dm-mini \.btn \{[^}]*white-space: nowrap;/);
});
