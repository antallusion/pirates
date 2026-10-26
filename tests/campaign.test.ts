import type { Island } from '../shared/src/world/worldgen.ts';
// The main campaign (docs/36; owner, 2026-10-17: «в сюжете минимум (в кампании главной) должно быть 700 крутых квестов
// и только пройдя их ты должен быть максимального уровня … один из шагов должен быть … посещение острова и несколько
// абордажей … сети мики числится как побочное»): its size and shape, the one taxonomy on every screen, the road of
// experience to the 60th, the steps tracked by the game's own events (the new ones too), a route for every step, both
// tongues, the migration of the captains of before — and a captain who does nothing but the campaign, from its first
// quest to its last, in a real game: the 60th level at its end.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, WORLD_SEED, xpForLevel } from '../shared/src/constants.ts';
import { CHAPTER_LEG, LOCAL_R, OPENING_SLOTS, buildCampaign, locDist, nearGood } from '../shared/src/data/campaign/build.ts';
import { campaignChainLegs } from '../shared/src/data/chainaudit.ts';
import { CHAIN_LEG, legTo, nearestSellerByRoute } from '../shared/src/data/questlegs.ts';
import { navLen } from '../shared/src/world/navlen.ts';
import { CHAPTERS } from '../shared/src/data/campaign/chapters.ts';
import { checkChapter } from '../shared/src/data/campaign/check.ts';
import { campaignPaces, roadXp } from '../shared/src/data/campaign/pacing.ts';
import { CAMPAIGN_SIZE, PLAN, WALL_CHAPTER } from '../shared/src/data/campaign/plan.ts';
import { FIRST_SLOT, migrateCampaign, sanitizeCampaign } from '../shared/src/data/campaign/progress.ts';
import { campaignPatterns } from '../shared/src/data/campaign/patterns.ts';
import { questClass } from '../shared/src/data/questclass.ts';
import { QUEST_PAY_MEAN, jobSilver } from '../shared/src/data/silverpay.ts';
import { shipBandOf } from '../shared/src/data/xpcurve.ts';
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
import { campaignActive, campaignFoes, campaignNext, campaignOf } from '../server/src/game/campaign.ts';
import type { Game } from '../server/src/game/Game.ts';
import { resolveGoal } from '../server/src/game/goalroute.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { sanitizeProfile } from '../server/src/game/player.ts';
import { ISLE_REACH, questEvent } from '../server/src/game/quests.ts';
import { join, makeGame } from './helpers.ts';
import { offCoast } from './helpers.ts';

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
    // (an island's waters, or — where none lies within a chain's leg, owner 2026-10-23 — the coves of its harbour's own)
    assert.ok(qs.filter((q) => q.steps.some((x) => x.type === 'isle' || x.type === 'spot')).length >= 2, `chapter ${ch.n}: islands`);
    assert.ok(qs.filter((q) => q.steps.some((x) => x.type === 'board')).length >= 3, `chapter ${ch.n}: boardings`);
    for (const q of qs) for (const st of q.steps) mix[st.type] = (mix[st.type] ?? 0) + 1;
  }
  for (const t of ['visit', 'isle', 'land', 'board', 'sink', 'lair', 'beast', 'deliver', 'pickup', 'time_in', 'chart', 'dive', 'claim', 'build', 'recruit', 'named', 'rescue', 'buy', 'neutral']) assert.ok(mix[t] > 0, `the campaign has ${t} steps`);
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
  // the sea's silver (docs/26 §11): a job of the usual size of its waters, no more
  for (const p of paces) assert.equal(p.silver, jobSilver(QUEST_PAY_MEAN, shipBandOf(p.gate)), `silver at ${p.gate}`);
});

// ------------------------------------------------------------------ the one taxonomy

