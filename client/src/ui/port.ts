// Port screen: Market, Chandlery, Shipyard, Tavern, Contracts, Harbour Master.

import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { AMMO, AMMO_IDS, GUNS, MODULES, MOUNTS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { MountId, ShipClassId } from '../../../shared/src/data/ships.ts';
import type { ClientMsg, PortView } from '../../../shared/src/protocol.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt } from './dom.ts';

type Tab = 'market' | 'shipyard' | 'tavern' | 'contracts' | 'harbour';

export class PortScreen {
  tab: Tab = 'market';
  qty = 1;
  private send: (m: ClientMsg) => void;
  private onClose: () => void;
  constructor(send: (m: ClientMsg) => void, onClose: () => void) {
    this.send = send;
    this.onClose = onClose;
  }

  render(root: HTMLElement, state: ClientState): void {
    const view = state.portView;
    const self = state.self;
    if (!view || !self) return;
    const port = state.ports.find((p) => p.id === view.portId)!;
    const faction = FACTIONS[port.faction];
    const tabs: [Tab, string][] = [['market', 'Market'], ['shipyard', 'Shipyard'], ['tavern', 'Tavern'], ['contracts', 'Contracts'], ['harbour', 'Harbour Master']];
    const vol = cargoVolume(self.cargo, state.ownStats?.contrabandVolumeMul ?? 1);
    root.innerHTML = `
      <div class="modal-head">
        <div><h2>${esc(port.name)}</h2><div class="sub">${esc(faction.name)} · ${esc(REGIONS[port.region].name)} — ${esc(port.description)}</div></div>
        <div style="text-align:right"><div class="gold" style="font-size:18px">${fmt(self.gold)} silver</div><div class="muted">Hold ${vol.toFixed(0)} / ${(state.ownStats?.holdVolume ?? 0).toFixed(0)} · crew ${self.crew}</div>
        <button class="btn btn-primary" data-act="undock" style="margin-top:6px">Set sail [F]</button></div>
      </div>
      <div class="tabs">${tabs.map(([id, n]) => `<div class="tab ${this.tab === id ? 'active' : ''}" data-tab="${id}">${n}</div>`).join('')}</div>
      <div class="modal-body">${this.body(view, state)}</div>`;
    root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => (el.onclick = () => {
      this.tab = el.dataset.tab as Tab;
      this.render(root, state);
    }));
    root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => (el.onclick = () => this.act(el.dataset, root, state)));
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
        return this.send({ t: 'hire_crew', qty: Number(d.n) });
      case 'repair':
        return this.send({ t: 'shipyard', action: 'repair' });
      case 'module':
        return this.send({ t: 'shipyard', action: 'module', module: d.module as never });
      case 'gun':
        return this.send({ t: 'shipyard', action: 'guns', side: d.side as never, gun: d.gun as never });
      case 'mount':
        return this.send({ t: 'shipyard', action: 'mount', mount: d.mount as MountId });
      case 'ship':
        if (confirm(`Trade in your ship for a ${SHIP_CLASSES[d.cls as ShipClassId].name}?`)) this.send({ t: 'shipyard', action: 'buy_ship', classId: d.cls as ShipClassId });
        return;
      case 'contract':
        return this.send({ t: 'contract', action: d.mode as never, id: d.id! });
      case 'pardon':
        return this.send({ t: 'pardon' });
      case 'chart_sell':
        return this.send({ t: 'chart', action: 'sell' });
      case 'chart_buy':
        return this.send({ t: 'chart', action: 'buy', region: d.region as RegionId });
      case 'insure':
        return this.send({ t: 'insure' });
      case 'licence':
        return this.send({ t: 'licence' });
      case 'cleanse':
        return this.send({ t: 'cleanse' });
      case 'respec':
        if (confirm('Forget every talent for a fee?')) this.send({ t: 'respec' });
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
    }
  }

  private market(view: PortView, state: ClientState): string {
    const self = state.self!;
    const qtys = [1, 5, 10, 25, 50];
    const rows = view.market.map((r) => {
      const g = GOODS[r.good];
      const have = Math.floor(self.cargo[r.good] ?? 0);
      const stolen = Math.min(have, self.stolen[r.good] ?? 0);
      const trend = r.trend > 0.03 ? `<span class="up">▲</span>` : r.trend < -0.03 ? `<span class="down">▼</span>` : '<span class="muted">·</span>';
      return `<tr>
        <td><b class="${r.legal ? '' : 'contra'}">${esc(g.name)}</b>${r.legal ? '' : ' <span class="contra">contraband</span>'}${g.spoilPerHour ? ' <span class="muted">perishable</span>' : ''}${g.danger > 0.3 ? ' <span class="up">dangerous</span>' : ''}</td>
        <td>${r.stock}</td><td class="gold">${r.buy}</td><td>${r.sell}</td><td>${trend}</td><td class="muted">${g.weight}t · ${g.volume}v</td><td>${have || ''}${stolen ? ` <span class="up" title="Plundered: customs may seize it; fences pay 15% less">(${stolen} stolen)</span>` : ''}</td>
        <td><button class="btn btn-small" data-act="buy" data-good="${r.good}">Buy</button>
            <button class="btn btn-small" data-act="sell" data-good="${r.good}" ${have ? '' : 'disabled'}>Sell</button>
            <button class="btn btn-small" data-act="sellall" data-good="${r.good}" ${have ? '' : 'disabled'}>All</button></td></tr>`;
    }).join('');
    const intel = view.priceIntel?.length
      ? `<h3 class="title-sm" style="font-size:20px;margin-top:16px">Market Sense — best known prices elsewhere</h3><table class="grid"><tr><th>Good</th><th>Port</th><th>Sells for</th><th>Age</th></tr>${view.priceIntel.slice(0, 12).map((i) => `<tr><td>${esc(GOODS[i.good].name)}</td><td>${esc(i.name)}</td><td class="gold">${i.sell}</td><td class="muted">${Math.round(i.ageSec / 60)} min</td></tr>`).join('')}</table>`
      : '';
    const ammo = AMMO_IDS.map((a) => `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><div><b>${esc(AMMO[a].name)}</b> <span class="muted">${esc(AMMO[a].description)}</span><br><span class="muted">In hold: ${self.ammo[a]} · ${view.ammoPrices[a]} each</span></div>
      <div>${[20, 50].map((n) => `<button class="btn btn-small" data-act="ammo" data-ammo="${a}" data-n="${n}">+${n} (${Math.ceil(view.ammoPrices[a] * n)})</button>`).join(' ')}</div></div>`).join('');
    const portDef = state.ports.find((p) => p.id === view.portId)!;
    return `<div class="row" style="margin-bottom:8px"><span class="muted">Prices move with every trade. Goods reach this port only when a ship carries them here.
      ${view.duty ? `Import duty <b>${Math.round(view.duty * 100)}%</b> on sales (licence waives it).` : ''} ${portDef.blackMarket ? 'Black market: fences buy plunder (−15%).' : ''}</span>
      <label class="lbl">Qty <select data-qty class="btn">${qtys.map((q) => `<option ${q === this.qty ? 'selected' : ''}>${q}</option>`).join('')}</select></label></div>
      <table class="grid"><tr><th>Good</th><th>Stock</th><th>Buy</th><th>Sell</th><th></th><th>Per unit</th><th>Hold</th><th></th></tr>${rows}</table>
      <h3 class="title-sm" style="font-size:20px;margin-top:16px">Chandlery — shot & powder</h3>${ammo}${intel}`;
  }

  private shipyard(view: PortView, state: ClientState): string {
    const self = state.self!;
    const sy = view.shipyard;
    const cur = SHIP_CLASSES[self.loadout.classId];
    const modules = sy.modules.map((m) => {
      const def = MODULES[m.module];
      const maxed = m.level >= m.max;
      return `<div class="card"><h4>${esc(def.name)} <span class="muted">${m.level}/${m.max}</span></h4><p>${esc(def.description)}</p>
        <button class="btn btn-small" data-act="module" data-module="${m.module}" ${maxed ? 'disabled' : ''}>${maxed ? 'Fully fitted' : `Fit level ${m.level + 1} — ${fmt(m.cost)}`}</button></div>`;
    }).join('');
    const guns = (['port', 'starboard'] as const).map((side) => `<div class="card"><h4>${side === 'port' ? 'Port' : 'Starboard'} battery — ${cur.gunPortsPerSide} × ${esc(GUNS[self.loadout.guns[side]].name)}</h4>
      ${sy.guns.map((gdef) => {
        const g = GUNS[gdef.gun];
        const mounted = self.loadout.guns[side] === gdef.gun;
        return `<div class="row" style="padding:3px 0"><span>${esc(g.name)} <span class="muted">dmg ${g.damage} · ${g.range}m · ${g.reload}s</span></span><button class="btn btn-small" data-act="gun" data-side="${side}" data-gun="${gdef.gun}" ${mounted ? 'disabled' : ''}>${mounted ? 'Mounted' : fmt(gdef.cost)}</button></div>`;
      }).join('')}</div>`).join('');
    const ships = sy.ships.map((s) => {
      const c = SHIP_CLASSES[s.classId];
      const net = Math.max(0, s.price - s.tradeIn);
      return `<tr><td><b>${esc(c.name)}</b> <span class="muted">T${c.tier} · ${esc(c.role)}</span></td><td>${c.hull}</td><td>${c.maxSpeed}</td><td>${c.gunPortsPerSide}×2</td><td>${c.holdVolume}</td><td>${c.crewMin}–${c.crewMax}</td>
        <td><button class="btn btn-small" data-act="ship" data-cls="${s.classId}" ${s.classId === self.loadout.classId ? 'disabled' : ''}>${s.classId === self.loadout.classId ? 'Yours' : fmt(net)}</button></td></tr>`;
    }).join('');
    return `<div class="cols"><div>
        <div class="card"><h4>Repairs</h4><p>Hull ${state.you?.hull ?? 0}/${state.you?.hullMax ?? 0}, sails ${state.you?.sails ?? 0}/${state.you?.sailsMax ?? 0}, dismounted guns ${self.gunsDisabled.port + self.gunsDisabled.starboard}.</p>
        <button class="btn btn-primary" data-act="repair" ${sy.repairCost ? '' : 'disabled'}>${sy.repairCost ? `Full repair — ${fmt(sy.repairCost)}` : 'She is sound'}</button></div>
        ${guns}</div><div>
        <div class="card"><h4>Deck mount (right mouse)</h4>${sy.mounts.map((m) => {
          const def = MOUNTS[m.mount];
          const fitted = self.loadout.mount === m.mount;
          return `<div style="padding:4px 0"><div class="row"><b>${esc(def.name)}</b><button class="btn btn-small" data-act="mount" data-mount="${m.mount}" ${fitted ? 'disabled' : ''}>${fitted ? 'Fitted' : fmt(m.cost)}</button></div><span class="muted">${esc(def.description)}</span></div>`;
        }).join('') || '<p class="muted">No mounts for this hull here.</p>'}</div>
        ${modules}</div></div>
      <h3 class="title-sm" style="font-size:20px;margin-top:10px">New hulls (trade-in applied)</h3>
      <table class="grid"><tr><th>Class</th><th>Hull</th><th>Speed</th><th>Guns</th><th>Hold</th><th>Crew</th><th></th></tr>${ships}</table>
      <p class="muted">Tier ${sy.tier} yard. Bigger is not better: a galleon hauls a fortune but a sloop will run circles around her.</p>`;
  }

  private tavern(view: PortView, state: ClientState): string {
    const self = state.self!;
    const port = state.ports.find((p) => p.id === view.portId)!;
    const room = (state.you?.crewMax ?? 0) - self.crew;
    return `<div class="cols"><div class="card"><h4>Sailors looking for a berth: ${view.crewAvailable}</h4>
        <p>Signing bounty ${view.crewHireCost} silver each. Fresh hands lower morale a little until they find their feet. You have room for ${room}.</p>
        ${[1, 5, 10, 25].map((n) => `<button class="btn btn-small" data-act="crew" data-n="${n}">Hire ${n} (${fmt(n * view.crewHireCost)})</button>`).join(' ')}
        <button class="btn btn-small btn-danger" data-act="crew" data-n="-5">Discharge 5</button></div>
      <div class="card"><h4>Rumours over rum</h4>${view.rumors.map((r) => `<p>“${esc(r)}”</p>`).join('')}</div></div>
      <div class="card"><h4>The cartographer</h4>
        <p>Knowledge is cargo too. The cartographer copies your charts of islands this port does not know yet${port.faction === 'brokers' ? ' — and the Fog Brokers pay a premium for it' : ''}, and sells charts of nearby waters. Bought charts show islands but earn no discovery experience.</p>
        <div class="row"><span>${view.charts.sellable} island${view.charts.sellable === 1 ? '' : 's'} they have not seen from you</span>
          <button class="btn btn-small btn-primary" data-act="chart_sell" ${view.charts.sellable ? '' : 'disabled'}>Sell copies — ${fmt(view.charts.sellValue)}</button></div>
        ${view.charts.offers.map((o) => `<div class="row" style="padding:3px 0"><span>${esc(o.name)} <span class="muted">(${o.islands} uncharted islands)</span></span>
          <button class="btn btn-small" data-act="chart_buy" data-region="${o.region}">Buy — ${fmt(o.price)}</button></div>`).join('') || '<p class="muted">No charts to sell you.</p>'}
      </div>`;
  }

  private contracts(view: PortView, state: ClientState): string {
    const self = state.self!;
    const port = (id?: string) => state.ports.find((p) => p.id === id)?.name ?? '';
    const mine = self.contracts.map((c) => `<div class="card"><h4>${esc(c.title)}</h4><p>${esc(c.description)}</p>
      <div class="row"><span class="gold">${fmt(c.reward)} silver · ${c.xp} XP</span>${c.kind === 'bounty' ? `<span>${c.progress ?? 0}/${c.kills}</span>` : `<span class="muted">to ${esc(port(c.toPort))}</span>`}
      <button class="btn btn-small btn-danger" data-act="contract" data-mode="abandon" data-id="${c.id}">Abandon</button></div></div>`).join('') || '<p class="muted">No contracts in hand.</p>';
    const offered = view.contracts.map((c) => `<div class="card"><h4>${esc(c.title)}</h4><p>${esc(c.description)}</p>
      <div class="row"><span class="gold">${fmt(c.reward)} silver · ${c.xp} XP</span><button class="btn btn-small btn-primary" data-act="contract" data-mode="accept" data-id="${c.id}">Accept</button></div></div>`).join('') || '<p class="muted">The board is empty. Come back later.</p>';
    return `<div class="cols"><div><h3 class="title-sm" style="font-size:20px">Posted here</h3>${offered}</div><div><h3 class="title-sm" style="font-size:20px">Your contracts (max 3)</h3>${mine}</div></div>`;
  }

  private harbour(view: PortView, state: ClientState): string {
    const self = state.self!;
    const port = state.ports.find((p) => p.id === view.portId)!;
    const reps = Object.entries(self.reputation).map(([f, v]) => `<tr><td>${esc(FACTIONS[f as never as keyof typeof FACTIONS].name)}</td><td class="${(v ?? 0) < 0 ? 'up' : 'down'}">${v}</td></tr>`).join('');
    return `<div class="cols"><div>
        <div class="card"><h4>Letters of pardon</h4>${view.pardonCost !== null ? `<p>Infamy ${self.infamy}. The Fog Brokers can make your name… quieter.</p><button class="btn" data-act="pardon" ${self.infamy >= 20 ? '' : 'disabled'}>Buy pardon — ${fmt(view.pardonCost)}</button>` : '<p class="muted">Lawful harbours do not sell forgeries. Try a free port, Fogmouth or Cinderhold.</p>'}</div>
        ${view.licence ? `<div class="card"><h4>Trade licence</h4><p>Waives the ${Math.round((view.licence.until > state.estServerTime() ? 0 : view.duty) * 100) || ''}${view.licence.until > state.estServerTime() ? 'duty (active)' : '% import duty'} in every ${esc(FACTIONS[port.faction].short)} port and trims buying prices by 3% for two hours. Void while you are wanted (Wanted 2+).</p>
          ${view.licence.until > state.estServerTime() ? `<p class="good">Licensed for ${Math.round((view.licence.until - state.estServerTime()) / 60)} more minutes.</p>` : ''}
          <button class="btn" data-act="licence">Buy / extend — ${fmt(view.licence.cost)}</button></div>` : ''}
        <div class="card"><h4>Voyage insurance</h4><p>${port.faction === 'league' || port.faction === 'free' ? 'The Gilded Ledger will insure hull and half your cargo value until you next make port.' : 'Only League and free ports write policies.'}</p>
          <button class="btn" data-act="insure" ${self.insured ? 'disabled' : ''}>${self.insured ? 'Insured' : 'Buy policy'}</button></div>
        <div class="card"><h4>Scrape & bless the hull</h4><p>Curse ${self.curse}/100${self.curse >= 25 ? ` — stage ${self.curse >= 80 ? 3 : self.curse >= 50 ? 2 : 1}` : ''}. ${['harpoon', 'crown', 'league'].includes(port.faction) ? 'The chaplain and the yard crew will scrape the growth away.' : 'No one here will touch a cursed hull.'}</p>
          <button class="btn" data-act="cleanse" ${self.curse >= 2 && ['harpoon', 'crown', 'league'].includes(port.faction) ? '' : 'disabled'}>Cleanse — ${fmt(Math.round(self.curse * 8 * (0.6 + SHIP_CLASSES[self.loadout.classId].tier * 0.4)))}</button></div>
        <div class="card"><h4>Retrain</h4><p>Forget all talents (${fmt(60 * self.level)} silver).</p><button class="btn btn-danger" data-act="respec">Respec</button></div>
      </div><div class="card"><h4>Standing</h4><table class="grid">${reps}</table>
      <p class="muted" style="margin-top:8px">Sunk ${self.stats.sunk} · taken ${self.stats.boarded} · trade profit ${fmt(self.stats.tradeProfit)} · ${fmt(self.stats.distance / 1000)} km sailed · ${self.discoveredCount} islands charted</p></div></div>`;
  }
}
