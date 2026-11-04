// Эдуард's three posts on the forum (65, 67, 68):
//  65 — «Найти» on the sea chart: a known place by its name (prefix, «ё» = «е», her language's names and the English),
//       how far and which way; never a place she has not found. The journal's quest step has «Показать на карте».
//  67 — the drowned talk again («Переговоры») to a captain with the Drowned Shrine on her island; without it «Атаковать»
//       alone, with the hint where the talks come from; the server holds to it.
//  68 — the chart's «Верфи» shows only the yards she has found (none under the fog, not even dimly); a sea's chart bought
//       in port inks that sea's yards in; the sea's charts cost twice what they did.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLang } from '../client/src/i18n.ts';
import { chartPlaces, findPlaces, foldName } from '../client/src/ui/chartfind.ts';
import type { ChartKnown, ChartPlace } from '../client/src/ui/chartfind.ts';
import { chartYards, portKnown } from '../client/src/ui/worldmap.ts';
import { shipRing } from '../client/src/ui/hail.ts';
import type { RingFacts } from '../client/src/ui/hail.ts';
import { FOG_SIDE, fogCell } from '../shared/src/data/fog.ts';
import { GUIDE } from '../shared/src/data/guide/index.ts';
import { serverText } from '../client/src/lang/server.ts';
import { EN as WM_EN, RU as WM_RU } from '../client/src/lang/ui/worldmap.ts';
import { EN as H_EN, RU as H_RU } from '../client/src/lang/ui/hail.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import { DROWNED_NO_TALK, advMap, cardView, drownedGuard, guardChoice, guardOffer, guardRatio, parkNear, quietAdv } from '../server/src/game/advmap.ts';
import { hasDrownedShrine, townState } from '../server/src/game/town.ts';
import { yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { mineSites } from '../server/src/game/mines.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { CHART_PRICE_MUL, chartPrice, islandChartValue } from '../server/src/game/ports.ts';
import { fogState } from '../server/src/game/fog.ts';
import { fogSeen } from '../shared/src/data/fog.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, offCoast, onHull, steps } from './helpers.ts';

// ------------------------------------------------------------------------------------------------ 65. «Найти»

const P = (key: string, name: string, x: number, y: number, en?: string): ChartPlace => ({ key, kind: key.startsWith('p:') ? 'port' : 'island', name, x, y, ...(en ? { en } : {}) });

test('forum 65: the search folds a name — lower case, «ё» as «е», no quotes or dashes', () => {
  assert.equal(foldName('  Ёлкин «Риф»  '), 'елкин риф');
  assert.equal(foldName('Порт-Грейвсенд'), 'порт грейвсенд');
  assert.equal(foldName("St. Elmo's Rock"), 'st elmos rock');
});

test('forum 65: a prefix finds the name, then a later word of it; the nearest first; «ё» = «е»; the English too', () => {
  const places = [
    P('p:gravesend', 'Порт-Грейвсенд', 1000, 0, 'Port Gravesend'),
    P('i:1', 'Грейвская отмель', 9000, 0, 'Grave Shoal'),
    P('i:2', 'Ёжиков остров', 0, -5000, 'Hedgehog Isle'),
    P('i:3', 'Грейв', 20000, 0, 'Grave'),
    P('i:4', 'Солёная коса', 0, 3000, 'Salt Spit'),
  ];
  const own = { x: 0, y: 0 };
  assert.deepEqual(findPlaces(places, 'грейв', own).map((h) => h.key), ['i:1', 'i:3', 'p:gravesend'], 'the name\'s own start first (nearest first), then a word\'s');
  assert.deepEqual(findPlaces(places, 'ежик', own).map((h) => h.key), ['i:2'], '«е» finds «Ё»');
  assert.deepEqual(findPlaces(places, 'солен', own).map((h) => h.key), ['i:4'], '«е» finds «ё» inside');
  assert.deepEqual(findPlaces(places, 'port grav', own).map((h) => h.key), ['p:gravesend'], 'the English name, several words');
  assert.deepEqual(findPlaces(places, 'hedge', own).map((h) => h.key), ['i:2']);
  assert.deepEqual(findPlaces(places, 'ейв', own), [], 'a prefix, not a middle');
  assert.deepEqual(findPlaces(places, '   ', own), [], 'nothing typed: nothing');
  // how far and which way: north is −y, clockwise
  const e = findPlaces(places, 'ежик', own)[0];
  assert.equal(Math.round(e.d), 5000);
  assert.ok(Math.abs(e.bearing) < 1e-9, 'due north');
  const s = findPlaces(places, 'соле', own)[0];
  assert.ok(Math.abs(s.bearing - Math.PI) < 1e-9, 'due south');
  assert.ok(findPlaces(places, 'г', own, 2).length === 2, 'the limit');
});

test('forum 65: only what her chart shows — charted islands, found ports and villages; nothing under the fog', () => {
  // a fog with only the west half of the first row of squares seen
  const bits = new Uint8Array(Math.ceil((FOG_SIDE * FOG_SIDE) / 8));
  const see = (x: number, y: number) => {
    const c = fogCell(x, y);
    bits[c >> 3] |= 1 << (c & 7);
  };
  see(500, 500);
  see(1500, 500);
  see(2500, 500);
  const k: ChartKnown = {
    seen: bits,
    discovered: new Set([1, 2, 5]),
    islands: new Map([
      [1, { id: 1, name: 'Charted Isle', x: 500, y: 500 }],
      [2, { id: 2, name: 'Fogged Isle', x: 50_000, y: 50_000 }], // charted, yet under the fog (never so in play): not told
      [3, { id: 3, name: 'Unknown Isle', x: 1500, y: 500 }], // not charted: never
      [4, { id: 4, name: 'Village Isle', x: 2500, y: 500, portId: 'bc_v1' }],
      [5, { id: 5, name: 'Port Isle', x: 1500, y: 500, portId: 'gravesend' }],
    ]),
    ports: [
      { id: 'gravesend', name: 'Port Gravesend', x: 1500, y: 500 },
      { id: 'bc_v1', name: 'Hidden Village', x: 2500, y: 500 }, // its island not charted: not found
      { id: 'far', name: 'Far Port', x: 60_000, y: 60_000 }, // a key port under the fog
    ],
    lights: [{ island: 1, name: 'Charted Isle', x: 500, y: 500 }],
    coves: [{ name: 'Smugglers Cove', x: 900, y: 900 }],
  };
  const all = chartPlaces(k);
  assert.deepEqual(all.map((p) => p.key).sort(), ['c:0', 'i:1', 'p:gravesend'].sort(), JSON.stringify(all));
  assert.equal(all.find((p) => p.key === 'i:1')?.kind, 'light', 'a lighthouse on a charted island');
  for (const q of ['unknown', 'fogged', 'hidden', 'far']) assert.deepEqual(findPlaces(all, q, null), [], `«${q}» never found`);
  // the village is found once its island is charted
  const k2 = { ...k, discovered: new Set([1, 4, 5]) };
  assert.ok(chartPlaces(k2).some((p) => p.key === 'p:bc_v1'));
  // no fog yet (before the server's word): all of it seen — still only the charted
  assert.ok(!chartPlaces({ ...k, seen: null }).some((p) => p.key === 'i:3'));
});

test('forum 65: the chart has «Найти» (RU/EN), the journal «Показать на карте»', () => {
  setLang('ru');
  assert.equal(WM_RU['find.btn'], 'Найти');
  assert.equal(WM_RU['find.sail'], 'Проложить курс');
  assert.equal(WM_EN['find.sail'], 'Set course');
  for (const [k, v] of Object.entries(WM_RU)) if (k.startsWith('find.')) assert.ok(!/[a-z]{3,}/i.test(v.replace(/\{\w+\}/g, '')), `${k}: Latin in Russian`);
  const wm = readFileSync(new URL('../client/src/ui/worldmap.ts', import.meta.url), 'utf8');
  assert.match(wm, /data-mfind/);
  assert.match(wm, /data-mfsail/);
  const jr = readFileSync(new URL('../client/src/ui/journal.ts', import.meta.url), 'utf8');
  assert.match(jr, /data-jmap/);
  assert.match(jr, /onMap: 'Показать на карте'/);
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /journal\.onShowMap = /);
});

