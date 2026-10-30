// The main campaign on the server (docs/36; owner, 2026-10-17: «Сюжетка должна быть идеальной и работающей полностью
// везде, это самое главное»). Its 720 quests laid on the world at start (shared/src/data/campaign/build.ts), one after
// another: a captain holds one of them at a time, takes it at any port's «Кампания» or from «Цели и вести» wherever she
// is, and once it is done the next comes to her by itself when her level allows. Its experience is exact (the pace of
// pacing.ts: no frontier, no live ops, no rest — the road to the 60th is the campaign's alone), its silver modest, a
// chapter's end a purse and a title, a map or shot. Its fights come to her (spawnCampaignFoe): the Crown's quiet waters
// have no raiders of their own to board.

import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { OPENING_SLOTS, arrival, buildCampaign } from '../../../shared/src/data/campaign/build.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { hullWater, nearestWater } from './seaway.ts';
import { untouchable } from './inbattle.ts';
import { stepPlace } from '../../../shared/src/data/questlegs.ts';
import { SOFT_HULL, SOFT_MEN } from './firstfights.ts';
import type { Campaign, CampaignSlot } from '../../../shared/src/data/campaign/build.ts';
import { CHAPTERS } from '../../../shared/src/data/campaign/chapters.ts';
import { chapterPurse } from '../../../shared/src/data/campaign/pacing.ts';
import { CAMPAIGN_SIZE, WALL_CHAPTER } from '../../../shared/src/data/campaign/plan.ts';
import { FIRST_SLOT, chapterOfSlot } from '../../../shared/src/data/campaign/progress.ts';
import type { QuestDef } from '../../../shared/src/data/quests.ts';
import { shipBandOf } from '../../../shared/src/data/xpcurve.ts';
import { QUESTS_BY_ID, registerCampaign } from '../../../shared/src/data/quests.ts';
import type { CampaignView } from '../../../shared/src/protocol.ts';
import { grantMap, makeMap } from './explorefx.ts';
import type { Game } from './Game.ts';
import { spawnCampaignFoe } from './npc.ts';
import type { ShipEntity } from './ship.ts';
import { BEASTS, BEAST_IDS, inGroup } from '../../../shared/src/data/beasts.ts';
import { openWater as beastWater, spawnBeast } from './beasts.ts';
import { lairList } from './beastlairs.ts';
import { beforePorts, depthAt, isLand } from '../../../shared/src/world/worldgen.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { hashString } from '../../../shared/src/rng.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { QuestState } from './quests.ts';
import { questEvent, startQuest } from './quests.ts';
import { seasonStat } from './seasons.ts';
import { GARRISON_R, lairsAll, namedForCampaign } from './wanted.ts';
import { seasonXp as passXp } from './seasonpass.ts'; // «Сезонная карта» (owner, 2026-10-30)

const built = new WeakMap<Game, Campaign>();

/** The campaign laid on this game's world (Game's constructor); its quests registered with the rest. */
export function initCampaign(game: Game, seed: number): Campaign {
  const c = buildCampaign(game.world, seed, CHAPTERS);
  built.set(game, c);
  registerCampaign(c.quests);
  return c;
}

/** The places the world lays for the campaign once its wrecks and lairs stand (Game's constructor, after buildWrecks): a
 *  wreck for each dive step in its location's shallows (her divers' depth: 8 m at most where the sea allows), and a lair
 *  step's water widened to the nearest lair when none lies within it. Appended: the old wrecks keep their ids. */
