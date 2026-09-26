// Captain selection screen: six captains, premium ones are side-grades (see docs/02 §7).

import { CAPTAINS, CAPTAIN_IDS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { SHIP_CLASSES, GUNS } from '../../../shared/src/data/ships.ts';
import { TREES } from '../../../shared/src/data/talents.ts';
import { assetUrl } from '../assets.ts';
import { $, esc } from './dom.ts';
import { t } from '../i18n.ts';

export function showCaptainSelect(onPick: (id: CaptainId, shipName: string, tutorial: boolean) => void): void {
  $('screen-captain').classList.remove('hidden');
  const list = $('captain-list');
  let current: CaptainId = 'corsair';
  const render = () => {
    list.innerHTML = CAPTAIN_IDS.map((id) => {
      const c = CAPTAINS[id];
      const url = assetUrl(c.portrait);
      return `<div class="captain-card ${id === current ? 'active' : ''}" data-id="${id}">
        <div class="portrait" style="background-image:${url ? `url('${url}')` : 'none'}"></div>
        <div><div class="arch">${esc(c.archetype)}</div><div class="nm">${esc(c.name)} — “${esc(c.epithet)}”</div>${c.premium ? '<div class="premium">PREMIUM · SIDE-GRADE</div>' : ''}</div>
      </div>`;
    }).join('');
    list.querySelectorAll<HTMLElement>('.captain-card').forEach((el) => (el.onclick = () => {
      current = el.dataset.id as CaptainId;
      render();
    }));
    const c = CAPTAINS[current];
    const url = assetUrl(c.portrait);
    const ship = SHIP_CLASSES[c.start.ship];
    $('captain-detail').innerHTML = `
      <div><div class="big-portrait" style="background-image:${url ? `url('${url}')` : 'none'}"></div></div>
      <div>
        <h3>${esc(c.archetype)}</h3>
        <div class="epithet">${esc(c.name)}, “${esc(c.epithet)}”</div>
        <p>${esc(c.bio)}</p>
        <p class="muted" style="font-size:14px">${esc(c.playstyle)} Favoured trees: ${c.favoredTrees.map((t) => esc(TREES[t].name)).join(', ')}.</p>
        <div class="ability"><b>Passive — ${esc(c.passive.name)}</b><small>${esc(c.passive.description)}</small></div>
        ${c.abilities.map((a) => `<div class="ability ${a.kind === 'ultimate' ? 'ult' : ''}"><span class="key">${a.key}</span><b>${esc(a.name)}</b> <span class="muted">· ${a.cooldown}s</span><small>${esc(a.description)}</small></div>`).join('')}
        <p class="muted" style="font-size:13px;font-family:var(--sans)">Starts with a ${esc(ship.name)} (${esc(GUNS[c.start.gun].name)}s), ${c.start.crew} crew, ${c.start.gold} silver, in Saltmarrow on the Black Coast.</p>
        <label class="lbl">Name your ship<input id="ship-name" class="field" maxlength="20" value="${esc(defaultShipName(current))}" /></label>
        <label class="check"><input type="checkbox" id="know-sea" /> ${esc(t('captain.knowSea'))}</label>
        <div style="margin-top:12px"><button id="pick-captain" class="btn btn-primary">Take command</button></div>
      </div>`;
    $('pick-captain').onclick = () => {
      const name = ($('ship-name') as HTMLInputElement).value.trim();
      $('screen-captain').classList.add('hidden');
      onPick(current, name, !($('know-sea') as HTMLInputElement).checked);
    };
  };
  render();
}

function defaultShipName(id: CaptainId): string {
  return { corsair: 'Iron Verdict', smuggler: 'Quiet Ledger', reaver: 'Red Hook', navigator: 'Northern Wren', drowned: 'Saint Verity', admiral: 'Black Signal' }[id];
}
