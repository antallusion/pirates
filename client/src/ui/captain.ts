// Captain selection screen: six captains, premium ones are side-grades (see docs/02 §7).

import { metrikaGoal } from '../../../shared/src/metrika.ts';
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
  // The hero screen (owner, 2026-10-22: «экран выбора … как тут [Rise of Kingdoms], но в нашем стиле … эффекты
  // подбавь, хочется экран выбора прям пушечный»): the roster of six on the left, the chosen captain at full height on
  // the painted compass dais of the deck (bg.captain), her name, tags, role, gift and orders on the right, the start
  // under her feet, the ship's name and the two big buttons at the foot; fog, embers, the moon's shaft, the runes
  // turning round the dais. Styles: client/captain.css.
  const wrap = $('screen-captain').querySelector<HTMLElement>('.captain-wrap')!;
  const list = $('captain-list');
  let current: CaptainId = 'corsair';
  let ship0: string | null = null;
  let know0 = false;
  let tipOf = 'g';
  const setTip = (k: string) => {
    tipOf = k;
    const c = CAPTAINS[current];
    wrap.querySelectorAll<HTMLElement>('.cpx-sk').forEach((b) => b.classList.toggle('open', b.dataset.k === k));
    wrap.querySelector('#captain-story')?.classList.toggle('on', k === 'story');
    const a = /^\d$/.test(k) ? c.abilities[+k] : null;
    $('cpx-tip').innerHTML = k === 'story'
      ? `<b>${esc(L('storyOf', { name: c.name }))}</b> — ${esc(c.bio)} ${esc(c.playstyle.trim().slice(captainRole(c.playstyle).length).trim())}`
      : a ? `<b>${esc(a.name)}</b> <span class="cpx-cd">· ${esc(L('cooldown', { n: a.cooldown }))}</span> — ${esc(a.description)}`
        : `<b>${esc(c.passive.name)}</b> — ${esc(c.passive.description)}`;
  };
  const render = (fresh: boolean) => {
    // the roster: framed portraits, the school's medallion on each; a premium captain not yet hers dimmed, her padlock
    // and price under the portrait (owner: «чтобы цена на портреты не заезжала»); the premium ones are the last row.
    $('cpx-count').textContent = String(CAPTAIN_IDS.length);
    $('cpx-roster-h').textContent = L('rosterH');
    list.innerHTML = CAPTAIN_IDS.map((id) => {
      const c = CAPTAINS[id];
      const shut = !captainOpen(id);
      const tag = !c.premium ? '' : shut
        ? `<span class="cpx-price" title="${esc(L('lockedTitle', { price: priceText(captainPrice(id)) }))}">${lockSvg()}${priceHtml(captainPrice(id), { cls: 'cpx-pr' })}</span>`
        : `<span class="cpx-price owned">${esc(L(shop.owned.has(id) ? 'premiumOwned' : 'premiumShort'))}</span>`;
      return `<button type="button" class="captain-card cpx-cap${id === current ? ' active' : ''}${shut ? ' cc-shut' : ''}" data-id="${id}" role="option" aria-selected="${id === current}" aria-label="${esc(c.archetype)}">
        <span class="cpx-face" style="background-image:${art(c.portrait)}"><span class="cpx-school" style="background-image:${art(`icon.school_${id}`)}"></span></span>${tag}</button>`;
    }).join('');
    list.querySelectorAll<HTMLElement>('.captain-card').forEach((el) => (el.onclick = () => {
      if (current === el.dataset.id) return;
      // (a name she typed and the tick stay; a name offered follows the captain)
      const typed = ($('ship-name') as HTMLInputElement).value;
      ship0 = CAPTAIN_IDS.some((id) => typed === defaultShipName(id)) ? null : typed;
      know0 = ($('know-sea') as HTMLInputElement).checked;
      current = el.dataset.id as CaptainId;
      render(true);
      ship0 = null;
      know0 = false;
    }));
    const c = CAPTAINS[current];
    const ship = SHIP_CLASSES[c.start.ship];
    // her figure on the dais: a flash and a step in when she changes
    const hero = $('cpx-hero') as HTMLImageElement;
    const src = assetUrl(`unit.hero_${current}`);
    if (src && hero.getAttribute('src') !== src) hero.src = src;
    if (fresh) for (const el of [hero.parentElement!, $('cpx-flash')]) { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
    $('captain-detail').innerHTML = `
      <section class="cpx-info">
        <div class="cpx-kicker"><span class="cpx-kico" style="background-image:${art(`icon.school_${current}`)}"></span><span>${esc(c.archetype)}</span></div>
        <h3 class="cpx-name">${esc(c.name)}</h3>
        <div class="cpx-epi">${quote(c.epithet)}</div>
        <div class="cpx-tags">${c.premium ? `<span class="cpx-tag prem"><i></i>${esc(L('premiumShort'))}</span>` : ''}${c.favoredTrees.map((t) => `<span class="cpx-tag"><i></i>${esc(TREES[t].name)}</span>`).join('')}</div>
        <div class="cpx-role">${esc(captainRole(c.playstyle))}</div>
        <div class="cpx-skh">${esc(L('skillsH'))}</div>
        <div class="cpx-skills"><button type="button" class="cpx-sk gift" data-k="g" aria-label="${esc(c.passive.name)}" style="background-image:${art(`icon.school_${current}`)}"></button>${c.abilities.map((a, k) => `<button type="button" class="cpx-sk${a.kind === 'ultimate' ? ' ult' : ''}" data-k="${k}" aria-label="${esc(a.name)}" style="background-image:${art(`icon.ab_${a.id}`)}"><b class="key">${a.key}</b></button>`).join('')}</div>
        <div class="cpx-tip" id="cpx-tip" role="status" aria-live="polite"></div>
      </section>
      <div class="cpx-power cpx-plate"><span class="cpx-pico" style="background-image:${art('icon.anchor')}"></span><span>${esc(L('startsShort', { ship: ship.name, crew: c.start.crew, gold: c.start.gold }))}</span></div>
      <div class="cpx-foot">
        <div class="cpx-foot-row"><label class="cpx-ship"><span>${esc(L('shipH'))}</span><input id="ship-name" maxlength="20" value="${esc(defaultShipName(current))}" aria-label="${esc(L('shipName'))}" /></label>${knowSea()}</div>
        <div class="cpx-btns"><button type="button" class="cpx-big" id="captain-story">${esc(L('story'))}</button>${captainOpen(current)
          ? `<button type="button" id="pick-captain" class="cpx-big main">${esc(L('takeCommand'))}</button>`
          : `<button type="button" id="pick-captain" class="cpx-big main cc-buy" data-buy="${current}" aria-label="${esc(L('buyFor', { price: priceText(captainPrice(current)) }))}"><span>${esc(L('buy'))}</span>${priceHtml(captainPrice(current))}</button>`}</div>
        <p id="captain-why" class="cc-why" role="status" aria-live="polite"></p>
      </div>`;
    $('captain-detail').querySelectorAll<HTMLElement>('.cpx-sk').forEach((b) => (b.onclick = () => setTip(b.dataset.k!)));
    $('captain-story').onclick = () => setTip(tipOf === 'story' ? 'g' : 'story');
    setTip(fresh ? 'g' : tipOf);
    if (ship0 !== null) ($('ship-name') as HTMLInputElement).value = ship0;
    ($('know-sea') as HTMLInputElement).checked = know0;
    $('pick-captain').onclick = () => {
      // a premium captain not yet hers is bought first (the server refuses her otherwise)
      if (!captainOpen(current)) return void buy(current);
      const name = ($('ship-name') as HTMLInputElement).value.trim();
      $('screen-captain').classList.add('hidden');
      metrikaGoal('registration', { captain: current }); // Yandex Direct pays per registration (shared/src/metrika.ts)
      onPick(current, name, !($('know-sea') as HTMLInputElement).checked);
    };
  };
  render(true);
  embers(wrap);
  // The server's answer of owned captains (or a purchase) redraws it, keeping what was typed.
  redraw = () => {
    if ($('screen-captain').classList.contains('hidden')) return;
    ship0 = ($('ship-name') as HTMLInputElement).value;
    know0 = ($('know-sea') as HTMLInputElement).checked;
    render(false);
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
    render(false);
    ship0 = null;
    know0 = false;
  });
}

