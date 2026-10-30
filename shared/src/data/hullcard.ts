// A hull's whole card (Нефигугум, forum post 28: the tree of hulls showed nothing but the level; «продумать наперёд
// план прокачки», the traders and fishers above all needing the hold): her role and her line, her flavour, every number
// the game sails her by over her levels (hull, sails, speed, turn, hold, crew and hammocks, army stacks, guns a side and
// the calibres her deck carries, armour), her trait and gift, her price, the captain's level, where she is sold, how the
// tree opens her, whether the captain owns her, and the line against the ship she sails.
//
// One builder for every screen: the yard's tree (client/src/ui/research.ts) draws `hullCardHtml`, the site's fleet
// (tools/site/build.ts) reads the numbers, and the generic tap-to-detail system reads `data-detail="hull:<classId>"`
// (`detailHull` parses it) and renders the same card. Everything is read from the game's own tables (ships.ts,
// shiplevel.ts, army.ts, research.ts, yardhulls.ts); nothing is a copy.

import { armySlots } from './army.ts';
import { FACTIONS } from './factions.ts';
import type { FactionId } from './factions.ts';
import { RESEARCH_COST, isResearched, needsResearch, researchParents, researchQuote } from './research.ts';
import type { ResearchView } from './research.ts';
import { giftOf } from './shipgifts.ts';
import { captainLevelFor, hullRole, levelRange, levelScale } from './shiplevel.ts';
import type { HullRole } from './shiplevel.ts';
import { GUNS, SHIP_CLASSES } from './ships.ts';
import type { FleetList, GunId, ShipClassId } from './ships.ts';
import { DATA_RU_CORE } from '../../../client/src/lang/data.ru.ts';
import { DATA_RU_FLEET } from '../../../client/src/lang/data.fleet.ru.ts';

export type HullLang = 'en' | 'ru';
type Tr = [string, string];

/** What the captain's own state adds to the card (all optional: the site has none). */
export interface HullCtx {
  /** The hull she sails and its level (for «you sail her» and the comparison line). */
  sailing?: ShipClassId;
  sailLevel?: number;
  /** Hulls in her berths, with the port each lies in. */
  berths?: { classId: ShipClassId; port?: string }[];
  research?: ResearchView;
  captainLevel?: number;
}

export type HullStatKey = 'hull' | 'sails' | 'speed' | 'turn' | 'hold' | 'crew' | 'hammocks' | 'slots' | 'guns' | 'armor';

export interface HullStat {
  k: HullStatKey;
  name: string;
  /** At her first level and at her highest (equal when the level does not move it). */
  lo: number;
  hi: number;
  /** «400» or «400–460», with its unit. */
  text: string;
}

export interface HullDelta {
  k: 'hold' | 'speed' | 'hammocks' | 'hull';
  name: string;
  /** Her number (at her first level) minus the sailed ship's (at the level she is). */
  d: number;
  text: string;
}

export type HullTreeState = 'start' | 'known' | 'ready' | 'near' | 'locked' | 'premium';

export interface HullCard {
  id: ShipClassId;
  name: string;
  sprite: string;
  list: FleetList;
  listName: string;
  role: HullRole;
  roleName: string;
  /** Her role line (flavour) and, for a premium hull, the line on her card. */
  flavour: string;
  note?: string;
  tier: number;
  levels: [number, number];
  levelText: string;
  captainLevel: number;
  captainLevelTop: number;
  stats: HullStat[];
  guns: { perSide: number; bow: number; stern: number; maxLb: number; kinds: number; text: string };
  traits: { tag: string; name: string; text: string }[];
  price: { silver?: number; doubloons?: number; pass?: boolean; text: string };
  sold: { yardTier: number; factions: FactionId[]; text: string };
  tree: { state: HullTreeState; cost: number; have?: number; parents: string[]; text: string };
  own: 'sail' | 'berth' | null;
  ownText: string;
  compare?: { against: string; rows: HullDelta[] };
}

