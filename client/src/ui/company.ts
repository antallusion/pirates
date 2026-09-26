// The Company & Letters screen (Y): your group and the convoy signal, hails to trade, letters from the
// packet boat, and — in port — the captains' market board (and Tidewrack's trophy auction).
// Plus the barter table, opened when two captains agree to trade.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { GOODS, GOOD_IDS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { GROUP_MAX } from '../../../shared/src/protocol.ts';
import type { ClientMsg, ListingView } from '../../../shared/src/protocol.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt } from './dom.ts';

export type CompanyTab = 'group' | 'letters' | 'market' | 'law';

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
    const tabs = (['group', 'law', 'letters', 'market'] as CompanyTab[])
      .filter((t) => t !== 'market' || docked)
      .map((t) => `<button class="btn btn-small ${this.tab === t ? 'btn-primary' : ''}" data-tab="${t}">${t === 'group' ? 'Group' : t === 'law' ? `Colours &amp; Law${state.self?.pvp.challenges.length ? ' (!)' : ''}` : t === 'letters' ? `Letters${state.unread ? ` (${state.unread})` : ''}` : state.market?.auction ? 'Market & Auction' : 'Market board'}</button>`)
      .join(' ');
    root.innerHTML = `<div class="modal-head"><div><h2>Company &amp; Letters</h2><div class="sub">${tabs}</div></div><div class="muted">[Y] close</div></div>
      <div class="modal-body" id="company-body"></div>`;
    const body = root.querySelector<HTMLElement>('#company-body')!;
    if (this.tab === 'group') this.renderGroup(body, state);
    else if (this.tab === 'letters') this.renderLetters(body, state);
    else if (this.tab === 'law') this.renderLaw(body, state);
    else this.renderMarket(body, state);
    root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => (el.onclick = () => {
      this.tab = el.dataset.tab as CompanyTab;
      if (this.tab === 'market') this.send({ t: 'market', action: 'list' });
      if (this.tab === 'letters') this.send({ t: 'mail', action: 'list' });
      if (this.tab === 'law') this.send({ t: 'pvp', action: 'bounties' });
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
