// The window before sailing (owner, 2026-10-09: «не прям автодокупку, а при выходе из порта должно показываться окошко
// где будет сказано что нужно докупить чтобы отправиться в море нормально»): what is short and how much at the harbour's
// prices — provisions, the repairs (the yard, or the carpenters' planks and sailcloth when the yard is past her purse),
// round shot, hands — «Докупить всё» as far as her silver goes, a row's own button when it fits; nothing bought by
// itself, and nothing short is no window.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walkBuyCost } from '../shared/src/data/goods.ts';
import { voyageNeeds, voyageStores } from '../shared/src/data/voyage.ts';
import { departOffers, departPlan, fitOffer, voyageOrder, voyageShip } from '../client/src/ui/depart.ts';
import type { ClientState } from '../client/src/state.ts';
import { EN, RU } from '../client/src/lang/ui/port.ts';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r/g, '');

/** A sloop in a harbour: her hold, her purse, her hull — and what the harbour sells. */
function harbour(over: { gold?: number; provisions?: number; round?: number; crew?: number; hull?: number; sails?: number; planks?: number; repair?: number; market?: string[] } = {}): ClientState {
  const sells = over.market ?? ['provisions', 'planks', 'sailcloth'];
  const prices: Record<string, number> = { provisions: 10, planks: 12, sailcloth: 15 };
  return {
    portView: {
      portId: 'p1',
      market: sells.map((good) => ({ good, buy: prices[good] ?? 20, sell: 8, stock: 60, trend: 0, legal: true })),
      crewAvailable: 30, crewHireCost: 20, ammoPrices: { round: 2 }, shipyard: { repairCost: over.repair ?? 340 },
      contracts: [], questOffers: [],
    },
    ports: [{ id: 'p1', blackMarket: false }],
    self: { gold: over.gold ?? 5000, crew: over.crew ?? 20, cargo: { provisions: over.provisions ?? 0, planks: over.planks ?? 0 }, ammo: { round: over.round ?? 20 }, dockedAt: 'p1', contracts: [], quests: [], loadout: { classId: 'sloop' } },
    you: { hull: (over.hull ?? 0.55) * 900, hullMax: 900, sails: (over.sails ?? 0.75) * 300, sailsMax: 300, rudderHp: 1 },
    ownStats: { crewMin: 12, crewMax: 60, provisionUse: 1, holdVolume: 120, contrabandVolumeMul: 1, materialVolumeMul: 1, provisionVolumeMul: 1, cursedVolumeMul: 1, gunsPerSide: 6, x: {} },
  } as unknown as ClientState;
}

test('the window’s list: what a voyage wants and how much at the harbour’s prices, in the order a voyage needs it', () => {
  const st = harbour();
  const ship = voyageShip(st)!;
  const needs = voyageNeeds(ship);
  assert.deepEqual(needs.map((n) => n.kind).sort(), ['ammo', 'crew', 'food', 'repair']);
  const offers = departOffers(st);
  assert.deepEqual(offers.map((o) => o.need.kind), ['food', 'repair', 'ammo', 'crew'], 'food, repairs, shot, hands');
  const food = offers[0], repair = offers[1], ammo = offers[2], crew = offers[3];
  // Provisions: the voyage's want — for the hands she would hire here too — at the market's walking price.
  const cNeed = needs.find((n) => n.kind === 'crew')!;
  const hire = cNeed.kind === 'crew' ? Math.min(cNeed.buy, 30) : 0;
  assert.ok(hire > 0);
  const fNow = needs.find((n) => n.kind === 'food')!;
  const fNeed = voyageNeeds({ ...ship, crew: ship.crew + hire }).find((n) => n.kind === 'food')!;
  assert.ok(fNeed.kind === 'food' && fNow.kind === 'food' && fNeed.buy > fNow.buy, 'more hands, more food');
  assert.ok(food.n === fNeed.buy && food.n > 0);
  assert.equal(food.cost, walkBuyCost('provisions', 10, 60, food.n));
  assert.deepEqual(food.msgs, [{ t: 'trade', good: 'provisions', qty: food.n }]);
  // Repairs: the yard whole, the carpenters' stores behind it.
  assert.equal(repair.via, 'yard');
  assert.equal(repair.cost, 340);
  assert.deepEqual(repair.msgs, [{ t: 'shipyard', action: 'repair' }]);
  const want = voyageStores({ hull: 0.55 * 900, hullMax: 900, sails: 0.75 * 300, sailsMax: 300, rudderHp: 1, use: 1, planks: 0, cloth: 0 });
  assert.deepEqual(repair.alt?.stores, want);
  assert.equal(repair.alt?.cost, walkBuyCost('planks', 12, 60, want.planks) + walkBuyCost('sailcloth', 15, 60, want.cloth));
  // Shot by tens at the harbour's price; hands at the tavern's.
  assert.equal(ammo.n % 10, 0);
  assert.equal(ammo.cost, Math.ceil(2 * ammo.n));
  assert.equal(crew.cost, Math.ceil(20 * crew.n));
  assert.deepEqual(crew.msgs, [{ t: 'hire_crew', qty: crew.n, prof: 'sailor' }]);
  // The market's «Припасы» buys the same food and shot.
  const sup = voyageOrder(st, ['food', 'ammo']);
  assert.equal(sup.cost, food.cost + ammo.cost);
});

