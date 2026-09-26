// Boarding plunder, shipwreck, ship/cargo and help dialogs.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { AMMO_IDS, AMMO, SHIP_CLASSES, GUNS } from '../../../shared/src/data/ships.ts';
import type { BoardingResult, ClientMsg } from '../../../shared/src/protocol.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt } from './dom.ts';

export function renderBoarding(root: HTMLElement, r: BoardingResult, state: ClientState, send: (m: ClientMsg) => void, close: () => void): void {
  const take: Cargo = {};
  const mul = state.ownStats?.contrabandVolumeMul ?? 1;
  const holdMax = state.ownStats?.holdVolume ?? 0;
  const base = cargoVolume(state.self?.cargo ?? {}, mul);
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
    root.innerHTML = `<div class="modal-head"><div><h2>Prize: ${esc(r.targetName)}</h2><div class="sub">${esc(SHIP_CLASSES[r.targetClass].name)} taken. Your losses: ${r.crewLost} crew. Theirs: ${r.enemyCrewLost}.</div></div></div>
      <div class="modal-body"><div class="cols"><div>
        <h3 class="title-sm" style="font-size:20px">Cargo that survived</h3>
        ${goods.length ? goods.map((g) => `<div class="loot-row"><span>${esc(GOODS[g].name)} <span class="muted">(${r.cargo[g]})</span></span><b>${take[g] ?? 0}</b>
          <input type="range" min="0" max="${r.cargo[g]}" value="${take[g] ?? 0}" data-g="${g}" /></div>`).join('') : '<p class="muted">Her hold is empty.</p>'}
        <p class="${used > holdMax ? 'up' : 'muted'}">Your hold: ${used.toFixed(1)} / ${holdMax.toFixed(0)}</p>
        ${Object.keys(r.destroyed).length ? `<p class="muted">Destroyed in the fight: ${Object.entries(r.destroyed).map(([g, n]) => `${n} ${esc(GOODS[g as GoodId].name)}`).join(', ')}</p>` : ''}
      </div><div>
        <div class="card"><h4>Coin & shot</h4><p>${fmt(r.gold)} silver from her strongbox; ${AMMO_IDS.map((a) => `${r.ammo[a]} ${esc(AMMO[a].name.toLowerCase())}`).join(', ')}.</p></div>
        <div class="card"><h4>Her fate</h4>
          <p>Sinking her leaves no witnesses but angers her flag. Releasing her earns a sliver of mercy.${r.npc ? ` Her captain offers a ransom of ${fmt(r.ransom)}.` : ''}</p>
          <button class="btn btn-danger" data-fate="sink">Take and scuttle</button>
          <button class="btn" data-fate="release">Take and release</button>
          ${r.npc ? `<button class="btn btn-primary" data-fate="ransom">Take and ransom (${fmt(r.ransom)})</button>` : ''}
        </div></div></div></div>`;
    root.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((el) => (el.oninput = () => {
      take[el.dataset.g as GoodId] = Number(el.value);
      draw();
    }));
    root.querySelectorAll<HTMLElement>('[data-fate]').forEach((el) => (el.onclick = () => {
      send({ t: 'loot_take', take, fate: el.dataset.fate as 'sink' });
      close();
    }));
  };
  draw();
}

export function renderSunk(root: HTMLElement, lost: { cargoValue: number; crew: number; repairFee: number }, portName: string, close: () => void): void {
  root.innerHTML = `<div class="modal-body"><div class="center-card">
    <h2 class="title-sm" style="font-size:40px">The sea took her</h2>
    <p style="font-family:var(--serif);font-size:18px;color:var(--fog)">Survivors were fished from the water and carried to ${esc(portName)}. The shipwrights raised what was left of her hull.</p>
    <table class="grid" style="max-width:360px;margin:16px auto"><tr><td>Cargo lost (some still floats where she sank)</td><td class="up">${fmt(lost.cargoValue)}</td></tr>
    <tr><td>Crew lost</td><td class="up">${lost.crew}</td></tr><tr><td>Salvage & repair fee</td><td class="up">${fmt(lost.repairFee)}</td></tr></table>
    <p class="muted">Your ship, your level and your talents are never lost. Insure at League ports to soften the next blow.</p>
    <button class="btn btn-primary">Back to port</button></div></div>`;
  root.querySelector('button')!.onclick = close;
}

