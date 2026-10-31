// The sound design (owner 2026-11-01: «бесплатную музыку и звуки … на пиратскую тематику … каждый звук»): every sound
// the engine asks for is a built file in both formats, every file has a free licence recorded (CC0, or CC BY with its
// credit in CREDITS.md, the options and the site), the core preload stays small, and the engine's pure parts (the
// format, the variants, the voice limit, the ambience beds, the music by the scene, a blow's voice) do what they say.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { pickFormat, pickVariant, preloadBytes } from '../client/src/sounds.ts';
import type { SoundIndex } from '../client/src/sounds.ts';
import { MAX_VOICES, VOICE_LIMIT, bedLevels, voiceFree } from '../client/src/audio.ts';
import type { AmbScene } from '../client/src/audio.ts';
import { TRACK_LEVEL, trackFor, wantedState } from '../client/src/music.ts';
import type { MusicInput, MusicState } from '../client/src/music.ts';
import { blowVoice } from '../client/src/sfx.ts';
import { SOUNDS } from '../tools/audio/recipe.ts';

const index = JSON.parse(readFileSync('assets/audio/index.json', 'utf8')) as SoundIndex;
const sources = JSON.parse(readFileSync('assets/audio/sources.json', 'utf8')) as Record<string, { license: string; author: string; url: string; credit?: string }>;

