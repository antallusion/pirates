// The ship's army on screen (docs/17 H1): HoMM3's row of army slots — each stack's painted face with its count in the
// corner, the upgraded kinds in a gold frame, the empty slots of her class left open — the names and specials of the
// kinds of men, and the word for an army seen from afar («Горстка… Тьма»).

import { EN as DEN, RU as DRU } from '../lang/ui/drifts.ts';
import { ARMY_WORD_MIN, UNITS, armyWord } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId, UnitSpecial } from '../../../shared/src/data/army.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/army.ts';
import { BEAST_TINT } from '../../../shared/src/data/bestiary.ts';
import type { BeastId } from '../../../shared/src/data/bestiary.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);
const DL = dict(DEN, DRU);
type K = keyof typeof EN;

export const unitName = (u: UnitId): string => L(`u.${u}` as K);
export const unitNote = (u: UnitId): string => L(`ud.${u}` as K);
export const specialName = (s: UnitSpecial): string => L(`sp.${s}` as K);
export const specialNote = (s: UnitSpecial): string => L(`spd.${s}` as K);
export const unitArt = (u: UnitId): string => UNITS[u]?.art ?? 'icon.prof_sailor';

/** A kind's face as an image: a creature with no picture of its own is a token of one that is, tinted and framed
 *  (docs/18 II, BEAST_TINT). */
export function unitIcon(u: UnitId, cls: string): string {
  const tint = BEAST_TINT[u as BeastId];
  const html = icon(unitArt(u), '', `${cls}${UNITS[u]?.beast ? ' beast-face' : ''}${tint ? ' beast-tok' : ''}`);
  return tint ? html.replace('<img ', `<img style="filter:${tint}" `) : html;
}

/** HoMM3's word for an army of `men`, and the head counts it stands for. */
export function strengthWord(men: number): { word: string; range: string } {
  const w = armyWord(Math.max(1, men));
  const i = ARMY_WORD_MIN.findIndex((m, k) => men >= m && (k === ARMY_WORD_MIN.length - 1 || men < ARMY_WORD_MIN[k + 1]));
  const a = ARMY_WORD_MIN[Math.max(0, i)], b = ARMY_WORD_MIN[Math.max(0, i) + 1];
  return { word: L(`w.${w}` as K), range: b ? L('w.range', { a, b: b - 1 }) : L('w.more', { a }) };
}

/** One slot: the face, the count badge, the tier's pips. */
export function armySlot(s: ArmyStack | null, cls = ''): string {
  if (!s) return `<div class="army-slot empty ${cls}" title="${esc(L('empty'))}"></div>`;
  const d = UNITS[s.u];
  const tip = `${unitName(s.u)} ×${s.n} — ${L('tier', { n: d.tier })}${d.up ? `, ${L('up')}` : ''}. ${unitNote(s.u)}${d.specials.length ? ` ${L('specials')}: ${d.specials.map(specialName).join(', ')}.` : ''}`;
  return `<div class="army-slot t${d.tier}${d.up ? ' up' : ''} ${cls}" title="${esc(tip)}">${unitIcon(s.u, 'army-face')}<b class="army-n">${s.n}</b><i class="army-tier">${'•'.repeat(d.tier)}</i></div>`;
}

/** The row of her class's slots, filled from the strongest. */
export function armyRow(army: readonly ArmyStack[], slots: number, cls = ''): string {
  const out: string[] = [];
  for (let i = 0; i < Math.max(slots, army.length); i++) out.push(armySlot(army[i] ?? null, cls));
  return `<div class="army-row">${out.join('')}</div>`;
}

/** The army's card for the crew screen: the slots, the head count, what each kind is. */
export function armyPanel(army: readonly ArmyStack[], slots: number): string {
  const men = army.reduce((n, s) => n + s.n, 0);
  const list = army.map((s) => {
    const d = UNITS[s.u];
    return `<div class="army-line">${unitIcon(s.u, 'army-face-sm')}<div class="item-text"><b>${esc(unitName(s.u))} <span class="muted">×${s.n}</span></b><span class="muted">${esc(L('tier', { n: d.tier }))}${d.up ? ` · ${esc(L('up'))}` : ''} · ${esc(L('stat', { atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp }))}${d.specials.length ? ` · ${esc(d.specials.map(specialName).join(', '))}` : ''}</span></div></div>`;
  }).join('');
  // docs/18 IV: the creatures aboard — their own window (food, ranks, the pen, the tamer).
  const beasts = army.some((x) => UNITS[x.u]?.beast) ? `<button class="btn btn-small army-tame" data-tame>${icon('build_kennel', '', 'ico-sm')}${esc(DL('open'))}</button>` : '';
  return `<div class="card army-card"><h4 class="card-h">${icon('prof_marine', '', 'ico-md')}${esc(L('title'))} <span class="muted army-sum">${esc(L('men', { n: men }))} · ${esc(L('slots', { n: army.length, slots }))}</span>${beasts}</h4>
    ${armyRow(army, slots)}
    <div class="army-list">${list}</div>
    <p class="muted army-hint">${esc(L('hint'))}</p></div>`;
}

/** Her army at a glance for the target frame: the word, the counts it stands for, the faces of her kinds. */
export function armyGlance(men: number, units: readonly UnitId[]): string {
  if (men <= 0) return '';
  const w = strengthWord(men);
  const faces = units.slice(0, 7).map((u) => `<span class="army-mini${UNITS[u]?.up ? ' up' : ''}" title="${esc(unitName(u))}">${unitIcon(u, 'army-face-xs')}</span>`).join('');
  return `<div class="tg-army" title="${esc(L('strength'))}"><b class="tg-army-w">${esc(w.word)}</b> <span class="muted">${esc(w.range)}</span><span class="tg-army-faces">${faces}</span></div>`;
}
