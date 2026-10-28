// The website's hover cards (owner, 2026-10-28: «нужно чтобы на сайте в модалке при наведении на снаряжение капитана
// корабля и еще где-то вся инфа выпрыгивала как в игре при наведении»). The same words the game's own cards show — an
// item's (client/src/ui/gear.ts card), a creature's (webdetail.ts unitCard: the shop's), a skill's, an order's, a
// talent's, a gun's, a fitting's, a figurehead's, a relic's, a set's, a building's, a deed's — in both tongues, as plain
// data the page lays out (site/js/rating.js). NO price, sell value nor upkeep: the site never shows a coin.

import type { Item, Slot } from './items.ts';
import { CAP_STAT_NAMES, LEGENDARY_ITEMS, RARITY_COLOR, RARITY_NAMES, SETS, SLOT_NAMES, itemEffect, itemName, itemSlot } from './items.ts';
import { ARTIFACTS, ART_CLASS_NAMES, ART_SETS, RELICS, artPrimOf } from './artifacts.ts';
import type { ArtForge } from './artifacts.ts';
import { GM_RANK, ORDERS, PRIM_NAMES, PRIMS, RANK_NAMES, SCHOOL_NAMES, SKILLS, skillText } from './hero.ts';
import type { OrderId, Prims, SkillId } from './hero.ts';
import { TALENTS, TALENTS_BY_ID, TREES } from './talents.ts';
import { GUNS, MODULES, MOUNTS } from './ships.ts';
import { FIGUREHEADS } from './shipbuild.ts';
import type { StatKey, StatMods } from './stats.ts';
import { UNITS } from './army.ts';
import type { UnitId } from './army.ts';
import { unitCard } from './webdetail.ts';
import type { ArtOf } from './webdetail.ts';
import { TOWN } from './town.ts';
import type { TownId } from './town.ts';
import { PRODUCERS } from './base.ts';
import { BUILDINGS } from './holdings.ts';
import type { BuildingId } from './holdings.ts';
import { DEEDS } from './deeds.ts';
import { FEATS } from './renown.ts';
import { TATTOO_BY_ID } from './sidequests.ts';
import { PETS } from './companions.ts';
import type { PetId } from './companions.ts';
import { LOWER_BETTER } from '../../../client/src/ui/gearcmp.ts';
import { DATA_RU } from '../../../client/src/lang/data.ts';
import { EN as GEAR_EN, RU as GEAR_RU } from '../../../client/src/lang/ui/gear.ts';
import { EN as REL_EN, RU as REL_RU } from '../../../client/src/lang/ui/relics.ts';
import { EN as HERO_EN, RU as HERO_RU } from '../../../client/src/lang/ui/hero.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../../../client/src/lang/ui/army.ts';

type Tr = [string, string];

/** A line of numbers: its name and value, green when it helps, red when it hurts. */
export interface TipRow { k: Tr; v: Tr; tone?: 'up' | 'down' }
/** A line of words: a gift, a set's bonus (lit when worn), a rank's text, a note, the flavour. */
export interface TipNote { t: Tr; tone?: 'gift' | 'head' | 'on' | 'off' | 'muted' | 'flavor' }
/** A hover card: the name in its colour, what kind it is, its numbers and its words. */
export interface Tip { name: Tr; color?: string; sub?: Tr; rows?: TipRow[]; notes?: TipNote[] }

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => (v[k] !== undefined ? String(v[k]) : `{${k}}`));
const dict = <E extends Record<string, string>>(en: E, ru: Record<string, string>) => (k: string, v: Record<string, string | number> = {}): Tr => {
  const e = (en as Record<string, string>)[k] ?? k;
  return [fill(e, v), fill(ru[k] ?? e, v)];
};
const G = dict(GEAR_EN, GEAR_RU as Record<string, string>);
const RL = dict(REL_EN, REL_RU as Record<string, string>);
const HL = dict(HERO_EN, HERO_RU as Record<string, string>);
const AL = dict(ARMY_EN, ARMY_RU as Record<string, string>);
const ru = (key: string, en: string): Tr => [en, DATA_RU[key] ?? en];
const same = (s: string | number): Tr => [String(s), String(s)];
const n2 = (x: number, d: number): Tr => {
  const r = Math.round(x * 10 ** d) / 10 ** d;
  return [String(r), String(r).replace('.', ',')];
};
const both = (f: (i: 0 | 1) => string): Tr => [f(0), f(1)];

