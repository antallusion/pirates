// The kit's target line (docs/23 items 12, 28): a target on one line — her mark, her name, ⚓ her level, her hull as a
// thin bar and one chip with the chance to win. A tap opens the card with the rest (the caller's sheet). It is a
// single button 44 px high, so it can stand over the «Fire» button on a phone.

import { dict } from '../../i18n.ts';
import { EN, RU } from '../../lang/ui/kit.ts';
import { esc, icon } from '../dom.ts';

const L = dict(EN, RU);

export interface TargetInfo {
  name: string;
  level?: number;
  /** Her hull left, 0–1. */
  hull?: number;
  /** Her crew left, 0–1 (the sea fight's second bar, docs/23 item 31). */
  crew?: number;
  /** The chance to win against her, 0–1 (the risk window's number). */
  chance?: number;
  /** Art id of her mark (a flag, a beast's face). */
  icon?: string;
  /** Her kind of danger for the line's edge colour: from the ladder's threat (shared/src/data/shiplevel.ts). */
  threat?: 'trivial' | 'easy' | 'even' | 'hard' | 'deadly' | 'skull';
  /** The close fight (owner, 2026-10-07): inside the band her gun captains fire in («в дальности»), or too far. */
  range?: 'in' | 'far';
  /** A captain's colours (docs/24 D1): a little cloth before her name (flags.css), and its words for the screen reader. */
  colours?: { kind: 'neutral' | 'faction' | 'pirate'; color: string; stripe: string; label: string; noBoard?: boolean };
}

/** The chance's band: good from 60%, even from 35%, bad below (the risk window opens below 35%: docs/23 item 51). */
export function chanceBand(c: number): 'good' | 'even' | 'bad' {
  return c >= 0.6 ? 'good' : c >= 0.35 ? 'even' : 'bad';
}

export const pct100 = (f: number): number => Math.round(Math.max(0, Math.min(1, f)) * 100);

/** The words a screen reader says for the line (and its tooltip). */
export function targetSpeech(t: TargetInfo): string {
  const parts = [t.name];
  if (t.colours?.label) parts.push(t.colours.label);
  if (t.level !== undefined) parts.push(L('target.level', { n: t.level }));
  if (t.hull !== undefined) parts.push(L('target.hull', { n: pct100(t.hull) }));
  if (t.crew !== undefined) parts.push(L('target.crew', { n: pct100(t.crew) }));
  if (t.chance !== undefined) parts.push(L('target.chance', { n: pct100(t.chance) }));
  if (t.range) parts.push(L(t.range === 'in' ? 'target.in' : 'target.far'));
  return parts.join(', ');
}

export function targetLineHtml(t: TargetInfo, attrs = ''): string {
  const band = t.chance === undefined ? '' : chanceBand(t.chance);
  return `<button type="button" class="k-target${t.threat ? ` k-threat-${t.threat}` : ''}" aria-label="${esc(targetSpeech(t))}" title="${esc(L('target.open'))}" ${attrs}>
    ${t.icon ? icon(t.icon, '', 'k-target-ico') : ''}${t.colours ? `<span class="k-target-flag" data-flag="${t.colours.kind}"${t.colours.noBoard ? ' data-nb' : ''} style="--fl-c:${esc(t.colours.color)};--fl-s:${esc(t.colours.stripe)}" aria-hidden="true"></span>` : ''}<span class="k-target-name">${esc(t.name)}</span>${t.level !== undefined ? `<span class="k-target-lv">⚓\uFE0E${t.level}</span>` : ''}${t.hull !== undefined || t.crew !== undefined ? `<span class="k-target-bars" aria-hidden="true">${t.hull !== undefined ? `<span class="k-target-hull"><i style="width:${pct100(t.hull)}%"></i></span>` : ''}${t.crew !== undefined ? `<span class="k-target-crew"><i style="width:${pct100(t.crew)}%"></i></span>` : ''}</span>` : ''}${band ? `<span class="k-chip k-chip--${band}" aria-hidden="true">${pct100(t.chance!)}%</span>` : ''}${t.range ? `<span class="k-target-range" data-range="${t.range}" aria-hidden="true">${esc(L(t.range === 'in' ? 'target.in' : 'target.far'))}</span>` : ''}</button>`;
}

/** A line that keeps its element and is redrawn only when what it shows has changed. */
export class TargetLine {
  readonly el: HTMLElement;
  private key = '';
  onOpen: () => void = () => {};
  constructor(host: HTMLElement) {
    this.el = host;
    host.addEventListener('click', (e) => (e.target as HTMLElement).closest('.k-target') && this.onOpen());
  }
  set(t: TargetInfo | null): void {
    const key = t ? JSON.stringify([t.name, t.level, t.hull === undefined ? null : pct100(t.hull), t.crew === undefined ? null : pct100(t.crew), t.chance === undefined ? null : pct100(t.chance), t.icon, t.threat, t.range, t.colours?.label ?? null]) : '';
    if (key === this.key) return;
    this.key = key;
    this.el.innerHTML = t ? targetLineHtml(t) : '';
    this.el.classList.toggle('hidden', !t);
  }
}