export function campaignPlaces(game: Game): void {
  const c = campaignOf(game);
  const floor = beforePorts(game.world);
  const lairs = lairList(game).filter((l) => !(l.island >= 0 && game.world.islands[l.island]?.hidden)); // (none in the mist: Game.questTargets)
  for (const q of c.quests) for (const st of q.steps) {
    if (st.type === 'dive' && st.near && st.wreck === undefined) {
      let best: { x: number; y: number; depth: number } | null = null;
      // the shallows: off the shores of the islands about the location first, then its open water
      const shores = game.world.islands.filter((i) => !i.minor && !i.hidden && !i.slot && Math.hypot(i.x - st.near!.x, i.y - st.near!.y) - i.radius < st.near!.r - 300);
      for (let k = 0; k < 160; k++) {
        const h = hashString(`${q.id}:wreck:${k}`);
        const a = ((h % 3600) / 3600) * Math.PI * 2;
        const isl = k < 100 && shores.length ? shores[k % shores.length] : null;
        const d = isl ? isl.radius + 60 + ((h >>> 12) % 300) : 300 + ((h >>> 12) % 1100);
        const x = (isl?.x ?? st.near.x) + Math.sin(a) * d, y = (isl?.y ?? st.near.y) - Math.cos(a) * d;
        if (Math.hypot(x - st.near.x, y - st.near.y) > st.near.r - 100) continue;
        if (isLand(game.world, x, y)) continue;
        const depth = depthAt(floor, x, y);
        if (depth < 3) continue;
        if (!best || (depth <= 8 && best.depth > 8) || (depth <= 8) === (best.depth <= 8) && Math.abs(depth - 6) < Math.abs(best.depth - 6)) best = { x, y, depth };
        if (best.depth <= 8) break;
      }
      if (!best) continue;
      const region = REGIONS[game.regionAt(best.x, best.y)];
      st.wreck = game.wrecks.length;
      game.wrecks.push({ id: st.wreck, name: `wreck of the ${WRECK_NAMES[st.wreck % WRECK_NAMES.length]}`, x: Math.round(best.x), y: Math.round(best.y), depth: Math.max(3, Math.min(8, Math.round(best.depth))), tier: region.safety === 'lawless' ? 3 : region.safety === 'contested' ? 2 : 1 }); // (in the shallows: a plain diver's reach)
    }
    if (st.type === 'lair' && st.near) {
      // (its waters reach the lair «Плыть» takes her to — the one of her band, clear of the pirates' guns: Game.questTargets)
      const band = shipBandOf(q.requires.level ?? 1);
      let d = Infinity, bc = Infinity;
      for (const l of lairs) {
        const ld = Math.hypot(l.x - st.near.x, l.y - st.near.y);
        const c = ld + campaignLairCost(game, l, band) + Math.max(0, l.level - band) * 3000;
        if (c < bc) [bc, d] = [c, ld];
      }
      if (d > st.near.r && Number.isFinite(d)) st.near = { ...st.near, r: Math.ceil(d + 300) };
    }
  }
}
/** How clear of a named pirate's fortress a campaign's lair lies: its battery's reach (wanted.ts LAIR_BATTERY_R, 550 m) and
 *  the boats' row past it. (A number: wanted.ts and this module import each other.) */
export const FORT_CLEAR = 1200;

/**
 * What a lair costs a campaign's step of ship band `band` over its distance (Infinity: never one to send her to) — the
 * first-hour run of 2026-10-24, «Твари дюн» lost twice at the fourth level: its lair was Widowwick Isle's iguanas, on the
 * island of a ⚓4 pirate fortress whose battery drove her boats off; Ravencliff's rookery, the nearer, a strong one that a
 * newcomer's party never beats (docs/31: a captain who did the opening and signed on Jory Penn's six should win 75–90 %).
 * Not on a fortress's island nor within FORT_CLEAR of its camp; within its garrison's reach, dear when the fortress is
 * above her; a newcomer's (⚓1–2) lair of the middle size first, a weak one next, a strong one last.
 */
export function campaignLairCost(game: Game, l: { island: number; x: number; y: number; size: string }, band: number): number {
  let cost = 0;
  for (const f of lairsAll(game)) {
    if (l.island >= 0 && f.island === l.island) return Infinity;
    const d = Math.hypot(f.x - l.x, f.y - l.y);
    if (d < FORT_CLEAR) return Infinity;
    if (d < GARRISON_R && f.level > band + 1) cost += 8000;
  }
  if (band <= 2) cost += l.size === 'strong' ? 6000 : l.size === 'weak' ? 1000 : 0;
  return cost;
}

