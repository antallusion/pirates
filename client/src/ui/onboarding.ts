// The First Watch on the client (docs/07 §13; the phone's five steps, docs/23 item 79): the step's title and a line, the
// HUD revealed block by block, contextual hints, the Captain's Goals line under the minimap, the prologue, the
// edge-of-safe-waters screen, and the optional things kept shut in the first quarter of an hour (docs/23 item 83).
// The server says which step and which hint; the words are here, in both languages.

import type { HudBlock, OnboardingView } from '../../../shared/src/protocol.ts';
import { has, lang, onLang, t } from '../i18n.ts';
import type { Key } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { $, esc, icon } from './dom.ts';
import { glossaryHtml } from './terms.ts';

/** Which DOM block shows which part of the HUD. */
const BLOCKS: Record<string, HudBlock[]> = {
  'hud-ship': ['ship'],
  'hud-nav': ['nav'],
  'hud-captain': ['captain', 'wanted'],
  'hud-map': ['minimap', 'map'],
  'hud-combat': ['guns', 'abilities'],
  // the phone's sea HUD (docs/23 phase 2): «Огонь» comes with the guns, «Особое» with the abilities
  'tc-fire': ['guns'],
  'tc-special': ['abilities'],
};

export class OnboardingUi {
  private shown = new Set<string>(Object.keys(BLOCKS));
  private view: OnboardingView | null = null;
  private state: ClientState;
  send: (action: 'skip_stage' | 'skip_all' | 'hide_goals') => void = () => {};
  /** A screen to open (the edge of safe waters). */
  onEdge: () => void = () => {};

  constructor(state: ClientState) {
    this.state = state;
    onLang(() => this.apply(this.view));
  }

  apply(view: OnboardingView | null): void {
    this.view = view;
    this.applyHud(view?.hud ?? null);
    this.applyLocks(view);
    this.renderWatch(view);
    this.renderGoals(view);
  }

  private applyHud(hud: HudBlock[] | null): void {
    for (const [id, parts] of Object.entries(BLOCKS)) {
      const on = !hud || parts.some((p) => hud.includes(p));
      const el = document.getElementById(id);
      if (!el) continue;
      el.classList.toggle('tut-hidden', !on);
      // A block that comes in draws itself.
      if (on && !this.shown.has(id)) {
        el.classList.remove('tut-reveal');
        void el.offsetWidth;
        el.classList.add('tut-reveal');
      }
      if (on) this.shown.add(id);
      else this.shown.delete(id);
    }
  }

  private renderWatch(v: OnboardingView | null): void {
    const el = $('hud-watch');
    if (!v?.stage) {
      el.classList.add('hidden');
      return;
    }
    // docs/23 item 79: the step's title and one short line; the finger over the button says the rest (pointer.ts).
    const k = `stage.${v.stage}` as Key;
    const touch = document.body.classList.contains('touch');
    const docked = !!this.state.self?.dockedAt;
    const line = (v.stage === 'sail' && docked ? 'stage.sail.dock' : `stage.${v.stage}.${touch ? 'touch' : 'body'}`) as Key;
    const key = `${v.stage}|${line}|${v.index}|${v.of}|${lang()}`; // a language changed mid-watch redraws the row
    if (el.dataset.k === key && !el.classList.contains('hidden')) return;
    el.dataset.k = key;
    el.classList.remove('hidden');
    // On a short screen the row keeps to the count, the title, the line and two short skips (feel.css).
    const btn = (a: string, cls: string, full: Key, short: Key) => `<button class="btn btn-small${cls}" data-a="${a}" title="${esc(t(full))}" aria-label="${esc(t(full))}"><span class="w-long">${esc(t(full))}</span><span class="w-short">${esc(t(short))}</span></button>`;
    el.innerHTML = `<div class="w-head"><span><i class="w-t">${esc(t('watch.title'))} · </i>${v.index + 1}/${v.of}</span><b>${esc(has(k) ? t(k) : v.stage)}</b></div>
      ${has(line) ? `<div class="w-body">${esc(t(line))}</div>` : ''}
      <div class="w-act">${btn('skip_stage', '', 'watch.skip', 'watch.skipShort')}${btn('skip_all', ' btn-ghost', 'watch.skipAll', 'watch.skipAllShort')}</div>`;
    el.setAttribute('aria-label', `${t('watch.step', { n: v.index + 1, of: v.of })}: ${has(k) ? t(k) : v.stage}`);
    el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => this.send(b.dataset.a as 'skip_stage')));
  }

  /** The step under way (the finger's), or null. */
  get stage(): string | null {
    return this.view?.stage ?? null;
  }

  /** docs/23 item 83: the optional things still shut (body classes `lock-<thing>` hide their buttons). */
  private applyLocks(v: OnboardingView | null): void {
    const locked = new Set(v?.locked ?? []);
    for (const x of ['tattoos', 'dice', 'auction', 'guilds']) document.body.classList.toggle(`lock-${x}`, locked.has(x));
  }

  private renderGoals(v: OnboardingView | null): void {
    const el = $('hud-goals');
    const goals = v?.goals ?? null;
    if (!goals || !goals.length) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const first = `goal.${goals[0]}` as Key;
    el.innerHTML = `${icon('goal', '', 'ico-goal')}<span class="g-lbl">${esc(t('goals.title'))}</span><button class="g-x" title="${esc(t('goals.hide'))}" aria-label="${esc(t('goals.hide'))}">×</button><span class="g-t">${esc(touchless(has(first) ? t(first) : goals[0]))}${goals.length > 1 ? ` <span class="muted">+${goals.length - 1}</span>` : ''}</span>`;
    el.querySelector<HTMLButtonElement>('.g-x')!.onclick = () => this.send('hide_goals');
  }

  /** A moment from the server: a step done, a hint, a goal met, the edge of safe waters. */
  moment(kind: 'stage' | 'skip' | 'hint' | 'goal' | 'edge' | 'unlock', id: string, toast: (msg: string, kind: string) => void): void {
    if (kind === 'stage') {
      const k = `stage.${id}` as Key;
      // The last step: one line for the end of the watch, not two (docs/23 item 79).
      toast(id === 'port' ? t('watch.over') : t('watch.done', { name: has(k) ? t(k) : id }), id === 'port' ? 'xp' : 'good');
    } else if (kind === 'unlock') toast(t('unlock.title'), 'xp');
    else if (kind === 'hint') this.hint(id, toast);
    else if (kind === 'goal') {
      const k = `goal.${id}` as Key;
      toast(t('goals.met', { name: has(k) ? t(k) : id }), 'xp');
    } else if (kind === 'edge') this.onEdge();
  }

  /** A hint joins the toasts' band (the popup budget, owner 2026-10-04: it stood over the sea above the action bar). */
  hint(id: string, toast: (msg: string, kind: string) => void): void {
    const k = hintKey(id);
    if (has(k)) toast(`${t('hint.title')}: ${t(k)}`, 'advice');
  }
}

