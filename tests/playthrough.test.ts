// Fixes found in the full playthrough (level 1 to the endgame, in the browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dict, fill, setLang } from '../client/src/i18n.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { serverText } from '../client/src/lang/server.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
const english = (ru: string) => (ru.match(/[A-Za-z]{3,}/g) ?? []).length >= 2;


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
  assert.match(css, /@media \(max-height: 520px\) and \(min-width: 600px\) and \(orientation: landscape\) \{\n  #modal-panel\[data-modal="port"\] \.modal-head[^{]*\{ min-height: 0; \}/);
  // (in one band only where the width allows: at 640 px the name ran out of its plate)
  const m = css.match(/@media \(max-height: 520px\) and \(min-width: 760px\) and \(orientation: landscape\) \{[\s\S]*?\n\}/);
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

test('playthrough: the harbour\'s contracts name their port in apposition («в порт Висельная Губа», never «в Висельная Губа»)', async () => {
  const { serverText } = await import('../client/src/lang/server.ts');
  setLang('ru');
  for (const en of ['Urgent: sealed letters to Gallows Bay', 'Sealed letters to Gallows Bay', 'Deliver 20 Rum to Gallows Bay', 'Hot run: 20 Rum to Gallows Bay']) {
    const ru = serverText(en);
    assert.match(ru, /\sв\sпорт\s/, `${en} → ${ru}`);
  }
  setLang('en');
});

test('playthrough: men desert «в порту Висельная Губа», not «в Висельная Губа»', async () => {
  const { serverText } = await import('../client/src/lang/server.ts');
  setLang('ru');
  assert.match(serverText('3 frightened men desert in Gallowsmouth.'), /^В\sпорту\s/);
  setLang('en');
});

test('playthrough: a woman giver\'s verb takes her ending («Тамсин Мур продала груз»), nouns and others\' verbs keep theirs', async () => {
  const { feminineAfter } = await import('../shared/src/data/questgen.ts');
  assert.equal(feminineAfter('{0} продал груз заранее в порт {1}.', '{0}'), '{0} продала груз заранее в порт {1}.');
  assert.equal(feminineAfter('{0} в молодости дошёл до края.', '{0}'), '{0} в молодости дошла до края.');
  assert.equal(feminineAfter('{0} сорок лет рыбачил здесь.', '{0}'), '{0} сорок лет рыбачила здесь.');
  assert.equal(feminineAfter('{0} так и не увидел его.', '{0}'), '{0} так и не увидела его.');
  assert.equal(feminineAfter('{0} ведёт журнал.', '{0}'), '{0} ведёт журнал.');
  assert.equal(feminineAfter('{0} хочет отогнать от него акул.', '{0}'), '{0} хочет отогнать от него акул.');
  assert.equal(feminineAfter('Посланник ({0}) слышал о нём.', '{0}'), 'Посланник ({0}) слышала о нём.');
  assert.equal(feminineAfter('Муж этой вдовы ({0}) утонул.', '{0}'), 'Муж этой вдовы ({0}) утонул.');
  assert.equal(feminineAfter('Груз купца ({0}) пропал.', '{0}'), 'Груз купца ({0}) пропал.');
  const { serverText } = await import('../client/src/lang/server.ts');
  setLang('ru');
  const ru = serverText('Tamsin Moor has a hold of goods sold ahead to Ironreach and no ship to carry them.');
  assert.match(ru, /продала/, ru);
  assert.match(serverText('Oswin Tarrow has a hold of goods sold ahead to Ironreach and no ship to carry them.'), /продал\s/);
  setLang('en');
});

test('playthrough: a giver\'s card on a phone on its side — her words | the steps and the pay to choose, side by side', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8').replace(/\r/g, '');
  assert.match(css, /\.giver-panel \.confirm-body > \.giver \{ grid-column: 1; grid-row: 1 \/ span 6; \}/);
  assert.match(css, /\.giver-panel \.pay-opt \{ grid-template-columns: auto auto minmax\(0, 1fr\);/);
});

test('playthrough: every delivery job fits a starter sloop\'s hold beside her stores (15 of her 30)', async () => {
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const { GOODS } = await import('../shared/src/data/goods.ts');
  const { QUEST_HOLD } = await import('../shared/src/data/questgen.ts');
  let n = 0;
  for (const q of Object.values(QUESTS_BY_ID)) for (const st of q.steps) {
    if (st.type !== 'pickup' || q.kind !== 'job') continue;
    n++;
    const vol = GOODS[st.good].volume * st.qty;
    assert.ok(vol <= Math.max(QUEST_HOLD, GOODS[st.good].volume * 4) + 1e-9, `${q.id}: ${st.qty} ${st.good} = ${vol}`);
  }
  assert.ok(n > 20, `${n} pickups`);
});

test('playthrough: a veteran\'s journal shows a job\'s pay as the board offered it (307 on the board, 286 in the journal)', async () => {
  const { makeGame, join } = await import('./helpers.ts');
  const { JOBS } = await import('../shared/src/data/quests.ts');
  const { veteranPay } = await import('../shared/src/data/questpay.ts');
  const { game } = makeGame();
  const c = join(game, 'Vet Vance');
  const s = game.sessionByName('Vet Vance')!;
  s.profile!.level = 12;
  c.push({ t: 'undock' });
  c.push({ t: 'dock' } as never);
  (game as unknown as { dockShip(x: unknown, p: unknown): void }).dockShip(s, game.portById(s.profile!.lastPort)!);
  const offers = c.last('port')!.view!.questOffers.filter((o) => o.kind === 'job' && o.category !== 'elite' && !o.blocked);
  const o = offers.map((x) => ({ x, q: JOBS.find((q) => q.id === x.id)! })).find(({ q }) => q && (q.requires.level ?? 1) < 12 && q.steps[0].type !== 'visit')!;
  assert.ok(o, 'a job below her level');
  const vet = veteranPay(12, o.q.requires.level ?? 1);
  assert.ok(vet > 1);
  assert.equal(o.x.silver, Math.round(o.q.reward.silver * vet), 'the board');
  c.push({ t: 'quest', action: 'accept', id: o.q.id, pay: 'silver' });
  game.pushSelf(s, true);
  const shown = (c.last('self')?.self ?? c.last('init')!.self).quests.find((q) => q.id === o.q.id)!;
  assert.equal(shown.silver, o.x.silver, 'the journal says what the board said');
});

test('playthrough: a guild\'s tag may be Russian («СП»), as its field\'s placeholder «ТЕГ» invites', async () => {
  const { makeGame, join } = await import('./helpers.ts');
  const { foundGuild } = await import('../server/src/game/guilds.ts');
  const { game } = makeGame();
  join(game, 'Guild Gwen');
  const s = game.sessionByName('Guild Gwen')!;
  s.profile!.gold = 100000;
  assert.ok(s.ship!.docked);
  assert.equal(foundGuild(game, s, 'Солёные Псы', 'сп'), null);
  assert.equal(game.guilds.of(game, s.accountId)?.tag, 'СП');
  join(game, 'Guild Gil');
  const t = game.sessionByName('Guild Gil')!;
  t.profile!.gold = 100000;
  assert.equal(foundGuild(game, t, 'Other Dogs', 'S!'), 'A tag is 2–4 letters or digits');
  assert.equal(foundGuild(game, t, 'Other Dogs', 'СП'), 'That tag is taken');
});

test('playthrough: every world announcement, ship\'s toast and rumour of the server reads in Russian (the empires\' «[TAG] holds N% of the route nodes…» came in English)', () => {
  const lines = new Map<string, string>();
  for (const dir of ['server/src/game/', 'server/src/']) for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
    const src = readFileSync(dir + f, 'utf8');
    const res = [/announce\(game, `([A-Z\[$][^`]{6,})`\)/g, /announce\(game, '([A-Z][^']{6,})'\)/g, /toastShip\([^,]+, `([A-Z\[$][^`]{6,})`/g, /toastShip\([^,]+, '([A-Z][^']{6,})'/g, /addRumor\([^,]+, [^,]+, `([A-Z\[$][^`]{6,})`/g, /msg: `WORLD: ([^`]{6,})`/g, /worldNews\([^,]*,? ?`([A-Z\[$][^`]{6,})`/g, /toastAll\(`([A-Z\[$][^`]{6,})`/g];
    for (const re of res) for (const m of src.matchAll(re)) {
      const raw = m[1];
      if (/\$\{[^}]*\?/.test(raw) || raw.includes('=>') || raw.includes("'{") || raw.endsWith(String.fromCharCode(92))) continue;
      const pre = /announce|WORLD|worldNews|toastAll/.test(re.source) ? 'WORLD: ' : '';
      lines.set(pre + raw.replace(/\$\{[^}]*\}/g, (x) => (/name|tag|title/i.test(x) ? 'Gallowsmouth' : '7')), `${f}: ${raw}`);
    }
  }
  assert.ok(lines.size > 250, `${lines.size} lines read`);
  setLang('ru');
  applyDataLocale('ru');
  try {
    const left = [...lines].filter(([s]) => english(serverText(s))).map(([s, where]) => `${where}  =>  ${serverText(s)}`);
    assert.deepEqual(left, []);
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});
