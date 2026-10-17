// Path and Legend quests (docs/00 D1, docs/02 §7): mentors in their ports, step objectives driven by what the
// captain does at sea, Path unlocks and switching at a Captain's House, the First Descent, and faction oaths.

import { opsSilverMul } from './liveops.ts'; // docs/34: the silver event
import { isCampaignId } from '../../../shared/src/data/questclass.ts';
import { givePet } from './pets.ts';
import { giveCalf } from './companion.ts';
import { earnTattoo, offerChoice } from './tattoos.ts';
import { SIDE_QUESTS } from '../../../shared/src/data/sidequests.ts';
import { codeAnywhere } from './raiding.ts';
import { inGroup } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { SHIP_LEVEL_MAX, captainLevelFor, questShipLevel, shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { FACTIONS, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { ARC_QUESTS, CAPTAINS_HOUSES, ISLAND_JOBS, JOBS, QUESTS, QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { hashString } from '../../../shared/src/rng.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { QuestDef, QuestStep } from '../../../shared/src/data/quests.ts';
import { QUEST_PAYS, questPayOf, questRep, veteranPay } from '../../../shared/src/data/questpay.ts';
import type { QuestPay } from '../../../shared/src/data/questpay.ts';
import type { QuestPayView } from '../../../shared/src/protocol.ts';
import { TREES, pointsInTree } from '../../../shared/src/data/talents.ts';
import type { TreeId } from '../../../shared/src/data/talents.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import { changeRep } from './player.ts';
import { grantDeed } from './progression.ts';
import { newsHint } from './onboarding.ts';
import { spawnCargoAmbush, spawnPackLeader } from './npc.ts';
import { neutralSpared } from './colours.ts';
import { ensureElite, eliteSunk, eliteWord, todaysElite } from './elite.ts';
import { eliteById } from '../../../shared/src/data/elite.ts';
import { titlesDue } from '../../../shared/src/data/questtitles.ts';
import { nearTask, taskEvent } from './worldtasks.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { bandOf, captainBand, sectorAt } from '../../../shared/src/world/sectors.ts';
import { questXpFor } from '../../../shared/src/data/xpcurve.ts';
import { dailyEvent } from './dailies.ts';
import { commonEvent } from './commongoal.ts';
import { guildGoalEvent } from './guildgoal.ts';
import { CONVOY_RANGE, groupOfAccount } from './party.ts';
import { seasonStat } from './seasons.ts';
import { grantMap, makeMap } from './explorefx.ts';
import type { ShipEntity } from './ship.ts';
import { admiraltyById, isAdmId } from '../../../shared/src/data/admiralty.ts'; // docs/19 E15
import { contractDone } from './admiralty.ts';
import { campaignDone, campaignTick } from './campaign.ts'; // docs/36, the main campaign
import { ownIsland } from './estate.ts';
import { xpThreat } from '../../../shared/src/data/xpcurve.ts';

/** No cap on the quests under way (owner, 2026-10-16: «надо снять ограничение, можно брать сколько угодно, главное своего
 *  диапазона уровня»): what limits her is the level band of each (questBandBlocked). This is only a ceiling against a
 *  runaway ledger — far more than all the boards she could stand at offer at once — so the per-second work over her
 *  quests (questTargets, the tick event) stays bounded. */
export const MAX_ACTIVE_QUESTS = 60;
/** A port's board shows this many of its generated jobs at a time, a new set every few hours (docs/19 D4: ten, twice
 *  the five it had), two of the places the port's creature jobs'. */
export const JOBS_ON_BOARD = 10;
export const BEAST_JOBS_ON_BOARD = 2;
export const JOB_ROTATION_SEC = 4 * 3600;
export const PATH_SWITCH_CD = 3600;

export interface QuestState {
  id: string;
  step: number;
  progress: number;
  startedAt: number;
  /** A race taken in port: its clock starts when she casts off (docs/30). */
  raceHold?: boolean;
  /** Done before this (game seconds), a job pays a quarter more (docs/11 P6). */
  fastUntil?: number;
  /** A courier's cargo draws raiders once (docs/11 P6): when, and whether they have come. */
  ambushAt?: number;
  ambushed?: boolean;
  /** A hunt's quarry: the band leader's ship (docs/11 P6); sinking him ends the hunt at once. */
  leader?: number;
  /** The pay chosen on taking it, when not all silver (docs/11 P6). */
  pay?: QuestPay;
  /** docs/19 E15: an Admiralty's citadel contract — her watches of the week as she took it (those after it count). */
  base?: number;
}

/** The quests that count against MAX_ACTIVE_QUESTS: the Admiralty's contracts of the week stand beside them (docs/19
 *  E15 — three at the most, and the week's own). */
// (the campaign's quest, always under way, takes no place among them: docs/36)
export const questsUnderWay = (p: Profile): number => p.quests.active.filter((a) => !isAdmId(a.id) && !isCampaignId(a.id)).length;

/** The pay a job offers to choose from (docs/11 P6): jobs and arcs of some worth; favour where there is a port. */
export function payOptions(game: Game, q: QuestDef): QuestPayView | undefined {
  if ((q.kind !== 'job' && q.kind !== 'story') || q.reward.silver < 200) return undefined;
  const lvl = q.requires.level ?? 1;
  const home = game.portById(q.port);
  const st = questPayOf('stores', q.reward.silver, lvl), fv = questPayOf('favour', q.reward.silver, lvl);
  return { stores: { silver: st.silver, heavy: st.heavy, incendiary: st.incendiary }, ...(home ? { rep: questRep(lvl), faction: home.faction, favour: { silver: fv.silver, rep: fv.rep } } : {}) };
}

/** A pay the captain asked for, if this job offers it. */
function payAllowed(game: Game, q: QuestDef, pay: QuestPay | undefined): QuestPay | undefined {
  if (!pay || pay === 'silver' || !QUEST_PAYS.includes(pay)) return undefined;
  const o = payOptions(game, q);
  return o && (pay === 'stores' || o.favour) ? pay : undefined;
}

/** The goods her jobs carry in the hold: a delivery step under way (a quest's, an Admiralty contract's) and a port
 *  contract's delivery. The recruiting window and the island's works leave them aboard (playthrough C: the Admiralty's
 *  forty barrels of powder for Saltshoal went on the musketeers and gunners hired on the way, and she came in with 32 to
 *  a delivery that asked 40, with no word why). */
export function jobCargo(p: Profile | null | undefined): Partial<Record<GoodId, number>> {
  const out: Partial<Record<GoodId, number>> = {};
  if (!p) return out;
  for (const qs of p.quests?.active ?? []) {
    const st = QUESTS_BY_ID[qs.id]?.steps[qs.step];
    if (st?.type === 'deliver') out[st.good] = (out[st.good] ?? 0) + st.qty;
  }
  for (const c of p.contracts ?? []) if (c.kind === 'delivery' && c.good && c.qty) out[c.good] = (out[c.good] ?? 0) + c.qty;
  return out;
}

/** What of a good in her hold is hers to spend (what her jobs carry left aside). */
export function freeCargo(s: PlayerSession, g: GoodId): number {
  return Math.max(0, (s.ship?.cargo[g] ?? 0) - (jobCargo(s.profile)[g] ?? 0));
}

/** The hold lost (sunk, robbed): a job whose step is to deliver the goods it gave her goes back to taking them on — the
 *  same port gives them again (docs/30: «Сундук со снадобьями» stood on «Доставьте лекарства ×6» with the medicine on
 *  the bottom, and nothing said where to get more). */
export function questCargoLost(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return;
  for (const qs of p.quests.active) {
    const q = QUESTS_BY_ID[qs.id];
    const st = q?.steps[qs.step];
    if (!q || !st || st.type !== 'deliver' || (ship.cargo[st.good] ?? 0) >= st.qty) continue;
    const back = q.steps.findIndex((x, i) => i < qs.step && x.type === 'pickup' && x.good === st.good);
    if (back < 0) continue;
    const pick = q.steps[back];
    if (pick.type !== 'pickup') continue;
    qs.step = back;
    qs.progress = 0;
    qs.ambushed = undefined;
    qs.ambushAt = undefined;
    game.sendTo(s, { t: 'toast', msg: `The cargo of “${q.name}” is lost: take it on again at ${game.portById(pick.port)?.name ?? pick.port}.`, kind: 'info' });
  }
}

/** A courier with a quest's cargo aboard, at sea in waters that are not the Crown's peace, meets raiders once:
 *  a minute and a half to four and a half after she puts out (docs/11 P6). */
function cargoAmbush(game: Game, s: PlayerSession): void {
  const p = s.profile!, ship = s.ship!;
  if (ship.docked || REGIONS[ship.region].safety === 'safe' || p.level < 5) return;
  for (const qs of p.quests.active) {
    if (qs.ambushed) continue;
    const q = QUESTS_BY_ID[qs.id];
    const st = q?.steps[qs.step];
    if (!q || !st || st.type !== 'deliver' || !q.steps.slice(0, qs.step).some((x) => x.type === 'pickup')) continue;
    if (qs.ambushAt === undefined) {
      qs.ambushAt = game.now + 90 + (hashString(`${qs.id}:${s.accountId}`) % 180);
      continue;
    }
    if (game.now < qs.ambushAt) continue;
    qs.ambushed = true;
    if (neutralSpared(game, ship)) return; // neutral colours (docs/24 D1): the word of her cargo finds no taker, nine times in ten
    if (spawnCargoAmbush(game, ship, s.accountId, p.level >= 15 ? 2 : 1) > 0) game.sendTo(s, { t: 'toast', msg: 'Sails on the horizon, closing fast — someone has word of your cargo.', kind: 'bad' });
    return; // one band at a time
  }
}

/** A group contract still to be won whose flagship is gone (sunk by strangers, or her two hours out): the day's
 *  quarry is put to sea again, and the gold mark follows the new one. */
function eliteAtSea(game: Game, s: PlayerSession): void {
  for (const qs of s.profile!.quests.active) {
    const q = QUESTS_BY_ID[qs.id];
    if (q?.category !== 'elite' || qs.step !== 0) continue;
    if (qs.leader !== undefined && game.ships.get(qs.leader)?.alive) continue;
    const flag = ensureElite(game, q);
    if (flag) qs.leader = flag.id;
  }
}

/** The speed bonus: a quarter more silver for a job done within its window. */
export const FAST_BONUS = 0.25;

/** How long a job's route takes at a good pace, with a third to spare (seconds): from the giver's port through
 *  every place its steps name. None for a job with no places (a hunt, a count of deeds). */
export function fastWindow(game: Game, q: QuestDef): number | null {
  const home = game.portById(q.port);
  if (!home) return null;
  let x = home.x, y = home.y, d = 0, places = 0;
  for (const st of q.steps) {
    let at: { x: number; y: number } | null = null;
    if (st.type === 'visit' || st.type === 'deliver' || st.type === 'pickup') at = game.portById(st.port) ?? null;
    else if (st.type === 'land' || st.type === 'isle') at = game.world.islands[st.island] ?? null;
    else return null; // a step with no place: no race against the clock
    if (!at) continue;
    d += Math.hypot(at.x - x, at.y - y);
    x = at.x;
    y = at.y;
    places++;
  }
  if (!places || d < 500) return null;
  return Math.round(240 + (d / 7) * 1.35); // some 7 m/s under way, a third to spare, four minutes in port
}

export function startQuest(game: Game, p: Profile, q: QuestDef, s?: PlayerSession, pay?: QuestPay): void {
  const w = q.kind === 'job' ? fastWindow(game, q) : null;
  const chosen = payAllowed(game, q, pay);
  const qs: QuestState = { id: q.id, step: 0, progress: 0, startedAt: game.now, ...(w ? { fastUntil: game.now + w } : {}), ...(chosen ? { pay: chosen } : {}) };
  // A race's clock does not run while she buys her stores on the quay (docs/30: «Первым на рынок» was lost before she
  // had cleared the harbour): it starts as she casts off.
  if (q.steps[0]?.type === 'race' && s?.ship?.docked) qs.raceHold = true;
  // A group contract: the day's flagship, shared by all who hold it.
  if (q.category === 'elite') {
    const flag = ensureElite(game, q);
    if (flag) {
      qs.leader = flag.id;
      if (s) eliteWord(game, s, flag, q);
    }
  }
  // A hunt of pirates in a region: the band has a leader, and word of him comes with the job.
  const hunt = q.kind === 'job' ? q.steps.find((st) => st.type === 'sink' && st.region && st.role === 'pirate') : undefined;
  if (hunt && hunt.type === 'sink' && hunt.region && p.level >= 8) {
    const leader = spawnPackLeader(game, hunt.region, p.level);
    if (leader) {
      qs.leader = leader.id;
      if (s) game.sendTo(s, { t: 'toast', msg: `${leader.captainName} leads them in the ${leader.name}: sink that ship and the rest will scatter.`, kind: 'info' });
    }
  }
  p.quests.active.push(qs);
}

export interface QuestLog {
  active: QuestState[];
  done: string[];
}

export type QuestEvent =
  | { k: 'sink'; victim: ShipEntity }
  | { k: 'board'; victim: ShipEntity }
  | { k: 'prize' }
  | { k: 'sell_contraband'; qty: number; port: string }
  | { k: 'customs' }
  | { k: 'chart' }
  | { k: 'tick'; dt: number }
  | { k: 'fleet_win' }
  | { k: 'die'; region: RegionId }
  | { k: 'dive' }
  /** Fish taken (docs/12 P3): the units into the hold, the weight of one, and whether it was fought on the line. */
  | { k: 'catch'; units: number; kg: number; fought: boolean }
  /** A beast of the sea taken (docs/12 P4). */
  | { k: 'beast'; beast: BeastId }
  /** Side quests (docs/12 P9). */
  | { k: 'named' }
  | { k: 'tribute' }
  | { k: 'letter' }
  | { k: 'rescue'; n: number }
  /** `fresh`: the quest was taken (or came) while she lay in this port — a step that asks her to arrive here is not done by
   *  it (owner's QA, 2026-10-18: a campaign quest was done the instant it came, its port the one she stood in). */
  | { k: 'dock'; port: Port; fresh?: boolean }
  | { k: 'land'; island: number; feature: string }
  /** docs/18 #23: a lair of the land's creatures beaten. */
  | { k: 'lair'; island: number; kind: string }
  /** docs/19 E15: the Admiralty's legend made to strike; a seal's mythic depth won in time; watches on the citadels' walls. */
  | { k: 'legend' }
  | { k: 'seal'; lv: number }
  | { k: 'citadel'; n: number }
  /** docs/36: works laid on her own island (base.ts startBuild, upgradeAt); men signed on for the army (dwell.ts recruit). */
  | { k: 'build' }
  | { k: 'recruit'; n: number };

export function newQuestLog(): QuestLog {
  return { active: [], done: [] };
}

/** Why a captain cannot take a quest yet (or null). */
export function questBlocked(p: Profile, q: QuestDef): string | null {
  if (p.quests.done.includes(q.id)) return 'Done';
  if (p.quests.active.some((a) => a.id === q.id)) return 'Under way';
  if (q.reward.path && p.paths.includes(q.reward.path)) return 'You already walk this Path';
  if (q.id === 'q_first_descent' && (p.captain === 'drowned' || p.deeds.includes('deed_first_descent'))) return 'The deep already knows you';
  const r = q.requires;
  if (r.done && !r.done.every((d) => p.quests.done.includes(d))) return `First: ${r.done.map((d) => QUESTS_BY_ID[d]?.name ?? d).join(', ')}`;
  if (r.level && p.level < r.level) return `Level ${r.level}`;
  const checks: [boolean, string][] = [];
  for (const [f, v] of Object.entries(r.rep ?? {})) checks.push([(p.reputation[f as FactionId] ?? 0) >= (v ?? 0), `${FACTIONS[f as FactionId].short} standing ${v}`]);
  for (const [t, v] of Object.entries(r.treePoints ?? {})) checks.push([pointsInTree(p.talents, t as TreeId) >= (v ?? 0), `${v} points in ${TREES[t as TreeId].name}`]);
  if (!checks.length) return null;
  if (r.anyOf) return checks.some((c) => c[0]) ? null : checks.map((c) => c[1]).join(' or ');
  const miss = checks.find((c) => !c[0]);
  return miss ? miss[1] : null;
}

/** What the sea's news asks of a port's board (docs/11 P6): during an epidemic the medicine runs come first,
 *  under a blockade the hunts and the runs past it, with an armada about the hunts, after the Storm of the Century
 *  the rescues. Null when nothing is happening there. */
export type BoardFavor = ((q: QuestDef) => boolean) | null;

export function eventFavor(game: Game, port: Port): BoardFavor {
  const wall = game.wallNow();
  const here = game.worldEvents.data(game).list.filter((e) => e.ends > wall && (e.port === port.id || (!e.port && e.region === port.region)));
  if (!here.length) return null;
  const kinds = new Set(here.map((e) => e.kind));
  const medicine = (q: QuestDef) => q.steps.some((s) => (s.type === 'deliver' || s.type === 'pickup') && s.good === 'medicine');
  return (q) => (kinds.has('epidemic') && medicine(q))
    || (kinds.has('blockade') && (q.category === 'hunt' || q.category === 'smuggling'))
    || (kinds.has('armada') && q.category === 'hunt')
    || (kinds.has('storm_century') && q.category === 'rescue');
}

export function questOffers(p: Profile, port: Port, now = 0, favor: BoardFavor = null, elite: QuestDef | null = null): { q: QuestDef; blocked: string | null }[] {
  // An arc's chapter is offered once the chapter before it is done.
  const story = [...QUESTS, ...ARC_QUESTS, ...SIDE_QUESTS].filter((q) => q.port === port.id && !p.quests.done.includes(q.id) && !p.quests.active.some((a) => a.id === q.id) && (q.requires.done ?? []).every((d) => p.quests.done.includes(d)));
  // The day's group contract heads the jobs (docs/11 P6).
  const contract = elite && !p.quests.done.includes(elite.id) && !p.quests.active.some((a) => a.id === elite.id) ? [elite] : [];
  return [...story, ...contract, ...boardJobs(p, port, now, favor)]
    .map((q) => ({ q, blocked: questBlocked(p, q) }))
    .filter((o) => o.blocked !== 'You already walk this Path' && o.blocked !== 'The deep already knows you');
}

/** The generated jobs a port's board shows now: a few of its seventy, new every four hours, suited to the
 *  captain's level first (the ones she is not yet fit for may show, greyed). */
export function boardJobs(p: Profile, port: Port, now: number, favor: BoardFavor = null): QuestDef[] {
  const mine = JOBS.filter((q) => q.port === port.id && !p.quests.done.includes(q.id) && !p.quests.active.some((a) => a.id === q.id));
  if (!mine.length) return [];
  const window = Math.floor(now / JOB_ROTATION_SEC);
  // The news of the port puts its jobs first (two at most), the rest turn as ever.
  // Jobs a captain can take come first; a few above her level show what lies ahead; none far above.
  const scored = mine.map((q) => ({ q, k: ((hashString(q.id) ^ (window * 2654435761)) >>> 0) / 2 + ((q.requires.level ?? 1) > p.level ? 2 ** 31 : 0) + ((q.requires.level ?? 1) > p.level + 5 ? 2 ** 32 : 0) }));
  if (favor) {
    let lifted = 0;
    for (const x of [...scored].sort((a, b) => a.k - b.k)) {
      if (lifted >= 2) break;
      if (favor(x.q) && (x.q.requires.level ?? 1) <= p.level + 5) {
        x.k -= 2 ** 33;
        lifted++;
      }
    }
  }
  scored.sort((a, b) => a.k - b.k);
  // docs/18 #23: the port's creature jobs keep places on the board (docs/19 D4: two of them, by the window), when she
  // may take them.
  const beasts = scored.filter((x) => x.q.id.startsWith('lj_') && (x.q.requires.level ?? 1) <= p.level + 5).slice(0, BEAST_JOBS_ON_BOARD);
  const rest = scored.filter((x) => !x.q.id.startsWith('lj_'));
  return [...rest.slice(0, JOBS_ON_BOARD - beasts.length), ...beasts].map((x) => x.q);
}

export function acceptQuest(game: Game, s: PlayerSession, port: Port, id: string, pay?: QuestPay): string | null {
  const p = s.profile!;
  const q = QUESTS_BY_ID[id];
  if (!q || q.port !== port.id) return 'Nobody here offers that';
  if (q.category === 'elite' ? q.id !== todaysElite(game, port)?.id : q.kind === 'job' && !boardJobs(p, port, game.now, eventFavor(game, port)).includes(q)) return 'That job is no longer on the board';
  const why = questBlocked(p, q) ?? questIsleBlocked(game, p, q) ?? questBandBlocked(game, p, q);
  if (why) return why;
  if (questsUnderWay(p) >= MAX_ACTIVE_QUESTS) return `At most ${MAX_ACTIVE_QUESTS} quests at once`;
  startQuest(game, p, q, s, pay);
  game.sendTo(s, { t: 'toast', msg: `${q.mentor}: “${q.summary}” — ${q.steps[0].text}`, kind: 'info' });
  newsHint(game, s, 'journal');
  // A first step that is already satisfied in this port (the cargo to take on, the goods to hand over) is done at once; a
  // step that asks her to arrive here waits for her to put in again.
  questEvent(game, s, { k: 'dock', port, fresh: true });
  return null;
}

/** A party lands among an island's people: their job, if the captain has none of theirs yet and room for it. */
export function islandJobOffer(game: Game, s: PlayerSession, islandId: number): void {
  const p = s.profile!;
  const q = ISLAND_JOBS.get(islandId);
  if (!q || p.quests.done.includes(q.id) || p.quests.active.some((a) => a.id === q.id)) return;
  if ((q.requires.level ?? 1) > p.level + 3) {
    game.sendTo(s, { t: 'toast', msg: `${q.mentor} has work, but for a captain with more years at sea (level ${q.requires.level}).`, kind: 'info' });
    return;
  }
  const band = questBandBlocked(game, p, q);
  if (band) {
    const b = questBand(game, q);
    game.sendTo(s, { t: 'toast', msg: `${q.mentor} has work, but not for a ship of yours: ⚓${b[0]}–${b[1]}.`, kind: 'info' });
    return;
  }
  if (questsUnderWay(p) >= MAX_ACTIVE_QUESTS) {
    game.sendTo(s, { t: 'toast', msg: `${q.mentor} has work for you once you have room for it (${MAX_ACTIVE_QUESTS} quests at most).`, kind: 'info' });
    return;
  }
  // The giver speaks, and the captain decides (the offer stands while the boats are on the beach).
  s.questOffer = { id: q.id, island: islandId, until: game.now + 180 };
  game.sendTo(s, { t: 'quest_offer', island: islandId, offer: offerView(game, q, p) });
}

function offerView(game: Game, q: QuestDef, p: Profile) {
  const pays = payOptions(game, q);
  const ship = shipLevelOfQuest(q);
  return { id: q.id, name: q.name, kind: q.kind, mentor: q.mentor, summary: q.summary, steps: q.steps.map((x) => x.text), blocked: null, silver: q.reward.silver, xp: questXpOf(game, p, q), category: q.category, portrait: q.portrait, ...(pays ? { pays } : {}), ...(q.group ? { group: q.group } : {}), ...(ship ? { ship } : {}) };
}

/** The top captain level of the waters a quest is given in — the square of its port or island (docs/16 P2): a quest
 *  pays at her own level up to it, as a zone of today's WoW scales to the player (docs/26). */
export function questWatersTop(game: Game, q: QuestDef): number {
  const is = q.island !== undefined ? game.world.islands[q.island] : undefined;
  const at = is ?? game.portById(q.port);
  if (!at) return q.requires.level ?? 1;
  // …and a fight it asks for is the waters it is fought in (docs/30, band 2): the same ⚓3 raiders' flagship paid a captain
  // of 11 2800 at Mermaid Wharf and 220 at Gravesend, a calm square's harbour a few miles off.
  const ship = shipLevelOfQuest(q);
  const fight = ship ? (ship >= SHIP_LEVEL_MAX ? MAX_LEVEL : captainLevelFor(ship + 1) - 1) : 0;
  // (and so is an island it sends her ashore on)
  const isle = questLandLevel(game, q);
  return Math.max(captainBand(sectorAt(game.world, at.x, at.y).band)[1], fight, isle ? captainBand(bandOf(isle))[1] : 0);
}

/** The highest square a quest sends her ashore in (0: no landing), kept per quest. */
const landLevels = new WeakMap<QuestDef, number>();
export function questLandLevel(game: Game, q: QuestDef): number {
  let lv = landLevels.get(q);
  if (lv === undefined) {
    lv = 0;
    for (const st of q.steps) {
      const is = st.type === 'land' && st.island >= 0 ? game.world.islands[st.island] : undefined;
      if (is) lv = Math.max(lv, sectorAt(game.world, is.x, is.y).level);
    }
    landLevels.set(q, lv);
  }
  return lv;
}

/** A job that lands her on an island more than a level above her own ⚓ waits for the captain who may go there (docs/30,
 *  band 2: «The Lost Flock» of Hushreed Key sent a captain of 11 to Lowholt Rock, a ⚓6 island — «what lives there is
 *  beyond your crew» — and the party was cut down on the beach). */
export function questIsleBlocked(game: Game, p: Profile, q: QuestDef): string | null {
  const lv = questLandLevel(game, q);
  if (lv <= 1) return null;
  const need = captainLevelFor(lv - 1);
  return p.level < need ? `Level ${need}` : null;
}

/** A quest's ⚓ (owner, 2026-10-16): the ship level of the square it is given in (its port's, its island's), or of the
 *  fight it asks for, or of the island it sends her ashore on — the highest of them. Kept per quest. */
const anchors = new WeakMap<QuestDef, number>();
export function questAnchor(game: Game, q: QuestDef): number {
  let lv = anchors.get(q);
  if (lv === undefined) {
    const is = q.island !== undefined ? game.world.islands[q.island] : undefined;
    const at = is ?? game.portById(q.port);
    lv = Math.max(at ? sectorAt(game.world, at.x, at.y).level : 1, shipLevelOfQuest(q) ?? 0, questLandLevel(game, q));
    anchors.set(q, lv);
  }
  return lv;
}

/** The ⚓ band a quest is for: its ⚓ one either side (the square's own band, docs/26 and shared/src/world/sectors.ts). */
export function questBand(game: Game, q: QuestDef): [number, number] {
  return bandOf(questAnchor(game, q));
}

/** The words of a band refused (the card says them, the client translates them). */
export const bandWords = (b: [number, number]): string => `Not your level: ⚓${b[0]}–${b[1]}`;

/** A port's ⚓ band (its contracts are for ships of it). */
export function portBand(game: Game, port: Port): [number, number] {
  return bandOf(sectorAt(game.world, port.x, port.y).level);
}

/** Whether her ship is of a band (null) or not (why). */
export function bandRefusal(p: Profile, b: [number, number]): string | null {
  const lv = shipLevelOf(p.loadout);
  return lv < b[0] || lv > b[1] ? bandWords(b) : null;
}

/** Owner, 2026-10-16: «можно брать сколько угодно, главное своего диапазона уровня. то есть в последних там локациях
 *  корабль 1 взять ничего не сможет» — a job (the board's, an island's, the day's group contract) outside her ship's
 *  band is not hers. A Path, a Legend, a story and an arc's chapter keep their own gate (the captain's level and the
 *  chapters before: the First Descent asks a captain of 25 at a harbour of the ⚓9 waters), and the Admiralty's
 *  contracts theirs (the cap's captains, docs/19 E15). */
export function questBandBlocked(game: Game, p: Profile, q: QuestDef): string | null {
  if (q.kind !== 'job' || isAdmId(q.id)) return null;
  return bandRefusal(p, questBand(game, q));
}

/** Where a quest first sends her (a port, an island), for the board's card: «в Солтмарроу · 3,2 км». Null when its
 *  first places are none (a hunt, a count of deeds) — the giver's port then. */
export function questDest(game: Game, q: QuestDef): { x: number; y: number; port?: string; island?: number } | null {
  for (const st of q.steps) {
    if ((st.type === 'visit' || st.type === 'deliver' || st.type === 'pickup' || st.type === 'race' || st.type === 'landres') && st.port && st.port !== q.port) {
      const pt = game.portById(st.port);
      if (pt) return { x: Math.round(pt.x), y: Math.round(pt.y), port: pt.id };
    }
    if ((st.type === 'land' || st.type === 'isle') && st.island >= 0) {
      const is = game.world.islands[st.island];
      if (is) return { x: Math.round(is.x), y: Math.round(is.y), island: st.island };
    }
  }
  return null;
}

/** What a quest pays a captain of her level (docs/26): its reward at its own level, at hers within its waters, green
 *  above them. */
export function questXpOf(game: Game, p: Profile, q: QuestDef): number {
  if (q.kind === 'campaign') return q.reward.xp; // docs/36: exact, the road's own
  return questXpFor(p.level, q.reward.xp, q.requires.level ?? 1, questWatersTop(game, q));
}

/** The ship level a quest's fight asks for (canon D12), or null. */
export function shipLevelOfQuest(q: QuestDef): number | null {
  return questShipLevel(q, (r) => REGIONS[r as RegionId]?.safety ?? 'safe');
}

/** Share a quest with the group (docs/11 P6): each groupmate online who may take it is offered it, wherever they
 *  are; the ones who cannot are named to the sharer. */
export function shareQuest(game: Game, s: PlayerSession, id: string): string | null {
  const q = QUESTS_BY_ID[id];
  if (!q || !s.profile!.quests.active.some((a) => a.id === id)) return 'You are not on that quest';
  if (q.kind === 'path' || q.kind === 'legend') return 'A Path or a Legend is walked alone';
  if (q.kind === 'campaign') return 'The campaign is walked alone'; // docs/36
  if (isAdmId(id)) return 'The Admiralty gives its contracts at its own boards'; // docs/19 E15
  const g = groupOfAccount(game, s.accountId);
  if (!g) return 'You sail in no group';
  let offered = 0;
  for (const acc of g.members) {
    if (acc === s.accountId) continue;
    const m = game.sessionByAccount(acc);
    const mp = m?.profile;
    if (!m || !mp) continue;
    if (mp.quests.active.some((a) => a.id === id) || mp.quests.done.includes(id)) continue;
    if (questBlocked(mp, q) || questBandBlocked(game, mp, q) || questsUnderWay(mp) >= MAX_ACTIVE_QUESTS) {
      game.sendTo(s, { t: 'toast', msg: `${m.name} cannot take it on yet.`, kind: 'info' });
      continue;
    }
    m.questOffer = { id, until: game.now + 180, from: s.name };
    game.sendTo(m, { t: 'quest_offer', from: s.name, offer: offerView(game, q, mp) });
    offered++;
  }
  return offered ? null : 'Nobody in your group can take it on';
}

/** The captain answers an offer: take the job, or leave it (the beach asks again on the next landing). */
export function answerOffer(game: Game, s: PlayerSession, id: string, take: boolean, pay?: QuestPay): string | null {
  const o = s.questOffer;
  if (!o || o.id !== id || game.now > o.until) return take ? (o?.from ? 'That offer has lapsed' : 'The people on the beach have gone back to their work') : null;
  s.questOffer = null;
  if (!take) return null;
  const p = s.profile!;
  const q = QUESTS_BY_ID[id];
  if (!q || p.quests.active.some((a) => a.id === id) || p.quests.done.includes(id)) return null;
  const band = questBandBlocked(game, p, q);
  if (band) return band;
  if (questsUnderWay(p) >= MAX_ACTIVE_QUESTS) return `At most ${MAX_ACTIVE_QUESTS} quests at once`;
  startQuest(game, p, q, s, pay);
  game.sendTo(s, { t: 'toast', msg: `${q.mentor}: “${q.summary}” — ${q.steps[0].text}`, kind: 'info' });
  return null;
}

/** Whether an active quest's step sends the boats to this island (and site): such a landing is never "worked
 *  out" by the two hours a feature needs to restock. */
export function questLandsHere(p: Profile, islandId: number, feature: string): boolean {
  return p.quests.active.some((a) => {
    const st = QUESTS_BY_ID[a.id]?.steps[a.step];
    return !!st && st.type === 'land' && st.island === islandId && (!st.site || st.site === feature);
  });
}

export function abandonQuest(game: Game, s: PlayerSession, id: string): string | null {
  const p = s.profile!;
  if (QUESTS_BY_ID[id]?.kind === 'campaign') return 'The campaign’s quest is not set aside: it goes on by itself'; // docs/36
  if (!p.quests.active.some((a) => a.id === id)) return 'Not under way';
  p.quests.active = p.quests.active.filter((a) => a.id !== id);
  game.sendTo(s, { t: 'toast', msg: `You set aside “${QUESTS_BY_ID[id]?.name ?? id}”.`, kind: 'info' });
  return null;
}

function stepCount(st: QuestStep): number {
  switch (st.type) {
    case 'sink':
    case 'board':
    case 'prize':
    case 'chart':
    case 'fleet_win':
    case 'dive':
    case 'catch':
    case 'beast':
    case 'named':
    case 'tribute':
    case 'letters':
    case 'rescue':
    case 'lair':
    case 'legend':
    case 'seal':
    case 'citadel':
    case 'build':
    case 'recruit':
      return st.count;
    case 'sell_contraband':
      return st.qty;
    case 'time_in':
      return st.seconds;
    default:
      return 1;
  }
}

/** How far along a step is, for the log: "3/4". */
export function stepProgress(qs: QuestState): { text: string; progress: number; need: number } | null {
  const q = QUESTS_BY_ID[qs.id];
  const st = q?.steps[qs.step];
  if (!st) return null;
  return { text: st.text, progress: Math.floor(qs.progress), need: stepCount(st) };
}

/** Advance whatever the event satisfies. */
export function questEvent(game: Game, s: PlayerSession, ev: QuestEvent): void {
  const p = s.profile;
  const ship = s.ship;
  if (!p || !ship) return;
  // The day's orders and the sea's common cause move on with the same deeds.
  if (ev.k === 'dock' && !ev.fresh) {
    newsHint(game, s, 'daily');
    // A captain of some years, putting in alone: the sea's company (docs/11 P6).
    if (p.level >= 3 && !groupOfAccount(game, s.accountId)) newsHint(game, s, 'social');
  }
  // At sea near a task of the sea for the first time: what it is.
  if (ev.k === 'tick' && !ship.docked && (p.tutorial.hints.tasks ?? 0) === 0 && nearTask(game, ship.state.x, ship.state.y)) newsHint(game, s, 'tasks');
  if (ev.k === 'tick') {
    cargoAmbush(game, s);
    eliteAtSea(game, s);
    campaignTick(game, s); // docs/36: the campaign's fight comes to her
  }
  dailyEvent(game, s, ev);
  commonEvent(game, s, ev);
  guildGoalEvent(game, s, ev);
  if (ev.k === 'sink') {
    taskEvent(game, s, ev.victim);
    eliteSunk(game, ev.victim, s);
  }
  // A race lost (docs/12 P9): past its time, the quest is abandoned.
  if (ev.k === 'tick') for (const qs of [...p.quests.active]) {
    const st = QUESTS_BY_ID[qs.id]?.steps[qs.step];
    if (st?.type === 'race' && qs.raceHold) {
      if (s.ship?.docked) continue;
      qs.raceHold = undefined;
      qs.startedAt = game.now;
      game.sendTo(s, { t: 'toast', msg: `The race is on: ${Math.round(st.seconds / 60)} min to ${game.portById(st.port)?.name ?? st.port}.`, kind: 'info' });
      continue;
    }
    if (st?.type === 'race' && game.now - qs.startedAt > st.seconds) {
      p.quests.active = p.quests.active.filter((a) => a.id !== qs.id);
      game.sendTo(s, { t: 'toast', msg: `Too late: ${QUESTS_BY_ID[qs.id].name} is lost.`, kind: 'bad' });
    }
  }
  // A ship sunk or taken counts on one quest only, the first taken that wants her (docs/26: five hunts that each want two
  // pirates are not done by two pirates).
  // So does a lair beaten (QA playthrough B: two «break 3 lairs» jobs of one harbour, and those of the next, all filled
  // by the same three fights) — the job that names that very lair first, then the first taken.
  const kill = ev.k === 'sink' || ev.k === 'board' || ev.k === 'lair';
  let spent = false;
  const named = (qs: { id: string; step: number }) => (ev.k === 'lair' && (QUESTS_BY_ID[qs.id]?.steps[qs.step] as { island?: number } | undefined)?.island === ev.island ? 1 : 0);
  for (const qs of [...p.quests.active].sort((a, b) => named(b) - named(a))) {
    const q = QUESTS_BY_ID[qs.id];
    if (!q) continue;
    // Several steps may fall in one go (arriving somewhere with the goods already aboard).
    for (let guard = 0; guard < 4; guard++) {
      const st = q.steps[qs.step];
      if (!st) break;
      // (the campaign's quest, always under way, counts beside the rest: it takes no ship from a job — docs/36)
      if (kill && spent && q.kind !== 'campaign' && (st.type === 'sink' || st.type === 'board' || st.type === 'prize' || st.type === 'lair')) break;
      // The band's leader sunk: the hunt is won at a stroke.
      const gained = st.type === 'sink' && ev.k === 'sink' && qs.leader !== undefined && ev.victim.id === qs.leader ? Math.max(1, stepCount(st) - qs.progress) : stepGain(game, s, st, ev);
      if (gained <= 0) break;
      if (kill && q.kind !== 'campaign') spent = true;
      qs.progress += gained;
      if (qs.progress + 1e-9 < stepCount(st)) break;
      qs.step++;
      qs.progress = 0;
      if (qs.step >= q.steps.length) {
        completeQuest(game, s, q);
        break;
      }
      game.sendTo(s, { t: 'toast', msg: `${q.name}: ${q.steps[qs.step].text}`, kind: 'info' });
      if (ev.k !== 'dock' && !ship.docked) break;
      // Docked: a next step that asks for this port can be done now.
      if (ev.k !== 'dock' && ship.docked) {
        const port = game.portById(ship.docked);
        if (!port) break;
        ev = { k: 'dock', port };
      }
    }
  }
}

/** A job of hers, given at a port of the victim's own flag, asks for this very ship now (its step wants her sunk,
 *  boarded or taken): the flag that asked for it does not hold it against her (QA playthrough B, docs/30 — Cinderhold's
 *  «Sink pirate ships in the Ashen Isles: 3» cost −18 standing with the Confederacy for +5 from the job, and a captain of
 *  37 who did the harbour's hunts was barred from it as its enemy). */
export function jobSanctions(game: Game, s: PlayerSession, victim: ShipEntity): boolean {
  const p = s.profile;
  if (!p) return false;
  return p.quests.active.some((a) => {
    const q = QUESTS_BY_ID[a.id];
    const st = q?.steps[a.step];
    if (!q || !st || q.kind === 'campaign' || game.portById(q.port)?.faction !== victim.faction) return false;
    if (st.type === 'board' || st.type === 'prize') return true;
    if (st.type !== 'sink') return false;
    if (st.region && victim.region !== st.region) return false;
    return !st.role || victim.npcRole === st.role || (st.role === 'patrol' && victim.npcRole === 'hunter');
  });
}

function stepGain(game: Game, s: PlayerSession, st: QuestStep, ev: QuestEvent): number {
  const ship = s.ship!;
  switch (st.type) {
    case 'visit':
      return ev.k === 'dock' && !ev.fresh && ev.port.id === st.port ? 1 : 0;
    case 'deliver': {
      if (ev.k !== 'dock' || ev.port.id !== st.port) return 0;
      if ((ship.cargo[st.good] ?? 0) < st.qty) {
        game.toastShip(ship, `They are waiting for ${st.qty} ${st.good.replace('_', ' ')} here.`, 'info');
        return 0;
      }
      ship.cargo[st.good] = (ship.cargo[st.good] ?? 0) - st.qty;
      if (!ship.cargo[st.good]) delete ship.cargo[st.good];
      return 1;
    }
    case 'pickup': {
      if (ev.k !== 'dock' || ev.port.id !== st.port) return 0;
      const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
      if (free + 1e-6 < GOODS[st.good].volume * st.qty) {
        game.toastShip(ship, `Make room in the hold: ${st.qty} ${GOODS[st.good].name.toLowerCase()} wait on the quay.`, 'info');
        return 0;
      }
      ship.cargo[st.good] = (ship.cargo[st.good] ?? 0) + st.qty;
      return 1;
    }
    case 'land':
      return ev.k === 'land' && (ev.island === st.island || st.island < 0) && (!st.site || st.site === ev.feature) ? 1 : 0;
    case 'sink':
      if (ev.k !== 'sink') return 0;
      if (st.region && ev.victim.region !== st.region) return 0;
      if (st.role && ev.victim.npcRole !== st.role && !(st.role === 'patrol' && ev.victim.npcRole === 'hunter')) return 0;
      if (st.minTier && ev.victim.cls.tier < st.minTier) return 0;
      if (st.minShip && !fairFight(s, ev.victim, st.minShip)) return 0;
      if (st.near && !inWater(st.near, ev.victim.state.x, ev.victim.state.y, NEAR_FIGHT)) return 0;
      return 1;
    case 'board':
      if (ev.k !== 'board') return 0;
      if (st.near && !inWater(st.near, ev.victim.state.x, ev.victim.state.y, NEAR_FIGHT)) return 0;
      return st.minShip && !fairFight(s, ev.victim, st.minShip) ? 0 : 1;
    // docs/36, the campaign: an island's waters reached at sea; an island of her own; works laid on it; men signed on.
    case 'isle': {
      if (ev.k !== 'tick' || ship.docked) return 0;
      const is = game.world.islands[st.island];
      return is && Math.hypot(ship.state.x - is.x, ship.state.y - is.y) <= is.radius + ISLE_REACH ? 1 : 0;
    }
    case 'claim':
      return (ev.k === 'tick' || ev.k === 'dock' || ev.k === 'land') && !!ownIsland(game, s.accountId) ? 1 : 0;
    case 'build':
      return ev.k === 'build' ? 1 : 0;
    case 'recruit':
      return ev.k === 'recruit' ? ev.n : 0;
    case 'prize':
      return ev.k === 'prize' ? 1 : 0;
    case 'sell_contraband':
      return ev.k === 'sell_contraband' && (!st.port || st.port === ev.port) ? ev.qty : 0;
    case 'customs':
      return ev.k === 'customs' ? 1 : 0;
    case 'chart':
      return ev.k === 'chart' ? 1 : 0;
    case 'fleet_win':
      return ev.k === 'fleet_win' ? 1 : 0;
    case 'dive':
      return ev.k === 'dive' && (!st.near || inWater(st.near, ship.state.x, ship.state.y, 400)) ? 1 : 0;
    case 'beast':
      return ev.k === 'beast' && inGroup(ev.beast, st.group) && (!st.near || inWater(st.near, ship.state.x, ship.state.y, NEAR_FIGHT)) ? 1 : 0;
    case 'named':
      return ev.k === 'named' ? 1 : 0;
    case 'tribute':
      return ev.k === 'tribute' ? 1 : 0;
    case 'letters':
      return ev.k === 'letter' ? 1 : 0;
    case 'rescue':
      return ev.k === 'rescue' ? ev.n : 0;
    case 'race':
      return ev.k === 'dock' && ev.port.id === st.port ? 1 : 0;
    case 'catch':
      if (ev.k !== 'catch') return 0;
      if (st.minKg !== undefined) return ev.fought && ev.kg >= st.minKg ? 1 : 0;
      return ev.units;
    case 'die_in':
      return ev.k === 'die' && ev.region === st.region ? 1 : 0;
    case 'lair':
      return ev.k === 'lair' && (st.island === undefined || st.island === ev.island) && (!st.kind || st.kind === ev.kind) && (!st.near || inWater(st.near, ship.state.x, ship.state.y, NEAR_FIGHT)) ? 1 : 0;
    // docs/19 E15: the Admiralty's contracts.
    case 'legend':
      return ev.k === 'legend' ? 1 : 0;
    case 'seal':
      return ev.k === 'seal' && ev.lv >= st.minLv ? 1 : 0;
    case 'citadel':
      return ev.k === 'citadel' ? ev.n : 0;
    case 'landres': {
      if (ev.k !== 'dock' || ev.port.id !== st.port) return 0;
      const store = s.profile!.lairs?.res;
      if (!store || (store[st.res] ?? 0) < st.qty) {
        game.toastShip(ship, `They are waiting for ${st.qty} ${st.res} here.`, 'info');
        return 0;
      }
      store[st.res] -= st.qty;
      return 1;
    }
    case 'reach':
      return ev.k === 'tick' && !ship.docked && ship.region === st.region && (st.north === undefined || ship.state.y < st.north) ? 1 : 0;
    case 'time_in':
      if (ev.k !== 'tick' || ship.docked) return 0;
      // docs/36: a campaign's watch is kept in its location's waters; another's in its sea
      if (st.near ? !inWater(st.near, ship.state.x, ship.state.y, 500) : ship.region !== st.region) return 0;
      if (st.weather && game.weatherOf(ship) !== st.weather) return 0;
      return ev.dt;
  }
}

/** docs/36: a campaign step's location water — within its radius and this much more (a fight drifts, a lair's ship
 *  lies off). */
export const NEAR_FIGHT = 1500;
export const inWater = (n: { x: number; y: number; r: number }, x: number, y: number, extra = 0): boolean => Math.hypot(x - n.x, y - n.y) <= n.r + extra;

/** docs/36: how near an island's shore her ship must come for its waters to count as reached (metres past its radius). */
export const ISLE_REACH = 900;

/** A campaign fight's ship counts if she is of the quest's ⚓ or above, or not grey to the captain (docs/26: a captain
 *  above the quest's waters may fight there what still teaches her). A monster, a hulk, a boss: off the ladder, counts. */
function fairFight(s: PlayerSession, victim: ShipEntity, minShip: number): boolean {
  if (!victim.onLadder) return true;
  return victim.combatLevel >= minShip || xpThreat(s.profile?.level ?? 1, victim.combatLevel) !== 'trivial';
}

/** Groupmates at sea within convoy range of the captain (docs/11 P6): a quest done in company pays more. */
function matesNear(game: Game, s: PlayerSession): number {
  const g = groupOfAccount(game, s.accountId);
  const ship = s.ship;
  if (!g || !ship) return 0;
  let n = 0;
  for (const acc of g.members) {
    if (acc === s.accountId) continue;
    const m = game.sessionByAccount(acc)?.ship;
    if (m && m.alive && Math.hypot(m.state.x - ship.state.x, m.state.y - ship.state.y) <= CONVOY_RANGE) n++;
  }
  return n;
}

/** Titles for the work done (docs/11 P6): quests finished, contracts won, captains guided. */
export function workTitles(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const counts = { quests: p.quests.done.length, contracts: p.quests.done.filter((id) => id.startsWith('elite_')).length, mentored: p.stats.mentored ?? 0 };
  for (const title of titlesDue(counts, p.titles)) {
    p.titles.push(title);
    game.sendTo(s, { t: 'toast', msg: `A new title to wear before your name: “${title}” (the Legends tab).`, kind: 'gold' });
  }
}

/** A tenth more for every groupmate in company, up to three. */
export const GROUP_QUEST_BONUS = 0.1;

/** A mentor (docs/11 P6): a groupmate in company this many levels or more above the captain who does the quest. */
export const MENTOR_GAP = 10;
/** The apprentice learns this much faster under a mentor's eye; the mentor is paid this share of the silver. */
export const MENTOR_XP = 0.1;
export const MENTOR_PAY = 0.25;

/** Veterans in the group within convoy range, ten levels or more above the captain: the two most senior. */
function mentorsNear(game: Game, s: PlayerSession): PlayerSession[] {
  const g = groupOfAccount(game, s.accountId);
  const ship = s.ship;
  if (!g || !ship) return [];
  const out: PlayerSession[] = [];
  for (const acc of g.members) {
    const m = acc === s.accountId ? null : game.sessionByAccount(acc);
    if (!m?.profile || !m.ship?.alive || m.profile.level < s.profile!.level + MENTOR_GAP) continue;
    if (Math.hypot(m.ship.state.x - ship.state.x, m.ship.state.y - ship.state.y) <= CONVOY_RANGE) out.push(m);
  }
  return out.sort((a, b) => b.profile!.level - a.profile!.level).slice(0, 2);
}

export function completeQuest(game: Game, s: PlayerSession, q: QuestDef): void {
  const p = s.profile!;
  if (q.kind === 'campaign') return campaignDone(game, s, q); // docs/36: the campaign pays as the campaign pays
  // docs/19 E15: an Admiralty's contract pays as the Admiralty pays (silver, glory and a relic's part).
  if (q.category === 'admiralty') {
    p.quests.active = p.quests.active.filter((a) => a.id !== q.id);
    p.quests.done.push(q.id);
    contractDone(game, s, q);
    return;
  }
  const st = p.quests.active.find((a) => a.id === q.id);
  const fast = !!st?.fastUntil && game.now <= st.fastUntil;
  p.quests.active = p.quests.active.filter((a) => a.id !== q.id);
  p.quests.done.push(q.id);
  const company = Math.min(3, matesNear(game, s));
  const k = 1 + GROUP_QUEST_BONUS * company;
  // The pay as chosen on taking it: all silver, or a part in fine shot or in the port's favour.
  const pay = questPayOf(st?.pay ?? 'silver', q.reward.silver, q.requires.level ?? 1);
  const mentors = mentorsNear(game, s);
  // A job pays a veteran more (docs/16 P2); a story pays what it pays.
  const vet = q.kind === 'job' ? veteranPay(p.level, q.requires.level ?? 1) : 1;
  const silver = Math.round(pay.silver * vet * k * (fast ? 1 + FAST_BONUS : 1) * opsSilverMul(game)), xp = Math.round(questXpOf(game, p, q) * k * (mentors.length ? 1 + MENTOR_XP : 1));
  p.gold += silver;
  game.db.ledger(s.accountId, 'quest', silver, q.id);
  game.grantXp(s, xp, null);
  seasonStat(game, s, 'quests', 1); // the season's table of quests done
  guildGoalEvent(game, s, 'quest_done');
  // The port whose people gave the work remembers who did it (docs/11 P6): standing with its faction.
  let rep: { faction: FactionId; n: number } | undefined;
  const home = game.portById(q.port);
  if (home && (q.kind === 'job' || q.kind === 'story')) {
    rep = { faction: home.faction, n: pay.rep };
    changeRep(p, rep.faction, rep.n);
  }
  // Now and then something more for the hold: supplies from a grateful quay, rarely a treasure map.
  let extra: 'map' | 'supplies' | undefined;
  const roll = hashString(`${q.id}:${s.accountId}`) % 100;
  if (q.kind === 'job' && roll < 6 && grantMap(game, s, makeMap(game, p.level < 20 ? 1 : p.level < 40 ? 2 : 3), q.mentor.split(',')[0])) extra = 'map';
  else if (roll < 30 && s.ship) {
    s.ship.ammo.round = (s.ship.ammo.round ?? 0) + 20;
    s.ship.ammo.chain = (s.ship.ammo.chain ?? 0) + 10;
    extra = 'supplies';
  }
  let stores: { heavy: number; incendiary: number } | undefined;
  if ((pay.heavy || pay.incendiary) && s.ship) {
    s.ship.ammo.heavy = (s.ship.ammo.heavy ?? 0) + pay.heavy;
    s.ship.ammo.incendiary = (s.ship.ammo.incendiary ?? 0) + pay.incendiary;
    stores = { heavy: pay.heavy, incendiary: pay.incendiary };
  }
  // Side quests (docs/12 P9): a tattoo for the chain's last, and a choice of three pieces of gear.
  if (q.reward.tattoo) earnTattoo(game, s, q.reward.tattoo);
  if (q.id === 'side_ingrid_3') giveCalf(game, s, 'ingrid');
  if (q.id === 'side_cat_1') givePet(game, s, 'cat'); // Mother Grisel's kitten (docs/12 P10 #3) // Ingrid entrusts a White Orca calf (docs/12 P10 #2)
  if (q.reward.choice) offerChoice(game, s, q);
  game.sendTo(s, { t: 'quest_done', name: q.name, silver, xp, ...(fast ? { fast: true } : {}), ...(company ? { company } : {}), ...(rep ? { rep } : {}), ...(extra ? { extra } : {}), ...(stores ? { stores } : {}), ...(mentors.length ? { mentor: mentors[0].name } : {}) });
  // The mentors are paid for the guidance, and counted in the season's table of mentors.
  for (const m of mentors) {
    const fee = Math.max(50, Math.round(q.reward.silver * MENTOR_PAY));
    m.profile!.gold += fee;
    game.db.ledger(m.accountId, 'mentor', fee, q.id);
    seasonStat(game, m, 'mentored', 1);
    m.profile!.stats.mentored = (m.profile!.stats.mentored ?? 0) + 1;
    game.sendTo(m, { t: 'toast', msg: `You saw ${s.name} through “${q.name}”: ${fee} silver for the guidance.`, kind: 'gold' });
    workTitles(game, m);
  }
  workTitles(game, s);
  if (q.reward.path && !p.paths.includes(q.reward.path)) {
    p.paths.push(q.reward.path);
    game.sendTo(s, { t: 'toast', msg: `${q.mentor} teaches you the ${CAPTAINS[q.reward.path].archetype}'s Path. Change Path at any Captain's House.`, kind: 'gold' });
  }
  if (q.reward.deed) grantDeed(game, s, q.reward.deed);
  if (q.id === 'q_first_descent') game.sendTo(s, { t: 'toast', msg: 'The Abyss has answered you. The Abyssal tree is open.', kind: 'gold' });
}

// ------------------------------------------------------------------ Paths

/** Change Path at a Captain's House: out of combat, Wanted 2 or less, once an hour. */
export function switchPath(game: Game, s: PlayerSession, port: Port, to: CaptainId): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  if (!CAPTAINS_HOUSES.includes(port.id)) return 'There is no Captain\'s House here';
  if (!CAPTAINS[to]) return 'No such Path';
  if (!p.paths.includes(to)) return `You have not learned the ${CAPTAINS[to].archetype}'s Path`;
  if (p.captain === to) return 'You already walk that Path';
  if (wantedLevel(p.infamy) > 2) return 'The House does not receive the hunted';
  if (game.now < p.pathSwitchAt + PATH_SWITCH_CD) return `You changed Path recently (${Math.ceil((p.pathSwitchAt + PATH_SWITCH_CD - game.now) / 60)} min)`;
  // The deep keeps what it was given: Abyssal talents stay only with the Drowned or after the First Descent.
  if (p.captain === 'drowned' && to !== 'drowned' && !p.deeds.includes('deed_first_descent') && pointsInTree(p.talents, 'abyssal') > 0) {
    return 'The Abyss will not let you go: forget your Abyssal talents or make the First Descent';
  }
  p.captain = to;
  p.pathSwitchAt = game.now;
  ship.captain = to;
  ship.dread = 0;
  ship.recompute(game.now);
  game.toastShip(ship, `You take up the ${CAPTAINS[to].archetype}'s Path. ${CAPTAINS[to].name}'s legacy is yours.`, 'good');
  return null;
}

// ------------------------------------------------------------------ oaths

export type Oath = 'code' | 'marque';

/** Swear to the Code at Cinderhold, or take a Crown letter of marque at Gravesend. */
export function swearOath(game: Game, s: PlayerSession, port: Port, oath: Oath): string | null {
  const p = s.profile!;
  if (p.oath) return `You are already bound: ${p.oath === 'code' ? 'the Code' : 'a letter of marque'}`;
  if (oath === 'code') {
    if (port.id !== 'cinderhold' && !(port.faction === 'confederacy' && codeAnywhere(p))) return 'The Code is sworn only at Cinderhold';
    if ((p.reputation.confederacy ?? 0) < 10) return 'The Brethren do not know you yet (Confederacy 10)';
    p.oath = 'code';
    changeRep(p, 'confederacy', 15);
    changeRep(p, 'crown', -25);
    game.toastShip(s.ship!, 'You swear on the Code before the Brethren. Pirates will not fire on you first; the Crown will hang you.', 'good');
  } else {
    if (port.id !== 'gravesend') return 'Letters of marque are issued only at Gravesend';
    if ((p.reputation.crown ?? 0) < 10) return 'The Admiralty does not trust you yet (Crown 10)';
    if (wantedLevel(p.infamy) > 0) return 'Not while you are wanted';
    p.oath = 'marque';
    changeRep(p, 'crown', 10);
    changeRep(p, 'confederacy', -25);
    game.toastShip(s.ship!, 'A letter of marque: Confederacy ships and pirates are fair game, and the Crown pays for every one.', 'good');
  }
  grantDeed(game, s, 'deed_black_flag_oath');
  return null;
}

export function sanitizeQuests(p: Profile): void {
  p.quests ??= newQuestLog();
  p.quests.active ??= [];
  p.quests.done ??= [];
  // A group contract of a past day (after a restart) is found again by its id.
  for (const q of p.quests.active) if (!QUESTS_BY_ID[q.id]) {
    if (isAdmId(q.id)) admiraltyById(q.id); // docs/19 E15: the Admiralty's contract of its week
    else eliteById(q.id);
  }
  p.quests.active = p.quests.active.filter((q) => QUESTS_BY_ID[q.id]);
  // docs/36: a campaign quest not of her place now (a save of before a migration, a slot moved) is let go
  p.quests.active = p.quests.active.filter((q) => {
    const m = QUESTS_BY_ID[q.id].campaign;
    return !m || m.slot === (p.campaign?.at ?? -1);
  });
  p.paths ??= [p.captain];
  if (!p.paths.includes(p.captain)) p.paths.push(p.captain);
  p.pathSwitchAt ??= -1e9;
  p.oath ??= null;
}
