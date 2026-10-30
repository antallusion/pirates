// A captain's public profile on the website (owner, 2026-10-28: «на сайте … нажимая на капитана я хочу видеть его армию,
// корабль и все что вообще только есть, кроме количества валюты»). GET /api/site/captain/<name> (site-routes.ts) answers
// it for a captain the rating shows (siterating.ts: never a hidden one — bots, testers, the banned, the owner's list).
//
// Read from her save (her live state when she is aboard), built field by field from an ALLOW-LIST: nothing of the save
// is passed on whole. Every name goes in both tongues ([en, ru]) with its picture's address, so the page only lays it
// out. LEFT OUT on purpose: every coin and its worth (silver, doubloons, the bank, loans, cargo and its value, the
// warehouses, trade profit, price intelligence, the treasury), anything private (e-mail, tokens, the account's id,
// OAuth, her position — only the sea's name —, friends, the ignored, letters, hearsay, maps).

import { monthOf } from '../../../shared/src/data/pvprank.ts';
import { monthTally } from './pvprank.ts';
import { MAX_LEVEL, xpForLevel } from '../../../shared/src/constants.ts';
import { UNITS, armyPower, armySlots } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import { BOSS_UNIT_NAMES, isBossUnit } from '../../../shared/src/data/bossunits.ts';
import { TITAN_NAMES, isTitan } from '../../../shared/src/data/titans.ts';
import { FACTION_NAMES } from '../../../shared/src/data/factionunits.ts';
import { PREMIUM_NAMES, isPremiumBeast } from '../../../shared/src/data/premiumbeasts.ts';
import { SHIP_BEAST_NAMES, isShipBeast } from '../../../shared/src/data/shipbeasts.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { ORDERS, PRIMS, PRIM_ICON, PRIM_NAMES, RANK_NAMES, SCHOOL_NAMES, SKILLS } from '../../../shared/src/data/hero.ts';
import type { OrderId, PrimId } from '../../../shared/src/data/hero.ts';
import { ARTIFACTS, ART_SETS, RELICS, relicIcon } from '../../../shared/src/data/artifacts.ts';
import type { RelicId } from '../../../shared/src/data/artifacts.ts';
import { CAPTAIN_SLOTS, RARITY_COLOR, RARITY_NAMES, SHIP_SLOTS, SLOT_NAMES, itemName, itemSlot } from '../../../shared/src/data/items.ts';
import type { Item, Slot } from '../../../shared/src/data/items.ts';
import { TALENTS_BY_ID, TALENTS, TREES } from '../../../shared/src/data/talents.ts';
import { GUNS, MODULES, MOUNTS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { GunId, ModuleId, ShipClassId } from '../../../shared/src/data/ships.ts';
import { FIGUREHEADS } from '../../../shared/src/data/shipbuild.ts';
import { shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { computeShipStats } from '../../../shared/src/sim/shipstats.ts';
import { DEEDS } from '../../../shared/src/data/deeds.ts';
import { FEATS, CAREERS, TROPHY_RU } from '../../../shared/src/data/renown.ts';
import type { CareerId } from '../../../shared/src/data/renown.ts';
import { QUEST_TITLES } from '../../../shared/src/data/questtitles.ts';
import { BOSSES } from '../../../shared/src/data/bosses.ts';
import { SHORE_BOSSES } from '../../../shared/src/data/shorebosses.ts';
import { WONDER_KINDS } from '../../../shared/src/data/wonders.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { FACTIONS, FACTION_IDS, WANTED_TITLES, wantedLevel } from '../../../shared/src/data/factions.ts';
import { TATTOO_BY_ID } from '../../../shared/src/data/sidequests.ts';
import { CALF_NAME, HARNESSES, PETS } from '../../../shared/src/data/companions.ts';
import type { PetId } from '../../../shared/src/data/companions.ts';
import { BEASTS } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { CAMPAIGN_SIZE } from '../../../shared/src/data/campaign/plan.ts';
import { chapterOfSlot } from '../../../shared/src/data/campaign/progress.ts';
import { CHAPTERS } from '../../../shared/src/data/campaign/chapters.ts';
import { chapterCard } from '../../../shared/src/data/paintart.ts';
import { SAGA_ICON, SAGA_TELL } from '../../../shared/src/data/saga.ts';
import type { SagaEntry } from '../../../shared/src/data/saga.ts';
import { HOLIDAYS } from '../../../shared/src/data/holidays.ts';
import { TOWN } from '../../../shared/src/data/town.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import { PRODUCERS } from '../../../shared/src/data/base.ts';
import { BUILDINGS } from '../../../shared/src/data/holdings.ts';
import type { BuildingId } from '../../../shared/src/data/holdings.ts';
import { OWN_NAMES } from '../../../shared/src/data/baseships.ts';
import { DATA_RU, NAME_RU } from '../../../client/src/lang/data.ts';
import { composedNameRu, personNameRu } from '../../../client/src/lang/names.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../../../client/src/lang/ui/army.ts';
import { EN as HUD_EN, RU as HUD_RU } from '../../../client/src/lang/ui/hud.ts';
import * as M_bosses from '../../../shared/src/data/bosses.ts';
import * as M_captains from '../../../shared/src/data/captains.ts';
import * as M_deeds from '../../../shared/src/data/deeds.ts';
import * as M_factions from '../../../shared/src/data/factions.ts';
import * as M_holdings from '../../../shared/src/data/holdings.ts';
import * as M_legendary from '../../../shared/src/data/legendary.ts';
import * as M_seasons from '../../../shared/src/data/seasons.ts';
import * as M_shipbuild from '../../../shared/src/data/shipbuild.ts';
import * as M_ships from '../../../shared/src/data/ships.ts';
import * as M_talents from '../../../shared/src/data/talents.ts';
import * as M_regions from '../../../shared/src/world/regions.ts';
import * as M_newports from '../../../shared/src/world/newports.ts';
import * as M_renown from '../../../shared/src/data/renown.ts';
import * as M_marque from '../../../shared/src/data/marque.ts';
import * as M_regatta from '../../../shared/src/data/regatta.ts';
import * as M_arena from '../../../shared/src/data/arena.ts';
import * as M_throne from '../../../shared/src/data/throne.ts';
import * as M_holidays from '../../../shared/src/data/holidays.ts';
import * as M_citadels from '../../../shared/src/data/citadels.ts';
import * as M_pirates from '../../../shared/src/data/pirates.ts';
import * as M_dutchman from '../../../shared/src/data/dutchman.ts';
import { arenaTable } from './arena.ts';
import { heroView } from './hero.ts';
import { ownIsland } from './estate.ts';
import { island as islandOf } from './holdings.ts';
import { wondersOf, wonderName } from './wonders.ts';
import { sanitizeProfile } from './player.ts';
import type { Profile } from './player.ts';
import { manifestArt } from './webshop.ts';
import type { Game } from './Game.ts';
import type { Board, SiteRating } from './siterating.ts';
import type { PowerScore } from '../../../shared/src/data/power.ts';
import { buildingTip, deedTip, featTip, figureheadTip, gunTip, itemTip, moduleTip, mountTip, orderTip, petTip, producerTip, relicTip, setTip, skillTip, talentTip, tattooTip, townTip, unitTip } from '../../../shared/src/data/sitetips.ts';
import type { Tip } from '../../../shared/src/data/sitetips.ts';

type Tr = [string, string];
type Img = string | null;

export const PROFILE_TTL = 30_000;

// ------------------------------------------------------------------------------------------------ the shape on the wire

/** `tip`: its hover card, the game's own words (shared/src/data/sitetips.ts). */
export interface PName { id: string; name: Tr; icon: Img; tip?: Tip }
export interface PUnit { u: string; n: number; name: Tr; tier: number; up: boolean; rank: '' | 'rare' | 'legend' | 'myth'; art: Img; power: number; atk: number; def: number; hp: number; dmin: number; dmax: number; tip?: Tip }
export interface PItem { slot: string; slotName: Tr; name: Tr; icon: Img; rarity: number; rarityName: Tr; color: string; ilvl: number; art: boolean; set?: Tr; tip?: Tip }
export interface PShip { cls: string; clsName: Tr; art: Img; name: string; level: number; tier: number; hullMax: number; hull: number | null; sails: number; speed: number; gunsPerSide: number; crewMax: number; armor: number;
  guns: PName[]; modules: (PName & { lv: number })[]; mount: PName | null; figurehead: PName | null; legendary: boolean; keel: boolean; gear: PItem[] }
export interface PSaga { at: number; icon: Img; text: Tr }

export interface CaptainProfile {
  name: string;
  captain: string;
  capName: Tr;
  archetype: Tr;
  portrait: Img;
  /** Her whole figure (the captains' page's). */
  figure: Img;
  frame: string | null;
  cosTitle: string | null;
  plate: string | null;
  title: Tr | null;
  titles: Tr[];
  pennant: string | null;
  level: number;
  maxLevel: number;
  xp: number;
  xpNext: number;
  glory: number;
  guild: { tag: string; name: string } | null;
  online: boolean;
  sea: Tr | null;
  seen: number | null;
  created: number | null;
  ranks: Partial<Record<Board, number | null>>;
  /** «Мощь» (owner, 2026-10-31; shared/src/data/power.ts): her four parts and the total, as the rating's power board has them. */
  power: PowerScore;
  pvp: {
    rating: number; duels: number; wins: number; arena: number | null; arenaWins: number; arenaN: number; wanted: number; wantedName: Tr; infamy: number;
    /** The PvP points (pvprank.ts): this month's (its rank on the «pvp» board), all time, the best streak. */
    season: { pts: number; kills: number; deaths: number; duels: number; rank: number | null };
    all: { pts: number; kills: number; deaths: number; duels: number; best: number };
  };
  rep: (PName & { v: number })[];
  careers: { id: string; name: Tr; rank: number; rankName: Tr | null }[];
  army: { power: number; men: number; slots: number; stacks: PUnit[] };
  ship: PShip | null;
  escorts: { cls: string; clsName: Tr; art: Img; name: string; level: number }[];
  berths: { cls: string; clsName: Tr; art: Img; name: string; level: number }[];
  hero: {
    prim: { id: PrimId; name: Tr; icon: Img; base: number; art: number }[];
    skills: { id: string; name: Tr; icon: Img; rank: number; rankName: Tr; tip?: Tip }[];
    orders: { id: string; name: Tr; icon: Img; school: Tr; level: number; tip?: Tip }[];
    will: number;
    willMax: number;
    talents: { id: string; name: Tr; icon: Img; rank: number; max: number; tree: Tr; tip?: Tip }[];
    gear: PItem[];
    sets: { id: string; name: Tr; tip?: Tip }[];
    relics: { id: string; name: Tr; icon: Img; on: boolean; worn: number; of: number; tip?: Tip }[];
  };
  island: { name: Tr; sea: Tr | null; level: number; town: { id: string; name: Tr; icon: Img; level: number; tip?: Tip }[]; producers: { id: string; name: Tr; icon: Img; level: number; tip?: Tip }[];
    buildings: { id: string; name: Tr; icon: Img; level: number; tip?: Tip }[]; ships: { cls: string; clsName: Tr; art: Img; name: Tr; level: number }[] } | null;
  feats: { deeds: PName[]; feats: PName[]; trophies: PName[]; bosses: (PName & { n: number })[]; wonders: PName[]; regions: Tr[]; tattoos: (PName & { on: boolean })[];
    pets: (PName & { deck: boolean })[]; companion: { name: Tr; level: number; harness: Tr | null; icon: Img } | null; beasts: (PName & { n: number })[];
    campaign: { ch: number; title: Tr; done: boolean; card: Img; at: number; of: number } | null; saga: PSaga[]; sagaN: number };
  stats: Record<string, number>;
}

// ------------------------------------------------------------------------------------------------ names in both tongues

/** Every English name the data overlay knows → its Russian (client/src/lang/data.ts DATA_RU, read against the shared
 *  tables without touching them), and every [en, ru] pair the title tables hold. Made once. */
let RU: Map<string, string> | null = null;
function ruMap(): Map<string, string> {
  if (RU) return RU;
  RU = new Map();
  const mods: Record<string, unknown> = { bosses: M_bosses, captains: M_captains, deeds: M_deeds, factions: M_factions, holdings: M_holdings, legendary: M_legendary, seasons: M_seasons, shipbuild: M_shipbuild, ships: M_ships, talents: M_talents, regions: M_regions, newports: M_newports };
  for (const [path, ru] of Object.entries(DATA_RU)) {
    if (!path.endsWith('.name') && !path.endsWith('.title')) continue;
    let o: unknown = mods;
    for (const k of path.split('.')) o = o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined;
    if (typeof o === 'string' && !RU.has(o)) RU.set(o, ru);
  }
  // (composedNameRu reads a key port's Russian name from the overlay's map: filled here, the tables left as they are)
  for (const [en, ru] of RU) if (!NAME_RU.has(en)) NAME_RU.set(en, ru);
  const cyr = /[а-яё]/i;
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): void => {
    if (!v || typeof v !== 'object' || depth > 6 || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string' && cyr.test(v[1]) && !cyr.test(v[0])) {
      if (!RU!.has(v[0])) RU!.set(v[0], v[1]);
      return;
    }
    for (const x of Object.values(v)) walk(x, depth + 1);
  };
  for (const m of [M_renown, M_marque, M_regatta, M_arena, M_throne, M_holidays, M_citadels, M_pirates, M_dutchman, M_seasons, { QUEST_TITLES, CHAPTERS }]) walk({ ...m }, 0);
  for (const [en, ru] of Object.entries(TROPHY_RU)) RU.set(en, ru);
  return RU;
}
/** A name the server keeps in English (a title, a trophy, a place, a person) in both tongues. */
const both = (en: string): Tr => [en, ruMap().get(en) ?? composedNameRu(en) ?? personNameRu(en) ?? en];
const dataRu = (key: string, en: string): string => DATA_RU[key] ?? en;

const art = (id: string | null | undefined): Img => (id ? manifestArt(id) : null);
const ico = (...ids: (string | null | undefined)[]): Img => {
  for (const id of ids) {
    if (!id) continue;
    const a = art(id.includes('.') ? id : `icon.${id}`);
    if (a) return a;
  }
  return null;
};

/** A hover card, or nothing (a card that cannot be read never breaks the profile). */
const tipOf = (f: () => Tip | undefined): { tip?: Tip } => {
  try {
    const t = f();
    return t ? { tip: t } : {};
  } catch {
    return {};
  }
};

const num = (v: unknown, lo = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.floor(v)) : lo);

