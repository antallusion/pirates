// Boarding plunder, shipwreck, ship/cargo and help dialogs.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { AMMO_IDS, AMMO, SHIP_CLASSES, GUNS } from '../../../shared/src/data/ships.ts';
import type { BoardingResult, ClientMsg, OnboardingView } from '../../../shared/src/protocol.ts';
import { t } from '../i18n.ts';
import { logbookHtml } from './onboarding.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt } from './dom.ts';

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
    root.innerHTML = `<div class="modal-head"><div><h2>Prize: ${esc(r.targetName)}</h2><div class="sub">${esc(SHIP_CLASSES[r.targetClass].name)} taken. Your losses: ${r.crewLost} crew. Theirs: ${r.enemyCrewLost}.</div></div></div>
      <div class="modal-body"><div class="cols"><div>
        <h3 class="title-sm" style="font-size:20px">Cargo that survived</h3>
        ${goods.length ? goods.map((g) => `<div class="loot-row"><span>${esc(GOODS[g].name)} <span class="muted">(${r.cargo[g]})</span>${state.self?.appraisal?.[g] ? ` <span class="gold" title="Best price you know">${fmt(state.self.appraisal[g]!.price)}/u</span>` : ''}</span><b>${take[g] ?? 0}</b>
          <input type="range" min="0" max="${r.cargo[g]}" value="${take[g] ?? 0}" data-g="${g}" /></div>`).join('') : '<p class="muted">Her hold is empty.</p>'}
        <p class="${used > holdMax ? 'up' : 'muted'}">Your hold: ${used.toFixed(1)} / ${holdMax.toFixed(0)}</p>
        ${Object.keys(r.destroyed).length ? `<p class="muted">Destroyed in the fight: ${Object.entries(r.destroyed).map(([g, n]) => `${n} ${esc(GOODS[g as GoodId].name)}`).join(', ')}</p>` : ''}
      </div><div>
        <div class="card"><h4>Coin & shot</h4><p>${fmt(r.gold)} silver from her strongbox; ${AMMO_IDS.map((a) => `${r.ammo[a]} ${esc(AMMO[a].name.toLowerCase())}`).join(', ')}.</p></div>
        ${r.recruits > 0 ? `<div class="card"><h4>Prisoners</h4><p>Up to ${r.recruits} of her crew would sign the articles (low loyalty at first).</p><div class="loot-row"><span>Sign on</span><b>${recruit}</b><input type="range" min="0" max="${r.recruits}" value="${recruit}" id="recruit" /></div></div>` : ''}
        <div class="card"><h4>Her fate</h4>
          ${r.noQuarter ? '<p class="bad">No Quarter: she will be burning and going down within the minute. Take what you can.</p><button class="btn btn-danger" data-fate="sink">Take and leave her to burn</button>' : `
          <p>Sinking her leaves no witnesses but angers her flag. Releasing her earns a sliver of mercy.${r.npc ? ` Her captain offers a ransom of ${fmt(r.ransom)}.` : ''}${r.captive ? ' If you sink her or take her as a prize, her captain comes with you in irons.' : ''}</p>
          <button class="btn btn-danger" data-fate="sink">Take and scuttle</button>
          <button class="btn" data-fate="release">Take and release</button>
          ${r.npc ? `<button class="btn btn-primary" data-fate="ransom">Take and ransom (${fmt(r.ransom)})</button>` : ''}
          ${r.prize ? `<button class="btn btn-primary" data-fate="prize" title="She follows you; any port with a yard buys her">Take her as a prize — ${r.prize.crew} hands, court pays ~${fmt(r.prize.value)}</button>` : ''}`}
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
    <h2 class="title-sm" style="font-size:40px">The sea took her</h2>
    <p style="font-family:var(--serif);font-size:18px;color:var(--fog)">Survivors were fished from the water and carried to ${esc(portName)}. The shipwrights raised what was left of her hull.</p>
    <table class="grid" style="max-width:360px;margin:16px auto"><tr><td>Cargo lost (some still floats where she sank)</td><td class="up">${fmt(lost.cargoValue)}</td></tr>
    <tr><td>Crew lost</td><td class="up">${lost.crew}</td></tr><tr><td>Salvage & repair fee</td><td class="up">${fmt(lost.repairFee)}</td></tr></table>
    <p class="muted">Your ship, your level and your talents are never lost. Insure at League ports to soften the next blow.</p>
    <button class="btn btn-primary">Back to port</button></div></div>`;
  root.querySelector('button')!.onclick = close;
}

