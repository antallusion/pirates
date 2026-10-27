// The ship's army on screen (docs/17 H1): HoMM3's row of army slots — each stack's painted face with its count in the
// corner, the upgraded kinds in a gold frame, the empty slots of her class left open — the names and specials of the
// kinds of men, and the word for an army seen from afar («Горстка… Тьма»).

import { BOSS_UNIT_NAMES, isBossUnit } from '../../../shared/src/data/bossunits.ts'; // the great ones ashore (2026-10-03)
import { TITAN_NAMES, isTitan } from '../../../shared/src/data/titans.ts'; // docs/19 E10
import { EN as DEN, RU as DRU } from '../lang/ui/drifts.ts';
import { ARMY_WORD_MIN, UNITS, armyPower, armyWord } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId, UnitSpecial } from '../../../shared/src/data/army.ts';
import { dict, lang } from '../i18n.ts';
import { FACTION_NAMES } from '../../../shared/src/data/factionunits.ts';
import type { FactionKindId } from '../../../shared/src/data/factionunits.ts';
import { PREMIUM_NAMES, isPremiumBeast } from '../../../shared/src/data/premiumbeasts.ts';
import { SHIP_BEAST_NAMES, isShipBeast } from '../../../shared/src/data/shipbeasts.ts';
import { EN, RU } from '../lang/ui/army.ts';
import { beastFace } from '../render/beastface.ts';
import { dec1, esc, fmt, icon } from './dom.ts';

const L = dict(EN, RU);
const DL = dict(DEN, DRU);
type K = keyof typeof EN;

// The world's armies, the shop's creatures, the premium hulls' own kinds and the great ones ashore carry their own
// names (shared/src/data/factionunits.ts, premiumbeasts.ts, shipbeasts.ts, bossunits.ts).
const own = (u: UnitId, k: 0 | 2): string | null => {
  const r = k + (lang() === 'ru' ? 1 : 0);
  if (isBossUnit(u)) return BOSS_UNIT_NAMES[u][k ? 'note' : 'name'][lang() === 'ru' ? 1 : 0];
  if (isTitan(u)) return TITAN_NAMES[u][k ? 'note' : 'name'][lang() === 'ru' ? 1 : 0];
  const n = UNITS[u]?.roster ? FACTION_NAMES[u as FactionKindId] : isPremiumBeast(u) ? PREMIUM_NAMES[u] : isShipBeast(u) ? SHIP_BEAST_NAMES[u] : null;
  return n ? n[r] : null;
};
export const unitName = (u: UnitId): string => own(u, 0) ?? L(`u.${u}` as K);
export const unitNote = (u: UnitId): string => own(u, 2) ?? L(`ud.${u}` as K);
export const specialName = (s: UnitSpecial): string => L(`sp.${s}` as K);
export const specialNote = (s: UnitSpecial): string => L(`spd.${s}` as K);
export const unitArt = (u: UnitId): string => UNITS[u]?.art ?? 'icon.prof_sailor';

/** A kind's face as an image: its own battle figure, whole (render/beastface.ts — every kind has one); a kind with no
 *  figure the picture that stands in for it, tinted and framed (docs/18 II, BEAST_TINT). */
export function unitIcon(u: UnitId, cls: string): string {
  const face = beastFace(u);
  const tint = face.fig ? undefined : face.tint;
  const html = icon(face.fig ? face.id : unitArt(u), '', `${cls} beast-face${tint ? ' beast-tok' : ''}${face.fig ? ' fig' : ''}`);
  return tint ? html.replace('<img ', `<img style="filter:${tint}" `) : html;
}

/** A kind's standing beyond its tier (owner, 2026-10-27: «фон относительно их статуса»): the great ones ashore and the
 *  titans, the sea's legends, the shop's and the premium hulls' creatures; '' for the rest. */
export function unitRank(u: UnitId): '' | 'rare' | 'legend' | 'myth' {
  const d = UNITS[u];
  if (isBossUnit(u) || isTitan(u)) return 'myth';
  if (d?.legend) return 'legend';
  if (d?.premium || isPremiumBeast(u) || isShipBeast(u)) return 'rare';
  return '';
}