// ------------------------------------------------------------------------------------------------ the parts

export function unitName(u: string): Tr {
  const bt = (BOSS_UNIT_NAMES as Record<string, { name: Tr }>)[u] ?? (TITAN_NAMES as Record<string, { name: Tr }>)[u];
  if (bt) return bt.name;
  const four = (FACTION_NAMES as Record<string, string[]>)[u] ?? (PREMIUM_NAMES as Record<string, string[]>)[u] ?? (SHIP_BEAST_NAMES as Record<string, string[]>)[u];
  if (four) return [four[0], four[1]];
  const en = (ARMY_EN as Record<string, string>)[`u.${u}`] ?? u;
  return [en, (ARMY_RU as Record<string, string>)[`u.${u}`] ?? en];
}

function unitRank(u: string): PUnit['rank'] {
  const d = UNITS[u as UnitId];
  if (isBossUnit(u) || isTitan(u)) return 'myth';
  if ((d as { legend?: unknown })?.legend) return 'legend';
  if ((d as { premium?: unknown })?.premium || isPremiumBeast(u) || isShipBeast(u)) return 'rare';
  return '';
}

function stack(s: ArmyStack): PUnit | null {
  const d = UNITS[s.u];
  if (!d || !(s.n > 0)) return null;
  return {
    u: s.u, n: Math.floor(s.n), name: unitName(s.u), tier: d.tier, up: !!d.up, rank: unitRank(s.u), art: art(`unit.${s.u}`) ?? art(d.art),
    power: Math.round(armyPower([s])), atk: d.atk, def: d.def, hp: d.hp, dmin: d.dmin, dmax: d.dmax,
    ...tipOf(() => unitTip(s.u, Math.floor(s.n), armyPower([s]), art)),
  };
}

