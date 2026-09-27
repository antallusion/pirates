// The deck fight (Boarding 2.0, server/src/game/boarding.ts): both crews, the round and its clock, what the last
// round did, the orders — the circle of four with what each beats, the special orders and the captain's own move
// bought with momentum — and the captains' duel with its sweeping blade. Keys 1–7 give the orders, Space strikes.

import { BASIC_TACTICS, CAPTAIN_MOVES, DUEL_EXCHANGES, FIRST_ROUND, ROUND_WINDOW, TACTICS } from '../../../shared/src/data/boarding.ts';
import type { BoardTactic } from '../../../shared/src/data/boarding.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { BoardFightView, BoardSideView, ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/boardfight.ts';
import { $, esc, icon } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);

/** Each order's own painting (icon.bt_*, docs/11 P5); the older art it stood in with until then, should it fail to load. */
const STAND_IN: Record<BoardTactic, string> = {
  volley: 'ab_last_volley', charge: 'ab_red_hook_boarding', grenades: 'ammo_incendiary', hold: 'mod_hull_plating',
  officers: 'ab_spotters_eye', colours: 'ab_bribe_signal', captain: 'ab_war_cry',
};
const orderIcon = (t: BoardTactic) => icon(`bt_${t}`, '', 'ico') || icon(STAND_IN[t], '', 'ico');
const ORDER: BoardTactic[] = [...BASIC_TACTICS, 'officers', 'colours', 'captain'];

const tName = (t: BoardTactic) => L(`t.${t}` as keyof typeof EN);
const moveOf = (s: BoardSideView) => (s.captain ? CAPTAIN_MOVES[s.captain] : null);

export class BoardFightPanel {
  private key = '';
  private view: BoardFightView | null = null;
  private send: (m: ClientMsg) => void;
  private now: () => number;
  constructor(send: (m: ClientMsg) => void, now: () => number) {
    this.send = send;
    this.now = now;
  }

  get open(): boolean {
    return this.view !== null;
  }

  render(v: BoardFightView | null): void {
    const el = $('board-fight');
    this.view = v;
    document.body.classList.toggle('boarding', !!v);
    if (!v) {
      if (this.key) {
        el.classList.add('hidden');
        el.innerHTML = '';
        this.key = '';
      }
      return;
    }
    const touch = document.body.classList.contains('touch');
    const key = `${touch}|${JSON.stringify({ ...v, ends: 0 })}`;
    if (key !== this.key) {
      this.key = key;
      el.classList.remove('hidden');
      el.innerHTML = this.html(v, touch);
      el.querySelectorAll<HTMLElement>('[data-bt]').forEach((b) => (b.onclick = () => this.order(b.dataset.bt as BoardTactic)));
      el.querySelector<HTMLElement>('[data-duel]')?.addEventListener('click', () => this.send({ t: 'board_duel', action: 'challenge' }));
      el.querySelector<HTMLElement>('[data-accept]')?.addEventListener('click', () => this.send({ t: 'board_duel', action: 'accept' }));
      el.querySelector<HTMLElement>('[data-decline]')?.addEventListener('click', () => this.send({ t: 'board_duel', action: 'decline' }));
      el.querySelector<HTMLElement>('[data-strike]')?.addEventListener('click', () => this.strike());
      el.querySelector<HTMLElement>('[data-cut]')?.addEventListener('click', () => this.send({ t: 'board_cut' }));
    }
    this.tick();
  }

  /** The clock of the round and the blade of the duel move every frame. */
  private tick(): void {
    const v = this.view;
    if (!v) return;
    const el = $('board-fight');
    const now = this.now();
    const bar = el.querySelector<HTMLElement>('.bf-timer > i');
    if (bar) {
      const total = v.round === 0 ? FIRST_ROUND : ROUND_WINDOW;
      bar.style.width = `${Math.max(0, Math.min(1, (v.ends - now) / total)) * 100}%`;
    }
    const d = v.duel;
    const blade = el.querySelector<HTMLElement>('.bf-blade');
    if (d && blade) blade.style.left = `${Math.max(0, Math.min(1, (now - d.opens) / (d.closes - d.opens))) * 100}%`;
    const left = el.querySelector<HTMLElement>('.bf-answer');
    if (d && left) left.textContent = `${Math.max(0, Math.ceil(d.answerBy - now))}`;
  }

