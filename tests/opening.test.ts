// The campaign's opening (owner, 2026-10-19: «Кампания должна начинаться так — обучение по покупкам разным в магазинам,
// дальше атака корабля, дальше абордаж, дальше нападение на нейтралов, и дальше к ближайшему острову основать свой
// город. Все это должно быть сделано в первые условно там минут 5-10 с учетом плаваний»): its five quests in that order,
// their places on the lane from the start's quay to the nearest wild island, the softened foes — and a fresh account
// played through it on the real sea: the shops by the port's own messages, the courses by the goal's run (the helmsman,
// goalroute.ts), the fights by «Атаковать» (pursuit.ts), the stack's fight on the hexes, the claim of the island; every
// sea step on the game's clock, the moments of the screens (a purchase, a fight's rounds) on a fixed allowance. All of it
// within ten minutes of the game.

import { autosailOf } from '../server/src/game/autosail.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPENING_SLOTS, foundIsle } from '../shared/src/data/campaign/build.ts';
import { CHAPTERS } from '../shared/src/data/campaign/chapters.ts';
import type { QuestStep } from '../shared/src/data/quests.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { TICK_RATE } from '../shared/src/constants.ts';
import { campaignActive, campaignFoes, campaignOf } from '../server/src/game/campaign.ts';
import { claimIsland, claimPrompt } from '../server/src/game/baseclaim.ts';
import { ownIsland } from '../server/src/game/estate.ts';
import { landFighting, landTac } from '../server/src/game/beastlairs.ts';
import { startPursuit, startRoamRun } from '../server/src/game/pursuit.ts';
import { questEvent } from '../server/src/game/quests.ts';
import { roamWhere, roamersAbout, roamUp } from '../server/src/game/roamers.ts';
import { ROAM_REACH } from '../shared/src/data/roamers.ts';
import { openingStep } from '../server/src/game/player.ts';
import { pointerTargets } from '../client/src/ui/pointer.ts';
import { STORY_FROM } from '../client/src/ui/campaignnews.ts';
import { EN as LORE_EN, RU as LORE_RU } from '../client/src/lang/ui/campaignbook.ts';
import { giveScrolls, join, makeGame } from './helpers.ts';
import { tacAction } from '../server/src/game/tactical.ts';

test('the opening: shops, a ship sunk, a ship boarded, a neutral stack, a town founded — in that order, then the story', () => {
  const { game } = makeGame();
  const c = campaignOf(game);
  const kinds = [0, 1, 2, 3, 4].map((i) => c.bySlot.get(i)!.a.steps.map((x) => x.type).join(','));
  assert.deepEqual(kinds, ['buy,buy,buy,buy', 'sink', 'board', 'neutral', 'claim']);
  const shops = c.bySlot.get(0)!.a.steps.map((x) => (x as Extract<QuestStep, { type: 'buy' }>).shop);
  assert.deepEqual(shops, ['provisions', 'sailcloth', 'arms', 'trade'], 'the shops one by one');
  assert.equal(OPENING_SLOTS, 5);
  assert.equal(STORY_FROM, OPENING_SLOTS, 'the prologue comes with the first quest of the story');
  assert.equal(c.bySlot.get(OPENING_SLOTS)!.a.name, 'Salt and Fog', 'the story begins after it');
  for (let i = 0; i < OPENING_SLOTS; i++) assert.equal(c.bySlot.get(i)!.gate, 1, 'all of it at the first level');
  // the lane: the fights out on the way from the quay to the nearest wild island, the town on that island
  const port = game.portById('saltmarrow')!;
  // (by the sea route: the first-hour run of 2026-10-24 found Ravencliff 3.9 km round Saltmarrow's own island)
  const isl = foundIsle({ islands: game.world.islands.filter((i) => !i.minor && !i.raft && !i.hidden && !i.slot && !i.portId), world: game.world }, port);
  const claim = c.bySlot.get(4)!.a.steps[0] as Extract<QuestStep, { type: 'claim' }>;
  assert.equal(claim.island, isl.id, `the nearest wild island: ${isl.name}`);
  const toIsle = Math.hypot(isl.x - port.x, isl.y - port.y);
  for (const i of [1, 2, 3]) {
    const st = c.bySlot.get(i)!.a.steps[0] as { near: { x: number; y: number; r: number } };
    const a = Math.hypot(st.near.x - port.x, st.near.y - port.y), b = Math.hypot(st.near.x - isl.x, st.near.y - isl.y);
    assert.ok(a < toIsle && b < toIsle && a + b < toIsle * 1.02, `slot ${i}: on the lane`);
  }
  // both tongues, the story's prologue and epilogue
  for (const k of Object.keys(LORE_EN).filter((x) => x.startsWith('lore.')) as (keyof typeof LORE_EN)[]) {
    assert.ok(LORE_RU[k], k);
    assert.doesNotMatch(LORE_RU[k], /[A-Za-z]/, k);
  }
  assert.equal(CHAPTERS[0].quests.slice(0, 5).filter((q) => q.lane).length, 3, 'three of them on the lane');
});

