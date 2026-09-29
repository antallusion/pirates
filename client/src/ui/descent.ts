// The Descent into the Abyss on the client (docs/12 P10 #17): the panel of a captain going down (the tier, its creatures,
// current and darkness, what is left of them and the clock), the choice between tiers (a blessing or a curse, for the
// leader), and the week's board of the deepest.

import { BOONS, CURRENTS, DARKS, HOSTS } from '../../../shared/src/data/descent.ts';
import type { BoonId } from '../../../shared/src/data/descent.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';
import { personName } from '../lang/names.ts';

const L = dict({
  panel: 'The Descent',
  tier: 'Tier {n}',
  left: '{n} left · {t}',
  choosing: 'The leader chooses…',
  choose: 'Choose',
  breath: 'The next tier comes…',
  title: 'The Descent into the Abyss',
  sub: 'Tier {n} is behind you. Take a blessing — or a curse, for more glory on the week’s board.',
  wait: 'Your leader is choosing.',
  curse: 'Curse',
  blessing: 'Blessing',
  taken: 'Taken so far',
  none: 'Nothing yet.',
  board: 'The deepest this week',
  empty: 'Nobody has gone down yet.',
  row: 'tier {d} · glory {g}',
  leave: 'Come up',
  auto: 'In {t} the first blessing is taken.',
}, {
  panel: 'Спуск',
  tier: 'Ярус {n}',
  left: 'осталось {n} · {t}',
  choosing: 'Ведущий выбирает…',
  choose: 'Взять',
  breath: 'Следующий ярус близко…',
  title: 'Спуск в Бездну',
  sub: 'Ярус {n} позади. Возьмите благословение — или проклятие: больше славы в таблице недели.',
  wait: 'Выбирает ведущий.',
  curse: 'Проклятие',
  blessing: 'Благословение',
  taken: 'Уже взято',
  none: 'Пока ничего.',
  board: 'Глубже всех на этой неделе',
  empty: 'Пока никто не спускался.',
  row: 'ярус {d} · слава {g}',
  leave: 'Подняться',
  auto: 'Через {t} возьмётся первое благословение.',
});

const ru = () => (lang() === 'ru' ? 1 : 0);

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

/** The descender's panel. Null when she is not going down. */
export function descentPanel(state: ClientState): string | null {
  const run = state.descent?.run;
  if (!run) return null;
  const combo = [...run.hosts.map((h) => HOSTS[h].name[ru()]), CURRENTS[run.current].name[ru()], DARKS[run.dark].name[ru()]].join(' · ');
  const line = run.phase === 'fight' ? L('left', { n: run.enemies, t: clock(run.left) }) : run.phase === 'choice' ? L('choosing') : L('breath');
  return `<div class="fp-head"><b>${icon('danger', '', 'ico-sm')}${esc(L('panel'))}</b><span class="hp-lvl">${esc(L('tier', { n: run.tier }))}</span></div>
    <div class="rg-next">${esc(combo)}</div><div class="ds-left">${esc(line)}</div>`;
}

function boonCard(b: BoonId, leader: boolean): string {
  const d = BOONS[b];
  return `<div class="ds-boon${d.curse ? ' curse' : ''}"><div class="ds-kind">${esc(d.curse ? L('curse') : L('blessing'))}</div>
    <b class="with-ico">${icon(`boon_${b}`, '', 'ico-md')}${esc(d.name[ru()])}</b><p>${esc(d.text[ru()])}</p>${leader ? `<button class="btn btn-small${d.curse ? ' btn-danger' : ' btn-primary'}" data-boon="${b}">${esc(L('choose'))}</button>` : ''}</div>`;
}

/** The window between tiers (and the board). */
export function renderDescent(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const v = state.descent;
  if (!v) return;
  const run = v.run;
  const choice = run && run.phase === 'choice';
  const offers = run?.offers ?? [];
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2>${run ? `<div class="sub">${esc(L('sub', { n: Math.max(0, run.tier) }))}</div>` : ''}</div></div>
    <div class="modal-body descent">
      ${choice ? (run!.leader ? `<div class="ds-offers">${offers.map((b) => boonCard(b, true)).join('')}</div><p class="muted">${esc(L('auto', { t: clock(run!.left) }))}</p>` : `<p>${esc(L('wait'))}</p>`) : ''}
      ${run ? `<div class="card"><h4 class="card-h">${esc(L('taken'))}</h4>${run.boons.length ? `<div class="ds-taken">${run.boons.map((b) => `<span class="chip ${BOONS[b].curse ? 'bad' : 'good'}" title="${esc(BOONS[b].text[ru()])}">${esc(BOONS[b].name[ru()])}</span>`).join(' ')}</div>` : `<p class="muted">${esc(L('none'))}</p>`}</div>` : ''}
      <div class="card"><h4 class="card-h">${icon('xp', '', 'ico-md')}${esc(L('board'))}</h4>
        ${v.week.length ? v.week.map((r, i) => `<p class="ds-row"><span>${i + 1}. ${esc(r.names.map(personName).join(', '))}</span><span class="muted">${esc(L('row', { d: r.depth, g: r.glory }))}</span></p>`).join('') : `<p class="muted">${esc(L('empty'))}</p>`}</div>
      ${run ? `<div class="ds-foot"><button class="btn btn-small btn-danger" data-dleave>${esc(L('leave'))}</button></div>` : ''}
    </div>`;
  root.querySelectorAll<HTMLElement>('[data-boon]').forEach((b) => (b.onclick = () => send({ t: 'descent', action: 'choose', pick: b.dataset.boon as BoonId })));
  root.querySelector<HTMLElement>('[data-dleave]')?.addEventListener('click', () => send({ t: 'descent', action: 'leave' }));
}
