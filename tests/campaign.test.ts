// The main campaign (docs/36; owner, 2026-10-17: «в сюжете минимум (в кампании главной) должно быть 700 крутых квестов
// и только пройдя их ты должен быть максимального уровня … один из шагов должен быть … посещение острова и несколько
// абордажей … сети мики числится как побочное»): its size and shape, the one taxonomy on every screen, the road of
// experience to the 60th, the steps tracked by the game's own events (the new ones too), a route for every step, both
// tongues, the migration of the captains of before — and a captain who does nothing but the campaign, from its first
// quest to its last, in a real game: the 60th level at its end.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, xpForLevel } from '../shared/src/constants.ts';
import { buildCampaign } from '../shared/src/data/campaign/build.ts';
import { CHAPTERS } from '../shared/src/data/campaign/chapters.ts';
import { checkChapter } from '../shared/src/data/campaign/check.ts';
import { campaignPaces, roadXp } from '../shared/src/data/campaign/pacing.ts';
import { CAMPAIGN_SIZE, PLAN, WALL_CHAPTER } from '../shared/src/data/campaign/plan.ts';
import { FIRST_SLOT, migrateCampaign, sanitizeCampaign } from '../shared/src/data/campaign/progress.ts';
import { campaignPatterns } from '../shared/src/data/campaign/patterns.ts';
import { questClass } from '../shared/src/data/questclass.ts';
import type { QuestDef, QuestStep } from '../shared/src/data/quests.ts';
import { CAMPAIGN_QUESTS, QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { BEAST_IDS, BEASTS } from '../shared/src/data/beasts.ts';
import { hullsFor } from '../shared/src/data/shiplevel.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { loadCampaignWords, serverText } from '../client/src/lang/server.ts';
import { chipsOfQuest } from '../client/src/ui/board.ts';
import { goalSheetView } from '../client/src/ui/goalsheet.ts';
import { classWord } from '../client/src/ui/questclass.ts';
import { abyssCleared } from '../server/src/game/abyss.ts';
import { campaignActive, campaignOf } from '../server/src/game/campaign.ts';
import type { Game } from '../server/src/game/Game.ts';
import { resolveGoal } from '../server/src/game/goalroute.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { sanitizeProfile } from '../server/src/game/player.ts';
import { ISLE_REACH, questEvent } from '../server/src/game/quests.ts';
import { join, makeGame } from './helpers.ts';

const world = generateWorld(1337);
const built = buildCampaign(world, 1337, CHAPTERS);

// ------------------------------------------------------------------ the shape

test('the campaign: 36 chapters of 15–25 quests, 720 in all, every chapter written and clean', () => {
  assert.ok(CAMPAIGN_SIZE >= 700, `${CAMPAIGN_SIZE} quests`);
  assert.equal(PLAN.length, 36);
  for (const p of PLAN) assert.ok(p.size >= 15 && p.size <= 25, `chapter ${p.n}: ${p.size}`);
  assert.deepEqual(CHAPTERS.map((c) => c.n), PLAN.map((p) => p.n), 'every chapter written, in order');
  for (const ch of CHAPTERS) assert.deepEqual(checkChapter(ch), [], `chapter ${ch.n}`);
  assert.equal(built.slots.length, CAMPAIGN_SIZE, 'every slot laid on the world');
  const ids = new Set(built.quests.map((q) => q.id));
  assert.equal(ids.size, built.quests.length, 'ids unique');
  for (const q of built.quests) {
    assert.ok(q.steps.length >= 1 && q.steps.length <= 4, `${q.id}: ${q.steps.length} steps`);
    assert.equal(q.kind, 'campaign');
    for (const t of [q.name, q.summary, q.campaign!.done, ...q.steps.map((x) => x.text)]) assert.ok(!/\{\w+\}/.test(t), `${q.id}: a place left unfilled — ${t}`);
  }
  const branches = built.slots.filter((s) => s.b).length;
  assert.ok(branches >= 8, `${branches} branches`);
});

test('the owner’s steps: an island visited and ships boarded in every chapter; the step mix is wide', () => {
  const mix: Record<string, number> = {};
  for (const ch of PLAN) {
    const qs = built.slots.filter((s) => s.ch === ch.n).map((s) => s.a);
    assert.ok(qs.filter((q) => q.steps.some((x) => x.type === 'isle')).length >= 2, `chapter ${ch.n}: islands`);
    assert.ok(qs.filter((q) => q.steps.some((x) => x.type === 'board')).length >= 3, `chapter ${ch.n}: boardings`);
    for (const q of qs) for (const st of q.steps) mix[st.type] = (mix[st.type] ?? 0) + 1;
  }
  for (const t of ['visit', 'isle', 'land', 'board', 'sink', 'lair', 'beast', 'deliver', 'pickup', 'time_in', 'chart', 'dive', 'claim', 'build', 'recruit', 'named', 'rescue']) assert.ok(mix[t] > 0, `the campaign has ${t} steps`);
  // the fights are of the quest's level: a grey ship of the old waters does not count
  for (const q of built.quests) for (const st of q.steps) if (st.type === 'board' || st.type === 'sink') assert.ok((st.minShip ?? 0) >= 1, q.id);
});

// ------------------------------------------------------------------ the road of experience

test('the experience: the whole road to the 60th exactly, each quest at its level, the gates never fall', () => {
  const paces = campaignPaces();
  assert.equal(paces.length, CAMPAIGN_SIZE);
  assert.equal(paces.reduce((a, p) => a + p.xp, 0), roadXp(), 'the sum is the road from the 1st level to the 60th');
  let level = 1, xp = 0;
  for (let i = 0; i < paces.length; i++) {
    if (i) assert.ok(paces[i].gate >= paces[i - 1].gate, `gate ${i} falls`);
    assert.equal(paces[i].gate, level, `slot ${i}: its gate is the level a campaign-only captain stands at`);
    xp += paces[i].xp;
    while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level++;
    }
  }
  assert.equal(level, MAX_LEVEL, 'the 60th at the end');
  assert.equal(xp, 0, 'and not a point past it');
  // early quests quick, late ones long: six to eight at the first levels, thirteen and more at the last
  const perLevel = (l: number) => paces.filter((p) => p.gate === l).length;
  assert.ok(perLevel(1) <= 8 && perLevel(59) >= 13, `${perLevel(1)} at the 1st, ${perLevel(59)} at the 59th`);
  assert.ok(paces[CAMPAIGN_SIZE - 1].xp > paces[0].xp * 100);
  // modest silver: never more than a board job of its level pays (about 500 + 40·L)
  for (const p of paces) assert.ok(p.silver <= 30 + 10 * p.gate, `silver ${p.silver} at ${p.gate}`);
});

