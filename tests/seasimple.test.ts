// The sea HUD's rebuild (owner, 2026-10-07: «перегруз интерфейса, иконки обрезаются, очень большие плашки, аватарки
// обрезаются у всех… выходя из порта у меня нет ничего вообще, никакого управления»): one simple HUD for every input
// unless «Подробный интерфейс»; the desk by its keys (Space «Огонь», Tab the next mark, a tap of Shift the dash); the
// captains' faces whole in their circles; the pictures of round buttons inside their rings. Then (owner, the same day:
// «ты удалил всё… возвращай иконки, обводки графические… штурвал») the desk's controls drawn again, painted, its keys
// on chips on their rims instead of a line of words.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACES, FACE_DEFAULT, HEAD_SHARE, faceCrop } from '../client/src/ui/kit/faces.ts';
import { actionFor, conflicts, defaults, keyLabel, PRESETS, sanitize } from '../client/src/settings.ts';
import type { Keymap } from '../client/src/settings.ts';
import { chipKey, deckSlotHtml, inFight, seaTargets } from '../client/src/ui/seahud.ts';
import type { SeaView } from '../client/src/ui/seahud.ts';
import { EN as SEN, RU as SRU } from '../client/src/lang/ui/seahud.ts';
import { EN } from '../client/src/lang/en.ts';
import { RU } from '../client/src/lang/ru.ts';

test('a captain\'s face: the head whole inside the circle, a little above its middle, the picture covering the circle', () => {
  const aspect = 560 / 422;
  for (const [id, f] of [...Object.entries(FACES), ['someone', FACE_DEFAULT] as const]) {
    const c = faceCrop(id, aspect);
    const s = parseFloat(c.size) / 100; // the picture's width in circles
    const [px, py] = c.pos.split(' ').map((v) => parseFloat(v) / 100);
    assert.ok(s >= 1 && s * aspect >= 1, `${id}: the picture covers the circle`);
    assert.ok(px >= 0 && px <= 1 && py >= 0 && py <= 1, `${id}: no bare edge (${c.pos})`);
    // the head in circle units (the circle 1 wide, its middle at 0.5, 0.5)
    const left = px * (1 - s), top = py * (1 - s * aspect);
    const hx = left + f[0] * s, hy = top + f[1] * s * aspect, hr = f[2] * s;
    const d = Math.hypot(hx - 0.5, hy - 0.5) + hr;
    assert.ok(d <= 0.5 + 1e-6, `${id}: the head reaches ${d.toFixed(3)} of the circle's 0.5`);
    assert.ok(hr * 2 <= HEAD_SHARE + 0.01 && hr * 2 >= 0.24, `${id}: the head ${Math.round(hr * 200)}% of the circle`);
    assert.equal(c.face, f.join(' '));
  }
});

test('a picture in a round frame: a rounded square of 0.56 with 14% corners stands inside the porthole ring\'s open circle; 0.52 inside the kit\'s', () => {
  // the farthest point of a rounded square of side s (corners r = k·s) from its middle
  const far = (s: number, k: number) => Math.SQRT2 * (s / 2 - k * s) + k * s;
  // the porthole ring (ui.ring) round the sea's controls: inset −11 %, its clear middle 0.617 of its half at the least
  const open = (d: number) => 0.617 * (d * 1.22) / 2;
  for (const d of [44, 48, 52, 80, 92]) assert.ok(far(d * 0.56, 0.14) <= open(d) + 0.5, `a ${d} px sea control`);
  // the captain's face: the ring outside it (inset −0.32 of the face): its clear middle as wide as the face
  for (const f of [44, 50, 54]) assert.ok(0.617 * (f * 1.64) / 2 >= f / 2 - 0.75, `a ${f} px face`);
  // a kit icon button under the painted ring (inset −3 px, its clear middle 0.617 of its half): the picture 52%
  for (const d of [36, 44, 52]) assert.ok(far(d * 0.52, 0.14) <= 0.617 * (d / 2 + 3) + 0.5, `a ${d} px kit icon button`);
  // the battle's round buttons (48 and 56 px, the same ring): 52%
  for (const d of [48, 56]) assert.ok(far(d * 0.52, 0.14) <= 0.617 * (d / 2 + 3) + 0.5, `a ${d} px round order`);
  // the micro menu and the fold (40 px, ring −3 px): 52%
  assert.ok(far(40 * 0.52, 0.14) <= 0.617 * 23 + 0.5);
  // the stylesheet says so
  const css = readFileSync('client/seahud.css', 'utf8');
  assert.match(css, /body\.simple \.sea-round \.k-btn-ico \{[^}]*inset: 22%;[^}]*width: 56%; height: 56%; border-radius: 14%; object-fit: contain/);
  assert.match(css, /body\.simple \.sea-round::after, body\.simple #touch > \.tc-big::after \{ content: ''; position: absolute; inset: -11%;[^}]*background: var\(--ui-ring\)/);
  assert.match(css, /\.cs-frame::after \{ content: ''; position: absolute; inset: calc\(var\(--cs-face\) \* -0\.32\);[^}]*var\(--ui-ring\)/);
  assert.match(css, /\.k-btn--icon \.k-btn-ico \{ inset: 24%; width: 52%; height: 52%; border-radius: 14%; \}/);
  assert.match(css, /\.tb-rb > \.ico \{ inset: 24%; width: 52%; height: 52%; object-fit: contain; border-radius: 14%; \}/);
});