const WRECK_NAMES = ['Saint Brendan', 'Gloria Regis', 'Merciful Anne', 'Black Tithe', 'Silver Hind', 'Grey Widow', 'Constance', 'Lamentation', 'Ninth Hour', 'Iron Psalm', 'Tidecaller', 'Wandering Jew'];

export function campaignOf(game: Game): Campaign {
  return built.get(game) ?? initCampaign(game, game.world.seed);
}

/** The slot she stands at (null: the campaign is done, or its chapter not written). */
export function campaignSlot(game: Game, p: Profile): CampaignSlot | null {
  const at = p.campaign?.at ?? 0;
  return at >= CAMPAIGN_SIZE ? null : campaignOf(game).bySlot.get(at) ?? null;
}

/** Her campaign quest under way, if any. */
export function campaignActive(p: Profile): QuestState | undefined {
  return p.quests.active.find((a) => QUESTS_BY_ID[a.id]?.kind === 'campaign');
}

/** Why she may not take this campaign quest now (null: she may). */
export function campaignBlocked(p: Profile, q: QuestDef): string | null {
  const meta = q.campaign;
  if (!meta || !p.campaign) return 'Nobody here offers that';
  if (p.campaign.at >= CAMPAIGN_SIZE) return 'The campaign is done';
  if (meta.slot !== p.campaign.at) return 'That is not the campaign’s quest now';
  if (campaignActive(p)) return 'The campaign’s quest is under way';
  if (p.level < (q.requires.level ?? 1)) return `Level ${q.requires.level}`;
  return null;
}

/** Her choice at a branch (owner, 2026-10-18: «кампанию брать не надо в портах, она сама должна идти и идти»): the one
 *  thing of the campaign she picks — the way of its fork; the rest come by themselves. */
export function acceptCampaign(game: Game, s: PlayerSession, id: string): string | null {
  const p = s.profile!;
  const q = QUESTS_BY_ID[id];
  if (!q || q.kind !== 'campaign') return 'Nobody here offers that';
  const why = campaignBlocked(p, q);
  if (why) return why;
  begin(game, s, q, false);
  return null;
}

function begin(game: Game, s: PlayerSession, q: QuestDef, _auto: boolean): void {
  const p = s.profile!;
  p.campaign!.started = true;
  startQuest(game, p, q, s);
  feedGuns(game, s, q);
  const meta = q.campaign!;
  // «Новое задание кампании: …» — a toast and a short card (the client holds them while she fights)
  game.sendTo(s, { t: 'campaign_new', id: q.id, name: q.name, ch: meta.ch, k: meta.k, size: chapterOfSlot(meta.slot).size, text: q.steps[0].text });
  // a first step done where she is (in the right port) is done at once
  const port = s.ship?.docked ? game.portById(s.ship.docked) : undefined;
  if (port) questEvent(game, s, { k: 'dock', port, fresh: true }); // (an «arrive at» step waits for her to put in again)
}

/** The round shot the opening's fights find aboard at least (a newcomer's run of 2026-10-24 at 844×390: the First Watch
 *  and «Первый залп» had fired all sixty of the start's, «Борт о борт» began with an empty hold — ammo 0 — and the chase
 *  for the tender took 4.5 minutes). */
export const OPENING_SHOT = 80;

/** The opening's fight begins (a ship to sink or to board): Galt has round shot carried aboard up to OPENING_SHOT, and the
 *  guns loaded with it when their own shot is gone. */