/** An asset as a CSS url (none when it is missing). */
const art = (id: string): string => {
  const u = assetUrl(id);
  return u ? `url('${u}')` : 'none';
};

/** Embers rising from the dais and the lanterns while the screen is up (none under reduced motion); the canvas stops
 *  drawing once the screen is hidden. */
function embers(wrap: HTMLElement): void {
  const cv = wrap.querySelector<HTMLCanvasElement>('.cpx-embers');
  if (!cv || cv.dataset.on || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cx = cv.getContext('2d');
  if (!cx) return;
  cv.dataset.on = '1';
  const dpr = Math.min(2, devicePixelRatio || 1);
  let W = 0, H = 0;
  const size = () => { W = cv.width = Math.round(cv.clientWidth * dpr); H = cv.height = Math.round(cv.clientHeight * dpr); };
  type P = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; hue: number };
  const spawn = (): P => {
    const near = Math.random() < 0.6;
    return { x: near ? W * (0.42 + Math.random() * 0.16) : Math.random() * W, y: H * (near ? 0.82 : 1.02), vx: (Math.random() - 0.5) * 0.4, vy: -(0.4 + Math.random() * 1.1) * dpr, r: (0.6 + Math.random() * 1.6) * dpr, life: 0, max: 220 + Math.random() * 260, hue: 28 + Math.random() * 18 };
  };
  size();
  const ps: P[] = [];
  for (let k = 0; k < 60; k++) { const p = spawn(); p.y = Math.random() * H; p.life = Math.random() * p.max; ps.push(p); }
  const screen = $('screen-captain');
  const tick = () => {
    if (screen.classList.contains('hidden')) { delete cv.dataset.on; return; }
    if (Math.round(cv.clientWidth * dpr) !== W || Math.round(cv.clientHeight * dpr) !== H) size();
    cx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.life++;
      p.x += p.vx + Math.sin((p.life + p.r * 50) / 30) * 0.35;
      p.y += p.vy;
      const a = Math.sin(Math.PI * Math.min(1, p.life / p.max));
      const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `hsla(${p.hue},100%,75%,${0.9 * a})`);
      g.addColorStop(1, `hsla(${p.hue},100%,50%,0)`);
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(p.x, p.y, p.r * 4, 0, 6.283);
      cx.fill();
      if (p.life > p.max || p.y < -20) Object.assign(p, spawn());
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
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