test('one taxonomy on every screen: «Сети Мики» is a side quest everywhere, a campaign quest is the campaign everywhere', () => {
  setLang('ru');
  const mika = QUESTS_BY_ID.side_mika_1 ?? { id: 'side_mika_1', kind: 'story' as const };
  const first = built.slots[0].a;
  // the port's switch
  assert.deepEqual(chipsOfQuest(mika.kind, undefined, false), ['side']);
  assert.deepEqual(chipsOfQuest(first.kind, first.category, false), [], 'the campaign is on no board (it goes on by itself, owner 2026-10-18)');
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
  assert.deepEqual(fresh, { at: 0, picks: {}, started: true, from: 0 });
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

/** At sea off an island's coast, her hull within its thirty metres (owner, 2026-10-22: reach.ts). */
function atCoast(game: Game, s: PlayerSession, is: Island): void {
  atSea(game, s, is.x + is.radius + 150, is.y);
  assert.ok(offCoast(game, s.ship!, is), 'water off its coast'); // (her hull within its thirty metres — reach.ts)
  assert.ok(offCoast(game, s.ship!, is), 'water off its coast');
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
  atCoast(game, s, isl);
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
  atCoast(game, s, isl);
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
  atCoast(game, s, isl);
  const { claimIsland } = await import('../server/src/game/baseclaim.ts');
  assert.equal(claimIsland(game, s, isl.id), null);
  const q = fake([{ type: 'build', count: 1, text: 'a' }]);
  onStep(s, q);
  // the builders' timber from her hold (she lies off her island)
  Object.assign(s.ship!.cargo, { timber: 300, planks: 300, iron: 300, coal: 300, sailcloth: 300 });
  const base = await import('../server/src/game/base.ts');
  const { BUILDINGS } = await import('../shared/src/data/holdings.ts');
  let laid = false;
  for (const id of Object.keys(BUILDINGS)) {
    if (base.startBuild(game, s, null, id) === null) {
      laid = true;
      break;
    }
  }
  assert.ok(laid, 'a work laid');
  assert.equal(s.profile!.quests.active.length, 0, 'a work laid on her island is the step');
  // men signed on at a port's tavern (the dwellings' recruit) count too
  const dwell = await import('../server/src/game/dwell.ts');
  const rq = fake([{ type: 'recruit', count: 1, text: 'b' }]);
  onStep(s, rq);
  const port = game.portById('saltmarrow')!;
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  s.ship!.crew = Math.min(s.ship!.crew, 5); // hammocks free
  const why = dwell.recruit(game, s, 'port', s.ship!.army[0].u, 3); // more of the kind she has (a slot of her army)
  assert.equal(why, null, `signed on: ${why}`);
  assert.equal(s.profile!.quests.active.length, 0, 'men signed on are the step');
});

// ------------------------------------------------------------------ routes

test('«Плыть» has a place for every step of every campaign quest', async () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Router', 30);
  const isl = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && !i.hidden && !i.slot && i.region === 'black_coast')!;
  atCoast(game, s, isl);
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

/** The sea she sails in the sim, by session (straight lines from place to place). */
const logbook = new WeakMap<PlayerSession, { x: number; y: number; km: number }>();
function sailed(s: PlayerSession, x: number, y: number): void {
  const b = logbook.get(s) ?? { x: s.ship!.state.x, y: s.ship!.state.y, km: 0 };
  b.km += Math.hypot(x - b.x, y - b.y) / 1000;
  b.x = x;
  b.y = y;
  logbook.set(s, b);
}
const kmSailed = (s: PlayerSession): number => logbook.get(s)?.km ?? 0;

/** The events that do a step, as the game sends them (the dock, the tick at sea, a ship boarded or sunk…). */
function doStep(game: Game, s: PlayerSession, st: QuestStep): void {
  const ship = s.ship!;
  const dock = (id: string) => {
    const port = game.portById(id)!;
    sailed(s, port.x, port.y);
    if (ship.docked === port.id) { ship.docked = null; questEvent(game, s, { k: 'tick', dt: 1 }); } // (she puts out and comes in again)
    ship.docked = port.id;
    s.profile!.docked = port.id;
    ship.state.x = port.x;
    ship.state.y = port.y;
    questEvent(game, s, { k: 'dock', port });
  };
  // (a step of a location is done in its waters: she sails there — the trip is the sim's count of the sea sailed)
  const there = (n: { x: number; y: number } | undefined) => {
    if (!n) return;
    sailed(s, n.x, n.y);
    ship.docked = null;
    ship.state.x = n.x;
    ship.state.y = n.y;
  };
  const near = 'near' in st ? (st as { near?: { x: number; y: number; r: number } }).near : undefined;
  there(near);
  const foe = (role: 'pirate' | 'ghost' | 'patrol' | 'merchant' | 'hunter', lv: number) => {
    const v = game.spawnNpcShip(role, hullsFor('pirate', lv)[0], role === 'ghost' ? 'choir' : role === 'patrol' ? 'crown' : 'confederacy', near?.x ?? 0, near?.y ?? 0, 0);
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
      sailed(s, is.x + is.radius + 200, is.y);
      assert.ok(offCoast(game, ship, is), 'water off its coast');
      return questEvent(game, s, { k: 'tick', dt: 1 });
    }
    case 'land': {
      const is = game.world.islands[st.island];
      sailed(s, is.x + is.radius + 200, is.y);
      assert.ok(offCoast(game, ship, is), 'water off its coast'); // (her hull within its thirty metres — reach.ts)
      return questEvent(game, s, { k: 'land', island: st.island, feature: st.site ?? 'beach' });
    }
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
      if (!near) {
        const [x, y] = REGIONS[st.region].center;
        sailed(s, x, y);
        ship.state.x = x;
        ship.state.y = y;
      }
      ship.region = st.region;
      return questEvent(game, s, { k: 'tick', dt: st.type === 'time_in' ? st.seconds : 1 });
    }
    case 'spot':
      sailed(s, st.x, st.y);
      ship.docked = null;
      ship.state.x = st.x;
      ship.state.y = st.y;
      return questEvent(game, s, { k: 'tick', dt: 1 });
    case 'claim':
      return questEvent(game, s, { k: 'tick', dt: 1 });
    // the opening (owner, 2026-10-19): a purchase at a port's shop; a neutral stack of the sea beaten
    case 'buy':
      return questEvent(game, s, { k: 'buy', shop: st.shop, port: 'saltmarrow' });
    case 'neutral':
      for (let i = 0; i < st.count; i++) questEvent(game, s, { k: 'neutral' });
      return;
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
  atCoast(game, s, isl);
  const { claimIsland } = await import('../server/src/game/baseclaim.ts');
  claimIsland(game, s, isl.id); // the island of chapter 6 (claimed early here: the step then is done at once)
  const camp = campaignOf(game);
  const pace: { ch: number; from: number; to: number; km0: number; km: number; legs: number }[] = [];
  let guard = 0, picks = 0;
  while (p.campaign!.at < CAMPAIGN_SIZE && guard++ < 5000) {
    const slot = camp.bySlot.get(p.campaign!.at)!;
    assert.ok(p.level >= slot.gate, `slot ${slot.slot}: level ${p.level} below its gate ${slot.gate}`);
    if (slot.k === 0) pace.push({ ch: slot.ch, from: p.level, to: p.level, km0: kmSailed(s), km: 0, legs: 0 });
    const before0 = kmSailed(s);
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
    const cur = pace[pace.length - 1];
    if (slot.travel) cur.legs += kmSailed(s) - before0;
    cur.km = kmSailed(s) - cur.km0;
    if (p.campaign!.at === FIRST_SLOT[WALL_CHAPTER - 1]) assert.ok(abyssCleared(game, s), 'the Wall lets her through at the Abyss’s chapters');
  }
  assert.equal(p.campaign!.at, CAMPAIGN_SIZE, 'the whole campaign');
  assert.equal(p.level, MAX_LEVEL, 'the 60th level from the campaign alone');
  assert.ok(Object.keys(p.campaign!.picks).length >= 8, 'the branches chosen');
  assert.ok(c.all('toast').some((t) => t.msg === 'The campaign is done. The tide sleeps.'));
  // the pace (docs/36 §4): the chapters' levels rise with the plan
  for (let i = 1; i < pace.length; i++) assert.ok(pace[i].from >= pace[i - 1].from, `chapter ${pace[i].ch}`);
  // the sea sailed: the voyages between locations, and a little in each location's waters
  const local = pace.map((x) => x.km - x.legs);
  for (const [i, x] of pace.entries()) assert.ok(local[i] / 20 < 6, `chapter ${x.ch}: ${local[i].toFixed(0)} km about its locations (a modest few a quest)`);
  console.log(pace.map((x) => `ch${x.ch}: L${x.from}→${x.to} ${x.km.toFixed(0)} km (voyages ${x.legs.toFixed(0)})`).join(' | '));
});

