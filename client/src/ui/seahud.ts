// The sea HUD (docs/23 phase 2; owner, 2026-10-07: «перегруз интерфейса… выходя из порта нужно скрывать часть ui,
// давать только штурвал и всё необходимое»): one simple HUD for every input, built from the interface kit.
//   top left      the captain: her face and the bars of hull, men and sails (hud.ts), silver as a chip
//   top right     the minimap, the menu (a sheet of eight big tiles) and the counter of goals and news
//   top middle    her mark's line when she has one, a world boss's slim line, the sea's name a moment on entering
// On a touch screen (a phone, a tablet — the same controls on both):
//   bottom left   the helm stick and her speed under it (the ring round the wheel is the sail)
//   bottom right  in a fight only: «Огонь», big (a tap fires, a long press opens the wheel of shots, abilities,
//                 talents, the mount); beside it «Снаряд» (a tap loads the next shot), «Цель» (a tap takes the next ship
//                 as the mark, a long press opens her card) and «Особое» (the captain's best ready ability); «Действие»
//                 left of them whenever there is something to do (Атаковать, Абордаж, В порт, Высадка, Сеть…)
//   in port       the big round «В море» and «Действие» («Гавань»)
// Out of a fight the guns step aside: leaving port the screen holds the helm, the chart, the menu and what is to do.
// On a desk (owner: «на пк чисто через wasd и другие клавиши») there is no stick and no buttons for the fight: the keys
// do it all (WASD, Space «Огонь», Tab the next mark, 1–5 the shots, Z X C V the abilities), a small line of keys says
// so for the first minutes at sea, and the context row over the bottom edge keeps its key on each thing to do.
// Petty refusals (reloading, not on the beam) flash the button and buzz instead of a toast.
// «Подробный интерфейс» (settings: expertHud) brings the older full HUD back in its place.

import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/seahud.ts';
import { esc, icon } from './dom.ts';
import { buttonHtml, flash, setBadge } from './kit/button.ts';
import { attachWheel } from './kit/radial.ts';
import type { WheelOption } from './kit/radial.ts';
import { openSheet } from './kit/sheet.ts';
import type { SheetHandle } from './kit/sheet.ts';
import { TargetLine } from './kit/targetline.ts';
import type { TargetInfo } from './kit/targetline.ts';
import { menuLabel } from './menu.ts';
import type { MenuItem } from './menu.ts';

const L = dict(EN, RU);

/** The menu sheet's eight tiles; «Ещё» opens the full cabin menu (talents, company, shop, help, her island…). */
export const SEA_TILES: { id: MenuItem | 'more'; art: string; glyph: string }[] = [
  { id: 'map', art: 'menu_map', glyph: '🗺' },
  { id: 'hero', art: 'bt_captain', glyph: '⚔' },
  { id: 'ship', art: 'menu_ship', glyph: '⚓' },
  { id: 'crew', art: 'menu_crew', glyph: '☗' },
  { id: 'journal', art: 'tab_letters', glyph: '📜' },
  { id: 'chat', art: 'menu_chat', glyph: '✉' },
  { id: 'options', art: 'menu_options', glyph: '⚙' },
  { id: 'more', art: 'menu_cabin', glyph: '☰' },
];

/** The sail a pull of the helm stick asks for: nothing inside the dead middle, then 1–4 steps out to `reach`. */
export function stickSail(d: number, reach: number, dead: number): number | null {
  if (d < dead) return null;
  const f = Math.max(0, Math.min(1, (d - dead) / Math.max(1, reach - dead)));
  return Math.min(4, 1 + Math.floor(f * 4));
}

/** The server's small refusals that a phone answers with a flash and a buzz on the button, not a line of text
 *  (docs/23 item 29). Which button flashes. */
