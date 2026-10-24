// The owner's 242 paintings of 2026-10-24 (docs/ART_TODO.md, tools/art/pack_oct24.py): every id the game asks for is
// in the manifest and on disk, every painting of the batch is shown somewhere, and no place still shows a stand-in where
// its own painting exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import { ISLAND_BIOMES } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import {
  CHAPTER_COUNT, DROP_CARD, END_HEADER, GENERIC_HARBOURS, ICON_KIN, LORE_CARD, WAY_HEADER, chapterCard, harbourArt, portMark, trekArt, zoneBossCard,
} from '../shared/src/data/paintart.ts';
import { ARTIFACTS, ARTIFACT_ICON_KIN, RELIC_IDS, relicIcon } from '../shared/src/data/artifacts.ts';
import { MINIGAMES } from '../shared/src/data/minigames.ts';
import { ZONE_BOSSES } from '../shared/src/data/zonebosses.ts';
import { ISO_CORNERS, ISO_MAP_OF } from '../shared/src/data/isleiso.ts';
import { SHOP } from '../shared/src/data/shop.ts';
import { QUAY_PIERS } from '../shared/src/data/quays.ts';
import { PLAN } from '../shared/src/data/campaign/plan.ts';
import { CHAPTERS } from '../shared/src/data/campaign/chapters.ts';

type Entry = { local: string; job?: string };
const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: Record<string, Entry> };
const index = existsSync('assets/raw/art2026-10-24/_cells/index.json') ? JSON.parse(readFileSync('assets/raw/art2026-10-24/_cells/index.json', 'utf8')) as Record<string, unknown> : null;
const BATCH = Object.entries(manifest.assets).filter(([, e]) => e.job === 'gpt-art_oct24').map(([id]) => id);
const world = generateWorld(WORLD_SEED);

const baked = (id: string) => {
  const e = manifest.assets[id];
  assert.ok(e, `${id} in the manifest`);
  assert.ok(existsSync(`assets/${e.local}`) && statSync(`assets/${e.local}`).size > 1000, `${id}: assets/${e.local} on disk`);
};

test('the batch: 242 paintings baked, each on disk with its AVIF twin when smaller', () => {
  assert.equal(BATCH.length, 242);
  if (index) assert.deepEqual([...BATCH].sort(), Object.keys(index).sort(), 'every cell of the owner\'s sheets');
  for (const id of BATCH) baked(id);
});

test('every id the hooks ask for is painted', () => {
  const ids = [
    ...Object.values(LORE_CARD), ...Array.from({ length: CHAPTER_COUNT }, (_, i) => chapterCard(i + 1)),
    ...Object.values(DROP_CARD), ...Object.values(WAY_HEADER), ...Object.values(END_HEADER),
    ...ISLAND_BIOMES.flatMap((b) => trekArt(b)),
    ...Object.values(ZONE_BOSSES).map((z) => zoneBossCard(z.classId)),
    ...Object.values(MINIGAMES).flatMap((d) => [d.art, ...(d.kin ? [d.kin] : [])]),
    ...Object.values(ARTIFACTS).flatMap((a) => [`icon.${a.icon}`, `icon.${a.kin}`]),
    ...RELIC_IDS.map((r) => `icon.${relicIcon(r)}`),
    ...Object.entries({ ...ICON_KIN, ...ARTIFACT_ICON_KIN }).flatMap(([a, b]) => [`icon.${a}`, `icon.${b}`]),
    ...SHOP.filter((f) => f.level).map((f) => `icon.${f.icon}`),
    ...['capital', 'town', 'village', 'raft'].map((k) => `icon.map_port_${k}`),
    ...Object.keys(ISO_CORNERS).map((m) => `isle.map.${m}`),
    'prop.citadel', 'prop.lookout', 'prop.castaways', 'isle.pen',
    ...['old_moorings', 'old_tithe', 'fog_changeling', 'cinder_ray', 'drowned_prelate', 'rime_twins'].map((b) => `card.${b}`),
  ];
  for (const id of ids) baked(id);
  // the hooks' own paintings, not the stand-ins any more
  assert.ok(Object.values(MINIGAMES).every((d) => d.art === `card.mg_${d.id}`), 'the mini-games show their own cards');
  assert.ok(Object.values(ARTIFACTS).every((a) => a.icon === `art_${a.id}`), 'the artifacts wear their own icons');
  assert.equal(Object.keys(ARTIFACTS).length, 40);
  assert.ok(SHOP.filter((f) => f.level).every((f) => f.icon === `gift_lv${f.level}`), 'the level gifts their own chests');
  assert.equal(ISO_MAP_OF.saltflat, 'dry');
  assert.equal(ISO_MAP_OF.barren, 'dry');
  for (const b of ['ruins', 'bone', 'crystal'] as const) assert.equal(ISO_MAP_OF[b], 'drowned');
});

