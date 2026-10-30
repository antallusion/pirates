// The ship's army on screen (docs/17 H1): HoMM3's row of army slots — each stack's painted face with its count in the
// corner, the upgraded kinds in a gold frame, the empty slots of her class left open — the names and specials of the
// kinds of men, and the word for an army seen from afar («Горстка… Тьма»).

import { BOSS_UNIT_NAMES, isBossUnit } from '../../../shared/src/data/bossunits.ts'; // the great ones ashore (2026-10-03)
import { TITAN_NAMES, isTitan } from '../../../shared/src/data/titans.ts'; // docs/19 E10
import { EN as DEN, RU as DRU } from '../lang/ui/drifts.ts';
import { ARMY_WORD_MIN, UNITS, armyPower, armyWord, stackKey } from '../../../shared/src/data/army.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { ask } from './confirm.ts';
import type { ArmyStack, UnitId, UnitSpecial } from '../../../shared/src/data/army.ts';
import { dict, lang } from '../i18n.ts';
import { FACTION_NAMES } from '../../../shared/src/data/factionunits.ts';
import type { FactionKindId } from '../../../shared/src/data/factionunits.ts';
import { PREMIUM_NAMES, isPremiumBeast } from '../../../shared/src/data/premiumbeasts.ts';
import { SHIP_BEAST_NAMES, isShipBeast } from '../../../shared/src/data/shipbeasts.ts';
import { EN, RU } from '../lang/ui/army.ts';
import { beastFace } from '../render/beastface.ts';
import { dec1, esc, fmt, icon } from './dom.ts';
import { detailAttr, infoBtn } from './detailattr.ts'; // the detail card (owner, 2026-10-30)
import { EN as DET_EN, RU as DET_RU } from '../lang/ui/detail.ts';

const L = dict(EN, RU);
const DTL = dict(DET_EN, DET_RU);
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
  // every creature's figure opens its detail card on a long press or a right click, wherever it is drawn (detail.ts)
  const held = html.replace('<img ', `<img${detailAttr(`unit:${u}`, { hold: true })} `);
  return tint ? held.replace('<img ', `<img style="filter:${tint}" `) : held;
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
  const tip = `${unitName(s.u)} ×${s.n} — ${L('tier', { n: d.tier })}${d.up ? `, ${L('up')}` : ''}${r ? `, ${L(`r.${r}` as K)}` : ''}. ${L('rate', { n: fmt(Math.round(pow)) })}. ${unitNote(s.u)}${d.specials.length ? ` ${L('specials')}: ${d.specials.map(specialName).join(', ')}.` : ''}${s.g ? ` ${L('gift.note')}.` : ''}`;
  return `<div class="army-slot ${slotCls(s.u)}${s.g ? ' gift' : ''} ${cls}"${detailAttr(`unit:${s.u}:${s.n}`)} title="${esc(tip)}">${unitIcon(s.u, 'army-face')}${tierMark(d.tier, d.up)}${s.g ? giftMark() : ''}<b class="army-rate" title="${esc(L('rate', { n: fmt(Math.round(pow)) }))}">${icon('act_attack', '', 'army-rate-ico')}${stackRating(pow)}</b><b class="army-n">${fmt(s.n)}</b></div>`;
}

/** The row of her class's slots, filled from the strongest. */
export function armyRow(army: readonly ArmyStack[], slots: number, cls = ''): string {
  const out: string[] = [];
  for (let i = 0; i < Math.max(slots, army.length); i++) out.push(armySlot(army[i] ?? null, cls));
  return `<div class="army-row">${out.join('')}</div>`;
}

/** The gift's mark on a stack (owner, 2026-10-28: «подарок»): a ribbon drawn in code, its word beside it. */
const giftMark = (): string => `<i class="army-gift" title="${esc(L('gift.note'))}"><s aria-hidden="true"></s><span>${esc(L('gift'))}</span></i>`;

/** The army's card for the crew screen: the slots, the head count, what each kind is. `edit`: the captain's own hand on
 *  them (owner, 2026-10-28) — pick a stack, split it into a free slot, drop it on its kind to merge, dismiss it. */
