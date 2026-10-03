// The gear window (docs/12 P1): the ship's slots and the captain's, the locker, and a port chandler's wares. Tapping a
// piece opens its card — its lines in its rarity's colour, how it weighs against what is worn in that slot, and what
// can be done with it here.

import {
  AFFIXES, CAPTAIN_SLOTS, CAP_STATS, CAP_STAT_NAMES, LEGENDARY_ITEMS, TEMPER_MAX, reforgeCost, temperCost, RARITY_COLOR, RARITY_NAMES, SETS, SHIP_SLOTS, SLOT_NAMES, SLOT_OPENS,
  STASH_SIZE, captainIlvl, gearSource, isShipSlot, itemEffect, itemName, itemSlot, itemValue, setBonuses,
} from '../../../shared/src/data/items.ts';
import type { Item, Slot } from '../../../shared/src/data/items.ts';
import { shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { StatKey } from '../../../shared/src/data/stats.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/gear.ts';
import type { ClientState } from '../state.ts';
import { esc, icon, money } from './dom.ts';
import { ownLevelChip } from './levels.ts';
import { placeName } from './maps.ts';
import { bindStormForge, stormForgeCard } from './storms.ts';
import { LOWER_BETTER, compareRows } from './gearcmp.ts';
import { ARTIFACTS, ART_CLASS_NAMES, ART_SETS } from '../../../shared/src/data/artifacts.ts';
import { PRIMS, PRIM_NAMES } from '../../../shared/src/data/hero.ts';
import { EN as HERO_EN, RU as HERO_RU } from '../lang/ui/hero.ts';
import type { CmpRow } from './gearcmp.ts';
import { EN as EASE_EN, RU as EASE_RU } from '../lang/ui/ease.ts';

const L = dict(EN, RU);
const EL = dict(EASE_EN, EASE_RU);
const HL = dict(HERO_EN, HERO_RU);
const ru = () => lang() === 'ru';

type Tab = 'ship' | 'captain' | 'locker' | 'shop';
let tab: Tab = 'ship';
/** The card open: a worn slot, a locker item, or a chandler's ware. */
let pick: { kind: 'slot'; slot: Slot } | { kind: 'item'; uid: number } | { kind: 'ware'; index: number } | null = null;
/** The locker shown for one slot only (after tapping an empty slot). */
let only: Slot | null = null;

/** Each slot's picture until the items have their own art. */
const SLOT_ICON: Record<Slot, string> = {
  sails: 'mod_sail_plan', rigging: 'sail_up', plating: 'mod_hull_plating', rudder: 'mod_rudder', hold: 'mod_hold_expansion', quarters: 'mod_crew_quarters',
  battery: 'gun_long_9', banner: 'tab_legends', relic: 'mod_choir_bell', tackle: 'build_fishing_village',
  hat: 'menu_cabin', coat: 'role_lieutenant', sash: 'prof_marine', boots: 'role_pilot', blade: 'tree_boarding', pistols: 'bt_volley',
  spyglass: 'ab_spotters_eye', compass: 'ab_star_fix', charm: 'role_deep_pastor', ring: 'coin',
};

export function itemIcon(it: Item | null, slot: Slot, cls = 'ico-md'): string {
  // An artifact's painting (docs/17 H2), a legendary's own, else its base's (docs/12 P11), else the slot's mark.
  if (it?.art && ARTIFACTS[it.art]) return icon(ARTIFACTS[it.art].icon, '', cls) || icon(SLOT_ICON[slot], '◆', cls);
  return (it?.legendary ? icon(`item_${it.legendary}`, '', cls) : '') || (it ? icon(`item_${it.base}`, '', cls) : '') || icon(SLOT_ICON[slot], '◆', cls);
}


function statLabel(k: StatKey): string {
  const key = `stat.${k}` as keyof typeof EN;
  return key in EN ? L(key) : L('stat.other', { k });
}

function statValue(k: StatKey, v: number): string {
  const sign = v > 0 ? '+' : '−';
  const a = Math.abs(v);
  const num = (x: number, d: number) => x.toLocaleString(ru() ? 'ru-RU' : 'en-GB', { maximumFractionDigits: d });
  if (k === 'moraleRegen' || k === 'grapeMorale') return `${sign}${num(a, 2)}`;
  if (k === 'noGoDeg' || k === 'gunTrain') return `${sign}${num(a, 1)}°`; // degrees, not shares
  const pct = a * 100;
  return `${sign}${num(pct, pct >= 10 ? 0 : 1)}%`;
}

function statLine(k: StatKey, v: number, cls = ''): string {
  const good = LOWER_BETTER.has(k) ? v < 0 : v > 0;
  return `<div class="gl ${cls} ${good ? 'g-up' : 'g-down'}"><span>${esc(statLabel(k))}</span><b>${esc(statValue(k, v))}</b></div>`;
}

function capLine(c: string, v: number, cls = ''): string {
  return `<div class="gl ${cls} ${v > 0 ? 'g-up' : 'g-down'}"><span>${esc(CAP_STAT_NAMES[c as keyof typeof CAP_STAT_NAMES][ru() ? 1 : 0])}</span><b>${v > 0 ? '+' : '−'}${Math.abs(v)}</b></div>`;
}

function nameOf(it: Item): string {
  return itemName(it, ru());
}

export function coloured(it: Item): string {
  return `<b class="gi-name" style="color:${RARITY_COLOR[it.rarity]}">${esc(nameOf(it))}</b>`;
}

/** An item's card: name, rarity, slot and level, its lines, its set, its gift, its wear. */
function card(it: Item, worn: Item[]): string {
  const e = itemEffect({ ...it, dur: Math.max(1, it.dur) });
  const slot = itemSlot(it);
  const lines = [
    ...Object.entries(e.mods).filter(([, v]) => Math.abs(v ?? 0) > 1e-9).map(([k, v]) => statLine(k as StatKey, v ?? 0)),
    ...Object.entries(e.cap).filter(([, v]) => v).map(([c, v]) => capLine(c, v ?? 0)),
  ].join('');
  const leg = it.legendary ? LEGENDARY_ITEMS[it.legendary] : null;
  // A hero's artifact (docs/17 H2): its primaries, its words, its set.
  const art = it.art ? ARTIFACTS[it.art] : null;
  const artLines = art ? PRIMS.filter((p) => art.prim?.[p]).map((p) => `<div class="gl g-up"><span>${esc(PRIM_NAMES[p][ru() ? 1 : 0])}</span><b>+${art.prim![p]}</b></div>`).join('') : '';
  let artSet = '';
  if (art?.set) {
    const def = ART_SETS[art.set];
    const have = def.pieces.filter((p) => worn.some((w) => w.art === p)).length;
    artSet = `<div class="gi-set">${esc(def.name[ru() ? 1 : 0])} (${have}/${def.pieces.length})<div class="gi-bonus${have >= def.pieces.length ? ' on' : ''}">(${def.pieces.length}) ${esc(def.text[ru() ? 1 : 0])}</div><div class="muted">${esc(def.pieces.map((p) => ARTIFACTS[p].name[ru() ? 1 : 0]).join(' · '))}</div></div>`;
  }
  let set = '';
  if (it.set) {
    const def = SETS[it.set];
    const have = worn.filter((w) => w.set === it.set).length;
    set = `<div class="gi-set">${icon(`set_${it.set}`, '', 'ico-sm')}${esc(L('set', { name: def.name[ru() ? 1 : 0], n: have, max: Object.keys(def.pieces).length }))}${def.bonus.map((b) => `<div class="gi-bonus${have >= b.n ? ' on' : ''}">(${b.n}) ${esc(b.text[ru() ? 1 : 0])}</div>`).join('')}</div>`;
  }
  return `<div class="gi-card" style="border-color:${RARITY_COLOR[it.rarity]}">
    <div class="gi-head">${itemIcon(it, slot, 'ico-md gi-ico')}<div>${coloured(it)}<div class="muted gi-kind">${esc(art ? ART_CLASS_NAMES[art.cls][ru() ? 1 : 0] : RARITY_NAMES[it.rarity][ru() ? 1 : 0])} · ${esc(SLOT_NAMES[slot][ru() ? 1 : 0])} · ${esc(L('lv', { n: it.ilvl }))}${it.temper ? ` · ${esc(L('tempered', { n: it.temper }))}` : ''}</div></div></div>
    <div class="gi-lines">${artLines}${lines}</div>
    ${leg ? `<div class="gi-gift">${esc(leg.text[ru() ? 1 : 0])}</div>` : ''}
    ${art ? `<div class="gi-gift">${esc(art.text[ru() ? 1 : 0])}</div>` : ''}
    ${set}${artSet}
    ${art ? '' : `<div class="muted gi-wear">${it.dur <= 0 ? esc(L('broken')) : esc(L('wear', { n: it.dur }))}</div>`}</div>`;
}

/** An item's card for other windows (a chain's reward to choose, docs/12 P9). */
export function itemCardHtml(it: Item): string {
  return card(it, []);
}

/** How a piece weighs against what is worn in its slot (docs/16 #38): each line's value on both, and the difference
 *  in green where this piece is better, red where it is worse. */
function compare(it: Item, cur: Item | undefined): string {
  const rows = compareRows(it, cur);
  const val = (r: CmpRow, v: number) => (Math.abs(v) < 1e-9 ? '—' : r.kind === 'stat' ? statValue(r.key as StatKey, v) : `${v > 0 ? '+' : '−'}${Math.abs(v)}`);
  const label = (r: CmpRow) => (r.kind === 'stat' ? statLabel(r.key as StatKey) : r.kind === 'prim' ? PRIM_NAMES[r.key as keyof typeof PRIM_NAMES][ru() ? 1 : 0] : CAP_STAT_NAMES[r.key as keyof typeof CAP_STAT_NAMES][ru() ? 1 : 0]);
  const body = rows.map((r) => `<tr class="${r.good === true ? 'g-up' : r.good === false ? 'g-down' : 'g-eq'}"><td>${esc(label(r))}</td><td>${esc(val(r, r.a))}</td><td>${esc(val(r, r.b))}</td><td class="gc-d">${r.good === null ? '=' : esc(val(r, r.d))}</td></tr>`).join('');
  const head = cur ? `${esc(L('compare'))}: ${coloured(cur)}` : esc(L('compare'));
  return `<div class="gi-cmp"><div class="gi-h">${head}</div>${cur ? '' : `<p class="muted gi-cmp-none">${esc(EL('cmp_none'))}</p>`}${rows.length ? `<table class="gc-t"><thead><tr><th></th><th>${esc(EL('cmp_this'))}</th><th>${esc(EL('cmp_worn'))}</th><th>Δ</th></tr></thead><tbody>${body}</tbody></table>` : '<div class="muted">=</div>'}</div>`;
}

/** The piece a row of the locker or the chandler's stands for, and what is worn in its slot. */
function hoverPair(self: NonNullable<ClientState['self']>, el: HTMLElement, wares: Item[] | undefined): { it: Item; cur: Item | undefined } | null {
  const it = el.dataset.gitem ? self.stash.find((x) => x.uid === Number(el.dataset.gitem)) : el.dataset.gware ? wares?.[Number(el.dataset.gware)] : undefined;
  if (!it) return null;
  const slot = itemSlot(it);
  const cur = (isShipSlot(slot) ? (self.loadout.gear ?? {})[slot] : (self.captainGear ?? {})[slot as never]) as Item | undefined;
  return { it, cur };
}

// A card left floating when its window closed under the cursor goes with the next move.
globalThis.addEventListener?.('pointermove', (e) => {
  const tip = document.querySelector('.gear-tip');
  if (tip && !(e.target instanceof Element && e.target.closest('[data-gitem], [data-gware]'))) tip.remove();
}, { passive: true });

export function renderGear(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void, close: () => void): void {
  document.querySelectorAll('.gear-tip').forEach((e) => e.remove());
  const self = state.self;
  if (!self) return;
  const lvl = shipLevelOf(self.loadout);
  const cls = SHIP_CLASSES[self.loadout.classId];
  const shipGear = self.loadout.gear ?? {};
  const capGear = self.captainGear ?? {};
  const worn = [...Object.values(shipGear), ...Object.values(capGear)].filter((x): x is Item => !!x);
  const docked = !!self.dockedAt;
  const sy = docked ? state.portView?.shipyard : null;
  if (tab === 'shop' && !docked) tab = 'ship';

  // The captain's sheet (WoW's paper doll): the portrait, the pieces in squares down both sides.
  // The ship's too: her picture between her ten places, the ones her level has not opened yet shut.
  const dollSlot = (slot: Slot) => {
    const it = (isShipSlot(slot) ? shipGear[slot] : capGear[slot as never]) as Item | undefined;
    const locked = isShipSlot(slot) && lvl < SLOT_OPENS[slot];
    const on = pick?.kind === 'slot' && pick.slot === slot;
    const label = it ? nameOf(it) : locked ? `${SLOT_NAMES[slot][ru() ? 1 : 0]} — ${L('locked', { n: SLOT_OPENS[slot as never] })}` : SLOT_NAMES[slot][ru() ? 1 : 0];
    return `<button class="doll-slot${it ? ' full' : ''}${locked ? ' locked' : ''}${on ? ' on' : ''}" data-gslot="${slot}" ${locked ? 'disabled' : ''} title="${esc(label)}" aria-label="${esc(label)}"${it ? ` style="border-color:${RARITY_COLOR[it.rarity]}"` : ''}>${itemIcon(it ?? null, slot, 'doll-ico')}${it ? `<span class="doll-lv">${it.ilvl}</span>` : locked ? `<span class="doll-lock-lv">⚓${SLOT_OPENS[slot as never]}</span>` : ''}</button>`;
  };
  const dollOf = (slots: readonly Slot[], face: string | null, name: string, sub: string, kind: string) => {
    const half = Math.ceil(slots.length / 2);
    return `<div class="doll doll-gear doll-${kind}">
      <div class="doll-col">${slots.slice(0, half).map(dollSlot).join('')}</div>
      <div class="doll-face" style="background-image:${face ? `url('${face}')` : 'none'}"><div class="doll-plate"><b>${esc(name)}</b><span>${esc(sub)}</span></div></div>
      <div class="doll-col">${slots.slice(half).map(dollSlot).join('')}</div>
    </div>`;
  };
  const doll = dollOf(CAPTAIN_SLOTS, assetUrl(CAPTAINS[self.captain].portrait), self.name, L('capLv', { n: self.level }), 'captain');
  const shipDoll = dollOf(SHIP_SLOTS, assetUrl(`ship.${self.loadout.classId}`), placeName(self.loadout.name), `${cls.name} · ⚓${lvl}`, 'ship');

  const sets = setBonuses(worn).active;
  const total = gearSource(worn);
  // The hero's primaries with what her artifacts add (docs/17 H2).
  const hero = self.hero;
  const heroPanel = hero ? `<div class="gp"><div class="gi-h">${esc(HL('prims'))}</div>${PRIMS.map((k) => `<div class="gl${hero.artPrim[k] ? ' g-up' : ''}"><span>${esc(PRIM_NAMES[k][ru() ? 1 : 0])}</span><b>${hero.prim[k] + hero.artPrim[k]}${hero.artPrim[k] ? ` (+${hero.artPrim[k]})` : ''}</b></div>`).join('')}</div>` : '';
  const statsPanel = (captain: boolean) => captain
    ? `${heroPanel}<div class="gp"><div class="gi-h">${esc(L('stats'))}</div>${CAP_STATS.map((c) => `<div class="gl"><span>${esc(CAP_STAT_NAMES[c][ru() ? 1 : 0])}</span><b>${total.cap[c] ?? 0}</b></div>`).join('')}</div>`
    : `<div class="gp"><div class="gi-h">${esc(L('fromGear'))}</div>${Object.entries(total.mods).filter(([, v]) => Math.abs(v ?? 0) > 1e-9).map(([k, v]) => statLine(k as StatKey, v ?? 0)).join('') || '<div class="muted">—</div>'}</div>`;
  const artSets = (hero?.sets ?? []) as (keyof typeof ART_SETS)[];
  const setsPanel = `<div class="gp"><div class="gi-h">${esc(L('sets'))}</div>${artSets.map((id) => `<div class="gl g-up"><span>${esc(ART_SETS[id].name[ru() ? 1 : 0])}</span><b>${ART_SETS[id].pieces.length}/${ART_SETS[id].pieces.length}</b></div>`).join('')}${sets.length || artSets.length ? sets.map((x) => `<div class="gl"><span class="with-ico">${icon(`set_${x.set}`, '', 'ico-sm')}${esc(SETS[x.set].name[ru() ? 1 : 0])}</span><b>${x.n}/${Object.keys(SETS[x.set].pieces).length}</b></div>`).join('') : `<div class="muted">${esc(L('noSets'))}</div>`}</div>`;

  // A forge (a yard of the second rank or better): tempering, and reforging each extra line.
  const forge = docked && (sy?.tier ?? 0) >= 2;
  const forgeActs = (it: Item) => {
    if (!forge) return '';
    const t = (it.temper ?? 0) < TEMPER_MAX ? temperCost(it) : null;
    return `${t ? `<button class="btn btn-small" data-gtemper="${it.uid}" ${self.gold < t.silver ? 'disabled' : ''}>${esc(L('temper', { n: (it.temper ?? 0) + 1 }))}${money(t.silver)}</button>` : ''}
      ${it.affixes.length ? `<span class="gi-reforge"><span class="muted">${esc(L('reforge'))}${money(reforgeCost(it))}</span>${it.affixes.map((a, i) => `<button class="btn btn-small" data-greforge="${it.uid}" data-line="${i}">↻ ${esc(AFFIXES[a.a].name[ru() ? 1 : 0])}</button>`).join('')}</span>` : ''}
      ${t ? `<p class="muted gi-forge-note">${esc(L('forgeNote', { iron: t.iron, planks: t.planks }))}</p>` : ''}`;
  };

  // The card open, and what can be done with it.
  let detail = '';
  if (pick?.kind === 'slot') {
    const it = isShipSlot(pick.slot) ? shipGear[pick.slot] : capGear[pick.slot as never];
    if (it) detail = `${card(it, worn)}<div class="gi-acts"><button class="btn btn-small" data-gun="${pick.slot}">${esc(L('unequip'))}</button>${forgeActs(it)}</div>`;
  } else if (pick?.kind === 'item') {
    const uid = pick.uid;
    const it = self.stash.find((x) => x.uid === uid);
    if (it) {
      const slot = itemSlot(it);
      const cur = isShipSlot(slot) ? shipGear[slot] : capGear[slot as never];
      const high = isShipSlot(slot) ? it.ilvl > lvl || lvl < SLOT_OPENS[slot] : it.ilvl > captainIlvl(self.level);
      detail = `${card(it, worn)}${compare(it, cur)}<div class="gi-acts">
        <button class="btn btn-small btn-primary" data-geq="${it.uid}" ${high ? `disabled title="${esc(L('tooHigh'))}"` : ''}>${esc(L('equip'))}</button>
        ${docked ? `<button class="btn btn-small" data-gsell="${it.uid}">${esc(L('sell', { v: '' }))}${money(Math.max(1, Math.round(itemValue(it) / 4)))}</button>` : ''}
        ${docked && (sy?.tier ?? 0) > 0 ? `<button class="btn btn-small btn-danger" data-gsalv="${it.uid}">${esc(L('salvage'))}</button>` : ''}${forgeActs(it)}</div>`;
    }
  } else if (pick?.kind === 'ware' && sy) {
    const index = pick.index;
    const it = sy.wares[index];
    if (it) {
      const slot = itemSlot(it);
      const cur = isShipSlot(slot) ? shipGear[slot] : capGear[slot as never];
      detail = `${card(it, worn)}${compare(it, cur)}<div class="gi-acts"><button class="btn btn-small btn-primary" data-gbuy="${index}" ${self.gold < itemValue(it) ? 'disabled' : ''}>${esc(L('buy', { v: '' }))}${money(itemValue(it))}</button></div>`;
    }
  }

  let body = '';
  if (tab === 'ship') body = `${shipDoll}<div class="gear-side">${statsPanel(false)}${setsPanel}</div>`;
  else if (tab === 'captain') body = `${doll}<div class="gear-side">${statsPanel(true)}${setsPanel}</div>`;
  else if (tab === 'locker') {
    // Best first: rarity, then level; one slot's pieces only when asked.
    const list = self.stash.filter((it) => !only || itemSlot(it) === only).sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl || a.base.localeCompare(b.base));
    const filter = only ? `<div class="gear-filter"><span class="muted">${esc(L('only', { slot: SLOT_NAMES[only][ru() ? 1 : 0] }))}</span><button class="btn btn-small" data-gall>${esc(L('all'))}</button></div>` : '';
    body = filter + (list.length
      ? `<div class="gear-list">${list.map((it) => `<button class="gr${pick?.kind === 'item' && pick.uid === it.uid ? ' on' : ''}" data-gitem="${it.uid}" style="border-left-color:${RARITY_COLOR[it.rarity]}">${itemIcon(it, itemSlot(it))}<span class="gs-t">${coloured(it)}<span class="muted gs-sub">${esc(SLOT_NAMES[itemSlot(it)][ru() ? 1 : 0])} · ${esc(L('lv', { n: it.ilvl }))}${it.dur < 100 ? ` · ${esc(L('wear', { n: it.dur }))}` : ''}</span></span></button>`).join('')}</div>`
      : `<p class="muted">${esc(L('lockerEmpty'))}</p>`);
  } else if (tab === 'shop') {
    body = sy?.wares.length
      ? `<p class="muted">${esc(L('shopNote'))}</p><div class="gear-list">${sy.wares.map((it, i) => `<button class="gr${pick?.kind === 'ware' && pick.index === i ? ' on' : ''}" data-gware="${i}" style="border-left-color:${RARITY_COLOR[it.rarity]}">${itemIcon(it, itemSlot(it))}<span class="gs-t">${coloured(it)}<span class="muted gs-sub">${esc(SLOT_NAMES[itemSlot(it)][ru() ? 1 : 0])} · ${esc(L('lv', { n: it.ilvl }))}</span></span><span class="gr-price">${money(itemValue(it))}</span></button>`).join('')}</div>`
      : `<p class="muted">${esc(L('noShop'))}</p>`;
    if (sy) body += `<div class="gi-acts gear-mend"><button class="btn btn-small" data-gmend ${sy.mendCost ? '' : 'disabled'}>${sy.mendCost ? `${esc(L('mend', { v: '' }))}${money(sy.mendCost)}` : esc(L('sound'))}</button></div>`;
    if (forge) body += stormForgeCard(state);
  }

  const tabs: [Tab, string][] = [['ship', L('tab.ship')], ['captain', L('tab.captain')], ['locker', L('tab.locker', { n: self.stash.length, max: STASH_SIZE })]];
  if (docked) tabs.push(['shop', L('tab.shop')]);
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub', { ship: placeName(self.loadout.name), cls: cls.name, n: self.level }))} ${ownLevelChip(lvl)}</div></div><button class="btn btn-small" data-gclose>${esc(L('close'))}</button></div>
    <div class="modal-body gear"><div class="tabs gear-tabs">${tabs.map(([t, n]) => `<button class="tab${tab === t ? ' active' : ''}" data-tab="${t}">${esc(n)}</button>`).join('')}</div>
    <div class="gear-main"><div class="gear-body">${body}</div>${detail ? `<div class="gear-detail sheet"><button class="gear-hide" data-ghide aria-label="${esc(L('hide'))}">×</button>${detail}</div>` : ''}</div></div>`;

  const redo = () => renderGear(root, state, send, close);
  root.querySelector<HTMLElement>('[data-gclose]')!.onclick = close;
  root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => (b.onclick = () => {
    tab = b.dataset.tab as Tab;
    pick = null;
    only = null;
    redo();
  }));
  root.querySelector<HTMLElement>('[data-gall]')?.addEventListener('click', () => {
    only = null;
    redo();
  });
  root.querySelectorAll<HTMLElement>('[data-gslot]').forEach((b) => (b.onclick = () => {
    const slot = b.dataset.gslot as Slot;
    const has = isShipSlot(slot) ? shipGear[slot] : capGear[slot as never];
    if (has) pick = { kind: 'slot', slot };
    else {
      // An empty slot shows the locker's pieces for it, the best first.
      tab = 'locker';
      only = slot;
      const first = self.stash.filter((x) => itemSlot(x) === slot).sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl)[0];
      pick = first ? { kind: 'item', uid: first.uid } : null;
    }
    redo();
  }));
  root.querySelectorAll<HTMLElement>('[data-gitem]').forEach((b) => (b.onclick = () => {
    pick = { kind: 'item', uid: Number(b.dataset.gitem) };
    redo();
  }));
  root.querySelectorAll<HTMLElement>('[data-gware]').forEach((b) => (b.onclick = () => {
    pick = { kind: 'ware', index: Number(b.dataset.gware) };
    redo();
  }));
  root.querySelectorAll<HTMLElement>('[data-geq]').forEach((b) => (b.onclick = () => {
    const uid = Number(b.dataset.geq);
    const it = self.stash.find((x) => x.uid === uid);
    send({ t: 'gear', action: 'equip', uid });
    if (it) pick = { kind: 'slot', slot: itemSlot(it) };
  }));
  root.querySelectorAll<HTMLElement>('[data-gun]').forEach((b) => (b.onclick = () => {
    send({ t: 'gear', action: 'unequip', slot: b.dataset.gun as Slot });
    pick = null;
  }));
  root.querySelectorAll<HTMLElement>('[data-gsell]').forEach((b) => (b.onclick = () => {
    send({ t: 'gear', action: 'sell', uid: Number(b.dataset.gsell) });
    pick = null;
  }));
  root.querySelectorAll<HTMLElement>('[data-gsalv]').forEach((b) => (b.onclick = () => {
    send({ t: 'gear', action: 'salvage', uid: Number(b.dataset.gsalv) });
    pick = null;
  }));
  root.querySelectorAll<HTMLElement>('[data-gtemper]').forEach((b) => (b.onclick = () => send({ t: 'gear', action: 'temper', uid: Number(b.dataset.gtemper) })));
  root.querySelectorAll<HTMLElement>('[data-greforge]').forEach((b) => (b.onclick = () => send({ t: 'gear', action: 'reforge', uid: Number(b.dataset.greforge), line: Number(b.dataset.line) })));
  root.querySelectorAll<HTMLElement>('[data-gbuy]').forEach((b) => (b.onclick = () => send({ t: 'gear', action: 'buy', index: Number(b.dataset.gbuy) })));
  root.querySelector<HTMLElement>('[data-gmend]')?.addEventListener('click', () => send({ t: 'gear', action: 'mend' }));
  bindStormForge(root, send);
  // On a desktop a row under the cursor shows its card beside what is worn, without a click (docs/16 #38).
  if (!document.body.classList.contains('touch') && matchMedia('(hover: hover)').matches) {
    const hide = () => document.querySelectorAll('.gear-tip').forEach((e) => e.remove());
    root.querySelectorAll<HTMLElement>('[data-gitem], [data-gware]').forEach((row) => {
      row.onmouseenter = () => {
        hide();
        const pair = hoverPair(self, row, sy?.wares);
        if (!pair || (pick?.kind === 'item' && pick.uid === pair.it.uid)) return;
        const tip = document.createElement('div');
        tip.className = 'gear-tip';
        tip.innerHTML = `<div class="gt-name">${itemIcon(pair.it, itemSlot(pair.it), 'ico-sm')}${coloured(pair.it)}<span class="muted"> · ${esc(L('lv', { n: pair.it.ilvl }))}</span></div>${compare(pair.it, pair.cur)}`;
        document.body.appendChild(tip);
        const r = row.getBoundingClientRect(), t = tip.getBoundingClientRect();
        const right = r.right + 8 + t.width <= innerWidth - 4;
        tip.style.left = `${Math.max(4, right ? r.right + 8 : r.left - 8 - t.width)}px`;
        tip.style.top = `${Math.max(4, Math.min(innerHeight - t.height - 4, r.top))}px`;
      };
      row.onmouseleave = hide;
    });
    root.addEventListener('click', hide);
  }
  root.querySelector<HTMLElement>('[data-ghide]')?.addEventListener('click', () => {
    pick = null;
    redo();
  });
}
