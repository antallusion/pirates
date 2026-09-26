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
import { esc, fmt, icon } from './dom.ts';

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
    const nav = [...ROSE_ORDER, 'bridges', 'deeds'] as View[];
    root.innerHTML = `
      <div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub', { level: self.level, points: points(self.talentPoints), counted, max: MAX_COUNTED_DEEDS }))}</div></div>
      <div style="text-align:right">${lo.slots > 1 ? `<div>${esc(L('loadout'))} ${Array.from({ length: lo.slots }, (_, i) => `<button class="btn btn-small ${i === lo.active ? 'btn-primary' : ''}" data-loadout="${i}" ${!docked || i === lo.active || lo.switchAt > now ? 'disabled' : ''}>${i + 1}${lo.filled[i] ? '' : esc(L('empty'))}</button>`).join(' ')}</div>
        <div class="muted" style="font-size:11px">${esc(docked ? (lo.switchAt > now ? L('switchAgain', { n: Math.ceil((lo.switchAt - now) / 60) }) : L('switchInPort')) : L('switchOnlyInPort'))}</div>` : `<div class="muted">${esc(L('loadoutsAt20'))}</div>`}</div></div>
      <div class="modal-body"><div style="display:grid;grid-template-columns:220px 1fr;gap:16px">
        <div>${rose(self.talents)}
          <div class="tree-nav">${nav.map((v) => {
            const label = v === 'bridges' ? L('bridges') : v === 'deeds' ? L('deeds') : TREES[v].name;
            const pts = v === 'bridges' ? TALENTS.filter((x) => x.tree === 'bridge' && (self.talents[x.id] ?? 0) > 0).length : v === 'deeds' ? self.deeds.length : pointsInTree(self.talents, v);
            const off = v !== 'bridges' && v !== 'deeds' && !TREES[v].playable;
            const native = v !== 'bridges' && v !== 'deeds' && TREES[v].native.includes(self.captain);
            return `<div class="tree-tab ${this.view === v ? 'active' : ''} ${off ? 'muted' : ''}" data-view="${v}">${v !== 'bridges' && v !== 'deeds' ? icon(`tree_${v}`) : ''}${esc(label)}${native ? ` <span class="gold" title="${esc(L('nativeTip'))}">◆</span>` : ''}<span style="float:right">${pts}</span></div>`;
          }).join('')}</div>
          ${this.respecBox(self, docked, now)}
        </div>
        <div>${this.view === 'deeds' ? deeds(self.deeds) : this.tree(self, ctx, docked)}</div>
      </div></div>`;
    root.querySelectorAll<HTMLElement>('[data-view]').forEach((el) => (el.onclick = () => {
      this.view = el.dataset.view as View;
      this.render(root, state);
    }));
    root.querySelectorAll<HTMLElement>('.talent[data-id]').forEach((el) => (el.onclick = (e) => {
      if ((e.target as HTMLElement).dataset.forget) return;
      this.send({ t: 'learn_talent', id: el.dataset.id! });
    }));
    root.querySelectorAll<HTMLElement>('[data-forget]').forEach((el) => (el.onclick = () => {
      if (confirm(self.respec.free ? L('confirmForget') : L('confirmForgetCost', { cost: fmt(self.respec.forgetCost) }))) this.send({ t: 'respec', mode: 'forget', id: el.dataset.forget! });
    }));
    root.querySelectorAll<HTMLElement>('[data-loadout]').forEach((el) => (el.onclick = () => this.send({ t: 'loadout', slot: Number(el.dataset.loadout) })));
    root.querySelectorAll<HTMLElement>('[data-respec]').forEach((el) => (el.onclick = () => {
      const mode = el.dataset.respec as 'full' | 'token';
      if (confirm(mode === 'token' ? L('confirmToken') : self.respec.free ? L('confirmResetFree') : L('confirmResetCost', { cost: fmt(self.respec.cleanSlateCost) }))) this.send({ t: 'respec', mode });
    }));
  }

  private respecBox(self: NonNullable<ClientState['self']>, docked: boolean, now: number): string {
    const r = self.respec;
    const cd = r.cleanSlateAt > now ? L('nextIn', { h: Math.ceil((r.cleanSlateAt - now) / 3600) }) : '';
    return `<div class="card" style="margin-top:10px"><h4>${esc(L('respec'))}</h4>
      <p class="muted" style="font-size:12px">${esc(docked ? L('clickForget') : L('respecPort'))} ${esc(r.free ? L('allFree') : L('forgetCost', { cost: fmt(r.forgetCost) }))}</p>
      <button class="btn btn-small" data-respec="full" ${!docked || (!r.free && r.cleanSlateAt > now) ? 'disabled' : ''}>${esc(L('cleanSlate'))}${esc(r.free ? L('free') : L('cost', { cost: fmt(r.cleanSlateCost) }))}${esc(cd)}</button>
      <button class="btn btn-small" data-respec="token" ${!docked || self.tokens <= 0 ? 'disabled' : ''}>${esc(L('token', { n: self.tokens }))}</button></div>`;
  }

  private tree(self: NonNullable<ClientState['self']>, ctx: { level: number; abyssOpen: boolean }, docked: boolean): string {
    const view = this.view as TreeId | 'bridges';
    const talents = TALENTS.filter((x) => (view === 'bridges' ? x.tree === 'bridge' : x.tree === view));
    if (view !== 'bridges' && !TREES[view].playable) {
      return `<h3>${esc(TREES[view].name)}</h3><p class="motto">${esc(TREES[view].motto)}</p><p class="muted">${esc(L('later'))}</p>`;
    }
    if (!talents.length) return `<p class="muted">${esc(L('noBridges'))}</p>`;
    const head = view === 'bridges'
      ? `<h3>${esc(L('bridges'))}</h3><p class="motto">${esc(L('bridgesMotto'))}</p>`
      : `<h3>${esc(TREES[view].name)} <span class="muted" style="font-size:14px">${esc(points(pointsInTree(self.talents, view)))}</span></h3><p class="motto">${esc(TREES[view].motto)}${TREES[view].complete ? esc(L('tiersOpen', { gate: KEYSTONE_GATE })) : ''}</p>`;
    const tiers = [...new Set(talents.map((x) => (x.keystone ? 99 : x.tier)))].sort((a, b) => a - b);
    return head + tiers.map((tier) => `<div class="tier-label">${esc(tier === 99 ? L('keystones') : view === 'bridges' ? L('bridges') : L('tier', { tier, points: points(tierRequirement(talents.find((x) => x.tier === tier && !x.keystone)!)) }))}</div>
      <div class="tier-row">${talents.filter((x) => (x.keystone ? 99 : x.tier) === tier).map((x) => card(x, self, ctx, docked)).join('')}</div>`).join('');
  }
}