export function renderShip(root: HTMLElement, state: ClientState): void {
  const self = state.self;
  const st = state.ownStats;
  if (!self || !st) return;
  const cls = SHIP_CLASSES[self.loadout.classId];
  const cargo = Object.entries(self.cargo).filter(([, n]) => (n ?? 0) > 0);
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(self.loadout.name)}</h2><div class="sub">${esc(cls.name)} — ${esc(cls.role)} Passive: ${esc(cls.passive.name)} — ${esc(cls.passive.description)}</div></div><div class="muted">[I] close</div></div>
    <div class="modal-body"><div class="cols"><div><table class="grid">
      <tr><td>Max speed</td><td>${st.maxSpeed.toFixed(1)} m/s</td></tr><tr><td>Turn rate</td><td>${((st.turnRate * 180) / Math.PI).toFixed(1)}°/s</td></tr>
      <tr><td>Draft</td><td>${cls.draft.toFixed(1)} m${cls.passive.id === 'shallow_runner' ? ' (Shallow Runner: ignores reefs)' : ' — reefs and coastal shoals shallower than this tear the keel'}</td></tr>
      <tr><td>No-go zone</td><td>${st.noGoDeg.toFixed(0)}° (${esc(cls.rig.replace('_', '-'))} rig)</td></tr><tr><td>Hull / armor</td><td>${st.hullMax} / ${Math.round(st.armor * 100)}%</td></tr>
      <tr><td>Sails</td><td>${st.sailHpMax}</td></tr><tr><td>Crew</td><td>${self.crew} (min ${st.crewMin}, max ${st.crewMax})</td></tr>
      <tr><td>Hold</td><td>${cargoVolume(self.cargo, st.contrabandVolumeMul).toFixed(1)} / ${st.holdVolume.toFixed(0)} volume · ${st.holdWeight.toFixed(0)} t</td></tr>
      <tr><td>Port battery</td><td>${cls.gunPortsPerSide - self.gunsDisabled.port}/${cls.gunPortsPerSide} × ${esc(GUNS[self.loadout.guns.port].name)}</td></tr>
      <tr><td>Starboard battery</td><td>${cls.gunPortsPerSide - self.gunsDisabled.starboard}/${cls.gunPortsPerSide} × ${esc(GUNS[self.loadout.guns.starboard].name)}</td></tr>
      <tr><td>Reload / spread / damage</td><td>×${st.reloadMul.toFixed(2)} / ×${st.spreadMul.toFixed(2)} / ×${st.gunDamageMul.toFixed(2)}</td></tr>
      <tr><td>Boarding range / power</td><td>${st.boardingRange.toFixed(0)} m / ×${st.boardingPower.toFixed(2)}</td></tr>
      <tr><td>Detection</td><td>${st.detection.toFixed(0)} m</td></tr>
      <tr><td>Insurance</td><td>${self.insured ? 'Insured for this voyage' : 'None'}</td></tr>
    </table></div><div><h3 class="title-sm" style="font-size:20px">Hold</h3><table class="grid"><tr><th>Good</th><th>Qty</th><th>Volume</th><th>Weight</th></tr>
      ${cargo.map(([g, n]) => `<tr><td class="${GOODS[g as GoodId].contraband ? 'contra' : ''}">${esc(GOODS[g as GoodId].name)}</td><td>${Math.floor(n ?? 0)}</td><td>${((n ?? 0) * GOODS[g as GoodId].volume).toFixed(1)}</td><td>${((n ?? 0) * GOODS[g as GoodId].weight).toFixed(1)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Empty hold</td></tr>'}
      </table><p class="muted">Ammunition: ${AMMO_IDS.map((a) => `${self.ammo[a]} ${esc(AMMO[a].name.toLowerCase())}`).join(' · ')}</p>
      <h3 class="title-sm" style="font-size:20px">Contracts</h3>${self.contracts.map((c) => `<div class="card"><b>${esc(c.title)}</b> <span class="gold">${fmt(c.reward)}</span></div>`).join('') || '<p class="muted">None.</p>'}
    </div></div></div>`;
}

export function renderHelp(root: HTMLElement): void {
  const keys: [string, string][] = [
    ['W / S', 'Raise / lower sail (5 steps). Wind angle matters: watch the compass no-go wedge.'],
    ['A / D', 'Rudder. Ships need way on to turn.'],
    ['Q / E, LMB', 'Fire port / starboard broadside. Cursor distance sets elevation. LMB fires the side facing the cursor.'],
    ['1 / 2 / 3', 'Round shot (hull) · chain shot (sails) · grapeshot (crew).'],
    ['Z X C / V', 'Captain abilities / Ultimate (level 6).'],
    ['B', 'Board the nearest crippled ship in range (hull ≤60%, crew ≤50%, sails ≤35% or struck).'],
    ['Shift+B', 'Board carefully (less cargo destroyed, slower). Ctrl+B: brutal.'],
    ['L', 'Heave to near an island feature (cache, wreck, ruins, grove, mine, pearl bank, shrine) and send a landing party ashore.'],
    ['R', 'Toggle repairs (uses planks & sailcloth; not in combat without Battle Repair).'],
    ['F', 'Dock at a nearby port / set sail.'],
    ['M · T · I', 'World chart · talents · ship & hold.'],
    ['Wheel', 'Zoom.'],
    ['N', 'Sound on / off.'],
    ['Enter', 'Chat.'],
  ];
  root.innerHTML = `<div class="modal-head"><div><h2>Captain's Handbook</h2><div class="sub">The ocean is the world. The ship is the character. The captain is the build.</div></div><div class="muted">[H] close</div></div>
    <div class="modal-body"><div class="cols"><div class="help-grid">${keys.map(([k, d]) => `<kbd>${esc(k)}</kbd><span>${esc(d)}</span>`).join('')}</div>
    <div><div class="card"><h4>First voyage</h4><p>Saltmarrow sells cheap provisions and salt. Porto Blackwater, east along the Black Coast, pays for salt and sells sugar and rum. Gravesend buys sugar. Every sale earns experience.</p></div>
    <div class="card"><h4>The law</h4><p>Attacking lawful ships raises your Wanted level. Crown ports close at Wanted 2, League at 3. Pirate havens (Cinderhold, Fogmouth) never close. Pardons are sold in free and broker ports.</p></div>
    <div class="card"><h4>Risk</h4><p>Safe waters (Black Coast) forbid PvP. Contested and lawless waters do not. When sunk you keep your ship, level and talents — but cargo, some crew and a repair fee are lost.</p></div></div></div></div>`;
}
