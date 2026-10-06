// The First Watch on the client (docs/07 §13): the step panel, the HUD revealed block by block, contextual
// hints, the Captain's Goals line under the minimap, the prologue, and the edge-of-safe-waters screen.
// The server says which step and which hint; the words are here, in both languages.

import type { HudBlock, OnboardingView } from '../../../shared/src/protocol.ts';
import { has, onLang, t } from '../i18n.ts';
import type { Key } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { $, esc, icon } from './dom.ts';
import { glossaryHtml } from './terms.ts';
import { placeName } from './maps.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';

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
    const k = `stage.${v.stage}` as Key;
    const touchBody = `stage.${v.stage}.touch` as Key;
    const body = (document.body.classList.contains('touch') && has(touchBody) ? touchBody : `stage.${v.stage}.body`) as Key;
    const tip = v.tip ? t('stage.first_trade.tip', { good: GOODS[v.tip.good as GoodId]?.name ?? placeName(v.tip.good), port: this.portName(v.tip.port), hours: v.tip.hours }) : '';
    el.classList.remove('hidden');
    el.innerHTML = `<div class="w-head"><span>${esc(t('watch.title'))} · ${v.index + 1}/${v.of}</span><b>${esc(has(k) ? t(k) : v.stage)}</b></div>
      <div class="w-body">${esc(has(body) ? t(body) : '')}${tip ? `<div class="w-tip">${esc(tip)}</div>` : ''}</div>
      <div class="w-act"><button class="btn btn-small" data-a="skip_stage">${esc(t('watch.skip'))}</button><button class="btn btn-small btn-ghost" data-a="skip_all">${esc(t('watch.skipAll'))}</button></div>`;
    el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => this.send(b.dataset.a as 'skip_stage')));
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
  moment(kind: 'stage' | 'skip' | 'hint' | 'goal' | 'edge', id: string, toast: (msg: string, kind: string) => void): void {
    if (kind === 'stage') {
      const k = `stage.${id}` as Key;
      toast(t('watch.done', { name: has(k) ? t(k) : id }), 'good');
      if (id === 'rescue') toast(t('watch.over'), 'xp'); // the last step of the First Watch (docs/18 #49)
    } else if (kind === 'hint') this.hint(id, toast);
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

  private portName(id: string): string {
    return placeName(this.state.ports.find((p) => p.id === id)?.name ?? id);
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