test('the desk plays by its keys: Space «Огонь», Tab the next mark, Shift the dash; no preset clashes', () => {
  const d = defaults();
  assert.equal(d.expertHud, false, 'the simple HUD by default');
  assert.equal(actionFor(d.keys, ' '), 'fire');
  assert.equal(actionFor(d.keys, 'tab'), 'target');
  assert.equal(actionFor(d.keys, '`'), 'target');
  assert.equal(actionFor(d.keys, 'shift'), 'dash');
  assert.equal(actionFor(d.keys, 'q'), 'firePort');
  assert.equal(actionFor(d.keys, 'e'), 'fireStarboard');
  assert.equal(keyLabel('shift'), 'Shift');
  for (const [name, map] of Object.entries(PRESETS)) assert.equal(conflicts(map).size, 0, `${name}: ${[...conflicts(map).keys()]}`);
});

test('a key map saved before Space was «Огонь» moves to the new keys; a key the captain bound himself stays his', () => {
  const old = structuredClone(defaults().keys) as Partial<Keymap>;
  delete old.fire;
  old.chasers = [' ', ''];
  old.dash = ['tab', ''];
  old.target = ['`', ''];
  const s = sanitize({ keys: old as Keymap });
  assert.deepEqual(s.keys.fire, [' ', '']);
  assert.deepEqual(s.keys.chasers, ['', '']);
  assert.deepEqual(s.keys.dash, ['shift', '']);
  assert.deepEqual(s.keys.target, ['tab', '`']);
  assert.equal(conflicts(s.keys).size, 0);
  // Space bound by the captain to boarding: it stays the boarding's, «Огонь» waits for a key
  const own = structuredClone(old);
  own.chasers = ['', ''];
  own.board = [' ', ''];
  const t = sanitize({ keys: own as Keymap });
  assert.deepEqual(t.keys.fire, ['', '']);
  assert.equal(actionFor(t.keys, ' '), 'board');
  // a map saved now is left as it is
  assert.deepEqual(sanitize({ keys: defaults().keys }).keys, defaults().keys);
});

test('the desk\'s keys on the controls\' rims: a chip on each slot, none for a key bound to nothing; the slot says its shot, count and key', () => {
  assert.equal(chipKey('—'), '');
  assert.equal(chipKey(undefined), '');
  assert.equal(chipKey('Tab'), 'Tab');
  const shot = deckSlotHtml({ kind: 'shot', id: 'round', art: 'ammo_round', key: '1', name: 'Round shot', title: 'Round shot — the hull', n: 60, sel: true });
  assert.match(shot, /data-shot="round"/);
  assert.match(shot, /<kbd class="kc kc-tl" aria-hidden="true">1<\/kbd>/);
  assert.match(shot, /<b class="dk-n" aria-hidden="true">60<\/b>/);
  assert.match(shot, /aria-pressed="true"/);
  assert.match(shot, /aria-label="Round shot: 60 \[1\]"/);
  const ab = deckSlotHtml({ kind: 'abil', id: 'last_volley', art: 'ab_last_volley', key: 'V', name: 'Last Volley', title: 'Last Volley — …', ult: true, locked: 'Ур. 6', dim: true, charge: null, cd: 0 });
  assert.match(ab, /data-ab="last_volley"/);
  assert.match(ab, /class="dk-slot dk-abil ult locked dim"/);
  assert.match(ab, /<i class="dk-cd" aria-hidden="true"><\/i><span class="dk-cdt" aria-hidden="true">Ур\. 6<\/span>/);
  assert.match(ab, /<kbd class="kc kc-tl" aria-hidden="true">V<\/kbd>/);
  const none = deckSlotHtml({ kind: 'shot', id: 'star', art: 'ammo_star', key: '', name: 'Star shot', title: 'Star shot', n: 3 });
  assert.ok(!none.includes('<kbd'), 'no key, no chip');
});

