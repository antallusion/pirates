// The Throne of the Sea window (docs/19 E18, begun with E1–E3): one window for the endgame, its tabs registered in
// THRONE_TABS so the later parts (citadels, the war table, the seals, the contracts) come in as tabs of their own.
// Glory: the rank and its bar, the boon to choose of a rank (one of the four primaries, each to its cap), what glory
// and mastery add in a boarding. Mastery: the four branches and their tiers, a point a node, the reset in port.
// Trials: each skill's legend, her ship and army, and the challenge (or the wait, or the grandmaster won).

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { PRIMS, PRIM_ICON, PRIM_NAMES, SKILLS, skillText } from '../../../shared/src/data/hero.ts';
import type { PrimId } from '../../../shared/src/data/hero.ts';
import {
  BRANCHES, BRANCH_ICON, BRANCH_NAMES, BRANCH_TEXT, ENDGAME_CAP, GLORY_CAP, GLORY_TEXT, LEGENDS, MASTERY, MASTERY_EVERY, TIER_NEED, branchPoints,
} from '../../../shared/src/data/throne.ts';
import type { Branch, GloryView, MasteryNode, TrialView } from '../../../shared/src/data/throne.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/throne.ts';
import { LAIRS } from '../../../shared/src/data/lairs.ts';
import { SEAL_AFFIX_NAMES, SEAL_AFFIX_TEXT } from '../../../shared/src/data/seals.ts';
import type { SealAffix } from '../../../shared/src/data/seals.ts';
import { serverText } from '../lang/server.ts';
import { placeName } from './maps.ts';
import { RAID, RAID_TIERS, raidPay } from '../../../shared/src/data/abyssraid.ts';
import { unitIcon, unitName } from './army.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon, money } from './dom.ts';

const L = dict(EN, RU);
const T = (x: [string, string]) => x[lang() === 'ru' ? 1 : 0];
const pc = (x: number) => `${Math.round(x * 100)}%`;

/** A tab of the Throne: its name and mark, whether it shows, what it draws and how its buttons speak. */
export interface ThroneTab {
  id: string;
  label: () => string;
  icon: string;
  /** A count on the tab (a boon waiting, a point to spend). */
  badge?: (g: GloryView) => number;
  render: (g: GloryView, state: ClientState) => string;
  /** Its buttons: `close` shuts the window (a trial's battle opens over the sea). */
  bind?: (root: HTMLElement, send: (m: ClientMsg) => void, close: () => void) => void;
}

function pips(r: number, max: number): string {
  return `<span class="hx-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</span>`;
}

// ------------------------------------------------------------------ glory