// ------------------------------------------------------------------ the one taxonomy

test('one taxonomy on every screen: «Сети Мики» is a side quest everywhere, a campaign quest is the campaign everywhere', () => {
  setLang('ru');
  const mika = QUESTS_BY_ID.side_mika_1 ?? { id: 'side_mika_1', kind: 'story' as const };
  const first = built.slots[0].a;
  // the port's switch
  assert.deepEqual(chipsOfQuest(mika.kind, undefined, false), ['side']);
  assert.deepEqual(chipsOfQuest(first.kind, first.category, false), ['campaign']);
  assert.deepEqual(chipsOfQuest('path', undefined, false), ['side'], 'a Path is a side story');
  assert.deepEqual(chipsOfQuest('job', 'delivery', false), ['jobs']);
  // «Цели и вести»
  const q = (id: string, kind: QuestDef['kind']) => ({ id, name: id, kind, step: 1, steps: 2, text: '', progress: 0, need: 1 });
  const v = goalSheetView({ quests: [q('side_mika_1', 'story'), q(first.id, 'campaign'), q('job_x', 'job')] });
  assert.equal(v.campaign?.line?.key, `q:${first.id}`, 'the campaign quest on top, as the campaign');
  assert.deepEqual(v.active.map((x) => [x.key, x.kind]), [['q:side_mika_1', 'side'], ['q:job_x', 'job']]);
  // the journal's word = the sheet's word = the switch's class
  assert.equal(classWord(questClass(mika)), 'Побочное');
  assert.equal(classWord(questClass(first)), 'Кампания');
  assert.equal(classWord(questClass({ kind: 'job' })), 'Поручение');
  setLang('en');
});

// ------------------------------------------------------------------ both tongues

