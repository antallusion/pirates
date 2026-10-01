import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import { avoidPort } from '../server/src/game/events.ts';
import type { WorldEvent } from '../server/src/game/events.ts';
import { Database } from '../server/src/persistence/db.ts';
import { dist } from '../shared/src/math.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';

const SEC = 20;
const DAY = 24 * 3600_000;

function clock(game: Game): { now: () => number; add: (ms: number) => void } {
  let wall = 1_700_000_000_000;
  game.wallNow = () => wall;
  return { now: () => wall, add: (ms) => (wall += ms) };
}

/** Put every calendar far away, so only what a test asks for happens. */
function quiet(game: Game): void {
  const st = game.worldEvents.data(game);
  for (const k of Object.keys(st.next)) st.next[k] = game.wallNow() + 1e12;
}

function dockAt(game: Game, s: PlayerSession, port: Port): void {
  const ship = s.ship!;
  ship.state.x = port.x;
  ship.state.y = port.y;
  (game as unknown as { dockShip(x: PlayerSession, p: Port): void }).dockShip(s, port);
}

function ev(game: Game, kind: WorldEvent['kind']): WorldEvent | undefined {
  return game.worldEvents.active(game).find((e) => e.kind === kind);
}

test('the Armada: heavy Crown losses send it to blockade Cinderhold; powder dear in Gravesend; merchants stay away; sinking it ends it', () => {
  const { game } = makeGame();
  clock(game);
  quiet(game);
  for (let i = 0; i < 25; i++) game.worldEvents.noteCrownLoss(game);
  steps(game, SEC * 11);
  const e = ev(game, 'armada')!;
  assert.ok(e, 'the Armada sails');
  assert.equal(e.port, 'cinderhold');
  const fleet = game.worldEvents.fleets.get(e.id)!;
  assert.equal(fleet.length, 4);
  const cinder = game.portById('cinderhold')!;
  for (const id of fleet) {
    const s = game.ships.get(id)!;
    assert.equal(s.faction, 'crown');
    assert.ok(dist(s.state.x, s.state.y, cinder.x, cinder.y) < 4000, 'on station');
  }
  assert.equal(game.markets.get('gravesend')!.goods.gunpowder!.shock, 1.5);
  const cm = game.markets.get('cinderhold')!;
  const imported = Object.keys(cm.goods).find((g) => !(cinder.profile.produces as Record<string, number>)[g])!;
  assert.ok(cm.goods[imported as 'rum']!.shock >= 2.8, 'imports run dear');
  assert.equal(avoidPort(game, 'cinderhold'), true);
  // Break it.
  for (const id of fleet) {
    const s = game.ships.get(id)!;
    s.hull = 0;
    game.beginSinking(s);
  }
  steps(game, SEC * 2);
  assert.equal(ev(game, 'armada'), undefined, 'broken');
  assert.equal(avoidPort(game, 'cinderhold'), false);
  assert.ok(game.rumors.some((r) => r.text.includes('Armada') && r.text.includes('broken')));
});

test('a pirate blockade: a squadron closes a lawful port; a captain who runs it with a hold full is paid in glory, once', () => {
  const { game } = makeGame();
  const c = clock(game);
  quiet(game);
  const st = game.worldEvents.data(game);
  st.next.pirate_blockade = c.now();
  steps(game, SEC * 11);
  const e = ev(game, 'blockade')!;
  assert.ok(e && e.by === 'Confederacy');
  const port = game.portById(e.port!)!;
  assert.equal(game.worldEvents.fleets.get(e.id)!.length, 5);
  const conn = join(game, 'Rena Runner');
  const s = game.sessionByName('Rena Runner')!;
  s.ship!.cargo = { rum: 20 };
  const xp = s.profile!.xp + s.profile!.level * 1e6;
  const rep = s.profile!.reputation[port.faction] ?? 0;
  dockAt(game, s, port);
  assert.ok(s.profile!.xp + s.profile!.level * 1e6 > xp);
  assert.ok((s.profile!.reputation[port.faction] ?? 0) > rep);
  assert.ok(conn.all('toast').some((t) => /ran the blockade/.test(t.msg)));
  dockAt(game, s, port);
  assert.equal(conn.all('toast').filter((t) => /ran the blockade/.test(t.msg)).length, 1, 'once per blockade');
  // It lifts on its own after its time.
  c.add(3 * DAY);
  steps(game, SEC * 2);
  assert.equal(ev(game, 'blockade'), undefined);
  for (const id of game.worldEvents.fleets.values()) assert.equal(id.length, 0);
});