test('the campaign is never taken: its first quest is under way from the first level, never on a board, the next comes at once', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Newcomer', 1);
  const p = s.profile!;
  const first = campaignOf(game).bySlot.get(0)!.a;
  assert.equal(campaignActive(p)?.id, first.id, 'under way from the first level, untaken');
  assert.ok(c.all('campaign_new').some((m) => m.id === first.id && !m.choice), 'a toast and a card: «Новое задание кампании»');
  // not on any port's board
  const port = game.portById('gravesend')!;
  s.ship!.docked = port.id;
  p.docked = port.id;
  game.pushPort(s);
  assert.ok(!c.last('port')!.view!.questOffers.some((o) => o.kind === 'campaign'), 'no campaign on a board');
  // not set aside
  c.push({ t: 'quest', action: 'abandon', id: first.id });
  assert.equal(campaignActive(p)?.id, first.id, 'the campaign is not set aside');
  // done: the next under way at once, and told
  atSea(game, s, 30000, 80000);
  for (const st of first.steps) doStep(game, s, st);
  assert.equal(p.campaign!.at, 1);
  const second = campaignOf(game).bySlot.get(1)!.a;
  assert.equal(campaignActive(p)?.id, second.id, 'the next quest under way at once');
  assert.ok(c.all('campaign_new').some((m) => m.id === second.id));
});

