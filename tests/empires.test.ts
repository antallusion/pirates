import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import { convoyArrived, governorOf, levyFor, saleMul, startRiot, stepEmpires, upkeepMul, weekOf } from '../server/src/game/empires.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const WEEK = 7 * 24 * 3600_000;

function world() {
  const { game } = makeGame();
  let clock = Date.UTC(2026, 3, 6, 12); // a Monday noon
  game.wallNow = () => clock;
  return { game, advance: (ms: number) => (clock += ms) };
}

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 500_000;
  s.profile!.level = 30;
  return { c, s };
}

function found(game: Game, c: FakeConn, s: PlayerSession, name: string, tag: string) {
  c.push({ t: 'guild', action: 'found', name, tag });
  return game.guilds.of(game, s.accountId)!;
}

function dockAt(game: Game, s: PlayerSession, port: Port): void {
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  (game as unknown as { dockShip(x: PlayerSession, p: Port): void }).dockShip(s, port);
}

/** A lawless region with route nodes and a free port that is not canonical. */
function colony(game: Game): { region: RegionId; port: Port } {
  const st = game.guilds.store(game);
  for (const p of game.world.ports) {
    if (p.key || p.faction !== 'free' || REGIONS[p.region].safety !== 'lawless') continue;
    if (Object.values(st.nodes).some((n) => game.world.islands[n.island].region === p.region)) return { region: p.region, port: p };
  }
  throw new Error('no colony');
}

test('governors: 60% of a lawless region\'s nodes at the turn of the week; a 1% levy in its free ports; double upkeep; four weeks at most', () => {
  const { game, advance } = world();
  const { c, s } = captain(game, 'Gov Ernor');
  const g = found(game, c, s, 'Governors', 'GOV');
  const { region, port } = colony(game);
  const st = game.guilds.store(game);
  const nodes = Object.values(st.nodes).filter((n) => game.world.islands[n.island].region === region);
  for (const n of nodes) n.holder = g.id;
  steps(game, 21);
  advance(WEEK);
  steps(game, 20 * 61);
  const gov = governorOf(game, region)!;
  assert.equal(gov?.tag, 'GOV');
  assert.equal(upkeepMul(game, g.id), 2);
  assert.equal(levyFor(game, port, 10_000), 100);
  // The levy is paid by traders into the treasury.
  const treasury = () => game.guilds.of(game, s.accountId)!.treasury;
  const t0 = treasury();
  const trader = captain(game, 'Tess Trader');
  dockAt(game, trader.s, port);
  // A fair cargo of the dearest thing the port takes, well short of flooding it.
  const goods = game.markets.get(port.id)!.goods;
  const good = (Object.keys(goods) as (keyof typeof goods)[]).sort((a, b) => (goods[b]!.target > 0 ? 1 : 0) - (goods[a]!.target > 0 ? 1 : 0))[0];
  const qty = Math.max(5, Math.floor(goods[good]!.target * 0.3));
  trader.s.ship!.cargo = { [good]: qty };
  trader.c.push({ t: 'trade', good, qty: -qty });
  assert.ok(treasury() > t0, 'the governor\'s hundredth');
  // A riot stops the levy until the rioters are sunk.
  startRiot(game, port, gov);
  assert.equal(levyFor(game, port, 10_000), 0);
  const riot = game.empires.riots.get(port.id)!;
  for (const id of riot.ships) {
    const r = game.ships.get(id)!;
    r.hull = 0;
    game.beginSinking(r);
  }
  steps(game, 20 * 61);
  assert.equal(riot.quelled, true);
  assert.equal(levyFor(game, port, 10_000), 100);
  // Four weeks running, then the colonies will not have them.
  for (let w = 0; w < 4; w++) {
    advance(WEEK);
    steps(game, 20 * 61);
  }
  assert.equal(governorOf(game, region), null, 'not a fifth week');
  void weekOf;
});

