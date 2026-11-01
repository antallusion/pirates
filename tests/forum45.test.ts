// Forum 45 (topic 8), the client's part: the ring on a click for every clickable thing (never the hover's), the tap on
// the open sea still sails; «Найти врага»'s list; «К острову» and «Найти врага» in the «⋯» tray; the chart's foot.
// (The barracks under way and the speed that keeps the course: tests/islefirst.test.ts, tests/autosail-always.test.ts.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLang } from '../client/src/i18n.ts';

test('forum 45: a tap on a thing or an island is its ring first, again its own order; the open sea always sails', async () => {
  const { seaTapPlan } = await import('../client/src/ui/deskinput.ts');
  const base = { mark: null, again: false, thing: false, place: null, modal: false, blocked: false } as const;
  assert.equal(seaTapPlan(base), 'sea', 'the open sea: a course there, never a ring');
  assert.equal(seaTapPlan({ ...base, ring: false }), 'sea');
  assert.equal(seaTapPlan({ ...base, thing: true, ring: true }), 'ring', 'a wreck tapped: its ring');
  assert.equal(seaTapPlan({ ...base, thing: true, ring: true, ringAgain: true }), 'thing', 'tapped again with its ring up: picked up');
  assert.equal(seaTapPlan({ ...base, place: 'isle', ring: true }), 'ring', 'an island: its ring');
  assert.equal(seaTapPlan({ ...base, place: 'isle', ring: true, ringAgain: true }), 'place');
  assert.equal(seaTapPlan({ ...base, mark: 'ship' }), 'target', 'a ship or a beast: its own ring (targetmenu)');
  assert.equal(seaTapPlan({ ...base, mark: 'roam', ring: true }), 'target', 'a stack is never a thing ring');
  assert.equal(seaTapPlan({ ...base, thing: true, ring: true, blocked: true }), 'blocked', 'a fight: why, not a ring');
  assert.equal(seaTapPlan({ ...base, thing: true, ring: true, modal: true }), 'none');
  assert.equal(seaTapPlan({ ...base, thing: true }), 'thing', 'a quest beacon (no ring): its run at once');
});

test('forum 45: the ring of each thing — its own order, «Плыть к нему», her island; ⓘ beside', async () => {
  const { thingRingChoices } = await import('../client/src/ui/thingring.ts');
  setLang('ru');
  const ids = (k: Parameters<typeof thingRingChoices>[0]) => thingRingChoices(k).map((c) => `${c.id}:${c.label.replace(/\s/g, ' ')}`);
  assert.deepEqual(ids({ kind: 'wreck', name: 'Обломки' }), ['act:Подобрать', 'go:Плыть к нему']);
  assert.deepEqual(ids({ kind: 'loot', name: 'Добыча' }), ['act:Подобрать', 'go:Плыть к нему']);
  assert.deepEqual(ids({ kind: 'find', name: 'Бутылка' }), ['act:Подобрать', 'go:Плыть к нему']);
  assert.deepEqual(ids({ kind: 'castaway', name: 'Потерпевшие' }), ['act:Спасти', 'go:Плыть к нему']);
  assert.deepEqual(ids({ kind: 'mark', name: 'Буй' }), ['act:Исследовать', 'go:Плыть к нему']);
  assert.deepEqual(ids({ kind: 'mark', name: 'Буй', done: true }), ['go:Плыть к нему'], 'searched already: no «Исследовать»');
  assert.deepEqual(ids({ kind: 'way', name: 'Плавучий рынок' }), ['act:Пришвартоваться', 'go:Плыть к нему']);
  for (const k of ['lair', 'drift', 'adv', 'sight', 'shoal'] as const) assert.deepEqual(ids({ kind: k, name: 'x' }), ['go:Плыть к нему'], k);
  assert.deepEqual(ids({ kind: 'isle', name: 'Остров' }), ['go:Плыть к нему']);
  assert.deepEqual(ids({ kind: 'isle', name: 'Мой', own: true }), ['go:Плыть к нему', 'home:Мой остров']);
  setLang('en');
  assert.deepEqual(thingRingChoices({ kind: 'wreck', name: 'W' }).map((c) => c.label.replace(/\s/g, ' ')), ['Pick up', 'Sail to it']);
});

