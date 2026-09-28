// Storm chasers on the client (docs/12 P10 #14): the panel of a captain in the Storm of the Century (where its heart
// is, the charge she has gathered in its core, her hearts), and the Storm-Chaser forge at a yard.

import { STORM_FORGE, STORM_SLOTS } from '../../../shared/src/data/storms.ts';
import { compassPoint } from '../../../shared/src/data/companions.ts';
import { SETS, SLOT_NAMES } from '../../../shared/src/data/items.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { esc, icon, money } from './dom.ts';

const L = dict({
  panel: 'The heart of the storm',
  dist: '{m} m to the {dir}',
  inside: 'In its heart — hold on!',
  charge: 'Charge {n}/{need}',
  gone: 'Gone — another in {t}',
  hearts: 'Hearts: {n}',
  done: 'This storm has given you all it will.',
  forge: 'The Storm-Chaser forge',
  forgeText: 'Hearts of the storm are caught in the Storm of the Century: hold in its heart under the lightning (a lightning rod grounds most of it). Two hearts and silver make an epic piece of the Storm-Chaser set at her level; a ship’s tenth level wants one in her keel.',
  have: 'Hearts of the storm: {n}',
  make: 'Forge',
}, {
  panel: 'Сердце шторма',
  dist: '{m} м на {dir}',
  inside: 'Вы в сердце — держитесь!',
  charge: 'Заряд {n}/{need}',
  gone: 'Ушло — новое через {t}',
  hearts: 'Сердец: {n}',
  done: 'Этот шторм уже отдал вам всё, что мог.',
  forge: 'Штормовая кузня',
  forgeText: 'Сердца шторма ловят в шторм века: держитесь в его сердце под молниями (громоотвод уводит почти весь удар). Два сердца и серебро — эпическая вещь штормового комплекта вашего уровня; для ⚓10 корабля одно сердце идёт в киль.',
  have: 'Сердец шторма: {n}',
  make: 'Выковать',
});

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

/** The storm-chaser's panel: where the heart is, her charge, her hearts. Null outside a great storm. */
export function stormPanel(state: ClientState): string | null {
  const v = state.storm, own = state.ownDisplay;
  if (!v || !own || state.self?.dockedAt) return null;
  const d = Math.hypot(v.x - own.x, v.y - own.y);
  const dir = compassPoint(v.x - own.x, v.y - own.y)[lang() === 'ru' ? 1 : 0];
  let line: string;
  if (v.rest > 0) line = L('gone', { t: clock(v.rest) });
  else if (v.caught >= v.max) line = L('done');
  else if (d <= v.core) line = L('inside');
  else line = L('dist', { m: Math.round(d / 10) * 10, dir });
  const bar = v.charge > 0 && v.rest <= 0 ? `<div class="st-bar"><i style="width:${Math.min(100, Math.round((v.charge / v.need) * 100))}%"></i></div><div class="st-charge">${esc(L('charge', { n: v.charge, need: v.need }))}</div>` : '';
  return `<div class="fp-head"><b>${icon('weather_storm', '', 'ico-sm')}${esc(L('panel'))}</b><span class="hp-lvl">${esc(L('hearts', { n: v.hearts }))}</span></div>
    <div class="rg-next">${esc(line)}</div>${bar}`;
}

/** The Storm-Chaser forge at a yard of the second rank or better. */
export function stormForgeCard(state: ClientState): string {
  const self = state.self;
  if (!self) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  const n = self.stormHearts ?? 0;
  const can = n >= STORM_FORGE.hearts && self.gold >= STORM_FORGE.silver;
  const pieces = SETS.storm.pieces;
  return `<div class="card st-forge"><h4 class="card-h">${icon('storm_heart', '', 'ico-md')}${esc(L('forge'))}</h4>
    <p class="muted">${esc(L('forgeText'))}</p>
    <p class="st-have"><b>${esc(L('have', { n }))}</b> · ${esc(`${STORM_FORGE.hearts}`)} × ${icon('storm_heart', '', 'ico-sm')} + ${money(STORM_FORGE.silver)}</p>
    <div class="st-slots">${STORM_SLOTS.map((slot) => `<button class="btn btn-small" data-gstorm="${slot}" ${can ? '' : 'disabled'} title="${esc(SLOT_NAMES[slot][ru])}">${esc(pieces[slot]?.[ru] ?? SLOT_NAMES[slot][ru])}</button>`).join('')}</div></div>`;
}

export function bindStormForge(root: HTMLElement, send: (m: ClientMsg) => void): void {
  root.querySelectorAll<HTMLElement>('[data-gstorm]').forEach((b) => (b.onclick = () => send({ t: 'gear', action: 'storm', slot: b.dataset.gstorm as never })));
}
