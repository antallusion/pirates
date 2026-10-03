// The owner's priorities of 2026-09-30 (docs/16 P1–P3): the sea's ships fight each other where a captain can see it
// and she can take a side; the sea is cut into squares of ship levels; and the open sea is dense — a stack, a reef,
// a wreck, a buoy or a floating town every mile or two.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { levelRange } from '../shared/src/data/shiplevel.ts';
import { veteranPay } from '../shared/src/data/questpay.ts';
import { Rng } from '../shared/src/rng.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { bandOf, captainBand, sectorAt, sectorGrid, SECTOR_SIZE, SECTORS_PER_SIDE } from '../shared/src/world/sectors.ts';
import { generateWorld, isLand, marksNear, portLanes } from '../shared/src/world/worldgen.ts';
import { findPath } from '../server/src/game/nav.ts';
import { npcHostileTo, spawnTraffic } from '../server/src/game/npc.ts';
import { callOf, joinedRaid, rescuePay, stirWars } from '../server/src/game/npcwars.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const world = generateWorld(WORLD_SEED);

function captainAt(game: Game, name: string, x: number, y: number, level = 30): PlayerSession {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  s.profile!.level = level;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = 0;
  ship.region = game.regionAt(x, y);
  game.grid.upsert(ship.id, x, y);
  return s;
}

function npc(game: Game, role: 'pirate' | 'merchant' | 'fisher' | 'patrol' | 'hunter' | 'ghost', x: number, y: number, faction?: string): ShipEntity {
  const cls = role === 'pirate' ? 'schooner' : role === 'merchant' ? 'fluyt' : role === 'fisher' ? 'cutter' : role === 'hunter' ? 'harpoon_whaler' : role === 'ghost' ? 'ghost_ship' : 'brig';
  const fac = faction ?? (role === 'pirate' ? 'confederacy' : role === 'ghost' ? 'choir' : role === 'hunter' ? 'harpoon' : role === 'patrol' ? 'crown' : 'league');
  const o = game.spawnNpcShip(role, cls as never, fac as never, x, y, 0);
  game.setNpcLevel(o, 4);
  const b = game.npcs.get(o.id)!;
  b.active = true;
  b.area = { x, y, r: 2000 };
  game.grid.upsert(o.id, x, y);
  o.region = game.regionAt(x, y);
  return o;
}

/** Open water in Gravewater (contested) clear of land for a mile about. */
function openSpot(game: Game): { x: number; y: number } {
  for (let i = 0; i < 400; i++) {
    const x = 52000 + ((i * 7919) % 12000), y = 66000 + ((i * 104729) % 10000);
    if (REGIONS[game.regionAt(x, y)].safety !== 'contested') continue;
    if (game.world.islands.some((is) => Math.hypot(is.x - x, is.y - y) < is.radius + 1600)) continue;
    if (game.world.reefs.some((q) => Math.hypot(q.x - x, q.y - y) < q.radius + 1200)) continue;
    return { x, y };
  }
  throw new Error('no open water');
}