/** The prologue: three lines over the harbour at night, then the watch begins. Any click ends it. */
export function playPrologue(done: () => void): void {
  const el = $('prologue');
  el.innerHTML = `<p>${esc(t('prologue.1'))}</p><p>${esc(t('prologue.2'))}</p><p>${esc(t('prologue.3'))}</p><small>${esc(t(document.body.classList.contains('touch') ? 'prologue.skipTouch' : 'prologue.skip'))}</small>`;
  el.classList.remove('hidden');
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    el.classList.add('fade');
    setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('fade');
      done();
    }, 600);
  };
  el.onclick = end;
  addEventListener('keydown', end, { once: true });
  setTimeout(end, 11000);
}

export function renderEdge(root: HTMLElement, close: () => void): void {
  root.innerHTML = `<div class="modal-body"><div class="center-card">
    <h2 class="title-sm" style="font-size:34px">${esc(t('edge.title'))}</h2>
    <div class="edge-list">
      <div class="help-row">${icon('danger', '', 'item-ico')}<span>${esc(t('edge.pvp'))}</span></div>
      <div class="help-row">${icon('wanted', '', 'item-ico')}<span>${esc(t('edge.wanted'))}</span></div>
      <div class="help-row">${icon('insurance', '', 'item-ico')}<span>${esc(t('edge.insure'))}</span></div>
    </div>
    <p class="muted">${esc(t('edge.once'))}</p>
    <button class="btn btn-primary">${esc(t('edge.ok'))}</button></div></div>`;
  root.querySelector('button')!.onclick = close;
}

/** A hint's text: on a touch screen its own words when the keyboard's would name keys it does not have. */
function hintKey(id: string): Key {
  const touch = `hint.${id}.touch`;
  return (document.body.classList.contains('touch') && has(touch) ? touch : `hint.${id}`) as Key;
}

/** The logbook section of the Handbook: every hint given, the goals under way. */
export function logbookHtml(v: OnboardingView | null): string {
  const hints = (v?.hints ?? []).filter((h) => has(`hint.${h}`));
  const goals = v?.goals ?? [];
  return `<div class="card"><h4>${esc(t('log.title'))}</h4>
    <p><b>${esc(t('log.goals'))}</b>${v?.goalsDone ? ` <span class="muted">(${esc(t('log.goalsDone', { n: v.goalsDone }))})</span>` : ''}</p>
    ${goals.length ? `<ul>${goals.map((g) => `<li>${esc(has(`goal.${g}`) ? t(`goal.${g}` as Key) : g)}</li>`).join('')}</ul>` : `<p class="muted">${esc(t('log.none'))}</p>`}
    <p><b>${esc(t('log.hints'))}</b></p>
    ${hints.length ? `<ul>${hints.map((h) => `<li>${esc(t(hintKey(h)))}</li>`).join('')}</ul>` : `<p class="muted">${esc(t('log.none'))}</p>`}
    <p><b>${esc(t('log.glossary'))}</b></p>${glossaryHtml()}</div>`;
}

/** Touch screens have no keys: "(Y → Company)" hints come off the goal lines. */
function touchless(text: string): string {
  return document.body.classList.contains('touch') ? text.replace(/\s*\((?:[A-Z0-9]{1,3}|[^()]*→[^()]*)\)/g, '').trim() : text;
}
