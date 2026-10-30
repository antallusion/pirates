// A hull's whole card (Нефигугум, forum post 28): the tree's detail and the site's fleet read the game's own numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailHull, hullAt, hullCard, hullCardHtml, hullGuns } from '../shared/src/data/hullcard.ts';
import { armySlots } from '../shared/src/data/army.ts';
import { RESEARCH_COST } from '../shared/src/data/research.ts';
import { levelRange, levelScale } from '../shared/src/data/shiplevel.ts';
import { GUNS, SHIP_CLASSES, SHIP_CLASS_IDS } from '../shared/src/data/ships.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';

const listed = SHIP_CLASS_IDS.filter((id) => SHIP_CLASSES[id].list && !SHIP_CLASSES[id].monster);

test('every hull of the four lists has a full card in both languages', () => {
  assert.ok(listed.length >= 80);
  for (const id of listed) {
    for (const lang of ['en', 'ru'] as const) {
      const c = hullCard(id, lang);
      assert.ok(c.name && c.flavour && c.listName && c.roleName, id);
      assert.equal(c.stats.length, 10, id);
      for (const s of c.stats) assert.ok(Number.isFinite(s.lo) && Number.isFinite(s.hi) && s.text, `${id} ${s.k}`);
      assert.ok(c.price.text && c.sold.text && c.tree.text && c.guns.text, id);
      const html = hullCardHtml(c, lang, { art: '/a.webp' });
      assert.match(html, /data-hc-close/);
      assert.doesNotMatch(html, /undefined|NaN|\{\w+\}/, id);
    }
  }
});

test('the hold is the game’s: her class’s volume scaled by her levels', () => {
  for (const id of listed) {
    const [lo, hi] = levelRange(id);
    const hold = hullCard(id, 'ru').stats.find((s) => s.k === 'hold')!;
    assert.equal(hold.lo, Math.round(SHIP_CLASSES[id].holdVolume * levelScale(id, lo).hold), id);
    assert.equal(hold.hi, Math.round(SHIP_CLASSES[id].holdVolume * levelScale(id, hi).hold), id);
    assert.equal(hullCard(id, 'en').stats.find((s) => s.k === 'slots')!.lo, armySlots(SHIP_CLASSES[id].tier));
  }
  assert.equal(hullCard('sloop', 'ru').stats.find((s) => s.k === 'hold')!.text, `${hullAt('sloop', 1).hold}–${hullAt('sloop', 3).hold}`);
});

test('the guns her deck carries follow the gun’s tier', () => {
  for (const id of listed) for (const g of hullGuns(id)) assert.ok(GUNS[g].minTier <= SHIP_CLASSES[id].tier);
  assert.ok(!hullGuns('sloop').includes('demi_cannon_32'));
});

test('the tree line: start, research cost and progress, premium', () => {
  assert.equal(hullCard('sloop', 'en').tree.state, 'start');
  const brig = hullCard('brig', 'ru', { research: { xp: {}, free: 0, done: [] }, sailing: 'sloop' });
  assert.equal(brig.tree.cost, RESEARCH_COST[SHIP_CLASSES.brig.tier]);
  assert.ok(['locked', 'near'].includes(brig.tree.state));
  const prem = listed.find((id) => SHIP_CLASSES[id].premium)!;
  assert.equal(hullCard(prem, 'ru').tree.state, 'premium');
});

test('owned, berthed and the line against the sailed ship', () => {
  const c = hullCard('fluyt', 'ru', { sailing: 'sloop', sailLevel: 2, berths: [{ classId: 'fluyt', port: 'Тортуга' }] });
  assert.equal(c.own, 'berth');
  assert.match(c.ownText, /Тортуга/);
  const hold = c.compare!.rows.find((r) => r.k === 'hold')!;
  assert.equal(hold.d, hullAt('fluyt', levelRange('fluyt')[0]).hold - hullAt('sloop', 2).hold);
  assert.equal(hullCard('sloop', 'en', { sailing: 'sloop' }).own, 'sail');
  assert.equal(hullCard('sloop', 'en', { sailing: 'sloop' }).compare, undefined);
});

test('data-detail="hull:<id>" parses for the generic tap-to-detail system', () => {
  assert.equal(detailHull('hull:brig'), 'brig');
  assert.equal(detailHull('unit:brig'), null);
  assert.equal(detailHull('hull:kraken' as `hull:${ShipClassId}`), null);
});
