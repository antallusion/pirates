// docs/24 B3, C1, D1–D3 (owner, 2026-10-07): the cannon's dead the fewest hit points a man first; «Абордаж: выкл» both
// ways; a captain's colours — neutral, her city's or guild's, the pirate flag — on the old roads of the law (pvp.ts,
// combat.ts damageBlocked, boarding.ts canBoard, npc.ts npcHostileTo), chosen only in port and with a wait; the old
// saves; the tester's /flag and /noboard, in both languages command for command.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, armyMen, armyRemove, armyShot, shotHp, shotOrder } from '../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { COLOURS, COLOURS_FIGHT_MS, NEUTRAL_PIRATE_RATE, citiesHostile } from '../shared/src/data/colours.ts';
import type { Colours } from '../shared/src/data/colours.ts';
import { WANTED_THRESHOLDS } from '../shared/src/data/factions.ts';
import type { FactionId } from '../shared/src/data/factions.ts';
import { SF } from '../shared/src/protocol.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { canBoard } from '../server/src/game/boarding.ts';
import { cityOf, coloursSecond, neutralSpared, pirateDares } from '../server/src/game/colours.ts';
import { applyDamage, damageBlocked } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import { engage, npcHostileTo } from '../server/src/game/npc.ts';
import { sanitizeProfile } from '../server/src/game/player.ts';
import type { PlayerSession, Profile } from '../server/src/game/player.ts';
import { pvpFlags } from '../server/src/game/pvp.ts';
import { startPursuit } from '../server/src/game/pursuit.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { foundGuild } from '../server/src/game/guilds.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { SERVER_RU_FLAGS } from '../client/src/lang/server.ru.flags.ts';
import { EN as FL_EN, RU as FL_RU } from '../client/src/lang/ui/flags.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const sess = (game: Game, name: string): PlayerSession => game.sessionByName(name)!;

/** A captain at sea at (x, 30 000), on a brig of ⚓5 (the ladder even between them), under the given colours. */
function sea(game: Game, s: PlayerSession, x: number, region: RegionId = 'gravewater', flag?: Colours, city?: FactionId): ShipEntity {
  const sh = s.ship!;
  sh.docked = null;
  s.profile!.docked = null;
  onHull(game, sh, 'brig', 5);
  sh.crew = sh.stats.crewMax;
  sh.morale = 80;
  sh.state.x = x;
  sh.state.y = 30_000;
  sh.state.speed = 0;
  sh.region = region;
  sh.protectedUntil = 0;
  sh.lastCombat = -1000;
  s.profile!.level = 30;
  sh.level = 30;
  if (flag) s.profile!.pvp.flag = flag;
  if (city) s.profile!.pvp.city = city;
  game.grid.upsert(sh.id, sh.state.x, sh.state.y);
  return sh;
}

function pair(game: Game, region: RegionId = 'gravewater'): { a: FakeConn; b: FakeConn; A: PlayerSession; B: PlayerSession } {
  const a = join(game, 'Anne Colours'), b = join(game, 'Bram Colours');
  const A = sess(game, 'Anne Colours'), B = sess(game, 'Bram Colours');
  sea(game, A, 30_000, region);
  sea(game, B, 30_015, region);
  return { a, b, A, B };
}

/** Who may attack whom (docs/24, the rule table): attacker's colours › defender's, two cities of one mind or at enmity. */
const MAY: Record<string, boolean> = {
  'neutral>neutral': false, 'neutral>faction': false, 'neutral>pirate': false,
  'faction>neutral': false, 'faction>faction': false, 'faction>faction:enemies': true, 'faction>pirate': true,
  'pirate>neutral': false, 'pirate>faction': true, 'pirate>pirate': true,
};
const may = (a: Colours, b: Colours, enemies: boolean): boolean => MAY[`${a}>${b}${enemies && a === 'faction' && b === 'faction' ? ':enemies' : ''}`] ?? MAY[`${a}>${b}`];

