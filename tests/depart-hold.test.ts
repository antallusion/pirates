// Leaving port (owner, 2026-10-19: «Выходя из порта должны оставлять 20 процентов места на корабле после авто покупки
// рекомендаций. Щас я ваще просто не понимаю как я забиваю корабль и чем. Вроде ниче не покупал а корабль забит. В
// рекомендациях из выхода из порта всегда надо предлагать провизию и парусину если мы еще не предлагаем. Примерно на
// одну починку.»):
//  - the buying on the way out (the window's «Докупить всё», «Всегда докупать») leaves a fifth of the hold free: the
//    cargo after it at most 80 % — before, the voyage's food alone asked up to half the hold, and with the planks and
//    sailcloth for the yard the hold came out full;
//  - provisions and one repair's sailcloth are always offered while short of them;
//  - what fills the hold is read by the room each good takes, the most first (the ship's panel, the harbour, the ship's
//    screen).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS } from '../shared/src/data/goods.ts';
import { HOLD_KEEP_FREE, KIT_SAILS, buyRoom, repairKitCloth, voyageNeeds } from '../shared/src/data/voyage.ts';
import { SAILS_PER_CLOTH } from '../shared/src/data/dealings.ts';
import { cargoVolume } from '../shared/src/sim/shipstats.ts';
import { departOffers, departPlan, holdRoom, voyageShip } from '../client/src/ui/depart.ts';
import { holdMix, holdMixText } from '../client/src/ui/holdmix.ts';
import type { ClientState } from '../client/src/state.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { EN, RU } from '../client/src/lang/ui/port.ts';

function harbour(cargo: Record<string, number>, over: { hold?: number; crew?: number; gold?: number; sailsMax?: number } = {}): ClientState {
  const prices: Record<string, number> = { provisions: 10, planks: 12, sailcloth: 15 };
  return {
    portView: {
      portId: 'p1',
      market: ['provisions', 'planks', 'sailcloth'].map((good) => ({ good, buy: prices[good], sell: 8, stock: 400, trend: 0, legal: true })),
      crewAvailable: 0, crewHireCost: 20, ammoPrices: { round: 2 }, shipyard: { repairCost: 340 }, contracts: [], questOffers: [],
    },
    ports: [{ id: 'p1', blackMarket: false }],
    self: { gold: over.gold ?? 1_000_000, crew: over.crew ?? 140, cargo, ammo: { round: 500 }, dockedAt: 'p1', contracts: [], quests: [], loadout: { classId: 'brig' } },
    you: { hull: 900, hullMax: 900, sails: over.sailsMax ?? 300, sailsMax: over.sailsMax ?? 300, rudderHp: 1 },
    ownStats: { crewMin: 40, crewMax: 140, provisionUse: 1, holdVolume: over.hold ?? 100, contrabandVolumeMul: 1, materialVolumeMul: 1, provisionVolumeMul: 1, cursedVolumeMul: 1, gunsPerSide: 6, x: {} },
  } as unknown as ClientState;
}

const used = (cargo: Record<string, number>) => cargoVolume(cargo as never, 1, 1, 1, 1);

/** The cargo after «Докупить всё» (its orders carried out as the harbour would). */
function afterBuying(st: ClientState): Record<string, number> {
  const plan = departPlan(departOffers(st), st.self!.gold, holdRoom(st));
  const cargo = { ...(st.self!.cargo as Record<string, number>) };
  for (const o of plan.buy) for (const m of o.msgs) if (m.t === 'trade') cargo[m.good] = (cargo[m.good] ?? 0) + m.qty;
  return cargo;
}

