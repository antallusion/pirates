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
