// The premium shop's window (owner, 2026-10-03; docs/01 P7): the account's doubloons and the top-up in the header —
// the packs listed, the payments still to come — and the hulls and the creatures doubloons buy, a tab each. Every card
// is the painted figure (a hull's sprite, a creature's own figure), its name, the line on what sets it apart, the
// price in doubloons and Buy — shut, with the reason, while it cannot be had. The server decides; the window asks.

import { DOUBLOON_PACKS } from '../../../shared/src/data/premium.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import { FLEET_LISTS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { giftOf } from '../../../shared/src/data/shipgifts.ts';
import { isShipBeast } from '../../../shared/src/data/shipbeasts.ts';
import type { PremiumShipCard, PremiumUnitCard, PremiumView, PremiumWhy } from '../../../shared/src/premiumproto.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang, plural } from '../i18n.ts';
import { EN as AEN, RU as ARU } from '../lang/ui/army.ts';
import { EN, RU } from '../lang/ui/premium.ts';
import { EN as FEN, RU as FRU } from '../lang/ui/fleet.ts';
import type { ClientState } from '../state.ts';
import { specialName, unitIcon, unitName } from './army.ts';
import { ask } from './confirm.ts';
import { esc, fmt, icon } from './dom.ts';
import { placeName } from './maps.ts';
import { tgPackButton, tgPayNote, starIcon } from '../tg.ts'; // the packs for Telegram Stars (docs/27)

const L = dict(EN, RU);
const AL = dict(AEN, ARU);
const FL = dict(FEN, FRU);
const T = (x: [string, string]) => x[lang() === 'ru' ? 1 : 0];

/** The doubloon: its own picture once painted, the silver coins gilded meanwhile. */
export function doubloonIcon(cls = 'ico-sm'): string {
  return assetUrl('icon.doubloon') ? icon('doubloon', '◉', cls) : icon('coin', '◉', `${cls} dbl-gild`);
}

/** A sum of doubloons as the window shows it: the gold coin and the number. */
export function doubloons(n: number): string {
  return `<span class="dbl">${doubloonIcon()}${fmt(n)}</span>`;
}

const dblWord = (n: number): string => plural(n, L('dbl.one'), L('dbl.few'), L('dbl.many'));

function whyText(why: PremiumWhy, lv = 0): string {
  return L(`why.${why}`, { n: lv });
}

/** The painted figure of a hull: her sprite laid on her side, bow to the right. */
function hullArt(c: ShipClassId): string {
  const art = assetUrl(SHIP_CLASSES[c].sprite);
  return `<div class="pm-art pm-hull">${art ? `<img src="${art}" alt="" draggable="false" />` : icon('menu_ship', '⚓', 'ico-lg')}</div>`;
}

/** A creature's own figure, whole (or its face standing in until it is painted). */
function unitArt(u: UnitId): string {
  const fig = UNITS[u]?.beast || isShipBeast(u) ? assetUrl(`unit.${u}`) : null;
  return `<div class="pm-art pm-fig">${fig ? `<img src="${fig}" alt="" draggable="false" />` : unitIcon(u, 'pm-face')}</div>`;
}

function buyBox(price: number, why: PremiumWhy | null, lv: number, attr: string): string {
  return `<div class="pm-buy"><span class="pm-price">${doubloons(price)}</span>
    <button class="btn btn-small${why ? '' : ' btn-primary'}" ${attr} ${why ? `disabled title="${esc(whyText(why, lv))}"` : ''}>${esc(L('buy'))}</button>
    ${why ? `<small class="pm-why">${esc(whyText(why, lv))}</small>` : ''}</div>`;
}

/** A premium hull's gift (docs/02 §1.A.9): its name, when it works and what it does — on her card and her ship's screen. */
export function giftLine(c: ShipClassId): string {
  const g = giftOf(c);
  if (!g) return '';
  return `<span class="pm-gift" title="${esc(FL('gift'))}"><b>${esc(T(g.name))}</b> <span class="muted">· ${esc(FL(`kind.${g.kind}` as keyof typeof FEN))}</span><br>${esc(T(g.text))}</span>`;
}

