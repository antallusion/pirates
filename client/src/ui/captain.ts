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
  // Three layouts for the owner to choose from (2026-10-21: «дай мне 3 варианта верстки на выбор … слишком большой
  // размер выбора»): 1 the carousel, 2 the strip, 3 the list (client/captain.css); ?capv=N or localStorage picks one.
  const wrap = $('screen-captain').querySelector<HTMLElement>('.captain-wrap')!;
  const asked = new URLSearchParams(location.search).get('capv');
  if (asked && /^[123]$/.test(asked)) localStorage.setItem('gravetide.capv', asked);
  const v = localStorage.getItem('gravetide.capv') ?? '2';
  wrap.classList.remove('v1', 'v2', 'v3');
  wrap.classList.add(`v${/^[123]$/.test(v) ? v : '2'}`);
  // the roster rides a rail with an arrow at each end (a click steps to the captain beside; a finger swipes the rail)
  if (!list.parentElement!.classList.contains('cpk-rail')) {
    const rail = document.createElement('div');
    rail.className = 'cpk-rail';
    list.before(rail);
    rail.append(Object.assign(document.createElement('button'), { type: 'button', className: 'cpk-arr cpk-prev', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' }), list,
      Object.assign(document.createElement('button'), { type: 'button', className: 'cpk-arr cpk-next', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
  }
  let current: CaptainId = 'corsair';
  let ship0: string | null = null;
  let know0 = false;
  const render = () => {
    // The roster (owner, 2026-10-21: the old list «лоховской, неудобный и некрасивый»): six framed portraits, HoMM's
    // heroes in a row — the chosen one lifted in gold; a premium captain not yet hers dimmed, her padlock and price on
    // the portrait's foot, the real money first. Styles: client/captain.css.
    list.innerHTML = CAPTAIN_IDS.map((id) => {
      const c = CAPTAINS[id];
      const url = assetUrl(c.portrait);
      const shut = !captainOpen(id);
      const badge = !c.premium ? '' : shut
        ? `<span class="cpk-badge" title="${esc(L('lockedTitle', { price: priceText(captainPrice(id)) }))}">${lockSvg()}${priceHtml(captainPrice(id), { cls: 'cpk-price' })}</span>`
        : `<span class="cpk-gem">${esc(L(shop.owned.has(id) ? 'premiumOwned' : 'premiumShort'))}</span>`;
      return `<button type="button" class="captain-card cpk-tile${id === current ? ' active' : ''}${shut ? ' cc-shut' : ''}" data-id="${id}" role="option" aria-selected="${id === current}">
        <span class="cpk-face" style="background-image:${url ? `url('${url}')` : 'none'}">${badge}</span>
        <span class="cpk-tt"><span class="cpk-tname">${esc(c.archetype)}</span><span class="cpk-trole">${esc(captainRole(c.playstyle))}</span></span>${shut ? `<span class="cpk-tprice">${lockSvg()}${priceHtml(captainPrice(id), { cls: 'cpk-price' })}</span>` : ''}
      </button>`;
    }).join('');
    const pick = (id: CaptainId) => (list.querySelector<HTMLElement>(`.captain-card[data-id="${id}"]`))?.click();
    const step = (d: number) => pick(CAPTAIN_IDS[(CAPTAIN_IDS.indexOf(current) + d + CAPTAIN_IDS.length) % CAPTAIN_IDS.length]);
    wrap.querySelector<HTMLElement>('.cpk-prev')!.onclick = () => step(-1);
    wrap.querySelector<HTMLElement>('.cpk-next')!.onclick = () => step(1);
    wrap.querySelectorAll<HTMLElement>('.cpk-arr').forEach((b) => b.setAttribute('aria-label', L(b.classList.contains('cpk-prev') ? 'prevCap' : 'nextCap')));
    // the chosen one brought to the rail's middle
    requestAnimationFrame(() => list.querySelector<HTMLElement>('.captain-card.active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }));
    list.querySelectorAll<HTMLElement>('.captain-card').forEach((el) => (el.onclick = () => {
      if (current === el.dataset.id) return;
      // (a name she typed and the tick stay; a name offered follows the captain)
      const typed = ($('ship-name') as HTMLInputElement).value;
      ship0 = CAPTAIN_IDS.some((id) => typed === defaultShipName(id)) ? null : typed;
      know0 = ($('know-sea') as HTMLInputElement).checked;
      current = el.dataset.id as CaptainId;
      render();
      ship0 = null;
      know0 = false;
    }));
    const c = CAPTAINS[current];
    const url = assetUrl(c.portrait);
    const ship = SHIP_CLASSES[c.start.ship];
    const role = captainRole(c.playstyle);
    const art = url ? `url('${url}')` : 'none';
    // The chosen one: her portrait whole (3:4) with her name on its plate; beside it the role, the story, the gift,
    // the four orders as tiles (a tap opens one's words where they are hidden), the favoured trees and the start; the
    // ship's name and the order pinned at the foot. A phone held sideways keeps the facts and the names; on the
    // smallest the portrait is the story's backdrop (--cd-art).
    $('screen-captain').querySelector<HTMLElement>('.captain-wrap')?.style.setProperty('--cd-art', art);
    $('captain-detail').innerHTML = `
      <div class="cpk-art"><div class="cpk-portrait" style="background-image:${art}"></div>
        <div class="cpk-plate"><h3>${esc(c.archetype)}</h3><div class="cpk-epi">${esc(c.name)}, ${quote(c.epithet)}</div></div></div>
      <div class="cpk-info">
        <div class="cpk-scroll">
          <div class="cpk-head"><h3>${esc(c.archetype)}</h3><div class="cpk-epi">${esc(c.name)}, ${quote(c.epithet)}</div></div>
          <p class="cpk-role">${esc(role)}</p>
          <p class="cpk-bio">${esc(c.bio)}</p>
          <p class="cpk-play">${esc(c.playstyle.trim().slice(role.length).trim())}</p>
          <section class="cpk-sec"><h4>${esc(L('giftH'))}</h4>
            <div class="cpk-gift"><b>${esc(c.passive.name)}</b><small>${esc(c.passive.description)}</small></div></section>
          <section class="cpk-sec"><h4>${esc(L('ordersH'))}</h4>
            <div class="cpk-abils">${c.abilities.map((a) => `<button type="button" class="cpk-ab${a.kind === 'ultimate' ? ' ult' : ''}" aria-expanded="false">
              <span class="cpk-abi">${icon(`ab_${a.id}`, '', 'ab-ico')}<span class="key">${a.key}</span></span>
              <span class="cpk-abt"><b>${esc(a.name)}</b><span class="cpk-cd">${esc(L('cooldown', { n: a.cooldown }))}</span></span>
              <small>${esc(a.description)}</small></button>`).join('')}</div></section>
          <section class="cpk-sec cpk-trees"><h4>${esc(L('treesH'))}</h4>
            <div class="cpk-chips">${c.favoredTrees.map((t) => `<span>${esc(TREES[t].name)}</span>`).join('')}</div></section>
          <p class="cpk-start"><span class="cpk-start-l">${esc(L('starts', { ship: ship.name, gun: GUNS[c.start.gun].name, crew: c.start.crew, gold: c.start.gold }))}</span><span class="cpk-start-s">${esc(L('startsShort', { ship: ship.name, crew: c.start.crew, gold: c.start.gold }))}</span></p>
        </div>
        <div class="cpk-foot">
          <label class="cpk-name"><span>${esc(L('shipName'))}</span><input id="ship-name" class="field" maxlength="20" value="${esc(defaultShipName(current))}" /></label>
          ${knowSea()}
          ${captainOpen(current) ? `<button id="pick-captain" class="btn btn-primary cpk-go">${esc(L('takeCommand'))}</button>` : `<button id="pick-captain" class="btn btn-primary cpk-go cc-buy" data-buy="${current}" aria-label="${esc(L('buyFor', { price: priceText(captainPrice(current)) }))}"><span>${esc(L('buy'))}</span>${priceHtml(captainPrice(current))}</button>`}
          <p id="captain-why" class="cc-why" role="status" aria-live="polite"></p>
        </div>
      </div>`;
    $('captain-detail').querySelectorAll<HTMLElement>('.cpk-ab').forEach((b) => (b.onclick = () => {
      const open = b.classList.toggle('open');
      b.setAttribute('aria-expanded', String(open));
    }));
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
  return `<label class="check know-sea"${does ? ` title="${esc(does)}"` : ''}><input type="checkbox" id="know-sea" /><span><b>${esc(say)}</b>${does ? `<small>${esc(does)}</small>` : ''}</span></label>`;
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
