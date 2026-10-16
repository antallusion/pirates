// The sound pass (owner, 2026-10-16): every event of the owner's list is heard — the sea's firing and hits, the hex
// fight's blows and procs (luck, morale's extra turn, a heal…), the interface's clicks, a purchase, a level, the
// island's work done, the daily gift, a notice, docking and leaving port, the weather — each by a real recipe of the
// procedural engine (no audio files: the repo has none and none are generated); the UI fires each cue where the event
// happens; the music follows the scene (the island, the hex fight) and each sea's own mode; a cue keeps its least gap.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CUES, SOUND_MAP, mayCue } from '../client/src/sfx.ts';
import type { SoundCue } from '../client/src/sfx.ts';
import { AudioEngine } from '../client/src/audio.ts';
import { REGION_THEME, wantedState } from '../client/src/music.ts';
import type { MusicInput } from '../client/src/music.ts';
import { REGIONS } from '../shared/src/world/regions.ts';

const proto = AudioEngine.prototype as unknown as Record<string, unknown>;

test('the owner\'s list: each event has a sound, and each sound is a real recipe of the engine', () => {
  const wanted: [string, RegExp][] = [
    ['firing', /firing/],
    ['hits', /a ball home/],
    ['boarding blows', /hex fight: a blow/],
    ['luck', /lucky blow/],
    ['morale extra turn', /another turn/],
    ['heal', /a heal/],
    ['UI clicks', /a button pressed/],
    ['purchases', /a purchase/],
    ['level-up', /level up/],
    ['island build done', /a building finished/],
    ['daily reward', /daily gift/],
    ['notifications', /notices/],
    ['docking', /docking/],
    ['weather', /weather/],
  ];
  const keys = Object.keys(SOUND_MAP);
  for (const [name, re] of wanted) assert.ok(keys.some((k) => re.test(k)), `no sound for ${name}`);
  for (const [k, v] of Object.entries(SOUND_MAP)) assert.equal(typeof proto[v.recipe], 'function', `${k}: no recipe ${v.recipe}`);
  for (const [k, c] of Object.entries(CUES)) {
    assert.equal(typeof proto[c.recipe], 'function', `cue ${k}: no recipe ${c.recipe}`);
    assert.ok(c.gap > 0 && ['sea', 'combat', 'ui', 'music'].includes(c.bus), k);
  }
  // every cue of the map is a cue the UI can ask for
  const recipes = new Set(Object.values(CUES).map((c) => c.recipe));
  for (const [k, v] of Object.entries(SOUND_MAP)) if (v.via === 'cue') assert.ok(recipes.has(v.recipe), k);
});

test('the UI fires each cue where its event happens', () => {
  const src = (f: string) => readFileSync(f, 'utf8');
  const all = ['client/src/main.ts', ...readdirSync('client/src/ui').filter((f) => f.endsWith('.ts')).map((f) => `client/src/ui/${f}`)].map(src).join('\n');
  for (const k of Object.keys(CUES) as SoundCue[]) assert.match(all, new RegExp(`cue\\('${k}'|cue\\(won \\? 'win' : 'lose'\\)|cue\\(e\\.k === 'shot'`), k);
  const tac = src('client/src/ui/tactical.ts');
  for (const k of ['blow', 'shot', 'rally', 'fear', 'heal', 'spell', 'luck']) assert.match(tac, new RegExp(`cue\\('${k}'`), `the hex fight: ${k}`);
  assert.match(tac, /cue\(won \? 'win' : 'lose'\)/);
  assert.match(src('client/src/ui/dailygift.ts'), /cue\('gift'\)/);
  // the sound sleeps while the page is hidden (another tab, the Mini App in Telegram's background)
  const main = src('client/src/main.ts');
  assert.match(main, /visibilitychange', \(\) => audio\.setHidden\(document\.hidden\)/);
  assert.match(main, /onEvent\('deactivated'/);
  assert.equal(typeof proto.setHidden, 'function');
});

test('a cue keeps its least gap: a sweep\'s blows are one sound, not a buzz', () => {
  assert.ok(mayCue('blow', 1000, undefined));
  assert.ok(!mayCue('blow', 1030, 1000));
  assert.ok(mayCue('blow', 1000 + CUES.blow.gap, 1000));
  assert.ok(!mayCue('gift', 2000, 1000));
});

test('the music by the scene: the island\'s lute, the hex fight\'s drums, and each sea its mode', () => {
  const base: MusicInput = { docked: false, combat: false, chased: false, weather: 'clear', region: 'black_coast', anomaly: false };
  assert.equal(wantedState(base), 'calm');
  assert.equal(wantedState({ ...base, isle: true }), 'isle');
  assert.equal(wantedState({ ...base, docked: true }), 'port');
  assert.equal(wantedState({ ...base, tactical: true, docked: true }), 'battle');
  assert.equal(wantedState({ ...base, combat: true }), 'battle');
  for (const r of Object.keys(REGIONS)) {
    assert.ok(REGION_THEME[r], `a theme for ${r}`);
    assert.equal(REGION_THEME[r].scale.length, 7);
  }
});

test('the options keep a slider for the music and for the effects', () => {
  const opt = readFileSync('client/src/ui/options.ts', 'utf8');
  for (const k of ['master', 'music', 'combat', 'ui', 'sea']) assert.match(opt, new RegExp(`vol\\('${k}'`), k);
});