test('the next waits for its level («следующее с уровня N») and comes by itself on reaching it', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Waiter', 1);
  const p = s.profile!;
  const slot = campaignOf(game).bySlot.get(400)!;
  p.campaign!.at = 400;
  p.quests.active = [];
  p.level = slot.gate - 1;
  campaignNext(game, s, true);
  assert.equal(campaignActive(p), undefined, 'not yet: her level is below its gate');
  game.pushSelf(s, true);
  const view = c.last('self')!.self.campaign!;
  assert.equal(view.blocked, `Level ${slot.gate}`);
  assert.equal(view.gate, slot.gate);
  // the level reached: it comes by itself
  p.xp = 0;
  game.grantXp(s, xpForLevel(p.level), null, false, true);
  assert.equal(p.level, slot.gate);
  assert.equal(campaignActive(p)?.id, slot.a.id, 'under way at its level');
  // migrated captains of before: their quest under way on coming aboard
  const { s: v } = captain(game, 'Veteranx', 1);
  v.profile!.quests.active = [];
  v.profile!.campaign = migrateCampaign(25, []);
  v.profile!.level = 25;
  campaignNext(game, v);
  assert.equal(campaignActive(v.profile!)?.id, campaignOf(game).bySlot.get(v.profile!.campaign!.at)!.a.id, 'a migrated captain’s quest under way');
});

test('a fork: its two ways put before her (a card and a popup), none under way till she chooses; the choice is kept', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Forker', 60);
  const p = s.profile!;
  const fork = campaignOf(game).slots.find((x) => x.b)!;
  p.campaign!.at = fork.slot;
  p.quests.active = [];
  campaignNext(game, s);
  assert.equal(campaignActive(p), undefined, 'a fork waits for her choice');
  const news = c.all('campaign_new').at(-1)!;
  assert.deepEqual(news.choice?.map((w) => w.id), [fork.a.id, fork.b!.id], 'both ways offered');
  game.pushSelf(s, true);
  assert.equal(c.last('self')!.self.campaign!.ways!.length, 2, 'the card in the journal and «Цели и вести»');
  c.push({ t: 'quest', action: 'accept', id: fork.b!.id });
  assert.equal(campaignActive(p)?.id, fork.b!.id, 'her way under way');
  for (const st of fork.b!.steps) doStep(game, s, st);
  assert.equal(p.campaign!.picks[fork.b!.campaign!.key!], 'b', 'the choice kept');
});

