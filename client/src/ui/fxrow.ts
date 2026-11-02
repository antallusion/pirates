// The effects by her portrait (forum 45, Нефигугум: «баффы/дебаффы с таймерами возле портрета, как в любой MMORPG»).
// Every active effect on her ship and her captain — her abilities' and the sea's on her ship (the server's effects), and
// what her state says (under protection, skulls, the flag going up, the ferry's cooldown, the ship sent for, a boarding,
// the grapples, an overloaded hold, the crew's spirits, rest, the shop's elixir, fair wind and harvest, the rudder, the
// canvas, fire, leaks, the curse) — as an icon in a ring of the time it has left, banes first. At most MAX_FX in the row
// (fewer on a phone), then «+N»; a tap on one opens its card (the detail card, `effect:<id>`; «+N»: `effect:all`).
// Its own art only: the game's existing icons (no new pictures).

import type { StatMods } from '../../../shared/src/data/stats.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { SF } from '../../../shared/src/protocol.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { assetUrl } from '../assets.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/fx.ts';
import { esc, icon } from './dom.ts';
import { detailAttr } from './detailattr.ts';
import type { ClientCard } from './detail.ts';
import type { SpotView } from '../../../shared/src/data/spotwork.ts';
import { SPOT_ICON, spotClock, spotFrac } from '../../../shared/src/data/spotwork.ts';
import { spotAnchored, spotPhaseWord, spotTitle } from './spotclock.ts';

const L = dict(EN, RU);

/** One effect as the row shows it. */
export interface Fx {
  id: string;
  icon: string;
  bad: boolean;
  /** Its words' key (n.<k>, t.<k>), or the ability's own name and words. */
  k: string;
  name?: string;
  text?: string;
  /** Seconds left (null: while it lasts). */
  left: number | null;
  /** Of its whole time, the share left (null: no ring). */
  frac: number | null;
  /** A number on its corner (skulls, a per cent). */
  n?: string;
  /** Its words' {n}. */
  v?: string | number;
  mods?: StatMods;
}

/** What the row is reckoned from (a part of the client state: the tests give it by hand). */
export interface FxInput {
  self: {
    captain: CaptainId;
    effects: { id: string; until: number; mods?: StatMods; flags?: string[] }[];
    protectedUntil: number;
    wanted: number;
    rested: number;
    curse: number;
    hold?: { over: number; slow: number } | null;
    company?: { mood?: string | null; shantyUntil?: number };
    berthCall?: { at: number } | null;
    boosts?: { xp: number; wind: number; prod: number; ferry: number };
    pvp?: { flag: string; next: string | null; nextAt: number; pennant: boolean; skulls?: number; washMin?: number; shameUntil: number; patent?: { by: string; until: number } | null };
    dockedAt?: string | null;
    /** The work at a spot under way (owner, 2026-11-02): first in the row, with its countdown. */
    spot?: SpotView | null;
  };
  you: { flags: number; rudderHp: number; sails: number; sailsMax: number; morale: number; leaks: number } | null;
  /** World time (s) and the wall clock (ms). */
  now: number;
  wall: number;
}

/** The server's effects by kind: its picture, bane or boon, its words. Not here: the auras renewed every second (an
 *  island's light, a convoy's company — under 2 s left each time they are seen, so they are not shown). */