function gloryTab(g: GloryView, state: ClientState): string {
  const self = state.self!;
  if (!g.open) return `<p class="muted th-locked">${esc(L('locked', { n: MAX_LEVEL, m: self.level }))}</p>`;
  const f = g.need ? Math.max(0, Math.min(1, g.xp / g.need)) : 0;
  const next = (Math.floor(g.rank / MASTERY_EVERY) + 1) * MASTERY_EVERY;
  const allCap = PRIMS.every((k) => g.picks[k] >= GLORY_CAP);
  const boon = g.pending > 0
    ? `<div class="hx-offer card th-boon"><h4 class="card-h">${icon('tattoo_star', '★', 'ico-md')}${esc(L('boonH'))}<span class="muted hx-pend">${esc(L('boonWait', { n: g.pending }))}</span></h4>
      <div class="th-boons">${PRIMS.map((k: PrimId) => {
        const full = g.picks[k] >= GLORY_CAP;
        return `<div class="th-bt${full ? ' full' : ''}">${icon(PRIM_ICON[k], '', 'ico-lg')}<b>${esc(T(PRIM_NAMES[k]))}</b><span class="hx-rank">${pips(g.picks[k], GLORY_CAP)} ${esc(L('boonOf', { n: g.picks[k], m: GLORY_CAP }))}</span><small>${esc(T(GLORY_TEXT[k]))}</small><button class="btn btn-small btn-primary" data-thglory="${k}" ${full ? 'disabled' : ''}>${esc(full ? L('atHeight') : L('take'))}</button></div>`;
      }).join('')}</div></div>`
    : `<p class="muted hx-none">${esc(allCap ? L('boonFull', { n: GLORY_CAP }) : L('boonNone'))}</p>`;
  const l = g.lift;
  const row = (k: keyof typeof EN, v: number, sign = '+') => `<div class="th-lift-r"><span>${esc(L(k))}</span><b class="${v ? 'good' : 'muted'}">${v ? `${sign}${pc(v)}` : '—'}</b></div>`;
  return `<div class="th-head">
      <div class="th-medal" title="${esc(L('rank'))}"><span>★</span><b>${g.rank}</b></div>
      <div class="th-hside"><div class="gi-h">${esc(L('rank'))} ${g.rank}</div>
        <div class="th-bar"><i style="width:${Math.round(f * 100)}%"></i></div>
        <small class="muted">${esc(L('toNext', { n: fmt(g.xp), m: fmt(g.need), r: g.rank + 1 }))}</small>
        <small class="gold">${esc(L('points', { n: g.points - g.spent, m: g.points }))} · ${esc(L('pointsNext', { r: next }))}</small>
      </div></div>
    ${boon}
    <div class="gi-h">${esc(L('liftH'))}</div>
    <div class="th-lift">${row('lift.melee', l.melee)}${row('lift.shot', l.shot)}${row('lift.taken', l.taken, '−')}${row('lift.orders', l.orders)}${row('lift.will', l.will)}${row('lift.stam', l.stam)}</div>
    <p class="muted hx-note">${esc(L('rules', { n: GLORY_CAP, k: MASTERY_EVERY }))} ${esc(L('liftNote', { a: Math.round(ENDGAME_CAP.melee * 100), b: Math.round(ENDGAME_CAP.taken * 100), c: Math.round(ENDGAME_CAP.orders * 100) }))}</p>`;
}

// ------------------------------------------------------------------ mastery

function nodeTile(g: GloryView, n: MasteryNode): string {
  const r = g.nodes[n.id] ?? 0;
  const free = g.points - g.spent;
  const tierOk = branchPoints(g.nodes, n.branch) >= TIER_NEED[n.tier];
  const whole = r >= n.max;
  const why = whole ? L('whole') : !tierOk ? L('needTier', { k: TIER_NEED[n.tier] }) : free <= 0 ? L('noPoint') : '';
  return `<div class="th-node${r ? ' on' : ''}${!tierOk ? ' shut' : ''}">${icon(n.icon, '✦', 'ico-md')}<span class="th-nt"><b>${esc(T(n.name))}</b><span class="hx-rank">${pips(r, n.max)} ${r}/${n.max}</span><small>${esc(T(n.text))}</small></span><button class="btn btn-small${why ? '' : ' btn-primary'}" data-thnode="${n.id}" ${why || !g.open ? 'disabled' : ''} title="${esc(why)}">${esc(whole ? L('whole') : L('learn'))}</button></div>`;
}

function masteryTab(g: GloryView, state: ClientState): string {
  if (!g.open) return `<p class="muted th-locked">${esc(L('locked', { n: MAX_LEVEL, m: state.self!.level }))}</p>`;
  const branch = (b: Branch) => {
    const tiers = [1, 2, 3].map((t) => {
      const list = MASTERY.filter((n) => n.branch === b && n.tier === t);
      return `<div class="th-tier"><small class="muted">${esc(t === 1 ? L('tier', { n: t }) : L('tierNeed', { n: t, k: TIER_NEED[t] }))}</small>${list.map((n) => nodeTile(g, n)).join('')}</div>`;
    }).join('');
    return `<div class="th-branch card"><h4 class="card-h">${icon(BRANCH_ICON[b], '', 'ico-md')}<span>${esc(T(BRANCH_NAMES[b]))}<small class="muted">${esc(T(BRANCH_TEXT[b]))}</small></span><span class="th-bp">${esc(L('branchPts', { n: branchPoints(g.nodes, b) }))}</span></h4>${tiers}</div>`;
  };
  const docked = !!state.self?.dockedAt;
  return `<div class="th-mhead"><b class="gold">${esc(L('points', { n: g.points - g.spent, m: g.points }))}</b>
      <button class="btn btn-small" data-threset ${!docked || !g.spent || (state.self?.gold ?? 0) < g.reset ? 'disabled' : ''} title="${esc(L('resetPort'))}">${esc(L('reset'))}${g.spent ? money(g.reset) : ''}</button></div>
    <div class="th-branches">${BRANCHES.map(branch).join('')}</div>`;
}