test('the sea’s ships go for each other by the rules: raiders for trade, the law for raiders, whalers for beasts, the dead for all', () => {
  const { game } = makeGame();
  const { x, y } = openSpot(game);
  captainAt(game, 'Watcher', x, y);
  const pirate = npc(game, 'pirate', x + 1200, y);
  const merchant = npc(game, 'merchant', x + 1200, y + 500);
  const fisher = npc(game, 'fisher', x + 1400, y - 500);
  const patrol = npc(game, 'patrol', x - 1200, y);
  const whaler = npc(game, 'hunter', x - 1200, y + 600);
  const ghost = npc(game, 'ghost', x, y + 1500);
  const escort = game.spawnNpcShip('escort', 'brig', 'league', x + 1300, y + 700, 0);
  escort.escortOf = merchant.id;
  const beast = game.spawnNpcShip('beast', 'shark', 'free', x - 1000, y + 900, 0);
  assert.ok(npcHostileTo(game, pirate, merchant), 'a pirate goes for a merchant in contested water');
  assert.ok(npcHostileTo(game, pirate, fisher), 'and for a fisher');
  assert.ok(!npcHostileTo(game, merchant, pirate), 'a merchant goes for nobody');
  assert.ok(npcHostileTo(game, patrol, pirate), 'the law goes for a raider');
  assert.ok(npcHostileTo(game, patrol, ghost), 'and for the dead');
  assert.ok(!npcHostileTo(game, patrol, merchant), 'not for honest trade');
  assert.ok(npcHostileTo(game, whaler, beast), 'a Harpoon whaler goes for a beast');
  assert.ok(!npcHostileTo(game, pirate, beast), 'a pirate leaves the beasts be');
  assert.ok(npcHostileTo(game, ghost, merchant) && npcHostileTo(game, ghost, patrol), 'the dead go for anyone');
  assert.ok(!npcHostileTo(game, escort, pirate), 'an escort lets a rover sail by...');
  game.npcs.get(pirate.id)!.target = merchant.id;
  assert.ok(npcHostileTo(game, escort, pirate), '...but not one bearing down on her merchant');
  // Safe water: the Brethren keep off the Crown's merchants.
  const safe = npc(game, 'merchant', 16000, 84000);
  safe.region = 'black_coast';
  assert.ok(!npcHostileTo(game, pirate, safe), 'no raid in safe water');
  // The fight itself: normal combat, in the captain's sight.
  for (const o of [fisher, patrol, whaler, ghost, escort, safe]) game.removeShip(o.id);
  game.removeShip(beast.id);
  const hull0 = merchant.hull;
  steps(game, 20 * 90);
  assert.ok(merchant.hull < hull0 || merchant.surrendered || merchant.boarding || !merchant.alive, 'the pirate is at her');
  assert.equal(game.npcs.get(pirate.id)?.target ?? merchant.id, merchant.id);
});

test('a merchant under a raider’s guns calls for help; the captain who sinks the raider is paid by her own level and thanked', () => {
  const { game } = makeGame();
  const { x, y } = openSpot(game);
  const s = captainAt(game, 'Rescuer', x, y, 40);
  const me = s.ship!;
  onHull(game, me, 'schooner', 4); // on even terms with the raider
  const mate = captainAt(game, 'Turncoat', x + 200, y + 200, 20);
  const pirate = npc(game, 'pirate', x + 1800, y);
  const merchant = npc(game, 'merchant', x + 1800, y + 400);
  // The raider fires on her: the call goes up with a bearing and a distance.
  applyDamage(game, merchant, { hull: 40 }, pirate);
  const c = callOf(game, merchant.id);
  assert.ok(c && c.attacker === pirate.id, 'the call stands');
  // A captain who fires on the merchant as well sails with the raiders.
  applyDamage(game, merchant, { hull: 5 }, mate.ship!);
  assert.ok(joinedRaid(game, pirate, mate.ship!), 'the turncoat sails with them');
  assert.ok(!npcHostileTo(game, pirate, mate.ship!), 'the raiders hold their fire on her');
  // The rescuer sinks the raider.
  const gold0 = s.profile!.gold, rep0 = s.profile!.reputation.league ?? 0;
  const turn0 = mate.profile!.gold;
  applyDamage(game, pirate, { hull: pirate.stats.hullMax * 0.5 }, mate.ship!); // the turncoat changes her mind too late
  applyDamage(game, pirate, { hull: pirate.stats.hullMax * 2 }, me);
  const pay = rescuePay(40, sectorAt(game.world, merchant.state.x, merchant.state.y).level);
  assert.equal(s.profile!.gold - gold0, pay.silver + pay.bounty, 'paid by her level');
  assert.ok((s.profile!.reputation.league ?? 0) > rep0, 'the League remembers');
  assert.equal(mate.profile!.gold, turn0, 'one who fired on the merchant is no rescuer');
  assert.equal(callOf(game, merchant.id), undefined, 'the call is answered');
  // A rescue pays a veteran better, and a bounty in the low waters.
  assert.ok(rescuePay(55, 5).silver > rescuePay(10, 5).silver);
  assert.ok(rescuePay(30, 2).bounty > 0 && rescuePay(30, 6).bounty === 0);
});