export function pettyOf(msg: string): 'fire' | 'special' | 'stick' | null {
  if (/^(Guns are still loading|Chasers are still loading|She is not on your beam|No ship in reach of your guns|Cannot fire now|Every gun on that side is dismounted)$/.test(msg)) return 'fire';
  if (/ is not ready$|needs full resolve|needs \d+ Dread|^Ultimates unlock at level 6$/.test(msg)) return 'special';
  if (/^The crew is still hauling the braces|^Cannot manoeuvre now$/.test(msg)) return 'stick';
  return null;
}

export interface SpecialCand {
  id: string;
  kind: 'active' | 'ultimate';
  ready: boolean;
  cooldown: number;
}

/** «Особое»: the captain's best ability ready now — the ultimate when it is, else the one with the longest cooldown
 *  (the strongest stroke). Null when none is ready. */
export function bestSpecial(list: SpecialCand[]): string | null {
  const ready = list.filter((a) => a.ready);
  if (!ready.length) return null;
  const ult = ready.find((a) => a.kind === 'ultimate');
  if (ult) return ult.id;
  return [...ready].sort((a, b) => b.cooldown - a.cooldown)[0].id;
}

export interface SeaAct {
  id: string;
  icon: string;
  label: string;
  sub?: string;
  /** How many more things there are to do (behind the long press). */
  more: number;
}

export interface SeaView {
  docked: boolean;
  /** A touch screen (the stick and the fight's buttons); a desk plays by its keys. */
  touch?: boolean;
  /** A fight is on or near (a mark, her guns busy, a foe close by): the guns' buttons come out. */
  fight?: boolean;
  act: SeaAct | null;
  special: { id: string; icon: string; name: string } | null;
  target: TargetInfo | null;
  /** The shot loaded and how many are left. */
  ammo: string;
  ammoN: number;
  /** The readier gun deck, 0 (just fired) – 1 (loaded). */
  reload: number;
  news: number;
  /** Chat lines and letters unread (the menu's badge). */
  unread: number;
}

/** A fight on the sea's screen: her mark, or the fight itself (old views without the field: a mark is one). */
export function inFight(v: SeaView): boolean {
  return !v.docked && (v.fight ?? !!v.target);
}

/** The things to touch the sea HUD shows for a view (seven at most: docs/23 item 32, owner 2026-10-07). The stick
 *  counts as one; the target's line on a touch screen is words, not a button (its card is «Цель»'s long press). A desk
 *  has no stick and no fight buttons: the captain's frame, her mark's line, the menu, the chart and the counter. */
export function seaTargets(v: SeaView): string[] {
  const out: string[] = [];
  const fight = inFight(v);
  if (v.touch === false) {
    out.push('captain', 'menu');
    if (v.target && !v.docked) out.push('target');
    out.push('minimap');
    if (v.news > 0) out.push('news');
    return out;
  }
  // In port the big round button is «В море» (docs/23 phase 6: casting off without opening the harbour).
  if (v.docked) out.push('cast');
  else {
    out.push('stick');
    if (fight) out.push('fire', 'ammo', 'lock');
  }
  if (v.act) out.push('act');
  if (v.special && fight) out.push('special');
  out.push('menu');
  if (!fight) {
    out.push('minimap');
    if (v.news > 0) out.push('news');
  }
  return out;
}

export interface SeaHooks {
  fire(): void;
  fireOptions(): WheelOption[];
  firePick(id: string): void;
  act(): void;
  actOptions(): WheelOption[];
  actPick(id: string): void;
  special(): void;
  /** In port: cast off. */
  sail(): void;
  /** «Снаряд»: the next shot she carries. */
  ammoNext(): void;
  /** «Цель»: the next ship as her mark. */
  nextTarget(): void;
  menu(id: MenuItem | 'more'): void;
  target(): void;
  /** The blocks that fold into the news sheet, by id (hud.ts FOLDED). */
  folded: readonly string[];
}

/** A press held this long is a long press (the card behind «Цель»). */
export const HOLD_MS = 450;

