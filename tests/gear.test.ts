// Gear in slots (docs/12 P1): items for the ship and the captain — their lines, rarities, sets and legendaries; putting
// them on within the level and the slots a ship has opened; the yard's old fittings giving way to them; the caps they
// share with talents; what sunk ships leave in the water; the chandler; selling, breaking down, wear and mending.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AFFIXES, CAPTAIN_SLOTS, ITEM_BASES, LEGENDARY_ITEMS, RARITY_AFFIXES, SETS, STASH_SIZE, gearPatterns, gearSource, itemEffect, itemName, itemNamePatterns, makeItem,
  isShipSlot, setBonuses,
} from '../shared/src/data/items.ts';
import type { Item } from '../shared/src/data/items.ts';
import { Rng } from '../shared/src/rng.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';
import { BOARDED_SLOTS, SUNK_SLOTS, chandlerWares, rollDrop } from '../server/src/game/gear.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const bad = (c: ReturnType<typeof join>) => c.all('toast').filter((t) => t.kind === 'bad').map((t) => t.msg);
const item = (base: string, ilvl = 1, extra: Partial<Item> = {}): Item => ({ uid: 0, base, ilvl, rarity: 0, affixes: [], dur: 100, ...extra });

test('items: the main line grows with level and rarity; extra lines by rarity; a worn-through item does nothing', () => {
  const rng = new Rng(7);
  for (let r = 0; r <= 4; r++) {
    const it = makeItem(rng, 1, { ilvl: 5, rarity: r as 0 | 1 | 2 | 3 | 4, base: 'oak_plating' });
    assert.equal(it.affixes.length, RARITY_AFFIXES[r]);
    for (const a of it.affixes) assert.ok(a.a in AFFIXES && !('hullMax' === AFFIXES[a.a].stat || 'armor' === AFFIXES[a.a].stat), 'no line doubles the main one');
  }
  const grey = itemEffect(item('oak_plating', 1)).mods;
  const blue10 = itemEffect(item('oak_plating', 10, { rarity: 2 })).mods;
  assert.ok(Math.abs(grey.hullMax! - 0.1) < 1e-9);
  assert.ok(Math.abs(blue10.hullMax! - 0.1 * 1.54 * 1.2) < 1e-9);
  assert.equal(grey.maxSpeed, -0.02, 'the price of oak is never scaled');
  assert.deepEqual(itemEffect(item('oak_plating', 5, { dur: 0 })).mods, {});
  // A captain's piece: points of a characteristic, turned into the ship's lines.
  const g = gearSource([item('tricorne', 1)]);
  assert.equal(g.cap.leadership, 4);
  assert.ok(Math.abs(g.mods.moraleRegen! - 0.04) < 1e-9);
});

test('sets: two, four and six pieces; a legendary carries its gift', () => {
  const pieces = (Object.keys(SETS.admiralty.pieces) as string[]).map((slot) => {
    const base = Object.values(ITEM_BASES).find((b) => b.slot === slot)!;
    return item(base.id, 3, { rarity: 3, set: 'admiralty' });
  });
  assert.equal(pieces.length, 6);
  assert.equal(setBonuses(pieces.slice(0, 1)).flags.length, 0);
  assert.ok(setBonuses(pieces.slice(0, 2)).mods.reloadMul! < 0);
  assert.ok(!setBonuses(pieces.slice(0, 5)).flags.includes('line_of_battle'));
  assert.ok(setBonuses(pieces).flags.includes('line_of_battle'));
  assert.equal(itemName(pieces[0]), Object.values(SETS.admiralty.pieces)[0]![0]);
  const leg = item('tricorne', 8, { rarity: 4, legendary: 'vane_tricorne' });
  assert.ok(itemEffect(leg).flags.includes('fear_and_respect'));
  assert.equal(itemName(leg, true), LEGENDARY_ITEMS.vane_tricorne.name[1]);
});

