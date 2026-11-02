// The hold's balance after the volume table of 2026-11-02 (owner: «чем интереснее груз, тем больше весит; менее интересный
// груз — меньше весит … 0,1, например, или 0,01») and the overload line at half the hold (three quarters on a merchantman;
// it was 90 % / 99 %). What a hold carries to its line on one trip, in silver at base prices, against the old table:
//  - the trade's commodities (base 25–130, a whole m³ each before: rum, cloth, iron, gunpowder, weapons, whale oil, baleen…)
//    carries about what it did — within 0.5–1.6 of the old hold's worth, the median 0.75–1.3 (a warship's about 0.85, a
//    merchantman's about 1.2: her line at three quarters) — so the trade routes are neither broken nor trivial;
//  - the cheap bulk (salt, fish, timber, coal) carries more than it did (it was hopeless for its room), the luxuries far
//    less (a sloop took 270 pearls, 59 000 silver, to her line; now eight): INTENTIONAL — a luxury is no longer the only
//    good worth a hold, and the hold's choice matters;
//  - a starter sloop to her line carries a meaningful but limited load of valuable goods (8–20 pearls), and still a
//    better hold of luxury than of bulk;
//  - the ship's stores for a voyage (its food, a repair's sailcloth, twenty planks) take under a tenth of any hold.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS, TRADE_GOOD_IDS } from '../../shared/src/data/goods.ts';
import type { GoodId } from '../../shared/src/data/goods.ts';
import { SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { overloadAt } from '../../shared/src/data/overload.ts';
import { provisionsPerMinute, repairKitCloth, VOYAGE_MINUTES } from '../../shared/src/data/voyage.ts';

/** The volumes before 2026-11-02 (m³ a unit). */
const OLD_VOL: Record<GoodId, number> = {
  provisions: 1, rum: 1, sugar: 1, tobacco: 1, timber: 2, planks: 1.5, sailcloth: 1, iron: 1, coal: 1.5, gunpowder: 1, cloth: 1, spices: 0.5, medicine: 0.5, weapons: 1, whale_oil: 1, salt: 1, pearls: 0.1, dreamleaf: 1, cursed_relics: 0.5, abyssal_ore: 1, leviathan_bone: 1, sulfur_iron: 1, drowned_silk: 0.5, kraken_ink: 0.3, fish: 1, prime_fish: 1, tar: 1, smoked_fish: 1, scrimshaw: 0.2, baleen: 1, ambergris: 0.2, orca_tooth: 0.2, whalebone: 1, narwhal_tusk: 1, shark_skin: 1, serpent_scale: 1, salted_fish: 1,
};
/** The old overload lines. */
const OLD_LINE = (id: ShipClassId) => (SHIP_CLASSES[id].list === 'trade' || SHIP_CLASSES[id].list === 'hauler' ? 0.99 : 0.9);

/** A hold's worth to her line (silver at base prices) of one good. */
const worth = (id: ShipClassId, g: GoodId, vol: number, line: number) => Math.floor((SHIP_CLASSES[id].holdVolume * line) / vol) * GOODS[g].basePrice;
const now = (id: ShipClassId, g: GoodId) => worth(id, g, GOODS[g].volume, overloadAt(id));
const before = (id: ShipClassId, g: GoodId) => worth(id, g, OLD_VOL[g], OLD_LINE(id));

const HULLS: ShipClassId[] = ['sloop', 'brig', 'frigate', 'fluyt', 'galleon'];
/** The trade's commodities: 25–130 silver, a whole m³ each in the old table (the old light luxuries — spices, medicine,
 *  teeth — are meant to grow bulkier and are weighed with the luxuries). */
const MIDDLE = TRADE_GOOD_IDS.filter((g) => GOODS[g].basePrice >= 25 && GOODS[g].basePrice <= 130 && !GOODS[g].contraband && OLD_VOL[g] === 1);

test('the trade\'s middle carries about what it did: a hold\'s worth to the line within 0.5–1.6 of the old', () => {
  assert.ok(MIDDLE.length >= 10, `${MIDDLE.length} goods in the middle`);
  for (const id of HULLS) {
    const ratios = MIDDLE.map((g) => now(id, g) / Math.max(1, before(id, g)));
    const median = [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
    assert.ok(median >= 0.75 && median <= 1.3, `${id}: the middle's median ×${median.toFixed(2)}`);
    for (const [i, g] of MIDDLE.entries()) assert.ok(ratios[i] >= 0.5 && ratios[i] <= 1.6, `${id} ${g}: ×${ratios[i].toFixed(2)} (${before(id, g)} → ${now(id, g)})`);
  }
});

test('bulk carries more than it did, luxury far less (intentional), and luxury still the better hold', () => {
  for (const id of HULLS) {
    for (const g of ['salt', 'fish', 'timber', 'coal'] as GoodId[]) assert.ok(now(id, g) > before(id, g), `${id} ${g}: ${before(id, g)} → ${now(id, g)}`);
    for (const g of ['pearls', 'ambergris', 'scrimshaw'] as GoodId[]) assert.ok(now(id, g) < before(id, g) * 0.2, `${id} ${g}: ${before(id, g)} → ${now(id, g)}`);
    assert.ok(now(id, 'pearls') > now(id, 'rum') * 1.5 && now(id, 'rum') > now(id, 'salt'), `${id}: pearls > rum > salt`);
  }
  // the best hold of all against the middle's: a few times, no longer hundreds
  for (const id of HULLS) {
    const best = Math.max(...TRADE_GOOD_IDS.map((g) => now(id, g)));
    const mid = now(id, 'rum');
    assert.ok(best / mid >= 2 && best / mid <= 8, `${id}: the best hold ×${(best / mid).toFixed(1)} of rum's`);
  }
});

test('a starter sloop to her line: a meaningful but limited load of valuable goods', () => {
  const line = SHIP_CLASSES.sloop.holdVolume * overloadAt('sloop');
  const pearls = Math.floor(line / GOODS.pearls.volume), spices = Math.floor(line / GOODS.spices.volume), rum = Math.floor(line / GOODS.rum.volume);
  assert.ok(pearls >= 8 && pearls <= 20, `${pearls} pearls`);
  assert.ok(spices >= 15 && spices <= 40, `${spices} spices`);
  assert.ok(rum >= 25 && rum <= 60, `${rum} rum`);
  const silver = pearls * GOODS.pearls.basePrice;
  assert.ok(silver >= 1500 && silver <= 6000, `a sloop's pearls: ${silver} silver`);
});

test('a voyage\'s stores take a few per cent of any hold', () => {
  for (const id of ['sloop', 'brig', 'frigate', 'galleon', 'man_o_war'] as ShipClassId[]) {
    const c = SHIP_CLASSES[id];
    const food = Math.ceil(provisionsPerMinute(c.crewMax) * VOYAGE_MINUTES);
    const cloth = repairKitCloth(c.sailHp);
    const room = food * GOODS.provisions.volume + cloth * GOODS.sailcloth.volume + 20 * GOODS.planks.volume;
    assert.ok(room <= c.holdVolume * 0.1, `${id}: ${room.toFixed(2)} m³ of ${c.holdVolume}`);
  }
});
