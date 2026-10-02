// The art of the living sea (docs/12 P11): painted as sheets, one family to a sheet so each is of one hand
// (tools/art/sheets.json), cut into the manifest. What is registered is baked and of its family's size; every
// family the game asks for is on a sheet; the flags are all painted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FLAGS, flagAsset } from '../shared/src/data/looks.ts';
import { ITEM_ART } from '../shared/src/data/itemart.ts';
import { namedPirates } from '../shared/src/data/pirates.ts';
import { PROFESSIONS } from '../shared/src/data/estate.ts';
import { TATTOOS } from '../shared/src/data/sidequests.ts';
import { FISH_IDS } from '../shared/src/data/fishing.ts';
import { PET_IDS } from '../shared/src/data/companions.ts';
import { BEAST_IDS } from '../shared/src/data/beasts.ts';
import { ENCOUNTER_IDS } from '../shared/src/data/encounters.ts';
import { BUILDING_IDS } from '../shared/src/data/holdings.ts';

const ROOT = path.join(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.json'), 'utf8')) as { assets: Record<string, { local: string; fit?: string }> };
const sheets = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'art', 'sheets.json'), 'utf8')) as Record<string, { ids: (string | null)[]; px: number; ratio?: number; square: boolean; mode: string; painting?: boolean; uniform?: number }>;
const onSheets = new Set(Object.values(sheets).flatMap((s) => s.ids.filter((x): x is string => !!x)));
/** Ids on sheets already painted and cut (a sheet still in the painter's queue is flagged `painting`). */
const painted = new Set(Object.values(sheets).filter((s) => !s.painting).flatMap((s) => s.ids.filter((x): x is string => !!x)));

/** A webp's size, from its header (VP8, VP8L or VP8X). */
function webpSize(file: string): [number, number] {
  const b = fs.readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

test('what the sheets have given is baked, at its family\'s size', () => {
  for (const [name, sh] of Object.entries(sheets)) {
    if (sh.painting) continue;
    for (const id of sh.ids) {
      if (!id || !manifest.assets[id]) continue;
      const file = path.join(ROOT, 'assets', manifest.assets[id].local);
      assert.ok(fs.existsSync(file), `${id} (${name}) is registered but not baked`);
      const [w, h] = webpSize(file);
      if (sh.mode === 'tiles') assert.deepEqual([w, h], [Math.round(sh.px * (sh.ratio ?? 1)), sh.px], `${id}: ${w}×${h}`);
      else if (sh.square) assert.deepEqual([w, h], [sh.px, sh.px], `${id}: ${w}×${h}`);
      // Figures cut at one scale for the sheet keep their own sizes, within the sheet's cell.
      else if (sh.uniform) assert.ok(Math.max(w, h) <= 1024 && Math.min(w, h) >= 64, `${id}: ${w}×${h}`);
      else assert.equal(Math.max(w, h), sh.px, `${id}: ${w}×${h}`);
    }
  }
});

test('every family the game asks for is on a sheet', () => {
  const want = [
    ...TATTOOS.map((t) => `icon.tattoo_${t.id}`),
    ...FISH_IDS.map((f) => `icon.fish_${f}`),
    ...PET_IDS.map((p) => `icon.pet_${p}`),
    ...BEAST_IDS.map((b) => `monster.${b}`), 'sight.giant_turtle',
    ...namedPirates().map((p) => `portrait.${p.art}`),
    ...PROFESSIONS.flatMap((p) => [`portrait.res_${p}_m`, `portrait.res_${p}_f`]),
    ...['caravan_office', 'forge', 'smokehouse', 'try_works', 'trophy_hall', 'signal_tower', 'residents_house'].map((b) => `icon.build_${b}`),
    // Every encounter has a card of its own; every island building is painted worn and ruined as well as whole.
    ...ENCOUNTER_IDS.map((e) => `card.enc_${e}`),
    ...BUILDING_IDS.flatMap((b) => [`icon.build_${b}_1`, `icon.build_${b}_2`]),
  ];
  const off = [...new Set(want)].filter((id) => !onSheets.has(id));
  assert.deepEqual(off, []);
  // The items: every base and legendary, four sheets of sixteen.
  assert.equal(ITEM_ART.length, 64);
});

test('the sixty-four flags are painted, one set, all the same size', () => {
  for (let i = 0; i < FLAGS.length; i++) {
    const id = flagAsset(i);
    const e = manifest.assets[id];
    assert.ok(e, `${id} missing`);
    assert.deepEqual(webpSize(path.join(ROOT, 'assets', e.local)), [240, 160], id);
  }
});

test('the living sea is painted: every id on every sheet is in the manifest and baked', () => {
  const missing = [...painted].filter((id) => !manifest.assets[id] || !fs.existsSync(path.join(ROOT, 'assets', manifest.assets[id].local)));
  assert.deepEqual(missing, []);
  // The singles of P11: Old Needle, the two hulls, the poster's paper; and every item icon.
  for (const id of ['portrait.giver_old_needle', 'ship.fishing_ketch', 'ship.harpoon_whaler', 'ui.poster', ...ITEM_ART.map((r) => `icon.item_${r[0]}`)]) {
    assert.ok(manifest.assets[id] && fs.existsSync(path.join(ROOT, 'assets', manifest.assets[id].local)), id);
  }
});
