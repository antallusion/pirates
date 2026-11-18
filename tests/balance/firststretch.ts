// VK moderation 4.1.6.4 (2026-11-18: «после обучения первый уровень довольно сложный, его не получается пройти с первого
// раза»): the first stretch of a new captain, played as the game gives it to her — the First Watch's raider, then the
// campaign's quests from the first, each fight on the real sea with the mark «Плыть» shows her (goalroute.ts) and her own
// ship, men and level as they stand by then. Every fight is fought once, by the quick battle with her side played by the
// sea's mind at no skill at all (tacbattle.ts aiSkill: a human's side is 0) — the newcomer who taps without thinking —
// and counted won or lost at the first try. The steps that are no fight (a port, an island's waters, a town) are done by
// the game's own events, as tests/campaign.test.ts plays the road.
//   node --disable-warning=ExperimentalWarning tools/balance-firststretch.ts [runs] [slots]

import { canBoard, startBoarding } from '../../server/src/game/boarding.ts';
import { attackRoam, roamersAbout, roamRatio, roamWhere } from '../../server/src/game/roamers.ts';
import { closeFight, landFighting, landTac, lairList, lairBeach, lairRatio, startFight } from '../../server/src/game/beastlairs.ts';
import { acceptCampaign, campaignActive, campaignFoes, campaignNext, campaignSlot } from '../../server/src/game/campaign.ts';
import { routeFor } from '../../server/src/game/goalroute.ts';
import { questEvent, completeQuest } from '../../server/src/game/quests.ts';
import { startPursuit, stopPursuit } from '../../server/src/game/pursuit.ts';
import { tacAction } from '../../server/src/game/tactical.ts';
import { onboardingAction } from '../../server/src/game/onboarding.ts';
import type { Game } from '../../server/src/game/Game.ts';
import type { PlayerSession } from '../../server/src/game/player.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { QUESTS_BY_ID } from '../../shared/src/data/quests.ts';
import type { QuestStep } from '../../shared/src/data/quests.ts';
import { PROTOCOL_VERSION } from '../../shared/src/constants.ts';
import { Rng } from '../../shared/src/rng.ts';
import { xpForLevel } from '../../shared/src/constants.ts';
import { FakeConn, giveScrolls, makeGame, steps } from '../helpers.ts';
import type { WsConnection } from '../../server/src/net/websocket.ts';

export interface StretchFight {
  /** The campaign's slot (−1: the First Watch). */
  slot: number;
  quest: string;
  kind: 'watch' | 'sink' | 'board' | 'neutral' | 'lair';
  /** What she fought. */
  foe: string;
  level: number;
  won: boolean;
}

const FIGHTS = new Set(['sink', 'board', 'neutral', 'lair']);

function put(game: Game, ship: ShipEntity, x: number, y: number): void {
  ship.docked = null;
  ship.state = { ...ship.state, x, y, speed: 0 };
  game.grid.upsert(ship.id, x, y);
}

/** Her ship made whole between the fights (a captain puts in and refits between quests): hull, sails, ammunition. Her men
 *  are as the fights left them (the harbour's tavern refills them for silver, as hers would). */
function refit(s: PlayerSession): void {
  const sh = s.ship!;
  sh.hull = sh.stats.hullMax;
  sh.sails = sh.stats.sailHpMax;
  sh.morale = Math.max(sh.morale, 70);
  sh.ammo.round = Math.max(sh.ammo.round, 80);
  sh.lastStandUntil = 0;
  if (sh.crew < sh.stats.crewMax) sh.crew = sh.stats.crewMax;
}