test('«Докупить всё»: everything at a full purse; as far as her silver goes at a thin one — a part, the stores for the yard', () => {
  const st = harbour();
  const offers = departOffers(st);
  const whole = offers.reduce((a, o) => a + o.cost, 0);
  let p = departPlan(offers, 5000);
  assert.equal(p.all, true);
  assert.equal(p.cost, whole);
  assert.deepEqual(p.buy.map((o) => o.need.kind), ['food', 'repair', 'ammo', 'crew']);
  assert.equal(p.buy[1].via, 'yard');
  // Just short of it all: the food and the yard whole, the rest a part.
  p = departPlan(offers, whole - 30);
  assert.equal(p.all, false);
  assert.ok(p.cost <= whole - 30 && p.cost > whole - 120, `${p.cost}`);
  // A thin purse: the food first, the yard past it — the planks and sailcloth instead, then what is left.
  const food = offers[0];
  const thin = food.cost + 120;
  p = departPlan(offers, thin);
  assert.equal(p.all, false);
  assert.ok(p.cost <= thin);
  assert.equal(p.buy[0], food, 'the food whole');
  assert.equal(p.buy[1].via, 'stores', 'the carpenters’ stores for the yard she cannot pay');
  assert.ok(p.buy.every((o) => o.cost <= thin && o.msgs.length > 0));
  // Ten silver: a part of the food, nothing else.
  p = departPlan(offers, 10);
  assert.equal(p.buy.length, 1);
  assert.ok(p.buy[0].need.kind === 'food' && p.buy[0].n === 1 && p.cost === 10);
  // No silver at all: nothing.
  assert.deepEqual(departPlan(offers, 0).buy, []);
});

test('a row’s own button: the whole when it fits, else the part her purse reaches, the shot by tens; none where nothing is sold', () => {
  const offers = departOffers(harbour());
  const ammo = offers.find((o) => o.need.kind === 'ammo')!;
  assert.equal(fitOffer(ammo, ammo.cost), ammo);
  const part = fitOffer(ammo, ammo.cost - 1)!;
  assert.ok(part.n < ammo.n && part.n % 10 === 0 && part.cost <= ammo.cost - 1);
  assert.equal(fitOffer(ammo, 19), null, 'not ten balls’ worth');
  const repair = offers.find((o) => o.need.kind === 'repair')!;
  assert.equal(fitOffer(repair, 339)?.via, 'stores');
  assert.equal(fitOffer(repair, 340)?.via, 'yard');
  // A harbour that sells no provisions, no planks: food not to be had, the yard or nothing.
  const bare = departOffers(harbour({ market: [] }));
  const f = bare.find((o) => o.need.kind === 'food')!;
  assert.equal(f.n, 0);
  assert.equal(fitOffer(f, 9999), null);
  const r = bare.find((o) => o.need.kind === 'repair')!;
  assert.equal(r.alt, null);
  assert.equal(fitOffer(r, 100), null);
  assert.equal(departPlan(bare, 100).all, false);
});

test('nothing short is no window; nothing bought by itself; the words in both tongues', () => {
  // All aboard: no needs, so casting off goes straight to sea.
  const full = harbour({ provisions: 200, round: 200, crew: 60, hull: 1, sails: 1 });
  assert.deepEqual(voyageNeeds(voyageShip(full)!), []);
  assert.deepEqual(departOffers(full), []);
  const dp = src('client/src/ui/depart.ts');
  assert.ok(dp.includes('!voyageNeeds(ship).length || state.onboarding?.stage) return go();'), 'nothing short: straight to sea');
  // The one road to the harbour's orders is her press in the window.
  const sends = [...dp.matchAll(/send\(m\)/g)].map((m) => m.index!);
  assert.equal(sends.length, 1);
  assert.ok(sends[0] > dp.indexOf("sheet.panel.addEventListener('click'"), 'only from a press');
  assert.ok(!/sailedAnyway|boughtLine|setDepartSay/.test(dp), 'no buying on the way out, no line of what was bought');
  // The server takes on no stores at the way out.
  assert.ok(!src('server/src/game/Game.ts').includes('takeOnStores'));
  // The owner's words on the buttons, and every word in both.
  assert.match(RU['depart.buyAll'], /^Докупить всё/);
  assert.equal(RU['depart.sailAnyway'], 'Отплыть так');
  for (const k of Object.keys(EN).filter((x) => x.startsWith('depart.')) as (keyof typeof EN)[]) {
    assert.ok(RU[k], k);
    assert.ok(!/[A-Za-z]{2,}/.test(RU[k].replace(/\{\w+\}/g, '')), `${k}: ${RU[k]}`);
    assert.ok(!/[А-Яа-яЁё]/.test(EN[k]), `${k}: ${EN[k]}`);
  }
});
