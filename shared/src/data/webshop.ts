// The website's shop (owner, 2026-10-20: «магазин сделать типа как мы сделали на fovgame.com чтобы оставил ник, купил и
// купил» — and the same day: «в магазин на сайте не все товары выложил, нужно все выкладывать. существ там, корабли и
// так далее»). A captain's name, a thing, the payment — and the thing is on her account, through the same doors the
// game's own purchases go through (server/src/game/webshop.ts). This is its catalogue: EVERYTHING the game's premium shop
// sells, each at its doubloon price in roubles (a doubloon is a rouble, docs/32 §1), on the site's tabs:
//
//  Дублоны    the top-up's packs (DOUBLOON_PACKS, with their bonus);
//  Капитаны   the premium captains (CAPTAIN_PRICE);
//  Корабли    every premium hull (ShipClassDef.premium) with her own creatures;
//  Существа   every premium creature by its packs (unitPacks) and the recruiters' packs of the line kinds;
//  Ускорители the speed-ups, brigades, elixirs, charters, scrolls, charms and kits;
//  Наборы     the shop's supplies: shot, the island's goods, maps, finery, scrolls of the path, the chest of finds;
//  Косметика  every title, plate, frame, emblem, cloth, trail, emote pack and bundle (the seasonal in their dates);
//  Акции      the starter chest, the subscription, the week's chest, the level's gifts, the deal of the day.
//
// The server takes every price from here (or, for the shop's own offers, from the shop's table as the live ops have
// it), never from the page. What the game sells that the site does not is WEB_EXCLUDED, each with its reason.

import { UNITS } from './army.ts';
import type { UnitId } from './army.ts';
import { CAPTAINS, CAPTAIN_IDS, CAPTAIN_PRICE } from './captains.ts';
import type { CaptainId } from './captains.ts';
import { CLOTHS, COS_EMOTES, TRAILS } from './cosmetics.ts';
import { AUTO_SCROLL_PACKS, DOUBLOON_PACKS, premiumShips, premiumUnits } from './premium.ts';
import { PREMIUM_NAMES, premiumFrom } from './premiumbeasts.ts';
import { DEAL_OFF, DEAL_POOL, OFFERS, RECRUIT_KINDS, SHOP, unitPacks } from './shop.ts';
import type { ShopFamily, ShopOffer } from './shop.ts';
import { SHIP_CLASSES } from './ships.ts';
import type { ShipClassId } from './ships.ts';
import { captainLevelFor, levelRange } from './shiplevel.ts';
import { DATA_RU_FLEET } from '../../../client/src/lang/data.fleet.ru.ts';
import { DATA_RU_CORE } from '../../../client/src/lang/data.ru.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../../../client/src/lang/ui/army.ts';

type Tr = [string, string];

export type WebKind = 'pack' | 'captain' | 'ship' | 'unit' | 'offer' | 'deal';
export type WebTab = 'dbl' | 'cap' | 'ship' | 'unit' | 'boost' | 'set' | 'cos' | 'deal';
export const WEB_TABS: WebTab[] = ['dbl', 'cap', 'ship', 'unit', 'boost', 'set', 'cos', 'deal'];
export const WEB_TAB_NAMES: Record<WebTab, Tr> = {
  dbl: ['Doubloons', 'Дублоны'], cap: ['Captains', 'Капитаны'], ship: ['Ships', 'Корабли'], unit: ['Creatures', 'Существа'],
  boost: ['Boosters', 'Ускорители'], set: ['Supplies', 'Наборы'], cos: ['Cosmetics', 'Косметика'], deal: ['Offers', 'Акции'],
};

