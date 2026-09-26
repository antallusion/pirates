// Talent screen — the "Wind Rose" (docs/03_TALENT_TREES.md §2.10): ten rays, one per tree, grow with the points
// invested; the selected tree shows its tiers and keystones, then loadouts, respec and Legend Deeds.

import { DEEDS, MAX_COUNTED_DEEDS } from '../../../shared/src/data/deeds.ts';
import { ROSE_ORDER, TALENTS, TREES, KEYSTONE_GATE, canLearn, canUnlearn, pointsInTree, tierRequirement } from '../../../shared/src/data/talents.ts';
import type { TalentDef, TreeId } from '../../../shared/src/data/talents.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt } from './dom.ts';

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
      <div class="modal-head"><div><h2>Talents</h2><div class="sub">Level ${self.level} · ${self.talentPoints} point${self.talentPoints === 1 ? '' : 's'} to spend · deeds ${counted}/${MAX_COUNTED_DEEDS} · at most two keystones and three bridges</div></div>
      <div style="text-align:right">${lo.slots > 1 ? `<div>Loadout ${Array.from({ length: lo.slots }, (_, i) => `<button class="btn btn-small ${i === lo.active ? 'btn-primary' : ''}" data-loadout="${i}" ${!docked || i === lo.active || lo.switchAt > now ? 'disabled' : ''}>${i + 1}${lo.filled[i] ? '' : ' (empty)'}</button>`).join(' ')}</div>
        <div class="muted" style="font-size:11px">${docked ? (lo.switchAt > now ? `switch again in ${Math.ceil((lo.switchAt - now) / 60)} min` : 'switch in port, 10 min cooldown') : 'switch loadouts in port'}</div>` : '<div class="muted">Loadouts open at level 20</div>'}</div></div>
      <div class="modal-body"><div style="display:grid;grid-template-columns:220px 1fr;gap:16px">
        <div>${rose(self.talents)}
          <div class="tree-nav">${nav.map((v) => {
            const label = v === 'bridges' ? 'Bridges' : v === 'deeds' ? 'Legend Deeds' : TREES[v].name;
            const pts = v === 'bridges' ? TALENTS.filter((x) => x.tree === 'bridge' && (self.talents[x.id] ?? 0) > 0).length : v === 'deeds' ? self.deeds.length : pointsInTree(self.talents, v);
            const off = v !== 'bridges' && v !== 'deeds' && !TREES[v].playable;
            const native = v !== 'bridges' && v !== 'deeds' && TREES[v].native.includes(self.captain);
            return `<div class="tree-tab ${this.view === v ? 'active' : ''} ${off ? 'muted' : ''}" data-view="${v}">${esc(label)}${native ? ' <span class="gold" title="Native tree of your Path: Forget a Lesson is free">◆</span>' : ''}<span style="float:right">${pts}</span></div>`;
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
      if (confirm(`Forget every rank of this talent${self.respec.free ? '' : ` (${fmt(self.respec.forgetCost)} silver, free in your native trees)`}?`)) this.send({ t: 'respec', mode: 'forget', id: el.dataset.forget! });
    }));
    root.querySelectorAll<HTMLElement>('[data-loadout]').forEach((el) => (el.onclick = () => this.send({ t: 'loadout', slot: Number(el.dataset.loadout) })));
    root.querySelectorAll<HTMLElement>('[data-respec]').forEach((el) => (el.onclick = () => {
      const mode = el.dataset.respec as 'full' | 'token';
      if (confirm(mode === 'token' ? 'Spend a Clean Logbook token to reset every talent?' : `Reset every talent${self.respec.free ? ' (free below level 20)' : ` for ${fmt(self.respec.cleanSlateCost)} silver`}?`)) this.send({ t: 'respec', mode });
    }));
  }

  private respecBox(self: NonNullable<ClientState['self']>, docked: boolean, now: number): string {
    const r = self.respec;
    const cd = r.cleanSlateAt > now ? ` · next in ${Math.ceil((r.cleanSlateAt - now) / 3600)} h` : '';
    return `<div class="card" style="margin-top:10px"><h4>Respec</h4>
      <p class="muted" style="font-size:12px">${docked ? 'Click × on a learned talent to forget it.' : 'Respec only in port.'} ${r.free ? 'Everything is free below level 20.' : `Forget a lesson: ${fmt(r.forgetCost)} (free in native ◆ trees).`}</p>
      <button class="btn btn-small" data-respec="full" ${!docked || (!r.free && r.cleanSlateAt > now) ? 'disabled' : ''}>Clean Slate${r.free ? ' — free' : ` — ${fmt(r.cleanSlateCost)}`}${cd}</button>
      <button class="btn btn-small" data-respec="token" ${!docked || self.tokens <= 0 ? 'disabled' : ''}>Token (${self.tokens})</button></div>`;
  }

  private tree(self: NonNullable<ClientState['self']>, ctx: { level: number; abyssOpen: boolean }, docked: boolean): string {
    const view = this.view as TreeId | 'bridges';
    const talents = TALENTS.filter((x) => (view === 'bridges' ? x.tree === 'bridge' : x.tree === view));
    if (view !== 'bridges' && !TREES[view].playable) {
      return `<h3>${esc(TREES[view].name)}</h3><p class="motto">${esc(TREES[view].motto)}</p><p class="muted">This tree opens in a later build of the roadmap.</p>`;
    }
    if (!talents.length) return '<p class="muted">Bridges between trees arrive with the remaining trees.</p>';
    const head = view === 'bridges'
      ? '<h3>Bridges</h3><p class="motto">Hybrids are rewarded for combining roles, not for depth. Each needs points in two trees; they do not count toward any tree.</p>'
      : `<h3>${esc(TREES[view].name)} <span class="muted" style="font-size:14px">${pointsInTree(self.talents, view)} points</span></h3><p class="motto">${esc(TREES[view].motto)}${TREES[view].complete ? ` Tiers open at 0 / 5 / 10 / 15 / 20 points; keystones at ${KEYSTONE_GATE} and captain level 25.` : ''}</p>`;
    const tiers = [...new Set(talents.map((x) => (x.keystone ? 99 : x.tier)))].sort((a, b) => a - b);
    return head + tiers.map((tier) => `<div class="tier-label">${tier === 99 ? 'Keystones — pick one' : view === 'bridges' ? 'Bridges' : `Tier ${tier} · ${tierRequirement(talents.find((x) => x.tier === tier && !x.keystone)!)} points`}</div>
      <div class="tier-row">${talents.filter((x) => (x.keystone ? 99 : x.tier) === tier).map((x) => card(x, self, ctx, docked)).join('')}</div>`).join('');
  }
}

