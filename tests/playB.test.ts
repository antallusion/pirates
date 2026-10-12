// The QA playthrough B (docs/30_PLAYTHROUGH_B.md): the mid game, levels 20–40 — the faults found on the way that are
// not covered by a system's own test file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lacking } from '../server/src/game/base.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';

test('the yard lacking goods her own hold carries says so: lie off the island and build from there', () => {
  const h = { store: {} } as never, y = { res: { gunpowder: 2 } } as never;
  const s = { ship: { cargo: { gunpowder: 10, pearls: 1 } } } as never;
  const away = lacking(h, y, s, false, { gunpowder: 8 })!;
  assert.match(away, /^The yard lacks 6 gunpowder: your hold has it/);
  assert.equal(lacking(h, y, s, true, { gunpowder: 8 }), null, 'lying off: the hold counts');
  assert.equal(lacking(h, y, s, false, { pearls: 2 }), 'The yard lacks 2 pearls.', 'not in the hold either: as before');
  setLang('ru');
  applyDataLocale('ru');
  try {
    const ru = serverText(away);
    assert.ok(/порох/.test(ru) && /трюме/.test(ru) && /\b6\b/.test(ru), ru);
    assert.doesNotMatch(ru, /[A-Za-z]/, 'no English left');
  } finally {
    setLang('en');
    applyDataLocale('en');
  }
});

test('a lair beaten counts on one job only, the one that names that lair first (not every «break 3 lairs» taken)', async () => {
  const { makeGame, join } = await import('./helpers.ts');
  const { questEvent } = await import('../server/src/game/quests.ts');
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const { game } = makeGame();
  join(game, 'Lair Lu');
  const s = game.sessionByName('Lair Lu')!;
  const p = s.profile!;
  const cull = QUESTS_BY_ID['lj_hollowmere_cull'], cull2 = QUESTS_BY_ID['lj_hollowmere_cull_2'], clear = QUESTS_BY_ID['lj_hollowmere_clear'];
  assert.ok(cull && cull2 && clear, 'the harbour posts two culls and a clearing');
  const at = clear.steps[0] as { island: number; kind: string };
  p.quests.active.push({ id: cull.id, step: 0, progress: 0, startedAt: game.now }, { id: cull2.id, step: 0, progress: 0, startedAt: game.now }, { id: clear.id, step: 0, progress: 0, startedAt: game.now });
  questEvent(game, s, { k: 'lair', island: at.island, kind: at.kind } as never);
  const st = (id: string) => p.quests.active.find((q) => q.id === id) ?? { step: 9, progress: 9 };
  assert.equal(st(clear.id).step, 1, 'the clearing of that very lair is done');
  assert.equal(st(cull.id).progress + st(cull2.id).progress, 0, 'the culls are not filled by the same fight');
  questEvent(game, s, { k: 'lair', island: at.island + 1, kind: at.kind } as never);
  assert.equal(st(cull.id).progress + st(cull2.id).progress, 1, 'another lair: one cull counts it');
});

test('a trade-in counts the refits and the guns she paid for (a brig ⚓7 with 18-pounders was worth a bare brig ⚓5)', async () => {
  const { makeGame, join, onHull } = await import('./helpers.ts');
  const { shipValue } = await import('../server/src/game/ports.ts');
  const { refitCost } = await import('../shared/src/data/shiplevel.ts');
  const { GUNS } = await import('../shared/src/data/ships.ts');
  const { game } = makeGame();
  join(game, 'Trade Tam');
  const ship = game.sessionByName('Trade Tam')!.ship!;
  onHull(game, ship, 'brig', 5);
  const bare = shipValue(ship);
  assert.equal(bare, 12500, 'a bare brig ⚓5 is her class price');
  ship.loadout.guns = { port: 'heavy_18', starboard: 'heavy_18' };
  onHull(game, ship, 'brig', 7);
  const guns = (GUNS.heavy_18.price - GUNS.medium_12.price) * ship.stats.gunsPerSide; // two sides at half
  const refits = (refitCost(6)!.silver + refitCost(7)!.silver) / 2;
  assert.equal(shipValue(ship), bare + guns + refits);
  assert.ok(shipValue(ship) > bare * 3, `worth ${shipValue(ship)} against ${bare}`);
});

