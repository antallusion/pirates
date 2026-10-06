// docs/23 phase 1: the interface kit (client/src/ui/kit) — the tokens held to one source and to the Pirate Gothic
// palette's rules, every component's pure part (markup, drag and wheel geometry, the toast queue, the risk window's
// words in both languages), and the first screens moved onto it (the question, the departure check, the toasts, the
// pad's wheel).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLang } from '../client/src/i18n.ts';
import { EN, RU } from '../client/src/lang/ui/kit.ts';
import { badgeText, buttonClass, buttonHtml } from '../client/src/ui/kit/button.ts';
import { counterHtml, counterSpeech } from '../client/src/ui/kit/counter.ts';
import { nextFocus } from '../client/src/ui/kit/layer.ts';
import { pickSector, wheelLayout } from '../client/src/ui/kit/radial.ts';
import { RISK, riskHtml, riskView, riskWarns } from '../client/src/ui/kit/risk.ts';
import { dragCloses, dragFollow, sheetHeight } from '../client/src/ui/kit/sheet.ts';
import { chanceBand, targetLineHtml, targetSpeech } from '../client/src/ui/kit/targetline.ts';
import { ToastQueue } from '../client/src/ui/kit/toast.ts';
import { CONTROL, EASE, MOTION, TOAST, toastLife } from '../client/src/ui/kit/tokens.ts';
import { radialSector } from '../client/src/gamepad.ts';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r/g, '');
const tokens = JSON.parse(src('client/src/ui/kit/design-tokens.json')) as Record<string, Record<string, string>>;
const css = src('client/src/ui/kit/kit.css');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function lum(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function saturation(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
}

test('kit tokens: the steps the plan asks for (4 spacings, 3 radii, 4 type sizes, 3 control heights, 3 durations, 2 curves)', () => {
  assert.equal(Object.keys(tokens.space).length, 4);
  assert.equal(Object.keys(tokens.radius).length, 3);
  assert.equal(Object.keys(tokens.fontSize).length, 4);
  assert.equal(Object.keys(tokens.control).length, 3);
  const motion = Object.entries(tokens.motion);
  assert.equal(motion.filter(([k]) => k.includes('dur')).length, 3);
  assert.equal(motion.filter(([k]) => k.includes('ease')).length, 2);
  // Every spacing on the 4-px grid; sizes rising.
  for (const v of Object.values(tokens.space)) assert.equal(parseInt(v) % 4, 0, v);
  const fs = Object.values(tokens.fontSize).map((v) => parseInt(v));
  assert.deepEqual(fs, [...fs].sort((a, b) => a - b));
});

test('kit tokens: kit.css and tokens.ts say what design-tokens.json says (one source)', () => {
  for (const group of Object.values(tokens)) {
    if (typeof group !== 'object') continue;
    for (const [k, v] of Object.entries(group)) assert.ok(rootBlock.includes(`${k}: ${v};`), `${k}: ${v} in kit.css :root`);
  }
  assert.deepEqual([MOTION.fast, MOTION.base, MOTION.slow].map((n) => `${n}ms`), [tokens.motion['--k-dur-1'], tokens.motion['--k-dur-2'], tokens.motion['--k-dur-3']]);
  assert.equal(EASE.out, tokens.motion['--k-ease-out']);
  assert.equal(EASE.inOut, tokens.motion['--k-ease-in-out']);
  assert.deepEqual([CONTROL.dense, CONTROL.touch, CONTROL.main].map((n) => `${n}px`), Object.values(tokens.control));
  // Less motion is kept, by the system's wish and by the game's own option.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ :root \{ --k-dur-1: 0ms; --k-dur-2: 0ms; --k-dur-3: 0ms; \} \}/);
  assert.match(css, /body\.reduce-motion \{ --k-dur-1: 0ms; --k-dur-2: 0ms; --k-dur-3: 0ms; \}/);
  // The page loads it after the older stylesheet.
  const html = src('client/index.html');
  assert.ok(html.indexOf('/src/ui/kit/kit.css') > html.indexOf('/styles.css'));
});

test('kit palette: docs/06 — dark surfaces of low saturation, no pure black or white, readable text', () => {
  const c = tokens.color;
  for (const k of ['--k-ink', '--k-graphite', '--k-slate', '--k-tide', '--k-oak', '--k-haze', '--k-bone']) assert.ok(saturation(c[k]) <= 0.35, `${k} saturation ${saturation(c[k]).toFixed(2)}`);
  for (const v of Object.values(c)) assert.ok(!/^#(000|000000|fff|ffffff)$/i.test(v), v);
  // Text on the surfaces (WCAG AA 4.5:1), the gold of the main button on dark wood.
  assert.ok(contrast(c['--k-bone'], c['--k-ink']) >= 7, 'bone on ink');
  assert.ok(contrast(c['--k-bone'], c['--k-graphite']) >= 7, 'bone on graphite');
  assert.ok(contrast(c['--k-haze'], c['--k-graphite']) >= 4.5, `haze on graphite ${contrast(c['--k-haze'], c['--k-graphite']).toFixed(2)}`);
  assert.ok(contrast(c['--k-gold'], c['--k-oak']) >= 4.5, 'gold on oak');
  for (const k of ['--k-good', '--k-warn', '--k-bad']) assert.ok(contrast(c[k], c['--k-ink']) >= 4.5, `${k} on ink`);
});

test('kit button: three kinds, the phone heights, states, a name for an icon button, a corner count', () => {
  assert.equal(buttonClass({ kind: 'primary' }), 'k-btn k-btn--primary k-btn--lg');
  assert.equal(buttonClass({}), 'k-btn k-btn--secondary k-btn--md');
  assert.equal(buttonClass({ kind: 'icon', size: 'lg', cls: 'x' }), 'k-btn k-btn--icon k-btn--lg x');
  const p = buttonHtml({ kind: 'primary', label: 'Поднять паруса', data: { act: 'undock' }, disabled: true, busy: true, pressed: false });
  assert.match(p, /^<button type="button" class="k-btn k-btn--primary k-btn--lg" disabled aria-busy="true" aria-pressed="false" data-act="undock"><span class="k-btn-l">Поднять паруса<\/span><\/button>$/);
  assert.throws(() => buttonHtml({ kind: 'icon', icon: 'fire' }), /needs a name/);
  const i = buttonHtml({ kind: 'icon', icon: 'fire', glyph: '✹', aria: 'Огонь', badge: 12 });
  assert.match(i, /aria-label="Огонь"/);
  assert.match(i, /<b class="k-badge" aria-hidden="true">9\+<\/b>/);
  assert.doesNotMatch(i, /k-btn-l/, 'an icon button has no words of its own');
  assert.match(buttonHtml({ label: '<b>&' }), /&lt;b&gt;&amp;/);
  assert.deepEqual([0, 1, 9, 10, 99].map(badgeText), ['', '1', '9', '9+', '9+']);
  // The heights in the stylesheet: 44 and 52 on a phone, 36 and 44 with a mouse on a desk; the press, the focus ring.
  assert.match(css, /\.k-btn \{[^}]*min-height: var\(--k-h-2\)/);
  assert.match(css, /\.k-btn--lg \{ min-height: var\(--k-h-3\)/);
  assert.match(css, /\.k-btn:active:not\(:disabled\) \{ transform: scale\(0\.96\)/);
  assert.match(css, /\.k-btn:focus-visible \{ outline: 2px solid var\(--k-gold\)/);
});

test('kit sheet: 60–90% of the height or its words\' height; a drag past a quarter or a flick closes it', () => {
  assert.equal(sheetHeight(undefined), '75dvh');
  assert.equal(sheetHeight(0.4), '60dvh');
  assert.equal(sheetHeight(0.99), '90dvh');
  assert.equal(sheetHeight('auto'), 'auto');
  const h = 300;
  assert.equal(dragCloses(60, 0.1, h), false, 'a short slow drag comes back');
  assert.equal(dragCloses(80, 0.1, h), true, 'past a quarter');
  assert.equal(dragCloses(30, 0.9, h), true, 'a flick');
  assert.equal(dragCloses(10, 2, h), false, 'a twitch is not a flick');
  assert.equal(dragCloses(-200, 2, h), false, 'up never closes');
  assert.equal(dragCloses(160, 0, 900), true, 'a tall sheet: 140 px is enough');
  assert.equal(dragFollow(50), 50);
  assert.ok(dragFollow(-400) >= -16 && dragFollow(-400) < 0, 'it resists being pulled up');
  assert.match(css, /\.k-sheet \{[^}]*max-height: 90dvh/);
});

test('kit wheel: the choices round the finger, all on the screen at its edges; the pull picks by angle, the middle cancels', () => {
  const g = wheelLayout(6, 400, 180, 812, 375, 82, 52);
  assert.equal(g.items.length, 6);
  assert.deepEqual([Math.round(g.items[0].x), Math.round(g.items[0].y)], [400, 98], 'the first straight up');
  for (const it of g.items) assert.equal(Math.round(Math.hypot(it.x - g.cx, it.y - g.cy)), 82);
  // A finger in the bottom-right corner (the «Fire» button): the wheel moves in until every choice is on the screen.
  for (const [x, y] of [[800, 370], [5, 5], [812, 0]] as const) {
    const c = wheelLayout(6, x, y, 812, 375, 82, 52);
    for (const it of c.items) assert.ok(it.x - 26 >= 0 && it.x + 26 <= 812 && it.y - 26 >= 0 && it.y + 26 <= 375, `${x},${y}: ${it.x},${it.y}`);
  }
  assert.equal(pickSector(0, -40, 6), 0, 'up');
  assert.equal(pickSector(40, 0, 4), 1, 'right of four');
  assert.equal(pickSector(0, 40, 4), 2, 'down of four');
  assert.equal(pickSector(-40, 0, 4), 3, 'left of four');
  assert.equal(pickSector(5, 5, 6), -1, 'inside the dead middle');
  // The gamepad's wheel reads its stick by the same rule.
  for (const [x, y] of [[0, -1], [1, 0], [0.7, 0.7], [-0.9, 0.2], [0.1, 0.1]] as const) for (const n of [4, 6, 8]) assert.equal(radialSector(x, y, n), pickSector(x, y, n, 0.5), `${x},${y}/${n}`);
});

test('kit target line: one line — name, ⚓level, hull, the chance chip in its band; spoken whole', () => {
  assert.deepEqual([0.8, 0.6, 0.59, 0.35, 0.34, 0].map(chanceBand), ['good', 'good', 'even', 'even', 'bad', 'bad']);
  setLang('ru');
  const h = targetLineHtml({ name: 'Чёрная <Чайка>', level: 3, hull: 0.5, chance: 0.71, threat: 'easy' });
  assert.match(h, /class="k-target k-threat-easy"/);
  assert.match(h, /Чёрная &lt;Чайка&gt;/);
  assert.match(h, /⚓︎3/);
  assert.match(h, /<i style="width:50%">/);
  assert.match(h, /k-chip--good" aria-hidden="true">71%/);
  assert.equal(targetSpeech({ name: 'Чайка', level: 3, hull: 0.5, chance: 0.71 }), 'Чайка, уровень 3, корпус 50%, шанс победы 71%');
  assert.match(css, /\.k-target \{[^}]*height: var\(--k-h-2\)[^}]*white-space: nowrap/);
  setLang('en');
  assert.equal(targetSpeech({ name: 'Gull', chance: 0.2 }), 'Gull, win chance 20%');
});

test('kit risk window: opens under 35% or two levels up; says «Скорее всего, вы проиграете», the chance, the losses; Рискнуть / Отступить', () => {
  assert.equal(RISK.chance, 0.35);
  assert.equal(riskWarns(0.34), true);
  assert.equal(riskWarns(0.36), false);
  assert.equal(riskWarns(0.6, 2), true);
  assert.equal(riskWarns(0.6, 1), false);
  setLang('ru');
  const v = riskView({ target: 'Утопший Агнец', chance: 0.18, levelGap: 2, lose: { silver: 1420, cargo: true, men: 30, port: true }, gainXpMul: 1.6 });
  assert.equal(v.head.replace(/\u00a0/g, ' '), 'Скорее всего, вы проиграете');
  assert.equal(v.chance, 'Шанс победы: 18%');
  assert.equal(v.above?.replace(/\u00a0/g, ' '), 'на 2 уровня выше вас');
  assert.deepEqual(v.lose.map((x) => x.replace(/\u00a0/g, ' ')), ['1 420 серебра', 'груз из трюма', '30 ваших людей', 'очнётесь в ближайшем порту']);
  assert.equal(v.gain, 'Если победите: опыт ×1,6');
  assert.deepEqual([v.go, v.back], ['Рискнуть', 'Отступить']);
  assert.equal(v.band, 'bad');
  assert.equal(riskView({ target: 'x', chance: 0.3, levelGap: 5 }).above?.replace(/\u00a0/g, ' '), 'на 5 уровней выше вас');
  assert.equal(riskView({ target: 'x', chance: 0.5, levelGap: 2 }).head, 'Тяжёлый бой', 'two up but an even chance: not «most likely lose»');
  const h = riskHtml({ target: 'Агнец', chance: 0.18, levelGap: 3 });
  assert.match(h, /role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="18"/);
  setLang('en');
  const e = riskView({ target: 'Lamb', chance: 0.1, levelGap: 1, lose: { cargo: 12 } });
  assert.deepEqual([e.head, e.above, e.lose[0], e.go, e.back], ['You will most likely lose', 'a level above you', '12 of the cargo', 'Risk it', 'Fall back']);
  // The safe answer has the focus (an Enter does not throw the crew over the rail).
  assert.match(src('client/src/ui/kit/risk.ts'), /data: \{ risk: 'back', autofocus: '' \}/);
});

test('kit toasts: two at most, 2.5 s, the same words counted, a third waits or pushes out one already read', () => {
  assert.equal(TOAST.visible, 2);
  assert.equal(toastLife('good'), 2500);
  assert.equal(toastLife('info'), 2500);
  assert.ok(toastLife('bad') > 2500 && toastLife('advice') > toastLife('bad'));
  const q = new ToastQueue();
  q.push('a', 'good', 0);
  q.push('b', 'good', 100);
  const c = q.push('c', 'good', 300);
  assert.deepEqual(q.visible.map((t) => t.key), ['a', 'b']);
  assert.deepEqual(q.waiting.map((t) => t.key), ['c'], 'nothing read yet: the third waits');
  assert.deepEqual(c.show, []);
  const bump = q.push('a', 'good', 400);
  assert.equal(bump.bump?.[0].count, 2, 'the same words count «×2»');
  assert.equal(q.visible.length, 2);
  // The first two run out (a was refreshed by its repeat), the waiting one comes up.
  const t1 = q.tick(2700);
  assert.deepEqual(t1.hide?.map((t) => t.key), ['b']);
  assert.deepEqual(t1.show?.map((t) => t.key), ['c']);
  assert.deepEqual(q.visible.map((t) => t.key).sort(), ['a', 'c']);
  // A newcomer once the oldest has been up 0.9 s pushes it out at once.
  const d = q.push('d', 'good', 3000);
  assert.deepEqual(d.hide?.map((t) => t.key), ['a']);
  assert.deepEqual(q.visible.map((t) => t.key).sort(), ['c', 'd']);
  // Three wait at most; a refusal keeps its place over the others.
  const w = new ToastQueue();
  w.push('1', 'good', 0);
  w.push('2', 'good', 0);
  w.push('bad', 'bad', 10);
  for (const k of ['3', '4', '5']) w.push(k, 'good', 20);
  assert.equal(w.waiting.length, TOAST.waiting);
  assert.ok(w.waiting.some((t) => t.key === 'bad'), 'the refusal still waits');
  assert.equal(w.nextAt(), 2500);
});

test('kit counter icon: a picture with its number (9+), named for a screen reader; hidden at nought unless kept', () => {
  setLang('ru');
  assert.equal(counterSpeech('Цели', 3), 'Цели: 3');
  const h = counterHtml({ id: 'goals', icon: 'goal', label: 'Цели', n: 12 });
  assert.match(h, /class="k-btn k-btn--icon k-btn--md k-count"/);
  assert.match(h, /aria-label="Цели: 12"/);
  assert.match(h, /data-count="goals"/);
  assert.match(h, />9\+</);
  assert.match(counterHtml({ id: 'n', icon: 'goal', label: 'Вести', n: 0 }), /k-count hidden/);
  assert.match(counterHtml({ id: 'n', icon: 'goal', label: 'Вести', n: 0, keep: true }), /k-count k-count--zero/);
});

test('kit layers: Tab goes round inside the top layer', () => {
  assert.equal(nextFocus(['a', 'b', 'c'], 'c', false), 'a');
  assert.equal(nextFocus(['a', 'b', 'c'], 'a', true), 'c');
  assert.equal(nextFocus(['a', 'b'], null, false), 'a');
  assert.equal(nextFocus(['a', 'b'], 'x', true), 'b', 'focus outside: back in at the end');
  assert.equal(nextFocus([], 'x', false), null);
});

test('kit words: Russian and English twins, no Latin letters left in the Russian', () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const [k, v] of Object.entries(RU)) assert.ok(!/[A-Za-z]{2,}/.test(v.replace(/\{\w+\}/g, '').replace(/\bEsc\b/g, '')), `${k}: ${v}`);
});

test('kit migration: the question, the departure check, the toasts and the pad\'s wheel are the kit\'s; the old styles are gone', () => {
  const confirm = src('client/src/ui/confirm.ts');
  assert.match(confirm, /openSheet\(\{\s*id: 'confirm'/);
  assert.match(confirm, /buttonHtml\(\{ kind: 'primary'/);
  assert.match(src('client/src/ui/depart.ts'), /openSheet\(\{\s*id: 'confirm', cls: 'confirm-panel depart-panel'/);
  const hud = src('client/src/ui/hud.ts');
  assert.match(hud, /private toastQ = new Toasts\(/);
  assert.doesNotMatch(hud, /recentToasts|function toastLife|children\.length > 7/);
  const main = src('client/src/main.ts');
  assert.match(main, /wheel\.open\(innerWidth \/ 2, innerHeight \/ 2/);
  assert.doesNotMatch(main, /\$\('radial'\)/);
  const styles = src('client/styles.css');
  assert.doesNotMatch(styles, /^#confirm \{/m, 'the old centred question frame');
  assert.doesNotMatch(styles, /^#radial/m, 'the old pad wheel');
  assert.doesNotMatch(styles, /nth-child\(n\+3\) \{ display: none !important; \}|nth-child\(n\+6\)/, 'toast caps the queue now keeps');
  assert.doesNotMatch(styles, /@keyframes fadein/);
  assert.doesNotMatch(styles, /\.dp-foot/);
  assert.doesNotMatch(src('client/index.html'), /id="radial"/);
  // The kit's page for QA.
  assert.match(src('client/index.html'), /if \(new URLSearchParams\(location\.search\)\.has\('kit'\)\) import\('\/src\/ui\/kit\/demo\.ts'\);\s*else import\('\/src\/main\.ts'\);/);
});
