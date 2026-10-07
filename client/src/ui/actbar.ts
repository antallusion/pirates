// The context action bar over the guns (owner, 2026-10-02: "sailing up to things there should be buttons at the
// bottom for what to do next; now nothing shows, so there is no telling what to press"). Everything to do at hand is
// a button — its icon, a short word, its key on a keyboard — in one order: the first is the gold one, the very thing
// the gamepad's A (and the touch context) does; three at most show, the rest behind «⋯ N more». What stops her, the
// protection, the party ashore, the carpenters' pace: one muted line above. The facts are gathered by main.ts; this
// file only orders and draws them (and the tests check the order against the pad's).

import type { MarkKind } from '../../../shared/src/data/seamarks.ts';
import { MARK_ICON } from '../../../shared/src/data/seamarks.ts';
import type { FindKind } from '../../../shared/src/data/seafinds.ts';
import { FIND_ICON } from '../../../shared/src/data/seafinds.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/actbar.ts';
import { EN as FEN, RU as FRU } from '../lang/ui/seafinds.ts';
import { EN as REN, RU as RRU } from '../lang/ui/roamers.ts';
import { EN as SEN, RU as SRU } from '../lang/ui/seafight.ts';
import type { Action } from '../settings.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);
const LF = dict(FEN, FRU);
const LR = dict(REN, RRU);
const LS = dict(SEN, SRU);

export type ActId = 'attack' | 'attack_stop' | 'attack_mode' | 'axes' | 'harbour' | 'board' | 'dock' | 'homeport' | 'land' | 'cut_mast' | 'cast' | 'base' | 'claim' | 'ritual' | 'mark' | 'find' | 'roam' | 'roam_join' | 'roam_look' | 'look' | 'repair';
export type LandAction = 'land' | 'dig' | 'raise' | 'expedition' | 'descent' | 'keeper' | 'escort' | 'dive' | 'lair';
export type LookKind = 'obj' | 'guard' | 'lair' | 'drift' | 'struck';

/** What is at hand, as main.ts reads the state (names already in the reader's language). */
export interface ActFacts {
  grabbed?: boolean;
  docked?: boolean;
  /** In port with the harbour's screen open (the bar has nothing to add then). */
  harbourOpen?: boolean;
  board?: { name: string } | null;
  port?: { name: string } | null;
  /** docs/23 item 79: the First Watch's «В порт» far from any harbour — the helmsman sails her to the nearest one. */
  homeport?: { name: string } | null;
  landable?: { action: LandAction; feature: string; island: string; blocked?: boolean; title?: string } | null;
  mastWreck?: boolean;
  cast?: 'net' | 'lamp' | null;
  home?: { name: string } | null;
  /** Her island's window or the claim's terms already open: their button steps aside. */
  homeOpen?: boolean;
  claim?: { name: string; price: string } | null;
  claimOpen?: boolean;
  ritual?: boolean;
  mark?: { id: number; kind: MarkKind; done?: boolean; busy?: boolean } | null;
  /** docs/19 D5: one of the sea's small things at hand. */
  find?: { id: number; kind: FindKind; busy?: boolean; n?: number } | null;
  /** docs/19 D7: a roaming stack within reach: its name, HoMM3's word and level, a fight on it, the offer at ×3. */
  roam?: { id: number; icon: string; name: string; word: string; lv: number; fight?: 'other' | 'mate'; offer?: 'join' | 'flee'; joinN?: number } | null;
  looks?: { kind: LookKind; name: string }[];
  repair?: { repairing: boolean; combat: boolean; hurt: boolean; short?: boolean } | null;
  /** docs/23 item 33: a mark to attack, or the pursuit under way (and how). */
  attack?: { name: string; pursuing: boolean; mode: 'guns' | 'board' } | null;
}

export interface Act {
  id: ActId;
  icon: string;
  label: string;
  /** The thing it is about (a ship, a port, an island), in small letters after the word. */
  sub?: string;
  title: string;
  /** The key it shares (a chip on a keyboard). */
  key?: Action;
  /** A mark's id, a look's kind. */
  arg?: string;
}

const LAND_WORD: Record<LandAction, keyof typeof EN> = {
  land: 'a.land', dig: 'a.dig', raise: 'a.raise', expedition: 'a.expedition', descent: 'a.descent', keeper: 'a.keeper', escort: 'a.escort', dive: 'a.dive', lair: 'a.lair',
};
const LAND_ICON: Record<LandAction, string> = {
  land: 'map_cove', dig: 'map_treasure', raise: 'map_wreck', expedition: 'item_drowned_admiral_bell', descent: 'map_whirlpool', keeper: 'build_lighthouse', escort: 'tab_contracts', dive: 'prof_sailor', lair: 'prof_marine',
};
const LOOK_ICON: Record<LookKind, string> = { obj: 'map_event', guard: 'wanted', lair: 'map_monster', drift: 'map_ship', struck: 'talent_brd_surrender_terms' };

