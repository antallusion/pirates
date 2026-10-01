// The visit card of the adventure map (docs/17 H4): the thing within reach of the boats — its painted picture, how
// often it may be visited and when again, what it gives and the choice it asks (a chest's silver or experience) — or
// the guard in her way: HoMM3's word for their number, the faces of their stacks, her army against theirs, the
// offer when she is much the stronger (they flee, or some sign on), and "Board them". Compact, over the sea, like
// the terms of a struck ship; closed with ×, it comes back when there is something new to say.

import { GUARDS, OBJS, WELL_MORALE, WELL_SANITY, TOWER_R } from '../../../shared/src/data/advmap.ts';
import type { GuardKind } from '../../../shared/src/data/advmap.ts';
import { OFFICER_DEFS } from '../../../shared/src/data/crew.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { AdvCardView, GuardCard, ObjCard } from '../../../shared/src/h4proto.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h4.ts';
import { serverText } from '../lang/server.ts';
import { strengthWord, unitArt, unitName } from './army.ts';
import { esc, fmt, icon, money, xpBadge } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);

/** A guard's painted picture: the hold-out's camp, the hulk, the wreck, the serpent of the pack. */
export const GUARD_ART: Record<GuardKind, string> = { holdout: 'prop.life_pirate_tent', hulk: 'monster.hulk', wreck: 'prop.shipwreck', beasts: 'monster.young_serpent' };

export function guardName(kind: GuardKind): string {
  return GUARDS[kind].name[ru()];
}

/** World seconds as the card writes them. */
export function timeWords(secs: number): string {
  const m = Math.max(1, Math.ceil(secs / 60));
  return m < 60 ? L('t.m', { m }) : L('t.hm', { h: Math.floor(m / 60), m: m % 60 });
}

function guardBlock(g: GuardCard, own: boolean): string {
  const w = strengthWord(g.men);
  const faces = g.units.slice(0, 7).map((u) => `<span class="army-mini" title="${esc(unitName(u))}">${icon(unitArt(u), '', 'army-face-xs')}</span>`).join('');
  const what = g.at === 'mine' ? L('guard.mine') : g.at ? L('guard.of', { what: OBJS[g.at].name[ru()].toLowerCase() }) : L('guard.strait');
  const offer = g.offer === 'join' ? (g.joinN > 0 ? L('guard.joinText', { n: g.joinN }) : L('guard.joinNoRoom')) : g.offer === 'flee' ? L('guard.fleeText') : '';
  const ratio = g.ratio >= 10 ? String(Math.round(g.ratio)) : g.ratio < 0.1 ? (lang() === 'ru' ? '<0,1' : '<0.1') : g.ratio.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 1 });
  return `<div class="ac-guard${own ? ' own' : ''}">
    <div class="ac-gw"><b class="ac-word">${esc(w.word)}</b> <span class="muted">${esc(w.range)}</span>${own ? ` · ${esc(guardName(g.kind))}` : ''}<span class="tg-army-faces">${faces}</span></div>
    <div class="muted ac-gl">${own ? '' : `${esc(what)} · `}${esc(L('guard.vs', { r: ratio }))}</div>
    <div class="muted ac-gl ac-pay">${esc(L('guard.pay', { s: fmt(g.pay.silver), x: fmt(g.pay.xp) }))}</div>
    ${offer ? `<div class="ac-offer">${esc(offer)}</div>` : ''}
    ${!g.alongside ? `<div class="muted ac-gl ac-come">${esc(L('guard.come'))}</div>` : ''}
    <div class="ac-acts">
      <button class="btn btn-small${g.offer ? '' : ' btn-primary'}" data-ag="fight" data-id="${g.id}"${g.alongside ? '' : ' disabled'}>${icon('prof_marine', '', 'ico-sm')}${esc(L('guard.fight'))}</button>
      ${g.offer === 'join' && g.joinN > 0 ? `<button class="btn btn-small btn-primary" data-ag="join" data-id="${g.id}">${esc(L('guard.join', { n: g.joinN }))}</button>` : ''}
      ${g.offer ? `<button class="btn btn-small${g.offer === 'flee' || !g.joinN ? ' btn-primary' : ''}" data-ag="flee" data-id="${g.id}">${esc(L('guard.let'))}</button>` : ''}
    </div></div>`;
}

function statusLine(o: ObjCard): string {
  const rule = L(`rule.${o.rule}` as 'rule.once');
  if (o.ready) return rule;
  const when = o.rule === 'once' ? L('never') : o.rule === 'season' ? L('nextSeason') : L('again', { t: timeWords(o.again) });
  return `${rule} · ${L('done')} · ${when}`;
}