  private order(t: BoardTactic): void {
    const v = this.view;
    if (!v || v.duel || v.you.momentum < TACTICS[t].cost) return;
    this.send({ t: 'board_tactic', tactic: t });
  }

  private strike(): void {
    const d = this.view?.duel;
    if (!d || d.state !== 'running' || d.struck) return;
    this.send({ t: 'board_duel', action: 'strike', at: this.now() });
  }

  /** Keys while the fight is on: 1–7 the orders, Space the blade. True when the key was taken. */
  onKey(e: KeyboardEvent): boolean {
    const v = this.view;
    if (!v || e.ctrlKey || e.metaKey || e.altKey) return false;
    if (v.duel?.state === 'running' && (e.key === ' ' || e.code === 'Space')) {
      this.strike();
      return true;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= ORDER.length && !v.duel) {
      this.order(ORDER[n - 1]);
      return true;
    }
    return false;
  }

  private side(s: BoardSideView, who: 'you' | 'foe'): string {
    const url = s.captain ? assetUrl(CAPTAINS[s.captain].portrait) : null;
    const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
    return `<div class="bf-side ${who}">
      <div class="bf-face" style="background-image:${url ? `url('${url}')` : 'none'}"></div>
      <div class="bf-meters">
        <b class="bf-name">${esc(who === 'you' ? L('you') : placeName(s.name))}</b>
        <div class="bf-meter crew" title="${esc(L('crew'))}"><span>${esc(L('crew'))}</span><i><u style="width:${pct(s.crew / Math.max(1, s.crewStart))}"></u></i><em>${s.crew}</em></div>
        <div class="bf-meter nerve" title="${esc(L('morale'))}"><span>${esc(L('morale'))}</span><i><u style="width:${pct(s.morale / 100)}"></u></i><em>${s.morale}</em></div>
        <div class="bf-meter mom" title="${esc(L('momentum'))}"><span>${esc(L('momentum'))}</span><i><u style="width:${pct(s.momentum / 100)}"></u><s style="left:40%"></s><s style="left:70%"></s></i><em>${s.momentum}</em></div>
      </div></div>`;
  }

  private html(v: BoardFightView, touch: boolean): string {
    const head = `<div class="bf-head">${this.side(v.you, 'you')}
      <div class="bf-mid"><div class="bf-title">${esc(v.attacker ? L('title') : L('titleDef'))}</div><div class="bf-round">${esc(v.round === 0 ? L('first') : L('round', { n: v.round + 1, max: v.maxRounds }))}</div><div class="bf-timer"><i></i></div></div>
      ${this.side(v.foe, 'foe')}</div>`;
    const last = v.last
      ? `<div class="bf-last ${v.last.edge > 0 ? 'win' : v.last.edge < 0 ? 'lose' : 'even'}">${esc(L(v.last.edge > 0 ? 'last.win' : v.last.edge < 0 ? 'last.lose' : 'last.even', { you: this.label(v.last.you, v.you), foe: this.label(v.last.foe, v.foe) }))} <span class="bf-toll">${esc(L('last.toll', { killed: v.last.killed, lost: v.last.lost }))}</span></div>`
      : '';
    const log = v.log.length ? `<div class="bf-log">${v.log.slice(-3).map((l) => `<div class="${l.you ? 'you' : 'foe'}">${esc(this.logLine(l, v))}</div>`).join('')}</div>` : '';
    // The fight is fought on the boarding painting (bg.boarding) under a dark wash; the plain panel when it is missing.
    const deck = assetUrl('bg.boarding');
    const bg = deck ? ` style="--bf-deck:url('${deck}')"` : '';
    return `<div class="bf-panel panel${v.duel ? ' dueling' : ''}${deck ? ' decked' : ''}"${bg}><div class="bf-info">${head}<div class="bf-news">${last}${log}</div></div><div class="bf-act">${v.duel ? this.duel(v, touch) : this.orders(v, touch)}</div></div>`;
  }

  private label(t: BoardTactic, s: BoardSideView): string {
    const m = moveOf(s);
    return t === 'captain' && m ? L(`m.${m.id}` as keyof typeof EN) : tName(t);
  }

  private logLine(l: BoardFightView['log'][number], v: BoardFightView): string {
    const who = l.you ? 'you' : 'foe';
    if (l.code.startsWith('move.')) return L(`log.move.${who}`, { name: L(`m.${l.code.slice(5)}` as keyof typeof EN) });
    const k = `log.${l.code}.${who}`;
    void v;
    return k in EN ? L(k as keyof typeof EN) : '';
  }

