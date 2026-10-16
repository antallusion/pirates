// The port's «Задания» and the journal's list (owner, 2026-10-16): the switches gather everything takeable in port, a
// card shows its band, its danger, where it goes and «Взять» (or why not), and «Плыть» once taken; the journal lists
// every quest and every contract she holds, each with «Плыть».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLang } from '../client/src/i18n.ts';
import { BOARD_CHIPS, bandAnchor, boardChips, boardHtml, boardItems, itemsOf } from '../client/src/ui/board.ts';
import { Journal } from '../client/src/ui/journal.ts';
import { EN, RU } from '../client/src/lang/ui/board.ts';
import type { ClientState } from '../client/src/state.ts';

const offer = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, kind: 'job', mentor: 'M', summary: 'S', steps: ['go'], blocked: null, silver: 300, xp: 40, band: [1, 2], ...extra });

function state(o: { quests?: unknown[]; contracts?: unknown[]; view?: Record<string, unknown> } = {}): ClientState {
  const view = {
    portId: 'p1',
    contracts: [{ id: 'c1', kind: 'courier', title: 'Letters', description: 'd', reward: 200, xp: 10, fromPort: 'p1', toPort: 'p2', expiresAt: 0, band: [1, 2] },
      { id: 'c2', kind: 'bounty', title: 'Bounty', description: 'd', reward: 900, xp: 30, fromPort: 'p1', kills: 3, expiresAt: 0, band: [7, 9], blocked: 'Not your level: ⚓7–9' }],
    questOffers: [offer('job1', { dest: { x: 3000, y: 0, port: 'p2' } }), offer('arc1', { kind: 'story', category: 'arc', band: undefined }), offer('hot', { urgent: true }), offer('elite', { category: 'elite', group: 3, band: [2, 4] }),
      offer('far', { band: [7, 9], blocked: 'Not your level: ⚓7–9' })],
    ...o.view,
  };
  return {
    portView: view,
    ports: [{ id: 'p1', name: 'Saltmarrow', x: 0, y: 0 }, { id: 'p2', name: 'Bellreach', x: 3000, y: 0 }],
    islands: new Map(),
    ownDisplay: { x: 0, y: 0 },
    party: null,
    renown: null,
    omen: null,
    wonders: null,
    dutchman: null,
    wanted: null,
    raid: null,
    tattoos: null,
    guild: null,
    tasks: [],
    worldGoals: [],
    guildInvites: [],
    unread: 0,
    self: { dockedAt: 'p1', loadout: { classId: 'sloop' }, quests: o.quests ?? [], contracts: o.contracts ?? [], questsDone: [], talents: {}, pvp: { challenges: [] }, daily: { orders: [], chest: false, chestSilver: 0, streak: 0 }, log: [], saga: [] },
  } as unknown as ClientState;
}

test('the board: every switch, the cards in theirs, what she may not take last with its reason', () => {
  setLang('en');
  const st = state();
  const items = boardItems(st.portView!, st);
  assert.deepEqual(BOARD_CHIPS, ['all', 'jobs', 'story', 'contracts', 'urgent', 'daily', 'guild', 'mine']);
  assert.deepEqual(itemsOf(items, 'story').map((x) => x.id), ['arc1']);
  assert.ok(itemsOf(items, 'urgent').some((x) => x.id === 'hot') && itemsOf(items, 'urgent').some((x) => x.id === 'elite'));
  assert.deepEqual(itemsOf(items, 'contracts').map((x) => x.id).sort(), ['c1', 'c2', 'elite']);
  assert.ok(itemsOf(items, 'jobs').some((x) => x.id === 'job1'));
  // the blocked go last, with their words on the card and «Take» off
  const order = items.map((x) => x.id);
  assert.ok(order.indexOf('far') > order.indexOf('job1') && order.indexOf('c2') > order.indexOf('c1'), `${order}`);
  const html = boardHtml(st.portView!, st, 'all', { adm: '', contracts: '', daily: '', service: '' });
  assert.match(html, /Not your level: ⚓7–9/);
  assert.match(html, /data-act="quest_accept" data-id="far" disabled/);
  assert.match(html, /data-act="quest_accept" data-id="job1">/);
  assert.match(html, /For ⚓1–2/, 'the band on the card');
  assert.match(html, /→ Bellreach · 3(\.|,)0 km/, 'where and how far');
  // the counts on the switches: what she may take now
  const chips = boardChips(items, st, st.portView!);
  assert.equal(chips.find((c) => c.id === 'all')!.badge, 5);
  assert.equal(bandAnchor([1, 2]), 1);
  assert.equal(bandAnchor([4, 6]), 5);
  assert.equal(bandAnchor([9, 10]), 10);
});