test('the way out leaves a fifth of the hold free: the cargo after the buying is at most 80 % of it, whatever was aboard', () => {
  assert.equal(HOLD_KEEP_FREE, 0.2);
  for (const [name, cargo] of [
    ['an empty hold', {}],
    ['a third full of fish', { fish: 33 }],
    ['three quarters full of loot', { rum: 50, sugar: 25 }],
  ] as const) {
    const st = harbour({ ...cargo });
    const after = afterBuying(st);
    const was = used({ ...cargo });
    const now = used(after);
    assert.ok(now <= 100 * (1 - HOLD_KEEP_FREE) + 1e-6 || now <= was + 1e-6, `${name}: ${now.toFixed(1)} of 100 m³ after buying (was ${was})`);
    if (was < 80) assert.ok(now > was, `${name}: something was bought`);
  }
  // already past 80 %: nothing at all is bought into it
  const full = harbour({ rum: 85 });
  assert.equal(holdRoom(full), 0);
  assert.deepEqual(departPlan(departOffers(full), 1e6, holdRoom(full)).buy.filter((o) => o.vol(o.n) > 0), []);
  // the room is the free hold less a fifth of the whole
  assert.equal(buyRoom({ holdVolume: 100, holdFree: 70 }), 50);
  assert.equal(buyRoom({ holdVolume: 100, holdFree: 15 }), 0);
});

test('provisions and one repair\'s sailcloth are always offered while short of them — and not once enough is aboard', () => {
  const kit = repairKitCloth(300);
  assert.equal(kit, Math.ceil((300 * KIT_SAILS) / SAILS_PER_CLOTH));
  // nothing aboard: both, food first
  let offers = departOffers(harbour({}));
  assert.deepEqual(offers.slice(0, 2).map((o) => o.need.kind), ['food', 'cloth']);
  const cloth = offers[1];
  assert.equal(cloth.n, kit);
  assert.deepEqual(cloth.msgs, [{ t: 'trade', good: 'sailcloth', qty: kit }]);
  // the food enough, the sailcloth not: the sailcloth alone (the ship sound, the shot and the hands aboard)
  const fed = voyageShip(harbour({ provisions: 200 }))!;
  offers = departOffers(harbour({ provisions: 200 }, { hold: 400 }));
  assert.deepEqual(offers.map((o) => o.need.kind), ['cloth'], JSON.stringify(voyageNeeds(fed)));
  // a repair's worth aboard: nothing about it
  offers = departOffers(harbour({ provisions: 200, sailcloth: kit }, { hold: 400 }));
  assert.deepEqual(offers, []);
  // the words, both tongues
  for (const k of ['depart.cloth', 'depart.clothLine', 'depart.keepFree'] as const) {
    assert.ok(EN[k] && RU[k], k);
    assert.ok(!/[A-Za-z]/.test(RU[k].replace(/\{[a-z]+\}/g, '')), `RU ${k}`);
  }
});

test('what fills the hold: by the room each good takes, the most first, in her language', () => {
  const mix = holdMix({ provisions: 40, fish: 12, planks: 4, rum: 0 } as never, { provisionVolumeMul: 1, materialVolumeMul: 1 });
  assert.deepEqual(mix.map((p) => p.good), ['provisions', 'fish', 'planks'].sort((a, b) => cargoVolume({ [b]: { provisions: 40, fish: 12, planks: 4 }[b] } as never) - cargoVolume({ [a]: { provisions: 40, fish: 12, planks: 4 }[a] } as never)));
  assert.equal(mix.reduce((a, p) => a + p.vol, 0).toFixed(3), cargoVolume({ provisions: 40, fish: 12, planks: 4 } as never).toFixed(3));
  setLang('ru');
  applyDataLocale('ru'); // (the goods' names, as main.ts sets them for her language)
  try {
    const t = holdMixText(mix, 2).replace(/\s/g, ' ');
    assert.ok(!/[A-Za-z]/.test(t), t);
    assert.ok(t.includes(`${GOODS[mix[0].good].name.toLowerCase()} ${Math.floor(mix[0].n)}`), t);
    assert.match(t, /ещё 1: \d+ м³/);
    assert.equal(holdMixText([]), 'трюм пуст');
  } finally {
    setLang('en');
    applyDataLocale('en');
  }
});