const shipClassName = (c: string): Tr => {
  const d = (SHIP_CLASSES as Record<string, { name: string }>)[c];
  return d ? [d.name, dataRu(`ships.SHIP_CLASSES.${c}.name`, d.name)] : [c, c];
};
const shipArt = (c: string): Img => art((SHIP_CLASSES as Record<string, { sprite?: string }>)[c]?.sprite);

const SLOT_ICON: Record<Slot, string> = {
  sails: 'mod_sail_plan', rigging: 'sail_up', plating: 'mod_hull_plating', rudder: 'mod_rudder', hold: 'mod_hold_expansion', quarters: 'mod_crew_quarters',
  battery: 'gun_long_9', banner: 'tab_legends', relic: 'mod_choir_bell', tackle: 'build_fishing_village',
  hat: 'menu_cabin', coat: 'role_lieutenant', sash: 'prof_marine', boots: 'role_pilot', blade: 'tree_boarding', pistols: 'bt_volley',
  spyglass: 'ab_spotters_eye', compass: 'ab_star_fix', charm: 'role_deep_pastor', ring: 'coin',
};

function item(it: Item, slotHint?: Slot, worn: readonly Item[] = []): PItem | null {
  try {
    const slot = slotHint ?? itemSlot(it);
    const a = it.art ? ARTIFACTS[it.art] : undefined;
    const r = Math.max(0, Math.min(4, num(it.rarity)));
    const set = it.art && a && (a as { set?: string }).set ? (ART_SETS as Record<string, { name: Tr }>)[(a as { set: string }).set]?.name : undefined;
    return {
      slot, slotName: SLOT_NAMES[slot], name: [itemName(it, false), itemName(it, true)],
      icon: a ? ico(a.icon, SLOT_ICON[slot]) : ico(it.legendary ? `item_${it.legendary}` : null, `item_${it.base}`, SLOT_ICON[slot]),
      rarity: r, rarityName: RARITY_NAMES[r], color: RARITY_COLOR[r], ilvl: num(it.ilvl), art: !!a, ...(set ? { set } : {}), ...tipOf(() => itemTip(it, worn, slot)),
    };
  } catch {
    return null;
  }
}

