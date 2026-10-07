// docs/23 phase 2: the sea HUD on a phone held sideways — the sea and five buttons (client/src/ui/seahud.ts,
// client/src/touch.ts). The pure parts: the stick's pull as the sail, the small refusals that flash instead of a
// toast, «Особое»'s pick, the count of things to touch (seven at most), the wheel that holds the fire wheel's twelve,
// the old touch buttons gone from the page, and the First Watch's phone texts naming the new buttons.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bestSpecial, pettyOf, SEA_TILES, seaTargets, stickSail } from '../client/src/ui/seahud.ts';
import type { SeaView } from '../client/src/ui/seahud.ts';
import { pickSector, WHEEL_MAX, wheelLayout } from '../client/src/ui/kit/radial.ts';
import { EN as SEN, RU as SRU } from '../client/src/lang/ui/seahud.ts';
import { EN } from '../client/src/lang/en.ts';
import { RU } from '../client/src/lang/ru.ts';
import { EN as FEN, RU as FRU } from '../client/src/lang/ui/seafight.ts';
import { EN as AEN, RU as ARU } from '../client/src/lang/ui/actbar.ts';

test('the stick: the dead middle keeps the sail, the pull sets 1–4 steps, full sail at the rim and past it', () => {
  assert.equal(stickSail(5, 48, 13), null);
  assert.equal(stickSail(14, 48, 13), 1);
  assert.equal(stickSail(25, 48, 13), 2);
  assert.equal(stickSail(35, 48, 13), 3);
  assert.equal(stickSail(48, 48, 13), 4);
  assert.equal(stickSail(90, 48, 13), 4);
  // monotone: a farther pull never asks for less sail
  let last = 0;
  for (let d = 13; d < 60; d++) {
    const s = stickSail(d, 48, 13)!;
    assert.ok(s >= last, `${d}`);
    last = s;
  }
});

test('the small refusals flash a button instead of a toast; the rest stay toasts', () => {
  assert.equal(pettyOf('Guns are still loading'), 'fire');
  assert.equal(pettyOf('She is not on your beam'), 'fire');
  assert.equal(pettyOf('No ship in reach of your guns'), 'fire');
  assert.equal(pettyOf('Double Shot is not ready'), 'special');
  assert.equal(pettyOf('Last Volley needs full resolve (40/100) — trade blows to build it'), 'special');
  assert.equal(pettyOf('The crew is still hauling the braces (4 s)'), 'stick');
  assert.equal(pettyOf('Take in sail before entering harbour'), null);
  assert.equal(pettyOf('Safe waters: no PvP here.'), null);
});

test('«Особое»: the ultimate when it is ready, else the strongest stroke ready, none when nothing is', () => {
  const a = (id: string, ready: boolean, cooldown: number, kind: 'active' | 'ultimate' = 'active') => ({ id, ready, cooldown, kind });
  assert.equal(bestSpecial([a('z', true, 30), a('x', true, 20), a('c', true, 40), a('v', true, 150, 'ultimate')]), 'v');
  assert.equal(bestSpecial([a('z', true, 30), a('x', true, 20), a('c', false, 40), a('v', false, 150, 'ultimate')]), 'z');
  assert.equal(bestSpecial([a('z', false, 30), a('v', false, 150, 'ultimate')]), null);
});

test('seven things to touch at most on the sea, in every state of the HUD, on a touch screen and on a desk', () => {
  const tg = { name: 'Covenant', level: 1, hull: 1, crew: 0.7, chance: 0.6 };
  for (const touch of [true, false, undefined]) for (const docked of [false, true]) for (const fight of [false, true, undefined]) for (const act of [null, { id: 'attack', icon: 'x', label: 'Атаковать', more: 3 }]) for (const special of [null, { id: 'v', icon: 'ab_v', name: 'V' }]) for (const target of [null, tg]) for (const news of [0, 5]) {
    const v: SeaView = { docked, touch, fight: fight === undefined ? undefined : fight || !!target, act, special, target, ammo: 'round', ammoN: 60, reload: 1, news, unread: 2 };
    const t = seaTargets(v);
    assert.ok(t.length <= 7, `${JSON.stringify(v)} → ${t.join(',')}`);
    if (touch === false) {
      // the desk plays by its keys (owner, 2026-10-07): no stick, no fight buttons
      assert.ok(!t.includes('stick') && !t.includes('fire') && !t.includes('ammo') && !t.includes('lock'), t.join(','));
      continue;
    }
    const inFight = !docked && (v.fight ?? !!target);
    if (inFight) {
      assert.ok(!t.includes('minimap') && !t.includes('news'), 'a fight puts the minimap and the counter away');
      assert.ok(t.includes('fire') && t.includes('stick') && t.includes('ammo') && t.includes('lock'), 'a fight: «Огонь», «Снаряд», «Цель» and the helm');
    } else if (!docked) {
      // leaving port (owner, 2026-10-07: «давать только штурвал и всё необходимое»): the helm, no guns
      assert.ok(t.includes('stick') && !t.includes('fire') && !t.includes('special'), t.join(','));
    } else assert.ok(t.includes('cast') && !t.includes('stick'), 'in port: «В море», no helm');
  }
});

test('the menu: eight big tiles, «Ещё» among them', () => {
  assert.equal(SEA_TILES.length, 8);
  assert.ok(SEA_TILES.some((x) => x.id === 'more'));
  assert.ok(SEA_TILES.some((x) => x.id === 'map'));
});

