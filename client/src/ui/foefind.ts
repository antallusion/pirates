// «Найти врага» (forum 45, topic 8, approved by the owner: «если мне просто надо убить пирата… какой-нибудь поиск врагов
// пираты/звери по уровням»): from the «⋯» tray and the chart. A list of the foes she may know of — the ships in sight
// (pirates, beasts, monsters), the creature stacks in sight and the lairs on her chart — never one under the fog of war
// (main.ts gathers them: underFog). By kind, by level about hers (±2, ±5, any), the nearest first, each with its ⚓ and
// its distance; a tap sets the helmsman's course there and her mark on the chart (main.ts `onSail`).

import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/foefind.ts';
import { esc, icon } from './dom.ts';
import { pushLayer, popLayer } from './kit/layer.ts';
import type { Layer } from './kit/layer.ts';

const L = dict(EN, RU);

export type FoeKind = 'pirate' | 'beast' | 'monster' | 'lair';
export type FoeSpan = 'near' | 'wide' | 'any';

export interface Foe {
  /** `ship:12`, `roam:3`, `lair:ab` — what it is (the course and the chart's mark). */
  key: string;
  kind: FoeKind;
  name: string;
  /** Its ⚓ (0: unknown). */
  level: number;
  x: number;
  y: number;
  /** How near the helmsman brings her (m). */
  near?: number;
}

export interface FoeRow extends Foe {
  d: number;
}

/** The levels a span lets through about hers. */
export const FOE_SPAN: Record<FoeSpan, number> = { near: 2, wide: 5, any: Infinity };
/** No farther than this (m): «nearby» — the chart's lairs may lie across a whole sea. */
export const FOE_MAX_D = 30_000;

/** The list as shown (pure): of the kind (or all), within the levels about hers (an unknown level always), within
 *  FOE_MAX_D, the nearest first. */
export function foeRows(all: readonly Foe[], own: { x: number; y: number }, myLevel: number, kind: FoeKind | 'all', span: FoeSpan): FoeRow[] {
  const w = FOE_SPAN[span];
  return all
    .filter((f) => (kind === 'all' || f.kind === kind) && (!f.level || Math.abs(f.level - myLevel) <= w))
    .map((f) => ({ ...f, d: Math.hypot(f.x - own.x, f.y - own.y) }))
    .filter((f) => f.d <= FOE_MAX_D)
    .sort((a, b) => a.d - b.d || a.key.localeCompare(b.key));
}

const KIND_ICON: Record<FoeKind, string> = { pirate: 'item_black_flag', beast: 'good_shark_skin', monster: 'fh_serpent', lair: 'danger' };

function distText(d: number): string {
  return d >= 1000 ? `${(Math.round(d / 100) / 10).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-US')} ${lang() === 'ru' ? 'км' : 'km'}` : `${Math.round(d / 10) * 10} ${lang() === 'ru' ? 'м' : 'm'}`;
}

export interface FoeFinderDeps {
  /** Every foe she may know of now (main.ts: in sight or charted, never under the fog). */
  foes(): Foe[];
  own(): { x: number; y: number } | null;
  level(): number;
  /** The course there (and the mark on the chart). */
  onSail(f: Foe): void;
}

/** The finder's panel: over the sea and over the chart (a kit layer: Esc and Tab stay in it). */
export class FoeFinder {
  private root: HTMLElement | null = null;
  private layer: Layer | null = null;
  kind: FoeKind | 'all' = 'all';
  span: FoeSpan = 'near';
  private tick = 0;
  private deps: FoeFinderDeps;
  constructor(deps: FoeFinderDeps) {
    this.deps = deps;
  }

  get isOpen(): boolean {
    return !!this.root && !this.root.classList.contains('hidden');
  }

  open(): void {
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'foefind';
      this.root.className = 'ff-root hidden';
      this.root.setAttribute('role', 'dialog');
      this.root.setAttribute('aria-label', L('title'));
      document.body.append(this.root);
      this.root.addEventListener('click', (e) => {
        const el = e.target as HTMLElement;
        if (el.classList.contains('ff-scrim') || el.closest('[data-ffx]')) return this.close();
        const k = el.closest<HTMLElement>('[data-ffk]');
        if (k) {
          this.kind = k.dataset.ffk as FoeKind | 'all';
          return this.draw();
        }
        const s = el.closest<HTMLElement>('[data-ffs]');
        if (s) {
          this.span = s.dataset.ffs as FoeSpan;
          return this.draw();
        }
        const row = el.closest<HTMLElement>('[data-ffgo]');
        if (row) {
          const f = this.deps.foes().find((x) => x.key === row.dataset.ffgo);
          if (!f) return this.draw();
          this.close();
          this.deps.onSail(f);
        }
      });
    }
    this.draw();
    this.root.classList.remove('hidden');
    if (!this.layer) {
      this.layer = { root: this.root, onEscape: () => this.close() };
      pushLayer(this.layer);
    }
    clearInterval(this.tick);
    this.tick = window.setInterval(() => (this.isOpen ? this.draw() : clearInterval(this.tick)), 1500);
  }

  close(): void {
    clearInterval(this.tick);
    this.root?.classList.add('hidden');
    if (this.layer) {
      popLayer(this.layer);
      this.layer = null;
    }
  }

  /** The rows as they stand now (the tests, the browser checks). */
  rows(): FoeRow[] {
    const own = this.deps.own();
    return own ? foeRows(this.deps.foes(), own, this.deps.level(), this.kind, this.span) : [];
  }

  private draw(): void {
    if (!this.root) return;
    const sc = this.root.querySelector('.ff-list')?.scrollTop ?? 0;
    const rows = this.rows();
    const chip = (attr: string, id: string, label: string, on: boolean) => `<button type="button" class="w-chip ff-chip${on ? ' on' : ''}" data-${attr}="${id}" aria-pressed="${on}">${esc(label)}</button>`;
    const kinds = (['all', 'pirate', 'beast', 'monster', 'lair'] as const).map((k) => chip('ffk', k, L(`k.${k}`), this.kind === k)).join('');
    const spans = (['near', 'wide', 'any'] as const).map((s) => chip('ffs', s, L(`lv.${s}`), this.span === s)).join('');
    const list = rows.length
      ? rows.map((r) => `<button type="button" class="ff-row" data-ffgo="${esc(r.key)}" title="${esc(L('sailTip', { name: r.name }))}">${icon(KIND_ICON[r.kind], '', 'ico-sm ff-ico')}<span class="ff-n">${esc(r.name)}</span><span class="ff-lv">${r.level ? `⚓${r.level}` : ''}</span><span class="ff-d">${esc(distText(r.d))}</span><span class="ff-go">${esc(L('sail'))}</span></button>`).join('')
      : `<p class="muted ff-none">${esc(L('none'))}</p>`;
    this.root.innerHTML = `<div class="ff-scrim"></div><div class="ff-card"><button type="button" class="dc-x ff-x" data-ffx aria-label="${esc(L('close'))}" title="${esc(L('close'))}">✕</button>
      <h2 class="ff-title">${icon('danger', '', 'ico-sm')}${esc(L('title'))}</h2><p class="muted ff-sub">${esc(L('sub'))}</p>
      <div class="ff-chips" role="group">${kinds}</div><div class="ff-chips" role="group">${spans}</div><div class="ff-list" role="list">${list}</div></div>`;
    const l = this.root.querySelector('.ff-list');
    if (l) l.scrollTop = sc;
  }
}
