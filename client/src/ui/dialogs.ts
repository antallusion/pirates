// Boarding plunder, shipwreck, ship/cargo and help dialogs.

import { GOODS } from '../../../shared/src/data/goods.ts';
import { placeName } from './maps.ts';
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
import { assetUrl } from '../assets.ts';
import { esc, fmt, icon, money, xpBadge } from './dom.ts';

const L = dict(EN, RU);

/** The key bound to an action, as it reads on screen. */
function kb(a: Action): string {
  const [first, second] = settings().keys[a];
  const k = first || second;
  return k === ' ' ? L('key.space') : keyLabel(k);
}

const talentName = (id: string) => TALENTS_BY_ID[id]?.name ?? id;
const portName = (id: string) => placeName(KEY_PORTS.find((p) => p.id === id)?.name ?? id);

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
    root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('board.title', { name: placeName(r.targetName) }))}</h2><div class="sub">${esc(L('board.sub', { cls: SHIP_CLASSES[r.targetClass].name, ours: r.crewLost, theirs: r.enemyCrewLost }))}</div></div></div>
      <div class="modal-body"><div class="cols"><div>
        <h3 class="title-sm" style="font-size:20px">${esc(L('board.cargo'))}</h3>
        ${goods.length ? goods.map((g) => `<div class="loot-grid">${icon(`good_${g}`, '', 'item-ico')}<div class="item-text"><b>${esc(GOODS[g].name)}</b><span class="muted">${esc(L('board.aboard', { n: r.cargo[g] ?? 0 }))}${state.self?.appraisal?.[g] ? ` · ${money(state.self.appraisal[g]!.price)}` : ''}</span></div><b class="loot-take">${take[g] ?? 0}</b>
          <input type="range" min="0" max="${r.cargo[g]}" value="${take[g] ?? 0}" data-g="${g}" /></div>`).join('') : `<p class="muted">${esc(L('board.empty'))}</p>`}
        <p class="${used > holdMax ? 'up' : 'muted'}">${esc(L('board.hold', { used: used.toFixed(1), max: holdMax.toFixed(0) }))}</p>
        ${Object.keys(r.destroyed).length ? `<p class="muted">${esc(L('board.destroyed', { list: Object.entries(r.destroyed).map(([g, n]) => `${n} ${GOODS[g as GoodId].name}`).join(', ') }))}</p>` : ''}
      </div><div>
        <div class="card"><h4 class="card-h">${icon('coin', '', 'ico-md')}${esc(L('board.coin'))}</h4><div class="spoils">${money(r.gold)}${AMMO_IDS.filter((a) => r.ammo[a] > 0).map((a) => `<span class="ammo-chip" title="${esc(AMMO[a].name)}">${icon(`ammo_${a}`, '', 'ico-md')}<b>${r.ammo[a]}</b></span>`).join('')}</div></div>
        ${r.recruits > 0 ? `<div class="card"><h4 class="card-h">${icon('stat_crew', '', 'ico-md')}${esc(L('board.prisoners'))}</h4><p>${esc(L('board.prisonersText', { n: r.recruits }))}</p><div class="loot-row"><span>${esc(L('board.signOn'))}</span><b>${recruit}</b><input type="range" min="0" max="${r.recruits}" value="${recruit}" id="recruit" /></div></div>` : ''}
        <div class="card"><h4 class="card-h">${icon('tree_boarding', '', 'ico-md')}${esc(L('board.fate'))}</h4>
          ${r.noQuarter ? `<p class="bad">${esc(L('board.noQuarter', { talent: talentName('brd_no_quarter') }))}</p><div class="choice-grid one"><button class="btn btn-danger choice" data-fate="sink">${icon('fire', '', 'choice-ico')}<span>${esc(L('board.burn'))}</span></button></div>` : `
          <p>${esc(L('board.fateText'))}${r.npc ? esc(L('board.ransomOffer', { sum: fmt(r.ransom) })) : ''}${r.captive ? esc(L('board.captive')) : ''}</p>
          <div class="choice-grid one">
          <button class="btn btn-danger choice" data-fate="sink">${icon('fire', '', 'choice-ico')}<span>${esc(L('board.scuttle'))}</span></button>
          <button class="btn choice" data-fate="release">${icon('anchor', '', 'choice-ico')}<span>${esc(L('board.release'))}</span></button>
          ${r.npc ? `<button class="btn btn-primary choice" data-fate="ransom">${icon('coin', '', 'choice-ico')}<span>${esc(L('board.ransom', { sum: fmt(r.ransom) }))}</span></button>` : ''}
          ${r.prize ? `<button class="btn btn-primary choice" data-fate="prize" title="${esc(L('board.prizeTip'))}">${icon('menu_ship', '', 'choice-ico')}<span>${esc(L('board.prize', { crew: r.prize.crew, value: fmt(r.prize.value) }))}</span></button>` : ''}
          </div>`}
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
    <div class="loss-list">
      <div class="loss-row">${icon('tab_market', '', 'item-ico')}<span>${esc(L('sunk.cargo'))}</span><b class="up">${money(lost.cargoValue)}</b></div>
      <div class="loss-row">${icon('stat_crew', '', 'item-ico')}<span>${esc(L('sunk.crew'))}</span><b class="up">${lost.crew}</b></div>
      <div class="loss-row">${icon('good_planks', '', 'item-ico')}<span>${esc(L('sunk.fee'))}</span><b class="up">${money(lost.repairFee)}</b></div>
    </div>
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
  const art = assetUrl(cls.sprite);
  // A figure with its picture: the stat tiles of the ship screen.
  const tile = (pic: string, label: string, value: string, flip = false) =>
    `<div class="stat-tile">${icon(pic, '', flip ? 'stat-ico flip' : 'stat-ico')}<span class="stat-l">${esc(label)}</span><b class="stat-v">${value}</b></div>`;
  const hasSale = cargo.some(([g]) => self.appraisal?.[g as GoodId]);
  const used = cargoVolume(self.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
  root.innerHTML = `<div class="modal-head ship-head"><div class="ship-hero">${art ? `<img src="${art}" alt="" draggable="false" />` : ''}</div><div><h2>${esc(self.loadout.name)}</h2><div class="sub">${esc(cls.name)} — ${esc(cls.role)}</div><div class="sub ship-passive">${icon('xp', '', 'ico-sm')}${esc(L('ship.passive', { name: cls.passive.name, text: cls.passive.description }))}</div></div><div class="muted">${esc(L('ship.close', { key: kb('ship') }))}</div></div>
    <div class="modal-body"><div class="stat-grid">
      ${tile('stat_sails', L('ship.speed'), esc(L('ship.speedVal', { v: st.maxSpeed.toFixed(1) })))}
      ${tile('menu_ship', L('ship.turn'), esc(L('ship.turnVal', { v: ((st.turnRate * 180) / Math.PI).toFixed(1) })))}
      ${tile('anchor', L('ship.draft'), `${esc(L('ship.draftVal', { v: cls.draft.toFixed(1) }))}<small>${esc(cls.passive.id === 'shallow_runner' ? L('ship.draftShallow', { name: cls.passive.name }) : L('ship.draftDeep'))}</small>`)}
      ${tile('wind', L('ship.noGo'), esc(L('ship.noGoVal', { deg: st.noGoDeg.toFixed(0), rig: L(`rig.${cls.rig}`) })))}
      ${tile('stat_hull', L('ship.hull'), `${st.hullMax} / ${Math.round(st.armor * 100)}%`)}
      ${tile('stat_sails', L('ship.sails'), String(st.sailHpMax))}
      ${tile('stat_crew', L('ship.crew'), esc(L('ship.crewVal', { n: self.crew, min: st.crewMin, max: st.crewMax })))}
      ${tile('tab_market', L('ship.hold'), esc(L('ship.holdVal', { used: used.toFixed(1), max: st.holdVolume.toFixed(0), weight: st.holdWeight.toFixed(0) })))}
      ${tile(`gun_${self.loadout.guns.port}`, L('ship.port'), `${cls.gunPortsPerSide - self.gunsDisabled.port}/${cls.gunPortsPerSide}<small>${esc(GUNS[self.loadout.guns.port].name)}</small>`, true)}
      ${tile(`gun_${self.loadout.guns.starboard}`, L('ship.starboard'), `${cls.gunPortsPerSide - self.gunsDisabled.starboard}/${cls.gunPortsPerSide}<small>${esc(GUNS[self.loadout.guns.starboard].name)}</small>`)}
      ${tile('fire', L('ship.gunMuls'), `×${st.reloadMul.toFixed(2)} / ×${st.spreadMul.toFixed(2)} / ×${st.gunDamageMul.toFixed(2)}`)}
      ${tile('tree_boarding', L('ship.boarding'), esc(L('ship.boardingVal', { range: st.boardingRange.toFixed(0), power: st.boardingPower.toFixed(2) })))}
      ${tile('ab_spotters_eye', L('ship.detection'), esc(L('ship.detectionVal', { v: st.detection.toFixed(0) })))}
      ${tile('insurance', L('ship.insurance'), esc(self.insured ? L('ship.insured') : L('ship.none')))}
    </div>
    <div class="cols" style="margin-top:12px"><div>
      <h3 class="title-sm" style="font-size:20px">${esc(L('ship.hold'))}</h3>
      <div class="cargo-list${hasSale ? ' has-sale' : ''}${self.dockedAt ? '' : ' has-dump'}">${cargo.map(([g, n]) => {
        const a = self.appraisal?.[g as GoodId];
        const where = a ? state.ports.find((p) => p.id === a.port)?.name ?? a.port : '';
        const good = GOODS[g as GoodId];
        return `<div class="cargo-row">${icon(`good_${g}`, '', 'item-ico')}
          <div class="item-text"><b class="${good.contraband ? 'contra' : ''}">${esc(good.name)}</b><span class="muted">${esc(L('ship.volume'))} ${((n ?? 0) * good.volume).toFixed(1)} · ${esc(L('ship.weight'))} ${((n ?? 0) * good.weight).toFixed(1)}${a ? ` · ${esc(where)}` : ''}</span></div>
          <b class="cargo-qty">×${Math.floor(n ?? 0)}</b>
          ${hasSale ? `<span class="cargo-sale">${a ? money(a.price * Math.floor(n ?? 0)) : ''}</span>` : ''}
          ${self.dockedAt ? '' : `<button class="btn btn-small btn-danger" data-dump="${g}" title="${esc(L('ship.overboard'))}">⤓</button>`}</div>`;
      }).join('') || `<p class="muted">${esc(L('ship.emptyHold'))}</p>`}</div>
      <div class="ammo-chips">${AMMO_IDS.map((a) => `<span class="ammo-chip" title="${esc(AMMO[a].name)}">${icon(`ammo_${a}`, '', 'ico-md')}<b>${self.ammo[a]}</b></span>`).join('')}</div>
      ${self.talents.shp_field_forge && !self.dockedAt ? `<div class="card"><h4>${esc(talentName('shp_field_forge'))}</h4><p class="muted">${esc(L('ship.forgeText'))}</p>
        <div class="forge-grid"><button class="btn btn-small" data-craft="round">${icon('ammo_round', '', 'ico-sm')}${esc(L('ship.forgeRound'))}</button><button class="btn btn-small" data-craft="chain">${icon('ammo_chain', '', 'ico-sm')}${esc(L('ship.forgeChain'))}</button><button class="btn btn-small" data-craft="grape">${icon('ammo_grape', '', 'ico-sm')}${esc(L('ship.forgeGrape'))}</button><button class="btn btn-small" data-craft="planks">${icon('good_planks', '', 'ico-sm')}${esc(L('ship.forgePlanks'))}</button></div></div>` : ''}
    </div><div>
      <h3 class="title-sm" style="font-size:20px">${esc(L('ship.contracts'))}</h3>${self.contracts.map((c) => `<div class="card quest-card small">${icon(c.kind === 'bounty' ? 'wanted' : c.kind === 'delivery' && c.good ? `good_${c.good}` : 'map_contract', '', 'quest-ico')}<div class="quest-body"><b>${esc(serverText(c.title))}</b><div class="reward">${money(c.reward)}${xpBadge(c.xp)}</div></div></div>`).join('') || `<p class="muted">${esc(L('ship.noContracts'))}</p>`}
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
  const keys: [string, string, string][] = [
    ['stat_sails', `${kb('sailUp')} / ${kb('sailDown')}`, L('help.sail')],
    ['menu_ship', `${kb('rudderLeft')} / ${kb('rudderRight')}`, L('help.rudder')],
    ['fire', `${kb('firePort')} / ${kb('fireStarboard')}, ${L('key.lmb')}`, L('help.fire')],
    ['ammo_round', range('ammo1', 'ammo5'), L('help.ammo')],
    ['ammo_cursed', kb('cursedShot'), L('help.cursed')],
    ['mount_mortar', L('key.rmb'), L('help.mount')],
    ['chasers', kb('chasers'), L('help.chasers')],
    ['ab_double_shot', `${kb('abilityZ')} ${kb('abilityX')} ${kb('abilityC')} / ${kb('abilityV')}`, L('help.abilities')],
    ['menu_talents', range('talent1', 'talent5'), L('help.talents', { a: talentName('nav_spill_the_wind'), b: talentName('nav_anchor_pivot') })],
    ['gun_long_9', kb('fireMode'), L('help.fireMode', { talent: talentName('gun_rolling_broadside') })],
    ['ammo_chain', L('key.loaded', { keys: range('ammo1', 'ammo5') }), L('help.draw', { talent: talentName('gun_quick_swap') })],
    ['tree_boarding', kb('board'), L('help.board')],
    ['prof_marine', `Shift+${kb('board')}`, L('help.boardCareful', { ctrl: `Ctrl+${kb('board')}` })],
    ['ab_red_hook_boarding', L('key.boarding', { key: kb('board') }), L('help.cut')],
    ['map_cove', kb('land'), L('help.land')],
    ['menu_crew', kb('orders'), L('help.orders')],
    ['good_planks', kb('repair'), L('help.repair', { talent: talentName('srv_battle_repair') })],
    ['anchor', kb('dock'), L('help.dock', { shift: `Shift+${kb('dock')}` })],
    ['ab_form_line', kb('formation'), L('help.formation', { talent: talentName('cmd_signal_flags') })],
    ['menu_map', `${kb('map')} · ${kb('talents')} · ${kb('ship')} · ${kb('crew')}`, L('help.screens')],
    ['ab_spotters_eye', L('key.wheel'), L('help.zoom')],
    ['opt_sound', kb('mute'), L('help.mute')],
    ['menu_company', kb('company'), L('help.company', { auction: portName('tidewrack') })],
    ['menu_chat', L('key.enter'), L('help.chat')],
  ];
  const touch: [string, string][] = [
    ['menu_ship', L('help.t.stick')],
    ['stat_sails', L('help.t.sail')],
    ['fire', L('help.t.fire')],
    ['chasers', L('help.t.chasers')],
    ['mount_mortar', L('help.t.mount')],
    ['anchor', L('help.t.context')],
    ['ab_spotters_eye', L('help.t.zoom')],
    ['menu_map', L('help.t.menu')],
    ['ammo_round', L('help.ammo')],
    ['menu_crew', L('help.orders')],
  ];
  const isTouch = document.body.classList.contains('touch');
  const rows = isTouch
    ? touch.map(([pic, d]) => `<div class="help-row">${icon(pic, '', 'item-ico')}<span>${esc(d)}</span></div>`).join('')
    : keys.map(([pic, k, d]) => `<div class="help-row">${icon(pic, '', 'item-ico')}<span><kbd>${esc(k)}</kbd> ${esc(d)}</span></div>`).join('');
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('help.title'))}</h2><div class="sub">${esc(L('help.sub'))}</div></div><div class="muted">${esc(L('help.close', { key: kb('help') }))}</div></div>
    <div class="modal-body"><div class="cols"><div class="help-list">${rows}</div>
    <div><div class="card"><h4 class="card-h">${icon('good_provisions', '', 'ico-md')}${esc(L('help.firstVoyage'))}</h4><p>${esc(L('help.firstVoyageText', { start: portName('saltmarrow'), second: portName('blackwater'), coast: REGIONS.black_coast.name.replace(/^The /, 'the '), capital: portName('gravesend') }))}</p></div>
    <div class="card"><h4 class="card-h">${icon('wanted', '', 'ico-md')}${esc(L('help.law'))}</h4><p>${esc(L('help.lawText', { a: portName('cinderhold'), b: portName('fogmouth') }))}</p></div>
    <div class="card"><h4 class="card-h">${icon('danger', '', 'ico-md')}${esc(L('help.risk'))}</h4><p>${esc(L('help.riskText', { safe: REGIONS.black_coast.name.replace(/^The /, '') }))}</p></div>${logbookHtml(onboarding)}</div></div></div>`;
}
