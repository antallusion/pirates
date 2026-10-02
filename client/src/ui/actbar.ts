// The context action bar over the guns (owner, 2026-10-02: "sailing up to things there should be buttons at the
// bottom for what to do next; now nothing shows, so there is no telling what to press"). Everything to do at hand is
// a button — its icon, a short word, its key on a keyboard — in one order: the first is the gold one, the very thing
// the gamepad's A (and the touch context) does; three at most show, the rest behind «⋯ N more». What stops her, the
// protection, the party ashore, the carpenters' pace: one muted line above. The facts are gathered by main.ts; this
// file only orders and draws them (and the tests check the order against the pad's).

import type { MarkKind } from '../../../shared/src/data/seamarks.ts';
import { MARK_ICON } from '../../../shared/src/data/seamarks.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/actbar.ts';
import type { Action } from '../settings.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);

export type ActId = 'axes' | 'harbour' | 'board' | 'dock' | 'land' | 'cut_mast' | 'cast' | 'base' | 'claim' | 'ritual' | 'mark' | 'look' | 'repair';
export type LandAction = 'land' | 'dig' | 'raise' | 'expedition' | 'descent' | 'keeper' | 'escort' | 'dive' | 'lair';
export type LookKind = 'obj' | 'guard' | 'lair' | 'drift';

/** What is at hand, as main.ts reads the state (names already in the reader's language). */
export interface ActFacts {
  grabbed?: boolean;
  docked?: boolean;
  /** In port with the harbour's screen open (the bar has nothing to add then). */
  harbourOpen?: boolean;
  board?: { name: string } | null;
  port?: { name: string } | null;
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
  looks?: { kind: LookKind; name: string }[];
  repair?: { repairing: boolean; combat: boolean; hurt: boolean; short?: boolean } | null;
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
const LOOK_ICON: Record<LookKind, string> = { obj: 'map_event', guard: 'wanted', lair: 'map_monster', drift: 'map_ship' };

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
  if (f.port) out.push({ id: 'dock', icon: 'map_port', label: L('a.dock'), sub: f.port.name, title: `${L('a.dock')}: ${f.port.name}`, key: 'dock' });
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
  for (const k of f.looks ?? []) out.push({ id: 'look', icon: LOOK_ICON[k.kind], label: L('a.look'), sub: k.name, title: L('a.lookTitle', { name: k.name }), arg: k.kind });
  const r = f.repair;
  if (r && (r.repairing || (!r.combat && r.hurt && !r.short))) out.push({ id: 'repair', icon: 'prof_carpenter', label: L(r.repairing ? 'a.repairStop' : 'a.repair'), title: L(r.repairing ? 'a.repairStop' : 'a.repair'), key: 'repair' });
  return out;
}

/** What the land key does at sea, with nothing to land at: the mast, the net, the mark — in the bar's order. */
export function landKeyAct(acts: Act[]): Act | null {
  return acts.find((a) => a.id === 'land' || a.id === 'cut_mast' || a.id === 'cast' || a.id === 'mark') ?? null;
}

/** Three buttons show at most; with more, two and the «⋯ N more» that opens the rest above them. */
export const ACT_SHOW = 3;

/** The bar's HTML: the info line, the buttons (`keyOf` names an action's key; null on touch), the toggle. */
export function actBarHtml(acts: Act[], info: string[], keyOf: ((a: Action) => string) | null, open: boolean): string {
  const btn = (a: Act, i: number) => {
    const k = keyOf && a.key ? keyOf(a.key) : '';
    return `<button type="button" class="act-btn${i === 0 ? ' primary' : ''}" data-act="${i}" title="${esc(a.title)}" aria-label="${esc(a.sub ? `${a.label}: ${a.sub}` : a.label)}">${icon(a.icon, '•', 'act-ico')}<span class="act-l">${esc(a.label)}</span>${a.sub ? `<span class="act-s">${esc(a.sub)}</span>` : ''}${k ? `<kbd class="act-k">${esc(k)}</kbd>` : ''}</button>`;
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

export const lookName = (k: LookKind): string => L(`look.${k}`);
export const slowWord = (): string => L('mi.slow');
