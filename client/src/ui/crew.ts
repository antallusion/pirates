// The crew screen (O): trades and veterancy, loyalty and the Codex share, officers and their orders,
// the memorial; and the mutiny dialog.

import { OFFICER_DEFS, PROFESSIONS, PROFESSION_DEFS, TRAITS } from '../../../shared/src/data/crew.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt } from './dom.ts';

const stars = (v: number) => '★'.repeat(Math.floor(v)) + (v % 1 >= 0.5 ? '½' : '');

export function traitChips(traits: string[]): string {
  return traits.map((t) => {
    const d = TRAITS[t as keyof typeof TRAITS];
    return d ? `<span class="chip ${d.good ? 'good' : 'bad'}" title="${esc(d.description)}">${esc(d.name)}</span>` : '';
  }).join(' ');
}

export function renderCrew(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const self = state.self;
  if (!self) return;
  const c = self.company;
  const now = state.estServerTime();
  const total = PROFESSIONS.reduce((a, k) => a + c.pools[k], 0);
  const morale = state.you?.morale ?? self.morale;
  const spirit = morale >= 80 ? 'inspired' : morale >= 50 ? 'steady' : morale >= 30 ? 'anxious' : morale >= 15 ? 'panicking' : 'broken';
  root.innerHTML = `<div class="modal-head"><div><h2>The Company</h2><div class="sub">${total} souls aboard · veterancy ${stars(c.skill)} (${c.skill.toFixed(1)}) · morale ${morale} (${spirit}) · loyalty ${c.loyalty}${c.unrest ? ` · <span class="bad">${esc(c.unrest)}</span>` : ''}</div></div><div class="muted">[O] close</div></div>
    <div class="modal-body"><div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">Trades</h3>
      <table class="grid">${PROFESSIONS.map((k) => `<tr title="${esc(PROFESSION_DEFS[k].description)}"><td>${esc(PROFESSION_DEFS[k].name)}</td><td>${c.pools[k]}</td><td class="muted">${PROFESSION_DEFS[k].wage}/h</td></tr>`).join('')}</table>
      <p class="muted">Wages ${fmt(c.wagesPerHour)} silver an hour at sea, paid every ten minutes${c.owed ? ` · owed ${fmt(c.owed)}` : ''}. Hire trades in any tavern.</p>
      <div class="card"><h4>The Codex: crew's share of plunder</h4>
        <div class="row"><input id="codex" type="range" min="0" max="50" step="5" value="${c.share}" style="flex:1"><b id="codex-v">${c.share}%</b></div>
        <p class="muted">They think ${c.expectedShare}% fair. More than that buys loyalty with every prize; much less costs it.</p></div>
      ${c.traits.length ? `<div class="card"><h4>Character of the crew</h4>${traitChips(c.traits)}</div>` : ''}
      ${self.fleet.slots || self.fleet.escorts.length ? `<div class="card"><h4>Squadron (${self.fleet.escorts.length}/${self.fleet.slots}) · [J] formation</h4>
        ${self.fleet.escorts.map((e) => `<p>${esc(e.name)} <span class="muted">${e.atSea ? `hull ${e.hull}%` : 'at anchor'}</span></p>`).join('') || '<p class="muted">Hire escorts at a harbour master.</p>'}
        ${self.talents.cmd_signal_flags ? `<div class="row" style="gap:6px">${(['line', 'wedge', 'ring'] as const).map((f) => `<button class="btn btn-small ${self.fleet.formation === f ? 'btn-primary' : ''}" data-form="${f}" title="${f === 'line' ? '+10% escort damage (Line of Battle fires with you)' : f === 'wedge' ? '+10% escort speed' : '+10% escort armour'}">${f === 'line' ? 'Line' : f === 'wedge' ? 'Wedge' : 'Ring'}</button>`).join('')}</div>` : ''}</div>` : ''}
      ${c.memorial.length ? `<div class="card"><h4>Memorial</h4>${c.memorial.map((m) => `<p>† ${esc(m.name)}, ${esc(OFFICER_DEFS[m.role].name.toLowerCase())} — ${esc(m.cause)}</p>`).join('')}</div>` : ''}
    </div><div>
      <h3 class="title-sm" style="font-size:20px">Officers (${c.officers.length}/${c.slots})</h3>
      ${c.officers.map((o) => {
        const def = OFFICER_DEFS[o.role];
        const left = Math.max(0, o.orderReady - now);
        return `<div class="card"><h4>${esc(o.name)} <span class="muted">— ${esc(def.name)}, level ${o.level}</span></h4>
          <p>${traitChips(o.traits)}</p>
          <p class="muted">${esc(def.description)}</p>
          <div class="row"><span>Loyalty ${o.loyalty}${o.warned ? ' <span class="bad">(restless)</span>' : ''}${o.wound ? ` · <span class="bad">${o.wound} wound</span>` : ''}${o.away ? ' · <span class="bad">captive ashore</span>' : ''}</span>
            <span><button class="btn btn-small" data-order="${o.id}" ${left > 0 || o.away ? 'disabled' : ''} title="${esc(def.order.description)}">${esc(def.order.name)}${left > 0 ? ` (${Math.ceil(left)}s)` : ''}</button>
            ${self.dockedAt ? `<button class="btn btn-small btn-danger" data-dismiss="${o.id}">Pay off</button>` : ''}</span></div></div>`;
      }).join('') || '<p class="muted">No officers. Taverns have visitors looking for a berth; some ports have a legend drinking in the corner.</p>'}
    </div></div></div>`;
  const slider = root.querySelector<HTMLInputElement>('#codex')!;
  slider.oninput = () => (root.querySelector('#codex-v')!.textContent = `${slider.value}%`);
  slider.onchange = () => send({ t: 'codex', share: Number(slider.value) });
  root.querySelectorAll<HTMLElement>('[data-form]').forEach((el) => (el.onclick = () => send({ t: 'formation', formation: el.dataset.form as 'line' })));
  root.querySelectorAll<HTMLElement>('[data-order]').forEach((el) => (el.onclick = () => send({ t: 'officer', action: 'order', id: el.dataset.order! })));
  root.querySelectorAll<HTMLElement>('[data-dismiss]').forEach((el) => (el.onclick = () => {
    if (confirm('Pay this officer off?')) send({ t: 'officer', action: 'dismiss', id: el.dataset.dismiss! });
  }));
}

export function renderMutiny(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const m = state.self?.company.mutiny;
  if (!m) return;
  root.innerHTML = `<div class="modal-body"><div class="center-card">
    <h2 class="title-sm" style="font-size:40px;color:var(--bad)">Mutiny</h2>
    <p style="font-family:var(--serif);font-size:18px;color:var(--fog)">${esc(m.ringleader)} and ${m.mutineers} men hold the waist with cutlasses drawn. The rest watch to see what you do. (${m.left} s)</p>
    <div class="cols" style="max-width:620px;margin:16px auto">
      <button class="btn" data-mut="pay">Pay them — ${fmt(m.payCost)} silver (three hours' wages)</button>
      <button class="btn btn-danger" data-mut="suppress">Put it down — marines and officers against them</button>
      <button class="btn" data-mut="duel">Fight the ringleader yourself</button>
      <button class="btn" data-mut="yield">Give in — they sail for port, half walk off</button>
    </div></div></div>`;
  root.querySelectorAll<HTMLElement>('[data-mut]').forEach((el) => (el.onclick = () => send({ t: 'mutiny', choice: el.dataset.mut as 'pay' })));
}