/** Everything to do at hand, the first the one the pad's A does (padContext's order, kept here for both). */
export function buildActs(f: ActFacts): Act[] {
  const out: Act[] = [];
  if (f.grabbed) out.push({ id: 'axes', icon: 'item_boarding_axe', label: L('a.axes'), title: L('a.axes'), key: 'board' });
  if (f.docked) {
    // In port the harbour's screen is the bar; closed, the button brings it back.
    if (!f.harbourOpen) out.push({ id: 'harbour', icon: 'anchor', label: L('a.harbour'), title: L('a.harbour'), key: 'harbour' });
    return out;
  }
  if (f.board) out.push({ id: 'board', icon: 'tab_board', label: L('a.board'), sub: f.board.name, title: L('a.boardTitle', { name: f.board.name }), key: 'board' });
  // «Атаковать» (docs/23 item 33): one tap and the ship does the rest; under way, the other way to fight her and the
  // helm back.
  const at = f.attack;
  if (at && !at.pursuing) out.push({ id: 'attack', icon: 'ab_mark_target', label: LS('a.attack'), sub: at.name, title: LS('a.attackTitle', { name: at.name }) });
  if (at && at.pursuing) {
    out.push(at.mode === 'board'
      ? { id: 'attack_mode', icon: 'fire', label: LS('a.guns'), sub: at.name, title: LS('a.gunsTitle') }
      : { id: 'attack_mode', icon: 'ab_red_hook_boarding', label: LS('a.close'), sub: at.name, title: LS('a.closeTitle') });
    out.push({ id: 'attack_stop', icon: 'item_ship_wheel', label: LS('a.stop'), title: LS('a.stopTitle') });
  }
  if (f.port) out.push({ id: 'dock', icon: 'map_port', label: L('a.dock'), sub: f.port.name, title: `${L('a.dock')}: ${f.port.name}`, key: 'dock' });
  else if (f.homeport) out.push({ id: 'homeport', icon: 'map_port', label: L('a.dock'), sub: f.homeport.name, title: `${L('a.dock')}: ${f.homeport.name}` });
  const l = f.landable;
  if (l && !l.blocked) {
    const sub = l.action === 'raise' || l.action === 'dive' || l.action === 'lair' ? l.feature : l.action === 'descent' ? '' : l.island;
    out.push({ id: 'land', icon: LAND_ICON[l.action], label: L(LAND_WORD[l.action]), ...(sub ? { sub } : {}), title: l.title ?? ([l.feature, l.island].filter(Boolean).join(' · ') || L(LAND_WORD[l.action])), key: 'land' });
  }
  if (f.mastWreck) out.push({ id: 'cut_mast', icon: 'item_boarding_axe', label: L('a.cutMast'), title: L('a.cutMast'), key: 'land' });
  if (f.cast) out.push({ id: 'cast', icon: f.cast === 'lamp' ? 'item_squid_lamp' : 'item_drift_net', label: L(f.cast === 'lamp' ? 'a.lamp' : 'a.net'), title: L(f.cast === 'lamp' ? 'a.lamp' : 'a.net'), key: 'land' });
  if (f.home && !f.homeOpen) out.push({ id: 'base', icon: 'tab_isles', label: L('a.base'), sub: f.home.name, title: `${L('a.base')}: ${f.home.name}` });
  if (f.claim && !f.home && !f.claimOpen) out.push({ id: 'claim', icon: 'tab_holdings', label: L('a.claim'), sub: f.claim.name, title: L('a.claimTitle', { name: f.claim.name, price: f.claim.price }) });
  if (f.ritual) out.push({ id: 'ritual', icon: 'good_cursed_relics', label: L('a.ritual'), title: L('a.ritualTitle') });
  const m = f.mark;
  if (m && !m.done && !m.busy) out.push({ id: 'mark', icon: MARK_ICON[m.kind], label: L(`m.${m.kind}`), sub: L(`mn.${m.kind}`), title: L(`mt.${m.kind}`), key: 'land', arg: String(m.id) });
  const fd = f.find;
  if (fd && !fd.busy) {
    // (the word under it only where it tells her more: the fish on deck, a cache in the fog, how many sharks)
    const sub = `s.${fd.kind}` in FEN ? LF(`s.${fd.kind}` as keyof typeof FEN, { n: fd.n ?? 0 }) : '';
    out.push({ id: 'find', icon: FIND_ICON[fd.kind], label: LF(`a.${fd.kind}`), ...(sub ? { sub } : {}), title: LF(`t.${fd.kind}`), key: 'land', arg: String(fd.id) });
  }
  const rm = f.roam;
  if (rm && !rm.fight) {
    out.push({ id: 'roam', icon: 'prof_marine', label: LR('a.attack'), sub: `${rm.word} · ⚓${rm.lv}`, title: LR('t.attack', { what: rm.name, word: rm.word, lv: rm.lv }), key: 'land', arg: String(rm.id) });
    if (rm.offer === 'join' && (rm.joinN ?? 0) > 0) out.push({ id: 'roam_join', icon: 'stat_crew', label: LR('a.join'), sub: `×${rm.joinN}`, title: LR('t.join', { n: rm.joinN ?? 0 }), arg: String(rm.id) });
  }
  if (rm) out.push({ id: 'roam_look', icon: rm.icon, label: LR('a.look'), sub: rm.name, title: LR('t.look'), arg: String(rm.id) });
  for (const k of f.looks ?? []) out.push({ id: 'look', icon: LOOK_ICON[k.kind], label: L('a.look'), sub: k.name, title: L('a.lookTitle', { name: k.name }), arg: k.kind });
  const r = f.repair;
  if (r && (r.repairing || (!r.combat && r.hurt && !r.short))) out.push({ id: 'repair', icon: 'prof_carpenter', label: L(r.repairing ? 'a.repairStop' : 'a.repair'), title: L(r.repairing ? 'a.repairStop' : 'a.repair'), key: 'repair' });
  return out;
}

