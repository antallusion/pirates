// The Colosseum in the Throne's window (docs/19 E14): one tab of THRONE_TABS.
//  - The lobby: her rating and place, the queue (its clock ticking here, not on the private state's beat) and a practice
//    bout, her last bout, the season's table, its rewards, the rules.
//  - The draft board while she drafts: the two seats (face, points, bans, army), the table's lots (each kind's face, men
//    and price; banned crossed out, taken framed in its side's colour, too dear dimmed), the turn and its clock. A tap on
//    a lot shows it below with its numbers; a second tap (or the button) bans or takes it; «Done» stops taking (what is
//    left reinforces the stacks). The same on a phone held sideways and with a mouse.

import { ARENA_BANS, ARENA_BUDGET, ARENA_MIN_BOUTS, ARENA_REWARDS, ARENA_WAIT, arenaLot } from '../../../shared/src/data/arena.ts';
import type { ArenaDraftView, ArenaLot, ArenaView } from '../../../shared/src/data/arena.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { seaHourOf } from '../../../shared/src/data/seamarks.ts';
import type { GloryView } from '../../../shared/src/data/throne.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/arena.ts';
import { EN as TEN, RU as TRU } from '../lang/ui/throne.ts';
import { serverText } from '../lang/server.ts';
import { personName } from '../lang/names.ts';
import type { ClientState } from '../state.ts';
import { specialName, unitIcon, unitName } from './army.ts';
import { dec1, esc, fmt, icon } from './dom.ts';
import type { ThroneTab } from './throne.ts';

const L = dict(EN, RU);
const TL = dict(TEN, TRU);

/** The lot she has tapped on the board (shown below it; a second tap acts). */
let sel: UnitId | null = null;
/** The client's state the clocks read (the window's render hands it). */
let stateRef: ClientState | null = null;

/** A rating's change with its sign (a true minus). */
const signed = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0');
const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const nameOf = (v: ArenaDraftView, k: 0 | 1) => (v.seats[k].ai ? serverText(v.seats[k].name) : personName(v.seats[k].name));
/** A foe's name: a captain's, or a legend of the sea's in her tongue. */
const foeName = (n: string) => (serverText(n) !== n ? serverText(n) : personName(n));

// ------------------------------------------------------------------ the lobby

function rewardsHtml(): string {
  const hour = seaHourOf(10);
  const label = (i: number) => [L('rw1'), L('rw23'), L('rw410'), L('rwRating', { n: ARENA_REWARDS[3].rating ?? 0 }), L('rwAll')][i];
  const rows = ARENA_REWARDS.map((r, i) => {
    const bits: string[] = [];
    if (r.title) bits.push(`«${r.title[lang() === 'ru' ? 1 : 0]}»`);
    if (r.pennant) bits.push(L('rwPennant'));
    if (i === 0) bits.push(L('rwPantheon'));
    if (r.glory > 0) bits.push(r.glory >= 1 ? L('rwGloryOne') : L('rwGlory', { n: dec1(r.glory) }));
    return `<li><b>${esc(label(i))}</b><span>${esc(bits.join(', '))}${bits.length ? ' · ' : ''}<span class="money">${icon('coin', '⛁', 'ico-sm')}${fmt(r.hours * hour)}</span></span></li>`;
  }).join('');
  return `<h4 class="card-h">${esc(L('rewardsH', { n: ARENA_MIN_BOUTS }))}</h4><ul class="ar-rw">${rows}</ul>`;
}