test('the campaign’s fight comes to her: on a boarding step at sea, foes of the quest’s level put out near her, two at most', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Hunted', 3);
  const q = campaignOf(game).bySlot.get(2)!.a; // «Борт о борт», the opening's boarding (owner, 2026-10-19)
  assert.equal(q.steps[0].type, 'board');
  s.profile!.campaign!.at = 2;
  onStep(s, q);
  const near = (q.steps[0] as Extract<QuestStep, { type: 'board' }>).near!;
  atSea(game, s, near.x + 600, near.y); // the Crown's quiet waters of the location: no raiders of their own
  for (let t = 0; t < 120; t++) {
    game.now += 1;
    questEvent(game, s, { k: 'tick', dt: 1 });
  }
  const foes = campaignFoes(game, s).map((id) => game.ships.get(id)!);
  assert.ok(foes.length >= 1 && foes.length <= 2, `${foes.length} foes`);
  for (const f of foes) {
    assert.equal(f.npcRole, 'pirate');
    assert.ok(Math.hypot(f.state.x - near.x, f.state.y - near.y) <= near.r, 'put out in the location’s waters');
  }
  questEvent(game, s, { k: 'board', victim: foes[0] });
  assert.ok(s.profile!.campaign!.at > 2 || s.profile!.quests.active[0].step >= 1, 'boarding one of them is the step');
});

test('an «arrive at» step is done by arriving after the quest is taken: not by the port she lies in when it comes', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Arriver', 5);
  const p = s.profile!;
  // a campaign quest whose first step is the very port she lies in (the seam of chapters 2 and 3)
  const q = fake([{ type: 'visit', port: 'gallowsmouth', text: 'a' }, { type: 'visit', port: 'saltmarrow', text: 'b' }]);
  const port = game.portById('gallowsmouth')!;
  s.ship!.docked = port.id;
  p.docked = port.id;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  p.quests.active = []; // (the campaign's own quest, under way from the start, set by)
  p.campaign!.at = 5;
  q.campaign!.slot = 5;
  p.campaign!.started = true;
  c.push({ t: 'quest', action: 'accept', id: q.id });
  assert.equal(campaignActive(p)?.id, q.id, 'taken where she lies');
  assert.equal(campaignActive(p)?.step, 0, 'not done by the port she was already in');
  // «Плыть» there does the step in this very port (owner 2026-10-26, «Плыть» must always do something — goalroute.ts
  // gotoGoal → «quest here»; was the toast «cast off and put in again»)
  c.push({ t: 'goto', key: `q:${q.id}` });
  assert.ok(!c.all('toast').some((t) => t.msg.startsWith('You are in that port already')));
  assert.equal(campaignActive(p)?.step, 1, '«Плыть» in that port does the step');
  p.quests.active.find((a) => a.id === q.id)!.step = 0;
  // she casts off and comes back in: done
  s.ship!.docked = null;
  questEvent(game, s, { k: 'tick', dt: 1 });
  s.ship!.docked = port.id;
  questEvent(game, s, { k: 'dock', port });
  assert.equal(campaignActive(p)?.step, 1, 'arriving after it was taken makes the step');
});

test('the cargo steps are still done in the port she lies in: a delivery handed over at once', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Carrier', 5);
  const q = fake([{ type: 'deliver', port: 'saltmarrow', good: 'rum', qty: 2, text: 'a' }, { type: 'visit', port: 'saltmarrow', text: 'b' }]);
  onStep(s, q);
  const port = game.portById('saltmarrow')!;
  s.ship!.docked = port.id;
  s.ship!.cargo.rum = 5;
  questEvent(game, s, { k: 'dock', port, fresh: true });
  assert.equal(s.profile!.quests.active[0].step, 1, 'the rum handed over');
  questEvent(game, s, { k: 'dock', port });
  assert.equal(s.profile!.quests.active.length, 0, 'and reported on a real arrival');
});

// ------------------------------------------------------------------ location by location (owner, 2026-10-18)