/** The shelves inside a tab (their headings), in order. */
export const WEB_SECS: Record<string, Tr> = {
  deals: ['Offers', 'Акции'], gifts: ['Level gifts', 'Подарки к уровню'],
  combat: ['Warships', 'Боевые корабли'], trade: ['Traders', 'Торговые корабли'], fast: ['Fast ships', 'Быстрые корабли'], hauler: ['Haulers', 'Грузовозы'],
  beasts: ['Legendary creatures', 'Легендарные существа'], recruit: ['Recruiters', 'Наём команды'],
  island: ['The island and the yard', 'Остров и верфь'], battle: ['Battle', 'Бой'], voyage: ['Voyage', 'Поход'],
  supply: ['Ship’s stores', 'Припасы корабля'], books: ['Scrolls and finds', 'Свитки и находки'], res: ['Island goods', 'Товары острова'],
  cos_titles: ['Titles and plates', 'Звания и плашки'], cos_frames: ['Portrait frames', 'Рамки портрета'], cos_flags: ['Flags: emblems and cloths', 'Флаги: эмблемы и полотнища'],
  cos_trails: ['Wake trails', 'Следы за кормой'], cos_emotes: ['Emote packs', 'Наборы эмоций'], cos_sets: ['Outfits', 'Наряды'],
};

export interface WebItem {
  /** `d290` (a pack), `cap_drowned`, `ship_<class>`, `unit_<kind>_<k>`, a shop offer's own id, or `deal`. */
  id: string;
  kind: WebKind;
  tab: WebTab;
  /** The shelf inside the tab (WEB_SECS; '' for none). */
  sec: string;
  /** The card it is a button of (a family's offers, a creature's packs share one). */
  card: string;
  /** The catalogue's price in roubles (a shop offer's may be the live ops' own at the time of the order). */
  rub: number;
  /** The whole name (the receipt, the toast): the card's name and, for a card of several, the button's quantity. */
  name: Tr;
  /** The card's name, its line and a note under it (a level needed, what comes with a hull). */
  title: Tr;
  text: Tr;
  meta?: Tr;
  /** The button's quantity («×15», «8 ч»); none: a card of one. */
  qty?: Tr;
  /** The picture: an asset id of the manifest (icon.…, portrait.…, unit.…, a ship's sprite, cos.…); `swatch` a colour
   *  under it (a flag's cloth, a trail's glow). */
  art: string;
  swatch?: string;
  /** A pack's doubloons with its bonus. */
  doubloons?: number;
  bonus?: number;
  captain?: CaptainId;
  ship?: ShipClassId;
  unit?: UnitId;
  /** A creature pack's stacks (unitPacks) and the creatures in it. */
  k?: number;
  n?: number;
  /** The shop's offer it is. */
  offer?: string;
  /** Bought once only. */
  once?: boolean;
  /** How often it may be bought (the shop's limit). */
  per?: 'day' | 'week';
  /** On sale only between these (wall ms, UTC). */
  from?: number;
  until?: number;
  /** A level's gift: the level. */
  level?: number;
  /** A ship's least captain level; a creature's least ship level. */
  lv?: number;
  /** The card's ribbon. */
  tag?: 'best' | 'hot';
  /** It needs the captain aboard (a hull in port, creatures out of a fight, her hold, her book): delivered when she is. */
  aboard?: boolean;
}

const SAME_AS_AS: [string, string] = ['The battle bar’s scrolls are the same goods at the same prices as «Auto-battle scrolls» (as_*), sold on the site.', 'Свитки из панели боя — тот же товар по тем же ценам, что «Свитки автобоя» (as_*) на сайте.'];

/** What the game sells that the site does not, and why (tests/webshop.test.ts holds every id of the game's shop to the
 *  catalogue or to this list). */
export const WEB_EXCLUDED: Record<string, Tr> = {
  refill: ['Its price is the worth of the captain’s fallen of the last fight and it lasts an hour after it: there is nothing to price ahead.', 'Цена — стоимость павших в последнем бою, и предложение действует час после него: заранее цену не назвать.'],
  ...Object.fromEntries(AUTO_SCROLL_PACKS.map((p) => [p.id, SAME_AS_AS])),
  finish: ['«Finish now» finishes one running job of the captain: it is a button of that job, not a thing of the shelves.', '«Завершить сейчас» ускоряет одну идущую работу капитана — это кнопка самой работы, а не товар.'],
  first_gift: ['The first top-up’s double is a gift of the first payment (claimed in the game), not a thing for sale; a first payment on the site lays it in the game as a Stars payment does.', 'Удвоение первого пополнения — подарок к первой оплате (забирается в игре), а не товар; первая оплата на сайте кладёт его так же, как оплата звёздами.'],
  promo: ['Personal offers are made for one captain at one moment of the game (docs/34): they are hers in the game only.', 'Личные предложения делаются одному капитану в момент игры (docs/34) и действуют только в игре.'],
};

