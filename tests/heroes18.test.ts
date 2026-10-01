// docs/18 I (items 1–12): the hero's own battle identity by her path — the innate moves, the six schools (home school
// cheaper and stronger), the six path books, Stamina beside Will, the ultimate from level 20, the talents that lift
// the book, the officers' abilities, the named captains of the sea with paths, the Path book's view, scrolls and
// another path's page at a guild, the balance, and a line in the feed for every use.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { ORDERS, SCHOOLS, guildPrice, heroBattle, npcHeroBattle, orderRes, primsAtLevel, startingOrders, zeroPrims } from '../shared/src/data/hero.ts';
import type { HeroBattle } from '../shared/src/data/hero.ts';
import {
  FOREIGN_COST, HOME_MUL, INNATE, PAGE_UNLOCK, PATH_IDS, PATH_KIND, PATH_PAGES, PATH_PAGE_IDS, PATH_SCHOOL, SCHOOL_KIND, TALENT_BOOK, ULTIMATE, ULT_LEVEL, pathBook, pathPagesAt, pathPower,
  stamMaxOf, talentBook,
} from '../shared/src/data/paths.ts';
import { TALENTS_BY_ID } from '../shared/src/data/talents.ts';
import type { TreeId } from '../shared/src/data/talents.ts';
import { TAC_ORDER_OF, TAC_SPELLS } from '../shared/src/data/tactical.ts';
import { canShoot, castMove, castSpell, modsOf, moralePoints, newBattle, quickFinish, spellCost, spellRes, tacStats, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../server/src/game/tacbattle.ts';
import { act } from '../server/src/game/tacbattle.ts';
import { afterBattle, heroInput, heroOf, heroSecond, heroView } from '../server/src/game/hero.ts';
import { foreignAt, giveScroll, learnForeign, npcPathOf, stamMax } from '../server/src/game/pathbook.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { SERVER_RU_PATH } from '../client/src/lang/server.ru.path.ts';
import { EN as TAC_EN, RU as TAC_RU } from '../client/src/lang/ui/tactical.ts';
import { pirateById, namedPirates } from '../shared/src/data/pirates.ts';
import type { Game } from '../server/src/game/Game.ts';
import { join, makeGame } from './helpers.ts';

const ARMY: ArmyStack[] = [{ u: 'marine', n: 30 }, { u: 'sailor', n: 40 }, { u: 'musketeer', n: 16 }];
const side = (army: ArmyStack[], hero?: HeroBattle, o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army,
  officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...(hero ? { hero } : {}), ...o,
});
/** A captain of her path at her level with her book (docs/18). */
const pathHb = (path: CaptainId, level = 30, o: Partial<{ talents: Record<string, number>; scrolls: Record<string, number>; stam: number }> = {}) => {
  const prim = primsAtLevel(path, 7, level);
  return heroBattle(prim, [], null, startingOrders(path), prim.will * 10, { path, level, ...o });
};
const battle = (a: HeroBattle, b?: HeroBattle, seed = 5): TacBattle => newBattle(side(ARMY, a, { captain: a.path ?? null }), side(ARMY, b), seed, 0, new Rng(seed));
const men = (bt: TacBattle, s: 0 | 1) => bt.stacks.filter((x) => x.side === s).reduce((n, x) => n + x.count, 0);

function captain(game: Game, name: string, cap: CaptainId = 'corsair') {
  join(game, name, cap);
  const s = game.sessionByName(name)!;
  return { s, p: s.profile!, ship: s.ship! };
}

// ------------------------------------------------------------------ 1. the innate moves