function feedGuns(game: Game, s: PlayerSession, q: QuestDef): void {
  const ship = s.ship;
  if (!ship || !q.campaign || q.campaign.slot >= OPENING_SLOTS) return;
  if (!q.steps.some((st) => st.type === 'sink' || st.type === 'board')) return;
  if (ship.ammo.round >= OPENING_SHOT) return;
  ship.ammo.round = OPENING_SHOT;
  if ((ship.ammo[ship.ammoSel] ?? 0) <= 0) ship.ammoSel = 'round';
  game.sendTo(s, { t: 'toast', msg: 'Galt has round shot carried aboard: your guns are fed.', kind: 'good' });
}

/** Choices put before her, by session (a fork asked once a place, again on coming aboard). */
const asked = new WeakMap<PlayerSession, number>();

/** The next quest comes to her by itself — always under way, never taken (owner, 2026-10-18): from the first level, the
 *  moment the one before is done, on coming aboard, at the level its gate asks. A fork puts its two ways before her (the
 *  card in the journal, in «Цели и вести» and a popup). `say`: a word when her level is not yet enough. */
export function campaignNext(game: Game, s: PlayerSession, say = false): void {
  const p = s.profile;
  if (!p?.campaign || campaignActive(p)) return;
  p.campaign.started = true;
  const slot = campaignSlot(game, p);
  if (!slot) return;
  if (p.level < slot.gate) {
    if (say) game.sendTo(s, { t: 'toast', msg: `The next campaign quest waits for level ${slot.gate}.`, kind: 'info' });
    return;
  }
  if (slot.b) {
    if (asked.get(s) === slot.slot) return;
    asked.set(s, slot.slot);
    const way = (q: QuestDef) => ({ id: q.id, name: q.name, label: q.campaign?.label ?? '', text: q.summary });
    game.sendTo(s, { t: 'campaign_new', id: slot.a.id, name: slot.a.name, ch: slot.ch, k: slot.k, size: chapterOfSlot(slot.slot).size, text: '', choice: [way(slot.a), way(slot.b)] });
    return;
  }
  begin(game, s, slot.a, true);
}

/** A new level (Game.grantXp): the campaign begins at the second (the First Watch done), and its quest waiting for the
 *  level comes to her. */
export function campaignLevelUp(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p?.campaign) return;
  campaignNext(game, s);
}

/** A campaign quest done (quests.ts completeQuest): its pay, the next place, a chapter's end. */
export function campaignDone(game: Game, s: PlayerSession, q: QuestDef): void {
  const p = s.profile!;
  const meta = q.campaign!;
  p.quests.active = p.quests.active.filter((a) => a.id !== q.id);
  const c = p.campaign!;
  if (meta.slot !== c.at) return; // (not hers to do: a quest of a place she has passed)
  if (meta.key && meta.way) c.picks[meta.key] = meta.way;
  c.at++;
  const silver = q.reward.silver;
  p.gold += silver;
  game.db.ledger(s.accountId, 'campaign', silver, q.id);
  game.grantXp(s, q.reward.xp, null, false, true);
  seasonStat(game, s, 'quests', 1);
  passXp(game, s, 'campaign'); // «Сезонная карта» (owner, 2026-10-30)
  const { size } = chapterOfSlot(meta.slot);
  game.sendTo(s, { t: 'quest_done', name: q.name, silver, xp: q.reward.xp, line: meta.done, campaign: { ch: meta.ch, k: meta.k, size, at: c.at, total: CAMPAIGN_SIZE } });
  if (meta.k === size - 1) chapterEnd(game, s, meta.ch, q.requires.level ?? 1);
  if (c.at >= CAMPAIGN_SIZE) game.sendTo(s, { t: 'toast', msg: 'The campaign is done. The tide sleeps.', kind: 'gold' });
  campaignNext(game, s, true);
  // a passage due: in port, a word that it waits for her casting off; at sea her client asks for it once nothing is open
  const due = passageDue(game, p);
  if (due && s.ship?.docked) game.sendTo(s, { t: 'toast', msg: `A ship waits to take you to ${due.loc.name}: cast off, and she takes you there.`, kind: 'info' });
}

// ------------------------------------------------------------------ the passage

