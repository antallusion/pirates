// A stormed lair's chest (docs/16 #7): what the landing party carried off — the silver, the prisoners freed, a piece
// of the captain's gear and the map from her chart table — on a card over the sea, like the terms of a struck ship.

import { RARITY_COLOR } from '../../../shared/src/data/items.ts';
import type { LairChestView } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/livesea.ts';
import { personName } from '../lang/names.ts';
import { serverText } from '../lang/server.ts';
import { esc, fmt, icon } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);

export class LairChestCard {
  private el: HTMLElement;
  private timer = 0;

  constructor() {
    this.el = document.getElementById('lairchest')!;
  }

  open(v: LairChestView): void {
    const art = assetUrl('prop.cache');
    const row = (ico: string, text: string, style = '') => `<li>${icon(ico, '', 'ico-md')}<span${style}>${text}</span></li>`;
    this.el.innerHTML = `<div class="enc-card lc-card">
      <div class="lc-head">${art ? `<img class="lc-art" src="${art}" alt="" draggable="false" />` : ''}<div><div class="enc-h">${esc(L('chest.title', { captain: personName(v.captain) }))}</div>
      <div class="lc-sub muted">${esc(L('chest.sub', { island: placeName(v.island) }))}</div></div></div>
      <ul class="lc-list">
        ${row('coin', esc(L('chest.silver', { n: fmt(v.silver) })))}
        ${row('talent_brd_prize_crew', esc(L('chest.prisoners', { n: v.prisoners })))}
        ${v.item ? row(`item_${v.item.base}`, esc(serverText(v.item.name)), ` style="color:${RARITY_COLOR[v.item.rarity as keyof typeof RARITY_COLOR] ?? '#ddd'}"`) : row('item_cutlass', esc(L('chest.noItem')), ' class="muted"')}
        ${v.map ? row('map_treasure', esc(L('chest.map', { name: serverText(v.map) }))) : row('map_treasure', esc(L('chest.noMap')), ' class="muted"')}
      </ul>
      <div class="lc-foot"><button class="btn btn-primary" data-lc-close>${esc(L('chest.take'))}</button></div>
    </div>`;
    this.el.classList.remove('hidden');
    this.el.querySelector<HTMLButtonElement>('[data-lc-close]')!.onclick = () => this.close();
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.close(), 30_000);
  }

  close(): void {
    clearTimeout(this.timer);
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }
}
