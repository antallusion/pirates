// The Path book (docs/18 item 9): a tab of the Captain window — her path's home school (physical or magical), her two
// stores, her innate move and her ultimate, her path book's six pages by school with their cost, wait, words and the
// figures they strike with at her level, the other paths' pages she knows, her scrolls, and the talents that lift it.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { ORDERS, SCHOOL_NAMES, SCHOOL_ICON, orderRes } from '../../../shared/src/data/hero.ts';
import type { HeroView, OrderId } from '../../../shared/src/data/hero.ts';
import { HOME_MUL, INNATE, PAGE_UNLOCK, PATH_PAGES, PATH_SCHOOL, SCHOOL_KIND, ULTIMATE, ULT_LEVEL, isPathPage, pathBook, powered } from '../../../shared/src/data/paths.ts';
import type { BtMods, PageFx, PathMove } from '../../../shared/src/data/paths.ts';
import { TALENTS_BY_ID } from '../../../shared/src/data/talents.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/pathbook.ts';
import { esc, icon } from './dom.ts';
import { PATH_FAV, favouriteKinds } from '../../../shared/src/data/drifts.ts';
import { EN as V_EN, RU as V_RU } from '../lang/ui/heroes18v.ts';
import { unitIcon, unitName } from './army.ts';

const V = dict(V_EN, V_RU);

/** docs/18 #44: her path's favourite creatures and what they get with her. */
function favBlock(path: CaptainId): string {
  const kinds = favouriteKinds(path);
  return `<div class="gi-h">${esc(V('fav.title'))}</div>
    <p class="muted hx-note">${esc(T(PATH_FAV[path].text))} ${esc(V('fav.text'))}</p>
    <div class="pb-fav">${kinds.map((u) => `<span class="pb-fav-k" title="${esc(unitName(u))}">${unitIcon(u, 'ico-md')}<i>${esc(unitName(u))}</i></span>`).join('')}</div>`;
}

const L = dict(EN, RU);
const T = (x: [string, string]) => x[lang() === 'ru' ? 1 : 0];
type K = keyof typeof EN;

const pct = (x: number) => `${x > 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}`;
const sg = (x: number) => `${x > 0 ? '+' : '−'}${Math.abs(x)}`;
const mul = (x: number) => (Math.round(x * 100) / 100).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB');

function modsLine(m: BtMods): string[] {
  const out: string[] = [];
  for (const k of ['melee', 'shot', 'taken', 'shotTaken'] as const) if (m[k]) out.push(L(`f.${k}` as K, { n: pct(m[k]!) }));
  for (const k of ['speed', 'init', 'morale', 'luck'] as const) if (m[k]) out.push(L(`f.${k}` as K, { n: sg(m[k]!) }));
  for (const k of ['blind', 'noRet', 'noAnswer'] as const) if (m[k]) out.push(L(`f.${k}` as K));
  return out;
}

/** What a move strikes with, in figures (her path's power at her level on it): a blow in hit points with her army
 *  and her captain as they are (`blast` the blast of a grenade, `k` her school's lift), shares in per cent. */
