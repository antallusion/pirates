// The port card (owner, 2026-10-30: «нажимая на порт я хочу видеть подробную информацию о том что там продается и
// другую важную информацию, но главное чтобы на мобиле красиво и четко смотрелось. это сэкономит время тем, кто
// занимается продовольствием»). A harbour tapped by its name or crest at sea, or by its crest on the chart: a side card
// (the kit's sheet, docked to the right on a screen on its side, the sea still in sight on the left) with
//   • its name, flag, waters (safety, ⚓), the way there and the time, the time till the prices change;
//   • its market as far as she knows it (server/src/game/portinfo.ts: live in port, her last visit elsewhere — exact
//     with Market Sense, else how dear each good stood), the food first;
//   • its services, its news, her goods in its warehouse;
//   • «Плыть сюда» — the run there that puts her in on arrival.

import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { GOODS, isInfStock } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { hasTamer } from '../../../shared/src/data/drifts.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { portDwellings } from '../../../shared/src/data/town.ts';
import { levelRange } from '../../../shared/src/data/shiplevel.ts';
import { anchorSpan, yardSpan } from '../../../shared/src/data/yardhulls.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { ClientMsg, PortInfoGood, PortInfoView, PortPublic } from '../../../shared/src/protocol.ts';
import { KEY_PORTS, REGIONS } from '../../../shared/src/world/regions.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/portcard.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { dec1, esc, fmt, icon, money } from './dom.ts';
import { openSheet } from './kit/sheet.ts';
import type { SheetHandle } from './kit/sheet.ts';
import { placeName } from './maps.ts';
import { LF, ferryHtml } from './ferry.ts';

const L = dict(EN, RU);

/** The food and the ship's stores, first on the card (the owner's provisioners). */
export const FOOD_GOODS: GoodId[] = ['provisions', 'salted_fish', 'smoked_fish', 'fish', 'prime_fish', 'rum', 'sugar', 'salt', 'sailcloth', 'planks'];

export interface PortCardDeps {
  send: (m: ClientMsg) => void;
  /** The run to the harbour (it puts her in on arrival). */
  sail: (portId: string) => void;
  /** The harbour's own window (she lies in it). */
  openPort: () => void;
}

let deps: PortCardDeps | null = null;
let sheet: SheetHandle | null = null;
let cur: { portId: string; view: PortInfoView | null; at: number } | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let stateRef: ClientState | null = null;

export function initPortCard(d: PortCardDeps): void {
  deps = d;
}

export function portCardOpen(): string | null {
  return sheet?.open && cur ? cur.portId : null;
}

export function closePortCard(): void {
  sheet?.close('code');
}

/** The time in words (minutes, or hours and minutes). */
export function spanText(sec: number): string {
  const m = Math.max(1, Math.ceil(sec / 60));
  return m >= 60 ? L('pc.hmin', { h: Math.floor(m / 60), m: m % 60 }) : L('pc.min', { n: m });
}

/** The port window's market: the time till the prices change (owner, 2026-10-30), or nothing. */
export function priceClockHtml(left: number | undefined): string {
  if (!left || left <= 0) return '';
  return `<p class="pcd-clock mk-clock">${icon('ui_hourglass', '⌛', 'ico-sm')}${esc(L('pc.newIn', { t: spanText(left) }))}</p>`;
}

/** The groups of the market, the food first: [title key, rows]. */
export function cardGroups(goods: PortInfoGood[]): ['pc.food' | 'pc.sells' | 'pc.buys' | 'pc.other', PortInfoGood[]][] {
  const food = FOOD_GOODS.map((g) => goods.find((x) => x.good === g)).filter((x): x is PortInfoGood => !!x);
  const rest = goods.filter((x) => !FOOD_GOODS.includes(x.good));
  const out: ['pc.food' | 'pc.sells' | 'pc.buys' | 'pc.other', PortInfoGood[]][] = [
    ['pc.food', food],
    ['pc.sells', rest.filter((x) => x.side < 0)],
    ['pc.buys', rest.filter((x) => x.side > 0)],
    ['pc.other', rest.filter((x) => x.side === 0)],
  ];
  return out.filter(([, list]) => list.length);
}