test('every word of the campaign reads in Russian, with no Latin; the patterns keep their places', async () => {
  setLang('ru');
  applyDataLocale('ru');
  await loadCampaignWords();
  const bad: string[] = [];
  for (const q of built.quests) {
    for (const s of [q.name, q.mentor, q.summary, q.campaign!.done, ...q.steps.map((x) => x.text), ...(q.campaign!.label ? [q.campaign!.label] : [])]) {
      const ru = serverText(s);
      if (/[A-Za-z]/.test(ru) || ru === s) bad.push(`${q.id}: ${s} → ${ru}`);
    }
  }
  for (const ch of CHAPTERS) for (const t of [ch.title[0], ch.blurb[0]]) if (/[A-Za-z]/.test(serverText(t))) bad.push(t);
  setLang('en');
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} lines not in Russian`);
  for (const [en, ru] of campaignPatterns()) {
    const holes = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort().join();
    assert.equal(holes(ru), holes(en), en);
  }
});

// ------------------------------------------------------------------ the migration

test('the captains of before: their chapter by their level (a sea’s old arcs may carry them on), begun; a new captain at the beginning', () => {
  const fresh = migrateCampaign(1, []);
  assert.deepEqual(fresh, { at: 0, picks: {}, started: false, from: 0 });
  const mid = migrateCampaign(20, []);
  const ch = PLAN.findIndex((p, i) => FIRST_SLOT[i] === mid.at);
  assert.ok(ch >= 0, 'a chapter’s first quest');
  assert.ok(campaignPaces()[mid.at].gate <= 20, 'not above her level');
  assert.ok(ch + 1 >= PLAN.length || campaignPaces()[FIRST_SLOT[ch + 1]].gate > 20, 'the last chapter her level reached');
  assert.equal(mid.started, true);
  assert.equal(mid.from, mid.at);
  // the old arcs of a sea, most of them done: a chapter of that sea a little further on
  const arcs = ['a_leviathan_reach_x_1', 'a_leviathan_reach_x_2', 'a_leviathan_reach_x_3', 'a_leviathan_reach_y_1', 'a_leviathan_reach_y_2', 'a_leviathan_reach_y_3'];
  assert.ok(migrateCampaign(20, arcs).at >= mid.at);
  const top = migrateCampaign(60, []);
  assert.equal(top.at, FIRST_SLOT[PLAN.length - 1], 'a captain of the 60th: the last chapter');
  // a save of before the campaign, through the profile's sanitizer
  const { game } = makeGame();
  join(game, 'Veteran');
  const s = [...game.sessions].find((x) => x.name === 'Veteran')!;
  const old = JSON.parse(JSON.stringify(s.profile)) as typeof s.profile & { campaign?: unknown };
  delete old!.campaign;
  old!.level = 33;
  const p = sanitizeProfile(old!);
  assert.equal(p.campaign!.at, migrateCampaign(33, []).at);
  assert.equal(sanitizeCampaign({ at: 9999, picks: { x: 'q' as never }, started: true, from: 3 }, 1, []).at, CAMPAIGN_SIZE, 'clamped');
});

// ------------------------------------------------------------------ the new steps, by the game's own events

function captain(game: Game, name: string, level = 1): { s: PlayerSession; c: ReturnType<typeof join> } {
  const c = join(game, name);
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = level;
  return { s, c };
}

function atSea(game: Game, s: PlayerSession, x: number, y: number): void {
  s.ship!.docked = null;
  s.profile!.docked = null;
  s.ship!.state.x = x;
  s.ship!.state.y = y;
  game.grid.upsert(s.ship!.id, x, y);
}

/** A quest put under way at a step (its own state, as startQuest makes it). */
function onStep(s: PlayerSession, q: QuestDef, step = 0): void {
  s.profile!.quests.active = [{ id: q.id, step, progress: 0, startedAt: 0 }];
}

const fake = (steps: QuestStep[]): QuestDef => {
  const q: QuestDef = { id: `c99_${Math.random().toString(36).slice(2, 8)}`, kind: 'campaign', name: 'Test', mentor: 'Test', port: 'saltmarrow', summary: '', requires: { level: 1 }, steps, reward: { xp: 1, silver: 1 }, category: 'campaign', campaign: { slot: 9999, ch: 1, k: 0, done: '' } };
  QUESTS_BY_ID[q.id] = q;
  return q;
};

test('new steps tracked by the game: an island’s waters reached, ships boarded (of her level), works laid, men signed on, an island claimed, souls saved', async () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Stepper', 10);
  const isl = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && !i.hidden && !i.slot && i.region === 'black_coast')!;
  // the waters of an island: far off nothing, near its shore the step is done
  const q = fake([{ type: 'isle', island: isl.id, text: 'a' }, { type: 'board', count: 2, minShip: 3, text: 'b' }, { type: 'build', count: 1, text: 'c' }, { type: 'recruit', count: 5, text: 'd' }]);
  onStep(s, q);
  atSea(game, s, isl.x + isl.radius + ISLE_REACH + 3000, isl.y);
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.equal(s.profile!.quests.active[0].step, 0, 'too far off');
  atSea(game, s, isl.x + isl.radius + ISLE_REACH - 100, isl.y);
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.equal(s.profile!.quests.active[0].step, 1, 'the island’s waters reached');
  // boarding: a grey sloop of the first waters does not count for a captain of the 10th; ships of ⚓3 do
  const grey = game.spawnNpcShip('pirate', hullsFor('pirate', 1)[0], 'confederacy', 0, 0, 0);
  game.setNpcLevel(grey, 1);
  questEvent(game, s, { k: 'board', victim: grey });
  assert.equal(s.profile!.quests.active[0].progress, 0, 'a grey ship is not the campaign’s fight');
  for (let i = 0; i < 2; i++) {
    const v = game.spawnNpcShip('pirate', hullsFor('pirate', 3)[0], 'confederacy', 0, 0, 0);
    game.setNpcLevel(v, 3);
    questEvent(game, s, { k: 'board', victim: v });
  }
  assert.equal(s.profile!.quests.active[0].step, 2, 'two boarded');
  // works laid and men signed on: the events the island's yard and the dwellings send
  questEvent(game, s, { k: 'build' });
  assert.equal(s.profile!.quests.active[0].step, 3);
  questEvent(game, s, { k: 'recruit', n: 3 });
  questEvent(game, s, { k: 'recruit', n: 2 });
  assert.equal(s.profile!.quests.active.length, 0, 'done: five men signed on');
  // claim: done once she holds an island (the real claim)
  const { claimIsland } = await import('../server/src/game/baseclaim.ts');
  const cq = fake([{ type: 'claim', text: 'e' }]);
  onStep(s, cq);
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.equal(s.profile!.quests.active.length, 1, 'no island yet');
  atSea(game, s, isl.x + isl.radius + 150, isl.y);
  assert.equal(claimIsland(game, s, isl.id), null);
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.equal(s.profile!.quests.active.length, 0, 'an island of her own');
  // souls saved: a castaway hauled aboard counts
  const { putCastaway, haulCastaway } = await import('../server/src/game/castaways.ts');
  const rq = fake([{ type: 'rescue', count: 1, text: 'f' }]);
  onStep(s, rq);
  atSea(game, s, 30000, 80000);
  const cw = putCastaway(game, s, { x: 30200, y: 80000 }, 1);
  assert.ok(cw, 'a castaway put out');
  haulCastaway(game, s, cw!);
  assert.equal(s.profile!.quests.active.length, 0, 'a soul saved');
});

test('the island’s yard and the dwellings send their events: works laid on her island count, men signed on count', async () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Builder', 20);
  s.profile!.gold = 1e7;
  const isl = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && !i.hidden && !i.slot && i.region === 'black_coast')!;
  atSea(game, s, isl.x + isl.radius + 150, isl.y);
  const { claimIsland } = await import('../server/src/game/baseclaim.ts');
  assert.equal(claimIsland(game, s, isl.id), null);
  const q = fake([{ type: 'build', count: 1, text: 'a' }]);
  onStep(s, q);
  const base = await import('../server/src/game/base.ts');
  const { BUILDINGS } = await import('../shared/src/data/holdings.ts');
  let laid = false;
  for (const id of Object.keys(BUILDINGS)) {
    if (base.startBuild(game, s, null, id) === null) {
      laid = true;
      break;
    }
  }
  if (laid) assert.equal(s.profile!.quests.active.length, 0, 'a work laid on her island is the step');
  else assert.equal(s.profile!.quests.active.length, 1);
});

// ------------------------------------------------------------------ routes

test('«Плыть» has a place for every step of every campaign quest', async () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Router', 30);
  const isl = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && !i.hidden && !i.slot && i.region === 'black_coast')!;
  atSea(game, s, isl.x + isl.radius + 150, isl.y);
  const { claimIsland } = await import('../server/src/game/baseclaim.ts');
  claimIsland(game, s, isl.id); // her island (a «build» step sails there)
  atSea(game, s, 30000, 80000);
  const none: string[] = [];
  for (const q of CAMPAIGN_QUESTS) {
    for (let i = 0; i < q.steps.length; i++) {
      onStep(s, q, i);
      const r = resolveGoal(game, s, `q:${q.id}`);
      if (!('cands' in r) || !r.cands.length) none.push(`${q.id}#${i} ${q.steps[i].type}: ${JSON.stringify(r)}`);
    }
  }
  assert.deepEqual(none.slice(0, 5), [], `${none.length} steps with nowhere to sail`);
});