/** The hex battle on deck fought out by the quick battle (her side at no skill). */
function boardOut(game: Game, s: PlayerSession, foe: ShipEntity): boolean {
  const me = s.ship!;
  const h = me.state.heading;
  foe.state = { ...foe.state, x: me.state.x + Math.cos(h) * 22, y: me.state.y + Math.sin(h) * 22, heading: h, speed: 0, sail: 0 };
  game.grid.upsert(foe.id, foe.state.x, foe.state.y);
  me.state.speed = 0;
  const cb = canBoard(game, me, foe);
  if (cb !== null) {
    if (process.env.STRETCH_DEBUG) console.error(`canBoard: ${cb}`);
    return false;
  }
  startBoarding(game, me, foe, 'standard');
  if (!me.boarding) return false;
  giveScrolls(game, s.name, 5);
  if (me.boarding.fight.tac) tacAction(game, me, { a: 'quick' });
  for (let i = 0; i < 20 * 30 && me.boarding; i++) game.step();
  const won = !!s.pendingBoarding || !!foe.prize || foe.surrendered || !foe.alive;
  if (s.pendingBoarding) (s.conn as unknown as FakeConn).push({ t: 'loot_take', take: {}, fate: 'sink' });
  steps(game, 5);
  return won;
}

/** A broadside fight to the end (her guns at «Атаковать», auto-fire on, as a phone plays it). */
function gunsOut(game: Game, s: PlayerSession, foe: ShipEntity): boolean {
  const me = s.ship!;
  s.autoFire = true;
  const a = Math.atan2(foe.state.x - me.state.x, -(foe.state.y - me.state.y));
  foe.state = { ...foe.state, x: me.state.x + Math.sin(a) * 600, y: me.state.y - Math.cos(a) * 600 };
  game.grid.upsert(foe.id, foe.state.x, foe.state.y);
  startPursuit(game, s, foe.id, 'guns');
  for (let i = 0; i < 20 * 240; i++) {
    game.step();
    if (!foe.alive || foe.surrendered || foe.sinkingUntil) break;
    if (me.hull < me.stats.hullMax * 0.08 || !me.alive) break;
    if (i % 100 === 99 && !me.boarding) startPursuit(game, s, foe.id, 'guns');
  }
  stopPursuit(game, s, 'off');
  const won = (!foe.alive || foe.surrendered || !!foe.sinkingUntil) && me.alive && me.hull >= me.stats.hullMax * 0.08;
  if (foe.alive && foe.surrendered) foe.hull = 0;
  return won;
}

/** The campaign's fight of a sea step comes to her in its waters (campaign.ts): she waits for it there. */
function campaignFoe(game: Game, s: PlayerSession, st: { near?: { x: number; y: number; r: number } }): ShipEntity | null {
  const me = s.ship!;
  if (st.near) put(game, me, st.near.x, st.near.y);
  for (let i = 0; i < 20 * 90; i++) {
    const id = campaignFoes(game, s).find((x) => game.ships.get(x)?.alive && !game.ships.get(x)!.surrendered);
    if (id !== undefined) return game.ships.get(id)!;
    game.step();
  }
  return null;
}

function landOut(game: Game, s: PlayerSession): boolean {
  const before = s.profile!.campaign!.at * 100 + (campaignActive(s.profile!)?.step ?? 0) * 10 + (campaignActive(s.profile!)?.progress ?? 0);
  if (!landFighting(game, s)) return false;
  landTac(game, s, { a: 'quick' }, true);
  for (let i = 0; i < 20 * 8 && landFighting(game, s); i++) game.step();
  // (the reckoning's card closed: the boats back aboard)
  if (landFighting(game, s)) closeFight(game, s);
  steps(game, 3);
  const after = s.profile!.campaign!.at * 100 + (campaignActive(s.profile!)?.step ?? 0) * 10 + (campaignActive(s.profile!)?.progress ?? 0);
  return after > before;
}