export function fxLine(fx: PageFx, blast = 0, k = 1): string {
  const out: string[] = [];
  const hp = (x: number) => (blast > 0 ? `≈${Math.max(1, Math.round(blast * x * k))}` : `×${mul(x)}`);
  if (fx.dmg) out.push(L('f.dmg', { n: hp(fx.dmg) }));
  if (fx.ring) out.push(L('f.ring', { n: hp(fx.ring) }));
  if (fx.all) out.push(L('f.all', { n: hp(fx.all) }));
  if (fx.shooters) out.push(L('f.shooters', { n: hp(fx.shooters) }));
  if (fx.drain) out.push(L('f.drain', { n: Math.round(Math.min(0.12, fx.drain * k) * 100) }));
  if (fx.heal) out.push(L('f.heal', { n: Math.round(Math.min(0.35, fx.heal * k) * 100) }));
  if (fx.raise) out.push(L('f.raise', { n: Math.round(Math.min(0.35, fx.raise * k) * 100) }));
  if (fx.self && modsLine(fx.self).length) out.push(L('f.yours', { list: modsLine(fx.self).join(', ') }));
  if (fx.foe && modsLine(fx.foe).length) out.push(L('f.hers', { list: modsLine(fx.foe).join(', ') }));
  if (fx.one && modsLine(fx.one).length) out.push(L('f.one', { list: modsLine(fx.one).join(', ') }));
  if (fx.again) out.push(L('f.again'));
  if (fx.allAgain) out.push(L('f.allAgain', { n: Math.round((fx.allShare ?? 1) * 100) }));
  if (fx.free) out.push(L('f.free', { n: fx.free }));
  if (fx.self || fx.foe || fx.one) out.push(fx.rounds ? L('f.rounds', { n: fx.rounds + 1 }) : L('f.rounds0'));
  return out.join(' · ');
}

function moveCard(h: HeroView, path: CaptainId, mv: PathMove, ult: boolean, level: number): string {
  const locked = ult && level < ULT_LEVEL;
  return `<div class="pb-move${ult ? ' ult' : ''}${locked ? ' locked' : ''}">${icon(mv.icon, '✦', 'ico-lg')}<span><b>${esc(L(ult ? 'ult' : 'innate'))}: ${esc(T(mv.name))}</b><small>${esc(T(mv.text))}</small><small class="pb-num">${esc(fxLine(powered(mv.fx, path, level, 'move'), h.blast ?? 0, (h.mul?.[PATH_SCHOOL[path]] ?? 1) * HOME_MUL * (h.innateMul ?? 1)))}</small><small class="muted">${esc(locked ? L('ultAt', { n: ULT_LEVEL }) : L(ult ? 'freeUlt' : 'free'))}</small></span></div>`;
}

function pageRow(id: OrderId, h: HeroView, path: CaptainId, level: number): string {
  const pg = isPathPage(id) ? PATH_PAGES[id] : null;
  const d = ORDERS[id];
  if (!pg) return '';
  const open = pg.path !== path || level >= PAGE_UNLOCK[pg.level];
  const res = orderRes(id);
  const cost = h.costs[id] ?? d.cost;
  const home = PATH_SCHOOL[path] === pg.school;
  return `<div class="pb-page${open ? '' : ' locked'}">${icon(pg.icon, '✦', 'ico-md')}<span><b>${esc(T(pg.name))}</b>
    <span class="pb-tags"><span class="tag">${icon(SCHOOL_ICON[pg.school], '', 'ico-xs')}${esc(T(SCHOOL_NAMES[pg.school]))}</span>${home ? `<span class="tag home">${esc(L('homeTag'))}</span>` : ''}<span class="tag">${esc(L('lv', { n: pg.level }))}</span><span class="tag ${res}">${esc(L(res === 'stam' ? 'costStam' : 'costWill', { n: cost }))}</span><span class="tag">${esc(L('cd', { n: pg.cd }))}</span>${open ? '' : `<span class="tag">${esc(L('opensAt', { n: PAGE_UNLOCK[pg.level] }))}</span>`}</span>
    <small>${esc(T(pg.text))}</small><small class="pb-num">${esc(fxLine(powered(pg.fx, pg.path, level), h.blast ?? 0, (h.mul?.[pg.school] ?? 1) * (PATH_SCHOOL[path] === pg.school ? HOME_MUL : 1) * (pg.path === path ? h.pageMul ?? 1 : 1)))}</small></span></div>`;
}

const bar = (cls: string, ico: string, k: K, n: number, m: number) =>
  `<div class="tb-store ${cls}" title="${esc(L(k))}">${icon(ico, '', 'ico-xs')}<span>${esc(L(k))}</span><span class="tb-rbar"><i style="width:${m ? Math.round(Math.max(0, Math.min(1, n / m)) * 100) : 0}%"></i></span><b>${n}</b><small>/${m}</small></div>`;