test('a fight brings the guns out; leaving port, the helm alone', () => {
  const base: SeaView = { docked: false, touch: true, act: null, special: null, target: null, ammo: 'round', ammoN: 60, reload: 1, news: 0, unread: 0 };
  assert.equal(inFight(base), false);
  assert.deepEqual(seaTargets(base), ['stick', 'menu', 'minimap']);
  assert.equal(inFight({ ...base, fight: true }), true);
  assert.equal(inFight({ ...base, docked: true, fight: true }), false);
  assert.deepEqual(seaTargets({ ...base, fight: true }), ['stick', 'fire', 'ammo', 'lock', 'menu']);
  assert.deepEqual(seaTargets({ ...base, docked: true }), ['cast', 'menu', 'minimap']);
  // a desk: the helm, «Огонь», «Цель» and the gun deck at sea in every state (owner, 2026-10-07: «возвращай управление»)
  assert.deepEqual(seaTargets({ ...base, touch: false, fight: true, target: { name: 'x' } }), ['captain', 'menu', 'target', 'minimap', 'stick', 'fire', 'lock', 'deck']);
  assert.deepEqual(seaTargets({ ...base, touch: false }), ['captain', 'menu', 'minimap', 'stick', 'fire', 'lock', 'deck']);
  assert.deepEqual(seaTargets({ ...base, touch: false, docked: true }), ['captain', 'menu', 'minimap', 'cast']);
});

test('the page: the simple HUD\'s stylesheet last, its speed, the attack mark and the sea\'s name; no line of keys; the old HUD put away under body.simple', () => {
  const html = readFileSync('client/index.html', 'utf8');
  assert.ok(html.indexOf('/seahud.css') > html.indexOf('/feel.css'), 'seahud.css after feel.css');
  for (const id of ['tc-speed', 'atk-mark', 'sea-herald', 'tc-stick']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(!html.includes('id="key-hint"'), 'the line of keys is gone (the keys are chips on the controls)');
  const css = readFileSync('client/seahud.css', 'utf8');
  for (const id of ['hud-combat', 'hud-nav', 'hud-menu', 'hud-region', 'hud-fold', 'hud-ship', 'chat-toggle', 'unread']) assert.ok(css.includes(`body.simple #${id}`), id);
  assert.ok(!css.includes('#key-hint'), 'no line of keys');
  // a desk shows the painted helm, «Огонь», «Цель» and the gun deck, the keys on chips; a touch screen no chips
  assert.match(css, /body\.simple #touch > #tc-stick \{ display: block; \}/);
  assert.match(css, /body\.simple:not\(\.touch\):not\(\.sea-docked\) #touch > #tc-fire \{ display: flex;/);
  assert.match(css, /body\.simple:not\(\.touch\):not\(\.sea-docked\) #touch > #tc-lock \{ display: inline-flex;/);
  assert.match(css, /body\.simple:not\(\.touch\):not\(\.sea-docked\) #touch > #tc-deck:not\(\.hidden\) \{/);
  assert.match(css, /\.dk-slot::after \{[^}]*background: var\(--ui-slot\)/);
  assert.match(css, /\.kc \{ display: none; \}/);
  assert.match(css, /body\.simple:not\(\.touch\) \.kc \{ position: absolute;/);
  // no round control of the sea without its painted ring
  assert.ok(!/\.sea-round::after \{ content: none/.test(css), 'the ring is never taken off');
  // the battle's captains in one band at the top, the phone's in the top corners
  assert.match(css, /grid-template-areas: "you mid foe" "you queue foe" "you feed foe" "spells stage acts"/);
  assert.match(css, /\.tb-chip\.you \{ left:/);
  assert.match(css, /\.tb-chip\.foe \{ right:/);
});

test('the new words in both languages, the Russian without Latin', () => {
  assert.deepEqual(Object.keys(SRU).sort(), Object.keys(SEN).sort());
  for (const k of ['ammo', 'lock', 'lockNone', 'speed', 'helmDesk', 'deck', 'tm.lock', 'tm.pursue', 'tm.fight']) assert.ok(k in SEN && k in SRU, k);
  const ru = RU as Record<string, string>, en = EN as Record<string, string>;
  for (const k of ['opt.expertHud', 'act.fire']) {
    assert.ok(en[k] && ru[k], k);
    assert.ok(!/[A-Za-z]{2,}/.test(ru[k]), `${k}: ${ru[k]}`);
  }
});
