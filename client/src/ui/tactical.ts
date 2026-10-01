// The turn-based boarding battle (docs/16 P4, «like Heroes III»): the two decks drawn on a canvas — planks, rails,
// the masts, guns, barrels and crates, the planks across the water where the grapples bit — the stacks as tokens
// with their painted icons, counts and health; the lit reach of the stack whose turn it is; the order of the round;
// the captains on the side panel with their orders; the feed; the end. The server decides everything: a tap sends
// the order (a second tap on a lit hex moves there; a tap on a foe strikes or fires), a long press shows a stack.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { OFFICER_DEFS } from '../../../shared/src/data/crew.ts';
import { TAC_BLOCKING, TAC_H, TAC_SPELLS, TAC_W, hexIndex, hexNeighbors, hexX, hexY } from '../../../shared/src/data/tactical.ts';
import type { TacCell, TacSpellId } from '../../../shared/src/data/tactical.ts';
import type { ClientMsg, TacAction, TacEvent, TacStackView, TacView } from '../../../shared/src/protocol.ts';
import { assetUrl, sprite } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { ORDERS, PRIMS, PRIM_ICON, PRIM_NAMES } from '../../../shared/src/data/hero.ts';
import { personName } from '../lang/names.ts';
import { EN, RU } from '../lang/ui/tactical.ts';
import { $, esc, icon } from './dom.ts';
import { placeName } from './maps.ts';
import { specialName, specialNote, unitArt, unitName, unitNote } from './army.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';

const L = dict(EN, RU);
/** An order's name and words, from the order book (docs/17 H2) — every page of it, old and new. */
const spName = (id: TacSpellId) => (ORDERS[id]?.name ?? [id, id])[lang() === 'ru' ? 1 : 0];
const spText = (id: TacSpellId) => (ORDERS[id]?.text ?? [id, id])[lang() === 'ru' ? 1 : 0];
type K = keyof typeof EN;

const SQ3 = Math.sqrt(3);
const YOU = '#7fb0d0';
const FOE = '#d2473a';

interface Float {
  text: string;
  x: number;
  y: number;
  t0: number;
  color: string;
  big?: boolean;
}
interface Burst {
  id: string;
  x: number;
  y: number;
  t0: number;
  size: number;
}

/** The stack's painted face (docs/17 H1): its kind of man's portrait; an officer's own party his face or post. */
function stackArt(s: TacStackView): string {
  if (s.officer && s.kind === 'officer') return s.officer.unique && sprite(`portrait.officer_${s.officer.unique}`) ? `portrait.officer_${s.officer.unique}` : `icon.role_${s.officer.role}`;
  return s.unit ? unitArt(s.unit) : s.kind === 'hands' ? 'icon.prof_sailor' : s.kind === 'marines' ? 'icon.prof_marine' : 'icon.prof_gunner';
}

function stackName(s: TacStackView): string {
  if (s.officer && s.kind === 'officer') return L('k.officer', { role: OFFICER_DEFS[s.officer.role].name });
  return s.unit ? unitName(s.unit) : L(`k.${s.kind}` as K);
}

/** The wood of a deck, drawn once: planks along the ship, seams, grain and nails. */
function plankTexture(dark: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d')!;
  const tones = dark ? ['#4a3624', '#503a26', '#453220', '#4d3823'] : ['#6b4b2c', '#72502f', '#664729', '#6e4d2d'];
  const ph = 12;
  for (let r = 0; r < 96 / ph; r++) {
    g.fillStyle = tones[r % tones.length];
    g.fillRect(0, r * ph, 96, ph);
    // Grain.
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const y = r * ph + 3 + k * 3 + ((r * 7 + k) % 2);
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(30, y + 1.2, 60, y - 1.2, 96, y + 0.5);
      g.stroke();
    }
    // Seams between planks and the butt joints, staggered.
    g.fillStyle = 'rgba(18,10,4,0.75)';
    g.fillRect(0, r * ph + ph - 1, 96, 1);
    const off = (r * 37) % 96;
    g.fillRect(off, r * ph, 1, ph);
    g.fillRect((off + 48) % 96, r * ph, 1, ph);
    g.fillStyle = 'rgba(210,190,150,0.35)';
    for (const x of [off + 3, (off + 51) % 96]) {
      g.fillRect(x, r * ph + 3, 1.5, 1.5);
      g.fillRect(x, r * ph + ph - 5, 1.5, 1.5);
    }
  }
  // A light wash of wear.
  const grd = g.createRadialGradient(48, 48, 10, 48, 48, 70);
  grd.addColorStop(0, 'rgba(255,230,190,0.05)');
  grd.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 96, 96);
  return c;
}

export class TacticalPanel {
  private view: TacView | null = null;
  private send: (m: ClientMsg) => void;
  private now: () => number;
  private el: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  /** The hex's width, the stage, the board's corner, and its turn: 0 as the decks lie side by side, 1 upright with
   *  the boarders' deck below, −1 upright with the defenders' below (a phone held upright: your deck at the thumb). */
  private size = { w: 0, cw: 0, ch: 0, ox: 0, oy: 0, dpr: 1, rot: 0 as 0 | 1 | -1, bw: 0, bh: 0 };
  private key = '';
  private preview: number | null = null;
  private targeting: TacSpellId | null = null;
  /** The order book open over the field (docs/17 H2: more pages than the panel holds). */
  private bookOpen = false;
  private info: number | null = null;
  private hover: number | null = null;
  private strikeArmed = 0;
  private ransomArmed = 0;
  private seen = 0;
  private floats: Float[] = [];
  private bursts: Burst[] = [];
  private pos = new Map<number, { x: number; y: number; fx: number; fy: number; t0: number }>();
  private press: { x: number; y: number; t: number; timer: number } | null = null;
  private planks: [HTMLCanvasElement, HTMLCanvasElement] | null = null;
  /** Every stack's name as last seen (the fallen are named in the feed too). */
  private names = new Map<number, string>();

  constructor(send: (m: ClientMsg) => void, now: () => number) {
    this.send = send;
    this.now = now;
  }

  get open(): boolean {
    return this.view !== null;
  }

  render(v: TacView | null): void {
    const root = $('board-tac');
    const was = this.view;
    this.view = v;
    document.body.classList.toggle('tac', !!v);
    document.body.classList.toggle('tac-over', !!v?.over);
    if (!v) {
      if (this.el) {
        root.classList.add('hidden');
        root.innerHTML = '';
        this.el = this.canvas = null;
        this.key = '';
        this.pos.clear();
        this.floats = [];
        this.bursts = [];
        this.seen = 0;
        this.preview = this.targeting = this.info = null;
      }
      return;
    }
    if (!this.el) this.build(root);
    if (v !== was) this.onView(v, was);
    this.tick();
    this.draw();
  }

