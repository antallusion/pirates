// The ring on every other thing of the sea (forum 45, topic 8, approved by the owner: «радиальное меню по клику на всё
// кликабельное… планки действий снизу не убирайте»). A ship and a creature stack have theirs (targetmenu.ts), a harbour
// its own (portring.ts); a click or a tap on anything else the sea shows — a wreck, flotsam, castaways, a find, a sea
// mark, a floating waystation (the rafts, the markets), a lair, creatures adrift, a place of the adventure map, a shoal,
// an island — puts the same round choices beside it:
//   its own order    «Подобрать», «Спасти», «Исследовать», «Пришвартоваться» (what a second tap on it does too);
//   «Плыть к нему»   the helmsman takes her up to it and heaves to;
//   «Мой остров»     on her own island: its screen;
//   ⓘ               the thing's card (detail.ts).
// Hover only names it (main.ts: the name tag) — never the ring. A tap on the open sea still sails her there and puts the
// ring away (the ring's layer takes no pointer of its own: .tm is pointer-events none, only its buttons are hit).

import type { ClientState } from '../state.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/thingring.ts';
import { EN as FEN, RU as FRU } from '../lang/ui/seafinds.ts';
import { EN as WEN, RU as WRU } from '../lang/ui/waystation.ts';
import { LAIRS } from '../../../shared/src/data/lairs.ts';
import { DRIFTS } from '../../../shared/src/data/drifts.ts';
import { OBJS } from '../../../shared/src/data/advmap.ts';
import type { TapKind } from './sailto.ts';
import { TargetMenu } from './targetmenu.ts';
import type { TmChoice, TmId, TmRect } from './targetmenu.ts';

const L = dict(EN, RU);
const LF = dict(FEN, FRU);
const LW = dict(WEN, WRU);

export type ThingKind = TapKind | 'isle';
export type ThingAct = 'act' | 'go' | 'home';

/** A thing of the sea as the ring reads it. */
export interface Thing {
  kind: ThingKind;
  id: number | string;
  x: number;
  y: number;
  /** Its reach on the water (m): the ring stands round it. */
  r: number;
  name: string;
  /** How near «its own order» brings her (what she takes by passing). */
  near?: number;
  level?: number;
  text?: [string, string];
  own?: boolean;
  done?: boolean;
}

const tr = (t: readonly [string, string]): string => t[lang() === 'ru' ? 1 : 0];

