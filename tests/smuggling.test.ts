import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TALENTS } from '../shared/src/data/talents.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { priceMods } from '../server/src/game/ports.ts';
import { bribeCost, searchChance, signature, visibleRange } from '../server/src/game/smugglefx.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import { join, makeGame, steps } from './helpers.ts';
import { isNight } from '../shared/src/constants.ts';

function captain(game: Game, name: string, talents: TalentRanks, cap: 'corsair' | 'smuggler' = 'corsair') {
  const c = join(game, name, cap);
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  s.profile!.gold = 1e6;
  return { c, s, ship: s.ship!, p: s.profile! };
}

function atSea(game: Game, s: PlayerSession, x = 56000, y = 70000): void {
  const ship = s.ship!;
  if (ship.docked) s.profile!.trade.lastDeparture = ship.docked;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.region = game.regionAt(x, y);
  game.grid.upsert(ship.id, x, y);
}

test('smuggling tree data: 24 talents, 36 ranks', () => {
  const list = TALENTS.filter((t) => t.tree === 'smuggling');
  assert.equal(list.length, 24);
  assert.equal(list.filter((t) => !t.keystone).reduce((a, t) => a + t.maxRank, 0), 36);
});

test('signature: Low Profile and Silent Running make you harder to see; Dark Lanterns hide you at night', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Shadow', { smg_low_profile: 3, smg_silent_running: 2, smg_dark_lanterns: 1 });
  const { s: s2, ship: watcher } = captain(game, 'Watcher', {});
  atSea(game, s);
  atSea(game, s2, 57000, 70000);
  assert.ok(signature(ship) < 0.9);
  ship.state.speed = 0;
  assert.ok(signature(ship) <= 0.72 + 1e-9, 'silent running at half speed');
  assert.ok(visibleRange(game, ship, watcher) < 2200);
  assert.equal(visibleRange(game, watcher, ship), Infinity, 'ordinary ships stay visible');
  // Night: 250 m.
  let t = 0;
  while (!isNight(t)) t += 60;
  game.now = t;
  assert.equal(visibleRange(game, ship, watcher), 250);
});

test('customs: open hold 60%, Forged Papers cut it; hidden compartments; bribes skip the search', () => {
  const { game } = makeGame();
  const { ship } = captain(game, 'Papers', { smg_forged_papers: 2, smg_hidden_compartments: 3, trd_false_bottom: 1 });
  assert.ok(Math.abs(searchChance(ship, false) - 0.4) < 1e-9);
  assert.ok(searchChance(ship, true) < 0.03 + 1e-9);
  const { c, s, ship: runner, p } = captain(game, 'Runner', { smg_greased_palms: 2 });
  atSea(game, s);
  const port = game.world.ports.find((x) => x.faction === 'crown' && x.size >= 2)!;
  runner.state.x = port.x;
  runner.state.y = port.y;
  runner.state.speed = 0;
  runner.lastCombat = -999;
  runner.cargo = { dreamleaf: 20 };
  const cost = bribeCost(runner);
  const g0 = p.gold;
  c.push({ t: 'dock', bribe: true });
  assert.ok(runner.docked, 'docked');
  assert.equal(runner.cargo.dreamleaf, 20, 'no search');
  assert.equal(p.gold, g0 - cost);
});

test('Quick Dump: casks only you can see; Decoy Barrels are empty', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Dumper', { smg_quick_dump: 2, smg_decoy_barrels: 1 });
  atSea(game, s);
  ship.cargo = { dreamleaf: 10 };
  c.push({ t: 'jettison', good: 'dreamleaf', qty: 10 });
  assert.equal(ship.cargo.dreamleaf ?? 0, 0);
  const casks = [...game.loot.values()].filter((l) => l.ownerOnly === s.accountId);
  assert.equal(casks.length, 1);
  c.push({ t: 'talent_active', id: 'smg_decoy_barrels' });
  assert.equal([...game.loot.values()].filter((l) => l.decoy).length, 3);
  // Without the talent it takes five seconds and the cargo is simply gone.
  const { c: c2, s: s2, ship: plain } = captain(game, 'Plain', {});
  atSea(game, s2, 58000, 70000);
  plain.cargo = { rum: 5 };
  c2.push({ t: 'jettison', good: 'rum', qty: 5 });
  assert.equal(plain.cargo.rum, 5, 'still heaving');
  steps(game, 20 * 6);
  assert.equal(plain.cargo.rum ?? 0, 0);
});

test('fences: Fence Contacts, Dangerous Goods and Black Ledger prices; night market and coves', () => {
  const { game } = makeGame();
  const { ship, p } = captain(game, 'Fence', { smg_fence_contacts: 2, smg_dangerous_goods: 2 });
  const fog = game.portById('fogmouth')!;
  const m = priceMods(ship, fog, p, game.now, game);
  assert.ok(Math.abs((m.goodSell!.dreamleaf ?? 1) - 1.1) < 1e-9, 'fence +10%');
  assert.ok((m.goodSell!.cursed_relics ?? 1) > 1.25, 'relics +16% and fence');
  // Coves exist in the Whispering Archipelago.
  assert.equal(game.coves.length, 6);
  const { c, s: s2, ship: smuggler } = captain(game, 'Coves', { smg_cove_knowledge: 1 });
  const cove = game.coves[0];
  atSea(game, s2, cove.x, cove.y);
  smuggler.cargo = { dreamleaf: 5 };
  const g0 = s2.profile!.gold;
  c.push({ t: 'land' });
  assert.equal(smuggler.cargo.dreamleaf ?? 0, 0);
  assert.ok(s2.profile!.gold > g0, 'sold in the cove');
  steps(game, 25);
  assert.ok(s2.profile!.smuggle.coves.includes(cove.id), 'cove found');
});

test("False Colors fools patrols; Slip Away hides; Nobody's Ship needs a witness", () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Ghost', { smg_false_colors: 1, smg_fog_sense: 1, smg_slip_away: 1, smg_nobodys_ship: 1 });
  atSea(game, s);
  c.push({ t: 'talent_active', id: 'smg_false_colors' });
  assert.ok(ship.hasFlag('false_colors'));
  assert.equal(ship.info().name, 'Unknown Merchant');
  // A crime in contested waters whose only witness is sunk never reaches the law.
  const inf0 = p.infamy;
  const victim = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x + 200, ship.state.y, 0);
  game.grid.upsert(victim.id, victim.state.x, victim.state.y);
  game.addInfamy(ship, 30, 'test crime');
  assert.equal(p.infamy, inf0, 'deferred');
  victim.hull = 0;
  game.beginSinking(victim);
  game.now += 700;
  steps(game, 25);
  assert.equal(p.infamy, inf0, 'no witness, no crime');
  // With a witness who survives, the Wanted arrives.
  const w = game.spawnNpcShip('fisher', 'cutter', 'free', ship.state.x + 300, ship.state.y, 0);
  game.grid.upsert(w.id, w.state.x, w.state.y);
  game.addInfamy(ship, 30, 'seen');
  game.now += 700;
  steps(game, 25);
  assert.ok(p.infamy > inf0 + 25, 'witness talked');
  // Nobody's Ship: Crown ports refuse.
  const crown = game.world.ports.find((x): x is Port => x.faction === 'crown')!;
  ship.state.x = crown.x;
  ship.state.y = crown.y;
  ship.state.speed = 0;
  c.push({ t: 'dock' });
  assert.ok(!ship.docked);
});
