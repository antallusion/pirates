// QA playthrough of a fresh Telegram captain (2026-10-22, owner: «баги еще встречаются и они отбивают желание играть»):
// one regression test per logic bug found by tools/mobile/isleqa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pointerTargets } from '../client/src/ui/pointer.ts';
import { TICK_RATE } from '../shared/src/constants.ts';
import { campaignActive, campaignFoes } from '../server/src/game/campaign.ts';
import { questEvent } from '../server/src/game/quests.ts';
import { join, makeGame } from './helpers.ts';

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the opening\'s tavern step: the finger on the tavern\'s own «Нанять N», never on its open tab', () => {
  const t = pointerTargets({ stage: 'c:buy:arms', touch: true, docked: true, battle: false, crewFull: false });
  assert.match(t[0], /data-act="hire_n"/, 'the tavern\'s «Нанять N» first (the sailors\' row is folded)');
  assert.ok(t.indexOf(t.find((x) => x.includes('hire_n'))!) < t.indexOf(t.find((x) => x.includes('data-ptab="tavern"'))!));
  // the port renders that very button
  assert.match(src('client/src/ui/port.ts'), /data: \{ act: 'hire_n', n: this\.hire \}/);
  // an open tab is no target (a tap on it does nothing)
  assert.match(src('client/src/ui/pointer.ts'), /getAttribute\('aria-selected'\) === 'true'\) return false/);
});

