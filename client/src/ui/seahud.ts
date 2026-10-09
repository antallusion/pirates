// The sea HUD (docs/23 phase 2; owner, 2026-10-07: «перегруз интерфейса… выходя из порта нужно скрывать часть ui,
// давать только штурвал и всё необходимое»; then «ты удалил всё, что было, и штурвал и вообще всё… возвращай иконки,
// обводки графические… штурвал на мобилах… сделать круче»): one HUD for every input, every control a painted icon in
// its painted rim (the brass porthole ring, ui.ring; the iron slot, ui.slot; the helm on its compass, ui.helm and
// ui.stick_base), built from the interface kit.
//   top left      the captain: her face in the porthole ring, her level on its rim, the bars of hull, men and sails in
//                 their brass sheaths (hud.ts), silver as a chip
//   top right     the minimap in its compass ring, the menu (a sheet of eight big tiles) and the counter of goals and news
//   top middle    her mark's line when she has one, a world boss's slim line, the sea's name a moment on entering
//   bottom left   the helm on its compass rose, the sail as a gold ring round it, her speed under it
// On a touch screen (a phone, a tablet — the same controls on both):
//   bottom right  in a fight only: «Огонь», big (a tap fires, a long press opens the wheel of shots, abilities,
//                 talents, the mount); beside it «Снаряд» (a tap loads the next shot), «Цель» (a tap takes the next ship
//                 as the mark, a long press opens her card) and «Особое» (the captain's best ready ability); «Действие»
//                 left of them whenever there is something to do (Атаковать, Абордаж, В порт, Высадка, Сеть…)
//   in port       the big round «В море» and «Действие» («Гавань»)
// On a desk (owner: «на пк чисто через wasd и другие клавиши» — played by its keys, the controls still drawn): the
// same helm, its keys on chips round the wheel (W S the sails, A D the rudder, Shift the dash); bottom right the gun
// deck — «Огонь» big with its reload ring, «Цель» over it, and beside it two rows of painted slots, the captain's
// abilities (Z X C V, their cooldowns sweeping) over the shots (1–5, the loaded one lit, her count on each) — every
// key on a chip on its rim. A click works too; the keys do it all. The context row over the bottom edge keeps its key
// on each thing to do.
// Petty refusals (reloading, not on the beam) flash the button and buzz instead of a toast.
// «Подробный интерфейс» (settings: expertHud) brings the older full HUD back in its place.

import { assetUrl } from '../assets.ts';
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

/** A painted slot of the desk's gun deck: a shot (1–5) or one of the captain's abilities (Z X C V). */
export interface DeckSlot {
  kind: 'shot' | 'abil';
  id: string;
  /** Art id for icon() (`ammo_round`, `ab_double_shot`). */
  art: string;
  /** The key on its rim ('1', 'Z'); '' for none. */
  key: string;
  name: string;
  /** Its tooltip (the name and what it does). */
  title: string;
  /** A shot's count aboard. */
  n?: number;
  /** The shot loaded now. */
  sel?: boolean;
  /** The best shot for her mark (docs/23 item 39). */
  best?: boolean;
  ult?: boolean;
  /** The words on a locked one (an ultimate before level 6). */
  locked?: string;
  /** Not to be used now (no resolve, no Dread, none aboard). */
  dim?: boolean;
  /** An ultimate's resolve, 0–1, while it gathers. */
  charge?: number | null;
  /** The cooldown left, 0–1, and in seconds. */
  cd?: number;
  left?: number;
}

/** The desk's keys as they read on the chips (the captain's own keymap); '' or '—' for a key bound to nothing. */
export interface SeaKeys {
  fire: string;
  target: string;
  menu: string;
  map: string;
  up: string;
  down: string;
  left: string;
  right: string;
  dash: string;
  cast: string;
}

