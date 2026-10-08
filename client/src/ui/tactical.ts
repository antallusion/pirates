// The turn-based boarding battle (docs/16 P4, «like Heroes III»): the two decks drawn on a canvas — planks, rails,
// the masts, guns, barrels and crates, the planks across the water where the grapples bit — the stacks as tokens
// with their painted icons, counts and health; the lit reach of the stack whose turn it is; the order of the round;
// the captains on the side panel with their orders; the feed; the end. The server decides everything: a tap sends
// the order (a second tap on a lit hex moves there; a tap on a foe strikes or fires), a long press shows a stack.

import { findTitle } from '../render/seafinds.ts'; // docs/19 D5: the chest among the sharks
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { OFFICER_DEFS } from '../../../shared/src/data/crew.ts';
import { TAC_BLOCKING, TAC_H, TAC_PACE, TAC_SPELLS, TAC_W, hexDist, hexIndex, hexNeighbors, hexX, hexY, tacSchedule } from '../../../shared/src/data/tactical.ts';
import type { TacCell, TacSpellId } from '../../../shared/src/data/tactical.ts';
import type { ClientMsg, TacAction, TacEvent, TacPreview, TacStackView, TacView } from '../../../shared/src/protocol.ts';
import { assetUrl, sprite } from '../assets.ts';
import { dict, lang, plural } from '../i18n.ts';
import { ORDERS, PRIMS, PRIM_ICON, PRIM_NAMES, SCHOOLS, SCHOOL_ICON, SCHOOL_NAMES } from '../../../shared/src/data/hero.ts';
import type { School } from '../../../shared/src/data/hero.ts';
import { INNATE, ULTIMATE, ULT_ROUND } from '../../../shared/src/data/paths.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { personName } from '../lang/names.ts';
import { EN, RU } from '../lang/ui/tactical.ts';
import { along, glideMs, stepEase, walkPath } from './tacwalk.ts';
import { EN as LEN, RU as LRU } from '../lang/ui/lairs.ts';
import type { LairLoot } from '../../../shared/src/lairproto.ts';
import { LAIRS } from '../../../shared/src/data/lairs.ts';
import type { LairKind } from '../../../shared/src/data/lairs.ts';
import { DRIFTS, isDriftKind } from '../../../shared/src/data/drifts.ts';
import type { CaptureOffer } from '../../../shared/src/driftproto.ts';
import { EN as DEN, RU as DRU } from '../lang/ui/drifts.ts';
import { EN as FEN, RU as FRU } from '../lang/ui/seafinds.ts';
import { EN as REN, RU as RRU } from '../lang/ui/roamers.ts'; // docs/19 D7: the roaming stacks
import { isRoamKind } from '../../../shared/src/data/roamers.ts';
import type { RoamKind } from '../../../shared/src/data/roamers.ts';
import { roamName } from '../render/roamers.ts';
import { LAND_RES_DEF } from '../../../shared/src/data/bestiary.ts';
import type { LandRes } from '../../../shared/src/data/bestiary.ts';
import { BEAST_TINT } from '../../../shared/src/data/bestiary.ts';
import { FIGURES } from '../../../shared/src/data/unitart.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { ARTIFACTS } from '../../../shared/src/data/artifacts.ts';
import { $, dec1, esc, icon, portraitUrl } from './dom.ts';
import { placeName } from './maps.ts';
import { specialName, specialNote, unitArt, unitIcon, unitName, unitNote } from './army.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId, UnitSpecial } from '../../../shared/src/data/army.ts';
import { SHIP_BEAST_DEFS, isShipBeast } from '../../../shared/src/data/shipbeasts.ts'; // the premium hulls' own (docs/02 §1.A.9)
import { deckArt } from '../../../shared/src/data/fleet.ts';
import { BOSS_UNIT_STAND_IN, isBossUnit } from '../../../shared/src/data/bossunits.ts'; // the great ones ashore (2026-10-03)
import { SHORE_BOSSES, SHORE_MOVES, isShoreBoss } from '../../../shared/src/data/shorebosses.ts';
import type { ShoreMove } from '../../../shared/src/data/shorebosses.ts';
import { EN as BEN, RU as BRU } from '../lang/ui/bosses.ts';
import { settings, update as updateSettings } from '../settings.ts';
import { ask } from './confirm.ts';
import { openSheet } from './kit/sheet.ts';
import type { SheetHandle } from './kit/sheet.ts';
import { attachWheel, wheel } from './kit/radial.ts';
import { faceAttrs } from './kit/faces.ts'; // the captains' faces in their circles (2026-10-07)
import type { WheelOption } from './kit/radial.ts';

const L = dict(EN, RU);
const LL = dict(LEN, LRU);
const DL = dict(DEN, DRU);
const FL = dict(FEN, FRU);
const RL = dict(REN, RRU);
const BL = dict(BEN, BRU);
/** A great one's move, in the player's language. */
const shoreMove = (id: string | undefined): string => SHORE_MOVES[id as ShoreMove]?.[lang() === 'ru' ? 1 : 0] ?? '';
/** docs/19 D7: a roaming stack's fight is named 'roam_<kind>'. */
const roamOf = (lair: string | undefined): RoamKind | null => { const k = lair?.startsWith('roam_') ? lair.slice(5) : ''; return isRoamKind(k) ? k : null; };

/** docs/18 #36: the beaten who would follow her — how many, and her choice: aboard, home to the pen, let go. */
function captureBlock(c: CaptureOffer): string {
  const head = `<small>${esc(DL('cap.title'))}</small><div class="tb-lline">${unitIcon(c.u, 'ico-sm')} ${esc(unitName(c.u))} — ${esc(DL('cap.text', { n: c.n, p: Math.round(c.share * 100) }))}</div>`;
  if (c.done) return `<div class="tb-loot tb-cap">${head}<div class="tb-lline good">${esc(DL(`cap.done.${c.done}` as 'cap.done.take'))}</div></div>`;
  const take = c.room > 0 ? `<button class="btn btn-small btn-primary" data-cap="take">${esc(DL('cap.take', { n: Math.min(c.n, c.room) }))}</button>` : '';
  const pen = c.pen > 0 ? `<button class="btn btn-small" data-cap="pen">${esc(DL('cap.pen', { n: Math.min(c.n, c.pen) }))}</button>` : '';
  return `<div class="tb-loot tb-cap">${head}${!take && !pen ? `<div class="tb-lline muted">${esc(DL('cap.noroom'))}</div>` : ''}<div class="tb-capacts">${take}${pen}<button class="btn btn-small" data-cap="free">${esc(DL('cap.free'))}</button></div></div>`;
}

/** docs/18 II: what a lair left her, on the battle's reckoning — silver, experience, the island's resource, the land's
 *  spoils, an artifact, a young one for the pen, the island's chest, the island cleared, the dwelling. As chips (a
 *  picture and a number) and short lines, for the end's one row of spoils (docs/23 item 63). */
function lootParts(l: LairLoot): { chips: string[]; lines: string[] } {
  // docs/19 D7: a roaming stack beaten — its lesson, silver and spoils, the fallen hauled back, the mates' share.
  if (l.roam) {
    const r = l.roam, ru = lang() === 'ru' ? 1 : 0;
    const chips = [`<span class="tb-lc">${icon('icon.xp', '', 'ico-sm')}${esc(RL('loot.xp', { n: r.xp }))}</span>`, `<span class="tb-lc">${icon('icon.coin', '', 'ico-sm')}${r.silver}</span>`];
    for (const [k, n] of Object.entries(r.res) as [LandRes | 'pearls', number][]) {
      const name = k === 'pearls' ? GOODS.pearls.name : LAND_RES_DEF[k].name[ru];
      chips.push(`<span class="tb-lc" title="${esc(name)}">${icon(k === 'pearls' ? 'icon.good_pearls' : `icon.${LAND_RES_DEF[k].icon}`, '', 'ico-sm')}${esc(name)} ${n}</span>`);
    }
    const lines: string[] = [];
    if (r.grey) lines.push(esc(RL('loot.grey')));
    if (r.raised) lines.push(esc(RL('loot.raised', { n: r.raised })));
    if (r.mates) lines.push(esc(RL('loot.mates', { n: r.mates })));
    if (r.thin) lines.push(esc(RL('loot.thin')));
    if (r.artifact) lines.push(esc(RL('loot.art', { a: ARTIFACTS[r.artifact]?.name[ru] ?? r.artifact })));
    return { chips, lines };
  }
  // docs/19 D5: the chest among the sharks — what came up in it.
  if (l.find) return { chips: [`<span class="tb-lc">${icon('icon.coin', '', 'ico-sm')}${l.find.silver}</span>`, ...l.find.goods.map((g) => `<span class="tb-lc" title="${esc(GOODS[g.g].name)}">${icon(`icon.good_${g.g}`, '', 'ico-sm')}${g.n}</span>`)], lines: [] };
  // docs/18 IV: a drift beaten at sea — its silver and lesson.
  if (l.drift) return { chips: [`<span class="tb-lc">${icon('icon.coin', '', 'ico-sm')}${l.drift.silver}</span>`, `<span class="tb-lc">${icon('icon.xp', '', 'ico-sm')}${esc(LL('loot.xp', { n: l.drift.xp }))}</span>`], lines: [] };
  if (l.looted) return { chips: [], lines: [esc(LL('loot.looted'))] };
  const ru = lang() === 'ru' ? 1 : 0;
  const chips: string[] = [];
  if (l.silver) chips.push(`<span class="tb-lc">${icon('icon.coin', '', 'ico-sm')}${l.silver}</span>`);
  if (l.xp) chips.push(`<span class="tb-lc">${icon('icon.xp', '', 'ico-sm')}${esc(LL('loot.xp', { n: l.xp }))}</span>`);
  for (const g of l.goods) chips.push(`<span class="tb-lc" title="${esc(GOODS[g.g].name)}">${icon(`icon.good_${g.g}`, '', 'ico-sm')}${g.n}</span>`);
  for (const [r, n] of Object.entries(l.res) as [LandRes | 'pearls', number][]) {
    const name = r === 'pearls' ? GOODS.pearls.name : LAND_RES_DEF[r].name[ru];
    chips.push(`<span class="tb-lc" title="${esc(name)}">${icon(r === 'pearls' ? 'icon.good_pearls' : `icon.${LAND_RES_DEF[r].icon}`, '', 'ico-sm')}${esc(name)} ${n}</span>`);
  }
  const lines: string[] = [];
  if (l.artifact) lines.push(esc(LL('loot.art', { a: ARTIFACTS[l.artifact]?.name[ru] ?? l.artifact })));
  if (l.egg) lines.push(`${unitIcon(l.egg, 'ico-sm')} ${esc(LL('loot.egg', { u: unitName(l.egg) }))}`);
  if (l.chest) lines.push(esc(LL('loot.chest', { s: l.chest.silver, x: l.chest.xp })) + (l.chest.artifact ? ` · ${esc(ARTIFACTS[l.chest.artifact]?.name[ru] ?? '')}` : ''));
  if (l.claimed) lines.push(esc(LL('loot.claimed', { island: placeName(l.claimed) })));
  if (l.dwell) lines.push(esc(LL('loot.dwell')));
  // A great one ashore beaten (2026-10-03): its trophy, and the first on the seas.
  if (l.shore?.trophy && isShoreBoss(l.shore.kind)) lines.push(esc(BL('loot.trophy', { t: SHORE_BOSSES[l.shore.kind].trophy[ru] })));
  if (l.shore?.first) lines.push(esc(BL('loot.first')));
  return { chips, lines };
}
/** An order's name and words, from the order book (docs/17 H2) — every page of it, old and new. */
/** The battle's own painted icons (tools/art/battle_more.py, battle_sheets.py) where they are painted; the older
 *  stand-ins until then. */
const btIcon = (id: string, fb: string, cls = 'ico-sm') => icon(assetUrl(`icon.${id}`) ? `icon.${id}` : fb, '', cls);
const spIcon = (id: TacSpellId, cls = 'ico') => btIcon(`sp_${id}`, TAC_SPELLS[id].icon, cls);
/** What lies on a stack, as the card shows it: its painted mark and its word. */
const STATUS: [keyof TacStackView, string, K][] = [
  ['marked', 'st_marked', 'sts.marked'], ['defending', 'bt_defend', 'sts.defending'], ['braced', 'st_braced', 'sts.braced'],
  ['waited', 'bt_wait', 'sts.waited'], ['again', 'st_again', 'sts.again'], ['noRet', 'st_no_ret', 'sts.noRet'],
  ['blind', 'st_blind', 'sts.blind'], ['poisoned', 'st_poison', 'sts.poisoned'], ['wet', 'st_diving', 'sts.wet'],
  ['still', 'st_fear', 'sts.still'], ['mad', 'st_terror', 'sts.mad'],
];
/** The book's bookmarks: each school by the painted mark of the path whose school it is (shared/src/data/paths.ts). */
const BOOK_TAB: Record<School, string> = { fire: 'school_corsair', board: 'school_reaver', steel: 'school_admiral', wind: 'school_navigator', water: 'school_drowned', fog: 'school_smuggler' };
const spName = (id: TacSpellId) => (ORDERS[id]?.name ?? [id, id])[lang() === 'ru' ? 1 : 0];
const spText = (id: TacSpellId) => (ORDERS[id]?.text ?? [id, id])[lang() === 'ru' ? 1 : 0];
type K = keyof typeof EN;

const SQ3 = Math.sqrt(3);
const easeOut = (k: number): number => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - (1 - k) ** 3);
const YOU = '#7fb0d0';
const FOE = '#d2473a';

interface Float {
  text: string;
  x: number;
  y: number;
  t0: number;
  color: string;
  big?: boolean;
  /** Its type's size against a blow's number (owner, 2026-10-08: the harm, the fallen, a flank told apart). */
  size?: number;
  /** Where it was meant to stand before it was lifted clear of the others over the same spot. */
  base?: number;
}
interface Burst {
  id: string;
  x: number;
  y: number;
  t0: number;
  size: number;
}
/** A shot or a throw in flight from the shooter to the target. */
interface Missile {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  /** Its flight (ms): it lands as the shot's beat does. */
  dur: number;
  arc: number;
}
/** A figure's blow, shot or flinch being played: since when, the moment the blow lands, toward where. */
interface Act {
  k: 'atk' | 'shot' | 'hurt';
  t0: number;
  hit: number;
  dx: number;
  dy: number;
}
/** How long a figure's act plays past its start (a lunge: to its blow and the step back after). */
const actEnd = (a: Act): number => (a.k === 'atk' ? a.hit + 300 : a.k === 'shot' ? a.t0 + 420 : a.t0 + 480);
/** The painted four-frame effects (owner, 2026-10-02), added onto the field as light, in place of the old single bursts. */
const FX_OF: Record<string, string> = { 'part.explosion': 'fx.bt_blast', 'part.muzzle': 'fx.bt_muzzle', 'part.splash': 'fx.bt_splash' };
/** What a kind fires or throws; muskets by default. Thrown things fly in an arc. */
const MISSILE_OF: Record<string, string> = {
  gunner: 'part.ms_cannonball', bombardier: 'part.ms_grenade', hermit: 'part.ms_harpoon', cultist: 'part.ms_brine', mermaid: 'part.ms_spear',
  harpooner: 'part.ms_harpoon', master_harpooner: 'part.ms_harpoon', harpoon_gunner: 'part.ms_harpoon', crown_grenadier: 'part.ms_grenade',
  crown_mortar: 'part.ms_cannonball', crown_rocketeer: 'part.ms_rocket', choir_chanter: 'part.ms_bell', choir_cantor: 'part.ms_bell',
  brine_witch: 'part.ms_brine', poisoner: 'part.ms_dart', blowgun_hunter: 'part.ms_dart', alchemist: 'part.ms_flask', fog_thief: 'part.ms_smokebomb',
  island_archer: 'part.ms_arrow', net_thrower: 'part.ms_net', net_master: 'part.ms_net', phantom_gunner: 'part.ms_cannonball',
  storm_witch: 'part.ms_brine', tide_shaman: 'part.ms_brine', tide_caller: 'part.ms_brine',
  // docs/18 VII: the new kinds' shots.
  company_cannoneer: 'part.ms_cannonball', petardier: 'part.ms_grenade', fog_viper: 'part.ms_dart', choir_toller: 'part.ms_bell', thunderbird: 'part.ms_brine',
  // The second dozen (2026-10-04).
  rime_witch: 'part.ms_brine', line_harpooner: 'part.ms_harpoon', hunt_master: 'part.ms_harpoon', fog_chemist: 'part.ms_flask', mask_archer: 'part.ms_arrow',
  ghost_bomber: 'part.ms_grenade',
};
const THROWN = new Set(['part.ms_grenade', 'part.ms_stone', 'part.ms_spear', 'part.ms_flask', 'part.ms_net', 'part.ms_smokebomb', 'part.ms_cannonball']);

/** A path's move drawn over the field (docs/18 items 1, 5): the innate small, the ultimate over the whole board. */
interface PathFx {
  path: CaptainId;
  ult: boolean;
  /** Your side's or hers (where it falls). */
  mine: boolean;
  t0: number;
  /** The stacks it fell on (screen centres at the time). */
  at: { x: number; y: number }[];
}
/** Each path's colour for its moves' light. */
const PATH_RGB: Record<CaptainId, [number, number, number]> = {
  corsair: [255, 150, 60], smuggler: [170, 190, 180], reaver: [220, 40, 40], navigator: [120, 200, 255], drowned: [60, 220, 190], admiral: [240, 200, 100],
};
const PATH_FX_MS = { innate: 1200, ult: 2200 };
/** A move's name (a path's innate or ultimate). */
const moveName = (path: string, ult: boolean) => ((ult ? ULTIMATE : INNATE)[path as CaptainId]?.name ?? [path, path])[lang() === 'ru' ? 1 : 0];
const moveText = (path: string, ult: boolean) => ((ult ? ULTIMATE : INNATE)[path as CaptainId]?.text ?? [path, path])[lang() === 'ru' ? 1 : 0];

/** The stack's painted face (docs/17 H1): its kind of man's portrait; an officer's own party his face or post. */
function stackArt(s: TacStackView): string {
  if (s.officer && s.kind === 'officer') return s.officer.unique && sprite(`portrait.officer_${s.officer.unique}`) ? `portrait.officer_${s.officer.unique}` : `icon.role_${s.officer.role}`;
  return s.unit ? unitArt(s.unit) : s.kind === 'hands' ? 'icon.prof_sailor' : s.kind === 'marines' ? 'icon.prof_marine' : 'icon.prof_gunner';
}

function stackName(s: TacStackView): string {
  if (s.officer && s.kind === 'officer') return L('k.officer', { role: OFFICER_DEFS[s.officer.role].name });
  return s.unit ? unitName(s.unit) : L(`k.${s.kind}` as K);
}

/** The stack's figure on the field (owner, 2026-10-02: the battle as in Heroes): its kind's painted full figure in
 *  three-quarter view, `unit.<kind>`; the parties of the old crews and the officers as the men they are. */
const KIND_FIGURE: Record<string, string> = { hands: 'sailor', marines: 'marine', gunners: 'gunner', boarders: 'boarder', guard: 'guard', deep: 'drowned', officer: 'officer' };
function figureArt(s: TacStackView): string | null {
  const id = `unit.${s.kind === 'officer' || !s.unit ? KIND_FIGURE[s.kind] ?? 'sailor' : s.unit}`;
  if (sprite(id)) return id;
  // A great one ashore (2026-10-03) whose own figure is not painted yet: a kind of like shape stands in, tinted.
  const stand = s.unit && isBossUnit(s.unit) ? `unit.${BOSS_UNIT_STAND_IN[s.unit].u}` : null;
  return stand && sprite(stand) ? stand : null;
}
/** The tint over a great one's stand-in figure (none over its own). */
const standTint = (s: TacStackView, id: string): string | undefined => (s.unit && isBossUnit(s.unit) && !id.startsWith(`unit.${s.unit}`) ? BOSS_UNIT_STAND_IN[s.unit].tint : undefined);
/** How tall a kind stands beside a hex's width: the men alike, the creatures by their bulk. */
const FIGURE_SIZE: Record<string, number> = {
  crab: 0.85, gull: 0.95, seal: 1.0, reef_shark: 1.15, rock_turtle: 1.05, sea_turtle: 1.05, marsh_serpent: 1.45, hermit: 1.3,
  lagoon_tentacle: 1.65, mermaid: 1.4, cultist: 1.3, surf_drowned: 1.3, young_serpent: 1.6, lantern_maw: 1.45, ancient_turtle: 1.45,
  shoal_leviathan: 1.6, white_whale: 1.75, young_kraken: 1.75, deep_spawn: 1.45, life_guard: 1.32, guard: 1.32,
  crown_ironclad: 1.35, crown_diver: 1.5, crown_dreadnought: 1.7, deep_one_champion: 1.45, deep_abbot: 1.4, abyss_herald: 1.7,
  leviathan_slayer: 1.45, basalt_guardian: 1.6, dutchman_mate: 1.6, lantern_wraith: 1.2,
  // The wild beasts (owner, 2026-10-03).
  wild_boar: 1.05, giant_toad: 1.05, cave_bat: 1.05, barracuda: 1.1, jaguar: 1.2, monitor: 1.2, albatross: 1.15, moray: 1.35,
  bell_hermit: 1.1, island_ape: 1.5, crocodile: 1.35, giant_octopus: 1.55,
  // The great beasts (owner, 2026-10-03).
  crab_queen: 1.4, cave_wyrm: 1.5, mangrove_hydra: 1.6, ape_king: 1.75, storm_roc: 1.65,
};
// docs/18 VII: the kinds still in the painter's queue keep their height in shared/src/data/unitart.ts; the premium
// hulls' own kinds theirs in shipbeasts.ts, the great ones ashore theirs in bossunits.ts.
const figureSize = (s: TacStackView): number => (FIGURE_SIZE[s.kind === 'officer' ? 'officer' : s.unit] ?? FIGURES[s.unit]?.size ?? (s.kind !== 'officer' && s.unit && isShipBeast(s.unit) ? SHIP_BEAST_DEFS[s.unit].fig : undefined) ?? (s.unit && isBossUnit(s.unit) ? BOSS_UNIT_STAND_IN[s.unit].size : undefined) ?? 1.28) * 1.22;
/** Where the feet stand across a figure (a musket held out to one side does not move the man off his hex): the middle
 *  of what is painted in its lowest tenth, found once per picture. */
const footCache = new Map<string, number>();
function footX(id: string, img: HTMLImageElement): number {
  let f = footCache.get(id);
  if (f !== undefined) return f;
  f = 0.5;
  try {
    const w = 64, h = Math.max(8, Math.round((64 * img.naturalHeight) / img.naturalWidth));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, w, h);
    const y0 = Math.floor(h * 0.88);
    const d = g.getImageData(0, y0, w, h - y0).data;
    let sx = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 60) {
        sx += (i / 4) % w;
        n++;
      }
    }
    if (n) f = (sx / n + 0.5) / w;
  } catch {
    /* a picture from elsewhere: its middle */
  }
  footCache.set(id, f);
  return f;
}

/** The hulls whose decks are painted (tools/art/battle_more.py): one stands in for a hull not painted yet. */
const DECK_HULLS = ['brig', 'brigantine', 'frigate', 'sloop', 'schooner', 'cutter', 'galleon', 'man_o_war', 'fluyt', 'xebec', 'ghost_ship', 'bomb_ketch', 'fireship', 'fishing_ketch', 'harpoon_whaler'];

/** A painting laid over a box as a cover (cut, never stretched). */
function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
/** What stands on a hex as a painted three-quarter prop (owner, 2026-10-02: the battle as in Heroes), by the ground. */
const PROP_OF: Record<string, (land: string) => string> = {
  M: () => 'prop.bt_mast', C: () => 'prop.bt_cannon', B: () => 'prop.bt_barrels', K: () => 'prop.bt_crates',
  R: (l) => (l === 'volcanic' ? 'prop.bt_lava' : l === 'graveyard' ? 'prop.bt_graves' : 'prop.bt_boulder'),
  P: (l) => (l === 'swamp' ? 'prop.bt_mangrove' : l === 'volcanic' || l === 'graveyard' || l === 'dead' ? 'prop.bt_deadtree' : 'prop.bt_palm'),
};
/** A prop's greatest width and height in hex widths. */
const PROP_BOX: Record<string, [number, number]> = {
  'prop.bt_mast': [0.95, 2.3], 'prop.bt_cannon': [1.25, 1.0], 'prop.bt_barrels': [1.0, 1.05], 'prop.bt_crates': [1.05, 1.05],
  'prop.bt_boulder': [1.15, 1.0], 'prop.bt_lava': [1.15, 1.0], 'prop.bt_graves': [1.1, 1.25], 'prop.bt_palm': [1.5, 2.5],
  'prop.bt_mangrove': [1.4, 1.7], 'prop.bt_deadtree': [1.4, 2.2],
};
function propArt(cell: string, land: string): string | null {
  const id = PROP_OF[cell]?.(land);
  return id && sprite(id) ? id : null;
}

