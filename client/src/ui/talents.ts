// Talent screen: the five playable MVP trees laid out by tier, keystones at the bottom.
// Full 10-tree design: docs/03_TALENT_TREES.md.

import { TALENTS, TREES, canLearn, pointsInTree, tierRequirement } from '../../../shared/src/data/talents.ts';
import type { TreeId } from '../../../shared/src/data/talents.ts';
import type { ClientState } from '../state.ts';
import { esc } from './dom.ts';

export function renderTalents(root: HTMLElement, state: ClientState, learn: (id: string) => void): void {
  const self = state.self;
  if (!self) return;
  const trees = (Object.keys(TREES) as TreeId[]).filter((t) => TREES[t].playableInMvp);
  const future = (Object.keys(TREES) as TreeId[]).filter((t) => !TREES[t].playableInMvp);
  root.innerHTML = `
    <div class="modal-head"><div><h2>Talents</h2><div class="sub">Level ${self.level} · ${self.talentPoints} point${self.talentPoints === 1 ? '' : 's'} to spend · at most two keystones</div></div>
    <div class="muted">Click to learn. Respec at any Harbour Master.</div></div>
    <div class="modal-body"><div class="trees">${trees.map((t) => {
      const inTree = pointsInTree(self.talents, t);
      const talents = TALENTS.filter((x) => x.tree === t);
      const tiers = [...new Set(talents.map((x) => (x.keystone ? 99 : x.tier)))].sort((a, b) => a - b);
      return `<div class="tree"><h3>${esc(TREES[t].name)} <span class="muted" style="font-size:13px">${inTree}</span></h3><div class="motto">${esc(TREES[t].motto)}</div>
        ${tiers.map((tier) => `<div class="tier-label">${tier === 99 ? 'Keystone' : `Tier ${tier}`}</div>${talents.filter((x) => (x.keystone ? 99 : x.tier) === tier).map((x) => {
          const rank = self.talents[x.id] ?? 0;
          const why = canLearn(self.talents, x.id, self.talentPoints);
          const locked = rank === 0 && why !== null && why !== 'No talent points available';
          return `<div class="talent ${rank ? 'has' : ''} ${rank >= x.maxRank ? 'max' : ''} ${x.keystone ? 'keystone' : ''} ${locked ? 'locked' : ''}" data-id="${x.id}" title="${esc(why ?? 'Learn')}">
            <span class="rank">${rank}/${x.maxRank}</span><b>${esc(x.name)}</b><small>${esc(x.description)}</small>${locked ? `<small class="muted">Needs ${tierRequirement(x)} in tree</small>` : ''}</div>`;
        }).join('')}`).join('')}</div>`;
    }).join('')}</div>
    <p class="muted" style="margin-top:14px">Coming in later phases: ${future.map((t) => `<b>${esc(TREES[t].name)}</b> <i>(${esc(TREES[t].motto)})</i>`).join(' · ')}</p></div>`;
  root.querySelectorAll<HTMLElement>('.talent').forEach((el) => (el.onclick = () => learn(el.dataset.id!)));
}
