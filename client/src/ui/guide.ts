// «Лоцманская книга» (2026-11-02): the in-game encyclopedia that teaches every mechanic without breaking play. The
// articles are shared data (shared/src/data/guide/: one file a section, written by the content's own hands); this is
// the engine:
//  - the window: the sections down the left with their icons and counts, the articles of one, an article as a run of
//    pictures (a picture, its caption, ‹ › or a swipe, the dots, «Показать в игре»), «Похожие статьи», the crumbs and
//    «Назад»; the last article opened is offered again («Продолжить»). On a phone held sideways (844×390, 740×360) an
//    open article takes the whole width (the crumbs lead back);
//  - the search: instant, over the titles, the tags, the summaries and the pictures' words in both languages, the words
//    found lit (shared/src/data/guide/search.ts);
//  - «Показать в игре»: the book closes, the window opens (main.ts `openWindow`), the finger points at the very thing;
//  - «?» in the head of the game's windows (helpBtn / ensureHelp): the article about that window, else its section;
//  - «Изучено N / M»: an article is read when its last picture is reached (`guide_read`); a section read through pays
//    its silver once (the server checks: server/src/game/guide.ts).
// Its own DOM over everything but the detail card and the toasts; the keyboard is its own while it is up (layer.ts).

import { GUIDE, GUIDE_SECTIONS, GUIDE_SECTION_REWARD, guideArticle } from '../../../shared/src/data/guide/index.ts';
import type { GuideArticle, GuideSection } from '../../../shared/src/data/guide/types.ts';
import { guideCounts } from '../../../shared/src/data/guide/book.ts';
import { guideMarks, guideSearch } from '../../../shared/src/data/guide/search.ts';
import type { GuideView } from '../../../shared/src/guideproto.ts';
import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang, onLang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/guide.ts';
import { esc, glyphSvg, icon } from './dom.ts';
import { popLayer, pushLayer } from './kit/layer.ts';
import type { Layer } from './kit/layer.ts';
import { helpTarget } from './guidewin.ts';

const L = dict(EN, RU);
const T = (x: readonly [string, string]): string => x[lang() === 'ru' ? 1 : 0];

/** Each section's icon (the game's own art) and its glyph while the art is not in. */
export const SECTION_ART: Record<GuideSection, [string, string]> = {
  sea: ['stat_sails', '⛵'],
  combat: ['fire', '✹'],
  flags: ['cos_flags', '⚑'],
  trade: ['tab_market', '⚖'],
  island: ['tab_isles', '⌂'],
  army: ['menu_crew', '⚔'],
  explore: ['map_treasure', '✕'],
  travel: ['ui_compass', '✦'],
  progress: ['menu_talents', '✧'],
  faq: ['menu_help', '?'],
};

export const sectionName = (s: GuideSection): string => L(`sec.${s}` as keyof typeof EN);

/** A picture's address: a manifest key ('guide.<file>' or any other), else assets/guide/<file>.webp, else a path. */
export function slideSrc(img: string | undefined): string | null {
  if (!img) return null;
  const known = assetUrl(img);
  if (known) return known;
  if (img.startsWith('guide.')) return `/assets/guide/${img.slice(6)}.webp`;
  if (img.includes('/')) return img.startsWith('/') || /^https?:/.test(img) ? img : `/${img}`;
  return `/assets/guide/${/\.\w+$/.test(img) ? img : img + '.webp'}`;
}

/** A text with the query's words lit (escaped). */
export function litHtml(text: string, q: string): string {
  const marks = q ? guideMarks(text, q) : [];
  if (!marks.length) return esc(text);
  let out = '', at = 0;
  for (const [a, b] of marks) {
    if (a < at) continue;
    out += `${esc(text.slice(at, a))}<mark>${esc(text.slice(a, b))}</mark>`;
    at = b;
  }
  return out + esc(text.slice(at));
}

/** The «?» of a window's head. */
export function helpBtn(win: string): string {
  return `<button type="button" class="g-help" data-ghelp="${esc(win)}" aria-label="${esc(L('help'))}" title="${esc(L('help'))}"><span aria-hidden="true">?</span></button>`;
}

