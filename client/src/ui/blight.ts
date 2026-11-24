// docs/40: the Blighted Sea («Море Скверны») in the interface. The server decides everything; here it is only shown and
// her orders sent as `{ t: 'blight', action }`:
//  · the HUD's block in the top stack while she is in the green water — her tier (Roman), the Taint's bar, the marks in
//    her hold, her multiplier, the Chosen, the Heart's clock, «Пришвартоваться» within the Raft's reach;
//  · the Raft's window (modelled on the dice table, dice.ts): the marks and the cast-off, the table of twenty-one with
//    cards drawn in code, the shop, Dead Man's Dice by the port's own orders, the chapter and the day's contracts, the
//    week's board;
//  · the chapter «Глава XXXVII. Зелёный огонь» as one more card of the campaign book.
// A captain whose `state.self.blight` is null or absent gets none of it: no block, no card, no button.

import type { BjView, BlightTaskView, BlightView } from '../../../shared/src/blightproto.ts';
import {
  BJ_STAKES, BLIGHT_CHAPTER, BLIGHT_QUESTS, BLIGHT_SHOP, MARKS_NAME, RAFT_DEALER, RAFT_NAME, bjRank, bjSuit, stepText,
} from '../../../shared/src/data/blight.ts';
import type { BjCoin, BlightStep, BlightWare } from '../../../shared/src/data/blight.ts';
import { AFFIXES, itemName } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/blight.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { artImg } from './artfall.ts';
import { diceCard } from './dice.ts';
import { dec2, esc, fmt, icon, money } from './dom.ts';

const L = dict(EN, RU);
type Send = (m: ClientMsg) => void;
type Tr = readonly [string, string];
const tr = (t: Tr): string => t[lang() === 'ru' ? 1 : 0];

/** A tier as the zone writes it: I, II, III… (no cap: past 3999 the number itself). */
export function roman(n: number): string {
  n = Math.max(1, Math.floor(n));
  if (n > 3999) return String(n);
  const T: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of T) while (n >= v) {
    s += r;
    n -= v;
  }
  return s;
}

/** Minutes and seconds: «9:05». */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const marksIco = (cls = 'ico-sm'): string => icon('st_poison', '◈', cls);

// ================================================================================================ the HUD's block

/** What just happened to her in the green water, shown on the block for a few seconds (the words come as a toast). */
let flourish: { text: string; kind: 'good' | 'bad' | 'info'; until: number } | null = null;

/** A `blight_ev` from the server: the block's flourish; a quest done says its completion line in the log's voice. */
export function blightEvent(m: Extract<ServerMsg, { t: 'blight_ev' }>, state: ClientState, toast: (msg: string, kind: 'info' | 'good' | 'bad' | 'gold') => void): void {
  const n = m.n ?? 0;
  let text = '';
  let kind: 'good' | 'bad' | 'info' = 'good';
  switch (m.ev) {
    case 'bank': text = m.cut ? L('ev.bankCut', { n: fmt(n), cut: fmt(m.cut) }) : L('ev.bank', { n: fmt(n) }); break;
    case 'lost': text = L('ev.lost', { n: fmt(n) }); kind = 'bad'; break;
    case 'tier': text = L('ev.tier', { n: roman(n) }); kind = 'info'; break;
    case 'quest': {
      text = L('ev.quest', { n: fmt(n) });
      // (the quest just handed in is the one before her place now)
      const at = state.self?.blight?.ch.at ?? 0;
      const q = BLIGHT_QUESTS[Math.max(0, at - 1)];
      if (q) toast(tr(q.d), 'gold');
      break;
    }
    case 'contract': text = L('ev.contract', { n: fmt(n) }); break;
    case 'veil': text = L('ev.veil'); kind = 'bad'; break;
    case 'bought': text = L('ev.bought', { n: fmt(n) }); kind = 'info'; break;
    case 'cask': text = L('ev.cask', { n: fmt(n) }); break;
  }
  if (text) flourish = { text, kind, until: performance.now() + 3500 };
}

