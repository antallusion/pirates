// The Company & Letters screen (Y): your group and the convoy signal, hails to trade, letters from the
// packet boat, and — in port — the captains' market board (and Tidewrack's trophy auction).
// Plus the barter table, opened when two captains agree to trade.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { GOODS, GOOD_IDS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { BUILDINGS, BUILDING_IDS } from '../../../shared/src/data/holdings.ts';
import type { BuildingId } from '../../../shared/src/data/holdings.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { WOODS } from '../../../shared/src/data/shipbuild.ts';
import type { WoodId } from '../../../shared/src/data/shipbuild.ts';
import { GROUP_MAX } from '../../../shared/src/protocol.ts';
import type { GuildRank, HoldingView, IslandOffer, SiegeView } from '../../../shared/src/protocol.ts';
import type { ClientMsg, ListingView } from '../../../shared/src/protocol.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt } from './dom.ts';

export type CompanyTab = 'group' | 'guild' | 'letters' | 'market' | 'law' | 'isles';

const ago = (ms: number) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const left = (ms: number) => {
  const m = Math.max(0, Math.round((ms - Date.now()) / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const goodOptions = (have?: Cargo) =>
  GOOD_IDS.filter((g) => !have || (have[g] ?? 0) > 0).map((g) => `<option value="${g}">${esc(GOODS[g].name)}${have ? ` (${have[g]})` : ''}</option>`).join('');

const RANK_ORDER: GuildRank[] = ['admiral', 'vice', 'commodore', 'captain', 'bosun', 'sailor', 'cabin_boy'];
const RANK_NAMES: Record<GuildRank, string> = { admiral: 'Admiral', vice: 'Vice-Admiral', commodore: 'Commodore', captain: 'Captain', bosun: 'Bosun', sailor: 'Sailor', cabin_boy: 'Cabin Boy' };
const BASE_NAMES = ['', 'Anchorage', 'Outpost', 'Fortress', 'Citadel', 'Stronghold'];

export class CompanyScreen {
  tab: CompanyTab = 'group';
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  open(tab?: CompanyTab): void {
    if (tab) this.tab = tab;
    this.send({ t: 'mail', action: 'list' });
  }

  render(root: HTMLElement, state: ClientState): void {
    const docked = state.self?.dockedAt ?? null;
    if (this.tab === 'market' && !docked) this.tab = 'group';
    const tabs = (['group', 'guild', 'law', 'letters', 'isles', 'market'] as CompanyTab[])
      .filter((t) => t !== 'market' || docked)
      .map((t) => `<button class="btn btn-small ${this.tab === t ? 'btn-primary' : ''}" data-tab="${t}">${t === 'group' ? 'Group' : t === 'law' ? `Colours &amp; Law${state.self?.pvp.challenges.length ? ' (!)' : ''}` : t === 'isles' ? 'Islands' : t === 'guild' ? `${state.guild ? `Guild [${esc(state.guild.tag)}]` : 'Guild'}${state.guildInvites.length ? ' (!)' : ''}` : t === 'letters' ? `Letters${state.unread ? ` (${state.unread})` : ''}` : state.market?.auction ? 'Market & Auction' : 'Market board'}</button>`)
      .join(' ');
    root.innerHTML = `<div class="modal-head"><div><h2>Company &amp; Letters</h2><div class="sub">${tabs}</div></div><div class="muted">[Y] close</div></div>
      <div class="modal-body" id="company-body"></div>`;
    const body = root.querySelector<HTMLElement>('#company-body')!;
    if (this.tab === 'group') this.renderGroup(body, state);
    else if (this.tab === 'letters') this.renderLetters(body, state);
    else if (this.tab === 'law') this.renderLaw(body, state);
    else if (this.tab === 'isles') this.renderIsles(body, state);
    else if (this.tab === 'guild') this.renderGuild(body, state);
    else this.renderMarket(body, state);
    root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => (el.onclick = () => {
      this.tab = el.dataset.tab as CompanyTab;
      if (this.tab === 'market') this.send({ t: 'market', action: 'list' });
      if (this.tab === 'letters') this.send({ t: 'mail', action: 'list' });
      if (this.tab === 'law') this.send({ t: 'pvp', action: 'bounties' });
      if (this.tab === 'isles') this.send({ t: 'isle', action: 'list' });
      if (this.tab === 'guild') this.send({ t: 'guild', action: 'view' });
      this.render(root, state);
    }));
  }

  private renderGroup(body: HTMLElement, state: ClientState): void {
    const g = state.party;
    const me = state.self ? (g?.members.find((m) => m.name === state.self!.name)?.accountId ?? -1) : -1;
    const lead = g ? g.leader === me : true;
    body.innerHTML = `<div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">${g ? `Your group (${g.members.length}/${GROUP_MAX})` : 'You sail alone'}</h3>
      ${g ? g.members.map((m) => `<div class="card"><h4>${m.accountId === g.leader ? '⚑ ' : ''}${esc(m.name)} <span class="muted">— ${esc(CAPTAINS[m.captain]?.name ?? m.captain)}, level ${m.level}</span></h4>
        <div class="row"><span class="muted">${!m.online ? 'ashore (away)' : m.docked ? `in ${esc(state.ports.find((p) => p.id === m.docked)?.name ?? m.docked)}` : `at sea · hull ${Math.round(m.hull * 100)}%`}${m.inConvoy ? ' · <b>in station</b>' : ''}</span>
        ${lead && m.accountId !== me ? `<span><button class="btn btn-small" data-lead="${esc(m.name)}">Give the lead</button> <button class="btn btn-small btn-danger" data-kick="${esc(m.name)}">Put ashore</button></span>` : ''}</div></div>`).join('') : '<p class="muted">A group shares its map and a chat channel (type /g in chat), takes the first 30 s on the wreck of a ship any of them sank, shares a part of the glory, and cannot fire on its own. Up to eight captains.</p>'}
      ${g && lead ? `<div class="card"><h4>Convoy signal</h4><p class="muted">Ships within 1,500 m of the leader keep station: they sail at the slowest one's speed ×1.05, see 30% farther and pay 30% less for League insurance.</p>
        <button class="btn ${g.convoy ? 'btn-primary' : ''}" id="convoy">${g.convoy ? 'Haul down the convoy signal' : 'Hoist the convoy signal'}</button></div>` : g?.convoy ? '<p class="muted">The convoy signal is flying: keep within 1,500 m of the leader.</p>' : ''}
      ${g ? '<button class="btn btn-danger" id="leave">Leave the group</button>' : ''}
    </div><div>
      ${lead ? `<div class="card"><h4>Invite a captain</h4><div class="row"><input id="inv-name" placeholder="Captain's name" maxlength="20" style="flex:1"><button class="btn" id="invite">Invite</button></div></div>` : ''}
      <div class="card"><h4>Trade with a captain</h4><p class="muted">In the same port, or hove-to within 120 m at sea (the goods cross by boat).</p>
        <div class="row"><input id="bar-name" placeholder="Captain's name" maxlength="20" style="flex:1"><button class="btn" id="hail">Hail to trade</button></div></div>
      ${state.invites.map((i) => `<div class="card"><h4>${esc(i.from)} asks you to sail with them</h4><button class="btn btn-primary" data-accept="${i.id}">Join</button> <button class="btn" data-decline="${i.id}">Decline</button></div>`).join('')}
    </div></div>`;
    const val = (id: string) => body.querySelector<HTMLInputElement>(id)?.value.trim() ?? '';
    body.querySelector<HTMLElement>('#invite')?.addEventListener('click', () => val('#inv-name') && this.send({ t: 'group', action: 'invite', name: val('#inv-name') }));
    body.querySelector<HTMLElement>('#hail')?.addEventListener('click', () => val('#bar-name') && this.send({ t: 'barter', action: 'propose', name: val('#bar-name') }));
    body.querySelector<HTMLElement>('#convoy')?.addEventListener('click', () => this.send({ t: 'group', action: 'convoy', on: !g?.convoy }));
    body.querySelector<HTMLElement>('#leave')?.addEventListener('click', () => this.send({ t: 'group', action: 'leave' }));
    body.querySelectorAll<HTMLElement>('[data-accept]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'accept', id: Number(el.dataset.accept) })));
    body.querySelectorAll<HTMLElement>('[data-decline]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'decline', id: Number(el.dataset.decline) })));
    body.querySelectorAll<HTMLElement>('[data-lead]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'lead', name: el.dataset.lead! })));
    body.querySelectorAll<HTMLElement>('[data-kick]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'kick', name: el.dataset.kick! })));
  }

  private renderIsles(body: HTMLElement, state: ClientState): void {
    const hs = state.holdings;
    const self = state.self;
    const guildLease = !!state.guild && ['admiral', 'vice'].includes(state.guild.rank);
    const offer = (o: IslandOffer) => `<div class="card"><h4>${esc(o.name)} <span class="muted">— ${o.size}, ${o.slots} slots, ${esc(o.biome)}${o.mine ? ', ore' : ''}</span></h4>
      ${o.held ? `<p class="muted">Leased to ${esc(o.held)}.${!hs.mine.some((h) => h.island === o.island) && !hs.sieges.some((x) => x.island === o.island) ? ` <button class="btn btn-small btn-danger" data-siege="${o.island}" title="Contested: at a harbour office in its waters, 15% of a week's rent (min 10 000). Lawless: the Black Mark at a Confederacy port, 25 000.">Declare a siege</button>` : ''}</p>` : o.why ? `<p class="muted">${esc(o.why)}</p>` : `<div class="row" style="gap:6px">${([7, 14, 30] as const).map((d) => `<button class="btn btn-small" data-rent="${o.island}" data-days="${d}">${d} days — ${fmt(o.price[d])}</button>`).join('')}</div>
        ${guildLease ? `<div class="row" style="gap:6px"><span class="muted">For the guild:</span>${([7, 14, 30] as const).map((d) => `<button class="btn btn-small" data-glease="${o.island}" data-days="${d}">${d} days</button>`).join('')}</div>` : ''}`}</div>`;
    const here = hs.here && !hs.mine.some((h) => h.island === hs.here!.island) ? offer(hs.here) : '';
    const nearId = hs.here?.island ?? -1;
    const holding = (h: HoldingView) => {
      const near = h.island === nearId;
      const used = h.buildings.reduce((n, b) => n + BUILDINGS[b.id].slots, 0);
      const days = Math.max(0, (h.until - Date.now()) / 86_400_000);
      const has = (id: BuildingId) => h.buildings.some((b) => b.id === id);
      const yardTier = has('dry_dock') ? 4 : has('shipyard') ? 3 : 0;
      const builds = (self?.builds ?? []).filter((b) => b.port === `isle:${h.island}`);
      const berths = (self?.berths ?? []).map((b, i) => ({ b, i })).filter((x) => x.b.port === `isle:${h.island}`);
      return `<div class="card"><h4>${esc(h.name)} <span class="muted">— ${esc(h.region.replace(/_/g, ' '))}, ${h.size}, ${used}/${h.slots} slots${h.guild ? ` · guild ${h.base ? BASE_NAMES[h.base] : 'island'}` : ''}</span></h4>
        <p>Lease: <b>${days >= 1 ? `${Math.floor(days)} days` : days > 0 ? `${Math.ceil(days * 24)} hours` : '<span class="bad">run out — renew within 72 h</span>'}</b> · a week ${fmt(h.renew)} · <label><input type="checkbox" data-auto="${h.island}" ${h.autoRenew ? 'checked' : ''}> renew from the treasury</label></p>
        <p>Treasury <b>${fmt(h.treasury)}</b> · upkeep ${fmt(h.upkeep)} a day · <input type="number" value="1000" step="500" style="width:90px" data-tamt="${h.island}"> <button class="btn btn-small" data-tin="${h.island}">Deposit</button> <button class="btn btn-small" data-tout="${h.island}">Withdraw</button></p>
        <table class="grid">${h.buildings.map((b, i) => `<tr><td>${esc(BUILDINGS[b.id].name)}</td><td class="${b.unpaid ? 'bad' : 'muted'}">${Math.round(b.condition * 100)}%${b.unpaid ? ' · unpaid' : ''}</td><td>${near ? `<button class="btn btn-small btn-danger" data-demolish="${h.island}" data-index="${i}">Pull down</button>` : ''}</td></tr>`).join('') || '<tr><td class="muted">Bare rock.</td></tr>'}</table>
        <p class="muted">Store (${h.storeCap} m³): ${Object.entries(h.store).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => `${n} ${esc(GOODS[g as GoodId].name)}`).join(', ') || 'empty'}</p>
        ${near ? `<div class="row"><select data-sgood="${h.island}">${GOOD_IDS.map((g) => `<option value="${g}">${esc(GOODS[g].name)}</option>`).join('')}</select><input type="number" value="10" style="width:70px" data-sqty="${h.island}"><button class="btn btn-small" data-sin="${h.island}">Land it</button><button class="btn btn-small" data-sout="${h.island}">Load it</button></div>
          <div class="row" style="gap:6px;flex-wrap:wrap">${has('shipyard') ? `<button class="btn btn-small" data-svc="repair" data-isl="${h.island}">Repair</button>` : ''}${has('tavern') ? `<button class="btn btn-small" data-svc="hire" data-isl="${h.island}" data-arg="5">Sign on 5 hands</button>` : ''}${has('workshop') ? `<button class="btn btn-small" data-svc="craft" data-isl="${h.island}" data-arg="planks">Timber → planks</button><button class="btn btn-small" data-svc="craft" data-isl="${h.island}" data-arg="sailcloth">Cloth → sailcloth</button>` : ''}${has('chart_house') ? (self?.maps ?? []).map((m) => `<button class="btn btn-small" data-svc="copy_map" data-isl="${h.island}" data-arg="${esc(m.id)}">Copy ${esc(m.name)}</button>`).join('') : ''}</div>
          <details><summary>Build</summary>${BUILDING_IDS.map((id) => {
            const d = BUILDINGS[id];
            const mats = Object.entries(d.materials).map(([g, n]) => `${n} ${GOODS[g as GoodId].name.toLowerCase()}`).join(', ');
            return `<div class="row" style="padding:2px 0"><span title="${esc(d.description)}"><b>${esc(d.name)}</b> <span class="muted">${d.slots} slot${d.slots > 1 ? 's' : ''} · ${fmt(d.cost)}${mats ? ` + ${esc(mats)}` : ''} · ${fmt(d.upkeep)}/day</span></span><button class="btn btn-small" data-build="${h.island}" data-bid="${id}">Build</button></div>`;
          }).join('')}</details>
          ${yardTier ? `<details><summary>The yard (to tier ${yardTier === 4 ? 'IV' : 'III'})</summary>
            <div class="row"><select data-ycls="${h.island}">${(Object.keys(SHIP_CLASSES) as ShipClassId[]).filter((c) => SHIP_CLASSES[c].purchasable && SHIP_CLASSES[c].tier <= yardTier && !SHIP_CLASSES[c].factions).map((c) => `<option value="${c}">${esc(SHIP_CLASSES[c].name)}</option>`).join('')}</select>
            <select data-ywood="${h.island}">${(Object.keys(WOODS) as WoodId[]).filter((w) => WOODS[w].ports === 'all').map((w) => `<option value="${w}">${esc(WOODS[w].name)}</option>`).join('')}</select>
            <input data-yname="${h.island}" placeholder="Her name" maxlength="28" style="width:130px"><button class="btn btn-small" data-yorder="${h.island}">Lay down the keel</button></div>
            ${builds.map((b) => `<p>${esc(b.name)} — ${b.done * 1 <= (state.estServerTime() ?? 0) ? `<button class="btn btn-small btn-primary" data-ylaunch="${h.island}" data-id="${esc(b.id)}">Launch</button>` : `ready in ${Math.ceil((b.done - state.estServerTime()) / 60)} min`}</p>`).join('')}
            ${berths.map(({ b, i }) => `<p>${esc(b.name)} <span class="muted">berthed here</span> <button class="btn btn-small" data-yberth="${h.island}" data-index="${i}">Take her out</button></p>`).join('')}</details>` : ''}
          <p class="muted">Siege window (UTC): <select data-window="${h.island}">${[16, 17, 18, 19, 20, 21, 22].map((hr) => `<option value="${hr}" ${hr === (h.windowNext ?? h.window) ? 'selected' : ''}>${hr}:00–${hr + 2}:00</option>`).join('')}</select>${h.windowNext !== null ? ' (changes in 48 h)' : ''}</p>`
        : '<p class="muted">Lie off the island to build, use the store and its services.</p>'}</div>`;
    };
    const when = (t: number) => `${new Date(t).toUTCString().slice(5, 22)} UTC`;
    const siege = (x: SiegeView) => `<div class="card"><h4 class="${x.attacking ? '' : 'bad'}">Siege of ${esc(x.name)} <span class="muted">— ${esc(x.attacker)} against ${esc(x.defender)}</span></h4>
      <p>${x.phase === 'notice' ? `Bombardment opens ${when(x.windowStart)} (two hours).` : x.phase === 'bombard' ? `<b>Bombardment</b> until ${when(x.windowEnd)}: silence the guns.` : x.phase === 'fortify' ? `The lull: the landing comes ${when(x.windowStart)}.` : x.phase === 'landing' ? `<b>The landing</b> until ${when(x.windowEnd)}: held ${x.capture}% of ten minutes.` : '<b>The island has fallen.</b>'}</p>
      <p class="muted">Batteries ${x.batteries.map((b) => `${b}%`).join(', ') || 'none'}${x.fort !== null ? ` · fort ${x.fort}%` : ''} · landing point ${x.landing.x}, ${x.landing.y}</p>
      ${x.phase === 'choose' && x.attacking ? `<div class="row" style="gap:6px"><button class="btn btn-small btn-primary" data-sgc="capture" data-isl="${x.island}">Capture it</button><button class="btn btn-small" data-sgc="plunder" data-isl="${x.island}">Plunder it</button><button class="btn btn-small btn-danger" data-sgc="raze" data-isl="${x.island}">Raze it</button></div>` : ''}
      ${x.phase === 'fortify' && !x.attacking ? `<button class="btn btn-small" data-fortify="${x.island}">Rebuild the guns (50 planks a battery, 200 the fort, from the store)</button>` : ''}
      ${x.notes.map((n) => `<p class="muted">${esc(n)}</p>`).join('')}</div>`;
    body.innerHTML = `<div class="cols"><div>
      ${hs.sieges.map(siege).join('')}
      <h3 class="title-sm" style="font-size:20px">Your islands</h3>
      ${hs.mine.map(holding).join('') || '<p class="muted">You hold no island. Lie off one to lease it, or ask at a harbour office for the islands of its waters. One island of your own; the lease is paid to the faction that holds the region.</p>'}
    </div><div>
      ${here ? `<h3 class="title-sm" style="font-size:20px">Off your bow</h3>${here}` : ''}
      ${hs.region.length ? `<h3 class="title-sm" style="font-size:20px">Islands of these waters</h3>${hs.region.map(offer).join('')}` : ''}
    </div></div>`;
    const q = <T extends HTMLElement>(sel: string) => body.querySelector<T>(sel);
    const num = (sel: string) => Number(q<HTMLInputElement>(sel)?.value ?? 0);
    body.querySelectorAll<HTMLElement>('[data-rent]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'rent', island: Number(el.dataset.rent), days: Number(el.dataset.days) })));
    body.querySelectorAll<HTMLElement>('[data-siege]').forEach((el) => (el.onclick = () => confirm('Declare a siege on this island?') && this.send({ t: 'isle', action: 'siege', island: Number(el.dataset.siege) })));
    body.querySelectorAll<HTMLElement>('[data-sgc]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'siege_choice', island: Number(el.dataset.isl), choice: el.dataset.sgc as 'capture' })));
    body.querySelectorAll<HTMLElement>('[data-fortify]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'fortify', island: Number(el.dataset.fortify) })));
    body.querySelectorAll<HTMLElement>('[data-glease]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'lease', island: Number(el.dataset.glease), days: Number(el.dataset.days) })));
    body.querySelectorAll<HTMLInputElement>('[data-auto]').forEach((el) => (el.onchange = () => this.send({ t: 'isle', action: 'auto', island: Number(el.dataset.auto), on: el.checked })));
    body.querySelectorAll<HTMLElement>('[data-tin]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'treasury', island: Number(el.dataset.tin), amount: num(`[data-tamt="${el.dataset.tin}"]`) })));
    body.querySelectorAll<HTMLElement>('[data-tout]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'treasury', island: Number(el.dataset.tout), amount: -num(`[data-tamt="${el.dataset.tout}"]`) })));
    body.querySelectorAll<HTMLElement>('[data-demolish]').forEach((el) => (el.onclick = () => confirm('Pull it down?') && this.send({ t: 'isle', action: 'demolish', island: Number(el.dataset.demolish), index: Number(el.dataset.index) })));
    body.querySelectorAll<HTMLElement>('[data-build]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'build', island: Number(el.dataset.build), building: el.dataset.bid as BuildingId })));
    const store = (id: string, sign: number) => this.send({ t: 'isle', action: 'store', island: Number(id), good: q<HTMLSelectElement>(`[data-sgood="${id}"]`)!.value as GoodId, qty: sign * num(`[data-sqty="${id}"]`) });
    body.querySelectorAll<HTMLElement>('[data-sin]').forEach((el) => (el.onclick = () => store(el.dataset.sin!, 1)));
    body.querySelectorAll<HTMLElement>('[data-sout]').forEach((el) => (el.onclick = () => store(el.dataset.sout!, -1)));
    body.querySelectorAll<HTMLElement>('[data-svc]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'service', island: Number(el.dataset.isl), what: el.dataset.svc as 'repair', arg: el.dataset.arg })));
    body.querySelectorAll<HTMLSelectElement>('[data-window]').forEach((el) => (el.onchange = () => this.send({ t: 'isle', action: 'window', island: Number(el.dataset.window), hour: Number(el.value) })));
    body.querySelectorAll<HTMLElement>('[data-yorder]').forEach((el) => (el.onclick = () => {
      const id = el.dataset.yorder!;
      const wood = q<HTMLSelectElement>(`[data-ywood="${id}"]`)!.value as WoodId;
      this.send({ t: 'isle', action: 'yard_order', island: Number(id), req: { classId: q<HTMLSelectElement>(`[data-ycls="${id}"]`)!.value as ShipClassId, name: q<HTMLInputElement>(`[data-yname="${id}"]`)!.value, frame: wood, plank: wood, rares: {} } });
    }));
    body.querySelectorAll<HTMLElement>('[data-ylaunch]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'yard_launch', island: Number(el.dataset.ylaunch), id: el.dataset.id! })));
    body.querySelectorAll<HTMLElement>('[data-yberth]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'yard_berth', island: Number(el.dataset.yberth), index: Number(el.dataset.index) })));
  }

  private renderGuild(body: HTMLElement, state: ClientState): void {
    const g = state.guild;
    const docked = state.self?.dockedAt ?? null;
    const portName = (id: string) => state.ports.find((p) => p.id === id)?.name ?? id;
    if (!g) {
      body.innerHTML = `<div class="cols"><div>
        ${state.guildInvites.map((i) => `<div class="card"><h4>${esc(i.by)} invites you into ${esc(i.name)} [${esc(i.tag)}]</h4><button class="btn btn-primary" data-gjoin="${i.id}">Join</button> <button class="btn" data-gno="${i.id}">Decline</button></div>`).join('') || '<p class="muted">No guild has asked for you.</p>'}
      </div><div>
        <div class="card"><h4>Found a guild</h4><p class="muted">Registered at any harbour office for ${fmt(10000)} silver. Up to 150 captains; alliances, wars, routes, islands and a flagship.</p>
          <input id="g-name" placeholder="Name (3–24 letters)" maxlength="24" style="width:100%;margin-bottom:6px">
          <div class="row"><input id="g-tag" placeholder="TAG" maxlength="4" style="width:80px;text-transform:uppercase"><button class="btn btn-primary" id="g-found" ${docked ? '' : 'disabled title="In port"'}>Found</button></div></div>
      </div></div>`;
      body.querySelector<HTMLElement>('#g-found')!.onclick = () => this.send({ t: 'guild', action: 'found', name: body.querySelector<HTMLInputElement>('#g-name')!.value, tag: body.querySelector<HTMLInputElement>('#g-tag')!.value });
      body.querySelectorAll<HTMLElement>('[data-gjoin]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'answer', id: Number(el.dataset.gjoin), accept: true })));
      body.querySelectorAll<HTMLElement>('[data-gno]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'answer', id: Number(el.dataset.gno), accept: false })));
      return;
    }
    const at = (r: GuildRank) => RANK_ORDER.indexOf(g.rank) <= RANK_ORDER.indexOf(r);
    const store = g.here ? g.offices.find((o) => o.port === g.here)?.store ?? {} : null;
    const myBerths = (state.self?.berths ?? []).map((b, i) => ({ b, i })).filter((x) => x.b.port === docked);
    const tagOf = (s: string) => /\[([A-Z0-9]+)\]$/.exec(s)?.[1] ?? '';
    body.innerHTML = `<div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">${esc(g.name)} [${esc(g.tag)}] <span class="muted" style="font-size:14px">— you are ${esc(RANK_NAMES[g.rank])}</span></h3>
      <div class="card"><h4>Treasury ${fmt(g.treasury)} · tax ${g.tax}% of members' sales${g.torn ? ' · <span class="bad">the standard is torn</span>' : g.flagship ? ` · standard on ${esc(g.flagship)}'s ship` : ''}</h4>
        <div class="row"><input type="number" id="g-amt" value="1000" step="500" style="width:100px"><button class="btn btn-small" id="g-dep" ${docked ? '' : 'disabled'}>Deposit</button>${at('vice') ? `<button class="btn btn-small" id="g-wd" ${docked ? '' : 'disabled'}>Withdraw</button>` : ''}
        ${g.rank === 'admiral' ? `<label>Tax <select id="g-tax">${Array.from({ length: 16 }, (_, i) => `<option ${i === g.tax ? 'selected' : ''}>${i}</option>`).join('')}</select>%</label>` : ''}</div></div>
      <div class="card"><h4>Members (${g.members.length}/150)</h4><table class="grid">${g.members.map((m) => `<tr><td>${m.online ? '●' : '○'} ${esc(m.name)}</td><td>${g.rank === 'admiral' || (g.rank === 'vice' && RANK_ORDER.indexOf(m.rank) > 1) ? `<select data-grank="${m.account}">${RANK_ORDER.map((r) => `<option value="${r}" ${r === m.rank ? 'selected' : ''}>${RANK_NAMES[r]}</option>`).join('')}</select>` : esc(RANK_NAMES[m.rank])}</td>
        <td>${at('vice') && RANK_ORDER.indexOf(m.rank) > RANK_ORDER.indexOf(g.rank) ? `<button class="btn btn-small btn-danger" data-gkick="${m.account}">Ashore</button>` : ''}${g.rank === 'admiral' ? ` <button class="btn btn-small" data-gflag="${m.account}" title="Fly the standard from their ship (tier IV+)">Standard</button>` : ''}</td></tr>`).join('')}</table>
        ${at('commodore') ? '<div class="row"><input id="g-inv" placeholder="Captain to invite" style="flex:1"><button class="btn btn-small" id="g-invite">Invite</button></div>' : ''}</div>
      <div class="card"><h4>Office ${g.here ? `at ${esc(portName(g.here))}` : ''}</h4>
        ${store ? `<p class="muted">Store: ${Object.entries(store).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${n} ${esc(GOODS[k as GoodId].name)}`).join(', ') || 'empty'}</p>
          <div class="row"><select id="g-good">${goodOptions()}</select><input type="number" id="g-qty" value="10" style="width:70px"><button class="btn btn-small" id="g-put">Put in</button><button class="btn btn-small" id="g-take">Take out</button></div>`
          : `<p class="muted">${docked ? 'The guild keeps no office here.' : 'In port, the guild office.'}</p>${docked && at('vice') ? `<button class="btn btn-small" id="g-office">Rent an office here (${fmt(2000)} a week)</button>` : ''}`}
        ${g.offices.length ? `<p class="muted">Offices: ${g.offices.map((o) => esc(portName(o.port))).join(', ')}</p>` : ''}
        ${g.contracts.map((c) => `<p>Deliver ${c.qty} ${esc(GOODS[c.good].name)} to ${esc(portName(c.port))}: ${c.reward} each <span class="muted">(${esc(c.by)})</span>${at('vice') ? ` <button class="btn btn-small" data-gdrop="${c.id}">Withdraw</button>` : ''}</p>`).join('')}
        ${store && at('vice') ? `<div class="row"><span class="muted">Contract:</span><select id="g-cgood">${goodOptions()}</select><input type="number" id="g-cqty" value="100" style="width:70px"><input type="number" id="g-crew" value="30" style="width:60px"><button class="btn btn-small" id="g-contract">Post</button></div>` : ''}</div>
      <div class="card"><h4>The guild fleet</h4>${g.fleet.map((f) => `<p>${esc(f.name)} <span class="muted">${esc(SHIP_CLASSES[f.classId].name)} · hull ${f.hull}% · ${f.lentTo ? `out with ${esc(f.lentTo)}` : `at ${esc(portName(f.port))}`} · from ${esc(f.giver)}</span>${!f.lentTo && f.port === docked && at('captain') ? ` <button class="btn btn-small" data-gborrow="${f.id}">Borrow (20% deposit)</button>` : ''}</p>`).join('') || '<p class="muted">No guild hulls.</p>'}
        ${docked && at('captain') ? myBerths.map(({ b, i }) => `<button class="btn btn-small" data-ggive="${i}">Give the ${esc(b.name)}</button>`).join(' ') + ' <button class="btn btn-small" id="g-return">Return a guild hull berthed here</button>' : ''}</div>
    </div><div>
      <div class="card"><h4>Diplomacy</h4>
        ${g.wars.map((w) => `<p><b class="bad">War</b> with ${esc(w.with)} — ${w.active ? `score ${w.ours} : ${w.theirs}` : `opens ${new Date(w.opensAt).toUTCString().slice(5, 22)}`}${w.terms ? ` · peace offered ${w.terms.fromUs ? 'by us' : 'by them'}${w.terms.tribute ? ` (tribute ${fmt(w.terms.tribute)})` : ''}` : ''}
          ${g.rank === 'admiral' && Date.now() >= w.minEnd ? ` <input type="number" value="0" style="width:80px" data-gtrib="${esc(w.tag)}"><button class="btn btn-small" data-gpeace="${esc(w.tag)}">${w.terms && !w.terms.fromUs ? 'Accept peace' : 'Offer peace'}</button>` : ''}</p>`).join('')}
        ${g.alliance.length ? `<p>Allied with ${g.alliance.map(esc).join(', ')}${at('vice') ? ` <button class="btn btn-small" data-gbreak="alliance" data-tag="${esc(tagOf(g.alliance[0]))}">Leave the alliance</button>` : ''}</p>` : ''}
        ${g.pacts.map((p) => `<p>Pact with ${esc(p)}${at('vice') ? ` <button class="btn btn-small" data-gbreak="pact" data-tag="${esc(tagOf(p))}">End it</button>` : ''}</p>`).join('')}
        ${g.offers.map((o) => `<p>${esc(o.from)} offers ${o.kind === 'alliance' ? 'an alliance' : 'a pact'}${at('vice') ? ` <button class="btn btn-small btn-primary" data-gtreaty="${o.kind}" data-tag="${esc(tagOf(o.from))}">Agree</button>` : ''}</p>`).join('')}
        ${at('vice') ? `<div class="row"><input id="g-dtag" placeholder="TAG" maxlength="4" style="width:70px;text-transform:uppercase"><button class="btn btn-small" data-gtreaty="alliance" data-from-input="1">Offer alliance</button><button class="btn btn-small" data-gtreaty="pact" data-from-input="1">Offer pact</button>${g.rank === 'admiral' ? '<button class="btn btn-small btn-danger" id="g-war">Declare war (50 000)</button>' : ''}</div>` : ''}</div>
      <div class="card"><h4>Routes</h4><p class="muted">Lighthouse islands in contested and lawless water. Thirty minutes with only your guild's ships within 1.5 km takes one: a toll on passing merchants, and word of who sails by.</p>
        <table class="grid">${g.nodes.map((n) => `<tr><td>${esc(n.name)}</td><td class="muted">${esc(n.region.replace(/_/g, ' '))}</td><td>${n.ours ? `<b>ours</b> · toll ${at('vice') ? `<select data-gtoll="${n.island}">${[1, 2, 3, 4, 5].map((t) => `<option ${t === n.toll ? 'selected' : ''}>${t}</option>`).join('')}</select>` : n.toll}%` : n.holder ? esc(n.holder) : '<span class="muted">nobody</span>'}${n.progress && !n.ours ? ` · taking ${n.progress}%` : ''}</td></tr>`).join('')}</table></div>
      ${g.islands.length ? `<div class="card"><h4>Guild islands</h4>${g.islands.map((i) => `<p>${esc(i.name)} — ${i.base ? BASE_NAMES[i.base] : 'no base'}${at('vice') && i.base < 5 ? ` <button class="btn btn-small" data-gbase="${i.island}">Raise to ${BASE_NAMES[i.base + 1]}</button>` : ''}</p>`).join('')}</div>` : ''}
      <div class="card"><h4>Log</h4>${g.log.map((l) => `<p class="muted">${ago(l.t)} — ${esc(l.text)}</p>`).join('')}</div>
      <p>${g.rank === 'admiral' ? '<button class="btn btn-danger" id="g-disband">Dissolve the guild</button>' : '<button class="btn btn-danger" id="g-leave">Leave the guild</button>'} <span class="muted">Guild chat: /gc in chat.</span></p>
    </div></div>`;
    const q = <T extends HTMLElement>(sel: string) => body.querySelector<T>(sel);
    const v = (sel: string) => q<HTMLInputElement>(sel)?.value ?? '';
    const on = (sel: string, fn: () => void) => q(sel)?.addEventListener('click', fn);
    on('#g-dep', () => this.send({ t: 'guild', action: 'treasury', amount: Number(v('#g-amt')) }));
    on('#g-wd', () => this.send({ t: 'guild', action: 'treasury', amount: -Number(v('#g-amt')) }));
    q<HTMLSelectElement>('#g-tax')?.addEventListener('change', () => this.send({ t: 'guild', action: 'tax', pct: Number(v('#g-tax')) }));
    on('#g-invite', () => v('#g-inv') && this.send({ t: 'guild', action: 'invite', name: v('#g-inv') }));
    on('#g-office', () => this.send({ t: 'guild', action: 'office' }));
    on('#g-put', () => this.send({ t: 'guild', action: 'store', good: v('#g-good') as GoodId, qty: Number(v('#g-qty')) }));
    on('#g-take', () => this.send({ t: 'guild', action: 'store', good: v('#g-good') as GoodId, qty: -Number(v('#g-qty')) }));
    on('#g-contract', () => this.send({ t: 'guild', action: 'contract', good: v('#g-cgood') as GoodId, qty: Number(v('#g-cqty')), reward: Number(v('#g-crew')) }));
    on('#g-return', () => this.send({ t: 'guild', action: 'return_ship' }));
    on('#g-war', () => v('#g-dtag') && confirm(`Declare war on [${v('#g-dtag').toUpperCase()}]?`) && this.send({ t: 'guild', action: 'war', tag: v('#g-dtag') }));
    on('#g-leave', () => confirm('Leave the guild?') && this.send({ t: 'guild', action: 'leave' }));
    on('#g-disband', () => confirm('Dissolve the guild for good?') && this.send({ t: 'guild', action: 'disband' }));
    body.querySelectorAll<HTMLSelectElement>('[data-grank]').forEach((el) => (el.onchange = () => this.send({ t: 'guild', action: 'rank', account: Number(el.dataset.grank), rank: el.value as GuildRank })));
    body.querySelectorAll<HTMLElement>('[data-gkick]').forEach((el) => (el.onclick = () => confirm('Put them ashore?') && this.send({ t: 'guild', action: 'kick', account: Number(el.dataset.gkick) })));
    body.querySelectorAll<HTMLElement>('[data-gflag]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'flagship', account: Number(el.dataset.gflag) })));
    body.querySelectorAll<HTMLElement>('[data-gdrop]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'drop_contract', id: Number(el.dataset.gdrop) })));
    body.querySelectorAll<HTMLElement>('[data-gborrow]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'borrow_ship', id: Number(el.dataset.gborrow) })));
    body.querySelectorAll<HTMLElement>('[data-ggive]').forEach((el) => (el.onclick = () => confirm('Give this hull to the guild?') && this.send({ t: 'guild', action: 'give_ship', berth: Number(el.dataset.ggive) })));
    body.querySelectorAll<HTMLElement>('[data-gpeace]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'peace', tag: el.dataset.gpeace!, tribute: Number(q<HTMLInputElement>(`[data-gtrib="${el.dataset.gpeace}"]`)?.value ?? 0) })));
    body.querySelectorAll<HTMLElement>('[data-gbreak]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: el.dataset.gbreak === 'alliance' ? 'break_alliance' : 'break_pact', tag: el.dataset.tag! })));
    body.querySelectorAll<HTMLElement>('[data-gtreaty]').forEach((el) => (el.onclick = () => {
      const tag = el.dataset.fromInput ? v('#g-dtag') : el.dataset.tag!;
      if (tag) this.send({ t: 'guild', action: el.dataset.gtreaty as 'alliance', tag });
    }));
    body.querySelectorAll<HTMLSelectElement>('[data-gtoll]').forEach((el) => (el.onchange = () => this.send({ t: 'guild', action: 'toll', island: Number(el.dataset.gtoll), pct: Number(el.value) })));
    body.querySelectorAll<HTMLElement>('[data-gbase]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'base', island: Number(el.dataset.gbase) })));
  }

  private renderLaw(body: HTMLElement, state: ClientState): void {
    const v = state.self?.pvp;
    if (!v) return;
    const now = Date.now();
    const d = state.duel;
    const mins = (ms: number) => Math.max(1, Math.ceil((ms - now) / 60_000));
    body.innerHTML = `<div class="cols"><div>
      <div class="card"><h4>Your colours</h4>
        <p>${v.blackFlag ? '<b>The Black Flag flies.</b> In contested water any captain may attack you without a crime; plunder from NPCs +15%, from captains ×1.2. Struck in port, or after 15 minutes out of a fight.' : 'Plain colours. Attacking a captain who is not fair game is a crime outside lawless water.'}</p>
        <button class="btn ${v.blackFlag ? '' : 'btn-danger'}" id="bf">${v.blackFlag ? 'Strike the Black Flag' : 'Hoist the Black Flag'}</button>
        ${v.pennant ? `<p class="good">Green Pennant: nobody may attack you in contested water (${v.pennantHoursLeft} h at sea left, or until level 15). Attacking a captain lowers it for half an hour; you take no goods from other captains.</p>` : ''}
        ${v.bubbleUntil > now ? `<p class="good">Protected after your sinking for ${mins(v.bubbleUntil)} more minutes — until you fire, sail into lawless water or take someone's casks.</p>` : ''}
        ${v.shameUntil > now ? `<p class="bad">SHAME for ${mins(v.shameUntil)} more minutes: you hunted a minnow. Your crimes count double in contested water.</p>` : ''}
        ${v.bounty ? `<p class="bad">A purse of ${fmt(v.bounty)} silver hangs on your head.</p>` : ''}
        <p class="muted">Duels ${v.duels} · won ${v.duelWins} · rating ${v.rating}${v.hunter ? ' · hunter’s licence (Crown standing): captains with a price on their head are fair game' : ''}</p></div>
      <div class="card"><h4>Duels</h4>
        ${d ? `<p><b>${d.startsIn ? `Guns in ${d.startsIn} s` : `${Math.floor(d.endsIn / 60)}:${String(d.endsIn % 60).padStart(2, '0')} left`}</b> — ${d.sides.map((side) => side.map((x) => `${esc(x.name)}${x.struck ? ' (struck)' : ''}`).join(', ')).join(' <i>against</i> ')}</p><button class="btn btn-danger" id="yield">Yield</button>`
          : `<p class="muted">By consent, anywhere — even in the Crown’s waters. Nobody sinks and nothing is lost: when it ends, both ships are as they were. Stay inside the ring. Group leaders may duel group against group.</p>
        <div class="row"><input id="duel-name" placeholder="Captain's name" maxlength="20" style="flex:1"><label><input type="checkbox" id="duel-fleet"> groups</label><button class="btn" id="duel">Challenge</button></div>`}
        ${v.challenges.map((c) => `<div class="row"><span><b>${esc(c.from)}</b> challenges you${c.fleet ? ' (group against group)' : ''}</span><span><button class="btn btn-small btn-primary" data-duel-yes="${c.id}">Accept</button> <button class="btn btn-small" data-duel-no="${c.id}">Decline</button></span></div>`).join('')}</div>
    </div><div>
      <div class="card"><h4>The bounty board</h4>
        <table class="grid">${state.bounties.map((b) => `<tr><td>${esc(b.name)}</td><td><b>${fmt(b.total)}</b> silver</td><td class="muted">${b.backers} backer${b.backers > 1 ? 's' : ''}${b.wanted ? ` · Wanted ${b.wanted}` : ''}${b.atSea ? ' · at sea' : ''}</td></tr>`).join('') || '<tr><td class="muted">No purses posted.</td></tr>'}</table>
        <p class="muted">Paid to whoever sinks the captain (taken alive: half again), never to their group or anyone who traded or sailed with them in the last day. A fleet three times their strength shares half.</p></div>
      ${v.sunkBy.length ? `<div class="card"><h4>Who sank you</h4>${v.sunkBy.map((k) => `<div class="row"><span>${esc(k.name)} <span class="muted">${ago(k.t)}${k.free ? ' · right of revenge: no fee' : ' · 10% to the League'}</span></span>
          <span><input type="number" min="1000" step="500" value="1000" style="width:90px" data-bamt="${esc(k.name)}"><button class="btn btn-small" data-bounty="${esc(k.name)}" ${state.self?.dockedAt ? '' : 'disabled title="At a harbour office"'}>Put a price</button></span></div>`).join('')}
        <p class="muted">For a day after they sink you, you see them on your chart within 3 km.</p></div>` : ''}
    </div></div>`;
    body.querySelector<HTMLElement>('#bf')!.onclick = () => this.send({ t: 'pvp', action: 'black_flag', on: !v.blackFlag });
    body.querySelector<HTMLElement>('#yield')?.addEventListener('click', () => this.send({ t: 'pvp', action: 'forfeit' }));
    body.querySelector<HTMLElement>('#duel')?.addEventListener('click', () => {
      const name = body.querySelector<HTMLInputElement>('#duel-name')!.value.trim();
      if (name) this.send({ t: 'pvp', action: 'duel', name, fleet: body.querySelector<HTMLInputElement>('#duel-fleet')!.checked });
    });
    body.querySelectorAll<HTMLElement>('[data-duel-yes]').forEach((el) => (el.onclick = () => this.send({ t: 'pvp', action: 'duel_answer', id: Number(el.dataset.duelYes), accept: true })));
    body.querySelectorAll<HTMLElement>('[data-duel-no]').forEach((el) => (el.onclick = () => this.send({ t: 'pvp', action: 'duel_answer', id: Number(el.dataset.duelNo), accept: false })));
    body.querySelectorAll<HTMLElement>('[data-bounty]').forEach((el) => (el.onclick = () => {
      const amt = Number(body.querySelector<HTMLInputElement>(`[data-bamt="${el.dataset.bounty}"]`)!.value);
      this.send({ t: 'pvp', action: 'bounty', name: el.dataset.bounty!, amount: amt });
    }));
  }

  private renderLetters(body: HTMLElement, state: ClientState): void {
    const docked = state.self?.dockedAt ?? null;
    body.innerHTML = `<div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">Letters</h3>
      ${state.letters.map((l) => `<div class="card letter ${l.read ? '' : 'unread'}"><h4>${esc(l.subject)} <span class="muted">— ${esc(l.from)}, ${ago(l.sentAt)}</span></h4>
        ${l.body ? `<p style="white-space:pre-wrap">${esc(l.body)}</p>` : ''}
        ${!l.taken ? `<p><b>${l.gold ? `${fmt(l.gold)} silver` : ''}${l.goods ? `${l.goods.qty} ${esc(GOODS[l.goods.good].name)} waiting in ${esc(state.ports.find((p) => p.id === l.goods!.port)?.name ?? l.goods.port)}` : ''}</b></p>` : ''}
        <div class="row" style="gap:6px">${!l.read ? `<button class="btn btn-small" data-read="${l.id}">Mark read</button>` : ''}
          ${!l.taken ? `<button class="btn btn-small btn-primary" data-take="${l.id}" ${docked && (!l.goods || l.goods.port === docked) ? '' : 'disabled title="Collect it in port"'}>Collect</button>` : `<button class="btn btn-small" data-del="${l.id}">Burn it</button>`}</div></div>`).join('') || '<p class="muted">No letters.</p>'}
    </div><div>
      <div class="card"><h4>Write a letter</h4>
        ${docked ? `<p class="muted">The packet boat carries it within a minute or so. Postage 10 silver; a draft of silver goes with it for 2%.</p>
        <input id="m-to" placeholder="To (captain's name)" maxlength="20" style="width:100%;margin-bottom:6px">
        <input id="m-subj" placeholder="Subject" maxlength="60" style="width:100%;margin-bottom:6px">
        <textarea id="m-body" rows="5" maxlength="1000" placeholder="Captain…" style="width:100%;margin-bottom:6px"></textarea>
        <div class="row"><label>Draft <input id="m-gold" type="number" min="0" max="100000" value="0" style="width:110px"> silver</label><button class="btn btn-primary" id="m-send">Send</button></div>` : '<p class="muted">Letters go from a harbour office.</p>'}</div>
    </div></div>`;
    const v = (id: string) => body.querySelector<HTMLInputElement | HTMLTextAreaElement>(id)?.value ?? '';
    body.querySelector<HTMLElement>('#m-send')?.addEventListener('click', () => {
      if (!v('#m-to').trim()) return;
      this.send({ t: 'mail', action: 'send', to: v('#m-to'), subject: v('#m-subj'), body: v('#m-body'), gold: Number(v('#m-gold')) || 0 });
    });
    body.querySelectorAll<HTMLElement>('[data-read]').forEach((el) => (el.onclick = () => this.send({ t: 'mail', action: 'read', id: Number(el.dataset.read) })));
    body.querySelectorAll<HTMLElement>('[data-take]').forEach((el) => (el.onclick = () => this.send({ t: 'mail', action: 'take', id: Number(el.dataset.take) })));
    body.querySelectorAll<HTMLElement>('[data-del]').forEach((el) => (el.onclick = () => this.send({ t: 'mail', action: 'delete', id: Number(el.dataset.del) })));
  }

  private renderMarket(body: HTMLElement, state: ClientState): void {
    const mk = state.market;
    const hold = state.self?.cargo ?? {};
    if (!mk || mk.port !== state.self?.dockedAt) {
      body.innerHTML = '<p class="muted">Reading the board…</p>';
      return;
    }
    const row = (l: ListingView) => {
      const name = esc(GOODS[l.good].name);
      if (l.kind === 'auction') {
        const next = l.bidder ? Math.max(l.price + 1, Math.ceil(l.price * 1.05)) : l.price;
        return `<tr><td>${l.qty} ${name}</td><td>${esc(l.seller)}</td><td>${l.bidder ? `${fmt(l.price)} (${esc(l.bidder)})` : `reserve ${fmt(l.price)}`}${l.buyout ? ` · buyout ${fmt(l.buyout)}` : ''}</td><td class="muted">${left(l.endsAt)}</td>
          <td>${l.mine ? (l.bidder ? '' : `<button class="btn btn-small" data-cancel="${l.id}">Withdraw</button>`) : `<input type="number" min="${next}" value="${next}" style="width:90px" data-bidv="${l.id}"><button class="btn btn-small" data-bid="${l.id}">Bid</button>${l.buyout ? ` <button class="btn btn-small btn-primary" data-buyout="${l.id}" data-price="${l.buyout}">Buy now</button>` : ''}`}</td></tr>`;
      }
      return `<tr><td>${l.kind === 'sell' ? 'Selling' : 'Buying'} ${l.qty} ${name}</td><td>${esc(l.seller)}</td><td>${fmt(l.price)} each</td><td class="muted">${left(l.endsAt)}</td>
        <td>${l.mine ? `<button class="btn btn-small" data-cancel="${l.id}">Withdraw</button>` : `<input type="number" min="1" max="${l.qty}" value="${l.qty}" style="width:70px" data-qtyv="${l.id}"><button class="btn btn-small btn-primary" data-fill="${l.id}">${l.kind === 'sell' ? 'Buy' : 'Sell'}</button>`}</td></tr>`;
    };
    const lots = mk.listings.filter((l) => l.kind === 'auction');
    body.innerHTML = `<div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">The board</h3>
      <p class="muted">Only captains in this port see it. Listing fee ${Math.round(mk.listFee * 100)}% (kept), duty on sales ${Math.round(mk.saleTax * 100)}%. What you buy from an order waits here for you, with a letter.</p>
      <table class="grid">${mk.listings.filter((l) => l.kind !== 'auction').map(row).join('') || '<tr><td class="muted">Nothing posted.</td></tr>'}</table>
      ${mk.auction ? `<h3 class="title-sm" style="font-size:20px;margin-top:12px">Trophy auction</h3><table class="grid">${lots.map(row).join('') || '<tr><td class="muted">No lots.</td></tr>'}</table><p class="muted">Bids hold your silver; outbid, it comes back by letter. A late bid keeps the lot open five more minutes. The house takes 5%.</p>` : ''}
    </div><div>
      <div class="card"><h4>Post a listing</h4>
        <div class="row"><select id="k-kind"><option value="sell">Sell from hold</option><option value="sellw">Sell from warehouse</option><option value="buy">Buy order</option>${mk.auction ? '<option value="auction">Auction from hold</option>' : ''}</select>
          <select id="k-good">${goodOptions()}</select></div>
        <div class="row"><label>Qty <input id="k-qty" type="number" min="1" value="10" style="width:80px"></label><label id="k-price-l">Price each <input id="k-price" type="number" min="1" value="${GOODS.sugar.basePrice}" style="width:90px"></label></div>
        <div class="row hidden" id="k-auction"><label>Buyout <input id="k-buyout" type="number" min="0" value="0" style="width:90px"></label><label>Hours <select id="k-hours"><option>2</option><option selected>8</option><option>24</option></select></label></div>
        <button class="btn btn-primary" id="k-post">Post</button>
        <p class="muted">In your hold: ${Object.entries(hold).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => `${n} ${esc(GOODS[g as GoodId].name)}`).join(', ') || 'nothing'}</p></div>
    </div></div>`;
    const q = <T extends HTMLElement>(id: string) => body.querySelector<T>(id)!;
    const kind = q<HTMLSelectElement>('#k-kind');
    kind.onchange = () => {
      q('#k-auction').classList.toggle('hidden', kind.value !== 'auction');
      q('#k-price-l').firstChild!.textContent = kind.value === 'auction' ? 'Reserve (lot) ' : 'Price each ';
    };
    q('#k-good').onchange = () => (q<HTMLInputElement>('#k-price').value = String(GOODS[q<HTMLSelectElement>('#k-good').value as GoodId].basePrice));
    q('#k-post').onclick = () => {
      const good = q<HTMLSelectElement>('#k-good').value as GoodId;
      const qty = Number(q<HTMLInputElement>('#k-qty').value);
      const price = Number(q<HTMLInputElement>('#k-price').value);
      if (kind.value === 'auction') this.send({ t: 'market', action: 'auction', good, qty, price, buyout: Number(q<HTMLInputElement>('#k-buyout').value) || 0, hours: Number(q<HTMLSelectElement>('#k-hours').value) });
      else if (kind.value === 'buy') this.send({ t: 'market', action: 'buy_order', good, qty, price });
      else this.send({ t: 'market', action: 'sell', good, qty, price, from: kind.value === 'sellw' ? 'warehouse' : 'hold' });
    };
    body.querySelectorAll<HTMLElement>('[data-fill]').forEach((el) => (el.onclick = () => {
      const qty = Number(body.querySelector<HTMLInputElement>(`[data-qtyv="${el.dataset.fill}"]`)!.value);
      this.send({ t: 'market', action: 'fill', id: Number(el.dataset.fill), qty });
    }));
    body.querySelectorAll<HTMLElement>('[data-bid]').forEach((el) => (el.onclick = () => {
      const price = Number(body.querySelector<HTMLInputElement>(`[data-bidv="${el.dataset.bid}"]`)!.value);
      this.send({ t: 'market', action: 'bid', id: Number(el.dataset.bid), price });
    }));
    body.querySelectorAll<HTMLElement>('[data-buyout]').forEach((el) => (el.onclick = () => this.send({ t: 'market', action: 'bid', id: Number(el.dataset.buyout), price: Number(el.dataset.price) })));
    body.querySelectorAll<HTMLElement>('[data-cancel]').forEach((el) => (el.onclick = () => this.send({ t: 'market', action: 'cancel', id: Number(el.dataset.cancel) })));
  }
}

/** The barter table: your offer on the left, theirs on the right. */
export function renderBarter(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const b = state.barter;
  if (!b) return;
  const hold = state.self?.cargo ?? {};
  const list = (c: Cargo) => Object.entries(c).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => `<p>${n} ${esc(GOODS[g as GoodId].name)}</p>`).join('') || '<p class="muted">no goods</p>';
  root.innerHTML = `<div class="modal-head"><div><h2>Trading with ${esc(b.them.name)}</h2><div class="sub">${b.atSea ? 'Hove-to alongside: the goods cross by boat' : 'Across the quay'}${b.transfer ? ` · boats under way, ${b.transfer} s` : ''}</div></div><div class="muted">[Esc] walk away</div></div>
    <div class="modal-body"><div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">You give ${b.me.ready ? '<span class="good">✓ ready</span>' : ''}</h3>
      <div class="card"><div class="row"><label>Silver <input id="b-gold" type="number" min="0" value="${b.me.gold}" style="width:110px"></label></div>
        ${Object.entries(hold).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => `<div class="row"><span>${esc(GOODS[g as GoodId].name)} <span class="muted">(${n})</span></span><input type="number" min="0" max="${n}" value="${b.me.cargo[g as GoodId] ?? 0}" data-give="${g}" style="width:80px"></div>`).join('')}
        <button class="btn" id="b-offer">Set my offer</button></div>
    </div><div>
      <h3 class="title-sm" style="font-size:20px">${esc(b.them.name)} gives ${b.them.ready ? '<span class="good">✓ ready</span>' : ''}</h3>
      <div class="card"><p><b>${fmt(b.them.gold)} silver</b></p>${list(b.them.cargo)}</div>
      <div class="row" style="gap:8px"><button class="btn btn-primary" id="b-ready" ${b.me.ready ? 'disabled' : ''}>Agree</button><button class="btn btn-danger" id="b-cancel">Walk away</button></div>
      <p class="muted">Any change to either offer calls both captains back to the table.</p>
    </div></div></div>`;
  root.querySelector<HTMLElement>('#b-offer')!.onclick = () => {
    const cargo: Cargo = {};
    root.querySelectorAll<HTMLInputElement>('[data-give]').forEach((el) => {
      const n = Math.floor(Number(el.value));
      if (n > 0) cargo[el.dataset.give as GoodId] = n;
    });
    send({ t: 'barter', action: 'offer', gold: Math.floor(Number(root.querySelector<HTMLInputElement>('#b-gold')!.value) || 0), cargo });
  };
  root.querySelector<HTMLElement>('#b-ready')!.onclick = () => send({ t: 'barter', action: 'ready' });
  root.querySelector<HTMLElement>('#b-cancel')!.onclick = () => send({ t: 'barter', action: 'cancel' });
}