// ------------------------------------------------------------------------------------------------ numbers (gear.ts)

function statLabel(k: StatKey): Tr {
  return `stat.${k}` in GEAR_EN ? G(`stat.${k}`) : G('stat.other', { k });
}
/** A stat's value as the game writes it: a share in per cent, a few in plain numbers or degrees. */
function statValue(k: StatKey, v: number): Tr {
  const sign = v > 0 ? '+' : '−';
  const a = Math.abs(v);
  if (k === 'moraleRegen' || k === 'grapeMorale') return both((i) => `${sign}${n2(a, 2)[i]}`);
  if (k === 'noGoDeg' || k === 'gunTrain') return both((i) => `${sign}${n2(a, 1)[i]}°`);
  const pct = a * 100;
  return both((i) => `${sign}${n2(pct, pct >= 10 ? 0 : 1)[i]}%`);
}
const statRow = (k: StatKey, v: number): TipRow => ({ k: statLabel(k), v: statValue(k, v), tone: (LOWER_BETTER.has(k) ? v < 0 : v > 0) ? 'up' : 'down' });
const statRows = (m: StatMods | undefined, times = 1): TipRow[] =>
  Object.entries(m ?? {}).filter(([, v]) => Math.abs((v ?? 0) * times) > 1e-9).map(([k, v]) => statRow(k as StatKey, (v ?? 0) * times));
const primRows = (p: Partial<Prims> | undefined): TipRow[] => PRIMS.filter((x) => p?.[x]).map((x) => ({ k: PRIM_NAMES[x], v: same(`+${p![x]}`), tone: 'up' as const }));

function forgeLine(f: ArtForge | undefined): Tr | null {
  if (!f?.k || !Number.isFinite(f.v)) return null;
  const v = n2((f.v ?? 0) * 100, 1);
  return [RL(`fl.${f.k}`, { v: `${v[0]}%` })[0], RL(`fl.${f.k}`, { v: `${v[1]}%` })[1]];
}

// ------------------------------------------------------------------------------------------------ an item (gear.ts card)

/** An item's card, as the gear window's: name in its rarity's colour, kind · slot · level, its lines, its gift, its
 *  set and how many of it are worn (`worn`: everything she wears), its wear. */
export function itemTip(it: Item, worn: readonly Item[], slotHint?: Slot): Tip {
  const slot = slotHint ?? itemSlot(it);
  const e = itemEffect({ ...it, dur: Math.max(1, it.dur) });
  const art = it.art ? ARTIFACTS[it.art] : null;
  const leg = it.legendary ? LEGENDARY_ITEMS[it.legendary] : null;
  const kind = art ? ART_CLASS_NAMES[art.cls] : RARITY_NAMES[it.rarity] ?? RARITY_NAMES[0];
  const lv = G('lv', { n: it.ilvl });
  const tmp = it.temper ? G('tempered', { n: it.temper }) : null;
  const sub = both((i) => [kind[i], SLOT_NAMES[slot]?.[i] ?? slot, lv[i], tmp?.[i]].filter(Boolean).join(' · '));
  const rows: TipRow[] = [];
  if (art) {
    rows.push(...primRows(artPrimOf(it)));
    const fl = forgeLine(it.forge);
    if (fl) rows.push({ k: fl, v: same('⚒'), tone: 'up' });
  }
  rows.push(...statRows(e.mods));
  for (const [c, v] of Object.entries(e.cap)) if (v) rows.push({ k: CAP_STAT_NAMES[c as keyof typeof CAP_STAT_NAMES], v: same(`${v > 0 ? '+' : '−'}${Math.abs(v)}`), tone: v > 0 ? 'up' : 'down' });
  const notes: TipNote[] = [];
  if (leg) notes.push({ t: leg.text, tone: 'gift' });
  if (art) notes.push({ t: art.text, tone: 'gift' });
  if (it.set && SETS[it.set]) {
    const def = SETS[it.set];
    const have = worn.filter((w) => w.set === it.set).length;
    notes.push({ t: G('set', { name: '{name}', n: have, max: Object.keys(def.pieces).length }).map((s, i) => s.replace('{name}', def.name[i])) as Tr, tone: 'head' });
    for (const b of def.bonus) notes.push({ t: both((i) => `(${b.n}) ${b.text[i]}`), tone: have >= b.n ? 'on' : 'off' });
  }
  if (art?.set && ART_SETS[art.set]) {
    const def = ART_SETS[art.set];
    const have = def.pieces.filter((p) => worn.some((w) => w.art === p)).length;
    notes.push({ t: both((i) => `${def.name[i]} (${have}/${def.pieces.length})`), tone: 'head' });
    notes.push({ t: both((i) => `(${def.pieces.length}) ${def.text[i]}`), tone: have >= def.pieces.length ? 'on' : 'off' });
    notes.push({ t: both((i) => def.pieces.map((p) => ARTIFACTS[p]?.name[i] ?? p).join(' · ')), tone: 'muted' });
  }
  if (art?.part && RELICS[art.part]) {
    const def = RELICS[art.part];
    const have = def.parts.filter((p) => worn.some((w) => w.art === p)).length;
    notes.push({ t: both((i) => RL('relic.part', { name: def.name[i], n: have, m: def.parts.length })[i]), tone: 'head' });
    notes.push({ t: both((i) => `(${def.parts.length}) ${def.text[i]}`), tone: have >= def.parts.length ? 'on' : 'off' });
    notes.push({ t: both((i) => def.parts.map((p) => ARTIFACTS[p]?.name[i] ?? p).join(' · ')), tone: 'muted' });
  }
  if (!art) notes.push({ t: it.dur <= 0 ? G('broken') : G('wear', { n: Math.round(it.dur) }), tone: 'muted' });
  return { name: [itemName(it, false), itemName(it, true)], color: RARITY_COLOR[it.rarity] ?? RARITY_COLOR[0], sub, rows, notes };
}