test('1. every path has one innate battle move, once a battle and free; each does what the doc says', () => {
  for (const c of PATH_IDS) {
    const hb = pathHb(c, 12);
    const bt = battle(hb);
    const h = bt.heroes[0];
    const will = h.mana, stam = h.stam;
    const foe = bt.stacks.find((x) => x.side === 1)!;
    const own = bt.stacks.find((x) => x.side === 0)!;
    const target = INNATE[c].fx.target === 'enemy' ? foe.id : INNATE[c].fx.target === 'own' ? own.id : undefined;
    if (c === 'drowned') for (const x of bt.stacks) if (x.side === 0) x.count = Math.ceil(x.count / 2);
    const before = { foe: men(bt, 1), own: men(bt, 0), morale: moralePoints(bt, 0) };
    assert.equal(castMove(bt, 0, 'innate', target, new Rng(3)), null, c);
    assert.equal(h.mana, will, `${c}: no will`);
    assert.equal(h.stam, stam, `${c}: no stamina`);
    assert.equal(castMove(bt, 0, 'innate', target, new Rng(3)), "Your path's move is spent this battle", `${c}: once`);
    const ev = bt.log.find((e) => e.k === 'innate');
    assert.ok(ev && ev.id === c, `${c}: a line in the feed`);
    if (c === 'corsair') assert.ok(men(bt, 1) < before.foe, 'Last Volley cuts her stack down');
    if (c === 'smuggler') assert.ok(bt.stacks.filter((x) => x.side === 1 && x.shots > 0).every((x) => !canShoot(bt, x)), 'Smoke Screen blinds her shooters');
    if (c === 'reaver') assert.ok(bt.heroes[0].free > 0, 'Blood Harvest: the first blows unanswered');
    if (c === 'navigator') assert.ok(own.again > 0 || bt.queue.filter((id) => id === own.id).length >= 1, 'Following Squall: the stack acts twice');
    if (c === 'drowned') assert.ok(men(bt, 0) > before.own, 'Call of the Depths: the fallen rise');
    if (c === 'admiral') assert.ok(moralePoints(bt, 0) >= before.morale && modsOf(bt, 0).morale > 0, 'The Line: morale up');
  }
  // Blood Harvest: her answer does not come.
  const bt = battle(pathHb('reaver', 12));
  castMove(bt, 0, 'innate', undefined, new Rng(1));
  const a = bt.stacks.find((x) => x.side === 0 && x.unit === 'marine')!, t = bt.stacks.find((x) => x.side === 1 && x.unit === 'marine')!;
  t.hex = a.hex + 1;
  bt.active = a.id;
  const hp0 = a.count;
  act(bt, 0, { a: 'attack', target: t.id, from: a.hex }, 0, new Rng(2));
  assert.equal(a.count, hp0, 'no answer to the first blow');
});

// ------------------------------------------------------------------ 2. physical and magical schools

test('2. six schools, three physical and three magical; each path a home school, cheaper and stronger; another path\'s page dearer', () => {
  assert.equal(SCHOOLS.length, 6);
  assert.equal(SCHOOLS.filter((s) => SCHOOL_KIND[s] === 'phys').length, 3);
  for (const c of ['corsair', 'reaver', 'admiral'] as const) assert.equal(PATH_KIND[c], 'phys', c);
  for (const c of ['navigator', 'drowned', 'smuggler'] as const) assert.equal(PATH_KIND[c], 'magic', c);
  assert.equal(new Set(PATH_IDS.map((c) => PATH_SCHOOL[c])).size, 6, 'six home schools');
  const prim = { ...zeroPrims(), atk: 5, def: 5, pow: 5, will: 5 };
  const book = ['grenades', 'brine_mend', 'dr_brine_kiss'] as const;
  const plain = heroBattle(prim, [], null, [...book], 50, { path: null, level: 30 });
  const corsair = heroBattle(prim, [], null, [...book], 50, { path: 'corsair', level: 30 });
  assert.ok(corsair.mul.fire > plain.mul.fire && Math.abs(corsair.mul.fire / plain.mul.fire - HOME_MUL) < 1e-9, 'the home school stronger');
  assert.ok(corsair.cost.grenades! < plain.cost.grenades! || plain.cost.grenades! <= 2, 'and cheaper');
  assert.ok(corsair.cost.dr_brine_kiss! > ORDERS.dr_brine_kiss.cost * (FOREIGN_COST - 0.2), 'another path\'s page dearer');
  // H2's common pages keep their schools and their will; the paths' physical pages spend stamina.
  assert.equal(orderRes('grenades'), 'will');
  assert.equal(orderRes('cs_chain_shot'), 'stam');
  assert.equal(orderRes('cs_spotter'), 'will');
});