test('who may attack whom: every pair of colours, guns and grapples, in contested and lawless water; none in safe water', () => {
  for (const region of ['gravewater', 'dead_mans_expanse'] as RegionId[]) {
    for (const enemies of [false, true]) {
      for (const fa of COLOURS) {
        for (const fb of COLOURS) {
          const { game } = makeGame();
          const { A, B } = pair(game, region);
          // One city, or two at enmity (the Crown and the Red Tide).
          A.profile!.pvp.flag = fa;
          B.profile!.pvp.flag = fb;
          A.profile!.pvp.city = 'crown';
          B.profile!.pvp.city = enemies ? 'confederacy' : 'crown';
          const want = may(fa, fb, enemies);
          const tag = `${region}: ${fa} › ${fb}${enemies ? ' (cities at enmity)' : ''}`;
          // The guns.
          const why = damageBlocked(game, A.ship!, B.ship!);
          assert.equal(why === null, want, `${tag}: guns — ${why}`);
          const hull = B.ship!.hull;
          applyDamage(game, B.ship!, { hull: 20 }, A.ship!);
          assert.equal(B.ship!.hull < hull, want, `${tag}: a ball lands or not, by any road`);
          // The grapples (the same rule, on the boarding road).
          B.ship!.hull = B.ship!.stats.hullMax;
          const bw = canBoard(game, A.ship!, B.ship!);
          assert.equal(bw === null, want, `${tag}: boarding — ${bw}`);
          // The same both ways: whoever may attack may be attacked back.
          assert.equal(damageBlocked(game, B.ship!, A.ship!) === null, may(fb, fa, enemies), `${tag}: back`);
          // Her snapshot shows her colours to every eye.
          const f = pvpFlags(game, B.ship!);
          assert.equal(!!(f & SF.NEUTRAL), fb === 'neutral');
          assert.equal(!!(f & SF.BLACK_FLAG), fb === 'pirate');
        }
      }
    }
  }
  // The Crown's safe water: no captain fires on another whatever they fly.
  for (const fa of COLOURS) for (const fb of COLOURS) {
    const { game } = makeGame();
    const { A, B } = pair(game, 'black_coast');
    A.profile!.pvp.flag = fa;
    B.profile!.pvp.flag = fb;
    assert.equal(damageBlocked(game, A.ship!, B.ship!), 'Safe waters: no PvP here.', `safe: ${fa} › ${fb}`);
  }
});

test('the city flag: two guilds at war are fair game for each other in one city; a guild and its own never fire', () => {
  const { game } = makeGame();
  const a = join(game, 'Anne Guild'), b = join(game, 'Bram Guild');
  const A = sess(game, 'Anne Guild'), B = sess(game, 'Bram Guild');
  A.profile!.gold = B.profile!.gold = 50_000;
  assert.equal(foundGuild(game, A, 'Salt Wolves', 'SW'), null);
  assert.equal(foundGuild(game, B, 'Tide Hounds', 'TH'), null);
  sea(game, A, 30_000, 'gravewater', 'faction', 'crown');
  sea(game, B, 30_015, 'gravewater', 'faction', 'crown');
  assert.match(String(damageBlocked(game, A.ship!, B.ship!)), /at peace with yours/);
  const st = game.guilds.store(game);
  const ga = game.guilds.of(game, A.accountId)!, gb = game.guilds.of(game, B.accountId)!;
  st.wars.push({ a: ga.id, b: gb.id, declared: 0, prepUntil: 0, minEnd: game.wallNow() + 8 * 86_400_000, score: { [ga.id]: 0, [gb.id]: 0 }, terms: null });
  assert.equal(damageBlocked(game, A.ship!, B.ship!), null, 'guilds at war');
  assert.equal(canBoard(game, A.ship!, B.ship!), null);
  applyDamage(game, B.ship!, { hull: 5 }, A.ship!);
  assert.equal(A.profile!.infamy, 0, 'a war is no crime');
  // One guild: its own never fire on each other, whatever they fly.
  st.wars.length = 0;
  ga.alliance.push(gb.id);
  A.profile!.pvp.flag = 'pirate';
  assert.equal(damageBlocked(game, A.ship!, B.ship!), 'friendly');
  void a;
  void b;
});