/** The thing an about-key (`wreck:12`, `isle:4`) names in the state now, or null (gone, out of sight). */
export function thingOf(state: ClientState, about: string): Thing | null {
  const i = about.indexOf(':');
  if (i < 0) return null;
  const kind = about.slice(0, i) as ThingKind, sid = about.slice(i + 1), n = Number(sid);
  switch (kind) {
    case 'find': {
      const f = state.finds.find((x) => x.id === n);
      return f ? { kind, id: n, x: f.x, y: f.y, r: 16, name: LF(`n.${f.kind}` as 'n.bottle'), level: f.level } : null;
    }
    case 'castaway': {
      const c = state.castaways.find((x) => x.id === n);
      return c ? { kind, id: n, x: c.x, y: c.y, r: 14, near: 30, name: L('n.castaway', { n: c.n }) } : null;
    }
    case 'wreck': {
      const w = state.wrecks.find((x) => x.id === n);
      return w ? { kind, id: n, x: w.x, y: w.y, r: 18, near: 30, name: L('n.wreck') } : null;
    }
    case 'loot': {
      const l = state.loot.get(n);
      return l ? { kind, id: n, x: l.x, y: l.y, r: 14, near: 30, name: L('n.loot') } : null;
    }
    case 'sight': {
      const s = state.sights.find((x) => x.id === n);
      return s ? { kind, id: n, x: s.x, y: s.y, r: 16, name: L('n.sight') } : null;
    }
    case 'drift': {
      const d = state.drifts.find((x) => x.id === n);
      const def = d ? DRIFTS[d.kind] : undefined;
      return d ? { kind, id: n, x: d.x, y: d.y, r: 22, name: def ? tr(def.name) : L('k.drift'), level: d.level, ...(def ? { text: def.text } : {}) } : null;
    }
    case 'adv': {
      const o = state.adv?.objs.find((x) => x.id === sid);
      const def = o ? OBJS[o.kind] : undefined;
      return o ? { kind, id: sid, x: o.x, y: o.y, r: 22, name: def ? tr(def.name) : L('k.adv'), level: o.level, ...(def ? { text: def.text } : {}) } : null;
    }
    case 'lair': {
      const l = state.lairs?.list.find((x) => x.id === sid);
      const def = l ? LAIRS[l.kind] : undefined;
      return l ? { kind, id: sid, x: l.x, y: l.y, r: 26, name: def ? tr(def.name) : L('k.lair'), level: l.level, ...(def ? { text: def.text } : {}), ...(l.down ? { done: true } : {}) } : null;
    }
    case 'way': {
      const w = state.ways.get(n);
      return w ? { kind, id: n, x: w.x, y: w.y, r: 30, name: LW(`kind.${w.kind}` as 'kind.tavern') } : null;
    }
    case 'shoal': {
      const s = state.shoals.find((x) => x.id === n);
      return s ? { kind, id: n, x: s.x, y: s.y, r: Math.max(16, s.r * 0.6), near: Math.max(20, s.r * 0.5), name: L('n.shoal') } : null;
    }
    case 'mark': {
      const m = state.seaMarks.get(n);
      return m ? { kind, id: n, x: m.x, y: m.y, r: m.r, name: L(`m.${m.kind}` as 'm.buoy'), ...(state.markDone.has(n) ? { done: true } : {}) } : null;
    }
    case 'isle': {
      const is = state.islands.get(n);
      if (!is) return null;
      const own = state.self?.homeIsle === n;
      return { kind, id: n, x: is.x, y: is.y, r: is.r, name: is.name || L(own ? 'n.ownIsle' : 'n.isle'), ...(own ? { own: true } : {}) };
    }
  }
  return null;
}

/** The ring's choices about a thing (pure: its own order first where it has one, then «Плыть к нему», her island). */
export function thingRingChoices(t: Pick<Thing, 'kind' | 'name' | 'own' | 'done'>): { id: ThingAct; art: string; label: string; title: string }[] {
  const out: { id: ThingAct; art: string; label: string; title: string }[] = [];
  const name = t.name;
  const act = (label: 'pick' | 'rescue' | 'explore' | 'moor', art: string) => out.push({ id: 'act', art, label: L(label), title: L(`${label}T` as 'pickT', { name }) });
  switch (t.kind) {
    case 'find':
    case 'wreck':
    case 'loot':
      act('pick', 'map_treasure');
      break;
    case 'castaway':
      act('rescue', 'stat_crew');
      break;
    case 'mark':
      if (!t.done) act('explore', 'item_ranging_glass');
      break;
    case 'way':
      act('moor', 'ui_anchor');
      break;
  }
  out.push({ id: 'go', art: 'talent_nav_wake_rider', label: L('go'), title: L('goT', { name }) });
  if (t.kind === 'isle' && t.own) out.push({ id: 'home', art: 'tab_isles', label: L('home'), title: L('homeT') });
  return out;
}

/** The thing's card for ⓘ (detail.ts registerDetail). */
export function thingCard(t: Thing, own: { x: number; y: number } | null): { name: [string, string]; sub: [string, string]; rows: { k: [string, string]; v: [string, string] }[]; notes?: { t: [string, string]; tone: 'flavor' }[] } {
  const both = (s: string): [string, string] => [s, s];
  const kindWord = t.kind === 'isle' ? L(t.own ? 'n.ownIsle' : 'n.isle') : t.kind in { find: 1, mark: 1, way: 1, lair: 1, drift: 1, adv: 1 } ? L(`k.${t.kind}` as 'k.find') : L('sub');
  const rows: { k: [string, string]; v: [string, string] }[] = [];
  if (t.level) rows.push({ k: [EN.lvlK, RU.lvlK], v: both(String(t.level)) });
  if (own) {
    const d = Math.hypot(t.x - own.x, t.y - own.y);
    const m = d >= 1000 ? `${(d / 1000).toFixed(1)} ${lang() === 'ru' ? 'км' : 'km'}` : `${Math.round(d / 10) * 10} ${lang() === 'ru' ? 'м' : 'm'}`;
    rows.push({ k: [EN.dist, RU.dist], v: both(m) });
  }
  return { name: both(t.name), sub: both(kindWord), rows, ...(t.text ? { notes: [{ t: t.text, tone: 'flavor' as const }] } : {}) };
}

