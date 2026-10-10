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
      // (the role — the playstyle's first sentence — is the card's key fact on a phone, where all six stand at once)
      return `<div class="captain-card ${id === current ? 'active' : ''}" data-id="${id}">
        <div class="portrait" style="background-image:${url ? `url('${url}')` : 'none'}"></div>
        <div class="cc-t"><div class="arch">${esc(c.archetype)}</div><div class="nm">${esc(c.name)} — ${quote(c.epithet)}</div><div class="cc-role">${esc(captainRole(c.playstyle))}</div>${c.premium ? `<div class="premium"><span class="pm-long">${esc(L('premium'))}</span><span class="pm-short">${esc(L('premiumShort'))}</span></div>` : ''}</div>
      </div>`;
    }).join('');
    list.querySelectorAll<HTMLElement>('.captain-card').forEach((el) => (el.onclick = () => {
      current = el.dataset.id as CaptainId;
      render();
    }));
    const c = CAPTAINS[current];
    const url = assetUrl(c.portrait);
    const ship = SHIP_CLASSES[c.start.ship];
    // A phone held sideways (styles in client/fit.css) keeps the key facts — the role, the gift, the four orders by
    // name, the ship she starts on — beside the six cards; the bio and the long descriptions are the desk's.
    $('captain-detail').style.setProperty('--cd-art', url ? `url('${url}')` : 'none');
    $('captain-detail').innerHTML = `
      <div class="cd-art"><div class="big-portrait" style="background-image:${url ? `url('${url}')` : 'none'}"></div></div>
      <div class="cd-text">
        <h3>${esc(c.archetype)}</h3>
        <div class="epithet">${esc(c.name)}, ${quote(c.epithet)}</div>
        <p class="cd-bio">${esc(c.bio)}</p>
        <p class="muted cd-play" style="font-size:14px"><span>${esc(c.playstyle)}</span> <span class="cd-fav">${esc(L('favoured', { list: c.favoredTrees.map((t) => TREES[t].name).join(', ') }))}</span></p>
        <div class="ability cd-passive"><b>${esc(L('passive', { name: c.passive.name }))}</b><small>${esc(c.passive.description)}</small></div>
        <div class="cd-abils">${c.abilities.map((a) => `<div class="ability ${a.kind === 'ultimate' ? 'ult' : ''}">${icon(`ab_${a.id}`, '', 'ab-ico')}<span class="key">${a.key}</span><b>${esc(a.name)}</b> <span class="muted cd-cd">· ${esc(L('cooldown', { n: a.cooldown }))}</span><small>${esc(a.description)}</small></div>`).join('')}</div>
        <p class="muted cd-start" style="font-size:13px;font-family:var(--sans)"><span class="cd-start-l">${esc(L('starts', { ship: ship.name, gun: GUNS[c.start.gun].name, crew: c.start.crew, gold: c.start.gold }))}</span><span class="cd-start-s">${esc(L('startsShort', { ship: ship.name, crew: c.start.crew, gold: c.start.gold }))}</span></p>
        <div class="cd-foot">
          <label class="lbl cd-name"><span>${esc(L('shipName'))}</span><input id="ship-name" class="field" maxlength="20" value="${esc(defaultShipName(current))}" /></label>
          <div class="pick-bar">${knowSea()}<button id="pick-captain" class="btn btn-primary">${esc(L('takeCommand'))}</button></div>
        </div>
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
    // (an offered name left as it was follows the language; one she typed stays)
    if (CAPTAIN_IDS.some((id) => ship0 === EN[`ship.${id}`] || ship0 === RU[`ship.${id}`])) ship0 = null;
    know0 = ($('know-sea') as HTMLInputElement).checked;
    render();
    ship0 = null;
    know0 = false;
  });
}

/** «I know the sea» beside the order in the pinned bar (owner's QA, 2026-10-08: at 1500×600 it lay 230px below the
 *  screen's foot, under the scrolled story): the words in bold, what they do under them in small. */
function knowSea(): string {
  const [say, does] = t('captain.knowSea').split(/\s—\s/); // (the Russian dash comes after a space that does not break)
  return `<label class="check know-sea"><input type="checkbox" id="know-sea" /><span><b>${esc(say)}</b>${does ? `<small>${esc(does)}</small>` : ''}</span></label>`;
}

/** A captain's role in a few words: the playstyle's first sentence («Универсальный морской боец.»). */
export function captainRole(playstyle: string): string {
  const m = /^.+?[.!?](?=\s|$)/.exec(playstyle.trim());
  return m ? m[0] : playstyle.trim();
}

/** The name offered for her ship, in the reader's language (the field keeps whatever she types). */
function defaultShipName(id: CaptainId): string {
  return L(`ship.${id}`);
}
