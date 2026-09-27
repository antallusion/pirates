// Captain selection screen: six captains, premium ones are side-grades (see docs/02 §7).

import { CAPTAINS, CAPTAIN_IDS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { SHIP_CLASSES, GUNS } from '../../../shared/src/data/ships.ts';
import { TREES } from '../../../shared/src/data/talents.ts';
import { assetUrl } from '../assets.ts';
import { $, esc, icon, quote } from './dom.ts';
import { dict, onLang, t } from '../i18n.ts';
import { EN, RU } from '../lang/ui/captain.ts';

const L = dict(EN, RU);

export function showCaptainSelect(onPick: (id: CaptainId, shipName: string, tutorial: boolean) => void): void {
  $('screen-captain').classList.remove('hidden');
  const list = $('captain-list');
  let current: CaptainId = 'corsair';
  let ship0: string | null = null;
  let know0 = false;
  const render = () => {
    list.innerHTML = CAPTAIN_IDS.map((id) => {
      const c = CAPTAINS[id];
      const url = assetUrl(c.portrait);
      return `<div class="captain-card ${id === current ? 'active' : ''}" data-id="${id}">
        <div class="portrait" style="background-image:${url ? `url('${url}')` : 'none'}"></div>
        <div><div class="arch">${esc(c.archetype)}</div><div class="nm">${esc(c.name)} — ${quote(c.epithet)}</div>${c.premium ? `<div class="premium">${esc(L('premium'))}</div>` : ''}</div>
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
        <div class="epithet">${esc(c.name)}, ${quote(c.epithet)}</div>
        <p>${esc(c.bio)}</p>
        <p class="muted" style="font-size:14px">${esc(c.playstyle)} ${esc(L('favoured', { list: c.favoredTrees.map((t) => TREES[t].name).join(', ') }))}</p>
        <div class="ability"><b>${esc(L('passive', { name: c.passive.name }))}</b><small>${esc(c.passive.description)}</small></div>
        ${c.abilities.map((a) => `<div class="ability ${a.kind === 'ultimate' ? 'ult' : ''}">${icon(`ab_${a.id}`, '', 'ab-ico')}<span class="key">${a.key}</span><b>${esc(a.name)}</b> <span class="muted">· ${esc(L('cooldown', { n: a.cooldown }))}</span><small>${esc(a.description)}</small></div>`).join('')}
        <p class="muted" style="font-size:13px;font-family:var(--sans)">${esc(L('starts', { ship: ship.name, gun: GUNS[c.start.gun].name, crew: c.start.crew, gold: c.start.gold }))}</p>
        <label class="lbl">${esc(L('shipName'))}<input id="ship-name" class="field" maxlength="20" value="${esc(defaultShipName(current))}" /></label>
        <label class="check"><input type="checkbox" id="know-sea" /> ${esc(t('captain.knowSea'))}</label>
        <div class="pick-bar"><button id="pick-captain" class="btn btn-primary">${esc(L('takeCommand'))}</button></div>
      </div>`;
    if (ship0 !== null) ($('ship-name') as HTMLInputElement).value = ship0;
    ($('know-sea') as HTMLInputElement).checked = know0;
    $('pick-captain').onclick = () => {
      const name = ($('ship-name') as HTMLInputElement).value.trim();
      $('screen-captain').classList.add('hidden');
      onPick(current, name, !($('know-sea') as HTMLInputElement).checked);
    };
  };
  render();
  // A language change redraws the screen, keeping what was typed.
  onLang(() => {
    if ($('screen-captain').classList.contains('hidden')) return;
    ship0 = ($('ship-name') as HTMLInputElement).value;
    know0 = ($('know-sea') as HTMLInputElement).checked;
    render();
    ship0 = null;
    know0 = false;
  });
}

function defaultShipName(id: CaptainId): string {
  return { corsair: 'Iron Verdict', smuggler: 'Quiet Ledger', reaver: 'Red Hook', navigator: 'Northern Wren', drowned: 'Saint Verity', admiral: 'Black Signal' }[id];
}