const gunName = (g: string): PName => {
  const d = (GUNS as Record<string, { name: string }>)[g];
  return { id: g, name: d ? [d.name, dataRu(`ships.GUNS.${g}.name`, d.name)] : [g, g], icon: ico(`gun_${g}`), ...tipOf(() => gunTip(g)) };
};

function shipOf(game: Game, p: Profile, live: { hull: number; hullMax: number; sails: number; stats: ReturnType<typeof computeShipStats> } | null): PShip | null {
  const lo = p.loadout;
  const cls = (SHIP_CLASSES as Record<string, { tier: number }>)[lo?.classId];
  if (!lo || !cls) return null;
  let st = live?.stats ?? null;
  if (!st) {
    try {
      st = computeShipStats(lo, p.captain, p.talents ?? {}, [], Object.values(p.captainGear ?? {}).filter((x): x is Item => !!x));
    } catch {
      st = null;
    }
  }
  void game;
  const guns = [...new Set([lo.guns?.port, lo.guns?.starboard].filter((g): g is GunId => !!g))].map(gunName);
  const modules = Object.entries(lo.modules ?? {}).filter(([, v]) => (v ?? 0) > 0).map(([id, lv]) => {
    const d = (MODULES as Record<string, { name: string }>)[id];
    return { id, name: (d ? [d.name, dataRu(`ships.MODULES.${id}.name`, d.name)] : [id, id]) as Tr, icon: ico(`mod_${id}`), lv: num(lv), ...tipOf(() => moduleTip(id, num(lv))) };
  }).filter((m) => (MODULES as Record<string, unknown>)[m.id as ModuleId]);
  const mt = lo.mount ? (MOUNTS as Record<string, { name: string }>)[lo.mount] : undefined;
  const fh = lo.build?.figurehead ? (FIGUREHEADS as Record<string, { name: string }>)[lo.build.figurehead] : undefined;
  const worn = [...SHIP_SLOTS.map((sl) => lo.gear?.[sl]), ...Object.values(p.captainGear ?? {})].filter((x): x is Item => !!x);
  const gear = SHIP_SLOTS.map((sl) => (lo.gear?.[sl] ? item(lo.gear[sl]!, sl, worn) : null)).filter((x): x is PItem => !!x);
  return {
    cls: lo.classId, clsName: shipClassName(lo.classId), art: shipArt(lo.classId), name: String(lo.name || p.shipName || ''), level: shipLevelOf(lo), tier: cls.tier,
    hullMax: Math.round(live?.hullMax ?? st?.hullMax ?? 0), hull: live ? Math.round(live.hull) : null, sails: Math.round(st?.sailHpMax ?? 0), speed: Math.round((st?.maxSpeed ?? 0) * 10) / 10,
    gunsPerSide: num(st?.gunsPerSide), crewMax: num(st?.crewMax), armor: Math.round(st?.armor ?? 0),
    guns, modules, mount: mt && lo.mount ? { id: lo.mount, name: [mt.name, dataRu(`ships.MOUNTS.${lo.mount}.name`, mt.name)], icon: ico(`mount_${lo.mount}`), ...tipOf(() => mountTip(lo.mount!)) } : null,
    figurehead: fh && lo.build?.figurehead ? { id: lo.build.figurehead, name: [fh.name, dataRu(`shipbuild.FIGUREHEADS.${lo.build.figurehead}.name`, fh.name)], icon: ico(lo.build.figurehead), ...tipOf(() => figureheadTip(lo.build!.figurehead!)) } : null,
    legendary: !!lo.legendary, keel: !!lo.keel, gear,
  };
}

