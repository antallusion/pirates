// «Причал» (forum, Нефигугум 2026-10-30, post 26: «купив новый корабль старый пропадает навсегда? нет ни какого ангара/
// причала»). The rules are the server's (shipbuilding.ts berthCap / swapBerth / buyBerth, ports.ts shipyardBuy):
//  - the port's «Причал» page: her stored ships as cards — the picture, ⚓, hull, the class's numbers, her fittings —
//    «Пересесть» at any harbour with a yard, «Продать» where she lies; the berths used of all, «+1 место» for doubloons;
//  - the trade-in's two ways: «Обменять (сдать старый)» and «Купить и оставить старый на причале»;
//  - the escorts' line in the yard's repair card («Починить сопровождение»).

import type { ClientMsg, PortView } from '../../../shared/src/protocol.ts';
import { BERTH_PRICE, BERTHS_CAP, BERTHS_FREE } from '../../../shared/src/data/berths.ts';
import { levelRange } from '../../../shared/src/data/shiplevel.ts';
import { GUNS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/berth.ts';
import type { ClientState } from '../state.ts';
import { assetUrl } from '../assets.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';
import { trophyTag } from './surrender.ts';
import { buttonHtml } from './kit/button.ts';
import { openSheet } from './kit/sheet.ts';

export const LB = dict(EN, RU);

/** A hull's levels: ⚓3–5. */
function levelSpan(classId: ShipClassId): string {
  const [lo, hi] = levelRange(classId);
  return lo === hi ? `⚓${lo}` : `⚓${lo}–${hi}`;
}

const stat = (ico: string, v: string | number) => `<span>${icon(ico, '', 'ico-sm')}${esc(String(v))}</span>`;

/** A hull's numbers in one line (the class's: the yard's own cards show the same). */
export function hullStats(classId: ShipClassId): string {
  const c = SHIP_CLASSES[classId];
  return `<div class="hull-stats">${stat('stat_hull', c.hull)}${stat('stat_sails', c.maxSpeed)}${stat('fire', `${c.gunPortsPerSide}×2`)}${stat('tab_market', c.holdVolume)}${stat('stat_crew', `${c.crewMin}–${c.crewMax}`)}</div>`;
}

/** The port's «Причал» page. */
export function berthsCard(view: PortView, state: ClientState): string {
  const self = state.self!;
  const cap = self.berthCap ?? BERTHS_FREE;
  const yard = view.shipyard.tier > 0;
  const cur = SHIP_CLASSES[self.loadout.classId];
  const rows = self.berths.map((b, i) => {
    const c = SHIP_CLASSES[b.classId];
    const art = assetUrl(c.sprite);
    const isle = b.port.startsWith('isle:');
    const here = b.port === view.portId;
    const where = isle ? LB('isle') : LB('where', { port: placeName(state.ports.find((p) => p.id === b.port)?.name ?? b.port) });
    const can = !isle && (here || yard);
    const tip = isle ? LB('isle') : !yard && !here ? LB('noYard') : LB('swapHint');
    const guns = b.guns ? GUNS[b.guns[0]]?.name ?? '' : '';
    const meta = [b.level ? LB('lvl', { n: b.level }) : levelSpan(b.classId), LB('hull', { n: b.hull }), b.mods ? LB('mods', { n: b.mods }) : '', guns].filter(Boolean).join(' · ');
    return `<div class="card hull-card bth-card" data-berth="${i}"><div class="hull-art">${art ? `<img src="${art}" alt="" draggable="false" />` : ''}</div>
      <div class="hull-text"><b>${esc(placeName(b.name))}</b>${trophyTag(b.trophy)} <span class="muted">${esc(c.name)}</span>
        <small class="bth-meta">${esc(meta)}</small>${hullStats(b.classId)}<small class="muted bth-where">${esc(where)}</small></div>
      <span class="bth-btns"><button type="button" class="btn btn-small${can ? ' btn-primary' : ''}" data-act="berth_swap" data-i="${i}" title="${esc(tip)}" ${can ? '' : 'disabled'}>${esc(LB('swap'))}</button>${here && !isle ? `<button type="button" class="btn btn-small btn-danger" data-act="berth_sell" data-i="${i}" title="${esc(LB('sellHint'))}">${esc(LB('sell'))}</button>` : ''}</span></div>`;
  }).join('');
  const more = cap < BERTHS_CAP
    ? `<button type="button" class="btn btn-small bth-buy" data-act="berth_buy" title="${esc(LB('buyHint', { n: BERTH_PRICE, max: BERTHS_CAP }))}">${esc(LB('buy'))} · ${fmt(BERTH_PRICE)}${icon('doubloon', '◈', 'ico-xs')}</button>`
    : `<span class="muted">${esc(LB('full', { max: BERTHS_CAP }))}</span>`;
  return `<div class="card bth"><h4 class="card-h">${icon('build_shipyard', '', 'ico-md')}${esc(LB('title', { n: self.berths.length, max: cap }))}<span class="bth-more">${more}</span></h4>
    <p class="muted bth-text">${esc(LB('text'))}</p>
    <p class="bth-now">${icon('menu_ship', '', 'ico-sm')}${esc(LB('sailing', { name: `${placeName(self.loadout.name)} (${cur.name})` }))}</p>
    ${rows ? `<div class="bth-list">${rows}</div>` : `<p class="muted">${esc(LB('empty'))}</p>`}</div>`;
}

/** The yard's repair card's escort line: each hurt ship and her price, «Починить сопровождение». */
export function escortRepairHtml(view: PortView): string {
  const e = view.shipyard.escorts;
  if (!e || !e.ships.length) return '';
  const lines = e.ships.map((x) => `<li>${esc(x.away ? LB('escAway', { name: placeName(x.name), hull: x.hull }) : LB('escLine', { name: placeName(x.name), hull: x.hull }))} <span class="muted">${money(x.cost)}</span></li>`).join('');
  return `<div class="yd-esc"><div class="yd-esc-h">${icon('menu_ship', '⚓', 'ico-sm')}<b>${esc(LB('escTitle'))}</b><button type="button" class="btn btn-small" data-act="repair_escorts">${esc(LB('escTitle'))} ${money(e.cost)}</button></div>
    <ul class="yd-esc-l">${lines}</ul><small class="muted">${esc(LB('escNote'))}</small></div>`;
}

/** The trade-in's two ways (forum 2026-10-30): resolves 'trade', 'keep' or null (not now). */
export function chooseTrade(state: ClientState, view: PortView, classId: ShipClassId): Promise<'trade' | 'keep' | null> {
  const self = state.self!;
  const offer = view.shipyard.ships.find((s) => s.classId === classId);
  const price = offer?.price ?? SHIP_CLASSES[classId].price;
  const back = offer?.tradeIn ?? 0;
  const cap = self.berthCap ?? BERTHS_FREE;
  const full = self.berths.length >= cap;
  const gold = self.gold;
  const net = Math.max(0, price - back);
  const btn = (id: string, label: string, sub: string, primary: boolean, off: boolean) => buttonHtml({ kind: primary ? 'primary' : 'secondary', size: 'md', label: `${label} · ${sub}`, data: { pick: id }, disabled: off });
  const body = `<p id="confirm-text"><b>${esc(LB('tradeTitle', { ship: SHIP_CLASSES[classId].name }))}</b></p><p>${esc(LB('tradeText', { old: placeName(self.loadout.name) }))}</p>`;
  const foot = `<div class="confirm-row bth-choice">${btn('trade', LB('tradeIn'), LB('tradeInSub', { cost: fmt(net), back: fmt(back) }), false, gold < net)}${btn('keep', LB('keep'), full ? LB('keepFull', { max: cap }) : LB('keepSub', { cost: fmt(price), n: self.berths.length, max: cap }), true, full || gold < price)}${buttonHtml({ kind: 'secondary', label: LB('cancel'), data: { pick: '' } })}</div>`;
  return new Promise((done) => {
    let answer: 'trade' | 'keep' | null = null;
    const sheet = openSheet({ id: 'confirm', cls: 'confirm-panel bth-sheet', role: 'alertdialog', height: 'auto', noClose: true, labelledBy: 'confirm-text', body: `<div class="confirm-body">${body}</div>`, foot, onClose: () => done(answer) });
    sheet.panel.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.pick;
      answer = v === 'trade' || v === 'keep' ? v : null;
      sheet.close('button');
    }));
  });
}

/** The server asks: men will not fit the hull (shipbuilding.ts BERTH_MEN_ASK). */
export function menAskText(n: number): string {
  return LB('menAsk', { n });
}

export type { ClientMsg };