// ------------------------------------------------------------------ trials

function trialRow(v: TrialView, docked: boolean, busy: boolean): string {
  const lg = LEGENDS[v.skill];
  const d = SKILLS[v.skill];
  const face = CAPTAINS[lg.path].portrait;
  let act = '';
  if (v.state === 'won') act = `<span class="th-st won">${icon('tattoo_star', '★', 'ico-sm')}${esc(L('st.won'))}</span>`;
  else if (v.state === 'wait') act = `<span class="th-st wait">${esc(L('st.wait', { n: Math.ceil((v.wait ?? 0) / 60) }))}</span>`;
  else if (v.state === 'locked') act = `<span class="th-st muted">${esc(v.rank >= 3 ? L('st.lockedCap', { n: MAX_LEVEL }) : L('st.locked'))}</span>`;
  else act = `<button class="btn btn-small btn-primary" data-thtrial="${v.skill}" ${docked || busy ? 'disabled' : ''} title="${esc(docked ? L('st.sea') : '')}">${esc(docked ? L('st.sea') : L('st.ready'))}</button>`;
  return `<div class="th-trial th-${v.state}">
    <div class="th-face">${icon(face, '', 'ico-lg ico-round')}${icon(d.icon, '', 'ico-sm th-sk')}</div>
    <span class="th-tt"><b>${esc(T(d.name))}</b><span class="th-lg">${esc(L('legend', { name: T(lg.name) }))} · ${esc(L('ship', { ship: T(lg.ship) }))} · ${esc(L('army', { n: Math.round((lg.men - 1) * 100) }))}</span>
      <small>${esc(L('gmIs', { text: T(skillText(v.skill, 4)) }))}</small>${v.tries ? `<small class="muted">${esc(L('tries', { n: v.tries }))}</small>` : ''}</span>${act}</div>`;
}

function trialsTab(g: GloryView, state: ClientState): string {
  const docked = !!state.self?.dockedAt;
  const order = { ready: 0, wait: 1, won: 2, locked: 3 } as const;
  const list = [...g.trials].sort((a, b) => order[a.state] - order[b.state] || b.rank - a.rank);
  return `${g.fighting ? `<div class="th-fight card">${icon('bt_charge', '', 'ico-md')}${esc(L('fighting', { skill: T(SKILLS[g.fighting].name) }))}</div>` : ''}
    <p class="muted hx-note">${esc(L('trialsNote'))}</p>
    <div class="th-trials">${list.map((v) => trialRow(v, docked, !!g.fighting)).join('')}</div>`;
}

// ------------------------------------------------------------------ seals (docs/19 E9)

/** Each affliction's mark (the painted icons it is nearest to). */
const AFFIX_ICON: Record<SealAffix, string> = { tide: 'boon_black_water', fury: 'boon_salt_fury', shields: 'boon_iron_skin', reinforce: 'ab_call_escort' };

