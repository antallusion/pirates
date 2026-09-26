// Boarding plunder, shipwreck, ship/cargo and help dialogs.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { AMMO_IDS, AMMO, SHIP_CLASSES, GUNS } from '../../../shared/src/data/ships.ts';
import type { BoardingResult, ClientMsg, OnboardingView } from '../../../shared/src/protocol.ts';
import { TALENTS_BY_ID } from '../../../shared/src/data/talents.ts';
import { KEY_PORTS, REGIONS } from '../../../shared/src/world/regions.ts';
import { dict, t } from '../i18n.ts';
import { EN, RU } from '../lang/ui/dialogs.ts';
import { serverText } from '../lang/server.ts';
import { keyLabel, settings } from '../settings.ts';
import type { Action } from '../settings.ts';
import { logbookHtml } from './onboarding.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon } from './dom.ts';

const L = dict(EN, RU);

/** The key bound to an action, as it reads on screen. */
function kb(a: Action): string {
  const [first, second] = settings().keys[a];
  const k = first || second;
  return k === ' ' ? L('key.space') : keyLabel(k);
}

const talentName = (id: string) => TALENTS_BY_ID[id]?.name ?? id;
const portName = (id: string) => KEY_PORTS.find((p) => p.id === id)?.name ?? id;

export function renderBoarding(root: HTMLElement, r: BoardingResult, state: ClientState, send: (m: ClientMsg) => void, close: () => void): void {
  const take: Cargo = {};
  let recruit = r.recruits;
  const mul = state.ownStats?.contrabandVolumeMul ?? 1;
  const holdMax = state.ownStats?.holdVolume ?? 0;
  const base = cargoVolume(state.self?.cargo ?? {}, mul, state.ownStats?.materialVolumeMul ?? 1, state.ownStats?.provisionVolumeMul ?? 1, state.ownStats?.cursedVolumeMul ?? 1);
  const goods = Object.keys(r.cargo) as GoodId[];
  // Default: take the most valuable goods per volume that fit.
  let free = holdMax - base;
  for (const g of [...goods].sort((a, b) => GOODS[b].basePrice / GOODS[b].volume - GOODS[a].basePrice / GOODS[a].volume)) {
    const per = GOODS[g].volume * (GOODS[g].contraband ? mul : 1);
    const n = Math.min(r.cargo[g] ?? 0, Math.floor(free / per));
    if (n > 0) {
      take[g] = n;
      free -= n * per;
    }
  }
  const draw = () => {
    const used = base + cargoVolume(take, mul);
    root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('board.title', { name: r.targetName }))}</h2><div class="sub">${esc(L('board.sub', { cls: SHIP_CLASSES[r.targetClass].name, ours: r.crewLost, theirs: r.enemyCrewLost }))}</div></div></div>
      <div class="modal-body"><div class="cols"><div>
        <h3 class="title-sm" style="font-size:20px">${esc(L('board.cargo'))}</h3>
        ${goods.length ? goods.map((g) => `<div class="loot-row"><span>${icon(`good_${g}`)}${esc(GOODS[g].name)} <span class="muted">(${r.cargo[g]})</span>${state.self?.appraisal?.[g] ? ` <span class="gold" title="${esc(L('board.bestPrice'))}">${esc(L('board.perUnit', { price: fmt(state.self.appraisal[g]!.price) }))}</span>` : ''}</span><b>${take[g] ?? 0}</b>
          <input type="range" min="0" max="${r.cargo[g]}" value="${take[g] ?? 0}" data-g="${g}" /></div>`).join('') : `<p class="muted">${esc(L('board.empty'))}</p>`}
        <p class="${used > holdMax ? 'up' : 'muted'}">${esc(L('board.hold', { used: used.toFixed(1), max: holdMax.toFixed(0) }))}</p>
        ${Object.keys(r.destroyed).length ? `<p class="muted">${esc(L('board.destroyed', { list: Object.entries(r.destroyed).map(([g, n]) => `${n} ${GOODS[g as GoodId].name}`).join(', ') }))}</p>` : ''}
      </div><div>
        <div class="card"><h4>${esc(L('board.coin'))}</h4><p>${esc(L('board.coinText', { gold: fmt(r.gold), ammo: AMMO_IDS.map((a) => `${r.ammo[a]} ${AMMO[a].name.toLowerCase()}`).join(', ') }))}</p></div>
        ${r.recruits > 0 ? `<div class="card"><h4>${esc(L('board.prisoners'))}</h4><p>${esc(L('board.prisonersText', { n: r.recruits }))}</p><div class="loot-row"><span>${esc(L('board.signOn'))}</span><b>${recruit}</b><input type="range" min="0" max="${r.recruits}" value="${recruit}" id="recruit" /></div></div>` : ''}
        <div class="card"><h4>${esc(L('board.fate'))}</h4>
          ${r.noQuarter ? `<p class="bad">${esc(L('board.noQuarter', { talent: talentName('brd_no_quarter') }))}</p><button class="btn btn-danger" data-fate="sink">${esc(L('board.burn'))}</button>` : `
          <p>${esc(L('board.fateText'))}${r.npc ? esc(L('board.ransomOffer', { sum: fmt(r.ransom) })) : ''}${r.captive ? esc(L('board.captive')) : ''}</p>
          <button class="btn btn-danger" data-fate="sink">${esc(L('board.scuttle'))}</button>
          <button class="btn" data-fate="release">${esc(L('board.release'))}</button>
          ${r.npc ? `<button class="btn btn-primary" data-fate="ransom">${esc(L('board.ransom', { sum: fmt(r.ransom) }))}</button>` : ''}
          ${r.prize ? `<button class="btn btn-primary" data-fate="prize" title="${esc(L('board.prizeTip'))}">${esc(L('board.prize', { crew: r.prize.crew, value: fmt(r.prize.value) }))}</button>` : ''}`}
        </div></div></div></div>`;
    root.querySelectorAll<HTMLInputElement>('input[type=range][data-g]').forEach((el) => (el.oninput = () => {
      take[el.dataset.g as GoodId] = Number(el.value);
      draw();
    }));
    const rec = root.querySelector<HTMLInputElement>('#recruit');
    if (rec) rec.oninput = () => {
      recruit = Number(rec.value);
      draw();
    };
    root.querySelectorAll<HTMLElement>('[data-fate]').forEach((el) => (el.onclick = () => {
      send({ t: 'loot_take', take, fate: el.dataset.fate as 'sink' | 'prize', recruit });
      close();
    }));
  };
  draw();
}

export function renderSunk(root: HTMLElement, lost: { cargoValue: number; crew: number; repairFee: number }, portName: string, close: () => void, towed = false): void {
  if (towed) {
    // The First Watch: the soft version, so the real one is recognised later.
    root.innerHTML = `<div class="modal-body"><div class="center-card">
      <h2 class="title-sm" style="font-size:40px">${esc(t('towed.title'))}</h2>
      <p style="font-family:var(--serif);font-size:18px;color:var(--fog)">${esc(t('towed.body', { port: portName }))}</p>
      <button class="btn btn-primary">${esc(t('towed.ok'))}</button></div></div>`;
    root.querySelector('button')!.onclick = close;
    return;
  }
  root.innerHTML = `<div class="modal-body"><div class="center-card">
    <h2 class="title-sm" style="font-size:40px">${esc(L('sunk.title'))}</h2>
    <p style="font-family:var(--serif);font-size:18px;color:var(--fog)">${esc(L('sunk.body', { port: portName }))}</p>
    <table class="grid" style="max-width:360px;margin:16px auto"><tr><td>${esc(L('sunk.cargo'))}</td><td class="up">${fmt(lost.cargoValue)}</td></tr>
    <tr><td>${esc(L('sunk.crew'))}</td><td class="up">${lost.crew}</td></tr><tr><td>${esc(L('sunk.fee'))}</td><td class="up">${fmt(lost.repairFee)}</td></tr></table>
    <p class="muted">${esc(L('sunk.note'))}</p>
    <button class="btn btn-primary">${esc(L('sunk.back'))}</button></div></div>`;
  root.querySelector('button')!.onclick = close;
}

export function renderShip(root: HTMLElement, state: ClientState, send?: (m: ClientMsg) => void): void {
  const self = state.self;
  const st = state.ownStats;
  if (!self || !st) return;
  const cls = SHIP_CLASSES[self.loadout.classId];
  const cargo = Object.entries(self.cargo).filter(([, n]) => (n ?? 0) > 0);
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(self.loadout.name)}</h2><div class="sub">${esc(cls.name)} — ${esc(cls.role)} ${esc(L('ship.passive', { name: cls.passive.name, text: cls.passive.description }))}</div></div><div class="muted">${esc(L('ship.close', { key: kb('ship') }))}</div></div>
    <div class="modal-body"><div class="cols"><div><table class="grid">
      <tr><td>${esc(L('ship.speed'))}</td><td>${esc(L('ship.speedVal', { v: st.maxSpeed.toFixed(1) }))}</td></tr><tr><td>${esc(L('ship.turn'))}</td><td>${esc(L('ship.turnVal', { v: ((st.turnRate * 180) / Math.PI).toFixed(1) }))}</td></tr>
      <tr><td>${esc(L('ship.draft'))}</td><td>${esc(L('ship.draftVal', { v: cls.draft.toFixed(1) }))}${esc(cls.passive.id === 'shallow_runner' ? L('ship.draftShallow', { name: cls.passive.name }) : L('ship.draftDeep'))}</td></tr>
      <tr><td>${esc(L('ship.noGo'))}</td><td>${esc(L('ship.noGoVal', { deg: st.noGoDeg.toFixed(0), rig: L(`rig.${cls.rig}`) }))}</td></tr><tr><td>${esc(L('ship.hull'))}</td><td>${st.hullMax} / ${Math.round(st.armor * 100)}%</td></tr>
      <tr><td>${esc(L('ship.sails'))}</td><td>${st.sailHpMax}</td></tr><tr><td>${esc(L('ship.crew'))}</td><td>${esc(L('ship.crewVal', { n: self.crew, min: st.crewMin, max: st.crewMax }))}</td></tr>
      <tr><td>${esc(L('ship.hold'))}</td><td>${esc(L('ship.holdVal', { used: cargoVolume(self.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul).toFixed(1), max: st.holdVolume.toFixed(0), weight: st.holdWeight.toFixed(0) }))}</td></tr>
      <tr><td>${esc(L('ship.port'))}</td><td>${cls.gunPortsPerSide - self.gunsDisabled.port}/${cls.gunPortsPerSide} × ${esc(GUNS[self.loadout.guns.port].name)}</td></tr>
      <tr><td>${esc(L('ship.starboard'))}</td><td>${cls.gunPortsPerSide - self.gunsDisabled.starboard}/${cls.gunPortsPerSide} × ${esc(GUNS[self.loadout.guns.starboard].name)}</td></tr>
      <tr><td>${esc(L('ship.gunMuls'))}</td><td>×${st.reloadMul.toFixed(2)} / ×${st.spreadMul.toFixed(2)} / ×${st.gunDamageMul.toFixed(2)}</td></tr>
      <tr><td>${esc(L('ship.boarding'))}</td><td>${esc(L('ship.boardingVal', { range: st.boardingRange.toFixed(0), power: st.boardingPower.toFixed(2) }))}</td></tr>
      <tr><td>${esc(L('ship.detection'))}</td><td>${esc(L('ship.detectionVal', { v: st.detection.toFixed(0) }))}</td></tr>
      <tr><td>${esc(L('ship.insurance'))}</td><td>${esc(self.insured ? L('ship.insured') : L('ship.none'))}</td></tr>
    </table></div><div><h3 class="title-sm" style="font-size:20px">${esc(L('ship.hold'))}</h3><table class="grid"><tr><th>${esc(L('ship.good'))}</th><th>${esc(L('ship.qty'))}</th><th>${esc(L('ship.volume'))}</th><th>${esc(L('ship.weight'))}</th>${self.appraisal ? `<th>${esc(L('ship.bestSale'))}</th>` : ''}</tr>
      ${cargo.map(([g, n]) => {
        const a = self.appraisal?.[g as GoodId];
        const where = a ? state.ports.find((p) => p.id === a.port)?.name ?? a.port : '';
        return `<tr><td class="${GOODS[g as GoodId].contraband ? 'contra' : ''}">${icon(`good_${g}`)}${esc(GOODS[g as GoodId].name)} ${self.dockedAt ? '' : `<button class="btn btn-small" data-dump="${g}" title="${esc(L('ship.overboard'))}">⤓</button>`}</td><td>${Math.floor(n ?? 0)}</td><td>${((n ?? 0) * GOODS[g as GoodId].volume).toFixed(1)}</td><td>${((n ?? 0) * GOODS[g as GoodId].weight).toFixed(1)}</td>${self.appraisal ? `<td>${a ? `<span class="gold">${fmt(a.price * Math.floor(n ?? 0))}</span> <span class="muted">${esc(where)}</span>` : '<span class="muted">—</span>'}</td>` : ''}</tr>`;
      }).join('') || `<tr><td colspan="4" class="muted">${esc(L('ship.emptyHold'))}</td></tr>`}
      </table><p class="muted">${esc(L('ship.ammo', { list: AMMO_IDS.map((a) => `${self.ammo[a]} ${AMMO[a].name.toLowerCase()}`).join(' · ') }))}</p>
      ${self.talents.shp_field_forge && !self.dockedAt ? `<div class="card"><h4>${esc(talentName('shp_field_forge'))}</h4><p class="muted">${esc(L('ship.forgeText'))}</p>
        <button class="btn btn-small" data-craft="round">${esc(L('ship.forgeRound'))}</button> <button class="btn btn-small" data-craft="chain">${esc(L('ship.forgeChain'))}</button> <button class="btn btn-small" data-craft="grape">${esc(L('ship.forgeGrape'))}</button> <button class="btn btn-small" data-craft="planks">${esc(L('ship.forgePlanks'))}</button></div>` : ''}
      <h3 class="title-sm" style="font-size:20px">${esc(L('ship.contracts'))}</h3>${self.contracts.map((c) => `<div class="card"><b>${esc(serverText(c.title))}</b> <span class="gold">${fmt(c.reward)}</span></div>`).join('') || `<p class="muted">${esc(L('ship.noContracts'))}</p>`}
    </div></div></div>`;
  root.querySelectorAll<HTMLElement>('[data-craft]').forEach((el) => (el.onclick = () => send?.({ t: 'craft', recipe: el.dataset.craft as 'round', n: 10 })));
  root.querySelectorAll<HTMLElement>('[data-dump]').forEach((el) => (el.onclick = () => {
    const g = el.dataset.dump as GoodId;
    const n = Math.floor(self.cargo[g] ?? 0);
    if (send && confirm(L('ship.jettison', { n, good: GOODS[g].name }))) send({ t: 'jettison', good: g, qty: n });
  }));
}