test('the board: a card taken here turns «Взять» into «Плыть»; «Взятые» lists everything with «Плыть»', () => {
  setLang('en');
  const st = state();
  boardItems(st.portView!, st); // she sees the board
  // she takes job1 and c1: the server drops them from the board, they are hers
  const taken = state({
    quests: [{ id: 'job1', name: 'job1', kind: 'job', step: 1, steps: 2, text: 'go', progress: 0, need: 1, target: { x: 3000, y: 0, port: 'p2', act: 'dock' } }],
    contracts: [{ id: 'c1', kind: 'courier', title: 'Letters', description: 'd', reward: 200, xp: 10, fromPort: 'p1', toPort: 'p2', expiresAt: 0 }],
  });
  const tv = taken.portView as unknown as { questOffers: { id: string }[]; contracts: { id: string }[] };
  tv.questOffers = tv.questOffers.filter((q) => q.id !== 'job1');
  tv.contracts = tv.contracts.filter((c) => c.id !== 'c1');
  const items = boardItems(taken.portView!, taken);
  assert.deepEqual(items.filter((x) => x.taken).map((x) => x.id).sort(), ['c1', 'job1']);
  const all = boardHtml(taken.portView!, taken, 'all', { adm: '', contracts: '', daily: '', service: '' });
  assert.match(all, /data-act="goal" data-key="q:job1"/);
  const mine = boardHtml(taken.portView!, taken, 'mine', { adm: '', contracts: '', daily: '', service: '' });
  assert.match(mine, /data-key="q:job1"/);
  assert.match(mine, /data-key="c:c1"/);
  assert.match(mine, /Taken: 2/);
});

test('the journal lists every quest and every contract she holds, each with «Плыть»; none of «five at most»', () => {
  setLang('ru');
  const quests = Array.from({ length: 7 }, (_, i) => ({ id: `q${i}`, name: `Quest ${i}`, kind: 'job', mentor: 'M', step: 1, steps: 2, text: 'go', progress: 1, need: 3, target: { x: 100 * i, y: 0, port: 'p2', act: 'dock' } }));
  const st = state({ quests, contracts: [{ id: 'c9', kind: 'courier', title: 'Letters', description: 'd', reward: 200, xp: 10, fromPort: 'p1', toPort: 'p2', expiresAt: 0 }] });
  let html = '';
  const root = { set innerHTML(v: string) { html = v; }, get innerHTML() { return html; }, querySelectorAll: () => [], querySelector: () => null } as unknown as HTMLElement;
  new Journal(() => {}).render(root, st);
  for (const q of quests) assert.match(html, new RegExp(`data-jq="${q.id}"`));
  assert.match(html, /data-jq="c:c9"/, 'the contract is in the journal');
  assert.equal((html.match(/data-jgo=/g) ?? []).length, 8, '«Плыть» on every row');
  assert.match(html, /1\/2 · 1\/3/, 'the step and its count');
  assert.doesNotMatch(html, /пяти|five/i);
});

test('the board\'s words: RU has every key, with no Latin', () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const [k, v] of Object.entries(RU)) assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /[A-Za-z]/, k);
});