test('a guild blockade: five of a guild on the roads for half an hour close the port; it opens when they sail away', () => {
  const { game } = makeGame();
  clock(game);
  quiet(game);
  const port = game.world.ports.find((p) => p.faction === 'league' && p.size >= 2)!;
  const ships = [];
  for (let i = 0; i < 5; i++) {
    join(game, `Guild Hand ${'ABCDE'[i]}`);
    const s = game.sessionByName(`Guild Hand ${'ABCDE'[i]}`)!;
    const sh = s.ship!;
    sh.docked = null;
    sh.state.x = port.x + 600 + i * 50;
    sh.state.y = port.y;
    sh.state.speed = 0;
    sh.input = { rudder: 0, sailTarget: 0 };
    sh.guildTag = 'BLK';
    game.grid.upsert(sh.id, sh.state.x, sh.state.y);
    ships.push(sh);
  }
  steps(game, SEC * 11);
  const h = game.worldEvents.holds.get(port.id);
  assert.equal(h?.tag, 'BLK', 'holding');
  h!.since -= 30 * 60;
  steps(game, SEC * 11);
  const e = ev(game, 'blockade')!;
  assert.ok(e, 'closed');
  assert.equal(e.by, '[BLK]');
  assert.equal(avoidPort(game, port.id), true);
  // They sail away: ten minutes' grace, then the port opens.
  for (const sh of ships) {
    sh.state.x = port.x + 20000;
    game.grid.upsert(sh.id, sh.state.x, sh.state.y);
  }
  steps(game, SEC * 5);
  assert.ok(ev(game, 'blockade'), 'grace');
  game.now += 601;
  steps(game, SEC * 2);
  assert.equal(ev(game, 'blockade'), undefined, 'lifted');
});

test('the Storm of the Century: the region storms, traffic founders, and after it wreckage floats and timber is dear', () => {
  const { game } = makeGame();
  const c = clock(game);
  quiet(game);
  game.bootPopulation();
  const st = game.worldEvents.data(game);
  st.next['storm:gravewater'] = c.now();
  steps(game, SEC * 11);
  const e = ev(game, 'storm_century')!;
  assert.ok(e && e.stage === 'storm');
  assert.ok(['storm', 'black_storm'].includes(game.weather.gravewater.kind));
  // Merchants at sea in the region: some go down over the hours.
  let k = 0;
  for (const s of game.ships.values()) if (s.npcRole === 'merchant' && k < 30) {
    // Thirty merchants caught in open water in the middle of it.
    s.docked = null;
    s.state.x = 56000 + (k % 6) * 300;
    s.state.y = 72000 + Math.floor(k / 6) * 300;
    s.region = 'gravewater';
    game.grid.upsert(s.id, s.state.x, s.state.y);
    k++;
  }
  let sunk = 0;
  const sink = game.beginSinking.bind(game);
  game.beginSinking = (ship) => {
    if (ship.npcRole === 'merchant') sunk++;
    sink(ship);
  };
  for (let i = 0; i < 20; i++) steps(game, SEC * 60);
  assert.ok(sunk > 0, 'traffic founders');
  const loot = game.loot.size;
  c.add(7 * 3600_000);
  steps(game, SEC * 2);
  const after = ev(game, 'storm_century')!;
  assert.equal(after.stage, 'aftermath');
  assert.ok(game.loot.size > loot, 'wreckage to salvage');
  const port = game.world.ports.find((p) => p.region === 'gravewater' && game.markets.get(p.id)!.goods.timber)!;
  assert.equal(game.markets.get(port.id)!.goods.timber!.shock, 1.5);
});

