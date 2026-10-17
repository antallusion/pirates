// The shipyard's «Разведка» card (owner, 2026-10-17: «на личном острове в верфи можно строить специальные
// разведовательные корабли которые будут путешестровать по карте и открывать зоны … разведку надо сделать
// беслпатной»): her scouts, each with where she is and what is left of her voyage, «Авто — ближайший туман»,
// «Выбрать на карте» (the world map opens to take a tap on the fog), «Отозвать»; and the free «Построить разведчика».

import { SCOUT_HULL, SCOUT_NAMES } from '../../../shared/src/data/fog.ts';
import type { ScoutView, ScoutsView } from '../../../shared/src/fogproto.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/fog.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { esc } from './dom.ts';
import { scoutNow } from '../render/fog.ts';

export const LF = dict(EN, RU);

/** A scout's name in the player's language. */
export function scoutName(sc: { name: number }): string {
  return SCOUT_NAMES[sc.name % SCOUT_NAMES.length][lang() === 'ru' ? 1 : 0];
}

/** The server's wall clock now, by its view of the scouts. */
function wallNow(v: ScoutsView, at: number): number {
  return v.now + (performance.now() - at) * (v.rate || 1);
}

/** Her state as it stands now (one off the slipway since the view came is home). */
function stateNow(v: ScoutsView, sc: ScoutView, at: number): ScoutView['state'] {
  return sc.state === 'building' && (sc.ready ?? 0) <= wallNow(v, at) ? 'home' : sc.state;
}

function clock(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  const m = Math.floor(s / 60), r = s % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** When she is done (her voyage home, or the slipway), in the server's wall ms. */
function endOf(v: ScoutsView, sc: ScoutView): number {
  return sc.state === 'out' ? (sc.t0 ?? 0) + ((sc.total ?? 0) / v.speed) * 1000 : sc.ready ?? 0;
}

/** The card (empty without her island). */
export function scoutsCard(state: ClientState): string {
  const v = state.scouts;
  if (!v || !v.home) return '';
  const at = state.scoutsAt;
  const pct = Math.round((v.seen / Math.max(1, v.cells)) * 1000) / 10;
  const url = assetUrl(SHIP_CLASSES[SCOUT_HULL as ShipClassId]?.sprite ?? '');
  const pic = `<span class="sy-pic sy-pic-sm sc-pic">${url ? `<img src="${url}" alt="" draggable="false">` : ''}</span>`;
  const rows = v.list.map((sc) => {
    const st = stateNow(v, sc, at);
    const now = st === 'out' ? scoutNow(v, sc, at) : null;
    const left = (endOf(v, sc) - wallNow(v, at)) / 1000;
    const what = st === 'building' ? LF('building') : st === 'home' ? LF('home') : now?.home ? LF('back') : LF('out');
    const time = st === 'home' ? '' : ` · <span class="sc-left" data-scend="${endOf(v, sc)}">${esc(LF('left', { t: clock(left) }))}</span>`;
    const found = st === 'out' && sc.found ? `<span class="muted sc-found">${esc(LF('found', { n: sc.found }))}</span>` : '';
    const acts = st === 'home'
      ? `<button type="button" class="btn btn-small btn-primary" data-scauto="${esc(sc.id)}">${esc(LF('auto'))}</button><button type="button" class="btn btn-small" data-scpick="${esc(sc.id)}">${esc(LF('pick'))}</button>`
      : st === 'out' && !now?.home ? `<button type="button" class="btn btn-small" data-screcall="${esc(sc.id)}">${esc(LF('recall'))}</button>` : '';
    return `<div class="sc-row st-${st}">${pic}<div class="sc-id"><b>${esc(scoutName(sc))}</b><span class="sc-st">${esc(what)}${time}</span>${found}</div>${acts ? `<div class="sc-acts">${acts}</div>` : ''}</div>`;
  }).join('');
  const nextLv = v.yard < 3 ? 3 : v.yard < 5 ? 5 : 0;
  const build = !v.why
    ? `<button type="button" class="btn btn-small btn-primary sc-build" data-scbuild>${esc(LF('build'))}</button>`
    : `<p class="muted sc-why">${esc(serverText(v.why))}${v.yard && v.list.length >= v.max && nextLv ? ` ${esc(LF('more', { lv: nextLv }))}` : ''}</p>`;
  return `<div class="bupcard sc-card"><div class="row sc-head"><b>${esc(LF('title'))}</b><span class="sc-seen">${esc(LF('seen', { pct }))}</span></div>
    <p class="muted sc-lead">${esc(LF('lead'))} ${esc(LF('hull'))}</p>
    ${v.max ? `<div class="sc-slots muted">${esc(LF('slots', { n: v.list.length, max: v.max }))}</div>` : ''}${rows ? `<div class="sc-list">${rows}</div>` : ''}${build}</div>`;
}

/** Its buttons: the free build, «авто», the pick on the chart (`onPick`), the recall. */
export function bindScouts(root: HTMLElement, send: (m: ClientMsg) => void, onPick: (id: string) => void): void {
  root.querySelector<HTMLElement>('[data-scbuild]')?.addEventListener('click', () => send({ t: 'scout', action: 'build' }));
  root.querySelectorAll<HTMLElement>('[data-scauto]').forEach((b) => (b.onclick = () => send({ t: 'scout', action: 'auto', id: b.dataset.scauto })));
  root.querySelectorAll<HTMLElement>('[data-screcall]').forEach((b) => (b.onclick = () => send({ t: 'scout', action: 'recall', id: b.dataset.screcall })));
  root.querySelectorAll<HTMLElement>('[data-scpick]').forEach((b) => (b.onclick = () => onPick(b.dataset.scpick!)));
}

/** The card's clocks run on (from the island's tick); true when one ran out (the caller asks the server again). */
export function tickScouts(root: HTMLElement, state: ClientState): boolean {
  const v = state.scouts;
  if (!v) return false;
  const now = wallNow(v, state.scoutsAt);
  let due = false;
  root.querySelectorAll<HTMLElement>('[data-scend]').forEach((el) => {
    const left = (Number(el.dataset.scend) - now) / 1000;
    if (left <= 0) due = true;
    const t = LF('left', { t: clock(left) });
    if (el.textContent !== t) el.textContent = t;
  });
  return due;
}
