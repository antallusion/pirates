// Port screen: Market, Chandlery, Shipyard, Tavern, Contracts, Harbour Master.

import { namedPirates } from '../../../shared/src/data/pirates.ts';
import type { WantedPoster } from '../../../shared/src/protocol.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import { levelRange } from '../../../shared/src/data/shiplevel.ts';
import { ask, tell } from './confirm.ts';
import { mapCard, placeName } from './maps.ts';
import { personName } from '../lang/names.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { AMMO, AMMO_IDS, GUNS, MODULES, MOUNTS, SHIP_CLASSES, defaultGunFor } from '../../../shared/src/data/ships.ts';
import type { MountId, ShipClassId } from '../../../shared/src/data/ships.ts';
import type { ClientMsg, PortView, RefitView } from '../../../shared/src/protocol.ts';
import { ownLevelChip } from './levels.ts';
import { cargoVolume, computeShipStats } from '../../../shared/src/sim/shipstats.ts';
import { BUILD_TIME, FIGUREHEADS, RARES, VARIANTS, WOODS, buildMaterials } from '../../../shared/src/data/shipbuild.ts';
import type { FigureheadId, RareSlot, ShipBuild, WoodId } from '../../../shared/src/data/shipbuild.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { ClientState } from '../state.ts';
import { assetUrl } from '../assets.ts';
import { dec1, esc, fmt, icon, money, officerIcon, quote, xpBadge } from './dom.ts';
import { keyLabel, settings } from '../settings.ts';
import { OFFICER_DEFS, PROFESSIONS, PROFESSION_DEFS } from '../../../shared/src/data/crew.ts';
import type { Profession } from '../../../shared/src/data/crew.ts';
import { traitChips } from './crew.ts';
import { dict, lang, plural } from '../i18n.ts';
import { commonCard, dailyCard } from './daily.ts';
import { giverDialog } from './giver.ts';
import { EN, RU } from '../lang/ui/port.ts';
import { serverText } from '../lang/server.ts';

/** A generated job's picture by its kind (docs/11 P4). */
const JOB_ICON: Record<string, string> = {
  delivery: 'good_provisions', hunt: 'fire', rescue: 'map_cove', scouting: 'menu_map', smuggling: 'good_dreamleaf', treasure: 'map_treasure',
  diplomacy: 'map_contract', revenge: 'danger', investigation: 'ab_spotters_eye', elite: 'danger',
};
const L = dict(EN, RU);

function licenceLeft(n: number): string {
  return L('licence.left', { n, minutes: plural(n, L('licence.min1'), L('licence.min2'), L('licence.min5')) });
}

type Tab = 'market' | 'shipyard' | 'tavern' | 'contracts' | 'harbour' | 'holdings' | 'exchange';

/** The harbour's tabs by their icons. */
const TAB_ICON: Record<Tab, string> = {
  market: 'tab_market', shipyard: 'menu_ship', tavern: 'tab_tavern', contracts: 'tab_contracts', harbour: 'anchor', holdings: 'tab_holdings', exchange: 'tab_exchange',
};

export class PortScreen {
  tab: Tab = 'market';
  qty = 1;
  /** The build order being drawn up at the yard. */
  build: { classId: ShipClassId; name: string; frame: WoodId; plank: WoodId; rares: Partial<Record<RareSlot, GoodId>>; figurehead?: FigureheadId; planId?: string; master: boolean } = { classId: 'sloop', name: '', frame: 'pine', plank: 'pine', rares: {}, master: false };
  private send: (m: ClientMsg) => void;
  private onClose: () => void;
  constructor(send: (m: ClientMsg) => void, onClose: () => void) {
    this.send = send;
    this.onClose = onClose;
  }

  private lastHtml = '';