test('trading houses: a charter, then scheduled convoys from one office store to another through the open sea', () => {
  const { game } = world();
  const { c, s } = captain(game, 'Hanse Merchant');
  const g = found(game, c, s, 'Hanse', 'HAN');
  const a = game.portById('gravesend')!, b = game.portById('blackwater') ?? game.world.ports.find((p) => p.id !== 'gravesend' && p.region === 'black_coast')!;
  c.push({ t: 'empire', action: 'charter' });
  assert.match(c.last('toast')!.msg, /20000/);
  g.treasury = 50_000;
  c.push({ t: 'empire', action: 'charter' });
  assert.equal(c.last('empire')!.view.house, true);
  g.offices[a.id] = game.wallNow() + WEEK;
  g.offices[b.id] = game.wallNow() + WEEK;
  g.stores[a.id] = { sugar: 40 };
  c.push({ t: 'empire', action: 'convoy', from: a.id, to: b.id, good: 'sugar', qty: 30, every: 6, escorts: 1 });
  const m = [...game.ships.values()].find((x) => x.convoyOf?.guild === g.id)!;
  assert.ok(m, 'a merchantman puts to sea');
  assert.equal(m.cargo.sugar, 30);
  assert.equal(g.stores[a.id].sugar, 10);
  assert.ok([...game.ships.values()].some((x) => x.ownerId === m.id), 'with an escort');
  convoyArrived(game, m);
  assert.equal(g.stores[b.id].sugar, 30);
  assert.equal(game.ships.has(m.id), false);
  assert.equal(c.last('empire')!.view.orders.length, 1, 'the schedule stands');
});

test('the Gravesend licence exchange: the highest bid takes next week\'s monopoly; the licensee sells dear, others pay the duty', () => {
  const { game, advance } = world();
  const A = captain(game, 'Lic Holder'), B = captain(game, 'Lic Rival');
  const gravesend = game.portById('gravesend')!;
  dockAt(game, A.s, gravesend);
  dockAt(game, B.s, gravesend);
  A.c.push({ t: 'empire', action: 'view' });
  const lot = A.c.last('empire')!.view.lots[0];
  B.c.push({ t: 'empire', action: 'bid', lot: 0, amount: 1000 });
  const bGold = B.s.profile!.gold;
  A.c.push({ t: 'empire', action: 'bid', lot: 0, amount: 1500 });
  // The week turns: A holds it; B's silver comes back.
  advance(WEEK);
  steps(game, 20 * 61);
  assert.equal(B.s.profile!.gold, bGold + 1000);
  B.c.push({ t: 'empire', action: 'view' });
  const lic = B.c.last('empire')!.view.licences.find((l) => l.good === lot.good);
  assert.equal(lic?.holder, 'Lic Holder');
  const book = game.db.getKv<{ active: { good: string; region: RegionId }[] }>('licences')!;
  const act = book.active[0];
  const port = game.world.ports.find((p) => p.region === act.region && (p.faction === 'crown' || p.faction === 'league'))!;
  assert.ok(Math.abs(saleMul(game, A.s, port, act.good as never, 1) - 1.1) < 1e-9);
  assert.ok(Math.abs(saleMul(game, B.s, port, act.good as never, 1) - 0.8) < 1e-9);
});

test('against monopoly: flooding one market costs more with every tenth of it, and the NPCs bring counter-supply', () => {
  const { game } = world();
  const { s } = captain(game, 'Flood Fenn');
  stepEmpires(game);
  const port = game.world.ports.find((p) => p.faction === 'free' && game.markets.get(p.id)!.goods.rum)!;
  const gm = game.markets.get(port.id)!.goods.rum!;
  assert.equal(saleMul(game, s, port, 'rum', Math.floor(gm.target * 0.3)), 1);
  assert.ok(saleMul(game, s, port, 'rum', Math.ceil(gm.target * 0.75)) < 0.65, 'a flood is dear');
});