function sealsTab(g: GloryView, state: ClientState): string {
  const v = g.seal;
  if (!g.open || !v) return `<p class="muted th-locked">${esc(L('locked', { n: MAX_LEVEL, m: state.self?.level ?? 0 }))}</p>`;
  const lair = T(LAIRS[v.kind].name);
  const affixes = v.affixes.map((a) => `<div class="th-affix">${icon(AFFIX_ICON[a], '', 'ico-md')}<span><b>${esc(T(SEAL_AFFIX_NAMES[a]))}</b><small>${esc(T(SEAL_AFFIX_TEXT[a]))}</small></span></div>`).join('');
  const near = v.near ? L('seal.near', { island: placeName(v.near.island), km: (v.near.d / 1000).toFixed(1).replace('.', lang() === 'ru' ? ',' : '.') }) : L('seal.nearNone');
  const why = v.why ? serverText(v.why) : '';
  const board = v.board.length
    ? `<ol class="th-board">${v.board.map((r) => `<li class="${r.you ? 'you' : ''}"><b>${esc(r.name)}</b><span>${esc(L('seal.row', { lv: r.lv, r: r.rounds }))}</span></li>`).join('')}</ol>`
    : `<p class="muted hx-none">${esc(L('seal.boardNone'))}</p>`;
  return `${v.fighting ? `<div class="th-fight card">${icon('bt_charge', '', 'ico-md')}${esc(L('seal.fighting'))}</div>` : ''}
    <div class="th-head">
      <div class="th-medal th-seal" title="${esc(L('seal.h', { n: v.lv }))}"><span>${icon('ab_deep_call', '◈', 'ico-sm')}</span><b>${v.lv}</b></div>
      <div class="th-hside"><div class="gi-h">${esc(L('seal.h', { n: v.lv }))}</div>
        <div>${esc(L('seal.lair', { lair }))}</div>
        <div class="th-chips"><span class="th-chip">${esc(L('seal.rounds', { n: v.rounds }))}</span><span class="th-chip">${esc(L('seal.fast', { n: v.fast }))}</span></div></div>
    </div>
    <div class="th-seal-go">
      <span class="muted">${esc(near)}</span>
      ${v.near ? `<button class="btn btn-small" data-thcourse="${v.near.x},${v.near.y}">${esc(L('seal.course'))}</button>` : ''}
      <button class="btn btn-small btn-primary" data-thseal ${v.why ? 'disabled' : ''} title="${esc(why)}">${esc(L('seal.enter'))}</button>
    </div>
    ${why ? `<p class="muted th-why">${esc(why)}</p>` : ''}
    <h4 class="card-h">${esc(L('seal.affixes'))}</h4>
    <div class="th-affixes">${affixes}</div>
    <p class="th-pay">${esc(L('seal.pay', { silver: fmt(v.pay.silver), pearls: v.pay.pearls, art: Math.round(v.pay.art * 100) }))}</p>
    <p class="muted">${esc(v.best ? L('seal.best', { lv: v.best.lv, r: v.best.rounds }) : L('seal.bestNone'))} · ${esc(L('seal.runs', { n: v.runs, t: v.timed }))}</p>
    <h4 class="card-h">${esc(L('seal.board'))}</h4>
    ${board}
    <p class="muted hx-note">${esc(L('seal.rule', { r: v.rounds, f: v.fast }))}</p>`;
}

// ------------------------------------------------------------------ the Abyss (docs/19 E11)

