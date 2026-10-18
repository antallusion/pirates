// The round icons of the sea HUD's two short rows (owner, 2026-10-18: «иконка слева под картой не должны исчезать
// никогда, сейчас они исчезают когда я плыву»): under the captain's plate the chat, «Остров», her offer and the daily
// gift; under the chart the news and the menu. They went with every hostile sail within a mile (promo.ts and
// dailygift.ts asked «busy»), with a fight or a mark (isle.css, seahud.css, styles.css put «Остров» and the news away,
// the menu stepped up with the chart) and under an encounter's card on a phone. Now nothing at sea puts them away.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { seaIconUp } from '../client/src/ui/promo.ts';

const ICONS = ['#tc-isle', '#tc-offer', '#tc-daily', '#tc-news', '.tc-news', '#tc-menu', 'chat-toggle'];
const SEA = /sea-fight|sea-target|mm-peek|#encounter|sea-boss-target/;
const HIDE = /display:\s*none|visibility:\s*hidden|opacity:\s*0[;\s}]/;

test('no rule of the client’s styles puts a round icon away in a fight, with a mark, the chart up or an encounter’s card', () => {
  const dir = new URL('../client/', import.meta.url);
  const bad: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.css'))) {
    const css = readFileSync(new URL(f, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1], body = m[2];
      if (!HIDE.test(body)) continue;
      for (const s of sel.split(/,(?![^(]*\))/)) if (SEA.test(s) && ICONS.some((i) => s.includes(i))) bad.push(`${f}: ${s.trim()} { ${body.trim()} }`);
    }
  }
  assert.deepEqual(bad, []);
  // the menu and the news step up under the chart's tab with it, not out of sight
  const sea = readFileSync(new URL('seahud.css', dir), 'utf8');
  assert.match(sea, /body\.simple\.touch\.mm-peek \{ --tr-top: calc\(var\(--sa-t\) \+ 46px\); \}/);
  assert.ok(!sea.includes('tr-veil'), 'the right row never steps out of sight under the adventure card');
});

test('her offer’s and the daily gift’s icons: up at sea whatever sails near; away only under a window, a boarding, the First Watch', () => {
  const doc = (hud = true, isle = false, tac = false) => ({
    getElementById: (id: string) => (id === 'hud' ? { classList: { contains: (c: string) => c === 'hidden' && !hud } } : id === 'isle' ? { classList: { contains: (c: string) => c === 'hidden' && !isle } } : null),
    body: { classList: { contains: (c: string) => c === 'tac' && tac } },
  }) as unknown as Document;
  const st = { boardTac: null, boardFight: null, onboarding: null };
  assert.equal(seaIconUp(null, st, doc()), true);
  assert.equal(seaIconUp('hero', st, doc()), false, 'a window over it');
  assert.equal(seaIconUp(null, { ...st, boardTac: {} as never }, doc()), false, 'a boarding');
  assert.equal(seaIconUp(null, { ...st, boardFight: {} as never }, doc()), false, 'a deck fight');
  assert.equal(seaIconUp(null, { ...st, onboarding: { stage: 'sail' } as never }, doc()), false, 'the First Watch');
  assert.equal(seaIconUp(null, st, doc(false)), false, 'no HUD');
  assert.equal(seaIconUp(null, st, doc(true, true)), false, 'the island’s scene');
  assert.equal(seaIconUp(null, st, doc(true, false, true)), false, 'the hex battle');
  // the old «busy» (a hostile within a mile, a chase) is no question of theirs any more
  for (const f of ['promo.ts', 'dailygift.ts']) {
    const src = readFileSync(new URL(`../client/src/ui/${f}`, import.meta.url), 'utf8');
    const icon = src.slice(src.indexOf(f === 'promo.ts' ? 'private iconUp()' : 'private icon()'));
    assert.ok(!icon.slice(0, icon.indexOf('\n  }\n')).includes('busy()'), f);
  }
});