test('gear shares the talents’ caps: a hold full of double charges cannot pass +25% gun damage', () => {
  const l = { classId: 'brig' as const, name: 'x', guns: { port: 'medium_12' as const, starboard: 'medium_12' as const }, modules: {} };
  const base = computeShipStats(l, 'corsair', {});
  const many = Array.from({ length: 10 }, () => item('double_charge', 5, { rarity: 3, affixes: [{ a: 'damage' as const, v: 0.05 }] }));
  const st = computeShipStats({ ...l, gear: { battery: many[0] } }, 'corsair', {}, [], many.slice(1));
  assert.ok(st.gunDamageMul / base.gunDamageMul <= 1.25 + 1e-9, `${st.gunDamageMul / base.gunDamageMul}`);
});

test('putting gear on: the ship’s level and slots, the captain’s band; an item takes the yard fitting’s place; off again', () => {
  const { game } = makeGame();
  const c = join(game, 'Gear Gwen');
  const s = game.sessionByName('Gear Gwen')!;
  const p = s.profile!;
  const ship = s.ship!;
  // The yard's sail plan at level 3, then Silk Topsails in the slot: the fitting's speed gives way to the silk's.
  p.loadout.modules.sail_plan = 3;
  ship.recompute(game.now);
  const withPlan = ship.stats.maxSpeed;
  p.stash.push({ ...item('silk_sails', 1), uid: 900 }, { ...item('crown_ensign', 1), uid: 901 }, { ...item('oak_plating', 3), uid: 902 }, { ...item('tricorne', 3), uid: 903 });
  c.push({ t: 'gear', action: 'equip', uid: 900 });
  assert.equal(p.loadout.gear!.sails?.uid, 900);
  assert.ok(ship.stats.maxSpeed < withPlan, 'silk (+6%) is less than the plan’s +12%');
  c.push({ t: 'gear', action: 'equip', uid: 901 });
  assert.equal(bad(c).at(-1), 'The Banner slot opens at ship level 4');
  c.push({ t: 'gear', action: 'equip', uid: 902 });
  assert.equal(bad(c).at(-1), 'Made for a ship of level 3: yours is level 1');
  c.push({ t: 'gear', action: 'equip', uid: 903 });
  assert.equal(bad(c).at(-1), 'Made for a captain of level 13 and up');
  p.level = 13;
  c.push({ t: 'gear', action: 'equip', uid: 903 });
  assert.equal(p.captainGear.hat?.uid, 903);
  assert.ok(ship.worn.some((x) => x.uid === 903), 'the ship counts the captain’s own');
  // Off again.
  c.push({ t: 'gear', action: 'unequip', slot: 'sails' });
  assert.equal(p.loadout.gear!.sails, undefined);
  assert.ok(Math.abs(ship.stats.maxSpeed - withPlan) < 1e-9, 'the plan is back');
  // A full locker takes nothing off.
  while (p.stash.length < STASH_SIZE) p.stash.push({ ...item('tricorne', 1), uid: 1000 + p.stash.length });
  c.push({ t: 'gear', action: 'unequip', slot: 'hat' });
  assert.equal(bad(c).at(-1), 'Your locker is full');
  // Not under another ship's fire: held, not refused, and done when the shot stops (owner, 2026-10-07); her own fight
  // is no fire.
  p.stash.pop();
  ship.lastCombat = game.now;
  ship.docked = null;
  ship.lastHitAt = game.now;
  const n0 = bad(c).length;
  c.push({ t: 'gear', action: 'unequip', slot: 'hat' });
  assert.equal(bad(c).length, n0, 'no refusal');
  assert.equal(p.captainGear.hat?.uid, 903, 'still on, while the shot flies');
  steps(game, 20 * 8);
  assert.equal(p.captainGear.hat, undefined, 'off once it stopped');
});