test('the sea’s own ships and the colours: pirates come for a neutral captain a tenth as often; the law for the pirate flag', () => {
  const { game } = makeGame();
  const c = join(game, 'Nell Neutral');
  const s = sess(game, 'Nell Neutral');
  const me = sea(game, s, 30_000, 'gravewater', 'neutral');
  const pirate = game.spawnNpcShip('pirate', 'brig', 'confederacy', 30_400, 30_000, 0);
  game.setNpcLevel(pirate, 5);
  const brain = game.npcs.get(pirate.id)!;
  // A pirate makes up his mind about her once, and keeps it ten minutes.
  let bold = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    brain.dares = new Map();
    if (npcHostileTo(game, pirate, me)) bold++;
  }
  const rate = bold / N;
  assert.ok(Math.abs(rate - NEUTRAL_PIRATE_RATE) < 0.025, `a pirate dares ${(rate * 100).toFixed(1)}% of the time (the target ${NEUTRAL_PIRATE_RATE * 100}%)`);
  brain.dares = new Map();
  const first = npcHostileTo(game, pirate, me);
  for (let i = 0; i < 20; i++) assert.equal(npcHostileTo(game, pirate, me), first, 'his mind holds');
  game.now += 601;
  // The hunts put out after her: spared nine times in ten.
  let spared = 0;
  for (let i = 0; i < N; i++) if (neutralSpared(game, me)) spared++;
  assert.ok(Math.abs(spared / N - (1 - NEUTRAL_PIRATE_RATE)) < 0.025, `${spared} of ${N} hunts spared her`);
  // Her city's colours and the pirate flag: every pirate comes, every time.
  s.profile!.pvp.flag = 'faction';
  assert.ok(npcHostileTo(game, pirate, me));
  assert.equal(neutralSpared(game, me), false);
  s.profile!.pvp.flag = 'pirate';
  assert.ok(npcHostileTo(game, pirate, me));
  // The law: a Crown patrol comes for the pirate flag; not for her city's colours nor for neutral ones (wanted 0).
  const patrol = game.spawnNpcShip('patrol', 'brig', 'crown', 29_600, 30_000, 0);
  game.setNpcLevel(patrol, 5);
  assert.ok(npcHostileTo(game, patrol, me), 'the pirate flag');
  s.profile!.pvp.flag = 'faction';
  assert.equal(npcHostileTo(game, patrol, me), false);
  s.profile!.pvp.flag = 'neutral';
  assert.equal(npcHostileTo(game, patrol, me), false);
  // The colours bind captains only: the sea's ships fire on her by their own minds, and she on them (PvE).
  assert.equal(damageBlocked(game, pirate, me), null);
  assert.equal(damageBlocked(game, me, pirate), null);
  assert.equal(canBoard(game, pirate, me), 'Too far to throw grapples');
  // pirateDares without a brain (a ship the sea has not given a mind) still rolls on the colours' own dice.
  assert.equal(typeof pirateDares(game, undefined, me), 'boolean');
  void c;
});

