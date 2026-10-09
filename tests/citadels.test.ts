// docs/19 E4–E8: the twelve citadels and the Throne war — placed by the seed, two to each wild sea; the siege on the
// hexes (the wall line, the gate the garrison's alone, the moat that stops, the catapult and the ship's broadside, the
// towers, cover behind the wall, the garrison's when the rounds run out); the balance of a siege; the server's
// declaration and summons, the windows, the assault one at a time and once each, what is cut staying cut, the
// citadel taken and held (tax, points, men left in its garrison, its titan), the week's growth, the season's Masters
// of the Throne; the islands kept from claims; Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, WORLD_SEED } from '../shared/src/constants.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import {
  CITADELS, CIT_APART, CIT_MIN_RADIUS, CIT_OWN, CIT_POINTS, CIT_REGIONS, CIT_TOWER, THRONE_PENNANT, THRONE_TITLE, buildCitadels, citGarrison, citNextWindow, citTax, citWindowAt, citWindows,
} from '../shared/src/data/citadels.ts';
import { SIEGE, hexIndex, hexX, insideWalls } from '../shared/src/data/tactical.ts';
import { TITAN_PRICE } from '../shared/src/data/titans.ts';
import { Rng } from '../shared/src/rng.ts';
import { generateWorld, legacyWorld } from '../shared/src/world/worldgen.ts';
import { openWater } from '../shared/src/data/advmap.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { claimBlock } from '../server/src/game/baseclaim.ts';
import { citView, isCastellan, stepCitadels } from '../server/src/game/citadels.ts';
import { act, blowParts, newBattle, quickFinish, reachOf, siegeLeft } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { isTrialShip } from '../server/src/game/throne.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { equalSiege, evenShare, siegeTaken } from './balance/citadels.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

// ------------------------------------------------------------------ E4: where they stand

test('twelve citadels by the seed alone: two to each wild sea, on great islands apart, a citadel of ⚓10 and a fort of ⚓9', () => {
  const w = generateWorld(WORLD_SEED);
  const cits = buildCitadels(w);
  assert.equal(cits.length, CITADELS);
  const base = legacyWorld(w);
  for (const r of CIT_REGIONS) {
    const two = cits.filter((c) => c.region === r);
    assert.equal(two.length, 2, r);
    assert.deepEqual(two.map((c) => c.level), [10, 9]);
    assert.ok(Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y) >= CIT_APART - 3000, `${r}: apart`);
  }
  for (const c of cits) {
    const is = base.islands[c.island];
    assert.equal(is.name, c.isle);
    assert.ok(!is.portId && !is.minor && is.radius >= CIT_MIN_RADIUS, c.isle);
    assert.ok(openWater(w, c.x, c.y), `${c.isle}: the anchorage in open water`);
    assert.ok(Math.hypot(c.fx - c.x, c.fy - c.y) < is.radius + 600, `${c.isle}: the fort behind its anchorage`);
  }
  // The same sea, the same citadels.
  assert.deepEqual(buildCitadels(generateWorld(WORLD_SEED)).map((c) => [c.island, c.x, c.y]), cits.map((c) => [c.island, c.x, c.y]));
  assert.equal(new Set(cits.map((c) => c.island)).size, CITADELS);
});

test('a garrison of the sixth and seventh tiers in seven stacks; an owned citadel’s own guard a share of it; two windows a week', () => {
  const g = citGarrison(10);
  assert.equal(g.length, 7);
  assert.ok(g.every((x) => ['guard', 'life_guard', 'drowned', 'deep_spawn'].includes(x.u)));
  const own = citGarrison(10, CIT_OWN).reduce((a, x) => a + x.n, 0), full = g.reduce((a, x) => a + x.n, 0);
  assert.ok(Math.abs(own / full - CIT_OWN) < 0.03);
  assert.ok(citGarrison(9).reduce((a, x) => a + x.n, 0) < full, 'a fort a lighter garrison');
  for (let id = 0; id < CITADELS; id++) {
    const ws = citWindows(id, 100);
    assert.equal(ws.length, 2);
    for (const x of ws) assert.equal(x.end - x.start, 2 * 3_600_000);
    assert.ok(ws[1].start - ws[0].start >= 3 * 86_400_000 && ws[1].start - ws[0].start <= 4 * 86_400_000, 'three or four days apart');
    assert.deepEqual(citWindowAt(id, ws[0].start + 1000), ws[0]);
    assert.equal(citWindowAt(id, ws[0].start - 1000), null);
    assert.deepEqual(citNextWindow(id, ws[0].start - 3_600_000), ws[0]);
  }
});

