// The look of her ship (docs/12 P10 #12): one of sixty painted flags, the sails' pattern and its two colours, the
// hull's paint, the lanterns — a live preview, what is hers to choose and what is still shut (opened by deeds).

import { DEFAULT_LOOK, EMBLEM_COUNT, HULLS, LAMPS, LOOK_COLORS, SAILS, decodeLook, emblemName, encodeLook } from '../../../shared/src/data/looks.ts';
import type { Look } from '../../../shared/src/data/looks.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { flagCanvas } from '../render/flag.ts';
import type { ClientState } from '../state.ts';
import { esc } from './dom.ts';

const L = dict({
  title: 'The look of your ship',
  sub: 'Your flag flies over your ship for all to see. More is opened by deeds: a regatta, the Dutchman, a revenge, the wonders, the dice, the storm’s heart, a service’s ranks, a chain’s quests.',
  flag: 'Flag',
  colours: 'Sail colours',
  c1: 'Main',
  c2: 'Second',
  of: '{n} of {max} open',
  hull: 'Hull paint',
  sails: 'Sails',
  lamps: 'Lanterns',
  save: 'Fly these colours',
  port: 'The look is changed in port.',
  locked: 'Not yet yours',
}, {
  title: 'Облик корабля',
  sub: 'Ваш флаг виден над кораблём всем. Остальное открывается делами: регатой, Голландцем, местью, чудесами, костями, сердцем шторма, чинами службы, квестами цепочек.',
  flag: 'Флаг',
  colours: 'Цвета парусов',
  c1: 'Основной',
  c2: 'Второй',
  of: 'открыто {n} из {max}',
  hull: 'Краска корпуса',
  sails: 'Паруса',
  lamps: 'Фонари',
  save: 'Поднять эти цвета',
  port: 'Облик меняют в порту.',
  locked: 'Пока не открыто',
});

let draft: Look | null = null;
let colourSlot: 'c1' | 'c2' = 'c1';

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
  const flagsOpen = Array.from({ length: EMBLEM_COUNT }, (_, i) => i).filter((i) => have.has(`emblem:${i}`)).length;
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub'))}</div></div></div>
    <div class="modal-body looks">
      <div class="lk-preview"><canvas class="lk-flag" width="360" height="240" aria-label="${esc(L('flag'))}"></canvas><div class="lk-name">${esc(emblemName(d.emblem)[ru])}</div></div>
      <div class="lk-sections">
        <div class="giver-h">${esc(L('flag'))} <span class="muted lk-count">${esc(L('of', { n: flagsOpen, max: EMBLEM_COUNT }))}</span></div>
        <div class="lk-flags">${Array.from({ length: EMBLEM_COUNT }, (_, i) => chip('emblem', i, d.emblem === i, emblemName(i)[ru], `<canvas class="lk-thumb" data-fi="${i}" width="72" height="48"></canvas>`)).join('')}</div>
        <div class="giver-h">${esc(L('sails'))}</div><div class="lk-row">${SAILS.map((s, i) => chip('sail', i, d.sail === i, s[ru])).join('')}</div>
        <div class="giver-h">${esc(L('colours'))}</div>
        <div class="lk-row lk-slots">${(['c1', 'c2'] as const).map((k) => `<button class="lk-slot${colourSlot === k ? ' on' : ''}" data-slot="${k}">${swatch(LOOK_COLORS[d[k]].hex)}${esc(L(k))}</button>`).join('')}</div>
        <div class="lk-row">${LOOK_COLORS.map((c, i) => chip('color', i, d[colourSlot] === i, c.name[ru], swatch(c.hex))).join('')}</div>
        <div class="giver-h">${esc(L('hull'))}</div><div class="lk-row">${HULLS.map((h, i) => chip('hull', i, d.hull === i, h.name[ru], `${swatch(h.hex)}${esc(h.name[ru])}`)).join('')}</div>
        <div class="giver-h">${esc(L('lamps'))}</div><div class="lk-row">${LAMPS.map((l, i) => chip('lamp', i, d.lamp === i, l.name[ru], `<span class="lk-lamp" style="background:${l.color}"></span>${esc(l.name[ru])}`)).join('')}</div>
        <div class="lk-foot">${docked ? `<button class="btn btn-primary" data-lksave>${esc(L('save'))}</button>` : `<p class="muted">${esc(L('port'))}</p>`}</div>
      </div>
    </div>`;
  const cv = root.querySelector<HTMLCanvasElement>('.lk-flag');
  if (cv) cv.getContext('2d')!.drawImage(flagCanvas(d.emblem), 0, 0, cv.width, cv.height);
  root.querySelectorAll<HTMLCanvasElement>('[data-fi]').forEach((c) => c.getContext('2d')!.drawImage(flagCanvas(Number(c.dataset.fi)), 0, 0, c.width, c.height));
  const redo = () => renderLook(root, state, send);
  root.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) => (b.onclick = () => {
    colourSlot = b.dataset.slot as 'c1';
    redo();
  }));
  root.querySelectorAll<HTMLElement>('[data-lk]').forEach((b) => (b.onclick = () => {
    const i = Number(b.dataset.i);
    switch (b.dataset.lk) {
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
