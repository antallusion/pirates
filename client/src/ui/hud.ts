// In-game HUD: captain, ship condition, combat (ammo, reloads, abilities), navigation (wind, sails),
// minimap, prompts, toasts, banners and chat.

import { drawHubMark, isFerryHub } from './ferry.ts'; // owner, 2026-10-30: «Переход» hubs
import { artBgAttr, artBgWire } from './artfall.ts';
import { aimArt } from './artaim.ts';
import { zoneBossCard } from '../../../shared/src/data/paintart.ts';
import { drawFog, drawScouts, underFog } from '../render/fog.ts'; // the fog of war (owner, 2026-10-17)
import { drawIslesMini, isleFill, wireMiniTip } from './islemap.ts'; // docs/18 III
import { EN as SEAF_EN, RU as SEAF_RU } from '../lang/ui/seafight.ts';
import { drawLfgFlag, drawSignalFlag, liveSignals, signalBar, worldGoalPlate } from './social.ts';
import type { SignalKind } from '../../../shared/src/data/social.ts';
import { regattaPanel } from './regatta.ts';
import { stormPanel } from './storms.ts';
import { orderPanel } from './marque.ts';
import { descentPanel } from './descent.ts';
import { holidayLine } from './holidays.ts';
import { nemesisLabel } from './nemesis.ts';
import { pirateById } from '../../../shared/src/data/pirates.ts';
import { BEASTS, beastOfClass, hullNoise, noiseBand } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { EN as REN, RU as RRU } from '../lang/ui/render.ts';
import { placeName } from './maps.ts';
import { THREAT_COLOR } from '../../../shared/src/data/shiplevel.ts';
import { levelPct } from '../../../shared/src/data/xpcurve.ts';
import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { levelChip, threatTo } from './levels.ts';
import { shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { DASH_COOLDOWN } from '../../../shared/src/data/gunnery.ts';
import { dict, lang, plural, t } from '../i18n.ts';
import type { Key } from '../i18n.ts';
import { term } from './terms.ts';
import { drawRelation, relationOf, RELATION_COLOR } from '../render/relation.ts';
import { cbColor, keyLabel, settings } from '../settings.ts';
import type { Action } from '../settings.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { AMMO, AMMO_IDS, KEYED_AMMO, MOUNTS, SHIP_CLASSES, isZoneBossClass } from '../../../shared/src/data/ships.ts';
import { isNight, nightFactor, timeOfDay } from '../../../shared/src/constants.ts';
import { clamp, headingVec } from '../../../shared/src/math.ts';
import { SF } from '../../../shared/src/protocol.ts';
import { activeTalents } from '../../../shared/src/data/talents.ts';
import { relWindDeg, windPush } from '../../../shared/src/sim/sailing.ts';
import { cargoVolume, tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { volleysToSink } from '../../../shared/src/sim/volleys.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { seasonName } from '../../../shared/src/world/worldgen.ts';
import { bandOf, captainBand, SECTOR_SIZE, sectorIndex } from '../../../shared/src/world/sectors.ts';
import type { SectorData } from '../../../shared/src/protocol.ts';
import { assetUrl, sprite } from '../assets.ts';
import type { ClientState } from '../state.ts';
import { $, bar, dec1, decorateSums, esc, fmt, glyphSvg, icon, knots, pct } from './dom.ts';
import { flagChip, flagMark, shipColours, skullsTip } from './flags.ts'; // docs/24 D2: her colours on the target card
import { compassKey, objective, questPointer, trackedQuest, waypoint, waypointHooks } from './track.ts';
import { courseAhead, courseOf } from './course.ts';
import { DAILY_DEFS } from '../../../shared/src/data/dailies.ts';
import { EN, RU } from '../lang/ui/hud.ts';
import { EN as PM_EN, RU as PM_RU } from '../lang/ui/premium.ts'; // the shop's button (owner, 2026-10-15)
import { LC as LCREW, fmt1, moodMark } from './crewlife.ts';
import { EN as CEN, RU as CRU } from '../lang/ui/colours.ts';
import { EN as SEN, RU as SRU } from '../lang/ui/livesea.ts';
import { ChatPanel } from './chat.ts';
import type { ChatChannel, ChatLine } from './chat.ts';
import { NAME_RU } from '../lang/data.ts';
import { serverText } from '../lang/server.ts';
import { weekChip } from './town.ts'; // docs/17 H3
import { drawAdvMini } from './advchart.ts'; // docs/17 H4
import { GUARDS } from '../../../shared/src/data/advmap.ts';
import { guardOfEntity } from '../render/advmap.ts';
import { drawDriftsMini } from '../render/drifts.ts';
import { drawFindsMini } from '../render/seafinds.ts';
import { drawWaysMini } from '../render/waystations.ts'; // docs/35
import { drawRoamsMini } from '../render/roamers.ts';
import { drawCitadelsMini } from '../render/citadels.ts'; // docs/19 E4 // docs/19 D7
import { armyGlance } from './army.ts';
import { detailAttr } from './detailattr.ts';
import { EN as DET_EN, RU as DET_RU } from '../lang/ui/detail.ts';
import { holdMix, holdMixHtml } from './holdmix.ts';
import { gloryChip } from './throne.ts'; // docs/19 E1
import { Toasts } from './kit/toast.ts'; // docs/23 phase 1
import { TOAST } from './kit/tokens.ts';
import { escortBars, escortKey, escortRowHtml, holdKey, holdRowHtml } from './escortbars.ts'; // forum 2026-10-30: the hold's bar, the escorts' bars
import { avatar } from './kit/avatar.ts'; // her face in its ring (docs/32 §12: her frame), shared/src/data/portraitfit.ts
import { captainDot } from './capmenu.ts'; // seaux: the bead is news not yet seen
import { drawWrecksMini } from '../render/castaways.ts'; // seaux: her wreckage and castaways on the chart

const L = dict(EN, RU);
const LSF = dict(SEAF_EN, SEAF_RU); // the quick sea fight (docs/23 phases 3–4)
/** The battles the server plays out for a chance (server/src/game/boardodds.ts ODDS_SIMS). */
const ODDS_SIMS_SHOWN = 200;
const RL = dict(REN, RRU);
const DL = dict(DET_EN, DET_RU);
/** A name or sentence that came from the server, in the player's language. */
const sv = (s: string): string => (lang() === 'ru' ? NAME_RU.get(s) ?? serverText(s) : s);
const wantedTitle = (n: number): string => L(`wanted.${Math.max(0, Math.min(5, n))}` as keyof typeof EN & string);

/** Her colours and skulls on the sea HUD's frame (forum 34): the flag she flies, ☠×N when she has skulls — locked
 *  colours and the wash in its title (the frame opens the captain's menu; the ship's window has the flag card). */
function skullBadge(state: ClientState): string {
  const v = state.self?.pvp;
  if (!v || (v.flag !== 'pirate' && !v.skulls)) return '';
  const tip = skullsTip(state);
  return `<b class="cs-law${v.skulls ? ' sk' : ''}" title="${esc(tip)}" aria-label="${esc(tip)}">${flagMark(v.flag, v.city, 'cs-fl')}${v.skulls ? `<span>☠${v.skulls}</span>` : ''}</b>`;
}

/** One simple sea HUD for every input (owner, 2026-10-07), unless «Подробный интерфейс» is on (settings: expertHud). */
export function simpleHud(): boolean {
  return !!globalThis.document?.body?.classList.contains('simple');
}

/** The captain's record for her sheet (owner, 2026-10-07: «Unknown to the law», the experience and the rest left the
 *  HUD's plate for the captain's sheet): her experience to the next level (and the rested stretch), where she stands
 *  with the law, a talent point waiting, the Throne's glory. */
export function captainRecord(state: ClientState): string {
  const self = state.self;
  if (!self) return '';
  const f = self.xp / Math.max(1, self.xpNext);
  const next = xpLine(self);
  const rest = self.rested > 0 ? `<b class="xp-rest" style="left:${pct(f)};width:${pct(Math.min(self.rested, Math.max(0, self.xpNext - self.xp)) / Math.max(1, self.xpNext))}"></b>` : '';
  const law = self.wanted ? `<span class="hx-law bad">${icon('wanted', '☠', 'ico-sm')}${esc(wantedTitle(self.wanted))}</span>` : `<span class="hx-law muted">${esc(L('unknownToLaw'))}</span>`;
  const pts = self.talentPoints > 0 ? `<span class="hx-pts gold">${icon('xp', '', 'ico-sm')}${esc(keyless(L('talentPts', { n: self.talentPoints })))}</span>` : '';
  return `<div class="hx-record">
    <div class="hx-xp"${self.rested > 0 ? ` title="${esc(L('rested', { n: fmt(self.rested) }))}"` : ''}><span class="hx-xpl">${icon('xp', '', 'ico-sm')}${esc(L('lv', { n: self.level }))}</span><div class="fbar xp"><i style="width:${pct(f)}"></i>${rest}</div><span class="hx-xpv" title="${esc(L('xpOf', { xp: fmt(self.xp), next: fmt(self.xpNext) }))}">${esc(next)}</span></div>
    <div class="hx-recl">${law}${pts}${gloryChip(self.glory)}<span class="gold hx-silver">${icon('coin', '⛁', 'ico-sm')}${fmt(self.gold)}</span></div>
  </div>`;
}

/** «N% to the next level» (docs/26): what a captain reads off her experience; at the cap the bar is glory's (docs/19 E1),
 *  «N% to the next rank of glory». */
function xpLine(self: { level: number; xp: number; xpNext: number; glory?: { rank: number } }): string {
  if (self.level >= MAX_LEVEL) return L('xpToGlory', { n: levelPct(self.xp, self.xpNext), m: (self.glory?.rank ?? 0) + 1 });
  return L('xpToNext', { n: levelPct(self.xp, self.xpNext), m: self.level + 1 });
}

/** A window is open over the sea (the toasts keep to its strip then). */
function modalOpen(): boolean {
  return !$('modal').classList.contains('hidden');
}

/** The window closed: what its strip still shows goes back to the column, to run out its time there. */
export function releaseModalToasts(): void {
  const strip = $('modal-toasts'), col = $('toasts');
  for (const el of [...strip.children].reverse()) col.prepend(el);
}

/** The window's strip in the bottom band, or in the top one when the window has its buttons along its foot (the
 *  waystation's «Воскресить · В море», the cast-off's list): a toast lay over their words (QA 2026-10-22) — or, when its
 *  top is a strip of tabs as well (the Throne: «Вперёдсмотрящий…» over «Слава · Мастерство…», late-game QA 2026-10-23),
 *  just under that strip: the lane that covers no button (stripLane). */
export function placeModalStrip(strip: HTMLElement): void {
  const panel = document.getElementById('modal-panel');
  const btns: Box[] = [];
  for (const b of panel?.querySelectorAll<HTMLElement>('button, .btn, a.k-btn, [role="tab"]') ?? []) {
    const r = b.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) btns.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  }
  const sa = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-t')) || 0;
  const lane = stripLane(btns, innerWidth, innerHeight, sa, Math.max(36, strip.getBoundingClientRect().height || 0), Math.min(560, innerWidth - 24));
  // (a kit sheet over the window has its own foot: styles.css keeps the strip up then)
  strip.classList.toggle('mt-top', lane !== 'bottom');
  strip.classList.toggle('mt-below', typeof lane === 'number');
  if (typeof lane === 'number') strip.style.setProperty('--mt-below', `${Math.round(lane)}px`);
}

interface Box { left: number; top: number; right: number; bottom: number }
/** Where the window's toast strip goes: the bottom band, the top band, or (a number) its top just under the window's own
 *  row of tabs and buttons at its head — the first of these that lies over no button, else the one over fewest. */
export function stripLane(btns: Box[], vw: number, vh: number, saTop: number, h: number, w: number): 'bottom' | 'top' | number {
  const left = (vw - w) / 2, right = left + w;
  const over = (y0: number): number => btns.filter((b) => b.right > left && b.left < right && b.bottom > y0 && b.top < y0 + h).length;
  const bottomY = vh - 6 - h, topY = saTop + 6;
  // the head row: the buttons (tabs, the close cross) standing in the top quarter of the screen
  const head = btns.filter((b) => b.top < saTop + vh * 0.25);
  const belowY = head.length ? Math.max(...head.map((b) => b.bottom)) + 4 : topY;
  const cands: ['bottom' | 'top' | number, number][] = [['bottom', over(bottomY)], ['top', over(topY)], [belowY, over(belowY)]];
  return cands.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

/** A short screen (a phone, a small window): the action bar fills its bottom, the toasts keep to the top row. */
const SHORT = '(max-width: 699px), (max-height: 520px)';

/** The top stack's blocks that fold behind its button (the rest is what is happening now). */
/** A fight on the screen whose field the sea's news must not cover: the hexes (body.tac) or the deck fight. */
export function fightOnScreen(): boolean {
  const b = globalThis.document?.body?.classList;
  return !!b && (b.contains('tac') || b.contains('boarding'));
}
/** The sea's news waits: a fight on the screen, or a long passage under ×10 (owner, 2026-10-28, passage.ts — at that
 *  pace the lookout's sightings and the islands charted came by the dozen, and her own small word was lost among them). */
export function newsHeld(): boolean {
  return fightOnScreen() || !!globalThis.document?.body?.classList.contains('voyage');
}
/** At most this many of the sea's toasts wait out a fight (the newest kept). */
export const HELD_MAX = 4;
/** How long the lawless waters' notice stays in the top band (ms): a few seconds to be read whole. */
export const LAWLESS_NOTE_MS = 6500;

export const FOLDED = ['hud-tip', 'hud-fish', 'hud-order', 'hud-holiday', 'hud-world', 'hud-goals', 'hud-feed'];
/** On a phone the captain's sea orders and a group's signal flags fold away too, into the same sheet (docs/23 item 97:
 *  with them the sea had 9–13 things to tap, not 5–7); the desk keeps them on its HUD. */
export const TOUCH_FOLDED = [...FOLDED, 'hud-orders', 'hud-signals'];

/** The transient blocks of the top stack (a hint, the sea's news, a boss's card), styles.css puts them at its head. */
const TRANSIENT = ['hud-tip', 'hud-boss', 'hud-feed'];
/** The screen's centre that transient text must keep out of (the owner's popup budget, 2026-10-04): 30–70 % both ways. */
export const CENTRE = { from: 0.3, to: 0.7 };
/** The popup budget (owner, 2026-10-04: «every transient text lives in a top or bottom band, never over the centre»).
 *  An unfolded stack under a boss's card can run the news down to half the screen: then the hint, the card and the news
 *  grow terser (`pb-1`: one line of news, the card without its parts and words), and if that is not enough, the news
 *  steps out — it is in the chat's log — and the hint keeps one line (`pb-2`); on a short screen the hint waits
 *  too (`pb-3`). */
export function fitTransient(): void {
  const body = document.body;
  const over = (): boolean => {
    const W = innerWidth, H = innerHeight;
    for (const id of TRANSIENT) {
      const e = document.getElementById(id);
      if (!e || e.classList.contains('hidden')) continue;
      const r = e.getBoundingClientRect();
      if (r.height < 2 || r.width < 2) continue;
      if (r.left < W * CENTRE.to && r.right > W * CENTRE.from && r.top < H * CENTRE.to && r.bottom > H * CENTRE.from) return true;
    }
    // …or all the passing words together over the budget's 15% of the screen (with a margin).
    return popupShare() > 0.14;
  };
  const STEPS = ['pb-1', 'pb-2', 'pb-3'] as const; // (pb-3: a short screen — the hint waits too, its card stays)
  // (batch-pc: from the step it stands at, measured as the page is laid — no class written while nothing changes. A
  // terser step is never larger, so over at this step means over at every one before it: step on from here. Under the
  // budget at a terser step: the plainer ones are tried again from the start, as before.)
  let at = 0;
  while (at < STEPS.length && body.classList.contains(STEPS[at])) at++;
  if (at === 0 || over()) {
    if (at === 0 && !over()) return;
    while (at < STEPS.length) {
      body.classList.add(STEPS[at++]);
      if (at === STEPS.length || !over()) return;
    }
    return;
  }
  body.classList.remove(...STEPS);
  if (!over()) return;
  for (const c of STEPS) {
    body.classList.add(c);
    if (c === 'pb-3' || !over()) return;
  }
}

/** What share of the screen the passing words cover now: the stack's hint, news and boss's card, the toasts in their
 *  band, the adventure map's and the encounter's cards (each box once; overlaps are rare and counted twice). */
export function popupShare(): number {
  let area = 0;
  const band = document.getElementById('toasts')?.getBoundingClientRect();
  for (const e of document.querySelectorAll<HTMLElement>('#hud-tip, #hud-boss, #hud-feed, #advcard, #encounter, #toasts > .toast, #hud-prompt .act-info')) {
    if (e.classList.contains('hidden') || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') continue;
    let r = e.getBoundingClientRect();
    if (band && e.parentElement?.id === 'toasts') r = new DOMRect(Math.max(r.left, band.left), Math.max(r.top, band.top), Math.max(0, Math.min(r.right, band.right) - Math.max(r.left, band.left)), Math.max(0, Math.min(r.bottom, band.bottom) - Math.max(r.top, band.top)));
    area += r.width * r.height;
  }
  return area / Math.max(1, innerWidth * innerHeight);
}

/** What the popup budget's measure depends on, read without a layout (batch-pc: fitTransient and the toasts' clipping
 *  measured every frame of a sea fight — something in the stack or on <body> is touched each frame (a toast's live
 *  counter, a class set again), and each touch forced a whole layout; 18 FPS on a desk slowed 4×): the screen, the
 *  classes and inline styles that place the blocks (the pb-* steps and tq-out, the measure's own output, left out),
 *  how many blocks, and the words of those matching `words` by their length. A block's size changing with the same
 *  signature is a ResizeObserver's word (Hud's constructor). The same signature, the same rects: no measure. */
export function layoutSig(sel: string, outCls: RegExp, words = ''): string {
  const d = document, parts: (string | number)[] = [innerWidth, innerHeight, d.documentElement.getAttribute('style') ?? '', d.body.className.replace(outCls, ''), d.body.getAttribute('style') ?? ''];
  for (const e of d.querySelectorAll<HTMLElement>(sel)) parts.push(e.id, e.className.replace(outCls, ''), e.getAttribute('style') ?? '', e.childElementCount, words && e.matches(words) ? e.textContent?.length ?? 0 : '');
  return parts.join('|');
}
/** The blocks the popup budget sums (popupShare's and fitTransient's) and the stack they stand in. */
export const BUDGET_SEL = '#hud-stack, #hud-tip, #hud-boss, #hud-feed, #advcard, #encounter, #toasts, #toasts > .toast, #hud-prompt .act-info';
/** The action bar's hint line is laid anew with its words (no box kept to observe): counted by its words. */
export const BUDGET_WORDS = '.act-info';
// (k-toast-out: a leaving toast's fade — opacity only, the budget counts it the same until it is gone)
export const PB_CLS = /\b(pb-[123]|k-toast-out)\b/g;
/** The toasts' band and its toasts (the clipping's inputs). */
export const CLIP_SEL = '#toasts, #toasts > *';
export const CLIP_CLS = /\b(tq-out|k-toast-out)\b/g;

/** Whether the minimap's cached island layer must be laid again: she sailed a quarter of the dial off its centre, the
 *  scale changed (the Star Reader's night), an island came or went, or it is 3 s old (a find, a mist lifted). */
export function miniLayerStale(l: { cx: number; cy: number; k: number; n: number; at: number }, own: { x: number; y: number }, range: number, k: number, n: number, now: number): boolean {
  return l.k !== k || l.n !== n || now - l.at > 3000 || Math.abs(own.x - l.cx) > range / 2 || Math.abs(own.y - l.cy) > range / 2;
}

/** Run after the next frame is laid out and painted (a task queued from its animation frame): the page's layout is
 *  clean then, and reading a rect costs nothing — read in the animation frame itself, before the game's own writes are
 *  laid, each read forced a layout of its own (batch-pc). */
export function afterLayout(f: () => void): void {
  requestAnimationFrame(() => setTimeout(f, 0));
}

/** A CSS variable written only when its value changes (batch-pc: the toasts' placing wrote the same values again on
 *  every resize of the bottom block — each write dirtied the styles and the next rect read forced a layout). */
export function setVar(el: HTMLElement, k: string, v: string): void {
  if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v);
}
export function dropVar(el: HTMLElement, k: string): void {
  if (el.style.getPropertyValue(k) !== '') el.style.removeProperty(k);
}

/** A place for the toasts' strip (h tall) in a side column, out of the screen's middle columns (the popup budget's
 *  centre is 30–70% of the width), clear of every HUD block there: the left column under the captain's plate, or the
 *  right one under the chart and its buttons — whichever has room higher up. Null when neither has. */
function sideSpot(h: number, z: number): { top: number; left: number; w: number } | null {
  const W = innerWidth, H = innerHeight;
  const rects: DOMRect[] = [];
  const seen = (e: Element) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  for (const e of document.querySelectorAll('#hud-captain *, #hud-ship, #hud-map, #hud-region, #unread, #chat-toggle, #chat, #touch > :not(.hidden), #hud-menu, #hud-bottom, #advcard, #hud-nav, #hud-stack > :not(.hidden)')) {
    if (!seen(e)) continue;
    let r = e.getBoundingClientRect();
    // What the top stack scrolls out of sight is not in the way (its target card ran 50 px under its 104 px).
    if (e.parentElement?.id === 'hud-stack') {
      const s = e.parentElement.getBoundingClientRect();
      r = new DOMRect(r.left, Math.max(r.top, s.top), r.width, Math.max(0, Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top)));
    }
    if (r.width > 1 && r.height > 1) rects.push(r);
  }
  // Down a side, row by row: the widest gap in the side's span clear of everything at that height (at 1280×720 with
  // the adventure card up, the left side is full; the right has room between the stack and the chart).
  const col = (x0: number, x1: number): { top: number; left: number; w: number } | null => {
    for (let t = 8 * z; t + h <= H - 8 * z; t += 4 * z) {
      const block = rects.filter((r) => r.top < t + h && r.bottom > t && r.left < x1 && r.right > x0).sort((p, q) => p.left - q.left);
      let at = x0, best: { left: number; w: number } | null = null;
      for (const r of [...block, { left: x1, right: x1 } as DOMRect]) {
        const gap = Math.min(r.left, x1) - 6 * z - at;
        if (gap >= 160 * z && (!best || gap > best.w)) best = { left: at, w: gap };
        at = Math.max(at, r.right + 6 * z);
      }
      if (best) return { top: t, left: best.left, w: best.w };
    }
    return null;
  };
  const a = col(8 * z, W * CENTRE.from - 8 * z), b = col(W * CENTRE.to + 8 * z, W - 8 * z);
  return a && b ? (b.top < a.top ? b : a) : a ?? b;
}

/** Two names that say the same (a great one's hull is named as it is: «Сборщица Десятины · Сборщица Десятины»). */
const sameWords = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

export class Hud {
  private lastCaptainKey = '';
  /** The glory chip on the plate opens the Throne (docs/19 E1). */
  onThrone: () => void = () => {};
  /** An escort's chip on the plate (forum 2026-10-30): the camera looks at her a moment (main.ts). */
  onEscort: (eid: number) => void = () => {};
  /** The overload's toast once per overload (forum 2026-10-30). */
  private overWarned = false;
  /** The premium shop (owner, 2026-10-15): the doubloons' chip by her silver. */
  onShop: () => void = () => {};
  /** The exchange of doubloons into silver (owner, 2026-10-30): the «+» by her silver. */
  onExchange: () => void = () => {};
  /** The simple HUD's captain on a desk: a click opens her sheet (main.ts). */
  onCaptain: () => void = () => {};
  /** Owner, 2026-10-28 (armyadvice.ts): the weak army's hint — the island, or the hire window here (main.ts). */
  onAdvice: (to: 'isle' | 'hire') => void = () => {};
  /** Owner, 2026-10-28 (islefirst.ts): the island's first steps — the building's card on the island, the hire window. */
  onIsleFirst: (id: 'dw1' | 'dw2' | 'hire' | 'dw3' | 'army') => void = () => {};
  private i1Key = '';
  private adviceKey = '';
  private adviceOpen = false;
  private adviceAt = 0;
  /** seaux: her frame drawn afresh (the captain's menu seen: its bead out). */
  redrawCaptain(): void {
    this.lastCaptainKey = '';
  }
  private lastShipKey = '';
  private lastCombatKey = '';
  private lastBossKey = '';
  private lastPartyKey = '';
  /** Tapping a groupmate's frame (main.ts): inspect them. */
  onPartyTap: (name: string) => void = () => {};
  /** Tapping the target frame of a captain's ship (main.ts): inspect them. */
  onTargetTap: (name: string) => void = () => {};
  /** A fishing order from the panel (main.ts). */
  onFishing: (action: 'trap' | 'haul' | 'deep' | 'salt' | 'cast') => void = () => {};
  /** The key that casts the net (main.ts: the player may rebind it) and whether a haul is being played. */
  castKey = ' (L)';
  hauling = false;
  onHunt: (action: 'slack' | 'cut' | 'flense', id?: number) => void = () => {};
  onTribute: (id: number) => void = () => {};
  private lastHuntKey = '';
  private lastRegattaKey = '';
  private lastStormKey = '';
  private lastOrderKey = '';
  private lastDescentKey = '';
  private lastHolidayKey = '';
  private lastFishKey = '';
  private lastTargetKey = '';
  private toastsEl = $('toasts');
  /** The toasts' strip on a short screen, measured again as a toast comes (the chart's lines may have grown). */
  private placeStrip: () => void = () => {};
  private minimap = $('minimap') as HTMLCanvasElement;
  /** docs/18 III: what the minimap shows, for its tooltip. */
  private miniView: { x: number; y: number; range: number } | null = null;
  private miniState: ClientState | null = null;
  /** A long press on the minimap at a point of the sea (docs/23 item 30): main.ts marks it and sails; false = no. */
  onMiniMark: (x: number, y: number) => boolean = () => false;
  onAbility: (id: string) => void = () => {};
  onAmmo: (id: string) => void = () => {};
  onTalent: (id: string) => void = () => {};
  /** Phones show only the loaded shot: tapping it loads the next kind. */
  onAmmoCycle: () => void = () => {};
  private lastPrompt = '\u0000';
  private lastRegion = '';
  private lastMinimap = 0;
  private lastNav = 0;
  /** Whether the nav plate has a box (a ResizeObserver's word: no layout forced each frame to ask — batch-pc). */
  private navShown = false;
  private navHtml = '';
  private gaugeEls = new Map<string, { el: HTMLElement; fill: HTMLElement }>();
  private cdEls = new Map<string, { cd: HTMLElement; cdt: HTMLElement; charge: HTMLElement | null }>();
  /** Bumped when art finishes loading so slots rebuild with their icons. */
  artEpoch = 0;

  constructor() {
    // (batch-pc: «offsetParent» asked every 66 ms after the frame's writes forced a whole layout — 18% of a slowed
    // desk's frame in a sea fight; the observer says when the plate shows or goes)
    new ResizeObserver((es) => { for (const e of es) this.navShown = e.contentRect.width > 0 && e.contentRect.height > 0; }).observe($('hud-nav'));
    wireMiniTip(this.minimap, () => this.miniView, () => this.miniState, (x, y) => this.onMiniMark(x, y)); // docs/18 #26: name · ⚓level · kind; docs/23 #30: a long press marks
    // Her own mark reached: a word, and the «Now:» line moves on.
    waypointHooks.onArrive = () => this.toast(L('wpArrived'), 'good');
    // The unit frame opens the ship's full condition on screens too small to keep it out.
    // It drops open under the frame's lowest edge (portrait, bars and the line under them), measured as it opens.
    $('hud-captain').onclick = (e) => {
      if ((e.target as HTMLElement).closest('[data-hudshop]')) return this.onShop();
      if ((e.target as HTMLElement).closest('[data-hudexch]')) return this.onExchange();
      // glory, always on the plate (owner, 2026-10-19): the Throne of the Sea
      if ((e.target as HTMLElement).closest('[data-throne]')) return this.onThrone();
      const escort = (e.target as HTMLElement).closest<HTMLElement>('[data-esc]'); // an escort's bars: look at her
      if (escort) return this.onEscort(Number(escort.dataset.esc));
      if (simpleHud()) return this.onCaptain();
      if (document.body.classList.toggle('ship-open')) placeShipPanel();
    };
    $('hud-captain').addEventListener('keydown', (e) => {
      if (!simpleHud() || (e.key !== 'Enter' && e.key !== ' ') || (e.target as HTMLElement).closest('[data-esc]')) return;
      e.preventDefault();
      e.stopPropagation();
      this.onCaptain();
    });
    // A tap on the open panel folds it away again.
    $('hud-ship').onclick = () => document.body.classList.contains('touch') && document.body.classList.remove('ship-open');
    // The toast column stands on top of the bottom block, whatever its height (a prompt, a two-row action bar).
    const bottom = $('hud-bottom');
    // In the HUD's own pixels: the HUD is zoomed by the interface scale and density (docs/16 #40).
    // (batch-pc: cached by what sets it — the interface scale on <html>, the density's class on <body>, the screen —
    // a getComputedStyle per call forced a style pass several times a frame)
    let zoomKey = '', zoomVal = 1;
    const zoom = () => {
      const k = `${document.documentElement.getAttribute('style') ?? ''}|${document.body.className}|${innerWidth}x${innerHeight}`;
      if (k !== zoomKey) {
        zoomKey = k;
        zoomVal = Number(getComputedStyle($('hud')).zoom) || 1;
      }
      return zoomVal;
    };
    let placedAt = '';
    const place = () => {
      const r = bottom.getBoundingClientRect();
      setVar(document.body, '--hb-top', `${r.height > 0 ? Math.max(0, innerHeight - r.top) / zoom() : 0}px`);
      if (r.width > 0) setVar(document.body, '--hb-left', `${Math.round(r.left / zoom())}px`); // the desk's toasts keep left of it
      // A short screen: the action bar's hint line takes the fire mode's line inside the bar (styles.css «ai-low»),
      // in the bottom band — over the buttons it stood in the screen's middle (QA circle: 64–68% of 640×360).
      const mode = bottom.querySelector<HTMLElement>('.ab-mode');
      const mr = mode?.getBoundingClientRect();
      const low = matchMedia(SHORT).matches && !!mr && mr.height > 0;
      document.body.classList.toggle('ai-low', low);
      if (low) setVar(document.body, '--abm-b', `${Math.round((r.bottom - mr!.bottom) / zoom())}px`);
      // the toasts' band follows the block's height — when it moved (batch-pc: a button popping in resized the block
      // frame by frame and each frame measured the whole top band again)
      const at = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.height)}|${low}|${innerWidth}x${innerHeight}`;
      // (the simple HUD's band is the top one — the captain's plate, the chart, the corner's buttons — not the bottom's)
      if (at === placedAt || simpleHud()) return;
      placedAt = at;
      this.placeStrip();
    };
    new ResizeObserver(place).observe(bottom);
    addEventListener('resize', place);
    // On a wide screen the toasts stand under the chart's lines, however many there are (a quest, world events).
    const region = $('hud-region');
    const under = () => setVar(document.body, '--rg-bottom', `${Math.round(region.getBoundingClientRect().bottom / zoom())}px`);
    new ResizeObserver(under).observe(region);
    addEventListener('resize', under);
    // A short screen's bottom is the action bar's: there the toasts keep to the top row, from the fold button to the
    // first thing on its right (the chart, the menu button), as tall as the button (the popup budget, styles.css).
    const fold = $('hud-fold'), stack = $('hud-stack');
    this.placeStrip = () => {
      if (simpleHud()) return this.placeTopStrip(zoom());
      if (!matchMedia(SHORT).matches) return this.placeDeskStrip(zoom());
      document.body.classList.remove('tq-side');
      const z = zoom(), f = fold.getBoundingClientRect(), st = stack.getBoundingClientRect();
      if (!st.width) return;
      const top = st.top, h = Math.max(40 * z, f.height) + 4 * z, left = (f.width ? f.right : st.left) + 8 * z;
      let right = innerWidth - 8 * z;
      for (const el of document.querySelectorAll('#hud-map, #tc-menu, #tc-news, #chat-toggle, #unread, #hud-region')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.left > left && r.top < top + h && r.bottom > top) right = Math.min(right, r.left - 8 * z);
      }
      const set = (k: string, v: number) => setVar(document.body, k, `${Math.round(v / z)}px`);
      set('--ts-top', top);
      set('--ts-left', left);
      set('--ts-w', Math.max(120 * z, right - left));
      set('--ts-h', h);
      // The adventure map's card takes this row (styles.css): the toasts go under the captain's plate, at the left,
      // in the width left of the screen's middle columns (the popup budget's centre begins at 30%).
      const card = document.getElementById('advcard');
      // (the First Watch's lesson takes this row as well on a short screen: the fold's button stands beside it)
      const lesson = matchMedia('(max-height: 520px)').matches && !!document.querySelector('#hud-stack > #hud-watch:not(.hidden):not(.tut-hidden)');
      const spot = (card && !card.classList.contains('hidden')) || lesson ? sideSpot(h, z) : null;
      if (spot) {
        set('--tq-top', spot.top);
        set('--tq-left', spot.left);
        set('--tq-w', spot.w);
      } else for (const k of ['--tq-top', '--tq-left', '--tq-w']) dropVar(document.body, k);
    };
    new MutationObserver(() => this.placeStrip()).observe($('advcard'), { attributes: true, attributeFilter: ['class'] });
    // (the simple HUD's top band follows the captain's plate, the chart and the card unfolded or folded; the toasts the
    // round buttons under the chart as they come and go)
    let bandAsked = false;
    const band = () => {
      if (bandAsked) return;
      bandAsked = true;
      requestAnimationFrame(() => {
        bandAsked = false;
        this.placeStrip();
      });
    };
    const ro = new ResizeObserver(band);
    for (const id of ['hud-captain', 'hud-map', 'advcard', 'encounter', 'surrender', 'lairchest', 'hud-autosail']) ro.observe($(id));
    for (const id of ['encounter', 'surrender', 'lairchest', 'hud-autosail']) new MutationObserver(band).observe($(id), { attributes: true, attributeFilter: ['class'] });
    // (a toast gone: the island's step it stood in for comes back — placeTopStrip's i1-yield)
    new MutationObserver(() => { if (simpleHud()) band(); }).observe(this.toastsEl, { childList: true });
    $('hud-map').addEventListener('transitionend', band); // (back down from behind its tab: its top line once it is there)
    // (the «⋯» tray's buttons fly in: measured again once each is in its place)
    for (const ev of ['animationend', 'transitionend']) $('touch').addEventListener(ev, () => { if (document.body.classList.contains('more-open')) band(); });
    new MutationObserver((ms) => { if (ms.some((m) => m.target instanceof HTMLElement && /^(tc-news|tc-menu|tc-isle)$/.test(m.target.id))) band(); }).observe($('touch'), { attributes: true, attributeFilter: ['class'], subtree: true });
    // The chart and the menu stepping up or down (seahud.ts mm-peek): the top band takes or gives back their room.
    let peekWas = false;
    let moreWas = false;
    new MutationObserver(() => {
      const peek = document.body.classList.contains('mm-peek');
      // (and the «⋯» tray opening or closing: the toasts and the island's step keep clear of its row)
      const more = document.body.classList.contains('more-open');
      if (peek === peekWas && more === moreWas) return;
      peekWas = peek;
      moreWas = more;
      this.placeStrip();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(() => this.placeStrip()).observe($('hud-watch'), { attributes: true, attributeFilter: ['class'] });
    new ResizeObserver(this.placeStrip).observe(stack);
    addEventListener('resize', this.placeStrip);
    // The popup budget: the hint, the news and a boss's card keep out of the screen's centre, terser step by step.
    // (batch-pc: measured only when what it measures changed — layoutSig — not on every touch of the stack or <body>;
    // the budget's steps are the same)
    let fitting = false, fitSig = '', fitForced = false;
    const fit = (force?: unknown) => {
      if (force === true) fitForced = true;
      if (fitting) return;
      fitting = true;
      afterLayout(() => {
        fitting = false;
        const sig = layoutSig(BUDGET_SEL, PB_CLS, BUDGET_WORDS);
        if (sig === fitSig && !fitForced) return;
        fitForced = false;
        fitTransient();
        fitSig = layoutSig(BUDGET_SEL, PB_CLS, BUDGET_WORDS);
      });
    };
    new MutationObserver(fit).observe(stack, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    new ResizeObserver(fit).observe(stack);
    // (the budget's sum: the adventure map's card and the toasts count too)
    new MutationObserver(fit).observe($('advcard'), { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(fit).observe(this.toastsEl, { childList: true });
    new MutationObserver(fit).observe($('hud-prompt'), { childList: true });
    addEventListener('resize', fit);
    // A toast the band has no room for wraps into a column past its edge, clipped out of sight: hidden outright, so it
    // is neither half-drawn at the edge nor taken for one lying over the chart or the menu (docs/22: hudOverlap at
    // 640×360 and 800×450). It shows again when the ones before it are gone.
    // (batch-pc: measured only when the band or its toasts changed — layoutSig — and the rects read in one pass before
    // any class is written: a toggle between two reads forced a layout per toast)
    let clipping = false, clipSig = '', clipForced = false;
    const clip = (force?: unknown) => {
      if (force === true) clipForced = true;
      if (clipping) return;
      clipping = true;
      afterLayout(() => {
        clipping = false;
        const sig = layoutSig(CLIP_SEL, CLIP_CLS);
        if (sig === clipSig && !clipForced) return;
        clipSig = sig;
        clipForced = false;
        const b = this.toastsEl.getBoundingClientRect();
        const out = [...this.toastsEl.children].map((t) => {
          const r = t.getBoundingClientRect();
          return r.left >= b.right - 2 || r.right <= b.left + 2 || r.top >= b.bottom - 2 || r.bottom <= b.top + 2;
        });
        [...this.toastsEl.children].forEach((t, i) => t.classList.toggle('tq-out', out[i]));
      });
    };
    new MutationObserver(clip).observe(this.toastsEl, { childList: true, subtree: true, characterData: true });
    new MutationObserver(clip).observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    new ResizeObserver(clip).observe(this.toastsEl);
    addEventListener('resize', clip);
    // A block of the budget, or a toast, that grew or shrank (its words changed and wrapped): measured again; words
    // changed in the same box (a toast's live counter, a boss's hull) are not.
    const sized = new ResizeObserver(() => {
      fit(true);
      clip(true);
    });
    for (const id of [...TRANSIENT, 'advcard', 'encounter']) { const e = document.getElementById(id); if (e) sized.observe(e); }
    for (const t of this.toastsEl.children) sized.observe(t);
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.addedNodes) if (n instanceof Element) sized.observe(n);
        for (const n of m.removedNodes) if (n instanceof Element) sized.unobserve(n);
      }
    }).observe(this.toastsEl, { childList: true });
    this.wireFold();
  }

  /** The simple HUD's toasts (owner, 2026-10-07: «перегруз сверху»): one band at the top, in the middle, under what
   *  the top band shows now (the lesson, a boss's line, her mark, the sea's name), clear of the captain and the chart. */
  private placeTopStrip(z: number): void {
    const body = document.body;
    body.classList.remove('tq-side');
    const W = innerWidth, gap = 10 * z;
    // The top band (owner, 2026-10-15: «выровнял по высоте четко по верху»): from the chart's top line, between the
    // captain's plate as it is seen (her portrait's ring, the bars, the coins) and the chart, one gap either side.
    let left = 8 * z, right = W - 8 * z;
    let bandTop = Infinity, bandBottom = 0;
    const frame = document.querySelector('#hud-captain .cs-frame');
    const fr = frame?.getBoundingClientRect();
    if (fr && fr.width) {
      const k = fr.width * 0.32; // the ring outside the face (seahud.css .cs-frame::after)
      left = Math.max(left, fr.right + k + gap);
      bandTop = fr.top - k;
      bandBottom = fr.bottom + k;
    }
    for (const el of document.querySelectorAll('#hud-captain :is(.cs-row, .cs-silver)')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      left = Math.max(left, r.right + gap);
      bandTop = Math.min(bandTop, r.top);
      bandBottom = Math.max(bandBottom, r.bottom);
    }
    // (the chart and the menu stepped up behind their tab with a mark, owner 2026-10-09: the tab is the corner's edge —
    // her mark's name has the menu's room then: «Слабое утешение» was cut to 85 of 116 px at 640×360)
    const peek = body.classList.contains('mm-peek');
    const chart = document.getElementById(peek ? 'mm-tab' : 'hud-map')?.getBoundingClientRect();
    if (chart && chart.width) {
      right = Math.min(right, chart.left - gap);
      if (!peek) bandTop = chart.top;
    }
    if (!Number.isFinite(bandTop)) bandTop = 8 * z;
    // the left row of round buttons (the chat, «Остров», her offer: seahud.css) stands under the plate as it is seen
    const plateBottom = bandBottom || bandTop + 40 * z;
    setVar(body, '--lr-top', `${Math.round((plateBottom + 8 * z) / z)}px`);
    bandBottom = Math.max(bandBottom, bandTop + 40 * z);
    // the round buttons under the chart (the chat's with the chart stepped up stands under its tab): the band keeps
    // clear of any that reach into it, the toasts of any beside them
    const seen = (el: Element) => { const c = getComputedStyle(el); return c.visibility !== 'hidden' && Number(c.opacity) > 0.05; };
    // (each with what hangs beside it: «Остров»'s word to its left, a desk's key chip on its corner — the column under
    // the chart, 2026-10-16)
    const corner = [...document.querySelectorAll('#tc-menu, #tc-news, #tc-isle, #hud-chat > .chat-toggle, #hud-chat > .chat-toast')].filter(seen)
      .map((el) => {
        const r = el.getBoundingClientRect();
        let l = r.left, t = r.top, rr = r.right, b = r.bottom;
        if (r.width) for (const c of el.querySelectorAll('.tc-isle-l, .kc')) { const q = c.getBoundingClientRect(); if (q.width && q.height) { l = Math.min(l, q.left); t = Math.min(t, q.top); rr = Math.max(rr, q.right); b = Math.max(b, q.bottom); } }
        return new DOMRect(l, t, rr - l, b - t);
      }).filter((r) => r.width > 0 && r.height > 0 && r.left > W / 2);
    for (const r of corner) if (r.top < bandBottom) right = Math.min(right, r.left - gap);
    // (the card unfolded reaches down beside the row: clear of it when that leaves the card room, else it stops above
    // the row — advcard.ts fit; the row never steps out of sight under it, owner 2026-10-18: «не должны исчезать никогда»)
    let cardRight = right;
    if (document.querySelector('#advcard:not(.hidden) .ac-card.open')) {
      let r2 = right;
      for (const r of corner) r2 = Math.min(r2, r.left - gap);
      if (r2 - left >= 150 * z) cardRight = r2;
    }
    // The column of the top band (her mark's line, a boss's line, the lesson, the sea's name) in the middle of the free
    // row, as wide as a long name with her bars and chips wants at most, else the whole row (640×360: a column forced
    // to the screen's middle cut her mark's name to «R…»).
    const half = Math.max(0, Math.min((right - left) / 2, 230 * z));
    const sw = Math.max(150 * z, half * 2), sx = Math.max(8 * z, (left + right) / 2 - sw / 2);
    const set = (k: string, v: number) => setVar(body, k, `${Math.round(v / z)}px`);
    set('--sk-left', sx);
    set('--sk-w', sw);
    // the adventure card spans the whole free row, as tall as the plate (seahud.css; it stands outside the HUD's zoom)
    const raw = (k: string, v: number) => setVar(body, k, `${Math.round(v)}px`);
    raw('--tb-top', bandTop);
    raw('--tb-left', left);
    raw('--tb-w', Math.max(150 * z, cardRight - left));
    raw('--tb-h', bandBottom - bandTop);
    // The autosail's line stays in sight under a card on top (an event's, the adventure map's, a struck ship's, a lair's
    // chest — they hide the column: 2026-10-15, «к цели: … · 4,6 км» and its «Стоп» went with it): stacked under the card.
    const as = document.getElementById('hud-autosail');
    let shift = 0;
    dropVar(body, '--as-shift');
    if (as && !as.classList.contains('hidden')) {
      const ar = as.getBoundingClientRect();
      for (const c of document.querySelectorAll('#advcard:not(.hidden), #encounter:not(.hidden), #surrender:not(.hidden), #lairchest:not(.hidden)')) {
        const r = c.getBoundingClientRect();
        if (!r.width || !r.height || r.top > innerHeight * 0.3 || r.right <= ar.left || r.left >= ar.right) continue;
        shift = Math.max(shift, r.bottom + 6 * z - ar.top);
      }
      if (shift > 0) {
        set('--as-shift', shift);
        // (stepped down beside the row of round buttons under the chart: clear of them)
        let r3 = sx + sw;
        for (const r of corner) if (r.top < ar.bottom + shift && r.bottom > ar.top + shift) r3 = Math.min(r3, r.left - gap);
        if (r3 < sx + sw) set('--sk-w', Math.max(150 * z, r3 - sx));
      }
    }
    // the toasts under what the column shows now (the lesson, a boss's line, her mark, the sea's name, the card)
    let top = bandTop;
    for (const el of document.querySelectorAll('#hud-stack > :not(.hidden), #advcard:not(.hidden)')) {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2 && r.top < innerHeight * 0.3) top = Math.max(top, r.bottom + 6 * z);
    }
    // The island's step is the column's last and least (owner, 2026-10-29: «чтобы никогда не накладывались»): a toast up
    // with no room for it under the column inside the top 30 % takes the step's slot while it is up (the step out of
    // sight, its place kept: nothing else moves); a step that would end past the 30 % waits out of sight as well.
    // (the «⋯» tray open: its row of buttons under the captain's plate reaches toward the middle — to 369 px at 740×360)
    const tray = body.classList.contains('more-open')
      ? [...document.querySelectorAll('#tc-more-tray, #touch > .more-fold, #hud-chat > .more-fold')].filter((el) => getComputedStyle(el).visibility !== 'hidden').map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0 && r.left < W / 2)
      : [];
    const onTray = (l: number, t: number, r: number, b: number) => tray.filter((q) => q.left < r && q.right > l && q.top < b && q.bottom > t);
    const i1 = document.getElementById('hud-isle1');
    let yieldIsle = false;
    if (i1 && i1.parentElement?.id === 'hud-stack' && !i1.classList.contains('hidden')) {
      const r = i1.getBoundingClientRect();
      if (r.height > 2) {
        const limit = innerHeight * 0.3;
        const up = [...this.toastsEl.children].filter((t) => !t.classList.contains('k-toast-out'));
        // (as tall as the one up — two lines in a narrow band — or one line for one coming)
        const th = Math.max(26 * z, ...up.map((t) => t.getBoundingClientRect().height));
        yieldIsle = r.bottom > limit + 1 || ((this.toastSoon || up.length > 0) && top + th > limit) || onTray(r.left, r.top, r.right, r.bottom).length > 0;
        if (yieldIsle) top = r.top;
      }
    }
    if (i1) i1.classList.toggle('i1-yield', yieldIsle);
    // (clear of the round buttons under the chart, and of the fight's on the right when the card unfolded sends them low)
    let tr = sx + sw;
    const fight = [...document.querySelectorAll('#tc-special, #tc-abil:not(.hidden), #tc-skill:not(.hidden), #tc-ammo, #tc-lock, #tc-fire, #tc-actrow')].filter(seen)
      .map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0 && r.left > W / 2 && r.top < top + 70 * z);
    // (the band two toasts tall at most: only what reaches into it)
    const tb = top + 70 * z;
    for (const r of [...corner, ...fight]) if (r.bottom > top && r.top < tb && r.left < tr + gap) tr = Math.min(tr, r.left - gap);
    let tl = Math.min(sx, Math.max(left, tr - sw));
    // too narrow there (a phone of 480 px with a card up): the toasts go under the captain's plate, at the left
    // (under the left row of round buttons: the chat, «Остров», her offer)
    const leftward = tr - tl < 150 * z;
    body.classList.toggle('tq-left', leftward);
    if (leftward) {
      tl = 8 * z;
      top = Math.max(top, bandBottom + 6 * z);
      // the left row of round buttons (the chat, «Остров», her offer — their words under them included): the toasts
      // under it, or beside it where under it they would reach the helm (480×270 in Telegram's layout with a boss)
      let rowT = Infinity, rowB = 0, rowR = 0;
      for (const el of document.querySelectorAll('#hud-chat > .chat-toggle, #tc-more, #tc-isle, #tc-offer, #tc-daily')) {
        if (!seen(el)) continue;
        for (const q of [el, ...el.querySelectorAll('.tc-isle-l, .tc-offer-t')]) {
          const r = q.getBoundingClientRect();
          if (!r.width || !r.height || r.left >= W / 2) continue;
          rowT = Math.min(rowT, r.top);
          rowB = Math.max(rowB, r.bottom);
          rowR = Math.max(rowR, r.right);
        }
      }
      if (rowR) {
        let helm = innerHeight;
        for (const el of document.querySelectorAll('#tc-stick, #tc-sail')) {
          const r = el.getBoundingClientRect();
          if (r.width && r.height && r.top > innerHeight / 2) helm = Math.min(helm, r.top);
        }
        if (rowB + 6 * z + 46 * z <= helm - 6 * z) top = Math.max(top, rowB + 6 * z);
        else {
          tl = rowR + gap;
          top = Math.max(bandBottom + 6 * z, rowT);
          // (clear of the top band's column where it reaches down beside them: left of it, or — the row of four under
          // the plate leaving too little beside it at 480×270, a boss's line down to there, 2026-10-18 — under it)
          let tr2 = tr, under = top;
          for (const el of document.querySelectorAll('#hud-stack > :not(.hidden), #advcard:not(.hidden)')) {
            const r = el.getBoundingClientRect();
            if (!(r.width > 2 && r.height > 2 && r.bottom > top && r.right > tl && r.left < tr)) continue;
            if (r.left >= tl) tr2 = Math.min(tr2, r.left - gap);
            under = Math.max(under, r.bottom + 6 * z);
          }
          if (tr2 - tl >= 150 * z) tr = tr2;
          else top = under;
        }
      }
    }
    // (one small line in the middle, not a strip across the screen: 46 % of the width at most)
    if (!leftward && tr - tl > innerWidth * 0.46) {
      const w = innerWidth * 0.46, mid = Math.min(Math.max((sx + sw / 2), tl + w / 2), tr - w / 2);
      tl = mid - w / 2;
      tr = mid + w / 2;
    }
    // (clear of the tray: beside it)
    const hit = onTray(tl, top, tr, top + 46 * z);
    if (hit.length) tl = Math.max(tl, ...hit.map((q) => q.right + gap));
    set('--st-top', top);
    set('--st-left', tl);
    set('--st-w', Math.max(120 * z, tr - tl));
  }
  /** A toast about to come up (the queue's `before`): the top band makes room for it before it is drawn. */
  private toastSoon = false;

  /** A taller screen: the toasts' band stands over the bottom block, under 30% of the height — unless the block is too
   *  tall to leave it room below the screen's middle (an act's hint and its buttons over the bar, at 1280×720: the band
   *  began at 68%) while the desk's own corner is taken (the adventure map's card, the chat): then a clear side
   *  column (QA circle, 2026-10-05). */
  private placeDeskStrip(z: number): void {
    const body = document.body;
    const card = document.getElementById('advcard');
    const desk = matchMedia('(min-width: 1100px) and (min-height: 600px)').matches && !body.classList.contains('touch') && !body.classList.contains('chat-open') && !body.classList.contains('tac') && !!card?.classList.contains('hidden');
    const b = $('hud-bottom').getBoundingClientRect();
    const hb = b.height > 0 ? innerHeight - b.top : 0;
    const h = Math.min(150 * z, Math.max(46 * z, innerHeight * 0.3 - hb - 6 * z));
    const roomy = innerHeight - hb - 6 * z - h >= innerHeight * CENTRE.to - 1;
    const spot = desk || roomy || body.classList.contains('tac') ? null : sideSpot(46 * z, z);
    body.classList.toggle('tq-side', !!spot);
    const set = (k: string, v: number) => setVar(body, k, `${Math.round(v / z)}px`);
    if (spot) {
      set('--tq-top', spot.top);
      set('--tq-left', spot.left);
      set('--tq-w', Math.min(spot.w, 440 * z));
    }
  }

  /** The goals, the sea's news, the holiday, the hints (owner, 2026-10-03: «столько текста… его нужно прятать… иконку
   *  слева, нажимая на которую было бы показано то, что сейчас»): folded behind one round button at the head of the
   *  top stack, its count of what is behind it on the button; what is happening now (a target, a boss, a storm, a race,
   *  a dive) stays out. Folded at first; the captain's choice is kept. */
  private wireFold(): void {
    const btn = $('hud-fold');
    const FOLD = 'gravetide.hudFold';
    const set = (folded: boolean) => {
      document.body.classList.toggle('hud-folded', folded);
      btn.setAttribute('aria-expanded', String(!folded));
      try { localStorage.setItem(FOLD, folded ? '1' : '0'); } catch { /* private mode */ }
    };
    set(localStorage.getItem(FOLD) !== '0');
    btn.onclick = () => set(!document.body.classList.contains('hud-folded'));
    const count = () => {
      // Its picture once the art is in (the HUD is built before the manifest).
      const art = btn.querySelector('img') ? null : assetUrl('icon.tab_letters') ?? assetUrl('icon.tab_board');
      if (art) btn.insertAdjacentHTML('afterbegin', `<img src="${art}" alt="" draggable="false" />`);
      const n = FOLDED.filter((id) => !document.getElementById(id)?.classList.contains('hidden')).length;
      btn.querySelector('b')!.textContent = n ? String(n) : '';
      btn.classList.toggle('hidden', n === 0 && document.body.classList.contains('hud-folded'));
    };
    new MutationObserver(count).observe($('hud-stack'), { subtree: true, attributes: true, attributeFilter: ['class'] });
    count();
  }

  show(on: boolean): void {
    for (const id of ['hud', 'hud-toasts', 'hud-chat']) $(id).classList.toggle('hidden', !on);
  }

  update(state: ClientState, prompt: string): void {
    this.releaseHeld();
    const self = state.self, you = state.you;
    if (!self || !you) return;
    this.drawBoss(state);
    this.drawParty(state);
    this.drawSignals(state);
    this.drawWorldGoal(state);
    this.drawFishing(state);
    this.drawHunt(state);
    this.drawRegatta(state);
    this.drawStorm(state);
    this.drawOrder(state);
    this.drawDescent(state);
    this.drawHoliday(state);
    this.drawAdvice(state);
    this.drawIsleFirst(state);
    const cap = CAPTAINS[self.captain];

    // Unit frame: portrait in its ring, name, silver, and the ship's hull, sails and crew (re-rendered on change).
    const url = assetUrl(cap.portrait);
    const streak = self.streak && self.streak.n >= 2 ? self.streak : null;
    const pod = podEffect(self.effects, state.estServerTime());
    // ПЕРЕГРУЗ (forum 2026-10-30): one small toast as the hold crosses her hull's line; again only after she lightens.
    const hold = self.hold;
    if (hold && hold.over && !self.dockedAt && !this.overWarned) {
      this.overWarned = true;
      this.toast(L('holdToast', { pct: hold.pct, n: hold.slow }), 'bad');
    } else if (!hold?.over) this.overWarned = false;
    if (simpleHud()) this.drawStatus(state);
    else {
    const ckey = `${state.cos?.eq.frame ?? ''}|${lang()}|${streak ? `${streak.n}:${streak.mul}` : ''}|${pod ? `${pod.kind}:${Math.ceil(pod.left / 10)}` : ''}|${self.level}|${Math.round((self.xp / Math.max(1, self.xpNext)) * 200)}|${Math.round((self.rested / Math.max(1, self.xpNext)) * 200)}|${self.gold}|${self.wanted}|${self.talentPoints}|${you.hull}|${you.hullMax}|${you.sails}|${you.sailsMax}|${you.crew}|${you.crewMax}|${url ? 1 : 0}|${self.company.mood ?? ''}:${self.company.shantyUntil ?? 0}|${self.title ?? ''}|${self.glory ? `${self.glory.open}:${self.glory.rank}:${self.glory.pending}:${self.glory.points - self.glory.spent}` : ''}|${state.doubloons}`;
    if (ckey !== this.lastCaptainKey) {
      this.lastCaptainKey = ckey;
      $('hud-captain').innerHTML = `
        <div class="uf-portrait">${avatar({ face: cap.portrait, url, frame: state.cos?.eq.frame ?? null, ring: 'portrait', cls: 'uf-av' })}<b class="uf-level" title="${esc(L('lv', { n: self.level }))}">${self.level}</b>${streak ? streakBadge(streak) : ''}${pod ? podBadge(pod) : ''}${moodMark(self.company.mood, (self.company.shantyUntil ?? 0) - state.estServerTime())}</div>
        <div class="uf-body">
          <div class="uf-top"><span class="uf-name">${esc(self.name)}${self.title ? `<small class="uf-title">${esc(sv(self.title))}</small>` : ''}</span><span class="gold val uf-silver">${icon('coin', '⛁', 'ico-sm')}${fmt(self.gold)}${exchPlus()}</span>${shopChip(state.doubloons, 'uf-dbl')}</div>
          ${fbar('hull', you.hull, you.hullMax, L('hull'), 'stat_hull')}${fbar('sails', you.sails, you.sailsMax, L('sails'), 'stat_sails')}${fbar('crew', you.crew, you.crewMax, L('crew'), 'stat_crew')}
          <div class="fbar xp" title="${esc(self.rested > 0 ? `${xpLine(self)} · ${L('rested', { n: fmt(self.rested) })}` : xpLine(self))}"><i style="width:${pct(self.xp / Math.max(1, self.xpNext))}"></i>${self.rested > 0 ? `<b class="xp-rest" style="left:${pct(self.xp / Math.max(1, self.xpNext))};width:${pct(Math.min(self.rested, Math.max(0, self.xpNext - self.xp)) / Math.max(1, self.xpNext))}"></b>` : ''}</div>
          <div class="uf-sub"><span class="wanted" title="${esc(skullsTip(state) || wantedTitle(self.wanted))}">${self.wanted ? icon('wanted', '☠', 'ico-sm') + '☠'.repeat(self.wanted) + ' ' + esc(wantedTitle(self.wanted)) : `<span class="muted">${esc(L('unknownToLaw'))}</span>`}</span>${self.talentPoints > 0 ? `<span class="gold uf-pts" title="${esc(keyless(L('talentPts', { n: self.talentPoints })))}">${keyChip('talents')}${icon('xp', '', 'ico-sm')}${self.talentPoints}</span>` : ''}${gloryChip(self.glory)}</div>
        </div>`;
      $('hud-captain').querySelector<HTMLElement>('[data-throne]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onThrone();
      });
    }
    }

    // Ship condition.
    const cls = SHIP_CLASSES[self.loadout.classId];
    const vol = cargoVolume(self.cargo, state.ownStats?.contrabandVolumeMul ?? 1, state.ownStats?.materialVolumeMul ?? 1, state.ownStats?.provisionVolumeMul ?? 1, state.ownStats?.cursedVolumeMul ?? 1);
    const holdMax = state.ownStats?.holdVolume ?? cls.holdVolume;
    const lvl = shipLevelOf(self.loadout);
    const wd = self.company.wounded;
    const wk = wd && wd.n > 0 ? `${wd.n}:${wd.healPerMin}:${wd.diePerMin}` : '';
    const skey = `${lang()}|${lvl}|${self.abyss?.pressure ?? -1}|${self.abyss?.shards ?? 0}|${Math.round(you.water * 50)}|${you.leaks}|${you.station}|${self.curse}|${you.hull}|${you.sails}|${you.crew}|${you.morale}|${Math.round(you.spd * 10)}|${you.sailT}|${Math.round(you.sail * 4)}|${vol.toFixed(1)}|${you.rudderHp}|${you.flags}|${Math.round(you.sanity)}|${Math.round(you.dread)}|${self.company.unrest}|${self.company.mood ?? ''}|${wk}`;
    if (skey !== this.lastShipKey) {
      this.lastShipKey = skey;
      const steps = [0, 0.25, 0.5, 0.75, 1].slice(1).map((v) => `<span class="${you.sail >= v - 0.01 ? 'on' : ''} ${Math.abs(you.sailT - v) < 0.01 ? 'target' : ''}"></span>`).join('');
      if (document.body.classList.contains('ship-open')) placeShipPanel();
      $('hud-ship').innerHTML = `
        <div class="row sp-head"><b>${icon('menu_ship', '', 'ico-sm')}${esc(self.loadout.name)}</b><span class="lbl"><b class="ship-lvl">⚓${lvl}</b> ${esc(cls.name)}</span></div>
        <div class="row"><span class="lbl">${icon('stat_hull', '', 'ico-xs')}${esc(L('hull'))}</span><span class="val">${fmt(you.hull)} / ${fmt(you.hullMax)}</span></div>${bar('hull', you.hull / you.hullMax)}
        <div class="row"><span class="lbl">${icon('stat_sails', '', 'ico-xs')}${esc(L('sails'))}</span><span class="val">${fmt(you.sails)} / ${fmt(you.sailsMax)}${you.rudderHp < 0.99 ? ` · ${esc(L('rudder', { n: Math.round(you.rudderHp * 100) }))}` : ''}</span></div>${bar('sails', you.sails / you.sailsMax)}
        <div class="row"><span class="lbl">${icon('stat_crew', '', 'ico-xs')}${esc(L('crew'))}</span><span class="val">${you.crew} / ${you.crewMax}</span></div>${bar('crew', you.crew / you.crewMax)}
        ${wd && wd.n > 0 ? `<div class="row sp-wounded" title="${esc(LCREW('woundedAdvice'))}"><span class="lbl" style="color:${wd.diePerMin > 0 ? 'var(--bad)' : 'var(--fog)'}">${icon('prof_surgeon', '', 'ico-xs')}${esc(LCREW('woundedShort'))}</span><span class="val">${esc(wd.diePerMin > 0 ? LCREW('woundedRowDie', { n: wd.n, h: fmt1(wd.healPerMin), d: fmt1(wd.diePerMin) }) : LCREW('woundedRow', { n: wd.n, h: fmt1(wd.healPerMin) }))}</span></div>` : ''}
        ${you.water > 0.01 || you.leaks ? `<div class="row"><span class="lbl" style="color:var(--xp)">${esc(L('water'))}</span><span class="val">${Math.round(you.water * 100)}%${you.leaks ? ` · ${you.leaks} ${esc(plural(you.leaks, L('leak.one'), L('leak.few'), L('leak.many')))}` : ''}${you.water > 0.4 ? ` · ${esc(L('listing'))}` : ''}</span></div>${bar('crew', you.water)}` : ''}
        <div class="row"><span class="lbl">${icon('menu_crew', '', 'ico-xs')}${esc(keyless(L('orders')))}</span><span class="val">${esc(L(`station.${you.station}`))}</span></div>
        <div class="row"><span class="lbl">${icon('tree_command', '', 'ico-xs')}${esc(L('morale'))}</span><span class="val">${you.morale}${self.company.mood ? ` · <span class="${self.company.mood === 'shanty' ? 'good' : 'bad'}">${esc(LCREW(`mood.${self.company.mood}`))}</span>` : ''}</span></div>${bar('morale', you.morale / 100)}
        ${self.abyss && (self.abyss.inside || self.abyss.pressure > 0) ? `<div class="row" title="${esc(L('pressureTip'))}"><span class="lbl" style="color:${self.abyss.pressure < 60 ? 'var(--fog)' : 'var(--bad)'}">${esc(L('pressure'))}</span><span class="val">${self.abyss.pressure}${self.abyss.shards ? ` · ${esc(L('shards', { n: self.abyss.shards }))}` : ''}</span></div>${bar('sanity', self.abyss.pressure / 100)}` : ''}${you.sanity < 99.5 ? `<div class="row" title="${esc(L('sanityTip'))}"><span class="lbl" style="color:${you.sanity > 50 ? 'var(--fog)' : 'var(--bad)'}">${esc(L('sanity'))}</span><span class="val">${Math.round(you.sanity)} · ${esc(sanityWord(you.sanity))}</span></div>${bar('sanity', you.sanity / 100)}` : ''}
        ${self.company.unrest ? `<div class="row" title="${esc(L('unrestTip'))}"><span class="lbl" style="color:var(--bad)">${esc(L('crew'))}</span><span class="val" style="color:var(--bad)">${esc(sv(self.company.unrest))}</span></div>` : ''}
        ${self.captain === 'drowned' ? `<div class="row" title="${esc(L('dreadTip'))}"><span class="lbl" style="color:var(--turq)">${esc(L('dread'))}</span><span class="val" style="color:var(--turq)">${Math.round(you.dread)}${you.dread >= 80 ? ` · ${esc(L('theCall'))}` : ''}</span></div>${bar('dread', you.dread / 100)}` : ''}
        <div class="row"><span class="lbl">${icon('tab_market', '', 'ico-xs')}${esc(L('hold'))}</span><span class="val">${vol.toFixed(0)} / ${holdMax.toFixed(0)}${self.cargo.provisions ? ` · ${esc(L('food', { n: Math.floor(self.cargo.provisions) }))}` : ` · <span style="color:var(--bad)">${esc(L('noFood'))}</span>`}${self.hold?.over ? ` · <b style="color:var(--bad)" title="${esc(L('holdOverT', { n: self.hold.slow, at: self.hold.at }))}">${esc(L('holdOver'))} −${self.hold.slow}%</b>` : ''}</span></div>${bar('hold', vol / Math.max(1, holdMax))}${holdMixHtml(holdMix(self.cargo, state.ownStats), vol, holdMax)}
        ${self.curse >= 25 ? `<div class="row"><span class="lbl" style="color:var(--turq)">${esc(L('curse'))}</span><span class="val" style="color:var(--turq)">${esc(L('curseStage', { n: self.curse >= 80 ? 3 : self.curse >= 50 ? 2 : 1 }))} · ${self.curse}</span></div>` : ''}
        <div class="row" style="margin-top:4px"><span class="lbl">${icon('wind', '', 'ico-xs')}${esc(keyless(L('sail')))}</span><span class="val">${knots(you.spd)} ${esc(L('kn'))}${you.flags & SF.REPAIRING ? ` · ${esc(L('repairing'))}` : ''}</span></div>
        <div class="sail-steps">${steps}</div>`;
    }

    // Combat block: rebuilt each frame (cheap, few nodes).
    const now = state.estServerTime();
    // Cursed shot shows only when you carry it (key U).
    // The action bar is rebuilt only when its make-up changes (shots and counts, abilities and their locks, talents,
    // gauges, fire mode); reloads and cooldowns move in place every frame without touching the markup.
    // The rarer shot (bar, star, salt…) shows as cursed shot does, only when carried, and has no key: a tap or the
    // shot wheel picks it.
    const shots = AMMO_IDS.filter((a, i) => i < KEYED_AMMO || you.ammo[a] > 0 || you.ammoSel === a);
    const shipCls = cls;
    const gauges: { id: string; label: string; key?: Action; art: string; v: number; ready: boolean }[] = [
      { id: 'port', label: L('port'), key: 'firePort', art: 'fire', v: you.reload.port, ready: you.reload.port >= 1 },
      { id: 'starboard', label: L('starboard'), key: 'fireStarboard', art: 'fire', v: you.reload.starboard, ready: you.reload.starboard >= 1 },
    ];
    // The dash (dynamic combat): its readiness fills like a reload.
    const dashLeft = Math.max(0, (self.dashReadyAt ?? 0) - now);
    gauges.push({ id: 'dash', label: L('dash'), key: 'dash', art: assetUrl('icon.dash') ? 'dash' : 'ab_hard_over', v: 1 - Math.min(1, dashLeft / DASH_COOLDOWN), ready: dashLeft <= 0 });
    if (shipCls.bowChasers + shipCls.sternChasers > 0) gauges.push({ id: 'chasers', label: L('chasers'), key: 'chasers', art: 'chasers', v: Math.max(you.reload.bow, you.reload.stern), ready: Math.min(you.reload.bow || 1, you.reload.stern || 1) >= 1 });
    if (self.loadout.mount) gauges.push({ id: 'mount', label: MOUNTS[self.loadout.mount].name, art: `mount_${self.loadout.mount}`, v: you.reload.mount, ready: you.reload.mount >= 1 });
    const abil = cap.abilities.map((a) => {
      const locked = a.kind === 'ultimate' && self.level < 6;
      // Ultimates need full resolve; the Drowned Captain's miracles need Dread.
      const charging = a.kind === 'ultimate' && !locked && you.resolve < 100;
      const starved = (a.dreadCost ?? 0) > you.dread;
      return { a, locked, charging, dim: locked || charging || starved, left: Math.max(0, (self.cooldowns[a.id] ?? 0) - now) };
    });
    const tals = activeTalents(self.talents).slice(0, 5).map((t) => ({ t, left: Math.max(0, (self.talentCooldowns[t.id] ?? 0) - now) }));
    const heat = self.heat.port || self.heat.starboard
      ? `<div class="row" style="font-size:11px"><span class="lbl" style="color:var(--bad)">${esc(L('heat'))}</span><span class="val">${esc(L('heatSides', { p: self.heat.port, s: self.heat.starboard }))}</span></div>` : '';
    // Storm Gunner: the crest of the swell (the same seven-second cycle as the server).
    const crest = (self.talents.brg_storm_gunner ?? 0) > 0 && state.wind[1] >= 0.9 && Math.sin((now * Math.PI * 2) / 7 + (state.entityId ?? 0)) > 0.75;
    const mode = `<div class="ab-mode">${keyChip('fireMode')}${esc(L('fireMode'))}: ${esc(L(self.rollingFire ? 'rolling' : 'broadside'))}${crest ? ` · <span style="color:var(--gold)">${esc(L('crest'))}</span>` : ''}</div>`;
    const combat = $('hud-combat');
    const key = [lang(), this.bestAmmo, document.body.classList.contains('touch'), you.ammoSel, shots.map((a) => `${a}${you.ammo[a]}`).join(','), gauges.map((g) => g.id).join(','),
      abil.map((x) => `${x.a.id}${x.dim ? 1 : 0}${x.locked ? 1 : 0}`).join(','), tals.map((x) => x.t.id).join(','), heat, mode, this.artEpoch].join('|');
    // A phone has no bar: its shots, abilities and talents are the wheel under «Огонь» (docs/23 items 19–21).
    if (key !== this.lastCombatKey && !document.body.classList.contains('touch') && !simpleHud()) {
      this.lastCombatKey = key;
      const ammo = shots.map((a) => slot({
        // docs/23 item 39: each shot by its role in a word (round the hull, chain the sails, grape the men), and the best
        // one for the mark now lit.
        data: `data-ammo="${a}"`, cls: `${you.ammoSel === a ? 'sel' : ''}${this.bestAmmo === a ? ' best' : ''}`, art: `ammo_${a}`, glyph: AMMO[a].name.slice(0, 1), name: AMMO[a].name,
        key: a === 'cursed' ? 'U' : AMMO_IDS.indexOf(a) < KEYED_AMMO ? String(AMMO_IDS.indexOf(a) + 1) : '', qty: String(you.ammo[a]),
        title: `${AMMO[a].name}${a === 'round' || a === 'chain' || a === 'grape' ? ` (${LSF(`ammo.${a}`)})` : ''}${this.bestAmmo === a ? ` · ${LSF('ammo.best')}` : ''} — ${AMMO[a].description}`,
      })).join('');
      const reload = gauges.map((g) => `<div class="rl ${g.id === 'port' ? 'flip' : ''}" data-g="${g.id}">${icon(g.art, '', 'ico-rl')}<span>${g.key ? keyChip(g.key) : ''}${esc(g.label)}</span><div class="fbar"><i></i></div></div>`).join('');
      const abilities = abil.map((x) => slot({
        data: `data-ab="${x.a.id}"`, cls: `${x.a.kind === 'ultimate' ? 'ult' : ''} ${x.dim ? 'locked' : ''}`, art: `ab_${x.a.id}`, glyph: x.a.key, name: x.a.name, key: x.a.key,
        title: `${x.a.name} — ${x.a.description}`,
        extra: `${x.charging ? '<div class="charge"></div>' : ''}<div class="cd"></div><div class="cdt">${x.locked ? esc(L('lv6')) : ''}</div>`,
      })).join('');
      const talentBar = tals.map((x, i) => slot({
        data: `data-talent="${x.t.id}"`, cls: 'talent', art: `tree_${x.t.tree}`, glyph: '✦', name: x.t.name, key: '67890'[i], title: `${x.t.name} — ${x.t.description}`,
        extra: '<div class="cd"></div><div class="cdt"></div>',
      })).join('');
      combat.innerHTML = `<div class="ab-reload">${reload}</div>${mode}${heat}
        <div class="ab-row"><div class="ab-group ab-ammo">${ammo}</div><i class="ab-sep"></i><div class="ab-group ab-abil">${abilities}</div>${talentBar ? `<i class="ab-sep"></i><div class="ab-group">${talentBar}</div>` : ''}</div>`;
      combat.querySelectorAll<HTMLElement>('[data-ab]').forEach((el) => (el.onclick = () => this.onAbility(el.dataset.ab!)));
      combat.querySelectorAll<HTMLElement>('[data-talent]').forEach((el) => (el.onclick = () => this.onTalent(el.dataset.talent!)));
      combat.querySelectorAll<HTMLElement>('[data-ammo]').forEach((el) => (el.onclick = () => (el.classList.contains('sel') && document.body.classList.contains('touch') ? this.onAmmoCycle() : this.onAmmo(el.dataset.ammo!))));
      this.gaugeEls = new Map([...combat.querySelectorAll<HTMLElement>('.rl')].map((el) => [el.dataset.g!, { el, fill: el.querySelector<HTMLElement>('i')! }]));
      this.cdEls = new Map([...combat.querySelectorAll<HTMLElement>('[data-ab], [data-talent]')].map((el) => [el.dataset.ab ?? `t:${el.dataset.talent}`, { cd: el.querySelector<HTMLElement>('.cd')!, cdt: el.querySelector<HTMLElement>('.cdt')!, charge: el.querySelector<HTMLElement>('.charge') }]));
    }
    // Gauges and cooldowns, in place.
    for (const g of gauges) {
      const e = this.gaugeEls.get(g.id);
      if (!e) continue;
      e.el.classList.toggle('ready', g.ready);
      e.fill.style.width = pct(Math.round(g.v * 50) / 50);
    }
    const setCd = (id: string, left: number, total: number, locked: boolean) => {
      const e = this.cdEls.get(id);
      if (!e) return;
      const frac = left > 0 ? Math.min(1, left / total) : 0;
      e.cd.style.height = `${Math.round(frac * 100)}%`;
      if (!locked) {
        const txt = frac > 0 ? String(Math.ceil(left)) : '';
        if (e.cdt.textContent !== txt) e.cdt.textContent = txt;
      }
    };
    for (const x of abil) {
      setCd(x.a.id, x.left, x.a.cooldown * (state.ownStats?.cooldownMul ?? 1), x.locked);
      const ch = this.cdEls.get(x.a.id)?.charge;
      if (ch) ch.style.width = `${Math.round(you.resolve)}%`;
    }
    for (const x of tals) setCd(`t:${x.t.id}`, x.left, x.t.active?.cooldown ?? 1, false);
    // The prompt, region line, minimap and compass: rewritten only when they change, drawn at their own pace.
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      $('hud-prompt').innerHTML = prompt;
    }
    const tnow = performance.now();
    if (tnow - this.lastNav > 66) {
      this.lastNav = tnow;
      if (this.navShown) this.drawNav(state);
    }
    if (tnow - this.lastMinimap > 120) {
      this.lastMinimap = tnow;
      this.drawMinimap(state);
      this.updateRegion(state, now);
    }
  }

  /** The simple HUD's captain (owner, 2026-10-07: «рядом с аватаркой плашка некрасивая прямоугольник и он большой»;
   *  «слева сверху аватарка и очень удобные красивые уровни жизней, людей»): her face in a round frame, her level on
   *  its rim, three slim bars — hull, men, sails — with their numbers, and the silver as a chip. Nothing else: the law,
   *  the experience, the streak and the rest are in her sheet (a click on a desk; the menu's «Капитан» on a phone). */
  /** The weak army's hint (owner, 2026-10-28): a small badge under her frame; a tap opens one line and one button. */
  private drawAdvice(state: ClientState): void {
    const a = state.self?.advice;
    let el = document.getElementById('hud-advice');
    // (never over a window, the island or a boarding: the sea's own hint)
    const covered = !document.getElementById('modal')?.classList.contains('hidden') || !!document.querySelector('#isle:not(.hidden), #board-tac:not(.hidden), .k-sheet-root.k-open');
    const show = !!a && a.weak && !!a.step && !covered;
    if (!show) {
      if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
      this.adviceKey = '';
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'hud-advice';
      el.className = 'hud-advice hidden';
      $('hud').appendChild(el);
      el.addEventListener('click', (e) => {
        const t = e.target as HTMLElement;
        e.stopPropagation();
        const go = t.closest<HTMLElement>('[data-advgo]');
        if (go) {
          this.adviceOpen = false;
          this.adviceKey = '';
          return this.onAdvice(go.dataset.advgo as 'isle' | 'hire');
        }
        if (t.closest('[data-advx]')) this.adviceOpen = false;
        else if (t.closest('[data-adv]')) this.adviceOpen = !this.adviceOpen;
        this.adviceKey = '';
      });
    }
    const step = a!.step!;
    const ru = lang() === 'ru';
    const to: 'isle' | 'hire' = step.kind === 'hire' || step.kind === 'fill' ? 'hire' : 'isle';
    const key = `${lang()}|${this.adviceOpen ? 1 : 0}|${step.kind}|${step.unit ?? ''}|${step.building ?? ''}|${step.level ?? ''}|${Math.round(a!.ratio * 100)}|${state.self!.level}`;
    // under her frame: measured now and then (the frame's height moves with the HUD's layout)
    const now = performance.now();
    if (key !== this.adviceKey || now - this.adviceAt > 1000) {
      this.adviceAt = now;
      const at = advicePlace(el);
      if (at) {
        el.style.left = `${at.x}px`;
        el.style.top = `${at.y}px`;
      }
    }
    if (key === this.adviceKey) return;
    this.adviceKey = key;
    el.classList.remove('hidden');
    const badge = `<button type="button" class="adv-badge" data-adv aria-expanded="${this.adviceOpen}">${icon('stat_crew', '', 'ico-sm')}<span>${esc(L('adv.badge'))}</span><b>${Math.round(a!.ratio * 100)}%</b></button>`;
    el.innerHTML = this.adviceOpen
      ? `${badge}<div class="adv-card" role="status"><p class="adv-t">${esc(L('adv.title', { lv: state.self!.level, pct: Math.round(a!.ratio * 100) }))}</p><p class="adv-s">${esc(ru ? step.textRu : step.textEn)}</p><div class="adv-row"><button type="button" class="btn btn-small btn-primary" data-advgo="${to}">${esc(L(to === 'hire' ? 'adv.hire' : 'adv.isle'))}</button><button type="button" class="btn btn-small" data-advx>${esc(L('adv.close'))}</button></div></div>`
      : badge;
  }

  /** The island's first steps (owner, 2026-10-28): one line under her frame (under the weak army's badge when it is up)
   *  — the step, its reward, its one button (the finger points at it: pointer.ts `i:`). */
  private drawIsleFirst(state: ClientState): void {
    const v = state.self?.isleFirst;
    let el = document.getElementById('hud-isle1');
    // (never over a window, the island or a boarding — as the weak army's badge)
    const covered = !document.getElementById('modal')?.classList.contains('hidden') || !!document.querySelector('#isle:not(.hidden), #board-tac:not(.hidden), .k-sheet-root.k-open');
    const show = !!v && !covered;
    if (!show) {
      if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
      this.i1Key = '';
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'hud-isle1';
      el.className = 'hud-isle1 hidden';
      el.setAttribute('role', 'status');
      (document.body.classList.contains('simple') ? document.getElementById('hud-stack') ?? $('hud') : $('hud')).appendChild(el);
      el.addEventListener('click', (e) => {
        const go = (e.target as HTMLElement).closest<HTMLElement>('[data-i1go]');
        if (!go) return;
        e.stopPropagation();
        this.onIsleFirst(go.dataset.i1go as 'dw1' | 'dw2' | 'hire' | 'dw3' | 'army');
      });
    }
    const docked = !!state.self!.dockedAt;
    const btn = v!.id === 'hire' ? L(docked || state.wayView ? 'i1.hireBtn' : 'i1.toPort') : L('i1.build');
    const wait = v!.wait > 0 ? Math.ceil(v!.wait / 60) : 0;
    const key = `${lang()}|${v!.id}|${v!.open}|${v!.step}|${v!.ready ? 1 : 0}|${wait}|${docked ? 1 : 0}|${state.wayView ? 1 : 0}|${v!.stuck ?? ''}`;
    // under her frame, or under the weak army's badge (measured now and then: the HUD's layout moves)
    const now = performance.now();
    if (key !== this.i1Key || now - this.i1At > 1000) {
      this.i1At = now;
      // The simple HUD: the top-centre column's last item (owner, 2026-10-29: «одно на другое накладывается» — it stood
      // fixed under the autopilot's pill and the toasts ran across it). In the column's flow under her mark and the
      // autopilot it can never lie on them; the toasts keep under the column, or take its slot while there is no room
      // (placeTopStrip: i1-yield). The detailed HUD: under her frame, or under the weak army's badge.
      const stack = document.getElementById('hud-stack');
      if (document.body.classList.contains('simple') && stack) {
        if (el.parentElement !== stack) stack.appendChild(el);
        el.style.left = el.style.top = '';
      } else {
        if (el.parentElement !== $('hud')) $('hud').appendChild(el);
        el.classList.remove('i1-yield');
        const adv = document.getElementById('hud-advice');
        const ar = adv && !adv.classList.contains('hidden') ? adv.getBoundingClientRect() : null;
        const at = ar && ar.height > 0 ? { x: Math.round(ar.left), y: Math.round(ar.bottom + 4) } : advicePlace(el);
        if (at) {
          el.style.left = `${Math.max(4, at.x)}px`;
          el.style.top = `${at.y}px`;
        }
      }
    }
    if (key === this.i1Key) return;
    this.i1Key = key;
    el.classList.remove('hidden');
    const mins = `${wait} ${lang() === 'ru' ? 'мин' : 'min'}`;
    const sub = v!.open === 'dw1' ? L('i1.first') : wait > 0 ? L(v!.id === 'dw2' ? 'i1.waitDw1' : 'i1.wait', { t: mins }) : L('i1.reward', { n: fmt(v!.silver) });
    // (owner, 2026-10-29: no marine to be had — a calm line and the way to the army's own hand, never «Нанять»)
    const stuck = v!.id === 'hire' ? v!.stuck : undefined;
    const go = stuck === 'silver' ? '' : stuck ? `<button type="button" class="btn btn-small" data-i1go="army">${esc(L('i1.armyBtn'))}</button>` : `<button type="button" class="btn btn-small${v!.ready ? ' btn-primary' : ''}" data-i1go="${v!.id === 'hire' ? 'hire' : v!.open}">${esc(btn)}</button>`;
    el.innerHTML = `${icon('tab_isles', '', 'ico-sm')}<span class="i1-m"><b>${esc(L(`i1.${v!.id}` as 'i1.dw2', { n: v!.step + 1, of: v!.of }))}</b><i>${esc(stuck ? L(`i1.stuck.${stuck}` as 'i1.stuck.room') : sub)}</i></span>${go}`;
  }
  private i1At = 0;

  private drawStatus(state: ClientState): void {
    const self = state.self!, you = state.you!;
    const cap = CAPTAINS[self.captain];
    const url = assetUrl(cap.portrait);
    const xpPct = levelPct(self.xp, self.xpNext);
    const dot = captainDot(self.talentPoints, self.level);
    const g = self.glory;
    const fr = state.cos?.eq.frame ?? ''; // docs/32 §12: her avatar frame
    const escorts = self.dockedAt ? [] : escortBars(state); // forum 2026-10-30: the ships with her, under her bars
    const key = `simple|${fr}|${lang()}|${url ? 1 : 0}|${self.level}|${xpPct}|${self.gold}|${state.doubloons}|${you.hull}|${you.hullMax}|${you.crew}|${you.crewMax}|${you.sails}|${you.sailsMax}|${dot}|${g ? `${g.open}:${g.rank}:${g.pending}:${g.points - g.spent}` : ''}|${holdKey(self.hold)}|${escortKey(escorts)}|${self.pvp?.flag}:${self.pvp?.skulls ?? 0}:${self.pvp?.washMin ?? 0}`;
    if (key === this.lastCaptainKey) return;
    this.lastCaptainKey = key;
    const el = $('hud-captain');
    const row = (k: 'hull' | 'crew' | 'sails', v: number, max: number, art: string, val: string) =>
      `<div class="cs-row cs-${k}" title="${esc(`${L(k)}: ${fmt(v)} / ${fmt(max)}`)}">${icon(art, '', 'cs-ico')}<span class="cs-bar"><i style="width:${pct(clamp(v / Math.max(1, max), 0, 1))}"></i></span><span class="cs-v">${esc(val)}</span></div>`;
    el.innerHTML = `<div class="cs">
      <div class="cs-frame">${avatar({ face: cap.portrait, url, frame: fr || null, cls: 'cs-face' })}<b class="cs-lv" style="--xp:${xpPct}%" title="${esc(`${L('lv', { n: self.level })} · ${xpLine(self)}`)}">${self.level}</b>${dot ? `<i class="cs-pts" title="${esc(keyless(L('talentPts', { n: self.talentPoints })))}"></i>` : ''}${gloryChip(g, 'cs-glory')}${skullBadge(state)}</div>
      <div class="cs-body">${row('hull', you.hull, you.hullMax, 'stat_hull', fmt(you.hull))}${row('crew', you.crew, you.crewMax, 'stat_crew', `${you.crew}/${you.crewMax}`)}${row('sails', you.sails, you.sailsMax, 'stat_sails', fmt(you.sails))}${self.hold ? holdRowHtml(self.hold, icon('mod_hold_expansion', '', 'cs-ico'), L) : ''}
        <span class="cs-purse"><span class="cs-silver">${icon('coin', '⛁', 'cs-coin')}${fmt(self.gold)}${exchPlus()}</span>${shopChip(state.doubloons, 'cs-dbl')}</span>${escortRowHtml(escorts, icon('ab_call_escort', '', 'cs-eico'), L)}</div>
    </div>`;
    el.setAttribute('aria-label', `${self.name}: ${L('lv', { n: self.level })}, ${xpLine(self)}`);
    el.title = self.name;
    requestAnimationFrame(() => this.placeStrip()); // the top column keeps clear of her frame
    // The frame opens the captain's menu (seaux: on a phone too): a button for the keyboard and the screen reader.
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
  }

  /** The sea's name a moment, as the ship comes into new waters: a slim line in the top band that fades on its own
   *  (owner, 2026-10-07: «SALTMARROW» printed large under the boss's plate). The detailed HUD keeps its herald. */
  seaName(name: string, short: string, long: string): void {
    if (!simpleHud()) return this.banner(name, long);
    if (modalOpen()) return;
    const el = $('sea-herald');
    el.innerHTML = `<b>${esc(name.charAt(0).toUpperCase() + name.slice(1))}</b><small>${esc(short)}</small>`;
    el.classList.remove('hidden', 'go');
    void el.offsetWidth;
    el.classList.add('go');
    clearTimeout(this.heraldTimer);
    this.heraldTimer = setTimeout(() => {
      el.classList.add('hidden');
      this.placeStrip();
    }, 4200);
    this.placeStrip();
  }
  private heraldTimer: ReturnType<typeof setTimeout> | undefined;

  /** Lawless waters entered (owner, 2026-10-09: «в беззаконных водах правил вообще нет, и при входе в них игроку должно
   *  быть сказано об этом»): a line in the top band for LAWLESS_NOTE_MS, the danger's red on its edge — no rules here,
   *  anyone may attack anyone, the flag does not protect. The older HUD says it in a toast. */
  lawless(title: string, line: string): void {
    if (!simpleHud()) return this.toast(`${title}: ${line.charAt(0).toLowerCase()}${line.slice(1)}`, 'bad');
    const el = $('lawless-note');
    el.innerHTML = `${icon('danger', '', 'ln-ico')}<span><b>${esc(title)}</b> ${esc(line)}</span>`;
    el.classList.remove('hidden', 'go');
    void el.offsetWidth;
    el.classList.add('go');
    clearTimeout(this.lawlessTimer);
    this.lawlessTimer = setTimeout(() => {
      el.classList.add('hidden');
      this.placeStrip();
    }, LAWLESS_NOTE_MS);
    this.placeStrip();
  }
  private lawlessTimer: ReturnType<typeof setTimeout> | undefined;

  /** The world boss panel: name, phase, strength, parts, what to do, and your part in it. */
  private drawBoss(state: ClientState): void {
    const el = $('hud-boss');
    const b = state.bosses[0];
    if (!b) {
      if (this.lastBossKey) {
        el.classList.add('hidden');
        this.lastBossKey = '';
      }
      return;
    }
    const key = JSON.stringify([lang(), b.id, b.phase, Math.round((b.hp / b.hpMax) * 200), b.parts.map((p) => `${Math.round((p.hp / p.hpMax) * 20)}${p.label}`), b.hint, b.you, Math.floor(b.endsIn / 60)]);
    if (key === this.lastBossKey) return;
    this.lastBossKey = key;
    el.classList.remove('hidden');
    // The beast's painting behind its name.
    const card = assetUrl(`card.${b.kind}`);
    el.style.setProperty('--card', card ? `url('${card}')` : 'none');
    aimArt(el); // the beast's head in the bar, not its middle (owner, 2026-10-28)
    const pct = Math.max(0, Math.min(100, (b.hp / b.hpMax) * 100));
    // Each part a cell of one grid: its name, what is left of it, and a thread of its strength under both.
    const parts = b.parts.length ? `<div class="bparts">${b.parts.map((p) => {
      const left = Math.max(0, Math.round((p.hp / p.hpMax) * 100));
      // The number that tells eight arms apart stays whole; only the words before it give way (QA, 2026-10-04: eight
      // «Щупальце краке…» alike).
      // The Hollow Admiral's ships come as «name (lantern lit)»: the name in her tongue, the lantern as its light — the
      // words never fitted the cell, and the glued line was never translated (QA, 2026-10-04).
      const lamp = /^(.*) \(lantern (lit|out)\)$/.exec(p.label);
      const text = lamp ? placeName(lamp[1]) : sv(p.label);
      const m = /^(.*\S)\s+(\d+)$/.exec(text);
      const label = m ? `<span>${esc(m[1])}</span>&nbsp;${m[2]}` : `<span>${esc(text)}</span>`;
      const light = lamp ? icon('boon_lantern', '', `ico-xs bp-lamp${lamp[2] === 'out' ? ' out' : ''}`) : '';
      const tip = lamp ? `${text}${sv(` (lantern ${lamp[2]})`)}` : text;
      return `<span class="bpart ${p.hp <= 0 ? 'dead' : ''}" style="--hp:${left}%" title="${esc(tip)}"><b>${label}${light}</b><em>${p.hp > 0 ? left + '%' : '✕'}</em></span>`;
    }).join('')}</div>` : '';
    const alert = b.you.swallowed > 0 ? `<div class="balert">${esc(L('swallowed', { n: b.you.swallowed }))}</div>` : b.you.grabbed ? `<div class="balert">${esc(keyless(L('grabbed', { key: keyLabel(settings().keys.board[0] || settings().keys.board[1]) })))}</div>` : '';
    el.innerHTML = `<div class="bname">${esc(sv(b.name))}</div><div class="bphase">${esc(sv(b.phaseName))} · ${esc(L('bossLeaves', { n: Math.ceil(b.endsIn / 60) }))}</div>
      <div class="bbar"><i style="width:${pct.toFixed(1)}%"></i></div>${parts}
      <div class="bhint">${esc(sv(b.hint))}</div><div class="byou">${esc(L('bossShare', { n: Math.round(b.you.share * 100) }))}</div>${alert}`;
  }

  private updateRegion(state: ClientState, now: number): void {
    const tod = timeOfDay(now);
    const hours = Math.floor(tod * 24), mins = Math.floor((tod * 24 - hours) * 60);
    const r = REGIONS[state.region];
    const html = `<div><span class="rg-name">${esc(r.name.charAt(0).toUpperCase() + r.name.slice(1))}</span><span class="rg-dot"> · </span><span class="rg-safe" style="color:${r.safety === 'safe' ? 'var(--good)' : r.safety === 'contested' ? 'var(--gold)' : 'var(--bad)'}">${esc(L(`safety.${r.safety}`))}</span></div><div>${icon(weatherArt(state.weather), '', 'ico-sm')}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} · ${esc(weatherWord(state.weather))}<span class="rg-season"><span class="rg-dot"> · </span>${esc(seasonWord(seasonName(now)))}</span></div>${weekChip(state)}${this.sectorLine(state)}<div class="rg-extra">${this.objectiveLine(state)}${state.self?.forecast ? `<span class="muted">${esc(L('forecast', { kind: weatherWord(state.self.forecast.kind), n: Math.max(1, Math.round(state.self.forecast.in / 60)) }))}</span>` : ''}${this.eventLines(state)}${this.seaLines(state)}</div>`;
    if (html !== this.lastRegion) {
      this.lastRegion = html;
      $('hud-region').innerHTML = html;
    }
  }

  /** The square of the sea she is in (docs/16 P2): its ship levels, the captains it is for, a pocket. */
  private sectorLine(state: ClientState): string {
    const sec = this.sectorHere(state);
    if (!sec) return '';
    const band = bandOf(sec.l), cap = captainBand(band);
    const color = THREAT_COLOR[threatTo(sec.l)];
    const pocket = sec.p ? `<span class="rg-dot"> · </span><span class="muted">${esc(L(sec.p === 'calm' ? 'sector.calm' : 'sector.wild'))}</span>` : '';
    return `<div class="rg-sector"><span style="color:${color}">${esc(L('sector', { band: band[0] === band[1] ? `${band[0]}` : `${band[0]}–${band[1]}` }))}</span><span class="rg-cap"><span class="rg-dot"> · </span><span class="muted">${esc(L('sector.cap', { lo: cap[0], hi: cap[1] }))}</span>${pocket}</span></div>`;
  }

  private sectorHere(state: ClientState): SectorData | null {
    const own = state.ownDisplay;
    if (!own || !state.sectors.length) return null;
    return state.sectors[sectorIndex(own.x, own.y)] ?? null;
  }

  /** «Now: …» — what she is about and where it lies (owner, 2026-09-29: an objective always on the screen). */
  private objectiveLine(state: ClientState): string {
    const own = state.ownDisplay;
    const o = own ? objective(state, own.x, own.y) : null;
    if (!o) return '';
    const dist = o.d === undefined ? '' : o.d >= 1000 ? RL('dist.km', { n: dec1(o.d / 1000) }) : RL('dist.m', { n: Math.round(o.d / 10) * 10 });
    const where = o.dir && o.kind !== 'sight' ? ` · ${esc(L(`dir.${o.dir}` as never))}, ${esc(dist)}` : '';
    const left = o.left !== undefined ? ` · <span style="color:${o.left < 180 ? 'var(--bad)' : 'var(--fog)'}">${esc(L('obj.left', { n: Math.max(1, Math.ceil(o.left / 60)) }))}</span>` : '';
    let body: string;
    if (o.kind === 'waypoint') body = `${icon('goal', '', 'ico-sm')}${esc(L('obj.waypoint', { dir: L(`dir.${o.dir!}` as never), d: dist }))}`;
    else if (o.kind === 'raid') body = `<span style="color:var(--bad)">${esc(L('obj.raid', { name: placeName(o.title) }))}</span>${where}${left.replace('var(--fog)', 'var(--bad)')}`;
    else if (o.kind === 'quest') body = `${esc(sv(o.title))}: <span class="muted">${esc(sv(o.text))}</span>${where}`;
    else if (o.kind === 'contract') body = `${esc(L('obj.contract'))} — ${esc(sv(o.title))}${o.text ? ` ${esc(o.text)}` : ''}${where}${left}`;
    else if (o.kind === 'map') body = `${esc(L('obj.map'))} — ${esc(sv(o.title))}${where}`;
    else if (o.kind === 'sight') body = esc(L('obj.sight', { dir: L(`dir.${o.dir!}` as never), d: dist }));
    else if (o.kind === 'daily') {
      const def = DAILY_DEFS[o.title as keyof typeof DAILY_DEFS];
      body = `${esc(L('obj.daily'))} — <span class="muted">${esc(def ? def.text[lang() === 'ru' ? 1 : 0].replace('{n}', o.text.split('/')[1]) : o.title)} ${esc(o.text)}</span>`;
    } else body = `<span class="muted">${esc(L('obj.sail'))}</span>`;
    return `<span class="rg-now"><b style="color:var(--gold)">${esc(L('now'))}</b> ${body}</span><br>`;
  }

  /** World events in these waters, with the time they have left. */
/** The living sea's lines (docs/16 #6, #10): a storm front on her course, the convoy she escorts. */
  private seaLines(state: ClientState): string {
    let out = '';
    const w = state.frontWarn;
    if (w) {
      const n = Math.max(1, Math.round((w.sec - (performance.now() - state.frontsAt) / 1000) / 60));
      out += `<br><span style="color:var(--bad)">⛈ ${esc(LS(w.kind === 'black_storm' ? 'front.warnBlack' : 'front.warn', { n, dir: LS(`dir.${compass8(w.bearing)}`) }))}</span>`;
    }
    const mine = state.raid?.known?.find((k) => k.mine);
    if (mine) out += `<br><span style="color:var(--gold)">${esc(LS('cv.mine', { to: placeName(mine.to), n: mine.hulls, size: mine.size, pay: fmt(mine.pay) }))}</span>${mine.raided ? ` <span style="color:var(--bad)">${esc(LS('cv.raided'))}</span>` : ''}`;
    return out;
  }

  private eventLines(state: ClientState): string {
    const left = (secs: number) => {
      const s = Math.max(0, secs - (performance.now() - state.eventsAt) / 1000);
      return s >= 86400 ? L('days', { n: Math.round(s / 86400) }) : s >= 3600 ? L('hours', { n: Math.round(s / 3600) }) : L('mins', { n: Math.max(1, Math.round(s / 60)) });
    };
    return state.events.filter((e) => e.region === state.region).map((e) => `<br><span style="color:var(--bad)">⚑ ${esc(sv(e.title))}</span> <span class="muted">· ${left(e.endsIn)}</span>`).join('');
  }

  private drawNav(state: ClientState): void {
    const el = $('hud-nav');
    let c = el.querySelector('canvas') as HTMLCanvasElement | null;
    if (!c) {
      el.innerHTML = '<canvas class="compass" width="220" height="220"></canvas><div id="nav-text" style="font-size:11px;color:var(--fog);text-align:center"></div>';
      c = el.querySelector('canvas')!;
      this.navHtml = '';
    }
    const g = c.getContext('2d')!;
    const W = 220, R = 92;
    g.clearRect(0, 0, W, W);
    g.save();
    g.translate(W / 2, W / 2);
    // A frightened crew reads a wandering compass (±15°); in the Abyss the stars themselves lie (±30°).
    if ((state.you?.sanity ?? 100) <= 50) g.rotate(Math.sin(performance.now() / 2300) * 0.26);
    if (state.self?.abyss?.skew) g.rotate(state.self.abyss.skew);
    // The dial: the kit's brass rose under a dark wash so the needles read on it (a drawn ring until it is loaded).
    const dial = sprite('ui.stick_base');
    if (dial) {
      const d = R * 2 + 22;
      g.drawImage(dial.img, -d / 2, -d / 2, d, d);
      const wash = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R - 6);
      wash.addColorStop(0, 'rgba(6,7,9,0.62)');
      wash.addColorStop(1, 'rgba(6,7,9,0.3)');
      g.fillStyle = wash;
      g.beginPath();
      g.arc(0, 0, R - 6, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = 'rgba(176,141,87,0.6)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.stroke();
    }
    g.font = '16px "IM Fell English SC", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [t, a] of [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]] as const) {
      const lx = Math.sin(a) * (R - 16), ly = -Math.cos(a) * (R - 16);
      g.fillStyle = 'rgba(0,0,0,0.8)';
      g.fillText(L(`compass.${t}`), lx + 1, ly + 1);
      g.fillStyle = t === 'N' ? '#e8c46a' : 'rgba(216,210,196,0.9)';
      g.fillText(L(`compass.${t}`), lx, ly);
    }
    const you = state.you!;
    // The no-go sector: a red haze toward the wind, soft at the rim, no hard wedge.
    const from = state.wind[0] + Math.PI;
    const nogo = ((state.ownStats?.noGoDeg ?? 50) * Math.PI) / 180;
    const haze = g.createRadialGradient(0, 0, 0, 0, 0, R - 8);
    haze.addColorStop(0, 'rgba(208,106,94,0)');
    haze.addColorStop(0.55, 'rgba(208,106,94,0.22)');
    haze.addColorStop(1, 'rgba(208,106,94,0.05)');
    g.fillStyle = haze;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, R - 8, from - nogo - Math.PI / 2, from + nogo - Math.PI / 2);
    g.closePath();
    g.fill();
    // The wind: a tapered steel-blue vane from where it blows toward where it goes, broader in a strong wind.
    const wv = headingVec(state.wind[0]);
    const nx = -wv.y, ny = wv.x;
    const half = 2 + state.wind[1] * 3.5;
    const tail = -R * 0.72, neck = R * 0.34, tip = R * 0.62;
    const vane = g.createLinearGradient(wv.x * tail, wv.y * tail, wv.x * tip, wv.y * tip);
    vane.addColorStop(0, 'rgba(143,179,217,0.15)');
    vane.addColorStop(1, 'rgba(170,200,230,0.95)');
    g.fillStyle = vane;
    g.beginPath();
    g.moveTo(wv.x * tail + nx * 1, wv.y * tail + ny * 1);
    g.lineTo(wv.x * neck + nx * half, wv.y * neck + ny * half);
    g.lineTo(wv.x * neck + nx * (half + 6), wv.y * neck + ny * (half + 6));
    g.lineTo(wv.x * tip, wv.y * tip);
    g.lineTo(wv.x * neck - nx * (half + 6), wv.y * neck - ny * (half + 6));
    g.lineTo(wv.x * neck - nx * half, wv.y * neck - ny * half);
    g.lineTo(wv.x * tail - nx * 1, wv.y * tail - ny * 1);
    g.closePath();
    g.fill();
    // Her heading: a brass needle, lit on one flank and shaded on the other, on a dark pin.
    g.rotate(you.h);
    g.shadowColor = 'rgba(0,0,0,0.7)';
    g.shadowBlur = 4;
    g.fillStyle = '#e8c46a';
    g.beginPath();
    g.moveTo(0, -R * 0.64);
    g.lineTo(7, 0);
    g.lineTo(0, R * 0.2);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#9c7a3c';
    g.beginPath();
    g.moveTo(0, -R * 0.64);
    g.lineTo(-7, 0);
    g.lineTo(0, R * 0.2);
    g.closePath();
    g.fill();
    g.fillStyle = '#1a140d';
    g.beginPath();
    g.arc(0, 0, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c9a25a';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
    const rel = Math.round(relWindDeg(you.h, { dir: state.wind[0], strength: state.wind[1] }));
    const pt = rel < (state.ownStats?.noGoDeg ?? 50) ? 'irons' : rel < 80 ? 'close' : rel < 110 ? 'beam' : rel < 160 ? 'broad' : 'running';
    const point = term(`sail.${pt}` as Key, pt === 'irons' ? 'bad' : '');
    // What the wind does for her way: a following breeze drives her on, a head wind holds her back.
    const push = Math.round((windPush(rel, state.wind[1]) - 1) * 100);
    const pushTag = Math.abs(push) >= 3 ? ` · <b style="color:var(${push > 0 ? '--good' : '--bad'})">${push > 0 ? '+' : '−'}${Math.abs(push)}%</b>` : '';
    // (batch-pc: written only when it changes — fifteen rewrites a second dirtied the layout for nothing)
    const nav = `${esc(t('hud.wind', { kn: Math.round(state.wind[1] * 30) }))}<br>${point} (${rel}°)${pushTag}`;
    if (nav !== this.navHtml) $('nav-text').innerHTML = this.navHtml = nav;
  }

  private secLabel: { text: string; color: string; c: HTMLCanvasElement } | null = null;
  private miniLayer: { c: HTMLCanvasElement; cx: number; cy: number; k: number; n: number; at: number } | null = null;
  /** The minimap's islands on a layer 2W × 2H centred on (cx, cy) at the dial's scale (see drawMinimap). */
  private miniIsles(state: ClientState, own: { x: number; y: number }, range: number, k: number, W: number, H: number): { c: HTMLCanvasElement; cx: number; cy: number } {
    const now = performance.now();
    const L0 = this.miniLayer;
    if (L0 && !miniLayerStale(L0, own, range, k, state.islands.size, now)) return L0;
    const c = L0?.c ?? document.createElement('canvas');
    if (c.width !== W * 2 || c.height !== H * 2) [c.width, c.height] = [W * 2, H * 2];
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    const cx = own.x, cy = own.y, far = range * 2;
    const tx = (x: number) => (x - cx) * k + W;
    const ty = (y: number) => (y - cy) * k + H;
    for (const is of state.islands.values()) {
      if (Math.abs(is.x - cx) > far + is.r || Math.abs(is.y - cy) > far + is.r) continue;
      // docs/18 III: her kind's colour; a hidden island not yet found, a pale smudge of mist.
      if (is.mist) {
        g.fillStyle = 'rgba(190,198,202,0.18)';
        g.beginPath();
        g.arc(tx(is.x), ty(is.y), Math.max(2, is.r * k), 0, Math.PI * 2);
        g.fill();
        continue;
      }
      g.fillStyle = isleFill(is, false);
      g.beginPath();
      for (let i = 0; i < is.poly.length; i += 4) {
        if (i === 0) g.moveTo(tx(is.poly[i]), ty(is.poly[i + 1]));
        else g.lineTo(tx(is.poly[i]), ty(is.poly[i + 1]));
      }
      g.closePath();
      g.fill();
    }
    this.miniLayer = { c, cx, cy, k, n: state.islands.size, at: now };
    return this.miniLayer;
  }

  /** The minimap drawn off the page and copied onto the dial in one stroke (batch-pc: the dial's canvas is on the page,
   *  and each of its fonts set asked the page's styles first — a whole style pass forced in a sea fight, ~5% of a
   *  slowed desk's frame; a canvas off the page asks nothing). */
  private miniBack: HTMLCanvasElement | null = null;

  private drawMinimap(state: ClientState): void {
    const vis = this.minimap;
    const c = (this.miniBack ??= document.createElement('canvas'));
    if (c.width !== vis.width || c.height !== vis.height) [c.width, c.height] = [vis.width, vis.height];
    const g = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const own = state.ownDisplay;
    if (!own) return;
    // Star Reader: at night the stars show islands and ports twice as far.
    const stars = (state.self?.talents.exp_star_reader ?? 0) > 0 && isNight(state.estServerTime());
    const range = stars ? 9000 : 4500;
    const k = W / (range * 2);
    // A round chart: everything is clipped to the dial the compass ring sits on.
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath();
    g.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#060a0e';
    g.fillRect(0, 0, W, H);
    const tx = (x: number) => (x - own.x) * k + W / 2;
    const ty = (y: number) => (y - own.y) * k + H / 2;
    g.fillStyle = '#3a3d36';
    g.strokeStyle = '#6a624f';
    this.miniView = { x: own.x, y: own.y, range };
    this.miniState = state;
    // The islands from their cached layer (batch-pc: every island's outline filled again at each redraw was ~9% of a
    // slowed desk's frame in a sea fight): drawn once for a dial twice as wide round a centre, laid again when she has
    // sailed a quarter of the dial off it, the scale or the islands changed, or every few seconds (a find, a mist lifted).
    const lay = this.miniIsles(state, own, range, k, W, H);
    g.drawImage(lay.c, Math.round(W / 2 + (lay.cx - own.x) * k - W), Math.round(H / 2 + (lay.cy - own.y) * k - H));
    g.strokeStyle = 'rgba(90,160,150,0.7)';
    // Night navigation by lights: in the dark a shoal shows only within reach of a light — a lit lighthouse
    // (3.5 km, docs/16 #23: by the Crown, a keeper's pay or one's own island; its shoals in its warm light), a port
    // (2.5 km) or your own lanterns (600 m).
    const dark = nightFactor(state.estServerTime()) > 0.6;
    const lights: [number, number, number][] = dark ? [[own.x, own.y, 600]] : [];
    const lit = (state.isles?.lights ?? []).filter((l) => l.lit);
    if (dark) {
      for (const p of state.ports) if (Math.abs(p.x - own.x) < range + 2500 && Math.abs(p.y - own.y) < range + 2500) lights.push([p.x, p.y, 2500]);
    }
    for (const rf of state.reefs.values()) {
      if (Math.abs(rf.x - own.x) > range + rf.r || Math.abs(rf.y - own.y) > range + rf.r) continue;
      const inLit = dark && lit.some((l) => Math.hypot(rf.x - l.x, rf.y - l.y) < l.r + rf.r);
      if (dark && !inLit && !lights.some(([lx, ly, lr]) => Math.hypot(rf.x - lx, rf.y - ly) < lr + rf.r)) continue;
      g.beginPath();
      g.arc(tx(rf.x), ty(rf.y), Math.max(inLit ? 2.2 : 1.5, rf.r * k * 0.8), 0, Math.PI * 2);
      if (inLit) {
        g.fillStyle = 'rgba(245,199,122,0.25)';
        g.fill();
        g.strokeStyle = 'rgba(245,199,122,0.9)';
        g.stroke();
        g.strokeStyle = 'rgba(90,160,150,0.7)';
      } else g.stroke();
    }
    // A lit light's reach, faint on the dial at night.
    if (dark) for (const l of lit) {
      if (Math.abs(l.x - own.x) > range + l.r || Math.abs(l.y - own.y) > range + l.r) continue;
      g.strokeStyle = 'rgba(245,199,122,0.22)';
      g.setLineDash([2, 4]);
      g.beginPath();
      g.arc(tx(l.x), ty(l.y), l.r * k, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = 'rgba(90,160,150,0.7)';
    }
    // Banks the tide or a season has bared (docs/16 #25): sand on the dial while they stand.
    for (const b of state.isles?.tidal ?? []) {
      if (!b.up || Math.abs(b.x - own.x) > range + b.r || Math.abs(b.y - own.y) > range + b.r) continue;
      g.fillStyle = '#b9a47a';
      g.beginPath();
      g.arc(tx(b.x), ty(b.y), Math.max(2.5, b.r * k), 0, Math.PI * 2);
      g.fill();
      if (!b.combed) {
        g.strokeStyle = 'rgba(255,230,160,0.9)';
        g.stroke();
        g.strokeStyle = 'rgba(90,160,150,0.7)';
      }
    }
    drawIslesMini(g, state, tx, ty, own, range, k); // the turtle islands, a bared bank's time left (docs/18 #31)
    // Lookouts on the headlands (docs/16 #24): a small red pennant, grey once climbed.
    for (const l of state.isles?.lookouts ?? []) {
      if (Math.abs(l.x - own.x) > range || Math.abs(l.y - own.y) > range) continue;
      g.fillStyle = l.at ? 'rgba(160,170,150,0.8)' : '#d0503a';
      g.beginPath();
      g.moveTo(tx(l.x), ty(l.y) - 4);
      g.lineTo(tx(l.x) + 4, ty(l.y) + 3);
      g.lineTo(tx(l.x) - 4, ty(l.y) + 3);
      g.closePath();
      g.fill();
    }
    drawAdvMini(g, state, tx, ty, own, range); // the adventure map's guards and things (docs/17 H4)
    drawDriftsMini(g, state, tx, ty, own, range); // drifting creatures and their clocks (docs/18 #34)
    drawFindsMini(g, state, tx, ty, own, range); // the sea's small things (docs/19 D5)
    drawWaysMini(g, state, tx, ty, own, range); // docs/35: the floating waystations
    drawWrecksMini(g, state.wrecks, state.castaways, tx, ty, own, range); // seaux: her wreckage and castaways
    drawRoamsMini(g, state, tx, ty, own, range); // the creatures roaming the sea (docs/19 D7)
    drawCitadelsMini(g, state, tx, ty, own, range); // the citadels of the Throne war (docs/19 E4)
    // The dense sea's marks (docs/16 P3): a wreck or bones as a dun speck, a buoy red, a lantern gold. docs/19 D6: twice
    // as many — one speck to a few pixels (the nearest wins), fainter toward the dial's edge and once worked today.
    {
      const cells = new Set<number>();
      const marks = [...state.seaMarks.values()].filter((m) => Math.abs(m.x - own.x) <= range && Math.abs(m.y - own.y) <= range)
        .sort((a, b) => Math.abs(a.x - own.x) + Math.abs(a.y - own.y) - (Math.abs(b.x - own.x) + Math.abs(b.y - own.y)));
      for (const m of marks) {
        const px = tx(m.x), py = ty(m.y);
        const cell = Math.floor(px / 5) * 4096 + Math.floor(py / 5);
        if (cells.has(cell)) continue;
        cells.add(cell);
        const fade = (1 - 0.55 * Math.min(1, Math.max(Math.abs(m.x - own.x), Math.abs(m.y - own.y)) / range)) * (state.markDone.has(m.id) ? 0.45 : 1);
        g.globalAlpha = fade;
        g.fillStyle = m.kind === 'buoy' ? 'rgba(200,70,60,0.8)' : m.kind === 'lantern' ? 'rgba(240,200,110,0.85)' : m.kind === 'floe' ? 'rgba(200,215,225,0.6)' : 'rgba(150,130,100,0.6)';
        g.fillRect(px - 1, py - 1, 2, 2);
      }
      g.globalAlpha = 1;
    }
    // Weather fronts on the horizon (docs/16 #10): the cloud, its edge, and an arrow on the edge nearest her for
    // where it drifts; one on her course ringed in red.
    const warnId = state.frontWarn?.id ?? -1;
    for (const f of state.fronts) {
      const storm = f.kind === 'storm' || f.kind === 'black_storm';
      g.fillStyle = f.kind === 'black_storm' ? 'rgba(46,230,200,0.10)' : f.kind === 'storm' ? 'rgba(160,170,190,0.16)' : f.kind === 'fog' ? 'rgba(170,180,185,0.10)' : 'rgba(120,150,190,0.10)';
      g.beginPath();
      g.arc(tx(f.x), ty(f.y), f.r * k, 0, Math.PI * 2);
      g.fill();
      if (storm || f.id === warnId) {
        g.setLineDash([5, 4]);
        g.strokeStyle = f.id === warnId ? 'rgba(232,90,64,0.95)' : f.kind === 'black_storm' ? 'rgba(46,230,200,0.55)' : 'rgba(190,200,215,0.5)';
        g.lineWidth = f.id === warnId ? 2 : 1.2;
        g.beginPath();
        g.arc(tx(f.x), ty(f.y), f.r * k, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > 0.2) {
        // The point of the edge toward her, clamped into the dial.
        const dx = own.x - f.x, dy = own.y - f.y, dd = Math.hypot(dx, dy) || 1;
        const edge = Math.min(dd, f.r);
        let ax = tx(f.x + (dx / dd) * edge), ay = ty(f.y + (dy / dd) * edge);
        const ox = ax - W / 2, oy = ay - H / 2, od = Math.hypot(ox, oy), lim = W / 2 - 14;
        if (od > lim) {
          ax = W / 2 + (ox / od) * lim;
          ay = H / 2 + (oy / od) * lim;
        }
        const a = Math.atan2(f.vy, f.vx), len = 16;
        g.strokeStyle = f.id === warnId ? '#ff7a5a' : storm ? '#dfe6f0' : 'rgba(200,210,220,0.75)';
        g.fillStyle = g.strokeStyle;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(ax - Math.cos(a) * len / 2, ay - Math.sin(a) * len / 2);
        g.lineTo(ax + Math.cos(a) * len / 2, ay + Math.sin(a) * len / 2);
        g.stroke();
        g.beginPath();
        g.moveTo(ax + Math.cos(a) * (len / 2 + 4), ay + Math.sin(a) * (len / 2 + 4));
        g.lineTo(ax + Math.cos(a + 2.5) * 6 + Math.cos(a) * len / 2, ay + Math.sin(a + 2.5) * 6 + Math.sin(a) * len / 2);
        g.lineTo(ax + Math.cos(a - 2.5) * 6 + Math.cos(a) * len / 2, ay + Math.sin(a - 2.5) * 6 + Math.sin(a) * len / 2);
        g.closePath();
        g.fill();
        g.lineWidth = 1;
      }
    }
    // The League convoys she knows of (docs/16 #6): the route dashed, the column where it is; hers in gold, one under
    // fire in red.
    for (const cv of state.raid?.known ?? []) {
      const col = cv.raided ? '#e05a46' : cv.mine ? '#f2c14e' : '#8fc3e8';
      g.setLineDash([4, 4]);
      g.strokeStyle = cv.raided ? 'rgba(224,90,70,0.6)' : cv.mine ? 'rgba(242,193,78,0.6)' : 'rgba(143,195,232,0.45)';
      g.lineWidth = 1.2;
      g.beginPath();
      cv.route.forEach(([x, y], i) => (i ? g.lineTo(tx(x), ty(y)) : g.moveTo(tx(x), ty(y))));
      g.stroke();
      g.setLineDash([]);
      const dx = cv.x - own.x, dy = cv.y - own.y;
      if (Math.hypot(dx, dy) * k < W / 2 - 8) {
        g.fillStyle = col;
        g.strokeStyle = 'rgba(0,0,0,0.85)';
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.rect(tx(cv.x) - 2.5 + (i - 1) * 5, ty(cv.y) - 2.5, 5, 5);
          g.fill();
          g.stroke();
        }
      }
    }
    // Whirlpools are felt, not charted: 2.5 km, further with Anomaly Sense.
    const sense = 2500 * (1 + (state.ownStats ? tval(state.ownStats, 'anomalySight') : 0) + ((state.self?.talents.abs_drowned_eyes ?? 0) >= 2 ? 0.3 : 0));
    for (const w of state.whirlpools) {
      if (Math.hypot(w.x - own.x, w.y - own.y) > sense + w.radius) continue;
      g.strokeStyle = 'rgba(208,106,94,0.6)';
      g.beginPath();
      g.arc(tx(w.x), ty(w.y), w.radius * k, 0, Math.PI * 2);
      g.stroke();
    }
    // Lighthouses are landmarks: a warm star on the chart when lit, a grey one when dark.
    const litIds = new Set(lit.map((l) => l.island));
    for (const is of state.islands.values()) {
      if (!is.features.includes('lighthouse') || Math.abs(is.x - own.x) > range || Math.abs(is.y - own.y) > range) continue;
      g.fillStyle = !litIds.has(is.id) ? 'rgba(150,150,140,0.7)' : dark ? '#f5c77a' : 'rgba(245,199,122,0.6)';
      g.beginPath();
      g.arc(tx(is.x), ty(is.y), dark ? 3.2 : 2.2, 0, Math.PI * 2);
      g.fill();
    }
    for (const p of state.ports) {
      if (Math.abs(p.x - own.x) > range || Math.abs(p.y - own.y) > range) continue;
      g.fillStyle = '#e0b862';
      g.fillRect(tx(p.x) - 3, ty(p.y) - 3, 6, 6);
      if (isFerryHub(p.id) && !underFog(state.seen, p.x, p.y)) drawHubMark(g, tx(p.x) + 6, ty(p.y) - 6, 4.5); // a «Переход» hub (owner, 2026-10-30)
    }
    // The fog of war (owner, 2026-10-17): what she has not seen lies under it — islands, ports, lairs, the sea's things;
    // ships, her marks and her scouts over it.
    drawFog(g, state.seen, state.seenVer, { x0: own.x - range, y0: own.y - range, k, w: W, h: H, time: settings().reduceMotion ? 0 : performance.now() / 1000, q: 1, tone: 1 });
    // a «Переход» hub not found yet (Нефигугум, post 26): a dim ⇄ over the fog, roughly where to sail — no name
    g.save();
    g.globalAlpha = 0.55;
    for (const p of state.ports) {
      if (!isFerryHub(p.id) || Math.abs(p.x - own.x) > range || Math.abs(p.y - own.y) > range || !underFog(state.seen, p.x, p.y)) continue;
      drawHubMark(g, tx(p.x), ty(p.y), 4.5);
    }
    g.restore();
    drawScouts(g, state.scouts, state.scoutsAt, tx, ty, 9);
    // Ships by shape (§11.2): circle a friend, square a neutral, diamond an enemy, notched diamond a bounty.
    const cb = settings().colorblind;
    for (const s of state.ships.values()) {
      if (s.id === state.entityId) continue;
      const rel = relationOf(state, s);
      drawRelation(g, rel, tx(s.cur.x), ty(s.cur.y), rel === 'enemy' || rel === 'target' ? 3 : 2.4, cbColor(cb, RELATION_COLOR[rel]));
    }
    drawRelation(g, 'me', W / 2, H / 2, 2.6, RELATION_COLOR.me);
    // Her guards hired at sea (owner, 2026-10-25): a gold ring round each, where she last was seen if off the snapshot.
    for (const e of state.hire?.escorts ?? []) {
      const live = state.ships.get(e.id);
      const ex = live ? live.cur.x : e.x, ey = live ? live.cur.y : e.y;
      if (Math.abs(ex - own.x) > range || Math.abs(ey - own.y) > range) continue;
      g.strokeStyle = '#e8c46a';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(tx(ex), ty(ey), 4.6, 0, Math.PI * 2);
      g.stroke();
    }
    for (const l of state.loot.values()) {
      g.fillStyle = '#b08d57';
      g.fillRect(tx(l.x) - 1.5, ty(l.y) - 1.5, 3, 3);
    }
    // Explorer's marks: soundings (shallows), wakes of passing ships, gold trails, treasure circles, known wrecks.
    const self = state.self;
    g.fillStyle = 'rgba(200,170,90,0.55)';
    for (const [sx, sy] of self?.soundings ?? []) g.fillRect(tx(sx) - 1, ty(sy) - 1, 2, 2);
    g.strokeStyle = 'rgba(180,200,210,0.45)';
    g.lineWidth = 1;
    for (const tr of self?.trails ?? []) {
      g.beginPath();
      tr.pts.forEach(([px, py], i) => (i ? g.lineTo(tx(px), ty(py)) : g.moveTo(tx(px), ty(py))));
      g.stroke();
    }
    g.fillStyle = 'rgba(230,190,80,0.8)';
    for (const [gx, gy] of self?.goldTrails ?? []) {
      g.beginPath();
      g.arc(tx(gx), ty(gy), 2, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(217,180,90,0.8)';
    g.setLineDash([3, 3]);
    for (const m of self?.maps ?? []) {
      if (m.r < 0 || m.spot) continue;
      g.beginPath();
      g.arc(tx(m.x), ty(m.y), Math.max(3, m.r * k), 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
    // a treasure map's dig spot (Нефигугум, forum post 26): a red ✕ on a dark disc, clamped to the dial's rim when far
    for (const m of self?.maps ?? []) {
      if (!m.spot) continue;
      const x = Math.max(6, Math.min(W - 6, tx(m.spot[0]))), y = Math.max(6, Math.min(H - 6, ty(m.spot[1])));
      g.fillStyle = 'rgba(10,8,6,0.7)';
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#e04a34';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3);
      g.moveTo(x + 3, y - 3); g.lineTo(x - 3, y + 3);
      g.stroke();
    }
    g.lineWidth = 1;
    // The squares of the sea (docs/16 P2): their borders faint on the dial, her own square's levels at its foot.
    if (state.sectors.length) {
      g.strokeStyle = 'rgba(200,190,150,0.22)';
      g.setLineDash([2, 4]);
      g.lineWidth = 1;
      const x0 = Math.ceil((own.x - range) / SECTOR_SIZE) * SECTOR_SIZE, y0 = Math.ceil((own.y - range) / SECTOR_SIZE) * SECTOR_SIZE;
      for (let x = x0; x < own.x + range; x += SECTOR_SIZE) {
        g.beginPath();
        g.moveTo(tx(x), 0);
        g.lineTo(tx(x), H);
        g.stroke();
      }
      for (let y = y0; y < own.y + range; y += SECTOR_SIZE) {
        g.beginPath();
        g.moveTo(0, ty(y));
        g.lineTo(W, ty(y));
        g.stroke();
      }
      g.setLineDash([]);
      const sec = this.sectorHere(state);
      if (sec) {
        const band = bandOf(sec.l);
        const text = `⚓${band[0]}–${band[1]}`;
        // (batch-pc: from its own small canvas, laid when the words change — the dial's font set at every redraw asked
        // the page's styles each time, most of the minimap's cost in a sea fight)
        const color = THREAT_COLOR[threatTo(sec.l)];
        let lab = this.secLabel;
        if (!lab || lab.text !== text || lab.color !== color || lab.c.width !== W) {
          const c = lab?.c ?? document.createElement('canvas');
          [c.width, c.height] = [W, 16];
          const q = c.getContext('2d')!;
          q.font = '700 10px Inter, sans-serif';
          q.textAlign = 'center';
          q.lineWidth = 3;
          q.strokeStyle = 'rgba(0,0,0,0.85)';
          q.strokeText(text, W / 2, 12);
          q.fillStyle = color;
          q.fillText(text, W / 2, 12);
          lab = this.secLabel = { text, color, c };
        }
        g.drawImage(lab.c, 0, H - 9 - 12);
      }
    }
    // Holders of the legendary chart you can hear, and where a cursed map pulls: ticks at the rim.
    const rim = (a: number, color: string) => {
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(W / 2 + Math.sin(a) * (W / 2 - 12), H / 2 - Math.cos(a) * (H / 2 - 12));
      g.lineTo(W / 2 + Math.sin(a) * (W / 2 - 3), H / 2 - Math.cos(a) * (H / 2 - 3));
      g.stroke();
      g.lineWidth = 1;
    };
    for (const a of self?.legendEcho ?? []) rim(a, '#e8c65a');
    // A storm front on her course (docs/16 #10): a red tick toward it and the minutes at the top of the dial, on
    // every screen; the convoy she escorts, a gold tick when it is beyond the dial.
    const fw = state.frontWarn;
    if (fw) {
      rim(fw.bearing, '#ff7a5a');
      const n = Math.max(1, Math.round((fw.sec - (performance.now() - state.frontsAt) / 1000) / 60));
      const text = LS('front.warnShort', { n });
      g.font = '700 11px Inter, sans-serif';
      g.textAlign = 'center';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.9)';
      const wy = H / 2 - W * 0.27; // inside the dial, clear of the brass ring over its edge
      g.strokeText(text, W / 2, wy);
      g.fillStyle = '#ff8a6a';
      g.fillText(text, W / 2, wy);
      g.lineWidth = 1;
    }
    for (const cv of state.raid?.known ?? []) {
      const dx = cv.x - own.x, dy = cv.y - own.y;
      if (cv.mine && Math.hypot(dx, dy) * k >= W / 2 - 8) rim(Math.atan2(dx, -dy), '#f2c14e');
    }
    for (const m of self?.maps ?? []) if (m.bearing !== undefined) rim(m.bearing, '#2ee6c8');
    // Tasks of the sea (docs/11 P6): a nest in view as an orange ring with its mark; the nearest unfinished one
    // beyond it as an orange tick on the rim.
    let near: { x: number; y: number; d: number } | null = null;
    for (const t of state.tasks) {
      const d = Math.hypot(t.x - own.x, t.y - own.y);
      if (Math.max(Math.abs(tx(t.x) - W / 2), Math.abs(ty(t.y) - H / 2)) < W / 2 - 4) {
        g.strokeStyle = t.done ? 'rgba(160,160,160,0.6)' : t.kind === 'wreck' ? 'rgba(80,200,190,0.95)' : t.kind === 'haunt' ? 'rgba(170,130,230,0.95)' : 'rgba(232,140,64,0.95)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(tx(t.x), ty(t.y), Math.max(4, t.r * k), 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 1;
      } else if (!t.done && d < 20000 && (!near || d < near.d)) near = { x: t.x, y: t.y, d };
    }
    if (near) rim(Math.atan2(near.x - own.x, -(near.y - own.y)), '#e88c40');
    // The helmsman's course (2026-10-18): the planned way round the land, dashed gold, from her to its end.
    const course = courseOf(state);
    if (course) {
      const pts = courseAhead(course, own.x, own.y).pts;
      g.save();
      g.globalAlpha = course.paused ? 0.5 : 1;
      g.setLineDash([3, 3]);
      g.lineJoin = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(tx(x), ty(y)) : g.moveTo(tx(x), ty(y))));
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = '#e8c46a';
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
    }
    // Her own mark (set on the chart): a gold diamond in view, a gold tick on the rim beyond it.
    const wp = waypoint();
    if (wp) {
      const wx = tx(wp.x), wy = ty(wp.y);
      if (Math.hypot(wx - W / 2, wy - H / 2) < W / 2 - 8) {
        g.fillStyle = '#e8c46a';
        g.strokeStyle = 'rgba(0,0,0,0.85)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(wx, wy - 6);
        g.lineTo(wx + 5, wy);
        g.lineTo(wx, wy + 6);
        g.lineTo(wx - 5, wy);
        g.closePath();
        g.stroke();
        g.fill();
        g.lineWidth = 1;
      } else rim(Math.atan2(wp.x - own.x, -(wp.y - own.y)), '#f0d48e');
    }
    // Signs on the horizon (docs/12 P2): a gold "?" where something is happening.
    g.font = '700 11px Inter, sans-serif';
    g.textAlign = 'center';
    for (const sg of state.sights) {
      if (Math.max(Math.abs(tx(sg.x) - W / 2), Math.abs(ty(sg.y) - H / 2)) > W / 2 - 6) continue;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.strokeText('?', tx(sg.x), ty(sg.y) + 4);
      g.fillStyle = '#e8c46a';
      g.fillText('?', tx(sg.x), ty(sg.y) + 4);
    }
    g.lineWidth = 1;
    // The wanted (docs/12 P5): the informant's mark (at the rim when beyond the dial), the pirates a ranked hunter
    // sees, the circles about wanted captains for a licensed hunter, and the lairs with their batteries.
    const wantedV = state.wanted;
    if (wantedV) {
      const skull = (x: number, y: number, col: string, size: number) => {
        g.font = `700 ${size}px Inter, sans-serif`;
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(0,0,0,0.85)';
        g.strokeText('☠', x, y + size / 3);
        g.fillStyle = col;
        g.fillText('☠', x, y + size / 3);
      };
      g.setLineDash([4, 3]);
      g.strokeStyle = 'rgba(224,90,70,0.8)';
      g.lineWidth = 1.2;
      for (const r of wantedV.rogues) {
        g.beginPath();
        g.arc(tx(r.x), ty(r.y), Math.max(6, r.r * k), 0, Math.PI * 2);
        g.stroke();
      }
      g.setLineDash([]);
      for (const l of wantedV.lairs) {
        const lx = tx(l.x), ly = ty(l.y);
        if (Math.max(Math.abs(lx - W / 2), Math.abs(ly - H / 2)) > W / 2 - 6) continue;
        g.fillStyle = l.open ? '#e8c46a' : l.hp > 0 ? '#b0302a' : '#777';
        g.fillRect(lx - 3, ly - 3, 6, 6);
      }
      for (const sp of wantedV.sight) {
        const sx = tx(sp.x), sy = ty(sp.y);
        if (Math.max(Math.abs(sx - W / 2), Math.abs(sy - H / 2)) > W / 2 - 6) continue;
        skull(sx, sy, '#e05a46', 11);
      }
      // One's own caravans (docs/12 P8): green squares, red while pirates are on them; at the rim when far.
      for (const cv of state.caravans) {
        const dx = cv.x - own.x, dy = cv.y - own.y;
        const col = cv.attack !== null ? '#e05a46' : '#6fd46f';
        if (Math.hypot(dx, dy) * k < W / 2 - 8) {
          g.fillStyle = col;
          g.fillRect(tx(cv.x) - 3, ty(cv.y) - 3, 6, 6);
        } else if (cv.attack !== null) rim(Math.atan2(dx, -dy), col);
      }
      // The tipped merchants at sea (docs/12 P6): gold diamonds, or at the rim.
      for (const mk of state.raid?.marks ?? []) {
        const dx = mk.x - own.x, dy = mk.y - own.y;
        if (Math.hypot(dx, dy) * k < W / 2 - 8) {
          g.fillStyle = '#f2c14e';
          g.strokeStyle = 'rgba(0,0,0,0.8)';
          g.beginPath();
          g.moveTo(tx(mk.x), ty(mk.y) - 5);
          g.lineTo(tx(mk.x) + 4, ty(mk.y));
          g.lineTo(tx(mk.x), ty(mk.y) + 5);
          g.lineTo(tx(mk.x) - 4, ty(mk.y));
          g.closePath();
          g.fill();
          g.stroke();
        } else rim(Math.atan2(dx, -dy), '#f2c14e');
      }
      if (wantedV.informed) {
        const dx = wantedV.informed.x - own.x, dy = wantedV.informed.y - own.y;
        if (Math.hypot(dx, dy) * k < W / 2 - 8) skull(tx(wantedV.informed.x), ty(wantedV.informed.y), '#ff6a4a', 14);
        else rim(Math.atan2(dx, -dy), '#ff6a4a');
      }
      g.lineWidth = 1;
      g.font = '700 11px Inter, sans-serif';
    }
    // The followed quest's goal (docs/11 P6): a gold diamond on the chart, or at the rim toward it.
    const qp = questPointer(trackedQuest(self?.quests, own), own.x, own.y, state.region);
    if (qp) {
      const dx = qp.x - own.x, dy = qp.y - own.y;
      const inside = Math.hypot(dx, dy) * k < W / 2 - 8;
      const a = Math.atan2(dx, -dy);
      const qx = inside ? tx(qp.x) : W / 2 + Math.sin(a) * (W / 2 - 8), qy = inside ? ty(qp.y) : H / 2 - Math.cos(a) * (H / 2 - 8);
      g.fillStyle = '#d9b25a';
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.beginPath();
      g.moveTo(qx, qy - 5);
      g.lineTo(qx + 4, qy);
      g.lineTo(qx, qy + 5);
      g.lineTo(qx - 4, qy);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.strokeStyle = 'rgba(120,190,200,0.8)';
    for (const w of self?.wrecks ?? []) {
      g.beginPath();
      g.moveTo(tx(w.x) - 3, ty(w.y) - 3);
      g.lineTo(tx(w.x) + 3, ty(w.y) + 3);
      g.moveTo(tx(w.x) + 3, ty(w.y) - 3);
      g.lineTo(tx(w.x) - 3, ty(w.y) + 3);
      g.stroke();
    }
    // Insider: Crown patrols as hollow red diamonds; hidden coves as green hooks.
    g.strokeStyle = 'rgba(224,101,90,0.8)';
    for (const [px, py] of state.self?.patrols ?? []) {
      if (Math.abs(px - own.x) > range || Math.abs(py - own.y) > range) continue;
      g.beginPath();
      g.moveTo(tx(px), ty(py) - 4);
      g.lineTo(tx(px) + 4, ty(py));
      g.lineTo(tx(px), ty(py) + 4);
      g.lineTo(tx(px) - 4, ty(py));
      g.closePath();
      g.stroke();
    }
    g.fillStyle = '#6fbf8f';
    for (const c of state.self?.coves ?? []) {
      if (Math.abs(c.x - own.x) > range || Math.abs(c.y - own.y) > range) continue;
      g.beginPath();
      g.arc(tx(c.x), ty(c.y), 3, 0, Math.PI * 2);
      g.fill();
    }
    // Right of revenge: who sank you, in red. The duel ring.
    g.strokeStyle = '#e0655a';
    g.lineWidth = 2;
    for (const m of state.marks) {
      const mx = clamp(tx(m.x), 4, c.width - 4), my = clamp(ty(m.y), 4, c.height - 4);
      g.beginPath();
      g.moveTo(mx - 4, my - 4);
      g.lineTo(mx + 4, my + 4);
      g.moveTo(mx + 4, my - 4);
      g.lineTo(mx - 4, my + 4);
      g.stroke();
    }
    g.lineWidth = 1;
    if (state.duel) {
      g.setLineDash([4, 3]);
      g.beginPath();
      g.arc(tx(state.duel.cx), ty(state.duel.cy), state.duel.r * k, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    // Sieges you are part of: the landing point as a red ring.
    g.strokeStyle = '#e0655a';
    for (const x of state.holdings.sieges) {
      g.beginPath();
      g.arc(tx(x.landing.x), ty(x.landing.y), 5, 0, Math.PI * 2);
      g.stroke();
    }
    // Your group: green squares; they stay on the chart however far they sail.
    g.fillStyle = '#7fd08a';
    for (const m of state.party?.members ?? []) {
      if (m.name === state.self?.name || m.docked || !m.online) continue;
      const mx = clamp(tx(m.x), 3, c.width - 3), my = clamp(ty(m.y), 3, c.height - 3);
      g.fillRect(mx - 2.5, my - 2.5, 5, 5);
    }
    // Captains looking for company within the dial (docs/16 #31): a small pennant in the goal's colour.
    for (const e of state.lfg) {
      if (!e.goal || e.x === undefined || e.y === undefined || Math.abs(e.x - own.x) > range || Math.abs(e.y - own.y) > range) continue;
      drawLfgFlag(g, tx(e.x), ty(e.y), e.goal, 0.9);
    }
    // Groupmates' signal flags (docs/16 #35): held on the rim when beyond the dial, with a pulsing ring.
    for (const sg of liveSignals(state)) drawSignalFlag(g, clamp(tx(sg.x), 8, c.width - 8), clamp(ty(sg.y), 12, c.height - 4), sg.kind, sg.age, 1);
    // World bosses within reach: a large violet ring.
    g.strokeStyle = '#b07ae0';
    g.lineWidth = 2;
    for (const b of state.bosses) {
      g.beginPath();
      g.arc(clamp(tx(b.x), 6, c.width - 6), clamp(ty(b.y), 6, c.height - 6), 6, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 1;
    // The Abyss: Islands of Light, dead-wind zones, the Eye, and the sails your lookouts only think they see.
    const ab = self?.abyss;
    if (ab) {
      g.fillStyle = 'rgba(255,245,210,0.9)';
      for (const l of ab.lights) {
        g.beginPath();
        g.arc(tx(l.x), ty(l.y), 3, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(160,160,170,0.5)';
      for (const z of ab.deadWinds) {
        g.beginPath();
        g.arc(tx(z.x), ty(z.y), Math.max(3, z.r * k), 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = '#7a4bd0';
      g.beginPath();
      g.arc(tx(ab.eye.x), ty(ab.eye.y), 5, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#e0655a';
      for (const [px, py] of ab.phantoms) {
        g.beginPath();
        g.arc(tx(px), ty(py), 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Monsters the Choir shows you (Eyes of the Choir).
    g.fillStyle = '#9b6bd0';
    for (const [mx, my] of state.self?.monsters ?? []) {
      g.beginPath();
      g.arc(tx(mx), ty(my), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Afraid lookouts call sails that are not there (Drowned Eyes 2 sees through them).
    if ((state.you?.sanity ?? 100) <= 50 && (state.self?.talents.abs_drowned_eyes ?? 0) < 2) {
      const epoch = Math.floor(performance.now() / 8000);
      g.fillStyle = '#e0655a';
      for (let i = 0; i < 3; i++) {
        const a = Math.sin(epoch * 12.9898 + i * 78.233) * 43758.5453, b = Math.sin(epoch * 39.3468 + i * 11.135) * 24634.6345;
        const fx = (a - Math.floor(a)) * W, fy = (b - Math.floor(b)) * H;
        g.beginPath();
        g.arc(fx, fy, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Own ship.
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(own.heading);
    g.fillStyle = '#f0e6c8';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.restore();
    // The wind on the rim: where it blows from, an arrow pointing where it goes (phones have no compass). Green
    // when it drives her on, red when it holds her back, blue on the beam.
    const wv = headingVec(state.wind[0]);
    const r0 = W / 2 - 22;
    const push = windPush(relWindDeg(own.heading, { dir: state.wind[0], strength: state.wind[1] }), state.wind[1]) - 1;
    const tint = push > 0.05 ? 'rgba(127,181,138,0.95)' : push < -0.05 ? 'rgba(214,104,88,0.95)' : 'rgba(143,179,217,0.9)';
    g.strokeStyle = tint;
    g.fillStyle = tint;
    g.lineWidth = 2 + state.wind[1] * 2;
    g.beginPath();
    g.moveTo(W / 2 - wv.x * r0, H / 2 - wv.y * r0);
    g.lineTo(W / 2 - wv.x * (r0 - 26), H / 2 - wv.y * (r0 - 26));
    g.stroke();
    g.beginPath();
    g.moveTo(W / 2 - wv.x * (r0 - 34), H / 2 - wv.y * (r0 - 34));
    g.lineTo(W / 2 - wv.x * (r0 - 22) - wv.y * 6, H / 2 - wv.y * (r0 - 22) + wv.x * 6);
    g.lineTo(W / 2 - wv.x * (r0 - 22) + wv.y * 6, H / 2 - wv.y * (r0 - 22) - wv.x * 6);
    g.fill();
    g.lineWidth = 1;
    g.restore();
    const vg = vis.getContext('2d')!;
    vg.clearRect(0, 0, vis.width, vis.height);
    vg.drawImage(c, 0, 0);
  }


  /** The lookout's call for a new sign: its bearing and range. */
  lookout(dx: number, dy: number): void {
    const d = Math.hypot(dx, dy);
    const dist = d >= 1000 ? RL('dist.km', { n: dec1(d / 1000) }) : RL('dist.m', { n: Math.round(d / 10) * 10 });
    this.toast(L('obj.sight', { dir: L(`dir.${compassKey(Math.atan2(dx, -dy))}` as never), d: dist }), 'info');
  }

  /** The sea's news (world announcements), kept in their own small column for a while, newest on top. */
  feed(msg: string): void {
    const el = $('hud-feed');
    const now = performance.now();
    this.feedItems = [{ msg, at: now }, ...this.feedItems.filter((f) => f.msg !== msg && now - f.at < 60_000)].slice(0, 4);
    const draw = () => {
      const t = performance.now();
      this.feedItems = this.feedItems.filter((f) => t - f.at < 60_000);
      el.classList.toggle('hidden', !this.feedItems.length);
      el.innerHTML = this.feedItems.length ? `<div class="feed-h">${esc(L('feed.title'))}</div>${this.feedItems.map((f) => `<div class="feed-line">${esc(f.msg.replace(/^(Вести|WORLD):\s*/, ''))}</div>`).join('')}` : '';
    };
    draw();
    clearTimeout(this.feedTimer);
    this.feedTimer = setTimeout(draw, 61_000);
  }
  private feedItems: { msg: string; at: number }[] = [];
  private feedTimer: ReturnType<typeof setTimeout> | undefined;

  /** The toasts (docs/23 items 14, 29): the kit's queue — two at most, 2.5 s each, the same words counted «×2» —
   *  in the HUD's band (placed by placeStrip for the popup budget), or the open window's strip under it. */
  private toastQ = new Toasts({
    host: () => (modalOpen() ? $('modal-toasts') : this.toastsEl),
    before: (host) => {
      if (host !== this.toastsEl) return placeModalStrip(host);
      this.toastSoon = true;
      this.placeStrip();
      this.toastSoon = false;
    },
    // the simple HUD's top band: one toast at a time, the next waiting its turn (owner, 2026-10-29: they ran into each
    // other and into the island's step); the detailed HUD two
    limit: () => (simpleHud() ? 1 : TOAST.visible),
    render: (t) => (t.data as () => HTMLElement)(),
    bump: (el, t) => {
      let badge = el.querySelector<HTMLElement>('.t-count');
      if (!badge) {
        badge = document.createElement('b');
        badge.className = 't-count';
        el.append(badge);
      }
      badge.textContent = `×${t.count}`;
    },
  });

  /** The sea's news while the decks fight (a battle on the hexes, the round-by-round deck fight): held, and told when
   *  the fight is over — a world toast («Нанесено на карту…») stood over the field (docs/23, QA of phase 5). What the
   *  battle itself says (a refusal, a win) is told at once, in the battle's top band. */
  private held: { key: string; show: () => void }[] = [];
  private hold(key: string, show: () => void): boolean {
    if (!newsHeld()) return false;
    this.held = [...this.held.filter((x) => x.key !== key), { key, show }].slice(-HELD_MAX);
    return true;
  }
  /** The fight over: the held news, oldest first (the queue shows two and keeps the rest waiting). */
  releaseHeld(): void {
    if (!this.held.length || newsHeld()) return;
    const h = this.held;
    this.held = [];
    for (const x of h) x.show();
  }

  /** A line said aboard (docs/16 #16–17): the speaker's face and name over his words, in the toasts' band. */
  talk(face: string, who: string, line: string, kind: string): void {
    if (this.hold(`talk|${who}|${line}`, () => this.talk(face, who, line, kind))) return;
    this.toastQ.push(`talk|${who}|${line}`, 'talk', () => {
      const el = document.createElement('div');
      el.className = `toast talk ${kind}`;
      el.dataset.msg = line;
      el.innerHTML = `${face}<span class="talk-body"><b class="talk-who">${esc(who)}</b><span class="talk-line">${esc(line)}</span></span>`;
      el.title = `${who}: ${line}`;
      return el;
    });
  }

  toast(msg: string, kind: string): void {
    if (kind !== 'bad' && kind !== 'good' && kind !== 'voyage' && this.hold(`${kind}|${msg}`, () => this.toast(msg, kind))) return;
    this.toastQ.push(msg, kind, () => {
      const el = document.createElement('div');
      el.dataset.msg = msg;
      el.className = `toast ${kind}`;
      el.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
      const art = kind === 'gold' ? 'coin' : kind === 'xp' ? 'xp' : kind === 'bad' ? 'danger' : kind === 'good' ? 'anchor' : '';
      // A dash goes down with the words after it: «+68 опыта —» left hanging at a narrow toast's line end (QA, 2026-10-04).
      el.innerHTML = `${art ? icon(art, '', 'ico-toast') : ''}<span>${esc(keyless(msg)).replace(/ — /g, ' — ')}</span>`;
      decorateSums(el);
      el.title = keyless(msg);
      return el;
    });
  }

  /** A toast that does something when tapped (an invitation waiting: the Company screen to answer it). */
  tapToast(msg: string, kind: string, onTap: () => void, art = 'tab_letters'): void {
    this.toastQ.push(msg, kind, () => {
      const el = document.createElement('div');
      el.dataset.msg = msg;
      el.className = `toast ${kind} tap`;
      el.setAttribute('role', 'button');
      el.innerHTML = `${icon(art, '', 'ico-toast')}<span>${esc(keyless(msg))}</span>`;
      el.onclick = () => {
        el.remove();
        onTap();
      };
      return el;
    });
  }

  /** A sound caption at the edge of the screen it came from (docs/07 §11.5). */
  caption(text: string, dir: 'ahead' | 'astern' | 'port' | 'starboard' | 'near'): void {
    const el = document.createElement('div');
    el.className = `caption cap-${dir}`;
    el.textContent = text;
    $('captions').append(el);
    while ($('captions').children.length > 4) $('captions').firstChild!.remove();
    setTimeout(() => el.remove(), 3500);
  }

  /** Letters waiting: a small seal by the minimap. */
  setUnread(n: number): void {
    const el = $('unread');
    el.textContent = n ? `✉ ${n}` : '';
    el.classList.toggle('hidden', !n);
  }

  banner(title: string, sub: string): void {
    // A heading starts with a capital even when the name reads lower-case inside a sentence ("море Грейвуотер").
    title = title.charAt(0).toUpperCase() + title.slice(1);
    // The herald joins the toasts' band (owner, 2026-10-04: nothing over the middle of the screen; the region's name
    // printed large at a quarter of the height stood over the sea before the ship).
    if (modalOpen()) return; // a window open: the herald's words are for the sea, not over the window
    this.toastQ.push(`herald|${title}`, 'herald', () => {
      const el = document.createElement('div');
      el.className = 'toast herald';
      el.innerHTML = `<b>${esc(title)}</b><small>${esc(sub)}</small>`;
      return el;
    });
  }

  /** Party frames (docs/11 P6), as WoW's: each groupmate's name, level and hull, and where they are — a bearing
   *  and the distance, in port, or ashore. Four at most, then "+N". */
  /**
   * The target frame (canon D12), as WoW's: her level in the colour of the danger, her name, class and role, how she
   * holds (hull, crew, sails), what ails her, how far she lies, and in a word what a fight with her would be.
   */
  /** docs/23 item 39: the best shot for her mark now (main.ts reckons it with suggestAmmo), lit on the bar. */
  bestAmmo: 'round' | 'chain' | 'grape' | null = null;

  drawTarget(state: ClientState, id: number | null): void {
    const el = $('hud-target');
    const s = id !== null ? state.ships.get(id) : undefined;
    const own = state.ownDisplay;
    if (!s?.info || !own || state.self?.dockedAt) {
      if (this.lastTargetKey) {
        this.lastTargetKey = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const info = s.info, c = s.cur;
    const cls = SHIP_CLASSES[info.classId];
    const d = Math.hypot(c.x - own.x, c.y - own.y);
    const dist = d < 1000 ? `${Math.round(d / 10) * 10} ${L('m')}` : `${(d / 1000).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${L('km')}`;
    const threat = info.shipLevel ? threatTo(info.shipLevel, info.classId) : null;
    const fx = [
      c.flags & SF.FIRE ? L('tg.fire') : '',
      c.flags & SF.SURRENDERED ? L('tg.struck') : '',
      c.flags & SF.BOARDING ? L('tg.boarding') : '',
      c.flags & (SF.SLOWED | SF.TANGLED) ? L('tg.slowed') : '',
      c.flags & SF.REPAIRING ? L('tg.repairing') : '',
    ].filter(Boolean);
    const ap = state.appraisal?.id === id ? state.appraisal : null;
    const struck = !info.isPlayer && info.npcRole === 'merchant' && (c.flags & SF.SURRENDERED) !== 0 && d < 400;
    // Her boarding chance (docs/23 item 49): the battle played out on the server, asked every few seconds.
    const od = id !== null ? state.boardOdds.get(id) : undefined;
    const odds = od && performance.now() / 1000 - od.at < 15 ? od : null;
    // «≈ N залпов» (docs/25 item 12): her broadsides to sink the mark as she stands — sink her or board her.
    const self = state.self, st = state.ownStats;
    const vol = self && st && info.hullMax && info.shipLevel ? volleysToSink(st, self.loadout, { isPlayer: true, ironRain: (self.talents.gun_iron_rain ?? 0) > 0 }, { classId: info.classId, shipLevel: info.shipLevel, isPlayer: info.isPlayer, hullMax: info.hullMax, armor: info.armor ?? 0, inc: info.inc ?? 1, hullFrac: c.hull }) : null;
    const key = `${vol ?? ''}|${odds ? `${odds.chance}|${odds.risky}` : ''}|${lang()}|${id}|${info.shipLevel}|${threat}|${Math.round(c.hull * 50)}|${Math.round(c.crew * 50)}|${Math.round(c.sails * 50)}|${fx.join(',')}|${dist}|${info.title ?? ''}|${ap ? `${ap.value}|${ap.fill}|${ap.escorts}|${ap.dest}` : ''}|${struck}|${c.flags & (SF.BLACK_FLAG | SF.NEUTRAL | SF.NO_BOARD)}:${info.city ?? ''}`;
    if (key === this.lastTargetKey) return;
    this.lastTargetKey = key;
    el.classList.remove('hidden');
    const beast = beastOfClass(info.classId);
    const named = info.named ? namedLabel(info.named) : null;
    const name = beast ? BEASTS[beast].name[lang() === 'ru' ? 1 : 0] : named ? named.name : info.isPlayer ? `${info.captainName} · ${placeName(info.name)}` : placeName(info.name);
    const guard = id !== null ? guardOfEntity(state, id) : null; // a guard of the adventure map (docs/17 H4): what it is, not its hull
    // A guard named as its ship (the Rotting Hulk, the Wreck of the Drowned): not its name twice (QA, 2026-10-04).
    const guardName = guard ? GUARDS[guard.kind].name[lang() === 'ru' ? 1 : 0] : '';
    const role = guard ? (sameWords(guardName, name) ? L('tg.guard') : guardName) : info.isPlayer ? L('tg.lv', { n: info.level ?? 1 }) : info.npcRole && `role.${info.npcRole}` in REN ? RL(`role.${info.npcRole}` as 'role.merchant') : '';
    const bar = (k: string, v: number) => `<span class="tg-bar tg-${k}"><i style="width:${pct(clamp(v, 0, 1))}"></i></span>`;
    // ⓘ: her detail card (owner, 2026-10-30; client/src/ui/detail.ts) — the frame's own tap still inspects a captain
    const infoBtn = `<button type="button" class="dc-info tg-info"${detailAttr(`ship:${id}`)} aria-label="${esc(DL('infoT'))}" title="${esc(DL('infoT'))}">ⓘ</button>`;
    if (beast) {
      // A beast of the sea (docs/12 P4): its nature instead of a class and a role, and only its hide for a bar.
      const temper = BEASTS[beast].temper;
      const nature = temper === 'shy' || temper === 'tusk' ? L('tg.shy') : temper === 'ram' ? L('tg.ram') : L('tg.predator');
      el.className = `hud-block tg${info.elite ? ' tg-elite' : ''}${threat ? ` tg-${threat}` : ''}`;
      el.innerHTML = `<div class="tg-head">${info.shipLevel ? levelChip(info.shipLevel, info.classId) : ''}<b class="tg-name">${esc(name)}</b><span class="tg-dist">${esc(dist)}</span>${infoBtn}</div>
      <div class="tg-sub muted">${esc(nature)}${info.elite ? ` · <span class="tg-el">${esc(L('tg.elite'))}</span>` : ''}</div>
      ${bar('hull', c.hull)}
      <div class="tg-foot">${threat ? `<span class="tg-threat" style="color:${THREAT_COLOR[threat]}">${esc(L(`tg.${threat}`))}</span>` : ''}</div>`;
      el.onclick = null;
      return;
    }
    el.className = `hud-block tg${info.elite ? ' tg-elite' : ''}${threat ? ` tg-${threat}` : ''}`;
    el.innerHTML = `<div class="tg-head">${info.shipLevel ? levelChip(info.shipLevel, info.classId) : ''}<b class="tg-name">${esc(name)}</b><span class="tg-dist">${esc(dist)}</span>${infoBtn}</div>
      <div class="tg-sub muted">${info.isPlayer && info.title ? `<span class="tg-title">${esc(sv(info.title))}</span> · ` : ''}${named ? `<span class="tg-wanted">${esc(named.tag)}</span> · ` : ''}${esc([guard || sameWords(cls?.name ?? info.classId, name) ? '' : cls?.name ?? info.classId, role].filter(Boolean).join(' · '))}${info.elite ? ` · <span class="tg-el">${esc(L('tg.elite'))}</span>` : ''}</div>
      ${info.isPlayer ? `<div class="tg-colours">${flagChip(shipColours(c.flags, info))}</div>` : ''}
      ${bar('hull', c.hull)}${bar('crew', c.crew)}${bar('sails', c.sails)}
      ${isZoneBossClass(info.classId) ? `<div class="tg-zb"${artBgAttr([zoneBossCard(info.classId)])}></div><div class="tg-glass">${esc(L('tg.zboss'))}</div>` : info.crewMax ? armyGlance(Math.round(c.crew * info.crewMax), info.units ?? []) : ''}
      ${ap && !isZoneBossClass(info.classId) ? `<div class="tg-glass">${esc(L(ap.exact ? 'tg.glassExact' : 'tg.glass', { v: ap.value.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB'), fill: Math.round(ap.fill * 100), esc: ap.escorts, crew: ap.crew }))}${ap.dest ? ` · ${esc(L('tg.glassDest', { port: placeName(ap.dest) }))}` : ''}</div>` : ''}
      <div class="tg-foot">${threat ? `<span class="tg-threat" style="color:${THREAT_COLOR[threat]}">${esc(L(`tg.${threat}`))}</span>` : ''}${vol ? `<span class="tg-volleys" title="${esc(LSF('tg.volleysTip'))}">${esc(LSF('tg.volleys', { n: vol, w: plural(vol, LSF('tg.volley.one'), LSF('tg.volley.few'), LSF('tg.volley.many')) }))}</span>` : ''}${odds ? `<span class="tg-odds tg-odds-${odds.risky ? 'bad' : odds.chance < 0.55 ? 'warn' : 'good'}" title="${esc(LSF('tg.oddsTip', { n: ODDS_SIMS_SHOWN }))}">${esc(LSF('tg.odds', { p: Math.round(odds.chance * 100) }))}</span>` : ''}${fx.length ? `<span class="tg-fx">${esc(fx.join(' · '))}</span>` : ''}${struck ? `<button class="btn btn-small tg-tribute" data-tribute="${id}">${esc(L('tg.tribute'))}</button>` : ''}</div>`;
    artBgWire(el);
    el.querySelector<HTMLElement>('[data-tribute]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onTribute(id!);
    });
    el.onclick = info.isPlayer ? () => this.onTargetTap(info.captainName) : null;
  }

  /**
   * The hunt (docs/12 P4): the beast on the line — the tension against its band, its strength and hide — the carcass
   * being flensed, one alongside to flense, or, with a shy beast near, the noise of her way.
   */
  /** The regatta's panel (docs/12 P10 #5): the buoy she sails for, where, and her time. */
  private drawRegatta(state: ClientState): void {
    const el = $('hud-regatta');
    const html = regattaPanel(state);
    const key = html ?? '';
    if (key === this.lastRegattaKey) return;
    this.lastRegattaKey = key;
    el.classList.toggle('hidden', !html);
    el.innerHTML = html ?? '';
  }

  /** The sea's holiday (docs/12 P10 #18): a slim line while one is on. */
  private drawHoliday(state: ClientState): void {
    const el = $('hud-holiday');
    const html = holidayLine(state);
    if (html === this.lastHolidayKey) return;
    this.lastHolidayKey = html;
    el.classList.toggle('hidden', !html);
    el.innerHTML = html;
  }

  /** The Descent (docs/12 P10 #17): the tier, its creatures, current and darkness, and the clock. */
  private drawDescent(state: ClientState): void {
    const el = $('hud-descent');
    const html = descentPanel(state);
    const key = html ?? '';
    if (key === this.lastDescentKey) return;
    this.lastDescentKey = key;
    el.classList.toggle('hidden', !html);
    el.innerHTML = html ?? '';
  }

  /** A letter of marque's fleet order (docs/12 P10 #15): what, how far along, which way, the sunset. */
  private drawOrder(state: ClientState): void {
    const el = $('hud-order');
    const html = orderPanel(state);
    const key = html ?? '';
    if (key === this.lastOrderKey) return;
    this.lastOrderKey = key;
    el.classList.toggle('hidden', !html);
    el.innerHTML = html ?? '';
  }

  /** The heart of the storm (docs/12 P10 #14): where it is, her charge, her hearts. */
  private drawStorm(state: ClientState): void {
    const el = $('hud-storm');
    const html = stormPanel(state);
    const key = html ?? '';
    if (key === this.lastStormKey) return;
    this.lastStormKey = key;
    el.classList.toggle('hidden', !html);
    el.innerHTML = html ?? '';
  }

  private drawHunt(state: ClientState): void {
    const el = $('hud-hunt');
    const v = state.hunt, own = state.ownDisplay, you = state.you;
    const ru = lang() === 'ru' ? 1 : 0;
    const bname = (id: BeastId) => BEASTS[id].name[ru];
    let shy: BeastId | null = null;
    if (!v && own && you && !state.self?.dockedAt) {
      let bd = 1500;
      for (const r of state.ships.values()) {
        const id = r.info ? beastOfClass(r.info.classId) : undefined;
        if (!id || !BEASTS[id].spookRange) continue;
        const d = Math.hypot(r.cur.x - own.x, r.cur.y - own.y);
        if (d < bd) {
          bd = d;
          shy = id;
        }
      }
    }
    if (!v && !shy) {
      if (this.lastHuntKey) {
        this.lastHuntKey = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const line = v?.line;
    const mode = line ? (line.spent ? 'spent' : 'line') : v?.flense ? 'flense' : v?.carcass ? 'carcass' : 'noise';
    const noise = you ? hullNoise(you.spd, state.ownStats?.maxSpeed ?? 10, you.combat ? 5 : 999) : 0;
    const band = noiseBand(noise);
    const key = `${lang()}|${mode}|${line?.beast ?? v?.flense?.beast ?? v?.carcass?.beast ?? shy}|${line?.payIn ?? ''}|${v?.carcass?.id ?? ''}|${mode === 'noise' ? band : ''}`;
    if (key !== this.lastHuntKey) {
      this.lastHuntKey = key;
      el.classList.remove('hidden');
      el.classList.toggle('hp-active', mode !== 'noise');
      if (line) {
        const b = bname(line.beast);
        const top = Math.max(120, line.snap * 1.1);
        el.innerHTML = `<div class="fp-head"><b>${esc(L(line.spent ? 'hunt.spent' : 'hunt.line', { beast: b }))}</b><span class="hp-lvl">⚓${line.level}</span></div>
          <div class="hp-row"><span>${esc(L('hunt.tension'))}</span><div class="hp-bar hp-t"><em class="hp-good" style="left:${(line.good[0] / top) * 100}%;width:${((line.good[1] - line.good[0]) / top) * 100}%"></em><em class="hp-snap" style="left:${(line.snap / top) * 100}%"></em><em class="hp-slack" style="width:${(line.slack / top) * 100}%"></em><i></i></div></div>
          <div class="hp-row"><span>${esc(L('hunt.stamina'))}</span><div class="hp-bar hp-s"><i></i></div></div>
          <div class="hp-row"><span>${esc(L('hunt.hull'))}</span><div class="hp-bar hp-h"><i></i></div></div>
          <div class="fp-line muted hp-hint">${esc(L(line.spent ? 'hunt.hintSpent' : 'hunt.hint'))}</div>
          <div class="fp-acts">${line.spent ? '' : `<button class="btn btn-small" data-hunt="slack"${line.payIn ? ' disabled' : ''}>${esc(line.payIn ? L('hunt.slackIn', { n: line.payIn }) : L('hunt.slack'))}</button>`}<button class="btn btn-small" data-hunt="cut">${esc(L('hunt.cut'))}</button></div>`;
      } else if (v?.flense) {
        el.innerHTML = `<div class="fp-head"><b>${esc(L('hunt.flense', { beast: bname(v.flense.beast) }))}</b></div>
          <div class="hp-row"><div class="hp-bar hp-f"><i></i></div></div>
          <div class="fp-line muted hp-hint">${esc(L('hunt.flenseHint'))}</div>`;
      } else if (v?.carcass) {
        el.innerHTML = `<div class="fp-head"><b>${esc(L('hunt.carcass', { beast: bname(v.carcass.beast) }))}</b></div>
          <div class="fp-line muted">${esc(L('hunt.carcassHint'))}</div>
          <div class="fp-acts"><button class="btn btn-small btn-primary" data-hunt="flense" data-id="${v.carcass.id}">${esc(L('hunt.flenseGo'))}</button></div>`;
      } else {
        el.innerHTML = `<div class="fp-head"><b class="hp-noise hp-${band}">${esc(L('hunt.noise', { band: L(`hunt.${band}` as 'hunt.quiet') }))}</b></div>
          <div class="fp-line muted">${esc(L('hunt.noiseHint', { beast: bname(shy!) }))}</div>`;
      }
      el.querySelectorAll<HTMLElement>('[data-hunt]').forEach((b) => (b.onclick = () => this.onHunt(b.dataset.hunt as 'slack', b.dataset.id ? Number(b.dataset.id) : undefined)));
    }
    // The bars move every frame without rebuilding the block.
    if (line) {
      const t = el.querySelector<HTMLElement>('.hp-t > i');
      if (t) {
        t.style.width = `${Math.min(100, (line.tension / Math.max(120, line.snap * 1.1)) * 100)}%`;
        t.style.background = line.tension > line.snap * 0.92 || line.tension < line.slack ? '#e0473a' : line.tension >= line.good[0] && line.tension <= line.good[1] ? '#6fd46f' : '#e8a14a';
      }
      const s = el.querySelector<HTMLElement>('.hp-s > i');
      if (s) s.style.width = `${line.stamina * 100}%`;
      const h = el.querySelector<HTMLElement>('.hp-h > i');
      if (h) h.style.width = `${line.hull * 100}%`;
    } else if (v?.flense) {
      const f = el.querySelector<HTMLElement>('.hp-f > i');
      if (f) f.style.width = `${v.flense.progress * 100}%`;
    }
  }

  /** The fishing panel (docs/12 P3): the tackle, what it wants now, and the orders at hand. */
  private drawFishing(state: ClientState): void {
    const el = $('hud-fish');
    const self = state.self, own = state.ownDisplay, you = state.you;
    const f = self?.fishing;
    const fishAboard = (self?.cargo.fish ?? 0) > 0 && (self?.cargo.salt ?? 0) > 0;
    if (!self || !own || !you || !f || self.dockedAt || (!f.method && !fishAboard)) {
      if (this.lastFishKey) {
        this.lastFishKey = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const max = state.ownStats?.maxSpeed ?? 10;
    const spd = you.spd;
    const inShoal = state.shoals.some((s) => Math.hypot(s.x - own.x, s.y - own.y) <= s.r);
    const night = isNight(state.estServerTime());
    const need: Record<string, number> = { net: 1, rod: 1, trap: 15, lamp: 30 };
    let line = '';
    if (f.method && f.skill < need[f.method]) line = L('fish.low', { n: f.skill, need: need[f.method] });
    else if (this.hauling) line = L('fish.hauling');
    else if (f.method === 'net') line = inShoal ? (spd > max * 0.4 ? L('fish.slow') : L('fish.inShoal', { key: this.castKey })) : L('fish.findShoal');
    else if (f.method === 'rod') line = spd >= 2.5 && spd <= max * 0.8 ? L('fish.rodOk') : L('fish.rodPace');
    else if (f.method === 'lamp') line = night && spd <= 1.5 ? L('fish.lampOk', { key: this.castKey }) : L('fish.lampNight');
    else if (f.method === 'trap') line = L('fish.traps', { n: f.traps.length, max: 3 + Math.floor(f.skill / 25) });
    const nearTrap = f.traps.some((t) => Math.hypot(t.x - own.x, t.y - own.y) < 90);
    const acts: [string, string][] = [];
    // Every catch is the captain's own doing (owner, 2026-09-30): the net is cast by hand.
    if (!this.hauling && f.method === 'net' && f.skill >= need.net && inShoal && spd <= max * 0.4) acts.push(['cast', L('fish.cast')]);
    if (!this.hauling && f.method === 'lamp' && f.skill >= need.lamp && night && spd <= 1.5) acts.push(['cast', L('fish.lampCast')]);
    if (f.method === 'trap') acts.push(nearTrap ? ['haul', L('fish.haul')] : ['trap', L('fish.setTrap')]);
    if (f.method === 'rod' && f.skill >= 60) acts.push(['deep', L('fish.deep')]);
    if (fishAboard) acts.push(['salt', L('fish.salt')]);
    const key = `${lang()}|${f.skill}|${Math.round((f.xp / Math.max(1, f.next)) * 20)}|${f.method}|${line}|${acts.map((a) => a[0]).join(',')}`;
    if (key === this.lastFishKey) return;
    this.lastFishKey = key;
    el.classList.remove('hidden');
    el.innerHTML = `<div class="fp-head"><b>${esc(L('fish.title', { n: f.skill }))}</b><span class="muted">${esc(f.method ? L(`fish.${f.method}` as 'fish.net') : L('fish.none'))}</span></div>
      <span class="fp-xp"><i style="width:${pct(f.xp / Math.max(1, f.next))}"></i></span>
      <div class="fp-line muted">${esc(line)}</div>
      ${acts.length ? `<div class="fp-acts">${acts.map(([a, n]) => `<button class="btn btn-small" data-fish="${a}">${esc(n)}</button>`).join('')}</div>` : ''}`;
    el.querySelectorAll<HTMLElement>('[data-fish]').forEach((b) => (b.onclick = () => this.onFishing(b.dataset.fish as 'trap')));
  }

  /** docs/16 #35: the signal flags, a finger wide each, for a captain in a group at sea. */
  private lastSignalsKey = '';
  onSignal: (kind: SignalKind) => void = () => {};
  private drawSignals(state: ClientState): void {
    const el = $('hud-signals');
    const on = (state.party?.members.length ?? 0) > 1 && !!state.ownDisplay && !state.self?.dockedAt;
    const key = on ? lang() : '';
    if (key === this.lastSignalsKey) return;
    this.lastSignalsKey = key;
    el.classList.toggle('hidden', !on);
    el.innerHTML = on ? signalBar() : '';
    el.querySelectorAll<HTMLElement>('[data-signal]').forEach((b) => (b.onclick = () => {
      this.onSignal(b.dataset.signal as SignalKind);
      b.classList.add('sent');
      setTimeout(() => b.classList.remove('sent'), 600);
    }));
  }

  /** docs/16 #32: the sea's goal nearest its end, one line and a thin bar; a tap opens the journal. */
  private lastWorldKey = '';
  onWorldGoal: () => void = () => {};
  private drawWorldGoal(state: ClientState): void {
    const el = $('hud-world');
    const p = state.self?.dockedAt ? null : worldGoalPlate(state);
    const key = p?.key ?? '';
    if (key === this.lastWorldKey) return;
    this.lastWorldKey = key;
    el.classList.toggle('hidden', !p);
    el.innerHTML = p?.html ?? '';
    el.onclick = () => this.onWorldGoal();
  }

  private drawParty(state: ClientState): void {
    const el = $('hud-party');
    const g = state.party;
    const own = state.ownDisplay;
    const mates = (g?.members ?? []).filter((m) => m.name !== state.self?.name);
    if (!g || !mates.length || !own) {
      if (this.lastPartyKey) {
        this.lastPartyKey = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const rows = mates.slice(0, 4).map((m) => {
      const d = Math.hypot(m.x - own.x, m.y - own.y);
      const where = !m.online ? L('partyAshore') : m.docked ? L('partyInPort') : d < 150 ? L('partyNear') : `${d < 1000 ? `${Math.round(d / 10) * 10} ${L('m')}` : `${(d / 1000).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${L('km')}`}`;
      const deg = Math.round((Math.atan2(m.x - own.x, -(m.y - own.y)) * 180) / Math.PI / 15) * 15;
      return { m, where, deg: m.online && !m.docked && d >= 150 ? deg : null };
    });
    const key = `${lang()}|${g.leader}|${rows.map((r) => `${r.m.name}:${r.m.level}:${Math.round(r.m.hull * 20)}:${r.where}:${r.deg}:${r.m.inConvoy ? 1 : 0}`).join('|')}|${mates.length}`;
    if (key === this.lastPartyKey) return;
    this.lastPartyKey = key;
    el.classList.remove('hidden');
    el.innerHTML = rows.map(({ m, where, deg }) => `<button class="pf${m.online ? '' : ' off'}" data-pf="${esc(m.name)}"><span class="pf-top"><b>${m.accountId === g.leader ? '⚑ ' : ''}${esc(m.name)}</b><span class="pf-lv">${m.level}</span></span><span class="fbar pf-hull"><i style="width:${pct(m.hull)}"></i></span><span class="pf-where">${deg !== null ? `<i class="pf-arrow" style="transform:rotate(${deg}deg)">▲</i>` : ''}${esc(where)}${m.inConvoy ? ` · ${esc(L('partyConvoy'))}` : ''}</span></button>`).join('') + (mates.length > 4 ? `<span class="pf-more">+${mates.length - 4}</span>` : '');
    el.querySelectorAll<HTMLElement>('[data-pf]').forEach((b) => (b.onclick = () => this.onPartyTap(b.dataset.pf!)));
  }

  /** The players' chat (client/src/ui/chat.ts). */
  readonly chatPanel = new ChatPanel();

  chat(m: ChatLine): void {
    this.chatPanel.add(m);
  }

  /** The chat's channels (docs/11 P6): all, the group, the guild, whispers — a filter on the lines, and where
   *  words without a prefix go. */
  chatTabs(onPick: (ch: ChatChannel) => void): void {
    this.chatPanel.onPick = onPick;
    this.chatPanel.tabs();
  }
}

export type { ChatChannel };


function sanityWord(v: number): string {
  return L(v > 75 ? 'sanity.clear' : v > 50 ? 'sanity.uneasy' : v > 25 ? 'sanity.afraid' : v > 10 ? 'sanity.terror' : 'sanity.madness');
}

function weatherWord(w: string): string {
  const k = `weather.${w}`;
  return k in EN ? L(k as keyof typeof EN & string) : w.replace('_', ' ');
}

function seasonWord(s: string): string {
  const k = `season.${s}`;
  return k in EN ? L(k as keyof typeof EN & string) : s;
}

/** A frame bar: label left, value right, the fill under both. */
function fbar(cls: string, v: number, max: number, label: string, art = ''): string {
  return `<div class="fbar ${cls}"><i style="width:${pct(v / Math.max(1, max))}"></i><span><b>${art ? icon(art, '', 'ico-bar') : ''}<em>${esc(label)}</em></b><b>${fmt(v)} / ${fmt(max)}</b></span></div>`;
}

/** The weather's picture for the region line. */
function weatherArt(w: string): string {
  return w === 'fog' ? 'weather_fog' : w === 'storm' || w === 'black_storm' || w === 'rain' ? 'weather_storm' : w === 'wind' ? 'wind' : 'weather_clear';
}

/** An action-bar slot: the icon (or a glyph and the name while the art loads), key, count and overlays. */
function slot(o: { data: string; cls: string; art: string; glyph: string; name: string; key: string; title: string; qty?: string; extra?: string }): string {
  const img = icon(o.art);
  return `<div class="slot ${o.cls} ${img ? 'has-art' : ''}" ${o.data} title="${esc(o.title)}">${img || `<span class="glyph">${esc(o.glyph)}</span>`}<span class="nm">${esc(o.name)}</span><span class="k">${esc(o.key)}</span>${o.qty !== undefined ? `<span class="q">${esc(o.qty)}</span>` : ''}${o.extra ?? ''}</div>`;
}

/** A label without its keyboard hint ("[Q] Port" → "Port") on touch screens. */
/** The weak army's badge under her frame, below whatever round buttons stand there (the phone's quick row): the first
 *  free band of the left column, measured by what lies under a few points of it. */
function advicePlace(self: HTMLElement): { x: number; y: number } | null {
  const r = $('hud-captain').getBoundingClientRect();
  if (r.height <= 0) return null;
  const x = Math.round(r.left), H = innerHeight;
  const busy = (px: number, py: number) => document.elementsFromPoint(px, py).some((e) => !self.contains(e) && e !== self && e.closest('button, a, [role="button"], .hud-block, #hud-captain, #hud-goals, #hud-stack > :not(.hidden)') && !e.closest('#hud-advice'));
  for (let y = Math.round(r.bottom + 4); y < H * 0.6; y += 6) {
    if (![8, 70, 140].some((dx) => busy(x + dx, y + 2) || busy(x + dx, y + 28))) return { x, y };
  }
  return { x, y: Math.round(r.bottom + 4) };
}

/** Where the ship panel drops from: the unit frame's lowest drawn edge (kept until the frame has been drawn). */
function placeShipPanel(): void {
  const low = Math.max(0, ...[...$('hud-captain').querySelectorAll('*')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0).map((r) => r.bottom));
  if (low > 40) setVar(document.body, '--uf-bottom', `${Math.round(low)}px`);
}

/** The key an action is bound to (the player may have rebound it), as a small chip; none on a touch screen. */
function keyChip(a: Action): string {
  if (document.body.classList.contains('touch')) return '';
  const [k1, k2] = settings().keys[a];
  return `<kbd class="kchip">${esc(keyLabel(k1 || k2))}</kbd>`;
}

/** A key's hint in brackets: «[Y]», «[W/S]», «[Shift+B]», «[Esc]» — not a guild's tag («[СП]», «[TAG]»), which the
 *  touch screen once cut out of its toasts («…приглашает вас в Солёные Псы . Ответьте…»). */
export const KEY_HINT = /\s*\[(?:[A-Z0-9]|[A-Z]\/[A-Z]|(?:Shift|Ctrl|Alt)\+[A-Z0-9]|Esc|Enter|Space|Tab|Пробел|F\d{1,2})\]/g;

export function keyless(s: string, touch = document.body.classList.contains('touch')): string {
  // "[T]", "(T)", "(Y → Company)": a touch screen has no keys to name.
  // (and a note in brackets that names a key held down — «(при абордаже: B, затем Shift+B)», «(Shift — бережно, Ctrl —
  // жёстко)»: the play-through of 2026-10-09 read them in a talent's line on a phone)
  return touch ? s.replace(KEY_HINT, '').replace(/\s*\((?:[A-Z0-9]{1,3}|[^()]*→[^()]*|[^()]*\b(?:Shift|Ctrl|Alt)\b[^()]*)\)/g, '').replace(/ +([.,;:!?])/g, '$1').trim() : s;
}

/** A named pirate (docs/12 P5) or one of her lieutenants ("id#n"): the name in the player's tongue and the tag. */
export function namedLabel(named: string): { name: string; tag: string } | null {
  const [id, mate] = named.split('#');
  const np = pirateById(id);
  if (!np) return null;
  const ru = lang() === 'ru' ? 1 : 0;
  if (mate !== undefined) return { name: np.lieutenants[Number(mate)]?.name[ru] ?? np.name[ru], tag: L('tg.wantedMate') };
  const nem = nemesisLabel(id); // her own nemesis: his new name and the grudge's rank (docs/12 P10 #1)
  if (nem) return nem;
  const n = np.bounty.toLocaleString(ru ? 'ru-RU' : 'en-GB');
  return { name: np.name[ru], tag: np.baron ? L('tg.baron', { n }) : L('tg.wanted', { n }) };
}

const LC = dict(CEN, CRU);
const LS = dict(SEN, SRU);

/** The eight points of the compass from a bearing (0 north, clockwise). */
export function compass8(a: number): 'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west' {
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;
  return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** A good omen swimming alongside (docs/16 #9), from her effects: which, its speed, how long it stays. */
export function podEffect(effects: { id: string; until: number; mods?: Record<string, number | undefined> }[], now: number): { kind: 'dolphins' | 'humpback' | 'orcas'; speed: number; left: number } | null {
  const e = effects.find((x) => x.id.startsWith('omen_pod_'));
  if (!e) return null;
  const kind = e.id.slice(9) as 'dolphins' | 'humpback' | 'orcas';
  if (kind !== 'dolphins' && kind !== 'humpback' && kind !== 'orcas') return null;
  return { kind, speed: e.mods?.maxSpeed ?? 0, left: Math.max(0, Math.round(e.until - now)) };
}

export const POD_ICON = { dolphins: 'omen_dolphins', humpback: 'omen_whale_spout', orcas: 'monster.orca' } as const;

/** Its badge on the portrait, opposite the level: the beast's icon and the seconds it stays; the tooltip says why. */
export function podBadge(p: { kind: 'dolphins' | 'humpback' | 'orcas'; speed: number; left: number }): string {
  const title = LS('pod.title', { what: LS(`pod.${p.kind}`), speed: Math.round(p.speed * 100), n: p.left });
  return `<b class="uf-pod" title="${esc(title)}" aria-label="${esc(title)}">${icon(POD_ICON[p.kind], '🐬', 'ico-sm')}<i>+${Math.round(p.speed * 100)}%</i></b>`;
}

/** The win streak's badge on the captain's portrait (docs/16 #4): the flame and the bonus from the third ship, the
 *  count before it; its tooltip says what it is and what ends it. */
export function streakBadge(st: { n: number; mul: number }): string {
  const on = st.mul > 1;
  const mul = lang() === 'ru' ? String(st.mul).replace('.', ',') : String(st.mul);
  const title = on ? LC('streak.title', { n: st.n, mul }) : LC('streak.titleSoon', { n: st.n });
  return `<b class="uf-streak${on ? ' on' : ''}" title="${esc(title)}">${icon('fire', '', 'ico-sm')}${esc(on ? LC('streak.badge', { mul }) : String(st.n))}</b>`;
}

/** The silver's «+» (owner, 2026-10-30): the exchange of doubloons into silver. */
function exchPlus(): string {
  const P = dict(PM_EN, PM_RU);
  return `<button type="button" class="hud-exch" data-hudexch title="${esc(P('ex.openTip'))}" aria-label="${esc(P('ex.openTip'))}">${glyphSvg('plus')}</button>`;
}

/** The premium shop's button by her silver (owner, 2026-10-15): the doubloon, the balance and a «+». */
function shopChip(n: number, cls: string): string {
  const P = dict(PM_EN, PM_RU);
  return `<button type="button" class="${cls}" data-hudshop title="${esc(P('openTip'))}" aria-label="${esc(P('openTip'))}">${icon('doubloon', '◉', 'cs-coin')}<b>${fmt(n)}</b><i aria-hidden="true">${glyphSvg('plus')}</i></button>`;
}