test('location by location: small runs (2–6 quests), each done within 1.5 km of its location; the voyage is the run’s first quest', () => {
  const locs = built.locations;
  assert.ok(locs.length >= 130 && locs.length <= 260, `${locs.length} locations`);
  for (const l of locs) assert.ok(l.size >= 2 && l.size <= 6, `${l.name}: a run of ${l.size}`);
  assert.equal(locs.reduce((a, l) => a + l.size, 0), CAMPAIGN_SIZE);
  const far: string[] = [];
  let checked = 0;
  for (const sl of built.slots) {
    const L = locs[sl.loc];
    assert.equal(sl.travel, sl.slot === L.from && L.i > 0, `${sl.a.id}: the voyage is the first of its run`);
    // (the opening's fights are on the lane out to the island of her town, owner 2026-10-19: tests/opening.test.ts)
    if (sl.slot < OPENING_SLOTS) continue;
    for (const q of [sl.a, ...(sl.b ? [sl.b] : [])]) {
      const pick = q.steps.some((x) => x.type === 'pickup');
      for (const st of q.steps) {
        let d = 0;
        if (st.type === 'visit' || st.type === 'pickup' || (st.type === 'deliver' && !pick)) {
          const p = world.ports.find((x) => x.id === st.port)!;
          d = Math.hypot(p.x - L.x, p.y - L.y);
        } else if (st.type === 'isle' || st.type === 'land') d = locDist(world, L, world.islands[st.island]);
        else if (st.type === 'spot') d = Math.hypot(st.x - L.x, st.y - L.y);
        else if ('near' in st && st.near) d = Math.hypot(st.near.x - L.x, st.near.y - L.y);
        else continue;
        checked++;
        // (a good sold nowhere near waits at a neighbour's quay: within a chain's leg — owner, 2026-10-23)
        const lim = st.type === 'pickup' && st.port !== L.id ? CHAIN_LEG : LOCAL_R + 50;
        if (d > lim) far.push(`${q.id} ${st.type} ${Math.round(d)} m from ${L.name}`);
      }
    }
  }
  assert.ok(checked > 1000, `${checked} places`);
  assert.deepEqual(far.slice(0, 5), [], `${far.length} places farther than 1.5 km`);
  // a delivery between the location's port and the nearest other harbour: a short run along the coast
  for (const q of built.quests) for (const st of q.steps) if (st.type === 'deliver' && q.steps.some((x) => x.type === 'pickup')) {
    const L = locs[q.campaign!.loc!];
    const p = world.ports.find((x) => x.id === st.port)!;
    assert.ok(Math.hypot(p.x - L.x, p.y - L.y) < 8000, `${q.id}: a delivery to the next harbour`);
  }
});

test('a harbour with no island within reach of its quay: no island steps there — its own island’s coves and spits instead', () => {
  const sail = world.islands.filter((i) => !i.minor && !i.raft && !i.hidden && !i.slot && !i.portId);
  const bare = built.locations.filter((l) => l.kind === 'port' && !sail.some((i) => locDist(world, l, i) <= LOCAL_R));
  assert.ok(bare.some((l) => l.id === 'saltmarrow'), 'Saltmarrow is such a harbour');
  let spots = 0;
  for (const sl of built.slots) {
    if (!bare.includes(built.locations[sl.loc])) continue;
    for (const q of [sl.a, ...(sl.b ? [sl.b] : [])]) for (const st of q.steps) {
      assert.ok(st.type !== 'isle' && st.type !== 'land', `${q.id}: no island steps at ${built.locations[sl.loc].name}`);
      if (st.type === 'spot') spots++;
    }
  }
  assert.ok(spots > 5, `${spots} coves and spits`);
});

test('the voyages (owner, 2026-10-23: «максимум на удалении 3км друг от друга»): within a chapter no voyage between its places over CHAPTER_LEG on the sea route; the one long sail a chapter asks is its hand-over', () => {
  for (const seed of [1337, WORLD_SEED]) {
    const w = seed === 1337 ? world : generateWorld(seed);
    const c = seed === 1337 ? built : buildCampaign(w, seed, CHAPTERS);
    const far: string[] = [];
    c.locations.forEach((l, i) => {
      const prev = c.locations[i - 1];
      if (!prev || prev.ch !== l.ch || (i === c.locations.length - 1 && l.id === 'saltmarrow')) return;
      if (prev.id === l.id && prev.kind === l.kind) return;
      if (l.passage) return; // (a ship takes her there: chainlegs.test.ts)
      const a = prev.kind === 'isle' ? w.islands[prev.id as number] : null, b = l.kind === 'isle' ? w.islands[l.id as number] : null;
      // (quay to quay, or into an island's waters from the facing shore)
      const from = a ? { x: a.x + ((l.x - a.x) / Math.hypot(l.x - a.x, l.y - a.y)) * (a.radius + 40), y: a.y + ((l.y - a.y) / Math.hypot(l.x - a.x, l.y - a.y)) * (a.radius + 40) } : prev;
      const d = b ? legTo(w, from, { x: b.x, y: b.y, r: b.radius + 40, name: '' }, CHAIN_LEG).d : navLen(w, from.x, from.y, l.x, l.y, CHAIN_LEG);
      if (!(d <= CHAIN_LEG + 1)) far.push(`ch${l.ch} ${prev.name} → ${l.name}: ${(d / 1000).toFixed(1)} km`);
    });
    assert.deepEqual(far, [], `seed ${seed}`);
  }
});