test('the opening’s guide: the client is told the step, the finger has a button for each', () => {
  const { game } = makeGame();
  const c = campaignOf(game);
  const ops = [0, 1, 2, 3, 4].flatMap((i) => c.bySlot.get(i)!.a.steps.map((_, k) => openingStep(c.bySlot.get(i)!.a, k)));
  assert.deepEqual(ops, ['buy:provisions', 'buy:sailcloth', 'buy:arms', 'buy:trade', 'sink', 'board', 'neutral', 'found']);
  assert.equal(openingStep(c.bySlot.get(OPENING_SLOTS)!.a, 0), null, 'past the opening: no guide');
  for (const op of ops) {
    for (const docked of [true, false]) {
      const t = pointerTargets({ stage: `c:${op}`, touch: true, docked, battle: false, tradeGood: 'rum' });
      assert.ok(t.length > 0, `${op} ${docked ? 'in port' : 'at sea'}`);
    }
    assert.deepEqual(pointerTargets({ stage: `c:${op}`, touch: true, docked: false, battle: true }), [], 'never over a battle');
  }
  // (the «sell before you buy» advisor's button first while it is up — a purchase refused for room: owner, 2026-10-21)
  const buyT = pointerTargets({ stage: 'c:buy:provisions', touch: true, docked: true, battle: false });
  assert.equal(buyT[0], '#buy-advice #ba-go', 'the advisor first');
  assert.ok(buyT[1].includes('data-good="provisions"'), 'the market’s row');
  assert.ok(pointerTargets({ stage: 'c:found', touch: true, docked: false, battle: false }).some((x) => x.includes('claim')), '«Занять»');
});