// ------------------------------------------------------------------------------------------------ the ship's fittings

const GUN_WORDS = {
  dmg: ['Damage', 'Урон'], range: ['Range', 'Дальность'], reload: ['Reload', 'Перезарядка'], spread: ['Spread', 'Разброс'], crew: ['Crew a gun', 'Расчёт орудия'],
  gun: ['Broadside gun', 'Бортовое орудие'], mount: ['Deck mount', 'Палубная установка'], fh: ['Figurehead', 'Носовая фигура'], mod: ['Fitting', 'Модуль'],
  minRange: ['Least range', 'Мин. дальность'], lv: ['Level', 'Уровень'], bp: ['From a plan found at sea', 'По чертежу, найденному в море'],
} satisfies Record<string, Tr>;
const metres = (m: number): Tr => [`${m} m`, `${m} м`];
const seconds = (s: number): Tr => both((i) => `${n2(s, 1)[i]} ${i ? 'с' : 's'}`);

export function gunTip(id: string): Tip | undefined {
  const g = (GUNS as Record<string, (typeof GUNS)[keyof typeof GUNS]>)[id];
  if (!g) return undefined;
  return {
    name: ru(`ships.GUNS.${id}.name`, g.name), color: '#e8c872', sub: GUN_WORDS.gun,
    rows: [
      { k: GUN_WORDS.dmg, v: same(g.damage) }, { k: GUN_WORDS.range, v: metres(g.range) }, { k: GUN_WORDS.reload, v: seconds(g.reload) },
      { k: GUN_WORDS.spread, v: both((i) => `${n2(g.spreadDeg, 1)[i]}°`) }, { k: GUN_WORDS.crew, v: same(g.crewPerGun) },
    ],
    notes: [{ t: ru(`ships.GUNS.${id}.description`, g.description), tone: 'flavor' }],
  };
}

export function mountTip(id: string): Tip | undefined {
  const m = (MOUNTS as Record<string, (typeof MOUNTS)[keyof typeof MOUNTS]>)[id];
  if (!m) return undefined;
  const rows: TipRow[] = [];
  if (m.range) rows.push({ k: GUN_WORDS.range, v: metres(m.range) });
  if (m.minRange) rows.push({ k: GUN_WORDS.minRange, v: metres(m.minRange) });
  if (m.reload && m.reload < 999) rows.push({ k: GUN_WORDS.reload, v: seconds(m.reload) });
  return { name: ru(`ships.MOUNTS.${id}.name`, m.name), color: '#9fd3e6', sub: GUN_WORDS.mount, rows, notes: [{ t: ru(`ships.MOUNTS.${id}.description`, m.description), tone: 'flavor' }] };
}

