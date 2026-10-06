// The kit's risk window (docs/23 items 13, 49–52): before a fight she will most likely lose — boarding a senior ship —
// a sheet from the bottom says so plainly: «Скорее всего, вы проиграете», the chance to win, what she loses if she
// does, what she gains if she wins, and two buttons, «Рискнуть» and «Отступить» (the safe one has the focus; Esc, a
// tap beside it or a swipe down fall back). The boarding code (docs/23 phase 4) calls riskConfirm() when riskWarns().
//
//   if (riskWarns(chance, theirLevel - myLevel)) {
//     if (!(await riskConfirm({ target: 'Чёрная Чайка', chance, levelGap: 2, lose: { silver: 400, cargo: true, men: 30, port: true }, gainXpMul: 1.6 }))) return;
//   }

import { dict, plural } from '../../i18n.ts';
import { EN, RU } from '../../lang/ui/kit.ts';
import { dec1, esc, fmt } from '../dom.ts';
import { buttonHtml } from './button.ts';
import { openSheet } from './sheet.ts';
import { chanceBand, pct100 } from './targetline.ts';

const L = dict(EN, RU);

/** When the window opens (docs/23 item 51): a chance to win under 35%, or a target two levels up or more. */
export const RISK = { chance: 0.35, gap: 2 } as const;

export function riskWarns(chance: number, levelGap = 0): boolean {
  return chance < RISK.chance || levelGap >= RISK.gap;
}

export interface RiskLoss {
  silver?: number;
  /** The hold's cargo: all of it (true) or a number of units. */
  cargo?: boolean | number;
  men?: number;
  /** She wakes in the nearest port (docs/22's lost boarding). */
  port?: boolean;
}

export interface RiskInput {
  target: string;
  /** 0–1: the server's quick sims of the fight (quickFinish), the same engine as the fight itself. */
  chance: number;
  /** Her level less yours. */
  levelGap?: number;
  lose?: RiskLoss;
  /** The ladder's reward for beating a senior (experience ×N), shown when above 1. */
  gainXpMul?: number;
  /** Anything else won, already in the reader's language. */
  gainText?: string;
}

export interface RiskView {
  head: string;
  likely: boolean;
  band: 'good' | 'even' | 'bad';
  chance: string;
  pct: number;
  above: string | null;
  lose: string[];
  gain: string | null;
  go: string;
  back: string;
}

/** The window's words (pure: the tests read them in both languages). */
export function riskView(i: RiskInput): RiskView {
  const likely = i.chance < RISK.chance;
  const gap = Math.round(i.levelGap ?? 0);
  const lose: string[] = [];
  const l = i.lose ?? {};
  if (l.silver) lose.push(L('risk.loseSilver', { n: fmt(l.silver) }));
  if (l.cargo === true) lose.push(L('risk.loseCargo'));
  else if (typeof l.cargo === 'number' && l.cargo > 0) lose.push(L('risk.loseCargoN', { n: fmt(l.cargo) }));
  if (l.men) lose.push(L('risk.loseMen', { n: fmt(l.men) }));
  if (l.port) lose.push(L('risk.losePort'));
  const gains: string[] = [];
  if (i.gainXpMul && i.gainXpMul > 1) gains.push(L('risk.gainXp', { n: dec1(i.gainXpMul) }));
  if (i.gainText) gains.push(i.gainText);
  return {
    head: likely ? L('risk.likelyLose') : L('risk.hard'),
    likely,
    band: chanceBand(i.chance),
    chance: L('risk.chance', { n: pct100(i.chance) }),
    pct: pct100(i.chance),
    above: gap >= 2 ? plural(gap, L('risk.aboveFew', { n: gap }), L('risk.aboveFew', { n: gap }), L('risk.aboveMany', { n: gap })) : gap === 1 ? L('risk.above1') : null,
    lose,
    gain: gains.length ? L('risk.gain', { text: gains.join(', ') }) : null,
    go: L('risk.go'),
    back: L('risk.back'),
  };
}

export function riskHtml(i: RiskInput): string {
  const v = riskView(i);
  return `<div class="k-risk k-risk--${v.band}">
    <p class="k-risk-target"><b>${esc(i.target)}</b>${v.above ? ` · <span>${esc(v.above)}</span>` : ''}</p>
    <div class="k-risk-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v.pct}" aria-label="${esc(v.chance)}"><i style="width:${v.pct}%"></i><span>${esc(v.chance)}</span></div>
    ${v.lose.length ? `<p class="k-risk-lose"><span class="k-risk-k">${esc(L('risk.lose'))}</span> ${esc(v.lose.join(', '))}</p>` : ''}
    ${v.gain ? `<p class="k-risk-gain">${esc(v.gain)}</p>` : ''}
  </div>`;
}

/** Ask. Resolves true for «Рискнуть», false for «Отступить» (or Esc, a tap beside it, a swipe down). */
export function riskConfirm(i: RiskInput): Promise<boolean> {
  const v = riskView(i);
  return new Promise((done) => {
    let answer = false;
    const foot = buttonHtml({ kind: 'secondary', label: v.back, data: { risk: 'back', autofocus: '' } }) + buttonHtml({ kind: 'primary', label: v.go, cls: 'k-btn--risk', data: { risk: 'go' } });
    const s = openSheet({ title: v.head, body: riskHtml(i), foot, height: 'auto', id: 'k-risk', cls: 'k-risk-sheet', role: 'alertdialog', noClose: true, onClose: () => done(answer) });
    s.panel.querySelector('[data-risk="go"]')!.addEventListener('click', () => { answer = true; s.close('button'); });
    s.panel.querySelector('[data-risk="back"]')!.addEventListener('click', () => s.close('button'));
  });
}
