// Dead Man's Dice (docs/12 P10 #4): the table — the seats with their cups (her own dice, the others' counts), the
// standing bid, her raise (how many, which face) or "It's a lie!", the clock; the cups turned up when a lie is
// called; the pot to the last cup with dice. And the tavern's card: open a table, join one, the week's best.

import { DICE_STAKES, DAVY_STAKE, validRaise } from '../../../shared/src/data/dice.ts';
import type { ClientMsg, DiceView } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { bar, esc, icon, money } from './dom.ts';

const L = dict({
  title: 'Dead Man’s Dice',
  sub: 'Stake {stake} · pot {pot}',
  subDavy: 'Against Davy Jones: a cursed thing, or the sea’s toll',
  rules: 'Bid how many dice at the table show a face — ones are wild. Raise the last bid, or call it a lie. The one who is wrong loses a die; the last cup with dice takes the pot.',
  waiting: 'Waiting for captains to sit down — the regulars fill the rest in {s} s.',
  start: 'Shake the cups',
  leave: 'Get up',
  close: 'Close',
  yourTurn: 'Your bid — {s} s',
  theirTurn: '{name} is thinking — {s} s',
  bidNow: 'Standing bid: {q} × ',
  noBid: 'No bid yet: you open.',
  bid: 'Bid',
  liar: 'It’s a lie!',
  how: 'How many',
  face: 'Which face',
  dice: '{n} dice',
  out: 'out',
  winner: '{name} takes the pot',
  reveal: 'The cups: {n} stand for the bid',
  card: 'Dead Man’s Dice',
  cardText: 'Liar’s dice with the regulars and the captains in port. A round takes a couple of minutes.',
  open: 'Open a table',
  join: 'Sit down',
  tables: 'Tables waiting',
  week: 'The week’s tournament',
  davy: 'Play Davy Jones',
  davyText: 'Midnight in the Abyss: Davy Jones plays for a cursed thing. Lose, and the sea takes its toll.',
}, {
  title: 'Кости мертвеца',
  sub: 'Ставка {stake} · банк {pot}',
  subDavy: 'Против Дэйви Джонса: проклятая вещь или дань морю',
  rules: 'Ставьте, сколько костей за столом показывают грань — единицы идут за любую. Перебейте ставку или назовите её враньём. Кто ошибся — теряет кость; последний с костями забирает банк.',
  waiting: 'Ждём капитанов — остальные места займут завсегдатаи через {s} с.',
  start: 'Трясти кружки',
  leave: 'Встать из-за стола',
  close: 'Закрыть',
  yourTurn: 'Ваша ставка — {s} с',
  theirTurn: '{name} думает — {s} с',
  bidNow: 'Ставка: {q} × ',
  noBid: 'Ставок ещё нет: начинаете вы.',
  bid: 'Ставлю',
  liar: 'Враньё!',
  how: 'Сколько',
  face: 'Какая грань',
  dice: 'костей: {n}',
  out: 'выбыл',
  winner: '{name} забирает банк',
  reveal: 'Кружки подняты: за ставку — {n}',
  card: 'Кости мертвеца',
  cardText: 'Кости лжеца с завсегдатаями и капитанами в порту. Партия — пара минут.',
  open: 'Открыть стол',
  join: 'Сесть',
  tables: 'Столы ждут игроков',
  week: 'Турнир недели',
  davy: 'Сыграть с Дэйви Джонсом',
  davyText: 'Полночь в Бездне: Дэйви Джонс играет на проклятую вещь. Проиграете — море возьмёт своё.',
});

