// Path and Legend quests (docs/00 D1, docs/02 §7): mentors in their ports, step objectives driven by what the
// captain does at sea, Path unlocks and switching at a Captain's House, the First Descent, and faction oaths.

import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { FACTIONS, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { ARC_QUESTS, CAPTAINS_HOUSES, ISLAND_JOBS, JOBS, QUESTS, QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { hashString } from '../../../shared/src/rng.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { QuestDef, QuestStep } from '../../../shared/src/data/quests.ts';
import { TREES, pointsInTree } from '../../../shared/src/data/talents.ts';
import type { TreeId } from '../../../shared/src/data/talents.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import { changeRep } from './player.ts';
import { grantDeed } from './progression.ts';
import { dailyEvent } from './dailies.ts';
import { commonEvent } from './commongoal.ts';
import { guildGoalEvent } from './guildgoal.ts';
import { CONVOY_RANGE, groupOfAccount } from './party.ts';
import { seasonStat } from './seasons.ts';
import { grantMap, makeMap } from './explorefx.ts';
import type { ShipEntity } from './ship.ts';

export const MAX_ACTIVE_QUESTS = 5;
/** A port's board shows this many of its generated jobs at a time, a new set every few hours. */
export const JOBS_ON_BOARD = 5;
export const JOB_ROTATION_SEC = 4 * 3600;
export const PATH_SWITCH_CD = 3600;

export interface QuestState {
  id: string;
  step: number;
  progress: number;
  startedAt: number;
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
  | { k: 'dock'; port: Port }
  | { k: 'land'; island: number; feature: string };

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

export function questOffers(p: Profile, port: Port, now = 0): { q: QuestDef; blocked: string | null }[] {
  // An arc's chapter is offered once the chapter before it is done.
  const story = [...QUESTS, ...ARC_QUESTS].filter((q) => q.port === port.id && !p.quests.done.includes(q.id) && !p.quests.active.some((a) => a.id === q.id) && (q.requires.done ?? []).every((d) => p.quests.done.includes(d)));
  return [...story, ...boardJobs(p, port, now)]
    .map((q) => ({ q, blocked: questBlocked(p, q) }))
    .filter((o) => o.blocked !== 'You already walk this Path' && o.blocked !== 'The deep already knows you');
}

/** The generated jobs a port's board shows now: a few of its seventy, new every four hours, suited to the
 *  captain's level first (the ones she is not yet fit for may show, greyed). */
export function boardJobs(p: Profile, port: Port, now: number): QuestDef[] {
  const mine = JOBS.filter((q) => q.port === port.id && !p.quests.done.includes(q.id) && !p.quests.active.some((a) => a.id === q.id));
  if (!mine.length) return [];
  const window = Math.floor(now / JOB_ROTATION_SEC);
  const scored = mine.map((q) => ({ q, k: ((hashString(q.id) ^ (window * 2654435761)) >>> 0) + ((q.requires.level ?? 1) > p.level + 5 ? 2 ** 32 : 0) }));
  scored.sort((a, b) => a.k - b.k);
  return scored.slice(0, JOBS_ON_BOARD).map((x) => x.q);
}

export function acceptQuest(game: Game, s: PlayerSession, port: Port, id: string): string | null {
  const p = s.profile!;
  const q = QUESTS_BY_ID[id];
  if (!q || q.port !== port.id) return 'Nobody here offers that';
  if (q.kind === 'job' && !boardJobs(p, port, game.now).includes(q)) return 'That job is no longer on the board';
  const why = questBlocked(p, q);
  if (why) return why;
  if (p.quests.active.length >= MAX_ACTIVE_QUESTS) return `At most ${MAX_ACTIVE_QUESTS} quests at once`;
  p.quests.active.push({ id, step: 0, progress: 0, startedAt: game.now });
  game.sendTo(s, { t: 'toast', msg: `${q.mentor}: “${q.summary}” — ${q.steps[0].text}`, kind: 'info' });
  // A first step that is already satisfied (being in the right port) completes at once.
  questEvent(game, s, { k: 'dock', port });
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
  if (p.quests.active.length >= MAX_ACTIVE_QUESTS) {
    game.sendTo(s, { t: 'toast', msg: `${q.mentor} has work for you once you have room for it (${MAX_ACTIVE_QUESTS} quests at most).`, kind: 'info' });
    return;
  }
  // The giver speaks, and the captain decides (the offer stands while the boats are on the beach).
  s.questOffer = { id: q.id, island: islandId, until: game.now + 180 };
  game.sendTo(s, { t: 'quest_offer', island: islandId, offer: offerView(q) });
}

function offerView(q: QuestDef) {
  return { id: q.id, name: q.name, kind: q.kind, mentor: q.mentor, summary: q.summary, steps: q.steps.map((x) => x.text), blocked: null, silver: q.reward.silver, xp: q.reward.xp, category: q.category, portrait: q.portrait };
}

/** Share a quest with the group (docs/11 P6): each groupmate online who may take it is offered it, wherever they
 *  are; the ones who cannot are named to the sharer. */
export function shareQuest(game: Game, s: PlayerSession, id: string): string | null {
  const q = QUESTS_BY_ID[id];
  if (!q || !s.profile!.quests.active.some((a) => a.id === id)) return 'You are not on that quest';
  if (q.kind === 'path' || q.kind === 'legend') return 'A Path or a Legend is walked alone';
  const g = groupOfAccount(game, s.accountId);
  if (!g) return 'You sail in no group';
  let offered = 0;
  for (const acc of g.members) {
    if (acc === s.accountId) continue;
    const m = game.sessionByAccount(acc);
    const mp = m?.profile;
    if (!m || !mp) continue;
    if (mp.quests.active.some((a) => a.id === id) || mp.quests.done.includes(id)) continue;
    if (questBlocked(mp, q) || mp.quests.active.length >= MAX_ACTIVE_QUESTS) {
      game.sendTo(s, { t: 'toast', msg: `${m.name} cannot take it on yet.`, kind: 'info' });
      continue;
    }
    m.questOffer = { id, until: game.now + 180, from: s.name };
    game.sendTo(m, { t: 'quest_offer', from: s.name, offer: offerView(q) });
    offered++;
  }
  return offered ? null : 'Nobody in your group can take it on';
}

/** The captain answers an offer: take the job, or leave it (the beach asks again on the next landing). */
export function answerOffer(game: Game, s: PlayerSession, id: string, take: boolean): string | null {
  const o = s.questOffer;
  if (!o || o.id !== id || game.now > o.until) return take ? (o?.from ? 'That offer has lapsed' : 'The people on the beach have gone back to their work') : null;
  s.questOffer = null;
  if (!take) return null;
  const p = s.profile!;
  const q = QUESTS_BY_ID[id];
  if (!q || p.quests.active.some((a) => a.id === id) || p.quests.done.includes(id)) return null;
  if (p.quests.active.length >= MAX_ACTIVE_QUESTS) return `At most ${MAX_ACTIVE_QUESTS} quests at once`;
  p.quests.active.push({ id: q.id, step: 0, progress: 0, startedAt: game.now });
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
  dailyEvent(game, s, ev);
  commonEvent(game, s, ev);
  guildGoalEvent(game, s, ev);
  for (const qs of [...p.quests.active]) {
    const q = QUESTS_BY_ID[qs.id];
    if (!q) continue;
    // Several steps may fall in one go (arriving somewhere with the goods already aboard).
    for (let guard = 0; guard < 4; guard++) {
      const st = q.steps[qs.step];
      if (!st) break;
      const gained = stepGain(game, s, st, ev);
      if (gained <= 0) break;
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

function stepGain(game: Game, s: PlayerSession, st: QuestStep, ev: QuestEvent): number {
  const ship = s.ship!;
  switch (st.type) {
    case 'visit':
      return ev.k === 'dock' && ev.port.id === st.port ? 1 : 0;
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
      return ev.k === 'land' && ev.island === st.island && (!st.site || st.site === ev.feature) ? 1 : 0;
    case 'sink':
      if (ev.k !== 'sink') return 0;
      if (st.region && ev.victim.region !== st.region) return 0;
      if (st.role && ev.victim.npcRole !== st.role && !(st.role === 'patrol' && ev.victim.npcRole === 'hunter')) return 0;
      if (st.minTier && ev.victim.cls.tier < st.minTier) return 0;
      return 1;
    case 'board':
      return ev.k === 'board' ? 1 : 0;
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
      return ev.k === 'dive' ? 1 : 0;
    case 'die_in':
      return ev.k === 'die' && ev.region === st.region ? 1 : 0;
    case 'reach':
      return ev.k === 'tick' && !ship.docked && ship.region === st.region && (st.north === undefined || ship.state.y < st.north) ? 1 : 0;
    case 'time_in':
      if (ev.k !== 'tick' || ship.docked || ship.region !== st.region) return 0;
      if (st.weather && game.weatherOf(ship) !== st.weather) return 0;
      return ev.dt;
  }
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

/** A tenth more for every groupmate in company, up to three. */
export const GROUP_QUEST_BONUS = 0.1;

function completeQuest(game: Game, s: PlayerSession, q: QuestDef): void {
  const p = s.profile!;
  p.quests.active = p.quests.active.filter((a) => a.id !== q.id);
  p.quests.done.push(q.id);
  const company = Math.min(3, matesNear(game, s));
  const k = 1 + GROUP_QUEST_BONUS * company;
  const silver = Math.round(q.reward.silver * k), xp = Math.round(q.reward.xp * k);
  p.gold += silver;
  game.db.ledger(s.accountId, 'quest', silver, q.id);
  game.grantXp(s, xp, null);
  seasonStat(game, s, 'quests', 1); // the season's table of quests done
  guildGoalEvent(game, s, 'quest_done');
  // The port whose people gave the work remembers who did it (docs/11 P6): standing with its faction.
  let rep: { faction: FactionId; n: number } | undefined;
  const home = game.portById(q.port);
  if (home && (q.kind === 'job' || q.kind === 'story')) {
    rep = { faction: home.faction, n: 2 + Math.min(6, Math.round((q.requires.level ?? 1) / 10)) };
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
  game.sendTo(s, { t: 'quest_done', name: q.name, silver, xp, ...(company ? { company } : {}), ...(rep ? { rep } : {}), ...(extra ? { extra } : {}) });
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
    if (port.id !== 'cinderhold') return 'The Code is sworn only at Cinderhold';
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

/** A privateer's pay: 50 silver a tier for every Confederacy ship or pirate sunk under a letter of marque. */
export function marqueBounty(game: Game, s: PlayerSession, victim: ShipEntity): void {
  const p = s.profile!;
  if (p.oath !== 'marque') return;
  if (victim.faction !== 'confederacy' && victim.npcRole !== 'pirate') return;
  const pay = 50 * victim.cls.tier;
  p.gold += pay;
  game.db.ledger(s.accountId, 'marque', pay, victim.name);
  changeRep(p, 'crown', 1);
}

export function sanitizeQuests(p: Profile): void {
  p.quests ??= newQuestLog();
  p.quests.active ??= [];
  p.quests.done ??= [];
  p.quests.active = p.quests.active.filter((q) => QUESTS_BY_ID[q.id]);
  p.paths ??= [p.captain];
  if (!p.paths.includes(p.captain)) p.paths.push(p.captain);
  p.pathSwitchAt ??= -1e9;
  p.oath ??= null;
}