function trendMark(t: number | undefined): string {
  if (!t || Math.abs(t) < 0.01) return '<i class="pcd-tr"></i>';
  const up = t > 0;
  return `<i class="pcd-tr ${up ? 'up' : 'down'}" title="${esc(L(up ? 'pc.trendUp' : 'pc.trendDown'))} (${up ? '+' : '−'}${Math.round(Math.abs(t) * 100)}%)">${up ? '▲' : '▼'}${Math.round(Math.abs(t) * 100)}%</i>`;
}

function row(v: PortInfoView, r: PortInfoGood): string {
  const name = `${icon(`good_${r.good}`, '', 'ico-md')}<span class="pcd-gn">${esc(GOODS[r.good].name)}${r.legal ? '' : ` <small class="bad">${esc(L('pc.contraband'))}</small>`}</span>`;
  if (v.exact && r.buy !== undefined) {
    const stock = r.stock === undefined ? '' : isInfStock(r.stock) ? L('pc.inf') : fmt(r.stock);
    return `<div class="pcd-row">${name}<span class="pcd-n">${money(r.buy)}</span><span class="pcd-n">${r.sell !== undefined ? money(r.sell) : '—'}</span>${trendMark(r.trend)}<span class="pcd-n pcd-st">${stock}</span></div>`;
  }
  const lv = r.level;
  const tag = lv === undefined ? '<span class="pcd-lv none">—</span>' : `<span class="pcd-lv ${lv > 0 ? 'dear' : lv < 0 ? 'cheap' : ''}">${esc(L(lv > 0 ? 'pc.dear' : lv < 0 ? 'pc.cheap' : 'pc.usual'))}</span>`;
  return `<div class="pcd-row pcd-row--lv">${name}${tag}</div>`;
}

function market(v: PortInfoView | null): string {
  if (!v) return `<p class="muted pcd-src">${esc(L('pc.loading'))}</p>`;
  const age = v.ageSec ?? 0;
  const src = v.source === 'live' ? L('pc.live')
    : v.source === 'seen' ? `${age < 60 ? L('pc.seenNow') : L('pc.seen', { t: spanText(age) })}${v.stale ? ` · ${L('pc.stale')}` : ''}`
    : L('pc.none');
  const note = v.source !== 'live' && !v.exact && v.source === 'seen' ? `<p class="muted pcd-note">${esc(L('pc.levels'))}</p>` : '';
  const head = v.exact ? `<div class="pcd-row pcd-th"><span></span><span class="pcd-n">${esc(L('pc.buy'))}</span><span class="pcd-n">${esc(L('pc.sell'))}</span><i class="pcd-tr"></i><span class="pcd-n pcd-st">${esc(L('pc.stock'))}</span></div>` : '';
  const groups = cardGroups(v.goods).map(([k, list]) => `<div class="pcd-grp${k === 'pc.food' ? ' pcd-food' : ''}"><h4>${esc(L(k))}</h4>${v.exact ? `${head}${list.map((r) => row(v, r)).join('')}` : `<div class="pcd-lvgrid">${list.map((r) => row(v, r)).join('')}</div>`}</div>`).join('');
  return `<p class="pcd-src${v.stale ? ' warn' : v.source === 'none' ? ' muted' : ''}">${esc(src)}</p>${note}${groups}`;
}

