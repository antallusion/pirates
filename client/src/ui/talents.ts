// Talent screen — the "Wind Rose" (docs/03_TALENT_TREES.md §2.10): ten rays, one per tree, grow with the points
// invested; the selected tree shows its tiers and keystones, then loadouts, respec and Legend Deeds.

import { DEEDS, MAX_COUNTED_DEEDS } from '../../../shared/src/data/deeds.ts';
import { ROSE_ORDER, TALENTS, TREES, KEYSTONE_GATE, canLearn, canUnlearn, pointsInTree, tierRequirement } from '../../../shared/src/data/talents.ts';
import type { TalentDef, TreeId } from '../../../shared/src/data/talents.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import type { ClientState } from '../state.ts';
import { dict, plural } from '../i18n.ts';
import { EN, RU } from '../lang/ui/talents.ts';
import { serverText } from '../lang/server.ts';
import { ask } from './confirm.ts';
import { esc, fmt, icon } from './dom.ts';
import { TALENT_BOOK } from '../../../shared/src/data/paths.ts';
import { EN as PB_EN, RU as PB_RU } from '../lang/ui/pathbook.ts';

const L = dict(EN, RU);
const points = (n: number) => `${n} ${plural(n, L('point.one'), L('point.few'), L('point.many'))}`;

type View = TreeId | 'bridges' | 'deeds';

export class TalentScreen {
  view: View = 'navigation';
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  render(root: HTMLElement, state: ClientState): void {
    const self = state.self;
    if (!self) return;
    const docked = !!self.dockedAt;
    const ctx = { level: self.level, abyssOpen: self.captain === 'drowned' || self.deeds.includes('deed_first_descent') };
    const counted = Math.min(self.deeds.length, MAX_COUNTED_DEEDS);
    const lo = self.loadouts;
    const now = state.estServerTime();
    const sel = this.view;
    const selTree = sel !== 'bridges' && sel !== 'deeds' ? sel : null;
    const selPts = selTree ? pointsInTree(self.talents, selTree) : sel === 'bridges' ? TALENTS.filter((x) => x.tree === 'bridge' && (self.talents[x.id] ?? 0) > 0).length : self.deeds.length;
    const nodes = ROSE_ORDER.map((t, i) => {
      const pts = pointsInTree(self.talents, t);
      const f = Math.min(1, pts / 26);
      const off = !TREES[t].playable;
      const native = TREES[t].native.includes(self.captain);
      return `<button class="rose-node ${sel === t ? 'active' : ''} ${off ? 'off' : ''}" data-view="${t}" style="--a:${i * 36}deg;--f:${(f * 360).toFixed(0)}deg" title="${esc(TREES[t].name)}" aria-label="${esc(TREES[t].name)}">${icon(`tree_${t}`, '✦', 'rose-ico')}${pts ? `<span class="rose-pts">${pts}</span>` : ''}${native ? `<i class="rose-native" title="${esc(L('nativeTip'))}">◆</i>` : ''}</button>`;
    }).join('');
    const coreArt = selTree ? `tree_${selTree}` : sel === 'bridges' ? 'ab_form_line' : 'goal';
    const coreName = selTree ? TREES[selTree].name : sel === 'bridges' ? L('bridges') : L('deeds');
    const loadouts = lo.slots > 1
      ? `<div class="tal-loadout" style="--n:${lo.slots}"><span class="with-ico">${icon('menu_talents', '', 'ico-sm')}${esc(L('loadout'))}</span>${Array.from({ length: lo.slots }, (_, i) => `<button class="btn btn-small ${i === lo.active ? 'btn-primary is-current' : ''}" data-loadout="${i}" ${i === lo.active ? 'aria-current="true"' : !docked || lo.switchAt > now ? 'disabled' : ''}>${i + 1}${lo.filled[i] ? '' : esc(L('empty'))}</button>`).join('')}<span class="muted">${esc(docked ? (lo.switchAt > now ? L('switchAgain', { n: Math.ceil((lo.switchAt - now) / 60) }) : L('switchInPort')) : L('switchOnlyInPort'))}</span></div>`
      : `<div class="tal-loadout muted">${esc(L('loadoutsAt20'))}</div>`;
    root.innerHTML = `
      <div class="modal-head"><div><h2>${esc(L('title'))}</h2></div></div>
      <div class="modal-body">
        <div class="tal-chips"><span class="chip-stat">${icon('xp', '', 'ico-sm')}${esc(L('chip.level', { level: self.level }))}</span><span class="chip-stat ${self.talentPoints ? 'hot' : ''}">${icon('menu_talents', '', 'ico-sm')}${esc(L('chip.points', { points: points(self.talentPoints) }))}</span><span class="chip-stat">${icon('goal', '', 'ico-sm')}${esc(L('chip.deeds', { counted, max: MAX_COUNTED_DEEDS }))}</span></div>
        ${loadouts}
        <div class="tal-layout">
          <div class="tal-side">
            <div class="rose">${nodes}<div class="rose-core">${icon(coreArt, '', 'rose-core-ico')}<b>${esc(coreName)}</b><span>${esc(sel === 'deeds' ? String(selPts) : points(selPts))}</span></div></div>
            <div class="rose-extra">
              <button class="btn btn-small ${sel === 'bridges' ? 'btn-primary' : ''}" data-view="bridges">${icon('ab_form_line', '', 'ico-sm')}${esc(L('bridges'))} <b>${TALENTS.filter((x) => x.tree === 'bridge' && (self.talents[x.id] ?? 0) > 0).length}</b></button>
              <button class="btn btn-small ${sel === 'deeds' ? 'btn-primary' : ''}" data-view="deeds">${icon('goal', '', 'ico-sm')}${esc(L('deeds'))} <b>${self.deeds.length}</b></button>
            </div>
            <p class="muted tal-rules">${esc(L('rules'))}</p>
          </div>
          <div class="tal-main">${this.view === 'deeds' ? deeds(self.deeds) : this.tree(self, ctx, docked)}</div>
          <div class="tal-respec">${this.respecBox(self, docked, now)}</div>
        </div>
      </div>`;
    root.querySelectorAll<HTMLElement>('[data-view]').forEach((el) => (el.onclick = () => {
      this.view = el.dataset.view as View;
      this.render(root, state);
    }));
    root.querySelectorAll<HTMLElement>('.talent[data-id]').forEach((el) => (el.onclick = (e) => {
      if ((e.target as HTMLElement).dataset.forget) return;
      this.send({ t: 'learn_talent', id: el.dataset.id! });
    }));
    root.querySelectorAll<HTMLElement>('[data-forget]').forEach((el) => (el.onclick = () => {
      void ask(self.respec.free ? L('confirmForget') : L('confirmForgetCost', { cost: fmt(self.respec.forgetCost) })).then((ok) => ok && this.send({ t: 'respec', mode: 'forget', id: el.dataset.forget! }));
    }));
    root.querySelectorAll<HTMLElement>('[data-loadout]:not([aria-current])').forEach((el) => (el.onclick = () => this.send({ t: 'loadout', slot: Number(el.dataset.loadout) })));
    root.querySelectorAll<HTMLElement>('[data-respec]').forEach((el) => (el.onclick = () => {
      const mode = el.dataset.respec as 'full' | 'token';
      void ask(mode === 'token' ? L('confirmToken') : self.respec.free ? L('confirmResetFree') : L('confirmResetCost', { cost: fmt(self.respec.cleanSlateCost) })).then((ok) => ok && this.send({ t: 'respec', mode }));
    }));
  }

