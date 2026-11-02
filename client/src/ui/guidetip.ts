// «Лоцманская книга»: the first-time tips (2026-11-02). The first time she meets a mechanic — a wreck in reach, her own
// island, a ship that struck to her, a harbour, a boarding, a treasure map, an overloaded hold, a skull… — a small pill
// comes at the top edge: «Новое: <статья> — как это работает», «Читать» and ✕. It is not modal (the sea goes on under
// it), hides itself after 8 s, and comes once a trigger an account (the server keeps what was shown: `guide_seen`).
// Never in a boarding battle, never over a window, never in the First Watch's lessons: it waits for them to end.
// Only a trigger some article names (GuideArticle.firstTime) shows anything; the content decides which.

import type { GuideArticle } from '../../../shared/src/data/guide/types.ts';
import { GUIDE_TRIGGERS } from '../../../shared/src/data/guide/triggers.ts';
import type { GuideTrigger } from '../../../shared/src/data/guide/triggers.ts';
import type { ServerMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/guide.ts';
import { settings } from '../settings.ts';
import { esc, glyphSvg, icon } from './dom.ts';
import { SECTION_ART } from './guide.ts';

const L = dict(EN, RU);
const T = (x: readonly [string, string]): string => x[lang() === 'ru' ? 1 : 0];

/** How long a tip stays, and the pause between two. */
export const TIP_MS = 8000;
const REST_MS = 3000;

/** The trigger a message from the server is the first sight of, if any. */
export function guideMsgTrigger(m: ServerMsg): GuideTrigger | null {
  switch (m.t) {
    case 'port':
      return m.view ? 'first-port' : null;
    case 'surrender_offer':
      return m.offer ? 'struck-pirate' : null;
    case 'board_tac':
    case 'board_fight':
      return m.view ? 'first-boarding' : null;
    case 'barter':
      return m.view ? 'first-trade' : null;
    case 'dive':
      return m.view ? 'dive' : null;
    case 'shoals':
      return m.list.length ? 'fishing' : null;
    default:
      return null;
  }
}

/** What the sea about her shows (looked at once a second): each trigger that holds now. Pure, for the tests. */
export interface GuideFacts {
  atSea: boolean;
  /** The First Watch's lessons are on (no tips over them). */
  lesson: boolean;
  homeIsle: boolean;
  maps: number;
  overload: boolean;
  skulls: number;
  storm: boolean;
  lighthouse: boolean;
  /** A wreck of the dense sea within reach. */
  wreck: boolean;
  level: number;
  quests: number;
}

export function guideStateTriggers(f: GuideFacts): GuideTrigger[] {
  const out: GuideTrigger[] = [];
  if (f.lesson) return out;
  if (f.atSea) out.push('first-sea');
  if (f.homeIsle) out.push('first-isle');
  if (f.maps > 0) out.push('treasure-map');
  if (f.overload) out.push('overload');
  if (f.skulls > 0) out.push('skull');
  if (f.atSea && f.storm) out.push('storm');
  if (f.atSea && f.lighthouse) out.push('lighthouse');
  if (f.atSea && f.wreck) out.push('wreck-near');
  if (f.level >= 2) out.push('level-2');
  if (f.quests > 0) out.push('first-quest');
  return out;
}

const KNOWN = new Set<string>(GUIDE_TRIGGERS);

export interface GuideTipDeps {
  /** The articles (the shared index). */
  list(): readonly GuideArticle[];
  /** Tips already shown to this account (the server's view); null until it came. */
  seen(): readonly string[] | null;
  markSeen(key: string): void;
  read(id: string): void;
  /** Now is no time for a tip (a battle, a window, the book, a lesson). */
  blocked(): boolean;
}

export class GuideTips {
  private d: GuideTipDeps;
  private queue: string[] = [];
  /** Shown this session (the server's word may come late). */
  private done = new Set<string>();
  private showing: { key: string; id: string; until: number } | null = null;
  private restAt = 0;
  private el: HTMLElement | null = null;

  constructor(d: GuideTipDeps) {
    this.d = d;
  }

  /** The article a trigger opens (the first naming it), if any. */
  articleFor(key: string): GuideArticle | undefined {
    return this.d.list().find((a) => a.firstTime === key);
  }

  offer(key: string | null): void {
    if (!key || !KNOWN.has(key) || this.done.has(key) || this.queue.includes(key) || this.showing?.key === key) return;
    if (this.d.seen()?.includes(key)) return;
    if (!this.articleFor(key)) return;
    this.queue.push(key);
  }

  /** Each frame (cheap: nothing to do most of the time). */
  frame(now: number): void {
    if (!settings().firstHints) {
      this.queue = [];
      if (this.showing) this.hide(now);
      return;
    }
    const seen = this.d.seen();
    if (this.showing && (now > this.showing.until || this.d.blocked())) this.hide(now);
    if (this.showing || !this.queue.length || seen === null || now < this.restAt || this.d.blocked()) return;
    const key = this.queue.shift()!;
    const a = this.articleFor(key);
    if (!a || seen.includes(key) || this.done.has(key)) return;
    this.done.add(key);
    this.d.markSeen(key);
    this.showing = { key, id: a.id, until: now + TIP_MS };
    this.draw(a);
  }

  isShown(): boolean {
    return !!this.showing;
  }

  private draw(a: GuideArticle): void {
    if (!this.el) {
      const el = document.createElement('aside');
      el.id = 'guide-tip';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.addEventListener('click', (e) => {
        const t = e.target as Element;
        if (t.closest('[data-gtx]')) return this.hide(performance.now());
        if (t.closest('[data-gtr]') && this.showing) {
          const id = this.showing.id;
          this.hide(performance.now());
          this.d.read(id);
        }
      });
      document.body.appendChild(el);
      this.el = el;
    }
    this.el.innerHTML = `${icon(SECTION_ART[a.section][0], SECTION_ART[a.section][1], 'gt-ico')}<span class="gt-t">${esc(L('tipNew', { title: T(a.title) }))}</span><button type="button" class="gt-read" data-gtr>${esc(L('tipRead'))}</button><button type="button" class="gt-x" data-gtx aria-label="${esc(L('tipClose'))}" title="${esc(L('tipClose'))}">${glyphSvg('close')}</button>`;
    this.el.classList.remove('hidden');
  }

  private hide(now: number): void {
    this.showing = null;
    this.restAt = now + REST_MS;
    this.el?.classList.add('hidden');
  }
}
