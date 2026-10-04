// The yard's tree of hulls (owner, 2026-10-04: «прокачку кораблей можно сделать как в игре world of tanks»; docs/20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CROSS_LINES, FREE_XP_SHARE, RESEARCH_COST, TREE, initialResearch, needsResearch, researchParents, researchQuote } from '../shared/src/data/research.ts';
import { FLEET_LISTS, SHIP_CLASSES, SHIP_CLASS_IDS } from '../shared/src/data/ships.ts';
import { xpForLevel } from '../shared/src/constants.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { join, makeGame } from './helpers.ts';

const bad = (c: ReturnType<typeof join>) => c.all('toast').filter((t) => t.kind === 'bad').map((t) => t.msg);

test('every silver hull above the first tier has a way in: a parent in her line, or a line that leads to her', () => {
  for (const list of FLEET_LISTS) {
    assert.ok(TREE[list].length >= 10, list);
    for (const id of TREE[list]) {
      if (!needsResearch(id)) continue;
      const parents = researchParents(id);
      assert.ok(parents.length > 0, `${id}: a parent`);
      for (const p of parents) assert.ok(SHIP_CLASSES[p].tier < SHIP_CLASSES[id].tier || CROSS_LINES[id]?.includes(p), `${id} ← ${p}: from below`);
    }
  }
  // Premium hulls and the deep's creatures are never researched.
  for (const id of SHIP_CLASS_IDS) if (SHIP_CLASSES[id].premium || SHIP_CLASSES[id].monster) assert.equal(needsResearch(id), false, id);
});

test('every line runs whole on its own silver hulls (2026-10-04): no list hands over to another', () => {
  // The runners went on from the Baltimore clipper to the razee and the traders from the East Indiaman to the great
  // galleon, till the eight that make the lines whole gave each list a silver hull at every tier (docs/20 §6).
  assert.deepEqual(CROSS_LINES, {});
  for (const list of FLEET_LISTS) {
    for (let t = 2; t <= 5; t++) {
      const silver = TREE[list].filter((id) => SHIP_CLASSES[id].tier === t && needsResearch(id));
      assert.ok(silver.length > 0, `${list}: a hull to research at tier ${t}`);
      for (const id of silver) {
        const parents = researchParents(id);
        assert.ok(parents.length && parents.every((p) => SHIP_CLASSES[p].list === list && SHIP_CLASSES[p].tier === t - 1), `${id} ← ${parents.join(', ')}: her own list, the tier below`);
        // A silver parent among them: the line is walked without a hull bought for doubloons.
        assert.ok(parents.some((p) => !SHIP_CLASSES[p].premium), `${id}: a silver parent`);
      }
    }
  }
  assert.ok(researchParents('polacre').includes('baltimore_clipper') && researchParents('great_xebec').includes('polacre'));
  assert.ok(researchParents('great_indiaman').includes('east_indiaman') && researchParents('armed_fluyt').includes('holk'));
  assert.ok(!researchParents('razee').includes('baltimore_clipper') && !researchParents('great_galleon').includes('east_indiaman'));
  assert.deepEqual(researchParents('sloop_of_war').sort(), ['fireship', 'gunboat']);
});

test('a tier costs about two fifths of what a captain earns between the levels that open it and the tier below', () => {
  const cum = (l: number) => { let s = 0; for (let i = 1; i < l; i++) s += xpForLevel(i); return s; };
  const gates = [1, 8, 19, 33, 49];
  for (let t = 2; t <= 5; t++) {
    const earned = cum(gates[t - 1]) - cum(gates[t - 2]);
    const share = RESEARCH_COST[t] / earned;
    assert.ok(share > 0.3 && share < 0.5, `tier ${t}: ${RESEARCH_COST[t]} of ${earned} (${share.toFixed(2)})`);
  }
});

test('a new captain knows the first tier and her own hull; an old one keeps what her level let her buy', () => {
  const fresh = initialResearch(1, ['sloop']);
  assert.ok(fresh.includes('sloop') && fresh.includes('cutter') && fresh.includes('gunboat') && fresh.includes('tartane') && fresh.includes('cog'));
  assert.ok(!fresh.includes('schooner') && !fresh.includes('brig'));
  const old = initialResearch(30, ['frigate']);
  assert.ok(old.includes('brig') && old.includes('schooner') && old.includes('frigate'), 'a level-30 captain bought brigs yesterday');
  assert.ok(!old.includes('razee'), 'not what her level never opened');
});

test('the hull she sails earns what the captain earns, a twentieth into the free pool; the next tier is researched with it and the yard sells her', () => {
  const { game } = makeGame();
  const c = join(game, 'Shipwright Wren');
  const s = game.sessionByName('Shipwright Wren')!;
  const p = s.profile!;
  const from = p.loadout.classId;
  game.grantXp(s, 2000, null);
  assert.equal(Math.round(p.research!.xp[from] ?? 0), 2000);
  assert.equal(Math.round(p.research!.free), 2000 * FREE_XP_SHARE);
  // The schooner: a fast hull of the second tier, its parents the first tier of her list.
  const target = 'schooner';
  assert.ok(researchParents(target).includes(from) || SHIP_CLASSES[from].list !== 'fast');
  // Not enough yet (2000 + 100 of 3000), and the yard will not sell her.
  c.push({ t: 'research', classId: target });
  assert.match(bad(c).at(-1)!, /^Needs 3000 experience/);
  const yard = game.world.ports.find((x) => x.shipyardTier >= 2)!;
  s.ship!.docked = yard.id;
  p.docked = yard.id;
  p.gold = 100_000;
  p.level = 20;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: target });
  assert.equal(bad(c).at(-1), 'Research the Schooner first: the yard\'s tree of hulls');
  // More sailing: researched, the experience spent from the sloop first, the free pool after.
  game.grantXp(s, 1000, null);
  c.push({ t: 'research', classId: target });
  assert.ok(p.research!.done.includes(target), bad(c).at(-1));
  assert.ok(c.all('researched').some((m) => m.classId === target));
  assert.ok((p.research!.xp[from] ?? 0) < 1, 'her hull spent first');
  c.push({ t: 'shipyard', action: 'buy_ship', classId: target });
  assert.equal(s.ship!.loadout.classId, target, bad(c).at(-1));
  // A hull without a known parent waits for one.
  const brig = researchQuote(p.research!, 'brig', [target]);
  assert.equal(brig.known.length, 0);
  c.push({ t: 'research', classId: 'brig' });
  assert.match(bad(c).at(-1)!, /^Research a hull of the tier below first/);
});

test('the tree\'s lines read in Russian', () => {
  setLang('ru');
  applyDataLocale('ru');
  try {
    const lines = ['No such hull', 'A hull sold for doubloons is not researched', 'That hull needs no research', 'Already researched', 'Research a hull of the tier below first: the tree of hulls shows which',
      'Needs 3000 experience on the hulls below and the free pool — 2100 so far', "Research the Schooner first: the yard's tree of hulls", 'Researched: the Schooner. Any yard that builds her sells her now.'].map((l) => serverText(l));
    assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l)), []);
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});