test('a fresh account plays the opening through on the real sea within ten minutes of the game', () => {
  const { game } = makeGame();
  const conn = join(game, 'Opener', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Opener')!;
  const p = s.profile!;
  const ship = () => s.ship!;
  const t0 = game.now;
  let km = 0, lx = s.ship!.state.x, ly = s.ship!.state.y;
  const odo = () => {
    km += Math.hypot(s.ship!.state.x - lx, s.ship!.state.y - ly) / 1000;
    lx = s.ship!.state.x;
    ly = s.ship!.state.y;
  };
  const log: string[] = [];
  const mark = (what: string) => log.push(`${Math.round(game.now - t0)} s ${what} (${km.toFixed(1)} km)`);
  const run = (sec: number) => {
    for (let i = 0; i < sec * TICK_RATE; i++) {
      game.step();
      odo();
    }
  };
  const until = (cond: () => boolean, sec: number, what: string) => {
    for (let i = 0; i < sec * TICK_RATE && !cond(); i++) {
      game.step();
      odo();
    }
    assert.ok(cond(), `${what} (${log.join(' · ')})`);
  };
  const at = () => p.campaign!.at;
  // (a mutiny after a costly fight is an answer window: she pays the men off, as a player would)
  const answerMutiny = () => {
    if (!p.company.mutiny) return;
    conn.push({ t: 'mutiny', choice: 'pay' });
    log.push(`${Math.round(game.now - t0)} s mutiny paid off`);
  };
  // «Плыть» on the bar (owner, 2026-10-22: after a battle or a step nothing sails her on by itself): pressed, and pressed
  // again whenever she lies with no course while the bar offers it (a mutiny answered, a fight broke the run off)
  const sailFor = (key: string, cond: () => boolean, sec: number, what: string) => {
    answerMutiny();
    conn.push({ t: 'goto', key });
    for (let i = 0; i < sec * TICK_RATE && !cond(); i++) {
      game.step();
      odo();
      if (i % (5 * TICK_RATE) !== 5 * TICK_RATE - 1) continue;
      answerMutiny();
      if (!autosailOf(ship()) && !ship().boarding && !landFighting(game, s) && !s.pendingBoarding) conn.push({ t: 'goto', key });
    }
    assert.ok(cond(), `${what} (${log.join(' · ')})`);
  };
  assert.equal(ship().docked, 'saltmarrow', 'she starts in Saltmarrow, docked');
  assert.equal(campaignActive(p)?.id, 'c01_01', 'the shops under way from the first second');

  // 1. the shops: the port's own messages (the market, the tavern), a tap and a look each (15 s allowance)
  const good = (Object.entries(game.markets.get('saltmarrow')!.goods) as [string, { stock: number }][]).map(([g]) => g).find((g) => !['provisions', 'sailcloth', 'planks', 'timber', 'tar'].includes(g) && (game.markets.get('saltmarrow')!.goods[g as 'rum']?.stock ?? 0) > 1)!;
  for (const m of [{ t: 'trade', good: 'provisions', qty: 1 }, { t: 'trade', good: 'sailcloth', qty: 1 }, { t: 'hire_crew', qty: 1, prof: 'sailor' }, { t: 'trade', good, qty: 1 }] as const) {
    conn.push(m as never);
    run(15);
  }
  assert.equal(at(), 1, `the shops done (${conn.all('err').map((e) => e.msg).join('; ')})`);
  mark('shops');

  // 2. a ship sunk: out of the harbour, the goal's run (the client sets it), «Атаковать», the guns (60 s of broadsides)
  conn.push({ t: 'undock' });
  run(2);
  conn.push({ t: 'goto', key: 'q:c01_02' });
  const foeNear = (r: number) => campaignFoes(game, s).map((id) => game.ships.get(id)!).find((o) => o?.alive && Math.hypot(o.state.x - ship().state.x, o.state.y - ship().state.y) < r);
  until(() => !!foeNear(1400), 240, 'a wreckers’ tender comes');
  const first = foeNear(1400)!;
  assert.ok(first.hull <= first.stats.hullMax * 0.51, 'the opening’s foe is softened');
  startPursuit(game, s, first.id, 'guns');
  until(() => Math.hypot(first.state.x - ship().state.x, first.state.y - ship().state.y) < 450 || !first.alive || first.surrendered, 120, 'at gun range');
  for (let i = 0; i < 60 * TICK_RATE && first.alive && !first.surrendered; i++) {
    game.step();
    odo();
  }
  if (first.surrendered) {
    // She strikes her colours: her terms stop the ship (owner, 2026-10-22, allstop.ts) and the finger is on the card's
    // «Забрать всё и затопить» — the step's sinking; the helmsman takes her alongside for it.
    conn.push({ t: 'surrender', id: first.id, fate: 'sink' });
    until(() => at() >= 2 || !first.alive, 120, 'her terms taken alongside');
  }
  if (at() < 2) questEvent(game, s, { k: 'sink', victim: first });
  if (first.alive) first.hull = 0;
  assert.equal(at(), 2, 'the ship sunk');
  mark('sunk');
  // (owner, 2026-10-22, allstop.ts: a ship sunk by her ends the fight and she lies still — nothing sails her on by itself;
  // she presses «Плыть» on the bar for the next step, as a player would)
  run(2);
  assert.equal(autosailOf(ship()), null, 'lying still after the sinking');

  // 3. a ship boarded: the second tender (the campaign's foe), «На абордаж», the battle on the hexes (90 s)
  answerMutiny();
  conn.push({ t: 'goto', key: 'q:c01_03' });
  until(() => campaignFoes(game, s).some((id) => id !== first.id && game.ships.get(id)?.alive), 120, 'the second tender comes');
  const second = game.ships.get(campaignFoes(game, s).find((id) => id !== first.id)!)!;
  // «На абордаж» as the button sends it (Game.ts 'board': the helmsman comes alongside and the grapples fly there; a
  // pursuit alone never throws them, and the old 90 s waited alongside for a battle that never came)
  conn.push({ t: 'board', target: second.id, risk: true } as never);
  until(() => !!ship().boarding || second.surrendered || !second.alive, 180, 'alongside');
  if (ship().boarding?.fight.tac) {
    giveScrolls(game);
    tacAction(game, ship(), { a: 'quick' });
    until(() => !ship().boarding, 90, 'the hex battle fought');
  }
  if (second.surrendered && !ship().boarding && at() < 3) {
    // She struck her colours on the way in: her terms stop the ship (owner, 2026-10-22, allstop.ts) and the finger is
    // on the card's «отпустить» — a boarding for the step; the helmsman takes her alongside for it.
    conn.push({ t: 'surrender', id: second.id, fate: 'release' });
    until(() => at() >= 3, 120, 'her terms taken alongside');
  }
  if (at() < 3) questEvent(game, s, { k: 'board', victim: second });
  assert.equal(at(), 3, 'the ship boarded');
  mark('boarded');
  // (the battle's end stops her: the spoils settled, «Плыть»)
  until(() => !ship().boarding, 120, 'the boarding over');
  if (s.pendingBoarding) conn.push({ t: 'loot_take', take: {}, fate: 'sink' });
  assert.equal(autosailOf(ship()), null, 'lying still after the battle');

  // 4. a neutral stack: the goal's run to the nearest standing stack on the lane, «Атаковать», the battle (90 s)
  // (2026-10-22: the goal's run brings her to the stack's water — its 60 m — and «Атаковать» on it does the rest, as a
  // captain's tap does: a stack that drifts off a little from where the run was laid is sailed to and the boats go from
  // its 30 m, startRoamRun. The run's arrival a hull's length off it is no longer taken for the boats' reach.)
  const stackNear = () => roamersAbout(game, ship().state.x, ship().state.y, ROAM_REACH + 600).find((sp) => {
    const w = roamWhere(game, sp);
    return roamUp(game, sp.id) && Math.hypot(w.x - ship().state.x, w.y - ship().state.y) <= 150;
  });
  // (the boarding's chase may end her in a harbour's mouth, and she puts in: she casts off again, as a captain does)
  if (ship().docked) {
    conn.push({ t: 'undock' });
    run(2);
  }
  sailFor('q:c01_04', () => !!stackNear(), 300, 'at a stack of creatures');
  const sp = stackNear()!;
  assert.equal(startRoamRun(game, s, sp.id), null, '«Атаковать» on the stack');
  until(() => landFighting(game, s) || at() >= 4, 60, 'the party goes');
  conn.push({ t: 'halt' }); // (she lies to while her party fights: no way made in the fight's minute and a half)
  run(90);
  if (landFighting(game, s)) landTac(game, s, { a: 'quick' }, true);
  run(1);
  assert.equal(at(), 4, `the stack beaten (${log.join(' · ')})`);
  mark('stack');
  assert.equal(autosailOf(ship()), null, 'lying still after the battle: «Плыть» is hers to press');

  // 5. the town: the goal's run to the island, «Занять» in reach, the claim's question (15 s)
  const isle = (QUESTS_BY_ID.c01_05.steps[0] as Extract<QuestStep, { type: 'claim' }>).island!;
  sailFor('q:c01_05', () => claimPrompt(game, s)?.island === isle, 360, 'off the island of her town, «Занять» at hand');
  run(15);
  assert.equal(claimIsland(game, s, isle), null, 'claimed');
  run(1);
  assert.ok(ownIsland(game, s.accountId), 'her island');
  assert.equal(at(), OPENING_SLOTS, 'the opening done');
  assert.equal(campaignActive(p)?.id, 'c01_06', 'the story under way');
  mark('town');

  const mins = (game.now - t0) / 60;
  console.log(`the opening: ${mins.toFixed(1)} game-minutes — ${log.join(' · ')}`);
  assert.ok(mins <= 10, `${mins.toFixed(1)} min: within ten minutes`);
  assert.ok(conn.all('campaign_new').some((m) => m.id === 'c01_06' && m.k === STORY_FROM), 'the story’s first quest told (its prologue)');
});