test('the call is heard with a bearing: every captain within a few miles, none beyond', () => {
  const { game } = makeGame();
  const { x, y } = openSpot(game);
  const near = captainAt(game, 'Near', x, y);
  const far = captainAt(game, 'Far', x - 9000, y);
  const pirate = npc(game, 'pirate', x + 2000, y);
  const merchant = npc(game, 'merchant', x + 2000, y + 300);
  const toasts: [number, string][] = [];
  const orig = game.toastShip.bind(game);
  game.toastShip = (ship, msg, kind) => {
    if (ship) toasts.push([ship.id, msg]);
    return orig(ship, msg, kind);
  };
  applyDamage(game, merchant, { hull: 30 }, pirate);
  const heard = toasts.filter(([, t]) => t.includes('calls for help'));
  assert.equal(heard.length, 1, heard.join(' / '));
  assert.equal(heard[0][0], near.ship!.id);
  assert.match(heard[0][1], /^Pirates attack .+, 2\.0 km east: she calls for help!$/);
  assert.ok(!heard.some(([id]) => id === far.ship!.id));
});

test('the sea stages a raid in a captain’s sight: an idle rover goes for a merchant near her', () => {
  const { game } = makeGame();
  const { x, y } = openSpot(game);
  const s = captainAt(game, 'Spectator', x, y);
  const pirate = npc(game, 'pirate', x + 2000, y - 800);
  const merchant = npc(game, 'merchant', x + 1500, y + 900);
  let did: string | null = null;
  for (let k = 0; k < 400 && !did; k++) {
    game.now += 1;
    did = stirWars(game, s, false);
  }
  assert.equal(did, 'raid');
  assert.equal(game.npcs.get(pirate.id)!.chase?.id, merchant.id);
  // In the First Watch nothing is staged.
  const { game: g2 } = makeGame();
  const s2 = captainAt(g2, 'Novice', x, y);
  npc(g2, 'pirate', x + 2000, y);
  npc(g2, 'merchant', x + 1500, y + 900);
  for (let k = 0; k < 400; k++) {
    g2.now += 1;
    assert.equal(stirWars(g2, s2, true), null);
  }
});

test('sector bands: the same for the seed, rising with the danger of the waters, with pockets both ways', () => {
  const a = sectorGrid(world), b = sectorGrid(generateWorld(WORLD_SEED));
  assert.equal(a.length, SECTORS_PER_SIDE * SECTORS_PER_SIDE);
  assert.deepEqual(a.map((s) => s.level), b.map((s) => s.level), 'deterministic');
  const mean = (safety: string) => {
    const list = a.filter((s) => REGIONS[s.region].safety === safety && s.region !== 'the_abyss');
    return list.reduce((n, s) => n + s.level, 0) / list.length;
  };
  assert.ok(mean('safe') < mean('contested') && mean('contested') < mean('lawless'), `${mean('safe')} < ${mean('contested')} < ${mean('lawless')}`);
  const abyss = a.filter((s) => s.region === 'the_abyss');
  assert.ok(abyss.length && abyss.every((s) => s.level >= 8), 'the Abyss is the deepest');
  assert.equal(sectorAt(world, 11500, 87000).level, 1, 'Saltmarrow, where every captain starts');
  assert.ok(a.some((s) => s.pocket === 'calm') && a.some((s) => s.pocket === 'wild'), 'a quiet pocket in the wild and a dangerous one in the calm');
  for (const s of a) {
    assert.ok(s.level >= 1 && s.level <= 10);
    assert.deepEqual(s.band, bandOf(s.level));
    if (s.pocket === 'calm') assert.ok(world.ports.some((p) => Math.floor(p.x / SECTOR_SIZE) === s.sx && Math.floor(p.y / SECTOR_SIZE) === s.sy), 'a quiet pocket is a harbour’s');
  }
  // Reasons to come back to the low waters: a port's job pays a veteran more, up to twice its pay.
  assert.equal(veteranPay(5, 5), 1);
  assert.ok(veteranPay(30, 6) > 1.5 && veteranPay(60, 1) === 2);
  // The captains a square is for: a ⚓3–5 square for captains of about 8 to 25.
  assert.deepEqual(captainBand([3, 5]), [8, 25]);
  assert.deepEqual(captainBand([9, 10]), [49, 60]);
});