test('a job\'s landing goes before the island\'s creatures: the arc\'s pirate camp on Slagvent, not its Ape Ridge', async () => {
  const { makeGame, join, steps } = await import('./helpers.ts');
  const { quietAdv } = await import('../server/src/game/advmap.ts');
  const { QUESTS_BY_ID } = await import('../shared/src/data/quests.ts');
  const { lairList } = await import('../server/src/game/beastlairs.ts');
  const { closestOnPolygon } = await import('../shared/src/math.ts');
  const { isLand } = await import('../shared/src/world/worldgen.ts');
  const { game } = makeGame();
  quietAdv(game, false); // the island's creatures awake
  const c = join(game, 'Camp Cass');
  const s = game.sessionByName('Camp Cass')!;
  const p = s.profile!, ship = s.ship!;
  // Any arc's landing at a pirate camp on an island with a lair of creatures (in the world as generated: Slagvent).
  const camps = Object.values(QUESTS_BY_ID).filter((x) => x.steps.some((st) => st.type === 'land' && st.site === 'pirate_camp' && lairList(game).some((l) => l.island === st.island)));
  const isleOf = (x: (typeof camps)[number]) => game.world.islands[(x.steps.find((st) => st.type === 'land') as { island: number }).island];
  const q = camps.sort((a, b) => isleOf(a).radius - isleOf(b).radius)[0]; // the smallest such island: no shore out of the lair's reach
  assert.ok(q, 'an arc lands at a camp on a lair\'s island');
  const step = q.steps.findIndex((st) => st.type === 'land');
  const st = q.steps[step] as { island: number };
  p.level = 40;
  p.quests.active.push({ id: q.id, step, progress: 0, startedAt: game.now });
  // Off her shore, in reach of the boats.
  if (ship.docked) c.push({ t: 'undock' });
  const is = game.world.islands[st.island];
  let at: [number, number] | null = null;
  for (let r = 20; r < is.radius + 260 && !at; r += 15) for (let k = 0; k < 36 && !at; k++) {
    const a = (k / 36) * Math.PI * 2, x = is.x + Math.sin(a) * r, y = is.y - Math.cos(a) * r;
    const d = Math.sqrt(closestOnPolygon(x, y, is.poly).d2);
    if (!isLand(game.world, x, y) && d > 40 && d < 150) at = [x, y];
  }
  ship.state = { ...ship.state, x: at![0], y: at![1], speed: 0, sail: 0 };
  ship.region = is.region;
  game.grid.upsert(ship.id, at![0], at![1]);
  steps(game, 25);
  assert.equal(s.landable?.feature, 'pirate camp', `the land key offers her job's site (${JSON.stringify(s.landable)})`);
  c.push({ t: 'land' });
  for (let i = 0; i < 200 && !ship.landing; i++) steps(game, 1); // (she heaves to first)
  assert.equal(ship.landing?.feature, 'pirate_camp', `the boats go for the camp, not the creatures (${JSON.stringify(c.all('toast').slice(-3).map((x) => x.msg))} ${JSON.stringify(ship.landing)})`);
  assert.ok(!c.all('toast').some((x) => /against the/.test(x.msg)), 'no fight with the creatures ashore');
  steps(game, 20 * 60);
  // A named pirate's camp (Slagvent's is): her battery drove the boats off — and said what to do.
  const { lairsAll, lairAdmin } = await import('../server/src/game/wanted.ts');
  const lair = lairsAll(game).find((l) => l.island === st.island);
  if (lair) {
    assert.ok(c.all('toast').some((x) => /Silence it with your guns first/.test(x.msg)), 'the repulse says what to do');
    lairAdmin(game, lair.id, 'silence');
    lairAdmin(game, lair.id, 'sink');
    c.push({ t: 'land' });
    for (let i = 0; i < 200 && !ship.landing; i++) steps(game, 1);
    steps(game, 20 * 60);
    assert.ok(c.all('toast').some((x) => /is stormed/.test(x.msg)), 'the camp stormed');
  }
  const left = p.quests.active.find((a) => a.id === q.id);
  assert.ok(!left || left.step > step, 'the landing counts for the job');
});
