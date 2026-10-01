// The creatures' window (docs/18 #37–#42): the creature kinds of her army — their people, their food a minute and how
// long they have gone unfed, their rank and the wins to the next; the food in her hold and what they eat an hour; the
// morale of a mixed army and its peoples (the path's own marked); the pen of her island (send them there, take them
// back, lying off it); a port's tamer (sell hers, buy from the tamer's pens). The server decides; the window asks.

import type { UnitId } from '../../../shared/src/data/army.ts';
import { HUNGRY_AFTER, PEOPLE_NAME, RANK_NAME, SLIP_AFTER } from '../../../shared/src/data/drifts.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/drifts.ts';
import type { ClientState } from '../state.ts';
import { unitIcon, unitName } from './army.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);

function stars(r: number): string {
  return `<span class="tm-stars">${'★'.repeat(r)}${'☆'.repeat(3 - r)}</span>`;
}

export class TameWindow {
  private send: (m: ClientMsg) => void;
  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  open(): void {
    this.send({ t: 'drift', action: 'tame' });
  }

  render(root: HTMLElement, state: ClientState): void {
    const v = state.tame;
    const head = `<div class="modal-head"><div><h2>${icon('build_kennel', '', 'ico-md')}${esc(L('title'))}</h2><div class="sub">${esc(L('sub'))}</div></div>
      ${v ? `<div class="rc-chips"><span class="ph-chip gold">${money(v.gold)}</span><span class="ph-chip">${icon('stat_crew', '', 'ico-sm')}${v.crew}/${v.crewMax}</span><span class="ph-chip">${v.stacksN}/${v.slots}</span></div>` : ''}</div>`;
    if (!v) {
      root.innerHTML = `${head}<div class="modal-body"><p class="muted">${esc(L('none'))}</p></div>`;
      return;
    }
    const rows = v.stacks.map((x) => {
      const status = x.hunger >= SLIP_AFTER ? `<span class="bad">${esc(L('starving'))}</span>` : x.hunger >= HUNGRY_AFTER ? `<span class="warn">${esc(L('hungry', { m: Math.max(1, Math.round(x.hunger / 60)) }))}</span>` : `<span class="good">${esc(L('fed'))}</span>`;
      const people = v.peoples.find((p) => p.p === x.people);
      const rank = x.rank ? RANK_NAME[x.rank][ru()] : L('rank.0');
      const sell = v.tamer?.buys.find((b) => b.u === x.u);
      const acts = [
        `<button class="btn btn-small" data-tm="release" data-u="${x.u}" data-n="${x.n}">${esc(L('release'))}</button>`,
        v.pen?.here ? `<button class="btn btn-small" data-tm="topen" data-u="${x.u}" data-n="${x.n}">${esc(L('topen'))}</button>` : '',
        sell ? `<button class="btn btn-small btn-primary" data-tm="sell" data-u="${x.u}" data-n="${x.n}">${esc(L('sell'))} ×${x.n} · ${money(sell.price * x.n)}</button>` : '',
      ].join('');
      return `<div class="tm-row">${unitIcon(x.u, 'army-face-sm')}<div class="tm-t"><b>${esc(unitName(x.u))} <span class="muted">×${x.n}</span></b>
        <span class="muted">${esc(PEOPLE_NAME[x.people][ru()])}${people?.native ? ` · <span class="good">${esc(L('native'))}</span>` : ''} · ${esc(L('per', { n: String(x.perMin).replace('.', ru() ? ',' : '.'), food: L(`food.${x.food}` as 'food.fish') }))} · ${status}</span>
        <span class="muted">${stars(x.rank)} ${esc(rank)} · ${esc(x.next ? L('rank.next', { n: x.next }) : L('rank.top'))}</span></div><div class="tm-acts">${acts}</div></div>`;
    }).join('');
    const morale = v.morale < 0 ? `<b class="bad">${esc(L('morale', { m: v.morale }))}</b>` : `<span class="good">${esc(L('morale.ok'))}</span>`;
    const peoples = v.peoples.map((p) => `<span class="ph-chip${p.native ? ' good' : ''}">${esc(PEOPLE_NAME[p.p][ru()])} ${p.n}</span>`).join('');
    const food = v.stacks.length ? `<div class="card tm-card"><p>${esc(L('store', { fish: fmt(v.food.fish), rum: fmt(v.food.rum), bone: fmt(v.food.bone) }))}</p><p class="muted">${esc(L('upkeep', { fish: String(v.perHour.fish).replace('.', ru() ? ',' : '.'), rum: String(v.perHour.rum).replace('.', ru() ? ',' : '.'), s: fmt(v.silverHour) }))}</p>
      <p>${morale}</p><div class="tm-peoples"><span class="muted">${esc(L('peoples'))}:</span> ${peoples}</div></div>` : '';
    let pen = '';
    if (v.pen) {
      const stock = v.pen.stock.map((x) => `<div class="tm-row">${unitIcon(x.u, 'army-face-sm')}<div class="tm-t"><b>${esc(unitName(x.u))} <span class="muted">×${x.n}</span></b></div><div class="tm-acts">${v.pen!.here ? `<button class="btn btn-small btn-primary" data-tm="frompen" data-u="${x.u}" data-n="${x.n}">${esc(L('frompen'))}</button>` : ''}</div></div>`).join('') || `<p class="muted">${esc(L('pen.empty'))}</p>`;
      pen = `<div class="card tm-card"><h4 class="card-h">${icon('build_kennel', '', 'ico-md')}${esc(L('pen.title'))} <span class="muted">${esc(L('pen.load', { load: v.pen.load, cap: v.pen.cap }))}</span></h4>${v.pen.here ? '' : `<p class="muted">${esc(L('pen.away'))}</p>`}${stock}</div>`;
    } else pen = `<div class="card tm-card"><p class="muted">${esc(L('pen.none'))}</p></div>`;
    let tamer = '';
    if (v.tamer) {
      const sells = v.tamer.sells.map((x) => `<div class="tm-row">${unitIcon(x.u, 'army-face-sm')}<div class="tm-t"><b>${esc(unitName(x.u))} <span class="muted">×${x.n}</span></b><span class="muted">${esc(L('each', { s: fmt(x.price) }))}</span></div><div class="tm-acts"><button class="btn btn-small btn-primary" data-tm="buy" data-u="${x.u}" data-n="${x.n}"${x.n > 0 && v.gold >= x.price ? '' : ' disabled'}>${esc(L('buy'))} ×${x.n}</button></div></div>`).join('') || `<p class="muted">${esc(L('tamer.nothing'))}</p>`;
      tamer = `<div class="card tm-card"><h4 class="card-h">${icon('build_kennel', '', 'ico-md')}${esc(L('tamer.title', { port: placeName(v.tamer.port) }))}</h4><h5 class="est-h">${esc(L('tamer.sells'))}</h5>${sells}</div>`;
    }
    root.innerHTML = `${head}<div class="modal-body tm-body">
      ${rows ? `<div class="card tm-card">${rows}</div>` : `<p class="muted">${esc(L('none'))}</p>`}
      ${food}${tamer}${pen}
      <p class="muted tm-rules">${esc(L('rules'))}</p></div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-tm]').forEach((b) => (b.onclick = () => this.send({ t: 'drift', action: b.dataset.tm as 'release', u: b.dataset.u as UnitId, n: Number(b.dataset.n) })));
  }
}