test('what the sea leaves: sunk ships drop gear now and then, an elite always; picked up into the locker', () => {
  const { game } = makeGame();
  let drops = 0;
  for (let i = 0; i < 60; i++) {
    const npc = game.spawnNpcShip('pirate', 'brig', 'confederacy', 30_000, 30_000, 0);
    if (rollDrop(game, npc)) drops++;
    game.removeShip(npc.id);
  }
  assert.ok(drops > 8 && drops < 40, `${drops}/60 pirates left gear`);
  // Sunk by the guns: ship gear (every slot but the tackle); taken by boarding: the captain's own (docs/21 §5).
  for (let i = 0; i < 40; i++) {
    const npc = game.spawnNpcShip(i % 2 ? 'merchant' : 'pirate', 'brig', 'confederacy', 30_000, 30_000, 0);
    npc.elite = true;
    const sunk = rollDrop(game, npc, 'sunk')!, taken = rollDrop(game, npc, 'boarded')!;
    assert.ok(isShipSlot(ITEM_BASES[sunk.base].slot) && ITEM_BASES[sunk.base].slot !== 'tackle', `sunk: ${sunk.base}`);
    assert.ok((CAPTAIN_SLOTS as string[]).includes(ITEM_BASES[taken.base].slot), `boarded: ${taken.base}`);
    game.removeShip(npc.id);
  }
  assert.ok(!SUNK_SLOTS.includes('tackle') && SUNK_SLOTS.every(isShipSlot) && BOARDED_SLOTS.every((x) => !isShipSlot(x)));
  const el = game.spawnNpcShip('pirate', 'brig', 'confederacy', 30_000, 30_000, 0);
  el.elite = true;
  const it = rollDrop(game, el)!;
  assert.ok(it && it.rarity >= 1 && it.ilvl === el.shipLevel);
  // Sunk under a captain: the crate floats with it, and it goes into the locker.
  const c = join(game, 'Loot Lars');
  const s = game.sessionByName('Loot Lars')!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  onHull(game, ship, 'brig');
  el.state.x = ship.state.x + 30;
  el.state.y = ship.state.y;
  el.attackers.set(ship.id, game.now);
  el.hull = 0;
  const before = new Set(game.loot.keys());
  game.beginSinking(el);
  const crate = [...game.loot.values()].find((l) => !before.has(l.id));
  assert.ok(crate?.items?.length, 'the crate carries the elite’s gear');
  (game as unknown as { pickupLoot(sh: unknown, l: unknown): void }).pickupLoot(ship, crate);
  assert.equal(s.profile!.stash.length, 1);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('Found: ')));
});

test('the chandler: the same wares all day; bought into the locker, sold for a quarter, broken down, worn and mended', () => {
  const { game } = makeGame();
  const c = join(game, 'Trader Tess');
  const s = game.sessionByName('Trader Tess')!;
  const p = s.profile!;
  const port = game.portById(s.ship!.docked!)!;
  const a = chandlerWares(game, port), b = chandlerWares(game, port);
  assert.ok(a.length > 0);
  assert.deepEqual(a, b);
  p.gold = 100_000;
  c.push({ t: 'gear', action: 'buy', index: 0 });
  assert.equal(p.stash.length, 1);
  assert.equal(p.stash[0].base, a[0].base);
  assert.ok(p.stash[0].uid > 0);
  const g0 = p.gold;
  c.push({ t: 'gear', action: 'sell', uid: p.stash[0].uid });
  assert.equal(p.stash.length, 0);
  assert.ok(p.gold > g0);
  p.stash.push({ ...item('oak_plating', 4, { rarity: 3 }), uid: 50 });
  c.push({ t: 'gear', action: 'salvage', uid: 50 });
  assert.ok((s.ship!.cargo.planks ?? 0) >= 10 && (s.ship!.cargo.leviathan_bone ?? 0) >= 1);
  // Wear from a sinking, mended at the yard.
  p.captainGear.hat = { ...item('tricorne', 1), uid: 60 };
  p.captainGear.hat.dur = 90;
  c.push({ t: 'gear', action: 'mend' });
  assert.equal(p.captainGear.hat.dur, 100);
  c.push({ t: 'gear', action: 'mend' });
  assert.equal(bad(c).at(-1), 'Your gear is sound');
});