// ------------------------------------------------------------------ 3. the path books

test('3. six path books of six pages, levels 1–5, three physical and three magical; fresh pages open by level', () => {
  assert.equal(PATH_PAGE_IDS.length, 36);
  for (const c of PATH_IDS) {
    const b = pathBook(c);
    assert.equal(b.length, 6, c);
    assert.equal(b.filter((id) => SCHOOL_KIND[PATH_PAGES[id].school] === 'phys').length, 3, `${c}: three physical`);
    assert.deepEqual([...new Set(b.map((id) => PATH_PAGES[id].level))].sort(), [1, 2, 3, 4, 5], `${c}: levels 1–5`);
    assert.ok(pathPagesAt(c, 1).length >= 1 && pathPagesAt(c, 1).length < pathPagesAt(c, 40).length, `${c}: more pages with levels`);
    for (const id of b) assert.ok(TAC_SPELLS[id] && ORDERS[id]?.path === c, `${id} is an order of the book and fought in the battle`);
  }
  assert.equal(pathPagesAt('corsair', PAGE_UNLOCK[5]).length, 6);
  const hb = pathHb('drowned', 30);
  assert.ok(pathPagesAt('drowned', 30).every((id) => hb.book.includes(id)), 'her open pages are in her battle book');
  assert.ok(!hb.book.includes(pathBook('drowned').find((id) => PATH_PAGES[id].level === 5)!), 'the fifth level waits');
  // Every page casts and lands (its line in the feed).
  for (const id of PATH_PAGE_IDS) {
    const c = PATH_PAGES[id].path;
    const bt = battle(pathHb(c, 40));
    const t = PATH_PAGES[id].fx.target === 'enemy' ? bt.stacks.find((x) => x.side === 1)!.id : PATH_PAGES[id].fx.target === 'own' ? bt.stacks.find((x) => x.side === 0)!.id : undefined;
    assert.equal(castSpell(bt, 0, id, t, new Rng(4)), null, id);
    assert.ok(bt.log.some((e) => e.k === 'spell' && e.id === id), `${id}: logged`);
  }
});

// ------------------------------------------------------------------ 4. stamina beside will

test('4. Stamina: physical pages spend it, magical ones will; a share comes back each round; rest fills it', () => {
  const hb = pathHb('corsair', 30);
  const bt = battle(hb);
  const h = bt.heroes[0];
  assert.equal(h.stam, hb.stamMax);
  assert.equal(spellRes(bt, 0, 'cs_chain_shot'), 'stam');
  const will0 = h.mana, st0 = h.stam;
  castSpell(bt, 0, 'cs_chain_shot', bt.stacks.find((x) => x.side === 1)!.id, new Rng(1));
  assert.equal(h.stam, st0 - spellCost(bt, 0, 'cs_chain_shot'));
  assert.equal(h.mana, will0, 'the will untouched');
  h.stam = 0;
  bt.round++;
  bt.heroes[0].spells.find((x) => x.id === 'cs_chain_shot')!.ready = 0;
  assert.equal(castSpell(bt, 0, 'cs_chain_shot', bt.stacks.find((x) => x.side === 1)!.id, new Rng(1)), 'Not enough stamina');
  assert.ok(stamMaxOf(10, 10) > stamMaxOf(2, 2), 'Attack and Defense make it');
  // Each round a share back.
  const b2 = battle(pathHb('reaver', 30));
  b2.heroes[0].stam = 0;
  quickFinish(b2, 0, new Rng(9));
  assert.ok(b2.round < 2 || b2.heroes[0].stam > 0, 'it came back');
  // Her stamina after the battle stays spent, and comes back with rest; a port fills it.
  const { game } = makeGame();
  const { s, p, ship } = captain(game, 'Rester', 'reaver');
  ship.docked = null;
  afterBattle(game, ship, heroOf(p).mana, [], 0, 3, []);
  assert.equal(heroOf(p).stam, 3);
  heroSecond(game, s);
  assert.ok(heroOf(p).stam! > 3 && heroOf(p).stam! < stamMax(p), 'rest at sea');
  assert.equal(heroView(p).stamMax, stamMax(p));
  ship.docked = game.world.ports[0].id;
  heroSecond(game, s);
  assert.equal(heroOf(p).stam, undefined, 'whole in port');
  ship.docked = null;
});