function heroOf(p: Profile): CaptainProfile['hero'] {
  const empty: CaptainProfile['hero'] = { prim: [], skills: [], orders: [], will: 0, willMax: 0, talents: [], gear: [], sets: [], relics: [] };
  const out = { ...empty };
  try {
    const h = heroView(p);
    out.prim = PRIMS.map((id) => ({ id, name: PRIM_NAMES[id], icon: ico(PRIM_ICON[id]), base: num(h.prim[id]), art: num((h.artPrim as Partial<Record<PrimId, number>> | undefined)?.[id]) }));
    out.skills = h.skills.filter((s) => SKILLS[s.id]).map((s) => ({ id: s.id, name: SKILLS[s.id].name, icon: ico(SKILLS[s.id].icon), rank: num(s.r), rankName: RANK_NAMES[Math.max(0, Math.min(RANK_NAMES.length - 1, num(s.r) - 1))], ...tipOf(() => skillTip(s.id, num(s.r))) }));
    out.orders = h.orders.filter((o) => ORDERS[o as OrderId]).map((o) => {
      const d = ORDERS[o as OrderId];
      return { id: o, name: d.name, icon: ico(d.icon), school: SCHOOL_NAMES[d.school] ?? ['', ''], level: num(d.level), ...tipOf(() => orderTip(o)) };
    }).sort((a, b) => a.level - b.level);
    out.will = num(h.will);
    out.willMax = num(h.willMax);
    out.sets = (h.sets ?? []).filter((id) => (ART_SETS as Record<string, unknown>)[id]).map((id) => ({ id, name: (ART_SETS as Record<string, { name: Tr }>)[id].name, ...tipOf(() => setTip(id)) }));
    out.relics = (h.relics ?? []).filter((r) => r.worn.length > 0 || (p.relics?.made ?? []).includes(r.id)).map((r) => ({ id: r.id, name: RELICS[r.id as RelicId].name, icon: ico(relicIcon(r.id as RelicId)), on: (p.relics?.on ?? []).includes(r.id as RelicId), worn: r.worn.length, of: RELICS[r.id as RelicId].parts.length, ...tipOf(() => relicTip(r.id, r.worn.length, (p.relics?.on ?? []).includes(r.id as RelicId))) }));
  } catch {
    /* an old save the hero's window cannot read: her stats left out */
  }
  out.talents = Object.entries(p.talents ?? {}).filter(([id, r]) => TALENTS_BY_ID[id] && (r ?? 0) > 0).map(([id, r]) => {
    const t = TALENTS_BY_ID[id];
    const i = TALENTS.indexOf(t);
    const tree = t.tree === 'bridge' ? t.bridge?.trees[0] : t.tree;
    const tn = tree ? (TREES as Record<string, { name: string }>)[tree]?.name ?? tree : '';
    return {
      id, name: [t.name, dataRu(`talents.TALENTS.${i}.name`, t.name)] as Tr, icon: ico(`talent_${id}`, tree ? `tree_${tree}` : null), rank: num(r), max: t.maxRank,
      tree: [tn, tree ? dataRu(`talents.TREES.${tree}.name`, tn) : tn] as Tr, ...tipOf(() => talentTip(id, num(r))),
    };
  });
  const worn = [...CAPTAIN_SLOTS.map((sl) => p.captainGear?.[sl]), ...SHIP_SLOTS.map((sl) => p.loadout?.gear?.[sl])].filter((x): x is Item => !!x);
  out.gear = CAPTAIN_SLOTS.map((sl) => (p.captainGear?.[sl] ? item(p.captainGear[sl]!, sl, worn) : null)).filter((x): x is PItem => !!x);
  return out;
}

function islandView(game: Game, acc: number): CaptainProfile['island'] {
  try {
    const h = ownIsland(game, acc);
    if (!h) return null;
    const isl = islandOf(game, h.island);
    const y = h.yard;
    const town = Object.entries(y?.town?.b ?? {}).filter(([id, lv]) => TOWN[id as TownId] && (lv ?? 0) > 0).map(([id, lv]) => {
      const d = TOWN[id as TownId];
      const n = num(lv);
      return { id, name: d.names[Math.max(0, Math.min(d.names.length - 1, n - 1))], icon: ico(`build_${d.art}`), level: n, ...tipOf(() => townTip(id, n)) };
    });
    const producers = (y?.producers ?? []).filter((x) => PRODUCERS[x.kind]).map((x) => ({ id: x.kind as string, name: PRODUCERS[x.kind].name, icon: ico(PRODUCERS[x.kind].art), level: num(x.level, 1), ...tipOf(() => producerTip(x.kind, num(x.level, 1))) }));
    const buildings = (h.buildings ?? []).filter((b) => BUILDINGS[b.id as BuildingId]).map((b) => {
      const d = BUILDINGS[b.id as BuildingId];
      return { id: b.id as string, name: [d.name, dataRu(`holdings.BUILDINGS.${b.id}.name`, d.name)] as Tr, icon: ico(`build_${b.id}`), level: num(b.level, 1), ...tipOf(() => buildingTip(b.id, num(b.level, 1))) };
    });
    const ships = (y?.ships ?? []).filter((s) => s.state !== 'building' && (SHIP_CLASSES as Record<string, unknown>)[s.classId]).map((s) => ({
      cls: s.classId as string, clsName: shipClassName(s.classId), art: shipArt(s.classId), name: OWN_NAMES[s.name] ?? ['', ''] as Tr, level: num(s.level, 1),
    }));
    const region = isl ? (REGIONS as Record<string, { name: string }>)[isl.region] : undefined;
    return {
      name: isl ? both(isl.name) : ['', ''], sea: region && isl ? [region.name, dataRu(`regions.REGIONS.${isl.region}.name`, region.name)] : null,
      level: num(h.level, 1), town, producers, buildings, ships,
    };
  } catch {
    return null;
  }
}