// ------------------------------------------------------------------------------------------------ 67. the drowned

const ring = (f: Partial<RingFacts>) => shipRing({ kind: 'deep', isPlayer: false, attackOk: true, boardNow: false, struck: false, running: null, ...f });

test('forum 67: the drowned\'s ring — «Переговоры» with the shrine; «Атаковать» alone and the hint without; the other deep as before', () => {
  setLang('ru');
  const yes = ring({ drowned: 'shrine' });
  assert.deepEqual(yes.map((c) => c.id), ['fight', 'talk']);
  assert.equal(yes[1].label, 'Переговоры');
  const no = ring({ drowned: 'none' });
  assert.deepEqual(no.map((c) => c.id), ['fight']);
  assert.equal(no[0].sub?.replace(/\s/g, ' '), 'Переговоры — со Святилищем утопленников на острове');
  const beast = ring({});
  assert.deepEqual(beast.map((c) => c.id), ['fight']);
  assert.equal(beast[0].sub, undefined, 'a beast: no hint');
  assert.ok(H_EN.parleyNeed && H_RU.parleyNeed);
  assert.equal(drownedGuard('wreck'), true);
  assert.equal(drownedGuard('holdout'), false);
  assert.equal(serverText(DROWNED_NO_TALK).replace(/\s/g, ' '), 'Утопленники ведут переговоры только с капитаном, у которого на острове есть Святилище утопленников.');
});