/** The Path book tab. */
export function pathTab(h: HeroView, path: CaptainId, level: number, talents: Record<string, number>): string {
  const sc = PATH_SCHOOL[path];
  const kind = SCHOOL_KIND[sc];
  const own = pathBook(path);
  const foreign = h.orders.filter((id) => isPathPage(id) && PATH_PAGES[id].path !== path);
  const scrolls = Object.entries(h.scrolls ?? {}).filter(([, n]) => (n ?? 0) > 0);
  const lift = h.lift;
  const nodes = (lift?.nodes ?? []).map((id) => `${TALENTS_BY_ID[id]?.name ?? id}${(talents[id] ?? 0) > 1 ? ` ×${talents[id]}` : ''}`);
  const liftChips = lift ? [lift.mul ? L('lift.mul', { n: Math.round(lift.mul * 100) }) : '', lift.cost ? L('lift.cost', { n: Math.round(lift.cost * 100) }) : '', lift.stam ? L('lift.stam', { n: lift.stam }) : '', lift.will ? L('lift.will', { n: lift.will }) : '', lift.innate ? L('lift.innate', { n: Math.round(lift.innate * 100) }) : ''].filter(Boolean) : [];
  return `<div class="pb-head"><div class="gi-h">${icon(CAPTAINS[path].portrait, '', 'ico-md ico-round')}${esc(L('title', { path: CAPTAINS[path].archetype }))}</div>
      <span class="pb-school ${kind}">${icon(SCHOOL_ICON[sc], '', 'ico-xs')}${esc(L('home', { school: T(SCHOOL_NAMES[sc]) }))} · ${esc(L(kind))}</span></div>
    <p class="muted hx-note">${esc(L('homeNote'))}</p>
    <div class="gi-h">${esc(L('stores'))}</div>
    <div class="pb-stores">${bar('will', 'icon.ab_brine_mend', 'will', h.will, h.willMax)}${bar('stam', 'icon.tree_survival', 'stam', h.stam ?? 0, h.stamMax ?? 0)}</div>
    <p class="muted hx-note">${esc(L('willNote'))} ${esc(L('stamNote'))}</p>
    <div class="gi-h">${esc(L('moves'))}</div>
    <div class="pb-moves">${moveCard(h, path, INNATE[path], false, level)}${moveCard(h, path, ULTIMATE[path], true, level)}</div>
    ${favBlock(path)}
    <div class="gi-h">${esc(L('pages'))}</div>
    <p class="muted hx-note">${esc(L('pagesNote'))} ${esc(L('f.note'))}</p>
    <div class="pb-pages">${own.map((id) => pageRow(id, h, path, level)).join('')}</div>
    <div class="gi-h">${esc(L('foreign'))}</div>
    ${foreign.length ? `<div class="pb-pages">${foreign.map((id) => pageRow(id, h, path, level)).join('')}</div>` : `<p class="muted hx-note">${esc(L('none'))}. ${esc(L('foreignNote'))}</p>`}
    <div class="gi-h">${esc(L('scrolls'))}</div>
    ${scrolls.length ? `<div class="pb-pages">${scrolls.map(([id, n]) => pageRow(id as OrderId, h, path, level).replace('<b>', `<b>×${n} `)).join('')}</div>` : ''}
    <p class="muted hx-note">${scrolls.length ? '' : `${esc(L('none'))}. `}${esc(L('scrollsNote'))}</p>
    <div class="gi-h">${esc(L('lift'))}</div>
    <p class="muted hx-note">${esc(L('liftNote'))}</p>
    ${nodes.length ? `<div class="pb-lift">${nodes.map((n) => `<span class="chip">${esc(n)}</span>`).join('')}${liftChips.map((c) => `<span class="chip good">${esc(c)}</span>`).join('')}</div>` : `<p class="muted hx-note">${esc(L('noLift'))}</p>`}`;
}