export class BlightHud {
  private key = '';
  private el: HTMLElement | null = null;
  private at = 0;
  private readonly moor: () => void;
  private readonly openRaft: () => void;
  /** `moor`: «Пришвартоваться» (main.ts brings her to a stop first); `openRaft`: the Raft's window back up. */
  constructor(moor: () => void, openRaft: () => void) {
    this.moor = moor;
    this.openRaft = openRaft;
  }

  private host(): HTMLElement | null {
    if (this.el?.isConnected) return this.el;
    const stack = document.getElementById('hud-stack');
    if (!stack) return null;
    const el = document.createElement('div');
    el.id = 'hud-blight';
    el.className = 'hud-block hidden';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'off');
    const fold = document.getElementById('hud-fold');
    if (fold?.parentElement === stack) fold.after(el);
    else stack.prepend(el);
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-bl]');
      if (!b) return;
      if (b.dataset.bl === 'moor') this.moor();
      else if (b.dataset.bl === 'raft') this.openRaft();
    });
    return (this.el = el);
  }

  /** Each frame (it looks five times a second: its clocks count seconds). `raftOpen`: the Raft's window is up (its
   *  button is not offered twice); `stopping`: she is being brought to a stop to moor. */
  render(v: BlightView | null | undefined, raftOpen: boolean, stopping = false): void {
    // (a captain the green water has not taken: the block is never even made)
    if (!v && !this.el) return;
    const now = performance.now();
    if (now - this.at < 200 && !!v === !!this.key) return;
    this.at = now;
    const el = this.host();
    if (!el) return;
    const wall = Date.now();
    if (flourish && now > flourish.until) flourish = null;
    const heart = v?.heart ?? null;
    // Outside: only the Heart's clock (told ten minutes before) and a flourish just earned (banked across the rim).
    const show = !!v && (v.inside || heart !== null || flourish !== null);
    if (!v || !show) {
      if (this.key) {
        this.key = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const heartTxt = !heart ? '' : 'at' in heart ? L('hud.heartIn', { t: clock(heart.at - wall) }) : L('hud.heartUp', { hp: Math.round(heart.hp * 100) });
    const lanternLeft = v.lantern > wall ? clock(v.lantern - wall) : '';
    const taint = Math.round(v.taint);
    const key = `${lang()}|${v.inside}|${v.tier}|${taint}|${v.hold}|${v.mul}|${v.xpMul}|${v.chosen?.name ?? ''}|${v.chosen?.tier ?? 0}|${v.chosen?.me ?? ''}|${heartTxt}|${lanternLeft}|${v.cask}|${v.atRaft}|${v.moored}|${v.mooring > 0 || stopping}|${raftOpen}|${flourish?.text ?? ''}`;
    if (key === this.key) return;
    this.key = key;
    el.classList.remove('hidden');
    el.classList.toggle('bl-out', !v.inside);
    el.setAttribute('aria-label', L('hud.aria', { tier: roman(v.tier), hold: v.hold, mul: dec2(v.mul) }));
    const chips: string[] = [];
    if (flourish) chips.push(`<span class="bl-chip bl-ev bl-${flourish.kind}">${esc(flourish.text)}</span>`);
    if (v.inside && v.chosen) {
      chips.push(v.chosen.me
        ? `<span class="bl-chip bl-chosen" title="${esc(L('hud.chosenMeTip'))}">◆ ${esc(L('hud.chosenMe'))}</span>`
        : `<span class="bl-chip bl-chosen" title="${esc(L('hud.chosenTip'))}">◆ ${esc(L('hud.chosen', { name: v.chosen.name, tier: roman(v.chosen.tier) }))}</span>`);
    }
    if (heartTxt) chips.push(`<span class="bl-chip bl-heart" title="${esc(L('hud.heartTip'))}">${esc(heartTxt)}</span>`);
    if (v.inside && lanternLeft) chips.push(`<span class="bl-chip" title="${esc(L('hud.lanternTip'))}">${esc(L('hud.lantern', { t: lanternLeft }))}</span>`);
    if (v.inside && v.cask) chips.push(`<span class="bl-chip">${esc(L('hud.cask'))}</span>`);
    let act = '';
    if (v.inside && v.moored) act = raftOpen ? '' : `<button type="button" class="btn btn-small btn-primary bl-act" data-bl="raft" title="${esc(L('hud.raftTip'))}">${esc(L('hud.raft'))}</button>`;
    else if (v.inside && (v.mooring > 0 || stopping)) act = `<span class="bl-chip bl-mooring">${esc(L('hud.mooring'))}</span>`;
    else if (v.inside && v.atRaft) act = `<button type="button" class="btn btn-small btn-primary bl-act" data-bl="moor">${esc(L('hud.moor'))}</button>`;
    const main = v.inside ? `<span class="bl-tier" title="${esc(L('hud.tierTip'))}">${icon('sk_rot', '', 'ico-sm')}<b>${esc(L('hud.tier', { n: roman(v.tier) }))}</b></span>`
      + `<span class="bl-bar" title="${esc(L('hud.taintTip', { n: taint, of: v.per }))}"><i style="width:${Math.max(0, Math.min(100, (v.taint / Math.max(1, v.per)) * 100)).toFixed(0)}%"></i></span>`
      + `<span class="bl-hold" title="${esc(L('hud.holdTip'))}">${marksIco()}<b>${fmt(v.hold)}</b></span>`
      + `<span class="bl-mul" title="${esc(L('hud.mulTip', { m: dec2(v.mul), x: dec2(v.xpMul) }))}">×${dec2(v.mul)}</span>` : '';
    el.innerHTML = `${main ? `<span class="bl-main">${main}</span>` : ''}${chips.length || act ? `<span class="bl-chips">${chips.join('')}${act}</span>` : ''}`;
  }
}

// ================================================================================================ the cards (drawn in code)

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** A card of the deck 0–51 on parchment: its rank and suit in the corner, the suit large in the middle. `-1`: face down. */
export function cardSvg(c: number): string {
  if (c < 0) {
    return `<svg class="bj-card bj-back" viewBox="0 0 60 84" role="img" aria-label="${esc(L('bj.hidden'))}"><rect x="1.5" y="1.5" width="57" height="81" rx="6"/><rect class="bj-in" x="7" y="7" width="46" height="70" rx="3"/><path class="bj-loz" d="M30 16 L46 42 L30 68 L14 42 Z"/><path class="bj-loz" d="M30 28 L38 42 L30 56 L22 42 Z"/></svg>`;
  }
  const r = RANKS[bjRank(c)], s = bjSuit(c);
  return `<svg class="bj-card${s === 1 || s === 2 ? ' red' : ''}" viewBox="0 0 60 84" role="img" aria-label="${r}${SUITS[s]}"><rect x="1.5" y="1.5" width="57" height="81" rx="6"/><text class="bj-r" x="${r.length > 1 ? 4 : 6}" y="19"${r.length > 1 ? ' textLength="15" lengthAdjust="spacingAndGlyphs"' : ''}>${r}</text><text class="bj-s" x="6" y="33">${SUITS[s]}</text><text class="bj-big" x="30" y="62" text-anchor="middle">${SUITS[s]}</text></svg>`;
}

// ================================================================================================ the Raft's window

type Tab = 'raft' | 'bj' | 'shop' | 'dice' | 'chapter' | 'week';
const TABS: Tab[] = ['raft', 'bj', 'shop', 'dice', 'chapter', 'week'];
let tab: Tab = 'raft';
let coin: BjCoin = 'silver';
let stake = BJ_STAKES.silver[0];
/** The shop's re-forge: the piece being chosen (its lines listed), or the list of pieces. */
let picking: 'list' | number | null = null;

/** The window opened anew (she has just moored): its first page. */
export function raftReset(): void {
  tab = 'raft';
  picking = null;
}

const coinAmount = (c: BjCoin, n: number): string => (c === 'silver' ? money(n) : `<span class="money">${marksIco()}${fmt(n)}</span>`);

function taskLine(step: BlightStep, t: BlightTaskView | null, i: number): string {
  const done = !!t && i < t.step, now = !!t && i === t.step;
  let prog = '';
  if (now && t && t.need > 1) prog = step.k === 'survive' ? L('ch.min', { a: Math.floor(t.progress / 60), b: Math.round(t.need / 60) }) : L('ch.progress', { a: fmt(t.progress), b: fmt(t.need) });
  return `<li class="${done ? 'done' : now ? 'now' : 'ahead'}"><span class="jr-mark${now ? ' now' : ''}">${done ? '✓' : now ? '◆' : '·'}</span><span>${esc(tr(stepText(step)))}${prog ? ` <small class="muted">${esc(prog)}</small>` : ''}</span></li>`;
}

/** The chapter's body: its blurb, the quests behind her, the one under way with its steps, and its button. */
function chapterBody(v: BlightView): string {
  const ch = v.ch;
  const done = ch.at >= ch.size;
  const behind = BLIGHT_QUESTS.slice(0, Math.min(ch.at, ch.size)).map((q) => `<li class="done"><span class="jr-mark">✓</span><span>${esc(tr(q.t))}</span></li>`).join('');
  const q = done ? null : BLIGHT_QUESTS[ch.at];
  let cur = '';
  if (q) {
    const act = ch.cur
      ? `<button class="btn btn-primary btn-small" data-blq="claim" ${ch.canClaim ? '' : 'disabled'}>${esc(L('ch.claim'))}</button>${ch.canClaim ? '' : `<small class="muted">${esc(L('ch.claimAt'))}</small>`}`
      : `<button class="btn btn-primary btn-small" data-blq="take">${esc(L('ch.take'))}</button>`;
    cur = `<div class="bl-quest"><div class="giver-h">${esc(L('ch.quest', { n: ch.at + 1, of: ch.size }))}</div><b class="bl-qt">${esc(tr(q.t))}</b>
      <p class="bl-qb">${esc(tr(q.b))}</p>
      <ol class="cb-quests bl-steps">${q.s.map((s, i) => taskLine(s, ch.cur, i)).join('')}</ol>
      <div class="bl-qfoot"><span class="muted">${esc(L('ch.reward', { marks: fmt(q.marks) }))}</span>${act}</div></div>`;
  }
  return `<p class="cb-blurb">${esc(tr(BLIGHT_CHAPTER.blurb))}</p><p class="muted bl-giver">${esc(tr(BLIGHT_CHAPTER.giver))}${done ? '' : ` · ${esc(L('ch.final', { title: tr(BLIGHT_CHAPTER.reward.title) }))}`}</p>
    ${behind ? `<ol class="cb-quests">${behind}</ol>` : ''}${cur}`;
}

/** The day's contracts (after the chapter). */
function contractsHtml(v: BlightView): string {
  if (v.ch.at < v.ch.size) return '';
  if (!v.contracts.length) return `<p class="muted">${esc(L('ch.noContracts'))}</p>`;
  return `<div class="giver-h">${esc(L('ch.contracts'))}</div><p class="muted bl-small">${esc(L('ch.contractsHint'))}</p>${v.contracts.map((c) => {
    const ready = c.step >= c.steps && !c.paid;
    const prog = c.paid ? L('ch.cPaid') : c.ask.k === 'survive' ? L('ch.min', { a: Math.floor(c.progress / 60), b: Math.round(c.need / 60) }) : L('ch.progress', { a: fmt(Math.min(c.progress, c.need)), b: fmt(c.need) });
    return `<div class="cmp-h bl-contract${c.paid ? ' paid' : ''}"><div class="cmp-h-t"><b>${esc(tr(stepText(c.ask)))}</b><span class="muted">${esc(prog)} · ${esc(L('ch.cPay', { marks: fmt(c.marks) }))}</span></div>
      <button class="btn btn-small${ready ? ' btn-primary' : ''}" data-blc="${c.id}" ${ready && v.moored ? '' : 'disabled'}>${esc(c.paid ? '✓' : L('ch.cHand'))}</button></div>`;
  }).join('')}`;
}

/** The chapter as one more card of the campaign book (after chapter 36), only for a captain the green water has taken. */
export function blightChapterHtml(v: BlightView | null | undefined): string {
  if (!v) return '';
  const ch = v.ch;
  const done = ch.at >= ch.size;
  const sum = `<summary>${icon(done ? 'tab_legends' : 'tab_letters', '', 'ico-sm')}<b>${esc(L('ch.card', { title: tr(BLIGHT_CHAPTER.title) }))}</b>
    <span class="cb-meta">${done ? `✓ ${esc(L('ch.done'))}` : esc(L('ch.meta', { n: ch.at, of: ch.size }))}</span></summary>`;
  return `<details class="cb-ch cb-blight ${done ? 'cb-done' : 'cb-now'}"${done ? '' : ' open'}>${sum}${artImg([done ? BLIGHT_CHAPTER.cardDone : BLIGHT_CHAPTER.card], 'cb-art', ' loading="lazy"')}${chapterBody(v)}${contractsHtml(v)}</details>`;
}

/** The chapter's buttons (the book's card and the Raft's page): take, hand in, a contract. */
export function bindBlightChapter(root: HTMLElement, send: Send): void {
  root.querySelectorAll<HTMLElement>('[data-blq]').forEach((b) => (b.onclick = () => send({ t: 'blight', action: b.dataset.blq === 'claim' ? 'claim' : 'take' })));
  root.querySelectorAll<HTMLElement>('[data-blc]').forEach((b) => (b.onclick = () => send({ t: 'blight', action: 'contract', id: Number(b.dataset.blc) })));
}

function raftPage(v: BlightView): string {
  const wall = Date.now();
  const stat = (label: string, val: string, hint = ''): string => `<div class="bl-stat"><span class="muted">${esc(label)}</span><b>${val}</b>${hint ? `<small class="muted">${esc(hint)}</small>` : ''}</div>`;
  return `${artImg(['bg.way_tavern'], 'bl-art')}
    <p class="bl-welcome">${esc(L('raft.welcome'))}</p>
    <div class="bl-stats">
      ${stat(L('raft.banked'), `${marksIco()}${fmt(v.marks)}`, L('raft.bankedHint'))}
      ${stat(L('raft.hold'), `${marksIco()}${fmt(v.hold)}`, L('raft.holdHint'))}
      ${stat(L('raft.best'), roman(v.best))}
      ${v.weekTitle ? stat(L('raft.title'), esc(serverText(v.weekTitle))) : ''}
    </div>
    ${v.lantern > wall ? `<p class="bl-lantern" data-bl-lantern>${esc(L('raft.lantern', { t: clock(v.lantern - wall) }))}</p>` : ''}
    <p class="muted bl-small">${esc(L('raft.rules'))}</p>`;
}

function bjPage(v: BlightView, bj: BjView | null, silver: number): string {
  const open = !!bj && bj.result === null;
  const hand = (cards: number[]): string => cards.map((c) => cardSvg(c)).join('');
  let table = '';
  if (bj) {
    const total = bj.soft && bj.total < 21 ? L('bj.soft', { n: bj.total }) : L('bj.total', { n: bj.total });
    const res = bj.result ? `<div class="bj-result bj-${bj.result}">${bj.result === 'blackjack' || bj.result === 'win' ? `${esc(L(`bj.r.${bj.result}`))} ${coinAmount(bj.coin, bj.back)}` : esc(L(`bj.r.${bj.result}`))}</div>` : '';
    table = `<div class="bj-table">
      <div class="bj-row"><div class="bj-who"><span class="giver-h">${esc(L('bj.dealer', { name: tr(RAFT_DEALER) }))}</span><b class="bj-n">${bj.dealerTotal}</b></div><div class="bj-hand">${hand(bj.dealer)}</div></div>
      <div class="bj-row"><div class="bj-who"><span class="giver-h">${esc(L('bj.you'))}</span><b class="bj-n">${esc(total)}</b></div><div class="bj-hand">${hand(bj.player)}</div></div>
      <div class="bj-pot"><span class="muted">${esc(L('bj.onTable'))}</span> ${coinAmount(bj.coin, bj.stake)}${bj.doubled ? ` <small class="muted">(${esc(L('bj.doubled'))})</small>` : ''}</div>
      ${res}</div>`;
  }
  let controls: string;
  if (open) {
    controls = `<div class="dc-acts bj-acts"><button class="btn btn-primary" data-bj="hit">${esc(L('bj.hit'))}</button><button class="btn" data-bj="stand">${esc(L('bj.stand'))}</button><button class="btn" data-bj="double" ${bj!.canDouble ? '' : 'disabled'}>${esc(L('bj.double'))}</button></div>`;
  } else {
    const have = coin === 'silver' ? silver : v.marks;
    const closed = v.bj.hands <= 0 ? L('bj.noHands') : coin === 'silver' && v.bj.silver <= 0 ? L('bj.noSilver') : '';
    const can = !closed && have >= stake && (coin !== 'silver' || v.bj.silver >= stake);
    controls = `<div class="dc-controls bj-controls">
      <div class="bj-coins"><span class="giver-h">${esc(L('bj.stake'))}</span>${(['silver', 'marks'] as const).map((c) => `<button class="btn btn-small${c === coin ? ' on' : ''}" data-bjcoin="${c}" aria-pressed="${c === coin}">${esc(L(`bj.${c}`))}</button>`).join('')}</div>
      <div class="bj-stakes">${BJ_STAKES[coin].map((s) => `<button class="btn btn-small${s === stake ? ' on' : ''}" data-bjstake="${s}" aria-pressed="${s === stake}">${coinAmount(coin, s)}</button>`).join('')}</div>
      <div class="dc-acts"><button class="btn btn-primary" data-bj="deal" ${can ? '' : 'disabled'}>${esc(bj ? L('bj.again') : L('bj.deal'))}</button></div>
      ${closed ? `<p class="bj-kind">${esc(closed)}</p>` : !can ? `<p class="muted bl-small">${esc(L('bj.poor'))}</p>` : ''}</div>`;
  }
  return `<p class="muted dc-rules">${esc(L('bj.rules'))}</p>${table}${controls}
    <p class="muted bl-small bj-limits">${esc(L('bj.limits', { hands: v.bj.hands, silver: fmt(v.bj.silver) }))} · ${marksIco()}${fmt(v.marks)}</p>`;
}

/** Her pieces with an extra line: the locker's and the worn. */
function pieces(state: ClientState): { it: Item; worn: boolean }[] {
  const self = state.self;
  if (!self) return [];
  const out: { it: Item; worn: boolean }[] = [];
  for (const it of Object.values(self.loadout.gear ?? {})) if (it?.affixes.length) out.push({ it, worn: true });
  for (const it of Object.values(self.captainGear ?? {})) if (it?.affixes.length) out.push({ it, worn: true });
  for (const it of self.stash ?? []) if (it.affixes.length) out.push({ it, worn: false });
  return out;
}

function shopPage(v: BlightView, state: ClientState): string {
  const ru = lang() === 'ru';
  if (picking !== null) {
    const all = pieces(state);
    const one = typeof picking === 'number' ? all.find((x) => x.it.uid === picking) : undefined;
    const body = !all.length ? `<p class="muted">${esc(L('shop.noPieces'))}</p>`
      : one ? `<div class="cmp-h"><div class="cmp-h-t"><b>${esc(itemName(one.it, ru))}</b><span class="muted">${esc(L('shop.pick'))}</span></div></div><div class="bl-lines">${one.it.affixes.map((a, i) => `<button class="btn btn-small" data-blline="${i}">↻ ${esc(AFFIXES[a.a].name[ru ? 1 : 0])}</button>`).join('')}</div>`
        : all.map((x) => `<button class="cmp-h bl-piece" data-blpiece="${x.it.uid}"><span class="cmp-h-t"><b>${esc(itemName(x.it, ru))}</b><span class="muted">${x.worn ? `${esc(L('shop.worn'))} · ` : ''}${x.it.affixes.map((a) => esc(AFFIXES[a.a].name[ru ? 1 : 0])).join(', ')}</span></span></button>`).join('');
    return `<div class="giver-h">${esc(L('shop.pick'))}</div><p class="muted bl-small">${esc(L('shop.pickHint'))}</p>${body}<div class="dc-foot"><button class="btn btn-small" data-blback>${esc(L('shop.back'))}</button></div>`;
  }
  const rows = BLIGHT_SHOP.map((w) => {
    const s = v.shop.find((x) => x.id === w.id);
    if (!s) return '';
    const poor = v.marks < s.price;
    const btn = s.owned ? `<span class="bl-owned">✓ ${esc(L('shop.owned'))}</span>` : `<button class="btn btn-small btn-primary" data-blbuy="${w.id}" ${poor ? 'disabled' : ''} title="${poor ? esc(L('shop.poor')) : ''}">${esc(L('shop.buy'))}</button>`;
    return `<div class="bl-ware${s.owned ? ' owned' : ''}">${icon(w.art, '', 'bl-ware-art')}<div class="bl-ware-t"><b>${esc(tr(w.name))}</b><span class="muted">${esc(tr(w.hint))}</span></div>
      <div class="bl-ware-buy"><span class="bl-price${poor && !s.owned ? ' poor' : ''}">${marksIco()}${fmt(s.price)}</span>${btn}</div></div>`;
  }).join('');
  return `<p class="muted bl-small">${esc(L('shop.hint'))}</p><div class="bl-shop">${rows}</div>`;
}

function dicePage(v: BlightView, silver: number): string {
  if (!v.dice) return `<p class="muted">${esc(L('dice.off'))}</p>`;
  return `<p class="muted bl-small">${esc(L('dice.hint'))}</p>${diceCard({ tables: v.tables, week: [], davy: v.davy }, silver)}`;
}

function weekPage(v: BlightView): string {
  if (!v.week.length) return `<p class="muted bl-small">${esc(L('week.hint'))}</p><p class="muted">${esc(L('week.empty'))}</p>`;
  const rows = v.week.map((w, i) => `<tr class="${w.me ? 'me' : ''}"><td>${i < 10 ? i + 1 : '…'}</td><td class="bl-wn">${esc(w.name)}${w.me ? ` <small class="muted">(${esc(L('week.you'))})</small>` : ''}</td><td>${fmt(w.banked)}</td><td>${w.tier ? roman(w.tier) : '—'}</td><td>${w.sunk}</td></tr>`).join('');
  return `<p class="muted bl-small">${esc(L('week.hint'))}</p><table class="bl-week"><thead><tr><th>#</th><th>${esc(L('week.name'))}</th><th>${esc(L('week.banked'))}</th><th>${esc(L('week.tier'))}</th><th>${esc(L('week.sunk'))}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** The Raft's window. */
export function renderRaft(root: HTMLElement, state: ClientState, send: Send, close: () => void): void {
  const v = state.self?.blight;
  if (!v) return;
  const silver = state.self?.gold ?? 0;
  if (!BJ_STAKES[coin].includes(stake)) stake = BJ_STAKES[coin][0];
  const keep = root.querySelector('.modal-body')?.scrollTop ?? 0;
  const was = root.querySelector<HTMLElement>('.bl-raft')?.dataset.tab;
  const page = tab === 'raft' ? raftPage(v) : tab === 'bj' ? bjPage(v, state.blightBj, silver) : tab === 'shop' ? shopPage(v, state) : tab === 'dice' ? dicePage(v, silver)
    : tab === 'chapter' ? `<div class="bl-chapter"><b class="bl-ch-h">${esc(L('ch.card', { title: tr(BLIGHT_CHAPTER.title) }))}</b>${chapterBody(v)}${contractsHtml(v)}</div>` : weekPage(v);
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(tr(RAFT_NAME))}</h2><div class="sub" title="${esc(tr(MARKS_NAME))}">${esc(L('raft.sub', { n: fmt(v.marks) }))}</div></div></div>
    <div class="tabs bl-tabs" role="tablist">${TABS.map((t) => `<div class="tab${t === tab ? ' active' : ''}" role="tab" tabindex="0" aria-selected="${t === tab}" data-bltab="${t}">${esc(L(`tab.${t}`))}</div>`).join('')}</div>
    <div class="modal-body dice bl-raft" data-tab="${tab}">${page}
      <div class="dc-foot bl-foot"><button class="btn btn-small btn-danger" data-blleave>${esc(L('raft.leave'))}</button><button class="btn btn-small" data-blclose>${esc(L('raft.close'))}</button></div>
    </div>`;
  const body = root.querySelector<HTMLElement>('.modal-body');
  if (body && was === tab) body.scrollTop = keep;
  const redo = () => renderRaft(root, state, send, close);
  root.querySelectorAll<HTMLElement>('[data-bltab]').forEach((b) => {
    const go = () => {
      tab = b.dataset.bltab as Tab;
      picking = null;
      redo();
    };
    b.onclick = go;
    b.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    };
  });
  root.querySelector<HTMLElement>('[data-blleave]')?.addEventListener('click', () => send({ t: 'blight', action: 'leave' }));
  root.querySelector<HTMLElement>('[data-blclose]')?.addEventListener('click', close);
  // twenty-one
  root.querySelectorAll<HTMLElement>('[data-bjcoin]').forEach((b) => (b.onclick = () => {
    coin = b.dataset.bjcoin as BjCoin;
    stake = BJ_STAKES[coin][0];
    redo();
  }));
  root.querySelectorAll<HTMLElement>('[data-bjstake]').forEach((b) => (b.onclick = () => {
    stake = Number(b.dataset.bjstake);
    redo();
  }));
  root.querySelectorAll<HTMLElement>('[data-bj]').forEach((b) => (b.onclick = () => {
    const op = b.dataset.bj as 'deal' | 'hit' | 'stand' | 'double';
    if (op === 'deal') send({ t: 'blight', action: 'bj', op, coin, stake });
    else send({ t: 'blight', action: 'bj', op });
  }));
  // the shop
  root.querySelectorAll<HTMLElement>('[data-blbuy]').forEach((b) => (b.onclick = () => {
    const id = b.dataset.blbuy as BlightWare;
    if (id === 'reroll') {
      picking = 'list';
      return redo();
    }
    send({ t: 'blight', action: 'buy', id });
  }));
  root.querySelectorAll<HTMLElement>('[data-blpiece]').forEach((b) => (b.onclick = () => {
    picking = Number(b.dataset.blpiece);
    redo();
  }));
  root.querySelectorAll<HTMLElement>('[data-blline]').forEach((b) => (b.onclick = () => {
    if (typeof picking !== 'number') return;
    send({ t: 'blight', action: 'buy', id: 'reroll', uid: picking, line: Number(b.dataset.blline) });
    picking = null;
    redo();
  }));
  root.querySelector<HTMLElement>('[data-blback]')?.addEventListener('click', () => {
    picking = typeof picking === 'number' ? 'list' : null;
    redo();
  });
  // the dice: the port's own orders serve the Raft
  root.querySelectorAll<HTMLElement>('[data-act="dice_open"]').forEach((b) => (b.onclick = () => send({ t: 'dice', action: 'open', stake: Number(b.dataset.stake) })));
  root.querySelectorAll<HTMLElement>('[data-act="dice_join"]').forEach((b) => (b.onclick = () => send({ t: 'dice', action: 'join', id: Number(b.dataset.id) })));
  root.querySelectorAll<HTMLElement>('[data-act="dice_davy"]').forEach((b) => (b.onclick = () => send({ t: 'dice', action: 'open', stake: 0, davy: true })));
  bindBlightChapter(root, send);
}

/** Between the server's words: only the lantern's clock moves (a whole redraw could swallow a tap). */
export function tickRaft(root: HTMLElement, state: ClientState): void {
  const v = state.self?.blight;
  const el = root.querySelector<HTMLElement>('[data-bl-lantern]');
  if (v && el) el.textContent = L('raft.lantern', { t: clock(v.lantern - Date.now()) });
}

/** What the window draws from: it is drawn again only when this moves (a redraw each state would swallow taps). */
export function raftKey(state: ClientState): string {
  const v = state.self?.blight;
  if (!v) return '';
  const bj = state.blightBj;
  return JSON.stringify([lang(), v.marks, v.hold, v.best, v.weekTitle, v.lantern > Date.now(), v.moored, v.ch, v.contracts, v.shop, v.bj, v.week, v.dice, v.davy, v.tables, bj, state.self?.gold, tab === 'shop' && picking !== null ? [state.self?.stash.length, picking] : 0]);
}