// ------------------------------------------------------------------ a captain who does only the campaign

/** The events that do a step, as the game sends them (the dock, the tick at sea, a ship boarded or sunk…). */
function doStep(game: Game, s: PlayerSession, st: QuestStep): void {
  const ship = s.ship!;
  const dock = (id: string) => {
    const port = game.portById(id)!;
    ship.docked = port.id;
    s.profile!.docked = port.id;
    ship.state.x = port.x;
    ship.state.y = port.y;
    questEvent(game, s, { k: 'dock', port });
  };
  const foe = (role: 'pirate' | 'ghost' | 'patrol' | 'merchant' | 'hunter', lv: number) => {
    const v = game.spawnNpcShip(role, hullsFor('pirate', lv)[0], role === 'ghost' ? 'choir' : role === 'patrol' ? 'crown' : 'confederacy', 0, 0, 0);
    game.setNpcLevel(v, lv);
    return v;
  };
  switch (st.type) {
    case 'visit':
      return dock(st.port);
    case 'pickup':
      return dock(st.port);
    case 'deliver':
      ship.cargo[st.good] = Math.max(ship.cargo[st.good] ?? 0, st.qty);
      return dock(st.port);
    case 'isle': {
      const is = game.world.islands[st.island];
      ship.docked = null;
      ship.state.x = is.x + is.radius + 200;
      ship.state.y = is.y;
      return questEvent(game, s, { k: 'tick', dt: 1 });
    }
    case 'land':
      return questEvent(game, s, { k: 'land', island: st.island, feature: st.site ?? 'beach' });
    case 'board':
      for (let i = 0; i < st.count; i++) questEvent(game, s, { k: 'board', victim: foe('pirate', Math.min(10, (st.minShip ?? 1) + 1)) });
      return;
    case 'sink':
      for (let i = 0; i < st.count; i++) questEvent(game, s, { k: 'sink', victim: foe((st.role ?? 'pirate') as 'pirate', Math.min(10, (st.minShip ?? 1) + 1)) });
      return;
    case 'lair':
      for (let i = 0; i < st.count; i++) questEvent(game, s, { k: 'lair', island: -1, kind: 'any' });
      return;
    case 'beast': {
      const b = BEAST_IDS.find((id) => st.group === 'any' || BEASTS[id].group === st.group)!;
      for (let i = 0; i < st.count; i++) questEvent(game, s, { k: 'beast', beast: b });
      return;
    }
    case 'chart':
    case 'dive':
    case 'named':
    case 'prize':
    case 'tribute':
    case 'customs': {
      const k = st.type === 'chart' ? 'chart' : st.type === 'dive' ? 'dive' : st.type === 'named' ? 'named' : st.type === 'prize' ? 'prize' : st.type === 'tribute' ? 'tribute' : 'customs';
      const n = 'count' in st ? st.count : 1;
      for (let i = 0; i < n; i++) questEvent(game, s, { k } as never);
      return;
    }
    case 'catch':
      return questEvent(game, s, { k: 'catch', units: st.count, kg: 1, fought: false });
    case 'rescue':
      return questEvent(game, s, { k: 'rescue', n: st.count });
    case 'time_in':
    case 'reach': {
      ship.docked = null;
      const [x, y] = REGIONS[st.region].center;
      ship.state.x = x;
      ship.state.y = y;
      ship.region = st.region;
      return questEvent(game, s, { k: 'tick', dt: st.type === 'time_in' ? st.seconds : 1 });
    }
    case 'claim':
      return questEvent(game, s, { k: 'tick', dt: 1 });
    case 'build':
      for (let i = 0; i < st.count; i++) questEvent(game, s, { k: 'build' });
      return;
    case 'recruit':
      return questEvent(game, s, { k: 'recruit', n: st.count });
    case 'sell_contraband':
      return questEvent(game, s, { k: 'sell_contraband', qty: st.qty, port: st.port ?? 'fogmouth' });
    default:
      throw new Error(`no event does a step of ${st.type}`);
  }
}