test('«Первый залп»: the tender sent after her is her foe in Saltmarrow’s safe water (the frame and «Атаковать» take her, not a shark)', () => {
  const { game } = makeGame();
  const conn = join(game, 'Tender', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Tender')!;
  const p = s.profile!;
  const good = (Object.entries(game.markets.get('saltmarrow')!.goods) as [string, { stock: number }][]).map(([g]) => g).find((g) => !['provisions', 'sailcloth', 'planks', 'timber', 'tar'].includes(g) && (game.markets.get('saltmarrow')!.goods[g as 'rum']?.stock ?? 0) > 1)!;
  for (const m of [{ t: 'trade', good: 'provisions', qty: 1 }, { t: 'trade', good: 'sailcloth', qty: 1 }, { t: 'hire_crew', qty: 1, prof: 'sailor' }, { t: 'trade', good, qty: 1 }] as const) {
    conn.push(m as never);
    for (let i = 0; i < 15 * TICK_RATE; i++) game.step();
  }
  assert.equal(campaignActive(p)?.id, 'c01_02');
  conn.push({ t: 'undock' });
  conn.push({ t: 'goto', key: 'q:c01_02' });
  for (let i = 0; i < 240 * TICK_RATE && !campaignFoes(game, s).length; i++) game.step();
  const foe = game.ships.get(campaignFoes(game, s)[0]!)!;
  assert.ok(foe, 'the tender came');
  assert.ok(game.isHostile(foe, s.ship!), 'the tender is her foe (the HOSTILE bit her target frame reads)');
  // …and hers alone: a Crown patrol beside her leaves the tender be (one sank her struck under the card, the kill the patrol's)
  const patrol = game.spawnNpcShip('patrol', 'cutter', 'crown', foe.state.x + 200, foe.state.y, 0);
  assert.equal(game.isHostile(patrol, foe), false, 'no patrol goes for the campaign’s foe');
  // the step done by another ship of hers, the tender sent for it is called off (she hunted the newcomer on to «Свой берег»)
  const other = game.spawnNpcShip('pirate', 'sloop', 'confederacy', foe.state.x + 50, foe.state.y, 0);
  questEvent(game, s, { k: 'sink', victim: other });
  for (let i = 0; i < 2 * TICK_RATE; i++) game.step();
  assert.equal(campaignActive(p)?.id, 'c01_03');
  if (foe.alive) assert.notEqual(game.npcs.get(foe.id)?.huntAccount, s.accountId, 'the tender of a step done hunts her no more');
});

test('the opening’s struck foe: the finger on the card’s choice that does the step (sink for «Первый залп»)', () => {
  const f = { touch: true, docked: false, battle: false } as const;
  assert.equal(pointerTargets({ ...f, stage: 'c:sink' })[0], '[data-sur="sink"]:not([disabled])');
  assert.equal(pointerTargets({ ...f, stage: 'c:board' })[0], '[data-sur="release"]:not([disabled])');
  assert.match(src('client/src/ui/surrender.ts'), /data-sur="\$\{fate\}"/, 'the card’s buttons carry data-sur');
});

test('the finger finds a step’s button among a phone’s action pills, not only as the gold one', () => {
  const t = pointerTargets({ stage: 'c:found', touch: true, docked: false, battle: false });
  assert.ok(t.includes('.tc-act2[data-act="claim"]'), '«Занять» as a pill');
  assert.ok(t.indexOf('#tc-act[data-act="claim"]') < t.indexOf('.tc-act2[data-act="claim"]'), 'the gold one first');
  assert.ok(pointerTargets({ stage: 'c:neutral', touch: true, docked: false, battle: false }).includes('.tc-act2[data-act="roam"]'));
  assert.match(src('client/src/ui/seahud.ts'), /'tc-actb--primary tc-act' : 'tc-act2'/, 'the pills are .tc-act2');
});

test('a boarding battle that opens shuts an ordinary window over it (its turns ran out unseen under the claim’s terms)', () => {
  const main = src('client/src/main.ts');
  const at = main.indexOf("if (m.t === 'board_tac' && m.view && !hadTac) {");
  assert.ok(at > 0, 'the battle\u2019s opening has a block');
  assert.match(main.slice(at, at + 600), /if \(modal && !ANSWER\.includes\(modal\)\) closeModal\(\);/);
});

test('no wolf pack round a captain in her first quarter of an hour, nor round a foe brought or sent for her', () => {
  const npc = src('server/src/game/npc.ts');
  const line = npc.split(String.fromCharCode(10)).find((l) => l.includes('rallyPack(game, ship, p)'))!;
  for (const need of ['brain.huntFor === undefined', 'brain.huntAccount === null', 'ship.softFor === undefined', '!fresh(game.profileOf(p))', '!inFirstWatch(game, p)']) assert.ok(line.includes(need), need);
});

test('her own town’s island is not offered for lease, nor leased (it was listed at 16 800 a week)', async () => {
  const { claimIsland } = await import('../server/src/game/baseclaim.ts');
  const { ownIsland } = await import('../server/src/game/estate.ts');
  const { holdingsFor, rentIsland } = await import('../server/src/game/holdings.ts');
  const { game } = makeGame();
  join(game, 'Townie', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Townie')!;
  const port = game.portById('saltmarrow')!;
  const isl = game.world.islands.filter((i) => i.region === port.region && !i.portId && !i.minor && i.radius < 400).sort((a, b) => Math.hypot(a.x - port.x, a.y - port.y) - Math.hypot(b.x - port.x, b.y - port.y))[0]!;
  const ship = s.ship!;
  ship.docked = null;
  ship.state.x = isl.x + isl.radius + 120;
  ship.state.y = isl.y;
  assert.equal(claimIsland(game, s, isl.id), null, 'claimed');
  assert.equal(ownIsland(game, s.accountId)?.island, isl.id);
  s.profile!.gold = 1e6;
  assert.match(rentIsland(game, s, isl.id, 7) ?? '', /yours for good/);
  ship.docked = 'saltmarrow';
  assert.ok(!holdingsFor(game, s).region.some((o) => o.island === isl.id), 'not in the harbour office’s list');
});

test('inside Telegram a link out goes by Telegram’s opener (the settings’ legal pages)', async () => {
  const { tgLinkOut } = await import('../client/src/tg.ts');
  const a = (href: string, target = '') => ({ href, target, hasAttribute: () => false });
  const here = 'https://tg.gravetidegame.com/?tg';
  assert.deepEqual(tgLinkOut(a('/site/terms/', '_blank'), here), { url: 'https://tg.gravetidegame.com/site/terms/', tg: false });
  assert.deepEqual(tgLinkOut(a('https://t.me/gravetide_bot'), here), { url: 'https://t.me/gravetide_bot', tg: true });
  assert.equal(tgLinkOut(a('/site/terms/'), here), null, 'a link within the game\u2019s own page stays');
  assert.equal(tgLinkOut(a('javascript:void 0', '_blank'), here), null);
  assert.match(src('client/src/ui/options.ts'), /target="_blank"/, 'the legal links are links out');
});

test('a window’s toast strip goes up when the window has its buttons along its foot', () => {
  assert.match(src('client/src/ui/hud.ts'), /before: \(host\) => \(host === this\.toastsEl \? this\.placeStrip\(\) : placeModalStrip\(host\)\)/);
  assert.match(src('client/styles.css'), /#modal-toasts\.mt-top \{ top: calc\(var\(--sa-t, 0px\) \+ 6px\); bottom: auto; \}/);
});

test('no town on a pirate fortress’s island, and a town already there has the fortress stand down', async () => {
  const { claimBlock } = await import('../server/src/game/baseclaim.ts');
  const { lairOnIsland, lairsAll } = await import('../server/src/game/wanted.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  const { game } = makeGame();
  const lair = lairsAll(game).find((l) => game.world.islands[l.island]?.region === 'black_coast') ?? lairsAll(game)[0]!;
  const isl = game.world.islands[lair.island]!;
  assert.equal(lairOnIsland(game, isl.id)?.id, lair.id);
  assert.match(claimBlock(game, isl) ?? '', /pirate fortress/);
  setLang('ru');
  try {
    assert.match(serverText(claimBlock(game, isl)!), /пиратская крепость/);
  } finally {
    setLang('en');
  }
  assert.match(src('server/src/game/wanted.ts'), /if \(game\.holdings\.onIsland\(game, lair\.island\)\.length\) \{/);
  // the opening's own town (Ravencliff) holds no fortress: the campaign sent the newcomer to found it under its guns
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const town = (QUESTS_BY_ID.c01_05.steps[0] as { island?: number }).island!;
  assert.equal(lairOnIsland(game, town), undefined, 'no lair on «Свой берег»’s island');
  assert.equal(claimBlock(game, game.world.islands[town]!), null);
});
