// docs/23, 2026-10-10 (owner: «должно помещаться без прокрутов всяких»; «даже на самом маленьком экране 270 пикселей…
// может просто резиновый дизайн сделать»): the phone fit's pure parts — the pager's arithmetic (client/src/ui/kit/fit.ts),
// the captain's role on the six cards, the fluid sizes of client/fit.css kept within the owner's limits at 270 and
// 360 px, and the stylesheet loaded last.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gridCols, PAGED, pageAt, pageCols, pageCount, swipeTo } from '../client/src/ui/kit/fit.ts';
import { captainRole } from '../client/src/ui/captain.ts';
import { CAPTAINS, CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import { EN as CEN, RU as CRU } from '../client/src/lang/ui/captain.ts';

test('the pager counts its pages, snaps to one, and turns on a sideways swipe only', () => {
  assert.equal(pageCount(548, 548), 1);
  assert.equal(pageCount(549, 548), 1); // a pixel's rounding is not a page
  assert.equal(pageCount(1096, 548), 2);
  assert.equal(pageCount(1100, 548), 3);
  assert.equal(pageCount(5000, 0), 1);
  assert.equal(pageAt(0, 548, 3), 0);
  assert.equal(pageAt(560, 548, 3), 1);
  assert.equal(pageAt(9999, 548, 3), 2);
  assert.equal(pageAt(-40, 548, 3), 0);
  assert.equal(swipeTo(0, 3, -80, 10), 1);
  assert.equal(swipeTo(1, 3, 80, 10), 0);
  assert.equal(swipeTo(0, 3, 80, 0), null, 'no page before the first');
  assert.equal(swipeTo(2, 3, -80, 0), null, 'no page after the last');
  assert.equal(swipeTo(0, 3, -30, 0), null, 'a short stroke is a tap');
  assert.equal(swipeTo(0, 3, -60, 70), null, 'a mostly upright stroke is not a turn');
});

test('the pager lays a grid out in its own columns, a list in two only where the stylesheet allows and the pane is wide', () => {
  assert.equal(gridCols('none'), 1);
  assert.equal(gridCols('270px 270px'), 2);
  assert.equal(gridCols('190.5px 190.5px 190.5px'), 3); // (a computed value lists each track in px)
  assert.equal(gridCols('100px 100px 100px 100px'), 3, 'three at most');
  assert.equal(pageCols(548, 1, false), 1);
  assert.equal(pageCols(548, 1, true), 2);
  assert.equal(pageCols(470, 1, true), 1, 'two readable columns need 520 px');
  assert.equal(pageCols(470, 3, false), 3);
  for (const sel of ['#modal-panel .modal-body', '.k-sheet-root .k-sheet-body']) assert.ok(PAGED.includes(sel), sel);
});

test('every captain has a role in a few words for its card (the first sentence of the playstyle)', () => {
  for (const id of CAPTAIN_IDS) {
    const r = captainRole(CAPTAINS[id].playstyle);
    assert.ok(r.length > 4 && r.length <= 48, `${id}: «${r}»`);
    assert.ok(/[.!?]$/.test(r), `${id}: a sentence`);
    assert.ok(CAPTAINS[id].playstyle.startsWith(r));
  }
  assert.equal(captainRole('Торговля, скрытность и контрабанда. Избегает боя.'), 'Торговля, скрытность и контрабанда.');
  assert.equal(captainRole('No full stop'), 'No full stop');
  for (const k of ['premiumShort', 'startsShort'] as const) {
    assert.ok(CEN[k] && CRU[k], k);
    assert.ok(!/[A-Za-z]{3,}/.test(CRU[k].replace(/\{\w+\}/g, '')), `RU ${k} has no Latin: ${CRU[k]}`);
  }
});

test('fit.css: one unit from 270 to 360 px tall, every fluid size within the limits (taps 32 → 36, words 10 → 11)', () => {
  const css = readFileSync(new URL('../client/fit.css', import.meta.url), 'utf8');
  assert.match(css, /--u:\s*clamp\(0px,\s*\(100dvh - 270px\) \/ 90,\s*1px\)/);
  const tok = (name: string) => {
    const m = new RegExp(`${name}:\\s*calc\\(([\\d.]+)px \\+ ([\\d.]+) \\* var\\(--u\\)\\)`).exec(css);
    assert.ok(m, name);
    const [a, b] = [Number(m![1]), Number(m![2])];
    return { at270: a, at360: a + b };
  };
  for (const t of ['--f-tap', '--f-btn', '--f-btn2']) {
    const v = tok(t);
    assert.ok(v.at270 >= 32 && v.at360 >= 36 && v.at360 <= 40, `${t} ${JSON.stringify(v)}`);
  }
  for (const t of ['--f-fs-s', '--f-fs', '--f-fs-m']) {
    const v = tok(t);
    assert.ok(v.at270 >= 10 && v.at360 >= 11 && v.at360 <= 13.5, `${t} ${JSON.stringify(v)}`);
  }
  const h = tok('--f-fs-h');
  assert.ok(h.at360 >= 16 && h.at360 <= 18, `headings ${JSON.stringify(h)}`);
  // the phone's rules stay the phone's: none outside a short-screen query (the desk and the tablet keep their sizes)
  const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  assert.ok(!/#modal-panel\s*\{/.test(outside), 'no window rule outside a phone query');
});

test('fit.css is the last stylesheet of the page', () => {
  const html = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(sheets.at(-1), '/fit.css');
});