/** The place a passage takes her to now, if one is due: her next quest the first of a place too far to sail to
 *  (build.ts CampaignLoc.passage — a chapter's start in a far sea, the home-coming), not yet taken there. */
export function passageDue(game: Game, p: Profile): { loc: Campaign['locations'][number]; slot: number } | null {
  const c = p.campaign;
  if (!c || c.at >= CAMPAIGN_SIZE || c.passed === c.at) return null;
  const slot = campaignOf(game).bySlot.get(c.at);
  if (!slot) return null;
  const loc = campaignOf(game).locations[slot.loc];
  return loc?.passage && loc.from === slot.slot ? { loc, slot: slot.slot } : null;
}

/** The passage (owner, 2026-10-23: «никто за 6-10 и тем более 20 км никуда не поплывет»): a chapter that must begin in
 *  a far sea — and the home-coming — has a ship of the story take her there, free: she is put off its harbour's mouth (or
 *  its island's shore), her sails down, and told so. At sea and out of any fight; in port, once she casts off. `fresh`:
 *  the quest just done (a word if she must cast off first). */
export function campaignPassage(game: Game, s: PlayerSession, fresh = false): boolean {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return false;
  const due = passageDue(game, p);
  if (!due) return false;
  const { loc } = due;
  void fresh;
  if (ship.docked) return false;
  if (!ship.alive || ship.grappled || ship.boarding || s.pendingBoarding || untouchable(game, ship) || ship.inCombat(game.now) || s.profile?.company.mutiny) return false;
  game.halt(s);
  let x: number, y: number, heading: number;
  if (loc.kind === 'port') {
    const port = game.portById(loc.id as string)!;
    const is = game.world.islands[port.islandId];
    heading = Math.atan2(port.x - is.x, -(port.y - is.y));
    const v = headingVec(heading);
    [x, y] = [port.x + v.x * 130, port.y + v.y * 130];
  } else {
    const a = arrival(game.world, loc, ship.state);
    [x, y] = [a.x, a.y];
    heading = Math.atan2(x - loc.x, -(y - loc.y));
  }
  const w = nearestWater(game.world, x, y, hullWater(ship), 600);
  if (w) [x, y] = w;
  // her head to the next step's place (its harbour, its island, its fight's water), so «Плыть» is a straight run
  const qs = campaignActive(p);
  const st = qs ? QUESTS_BY_ID[qs.id]?.steps[qs.step] : undefined;
  const to = st ? stepPlace(game.world, st) : null;
  if (to && Math.hypot(to.x - x, to.y - y) > to.r + 20) heading = Math.atan2(to.x - x, -(to.y - y));
  ship.state = { ...ship.state, x, y, heading, speed: 0, sail: 0, rudder: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = game.now + 20;
  ship.region = loc.region;
  game.grid.upsert(ship.id, x, y);
  p.campaign!.passed = due.slot;
  game.sendTo(s, { t: 'passage', to: loc.name, ch: loc.ch, quest: qs?.id ?? null });
  game.pushSelf(s, true);
  return true;
}

/** A chapter's end: a purse, and the chapter's own reward (a title to wear, a treasure map, shot for the guns). */
function chapterEnd(game: Game, s: PlayerSession, n: number, level: number): void {
  const p = s.profile!;
  const ch = campaignOf(game).chapters.find((x) => x.n === n);
  const purse = chapterPurse(level);
  p.gold += purse;
  game.db.ledger(s.accountId, 'campaign', purse, `chapter ${n}`);
  game.sendTo(s, { t: 'toast', msg: `Chapter ${n} is done: ${ch?.title[0] ?? ''}.`, kind: 'gold' });
  game.sendTo(s, { t: 'toast', msg: `A purse for the chapter: ${purse} silver.`, kind: 'gold' });
  const r = ch?.reward;
  if (r?.title && !p.titles.includes(r.title[0])) {
    p.titles.push(r.title[0]);
    game.sendTo(s, { t: 'toast', msg: `A new title to wear before your name: “${r.title[0]}” (the Legends tab).`, kind: 'gold' });
  }
  if (r?.map) grantMap(game, s, makeMap(game, r.map), ch!.giver[0].split(',')[0]);
  if (r?.ammo && s.ship) {
    s.ship.ammo.heavy = (s.ship.ammo.heavy ?? 0) + 10 + Math.round(level / 2);
    s.ship.ammo.chain = (s.ship.ammo.chain ?? 0) + 10;
    game.sendTo(s, { t: 'toast', msg: 'Shot for the guns: the chapter’s stores are aboard.', kind: 'good' });
  }
}

/** The Maelstrom Wall lets her through once the campaign has brought her to the Abyss's chapters (abyss.ts). */
export function campaignWall(p: Profile): boolean {
  return (p.campaign?.at ?? 0) >= FIRST_SLOT[WALL_CHAPTER - 1];
}

// ------------------------------------------------------------------ the fights that come to her

/** How near the location's waters she must come for its fight to put out. */
export const FOE_COME = 2500;

/** A campaign fight's foes about her at once, how often another puts out, and how far they are counted. */
export const FOE_MAX = 2;
export const FOE_EVERY = 35;
const FOE_R = 9000;
/** «Потопите N» (the first-hour run of 2026-10-24: c01_19 ×3, c01_21 ×3, c02_01 ×2, c02_06 ×2 took 6–11 minutes — one foe
 *  at a time put out in the location's waters, the next 35 s after and only once she was out of the fight): the next of
 *  the step's foes puts out this soon after one is sunk, taken or strikes her colours, while ships are still wanted… */
export const FOE_NEXT = 6;
/** …within this of her (metres: 0.3–0.9 of it — in sight, a minute's sail), when she is in the location's waters. */
export const FOE_SEND_R = 1600;

interface FoeWatch {
  next: number;
  ids: number[];
  step: string;
  told: boolean;
  /** Foes put out for the step so far. */
  made: number;
}
const watches = new WeakMap<PlayerSession, FoeWatch>();

/** Every second (quests.ts questEvent, the tick): her campaign quest's fight, if its step is one, comes to her at sea. */
export function campaignTick(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship || ship.docked || !ship.alive || ship.boarding) return;
  const qs = campaignActive(p);
  const q = qs ? QUESTS_BY_ID[qs.id] : undefined;
  const st = q?.steps[qs!.step];
  const old = watches.get(s);
  if (old && (!qs || old.step !== `${qs.id}:${qs.step}`)) {
    // The step done (or another): its foes still about are called off — the opening's spare tenders hunted her on to
    // «Свой берег» and their pirates brought packs (QA 2026-10-22).
    releaseFoes(game, old.ids);
    watches.delete(s);
  }
  if (qs && st?.type === 'named') {
    // a named captain of the Brethren comes to her wherever the chapter is (wanted.ts namedForCampaign)
    const key = `${qs.id}:${qs.step}`;
    let w = watches.get(s);
    if (!w || w.step !== key) watches.set(s, (w = { next: game.now + 8, ids: [], step: key, told: false, made: 0 }));
    if (game.now < w.next) return; // (in a fight or not: the lawless seas' rovers kept her in one, and none came — QA)
    w.next = game.now + FOE_EVERY;
    const o = namedForCampaign(game, ship);
    if (o && !w.told) game.sendTo(s, { t: 'toast', msg: `The Brethren’s ${o.captainName} puts to sea near you: sink that ship.`, kind: 'bad' });
    if (o) w.told = true;
    return;
  }
  if (!qs || !st || (st.type !== 'sink' && st.type !== 'board' && st.type !== 'beast')) return;
  if (st.type === 'sink' && st.role === 'merchant') return; // merchants sail the sea anyway
  // docs/36: the fight is the location's — it puts out in its waters once she comes near them
  const near = st.near;
  if (near && Math.hypot(ship.state.x - near.x, ship.state.y - near.y) > near.r + FOE_COME) return;
  const key = `${qs.id}:${qs.step}`;
  let w = watches.get(s);
  if (!w || w.step !== key) {
    w = { next: game.now + 8, ids: [], step: key, told: false, made: 0 };
    watches.set(s, w);
  }
  const before = w.ids.length;
  w.ids = w.ids.filter((id) => {
    const o = game.ships.get(id);
    return !!o && o.alive && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < FOE_R;
  });
  // (one gone — sunk, taken: the next soon, not 35 s on)
  // (hurt below 60 %: a breather first, the carpenters at work — the sooner pace sank more newcomers in the measure)
  const hurt = ship.hull < ship.stats.hullMax * 0.6;
  const pace = hurt ? FOE_EVERY : FOE_NEXT;
  if (w.ids.length < before) w.next = Math.min(w.next, game.now + pace);
  // one foe fighting her at a time (two at once sank a newcomer's sloop in the measure), the next as soon as it is sunk,
  // taken or strikes her colours (a struck ship fights no more); FOE_MAX about her at most, a struck one waiting for her
  const fighting = w.ids.filter((id) => !game.ships.get(id)!.surrendered).length;
  if (fighting === 0 && w.ids.length) w.next = Math.min(w.next, game.now + pace);
  if (game.now < w.next || fighting >= 1 || w.ids.length >= FOE_MAX) return;
  // (her first foe waits out another fight of hers — a shark, a passing raider; the step's own come on through it while
  // she is fit — hurt, she has her breather out of the fight first: the sooner pace sank more newcomers in the measure)
  if ((!w.made || hurt) && ship.inCombat(game.now)) return;
  w.next = game.now + FOE_EVERY;
  // (the first hour's — chapters 1–2 — never above her own ship's ⚓: a newcomer still on the start's ⚓1 sloop at the
  // fourth level met ⚓2 raiders at «Письмо в клеёнке» and went down in half the measured runs)
  const band = (q!.campaign?.ch ?? 99) <= 2 ? Math.min(shipBandOf(q!.requires.level ?? 1), Math.max(1, ship.shipLevel)) : shipBandOf(q!.requires.level ?? 1);
  let foe: ShipEntity | null = null;
  if (st.type === 'beast') {
    // a beast of the hunt's kind, in the location's waters
    const kinds = BEAST_IDS.filter((id) => inGroup(id, st.group) && BEASTS[id].group !== undefined && id !== 'white_orca');
    const id = kinds[Math.floor(game.rng.float() * kinds.length)] ?? 'shark';
    for (let k = 0; k < 12 && !foe; k++) {
      const a = game.rng.float() * Math.PI * 2, d = (near?.r ?? 1500) * (0.3 + 0.6 * game.rng.float());
      const x = (near?.x ?? ship.state.x) + Math.sin(a) * d, y = (near?.y ?? ship.state.y) - Math.cos(a) * d;
      if (beastWater(game, x, y)) foe = spawnBeast(game, id, x, y, band);
    }
  } else {
    // in the location's waters, within FOE_SEND_R of her (a minute's sail), not across them; else anywhere in them
    const kind = st.type === 'sink' && (st.role === 'ghost' || st.role === 'hunter' || st.role === 'patrol') ? st.role : 'pirate';
    const inWaters = !near || Math.hypot(ship.state.x - near.x, ship.state.y - near.y) <= near.r + 500;
    if (inWaters) foe = spawnCampaignFoe(game, ship, s.accountId, band, kind, { x: ship.state.x, y: ship.state.y, r: FOE_SEND_R }, near);
    foe ??= spawnCampaignFoe(game, ship, s.accountId, band, kind, near);
  }
  if (!foe) return;
  w.made++;
  // the opening's fights (owner, 2026-10-19: «атака корабля, дальше абордаж» in the first minutes): softened as the
  // first fights are — half her hull, her men thinned, her shot lighter on the newcomer (firstfights.ts)
  if (q!.campaign && q!.campaign.slot < OPENING_SLOTS && st.type !== 'beast') {
    foe.hull = Math.min(foe.hull, foe.stats.hullMax * SOFT_HULL);
    foe.setArmy(foe.army.map((x) => ({ ...x, n: Math.max(1, Math.round(x.n * SOFT_MEN)) })));
    foe.softFor = ship.id;
  }
  w.ids.push(foe.id);
  if (!w.told) game.sendTo(s, { t: 'toast', msg: 'Enemy sails close in: the campaign’s fight comes to you.', kind: 'bad' });
  w.told = true;
}

