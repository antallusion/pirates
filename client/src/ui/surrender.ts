// A ship strikes her colours to you (docs/16 #3): the choice card over the sea, without stopping it — let her go for
// her ransom, open her hold, take her as a prize for the court, or keep her as a trophy (docs/16 #5). It tells how
// close you must come and how long she will wait; it closes by itself when she is gone or thinks better of it.
// Also here: the words of a trophy ship's story, for the ship card and the berths.

import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { SF } from '../../../shared/src/protocol.ts';
import type { ClientMsg, SurrenderFate, SurrenderOffer } from '../../../shared/src/protocol.ts';
import type { TrophyHistory } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/colours.ts';
import { personName } from '../lang/names.ts';
import type { ClientState } from '../state.ts';
import { assetUrl } from '../assets.ts';
import { esc, fmt, icon } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);

const factionName = (f: string) => (f in FACTIONS ? FACTIONS[f as FactionId].short : f);
const roleName = (r: string | null | undefined) => (r && `role.${r}` in EN ? L(`role.${r}` as 'role.pirate') : r ?? '');

/** A trophy ship's story in one line (docs/16 #5). */
export function trophyLine(t: TrophyHistory): string {
  const date = new Date(t.at).toLocaleDateString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return L('trophy.line', {
    was: placeName(t.was), faction: factionName(t.faction), role: roleName(t.role) || SHIP_CLASSES[t.cls]?.name || t.cls,
    captain: t.captain ? L('trophy.captain', { name: personName(t.captain) }) : '', how: L(t.how === 'struck' ? 'trophy.struck' : 'trophy.boarded'),
    place: placeName(t.place ?? ''), region: REGIONS[t.region as RegionId]?.name ?? t.region, date, by: t.by,
  });
}

/** The trophy's card for the ship screen and the berths: the laurel, the word and her story. */
export function trophyCard(t: TrophyHistory): string {
  return `<div class="card trophy-card"><h4 class="card-h">${icon('build_trophy_hall', '', 'ico-md')}${esc(L('trophy.h'))}</h4><p>${esc(trophyLine(t))}</p></div>`;
}

/** A small tag by a trophy's name in a list, her story in its tooltip. */
export function trophyTag(t: TrophyHistory | undefined): string {
  return t ? ` <span class="trophy-tag" title="${esc(trophyLine(t))}">${icon('build_trophy_hall', '', 'ico-sm')}${esc(L('trophy.tag'))}</span>` : '';
}