/** One fight of a step: the mark «Плыть» gives her, fought once. */
function fightStep(game: Game, s: PlayerSession, id: string, st: QuestStep): Omit<StretchFight, 'slot' | 'quest'> | null {
  const me = s.ship!;
  refit(s);
  if (st.type === 'sink' || st.type === 'board') {
    const foe = campaignFoe(game, s, st);
    if (!foe) return null;
    const what = `${foe.loadout.classId}⚓${foe.shipLevel}${foe.softFor === me.id ? ' (soft)' : ''}`;
    const won = st.type === 'board' ? boardOut(game, s, foe) : gunsOut(game, s, foe);
    if (!won) {
      // lost: the step done for her all the same (the measure goes on), the foe gone
      if (game.ships.has(foe.id)) game.removeShip(foe.id);
      questEvent(game, s, { k: st.type, victim: foe });
    }
    return { kind: st.type, foe: what, level: s.profile!.level, won };
  }
  if (st.type === 'neutral') {
    const r = routeFor(game, s, `q:${id}`);
    if (!('x' in r)) return null;
    const sp = roamersAbout(game, r.x, r.y, 200).map((x) => ({ x, w: roamWhere(game, x) })).sort((a, b) => Math.hypot(a.w.x - r.x, a.w.y - r.y) - Math.hypot(b.w.x - r.x, b.w.y - r.y))[0];
    if (!sp) return null;
    put(game, me, sp.w.x + 25, sp.w.y);
    const ratio = roamRatio(game, s, sp.x);
    const why = attackRoam(game, s, sp.x.id);
    if (why) return { kind: 'neutral', foe: `${sp.x.kind}⚓${sp.x.level}×${sp.x.n} refused: ${why}`, level: s.profile!.level, won: false };
    const won = landOut(game, s);
    if (!won) questEvent(game, s, { k: 'neutral' });
    return { kind: 'neutral', foe: `${sp.x.kind}⚓${sp.x.level}×${sp.x.n} (×${ratio.toFixed(1)})`, level: s.profile!.level, won };
  }
  if (st.type === 'lair') {
    const t = game.questTargets(s)[id];
    if (!t) return null;
    const l = lairList(game).map((x) => ({ x, b: lairBeach(game, x) })).sort((a, b) => Math.hypot(a.b.x - t.x, a.b.y - t.y) - Math.hypot(b.b.x - t.x, b.b.y - t.y))[0];
    if (!l) return null;
    put(game, me, l.b.x, l.b.y);
    const ratio = lairRatio(game, s, l.x);
    const why = startFight(game, s, l.x.id, true);
    if (why) return { kind: 'lair', foe: `${l.x.kind}⚓${l.x.level} refused: ${why}`, level: s.profile!.level, won: false };
    const won = landOut(game, s);
    if (!won) questEvent(game, s, { k: 'lair', island: l.x.island, kind: l.x.kind });
    return { kind: 'lair', foe: `${l.x.kind}⚓${l.x.level} ${l.x.size} (×${ratio.toFixed(1)})`, level: s.profile!.level, won };
  }
  return null;
}

/** A step that is no fight, done by the game's own event for it (tests/campaign.test.ts doStep, mentors.ts credit). */
function creditStep(game: Game, s: PlayerSession, st: QuestStep): void {
  const p = s.profile!, ship = s.ship!;
  const qs = campaignActive(p);
  if (!qs) return;
  const before = `${qs.id}:${qs.step}:${qs.progress}`;
  const port = (id?: string) => (id ? game.portById(id) : undefined) ?? game.portById('saltmarrow')!;
  switch (st.type) {
    case 'buy':
      questEvent(game, s, { k: 'buy', shop: st.shop, port: 'saltmarrow' });
      break;
    case 'visit':
      questEvent(game, s, { k: 'dock', port: port(st.port) });
      break;
    case 'recruit': {
      // men signed on in her harbour's tavern (the step's own: Jory Penn's six)
      const pt = port();
      put(game, ship, pt.x, pt.y);
      ship.docked = pt.id;
      (s.conn as unknown as FakeConn).push({ t: 'hire_crew', qty: st.count, prof: 'sailor' } as never);
      steps(game, 2);
      ship.docked = null;
      if (campaignActive(p) && `${campaignActive(p)!.id}:${campaignActive(p)!.step}:${campaignActive(p)!.progress}` === before) questEvent(game, s, { k: 'recruit', n: st.count });
      break;
    }
    case 'deliver':
      ship.cargo[st.good] = Math.max(ship.cargo[st.good] ?? 0, st.qty);
      questEvent(game, s, { k: 'dock', port: port(st.port) });
      break;
    case 'dive':
      for (let i = 0; i < st.count; i++) questEvent(game, s, { k: 'dive' } as never);
      break;
    default:
      break;
  }
  const now = campaignActive(p);
  if (now && `${now.id}:${now.step}:${now.progress}` === before) {
    const q = QUESTS_BY_ID[now.id];
    now.step++;
    now.progress = 0;
    if (now.step >= q.steps.length) completeQuest(game, s, q);
  }
}