// ------------------------------------------------------------------ 5. the ultimate

test('5. the ultimate opens at level 20: once a battle, beside the round\'s order', () => {
  const low = battle(pathHb('corsair', ULT_LEVEL - 1));
  assert.equal(castMove(low, 0, 'ult', undefined, new Rng(1)), 'The ultimate opens at level 20');
  assert.equal(viewOf(low, 0, 0, true).heroes[0].ult, 'locked');
  for (const c of PATH_IDS) {
    const bt = battle(pathHb(c, 40));
    const foe0 = men(bt, 1);
    const t = ULTIMATE[c].fx.target === 'none' ? undefined : bt.stacks.find((x) => x.side === (ULTIMATE[c].fx.target === 'own' ? 0 : 1))!.id;
    assert.equal(castSpell(bt, 0, startingOrders(c)[1] as never, bt.stacks.find((x) => x.side === 1)!.id, new Rng(2)), null, `${c}: the round's order`);
    assert.equal(castMove(bt, 0, 'ult', t, new Rng(2)), null, `${c}: and the ultimate beside it`);
    assert.equal(castMove(bt, 0, 'innate', undefined, new Rng(2)), 'One path move a round');
    assert.equal(viewOf(bt, 0, 0, true).heroes[0].ult, 'used');
    assert.ok(bt.log.some((e) => e.k === 'ult' && e.id === c), `${c}: logged`);
    if (c === 'corsair') assert.ok(men(bt, 1) < foe0, "Hell's Broadside hurts every stack");
  }
});

// ------------------------------------------------------------------ 6. talents

test('6. two or three nodes in every tree lift the path book; their sea side is untouched', () => {
  const by = new Map<TreeId | 'bridge', number>();
  for (const id of Object.keys(TALENT_BOOK)) {
    const t = TALENTS_BY_ID[id];
    assert.ok(t, `${id} is a talent`);
    by.set(t.tree, (by.get(t.tree) ?? 0) + 1);
  }
  assert.equal(by.size, 10, 'every tree');
  for (const [tree, n] of by) assert.ok(n >= 2 && n <= 3, `${tree}: ${n}`);
  const lift = talentBook({ brd_warlord: 2, gun_crew_drill: 1, abs_rising_dead: 1 });
  assert.equal(lift.stam, 10);
  const plain = pathHb('reaver', 30), lifted = pathHb('reaver', 30, { talents: { brd_warlord: 2, cmd_drill_master: 2, brd_blooded: 1 } });
  assert.ok(lifted.stamMax! > plain.stamMax! && lifted.pageMul! > plain.pageMul! && lifted.innateMul! > plain.innateMul!);
});

// ------------------------------------------------------------------ 7. officers