export function renderShip(root: HTMLElement, state: ClientState, send?: (m: ClientMsg) => void): void {
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
      <tr><td>Hold</td><td>${cargoVolume(self.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul).toFixed(1)} / ${st.holdVolume.toFixed(0)} volume · ${st.holdWeight.toFixed(0)} t</td></tr>
      <tr><td>Port battery</td><td>${cls.gunPortsPerSide - self.gunsDisabled.port}/${cls.gunPortsPerSide} × ${esc(GUNS[self.loadout.guns.port].name)}</td></tr>
      <tr><td>Starboard battery</td><td>${cls.gunPortsPerSide - self.gunsDisabled.starboard}/${cls.gunPortsPerSide} × ${esc(GUNS[self.loadout.guns.starboard].name)}</td></tr>
      <tr><td>Reload / spread / damage</td><td>×${st.reloadMul.toFixed(2)} / ×${st.spreadMul.toFixed(2)} / ×${st.gunDamageMul.toFixed(2)}</td></tr>
      <tr><td>Boarding range / power</td><td>${st.boardingRange.toFixed(0)} m / ×${st.boardingPower.toFixed(2)}</td></tr>
      <tr><td>Detection</td><td>${st.detection.toFixed(0)} m</td></tr>
      <tr><td>Insurance</td><td>${self.insured ? 'Insured for this voyage' : 'None'}</td></tr>
    </table></div><div><h3 class="title-sm" style="font-size:20px">Hold</h3><table class="grid"><tr><th>Good</th><th>Qty</th><th>Volume</th><th>Weight</th>${self.appraisal ? '<th>Best known sale</th>' : ''}</tr>
      ${cargo.map(([g, n]) => {
        const a = self.appraisal?.[g as GoodId];
        const where = a ? state.ports.find((p) => p.id === a.port)?.name ?? a.port : '';
        return `<tr><td class="${GOODS[g as GoodId].contraband ? 'contra' : ''}">${esc(GOODS[g as GoodId].name)} ${self.dockedAt ? '' : `<button class="btn btn-small" data-dump="${g}" title="Over the side">⤓</button>`}</td><td>${Math.floor(n ?? 0)}</td><td>${((n ?? 0) * GOODS[g as GoodId].volume).toFixed(1)}</td><td>${((n ?? 0) * GOODS[g as GoodId].weight).toFixed(1)}</td>${self.appraisal ? `<td>${a ? `<span class="gold">${fmt(a.price * Math.floor(n ?? 0))}</span> <span class="muted">${esc(where)}</span>` : '<span class="muted">—</span>'}</td>` : ''}</tr>`;
      }).join('') || '<tr><td colspan="4" class="muted">Empty hold</td></tr>'}
      </table><p class="muted">Ammunition: ${AMMO_IDS.map((a) => `${self.ammo[a]} ${esc(AMMO[a].name.toLowerCase())}`).join(' · ')}</p>
      ${self.talents.shp_field_forge && !self.dockedAt ? `<div class="card"><h4>Field Forge</h4><p class="muted">Ten batches at a time. Shot: 1 iron + 1 powder per batch; planks: 1 timber.</p>
        <button class="btn btn-small" data-craft="round">12 round</button> <button class="btn btn-small" data-craft="chain">8 chain</button> <button class="btn btn-small" data-craft="grape">14 grape</button> <button class="btn btn-small" data-craft="planks">planks</button></div>` : ''}
      <h3 class="title-sm" style="font-size:20px">Contracts</h3>${self.contracts.map((c) => `<div class="card"><b>${esc(c.title)}</b> <span class="gold">${fmt(c.reward)}</span></div>`).join('') || '<p class="muted">None.</p>'}
    </div></div></div>`;
  root.querySelectorAll<HTMLElement>('[data-craft]').forEach((el) => (el.onclick = () => send?.({ t: 'craft', recipe: el.dataset.craft as 'round', n: 10 })));
  root.querySelectorAll<HTMLElement>('[data-dump]').forEach((el) => (el.onclick = () => {
    const g = el.dataset.dump as GoodId;
    const n = Math.floor(self.cargo[g] ?? 0);
    if (send && confirm(`Throw ${n} ${GOODS[g].name} over the side?`)) send({ t: 'jettison', good: g, qty: n });
  }));
}

export function renderHelp(root: HTMLElement, onboarding: OnboardingView | null = null): void {
  const keys: [string, string][] = [
    ['W / S', 'Raise / lower sail (5 steps). Wind angle matters: watch the compass no-go wedge.'],
    ['A / D', 'Rudder. Ships need way on to turn.'],
    ['Q / E, LMB', 'Fire port / starboard broadside. Cursor distance sets elevation. LMB fires the side facing the cursor.'],
    ['1 – 5', 'Round shot (hull) · chain (sails) · grape (crew) · fire shot (sets fires, burns in your own magazine) · heavy shot (pierces armour).'],
    ['U', 'Cursed shot (black markets and the Choir): the struck hull cannot be mended for 20 s, the target loses morale — and so does your crew, and the Crown notices.'],
    ['RMB', 'Deck mount at the cursor (fit one at a shipyard): mortar, harpoon (tethers the target), swivel chain gun, abyssal lance.'],
    ['Space', 'Bow or stern chasers toward the cursor (it must lie within 35° of the keel). Chasers never load grape.'],
    ['Z X C / V', 'Captain abilities / Ultimate (level 6).'],
    ['6 – 0', 'Active talents in the order you learned them (Spill the Wind, Anchor Pivot…).'],
    ['K', 'Fire mode: full broadside, or rolling fire down the side (guns reload faster, looser spread unless you have Rolling Broadside).'],
    ['1 – 5 (loaded)', 'Changing shot with a side loaded means drawing the charge: part of a reload (Quick Swap trims it).'],
    ['B', 'Board the nearest crippled ship in range (hull ≤60%, crew ≤50%, sails ≤35% or struck).'],
    ['Shift+B', 'Board carefully (less cargo destroyed, slower). Ctrl+B: brutal.'],
    ['B (boarding)', 'While grappled: cut the grapples (attacker: fall back; defender: axes on the lines — may fail).'],
    ['L', 'Heave to near an island feature (cache, wreck, ruins, grove, mine, pearl bank, shrine) and send a landing party ashore.'],
    ['G', 'Crew orders: balanced → guns (faster reload, slow pumps) → braces (sail handling, speed) → damage control (pumps ×2, fast leak plugging and firefighting, slow reload).'],
    ['R', 'Toggle repairs (uses planks & sailcloth; not in combat without Battle Repair).'],
    ['F', 'Dock at a nearby port / set sail. Shift+F: dock and pay customs to look away (no search).'],
    ['J', 'Signal the next formation to your escorts (Line · Wedge · Ring; needs Signal Flags).'],
    ['M · T · I · O', 'World chart · talents · ship & hold · crew and officers (orders, the Codex share).'],
    ['Wheel', 'Zoom.'],
    ['N', 'Sound on / off.'],
    ['Y', 'Company & Letters: your group and the convoy signal, trading with another captain, your colours (the Black Flag), duels and the bounty board, letters by packet boat, the market board in port (Tidewrack: the trophy auction).'],
    ['Enter', 'Chat. Start with /g to speak to your group only.'],
  ];
  root.innerHTML = `<div class="modal-head"><div><h2>Captain's Handbook</h2><div class="sub">The ocean is the world. The ship is the character. The captain is the build.</div></div><div class="muted">[H] close</div></div>
    <div class="modal-body"><div class="cols"><div class="help-grid">${keys.map(([k, d]) => `<kbd>${esc(k)}</kbd><span>${esc(d)}</span>`).join('')}</div>
    <div><div class="card"><h4>First voyage</h4><p>Saltmarrow sells cheap provisions and salt. Porto Blackwater, east along the Black Coast, pays for salt and sells sugar and rum. Gravesend buys sugar. Every sale earns experience.</p></div>
    <div class="card"><h4>The law</h4><p>Attacking lawful ships raises your Wanted level. Crown ports close at Wanted 2, League at 3. Pirate havens (Cinderhold, Fogmouth) never close. Pardons are sold in free and broker ports.</p></div>
    <div class="card"><h4>Risk</h4><p>Safe waters (Black Coast) forbid PvP but for duels by consent. Contested and lawless waters do not — though young captains sail under the Green Pennant in contested water, and a sunk captain is protected for ten minutes. When sunk you keep your ship, level and talents — but cargo, some crew, a repair fee and a tenth of the silver aboard are lost. The League bank keeps the rest safe.</p></div>${logbookHtml(onboarding)}</div></div></div>`;
}