/** What the land key does at sea, with nothing to land at: the mast, the net, the mark — in the bar's order. */
export function landKeyAct(acts: Act[]): Act | null {
  return acts.find((a) => a.id === 'land' || a.id === 'cut_mast' || a.id === 'cast' || a.id === 'mark' || a.id === 'find' || a.id === 'roam') ?? null;
}

/** Three buttons show at most; with more, two and the «⋯ N more» that opens the rest above them. */
export const ACT_SHOW = 3;

/** The bar's HTML: the info line, the buttons (`keyOf` names an action's key; null on touch), the toggle. */
export function actBarHtml(acts: Act[], info: string[], keyOf: ((a: Action) => string) | null, open: boolean, show = ACT_SHOW): string {
  const ACT_SHOW = Math.max(2, show); // (the simple HUD on a desk shows two: the first and «⋯ N more»)
  const btn = (a: Act, i: number) => {
    const k = keyOf && a.key ? keyOf(a.key) : '';
    return `<button type="button" class="act-btn act-${a.id}${i === 0 ? ' primary' : ''}" data-act="${i}" title="${esc(a.title)}" aria-label="${esc(a.sub ? `${a.label}: ${a.sub}` : a.label)}">${icon(a.icon, '•', 'act-ico')}<span class="act-l">${esc(a.label)}</span>${a.sub ? `<span class="act-s">${esc(a.sub)}</span>` : ''}${k ? `<kbd class="act-k">${esc(k)}</kbd>` : ''}</button>`;
  };
  const many = acts.length > ACT_SHOW;
  const shown = many ? acts.slice(0, ACT_SHOW - 1) : acts;
  const rest = many ? acts.slice(ACT_SHOW - 1) : [];
  const line = info.length ? `<div class="act-info">${info.join(' · ')}</div>` : '';
  const extra = many && open ? `<div class="act-row act-more-row">${rest.map((a, j) => btn(a, ACT_SHOW - 1 + j)).join('')}</div>` : '';
  const toggle = many ? `<button type="button" class="act-btn act-toggle" data-act-more aria-expanded="${open}">${esc(open ? L('a.less') : L('a.more', { n: rest.length }))}</button>` : '';
  const row = acts.length ? `<div class="act-row">${shown.map(btn).join('')}${toggle}</div>` : '';
  return line || row ? `${line}${extra}${row}` : '';
}

/** The muted line of a sea mark's state (searched today, the boats at it). */
export function markInfo(kind: MarkKind, state: 'done' | 'busy', secs = 0): string {
  const what = L(`mn.${kind}`);
  const cap = what.charAt(0).toUpperCase() + what.slice(1);
  return state === 'done' ? L('mi.done', { what: cap }) : L('mi.busy', { what: cap, s: Math.max(0, Math.ceil(secs)) });
}

export const slowWord = (): string => L('mi.slow');

/** docs/19 D5: the muted line while the boats are at one of the sea's small things. */
export function findInfo(kind: FindKind, secs: number): string {
  return LF('busy', { what: LF(`n.${kind}`), s: Math.max(0, Math.ceil(secs)) });
}