test('7. officers give their stacks their own small ability: the boatswain braces, the gunner a volley, the alchemist bandages', () => {
  assert.equal(TAC_ORDER_OF.boatswain, 'brace');
  assert.equal(TAC_ORDER_OF.master_gunner, 'volley');
  assert.equal(TAC_ORDER_OF.alchemist, 'bandage');
  assert.equal(TAC_ORDER_OF.sailmaker, 'canvas');
  assert.equal(TAC_ORDER_OF.harpooner, 'harpoon');
  const off = (role: 'boatswain' | 'master_gunner' | 'alchemist' | 'sailmaker' | 'harpooner') => {
    const bt = newBattle(side(ARMY, undefined, { officers: [{ id: 'o1', role, name: 'Ned Pike', level: 5, lucky: false }] }), side(ARMY), 3, 0, new Rng(3));
    const s = bt.stacks.find((x) => x.officer)!;
    if (role === 'alchemist') for (const x of bt.stacks) if (x.side === 0) x.count = Math.ceil(x.count / 2);
    bt.active = s.id;
    const before = { foe: men(bt, 1), own: men(bt, 0) };
    assert.equal(act(bt, 0, { a: 'order' }, 0, new Rng(4)), null, role);
    return { bt, s, before };
  };
  const b = off('boatswain');
  assert.ok(modsOf(b.bt, 0, b.s.id).steady && modsOf(b.bt, 0, b.s.id).taken < 0, 'braced');
  const v = off('master_gunner');
  assert.ok(men(v.bt, 1) < v.before.foe && v.bt.log.some((e) => e.k === 'shot' && e.id === 'volley'), 'a volley');
  const a = off('alchemist');
  assert.ok(men(a.bt, 0) > a.before.own, 'bandages');
  const c = off('sailmaker');
  assert.ok(modsOf(c.bt, 0).shotTaken < 0, 'wet canvas');
  const h = off('harpooner');
  assert.ok(men(h.bt, 1) < h.before.foe && h.bt.log.some((e) => e.k === 'order' && e.id === 'harpoon' && e.t !== undefined), 'the harpoon');
  for (const k of ['brace', 'volley', 'bandage', 'canvas', 'harpoon']) assert.ok(TAC_EN[`o.${k}` as keyof typeof TAC_EN] && /[а-я]/i.test(TAC_RU[`od.${k}` as keyof typeof TAC_RU]), k);
});

// ------------------------------------------------------------------ 8. the named captains of the sea

test('8. named pirates, barons and hunters fight with paths and books; the sea\'s mind gives them within its stores', () => {
  const { game } = makeGame();
  const { ship } = captain(game, 'Hunted');
  const np = namedPirates().find((x) => !x.baron)!, baron = namedPirates().find((x) => x.baron)!;
  const o = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + 200, ship.state.y, 0);
  assert.equal(npcPathOf(o), null, 'the rest of the sea walks no path');
  o.named = np.id;
  assert.ok(npcPathOf(o) && pirateById(np.id), 'a named pirate does');
  o.named = baron.id;
  assert.ok(npcPathOf(o));
  o.named = undefined;
  o.npcRole = 'hunter';
  const hp = npcPathOf(o)!;
  assert.ok(hp);
  const hb = heroInput(game, o);
  assert.equal(hb.path, hp);
  assert.ok(hb.book.some((id) => PATH_PAGES[id as keyof typeof PATH_PAGES]), 'her book has her path\'s pages');
  // The sea's mind gives her path's moves and pages, never past its stores.
  tacStats.on = true;
  tacStats.casts.clear();
  let over = 0;
  for (let k = 0; k < 12; k++) {
    const path = PATH_IDS[k % 6];
    const bt = newBattle(side(armyForLevel(5, 140, 7, 'player'), npcHeroBattle(5, path), { captain: path }), side(armyForLevel(5, 140, 7, 'player'), npcHeroBattle(5, null)), k + 1, 0, new Rng(k + 1));
    quickFinish(bt, 0, new Rng(k + 9));
    if (bt.heroes[0].stam < 0 || bt.heroes[0].mana < 0) over++;
  }
  tacStats.on = false;
  const keys = [...tacStats.casts.keys()];
  assert.equal(over, 0);
  assert.ok(keys.some((k) => k.endsWith(':innate')) && keys.some((k) => /:(cs|sm|rv|nv|dr|ad)_/.test(k)), `the sea's paths give their moves: ${keys.join(' ')}`);
});

// ------------------------------------------------------------------ 9. what she sees