/** A tap and a long press on one button (a finger or a mouse; Enter and Space are a tap, Shift+Enter the hold). */
function tapOrHold(el: HTMLElement, tap: () => void, hold: () => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null, held = false, x0 = 0, y0 = 0;
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    held = false;
    x0 = e.clientX;
    y0 = e.clientY;
    stop();
    timer = setTimeout(() => {
      timer = null;
      held = true;
      hold();
    }, HOLD_MS);
  });
  el.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) stop();
  });
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!held) hold();
    held = true;
  });
  el.addEventListener('click', (e) => {
    stop();
    if (held) {
      held = false;
      return;
    }
    if (e.shiftKey && e.detail === 0) return hold();
    tap();
  });
}

export class SeaHud {
  private hooks: SeaHooks;
  readonly fireEl: HTMLButtonElement;
  readonly castEl: HTMLButtonElement;
  readonly actEl: HTMLButtonElement;
  readonly specialEl: HTMLButtonElement;
  readonly ammoEl: HTMLButtonElement;
  readonly lockEl: HTMLButtonElement;
  readonly menuEl: HTMLButtonElement;
  readonly newsEl: HTMLButtonElement;
  private target: TargetLine;
  private keys = new Map<string, string>();
  private menuSheet: SheetHandle | null = null;
  private newsSheet: SheetHandle | null = null;
  private view: SeaView | null = null;

  constructor(root: HTMLElement, hooks: SeaHooks) {
    this.hooks = hooks;
    const make = (html: string) => {
      const tpl = document.createElement('template');
      tpl.innerHTML = html.trim();
      const el = tpl.content.firstElementChild as HTMLElement;
      root.append(el);
      return el;
    };
    this.newsEl = make(buttonHtml({ kind: 'icon', id: 'tc-news', icon: 'goal', glyph: '!', aria: L('news'), cls: 'tc-news k-count sea-round hidden' })) as HTMLButtonElement;
    this.menuEl = make(buttonHtml({ kind: 'icon', id: 'tc-menu', icon: 'menu_cabin', glyph: '☰', aria: L('menu'), cls: 'sea-round' })) as HTMLButtonElement;
    // Her mark's line heads the top band (in the top stack, so a boss's line, the lesson and the toasts stand under it).
    const host = make('<div id="tc-target" class="hidden"></div>');
    document.getElementById('hud-stack')?.prepend(host);
    this.target = new TargetLine(host);
    this.target.onOpen = () => hooks.target();
    this.actEl = make(`<button type="button" id="tc-act" class="k-btn k-btn--primary k-btn--lg tc-act hidden" aria-label="${esc(L('act'))}"><span class="tc-act-ico"></span><span class="k-btn-l"></span><b class="tc-act-more hidden" aria-hidden="true"></b></button>`) as HTMLButtonElement;
    this.specialEl = make(`<button type="button" id="tc-special" class="k-btn k-btn--icon k-btn--lg tc-special sea-round hidden" aria-label=""></button>`) as HTMLButtonElement;
    this.ammoEl = make(`<button type="button" id="tc-ammo" class="k-btn k-btn--icon k-btn--lg tc-ammo sea-round" aria-label="${esc(L('ammoNone'))}"><span class="tc-ammo-pic"></span><b class="tc-ammo-n" aria-hidden="true"></b></button>`) as HTMLButtonElement;
    this.lockEl = make(`<button type="button" id="tc-lock" class="k-btn k-btn--icon k-btn--lg tc-lock sea-round" aria-label="${esc(L('lockNone'))}" title="${esc(L('lockNone'))}"><i class="tc-lock-x" aria-hidden="true"></i></button>`) as HTMLButtonElement;
    this.fireEl = make(`<button type="button" id="tc-fire" class="k-btn k-btn--icon tc-big" aria-label="${esc(L('fireAria'))}" title="${esc(L('fireAria'))}"><i class="tc-ring" aria-hidden="true"></i><span class="tc-big-pic">${icon('fire', '✸', 'tc-big-ico')}</span><span class="tc-big-l">${esc(L('fire'))}</span></button>`) as HTMLButtonElement;
    this.castEl = make(`<button type="button" id="tc-cast" class="k-btn k-btn--icon tc-big tc-sail hidden" aria-label="${esc(L('sailAria'))}" title="${esc(L('sailAria'))}"><span class="tc-big-pic">${icon('stat_sails', '⛵', 'tc-big-ico')}</span><span class="tc-big-l">${esc(L('sail'))}</span></button>`) as HTMLButtonElement;
    attachWheel(this.fireEl, { options: () => hooks.fireOptions(), onPick: (o) => hooks.firePick(o.id), onTap: () => hooks.fire(), title: L('wheelFire') });
    attachWheel(this.ammoEl, { options: () => hooks.fireOptions(), onPick: (o) => hooks.firePick(o.id), onTap: () => hooks.ammoNext(), title: L('wheelFire') });
    attachWheel(this.actEl, { options: () => hooks.actOptions(), onPick: (o) => hooks.actPick(o.id), onTap: () => hooks.act(), title: L('wheelAct') });
    tapOrHold(this.lockEl, () => hooks.nextTarget(), () => this.view?.target && hooks.target());
    this.castEl.addEventListener('click', () => hooks.sail());
    this.specialEl.addEventListener('click', () => hooks.special());
    this.menuEl.addEventListener('click', () => this.openMenu());
    this.newsEl.addEventListener('click', () => this.openNews());
  }

