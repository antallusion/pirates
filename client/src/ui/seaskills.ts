// The captain window's «Умения» page (docs/25 items 37–43): each of her sea abilities and her passive with its rank
// (pips), what it does now in her numbers, what the next rank gives and at which level, the facets of ranks 3 and 5
// (two each: the first choice free, a change in a port for silver), the talent of her favoured trees that feeds it, the
// combo it opens, and the Throne's mastery past the cap. RU and EN; one column on a phone.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { MAX_RANK, SEA_SKILLS, ULT_MAX_RANK, captainSkills, facetCost, facetKey, facetRanks, rankGain, skillMastery, skillNums, skillRank, skillText } from '../../../shared/src/data/seaskill.ts';
import type { SeaSkill, SkillCtx } from '../../../shared/src/data/seaskill.ts';
import { RANK_AT, ULT_RANK_AT } from '../../../shared/src/data/seaskill.ts';
import { TALENTS_BY_ID } from '../../../shared/src/data/talents.ts';
import { shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/seaskill.ts';
import type { ClientState } from '../state.ts';
import { ask } from './confirm.ts';
import { esc, fmt, icon } from './dom.ts';

const L = dict(EN, RU);
const ru = () => lang() === 'ru';

/** Her abilities' context from her sheet. */
function ctxOf(state: ClientState): SkillCtx | null {
  const self = state.self;
  if (!self) return null;
  return { level: self.level, facets: self.facets ?? {}, glory: self.glory?.rank ?? 0, talents: self.talents ?? {} };
}

/** Facets still to choose: a badge on the tab. */
export function facetsWaiting(state: ClientState): number {
  const ctx = ctxOf(state);
  if (!ctx || !state.self) return 0;
  let n = 0;
  for (const s of captainSkills(state.self.captain)) for (const r of facetRanks(s.key)) if (skillRank(ctx.level, s.key) >= r && !ctx.facets[facetKey(s.id, r)] && s.facets?.[r as 3 | 5]) n++;
  return n;
}

function nameOf(s: SeaSkill): string {
  const c = CAPTAINS[s.captain];
  return s.key === 'P' ? c.passive.name : c.abilities.find((a) => a.id === s.id)?.name ?? s.id;
}

function pips(r: number, n: number): string {
  return `<span class="hx-pips">${Array.from({ length: n }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</span>`;
}

function card(s: SeaSkill, ctx: SkillCtx, anchor: number, docked: boolean, gold: number): string {
  const k = ru() ? 1 : 0;
  const max = s.key === 'V' ? ULT_MAX_RANK : MAX_RANK;
  const rank = skillRank(ctx.level, s.key);
  const nums = skillNums(s.id, ctx, Math.max(1, rank));
  const now = skillText(s.id, nums, ru(), anchor);
  const gain = rankGain(s.id, ctx, ru(), anchor);
  const art = s.key === 'P' ? `school_${s.captain}` : `ab_${s.id}`;
  const head = `<div class="sk-head">${icon(art, '✦', 'sk-ico')}<span class="sk-key">${s.key === 'P' ? esc(L('passive')) : s.key}</span><b>${esc(nameOf(s))}</b><span class="sk-rank">${rank ? esc(L('rank', { r: rank, n: max })) : esc(L('locked', { n: (s.key === 'V' ? ULT_RANK_AT : RANK_AT)[0] }))}${pips(rank, max)}</span></div>`;
  const next = gain ? `<small class="sk-next">${icon('xp', '', 'ico-xs')}${esc(L('next', { r: gain.rank, n: gain.level, what: gain.lines.join(' · ') }))}</small>` : `<small class="sk-next sk-top">${esc(L('top'))}</small>`;
  const facets = facetRanks(s.key).filter((r) => s.facets?.[r as 3 | 5]).map((r) => {
    const open = rank >= r;
    const pick = ctx.facets[facetKey(s.id, r)];
    const lvl = (s.key === 'V' ? ULT_RANK_AT : RANK_AT)[r - 1];
    const btns = s.facets![r as 3 | 5]!.map((f, i) => {
      const id = i ? 'b' : 'a';
      const on = pick === id;
      const can = open && !on && (!pick || (docked && gold >= facetCost(ctx.level)));
      return `<button type="button" class="sk-f${on ? ' on' : ''}" data-facet="${esc(s.id)}" data-frank="${r}" data-pick="${id}" ${can ? '' : 'disabled'} aria-pressed="${on}"><b>${esc(f.name[k])}</b><small>${esc(f.text[k])}</small></button>`;
    }).join('');
    const why = !open ? L('facetAt', { n: lvl }) : !pick ? `${L('facetPick')} · ${L('facetFree')}` : docked ? L('facetPort', { cost: fmt(facetCost(ctx.level)) }) : L('facetSea');
    return `<div class="sk-frow${open ? '' : ' locked'}${open && !pick ? ' wait' : ''}"><span class="sk-fr">${esc(L('facet', { r }))} · <i>${esc(why)}</i></span><div class="sk-fbtns">${btns}</div></div>`;
  }).join('');
  const t = s.node ? TALENTS_BY_ID[s.node.talent] : undefined;
  const tal = s.node && t ? `<small class="sk-tal">${icon(`tree_${t.tree === 'bridge' ? 'command' : t.tree}`, '', 'ico-xs')}${esc(L('talent', { name: t.name, what: L(s.node.kind === 'power' ? 'talent.power' : 'talent.dur', { n: Math.round(s.node.per * 100) }), r: ctx.talents[s.node.talent] ?? 0, n: t.maxRank }))}</small>` : '';
  const combo = s.combo ? `<small class="sk-combo">${esc(L('combo', { name: s.combo.name[k], text: s.combo.text[k] }))}</small>` : '';
  return `<div class="sk-card${s.key === 'V' ? ' ult' : ''}${s.key === 'P' ? ' pas' : ''}${rank ? '' : ' off'}">${head}<small class="sk-now">${esc(now)}</small>${next}${facets ? `<div class="sk-facets">${facets}</div>` : ''}${tal}${combo}</div>`;
}

/** The page. */
export function seaSkillsTab(state: ClientState): string {
  const self = state.self;
  const ctx = ctxOf(state);
  if (!self || !ctx) return '';
  const anchor = shipLevelOf(self.loadout);
  const m = skillMastery(ctx.glory);
  const mastery = ctx.glory > 0 ? L('mastery', { n: (Math.round(m * 1000) / 10).toString().replace('.', ru() ? ',' : '.'), g: ctx.glory }) : L('masteryLater');
  const cards = captainSkills(self.captain).map((s) => card(s, ctx, anchor, !!self.dockedAt, self.gold)).join('');
  return `<div class="sk-page"><div class="gi-h">${icon(`school_${self.captain}`, '', 'ico-sm')}${esc(L('head'))}</div><p class="muted sk-note">${esc(L('ranks'))} ${esc(mastery)}</p><div class="sk-grid">${cards}</div></div>`;
}

/** The page's buttons: a facet chosen (free) or changed (in a port, for silver, after a word). */
export function wireSeaSkills(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  root.querySelectorAll<HTMLButtonElement>('[data-facet]').forEach((b) => (b.onclick = () => {
    const id = b.dataset.facet!, rank = Number(b.dataset.frank), pick = b.dataset.pick === 'b' ? 'b' : 'a';
    const was = state.self?.facets?.[facetKey(id, rank)];
    const go = () => send({ t: 'facet', id, rank, pick });
    if (!was) return go();
    void ask(L('confirm', { cost: fmt(facetCost(state.self?.level ?? 1)) })).then((ok) => ok && go());
  }));
}

export { SEA_SKILLS };