test('a captain who does only the campaign: every quest taken and done by the game’s events, the 60th level at its end', async () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Campaigner', 1);
  const p = s.profile!;
  p.campaign!.started = true;
  const isl = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && !i.hidden && !i.slot && i.region === 'black_coast')!;
  atSea(game, s, isl.x + isl.radius + 150, isl.y);
  const { claimIsland } = await import('../server/src/game/baseclaim.ts');
  claimIsland(game, s, isl.id); // the island of chapter 6 (claimed early here: the step then is done at once)
  const camp = campaignOf(game);
  const pace: { ch: number; from: number; to: number }[] = [];
  let guard = 0, picks = 0;
  while (p.campaign!.at < CAMPAIGN_SIZE && guard++ < 5000) {
    const slot = camp.bySlot.get(p.campaign!.at)!;
    assert.ok(p.level >= slot.gate, `slot ${slot.slot}: level ${p.level} below its gate ${slot.gate}`);
    if (slot.k === 0) pace.push({ ch: slot.ch, from: p.level, to: p.level });
    if (!campaignActive(p)) {
      // a branch is hers to choose (both ways in turn); the rest come by themselves after the first
      const way = slot.b && picks++ % 2 ? slot.b : slot.a;
      c.push({ t: 'quest', action: 'accept', id: way.id });
    }
    const qs = campaignActive(p);
    assert.ok(qs, `slot ${slot.slot}: taken`);
    const q = QUESTS_BY_ID[qs!.id];
    const before = p.campaign!.at;
    for (let i = 0; i < 6 && p.campaign!.at === before; i++) {
      const st = q.steps[campaignActive(p)?.step ?? 0];
      if (!st) break;
      doStep(game, s, st);
    }
    // (one done, or more: a next quest whose first place is where she stands is done as it comes)
    assert.ok(p.campaign!.at > before, `${q.id} done (${q.steps.map((x) => x.type).join(',')})`);
    pace[pace.length - 1].to = p.level;
    if (p.campaign!.at === FIRST_SLOT[WALL_CHAPTER - 1]) assert.ok(abyssCleared(game, s), 'the Wall lets her through at the Abyss’s chapters');
  }
  assert.equal(p.campaign!.at, CAMPAIGN_SIZE, 'the whole campaign');
  assert.equal(p.level, MAX_LEVEL, 'the 60th level from the campaign alone');
  assert.ok(Object.keys(p.campaign!.picks).length >= 8, 'the branches chosen');
  assert.ok(c.all('toast').some((t) => t.msg === 'The campaign is done. The tide sleeps.'));
  // the pace (docs/36 §4): the chapters' levels rise with the plan
  for (let i = 1; i < pace.length; i++) assert.ok(pace[i].from >= pace[i - 1].from, `chapter ${pace[i].ch}`);
  if (process.env.CAMPAIGN_PACE) console.log(pace.map((x) => `ch${x.ch}: ${x.from}→${x.to}`).join('  '));
});