export function renderHelp(root: HTMLElement, onboarding: OnboardingView | null = null): void {
  const range = (a: Action, b: Action) => `${kb(a)} – ${kb(b)}`;
  const keys: [string, string][] = [
    [`${kb('sailUp')} / ${kb('sailDown')}`, L('help.sail')],
    [`${kb('rudderLeft')} / ${kb('rudderRight')}`, L('help.rudder')],
    [`${kb('firePort')} / ${kb('fireStarboard')}, ${L('key.lmb')}`, L('help.fire')],
    [range('ammo1', 'ammo5'), L('help.ammo')],
    [kb('cursedShot'), L('help.cursed')],
    [L('key.rmb'), L('help.mount')],
    [kb('chasers'), L('help.chasers')],
    [`${kb('abilityZ')} ${kb('abilityX')} ${kb('abilityC')} / ${kb('abilityV')}`, L('help.abilities')],
    [range('talent1', 'talent5'), L('help.talents', { a: talentName('nav_spill_the_wind'), b: talentName('nav_anchor_pivot') })],
    [kb('fireMode'), L('help.fireMode', { talent: talentName('gun_rolling_broadside') })],
    [L('key.loaded', { keys: range('ammo1', 'ammo5') }), L('help.draw', { talent: talentName('gun_quick_swap') })],
    [kb('board'), L('help.board')],
    [`Shift+${kb('board')}`, L('help.boardCareful', { ctrl: `Ctrl+${kb('board')}` })],
    [L('key.boarding', { key: kb('board') }), L('help.cut')],
    [kb('land'), L('help.land')],
    [kb('orders'), L('help.orders')],
    [kb('repair'), L('help.repair', { talent: talentName('srv_battle_repair') })],
    [kb('dock'), L('help.dock', { shift: `Shift+${kb('dock')}` })],
    [kb('formation'), L('help.formation', { talent: talentName('cmd_signal_flags') })],
    [`${kb('map')} · ${kb('talents')} · ${kb('ship')} · ${kb('crew')}`, L('help.screens')],
    [L('key.wheel'), L('help.zoom')],
    [kb('mute'), L('help.mute')],
    [kb('company'), L('help.company', { auction: portName('tidewrack') })],
    [L('key.enter'), L('help.chat')],
  ];
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('help.title'))}</h2><div class="sub">${esc(L('help.sub'))}</div></div><div class="muted">${esc(L('help.close', { key: kb('help') }))}</div></div>
    <div class="modal-body"><div class="cols"><div class="help-grid">${keys.map(([k, d]) => `<kbd>${esc(k)}</kbd><span>${esc(d)}</span>`).join('')}</div>
    <div><div class="card"><h4>${esc(L('help.firstVoyage'))}</h4><p>${esc(L('help.firstVoyageText', { start: portName('saltmarrow'), second: portName('blackwater'), coast: REGIONS.black_coast.name.replace(/^The /, 'the '), capital: portName('gravesend') }))}</p></div>
    <div class="card"><h4>${esc(L('help.law'))}</h4><p>${esc(L('help.lawText', { a: portName('cinderhold'), b: portName('fogmouth') }))}</p></div>
    <div class="card"><h4>${esc(L('help.risk'))}</h4><p>${esc(L('help.riskText', { safe: REGIONS.black_coast.name.replace(/^The /, '') }))}</p></div>${logbookHtml(onboarding)}</div></div></div>`;
}
