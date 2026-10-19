// Captain selection screen: six captains, premium ones are side-grades (see docs/02 §7).

import { CAPTAINS, CAPTAIN_IDS, captainPrice } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import { priceHtml, priceText, topUpThenBuy } from './price.ts';
import { ask } from './confirm.ts';
import { serverText } from '../lang/server.ts';
import { SHIP_CLASSES, GUNS } from '../../../shared/src/data/ships.ts';
import { TREES } from '../../../shared/src/data/talents.ts';
import { assetUrl } from '../assets.ts';
import { $, esc, icon, quote } from './dom.ts';
import { dict, onLang, t } from '../i18n.ts';
import { EN, RU } from '../lang/ui/captain.ts';

const L = dict(EN, RU);

/** The premium captains are bought (owner, 2026-10-19: «премиум героев можно на старте выбрать бесплатно, а они должны
 *  стоить денег»): which her account owns, its doubloons and whether the top-up takes payments — the server's
 *  `captain_shop` (server/src/game/captainshop.ts), asked for when the screen opens. */
const shop = { owned: new Set<CaptainId>(), balance: 0, pay: false };
let redraw: (() => void) | null = null;
let sendMsg: ((m: ClientMsg) => void) | null = null;

/** Whether the captain may be taken now: a free one, or a premium one her account owns. */
export const captainOpen = (id: CaptainId): boolean => !CAPTAINS[id].premium || shop.owned.has(id);

/** The server's answer (main.ts): the screen drawn again; a refusal or a purchase said under the button. */
export function captainShopHeard(m: Extract<ServerMsg, { t: 'captain_shop' }>): void {
  shop.owned = new Set(m.owned);
  shop.balance = m.balance;
  shop.pay = m.pay;
  redraw?.();
  const why = document.getElementById('captain-why');
  if (why) why.textContent = m.why ? serverText(m.why) : m.bought ? L('bought', { name: CAPTAINS[m.bought].name }) : '';
}

/** The account's doubloons heard while the screen is up (a top-up came in). */
export function captainBalance(n: number): void {
  shop.balance = n;
}

/** A premium captain bought: the question, then the doubloons (the shop's own top-up when short). */
async function buy(id: CaptainId): Promise<void> {
  const send = sendMsg;
  if (!send) return;
  const price = captainPrice(id);
  const msg: ClientMsg = { t: 'captain_shop', action: 'buy', captain: id };
  const name = CAPTAINS[id].name;
  const why = document.getElementById('captain-why');
  if (shop.balance < price) {
    // (payments not open yet: no top-up page before she has a ship — the line under the button says so)
    await topUpThenBuy({ price, balance: shop.balance, name, msg, pay: shop.pay, send, openTopup: () => { if (why) why.textContent = L('payClosed'); } });
    return;
  }
  if (await ask(L('buyAsk', { name, price: priceText(price) }), L('buyYes'), L('buyNo'))) send(msg);
}

export function showCaptainSelect(onPick: (id: CaptainId, shipName: string, tutorial: boolean) => void, send?: (m: ClientMsg) => void): void {
  $('screen-captain').classList.remove('hidden');
  sendMsg = send ?? null;
  send?.({ t: 'captain_shop', action: 'view' });
  const list = $('captain-list');
  let current: CaptainId = 'corsair';
  let ship0: string | null = null;
  let know0 = false;
  const render = () => {
    list.innerHTML = CAPTAIN_IDS.map((id) => {
      const c = CAPTAINS[id];
      const url = assetUrl(c.portrait);
      const shut = !captainOpen(id);
      // (the role — the playstyle's first sentence — is the card's key fact on a phone, where all six stand at once;
      // a premium captain not yet hers: the lock and the price, the real money first)
      const badge = !c.premium ? '' : shut
        ? `<div class="premium cc-lock" title="${esc(L('lockedTitle', { price: priceText(captainPrice(id)) }))}"><span class="pm-long">${esc(L('premiumLocked'))}</span>${lockSvg()}${priceHtml(captainPrice(id), { cls: 'cc-price' })}</div>`
        : `<div class="premium"><span class="pm-long">${esc(L(shop.owned.has(id) ? 'premiumOwnedLong' : 'premium'))}</span><span class="pm-short">${esc(L(shop.owned.has(id) ? 'premiumOwned' : 'premiumShort'))}</span></div>`;
      return `<div class="captain-card ${id === current ? 'active' : ''}${shut ? ' cc-shut' : ''}" data-id="${id}">
        <div class="portrait" style="background-image:${url ? `url('${url}')` : 'none'}"></div>
        <div class="cc-t"><div class="arch">${esc(c.archetype)}</div><div class="nm">${esc(c.name)} — ${quote(c.epithet)}</div><div class="cc-role">${esc(captainRole(c.playstyle))}</div>${badge}</div>
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
          <div class="pick-bar">${knowSea()}${captainOpen(current) ? `<button id="pick-captain" class="btn btn-primary">${esc(L('takeCommand'))}</button>` : `<button id="pick-captain" class="btn btn-primary cc-buy" data-buy="${current}" aria-label="${esc(L('buyFor', { price: priceText(captainPrice(current)) }))}"><span>${esc(L('buy'))}</span>${priceHtml(captainPrice(current))}</button>`}</div>
          <p id="captain-why" class="cc-why" role="status" aria-live="polite"></p>
        </div>
      </div>`;
    if (ship0 !== null) ($('ship-name') as HTMLInputElement).value = ship0;
    ($('know-sea') as HTMLInputElement).checked = know0;
    $('pick-captain').onclick = () => {
      // a premium captain not yet hers is bought first (the server refuses her otherwise)
      if (!captainOpen(current)) return void buy(current);
      const name = ($('ship-name') as HTMLInputElement).value.trim();
      $('screen-captain').classList.add('hidden');
      onPick(current, name, !($('know-sea') as HTMLInputElement).checked);
    };
  };
  render();
  // The server's answer of owned captains (or a purchase) redraws it, keeping what was typed.
  redraw = () => {
    if ($('screen-captain').classList.contains('hidden')) return;
    ship0 = ($('ship-name') as HTMLInputElement).value;
    know0 = ($('know-sea') as HTMLInputElement).checked;
    render();
    ship0 = null;
    know0 = false;
  };
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

/** The lock of a captain not yet bought: a padlock drawn in the buttons' 24-unit box (gold, currentColor). */
function lockSvg(): string {
  return '<svg class="g-svg cc-lock-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/></svg>';
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