test('9. the Path book view and the hero column: stamina and will, the innate move, the ultimate, the scrolls', () => {
  const { game } = makeGame();
  const { p } = captain(game, 'Reader', 'navigator');
  p.level = 24;
  const v = heroView(p);
  assert.ok(v.stamMax! > 0 && v.pages!.length === pathPagesAt('navigator', 24).length && v.lift);
  for (const id of v.pages!) assert.ok(v.costs[id]! > 0, id);
  const bt = battle(pathHb('navigator', 24), npcHeroBattle(4, 'admiral'));
  const view = viewOf(bt, 0, 0, true);
  const me = view.heroes[0], foe = view.heroes[1];
  assert.ok(me.stam !== undefined && me.mana !== undefined && me.innate === 'ready' && me.ult === 'ready' && me.path === 'navigator');
  assert.ok(foe.path === 'admiral' && foe.innate === 'ready', 'her captain\'s path in her column');
  assert.ok(me.spells.every((x) => x.res === 'stam' || x.res === 'will'));
});

// ------------------------------------------------------------------ 10. scrolls and the guild

test('10. scrolls: a page for one battle cast, free, whatever the path; another path\'s page at a guild for twice the price', () => {
  const hb = pathHb('corsair', 12, { scrolls: { dr_undertow: 1 } });
  assert.ok(hb.book.includes('dr_undertow') && hb.scroll?.dr_undertow === 1);
  const bt = battle(hb);
  assert.equal(spellCost(bt, 0, 'dr_undertow'), 0, 'free');
  assert.equal(castSpell(bt, 0, 'dr_undertow', undefined, new Rng(1)), null);
  assert.ok(bt.log.some((e) => e.k === 'spell' && e.via === 'scroll'));
  bt.round += 5;
  assert.equal(castSpell(bt, 0, 'dr_undertow', undefined, new Rng(1)), 'That scroll is read');
  assert.ok(!viewOf(bt, 0, 0, true).heroes[0].spells.some((x) => x.id === 'dr_undertow'), 'gone from the panel');
  const { game } = makeGame();
  const { s, p, ship } = captain(game, 'Scholar', 'reaver');
  const page = giveScroll(game, s, 'sm_knives')!;
  assert.equal(heroOf(p).scrolls?.[page], 1);
  afterBattle(game, ship, heroOf(p).mana, [], 0, -1, [page]);
  assert.equal(heroOf(p).scrolls?.[page], undefined, 'read and gone');
  // A guild teaches two other paths' pages at twice the price.
  const port = game.world.ports.find((x) => foreignAt(x, 'reaver')?.length)!;
  const list = foreignAt(port, 'reaver')!;
  assert.ok(list.every((x) => x.price === guildPrice(x.id) * 2 && ORDERS[x.id].path !== 'reaver'));
  assert.equal(new Set(list.map((x) => ORDERS[x.id].path)).size, 2);
  p.gold = 1e6;
  p.level = 60;
  assert.equal(learnForeign(game, s, port, list[0].id), null);
  assert.ok(heroOf(p).orders.includes(list[0].id) && heroInput(game, ship).book.includes(list[0].id as never));
  assert.match(learnForeign(game, s, port, 'rv_hook') ?? '', /own book/);
});

// ------------------------------------------------------------------ 11. balance (the full table: node tools/balance-paths.ts)

