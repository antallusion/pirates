// VK moderation 4.1.6.4 (2026-11-18; owner: «старт непонятный — новичок не знает, куда плыть, что атаковать, что делать
// дальше»): after the First Watch, through the campaign's first chapter, one line in the top band says the step under way
// — the quest, what to do now in its own words, and what it pays — so the goal is always on the screen of a phone held
// sideways, not only behind the folded goals. One line, ellipsis, never over the middle of the screen (the popup budget,
// CLAUDE.md §3); gone in a battle, a window, the watch's own card, and past the first chapter.

import { lang, t } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { cmpText } from '../lang/server.ts';
import { $, esc } from './dom.ts';

/** The strip keeps on to this level (the first chapter, as the server's battles are tutored: firstfights.ts TUTOR_LEVEL). */
export const STEP_LEVEL = 4;

/** What the strip says now, or null (hidden). */
export function stepLine(state: Pick<ClientState, 'self' | 'onboarding' | 'boardTac'>, busy: boolean): { head: string; name: string; text: string; pay: string } | null {
  const self = state.self;
  const cv = self?.campaign;
  if (!self || busy || state.onboarding?.stage || state.boardTac || !document.body.classList.contains('on-ladder')) return null;
  if (!cv || cv.ch !== 1 || self.level > STEP_LEVEL) return null;
  const q = self.quests.find((x) => x.kind === 'campaign');
  if (!q?.text) return null;
  const need = q.need > 1 ? ` (${q.progress}/${q.need})` : '';
  return { head: t('step.head', { ch: cv.ch, k: cv.k + 1, size: cv.size }), name: cmpText(q.name), text: cmpText(q.text) + need, pay: q.silver ? t('step.pay', { n: q.silver }) : '' };
}

let last = '';
/** Drawn with the HUD's other blocks (main.ts, every frame: a no-op unless the line changed). */
export function drawStep(state: ClientState, busy: boolean): void {
  const el = $('hud-step');
  const v = stepLine(state, busy);
  const key = v ? `${lang()}|${v.head}|${v.name}|${v.text}|${v.pay}` : '';
  if (key === last) return;
  last = key;
  el.classList.toggle('hidden', !v);
  if (!v) return void (el.innerHTML = '');
  el.innerHTML = `<span class="st-h">${esc(v.head)}</span><b class="st-n">${esc(v.name)}</b><span class="st-t">${esc(v.text)}</span>${v.pay ? `<span class="st-p">${esc(v.pay)}</span>` : ''}`;
  el.title = `${v.name}: ${v.text}${v.pay ? ` · ${v.pay}` : ''}`;
}