export function armyPanel(army: readonly ArmyStack[], slots: number, edit = false): string {
  const men = army.reduce((n, s) => n + s.n, 0);
  const list = army.map((s) => {
    const d = UNITS[s.u];
    const r = unitRank(s.u);
    return `<div class="army-line"${detailAttr(`unit:${s.u}:${s.n}`)}><span class="army-thumb ${slotCls(s.u)}">${unitIcon(s.u, 'army-face-sm')}</span><div class="item-text"><b>${esc(unitName(s.u))} <span class="muted">×${s.n}</span>${s.g ? ` <span class="chip army-gift-chip" title="${esc(L('gift.note'))}">${esc(L('gift'))}</span>` : ''} <span class="army-line-rate">${icon('act_attack', '', 'army-rate-ico')}${stackRating(armyPower([s]))}</span></b><span class="muted">${esc(L('tier', { n: d.tier }))}${d.up ? ` · ${esc(L('up'))}` : ''}${r ? ` · ${esc(L(`r.${r}` as K))}` : ''} · ${esc(L('stat', { atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp }))}${d.specials.length ? ` · ${esc(d.specials.map(specialName).join(', '))}` : ''}</span></div></div>`;
  }).join('');
  // docs/18 IV: the creatures aboard — their own window (food, ranks, the pen, the tamer).
  const beasts = army.some((x) => UNITS[x.u]?.beast) ? `<button class="btn btn-small army-tame" data-tame>${icon('build_kennel', '', 'ico-sm')}${esc(DL('open'))}</button>` : '';
  return `<div class="card army-card"${edit ? ' data-army-edit' : ''}><h4 class="card-h">${icon('prof_marine', '', 'ico-md')}${esc(L('title'))} <span class="muted army-sum">${esc(L('men', { n: men }))} · ${esc(L('slots', { n: army.length, slots }))}${army.length ? ` · ${esc(L('rate', { n: stackRating(armyPower(army)) }))}` : ''}</span>${beasts}</h4>
    ${edit ? editRow(army, slots) + opsBar(army, slots) : armyRow(army, slots)}
    <div class="army-list">${list}</div>
    <p class="muted army-hint">${esc(L('hint'))}</p></div>`;
}

/** Her army at a glance for the target frame: the word, the counts it stands for, the faces of her kinds. */
export function armyGlance(men: number, units: readonly UnitId[]): string {
  if (men <= 0) return '';
  const w = strengthWord(men);
  const faces = units.slice(0, 7).map((u) => `<span class="army-mini${UNITS[u]?.up ? ' up' : ''}"${detailAttr(`unit:${u}`)} title="${esc(unitName(u))}">${unitIcon(u, 'army-face-xs')}</span>`).join('');
  return `<div class="tg-army" title="${esc(L('strength'))}"><b class="tg-army-w">${esc(w.word)}</b> <span class="muted">${esc(w.range)}</span><span class="tg-army-faces">${faces}</span></div>`;
}

// ------------------------------------------------------------------------------------------------ the captain's hand
// Owner, 2026-10-28 («дай возможность разделять пачку армии на маленькие пачки прям на корабле»): HoMM3's split and
// merge on the crew screen. A tap (or a click) picks a stack; a tap on a stack of its kind merges them, on an empty
// slot opens the split (a slider for the men that go); a drag does the same with a mouse. The server weighs it all
// (server/src/game/armyops.ts). Held here between the window's redraws.

let sel: string | null = null;
let splitOf: string | null = null;
let splitN = 1;
let note = '';
let dragKey: string | null = null;

/** A pick, a split or a drag under way: the crew window waits with its redraw (main.ts). */
export const armyEditing = (): boolean => !!(sel || splitOf || dragKey);