  /** Redraw what changed. */
  frame(v: SeaView): void {
    this.view = v;
    const lg = lang();
    if (this.keys.get('lang') !== lg) {
      // Another language: every word again.
      this.keys.clear();
      this.keys.set('lang', lg);
      this.fireEl.setAttribute('aria-label', L('fireAria'));
      this.fireEl.title = L('fireAria');
      this.fireEl.querySelector('.tc-big-l')!.textContent = L('fire');
      this.castEl.setAttribute('aria-label', L('sailAria'));
      this.castEl.title = L('sailAria');
      this.castEl.querySelector('.tc-big-l')!.textContent = L('sail');
      for (const [el, k] of [[this.menuEl, 'menu'], [this.newsEl, 'news']] as const) {
        el.setAttribute('aria-label', L(k));
        el.title = L(k);
      }
    }
    const body = document.body;
    const fight = inFight(v);
    body.classList.toggle('sea-target', !!v.target && !v.docked);
    body.classList.toggle('sea-fight', fight);
    body.classList.toggle('sea-docked', v.docked);
    this.castEl.classList.toggle('hidden', !v.docked);
    const a = v.act;
    this.once('act', a ? JSON.stringify([a.id, a.icon, a.label, a.sub, a.more]) : '', () => {
      this.actEl.classList.toggle('hidden', !a);
      if (!a) return void delete this.actEl.dataset.act;
      this.actEl.dataset.act = a.id;
      this.actEl.querySelector('.tc-act-ico')!.innerHTML = icon(a.icon, '•', 'k-btn-ico');
      this.actEl.querySelector('.k-btn-l')!.textContent = a.label;
      const words = a.sub ? `${a.label}: ${a.sub}` : a.label;
      this.actEl.setAttribute('aria-label', a.more ? `${words}. ${L('actMore', { n: a.more })}` : words);
      this.actEl.title = this.actEl.getAttribute('aria-label')!;
      const more = this.actEl.querySelector<HTMLElement>('.tc-act-more')!;
      more.classList.toggle('hidden', !a.more);
      more.textContent = a.more ? `+${a.more}` : '';
    });
    const sp = v.special;
    this.once('special', sp ? `${sp.id}|${sp.name}` : '', () => {
      this.specialEl.classList.toggle('hidden', !sp);
      if (!sp) return;
      this.specialEl.dataset.ab = sp.id;
      this.specialEl.innerHTML = icon(sp.icon, '✦', 'k-btn-ico');
      this.specialEl.setAttribute('aria-label', L('special', { name: sp.name }));
      this.specialEl.title = L('special', { name: sp.name });
    });
    this.target.set(v.docked ? null : v.target);
    this.once('lock', `${v.target ? v.target.name : ''}|${lg}`, () => {
      const t = v.target ? L('lock', { name: v.target.name }) : L('lockNone');
      this.lockEl.classList.toggle('on', !!v.target);
      this.lockEl.setAttribute('aria-label', t);
      this.lockEl.title = t;
    });
    this.once('ammo', `${v.ammo}|${v.ammoN}|${lg}`, () => {
      this.ammoEl.querySelector('.tc-ammo-pic')!.innerHTML = icon(`ammo_${v.ammo}`, '•', 'k-btn-ico');
      this.ammoEl.querySelector('.tc-ammo-n')!.textContent = v.ammoN > 999 ? '999+' : String(v.ammoN);
      const t = L('ammo', { n: v.ammoN });
      this.ammoEl.setAttribute('aria-label', t);
      this.ammoEl.title = t;
    });
    const rl = (Math.round(Math.max(0, Math.min(1, v.reload)) * 40) / 40).toFixed(3);
    this.once('reload', rl, () => {
      this.fireEl.style.setProperty('--rl', rl);
      this.fireEl.classList.toggle('loaded', v.reload >= 1);
    });
    this.once('news', String(v.news), () => {
      setBadge(this.newsEl, v.news);
      this.newsEl.classList.toggle('hidden', v.news <= 0);
    });
    this.once('unread', String(v.unread), () => setBadge(this.menuEl, v.unread));
  }