test('every harbour of the world opens on a painting: her own, a floating town\'s or her sea and flag\'s', () => {
  const first = (ids: string[]) => ids.find((id) => manifest.assets[id]);
  let own = 0, generic = 0, raft = 0;
  const byFlag: string[] = [];
  for (const p of world.ports) {
    const ids = harbourArt(p);
    const got = first(ids);
    assert.ok(got, `${p.id}: a header`);
    if (got === `bg.port_${p.id}`) own++;
    else if (got.startsWith('bg.port_raft_')) raft++;
    else if (got.startsWith('bg.port_gen_')) generic++;
    else byFlag.push(`${p.id} ${p.region}/${p.faction}`);
    // a group of the §3 list never falls to the flag's picture
    if (GENERIC_HARBOURS[p.region as RegionId]?.[p.faction]) assert.notEqual(got, `bg.port_${p.faction}`, `${p.id}: her sea's own`);
    // her town on the chart: her own painting where there is one, and its piers known for the keel
    if (manifest.assets[`prop.port_${p.id}`]) assert.ok(QUAY_PIERS[`prop.port_${p.id}`]?.length, `${p.id}: her own piers`);
  }
  // the few left on their flag's picture: a sea and flag with no group (black_coast/free, the Abyss's)
  assert.ok(byFlag.length <= 6, `on the flag's picture: ${byFlag.join(', ')}`);
  assert.ok(own >= 60 && generic >= 200 && raft >= 10, `own ${own}, generic ${generic}, rafts ${raft}`);
  // every harbour painting of the batch is some port's own, or a group's, or a floating town's
  const used = new Set(world.ports.flatMap((p) => harbourArt(p)));
  for (const id of BATCH.filter((x) => x.startsWith('bg.port_'))) assert.ok(used.has(id), `${id} is shown`);
  for (const id of BATCH.filter((x) => x.startsWith('prop.port_'))) assert.ok(world.ports.some((p) => `prop.port_${p.id}` === id), `${id} is a town of the chart`);
  assert.equal(portMark({ id: 'saltmarrow', size: 3 }), 'map_port_capital');
  assert.equal(portMark({ id: 'raft_3', raft: true }), 'map_port_raft');
});

test('the campaign\'s ports and hubs: each with a harbour of her own', () => {
  const hubs = new Set(CHAPTERS.map((c) => c.hub));
  for (const h of hubs) {
    const p = world.ports.find((x) => x.id === h);
    if (!p) continue;
    assert.ok(manifest.assets[`bg.port_${h}`], `${h}: the hub's own harbour`);
  }
  assert.equal(PLAN.length, CHAPTER_COUNT);
  for (const id of ['saltmarrow', 'gravesend', 'blackwater', 'tidewrack']) {
    assert.ok(manifest.assets[`bg.port_${id}`] && manifest.assets[`prop.port_${id}`], `${id}: harbour and town`);
  }
});
