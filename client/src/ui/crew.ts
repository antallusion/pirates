// The crew screen (O): trades and veterancy, loyalty and the Codex share, officers and their orders,
// the memorial; and the mutiny dialog.

import { PASTS, REQUESTS } from '../../../shared/src/data/fates.ts';
import { placeName } from './maps.ts';
import { OFFICER_DEFS, PROFESSIONS, PROFESSION_DEFS, TRAITS } from '../../../shared/src/data/crew.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import type { ClientState } from '../state.ts';
import { TALENTS_BY_ID } from '../../../shared/src/data/talents.ts';
import { dict, lang, plural } from '../i18n.ts';
import { personName } from '../lang/names.ts';
import { EN, RU } from '../lang/ui/crew.ts';
import { serverText } from '../lang/server.ts';
import { keyLabel, settings } from '../settings.ts';
import type { Action } from '../settings.ts';
import { ask } from './confirm.ts';
import { dec1, esc, fmt, icon, money, officerIcon } from './dom.ts';
import { LC, officerName, practiceHtml, woundedHtml } from './crewlife.ts';
import { armyPanel } from './army.ts';

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
  const tile = (pic: string, label: string, value: string) =>
    `<div class="stat-tile">${icon(pic, '', 'stat-ico')}<span class="stat-l">${esc(label)}</span><b class="stat-v">${value}</b></div>`;
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2></div><div class="muted">${esc(L('close', { key: kb('crew') }))}</div></div>
    <div class="modal-body"><div class="stat-grid four">
      ${tile('stat_crew', L('st.souls'), esc(souls))}
      ${tile('xp', L('st.skill'), `<span class="stars">${stars(c.skill)}</span> ${dec1(c.skill)}`)}
      ${tile('tree_command', L('st.morale'), `${morale} <small>${esc(spirit)}</small>${c.mood ? ` <small class="${c.mood === 'shanty' ? 'good' : 'bad'}">${c.mood === 'shanty' ? '♪ ' : ''}${esc(LC(`mood.${c.mood}`))}</small>` : ''}`)}
      ${tile('menu_crew', L('st.loyalty'), String(c.loyalty))}
    </div>
    ${armyPanel(c.army ?? [], c.armySlots ?? 7)}
    ${c.unrest ? `<div class="alert-row">${icon('danger', '', 'ico-md')}<span class="bad">${esc(serverText(c.unrest))}</span></div>` : ''}
    <div class="cols" style="margin-top:12px"><div>
      <h3 class="title-sm" style="font-size:20px">${esc(L('trades'))}</h3>
      <div class="prof-list">${PROFESSIONS.map((k) => `<div class="prof-row" title="${esc(PROFESSION_DEFS[k].description)}">${icon(`prof_${k}`, '', 'item-ico')}<div class="item-text"><b>${esc(PROFESSION_DEFS[k].name)}</b><span class="muted">${money(PROFESSION_DEFS[k].wage)}${esc(L('perHour'))}</span></div><b class="prof-n">${c.pools[k]}</b></div>`).join('')}</div>
      <p class="muted">${esc(L('wages', { sum: fmt(c.wagesPerHour) }))}${c.owed ? esc(L('owed', { sum: fmt(c.owed) })) : ''}${esc(L('hireHint'))}</p>
      <div class="card"><h4 class="card-h">${icon('coin', '', 'ico-md')}${esc(L('codex'))}</h4>
        <div class="row"><input id="codex" type="range" min="0" max="50" step="5" value="${c.share}" style="flex:1"><b id="codex-v">${c.share}%</b></div>
        <p class="muted">${esc(L('codexFair', { share: c.expectedShare }))}</p></div>
      ${c.traits.length ? `<div class="card"><h4 class="card-h">${icon('menu_crew', '', 'ico-md')}${esc(L('character'))}</h4>${traitChips(c.traits)}</div>` : ''}
      ${self.fleet.slots || self.fleet.escorts.length ? `<div class="card"><h4 class="card-h">${icon('ab_call_escort', '', 'ico-md')}${esc(L('squadron', { n: self.fleet.escorts.length, slots: self.fleet.slots, key: kb('formation') }))}</h4>
        ${self.fleet.escorts.map((e) => `<p>${esc(e.name)} <span class="muted">${esc(e.atSea ? L('escortHull', { hull: e.hull }) : L('atAnchor'))}</span></p>`).join('') || `<p class="muted">${esc(L('hireEscorts'))}</p>`}
        ${self.talents.cmd_signal_flags ? `<div class="row" style="gap:6px">${(['line', 'wedge', 'ring'] as const).map((f) => `<button class="btn btn-small ${self.fleet.formation === f ? 'btn-primary' : ''}" data-form="${f}" title="${esc(f === 'line' ? L('form.lineTip', { talent: TALENTS_BY_ID.cmd_line_of_battle?.name ?? '' }) : L(`form.${f}Tip`))}">${esc(L(`form.${f}`))}</button>`).join('')}</div>` : ''}</div>` : ''}
      ${c.memorial.length ? `<div class="card"><h4 class="card-h">${icon('danger', '', 'ico-md')}${esc(L('memorial'))}</h4>${c.memorial.map((m) => `<p>† ${esc(m.name)}, ${esc(OFFICER_DEFS[m.role].name.toLowerCase())} — ${esc(serverText(m.cause))}</p>`).join('')}</div>` : ''}
    </div><div>
      <h3 class="title-sm" style="font-size:20px">${esc(L('officers', { n: c.officers.length, slots: c.slots }))}</h3>
      ${c.officers.map((o) => {
        const def = OFFICER_DEFS[o.role];
        const left = Math.max(0, o.orderReady - now);
        return `<div class="card officer-card">${officerIcon(o, 'officer-ico')}<div class="quest-body"><h4>${esc(officerName(o))} <span class="muted">${esc(L('officerLevel', { role: lang() === 'ru' ? def.name.toLowerCase() : def.name, level: o.level }))}</span></h4>
          <p>${traitChips(o.traits)}</p>
          ${o.fate ? fateHtml(state, o.id, o.fate) : ''}
          <p class="muted">${esc(def.description)}</p>
          <div class="row"><span class="with-ico">${icon('menu_crew', '', 'ico-sm')}${esc(L('loyalty', { n: o.loyalty }))}${o.warned ? ` <span class="bad">${esc(L('restless'))}</span>` : ''}${o.wound ? ` · <span class="bad">${esc(L(`wound.${o.wound}`))}</span>` : ''}${o.away ? ` · <span class="bad">${esc(L('captive'))}</span>` : ''}</span>
            <span><button class="btn btn-small" data-order="${o.id}" ${left > 0 || o.away ? 'disabled' : ''} title="${esc(def.order.description)}">${esc(def.order.name)}${left > 0 ? esc(L('cooldown', { s: Math.ceil(left) })) : ''}</button>
            ${self.dockedAt ? `<button class="btn btn-small btn-danger" data-dismiss="${o.id}">${esc(L('payOff'))}</button>` : ''}</span></div></div></div>`;
      }).join('') || `<p class="muted">${esc(L('noOfficers'))}</p>`}
      ${woundedHtml(c.wounded)}
      ${practiceHtml(c.pools, c.practice)}
    </div></div></div>`;
  const slider = root.querySelector<HTMLInputElement>('#codex')!;
  slider.oninput = () => (root.querySelector('#codex-v')!.textContent = `${slider.value}%`);
  slider.onchange = () => send({ t: 'codex', share: Number(slider.value) });
  root.querySelectorAll<HTMLElement>('[data-form]').forEach((el) => (el.onclick = () => send({ t: 'formation', formation: el.dataset.form as 'line' })));
  root.querySelectorAll<HTMLElement>('[data-order]').forEach((el) => (el.onclick = () => send({ t: 'officer', action: 'order', id: el.dataset.order! })));
  root.querySelectorAll<HTMLElement>('[data-fulfil]').forEach((el) => (el.onclick = () => send({ t: 'officer', action: 'fulfil', id: el.dataset.fulfil! })));
  root.querySelectorAll<HTMLElement>('[data-dismiss]').forEach((el) => (el.onclick = () => {
    void ask(L('confirmPayOff')).then((ok) => ok && send({ t: 'officer', action: 'dismiss', id: el.dataset.dismiss! }));
  }));
}

/** An officer's fate (docs/12 P10 #11): the past, a request (with its deed when it can be done here), a love. */
function fateHtml(state: ClientState, id: string, f: NonNullable<NonNullable<ClientState['self']>['company']['officers'][number]['fate']>): string {
  const ru = lang() === 'ru' ? 1 : 0;
  const portName = (pid?: string) => placeName(state.ports.find((p) => p.id === pid)?.name ?? pid ?? '');
  const r = f.request;
  let req = '';
  if (r) {
    const text = REQUESTS[r.kind][ru].replace('{port}', portName(r.port)).replace('{island}', placeName(state.islands.get(r.island ?? -1)?.name ?? '…')).replace('{n}', String(r.n ?? 0));
    const can = (r.kind === 'brother' || r.kind === 'debt') && state.self?.dockedAt === r.port;
    req = `<div class="fate-req"><span class="giver-h">${esc(L('fate.request'))}</span><p><i>«${esc(text)}»</i></p>${can ? `<button class="btn btn-small btn-primary" data-fulfil="${esc(id)}">${esc(L('fate.pay', { n: r.n ?? 0 }))}</button>` : ''}</div>`;
  }
  const love = f.love ? `<p class="fate-love">${esc(L('fate.love', { name: f.love.name, port: portName(f.love.port) }))}</p>` : '';
  return `<p class="fate-past muted"><i>${esc(PASTS[f.past]?.[ru] ?? '')}</i></p>${req}${love}`;
}

export function renderMutiny(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const m = state.self?.company.mutiny;
  if (!m) return;
  root.innerHTML = `<div class="modal-body"><div class="center-card">
    <h2 class="title-sm" style="font-size:40px;color:var(--bad)">${esc(L('mutiny'))}</h2>
    <p style="font-family:var(--serif);font-size:18px;color:var(--fog)">${esc(L('mutinyText', { leader: personName(m.ringleader), men: `${m.mutineers} ${plural(m.mutineers, L('man.one'), L('man.few'), L('man.many'))}`, s: m.left }))}</p>
    <div class="choice-grid">
      <button class="btn choice" data-mut="pay">${icon('coin', '', 'choice-ico')}<span>${esc(L('mut.pay', { sum: fmt(m.payCost) }))}</span></button>
      <button class="btn btn-danger choice" data-mut="suppress">${icon('prof_marine', '', 'choice-ico')}<span>${esc(L('mut.suppress'))}</span></button>
      <button class="btn choice" data-mut="duel">${icon('tree_boarding', '', 'choice-ico')}<span>${esc(L('mut.duel'))}</span></button>
      <button class="btn choice" data-mut="yield">${icon('anchor', '', 'choice-ico')}<span>${esc(L('mut.yield'))}</span></button>
    </div></div></div>`;
  root.querySelectorAll<HTMLElement>('[data-mut]').forEach((el) => (el.onclick = () => send({ t: 'mutiny', choice: el.dataset.mut as 'pay' })));
}