export function figureheadTip(id: string): Tip | undefined {
  const f = (FIGUREHEADS as Record<string, (typeof FIGUREHEADS)[keyof typeof FIGUREHEADS]>)[id];
  if (!f) return undefined;
  return { name: ru(`shipbuild.FIGUREHEADS.${id}.name`, f.name), color: '#9fd3e6', sub: GUN_WORDS.fh, rows: statRows(f.mods), notes: [{ t: ru(`shipbuild.FIGUREHEADS.${id}.description`, f.description), tone: 'gift' }] };
}

const MOD_LINE: Record<string, [Tr, boolean]> = {
  hullMul: [['Hull', 'Корпус'], true], armorAdd: [['Armour', 'Броня'], true], speedMul: [['Speed', 'Ход'], true], sailHpMul: [['Sail strength', 'Прочность парусов'], true],
  turnMul: [['Turning', 'Поворот'], true], holdMul: [['Hold', 'Трюм'], true], crewMul: [['Crew', 'Команда'], true], boardingMul: [['Boarding', 'Абордаж'], true], signature: [['Signature', 'Заметность'], false],
};
export function moduleTip(id: string, lv: number): Tip | undefined {
  const m = (MODULES as Record<string, (typeof MODULES)[keyof typeof MODULES]>)[id];
  if (!m) return undefined;
  const L = Math.max(1, lv);
  const rows: TipRow[] = Object.entries(m.perLevel).filter(([, v]) => v).map(([k, v]) => {
    const x = (v ?? 0) * L, [name, upGood] = MOD_LINE[k] ?? [same(k), true];
    return { k: name, v: both((i) => `${x > 0 ? '+' : '−'}${n2(Math.abs(x) * 100, 1)[i]}%`), tone: (x > 0) === upGood ? 'up' as const : 'down' as const };
  });
  rows.push(...statRows(m.mods, L));
  const notes: TipNote[] = [{ t: ru(`ships.MODULES.${id}.description`, m.description), tone: 'flavor' }];
  if (m.blueprint) notes.push({ t: GUN_WORDS.bp, tone: 'muted' });
  return { name: ru(`ships.MODULES.${id}.name`, m.name), color: '#9fd3e6', sub: both((i) => `${GUN_WORDS.mod[i]} · ${GUN_WORDS.lv[i].toLowerCase()} ${L}/${m.maxLevel}`), rows, notes };
}

// ------------------------------------------------------------------------------------------------ the captain

const RANK_COLOR = ['#c9b98f', '#7fd07a', '#5aa9ff', '#c07cff', '#ff9a3c'];

/** A secondary skill: its rank and what each rank does, hers lit. */
export function skillTip(id: string, rank: number): Tip | undefined {
  const s = SKILLS[id as SkillId];
  if (!s) return undefined;
  const r = Math.max(1, Math.min(GM_RANK, rank));
  const notes: TipNote[] = [];
  for (let k = 1; k <= GM_RANK; k++) {
    if (k === GM_RANK && r < GM_RANK) break;
    const t = skillText(id as SkillId, k);
    notes.push({ t: both((i) => `${RANK_NAMES[k - 1][i]}: ${t[i]}`), tone: k === r ? 'on' : 'off' });
  }
  return { name: s.name, color: RANK_COLOR[r] ?? RANK_COLOR[0], sub: both((i) => `${RANK_NAMES[r - 1][i]} · ${i ? 'вторичный навык' : 'secondary skill'}`), notes };
}

/** An order of her book: school, level, sea or battle, will, wait and hold, what it does. */
export function orderTip(id: string): Tip | undefined {
  const o = ORDERS[id as OrderId];
  if (!o) return undefined;
  const rows: TipRow[] = [{ k: ['Will', 'Воля'], v: HL('cost', { n: o.cost }) }];
  if (o.cd) rows.push({ k: ['Cooldown', 'Перезарядка'], v: seconds(o.cd) });
  if (o.dur) rows.push({ k: ['Lasts', 'Длится'], v: seconds(o.dur) });
  const lv = HL('lv', { n: o.level }), use = HL(o.use);
  return { name: o.name, color: '#b9a2ff', sub: both((i) => `${SCHOOL_NAMES[o.school]?.[i] ?? o.school} · ${lv[i]} · ${use[i]}`), rows, notes: [{ t: o.text, tone: 'gift' }] };
}