const W = {
  list: { combat: ['Warship', 'Боевой'], trade: ['Trader', 'Торговый'], fast: ['Runner', 'Быстрый'], hauler: ['Hauler', 'Грузовой'] } as Record<FleetList, Tr>,
  role: {
    war: ['Fights at her own level', 'Сражается в полную силу своего ⚓'],
    all: ['Fights at her own level', 'Сражается в полную силу своего ⚓'],
    trade: ['A merchant: fights two levels below her ⚓, carries far more', 'Купец: в бою на два ⚓ ниже, зато возит гораздо больше'],
    fish: ['A fisher: fights one level below her ⚓', 'Промысловый: в бою на один ⚓ ниже'],
    special: ['A hull of her own kind', 'Особый корпус'],
    beast: ['A creature of the deep', 'Существо глубин'],
  } as Record<HullRole, Tr>,
  stat: {
    hull: ['Hull', 'Корпус'], sails: ['Sails', 'Паруса'], speed: ['Speed', 'Скорость'], turn: ['Turn', 'Поворот'], hold: ['Hold', 'Трюм'],
    crew: ['Crew, least', 'Команда, мин.'], hammocks: ['Hammocks', 'Койки'], slots: ['Army stacks', 'Слоты армии'], guns: ['Guns a side', 'Пушек на борт'],
    armor: ['Armour', 'Броня'],
  } as Record<HullStatKey, Tr>,
  kn: ['kn', 'уз'], degS: ['°/s', '°/с'], lb: ['pdr', 'фн'],
  gunsLine: ['up to {lb}-{u} · {n} kinds of gun · chasers {b} bow / {s} stern', 'калибр до {lb} {u} · пушек {n} видов · погонные: нос {b} / корма {s}'],
  trait: ['Her trait', 'Особенность'], gift: ['Her gift', 'Её дар'], beasts: ['Comes with', 'В комплекте'],
  beastsText: ['{n} creatures of her own come aboard with her.', 'С ней на борт приходят её существа: {n}.'],
  silver: ['{n} silver at a yard', '{n} серебра на верфи'],
  doubloons: ['{n} doubloons in the premium shop', '{n} дублонов в премиум-лавке'],
  pass: ['Season card, tier 100 only', 'Только сезонная карта, 100-я ступень'],
  soldAny: ['A yard of rank {t} or higher, any flag', 'Верфь ранга {t} и выше, любой флаг'],
  soldOnly: ['A yard of rank {t} or higher: {f} only', 'Верфь ранга {t} и выше, только {f}'],
  soldPrem: ['Delivered in any port; your old ship is berthed there', 'Вручается в любом порту, прежний корабль встаёт к причалу'],
  capLv: ['Captain level {n}+', 'С {n}-го уровня капитана'],
  capLvTop: ['⚓{a}: level {n} · refits up to ⚓{b}: level {m}', '⚓{a}: {n}-й уровень · перестройка до ⚓{b}: {m}-й'],
  capLvOne: ['⚓{a}: level {n}', '⚓{a}: {n}-й уровень'],
  tStart: ['Known from the start: tier 1 needs no research', 'Известен с начала: первый ранг не исследуется'],
  tKnown: ['Researched: on sale at the yards that build her', 'Исследован: продаётся на верфях, что его строят'],
  tPrem: ['Never researched: bought for doubloons; her experience researches the next tier', 'Не исследуется: покупается за дублоны; её опыт открывает следующий ранг'],
  tNeed: ['Research: {cost} experience, earned on a tier-{t} hull of her line ({names}) or free', 'Исследование: {cost} опыта — с кораблей {t}-го ранга её линии ({names}) или свободного'],
  tHave: ['{have} / {cost} experience earned toward her', 'Набрано {have} / {cost} опыта'],
  tReady: ['Ready to research', 'Можно исследовать'],
  tLocked: ['Research one of these first: {names}', 'Сначала исследуйте один из них: {names}'],
  sail: ['You sail her', 'Вы на нём ходите'], berth: ['In your berth{at}', 'Стоит у вашего причала{at}'], none: ['Not yours yet', 'Пока не ваш'],
  vs: ['Against your {name} (⚓{lv})', 'Против вашего «{name}» (⚓{lv})'],
};

const fmt = (n: number): string => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const dec = (n: number): string => (Math.round(n * 10) / 10).toString();
const fill = (s: string, v: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => (v[k] !== undefined ? String(v[k]) : m));
const ruData = (key: string, en: string): string => DATA_RU_FLEET[key] ?? DATA_RU_CORE[key] ?? en;

/** A hull's name in a language. */
export function hullName(id: ShipClassId, lang: HullLang): string {
  const c = SHIP_CLASSES[id];
  return lang === 'ru' ? ruData(`ships.SHIP_CLASSES.${id}.name`, c.name) : c.name;
}

