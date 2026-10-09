// docs/25 block Д (items 53–63; owner, 2026-10-09: «Абордаж должен быть интересный, чтобы капитанские навыки, группа и
// умения решали … делай все пункты»): a path's moves by separate knobs (blows, heals, shares, points, rounds), tuned on
// real builds; the ultimate from round 2 (round 1 against an army half as large again); the great ones' resistance to
// orders; the Drowned's caps and her ultimate's new facet; the Reaver evened out; the dead pages alive; cover and narrow
// passes on a deck; the captains of the sea in their level's skills and kit. Each page's share in its role at every band
// and the paths against each other: tests/balance/boarding.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { npcHeroBattle, npcHeroLevel, npcKit, npcSkills } from '../shared/src/data/hero.ts';
import {
  DROWNED_CAPS, INNATE, PATH_HOLD_MAX, PATH_IDS, PATH_PAGES, PATH_PAGE_IDS, RAISE_CAP, DRAIN_CAP, ULTIMATE, ULT_EARLY, ULT_FACET, ULT_ROUND,
  drainCap, moveFx, pathHoldExtra, pathPagesAt, pathPower, powered, raiseCap,
} from '../shared/src/data/paths.ts';
import type { PathPageId } from '../shared/src/data/paths.ts';
import { TAC_BLOCKING, TAC_DECK_COVER, TAC_GAP, TAC_RESIST, deckCover, hexIndex, hexNeighbors, hexX, unitResist } from '../shared/src/data/tactical.ts';
import type { TacCell } from '../shared/src/data/tactical.ts';
import {
  aiAct, aiChoice, blowParts, castMove, castSpell, coverAt, isShooter, newBattle, reachOf, resistOf, scarDeck, stackById, viewOf,
} from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../server/src/game/tacbattle.ts';
import { captainAt, playerArmy, side } from './balance/boardlen.ts';
import { roleOf } from './balance/boardskill.ts';

const L = (path: CaptainId, level: number, army = playerArmy(level)): TacSideInput => side(army, captainAt(path, level, 3), path, true);
const battle = (a: TacSideInput, b: TacSideInput, seed = 3): TacBattle => newBattle(a, b, seed, 0, new Rng(seed), { len: 'board' });

test('docs/25 item 53: a path\'s moves by separate knobs — the shares the same at every level, the points never under one, the rounds never under the written', () => {
  for (const p of PATH_IDS) for (const id of PATH_PAGE_IDS.filter((x) => PATH_PAGES[x].path === p)) {
    const fx = PATH_PAGES[id].fx;
    const at = [1, 10, 20, 30, 40, 50, 60].map((lv) => powered(fx, p, lv));
    for (const m of ['self', 'foe', 'one'] as const) {
      if (!fx[m]) continue;
      for (const k of ['melee', 'shot', 'taken', 'shotTaken'] as const) if (fx[m]![k]) assert.ok(at.every((x) => x[m]![k] === at[0][m]![k]), `${id}: ${m}.${k} the same at every level`);
      for (const k of ['speed', 'init', 'morale', 'luck'] as const) if (fx[m]![k]) assert.ok(at.every((x) => Math.abs(x[m]![k]!) >= 1), `${id}: ${m}.${k} never under a point`);
    }
    for (const x of at) assert.equal(x.rounds ?? 0, fx.rounds ?? 0, `${id}: its rounds as written`);
    // The hold: as written, her Power a round more at most.
    for (const pow of [0, 10, 40]) assert.ok(pathHoldExtra(fx, pow) >= (fx.rounds ?? 0) && pathHoldExtra(fx, pow) <= (fx.rounds ?? 0) + PATH_HOLD_MAX);
  }
  // The blows and the heals have knobs of their own.
  assert.ok(PATH_IDS.some((p) => pathPower(p, 60) !== pathPower(p, 60, 'page', 'mend')));
});

