// The Regatta of Equal Waters on the client (docs/12 P10 #5): the harbour's card (the next race, the sign-up, the
// course's records), the racer's panel (the buoy she sails for, its bearing and distance, her time), and the buoys.

import { REGATTA_BUOYS } from '../../../shared/src/data/regatta.ts';
import { compassPoint } from '../../../shared/src/data/companions.ts';
import type { RegattaView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict({
  title: 'Regatta of Equal Waters',
  text: 'Every three hours, six buoys off a port. In the race every ship handles the same and none may fire: only sail and wind decide.',
  next: 'Next: off {port}, in {m} min · entrants {n}',
  running: 'Under way off {port} · entrants {n}',
  done: 'Over off {port} — the next in the next watch',
  signup: 'Sign up',
  signed: 'Signed up',
  here: 'Sign-up is at the harbour of {port}.',
  records: 'Course records',
  prizes: 'Prizes: 3000 / 1500 / 750 silver; a pennant colour for the first two, the title Wind-Catcher for the winner.',
  panel: 'Regatta',
  buoy: 'Buoy {k} of {n}',
  finish: 'Finish: the start buoy',
  dist: '{m} m to the {dir}',
}, {
  title: 'Регата «Равные воды»',
  text: 'Раз в три часа — шесть буёв у одного из портов. В гонке все корабли управляются одинаково и стрелять нельзя: решают только парус и ветер.',
  next: 'Следующая: у {port}, через {m} мин · записалось {n}',
  running: 'Идёт у {port} · участников {n}',
  done: 'Окончена у {port} — следующая в следующую вахту',
  signup: 'Записаться',
  signed: 'Вы записаны',
  here: 'Запись — в гавани порта {port}.',
  records: 'Рекорды трассы',
  prizes: 'Призы: 3000 / 1500 / 750 серебра; цвет вымпела первым двум, победителю — титул «Ветролов».',
  panel: 'Регата',
  buoy: 'Буй {k} из {n}',
  finish: 'Финиш — стартовый буй',
  dist: '{m} м на {dir}',
});

function portName(state: ClientState, id: string): string {
  return placeName(state.ports.find((p) => p.id === id)?.name ?? id);
}

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

/** The harbour's card. */
export function regattaCard(state: ClientState, v: RegattaView | null, dockedAt: string | null): string {
  if (!v) return '';
  const port = portName(state, v.port);
  const status = v.phase === 'signup' ? L('next', { port, m: Math.ceil(v.startsIn / 60), n: v.entrants }) : v.phase === 'running' ? L('running', { port, n: v.entrants }) : L('done', { port });
  const here = dockedAt === v.port;
  const btn = v.phase !== 'signup' ? '' : v.signedUp ? `<span class="tt-worn">${esc(L('signed'))}</span>` : here ? `<button class="btn btn-small btn-primary" data-act="regatta">${esc(L('signup'))}</button>` : `<span class="muted">${esc(L('here', { port }))}</span>`;
  const recs = v.records.length ? `<div class="giver-h">${esc(L('records'))}</div>${v.records.map((r, i) => `<p class="jr-fish">${i + 1}. ${esc(r.name)} — ${clock(r.sec)}</p>`).join('')}` : '';
  return `<div class="card cmp-card"><h4 class="card-h">${icon('wind', '', 'ico-md')}${esc(L('title'))}</h4><p class="muted">${esc(L('text'))}</p>
    <p>${esc(status)}</p>${btn}<p class="muted cmp-forge">${esc(L('prizes'))}</p>${recs}</div>`;
}

/** The racer's panel: the buoy she sails for, where it lies, her time. Null when she is not racing. */
export function regattaPanel(state: ClientState): string | null {
  const v = state.regatta, own = state.ownDisplay;
  if (!v || v.next === null || !own) return null;
  const [bx, by] = v.buoys[v.next];
  const d = Math.hypot(bx - own.x, by - own.y);
  const dir = compassPoint(bx - own.x, by - own.y)[lang() === 'ru' ? 1 : 0];
  const what = v.next === 0 ? L('finish') : L('buoy', { k: v.passed + 1, n: REGATTA_BUOYS });
  return `<div class="fp-head"><b>${esc(L('panel'))}</b><span class="hp-lvl">${v.time !== null ? clock(v.time) : ''}</span></div>
    <div class="rg-next">${esc(what)} · ${esc(L('dist', { m: Math.round(d / 10) * 10, dir }))}</div>`;
}
