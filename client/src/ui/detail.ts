// The detail card (owner, 2026-10-30: «при нажатии на корабль или существо я должен видеть подробное описание со всеми
// иконками и так далее. да и у товаров тоже должны быть модалки, вообще у всего в игре описания при нажатии должны
// быть, у шмоток разных. нажал — тултип а-ля модалка и крестик чтоб закрыть»).
//
// One card for everything: any element carrying `data-detail="kind:id[:n]"` opens it on a tap or a click (one
// delegated listener on the document, so new windows get it for free — detailAttr()); an element whose own tap already
// does something (a stack picked to merge, a talent learnt) carries `data-detail-hold` instead and opens it on a long
// press or a right click. The card stands in the middle of the screen in the game's dark panel with a brass edge: the
// name in its rarity's colour, a big picture, the numbers with their icons, the words, where a good is had, and its
// actions; ✕, Esc or a tap beside it closes it. One card at a time: a new one takes the old one's place.
//
// The words come from shared/src/data/detail.ts (the same as the site's hover cards); the things only the client
// knows — an item by its uid, a ship at sea by her entity id — are built here.
//
// Ships at sea: the first tap marks her and opens the choices about her (targetmenu.ts) as before; «Подробнее» (ⓘ)
// among them, and the ⓘ on her target frame, open her card with «Цель / Атаковать / Плыть».

import { detailCard, itemDetail } from '../../../shared/src/data/detail.ts';
import type { DCard } from '../../../shared/src/data/detail.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import { SHIP_CLASSES, isZoneBossClass } from '../../../shared/src/data/ships.ts';
import { THREAT_COLOR } from '../../../shared/src/data/shiplevel.ts';
import { BEASTS, beastOfClass } from '../../../shared/src/data/beasts.ts';
import { sourcesOf } from '../../../shared/src/data/sources.ts';
import type { SrcLine } from '../../../shared/src/data/sources.ts';
import { volleysToSink } from '../../../shared/src/sim/volleys.ts';
import { DATA_RU } from '../lang/data.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/detail.ts';
import { EN as HUD_EN, RU as HUD_RU } from '../lang/ui/hud.ts';
import { EN as REN, RU as RRU } from '../lang/ui/render.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';
import { placeName } from './maps.ts';
import { srcText } from './srctip.ts';
import { unitIcon, armyGlance } from './army.ts';
import { levelChip, threatTo } from './levels.ts';
import { popLayer, pushLayer } from './kit/layer.ts';
import type { Layer } from './kit/layer.ts';

const L = dict(EN, RU);
const HL = dict(HUD_EN, HUD_RU);
const RL = dict(REN, RRU);
type Tr = [string, string];
const T = (t: Tr | undefined): string => (t ? t[lang() === 'ru' ? 1 : 0] : '');

/** A card's action button: a ship's «Цель / Атаковать / Плыть», a captain's «Осмотреть». */
export type DetailAct = 'lock' | 'fight' | 'pursue' | 'inspect';

/** A card as the client draws it: the shared card and what only the client has — a ship's bars, her army, her actions. */
export interface ClientCard extends DCard {
  /** The ⚓ chip beside the name (a ship's level in the colour of her danger). */
  chip?: string;
  bars?: { k: string; frac: number; cls: string }[];
  /** Ready markup under the numbers (a ship's army at a glance). */
  extra?: string;
  acts?: DetailAct[];
}

export interface DetailHooks {
  state(): ClientState;
  /** The actions a ship's card offers now (the target menu's own reckoning). */
  shipActs(id: number): DetailAct[];
  shipAct(id: number, act: DetailAct): void;
  /** «Плыть к ближайшему продавцу»: the route to a goal's key (srctip's). */
  go(key: string): void;
}

// ------------------------------------------------------------------------------------------------ the attribute

export { detailAttr, infoBtn } from './detailattr.ts';
import { detailAttr } from './detailattr.ts';

/** Cards the client builds itself, by key (an item out of her hands — a bazaar's, a loot's — kept by its uid). */
const made = new Map<string, () => ClientCard | undefined>();
/** An item's attribute: the item kept for its card (the newest 400). */
export function itemDetailAttr(it: Item, o: { hold?: boolean } = {}): string {
  const key = `item:${it.uid}`;
  made.delete(key);
  made.set(key, () => itemDetail(it, wornItems()));
  if (made.size > 400) made.delete(made.keys().next().value!);
  return detailAttr(key, o);
}
/** A card made by the caller (a ware without a uid, a reward), kept under its key. */
export function registerDetail(key: string, make: () => ClientCard | undefined): void {
  made.delete(key);
  made.set(key, make);
  if (made.size > 400) made.delete(made.keys().next().value!);
}