test('a new island: the sea boils for six hours, then land; the first captain ashore names her; she survives a restart', () => {
  const db = new Database(':memory:');
  const game = new Game({ db, auth: new AuthService(db), log: () => {} });
  const c = clock(game);
  quiet(game);
  const st = game.worldEvents.data(game);
  st.next.new_island = c.now();
  steps(game, SEC * 11);
  const e = ev(game, 'new_island')!;
  assert.ok(e && e.stage === 'eruption');
  assert.equal(isLand(game.world, e.x, e.y), null, 'not yet');
  const count = game.world.islands.length;
  c.add(6 * 3600_000 + 1000);
  steps(game, SEC * 2);
  assert.equal(e.stage, 'risen');
  // docs/18 III: she takes the first of the places kept for raised islands (the id she would have had before step 6).
  assert.equal(game.world.islands.length, count);
  assert.ok(e.islandId! < game.world.isleFrom && !game.world.islands[e.islandId!].slot, 'in the room kept for her');
  const is = game.world.islands[e.islandId!];
  assert.ok(isLand(game.world, is.x, is.y), 'land');
  assert.ok(game.sites.some((x) => x.islandId === is.id), 'something to mine');
  // First ashore.
  join(game, 'Nell Firstfoot');
  const s = game.sessionByName('Nell Firstfoot')!;
  s.ship!.docked = null;
  s.ship!.state.x = is.x + is.radius + 200;
  s.ship!.state.y = is.y;
  steps(game, SEC * 2);
  assert.equal(is.name, "Nell's Landfall");
  assert.ok(s.discovered.has(is.id));
  // A new world on the same records has her.
  const again = new Game({ db, auth: new AuthService(db), log: () => {} });
  const back = again.world.islands[is.id];
  assert.equal(back?.name, "Nell's Landfall");
  assert.ok(isLand(again.world, is.x, is.y));
  assert.ok(again.sites.some((x) => x.islandId === is.id));
});

test('an epidemic: a port short of medicine falls sick; quarantine shuts the tavern; fever sails out; medicine breaks it', () => {
  const { game } = makeGame();
  clock(game);
  quiet(game);
  const port = game.world.ports.find((p) => p.size >= 2 && game.markets.get(p.id)!.goods.medicine)!;
  const gm = game.markets.get(port.id)!.goods.medicine!;
  gm.stock = gm.target * 0.1;
  game.worldEvents.data(game).next.epidemic = game.wallNow();
  // Only this port is short.
  for (const [id, m] of game.markets) if (id !== port.id && m.goods.medicine) m.goods.medicine.stock = m.goods.medicine.target;
  steps(game, SEC * 11);
  const e = ev(game, 'epidemic')!;
  assert.ok(e);
  assert.equal(e.port, port.id);
  e.quarantine = true;
  steps(game, SEC);
  assert.equal(gm.shock, 2);
  const conn = join(game, 'Doc Bramble');
  const s = game.sessionByName('Doc Bramble')!;
  dockAt(game, s, port);
  conn.push({ t: 'hire_crew', qty: 5 });
  assert.match(conn.last('toast')!.msg, /quarantine/);
  // Out to sea without medicine: fever may come aboard (the dice are thrown until it does).
  for (let i = 0; i < 20 && !s.ship!.hasEffect('fever'); i++) {
    dockAt(game, s, port);
    conn.push({ t: 'undock' });
  }
  assert.ok(s.ship!.hasEffect('fever'));
  const crew = s.ship!.crew;
  steps(game, SEC * 61);
  assert.ok(s.ship!.crew < crew, 'the fever takes men');
  // Medicine delivered: reputation, and the fever breaks when the stock is back.
  dockAt(game, s, port);
  s.ship!.cargo = { medicine: 40 };
  s.ship!.effects = [];
  s.ship!.recompute(game.now);
  const rep = s.profile!.reputation[port.faction] ?? 0;
  conn.push({ t: 'trade', good: 'medicine', qty: -40 });
  assert.ok((s.profile!.reputation[port.faction] ?? 0) > rep);
  gm.stock = gm.target;
  steps(game, SEC * 2);
  assert.equal(ev(game, 'epidemic'), undefined, 'the fever breaks');
});

test('no more than two major events on one region', () => {
  const { game } = makeGame();
  const c = clock(game);
  quiet(game);
  const st = game.worldEvents.data(game);
  st.next['storm:ashen_isles'] = c.now();
  for (let i = 0; i < 25; i++) game.worldEvents.noteCrownLoss(game);
  steps(game, SEC * 11);
  assert.equal(game.worldEvents.active(game).filter((e) => e.region === 'ashen_isles').length, 2);
  st.next.new_island = c.now();
  // Force an eruption spot in the Ashen Isles by stubbing the dice to pick it.
  const dice = game.worldEvents.rng;
  const pick = dice.pick;
  dice.pick = (<T>(a: readonly T[]) => (a.includes('ashen_isles' as unknown as T) ? ('ashen_isles' as unknown as T) : pick.call(dice, a))) as typeof dice.pick;
  steps(game, SEC * 11);
  dice.pick = pick;
  assert.equal(game.worldEvents.active(game).filter((e) => e.region === 'ashen_isles').length, 2, 'the third waits');
});
