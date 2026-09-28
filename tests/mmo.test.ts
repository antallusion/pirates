// Quests for a crew of captains (docs/11 P6): a group's kill counts on each captain's quests; the tracked quest's
// pointer leads to the step's place and falls silent once there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_JOBS, JOBS, QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { eventFavor, fastWindow, islandJobOffer, questEvent, questOffers } from '../server/src/game/quests.ts';
import type { QuestDef } from '../shared/src/data/quests.ts';
import { questPointer } from '../client/src/ui/track.ts';
import { newsHint } from '../server/src/game/onboarding.ts';
import { join, makeGame, steps } from './helpers.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { trackReward } from '../shared/src/data/seasons.ts';
import { activeTasks, resetTasks, stepTasks } from '../server/src/game/worldtasks.ts';

test('a group sails as one: the ship one captain sinks counts on a groupmate’s hunt nearby', () => {
  const { game } = makeGame();
  const a = join(game, 'Anne Reef');
  const b = join(game, 'Bram Reef');
  a.push({ t: 'group', action: 'invite', name: 'bram reef' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const A = game.sessionByName('Anne Reef')!, B = game.sessionByName('Bram Reef')!;
  // Both at sea, side by side.
  for (const [c, s, dx] of [[a, A, 0], [b, B, 150]] as const) {
    c.push({ t: 'undock' });
    s.ship!.docked = null;
    s.ship!.state.x = 30000 + dx;
    s.ship!.state.y = 30000;
    s.ship!.state.speed = 0;
  }
  // Bram hunts pirates; Anne does the sinking.
  const hunt: QuestDef = { id: 'test_group_hunt', kind: 'job', name: 'Clear the Lanes', mentor: 'Test', port: 'saltmarrow', summary: '', requires: {}, steps: [{ type: 'sink', count: 2, role: 'pirate', text: 'Sink pirates: 2.' }], reward: { xp: 10, silver: 10 } };
  QUESTS_BY_ID[hunt.id] = hunt;
  B.profile!.quests.active.push({ id: hunt.id, step: 0, progress: 0, startedAt: game.now });
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', 30300, 30000, 0);
  pirate.attackers.set(A.ship!.id, game.now);
  (game as unknown as { creditKill(k: unknown, v: unknown, how: string): void }).creditKill(A.ship!, pirate, 'sunk');
  assert.equal(B.profile!.quests.active.find((q) => q.id === hunt.id)?.progress, 1, 'the groupmate’s hunt moved on');
  // Out of reach, it does not count.
  B.ship!.state.x = 60000;
  const far = game.spawnNpcShip('pirate', 'sloop', 'confederacy', 30300, 30000, 0);
  (game as unknown as { creditKill(k: unknown, v: unknown, how: string): void }).creditKill(A.ship!, far, 'sunk');
  assert.equal(B.profile!.quests.active.find((q) => q.id === hunt.id)?.progress, 1, 'a groupmate far away does not share it');
  delete QUESTS_BY_ID[hunt.id];
  steps(game, 1);
});

test('the quest pointer: toward the port or island until near it, toward a region until inside it', () => {
  const base = { id: 'q', name: 'Q', kind: 'job' as const, mentor: 'M', step: 1, steps: 2, text: 't', progress: 0, need: 1 };
  const port = { ...base, target: { x: 10000, y: 0, r: 400 } };
  assert.equal(Math.round(questPointer(port, 0, 0, 'black_coast')!.d), 10000, 'a long way off: the pointer leads there');
  assert.equal(questPointer(port, 9800, 0, 'black_coast'), null, 'arrived: no pointer');
  const region = { ...base, target: { x: 50000, y: 50000, region: 'ashen_isles' as const } };
  assert.ok(questPointer(region, 0, 0, 'black_coast'), 'outside the region: pointed at its heart');
  assert.equal(questPointer(region, 0, 0, 'ashen_isles'), null, 'inside the region: the step is done there');
  assert.equal(questPointer({ ...base }, 0, 0, 'black_coast'), null, 'a step with no place has no pointer');
});

test('the beach: the giver offers, the captain may leave it (and is asked again next time) or take it', () => {
  const { game } = makeGame();
  const c = join(game, 'Lena Shore');
  const s = game.sessionByName('Lena Shore')!;
  s.profile!.level = 60;
  const [islandId, job] = [...ISLAND_JOBS.entries()][0];
  islandJobOffer(game, s, islandId);
  assert.equal(c.last('quest_offer')?.offer.id, job.id);
  c.push({ t: 'quest', action: 'decline', id: job.id });
  assert.ok(!s.profile!.quests.active.some((a) => a.id === job.id), 'left on the beach');
  c.push({ t: 'quest', action: 'accept', id: job.id });
  assert.ok(!s.profile!.quests.active.some((a) => a.id === job.id), 'a declined offer cannot be taken later from afar');
  islandJobOffer(game, s, islandId);
  c.push({ t: 'quest', action: 'accept', id: job.id });
  assert.ok(s.profile!.quests.active.some((a) => a.id === job.id), 'the next landing asks again, and now it is taken');
});

test('sharing a quest with the group: a groupmate is asked, takes it, and the job pays with the port’s standing', () => {
  const { game } = makeGame();
  const a = join(game, 'Ada Share');
  const b = join(game, 'Ben Share');
  a.push({ t: 'group', action: 'invite', name: 'ben share' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const A = game.sessionByName('Ada Share')!, B = game.sessionByName('Ben Share')!;
  const job = JOBS.find((q) => (q.requires.level ?? 1) <= 1 && q.steps[0].type !== 'pickup')!;
  A.profile!.quests.active.push({ id: job.id, step: 0, progress: 0, startedAt: game.now });
  a.push({ t: 'quest', action: 'share', id: job.id });
  const offer = b.last('quest_offer');
  assert.equal(offer?.offer.id, job.id, 'the groupmate is asked');
  assert.equal(offer?.from, 'Ada Share');
  b.push({ t: 'quest', action: 'accept', id: job.id });
  assert.ok(B.profile!.quests.active.some((q) => q.id === job.id), 'and takes it on, wherever they are');
  // A Path is walked alone.
  A.profile!.quests.active.push({ id: 'q_path_smuggler', step: 0, progress: 0, startedAt: game.now });
  a.push({ t: 'quest', action: 'share', id: 'q_path_smuggler' });
  assert.ok(a.all('toast').some((t) => /walked alone/.test(t.msg)), 'a Path is walked alone');
  // Done: the herald says what it paid, and the port's faction remembers.
  const port = game.portById(job.port)!;
  const rep0 = (B.profile!.reputation[port.faction] ?? 0);
  const qs = B.profile!.quests.active.find((q) => q.id === job.id)!;
  qs.step = job.steps.length - 1;
  const last = job.steps[job.steps.length - 1];
  if (last.type === 'visit') {
    questEvent(game, B, { k: 'dock', port: game.portById(last.port)! });
    const done = b.last('quest_done');
    assert.equal(done?.name, job.name);
    assert.equal(done?.silver, Math.round(job.reward.silver * (1 + 0.1 * (done?.company ?? 0)) * (done?.fast ? 1.25 : 1)), 'the pay: a tenth more for a groupmate in company, a quarter for speed');
    assert.ok(done?.rep && done.rep.faction === port.faction && done.rep.n >= 2, 'standing with the port’s faction');
    assert.ok((B.profile!.reputation[port.faction] ?? 0) > rep0);
  }
});

test('a quest done in company pays a tenth more for every groupmate near (up to three)', () => {
  const { game } = makeGame();
  const a = join(game, 'Cy Company');
  const b = join(game, 'Di Company');
  a.push({ t: 'group', action: 'invite', name: 'di company' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const A = game.sessionByName('Cy Company')!, B = game.sessionByName('Di Company')!;
  for (const [c, s, dx] of [[a, A, 0], [b, B, 200]] as const) {
    c.push({ t: 'undock' });
    s.ship!.docked = null;
    s.ship!.state.x = 30000 + dx;
    s.ship!.state.y = 30000;
  }
  const quest: QuestDef = { id: 'test_company', kind: 'job', name: 'In Company', mentor: 'Test', port: 'saltmarrow', summary: '', requires: {}, steps: [{ type: 'chart', count: 1, text: 'Chart an island.' }], reward: { xp: 100, silver: 1000 } };
  QUESTS_BY_ID[quest.id] = quest;
  A.profile!.quests.active.push({ id: quest.id, step: 0, progress: 0, startedAt: game.now });
  const gold0 = A.profile!.gold;
  questEvent(game, A, { k: 'chart' });
  const done = a.last('quest_done');
  assert.equal(done?.company, 1);
  assert.equal(done?.silver, 1100, 'a tenth more with one groupmate near');
  assert.ok(A.profile!.gold - gold0 >= 1100);
  assert.equal(A.profile!.season.stats.quests, 1, 'counted in the season table of quests done');
  delete QUESTS_BY_ID[quest.id];
});

test('news told once to every captain: the day’s orders on putting in, the journal on the first quest', () => {
  const { game } = makeGame();
  const c = join(game, 'Newsy Nell');
  const s = game.sessionByName('Newsy Nell')!;
  const port = game.portById(s.ship!.docked!)!;
  questEvent(game, s, { k: 'dock', port });
  questEvent(game, s, { k: 'dock', port });
  assert.equal(c.all('onb').filter((m) => m.kind === 'hint' && m.id === 'daily').length, 1, 'the orders are told of once');
  const job = JOBS.find((q) => q.port === port.id && (q.requires.level ?? 1) <= 1);
  if (!job) return;
  s.profile!.quests.active.push({ id: job.id, step: 0, progress: 0, startedAt: game.now });
  newsHint(game, s, 'journal');
  newsHint(game, s, 'journal');
  assert.equal(c.all('onb').filter((m) => m.kind === 'hint' && m.id === 'journal').length, 1, 'the journal once');
});

test('the port’s news on the board: an epidemic puts medicine runs first, marked as wanted now', () => {
  const { game } = makeGame();
  const c = join(game, 'Doc Holly');
  const s = game.sessionByName('Doc Holly')!;
  s.profile!.level = 30;
  // A port whose seventy jobs hold a medicine run.
  const port = game.world.ports.find((pt) => JOBS.some((q) => q.port === pt.id && q.steps.some((st) => (st.type === 'deliver' || st.type === 'pickup') && st.good === 'medicine') && (q.requires.level ?? 1) <= 30))!;
  const medicine = (id: string) => QUESTS_BY_ID[id].steps.some((st) => (st.type === 'deliver' || st.type === 'pickup') && st.good === 'medicine');
  const before = questOffers(s.profile!, port, game.now, null).filter((o) => o.q.kind === 'job');
  // An epidemic breaks out there.
  game.worldEvents.data(game).list.push({ id: 999, kind: 'epidemic', region: port.region, port: port.id, x: port.x, y: port.y, started: game.wallNow(), ends: game.wallNow() + 3_600_000, title: 'Fever' });
  const favor = eventFavor(game, port);
  const after = questOffers(s.profile!, port, game.now, favor).filter((o) => o.q.kind === 'job');
  assert.ok(after.slice(0, 2).some((o) => medicine(o.q.id)), 'a medicine run is among the first on the board');
  assert.ok(after.filter((o) => medicine(o.q.id)).length >= before.filter((o) => medicine(o.q.id)).length);
  void c;
});

test('the speed bonus: a courier job done inside its window pays a quarter more; a hunt has no window', () => {
  const { game } = makeGame();
  const c = join(game, 'Swift Sal');
  const s = game.sessionByName('Swift Sal')!;
  const port = game.portById(s.ship!.docked!)!;
  const job = JOBS.find((q) => q.port === port.id && q.steps.every((st) => st.type === 'visit' || st.type === 'deliver' || st.type === 'pickup'))!;
  const w = fastWindow(game, job);
  assert.ok(w && w > 240, `a window sized by the route: ${w}`);
  const hunt = JOBS.find((q) => q.steps.some((st) => st.type === 'sink'))!;
  assert.equal(fastWindow(game, hunt), null, 'no race against the clock for a hunt');
  // Done at once: the bonus.
  s.profile!.quests.active.push({ id: job.id, step: job.steps.length - 1, progress: 0, startedAt: game.now, fastUntil: game.now + w! });
  const last = job.steps[job.steps.length - 1];
  if (last.type !== 'visit') return;
  s.ship!.cargo = {};
  questEvent(game, s, { k: 'dock', port: game.portById(last.port)! });
  const done = c.last('quest_done');
  assert.equal(done?.fast, true);
  assert.ok(done && done.silver >= Math.round(job.reward.silver * 1.25) - 1, 'a quarter more');
});

test('looking for a group: a posting every captain sees, a call aboard, and off the board once found', () => {
  const { game } = makeGame();
  const a = join(game, 'Lone Lucy');
  const b = join(game, 'Host Hal');
  a.push({ t: 'undock' });
  b.push({ t: 'undock' });
  a.push({ t: 'group', action: 'lfg', note: 'Kraken   tonight' });
  const board = b.last('party')?.lfg ?? [];
  assert.equal(board.length, 1);
  assert.equal(board[0].name, 'Lone Lucy');
  assert.equal(board[0].note, 'Kraken tonight', 'the note, tidied');
  assert.equal(a.last('party')?.lfgMine, 'Kraken tonight');
  assert.equal((a.last('party')?.lfg ?? []).length, 0, 'one does not see oneself');
  // Hal calls her aboard; she accepts: off the board.
  b.push({ t: 'group', action: 'invite', name: 'Lone Lucy' });
  a.push({ t: 'group', action: 'accept', id: a.last('party')!.invites[0].id });
  assert.equal((b.last('party')?.lfg ?? []).length, 0, 'found: off the board');
  assert.equal(a.last('party')?.lfgMine, null);
  // In a group, no posting.
  a.push({ t: 'group', action: 'lfg', note: 'more' });
  assert.ok(a.all('toast').some((t) => /already sail in a group/.test(t.msg)));
});

test('a courier with a quest’s cargo aboard, out of the Crown’s peace, meets raiders once', () => {
  const { game } = makeGame();
  const c = join(game, 'Carry Kate');
  const s = game.sessionByName('Carry Kate')!;
  s.profile!.level = 20;
  const job = JOBS.find((q) => q.steps[0].type === 'pickup' && q.steps[1]?.type === 'deliver')!;
  s.profile!.quests.active.push({ id: job.id, step: 1, progress: 0, startedAt: game.now });
  // At sea in contested water.
  const contested = game.world.islands.find((i) => REGIONS[i.region].safety === 'contested')!;
  c.push({ t: 'undock' });
  s.ship!.docked = null;
  s.ship!.state.x = contested.x + contested.radius + 1500;
  s.ship!.state.y = contested.y;
  s.ship!.region = contested.region;
  const npcs0 = game.npcs.size;
  for (let i = 0; i < 400; i++) questEvent(game, s, { k: 'tick', dt: 1 }), (game.now += 1);
  const qs = s.profile!.quests.active.find((q) => q.id === job.id)!;
  assert.ok(qs.ambushed, 'the raiders came');
  assert.ok(game.npcs.size > npcs0, 'pirates put out after her');
  assert.ok(c.all('toast').some((t) => /word of your cargo/.test(t.msg)));
  const n = game.npcs.size;
  for (let i = 0; i < 400; i++) questEvent(game, s, { k: 'tick', dt: 1 }), (game.now += 1);
  assert.equal(game.npcs.size, n, 'only once per cargo');
});

test('a hunt has a band leader: named, on the chart, and sinking him wins the hunt at a stroke', () => {
  const { game } = makeGame();
  const c = join(game, 'Hunter Hugh');
  const s = game.sessionByName('Hunter Hugh')!;
  s.profile!.level = 20;
  const port = game.portById(s.ship!.docked!)!;
  const hunt = JOBS.find((q) => q.steps.some((st) => st.type === 'sink' && st.region && st.role === 'pirate') && (q.requires.level ?? 1) <= 20)!;
  void port;
  QUESTS_BY_ID[hunt.id] = hunt;
  // Taken through the offer path (as from a groupmate), which starts it the same way.
  s.questOffer = { id: hunt.id, until: game.now + 100 };
  c.push({ t: 'quest', action: 'accept', id: hunt.id });
  const qs = s.profile!.quests.active.find((q) => q.id === hunt.id)!;
  assert.ok(qs.leader !== undefined, 'a leader put out');
  const leader = game.ships.get(qs.leader!)!;
  assert.ok(c.all('toast').some((t) => t.msg.includes('leads them in the')), 'word of him');
  // Walk to the hunt step and sink the leader.
  qs.step = hunt.steps.findIndex((st) => st.type === 'sink');
  qs.progress = 0;
  const at = qs.step;
  leader.attackers.set(s.ship!.id, game.now);
  (game as unknown as { creditKill(k: unknown, v: unknown, how: string): void }).creditKill(s.ship!, leader, 'sunk');
  const now = s.profile!.quests.active.find((q) => q.id === hunt.id);
  assert.ok(!now || now.step > at || s.profile!.quests.done.includes(hunt.id), 'the hunt step is won at once');
});

test('the journal shows groupmates on the same quest and the step each is on', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Mates');
  const b = join(game, 'Ben Mates');
  a.push({ t: 'group', action: 'invite', name: 'Ben Mates' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const A = game.sessionByName('Ann Mates')!, B = game.sessionByName('Ben Mates')!;
  const job = JOBS.find((q) => q.steps.length >= 2)!;
  A.profile!.quests.active.push({ id: job.id, step: 0, progress: 0, startedAt: game.now });
  B.profile!.quests.active.push({ id: job.id, step: 1, progress: 0, startedAt: game.now });
  game.pushSelf(A, true);
  game.pushSelf(B, true);
  const view = (c: typeof a) => (c.last('self')?.self ?? c.last('init')!.self).quests.find((q) => q.id === job.id);
  assert.deepEqual(view(a)?.mates, [{ name: 'Ben Mates', step: 2 }]);
  assert.deepEqual(view(b)?.mates, [{ name: 'Ann Mates', step: 1 }]);
  // Out of the group: no one alongside.
  b.push({ t: 'group', action: 'leave' });
  game.pushSelf(A, true);
  assert.equal(view(a)?.mates, undefined);
});

test('a mentor: a veteran in company is paid for guiding a quest through, and the apprentice learns faster', () => {
  const { game } = makeGame();
  const a = join(game, 'Young Ada');
  const b = join(game, 'Old Bart');
  a.push({ t: 'group', action: 'invite', name: 'Old Bart' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const A = game.sessionByName('Young Ada')!, B = game.sessionByName('Old Bart')!;
  for (const [c, s, dx] of [[a, A, 0], [b, B, 300]] as const) {
    c.push({ t: 'undock' });
    s.ship!.docked = null;
    s.ship!.state.x = 30000 + dx;
    s.ship!.state.y = 30000;
  }
  B.profile!.level = A.profile!.level + 12;
  const quest: QuestDef = { id: 'test_mentor', kind: 'job', name: 'Under Guidance', mentor: 'Test', port: 'saltmarrow', summary: '', requires: {}, steps: [{ type: 'chart', count: 1, text: 'Chart an island.' }], reward: { xp: 100, silver: 1000 } };
  QUESTS_BY_ID[quest.id] = quest;
  A.profile!.quests.active.push({ id: quest.id, step: 0, progress: 0, startedAt: game.now });
  const bartGold = B.profile!.gold;
  questEvent(game, A, { k: 'chart' });
  const done = a.last('quest_done')!;
  assert.equal(done.mentor, 'Old Bart');
  assert.equal(done.xp, Math.round(100 * 1.1 * 1.1), 'a tenth more in company, and a tenth more under a mentor');
  assert.equal(B.profile!.gold - bartGold, 250, 'the mentor is paid a quarter of the silver');
  assert.equal(B.profile!.season.stats.mentored, 1);
  assert.ok(b.all('toast').some((t) => t.msg === 'You saw Young Ada through “Under Guidance”: 250 silver for the guidance.'));
  // A groupmate of the same years is company, not a mentor.
  B.profile!.level = A.profile!.level + 3;
  A.profile!.quests.done = [];
  A.profile!.quests.active.push({ id: quest.id, step: 0, progress: 0, startedAt: game.now });
  questEvent(game, A, { k: 'chart' });
  assert.equal(a.last('quest_done')!.mentor, undefined);
  delete QUESTS_BY_ID[quest.id];
});

test('the mentor’s word and table read in Russian', () => {
  setLang('ru');
  const lines = [serverText('You saw Ada through “Qqq”: 250 silver for the guidance.'), serverText('Mentors')];
  setLang('en');
  assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l.replace(/Ada|Qqq/g, ''))), []);
});

test('the season path’s titles read in Russian, the season named too', () => {
  setLang('ru');
  const titles = (['migration', 'war', 'storm', 'dead_tide'] as const).flatMap((th) => [5, 20, 40].map((lv) => serverText(trackReward(lv, th)!.title!)));
  setLang('en');
  assert.deepEqual(titles.filter((t) => /[A-Za-z]/.test(t)), []);
});

test('titles for the work done: the tenth quest, the fifth contract, the tenth captain guided', () => {
  const { game } = makeGame();
  const c = join(game, 'Titled Tess');
  const s = game.sessionByName('Titled Tess')!;
  const quest: QuestDef = { id: 'test_title', kind: 'job', name: 'The Tenth', mentor: 'Test', port: 'saltmarrow', summary: '', requires: {}, steps: [{ type: 'chart', count: 1, text: 'Chart an island.' }], reward: { xp: 10, silver: 10 } };
  QUESTS_BY_ID[quest.id] = quest;
  s.profile!.quests.done = [...Array.from({ length: 4 }, (_, i) => `elite_saltmarrow_${i}`), ...Array.from({ length: 5 }, (_, i) => `x_${i}`)];
  s.profile!.quests.active.push({ id: quest.id, step: 0, progress: 0, startedAt: game.now });
  questEvent(game, s, { k: 'chart' });
  assert.ok(s.profile!.titles.includes('Hand for Hire'), 'ten quests done');
  assert.ok(!s.profile!.titles.includes('Flagship Breaker'), 'four contracts are not five');
  assert.ok(c.all('toast').some((t) => t.msg === 'A new title to wear before your name: “Hand for Hire” (the Legends tab).'));
  // The title is worn.
  c.push({ t: 'season', action: 'title', value: 'Hand for Hire' });
  assert.equal(s.profile!.title, 'Hand for Hire');
  delete QUESTS_BY_ID[quest.id];
  setLang('ru');
  const ru = ['Hand for Hire', 'Flagship Breaker', 'Teacher of the Young', 'Legend of the Harbour Offices', 'A new title to wear before your name: “Friend of the Quays” (the Legends tab).'].map((t) => serverText(t));
  setLang('en');
  assert.deepEqual(ru.filter((t) => /[A-Za-z]/.test(t)), []);
});

test('the journal knows the quests done: how many, and the last ten by name, the latest first', () => {
  const { game } = makeGame();
  const c = join(game, 'Done Dora');
  const s = game.sessionByName('Done Dora')!;
  const ids = JOBS.slice(0, 12).map((q) => q.id);
  s.profile!.quests.done = ids;
  game.pushSelf(s, true);
  const self = c.last('self')?.self ?? c.last('init')!.self;
  assert.equal(self.questsDone.length, 12);
  assert.deepEqual(self.questsRecent, ids.slice(-10).reverse().map((id) => QUESTS_BY_ID[id].name));
});

test('word of the sea’s company to a captain of some years putting in alone, and of a task of the sea when near one', () => {
  const { game } = makeGame();
  const c = join(game, 'Lonely Lars');
  const s = game.sessionByName('Lonely Lars')!;
  const port = game.portById(s.ship!.docked!)!;
  const told = (id: string) => c.all('onb').filter((m) => m.kind === 'hint' && m.id === id).length;
  questEvent(game, s, { k: 'dock', port });
  assert.equal(told('social'), 0, 'not before the third level');
  s.profile!.level = 5;
  questEvent(game, s, { k: 'dock', port });
  questEvent(game, s, { k: 'dock', port });
  assert.equal(told('social'), 1, 'once');
  // Near a task of the sea, at sea.
  stepTasks(game);
  const t = activeTasks(game)[0];
  s.ship!.docked = null;
  s.ship!.state.x = t.x;
  s.ship!.state.y = t.y;
  questEvent(game, s, { k: 'tick', dt: 1 });
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.equal(told('tasks'), 1);
  resetTasks(game);
});
