// docs/17, after H5 — three follow-ups the owner approved: the sea's pirates carry a level's mix of deckhands,
// shooters, gunners and some boarders (the ladder's own crew an even fight at every level); no crew strikes of
// herself at low morale — HoMM3's bad morale freezes her stacks instead; the season's first Grail is the whole sea's
// news.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIRATE_CAL, UNITS, armyForLevel } from '../shared/src/data/army.ts';
import { MONTH, month, winRate } from './balance/recruit.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { TAC_CHANCE_PER_POINT } from '../shared/src/data/tactical.ts';
import { Rng } from '../shared/src/rng.ts';
import { aiAct, moralePoints, newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../server/src/game/tacbattle.ts';
import { grailFound, grailSpot } from '../server/src/game/grail.ts';
import { clearOutposts } from '../server/src/game/estate.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { EN as TAC_EN, RU as TAC_RU } from '../client/src/lang/ui/tactical.ts';
import { join, makeGame } from './helpers.ts';

const side = (army: ArmyStack[], morale = 70): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale, dealt: 1, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false,
});

// ------------------------------------------------------------------------------------------- A. the sea's pirates

test('the sea\'s pirates: deckhands, shooters and gunners with some boarders — not a boarders\' crew', () => {
  for (const L of [5, 7, 10]) {
    const a = armyForLevel(L, 300, 7, 'pirate');
    const men = (f: (t: number, u: ArmyStack['u']) => boolean) => a.filter((x) => f(UNITS[x.u].tier, x.u)).reduce((n, x) => n + x.n, 0);
    const shooters = men((_, u) => UNITS[u].specials.includes('shooter'));
    const boarders = men((t) => t === 5);
    assert.ok(shooters > boarders * 1.5, `⚓${L}: ${shooters} shooters and gunners against ${boarders} boarders`);
    assert.ok(boarders > 0, `⚓${L}: some boarders still`);
    assert.ok(men((t) => t === 1) >= 0.3 * 300, `⚓${L}: deckhands are the most of her`);
  }
  assert.deepEqual(armyForLevel(6, 140, 7, 'pirate'), armyForLevel(6, 140, 7, 'pirate'), 'no dice: the same ship carries the same men');
});

// Balance pass 2026-10-13 (docs/31): measured as a boarding is fought — her crew in the stacks her hull holds at each
// level of her band (boardSlots), the pirate folded into his fewer stacks (npcBoardSlots), the boarding's length, the
// sea's mind on both sides, crews of her waters ±15% (PIRATE_CAL was weighed on seven stacks a side and quick fights:
// as boarded, the ladder's crew won 3–5% against the pirates of ⚓4 and 93% against ⚓7's). ⚓1–2's pirates carry the sea's
// common crew (no scale), ⚓1's two stacks the stronger for it; there the captains decide (docs/31).
test("the ladder's own crew boards a pirate of her level about half the time at ⚓2–10 as a boarding is fought; a town-fed crew four in five", async () => {
  const { HAMMOCKS, side: bside, playBoard } = await import('./balance/boardlen.ts');
  const { boardSlots, npcBoardSlots } = await import('../shared/src/data/tactical.ts');
  const { battleFit } = await import('../server/src/game/tactical.ts');
  const { bandLevels } = await import('../shared/src/data/xpcurve.ts');
  const { npcHeroLevel } = await import('../shared/src/data/hero.ts');
  const pirate = (L: number, men: number) => battleFit(armyForLevel(L, men, 7, 'pirate').map((x) => ({ ...x, src: x.u })), npcBoardSlots(npcHeroLevel(L))).map(({ u, n }) => ({ u, n }));
  const rate = (L: number, mine: (men: number, slots: number) => ArmyStack[], n: number) => {
    const [lo, hi] = bandLevels(L);
    let w = 0, tot = 0;
    for (const slots of new Set(Array.from({ length: hi - lo + 1 }, (_, i) => boardSlots(lo + i)))) for (const c of [0.85, 1, 1.15]) {
      const men = Math.round(HAMMOCKS[L] * c);
      for (let i = 0; i < n; i++) if (playBoard(bside(mine(men, slots), undefined, null, true), bside(pirate(L, men), undefined, null, false), i * 37 + L * 5 + slots, { level: lo }).winner === 0) w++;
      tot += n;
    }
    return w / tot;
  };
  const rates: string[] = [];
  for (let L = 2; L <= 10; L++) {
    const w = rate(L, (men, slots) => armyForLevel(L, men, slots, 'player'), 40);
    rates.push(`⚓${L} ${Math.round(w * 100)}%`);
    assert.ok(w >= 0.38 && w <= 0.64, `⚓${L}: the ladder's crew wins ${Math.round(w * 100)}% (${rates.join(', ')})`);
  }
  let town = 0;
  for (let L = 2; L <= 10; L++) town += rate(L, (men, slots) => battleFit(month({ ...MONTH, level: L, crewMax: men }).army.map((x) => ({ ...x, src: x.u })), slots).map(({ u, n }) => ({ u, n })), 16);
  town /= 9;
  assert.ok(town >= 0.72 && town <= 0.9, `a month of a castle's men: ${Math.round(town * 100)}% on average`);
  assert.equal(PIRATE_CAL.length, 11);
});

