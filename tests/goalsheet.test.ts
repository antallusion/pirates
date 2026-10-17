// «Цели и вести» at sea (owner, 2026-10-17): the quests taken, the port's contracts and the day's orders are listed, the
// campaign's main goals on top (client/src/ui/goalsheet.ts, seahud.ts openNews).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { campaignHtml, goalCount, goalSheetView, goalsListHtml } from '../client/src/ui/goalsheet.ts';
import type { GoalSelf } from '../client/src/ui/goalsheet.ts';
import { EN, RU } from '../client/src/lang/ui/goalsheet.ts';
import { setLang } from '../client/src/i18n.ts';
import { EN as QEN, RU as QRU } from '../client/src/lang/ui/questclass.ts';
import type { QuestKind } from '../shared/src/data/questclass.ts';
import type { CampaignView } from '../shared/src/protocol.ts';

const q = (id: string, kind: QuestKind, step = 1, steps = 3) => ({ id, name: `Quest ${id}`, kind, step, steps, text: 'Sink pirates', progress: 1, need: 3 });

const campaign: CampaignView = { at: 4, total: 720, ch: 1, k: 4, size: 22, started: true, done: false, from: 0, gate: 1, blocked: null, ways: [{ id: 'c01_05', name: 'Grey Sails', summary: 'Small boats', steps: ['Take ships by boarding: 1.'], xp: 60, silver: 40 }], active: 'c01_05', next: [], picks: {} };

const self: GoalSelf = {
  quests: [q('job_a', 'job'), q('a_north_wreckers_2', 'story', 2), q('side_mika_1', 'story', 1, 2), q('job_b', 'job', 1, 1), q('q_path_corsair', 'path', 3, 4), q('q_legend_drowned', 'legend'), q('c01_05', 'campaign', 1, 2)],
  contracts: [
    { id: 'c2', kind: 'bounty', title: 'Bounty', kills: 4, progress: 1, reward: 300, expiresAt: 900 },
    { id: 'c1', kind: 'delivery', title: 'Deliver rum', toPort: 'gravesend', good: 'rum', reward: 200, expiresAt: 500 },
  ],
  daily: { orders: [{ kind: 'sink' as const, need: 3, progress: 1, done: false, silver: 100 }, { kind: 'ports' as const, need: 2, progress: 2, done: true, silver: 80 }, { kind: 'land' as const, need: 1, progress: 0, done: false, silver: 60 }], streak: 2, chest: false, chestSilver: 500 },
  campaign,
};

test('the campaign first (its quest only) — then every other quest and contract taken, tagged by the one taxonomy, then the orders', () => {
  const v = goalSheetView(self);
  assert.equal(v.campaign?.line?.key, 'q:c01_05', 'the campaign quest under way');
  assert.equal(v.campaign?.take.length, 0, 'nothing to take while one is under way');
  assert.deepEqual(v.active.map((x) => x.key), ['q:job_a', 'q:a_north_wreckers_2', 'q:side_mika_1', 'q:job_b', 'q:q_path_corsair', 'q:q_legend_drowned', 'c:c1', 'c:c2'], 'every other quest taken and every contract (the soonest to lapse first)');
  // owner, 2026-10-17: «сети мики числится как побочное» — the side chains, the arcs, the Paths and the Legends are side
  // quests on every screen; the board's jobs are jobs
  assert.deepEqual(v.active.map((x) => x.kind), ['job', 'side', 'side', 'job', 'side', 'side', 'contract', 'contract']);
  assert.deepEqual(v.daily.map((x) => x.key), ['d:sink', 'd:ports', 'd:land']);
  assert.equal(v.daily[1].done, true);
  assert.deepEqual(v.chest, { open: false, silver: 500, streak: 2 });
  // the counter on «Цели и вести»: the campaign's quest + 8 taken + 2 orders not done
  assert.equal(goalCount(v), 11);
});

test('the campaign is never taken: only a fork’s two ways are chosen; the next waits for its level, said so', () => {
  const two: CampaignView = { ...campaign, active: undefined, ways: [{ id: 'c01_17', name: 'Silence the Clerk', label: 'Watch him', summary: '', steps: ['Hold the waters'], xp: 1, silver: 1 }, { id: 'c01_17b', name: 'Frighten the Clerk', label: 'Frighten him', summary: '', steps: ['Board'], xp: 1, silver: 1 }] };
  const v = goalSheetView({ quests: [], campaign: two });
  assert.deepEqual(v.campaign?.take.map((x) => x.id), ['c01_17', 'c01_17b']);
  const html = campaignHtml(v, (id) => id);
  assert.ok(html.includes('data-gtake="c01_17"') && html.includes('data-gtake="c01_17b"'), '«Выбрать» on each way of the fork');
  assert.equal(goalCount(v), 1);
  // one way (no fork) not yet under way: no button at all — it comes by itself
  const one = goalSheetView({ quests: [], campaign: { ...two, ways: [two.ways![0]] } });
  assert.ok(!campaignHtml(one, (id) => id).includes('data-gtake'), 'no «Взять» for the campaign');
  const wait = goalSheetView({ quests: [], campaign: { ...two, blocked: 'Level 12' } });
  const w = campaignHtml(wait, (id) => id);
  assert.ok(!w.includes('data-gtake') && w.includes('gs-wait') && w.includes('12'), 'the next waits for its level, said so («следующее с уровня 12»)');
  assert.equal(goalCount(wait), 0);
});