function shipCard(c: PremiumShipCard): string {
  const d = SHIP_CLASSES[c.id];
  const beasts = c.beasts.length ? `<span class="pm-with"><span class="muted">${esc(L('comes'))}</span> ${c.beasts.map((b) => `<span class="pm-beast">${unitIcon(b.u, 'pm-face-xs')}${esc(unitName(b.u))} ×${b.n}</span>`).join(' ')}</span>` : '';
  return `<div class="card pm-card pm-ship${c.why ? ' shut' : ''}">${hullArt(c.id)}
    <div class="pm-text"><b class="pm-name">${esc(d.name)}</b><span class="pm-note">${esc(T(c.note))}</span>${giftLine(c.id)}
      <div class="hull-stats"><span>${icon('stat_hull', '', 'ico-sm')}${d.hull}</span><span>${icon('stat_sails', '', 'ico-sm')}${d.maxSpeed}</span><span>${icon('fire', '', 'ico-sm')}${d.gunPortsPerSide}×2</span><span>${icon('tab_market', '', 'ico-sm')}${d.holdVolume}</span><span>${icon('stat_crew', '', 'ico-sm')}${d.crewMin}–${d.crewMax}</span></div>
      <span class="muted pm-meta">${esc(L('lv', { n: c.lv }))}</span>${beasts}</div>
    ${buyBox(c.price, c.why, c.lv, `data-pmship="${c.id}"`)}</div>`;
}

function unitCard(c: PremiumUnitCard): string {
  const d = UNITS[c.id];
  const sp = d.specials.length ? ` · ${d.specials.map(specialName).join(', ')}` : '';
  return `<div class="card pm-card${c.why ? ' shut' : ''}">${unitArt(c.id)}
    <div class="pm-text"><b class="pm-name">${esc(unitName(c.id))} <span class="pm-n">×${c.n}</span></b><span class="pm-note">${esc(T(c.note))}</span>
      <span class="muted pm-meta">${esc(AL('tier', { n: d.tier }))} · ${esc(AL('stat', { atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp }))}${esc(sp)}</span>
      <span class="muted pm-meta">${esc(L('stack', { n: c.n }))} · ${esc(L('ulv', { n: c.lv }))}</span></div>
    ${buyBox(c.price, c.why, c.lv, `data-pmunit="${c.id}"`)}</div>`;
}

function emptyCard(tab: 'ships' | 'units'): string {
  return `<div class="card pm-empty">${doubloonIcon('ico-lg')}<div><b class="pm-name">${esc(L(tab === 'ships' ? 'empty.ships' : 'empty.units'))}</b><p class="muted">${esc(L('empty.text'))}</p></div></div>`;
}

function topUp(v: PremiumView): string {
  const packs = DOUBLOON_PACKS.map((p) => {
    const n = p.n + p.bonus;
    return `<div class="card pm-pack">${doubloonIcon('ico-lg')}<b class="pm-pack-n">${fmt(n)}</b><span class="pm-pack-w">${esc(dblWord(n))}</span>
      <span class="pm-bonus${p.bonus ? '' : ' none'}">${p.bonus ? esc(L('top.bonus', { n: fmt(p.bonus) })) : '&nbsp;'}</span>
      ${v.pay ? tgPackButton(p.id, p.stars) : `<button class="btn btn-small" disabled>${esc(L('top.soon'))}</button>`}</div>`;
  }).join('');
  // Payments closed (no bot token on the server): the packs are shown, none can be bought; open, each Buys for Stars.
  return `<div class="pm-top"><div class="pm-top-h"><div><h3 class="title-sm">${esc(L('top.title'))}</h3><p class="muted">${esc(L('top.sub'))}</p></div>
      <button class="btn btn-small" data-pmback>${esc(L('top.back'))}</button></div>
    <div class="pm-packs">${packs}</div>
    ${v.pay ? `<p class="pm-paynote">${starIcon()}${esc(tgPayNote())}</p>` : `<p class="pm-soon">${icon('tab_letters', '', 'ico-sm')}${esc(L('top.note'))}</p>`}</div>`;
}

export class PremiumWindow {
  tab: 'ships' | 'units' = 'ships';
  /** The top-up's packs in place of the shelves. */
  topup = false;
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  open(topup = false): void {
    this.topup = topup;
    this.send({ t: 'premium', action: 'view' });
  }