/** The calibre in pounds of each gun (by its name: «24-pdr Carronade»), the perrier's stone a 6. */
const GUN_LB: Record<GunId, number> = {
  minion_4: 4, light_6: 6, perrier: 6, culverin_8: 8, long_9: 9, medium_12: 12, whaling_gun: 12, drowned_bronze: 12, gunbreaker_14: 14,
  heavy_18: 18, shell_gun: 18, carronade_24: 24, demi_cannon_32: 32,
};

/** The guns her deck carries (a gun's `minTier` against her class's tier, server/src/game/ports.ts). */
export function hullGuns(id: ShipClassId): GunId[] {
  const t = SHIP_CLASSES[id].tier;
  return (Object.keys(GUNS) as GunId[]).filter((g) => GUNS[g].minTier <= t);
}

/** Her numbers at a level of hers, as computeShipStats lays the level on her class (no fittings, no captain). */
export function hullAt(id: ShipClassId, level: number): { hull: number; sails: number; speed: number; hold: number; hammocks: number } {
  const c = SHIP_CLASSES[id];
  const k = levelScale(id, level);
  return { hull: Math.round(c.hull * k.hull), sails: Math.round(c.sailHp * k.hull), speed: c.maxSpeed * k.speed, hold: Math.round(c.holdVolume * k.hold), hammocks: Math.round(c.crewMax * k.crew) };
}

/** `data-detail="hull:<classId>"` → the hull, or null. */
export function detailHull(v: string | null | undefined): ShipClassId | null {
  if (!v || !v.startsWith('hull:')) return null;
  const id = v.slice(5) as ShipClassId;
  return SHIP_CLASSES[id]?.list ? id : null;
}