test('forum 45: the thing a key names in the state (gone: none) and its card', async () => {
  const { thingOf, thingCard } = await import('../client/src/ui/thingring.ts');
  setLang('ru');
  const state = {
    finds: [{ id: 1, kind: 'bottle', x: 100, y: 100, left: 10, ttl: 20, level: 3 }], castaways: [{ id: 2, x: 0, y: 0, n: 4, left: 9 }],
    wrecks: [{ id: 3, x: 500, y: 0, value: 40 }], loot: new Map([[4, { x: 1, y: 1, value: 2 }]]), sights: [], drifts: [], shoals: [],
    adv: { objs: [] }, lairs: { list: [{ id: 'L1', kind: 'crab_beach', role: 'shore', x: 900, y: 0, level: 2, men: 9, down: false, island: 1 }] },
    ways: new Map(), seaMarks: new Map([[5, { id: 5, kind: 'buoy', x: 9, y: 9, r: 20, rot: 0, seed: 1 }]]), markDone: new Set([5]),
    islands: new Map([[7, { id: 7, name: 'Солтмарроу', x: 0, y: 0, r: 300 }]]), self: { homeIsle: 7 },
  } as never;
  assert.equal(thingOf(state, 'wreck:3')?.name, 'Обломки');
  assert.equal(thingOf(state, 'wreck:99'), null, 'gone: the ring goes with it');
  assert.equal(thingOf(state, 'castaway:2')?.name, 'Потерпевшие (4)');
  assert.equal(thingOf(state, 'lair:L1')?.name, 'Крабовый пляж');
  assert.equal(thingOf(state, 'mark:5')?.done, true);
  assert.equal(thingOf(state, 'isle:7')?.own, true);
  const c = thingCard(thingOf(state, 'lair:L1')!, { x: 0, y: 0 });
  assert.equal(c.name[1], 'Крабовый пляж');
  assert.ok(c.rows.some((r) => r.v[1] === '900 м'), 'its distance');
  assert.ok(c.notes?.length, 'its words');
  setLang('en');
});

test('forum 45: the hover only names a target — the ring opens on a click (desk) or a tap (phone), never on the hover', () => {
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  const hover = main.slice(main.indexOf('function hoverTargetMenu('), main.indexOf('let hoverTagEl'));
  assert.ok(hover.length > 50 && !hover.includes('openTargetMenu'), 'the hover opens no ring');
  assert.ok(hover.includes('hoverTag('), 'the hover names it');
  const down = main.slice(main.indexOf("canvas.addEventListener('mousedown'"), main.indexOf('let seaPress'));
  assert.ok(down.includes('openTargetMenu(') && down.includes('openThingRing('), 'a click opens the rings');
  const tap = main.slice(main.indexOf('function seaTap('), main.indexOf('function sailToSpot('));
  assert.ok(tap.includes('openTargetMenu(') && tap.includes("plan === 'ring'"), 'a tap opens the rings');
  // the rings never take the water: their layer lets every pointer through, only their buttons are hit
  const css = readFileSync(new URL('../client/seahud.css', import.meta.url), 'utf8');
  assert.match(css, /\.tm \{[^}]*pointer-events: none/);
  assert.match(css, /\.hover-name \{[^}]*pointer-events: none/);
});

test('forum 45: «Найти врага» — of the kind, about her level, near, the nearest first', async () => {
  const { foeRows, FOE_MAX_D } = await import('../client/src/ui/foefind.ts');
  const foes = [
    { key: 'ship:1', kind: 'pirate', name: 'P far', level: 5, x: 3000, y: 0 },
    { key: 'ship:2', kind: 'pirate', name: 'P near', level: 6, x: 500, y: 0 },
    { key: 'ship:3', kind: 'beast', name: 'Shark', level: 12, x: 200, y: 0 },
    { key: 'roam:4', kind: 'monster', name: 'Stack', level: 4, x: 0, y: 900 },
    { key: 'lair:a', kind: 'lair', name: 'Lair', level: 7, x: 0, y: 1500 },
    { key: 'lair:b', kind: 'lair', name: 'Lair far', level: 5, x: FOE_MAX_D + 10, y: 0 },
  ] as const;
  const own = { x: 0, y: 0 };
  assert.deepEqual(foeRows(foes, own, 5, 'all', 'near').map((r) => r.key), ['ship:2', 'roam:4', 'lair:a', 'ship:1'], 'within ±2, the nearest first, the far lair dropped');
  assert.deepEqual(foeRows(foes, own, 5, 'pirate', 'near').map((r) => r.key), ['ship:2', 'ship:1']);
  assert.deepEqual(foeRows(foes, own, 5, 'beast', 'near').map((r) => r.key), [], 'the shark is ⚓12');
  assert.deepEqual(foeRows(foes, own, 5, 'beast', 'any').map((r) => r.key), ['ship:3']);
  assert.equal(Math.round(foeRows(foes, own, 5, 'lair', 'wide')[0].d), 1500);
});

test('forum 45: «Найти врага» and «К острову» in the «⋯» tray; the chart\'s foot wraps (never one button over another)', async () => {
  const { MORE_ITEMS } = await import('../client/src/ui/hudmore.ts');
  assert.ok(MORE_ITEMS.includes('#touch > #tc-foe' as never) && MORE_ITEMS.includes('#touch > #tc-gohome' as never));
  const wm = readFileSync(new URL('../client/src/ui/worldmap.ts', import.meta.url), 'utf8');
  for (const a of ['data-mwhere', 'data-mhome', 'data-mfoe']) assert.ok(wm.includes(a), a);
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.map-wrap \.map-bar \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.map-wrap \.map-bar \.map-wp-acts \{[^}]*flex-wrap: wrap/);
});
