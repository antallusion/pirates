// docs/23 phase 6: windows as bottom sheets — the pure parts. The port's one-tap «Продать всё» (what it sells, what
// stays aboard) and its three best quests, the gear's «Надеть лучшее», the chart's layers, the kit's window parts
// (one or two words on a button, the long words in a hint), the journal's frame, and RU/EN of the windows' words.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bestOffers, sellableGoods } from '../client/src/ui/port.ts';
import { bestGear, wearScore } from '../client/src/ui/gear.ts';
import { defaultLayers, toggleLayer } from '../client/src/ui/worldmap.ts';
import { LOG_PAGES, logTabOf } from '../client/src/ui/logbook.ts';
import { chipRow, quickBar, railTabs, wasBecomes } from '../client/src/ui/kit/window.ts';
import { EN as WEN, RU as WRU } from '../client/src/lang/ui/win.ts';
import { makeItem } from '../shared/src/data/items.ts';
import { Rng } from '../shared/src/rng.ts';
import type { Item } from '../shared/src/data/items.ts';
import type { ClientState } from '../client/src/state.ts';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r/g, '');

/** A harbour and a captain as the port's quick actions see them. */
function portState(cargo: Record<string, number>, o: { contracts?: { good?: string }[]; black?: boolean } = {}): ClientState {
  const market = ['provisions', 'rum', 'sugar', 'planks', 'dreamleaf', 'leviathan_bone', 'spices'].map((good) => ({ good, buy: 20, sell: 15, stock: 50, trend: 0, legal: good !== 'dreamleaf' }));
  return {
    portView: { portId: 'p1', market, contracts: [], questOffers: [] },
    ports: [{ id: 'p1', blackMarket: !!o.black }],
    self: { cargo, contracts: o.contracts ?? [], loadout: { classId: 'sloop' } },
  } as unknown as ClientState;
}

test(`«Продать всё»: every trade good in the hold — not the food, the repair stores, rare timber or contract cargo`, () => {
  const st = portState({ provisions: 30, rum: 10.6, sugar: 4, planks: 12, leviathan_bone: 2, spices: 3, dreamleaf: 5 }, { contracts: [{ good: 'spices' }] });
  const sold = sellableGoods(st);
  assert.deepEqual(sold.map((x) => x.good).sort(), ['rum', 'sugar']);
  assert.equal(sold.find((x) => x.good === 'rum')!.n, 10, 'whole units only');
  assert.equal(sold.reduce((a, x) => a + x.est, 0), 15 * 14);
  // A black market takes the contraband too.
  assert.ok(sellableGoods(portState({ dreamleaf: 5 }, { black: true })).some((x) => x.good === 'dreamleaf'));
  assert.deepEqual(sellableGoods(portState({ provisions: 40 })), [], 'nothing worth selling: the button is off');
});

test(`the Quests place: the board's offers best for her first — her level over the one above, the blocked last`, () => {
  const st = { self: { loadout: { classId: 'sloop' } } } as unknown as ClientState;
  const q = (id: string, silver: number, extra: Record<string, unknown> = {}) => ({ id, name: id, kind: 'job', mentor: '', summary: '', steps: [], blocked: null, silver, xp: 0, ...extra });
  const view = {
    contracts: [{ id: 'c1', kind: 'courier', title: 'letters', description: '', reward: 300, xp: 10, fromPort: 'a', toPort: 'b', expiresAt: 0 }],
    questOffers: [q('high', 900, { ship: 9 }), q('mine', 400), q('blocked', 2000, { blocked: 'Needs the Crown' }), q('urgent', 300, { urgent: true })],
  } as never;
  const order = bestOffers(view, st).map((o) => o.id);
  assert.equal(order.at(-1), 'blocked');
  assert.ok(order.indexOf('mine') < order.indexOf('high'), `${order}`);
  assert.equal(order.length, 5);
});

test(`«Надеть лучшее»: the locker's best piece for each slot it beats, never one above her level or a shut slot`, () => {
  const rng = new Rng(7);
  const mk = (uid: number, slot: string, rarity: number, ilvl = 2, dur = 100): Item => ({ ...makeItem(rng, uid, { ilvl, rarity: rarity as 0, slot: slot as never }), dur });
  const worn = mk(1, 'hat', 0);
  const self = {
    level: 12, loadout: { classId: 'sloop', gear: {} }, captainGear: { hat: worn },
    stash: [mk(2, 'hat', 2), mk(3, 'hat', 3), mk(4, 'hat', 4, 99), mk(5, 'coat', 1), mk(6, 'coat', 3, 2, 0), mk(7, 'boots', 1)],
  } as unknown as NonNullable<ClientState['self']>;
  const best = bestGear(self);
  const bySlot = Object.fromEntries(best.map((b) => [b.slot, b.uid]));
  assert.equal(bySlot.hat, 3, 'the best hat she may wear (not the one above her level)');
  assert.equal(bySlot.coat, 5, 'a broken coat is worth nothing');
  assert.equal(bySlot.boots, 7);
  assert.equal(wearScore(mk(8, 'coat', 2, 2, 0)), 0);
  // Already the best: nothing to do.
  assert.deepEqual(bestGear({ ...self, stash: [mk(9, 'hat', 0, 1)], captainGear: { hat: mk(10, 'hat', 3) } } as never), []);
});

