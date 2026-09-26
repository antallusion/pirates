// The crew screen (O): trades and veterancy, loyalty and the Codex share, officers and their orders,
// the memorial; and the mutiny dialog.

import { OFFICER_DEFS, PROFESSIONS, PROFESSION_DEFS, TRAITS } from '../../../shared/src/data/crew.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import type { ClientState } from '../state.ts';
import { TALENTS_BY_ID } from '../../../shared/src/data/talents.ts';
import { dict, plural } from '../i18n.ts';
import { EN, RU } from '../lang/ui/crew.ts';
import { serverText } from '../lang/server.ts';
import { keyLabel, settings } from '../settings.ts';
import type { Action } from '../settings.ts';
import { esc, fmt } from './dom.ts';

const L = dict(EN, RU);
const kb = (a: Action) => keyLabel(settings().keys[a][0] || settings().keys[a][1]);

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
  const spirit = L(morale >= 80 ? 'spirit.inspired' : morale >= 50 ? 'spirit.steady' : morale >= 30 ? 'spirit.anxious' : morale >= 15 ? 'spirit.panicking' : 'spirit.broken');
  const souls = `${total} ${plural(total, L('soul.one'), L('soul.few'), L('soul.many'))}`;
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub', { souls, stars: stars(c.skill), skill: c.skill.toFixed(1), morale, spirit, loyalty: c.loyalty }))}${c.unrest ? ` · <span class="bad">${esc(serverText(c.unrest))}</span>` : ''}</div></div><div class="muted">${esc(L('close', { key: kb('crew') }))}</div></div>
    <div class="modal-body"><div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">${esc(L('trades'))}</h3>
      <table class="grid">${PROFESSIONS.map((k) => `<tr title="${esc(PROFESSION_DEFS[k].description)}"><td>${esc(PROFESSION_DEFS[k].name)}</td><td>${c.pools[k]}</td><td class="muted">${esc(L('wagePerHour', { wage: PROFESSION_DEFS[k].wage }))}</td></tr>`).join('')}</table>
      <p class="muted">${esc(L('wages', { sum: fmt(c.wagesPerHour) }))}${c.owed ? esc(L('owed', { sum: fmt(c.owed) })) : ''}${esc(L('hireHint'))}</p>
      <div class="card"><h4>${esc(L('codex'))}</h4>
        <div class="row"><input id="codex" type="range" min="0" max="50" step="5" value="${c.share}" style="flex:1"><b id="codex-v">${c.share}%</b></div>
        <p class="muted">${esc(L('codexFair', { share: c.expectedShare }))}</p></div>
      ${c.traits.length ? `<div class="card"><h4>${esc(L('character'))}</h4>${traitChips(c.traits)}</div>` : ''}
      ${self.fleet.slots || self.fleet.escorts.length ? `<div class="card"><h4>${esc(L('squadron', { n: self.fleet.escorts.length, slots: self.fleet.slots, key: kb('formation') }))}</h4>
        ${self.fleet.escorts.map((e) => `<p>${esc(e.name)} <span class="muted">${esc(e.atSea ? L('escortHull', { hull: e.hull }) : L('atAnchor'))}</span></p>`).join('') || `<p class="muted">${esc(L('hireEscorts'))}</p>`}
        ${self.talents.cmd_signal_flags ? `<div class="row" style="gap:6px">${(['line', 'wedge', 'ring'] as const).map((f) => `<button class="btn btn-small ${self.fleet.formation === f ? 'btn-primary' : ''}" data-form="${f}" title="${esc(f === 'line' ? L('form.lineTip', { talent: TALENTS_BY_ID.cmd_line_of_battle?.name ?? '' }) : L(`form.${f}Tip`))}">${esc(L(`form.${f}`))}</button>`).join('')}</div>` : ''}</div>` : ''}
      ${c.memorial.length ? `<div class="card"><h4>${esc(L('memorial'))}</h4>${c.memorial.map((m) => `<p>† ${esc(m.name)}, ${esc(OFFICER_DEFS[m.role].name.toLowerCase())} — ${esc(serverText(m.cause))}</p>`).join('')}</div>` : ''}
    </div><div>
      <h3 class="title-sm" style="font-size:20px">${esc(L('officers', { n: c.officers.length, slots: c.slots }))}</h3>
      ${c.officers.map((o) => {
        const def = OFFICER_DEFS[o.role];
        const left = Math.max(0, o.orderReady - now);
        return `<div class="card"><h4>${esc(o.name)} <span class="muted">${esc(L('officerLevel', { role: def.name, level: o.level }))}</span></h4>
          <p>${traitChips(o.traits)}</p>
          <p class="muted">${esc(def.description)}</p>
          <div class="row"><span>${esc(L('loyalty', { n: o.loyalty }))}${o.warned ? ` <span class="bad">${esc(L('restless'))}</span>` : ''}${o.wound ? ` · <span class="bad">${esc(L(`wound.${o.wound}`))}</span>` : ''}${o.away ? ` · <span class="bad">${esc(L('captive'))}</span>` : ''}</span>
            <span><button class="btn btn-small" data-order="${o.id}" ${left > 0 || o.away ? 'disabled' : ''} title="${esc(def.order.description)}">${esc(def.order.name)}${left > 0 ? esc(L('cooldown', { s: Math.ceil(left) })) : ''}</button>
            ${self.dockedAt ? `<button class="btn btn-small btn-danger" data-dismiss="${o.id}">${esc(L('payOff'))}</button>` : ''}</span></div></div>`;
      }).join('') || `<p class="muted">${esc(L('noOfficers'))}</p>`}
    </div></div></div>`;
  const slider = root.querySelector<HTMLInputElement>('#codex')!;
  slider.oninput = () => (root.querySelector('#codex-v')!.textContent = `${slider.value}%`);
  slider.onchange = () => send({ t: 'codex', share: Number(slider.value) });
  root.querySelectorAll<HTMLElement>('[data-form]').forEach((el) => (el.onclick = () => send({ t: 'formation', formation: el.dataset.form as 'line' })));
  root.querySelectorAll<HTMLElement>('[data-order]').forEach((el) => (el.onclick = () => send({ t: 'officer', action: 'order', id: el.dataset.order! })));
  root.querySelectorAll<HTMLElement>('[data-dismiss]').forEach((el) => (el.onclick = () => {
    if (confirm(L('confirmPayOff'))) send({ t: 'officer', action: 'dismiss', id: el.dataset.dismiss! });
  }));
}

export function renderMutiny(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const m = state.self?.company.mutiny;
  if (!m) return;
  root.innerHTML = `<div class="modal-body"><div class="center-card">
    <h2 class="title-sm" style="font-size:40px;color:var(--bad)">${esc(L('mutiny'))}</h2>
    <p style="font-family:var(--serif);font-size:18px;color:var(--fog)">${esc(L('mutinyText', { leader: m.ringleader, men: `${m.mutineers} ${plural(m.mutineers, L('man.one'), L('man.few'), L('man.many'))}`, s: m.left }))}</p>
    <div class="cols" style="max-width:620px;margin:16px auto">
      <button class="btn" data-mut="pay">${esc(L('mut.pay', { sum: fmt(m.payCost) }))}</button>
      <button class="btn btn-danger" data-mut="suppress">${esc(L('mut.suppress'))}</button>
      <button class="btn" data-mut="duel">${esc(L('mut.duel'))}</button>
      <button class="btn" data-mut="yield">${esc(L('mut.yield'))}</button>
    </div></div></div>`;
  root.querySelectorAll<HTMLElement>('[data-mut]').forEach((el) => (el.onclick = () => send({ t: 'mutiny', choice: el.dataset.mut as 'pay' })));
}