  private respecBox(self: NonNullable<ClientState['self']>, docked: boolean, now: number): string {
    const r = self.respec;
    const cd = r.cleanSlateAt > now ? L('nextIn', { h: Math.ceil((r.cleanSlateAt - now) / 3600) }) : '';
    return `<div class="card"><h4 class="card-h">${icon('ab_brine_mend', '', 'ico-md')}${esc(L('respec'))}</h4>
      <p class="muted" style="font-size:12px">${esc(docked ? L('clickForget') : L('respecPort'))} ${esc(r.free ? L('allFree') : L('forgetCost', { cost: fmt(r.forgetCost) }))}</p>
      <div class="respec-btns"><button class="btn btn-small" data-respec="full" ${!docked || (!r.free && r.cleanSlateAt > now) ? 'disabled' : ''}>${esc(L('cleanSlate'))}${esc(r.free ? L('free') : L('cost', { cost: fmt(r.cleanSlateCost) }))}${esc(cd)}</button>
      <button class="btn btn-small" data-respec="token" ${!docked || self.tokens <= 0 ? 'disabled' : ''}>${esc(L('token', { n: self.tokens }))}</button></div></div>`;
  }

  private tree(self: NonNullable<ClientState['self']>, ctx: { level: number; abyssOpen: boolean }, docked: boolean): string {
    const view = this.view as TreeId | 'bridges';
    const talents = TALENTS.filter((x) => (view === 'bridges' ? x.tree === 'bridge' : x.tree === view));
    if (view !== 'bridges' && !TREES[view].playable) {
      return `<h3 class="tree-h">${icon(`tree_${view}`, '', 'ico-md')}${esc(TREES[view].name)}</h3><p class="motto">${esc(TREES[view].motto)}</p><p class="muted">${esc(L('later'))}</p>`;
    }
    if (!talents.length) return `<p class="muted">${esc(L('noBridges'))}</p>`;
    const head = view === 'bridges'
      ? `<h3 class="tree-h">${icon('ab_form_line', '', 'ico-md')}${esc(L('bridges'))}</h3><p class="motto">${esc(L('bridgesMotto'))}</p>`
      : `<h3 class="tree-h">${icon(`tree_${view}`, '', 'ico-md')}${esc(TREES[view].name)} <span class="muted" style="font-size:14px">${esc(points(pointsInTree(self.talents, view)))}</span></h3><p class="motto">${esc(TREES[view].motto)}${TREES[view].complete ? esc(L('tiersOpen', { gate: KEYSTONE_GATE })) : ''}</p>`;
    const tiers = [...new Set(talents.map((x) => (x.keystone ? 99 : x.tier)))].sort((a, b) => a - b);
    return head + tiers.map((tier) => `<div class="tier-label">${esc(tier === 99 ? L('keystones') : view === 'bridges' ? L('bridges') : L('tier', { tier, points: points(tierRequirement(talents.find((x) => x.tier === tier && !x.keystone)!)) }))}</div>
      <div class="tier-row">${talents.filter((x) => (x.keystone ? 99 : x.tier) === tier).map((x) => card(x, self, ctx, docked)).join('')}</div>`).join('');
  }
}