let hooks: DetailHooks | null = null;

function wornItems(): Item[] {
  const self = hooks?.state().self;
  if (!self) return [];
  return [...Object.values(self.captainGear ?? {}), ...Object.values(self.loadout.gear ?? {})].filter((x): x is Item => !!x);
}

/** Her own item by uid: worn by her or her ship, or in the locker. */
function ownItem(uid: number): Item | undefined {
  const self = hooks?.state().self;
  if (!self) return undefined;
  return wornItems().find((x) => x.uid === uid) ?? self.stash.find((x) => x.uid === uid);
}

// ------------------------------------------------------------------------------------------------ a ship at sea

function shipCard(id: number): ClientCard | undefined {
  const state = hooks?.state();
  const s = state?.ships.get(id);
  if (!state || !s?.info) return undefined;
  const info = s.info, c = s.cur, own = state.ownDisplay;
  const cls = SHIP_CLASSES[info.classId];
  const ru = lang() === 'ru' ? 1 : 0;
  const beast = beastOfClass(info.classId);
  const name = beast ? BEASTS[beast].name[ru] : info.isPlayer ? info.captainName : placeName(info.name);
  const clsName: Tr = cls ? [cls.name, DATA_RU[`ships.SHIP_CLASSES.${info.classId}.name`] ?? cls.name] : [info.classId, info.classId];
  const role = info.isPlayer ? L('sh.player.role') : info.npcRole && `role.${info.npcRole}` in REN ? RL(`role.${info.npcRole}` as 'role.merchant') : '';
  const fac = info.faction !== 'player' ? (DATA_RU[`factions.FACTIONS.${info.faction}.name`] && ru ? DATA_RU[`factions.FACTIONS.${info.faction}.name`] : FACTION_EN[info.faction] ?? info.faction) : '';
  const rows: ClientCard['rows'] = [];
  const tr = (s: string): Tr => [s, s];
  if (info.isPlayer) rows.push({ k: tr(L('sh.captain')), v: tr(`${info.captainName}${info.level ? ` · ${info.level}` : ''}`), icon: 'icon.bt_captain' });
  else if (!beast) rows.push({ k: tr(L('sh.captain')), v: tr(info.captainName || '—'), icon: 'icon.bt_captain' });
  if (!beast) rows.push({ k: tr(L('sh.class')), v: clsName, icon: 'icon.menu_ship' });
  if (info.shipLevel) rows.push({ k: tr(L('sh.level')), v: tr(`⚓${info.shipLevel}`), icon: 'icon.ui_anchor' });
  if (fac) rows.push({ k: tr(L('sh.faction')), v: tr(fac), icon: 'icon.tab_legends' });
  if (role) rows.push({ k: tr(L('sh.role')), v: tr(role) });
  if (info.guild) rows.push({ k: tr(L('sh.guild')), v: tr(`[${info.guild}]`) });
  if (info.wanted) rows.push({ k: tr(L('sh.wanted')), v: tr('☠'.repeat(Math.min(5, info.wanted))), tone: 'down' });
  if (cls && !beast) {
    rows.push({ k: tr(L('sh.guns')), v: tr(L('sh.gunsV', { n: cls.gunPortsPerSide })), icon: 'icon.ui_cannon' });
    rows.push({ k: tr(L('sh.speed')), v: tr(`${cls.maxSpeed} ${L('kn')}`), icon: 'icon.sp_fair_wind' });
    rows.push({ k: tr(L('sh.hold')), v: tr(String(cls.holdVolume)), icon: 'icon.bt_hold' });
  }
  if (own) {
    const d = Math.hypot(c.x - own.x, c.y - own.y);
    rows.push({ k: tr(L('sh.dist')), v: tr(d < 1000 ? `${Math.round(d / 10) * 10} ${L('m')}` : `${(d / 1000).toFixed(1)} ${L('km')}`), icon: 'icon.item_ranging_glass' });
  }
  const threat = info.shipLevel ? threatTo(info.shipLevel, info.classId) : null;
  if (threat) rows.push({ k: tr(L('sh.threat')), v: tr(HL(`tg.${threat}` as 'tg.even')), tone: threat === 'trivial' || threat === 'easy' ? 'up' : threat === 'even' ? undefined : 'down' });
  const self = state.self, st = state.ownStats;
  const vol = self && st && info.hullMax && info.shipLevel ? volleysToSink(st, self.loadout, { isPlayer: true, ironRain: (self.talents.gun_iron_rain ?? 0) > 0 }, { classId: info.classId, shipLevel: info.shipLevel, isPlayer: info.isPlayer, hullMax: info.hullMax, armor: info.armor ?? 0, inc: info.inc ?? 1, hullFrac: c.hull }) : null;
  if (vol) rows.push({ k: tr(L('sh.volleys')), v: tr(`≈ ${vol}`), icon: 'icon.talent_gun_rolling_broadside' });
  const od = state.boardOdds.get(id);
  if (od && performance.now() / 1000 - od.at < 30) rows.push({ k: tr(L('sh.odds')), v: tr(`${Math.round(od.chance * 100)}%`), icon: 'icon.ab_red_hook_boarding', tone: od.risky ? 'down' : od.chance >= 0.55 ? 'up' : undefined });
  const bars = beast ? [{ k: L('sh.hull'), frac: c.hull, cls: 'hull' }] : [{ k: L('sh.hull'), frac: c.hull, cls: 'hull' }, { k: L('sh.sails'), frac: c.sails, cls: 'sails' }, { k: L('sh.crew'), frac: c.crew, cls: 'crew' }];
  const extra = !isZoneBossClass(info.classId) && info.crewMax ? armyGlance(Math.round(c.crew * info.crewMax), info.units ?? []) : '';
  const notes: ClientCard['notes'] = [];
  if (cls && !beast) notes.push({ t: [cls.role, DATA_RU[`ships.SHIP_CLASSES.${info.classId}.role`] ?? cls.role], tone: 'flavor' });
  return {
    name: [name, name], color: threat ? THREAT_COLOR[threat] : '#e8c872',
    sub: [[beast ? EN['sh.beast'] : info.isPlayer ? `${placeName(info.name)}` : clsName[0], role, info.elite ? EN['sh.elite'] : ''].filter(Boolean).join(' · '), [beast ? RU['sh.beast'] : info.isPlayer ? `${placeName(info.name)}` : clsName[1], role, info.elite ? RU['sh.elite'] : ''].filter(Boolean).join(' · ')],
    art: beast ? undefined : cls?.sprite, fig: 'ship', chip: info.shipLevel ? levelChip(info.shipLevel, info.classId) : '',
    rows, bars, extra, notes, acts: hooks?.shipActs(id) ?? [],
  };
}
const FACTION_EN: Record<string, string> = { crown: 'The Crown Admiralty', league: 'The Gilded Ledger', confederacy: 'The Red Tide Confederacy' };