test('the campaign quest is taken anywhere, offered at every port, waits for its level, and the next comes by itself', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Newcomer', 1);
  const p = s.profile!;
  const first = campaignOf(game).bySlot.get(0)!.a;
  // offered on the board of a port that is not its mentor's
  const port = game.portById('gravesend')!;
  s.ship!.docked = port.id;
  p.docked = port.id;
  c.push({ t: 'quest', action: 'decline', id: 'x' });
  game.pushPort(s);
  const offers = c.last('port')!.view!.questOffers;
  const o = offers.find((x) => x.id === first.id);
  assert.ok(o && o.kind === 'campaign' && o.blocked === null && o.cmp?.ch === 1 && o.cmp.k === 0, 'the campaign’s first quest on another port’s board');
  // taken at sea (from «Цели и вести»)
  atSea(game, s, 30000, 80000);
  c.push({ t: 'quest', action: 'accept', id: first.id });
  assert.equal(campaignActive(p)?.id, first.id, 'taken at sea');
  // a quest not of her place is refused
  c.push({ t: 'quest', action: 'accept', id: campaignOf(game).bySlot.get(5)!.a.id });
  assert.equal(p.quests.active.length, 1);
  // done: the next comes by itself
  for (const st of first.steps) doStep(game, s, st);
  assert.equal(p.campaign!.at, 1);
  assert.equal(campaignActive(p)?.id, campaignOf(game).bySlot.get(1)!.a.id, 'the next quest under way at once');
  // a captain below a quest's level: it waits and says why
  p.campaign!.at = 400;
  p.quests.active = [];
  game.pushSelf(s, true);
  const view = c.last('self')!.self.campaign!;
  assert.equal(view.blocked, `Level ${campaignOf(game).bySlot.get(400)!.gate}`);
  assert.equal(view.next.length, 3);
});