  private orders(v: BoardFightView, touch: boolean): string {
    const kbd = (i: number) => (touch ? '' : `<kbd>${i}</kbd>`);
    const basic = BASIC_TACTICS.map((t, i) => {
      const beats = TACTICS[t].beats;
      return `<button class="btn bf-order${v.choice === t ? ' on' : ''}" data-bt="${t}" title="${esc(L(`d.${t}` as keyof typeof EN))}">${orderIcon(t)}<span class="bf-on"><b>${esc(tName(t))}</b><small>${beats ? esc(L('beats', { name: L(`s.${beats}` as keyof typeof EN) })) : ''}</small></span>${kbd(i + 1)}</button>`;
    }).join('');
    const move = moveOf(v.you);
    const special = (['officers', 'colours', 'captain'] as const).map((t, i) => {
      const cost = TACTICS[t].cost;
      const name = t === 'captain' && move ? L(`m.${move.id}` as keyof typeof EN) : tName(t);
      const desc = t === 'captain' && move ? L(`md.${move.id}` as keyof typeof EN) : L(`d.${t}` as keyof typeof EN);
      return `<button class="btn bf-order special${v.choice === t ? ' on' : ''}" data-bt="${t}" ${v.you.momentum < cost ? 'disabled' : ''} title="${esc(desc)}">${orderIcon(t)}<span class="bf-on"><b>${esc(name)}</b><small>${esc(L('cost', { n: cost }))}</small></span>${kbd(i + 5)}</button>`;
    }).join('');
    const status = `<div class="bf-status${v.choice ? ' given' : ''}">${esc(v.choice ? L('ordered', { name: this.label(v.choice, v.you) }) : L('noOrder'))}</div>`;
    const foot = `<div class="bf-foot"><button class="btn" data-duel ${v.canDuel ? '' : 'disabled'} title="${esc(L('duelHint'))}">${esc(L('duel'))}</button>${v.canCut ? `<button class="btn btn-danger" data-cut>${esc(v.attacker ? L('fallBack') : L('cut'))}</button>` : ''}</div>`;
    return `${status}<div class="bf-orders">${basic}</div><div class="bf-orders specials">${special}</div>${foot}`;
  }

  private duel(v: BoardFightView, touch: boolean): string {
    const d = v.duel!;
    const title = `<div class="bf-duel-title">${esc(L('duel.title'))}</div>`;
    if (d.state === 'offered') {
      return d.by === 'foe'
        ? `<div class="bf-duel">${title}<p>${esc(L('duel.offeredFoe'))} <b class="bf-answer"></b></p><div class="bf-foot"><button class="btn" data-decline>${esc(L('duel.decline'))}</button><button class="btn btn-primary" data-accept>${esc(L('duel.accept'))}</button></div></div>`
        : `<div class="bf-duel">${title}<p>${esc(L('duel.offeredYou'))}</p></div>`;
    }
    const pips = (xs: number[]) => Array.from({ length: DUEL_EXCHANGES }, (_, i) => `<i class="${i < xs.length ? (xs[i] >= 0.7 ? 'hit' : xs[i] > 0 ? 'graze' : 'miss') : ''}"></i>`).join('');
    const score = `<div class="bf-pips"><span>${esc(L('you'))}</span>${pips(d.you)}<span class="sep"></span>${pips(d.foe)}<span>${esc(placeName(v.foe.name))}</span></div>`;
    if (d.state === 'done') return `<div class="bf-duel">${title}${score}<p class="bf-duel-end ${d.winner === 'you' ? 'win' : 'lose'}">${esc(d.winner === 'you' ? L('duel.won') : L('duel.lost'))}</p></div>`;
    const sweep = `<div class="bf-sweep"><div class="bf-sweet" style="left:${(d.sweet * 100).toFixed(1)}%"></div><div class="bf-blade"></div></div>`;
    return `<div class="bf-duel">${title}<div class="bf-round">${esc(L('duel.exchange', { n: Math.min(DUEL_EXCHANGES, d.exchange + 1), max: DUEL_EXCHANGES }))}</div>${sweep}${score}
      <button class="btn btn-primary bf-strike" data-strike ${d.struck ? 'disabled' : ''}>${esc(d.struck ? L('duel.struck') : L('duel.strike'))}</button><div class="bf-hint">${esc(touch ? L('duel.hint') : L('duel.hintKey'))}</div></div>`;
  }
}