test('gear lines and item names read in Russian', () => {
  setLang('ru');
  const lines = [
    'The Banner slot opens at ship level 4', 'Made for a ship of level 3: yours is level 1', 'Made for a captain of level 13 and up', 'Your locker is full',
    'Found: Black Oak Planking (Rare, level 5).', 'Sold Tricorne for 30 silver.', 'Your locker is full: Canvas Sails is left in the water.', 'Bought Brass Compass.',
    'Found: Edric Vane’s Tricorne (Legendary, level 8).', 'Broken down: Hunter’s Tricorne.',
  ].map((l) => serverText(l));
  setLang('en');
  assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l)), []);
  assert.ok(gearPatterns().length > 10 && itemNamePatterns().length > 60);
});

test('a forge (a yard of the second rank): tempering up to +5, never breaking; reforging one extra line', () => {
  const { game } = makeGame();
  const c = join(game, 'Smith Sam');
  const s = game.sessionByName('Smith Sam')!;
  const p = s.profile!;
  const home = game.portById(s.ship!.docked!)!;
  p.stash.push({ ...item('oak_plating', 2, { rarity: 2, affixes: [{ a: 'speed', v: 0.02 }, { a: 'crew', v: 0.04 }] }), uid: 70 });
  if (home.shipyardTier < 2) {
    c.push({ t: 'gear', action: 'temper', uid: 70 });
    assert.equal(bad(c).at(-1), 'No forge here: tempering and reforging want a yard of the second rank or better');
  }
  const forge = game.world.ports.find((x) => x.shipyardTier >= 2)!;
  s.ship!.docked = forge.id;
  p.docked = forge.id;
  p.gold = 1_000_000;
  c.push({ t: 'gear', action: 'temper', uid: 70 });
  assert.match(bad(c).at(-1)!, /^Needs \d+ iron and \d+ planks \(in the hold\)$/);
  s.ship!.cargo.iron = 500;
  s.ship!.cargo.planks = 500;
  const before = itemEffect(p.stash[0]).mods.hullMax!;
  for (let i = 0; i < 7; i++) c.push({ t: 'gear', action: 'temper', uid: 70 });
  assert.equal(p.stash[0].temper, 5);
  assert.equal(bad(c).at(-1), 'Tempered to the full');
  assert.ok(Math.abs(itemEffect(p.stash[0]).mods.hullMax! / before - 1.15) < 1e-9, 'five steps of +3%');
  const was = p.stash[0].affixes[1].a;
  c.push({ t: 'gear', action: 'reforge', uid: 70, line: 1 });
  assert.notEqual(p.stash[0].affixes[1].a, was);
  assert.equal(p.stash[0].affixes[0].a, 'speed', 'the other line stays');
  assert.ok(!['hull', 'armor', 'speed'].includes(p.stash[0].affixes[1].a), 'never the main line nor one it has');
  c.push({ t: 'gear', action: 'reforge', uid: 70, line: 5 });
  assert.equal(bad(c).at(-1), 'No such line to reforge');
});

test('the inspect card shows what a captain wears', () => {
  const { game } = makeGame();
  const a = join(game, 'Looker Lu');
  join(game, 'Worn Wes');
  const W = game.sessionByName('Worn Wes')!;
  W.profile!.captainGear.hat = { ...item('tricorne', 1, { rarity: 3 }), uid: 5 };
  a.push({ t: 'inspect', name: 'Worn Wes' });
  const v = a.last('inspect')!.view!;
  // Her hat among the rest (every captain has the starter drift net aboard too).
  assert.ok(v.gear?.some((g) => g.base === 'tricorne'), JSON.stringify(v.gear?.map((g) => g.base)));
});