  /** The art has loaded: the pictures in place of the glyphs, and everything drawn again on the next frame. */
  dress(): void {
    const swap = (el: HTMLElement, sel: string, art: string, glyph: string, cls: string) => {
      const old = el.querySelector(sel);
      const t = document.createElement('template');
      t.innerHTML = icon(art, glyph, cls);
      const neu = t.content.firstElementChild;
      if (old && neu) old.replaceWith(neu);
    };
    swap(this.fireEl, '.tc-big-ico', 'fire', '✸', 'tc-big-ico');
    swap(this.castEl, '.tc-big-ico', 'stat_sails', '⛵', 'tc-big-ico');
    swap(this.menuEl, '.k-btn-ico', 'menu_cabin', '☰', 'k-btn-ico');
    swap(this.newsEl, '.k-btn-ico', 'goal', '!', 'k-btn-ico');
    this.keys.clear();
  }

  /** A small refusal: the button it is about flashes and the phone buzzes. True when it was one. */
  petty(msg: string): boolean {
    const which = pettyOf(msg);
    if (!which) return false;
    const el = which === 'fire' ? this.fireEl : which === 'special' ? this.specialEl : document.getElementById('tc-stick');
    if (el && el.getClientRects().length) flash(el);
    else try { navigator.vibrate?.(30); } catch { /* not allowed */ }
    return true;
  }

  flashFire(buzz = true): void {
    flash(this.fireEl, buzz);
  }

  /** «Цель» with no ship to take: a flash. */
  flashLock(): void {
    flash(this.lockEl, true);
  }

  get menuOpen(): boolean {
    return !!this.menuSheet?.open || !!this.newsSheet?.open;
  }

  closeSheets(): void {
    this.menuSheet?.close('code');
    this.newsSheet?.close('code');
  }

  private once(k: string, key: string, run: () => void): void {
    if (this.keys.get(k) === key) return;
    this.keys.set(k, key);
    run();
  }