/** The shop's families on the site's tabs and shelves (every family of SHOP but the excluded is placed). */
const FAM_AT: Record<string, [WebTab, string]> = {
  starter: ['deal', 'deals'], sub: ['deal', 'deals'], weekly: ['deal', 'deals'],
  speed: ['boost', 'island'], btemp: ['boost', 'island'], bperm: ['boost', 'island'], prod: ['boost', 'island'], shield: ['boost', 'island'], move: ['boost', 'island'],
  xp: ['boost', 'battle'], ascroll: ['boost', 'battle'], rscroll: ['boost', 'battle'], charm: ['boost', 'battle'],
  wind: ['boost', 'voyage'], kit: ['boost', 'voyage'], pardon: ['boost', 'voyage'],
  ammo: ['set', 'supply'], ammo2: ['set', 'supply'], map: ['set', 'supply'], looks: ['set', 'supply'],
  pages: ['set', 'books'], art: ['set', 'books'], resmix: ['set', 'res'],
  crew: ['unit', 'recruit'],
};
const famAt = (f: ShopFamily): [WebTab, string] | null => {
  if (FAM_AT[f.id]) return FAM_AT[f.id];
  if (f.level) return ['deal', 'gifts'];
  if (/^rec\d$/.test(f.id)) return ['unit', 'recruit'];
  if (f.id.startsWith('res_')) return ['set', 'res'];
  if (f.tabs.includes('cos')) return ['cos', f.sec];
  return null;
};

/** The grants a captain need not be aboard for (server/src/game/shop.ts ACCOUNT_GRANTS): the rest wait for her. */
export const ACCOUNT_KINDS = new Set(['speed', 'builder', 'perm', 'res', 'prod', 'shield', 'move', 'xp', 'wind', 'charm', 'kit', 'scrolls', 'rscroll', 'sub', 'cos']);
export const offerAboard = (o: ShopOffer): boolean => o.grants.some((g) => !ACCOUNT_KINDS.has(g.k));

/** Thousands apart by a no-break space (a number never broken over two lines). */
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const ru = (n: number, one: string, few: string, many: string) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };

/** An offer's quantity on its button, both languages (client/src/ui/premium.ts qtyOf in the site's words). */
export function webQty(offer: ShopOffer, fam: ShopFamily): Tr | undefined {
  const g = offer.grants[0];
  if (!g || fam.sec === 'deals' || fam.offers.length < 2) return undefined;
  let n = 0;
  for (const x of offer.grants) {
    if (x.k !== g.k) continue;
    n += 'min' in x ? x.min : 'days' in x ? x.days : 'hours' in x ? x.hours : 'n' in x ? x.n : 1;
  }
  const hours = (h: number): Tr => [`${fmt(h)} h`, `${fmt(h)} ч`];
  const days = (d: number): Tr => [`${fmt(d)} d`, `${fmt(d)} ${ru(d, 'день', 'дня', 'дней')}`];
  switch (g.k) {
    case 'speed': return hours(Math.round(n / 60));
    case 'builder': return days(n);
    case 'perm': return offer.id === 'bperm_2' ? ['2nd', '2-я'] : ['1st', '1-я'];
    case 'prod': case 'shield': case 'xp': case 'wind': return n >= 48 && n % 24 === 0 ? days(n / 24) : hours(n);
    case 'crew': case 'units': return [`up to ${fmt(n)}`, `до ${fmt(n)}`];
    default: return [`×${fmt(n)}`, `×${fmt(n)}`];
  }
}

const CAPTAIN_RU: Record<string, Tr> = {
  drowned: ['Ilse Harrow, the Drowned Captain', 'Ильзе Харроу, Утопленница'],
  admiral: ['Cassius Dray, the Black Admiral', 'Кассий Дрей, Чёрный адмирал'],
};