/** A talent: its tree, rank, what it does and its numbers at her rank. */
export function talentTip(id: string, rank: number): Tip | undefined {
  const t = TALENTS_BY_ID[id];
  if (!t) return undefined;
  const i = TALENTS.indexOf(t);
  const tree = t.tree === 'bridge' ? t.bridge?.trees[0] : t.tree;
  const tn = tree ? ru(`talents.TREES.${tree}.name`, (TREES as Record<string, { name: string }>)[tree]?.name ?? tree) : same('');
  const r = Math.max(1, rank);
  const rows = [...statRows(t.perRank, r), ...statRows(t.fixed)];
  if (t.active) rows.push({ k: ['Cooldown', 'Перезарядка'], v: seconds(t.active.cooldown) });
  const kind: Tr = t.keystone ? ['Keystone', 'Ключевой'] : t.active ? ['Active', 'Активный'] : ['Talent', 'Талант'];
  return {
    name: ru(`talents.TALENTS.${i}.name`, t.name), color: t.keystone ? '#ff9a3c' : '#e8c872',
    sub: both((x) => `${kind[x]} · ${tn[x]} · ${x ? 'ранг' : 'rank'} ${r}/${t.maxRank}`), rows, notes: [{ t: ru(`talents.TALENTS.${i}.description`, t.description), tone: 'gift' }],
  };
}

/** A relic: its parts (how many she wears), the whole's gift. */
export function relicTip(id: string, worn: number, on: boolean): Tip | undefined {
  const d = (RELICS as Record<string, (typeof RELICS)[keyof typeof RELICS]>)[id];
  if (!d) return undefined;
  return {
    name: d.name, color: RARITY_COLOR[4], sub: both((i) => `${ART_CLASS_NAMES.relic[i]} · ${worn}/${d.parts.length}${on ? (i ? ' · собрана' : ' · made') : ''}`),
    rows: [...primRows(d.prim), ...statRows(d.mods)],
    notes: [{ t: d.text, tone: on || worn >= d.parts.length ? 'on' : 'gift' }, { t: both((i) => d.parts.map((p) => ARTIFACTS[p]?.name[i] ?? p).join(' · ')), tone: 'muted' }],
  };
}

/** An artifact set she wears whole: its pieces and bonus. */
export function setTip(id: string): Tip | undefined {
  const d = (ART_SETS as Record<string, (typeof ART_SETS)[keyof typeof ART_SETS]>)[id];
  if (!d) return undefined;
  return {
    name: d.name, color: RARITY_COLOR[3], sub: [`Artifact set · ${d.pieces.length}/${d.pieces.length}`, `Комплект артефактов · ${d.pieces.length}/${d.pieces.length}`],
    rows: [...primRows(d.prim), ...statRows(d.mods)],
    notes: [{ t: both((i) => `(${d.pieces.length}) ${d.text[i]}`), tone: 'on' }, { t: both((i) => d.pieces.map((p) => ARTIFACTS[p]?.name[i] ?? p).join(' · ')), tone: 'muted' }],
  };
}

// ------------------------------------------------------------------------------------------------ a creature (the shop's card)