function lobby(v: ArenaView, state: ClientState): string {
  const days = Math.ceil((v.ends - Date.now()) / 86_400_000);
  const last = v.last
    ? `<p class="ar-last ${v.last.won ? 'won' : 'lost'}">${esc(!v.last.foe ? L(v.last.won ? 'lastWonAny' : 'lastLostAny') : v.last.won ? L('lastWon', { foe: foeName(v.last.foe) }) : L('lastLost', { foe: foeName(v.last.foe) }))} · ${esc(v.last.practice || !v.last.delta ? L('lastFriendly') : L('lastDelta', { d: signed(v.last.delta) }))}</p>`
    : '';
  const why = v.why && !v.queue ? serverText(v.why) : '';
  const go = v.queue
    ? `<span class="muted">${esc(L('inQueue', { t: '§', n: v.queue.n })).replace('§', `<b data-arsince="${v.queue.since}">${mmss(state.estServerTime() - v.queue.since)}</b>`)}</span>
       <button class="btn btn-small" data-arop="leave">${esc(L('leaveBtn'))}</button>`
    : `<span class="muted">${esc(why || L('ready'))}</span>
       <button class="btn btn-small btn-primary" data-arop="queue" ${why ? 'disabled' : ''} title="${esc(why)}">${esc(L('queueBtn'))}</button>
       <button class="btn btn-small" data-arop="practice" ${why ? 'disabled' : ''} title="${esc(why)}">${esc(L('practiceBtn'))}</button>`;
  const table = v.table.length
    ? `<ol class="ar-table">${v.table.map((r, i) => `<li class="${r.you ? 'you' : ''}"><i>${r.you && i >= 10 ? v.place : i + 1}</i><b>${esc(personName(r.name))}</b><span>${esc(L('tableRow', { r: r.rating, w: r.wins, n: r.bouts }))}</span></li>`).join('')}</ol>`
    : `<p class="muted hx-none">${esc(L('tableNone'))}</p>`;
  return `<div class="th-head">
      <div class="th-medal ar-medal" title="${esc(L('rating'))}"><span>${icon('item_duelling_pistols', '⚔', 'ico-sm')}</span><b>${v.rating}</b></div>
      <div class="th-hside"><div class="gi-h">${esc(L('title', { n: v.season }))}</div>
        <div class="th-chips"><span class="th-chip">${esc(v.place ? L('place', { n: v.place }) : L('placeNone'))}</span><span class="th-chip">${esc(L('bouts', { n: v.bouts, w: v.wins }))}</span><span class="th-chip">${esc(L('best', { n: v.best }))}</span></div>
        <small class="muted">${esc(days > 0 ? L('ends', { d: days }) : L('endsSoon'))}${v.champion ? ` · ${esc(L('champion', { s: v.champion.season, name: personName(v.champion.name) }))}` : ''}</small></div>
    </div>
    ${last}
    <div class="th-seal-go ar-go">${go}</div>
    ${v.queue ? `<p class="muted th-why">${esc(L('queueNote', { s: ARENA_WAIT }))}</p>` : ''}
    <h4 class="card-h">${esc(L('tableH'))}</h4>
    ${table}
    ${rewardsHtml()}
    <p class="muted hx-note">${esc(L('rules', { b: ARENA_BUDGET }))}</p>`;
}

// ------------------------------------------------------------------ the draft

function seat(v: ArenaDraftView, k: 0 | 1): string {
  const s = v.seats[k];
  const mine = k === v.you;
  const army = v.picks[k].map((u) => {
    const lot = v.pool.find((x) => x.u === u) ?? arenaLot(u);
    return `<span class="ar-pk" title="${esc(L('lot', { name: unitName(u), n: lot.n }))}">${unitIcon(u, 'army-face-xs')}<b>${lot.n}</b></span>`;
  }).join('');
  const bans = v.bans[k].map((u) => `<span class="ar-bn" title="${esc(unitName(u))}">${unitIcon(u, 'army-face-xs')}<i>✕</i></span>`).join('');
  return `<div class="ar-seat ${mine ? 'you' : 'foe'}${v.turn === k && v.stage !== 'done' && v.stage !== 'fight' ? ' turn' : ''}">
    <div class="ar-who">${icon(CAPTAINS[s.path].portrait, '', 'ico-md ico-round')}<span><b>${esc(mine ? L('you') : nameOf(v, k))}</b><small>${esc(s.ai ? L('legend') : `${L('rating')} ${s.rating ?? ''}`)}</small></span></div>
    <div class="ar-pts">${esc(L('points', { n: v.left[k], m: ARENA_BUDGET }))}${v.done[k] && v.stage === 'pick' ? ` · <span class="gold">${esc(L('doneMark'))}</span>` : ''}</div>
    <div class="ar-bans" title="${esc(L('bans'))}">${bans || '<span class="muted">—</span>'}</div>
    <div class="ar-army" title="${esc(L('army'))}">${army}</div>
  </div>`;
}