export function hullCard(id: ShipClassId, lang: HullLang, ctx: HullCtx = {}): HullCard {
  const L = (t: readonly string[], v?: Record<string, string | number>): string => fill(t[lang === 'ru' ? 1 : 0], v ?? {});
  const c = SHIP_CLASSES[id];
  const list = c.list ?? 'combat';
  const [lo, hi] = levelRange(id);
  const a = hullAt(id, lo), b = hullAt(id, hi);
  const span = (x: number, y: number, unit = ''): string => (x === y ? `${fmt(x)}${unit}` : `${fmt(x)}–${fmt(y)}${unit}`);
  const st = (k: HullStatKey, x: number, y: number, text: string): HullStat => ({ k, name: L(W.stat[k]), lo: x, hi: y, text });
  const slots = armySlots(c.tier);
  const stats: HullStat[] = [
    st('hold', a.hold, b.hold, span(a.hold, b.hold)),
    st('hull', a.hull, b.hull, span(a.hull, b.hull)),
    st('sails', a.sails, b.sails, span(a.sails, b.sails)),
    st('speed', a.speed, b.speed, a.speed === b.speed ? `${dec(a.speed)} ${L(W.kn)}` : `${dec(a.speed)}–${dec(b.speed)} ${L(W.kn)}`),
    st('turn', c.turnRate, c.turnRate, `${dec(c.turnRate)}${L(W.degS)}`),
    st('crew', c.crewMin, c.crewMin, fmt(c.crewMin)),
    st('hammocks', a.hammocks, b.hammocks, span(a.hammocks, b.hammocks)),
    st('slots', slots, slots, String(slots)),
    st('guns', c.gunPortsPerSide, c.gunPortsPerSide, String(c.gunPortsPerSide)),
    st('armor', c.armor, c.armor, `${Math.round(c.armor * 100)}%`),
  ];
  const gunIds = hullGuns(id);
  const maxLb = Math.max(...gunIds.map((g) => GUN_LB[g] ?? 0));
  const guns = { perSide: c.gunPortsPerSide, bow: c.bowChasers, stern: c.sternChasers, maxLb, kinds: gunIds.length, text: L(W.gunsLine, { lb: maxLb, u: L(W.lb), n: gunIds.length, b: c.bowChasers, s: c.sternChasers }) };

  const traits: HullCard['traits'] = [{ tag: L(W.trait), name: lang === 'ru' ? ruData(`ships.SHIP_CLASSES.${id}.passive.name`, c.passive.name) : c.passive.name, text: lang === 'ru' ? ruData(`ships.SHIP_CLASSES.${id}.passive.description`, c.passive.description) : c.passive.description }];
  const gift = giftOf(id);
  if (gift) traits.push({ tag: L(W.gift), name: L(gift.name), text: L(gift.text) });
  const beasts = (c.premium?.beasts ?? []).reduce((s, x) => s + x.n, 0);
  if (beasts) traits.push({ tag: L(W.beasts), name: '', text: L(W.beastsText, { n: beasts }) });

  const capLv = captainLevelFor(lo), capTop = captainLevelFor(hi);
  const facs = (c.factions ?? []).filter((f): f is FactionId => f in FACTIONS);
  const facName = (f: FactionId) => (lang === 'ru' ? ruData(`factions.FACTIONS.${f}.short`, FACTIONS[f].short) : FACTIONS[f].short);
  const price: HullCard['price'] = c.premium?.pass ? { pass: true, text: L(W.pass) } : c.premium ? { doubloons: c.premium.price, text: L(W.doubloons, { n: fmt(c.premium.price) }) } : { silver: c.price, text: L(W.silver, { n: fmt(c.price) }) };
  const sold = { yardTier: c.tier, factions: facs, text: c.premium ? L(W.soldPrem) : facs.length ? L(W.soldOnly, { t: c.tier, f: facs.map(facName).join(', ') }) : L(W.soldAny, { t: c.tier }) };

  // The tree (research.ts): what opens her, and — with the captain's research — how far she is.
  const parents = researchParents(id).map((p) => hullName(p, lang));
  const cost = RESEARCH_COST[c.tier] ?? 0;
  const owned = [...(ctx.sailing ? [ctx.sailing] : []), ...(ctx.berths ?? []).map((x) => x.classId)];
  let tree: HullCard['tree'];
  const need = L(W.tNeed, { cost: fmt(cost), t: Math.max(1, c.tier - 1), names: parents.join(', ') });
  if (c.premium) tree = { state: 'premium', cost: 0, parents, text: L(W.tPrem) };
  else if (!needsResearch(id)) tree = { state: 'start', cost: 0, parents, text: L(W.tStart) };
  else if (ctx.research && isResearched(ctx.research, id, owned)) tree = { state: 'known', cost, parents, text: `${L(W.tKnown)}. ${need}` };
  else if (ctx.research) {
    const q = researchQuote(ctx.research, id, owned);
    const have = Math.min(q.cost, q.pool);
    tree = q.ready
      ? { state: 'ready', cost, have, parents, text: `${L(W.tReady)}: ${need}` }
      : q.known.length
        ? { state: 'near', cost, have, parents, text: `${need}. ${L(W.tHave, { have: fmt(have), cost: fmt(cost) })}` }
        : { state: 'locked', cost, parents, text: `${need}. ${L(W.tLocked, { names: parents.join(', ') })}` };
  } else tree = { state: 'locked', cost, parents, text: need };

  const berth = ctx.berths?.find((x) => x.classId === id);
  const own = ctx.sailing === id ? 'sail' : berth ? 'berth' : null;
  const ownText = own === 'sail' ? L(W.sail) : own === 'berth' ? L(W.berth, { at: berth?.port ? (lang === 'ru' ? ` в порту ${berth.port}` : ` at ${berth.port}`) : '' }) : L(W.none);

  let compare: HullCard['compare'];
  if (ctx.sailing && ctx.sailing !== id && SHIP_CLASSES[ctx.sailing]) {
    const sl = ctx.sailLevel ?? levelRange(ctx.sailing)[0];
    const me = hullAt(ctx.sailing, sl);
    const sign = (d: number, t: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${t}`;
    const row = (k: HullDelta['k'], d: number, t: string): HullDelta => ({ k, name: L(W.stat[k]), d, text: sign(d, t) });
    const ds = a.speed - me.speed;
    compare = {
      against: L(W.vs, { name: hullName(ctx.sailing, lang), lv: sl }),
      rows: [
        row('hold', a.hold - me.hold, fmt(Math.abs(a.hold - me.hold))),
        row('speed', Math.round(ds * 10) / 10, `${dec(Math.abs(ds))} ${L(W.kn)}`),
        row('hammocks', a.hammocks - me.hammocks, fmt(Math.abs(a.hammocks - me.hammocks))),
        row('hull', a.hull - me.hull, fmt(Math.abs(a.hull - me.hull))),
      ],
    };
  }

  return {
    id, name: hullName(id, lang), sprite: c.sprite, list, listName: L(W.list[list]), role: hullRole(id), roleName: L(W.role[hullRole(id)]),
    flavour: lang === 'ru' ? ruData(`ships.SHIP_CLASSES.${id}.role`, c.role) : c.role,
    ...(c.premium ? { note: L(c.premium.note) } : {}),
    tier: c.tier, levels: [lo, hi], levelText: lo === hi ? `⚓${lo}` : `⚓${lo}–${hi}`,
    captainLevel: capLv, captainLevelTop: capTop, stats, guns, traits, price, sold, tree, own, ownText, ...(compare ? { compare } : {}),
  };
}

// ------------------------------------------------------------------------------------------------ the card as HTML

const H = {
  sec: { stats: ['Numbers by her levels', 'Характеристики по её уровням'], guns: ['Guns', 'Пушки'], buy: ['Price and where', 'Цена и где купить'], tree: ['In the tree', 'В дереве кораблей'], cap: ['Captain', 'Капитан'] },
  close: ['Close', 'Закрыть'], tier: ['tier {n}', 'ранг {n}'],
} as const;

const esc = (s: string | number): string => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** The card as HTML (classes `hc-*`; client/styles.css draws them). `art`: her picture's address; `actions`: buttons
 *  the screen adds (research, buy). The ✕ carries `data-hc-close`. */
export function hullCardHtml(card: HullCard, lang: HullLang, opts: { art?: string | null; actions?: string } = {}): string {
  const L = (t: readonly string[], v?: Record<string, string | number>): string => fill(t[lang === 'ru' ? 1 : 0], v ?? {});
  const stat = (s: HullStat) => `<div class="hc-stat hc-${s.k}"><span>${esc(s.name)}</span><b>${esc(s.text)}</b></div>`;
  const cmp = card.compare
    ? `<div class="hc-cmp"><span class="hc-cmp-h">${esc(card.compare.against)}</span>${card.compare.rows.map((r) => `<span class="hc-d hc-d-${r.d > 0 ? 'up' : r.d < 0 ? 'down' : 'eq'}">${esc(r.name)} <b>${esc(r.text)}</b></span>`).join('')}</div>`
    : '';
  const trait = (t: HullCard['traits'][number]) => `<li><i>${esc(t.tag)}</i>${t.name ? `<b>${esc(t.name)}.</b> ` : ''}${esc(t.text)}</li>`;
  return `<div class="hc" data-hull="${esc(card.id)}">
  <button class="hc-x" data-hc-close aria-label="${esc(L(H.close))}">✕</button>
  <div class="hc-head">
    <div class="hc-art">${opts.art ? `<img src="${esc(opts.art)}" alt="" draggable="false" />` : ''}</div>
    <div class="hc-title">
      <div class="hc-name" role="heading" aria-level="3">${esc(card.name)}</div>
      <div class="hc-chips"><span class="hc-chip hc-l-${card.list}">${esc(card.listName)}</span><span class="hc-chip">${esc(L(H.tier, { n: card.tier }))} · ${esc(card.levelText)}</span><span class="hc-chip hc-own-${card.own ?? 'none'}">${esc(card.ownText)}</span></div>
      <p class="hc-flav">${esc(card.flavour)}</p>${card.note ? `<p class="hc-note">${esc(card.note)}</p>` : ''}
      <p class="hc-role">${esc(card.roleName)}</p>
    </div>
  </div>
  ${cmp}
  <h4>${esc(L(H.sec.stats))} <small>${esc(card.levelText)}</small></h4>
  <div class="hc-stats">${card.stats.map(stat).join('')}</div>
  <h4>${esc(L(H.sec.guns))}</h4><p class="hc-p">${esc(card.guns.text)}</p>
  <ul class="hc-traits">${card.traits.map(trait).join('')}</ul>
  <div class="hc-grid">
    <div><h4>${esc(L(H.sec.buy))}</h4><p class="hc-p"><b class="hc-price">${esc(card.price.text)}</b><br>${esc(card.sold.text)}</p></div>
    <div><h4>${esc(L(H.sec.cap))}</h4><p class="hc-p">${esc(L(W.capLv, { n: card.captainLevel }))}<br><span class="muted">${esc(card.levels[0] === card.levels[1] ? L(W.capLvOne, { a: card.levels[0], n: card.captainLevel }) : L(W.capLvTop, { a: card.levels[0], n: card.captainLevel, b: card.levels[1], m: card.captainLevelTop }))}</span></p></div>
    <div class="hc-tree hc-t-${card.tree.state}"><h4>${esc(L(H.sec.tree))}</h4><p class="hc-p">${esc(card.tree.text)}</p>${card.tree.have !== undefined && card.tree.cost ? `<div class="hc-bar"><i style="width:${Math.round((card.tree.have / card.tree.cost) * 100)}%"></i></div>` : ''}${opts.actions ?? ''}</div>
  </div>
</div>`;
}