test('every sound of the recipe is built: both formats, a duration, a licence', () => {
  assert.deepEqual(Object.keys(index.sounds).sort(), Object.keys(SOUNDS).sort());
  for (const [key, e] of Object.entries(index.sounds)) {
    assert.equal(e.files.length, SOUNDS[key].clips.length, key);
    e.files.forEach((f, i) => {
      for (const ext of ['ogg', 'm4a']) {
        const p = `assets/audio/${f}.${ext}`;
        assert.ok(existsSync(p) && statSync(p).size > 200, p);
      }
      assert.ok(e.dur[i] > 0.02, `${f}: ${e.dur[i]} s`);
      const s = sources[f];
      assert.ok(s, `${f}: no source`);
      assert.ok(['CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0'].includes(s.license), `${f}: ${s.license}`);
      assert.match(s.url, /^https:\/\/(freesound\.org|kenney\.nl|opengameart\.org)\//, f);
    });
  }
});

test('CC BY is credited: CREDITS.md, the options, the site', () => {
  const credits = readFileSync('assets/audio/CREDITS.md', 'utf8');
  const opt = readFileSync('client/src/ui/options.ts', 'utf8');
  const site = readFileSync('site/contacts/index.html', 'utf8') + readFileSync('site/en/contacts/index.html', 'utf8');
  const owed = new Set(Object.values(sources).filter((s) => s.license !== 'CC0-1.0').map((s) => s.author.split(' (')[0]));
  assert.ok(owed.size >= 1);
  for (const a of owed) {
    assert.ok(credits.includes(a), `CREDITS.md: ${a}`);
    assert.ok(opt.includes(a), `options: ${a}`);
    assert.ok(site.includes(a), `site: ${a}`);
  }
});

test('the core preload stays under 1.5 MB; the music streams', () => {
  for (const fmt of ['ogg', 'm4a'] as const) {
    const b = preloadBytes(index, fmt);
    assert.ok(b.core > 50_000 && b.core < 1.5 * 1048576, `${fmt} core ${b.core}`);
    assert.ok(b.music > 0);
  }
  for (const e of Object.values(index.sounds)) if (e.kind === 'music') assert.ok(!e.preload);
});

test('the format: Opus where it plays, AAC elsewhere; a variant is not the last one', () => {
  assert.equal(pickFormat((m) => (m.includes('opus') ? 'probably' : '')), 'ogg');
  assert.equal(pickFormat(() => ''), 'm4a');
  for (let i = 0; i < 50; i++) {
    const r = i / 50;
    assert.notEqual(pickVariant(3, 1, r), 1);
    assert.ok(pickVariant(3, 1, r) >= 0 && pickVariant(3, 1, r) < 3);
  }
  assert.equal(pickVariant(1, 0, 0.7), 0);
});

test('a broadside does not clip: the guns at once are limited, and all sounds at once', () => {
  assert.ok(voiceFree('cannon', 0, 0));
  assert.ok(!voiceFree('cannon', VOICE_LIMIT.cannon, 0));
  assert.ok(!voiceFree('click', 0, MAX_VOICES));
  assert.ok(voiceFree('spell', 3, 10) && !voiceFree('spell', 4, 10));
});

test('the ambience follows the scene', () => {
  const sea: AmbScene = { atSea: true, docked: false, tavern: false, land: 0, fire: false };
  const calm = bedLevels(0.1, 'clear', sea);
  assert.ok(calm['amb.sea'] > 0.5 && calm['amb.waves'] === 0 && calm['amb.gale'] === 0 && calm['amb.harbour'] === 0);
  const storm = bedLevels(0.9, 'storm', sea);
  assert.ok(storm['amb.gale'] > 0.5 && storm['amb.rain'] > 0.5 && storm['amb.waves'] > 0.5 && storm['amb.gulls'] === 0);
  assert.ok(bedLevels(0.3, 'clear', { ...sea, land: 1 })['amb.gulls'] > 0.3);
  const port = bedLevels(0.3, 'clear', { ...sea, atSea: false, docked: true });
  assert.ok(port['amb.harbour'] > 0.3 && port['amb.creak'] === 0);
  const tavern = bedLevels(0.3, 'rain', { ...sea, atSea: false, docked: true, tavern: true });
  assert.ok(tavern['amb.tavern'] > 0.5 && tavern['amb.harbour'] === 0 && tavern['amb.rain'] < 0.3);
  for (const k of Object.keys(calm)) assert.ok(index.sounds[k]?.kind === 'amb', `${k} built as a bed`);
});

test('the music by the scene: each state its recorded track', () => {
  const base: MusicInput = { docked: false, combat: false, chased: false, weather: 'clear', region: 'black_coast', anomaly: false };
  const cases: [MusicInput, string][] = [
    [{ ...base, title: true }, 'mus.title'],
    [base, 'mus.calm'],
    [{ ...base, weather: 'fog' }, 'mus.fog'],
    [{ ...base, weather: 'storm' }, 'mus.storm'],
    [{ ...base, combat: true }, 'mus.chase'],
    [{ ...base, chased: true }, 'mus.chase'],
    [{ ...base, tactical: true }, 'mus.battle'],
    [{ ...base, anomaly: true }, 'mus.boss'],
    [{ ...base, combat: true, anomaly: true }, 'mus.boss'],
    [{ ...base, region: 'the_abyss' }, 'mus.anomaly'],
    [{ ...base, docked: true }, 'mus.port'],
    [{ ...base, docked: true, tavern: true }, 'mus.tavern'],
    [{ ...base, isle: true }, 'mus.isle'],
  ];
  for (const [i, want] of cases) {
    const st = wantedState(i);
    assert.equal(trackFor(st, i), want, JSON.stringify(i));
    assert.equal(index.sounds[want]?.kind, 'music', want);
  }
  assert.equal(trackFor('calm', base, true), 'mus.calm2');
  for (const s of Object.keys(TRACK_LEVEL) as MusicState[]) assert.ok(TRACK_LEVEL[s] > 0 && TRACK_LEVEL[s] <= 1);
  for (const k of ['mus.win', 'mus.lose']) assert.equal(index.sounds[k]?.kind, 'music');
});

test('a blow\'s voice by who strikes', () => {
  assert.equal(blowVoice(null), 'blow');
  assert.equal(blowVoice({ specials: [] }), 'blow');
  assert.equal(blowVoice({ specials: ['undead', 'fear'] }), 'moan');
  assert.equal(blowVoice({ beast: true, specials: [] }, 0), 'roar');
  assert.equal(blowVoice({ beast: true, specials: [] }, 1), 'bite');
});

test('the server serves the audio: its types and ranges', () => {
  const st = readFileSync('server/src/net/static.ts', 'utf8');
  assert.match(st, /'\.ogg': 'audio\/ogg'/);
  assert.match(st, /'\.m4a': 'audio\/mp4'/);
  assert.match(st, /MEDIA = new Set\(\['\.mp4', '\.webm', '\.ogg', '\.m4a'\]\)/);
});