test('docs/25 items 59–61: the pages that were dead hold two or three rounds and lay 8% or more in their role at every level they open at', () => {
  const dead: PathPageId[] = ['cs_spotter', 'cs_chain_shot', 'cs_pistol_line', 'sm_fog_veil', 'sm_caltrops', 'sm_blind_fog', 'ad_square', 'ad_signal_flags', 'ad_fog_of_war',
    'nv_tailwind', 'nv_flank_drill', 'nv_eye_of_storm', 'rv_blood_scent', 'rv_berserk', 'rv_howl'];
  for (const id of dead) {
    const pg = PATH_PAGES[id];
    for (const lv of [1, 8, 15, 25, 35, 45, 55, 60]) {
      if (!pathPagesAt(pg.path, lv).includes(id)) continue;
      const r = roleOf(pg.path, id, lv);
      assert.ok(r.v >= 0.08, `${id} at ${lv}: ${(r.v * 100).toFixed(1)}%`);
      if (pg.fx.self || pg.fx.foe || pg.fx.one) assert.ok(r.rounds >= 2 && r.rounds <= 3, `${id} at ${lv}: ${r.rounds} rounds`);
    }
  }
  // The Corsair's ultimate on a level with the Musket Storm's blow on every stack (owner: «на уровне Мушкетной бури»).
  for (const lv of [25, 40, 60]) assert.ok(roleOf('corsair', 'ult', lv).v >= 0.08, `Hell's Broadside at ${lv}`);
});

test('docs/25 item 55: the ultimate from round 2; from round 1 against an army half as large again', () => {
  for (const p of PATH_IDS) {
    const bt = battle(L(p, 40), L('corsair', 40));
    assert.equal(bt.heroes[0].ultFrom, ULT_ROUND);
    assert.equal(ULT_ROUND, 2);
    assert.equal(castMove(bt, 0, 'ult', undefined, new Rng(1)), 'The ultimate waits for the second round');
    assert.equal(viewOf(bt, 0, 0, true).heroes[0].ultFrom, 2);
    bt.round = 2;
    const t = ULTIMATE[p].fx.target === 'none' ? undefined : bt.stacks.find((x) => x.side === (ULTIMATE[p].fx.target === 'own' ? 0 : 1) && x.count > 0)!.id;
    assert.equal(castMove(bt, 0, 'ult', t, new Rng(1)), null, `${p}: given in round 2`);
  }
  // Half as large again: her ultimate in round 1, the other's still in round 2.
  const big = playerArmy(40).map((x) => ({ ...x, n: Math.round(x.n * 1.8) }));
  const bt = battle(L('reaver', 40), L('admiral', 40, big));
  assert.ok(ULT_EARLY === 1.5 && bt.heroes[0].ultFrom === 1 && bt.heroes[1].ultFrom === 2);
  assert.equal(castMove(bt, 0, 'ult', undefined, new Rng(1)), null, 'given in round 1');
});