test('colours change only in port, a minute after the order and never within ten of a fight with a captain', () => {
  const { game } = makeGame();
  const a = join(game, 'Anne Port'), b = join(game, 'Bram Port');
  const A = sess(game, 'Anne Port'), B = sess(game, 'Bram Port');
  let wall = Date.now();
  game.wallNow = () => wall;
  // At sea: refused.
  sea(game, A, 30_000, 'gravewater', 'faction', 'crown');
  a.push({ t: 'pvp', action: 'colours', flag: 'neutral' });
  assert.match(a.last('toast')!.msg, /only in port/);
  assert.equal(A.profile!.pvp.next, null);
  // A fight with a captain (Bram under the pirate flag fires on her)…
  sea(game, B, 30_015, 'gravewater', 'pirate');
  applyDamage(game, A.ship!, { hull: 5 }, B.ship!);
  assert.equal(A.profile!.pvp.pvpAt, wall);
  // …and she runs into port: the order is taken, but the colours wait ten minutes from that fight.
  const port = game.world.ports.find((p) => p.faction === 'league')!;
  A.ship!.docked = port.id;
  A.profile!.docked = port.id;
  a.push({ t: 'pvp', action: 'colours', flag: 'neutral' });
  assert.equal(A.profile!.pvp.next, 'neutral');
  assert.equal(A.profile!.pvp.nextAt, wall + COLOURS_FIGHT_MS);
  assert.match(a.last('toast')!.msg, /Neutral colours go up in 10 min/);
  assert.equal(a.last('self')!.self.pvp.next, 'neutral', 'her papers show the order');
  wall += 5 * 60_000;
  coloursSecond(game, A);
  assert.equal(A.profile!.pvp.flag, 'faction', 'five minutes: not yet');
  wall += 5 * 60_000 + 1000;
  coloursSecond(game, A);
  assert.equal(A.profile!.pvp.flag, 'neutral', 'ten: up');
  assert.match(a.last('toast')!.msg, /Neutral colours are up/);
  // The city flag hoisted in a League port is the League's.
  a.push({ t: 'pvp', action: 'colours', flag: 'faction' });
  assert.equal(A.profile!.pvp.nextAt, wall + 60_000, 'a minute, the fight long past');
  wall += 61_000;
  coloursSecond(game, A);
  assert.equal(A.profile!.pvp.flag, 'faction');
  assert.equal(A.profile!.pvp.city, 'league');
  // Sailing before they go up strikes the order.
  a.push({ t: 'pvp', action: 'colours', flag: 'pirate' });
  assert.equal(A.profile!.pvp.next, 'pirate');
  a.push({ t: 'undock' });
  assert.equal(A.profile!.pvp.next, null);
  assert.match(a.all('toast').map((t) => t.msg).join(' | '), /sailed before your new colours went up/);
  wall += 120_000;
  coloursSecond(game, A);
  assert.equal(A.profile!.pvp.flag, 'faction', 'nothing went up at sea');
  // The same colours ordered again strike a pending order (and nothing else happens).
  A.ship!.docked = port.id;
  a.push({ t: 'pvp', action: 'colours', flag: 'pirate' });
  a.push({ t: 'pvp', action: 'colours', flag: 'faction' });
  assert.equal(A.profile!.pvp.next, null);
  // The law wants her: neutral colours are refused, and struck at once if she flies them when it comes to that.
  A.profile!.infamy = WANTED_THRESHOLDS[2];
  a.push({ t: 'pvp', action: 'colours', flag: 'neutral' });
  assert.match(a.last('toast')!.msg, /law wants/);
  A.profile!.infamy = 0;
  A.profile!.pvp.flag = 'neutral';
  game.addInfamy(A.ship!, WANTED_THRESHOLDS[2] + 1, 'test');
  assert.equal(A.profile!.pvp.flag, 'faction', 'struck by the law');
  void b;
});

