// «Лоцманская книга» → the «Справочник» tab (2026-11-02): every creature, ship, item, building and good of the game as
// a filterable, searchable grid of tiles with their icons, read from the game's own tables (shared/src/data/guide/
// reference.ts). A tap on a tile opens the thing's detail card — the one card of the whole game (detail.ts): the tiles
// carry `data-detail`, nothing is drawn here twice. Phone held sideways first (844×390): one row of kinds and the
// search, one row of filter chips that scrolls sideways, the tiles below scroll on their own.
//
// API (for the book's engine):
//
//   import { renderReference } from './guideref.ts';
//   const view = renderReference(container, { kind: 'ship', query: '', sel: ['line:trade'] });
//   view.setKind('item');            // a kind: 'creature' | 'ship' | 'item' | 'building' | 'good'
//   view.setQuery('мушкет');         // the search box's words (every word must match)
//   view.setSel(['tier:3']);         // the chosen facet values, '<facet>:<value>'
//   view.state();                    // { kind, query, sel, shown, total }
//   view.refresh();                  // redraw (a change of tongue)
//   view.destroy();                  // empty the container, drop the listeners
//
//   opts.open(key)   — instead of the detail card: called with the tile's detail key ('unit:musketeer', 'hull:frigate',
//                      'base:<id>', 'art:<id>', 'leg:<id>', 'gset:<id>', 'aset:<id>', 'town:dw3', 'producer:lumber',
//                      'building:fort', 'good:timber', 'lres:shell').
//   opts.onChange(s) — after every change of kind, words or filters (the book may keep it).
//   opts.lang        — 'ru' | 'en' (default: the game's tongue).
//
// The container is filled with `.gref` (its stylesheet /guideref.css is linked on the first call); it should be given
// a height (the grid scrolls inside it). The last kind, words and filters are kept for the next call without opts.

import { filterReference, referenceIndex } from '../../../shared/src/data/guide/reference.ts';
import type { RefEntry, RefKind, RefLang } from '../../../shared/src/data/guide/reference.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang as gameLang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/guideref.ts';
import { detailAttr } from './detailattr.ts';
import { esc, icon } from './dom.ts';
import { unitIcon } from './army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';

const L = dict(EN, RU);

export interface ReferenceOpts {
  kind?: RefKind;
  query?: string;
  sel?: string[];
  lang?: RefLang;
  open?: (key: string) => void;
  onChange?: (s: ReferenceState) => void;
}
export interface ReferenceState { kind: RefKind; query: string; sel: string[]; shown: number; total: number }
export interface ReferenceView {
  el: HTMLElement;
  setKind(k: RefKind): void;
  setQuery(q: string): void;
  setSel(sel: string[]): void;
  state(): ReferenceState;
  refresh(): void;
  destroy(): void;
}

const KIND_ICON: Record<RefKind, string> = { creature: 'ui_cutlasses', ship: 'menu_ship', item: 'item_armoury', building: 'build_trophy_hall', good: 'tab_market' };

/** What the last view was left at (the book reopened shows the same). */
const kept: { kind: RefKind; query: string; sel: string[] } = { kind: 'creature', query: '', sel: [] };