// ------------------------------------------------------------------ E5: the siege on the hexes

const side = (army: { u: string; n: number }[], captain: TacSideInput['captain'] = null): TacSideInput => ({
  name: 'x', ship: 'y', captain, hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ u: x.u as never, n: x.n, src: x.u as never })), officers: [], skill: 3,
  morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: true, ...(captain ? {} : { noBook: true }),
});

test('the siege field: the wall line bars the besiegers, the gate opens for the garrison alone, the moat stops a stack', () => {
  const bt = newBattle(side([{ u: 'cutthroat', n: 20 }]), side([{ u: 'life_guard', n: 10 }]), 5, 0, new Rng(5), { siege: { type: 'rocky', catapult: 0, tower: 0 } });
  for (let y = 0; y < 9; y++) {
    const c = bt.cells[hexIndex(SIEGE.wallX, y)];
    assert.equal(c, y === SIEGE.gateY ? 'G' : SIEGE.towers.includes(y) ? 'T' : 'X');
    assert.equal(bt.cells[hexIndex(SIEGE.moatX, y)], y === SIEGE.gateY ? 'D' : 'O');
  }
  const a = bt.stacks.find((s) => s.side === 0)!, d = bt.stacks.find((s) => s.side === 1)!;
  assert.ok(insideWalls(d.hex), 'the garrison stands within');
  // The besiegers reach no hex within the walls, nor the gate; a cutthroat stepping into the moat stops there.
  a.hex = hexIndex(SIEGE.moatX - 1, 2);
  const r = reachOf(bt, a);
  assert.ok([...r.keys()].every((i) => hexX(i) < SIEGE.wallX), 'no way in');
  assert.ok(r.has(hexIndex(SIEGE.moatX, 2)), 'into the moat');
  // A breach: from before the moat she reaches the moat but not the rubble beyond it this turn; from the moat, in.
  bt.cells[hexIndex(SIEGE.wallX, 2)] = 'r';
  assert.ok(!reachOf(bt, a).has(hexIndex(SIEGE.wallX, 2)), 'the moat stops her');
  a.hex = hexIndex(SIEGE.moatX, 2);
  const r2 = reachOf(bt, a);
  assert.ok(r2.has(hexIndex(SIEGE.wallX, 2)) && [...r2.keys()].some((i) => insideWalls(i)), 'from the moat through the breach');
  // The gate: the garrison's way out, nobody else's.
  d.hex = hexIndex(SIEGE.wallX + 1, SIEGE.gateY);
  assert.ok(reachOf(bt, d).has(hexIndex(SIEGE.wallX, SIEGE.gateY)), 'the garrison through its gate');
  a.hex = hexIndex(SIEGE.moatX, SIEGE.gateY);
  assert.ok(!reachOf(bt, a).has(hexIndex(SIEGE.wallX, SIEGE.gateY)), 'not the besiegers');
});

test('the catapult and the broadside breach the wall, the towers shoot each round, shots from without at half, the rounds run out for the garrison', () => {
  const me = armyForLevel(10, 600, 7, 'player');
  const bt = newBattle(side(me, 'corsair'), side(citGarrison(10), 'admiral'), 11, 0, new Rng(11), { siege: { type: 'rocky', bombard: 4, catapult: 2, tower: CIT_TOWER } });
  const guns = bt.log.filter((e) => e.k === 'siege' && e.id === 'gun');
  assert.equal(guns.length, 4, 'the broadside before the assault');
  assert.ok(bt.log.some((e) => e.k === 'siege' && e.id === 'catapult'), 'the catapult in the first round');
  const towers = bt.log.filter((e) => e.k === 'siege' && e.id === 'tower');
  assert.equal(towers.length, 2, 'both towers shoot as the round opens');
  assert.ok(towers.every((e) => (e.dmg ?? 0) > 0 && e.t !== undefined));
  const hp = siegeLeft(bt)!;
  assert.ok(hp.reduce((a, x) => a + x, 0) < 9 * SIEGE.hp, 'stones knocked out');
  for (let y = 0; y < 9; y++) if (hp[y] <= 0 && y !== 1 && y !== 7) assert.equal(bt.cells[hexIndex(SIEGE.wallX, y)], 'r', 'a breach is rubble');
  // A shot from without the walls at a stack within: half (the same shot in the open field whole).
  const shooter = bt.stacks.find((s) => s.side === 0 && s.sp.includes('shooter'))!;
  const inside = bt.stacks.find((s) => s.side === 1 && insideWalls(s.hex))!;
  const cover = blowParts(bt, shooter, inside, 'shot').mul;
  const open = newBattle(side(me, 'corsair'), side(citGarrison(10), 'admiral'), 11, 0, new Rng(11), { land: 'rocky' });
  const s2 = open.stacks.find((s) => s.id === shooter.id)!, t2 = open.stacks.find((s) => s.id === inside.id)!;
  s2.hex = shooter.hex;
  t2.hex = inside.hex;
  assert.ok(Math.abs(cover / blowParts(open, s2, t2, 'shot').mul - SIEGE.cover) < 0.15, `cover ${cover}`);
  // Rounds run out: the garrison's, though the besiegers hold more of their strength.
  const tiny = newBattle(side([{ u: 'sailor', n: 400 }]), side([{ u: 'deckhand', n: 2 }]), 3, 0, new Rng(3), { siege: { type: 'rocky', catapult: 0, tower: 0 } });
  tiny.heroes[0].auto = true;
  tiny.heroes[1].auto = true;
  // The besiegers' sailors never get in: the gate and the wall whole, nothing to breach them.
  quickFinish(tiny, 0, new Rng(3));
  assert.equal(tiny.over?.winner, 1);
  assert.equal(tiny.over?.why, 'rounds');
});