test('boarding off, both ways: she boards nobody and nobody boards her — captains, the sea’s pirates, the helmsman’s run', () => {
  const { game } = makeGame();
  const { a, b, A, B } = pair(game);
  A.profile!.pvp.flag = B.profile!.pvp.flag = 'pirate';
  assert.equal(canBoard(game, A.ship!, B.ship!), null);
  // Switched only in port.
  a.push({ t: 'pvp', action: 'no_board', on: true });
  assert.match(a.last('toast')!.msg, /only in port/);
  assert.equal(!!A.profile!.noBoard, false);
  A.ship!.docked = game.world.ports[0].id;
  a.push({ t: 'pvp', action: 'no_board', on: true });
  assert.equal(A.profile!.noBoard, true);
  assert.equal(a.last('self')!.self.pvp.noBoard, true);
  A.ship!.docked = null;
  assert.ok(pvpFlags(game, A.ship!) & SF.NO_BOARD, 'her badge');
  // Both ways, with the reason said: hers and the other's.
  assert.match(String(canBoard(game, A.ship!, B.ship!)), /off on your ship/);
  assert.match(String(canBoard(game, B.ship!, A.ship!)), /off on her ship/);
  b.push({ t: 'board', target: A.ship!.id, aggression: 'standard' });
  assert.match(b.last('toast')!.msg, /off on her ship/, 'the one press, the one word');
  assert.equal(A.ship!.boarding, null);
  // The guns still speak, to the end.
  assert.equal(damageBlocked(game, B.ship!, A.ship!), null);
  // «Атаковать» to board her: the guns' run, said once at the order.
  const before = b.all('toast').length;
  assert.equal(startPursuit(game, B, A.ship!.id, 'board'), null);
  assert.equal(b.last('pursuit')!.mode, 'guns');
  assert.equal(b.all('toast').length, before + 1);
  // The sea's pirate lies alongside: with boarding off she is fought with the guns, never grappled.
  const pirate = game.spawnNpcShip('pirate', 'brig', 'confederacy', A.ship!.state.x - 15, A.ship!.state.y, 0);
  game.setNpcLevel(pirate, 5);
  pirate.setArmy([{ u: 'guard', n: 80 }]);
  A.ship!.hull = A.ship!.stats.hullMax * 0.3; // broken: a pirate would board her at once
  const brain = game.npcs.get(pirate.id)!;
  assert.match(String(canBoard(game, pirate, A.ship!)), /off on her ship/);
  engage(game, pirate, brain, A.ship!, 15);
  assert.equal(A.ship!.boarding, null, 'not boarded');
  assert.equal(pirate.ammoSel, 'round', 'round shot to sink her, not grape for a boarding');
  // Boarding on again (in port): the pirate grapples a broken ship as before.
  A.ship!.docked = game.world.ports[0].id;
  a.push({ t: 'pvp', action: 'no_board', on: false });
  A.ship!.docked = null;
  assert.equal(A.profile!.noBoard, false);
  engage(game, pirate, brain, A.ship!, 15);
  assert.ok(A.ship!.boarding, 'boarded');
});

test('the cannon’s dead fall the fewest hit points a man first, men and creatures alike; a shot weighs what it weighed', () => {
  // The order: by hit points, then defence (a creature among the men takes its place by its own).
  const kinds = (Object.keys(UNITS) as UnitId[]).filter((u) => UNITS[u].hp > 0);
  const army: ArmyStack[] = [{ u: 'guard', n: 6 }, { u: 'deckhand', n: 20 }, { u: 'marine', n: 12 }, { u: 'musketeer', n: 10 }];
  const beast = kinds.find((u) => !['deckhand', 'sailor', 'marine', 'sea_guard', 'musketeer', 'sharpshooter', 'gunner', 'bombardier', 'boarder', 'cutthroat', 'guard', 'life_guard', 'drowned', 'deep_spawn'].includes(u) && UNITS[u].hp > 9 && UNITS[u].hp < 25)!;
  assert.ok(beast, 'a creature between a marine and a guard');
  army.push({ u: beast, n: 4 });
  const order = shotOrder(army).map((s) => s.u);
  assert.deepEqual(order, (['deckhand', 'musketeer', 'marine', beast, 'guard'] as UnitId[]).sort((x, y) => UNITS[x].hp - UNITS[y].hp || UNITS[x].def - UNITS[y].def));
  // Shot after shot: a stack loses men only once every stack below it is gone.
  const a = army.map((s) => ({ ...s }));
  let wound = 0;
  for (let k = 0; k < 400 && armyMen(a) > 0; k++) {
    const r = armyShot(a, 1.7, wound);
    wound = r.wound;
    for (const x of r.lost) {
      const below = shotOrder(army).filter((s) => UNITS[s.u].hp < UNITS[x.u].hp || (UNITS[s.u].hp === UNITS[x.u].hp && UNITS[s.u].def < UNITS[x.u].def));
      for (const s of below) assert.ok(!a.some((y) => y.u === s.u && y.n > 0) || r.lost.some((l) => l.u === s.u), `${x.u} fell while ${s.u} stood`);
    }
    assert.ok(wound >= 0 && wound < Math.max(...a.map((s) => shotHp(s.u)), 1));
  }
  assert.equal(armyMen(a), 0, 'all fall in the end');
  // A shot of k men takes the hit points the old reckoning by exposure took (within a man's worth).
  for (const k of [1, 3, 7, 15]) {
    const x = army.map((s) => ({ ...s })), y = army.map((s) => ({ ...s }));
    const hp = (arm: ArmyStack[]) => arm.reduce((t, s) => t + s.n * shotHp(s.u), 0);
    const h0 = hp(x);
    const r = armyShot(x, k);
    armyRemove(y, k);
    const took = h0 - hp(x) + r.wound, was = h0 - hp(y);
    assert.ok(Math.abs(took - was) <= shotHp('guard'), `k=${k}: ${took.toFixed(1)} against ${was.toFixed(1)} hit points`);
  }
  // No more than the cap (the ladder's floor of her men).
  const c = [{ u: 'deckhand' as UnitId, n: 30 }];
  armyShot(c, 20, 0, 4);
  assert.equal(c[0].n, 26);
});