  render(root: HTMLElement, state: ClientState): void {
    const v = state.premium;
    const balance = v?.balance ?? state.doubloons;
    const head = `<div class="modal-head"><div><h2>${doubloonIcon('ico-crest')}<span>${esc(L('title'))}</span></h2><div class="sub">${esc(L('sub'))}</div></div>
      <div class="rc-chips pm-purse"><span class="ph-chip gold" title="${esc(L('balance'))}">${doubloons(balance)}</span><button class="btn btn-small btn-primary" data-pmtop>${esc(L('topup'))}</button></div></div>`;
    if (!v) {
      root.innerHTML = `${head}<div class="modal-body pm-body"></div>`;
    } else if (this.topup) {
      root.innerHTML = `${head}<div class="modal-body pm-body">${topUp(v)}</div>`;
    } else {
      const tabs = (['ships', 'units'] as const).map((t) => {
        const n = t === 'ships' ? v.ships.length : v.units.length;
        return `<button class="tab${t === this.tab ? ' active' : ''}" data-pmtab="${t}">${icon(t === 'ships' ? 'menu_ship' : 'build_kennel', '', 'ico-sm')}${esc(L(t === 'ships' ? 'tab.ships' : 'tab.units'))}${n ? ` <span class="pm-count">${n}</span>` : ''}</button>`;
      }).join('');
      // The hulls on their four shelves (docs/02 §1.A.9): the warships, the traders, the runners and the haulers.
      const shelf = (l: string) => v.ships.filter((x) => (SHIP_CLASSES[x.id].list ?? 'combat') === l);
      const cards = this.tab === 'ships'
        ? FLEET_LISTS.map((l) => (shelf(l).length ? `<h4 class="pm-list">${esc(FL(`list.${l}` as keyof typeof FEN))}</h4><div class="pm-grid">${shelf(l).map(shipCard).join('')}</div>` : '')).join('')
        : v.units.length ? `<div class="pm-grid">${v.units.map(unitCard).join('')}</div>` : '';
      const rule = this.tab === 'ships' ? (v.port ? L('deliver', { port: placeName(v.port) }) : L('deliverSea')) : L('unitsRule');
      root.innerHTML = `${head}<div class="modal-body pm-body"><div class="tabs">${tabs}</div>
        ${cards || emptyCard(this.tab)}
        <p class="muted pm-rule">${esc(rule)}</p></div>`;
    }
    root.querySelector<HTMLElement>('[data-pmtop]')!.onclick = () => {
      this.topup = !this.topup;
      this.render(root, state);
    };
    root.querySelector<HTMLElement>('[data-pmback]')?.addEventListener('click', () => {
      this.topup = false;
      this.render(root, state);
    });
    // A pack for Stars: the server makes the invoice and sends its link (src/tg.ts opens it).
    root.querySelectorAll<HTMLButtonElement>('[data-pmpack]').forEach((b) => (b.onclick = () => {
      b.disabled = true;
      setTimeout(() => (b.disabled = false), 4000);
      this.send({ t: 'premium', action: 'stars', pack: b.dataset.pmpack!, lang: lang() === 'ru' ? 'ru' : 'en' });
    }));
    root.querySelectorAll<HTMLElement>('[data-pmtab]').forEach((b) => (b.onclick = () => {
      this.tab = b.dataset.pmtab as 'ships' | 'units';
      this.render(root, state);
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-pmship]').forEach((b) => (b.onclick = () => {
      const c = b.dataset.pmship as ShipClassId;
      const card = v?.ships.find((x) => x.id === c);
      if (card) void ask(L('ask.ship', { name: SHIP_CLASSES[c].name, n: fmt(card.price) })).then((ok) => ok && this.send({ t: 'premium', action: 'buy_ship', id: c }));
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-pmunit]').forEach((b) => (b.onclick = () => {
      const u = b.dataset.pmunit as UnitId;
      const card = v?.units.find((x) => x.id === u);
      if (card) void ask(L('ask.unit', { name: unitName(u), k: card.n, n: fmt(card.price) })).then((ok) => ok && this.send({ t: 'premium', action: 'buy_unit', id: u }));
    }));
  }
}