// ------------------------------------------------------------------------------------------------ the key → a card

/** The card of a key, or undefined. `el`: the element tapped (a good's local prices). */
export function cardOf(key: string, el?: HTMLElement | null): ClientCard | undefined {
  const own = made.get(key);
  if (own) return own();
  const [kind, id] = key.split(':');
  if (kind === 'ship') return shipCard(Number(id));
  if (kind === 'item') {
    const it = ownItem(Number(id));
    return it ? itemDetail(it, wornItems()) : undefined;
  }
  if (kind === 'good' && el && (el.dataset.dbuy || el.dataset.dsell)) {
    const c = detailCard(key);
    if (!c) return undefined;
    const buy = Number(el.dataset.dbuy) || 0, sell = Number(el.dataset.dsell) || 0;
    const rows = [...(c.rows ?? [])];
    if (buy) rows.push({ k: [EN.buyHere, RU.buyHere], v: [String(buy), String(buy)], icon: 'icon.coin' });
    if (sell) rows.push({ k: [EN.sellHere, RU.sellHere], v: [String(sell), String(sell)], icon: 'icon.coin' });
    return { ...c, rows };
  }
  return detailCard(key);
}

// ------------------------------------------------------------------------------------------------ the markup

const ACT_ICON: Record<DetailAct, string> = { lock: 'item_ranging_glass', fight: 'talent_gun_rolling_broadside', pursue: 'talent_nav_wake_rider', inspect: 'bt_captain' };

function artHtml(c: ClientCard): string {
  if (!c.art) return '';
  if (c.fig === 'unit') return `<div class="dc-art dc-art-unit">${unitIcon(c.art as never, 'dc-fig')}</div>`;
  if (c.fig === 'ship') {
    const url = assetUrl(c.art);
    return url ? `<div class="dc-art dc-art-ship"><img src="${url}" alt="" draggable="false" /></div>` : '';
  }
  const ic = icon(c.art, '', 'dc-ico');
  return ic ? `<div class="dc-art">${ic}</div>` : '';
}

