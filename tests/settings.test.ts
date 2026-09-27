import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, actionFor, cbColor, conflicts, defaults, keyLabel, keyOf, PRESETS, sanitize } from '../client/src/settings.ts';
import { direction } from '../client/src/audio.ts';
import { Fx } from '../client/src/render/fx.ts';
import { setLang } from '../client/src/i18n.ts';

test('key rebinding: two bindings per action, every preset free of conflicts, clashes reported', () => {
  for (const [name, map] of Object.entries(PRESETS)) {
    assert.equal(conflicts(map).size, 0, `${name} has clashes: ${[...conflicts(map).keys()]}`);
    for (const a of ACTIONS) assert.equal(map[a].length, 2, `${name}.${a}`);
  }
  const d = defaults();
  assert.equal(actionFor(d.keys, 'W'), 'sailUp');
  assert.equal(actionFor(d.keys, 'ArrowUp'), 'sailUp', 'the second binding');
  assert.equal(actionFor(PRESETS.lefthand, 'e'), 'sailUp');
  assert.equal(actionFor(PRESETS.onehand, 'q'), 'dock');
  assert.equal(actionFor(PRESETS.onehand, 'z'), null, 'one hand: six keys and the mouse');
  const clash = { ...d.keys, repair: ['q', ''] as [string, string] };
  assert.deepEqual(conflicts(clash).get('q')!.sort(), ['firePort', 'repair']);
  setLang('en');
  assert.equal(keyLabel(' '), 'Space');
  setLang('ru');
  assert.equal(keyLabel(' '), 'Пробел', 'the space bar is named in the reader language');
  setLang('en');
  assert.equal(keyLabel('arrowleft'), '←');
});

test('options survive an old or broken save: clamped scales, filled keys and volumes', () => {
  const s = sanitize({ uiScale: 9, textScale: 0.1, colorblind: 'nope' as never, volume: { master: 3 } as never, keys: { sailUp: ['x'] } as never });
  assert.equal(s.uiScale, 2);
  assert.equal(s.textScale, 0.9);
  assert.equal(s.colorblind, 'off');
  assert.equal(s.volume.master, 1);
  assert.equal(s.volume.sea, 1);
  assert.deepEqual(s.keys.sailUp, ['w', 'arrowup'], 'a malformed binding falls back');
  assert.deepEqual(s.keys.firePort, ['q', '']);
});

test('colour-blind palettes: danger and anomaly never stay red and teal for those who cannot tell them apart', () => {
  for (const m of ['protan', 'deutan'] as const) {
    assert.notEqual(cbColor(m, '#d4542b'), '#d4542b');
    assert.notEqual(cbColor(m, '#2ee6c8'), '#2ee6c8');
    assert.notEqual(cbColor(m, '#d4542b'), cbColor(m, '#2ee6c8'));
  }
  assert.notEqual(cbColor('tritan', '#2ee6c8'), '#2ee6c8');
  assert.equal(cbColor('off', '#d4542b'), '#d4542b');
  assert.equal(cbColor('protan', '#123456'), '#123456', 'colours without meaning pass through');
});

test('sound captions know the side; screen flashes are held to three a second', () => {
  assert.equal(direction(0, 0, -800, 10), 'port');
  assert.equal(direction(0, 0, 800, 10), 'starboard');
  assert.equal(direction(0, 0, 10, -900), 'ahead');
  assert.equal(direction(0, 0, 10, 900), 'astern');
  assert.equal(direction(0, 0, 30, 30), 'near');
  const fx = new Fx();
  let n = 0;
  for (let i = 0; i < 10; i++) if (fx.screenFlash(0.8)) n++;
  assert.equal(n, 1, 'a burst of flashes in one instant is one flash');
});

test('keys work in any keyboard layout: letters and digits by their physical place', () => {
  const map = defaults().keys;
  // A Russian layout types «ц» on W and «ф» on A; the helm must still answer.
  assert.equal(keyOf({ key: 'ц', code: 'KeyW' }), 'w');
  assert.equal(actionFor(map, keyOf({ key: 'ц', code: 'KeyW' })), 'sailUp');
  assert.equal(actionFor(map, keyOf({ key: 'ф', code: 'KeyA' })), 'rudderLeft');
  assert.equal(keyOf({ key: '!', code: 'Digit1' }), '1');
  assert.equal(keyOf({ key: 'ArrowLeft', code: 'ArrowLeft' }), 'arrowleft');
  assert.equal(keyOf({ key: ' ', code: 'Space' }), ' ');
  assert.equal(keyOf({ key: 'Escape' }), 'escape');
});