  /** The menu: eight big tiles in a sheet. */
  openMenu(): void {
    if (this.menuSheet?.open) return;
    const unread = this.view?.unread ?? 0;
    const tiles = SEA_TILES.map((x) => `<button type="button" class="k-btn k-btn--secondary k-tile" data-tile="${x.id}"><span class="k-tile-pic">${icon(x.art, x.glyph, 'k-tile-ico')}${x.id === 'chat' && unread > 0 ? `<b class="k-badge" aria-hidden="true">${unread > 9 ? '9+' : unread}</b>` : ''}</span><span class="k-btn-l">${esc(x.id === 'more' ? L('more') : menuLabel(x.id))}</span></button>`).join('');
    this.menuSheet = openSheet({ title: L('menu'), body: `<div class="k-tiles">${tiles}</div>`, height: 'auto', cls: 'sea-menu' });
    this.menuSheet.body.querySelectorAll<HTMLElement>('[data-tile]').forEach((b) => b.addEventListener('click', () => {
      this.menuSheet?.close('button');
      this.hooks.menu(b.dataset.tile as MenuItem | 'more');
    }));
  }

  /** Goals, news, hints, holidays, quests: the folded blocks themselves, lent to a sheet while it is up (they keep
   *  their buttons and go on updating), given back to the HUD's stack when it goes. */
  openNews(): void {
    if (this.newsSheet?.open) return;
    this.newsSheet = this.lend(this.hooks.folded, 'news');
  }

  /** HUD blocks (by id) shown in a sheet: moved in while it is up, put back where they stood when it goes. */
  lend(ids: readonly string[], title: 'news' | 'target'): SheetHandle {
    const box = document.createElement('div');
    box.className = 'sea-lent';
    const lent: { el: HTMLElement; mark: Comment }[] = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el || el.classList.contains('hidden')) continue;
      const mark = document.createComment(id);
      el.replaceWith(mark);
      box.append(el);
      lent.push({ el, mark });
    }
    if (!lent.length) box.innerHTML = `<p class="muted">${esc(L('newsEmpty'))}</p>`;
    return openSheet({
      title: L(title), body: box, height: title === 'target' ? 'auto' : 0.75, cls: 'sea-lent-sheet',
      onClose: () => { for (const x of lent) x.mark.replaceWith(x.el); },
    });
  }
}

/** The desk's line of keys (owner, 2026-10-07: «на пк чисто через wasd и другие клавиши»): what moves her, fires and
 *  picks a mark, from the captain's own keymap; in port, how to cast off. `key` names an action's first key. */
export function keyHintHtml(docked: boolean, key: (a: string) => string): string {
  const k = (...a: string[]) => a.map((x) => key(x)).filter((x) => x && x !== '—').map((x) => `<kbd>${esc(x)}</kbd>`).join('');
  const part = (keys: string, word: keyof typeof EN) => (keys ? `<span>${keys}<em>${esc(L(word))}</em></span>` : '');
  if (docked) return [part(k('dock'), 'k.cast'), part(k('harbour'), 'k.harbour'), part(k('map'), 'k.map')].join('');
  return [
    part(k('sailUp', 'sailDown'), 'k.sail'), part(k('rudderLeft', 'rudderRight'), 'k.helm'), part(k('fire'), 'k.fire'), part(k('target'), 'k.target'),
    part(`${k('ammo1')}${key('ammo1') && key('ammo5') ? '<i>–</i>' : ''}${k('ammo5')}`, 'k.ammo'), part(k('abilityZ', 'abilityX', 'abilityC', 'abilityV'), 'k.abil'), part('<kbd>Esc</kbd>', 'k.menu'),
  ].join('');
}

/** The hold of the stick in the middle that takes all sail in (ms), and the double tap's window. */
export const STICK_REEF_MS = 600;
export const STICK_DOUBLE_MS = 320;

/** The HUD's words (the stick's help, «Паруса убраны»). */
export const seaWord = (k: keyof typeof EN, v?: Record<string, string | number>): string => L(k, v);
