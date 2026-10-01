// «My island» → Supply (docs/18 #32): the lair islands she has claimed, each with its kind, level, its week's
// resource and its distance from her island; a button links it to her island (a supply route, up to three) or cuts the
// route; the next delivery's countdown (the first dawn of the sea's next week).

import { ISLE_TYPE_DEFS } from '../../../shared/src/world/archipelago.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { THREAT_COLOR, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import { dict, lang } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import { EN, RU } from '../lang/ui/isles18.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);

function hm(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}` : lang() === 'ru' ? `${m} мин` : `${m} min`;
}

export function supplyTab(state: ClientState): string {
  const v = state.supply;
  const ru = lang() === 'ru' ? 1 : 0;
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  if (!v) return `<p class="muted">…</p>`;
  const linked = v.isles.filter((s) => s.linked).length;
  const head = `<div class="sup-head"><h3>${esc(L('sup.title'))}</h3><p class="muted">${esc(L('sup.intro'))}</p>
    <div class="sup-meta">${v.home ? `<span>${icon('tab_isles', '', 'ico-sm')}${esc(L('sup.home', { name: placeName(v.home.name) }))}</span>` : `<span class="bad">${esc(L('sup.noHome'))}</span>`}<span>${esc(L('sup.count', { n: linked, max: v.max }))}</span><span>${esc(L('sup.next', { t: hm(v.nextIn) }))}</span></div></div>`;
  if (!v.isles.length) return `${head}<p class="muted sup-none">${esc(L('sup.none'))}</p>`;
  const rows = v.isles.map((s) => {
    const km = v.home ? Math.round(Math.hypot(s.x - v.home.x, s.y - v.home.y) / 1000) : null;
    const good = GOODS[s.good as GoodId];
    const meta = [ISLE_TYPE_DEFS[s.type].name[ru], L(`sup.kind.${s.kind}` as 'sup.kind.pirate'), km !== null ? L('sup.km', { n: km }) : ''].filter(Boolean).join(' · ');
    const btn = s.linked
      ? `<button class="btn btn-small" data-sup-unlink="${s.island}">${esc(L('sup.unlink'))}</button>`
      : `<button class="btn btn-small btn-primary" data-sup-link="${s.island}"${s.why ? ` disabled title="${esc(serverText(s.why))}"` : ''}>${esc(L('sup.link'))}</button>`;
    return `<div class="sup-row${s.linked ? ' on' : ''}"><div class="sup-name"><b>${esc(placeName(s.name))}</b> <b style="color:${THREAT_COLOR[threatOf(mine, s.level)]}">⚓${s.level}</b><span class="muted">${esc(meta)}</span></div>
      <div class="sup-good">${icon(`good_${s.good}`, '', 'ico-sm')}<span>${esc(L('sup.week', { n: s.n }))} · ${esc(good ? good.name : s.good)}</span>${s.linked ? `<span class="good">${esc(L('sup.linked'))}${s.last ? ` · ${esc(L('sup.last', { n: s.last }))}` : ''}</span>` : s.why ? `<span class="muted">${esc(serverText(s.why))}</span>` : ''}</div>${btn}</div>`;
  }).join('');
  return `${head}<div class="sup-list">${rows}</div>`;
}

export function bindSupply(root: HTMLElement, send: (m: ClientMsg) => void): void {
  root.querySelectorAll<HTMLElement>('[data-sup-link]').forEach((b) => (b.onclick = () => send({ t: 'isle18', action: 'link', island: Number(b.dataset.supLink) })));
  root.querySelectorAll<HTMLElement>('[data-sup-unlink]').forEach((b) => (b.onclick = () => send({ t: 'isle18', action: 'unlink', island: Number(b.dataset.supUnlink) })));
}