// ------------------------------------------------------------------------------------------------ the ring

/** What the ring needs of the game (main.ts). */
export interface ThingRingDeps {
  state(): ClientState;
  sx(x: number): number;
  sy(y: number): number;
  zoom(): number;
  keepOut(): TmRect[];
  /** Nothing to offer now: a window over the sea, a battle, port, a long passage. */
  closed(): boolean;
  touch(): boolean;
  pick(id: ThingAct | 'info', t: Thing): void;
}

/** A finger's ring goes by itself after this long untouched (ms). */
export const TR_IDLE = 8000;

let deps: ThingRingDeps | null = null;
let menu: TargetMenu | null = null;
let about = '';

function ring(): TargetMenu {
  if (!menu) {
    menu = new TargetMenu();
    menu.el.id = 'xmenu';
    menu.el.classList.add('tm-thing');
    menu.onPick = (id) => {
      const t = deps ? thingOf(deps.state(), about) : null;
      about = '';
      if (t) deps?.pick(id as unknown as ThingAct | 'info', t);
    };
  }
  return menu;
}

export function initThingRing(d: ThingRingDeps): void {
  deps = d;
  // (for the browser checks: gravetideThingRing.open('wreck:3'), .about())
  (globalThis as unknown as { gravetideThingRing: unknown }).gravetideThingRing = { open: openThingRing, about: thingRingAbout, hide: hideThingRing, menu: () => menu };
}

/** The thing the ring stands about ('' when shut). */
export function thingRingAbout(): string {
  return menu?.isOpen ? about : '';
}

function where(t: Thing): { x: number; y: number; r: number } | null {
  if (!deps) return null;
  const z = deps.zoom();
  return { x: deps.sx(t.x), y: deps.sy(t.y), r: Math.max(16, Math.min(t.kind === 'isle' ? 90 : 60, t.r * z)) };
}

/** Open the ring about a thing (`kind:id`). False when there is nothing to offer. */
export function openThingRing(key: string): boolean {
  const t = deps && !deps.closed() ? thingOf(deps.state(), key) : null;
  const w = t ? where(t) : null;
  if (!t || !w || !deps) {
    hideThingRing();
    return false;
  }
  const m = ring();
  if (m.isOpen && about !== key) m.hide();
  about = key;
  const choices = thingRingChoices(t).map((c) => ({ ...c, id: c.id as unknown as TmId }) satisfies TmChoice);
  m.show(`thing:${key}`, choices, t.name, true);
  m.el.setAttribute('aria-label', L('aria', { name: t.name }));
  m.place(w.x, w.y, w.r, deps.keepOut());
  return m.isOpen;
}

export function hideThingRing(): void {
  menu?.hide();
  about = '';
}

/** Every frame: the ring follows its thing, and goes with it (gone, covered, scrolled off, a finger's after a while). */
export function thingRingFrame(): void {
  if (!menu?.isOpen || !deps) return;
  const t = !deps.closed() && !(deps.touch() && menu.age > TR_IDLE && !menu.hovered) ? thingOf(deps.state(), about) : null;
  const w = t ? where(t) : null;
  if (!w || w.x < -20 || w.y < -20 || w.x > innerWidth + 20 || w.y > innerHeight + 20) return hideThingRing();
  if (!menu.hovered) menu.place(w.x, w.y, w.r, deps.keepOut());
}