export interface SeaView {
  docked: boolean;
  /** A touch screen (the stick and the fight's buttons); a desk plays by its keys. */
  touch?: boolean;
  /** The desk's gun deck: the abilities, then the shots (none on a touch screen: the wheel under «Огонь» has them). */
  deck?: DeckSlot[] | null;
  /** The desk's keys for the chips on the controls' rims. */
  keys?: SeaKeys | null;
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
  /** Her mark's id (a new one puts the chart away again). */
  markId?: number | null;
  /** «Мини-карта при цели: всегда показывать» (settings.ts mmTarget 'show'). */
  mmShow?: boolean;
  /** She tapped the chart's tab: the chart and the menu are back for this mark (SeaHud keeps it). */
  mmOut?: boolean;
}

/** A fight on the sea's screen: her mark, or the fight itself (old views without the field: a mark is one). */
export function inFight(v: SeaView): boolean {
  return !v.docked && (v.fight ?? !!v.target);
}

/** The chart in the top right corner (owner, 2026-10-09: «по-умолчанию пусть скрывается немного, типа вверх или вбок
 *  заезжает, но если тапнуть то можно вернуть»): 'shown' as ever; on a touch screen with a mark or a fight 'peek' —
 *  stepped up out of the corner with the menu, a tab of its ring left to tap them back (one thing to touch for two, so
 *  the fight keeps seven) — or 'out' — back by her tap until the next mark, or always by the setting. */
export function minimapMode(v: SeaView): 'shown' | 'peek' | 'out' {
  if (v.touch === false || !inFight(v)) return 'shown';
  return v.mmShow || v.mmOut ? 'out' : 'peek';
}

/** The things to touch the sea HUD shows for a view (seven at most on a touch screen: docs/23 item 32, owner
 *  2026-10-07 — eight in a fight only when she brings the chart and the menu back herself, by the tab or the setting).
 *  The stick counts as one; the target's line on a touch screen is words, not a button (its card is
 *  «Цель»'s long press). A desk is played by its keys and shows what they drive (owner, 2026-10-07: «возвращай
 *  управление… штурвал»): the captain's frame, the menu, her mark's line, the chart and the counter, and at sea the
 *  helm, «Огонь», «Цель» and the gun deck (one group of key-driven slots) — nine at most; in port «В море». */