/** A hull's name in both languages. */
export const shipName = (c: ShipClassId): Tr => [SHIP_CLASSES[c].name, DATA_RU_FLEET[`ships.SHIP_CLASSES.${c}.name`] ?? DATA_RU_CORE[`ships.SHIP_CLASSES.${c}.name`] ?? SHIP_CLASSES[c].name];
/** A creature's name (a stack's) in both languages. */
export function unitNames(u: UnitId): Tr {
  const p = (PREMIUM_NAMES as Record<string, [string, string, string, string]>)[u];
  if (p) return [p[0], p[1]];
  const en = (ARMY_EN as Record<string, string>)[`u.${u}`] ?? u;
  return [en, (ARMY_RU as Record<string, string>)[`u.${u}`] ?? en];
}
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** A family's picture (its icon of the manifest, a creature's figure). */
const famArt = (icon: string) => (icon.startsWith('unit:') ? `unit.${icon.slice(5)}` : `icon.${icon}`);

/** A cosmetic's own picture or swatch, by its offer (cos_<kind>_<id>, cos_pack_<id>). */
function cosArt(id: string, icon: string): { art: string; swatch?: string } {
  const m = /^cos_(plate|frame|emblem|cloth|trail|title|pack)_(.+)$/.exec(id);
  if (!m) return { art: `icon.${icon}` };
  const [, k, x] = m;
  if (k === 'plate' || k === 'frame' || k === 'emblem') return { art: `cos.${k}_${x}` };
  if (k === 'pack') return { art: `cos.emote_${COS_EMOTES.find((e) => e.pack === x)?.id ?? 'parrot'}` };
  if (k === 'cloth') {
    const c = CLOTHS.find((y) => y.id === x);
    return { art: '', ...(c ? { swatch: `linear-gradient(160deg, ${c.rgb}, ${c.rgb} 60%, rgba(0,0,0,0.45))` } : {}) };
  }
  if (k === 'trail') {
    const t = TRAILS.find((y) => y.id === x);
    return { art: '', ...(t ? { swatch: `radial-gradient(circle at 50% 55%, ${t.c[0]} 0 10%, ${t.c[1]} 34%, transparent 68%)` } : {}) };
  }
  return { art: 'icon.cos_titles' };
}

