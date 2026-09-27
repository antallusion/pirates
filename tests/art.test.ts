// The art painted for the MMO phase (docs/11 P5): every picture the game asks for is in the manifest and baked,
// and every quest giver has a face that matches the giver.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GIVER_MEN, GIVER_WOMEN, generateIslandJobs, generateQuests } from '../shared/src/data/questgen.ts';
import { generateArcs } from '../shared/src/data/questarcs.ts';
import { BASIC_TACTICS } from '../shared/src/data/boarding.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';

const ROOT = path.join(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.json'), 'utf8')) as { assets: Record<string, { local: string; remote: string }> };
const baked = (id: string) => {
  const e = manifest.assets[id];
  return !!e && fs.existsSync(path.join(ROOT, 'assets', e.local));
};

const NEW_BIOMES = ['jungle', 'mangrove', 'atoll', 'saltflat', 'blacksand', 'fungal', 'crystal'];
const P5_ART = [
  ...[...BASIC_TACTICS, 'officers', 'colours', 'captain'].map((t) => `icon.bt_${t}`), 'icon.dash', 'bg.boarding',
  ...NEW_BIOMES.map((b) => `tex.land_${b}`), ...NEW_BIOMES.map((b) => `prop.decor_${b}`), 'tex.shore_coral',
  'prop.life_hut', 'prop.life_boat', 'prop.life_tent', 'prop.life_crates', 'prop.life_pirate_tent', 'prop.life_fort',
  'creature.seal', 'creature.turtle', 'creature.crab', 'creature.gull',
];

const world = generateWorld(1337);
const ALL_JOBS = [...generateQuests(world, 1337), ...generateArcs(world, 1337), ...generateIslandJobs(world, 1337)];
const FACES = [...new Set(ALL_JOBS.map((q) => `portrait.${q.portrait}`))];

test('every piece of the new art that is registered is baked (the rest is drawn by the old art or by hand)', () => {
  const unbaked = [...P5_ART, ...FACES].filter((id) => manifest.assets[id] && !baked(id));
  assert.deepEqual(unbaked, []);
});

test("every quest giver has a portrait id, and it is of the giver's sex", () => {
  for (const q of ALL_JOBS) {
    assert.ok(q.portrait, q.id);
    const first = q.mentor.split(' ')[0];
    if (GIVER_WOMEN.includes(first)) assert.ok(q.portrait!.endsWith('_f'), `${q.mentor} → ${q.portrait}`);
    if (GIVER_MEN.includes(first)) assert.ok(q.portrait!.endsWith('_m'), `${q.mentor} → ${q.portrait}`);
  }
  assert.equal(FACES.length, 33);
});

// The Higgsfield batch is painted one picture at a time (docs/11 P5); this turns from TODO to a plain test once it is in.
test("the new art is complete: orders, biomes, the islands' people and beasts, every giver's face", { todo: 'P5 art is still being painted' }, () => {
  const missing = [...P5_ART, ...FACES].filter((id) => !baked(id));
  assert.deepEqual(missing, []);
});
