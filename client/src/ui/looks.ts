// The look of her ship (docs/12 P10 #12): the flag (field, three colours, one of sixty emblems), the hull's paint, the
// sails' pattern, the lanterns — a live preview, what is hers to choose and what is still shut (opened by deeds).

import { DEFAULT_LOOK, EMBLEM_COUNT, FIELDS, GLYPHS, HULLS, LAMPS, LOOK_COLORS, SAILS, decodeLook, emblemName, encodeLook } from '../../../shared/src/data/looks.ts';
import type { Look } from '../../../shared/src/data/looks.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { paintFlag } from '../render/flag.ts';
import type { ClientState } from '../state.ts';
import { esc } from './dom.ts';

const L = dict({
  title: 'The look of your ship',
  sub: 'Your flag flies over your ship for all to see. More is opened by deeds: a regatta, the Dutchman, a revenge, the wonders, the dice, a chain’s quests.',
  flag: 'Flag',
  field: 'Field',
  colours: 'Colours',
  c1: 'Field',
  c2: 'Second',
  c3: 'Emblem',
  emblem: 'Emblem',
  hull: 'Hull paint',
  sails: 'Sails',
  lamps: 'Lanterns',
  save: 'Fly these colours',
  port: 'The look is changed in port.',
  locked: 'Not yet yours',
}, {
  title: 'Облик корабля',
  sub: 'Ваш флаг виден над кораблём всем. Остальное открывается делами: регатой, Голландцем, местью, чудесами, костями, квестами цепочек.',
  flag: 'Флаг',
  field: 'Поле',
  colours: 'Цвета',
  c1: 'Поле',
  c2: 'Второй',
  c3: 'Эмблема',
  emblem: 'Эмблема',
  hull: 'Краска корпуса',
  sails: 'Паруса',
  lamps: 'Фонари',
  save: 'Поднять эти цвета',
  port: 'Облик меняют в порту.',
  locked: 'Пока не открыто',
});

let draft: Look | null = null;
let colourSlot: 'c1' | 'c2' | 'c3' = 'c1';

export function renderLook(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const self = state.self;
  if (!self) return;
  const ru = lang() === 'ru' ? 1 : 0;
  const have = new Set(self.unlocks ?? []);
  const cur = decodeLook(self.look) ?? DEFAULT_LOOK;
  if (!draft) draft = { ...cur };
  const d = draft;
  const docked = !!self.dockedAt;
  const chip = (kind: string, i: number, on: boolean, label: string, inner = '') => {
    const open = have.has(`${kind}:${i}`);
    return `<button class="lk-chip${on ? ' on' : ''}${open ? '' : ' locked'}" data-lk="${kind}" data-i="${i}" ${open ? '' : 'disabled'} title="${esc(open ? label : `${label} — ${L('locked')}`)}" aria-label="${esc(label)}">${inner || esc(label)}</button>`;
  };
  const swatch = (hex: string | null) => `<span class="lk-sw" style="background:${hex ?? 'linear-gradient(135deg,#5a4028,#2a1d12)'}"></span>`;
  const glyphSvg = (i: number) => {
    const g = GLYPHS[Math.floor(i / 3)], st = i % 3;
    const body = st === 1 ? `<path d="${g.d}" fill="none" stroke="currentColor" stroke-width="7"/>` : st === 2 ? `<circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="6"/><g transform="translate(18 18) scale(0.64)"><path d="${g.d}" fill="currentColor" fill-rule="evenodd"/></g>` : `<path d="${g.d}" fill="currentColor" fill-rule="evenodd"/>`;
    return `<svg viewBox="0 0 100 100" class="lk-glyph">${body}</svg>`;
  };
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub'))}</div></div></div>
    <div class="modal-body looks">
      <div class="lk-preview"><canvas class="lk-flag" width="240" height="150" aria-label="${esc(L('flag'))}"></canvas></div>
      <div class="lk-sections">
        <div class="giver-h">${esc(L('field'))}</div><div class="lk-row">${FIELDS.map((f, i) => chip('field', i, d.field === i, f[ru])).join('')}</div>
        <div class="giver-h">${esc(L('colours'))}</div>
        <div class="lk-row lk-slots">${(['c1', 'c2', 'c3'] as const).map((k) => `<button class="lk-slot${colourSlot === k ? ' on' : ''}" data-slot="${k}">${swatch(LOOK_COLORS[d[k]].hex)}${esc(L(k))}</button>`).join('')}</div>
        <div class="lk-row">${LOOK_COLORS.map((c, i) => chip('color', i, d[colourSlot] === i, c.name[ru], swatch(c.hex))).join('')}</div>
        <div class="giver-h">${esc(L('emblem'))}</div><div class="lk-row lk-emblems">${Array.from({ length: EMBLEM_COUNT }, (_, i) => chip('emblem', i, d.emblem === i, emblemName(i)[ru], glyphSvg(i))).join('')}</div>
        <div class="giver-h">${esc(L('hull'))}</div><div class="lk-row">${HULLS.map((h, i) => chip('hull', i, d.hull === i, h.name[ru], `${swatch(h.hex)}${esc(h.name[ru])}`)).join('')}</div>
        <div class="giver-h">${esc(L('sails'))}</div><div class="lk-row">${SAILS.map((s, i) => chip('sail', i, d.sail === i, s[ru])).join('')}</div>
        <div class="giver-h">${esc(L('lamps'))}</div><div class="lk-row">${LAMPS.map((l, i) => chip('lamp', i, d.lamp === i, l.name[ru], `<span class="lk-lamp" style="background:${l.color}"></span>${esc(l.name[ru])}`)).join('')}</div>
        <div class="lk-foot">${docked ? `<button class="btn btn-primary" data-lksave>${esc(L('save'))}</button>` : `<p class="muted">${esc(L('port'))}</p>`}</div>
      </div>
    </div>`;
  const cv = root.querySelector<HTMLCanvasElement>('.lk-flag');
  if (cv) paintFlag(cv.getContext('2d')!, d, cv.width, cv.height);
  const redo = () => renderLook(root, state, send);
  root.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) => (b.onclick = () => {
    colourSlot = b.dataset.slot as 'c1';
    redo();
  }));
  root.querySelectorAll<HTMLElement>('[data-lk]').forEach((b) => (b.onclick = () => {
    const i = Number(b.dataset.i);
    switch (b.dataset.lk) {
      case 'field': d.field = i; break;
      case 'color': d[colourSlot] = i; break;
      case 'emblem': d.emblem = i; break;
      case 'hull': d.hull = i; break;
      case 'sail': d.sail = i; break;
      case 'lamp': d.lamp = i; break;
    }
    redo();
  }));
  root.querySelector<HTMLElement>('[data-lksave]')?.addEventListener('click', () => send({ t: 'look', look: encodeLook(d) }));
}

/** When the window closes, the draft goes (the next opening starts from what she flies). */
export function resetLookDraft(): void {
  draft = null;
}