const TIER_COLOR = ['#c9b98f', '#c9b98f', '#c9b98f', '#7fd07a', '#7fd07a', '#5aa9ff', '#5aa9ff', '#c07cff', '#ff9a3c'];
/** A creature of her army: tier, numbers, steel or shot, specials and what each does, the once-a-battle ability. */
export function unitTip(u: string, n: number, power: number, art: ArtOf): Tip | undefined {
  const d = UNITS[u as UnitId];
  if (!d) return undefined;
  const c = unitCard(u as UnitId, art);
  const rows: TipRow[] = c.stats.map((s) => ({ k: s.name, v: s.v }));
  rows.push({ k: ['Power', 'Сила'], v: same(Math.round(power)) });
  const notes: TipNote[] = [];
  for (const ch of c.chips) {
    const plain = ch.k === 'melee' || ch.k === 'ranged';
    notes.push({ t: ch.hint && ch.hint[0] ? (plain ? ch.hint : both((i) => `${ch.name[i]}: ${ch.hint![i]}`)) : ch.name, tone: plain ? 'muted' : 'gift' });
  }
  if (c.skill) {
    notes.push({ t: both((i) => `${c.skill!.name[i]}${c.skill!.tag ? ` (${c.skill!.tag[i]})` : ''}`), tone: 'head' });
    notes.push({ t: c.skill.text, tone: 'on' });
    if (c.skill.nums?.length) notes.push({ t: both((i) => c.skill!.nums!.map((x) => `${x.name[i]} ${x.v[i]}`).join(' · ')), tone: 'muted' });
  }
  const flav = AL(`ud.${u}`);
  if (!flav[0].startsWith('ud.')) notes.push({ t: flav, tone: 'flavor' });
  const tierW: Tr = ['Tier', 'Уровень'];
  return { name: both((i) => `${c.name[i]} ×${n}`), color: TIER_COLOR[Math.min(8, d.tier)], sub: both((i) => `${tierW[i]} ${d.tier}${d.up ? (i ? ' · улучшенный' : ' · upgraded') : ''}`), rows, notes };
}

// ------------------------------------------------------------------------------------------------ the island

const lvW = (l: number): Tr => [`level ${l}`, `уровень ${l}`];
export function townTip(id: string, level: number): Tip | undefined {
  const d = TOWN[id as TownId];
  if (!d) return undefined;
  const name = d.names[Math.max(0, Math.min(d.names.length - 1, level - 1))];
  return { name, color: '#e8c872', sub: both((i) => `${i ? 'Город' : 'Town'} · ${lvW(level)[i]}/${d.max}${d.tier ? ` · ${i ? 'жилище уровня' : 'dwelling, tier'} ${d.tier}` : ''}`), notes: [{ t: d.text, tone: 'gift' }] };
}
export function producerTip(id: string, level: number): Tip | undefined {
  const d = (PRODUCERS as Record<string, (typeof PRODUCERS)[keyof typeof PRODUCERS]>)[id];
  if (!d) return undefined;
  return { name: d.name, color: '#e8c872', sub: both((i) => `${i ? 'Промысел' : 'Producer'} · ${lvW(level)[i]}`), notes: [{ t: d.text, tone: 'gift' }] };
}
export function buildingTip(id: string, level: number): Tip | undefined {
  const d = BUILDINGS[id as BuildingId];
  if (!d) return undefined;
  return { name: ru(`holdings.BUILDINGS.${id}.name`, d.name), color: '#e8c872', sub: both((i) => `${i ? 'Постройка' : 'Building'} · ${lvW(level)[i]}`), notes: [{ t: ru(`holdings.BUILDINGS.${id}.description`, d.description), tone: 'gift' }] };
}

// ------------------------------------------------------------------------------------------------ her deeds

export function deedTip(id: string): Tip | undefined {
  const i = DEEDS.findIndex((d) => d.id === id);
  if (i < 0) return undefined;
  const d = DEEDS[i];
  return { name: ru(`deeds.DEEDS.${i}.name`, d.name), color: '#e8c872', sub: ['Deed', 'Подвиг'], notes: [{ t: ru(`deeds.DEEDS.${i}.condition`, d.condition), tone: 'gift' }] };
}
export function featTip(id: string): Tip | undefined {
  const f = FEATS.find((x) => x.id === id);
  return f ? { name: f.title, color: '#ff9a3c', sub: ['Feat of renown', 'Свершение'], notes: [{ t: f.text, tone: 'gift' }] } : undefined;
}
export function tattooTip(id: string, on: boolean): Tip | undefined {
  const t = TATTOO_BY_ID[id];
  if (!t) return undefined;
  return { name: t.name, color: '#c07cff', sub: on ? ['Tattoo · worn', 'Татуировка · набита'] : ['Tattoo', 'Татуировка'], notes: [{ t: t.gives, tone: 'gift' }, { t: t.how, tone: 'muted' }] };
}
export function petTip(id: string, deck: boolean): Tip | undefined {
  const p = PETS[id as PetId];
  return p ? { name: p.name, color: '#7fd07a', sub: deck ? ['Pet · on deck', 'Питомец · на палубе'] : ['Pet', 'Питомец'], notes: [{ t: p.gives, tone: 'gift' }] } : undefined;
}