const KNOWN: Record<string, { icon: string; bad?: boolean; k: string }> = {
  torn_rigging: { icon: 'sk_slow', bad: true, k: 'torn' },
  tangled: { icon: 'talent_gun_tangled_rigging', bad: true, k: 'tangled' },
  topmast_down: { icon: 'sk_chain', bad: true, k: 'mast' },
  broken_mast: { icon: 'sk_chain', bad: true, k: 'mast' },
  mast_wreck: { icon: 'sk_chain', bad: true, k: 'mast' },
  maw_slow: { icon: 'sk_slow', bad: true, k: 'slow' },
  undertow: { icon: 'sk_slow', bad: true, k: 'slow' },
  undertow_strip: { icon: 'sk_slow', bad: true, k: 'slow' },
  becalmed: { icon: 'sk_slow', bad: true, k: 'slow' },
  against_current: { icon: 'sk_slow', bad: true, k: 'slow' },
  dragged: { icon: 'sk_slow', bad: true, k: 'slow' },
  netted: { icon: 'sk_slow', bad: true, k: 'slow' },
  depth_weight: { icon: 'sk_slow', bad: true, k: 'slow' },
  frozen: { icon: 'sk_slow', bad: true, k: 'slow' },
  grabbed: { icon: 'sk_grapple', bad: true, k: 'held' },
  grasped: { icon: 'sk_grapple', bad: true, k: 'held' },
  kraken_hold: { icon: 'sk_grapple', bad: true, k: 'held' },
  coiled: { icon: 'sk_grapple', bad: true, k: 'held' },
  swallowed: { icon: 'sk_grapple', bad: true, k: 'held' },
  fire: { icon: 'fire', bad: true, k: 'fire' },
  marked: { icon: 'item_ranging_glass', bad: true, k: 'marked' },
  spotted: { icon: 'item_ranging_glass', bad: true, k: 'marked' },
  hue_and_cry: { icon: 'item_ranging_glass', bad: true, k: 'marked' },
  panic: { icon: 'st_morale_down', bad: true, k: 'fear' },
  fear: { icon: 'st_morale_down', bad: true, k: 'fear' },
  shaken: { icon: 'st_morale_down', bad: true, k: 'fear' },
  dread_shaken: { icon: 'st_morale_down', bad: true, k: 'fear' },
  disobedience: { icon: 'st_morale_down', bad: true, k: 'fear' },
  stunned_crew: { icon: 'st_morale_down', bad: true, k: 'stunned' },
  dazzled: { icon: 'st_morale_down', bad: true, k: 'stunned' },
  fever: { icon: 'st_morale_down', bad: true, k: 'sick' },
  rot: { icon: 'st_morale_down', bad: true, k: 'sick' },
  abyss_rot: { icon: 'st_morale_down', bad: true, k: 'sick' },
  bile: { icon: 'st_morale_down', bad: true, k: 'sick' },
  omen_misfortune: { icon: 'st_luck_down', bad: true, k: 'unluck' },
  omen_fortune: { icon: 'st_luck_up', k: 'luck' },
  omen_day: { icon: 'st_luck_up', k: 'luck' },
  golden_fish: { icon: 'st_luck_up', k: 'luck' },
  fair_wind: { icon: 'sp_fair_wind', k: 'wind' },
  order_fair_wind: { icon: 'sp_fair_wind', k: 'speed' },
  order_gale: { icon: 'sp_following_wind', k: 'speed' },
  second_wind: { icon: 'talent_nav_second_wind', k: 'speed' },
  spill_the_wind: { icon: 'talent_nav_spill_the_wind', k: 'speed' },
  all_hands: { icon: 'ui_brigade', k: 'speed' },
  star_reckoning: { icon: 'ab_star_fix', k: 'speed' },
  charted_waters: { icon: 'talent_exp_charted_waters', k: 'speed' },
  pathfinder: { icon: 'talent_exp_pathfinder', k: 'speed' },
  board_run: { icon: 'ab_ramming_speed', k: 'speed' },
  dash: { icon: 'ab_trim_sails', k: 'dash' },
  evasive: { icon: 'ab_trim_sails', k: 'dash' },
  smoke_evasive: { icon: 'ab_trim_sails', k: 'dash' },
  shanty: { icon: 'st_morale_up', k: 'shanty' },
  inspired: { icon: 'st_morale_up', k: 'morale' },
  war_drums: { icon: 'mount_war_drums', k: 'morale' },
  war_heart: { icon: 'st_morale_up', k: 'morale' },
  iron_will: { icon: 'st_morale_up', k: 'morale' },
  iron_discipline: { icon: 'st_morale_up', k: 'morale' },
  glory: { icon: 'st_morale_up', k: 'morale' },
  smoke_screen: { icon: 'sp_fog_bank', k: 'hidden' },
  slip_away: { icon: 'sp_fog_bank', k: 'hidden' },
  shadow: { icon: 'sp_fog_bank', k: 'hidden' },
  order_fog_bank: { icon: 'sp_fog_bank', k: 'hidden' },
  brace: { icon: 'sk_ward', k: 'brace' },
  haven_ward: { icon: 'build_lighthouse', k: 'haven' }, // forum post 49: «Под защитой гавани» after the passage
};
/** Never in the row: what the HUD shows another way, the inner workings. */
const SKIP = new Set(['keep_station', 'spawn', 'moored', 'own_ships', 'convoy', 'regatta', 'squadron', 'isle_light', 'isle_tavern', 'isle_cove', 'haven']);

