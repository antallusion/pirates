// The island screen (owner, 2026-10-15; assets/future/isle_iso/HANDOFF_PROMPT.md): a map for every biome, every
// building's eight pictures baked with their anchors, the board inside each map's plateau and its pictures inside the
// map, the stages shown as the brief asks, and the screen's words in both tongues.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ISO_CORNERS, ISO_H, ISO_MAP_OF, ISO_UNIT, ISO_W, isoFoot, isoSheet, isoSpot, isoStage } from '../shared/src/data/isleiso.ts';
import type { IsoMap } from '../shared/src/data/isleiso.ts';
import { ISLAND_BIOMES } from '../shared/src/world/regions.ts';
import { BUILDING_IDS } from '../shared/src/data/holdings.ts';
import { PRODUCER_KINDS, PLOT_CELLS } from '../shared/src/data/base.ts';
import { TOWN_CELLS, TREE_TOWN } from '../shared/src/data/isletree.ts';
import { EN, RU } from '../client/src/lang/ui/islescene.ts';

const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: Record<string, { local: string; anchor?: [number, number]; foot?: number }> };
const STAGES = ['s0', 's1', 'l1', 'l2', 'l3', 'l4', 'l5', 'up'];
const MAPS = Object.keys(ISO_CORNERS) as IsoMap[];
const SHEETS = [...new Set([...TREE_TOWN, ...BUILDING_IDS, ...PRODUCER_KINDS.map((k) => isoSheet(`p:${k}`)!)])];

test('every biome has its map, every map is baked', () => {
  for (const b of ISLAND_BIOMES) assert.ok(ISO_MAP_OF[b], `a map for ${b}`);
  for (const m of MAPS) {
    const e = manifest.assets[`isle.map.${m}`];
    assert.ok(e && existsSync(`assets/${e.local}`), `isle.map.${m} baked`);
  }
});

test('every building of the island has its eight pictures, anchored, of its plot', () => {
  assert.equal(SHEETS.length, 43, 'the brief\'s 43 sheets');
  for (const id of SHEETS) {
    for (const st of STAGES) {
      const e = manifest.assets[`isle.${id}.${st}`];
      assert.ok(e && existsSync(`assets/${e.local}`), `isle.${id}.${st} baked`);
      assert.ok(e.anchor && e.anchor[0] > 0 && e.anchor[1] > 0, `isle.${id}.${st} anchored`);
      assert.equal(e.foot, isoFoot(id), `isle.${id}.${st}: its plot`);
    }
  }
  assert.equal(isoFoot('hall'), 4);
  assert.equal(isoFoot('battery'), 2);
  assert.equal(isoFoot('market'), 3);
  assert.equal(isoSheet('p:lumber'), 'lumber');
  assert.equal(isoSheet('pen'), null);
});

test('the board stands inside each plateau, its tallest pictures inside the map', () => {
  const cells: [number, number][] = [...Object.values(TOWN_CELLS), ...PLOT_CELLS.map(([i, j]) => [i + 1, j + 1] as [number, number])];
  for (const m of MAPS) {
    const { t, r, b, l } = ISO_CORNERS[m];
    // the hand-set corners make a diamond about 2 : 1, its back on top
    assert.ok(t[1] < l[1] && t[1] < r[1] && b[1] > l[1] && b[1] > r[1] && l[0] < t[0] && r[0] > t[0], `${m}: a diamond`);
    const ratio = (r[0] - l[0]) / (b[1] - t[1]);
    assert.ok(ratio > 1.5 && ratio < 2.5, `${m}: about 2 : 1 (${ratio.toFixed(2)})`);
    for (const c of cells) {
      const s = isoSpot(m, c);
      for (const p of [s.t, s.r, s.b, s.l]) assert.ok(p[0] >= l[0] - 0.5 && p[0] <= r[0] + 0.5 && p[1] >= t[1] - 0.5 && p[1] <= b[1] + 0.5, `${m} ${c}: inside the plateau`);
    }
    // the tallest picture of the back corner (the hall at level 5) keeps its top on the map
    const e = manifest.assets['isle.hall.l5'];
    const fp = isoSpot(m, TOWN_CELLS.hall, 4);
    const k = (fp.r[0] - fp.l[0]) / (4 * ISO_UNIT);
    assert.ok(fp.b[1] - e.anchor![1] * k > 0, `${m}: the hall's spire on the map`);
    assert.ok(fp.r[0] < ISO_W && fp.b[1] < ISO_H);
  }
});

test('the stages: founding s0 then s1, raising up from 2 and 3, else the level dimmed', () => {
  const job = (level: number, prog: number) => ({ start: 0, end: 1000, level, now: prog * 1000 });
  const at = (L: number, j: ReturnType<typeof job> | null) => isoStage(L, j, j?.now ?? 0);
  assert.deepEqual(at(0, job(1, 0.2)), { stage: 's0', dim: false });
  assert.deepEqual(at(0, job(1, 0.6)), { stage: 's1', dim: false });
  assert.deepEqual(at(2, job(3, 0.1)), { stage: 'up', dim: false });
  assert.deepEqual(at(3, job(4, 0.9)), { stage: 'up', dim: false });
  assert.deepEqual(at(1, job(2, 0.5)), { stage: 'l1', dim: true });
  assert.deepEqual(at(4, job(5, 0.5)), { stage: 'l4', dim: true });
  assert.deepEqual(at(5, null), { stage: 'l5', dim: false });
  assert.deepEqual(at(0, null), { stage: 'l1', dim: false });
});

test('the island screen speaks both tongues, no Latin in the Russian', () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const [k, v] of Object.entries(RU)) {
    assert.ok(v.trim(), `RU ${k}`);
    assert.ok(!/[A-Za-z]/.test(v.replace(/\{[a-z]+\}/g, '')), `no Latin in RU ${k}: ${v}`);
  }
});