/** The wood of a deck, drawn once: planks along the ship, seams, grain and nails. */
function plankTexture(dark: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d')!;
  const tones = dark ? ['#4a3624', '#503a26', '#453220', '#4d3823'] : ['#6b4b2c', '#72502f', '#664729', '#6e4d2d'];
  const ph = 12;
  for (let r = 0; r < 96 / ph; r++) {
    g.fillStyle = tones[r % tones.length];
    g.fillRect(0, r * ph, 96, ph);
    // Grain.
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const y = r * ph + 3 + k * 3 + ((r * 7 + k) % 2);
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(30, y + 1.2, 60, y - 1.2, 96, y + 0.5);
      g.stroke();
    }
    // Seams between planks and the butt joints, staggered.
    g.fillStyle = 'rgba(18,10,4,0.75)';
    g.fillRect(0, r * ph + ph - 1, 96, 1);
    const off = (r * 37) % 96;
    g.fillRect(off, r * ph, 1, ph);
    g.fillRect((off + 48) % 96, r * ph, 1, ph);
    g.fillStyle = 'rgba(210,190,150,0.35)';
    for (const x of [off + 3, (off + 51) % 96]) {
      g.fillRect(x, r * ph + 3, 1.5, 1.5);
      g.fillRect(x, r * ph + ph - 5, 1.5, 1.5);
    }
  }
  // A light wash of wear.
  const grd = g.createRadialGradient(48, 48, 10, 48, 48, 70);
  grd.addColorStop(0, 'rgba(255,230,190,0.05)');
  grd.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 96, 96);
  return c;
}

export class TacticalPanel {
  private view: TacView | null = null;
  private send: (m: ClientMsg) => void;
  private now: () => number;
  private el: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  /** The field under the hexes is a painting (a deck or a ground): the marks on it are drawn lighter. */
  private painted = false;
  /** The hex's width, the stage, the board's corner, and its turn: 0 as the decks lie side by side, 1 upright with
   *  the boarders' deck below, −1 upright with the defenders' below (a phone held upright: your deck at the thumb). */
  private size = { w: 0, cw: 0, ch: 0, ox: 0, oy: 0, dpr: 1, rot: 0 as 0 | 1 | -1, bw: 0, bh: 0 };
  private key = '';
  private preview: number | null = null;
  private targeting: TacSpellId | 'innate' | 'ult' | null = null;
  /** The paths' moves being drawn over the field (docs/18). */
  private pathFx: PathFx[] = [];
  /** The order book open over the field (docs/17 H2: more pages than the panel holds). */
  private bookOpen = false;
  private bookTab: School | 'all' = 'all';
  private bookPage = 0;
  private info: number | null = null;
  private hover: number | null = null;
  private strikeArmed = 0;
  private ransomArmed = 0;
  private seen = 0;
  private floats: Float[] = [];
  /** The captains stepping in at their corners of the field (HoMM3's heroes): as the fight opens, and as each gives
   *  an order or her path's move. */
  private heroFx: { side: number; t0: number; dur: number }[] = [];
  private bursts: Burst[] = [];
  private missiles: Missile[] = [];
  /** Each stack's walk (ui/tacwalk.ts): the hex it is bound for, the hexes it steps through, since when, how long, and
   *  whether it glides over them (a flier). One figure a stack: it walks, nothing stays behind at the hex it left. */
  private pos = new Map<number, { hex: number; path: number[]; t0: number; dur: number; fly: boolean }>();
  /** The ghost's own layer, laid over the field at its dimness (a figure's own alphas would show through otherwise). */
  private ghostLayer: HTMLCanvasElement | null = null;
  /** A figure's extra height this frame (a flier's glide), and the way it walks (screen x; 0 standing). */
  private liftNow = 0;
  private walkDx = 0;
  /** What the last frame drew (QA: one figure a stack, the ghost apart). */
  private drawn = { figures: new Map<number, number>(), ghosts: 0, path: 0, walking: [] as number[] };
  private calmMq: MediaQueryList | null = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  /** A figure's blow, shot or flinch being played: since when, and toward where. */
  /** The plates of the figures being drawn, laid over them all at the end of the frame. */
  private plates: (() => void)[] | null = null;
  private act = new Map<number, Act[]>();
  private press: { x: number; y: number; t: number; timer: number; foe?: boolean } | null = null;
  private planks: [HTMLCanvasElement, HTMLCanvasElement] | null = null;
  /** Every stack's name as last seen (the fallen are named in the feed too). */
  private names = new Map<number, string>();
  /** A phone (owner, 2026-10-03: «на телефоне в бою не должно быть ничего кроме игрового поля с существами»): a touch
   *  screen whose short side is a phone's, upright or on its side. The field alone fills it; round painted buttons
   *  stand at its edges (see padDom). */
  private phone = false;
  /** …held upright (its book one tall page). */
  private tall = false;
  /** On a phone: the «…» of the fight's own orders opened, and the round (its order, the captains, the feed) opened
   *  behind the face of the stack whose turn it is. */
  private moreOpen = false;
  private sheetOpen = false;
  /** On a phone: the room the buttons keep along the field's edges, so no hex lies under a thumb's button (CSS px). */
  private band = { l: 0, r: 0, t: 0, b: 0 };
  /** The special whose words are open on the stack's card (a phone has no hover for its title). */
  private spNote: string | null = null;
  /** On a phone (docs/23 items 59, 62): the stack's card or the book, as the kit's bottom sheet. */
  private sheetH: SheetHandle | null = null;
  private sheetKind: 'card' | 'book' | null = null;
  /** With a second tap asked (docs/23 item 57, the option): the foe tapped once, to be struck by the next tap. */
  private foeArmed: number | null = null;
  /** The end put away by its button (a battle at sea closes itself a moment later). */
  private endHidden = false;
  /** The screen's clock (owner, 2026-10-08: «сам бой должен быть плавнее по игре, там как-то слишком быстро всё
   *  перемещается»): what came in is played beat by beat (shared TAC_PACE, the server waits as long) — a view coming
   *  in meanwhile waits for it, and the field takes no order till it is played. */
  private busyUntil = 0;
  /** The counts shown while blows are being played: from each moment on, the count a stack had (a blow's fallen leave
   *  its count as the blow lands, not before). */
  private counts = new Map<number, { at: number; n: number }[]>();
  /** Stacks felled in what is being played: drawn till the blow that fells them lands, then fading out. */
  private fallen = new Map<number, { s: TacStackView; at: number }>();
  /** The foe under the mouse or the finger and the hex she would strike it from (owner, 2026-10-08: «при наведении…
   *  сколько я убью и какой урон нанесу»), the preview over it. */
  private aimFoe: { t: number; from?: number } | null = null;
  private ptr: { x: number; y: number } | null = null;
  private tipKey = '';

  /** Her purse (main.ts): a ransom she cannot pay is shown, and why, but not offered (docs/23 item 93: the wheel
   *  offered «Откуп 340» to an empty purse, the confirm sheet, then nothing). */
  purse: () => number = () => Infinity;

  constructor(send: (m: ClientMsg) => void, now: () => number) {
    this.send = send;
    this.now = now;
  }

  /** The battle's pace on this screen: 2 under «Ускорить ×2» (docs/23 item 60) — hers, or the other captain's (the
   *  server plays the sea's turns at the quicker one asked, and this screen keeps to the server's clock). */
  private speed(v: TacView | null = this.view): number {
    return settings().tacFast || !!v?.heroes.some((h) => h.fast) ? 2 : 1;
  }

  /** What came in is still being played on the field. */
  private busy(): boolean {
    return performance.now() < this.busyUntil;
  }

  /** A touch screen: a phone (375×812 upright, 812×375 or 932×430 on its side) and a tablet alike (owner, 2026-10-07: «на
   *  планшете такое же управление надо сделать»): the field over the screen, the round buttons and the book in its
   *  corners, the two captains in its top corners. A desk keeps the captains in one band at the top over the field. */
  private isPhone(): boolean {
    return document.body.classList.contains('touch');
  }

  get open(): boolean {
    return this.view !== null;
  }

  render(v: TacView | null): void {
    const root = $('board-tac');
    // A view with more of the battle in it waits while the last is still being played (owner, 2026-10-08: every turn
    // of hers seen whole — who moved, who struck whom, how many fell); one with nothing new comes in at once.
    if (v && this.view && v !== this.view && this.el && this.busy() && v.log.some((e) => e.i > this.seen)) {
      this.tick();
      this.draw();
      return;
    }
    const was = this.view;
    this.view = v;
    document.body.classList.toggle('tac', !!v);
    document.body.classList.toggle('tac-over', !!v?.over);
    // A phone turned, or a window narrowed under a finger: the field and its buttons laid out afresh.
    const phone = !!v && this.isPhone();
    const tall = phone && innerHeight > innerWidth;
    if (phone !== this.phone || tall !== this.tall) {
      if (phone !== this.phone) this.moreOpen = this.sheetOpen = false;
      this.phone = phone;
      this.tall = tall;
      document.body.classList.toggle('tac-ph', phone);
      this.key = '';
    }
    if (!v) {
      if (this.el) {
        root.classList.add('hidden');
        root.innerHTML = '';
        this.el = this.canvas = null;
        this.key = '';
        // The next fight builds a new canvas: its size is measured afresh, or a second boarding in the same window kept a
        // bare 300×150 board (QA, 2026-10-04).
        this.size = { w: 0, cw: 0, ch: 0, ox: 0, oy: 0, dpr: 1, rot: 0, bw: 0, bh: 0 };
        this.band = { l: 0, r: 0, t: 0, b: 0 };
        this.bgKey = '';
        this.pos.clear();
        this.act.clear();
        this.counts.clear();
        this.fallen.clear();
        this.busyUntil = 0;
        this.aimFoe = this.ptr = null;
        this.tipKey = '';
        this.floats = [];
        this.bursts = [];
        this.missiles = [];
        this.pathFx = [];
        this.seen = 0;
        this.preview = this.targeting = this.info = null;
        this.moreOpen = this.sheetOpen = this.bookOpen = false;
        this.spNote = null;
        this.closeSheet();
        this.foeArmed = null;
        this.endHidden = false;
      }
      return;
    }
    if (!this.el) this.build(root);
    if (v !== was) this.onView(v, was);
    // The panels laid out afresh for a phone come and gone, or turned, between two views.
    else if (!this.key) this.dom(v);
    this.tick();
    this.draw();
  }