test('docs/25 item 56: the great ones shrug off 30–50% of the orders and path pages; the innate move and the ultimate pass', () => {
  assert.equal(unitResist('titan_kraken'), TAC_RESIST.titan);
  assert.equal(unitResist('young_kraken'), TAC_RESIST.legend);
  assert.equal(unitResist('walrus_tyrant'), TAC_RESIST.boss);
  assert.equal(unitResist('marine'), 0);
  assert.ok(Object.values(TAC_RESIST).every((r) => r >= 0.3 && r <= 0.5));
  const titan = [...playerArmy(50).slice(0, 5), { u: 'titan_kraken' as const, n: 1 }];
  const hurtBy = (cast: (bt: TacBattle, t: number) => void, resist?: number): number => {
    const b = { ...L('admiral', 50, titan), ...(resist ? { resist } : {}) };
    const bt = battle(L('corsair', 50), b);
    bt.round = 2;
    const t = bt.stacks.find((x) => x.side === 1 && x.unit === 'titan_kraken')!;
    t.count = t.start = 40; // a deep stack, so no blow takes it whole
    const before = (t.count - 1) * t.hpMax + t.hpTop;
    cast(bt, t.id);
    return before - ((t.count - 1) * t.hpMax + t.hpTop);
  };
  const page = (bt: TacBattle, t: number) => assert.equal(castSpell(bt, 0, 'cs_chain_shot', t, new Rng(5)), null);
  const innate = (bt: TacBattle, t: number) => assert.equal(castMove(bt, 0, 'innate', t, new Rng(5)), null);
  // The same blow on a marine stack and on a titan's: the titan's 40% less from a page, the same from the innate move.
  const onMarines = (cast: (bt: TacBattle, t: number) => void): number => {
    const bt = battle(L('corsair', 50), L('admiral', 50, titan));
    bt.round = 2;
    const t = bt.stacks.find((x) => x.side === 1 && x.unit === 'titan_kraken')!;
    t.unit = 'marine';
    t.count = t.start = 40;
    const before = (t.count - 1) * t.hpMax + t.hpTop;
    cast(bt, t.id);
    return before - ((t.count - 1) * t.hpMax + t.hpTop);
  };
  const r1 = hurtBy(page) / onMarines(page), r2 = hurtBy(innate) / onMarines(innate);
  assert.ok(Math.abs(r1 - (1 - TAC_RESIST.titan)) < 0.03, `a page on a titan: ×${r1.toFixed(2)}`);
  assert.ok(Math.abs(r2 - 1) < 0.03, `the innate move on a titan: ×${r2.toFixed(2)}`);
  // A side that brings its own (a legend of the trials, a great ship of the sea).
  const bt = battle(L('corsair', 50), { ...L('admiral', 50), resist: TAC_RESIST.boss });
  assert.ok(bt.stacks.filter((x) => x.side === 1).every((x) => resistOf(bt, x) === TAC_RESIST.boss));
  assert.ok(viewOf(bt, 0, 0, true).stacks.filter((x) => x.side === 1).every((x) => x.resist === TAC_RESIST.boss));
  // What a page would lay on them: shrugged off about as often as they resist.
  let off = 0, all = 0;
  for (let k = 0; k < 60; k++) {
    const b2 = battle(L('smuggler', 50), { ...L('admiral', 50), resist: TAC_RESIST.boss }, k + 1);
    b2.round = 2;
    assert.equal(castSpell(b2, 0, 'sm_caltrops', undefined, new Rng(k + 7)), null);
    const e = b2.log.filter((x) => x.k === 'spell').pop()!;
    off += e.res?.length ?? 0;
    all += b2.stacks.filter((x) => x.side === 1 && x.count > 0).length;
  }
  assert.ok(off / all > 0.38 && off / all < 0.62, `shrugged off ${(off / all * 100).toFixed(0)}%`);
});

test('docs/25 item 57: the Drowned\'s caps grow to 50% and 18% at 60; her ultimate gains a facet at 40', () => {
  assert.equal(raiseCap('drowned', 20), RAISE_CAP);
  assert.equal(drainCap('drowned', 20), DRAIN_CAP);
  assert.ok(Math.abs(raiseCap('drowned', 60) - DROWNED_CAPS.raise) < 1e-9 && DROWNED_CAPS.raise === 0.5);
  assert.ok(Math.abs(drainCap('drowned', 60) - DROWNED_CAPS.drain) < 1e-9 && DROWNED_CAPS.drain === 0.18);
  assert.ok(raiseCap('drowned', 40) > RAISE_CAP && raiseCap('drowned', 40) < 0.5);
  for (const p of PATH_IDS.filter((x) => x !== 'drowned')) assert.ok(raiseCap(p, 60) === RAISE_CAP && drainCap(p, 60) === DRAIN_CAP);
  const fc = ULT_FACET.drowned!;
  assert.equal(fc.level, 40);
  assert.equal(moveFx('drowned', 'ult', 39), ULTIMATE.drowned.fx);
  const f40 = moveFx('drowned', 'ult', 40);
  assert.ok(f40.raise === ULTIMATE.drowned.fx.raise && f40.drain === ULTIMATE.drowned.fx.drain && f40.self?.taken === -0.15 && f40.self?.steady, 'the risen feel neither fear nor pain');
  assert.ok(/[а-я]/i.test(fc.text[1]) && !/[a-z]/i.test(fc.text[1]));
  // In the battle: the facet holds on her side at 40, not at 39.
  for (const [lv, want] of [[39, false], [40, true]] as const) {
    const bt = battle(L('drowned', lv), L('corsair', lv));
    bt.round = 2;
    assert.equal(castMove(bt, 0, 'ult', undefined, new Rng(2)), null);
    assert.equal(bt.heroes[0].fx.some((f) => f.id === 'ult:drowned' && f.mods?.steady), want, `level ${lv}`);
  }
});

