// A captain's nemeses on the client (docs/12 P10 #1): kept from the Guild's view, named in the HUD and on the posters,
// and set out in the journal's dossier — his new name, his rank against her, his scars, their score.

import { NEMESIS_RANKS, SCARS, nemesisName } from '../../../shared/src/data/nemesis.ts';
import { pirateById } from '../../../shared/src/data/pirates.ts';
import type { NemesisView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { dict, lang } from '../i18n.ts';
import { esc, icon } from './dom.ts';

const L = dict({
  title: 'Nemeses',
  tag: 'Blood feud · {rank}',
  stamp: 'BLOOD FEUD',
  rank: '{rank} (rank {n} of 5)',
  score: 'Your defeats: {lost} · his escapes: {fled}',
  scars: 'Scars: {list}',
  sea: 'Waters: {sea}',
  heads: 'Heads taken in revenge: {n}',
  hint: 'Sink him and the grudge is settled: silver from his cabin by his rank, a fine piece, his head among your trophies.',
}, {
  title: 'Заклятые враги',
  tag: 'Кровная месть · {rank}',
  stamp: 'КРОВНАЯ МЕСТЬ',
  rank: '{rank} (ранг {n} из 5)',
  score: 'Ваши поражения: {lost} · побеги от вас: {fled}',
  scars: 'Шрамы: {list}',
  sea: 'Воды: {sea}',
  heads: 'Голов взято в отместку: {n}',
  hint: 'Потопите его — и счёт закрыт: серебро из его каюты по рангу, добрая вещь и его голова среди ваших трофеев.',
});

let list: NemesisView[] = [];

export function setNemeses(v: NemesisView[] | undefined): void {
  list = v ?? [];
}

export function nemesisFor(id: string): NemesisView | undefined {
  return list.find((n) => n.id === id);
}

const ru = () => (lang() === 'ru' ? 1 : 0);

/** The HUD's label for a named pirate who is her nemesis: his new name, and the rank of the grudge. */
export function nemesisLabel(id: string): { name: string; tag: string } | null {
  const v = nemesisFor(id), np = pirateById(id);
  if (!v || !np) return null;
  return { name: nemesisName(np, v.epithet)[ru()], tag: L('tag', { rank: NEMESIS_RANKS[v.rank - 1][ru()] }) };
}

/** A poster's extra for her nemesis: the stamp and his new name. */
export function nemesisPoster(id: string): { name: string; stamp: string } | null {
  const v = nemesisFor(id), np = pirateById(id);
  if (!v || !np) return null;
  return { name: nemesisName(np, v.epithet)[ru()], stamp: `${L('stamp')} · ${NEMESIS_RANKS[v.rank - 1][ru()]}` };
}

/** The journal's dossier of nemeses. */
export function nemesisLog(v: NemesisView[] | undefined, heads: number): string {
  if (!v?.length && !heads) return '';
  const r = ru();
  const rows = (v ?? []).map((n) => {
    const np = pirateById(n.id);
    if (!np) return '';
    const scars = [...new Set(n.scars)].map((c) => SCARS[c][r]).join('; ');
    return `<div class="nem-row">
      <div class="nem-face">${icon(`portrait.${np.portrait}`, '☠', 'nem-img')}</div>
      <div class="nem-text"><b>${esc(nemesisName(np, n.epithet)[r])}</b>
        <span class="nem-rank">${esc(L('rank', { rank: NEMESIS_RANKS[n.rank - 1][r], n: n.rank }))}</span>
        <span class="muted">${esc(L('sea', { sea: REGIONS[np.region].name }))} · <span class="nowrap">«${esc(np.ship[r])}» ⚓${np.level}</span></span>
        <span class="muted">${esc(L('score', { lost: n.lost, fled: n.fled }))}</span>
        ${scars ? `<span class="muted">${esc(L('scars', { list: scars }))}</span>` : ''}</div></div>`;
  }).join('');
  return `<div class="jr-fishing jr-nemesis"><div class="giver-h">${esc(L('title'))}</div>${rows}
    ${heads ? `<p class="jr-fish">${esc(L('heads', { n: heads }))}</p>` : ''}<p class="jr-fish muted">${esc(L('hint'))}</p></div>`;
}