const regionName = (id: string): Tr | null => {
  const r = (REGIONS as Record<string, { name: string }>)[id];
  return r ? [r.name, dataRu(`regions.REGIONS.${id}.name`, r.name)] : null;
};

const BEAST_ICON: Record<string, string> = { orca: 'good_orca_tooth', white_orca: 'item_white_orca_tooth', humpback: 'good_baleen', sperm_whale: 'good_ambergris', narwhal: 'good_narwhal_tusk', shark: 'good_shark_skin', young_serpent: 'good_serpent_scale' };
const TROPHY_ICON: Record<string, string> = {
  'Leviathan Skull': 'deed_leviathan_slain', 'Kraken Eye': 'tattoo_kraken', 'Bell of the Whale': 'tattoo_bell', 'Lure of the Maw': 'boon_lantern', 'Serpent Fang': 'mod_serpent_scale',
  "Drey's Lantern": 'tattoo_lantern', 'Crown of Wrecks': 'map_wreck', 'Veil of the Widow': 'fh_weeping_widow', 'Skull of an Ancient': 'tattoo_skull', 'A Shard of the Eye': 'tattoo_eye',
};
const TATTOO_STAND_IN: Record<string, string> = { rose: 'tattoo_rose' };
const PET_STAND_IN: Record<string, string> = { cat: 'fh_fog_owl', parrot: 'fh_red_devil', monkey: 'coin', dog: 'map_cove' };

const ordinal = (n: number) => { const t = n % 100, u = n % 10; return `${n}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`; };
/** A chapter of her saga told in both tongues (client/src/ui/saga.ts tellSaga, the same words). */
function tell(e: SagaEntry, captain: string): Tr | null {
  const t = SAGA_TELL[e.kind];
  if (!t) return null;
  const hol = e.holiday ? (HOLIDAYS as Record<string, { name: Tr }>)[e.holiday]?.name : undefined;
  const day: Tr = hol ? [`On the ${ordinal(e.day)} day of ${hol[0]}`, `В ${e.day}-й день праздника «${hol[1]}»`] : [`On the ${ordinal(e.day)} day at sea`, `На ${e.day}-й день в море`];
  const f = (i: 0 | 1) => t[i].replace('{d}', day[i]).replace('{c}', captain).replace('{n}', String(e.n ?? '')).replace(/\{(\d)\}/g, (_, k: string) => both(String(e.a?.[Number(k)] ?? ''))[i]);
  return [f(0), f(1)];
}

