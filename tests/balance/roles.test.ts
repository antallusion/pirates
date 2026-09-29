// The roles of hulls and the weight of numbers in real fights (docs/12 §3.6, P12): three ships of a level beat one
// a level up more often than not, all along the ladder; a fishing hull, however well fought, is no match for a
// warship of her level; a merchant carries what two and a half warships do (tests/shiplevel.test.ts) and never
// beats one of her level (ladder.test.ts). `npm run balance` fights the full tables.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { hullRole } from '../../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import { duelSea, squad, winRate } from './duel.ts';

test('three of a level against one a level up: the three win more often than not, along the whole ladder', () => {
  const game = duelSea();
  const n = 18; // at the pace of three a sloop's pack sits near the line: twelve fights are too few to tell
  let all = 0;
  for (const [cls, lv] of [['sloop', 1], ['schooner', 3], ['brig', 5], ['frigate', 7], ['man_o_war', 9]] as [ShipClassId, number][]) {
    let w = 0;
    for (let k = 0; k < n; k++) if (squad(game, { cls, level: lv, craft: 'bot' }, 3, { cls, level: lv + 1, craft: 'bot' }, k) === 'many') w++;
    assert.ok(w >= n * 0.35, `${cls} ⚓${lv} ×3 against ⚓${lv + 1}: ${w}/${n}`);
    all += w;
  }
  assert.ok(all >= 5 * n * 0.55, `three against one a level up: ${all}/${5 * n}`);
});

test('a fishing hull fights a level below her own: even perfectly fought she does not beat a warship of her level', () => {
  const game = duelSea();
  assert.equal(hullRole('fishing_ketch'), 'fish');
  assert.equal(SHIP_CLASSES.fishing_ketch.passive.id, 'wet_well', 'she is built for the catch');
  assert.equal(SHIP_CLASSES.harpoon_whaler.fixedMount, 'harpoon', 'the whaler carries her harpoon gun');
  const r = winRate(game, { cls: 'fishing_ketch', level: 3, craft: 'perfect' }, { cls: 'schooner', level: 3, craft: 'bot' }, 12);
  assert.ok(r.wins <= 1, `fishing ketch ⚓3 (perfect) against a schooner ⚓3: ${r.wins}/12`);
});