/** The First Watch's raider: «Атаковать», the guns, «На абордаж» and the battle on deck. */
function watchFight(game: Game, s: PlayerSession): StretchFight | null {
  const ship = s.ship!;
  const c = s.conn as unknown as FakeConn;
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  const raider = [...game.ships.values()].find((x) => x.name === 'Red Novice' && x.alive);
  if (!raider) return null;
  c.push({ t: 'attack', target: raider.id, mode: 'board' });
  steps(game, 21);
  // the lesson's guns leave her seven tenths of her men (onboarding.ts PRACTICE_FLOOR)
  raider.crew = Math.max(1, Math.ceil(raider.crew * 0.7));
  const won = boardOut(game, s, raider);
  return { slot: -1, quest: 'watch', kind: 'watch', foe: `${raider.loadout.classId}⚓${raider.shipLevel}`, level: s.profile!.level, won };
}

/** A fresh captain's first stretch: the watch, then the campaign's first `slots` quests. */
export function firstStretch(seed: number, slots = 22): StretchFight[] {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  (game as unknown as { rng: Rng }).rng = new Rng(seed);
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  const name = `Stretch ${seed}`;
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'First Wake', tutorial: true });
  const s = game.sessionByName(name)!;
  const p = s.profile!;
  // (the mutiny a costly fight may bring is answered as a player would: paid off)
  const out: StretchFight[] = [];
  const w = watchFight(game, s);
  if (w) out.push(w);
  // the watch's last step («В порт»)
  const home = game.portById('saltmarrow')!;
  put(game, s.ship!, home.x, home.y);
  (game as unknown as { dockShip(x: PlayerSession, p: unknown): void }).dockShip(s, home);
  steps(game, 21);
  if (p.tutorial.on) onboardingAction(game, s, 'skip_all');
  steps(game, 5);
  s.ship!.docked = null;
  for (let guard = 0; guard < 400 && (p.campaign?.at ?? 0) < slots; guard++) {
    if (p.company.mutiny) c.push({ t: 'mutiny', choice: 'pay' });
    const qs = campaignActive(p);
    if (!qs) {
      const slot = campaignSlot(game, p);
      if (!slot) break;
      // a fork: she takes its first way
      if (slot.b) acceptCampaign(game, s, slot.a.id);
      else if (p.level < slot.gate) {
        // the next quest waits for its level: she earns it about the sea (the day's work, a board's job)
        p.xp = Math.max(p.xp, xpForLevel(p.level + 1));
        game.grantXp(s, 1, null, false, true);
      } else campaignNext(game, s);
      steps(game, 2);
      continue;
    }
    const q = QUESTS_BY_ID[qs.id];
    const st = q.steps[qs.step];
    if (!st) continue;
    if (FIGHTS.has(st.type)) {
      const before = `${qs.id}:${qs.step}:${qs.progress}`;
      const f = fightStep(game, s, qs.id, st);
      if (f) out.push({ slot: q.campaign?.slot ?? -1, quest: qs.id, ...f });
      const now = campaignActive(p);
      if (now && `${now.id}:${now.step}:${now.progress}` === before) creditStep(game, s, st);
    } else creditStep(game, s, st);
    steps(game, 3);
  }
  if (process.env.STRETCH_DEBUG) console.error(`at ${p.campaign?.at} level ${p.level} active ${JSON.stringify(campaignActive(p))}`);
  return out;
}