/** A good's or a land resource's sources, worded as the island's tooltip words them. */
function srcHtml(id: string): string {
  const lines = sourcesOf(id);
  const go = lines.find((s): s is Extract<SrcLine, { k: 'ports' }> => s.k === 'ports');
  return `<div class="dc-src"><h4 class="dc-h">${esc(L('where'))}</h4>${lines.length ? `<ul>${lines.map((s) => `<li>${esc(srcText(s))}</li>`).join('')}</ul>` : `<p class="muted">${esc(L('none'))}</p>`}${go ? `<button type="button" class="btn btn-small" data-dcgo="${esc(go.key)}">${icon('menu_ship', '', 'ico-sm')}${esc(L('go'))}</button>` : ''}</div>`;
}

/** The card's markup (pure but for the icons' addresses; the tests read it). */
export function cardHtml(c: ClientCard): string {
  const rows = (c.rows ?? []).map((r) => `<div class="dc-row${r.tone ? ` dc-${r.tone}` : ''}"><span class="dc-ri">${r.icon ? icon(r.icon, '', 'ico-sm') : ''}</span><span class="dc-rk">${esc(T(r.k))}</span>${r.bar !== undefined ? `<span class="dc-rbar"><i style="width:${Math.round(Math.max(0, Math.min(1, r.bar)) * 100)}%"></i></span>` : ''}<b class="dc-rv">${esc(T(r.v))}</b></div>`).join('');
  const bars = (c.bars ?? []).map((b) => `<div class="dc-bar dc-bar-${b.cls}"><span>${esc(b.k)}</span><span class="dc-track"><i style="width:${Math.round(Math.max(0, Math.min(1, b.frac)) * 100)}%"></i></span><b>${Math.round(Math.max(0, Math.min(1, b.frac)) * 100)}%</b></div>`).join('');
  const notes = (c.notes ?? []).map((n) => `<p class="dc-n${n.tone ? ` dc-n-${n.tone}` : ''}">${esc(T(n.t))}</p>`).join('');
  const acts = (c.acts ?? []).map((a, i) => `<button type="button" class="btn btn-small${i === 0 ? ' btn-primary' : ''}" data-dcact="${a}">${icon(ACT_ICON[a], '', 'ico-sm')}${esc(L(`act.${a}`))}</button>`).join('');
  // the numbers on the left; the bars, the army, the words and the sources on the right (a phone held sideways: short)
  const left = rows ? `<div class="dc-rows">${rows}</div>` : '';
  const right = `${bars ? `<div class="dc-bars">${bars}</div>` : ''}${c.extra ? `<div class="dc-extra">${c.extra}</div>` : ''}${notes ? `<div class="dc-notes">${notes}</div>` : ''}${c.src ? srcHtml(c.src) : ''}`;
  return `<header class="dc-head">${artHtml(c)}<div class="dc-ht"><h3 id="dc-name" class="dc-name" style="color:${esc(c.color ?? '#e8c872')}">${c.chip ?? ''}${esc(T(c.name))}</h3>${c.sub ? `<div class="dc-sub">${esc(T(c.sub))}</div>` : ''}</div></header>
    <div class="dc-body${left && right ? ' dc-two' : ''}">${left ? `<div class="dc-col">${left}</div>` : ''}${right ? `<div class="dc-col">${right}</div>` : ''}</div>
    ${acts ? `<footer class="dc-acts">${acts}</footer>` : ''}`;
}

// ------------------------------------------------------------------------------------------------ the card on screen

let root: HTMLElement | null = null;
let card: HTMLElement | null = null;
let openKey = '';
let openEl: HTMLElement | null = null;
let layer: Layer | null = null;
let tick = 0;
/** When it opened: the click a finger's tap makes after its touchend lands on the scrim that came up under it — not a
 *  tap beside the card (the target line opens it on the finger's lift). */
let shownAt = 0;

/** Is the card up (and which)? */
export function detailOpen(): string {
  return openKey;
}

export function closeDetail(): void {
  if (!root || !openKey) return;
  openKey = '';
  openEl = null;
  clearInterval(tick);
  root.classList.add('hidden');
  if (layer) popLayer(layer);
  layer = null;
}

function draw(c: ClientCard): void {
  if (!card) return;
  const sc = card.querySelector<HTMLElement>('.dc-scroll')?.scrollTop ?? 0;
  card.style.setProperty('--dc-c', c.color ?? '#e8c872');
  card.innerHTML = `<button type="button" class="dc-x" data-dcx aria-label="${esc(L('close'))}" title="${esc(L('close'))}">✕</button><div class="dc-scroll">${cardHtml(c)}</div>`;
  const s = card.querySelector<HTMLElement>('.dc-scroll');
  if (s) s.scrollTop = sc;
}

