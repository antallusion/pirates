// The walk across an island (docs/16 #21): one compact card — the island, the steps walked (a dot and the path's
// picture for each), what the party met and what came of it, and the ways on ("toward the ruins / along the stream /
// up the hill"), or the choice it waits for, or the cache at the far side. The server decides everything; the card
// only shows and asks. It stands aside while one of the island games is open (their own window).

import { TREK_EVENTS, TREK_PATH_ICON, TREK_PATH_NAMES } from '../../../shared/src/data/isles.ts';
import type { Tr, TrekOutcome } from '../../../shared/src/data/isles.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { RARITY_COLOR, itemName } from '../../../shared/src/data/items.ts';
import type { ClientMsg, TrekVars, TrekView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/isles.ts';
import { serverText } from '../lang/server.ts';
import { assetUrl } from '../assets.ts';
import { esc, icon, money } from './dom.ts';
import { TREK_END } from '../../../shared/src/data/isles.ts';

const L = dict(EN, RU);
const tr = (t: Tr) => t[lang() === 'ru' ? 1 : 0];

/** The words of an outcome with the server's numbers in them. */
export function trekText(o: TrekOutcome, v: TrekVars): string {
  return esc(tr(o.text)).replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k === 'silver') return money(v.silver ?? 0);
    if (k === 'cost') return money(v.cost ?? 0);
    if (k === 'good') return v.good ? esc(GOODS[v.good].name.toLowerCase()) : '';
    if (k === 'n' || k === 'crew' || k === 'hands' || k === 'charted') return String(v[k] ?? 0);
    return '';
  });
}

export class TrekWindow {
  private el: HTMLElement;
  private send: (m: ClientMsg) => void;
  private view: TrekView | null = null;
  /** Another window has the stage (an island game): the card waits behind it. */
  private blocked: () => boolean;
  private timer = 0;

  constructor(send: (m: ClientMsg) => void, blocked: () => boolean) {
    this.send = send;
    this.blocked = blocked;
    this.el = document.getElementById('trek')!;
  }

  get isOpen(): boolean {
    return this.view !== null;
  }

  open(view: TrekView | null): void {
    this.view = view;
    this.render();
  }

  private render(): void {
    clearTimeout(this.timer);
    const v = this.view;
    if (!v) {
      this.el.classList.add('hidden');
      this.el.innerHTML = '';
      return;
    }
    // Behind an island game: look again in a moment.
    if (v.game || this.blocked()) {
      this.el.classList.add('hidden');
      this.timer = window.setTimeout(() => this.render(), 400);
      return;
    }
    const url = assetUrl('card.enc_signal_fire');
    const art = `<div class="mg-art"${url ? ` style="background-image:url('${url}')"` : ''}>${icon('talent_exp_pathfinder', '', 'mg-face')}</div>`;
    const dots = Array.from({ length: v.steps }, (_, i) => {
      const t = v.trail[i];
      if (!t) return `<span class="trek-dot${i === v.step && !v.done ? ' now' : ''}"></span>`;
      const pic = t.path === 'landing' ? 'map_cove' : TREK_PATH_ICON[t.path];
      const name = t.path === 'landing' ? L('trek.landing') : tr(TREK_PATH_NAMES[t.path]);
      return `<span class="trek-dot done${t.good ? '' : ' bad'}" title="${esc(name)}">${icon(pic, '•', 'trek-dot-ico')}</span>`;
    }).join('');
    const head = `<div class="mg-h">${esc(L('trek.title', { island: serverText(v.island) }))}</div><div class="trek-steps"><span class="mg-note">${esc(L('trek.step', { n: Math.min(v.step + (v.done ? 0 : 1), v.steps), len: v.steps }))}</span><span class="trek-dots">${dots}</span></div>`;
    let body = '';
    const ev = v.event ? TREK_EVENTS[v.event] : null;
    if (ev && v.event !== 'haunt') body += `<p class="mg-text">${esc(tr(ev.text))}</p>`;
    if (ev && v.outcome && ev.outcomes[v.outcome] && v.event !== 'haunt') {
      const o = ev.outcomes[v.outcome];
      body += `<p class="mg-out ${o.good ? 'mg-won' : 'mg-lost'}">${trekText(o, v.vars)}</p>${this.chips(v.vars)}`;
    }
    if (v.choice && ev?.choices) {
      body += `<div class="mg-choices">${ev.choices.map((c) => `<button class="btn btn-small" data-trek="${esc(c.id)}">${esc(tr(c.label))}</button>`).join('')}</div>`;
    } else if (v.paths?.length) {
      body += `<div class="mg-note">${esc(L('trek.which'))}</div><div class="mg-choices trek-paths">${v.paths.map((p) => `<button class="btn btn-small trek-path" data-trek="${p}">${icon(TREK_PATH_ICON[p], '', 'ico-sm')}<span>${esc(tr(TREK_PATH_NAMES[p]))}</span></button>`).join('')}</div>
        <div class="mg-choices"><button class="btn btn-small mg-walk" data-trek="back">${esc(L('trek.back'))}</button></div>`;
    }
    if (v.done) {
      if (v.end) body += `<div class="mg-note">${esc(L('trek.end'))}</div><p class="mg-out mg-won">${trekText(TREK_END, v.end)}</p>${this.chips(v.end)}`;
      else body += `<p class="mg-text">${esc(L('trek.early'))}</p>`;
      body += `<div class="mg-choices"><button class="btn btn-small btn-primary" data-trek="close">${esc(L('trek.close'))}</button></div>`;
    }
    this.el.innerHTML = `<div class="mg-card trek-card">${art}${head}${body}</div>`;
    this.el.classList.remove('hidden');
    this.el.querySelectorAll<HTMLButtonElement>('[data-trek]').forEach((b) => (b.onclick = () => {
      const pick = b.dataset.trek!;
      this.el.querySelectorAll<HTMLButtonElement>('[data-trek]').forEach((x) => (x.disabled = true));
      this.send({ t: 'trek', pick });
      if (pick === 'close') this.open(null);
    }));
  }

  private chips(v: TrekVars): string {
    const out: string[] = [];
    if (v.xp) out.push(`<span class="mg-chip">${icon('xp', '✦', 'ico-sm')}${esc(L('trek.xp', { n: v.xp }))}</span>`);
    if (v.item) out.push(`<span class="mg-chip">${icon(`item_${v.item.base}`, '✦', 'ico-sm')}<b style="color:${RARITY_COLOR[v.item.rarity]}">${esc(itemName(v.item, lang() === 'ru'))}</b></span>`);
    if (v.map) out.push(`<span class="mg-chip">${icon('map_treasure', '✕', 'ico-sm')}${esc(L('trek.map'))}</span>`);
    return out.length ? `<div class="mg-chips">${out.join('')}</div>` : '';
  }
}