test('nothing taken: empty lists and their hints, in both languages', () => {
  const v = goalSheetView({ quests: [] });
  assert.equal(v.campaign, null);
  assert.equal(v.active.length + v.daily.length, 0);
  assert.equal(goalCount(v), 0);
  assert.equal(goalSheetView(null).active.length, 0);
  for (const l of ['ru', 'en'] as const) {
    setLang(l);
    const D = l === 'ru' ? RU : EN;
    const html = (campaignHtml(v, (id) => id) + goalsListHtml(v, (id) => id)).replace(/ /g, ' ');
    for (const k of ['campaignNone', 'activeNone', 'dailyNone'] as const) assert.ok(html.includes(D[k].slice(0, 14)), `${l} ${k}`);
  }
});

test('the rows: the campaign block on top, «Плыть» with the goal keys, progress, the class words, RU and EN', () => {
  const v = goalSheetView(self);
  for (const l of ['ru', 'en'] as const) {
    setLang(l);
    const D = l === 'ru' ? RU : EN;
    const W = l === 'ru' ? QRU : QEN;
    const top = campaignHtml(v, () => 'Gravesend').replace(/ /g, ' ');
    const list = goalsListHtml(v, () => 'Gravesend').replace(/ /g, ' '); // (the Russian typesetting's no-break spaces)
    assert.ok(top.includes('gs-campaign') && top.includes(D.campaign));
    assert.ok(top.includes('data-gsail="q:c01_05"'), '«Плыть» on the campaign quest');
    assert.ok(top.includes(D.where.replace('{ch}', '1').replace('{n}', '5').replace('{of}', '22')), 'the chapter and the quest in it');
    assert.ok(top.includes(D.progress.replace('{n}', '4').replace('{of}', '720')), 'N of 720');
    assert.ok(top.includes(W['one.campaign']));
    assert.ok(!top.includes('q:job_a') && !top.includes('q:side_mika_1'), 'a job, a side story are not the campaign');
    assert.ok(list.includes(W['one.side']) && list.includes(W['one.job']), 'the side stories and the jobs, by their words');
    assert.ok(list.indexOf(D.active) < list.indexOf(D.daily), 'the quests before the orders');
    for (const k of ['q:job_a', 'q:side_mika_1', 'c:c1', 'c:c2', 'd:sink', 'd:land']) assert.ok(list.includes(`data-gsail="${k}"`), `«${D.sail}» on ${k}`);
    assert.ok(!list.includes('data-gsail="d:ports"'), 'an order done has no «Плыть»');
    assert.ok(list.includes(D.step.replace('{n}', '3').replace('{of}', '4')), 'the Path: step 3 of 4');
    assert.ok(list.includes(D.to.replace('{port}', 'Gravesend')));
    assert.ok(list.includes(D.sunk.replace('{n}', '1').replace('{need}', '4')));
    assert.ok(list.includes('gs-bar'), 'progress bars');
  }
  setLang('en');
});

test('the sheet: the campaign fixed on top, one scrolling list under it, the lent blocks last; the counter counts the goals', () => {
  const src = readFileSync(new URL('../client/src/ui/seahud.ts', import.meta.url), 'utf8');
  const open = src.slice(src.indexOf('openNews(): void'), src.indexOf('private lendInto'));
  assert.ok(open.includes("list.append(mine, head.firstElementChild!, lent.box)"));
  assert.ok(open.includes('box.append(top, list)'));
  assert.ok(open.includes('g.go(btn.dataset.gsail!)'));
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.ok(main.includes('go: (key) => startGoal(key)'), "«Плыть» is the goal's run ({t:'goto', key})");
  assert.ok(main.includes('+ goalCount(goalSheetView(self))'));
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.gs-top { flex: none;'), 'the top block never scrolls away');
  assert.ok(css.includes('.gs-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto;'));
});

test('no Latin in the Russian words', () => {
  for (const [k, v] of Object.entries(RU)) assert.ok(!/[A-Za-z]/.test(v.replace(/\{[a-z]+\}/g, '')), k);
});