function card(x: TalentDef, self: NonNullable<ClientState['self']>, ctx: { level: number; abyssOpen: boolean }, docked: boolean): string {
  const rank = self.talents[x.id] ?? 0;
  const why = canLearn(self.talents, x.id, self.talentPoints, ctx);
  const locked = rank === 0 && why !== null && why !== 'No talent points available';
  const forgettable = docked && rank > 0 && !x.keystone && canUnlearn(self.talents, x.id, ctx) === null;
  return `<div class="talent ${rank ? 'has' : ''} ${rank >= x.maxRank ? 'max' : ''} ${x.keystone ? 'keystone' : ''} ${locked ? 'locked' : ''}" data-id="${x.id}" title="${esc(why ? serverText(why) : L('learn'))}">
    <span class="rank">${rank}/${x.maxRank}</span>${forgettable ? `<span class="forget" data-forget="${x.id}" title="${esc(L('forget'))}">×</span>` : ''}<b>${esc(x.name)}</b>${x.active ? ` <span class="gold">${esc(L('active'))}</span>` : ''}
    <small>${esc(x.description)}</small>${locked && why ? `<small class="muted">${esc(serverText(why))}</small>` : ''}</div>`;
}

/** The Wind Rose: ten rays in the canonical clockwise order, length by points invested (26 = full). */
function rose(ranks: Record<string, number>): string {
  const c = 100, r0 = 14, r1 = 88;
  const rays = ROSE_ORDER.map((t, i) => {
    const a = (i / ROSE_ORDER.length) * Math.PI * 2 - Math.PI / 2;
    const f = Math.min(1, pointsInTree(ranks, t) / 26);
    const x1 = c + Math.cos(a) * r1, y1 = c + Math.sin(a) * r1;
    const xf = c + Math.cos(a) * (r0 + (r1 - r0) * f), yf = c + Math.sin(a) * (r0 + (r1 - r0) * f);
    const lx = c + Math.cos(a) * (r1 + 2), ly = c + Math.sin(a) * (r1 + 2);
    return `<line x1="${c}" y1="${c}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="rgba(240,230,200,0.18)"/>
      ${f > 0 ? `<line x1="${c}" y1="${c}" x2="${xf.toFixed(1)}" y2="${yf.toFixed(1)}" stroke="#d9b45a" stroke-width="3" stroke-linecap="round"/>` : ''}
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="8" fill="rgba(240,230,200,0.6)" text-anchor="middle">${esc(TREES[t].name.slice(0, 4))}</text>`;
  }).join('');
  return `<svg viewBox="-10 -10 220 220" width="200" height="200" style="display:block;margin:0 auto 8px"><circle cx="${c}" cy="${c}" r="${r1}" fill="none" stroke="rgba(240,230,200,0.12)"/>${rays}<circle cx="${c}" cy="${c}" r="${r0}" fill="#0c141c" stroke="#d9b45a"/></svg>`;
}

function deeds(have: string[]): string {
  return `<h3>${esc(L('deeds'))}</h3><p class="motto">${esc(L('deedsMotto'))}</p>
    <table class="grid">${DEEDS.map((d) => `<tr><td>${have.includes(d.id) ? '<span class="good">✔</span>' : ''}</td><td><b>${esc(d.name)}</b></td><td>${esc(d.condition)}${d.awaits ? ` <span class="muted">${esc(L('opensWith', { what: d.awaits }))}</span>` : ''}</td></tr>`).join('')}</table>`;
}