/** Puts the «?» in a head (once; another window's key replaces it); no head or no key: nothing. */
export function ensureHelp(host: Element | null, win: string | null): void {
  if (!host) return;
  const was = host.querySelector<HTMLElement>(':scope > .g-help');
  if (!win) {
    was?.remove();
    return;
  }
  if (was?.dataset.ghelp === win && was.getAttribute('aria-label') === L('help')) return;
  was?.remove();
  host.insertAdjacentHTML('beforeend', helpBtn(win));
}

type Place = { v: 'home' } | { v: 'section'; s: GuideSection } | { v: 'search' } | { v: 'article'; id: string; slide: number };

const LAST_KEY = 'gravetide.guideLast';

function lastOpened(): { id: string; slide: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as { id?: string; slide?: number } | null;
    return v?.id && guideArticle(v.id) ? { id: v.id, slide: Math.max(0, Number(v.slide) || 0) } : null;
  } catch {
    return null;
  }
}

export interface GuideDeps {
  send(m: ClientMsg): void;
  on(f: (m: ServerMsg) => void): void;
  /** Opens a game's window (main.ts): null when it opened, else why not (a key of the book's words). */
  openWindow(id: string): 'needPort' | 'needIsle' | 'noWindow' | null;
  /** The finger over a selector for a while (pointer.ts). */
  point(sel: string, ms: number): void;
  toast(msg: string, kind: 'good' | 'info' | 'bad' | 'gold'): void;
  /** Called as the book opens and closes (main.ts: the sea's keys wait, the tips wait). */
  onShown?(open: boolean): void;
}

export class GuideBook {
  view: GuideView = { read: [], seen: [], paid: [] };
  /** The articles (the shared index; a test may give its own). */
  list: readonly GuideArticle[] = GUIDE;
  private d: GuideDeps;
  private over: HTMLElement | null = null;
  private layer: Layer | null = null;
  private at: Place = { v: 'home' };
  private trail: Place[] = [];
  private query = '';
  private swipe: { x: number; y: number; id: number } | null = null;