test('docs/25 item 58: the Reaver evened out — her innate move two free blows from level 1, her ultimate +12% and three blows at 20', () => {
  for (const lv of [1, 10, 30, 60]) assert.equal(powered(INNATE.reaver.fx, 'reaver', lv, 'move').free, 2, `innate at ${lv}`);
  const u = powered(moveFx('reaver', 'ult', 20), 'reaver', 20, 'move');
  assert.equal(u.free, 3);
  assert.ok(Math.abs(u.self!.melee! - 0.12) < 1e-9);
  const bt = battle(L('reaver', 20), L('corsair', 20));
  bt.round = 2;
  assert.equal(castMove(bt, 0, 'ult', undefined, new Rng(2)), null);
  assert.equal(bt.heroes[0].free, 3);
});

/** An open deck (no mast, guns, barrels, holes or fires; planks on every row) for the cover and the passes. */
function openDeck(bt: TacBattle): void {
  for (let i = 0; i < bt.cells.length; i++) if (bt.cells[i] !== '#' && bt.cells[i] !== '~' && bt.cells[i] !== '=') bt.cells[i] = '.';
}

test('docs/25 item 62: the mast, the barrels, the crates and the guns cover from a shot from their side; the planks a narrow pass; fire splits the deck', () => {
  const bt = battle(L('corsair', 40), L('admiral', 40));
  openDeck(bt);
  const s = bt.stacks.find((x) => x.side === 0 && isShooter(x) && x.count > 0)!;
  const t = bt.stacks.find((x) => x.side === 1 && x.count > 0)!;
  for (const o of bt.stacks) if (o !== s && o !== t) o.count = 0;
  s.hex = hexIndex(0, 4);
  t.hex = hexIndex(8, 4);
  const near = hexIndex(7, 4), far = hexIndex(9, 4);
  const bare = blowParts(bt, s, t, 'shot').mul;
  for (const c of ['M', 'B', 'K', 'C'] as TacCell[]) {
    bt.cells[near] = c;
    assert.ok(Math.abs(blowParts(bt, s, t, 'shot').mul / bare - TAC_DECK_COVER) < 1e-9, `${c} between: covered`);
    assert.ok(coverAt(bt, t.hex, s.hex) === near && deckCover(bt.cells, t.hex, s.hex) === near);
    bt.cells[near] = '.';
  }
  bt.cells[far] = 'B';
  assert.equal(blowParts(bt, s, t, 'shot').mul, bare, 'a barrel behind her covers nothing');
  bt.cells[far] = '.';
  bt.cells[near] = 'B';
  const pv = viewOf(bt, 0, 0, true);
  if (bt.active === s.id) assert.ok(pv.pv?.some((p) => p.t === t.id && p.cov), 'the preview tells it');
  bt.cells[near] = '.';
  // Ashore and on the Colosseum's sand the deck's cover is not there (their own reckoning stands).
  bt.cells[near] = 'B';
  bt.arena = true;
  assert.equal(blowParts(bt, s, t, 'shot').mul, bare);
  bt.arena = undefined;
  bt.cells[near] = '.';
  // The planks: the water on both sides — no blow into her side or her back.
  const plank = hexIndex(TAC_GAP, 4);
  bt.cells[plank] = '=';
  t.hex = plank;
  t.face = 0; // facing east: a blow from the west is from behind
  const m = bt.stacks.find((x) => x.side === 0 && !isShooter(x))!;
  m.count = m.start;
  m.hex = hexIndex(TAC_GAP - 1, 4);
  assert.equal(blowParts(bt, m, t, 'melee').flank, 0, 'on a plank');
  bt.cells[plank] = '.';
  assert.ok(blowParts(bt, m, t, 'melee').flank > 0, 'on the deck she is taken from behind');
  // Fire: no way through it on a deck.
  m.hex = hexIndex(1, 4);
  const step = hexNeighbors(m.hex).find((j) => bt.cells[j] === '.' && !bt.stacks.some((x) => x.count > 0 && x.hex === j))!;
  assert.ok(reachOf(bt, m).has(step));
  bt.cells[step] = 'F';
  assert.ok(!reachOf(bt, m).has(step), 'the fire is no way');
});