  private build(root: HTMLElement): void {
    root.classList.remove('hidden');
    root.innerHTML = `<div class="tb-root">
      <div class="tb-hero you"></div><div class="tb-mid"></div><div class="tb-hero foe"></div>
      <div class="tb-queue" aria-label="${esc(L('order.label'))}"></div>
      <div class="tb-stage"><canvas class="tb-board"></canvas><div class="tb-card hidden"></div><div class="tb-banner hidden"></div><div class="tb-book hidden"></div></div>
      <div class="tb-feed"><div class="tb-hint"></div><div class="tb-lines"></div></div>
      <div class="tb-spells"></div>
      <div class="tb-acts"></div>
    </div>`;
    this.el = root.querySelector('.tb-root');
    this.canvas = root.querySelector('canvas');
    const deck = assetUrl('bg.boarding');
    if (deck) this.el!.style.setProperty('--tb-deck', `url('${deck}')`);
    const c = this.canvas!;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', () => this.cancelPress());
    c.addEventListener('pointerleave', () => {
      this.hover = null;
      this.cancelPress();
    });
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const h = this.hexAt(e);
      const s = h !== null ? this.stackAt(h) : undefined;
      this.showInfo(s?.id ?? null);
    });
    root.querySelector('.tb-card')!.addEventListener('click', () => this.showInfo(null));
  }

  // ------------------------------------------------------------------ a new view from the server

  private onView(v: TacView, was: TacView | null): void {
    // What happened since the last view: numbers over the stacks, bursts of powder and smoke.
    const fresh = v.log.filter((e) => e.i > this.seen);
    if (!was) this.seen = v.log.length ? v.log[v.log.length - 1].i : 0;
    else for (const e of fresh) this.mark(e, v, was);
    if (fresh.length) this.seen = Math.max(this.seen, ...fresh.map((e) => e.i));
    for (const s of v.stacks) this.names.set(s.id, `${stackName(s)} (${L(s.side === v.you ? 'ours' : 'theirs')})`);
    // Stacks that moved slide to their new hex.
    const t = performance.now();
    for (const s of v.stacks) {
      const c = this.center(s.hex);
      const p = this.pos.get(s.id);
      if (!p) this.pos.set(s.id, { x: c.x, y: c.y, fx: c.x, fy: c.y, t0: 0 });
      else if (Math.abs(p.x - c.x) > 0.5 || Math.abs(p.y - c.y) > 0.5) {
        const cur = this.at(p, t);
        this.pos.set(s.id, { x: c.x, y: c.y, fx: cur.x, fy: cur.y, t0: t });
      }
    }
    if (!v.mine || v.active !== was?.active) {
      this.preview = null;
      if (!v.mine) this.targeting = null;
    }
    if (this.preview !== null && !v.reach.includes(this.preview)) this.preview = null;
    this.dom(v);
  }

  private mark(e: TacEvent, v: TacView, was: TacView): void {
    const t = performance.now();
    const hexOf = (id?: number) => (id === undefined ? undefined : (v.stacks.find((s) => s.id === id) ?? was.stacks.find((s) => s.id === id))?.hex);
    const at = (hex?: number) => (hex === undefined ? null : this.center(hex));
    const w = this.size.w || 30;
    if (e.k === 'hit' || e.k === 'shot' || e.k === 'ret') {
      const c = at(e.hex ?? hexOf(e.t));
      if (c) this.floats.push({ text: `−${e.dmg}${e.kills ? ` †${e.kills}` : ''}`, x: c.x, y: c.y - w * 0.2, t0: t, color: '#f3d7a0' });
      if (e.k === 'shot' && e.id === 'blast') {
        if (c) this.bursts.push({ id: 'part.explosion', x: c.x, y: c.y, t0: t, size: w * 1.4 });
      } else if (e.k === 'shot') {
        const s = at(hexOf(e.s));
        if (s) this.bursts.push({ id: 'part.muzzle', x: s.x, y: s.y, t0: t, size: w * 0.9 });
        if (c) this.bursts.push({ id: 'part.smoke', x: c.x, y: c.y, t0: t, size: w * 0.8 });
      } else if (c) this.bursts.push({ id: 'part.splinters', x: c.x, y: c.y, t0: t, size: w * 0.8 });
    } else if (e.k === 'luck' || e.k === 'morale' || e.k === 'fear') {
      const c = at(hexOf(e.s));
      if (c) this.floats.push({ text: e.k === 'fear' ? (e.id ? L('morale') + ' −' : L('fear.float')) : L(e.k === 'luck' ? 'luck' : 'morale') + ' +', x: c.x, y: c.y - w * 0.55, t0: t, color: e.k === 'fear' ? '#d06a5e' : '#e0b862' });
    } else if (e.k === 'spell') {
      const c = at(e.hex ?? hexOf(e.t));
      if (e.id === 'grenades' && c) {
        this.bursts.push({ id: 'part.explosion', x: c.x, y: c.y, t0: t, size: w * 2.4 });
      } else if (c) this.bursts.push({ id: 'part.muzzle', x: c.x, y: c.y, t0: t, size: w * 1.6 });
      else {
        // A whole-deck order: smoke over her deck, or a ring over one's own.
        const foe = e.side !== v.you;
        const onFoe = e.id === 'smoke_and_knives' || e.id === 'call_of_the_deep' ? !foe : foe;
        const mine = v.stacks.filter((s) => (s.side === v.you) !== onFoe);
        for (const s of mine) {
          const cc = this.center(s.hex);
          this.bursts.push({ id: e.id === 'call_of_the_deep' ? 'part.splash' : 'part.smoke', x: cc.x, y: cc.y, t0: t + Math.random() * 200, size: w * 1.3 });
        }
      }
      this.floats.push({ text: spName(e.id as TacSpellId), x: this.size.cw / 2, y: this.size.ch * 0.18, t0: t, color: e.side === v.you ? YOU : FOE, big: true });
    } else if (e.k === 'order') {
      const c = at(hexOf(e.s));
      if (c) this.floats.push({ text: L(`o.${e.id}` as K), x: c.x, y: c.y - w * 0.6, t0: t, color: '#e0b862' });
    } else if (e.k === 'burn') {
      const c = at(e.hex ?? hexOf(e.s));
      if (c) {
        this.floats.push({ text: `−${e.dmg}${e.kills ? ` †${e.kills}` : ''}`, x: c.x, y: c.y - w * 0.2, t0: t, color: '#ff9a4a' });
        this.bursts.push({ id: 'part.explosion', x: c.x, y: c.y, t0: t, size: w * 0.9 });
      }
    } else if (e.k === 'die') {
      const c = at(e.hex);
      if (c) this.bursts.push({ id: 'part.smoke', x: c.x, y: c.y, t0: t, size: w * 1.2 });
    }
  }

  // ------------------------------------------------------------------ the panels

  private dom(v: TacView): void {
    const el = this.el!;
    const act = v.stacks.find((s) => s.id === v.active);
    const key = JSON.stringify([v.round, v.active, v.mine, v.heroes, v.order, v.over, v.log.slice(-3).map((e) => e.i), this.targeting, this.bookOpen, this.strikeArmed > performance.now(), this.ransomArmed > performance.now(), v.stacks.map((s) => [s.id, s.count, s.shots]), v.canCut, v.canStrike, v.ransom, v.result]);
    if (key === this.key) return;
    this.key = key;
    const hero = (x: 0 | 1) => {
      const h = v.heroes[x];
      const url = h.captain ? assetUrl(CAPTAINS[h.captain].portrait) : null;
      const pips = (n: number, cls: string) => `<span class="tb-pip ${cls}${n > 0 ? ' up' : n < 0 ? ' down' : ''}" title="${esc(L(cls === 'm' ? 'morale' : 'luck'))}">${cls === 'm' ? '⚑' : '✦'}${n > 0 ? `+${n}` : n}</span>`;
      const mine = x === v.you;
      // The hero beside the field (docs/17 H2): her four primaries and her will.
      const prim = h.prim ? `<span class="tb-prims">${PRIMS.map((p) => `<span class="tb-prim" title="${esc(PRIM_NAMES[p][lang() === 'ru' ? 1 : 0])}">${icon(PRIM_ICON[p], '', 'ico-xs')}${p === 'will' ? `${h.mana ?? 0}/${h.manaMax ?? 0}` : h.prim![p]}</span>`).join('')}</span>` : '';
      return `<div class="tb-face" style="background-image:${url ? `url('${url}')` : 'none'}"></div>
        <div class="tb-who"><b>${esc(personName(h.name))}</b><small>${esc(placeName(h.ship))}</small>${prim}<span class="tb-pips"><span class="tb-pip tb-men">${esc(L('men', { n: h.men ?? 0, m: h.menStart ?? 0 }))}</span>${pips(h.morale, 'm')}${pips(h.luck, 'l')}${h.auto && mine ? `<span class="tb-auto">${esc(L('autoTurn'))}</span>` : ''}</span></div>`;
    };
    el.querySelector('.tb-hero.you')!.innerHTML = hero(v.you);
    el.querySelector('.tb-hero.foe')!.innerHTML = hero((1 - v.you) as 0 | 1);
    const turn = v.over ? '' : v.mine ? L('yourTurn') : act && act.side === v.you ? L('autoTurn') : L('theirTurn');
    el.querySelector('.tb-mid')!.innerHTML = `<div class="tb-round">${esc(L('round', { n: v.round }))}</div><div class="tb-turn${v.mine ? ' mine' : ''}">${act ? `<span class="tb-dot ${act.side === v.you ? 'you' : 'foe'}"></span>` : ''}${esc(turn)} <em class="tb-secs"></em></div><div class="tb-timer"><i></i></div>`;
    // The order of the round, then the next round's first few.
    const chip = (id: number, next: boolean) => {
      const s = v.stacks.find((x) => x.id === id);
      if (!s) return '';
      return `<button class="tb-q ${s.side === v.you ? 'you' : 'foe'}${id === v.active && !next ? ' on' : ''}${next ? ' next' : ''}" data-info="${s.id}" title="${esc(stackName(s))}">${icon(stackArt(s), '', 'ico')}<b>${s.count}</b></button>`;
    };
    el.querySelector('.tb-queue')!.innerHTML = `${v.order.map((id) => chip(id, false)).join('')}<span class="tb-qsep"></span>${v.next.map((id) => chip(id, true)).join('')}`;
    el.querySelectorAll<HTMLElement>('.tb-q').forEach((b) => (b.onclick = () => this.showInfo(Number(b.dataset.info))));
    // The feed: the last three things, in words.
    const words = v.log.filter((e) => e.k !== 'move').slice(-3).map((e) => this.words(e, v)).filter(Boolean);
    el.querySelector('.tb-lines')!.innerHTML = words.map((w, i) => `<div class="${i === words.length - 1 ? 'new' : ''}">${esc(w)}</div>`).join('');
    // The captain's orders.
    const me = v.heroes[v.you];
    // The book's pages (docs/17 H2): each order's will beside it; the will left on the book's spine.
    const will = me.mana !== undefined ? `<div class="tb-will" title="${esc(L('will'))}">${icon('icon.ab_brine_mend', '', 'ico-sm')}<b>${me.mana}</b><small>/${me.manaMax ?? 0}</small></div>` : '';
    const page = (sp: (typeof me.spells)[number]) => {
      const wait = Math.max(0, sp.ready - v.round);
      const poor = sp.cost !== undefined && me.mana !== undefined && me.mana < sp.cost;
      const off = !v.mine || me.cast || wait > 0 || poor;
      return `<button class="btn tb-spell${this.targeting === sp.id ? ' on' : ''}${poor ? ' poor' : ''}" data-spell="${sp.id}" ${off ? 'disabled' : ''} title="${esc(spText(sp.id))}">${icon(TAC_SPELLS[sp.id].icon, '', 'ico')}<span><b>${esc(spName(sp.id))}${sp.cost !== undefined ? ` <em class="tb-cost">${sp.cost}</em>` : ''}</b><small>${wait > 0 ? esc(L('ready.in', { n: wait })) : poor ? esc(L('noWill')) : esc(spText(sp.id))}</small></span></button>`;
    };
    // Four pages on the panel (keys 1–4); the rest in the book, opened over the field as in HoMM3.
    const more = me.spells.length > 4;
    el.querySelector('.tb-spells')!.innerHTML = will + me.spells.slice(0, 4).map(page).join('') + (more ? `<button class="btn tb-bookbtn${this.bookOpen ? ' on' : ''}" data-book>${icon('icon.bt_captain', '', 'ico')}<span><b>${esc(L('book'))}</b><small>${esc(L('book.n', { n: me.spells.length }))}</small></span></button>` : '');
    const book = el.querySelector<HTMLElement>('.tb-book')!;
    book.classList.toggle('hidden', !(more && this.bookOpen));
    book.innerHTML = more && this.bookOpen ? `<div class="tb-book-head"><b>${esc(L('book'))}</b><button class="btn btn-small" data-bookclose>${esc(L('close'))}</button></div><div class="tb-book-grid">${[...me.spells].sort((a, b) => (ORDERS[a.id]?.school ?? '').localeCompare(ORDERS[b.id]?.school ?? '') || (ORDERS[a.id]?.level ?? 0) - (ORDERS[b.id]?.level ?? 0)).map(page).join('')}</div>` : '';
    el.querySelectorAll<HTMLElement>('[data-spell]').forEach((b) => (b.onclick = () => {
      this.bookOpen = false;
      this.spell(b.dataset.spell as TacSpellId);
    }));
    el.querySelector<HTMLElement>('[data-book]')?.addEventListener('click', () => {
      this.bookOpen = !this.bookOpen;
      this.key = '';
      this.dom(v);
    });
    el.querySelector<HTMLElement>('[data-bookclose]')?.addEventListener('click', () => {
      this.bookOpen = false;
      this.key = '';
      this.dom(v);
    });
    // The stack's own orders and the fight's.
    const officer = v.mine && act?.officer?.ready ? act.officer : null;
    const armed = this.strikeArmed > performance.now();
    el.querySelector('.tb-acts')!.innerHTML = [
      `<button class="btn" data-a="wait" ${!v.mine || act?.waited ? 'disabled' : ''}>${icon('icon.bt_hold', '', 'ico-sm')}${esc(L('wait'))}</button>`,
      `<button class="btn" data-a="defend" ${!v.mine ? 'disabled' : ''}>${icon('icon.mod_hull_plating', '', 'ico-sm')}${esc(L('defend'))}</button>`,
      officer ? `<button class="btn btn-primary" data-a="order" title="${esc(L(`od.${officer.order}` as K))}">${icon(`icon.role_${officer.role}`, '', 'ico-sm')}${esc(L(`o.${officer.order}` as K))}</button>` : '',
      `<button class="btn${me.auto ? ' on' : ''}" data-a="auto">${esc(me.auto ? L('autoOff') : L('auto'))}</button>`,
      `<button class="btn" data-a="quick" ${v.over ? 'disabled' : ''}>${esc(L('quick'))}</button>`,
      v.canCut && !v.over ? `<button class="btn btn-danger" data-a="cut">${esc(v.you === 0 ? L('fallBack') : L('cut'))}</button>` : '',
      v.ransom && !v.over ? `<button class="btn${this.ransomArmed > performance.now() ? ' on' : ''}" data-a="ransom" title="${esc(L('ransomTip'))}">${esc(this.ransomArmed > performance.now() ? L('ransomSure', { n: v.ransom }) : L('ransom', { n: v.ransom }))}</button>` : '',
      v.canStrike && !v.over ? `<button class="btn btn-danger${armed ? ' on' : ''}" data-a="surrender">${esc(armed ? L('strikeSure') : L('strike'))}</button>` : '',
    ].join('');
    el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => (b.onclick = () => this.button(b.dataset.a!)));
    // The end.
    const banner = el.querySelector<HTMLElement>('.tb-banner')!;
    banner.classList.toggle('hidden', !v.over);
    if (v.over) {
      const won = v.over.winner === v.you;
      const why = v.over.why === 'rout' ? (won ? 'why.rout' : 'why.routLost') : v.over.why === 'struck' ? (won ? 'why.struck' : 'why.struckYou') : v.over.why === 'ransom' ? (won ? 'why.ransomThem' : 'why.ransomYou') : 'why.rounds';
      banner.className = `tb-banner ${won ? 'won' : 'lost'}${v.result ? ' tb-result' : ''}`;
      // The reckoning (docs/17 H1): each side's losses by kind of man, what your captain learnt, the silver paid.
      const r = v.result;
      const faces = (xs: { u: UnitId; n: number }[]) => xs.length ? xs.map((x) => `<span class="tb-rs" title="${esc(unitName(x.u))}">${icon(unitArt(x.u), '', 'tb-rs-ico')}<i>−${x.n}</i></span>`).join('') : `<em class="muted">${esc(L('res.none'))}</em>`;
      banner.innerHTML = `<b>${esc(L(won ? 'won' : 'lost'))}</b><span>${esc(L(why as K))}</span>${r ? `<div class="tb-res"><div><small>${esc(L('res.lost'))}</small><div class="tb-rs-row">${faces(r.lost)}</div></div><div><small>${esc(L('res.killed'))}</small><div class="tb-rs-row">${faces(r.killed)}</div></div>${r.xp ? `<div class="tb-xp">${esc(L('res.xp', { n: r.xp }))}</div>` : ''}${r.paid ? `<div class="tb-xp">${esc(L('res.paid', { n: r.paid }))}</div>` : ''}</div>` : ''}`;
    }
    this.hint(v);
    if (this.info !== null) this.showInfo(this.info);
  }

  private words(e: TacEvent, v: TacView): string {
    const name = (id?: number) => (id !== undefined ? this.names.get(id) : undefined) ?? '…';
    switch (e.k) {
      case 'hit':
      case 'shot':
      case 'ret':
        return L(`log.${e.k}`, { a: name(e.s), b: name(e.t), dmg: e.dmg ?? 0, kills: e.kills ?? 0 });
      case 'die':
        return L('log.die', { a: name(e.s) });
      case 'spell':
        return L('log.spell', { side: L(e.side === v.you ? 'side.you' : 'side.foe'), name: spName(e.id as TacSpellId), kills: e.kills ?? 0 });
      case 'order':
        return L('log.order', { a: name(e.s), name: L(`o.${e.id}` as K) });
      case 'round':
        return L('log.round', { n: e.n ?? 0 });
      case 'burn':
        return L('log.burn', { a: name(e.s), dmg: e.dmg ?? 0, kills: e.kills ?? 0 });
      case 'fear':
        return L(e.id === 'terror' ? 'log.terror' : e.id === 'dread' ? 'log.dread' : 'log.fear', { a: name(e.s) });
      case 'wait':
      case 'defend':
      case 'morale':
      case 'luck':
      case 'timeout':
        return L(`log.${e.k}`, { a: name(e.s) });
      default:
        return '';
    }
  }

  private hint(v: TacView): void {
    const h = this.el!.querySelector('.tb-hint')!;
    const act = v.stacks.find((s) => s.id === v.active);
    const text = v.over ? '' : !v.mine ? (act && act.side !== v.you ? L('hint.wait') : '') : this.targeting ? L('hint.target') : this.preview !== null ? L('hint.again') : v.shoot.length ? L('hint.shoot') : L('hint.move');
    h.textContent = text;
    h.classList.toggle('hidden', !text);
  }

  /** The stack's card: what it is, its numbers, its officer. */
  private showInfo(id: number | null): void {
    this.info = id;
    const card = this.el?.querySelector<HTMLElement>('.tb-card');
    const v = this.view;
    if (!card || !v) return;
    const s = id !== null ? v.stacks.find((x) => x.id === id) : undefined;
    if (!s) {
      card.classList.add('hidden');
      this.info = null;
      return;
    }
    const row = (k: K, val: string) => `<div><span>${esc(L(k))}</span><b>${esc(val)}</b></div>`;
    const o = s.officer;
    const d = s.unit ? UNITS[s.unit] : null;
    card.className = `tb-card ${s.side === v.you ? 'you' : 'foe'}`;
    card.innerHTML = `<div class="tb-card-h">${icon(stackArt(s), '', 'ico-md')}<div><b>${esc(stackName(s))}</b><small>${d ? esc(L('tierOf', { n: d.tier })) : ''}${o ? `${d ? ' · ' : ''}${esc(personName(o.name))}` : ''}${s.marked ? ` · <span class="bad">${esc(L('marked'))}</span>` : ''}</small></div></div>
      <div class="tb-stats">${row('st.count', `${s.count} / ${s.start}`)}${row('st.atk', String(s.atk))}${row('st.def', String(s.def))}${row('st.dmg', `${s.dmg[0]}–${s.dmg[1]}`)}${row('st.hp', `${s.hp} / ${s.hpMax}`)}${row('st.speed', String(s.speed))}${row('st.init', String(s.init))}${s.shotsMax ? row('st.shots', `${s.shots} / ${s.shotsMax}`) : ''}${row('st.ret', L(s.ret ? 'st.retYes' : 'st.retNo'))}</div>
      ${s.defending ? `<p class="tb-def">${esc(L('st.def.on'))}</p>` : ''}
      ${s.sp?.length ? `<div class="tb-sps">${s.sp.map((x) => `<span class="chip" title="${esc(specialNote(x))}">${esc(specialName(x))}</span>`).join('')}</div>` : ''}
      <p class="muted">${esc(s.kind === 'officer' || !s.unit ? L(`kd.${s.kind}` as K) : unitNote(s.unit))}${o ? ` ${esc(L(`o.${o.order}` as K))}: ${esc(L(`od.${o.order}` as K))}` : ''}</p>`;
  }

  // ------------------------------------------------------------------ orders

  private order(a: TacAction): void {
    this.send({ t: 'tac', act: a });
  }

  private button(a: string): void {
    const v = this.view;
    if (!v) return;
    if (a === 'wait' || a === 'defend' || a === 'order') this.order({ a });
    else if (a === 'auto') this.order({ a: 'auto', on: !v.heroes[v.you].auto });
    else if (a === 'quick') this.order({ a: 'quick' });
    else if (a === 'cut') this.send({ t: 'board_cut' });
    else if (a === 'ransom') {
      if (this.ransomArmed > performance.now()) {
        this.ransomArmed = 0;
        this.order({ a: 'ransom' });
      } else {
        this.ransomArmed = performance.now() + 3000;
        this.key = '';
        this.dom(v);
      }
    } else if (a === 'surrender') {
      if (this.strikeArmed > performance.now()) {
        this.strikeArmed = 0;
        this.order({ a: 'surrender' });
      } else {
        this.strikeArmed = performance.now() + 3000;
        this.key = '';
        this.dom(v);
      }
    }
    this.preview = null;
  }

  private spell(id: TacSpellId): void {
    const v = this.view;
    if (!v?.mine) return;
    if (TAC_SPELLS[id].target === 'none') {
      this.targeting = null;
      this.order({ a: 'spell', id });
      return;
    }
    this.targeting = this.targeting === id ? null : id;
    this.key = '';
    this.dom(v);
  }

  /** Keys: W wait, D defend, O the officer's word, A auto-battle, 1–4 the captain's orders, Esc lets go. */
  onKey(e: KeyboardEvent): boolean {
    const v = this.view;
    if (!v || e.ctrlKey || e.metaKey || e.altKey) return false;
    const k = e.key.toLowerCase();
    const code = e.code;
    if (k === 'escape') {
      this.targeting = this.preview = null;
      this.showInfo(null);
      this.key = '';
      this.dom(v);
      return true;
    }
    if (code === 'KeyW') this.order({ a: 'wait' });
    else if (code === 'KeyD') this.order({ a: 'defend' });
    else if (code === 'KeyO') this.order({ a: 'order' });
    else if (code === 'KeyA') this.order({ a: 'auto', on: !v.heroes[v.you].auto });
    else if (/^Digit[1-4]$/.test(code)) {
      const sp = v.heroes[v.you].spells[Number(code.slice(5)) - 1];
      if (sp) this.spell(sp.id);
    } else return /^Key|^Digit|^Arrow|^Space/.test(code); // the helm and the guns wait while the decks fight
    return true;
  }

  // ------------------------------------------------------------------ the field under the finger

  private hexAt(e: { clientX: number; clientY: number }): number | null {
    const c = this.canvas;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best: number | null = null, bd = Infinity;
    for (let i = 0; i < TAC_W * TAC_H; i++) {
      const p = this.center(i);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return bd <= (this.size.w * 0.62) ** 2 ? best : null;
  }

  private stackAt(hex: number): TacStackView | undefined {
    return this.view?.stacks.find((s) => s.hex === hex);
  }

  private down(e: PointerEvent): void {
    this.cancelPress();
    const x = e.clientX, y = e.clientY;
    const timer = window.setTimeout(() => {
      // A long press: the stack's card.
      const h = this.hexAt({ clientX: x, clientY: y });
      const s = h !== null ? this.stackAt(h) : undefined;
      if (s) this.showInfo(s.id);
      this.press = null;
    }, 450);
    this.press = { x, y, t: performance.now(), timer };
  }

  private cancelPress(): void {
    if (this.press) clearTimeout(this.press.timer);
    this.press = null;
  }

  private move(e: PointerEvent): void {
    if (e.pointerType === 'mouse') this.hover = this.hexAt(e);
    if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 12) this.cancelPress();
  }

  private up(e: PointerEvent): void {
    if (!this.press) return;
    this.cancelPress();
    if (e.button === 2) return;
    this.tap(this.hexAt(e));
  }

  private tap(h: number | null): void {
    const v = this.view;
    if (!v) return;
    if (this.info !== null) this.showInfo(null);
    if (h === null) {
      this.preview = null;
      return this.refresh();
    }
    const s = this.stackAt(h);
    if (!v.mine || v.over) {
      if (s) this.showInfo(s.id);
      return;
    }
    if (s && s.side !== v.you) {
      if (this.targeting) {
        this.order({ a: 'spell', id: this.targeting, target: s.id });
        this.targeting = null;
      } else if (v.shoot.includes(s.id)) this.order({ a: 'shoot', target: s.id });
      else if (v.melee.includes(s.id)) {
        const from = this.preview !== null && hexNeighbors(s.hex).includes(this.preview) ? this.preview : undefined;
        this.order(from !== undefined ? { a: 'attack', target: s.id, from } : { a: 'attack', target: s.id });
      } else this.showInfo(s.id);
      this.preview = null;
      return this.refresh();
    }
    if (s) {
      this.showInfo(s.id);
      return;
    }
    if (v.reach.includes(h)) {
      if (this.preview === h) {
        this.preview = null;
        this.order({ a: 'move', to: h });
      } else this.preview = h;
      return this.refresh();
    }
    this.preview = null;
    this.refresh();
  }

  private refresh(): void {
    if (this.view) this.hint(this.view);
  }

  // ------------------------------------------------------------------ drawing

  /** A hex's centre on the board as it lies (the decks side by side, the corner at 0,0). */
  private lc(i: number): { x: number; y: number } {
    const { w } = this.size;
    const h = (w * 2) / SQ3;
    const x = hexX(i), y = hexY(i);
    return { x: w * (x + 0.5 + (y & 1 ? 0.5 : 0)), y: h / 2 + y * h * 0.75 };
  }

  /** The board's turn onto the screen: screen = (a·x + c·y + e, b·x + d·y + f). */
  private xf(): [number, number, number, number, number, number] {
    const { ox, oy, rot, bw, bh } = this.size;
    if (rot === 1) return [0, -1, 1, 0, ox, oy + bw];
    if (rot === -1) return [0, 1, -1, 0, ox + bh, oy];
    return [1, 0, 0, 1, ox, oy];
  }

  /** A hex's centre on the screen. */
  private center(i: number): { x: number; y: number } {
    const p = this.lc(i);
    const [a, b, c, d, e, f] = this.xf();
    return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f };
  }

  private turned(g: CanvasRenderingContext2D): void {
    const k = this.size.dpr;
    const [a, b, c, d, e, f] = this.xf();
    g.setTransform(a * k, b * k, c * k, d * k, e * k, f * k);
  }

  private at(p: { x: number; y: number; fx: number; fy: number; t0: number }, t: number): { x: number; y: number } {
    const k = Math.min(1, (t - p.t0) / 280);
    const e = k < 1 ? 1 - (1 - k) ** 3 : 1;
    return { x: p.fx + (p.x - p.fx) * e, y: p.fy + (p.y - p.fy) * e };
  }

  /** The canvas fits its stage: hexes as large as the room allows, the board centred. */
  private fit(): boolean {
    const c = this.canvas!;
    const stage = c.parentElement!;
    const cw = stage.clientWidth, ch = stage.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cw === this.size.cw && ch === this.size.ch && dpr === this.size.dpr) return false;
    // Side by side, or upright when that gives the bigger hexes (a phone held upright).
    const depth = ((TAC_H - 1) * 0.75 + 1) * (2 / SQ3);
    const flat = Math.min(cw / TAC_W, ch / depth), up = Math.min(cw / depth, ch / TAC_W);
    const rot: 0 | 1 | -1 = up > flat * 1.08 ? (this.view?.you === 1 ? -1 : 1) : 0;
    const w = Math.max(12, rot ? up : flat);
    const bw = w * TAC_W, bh = depth * w;
    const old = this.size;
    const sw = rot ? bh : bw, sh = rot ? bw : bh;
    this.size = { w, cw, ch, ox: (cw - sw) / 2, oy: (ch - sh) / 2, dpr, rot, bw, bh };
    c.width = Math.round(cw * dpr);
    c.height = Math.round(ch * dpr);
    c.style.width = `${cw}px`;
    c.style.height = `${ch}px`;
    this.bgKey = '';
    // Re-seat the tokens.
    if (old.w) for (const [id, p] of this.pos) {
      const s = this.view?.stacks.find((x) => x.id === id);
      if (s) {
        const cc = this.center(s.hex);
        this.pos.set(id, { x: cc.x, y: cc.y, fx: cc.x, fy: cc.y, t0: 0 });
      } else void p;
    }
    else if (this.view) for (const s of this.view.stacks) {
      const cc = this.center(s.hex);
      this.pos.set(s.id, { x: cc.x, y: cc.y, fx: cc.x, fy: cc.y, t0: 0 });
    }
    return true;
  }

  private hexPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = ((60 * k - 30) * Math.PI) / 180;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
  }

  /** The neighbour across each edge of a hex (E, SE, SW, W, NW, NE) — the corners k and k+1 bound edge k. */
  private across(i: number, edge: number): number | null {
    const x = hexX(i), y = hexY(i);
    const odd = y & 1;
    const d = [[1, 0], odd ? [1, 1] : [0, 1], odd ? [0, 1] : [-1, 1], [-1, 0], odd ? [0, -1] : [-1, -1], odd ? [1, -1] : [0, -1]][edge];
    const nx = x + d[0], ny = y + d[1];
    return nx >= 0 && ny >= 0 && nx < TAC_W && ny < TAC_H ? hexIndex(nx, ny) : null;
  }

  private background(v: TacView): HTMLCanvasElement {
    const key = `${v.cells}|${this.size.cw}|${this.size.ch}|${this.size.dpr}|${v.you}|${this.size.rot}`;
    if (this.bg && key === this.bgKey) return this.bg;
    this.bgKey = key;
    const { cw, ch, dpr, w } = this.size;
    const c = (this.bg ??= document.createElement('canvas'));
    c.width = Math.round(cw * dpr);
    c.height = Math.round(ch * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    this.turned(g);
    this.planks ??= [plankTexture(false), plankTexture(true)];
    const r = w / SQ3; // the hex's corner radius
    const cells = v.cells;
    const deck = (i: number | null) => i !== null && cells[i] !== '~' && cells[i] !== '#' && cells[i] !== '=';
    // The sea between and around the hulls.
    const sea = g.createLinearGradient(0, 0, 0, this.size.bh);
    sea.addColorStop(0, '#0b1d22');
    sea.addColorStop(1, '#07141a');
    g.fillStyle = sea;
    const b0 = this.lc(0), b1 = this.lc(TAC_W * TAC_H - 1);
    g.fillRect(b0.x - w * 0.6, b0.y - r * 1.1, b1.x - b0.x + w * 1.2, b1.y - b0.y + r * 2.2);
    g.strokeStyle = 'rgba(120,190,200,0.12)';
    g.lineWidth = 1;
    for (let y = 0; y < TAC_H * 2; y++) {
      const yy = b0.y - r + (y * (b1.y - b0.y + r * 2)) / (TAC_H * 2);
      const mid = this.lc(hexIndex(5, 0)).x;
      g.beginPath();
      g.moveTo(mid - w * 0.9, yy);
      g.quadraticCurveTo(mid, yy + 3, mid + w * 0.9, yy);
      g.stroke();
    }
    // The decks: planks, each ship her own wood (hers darker), the hex grid faint on them.
    for (let i = 0; i < cells.length; i++) {
      if (!deck(i)) continue;
      const p = this.lc(i);
      const hers = (hexX(i) > 5) === (v.you === 0);
      g.save();
      this.hexPath(g, p.x, p.y, r + 0.6);
      g.clip();
      g.fillStyle = g.createPattern(this.planks[hers ? 1 : 0], 'repeat')!;
      g.translate(0, 0);
      g.fillRect(p.x - w, p.y - r * 1.2, w * 2, r * 2.4);
      g.restore();
    }
    g.strokeStyle = 'rgba(10,6,2,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < cells.length; i++) {
      if (!deck(i)) continue;
      const p = this.lc(i);
      this.hexPath(g, p.x, p.y, r);
      g.stroke();
    }
    // The rails: every deck edge that looks on water or the field's end, a heavy timber with a light top.
    for (let i = 0; i < cells.length; i++) {
      if (!deck(i)) continue;
      const p = this.lc(i);
      for (let k = 0; k < 6; k++) {
        const n = this.across(i, k);
        if (n !== null && (deck(n) || cells[n] === '=')) continue;
        const a0 = ((60 * k - 30) * Math.PI) / 180, a1 = ((60 * (k + 1) - 30) * Math.PI) / 180;
        const x0 = p.x + r * Math.cos(a0), y0 = p.y + r * Math.sin(a0), x1 = p.x + r * Math.cos(a1), y1 = p.y + r * Math.sin(a1);
        g.lineCap = 'round';
        g.strokeStyle = '#24160b';
        g.lineWidth = Math.max(3, w * 0.16);
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
        g.strokeStyle = '#8a6a44';
        g.lineWidth = Math.max(1, w * 0.04);
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }
    // The planks across the water, lashed with the grapple lines.
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== '=') continue;
      const p = this.lc(i);
      g.save();
      g.translate(p.x, p.y);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(-w * 0.95, -r * 0.42 + 3, w * 1.9, r * 0.84);
      const pg = g.createLinearGradient(0, -r * 0.45, 0, r * 0.45);
      pg.addColorStop(0, '#9a7446');
      pg.addColorStop(1, '#6b4b2b');
      g.fillStyle = pg;
      g.fillRect(-w * 0.95, -r * 0.45, w * 1.9, r * 0.9);
      g.strokeStyle = 'rgba(20,10,4,0.7)';
      g.lineWidth = 1;
      for (const yy of [-r * 0.15, r * 0.15]) {
        g.beginPath();
        g.moveTo(-w * 0.95, yy);
        g.lineTo(w * 0.95, yy);
        g.stroke();
      }
      g.strokeStyle = '#c9b48a';
      g.lineWidth = Math.max(1, w * 0.035);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(-w * 0.9, s * r * 0.5);
        g.quadraticCurveTo(0, s * r * 0.95, w * 0.9, s * r * 0.5);
        g.stroke();
      }
      g.restore();
    }
    // What stands on deck.
    for (let i = 0; i < cells.length; i++) {
      const c0 = cells[i];
      if (!TAC_BLOCKING.has(c0 as TacCell) || c0 === '~' || c0 === '#') continue;
      const p = this.lc(i);
      if (c0 === 'M') this.mast(g, p.x, p.y, w);
      else if (c0 === 'C') this.cannon(g, p.x, p.y, w, hexY(i) === 0 ? -1 : 1);
      else if (c0 === 'B') this.barrel(g, p.x, p.y, w);
      else if (c0 === 'K') this.crates(g, p.x, p.y, w);
      else if (c0 === 'H') this.hole(g, p.x, p.y, w, i);
    }
    return c;
  }

  private shadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.beginPath();
    g.ellipse(x + rx * 0.15, y + ry * 0.35, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }

  private mast(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    // The shrouds run to the rails; the mast's foot is a ring of iron.
    g.strokeStyle = 'rgba(210,190,150,0.35)';
    g.lineWidth = 1;
    for (const a of [-2.4, -0.7, 0.7, 2.4]) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * w * 1.4, y + Math.sin(a) * w * 1.1);
      g.stroke();
    }
    this.shadow(g, x, y, w * 0.36, w * 0.28);
    const rg = g.createRadialGradient(x - w * 0.1, y - w * 0.1, w * 0.04, x, y, w * 0.34);
    rg.addColorStop(0, '#a47a4a');
    rg.addColorStop(1, '#4b301a');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, w * 0.32, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1f140a';
    g.lineWidth = Math.max(1.5, w * 0.06);
    g.stroke();
    g.strokeStyle = 'rgba(40,24,10,0.6)';
    g.lineWidth = 1;
    for (const k of [0.2, 0.12]) {
      g.beginPath();
      g.arc(x, y, w * k, 0, Math.PI * 2);
      g.stroke();
    }
  }

  private cannon(g: CanvasRenderingContext2D, x: number, y: number, w: number, dir: number): void {
    this.shadow(g, x, y, w * 0.34, w * 0.24);
    // The carriage.
    g.fillStyle = '#5b3d22';
    g.strokeStyle = '#21150b';
    g.lineWidth = 1;
    g.fillRect(x - w * 0.24, y - w * 0.2, w * 0.48, w * 0.4);
    g.strokeRect(x - w * 0.24, y - w * 0.2, w * 0.48, w * 0.4);
    g.fillStyle = '#2a2a2a';
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      g.beginPath();
      g.arc(x + sx * w * 0.25, y + sy * w * 0.13, w * 0.07, 0, Math.PI * 2);
      g.fill();
    }
    // The barrel, run out to her side.
    const bg = g.createLinearGradient(x - w * 0.1, 0, x + w * 0.1, 0);
    bg.addColorStop(0, '#1a1c1f');
    bg.addColorStop(0.5, '#5a5f66');
    bg.addColorStop(1, '#1a1c1f');
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(x - w * 0.09, dir < 0 ? y - w * 0.46 : y - w * 0.08, w * 0.18, w * 0.54, w * 0.06);
    g.fill();
    g.fillStyle = '#0c0c0c';
    g.beginPath();
    g.arc(x, dir < 0 ? y - w * 0.44 : y + w * 0.44, w * 0.05, 0, Math.PI * 2);
    g.fill();
  }

  private barrel(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    this.shadow(g, x, y, w * 0.3, w * 0.24);
    const rg = g.createRadialGradient(x - w * 0.08, y - w * 0.08, w * 0.03, x, y, w * 0.3);
    rg.addColorStop(0, '#9b6d3c');
    rg.addColorStop(1, '#553519');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, w * 0.28, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2b2f33';
    g.lineWidth = Math.max(1.5, w * 0.05);
    for (const k of [0.27, 0.17]) {
      g.beginPath();
      g.arc(x, y, w * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = 'rgba(30,18,8,0.7)';
    g.lineWidth = 1;
    for (const a of [0, 1.05, 2.1]) {
      g.beginPath();
      g.moveTo(x + Math.cos(a) * w * 0.16, y + Math.sin(a) * w * 0.16);
      g.lineTo(x - Math.cos(a) * w * 0.16, y - Math.sin(a) * w * 0.16);
      g.stroke();
    }
  }

  /** A shot-hole through the deck (docs/17 H1): broken planks round a black gap, splinters sprung up at its edge. */
  private hole(g: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number): void {
    const n = 9;
    const pts: [number, number][] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const r = w * (0.26 + 0.12 * (((seed * 7 + k * 13) % 5) / 4));
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85]);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(x, y, w * 0.44, w * 0.36, 0, 0, Math.PI * 2);
    g.fill();
    const hg = g.createRadialGradient(x, y, w * 0.05, x, y, w * 0.4);
    hg.addColorStop(0, '#020303');
    hg.addColorStop(0.7, '#0b0c0c');
    hg.addColorStop(1, '#2a1a0d');
    g.fillStyle = hg;
    g.beginPath();
    pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.fill();
    g.strokeStyle = '#8a6a44';
    g.lineWidth = Math.max(1, w * 0.035);
    for (let k = 0; k < n; k += 2) {
      const [px, py] = pts[k];
      const a = (k / n) * Math.PI * 2;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a + 0.4) * w * 0.12, py + Math.sin(a + 0.4) * w * 0.1);
      g.stroke();
    }
    // Sea water glinting far below.
    g.fillStyle = 'rgba(80,150,160,0.25)';
    g.beginPath();
    g.ellipse(x + w * 0.04, y + w * 0.05, w * 0.08, w * 0.04, 0, 0, Math.PI * 2);
    g.fill();
  }

  /** A fire on deck, flickering (drawn each frame). */
  private flames(g: CanvasRenderingContext2D, x: number, y: number, w: number, t: number, seed: number): void {
    const glow = g.createRadialGradient(x, y, w * 0.05, x, y, w * 0.55);
    glow.addColorStop(0, 'rgba(255,170,60,0.55)');
    glow.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, w * 0.55, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 5; k++) {
      const ph = t / 140 + k * 1.7 + seed;
      const fx = x + (k - 2) * w * 0.1 + Math.sin(ph) * w * 0.03;
      const hgt = w * (0.28 + 0.12 * Math.abs(Math.sin(ph * 1.3)));
      const fw = w * 0.09;
      const fg = g.createLinearGradient(fx, y + w * 0.12, fx, y + w * 0.12 - hgt);
      fg.addColorStop(0, 'rgba(255,220,120,0.95)');
      fg.addColorStop(0.5, 'rgba(255,130,40,0.85)');
      fg.addColorStop(1, 'rgba(200,40,10,0)');
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(fx - fw, y + w * 0.12);
      g.quadraticCurveTo(fx - fw * 0.6, y + w * 0.12 - hgt * 0.6, fx + Math.sin(ph) * fw * 0.5, y + w * 0.12 - hgt);
      g.quadraticCurveTo(fx + fw * 0.6, y + w * 0.12 - hgt * 0.6, fx + fw, y + w * 0.12);
      g.closePath();
      g.fill();
    }
  }

  private crates(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    for (const [dx, dy, s, rot] of [[-0.12, 0.06, 0.4, -0.12], [0.14, -0.1, 0.32, 0.18]] as const) {
      const cx = x + dx * w, cy = y + dy * w, hs = (s * w) / 2;
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(-hs + 2, -hs + 3, hs * 2, hs * 2);
      g.fillStyle = '#8a6437';
      g.fillRect(-hs, -hs, hs * 2, hs * 2);
      g.strokeStyle = '#3a2410';
      g.lineWidth = Math.max(1, w * 0.035);
      g.strokeRect(-hs, -hs, hs * 2, hs * 2);
      g.beginPath();
      g.moveTo(-hs, -hs);
      g.lineTo(hs, hs);
      g.moveTo(-hs, 0);
      g.lineTo(hs, 0);
      g.stroke();
      g.restore();
    }
  }

  /** Once a frame: the clock of the turn. */
  private tick(): void {
    const v = this.view;
    const el = this.el;
    if (!v || !el) return;
    const left = Math.max(0, v.ends - this.now());
    const bar = el.querySelector<HTMLElement>('.tb-timer > i');
    if (bar) bar.style.width = `${v.over ? 0 : Math.min(1, left / 30) * 100}%`;
    const secs = el.querySelector<HTMLElement>('.tb-secs');
    if (secs) secs.textContent = v.mine && !v.over ? L('secs', { n: Math.ceil(left) }) : '';
    if ((this.strikeArmed && this.strikeArmed < performance.now()) || (this.ransomArmed && this.ransomArmed < performance.now())) {
      this.strikeArmed = 0;
      this.ransomArmed = 0;
      this.key = '';
      this.dom(v);
    }
  }

  private draw(): void {
    const v = this.view;
    const c = this.canvas;
    if (!v || !c) return;
    this.fit();
    const { dpr, w, cw, ch } = this.size;
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(this.background(v), 0, 0);
    // The marks on the hexes lie with the board (turned upright on a phone), the tokens and numbers stand straight.
    this.turned(g);
    const t = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(t / 260);
    const r = w / SQ3;
    // Fires still burning on her deck (docs/17 H1).
    for (let i = 0; i < v.cells.length; i++) {
      if (v.cells[i] !== 'F') continue;
      const p = this.lc(i);
      this.flames(g, p.x, p.y, w, t, i);
    }
    // The reach of the stack whose turn it is.
    if (v.mine) {
      for (const h of v.reach) {
        const p = this.lc(h);
        this.hexPath(g, p.x, p.y, r - 1.5);
        g.fillStyle = h === this.preview ? 'rgba(46,230,200,0.42)' : h === this.hover ? 'rgba(46,230,200,0.3)' : 'rgba(46,230,200,0.16)';
        g.fill();
        g.strokeStyle = 'rgba(46,230,200,0.55)';
        g.lineWidth = 1;
        g.stroke();
      }
    }
    const active = v.stacks.find((s) => s.id === v.active);
    if (active) {
      const p = this.lc(active.hex);
      this.hexPath(g, p.x, p.y, r - 1);
      g.fillStyle = `rgba(224,184,98,${0.18 + 0.12 * pulse})`;
      g.fill();
    }
    // Whom the active stack may strike or fire on.
    if (v.mine) {
      for (const s of v.stacks) {
        const shoot = v.shoot.includes(s.id), melee = v.melee.includes(s.id);
        if (!shoot && !melee && !(this.targeting && s.side !== v.you)) continue;
        const p = this.lc(s.hex);
        g.strokeStyle = this.targeting ? `rgba(240,160,60,${0.6 + 0.4 * pulse})` : `rgba(230,80,60,${0.55 + 0.45 * pulse})`;
        g.lineWidth = 2.5;
        this.hexPath(g, p.x, p.y, r - 1);
        g.stroke();
        if (shoot || this.targeting) {
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(p.x, p.y, w * 0.5, 0, Math.PI * 2);
          for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            g.moveTo(p.x + Math.cos(a) * w * 0.4, p.y + Math.sin(a) * w * 0.4);
            g.lineTo(p.x + Math.cos(a) * w * 0.6, p.y + Math.sin(a) * w * 0.6);
          }
          g.stroke();
        }
      }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The stacks, the active one ringed in gold.
    for (const s of v.stacks) {
      const pp = this.pos.get(s.id) ?? { ...this.center(s.hex), fx: 0, fy: 0, t0: 0 };
      const p = this.at(pp, t);
      this.token(g, s, p.x, p.y, w, s.id === v.active, pulse, v);
    }
    if (v.mine) {
      // A ghost of the stack where it would step.
      if (this.preview !== null && active) {
        const p = this.center(this.preview);
        g.globalAlpha = 0.45;
        this.token(g, active, p.x, p.y, w, false, 0, v);
        g.globalAlpha = 1;
      }
    }
    // Bursts of powder, splinters and smoke.
    this.bursts = this.bursts.filter((b) => t - b.t0 < 700);
    for (const b of this.bursts) {
      const k = (t - b.t0) / 700;
      if (k < 0) continue;
      const sp = sprite(b.id);
      g.globalAlpha = Math.max(0, 1 - k);
      const s = b.size * (0.7 + k * 0.5);
      if (sp) g.drawImage(sp.img, b.x - s / 2, b.y - s / 2, s, s);
      else {
        g.fillStyle = b.id === 'part.explosion' ? '#f0a040' : 'rgba(200,200,200,0.6)';
        g.beginPath();
        g.arc(b.x, b.y, s / 2, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    // The numbers over the stacks.
    this.floats = this.floats.filter((f) => t - f.t0 < (f.big ? 1600 : 1200));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = (t - f.t0) / (f.big ? 1600 : 1200);
      g.globalAlpha = Math.max(0, 1 - k * k);
      g.font = `700 ${Math.round(f.big ? Math.max(15, w * 0.55) : Math.max(11, w * 0.36))}px ${f.big ? 'Cormorant Garamond, Georgia, serif' : 'Inter, system-ui, sans-serif'}`;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      const y = f.y - k * w * 0.6;
      g.strokeText(f.text, f.x, y);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, y);
      g.globalAlpha = 1;
    }
    void cw;
    void ch;
  }

  private token(g: CanvasRenderingContext2D, s: TacStackView, x: number, y: number, w: number, on: boolean, pulse: number, v: TacView): void {
    const R = w * 0.4;
    const col = s.side === v.you ? YOU : FOE;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.ellipse(x + R * 0.12, y + R * 0.3, R * 1.02, R * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    if (on) {
      g.strokeStyle = `rgba(240,200,110,${0.55 + 0.45 * pulse})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, R + 3.5, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#15110d';
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.fill();
    const sp = sprite(stackArt(s));
    if (sp) {
      g.save();
      g.beginPath();
      g.arc(x, y, R - 1.5, 0, Math.PI * 2);
      g.clip();
      const iw = sp.img.naturalWidth, ih = sp.img.naturalHeight;
      const k = (R * 2.1) / Math.min(iw, ih);
      g.drawImage(sp.img, x - (iw * k) / 2, y - (ih * k) / 2, iw * k, ih * k);
      g.restore();
    } else {
      g.fillStyle = col;
      g.font = `700 ${Math.round(R)}px Inter, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(s.unit ? UNITS[s.unit].tier : ''), x, y);
    }
    g.strokeStyle = col;
    g.lineWidth = Math.max(2, w * 0.07);
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.stroke();
    // An upgraded kind: a thin gold ring inside the side's colour; its tier in pips over the head.
    const d = s.unit ? UNITS[s.unit] : null;
    if (d?.up) {
      g.strokeStyle = '#e0b862';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, R - Math.max(2, w * 0.07), 0, Math.PI * 2);
      g.stroke();
    }
    if (d && w >= 22) {
      g.fillStyle = d.up ? '#e0b862' : 'rgba(240,230,210,0.8)';
      for (let k = 0; k < d.tier; k++) {
        g.beginPath();
        g.arc(x + (k - (d.tier - 1) / 2) * Math.max(2.6, w * 0.075), y - R - (s.shotsMax ? 8 : 3), Math.max(0.9, w * 0.024), 0, Math.PI * 2);
        g.fill();
      }
    }
    if (s.marked) {
      g.strokeStyle = `rgba(240,120,60,${0.6 + 0.4 * pulse})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, R + 6, 0, Math.PI * 2);
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        g.moveTo(x + Math.cos(a) * (R + 2), y + Math.sin(a) * (R + 2));
        g.lineTo(x + Math.cos(a) * (R + 10), y + Math.sin(a) * (R + 10));
      }
      g.stroke();
    }
    // Health: what is left of the stack as it came aboard.
    const frac = Math.max(0, Math.min(1, ((s.count - 1) * s.hpMax + s.hp) / Math.max(1, s.start * s.hpMax)));
    const bw = w * 0.78, bh = Math.max(3, w * 0.09);
    const bx = x - bw / 2, by = y + R + 2;
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    g.fillStyle = frac > 0.5 ? '#6fb46a' : frac > 0.25 ? '#d8a640' : '#d0503e';
    g.fillRect(bx, by, bw * frac, bh);
    // The count.
    const txt = String(s.count);
    g.font = `700 ${Math.round(Math.max(10, w * 0.3))}px Inter, system-ui, sans-serif`;
    const tw = g.measureText(txt).width + 6;
    const th = Math.max(12, w * 0.34);
    const tx0 = x + R * 0.35, ty0 = y + R * 0.2;
    g.fillStyle = s.side === v.you ? '#12303c' : '#3c1512';
    g.strokeStyle = col;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(tx0 - 2, ty0 - th / 2, tw, th, 3);
    g.fill();
    g.stroke();
    g.fillStyle = '#f2ead8';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(txt, tx0 + 1, ty0 + 0.5);
    // Defending: a small shield; muskets: the shots left.
    if (s.defending) {
      const sx = x - R * 0.85, sy = y - R * 0.75, ss = Math.max(6, w * 0.2);
      g.fillStyle = '#b08d57';
      g.strokeStyle = '#1b1208';
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + ss, sy);
      g.lineTo(sx + ss, sy + ss * 0.6);
      g.quadraticCurveTo(sx + ss / 2, sy + ss * 1.25, sx, sy + ss * 0.6);
      g.closePath();
      g.fill();
      g.stroke();
    }
    if (s.shotsMax) {
      g.fillStyle = '#e0b862';
      for (let k = 0; k < s.shots; k++) {
        g.beginPath();
        g.arc(x - R * 0.7 + k * Math.max(3, w * 0.1), y - R - 3, Math.max(1.2, w * 0.035), 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}