// ------------------------------------------------------------------------------------------- B. bad morale

const crew = (): ArmyStack[] => [{ u: 'deckhand', n: 40 }, { u: 'musketeer', n: 8 }, { u: 'marine', n: 8 }];

test('no crew strikes of herself: a heart all but gone fights on, from the first round to the last man', () => {
  for (let k = 0; k < 12; k++) {
    const rng = new Rng(k + 5);
    const bt = newBattle(side(crew(), 70), side(crew(), 0), k + 5, 0, rng);
    assert.equal(bt.over, null, 'not over before a turn is taken');
    let turns1 = 0;
    for (let i = 0; i < 5000 && !bt.over; i++) {
      if (bt.active !== null && bt.stacks.find((s) => s.id === bt.active)!.side === 1) turns1++;
      aiAct(bt, 0, rng);
    }
    assert.ok(turns1 > 0, 'the broken crew takes her turns');
    const over = bt.over as TacBattle['over'];
    assert.ok(over, 'decided');
    assert.notEqual(over.why, 'struck', 'she never strikes of herself');
    if (over.why === 'rout') assert.ok(bt.stacks.filter((s) => s.side !== over.winner).every((s) => s.count <= 0), 'a rout is the last man down');
  }
  // Morale run down in the fight does not end it either.
  const rng = new Rng(3);
  const bt = newBattle(side(crew()), side(crew()), 3, 0, rng);
  bt.heroes[1].morale = 0;
  quickFinish(bt, 0, rng);
  assert.ok(bt.over!.why === 'rout' || bt.over!.why === 'rounds');
});