test(`the chart's layers: the essentials on a phone, everything at a desk; «Всё» alone, a layer toggles, never none`, () => {
  assert.deepEqual([...defaultLayers(true)].sort(), ['goals', 'lairs', 'ports']);
  assert.deepEqual([...defaultLayers(false)], ['all']);
  const ess = defaultLayers(true);
  assert.deepEqual([...toggleLayer(ess, 'all')], ['all']);
  assert.deepEqual([...toggleLayer(new Set(['all'] as const), 'ports')], ['ports']);
  assert.deepEqual([...toggleLayer(new Set(['ports'] as const), 'ports')], ['ports'], 'the last layer stays');
  assert.deepEqual([...toggleLayer(ess, 'lairs')].sort(), ['goals', 'ports']);
});

test(`«Журнал»: five tabs; every company page sits under one of them`, () => {
  for (const page of ['group', 'guild', 'law', 'letters', 'isles', 'empires', 'career', 'album', 'legends', 'market']) assert.ok(Object.values(LOG_PAGES).some((p) => p.includes(page)), page);
  assert.equal(logTabOf('career'), 'album');
  assert.equal(logTabOf('law'), 'company');
  assert.equal(Object.keys(LOG_PAGES).length + 1, 5);
});

test(`the kit's window parts: big tabs and chips say a word or two, the sentence goes to the hint; a was→becomes card has one button`, () => {
  const rail = railTabs([{ id: 'market', icon: 'x', label: 'Рынок', hint: 'Товары, провизия и снаряды' }, { id: 'sea', icon: 'y', label: 'В море', primary: true }], 'market', 'ptab');
  assert.match(rail, /data-ptab="market" data-hint="Товары, провизия и снаряды"/);
  assert.match(rail, /w-tab--go/);
  assert.match(rail, /aria-selected="true"/);
  const chips = chipRow([{ id: 'ports', icon: 'p', label: 'Порты' }, { id: 'goals', icon: 'g', label: 'Цели' }], ['ports', 'goals'], 'mlayer');
  assert.equal((chips.match(/w-chip on/g) ?? []).length, 2, 'several lit at once (layers)');
  const wb = wasBecomes({ title: 'Бриг', rows: [{ label: 'Корпус', was: 900, becomes: 1500, better: true }], button: { label: 'Купить', primary: true, data: { act: 'ship' } } });
  assert.equal((wb.match(/<button/g) ?? []).length, 1);
  assert.match(wb, /900<\/span><span class="w-wb-arrow"[^>]*>→<\/span><b class="w-wb-new better">1500/);
  assert.equal(quickBar([]), '');
  // Every button word of the windows: one or two words (the hints may be sentences).
  for (const [k, v] of Object.entries(WRU)) {
    if (/Hint$/.test(k) || /^(port\.(event|hold|crew|purse)|mk\.(have|stock|priceHint|sellNone|suppliesOk|extra)|yd\.(state|gunsDown|top|module|more\w*)|tv\.(room|full|none|poor|more)|q\.(none|to|level|best|rest|mine)|cap\.(pick|levelUp)|isle\.collectNone|opt\.(back|title|autobattle|mmTarget))$/.test(k)) continue; // (opt.mmTarget: the owner's own words, 2026-10-09 — «Мини-карта при цели»)
    assert.ok(v.replace(/\{\w+\}/g, 'N').split(/\s+/).length <= 2, `${k}: «${v}» is more than two words`);
  }
});

test(`the windows' words in RU and EN together (i18n-sync), no Latin in the Russian`, () => {
  assert.deepEqual(Object.keys(WRU).sort(), Object.keys(WEN).sort());
  for (const [k, v] of Object.entries(WRU)) assert.ok(!/[A-Za-z]/.test(v.replace(/\{\w+\}/g, '')), `${k}: «${v}»`);
  for (const [k, v] of Object.entries(WEN)) {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    assert.equal(ph(v), ph(WRU[k as keyof typeof WRU]), `${k}: the same placeholders`);
  }
});

test(`every window is a sheet on a phone: a grip, a swipe down, a scrim tap; the answer-only ones keep still`, () => {
  const main = src('client/src/main.ts');
  assert.match(main, /wireSheetSwipe\(\$\('modal-panel'\)/);
  assert.match(main, /const ANSWER: Modal\[\] = \['boarding', 'sunk', 'mutiny', 'choice'\]/);
  assert.match(main, /g\.className = 'w-grip'/);
  const css = src('client/src/ui/kit/window.css');
  assert.match(css, /#modal-panel \{ width: 100vw; height: 90dvh;/);
  assert.match(css, /#modal-panel \.x-btn \{ width: 44px; height: 44px;/);
  assert.ok(src('client/index.html').indexOf('/src/ui/kit/window.css') > src('client/index.html').indexOf('/src/ui/kit/kit.css'));
  // The old port head and its tabs are gone with their CSS.
  assert.ok(!/class="[^"]*port-head/.test(src('client/src/ui/port.ts')));
  assert.ok(!/\.ph-sail\b/.test(src('client/styles.css')), 'the old «Поднять паруса» chip');
});