test('chapter 6 (mid-game QA 2026-10-23: it opened with 26 km to Gravesend, the pledge’s pearls sold 15 km off): its `at:` harbour no pull from afar, the pledge taken on within 3 km', () => {
  for (const seed of [1337, WORLD_SEED]) {
    const w = seed === 1337 ? world : generateWorld(seed);
    const c = seed === 1337 ? built : buildCampaign(w, seed, CHAPTERS);
    const legs = campaignChainLegs(w, c).legs.filter((l) => l.quest === 'c06_01' || l.quest === 'c06_02');
    assert.ok(legs.length >= 2);
    for (const l of legs) assert.ok(l.d <= CHAIN_LEG + 1, `seed ${seed}: ${l.quest} → ${l.to} ${(l.d / 1000).toFixed(1)} km`);
    const q = c.quests.find((x) => x.id === 'c06_02')!;
    assert.ok(q.steps.some((st) => st.type === 'deliver'), 'the pledge delivered');
  }
});

test('a delivery’s good its words do not name is the one of its kind sold near; one they name is kept', () => {
  const ports = world.ports.filter((p) => !p.raft);
  const far = ports.find((h) => !nearestSellerByRoute(world, h, 'pearls', undefined, CHAIN_LEG) && KIN_NEAR.some((g) => nearestSellerByRoute(world, h, g, undefined, 1500)))!;
  assert.ok(far, 'a harbour with no pearls near');
  const g = nearGood(world, far, 'pearls', 'bring a pledge of costly goods');
  assert.notEqual(g, 'pearls');
  assert.ok(nearestSellerByRoute(world, far, g, undefined, CHAIN_LEG));
  assert.equal(nearGood(world, far, 'pearls', 'bring pearls and ask for a strongroom'), 'pearls');
  assert.equal(nearGood(world, far, 'gunpowder', 'bring good powder north'), 'gunpowder');
});
const KIN_NEAR = ['spices', 'tobacco', 'scrimshaw', 'ambergris', 'narwhal_tusk'] as const;

test('the locations go through all the seas, the start and the end at home, the seas first come to as their levels rise', () => {
  const firsts = new Map<string, number>();
  for (const l of built.locations) if (!firsts.has(l.region)) firsts.set(l.region, campaignPaces()[l.from].gate);
  assert.equal(firsts.size, 8, 'every sea');
  assert.equal(built.locations[0].region, 'black_coast');
  assert.equal(built.locations.at(-1)!.id, 'saltmarrow', 'home at the end');
  const gates = [...firsts.values()];
  for (let i = 1; i < gates.length; i++) assert.ok(gates[i] >= gates[i - 1], 'each sea first come to no earlier than the one before');
  assert.equal([...firsts.keys()].at(-1), 'the_abyss');
  const ports = new Set(built.locations.filter((l) => l.kind === 'port').map((l) => l.id));
  // (a chapter's places within 3 km of each other and of where the one before ended — owner, 2026-10-23 — so fewer
  // harbours, a run often held where it was)
  assert.ok(ports.size >= 18, `${ports.size} harbours`);
  assert.ok(built.locations.some((l) => l.kind === 'isle' && l.region === 'the_abyss'), 'islands of the Abyss itself');
});