  constructor(d: GuideDeps) {
    this.d = d;
    d.on((m) => {
      if (m.t !== 'guide') return;
      this.view = m.view;
      if (m.got) d.toast(L('got', { s: sectionName(m.got.section), n: m.got.silver }), 'gold');
      if (this.over) this.drawRail();
      if (this.over) this.drawProgress();
    });
    // every «?» of the game's windows, wherever it is drawn
    document.addEventListener('click', (e) => {
      const b = (e.target as Element | null)?.closest?.<HTMLElement>('[data-ghelp]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      this.openFor(b.dataset.ghelp ?? '');
    }, true);
    onLang(() => {
      if (this.over) this.draw();
    });
  }

  isOpen(): boolean {
    return !!this.over;
  }

  readSet(): Set<string> {
    return new Set(this.view.read);
  }

  /** The book as it was left this session (else its home, «Продолжить» there). */
  open(place?: Place, trail?: Place[]): void {
    if (place) {
      if (this.over) {
        if (JSON.stringify(this.at) !== JSON.stringify(place)) this.trail.push(this.at);
      } else this.trail = trail ?? (place.v === 'home' ? [] : [{ v: 'home' }]);
      if (place.v !== 'search') this.query = '';
      this.at = place;
    }
    if (!this.over) this.mount();
    this.draw();
  }

  toggle(): void {
    if (this.over) this.close();
    else this.open();
  }

  openArticle(id: string, slide = 0): void {
    const a = guideArticle(id) ?? this.list.find((x) => x.id === id);
    if (!a) return this.open({ v: 'home' });
    this.open({ v: 'article', id, slide: Math.max(0, Math.min(a.slides.length - 1, slide)) }, [{ v: 'home' }, { v: 'section', s: a.section }]);
  }

  openSection(s: GuideSection): void {
    this.open({ v: 'section', s });
  }

  /** A window's «?»: its article, else its section. */
  openFor(win: string): void {
    const t = helpTarget(this.list, win);
    if ('article' in t) this.openArticle(t.article);
    else this.open({ v: 'section', s: t.section });
  }

  close(): void {
    if (!this.over) return;
    this.over.remove();
    this.over = null;
    if (this.layer) popLayer(this.layer);
    this.layer = null;
    this.d.onShown?.(false);
  }

  private back(): void {
    const p = this.trail.pop();
    if (!p) return this.close();
    this.at = p;
    if (p.v !== 'search') this.query = '';
    this.draw();
  }

  // ---------------------------------------------------------------------------------------------- the frame

  private mount(): void {
    const el = document.createElement('div');
    el.id = 'guide-over';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<section class="gb" aria-labelledby="gb-title">
      <header class="gb-head">
        <button type="button" class="gb-back" data-gback aria-label="${esc(L('back'))}" title="${esc(L('back'))}">${glyphSvg('prev')}</button>
        <span class="gb-crest" aria-hidden="true">${icon('bt_book', '✎', 'gb-crest-ico')}</span>
        <div class="gb-ht"><h2 id="gb-title" class="gb-title"></h2><nav class="gb-crumbs" aria-label="${esc(L('title'))}"></nav></div>
        <label class="gb-search"><svg class="gb-loupe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>
          <input type="search" class="gb-q" enterkeyhint="search" autocomplete="off" spellcheck="false" />
          <button type="button" class="gb-qx hidden" data-gqx>${glyphSvg('close')}</button></label>
        <span class="gb-prog"></span>
        <button type="button" class="gb-x" data-gx>${glyphSvg('close')}</button>
      </header>
      <div class="gb-main"><nav class="gb-rail"></nav><div class="gb-pane"></div></div>
    </section>`;
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === el) return this.close();
      const go = t.closest<HTMLElement>('[data-gx], [data-gback], [data-gsec], [data-gart], [data-gprev], [data-gnext], [data-gdot], [data-gshow], [data-gqx], [data-ghome], [data-gwin]');
      if (!go) return;
      const ds = go.dataset;
      if (ds.gx !== undefined) this.close();
      else if (ds.gback !== undefined) this.back();
      else if (ds.ghome !== undefined) {
        this.trail = [];
        this.query = '';
        this.at = { v: 'home' };
        this.draw();
      } else if (ds.gsec) {
        if (this.at.v === 'section') {
          this.at = { v: 'section', s: ds.gsec as GuideSection };
          this.draw();
        } else this.open({ v: 'section', s: ds.gsec as GuideSection });
      } else if (ds.gart) this.open({ v: 'article', id: ds.gart, slide: Number(ds.gslide) || 0 });
      else if (ds.gprev !== undefined) this.step(-1);
      else if (ds.gnext !== undefined) this.step(1);
      else if (ds.gdot) this.goSlide(Number(ds.gdot));
      else if (ds.gshow !== undefined) this.show();
      else if (ds.gqx !== undefined) {
        this.query = '';
        const q = el.querySelector<HTMLInputElement>('.gb-q')!;
        q.value = '';
        q.focus();
        this.onQuery();
      } else if (ds.gwin) {
        const why = this.d.openWindow(ds.gwin);
        if (why) this.d.toast(L(why), 'info');
        else this.close();
      }
    });
    const q = el.querySelector<HTMLInputElement>('.gb-q')!;
    q.addEventListener('input', () => {
      this.query = q.value;
      this.onQuery();
    });
    // a swipe across the picture: the next or the last one
    el.addEventListener('pointerdown', (e) => {
      if (!(e.target as Element).closest('.gb-stage') || (e.target as Element).closest('button')) return;
      this.swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    const end = (e: PointerEvent) => {
      const s = this.swipe;
      if (!s || s.id !== e.pointerId) return;
      this.swipe = null;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3) this.step(dx < 0 ? 1 : -1);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => (this.swipe = null));
    document.body.appendChild(el);
    this.over = el;
    this.layer = {
      root: el.querySelector<HTMLElement>('.gb')!,
      onEscape: () => this.close(),
      onKey: (e) => {
        const field = (e.target as HTMLElement | null)?.closest?.('input');
        if (this.at.v === 'article' && !field && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          this.step(e.key === 'ArrowLeft' ? -1 : 1);
          return true;
        }
        if (!field && e.key === 'Backspace') {
          this.back();
          return true;
        }
        if (!field && e.key === '/') {
          q.focus();
          return true;
        }
        return false;
      },
    };
    pushLayer(this.layer);
    this.d.onShown?.(true);
  }

  private onQuery(): void {
    const has = this.query.trim().length > 0;
    this.over?.querySelector('.gb-qx')?.classList.toggle('hidden', !has);
    if (has && this.at.v !== 'search') {
      this.trail.push(this.at);
      this.at = { v: 'search' };
    } else if (!has && this.at.v === 'search') {
      this.at = this.trail.pop() ?? { v: 'home' };
    }
    this.drawHead();
    this.drawPane();
  }

  private draw(): void {
    if (!this.over) return;
    const q = this.over.querySelector<HTMLInputElement>('.gb-q')!;
    q.placeholder = L('search');
    q.setAttribute('aria-label', L('searchAria'));
    if (q.value !== this.query) q.value = this.query;
    this.over.querySelector('.gb-qx')?.classList.toggle('hidden', !this.query.trim());
    const qx = this.over.querySelector<HTMLElement>('.gb-qx')!;
    qx.setAttribute('aria-label', L('clear'));
    qx.title = L('clear');
    const x = this.over.querySelector<HTMLElement>('.gb-x')!;
    x.setAttribute('aria-label', L('close'));
    x.title = L('close');
    this.over.setAttribute('aria-label', L('title'));
    this.drawHead();
    this.drawRail();
    this.drawProgress();
    this.drawPane();
  }

  private drawHead(): void {
    const el = this.over!;
    const at = this.at;
    el.querySelector<HTMLElement>('.gb-title')!.textContent = L('title');
    el.classList.toggle('gb-reading', at.v === 'article');
    el.dataset.at = at.v;
    el.querySelector('.gb-back')!.classList.toggle('hidden', at.v === 'home');
    const crumbs: string[] = [`<button type="button" class="gb-crumb" data-ghome>${esc(L('home'))}</button>`];
    if (at.v === 'section') crumbs.push(`<span class="gb-crumb on">${esc(sectionName(at.s))}</span>`);
    if (at.v === 'search') crumbs.push(`<span class="gb-crumb on">${esc(L('results', { n: guideSearch(this.list, this.query, lang() === 'ru').length }))}</span>`);
    if (at.v === 'article') {
      const a = this.article();
      if (a) crumbs.push(`<button type="button" class="gb-crumb" data-gsec="${a.section}">${esc(sectionName(a.section))}</button>`, `<span class="gb-crumb on">${esc(T(a.title))}</span>`);
    }
    el.querySelector<HTMLElement>('.gb-crumbs')!.innerHTML = crumbs.join('<i class="gb-sep" aria-hidden="true">›</i>');
  }

  private drawProgress(): void {
    const c = guideCounts(this.list, this.view.read).all;
    const el = this.over!.querySelector<HTMLElement>('.gb-prog')!;
    const words = L('learnt', { n: c.n, m: c.m });
    el.title = words;
    el.innerHTML = `<b>${esc(words)}</b><i class="gb-prog-bar" aria-hidden="true"><i style="width:${c.m ? Math.round((c.n / c.m) * 100) : 0}%"></i></i>`;
  }

  private drawRail(): void {
    const { by } = guideCounts(this.list, this.view.read);
    const cur = this.at.v === 'section' ? this.at.s : this.at.v === 'article' ? this.article()?.section : null;
    this.over!.querySelector<HTMLElement>('.gb-rail')!.innerHTML = `<h3 class="gb-rail-h">${esc(L('sections'))}</h3>${GUIDE_SECTIONS.map((s) => {
      const c = by[s] ?? { n: 0, m: 0 };
      const done = c.m > 0 && c.n === c.m;
      return `<button type="button" class="gb-sec${s === cur ? ' on' : ''}${done ? ' done' : ''}" data-gsec="${s}"${s === cur ? ' aria-current="true"' : ''}>${icon(SECTION_ART[s][0], SECTION_ART[s][1], 'gb-sec-ico')}<span class="gb-sec-n">${esc(sectionName(s))}</span><b class="gb-sec-c">${done ? '✓' : esc(L('secCount', { n: c.n, m: c.m }))}</b></button>`;
    }).join('')}`;
  }

  private article(): GuideArticle | undefined {
    return this.at.v === 'article' ? this.list.find((a) => a.id === (this.at as { id: string }).id) : undefined;
  }

  private row(a: GuideArticle, read: Set<string>, sub: string, extra = ''): string {
    const r = read.has(a.id);
    return `<button type="button" class="gb-row${r ? ' read' : ''}" data-gart="${esc(a.id)}"${extra}>${icon(SECTION_ART[a.section][0], SECTION_ART[a.section][1], 'gb-row-ico')}<span class="gb-row-t"><b>${sub ? litHtml(T(a.title), this.query) : esc(T(a.title))}</b><span>${sub || esc(T(a.summary))}</span></span><span class="gb-row-m" aria-label="${r ? esc(L('read')) : ''}">${r ? '✓' : glyphSvg('next')}</span></button>`;
  }

  private drawPane(): void {
    const pane = this.over!.querySelector<HTMLElement>('.gb-pane')!;
    const read = this.readSet();
    const at = this.at;
    pane.scrollTop = 0;
    if (at.v === 'search') {
      const hits = guideSearch(this.list, this.query, lang() === 'ru');
      pane.innerHTML = hits.length
        ? `<p class="gb-lead">${esc(L('results', { n: hits.length }))}</p><div class="gb-list">${hits.map((h) => this.row(h.article, read, litHtml(h.snippet, this.query), h.slide !== null ? ` data-gslide="${h.slide}"` : '')).join('')}</div>`
        : `<p class="gb-empty">${esc(L('noResults', { q: this.query.trim() }))}</p>`;
      return;
    }
    if (at.v === 'section') {
      const list = this.list.filter((a) => a.section === at.s);
      const c = guideCounts(this.list, this.view.read).by[at.s] ?? { n: 0, m: 0 };
      const paid = this.view.paid.includes(at.s);
      pane.innerHTML = `<header class="gb-sh">${icon(SECTION_ART[at.s][0], SECTION_ART[at.s][1], 'gb-sh-ico')}<h3>${esc(sectionName(at.s))}</h3><span class="gb-sh-c">${esc(L('secCount', { n: c.n, m: c.m }))}</span><span class="gb-chip${paid ? ' paid' : ''}">${esc(paid ? L('rewardPaid') : L('reward', { n: GUIDE_SECTION_REWARD }))}</span></header>
        ${list.length ? `<div class="gb-list">${list.map((a) => this.row(a, read, '')).join('')}</div>` : `<p class="gb-empty">${esc(L('empty'))}</p>`}`;
      return;
    }
    if (at.v === 'article') return this.drawArticle(pane);
    // home: «Продолжить», then what is not read yet
    const last = lastOpened();
    const la = last ? this.list.find((a) => a.id === last.id) : undefined;
    const unread = this.list.filter((a) => !read.has(a.id) && a.id !== la?.id).slice(0, 8);
    pane.innerHTML = `<p class="gb-lead">${esc(L('intro'))}</p>
      ${la ? `<button type="button" class="gb-cont" data-gart="${esc(la.id)}" data-gslide="${last!.slide}">${icon(SECTION_ART[la.section][0], SECTION_ART[la.section][1], 'gb-row-ico')}<span class="gb-row-t"><small>${esc(L('continue'))}</small><b>${esc(T(la.title))}</b></span><span class="gb-row-m">${glyphSvg('next')}</span></button>` : ''}
      <div class="gb-list">${unread.map((a) => this.row(a, read, '')).join('')}</div>
      <button type="button" class="gb-keys" data-gwin="keys">${icon('menu_options', '⌨', 'gb-row-ico')}<span>${esc(L('keys'))}</span></button>`;
  }

  private drawArticle(pane: HTMLElement): void {
    const a = this.article();
    if (!a || !a.slides.length) {
      pane.innerHTML = `<p class="gb-empty">${esc(L('empty'))}</p>`;
      return;
    }
    const at = this.at as { v: 'article'; id: string; slide: number };
    const i = Math.max(0, Math.min(a.slides.length - 1, at.slide));
    const sl = a.slides[i];
    const n = a.slides.length;
    const src = slideSrc(sl.img);
    const rel = (a.related ?? []).map((id) => this.list.find((x) => x.id === id)).filter((x): x is GuideArticle => !!x);
    const read = this.readSet();
    pane.innerHTML = `<div class="gb-art">
      <div class="gb-stage" data-section="${a.section}">
        <div class="gb-pic">${src ? `<img class="gb-img" src="${esc(src)}" alt="" draggable="false" />` : ''}${this.plate(a, !!src)}</div>
        ${n > 1 ? `<button type="button" class="gb-nav gb-prev" data-gprev ${i === 0 ? 'disabled' : ''} aria-label="${esc(L('prev'))}" title="${esc(L('prev'))}">${glyphSvg('prev')}</button>
        <button type="button" class="gb-nav gb-next" data-gnext ${i === n - 1 ? 'disabled' : ''} aria-label="${esc(L('next'))}" title="${esc(L('next'))}">${glyphSvg('next')}</button>` : ''}
        ${n > 1 ? `<div class="gb-dots" role="tablist">${a.slides.map((_, k) => `<button type="button" class="gb-dot${k === i ? ' on' : ''}" data-gdot="${k}" role="tab" aria-selected="${k === i}" aria-label="${esc(L('slideN', { n: k + 1, m: n }))}"><i></i></button>`).join('')}</div>` : ''}
      </div>
      <div class="gb-side">
        <h3 class="gb-at">${esc(T(a.title))}${read.has(a.id) ? `<span class="gb-tick" title="${esc(L('read'))}">✓</span>` : ''}</h3>
        <p class="gb-cap" aria-live="polite"><small>${esc(L('slideN', { n: i + 1, m: n }))}</small>${esc(T(sl.text))}</p>
        ${sl.show ? `<button type="button" class="k-btn k-btn--primary k-btn--md gb-show" data-gshow>${icon('ab_spotters_eye', '◉', 'k-btn-ico')}<span class="k-btn-l">${esc(L('show'))}</span></button>` : ''}
        ${rel.length ? `<div class="gb-rel"><h4>${esc(L('related'))}</h4><div class="gb-rel-l">${rel.map((r) => `<button type="button" class="gb-relb${read.has(r.id) ? ' read' : ''}" data-gart="${esc(r.id)}">${icon(SECTION_ART[r.section][0], SECTION_ART[r.section][1], 'gb-relb-ico')}<span>${esc(T(r.title))}</span></button>`).join('')}</div></div>` : ''}
      </div>
    </div>`;
    const img = pane.querySelector<HTMLImageElement>('.gb-img');
    if (img) {
      img.onerror = () => img.closest('.gb-pic')?.classList.add('noimg');
      img.onload = () => img.closest('.gb-pic')?.classList.add('ok');
    }
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ id: a.id, slide: i }));
    } catch { /* private mode */ }
    if (i === n - 1) this.markRead(a.id);
  }

  /** The plate drawn by code under the picture (and in its place while there is none): the section's icon on the sea. */
  private plate(a: GuideArticle, hasImg: boolean): string {
    return `<div class="gb-plate${hasImg ? '' : ' alone'}" aria-hidden="true"><svg class="gb-rose" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="30"/><path d="M50 2v96M2 50h96M16 16l68 68M84 16L16 84"/><path class="gb-rose-s" d="M50 10l6 34 34 6-34 6-6 34-6-34-34-6 34-6z"/></svg>${icon(SECTION_ART[a.section][0], SECTION_ART[a.section][1], 'gb-plate-ico')}</div>`;
  }

  private goSlide(k: number): void {
    const a = this.article();
    if (!a) return;
    const at = this.at as { v: 'article'; id: string; slide: number };
    at.slide = Math.max(0, Math.min(a.slides.length - 1, k));
    const pane = this.over!.querySelector<HTMLElement>('.gb-pane')!;
    this.drawArticle(pane);
  }

  private step(d: number): void {
    if (this.at.v !== 'article') return;
    this.goSlide(this.at.slide + d);
  }

  /** «Показать в игре»: the book closes, the window opens, the finger points. */
  private show(): void {
    const a = this.article();
    if (!a || this.at.v !== 'article') return;
    const sl = a.slides[this.at.slide];
    if (!sl?.show) return;
    const why = this.d.openWindow(sl.show.open);
    if (why) {
      this.d.toast(L(why), 'info');
      if (why !== 'needIsle') return;
    }
    this.close();
    if (sl.show.point) {
      const sel = sl.show.point;
      setTimeout(() => this.d.point(sel, 6000), 260);
    }
  }

  /** Its last picture reached: read (the server records it and pays a section read through). */
  markRead(id: string): void {
    if (this.view.read.includes(id)) return;
    this.view = { ...this.view, read: [...this.view.read, id] };
    this.d.send({ t: 'guide_read', id });
    if (this.over) {
      this.drawRail();
      this.drawProgress();
    }
  }
}