/** A stack's might as the game reckons it (shared/src/data/army.ts armyPower), short: 940, 12.4k. */
export function stackRating(n: number): string {
  const r = Math.round(n);
  return r < 10000 ? fmt(r) : L('k', { n: dec1(r / 1000).replace(/[.,]0$/, '') });
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** The tier's mark: its numeral on a code-drawn badge in the tier's colour, a gold chevron for an upgraded kind. */
const tierMark = (tier: number, up: boolean): string => `<i class="army-tier">${ROMAN[tier] ?? tier}${up ? '<s class="army-up" aria-hidden="true"></s>' : ''}</i>`;
/** The classes of a stack's frame: its tier's colour, upgraded, its rank. */
const slotCls = (u: UnitId): string => {
  const d = UNITS[u], r = unitRank(u);
  return `t${Math.min(7, Math.max(1, d.tier))}${d.up ? ' up' : ''}${r ? ` r-${r}` : ''}`;
};

/** HoMM3's word for an army of `men`, and the head counts it stands for. */
export function strengthWord(men: number): { word: string; range: string } {
  const w = armyWord(Math.max(1, men));
  const i = ARMY_WORD_MIN.findIndex((m, k) => men >= m && (k === ARMY_WORD_MIN.length - 1 || men < ARMY_WORD_MIN[k + 1]));
  const a = ARMY_WORD_MIN[Math.max(0, i)], b = ARMY_WORD_MIN[Math.max(0, i) + 1];
  return { word: L(`w.${w}` as K), range: b ? L('w.range', { a, b: b - 1 }) : L('w.more', { a }) };
}

/** One slot: the creature's whole figure on its tier's and rank's ground, the tier's numeral, the stack's might and its
 *  count (owner, 2026-10-27). */
export function armySlot(s: ArmyStack | null, cls = ''): string {
  if (!s) return `<div class="army-slot empty ${cls}" title="${esc(L('empty'))}"></div>`;
  const d = UNITS[s.u];
  const r = unitRank(s.u);
  const pow = armyPower([s]);
  const tip = `${unitName(s.u)} ×${s.n} — ${L('tier', { n: d.tier })}${d.up ? `, ${L('up')}` : ''}${r ? `, ${L(`r.${r}` as K)}` : ''}. ${L('rate', { n: fmt(Math.round(pow)) })}. ${unitNote(s.u)}${d.specials.length ? ` ${L('specials')}: ${d.specials.map(specialName).join(', ')}.` : ''}`;
  return `<div class="army-slot ${slotCls(s.u)} ${cls}" title="${esc(tip)}">${unitIcon(s.u, 'army-face')}${tierMark(d.tier, d.up)}<b class="army-rate" title="${esc(L('rate', { n: fmt(Math.round(pow)) }))}">${icon('act_attack', '', 'army-rate-ico')}${stackRating(pow)}</b><b class="army-n">${fmt(s.n)}</b></div>`;
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
    const r = unitRank(s.u);
    return `<div class="army-line"><span class="army-thumb ${slotCls(s.u)}">${unitIcon(s.u, 'army-face-sm')}</span><div class="item-text"><b>${esc(unitName(s.u))} <span class="muted">×${s.n}</span> <span class="army-line-rate">${icon('act_attack', '', 'army-rate-ico')}${stackRating(armyPower([s]))}</span></b><span class="muted">${esc(L('tier', { n: d.tier }))}${d.up ? ` · ${esc(L('up'))}` : ''}${r ? ` · ${esc(L(`r.${r}` as K))}` : ''} · ${esc(L('stat', { atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp }))}${d.specials.length ? ` · ${esc(d.specials.map(specialName).join(', '))}` : ''}</span></div></div>`;
  }).join('');
  // docs/18 IV: the creatures aboard — their own window (food, ranks, the pen, the tamer).
  const beasts = army.some((x) => UNITS[x.u]?.beast) ? `<button class="btn btn-small army-tame" data-tame>${icon('build_kennel', '', 'ico-sm')}${esc(DL('open'))}</button>` : '';
  return `<div class="card army-card"><h4 class="card-h">${icon('prof_marine', '', 'ico-md')}${esc(L('title'))} <span class="muted army-sum">${esc(L('men', { n: men }))} · ${esc(L('slots', { n: army.length, slots }))}${army.length ? ` · ${esc(L('rate', { n: stackRating(armyPower(army)) }))}` : ''}</span>${beasts}</h4>
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