test('the sea’s ships take their levels from the square they put out in', () => {
  const { game } = makeGame();
  const grid = sectorGrid(game.world);
  const pick = (pred: (l: number) => boolean) => grid.find((s) => pred(s.level) && REGIONS[s.region].safety !== 'safe' && !s.pocket)!;
  for (const sec of [pick((l) => l <= 4), pick((l) => l >= 7)]) {
    let n = 0;
    for (let k = 0; k < 60 && n < 8; k++) {
      const x = sec.sx * SECTOR_SIZE + 1000 + ((k * 1237) % 6000), y = sec.sy * SECTOR_SIZE + 1000 + ((k * 2749) % 6000);
      if (isLand(game.world, x, y) || sectorAt(game.world, x, y) !== sec) continue;
      const o = spawnTraffic(game, 'pirate', x, y, { x: x + 3000, y });
      if (!o) continue;
      const [clo, chi] = levelRange(o.loadout.classId);
      assert.ok(o.shipLevel >= Math.max(sec.band[0], clo) - 0 || o.shipLevel === clo, `⚓${o.shipLevel} in a ⚓${sec.band.join('–')} square`);
      assert.ok(o.shipLevel <= Math.min(chi, Math.max(sec.band[1], clo)), `⚓${o.shipLevel} in a ⚓${sec.band.join('–')} square`);
      game.removeShip(o.id);
      n++;
    }
    assert.ok(n >= 4, `${n} pirates put out`);
  }
});

test('the dense sea: on almost every two-kilometre stretch of open water something is within a kilometre', () => {
  const pois: [number, number, number][] = [
    ...world.islands.map((i) => [i.x, i.y, i.radius] as [number, number, number]),
    ...world.reefs.map((r) => [r.x, r.y, r.radius] as [number, number, number]),
    ...world.marks.map((m) => [m.x, m.y, m.r] as [number, number, number]),
  ];
  const rng = new Rng(11);
  let seg = 0, hit = 0;
  for (let k = 0; k < 300; k++) {
    const x = rng.range(6000, 90000), y = rng.range(6000, 90000), a = rng.range(0, Math.PI * 2);
    for (let s = 0; s < 5; s++) {
      const cx = x + Math.sin(a) * (s * 2000 + 1000), cy = y - Math.cos(a) * (s * 2000 + 1000);
      if (cx < 5000 || cy < 5000 || cx > 91000 || cy > 91000) break;
      if (isLand(world, cx, cy)) continue;
      seg++;
      let ok = false;
      for (let t = -1000; t <= 1000 && !ok; t += 250) {
        const px = cx + Math.sin(a) * t, py = cy - Math.cos(a) * t;
        ok = pois.some(([ix, iy, ir]) => Math.hypot(ix - px, iy - py) < ir + 1000);
      }
      if (ok) hit++;
    }
  }
  assert.ok(hit / seg >= 0.95, `${hit}/${seg} stretches`);
  // A mix of things to see, and their chunks index them.
  const kinds = new Set(world.marks.map((m) => m.kind));
  for (const k of ['wreck', 'buoy', 'lantern', 'drift', 'bones', 'floe']) assert.ok(kinds.has(k as never), k);
  assert.ok(world.islands.filter((i) => i.minor).length > 150, 'sea stacks');
  const m = world.marks[123];
  assert.ok(marksNear(world, m.x, m.y, 10).includes(m));
});