function raidTab(g: GloryView, state: ClientState): string {
  const v = g.raid;
  if (!g.open || !v) return `<p class="muted th-locked">${esc(L('locked', { n: MAX_LEVEL, m: state.self?.level ?? 0 }))}</p>`;
  const km = (v.gate.d / 1000).toFixed(1).replace('.', lang() === 'ru' ? ',' : '.');
  const steps = RAID.map((t) => {
    const st = v.cleared.includes(t.n) ? 'done' : t.n === v.tier ? 'on' : 'off';
    return `<li class="th-rt ${st}" title="${esc(T(t.name))}"><b>${t.n}</b><span>${esc(T(t.name))}</span></li>`;
  }).join('');
  const down = v.tier > RAID_TIERS;
  const t = RAID[Math.min(RAID_TIERS, v.tier) - 1];
  const army = v.left.map((x) => `<span class="th-unit" title="${esc(unitName(x.u))}">${unitIcon(x.u, 'army-face-xs')}<b>${fmt(x.n)}</b></span>`).join('');
  const why = v.why ? serverText(v.why) : '';
  const members = v.members.length
    ? `<ol class="th-board">${[...v.members].sort((a, b) => b.cut - a.cut).map((m) => `<li class="${m.you ? 'you' : ''}"><b>${esc(m.name)}</b><span>${esc(L('raid.cut', { n: fmt(m.cut) }))}</span></li>`).join('')}</ol>`
    : `<p class="muted hx-none">${esc(L('raid.membersNone'))}</p>`;
  const board = v.board.length ? `<ol class="th-board">${v.board.map((b) => `<li><b>${esc(b.names.join(', '))}</b></li>`).join('')}</ol>` : `<p class="muted hx-none">${esc(L('raid.weekNone'))}</p>`;
  const now = down
    ? `<p class="th-pay">${esc(L('raid.down'))}</p>`
    : `<div class="th-head">
      <div class="th-medal th-seal" title="${esc(T(t.name))}"><span>${icon('ab_maw_of_the_deep', '◈', 'ico-sm')}</span><b>${t.n}</b></div>
      <div class="th-hside"><div class="gi-h">${esc(L('raid.tier', { n: t.n, m: RAID_TIERS, name: T(t.name) }))}</div>
        <div class="muted">${esc(L('raid.ship', { ship: T(t.ship) }))}</div>
        <div class="th-chips"><span class="th-chip">${esc(L('raid.left', { p: v.share }))}</span></div>
        <div class="th-bar"><i style="width:${Math.max(0, Math.min(100, v.share))}%"></i></div></div>
    </div>
    <div class="th-seal-go">
      <span class="muted">${esc(L('raid.gate', { km }))}</span>
      <button class="btn btn-small" data-thcourse="${v.gate.x},${v.gate.y}">${esc(L('raid.course'))}</button>
      <button class="btn btn-small btn-primary" data-thraid ${v.why ? 'disabled' : ''} title="${esc(why)}">${esc(L('raid.board'))}</button>
    </div>
    ${why ? `<p class="muted th-why">${esc(why)}</p>` : ''}
    <div class="th-raid-army">${army}</div>
    <p class="th-pay">${esc(L('raid.pay', { silver: fmt(raidPay(t.n).silver) }))}</p>`;
  return `${v.fighting ? `<div class="th-fight card">${icon('bt_charge', '', 'ico-md')}${esc(L('raid.fighting', { name: v.fighting }))}</div>` : ''}
    <ol class="th-raid">${steps}</ol>
    ${now}
    <h4 class="card-h">${esc(L('raid.members'))}</h4>
    ${members}
    <h4 class="card-h">${esc(L('raid.week'))}</h4>
    ${board}
    <p class="muted hx-note">${esc(L('raid.rule'))}</p>`;
}

