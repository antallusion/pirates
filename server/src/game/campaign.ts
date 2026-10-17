// The main campaign on the server (docs/36; owner, 2026-10-17: «Сюжетка должна быть идеальной и работающей полностью
// везде, это самое главное»). Its 720 quests laid on the world at start (shared/src/data/campaign/build.ts), one after
// another: a captain holds one of them at a time, takes it at any port's «Кампания» or from «Цели и вести» wherever she
// is, and once it is done the next comes to her by itself when her level allows. Its experience is exact (the pace of
// pacing.ts: no frontier, no live ops, no rest — the road to the 60th is the campaign's alone), its silver modest, a
// chapter's end a purse and a title, a map or shot. Its fights come to her (spawnCampaignFoe): the Crown's quiet waters
// have no raiders of their own to board.

import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { buildCampaign } from '../../../shared/src/data/campaign/build.ts';
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
import type { PlayerSession, Profile } from './player.ts';
import type { QuestState } from './quests.ts';
import { questEvent, startQuest } from './quests.ts';
import { seasonStat } from './seasons.ts';

const built = new WeakMap<Game, Campaign>();

/** The campaign laid on this game's world (Game's constructor); its quests registered with the rest. */
export function initCampaign(game: Game, seed: number): Campaign {
  const c = buildCampaign(game.world, seed, CHAPTERS);
  built.set(game, c);
  registerCampaign(c.quests);
  return c;
}

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
  const meta = q.campaign!;
  // «Новое задание кампании: …» — a toast and a short card (the client holds them while she fights)
  game.sendTo(s, { t: 'campaign_new', id: q.id, name: q.name, ch: meta.ch, k: meta.k, size: chapterOfSlot(meta.slot).size, text: q.steps[0].text });
  // a first step done where she is (in the right port) is done at once
  const port = s.ship?.docked ? game.portById(s.ship.docked) : undefined;
  if (port) questEvent(game, s, { k: 'dock', port, fresh: true }); // (an «arrive at» step waits for her to put in again)
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
  const { size } = chapterOfSlot(meta.slot);
  game.sendTo(s, { t: 'quest_done', name: q.name, silver, xp: q.reward.xp, line: meta.done, campaign: { ch: meta.ch, k: meta.k, size, at: c.at, total: CAMPAIGN_SIZE } });
  if (meta.k === size - 1) chapterEnd(game, s, meta.ch, q.requires.level ?? 1);
  if (c.at >= CAMPAIGN_SIZE) game.sendTo(s, { t: 'toast', msg: 'The campaign is done. The tide sleeps.', kind: 'gold' });
  campaignNext(game, s, true);
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

/** A campaign fight's foes about her at once, how often another puts out, and how far they are counted. */
export const FOE_MAX = 2;
export const FOE_EVERY = 35;
const FOE_R = 7000;

interface FoeWatch {
  next: number;
  ids: number[];
  step: string;
  told: boolean;
}
const watches = new WeakMap<PlayerSession, FoeWatch>();

/** Every second (quests.ts questEvent, the tick): her campaign quest's fight, if its step is one, comes to her at sea. */
export function campaignTick(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship || ship.docked || !ship.alive || ship.boarding) return;
  const qs = campaignActive(p);
  const q = qs ? QUESTS_BY_ID[qs.id] : undefined;
  const st = q?.steps[qs!.step];
  if (!qs || !st || (st.type !== 'sink' && st.type !== 'board')) return;
  if (st.type === 'sink' && st.role && st.role !== 'pirate' && st.role !== 'ghost') return; // patrols and merchants sail the sea anyway
  const key = `${qs.id}:${qs.step}`;
  let w = watches.get(s);
  if (!w || w.step !== key) {
    w = { next: game.now + 8, ids: [], step: key, told: false };
    watches.set(s, w);
  }
  w.ids = w.ids.filter((id) => {
    const o = game.ships.get(id);
    return !!o && o.alive && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < FOE_R;
  });
  if (game.now < w.next || w.ids.length >= FOE_MAX || ship.inCombat(game.now)) return;
  w.next = game.now + FOE_EVERY;
  const foe = spawnCampaignFoe(game, ship, s.accountId, shipBandOf(q!.requires.level ?? 1), st.type === 'sink' && st.role === 'ghost');
  if (!foe) return;
  w.ids.push(foe.id);
  if (!w.told) game.sendTo(s, { t: 'toast', msg: 'Enemy sails close in: the campaign’s fight comes to you.', kind: 'bad' });
  w.told = true;
}

/** Her campaign's foes now (goalroute.ts: the run makes for them first). */
export function campaignFoes(game: Game, s: PlayerSession): number[] {
  return (watches.get(s)?.ids ?? []).filter((id) => game.ships.get(id)?.alive);
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