function lotTile(v: ArenaDraftView, lot: ArenaLot): string {
  const banned = v.bans[0].includes(lot.u) || v.bans[1].includes(lot.u);
  const mine = v.picks[v.you].includes(lot.u), theirs = v.picks[1 - v.you].includes(lot.u);
  const dear = !banned && !mine && !theirs && v.stage === 'pick' && lot.price > v.left[v.you];
  const cls = banned ? 'banned' : mine ? 'mine' : theirs ? 'theirs' : dear ? 'dear' : 'open';
  const tag = banned ? L('banned') : mine ? L('takenYou') : theirs ? L('takenFoe') : dear ? L('tooDear') : '';
  return `<button class="ar-lot ${cls}${sel === lot.u ? ' sel' : ''}" data-arlot="${lot.u}" title="${esc(`${L('lot', { name: unitName(lot.u), n: lot.n })}${tag ? ` · ${tag}` : ''}`)}" ${banned || mine || theirs ? 'aria-disabled="true"' : ''}>
    ${unitIcon(lot.u, 'ar-face')}<b class="ar-n">×${lot.n}</b><i class="ar-p">${lot.price}</i>${banned ? '<i class="ar-x">✕</i>' : ''}
  </button>`;
}

/** What she may do with the tapped lot now: 'ban', 'pick', or null. */
function verbFor(v: ArenaDraftView, u: UnitId | null): 'ban' | 'pick' | null {
  if (!u || v.turn !== v.you || (v.stage !== 'ban' && v.stage !== 'pick')) return null;
  if (v.bans[0].includes(u) || v.bans[1].includes(u) || v.picks[0].includes(u) || v.picks[1].includes(u)) return null;
  if (v.stage === 'ban') return 'ban';
  const lot = v.pool.find((x) => x.u === u);
  return lot && lot.price <= v.left[v.you] && v.picks[v.you].length < 7 && !v.done[v.you] ? 'pick' : null;
}

function selBar(v: ArenaDraftView): string {
  const myTurn = v.turn === v.you && (v.stage === 'ban' || v.stage === 'pick');
  const lot = sel ? v.pool.find((x) => x.u === sel) : undefined;
  const verb = verbFor(v, sel);
  const info = lot
    ? (() => {
      const d = UNITS[lot.u];
      const sp = d.specials.length ? ` · ${d.specials.map(specialName).join(', ')}` : '';
      return `${unitIcon(lot.u, 'army-face-sm')}<span class="ar-st"><b>${esc(L('lot', { name: unitName(lot.u), n: lot.n }))}</b><small>${esc(L('lotStats', { t: d.tier, atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp, sp: d.speed }))}${esc(sp)}</small></span>`;
    })()
    : `<span class="ar-st muted"><small>${esc(L('selNone', { verb: v.stage === 'ban' ? L('verbBan') : L('verbPick') }))}</small></span>`;
  const act = v.stage === 'ban'
    ? `<button class="btn btn-small btn-danger" data-arop="ban" ${verb === 'ban' ? '' : 'disabled'}>${esc(L('banBtn'))}</button>`
    : `<button class="btn btn-small btn-primary" data-arop="pick" ${verb === 'pick' ? '' : 'disabled'}>${esc(lot ? L('pickBtn', { p: lot.price }) : L('pickBtn0'))}</button>`;
  const pass = v.stage === 'pick' ? `<button class="btn btn-small" data-arop="pass" ${myTurn && v.picks[v.you].length && !v.done[v.you] ? '' : 'disabled'} title="${esc(L('passTip'))}">${esc(L('passBtn'))}</button>` : '';
  return `<div class="ar-sel">${info}<span class="ar-acts">${act}${pass}</span></div>`;
}

function board(v: ArenaDraftView): string {
  const nb = v.bans[0].length + v.bans[1].length;
  const stage = v.stage === 'ban' ? L('stageBan', { n: Math.min(ARENA_BANS, v.bans[v.turn].length + 1), m: ARENA_BANS }) : v.stage === 'pick' ? L('stagePick') : L('stageFight');
  const who = v.stage === 'fight' || v.stage === 'done' ? '' : v.turn === v.you ? L('yourTurn') : L('theirTurn', { name: nameOf(v, v.turn) });
  const kind = v.practice ? L('practice') : v.rated ? L('rated') : L('friendly');
  void nb;
  // One grid: the two seats beside the turn, the table of lots and the tapped lot (on a narrow screen the seats shrink
  // to a line each above the table).
  return `<div class="ar-draft">
    ${seat(v, v.you)}
    <div class="ar-turn${v.turn === v.you && v.stage !== 'fight' ? ' mine' : ''}"><span class="th-chip">${esc(kind)}</span><b>${esc(stage)}</b>${who ? `<span>${esc(who)}</span>` : ''}${v.stage === 'ban' || v.stage === 'pick' ? `<b class="ar-clock" data-aruntil="${v.until}">${Math.max(0, Math.ceil(v.until - (stateRef?.estServerTime() ?? 0)))}</b>` : ''}</div>
    ${seat(v, (1 - v.you) as 0 | 1)}
    <div class="ar-pool">${v.pool.map((l) => lotTile(v, l)).join('')}</div>
    ${selBar(v)}
  </div>`;
}