  private build(root: HTMLElement): void {
    root.classList.remove('hidden');
    root.innerHTML = `<div class="tb-root">
      <div class="tb-hero you"></div><div class="tb-mid"></div><div class="tb-hero foe"></div>
      <div class="tb-queue" aria-label="${esc(L('order.label'))}"></div>
      <div class="tb-stage"><canvas class="tb-board"></canvas><div class="tb-pv hidden" role="status"></div><div class="tb-card hidden"></div><div class="tb-banner hidden"></div><div class="tb-book hidden"></div></div>
      <div class="tb-feed"><div class="tb-hint"></div><div class="tb-lines"></div></div>
      <div class="tb-spells"></div>
      <div class="tb-acts"></div>
      <div class="tb-pad"></div>
    </div>`;
    this.el = root.querySelector('.tb-root');
    this.canvas = root.querySelector('canvas');
    const deck = assetUrl('bg.boarding');
    if (deck) this.el!.style.setProperty('--tb-deck', `url('${deck}')`);
    const c = this.canvas!;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', () => this.cancelPress());
    c.addEventListener('pointerleave', () => {
      this.hover = null;
      if (this.foeArmed === null) this.aimFoe = null;
      delete c.dataset.cur;
      this.cancelPress();
    });
    c.addEventListener('pointermove', (e) => this.move(e));
    // The field answers a finger by its pointer events alone: the mouse's click the browser makes up after a touch
    // would land on the card the tap (or the long press) has just opened under the finger, and close it at once.
    c.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const h = this.hexAt(e);
      const s = h !== null ? this.stackAt(h) : undefined;
      // A finger's long press opens the card by its own clock (down): the menu the browser asks for after it must not
      // close it again.
      if (s || !this.phone) this.showInfo(s?.id ?? null);
    });
    root.querySelector('.tb-card')!.addEventListener('click', (e) => {
      // A special's name on the card opens its words there (a finger has no hover for its title); the rest closes it.
      const sp = (e.target as HTMLElement).closest<HTMLElement>('[data-spnote]');
      if (sp) {
        this.spNote = this.spNote === sp.dataset.spnote ? null : sp.dataset.spnote!;
        this.showInfo(this.info);
        return;
      }
      this.showInfo(null);
    });
  }

  // ------------------------------------------------------------------ a new view from the server

  private onView(v: TacView, was: TacView | null): void {
    // What happened since the last view is played beat by beat (owner, 2026-10-08: «сам бой должен быть плавнее… там
    // как-то слишком быстро всё перемещается, непонятно даже»; shared TAC_PACE, the server waits as long): each walk hex
    // by hex round what stood on the field (a flier glides over), then each blow — the lunge, the struck stack's flash
    // and its numbers as it lands, the answer a beat of its own after a breath — so a foe's turn reads whole: who moved,
    // who struck whom, how many fell. Less motion asked: the same clock, no walks or lunges.
    const t = performance.now();
    const calm = this.calm();
    const fresh = was ? v.log.filter((e) => e.i > this.seen) : [];
    const { beats, total } = tacSchedule(fresh, this.speed(v));
    const ms = (sec: number) => t + sec * 1000;
    // Where each stack stands and how many it has as the play goes on.
    const at = new Map((was ?? v).stacks.map((s) => [s.id, s.hex]));
    const cnt = new Map((was ?? v).stacks.map((s) => [s.id, s.count]));
    const known = new Map([...(was?.stacks ?? []), ...v.stacks].map((s) => [s.id, s]));
    const drops = new Map<number, { at: number; n: number }[]>();
    const died = new Map<number, number>();
    let lastSpell = 0;
    fresh.forEach((e, i) => {
      const b = beats[i];
      if (e.k === 'move' && e.s !== undefined && e.hex !== undefined) {
        const from = at.get(e.s) ?? this.pos.get(e.s)?.hex ?? e.hex;
        const s = known.get(e.s);
        const fly = e.id === 'fly' || !!s?.sp.includes('flying');
        const stand = [...at].map(([id, hex]) => ({ id, hex, count: cnt.get(id) ?? 0 }));
        const path = fly || calm ? null : walkPath(v.cells, stand, e.s, from, e.hex, !!s?.sp.includes('diving'));
        this.pos.set(e.s, { hex: e.hex, path: path ?? [from, e.hex], t0: ms(b.at), dur: calm ? 0 : b.dur * 1000, fly: fly && !calm });
        at.set(e.s, e.hex);
      }
      // A blow's fallen leave its count as it lands.
      const struck = e.k === 'hit' || e.k === 'shot' || e.k === 'ret' || (e.k === 'order' && e.t !== undefined) ? e.t : e.k === 'burn' || e.k === 'poison' ? e.s : undefined;
      if (struck !== undefined && e.kills) {
        const n = Math.max(0, (cnt.get(struck) ?? 0) - e.kills);
        cnt.set(struck, n);
        const list = drops.get(struck) ?? [];
        list.push({ at: ms(b.impact), n });
        drops.set(struck, list);
      }
      if (e.k === 'die' && e.s !== undefined) died.set(e.s, ms(b.impact));
      if (e.k === 'spell' || e.k === 'innate' || e.k === 'ult' || e.k === 'boss') lastSpell = ms(b.impact);
      if (was) this.mark(e, v, was, ms(b.at), ms(b.impact));
    });
    // The counts shown till the play is over: as it stood, then after each blow as it lands; a move of the captains'
    // that felled or raised men tells its count as it lands, the rest as the play ends.
    const end = ms(total);
    for (const s of v.stacks) {
      const list = drops.get(s.id) ?? [];
      if (cnt.has(s.id) && cnt.get(s.id) !== s.count) list.push({ at: lastSpell || end, n: s.count });
      if (list.length && was) this.counts.set(s.id, [{ at: 0, n: was.stacks.find((x) => x.id === s.id)?.count ?? s.count }, ...list]);
    }
    // The fallen stay on the field till the blow that fells them lands, then fade.
    for (const s of was?.stacks ?? []) {
      if (v.stacks.some((x) => x.id === s.id)) continue;
      const when = died.get(s.id) ?? (lastSpell || t);
      this.fallen.set(s.id, { s: { ...s, hex: at.get(s.id) ?? s.hex }, at: when });
      const list = drops.get(s.id);
      if (list?.length) this.counts.set(s.id, [{ at: 0, n: s.count }, ...list]);
    }
    // A stack set down elsewhere with no walk told (a move of the deep): it glides there.
    for (const s of v.stacks) {
      const p = this.pos.get(s.id);
      if (!p) this.pos.set(s.id, { hex: s.hex, path: [s.hex], t0: 0, dur: 0, fly: false });
      else if (p.hex !== s.hex) this.pos.set(s.id, { hex: s.hex, path: [p.hex, s.hex], t0: t, dur: calm ? 0 : glideMs(hexDist(p.hex, s.hex), this.speed(v)), fly: !calm });
    }
    this.busyUntil = Math.max(this.busyUntil, end);
    if (!was) {
      this.heroFx = [0, 1].map((side) => ({ side, t0: performance.now() + 400 + side * 250, dur: 1900 }));
      this.endHidden = false;
      // «Ускорить ×2» is kept from the last battle (docs/23 item 60).
      if (settings().tacFast && !v.heroes[v.you].fast && !v.over) this.order({ a: 'pace', fast: true });
      this.seen = v.log.length ? v.log[v.log.length - 1].i : 0;
    }
    if (fresh.length) this.seen = Math.max(this.seen, ...fresh.map((e) => e.i));
    for (const s of v.stacks) this.names.set(s.id, `${stackName(s)} (${L(s.side === v.you ? 'ours' : 'theirs')})`);
    if (!v.mine || v.active !== was?.active) {
      this.preview = null;
      this.aimFoe = null;
      if (!v.mine) this.targeting = null;
    }
    if (this.preview !== null && !v.reach.includes(this.preview)) this.preview = null;
    this.dom(v);
  }

  /** The count a stack shows now: while its blows are being played, the count it had before each lands. */
  private countNow(s: TacStackView, t: number): number {
    const list = this.counts.get(s.id);
    if (!list) return s.count;
    if (t >= list[list.length - 1].at + 50) {
      this.counts.delete(s.id);
      return s.count;
    }
    let n = list[0].n;
    for (const x of list) if (x.at <= t) n = x.n;
    return n;
  }

  /** A figure's act to play (a stack struck, then answering, plays both in turn). */
  private addAct(id: number, a: Act): void {
    const list = this.act.get(id) ?? [];
    list.push(a);
    this.act.set(id, list);
  }

  /** The act a figure plays now (the latest begun that is not over), the spent ones let go. */
  private actNow(id: number, t: number): Act | undefined {
    const list = this.act.get(id);
    if (!list) return undefined;
    const live = list.filter((a) => actEnd(a) > t);
    if (!live.length) {
      this.act.delete(id);
      return undefined;
    }
    if (live.length !== list.length) this.act.set(id, live);
    let now: Act | undefined;
    for (const a of live) if (a.t0 <= t && (!now || a.t0 >= now.t0)) now = a;
    return now;
  }

  /** A number or a name over a spot: lifted a line clear of those still floating over the same spot, so two moves on
   *  one stack («Гранаты» and «Зов глубин») read one over the other, not on top of each other. */
  private addFloat(f: Float): void {
    const w = this.size.w || 30;
    const line = (f.big ? Math.max(18, w * 0.62) : Math.max(13, w * 0.42)) * Math.max(1, f.size ?? 1);
    const base = f.y;
    const busy = this.floats.filter((o) => !!o.big === !!f.big && Math.abs(o.x - f.x) < w * 1.1 && Math.abs((o.base ?? o.y) - base) < line * 0.8 && Math.abs(o.t0 - f.t0) < (f.big ? 1500 : 1000));
    let k = 0;
    while (busy.some((o) => Math.abs(o.y - (base - k * line)) < line * 0.8)) k++;
    this.floats.push({ ...f, base, y: base - k * line });
  }

  /** One thing that happened, played on the field from `t` (its blow landing at `hit`, performance time): the figures'
   *  lunge and flinch, the struck stack's flash, the numbers over it, the shots in flight, the bursts. */
  private mark(e: TacEvent, v: TacView, was: TacView, t: number, hit = t): void {
    const hexOf = (id?: number) => (id === undefined ? undefined : (v.stacks.find((s) => s.id === id) ?? was.stacks.find((s) => s.id === id))?.hex);
    const at = (hex?: number) => (hex === undefined ? null : this.center(hex));
    const w = this.size.w || 30;
    if (e.k === 'hit' || e.k === 'shot' || e.k === 'ret') {
      const c = at(e.hex ?? hexOf(e.t));
      // The figures: the striker winds up and lunges, at full stretch as the blow lands (a shooter's piece kicks back
      // as it fires); the struck flashes and flinches as it lands.
      const from = at(hexOf(e.s));
      const spill = e.id === 'breath' || e.id === 'chain' || e.id === 'blast';
      if (from && c && e.s !== undefined && !spill) {
        const len = Math.hypot(c.x - from.x, c.y - from.y) || 1;
        this.addAct(e.s, { k: e.k === 'shot' ? 'shot' : 'atk', t0: t, hit, dx: (c.x - from.x) / len, dy: (c.y - from.y) / len });
      }
      if (e.t !== undefined) this.addAct(e.t, { k: 'hurt', t0: hit, hit, dx: from && c ? Math.sign(c.x - from.x) || 1 : 1, dy: 0 });
      if (c) {
        // The numbers as it lands: the harm, the fallen under it in red, and a blow into her side or from behind told
        // over it (owner, 2026-10-08) — on a phone by its share alone (the field carries no words there).
        const y0 = c.y - w * 0.15;
        if (e.kills) this.addFloat({ text: `†${e.kills}`, x: c.x, y: y0, t0: hit, color: '#ff8a6a', size: 1.15 });
        this.addFloat({ text: `−${e.dmg}`, x: c.x, y: y0, t0: hit, color: '#f3d7a0', size: 1.25 });
        if (e.fl) this.addFloat({ text: this.phone ? `+${e.fl === 2 ? 30 : 15}%` : L(e.fl === 2 ? 'fl.rear' : 'fl.side'), x: c.x, y: y0, t0: hit, color: '#ffb54a', size: 0.95 });
      }
      if (e.k === 'shot' && e.id === 'blast') {
        if (c) this.bursts.push({ id: 'part.explosion', x: c.x, y: c.y, t0: hit, size: w * 1.4 });
      } else if (e.k === 'shot') {
        const s = at(hexOf(e.s));
        const shooter = (v.stacks.find((x) => x.id === e.s) ?? was.stacks.find((x) => x.id === e.s))?.unit ?? '';
        const ms = MISSILE_OF[shooter] ?? (isShipBeast(shooter) ? SHIP_BEAST_DEFS[shooter].missile : undefined) ?? 'part.ms_ball';
        const fly = s && c && sprite(ms) ? Math.max(120, hit - t - 80) : 0;
        if (fly) this.missiles.push({ id: ms, x0: s!.x, y0: s!.y - w * 0.55, x1: c!.x, y1: c!.y - w * 0.4, t0: t + 80, dur: fly, arc: THROWN.has(ms) ? Math.hypot(c!.x - s!.x, c!.y - s!.y) * 0.25 : 0 });
        if (s) this.bursts.push({ id: 'part.muzzle', x: s.x + (c && c.x < s.x ? -w * 0.45 : w * 0.45), y: s.y - w * 0.55, t0: t + 40, size: w * 0.9 });
        if (c) this.bursts.push({ id: THROWN.has(ms) && fly ? 'part.explosion' : 'part.smoke', x: c.x, y: c.y - w * 0.3, t0: hit, size: w * (THROWN.has(ms) ? 1.1 : 0.8) });
      } else if (c) this.bursts.push({ id: 'part.splinters', x: c.x, y: c.y, t0: hit, size: w * 0.8 });
    } else if (e.k === 'luck' || e.k === 'morale' || e.k === 'fear') {
      const c = at(hexOf(e.s));
      // On a phone the field carries no words but the spells' (owner, 2026-10-03): a morale or luck roll shows by its light.
      if (c && !this.phone) this.addFloat({ text: e.k === 'fear' ? (e.id === 'still' || e.id === 'mad' ? L(`float.${e.id}`) : e.id ? L('morale') + ' −' : L('fear.float')) : L(e.k === 'luck' ? 'luck' : 'morale') + ' +', x: c.x, y: c.y - w * 0.55, t0: t, color: e.k === 'fear' ? '#d06a5e' : '#e0b862' });
    } else if (e.k === 'poison' || e.k === 'regen') {
      // docs/18 II: the poison in a stack, a creature growing back.
      const c = at(e.hex ?? hexOf(e.s));
      if (c) {
        const word = this.phone ? '' : `${L(e.k === 'poison' ? (e.id === 'sick' ? 'float.sick' : 'float.poison') : e.id === 'mend' ? 'float.mend' : e.id === 'drain' ? 'float.drain' : 'float.regen')} `;
        this.addFloat({ text: e.k === 'poison' ? `${word}−${e.dmg}${e.kills ? ` †${e.kills}` : ''}` : `${word}+${e.dmg}`, x: c.x, y: c.y - w * 0.2, t0: t, color: e.k === 'poison' ? '#9be36a' : '#7fe0b0' });
        this.bursts.push({ id: e.k === 'poison' ? (sprite('fx.bt_poison_0') ? 'fx.bt_poison' : 'part.smoke') : sprite('fx.bt_heal_0') ? 'fx.bt_heal' : 'part.splash', x: c.x, y: c.y, t0: t, size: w * 0.9 });
      }
    } else if (e.k === 'spell') {
      this.heroStep(e.side, t);
      const c = at(e.hex ?? hexOf(e.t));
      if (e.id === 'grenades' && c) {
        this.bursts.push({ id: 'part.explosion', x: c.x, y: c.y, t0: t, size: w * 2.4 });
      } else if (c) this.bursts.push({ id: 'part.muzzle', x: c.x, y: c.y, t0: t, size: w * 1.6 });
      else {
        // A whole-deck order: smoke over her deck, or a ring over one's own (a page over the stacks it fell on).
        const foe = e.side !== v.you;
        const onFoe = e.id === 'smoke_and_knives' || e.id === 'call_of_the_deep' ? !foe : foe;
        const mine = e.on?.length ? v.stacks.filter((s) => e.on!.includes(s.id)) : v.stacks.filter((s) => (s.side === v.you) !== onFoe);
        for (const s of mine) {
          const cc = this.center(s.hex);
          this.bursts.push({ id: e.id === 'call_of_the_deep' ? (sprite('fx.bt_deep_0') ? 'fx.bt_deep' : 'part.splash') : 'part.smoke', x: cc.x, y: cc.y, t0: t + Math.random() * 200, size: w * 1.3 });
        }
      }
      this.addFloat({ text: spName(e.id as TacSpellId), x: this.size.cw / 2, y: this.size.ch * 0.18, t0: t, color: e.side === v.you ? YOU : FOE, big: true });
      // docs/18: a path page's name over every stack it fell on.
      for (const id of (e.on ?? []).slice(0, 7)) {
        const cc = at(hexOf(id));
        if (cc) this.addFloat({ text: spName(e.id as TacSpellId), x: cc.x, y: cc.y - w * 0.62, t0: t + 100, color: '#e0b862' });
      }
    } else if (e.k === 'innate' || e.k === 'ult') {
      // docs/18: the path's move — its light over the stacks it fell on, its name over the field and each of them.
      const ult = e.k === 'ult';
      this.heroStep(e.side, t);
      const on = (e.on ?? []).map((id) => at(hexOf(id))).filter((c): c is { x: number; y: number } => !!c);
      this.pathFx.push({ path: e.id as CaptainId, ult, mine: e.side === v.you, t0: t, at: on });
      this.addFloat({ text: moveName(e.id ?? '', ult), x: this.size.cw / 2, y: this.size.ch * (ult ? 0.3 : 0.18), t0: t, color: e.side === v.you ? YOU : FOE, big: true });
      for (const c of on.slice(0, 7)) this.addFloat({ text: moveName(e.id ?? '', ult), x: c.x, y: c.y - w * 0.62, t0: t + 120, color: ult ? '#ffd27a' : '#e0b862' });
    } else if (e.k === 'boss') {
      // A great one ashore does its own (2026-10-03): its move's name over the field and over each stack it fell on.
      const name = shoreMove(e.id);
      const c0 = at(hexOf(e.s));
      const fx = e.id === 'breath' ? 'part.explosion' : e.id === 'toll' || e.id === 'choir' ? (sprite('fx.bt_deep_0') ? 'fx.bt_deep' : 'part.splash') : 'part.smoke';
      if (c0) this.bursts.push({ id: fx, x: c0.x, y: c0.y, t0: t, size: w * 1.6 });
      if (name) this.addFloat({ text: name, x: this.size.cw / 2, y: this.size.ch * 0.24, t0: t, color: e.side === v.you ? YOU : FOE, big: true });
      for (const id of (e.on ?? []).slice(0, 7)) {
        const cc = at(hexOf(id));
        if (!cc) continue;
        if (name) this.addFloat({ text: name, x: cc.x, y: cc.y - w * 0.62, t0: t + 100, color: '#e07a5e' });
        this.bursts.push({ id: 'part.splinters', x: cc.x, y: cc.y, t0: t + 80, size: w * 0.8 });
      }
    } else if (e.k === 'again') {
      const c = at(hexOf(e.s));
      if (c && !this.phone) this.addFloat({ text: L('float.again'), x: c.x, y: c.y - w * 0.6, t0: t, color: '#9fe0ff' });
    } else if (e.k === 'order') {
      const c = at(hexOf(e.s));
      if (c && !this.phone) this.addFloat({ text: L(`o.${e.id}` as K), x: c.x, y: c.y - w * 0.6, t0: t, color: '#e0b862' });
      // The harpooner's iron lands on her stack.
      if (e.t !== undefined) {
        const tc = at(e.hex ?? hexOf(e.t));
        if (tc) {
          this.addFloat({ text: `−${e.dmg}${e.kills ? ` †${e.kills}` : ''}`, x: tc.x, y: tc.y - w * 0.2, t0: t, color: '#f3d7a0' });
          this.bursts.push({ id: 'part.splinters', x: tc.x, y: tc.y, t0: t, size: w * 0.9 });
        }
      }
    } else if (e.k === 'burn') {
      const c = at(e.hex ?? hexOf(e.s));
      if (c) {
        this.addFloat({ text: `−${e.dmg}${e.kills ? ` †${e.kills}` : ''}`, x: c.x, y: c.y - w * 0.2, t0: t, color: '#ff9a4a' });
        this.bursts.push({ id: sprite('fx.bt_fire_0') ? 'fx.bt_fire' : 'part.explosion', x: c.x, y: c.y - w * 0.2, t0: t, size: w * 0.9 });
      }
    } else if (e.k === 'die') {
      const c = at(e.hex);
      if (c) this.bursts.push({ id: 'part.smoke', x: c.x, y: c.y, t0: t, size: w * 1.2 });
    }
  }

  // ------------------------------------------------------------------ the panels

  /** A side's captain as the field names her: a lair, a drift, a roaming stack or the sea's chest by what it is (docs/18
   *  II, IV; docs/19), a captain by her name. */
  private heroName(v: TacView, x: 0 | 1): string {
    const h = v.heroes[x];
    if (!v.land || x === v.you) return personName(h.name);
    const ru = lang() === 'ru' ? 1 : 0;
    const lair = v.land.lair;
    return LAIRS[lair as LairKind]?.name[ru] ?? (isDriftKind(lair) ? DRIFTS[lair].name[ru] : lair === 'find_chest' ? findTitle('chest') : roamOf(lair) ? roamName(roamOf(lair)!) : isShoreBoss(lair) ? SHORE_BOSSES[lair].name[ru] : h.name);
  }

  /** Her face: a picture of the art (docs/18 II: a lair's creature) or a named captain's portrait. */
  private heroFace(v: TacView, x: 0 | 1): string | null {
    const h = v.heroes[x];
    const url = h.captain ? assetUrl(CAPTAINS[h.captain].portrait) : null;
    // A great one ashore whose own figure is not painted yet shows the figure that stands in for it (2026-10-03).
    const fid = h.face?.startsWith('unit.') && isBossUnit(h.face.slice(5)) && !assetUrl(h.face) ? UNITS[h.face.slice(5) as UnitId].art : h.face;
    return fid ? (fid.includes('.') && !fid.startsWith('portrait.') ? assetUrl(fid) : portraitUrl(fid.replace(/^portrait\./, ''))) ?? url : url;
  }

  /** A side's face in a round frame (owner, 2026-10-07: «аватарки обрезаются у всех»): a captain's portrait as her head
   *  and shoulders (kit/faces.ts), a creature's or a lair's picture whole inside the circle; the frame's ring outside. */
  private faceHtml(v: TacView, x: 0 | 1, cls: string): string {
    const h = v.heroes[x];
    const url = this.heroFace(v, x);
    if (!url) return `<span class="${cls}"></span>`;
    if (/\/portraits\//.test(url)) {
      const id = h.captain && assetUrl(CAPTAINS[h.captain].portrait) === url ? CAPTAINS[h.captain].portrait : url.replace(/^.*\/portraits\/|\.\w+(\?.*)?$/g, '');
      return `<span class="${cls}" ${faceAttrs(id, url)}></span>`;
    }
    return `<span class="${cls} art"><img class="tb-face-img" src="${esc(url)}" alt="" draggable="false" /></span>`;
  }

  /** The order of the round as a row of faces (each opens its stack's card), then the next round's first few. */
  private queue(v: TacView): string {
    const chip = (id: number, next: boolean) => {
      const s = v.stacks.find((x) => x.id === id);
      if (!s) return '';
      return `<button class="tb-q ${s.side === v.you ? 'you' : 'foe'}${id === v.active && !next ? ' on' : ''}${next ? ' next' : ''}" data-info="${s.id}" title="${esc(stackName(s))}" aria-label="${esc(stackName(s))}">${figureArt(s) ? icon(figureArt(s)!, '', 'ico fig') : icon(stackArt(s), '', 'ico')}<b>${s.count}</b></button>`;
    };
    return `${v.order.map((id) => chip(id, false)).join('')}<span class="tb-qsep"></span>${v.next.map((id) => chip(id, true)).join('')}`;
  }

  /** The phone's battle (owner, 2026-10-03: «на телефоне в бою не должно быть ничего кроме игрового поля с существами.
   *  внизу справа книжка кружочек, а слева …»; docs/23 phase 5): the field over the whole screen and round painted buttons
   *  at its edges with no word on them (each says itself in its title and aria-label). Bottom left, three: «Ждать»,
   *  «Защита», «Авто» — a tap on «Авто» (or a long press, sliding to the choice) opens the wheel: «Авто до конца»,
   *  «Быстрый бой», and the fight's own ways out (cut or fall back, the ransom, the colours, each asked once more); with
   *  auto on, a tap takes the helm back. Bottom right, the book: the officer's word, the path's two moves and every page,
   *  big cards on a bottom sheet (while one is aimed, its picture with the cross that lets it go). A step and a blow need
   *  no button: a tap on the field. Top left the face of the stack whose turn it is, with the turn's clock (a tap opens the
   *  round); top right «×2». */
  private padDom(v: TacView): void {
    const pad = this.el!.querySelector<HTMLElement>('.tb-pad')!;
    if (!this.phone) {
      if (pad.childElementCount) pad.innerHTML = '';
      return;
    }
    const me = v.heroes[v.you];
    const act = v.stacks.find((s) => s.id === v.active);
    const rb = (data: string, label: string, art: string, cls = '', off = false): string =>
      `<button class="tb-rb${cls}" ${data} title="${esc(label)}" aria-label="${esc(label)}"${off ? ' disabled' : ''}>${art}</button>`;
    const officer = v.mine && act?.officer?.ready ? act.officer : null;
    const pathReady = v.mine && !!me.path && (me.innate === 'ready' || (me.ult === 'ready' && v.round >= ULT_ROUND));
    // From the corner up: wait under the thumb, then defend, then auto (its wheel).
    const left = [
      rb('data-a="wait"', L('wait'), btIcon('bt_wait', 'icon.bt_hold', 'ico'), '', !v.mine || !!act?.waited),
      rb('data-a="defend"', L('defend'), btIcon('bt_defend', 'icon.mod_hull_plating', 'ico'), '', !v.mine),
      rb('data-autow', me.auto ? L('autoOff') : L('autoMenu'), btIcon('bt_auto', 'icon.bt_captain', 'ico'), me.auto ? ' on' : '', !!v.over),
    ].join('');
    const t = this.targeting;
    const aimed = !t ? '' : t === 'innate' || t === 'ult' ? (me.path ? icon(`icon.${(t === 'innate' ? INNATE : ULTIMATE)[me.path].icon}`, '', 'ico') : '') : spIcon(t);
    const hasBook = me.spells.length > 0 || !!me.path || !!act?.officer;
    // A gold bead on the book when the officer's word or a path move is ready to be given.
    const bead = officer || pathReady ? '<i class="tb-bead" aria-hidden="true"></i>' : '';
    const book = t
      ? rb('data-cancel', `${L('cancel')}: ${t === 'innate' || t === 'ult' ? (me.path ? moveName(me.path, t === 'ult') : '') : spName(t)}`, `${aimed}<i class="tb-x"></i>`, ' book aim')
      : hasBook ? rb('data-book', L('book'), `${btIcon('bt_book', 'icon.bt_captain', 'ico')}${bead}`, ` book${this.sheetKind === 'book' ? ' on' : ''}`) : '';
    // The turn's face, and the round behind it.
    const whose = v.over ? '' : v.mine ? L('yourTurn') : act && act.side === v.you ? L('autoTurn') : L('theirTurn');
    const face = act ? (figureArt(act) ? icon(figureArt(act)!, '', 'ico fig') : icon(stackArt(act), '', 'ico')) : '';
    void face;
    // The two captains side by side at the top (owner, 2026-10-07: «аватарки… надо чтобы они были рядом сверху»): hers
    // in the top left corner, the foe's in the top right, each her face and her men; the side whose turn it is wears
    // the turn's clock as its ring (gold while it is hers). A tap on either opens the round.
    const chip = (x: 0 | 1) => {
      const h = v.heroes[x], mine = x === v.you, theirs = !v.over && !!act && act.side === x;
      const who = this.heroName(v, x);
      return `<button class="tb-chip ${mine ? 'you' : 'foe'}${theirs ? ' turn' : ''}${theirs && v.mine ? ' mine' : ''}${this.sheetOpen ? ' on' : ''}" data-sheet title="${esc(`${who} · ${L('men', { n: h.men ?? 0, m: h.menStart ?? 0 })}${theirs ? ` · ${L('round', { n: v.round })} · ${whose}` : ''}`)}" aria-label="${esc(`${who}: ${L('order.label')}`)}" aria-expanded="${this.sheetOpen}">${this.faceHtml(v, x, 'tb-chip-face')}<b class="tb-chip-men">${h.men ?? 0}</b></button>`;
    };
    const turn = chip(v.you) + chip((1 - v.you) as 0 | 1);
    const fast = settings().tacFast;
    const x2 = `<button class="tb-rb tb-fast${fast ? ' on' : ''}" data-fast aria-pressed="${fast}" title="${esc(fast ? L('fastOff') : L('fast'))}" aria-label="${esc(L('fast'))}"><i class="tb-x2" aria-hidden="true">×2</i></button>`;
    const pip = (n: number, up: string, down: string, k: K) => `<span class="tb-shp${n > 0 ? ' up' : n < 0 ? ' down' : ''}" title="${esc(L(k))}">${btIcon(n < 0 ? down : up, '', 'ico-xs')}${n > 0 ? `+${n}` : n}</span>`;
    const captain = (x: 0 | 1) => {
      const h = v.heroes[x], f = this.heroFace(v, x);
      void f;
      return `<div class="tb-shh ${x === v.you ? 'you' : 'foe'}">${this.faceHtml(v, x, 'tb-shf')}<b>${esc(this.heroName(v, x))}</b><span class="tb-shp" title="${esc(L('men', { n: h.men, m: h.menStart }))}">${icon('icon.stat_crew', '', 'ico-xs')}${h.men}/${h.menStart}</span>${pip(h.morale, 'st_morale_up', 'st_morale_down', 'morale')}${pip(h.luck, 'st_luck_up', 'st_luck_down', 'luck')}</div>`;
    };
    const words = v.log.filter((e) => e.k !== 'move').slice(-3).map((e) => this.words(e, v)).filter(Boolean);
    const sheet = this.sheetOpen && !v.over
      ? `<div class="tb-sheet" role="dialog" aria-label="${esc(L('order.label'))}"><div class="tb-sh-r"><b>${esc(L('round', { n: v.round }))}</b><em>${esc(whose)}</em></div>${captain(v.you)}${captain((1 - v.you) as 0 | 1)}<div class="tb-sh-q">${this.queue(v)}</div>${words.length ? `<div class="tb-sh-feed">${words.map((w) => `<div>${esc(w)}</div>`).join('')}</div>` : ''}</div>`
      : '';
    pad.className = `tb-pad${v.over ? ' over' : ''}`;
    pad.innerHTML = `${turn}${sheet}<div class="tb-pl">${left}</div><div class="tb-pr">${book}${x2}</div>`;
    const again = () => {
      this.key = '';
      if (this.view) this.dom(this.view);
    };
    pad.querySelectorAll<HTMLElement>('[data-sheet]').forEach((b) => (b.onclick = () => {
      this.sheetOpen = !this.sheetOpen;
      if (this.sheetOpen) this.showInfo(null);
      again();
    }));
    pad.querySelector<HTMLElement>('[data-fast]')!.onclick = () => this.setFast(!settings().tacFast);
    const cancel = pad.querySelector<HTMLElement>('[data-cancel]');
    if (cancel) cancel.onclick = () => {
      this.targeting = this.preview = null;
      again();
    };
    pad.querySelectorAll<HTMLElement>('.tb-q').forEach((b) => (b.onclick = () => {
      this.sheetOpen = false;
      again();
      this.showInfo(Number(b.dataset.info));
    }));
    // «Авто»: a tap opens the wheel round the button (or takes the helm back while auto is on); a long press opens it
    // under the finger, to slide to the choice and let go (ui/kit/radial.ts).
    const auto = pad.querySelector<HTMLElement>('[data-autow]');
    if (auto && !v.over) {
      attachWheel(auto, {
        title: L('autoMenu'),
        options: () => this.autoOptions(),
        onPick: (o) => this.autoPick(o.id),
        onTap: () => {
          const now = this.view;
          if (!now) return;
          if (now.heroes[now.you].auto) this.order({ a: 'auto', on: false });
          else this.tapWheel(auto);
        },
      });
    }
  }

  /** «Ускорить ×2» on or off: the server's breath over the sea's turns, and the walks here (docs/23 item 60). */
  private setFast(on: boolean): void {
    updateSettings({ tacFast: on });
    if (this.view && !this.view.over) this.order({ a: 'pace', fast: on });
    this.key = '';
    if (this.view) this.dom(this.view);
  }

  /** The wheel of «Авто» (docs/23 item 61): to the end, a quick fight, and the fight's own ways out. */
  private autoOptions(): WheelOption[] {
    const v = this.view;
    if (!v) return [];
    const art = (id: string, fb: string) => (assetUrl(`icon.${id}`) ? `icon.${id}` : fb);
    const out: WheelOption[] = [
      { id: 'auto', label: L('autoEnd'), icon: art('bt_auto', 'icon.bt_captain') },
      { id: 'quick', label: L('quick'), icon: art('bt_quick', 'icon.bt_charge') },
    ];
    if (v.canCut) out.push({ id: 'cut', label: v.you === 0 ? L('fallBack') : L('cut'), icon: art('bt_retreat', 'icon.bt_colours') });
    if (v.ransom) {
      const short = this.purse() < v.ransom;
      out.push({ id: 'ransom', label: short ? L('ransomShort', { n: v.ransom }) : L('ransom', { n: v.ransom }), icon: art('bt_ransom', 'icon.coin'), disabled: short });
    }
    if (v.canStrike) out.push({ id: 'surrender', label: L('strike'), icon: art('bt_strike', 'icon.bt_colours') });
    return out;
  }

  private autoPick(id: string): void {
    const v = this.view;
    if (!v || v.over) return;
    if (id === 'auto') return this.order({ a: 'auto', on: true });
    if (id === 'quick') return this.order({ a: 'quick' });
    // The ways out are asked once more (a sheet with the verb and «Отменить»).
    const q = id === 'cut' ? L(v.you === 0 ? 'fallBackQ' : 'cutQ') : id === 'ransom' ? L('ransomQ', { n: v.ransom ?? 0 }) : L('strikeQ');
    const yes = id === 'cut' ? (v.you === 0 ? L('fallBack') : L('cut')) : id === 'ransom' ? L('ransom', { n: v.ransom ?? 0 }) : L('strike');
    void ask(q, yes, L('cancel')).then((ok) => {
      if (!ok || !this.view || this.view.over) return;
      if (id === 'cut') this.send({ t: 'board_cut' });
      else this.order({ a: id === 'ransom' ? 'ransom' : 'surrender' });
    });
  }

  /** The wheel opened by a tap (no finger to slide): round the button; a tap on a choice takes it, elsewhere puts it
   *  away (so does Esc). */
  private tapWheel(btn: HTMLElement): void {
    const r = btn.getBoundingClientRect();
    // Opened toward the field, clear of the corner's own buttons (the wheel keeps itself on screen).
    const inward = r.left + r.width / 2 < innerWidth / 2 ? 1 : -1;
    wheel.open(r.left + r.width / 2 + inward * (r.width / 2 + 130), r.top + r.height / 2, this.autoOptions(), L('autoMenu'));
    btn.classList.add('k-wheel-src');
    const done = (e: PointerEvent | null) => {
      removeEventListener('pointerdown', pick, true);
      removeEventListener('keydown', key, true);
      btn.classList.remove('k-wheel-src');
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        // The choice under the finger (by its circle), not merely the nearest by angle.
        const items = [...document.querySelectorAll<HTMLElement>('.k-wheel-item')];
        wheel.select(items.findIndex((it) => {
          const b = it.getBoundingClientRect();
          return Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)) <= b.width * 0.75;
        }));
      }
      const o = wheel.close(!!e);
      if (o && !o.disabled) this.autoPick(o.id);
    };
    const pick = (e: PointerEvent) => done(e);
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      done(null);
    };
    // The tap that opened it is still going up: listen from the next one.
    setTimeout(() => {
      addEventListener('pointerdown', pick, true);
      addEventListener('keydown', key, true);
    }, 0);
  }

  private dom(v: TacView): void {
    const el = this.el!;
    // The fight over, the book is put away (it stood over the reckoning on a desk).
    if (v.over) this.bookOpen = false;
    const act = v.stacks.find((s) => s.id === v.active);
    const key = JSON.stringify([v.round, v.active, v.mine, v.heroes, v.order, v.over, v.log.slice(-3).map((e) => e.i), this.targeting, this.bookOpen, this.bookTab, this.bookPage, this.strikeArmed > performance.now(), this.ransomArmed > performance.now(), v.stacks.map((s) => [s.id, s.count, s.shots]), v.canCut, v.canStrike, v.ransom, v.result, this.phone, this.tall, this.moreOpen, this.sheetOpen, this.sheetKind, settings().tacFast, this.endHidden, this.foeArmed]);
    if (key === this.key) return;
    this.key = key;
    const hero = (x: 0 | 1) => {
      const h = v.heroes[x];
      const pips = (n: number, cls: string) => `<span class="tb-pip ${cls}${n > 0 ? ' up' : n < 0 ? ' down' : ''}" title="${esc(L(cls === 'm' ? 'morale' : 'luck'))}">${cls === 'm' ? '⚑' : '✦'}${n > 0 ? `+${n}` : n}</span>`;
      const mine = x === v.you;
      // The hero beside the field (docs/17 H2): her four primaries and her will.
      const prim = h.prim ? `<span class="tb-prims">${PRIMS.map((p) => `<span class="tb-prim" title="${esc(PRIM_NAMES[p][lang() === 'ru' ? 1 : 0])}">${icon(PRIM_ICON[p], '', 'ico-xs')}${p === 'will' ? `${h.mana ?? 0}/${h.manaMax ?? 0}` : h.prim![p]}</span>`).join('')}${h.stam !== undefined ? `<span class="tb-prim tb-stamv" title="${esc(L('stam'))}">${icon('tree_survival', '', 'ico-xs')}${h.stam}/${h.stamMax ?? 0}</span>` : ''}</span>` : '';
      // docs/18: her path, and her innate move and ultimate (spent or not) — on her side of the field too.
      const moves = h.path && h.innate ? `<span class="tb-moves">${icon(INNATE[h.path].icon, '', `ico-xs tb-mv${h.innate === 'used' ? ' off' : ''}`)}${h.ult !== 'locked' ? icon(ULTIMATE[h.path].icon, '', `ico-xs tb-mv ult${h.ult === 'used' ? ' off' : ''}`) : ''}<i>${esc(CAPTAINS[h.path].archetype)}</i></span>` : '';
      return `${this.faceHtml(v, x, 'tb-face')}
        <div class="tb-who"><b>${esc(this.heroName(v, x))}</b><small>${esc(v.land && !mine && (isDriftKind(v.land.lair) || v.land.lair === 'find_chest' || roamOf(v.land.lair)) ? '' : placeName(h.ship))}</small>${prim}${moves}<span class="tb-pips"><span class="tb-pip tb-men">${esc(L('men', { n: h.men ?? 0, m: h.menStart ?? 0 }))}</span>${pips(h.morale, 'm')}${pips(h.luck, 'l')}${h.auto && mine ? `<span class="tb-auto">${esc(L('autoTurn'))}</span>` : ''}</span></div>`;
    };
    el.querySelector('.tb-hero.you')!.innerHTML = hero(v.you);
    el.querySelector('.tb-hero.foe')!.innerHTML = hero((1 - v.you) as 0 | 1);
    const turn = v.over ? '' : v.mine ? L('yourTurn') : act && act.side === v.you ? L('autoTurn') : L('theirTurn');
    el.querySelector('.tb-mid')!.innerHTML = `<div class="tb-round">${esc(L('round', { n: v.round }))}</div><div class="tb-turn${v.mine ? ' mine' : ''}">${act ? `<span class="tb-dot ${act.side === v.you ? 'you' : 'foe'}"></span>` : ''}${esc(turn)} <em class="tb-secs"></em></div><div class="tb-timer"><i></i></div>`;
    // The order of the round, then the next round's first few.
    el.querySelector('.tb-queue')!.innerHTML = this.queue(v);
    el.querySelectorAll<HTMLElement>('.tb-q').forEach((b) => (b.onclick = () => this.showInfo(Number(b.dataset.info))));
    // The feed: the last three things, in words.
    const words = v.log.filter((e) => e.k !== 'move').slice(-3).map((e) => this.words(e, v)).filter(Boolean);
    el.querySelector('.tb-lines')!.innerHTML = words.map((w, i) => `<div class="${i === words.length - 1 ? 'new' : ''}">${esc(w)}</div>`).join('');
    // The captain's orders.
    const me = v.heroes[v.you];
    // The book's pages (docs/17 H2): each order's will beside it; the will left on the book's spine.
    // docs/18: her two stores side by side — Will for the magical pages and the common orders, Stamina for the
    // physical moves (it comes back a share every round).
    const bar = (cls: string, ico: string, k: K, n: number, m: number) => `<div class="tb-store ${cls}" title="${esc(L(k))}">${icon(ico, '', 'ico-xs')}<span class="tb-rbar"><i style="width:${m ? Math.round(Math.max(0, Math.min(1, n / m)) * 100) : 0}%"></i></span><b>${n}</b><small>/${m}</small></div>`;
    const will = me.mana !== undefined
      ? `<div class="tb-will">${bar('will', 'icon.ab_brine_mend', 'will', me.mana, me.manaMax ?? 0)}${me.stam !== undefined ? bar('stam', 'icon.tree_survival', 'stam', me.stam, me.stamMax ?? 0) : ''}</div>`
      : '';
    const page = (sp: (typeof me.spells)[number]) => {
      const wait = Math.max(0, sp.ready - v.round);
      const pool = sp.res === 'stam' ? me.stam : me.mana;
      const poor = sp.cost !== undefined && pool !== undefined && pool < sp.cost;
      const off = !v.mine || me.cast || wait > 0 || poor;
      const cost = sp.scroll ? ` <em class="tb-cost scroll">${esc(L('scroll', { n: sp.scroll }))}</em>` : sp.cost !== undefined ? ` <em class="tb-cost${sp.res === 'stam' ? ' stam' : ''}">${sp.cost}</em>` : '';
      return `<button class="btn tb-spell${this.targeting === sp.id ? ' on' : ''}${poor ? ' poor' : ''}${sp.scroll ? ' scroll' : ''}" data-spell="${sp.id}" ${off ? 'disabled' : ''} title="${esc(spText(sp.id))}">${spIcon(sp.id)}<span><b>${esc(spName(sp.id))}${cost}</b><small>${wait > 0 ? esc(L('ready.in', { n: wait })) : poor ? esc(L(sp.res === 'stam' ? 'noStam' : 'noWill')) : esc(spText(sp.id))}</small></span></button>`;
    };
    // docs/18: her path's innate move and ultimate, each once a battle and free, beside the round's order.
    const move = (kind: 'innate' | 'ult') => {
      const st = kind === 'innate' ? me.innate : me.ult;
      if (!me.path || !st) return '';
      const mv = (kind === 'innate' ? INNATE : ULTIMATE)[me.path];
      const early = kind === 'ult' && v.round < ULT_ROUND;
      const off = !v.mine || st !== 'ready' || early;
      const note = st === 'locked' ? L('ultLocked') : st === 'used' ? L('used') : early ? L('ultRound') : L('free');
      return `<button class="btn tb-spell tb-move ${kind}${this.targeting === kind ? ' on' : ''}${st !== 'ready' ? ' spent' : ''}" data-move="${kind}" ${off ? 'disabled' : ''} title="${esc(moveText(me.path, kind === 'ult'))}">${icon(`icon.${mv.icon}`, '', 'ico')}<span><b>${esc(L(kind))}: ${esc(moveName(me.path, kind === 'ult'))}</b><small>${esc(note)}</small></span></button>`;
    };
    // Four pages on the panel (keys 1–4); the rest in the book, opened over the field as in HoMM3. A phone has no panel:
    // every page is in the book, opened by its round button.
    const more = me.spells.length > 4 || (this.phone && me.spells.length > 0);
    el.querySelector('.tb-spells')!.innerHTML = will + move('innate') + move('ult') + me.spells.slice(0, 4).map(page).join('') + (more ? `<button class="btn tb-bookbtn${this.bookOpen ? ' on' : ''}" data-book>${btIcon('bt_book', 'icon.bt_captain', 'ico')}<span><b>${esc(L('book'))}</b><small>${esc(L('book.n', { n: me.spells.length }))}</small></span></button>` : '');
    // The book over the field, as HoMM3's: two facing pages, a bookmark for each school she has pages of, the corners
    // to turn; painted when its picture is (bg.spellbook), parchment until then.
    const book = el.querySelector<HTMLElement>('.tb-book')!;
    book.classList.toggle('hidden', !(more && this.bookOpen));
    book.innerHTML = '';
    if (more && this.bookOpen) {
      const ru = lang() === 'ru' ? 1 : 0;
      // Over the whole battle, as large as the screen lets a 16:9 book be (a phone's field alone is too small for it). A
      // phone held upright has no room for the spread: one tall page of parchment, eight orders to it, its words as
      // large as on a phone on its side (--bk-w sets the book's type as well as its size).
      const tall = this.tall;
      const w = tall ? 720 : Math.max(240, Math.min(1100, innerWidth * 0.96, innerHeight * 0.94 * 16 / 9));
      // Six orders to a page only in a large book: in a phone's (≈600 px) three rows squeezed a two-line name's picture
      // to a strip (QA, 2026-10-04), so four to a page there.
      const per = tall ? 8 : w < 720 ? 4 : 6;
      const leaves = tall ? 1 : 2;
      const all = [...me.spells].sort((a, b) => SCHOOLS.indexOf(ORDERS[a.id]?.school as School) - SCHOOLS.indexOf(ORDERS[b.id]?.school as School) || (ORDERS[a.id]?.level ?? 0) - (ORDERS[b.id]?.level ?? 0));
      const schools = SCHOOLS.filter((sc) => all.some((sp) => ORDERS[sp.id]?.school === sc));
      const tab = this.bookTab !== 'all' && schools.includes(this.bookTab) ? this.bookTab : 'all';
      const list = tab === 'all' ? all : all.filter((sp) => ORDERS[sp.id]?.school === tab);
      const spreads = Math.max(1, Math.ceil(list.length / (per * leaves)));
      const at = Math.min(this.bookPage, spreads - 1);
      const side = (k: 0 | 1) => list.slice((at * leaves + k) * per, (at * leaves + k + 1) * per);
      const entry = (sp: (typeof me.spells)[number]) => {
        const wait = Math.max(0, sp.ready - v.round);
        const pool = sp.res === 'stam' ? me.stam : me.mana;
        const poor = sp.cost !== undefined && pool !== undefined && pool < sp.cost;
        const off = !v.mine || me.cast || wait > 0 || poor;
        const note = wait > 0 ? esc(L('ready.in', { n: wait })) : sp.scroll ? esc(L('scroll', { n: sp.scroll })) : sp.cost !== undefined ? `${icon(sp.res === 'stam' ? 'icon.tree_survival' : 'icon.ab_brine_mend', '', 'ico-xs')}${sp.cost}` : '';
        return `<button class="bk-sp${this.targeting === sp.id ? ' on' : ''}${poor ? ' poor' : ''}" data-spell="${sp.id}" ${off ? 'disabled' : ''} title="${esc(`${spName(sp.id)} — ${spText(sp.id)}`)}">${spIcon(sp.id, 'bk-ico')}<b>${esc(spName(sp.id))}</b><small>${note}</small></button>`;
      };
      const tabBtn = (id: School | 'all', ico: string, name: string) => `<button class="bk-tab${tab === id ? ' on' : ''}" data-booktab="${id}" title="${esc(name)}" aria-label="${esc(name)}">${ico}</button>`;
      const art = tall ? null : assetUrl('bg.spellbook');
      book.className = `tb-book bk${art ? ' painted' : ''}${tall ? ' tall' : ''}`;
      book.style.setProperty('--bk-w', `${Math.round(w)}px`);
      book.style.setProperty('--bk-rows', String(per / 2));
      book.style.backgroundImage = art ? `url('${art}')` : '';
      const head = `<h4>${esc(tab === 'all' ? L('book') : SCHOOL_NAMES[tab][ru])}</h4>`;
      book.innerHTML = (tall
        ? `<div class="bk-page l">${head}<div class="bk-will">${will}</div><div class="bk-grid">${side(0).map(entry).join('')}</div><i class="bk-no">${at + 1}</i></div>`
        : `<div class="bk-page l">${head}<div class="bk-grid">${side(0).map(entry).join('')}</div><i class="bk-no">${at * 2 + 1}</i></div>
        <div class="bk-page r"><div class="bk-will">${will}</div><div class="bk-grid">${side(1).map(entry).join('')}</div><i class="bk-no">${at * 2 + 2}</i></div>`) + `
        <div class="bk-tabs">${tabBtn('all', btIcon('bt_book', 'icon.bt_captain', 'ico'), L('book'))}${schools.map((sc) => tabBtn(sc, btIcon(BOOK_TAB[sc], `icon.${SCHOOL_ICON[sc]}`, 'ico'), SCHOOL_NAMES[sc][ru])).join('')}</div>
        <button class="bk-turn prev" data-bookpg="-1" ${at === 0 ? 'disabled' : ''} aria-label="‹">‹</button><button class="bk-turn next" data-bookpg="1" ${at >= spreads - 1 ? 'disabled' : ''} aria-label="›">›</button>
        <button class="bk-close" data-bookclose title="${esc(L('close'))}" aria-label="${esc(L('close'))}">✕</button>`;
      book.querySelectorAll<HTMLElement>('[data-booktab]').forEach((b) => (b.onclick = () => {
        this.bookTab = b.dataset.booktab as School | 'all';
        this.bookPage = 0;
        this.key = '';
        this.dom(v);
      }));
      book.querySelectorAll<HTMLElement>('[data-bookpg]').forEach((b) => (b.onclick = () => {
        this.bookPage = Math.max(0, Math.min(spreads - 1, at + Number(b.dataset.bookpg)));
        this.key = '';
        this.dom(v);
      }));
    }
    // The phone's round buttons (before the bindings below, which are theirs too).
    this.padDom(v);
    el.querySelectorAll<HTMLElement>('[data-spell]').forEach((b) => (b.onclick = () => {
      this.bookOpen = false;
      this.spell(b.dataset.spell as TacSpellId);
    }));
    el.querySelectorAll<HTMLElement>('[data-move]').forEach((b) => (b.onclick = () => this.move2(b.dataset.move as 'innate' | 'ult')));
    el.querySelectorAll<HTMLElement>('[data-book]').forEach((b) => (b.onclick = () => {
      // A phone's book is the kit's bottom sheet of cards (docs/23 item 62).
      if (this.phone) return this.openBook(v);
      this.bookOpen = !this.bookOpen;
      this.moreOpen = this.sheetOpen = false;
      if (this.bookOpen) this.showInfo(null);
      this.key = '';
      this.dom(v);
    }));
    el.querySelectorAll<HTMLElement>('[data-bookclose]').forEach((b) => (b.onclick = () => {
      this.bookOpen = false;
      this.key = '';
      this.dom(v);
    }));
    // The stack's own orders and the fight's.
    const officer = v.mine && act?.officer?.ready ? act.officer : null;
    const armed = this.strikeArmed > performance.now();
    // Each its painted icon and its word; a phone on its side shows the icons alone (the word in its title), and the
    // word again on one armed for a second tap.
    const lab = (t: string, tip?: string): string => `title="${esc(tip ?? t)}" aria-label="${esc(t)}"`;
    const word = (t: string): string => `<span class="tb-al">${esc(t)}</span>`;
    const auto = me.auto ? L('autoOff') : L('auto');
    const cut = v.you === 0 ? L('fallBack') : L('cut');
    const ransomOn = this.ransomArmed > performance.now();
    const poor = !!v.ransom && this.purse() < v.ransom;
    const ransom = v.ransom ? (poor ? L('ransomShort', { n: v.ransom }) : ransomOn ? L('ransomSure', { n: v.ransom }) : L('ransom', { n: v.ransom })) : '';
    const strike = armed ? L('strikeSure') : L('strike');
    el.querySelector('.tb-acts')!.innerHTML = [
      `<button class="btn" data-a="wait" ${lab(L('wait'))} ${!v.mine || act?.waited ? 'disabled' : ''}>${btIcon('bt_wait', 'icon.bt_hold')}${word(L('wait'))}</button>`,
      `<button class="btn" data-a="defend" ${lab(L('defend'))} ${!v.mine ? 'disabled' : ''}>${btIcon('bt_defend', 'icon.mod_hull_plating')}${word(L('defend'))}</button>`,
      officer ? `<button class="btn btn-primary" data-a="order" ${lab(L(`o.${officer.order}` as K), L(`od.${officer.order}` as K))}>${icon(`icon.role_${officer.role}`, '', 'ico-sm')}${word(L(`o.${officer.order}` as K))}</button>` : '',
      `<button class="btn${me.auto ? ' on' : ''}" data-a="auto" ${lab(auto)}>${btIcon('bt_auto', '')}${word(auto)}</button>`,
      `<button class="btn" data-a="quick" ${lab(L('quick'))} ${v.over ? 'disabled' : ''}>${btIcon('bt_quick', '')}${word(L('quick'))}</button>`,
      v.canCut && !v.over ? `<button class="btn btn-danger" data-a="cut" ${lab(cut)}>${btIcon('bt_retreat', '')}${word(cut)}</button>` : '',
      v.ransom && !v.over ? `<button class="btn${ransomOn ? ' on armed' : ''}" data-a="ransom" ${lab(ransom, L('ransomTip'))}${poor ? ' disabled' : ''}>${btIcon('bt_ransom', 'icon.coin')}${word(ransom)}</button>` : '',
      v.canStrike && !v.over ? `<button class="btn btn-danger${armed ? ' on armed' : ''}" data-a="surrender" ${lab(strike)}>${btIcon('bt_strike', '')}${word(strike)}</button>` : '',
    ].join('');
    el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.a!;
      // On a phone the «…» closes once its order is given; the ransom and the colours stay open for the second tap.
      const asks = (a === 'ransom' && this.ransomArmed <= performance.now()) || (a === 'surrender' && this.strikeArmed <= performance.now());
      if (this.moreOpen && !asks) {
        this.moreOpen = false;
        this.key = '';
      }
      this.button(a);
      if (!this.key && this.view) this.dom(this.view);
    }));
    // The end (docs/23 item 63): one screen — won or lost and why, three rows (your losses, hers, the spoils), the
    // beaten who would follow her when they would, and one button.
    const banner = el.querySelector<HTMLElement>('.tb-banner')!;
    banner.classList.toggle('hidden', !v.over || this.endHidden);
    if (v.over) {
      const won = v.over.winner === v.you;
      const why = v.over.why === 'rout' ? (won ? 'why.rout' : 'why.routLost') : v.over.why === 'struck' ? (won ? 'why.struck' : 'why.struckYou') : v.over.why === 'ransom' ? (won ? 'why.ransomThem' : 'why.ransomYou') : 'why.rounds';
      // docs/18 II: ashore, the lair is broken, or the party thrown back or fallen back to the boats.
      const whyText = v.land && isShoreBoss(v.land.lair) ? BL(won ? 'why.won' : v.over.why === 'struck' ? 'why.retreat' : 'why.lost') : roamOf(v.land?.lair) ? RL(won ? 'why.won' : v.over.why === 'struck' ? 'why.retreat' : 'why.lost') : v.land?.lair === 'find_chest' ? FL(won ? 'why.chest' : v.over.why === 'struck' ? 'why.chestBack' : 'why.chestLost') : v.land && isDriftKind(v.land.lair) ? DL(won ? 'why.won' : v.over.why === 'struck' ? 'why.retreat' : 'why.lost') : v.land ? LL(won ? 'why.won' : v.over.why === 'struck' ? 'why.retreat' : 'why.lost') : L(why as K);
      const r = v.result;
      const none = `<em class="muted">${esc(L('res.none'))}</em>`;
      const faces = (xs: { u: UnitId; n: number }[]) => xs.length ? xs.map((x) => `<span class="tb-rs" title="${esc(unitName(x.u))}">${unitIcon(x.u, 'tb-rs-ico')}<i>−${x.n}</i></span>`).join('') : none;
      const loot = r?.loot ? lootParts(r.loot) : null;
      const spoils = [
        ...(r?.xp ? [`<span class="tb-lc" title="${esc(L('res.xp', { n: r.xp }))}">${icon('icon.xp', '', 'ico-sm')}+${r.xp}</span>`] : []),
        ...(r?.paid ? [`<span class="tb-lc bad" title="${esc(L('res.paid', { n: r.paid }))}">${icon('icon.coin', '', 'ico-sm')}−${r.paid}</span>`] : []),
        ...(loot?.chips ?? []),
        ...(loot?.lines ?? []).map((x) => `<span class="tb-lc tb-lw">${x}</span>`),
      ];
      const rows = r
        ? `<div class="tb-end-rows"><div class="tb-er"><small>${esc(L('res.lost'))}</small><div class="tb-rs-row">${faces(r.lost)}</div></div><div class="tb-er"><small>${esc(L('res.killed'))}</small><div class="tb-rs-row">${faces(r.killed)}</div></div><div class="tb-er"><small>${esc(L('res.loot'))}</small><div class="tb-lchips">${spoils.length ? spoils.join('') : none}</div></div></div>`
        : '';
      banner.className = `tb-banner tb-end ${won ? 'won' : 'lost'}${v.land ? ' land' : ' sea'}${r ? ' tb-result' : ''}`;
      banner.innerHTML = `<div class="tb-bsc"><b>${esc(L(won ? 'won' : 'lost'))}</b><span class="tb-why">${esc(whyText)}</span>${r?.loot?.capture ? captureBlock(r.loot.capture) : ''}${rows}</div><button class="k-btn k-btn--primary k-btn--lg tb-endbtn" data-endbtn>${esc(v.land ? LL('close') : L('next'))}</button>`;
      banner.querySelector<HTMLElement>('[data-endbtn]')!.addEventListener('click', () => {
        if (v.land) this.send({ t: 'lair', action: 'close' });
        else {
          // A battle at sea closes itself a moment later: the button puts the reckoning away now.
          this.endHidden = true;
          banner.classList.add('hidden');
        }
      });
      banner.querySelectorAll<HTMLElement>('[data-cap]').forEach((b) => (b.onclick = () => this.send({ t: 'drift', action: 'capture', choice: b.dataset.cap as 'take' })));
    }
    // The phone's book follows the battle while it is open (the will spent, a page ready again).
    if (this.sheetKind === 'book' && this.sheetH?.open) {
      if (v.over) this.closeSheet();
      else this.sheetH.body.innerHTML = this.bookHtml(v);
    }
    this.hint(v);
    if (this.info !== null) this.showInfo(this.info);
  }

  private words(e: TacEvent, v: TacView): string {
    const name = (id?: number) => (id !== undefined ? this.names.get(id) : undefined) ?? '…';
    switch (e.k) {
      case 'hit':
      case 'shot':
      case 'ret':
        return L(e.id === 'volley' ? 'log.volley' : e.id === 'mad' ? 'log.mad' : `log.${e.k}`, { a: name(e.s), b: name(e.t), dmg: e.dmg ?? 0, kills: e.kills ?? 0 });
      case 'die':
        return L('log.die', { a: name(e.s) });
      case 'spell':
        return L(e.via === 'scroll' ? 'log.scroll' : 'log.spell', { side: L(e.side === v.you ? 'side.you' : 'side.foe'), name: spName(e.id as TacSpellId), kills: e.kills ?? 0 });
      case 'innate':
      case 'ult':
        return L(e.k === 'ult' ? 'log.ult' : 'log.innate', { side: L(e.side === v.you ? 'side.you' : 'side.foe'), name: moveName(e.id ?? '', e.k === 'ult'), kills: e.kills ?? 0 });
      case 'again':
        return L('log.again', { a: name(e.s) });
      case 'boss': {
        const who = (e.on ?? []).map((id) => name(id)).join(', ');
        return who ? BL('log.boss', { move: shoreMove(e.id), who }) : BL('log.bossAlone', { move: shoreMove(e.id) });
      }
      case 'order':
        return e.id === 'harpoon' && e.t !== undefined ? L('log.harpoon', { a: name(e.s), b: name(e.t), dmg: e.dmg ?? 0, kills: e.kills ?? 0 }) : L('log.order', { a: name(e.s), name: L(`o.${e.id}` as K) });
      case 'round':
        return L('log.round', { n: e.n ?? 0 });
      case 'burn':
        return L('log.burn', { a: name(e.s), dmg: e.dmg ?? 0, kills: e.kills ?? 0 });
      case 'fear':
        return L(e.id === 'terror' ? 'log.terror' : e.id === 'dread' ? 'log.dread' : e.id === 'still' ? 'log.still' : e.id === 'mad' ? 'log.lost' : 'log.fear', { a: name(e.s) });
      case 'poison':
      case 'regen':
        return L(e.k === 'poison' && e.id === 'sick' ? 'log.sick' : e.k === 'regen' && (e.id === 'mend' || e.id === 'drain') ? `log.${e.id}` : `log.${e.k}`, { a: name(e.s), dmg: e.dmg ?? 0, kills: e.kills ?? 0 });
      case 'wait':
      case 'defend':
      case 'morale':
      case 'luck':
      case 'timeout':
        return L(`log.${e.k}`, { a: name(e.s) });
      default:
        return '';
    }
  }

  private hint(v: TacView): void {
    const h = this.el!.querySelector('.tb-hint')!;
    const act = v.stacks.find((s) => s.id === v.active);
    const own = this.targetKind() === 'own';
    const text = v.over ? '' : !v.mine ? (act && act.side !== v.you ? L('hint.wait') : '') : this.targeting ? L(own ? 'hint.own' : 'hint.target') : this.preview !== null ? L('hint.again') : v.warn?.length ? BL('hint.warn') : v.shoot.length ? L('hint.shoot') : L('hint.move');
    h.textContent = text;
    h.classList.toggle('hidden', !text);
  }

  /** The stack's card: what it is, its numbers, its officer. A desk's beside the field; a phone's a bottom sheet
   *  (docs/23 item 59), opened by a long press and put away by a swipe, a tap beside it or its cross. */
  private showInfo(id: number | null): void {
    if (id !== this.info) this.spNote = null;
    this.info = id;
    const card = this.el?.querySelector<HTMLElement>('.tb-card');
    const v = this.view;
    if (!card || !v) return;
    const s = id !== null ? v.stacks.find((x) => x.id === id) : undefined;
    if (!s) {
      card.classList.add('hidden');
      this.info = null;
      if (this.sheetKind === 'card') this.closeSheet();
      return;
    }
    if (this.phone) {
      card.classList.add('hidden');
      const body = `<div class="tb-cardsh ${s.side === v.you ? 'you' : 'foe'}">${this.cardHtml(s, v, false)}</div>`;
      if (this.sheetKind === 'card' && this.sheetH?.open && this.sheetH.root.dataset.stack === String(s.id)) this.sheetH.body.innerHTML = body;
      else {
        this.closeSheet();
        this.sheetH = openSheet({ title: stackName(s), body, height: 'auto', cls: 'tb-sheetk tb-cardk', onClose: () => this.sheetGone('card') });
        this.sheetH.root.dataset.stack = String(s.id);
        this.sheetKind = 'card';
        this.sheetH.body.addEventListener('click', (e) => {
          const sp = (e.target as HTMLElement).closest<HTMLElement>('[data-spnote]');
          if (!sp) return;
          this.spNote = this.spNote === sp.dataset.spnote ? null : sp.dataset.spnote!;
          this.showInfo(this.info);
        });
      }
      return;
    }
    card.className = `tb-card ${s.side === v.you ? 'you' : 'foe'}`;
    card.innerHTML = this.cardHtml(s, v, true);
  }

  /** The card's markup: its face and name (on a desk; a sheet has its own title), its numbers by their painted marks,
   *  its state, its specials (a tap opens a special's words), its note. */
  private cardHtml(s: TacStackView, v: TacView, head: boolean): string {
    // Each number by its painted mark and its word (the word cut short in a narrow column, whole in the title).
    // A hero's bonus leaves a tenth on her attack and defence: 20,5 in Russian.
    const num = (n: number) => (Number.isInteger(n) ? String(n) : dec1(n));
    const row = (ic: string, k: K, val: string) => `<div title="${esc(L(k))}">${icon(ic, '', 'ico-xs')}<span>${esc(L(k))}</span><b>${esc(val)}</b></div>`;
    const o = s.officer;
    const d = s.unit ? UNITS[s.unit] : null;
    const note = this.spNote && s.sp?.includes(this.spNote as UnitSpecial) ? (this.spNote as UnitSpecial) : null;
    const face = figureArt(s) ? icon(figureArt(s)!, '', 'ico-md fig') : icon(stackArt(s), '', 'ico-md');
    const sub = `${d ? esc(L('tierOf', { n: d.tier })) : ''}${o ? `${d ? ' · ' : ''}${esc(personName(o.name))}` : ''}`;
    return `${head ? `<div class="tb-card-h">${face}<div><b>${esc(stackName(s))}</b><small>${sub}</small></div><button class="tb-cardx" title="${esc(L('close'))}" aria-label="${esc(L('close'))}"></button></div>` : `<div class="tb-card-h">${face}<div><small>${sub}</small></div></div>`}
      <div class="tb-stats">${row('icon.stat_crew', 'st.count', `${s.count} / ${s.start}`)}${row('icon.item_cutlass', 'st.atk', num(s.atk))}${row('icon.mod_hull_plating', 'st.def', num(s.def))}${row('icon.tree_boarding', 'st.dmg', `${s.dmg[0]}–${s.dmg[1]}`)}${row('icon.tattoo_heart', 'st.hp', `${s.hp} / ${s.hpMax}`)}${row('icon.item_seaboots', 'st.speed', String(s.speed))}${row('icon.mount_war_drums', 'st.init', String(s.init))}${s.shotsMax ? row('icon.item_powder_horn', 'st.shots', `${s.shots} / ${s.shotsMax}`) : ''}${row('icon.st_no_ret', 'st.ret', L(s.ret ? 'st.retYes' : 'st.retNo'))}</div>
      ${STATUS.some(([f]) => s[f]) ? `<div class="tb-sts">${STATUS.filter(([f]) => s[f]).map(([, ic, k]) => `<span class="chip tb-st${k === 'sts.defending' || k === 'sts.braced' || k === 'sts.again' ? ' good' : k === 'sts.waited' ? '' : ' bad'}">${btIcon(ic, '', 'ico-xs')}${esc(L(k))}</span>`).join('')}</div>` : ''}
      ${s.sp?.length ? `<div class="tb-sps">${s.sp.map((x) => `<button class="chip tb-spc${note === x ? ' on' : ''}" data-spnote="${esc(x)}" title="${esc(specialNote(x))}">${esc(specialName(x))}</button>`).join('')}</div>${note ? `<p class="tb-spn">${esc(specialNote(note))}</p>` : ''}` : ''}
      <p class="muted">${esc(s.kind === 'officer' || !s.unit ? L(`kd.${s.kind}` as K) : unitNote(s.unit))}${o ? ` ${esc(L(`o.${o.order}` as K))}: ${esc(L(`od.${o.order}` as K))}` : ''}</p>`;
  }

  /** The phone's sheet put away (a card or the book). */
  private closeSheet(): void {
    const h = this.sheetH;
    this.sheetH = null;
    this.sheetKind = null;
    if (h?.open) h.close('code');
  }

  /** A sheet gone by the captain's hand (a swipe, a tap beside it, its cross). */
  private sheetGone(kind: 'card' | 'book'): void {
    if (this.sheetKind !== kind) return;
    this.sheetH = null;
    this.sheetKind = null;
    if (kind === 'card') this.info = null;
    this.key = '';
    if (this.view) this.dom(this.view);
  }

  /** The phone's book (docs/23 item 62): a bottom sheet of big cards — the officer's word, the path's two moves, then
   *  every page with its picture and its price; one tap takes a card (a page aimed at a stack is then given by a tap on
   *  it), a card that cannot be given now is dimmed with the reason. */
  private bookHtml(v: TacView): string {
    const me = v.heroes[v.you];
    const act = v.stacks.find((s) => s.id === v.active);
    const bar = (cls: string, ico: string, k: K, n: number, m: number) => `<div class="tb-store ${cls}" title="${esc(L(k))}">${icon(ico, '', 'ico-xs')}<span class="tb-rbar"><i style="width:${m ? Math.round(Math.max(0, Math.min(1, n / m)) * 100) : 0}%"></i></span><b>${n}</b><small>/${m}</small></div>`;
    const will = me.mana !== undefined ? `<div class="tb-bk-will">${bar('will', 'icon.ab_brine_mend', 'will', me.mana, me.manaMax ?? 0)}${me.stam !== undefined ? bar('stam', 'icon.tree_survival', 'stam', me.stam, me.stamMax ?? 0) : ''}</div>` : '';
    const card = (data: string, pic: string, name: string, note: string, off: boolean, cls = '') =>
      `<button class="tb-bc${cls}" ${data}${off ? ' disabled' : ''} title="${esc(name)}">${pic}<b>${esc(name)}</b><small>${note}</small></button>`;
    const cards: string[] = [];
    const o = act?.officer;
    if (o && act!.side === v.you) cards.push(card('data-bk="order"', icon(`icon.role_${o.role}`, '', 'tb-bc-ico'), L(`o.${o.order}` as K), esc(o.ready ? L('book.officer') : L('used')), !v.mine || !o.ready, ' officer'));
    for (const kind of ['innate', 'ult'] as const) {
      const st = kind === 'innate' ? me.innate : me.ult;
      if (!me.path || !st || st === 'locked') continue;
      const early = kind === 'ult' && v.round < ULT_ROUND;
      const off = !v.mine || st !== 'ready' || early;
      cards.push(card(`data-bkmove="${kind}"`, icon(`icon.${(kind === 'innate' ? INNATE : ULTIMATE)[me.path].icon}`, '', 'tb-bc-ico'), moveName(me.path, kind === 'ult'), esc(st === 'used' ? L('used') : early ? L('ultRound') : L('free')), off, ` mv ${kind}`));
    }
    const all = [...me.spells].sort((a, b) => SCHOOLS.indexOf(ORDERS[a.id]?.school as School) - SCHOOLS.indexOf(ORDERS[b.id]?.school as School) || (ORDERS[a.id]?.level ?? 0) - (ORDERS[b.id]?.level ?? 0));
    for (const sp of all) {
      const wait = Math.max(0, sp.ready - v.round);
      const pool = sp.res === 'stam' ? me.stam : me.mana;
      const poor = sp.cost !== undefined && pool !== undefined && pool < sp.cost;
      const off = !v.mine || me.cast || wait > 0 || poor;
      const price = sp.scroll ? esc(L('scroll', { n: sp.scroll })) : sp.cost !== undefined ? `<span class="tb-bc-cost${sp.res === 'stam' ? ' stam' : ''}">${icon(sp.res === 'stam' ? 'icon.tree_survival' : 'icon.ab_brine_mend', '', 'ico-xs')}${sp.cost}</span>` : '';
      // A card that cannot be taken says why (docs/23 item 93: an order given, her move gone, the enemy's fog — it showed
      // its price and did nothing).
      const note = wait > 0 ? esc(L('ready.in', { n: wait })) : poor ? esc(L(sp.res === 'stam' ? 'noStam' : 'noWill')) : me.hush ? esc(L('hushed')) : me.cast ? esc(L('castDone')) : !v.mine ? esc(L('theirTurn')) : price;
      cards.push(card(`data-bkspell="${sp.id}"`, spIcon(sp.id, 'tb-bc-ico'), spName(sp.id), note, off, `${poor ? ' poor' : ''}`));
    }
    return `${will}<div class="tb-bk-grid">${cards.join('')}</div>`;
  }

  private openBook(v: TacView): void {
    if (this.sheetKind === 'book' && this.sheetH?.open) return this.closeSheet();
    this.closeSheet();
    this.info = null;
    this.sheetOpen = false;
    this.sheetH = openSheet({ title: L('book'), body: this.bookHtml(v), height: 0.9, cls: 'tb-sheetk tb-bookk', onClose: () => this.sheetGone('book') });
    this.sheetKind = 'book';
    this.sheetH.body.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tb-bc');
      if (!b || b.disabled) return;
      this.closeSheet();
      if (b.dataset.bk === 'order') this.button('order');
      else if (b.dataset.bkmove) this.move2(b.dataset.bkmove as 'innate' | 'ult');
      else if (b.dataset.bkspell) this.spell(b.dataset.bkspell as TacSpellId);
      this.key = '';
      if (this.view) this.dom(this.view);
    });
    this.key = '';
    this.dom(v);
  }

  // ------------------------------------------------------------------ orders

  private order(a: TacAction): void {
    this.send({ t: 'tac', act: a });
  }

  private button(a: string): void {
    const v = this.view;
    if (!v) return;
    if (a === 'wait' || a === 'defend' || a === 'order') this.order({ a });
    else if (a === 'auto') this.order({ a: 'auto', on: !v.heroes[v.you].auto });
    else if (a === 'quick') this.order({ a: 'quick' });
    else if (a === 'cut') this.send({ t: 'board_cut' });
    else if (a === 'ransom') {
      if (this.ransomArmed > performance.now()) {
        this.ransomArmed = 0;
        this.order({ a: 'ransom' });
      } else {
        this.ransomArmed = performance.now() + 3000;
        this.key = '';
        this.dom(v);
      }
    } else if (a === 'surrender') {
      if (this.strikeArmed > performance.now()) {
        this.strikeArmed = 0;
        this.order({ a: 'surrender' });
      } else {
        this.strikeArmed = performance.now() + 3000;
        this.key = '';
        this.dom(v);
      }
    }
    this.preview = null;
  }

  /** Whom the order or move being aimed is for. */
  private targetKind(): 'enemy' | 'own' | 'none' {
    const t = this.targeting;
    const me = this.view?.heroes[this.view.you];
    if (!t) return 'none';
    if (t === 'innate' || t === 'ult') return me?.path ? (t === 'innate' ? INNATE : ULTIMATE)[me.path].fx.target : 'none';
    return TAC_SPELLS[t].target;
  }

  /** Her path's innate move or ultimate (docs/18): at once, or aimed at a stack. */
  private move2(kind: 'innate' | 'ult'): void {
    const v = this.view;
    const me = v?.heroes[v.you];
    if (!v?.mine || !me?.path) return;
    const target = (kind === 'innate' ? INNATE : ULTIMATE)[me.path].fx.target;
    if (target === 'none') {
      this.targeting = null;
      this.order({ a: kind });
      return;
    }
    this.targeting = this.targeting === kind ? null : kind;
    this.key = '';
    this.dom(v);
  }

  private spell(id: TacSpellId): void {
    const v = this.view;
    if (!v?.mine) return;
    if (TAC_SPELLS[id].target === 'none') {
      this.targeting = null;
      this.order({ a: 'spell', id });
      return;
    }
    this.targeting = this.targeting === id ? null : id;
    this.key = '';
    this.dom(v);
  }

  /** Keys: W wait, D defend, O the officer's word, A auto-battle, 1–4 the captain's orders, Esc lets go. */
  onKey(e: KeyboardEvent): boolean {
    const v = this.view;
    if (!v || e.ctrlKey || e.metaKey || e.altKey) return false;
    const k = e.key.toLowerCase();
    const code = e.code;
    if (k === 'escape') {
      this.targeting = this.preview = this.foeArmed = null;
      this.bookOpen = false;
      this.showInfo(null);
      this.key = '';
      this.dom(v);
      return true;
    }
    if (code === 'KeyW') this.order({ a: 'wait' });
    else if (code === 'KeyD') this.order({ a: 'defend' });
    else if (code === 'KeyO') this.order({ a: 'order' });
    else if (code === 'KeyA') this.order({ a: 'auto', on: !v.heroes[v.you].auto });
    else if (code === 'KeyI') this.move2('innate');
    else if (code === 'KeyU') this.move2('ult');
    else if (/^Digit[1-4]$/.test(code)) {
      const sp = v.heroes[v.you].spells[Number(code.slice(5)) - 1];
      if (sp) this.spell(sp.id);
    } else return /^Key|^Digit|^Arrow|^Space/.test(code); // the helm and the guns wait while the decks fight
    return true;
  }

  // ------------------------------------------------------------------ the field under the finger

  private hexAt(e: { clientX: number; clientY: number }): number | null {
    const c = this.canvas;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best: number | null = null, bd = Infinity;
    for (let i = 0; i < TAC_W * TAC_H; i++) {
      const p = this.center(i);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return bd <= (this.size.w * 0.62) ** 2 ? best : null;
  }

  private stackAt(hex: number): TacStackView | undefined {
    return this.view?.stacks.find((s) => s.hex === hex);
  }

  /** A pointer's place on the stage (CSS px). */
  private onStage(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down(e: PointerEvent): void {
    this.cancelPress();
    const x = e.clientX, y = e.clientY;
    // A finger on a foe she may strike shows what the blow would do while it is down (owner, 2026-10-08), the side of
    // the foe it comes from chosen by where the finger lies on it (it may slide round the foe to choose); let go, and
    // she strikes. Held long, the stack's card instead.
    let foe = false;
    if (e.pointerType !== 'mouse' && this.view?.mine && !this.busy()) {
      const h = this.hexAt(e);
      const p = this.onStage(e);
      const keep = this.foeArmed;
      this.aimAt(h, p.x, p.y);
      foe = !!this.aimFoe;
      if (!foe && keep !== null) this.aimFoe = null;
    }
    const timer = window.setTimeout(() => {
      // A long press: the stack's card, whatever a tap on it would do (a foe in reach is struck by a tap).
      const h = this.hexAt({ clientX: x, clientY: y });
      const s = h !== null ? this.stackAt(h) : undefined;
      if (s) {
        if (this.phone && (this.moreOpen || this.sheetOpen || this.bookOpen)) {
          this.moreOpen = this.sheetOpen = this.bookOpen = false;
          this.key = '';
          if (this.view) this.dom(this.view);
        }
        this.showInfo(s.id);
      }
      this.press = null;
      if (foe && this.foeArmed === null) this.aimFoe = null;
    }, foe ? 800 : 450);
    this.press = { x, y, t: performance.now(), timer, foe };
  }

  private cancelPress(): void {
    if (this.press) clearTimeout(this.press.timer);
    this.press = null;
  }

  private move(e: PointerEvent): void {
    if (e.pointerType === 'mouse') {
      this.hover = this.hexAt(e);
      // The preview under the sword (owner, 2026-10-08): the foe under the mouse, the side it is struck from by where
      // the mouse lies on it.
      if (!this.busy()) {
        const p = this.onStage(e);
        this.aimAt(this.hover, p.x, p.y);
      }
      // The attack cursor (owner, 2026-10-07: «при абордаже… при наведении на цель показывать иконку атаки»): over a
      // stack hers may strike, the sabres; one it may shoot, the gun (ui/cursor.ts, seahud.css).
      const v = this.view, s = this.hover !== null ? this.stackAt(this.hover) : undefined;
      const cur = v?.mine && !v.over && s ? (v.melee.includes(s.id) ? 'attack' : v.shoot.includes(s.id) ? 'guns' : '') : '';
      const c = e.currentTarget as HTMLElement;
      if ((c.dataset.cur ?? '') !== cur) {
        if (cur) c.dataset.cur = cur;
        else delete c.dataset.cur;
      }
    }
    // A finger on a foe may slide round it to choose the side it strikes from; off it, the blow is let go.
    if (this.press?.foe && this.aimFoe) {
      const s = this.view?.stacks.find((x) => x.id === this.aimFoe!.t);
      const p = this.onStage(e);
      const c = s ? this.center(s.hex) : null;
      if (s && c && Math.hypot(p.x - c.x, p.y - c.y) <= this.size.w * 1.25) {
        this.aimFoe = { t: s.id, from: this.view!.shoot.includes(s.id) ? undefined : this.strikeFor(this.view!, s, p.x, p.y) };
        if (Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 12) {
          clearTimeout(this.press.timer); // sliding to choose: no card
          this.press.timer = 0;
        }
      } else {
        this.cancelPress();
        if (this.foeArmed === null) this.aimFoe = null;
      }
      return;
    }
    if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 12) this.cancelPress();
  }

  private up(e: PointerEvent): void {
    if (!this.press) return;
    const foe = this.press.foe && this.aimFoe ? this.view?.stacks.find((x) => x.id === this.aimFoe!.t)?.hex ?? null : null;
    this.cancelPress();
    if (e.button === 2) return;
    // A finger let go on a foe it slid round: the foe it aimed at, from the side it chose.
    this.tap(foe ?? this.hexAt(e));
  }

  private tap(h: number | null): void {
    const v = this.view;
    if (!v) return;
    // On a phone a tap beside the open round only closes it: the finger reaching to put it away must not also march a
    // stack or strike. (A card and the book are the kit's sheets: their scrim takes that tap.)
    if (this.phone && (this.info !== null || this.moreOpen || this.sheetOpen || this.bookOpen)) {
      this.showInfo(null);
      this.moreOpen = this.sheetOpen = this.bookOpen = false;
      this.key = '';
      this.dom(v);
      return;
    }
    if (this.info !== null) this.showInfo(null);
    if (h === null) {
      this.preview = this.foeArmed = null;
      this.aimFoe = null;
      return this.refresh();
    }
    const s = this.stackAt(h);
    // The field takes no order while the last turn is still being played (owner, 2026-10-08): a card it may open.
    if (!v.mine || v.over || this.busy()) {
      if (s) this.showInfo(s.id);
      return;
    }
    // One tap is the order (docs/23 item 57); the option «a second tap to be sure» asks it twice on the same hex.
    const sure = settings().tacConfirm;
    // An order or a move aimed at one of her own stacks (docs/18).
    if (s && s.side === v.you && this.targeting && this.targetKind() === 'own') {
      const t = this.targeting;
      this.order(t === 'innate' || t === 'ult' ? { a: t, target: s.id } : { a: 'spell', id: t, target: s.id });
      this.targeting = null;
      return this.refresh();
    }
    if (s && s.side !== v.you) {
      if (this.targeting) {
        const t = this.targeting;
        this.order(t === 'innate' || t === 'ult' ? { a: t, target: s.id } : { a: 'spell', id: t, target: s.id });
        this.targeting = null;
      } else if (v.shoot.includes(s.id) || v.melee.includes(s.id)) {
        // The side she strikes from: as aimed (the mouse or the finger on the foe, owner 2026-10-08), else the hex
        // tapped once before, else the hardest blow the preview shows.
        if (this.aimFoe?.t !== s.id) this.aimAt(s.hex, null, null);
        if (sure && this.foeArmed !== s.id) {
          this.foeArmed = s.id;
          this.key = '';
          this.dom(v);
          return this.refresh();
        }
        if (v.shoot.includes(s.id)) this.order({ a: 'shoot', target: s.id });
        else {
          const from = this.aimFoe?.t === s.id && this.aimFoe.from !== undefined ? this.aimFoe.from : this.preview !== null && hexNeighbors(s.hex).includes(this.preview) ? this.preview : undefined;
          this.order(from !== undefined ? { a: 'attack', target: s.id, from } : { a: 'attack', target: s.id });
        }
        this.aimFoe = null;
      } else this.showInfo(s.id);
      this.preview = this.foeArmed = null;
      return this.refresh();
    }
    if (s) {
      this.showInfo(s.id);
      return;
    }
    if (v.reach.includes(h)) {
      this.foeArmed = null;
      if (sure && this.preview !== h) this.preview = h;
      else {
        this.preview = null;
        this.order({ a: 'move', to: h });
      }
      return this.refresh();
    }
    this.preview = this.foeArmed = null;
    this.refresh();
  }
  private refresh(): void {
    if (this.view) this.hint(this.view);
  }

  // ------------------------------------------------------------------ the preview under the sword (owner, 2026-10-08)

  /** The preview of the foe aimed at now (under the mouse, under the finger, or tapped once to be sure). */
  private pvOf(v: TacView): TacPreview | null {
    const a = this.aimFoe;
    if (!a || !v.pv) return null;
    return v.pv.find((p) => p.t === a.t && (p.shot || p.from === a.from)) ?? null;
  }

  /** The hex she would strike foe `t` from with the pointer at (px, py) on the stage (HoMM3: the side of the foe the
   *  sword comes from) — the one beside it nearest the pointer's way from its middle; with the pointer on its middle,
   *  the hardest blow (from behind, then a flank), the nearer hex on a tie. None for a shot. */
  private strikeFor(v: TacView, t: TacStackView, px: number | null, py: number | null): number | undefined {
    const opts = (v.pv ?? []).filter((p) => p.t === t.id && !p.shot && p.from !== undefined);
    if (!opts.length) return undefined;
    const c = this.center(t.hex);
    const w = this.size.w || 30;
    if (px !== null && py !== null && Math.hypot(px - c.x, py - c.y) > w * 0.2) {
      const ang = Math.atan2(py - c.y, px - c.x);
      let best = opts[0], bd = Infinity;
      for (const o of opts) {
        const q = this.center(o.from!);
        let d = Math.abs(Math.atan2(q.y - c.y, q.x - c.x) - ang);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      return best.from;
    }
    const act = v.stacks.find((s) => s.id === v.active);
    const steps = (h: number) => (act ? hexDist(act.hex, h) : 0);
    return [...opts].sort((a, b) => b.fl - a.fl || steps(a.from!) - steps(b.from!) || b.dmg[1] - a.dmg[1])[0].from;
  }

  /** Aim at the stack under the pointer (stage px), if it is a foe she may strike or shoot now; else let go. */
  private aimAt(h: number | null, px: number | null, py: number | null): void {
    const v = this.view;
    const s = h !== null ? this.stackAt(h) : undefined;
    if (!v || !s || !v.mine || v.over || this.targeting || s.side === v.you || !(v.melee.includes(s.id) || v.shoot.includes(s.id))) {
      this.aimFoe = null;
      return;
    }
    this.aimFoe = { t: s.id, from: v.shoot.includes(s.id) ? undefined : this.strikeFor(v, s, px, py) };
  }

  /** The preview's words: the harm and the fallen as ranges, a blow into the side or from behind, the answer. */
  private tipHtml(p: TacPreview): string {
    const r = (x: [number, number]) => (x[0] === x[1] ? `${x[0]}` : `${x[0]}–${x[1]}`);
    const rows = [
      p.shot ? `<div class="tb-pv-h">${esc(L('pv.shot'))}</div>` : '',
      `<div class="tb-pv-r"><span>${esc(L('pv.dmg'))}</span><b>${r(p.dmg)}</b>${p.twice ? `<i>×2</i>` : ''}</div>`,
      `<div class="tb-pv-r"><span>${esc(L('pv.kills'))}</span><b>${r(p.kills)}</b></div>`,
      p.fl ? `<div class="tb-pv-fl">${esc(L(p.fl === 2 ? 'fl.rear' : 'fl.side'))}</div>` : '',
      p.far ? `<div class="tb-pv-n">${esc(L('pv.far'))}</div>` : '',
      p.sweep ? `<div class="tb-pv-n">${esc(L('pv.sweep'))}</div>` : '',
      p.shot || p.sweep ? '' : p.ret ? `<div class="tb-pv-ret"><span>${esc(L('pv.ret'))}:</span><b>−${r(p.ret)}</b></div>` : `<div class="tb-pv-ret none">${esc(L('pv.noRet'))}</div>`,
      p.luck && !this.phone ? `<div class="tb-pv-n">${esc(L('pv.luck', { n: p.luck }))}</div>` : '',
    ];
    return rows.join('');
  }

  /** The preview beside the foe aimed at (owner, 2026-10-08): on a desk beside it, on a phone over it (clear of the
   *  finger); kept on the stage. */
  private tipDom(v: TacView): void {
    const el = this.el?.querySelector<HTMLElement>('.tb-pv');
    if (!el) return;
    const p = v.mine && !v.over && !this.busy() && !this.targeting && !this.bookOpen && this.info === null ? this.pvOf(v) : null;
    const t = p ? v.stacks.find((s) => s.id === p.t) : undefined;
    if (!p || !t) {
      if (!el.classList.contains('hidden')) el.classList.add('hidden');
      this.tipKey = '';
      return;
    }
    const key = `${JSON.stringify(p)}${lang()}${this.phone}`;
    if (key !== this.tipKey) {
      this.tipKey = key;
      el.innerHTML = this.tipHtml(p);
      el.setAttribute('aria-label', L('pv.label'));
      el.classList.toggle('flank', !!p.fl);
      el.classList.remove('hidden');
    }
    const { w, cw, ch } = this.size;
    const c = this.center(t.hex);
    const bw = el.offsetWidth, bh = el.offsetHeight;
    let x: number, y: number;
    if (this.phone) {
      x = c.x - bw / 2;
      y = c.y - w * 1.45 - bh;
      if (y < 4) y = c.y + w * 0.75;
    } else {
      x = c.x + w * 0.62;
      y = c.y - w * 0.75 - bh / 2;
      if (x + bw > cw - 4) x = c.x - w * 0.62 - bw;
    }
    x = Math.round(Math.max(4, Math.min(cw - bw - 4, x)));
    y = Math.round(Math.max(4, Math.min(ch - bh - 4, y)));
    const tr = `translate(${x}px, ${y}px)`;
    if (el.style.transform !== tr) el.style.transform = tr;
  }

  // ------------------------------------------------------------------ drawing

  /** A hex's centre on the board as it lies (the decks side by side, the corner at 0,0). */
  private lc(i: number): { x: number; y: number } {
    const { w } = this.size;
    const h = (w * 2) / SQ3;
    const x = hexX(i), y = hexY(i);
    return { x: w * (x + 0.5 + (y & 1 ? 0.5 : 0)), y: h / 2 + y * h * 0.75 };
  }

  /** The board's turn onto the screen: screen = (a·x + c·y + e, b·x + d·y + f). */
  private xf(): [number, number, number, number, number, number] {
    const { ox, oy, rot, bw, bh } = this.size;
    if (rot === 1) return [0, -1, 1, 0, ox, oy + bw];
    if (rot === -1) return [0, 1, -1, 0, ox + bh, oy];
    return [1, 0, 0, 1, ox, oy];
  }

  /** A hex's centre on the screen. */
  private center(i: number): { x: number; y: number } {
    const p = this.lc(i);
    const [a, b, c, d, e, f] = this.xf();
    return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f };
  }

  private turned(g: CanvasRenderingContext2D): void {
    const k = this.size.dpr;
    const [a, b, c, d, e, f] = this.xf();
    g.setTransform(a * k, b * k, c * k, d * k, e * k, f * k);
  }

  /** Less motion asked for: no walks, glides or lunges, every stack where it stands. */
  private calm(): boolean {
    return !!this.calmMq?.matches;
  }

  /** Where a stack stands this frame: along its walk while it walks, hex by hex (a step's bob, a flier's rise and
   *  fall), waiting at its first hex till its walk's beat comes; its hex otherwise. `dx`: the way it walks (screen). */
  private standAt(s: TacStackView, t: number): { x: number; y: number; lift: number; walking: boolean; dx: number } {
    const p = this.pos.get(s.id);
    if (!p || p.hex !== s.hex || p.dur <= 0 || t >= p.t0 + p.dur || p.path.length < 2) return { ...this.center(s.hex), lift: 0, walking: false, dx: 0 };
    const k = Math.max(0, (t - p.t0) / p.dur);
    const steps = p.fly ? 1 : p.path.length - 1;
    const pts = p.path.map((h) => this.center(h));
    const share = stepEase(k, steps);
    const q = along(pts, share), ahead = along(pts, Math.min(1, share + 0.03));
    const w = this.size.w || 30;
    const lift = p.fly ? Math.sin(Math.PI * k) * w * 0.45 : Math.abs(Math.sin(Math.PI * k * steps)) * w * 0.07;
    const dx = t < p.t0 ? 0 : ahead.x - q.x || pts[pts.length - 1].x - pts[0].x;
    return { x: q.x, y: q.y, lift, walking: true, dx };
  }

  /** The way a stack faces on the screen (a unit vector): the way it faces on the board, turned with the board. */
  private faceVec(s: TacStackView): { x: number; y: number } {
    const a = ((Number.isFinite(s.face) ? s.face : s.side ? 3 : 0) * Math.PI) / 3;
    const [A, B, C, D] = this.xf();
    return { x: A * Math.cos(a) + C * Math.sin(a), y: B * Math.cos(a) + D * Math.sin(a) };
  }

  /** It faces left on the screen (straight up or down the screen, as its side came aboard). */
  private facesLeft(s: TacStackView): boolean {
    const f = this.faceVec(s);
    return Math.abs(f.x) < 0.2 ? s.side === 1 : f.x < 0;
  }

  /** The hex a walk is shown to: the one tapped once (the second tap marches), else the one under the mouse. */
  private aim(v: TacView): number | null {
    if (!v.mine || v.over || this.targeting || this.busy()) return null;
    // A foe aimed at from a hex she must walk to: the walk to it (owner, 2026-10-08: where she would stand to strike).
    const act = v.stacks.find((s) => s.id === v.active);
    if (this.aimFoe?.from !== undefined && act && this.aimFoe.from !== act.hex) return this.aimFoe.from;
    if (this.aimFoe) return null;
    if (this.preview !== null && v.reach.includes(this.preview)) return this.preview;
    return this.hover !== null && v.reach.includes(this.hover) && !this.stackAt(this.hover) ? this.hover : null;
  }

  private walkingAt(v: TacView, t: number): boolean {
    return v.stacks.some((s) => this.standAt(s, t).walking);
  }

  /** The walk to `to` drawn on the board (its own coordinates, under the figures): a footstep on every hex it would
   *  step through, a line joining them, the hex it ends on ringed — or a flier's arc straight over. */
  private walkMark(g: CanvasRenderingContext2D, v: TacView, s: TacStackView, to: number, r: number, pulse: number): void {
    const w = this.size.w;
    const fly = s.sp.includes('flying');
    const path = fly ? null : walkPath(v.cells, v.stacks, s.id, s.hex, to, s.sp.includes('diving'));
    const hexes = path ?? [s.hex, to];
    const pts = hexes.map((h) => this.lc(h));
    const strong = this.preview !== null;
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = `rgba(232,250,240,${strong ? 0.85 : 0.55})`;
    g.lineWidth = Math.max(2, w * (strong ? 0.07 : 0.05));
    g.setLineDash(fly || !path ? [w * 0.16, w * 0.12] : []);
    g.beginPath();
    if (fly || !path) {
      const a = pts[0], b = pts[pts.length - 1];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.25;
      g.moveTo(a.x, a.y);
      g.quadraticCurveTo(mx, my, b.x, b.y);
    } else {
      // To the edge of the hex it ends on: the ghost stands there, not on a line.
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      g.moveTo(pts[0].x, pts[0].y);
      for (const q of pts.slice(1, -1)) g.lineTo(q.x, q.y);
      g.lineTo(a.x + (b.x - a.x) * 0.5, a.y + (b.y - a.y) * 0.5);
    }
    g.stroke();
    g.setLineDash([]);
    // A footstep on each hex it steps through.
    if (path) {
      g.fillStyle = `rgba(232,250,240,${strong ? 0.95 : 0.7})`;
      for (const q of pts.slice(1, -1)) {
        g.beginPath();
        g.arc(q.x, q.y, Math.max(2.5, w * 0.09), 0, Math.PI * 2);
        g.fill();
      }
    }
    // The hex it ends on.
    const z = pts[pts.length - 1];
    this.hexPath(g, z.x, z.y, r - 2);
    g.strokeStyle = `rgba(240,255,248,${strong ? 0.6 + 0.4 * pulse : 0.6})`;
    g.lineWidth = strong ? 2.5 : 1.5;
    g.stroke();
    g.restore();
    this.drawn.path = Math.max(0, hexes.length - 1);
  }

  /** The stack's ghost at a hex: drawn whole on a layer of its own, then laid over the field at `alpha` (a figure
   *  sets its own alphas as it draws, so it cannot be dimmed in place), without its number or its turn's ring. */
  private ghost(g: CanvasRenderingContext2D, s: TacStackView, hex: number, v: TacView, alpha: number, filter = 'saturate(0.6) brightness(1.3)'): void {
    const c = this.canvas;
    if (!c) return;
    const layer = (this.ghostLayer ??= document.createElement('canvas'));
    if (layer.width !== c.width || layer.height !== c.height) {
      layer.width = c.width;
      layer.height = c.height;
    }
    const lg = layer.getContext('2d')!;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.clearRect(0, 0, layer.width, layer.height);
    lg.setTransform(this.size.dpr, 0, 0, this.size.dpr, 0, 0);
    const p = this.center(hex);
    const keep = this.plates, act = this.act.get(s.id);
    this.plates = [];
    this.act.delete(s.id);
    this.token(lg, s, p.x, p.y, this.size.w, false, 0, v);
    this.plates = keep;
    if (act) this.act.set(s.id, act);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha;
    g.filter = filter;
    g.drawImage(layer, 0, 0);
    g.restore();
    this.drawn.ghosts++;
  }

  /** «Ответит» on the field (docs/23 item 58): a small orange disc with a curled arrow turning back — this foe still has
   *  its answer this round. Drawn, not written (a phone's field carries no words). */
  private retMark(g: CanvasRenderingContext2D, x: number, y: number, rr: number, pulse: number): void {
    g.save();
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.fillStyle = `rgba(48,22,10,${0.85 + 0.1 * pulse})`;
    g.fill();
    g.lineWidth = Math.max(1.5, rr * 0.22);
    g.strokeStyle = '#f0a03c';
    g.stroke();
    // The curl: three quarters of a ring, its head pointing back.
    const k = rr * 0.55;
    g.beginPath();
    g.arc(x, y, k, -Math.PI * 0.15, Math.PI * 1.35);
    g.stroke();
    const ax = x + Math.cos(-Math.PI * 0.15) * k, ay = y + Math.sin(-Math.PI * 0.15) * k;
    g.beginPath();
    g.moveTo(ax - rr * 0.38, ay - rr * 0.08);
    g.lineTo(ax + rr * 0.05, ay + rr * 0.05);
    g.lineTo(ax + rr * 0.12, ay - rr * 0.4);
    g.stroke();
    g.restore();
  }

  /** What the last frame drew, for the QA kit: figures a stack (one each), the ghost, the hexes of the path shown,
   *  the stacks walking. */
  frameStats(): { figures: Record<number, number>; ghosts: number; path: number; walking: number[] } {
    return { figures: Object.fromEntries(this.drawn.figures), ghosts: this.drawn.ghosts, path: this.drawn.path, walking: [...this.drawn.walking] };
  }

  /** On a phone, the room its buttons take at the field's edges: a band down either side when the phone lies on its
   *  side (the same both sides, so the board stays in the middle), along the bottom and the top when it stands upright.
   *  Measured off the buttons themselves, so a third row of them, or a notch's inset, moves the board too. */
  private bands(stage: HTMLElement): { l: number; r: number; t: number; b: number } {
    const out = { l: 0, r: 0, t: 0, b: 0 };
    if (!this.phone || !this.el) return out;
    const s = stage.getBoundingClientRect();
    const side = s.width > s.height;
    for (const e of this.el.querySelectorAll<HTMLElement>('.tb-pad > .tb-pl, .tb-pad > .tb-pr, .tb-pad > .tb-chip')) {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (side) {
        if (r.left + r.right < s.left + s.right) out.l = Math.max(out.l, r.right - s.left + 6);
        else out.r = Math.max(out.r, s.right - r.left + 6);
      } else if (r.top + r.bottom < s.top + s.bottom) out.t = Math.max(out.t, r.bottom - s.top + 6);
      else out.b = Math.max(out.b, s.bottom - r.top + 6);
    }
    if (side) out.l = out.r = Math.max(out.l, out.r);
    return { l: Math.round(out.l), r: Math.round(out.r), t: Math.round(out.t), b: Math.round(out.b) };
  }

  /** The canvas fits its stage: hexes as large as the room allows, the board centred (on a phone, in the room its
   *  buttons leave; the painted sea or ground still runs under them to the screen's edge). */
  private fit(): boolean {
    const c = this.canvas!;
    const stage = c.parentElement!;
    const cw = stage.clientWidth, ch = stage.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const band = this.bands(stage);
    const same = band.l === this.band.l && band.r === this.band.r && band.t === this.band.t && band.b === this.band.b;
    if (cw === this.size.cw && ch === this.size.ch && dpr === this.size.dpr && same) return false;
    this.band = band;
    // The cards and the end over the field keep to the same room (styles.css: body.tac-ph).
    for (const k of ['l', 'r', 't', 'b'] as const) this.el?.style.setProperty(`--tb-${k}`, `${band[k]}px`);
    const aw = Math.max(1, cw - band.l - band.r), ah = Math.max(1, ch - band.t - band.b);
    // Side by side, or upright when that gives the bigger hexes (a phone held upright).
    const depth = ((TAC_H - 1) * 0.75 + 1) * (2 / SQ3);
    const flat = Math.min(aw / TAC_W, ah / depth), up = Math.min(aw / depth, ah / TAC_W);
    const rot: 0 | 1 | -1 = up > flat * 1.08 ? (this.view?.you === 1 ? -1 : 1) : 0;
    const w = Math.max(12, rot ? up : flat);
    const bw = w * TAC_W, bh = depth * w;
    const old = this.size;
    const sw = rot ? bh : bw, sh = rot ? bw : bh;
    this.size = { w, cw, ch, ox: band.l + (aw - sw) / 2, oy: band.t + (ah - sh) / 2, dpr, rot, bw, bh };
    c.width = Math.round(cw * dpr);
    c.height = Math.round(ch * dpr);
    c.style.width = `${cw}px`;
    c.style.height = `${ch}px`;
    this.bgKey = '';
    // The walks are kept by hexes, so a field laid out afresh needs no re-seating; the first one seats them.
    if (!old.w && this.view) for (const s of this.view.stacks) this.pos.set(s.id, { hex: s.hex, path: [s.hex], t0: 0, dur: 0, fly: false });
    return true;
  }

  private hexPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = ((60 * k - 30) * Math.PI) / 180;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
  }

  /** The neighbour across each edge of a hex (E, SE, SW, W, NW, NE) — the corners k and k+1 bound edge k. */
  private across(i: number, edge: number): number | null {
    const x = hexX(i), y = hexY(i);
    const odd = y & 1;
    const d = [[1, 0], odd ? [1, 1] : [0, 1], odd ? [0, 1] : [-1, 1], [-1, 0], odd ? [0, -1] : [-1, -1], odd ? [1, -1] : [0, -1]][edge];
    const nx = x + d[0], ny = y + d[1];
    return nx >= 0 && ny >= 0 && nx < TAC_W && ny < TAC_H ? hexIndex(nx, ny) : null;
  }

  private background(v: TacView): HTMLCanvasElement {
    const key = `${v.cells}|${this.size.cw}|${this.size.ch}|${this.size.dpr}|${v.you}|${this.size.rot}|${v.land?.type ?? ''}|${v.heroes[0].hull}|${v.heroes[1].hull}|${sprite('bg.battle_sea') ? 1 : 0}`;
    if (this.bg && key === this.bgKey) return this.bg;
    this.bgKey = key;
    const { cw, ch, dpr, w } = this.size;
    const c = (this.bg ??= document.createElement('canvas'));
    c.width = Math.round(cw * dpr);
    c.height = Math.round(ch * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    this.turned(g);
    if (v.land) {
      this.landField(g, v);
      return c;
    }
    this.planks ??= [plankTexture(false), plankTexture(true)];
    const r = w / SQ3; // the hex's corner radius
    const cells = v.cells;
    const deck = (i: number | null) => i !== null && cells[i] !== '~' && cells[i] !== '#' && cells[i] !== '=';
    // Painted decks (owner, 2026-10-02): each side's own hull's deck — the boarders' on the left, the other's mirrored on
    // the right — over the painted night sea; the brig's stands in for a hull not painted yet.
    const deckOf = (x: 0 | 1) => sprite(deckArt(v.heroes[x].hull ?? 'brig')) ?? sprite('bg.deck_brig') ?? DECK_HULLS.map((h) => sprite(`bg.deck_${h}`)).find(Boolean) ?? null;
    const decks = [deckOf(0), deckOf(1)];
    const seaArt = sprite('bg.battle_sea');
    this.painted = !!(decks[0] && decks[1] && seaArt);
    if (decks[0] && decks[1] && seaArt) {
      g.save();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      cover(g, seaArt.img, 0, 0, this.size.cw, this.size.ch);
      g.restore();
      for (const x of [0, 1] as const) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < cells.length; i++) {
          if (!deck(i) || (x === 0 ? hexX(i) >= 5 : hexX(i) <= 5)) continue;
          const p = this.lc(i);
          x0 = Math.min(x0, p.x - w / 2);
          x1 = Math.max(x1, p.x + w / 2);
          y0 = Math.min(y0, p.y - r);
          y1 = Math.max(y1, p.y + r);
        }
        if (x0 > x1) continue;
        g.save();
        g.beginPath();
        g.rect(x0, y0, x1 - x0, y1 - y0);
        g.clip();
        g.shadowColor = 'rgba(0,0,0,0.6)';
        if (x === 1) {
          g.translate(x0 + x1, 0);
          g.scale(-1, 1);
        }
        cover(g, decks[x]!.img, x0, y0, x1 - x0, y1 - y0);
        g.restore();
        // The hull's shadow on the water along its inner side.
        g.fillStyle = 'rgba(0,0,0,0.35)';
        if (x === 0) g.fillRect(x1, y0, w * 0.18, y1 - y0);
        else g.fillRect(x0 - w * 0.18, y0, w * 0.18, y1 - y0);
      }
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.lineWidth = 1;
      for (let i = 0; i < cells.length; i++) {
        if (!deck(i)) continue;
        const p = this.lc(i);
        this.hexPath(g, p.x, p.y, r);
        g.stroke();
      }
      this.boardingPlanks(g, cells, w, r);
      this.deckThings(g, cells, w, true);
      return c;
    }
    // The sea between and around the hulls.
    const sea = g.createLinearGradient(0, 0, 0, this.size.bh);
    sea.addColorStop(0, '#0b1d22');
    sea.addColorStop(1, '#07141a');
    g.fillStyle = sea;
    const b0 = this.lc(0), b1 = this.lc(TAC_W * TAC_H - 1);
    g.fillRect(b0.x - w * 0.6, b0.y - r * 1.1, b1.x - b0.x + w * 1.2, b1.y - b0.y + r * 2.2);
    g.strokeStyle = 'rgba(120,190,200,0.12)';
    g.lineWidth = 1;
    for (let y = 0; y < TAC_H * 2; y++) {
      const yy = b0.y - r + (y * (b1.y - b0.y + r * 2)) / (TAC_H * 2);
      const mid = this.lc(hexIndex(5, 0)).x;
      g.beginPath();
      g.moveTo(mid - w * 0.9, yy);
      g.quadraticCurveTo(mid, yy + 3, mid + w * 0.9, yy);
      g.stroke();
    }
    // The decks: planks, each ship her own wood (hers darker), the hex grid faint on them.
    for (let i = 0; i < cells.length; i++) {
      if (!deck(i)) continue;
      const p = this.lc(i);
      const hers = (hexX(i) > 5) === (v.you === 0);
      g.save();
      this.hexPath(g, p.x, p.y, r + 0.6);
      g.clip();
      g.fillStyle = g.createPattern(this.planks[hers ? 1 : 0], 'repeat')!;
      g.translate(0, 0);
      g.fillRect(p.x - w, p.y - r * 1.2, w * 2, r * 2.4);
      g.restore();
    }
    g.strokeStyle = 'rgba(10,6,2,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < cells.length; i++) {
      if (!deck(i)) continue;
      const p = this.lc(i);
      this.hexPath(g, p.x, p.y, r);
      g.stroke();
    }
    // The rails: every deck edge that looks on water or the field's end, a heavy timber with a light top.
    for (let i = 0; i < cells.length; i++) {
      if (!deck(i)) continue;
      const p = this.lc(i);
      for (let k = 0; k < 6; k++) {
        const n = this.across(i, k);
        if (n !== null && (deck(n) || cells[n] === '=')) continue;
        const a0 = ((60 * k - 30) * Math.PI) / 180, a1 = ((60 * (k + 1) - 30) * Math.PI) / 180;
        const x0 = p.x + r * Math.cos(a0), y0 = p.y + r * Math.sin(a0), x1 = p.x + r * Math.cos(a1), y1 = p.y + r * Math.sin(a1);
        g.lineCap = 'round';
        g.strokeStyle = '#24160b';
        g.lineWidth = Math.max(3, w * 0.16);
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
        g.strokeStyle = '#8a6a44';
        g.lineWidth = Math.max(1, w * 0.04);
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }
    this.boardingPlanks(g, cells, w, r);
    this.deckThings(g, cells, w, false);
    return c;
  }

  /** The planks across the water, lashed with the grapple lines. */
  private boardingPlanks(g: CanvasRenderingContext2D, cells: string, w: number, r: number): void {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== '=') continue;
      const p = this.lc(i);
      g.save();
      g.translate(p.x, p.y);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(-w * 0.95, -r * 0.42 + 3, w * 1.9, r * 0.84);
      const pg = g.createLinearGradient(0, -r * 0.45, 0, r * 0.45);
      pg.addColorStop(0, '#9a7446');
      pg.addColorStop(1, '#6b4b2b');
      g.fillStyle = pg;
      g.fillRect(-w * 0.95, -r * 0.45, w * 1.9, r * 0.9);
      g.strokeStyle = 'rgba(20,10,4,0.7)';
      g.lineWidth = 1;
      for (const yy of [-r * 0.15, r * 0.15]) {
        g.beginPath();
        g.moveTo(-w * 0.95, yy);
        g.lineTo(w * 0.95, yy);
        g.stroke();
      }
      g.strokeStyle = '#c9b48a';
      g.lineWidth = Math.max(1, w * 0.035);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(-w * 0.9, s * r * 0.5);
        g.quadraticCurveTo(0, s * r * 0.95, w * 0.9, s * r * 0.5);
        g.stroke();
      }
      g.restore();
    }
  }

  /** What stands on deck: drawn from above, unless it is painted as a prop (then it stands among the figures). */
  private deckThings(g: CanvasRenderingContext2D, cells: string, w: number, painted: boolean): void {
    for (let i = 0; i < cells.length; i++) {
      const c0 = cells[i];
      if (!TAC_BLOCKING.has(c0 as TacCell) || c0 === '~' || c0 === '#') continue;
      if (painted && c0 !== 'H' && propArt(c0, '')) continue;
      const p = this.lc(i);
      if (c0 === 'M') this.mast(g, p.x, p.y, w);
      else if (c0 === 'C') this.cannon(g, p.x, p.y, w, hexY(i) === 0 ? -1 : 1);
      else if (c0 === 'B') this.barrel(g, p.x, p.y, w);
      else if (c0 === 'K') this.crates(g, p.x, p.y, w);
      else if (c0 === 'H') this.hole(g, p.x, p.y, w, i);
    }
  }

  /** docs/18 II: the battlefield ashore, drawn by hand — the island's ground (warm sand, grey shingle, black volcanic
   *  sand, marsh mud, the wrack of a ship graveyard, the pale ash of the Choir's dead isles) speckled and rippled, the
   *  surf along the shore with its foam, the wet sand behind it, the rocks and the palms from above. */
  private landField(g: CanvasRenderingContext2D, v: TacView): void {
    const { w } = this.size;
    const r = w / SQ3;
    const cells = v.cells;
    const type = v.land!.type;
    const GROUND: Record<string, [string, string, string]> = {
      tropical: ['#d2b37a', '#c4a46a', '#e3c88f'], rocky: ['#8e877a', '#7d776b', '#a39c8d'], volcanic: ['#3e3532', '#332b29', '#54463f'],
      swamp: ['#5f5b3c', '#4f4c31', '#6f6a47'], graveyard: ['#86735a', '#76644d', '#9a8566'], dead: ['#59616a', '#4c535b', '#6e767e'],
    };
    const [base, dark, light] = GROUND[type] ?? GROUND.rocky;
    const b0 = this.lc(0), b1 = this.lc(TAC_W * TAC_H - 1);
    const X0 = b0.x - w * 0.6, Y0 = b0.y - r * 1.1, X1 = b1.x + w * 0.6, Y1 = b1.y + r * 1.1;
    // The island's ground painted as in Heroes (owner, 2026-10-02): the painting over the whole stage, the hexes on it.
    const art = sprite(`bg.field_${type}`);
    this.painted = !!art;
    if (art) {
      g.save();
      g.setTransform(this.size.dpr, 0, 0, this.size.dpr, 0, 0);
      cover(g, art.img, 0, 0, this.size.cw, this.size.ch);
      g.restore();
    }
    g.fillStyle = base;
    if (!art) g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    // Ripples of the wind in the sand and a speckle of shell and grit (seeded by the field, the same each draw).
    let seed = 0;
    for (let i = 0; i < cells.length; i++) seed = (seed * 31 + cells.charCodeAt(i)) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.strokeStyle = `${dark}`;
    g.globalAlpha = art ? 0 : 0.35;
    g.lineWidth = 1;
    for (let k = 0; k < 26; k++) {
      const yy = Y0 + (Y1 - Y0) * rnd(), xx = X0 + (X1 - X0) * rnd(), L0 = w * (0.8 + rnd() * 1.6);
      g.beginPath();
      g.moveTo(xx, yy);
      g.quadraticCurveTo(xx + L0 / 2, yy - w * 0.08, xx + L0, yy);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (let k = 0; k < (art ? 0 : 220); k++) {
      g.fillStyle = rnd() < 0.5 ? light : dark;
      g.globalAlpha = 0.5;
      g.fillRect(X0 + (X1 - X0) * rnd(), Y0 + (Y1 - Y0) * rnd(), 1.5, 1.5);
    }
    g.globalAlpha = 1;
    // The wet sand behind the surf, the surf itself, its foam — on a painted field a tide over its ground, not a band of
    // flat teal tiles across it.
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== 'W' || art) continue;
      const p = this.lc(i);
      g.fillStyle = 'rgba(40,30,20,0.18)';
      g.beginPath();
      g.arc(p.x, p.y, r * 1.55, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== 'W') continue;
      const p = this.lc(i);
      const sea = g.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r * 1.2);
      sea.addColorStop(0, type === 'dead' ? '#2c4650' : type === 'swamp' ? '#33463a' : '#2e7a86');
      sea.addColorStop(1, type === 'dead' ? '#22363e' : type === 'swamp' ? '#2a3a2f' : '#1f5a66');
      g.fillStyle = sea;
      g.globalAlpha = art ? 0.42 : 1;
      this.hexPath(g, p.x, p.y, r + 0.8);
      g.fill();
      g.globalAlpha = 1;
    }
    g.strokeStyle = art ? 'rgba(240,248,245,0.4)' : 'rgba(240,248,245,0.6)';
    g.lineWidth = Math.max(1, w * 0.04);
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== 'W') continue;
      const p = this.lc(i);
      for (let k = 0; k < 6; k++) {
        const n = this.across(i, k);
        if (n !== null && cells[n] === 'W') continue;
        if (n === null) continue;
        const a0 = ((60 * k - 30) * Math.PI) / 180, a1 = ((60 * (k + 1) - 30) * Math.PI) / 180;
        g.beginPath();
        g.moveTo(p.x + r * Math.cos(a0), p.y + r * Math.sin(a0));
        g.quadraticCurveTo(p.x + r * 1.08 * Math.cos((a0 + a1) / 2), p.y + r * 1.08 * Math.sin((a0 + a1) / 2), p.x + r * Math.cos(a1), p.y + r * Math.sin(a1));
        g.stroke();
      }
    }
    // The hex grid, faint on the sand.
    g.strokeStyle = art ? 'rgba(10,8,6,0.3)' : 'rgba(30,20,10,0.16)';
    g.lineWidth = 1;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === '#' || cells[i] === 'W') continue;
      const p = this.lc(i);
      this.hexPath(g, p.x, p.y, r);
      g.stroke();
    }
    // What stands on it.
    for (let i = 0; i < cells.length; i++) {
      if (propArt(cells[i], type)) continue;
      const p = this.lc(i);
      if (cells[i] === 'R') this.rock(g, p.x, p.y, w, i, type);
      else if (cells[i] === 'P') this.palm(g, p.x, p.y, w, i, type);
      else if (cells[i] === 'K') this.crates(g, p.x, p.y, w);
      else if (cells[i] === 'B') this.barrel(g, p.x, p.y, w);
    }
  }

  /** A boulder from above: a ragged grey (or black) mass, lit from the north-west, its shadow to the south-east. */
  private rock(g: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number, type: string): void {
    const n = 8;
    const pts: [number, number][] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = w * (0.3 + 0.1 * (((seed * 13 + k * 7) % 5) / 4));
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85]);
    }
    this.shadow(g, x, y, w * 0.38, w * 0.3);
    const dark = type === 'volcanic' ? ['#4a403c', '#1c1715'] : type === 'dead' ? ['#7d858c', '#3a4046'] : ['#9a958a', '#4d4a43'];
    const rg = g.createRadialGradient(x - w * 0.12, y - w * 0.12, w * 0.04, x, y, w * 0.42);
    rg.addColorStop(0, dark[0]);
    rg.addColorStop(1, dark[1]);
    g.fillStyle = rg;
    g.beginPath();
    pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.moveTo(pts[5][0], pts[5][1]);
    g.lineTo(pts[6][0], pts[6][1]);
    g.lineTo(pts[7][0], pts[7][1]);
    g.stroke();
  }

  /** A palm from above: the trunk's foot, and its fronds radiating, each a feathered blade (a mangrove's darker). */
  private palm(g: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number, type: string): void {
    this.shadow(g, x + w * 0.08, y + w * 0.06, w * 0.45, w * 0.32);
    const green = type === 'swamp' ? ['#3c5a2c', '#26391b'] : ['#4f8a38', '#2f5a22'];
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (seed % 7) * 0.3;
      const L0 = w * (0.48 + 0.08 * ((seed + k) % 3));
      const ex = x + Math.cos(a) * L0, ey = y + Math.sin(a) * L0;
      const nx = -Math.sin(a) * w * 0.09, ny = Math.cos(a) * w * 0.09;
      g.fillStyle = k % 2 ? green[0] : green[1];
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * L0 * 0.5 + nx, y + Math.sin(a) * L0 * 0.5 + ny, ex, ey);
      g.quadraticCurveTo(x + Math.cos(a) * L0 * 0.5 - nx, y + Math.sin(a) * L0 * 0.5 - ny, x, y);
      g.fill();
      g.strokeStyle = 'rgba(20,35,12,0.6)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(ex, ey);
      g.stroke();
    }
    g.fillStyle = '#6b4a2a';
    g.beginPath();
    g.arc(x, y, w * 0.08, 0, Math.PI * 2);
    g.fill();
  }

  private shadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.beginPath();
    g.ellipse(x + rx * 0.15, y + ry * 0.35, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }

  private mast(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    // The shrouds run to the rails; the mast's foot is a ring of iron.
    g.strokeStyle = 'rgba(210,190,150,0.35)';
    g.lineWidth = 1;
    for (const a of [-2.4, -0.7, 0.7, 2.4]) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * w * 1.4, y + Math.sin(a) * w * 1.1);
      g.stroke();
    }
    this.shadow(g, x, y, w * 0.36, w * 0.28);
    const rg = g.createRadialGradient(x - w * 0.1, y - w * 0.1, w * 0.04, x, y, w * 0.34);
    rg.addColorStop(0, '#a47a4a');
    rg.addColorStop(1, '#4b301a');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, w * 0.32, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1f140a';
    g.lineWidth = Math.max(1.5, w * 0.06);
    g.stroke();
    g.strokeStyle = 'rgba(40,24,10,0.6)';
    g.lineWidth = 1;
    for (const k of [0.2, 0.12]) {
      g.beginPath();
      g.arc(x, y, w * k, 0, Math.PI * 2);
      g.stroke();
    }
  }

  private cannon(g: CanvasRenderingContext2D, x: number, y: number, w: number, dir: number): void {
    this.shadow(g, x, y, w * 0.34, w * 0.24);
    // The carriage.
    g.fillStyle = '#5b3d22';
    g.strokeStyle = '#21150b';
    g.lineWidth = 1;
    g.fillRect(x - w * 0.24, y - w * 0.2, w * 0.48, w * 0.4);
    g.strokeRect(x - w * 0.24, y - w * 0.2, w * 0.48, w * 0.4);
    g.fillStyle = '#2a2a2a';
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      g.beginPath();
      g.arc(x + sx * w * 0.25, y + sy * w * 0.13, w * 0.07, 0, Math.PI * 2);
      g.fill();
    }
    // The barrel, run out to her side.
    const bg = g.createLinearGradient(x - w * 0.1, 0, x + w * 0.1, 0);
    bg.addColorStop(0, '#1a1c1f');
    bg.addColorStop(0.5, '#5a5f66');
    bg.addColorStop(1, '#1a1c1f');
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(x - w * 0.09, dir < 0 ? y - w * 0.46 : y - w * 0.08, w * 0.18, w * 0.54, w * 0.06);
    g.fill();
    g.fillStyle = '#0c0c0c';
    g.beginPath();
    g.arc(x, dir < 0 ? y - w * 0.44 : y + w * 0.44, w * 0.05, 0, Math.PI * 2);
    g.fill();
  }

  private barrel(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    this.shadow(g, x, y, w * 0.3, w * 0.24);
    const rg = g.createRadialGradient(x - w * 0.08, y - w * 0.08, w * 0.03, x, y, w * 0.3);
    rg.addColorStop(0, '#9b6d3c');
    rg.addColorStop(1, '#553519');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, w * 0.28, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2b2f33';
    g.lineWidth = Math.max(1.5, w * 0.05);
    for (const k of [0.27, 0.17]) {
      g.beginPath();
      g.arc(x, y, w * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = 'rgba(30,18,8,0.7)';
    g.lineWidth = 1;
    for (const a of [0, 1.05, 2.1]) {
      g.beginPath();
      g.moveTo(x + Math.cos(a) * w * 0.16, y + Math.sin(a) * w * 0.16);
      g.lineTo(x - Math.cos(a) * w * 0.16, y - Math.sin(a) * w * 0.16);
      g.stroke();
    }
  }

  /** A shot-hole through the deck (docs/17 H1): broken planks round a black gap, splinters sprung up at its edge. */
  private hole(g: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number): void {
    const n = 9;
    const pts: [number, number][] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const r = w * (0.26 + 0.12 * (((seed * 7 + k * 13) % 5) / 4));
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85]);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(x, y, w * 0.44, w * 0.36, 0, 0, Math.PI * 2);
    g.fill();
    const hg = g.createRadialGradient(x, y, w * 0.05, x, y, w * 0.4);
    hg.addColorStop(0, '#020303');
    hg.addColorStop(0.7, '#0b0c0c');
    hg.addColorStop(1, '#2a1a0d');
    g.fillStyle = hg;
    g.beginPath();
    pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.fill();
    g.strokeStyle = '#8a6a44';
    g.lineWidth = Math.max(1, w * 0.035);
    for (let k = 0; k < n; k += 2) {
      const [px, py] = pts[k];
      const a = (k / n) * Math.PI * 2;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a + 0.4) * w * 0.12, py + Math.sin(a + 0.4) * w * 0.1);
      g.stroke();
    }
    // Sea water glinting far below.
    g.fillStyle = 'rgba(80,150,160,0.25)';
    g.beginPath();
    g.ellipse(x + w * 0.04, y + w * 0.05, w * 0.08, w * 0.04, 0, 0, Math.PI * 2);
    g.fill();
  }

  /** A fire on deck, flickering (drawn each frame). */
  private flames(g: CanvasRenderingContext2D, x: number, y: number, w: number, t: number, seed: number): void {
    const glow = g.createRadialGradient(x, y, w * 0.05, x, y, w * 0.55);
    glow.addColorStop(0, 'rgba(255,170,60,0.55)');
    glow.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, w * 0.55, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 5; k++) {
      const ph = t / 140 + k * 1.7 + seed;
      const fx = x + (k - 2) * w * 0.1 + Math.sin(ph) * w * 0.03;
      const hgt = w * (0.28 + 0.12 * Math.abs(Math.sin(ph * 1.3)));
      const fw = w * 0.09;
      const fg = g.createLinearGradient(fx, y + w * 0.12, fx, y + w * 0.12 - hgt);
      fg.addColorStop(0, 'rgba(255,220,120,0.95)');
      fg.addColorStop(0.5, 'rgba(255,130,40,0.85)');
      fg.addColorStop(1, 'rgba(200,40,10,0)');
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(fx - fw, y + w * 0.12);
      g.quadraticCurveTo(fx - fw * 0.6, y + w * 0.12 - hgt * 0.6, fx + Math.sin(ph) * fw * 0.5, y + w * 0.12 - hgt);
      g.quadraticCurveTo(fx + fw * 0.6, y + w * 0.12 - hgt * 0.6, fx + fw, y + w * 0.12);
      g.closePath();
      g.fill();
    }
  }

  private crates(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    for (const [dx, dy, s, rot] of [[-0.12, 0.06, 0.4, -0.12], [0.14, -0.1, 0.32, 0.18]] as const) {
      const cx = x + dx * w, cy = y + dy * w, hs = (s * w) / 2;
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(-hs + 2, -hs + 3, hs * 2, hs * 2);
      g.fillStyle = '#8a6437';
      g.fillRect(-hs, -hs, hs * 2, hs * 2);
      g.strokeStyle = '#3a2410';
      g.lineWidth = Math.max(1, w * 0.035);
      g.strokeRect(-hs, -hs, hs * 2, hs * 2);
      g.beginPath();
      g.moveTo(-hs, -hs);
      g.lineTo(hs, hs);
      g.moveTo(-hs, 0);
      g.lineTo(hs, 0);
      g.stroke();
      g.restore();
    }
  }

  /** Once a frame: the clock of the turn. */
  private tick(): void {
    const v = this.view;
    const el = this.el;
    if (!v || !el) return;
    const left = Math.max(0, v.ends - this.now());
    const bar = el.querySelector<HTMLElement>('.tb-timer > i');
    if (bar) bar.style.width = `${v.over ? 0 : Math.min(1, left / 30) * 100}%`;
    const secs = el.querySelector<HTMLElement>('.tb-secs');
    if (secs) secs.textContent = v.mine && !v.over ? L('secs', { n: Math.ceil(left) }) : '';
    // A phone's clock: the ring round the turn's face, running down (no number on it).
    const face = el.querySelector<HTMLElement>('.tb-chip.turn');
    if (face) {
      const k = (v.over ? 0 : Math.min(1, left / 30)).toFixed(3);
      if (face.style.getPropertyValue('--tl') !== k) face.style.setProperty('--tl', k);
    }
    if ((this.strikeArmed && this.strikeArmed < performance.now()) || (this.ransomArmed && this.ransomArmed < performance.now())) {
      this.strikeArmed = 0;
      this.ransomArmed = 0;
      this.key = '';
      this.dom(v);
    }
  }

  private draw(): void {
    const v = this.view;
    const c = this.canvas;
    if (!v || !c) return;
    this.fit();
    const { dpr, w, cw, ch } = this.size;
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(this.background(v), 0, 0);
    this.drawn = { figures: new Map(), ghosts: 0, path: 0, walking: [] };
    // The marks on the hexes lie with the board (turned upright on a phone), the tokens and numbers stand straight.
    this.turned(g);
    const t = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(t / 260);
    const r = w / SQ3;
    // Fires still burning on her deck (docs/17 H1).
    for (let i = 0; i < v.cells.length; i++) {
      if (v.cells[i] !== 'F') continue;
      const p = this.lc(i);
      this.flames(g, p.x, p.y, w, t, i);
    }
    // The ground a great one ashore will fall on as the next round opens (shorebosses.ts): glowing, to be stepped off.
    for (const i of v.warn ?? []) {
      const p = this.lc(i);
      this.hexPath(g, p.x, p.y, r - 2);
      g.fillStyle = `rgba(230,110,60,${0.12 + 0.14 * pulse})`;
      g.fill();
      g.strokeStyle = `rgba(245,150,90,${0.45 + 0.45 * pulse})`;
      g.lineWidth = 2;
      g.stroke();
    }
    // The reach of the stack whose turn it is (docs/23 item 58: big and plain): a veil and a bright rim on every hex
    // it may step to — on a phone thicker and lighter, so a thumb sees it at arm's length.
    const big = this.phone;
    // Her turn's marks once what came before it is played (owner, 2026-10-08).
    const live = v.mine && !v.over && !this.busy();
    if (live) {
      for (const h of v.reach) {
        const p = this.lc(h);
        this.hexPath(g, p.x, p.y, r - 1.5);
        // On a painting the reach is a light veil and a bright rim, so the planks show through (as in Heroes).
        const p0 = this.painted ? 0.6 : 1;
        g.fillStyle = h === this.preview ? `rgba(46,230,200,${0.5 * p0})` : h === this.hover ? `rgba(46,230,200,${0.36 * p0})` : `rgba(46,230,200,${(big ? 0.24 : 0.16) * p0})`;
        g.fill();
        g.strokeStyle = this.painted ? `rgba(210,255,240,${big ? 0.75 : 0.5})` : `rgba(90,245,215,${big ? 0.85 : 0.6})`;
        g.lineWidth = big ? 2 : 1.2;
        g.stroke();
      }
    }
    const active = v.stacks.find((s) => s.id === v.active);
    if (active) {
      const p = this.lc(active.hex);
      this.hexPath(g, p.x, p.y, r - 1);
      g.fillStyle = `rgba(224,184,98,${0.18 + 0.12 * pulse})`;
      g.fill();
    }
    // Whom the active stack may strike or fire on: the hex washed red and ringed, the crosshair for a shot; a foe
    // that will strike back (it has its answer left this round) wears an orange curl at its corner; the foe tapped once
    // (with «a second tap to be sure») a bright ring.
    if (live) {
      const aimOwn = this.targetKind() === 'own';
      for (const s of v.stacks) {
        const shoot = v.shoot.includes(s.id), melee = v.melee.includes(s.id);
        const aimed = !!this.targeting && (aimOwn ? s.side === v.you : s.side !== v.you);
        if (!shoot && !melee && !aimed) continue;
        const p = this.lc(s.hex);
        this.hexPath(g, p.x, p.y, r - 1);
        if (!this.targeting) {
          g.fillStyle = `rgba(215,60,40,${0.14 + 0.12 * pulse})`;
          g.fill();
        }
        const armed = this.foeArmed === s.id;
        g.strokeStyle = armed ? `rgba(255,236,190,${0.75 + 0.25 * pulse})` : this.targeting ? `rgba(240,160,60,${0.6 + 0.4 * pulse})` : `rgba(235,75,55,${0.65 + 0.35 * pulse})`;
        g.lineWidth = armed ? 4 : big ? 3.5 : 2.5;
        g.stroke();
        if (shoot || this.targeting) {
          g.lineWidth = big ? 2 : 1.5;
          g.beginPath();
          g.arc(p.x, p.y, w * 0.5, 0, Math.PI * 2);
          for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            g.moveTo(p.x + Math.cos(a) * w * 0.4, p.y + Math.sin(a) * w * 0.4);
            g.lineTo(p.x + Math.cos(a) * w * 0.6, p.y + Math.sin(a) * w * 0.6);
          }
          g.stroke();
        }
        if (melee && !shoot && !this.targeting && s.ret) this.retMark(g, p.x + w * 0.36, p.y - r * 0.62, Math.max(5, w * 0.16), pulse);
      }
    }
    // The walk it would take, hex by hex (a flier's glide, an arc over the field), on the deck under the figures.
    {
      const aim = this.aim(v);
      if (aim !== null && active && !this.walkingAt(v, t)) this.walkMark(g, v, active, aim, r, pulse);
    }
    // The foe under the pointer (owner, 2026-10-08): the hex she would strike it from, ringed — amber when the blow
    // comes into its side or from behind — and a blade's line from there into it.
    const pvNow = live ? this.pvOf(v) : null;
    if (pvNow && !pvNow.shot && pvNow.from !== undefined) {
      const tgt = v.stacks.find((x) => x.id === pvNow.t);
      const p = this.lc(pvNow.from);
      const col = pvNow.fl ? `rgba(255,181,74,${0.75 + 0.25 * pulse})` : `rgba(240,255,248,${0.6 + 0.3 * pulse})`;
      this.hexPath(g, p.x, p.y, r - 2.5);
      g.fillStyle = pvNow.fl ? 'rgba(255,170,60,0.22)' : 'rgba(240,255,248,0.14)';
      g.fill();
      g.strokeStyle = col;
      g.lineWidth = big ? 3.5 : 2.5;
      g.stroke();
      if (tgt) {
        const q = this.lc(tgt.hex);
        const ux = q.x - p.x, uy = q.y - p.y, len = Math.hypot(ux, uy) || 1;
        const ax = p.x + (ux / len) * w * 0.3, ay = p.y + (uy / len) * w * 0.3, bx = q.x - (ux / len) * w * 0.28, by = q.y - (uy / len) * w * 0.28;
        g.strokeStyle = col;
        g.lineWidth = Math.max(2, w * 0.06);
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
        const hw = w * 0.13;
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(bx + (ux / len) * hw, by + (uy / len) * hw);
        g.lineTo(bx - (uy / len) * hw * 0.8, by + (ux / len) * hw * 0.8);
        g.lineTo(bx + (uy / len) * hw * 0.8, by - (ux / len) * hw * 0.8);
        g.closePath();
        g.fill();
      }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The stacks, the active one ringed in gold; the figures back to front, so the nearer stands before the farther.
    // While blows are being played each shows the count it had till they land; the fallen stand till then (owner,
    // 2026-10-08: how many died, seen as it happens).
    const shown: TacStackView[] = v.stacks.map((s) => {
      const n = this.countNow(s, t);
      return n === s.count ? s : { ...s, count: n };
    });
    const fading: { s: TacStackView; k: number }[] = [];
    for (const [id, f] of this.fallen) {
      if (t > f.at + 520) this.fallen.delete(id);
      else if (t >= f.at) fading.push({ s: f.s, k: 1 - (t - f.at) / 520 });
      else shown.push({ ...f.s, count: Math.max(1, this.countNow(f.s, t)) });
    }
    const placed: { s?: TacStackView; prop?: string; i?: number; p: { x: number; y: number; lift?: number; walking?: boolean; dx?: number } }[] = shown.map((s) => ({ s, p: this.standAt(s, t) }));
    const walking = placed.some((x) => x.p.walking);
    for (let i = 0; i < v.cells.length; i++) {
      const prop = propArt(v.cells[i], v.land?.type ?? '');
      if (prop) placed.push({ prop, i, p: this.center(i) });
    }
    // In one row the bigger first: a giant stands no nearer than the man beside it, so it must not cover him.
    const bulk = (x: (typeof placed)[number]): number => (x.s ? figureSize(x.s) : 1);
    placed.sort((a, b) => a.p.y - b.p.y || bulk(b) - bulk(a) || a.p.x - b.p.x);
    this.plates = [];
    for (const x of placed) {
      if (x.s) {
        this.liftNow = x.p.lift ?? 0;
        this.walkDx = x.p.walking ? x.p.dx ?? 0 : 0;
        this.token(g, x.s, x.p.x, x.p.y, w, x.s.id === v.active && !x.p.walking && live, pulse, v);
        this.liftNow = 0;
        this.walkDx = 0;
        this.drawn.figures.set(x.s.id, (this.drawn.figures.get(x.s.id) ?? 0) + 1);
        if (x.p.walking) this.drawn.walking.push(x.s.id);
      } else this.prop(g, x.prop!, x.p.x, x.p.y, w, hexX(x.i!) > 5);
    }
    for (const f of this.plates) f();
    this.plates = null;
    // The fallen fading where they fell.
    for (const f of fading) this.ghost(g, f.s, f.s.hex, v, Math.max(0, f.k) * 0.9, 'grayscale(0.6) brightness(0.8)');
    // A ghost of the stack where it would step (owner, 2026-10-05: «фигурка не имеет прозрачности … она как бы
    // задваивается»): dim and whole, drawn on its own layer, without its number; none while a stack walks.
    const aim = this.aim(v);
    if (aim !== null && active && !walking) this.ghost(g, active, aim, v, this.preview !== null ? 0.55 : 0.32);
    // The paths' moves (docs/18): their light over the field.
    this.pathFx = this.pathFx.filter((f) => t - f.t0 < (f.ult ? PATH_FX_MS.ult : PATH_FX_MS.innate));
    for (const f of this.pathFx) this.drawPathFx(g, f, t, w);
    // Shots and throws in flight, turned along their path.
    this.missiles = this.missiles.filter((m) => t - m.t0 < m.dur);
    for (const m of this.missiles) {
      const k = (t - m.t0) / m.dur;
      if (k < 0) continue;
      const img = sprite(m.id)!.img;
      const x = m.x0 + (m.x1 - m.x0) * k, y = m.y0 + (m.y1 - m.y0) * k - m.arc * 4 * k * (1 - k);
      const dy = m.y1 - m.y0 - m.arc * 4 * (1 - 2 * k);
      const L = w * (m.id === 'part.ms_harpoon' || m.id === 'part.ms_spear' || m.id === 'part.ms_rocket' ? 0.9 : 0.45);
      const H = (L * img.naturalHeight) / img.naturalWidth;
      g.save();
      g.translate(x, y);
      g.rotate(Math.atan2(dy, m.x1 - m.x0));
      g.drawImage(img, -L / 2, -H / 2, L, H);
      g.restore();
    }
    // Bursts of powder, splinters and smoke: the painted four-frame effects where there are, added as light.
    this.bursts = this.bursts.filter((b) => t - b.t0 < 700);
    for (const b of this.bursts) {
      const k = (t - b.t0) / 700;
      if (k < 0) continue;
      const fx = FX_OF[b.id] ?? (b.id.startsWith('fx.') ? b.id : null);
      const frame = fx ? sprite(`${fx}_${Math.min(3, Math.floor(k * 4))}`) : null;
      if (frame) {
        const s = b.size * 1.35;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
        g.drawImage(frame.img, b.x - s / 2, b.y - s / 2, s, s);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        continue;
      }
      const sp = sprite(b.id);
      g.globalAlpha = Math.max(0, 1 - k);
      const s = b.size * (0.7 + k * 0.5);
      if (sp) g.drawImage(sp.img, b.x - s / 2, b.y - s / 2, s, s);
      else {
        g.fillStyle = b.id === 'part.explosion' ? '#f0a040' : 'rgba(200,200,200,0.6)';
        g.beginPath();
        g.arc(b.x, b.y, s / 2, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    // The captains at their corners, under the names of what they did.
    this.heroFx = this.heroFx.filter((h) => t - h.t0 < h.dur);
    for (const h of this.heroFx) this.drawHero(g, v, h, t, w, cw, ch);
    // The numbers over the stacks.
    this.floats = this.floats.filter((f) => t - f.t0 < (f.big ? 1600 : 1200));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = (t - f.t0) / (f.big ? 1600 : 1200);
      if (k < 0) continue; // a blow's number waits for the walk that brings it
      g.globalAlpha = Math.max(0, 1 - k * k);
      g.font = `700 ${Math.round((f.big ? Math.max(15, w * 0.55) : Math.max(11, w * 0.36)) * (f.size ?? 1))}px ${f.big ? 'Cormorant Garamond, Georgia, serif' : 'Inter, system-ui, sans-serif'}`;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      const y = f.y - k * w * 0.6;
      // Kept on the board: a name over a stack at the rail does not run off it (docs/18).
      const half = g.measureText(f.text).width / 2 + 4;
      const x = Math.max(half, Math.min(cw - half, f.x));
      g.strokeText(f.text, x, y);
      g.fillStyle = f.color;
      g.fillText(f.text, x, y);
      g.globalAlpha = 1;
    }
    void cw;
    void ch;
    // The preview beside the foe aimed at (owner, 2026-10-08).
    this.tipDom(v);
  }

  /** A path's move drawn over the field (docs/18 items 1 and 5), procedurally: its colour washing over the decks, and
   *  each path its own figure — the corsair's powder flashes, the smuggler's fog banks, the Reaver's red slashes, the
   *  navigator's wind spirals, the Drowned's rising bubbles, the Admiral's golden line. The ultimate fills the board. */
  private drawPathFx(g: CanvasRenderingContext2D, f: PathFx, t: number, w: number): void {
    const dur = f.ult ? PATH_FX_MS.ult : PATH_FX_MS.innate;
    const k = Math.max(0, Math.min(1, (t - f.t0) / dur));
    const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    const [r, gg, b] = PATH_RGB[f.path];
    const rgba = (a: number) => `rgba(${r},${gg},${b},${Math.max(0, a).toFixed(3)})`;
    const { cw, ch } = this.size;
    const cx = cw / 2, cy = ch / 2;
    g.save();
    if (f.ult) {
      // The whole board: a wash of the path's colour, a ring rolling outward, a second after it.
      const R = Math.hypot(cw, ch) / 2;
      const wash = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      wash.addColorStop(0, rgba(0.28 * fade));
      wash.addColorStop(1, rgba(0.05 * fade));
      g.fillStyle = wash;
      g.fillRect(0, 0, cw, ch);
      for (const d of [0, 0.25]) {
        const kk = Math.max(0, k - d);
        g.strokeStyle = rgba(0.7 * fade * (1 - kk));
        g.lineWidth = Math.max(2, w * 0.18 * (1 - kk));
        g.beginPath();
        g.arc(cx, cy, R * kk, 0, Math.PI * 2);
        g.stroke();
      }
    }
    const spots = f.at.length ? f.at : [{ x: cx, y: cy }];
    const size = w * (f.ult ? 1.5 : 1.1);
    spots.forEach((p, i) => {
      const ph = k * Math.PI * 2 + i * 1.7;
      if (f.path === 'corsair') {
        // Powder flashes: a star of light at each stack, flickering.
        const fl = 0.5 + 0.5 * Math.sin(ph * 6);
        const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * (0.6 + 0.3 * fl));
        gl.addColorStop(0, `rgba(255,240,200,${(0.9 * fade).toFixed(3)})`);
        gl.addColorStop(0.4, rgba(0.6 * fade));
        gl.addColorStop(1, rgba(0));
        g.fillStyle = gl;
        g.beginPath();
        g.arc(p.x, p.y, size, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = `rgba(255,230,170,${(0.8 * fade).toFixed(3)})`;
        g.lineWidth = 1.5;
        for (let a = 0; a < 8; a++) {
          const an = a * (Math.PI / 4) + ph;
          g.beginPath();
          g.moveTo(p.x + Math.cos(an) * size * 0.25, p.y + Math.sin(an) * size * 0.25);
          g.lineTo(p.x + Math.cos(an) * size * (0.7 + 0.3 * fl), p.y + Math.sin(an) * size * (0.7 + 0.3 * fl));
          g.stroke();
        }
      } else if (f.path === 'smuggler') {
        // Fog banks drifting over them.
        for (let j = 0; j < 4; j++) {
          const dx = Math.sin(ph + j) * size * 0.5 + (k - 0.5) * size * 0.8;
          const fg = g.createRadialGradient(p.x + dx, p.y + (j - 1.5) * size * 0.2, 0, p.x + dx, p.y, size * 0.9);
          fg.addColorStop(0, rgba(0.5 * fade));
          fg.addColorStop(1, rgba(0));
          g.fillStyle = fg;
          g.beginPath();
          g.arc(p.x + dx, p.y + (j - 1.5) * size * 0.2, size * 0.9, 0, Math.PI * 2);
          g.fill();
        }
      } else if (f.path === 'reaver') {
        // Red slashes crossing each stack.
        g.strokeStyle = rgba(0.9 * fade);
        g.lineCap = 'round';
        for (let j = 0; j < 3; j++) {
          const kk = Math.min(1, k * 3 - j * 0.3);
          if (kk <= 0) continue;
          const an = -0.8 + j * 0.8;
          g.lineWidth = Math.max(2, w * 0.1);
          g.beginPath();
          g.moveTo(p.x - Math.cos(an) * size * 0.7, p.y - Math.sin(an) * size * 0.7);
          g.lineTo(p.x - Math.cos(an) * size * 0.7 + Math.cos(an) * size * 1.4 * kk, p.y - Math.sin(an) * size * 0.7 + Math.sin(an) * size * 1.4 * kk);
          g.stroke();
        }
      } else if (f.path === 'navigator') {
        // Wind spirals turning round them.
        g.strokeStyle = rgba(0.8 * fade);
        g.lineWidth = 1.6;
        for (let j = 0; j < 3; j++) {
          g.beginPath();
          for (let q = 0; q <= 24; q++) {
            const a = ph * 2 + j * 2.1 + q * 0.26;
            const rr = size * (0.2 + q / 30);
            const xx = p.x + Math.cos(a) * rr, yy = p.y + Math.sin(a) * rr * 0.7;
            if (q) g.lineTo(xx, yy);
            else g.moveTo(xx, yy);
          }
          g.stroke();
        }
      } else if (f.path === 'drowned') {
        // The deep rising: bubbles and a cold glow.
        const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
        gl.addColorStop(0, rgba(0.45 * fade));
        gl.addColorStop(1, rgba(0));
        g.fillStyle = gl;
        g.beginPath();
        g.arc(p.x, p.y, size, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = `rgba(200,255,240,${(0.8 * fade).toFixed(3)})`;
        g.lineWidth = 1.2;
        for (let j = 0; j < 6; j++) {
          const bx = p.x + Math.sin(j * 2.3 + i) * size * 0.6;
          const by = p.y + size * 0.6 - ((k * 1.6 + j * 0.17) % 1) * size * 1.4;
          g.beginPath();
          g.arc(bx, by, Math.max(1.5, w * 0.05 * (1 + (j % 3))), 0, Math.PI * 2);
          g.stroke();
        }
      } else {
        // The Admiral's line: a golden bar drawn through them, and a flare where it passes.
        const gl = g.createLinearGradient(p.x - size, p.y, p.x + size, p.y);
        gl.addColorStop(0, rgba(0));
        gl.addColorStop(Math.max(0.01, Math.min(0.99, k)), rgba(0.95 * fade));
        gl.addColorStop(1, rgba(0));
        g.fillStyle = gl;
        g.fillRect(p.x - size, p.y - w * 0.08, size * 2, w * 0.16);
        g.strokeStyle = rgba(0.6 * fade);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(p.x, p.y, w * 0.48 + 3 * Math.sin(ph * 3), 0, Math.PI * 2);
        g.stroke();
      }
    });
    g.restore();
  }

  /** A captain steps in at her corner as she gives an order (one at a time a side: a second order restarts her). */
  private heroStep(side: number | undefined, t: number): void {
    if (side === undefined) return;
    this.heroFx = this.heroFx.filter((h) => h.side !== side);
    this.heroFx.push({ side, t0: t, dur: 1400 });
  }

  /** Her captain's figure (unit.hero_<path>, four poses like the stacks'): slid in from her edge of the field at its
   *  foot, the order given in the blow's pose, then gone; the right side's mirrored to face the left. */
  private drawHero(g: CanvasRenderingContext2D, v: TacView, h: { side: number; t0: number; dur: number }, t: number, w: number, cw: number, ch: number): void {
    const hv = v.heroes[h.side];
    const id = `unit.hero_${hv?.captain ?? hv?.path ?? ''}`;
    const base = sprite(id)?.img;
    if (!base || t < h.t0) return;
    const k = (t - h.t0) / h.dur;
    const frame = k > 0.2 && k < 0.72 && sprite(`${id}_atk`) ? `${id}_atk` : k >= 0.72 && sprite(`${id}_b`) ? `${id}_b` : id;
    const img = sprite(frame)!.img;
    const sc = Math.min(ch * 0.4, w * 2.7) / base.naturalHeight;
    const W = img.naturalWidth * sc, H = img.naturalHeight * sc;
    const fade = Math.max(0, Math.min(1, k / 0.14, (1 - k) / 0.2));
    const left = h.side === 0;
    const x = left ? w * 0.15 - (1 - Math.min(1, k / 0.14)) * w : cw - w * 0.15 + (1 - Math.min(1, k / 0.14)) * w;
    const y = ch - w * 0.12;
    g.save();
    g.globalAlpha = fade;
    // A shade behind her, so she reads against the deck.
    const cx = x + (left ? 1 : -1) * base.naturalWidth * sc * 0.5;
    const glow = g.createRadialGradient(cx, y - H * 0.45, 0, cx, y - H * 0.45, H * 0.7);
    glow.addColorStop(0, 'rgba(0,0,0,0.5)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(cx - H * 0.7, y - H * 1.15, H * 1.4, H * 1.4);
    g.translate(x, y);
    if (!left) g.scale(-1, 1);
    g.drawImage(img, 0, -H, W, H);
    g.restore();
  }

  /** A painted prop standing on its hex: its foot at the hex's foot, a shadow under it; the right deck's mirrored. */
  private prop(g: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, flip: boolean): void {
    const img = sprite(id)!.img;
    const [bw, bh] = PROP_BOX[id] ?? [1.1, 1.2];
    const k = Math.min((bw * w) / img.naturalWidth, (bh * w) / img.naturalHeight);
    const W = img.naturalWidth * k, H = img.naturalHeight * k;
    const fy = y + (w / SQ3) * 0.45;
    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.beginPath();
    g.ellipse(x, fy, Math.min(W * 0.5, w * 0.45), w * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(x, fy);
    if (flip) g.scale(-1, 1);
    g.drawImage(img, -W * footX(id, img), -H, W, H);
    g.restore();
  }

  /** A stack as in Heroes: its kind's full figure standing on the hex, facing the other side, a ring of its side's
   *  colour at its feet, its number on a plate at the hex's foot; it breathes, lunges at whom it strikes, flinches when
   *  struck. The marks the paths' moves lay on it keep to the ring and the plate. */
  private figure(g: CanvasRenderingContext2D, s: TacStackView, id: string, x: number, y: number, w: number, on: boolean, pulse: number, v: TacView): void {
    const base = sprite(id)!.img;
    const t = performance.now();
    const col = s.side === v.you ? YOU : FOE;
    const r = w / SQ3;
    const fy = y + r * 0.42; // the feet
    const rx = w * 0.4, ry = w * 0.15;
    // The blow being played.
    let ox = 0, oy = 0, flash = 0;
    // Its painted frames where it has them (four poses: idle, a breath, the blow, the flinch): the blow and the flinch
    // while they play, otherwise the idle pose with a breath now and then.
    let frame = id;
    const breath = (t + s.id * 977) % 3200;
    if (breath > 2500 && sprite(`${id}_b`)) frame = `${id}_b`;
    const a = this.actNow(s.id, t);
    const calm = this.calm();
    if (a) {
      if (a.k === 'atk') {
        // The lunge (owner, 2026-10-08: a clear blow): a wind-up drawn back, the strike at full stretch as the blow
        // lands, then the step back to its hex.
        let f: number;
        if (t < a.hit) {
          const k = (t - a.t0) / Math.max(1, a.hit - a.t0);
          f = k < 0.4 ? -0.16 * Math.sin((k / 0.4) * (Math.PI / 2)) : -0.16 + 1.16 * (1 - (1 - (k - 0.4) / 0.6) ** 3);
        } else f = 1 - easeOut((t - a.hit) / 300);
        if (t >= a.t0 + (a.hit - a.t0) * 0.4 && sprite(`${id}_atk`)) frame = `${id}_atk`;
        if (!calm) {
          ox = a.dx * w * 0.4 * f;
          oy = a.dy * w * 0.4 * f;
        }
      } else if (a.k === 'shot') {
        const k = (t - a.t0) / 420;
        if (sprite(`${id}_atk`)) frame = `${id}_atk`;
        const bell = calm || k < 0.1 ? 0 : Math.sin(Math.PI * Math.min(1, (k - 0.1) / 0.6));
        ox = -a.dx * w * 0.09 * bell;
        oy = -a.dy * w * 0.09 * bell;
      } else {
        // Struck: a flash as it lands, and a flinch.
        const k = (t - a.t0) / 480;
        if (sprite(`${id}_hit`)) frame = `${id}_hit`;
        if (!calm) ox = a.dx * w * 0.08 * Math.sin(k * Math.PI * 5) * (1 - k);
        flash = k < 0.45 ? 1 - k / 0.45 : 0;
      }
    }
    // The ground under it: a shadow, the side's ring, the gold of the one whose turn it is.
    g.fillStyle = 'rgba(0,0,0,0.42)';
    g.beginPath();
    g.ellipse(x + ox * 0.4, fy + oy * 0.4, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = col;
    g.globalAlpha = 0.85;
    g.lineWidth = Math.max(1.5, w * 0.045);
    g.beginPath();
    g.ellipse(x, fy, rx, ry, 0, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    if (on) {
      g.strokeStyle = `rgba(240,200,110,${0.55 + 0.45 * pulse})`;
      g.lineWidth = Math.max(2.5, w * 0.07);
      g.beginPath();
      g.ellipse(x, fy, rx + 4, ry + 2.5, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // The way it faces (owner, 2026-10-08: blows into its side or from behind land harder): a point of its side's
    // colour on the ring, toward its front.
    if (!this.walkDx) {
      const f = this.faceVec(s);
      const ex = x + f.x * rx, ey = fy + f.y * ry;
      const nx = f.x * ry, ny = f.y * rx, nl = Math.hypot(nx, ny) || 1;
      const ux = nx / nl, uy = ny / nl, len = Math.max(5, w * 0.14), half = Math.max(3.5, w * 0.1);
      g.fillStyle = col;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(ex + ux * len, ey + uy * len);
      g.lineTo(ex - uy * half, ey + ux * half);
      g.lineTo(ex + uy * half, ey - ux * half);
      g.closePath();
      g.fill();
      g.stroke();
    }
    if (s.again) {
      g.strokeStyle = `rgba(120,200,255,${0.6 + 0.4 * pulse})`;
      g.lineWidth = 2;
      g.setLineDash([4, 3]);
      g.beginPath();
      g.ellipse(x, fy, rx + 8, ry + 5, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    if (s.braced) {
      g.strokeStyle = '#c9a45a';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x, fy, rx + 2, ry + 1.5, 0, Math.PI * 0.1, Math.PI * 0.9);
      g.stroke();
    }
    // The figure: its own size, facing the other side (the painting faces right), breathing.
    const size = figureSize(s);
    // One scale for all its frames, from the idle pose; each frame stands on its own feet; no wider than two hexes.
    const k = Math.min((size * w) / base.naturalHeight, (Math.min(size * 1.25, 2) * w) / base.naturalWidth);
    const img = sprite(frame)?.img ?? base;
    const breathe = frame === id ? 1 + 0.012 * Math.sin(t / 620 + s.id * 1.7) : 1;
    const H = img.naturalHeight * k * breathe, W = img.naturalWidth * k;
    // It faces the way it last went (owner, 2026-10-08), walking the way it walks; the painting faces right.
    const flip = this.walkDx ? this.walkDx < 0 : this.facesLeft(s);
    const fx = footX(frame, img);
    const lift = (s.sp.includes('flying') ? w * 0.28 * (1 + 0.15 * Math.sin(t / 300 + s.id)) : 0) + this.liftNow;
    g.save();
    g.translate(x + ox, fy + oy - lift);
    if (flip) g.scale(-1, 1);
    const tint = standTint(s, id);
    if (s.blind) g.filter = 'grayscale(0.7) brightness(0.8)';
    else if (flash) g.filter = `${tint ?? ''} brightness(${(1 + flash * 1.6).toFixed(2)}) sepia(${(flash * 0.7).toFixed(2)}) saturate(${(1 + flash * 2).toFixed(2)}) hue-rotate(-25deg)`.trim();
    else if (tint) g.filter = tint;
    g.drawImage(img, -W * fx, -H, W, H);
    g.filter = 'none';
    // The struck stack's flash (owner, 2026-10-08): a burst of light over it as the blow lands.
    if (flash > 0) {
      const cy = -H * 0.5;
      const glow = g.createRadialGradient(0, cy, 0, 0, cy, Math.max(W, H) * 0.62);
      glow.addColorStop(0, `rgba(255,240,215,${(0.75 * flash).toFixed(3)})`);
      glow.addColorStop(0.45, `rgba(240,90,50,${(0.45 * flash).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(200,40,20,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = glow;
      g.fillRect(-W, cy - H * 0.7, W * 2, H * 1.4);
      g.globalCompositeOperation = 'source-over';
    }
    if (s.wet) {
      // Under the surf: the water over its lower half.
      g.fillStyle = 'rgba(30,100,120,0.45)';
      g.fillRect(-W * fx, -H * 0.45, W, H * 0.45);
    }
    g.restore();
    const top = fy - lift - H;
    if (s.marked) {
      const cy = top + H * 0.35, R0 = Math.max(8, w * 0.22);
      g.strokeStyle = `rgba(240,120,60,${0.6 + 0.4 * pulse})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, cy, R0, 0, Math.PI * 2);
      for (const an of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        g.moveTo(x + Math.cos(an) * (R0 - 4), cy + Math.sin(an) * (R0 - 4));
        g.lineTo(x + Math.cos(an) * (R0 + 5), cy + Math.sin(an) * (R0 + 5));
      }
      g.stroke();
    }
    if (s.noRet) {
      g.strokeStyle = 'rgba(230,60,50,0.9)';
      g.lineWidth = 2;
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.moveTo(x + sx * (rx - 2), fy - 2);
        g.lineTo(x + sx * (rx + 7), fy - 6);
        g.stroke();
      }
    }
    if (s.poisoned) {
      g.fillStyle = 'rgba(140,220,90,0.9)';
      for (let j = 0; j < 3; j++) {
        g.beginPath();
        g.arc(x - rx * 0.9 + j * Math.max(4, w * 0.1), top + H * 0.15 + ((t / 9 + j * 13) % 14), Math.max(1.5, w * 0.04), 0, Math.PI * 2);
        g.fill();
      }
    }
    // Its number on a plate at the hex's foot, on the side it faces, and what is left of it beneath.
    // Drawn after every figure (a giant beside it must not hide its number).
    const plate = (): void => {
      const txt = String(s.count);
      g.font = `700 ${Math.round(Math.max(10, w * 0.28))}px Inter, system-ui, sans-serif`;
      const tw = Math.max(g.measureText(txt).width + 8, w * 0.36);
      const th = Math.max(12, w * 0.3);
      const px = flip ? x - w * 0.47 : x + w * 0.47 - tw, py = fy + ry * 0.2;
      g.fillStyle = s.side === v.you ? 'rgba(14,40,52,0.95)' : 'rgba(52,16,14,0.95)';
      g.strokeStyle = '#c9a45a';
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(px, py, tw, th, 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#f2ead8';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(txt, px + tw / 2, py + th / 2 + 0.5);
      const frac = Math.max(0, Math.min(1, ((s.count - 1) * s.hpMax + s.hp) / Math.max(1, s.start * s.hpMax)));
      const bh = Math.max(2.5, w * 0.06);
      g.fillStyle = 'rgba(0,0,0,0.75)';
      g.fillRect(px - 1, py + th + 1, tw + 2, bh + 2);
      g.fillStyle = frac > 0.5 ? '#6fb46a' : frac > 0.25 ? '#d8a640' : '#d0503e';
      g.fillRect(px, py + th + 2, tw * frac, bh);
      // Defending: a small shield beside the plate; muskets: the shots left over it.
      if (s.defending) {
        const ss = Math.max(7, w * 0.2), sx = flip ? px + tw + 3 : px - ss - 3, sy = py - 1;
        g.fillStyle = '#b08d57';
        g.strokeStyle = '#1b1208';
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx + ss, sy);
        g.lineTo(sx + ss, sy + ss * 0.6);
        g.quadraticCurveTo(sx + ss / 2, sy + ss * 1.25, sx, sy + ss * 0.6);
        g.closePath();
        g.fill();
        g.stroke();
      }
      if (s.shotsMax) {
        g.fillStyle = '#e0b862';
        const d = Math.max(3, w * 0.09);
        for (let j = 0; j < s.shots; j++) {
          g.beginPath();
          g.arc(px + 3 + j * d, py - Math.max(3, w * 0.06), Math.max(1.2, w * 0.03), 0, Math.PI * 2);
          g.fill();
        }
      }
    };
    if (this.plates) this.plates.push(plate);
    else plate();
  }

  private token(g: CanvasRenderingContext2D, s: TacStackView, x: number, y: number, w: number, on: boolean, pulse: number, v: TacView): void {
    const fig = figureArt(s);
    if (fig) {
      this.figure(g, s, fig, x, y, w, on, pulse, v);
      return;
    }
    const R = w * 0.4;
    const col = s.side === v.you ? YOU : FOE;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.ellipse(x + R * 0.12, y + R * 0.3, R * 1.02, R * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    if (on) {
      g.strokeStyle = `rgba(240,200,110,${0.55 + 0.45 * pulse})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, R + 3.5, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#15110d';
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.fill();
    const sp = sprite(stackArt(s));
    if (sp) {
      g.save();
      g.beginPath();
      g.arc(x, y, R - 1.5, 0, Math.PI * 2);
      g.clip();
      const iw = sp.img.naturalWidth, ih = sp.img.naturalHeight;
      const k = (R * 2.1) / Math.min(iw, ih);
      // docs/18 II: a creature with no picture of its own is a tinted token of one that is.
      const tint = s.unit ? BEAST_TINT[s.unit as keyof typeof BEAST_TINT] ?? (isBossUnit(s.unit) ? BOSS_UNIT_STAND_IN[s.unit].tint : undefined) : undefined;
      if (tint) g.filter = tint;
      g.drawImage(sp.img, x - (iw * k) / 2, y - (ih * k) / 2, iw * k, ih * k);
      g.filter = 'none';
      if (s.wet) {
        // Under the surf: a veil of water over it.
        g.fillStyle = 'rgba(40,120,140,0.38)';
        g.fillRect(x - R, y - R * 0.1, R * 2, R * 1.2);
      }
      g.restore();
      if (tint) {
        g.strokeStyle = '#a8894e';
        g.lineWidth = Math.max(1.2, w * 0.035);
        g.beginPath();
        g.arc(x, y, R - Math.max(2, w * 0.05), 0, Math.PI * 2);
        g.stroke();
      }
    } else {
      g.fillStyle = col;
      g.font = `700 ${Math.round(R)}px Inter, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(s.unit ? UNITS[s.unit].tier : ''), x, y);
    }
    g.strokeStyle = col;
    g.lineWidth = Math.max(2, w * 0.07);
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.stroke();
    // An upgraded kind: a thin gold ring inside the side's colour; its tier in pips over the head.
    const d = s.unit ? UNITS[s.unit] : null;
    if (d?.up) {
      g.strokeStyle = '#e0b862';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, R - Math.max(2, w * 0.07), 0, Math.PI * 2);
      g.stroke();
    }
    if (d && w >= 22) {
      g.fillStyle = d.up ? '#e0b862' : 'rgba(240,230,210,0.8)';
      for (let k = 0; k < d.tier; k++) {
        g.beginPath();
        g.arc(x + (k - (d.tier - 1) / 2) * Math.max(2.6, w * 0.075), y - R - (s.shotsMax ? 8 : 3), Math.max(0.9, w * 0.024), 0, Math.PI * 2);
        g.fill();
      }
    }
    // docs/18: what the paths' moves lay on her — blinded shooters (a grey veil), another turn (a blue ring), blows
    // unanswered (red notches), a braced stack (a brass rim).
    if (s.blind) {
      g.fillStyle = 'rgba(160,170,165,0.55)';
      g.beginPath();
      g.arc(x, y, R, Math.PI * 1.05, Math.PI * 1.95);
      g.lineTo(x, y - R * 0.15);
      g.fill();
    }
    if (s.again) {
      g.strokeStyle = `rgba(120,200,255,${0.6 + 0.4 * pulse})`;
      g.lineWidth = 2;
      g.setLineDash([4, 3]);
      g.beginPath();
      g.arc(x, y, R + 4.5, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    if (s.noRet) {
      g.strokeStyle = 'rgba(230,60,50,0.9)';
      g.lineWidth = 2;
      for (const a of [-2.4, -0.7]) {
        g.beginPath();
        g.moveTo(x + Math.cos(a) * (R - 3), y + Math.sin(a) * (R - 3));
        g.lineTo(x + Math.cos(a) * (R + 5), y + Math.sin(a) * (R + 5));
        g.stroke();
      }
    }
    if (s.poisoned) {
      // Poisoned: green drops at her side.
      g.fillStyle = 'rgba(140,220,90,0.9)';
      for (const a of [0.4, 0.75, 1.1]) {
        g.beginPath();
        g.arc(x + Math.cos(a) * (R + 3), y + Math.sin(a) * (R + 3), Math.max(1.5, w * 0.045), 0, Math.PI * 2);
        g.fill();
      }
    }
    if (s.braced) {
      g.strokeStyle = '#c9a45a';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, R + 1.5, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }
    if (s.marked) {
      g.strokeStyle = `rgba(240,120,60,${0.6 + 0.4 * pulse})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, R + 6, 0, Math.PI * 2);
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        g.moveTo(x + Math.cos(a) * (R + 2), y + Math.sin(a) * (R + 2));
        g.lineTo(x + Math.cos(a) * (R + 10), y + Math.sin(a) * (R + 10));
      }
      g.stroke();
    }
    // Health: what is left of the stack as it came aboard.
    const frac = Math.max(0, Math.min(1, ((s.count - 1) * s.hpMax + s.hp) / Math.max(1, s.start * s.hpMax)));
    const bw = w * 0.78, bh = Math.max(3, w * 0.09);
    const bx = x - bw / 2, by = y + R + 2;
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    g.fillStyle = frac > 0.5 ? '#6fb46a' : frac > 0.25 ? '#d8a640' : '#d0503e';
    g.fillRect(bx, by, bw * frac, bh);
    // The count.
    const txt = String(s.count);
    g.font = `700 ${Math.round(Math.max(10, w * 0.3))}px Inter, system-ui, sans-serif`;
    const tw = g.measureText(txt).width + 6;
    const th = Math.max(12, w * 0.34);
    const tx0 = x + R * 0.35, ty0 = y + R * 0.2;
    g.fillStyle = s.side === v.you ? '#12303c' : '#3c1512';
    g.strokeStyle = col;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(tx0 - 2, ty0 - th / 2, tw, th, 3);
    g.fill();
    g.stroke();
    g.fillStyle = '#f2ead8';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(txt, tx0 + 1, ty0 + 0.5);
    // Defending: a small shield; muskets: the shots left.
    if (s.defending) {
      const sx = x - R * 0.85, sy = y - R * 0.75, ss = Math.max(6, w * 0.2);
      g.fillStyle = '#b08d57';
      g.strokeStyle = '#1b1208';
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + ss, sy);
      g.lineTo(sx + ss, sy + ss * 0.6);
      g.quadraticCurveTo(sx + ss / 2, sy + ss * 1.25, sx, sy + ss * 0.6);
      g.closePath();
      g.fill();
      g.stroke();
    }
    if (s.shotsMax) {
      g.fillStyle = '#e0b862';
      for (let k = 0; k < s.shots; k++) {
        g.beginPath();
        g.arc(x - R * 0.7 + k * Math.max(3, w * 0.1), y - R - 3, Math.max(1.2, w * 0.035), 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}