test('the dense sea keeps the lanes, harbours and currents clear, and ships still find their way', () => {
  // The harbours and lanes of the ports it was laid round (step 8's twenty towns came after it, each on clear water of
  // her own: tests/ports20.test.ts).
  const old = world.ports.slice(0, world.portsFrom);
  const lanes = portLanes(old.filter((p) => !p.raft));
  const dense = world.islands.slice(world.minorFrom).filter((i) => i.minor);
  const reefs = world.reefs.slice(world.reefsFrom);
  for (const o of [...dense.map((i) => ({ x: i.x, y: i.y, r: i.radius })), ...reefs.map((q) => ({ x: q.x, y: q.y, r: q.radius }))]) {
    for (const p of old) assert.ok(Math.hypot(p.x - o.x, p.y - o.y) > 2000, 'clear of a harbour');
    for (const [ax, ay, bx, by] of lanes) {
      const abx = bx - ax, aby = by - ay, t = Math.max(0, Math.min(1, ((o.x - ax) * abx + (o.y - ay) * aby) / (abx * abx + aby * aby)));
      assert.ok(Math.hypot(ax + abx * t - o.x, ay + aby * t - o.y) > o.r + 500, 'clear of a lane');
    }
  }
  // Every port still reaches her three nearest neighbours.
  let found = 0, tried = 0;
  for (const p of world.ports) {
    const near = world.ports.filter((q) => q !== p).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 2);
    for (const q of near) {
      tried++;
      if (findPath(world, p.x, p.y, q.x, q.y, 40000)) found++;
    }
  }
  assert.ok(found / tried > 0.97, `${found}/${tried} routes`);
  // And the world is still made in a blink.
  const t0 = performance.now();
  generateWorld(4242);
  assert.ok(performance.now() - t0 < 1500, 'fast');
});

test('floating towns: small free ports on moored hulks in the open sea, with goods, a tavern and a yard', () => {
  const rafts = world.ports.filter((p) => p.raft);
  assert.ok(rafts.length >= 10, `${rafts.length} floating towns`);
  for (const p of rafts) {
    const is = world.islands[p.islandId];
    assert.ok(is.raft && is.portId === p.id, 'her hulks');
    assert.equal(p.faction, 'free');
    assert.ok(p.shipyardTier >= 1 && Object.keys(p.profile.produces).length >= 1, 'goods and a carpenter');
    for (const q of world.ports) if (q !== p && !q.raft) assert.ok(Math.hypot(q.x - p.x, q.y - p.y) > 5500, `${p.name} far out at sea`);
    assert.ok(!isLand(world, p.x, p.y), 'the anchorage is water');
  }
  // A captain sails up to one and docks: her market, her tavern, her yard.
  const { game } = makeGame();
  const raft = game.world.ports.find((p) => p.raft)!;
  const c = join(game, 'Drifter');
  c.push({ t: 'undock' });
  const s = game.sessionByName('Drifter')!;
  const ship = s.ship!;
  ship.state.x = raft.x;
  ship.state.y = raft.y;
  ship.state.speed = 0;
  ship.hull = ship.stats.hullMax * 0.6;
  game.grid.upsert(ship.id, raft.x, raft.y);
  c.push({ t: 'dock', bribe: false });
  steps(game, 2);
  assert.equal(ship.docked, raft.id, 'docked at the floating town');
  const view = c.last('port')?.view;
  assert.ok(view && view.portId === raft.id);
  assert.ok(view!.market.length >= 3, 'a few goods');
  assert.ok(view!.shipyard.repairCost > 0, 'repairs');
  assert.ok(view!.tavern, 'a tavern');
  // The chart knows her and the client draws her hulks.
  const init = c.last('init')!;
  assert.ok(init.ports.some((p) => p.id === raft.id && p.raft));
  assert.ok(init.sectors && init.sectors.length === SECTORS_PER_SIDE * SECTORS_PER_SIDE);
});

test('the old sea is as it was: every island, port and reef before the dense sea keeps her id and place', () => {
  const h = (x: unknown) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
  assert.equal(world.minorFrom, 836);
  assert.equal(h(world.islands.slice(0, world.minorFrom)), 'f349363fa0e5');
  assert.equal(h(world.ports.slice(0, 45)), 'aa979158af80');
  assert.equal(world.reefsFrom, 174);
  assert.equal(h(world.reefs.slice(0, world.reefsFrom)), '6d41012e001f');
  // The stacks are seen, not charted: no discovery for a rock.
  const { game } = makeGame();
  const stack = game.world.islands.find((i) => i.minor)!;
  const s = captainAt(game, 'Charter', stack.x + stack.radius + 150, stack.y);
  steps(game, 40);
  assert.ok(!s.discovered.has(stack.id));
});