test('a ship hit: the deckhands go before the marines, the marines before the guard; the "−N" is the men who fell', () => {
  const { game } = makeGame();
  const s = game.spawnNpcShip('patrol', 'brig', 'crown', 30_000, 80_000, 0);
  game.setNpcLevel(s, 5);
  s.setArmy([{ u: 'guard', n: 10 }, { u: 'marine', n: 10 }, { u: 'deckhand', n: 10 }]);
  const fell = applyDamage(game, s, { crew: 6 }, null);
  const n = (u: UnitId) => s.army.find((x) => x.u === u)?.n ?? 0;
  assert.equal(n('guard'), 10);
  assert.equal(n('marine'), 10);
  assert.ok(n('deckhand') < 10, `${10 - n('deckhand')} deckhands fell`);
  assert.equal(fell, 30 - s.crew);
  // Hit after hit: no marine falls while a deckhand stands, no guardsman while a marine does.
  for (let i = 0; i < 12 && s.crew > 0; i++) {
    const before = { d: n('deckhand'), m: n('marine'), g: n('guard') };
    applyDamage(game, s, { crew: 4 }, null);
    if (n('marine') < before.m) assert.equal(n('deckhand'), 0, `hit ${i}: a marine fell with deckhands standing`);
    if (n('guard') < before.g) assert.equal(n('marine'), 0, `hit ${i}: a guardsman fell with marines standing`);
  }
  assert.equal(s.crew, 0, 'all fall in the end');
});

test('old saves and new captains: the city flag (the pirate flag for a Black Flag), boarding on', () => {
  const { game } = makeGame();
  join(game, 'Old Salt');
  const s = sess(game, 'Old Salt');
  const raw = JSON.parse(JSON.stringify(s.profile)) as Profile & { pvp: Record<string, unknown> };
  const old = (over: Record<string, unknown>, level: number): Profile => {
    const p = JSON.parse(JSON.stringify(raw)) as Profile & { pvp: Record<string, unknown> };
    for (const k of ['flag', 'city', 'next', 'nextCity', 'nextAt', 'pvpAt']) delete p.pvp[k];
    delete (p as { noBoard?: boolean }).noBoard;
    Object.assign(p.pvp, over);
    p.level = level;
    return sanitizeProfile(p);
  };
  const vet = old({ blackFlag: false, played: 90 * 3600 }, 40);
  assert.equal(vet.pvp.flag, 'faction');
  assert.equal(vet.noBoard, false);
  assert.ok(!('blackFlag' in vet.pvp));
  assert.equal(old({ blackFlag: true, played: 90 * 3600 }, 40).pvp.flag, 'pirate');
  assert.equal(old({ blackFlag: false, played: 3600 }, 4).pvp.flag, 'faction', 'a young one too: the Green Pennant over it, as before');
  // Her city: her oath's, else her last port's.
  s.profile = vet;
  vet.oath = 'code';
  assert.equal(cityOf(game, vet), 'confederacy');
  vet.pvp.city = null;
  vet.oath = null;
  assert.equal(cityOf(game, vet), game.portById(vet.docked ?? vet.lastPort)!.faction);
  // A new captain flies her city's colours (the Green Pennant over them while she is young), with boarding on.
  const n = join(game, 'New Hand');
  void n;
  assert.equal(sess(game, 'New Hand').profile!.pvp.flag, 'faction');
  assert.ok(sess(game, 'New Hand').profile!.pvp.city === null || typeof sess(game, 'New Hand').profile!.pvp.city === 'string');
  assert.equal(!!sess(game, 'New Hand').profile!.noBoard, false);
});