let cssLinked = false;
function linkCss(): void {
  if (cssLinked || typeof document === 'undefined') return;
  cssLinked = true;
  if (document.querySelector('link[href="/guideref.css"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/guideref.css';
  document.head.appendChild(l);
}

/** A tile's picture: a creature's figure, a hull's sprite, an icon (lazy: a kind has up to 270 of them). */
function artOf(e: RefEntry): string {
  const lazy = (h: string) => h.replace('<img ', '<img loading="lazy" ');
  if (!e.art) return '';
  if (e.fig === 'unit') return lazy(unitIcon(e.art as UnitId, 'gref-fig'));
  if (e.fig === 'ship') {
    const url = assetUrl(e.art);
    return url ? `<img class="gref-ship" src="${url}" alt="" loading="lazy" draggable="false" />` : '';
  }
  return lazy(icon(e.art, '', 'gref-ico'));
}

/** One tile's markup (pure but for the pictures' addresses). */
export function tileHtml(e: RefEntry, own: boolean): string {
  const key = own ? ` data-gref="${esc(e.detail)}"` : detailAttr(e.detail);
  return `<li><button type="button" class="gref-tile gref-${e.kind}"${key} style="--c:${esc(e.color ?? '#e8c872')}" title="${esc(`${e.name} · ${e.sub}`)}">`
    + `<span class="gref-art gref-art-${e.fig ?? 'icon'}">${artOf(e)}</span><span class="gref-tx"><b>${esc(e.name)}</b>`
    + `<small>${e.chip ? `<i class="gref-chip">${esc(e.chip)}</i>` : ''}${esc(e.sub)}</small></span></button></li>`;
}

export function renderReference(container: HTMLElement, opts: ReferenceOpts = {}): ReferenceView {
  linkCss();
  const st = { kind: opts.kind ?? kept.kind, query: opts.query ?? kept.query, sel: new Set(opts.sel ?? kept.sel) };
  const tongue = (): RefLang => opts.lang ?? (gameLang() === 'ru' ? 'ru' : 'en');
  let shown = 0, total = 0;
  const el = document.createElement('div');
  el.className = 'gref';
  container.replaceChildren(el);

  const frame = () => {
    el.innerHTML = `<div class="gref-top"><div class="gref-kinds" role="tablist" aria-label="${esc(L('kinds'))}"></div>`
      + `<label class="gref-search"><span class="gref-glass" aria-hidden="true">⌕</span><input type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="${esc(L('search'))}" aria-label="${esc(L('searchL'))}" /></label></div>`
      + `<div class="gref-facets" role="toolbar" aria-label="${esc(L('filters'))}"></div>`
      + `<div class="gref-scroll"><ul class="gref-grid" role="list"></ul><p class="gref-none" hidden>${esc(L('none'))}</p></div>`;
    el.querySelector<HTMLInputElement>('.gref-search input')!.value = st.query;
  };

  const draw = () => {
    const ix = referenceIndex(tongue());
    const kinds = el.querySelector<HTMLElement>('.gref-kinds')!;
    kinds.innerHTML = ix.kinds.map((k) => `<button type="button" role="tab" class="gref-kind${k.kind === st.kind ? ' on' : ''}" data-kind="${k.kind}" aria-selected="${k.kind === st.kind}">${icon(KIND_ICON[k.kind], '', 'gref-kico')}<span>${esc(k.name)}</span><i>${k.n}</i></button>`).join('');
    const facets = ix.facets.filter((f) => f.kind === st.kind && f.values.length > 1);
    // a chosen value of another kind's facet stays chosen but is not drawn; reset drops this kind's only
    const mine = [...st.sel].filter((t) => facets.some((f) => t.startsWith(`${f.id}:`)));
    el.querySelector<HTMLElement>('.gref-facets')!.innerHTML = `<button type="button" class="gref-reset" data-reset aria-label="${esc(L('resetL'))}"${mine.length ? '' : ' disabled'}>✕ ${esc(L('reset'))}</button>`
      + facets.map((f) => `<span class="gref-fg" role="group" aria-label="${esc(f.name)}"><span class="gref-fn">${esc(f.name)}</span>${f.values.map((v) => {
        const t = `${f.id}:${v.v}`, on = st.sel.has(t);
        return `<button type="button" class="gref-f${on ? ' on' : ''}" data-f="${esc(t)}" aria-pressed="${on}">${esc(v.name)}<i>${v.n}</i></button>`;
      }).join('')}</span>`).join('');
    const all = ix.entries.filter((e) => e.kind === st.kind);
    const xs = filterReference(all, { q: st.query, sel: st.sel });
    shown = xs.length;
    total = all.length;
    const grid = el.querySelector<HTMLElement>('.gref-grid')!;
    grid.innerHTML = xs.map((e) => tileHtml(e, !!opts.open)).join('');
    grid.setAttribute('aria-label', L('count', { n: shown, m: total }));
    el.querySelector<HTMLElement>('.gref-none')!.hidden = shown > 0;
    kept.kind = st.kind;
    kept.query = st.query;
    kept.sel = [...st.sel];
    opts.onChange?.(state());
  };

  const state = (): ReferenceState => ({ kind: st.kind, query: st.query, sel: [...st.sel], shown, total });

  const onClick = (ev: MouseEvent) => {
    const t = ev.target as Element;
    const k = t.closest<HTMLElement>('[data-kind]');
    if (k) {
      st.kind = k.dataset.kind as RefKind;
      draw();
      el.querySelector<HTMLElement>('.gref-scroll')!.scrollTop = 0;
      return;
    }
    const f = t.closest<HTMLElement>('[data-f]');
    if (f) {
      const v = f.dataset.f!;
      if (st.sel.has(v)) st.sel.delete(v);
      else st.sel.add(v);
      const x = el.querySelector<HTMLElement>('.gref-facets')!.scrollLeft;
      draw();
      el.querySelector<HTMLElement>('.gref-facets')!.scrollLeft = x;
      return;
    }
    if (t.closest('[data-reset]')) {
      const ids = referenceIndex(tongue()).facets.filter((x) => x.kind === st.kind).map((x) => `${x.id}:`);
      for (const v of [...st.sel]) if (ids.some((p) => v.startsWith(p))) st.sel.delete(v);
      draw();
      return;
    }
    const own = t.closest<HTMLElement>('[data-gref]');
    if (own && opts.open) opts.open(own.dataset.gref!);
  };
  let typing = 0;
  const onInput = (ev: Event) => {
    const inp = ev.target as HTMLInputElement;
    if (!inp.matches('.gref-search input')) return;
    clearTimeout(typing);
    typing = window.setTimeout(() => {
      st.query = inp.value.trim();
      draw();
    }, 120);
  };
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);

  frame();
  draw();
  return {
    el,
    setKind(k) { st.kind = k; draw(); },
    setQuery(q) { st.query = q; el.querySelector<HTMLInputElement>('.gref-search input')!.value = q; draw(); },
    setSel(sel) { st.sel = new Set(sel); draw(); },
    state,
    refresh() { const q = st.query; frame(); el.querySelector<HTMLInputElement>('.gref-search input')!.value = q; draw(); },
    destroy() { clearTimeout(typing); el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.remove(); },
  };
}
