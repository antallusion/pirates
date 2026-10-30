// The yard's tree of hulls (owner, 2026-10-04: «прокачку кораблей можно сделать как в игре world of tanks»; docs/20):
// one list at a time, its tiers as rows from the small hulls at the top to the great at the bottom; each hull as a
// card — the one she sails, those in her berths, those researched (sold at a yard), the next ones with what they
// cost and what is earned toward them, the doubloon hulls in gold. Research is a click: the server spends the
// experience (server/src/game/research.ts).

import { CROSS_LINES, TREE, isResearched, needsResearch, researchQuote } from '../../../shared/src/data/research.ts';
import type { ResearchView } from '../../../shared/src/data/research.ts';
import { hullCard, hullCardHtml } from '../../../shared/src/data/hullcard.ts';
import { levelRange, shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { FLEET_LISTS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { FleetList, ShipClassId } from '../../../shared/src/data/ships.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { placeName } from './maps.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/research.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon } from './dom.ts';

const L = dict(EN, RU);
const LIST_ICON: Record<FleetList, string> = { combat: 'fire', trade: 'tab_market', fast: 'stat_sails', hauler: 'stat_hull' };

const span = (id: ShipClassId): string => {
  const [lo, hi] = levelRange(id);
  return lo === hi ? `⚓${lo}` : `⚓${lo}–${hi}`;
};

export class ResearchWindow {
  list: FleetList | null = null;
  /** The hull whose whole card is open over the tree (Нефигугум, forum post 28), kept across the window's re-renders. */
  detail: ShipClassId | null = null;
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  render(root: HTMLElement, state: ClientState): void {
    const self = state.self;
    if (!self) return;
    const r: ResearchView = self.research ?? { xp: {}, free: 0, done: [] };
    const owned = [self.loadout.classId, ...self.berths.map((b) => b.classId)];
    // The list of the hull she sails first.
    const list = this.list ?? SHIP_CLASSES[self.loadout.classId].list ?? 'combat';
    const tabs = FLEET_LISTS.map((l) => `<button class="tab${l === list ? ' active' : ''}" data-rtab="${l}">${icon(LIST_ICON[l], '', 'ico-sm')}${esc(L(`tab.${l}`))}</button>`).join('');
    const tiers = [...new Set(TREE[list].map((c) => SHIP_CLASSES[c].tier))].sort((a, b) => a - b);
    const rows = tiers.map((t) => {
      const cards = TREE[list].filter((c) => SHIP_CLASSES[c].tier === t).map((c) => this.card(c, r, owned, self.loadout.classId)).join('');
      return `<div class="rs-row"><div class="rs-tier">${esc(L('tier', { n: t }))}</div><div class="rs-cards">${cards}</div></div>`;
    }).join('');
    root.innerHTML = `<div class="modal-head"><div><h2>${icon('tab_board', '', 'ico-crest')}<span>${esc(L('title'))}</span></h2><div class="sub">${esc(L('sub'))}</div></div>
      <div class="rc-chips"><span class="ph-chip gold" title="${esc(L('freeTip'))}">${icon('xp', '', 'ico-sm')}${esc(L('free', { n: fmt(Math.floor(r.free)) }))}</span></div></div>
      <div class="tabs rs-tabs">${tabs}</div>
      <div class="modal-body rs-body">${rows}</div>${this.detail ? this.detailHtml(this.detail, r, state) : ''}`;
    root.querySelectorAll<HTMLElement>('[data-rtab]').forEach((b) => (b.onclick = () => {
      this.list = b.dataset.rtab as FleetList;
      this.render(root, state);
    }));
    // A tap on a hull opens her whole card; the research button keeps its own click.
    root.querySelectorAll<HTMLElement>('[data-rs-hull]').forEach((el) => (el.onclick = (e) => {
      if ((e.target as HTMLElement).closest('[data-research]')) return;
      this.detail = el.dataset.rsHull as ShipClassId;
      this.render(root, state);
    }));
    root.querySelectorAll<HTMLElement>('[data-hc-close]').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      this.detail = null;
      this.render(root, state);
    }));
    const shade = root.querySelector<HTMLElement>('.rs-detail');
    if (shade) shade.onclick = (e) => {
      if (e.target === shade) {
        this.detail = null;
        this.render(root, state);
      }
    };
    root.querySelectorAll<HTMLButtonElement>('[data-research]').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      b.disabled = true;
      this.send({ t: 'research', classId: b.dataset.research as ShipClassId });
    }));
  }

  /** Her whole card (shared/src/data/hullcard.ts) over the tree, with the research button when she is ready. */
  private detailHtml(id: ShipClassId, r: ResearchView, state: ClientState): string {
    const self = state.self!;
    const card = hullCard(id, lang(), {
      sailing: self.loadout.classId, sailLevel: shipLevelOf(self.loadout), captainLevel: self.level, research: r,
      berths: self.berths.map((b) => ({ classId: b.classId, port: b.port.startsWith('isle:') ? undefined : placeName(state.ports.find((p) => p.id === b.port)?.name ?? b.port) })),
    });
    const act = card.tree.state === 'ready' ? `<button class="btn btn-small btn-primary" data-research="${id}">${esc(L('research', { n: fmt(card.tree.cost) }))}</button>` : '';
    return `<div class="rs-detail">${hullCardHtml(card, lang(), { art: assetUrl(SHIP_CLASSES[id].sprite), actions: act })}</div>`;
  }

  private card(id: ShipClassId, r: ResearchView, owned: ShipClassId[], sail: ShipClassId): string {
    const c = SHIP_CLASSES[id];
    const art = assetUrl(c.sprite);
    const xp = Math.floor(r.xp[id] ?? 0);
    let state: string, line: string, act = '';
    if (id === sail) {
      state = 'sail';
      line = L('st.sail');
    } else if (owned.includes(id)) {
      state = 'owned';
      line = L('st.berth');
    } else if (c.premium) {
      state = 'premium';
      line = c.premium.pass ? L('st.pass') : L('st.premium'); // the season card's own hull (owner, 2026-10-30)
    } else if (isResearched(r, id, owned)) {
      state = 'known';
      line = needsResearch(id) ? L('st.known') : L('st.start');
    } else {
      const q = researchQuote(r, id, owned);
      const have = Math.min(q.cost, q.pool);
      state = q.ready ? 'ready' : q.known.length ? 'near' : 'locked';
      line = q.known.length ? L('cost', { have: fmt(have), cost: fmt(q.cost) }) : L('st.lockedBy', { names: q.parents.map((p) => SHIP_CLASSES[p].name).join(', ') });
      const pct = q.cost ? Math.round((have / q.cost) * 100) : 0;
      act = `${q.known.length ? `<div class="rs-bar"><i style="width:${pct}%"></i></div>` : ''}${q.ready ? `<button class="btn btn-small btn-primary" data-research="${id}">${esc(L('research', { n: fmt(q.cost) }))}</button>` : ''}`;
    }
    const cross = CROSS_LINES[id]?.map((p) => `<div class="rs-cross muted">${esc(L('cross', { name: SHIP_CLASSES[p].name }))}</div>`).join('') ?? '';
    return `<div class="rs-card rs-${state}" data-rs-hull="${id}" role="button" tabindex="0">
      <div class="rs-art">${art ? `<img src="${art}" alt="" draggable="false" />` : ''}</div>
      <div class="rs-text"><b>${esc(c.name)}</b><span class="muted">${esc(span(id))}</span>
        <span class="rs-line">${esc(line)}</span>${xp > 0 ? `<span class="rs-xp muted">${esc(L('xp', { n: fmt(xp) }))}</span>` : ''}${cross}${act}</div>
    </div>`;
  }
}