test('a location’s fight puts out in its waters, and only there', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Local', 10);
  const sl = campaignOf(game).slots.find((x) => x.a.steps[0].type === 'board' && x.gate <= 10)!;
  const st = sl.a.steps[0] as Extract<QuestStep, { type: 'board' }>;
  s.profile!.campaign!.at = sl.slot;
  onStep(s, sl.a);
  atSea(game, s, st.near!.x + 9000, st.near!.y); // far from its waters: nothing comes
  for (let t = 0; t < 60; t++) {
    game.now += 1;
    questEvent(game, s, { k: 'tick', dt: 1 });
  }
  assert.equal(campaignFoes(game, s).length, 0, 'no fight far from the location');
  atSea(game, s, st.near!.x + 1000, st.near!.y);
  for (let t = 0; t < 60; t++) {
    game.now += 1;
    questEvent(game, s, { k: 'tick', dt: 1 });
  }
  const foes = campaignFoes(game, s).map((id) => game.ships.get(id)!);
  assert.ok(foes.length >= 1);
  for (const f of foes) assert.ok(Math.hypot(f.state.x - st.near!.x, f.state.y - st.near!.y) <= st.near!.r, 'in the location’s waters');
  // a ship boarded far away does not count for it
  const v = game.spawnNpcShip('pirate', hullsFor('pirate', st.minShip! + 1)[0], 'confederacy', st.near!.x + 20000, st.near!.y, 0);
  game.setNpcLevel(v, st.minShip! + 1);
  questEvent(game, s, { k: 'board', victim: v });
  assert.equal(s.profile!.quests.active[0].progress, 0);
  questEvent(game, s, { k: 'board', victim: foes[0] });
  assert.ok(s.profile!.campaign!.at > sl.slot || s.profile!.quests.active[0].progress >= 1 || s.profile!.quests.active[0].step >= 1);
});

test('a dive of the campaign has its wreck laid in its location’s shallows', () => {
  const { game } = makeGame();
  const dives = campaignOf(game).quests.flatMap((q) => q.steps).filter((x): x is Extract<QuestStep, { type: 'dive' }> => x.type === 'dive');
  assert.ok(dives.length > 30);
  for (const d of dives) {
    const w = game.wrecks[d.wreck!];
    assert.ok(w, 'a wreck laid');
    assert.ok(Math.hypot(w.x - d.near!.x, w.y - d.near!.y) <= LOCAL_R, 'in the location’s waters');
  }
  assert.ok(dives.filter((d) => game.wrecks[d.wreck!].depth <= 8).length / dives.length > 0.8, 'most within a plain diver’s reach');
});

test('a newcomer starts where she starts: chapter 1 at Saltmarrow and its waters, short legs before the fifth level', () => {
  const first = built.locations[0];
  assert.equal(first.id, 'saltmarrow', 'the first location is the start port');
  for (const sl of built.slots.filter((x) => x.loc === 0)) {
    for (const st of sl.a.steps) {
      if (st.type === 'isle' || st.type === 'land') assert.ok(locDist(world, first, world.islands[st.island]) <= 2500, `${sl.a.id}: an island off Saltmarrow`);
      if (st.type === 'visit') assert.equal(st.port, 'saltmarrow');
    }
  }
  const legs = built.locations.slice(1).map((l, i) => ({ l, d: Math.hypot(l.x - built.locations[i].x, l.y - built.locations[i].y) })).filter((x) => campaignPaces()[x.l.from].gate < 5);
  for (const x of legs) assert.ok(x.d <= 6500, `${x.l.name}: ${(x.d / 1000).toFixed(1)} km before the fifth level`);
});

test('every step names the very island or port its mark is on (QA 2026-10-22: «Kitty Marsh … off Veilislet Isle» marked Sallowwisp Rock)', () => {
  for (const seed of [1337, WORLD_SEED]) {
    const w = seed === 1337 ? world : generateWorld(seed);
    const c = seed === 1337 ? built : buildCampaign(w, seed, CHAPTERS);
    for (const q of c.quests) for (const st of q.steps) {
      if ((st.type === 'isle' || st.type === 'land') && st.island >= 0) assert.ok(st.text.includes(w.islands[st.island].name), `${q.id}: «${st.text}» marks ${w.islands[st.island].name}`);
      if (st.type === 'visit' || st.type === 'deliver' || st.type === 'pickup') {
        const name = w.ports.find((p) => p.id === st.port)?.name;
        assert.ok(name && st.text.includes(name), `${q.id}: «${st.text}» marks ${name}`);
      }
    }
  }
});