function world(): Game {
  const { game } = makeGame();
  game.wallNow = () => 20_000 * 86_400_000;
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

/** A strong captain with an island of her own (no shrine on it yet). */
function islander(game: Game): PlayerSession {
  join(game, 'Shrine Keeper');
  const s = game.sessionByName('Shrine Keeper')!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  assert.ok(offCoast(game, ship, home));
  ship.state.speed = 0;
  ship.region = home.region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  onHull(game, ship, 'frigate', 9);
  ship.setArmy(armyForLevel(9, ship.stats.crewMax, ship.armySlots, 'player'));
  ship.morale = 90;
  return s;
}

test('forum 67: the server — no shrine, the drowned never yield and refuse the talks; the shrine built, they hear her out', () => {
  const game = world();
  const s = islander(game);
  assert.equal(hasDrownedShrine(game, s), false);
  const g = advMap(game).guards.find((x) => x.kind === 'wreck')!;
  assert.ok(g, 'a wreck of the drowned in the world');
  parkNear(game, s, g.x, g.y, 40);
  steps(game, 60);
  runAdmin(game, s, '/guard weak wreck'); // (a tenth of its men: far the weaker)
  steps(game, 20);
  assert.ok(guardRatio(game, s, g) >= 3, `her army far the stronger (${guardRatio(game, s, g)})`);
  assert.equal(guardOffer(game, s, g), null, 'no shrine: no offer');
  assert.equal(guardChoice(game, s, g.id, 'talk'), DROWNED_NO_TALK);
  assert.equal(guardChoice(game, s, g.id, 'flee'), DROWNED_NO_TALK, 'nor let go by a card sent anyway');
  const gc = cardView(game, s)?.guard ?? cardView(game, s)?.obj?.guard;
  if (gc) assert.equal(gc.offer, null, 'the card offers nothing');
  // the Drowned Shrine on her island
  const t = townState(yardOf(game, ownIsland(game, s.accountId)!));
  t.b = { ...t.b, hall: Math.max(1, t.b.hall ?? 0), dw7: 1 };
  assert.equal(hasDrownedShrine(game, s), true);
  const offer = guardOffer(game, s, g);
  assert.ok(offer === 'flee' || offer === 'join', `an offer now (${offer})`);
  assert.equal(guardChoice(game, s, g.id, 'talk'), null, 'the talks heard');
  assert.equal(guardChoice(game, s, g.id, 'flee'), null, 'and they let her pass');
});

// ------------------------------------------------------------------------------------------------ 68. the yards

test('forum 68: «Верфи» — only the yards she has found; none under the fog; a village\'s once its island is charted', () => {
  const bits = new Uint8Array(Math.ceil((FOG_SIDE * FOG_SIDE) / 8));
  const c = fogCell(500, 500);
  bits[c >> 3] |= 1 << (c & 7);
  const ports = [
    { id: 'gravesend', x: 500, y: 500, shipyardTier: 4 },
    { id: 'hollowmere', x: 50_000, y: 50_000, shipyardTier: 3 }, // a key port's big yard under the fog: was drawn dimly
    { id: 'bc_v2', x: 500, y: 500, shipyardTier: 1 },
    { id: 'saltmarrow', x: 500, y: 500, shipyardTier: 0 },
  ];
  assert.deepEqual(chartYards(ports, new Set(), bits).map((p) => p.id), ['gravesend']);
  assert.deepEqual(chartYards(ports, new Set(['bc_v2']), bits).map((p) => p.id), ['gravesend', 'bc_v2']);
  assert.equal(portKnown(ports[1], new Set(), bits), false);
  const wm = readFileSync(new URL('../client/src/ui/worldmap.ts', import.meta.url), 'utf8');
  assert.ok(!/yard\.fog/.test(wm), 'the dim «not found yet» label is gone');
  assert.ok(!('yard.fog' in WM_RU), 'and its words');
});

test('forum 68: a sea\'s chart bought in port inks its yards in (out of the fog too), at twice the old price', () => {
  const { game } = makeGame();
  const c = join(game, 'Chart Buyer');
  const s = [...game.sessions][0];
  const p = s.profile!;
  game.pushPort(s);
  const offers = c.last('port')!.view!.charts.offers;
  const port = game.world.ports.find((x) => x.id === s.ship!.docked)!;
  // a sea with a yard she has not found
  const offer = offers.find((o) => game.world.ports.some((y) => y.region === o.region && y.shipyardTier > 0 && !y.raft && !s.discovered.has(y.islandId)))!;
  assert.ok(offer, JSON.stringify(offers));
  const yards = game.world.ports.filter((y) => y.region === offer.region && y.shipyardTier > 0 && !y.raft && !s.discovered.has(y.islandId) && !game.world.islands[y.islandId].hidden);
  assert.ok(yards.length > 0);
  p.gold = 1_000_000;
  const n0 = s.discovered.size;
  c.push({ t: 'chart', action: 'buy', region: offer.region });
  assert.equal(p.gold, 1_000_000 - offer.price);
  assert.equal(s.discovered.size, n0 + offer.islands);
  const fog = fogState(game, s);
  for (const y of yards) {
    assert.ok(s.discovered.has(y.islandId), `${y.id}: its island charted`);
    assert.ok(fogSeen(fog.bits, y.x, y.y), `${y.id}: its quay out of the fog`);
  }
  assert.equal(CHART_PRICE_MUL, 2);
  // the price: twice the old reckoning (the sea's fifteen nearest; its yards come with them, not priced)
  const isl = [game.world.islands[yards[0].islandId]];
  const old = Math.round(isl.reduce((a, is) => a + islandChartValue(is, port), 0) * 0.8 + 40);
  assert.equal(chartPrice(isl, port), 2 * old);
  assert.ok(offer.price < 2400, `twice the old bound of a newcomer's chart (${offer.price})`);
});

test('forum 68: the guide says only found yards are shown — no «dimly» any more', () => {
  setLang('ru');
  const text = JSON.stringify(GUIDE);
  assert.ok(!/тускло/.test(text) && !/show dimly/.test(text), 'the old line gone');
  assert.match(text, /Видны только найденные верфи/);
  assert.match(text, /«Найти»/);
});