test('balance: a lone captain never takes a full garrison, three now and then, five nearly always; equal strength 35–45%', () => {
  assert.equal(siegeTaken(1, 1.3, 12), 0, 'alone, never');
  const three = siegeTaken(3, 1.3, 24), five = siegeTaken(5, 1.3, 12);
  assert.ok(three >= 0.2 && three <= 0.85, `three: ${three}`);
  assert.ok(five >= 0.9, `five: ${five}`);
  const eq = equalSiege(1.3, 60, {}, evenShare(1.3, 40));
  assert.ok(eq >= 0.3 && eq <= 0.5, `equal strength: ${eq}`);
});

// ------------------------------------------------------------------ the server: E5–E8

const T0 = Date.UTC(2026, 9, 12, 12, 0, 0); // a Monday noon
const inbox = (s: PlayerSession) => (s as unknown as { conn: { inbox: { t: string; msg?: string }[] } }).conn.inbox;
const toasts = (s: PlayerSession, from = 0) => inbox(s).slice(from).filter((m) => m.t === 'toast').map((m) => m.msg ?? '');
const push = (s: PlayerSession, m: unknown) => (s as unknown as { conn: { push: (m: unknown) => void } }).conn.push(m);

function capped(game: Game, name: string): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'man_o_war', 10);
  s.profile!.level = MAX_LEVEL;
  s.ship!.setArmy(armyForLevel(10, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  if (s.ship!.docked) game.undock(s);
  return s;
}

function world(): { game: Game; clock: { t: number } } {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const clock = { t: T0 };
  game.wallNow = () => clock.t;
  return { game, clock };
}

test('a siege declared an hour ahead for a window: the holders summoned; no assault before the window, one at a time and once each in it; what was cut stays cut', () => {
  const { game, clock } = world();
  const holder = capped(game, 'Keep Holder'), att = capped(game, 'Wall Breaker'), mate = capped(game, 'Second Breaker');
  const id = 8;
  assert.match(runAdmin(game, holder, '/cit guild') ?? '', /^Your guild: \[/);
  runAdmin(game, holder, `/cit own ${id + 1}`);
  runAdmin(game, att, '/cit guild');
  const g = game.guilds.of(game, att.accountId)!;
  // A second captain of the besiegers' guild.
  g.members.push({ account: mate.accountId, name: mate.name, rank: 'captain', joined: clock.t, out: { day: 0, value: 0 } });
  game.guilds.index(mate.accountId, g.id);
  let v = citView(game, att)!.rows[id];
  assert.equal(v.tag, game.guilds.of(game, holder.accountId)!.tag);
  assert.equal(v.why.declare, null);
  const n0 = inbox(holder).length;
  push(att, { t: 'throne', action: 'cit', op: 'declare', cit: id });
  assert.ok(toasts(holder, n0).some((m) => m.startsWith(`Summons: [${g.tag}] besieges the Citadel of`)), toasts(holder, n0).join(' | '));
  assert.ok(holder.profile!.log?.some((e) => e.kind === 'siege' && e.a[0] === g.tag), 'a line in the holder’s log');
  assert.ok(game.guilds.of(game, holder.accountId)!.log.some((l) => l.text.startsWith('Summons:')), 'the holders’ journal');
  v = citView(game, att)!.rows[id];
  assert.ok(v.siegeOf && v.siegeOf.mine && v.siegeOf.start - clock.t >= 3_600_000, 'for a window an hour ahead at the least');
  // Before the window: no assault.
  runAdmin(game, att, `/cit go ${id + 1}`);
  runAdmin(game, mate, `/cit go ${id + 1}`);
  steps(game, 2);
  assert.match(citView(game, att)!.rows[id].why.assault ?? '', /^The window opens in/);
  // In the window: the first assault — the castellan alongside, the siege's field.
  clock.t = v.siegeOf!.start + 60_000;
  steps(game, 21);
  assert.equal(citView(game, att)!.rows[id].why.assault, null);
  push(att, { t: 'throne', action: 'cit', op: 'assault', cit: id });
  const bt = att.ship!.boarding?.fight.tac;
  assert.ok(bt?.siege, 'the battle before the walls');
  const cas = game.ships.get(att.ship!.boarding!.with)!;
  assert.ok(isCastellan(cas) && isTrialShip(cas), 'no artifact on her, none of hers joins');
  assert.equal(citView(game, mate)!.rows[id].why.assault, 'Another captain of the siege is at the walls now.');
  quickFinish(bt, game.now, new Rng(4));
  steps(game, 400);
  assert.equal(att.ship!.boarding, null);
  assert.equal(game.ships.has(cas.id), false);
  v = citView(game, att)!.rows[id];
  assert.ok(v.share < 100 * CIT_OWN + 1, `what was cut stays cut: ${v.share}%`);
  assert.equal(v.why.assault, 'You have assaulted it once in this siege.');
  assert.deepEqual(v.siegeOf!.assaults, ['Wall Breaker']);
  // The second captain: the next assault meets what is left (and the walls as they were left).
  const wallsLeft = v.hp;
  push(mate, { t: 'throne', action: 'cit', op: 'assault', cit: id });
  const bt2 = mate.ship!.boarding!.fight.tac!;
  const left = bt2.stacks.filter((s) => s.side === 1).reduce((a, s) => a + s.count, 0);
  assert.equal(left, v.garrison.reduce((a, x) => a + x.n, 0), 'the garrison as it was left');
  for (let y = 0; y < 9; y++) if (wallsLeft[y] <= 0 && y !== 1 && y !== 7) assert.equal(bt2.cells[hexIndex(SIEGE.wallX, y)], 'r');
  // The garrison strikes: the citadel is the besiegers'.
  act(bt2, 1, { a: 'surrender' }, game.now, new Rng(5));
  steps(game, 400);
  v = citView(game, att)!.rows[id];
  assert.equal(v.tag, g.tag);
  assert.ok(v.mine);
  assert.equal(v.siegeOf, undefined);
  assert.equal(citView(game, att)!.guild!.points, CIT_POINTS.take);
  assert.ok(((game.db.getKv<{ msg: string }[]>('world_chronicle') ?? []).some((x) => x.msg === `[${g.tag}] takes the Citadel of ${v.isle}.`)));
});

test('holding a citadel: the tax and the points each hour, men left in its garrison, its titan once a week, the garrison grown each week', () => {
  const { game, clock } = world();
  const s = capped(game, 'Castle Keeper');
  runAdmin(game, s, '/cit guild');
  runAdmin(game, s, '/cit own 3');
  const g = game.guilds.of(game, s.accountId)!;
  const id = 2;
  const treasury = g.treasury;
  steps(game, 21);
  clock.t += 3 * 3_600_000;
  steps(game, 21);
  const lv = buildCitadels(game.world)[id].level;
  assert.equal(g.treasury - treasury, 3 * citTax(lv), 'three hours of its sea’s tax');
  assert.equal(citView(game, s)!.guild!.points, CIT_POINTS.take + 3 * CIT_POINTS.hour[lv]);
  // Men left in the garrison from her ship lying off it.
  runAdmin(game, s, `/cit go ${id + 1}`);
  steps(game, 2);
  const before = citView(game, s)!.rows[id].garrison.reduce((a, x) => a + x.n, 0);
  const crew = s.ship!.crew;
  const u = s.ship!.army[0].u;
  push(s, { t: 'throne', action: 'cit', op: 'leave', cit: id, u, n: 10 });
  assert.equal(s.ship!.crew, crew - 10);
  assert.equal(citView(game, s)!.rows[id].garrison.reduce((a, x) => a + x.n, 0), before + 10);
  // Its titan: a slot made, the price paid from her purse and her hold; once a week.
  s.ship!.setArmy(s.ship!.army.slice(0, s.ship!.armySlots - 1));
  s.profile!.gold = 100_000;
  s.ship!.cargo.pearls = 12;
  push(s, { t: 'throne', action: 'cit', op: 'titan', cit: id, u: 'titan_whale' });
  assert.ok(s.ship!.army.some((x) => x.u === 'titan_whale'), 'the titan aboard');
  assert.equal(s.profile!.gold, 100_000 - TITAN_PRICE.silver);
  assert.equal(s.ship!.cargo.pearls ?? 0, 2);
  assert.equal(citView(game, s)!.rows[id].titan, false);
  assert.equal(citView(game, s)!.rows[id].why.titan, 'Its titan of the week is taken: another rises next week.');
  // The week turns: its titan again, its own guard filled (the men she left kept).
  runAdmin(game, s, `/cit lose ${id + 1}`);
  clock.t += 7 * 86_400_000;
  steps(game, 21);
  const row = citView(game, s)!.rows[id];
  assert.equal(row.titan, true);
  for (const x of citGarrison(lv, CIT_OWN)) assert.ok(row.garrison.filter((y) => y.u === x.u).reduce((a, y) => a + y.n, 0) >= x.n, x.u);
  // Nobody claims or rents its island.
  const isl = game.world.islands[buildCitadels(game.world)[id].island];
  assert.equal(claimBlock(game, isl, s.accountId), 'A citadel of the Throne war stands on that island.');
});

test('the Throne war’s season: the guild with the most points are the Masters of the Throne — the Pantheon, the title, the pennant, the ward', () => {
  const { game } = world();
  const a = capped(game, 'Throne Taker'), b = capped(game, 'Runner Up');
  runAdmin(game, a, '/cit guild');
  runAdmin(game, b, '/cit guild');
  runAdmin(game, a, '/cit own 1');
  runAdmin(game, b, '/cit own 2');
  runAdmin(game, a, '/cit points 300');
  const ga = game.guilds.of(game, a.accountId)!;
  const war = citView(game, b)!.war;
  assert.equal(war[0].tag, ga.tag);
  assert.equal(war[0].you, undefined);
  assert.match(runAdmin(game, a, '/cit season') ?? '', /are the Masters of the Throne/);
  assert.ok(a.profile!.titles.includes(THRONE_TITLE[0]), 'the title');
  assert.ok(a.profile!.pennants.includes(THRONE_PENNANT), 'the pennant');
  assert.ok(!b.profile!.titles.includes(THRONE_TITLE[0]));
  const v = citView(game, a)!;
  assert.equal(v.champion?.tag, ga.tag);
  assert.equal(v.war.length, 0, 'the table begins again');
  // The ward on the Masters' citadels the season after: a stone more in every wall.
  const ward = v.rows[0];
  assert.ok(ward.crown);
  assert.ok(ward.max.every((m) => m === SIEGE.hp + 1), 'a stone more');
  assert.ok(v.rows[1].max.every((m) => m === SIEGE.hp), 'not the others’');
  // The Hall of the Throne in the Pantheon.
  stepCitadels(game);
  assert.ok((game.db.getKv<unknown[]>('citadels') as unknown as { pantheon: { tag: string }[] }).pantheon.some((m) => m.tag === ga.tag));
});

test('the citadels’ words read in Russian', () => {
  setLang('ru');
  try {
    for (const line of [
      'Your guild besieges the Citadel of Idolcourt. The window opens in 3 h 20 min.',
      'Summons: [ABC] besieges the Fort of Marrowspine. The window opens in 45 min.',
      'Castellan Gaunt holds the Citadel of Idolcourt: the assault begins before its walls.',
      'The garrison of the Citadel of Idolcourt holds. Your assault cut 37% of it; what is left of it and of its walls waits for the next of your siege.',
      'The window of the Fort of Marrowspine is open: assault it before 2 h 0 min are out.',
      'The siege of the Citadel of Whalebone is lifted: its garrison held.',
      'Your guild are the Masters of the Throne: the Pantheon, a title and the Throne’s pennant are yours.',
      'Come to its anchorage: the assault begins before its gate.',
      'A citadel of the Throne war stands on that island.',
      'Masters of the Throne',
      'The Hall of the Throne',
    ]) {
      const ru = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(ru.replace(/ABC/g, '')), `${line} → ${ru}`);
    }
  } finally {
    setLang('en');
  }
});