test('the cities at enmity: the Crown and the Red Tide, the Fog Brokers and the Choir’s foes; a city is never its own', () => {
  assert.ok(citiesHostile('crown', 'confederacy'));
  assert.ok(citiesHostile('crown', 'brokers'));
  assert.ok(citiesHostile('harpoon', 'choir'));
  assert.ok(!citiesHostile('crown', 'crown'));
  assert.ok(!citiesHostile('crown', 'league'));
  assert.ok(!citiesHostile('free', 'confederacy'));
});

test('the tester’s /flag and /noboard, in HELP command for command; every new word in Russian', () => {
  const { game } = makeGame();
  join(game, 'Tess Tester');
  const s = sess(game, 'Tess Tester');
  sea(game, s, 30_000, 'gravewater');
  assert.match(runAdmin(game, s, '/flag')!, /^Colours: the city flag of /);
  assert.match(runAdmin(game, s, '/flag pirate')!, /^Colours: the pirate flag of/);
  assert.equal(s.profile!.pvp.flag, 'pirate');
  assert.match(runAdmin(game, s, '/flag faction confederacy')!, /the city flag of The Red Tide Confederacy/);
  assert.equal(s.profile!.pvp.city, 'confederacy');
  assert.match(runAdmin(game, s, '/flag green')!, /^Usage/);
  assert.match(runAdmin(game, s, '/noboard on')!, /Boarding off/);
  assert.equal(s.profile!.noBoard, true);
  assert.match(runAdmin(game, s, '/noboard off')!, /Boarding on/);
  const help = runAdmin(game, s, '/help')!;
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the HELP has its Russian twin');
  const cmds = (x: string) => [...x.matchAll(/\/[a-z]+/g)].map((m) => m[0]);
  assert.deepEqual(cmds(ru), cmds(help), 'command for command');
  for (const c of ['/flag', '/noboard']) assert.ok(cmds(help).includes(c), c);
  // Every line the colours' code says has its Russian.
  const table = serverTable();
  const lines = extract().filter((p) => /neutral colours|pirate flag|city’s colours|new colours|Boarding is|Boarding o|Colours|colours are|at peace with yours|on her ship|^Usage: \/(flag|noboard)/.test(p));
  assert.ok(lines.length >= 20, `${lines.length} lines`);
  assert.deepEqual(lines.filter((p) => table[p] === undefined), []);
  for (const v of Object.values(SERVER_RU_FLAGS)) assert.ok(!/[A-Za-z]{3,}/.test(v.replace(/\{\d+\}/g, '').replace(/\/(flag|noboard) \[?[a-z|\]]*( \[город\])?/g, '').replace(/on\|off/g, '')), v);
  // The admin's answers read whole in Russian.
  applyDataLocale('ru');
  setLang('ru');
  try {
    const said = serverText(runAdmin(game, s, '/flag')!);
    assert.ok(!/[A-Za-z]{3,}/.test(said), said);
  } finally {
    setLang('en');
    applyDataLocale('en');
  }
  // The interface's words: twins, no Latin left in the Russian.
  assert.deepEqual(Object.keys(FL_RU).sort(), Object.keys(FL_EN).sort());
  for (const [k, v] of Object.entries(FL_RU)) assert.ok(!/[A-Za-z]{2,}/.test(v.replace(/\{\w+\}/g, '')), `${k}: ${v}`);
});
