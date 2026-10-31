// The harbour's ring (forum 40, approved by the owner: «Добавить на порты такое же радиальное меню как на пирате с
// разделами «Войти в порт», «Приблизиться», у порта с личным островом ещё «Мой остров»»). A tap (a click) on a
// harbour's town or its name at sea puts the same round choices as a ship's (targetmenu.ts) about the harbour:
//   «Войти в порт»    the run that sails her there and puts her in (main.ts startGoal `p:<id>`);
//   «Приблизиться»    the helmsman to the roads off it (inside its reach, PORT_DOCK_RADIUS): she heaves to there;
//   «Карточка порта»  the port card (portcard.ts);
//   «Мой остров»      the harbour by her own island: the island's screen.
// A tap on the open sea still sails her there and puts the ring away; a window over the sea, port, a battle put it
// away; a finger's ring goes by itself after a while untouched. Its own element (#pmenu): the ships' ring is left alone.

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/portring.ts';
import { TargetMenu } from './targetmenu.ts';
import type { TmChoice, TmId, TmRect } from './targetmenu.ts';

const L = dict(EN, RU);

export type PortRingId = 'enter' | 'near' | 'card' | 'isle';

/** What the ring needs of the game (main.ts). */
export interface PortRingDeps {
  /** The harbour by id: its name (as shown) and where it lies. */
  port(id: string): { name: string; x: number; y: number } | null;
  /** The world to the screen, and the zoom. */
  sx(x: number): number;
  sy(y: number): number;
  zoom(): number;
  /** The HUD's own controls (the ring keeps off them). */
  keepOut(): TmRect[];
  /** Nothing to offer now: a window over the sea, a battle, port. */
  closed(): boolean;
  /** This harbour lies by her own island. */
  byOwnIsle(id: string): boolean;
  /** A finger (no mouse). */
  touch(): boolean;
  pick(id: PortRingId, port: string): void;
}

/** A finger's ring goes by itself after this long untouched (ms). */
export const PR_IDLE = 8000;

/** The choices about a harbour (pure: the ring's order — in, near, the card, her island). */
export function portRingChoices(name: string, ownIsle: boolean): { id: PortRingId; art: string; label: string; title: string }[] {
  return [
    { id: 'enter', art: 'ui_anchor', label: L('enter'), title: L('enterT', { port: name }) },
    { id: 'near', art: 'talent_nav_wake_rider', label: L('near'), title: L('nearT', { port: name }) },
    { id: 'card', art: 'bt_book', label: L('card'), title: L('cardT', { port: name }) },
    ...(ownIsle ? [{ id: 'isle' as const, art: 'tab_isles', label: L('isle'), title: L('isleT', { port: name }) }] : []),
  ];
}

let deps: PortRingDeps | null = null;
let menu: TargetMenu | null = null;
let portId = '';

function ring(): TargetMenu {
  if (!menu) {
    menu = new TargetMenu();
    menu.el.id = 'pmenu';
    menu.el.classList.add('tm-port');
    menu.onPick = (id) => {
      const at = portId;
      portId = '';
      if (at) deps?.pick(id as unknown as PortRingId, at);
    };
  }
  return menu;
}

export function initPortRing(d: PortRingDeps): void {
  deps = d;
  // (for the browser checks: gravetidePortRing.open('saltmarrow'), .about())
  (globalThis as unknown as { gravetidePortRing: unknown }).gravetidePortRing = { open: openPortRing, about: portRingAbout, hide: hidePortRing, closed: () => d.closed(), menu: () => menu, where: (id: string) => where(id), keepOut: () => d.keepOut() };
}

/** The harbour the ring stands about ('' when shut). */
export function portRingAbout(): string {
  return menu?.isOpen ? portId : '';
}

/** Where it stands: between the harbour's anchor and its name over the town (renderer.ts drawPorts: the name 40 m up),
 *  so a harbour tapped by its name at the screen's edge has its ring on the screen; the town's reach round it. */
function where(id: string): { x: number; y: number; r: number; name: string } | null {
  const p = deps?.port(id);
  if (!p || !deps) return null;
  const z = deps.zoom();
  return { x: deps.sx(p.x), y: deps.sy(p.y) - 24 * z, r: Math.max(22, Math.min(60, 34 * z)), name: p.name };
}

/** Open the ring about a harbour (a tap or a click on its town or name). False when there is nothing to offer. */
export function openPortRing(id: string): boolean {
  const w = deps && !deps.closed() ? where(id) : null;
  if (!w || !deps) {
    hidePortRing();
    return false;
  }
  const m = ring();
  if (m.isOpen && portId !== id) m.hide(); // (another harbour: its ring opens afresh, armed anew)
  portId = id;
  const choices = portRingChoices(w.name, deps.byOwnIsle(id)).map((c) => ({ ...c, id: c.id as unknown as TmId }) satisfies TmChoice);
  m.show(`port:${id}`, choices, w.name);
  m.el.setAttribute('aria-label', L('aria', { port: w.name }));
  m.place(w.x, w.y, w.r, deps.keepOut());
  return m.isOpen;
}

export function hidePortRing(): void {
  menu?.hide();
  portId = '';
}

/** Every frame: the ring follows the harbour as the view moves, and goes when the sea is covered or it is left. */
export function portRingFrame(): void {
  if (!menu?.isOpen || !deps) return;
  const w = !deps.closed() && !(deps.touch() && menu.age > PR_IDLE) ? where(portId) : null;
  if (!w || w.x < -20 || w.y < -20 || w.x > innerWidth + 20 || w.y > innerHeight + 20) return hidePortRing(); // (scrolled off)
  if (!menu.hovered) menu.place(w.x, w.y, w.r, deps.keepOut());
}
