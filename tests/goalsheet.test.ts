// «Цели и вести» at sea (owner, 2026-10-17): the quests taken, the port's contracts and the day's orders are listed, the
// campaign's main goals on top (client/src/ui/goalsheet.ts, seahud.ts openNews).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { campaignHtml, goalCount, goalSheetView, goalsListHtml } from '../client/src/ui/goalsheet.ts';
import type { GoalSelf } from '../client/src/ui/goalsheet.ts';
import { EN, RU } from '../client/src/lang/ui/goalsheet.ts';
import { setLang } from '../client/src/i18n.ts';

const q = (id: string, kind: 'path' | 'legend' | 'story' | 'job', step = 0, steps = 3) => ({ id, name: `Quest ${id}`, kind, step, steps, text: 'Sink pirates', progress: 1, need: 3 });

const self: GoalSelf = {
  quests: [q('job_a', 'job'), q('a_north_wreckers_2', 'story', 1), q('side_mika_1', 'story', 0, 2), q('job_b', 'job', 0, 1), q('q_path_corsair', 'path', 2, 4), q('q_legend_drowned', 'legend')],
  contracts: [
    { id: 'c2', kind: 'bounty', title: 'Bounty', kills: 4, progress: 1, reward: 300, expiresAt: 900 },
    { id: 'c1', kind: 'delivery', title: 'Deliver rum', toPort: 'gravesend', good: 'rum', reward: 200, expiresAt: 500 },
  ],
  daily: { orders: [{ kind: 'sink' as const, need: 3, progress: 1, done: false, silver: 100 }, { kind: 'ports' as const, need: 2, progress: 2, done: true, silver: 80 }, { kind: 'land' as const, need: 1, progress: 0, done: false, silver: 60 }], streak: 2, chest: false, chestSilver: 500 },
};

test('the campaign first: the Path, a Legend, the story — then the quests and contracts taken, then the orders', () => {
  const v = goalSheetView(self);
  assert.deepEqual(v.campaign.map((x) => x.key), ['q:q_path_corsair', 'q:q_legend_drowned', 'q:a_north_wreckers_2']);
  assert.equal(v.campaign[2].chapter, 2, "an arc's chapter");
  assert.deepEqual(v.active.map((x) => x.key), ['q:job_a', 'q:side_mika_1', 'q:job_b', 'c:c1', 'c:c2'], 'every quest taken (a side story too) and every contract (the soonest to lapse first)');
  assert.equal(v.active[1].kind, 'side');
  assert.deepEqual(v.daily.map((x) => x.key), ['d:sink', 'd:ports', 'd:land']);
  assert.equal(v.daily[1].done, true);
  assert.deepEqual(v.chest, { open: false, silver: 500, streak: 2 });
  // the counter on «Цели и вести»: 3 campaign + 5 taken + 2 orders not done
  assert.equal(goalCount(v), 10);
});

test('nothing taken: empty lists and their hints, in both languages', () => {
  const v = goalSheetView({ quests: [] });
  assert.equal(v.campaign.length + v.active.length + v.daily.length, 0);
  assert.equal(goalCount(v), 0);
  assert.equal(goalSheetView(null).active.length, 0);
  for (const l of ['ru', 'en'] as const) {
    setLang(l);
    const D = l === 'ru' ? RU : EN;
    const html = (campaignHtml(v, (id) => id) + goalsListHtml(v, (id) => id)).replace(/ /g, ' ');
    for (const k of ['campaignNone', 'activeNone', 'dailyNone'] as const) assert.ok(html.includes(D[k].slice(0, 14)), `${l} ${k}`);
  }
});

test('the rows: the campaign block on top, «Плыть» with the goal keys, progress, RU and EN', () => {
  const v = goalSheetView(self);
  for (const l of ['ru', 'en'] as const) {
    setLang(l);
    const D = l === 'ru' ? RU : EN;
    const top = campaignHtml(v, () => 'Gravesend').replace(/ /g, ' ');
    const list = goalsListHtml(v, () => 'Gravesend').replace(/ /g, ' '); // (the Russian typesetting's no-break spaces)
    assert.ok(top.includes('gs-campaign') && top.includes(D.campaign));
    assert.ok(top.indexOf('q:q_path_corsair') < top.indexOf('q:a_north_wreckers_2'));
    assert.ok(top.includes(D.chapter.replace('{n}', '2')));
    assert.ok(!top.includes('q:job_a'), 'a job is not the campaign');
    assert.ok(list.indexOf(D.active) < list.indexOf(D.daily), 'the quests before the orders');
    for (const k of ['q:job_a', 'q:side_mika_1', 'c:c1', 'c:c2', 'd:sink', 'd:land']) assert.ok(list.includes(`data-gsail="${k}"`), `«${D.sail}» on ${k}`);
    assert.ok(!list.includes('data-gsail="d:ports"'), 'an order done has no «Плыть»');
    assert.ok(top.includes(D.step.replace('{n}', '3').replace('{of}', '4')), 'the Path: step 3 of 4');
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