export function seaTargets(v: SeaView): string[] {
  const out: string[] = [];
  const fight = inFight(v);
  if (v.touch === false) {
    out.push('captain', 'menu');
    if (v.target && !v.docked) out.push('target');
    out.push('minimap');
    if (v.news > 0) out.push('news');
    if (v.docked) out.push('cast');
    else out.push('stick', 'fire', 'lock', 'deck');
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
  // A fight: the chart and the menu stepped up behind their tab, or back by her own choice (the tab's tap, the setting).
  const mm = minimapMode(v);
  if (mm === 'peek') out.push('mmtab');
  else out.push('menu', 'minimap');
  if (!fight && v.news > 0) out.push('news');
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
  /** The desk's gun deck: a shot loaded, an ability used (at her mark). */
  ammo(id: string): void;
  ability(id: string): void;
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

/** The art of the controls that are not a shot or an ability (their glyphs stand in while it loads). */
export const SEA_ART = { fire: 'fire', cast: 'stat_sails', lock: 'item_ranging_glass', menu: 'menu_cabin', news: 'goal', dash: 'dash', dashAlt: 'ab_hard_over' } as const;

/** A key's words fit for a chip: none for a key bound to nothing. */
export const chipKey = (k: string | undefined): string => (!k || k === '—' ? '' : k);

/** A control's tooltip with its key (a desk). */
const withKey = (words: string, k: string): string => (k ? `${words} [${k}]` : words);

/** A painted slot of the desk's gun deck: the art in its iron frame (ui.slot), the key on the rim's top left, a
 *  shot's count on its bottom right, an ability's cooldown sweeping over it with its seconds. */
export function deckSlotHtml(s: DeckSlot): string {
  const cls = ['dk-slot', `dk-${s.kind}`, s.sel ? 'sel' : '', s.best ? 'best' : '', s.ult ? 'ult' : '', s.locked ? 'locked' : '', s.dim ? 'dim' : ''].filter(Boolean).join(' ');
  const data = s.kind === 'shot' ? `data-shot="${esc(s.id)}"` : `data-ab="${esc(s.id)}"`;
  const label = withKey(s.kind === 'shot' && s.n !== undefined ? `${s.name}: ${s.n}` : s.name, s.key);
  return `<button type="button" class="${cls}" ${data} aria-label="${esc(label)}" title="${esc(withKey(s.title, s.key))}"${s.sel ? ' aria-pressed="true"' : ''}>`
    + `${icon(s.art, s.key || '•', 'dk-ico')}`
    + (s.kind === 'abil' ? `<i class="dk-cd" aria-hidden="true"></i><span class="dk-cdt" aria-hidden="true">${s.locked ? esc(s.locked) : ''}</span>${s.charge !== null && s.charge !== undefined ? '<i class="dk-charge" aria-hidden="true"><i></i></i>' : ''}` : '')
    + (s.key ? `<kbd class="kc kc-tl" aria-hidden="true">${esc(s.key)}</kbd>` : '')
    + (s.kind === 'shot' && s.n !== undefined ? `<b class="dk-n" aria-hidden="true">${s.n > 999 ? '999+' : s.n}</b>` : '')
    + '</button>';
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
  /** The chart's tab while the chart and the menu are stepped up out of the corner (a mark on a touch screen). */
  readonly mmTabEl: HTMLButtonElement;
  /** She tapped the tab: the chart and the menu back for this mark; the mark it was for. */
  private mmOut = false;
  private mmMark: number | null = null;
  /** The desk's gun deck: two rows of painted slots, the abilities over the shots. */
  readonly deckEl: HTMLElement;
  private target: TargetLine;
  private keys = new Map<string, string>();
  private menuSheet: SheetHandle | null = null;
  private newsSheet: SheetHandle | null = null;
  private view: SeaView | null = null;
  /** The deck's ability slots by id, their sweep, seconds and resolve kept to move in place every frame. */
  private cdEls = new Map<string, { slot: HTMLElement; cd: HTMLElement; cdt: HTMLElement; charge: HTMLElement | null }>();

  constructor(root: HTMLElement, hooks: SeaHooks) {
    this.hooks = hooks;
    const make = (html: string) => {
      const tpl = document.createElement('template');
      tpl.innerHTML = html.trim();
      const el = tpl.content.firstElementChild as HTMLElement;
      root.append(el);
      return el;
    };
    this.newsEl = make(buttonHtml({ kind: 'icon', id: 'tc-news', icon: SEA_ART.news, glyph: '!', aria: L('news'), cls: 'tc-news k-count sea-round hidden' })) as HTMLButtonElement;
    this.menuEl = make(buttonHtml({ kind: 'icon', id: 'tc-menu', icon: SEA_ART.menu, glyph: '☰', aria: L('menu'), cls: 'sea-round' })) as HTMLButtonElement;
    // The chart's tab (owner, 2026-10-09): the bottom of its compass ring and a brass tab hanging from the top edge; a tap
    // brings the chart and the menu back down for this mark.
    this.mmTabEl = make(`<button type="button" id="mm-tab" class="mm-tab hidden" aria-label="${esc(L('mmShow'))}" title="${esc(L('mmShow'))}"><span class="mm-tab-pill">${icon('menu_map', '', 'mm-tab-ico')}<i class="mm-tab-chev" aria-hidden="true"></i></span></button>`) as HTMLButtonElement;
    this.mmTabEl.addEventListener('click', () => {
      this.mmOut = true;
      this.applyMinimap();
    });
    // Her mark's line heads the top band (in the top stack, so a boss's line, the lesson and the toasts stand under it).
    const host = make('<div id="tc-target" class="hidden"></div>');
    document.getElementById('hud-stack')?.prepend(host);
    this.target = new TargetLine(host);
    this.target.onOpen = () => hooks.target();
    this.actEl = make(`<button type="button" id="tc-act" class="k-btn k-btn--primary k-btn--lg tc-act hidden" aria-label="${esc(L('act'))}"><span class="tc-act-ico"></span><span class="k-btn-l"></span><b class="tc-act-more hidden" aria-hidden="true"></b></button>`) as HTMLButtonElement;
    this.specialEl = make(`<button type="button" id="tc-special" class="k-btn k-btn--icon k-btn--lg tc-special sea-round hidden" aria-label=""></button>`) as HTMLButtonElement;
    this.ammoEl = make(`<button type="button" id="tc-ammo" class="k-btn k-btn--icon k-btn--lg tc-ammo sea-round" aria-label="${esc(L('ammoNone'))}"><span class="tc-ammo-pic"></span><b class="tc-ammo-n" aria-hidden="true"></b></button>`) as HTMLButtonElement;
    this.lockEl = make(`<button type="button" id="tc-lock" class="k-btn k-btn--icon k-btn--lg tc-lock sea-round" aria-label="${esc(L('lockNone'))}" title="${esc(L('lockNone'))}">${icon(SEA_ART.lock, '◎', 'k-btn-ico')}<kbd class="kc kc-b" aria-hidden="true"></kbd></button>`) as HTMLButtonElement;
    this.fireEl = make(`<button type="button" id="tc-fire" class="k-btn k-btn--icon tc-big" aria-label="${esc(L('fireAria'))}" title="${esc(L('fireAria'))}"><i class="tc-ring" aria-hidden="true"></i><span class="tc-big-pic">${icon(SEA_ART.fire, '✸', 'tc-big-ico')}</span><span class="tc-big-l">${esc(L('fire'))}</span><kbd class="kc kc-b" aria-hidden="true"></kbd></button>`) as HTMLButtonElement;
    this.castEl = make(`<button type="button" id="tc-cast" class="k-btn k-btn--icon tc-big tc-sail hidden" aria-label="${esc(L('sailAria'))}" title="${esc(L('sailAria'))}"><span class="tc-big-pic">${icon(SEA_ART.cast, '⛵', 'tc-big-ico')}</span><span class="tc-big-l">${esc(L('sail'))}</span><kbd class="kc kc-b" aria-hidden="true"></kbd></button>`) as HTMLButtonElement;
    this.deckEl = make(`<div id="tc-deck" class="sea-deck hidden" role="toolbar" aria-label="${esc(L('deck'))}"><div class="dk-row dk-abil"></div><div class="dk-row dk-shots"></div></div>`);
    attachWheel(this.fireEl, { options: () => hooks.fireOptions(), onPick: (o) => hooks.firePick(o.id), onTap: () => hooks.fire(), title: L('wheelFire') });
    attachWheel(this.ammoEl, { options: () => hooks.fireOptions(), onPick: (o) => hooks.firePick(o.id), onTap: () => hooks.ammoNext(), title: L('wheelFire') });
    attachWheel(this.actEl, { options: () => hooks.actOptions(), onPick: (o) => hooks.actPick(o.id), onTap: () => hooks.act(), title: L('wheelAct') });
    tapOrHold(this.lockEl, () => hooks.nextTarget(), () => this.view?.target && hooks.target());
    this.castEl.addEventListener('click', () => hooks.sail());
    this.specialEl.addEventListener('click', () => hooks.special());
    this.menuEl.addEventListener('click', () => this.openMenu());
    this.newsEl.addEventListener('click', () => this.openNews());
    this.deckEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.dk-slot');
      if (!b) return;
      if (b.dataset.shot) hooks.ammo(b.dataset.shot);
      else if (b.dataset.ab) hooks.ability(b.dataset.ab);
    });
    // The keys' chips on the helm (the sails over and under it, the rudder either side, the dash by its chip) and on
    // the chart (the world's map).
    const stick = document.getElementById('tc-stick');
    if (stick) for (const k of ['up', 'down', 'left', 'right', 'dash']) stick.insertAdjacentHTML('beforeend', `<kbd class="kc kc-helm kc-${k}" aria-hidden="true"></kbd>`);
    document.getElementById('hud-map')?.insertAdjacentHTML('beforeend', '<kbd class="kc kc-map" aria-hidden="true"></kbd>');
    this.menuEl.insertAdjacentHTML('beforeend', '<kbd class="kc kc-b" aria-hidden="true"></kbd>');
  }

  /** Redraw what changed. */
  frame(v: SeaView): void {
    this.view = v;
    const lg = lang();
    const k = v.touch === false && v.keys ? v.keys : null;
    const key = (x: keyof SeaKeys) => chipKey(k?.[x]);
    const words = `${lg}|${k ? JSON.stringify(k) : ''}`;
    if (this.keys.get('lang') !== words) {
      // Another language or another key: every word again.
      this.keys.clear();
      this.keys.set('lang', words);
      this.fireEl.setAttribute('aria-label', withKey(L('fireAria'), key('fire')));
      this.fireEl.title = withKey(L('fireAria'), key('fire'));
      this.fireEl.querySelector('.tc-big-l')!.textContent = L('fire');
      this.castEl.setAttribute('aria-label', withKey(L('sailAria'), key('cast')));
      this.castEl.title = withKey(L('sailAria'), key('cast'));
      this.castEl.querySelector('.tc-big-l')!.textContent = L('sail');
      for (const [el, w, x] of [[this.menuEl, 'menu', 'menu'], [this.newsEl, 'news', '']] as const) {
        el.setAttribute('aria-label', withKey(L(w), x ? key(x) : ''));
        el.title = withKey(L(w), x ? key(x) : '');
      }
      this.deckEl.setAttribute('aria-label', L('deck'));
      // the chips: the key's own words, none where the key is bound to nothing
      const chip = (el: Element | null, x: keyof SeaKeys) => {
        if (!el) return;
        el.textContent = key(x);
        el.classList.toggle('hidden', !key(x));
        el.classList.toggle('kc-long', key(x).length > 2);
      };
      chip(this.fireEl.querySelector('.kc'), 'fire');
      chip(this.castEl.querySelector('.kc'), 'cast');
      chip(this.lockEl.querySelector('.kc'), 'target');
      chip(this.menuEl.querySelector('.kc'), 'menu');
      chip(document.querySelector('#hud-map > .kc-map'), 'map');
      for (const x of ['up', 'down', 'left', 'right', 'dash'] as const) chip(document.querySelector(`#tc-stick > .kc-${x}`), x);
      const stick = document.getElementById('tc-stick');
      if (stick) stick.title = k ? L('helmDesk', { up: key('up'), down: key('down'), left: key('left'), right: key('right'), dash: key('dash') }) : '';
    }
    const body = document.body;
    const fight = inFight(v);
    body.classList.toggle('sea-target', !!v.target && !v.docked);
    body.classList.toggle('sea-fight', fight);
    // The chart and the menu: stepped up with a mark, back by her tap until the next mark (the fight over: up again).
    const mark = fight ? v.markId ?? null : null;
    if (!fight || (mark !== null && mark !== this.mmMark)) this.mmOut = false;
    if (mark !== null || !fight) this.mmMark = mark;
    this.applyMinimap();
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
    this.once('lock', `${v.target ? v.target.name : ''}|${lg}|${key('target')}`, () => {
      const t = withKey(v.target ? L('lock', { name: v.target.name }) : L('lockNone'), key('target'));
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
    this.once('unread', String(v.unread), () => {
      setBadge(this.menuEl, v.unread);
      setBadge(this.mmTabEl, v.unread); // (the menu's letters on its tab while it is up)
    });
    this.drawDeck(v.touch === false && !v.docked ? v.deck ?? null : null);
  }

  /** The chart's place as the view and her tap say (body.mm-peek: stepped up behind its tab; body.mm-out: back). */
  private applyMinimap(): void {
    const mode = this.view ? minimapMode({ ...this.view, mmOut: this.mmOut }) : 'shown';
    const body = document.body;
    if (body.classList.contains('mm-peek') !== (mode === 'peek')) body.classList.toggle('mm-peek', mode === 'peek');
    if (body.classList.contains('mm-out') !== (mode === 'out')) body.classList.toggle('mm-out', mode === 'out');
    this.mmTabEl.classList.toggle('hidden', mode !== 'peek');
  }

  /** A tap on the chart (main.ts): back up behind its tab when she brought it down for this mark (owner's «тапнуть —
   *  вернуть»; a tap again puts it away); true when it went, false when the tap is the chart's own (the world map). */
  mapTap(): boolean {
    if (!this.view || this.view.mmShow || !this.mmOut || minimapMode({ ...this.view, mmOut: true }) !== 'out') return false;
    this.mmOut = false;
    this.applyMinimap();
    return true;
  }

  /** The desk's gun deck: rebuilt when what it holds changes (a shot taken, a count, a lock), its cooldowns moved in
   *  place every frame. */
  private drawDeck(deck: DeckSlot[] | null): void {
    const list = deck ?? [];
    this.once('deck', JSON.stringify(list.map((s) => [s.id, s.key, s.n, s.sel, s.best, s.locked, s.dim, s.charge === null || s.charge === undefined ? 0 : 1, s.title, s.art])), () => {
      const row = (kind: DeckSlot['kind']) => list.filter((s) => s.kind === kind).map(deckSlotHtml).join('');
      this.deckEl.querySelector('.dk-abil')!.innerHTML = row('abil');
      this.deckEl.querySelector('.dk-shots')!.innerHTML = row('shot');
      this.deckEl.classList.toggle('hidden', !list.length);
      this.cdEls = new Map([...this.deckEl.querySelectorAll<HTMLElement>('[data-ab]')].map((el) => [el.dataset.ab!, {
        slot: el, cd: el.querySelector<HTMLElement>('.dk-cd')!, cdt: el.querySelector<HTMLElement>('.dk-cdt')!, charge: el.querySelector<HTMLElement>('.dk-charge > i'),
      }]));
    });
    for (const s of list) {
      if (s.kind !== 'abil') continue;
      const e = this.cdEls.get(s.id);
      if (!e) continue;
      const f = (Math.round(Math.max(0, Math.min(1, s.cd ?? 0)) * 120) / 120).toFixed(3);
      if (e.slot.style.getPropertyValue('--cd') !== f) {
        e.slot.style.setProperty('--cd', f);
        e.slot.classList.toggle('cooling', Number(f) > 0);
      }
      if (!s.locked) {
        const t = (s.left ?? 0) > 0 && (s.cd ?? 0) > 0 ? String(Math.ceil(s.left!)) : '';
        if (e.cdt.textContent !== t) e.cdt.textContent = t;
      }
      if (e.charge) {
        const w = `${Math.round(Math.max(0, Math.min(1, s.charge ?? 0)) * 100)}%`;
        if (e.charge.style.width !== w) e.charge.style.width = w;
      }
    }
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
    swap(this.fireEl, '.tc-big-ico', SEA_ART.fire, '✸', 'tc-big-ico');
    swap(this.castEl, '.tc-big-ico', SEA_ART.cast, '⛵', 'tc-big-ico');
    swap(this.menuEl, '.k-btn-ico', SEA_ART.menu, '☰', 'k-btn-ico');
    swap(this.newsEl, '.k-btn-ico', SEA_ART.news, '!', 'k-btn-ico');
    swap(this.lockEl, '.k-btn-ico', SEA_ART.lock, '◎', 'k-btn-ico');
    const pill = this.mmTabEl.querySelector('.mm-tab-pill');
    if (pill) pill.innerHTML = `${icon('menu_map', '', 'mm-tab-ico')}<i class="mm-tab-chev" aria-hidden="true"></i>`;
    // the target line's «в дальности» on a narrow screen: the gun's picture (seahud.css)
    const gun = assetUrl(`icon.${SEA_ART.fire}`);
    if (gun) document.documentElement.style.setProperty('--ico-range', `url('${gun}')`);
    // the dash's chip on the helm: its painted picture (a ship at full stretch), not a «»» set in letters
    const dash = document.getElementById('tc-dashchip');
    if (dash) dash.innerHTML = icon(assetUrl(`icon.${SEA_ART.dash}`) ? SEA_ART.dash : SEA_ART.dashAlt, '', 'tc-dash-ico');
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

/** The hold of the stick in the middle that takes all sail in (ms), and the double tap's window. */
export const STICK_REEF_MS = 600;
export const STICK_DOUBLE_MS = 320;

/** The HUD's words (the stick's help, «Паруса убраны»). */
export const seaWord = (k: keyof typeof EN, v?: Record<string, string | number>): string => L(k, v);