/** The whole times seen (for the rings): each effect's end and when it was first seen with it. */
const seen = new Map<string, { until: number; start: number }>();
function share(key: string, until: number, now: number): number {
  let r = seen.get(key);
  if (!r || until > r.until + 0.5) seen.set(key, (r = { until, start: Math.min(now, until) }));
  r.until = until;
  const whole = Math.max(1, r.until - r.start);
  return Math.max(0, Math.min(1, (until - now) / whole));
}

/** Her captain's ability by the effect's id (its own name and words in her language). */
function ability(captain: CaptainId, id: string): { name: string; description: string } | null {
  const a = CAPTAINS[captain]?.abilities.find((x) => x.id === id);
  return a ? { name: a.name, description: a.description } : null;
}

/** Bane or boon by an unknown effect's numbers (most of them for the worse: a bane). */
function badMods(mods: StatMods | undefined, flags: string[] | undefined): boolean {
  const lower = new Set(['reloadMul', 'spreadMul', 'fireRisk', 'leakInflow', 'signature', 'moraleLoss', 'incomingDamageMul', 'sailDamageMul']);
  let good = 0, bad = 0;
  for (const [k, v] of Object.entries(mods ?? {})) {
    if (!v) continue;
    if (lower.has(k) ? v < 0 : v > 0) good++;
    else bad++;
  }
  if (flags?.length && !bad) good++;
  return bad > good;
}

