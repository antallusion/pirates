// docs/29 (owner, 2026-10-11): the island's tech tree on the screen — a building's card as the mobile city-builders draw
// it (its level i/5 in pips, what the next level gives, its cost and its time, what it asks with ✓ and ✗, «Улучшить»),
// and the move's confirm (what it pulls down, what goes along, silver or doubloons).

import { TOWN } from '../../../shared/src/data/town.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import { GROWTH, KEEP_GROWTH, MARKET_BUY, MARKET_SELL, TIER_UNIT } from '../../../shared/src/data/town.ts';
import { BUILDINGS, islandSize } from '../../../shared/src/data/holdings.ts';
import type { BuildingId, IslandSize } from '../../../shared/src/data/holdings.ts';
import { DWELL_GROWTH, DWELL_UP_LEVEL, HALL_DAY, ISLE_OF_HALL, SHIPYARD_REPAIR, TREE_MAX, isTreeTown } from '../../../shared/src/data/isletree.ts';
import { ISLE_LEVELS } from '../../../shared/src/data/estate.ts';
import { caravanExtra, chartCopy, coveHide, dockDiscount, forgeReach, levelMul, residentRooms, signalMins, signalRisk, smugglerRoom, trophyCap, workshopYield } from '../../../shared/src/data/baselevels.ts';
import { PRODUCERS, crewsAt, plotsOf, producerOf, producerRate, yardCap } from '../../../shared/src/data/base.ts';
import { DEF_BATTERY, DEF_FORT } from '../../../shared/src/data/baseclaim.ts';
import { YARD_SHIP_LEVEL } from '../../../shared/src/data/baseships.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { IslandBiome } from '../../../shared/src/world/regions.ts';
import type { ClientMsg, IsleMoveView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/isles29.ts';
import { askHtml } from './confirm.ts';
import { dec1, esc, fmt } from './dom.ts';
import { placeName } from './maps.ts';
import { unitName } from './army.ts';

export const T29 = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);

/** A building of the island by name: the town's by its level's name, the base's (the data overlay has its Russian). */
export function treeLabel(id: string, level = 1): string {
  if (isTreeTown(id) || id === 'pen' || id === 'grail') {
    const n = TOWN[id as TownId].names;
    return n[Math.max(0, Math.min(n.length, Math.max(1, level)) - 1)][ru()];
  }
  const k = producerOf(id);
  if (k) return PRODUCERS[k].name[ru()];
  return BUILDINGS[id as BuildingId]?.name ?? id;
}

/** Five pips: the levels it stands at, filled. */
export function pips(level: number, max = TREE_MAX): string {
  return `<span class="tr-pips" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>`;
}

/** What the tree asks of the next level, each ✓ when it stands, ✗ when not. */
export function needsHtml(needs: { id: string; level: number; have: number }[] | undefined): string {
  if (!needs?.length) return `<p class="muted tr-none">${esc(T29('asksNone'))}</p>`;
  return `<div class="tr-asks"><span class="muted">${esc(T29('asks'))}</span><ul class="tr-needs">${needs.map((n) => {
    const ok = n.have >= n.level;
    return `<li class="${ok ? 'ok' : 'no'}"><b aria-hidden="true">${ok ? '✓' : '✗'}</b> ${esc(n.id === 'hall' ? TOWN.hall.names[0][ru()] : treeLabel(n.id, n.level))} ${n.level}${ok ? '' : ` <span class="muted">(${n.have})</span>`}</li>`;
  }).join('')}</ul></div>`;
}

export interface GiveCtx {
  /** The island's size and ground; its level now and its warehouse's. */
  size: IslandSize;
  biome: IslandBiome;
  isle: number;
}