export class SurrenderCard {
  private el: HTMLElement;
  private offer: SurrenderOffer | null = null;
  private hidden = false;
  private lastKey = '';
  private openedAt = 0;
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    this.el = document.getElementById('surrender')!;
  }

  /** The offer comes (or goes). */
  open(offer: SurrenderOffer | null): void {
    this.offer = offer;
    this.hidden = false;
    this.lastKey = '';
    this.openedAt = performance.now();
    if (!offer) this.close();
  }

  close(): void {
    this.offer = null;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
    this.lastKey = '';
  }

  get shown(): boolean {
    return !!this.offer && !this.hidden;
  }

  /** Every frame: the distance and the time left; gone when she is. */
  frame(state: ClientState): void {
    const o = this.offer;
    if (!o) return;
    const now = state.estServerTime();
    const her = state.ships.get(o.id);
    const docked = !!state.self?.dockedAt;
    if (!her || !(her.cur.flags & SF.SURRENDERED) || now > o.until + 2 || !state.you || docked) {
      // The card may come a moment before the snapshot that shows her struck: give it a second and a half.
      if (docked || now > o.until + 2 || performance.now() - this.openedAt > 1500) this.close();
      return;
    }
    if (this.hidden) return;
    const d = Math.round(Math.hypot(her.cur.x - state.you.x, her.cur.y - state.you.y));
    const near = d <= o.range;
    const left = Math.max(0, Math.ceil(o.until - now));
    const key = `${lang()}|${near ? 1 : 0}|${Math.round(d / 10)}|${left}`;
    if (key === this.lastKey) return;
    const first = this.lastKey === '';
    this.lastKey = key;
    if (!first) {
      // Only the live lines change: the buttons keep the pointer under them.
      const dl = this.el.querySelector('.sur-dist'), tl = this.el.querySelector('.sur-left');
      if (dl) {
        dl.className = `sur-dist ${near ? 'good' : 'warn'}`;
        dl.textContent = near ? L('sur.near', { n: d }) : L('sur.far', { range: o.range, n: d });
      }
      if (tl) tl.textContent = L('sur.left', { n: left });
      this.el.querySelectorAll<HTMLButtonElement>('button[data-sur]').forEach((b) => (b.disabled = !near || b.dataset.off === '1'));
      return;
    }
    const cls = SHIP_CLASSES[o.classId];
    const art = assetUrl(cls.sprite);
    const choice = (fate: SurrenderFate, ico: string, title: string, sub: string, off = false, primary = false) =>
      `<button class="btn choice sur-choice${primary ? ' btn-primary' : ''}" data-sur="${fate}" data-off="${off ? 1 : 0}"${!near || off ? ' disabled' : ''}>${icon(ico, '', 'choice-ico')}<span><b>${esc(title)}</b><small>${esc(sub)}</small></span></button>`;
    this.el.innerHTML = `<div class="enc-card sur-card">
      <div class="sur-head">${art ? `<img class="sur-ship" src="${art}" alt="" draggable="false" />` : ''}<div><div class="enc-h">${icon('talent_brd_surrender_terms', '', 'ico-md')}${esc(L('sur.title', { name: placeName(o.name) }))}</div>
      <div class="sur-sub muted">${esc(L('sur.sub', { cls: cls.name, faction: o.faction === 'player' ? '' : factionName(o.faction), role: roleName(o.role), captain: personName(o.captain) }))}</div></div></div>
      <p class="enc-text">${esc(L('sur.text'))} <span class="muted">${esc(o.cargo ? L('sur.hold', { n: o.cargo, gold: fmt(o.gold) }) : L('sur.holdEmpty', { gold: fmt(o.gold) }))}</span></p>
      <div class="sur-choices">
        ${choice('ransom', 'coin', L('sur.ransom'), L('sur.ransomSub', { sum: fmt(o.ransom) }), false, true)}
        ${choice('cargo', 'tab_market', L('sur.cargo'), L('sur.cargoSub'))}
        ${choice('prize', 'talent_brd_prize_crew', L('sur.prize'), o.prize ? L('sur.prizeSub', { crew: o.prize.crew, value: fmt(o.prize.value) }) : L('sur.noPrize'), !o.prize)}
        ${choice('trophy', 'build_trophy_hall', L('sur.trophy'), !o.prize ? L('sur.noPrize') : o.trophy ? L('sur.trophySub') : L('sur.noBerth'), !o.prize || !o.trophy)}
      </div>
      <div class="sur-foot"><span class="sur-dist ${near ? 'good' : 'warn'}">${esc(near ? L('sur.near', { n: d }) : L('sur.far', { range: o.range, n: d }))}</span><span class="sur-left muted">${esc(L('sur.left', { n: left }))}</span><button class="btn btn-small" data-sur-later>${esc(L('sur.later'))}</button></div>
    </div>`;
    this.el.classList.remove('hidden');
    this.el.querySelectorAll<HTMLButtonElement>('button[data-sur]').forEach((b) => (b.onclick = () => {
      this.el.querySelectorAll<HTMLButtonElement>('button[data-sur]').forEach((x) => (x.disabled = true));
      this.send({ t: 'surrender', id: o.id, fate: b.dataset.sur as SurrenderFate });
      // The server's answer closes the card (the offer goes); a refusal lets her be tried again.
      setTimeout(() => {
        if (this.offer === o) this.lastKey = '';
      }, 1500);
    }));
    this.el.querySelector<HTMLElement>('[data-sur-later]')!.onclick = () => {
      this.hidden = true;
      this.el.classList.add('hidden');
    };
  }
}