test('11. balance smoke: each path holds its own against the others and the sea at level 30 (the full table in the tool)', () => {
  const caps = PATH_IDS;
  const sl = 5, army = armyForLevel(sl, 140, 7, 'player'), pir = armyForLevel(sl, 140, 7, 'pirate');
  const n = 8;
  for (const a of caps) {
    let w = 0, g = 0, sea = 0;
    for (const b of caps) {
      for (let k = 0; k < n; k++) {
        const rng = new Rng(1000 + k * 17);
        const flip = k % 2 === 1;
        const A = side(army, heroBattle(primsAtLevel(a, 11 + k * 7, 30), [], null, startingOrders(a), 999, { path: a, level: 30 }), { captain: a });
        const B = side(army, heroBattle(primsAtLevel(b, 5 + k * 13, 30), [], null, startingOrders(b), 999, { path: b, level: 30 }), { captain: b });
        const bt = newBattle(flip ? B : A, flip ? A : B, k + 1, 0, rng);
        quickFinish(bt, 0, rng);
        if ((bt.over!.winner === 0) !== flip) w++;
        g++;
      }
    }
    for (let k = 0; k < 2 * n; k++) {
      const rng = new Rng(2000 + k * 13);
      const flip = k % 2 === 1;
      const A = side(army, heroBattle(primsAtLevel(a, 11 + k * 7, 30), [], null, startingOrders(a), 999, { path: a, level: 30 }), { captain: a });
      const B = side(pir, npcHeroBattle(sl, null), { captain: null });
      const bt = newBattle(flip ? B : A, flip ? A : B, k + 1, 0, rng);
      quickFinish(bt, 0, rng);
      if ((bt.over!.winner === 0) !== flip) sea++;
    }
    assert.ok(w / g >= 0.3 && w / g <= 0.7, `${a}: ${Math.round((w / g) * 100)}% against the paths`);
    assert.ok(sea / (2 * n) >= 0.3 && sea / (2 * n) <= 0.9, `${a}: ${Math.round((sea / (2 * n)) * 100)}% against the sea`);
  }
  assert.ok(PATH_IDS.every((c) => pathPower(c, 30) > 0));
});

// ------------------------------------------------------------------ 12. words

test('12. every move and page in both languages (no Latin in the Russian), a feed line for each kind of use', () => {
  for (const c of PATH_IDS) for (const mv of [INNATE[c], ULTIMATE[c]]) for (const t of [mv.name, mv.text]) assert.ok(/[а-я]/i.test(t[1]) && !/[a-z]/i.test(t[1]), `${c}: ${t[1]}`);
  for (const id of PATH_PAGE_IDS) for (const t of [PATH_PAGES[id].name, PATH_PAGES[id].text]) assert.ok(/[а-я]/i.test(t[1]) && !/[a-z]/i.test(t[1]), `${id}: ${t[1]}`);
  for (const k of ['log.innate', 'log.ult', 'log.again', 'log.volley', 'log.harpoon', 'log.scroll'] as const) assert.ok(TAC_EN[k] && TAC_RU[k], k);
  for (const v of Object.values(SERVER_RU_PATH)) assert.ok(/[а-я]/i.test(v), v);
});

test('the tester\'s console: /path /stam /scroll /pathfoe, and the Russian help keeps command for command', () => {
  const { game } = makeGame();
  const { s, p, ship } = captain(game, 'Tester', 'smuggler');
  ship.docked = null;
  const prev = process.env.GRAVETIDE_ADMIN;
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    assert.match(runAdmin(game, s, '/path')!, /Path: Smoke Screen/);
    assert.match(runAdmin(game, s, '/stam 4')!, /Stamina 4\//);
    assert.match(runAdmin(game, s, '/scroll rv_hook 2')!, /The hook ×2/);
    assert.match(runAdmin(game, s, '/path learn ad_square')!, /Learnt/);
    assert.ok(heroOf(p).orders.includes('ad_square'));
    assert.match(runAdmin(game, s, '/pathfoe drowned')!, /walks the path/);
    const help = runAdmin(game, s, '/help')!;
    for (const c of ['/path', '/stam', '/scroll', '/pathfoe']) assert.ok(help.includes(c), c);
    const ru = SERVER_RU_ADMIN[help];
    assert.ok(ru, 'the Russian help');
    const cmds = (x: string) => x.match(/\/[a-z]+/g)!.join(' ');
    assert.equal(cmds(ru), cmds(help));
  } finally {
    if (prev === undefined) delete process.env.GRAVETIDE_ADMIN;
    else process.env.GRAVETIDE_ADMIN = prev;
  }
});
