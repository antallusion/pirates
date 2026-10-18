// The toasts while a window is open (owner, 2026-10-18: «когда я изучаю навык какой-то то под книжкой изучения
// появляется что-то темное и я не вижу, видимо это описание улучшения, оно попадает под общие модалки а должно быть
// поверх»): a talent learnt, a skill taken, a refusal — said over the window in the top layer, a readable card in the
// bottom band, not a dark strip of its own under it; the long press's hint as readable over it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f: string) => readFileSync(new URL(`../client/${f}`, import.meta.url), 'utf8');

test('the window’s toasts: a body-level layer over the windows, the sheets and their scrim, readable', () => {
  const html = read('index.html');
  const modal = html.slice(html.indexOf('<section id="modal"'), html.indexOf('</section>', html.indexOf('<section id="modal"')));
  assert.ok(!modal.includes('modal-toasts'), 'not inside the window’s own layer (its stacking context, its scrim)');
  assert.match(html, /<\/section>\s*<!--[\s\S]*?-->\s*<div id="modal-toasts" aria-live="polite"><\/div>/);
  const css = read('styles.css');
  assert.match(css, /#modal-toasts \{ position: fixed; z-index: var\(--k-z-toast, 76\);[^}]*bottom: calc\(var\(--sa-b, 0px\) \+ 10px\)/);
  assert.ok(!/#modal:has\(#modal-toasts[^{]*\{ background: #060607/.test(css), 'no dark strip under the window');
  assert.ok(!/#modal-toasts \{[^}]*background: #060607/.test(css));
  // over the window's 30 and the kit's sheets' 72
  const kit = read('src/ui/kit/kit.css');
  const z = (k: string) => Number(new RegExp(`--k-z-${k}: ([0-9]+)`).exec(kit)?.[1]);
  assert.ok(z('toast') > z('sheet') && z('toast') > 30);
  assert.match(css, /#modal \{ position: fixed; inset: 0; z-index: 30;/);
  // 12 px at least on the smallest phone, the hint too
  const fit = read('fit.css');
  assert.ok(fit.includes('#modal-toasts .toast { font-size: max(12px, var(--f-fs)); line-height: 1.3; }'));
  assert.ok(fit.includes('.k-hint { font-size: max(12px, var(--k-fs-2)); }'));
  // the toasts go there while a window is open (hud.ts)
  assert.ok(read('src/ui/hud.ts').includes("host: () => (modalOpen() ? $('modal-toasts') : this.toastsEl)"));
});