/** Every effect on her now, banes first, each the longest first within its kind. */
export function fxList(i: FxInput): Fx[] {
  const out: Fx[] = [];
  const { self, you, now, wall } = i;
  const timed = (id: string, until: number, base: Omit<Fx, 'id' | 'left' | 'frac'>, clock: 'world' | 'wall' = 'world') => {
    const t = clock === 'world' ? now : wall / 1000;
    const end = clock === 'world' ? until : until / 1000;
    if (end <= t) return;
    out.push({ id, left: end - t, frac: share(id, end, t), ...base });
  };
  // the server's effects
  const had = new Set<string>();
  for (const e of self.effects) {
    if (SKIP.has(e.id) || e.until <= now || had.has(e.id)) continue;
    const known = KNOWN[e.id] ?? (e.id.startsWith('omen_pod_') ? { icon: 'omen_dolphins', k: 'pod' } : e.id.startsWith('descent_') ? { icon: 'st_luck_up', k: 'buff' } : null);
    const ab = known ? null : ability(self.captain, e.id);
    if (!known && !ab && e.until - now < 2) continue; // an aura renewed each second
    if (e.id === 'fair_wind' && (self.boosts?.wind ?? 0) > wall) continue; // the shop's own wind is shown below
    had.add(e.id);
    const bad = known ? !!known.bad : ab ? false : badMods(e.mods, e.flags);
    const left = e.until - now;
    out.push({
      id: e.id, icon: known?.icon ?? (ab && assetUrl(`icon.ab_${e.id}`) ? `ab_${e.id}` : bad ? 'st_luck_down' : 'st_luck_up'), bad,
      k: known?.k ?? (bad ? 'debuff' : 'buff'), ...(ab ? { name: ab.name, text: ab.description } : {}),
      left: left > 1e5 ? null : left, frac: left > 1e5 ? null : share(e.id, e.until, now), ...(e.mods ? { mods: e.mods } : {}),
    });
  }
  // her state
  if (self.protectedUntil > now) timed('protected', self.protectedUntil, { icon: 'sk_ward', bad: false, k: 'protected' });
  const skulls = self.pvp?.skulls ?? self.wanted;
  if (skulls > 0) out.push({ id: 'skulls', icon: 'wanted', bad: true, k: 'skulls', v: skulls, n: String(skulls), left: self.pvp?.washMin ? self.pvp.washMin * 60 : null, frac: null });
  if (self.pvp && self.pvp.shameUntil > wall) timed('shame', self.pvp.shameUntil, { icon: 'st_morale_down', bad: true, k: 'shame' }, 'wall');
  if (self.pvp?.next && self.pvp.nextAt > wall) timed('flag', self.pvp.nextAt, { icon: 'cos_flags', bad: false, k: 'flag' }, 'wall');
  if (self.pvp?.flag === 'pirate') out.push({ id: 'pirate', icon: 'item_black_flag', bad: true, k: 'pirate', left: null, frac: null });
  else if (self.pvp?.pennant) out.push({ id: 'pennant', icon: 'cos_flags', bad: false, k: 'pennant', left: null, frac: null });
  // «Каперский патент» (owner, 2026-11-02): the issuer's sign with its week running down (`effect:marque`)
  const pt = self.pvp?.patent;
  if (pt && pt.until > wall) timed('marque', pt.until, { icon: `faction_${pt.by}`, bad: false, k: 'marque', v: FACTIONS[pt.by as FactionId]?.short ?? pt.by }, 'wall');
  const b = self.boosts;
  if (b) {
    if (b.ferry > wall) timed('ferry', b.ferry, { icon: 'build_lighthouse', bad: true, k: 'ferry' }, 'wall');
    if (b.xp > wall) timed('elixir', b.xp, { icon: 'xp', bad: false, k: 'elixir' }, 'wall');
    if (b.wind > wall) timed('wind', b.wind, { icon: 'sp_fair_wind', bad: false, k: 'wind' }, 'wall');
    if (b.prod > wall) timed('harvest', b.prod, { icon: 'sp_red_harvest', bad: false, k: 'harvest' }, 'wall');
  }
  if (self.berthCall && self.berthCall.at > wall) timed('berth', self.berthCall.at, { icon: 'build_shipyard', bad: false, k: 'berth' }, 'wall');
  if (self.company?.mood === 'shanty' && (self.company.shantyUntil ?? 0) > now && !had.has('shanty')) timed('shanty', self.company.shantyUntil!, { icon: 'st_morale_up', bad: false, k: 'shanty' });
  if (self.rested > 0) out.push({ id: 'rested', icon: 'xp', bad: false, k: 'rested', v: self.rested, left: null, frac: null });
  if (self.hold?.over) out.push({ id: 'overload', icon: 'mod_hold_expansion', bad: true, k: 'overload', v: self.hold.slow, n: `−${self.hold.slow}%`, left: null, frac: null });
  if (self.curse >= 25) {
    const st = self.curse >= 80 ? 3 : self.curse >= 50 ? 2 : 1;
    out.push({ id: 'curse', icon: 'mod_choir_bell', bad: true, k: 'curse', v: st, n: String(st), left: null, frac: null });
  }
  if (you && !self.dockedAt) {
    if (you.flags & SF.BOARDING) out.push({ id: 'boarding', icon: 'ab_red_hook_boarding', bad: true, k: 'boarding', left: null, frac: null });
    else if (you.flags & SF.TETHERED) out.push({ id: 'grapple', icon: 'sk_grapple', bad: true, k: 'grapple', left: null, frac: null });
    if (you.flags & SF.FIRE && !had.has('fire')) out.push({ id: 'fire', icon: 'fire', bad: true, k: 'fire', left: null, frac: null });
    if (you.rudderHp < 0.99) out.push({ id: 'rudder', icon: 'mod_rudder', bad: true, k: 'rudder', v: Math.round(you.rudderHp * 100), n: `${Math.round(you.rudderHp * 100)}%`, left: null, frac: null });
    const canvas = you.sails / Math.max(1, you.sailsMax);
    if (canvas < 0.5) out.push({ id: 'canvas', icon: 'stat_sails', bad: true, k: 'canvas', v: Math.round(canvas * 100), n: `${Math.round(canvas * 100)}%`, left: null, frac: null });
    if (you.leaks > 0) out.push({ id: 'leaks', icon: 'mod_chain_pumps', bad: true, k: 'leaks', v: you.leaks, n: String(you.leaks), left: null, frac: null });
    if (you.morale >= 80) out.push({ id: 'moraleHigh', icon: 'st_morale_up', bad: false, k: 'moraleHigh', left: null, frac: null });
    else if (you.morale <= 30) out.push({ id: 'moraleLow', icon: 'st_morale_down', bad: true, k: 'moraleLow', left: null, frac: null });
  }
  // banes first; within each, the timed ones by what is left (the soonest gone last), the lasting ones after — and the
  // work at a spot before them all (its countdown is what she waits on)
  const sp = self.spot;
  const spot: Fx[] = sp && !self.dockedAt && sp.until > now ? [{
    id: 'spot', icon: SPOT_ICON[sp.kind], bad: false, k: 'spot', name: spotTitle(sp), text: `${spotPhaseWord(sp, now)} · ${spotAnchored()}`,
    left: sp.until - now, frac: 1 - spotFrac(sp, now), n: spotClock(sp.until - now),
  }] : [];
  return spot.concat(out.sort((a, b2) => Number(b2.bad) - Number(a.bad) || (a.left === null ? 1 : 0) - (b2.left === null ? 1 : 0) || (b2.left ?? 0) - (a.left ?? 0)));
}

/** The row's name for a screen reader. */
export function fxRowLabel(): string {
  return L('allTitle');
}

