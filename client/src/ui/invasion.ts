// docs/19 E16 on screen: the Choir's invasion as a common cause of the sea — its card in the chart's log, the
// journal and the tavern (the region and its wave, the bar of the Choir's ships fallen, her own part, the time left,
// the busiest hands, «Проложить курс»), the black tide's card; and the sea's dark veil while she sails a region under
// the black tide. The chart's marks are drawn by worldmap.ts.

import type { InvasionView } from '../../../shared/src/data/invasions.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/relics.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);
const region = (r: keyof typeof REGIONS) => placeName(REGIONS[r].name);
const mins = (s: number) => Math.max(1, Math.ceil(s / 60));

function body(v: InvasionView, course: boolean): string {
  const c = v.cur;
  let cur = '';
  if (c) {
    const pct = Math.min(100, (c.beaten / Math.max(1, c.total)) * 100);
    const head = c.stage === 'warn' ? L('inv.warn', { region: region(c.region), m: mins(c.endsIn) }) : L('inv.on', { region: region(c.region), n: c.wave, w: c.waves });
    const tail = c.stage === 'warn' ? '' : `${esc(L('inv.mine', { n: c.mine }))} · ${esc(L('inv.left', { m: mins(c.endsIn) }))}`;
    const lead = c.leaders.length ? `<div class="cm-leaders muted">${c.leaders.map((x) => `<b>${esc(x.name)}</b> ${x.n}`).join(' · ')}</div>` : '';
    cur = `<div class="inv-cur" title="${esc(L('inv.hint'))}"><div class="cm-text">${esc(head)} <span class="muted">⚓${c.level}</span></div>
      <div class="cm-bar inv-bar"><i style="width:${pct.toFixed(1)}%"></i><span>${esc(L('inv.bar', { n: c.beaten, m: c.total }))}</span></div>
      ${tail ? `<div class="dl-foot muted">${tail}</div>` : ''}${lead}${course ? `<button type="button" class="btn btn-small inv-go" data-invcourse="${c.x},${c.y}">${esc(L('inv.course'))}</button>` : ''}</div>`;
  }
  const tides = v.tides.map((t) => `<div class="inv-tide"><b>${esc(L('inv.tide', { region: region(t.region) }))}</b><span class="muted">${esc(L('inv.tideText', { h: Math.max(1, Math.ceil(t.endsIn / 3600)) }))}</span></div>`).join('');
  return cur + tides;
}

/** The chart's log and the journal: the invasion afoot and the black tides (nothing when the sea is quiet). */
export function invasionLog(v: InvasionView | undefined, course = true): string {
  if (!v || (!v.cur && !v.tides.length)) return '';
  return `<div class="map-daily inv-card"><div class="mq-head">${icon('faction_choir', '', 'ico-sm')}${esc(L('inv.title'))}</div>${body(v, course)}</div>`;
}

/** The tavern's card (in port: no course to set). */
export function invasionCard(v: InvasionView | undefined): string {
  if (!v || (!v.cur && !v.tides.length)) return '';
  return `<div class="card common inv-card"><h4 class="card-h">${icon('faction_choir', '', 'ico-md')}${esc(L('inv.title'))}</h4>${body(v, false)}</div>`;
}

/** «Проложить курс» on a card: the autosail to where the Choir comes. */
export function bindInvasion(root: HTMLElement, sail: (x: number, y: number) => void): void {
  root.querySelectorAll<HTMLElement>('[data-invcourse]').forEach((b) => (b.onclick = () => {
    const [x, y] = (b.dataset.invcourse ?? '').split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) sail(x, y);
  }));
}

/** The sea's dark veil while she sails a region under the black tide (a fixed layer between the sea and the HUD). */
let veil: HTMLElement | null = null;
export function tideVeil(state: ClientState): void {
  const on = !!state.self && !state.self.dockedAt && !!state.self.invasion?.tides.some((t) => t.region === state.region);
  if (!veil) {
    if (!on) return;
    veil = document.createElement('div');
    veil.id = 'black-tide';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
  }
  veil.classList.toggle('on', on);
}