/** docs/18 item 6: what a talent also lifts in the path book in a boarding (its sea side as it was). */
function bookLine(id: string): string {
  const t = TALENT_BOOK[id];
  if (!t) return '';
  const P = dict(PB_EN, PB_RU);
  const parts = [t.mul ? P('lift.mul', { n: Math.round(t.mul * 100) }) : '', t.cost ? P('lift.cost', { n: Math.round(t.cost * 100) }) : '', t.stam ? P('lift.stam', { n: t.stam }) : '', t.will ? P('lift.will', { n: t.will }) : '', t.innate ? P('lift.innate', { n: Math.round(t.innate * 100) }) : ''].filter(Boolean);
  return `<small class="tal-book">${icon('bt_captain', '', 'ico-xs')}${esc(P('tab'))}: ${esc(parts.join(', '))}</small>`;
}

function card(x: TalentDef, self: NonNullable<ClientState['self']>, ctx: { level: number; abyssOpen: boolean }, docked: boolean): string {
  const rank = self.talents[x.id] ?? 0;
  const why = canLearn(self.talents, x.id, self.talentPoints, ctx);
  const locked = rank === 0 && why !== null && why !== 'No talent points available';
  const forgettable = docked && rank > 0 && !x.keystone && canUnlearn(self.talents, x.id, ctx) === null;
  const art = x.tree === 'bridge' ? `tree_${x.bridge?.trees[0] ?? 'command'}` : `tree_${x.tree}`;
  const pips = `<span class="pips">${Array.from({ length: x.maxRank }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</span>`;
  return `<div class="talent ${rank ? 'has' : ''} ${rank >= x.maxRank ? 'max' : ''} ${x.keystone ? 'keystone' : ''} ${locked ? 'locked' : ''}" data-id="${x.id}" title="${esc(why ? serverText(why) : L('learn'))}">
    ${icon(`talent_${x.id}`, '', 'talent-ico') || icon(art, '✦', 'talent-ico')}<div class="talent-body"><div class="talent-top"><b>${esc(x.name)}</b>${x.active ? `<span class="tag">${esc(L('active'))}</span>` : ''}${pips}${forgettable ? `<span class="forget" data-forget="${x.id}" title="${esc(L('forget'))}">×</span>` : ''}</div>
    <small>${esc(x.description)}</small>${bookLine(x.id)}${locked && why ? `<small class="why">${icon('danger', '', 'ico-xs')}${esc(serverText(why))}</small>` : ''}</div></div>`;
}

function deeds(have: string[]): string {
  return `<h3 class="tree-h">${icon('goal', '', 'ico-md')}${esc(L('deeds'))}</h3><p class="motto">${esc(L('deedsMotto'))}</p>
    <div class="deed-list">${DEEDS.map((d) => `<div class="deed-row ${have.includes(d.id) ? 'done' : ''}">${icon(d.id, '', 'item-ico') || icon('goal', '✦', 'item-ico')}<div class="item-text"><b>${esc(d.name)}</b><span class="muted">${esc(d.condition)}${d.awaits ? ` ${esc(L('opensWith', { what: d.awaits }))}` : ''}</span></div>${have.includes(d.id) ? '<span class="good deed-tick">✔</span>' : '<span></span>'}</div>`).join('')}</div>`;
}
