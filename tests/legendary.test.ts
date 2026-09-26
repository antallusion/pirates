import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGENDARY } from '../shared/src/data/legendary.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';
import { ensureLegendary, legendaryCalendar, legendaryViews, onFirstKill } from '../server/src/game/legendary.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import { join, makeGame, steps } from './helpers.ts';

function dockAt(game: Game, s: PlayerSession, port: Port): void {
  const ship = s.ship!;
  ship.state.x = port.x;
  ship.state.y = port.y;
  (game as unknown as { dockShip(x: PlayerSession, p: Port): void }).dockShip(s, port);
}

test('the gifts and prices are side-grades: no more than about 5% over the base hull', () => {
  for (const def of Object.values(LEGENDARY)) {
    const base = computeShipStats({ classId: def.base, name: 'x', guns: { port: 'long_9', starboard: 'long_9' }, modules: {} }, 'corsair', {}, []);
    const leg = computeShipStats({ classId: def.base, name: 'x', guns: { port: 'long_9', starboard: 'long_9' }, modules: {}, legendary: def.id }, 'corsair', {}, []);
    assert.ok(leg.hullMax <= base.hullMax * 1.05 + 1, def.id);
    assert.ok(leg.maxSpeed <= base.maxSpeed * 1.05 + 1e-9, def.id);
    for (const f of def.flags) assert.ok(leg.flags.has(f), `${def.id} ${f}`);
  }
});

test('a legendary commission: the first kill lays the keel; the whole sea delivers; the biggest giver sails her; she cannot be sold', () => {
  const { game } = makeGame();
  const def = LEGENDARY.first_rib;
  assert.equal(legendaryViews(game, join(game, 'Onlooker') && game.sessionByName('Onlooker')!).find((v) => v.id === 'first_rib')!.status, 'locked');
  onFirstKill(game, 'leviathan');
  const port = game.portById(def.port)!;
  const a = join(game, 'Anker Bone'), b = join(game, 'Bryn Bone');
  const A = game.sessionByName('Anker Bone')!, B = game.sessionByName('Bryn Bone')!;
  dockAt(game, A, port);
  dockAt(game, B, port);
  // Not at another yard.
  a.push({ t: 'legendary', action: 'deliver', id: 'first_rib' });
  assert.match(a.last('toast')!.msg, /nothing she still needs/);
  A.ship!.cargo = { leviathan_bone: 30, iron: 20 };
  a.push({ t: 'legendary', action: 'deliver', id: 'first_rib' });
  assert.equal(A.ship!.cargo.leviathan_bone, undefined);
  // Bryn brings the rest — and more of it.
  B.ship!.cargo = { leviathan_bone: 90, timber: 200, iron: 40 };
  b.push({ t: 'legendary', action: 'deliver', id: 'first_rib' });
  const v = legendaryViews(game, B).find((x) => x.id === 'first_rib')!;
  assert.equal(v.status, 'owned');
  assert.equal(v.owner, 'Bryn Bone');
  const berth = B.profile!.berths.find((x) => x.loadout.legendary === 'first_rib');
  assert.ok(berth, 'she waits in a berth');
  assert.equal(berth!.loadout.classId, 'frigate');
  // Not for sale.
  b.push({ t: 'berth', action: 'sell', index: B.profile!.berths.indexOf(berth!) });
  assert.ok(B.profile!.berths.includes(berth!));
});

test('Sunken Glory: she goes down, her wreck is marked, the fighters take relics, her captain raises her; thirty days away and she returns to the Reserve', () => {
  const { game } = makeGame();
  let wall = 1_800_000_000_000;
  game.wallNow = () => wall;
  onFirstKill(game, 'storm_widow');
  const port = game.portById(LEGENDARY.widows_lament.port)!;
  const o = join(game, 'Owen Lament');
  const O = game.sessionByName('Owen Lament')!;
  dockAt(game, O, port);
  O.ship!.cargo = { sailcloth: 150, sulfur_iron: 40, timber: 120 };
  o.push({ t: 'legendary', action: 'deliver', id: 'widows_lament' });
  const i = O.profile!.berths.findIndex((x) => x.loadout.legendary === 'widows_lament');
  o.push({ t: 'berth', action: 'swap', index: i });
  assert.equal(O.ship!.loadout.legendary, 'widows_lament');
  // A rival sinks her at sea.
  const r = join(game, 'Rook Rival');
  const R = game.sessionByName('Rook Rival')!;
  o.push({ t: 'undock' });
  R.ship!.docked = null;
  R.profile!.docked = null;
  const ship = O.ship!;
  const wx = ship.state.x, wy = ship.state.y;
  ship.attackers.set(R.ship!.id, game.now);
  ship.hull = 0;
  game.beginSinking(ship);
  steps(game, 20 * 8);
  const v = legendaryViews(game, O).find((x) => x.id === 'widows_lament')!;
  assert.equal(v.status, 'sunk');
  assert.ok(v.wreck && Math.hypot(v.wreck.x - wx, v.wreck.y - wy) < 5);
  assert.notEqual(O.ship!.loadout.legendary, 'widows_lament', 'her captain sails on in a sloop');
  assert.ok(R.profile!.trophies.some((t) => /Relic of the Widow/.test(t)));
  assert.ok(r.all('toast').some((t) => /SUNKEN GLORY/.test(t.msg)));
  // The rival cannot raise her; her captain can.
  R.ship!.state.x = wx;
  R.ship!.state.y = wy;
  R.ship!.state.speed = 0;
  r.push({ t: 'land' });
  assert.match(r.last('toast')!.msg, /Only Owen Lament/);
  O.ship!.docked = null;
  O.profile!.docked = null;
  O.ship!.state.x = wx + 50;
  O.ship!.state.y = wy;
  O.ship!.state.speed = 0;
  o.push({ t: 'land' });
  assert.equal(legendaryViews(game, O).find((x) => x.id === 'widows_lament')!.status, 'owned');
  assert.ok(O.profile!.berths.some((b) => b.loadout.legendary === 'widows_lament' && b.port === 'wrecktide'));
  // Thirty days without her captain: back to the Reserve.
  (game as unknown as { retireSession(s: PlayerSession): void }).retireSession(O);
  wall += 31 * 24 * 3600_000;
  legendaryCalendar(game);
  const back = legendaryViews(game, R).find((x) => x.id === 'widows_lament')!;
  assert.equal(back.status, 'commission');
  // When the captain comes back, the berth is gone.
  ensureLegendary(game, O);
  assert.ok(!O.profile!.berths.some((b) => b.loadout.legendary === 'widows_lament'));
});