/** Opens the card of a key (one at a time: it takes the place of one up). Nothing to show: nothing happens. */
export function openDetail(key: string, el?: HTMLElement | null): boolean {
  if (!root || !card) return false;
  const c = cardOf(key, el);
  if (!c) return false;
  document.getElementById('srctip')?.classList.add('hidden');
  if (!openKey) shownAt = performance.now();
  openKey = key;
  openEl = el ?? null;
  draw(c);
  root.classList.remove('hidden');
  card.scrollTop = 0;
  if (!layer) {
    layer = { root: card, onEscape: closeDetail };
    pushLayer(layer);
  }
  card.querySelector<HTMLElement>('.dc-x')?.focus({ preventScroll: true });
  clearInterval(tick);
  // a ship's card follows her: her bars, her distance; she gone, it says so and closes
  if (key.startsWith('ship:')) tick = window.setInterval(() => {
    if (openKey !== key) return clearInterval(tick);
    const again = cardOf(key, openEl);
    if (again) draw(again);
    else closeDetail();
  }, 500);
  return true;
}

/** Mounts the card and its listeners (once). */
export function mountDetail(h: DetailHooks): void {
  hooks = h;
  if (root) return;
  root = document.createElement('div');
  root.id = 'detail';
  root.className = 'dc-root hidden';
  root.innerHTML = '<div class="dc-scrim" data-dcx></div><section class="dc-card" role="dialog" aria-modal="true" aria-labelledby="dc-name"></section>';
  document.body.appendChild(root);
  card = root.querySelector<HTMLElement>('.dc-card');
  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('[data-dcx]')) {
      e.stopPropagation();
      if (t.classList.contains('dc-scrim') && performance.now() - shownAt < 450) return;
      return closeDetail();
    }
    const go = t.closest<HTMLElement>('[data-dcgo]');
    if (go) {
      closeDetail();
      return hooks?.go(go.dataset.dcgo!);
    }
    const act = t.closest<HTMLElement>('[data-dcact]');
    if (act && openKey.startsWith('ship:')) {
      const id = Number(openKey.slice(5));
      closeDetail();
      return hooks?.shipAct(id, act.dataset.dcact as DetailAct);
    }
  });
  const holder = (t: EventTarget | null, attr: string): HTMLElement | null => (t instanceof Element ? t.closest<HTMLElement>(`[${attr}]`) : null);
  // A tap or a click on `data-detail`: the card (a button, a field or a link of its own inside it keeps its tap).
  document.addEventListener('click', (e) => {
    if (swallow && performance.now() - swallow < 700) {
      swallow = 0;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const el = holder(e.target, 'data-detail');
    if (!el || (root!.contains(el) && el !== e.target && !el.dataset.detail)) return;
    const ctl = (e.target as Element).closest('button, a, input, select, textarea, label, [data-act]');
    if (ctl && ctl !== el && el.contains(ctl)) return;
    if (openDetail(el.dataset.detail!, el)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  // A long press (a finger) or a right click (a mouse) on `data-detail-hold` — or on `data-detail`, the same.
  let timer = 0, x0 = 0, y0 = 0, swallow = 0;
  const holdKey = (el: HTMLElement) => el.dataset.detailHold ?? el.dataset.detail ?? '';
  document.addEventListener('pointerdown', (e) => {
    clearTimeout(timer);
    if (e.pointerType === 'mouse') return;
    const el = holder(e.target, 'data-detail-hold');
    if (!el) return;
    x0 = e.clientX;
    y0 = e.clientY;
    timer = window.setTimeout(() => {
      if (openDetail(holdKey(el), el)) {
        swallow = performance.now();
        try { navigator.vibrate?.(10); } catch { /* not allowed */ }
      }
    }, 450);
  }, true);
  const cancel = () => clearTimeout(timer);
  document.addEventListener('pointerup', cancel, true);
  document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel();
  }, true);
  document.addEventListener('contextmenu', (e) => {
    const el = holder(e.target, 'data-detail-hold') ?? holder(e.target, 'data-detail');
    if (!el) return;
    if (openDetail(holdKey(el), el)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target instanceof HTMLElement && (e.target.dataset.detail || e.target.dataset.detailHold) ? e.target : null;
    if (el && openDetail(holdKey(el), el)) e.preventDefault();
  });
  window.addEventListener('resize', () => {
    if (openKey && card) card.scrollTop = card.scrollTop;
  });
}