const coarse = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function editRow(army: readonly ArmyStack[], slots: number): string {
  const picked = army.find((x) => stackKey(x) === (splitOf ?? sel));
  const out: string[] = [];
  for (let i = 0; i < Math.max(slots, army.length); i++) {
    const s = army[i];
    if (!s) {
      out.push(`<div class="army-slot empty${picked && picked.n > 1 ? ' target' : ''}" data-empty title="${esc(L('empty'))}"></div>`);
      continue;
    }
    const k = stackKey(s);
    const cls = k === (splitOf ?? sel) ? 'sel' : picked && picked !== s && picked.u === s.u && !!picked.g === !!s.g ? 'target' : '';
    // (a tap picks the stack here: its card on a long press, a right click, or the ⓘ of the bar under the row)
    out.push(armySlot(s, cls).replace(' data-detail="', ' data-detail-hold="').replace('<div class="army-slot', `<div draggable="true" data-sk="${esc(k)}" class="army-slot`));
  }
  return `<div class="army-row army-edit">${out.join('')}</div>`;
}

function opsBar(army: readonly ArmyStack[], slots: number): string {
  const s = army.find((x) => stackKey(x) === (splitOf ?? sel));
  const msg = note ? `<span class="army-ops-note bad">${esc(note)}</span>` : '';
  if (!s) return `<div class="army-ops"><span class="muted">${esc(L('op.pick'))}</span>${msg}</div>`;
  const name = `${esc(unitName(s.u))} ×${fmt(s.n)}`;
  const cancel = `<button class="btn btn-small" data-op-cancel>${esc(L('op.cancel'))}</button>`;
  if (splitOf) {
    if (s.n < 2) return `<div class="army-ops"><b>${name}</b><span class="muted">${esc(L('split.one'))}</span><span class="army-ops-btns">${cancel}</span></div>`;
    if (army.length >= slots) return `<div class="army-ops"><b>${name}</b><span class="bad">${esc(L('split.noslot'))}</span><span class="army-ops-btns">${cancel}</span></div>`;
    const n = Math.max(1, Math.min(s.n - 1, splitN));
    splitN = n;
    return `<div class="army-ops army-split"><b>${esc(L('split.title', { name: unitName(s.u), n: fmt(s.n) }))}</b>
      <input type="range" min="1" max="${s.n - 1}" step="1" value="${n}" data-split-n aria-label="${esc(L('op.split'))}">
      <span class="army-split-nums"><span data-split-keep>${esc(L('split.keep', { a: fmt(s.n - n) }))}</span> · <b data-split-new>${esc(L('split.new', { b: fmt(n) }))}</b></span>
      <span class="army-ops-btns"><button class="btn btn-small btn-primary" data-split-go>${esc(L('op.split'))}</button>${cancel}</span></div>`;
  }
  const noSplit = s.n < 2 || army.length >= slots;
  return `<div class="army-ops">${infoBtn(`unit:${s.u}:${s.n}`, DTL('info'), 'army-ops-info')}<b>${name}</b>${s.g ? ` <span class="chip army-gift-chip">${esc(L('gift'))}</span>` : ''}<span class="muted army-ops-hint">${esc(L(coarse() ? 'op.hintTouch' : 'op.hint'))}</span>${msg}
    <span class="army-ops-btns"><button class="btn btn-small" data-op-split ${noSplit ? `disabled title="${esc(L(s.n < 2 ? 'split.one' : 'split.noslot'))}"` : ''}>${esc(L('op.split'))}</button><button class="btn btn-small btn-danger" data-op-dismiss ${army.length <= 1 ? 'disabled' : ''}>${esc(L('op.dismiss'))}</button>${cancel}</span></div>`;
}

/** The same hand without the card (owner, 2026-10-29: the hire window's «Ваша армия» — split, merge, dismiss there too):
 *  the row of slots and the bar under it. Wire it with `wireArmy(…, true)`. */
export function armyEditor(army: readonly ArmyStack[], slots: number): string {
  return `<div class="army-ed" data-army-edit>${editRow(army, slots)}${opsBar(army, slots)}</div>`;
}

/** Forget the pick (a window opened anew). */
export function armyEditReset(): void {
  sel = splitOf = dragKey = null;
  note = '';
}