test('HoMM3\'s bad morale: a stack of a low-hearted crew sometimes freezes in fear, 1/25 a point below nought', () => {
  // The crew's 0..100 heart as HoMM3's −3..+3.
  const at = (m: number) => moralePoints(newBattle(side(crew(), 50), side(crew(), m), 1, 0, new Rng(1)), 1);
  assert.deepEqual([0, 9, 10, 25, 26, 41, 42, 57, 58, 90, 100].map(at), [-3, -3, -2, -2, -1, -1, 0, 0, 1, 3, 3]);
  assert.ok(Math.abs(TAC_CHANCE_PER_POINT - 1 / 24) < 0.005, 'about HoMM3\'s 1/24 a point');
  const freezeShare = (morale: number, army = crew): { fear: number; share: number } => {
    let fear = 0, turns = 0;
    for (let k = 0; k < 60; k++) {
      const rng = new Rng(k * 13 + 1);
      const bt: TacBattle = newBattle(side(army(), 70), side(army(), morale), k * 13 + 1, 0, rng);
      let seen = 0;
      for (let i = 0; i < 5000 && !bt.over; i++) {
        if (bt.active !== null && bt.stacks.find((s) => s.id === bt.active)!.side === 1) turns++;
        aiAct(bt, 0, rng);
        for (const e of bt.log) if (e.i > seen) {
          seen = e.i;
          if (e.k === 'fear' && e.side === 1 && !e.id) fear++;
        }
      }
    }
    return { fear, share: fear / Math.max(1, fear + turns) };
  };
  const low = freezeShare(0);
  assert.ok(low.share >= 0.05 && low.share <= 0.16, `a broken crew loses ${Math.round(low.share * 100)}% of her turns (about one in eight)`);
  const mid = freezeShare(35);
  assert.ok(mid.share < low.share && mid.share <= 0.1, `a shaken crew less often: ${Math.round(mid.share * 100)}%`);
  const high = freezeShare(70);
  assert.ok(high.share < low.share / 3, `a crew in good heart only once her heart is shot away: ${Math.round(high.share * 100)}%`);
  assert.equal(freezeShare(0, () => [{ u: 'guard', n: 20 }]).fear, 0, 'the steady never freeze');
  assert.equal(freezeShare(0, () => [{ u: 'drowned', n: 10 }]).fear, 0, 'the dead feel no fear');
});

test('the battle\'s feed and float tell a freeze in both languages', () => {
  assert.match(TAC_EN['log.fear'], /\{a\}.*freeze in fear.*lose the turn/);
  assert.match(TAC_RU['log.fear'], /\{a\}.*цепенеют от страха.*пропускают ход/);
  assert.ok(TAC_EN['fear.float'] && TAC_RU['fear.float'] && !/[A-Za-z]/.test(TAC_RU['fear.float']));
  assert.ok(TAC_EN['log.dread'] && !/[A-Za-z]{2,}/.test(TAC_RU['log.dread'].replace('{a}', '')));
});

// ------------------------------------------------------------------------------------------- C. the Grail

test('the season\'s first Grail: the chronicle and a toast to every captain at sea; the later finds the chronicle alone', () => {
  const { game } = makeGame();
  game.wallNow = () => 20_000 * 86_400_000;
  clearOutposts(game);
  quietAdv(game, false);
  const conns = ['First Finder', 'Second Seeker', 'Third Seeker'].map((n) => join(game, n));
  const [a, b] = ['First Finder', 'Second Seeker'].map((n) => game.sessionByName(n)!);
  const world = (i: number) => conns[i].all('toast').filter((t) => /^WORLD: .*first Grail of the season/.test(t.msg));
  grailFound(game, a, grailSpot(game, a.accountId).island);
  const island = grailSpot(game, a.accountId).island.name;
  for (const i of [1, 2]) {
    assert.equal(world(i).length, 1, `captain ${i} hears it`);
    assert.equal(world(i)[0].msg, `WORLD: First Finder has found the first Grail of the season on ${island}. Yours still lies where your obelisks point.`);
  }
  assert.equal(world(0).length, 0, 'the finder has her own toast');
  assert.ok(conns[0].all('toast').some((t) => /^The Grail!/.test(t.msg)));
  const chron = game.db.getKv<{ msg: string }[]>('world_chronicle') ?? [];
  assert.ok(chron.some((c) => c.msg === `First Finder has found the first Grail of the season on ${island}.`), 'the chronicle');
  // The second find of the season: the chronicle, no toast to the sea.
  grailFound(game, b, grailSpot(game, b.accountId).island);
  assert.equal(world(2).length, 1, 'the sea hears the first find only');
  assert.ok((game.db.getKv<{ msg: string }[]>('world_chronicle') ?? []).some((c) => /^Second Seeker has found a Grail on /.test(c.msg)));
  // In Russian.
  setLang('ru');
  applyDataLocale('ru');
  try {
    const r = serverText(world(1)[0].msg);
    assert.match(r, /^Вести: First Finder нашёл первый Грааль сезона на острове /);
    assert.ok(!/[A-Za-z]{3,}/.test(r.replace('First Finder', '').replace(island, '')), r);
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});