/** A campaign fight's foes no longer wanted: they give up the hunt and leave the sea a minute later (a beast is the
 *  sea's own and stays). */
function releaseFoes(game: Game, ids: number[]): void {
  for (const id of ids) {
    const b = game.npcs.get(id);
    if (!b || b.huntAccount === null) continue;
    b.huntAccount = null;
    b.target = null;
    b.chase = null;
    b.expiresAt = Math.min(b.expiresAt || Infinity, game.now + 60);
  }
}

/** Her campaign's foes now (goalroute.ts: the run makes for them first). */
export function campaignFoes(game: Game, s: PlayerSession): number[] {
  const w = watches.get(s), qs = s.profile ? campaignActive(s.profile) : null;
  // (the step's own: a step just done leaves its foes to be called off at the next tick, never the run's mark)
  if (!w || !qs || w.step !== `${qs.id}:${qs.step}`) return [];
  return w.ids.filter((id) => game.ships.get(id)?.alive);
}

// ------------------------------------------------------------------ what the screens read

/** Her place in the campaign for the screens (PrivateState.campaign): the chapter, the quest now (to take, or under way),
 *  the ways of a branch, the next few. */
export function campaignView(game: Game, p: Profile): CampaignView {
  const c = p.campaign!;
  const total = CAMPAIGN_SIZE;
  const slot = campaignSlot(game, p);
  const { ch, k, size } = chapterOfSlot(Math.min(c.at, total - 1));
  const active = campaignActive(p);
  const way = (q: QuestDef) => ({ id: q.id, name: q.name, ...(q.campaign?.label ? { label: q.campaign.label } : {}), summary: q.summary, steps: q.steps.map((x) => x.text), xp: q.reward.xp, silver: q.reward.silver });
  return {
    at: c.at, total, ch, k, size, started: c.started, done: c.at >= total, from: c.from,
    ...(slot ? { gate: slot.gate, blocked: active ? null : slot.gate > p.level ? `Level ${slot.gate}` : null, ways: [way(slot.a), ...(slot.b ? [way(slot.b)] : [])] } : {}),
    ...(active ? { active: active.id } : {}),
    next: nextSlots(game, c.at + 1, 3).map((x) => ({ name: x.a.name, gate: x.gate, ch: x.ch, k: x.k, size: chapterOfSlot(x.slot).size })),
    picks: c.picks,
    ...((d) => (d ? { passage: { to: d.loc.name } } : {}))(passageDue(game, p)),
  };
}

function nextSlots(game: Game, from: number, n: number): CampaignSlot[] {
  const out: CampaignSlot[] = [];
  const map = campaignOf(game).bySlot;
  for (let i = from; i < CAMPAIGN_SIZE && out.length < n; i++) {
    const x = map.get(i);
    if (x) out.push(x);
  }
  return out;
}

/** The campaign's quests a port's board offers her: the one now (both ways at a branch), whichever port (quests.ts
 *  questOffers). */
export function campaignOffers(game: Game, p: Profile): QuestDef[] {
  const slot = campaignSlot(game, p);
  if (!slot || campaignActive(p)) return [];
  return [slot.a, ...(slot.b ? [slot.b] : [])];
}

/** The level a captain of the campaign alone stands at after it (the tests' and the docs' check). */
export const CAMPAIGN_END_LEVEL = MAX_LEVEL;
