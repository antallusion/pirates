// docs/23 (2026-10-09, batch-fight): the hex battle's order book and panel at 1500×600, and the sea fight's camera on a
// desk. Measured in the browser by tools/mobile/fight/book.mjs and cam.mjs; what holds them is held here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EN, RU } from '../client/src/lang/ui/tactical.ts';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the open book lies over the whole battle, not inside the field\'s box (its top row stood 8–9 px over it at 1500×600)', () => {
  const src = read('client/src/ui/tactical.ts');
  const stage = src.split('\n').find((l) => l.includes('<div class="tb-stage">'))!;
  assert.ok(stage, 'the field\'s markup');
  assert.ok(!stage.includes('tb-book'), 'no book inside the field');
  assert.match(src, /<div class="tb-pad"><\/div>\s*<div class="tb-book hidden"><\/div>\s*<\/div>`;/);
});

test('the painted book\'s pages end inside its parchment (73.5 % of the painting at the lowest)', () => {
  const css = read('client/styles.css');
  const m = css.match(/\.tb-book\.bk\.painted \{[^}]*--bk-t: (\d+(?:\.\d+)?)%; --bk-b: (\d+(?:\.\d+)?)%;/);
  assert.ok(m, 'the painted book\'s margins');
  assert.ok(100 - Number(m![2]) <= 73.5 - 1, `pages end at ${100 - Number(m![2])} %`);
  assert.ok(Number(m![1]) >= 11, 'below the parchment\'s top edge');
});

test('a page of the desk\'s panel stands one height every turn; its words take 2, 3 or 4 lines by the screen\'s height', () => {
  const css = read('client/styles.css');
  assert.match(css, /\.tb-root \.tb-spells \.tb-spell \{ box-sizing: border-box; height: calc\(16px \+ 1\.15 \* 14px \+ var\(--pg-lines\) \* 1\.15 \* 11px\); min-height: 0;/);
  assert.match(css, /\.tb-root \.tb-spells \.tb-spell small \{ -webkit-line-clamp: var\(--pg-lines\); line-clamp: var\(--pg-lines\); \}/);
  for (const [h, n] of [['521', 2], ['701', 3], ['861', 4]] as const) {
    assert.ok(new RegExp(`min-height: ${h}px\\) and \\(min-aspect-ratio: 7/5\\) \\{[^@]*--pg-lines: ${n};`).test(css), `${n} lines from ${h} px`);
  }
  // the height a page needs for its name and words never above the height it is given (skinned: 5 + 5 border, 2 + 2 padding)
  for (const n of [2, 3, 4]) assert.ok(14 + 1.15 * 14 + n * 1.15 * 11 <= 16 + 1.15 * 14 + n * 1.15 * 11);
  // 1500×600: the will, the two moves, four pages and the book's button in the field's 462 px
  const page = 16 + 1.15 * 14 + 2 * 1.15 * 11;
  assert.ok(24 + 6 * page + 49 + 7 * 5 <= 462, `${24 + 6 * page + 49 + 7 * 5}`);
});

test('an order\'s whole words: under the mouse, a key\'s focus or a finger held on a phone\'s card; no browser title over them', () => {
  const src = read('client/src/ui/tactical.ts');
  for (const k of ['private wordsHtml(', 'private showWords(', 'private hideWords(', 'private refreshWords(', "'pointerover'", "'focusin'", 'this.wordsHeld = true;', 'e.stopImmediatePropagation();']) assert.ok(src.includes(k), k);
  // the panel's pages and the book's carry no title with the words (the browser's slow tooltip lay over the popover)
  assert.ok(!src.includes('title="${esc(spText(sp.id))}"'));
  assert.ok(!src.includes('title="${esc(`${spName(sp.id)} — ${spText(sp.id)}`)}"'));
  assert.ok(!src.includes('title="${esc(moveText(me.path, kind === \'ult\'))}"'));
  assert.equal(EN['words.level'], 'level {n}');
  assert.equal(RU['words.level'], '{n}-й уровень');
  // over a phone's book (the kit's sheet), under nothing the battle shows
  const z = Number(read('client/styles.css').match(/\.tb-words \{ position: fixed; z-index: (\d+);/)![1]);
  const sheet = Number(read('client/src/ui/kit/kit.css').match(/--k-z-sheet: (\d+);/)![1]);
  assert.ok(z > sheet, `${z} > ${sheet}`);
});

// ------------------------------------------------------------------ the sea fight's camera (client/src/render/camfight.ts)

test('the fight\'s view on a desk keeps a mark at a broadside\'s 140 m inside the screen, clear of the HUD\'s bands', async () => {
  const { FIGHT_BAND, FIGHT_MIN, fightShare } = await import('../client/src/render/camfight.ts');
  const base = (w: number, h: number) => Math.min(2.6, Math.max(1.3, Math.min(w, h) / 260)); // Renderer.resize
  // 1500×600: her own 2.31 px/m put the mark 140 m off the beam 23 px past the bottom edge (measured −17…−20)
  const b1 = base(1500, 600);
  assert.ok(300 - 140 * b1 < 0);
  const z1 = b1 * fightShare(b1, 1500, 600);
  assert.ok(Math.abs(z1 - 1.5) < 0.01, `${z1}`);
  assert.ok(300 - 140 * z1 >= 85, `${300 - 140 * z1} px from the edge`); // the action bar's 70 px and the mark's ring
  // 1440×900: 2.6 → 2.25, the mark 86 → 135 px from the edge
  const b2 = base(1440, 900), z2 = b2 * fightShare(b2, 1440, 900);
  assert.ok(Math.abs(z2 - 2.25) < 0.01, `${z2}`);
  assert.ok(450 - 140 * z2 >= 130);
  // the band always in sight when it can be, never further out than FIGHT_MIN, nothing when it is in sight already
  for (const [w, h] of [[1280, 720], [1920, 1080], [1366, 768], [1024, 640]]) {
    const b = base(w, h), s = fightShare(b, w, h);
    assert.ok(s >= FIGHT_MIN && s <= 1);
    if (s > FIGHT_MIN) assert.ok(Math.min(w, h) / 2 - FIGHT_BAND * b * s >= Math.min(w, h) * 0.125 - 0.5, `${w}×${h}`);
  }
  assert.equal(fightShare(1.2, 1500, 600), 1, 'zoomed out by her own hand: the band is in sight');
  assert.equal(fightShare(4, 1500, 600), FIGHT_MIN, 'zoomed far in: out no further than FIGHT_MIN');
});

test('the fight\'s view eases out at a sign, holds 4 s after the last, eases back; a phone keeps its view', async () => {
  const { FIGHT_HOLD, FightView } = await import('../client/src/render/camfight.ts');
  const f = new FightView();
  const run = (sec: number, sign: boolean, desk = true) => { for (let t = 0; t < sec; t += 1 / 60) f.step(1 / 60, sign, desk); };
  run(0.5, true);
  assert.ok(f.w > 0.5 && f.w < 1, `half a second: ${f.w}`);
  run(1.5, true);
  assert.ok(f.w > 0.98, 'out in two seconds');
  run(FIGHT_HOLD - 0.2, false);
  assert.ok(f.w > 0.98, 'held after the last sign');
  run(0.5, false);
  assert.ok(f.w < 0.98, 'easing back');
  run(4, false);
  assert.ok(f.w < 0.01, `back in: ${f.w}`);
  // the zoom: her own, stepped back by the share as far as the view is out
  f.w = 0.5;
  assert.equal(f.zoom(2, 0.6), 2 * (1 - 0.5 * 0.4));
  // a phone
  const ph = new FightView();
  for (let t = 0; t < 3; t += 1 / 60) ph.step(1 / 60, true, false);
  assert.equal(ph.w, 0);
});

test('the wheel in a fight turns the zoom on the screen at once, and the view is hers till the fight ends', async () => {
  const { FightView } = await import('../client/src/render/camfight.ts');
  const f = new FightView();
  for (let t = 0; t < 3; t += 1 / 60) f.step(1 / 60, true, true);
  const base = 2.3, share = 0.65;
  const shown = f.zoom(base, share);
  const next = f.wheel(base, base / 1.12, share); // a notch out
  assert.ok(Math.abs(next - shown / 1.12) < 1e-9, 'from the zoom on the screen, the wheel\'s way');
  assert.equal(f.w, 0);
  assert.ok(f.user);
  for (let t = 0; t < 1; t += 1 / 60) f.step(1 / 60, true, true);
  assert.equal(f.w, 0, 'hers while the fight goes on');
  for (let t = 0; t < 5; t += 1 / 60) f.step(1 / 60, false, true);
  assert.ok(!f.user, 'the next fight steps back again');
  // at peace the wheel is the wheel
  assert.equal(new FightView().wheel(2, 2.24, 0.65), 2.24);
});

test('a ball on her hull knocks the view a few pixels by the blow, for 0.4 s; a broadside\'s balls add up', async () => {
  const { HitShake, SHAKE_SEC, knockPx } = await import('../client/src/render/camfight.ts');
  assert.equal(knockPx(0), 0);
  assert.ok(Math.abs(knockPx(0.01) - 1.95) < 1e-9);
  assert.ok(Math.abs(knockPx(0.05) - 3.75) < 1e-9);
  assert.equal(knockPx(0.12), 6);
  assert.equal(knockPx(1), 6, 'a few pixels at the most');
  const k = new HitShake();
  k.kick(0.05, 0, 1); // the ball came from her north: the view knocked south
  const o = k.at(0);
  assert.ok(Math.abs(o.y - 3.75) < 1e-9 && Math.abs(o.x) < 1e-9, JSON.stringify(o));
  assert.deepEqual(k.at(SHAKE_SEC), { x: 0, y: 0 });
  let peak = 0, last = 0;
  for (let t = 0; t < 0.6; t += 1 / 60) { const q = k.step(1 / 60); const m = Math.hypot(q.x, q.y); peak = Math.max(peak, m); if (m > 0.3) last = t; }
  assert.ok(peak <= 3.76 && last < SHAKE_SEC, `${peak} ${last}`);
  assert.ok(!k.busy);
  // three balls of one broadside, 0.1 s apart: one knock of their sum
  const b = new HitShake();
  b.kick(0.02, 1, 0);
  b.step(0.1);
  b.kick(0.02, 1, 0);
  b.step(0.1);
  b.kick(0.02, 1, 0);
  assert.ok(Math.abs(b.at(0).x - knockPx(0.06)) < 1e-9);
  // the next broadside, a second later, starts afresh
  b.step(1);
  b.kick(0.01, 1, 0);
  assert.ok(Math.abs(b.at(0).x - knockPx(0.01)) < 1e-9);
});

test('the renderer: the knock and the jitter move the camera (the shader sea with the ships), none with «меньше движения»', () => {
  const src = read('client/src/render/renderer.ts');
  assert.ok(src.includes('const still = opt.reduceMotion || !opt.screenShake;'));
  assert.ok(src.includes('if (still) this.knock.stop();'));
  assert.ok(src.includes('const jit = still ? 0 : this.fx.shake * 4;'));
  assert.ok(src.includes('this.camX = cam.x - ox / this.zoom;'));
  assert.ok(src.includes('g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);'), 'the 2D canvas alone no longer shakes');
  assert.ok(!src.includes('shx * this.dpr'));
  assert.ok(src.includes("this.fight.step(dt, sign, !globalThis.document?.body.classList.contains('touch'));"), 'a phone keeps its view');
  const fx = read('client/src/render/fx.ts');
  assert.ok(fx.includes('this.blows.push({ dmg: e.dmg, x: e.x, y: e.y });'));
});