function arenaTab(g: GloryView, state: ClientState): string {
  stateRef = state;
  const v = g.arena;
  if (!g.open || !v) return `<div class="ar-wrap"><p class="muted th-locked">${esc(TL('locked', { n: MAX_LEVEL, m: state.self?.level ?? 0 }))}</p></div>`;
  if (!v.draft) sel = null;
  return `<div class="ar-wrap">${v.draft ? board(v.draft) : lobby(v, state)}</div>`;
}

// ------------------------------------------------------------------ the buttons and the clocks

let ticker: ReturnType<typeof setInterval> | null = null;
/** The clocks on the board and in the queue, a few times a second (the window redraws only when her state changes). */
function tick(): void {
  const st = stateRef;
  const els = document.querySelectorAll<HTMLElement>('[data-aruntil], [data-arsince]');
  if (!els.length || !st) {
    if (ticker) clearInterval(ticker);
    ticker = null;
    return;
  }
  const now = st.estServerTime();
  for (const el of els) {
    if (el.dataset.aruntil) {
      const left = Math.max(0, Math.ceil(Number(el.dataset.aruntil) - now));
      el.textContent = String(left);
      el.classList.toggle('low', left <= 5);
    } else el.textContent = mmss(now - Number(el.dataset.arsince));
  }
}

function bindArena(root: HTMLElement, send: (m: ClientMsg) => void): void {
  if (!ticker) ticker = setInterval(tick, 250);
  const v = stateRef?.self?.glory?.arena;
  const d = v?.draft;
  const redraw = () => {
    const wrap = root.querySelector<HTMLElement>('.ar-wrap');
    const g = stateRef?.self?.glory;
    if (!wrap || !g) return;
    wrap.outerHTML = arenaTab(g, stateRef!);
    bindArena(root, send);
  };
  root.querySelectorAll<HTMLElement>('[data-arop]').forEach((b) => (b.onclick = () => {
    const op = b.dataset.arop as 'queue' | 'leave' | 'practice' | 'ban' | 'pick' | 'pass';
    if (op === 'ban' || op === 'pick') {
      if (!sel) return;
      send({ t: 'throne', action: 'arena', op, u: sel });
      sel = null;
      return;
    }
    send({ t: 'throne', action: 'arena', op });
  }));
  root.querySelectorAll<HTMLElement>('[data-arlot]').forEach((b) => (b.onclick = () => {
    const u = b.dataset.arlot as UnitId;
    if (d && sel === u) {
      // The second tap on the same lot: its ban or its pick, if hers to make now.
      const verb = verbFor(d, u);
      if (verb) {
        send({ t: 'throne', action: 'arena', op: verb, u });
        sel = null;
        return;
      }
    }
    sel = u;
    redraw();
  }));
}

/** The Colosseum's tab, a mark on it when the draft waits for her. */
export const ARENA_TABS: ThroneTab[] = [
  {
    id: 'arena', label: () => L('tab'), icon: 'item_duelling_pistols', render: arenaTab, bind: bindArena,
    badge: (g) => (g.arena?.draft && g.arena.draft.turn === g.arena.draft.you && (g.arena.draft.stage === 'ban' || g.arena.draft.stage === 'pick') ? 1 : 0),
  },
];

/** The bout's end line on the battle's screen (tactical.ts). */
export function arenaEndLine(r: { rated: boolean; practice: boolean; rating: number; delta: number }): string {
  if (r.practice) return L('endPractice');
  if (!r.rated) return L('endFriendly');
  return L('endRated', { r: r.rating, d: signed(r.delta) });
}