function build(): WebItem[] {
  const out: WebItem[] = [];
  // ---- the doubloons
  for (const p of DOUBLOON_PACKS) {
    const n = p.n + p.bonus;
    const name: Tr = [`${fmt(n)} doubloons`, `${fmt(n)} ${ru(n, 'дублон', 'дублона', 'дублонов')}`];
    out.push({
      id: p.id, kind: 'pack', tab: 'dbl', sec: '', card: p.id, rub: p.n, doubloons: n, bonus: p.bonus, art: 'icon.doubloon', name, title: name,
      text: p.bonus
        ? [`${fmt(p.n)} doubloons and ${fmt(p.bonus)} more on top.`, `${fmt(p.n)} дублонов и ещё ${fmt(p.bonus)} сверху.`]
        : ['Doubloons for the premium shop: hulls, creatures, speed-ups and looks.', 'Дублоны для премиум-лавки: корабли, существа, ускорения и облики.'],
      ...(p.id === 'd1990' ? { tag: 'best' as const } : {}),
    });
  }
  // ---- the captains
  for (const id of CAPTAIN_IDS) {
    const c = CAPTAINS[id];
    if (!c.premium) continue;
    const name = CAPTAIN_RU[id] ?? [c.name, c.name];
    out.push({
      id: `cap_${id}`, kind: 'captain', tab: 'cap', sec: '', card: `cap_${id}`, rub: CAPTAIN_PRICE, captain: id, once: true, art: c.portrait, name, title: name,
      text: ['A premium captain for your account: chosen when you start a new captain, for good.', 'Премиум-капитан на ваш счёт: выбирается при создании капитана, навсегда.'],
    });
  }
  // ---- the hulls, by their lists
  for (const c of premiumShips()) {
    const d = SHIP_CLASSES[c];
    const o = d.premium!;
    const lv = captainLevelFor(levelRange(c)[0]);
    const beasts = o.beasts ?? [];
    const name = shipName(c);
    const comes: Tr = beasts.length
      ? [`Comes with ${beasts.map((b) => `${lowerFirst(unitNames(b.u)[0])} ×${b.n}`).join(', ')}. `, `С ней приходят: ${beasts.map((b) => `${lowerFirst(unitNames(b.u)[1])} ×${b.n}`).join(', ')}. `]
      : ['', ''];
    out.push({
      id: `ship_${c}`, kind: 'ship', tab: 'ship', sec: d.list ?? 'combat', card: `ship_${c}`, rub: o.price, ship: c, lv, art: d.sprite, name, title: name, text: o.note, aboard: true,
      meta: [`${comes[0]}Captain level ${lv}+. Delivered in port; your old ship is berthed there.`, `${comes[1]}С ${lv}-го уровня капитана. Вручается в порту, прежний корабль остаётся у причала.`],
    });
  }
  // ---- the creatures: every premium kind by its packs
  for (const u of premiumUnits()) {
    const d = UNITS[u];
    const o = d.premium!;
    const nm = unitNames(u);
    const lv = premiumFrom(d.tier);
    unitPacks(o.price).forEach((p, i, all) => {
      const n = o.n * p.k;
      out.push({
        id: `unit_${u}_${p.k}`, kind: 'unit', tab: 'unit', sec: 'beasts', card: `unit_${u}`, rub: p.price, unit: u, k: p.k, n, lv, art: `unit.${u}`, aboard: true,
        name: [`${nm[0]} ×${n}`, `${nm[1]} ×${n}`], title: nm, text: o.note, qty: [`×${n}`, `×${n}`],
        meta: [`Tier ${d.tier} · a ship of level ${lv}+ · a free slot and hammocks aboard.`, `Уровень ${d.tier} · корабль ${lv}-го уровня и выше · свободный слот и койки на борту.`],
        ...(i === all.length - 1 ? { tag: 'best' as const } : {}),
      });
    });
  }
  // ---- the shop's families (a card each, an item an offer)
  for (const f of SHOP) {
    if (WEB_EXCLUDED[f.id]) continue;
    const at = famAt(f);
    if (!at) continue;
    const [tab, sec] = at;
    const cos = tab === 'cos' ? cosArt(f.id, f.icon) : null;
    const rec = /^rec\d$/.test(f.id) ? RECRUIT_KINDS[Number(f.id.slice(3)) - 1] : f.id === 'crew' ? 'deckhand' : null;
    for (const offer of f.offers) {
      const qty = webQty(offer, f);
      out.push({
        id: offer.id, kind: 'offer', tab, sec, card: f.id, rub: offer.price, offer: offer.id,
        name: qty ? [`${f.name[0]} · ${qty[0]}`, `${f.name[1]} · ${qty[1]}`] : f.name, title: f.name, text: f.text,
        ...(qty ? { qty } : {}),
        art: cos ? cos.art : famArt(f.icon), ...(cos?.swatch ? { swatch: cos.swatch } : {}),
        ...(rec ? { meta: [`${unitNames(rec)[0]}: into your free hammocks.`, `${unitNames(rec)[1]}: в свободные койки.`] as Tr } : {}),
        ...(offer.limit?.per === 'ever' ? { once: true } : offer.limit ? { per: offer.limit.per } : {}),
        ...(offer.from !== undefined ? { from: offer.from, until: offer.until } : {}),
        ...(f.level ? { level: f.level, meta: [`Opens at level ${f.level} for three days, once.`, `Открывается на ${f.level}-м уровне на три дня, один раз.`] as Tr } : {}),
        ...(offer.tag ? { tag: offer.tag } : {}),
        ...(offerAboard(offer) ? { aboard: true } : {}),
      });
    }
  }
  // ---- the deal of the day (its offer and price are the day's: dealItem, server/src/game/webshop.ts)
  out.push({
    id: 'deal', kind: 'deal', tab: 'deal', sec: 'deals', card: 'deal', rub: 0, art: 'icon.tattoo_star',
    name: ['Deal of the day', 'Товар дня'], title: ['Deal of the day', 'Товар дня'],
    text: [`One of the shop’s goods at ${Math.round(DEAL_OFF * 100)}% off, once a day; a new one at midnight (UTC).`, `Один из товаров лавки со скидкой ${Math.round(DEAL_OFF * 100)}%, раз в день; новый — в полночь по Гринвичу.`], per: 'day', tag: 'hot',
  });
  return out;
}