function featsOf(game: Game, p: Profile, name: string): CaptainProfile['feats'] {
  const deeds = (p.deeds ?? []).map((id) => DEEDS.find((d) => d.id === id)).filter((d): d is (typeof DEEDS)[number] => !!d)
    .map((d) => ({ id: d.id, name: [d.name, dataRu(`deeds.DEEDS.${DEEDS.indexOf(d)}.name`, d.name)] as Tr, icon: ico(d.id), ...tipOf(() => deedTip(d.id)) }));
  const feats = (p.renown?.feats ?? []).map((id) => FEATS.find((f) => f.id === id)).filter((f): f is (typeof FEATS)[number] => !!f).map((f) => ({ id: f.id, name: f.title, icon: ico(f.icon), ...tipOf(() => featTip(f.id)) }));
  const trophies = [...new Set(p.trophies ?? [])].map((t) => ({ id: t, name: both(t), icon: ico(TROPHY_ICON[t], 'map_monster') }));
  const bosses = Object.entries(p.bossKills ?? {}).filter(([, n]) => (n ?? 0) > 0).map(([id, n]) => {
    const shore = id.startsWith('shore:') ? (SHORE_BOSSES as Record<string, { name: Tr | string; unit?: string }>)[id.slice(6)] : undefined;
    const b = !shore ? (BOSSES as Record<string, { name: string; classId?: string }>)[id] : undefined;
    if (!shore && !b) return null;
    const nm: Tr = shore ? (Array.isArray(shore.name) ? shore.name as Tr : both(String(shore.name))) : [b!.name, dataRu(`bosses.BOSSES.${id}.name`, b!.name)];
    return { id, name: nm, icon: shore ? (shore.unit ? art(`unit.${shore.unit}`) : null) ?? ico('map_monster') : shipArt(b!.classId ?? '') ?? ico('map_monster'), n: num(n) };
  }).filter((x): x is PName & { n: number } => !!x);
  let wonders: PName[] = [];
  try {
    const all = new Map(wondersOf(game).map((w) => [w.id, w]));
    wonders = [...new Set(p.wonders ?? [])].map((id) => all.get(id)).filter((w): w is NonNullable<typeof w> => !!w).map((w) => {
      const n = wonderName(game, w);
      // (the island in a wonder's Russian name is the generator's English: given its Russian too)
      const ru = w.name[1].replace(/[A-Z][A-Za-z'’-]*(?: [A-Z][A-Za-z'’-]*)*(?: \d+)?$/, (x) => composedNameRu(x) ?? x);
      return { id: w.id, name: n === w.name[0] ? [w.name[0], ru] as Tr : both(n), icon: ico(`wonder_${w.kind}`, 'map_port') };
    });
  } catch {
    /* the sea's wonders not laid in this world */
  }
  void WONDER_KINDS;
  const regions = [...new Set((p.regionsSeen ?? []).filter((r) => !r.includes(':')))].map(regionName).filter((x): x is Tr => !!x);
  const t = p.tattoos;
  const tattoos = [...new Set(t?.owned ?? [])].filter((id) => TATTOO_BY_ID[id]).map((id) => ({ id, name: TATTOO_BY_ID[id].name, icon: ico(`tattoo_${id}`, TATTOO_STAND_IN[id]), on: (t?.active ?? []).includes(id), ...tipOf(() => tattooTip(id, (t?.active ?? []).includes(id))) }));
  const pets = (p.pets?.owned ?? []).filter((id) => PETS[id as PetId]).map((id) => ({ id, name: PETS[id as PetId].name, icon: ico(`pet_${id}`, PET_STAND_IN[id]), deck: p.pets?.deck === id, ...tipOf(() => petTip(id, p.pets?.deck === id)) }));
  const c = p.companion;
  const companion = c ? { name: (c.name ? [c.name, c.name] : CALF_NAME) as Tr, level: num(c.level, 1), harness: c.harness ? (HARNESSES as Record<string, { name: Tr }>)[c.harness]?.name ?? null : null, icon: ico(c.harness ? `harness_${c.harness}` : null, 'tab_legends') } : null;
  const beasts = Object.entries(p.beasts ?? {}).filter(([id, n]) => BEASTS[id as BeastId] && (n ?? 0) > 0).map(([id, n]) => ({ id, name: BEASTS[id as BeastId].name as Tr, icon: ico(BEAST_ICON[id]), n: num(n) }));
  let campaign: CaptainProfile['feats']['campaign'] = null;
  const at = Math.min(CAMPAIGN_SIZE, num(p.campaign?.at));
  if (at > 0) {
    const ch = chapterOfSlot(at >= CAMPAIGN_SIZE ? CAMPAIGN_SIZE - 1 : at).ch;
    const src = CHAPTERS.find((x) => x.n === ch);
    campaign = { ch, title: (src?.title as Tr | undefined) ?? [`Chapter ${ch}`, `Глава ${ch}`], done: at >= CAMPAIGN_SIZE, card: art(chapterCard(ch)), at, of: CAMPAIGN_SIZE };
  }
  const sagaAll = (p.saga ?? []).slice().sort((a, b) => b.at - a.at);
  const saga = sagaAll.slice(0, 24).map((e) => { const text = tell(e, name); return text ? { at: num(e.at), icon: ico(SAGA_ICON[e.kind]), text } : null; }).filter((x): x is PSaga => !!x);
  return { deeds, feats, trophies, bosses, wonders, regions, tattoos, pets, companion, beasts, campaign, saga, sagaN: sagaAll.length };
}

// ------------------------------------------------------------------------------------------------ the whole

export interface ProfileOptions {
  now?: () => number;
  ttl?: number;
}

export class SiteProfile {
  private game: Game;
  private rating: SiteRating;
  private opts: ProfileOptions;
  private cache = new Map<string, { at: number; v: CaptainProfile }>();

  constructor(game: Game, rating: SiteRating, opts: ProfileOptions = {}) {
    this.game = game;
    this.rating = rating;
    this.opts = opts;
  }

  /** A public captain's profile by her name (case aside), or null: none such, or kept off the site. */
  get(name: string): CaptainProfile | null {
    const key = name.trim().toLowerCase();
    if (key.length < 2 || key.length > 40) return null;
    const now = (this.opts.now ?? Date.now)();
    const hit = this.cache.get(key);
    if (hit && now - hit.at < (this.opts.ttl ?? PROFILE_TTL)) return hit.v;
    const who = this.rating.account(name);
    if (!who) return null;
    const v = this.build(who.acc, who.name, who.found.ranks, who.found.captain.pw ?? { total: 0, army: 0, ship: 0, isle: 0, gear: 0 });
    if (!v) return null;
    if (this.cache.size > 500) this.cache.clear();
    this.cache.set(key, { at: now, v });
    return v;
  }