function tile(ico: string, title: string, note: string, off = false): string {
  return `<div class="pcd-svc${off ? ' off' : ''}">${icon(ico, '', 'ico-md')}<span><b>${esc(title)}</b>${note ? `<small>${esc(note)}</small>` : ''}</span></div>`;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function services(state: ClientState, port: PortPublic, v: PortInfoView | null): string {
  const hulls = (v?.hulls ?? []).map((id) => SHIP_CLASSES[id as ShipClassId]?.name).filter(Boolean) as string[];
  // the hulls' levels (Нефигугум, post 26: «корабли ⚓4–6 в портах 2 и выше … портов 2 я не нашел»): by what the port
  // sells her (a career's extra rank counted), else by its rank
  const ids = (v?.hulls ?? []).filter((id) => SHIP_CLASSES[id as ShipClassId]) as ShipClassId[];
  const span: [number, number] | null = ids.length
    ? [Math.min(...ids.map((id) => levelRange(id)[0])), Math.max(...ids.map((id) => levelRange(id)[1]))]
    : yardSpan(port.shipyardTier, port.faction);
  const yard = port.shipyardTier > 0
    ? tile('menu_ship', `${L('pc.yard', { n: port.shipyardTier })}${span ? ` · ${L('pc.yardSpan', { span: anchorSpan(span) })}` : ''}`, hulls.length ? hulls.join(', ') : L('pc.yardRepair'))
    : tile('menu_ship', L('pc.noYard'), '', true);
  const key = KEY_PORTS.some((k) => k.id === port.id);
  const dw = portDwellings({ ...port, size: Math.max(1, Math.min(3, port.size)) as 1 | 2 | 3, key });
  const wh = state.self?.warehouses?.[port.id];
  const whVol = wh ? cargoVolume(wh) : 0;
  const list = [
    yard,
    tile('tab_tavern', L('pc.tavern'), v ? L('pc.crew', { n: v.crew }) : ''),
    tile('build_barracks', L('pc.dwell'), L('pc.dwellNote', { list: dw.map((d) => `${ROMAN[d.tier]}${d.up ? '+' : ''}`).join(' · ') })),
    hasTamer(port) ? tile('build_kennel', L('pc.tamer'), L('pc.tamerNote')) : '',
    tile('stat_crew', L('pc.healer'), L('pc.healerNote')),
    tile('tab_holdings', L('pc.wh'), wh ? L('pc.whRented', { vol: dec1(whVol) }) : L('pc.whFree')),
    v?.auction ? tile('coin', L('pc.auction'), L('pc.auctionNote')) : '',
    v?.exchange ? tile('tab_exchange', L('pc.exchange'), L('pc.exchangeNote')) : '',
    port.blackMarket ? tile('tab_law', L('pc.black'), L('pc.blackNote')) : '',
  ];
  return `<div class="pcd-svcs">${list.join('')}</div>`;
}

function body(state: ClientState, port: PortPublic, v: PortInfoView | null): string {
  const reg = REGIONS[port.region];
  const own = state.ownDisplay;
  const here = state.self?.dockedAt === port.id;
  const d = own ? Math.hypot(port.x - own.x, port.y - own.y) : 0;
  const v0 = Math.max(1, (state.ownStats?.maxSpeed ?? 8) * 0.85);
  const way = here ? L('pc.here') : `${L('pc.dist', { km: dec1(d / 1000) })} · ${L('pc.eta', { t: spanText((d * 1.15) / v0) })}`;
  const left = v && v.priceLeft > 0 && cur ? v.priceLeft - (performance.now() - cur.at) / 1000 : 0;
  const lvl = v ? ` · ⚓${v.level}` : '';
  const head = `<div class="pcd-head">${icon(`faction_${port.faction}`, '', 'ico-lg pcd-crest')}<div class="pcd-id"><span class="pcd-sub">${esc(FACTIONS[port.faction].name)} · ${esc(reg.name)}</span><span class="pcd-chips"><span class="pcd-chip ${reg.safety}">${esc(L(reg.safety === 'safe' ? 'pc.safe' : reg.safety === 'contested' ? 'pc.contested' : 'pc.lawless'))}${lvl}</span></span></div></div>
    <div class="pcd-meta"><span>${icon('stat_sails', '', 'ico-sm')}${esc(way)}</span>${left > 0 ? `<span class="pcd-clock">${icon('ui_hourglass', '⌛', 'ico-sm')}${esc(L('pc.newIn', { t: spanText(left) }))}</span>` : ''}</div>`;
  const ev = state.events.filter((e) => e.port === port.id || (!e.port && e.region === port.region && (e.kind === 'epidemic' || e.kind === 'black_tide' || e.kind === 'storm_century' || e.kind === 'invasion' || e.kind === 'blockade')));
  const events = ev.length ? `<div class="pcd-sec pcd-ev"><h3>${esc(L('pc.events'))}</h3>${ev.map((e) => `<p>⚑ ${esc(serverText(e.title))}</p>`).join('')}</div>` : '';
  const wh = state.self?.warehouses?.[port.id];
  const whGoods = wh ? (Object.entries(wh) as [GoodId, number][]).filter(([, n]) => n >= 1) : [];
  const whBlock = whGoods.length ? `<div class="pcd-sec"><h3>${esc(L('pc.yourWh'))}</h3><div class="pcd-wh">${whGoods.map(([g, n]) => `<span>${icon(`good_${g}`, '', 'ico-sm')}${esc(GOODS[g].name)} <b>${fmt(n)}</b></span>`).join('')}</div></div>` : '';
  // owner, 2026-10-30 (ferry.ts): a hub's «Переход» — its routes and prices; the buttons when she lies here
  const fleft = v?.ferry && cur ? Math.max(0, v.ferry.left - (performance.now() - cur.at) / 1000) : 0;
  const ferry = v?.ferry ? `<div class="pcd-sec pcd-ferry"><h3>${icon('build_lighthouse', '⛵', 'ico-sm')}${esc(LF('title'))}</h3>${ferryHtml(state, v.ferry, here, fleft, true)}</div>` : '';
  return `${head}${events}${ferry}<div class="pcd-sec"><h3>${esc(L('pc.market'))}</h3>${market(v)}</div><div class="pcd-sec"><h3>${esc(L('pc.services'))}</h3>${services(state, port, v)}</div>${whBlock}`;
}

function foot(state: ClientState, port: PortPublic): string {
  const here = state.self?.dockedAt === port.id;
  return here
    ? `<button type="button" class="k-btn k-btn--primary k-btn--lg pcd-go" data-pcd-open>${icon('tab_market', '', 'ico-sm')}${esc(L('pc.open'))}</button>`
    : `<button type="button" class="k-btn k-btn--primary k-btn--lg pcd-go" data-pcd-sail data-autofocus>${icon('stat_sails', '', 'ico-sm')}${esc(L('pc.sail'))}</button>`;
}

function render(): void {
  if (!sheet?.open || !cur || !stateRef) return;
  const port = stateRef.ports.find((p) => p.id === cur!.portId);
  if (!port) return;
  const b = sheet.body, top = b.scrollTop;
  b.innerHTML = body(stateRef, port, cur.view);
  b.scrollTop = top;
  if (sheet.foot) {
    const html = foot(stateRef, port);
    if (sheet.foot.dataset.k !== html) {
      sheet.foot.dataset.k = html;
      sheet.foot.innerHTML = html;
    }
  }
}

/** Opens the card of a harbour (or turns the open card to it) and asks the server for what she knows of it. */
export function openPortCard(state: ClientState, portId: string): void {
  const port = state.ports.find((p) => p.id === portId);
  if (!port || !deps) return;
  stateRef = state;
  const same = cur?.portId === portId && sheet?.open;
  cur = { portId, view: same ? cur!.view : null, at: same ? cur!.at : performance.now() };
  deps.send({ t: 'portInfo', port: portId });
  if (!sheet?.open) {
    sheet = openSheet({ title: placeName(port.name), body: '', foot: '', cls: 'pcd-sheet', height: 'auto', id: 'port-card', onClose: () => {
      sheet = null;
      cur = null;
      if (timer) clearInterval(timer);
      timer = null;
    } });
    sheet.foot?.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (!cur) return;
      const id = cur.portId;
      if (t.closest('[data-pcd-sail]')) {
        sheet?.close('button');
        deps?.sail(id);
      } else if (t.closest('[data-pcd-open]')) {
        sheet?.close('button');
        deps?.openPort();
      }
    });
    // «Переход» from the card (owner, 2026-10-30): she lies in the hub — the trip begins, the card goes
    sheet.body.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ferry]');
      if (!b || b.disabled) return;
      deps?.send({ t: 'ferry', to: b.dataset.ferry! });
      sheet?.close('button');
    });
    timer = setInterval(render, 5000); // the way and the countdown as she sails
  } else {
    const t = sheet.root.querySelector('.k-sheet-title');
    if (t) t.textContent = placeName(port.name);
  }
  render();
}

/** The server's answer (main.ts `portInfo`). */
export function portCardData(state: ClientState, view: PortInfoView): void {
  if (!cur || cur.portId !== view.portId) return;
  stateRef = state;
  cur.view = view;
  cur.at = performance.now();
  render();
}
