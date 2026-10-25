// The journal's «Кампания» page (docs/36): the main campaign's 36 chapters as a book — those behind her folded (✓), the
// one she is in open with its quests (done ✓, now ◆, ahead ·), those ahead folded with their levels. The chapters'
// words are the written source itself (shared/src/data/campaign/chNN.ts, both tongues), a module of their own loaded the
// first time the page opens; her place comes from the server (PrivateState.campaign).

import { importAgain } from '../importagain.ts';
import { CAMPAIGN_SIZE, PLAN } from '../../../shared/src/data/campaign/plan.ts';
import { FIRST_SLOT, gateOf } from '../../../shared/src/data/campaign/progress.ts';
import type { ChapterSrc } from '../../../shared/src/data/campaign/types.ts';
import type { CampaignView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { esc, icon } from './dom.ts';
import { artImg } from './artfall.ts';
import { chapterCard } from '../../../shared/src/data/paintart.ts';
import { EN, RU } from '../lang/ui/campaignbook.ts';

const L = dict(EN, RU);

let chapters: ChapterSrc[] | null = null;
let loading: Promise<void> | null = null;

/** The written chapters, loaded once (null till they come; `then` redraws). */
export function bookChapters(then: () => void): ChapterSrc[] | null {
  if (chapters) return chapters;
  loading ??= importAgain(() => import('../../../shared/src/data/campaign/chapters.ts')).then((m) => {
    chapters = m.CHAPTERS;
    then();
  }, () => {
    loading = null; // (asked again the next time the book is drawn)
  });
  return null;
}

/** The page. */
/** The words of the page (the journal's chip). */
export const bookWord = (k: 'tab' | 'tabHint' | 'where' | 'nextAt', vars?: Record<string, number>): string => L(k, vars);

export function campaignBookHtml(c: CampaignView | undefined, list: ChapterSrc[] | null): string {
  if (!list) return `<p class="muted">${esc(L('loading'))}</p>`;
  const ru = lang() === 'ru' ? 1 : 0;
  const at = c?.at ?? 0;
  const head = `<div class="cb-head"><b>${esc(L('head', { n: at, of: CAMPAIGN_SIZE }))}</b><span class="cm-bar"><i style="width:${Math.min(100, (at / CAMPAIGN_SIZE) * 100).toFixed(1)}%"></i></span>
    ${c?.from ? `<small class="muted">${esc(L('from', { n: PLAN.find((p, i) => FIRST_SLOT[i] === c.from)?.n ?? 1 }))}</small>` : ''}${c?.done ? `<small>${esc(L('done'))}</small>` : ''}</div>`;
  const byN = new Map(list.map((x) => [x.n, x]));
  const rows = PLAN.map((p, i) => {
    const ch = byN.get(p.n);
    if (!ch) return '';
    const first = FIRST_SLOT[i], last = first + p.size - 1;
    const state = at > last ? 'done' : at >= first ? 'now' : 'ahead';
    const doneN = Math.max(0, Math.min(p.size, at - first));
    const sum = `<summary>${icon(state === 'done' ? 'tab_legends' : 'tab_letters', '', 'ico-sm')}<b>${esc(L('chapter', { n: p.n }))}. ${esc(ch.title[ru])}</b>
      <span class="cb-meta">${state === 'done' ? '✓ ' : ''}${esc(L('quests', { n: doneN, of: p.size }))} · ${esc(L('levels', { a: gateOf(first), b: gateOf(last) }))}</span></summary>`;
    // (its opener's painting for a chapter reached: loaded when its fold opens — a lazy picture in a shut <details> waits)
    const blurb = `${state === 'ahead' ? '' : artImg([chapterCard(p.n)], 'cb-art', ' loading="lazy"')}<p class="cb-blurb">${esc(ch.blurb[ru])}</p>`;
    // the quests of a chapter behind her or the one she is in (those ahead keep their names to themselves)
    const quests = state === 'ahead' ? '' : `<ol class="cb-quests">${ch.quests.map((q, k) => {
      const slot = first + k;
      const mark = slot < at ? 'done' : slot === at ? 'now' : 'ahead';
      const pick = q.alt ? c?.picks[q.alt.key] : undefined;
      const title = pick === 'b' ? q.alt!.t[ru] : q.t[ru];
      const way = q.alt && pick ? ` <small class="muted">(${esc(L('way', { w: q.alt.label[pick === 'b' ? 1 : 0][ru] }))})</small>` : '';
      return `<li class="${mark}"><span class="jr-mark${mark === 'now' ? ' now' : ''}">${mark === 'done' ? '✓' : mark === 'now' ? '◆' : '·'}</span><span>${esc(title)}${way}${mark === 'ahead' ? ` <small class="muted">${esc(L('level', { n: gateOf(slot) }))}</small>` : ''}</span></li>`;
    }).join('')}</ol>`;
    return `<details class="cb-ch cb-${state}"${state === 'now' ? ' open' : ''}>${sum}${blurb}${quests}</details>`;
  }).join('');
  return `<div class="campaign-book">${head}${rows}</div>`;
}