/** A time left, short for the icon's corner («45», «3м», «2ч»). */
export function shortLeft(sec: number): string {
  if (sec < 60) return L('shortSec', { n: Math.max(1, Math.ceil(sec)) });
  if (sec < 3600) return L('shortMin', { n: Math.ceil(sec / 60) });
  if (sec >= 48 * 3600) return L('shortDay', { n: Math.round(sec / 86400) }); // (a patent's week: «7д», not «168ч»)
  return L('shortHour', { n: Math.round(sec / 3600) });
}

/** A time left in words for the card. */
function longLeft(sec: number): string {
  if (sec < 60) return L('sec', { n: Math.max(1, Math.ceil(sec)) });
  if (sec < 3600) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h >= 24) return `${L('day', { n: Math.floor(h / 24) })} ${L('hour', { n: h % 24 })}`; // (a patent's week)
  return `${L('hour', { n: h })} ${L('min', { n: m })}`;
}

export function fxName(f: Fx): string {
  return f.name ?? L(`n.${f.k}` as keyof typeof EN);
}

function fxText(f: Fx): string {
  return f.text ?? L(`t.${f.k}` as keyof typeof EN, { n: f.v ?? '' });
}

/** The row's markup: at most `max` icons, then «+N». */
export function fxRowHtml(list: readonly Fx[], max: number): string {
  const shown = list.length > max ? list.slice(0, max) : list;
  const rest = list.length - shown.length;
  const one = (f: Fx) => {
    const p = f.frac === null ? 1 : f.frac;
    const corner = f.n ?? (f.left !== null ? shortLeft(f.left) : '');
    return `<button type="button" class="fx-i${f.bad ? ' fx-bad' : ' fx-good'}${f.frac !== null && f.left !== null && f.left < 5 ? ' fx-end' : ''}"${detailAttr(`effect:${f.id}`)} style="--fx-p:${Math.round(p * 100)}" aria-label="${esc(`${fxName(f)}${f.left !== null ? ` · ${longLeft(f.left)}` : ''}`)}" title="${esc(fxName(f))}">${icon(f.icon, '✦', 'fx-ico')}${corner ? `<b class="fx-t">${esc(corner)}</b>` : ''}</button>`;
  };
  return shown.map(one).join('') + (rest > 0 ? `<button type="button" class="fx-i fx-more"${detailAttr('effect:all')} aria-label="${esc(L('moreTip'))}" title="${esc(L('moreTip'))}"><b>${esc(L('more', { n: rest }))}</b></button>` : '');
}

let lastList: Fx[] = [];
/** Its numbers' markup (gear.ts's lines, given by main.ts: no cycle of imports through the detail card). */
let linesOf: (mods: StatMods) => string = () => '';
export function setFxLines(f: (mods: StatMods) => string): void {
  linesOf = f;
}
/** The row as last drawn (the cards are read from it). */
export function noteFx(list: Fx[]): void {
  lastList = list;
}

/** An effect's card (`effect:<id>`), or the whole list's (`effect:all`). `lines`: its numbers' markup. */
export function effectCard(id: string, lines: (mods: StatMods) => string = linesOf): ClientCard | undefined {
  if (id === 'all') {
    const rows = lastList.map((f) => ({ k: [fxName(f), fxName(f)] as [string, string], v: [f.left !== null ? longLeft(f.left) : f.n ?? '', f.left !== null ? longLeft(f.left) : f.n ?? ''] as [string, string], icon: `icon.${f.icon}`, tone: f.bad ? ('down' as const) : ('up' as const) }));
    const t = L('allTitle');
    return { name: [t, t], color: '#e8c872', rows, ...(rows.length ? {} : { notes: [{ t: [L('allNone'), L('allNone')] }] }) };
  }
  const f = lastList.find((x) => x.id === id);
  if (!f) return undefined;
  const name = fxName(f), kind = L(f.bad ? 'debuff' : 'buff'), text = fxText(f);
  const left = f.left !== null ? longLeft(f.left) : L('noTime');
  return {
    name: [name, name], sub: [kind, kind], color: f.bad ? '#e0776b' : '#9fd38a', art: `icon.${f.icon}`,
    rows: [{ k: [L('left'), L('left')], v: [left, left], icon: 'icon.ui_hourglass', tone: f.bad ? 'down' : 'up' }],
    notes: [{ t: [text, text] }],
    ...(f.mods && lines(f.mods) ? { extra: `<div class="gear-lines fx-lines">${lines(f.mods)}</div>` } : {}),
  };
}