test('the wheel holds twelve and keeps every choice on a phone held sideways', () => {
  assert.equal(WHEEL_MAX, 12);
  for (const [W, H] of [[812, 375], [640, 360]]) for (const [x, y] of [[W - 40, H - 40], [W / 2, H / 2], [40, 40]]) {
    const g = wheelLayout(12, x, y, W, H, 82, 44, 6);
    for (const it of g.items) assert.ok(it.x - 22 >= 0 && it.x + 22 <= W && it.y - 22 >= 0 && it.y + 22 <= H, `${W}×${H} at ${x},${y}: ${it.x},${it.y}`);
    // neighbours a finger's width apart
    const d = Math.hypot(g.items[0].x - g.items[1].x, g.items[0].y - g.items[1].y);
    assert.ok(d >= 50, `${d}`);
  }
  assert.equal(pickSector(0, -60, 12), 0);
});

test('the old touch buttons are gone from the page and the stylesheet', () => {
  const html = readFileSync('client/index.html', 'utf8');
  const css = readFileSync('client/styles.css', 'utf8');
  for (const id of ['tc-sail', 'tc-sail-up', 'tc-sail-down', 'tc-port', 'tc-starboard', 'tc-chasers', 'tc-dash', 'tc-mount', 'tc-context', 'tc-ctx-row']) {
    assert.ok(!html.includes(`id="${id}"`), `${id} in index.html`);
    assert.ok(!new RegExp(`#${id}\\b`).test(css), `#${id} in styles.css`);
  }
  assert.ok(html.includes('id="tc-stick"'));
});

test('the sea HUD speaks both languages, the Russian without Latin', () => {
  assert.deepEqual(Object.keys(SRU).sort(), Object.keys(SEN).sort());
  for (const [k, v] of Object.entries(SRU)) assert.ok(!/[A-Za-z]{2,}/.test(v.replace(/\{\w+\}/g, '')), `${k}: ${v}`);
});

test('the First Watch on a phone names the new buttons, not the old ones (docs/23 item 79: the very words on them)', () => {
  const ru = RU as Record<string, string>, en = EN as Record<string, string>;
  const word = (d: Record<string, string>, k: string) => `«${d[k].replace(/\s*\[.*\]$/, '')}»`;
  assert.ok(ru['stage.attack.touch'].includes(word(FRU, 'a.attack')) && en['stage.attack.touch'].includes(word(FEN, 'a.attack')));
  assert.ok(ru['stage.fire.touch'].includes(word(SRU, 'fire')) && en['stage.fire.touch'].includes(word(SEN, 'fire')));
  assert.ok(ru['stage.board.touch'].includes(word(ARU, 'a.board')) && en['stage.board.touch'].includes(word(AEN, 'a.board')));
  assert.ok(ru['stage.port.touch'].includes(word(ARU, 'a.dock')) && en['stage.port.touch'].includes(word(AEN, 'a.dock')));
  assert.match(ru['stage.sail.touch'], /штурвал/i);
  // One action each, no paragraphs: a step's line is a short sentence.
  for (const id of ['sail', 'attack', 'fire', 'board', 'port']) for (const d of [ru, en]) for (const k of [`stage.${id}`, `stage.${id}.touch`, `stage.${id}.body`]) assert.ok(d[k].length <= 48, `${k}: ${d[k]}`);
  for (const k of ['hint.repair.touch', 'hint.docking.touch']) {
    assert.match(ru[k], /«Действие»/, k);
    assert.match(en[k], /«Action»/, k);
  }
  for (const [k, v] of Object.entries(ru)) if (k.endsWith('.touch')) assert.ok(!/Стрелки у штурвала|Две кнопки с пушками|Бортовые кнопки|кнопки бортов/.test(v), `${k}: an old button`);
  for (const [k, v] of Object.entries(en)) if (k.endsWith('.touch')) assert.ok(!/The arrows by the wheel|two gun buttons|broadside buttons/.test(v), `${k}: an old button`);
});

test('the fire wheel of twelve at the screen corner is a grid over the finger: on the screen, a finger apart, the lit choice the one under the finger', async () => {
  const { wheelGrid, nearestChoice } = await import('../client/src/ui/kit/radial.ts');
  for (const [W, H] of [[812, 375], [640, 360]]) {
    const x = W - 50, y = H - 50; // «Огонь» in the corner
    const g = wheelGrid(12, x, y, W, H, 44);
    for (const it of g.items) {
      assert.ok(it.x - 22 >= 0 && it.x + 22 <= W && it.y - 22 >= 0 && it.y + 22 <= H, `${W}×${H}: ${it.x},${it.y}`);
      assert.ok(it.y + 22 <= y - 18, 'every choice above the finger, none under the thumb');
    }
    for (let i = 0; i < g.items.length; i++) for (let j = i + 1; j < g.items.length; j++) {
      assert.ok(Math.hypot(g.items[i].x - g.items[j].x, g.items[i].y - g.items[j].y) >= 50, 'a finger apart');
    }
    for (let i = 0; i < g.items.length; i++) assert.equal(nearestChoice(g.items, g.items[i].x + 6, g.items[i].y - 5, 44 * 0.85), i);
    assert.equal(nearestChoice(g.items, x, y, 44 * 0.85), -1, 'still on the button: nothing taken');
  }
});
