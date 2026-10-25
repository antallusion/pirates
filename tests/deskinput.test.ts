// batch-pc (2026-10-26): the desk's mouse and keys — the choices are pure (client/src/ui/deskinput.ts) and wired in
// main.ts; the wiring is checked by its text, the way the other client tests do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rightClickAct } from '../client/src/ui/deskinput.ts';

const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');

test('the right button: the mount when fitted, else the helmsman to the spot; nothing when docked', () => {
  assert.equal(rightClickAct({ docked: false, mount: true }), 'mount');
  assert.equal(rightClickAct({ docked: false, mount: false }), 'sail', 'no mount: no «Палубная установка не стоит» at every press');
  assert.equal(rightClickAct({ docked: true, mount: true }), null);
  assert.equal(rightClickAct({ docked: true, mount: false }), null);
  // main.ts sends the course through the chart's helmsman when rightClickAct says so
  const rmb = main.slice(main.indexOf('e.button !== 2'), main.indexOf('e.button !== 2') + 700);
  assert.match(rmb, /rightClickAct\(/);
  assert.match(rmb, /worldMap\.onAutosail\(wp\)/);
});

test('Tab over an open window walks the window, not the sea\'s targets, and comes before the fields\' own keys', () => {
  const at = main.indexOf("e.key === 'Tab' && modal");
  assert.ok(at > 0, 'the window\'s Tab trap is wired');
  assert.match(main.slice(at, at + 260), /windowTab\(\$\('modal-panel'\), e\.shiftKey\)/);
  // before `if (typing()) return;` (a field's Tab must not walk out onto the HUD) and before the keymap's «target»
  const handler = main.indexOf('// Autofill, an IME and some gamepad bridges');
  const typingAt = main.indexOf('  if (typing()) return;', handler);
  assert.ok(handler > 0 && at > handler && at < typingAt);
});

test('the wheel zoom: a mouse notch is one step, a touchpad stroke of tiny deltas is not a step per event', async () => {
  const { wheelZoom } = await import('../client/src/ui/deskinput.ts');
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  near(wheelZoom(-100, 0, 1.12), 1.12); // Chrome on Windows, one notch in
  near(wheelZoom(100, 0, 1.12), 1 / 1.12);
  near(wheelZoom(-3, 1, 1.12), 1.12); // Firefox, lines
  near(wheelZoom(-300, 0, 1.12), 1.12); // a fast spin: still a notch per event
  assert.equal(wheelZoom(0, 0, 1.12), 1);
  // a touchpad stroke: 30 events of 4 px — about one notch and a fifth, not 1.12^30 (×30)
  let z = 1;
  for (let i = 0; i < 30; i++) z *= wheelZoom(-4, 0, 1.12);
  assert.ok(z > 1.1 && z < 1.2, `a light stroke zooms ×${z.toFixed(2)}`);
  // Ctrl + the wheel (a touchpad's pinch) never zooms the page: the sea's handler and a window-wide one take it
  assert.match(main, /canvas\.addEventListener\('wheel', \(e\) => \{[\s\S]{0,200}e\.preventDefault\(\);[\s\S]{0,500}\{ passive: false \}\);/);
  assert.match(main, /addEventListener\('wheel', \(e\) => \{\s*if \(inGame && e\.ctrlKey\) e\.preventDefault\(\);\s*\}, \{ passive: false \}\);/);
});

test('Enter over an open window never opens the chat hidden under it (the keys went into an unseen field)', () => {
  const at = main.indexOf('hud.chatPanel.focusInput();');
  const line = main.slice(main.lastIndexOf('\n', at), at);
  assert.match(line, /!typing\(\) && !modal\)/);
});

test('Esc in a window\'s field leaves the field and closes the window like Esc anywhere in it', () => {
  const at = main.indexOf("if (e.key === 'Escape' && modal && typing())");
  assert.ok(at > 0);
  assert.ok(main.indexOf('  if (typing()) return;', at) - at < 200, 'the blur comes right before the fields keep their keys');
});

test('Esc over a window closes the window first, not the chat folded under its veil', () => {
  assert.match(main, /e\.key === 'Escape' && hud\.chatPanel\.isOpen && \(!modal \|\| document\.activeElement === chatInput\)/);
});