function card(x: TalentDef, self: NonNullable<ClientState['self']>, ctx: { level: number; abyssOpen: boolean }, docked: boolean): string {
  const rank = self.talents[x.id] ?? 0;
  const why = canLearn(self.talents, x.id, self.talentPoints, ctx);
  const locked = rank === 0 && why !== null && why !== 'No talent points available';
  const forgettable = docked && rank > 0 && !x.keystone && canUnlearn(self.talents, x.id, ctx) === null;
  return `<div class="talent ${rank ? 'has' : ''} ${rank >= x.maxRank ? 'max' : ''} ${x.keystone ? 'keystone' : ''} ${locked ? 'locked' : ''}" data-id="${x.id}" title="${esc(why ?? 'Learn')}">
    <span class="rank">${rank}/${x.maxRank}</span>${forgettable ? `<span class="forget" data-forget="${x.id}" title="Forget">×</span>` : ''}<b>${esc(x.name)}</b>${x.active ? ' <span class="gold">active</span>' : ''}
    <small>${esc(x.description)}</small>${locked && why ? `<small class="muted">${esc(why)}</small>` : ''}</div>`;
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
  return `<h3>Legend Deeds</h3><p class="motto">Each deed is a point of talent; sixteen of the twenty-four count. Most never require PvP or the Abyss.</p>
    <table class="grid">${DEEDS.map((d) => `<tr><td>${have.includes(d.id) ? '<span class="good">✔</span>' : ''}</td><td><b>${esc(d.name)}</b></td><td>${esc(d.condition)}${d.awaits ? ` <span class="muted">(opens with ${esc(d.awaits)})</span>` : ''}</td></tr>`).join('')}</table>`;
}
