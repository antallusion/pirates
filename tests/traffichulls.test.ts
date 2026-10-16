// The sea's traffic in more hulls (owner, 2026-10-16): the fleet's other hulls by the role, the level and the waters,
// never the doubloons' own, always of the square's level, each painted; the balance stands (only the hull changes).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { levelRange } from '../shared/src/data/shiplevel.ts';
import { trafficHulls } from '../shared/src/data/traffichulls.ts';
import type { TrafficRole } from '../shared/src/data/traffichulls.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { spawnTraffic } from '../server/src/game/npc.ts';
import { makeGame } from './helpers.ts';

const ROLES: TrafficRole[] = ['merchant', 'fisher', 'patrol', 'pirate', 'hunter'];
const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets?: Record<string, unknown> } & Record<string, unknown>;
const art = (manifest.assets ?? manifest) as Record<string, unknown>;

test('the traffic\'s hulls: of the square\'s level, never the doubloons\', every one painted; more of them than before', () => {
  const seen = new Set<string>();
  for (const role of ROLES) for (let L = 1; L <= 10; L++) for (const r of Object.keys(REGIONS) as RegionId[]) {
    const pool = trafficHulls(role, L, r);
    assert.ok(pool.length >= 1, `${role} ⚓${L} ${r}`);
    for (const [c, w] of pool) {
      assert.ok(w > 0);
      assert.ok(!SHIP_CLASSES[c].premium, `${c} is the doubloons'`);
      assert.ok(art[`ship.${c}`], `${c} painted`);
      seen.add(c);
      if (c === 'cutter' || c === 'harpoon_whaler') continue; // the role's own as before
      const [lo, hi] = levelRange(c);
      // (the role's usual hulls keep hullsFor's nearest-levels rule; the new ones sail only at their own levels)
      if (pool.length > 1 && !['sloop', 'schooner', 'fluyt', 'galleon', 'xebec', 'brigantine', 'brig', 'frigate', 'man_o_war'].includes(c)) assert.ok(L >= lo && L <= hi, `${c} at ⚓${L}`);
    }
  }
  assert.ok(seen.size >= 35, `${seen.size} hulls sail the sea's traffic`);
  // the waters' own
  const has = (role: TrafficRole, L: number, r: RegionId, c: string) => trafficHulls(role, L, r).some(([x]) => x === c);
  assert.ok(has('pirate', 4, 'ashen_isles', 'galiot') && has('pirate', 5, 'ashen_isles', 'war_galley'), 'the Ashen Isles\' galleys');
  assert.ok(has('pirate', 2, 'whispering', 'lugger'), 'the fog\'s luggers');
  assert.ok(has('merchant', 6, 'drowned_crown', 'carrack') && has('merchant', 8, 'drowned_crown', 'plate_galleon'), 'the old trade\'s carracks and plate galleons');
  assert.ok(has('patrol', 2, 'black_coast', 'gunboat'), 'the Crown\'s gunboats');
  assert.ok(has('fisher', 2, 'black_coast', 'buss'), 'herring busses off the home ports');
});

test('the sea puts them out: many hulls about a captain, each with her name and the square\'s level', () => {
  const { game } = makeGame();
  const classes = new Set<string>();
  let n = 0;
  for (const [region, role] of [['ashen_isles', 'pirate'], ['gravewater', 'merchant'], ['black_coast', 'fisher'], ['drowned_crown', 'merchant'], ['leviathan_reach', 'hunter']] as [RegionId, TrafficRole][]) {
    const [cx, cy] = REGIONS[region].center;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const x = cx + Math.cos(a) * (1500 + (i % 5) * 700), y = cy + Math.sin(a) * (1500 + (i % 5) * 700);
      const s = spawnTraffic(game, role, x, y, { x: cx, y: cy });
      if (!s) continue;
      n++;
      classes.add(s.loadout.classId);
      assert.ok(s.name && s.name.length > 2, 'a name');
      assert.equal(s.npcRole, role);
      const [lo, hi] = levelRange(s.loadout.classId);
      assert.ok(s.shipLevel >= lo && s.shipLevel <= hi);
      game.removeShip(s.id);
    }
  }
  assert.ok(n >= 60, `${n} put out`);
  assert.ok(classes.size >= 12, `${classes.size} hulls: ${[...classes].join(', ')}`);
});