  private build(acc: number, name: string, ranks: CaptainProfile['ranks'], power: PowerScore): CaptainProfile | null {
    const game = this.game;
    const s = game.sessionByAccount(acc);
    let p: Profile | null = s?.profile ?? null;
    if (!p) {
      const row = game.db.loadCaptain(acc);
      if (!row) return null;
      try {
        p = sanitizeProfile(JSON.parse(row.data) as Profile);
      } catch {
        return null;
      }
    }
    if (!p || !Object.hasOwn(CAPTAINS, p.captain)) return null;
    const ship = s?.ship ?? null;
    const online = !!(ship && game.social?.aboard?.has(acc));
    const c = CAPTAINS[p.captain as CaptainId] as unknown as { name: string; archetype: string };
    const cos = game.db.getKv<{ eq?: Record<string, unknown> }>(`cos:${acc}`)?.eq ?? {};
    const pick = (k: string) => (typeof cos[k] === 'string' ? (cos[k] as string) : null);
    const g = game.guilds.of(game, acc);
    const level = Math.max(1, num(p.level, 1));
    const arena = arenaTable(game).find((r) => r.acc === acc);
    const army = (p.army ?? []).map(stack).filter((x): x is PUnit => !!x).sort((a, b) => b.tier - a.tier || b.power - a.power);
    const shipCls = (SHIP_CLASSES as Record<string, { tier: number }>)[p.loadout?.classId as ShipClassId];
    const seen = (game.db as { seenOf?: (acc: number) => { created: number; seen: number } | undefined }).seenOf?.(acc);
    const infamy = num(p.infamy);
    const wl = wantedLevel(infamy);
    const st = p.stats ?? ({} as Profile['stats']);
    const careers = (Object.keys(CAREERS) as CareerId[]).map((id) => {
      const r = num(p.renown?.ranks?.[id]);
      return { id, name: CAREERS[id].name, rank: r, rankName: r > 0 ? CAREERS[id].ranks[Math.min(CAREERS[id].ranks.length, r) - 1] : null };
    }).filter((x) => x.rank > 0);
    const out: CaptainProfile = {
      name, captain: p.captain, capName: [c.name, dataRu(`captains.CAPTAINS.${p.captain}.name`, c.name)], archetype: [c.archetype, dataRu(`captains.CAPTAINS.${p.captain}.archetype`, c.archetype)],
      portrait: art(`portrait.${p.captain}`), figure: art(`unit.hero_${p.captain}`), frame: pick('frame'), cosTitle: pick('title'), plate: pick('plate'),
      title: p.title ? both(p.title) : null, titles: [...new Set(p.titles ?? [])].map(both), pennant: typeof p.pennant === 'string' && /^#[0-9a-f]{3,8}$/i.test(p.pennant) ? p.pennant : null,
      level, maxLevel: MAX_LEVEL, xp: level >= MAX_LEVEL ? 0 : num(p.xp), xpNext: level >= MAX_LEVEL ? 0 : xpForLevel(level),
      glory: num(p.throne?.rank), guild: g ? { tag: g.tag, name: g.name } : null,
      online, sea: online && ship ? regionName(ship.region) : null, seen: online ? null : seen ? Math.max(seen.seen, 0) || null : null,
      created: seen?.created || null, ranks, power,
      pvp: { rating: Math.round(p.pvp?.rating ?? 1000), duels: num((p.pvp as { duels?: number })?.duels), wins: num((p.pvp as { duelWins?: number })?.duelWins),
        arena: arena && arena.n > 0 ? num(arena.r) : null, arenaWins: num(arena?.w), arenaN: num(arena?.n), wanted: wl, wantedName: [HUD_EN[`wanted.${wl}` as 'wanted.0'] ?? WANTED_TITLES[0], HUD_RU[`wanted.${wl}` as 'wanted.0'] ?? WANTED_TITLES[0]], infamy,
        ...((m, a) => ({
          season: { pts: m?.pts ?? 0, kills: m?.kills ?? 0, deaths: m?.deaths ?? 0, duels: m?.duels ?? 0, rank: ranks.pvp ?? null },
          all: { pts: a?.pts ?? 0, kills: a?.kills ?? 0, deaths: a?.deaths ?? 0, duels: a?.duels ?? 0, best: num((p.pvpr as { best?: number } | undefined)?.best) },
        }))(monthTally(p.pvpr, monthOf(game.wallNow())), (p.pvpr as { all?: { pts: number; kills: number; deaths: number; duels: number } } | undefined)?.all) },
      rep: FACTION_IDS.map((f) => ({ id: f, name: [FACTIONS[f].name, dataRu(`factions.FACTIONS.${f}.name`, FACTIONS[f].name)] as Tr, icon: ico(`faction_${f}`), v: Math.round(p.reputation?.[f] ?? 0) })),
      careers,
      army: { power: Math.round(army.reduce((n, x) => n + x.power, 0)), men: army.reduce((n, x) => n + x.n, 0), slots: armySlots(shipCls?.tier ?? 1), stacks: army },
      ship: shipOf(game, p, ship ? { hull: ship.hull, hullMax: ship.stats.hullMax, sails: ship.sails, stats: ship.stats } : null),
      escorts: (p.fleet?.escorts ?? []).filter((e) => (SHIP_CLASSES as Record<string, unknown>)[e.classId]).map((e) => ({ cls: e.classId, clsName: shipClassName(e.classId), art: shipArt(e.classId), name: String(e.name ?? ''), level: num(e.level, 1) })),
      berths: (p.berths ?? []).filter((b) => b.loadout && (SHIP_CLASSES as Record<string, unknown>)[b.loadout.classId]).map((b) => ({ cls: b.loadout.classId, clsName: shipClassName(b.loadout.classId), art: shipArt(b.loadout.classId), name: String(b.loadout.name ?? ''), level: shipLevelOf(b.loadout) })),
      hero: heroOf(p),
      island: islandView(game, acc),
      feats: featsOf(game, p, name),
      stats: {
        sunk: num(st.sunk), boarded: num(st.boarded), distance: Math.round(num(st.distance) / 1000), recruited: num(st.recruited), mentored: num(st.mentored),
        quests: num(p.quests?.done?.length), roamWins: num(p.roamWins), nemesisHeads: num(p.nemesisHeads), rescued: num(p.rescued), fish: num(Object.values(p.fishing?.caught ?? {}).reduce((a: number, b) => a + (typeof b === 'number' ? b : 0), 0)),
        season: num(p.season?.level), deeds: num(p.deeds?.length),
      },
    };
    return out;
  }
}
