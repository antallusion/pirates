// docs/25 item 64 on the sea: a mate of her group boards (or is boarded) within reach — a small card in the top band
// (never the middle): who and against whom, her stacks to bring (her strongest picked; a tap takes one or leaves it,
// one or two as the level allows), «На абордаж» and «Не сейчас», and whether she comes at once next time. It goes when
// the fight is past the round she may still come at, or when she has come aboard.

import type { BoardOffer, ClientMsg } from '../../../shared/src/protocol.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/boardgroup.ts';
import { personName } from '../lang/names.ts';
import { esc, icon } from './dom.ts';
import { placeName } from './maps.ts';
import { unitIcon, unitName } from './army.ts';

const L = dict(EN, RU);

export class BoardOfferCard {
  private el: HTMLElement;
  private offer: BoardOffer | null = null;
  private pick: string[] = [];
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    let el = document.getElementById('board-offer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'board-offer';
      el.className = 'hidden';
      el.setAttribute('role', 'dialog');
      document.body.appendChild(el);
    }
    this.el = el;
  }

  get shown(): boolean {
    return !!this.offer;
  }

  open(offer: BoardOffer | null): void {
    this.offer = offer;
    if (!offer) return this.close();
    this.pick = [...offer.bring];
    this.draw();
  }

  close(): void {
    this.offer = null;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  private draw(): void {
    const o = this.offer;
    if (!o) return;
    const title = L(o.side === 0 ? 'title' : 'titleDef', { mate: personName(o.mate), foe: placeName(o.foe) });
    const sub = o.round > 0 ? L('round', { n: o.round }) : L(o.n > 1 ? 'sub' : 'sub1', { n: o.n, last: o.last });
    const chips = o.army.map((x) => {
      const on = this.pick.includes(x.u);
      const name = `${unitName(x.u as UnitId)} ×${x.n}`;
      return `<button class="bo-st${on ? ' on' : ''}" data-u="${esc(x.u)}" aria-pressed="${on}" title="${esc(`${L('pick')}: ${name}`)}" aria-label="${esc(name)}">${unitIcon(x.u as UnitId, 'bo-ico')}<b>${x.n}</b></button>`;
    }).join('');
    this.el.className = '';
    this.el.setAttribute('aria-label', title);
    this.el.innerHTML = `<div class="bo-card">
      <div class="bo-h">${icon('icon.bt_charge', '', 'ico-sm')}<b>${esc(title)}</b><button class="bo-x" data-no title="${esc(L('no'))}" aria-label="${esc(L('no'))}">✕</button></div>
      <div class="bo-sub">${esc(sub)}</div>
      <div class="bo-row"><div class="bo-sts">${chips}</div>
      <label class="bo-auto" title="${esc(L('auto'))}"><input type="checkbox" data-auto${o.auto ? ' checked' : ''} /><span>${esc(L('auto'))}</span></label>
      <button class="k-btn k-btn--primary bo-go" data-go>${esc(L('join'))}</button></div></div>`;
    this.el.querySelectorAll<HTMLElement>('[data-u]').forEach((b) => (b.onclick = () => {
      const u = b.dataset.u!;
      if (this.pick.includes(u)) this.pick = this.pick.filter((x) => x !== u);
      else {
        this.pick.push(u);
        while (this.pick.length > o.n) this.pick.shift();
      }
      this.draw();
    }));
    this.el.querySelector<HTMLElement>('[data-go]')!.onclick = () => {
      const auto = this.el.querySelector<HTMLInputElement>('[data-auto]')?.checked ?? false;
      this.send({ t: 'board_assist', auto, bring: this.pick });
      this.send({ t: 'board_join', with: o.with, bring: this.pick });
      this.close();
    };
    this.el.querySelector<HTMLElement>('[data-no]')!.onclick = () => {
      const auto = this.el.querySelector<HTMLInputElement>('[data-auto]')?.checked ?? false;
      if (auto !== o.auto) this.send({ t: 'board_assist', auto });
      this.send({ t: 'board_join', with: o.with, no: true });
      this.close();
    };
  }
}
