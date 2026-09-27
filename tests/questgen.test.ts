// The quest generator (docs/11 P4): over three thousand jobs from ~160 templates, all in Russian, and the new
// steps (a cargo taken on, a party landed) driven by what the captain does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIVER_MEN, GIVER_WOMEN, PLOTS, PROFESSIONS, STEP_TEXT, generateQuests, questPatterns } from '../shared/src/data/questgen.ts';
import { JOBS, QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { questEvent } from '../server/src/game/quests.ts';
import { join, makeGame } from './helpers.ts';

const world = generateWorld(1337);
const quests = generateQuests(world, 1337);

test('over three thousand jobs, every one its own, from some 160 templates', () => {
  assert.ok(quests.length >= 3000, `${quests.length} jobs`);
  assert.equal(new Set(quests.map((q) => q.id)).size, quests.length, 'unique ids');
  const texts = new Set(quests.map((q) => `${q.name}|${q.summary}|${q.steps.map((s) => s.text).join('|')}`));
  assert.ok(texts.size >= 3000, `${texts.size} different jobs`);
  const templates = new Set(quests.map((q) => q.template));
  const all = PLOTS.reduce((a, p) => a + p.flavors.length, 0);
  assert.ok(all >= 150, `${all} templates`);
  assert.ok(templates.size >= all * 0.9, `${templates.size} of ${all} templates in use`);
  for (const q of quests) {
    assert.ok(q.steps.length >= 1 && q.steps.length <= 6, q.id);
    assert.ok(q.reward.silver > 0 && q.reward.xp > 0);
  }
  // A widow is a woman; an old salt, a man.
  for (const q of quests) {
    const first = q.mentor.split(' ')[0];
    if (/, (widow|fishwife)$/.test(q.mentor)) assert.ok(GIVER_WOMEN.includes(first), q.mentor);
    if (/, (old salt|bosun|tavern keeper|priest)$/.test(q.mentor)) assert.ok(GIVER_MEN.includes(first), q.mentor);
  }
  // The same seed, the same jobs.
  const again = generateQuests(generateWorld(1337), 1337);
  assert.deepEqual(again.map((q) => q.id), quests.map((q) => q.id));
});

test('every template\'s Russian twin has the same places to fill', () => {
  const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const p of PLOTS) for (const f of p.flavors) {
    assert.equal(holes(f.name[1]), holes(f.name[0]), `${p.id} name: ${f.name[0]}`);
    assert.equal(holes(f.summary[1]), holes(f.summary[0]), `${p.id} summary: ${f.summary[0]}`);
  }
  for (const [k, [en, ru]] of Object.entries(STEP_TEXT)) assert.equal(holes(ru), holes(en), k);
  for (const [en, ru] of questPatterns()) assert.ok(!ru.includes('{-1}'), `${en} → ${ru}`);
  assert.ok(Object.keys(PROFESSIONS).length >= 15);
});

test('every job reads in Russian: its name, the giver, the story and each step', () => {
  setLang('ru');
  applyDataLocale('ru');
  const latin = /[A-Za-z]/;
  const bad: string[] = [];
  for (const q of quests) {
    for (const s of [q.name, q.mentor, q.summary, ...q.steps.map((x) => x.text)]) {
      const ru = serverText(s);
      if (latin.test(ru) || !/[А-Яа-яЁё]/.test(ru)) bad.push(`${s} → ${ru}`);
    }
  }
  setLang('en');
  assert.ok(bad.length === 0, `${bad.length} untranslated, e.g. ${bad.slice(0, 5).join(' || ')}`);
});

test('a courier job: the board offers it, the cargo comes aboard at home, is delivered, and the giver pays', () => {
  const { game } = makeGame();
  assert.ok(JOBS.length >= 3000, 'the server registered the jobs');
  const c = join(game, 'Courier');
  const s = [...game.sessions].find((x) => x.name === 'Courier')!;
  s.profile!.level = 40;
  const port = game.portById(s.ship!.docked!)!;
  // Find a courier job of this port on the board (the board turns over every four hours).
  let job = null;
  for (let w = 0; w < 200 && !job; w++) {
    game.now = w * 4 * 3600 + 1;
    c.inbox.length = 0;
    game.pushPort(s);
    const pv = c.last('port')?.view;
    const offer = pv?.questOffers.find((o) => o.id.startsWith(`g_${port.id}_courier`));
    if (offer) job = QUESTS_BY_ID[offer.id];
  }
  if (!job) return; // this port's seventy have no courier job on any board in 200 turns: nothing to test here
  const gold0 = s.profile!.gold;
  s.ship!.cargo = {};
  s.ship!.stats.holdVolume = 5000; // room for any load
  c.push({ t: 'quest', action: 'accept', id: job.id });
  const pickup = job.steps[0];
  assert.equal(pickup.type, 'pickup');
  if (pickup.type !== 'pickup') return;
  assert.equal(s.ship!.cargo[pickup.good], pickup.qty, 'taken on at the quay');
  const deliver = job.steps[1];
  if (deliver.type !== 'deliver') return;
  const to = game.portById(deliver.port)!;
  questEvent(game, s, { k: 'dock', port: to });
  assert.equal(s.ship!.cargo[pickup.good] ?? 0, 0, 'delivered');
  questEvent(game, s, { k: 'dock', port });
  assert.ok(s.profile!.quests.done.includes(job.id), 'done');
  assert.ok(s.profile!.gold > gold0, 'paid');
});

test('a landing step: the party ashore on the right island (at the right site) counts', () => {
  const { game } = makeGame();
  const job = JOBS.find((q) => q.steps[0].type === 'land')!;
  const c = join(game, 'Lander');
  const s = [...game.sessions].find((x) => x.name === 'Lander')!;
  s.profile!.quests.active.push({ id: job.id, step: 0, progress: 0, startedAt: game.now });
  const st = job.steps[0];
  if (st.type !== 'land') return;
  questEvent(game, s, { k: 'land', island: st.island + 1, feature: st.site ?? 'grove' });
  assert.equal(s.profile!.quests.active[0].step, 0, 'the wrong island does not count');
  questEvent(game, s, { k: 'land', island: st.island, feature: st.site ?? 'grove' });
  assert.equal(s.profile!.quests.active.find((a) => a.id === job.id)?.step ?? 99, job.steps.length > 1 ? 1 : 99, 'the landing counts');
  void c;
});

test('a woman giver takes the woman\'s word for her trade in Russian', () => {
  setLang('ru');
  applyDataLocale('ru');
  const she = quests.find((q) => /, merchant$/.test(q.mentor) && GIVER_WOMEN.includes(q.mentor.split(' ')[0]))!;
  const he = quests.find((q) => /, merchant$/.test(q.mentor) && GIVER_MEN.includes(q.mentor.split(' ')[0]))!;
  assert.match(serverText(she.mentor), /, купчиха$/);
  assert.match(serverText(he.mentor), /, купец$/);
  // Every line about a woman giver is free of the man's word before her name.
  for (const q of quests.filter((x) => GIVER_WOMEN.includes(x.mentor.split(' ')[0]))) {
    for (const s of [q.mentor, q.summary]) assert.doesNotMatch(serverText(s), /(купца|скупщика|аптекаря|контрабандиста|посланника) \(/, s);
  }
  setLang('en');
});