function objBody(o: ObjCard): string {
  const ok = o.ready && !o.why;
  const btn = (label: string, choice = '', primary = true) => `<button class="btn btn-small${primary ? ' btn-primary' : ''}" data-av="${o.id}"${choice ? ` data-choice="${choice}"` : ''}${ok ? '' : ' disabled'}>${label}</button>`;
  switch (o.kind) {
    case 'chest': {
      const c = o.chest!;
      const extra = c.extra ? btn(esc(c.extra.label[ru()]), c.extra.id, false) : '';
      return `<div class="ac-line muted">${esc(L('chest.pick'))}</div><div class="ac-acts">${btn(`${esc(L('chest.silver'))} ${money(c.silver)}`, 'silver')}${btn(`${esc(L('chest.xp'))} ${xpBadge(c.xp)}`, 'xp', false)}${extra}</div>`;
    }
    case 'altar':
      return `<div class="ac-line">${icon('xp', '✦', 'ico-sm')}${esc(o.altar!.point ? L('altar.point') : L('altar.xp', { n: fmt(o.altar!.xp) }))}</div><div class="ac-acts">${btn(esc(L('altar.btn')))}</div>`;
    case 'well':
      return `<div class="ac-line">${esc(L('well.text', { m: WELL_MORALE, s: WELL_SANITY }))}</div><div class="ac-acts">${btn(esc(L('well.btn')))}</div>`;
    case 'tower':
      return `<div class="ac-line">${esc(L('tower.text', { n: Math.round(TOWER_R / 1000) }))}</div><div class="ac-acts">${btn(esc(L('tower.btn')))}</div>`;
    case 'mill':
    case 'store': {
      const l = o.load!;
      return `<div class="ac-line">${icon(`good_${l.good}`, '', 'ico-sm')}${esc(L('load.text', { n: l.n, good: GOODS[l.good].name.toLowerCase() }))}</div><div class="ac-acts">${btn(esc(L('load.btn')))}</div>`;
    }
    case 'prison': {
      const p = o.prison!;
      return `<div class="ac-line">${p.role ? `${icon(`role_${p.role}`, '', 'ico-sm')}${esc(L('prison.who', { role: OFFICER_DEFS[p.role].name.toLowerCase(), n: p.level }))}` : esc(L('prison.gone'))}</div><div class="ac-acts">${btn(esc(L('prison.btn')))}</div>`;
    }
    case 'obelisk':
      return `<div class="ac-line">${icon('good_cursed_relics', '', 'ico-sm')}${esc(L('obelisk.pieces', { n: o.pieces!.n, of: o.pieces!.of }))}</div><div class="ac-acts">${btn(esc(L('obelisk.btn')))}<button class="btn btn-small" data-apz>${icon('map_treasure', '', 'ico-sm')}${esc(L('puzzle.btn'))}</button></div>`;
  }
}

export class AdvCard {
  private el: HTMLElement;
  private key = '';
  private closed = '';
  onPuzzle: () => void = () => {};
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    let el = document.getElementById('advcard');
    if (!el) {
      el = document.createElement('div');
      el.id = 'advcard';
      el.className = 'hidden';
      document.body.appendChild(el);
    }
    this.el = el;
  }

  /** Draw the card for what the server says is within reach (null: nothing). */
  show(v: AdvCardView | null): void {
    const key = v ? JSON.stringify([lang(), v]) : '';
    if (key === this.key) return;
    this.key = key;
    // Closed by hand: it stays closed until the thing or its state changes.
    const what = v ? JSON.stringify([v.obj?.id, v.obj?.ready, v.obj?.why, v.obj?.guard?.id, v.guard?.id, v.guard?.offer, v.obj?.guard?.offer]) : '';
    if (!v || what === this.closed) {
      this.el.classList.add('hidden');
      this.el.innerHTML = '';
      if (!v) this.closed = '';
      return;
    }
    const o = v.obj;
    let html = '';
    if (o) {
      const def = OBJS[o.kind];
      const art = assetUrl(def.art);
      html = `<div class="enc-card ac-card" data-kind="${o.kind}">
        <div class="ac-head">${art ? `<img class="ac-art${o.kind === 'obelisk' ? ' ac-obelisk' : ''}" src="${art}" alt="" draggable="false" />` : ''}<div class="ac-id"><div class="enc-h">${esc(def.name[ru()])} <span class="ac-lvl">⚓${o.level}</span></div>
        <div class="ac-sub muted">${esc(statusLine(o))} · ${esc(placeName(o.island))}</div></div><button class="ac-x" data-ax title="${esc(L('close'))}">×</button></div>
        <p class="ac-text muted">${esc(def.text[ru()])}</p>
        ${o.guard ? `<div class="ac-line ac-warn">${esc(L('guarded'))}</div>${guardBlock(o.guard, true)}` : objBody(o)}
        ${o.why && !o.guard && o.ready ? `<div class="ac-line muted ac-why">${esc(serverText(o.why))}</div>` : ''}
      </div>`;
    }
    const gg = v.guard;
    if (gg) {
      const art = assetUrl(GUARD_ART[gg.kind]);
      const w = strengthWord(gg.men);
      html += `<div class="enc-card ac-card ac-gcard" data-guard="${gg.kind}">
        <div class="ac-head">${art ? `<img class="ac-art" src="${art}" alt="" draggable="false" />` : ''}<div class="ac-id"><div class="enc-h">${esc(w.word)} · ${esc(guardName(gg.kind))} <span class="ac-lvl">⚓${gg.level}</span></div>
        <div class="ac-sub muted">${esc(GUARDS[gg.kind].text[ru()])}</div></div>${o ? '' : `<button class="ac-x" data-ax title="${esc(L('close'))}">×</button>`}</div>
        ${guardBlock(gg, false)}
      </div>`;
    }
    this.el.innerHTML = html;
    this.el.classList.remove('hidden');
    this.el.querySelectorAll<HTMLButtonElement>('[data-av]').forEach((b) => (b.onclick = () => this.send({ t: 'h4', action: 'visit', id: b.dataset.av!, ...(b.dataset.choice ? { choice: b.dataset.choice } : {}) })));
    this.el.querySelectorAll<HTMLButtonElement>('[data-ag]').forEach((b) => (b.onclick = () => this.send({ t: 'h4', action: 'guard', id: b.dataset.id!, choice: b.dataset.ag as 'fight' })));
    this.el.querySelectorAll<HTMLButtonElement>('[data-apz]').forEach((b) => (b.onclick = () => this.onPuzzle()));
    this.el.querySelectorAll<HTMLButtonElement>('[data-ax]').forEach((b) => (b.onclick = () => {
      this.closed = what;
      this.el.classList.add('hidden');
    }));
  }
}