  render(root: HTMLElement, state: ClientState): void {
    const view = state.portView;
    const self = state.self;
    if (!view || !self) return;
    const port = state.ports.find((p) => p.id === view.portId)!;
    const faction = FACTIONS[port.faction];
    const tabs: [Tab, string][] = [['market', L('tab.market')], ['shipyard', L('tab.shipyard')], ['tavern', L('tab.tavern')], ['contracts', L('tab.contracts')], ['harbour', L('tab.harbour')], ['holdings', L('tab.holdings')], ['exchange', L('tab.exchange')]];
    const vol = cargoVolume(self.cargo, state.ownStats?.contrabandVolumeMul ?? 1, state.ownStats?.materialVolumeMul ?? 1, state.ownStats?.provisionVolumeMul ?? 1, state.ownStats?.cursedVolumeMul ?? 1);
    // The harbour's own painting behind the header, and the faction's crest before its name.
    const bg = assetUrl(`bg.port_${port.faction}`);
    root.style.setProperty('--bg-port', bg ? `url('${bg}')` : 'none');
    const html = `
      <div class="modal-head port-head">
        <div class="ph-title"><div class="ph-name">${icon(`faction_${port.faction}`, '', 'ph-crest')}<h2><span>${esc(placeName(port.name))}</span></h2></div><div class="sub">${esc(faction.name)} · ${esc(REGIONS[port.region].name)} — ${esc(serverText(port.description))}</div>${state.events.filter((e) => e.port === port.id).map((e) => `<div class="sub" style="color:var(--bad)">⚑ ${esc(serverText(e.title))}${e.kind === 'blockade' || e.kind === 'armada' ? esc(L('head.blockade')) : e.kind === 'epidemic' ? esc(L('head.epidemic')) : ''}</div>`).join('')}</div>
        <div class="ph-stats" title="${esc(L('head.hold', { vol: vol.toFixed(0), max: (state.ownStats?.holdVolume ?? 0).toFixed(0), crew: self.crew }))}">
          <span class="ph-chip gold">${money(self.gold)}</span>
          <span class="ph-chip">${icon('tab_market', '', 'ico-sm')}${vol.toFixed(0)}/${(state.ownStats?.holdVolume ?? 0).toFixed(0)}</span>
          <span class="ph-chip">${icon('stat_crew', '', 'ico-sm')}${self.crew}</span>
          <button class="btn btn-primary ph-sail" data-act="undock">${icon('stat_sails', '', 'ico-sm')}${esc(L('btn.setSail'))}</button>
        </div>
      </div>
      <div class="tabs icon-tabs" style="--n:${tabs.length}">${tabs.map(([id, n]) => `<div class="tab ${this.tab === id ? 'active' : ''}" data-tab="${id}" title="${esc(n)}">${icon(TAB_ICON[id])}<span>${esc(n)}</span></div>`).join('')}</div>
      <div class="tab-caption">${esc(tabs.find(([id]) => id === this.tab)?.[1] ?? '')}</div>
      <div class="modal-body">${this.body(view, state)}</div>`;
    // The harbour pushes its view every second: an unchanged page is not redrawn (no flicker, no button pulled
    // from under a finger, no lost hover or selection).
    if (html === this.lastHtml && root.querySelector('.port-head')) return;
    this.lastHtml = html;
    root.innerHTML = html;
    root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => (el.onclick = () => {
      this.tab = el.dataset.tab as Tab;
      this.render(root, state);
    }));
    root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => (el.onclick = () => this.act(el.dataset, root, state)));
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-build]').forEach((el) => (el.onchange = () => {
      const k = el.dataset.build!;
      const v = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
      if (k.startsWith('rare:')) {
        const slot = k.slice(5) as RareSlot;
        if (v) this.build.rares[slot] = v as GoodId;
        else delete this.build.rares[slot];
      } else (this.build as Record<string, unknown>)[k] = v === '' ? undefined : v;
      this.render(root, state);
    }));
    root.querySelectorAll<HTMLSelectElement>('select[data-qty]').forEach((el) => (el.onchange = () => {
      this.qty = Number(el.value);
      this.render(root, state);
    }));
  }

  private act(d: DOMStringMap, root: HTMLElement, state: ClientState): void {
    switch (d.act) {
      case 'undock':
        this.send({ t: 'undock' });
        this.onClose();
        return;
      case 'buy':
        return this.send({ t: 'trade', good: d.good as never, qty: this.qty });
      case 'sell':
        return this.send({ t: 'trade', good: d.good as never, qty: -Math.min(this.qty, Math.floor(state.self?.cargo[d.good as never] ?? 0)) || -1 });
      case 'sellall':
        return this.send({ t: 'trade', good: d.good as never, qty: -Math.floor(state.self?.cargo[d.good as never] ?? 0) });
      case 'ammo':
        return this.send({ t: 'buy_ammo', ammo: d.ammo as never, qty: Number(d.n) });
      case 'crew':
        return this.send({ t: 'hire_crew', qty: Number(d.n), prof: (d.prof as Profession | undefined) ?? 'sailor' });
      case 'press':
        return this.send({ t: 'press_gang', qty: 10 });
      case 'quest_accept': {
        // The giver speaks first: their words, the steps and the pay; the captain takes it or leaves it.
        const q = state.portView?.questOffers.find((x) => x.id === d.id);
        if (!q) return this.send({ t: 'quest', action: 'accept', id: d.id! });
        void giverDialog(q).then((pay) => pay && this.send({ t: 'quest', action: 'accept', id: d.id!, ...(pay !== 'silver' ? { pay } : {}) }));
        return;
      }
      case 'quest_abandon':
        void ask(L('confirm.questAbandon')).then((ok) => ok && this.send({ t: 'quest', action: 'abandon', id: d.id! }));
        return;
      case 'path':
        void ask(L('confirm.path')).then((ok) => ok && this.send({ t: 'path', to: d.to as never }));
        return;
      case 'oath':
        void ask(L('confirm.oath')).then((ok) => ok && this.send({ t: 'oath', oath: d.oath as 'code' }));
        return;
      case 'build_order':
        return this.send({ t: 'build', req: { ...this.build, name: this.build.name || SHIP_CLASSES[this.build.classId].name } });
      case 'launch':
        return this.send({ t: 'build_launch', id: d.id! });
      case 'berth_swap':
        return this.send({ t: 'berth', action: 'swap', index: Number(d.i) });
      case 'berth_sell':
        void ask(L('confirm.berthSell')).then((ok) => ok && this.send({ t: 'berth', action: 'sell', index: Number(d.i) }));
        return;
      case 'plan_buy':
        return this.send({ t: 'plan_buy', classId: this.build.classId });
      case 'figurehead_buy':
        return this.send({ t: 'figurehead_buy' });
      case 'claim': {
        const email = (root.querySelector('#claim-email') as HTMLInputElement).value.trim();
        const password = (root.querySelector('#claim-password') as HTMLInputElement).value;
        const token = localStorage.getItem('gravetide.token') ?? '';
        fetch('/auth/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, email, password }) })
          .then((r) => r.json())
          .then((r: { error?: string }) => tell(r.error ? serverText(r.error) : L('alert.claimSaved')))
          .catch(() => tell(L('alert.claimFail')));
        return;
      }
      case 'escort_hire':
        return this.send({ t: 'escort', action: 'hire', classId: d.cls as ShipClassId });
      case 'escort_dismiss':
        void ask(L('confirm.escortDismiss')).then((ok) => ok && this.send({ t: 'escort', action: 'dismiss', id: d.id! }));
        return;
      case 'dregs':
        return this.send({ t: 'hire_crew', qty: 10, prof: 'sailor', dregs: true });
      case 'officer_hire':
        return this.send({ t: 'officer', action: 'hire', id: d.id! });
      case 'repair':
        return this.send({ t: 'shipyard', action: 'repair' });
      case 'refit':
        return this.send({ t: 'shipyard', action: 'refit' });
      case 'module':
        return this.send({ t: 'shipyard', action: 'module', module: d.module as never });
      case 'unfit':
        return this.send({ t: 'shipyard', action: 'unfit', module: d.module as never });
      case 'keel':
        return this.send({ t: 'shipyard', action: 'keel' });
      case 'gun':
        return this.send({ t: 'shipyard', action: 'guns', side: d.side as never, gun: d.gun as never });
      case 'mount':
        return this.send({ t: 'shipyard', action: 'mount', mount: d.mount as MountId });
      case 'ship':
        void ask(L('confirm.shipTrade', { ship: SHIP_CLASSES[d.cls as ShipClassId].name })).then((ok) => ok && this.send({ t: 'shipyard', action: 'buy_ship', classId: d.cls as ShipClassId }));
        return;
      case 'contract':
        return this.send({ t: 'contract', action: d.mode as never, id: d.id! });
      case 'pardon':
        return this.send({ t: 'pardon' });
      case 'chart_sell':
        return this.send({ t: 'chart', action: 'sell' });
      case 'chart_buy':
        return this.send({ t: 'chart', action: 'buy', region: d.region as RegionId });
      case 'treasure':
        return this.send({ t: 'treasure', action: d.mode as never, tier: Number(d.tier ?? 0) });
      case 'map': {
        const to = (root.querySelector<HTMLInputElement>(`input[data-for="${d.id}"]`)?.value ?? '').trim();
        const go = () => this.send({ t: 'map', action: d.mode as never, id: d.id, to: to || undefined });
        if (d.mode === 'burn') return void ask(L('confirm.mapBurn')).then((ok) => ok && go());
        return go();
      }
      case 'insure':
        return this.send({ t: 'insure', tier: d.tier as never });
      case 'forward':
        return this.send({ t: 'forward', id: d.id! });
      case 'option_buy': {
        const good = root.querySelector<HTMLSelectElement>('#opt-good')!.value;
        const qty = Number(root.querySelector<HTMLInputElement>('#opt-qty')!.value);
        return this.send({ t: 'option', good: good as never, qty });
      }
      case 'fence':
        return this.send({ t: 'fence_sell', good: d.good as never, qty: Math.floor(state.self?.cargo[d.good as never] ?? 0) });
      case 'option_ex':
        return this.send({ t: 'option_exercise', index: Number(d.i) });
      case 'order_fill':
        return this.send({ t: 'order', action: 'fill', id: d.id!, qty: Number(d.n) });
      case 'order_cancel':
        return this.send({ t: 'order', action: 'cancel', id: d.id! });
      case 'order_post': {
        const good = root.querySelector<HTMLSelectElement>('#ord-good')!.value;
        const qty = Number(root.querySelector<HTMLInputElement>('#ord-qty')!.value);
        const price = Number(root.querySelector<HTMLInputElement>('#ord-price')!.value);
        return this.send({ t: 'order', action: 'post', good: good as never, qty, price });
      }
      case 'bank': {
        const amount = Math.floor(Number(root.querySelector<HTMLInputElement>('#bank-amt')!.value));
        return this.send({ t: 'bank', action: d.mode as never, amount });
      }
      case 'licence':
        return this.send({ t: 'licence' });
      case 'informant':
        return this.send({ t: 'wanted', action: 'informant', id: d.id! });
      case 'captive':
        return this.send({ t: 'captive', index: Number(d.i), mode: d.mode as 'ransom' });
      case 'rights':
        return this.send({ t: 'rights', site: d.site! });
      case 'store':
        return this.send({ t: 'warehouse', good: d.good as never, qty: Number(d.n) });
      case 'cleanse':
        return this.send({ t: 'cleanse' });
      case 'respec':
        void ask(L('confirm.respec')).then((ok) => ok && this.send({ t: 'respec' }));
        return;
    }
    void root;
  }

  private body(view: PortView, state: ClientState): string {
    switch (this.tab) {
      case 'market':
        return this.market(view, state);
      case 'shipyard':
        return this.shipyard(view, state);
      case 'tavern':
        return this.tavern(view, state);
      case 'contracts':
        return this.contracts(view, state);
      case 'harbour':
        return this.harbour(view, state);
      case 'holdings':
        return this.holdings(view, state);
      case 'exchange':
        return this.exchange(view, state);
    }
  }

  private market(view: PortView, state: ClientState): string {
    const self = state.self!;
    const qtys = [1, 5, 10, 25, 50];
    const rows = view.market.map((r) => {
      const g = GOODS[r.good];
      const have = Math.floor(self.cargo[r.good] ?? 0);
      const stolen = Math.min(have, self.stolen[r.good] ?? 0);
      const trend = r.trend > 0.03 ? `<span class="up">▲</span>` : r.trend < -0.03 ? `<span class="down">▼</span>` : '';
      return `<tr>
        <td data-l="${esc(L('th.good'))}"><b class="${r.legal ? '' : 'contra'}">${icon(`good_${r.good}`)}${esc(g.name)}</b>${view.dealOfDay === r.good ? ` <span class="tag tag-gold">${esc(L('market.dealOfDay'))}</span>` : ''}${r.legal ? '' : ` <span class="tag tag-contra">${esc(L('market.contraband'))}</span>`}${g.spoilPerHour ? ` <span class="tag">${esc(L('market.perishable'))}</span>` : ''}${g.danger > 0.3 ? ` <span class="tag tag-bad">${esc(L('market.dangerous'))}</span>` : ''}</td>
        <td data-l="${esc(L('th.stock'))}">${r.stock}</td><td data-l="${esc(L('th.buy'))}">${money(r.buy)}</td><td data-l="${esc(L('th.sell'))}"><span class="price-sell">${money(r.sell)}${trend}</span></td><td class="muted" data-l="${esc(L('th.perUnit'))}">${esc(L('market.weightVolume', { w: num(g.weight), v: num(g.volume) }))}</td><td data-l="${esc(L('th.hold'))}">${have || '—'}${stolen ? ` <span class="up" title="${esc(L('market.stolenTitle'))}">${esc(L('market.stolen', { n: stolen }))}</span>` : ''}</td>
        <td><div class="mk-btns"><button class="btn btn-small" data-act="buy" data-good="${r.good}">${esc(L('btn.buy'))}</button>
            <button class="btn btn-small" data-act="sell" data-good="${r.good}" ${have ? '' : 'disabled'}>${esc(L('btn.sell'))}</button>
            <button class="btn btn-small" data-act="sellall" data-good="${r.good}" ${have ? '' : 'disabled'}>${esc(L('btn.all'))}</button></div></td></tr>`;
    }).join('');
    const intel = view.priceIntel?.length
      ? `<h3 class="title-sm" style="font-size:20px;margin-top:16px">${esc(L('market.intelTitle'))}</h3><table class="grid"><tr><th>${esc(L('th.good'))}</th><th>${esc(L('th.port'))}</th><th>${esc(L('th.sellsFor'))}</th><th>${esc(L('th.age'))}</th></tr>${view.priceIntel.slice(0, 12).map((i) => `<tr><td>${icon(`good_${i.good}`)}${esc(GOODS[i.good].name)}</td><td>${esc(placeName(i.name))}</td><td>${money(i.sell)}</td><td class="muted">${esc(L('unit.min', { n: Math.round(i.ageSec / 60) }))}</td></tr>`).join('')}</table>`
      : '';
    const ammo = AMMO_IDS.map((a) => `<div class="card shop-row">${icon(`ammo_${a}`, '', 'shop-ico')}
      <div class="shop-text"><b>${esc(AMMO[a].name)}</b><span class="muted">${esc(AMMO[a].description)}</span><span class="shop-have">${esc(L('market.inHold', { n: self.ammo[a], price: view.ammoPrices[a] }))}</span></div>
      <div class="shop-buy">${[20, 50].map((n) => `<button class="btn btn-small" data-act="ammo" data-ammo="${a}" data-n="${n}"><b>+${n}</b>${money(Math.ceil(view.ammoPrices[a] * n))}</button>`).join('')}</div></div>`).join('');
    const portDef = state.ports.find((p) => p.id === view.portId)!;
    return `<div class="row" style="margin-bottom:8px"><span class="muted">${esc(L('market.hint'))}
      ${view.duty ? L('market.duty', { pct: Math.round(view.duty * 100) }) : ''} ${portDef.blackMarket ? esc(L('market.blackMarket')) : ''}</span>
      <label class="lbl">${esc(L('market.qty'))} <select data-qty class="btn">${qtys.map((q) => `<option ${q === this.qty ? 'selected' : ''}>${q}</option>`).join('')}</select></label></div>
      <table class="grid market"><tr><th>${esc(L('th.good'))}</th><th>${esc(L('th.stock'))}</th><th>${esc(L('th.buy'))}</th><th>${esc(L('th.sell'))}</th><th>${esc(L('th.perUnit'))}</th><th>${esc(L('th.hold'))}</th><th></th></tr>${rows}</table>
      ${view.fence !== null ? `<div class="card" style="margin-top:10px"><h4>${esc(L('fence.title'))}</h4><p class="muted">${esc(L('fence.text', { pct: Math.round(view.fence * 100) }))}</p>
        ${(Object.keys(self.cargo) as (keyof typeof GOODS)[]).filter((g) => GOODS[g].contraband && (self.cargo[g] ?? 0) >= 1).map((g) => `<button class="btn btn-small" data-act="fence" data-good="${g}">${esc(L('fence.sell', { n: Math.floor(self.cargo[g] ?? 0), good: GOODS[g].name }))}</button>`).join(' ') || `<span class="muted">${esc(L('fence.nothing'))}</span>`}</div>` : ''}
      <h3 class="title-sm" style="font-size:20px;margin-top:16px">${esc(L('chandlery.title'))}</h3>
${ammo}${intel}`;
  }

  private shipyard(view: PortView, state: ClientState): string {
    const self = state.self!;
    const sy = view.shipyard;
    const cur = SHIP_CLASSES[self.loadout.classId];
    const modules = sy.modules.map((m) => {
      const def = MODULES[m.module];
      const maxed = m.level >= m.max;
      const mat = view.materialDiscount[m.module];
      const matNote = mat && !maxed ? `<p class="muted">${esc(L('yard.matNote', { n: mat.units, good: GOODS[mat.good].name.toLowerCase() }))}</p>` : '';
      return `<div class="card"><h4>${icon(`mod_${m.module}`, '', 'ico-md')}${esc(def.name)} <span class="muted">${m.level}/${m.max}</span>${m.excellent ? ` <span class="gold">${esc(L('yard.excellent'))}</span>` : ''}</h4><p>${esc(def.description)}</p>${matNote}
        <button class="btn btn-small" data-act="module" data-module="${m.module}" ${maxed ? 'disabled' : ''}>${esc(maxed ? L('yard.fullyFitted') : L('yard.fitLevel', { n: m.level + 1, cost: fmt(m.cost) }))}</button>
        ${m.level > 0 ? `<button class="btn btn-small" data-act="unfit" data-module="${m.module}" title="${esc(self.talents.shp_modular_refit ? L('yard.unfitFree') : L('yard.unfitFee'))}">${esc(L('yard.takeOut'))}</button>` : ''}</div>`;
    }).join('');
    const guns = (['port', 'starboard'] as const).map((side) => `<div class="card"><h4 class="card-h">${icon(`gun_${self.loadout.guns[side]}`, '', side === 'port' ? 'ico-md flip' : 'ico-md')}${esc(L(side === 'port' ? 'yard.portBattery' : 'yard.starboardBattery', { n: cur.gunPortsPerSide, gun: GUNS[self.loadout.guns[side]].name }))}</h4>
      ${sy.guns.map((gdef) => {
        const g = GUNS[gdef.gun];
        const mounted = self.loadout.guns[side] === gdef.gun;
        return `<div class="item-row">${icon(`gun_${gdef.gun}`, '', 'item-ico')}<div class="item-text"><b>${esc(g.name)}</b><span class="muted">${esc(L('yard.gunStats', { dmg: g.damage, range: g.range, reload: g.reload }))}</span></div><button class="btn btn-small item-btn" data-act="gun" data-side="${side}" data-gun="${gdef.gun}" ${mounted ? 'disabled' : ''}>${mounted ? esc(L('yard.mounted')) : money(gdef.cost)}</button></div>`;
      }).join('')}</div>`).join('');
    const ships = sy.ships.map((s) => {
      const c = SHIP_CLASSES[s.classId];
      const net = Math.max(0, s.price - s.tradeIn);
      const art = assetUrl(c.sprite);
      return `<div class="card hull-card"><div class="hull-art">${art ? `<img src="${art}" alt="" draggable="false" />` : ''}</div>
        <div class="hull-text"><b>${esc(c.name)}</b> <span class="muted">${esc(levelSpan(c.id))} · ${esc(c.role)}</span>
          <div class="hull-stats"><span>${icon('stat_hull', '', 'ico-sm')}${c.hull}</span><span>${icon('stat_sails', '', 'ico-sm')}${c.maxSpeed}</span><span>${icon('fire', '', 'ico-sm')}${c.gunPortsPerSide}×2</span><span>${icon('tab_market', '', 'ico-sm')}${c.holdVolume}</span><span>${icon('stat_crew', '', 'ico-sm')}${c.crewMin}–${c.crewMax}</span></div></div>
        <button class="btn btn-small item-btn" data-act="ship" data-cls="${s.classId}" ${s.classId === self.loadout.classId ? 'disabled' : ''}>${s.classId === self.loadout.classId ? esc(L('yard.yours')) : money(net)}</button></div>`;
    }).join('');
    return `<div class="cols"><div>
        ${self.talents.shp_legendary_keel ? `<div class="card"><h4 class="card-h">${icon('good_timber', '', 'ico-md')}${esc(L('keel.title'))}</h4><p class="muted">${esc(L('keel.text'))}</p><button class="btn btn-small" data-act="keel" ${self.loadout.keel ? 'disabled' : ''}>${esc(self.loadout.keel ? L('keel.has') : L('keel.lay'))}</button></div>` : ''}
        <div class="card"><h4 class="card-h">${icon('good_planks', '', 'ico-md')}${esc(L('repair.title'))}</h4><p>${esc(L('repair.state', { hull: state.you?.hull ?? 0, hullMax: state.you?.hullMax ?? 0, sails: state.you?.sails ?? 0, sailsMax: state.you?.sailsMax ?? 0, guns: self.gunsDisabled.port + self.gunsDisabled.starboard }))}</p>
        <button class="btn btn-primary" data-act="repair" ${sy.repairCost ? '' : 'disabled'}>${esc(sy.repairCost ? L('repair.full', { cost: fmt(sy.repairCost) }) : L('repair.sound'))}</button></div>
        ${refitCard(sy.refit, self.loadout.name)}
        ${guns}</div><div>
        <div class="card"><h4 class="card-h">${icon('mount_mortar', '', 'ico-md')}${esc(L('mount.title'))}</h4>${sy.mounts.map((m) => {
          const def = MOUNTS[m.mount];
          const fitted = self.loadout.mount === m.mount;
          return `<div class="item-row">${icon(`mount_${m.mount}`, '', 'item-ico')}<div class="item-text"><b>${esc(def.name)}</b><span class="muted">${esc(def.description)}</span></div><button class="btn btn-small item-btn" data-act="mount" data-mount="${m.mount}" ${fitted ? 'disabled' : ''}>${fitted ? esc(L('mount.fitted')) : money(m.cost)}</button></div>`;
        }).join('') || `<p class="muted">${esc(L('mount.none'))}</p>`}</div>
        ${modules}</div></div>
      <h3 class="title-sm" style="font-size:20px;margin-top:10px">${esc(L('hulls.title'))}</h3><p class="muted" style="margin:0 0 8px">${esc(L('hulls.note'))}</p>
      <div class="hull-list">${ships}</div>
      <p class="muted">${esc(L('yard.note', { tier: sy.tier }))}</p>

      ${this.buildCard(view, state)}`;
  }

  /** Build to order (docs/02 §3): plan, timber, rare materials, figurehead, master; then launch and berths. */
  private buildCard(view: PortView, state: ClientState): string {
    const self = state.self!;
    const b = this.build;
    const yard = view.yard;
    const classes = view.shipyard.ships.map((x) => x.classId);
    if (!classes.includes(b.classId)) b.classId = classes[0] ?? 'sloop';
    if (!yard.woods.includes(b.frame)) b.frame = yard.woods[0] ?? 'pine';
    if (!yard.woods.includes(b.plank)) b.plank = yard.woods[0] ?? 'pine';
    const cls = SHIP_CLASSES[b.classId];
    const frame = WOODS[b.frame], plank = WOODS[b.plank];
    const plan = self.plans.find((x) => x.id === b.planId);
    const build: ShipBuild = { frame: b.frame, plank: b.plank, rares: Object.entries(b.rares).map(([slot, good]) => ({ slot: slot as RareSlot, good: good as GoodId })), figurehead: b.figurehead, quality: plan?.quality ?? 'common', variants: plan?.variants ?? [], builder: view.portId };
    const gun = defaultGunFor(cls);
    const preview = computeShipStats({ classId: b.classId, name: 'x', guns: { port: gun, starboard: gun }, modules: {}, build }, self.captain, self.talents);
    const plain = computeShipStats({ classId: b.classId, name: 'x', guns: { port: gun, starboard: gun }, modules: {} }, self.captain, self.talents);
    const master = b.master && yard.master;
    const cost = Math.round(cls.price * ((frame.cost + plank.cost) / 2) * (master ? 1.25 : 1) + (b.figurehead ? FIGUREHEADS[b.figurehead].price : 0));
    const skill = Math.min(0.35, 0.01 * Object.entries(self.talents).filter(([id]) => id.startsWith('shp_')).reduce((a, [, r]) => a + (r ?? 0), 0));
    const time = Math.round(BUILD_TIME[cls.tier] * Math.max(frame.time, plank.time) * (1 - skill) * (master ? 0.75 : 1));
    const mats = buildMaterials(cls.tier);
    for (const [slot, good] of Object.entries(b.rares)) {
      const def = RARES[slot as RareSlot].find((x) => x.good === good);
      if (def) mats[def.good] = (mats[def.good] ?? 0) + def.units;
    }
    const wh = self.warehouses[view.portId] ?? {};
    const matText = Object.entries(mats).map(([g, n]) => {
      const got = Math.floor(self.cargo[g as GoodId] ?? 0) + Math.floor(wh[g as GoodId] ?? 0);
      return `<span class="mat ${got >= (n ?? 0) ? '' : 'short'}" title="${esc(L('build.matTitle'))}">${icon(`good_${g}`)}${esc(GOODS[g as GoodId].name)} <b>${got}/${n}</b></span>`;
    }).join('');
    const pct = (a: number, z: number) => { const d = Math.round((a / z - 1) * 100); return `${d >= 0 ? '+' : '−'}${Math.abs(d)}%`; };
    const figs = [yard.figurehead, ...self.figureheads].filter((f, i, a) => f && a.indexOf(f) === i) as FigureheadId[];
    const orders = self.builds.map((o) => {
      const left = Math.max(0, o.done - state.estServerTime());
      const here = o.port === view.portId;
      return `<div class="row order-row"><span><b>${esc(o.name)}</b> <span class="muted">${o.name === SHIP_CLASSES[o.classId].name ? '' : `${esc(SHIP_CLASSES[o.classId].name)} · `}${esc(WOODS[o.frame].name)}/${esc(WOODS[o.plank].name)} · ${esc(L('build.orderInfo', { quality: L(`quality.${o.quality}`), port: state.ports.find((p) => p.id === o.port)?.name ?? o.port }))}</span></span>
        ${left > 0 ? `<span class="muted nowrap">${esc(L('unit.min', { n: Math.ceil(left / 60) }))}</span>` : here ? `<button class="btn btn-small btn-primary" data-act="launch" data-id="${o.id}">${esc(L('build.launch'))}</button>` : `<span class="gold">${esc(L('build.ready'))}</span>`}</div>`;
    }).join('');
    const berths = self.berths.map((x, i) => `<div class="row" style="padding:3px 0"><span>${esc(x.name)} <span class="muted">${esc(SHIP_CLASSES[x.classId].name)} · ${esc(L('berth.info', { hull: x.hull, port: state.ports.find((p) => p.id === x.port)?.name ?? (x.port.startsWith('isle:') ? state.islands.get(Number(x.port.slice(5)))?.name ?? L('berth.yourIsland') : x.port) }))}</span></span>
      ${x.port === view.portId ? `<span><button class="btn btn-small" data-act="berth_swap" data-i="${i}">${esc(L('berth.takeOut'))}</button> <button class="btn btn-small btn-danger" data-act="berth_sell" data-i="${i}">${esc(L('btn.sell'))}</button></span>` : ''}</div>`).join('');
    return `<h3 class="title-sm" style="font-size:20px;margin-top:10px">${esc(L('build.title'))}</h3>
      <div class="cols"><div class="card"><div class="form-grid build-form">
        <label class="fg-wide">${esc(L('build.hull'))}<select data-build="classId">${classes.map((c) => `<option value="${c}" ${c === b.classId ? 'selected' : ''}>${esc(SHIP_CLASSES[c].name)} (${esc(levelSpan(c))})</option>`).join('')}</select></label>
        <label class="fg-wide">${esc(L('build.name'))}<input data-build="name" value="${esc(b.name)}" maxlength="28" placeholder="${esc(cls.name)}"></label>
        <label>${esc(L('build.frame'))}<select data-build="frame">${yard.woods.map((w) => `<option value="${w}" ${w === b.frame ? 'selected' : ''}>${esc(WOODS[w].name)}</option>`).join('')}</select></label>
        <label>${esc(L('build.plank'))}<select data-build="plank">${yard.woods.map((w) => `<option value="${w}" ${w === b.plank ? 'selected' : ''}>${esc(WOODS[w].name)}</option>`).join('')}</select></label>
        <p class="muted fg-wide">${esc(frame.description)} ${b.plank !== b.frame ? esc(plank.description) : ''}</p>
        ${(Object.keys(RARES) as RareSlot[]).map((slot, i, all) => `<label class="${all.length % 2 && i === all.length - 1 ? 'fg-wide' : ''}">${esc(slot === 'keel' ? L('rare.keel') : slot === 'belt' ? L('rare.belt') : slot === 'sails' ? L('rare.sails') : slot === 'guns' ? L('rare.guns') : L('rare.paint'))}<select data-build="rare:${slot}"><option value="">${esc(L('build.standard'))}</option>${RARES[slot].map((r) => `<option value="${r.good}" ${b.rares[slot] === r.good ? 'selected' : ''} title="${esc(r.description)}">${esc(r.name)} (${r.units} ${esc(GOODS[r.good].name.toLowerCase())})</option>`).join('')}</select></label>`).join('')}
        <label class="fg-wide">${esc(L('build.figurehead'))}<select data-build="figurehead"><option value="">${esc(L('build.none'))}</option>${figs.map((f) => `<option value="${f}" ${b.figurehead === f ? 'selected' : ''}>${esc(FIGUREHEADS[f].name)} — ${esc(FIGUREHEADS[f].description)}</option>`).join('')}</select></label>
        <label class="fg-wide">${esc(L('build.plan'))}<select data-build="planId"><option value="">${esc(L('build.planCommon'))}</option>${self.plans.filter((x) => x.classId === null || x.classId === b.classId).map((x) => `<option value="${x.id}" ${b.planId === x.id ? 'selected' : ''}>${esc(L(`quality.${x.quality}`))}: ${x.variants.map((v) => esc(VARIANTS[v].name)).join('; ')} ${esc(L('build.uses', { n: x.uses > 1000 ? '∞' : x.uses, word: x.uses > 1000 ? L('build.use5') : plural(x.uses, L('build.use1'), L('build.use2'), L('build.use5')) }))}</option>`).join('')}</select></label>
        ${yard.master ? `<label class="check fg-wide"><input type="checkbox" data-build="master" ${b.master ? 'checked' : ''}> ${esc(L('build.master'))}</label>` : ''}
      </div></div><div class="card">
        <h4>${esc(b.name || cls.name)}</h4>
        <table class="grid"><tr><td>${esc(L('th.hull'))}</td><td>${preview.hullMax} (${pct(preview.hullMax, plain.hullMax)})</td></tr><tr><td>${esc(L('th.armour'))}</td><td>${Math.round(preview.armor * 100)}% (${pct(preview.armor || 0.01, plain.armor || 0.01)})</td></tr>
          <tr><td>${esc(L('th.speed'))}</td><td>${dec1(preview.maxSpeed)} (${pct(preview.maxSpeed, plain.maxSpeed)})</td></tr><tr><td>${esc(L('th.holdCap'))}</td><td>${preview.holdVolume.toFixed(0)}</td></tr><tr><td>${esc(L('th.crew'))}</td><td>${preview.crewMax}</td></tr></table>
        <p>${esc(L('build.costTime', { cost: fmt(cost), min: Math.ceil(time / 60) }))}</p><div class="mats">${matText}</div>
        <button class="btn btn-primary btn-block" data-act="build_order" ${self.builds.length ? 'disabled' : ''}>${esc(self.builds.length ? L('build.busy') : L('build.lay'))}</button>
        ${yard.plans ? `<p style="margin-top:8px"><button class="btn btn-small btn-block" data-act="plan_buy">${esc(L('build.planBuy', { ship: cls.name, cost: fmt(Math.round(cls.price * 0.3)) }))}</button></p>` : ''}
        ${yard.figurehead ? `<p><button class="btn btn-small btn-block" data-act="figurehead_buy">${esc(L('build.figureheadBuy', { fig: FIGUREHEADS[yard.figurehead].name, cost: fmt(FIGUREHEADS[yard.figurehead].price) }))}</button></p>` : ''}
      </div></div>
      ${orders || berths ? `<div class="card"><h4 class="card-h">${icon('build_shipyard', '', 'ico-md')}${esc(L('build.orders'))}</h4>
${orders}${berths}</div>` : ''}`;
  }

  private tavern(view: PortView, state: ClientState): string {
    const self = state.self!;
    const port = state.ports.find((p) => p.id === view.portId)!;
    const room = (state.you?.crewMax ?? 0) - self.crew;
    const tv = view.tavern;
    const co = self.company;
    const trades = PROFESSIONS.filter((k) => k !== 'sailor').map((k) => `<div class="trade-row" title="${esc(PROFESSION_DEFS[k].description)}">${icon(`prof_${k}`, '', 'item-ico')}
        <div class="item-text"><b>${esc(PROFESSION_DEFS[k].name)}</b><span class="muted trade-counts"><span title="${esc(L('tavern.aboard', { n: co.pools[k] }))}">${icon('menu_ship', '', 'ico-xs')}${co.pools[k]}</span><span title="${esc(L('tavern.here', { n: tv.stock[k] ?? 0 }))}">${icon('anchor', '', 'ico-xs')}${tv.stock[k] ?? 0}</span></span></div>
        ${money(tv.costs[k])}
        <div class="trade-btns"><button class="btn btn-small" data-act="crew" data-prof="${k}" data-n="1" ${(tv.stock[k] ?? 0) > 0 && room > 0 ? '' : 'disabled'}>${esc(L('btn.hire'))}</button><button class="btn btn-small btn-danger" data-act="crew" data-prof="${k}" data-n="-1" ${co.pools[k] > 0 ? '' : 'disabled'}>−</button></div></div>`).join('');
    const officers = tv.officers.map((o) => `<div class="card"><h4>${officerIcon(o)}${esc(personName(o.name))} <span class="muted">— ${esc(L('officer.level', { role: lang() === 'ru' ? OFFICER_DEFS[o.role].name.toLowerCase() : OFFICER_DEFS[o.role].name, n: o.level }))}</span></h4>
        ${o.story ? `<p class="muted">${esc(serverText(o.story))}</p>` : ''}<p>${traitChips(o.traits)}</p><p class="muted">${esc(OFFICER_DEFS[o.role].description)}</p>
        <div class="row"><span>${esc(L('officer.loyalty', { n: o.loyalty }))}${o.rep ? esc(L('officer.needs', { n: o.rep })) : ''}</span><button class="btn btn-small btn-primary" data-act="officer_hire" data-id="${esc(o.id)}" ${o.taken || co.officers.length >= co.slots ? 'disabled' : ''}>${o.taken ? esc(L('officer.taken')) : `${esc(L('btn.hire'))} ${money(o.price)}`}</button></div></div>`).join('') || `<p class="muted">${esc(L('officer.none'))}</p>`;
    const board = view.wanted ? wantedBoardHtml(view.wanted) : '';
    const recs = view.fishRecords?.length ? `<div class="card fish-records"><h4 class="card-h">${icon('build_fishing_village', '', 'ico-md')}${esc(L('fish.records'))}</h4>${view.fishRecords.map((r) => `<p class="fish-rec">${esc(L('fish.recordRow', { fish: FISH[r.fish].name[lang() === 'ru' ? 1 : 0], kg: r.kg.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB'), name: r.name }))}</p>`).join('')}</div>` : '';
    return `${board}${recs}${tv.shanty ? `<div class="card"><h4 class="card-h">${icon('opt_sound', '', 'ico-md')}${esc(L('tavern.bard'))}</h4><p><i>${esc(serverText(tv.shanty))}</i></p></div>` : ""}<div class="cols"><div class="card"><h4 class="card-h">${icon('stat_crew', '', 'ico-md')}${esc(L('tavern.sailors'))}<span class="h-count" title="${esc(L('tavern.sailorsTitle'))}">${view.crewAvailable}</span></h4>
        <p>${esc(L('tavern.bounty', { cost: view.crewHireCost, stars: '★'.repeat(Math.round(tv.stars)), n: tv.stars, room }))}</p>
        <div class="hire-grid">${[1, 5, 10, 25].map((n) => `<button class="btn btn-small" data-act="crew" data-n="${n}"><b>+${n}</b>${money(n * view.crewHireCost)}</button>`).join('')}
        <button class="btn btn-small btn-danger hire-wide" data-act="crew" data-n="-5">${esc(L('tavern.discharge'))}</button>
        ${tv.dregs ? `<button class="btn btn-small hire-wide" data-act="dregs" title="${esc(L('tavern.dregsTitle'))}">${esc(L('tavern.dregs'))}</button>` : ''}
        ${tv.pressGang ? `<button class="btn btn-small btn-danger hire-wide" data-act="press" title="${esc(L('tavern.pressTitle'))}">${esc(L('tavern.press'))}</button>` : ''}</div>
        <h4 style="margin-top:10px">${esc(L('tavern.tradesmen'))}</h4><div class="trade-list">${trades}</div></div>
      <div><h3 class="title-sm" style="font-size:20px">${esc(L('tavern.officers', { n: co.officers.length, max: co.slots }))}</h3>${officers}</div></div>
      <div class="cols">
      <div class="card"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${esc(L('tavern.rumours'))}</h4>${[...new Set(view.rumors)].map((r) => `<p>${quote(serverText(r))}</p>`).join('')}</div>
      <div>${dailyCard(self.daily)}${commonCard(self.common)}${view.questOffers.length ? `<h3 class="title-sm" style="font-size:20px">${esc(L('quest.board'))}</h3>` : ''}${view.questOffers.map((q) => `<div class="card"><h4 class="card-h">${(q.portrait && icon(`portrait.${q.portrait}`, '', 'ico-md ico-round q-face')) || icon(q.kind === 'legend' ? 'tab_legends' : q.kind === 'path' ? 'menu_crew' : q.kind === 'job' ? JOB_ICON[q.category ?? ''] ?? 'goal' : q.category === 'arc' ? 'tab_legends' : 'goal', '', 'ico-md')}<span class="q-title"><b>${esc(serverText(q.name))}</b><span class="muted">${esc(serverText(q.mentor))}${q.kind === 'legend' ? esc(L('quest.legend')) : q.kind === 'path' ? esc(L('quest.path')) : q.category ? esc(L(`quest.cat.${q.category}` as 'quest.cat.delivery')) : ''}${q.chapter ? esc(L('quest.chapter', { n: q.chapter })) : ''}${q.urgent ? `<span class="q-urgent">${esc(L('quest.urgent'))}</span>` : ''}${q.group ? `<span class="q-group">${esc(L('quest.group', { n: q.group }))}</span>` : ''}</span></span></h4>
        <p>${esc(serverText(q.summary))}</p><ol class="muted" style="margin:4px 0 6px 18px">${q.steps.map((t) => `<li>${esc(serverText(t))}</li>`).join('')}</ol>
        <div class="row"><span class="reward">${money(q.silver)}${xpBadge(q.xp)}${q.path ? esc(L('quest.pathOf', { arch: CAPTAINS[q.path].archetype })) : ''}</span>
        ${q.blocked ? `<span class="muted">${esc(L('quest.needs', { x: serverText(q.blocked) }))}</span>` : `<button class="btn btn-small btn-primary" data-act="quest_accept" data-id="${q.id}">${esc(L('quest.take'))}</button>`}</div></div>`).join('')}
      ${self.quests.length ? `<div class="card"><h4 class="card-h">${icon('goal', '', 'ico-md')}${esc(L('quest.underway'))}</h4>${self.quests.map((q) => `<div class="row" style="padding:2px 0"><span><b>${esc(serverText(q.name))}</b> ${q.step}/${q.steps}: ${esc(serverText(q.text))}${q.need > 1 ? ` (${q.progress}/${q.need})` : ''}</span><button class="btn btn-small btn-danger" data-act="quest_abandon" data-id="${q.id}">${esc(L('quest.setAside'))}</button></div>`).join('')}</div>` : ''}</div></div>
      <div class="card"><h4 class="card-h">${icon('map_port', '', 'ico-md')}${esc(L('carto.title'))}</h4>
        <p>${esc(L('carto.text', { brokers: port.faction === 'brokers' ? L('carto.brokers') : '' }))}</p>
        <div class="row"><span>${esc(L('carto.sellable', { n: view.charts.sellable, islands: plural(view.charts.sellable, L('carto.island1'), L('carto.island2'), L('carto.island5')) }))}</span>
          <button class="btn btn-small btn-primary" data-act="chart_sell" ${view.charts.sellable ? '' : 'disabled'}>${esc(L('carto.sell', { cost: fmt(view.charts.sellValue) }))}</button></div>
        ${view.charts.offers.map((o) => `<div class="row" style="padding:3px 0"><span>${esc(o.name)} <span class="muted">${esc(L('carto.uncharted', { n: o.islands, islands: plural(o.islands, L('carto.uncharted1'), L('carto.uncharted2'), L('carto.uncharted5')) }))}</span></span>
          <button class="btn btn-small" data-act="chart_buy" data-region="${o.region}">${esc(L('carto.buy', { cost: fmt(o.price) }))}</button></div>`).join('') || `<p class="muted">${esc(L('carto.none'))}</p>`}
      </div>
      <div class="card"><h4 class="card-h">${icon('map_treasure', '', 'ico-md')}${esc(L('maps.title', { n: self.maps.filter((m) => m.kind !== 'fragment').length }))}</h4>
        <p>${esc(L('maps.text', { how: landHow() }))}</p>
        ${self.maps.map((m) => `${mapCard(m)}<div class="row" style="gap:4px;padding-bottom:4px"><button class="btn btn-small" data-act="map" data-mode="appraise" data-id="${esc(m.id)}">${esc(L('maps.appraise'))}</button>${port.faction === 'brokers' ? `<button class="btn btn-small" data-act="map" data-mode="seal" data-id="${esc(m.id)}">${esc(L('maps.seal'))}</button>` : ''}<input class="map-to" data-for="${esc(m.id)}" placeholder="${esc(L('maps.captainPh'))}" style="width:90px"><button class="btn btn-small" data-act="map" data-mode="give" data-id="${esc(m.id)}">${esc(L('btn.handOver'))}</button><button class="btn btn-small btn-danger" data-act="map" data-mode="burn" data-id="${esc(m.id)}">${esc(L('maps.burn'))}</button></div>`).join('')}
        ${port.blackMarket ? `<div class="row"><span class="muted">${esc(L('maps.forger'))}</span><button class="btn btn-small" data-act="map" data-mode="forge">${esc(L('maps.forge'))}</button></div>` : ''}
        <div class="row" style="gap:6px;margin-top:6px"><button class="btn btn-small" data-act="treasure" data-mode="buy">${esc(L('maps.buy'))}</button>
          <button class="btn btn-small" data-act="treasure" data-mode="assemble" ${self.fragments >= 3 ? '' : 'disabled'}>${esc(L('maps.assemble', { n: self.fragments }))}</button>
          ${(self.talents.exp_map_of_the_dead ?? 0) > 0 ? [1, 2].map((t) => `<button class="btn btn-small" data-act="treasure" data-mode="merge" data-tier="${t}" ${self.maps.filter((m) => m.tier === t).length >= 3 ? '' : 'disabled'}>${esc(t === 1 ? L('maps.mergeStained') : L('maps.mergeCaptain'))}</button>`).join(' ') : ''}</div>

      </div>`;
  }

  private contracts(view: PortView, state: ClientState): string {
    const self = state.self!;
    const port = (id?: string) => state.ports.find((p) => p.id === id)?.name ?? '';
    const mine = self.contracts.map((c) => `<div class="card quest-card">${icon(contractArt(c), '', 'quest-ico')}<div class="quest-body"><h4>${esc(serverText(c.title))}</h4><p>${esc(serverText(c.description))}</p>
      <div class="row"><span class="reward">${money(c.reward)}${xpBadge(c.xp)}</span>${c.kind === 'bounty' ? `<span>${c.progress ?? 0}/${c.kills}</span>` : `<span class="muted">${esc(L('contract.to', { port: port(c.toPort) }))}</span>`}
      <button class="btn btn-small btn-danger" data-act="contract" data-mode="abandon" data-id="${c.id}">${esc(L('btn.abandon'))}</button></div></div></div>`).join('') || `<p class="muted">${esc(L('contract.none'))}</p>`;
    const offered = view.contracts.map((c) => `<div class="card quest-card">${icon(contractArt(c), '', 'quest-ico')}<div class="quest-body"><h4>${esc(serverText(c.title))}</h4><p>${esc(serverText(c.description))}</p>
      <div class="row"><span class="reward">${money(c.reward)}${xpBadge(c.xp)}</span><button class="btn btn-small btn-primary" data-act="contract" data-mode="accept" data-id="${c.id}">${esc(L('btn.accept'))}</button></div></div></div>`).join('') || `<p class="muted">${esc(L('contract.empty'))}</p>`;
    return `<div class="cols"><div><h3 class="title-sm" style="font-size:20px">${esc(L('contract.posted'))}</h3>${offered}</div><div><div class="sec-head"><h3 class="title-sm" style="font-size:20px">${esc(L('contract.mine'))}</h3><span class="h-count" title="${esc(L('contract.slots'))}">${self.contracts.length}/${3 + ((self.talents.trd_contract_broker ?? 0) > 0 ? 1 : 0)}</span></div>${mine}</div></div>`;
  }

  private harbour(view: PortView, state: ClientState): string {
    const self = state.self!;
    const port = state.ports.find((p) => p.id === view.portId)!;
    const reps = Object.entries(self.reputation).map(([f, v]) => `<tr><td>${icon(`faction_${f}`)}${esc(FACTIONS[f as never as keyof typeof FACTIONS].name)}</td><td class="${(v ?? 0) < 0 ? 'up' : 'down'}">${v}</td></tr>`).join('');
    return `<div class="cols"><div>
        <div class="card"><h4 class="card-h">${icon('wanted', '', 'ico-md')}${esc(L('pardon.title'))}</h4>${view.pardonCost !== null ? `<p>${esc(L('pardon.text', { n: self.infamy }))}</p><button class="btn" data-act="pardon" ${self.infamy >= 20 ? '' : 'disabled'}>${esc(L('pardon.buy', { cost: fmt(view.pardonCost) }))}</button>` : `<p class="muted">${esc(L('pardon.none'))}</p>`}</div>
        ${view.licence ? `<div class="card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${esc(L('licence.title'))}</h4><p>${esc(view.licence.until > state.estServerTime() ? L('licence.textActive', { faction: FACTIONS[port.faction].short }) : L('licence.textDuty', { pct: Math.round(view.duty * 100) || '', faction: FACTIONS[port.faction].short }))}</p>
          ${port.faction === 'harpoon' ? `<p class="muted">${esc(L('licence.whaling'))}</p>` : ''}
          ${view.licence.until > state.estServerTime() ? `<p class="good">${esc(licenceLeft(Math.round((view.licence.until - state.estServerTime()) / 60)))}</p>` : ''}
          <button class="btn" data-act="licence">${esc(L('licence.buy', { cost: fmt(view.licence.cost) }))}</button></div>` : ''}
        ${self.captives.length ? `<div class="card"><h4 class="card-h">${icon('stat_crew', '', 'ico-md')}${esc(L('captives.title'))}</h4>${self.captives.map((c, i) => `<div class="row" style="padding:3px 0"><span>${esc(c.name)} <span class="muted">${esc(FACTIONS[c.faction].short)}</span></span><span>
          <button class="btn btn-small" data-act="captive" data-i="${i}" data-mode="ransom">${esc(L('captive.ransom', { cost: fmt(c.ransom) }))}</button>
          <button class="btn btn-small" data-act="captive" data-i="${i}" data-mode="hand_over" title="${esc(L('captive.handTitle'))}">${esc(L('btn.handOver'))}</button></span></div>`).join('')}</div>` : ''}
        <div class="card"><h4 class="card-h">${icon('insurance', '', 'ico-md')}${esc(L('ins.title'))}</h4>${view.insurance.length ? `<p>${esc(L('ins.text'))}</p>
          ${self.policy ? `<p class="good">${esc(L('ins.insured', { tier: L(`ins.${self.policy}`) }))}</p>` : view.insurance.map((q) => `<div class="row ins-row"><span><b>${esc(q.tier === 'hull' ? L('ins.hull') : q.tier === 'cargo' ? L('ins.cargo') : L('ins.full'))}</b> <span class="muted">${q.hull ? esc(L('ins.salvage')) : ''}${q.hull && q.cover ? ' · ' : ''}${q.cover ? esc(L('ins.cover', { pct: Math.round(q.cover * 100), declared: fmt(q.declared), deductible: fmt(q.deductible) })) : ''}</span></span>
            <button class="btn btn-small" data-act="insure" data-tier="${q.tier}" ${q.cover && q.declared < 50 ? 'disabled' : ''}>${money(q.premium)}</button></div>`).join('')}` : `<p class="muted">${esc(L('ins.none'))}</p>`}</div>
        <div class="card"><h4 class="card-h">${icon('ammo_cursed', '', 'ico-md')}${esc(L('curse.title'))}</h4><p>${esc(L('curse.state', { n: self.curse }))}${self.curse >= 25 ? esc(L('curse.stage', { n: self.curse >= 80 ? 3 : self.curse >= 50 ? 2 : 1 })) : ''}. ${esc(['harpoon', 'crown', 'league'].includes(port.faction) ? L('curse.yes') : L('curse.no'))}</p>
          <button class="btn" data-act="cleanse" ${self.curse >= 2 && ['harpoon', 'crown', 'league'].includes(port.faction) ? '' : 'disabled'}>${esc(L('curse.cleanse', { cost: fmt(Math.round(self.curse * 8 * (0.6 + SHIP_CLASSES[self.loadout.classId].tier * 0.4))) }))}</button></div>
        ${view.captainsHouse ? `<div class="card"><h4 class="card-h">${icon('menu_crew', '', 'ico-md')}${esc(L('house.title'))}</h4><p>${esc(L('house.text'))}</p>
          <div class="row" style="gap:6px;flex-wrap:wrap">${self.paths.map((c) => `<button class="btn btn-small ${c === self.captain ? 'btn-primary' : ''}" data-act="path" data-to="${c}" ${c === self.captain ? 'disabled' : ''}>${esc(CAPTAINS[c].archetype)}</button>`).join('')}</div>
          <p class="muted">${esc(L('house.other'))}</p></div>` : ''}
        ${view.oathOffer ? `<div class="card"><h4>${esc(view.oathOffer === 'code' ? L('oath.code') : L('oath.marque'))}</h4><p>${esc(view.oathOffer === 'code' ? L('oath.codeText') : L('oath.marqueText'))} ${esc(L('oath.one'))}</p>
          <button class="btn" data-act="oath" data-oath="${view.oathOffer}">${esc(L('oath.swear'))}</button></div>` : ''}
        <div class="card"><h4 class="card-h">${icon('ab_call_escort', '', 'ico-md')}${esc(L('escort.title', { n: self.fleet.escorts.length, max: self.fleet.slots }))}</h4>${self.fleet.slots ? `<p>${esc(L('escort.text', { cost: fmt(self.fleet.upkeep) }))}</p>
          ${self.fleet.escorts.map((e) => `<div class="row" style="padding:2px 0"><span>${esc(e.name)} <span class="muted">${esc(SHIP_CLASSES[e.classId].name)} · ${esc(L('escort.hull', { n: e.hull }))}</span></span><button class="btn btn-small btn-danger" data-act="escort_dismiss" data-id="${esc(e.id)}">${esc(L('escort.payOff'))}</button></div>`).join('')}
          ${view.escorts.map((o) => `<button class="btn btn-small" data-act="escort_hire" data-cls="${o.classId}" ${o.available && self.fleet.escorts.length < self.fleet.slots ? '' : 'disabled'} title="${esc(L('escort.upkeep', { n: o.upkeep }))}">${esc(SHIP_CLASSES[o.classId].name)} — ${money(o.price)}</button>`).join(' ')}` : `<p class="muted">${esc(L('escort.none'))}</p>`}</div>
        <div class="card"><h4 class="card-h">${icon('map_wreck', '', 'ico-md')}${esc(L('claim.title'))}</h4><p class="muted">${esc(L('claim.text'))}</p>
          <div class="row" style="gap:6px"><input id="claim-email" type="email" placeholder="${esc(L('claim.emailPh'))}" style="flex:1"><input id="claim-password" type="password" placeholder="${esc(L('claim.passwordPh'))}" style="flex:1"><button class="btn btn-small" data-act="claim">${esc(L('btn.save'))}</button></div></div>
        <div class="card"><h4 class="card-h">${icon('menu_talents', '', 'ico-md')}${esc(L('respec.title'))}</h4><p>${esc(L('respec.text', { cost: fmt(60 * self.level) }))}</p><button class="btn btn-danger" data-act="respec">${esc(L('respec.btn'))}</button></div>
      </div><div class="card"><h4 class="card-h">${icon('faction_league', '', 'ico-md')}${esc(L('standing.title'))}</h4><table class="grid">${reps}</table>
      <p class="muted" style="margin-top:8px">${esc(L('standing.stats', { sunk: self.stats.sunk, taken: self.stats.boarded, profit: fmt(self.stats.tradeProfit), km: fmt(self.stats.distance / 1000), islands: self.discoveredCount }))}</p></div></div>`;

  }

  private holdings(view: PortView, state: ClientState): string {
    const self = state.self!;
    const now = state.estServerTime();
    const sites = view.sites.map((x) => {
      const left = x.until > now ? Math.round((x.until - now) / 60) : 0;
      const status = x.mine ? `<span class="good">${esc(L('site.yours', { n: left, stock: x.stock, cap: x.capacity }))}</span>` : x.holder ? `<span class="bad">${esc(L('site.held', { who: x.holder, n: left }))}</span>` : `<span class="muted">${esc(L('site.unclaimed'))}</span>`;
      const can = !x.holder || x.mine;
      return `<tr><td><b>${esc(placeName(x.island))}</b></td><td>${icon(`good_${x.good}`)}${esc(GOODS[x.good].name)}</td><td>${esc(L('site.rate', { n: x.rate }))}</td><td>${status}</td>
        <td><button class="btn btn-small" data-act="rights" data-site="${esc(x.id)}" ${can ? '' : 'disabled'}>${esc(x.mine ? L('site.extend') : L('site.buy'))} ${money(x.cost)}</button></td></tr>`;
    }).join('');
    const wh = view.warehouse;
    const goods = new Set([...Object.keys(wh.goods), ...Object.keys(self.cargo)]);
    const rows = [...goods].filter((g) => (wh.goods[g as never] ?? 0) > 0 || (self.cargo[g as never] ?? 0) >= 1).map((g) => {
      const stored = Math.floor(wh.goods[g as never] ?? 0);
      const held = Math.floor(self.cargo[g as never] ?? 0);
      return `<tr><td>${icon(`good_${g}`)}${esc(GOODS[g as never as keyof typeof GOODS].name)}</td><td>${held}</td><td>${stored}</td>
        <td><button class="btn btn-small" data-act="store" data-good="${g}" data-n="${held}" ${held ? '' : 'disabled'}>${esc(L('wh.storeAll'))}</button>
        <button class="btn btn-small" data-act="store" data-good="${g}" data-n="${-stored}" ${stored ? '' : 'disabled'}>${esc(L('wh.takeAll'))}</button></td></tr>`;
    }).join('');
    return `<div class="cols"><div><div class="card"><h4 class="card-h">${icon('tab_law', '', 'ico-md')}${esc(L('rights.title'))}</h4>
        <p class="muted">${esc(L('rights.text', { how: landHow() }))}</p>
        ${sites ? `<table class="grid"><tr><th>${esc(L('th.island'))}</th><th>${esc(L('th.yield'))}</th><th>${esc(L('th.rate'))}</th><th>${esc(L('th.status'))}</th><th></th></tr>${sites}</table>` : `<p class="muted">${esc(L('rights.none'))}</p>`}</div></div>
      <div><div class="card"><h4 class="card-h">${icon('tab_holdings', '', 'ico-md')}${esc(L('wh.title'))} ${wh.rented ? `<span class="muted">${Math.round(wh.volume)}/${wh.capacity}</span>` : ''}</h4>
        <p class="muted">${esc(wh.rented ? L('wh.rented') : L('wh.rent', { cost: fmt(wh.rent) }))}</p>
        ${rows ? `<table class="grid"><tr><th>${esc(L('th.good'))}</th><th>${esc(L('th.hold'))}</th><th>${esc(L('th.stored'))}</th><th></th></tr>${rows}</table>` : `<p class="muted">${esc(L('wh.empty'))}</p>`}</div></div></div>`;
  }


  private exchange(view: PortView, state: ClientState): string {
    const self = state.self!;
    const now = state.estServerTime();
    const portName = (id: string) => state.ports.find((p) => p.id === id)?.name ?? id;
    const mins = (t: number) => L('unit.min', { n: Math.max(0, Math.round((t - now) / 60)) });
    const ex = view.exchange;
    const forwards = ex?.forwards.map((f) => `<tr><td>${goodQty(f.good, f.qty)}</td><td class="lg-wide">${esc(placeName(f.toName))}</td><td class="gold">${esc(L('unit.perU', { n: f.price }))}</td><td>${money(f.collateral)}</td><td>${esc(mins(f.expiresAt))}</td>
      <td><button class="btn btn-small" data-act="forward" data-id="${esc(f.id)}">${esc(L('btn.sign'))}</button></td></tr>`).join('') ?? '';
    const mine = self.forwards.map((f) => `<tr><td>${goodQty(f.good, f.qty)} <span class="muted">${f.delivered}/${f.qty}</span></td><td class="lg-wide">${esc(portName(f.toPort))}</td><td class="gold">${esc(L('unit.perU', { n: f.price }))}</td><td>${money(f.collateral)}</td><td>${esc(mins(f.expiresAt))}</td></tr>`).join('');
    const orders = ex?.orders.map((o) => {
      const have = Math.floor(self.cargo[o.good] ?? 0);
      const n = Math.min(have, o.qty - o.filled);
      return `<tr><td>${esc(o.name)}</td><td>${goodQty(o.good, o.qty - o.filled)}</td><td class="gold">${esc(L('unit.perU', { n: o.price }))}</td><td>${esc(mins(o.expiresAt))}</td>
        <td>${o.mine ? `<button class="btn btn-small" data-act="order_cancel" data-id="${esc(o.id)}">${esc(L('btn.cancel'))}</button>` : `<button class="btn btn-small" data-act="order_fill" data-id="${esc(o.id)}" data-n="${n}" ${n ? '' : 'disabled'}>${esc(L('order.sell', { n: n || '' }).trim())}</button>`}</td></tr>`;
    }).join('') ?? '';
    const goodsOpts = view.market.map((r) => `<option value="${r.good}">${esc(GOODS[r.good].name)} (~${r.sell})</option>`).join('');
    const b = view.bank;
    const loan = b.loan ? `<p class="${b.loan.defaulted ? 'bad' : ''}">${esc(L('loan.owed', { owed: fmt(b.loan.owed), status: b.loan.defaulted ? L('loan.default') : L('loan.due', { t: mins(b.loan.due) }) }))}</p>` : '';
    return `<div class="cols"><div>
        <div class="card"><h4 class="card-h">${icon('tab_exchange', '', 'ico-md')}${esc(L('fwd.title'))}</h4>${ex ? `<p class="muted">${esc(L('fwd.text'))}</p>
          ${forwards ? `<table class="grid"><tr><th>${esc(L('th.goods'))}</th><th>${esc(L('th.to'))}</th><th>${esc(L('th.price'))}</th><th>${esc(L('th.collateral'))}</th><th>${esc(L('th.deadline'))}</th><th></th></tr>${forwards}</table>` : `<p class="muted">${esc(L('fwd.none'))}</p>`}` : `<p class="muted">${esc(L('fwd.noExchange'))}</p>`}
          ${mine ? `<h4 style="margin-top:10px">${esc(L('fwd.mine'))}</h4><table class="grid">${mine}</table>` : ''}</div>
        ${ex ? `<div class="card"><h4 class="card-h">${icon('tab_board', '', 'ico-md')}${esc(L('orders.title'))}</h4><p class="muted">${esc(L('orders.text'))}</p>
          ${orders ? `<table class="grid"><tr><th>${esc(L('th.buyer'))}</th><th>${esc(L('th.wants'))}</th><th>${esc(L('th.pays'))}</th><th>${esc(L('th.lapses'))}</th><th></th></tr>${orders}</table>` : `<p class="muted">${esc(L('orders.none'))}</p>`}
          <div class="form-grid"><label class="fg-wide">${esc(L('th.goods'))}<select id="ord-good">${goodsOpts}</select></label><label>${esc(L('orders.qty'))}<input id="ord-qty" type="number" min="1" max="200" value="20"></label><label>${esc(L('orders.price'))}<input id="ord-price" type="number" min="1" value="20"></label><button class="btn btn-primary fg-wide" data-act="order_post">${esc(L('orders.post'))}</button></div></div>` : ''}
      </div><div>
        ${self.talents.trd_speculator ? `<div class="card"><h4 class="card-h">${icon('tab_exchange', '', 'ico-md')}${esc(L('opt.title'))}</h4><p class="muted">${esc(L('opt.text'))}</p>
          ${self.options.map((o, i) => `<div class="row" style="padding:3px 0"><span>${o.qty} ${icon(`good_${o.good}`)}${esc(GOODS[o.good].name)} @ ${esc(state.ports.find((p) => p.id === o.port)?.name ?? o.port)} · ${fmt(o.price)} · ${esc(mins(o.until))}</span>${o.port === view.portId ? `<button class="btn btn-small" data-act="option_ex" data-i="${i}">${esc(L('opt.exercise', { cost: fmt(o.price - o.deposit) }))}</button>` : ''}</div>`).join('')}
          <div class="row" style="gap:6px;margin-top:6px"><select id="opt-good">${view.market.filter((r) => r.stock > 3).map((r) => `<option value="${r.good}">${esc(GOODS[r.good].name)} ${esc(L('opt.stock', { buy: r.buy, stock: r.stock }))}</option>`).join('')}</select><input id="opt-qty" type="number" min="1" value="10" style="width:60px"><button class="btn btn-small" data-act="option_buy">${esc(L('opt.reserve'))}</button></div></div>` : ''}
        <div class="card"><h4 class="card-h">${icon('coin', '', 'ico-md')}${esc(L('bank.title'))}</h4>${b.available ? `<p>${L('bank.text', { balance: fmt(b.balance), pct: Math.round(b.withdrawFee * 100) })}</p>
          <p>${L('bank.credit', { limit: fmt(b.limit), pct: Math.round(b.interest * 100), h: Math.round(b.term / 3600) })}</p>${loan}
          <div class="form-grid"><label class="fg-wide">${esc(L('bank.amount'))}<input id="bank-amt" type="number" min="1" value="500"></label>
          ${(['deposit', 'withdraw', 'borrow', 'repay'] as const).map((m) => `<button class="btn" data-act="bank" data-mode="${m}">${esc(L(`bank.${m}`))}</button>`).join('')}</div>`
          : `<p class="muted">${esc(L('bank.none', { balance: fmt(self.bank) }))}</p>${loan}`}</div>

      </div></div>`;
  }

}

/** A small number as the reader writes it: 0.5 in English, 0,5 in Russian. */
function num(n: number): string {
  return lang() === 'ru' ? String(n).replace('.', ',') : String(n);
}

/** A good and how much of it, the way a ledger reads: the picture, the name, × 30. */
function goodQty(good: GoodId, n: number): string {
  return `<span class="good-qty">${icon(`good_${good}`)}<span>${esc(GOODS[good].name)}&nbsp;×&nbsp;${n}</span></span>`;
}

/** How a landing is ordered here: the key it is bound to, or the button a touch screen shows. */
function landHow(): string {
  if (document.body.classList.contains('touch')) return L('rights.tap');
  const [k1, k2] = settings().keys.land;
  return L('rights.key', { key: keyLabel(k1 || k2) });
}

/** A contract's picture: sealed letters, a bounty poster, or the good to deliver. */
function contractArt(c: { kind: string; good?: string }): string {
  return c.kind === 'bounty' ? 'wanted' : c.kind === 'delivery' && c.good ? `good_${c.good}` : 'map_contract';
}

/** A hull's levels (canon D12): ⚓3–5, the first she comes at and the last a refit takes her to. */
function levelSpan(classId: ShipClassId): string {
  const [lo, hi] = levelRange(classId);
  return lo === hi ? `⚓${lo}` : `⚓${lo}–${hi}`;
}

/** The yard's refit card (canon D12): her level, the next one's gain and price, the materials had and wanted. */
function refitCard(r: RefitView, name: string): string {
  const head = `<h4 class="card-h">${icon('good_timber', '', 'ico-md')}${esc(L('refit.title'))} ${ownLevelChip(r.level)}</h4><p class="muted refit-level">${esc(L('refit.level', { name: placeName(name), n: r.level, max: r.max }))}</p>`;
  if (r.busy) {
    return `<div class="card refit">${head}<p class="refit-busy">${esc(L('refit.busy', { n: r.busy.to, m: Math.max(1, Math.ceil(r.busy.left / 60)) }))}</p></div>`;
  }
  if (!r.next) return `<div class="card refit">${head}<p class="muted">${esc(L('refit.top'))}</p></div>`;
  const n = r.next;
  const goods = n.goods.map((g) => `<span class="refit-good${g.have < g.qty ? ' short' : ''}">${icon(`good_${g.good}`, '', 'ico-sm')}${esc(GOODS[g.good].name)} <b>${Math.min(g.have, g.qty)}/${g.qty}</b></span>`).join('');
  return `<div class="card refit">${head}
    <p>${esc(L('refit.gain', { n: n.to }))}</p>
    <div class="refit-goods">${goods}</div>
    <p class="muted refit-note">${esc(L('refit.captain', { n: n.captain }))} · ${esc(L('refit.time', { m: Math.max(1, Math.ceil(n.sec / 60)) }))}</p>
    <p class="muted refit-note">${esc(L('refit.hint'))}</p>
    ${r.blocked ? `<p class="refit-why">${esc(serverText(r.blocked))}</p>` : ''}
    <button class="btn btn-primary" data-act="refit" ${r.blocked ? 'disabled' : ''}>${esc(L('refit.go', { n: n.to }))} — ${money(n.silver)}</button></div>`;
}

/** The board of the wanted (docs/12 P5): a poster for each named pirate of these waters, the baron on top. */
function wantedBoardHtml(list: WantedPoster[]): string {
  if (!list.length) return `<div class="card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${esc(L('wanted.board'))}</h4><p class="muted">${esc(L('wanted.none'))}</p></div>`;
  const ru = lang() === 'ru' ? 1 : 0;
  const roster = new Map(namedPirates().map((p) => [p.id, p]));
  const posters = list.map((w) => {
    const np = roster.get(w.id);
    const name = np ? np.name[ru] : w.name;
    const ship = np ? np.ship[ru] : w.ship;
    const where = w.seen ? (w.atSea && w.seen.ago <= 1 ? L('wanted.seenNow', { region: REGIONS[w.seen.region].name }) : L('wanted.seen', { ago: w.seen.ago, region: REGIONS[w.seen.region].name })) : L('wanted.unseen');
    const habits = [L(`wanted.time.${w.time}` as 'wanted.time.any'), L(`wanted.weather.${w.weather}` as 'wanted.weather.any'), L(`wanted.trick.${w.trick}` as 'wanted.trick.fog'), L(`wanted.temper.${w.temper}` as 'wanted.temper.coward')].filter(Boolean).join(' · ');
    return `<div class="poster${w.down ? ' po-down' : ''}${w.baron ? ' po-baron' : ''}">
      <div class="po-head">${esc(w.baron ? L('wanted.baron') : L('wanted.head'))}</div>
      <div class="po-face" style="filter: sepia(0.55) hue-rotate(${w.hue}deg) saturate(0.8)">${icon(`portrait.${w.portrait}`, '', 'po-img')}</div>
      <b class="po-name">${esc(name)}</b>
      <div class="po-ship">«${esc(ship)}» · ⚓${w.level}</div>
      <div class="po-bounty">${esc(L('wanted.bounty', { n: w.bounty.toLocaleString(ru ? 'ru-RU' : 'en-GB') }))}</div>
      <div class="po-seen muted">${esc(w.down ? L('wanted.down') : where)}</div>
      <div class="po-habits muted">${esc(habits)}</div>
      ${w.lair ? `<div class="po-lair muted">${esc(L('wanted.lair', { island: placeName(w.lair) }))}</div>` : ''}
      <button class="btn btn-small" data-act="informant" data-id="${esc(w.id)}" ${w.atSea && !w.down ? '' : 'disabled'}>${esc(L('wanted.informant', { cost: w.informant }))}</button>
    </div>`;
  }).join('');
  return `<div class="card wanted-card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${esc(L('wanted.board'))}</h4><p class="muted">${esc(L('wanted.hint'))}</p><div class="wanted-grid">${posters}</div></div>`;
}
