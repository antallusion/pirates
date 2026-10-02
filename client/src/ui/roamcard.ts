// docs/19 D7: the small card of a roaming stack («Осмотреть»): its face and kind, HoMM3's word and the counts it may
// stand at (and what it is now), the creatures' gifts, what it leaves (the lesson besides the battle's, a little
// silver, their spoils; nothing to learn from a grey one), her party against it, HoMM3's offer at ×3. «Атаковать»
// from it; «Отпустить» when they would flee.

import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { ROAMS, roamGap, roamPay, roamRange } from '../../../shared/src/data/roamers.ts';
import { shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import type { RoamView } from '../../../shared/src/roamproto.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/roamers.ts';
import { roamName } from '../render/roamers.ts';
import type { ClientState } from '../state.ts';
import { specialName, strengthWord, unitIcon } from './army.ts';
import { askHtml } from './confirm.ts';
import { esc, fmt } from './dom.ts';

const L = dict(EN, RU);

const ratioText = (r: number): string => (r >= 10 ? String(Math.round(r)) : r.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 1 }));

/** The card's markup (the tests read it too). */
export function roamCardHtml(state: ClientState, v: RoamView): string {
  const u = ROAMS[v.kind].u as UnitId;
  const d = UNITS[u];
  const [a, b] = roamRange(v.kind, v.level);
  const w = strengthWord(v.n);
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  const gap = roamGap(mine, v.level);
  const pay = roamPay(v.level, v.size);
  const lines = [
    `<div class="rc-head">${unitIcon(u, 'army-face')}<div><b>${esc(L('c.title', { what: roamName(v.kind), lv: v.level }))}</b><div class="muted">${esc(L('c.count', { word: w.word, a, b, n: v.n }))}</div></div></div>`,
    `<div class="muted">${esc(d.specials.length ? L('c.specials', { list: d.specials.map(specialName).join(', ') }) : L('c.none'))}</div>`,
    `<div>${esc(gap > 0 ? L('c.pay', { x: fmt(Math.round(pay.xp * gap)), s: fmt(pay.silver) }) : L('c.grey'))}</div>`,
  ];
  if (v.ratio !== undefined) lines.push(`<div class="muted">${esc(L('c.ratio', { r: ratioText(v.ratio) }))}</div>`);
  if (v.offer === 'join' && v.joinN) lines.push(`<div class="ac-offer">${esc(L('c.join', { n: v.joinN }))}</div>`);
  if (v.offer === 'flee') lines.push(`<div class="ac-offer">${esc(L('c.flee'))} <button class="btn btn-small" data-roam-flee>${esc(L('c.let'))}</button></div>`);
  if (v.fight) lines.push(`<div class="ac-offer">${esc(L(v.fight === 'mate' ? 'i.mate' : 'i.fight', { what: roamName(v.kind) }))}</div>`);
  return `<div class="roam-card" id="confirm-text">${lines.join('')}</div>`;
}

/** The card over the sea; «Атаковать» sends the fight, «Отпустить» the HoMM3 flight. */
export async function openRoamCard(state: ClientState, v: RoamView, send: (action: 'attack' | 'flee', id: number) => void): Promise<void> {
  const p = askHtml(roamCardHtml(state, v), v.fight ? L('c.close') : L('a.attack'), v.fight ? null : L('c.close'), 'roam-panel');
  const flee = document.querySelector<HTMLButtonElement>('#confirm [data-roam-flee]');
  let fled = false;
  flee?.addEventListener('click', () => {
    fled = true;
    send('flee', v.id);
    document.querySelector<HTMLButtonElement>('#confirm [data-no]')?.click();
  });
  const ok = await p;
  if (ok && !fled && !v.fight) send('attack', v.id);
}