/** The army card's hand wired (renderCrew): `army`, `slots` as the card was drawn; `bare`: drawn by armyEditor. */
export function wireArmy(root: HTMLElement, army: readonly ArmyStack[], slots: number, send: (m: ClientMsg) => void, bare = false): void {
  const card = root.querySelector<HTMLElement>('[data-army-edit]');
  if (!card) return;
  const find = (k: string | null) => (k ? army.find((x) => stackKey(x) === k) : undefined);
  if (sel && !find(sel)) sel = null;
  if (splitOf && !find(splitOf)) splitOf = null;
  const redraw = () => {
    const at = root.querySelector<HTMLElement>('[data-army-edit]');
    if (!at) return;
    at.outerHTML = bare ? armyEditor(army, slots) : armyPanel(army, slots, true);
    wireArmy(root, army, slots, send, bare);
  };
  const openSplit = (k: string) => {
    const s = find(k);
    if (!s) return;
    sel = k;
    splitOf = k;
    splitN = Math.max(1, Math.floor(s.n / 2));
    note = '';
    redraw();
  };
  const mergeInto = (from: string, to: string): void => {
    const a = find(from), b = find(to);
    if (!a || !b || a === b) return;
    if (a.u !== b.u) {
      note = L('merge.kind');
      return;
    }
    if (!!a.g !== !!b.g) {
      note = L('merge.gift');
      return;
    }
    send({ t: 'army', op: 'merge', k: from, to });
    sel = splitOf = null;
    note = '';
  };
  card.querySelectorAll<HTMLElement>('[data-sk]').forEach((el) => {
    const k = el.dataset.sk!;
    el.onclick = () => {
      if (sel && sel !== k && !splitOf && find(sel)?.u === find(k)?.u) {
        mergeInto(sel, k);
        return redraw();
      }
      note = '';
      splitOf = null;
      sel = sel === k ? null : k;
      redraw();
    };
    el.addEventListener('dragstart', (e) => {
      dragKey = k;
      e.dataTransfer?.setData('text/plain', k);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => (dragKey = null));
  });
  card.querySelectorAll<HTMLElement>('[data-sk], [data-empty]').forEach((el) => {
    el.addEventListener('dragover', (e) => {
      if (dragKey) e.preventDefault();
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = dragKey ?? e.dataTransfer?.getData('text/plain') ?? '';
      dragKey = null;
      if (!from) return;
      if (el.dataset.empty !== undefined) return openSplit(from); // (on an empty slot, Shift or not: HoMM3's split)
      if (el.dataset.sk && el.dataset.sk !== from) mergeInto(from, el.dataset.sk);
      redraw();
    });
  });
  card.querySelectorAll<HTMLElement>('[data-empty]').forEach((el) => (el.onclick = () => {
    if (sel) openSplit(sel);
  }));
  card.querySelector<HTMLElement>('[data-op-split]')?.addEventListener('click', () => {
    if (sel) openSplit(sel);
  });
  card.querySelector<HTMLElement>('[data-op-cancel]')?.addEventListener('click', () => {
    sel = splitOf = null;
    note = '';
    redraw();
  });
  card.querySelector<HTMLElement>('[data-op-dismiss]')?.addEventListener('click', () => {
    const s = find(sel);
    if (!s) return;
    const k = stackKey(s);
    void ask(L('dismiss.ask', { name: unitName(s.u), n: fmt(s.n) })).then((ok) => {
      if (!ok) return;
      send({ t: 'army', op: 'dismiss', k });
      sel = splitOf = null;
      note = '';
      redraw();
    });
  });
  const range = card.querySelector<HTMLInputElement>('[data-split-n]');
  if (range) {
    const s = find(splitOf);
    range.oninput = () => {
      splitN = Math.max(1, Math.floor(Number(range.value) || 1));
      const keep = card.querySelector<HTMLElement>('[data-split-keep]'), nw = card.querySelector<HTMLElement>('[data-split-new]');
      if (s && keep) keep.textContent = L('split.keep', { a: fmt(s.n - splitN) });
      if (nw) nw.textContent = L('split.new', { b: fmt(splitN) });
    };
  }
  card.querySelector<HTMLElement>('[data-split-go]')?.addEventListener('click', () => {
    if (!splitOf) return;
    send({ t: 'army', op: 'split', k: splitOf, n: splitN });
    sel = splitOf = null;
    note = '';
    redraw();
  });
}