test('docs/25 item 62: what the guns leave of a deck never shuts a corner of it off from the planks', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const bt = newBattle(L('corsair', 40), { ...L('admiral', 40), holes: 4, fire: true }, seed, 0, new Rng(seed), { len: 'board' });
    const walk = (i: number) => !TAC_BLOCKING.has(bt.cells[i]) && bt.cells[i] !== 'F';
    const start = bt.cells.findIndex((c) => c === '=');
    const seen = new Set([start]);
    const q = [start];
    while (q.length) for (const j of hexNeighbors(q.pop()!)) if (!seen.has(j) && walk(j)) {
      seen.add(j);
      q.push(j);
    }
    for (let i = 0; i < bt.cells.length; i++) if (walk(i) && hexX(i) > TAC_GAP) assert.ok(seen.has(i), `seed ${seed}: hex ${i} shut off`);
  }
  // scarDeck itself: four holes and the fires on a crowded deck, still open.
  const cells = newBattle(L('corsair', 40), L('admiral', 40), 9, 0, new Rng(9), { len: 'board' }).cells;
  scarDeck(cells, 0, 4, true, 77);
  assert.ok(cells.filter((c) => c === 'F').length > 0);
});

test('docs/25 item 62: the sea\'s mind steps into cover from her shooters more often than the deck offers it', () => {
  let chose = 0, moves = 0, offered = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const bt = newBattle(side(playerArmy(40), captainAt('corsair', 40, seed), 'corsair', false), side(playerArmy(40), captainAt('admiral', 40, seed + 1), 'admiral', false), seed, 0, new Rng(seed), { len: 'board' });
    const rng = new Rng(seed * 7);
    for (let i = 0; i < 400 && !bt.over && bt.active !== null; i++) {
      const s = stackById(bt, bt.active)!;
      const guns = bt.stacks.filter((o) => o.side !== s.side && o.count > 0 && isShooter(o) && o.shots > 0);
      if (!isShooter(s) && guns.length) {
        const c = aiChoice(bt, new Rng(1));
        if (c.a === 'move') {
          const cov = (h: number) => guns.some((o) => coverAt(bt, h, o.hex) >= 0);
          const reach = [...reachOf(bt, s).keys()];
          moves++;
          if (cov(c.to)) chose++;
          offered += reach.filter(cov).length / Math.max(1, reach.length);
        }
      }
      aiAct(bt, 0, rng);
    }
  }
  assert.ok(moves > 50, `${moves} moves`);
  assert.ok(chose / moves > offered / moves, `in cover ${(chose / moves * 100).toFixed(0)}% of her steps, the deck offers ${(offered / moves * 100).toFixed(0)}%`);
});

test('docs/25 item 63: the captains of the sea in the skills and the artifacts of their level; the named ones their path\'s book and the sea\'s', () => {
  for (const sl of [1, 3, 5, 8, 10]) {
    const lv = npcHeroLevel(sl);
    const hb = npcHeroBattle(sl, null);
    assert.equal(hb.level, lv);
    assert.ok(npcSkills(lv).length > 0 || lv === 1);
    if (lv > 1) assert.ok(npcKit(lv).length > 0 && (hb.melee > 0 || hb.taken > 0), `⚓${sl}: her kit tells`);
  }
  // From level 20 a boarding of one is a fight: her Attack and Defense and her orders' lift as a captain's of her level.
  const sea = npcHeroBattle(10, null), cap = captainAt('corsair', npcHeroLevel(10), 3);
  assert.ok(sea.atk >= cap.atk * 0.6 && sea.def >= cap.def * 0.6, `${sea.atk}/${sea.def} against ${cap.atk}/${cap.def}`);
  // A named captain: her path's pages, the innate move, the ultimate, and the sea's book beside them.
  const named = npcHeroBattle(8, 'reaver');
  assert.equal(named.path, 'reaver');
  assert.ok(named.ult);
  assert.ok(pathPagesAt('reaver', named.level!).every((id) => named.book.includes(id)));
  assert.ok(named.book.includes('grenades') && named.book.includes('mark_target'));
});