/** What a level of a building gives (the card's «Следующий уровень»). */
export function givesText(id: string, level: number, c: GiveCtx): string {
  const L = Math.max(1, Math.min(TREE_MAX, level));
  const k = producerOf(id);
  if (k) return T29('gProducer', { rate: dec1(producerRate(k, L, c.biome)).replace(/[.,]0$/, ''), good: GOODS[PRODUCERS[k].good].name.toLowerCase() });
  switch (id) {
    case 'hall': {
      const isle = ISLE_OF_HALL[L];
      return T29('gHall', { silver: HALL_DAY[L], isle, plots: plotsOf(isle, c.size), outposts: ISLE_LEVELS[isle].outposts, crews: crewsAt(isle) });
    }
    case 'keep': return T29('gKeep', { g: dec1(KEEP_GROWTH[L]).replace(/[.,]0$/, '') });
    case 'market': return T29('gMarket', { s: Math.round(MARKET_SELL[L] * 1000) / 10, b: dec1(MARKET_BUY[L]) });
    case 'guild': return T29('gGuild', { n: L, k: [3, 3, 2, 1, 1][L - 1] });
    case 'warehouse': return T29('gWarehouse', { n: fmt(yardCap(Math.max(c.isle, 1), L)) });
    case 'shipyard': return T29('gShipyard', { lv: YARD_SHIP_LEVEL[L], p: Math.round(SHIPYARD_REPAIR[L] * 100) });
    case 'battery': return T29('gBattery', { n: DEF_BATTERY * L });
    case 'fort': return T29('gFort', { n: DEF_FORT * L });
    case 'pen': return T29('gPen', { n: L >= 2 ? 3 : 1 });
    case 'grail': return T29('gGrail');
  }
  // docs/29 (2026-10-15): the base's single-level buildings by their own level (shared/src/data/baselevels.ts)
  const m = levelMul(L);
  const x = (n: number) => dec1(n).replace(/[.,]0$/, '');
  const pc = (n: number) => Math.round(n * 100);
  switch (id) {
    case 'pier': return T29('gPier', { p: x(5 * m) });
    case 'chapel': return T29('gChapel', { n: Math.round(30 * m) });
    case 'lighthouse': return T29('gLight', { p: Math.round(50 * m), t: fmt(Math.round(3000 * m)) });
    case 'tavern': return T29('gTavern', { n: Math.round(10 * m), m: x(m), h: 20 + 5 * (L - 1) });
    case 'barracks': return T29('gBarracks', { n: Math.round(60 * m) });
    case 'signal_tower': return T29('gSignal', { n: signalMins(L), p: pc(1 - signalRisk(L)) });
    case 'caravan_office': return T29('gCaravan', { n: caravanExtra(L) });
    case 'residents_house': return T29('gHouse', { n: residentRooms(L) });
    case 'dry_dock': return T29('gDock', { p: pc(dockDiscount(L)) });
    case 'chart_house': return T29('gChart', { n: fmt(chartCopy(L)) });
    case 'forge': return T29('gForge', { n: forgeReach(L) });
    case 'trophy_hall': return T29('gTrophy', { p: x(trophyCap(L) * 100) });
    case 'workshop': return T29('gWorkshop', { n: x(workshopYield(L)) });
    case 'smuggler_store': return T29('gSmuggler', { n: smugglerRoom(L) });
    case 'hidden_cove': return T29('gCove', { p: pc(coveHide(L)) });
  }
  if (id in BUILDINGS) return T29('gMake', { m: x(m) });
  const tier = TOWN[id as TownId]?.tier;
  if (tier) {
    const plain = TIER_UNIT[tier];
    const up = L >= DWELL_UP_LEVEL ? UNITS[plain].upgrade ?? plain : plain;
    const n = dec1(GROWTH[tier] * DWELL_GROWTH[L]).replace(/[.,]0$/, '');
    return L >= DWELL_UP_LEVEL ? T29('gDwellUp', { unit: unitName(up), n }) : T29('gDwell', { unit: unitName(plain), n });
  }
  return '';
}

export { islandSize };

// ------------------------------------------------------------------------------------------------ the move

/** The move's confirm (docs/29): what it pulls down, what goes along, and — after the free one — silver or doubloons. */
export function askMove(v: IsleMoveView, send: (m: ClientMsg) => void): void {
  const fresh = v.from < 0;
  const name = placeName(v.name);
  let pay: 'free' | 'silver' | 'doubloons' = v.free ? 'free' : v.gold >= v.silver ? 'silver' : 'doubloons';
  const choice = v.free ? '' : `<fieldset class="mv-pay"><legend>${esc(T29('payWith'))}</legend>
    <label class="${v.gold < v.silver ? 'lack' : ''}"><input type="radio" name="mvpay" value="silver"${pay === 'silver' ? ' checked' : ''}${v.gold < v.silver ? ' disabled' : ''}> ${esc(T29('paySilver', { n: fmt(v.silver), have: fmt(v.gold) }))}</label>
    <label class="${v.balance < v.doubloons ? 'lack' : ''}"><input type="radio" name="mvpay" value="doubloons"${pay === 'doubloons' ? ' checked' : ''}${v.balance < v.doubloons ? ' disabled' : ''}> ${esc(T29('payDoubloons', { n: fmt(v.doubloons), have: fmt(v.balance) }))}</label></fieldset>`;
  const body = fresh
    ? `<p id="confirm-text">${esc(T29('claimPaid', { name, silver: fmt(v.silver), d: fmt(v.doubloons) }))}</p>${choice}`
    : `<p id="confirm-text"><b>${esc(T29('moveTitle', { name }))}</b></p>
      <p class="mv-lose">${esc(T29('moveLose', { from: placeName(v.fromName), b: v.lose.buildings, l: v.lose.levels, h: v.lose.hall, p: v.lose.producers }))}</p>
      <p class="muted">${esc(T29('moveKeep', { t: fmt(v.keep.treasury), g: fmt(v.keep.goods), r: v.keep.residents, s: v.keep.ships }))}</p>
      <p class="${v.free ? 'good' : 'bad'}">${esc(v.free ? T29('moveFree', { silver: fmt(v.silver), d: fmt(v.doubloons) }) : T29('movePaid', { n: v.moves, silver: fmt(v.silver), d: fmt(v.doubloons) }))}</p>${choice}`;
  const yes = fresh ? T29('claimGo') : v.free ? T29('moveFreeGo') : T29('moveGo');
  const can = v.free || v.gold >= v.silver || v.balance >= v.doubloons;
  void askHtml(body, yes, undefined, 'mv-panel').then((ok) => {
    if (ok && can) send({ t: 'estate', action: 'buy', island: v.island, move: pay });
  });
  // The pay choice is read as it changes (the sheet's markup is in the page once asked).
  for (const el of document.querySelectorAll<HTMLInputElement>('.mv-panel input[name="mvpay"]')) el.onchange = () => (pay = el.value as 'silver' | 'doubloons');
}