/** The tabs of the Throne, in order (later parts of docs/19 add theirs here). */
export const THRONE_TABS: ThroneTab[] = [
  {
    id: 'glory', label: () => L('tab.glory'), icon: 'tattoo_star', badge: (g) => g.pending, render: gloryTab,
    bind: (root, send) => root.querySelectorAll<HTMLElement>('[data-thglory]').forEach((b) => (b.onclick = () => send({ t: 'throne', action: 'glory', id: b.dataset.thglory }))),
  },
  {
    id: 'mastery', label: () => L('tab.mastery'), icon: 'tree_command', badge: (g) => (g.open ? Math.max(0, g.points - g.spent) : 0), render: masteryTab,
    bind: (root, send) => {
      root.querySelectorAll<HTMLElement>('[data-thnode]').forEach((b) => (b.onclick = () => send({ t: 'throne', action: 'node', id: b.dataset.thnode })));
      root.querySelectorAll<HTMLElement>('[data-threset]').forEach((b) => (b.onclick = () => send({ t: 'throne', action: 'reset' })));
    },
  },
  {
    id: 'trials', label: () => L('tab.trials'), icon: 'bt_charge', badge: (g) => g.trials.filter((v) => v.state === 'ready').length, render: trialsTab,
    bind: (root, send, close) => root.querySelectorAll<HTMLElement>('[data-thtrial]').forEach((b) => (b.onclick = () => {
      send({ t: 'throne', action: 'trial', id: b.dataset.thtrial });
      close();
    })),
  },
  {
    // docs/19 E9: her seal of the deep — a mark on the tab when her boats reach its lair.
    id: 'seals', label: () => L('tab.seals'), icon: 'ab_deep_call', badge: (g) => (g.seal && !g.seal.why ? 1 : 0), render: sealsTab,
    bind: (root, send, close) => {
      root.querySelectorAll<HTMLElement>('[data-thseal]').forEach((b) => (b.onclick = () => {
        send({ t: 'throne', action: 'seal' });
        close();
      }));
      root.querySelectorAll<HTMLElement>('[data-thcourse]').forEach((b) => (b.onclick = () => {
        const [x, y] = (b.dataset.thcourse ?? '').split(',').map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) send({ t: 'autosail', x, y });
        close();
      }));
    },
  },
  {
    // docs/19 E11: the Abyss of the Throne — a mark on the tab when the legend may be boarded.
    id: 'raid', label: () => L('tab.raid'), icon: 'ab_maw_of_the_deep', badge: (g) => (g.raid && !g.raid.why ? 1 : 0), render: raidTab,
    bind: (root, send, close) => {
      root.querySelectorAll<HTMLElement>('[data-thraid]').forEach((b) => (b.onclick = () => {
        send({ t: 'throne', action: 'raid' });
        close();
      }));
      root.querySelectorAll<HTMLElement>('[data-thcourse]').forEach((b) => (b.onclick = () => {
        const [x, y] = (b.dataset.thcourse ?? '').split(',').map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) send({ t: 'autosail', x, y });
        close();
      }));
    },
  },
];

export class ThroneWindow {
  tab = 'glory';
  private send: (m: ClientMsg) => void;
  onClose: () => void = () => {};

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  open(tab?: string): void {
    if (tab && THRONE_TABS.some((t) => t.id === tab)) this.tab = tab;
    this.send({ t: 'throne', action: 'view' });
  }

  render(root: HTMLElement, state: ClientState): void {
    const self = state.self;
    const g = self?.glory;
    if (!self) return;
    const head = `<div class="modal-head"><div><h2>${icon('tattoo_crown', '', 'ico-md')}${esc(L('title'))}</h2><div class="sub">${esc(L('sub', { name: self.name, n: self.level, g: g?.rank ?? 0 }))}</div></div></div>`;
    if (!g) {
      root.innerHTML = `${head}<div class="modal-body throne-win"><p class="muted th-locked">${esc(L('locked', { n: MAX_LEVEL, m: self.level }))}</p></div>`;
    } else {
      const tab = THRONE_TABS.find((t) => t.id === this.tab) ?? THRONE_TABS[0];
      root.innerHTML = `${head}<div class="modal-body throne-win"><div class="tabs">${THRONE_TABS.map((t) => {
        const n = t.badge?.(g) ?? 0;
        return `<button class="tab${t === tab ? ' active' : ''}" data-thtab="${t.id}">${icon(t.icon, '', 'ico-sm')}${esc(t.label())}${n ? ` <span class="hx-dot">${n}</span>` : ''}</button>`;
      }).join('')}</div>${tab.render(g, state)}</div>`;
      tab.bind?.(root, this.send, () => this.onClose());
    }
    root.querySelectorAll<HTMLElement>('[data-thtab]').forEach((b) => (b.onclick = () => {
      this.tab = b.dataset.thtab!;
      this.render(root, state);
    }));
  }
}

/** The glory chip on the captain's plate (docs/19 E1): the rank, and a mark when a boon or a point waits. */
export function gloryChip(g: GloryView | undefined): string {
  if (!g || !g.open) return '';
  const wait = g.pending > 0 || g.points - g.spent > 0;
  return `<button class="uf-glory${wait ? ' wait' : ''}" data-throne title="${esc(L('plateTip', { n: g.rank }))}">★${g.rank}</button>`;
}
export const throneLabel = (): string => L('throne');
