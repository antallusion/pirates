// The island's town of the Heroes (docs/17 H3 item 13): the third tab of "My Island", laid out as HoMM3's town hall
// screen — each building of the town a card with its isometric picture (the frame of beams before it stands, the
// weathered stage while the builders are at it), its level, a dwelling's men and growth, the next level's cost and
// what stands in its way; over them the treasury and its daily silver, the keep's growth, the week, and "Recruit";
// under them the captain's mines and the market's poor rates.

import { GOODS } from '../../../shared/src/data/goods.ts';
import { ORDERS } from '../../../shared/src/data/hero.ts';
import type { OrderId } from '../../../shared/src/data/hero.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { MINES } from '../../../shared/src/data/mines.ts';
import { MARKET_GOODS, TOWN } from '../../../shared/src/data/town.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import { WEEKS } from '../../../shared/src/data/week.ts';
import type { TownThingView } from '../../../shared/src/h3proto.ts';
import type { BaseView, ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h3.ts';
import { EN as B_EN, RU as B_RU } from '../lang/ui/base.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { dec1, esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';
import { costLine, townName } from './recruit.ts';
import { unitIcon, unitName } from './army.ts';
import { EN as LP_EN, RU as LP_RU } from '../lang/ui/lairs.ts';
import { EN as V_EN, RU as V_RU } from '../lang/ui/heroes18v.ts';
import { LAND_RES, LAND_RES_DEF } from '../../../shared/src/data/bestiary.ts';
import type { LandRes } from '../../../shared/src/data/bestiary.ts';
import { ARTIFACTS, ART_CLASS_NAMES, ART_RARITY, FORGE_LINES, forgeSpan, primSum } from '../../../shared/src/data/artifacts.ts';
import type { ArtForge } from '../../../shared/src/data/artifacts.ts';
import { PRIMS, PRIM_NAMES } from '../../../shared/src/data/hero.ts';
import { RARITY_COLOR, SLOT_NAMES } from '../../../shared/src/data/items.ts';
import { EN as REL_EN, RU as REL_RU } from '../lang/ui/relics.ts';
import { forgeLineText } from './gear.ts';
import { FITTINGS } from '../../../shared/src/data/landecon.ts';
import type { FittingId, LandCost } from '../../../shared/src/data/landecon.ts';
import type { LandTownView } from '../../../shared/src/h3proto.ts';

const L = dict(EN, RU);
const B = dict(B_EN, B_RU);
const LP = dict(LP_EN, LP_RU);
const V = dict(V_EN, V_RU);
const RL = dict(REL_EN, REL_RU);

/** docs/19 E13: the anvil's piece in hand, and the work she has asked to strike (the confirm step). */
let forgeSel: number | null = null;
let forgeAsk: 'prim' | 'line' | null = null;

/** An artifact's primaries as words («Атака +2 · Воля +1»). */
function primWords(p: Partial<Record<'atk' | 'def' | 'pow' | 'will', number>>): string {
  return PRIMS.filter((k) => p[k]).map((k) => `${PRIM_NAMES[k][ru()]} +${p[k]}`).join(' · ') || '—';
}

/** The work on a piece as words: its primaries and its forged line. */
function workWords(art: string, f: ArtForge | undefined): string {
  const p = f?.p ?? ARTIFACTS[art].prim ?? {};
  return `${primWords(p)}${f?.k ? ` · ${forgeLineText(f)}` : ''}`;
}

/** docs/19 E13: the anvil — her artifacts as chips, the one in hand: its work, the odds, the cost, the strike (asked
 *  once more before it is paid), and after the strike the old work and the new side by side to choose from. */
function forgeBlock(l: LandTownView, gold: number): string {
  const list = l.forge ?? [];
  if (!list.length) return `<div class="card tw-land tw-forge"><h4 class="card-h">${icon('build_forge', '', 'ico-md')}${esc(RL('forge.title'))}</h4><p class="muted">${esc(RL('forge.none'))}</p></div>`;
  const cur = list.find((x) => x.uid === forgeSel) ?? list.find((x) => x.was) ?? list[0];
  forgeSel = cur.uid;
  const chips = list.map((x) => {
    const a = ARTIFACTS[x.art];
    return `<button class="tw-fg-it${x.uid === cur.uid ? ' on' : ''}${x.was ? ' wait' : ''}" data-fgsel="${x.uid}" title="${esc(`${a.name[ru()]} · ${x.worn ? RL('forge.worn') : RL('forge.locker')}`)}" style="border-color:${RARITY_COLOR[ART_RARITY[a.cls]]}">${icon(a.icon, '◆', 'ico-md')}${x.worn ? '<i class="tw-fg-w">◆</i>' : ''}</button>`;
  }).join('');
  const a = ARTIFACTS[cur.art];
  const head = `<div class="tw-fg-head">${icon(a.icon, '◆', 'ico-lg')}<div class="tw-craft-t"><b style="color:${RARITY_COLOR[ART_RARITY[a.cls]]}">${esc(a.name[ru()])}</b><span class="muted">${esc(ART_CLASS_NAMES[a.cls][ru()])} · ${esc(SLOT_NAMES[a.slot][ru()])} · ${esc(cur.worn ? RL('forge.worn') : RL('forge.locker'))}${cur.forge?.n ? ` · ${esc(RL('forge.times', { n: cur.forge.n }))}` : ''}</span></div></div>`;
  let body: string;
  if (cur.was) {
    // The strike is done: the old work and the new, side by side.
    body = `<p class="tw-fg-q">${esc(RL('forge.choose'))}</p><div class="tw-fg-cmp"><div class="tw-fg-was"><span class="muted">${esc(RL('forge.old'))}</span><b>${esc(workWords(cur.art, cur.was.p || cur.was.k ? cur.was : undefined))}</b></div>
      <div class="tw-fg-now"><span class="muted">${esc(RL('forge.new'))}</span><b>${esc(workWords(cur.art, cur.forge))}</b></div></div>
      <div class="tw-fg-acts"><button class="btn btn-small btn-primary" data-fgkeep="new">${esc(RL('forge.keepNew'))}</button><button class="btn btn-small" data-fgkeep="old">${esc(RL('forge.keepOld'))}</button></div>`;
  } else {
    const c = cur.cost;
    const pct = (v: number) => `${String(Math.round(v * 1000) / 10).replace('.', ru() ? ',' : '.')}%`;
    const odds = FORGE_LINES.map((k) => {
      const [lo, hi] = forgeSpan(cur.art, k);
      return RL(`fl.${k}`, { v: `${pct(lo)}–${pct(hi)}` });
    }).join(', ');
    const n = primSum(cur.forge?.p ?? a.prim);
    const cost = `<span class="bcosts"><span class="bcost${gold < c.silver ? ' lack' : ''}">${money(c.silver)}</span><span class="bcost">${icon('good_pearls', '', 'ico-sm')}${fmt(c.pearls)}</span>${landLine(c.land, l.res)}</span>`;
    const why = cur.why.line ?? cur.why.prim;
    const lineBtn = cur.forge?.k ? RL('forge.lineRe') : RL('forge.lineNew');
    const acts = forgeAsk
      ? `<div class="tw-fg-acts tw-fg-ask"><span>${esc(RL('forge.ask'))} <b>${esc(forgeAsk === 'prim' ? RL('forge.prim') : lineBtn)}</b></span><button class="btn btn-small btn-primary" data-fgyes>${esc(RL('forge.yes'))}</button><button class="btn btn-small" data-fgno>${esc(RL('forge.no'))}</button></div>`
      : `<div class="tw-fg-acts"><button class="btn btn-small btn-primary" data-fgdo="prim"${cur.why.prim ? ' disabled' : ''}>${esc(RL('forge.prim'))}</button><button class="btn btn-small btn-primary" data-fgdo="line"${cur.why.line ? ' disabled' : ''}>${esc(lineBtn)}</button></div>`;
    body = `<div class="tw-fg-now"><span class="muted">${esc(RL('forge.prims'))}</span><b>${esc(primWords(cur.forge?.p ?? a.prim ?? {}))}</b></div>
      <div class="tw-fg-now"><span class="muted">${esc(RL('forge.line'))}</span><b>${esc(cur.forge?.k ? forgeLineText(cur.forge) : RL('forge.noLine'))}</b></div>
      <p class="muted tw-fg-odds">${esc(RL('forge.oddsPrim', { n }))} ${esc(RL('forge.oddsLine', { list: odds }))}</p>
      <div class="tw-fg-cost"><span class="muted">${esc(RL('forge.cost', { h: dec1(c.hours).replace(/[.,]0$/, '') }))}</span>${cost}</div>
      ${why ? `<p class="muted tw-why">${esc(serverText(why))}</p>` : ''}${acts}`;
  }
  return `<div class="card tw-land tw-forge"><h4 class="card-h">${icon('build_forge', '', 'ico-md')}${esc(RL('forge.title'))}</h4><p class="muted">${esc(RL('forge.sub'))}</p>
    <div class="tw-fg-list">${chips}</div><div class="tw-fg-pane">${head}${body}</div></div>`;
}

/** docs/18 #43: a cost of the land's resources, each piece short marked. */
function landLine(c: LandCost | undefined, have: Partial<Record<LandRes, number>> | undefined): string {
  return (Object.entries(c ?? {}) as [LandRes, number][]).filter(([, n]) => n > 0).map(([r, n]) => `<span class="bcost${(have?.[r] ?? 0) < n ? ' lack' : ''}" title="${esc(LAND_RES_DEF[r].name[ru()])}">${icon(LAND_RES_DEF[r].icon, '', 'ico-sm')}${fmt(n)}</span>`).join('');
}

/** docs/18 #43: the land's resources — the store and the market's price, the workshop, the ship's fittings. */
function landBlock(l: LandTownView, gold: number, have: Partial<Record<GoodId, number>>): string {
  const store = LAND_RES.map((r) => `<span class="tw-lres"><span class="bcost" title="${esc(LAND_RES_DEF[r].name[ru()])}">${icon(LAND_RES_DEF[r].icon, '', 'ico-sm')}${fmt(l.res[r])}<span class="muted">/${l.cap}</span></span>
      ${l.sell ? `<button class="btn btn-small" data-lsell="${r}"${l.res[r] > 0 ? '' : ' disabled'} title="${esc(V('land.sellTip', { p: dec1(l.sell[r]) }))}">${esc(V('land.sell'))} · ${money(Math.floor(Math.min(10, l.res[r]) * l.sell[r]))}</button>` : ''}</span>`).join('');
  const crafts = l.crafts.map((c, i) => {
    const a = ARTIFACTS[c.art];
    return `<div class="tw-craft">${icon(a.icon, '', 'ico-md')}<div class="tw-craft-t"><b>${esc(a.name[ru()])}</b><span class="muted">${esc(a.text[ru()])}</span>
        <span class="bcosts">${costLine({ silver: c.silver, goods: c.goods }, gold, have)}${landLine(c.land, l.res)}</span>${c.why ? `<span class="muted tw-why">${esc(serverText(c.why))}</span>` : ''}</div>
        <button class="btn btn-small btn-primary" data-lcraft="${i}"${c.why ? ' disabled' : ''}>${esc(V('craft.make'))}</button></div>`;
  }).join('');
  const fits = l.fits.map((f) => {
    const d = FITTINGS[f.id];
    return `<div class="tw-craft">${icon(d.icon, '', 'ico-md')}<div class="tw-craft-t"><b>${esc(d.name[ru()])} <span class="muted">${esc(V('fit.rank', { n: f.rank, max: f.max }))}</span></b><span class="muted">${esc(d.text[ru()])}</span>
        ${f.next ? `<span class="bcosts"><span class="bcost${gold < f.next.silver ? ' lack' : ''}">${money(f.next.silver)}</span>${landLine(f.next.land, l.res)}</span>` : ''}${f.why && f.next ? `<span class="muted tw-why">${esc(serverText(f.why))}</span>` : ''}</div>
        ${f.next ? `<button class="btn btn-small btn-primary" data-lfit="${f.id}"${f.why ? ' disabled' : ''}>${esc(V('fit.buy', { n: f.rank + 1 }))}</button>` : `<span class="muted">${esc(V('fit.max'))}</span>`}</div>`;
  }).join('');
  return `<div class="card tw-land"><h4 class="card-h">${icon('tattoo_turtle', '', 'ico-md')}${esc(V('land.title'))}</h4><p class="muted">${esc(V('land.sub', { cap: l.cap }))} ${esc(V('land.uses'))}</p>
      <div class="tw-lstore">${store}</div>${l.sell ? '' : `<p class="muted">${esc(V('land.noMarket'))}</p>`}</div>
    <div class="card tw-land"><h4 class="card-h">${icon('build_forge', '', 'ico-md')}${esc(V('craft.title'))}</h4><p class="muted">${esc(V('craft.sub'))}</p>${crafts}</div>
    ${l.forge ? forgeBlock(l, gold) : ''}
    <div class="card tw-land"><h4 class="card-h">${icon('build_shipyard', '', 'ico-md')}${esc(V('fit.title'))}</h4><p class="muted">${esc(V('fit.sub'))}</p>${fits}</div>`;
}
const ru = () => (lang() === 'ru' ? 1 : 0);

/** A timer's words, as the island's window writes them (its own copy: the base window reads the screen's shape). */
function timeText(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  if (s < 60) return B('t_s', { s });
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const m = Math.floor(s / 60);
  return B('t_hm', { h: Math.floor(m / 60), m: String(m % 60).padStart(2, '0') });
}

function art(id: TownId, level: number, working: boolean): string {
  const a = `build_${TOWN[id].art}`;
  const stage = level <= 0 ? 1 : working ? 2 : 0;
  return (stage ? assetUrl(`icon.${a}_${stage}`) : null) ?? assetUrl(`icon.${a}`) ?? '';
}

function card(v: BaseView, t: TownThingView, gold: number, have: Partial<Record<GoodId, number>>, land?: Partial<Record<LandRes, number>>): string {
  const now = v.now;
  const d = TOWN[t.id];
  const name = townName(t.id, Math.max(1, t.level));
  const pic = art(t.id, t.level, !!t.job);
  const lvl = t.level > 0 ? L('town.lvl', { n: t.level, max: t.max }) : L('town.not');
  const pool = d.tier && t.level > 0 ? `<p class="tw-pool">${esc(L('town.pool', { n: t.pool ?? 0, g: dec1(t.growth ?? 0).replace(/[.,]0$/, '') }))}</p>` : '';
  // The guild of orders (docs/17 H5): each floor's orders as chips, learnt free while she lies off the island; why
  // she may not learn there said once, an order beyond her level on its own chip.
  const extra = t.orders?.length ? guildBlock(t.orders) : t.pen ? penBlock(t.pen) : '';
  const j = t.job;
  const job = j ? `<div class="tw-job"><span class="muted">${esc(L('town.building'))}</span> <span class="btime" data-end="${j.end}">${esc(timeText((j.end - now) / 1000))}</span>
      <span class="bprog"><i data-start="${j.start}" data-stop="${j.end}" style="width:0%"></i></span>
      <div class="bspeed"><button class="btn btn-small btn-primary" data-bspeed="silver" data-job="${j.id}">${esc(B('finish'))} <span data-price="${j.end}">${money(j.silver)}</span></button>
      <button class="btn btn-small" data-bspeed="token" data-job="${j.id}"${v.speedups ? '' : ' disabled'}>⌛ ${esc(B('token', { m: v.tokenSecs / 60 }))} (${v.speedups})</button></div></div>` : '';
  const n = t.next;
  const next = !j && n ? `<div class="tw-next"><b class="tw-nn">${esc(t.level > 0 ? `${L('town.up')}: ${townName(t.id, n.level)}` : townName(t.id, 1))}</b>${costLine({ silver: n.silver, goods: n.goods }, gold, have)}${landLine(n.land, land)}<span class="bcost btimec">⏱ ${esc(timeText(n.secs))}</span>
      ${n.why ? `<p class="muted tw-why">${esc(serverText(n.why))}</p>` : ''}<button class="btn btn-small${t.level ? '' : ' btn-primary'}" data-tbuild="${t.id}"${n.why ? ' disabled' : ''}>${esc(t.level > 0 ? L('town.up') : L('town.build'))}</button></div>`
    : !j ? `<p class="muted tw-max">${esc(L('town.max'))}</p>` : '';
  return `<div class="tw-card${t.level > 0 ? ' built' : ''}${d.tier ? ' dw' : ''}" data-town="${t.id}" data-hint="${esc(`${name}: ${d.text[ru()]}`)}"><div class="tw-top">${pic ? `<img class="tw-art" src="${pic}" alt="" draggable="false">` : ''}<div class="tw-id"><b>${esc(name)}</b><span class="muted">${esc(lvl)}</span></div></div>
    <p class="muted tw-text">${esc(d.text[ru()])}</p>${pool}${extra}${job}${next}</div>`;
}

/** docs/18 #20: the pen — its nests (an egg hatching, a young one growing, a grown kind breeding), and the eggs and
 *  the young she carries, each to lay in while she lies off the island. */
function penBlock(p: NonNullable<TownThingView['pen']>): string {
  const nests = p.nests.length
    ? p.nests.map((n) => `<div class="tw-nest ${n.stage}">${unitIcon(n.k, 'ico-md')}<span><b>${esc(unitName(n.k))}</b><br><span class="muted">${esc(LP(n.stage === 'egg' ? 'pen.egg' : n.stage === 'young' ? 'pen.young' : 'pen.grown', { n: n.stage === 'grown' ? n.pool : n.left }))}</span></span></div>`).join('')
    : `<p class="muted">${esc(LP('pen.none'))}</p>`;
  const full = p.nests.length >= p.max;
  const eggs = p.eggs.length
    ? `<div class="tw-eggs"><span class="muted">${esc(LP('pen.carried'))}:</span> ${p.eggs.map((k, i) => `<button class="tw-egg" data-pnest="${i}"${full ? ' disabled' : ''} title="${esc(unitName(k))}">${unitIcon(k, 'ico-sm')}${esc(LP('pen.lay'))}</button>`).join('')}${full ? `<p class="muted tw-why">${esc(LP('pen.full', { n: p.max }))}</p>` : ''}</div>`
    : '';
  return `<div class="tw-pen">${nests}${eggs}</div>`;
}

function guildBlock(orders: NonNullable<TownThingView['orders']>): string {
  const away = orders.find((o) => !o.known && o.why && !/^Orders of level/.test(o.why))?.why;
  const floors = [...new Set(orders.map((o) => o.floor))].sort((a, b) => a - b);
  const chip = (o: (typeof orders)[number]) => {
    const name = ORDERS[o.id].name[ru()];
    const tip = `${name}: ${ORDERS[o.id].text[ru()]}${o.why && !o.known ? ` (${serverText(o.why)})` : ''}`;
    if (o.known) return `<span class="tw-ord known" title="${esc(tip)}">${icon(ORDERS[o.id].icon, '', 'ico-sm')}${esc(name)} ✓</span>`;
    return `<button class="tw-ord" data-tlearn="${o.id}" title="${esc(tip)}"${o.why ? ' disabled' : ''}>${icon(ORDERS[o.id].icon, '', 'ico-sm')}${esc(name)}</button>`;
  };
  return `<div class="tw-orders">${away ? `<p class="muted tw-why">${esc(serverText(away))}</p>` : `<p class="muted tw-why">${esc(L('guild.free'))}</p>`}${floors.map((f) => `<div class="tw-floor"><span class="muted tw-fl">${esc(L('guild.floor', { n: f }))}</span>${orders.filter((o) => o.floor === f).map(chip).join('')}</div>`).join('')}</div>`;
}

export function townTab(v: BaseView, state: ClientState, mk: { give: string; get: string; n: number }): string {
  const t = v.town!;
  const gold = state.self?.gold ?? 0;
  const have: Partial<Record<GoodId, number>> = Object.fromEntries(t.res.map((r) => [r.good, r.n]));
  const w = t.week;
  const week = `<span class="bmeta tw-week" title="${esc(WEEKS[w.kind].text[ru()])}">${esc(L('week', { n: w.n, d: w.day }))} · <b>${esc(WEEKS[w.kind].name[ru()])}</b></span>`;
  const res = t.res.map((r) => `<span class="bcost" title="${esc(GOODS[r.good].name)}">${icon(`good_${r.good}`, '', 'ico-sm')}${fmt(r.n)}</span>`).join('');
  const dwellings = t.things.filter((x) => (TOWN[x.id].tier && x.level > 0) || x.pen?.nests.some((n) => n.stage === 'grown'));
  const head = `<div class="tw-head"><p class="muted">${esc(L('town.head'))}</p><div class="tw-meta">${week}
      <span class="bmeta" title="${esc(L('town.hall', { n: t.hall }))}">${icon('coin', '', 'ico-sm')}${esc(L('town.treasury', { n: fmt(t.treasury) }))}${t.hall ? ` <span class="good">${esc(L('town.hall', { n: fmt(t.hall) }))}</span>` : ''}</span>
      <span class="bmeta">${icon('build_fort', '', 'ico-sm')}${esc(L('town.growth', { n: dec1(t.growthMul).replace(/[.,]0$/, '') }))}</span>
      <button class="btn btn-small btn-primary" data-trecruit${dwellings.length ? '' : ' disabled'} title="${esc(t.near ? L('town.recruit') : L('town.far'))}">${icon('prof_marine', '', 'ico-sm')}${esc(L('town.recruit'))}</button></div>
      <div class="tw-res"><span class="muted">${esc(L('town.res'))}:</span> ${res}</div></div>`;
  // The Grail's card once it is dug up (docs/17 H4).
  const cards = t.things.filter((x) => x.id !== 'dw7' || t.deep || x.level > 0).filter((x) => x.id !== 'grail' || x.level > 0 || !!x.job || state.adv?.grail === 'held').map((x) => card(v, x, gold, have, t.land?.res)).join('');
  // The captain's mines and what they pay a day.
  const mines = t.mines.length
    ? t.mines.map((m) => `<div class="tw-mine">${icon(MINES[m.kind].art, '', 'ico-md')}<span><b>${esc(L('town.mine', { kind: MINES[m.kind].name[ru()], island: placeName(m.island) }))}</b><br><span class="muted">${esc(L('town.day', { n: dec1(m.daily).replace(/[.,]0$/, '') }))} ${m.kind === 'silver' ? icon('coin', '', 'ico-sm') : icon(`good_${m.kind}`, '', 'ico-sm')}</span></span></div>`).join('')
    : `<p class="muted">${esc(L('town.mines.none'))}</p>`;
  const mk2 = t.market;
  const opt = (sel: string) => ['silver', ...MARKET_GOODS].map((g) => `<option value="${g}"${g === sel ? ' selected' : ''}>${esc(g === 'silver' ? L('market.silver') : GOODS[g as GoodId].name)}</option>`).join('');
  const market = mk2
    ? `<div class="tw-mk"><label>${esc(L('market.give'))} <select class="field" data-mkgive>${opt(mk.give)}</select></label><input class="field" type="number" min="1" value="${mk.n}" data-mkn aria-label="${esc(L('market.give'))}">
        <label>${esc(L('market.get'))} <select class="field" data-mkget>${opt(mk.get)}</select></label></div>
        <p class="tw-mkout" data-mkout>${esc(L('market.out', { n: fmt(marketOut(mk2, mk)) }))}</p>
        <p class="muted tw-rates">${esc(rateLine(mk2, mk))}</p>
        <button class="btn btn-small btn-primary" data-mkgo>${esc(L('market.btn'))}</button>`
    : `<p class="muted">${esc(L('market.none'))}</p>`;
  return `<div class="town">${head}<div class="tw-grid">${cards}</div>
    <div class="tw-cols"><div class="card"><h4 class="card-h">${icon('outpost_mine', '', 'ico-md')}${esc(L('town.mines'))}</h4>${mines}</div>
    <div class="card"><h4 class="card-h">${icon('build_caravan_office', '', 'ico-md')}${esc(L('market.title'))}</h4>${market}</div></div>
    ${t.land ? `<div class="tw-cols tw-lands">${landBlock(t.land, gold, have)}</div>` : ''}</div>`;
}

type Market = NonNullable<NonNullable<BaseView['town']>['market']>;

/** What the market gives for the order (the same sums as the server's). */
function marketOut(m: Market, mk: { give: string; get: string; n: number }): number {
  const n = Math.max(0, Math.floor(mk.n));
  if (mk.give === mk.get) return 0;
  if (mk.give === 'silver') return Math.floor(n / (m.buy[mk.get as GoodId] ?? Infinity));
  const value = n * (m.sell[mk.give as GoodId] ?? 0);
  return mk.get === 'silver' ? Math.floor(value) : Math.floor(value / (m.buy[mk.get as GoodId] ?? Infinity));
}

function rateLine(m: Market, mk: { give: string; get: string }): string {
  const g = (mk.give !== 'silver' ? mk.give : mk.get) as GoodId;
  if (!GOODS[g]) return '';
  return `${GOODS[g].name}: ${L('market.rates', { s: dec1(m.sell[g] ?? 0), b: dec1(m.buy[g] ?? 0) })}`;
}

export function bindTown(root: HTMLElement, send: (m: ClientMsg) => void, mk: { give: string; get: string; n: number }, recruit: () => void, redraw: () => void): void {
  root.querySelectorAll<HTMLElement>('[data-tbuild]').forEach((el) => (el.onclick = () => send({ t: 'h3', action: 'build', id: el.dataset.tbuild as TownId })));
  root.querySelectorAll<HTMLElement>('[data-tlearn]').forEach((el) => (el.onclick = () => send({ t: 'h3', action: 'learn', id: el.dataset.tlearn as OrderId })));
  root.querySelector<HTMLElement>('[data-trecruit]')?.addEventListener('click', () => recruit());
  root.querySelectorAll<HTMLElement>('[data-lcraft]').forEach((el) => (el.onclick = () => send({ t: 'h3', action: 'craft', i: Number(el.dataset.lcraft) })));
  root.querySelectorAll<HTMLElement>('[data-lfit]').forEach((el) => (el.onclick = () => send({ t: 'h3', action: 'fit', id: el.dataset.lfit as FittingId })));
  root.querySelectorAll<HTMLElement>('[data-lsell]').forEach((el) => (el.onclick = () => send({ t: 'h3', action: 'sellres', r: el.dataset.lsell as LandRes, n: 10 })));
  // docs/19 E13: the anvil — a piece taken in hand, a work asked, struck (paid) or let be, the new work kept or not.
  root.querySelectorAll<HTMLElement>('[data-fgsel]').forEach((el) => (el.onclick = () => {
    forgeSel = Number(el.dataset.fgsel);
    forgeAsk = null;
    redraw();
  }));
  root.querySelectorAll<HTMLElement>('[data-fgdo]').forEach((el) => (el.onclick = () => {
    forgeAsk = el.dataset.fgdo === 'prim' ? 'prim' : 'line';
    redraw();
  }));
  root.querySelector<HTMLElement>('[data-fgno]')?.addEventListener('click', () => {
    forgeAsk = null;
    redraw();
  });
  root.querySelector<HTMLElement>('[data-fgyes]')?.addEventListener('click', (e) => {
    (e.currentTarget as HTMLButtonElement).disabled = true;
    if (forgeSel !== null && forgeAsk) send({ t: 'h3', action: 'forge', uid: forgeSel, what: forgeAsk });
    forgeAsk = null;
  });
  root.querySelectorAll<HTMLButtonElement>('[data-fgkeep]').forEach((el) => (el.onclick = () => {
    el.disabled = true;
    if (forgeSel !== null) send({ t: 'h3', action: 'forgekeep', uid: forgeSel, keep: el.dataset.fgkeep === 'old' ? 'old' : 'new' });
  }));
  root.querySelectorAll<HTMLElement>('[data-pnest]').forEach((el) => (el.onclick = () => send({ t: 'lair', action: 'nest', egg: Number(el.dataset.pnest) })));
  const give = root.querySelector<HTMLSelectElement>('[data-mkgive]');
  const get = root.querySelector<HTMLSelectElement>('[data-mkget]');
  const n = root.querySelector<HTMLInputElement>('[data-mkn]');
  if (give) give.onchange = () => {
    mk.give = give.value;
    if (mk.give === mk.get) mk.get = mk.give === 'silver' ? 'timber' : 'silver';
    redraw();
  };
  if (get) get.onchange = () => {
    mk.get = get.value;
    if (mk.give === mk.get) mk.give = mk.get === 'silver' ? 'timber' : 'silver';
    redraw();
  };
  if (n) n.onchange = () => {
    mk.n = Math.max(1, Math.floor(Number(n.value) || 1));
    redraw();
  };
  root.querySelector<HTMLElement>('[data-mkgo]')?.addEventListener('click', () => send({ t: 'h3', action: 'market', give: mk.give as GoodId | 'silver', get: mk.get as GoodId | 'silver', n: mk.n }));
}

/** The week in the HUD's line under the clock (docs/17 H3 item 10): «Нед. 12·3 · Неделя морпеха», its effect on hover. */
export function weekChip(state: ClientState): string {
  const w = state.week;
  if (!w) return '';
  const left = Math.max(0, w.nextIn - (Date.now() - state.weekAt) / 1000);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
  const t = h > 0 ? B('t_hm', { h, m: String(m).padStart(2, '0') }) : B('t_m', { m: Math.max(1, m) });
  const d = WEEKS[w.kind];
  return `<div class="rg-week" title="${esc(L('hud.tip', { n: w.n, d: w.day, name: d.name[ru()], text: d.text[ru()], t }))}"><span class="rg-wn">${esc(L('hud.week', { n: w.n, d: w.day }))}<span class="rg-dot"> · </span></span><span class="rg-wk">${esc(d.name[ru()])}</span></div>`;
}
