// Story arcs and the islands' people (docs/11 P4): five written arcs a region, chapters that open in turn, all in
// Russian; jobs given on an island's beach that end back on it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCS, generateArcs } from '../shared/src/data/questarcs.ts';
import { generateIslandJobs } from '../shared/src/data/questgen.ts';
import { ARC_QUESTS, ISLAND_JOBS, QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { REGION_IDS } from '../shared/src/world/regions.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { islandJobOffer, questEvent, questLandsHere, questOffers } from '../server/src/game/quests.ts';
import { join, makeGame } from './helpers.ts';

const world = generateWorld(1337);

test('five written arcs in every region, three chapters each, laid on the world', () => {
  for (const r of REGION_IDS) assert.ok(ARCS.filter((a) => a.region === r).length >= 5, r);
  assert.equal(new Set(ARCS.map((a) => a.id)).size, ARCS.length);
  const arcs = generateArcs(world, 1337);
  assert.ok(arcs.length >= ARCS.length * 3 * 0.95, `${arcs.length} chapters`);
  for (const q of arcs) {
    const n = Number(q.id.split('_').pop());
    if (n > 1) assert.deepEqual(q.requires.done, [q.id.replace(/_\d+$/, `_${n - 1}`)], `${q.id} follows the chapter before`);
    assert.equal(q.steps[q.steps.length - 1].type, 'visit', 'each chapter ends with the giver');
  }
});

test('every chapter reads in Russian', () => {
  setLang('ru');
  applyDataLocale('ru');
  const bad: string[] = [];
  for (const q of [...generateArcs(world, 1337), ...generateIslandJobs(world, 1337)]) {
    for (const s of [q.name, q.mentor, q.summary, ...q.steps.map((x) => x.text)]) {
      const ru = serverText(s);
      if (/[A-Za-z]/.test(ru)) bad.push(`${s} → ${ru}`);
    }
  }
  setLang('en');
  assert.equal(bad.length, 0, bad.slice(0, 4).join(' || '));
});

test('an arc\'s next chapter is on the board only when the one before is done', () => {
  const { game } = makeGame();
  const c = join(game, 'Storyteller');
  const s = [...game.sessions].find((x) => x.name === 'Storyteller')!;
  const p = s.profile!;
  p.level = 60;
  const first = ARC_QUESTS.find((q) => q.id.endsWith('_1'))!;
  const second = QUESTS_BY_ID[first.id.replace(/_1$/, '_2')];
  const port = game.portById(first.port)!;
  const ids = () => questOffers(p, port, game.now).map((o) => o.q.id);
  assert.ok(ids().includes(first.id), 'chapter one offered');
  assert.ok(!ids().includes(second.id), 'chapter two not yet');
  p.quests.done.push(first.id);
  assert.ok(ids().includes(second.id), 'chapter two now');
  void c;
});

test('an island\'s people give their job on the beach, and it ends back there', () => {
  const { game } = makeGame();
  assert.ok(ISLAND_JOBS.size >= 20, `${ISLAND_JOBS.size} islands with jobs`);
  const [islandId, job] = [...ISLAND_JOBS.entries()][0];
  const last = job.steps[job.steps.length - 1];
  assert.ok(last.type === 'land' && last.island === islandId && (last.site === 'fishers' || last.site === 'smugglers'), 'back to the beach');
  const c = join(game, 'Beachcomber');
  const s = [...game.sessions].find((x) => x.name === 'Beachcomber')!;
  s.profile!.level = 60;
  islandJobOffer(game, s, islandId);
  // The giver speaks and the captain decides: an offer, not a job pressed on them.
  const offer = c.last('quest_offer');
  assert.equal(offer?.offer.id, job.id, 'the giver offers the job');
  assert.ok(!s.profile!.quests.active.some((a) => a.id === job.id), 'not taken until the captain says so');
  c.push({ t: 'quest', action: 'accept', id: job.id });
  assert.ok(s.profile!.quests.active.some((a) => a.id === job.id), 'taken on the beach');
  assert.ok(c.all('toast').some((t) => t.msg.startsWith(job.mentor)), 'the giver speaks');
  // Walk it to its last step: the beach can be landed on again at once, and that ends it.
  const qs = s.profile!.quests.active.find((a) => a.id === job.id)!;
  qs.step = job.steps.length - 1;
  assert.ok(last.type === 'land' && questLandsHere(s.profile!, islandId, last.site!), 'the beach is not "worked out" for this job');
  if (last.type === 'land') questEvent(game, s, { k: 'land', island: islandId, feature: last.site! });
  assert.ok(s.profile!.quests.done.includes(job.id), 'done back on the beach');
});
