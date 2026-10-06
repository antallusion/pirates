// docs/23 phases 7–8 on the client: the First Watch's finger (which button for which step, where it stands), the
// vibration's pulses and their option, the optional things shut by body classes, the sea's news held out of a fight,
// the fast start, the safe area — the parts that need no browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pointerSpot, pointerTargets } from '../client/src/ui/pointer.ts';
import { BUZZ, BUZZ_GAP, mayBuzz } from '../client/src/haptics.ts';
import { sanitize } from '../client/src/settings.ts';
import { buildActs } from '../client/src/ui/actbar.ts';

const css = readFileSync(new URL('../client/feel.css', import.meta.url), 'utf8').replace(/\r/g, '');

test('the finger points at the one button each step wants (docs/23 items 79–80)', () => {
  const base = { touch: true, docked: false, battle: false };
  assert.deepEqual(pointerTargets({ ...base, stage: 'sail', docked: true })[0], '[data-act="undock"]', 'in port: «Поднять паруса»');
  assert.deepEqual(pointerTargets({ ...base, stage: 'sail' }), ['#tc-stick'], 'at sea: the wheel');
  assert.deepEqual(pointerTargets({ ...base, stage: 'sail', touch: false }), [], 'a desk steers by keys');
  assert.equal(pointerTargets({ ...base, stage: 'attack' })[0], '#tc-act[data-act="attack"]');
  assert.deepEqual(pointerTargets({ ...base, stage: 'fire' }), ['#tc-fire']);
  // «На абордаж»: closing in, only the grapples' button; held off at gun range, «Сблизиться»; no pursuit, «Атаковать».
  assert.deepEqual(pointerTargets({ ...base, stage: 'board', pursuit: 'board' }), ['#tc-act[data-act="board"]', '.act-btn.act-board']);
  assert.ok(pointerTargets({ ...base, stage: 'board', pursuit: 'guns' }).includes('#tc-act[data-act="attack_mode"]'));
  assert.ok(!pointerTargets({ ...base, stage: 'board', pursuit: 'board' }).includes('#tc-act[data-act="attack_mode"]'), 'never «Бортами» while he runs in');
  assert.ok(pointerTargets({ ...base, stage: 'board', pursuit: null }).includes('#tc-act[data-act="attack"]'));
  assert.deepEqual(pointerTargets({ ...base, stage: 'board', battle: true }), [], 'the hexes have their own buttons');
  // «В порт»: the prize first, then the button; quiet while the helmsman sails her home.
  const port = pointerTargets({ ...base, stage: 'port' });
  assert.equal(port[0], '[data-fate="ransom"]');
  assert.ok(port.includes('#tc-act[data-act="homeport"]') && port.includes('#tc-act[data-act="dock"]'));
  assert.deepEqual(pointerTargets({ ...base, stage: 'port', helmsman: true }), ['[data-fate="ransom"]', '[data-fate="sink"]']);
  assert.deepEqual(pointerTargets({ ...base, stage: null }), [], 'the watch over: no finger');
});

test('the finger stands left of a button pointing right; at the left edge above it, or below one in the top band', () => {
  const W = 812, H = 375;
  const fire = pointerSpot({ left: 718, top: 280, width: 84, height: 84 }, 44, W, H);
  assert.equal(fire.dir, 'right');
  assert.ok(fire.x + 44 <= 718 && fire.y >= 4 && fire.y + 44 <= H - 4, 'left of «Огонь», on the screen');
  const choice = pointerSpot({ left: 330, top: 200, width: 226, height: 52 }, 44, W, H);
  assert.equal(choice.dir, 'right', 'a choice in a grid: from its side, not over the one above');
  const stick = pointerSpot({ left: 10, top: 240, width: 126, height: 126 }, 44, W, H);
  assert.equal(stick.dir, 'down');
  assert.ok(stick.y + 44 <= 240);
  const corner = pointerSpot({ left: 8, top: 6, width: 40, height: 40 }, 44, W, H);
  assert.equal(corner.dir, 'up');
  assert.ok(corner.y >= 46);
});

test('«В порт» far from any harbour in the First Watch: the helmsman sails her to the nearest (docs/23 item 79)', () => {
  const far = buildActs({ homeport: { name: 'Солтмарроу' } });
  assert.equal(far[0]?.id, 'homeport');
  const near = buildActs({ port: { name: 'Солтмарроу' }, homeport: { name: 'Солтмарроу' } });
  assert.deepEqual(near.map((a) => a.id), ['dock'], 'in the harbour’s reach it is the plain «В порт»');
  assert.equal(far[0].label, near[0].label, 'one word for both');
});

test('vibration: short pulses, spaced, and off with its option (docs/23 item 84)', () => {
  for (const [k, v] of Object.entries(BUZZ)) {
    const total = Array.isArray(v) ? v.reduce((a, b) => a + b, 0) : v;
    assert.ok(total <= 160, `${k}: ${total} ms`);
  }
  assert.equal(mayBuzz('fire', 1000, true, -1e9), true);
  assert.equal(mayBuzz('fire', 1000, false, -1e9), false, 'the option off');
  assert.equal(mayBuzz('hit', 1000, true, 1000 - BUZZ_GAP.hit + 1), false, 'a battery of balls is one knock');
  assert.equal(sanitize(null).vibrate, true, 'on by default');
  assert.equal(sanitize({ vibrate: false }).vibrate, false);
  const ru = readFileSync(new URL('../client/src/lang/ru.ts', import.meta.url), 'utf8');
  assert.match(ru, /'opt\.vibrate': "Вибрация"/);
});

test('the first quarter of an hour shuts tattoos, dice, the auction and the guilds by body classes (docs/23 item 83)', () => {
  for (const sel of ['body.lock-tattoos .tt-chair', 'body.lock-tattoos [data-tattoos]', 'body.lock-dice .dice-card', 'body.lock-auction .au-card', 'body.lock-guilds .tab[data-tab="guild"]']) assert.ok(css.includes(sel), sel);
  const ui = readFileSync(new URL('../client/src/ui/onboarding.ts', import.meta.url), 'utf8');
  assert.match(ui, /document\.body\.classList\.toggle\(`lock-\$\{x\}`, locked\.has\(x\)\)/);
});

test('in a fight the sea’s news waits and the lesson steps aside; the battle’s own words keep to its top band', () => {
  const hud = readFileSync(new URL('../client/src/ui/hud.ts', import.meta.url), 'utf8');
  assert.match(hud, /if \(kind !== 'bad' && kind !== 'good' && this\.hold\(/);
  assert.match(hud, /b\.contains\('tac'\) \|\| b\.contains\('boarding'\)/);
  assert.ok(css.includes('body.tac #hud-watch, body.boarding #hud-watch { display: none !important; }'));
  assert.ok(css.includes('body.tac #toasts { top: calc(var(--sa-t) + 8px); bottom: auto; left: 50%;'));
});

test('the fast start and the safe area (docs/23 items 88–89)', () => {
  const html = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /<link rel="stylesheet" href="\/feel\.css" \/>/);
  assert.match(html, /<button id="login-continue" class="btn btn-primary hidden" type="button"><\/button>/);
  assert.ok(css.includes('#modal { padding: var(--sa-t) var(--sa-r) var(--sa-b) var(--sa-l); box-sizing: border-box; }'));
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /localStorage\.setItem\(CAPTAIN_KEY, m\.name\)/);
  assert.match(main, /m\.msg === 'Logged in elsewhere\.'/);
});