export const WEB_ITEMS: WebItem[] = build();
const BY_ID = new Map(WEB_ITEMS.map((x) => [x.id, x]));

/** The item of this id (an own key only: `__proto__` and its kin are nothing). */
export function webItem(id: unknown): WebItem | undefined {
  return typeof id === 'string' && id.length <= 60 ? BY_ID.get(id) : undefined;
}

/** The deal of the day as the site sells it: its offer's own picture and goods, at the day's price. */
export function dealItem(offerId: string, price: number): WebItem {
  const f = OFFERS.get(offerId)!;
  const qty = webQty(f.offer, f.fam);
  const what: Tr = qty ? [`${f.fam.name[0]} · ${qty[0]}`, `${f.fam.name[1]} · ${qty[1]}`] : f.fam.name;
  const base = BY_ID.get('deal')!;
  return {
    ...base, rub: price, offer: offerId, art: famArt(f.fam.icon), ...(offerAboard(f.offer) ? { aboard: true } : {}),
    name: [`Deal of the day: ${lowerFirst(what[0])}`, `Товар дня: ${lowerFirst(what[1])}`], title: [`Deal of the day: ${what[0]}`, `Товар дня: ${what[1]}`],
    meta: [`${f.fam.text[0]} Usually ${fmt(f.offer.price)} ₽.`, `${f.fam.text[1]} Обычно ${fmt(f.offer.price)} ₽.`],
  };
}

/** On sale at this wall time (a seasonal bundle only between its dates). */
export function webOnSale(x: WebItem, wall: number): boolean {
  return (x.from === undefined || wall >= x.from) && (x.until === undefined || wall < x.until);
}

/** Every id the game's premium shop sells (the shop's offers, the hulls, the creatures' packs, the top-up, the captains,
 *  the battle bar's scrolls, the deal of the day) — what the site must carry or explain (tests/webshop.test.ts). */
export function gameShopIds(): string[] {
  return [
    ...DOUBLOON_PACKS.map((p) => p.id),
    ...CAPTAIN_IDS.filter((id) => CAPTAINS[id].premium).map((id) => `cap_${id}`),
    ...premiumShips().map((c) => `ship_${c}`),
    ...premiumUnits().flatMap((u) => unitPacks(UNITS[u].premium!.price).map((p) => `unit_${u}_${p.k}`)),
    ...OFFERS.keys(),
    ...AUTO_SCROLL_PACKS.map((p) => p.id),
    'deal',
  ];
}

/** A captain's name as the site takes it: trimmed, inner spaces single, 2–24 characters of letters, digits, spaces and
 *  `_ - ' .` (null: not a name at all — no lookup is spent on it). */
export function cleanCaptainName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFC').trim().replace(/\s+/g, ' ');
  return s.length >= 2 && s.length <= 24 && /^[\p{L}\p{N} _'.-]+$/u.test(s) ? s : null;
}

/** Russian forms of the in-game toasts of a delivery from the site (client/src/lang/server.ts). */
export function webPatterns(): [string, string][] {
  const seen = new Set<string>();
  const names: [string, string][] = [];
  const add = (t: Tr) => {
    if (seen.has(t[0])) return;
    seen.add(t[0]);
    names.push([t[0], t[1]]);
  };
  for (const x of WEB_ITEMS) if (x.kind !== 'pack') add(x.name);
  for (const id of DEAL_POOL) add(dealItem(id, 0).name);
  return [
    ['Web shop purchase: {0} doubloons.', 'Покупка с сайта: {0} дубл.'],
    ['Web shop purchase: {0}.', 'Покупка с сайта: {0}.'],
    ['A web shop purchase waits for you in port: {0}. Make port to take her.', 'Покупка с сайта ждёт вас в порту: {0}. Зайдите в порт, чтобы её забрать.'],
    ['A web shop purchase waits for you: {0}. It comes aboard once you are out of the fight.', 'Покупка с сайта ждёт вас: {0}. Она придёт на борт, когда закончится бой.'],
    ['A web shop purchase could not be handed over: {0}. Its {1} doubloons are on your account.', 'Покупку с сайта не удалось вручить: {0}. Её {1} дубл. зачислены на ваш счёт.'],
    ...names,
  ];
}