/** A die's face in pips. */
export function die(face: number, cls = 'die'): string {
  const P: Record<number, [number, number][]> = {
    1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
  const pips = (P[face] ?? []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('');
  return `<svg class="${cls}${face === 1 ? ' wild' : ''}" viewBox="0 0 100 100" aria-label="${face}"><rect x="4" y="4" width="92" height="92" rx="16"/>${pips}</svg>`;
}
const hidden = (cls = 'die hid') => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><rect x="4" y="4" width="92" height="92" rx="16"/><text x="50" y="66" text-anchor="middle">?</text></svg>`;

let q = 1;
let f = 2;

export function renderDice(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const v: DiceView | null = state.dice;
  if (!v) return;
  // The clock runs down between the table's words.
  const sec = Math.max(0, Math.ceil(v.sec - (performance.now() - state.diceAt) / 1000));
  const me = v.seats.findIndex((x) => x.me);
  const total = v.seats.reduce((a, x) => a + x.dice, 0);
  const mine = v.phase === 'play' && v.turn === me;
  // Keep the proposed raise valid as the table moves on.
  if (v.bid) {
    if (!validRaise(v.bid, { q, f }, total)) {
      q = v.bid.q + (v.bid.f < 6 ? 0 : 1);
      f = v.bid.f < 6 ? v.bid.f + 1 : 2;
      if (!validRaise(v.bid, { q, f }, total)) {
        q = v.bid.q + 1;
        f = 2;
      }
    }
  } else if (q > total) q = 1;
  const seats = v.seats.map((x, i) => {
    // The cups turned up: everyone's dice as they were when the lie was called.
    const cup = v.reveal ? v.reveal.cups[i] : x.cup;
    const dice = cup?.length ? cup.map((d) => die(d, `die${v.reveal && (d === v.reveal.face || d === 1) ? ' hit' : ''}`)).join('') : Array.from({ length: x.dice }, () => hidden()).join('');
    return `<div class="dc-seat${v.phase === 'play' && v.turn === i ? ' turn' : ''}${x.me ? ' me' : ''}${x.dice <= 0 ? ' out' : ''}${v.winner === i ? ' won' : ''}${v.reveal?.loser === i ? ' lost' : ''}">
      <b>${esc(serverText(x.name))}</b><span class="muted">${x.dice > 0 ? esc(L('dice', { n: x.dice })) : esc(L('out'))}</span><div class="dc-cup">${dice}</div></div>`;
  }).join('');
  const sub = v.davy ? L('subDavy') : L('sub', { stake: v.stake.toLocaleString(), pot: v.pot.toLocaleString() });
  const bidLine = v.turn < 0 ? '' : v.bid ? `<div class="dc-bid">${esc(L('bidNow', { q: v.bid.q }))}${die(v.bid.f, 'die big')}<span class="muted">— ${esc(serverText(v.seats[v.bid.by]?.name ?? ''))}</span></div>` : v.phase === 'play' ? `<div class="dc-bid muted">${esc(mine ? L('noBid') : '')}</div>` : '';
  const clock = v.phase === 'play' && v.turn >= 0 ? `<div class="dc-clock">${esc(mine ? L('yourTurn', { s: sec }) : L('theirTurn', { name: serverText(v.seats[v.turn]?.name ?? ''), s: sec }))}${bar('xp', sec / 20)}</div>` : '';
  const controls = mine ? `<div class="dc-controls">
      <div class="dc-step"><span class="giver-h">${esc(L('how'))}</span><button class="btn btn-small" data-dq="-1" aria-label="−">−</button><b class="dc-q">${q}</b><button class="btn btn-small" data-dq="1" aria-label="+">+</button></div>
      <div class="dc-faces"><span class="giver-h">${esc(L('face'))}</span>${[2, 3, 4, 5, 6].map((x) => `<button class="dc-face${x === f ? ' on' : ''}" data-df="${x}" aria-label="${x}">${die(x)}</button>`).join('')}</div>
      <div class="dc-acts"><button class="btn btn-primary" data-dbid ${validRaise(v.bid, { q, f }, total) ? '' : 'disabled'}>${esc(L('bid'))} ${q} × ${die(f, 'die sm')}</button>${v.bid ? `<button class="btn btn-danger" data-dliar>${esc(L('liar'))}</button>` : ''}</div></div>` : '';
  const open = v.phase === 'open' ? `<p class="muted dc-wait">${esc(L('waiting', { s: sec }))}</p>${v.host ? `<button class="btn btn-primary" data-dstart>${esc(L('start'))}</button>` : ''}` : '';
  const done = v.phase === 'done' && v.winner !== null ? `<div class="dc-win">${esc(L('winner', { name: serverText(v.seats[v.winner].name) }))}</div>` : '';
  const reveal = v.reveal && v.phase !== 'open' ? `<p class="dc-reveal">${esc(L('reveal', { n: v.reveal.count }))}</p>` : '';
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(sub)}</div></div></div>
    <div class="modal-body dice">
      <p class="muted dc-rules">${esc(L('rules'))}</p>
      <div class="dc-seats">${seats}</div>
      ${reveal}${bidLine}${clock}${controls}${open}${done}
      <div class="dc-log">${v.log.map((l) => `<div>${esc(serverText(l))}</div>`).join('')}</div>
      <div class="dc-foot"><button class="btn btn-small" data-dleave>${esc(v.phase === 'done' ? L('close') : L('leave'))}</button></div>
    </div>`;
  const redo = () => renderDice(root, state, send);
  root.querySelectorAll<HTMLElement>('[data-dq]').forEach((b) => (b.onclick = () => {
    q = Math.max(1, Math.min(total, q + Number(b.dataset.dq)));
    redo();
  }));
  root.querySelectorAll<HTMLElement>('[data-df]').forEach((b) => (b.onclick = () => {
    f = Number(b.dataset.df);
    redo();
  }));
  root.querySelector<HTMLElement>('[data-dbid]')?.addEventListener('click', () => send({ t: 'dice', action: 'bid', q, f }));
  root.querySelector<HTMLElement>('[data-dliar]')?.addEventListener('click', () => send({ t: 'dice', action: 'liar' }));
  root.querySelector<HTMLElement>('[data-dstart]')?.addEventListener('click', () => send({ t: 'dice', action: 'start' }));
  root.querySelector<HTMLElement>('[data-dleave]')?.addEventListener('click', () => send({ t: 'dice', action: 'leave' }));
}

/** Between the table's words: only the clock moves (a whole redraw could swallow a tap). */
export function tickDice(root: HTMLElement, state: ClientState): void {
  const v = state.dice;
  const el = root.querySelector<HTMLElement>('.dc-clock');
  const waiting = root.querySelector<HTMLElement>('.dc-wait');
  if (!v) return;
  const sec = Math.max(0, Math.ceil(v.sec - (performance.now() - state.diceAt) / 1000));
  if (el) {
    const mine = v.turn === v.seats.findIndex((x) => x.me);
    el.innerHTML = `${esc(mine ? L('yourTurn', { s: sec }) : L('theirTurn', { name: serverText(v.seats[v.turn]?.name ?? ''), s: sec }))}${bar('xp', sec / 20)}`;
  }
  if (waiting) waiting.textContent = L('waiting', { s: sec });
}

/** The tavern's card: open a table at a stake, sit down at one, the week's best; Davy at midnight in the Abyss. */
export function diceCard(d: NonNullable<NonNullable<ClientState['portView']>['tavern']['dice']>, gold: number): string {
  const stakes = DICE_STAKES.map((st) => `<button class="btn btn-small" data-act="dice_open" data-stake="${st}" ${gold < st ? 'disabled' : ''}>${esc(L('open'))} ${money(st)}</button>`).join('');
  const tables = d.tables.length ? `<div class="giver-h">${esc(L('tables'))}</div>${d.tables.map((t) => `<div class="cmp-h"><div class="cmp-h-t"><b>${esc(t.host)}</b><span class="muted">${money(t.stake)} · ${t.seats}/4</span></div><button class="btn btn-small" data-act="dice_join" data-id="${t.id}" ${gold < t.stake ? 'disabled' : ''}>${esc(L('join'))}</button></div>`).join('')}` : '';
  const week = d.week.length ? `<div class="giver-h">${esc(L('week'))}</div>${d.week.map((w, i) => `<p class="jr-fish">${i + 1}. ${esc(w.name)} — ${w.wins}</p>`).join('')}` : '';
  const davy = d.davy ? `<div class="dc-davy"><p>${esc(L('davyText'))}</p><button class="btn btn-danger" data-act="dice_davy" ${gold < DAVY_STAKE ? 'disabled' : ''}>${esc(L('davy'))} ${money(DAVY_STAKE)}</button></div>` : '';
  return `<div class="card cmp-card dice-card"><h4 class="card-h">${icon('dice', '', 'ico-md') || icon('coin', '', 'ico-md')}${esc(L('card'))}</h4><p class="muted">${esc(L('cardText'))}</p>
    <div class="dc-stakes">${stakes}</div>${davy}${tables}${week}</div>`;
}
