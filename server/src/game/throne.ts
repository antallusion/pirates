// The Throne of the Sea on the server, part 1 (docs/19 E1–E3): her glory past the cap (the experience a captain of
// level 60 earns rises through endless ranks; each rank a boon of her choosing, every fifth a point of mastery), the
// mastery tree (its sea mods on her ship within the talents' caps, its battle side on her hero), and the trials of
// mastery — a legend of the skill alongside, grappled at once, fought in the boarding battle with an army a share
// above hers; won, the skill is hers at grandmaster (and the first won is a line in the sea's chronicle); lost, the
// legend will fight her again in three hours. A trial is fought with blunted steel: her men stand again after it.
// The trials' few rolls are on the Throne's own dice.

import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { GM_RANK, PRIMS, SKILLS, SKILL_IDS, SKILL_MAX, SKILL_SLOTS, heroBattle, startingOrders } from '../../../shared/src/data/hero.ts';
import type { HeroBattle, PrimId, Prims, SkillId, SkillSlot } from '../../../shared/src/data/hero.ts';
import {
  BRANCHES, GLORY_CAP, LEGENDS, MASTERY, MASTERY_BY_ID, TRIAL_MEN, TRIAL_PRIM, TRIAL_WAIT, gloryPending, gloryXp, masteryOther, masteryPoints, masterySea, masterySpent, masteryWhy,
  resetCost, throneLift,
} from '../../../shared/src/data/throne.ts';
import type { GloryView, MasteryRanks, ThroneLift, TrialView } from '../../../shared/src/data/throne.ts';
import type { StatMods } from '../../../shared/src/data/stats.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { ThroneClientMsg } from '../../../shared/src/throneproto.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { applyHero, heroOf, heroPrims } from './hero.ts';
import { startBoarding } from './boarding.ts';
import { chronicle } from './renown.ts';

/** What the profile keeps of the Throne. */
export interface ThroneRec {
  rank: number;
  /** Experience into the next rank. */
  xp: number;
  /** The ranks she has been told of (a rank's news goes out once). */
  told: number;
  picks: Partial<Prims>;
  nodes: MasteryRanks;
  /** Each skill's trial: when first won (wall ms), when the legend fights again (world s), how many tried. */
  trials: Partial<Record<SkillId, { won?: number; next?: number; tries: number }>>;
  /** She has been told the Throne is open (once, at the cap). */
  hailed?: boolean;
}

/** The Throne's own dice (like the auction house's: server/src/game/auction.ts). */
const rngs = new WeakMap<Game, Rng>();
function tr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x7b20e119)));
  return r;
}

/** Her Throne, made on first sight (and tidied: a save edited by hand keeps within the rules). */
export function throneOf(p: Profile): ThroneRec {
  const t = (p.throne ??= { rank: 0, xp: 0, told: 0, picks: {}, nodes: {}, trials: {} });
  t.rank = Math.max(0, Math.floor(t.rank || 0));
  t.xp = Math.max(0, t.xp || 0);
  t.told = Math.min(t.rank, Math.max(0, t.told ?? t.rank));
  t.picks ??= {};
  for (const k of Object.keys(t.picks) as PrimId[]) if (!PRIMS.includes(k)) delete t.picks[k];
  t.nodes ??= {};
  for (const id of Object.keys(t.nodes)) if (!MASTERY_BY_ID[id] || !(t.nodes[id] > 0)) delete t.nodes[id];
  t.trials ??= {};
  return t;
}

// ------------------------------------------------------------------ E1. glory

/** Experience past the cap into glory (player.ts addXp). Returns the ranks gained. */
export function addGlory(p: Profile, amount: number): number {
  if (p.level < MAX_LEVEL || !(amount > 0)) return 0;
  const t = throneOf(p);
  t.xp += Math.round(amount);
  let n = 0;
  while (t.xp >= gloryXp(t.rank)) {
    t.xp -= gloryXp(t.rank);
    t.rank++;
    n++;
  }
  return n;
}

/** The cap reached (progression.ts onLevelUp): the Throne's word, once. */
export function onCap(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p || p.level < MAX_LEVEL) return;
  const t = throneOf(p);
  if (t.hailed) return;
  t.hailed = true;
  game.sendTo(s, { t: 'toast', msg: 'The Throne of the Sea opens: past the cap your experience is glory. Open it from the captain’s plate.', kind: 'gold' });
}

/** After experience (Game.grantXp): the news of ranks gained, and her choice of boon. */
export function gloryNews(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p || !p.throne || p.throne.told >= p.throne.rank) return;
  const t = p.throne;
  for (let r = t.told + 1; r <= t.rank; r++) {
    game.sendTo(s, { t: 'toast', msg: r % 5 === 0 ? `Glory rank ${r}! A point of mastery is yours.` : `Glory rank ${r}!`, kind: 'gold' });
  }
  t.told = t.rank;
  if (gloryPending(t.rank, t.picks) > 0) game.sendTo(s, { t: 'toast', msg: 'A boon of glory to choose: open the Throne.', kind: 'gold' });
  game.pushSelf(s, true);
}

/** She takes a boon of glory: +1% to one primary's effect. */
export function pickGlory(game: Game, s: PlayerSession, prim: string): string | null {
  const p = s.profile!;
  const t = throneOf(p);
  if (!PRIMS.includes(prim as PrimId)) return 'No such boon';
  if (gloryPending(t.rank, t.picks) <= 0) return 'No boon of glory to choose now';
  const k = prim as PrimId;
  if ((t.picks[k] ?? 0) >= GLORY_CAP) return 'That boon is at its height';
  t.picks[k] = (t.picks[k] ?? 0) + 1;
  applyHero(game, s);
  return null;
}

// ------------------------------------------------------------------ E2. mastery

export function masteryPointsLeft(p: Profile): number {
  const t = throneOf(p);
  return masteryPoints(t.rank) - masterySpent(t.nodes);
}

/** A rank of a node of the mastery tree. */
export function learnMastery(game: Game, s: PlayerSession, id: string): string | null {
  const p = s.profile!;
  const t = throneOf(p);
  if (p.level < MAX_LEVEL) return `The Throne opens at level ${MAX_LEVEL}`;
  const why = masteryWhy(t.nodes, masteryPoints(t.rank), id);
  if (why) return why;
  t.nodes[id] = (t.nodes[id] ?? 0) + 1;
  applyHero(game, s);
  game.sendTo(s, { t: 'toast', msg: `Mastery: ${MASTERY_BY_ID[id].name[0]}.`, kind: 'good' });
  return null;
}

/** The tree forgotten, in port, for silver. */
export function resetMastery(game: Game, s: PlayerSession): string | null {
  const p = s.profile!;
  const t = throneOf(p);
  const spent = masterySpent(t.nodes);
  if (!spent) return 'Nothing to forget';
  if (!s.ship?.docked) return 'You must be in port';
  const cost = resetCost(spent);
  if (p.gold < cost) return `Needs ${cost} silver`;
  p.gold -= cost;
  game.db.ledger(s.accountId, 'mastery_reset', -cost, String(spent));
  t.nodes = {};
  applyHero(game, s);
  game.sendTo(s, { t: 'toast', msg: 'Your mastery is forgotten: the points are yours to spend again.', kind: 'info' });
  return null;
}

/** Her mastery's sea mods (hero.ts heroSource: with her skills', in the talents' vocabulary and caps). */
export function throneSea(p: Profile): StatMods {
  return p.throne ? masterySea(p.throne.nodes) : {};
}
/** What glory and mastery add to her hero in a boarding. */
export function liftOf(p: Profile): ThroneLift {
  const t = p.throne;
  return throneLift(t?.picks ?? {}, t?.nodes ?? {});
}
/** Her stores of will and stamina, deeper by glory and mastery. */
export const willLift = (p: Profile): number => (p.throne ? liftOf(p).will : 0);
export const stamLift = (p: Profile): number => (p.throne ? liftOf(p).stam : 0);
/** Her sea orders' will, a day's will, a dwelling's silver (the Mystic's and the Merchant's nodes). */
export const seaCostLift = (p: Profile | null | undefined): number => (p?.throne ? masteryOther(p.throne.nodes).seaCost ?? 0 : 0);
export const willDayLift = (p: Profile | null | undefined): number => (p?.throne ? masteryOther(p.throne.nodes).willDay ?? 0 : 0);
export const recruitLift = (p: Profile | null | undefined): number => (p?.throne ? masteryOther(p.throne.nodes).recruit ?? 0 : 0);

/** Glory and mastery on her battle self (hero.ts heroInput): her blows, shots and armour within ENDGAME_CAP, her
 *  orders, her stores, her path's moves. `mana` and `stam` are what she has now (her stores are deeper than the
 *  hero's own reckoning). */
export function applyLift(hb: HeroBattle, l: ThroneLift, mana: number, stam?: number): HeroBattle {
  hb.melee += l.melee;
  hb.shot += l.shot;
  hb.taken = Math.min(0.5, hb.taken + l.taken);
  hb.morale += l.morale;
  hb.luck += l.luck;
  hb.init1 += l.init1;
  hb.raise = Math.min(0.5, hb.raise + l.raise);
  if (l.orders) for (const k of Object.keys(hb.mul) as (keyof HeroBattle['mul'])[]) hb.mul[k] *= 1 + l.orders;
  if (l.cost) for (const k of Object.keys(hb.cost) as (keyof HeroBattle['cost'])[]) hb.cost[k] = Math.max(1, Math.round((hb.cost[k] ?? 1) * (1 - l.cost)));
  if (l.will) {
    hb.manaMax = Math.round(hb.manaMax * (1 + l.will));
    hb.mana = Math.max(0, Math.min(hb.manaMax, mana));
  }
  if (l.stam && hb.stamMax !== undefined) {
    const max = Math.round(hb.stamMax * (1 + l.stam));
    hb.stam = Math.max(0, Math.min(max, stam ?? max));
    hb.stamRegen = Math.max(1, Math.round((hb.stamRegen ?? 1) * (max / Math.max(1, hb.stamMax))));
    hb.stamMax = max;
  }
  if (l.innate && hb.innateMul !== undefined) hb.innateMul *= 1 + l.innate;
  return hb;
}

// ------------------------------------------------------------------ E3. trials of mastery

/** A legend's ship and the captain she fights, her army as it stood (her men stand again after a trial). */
interface Trial {
  account: number;
  skill: SkillId;
  army: ArmyStack[];
  morale: number;
  sanity: number;
  deaths: number;
  /** The voyage's dead and the crew's loyalty as they stood (the crew's second counts the trial's dead in as they
   *  fall: blunted steel, yet «too many dead this voyage» raised a mutiny after a lost trial). */
  lost: number;
  loyalty: number;
  hero: HeroBattle;
}
const trials = new WeakMap<ShipEntity, Trial>();
/** The trial her ship is in now (by account). */
const fightingNow = new Map<number, ShipEntity>();

/** The legend's hero beside the field (hero.ts heroInput): a captain of the cap on her path, with the skill at
 *  grandmaster and two more at expert, her primaries a little over the challenger's. */
export function trialHero(ship: ShipEntity): HeroBattle | null {
  return trials.get(ship)?.hero ?? null;
}
export function trialFace(ship: ShipEntity): string | undefined {
  const t = trials.get(ship);
  return t ? CAPTAINS[LEGENDS[t.skill].path].portrait.replace(/^portrait\./, '') : undefined;
}
export const isTrialShip = (ship: ShipEntity): boolean => trials.has(ship);

/** The legend of a skill as a hero, against a challenger with these primaries and skills (the sims use it too): her
 *  skills as the challenger's (none above expert), the trial's at grandmaster, and her own two at expert in what slots
 *  are left. */
export function legendHero(skill: SkillId, prim: Prims, theirs: readonly SkillSlot[] = []): HeroBattle {
  const lg = LEGENDS[skill];
  const skills: SkillSlot[] = [{ id: skill, r: GM_RANK }];
  for (const x of theirs) if (x.id !== skill) skills.push({ id: x.id, r: Math.min(SKILL_MAX, x.r) as SkillSlot['r'] });
  for (const id of lg.also) if (skills.length < SKILL_SLOTS && !skills.some((x) => x.id === id)) skills.push({ id, r: SKILL_MAX });
  const p: Prims = { atk: prim.atk + TRIAL_PRIM, def: prim.def + TRIAL_PRIM, pow: prim.pow + TRIAL_PRIM, will: prim.will + TRIAL_PRIM };
  return heroBattle(p, skills, null, startingOrders(lg.path), p.will * 10, { path: lg.path, level: MAX_LEVEL });
}
/** The legend's army: the challenger's, a share stronger in every stack. */
export function legendArmy(army: readonly ArmyStack[], skill: SkillId): ArmyStack[] {
  const k = Math.max(TRIAL_MEN, LEGENDS[skill].men);
  return army.filter((x) => x.n > 0).map((x) => ({ u: x.u, n: Math.max(1, Math.round(x.n * k)) }));
}

/** Why she cannot face a skill's legend now (null: she can). */
export function trialWhy(game: Game, s: PlayerSession, skill: string, force = false): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  if (!SKILLS[skill as SkillId]) return 'No such skill';
  const id = skill as SkillId;
  const h = heroOf(p);
  const t = throneOf(p);
  if (p.level < MAX_LEVEL) return `The trials open at level ${MAX_LEVEL}`;
  const r = h.skills.find((x) => x.id === id)?.r ?? 0;
  if (r >= GM_RANK) return 'You are a grandmaster of that skill already';
  if (r < SKILL_MAX) return 'The legend fights only an expert of her skill';
  const next = t.trials[id]?.next ?? 0;
  if (!force && next > game.now) return `The legend will fight you again in ${Math.ceil((next - game.now) / 60)} min`;
  if (ship.docked) return 'Put to sea first';
  if (ship.boarding || ship.grappled) return 'Not in the middle of a boarding';
  if (!force && ship.inCombat(game.now)) return 'Not while under fire';
  if (p.company.mutiny) return 'The crew holds the ship';
  if (fightingNow.has(s.accountId)) return 'A trial is under way';
  return null;
}

/** The legend comes alongside and grapples at once: the boarding battle of the trial. */
export function startTrial(game: Game, s: PlayerSession, skill: string, force = false): string | null {
  const why = trialWhy(game, s, skill, force);
  if (why) return why;
  const id = skill as SkillId;
  const p = s.profile!;
  const ship = s.ship!;
  const lg = LEGENDS[id];
  const t = throneOf(p);
  const rec = (t.trials[id] ??= { tries: 0 });
  rec.tries++;
  const side = tr(game).chance(0.5) ? 1 : -1;
  const v = headingVec(ship.state.heading + (side * Math.PI) / 2);
  const o = game.spawnNpcShip('hunter', ship.loadout.classId, 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading, { ship: lg.ship[0], captain: lg.name[0] });
  game.setNpcLevel(o, ship.shipLevel);
  o.setArmy(legendArmy(ship.army, id));
  o.god = true;
  o.morale = 85;
  o.purse = 0;
  o.input = { rudder: 0, sailTarget: 0 };
  o.state.speed = ship.state.speed = 0;
  const brain = game.npcs.get(o.id);
  if (brain) brain.active = true;
  game.grid.upsert(o.id, o.state.x, o.state.y);
  trials.set(o, { account: s.accountId, skill: id, army: ship.army.map((x) => ({ ...x })), morale: ship.morale, sanity: ship.sanity, deaths: ship.crewDeaths, lost: p.company.voyageLost, loyalty: p.company.loyalty, hero: legendHero(id, heroPrims(p), heroOf(p).skills) });
  fightingNow.set(s.accountId, o);
  game.sendTo(s, { t: 'toast', msg: `${lg.name[0]} comes alongside: the trial of ${SKILLS[id].name[0]} begins.`, kind: 'gold' });
  startBoarding(game, ship, o, 'standard');
  return null;
}

/** A skill raised to grandmaster: the trial won (or the tester's word). The first is a line in the chronicle. */
export function grantGrandmaster(game: Game, s: PlayerSession, id: SkillId): void {
  const p = s.profile!;
  const h = heroOf(p);
  const t = throneOf(p);
  const had = h.skills.find((x) => x.id === id);
  if (had) had.r = GM_RANK;
  else if (h.skills.length < SKILL_SLOTS) h.skills.push({ id, r: GM_RANK });
  else return;
  const rec = (t.trials[id] ??= { tries: 0 });
  const first = !rec.won;
  rec.won ??= game.wallNow();
  delete rec.next;
  applyHero(game, s);
  game.sendTo(s, { t: 'toast', msg: `Grandmaster of ${SKILLS[id].name[0]}!`, kind: 'gold' });
  if (first) chronicle(game, `${s.name} beat ${LEGENDS[id].name[0]} and became a grandmaster of ${SKILLS[id].name[0]}.`);
}

/** The trial's boarding over (boarding.ts finishBoarding, before any prize): her men stand again, the legend goes, the
 *  skill is hers or the legend waits three hours. True: it was a trial (no prize, no repulse). */
export function trialOver(game: Game, a: ShipEntity, b: ShipEntity, attackerWins: boolean): boolean {
  const legend = trials.has(b) ? b : trials.has(a) ? a : null;
  if (!legend) return false;
  const tri = trials.get(legend)!;
  const mine = legend === b ? a : b;
  const won = legend === b ? attackerWins : !attackerWins;
  trials.delete(legend);
  fightingNow.delete(tri.account);
  game.removeShip(legend.id);
  if (mine.alive) {
    // Blunted steel: her men stand again as they stood.
    mine.setArmy(tri.army);
    mine.morale = Math.max(mine.morale, tri.morale);
    mine.sanity = Math.max(mine.sanity, tri.sanity);
    mine.crewDeaths = tri.deaths;
    mine.state.speed = 0;
  }
  const s = game.sessionOf(mine);
  if (!s?.profile) return true;
  s.profile.company.voyageLost = Math.min(s.profile.company.voyageLost, tri.lost);
  s.profile.company.loyalty = Math.max(s.profile.company.loyalty, tri.loyalty);
  const t = throneOf(s.profile);
  const lg = LEGENDS[tri.skill];
  if (won) {
    game.toastShip(mine, `${lg.name[0]} strikes her colours to you. Her steel was blunted, and so was yours: your men stand again.`, 'gold');
    grantGrandmaster(game, s, tri.skill);
  } else {
    (t.trials[tri.skill] ??= { tries: 1 }).next = game.now + TRIAL_WAIT;
    game.toastShip(mine, `${lg.name[0]} holds her deck. Your men stand again; she will fight you once more in three hours.`, 'bad');
  }
  game.pushSelf(s, true);
  return true;
}

/** A trial whose captain is gone (logged off before the end): the legend goes too. */
export function stepTrials(game: Game): void {
  for (const [acc, ship] of fightingNow) {
    if (ship.alive && ship.boarding) continue; // a boarding ends by itself (a captain gone fights on by auto-battle)
    trials.delete(ship);
    fightingNow.delete(acc);
    if (ship.alive) game.removeShip(ship.id);
  }
}

// ------------------------------------------------------------------ what she sees

export function trialViews(now: number, p: Profile): TrialView[] {
  const h = heroOf(p);
  const t = throneOf(p);
  return SKILL_IDS.map((id) => {
    const rank = h.skills.find((x) => x.id === id)?.r ?? 0;
    const rec = t.trials[id];
    const wait = Math.max(0, Math.ceil((rec?.next ?? 0) - now));
    const state: TrialView['state'] = rank >= GM_RANK ? 'won' : rank < SKILL_MAX || p.level < MAX_LEVEL ? 'locked' : wait > 0 ? 'wait' : 'ready';
    return { skill: id, rank, state, ...(state === 'wait' ? { wait } : {}), tries: rec?.tries ?? 0 };
  });
}

export function gloryView(now: number, s: PlayerSession): GloryView | undefined {
  const p = s.profile;
  if (!p) return undefined;
  if (p.level < MAX_LEVEL - 5 && !p.throne) return undefined;
  const t = throneOf(p);
  const spent = masterySpent(t.nodes);
  const fight = fightingNow.get(s.accountId);
  const picks: Prims = { atk: t.picks.atk ?? 0, def: t.picks.def ?? 0, pow: t.picks.pow ?? 0, will: t.picks.will ?? 0 };
  return {
    open: p.level >= MAX_LEVEL, rank: t.rank, xp: Math.floor(t.xp), need: gloryXp(t.rank), picks, pending: gloryPending(t.rank, t.picks), points: masteryPoints(t.rank), spent, nodes: { ...t.nodes },
    trials: trialViews(now, p), reset: resetCost(spent), lift: liftOf(p), ...(fight && trials.get(fight) ? { fighting: trials.get(fight)!.skill } : {}),
  };
}

/** A captain's word to the Throne. */
export function throneMessage(game: Game, s: PlayerSession, msg: ThroneClientMsg): void {
  let why: string | null = null;
  switch (msg.action) {
    case 'glory':
      why = pickGlory(game, s, String(msg.id ?? ''));
      break;
    case 'node':
      why = learnMastery(game, s, String(msg.id ?? ''));
      break;
    case 'reset':
      why = resetMastery(game, s);
      break;
    case 'trial':
      why = startTrial(game, s, String(msg.id ?? ''));
      break;
    case 'view':
      break;
    default:
      why = 'No such order';
  }
  if (why) game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
  game.pushSelf(s, true);
}

// ------------------------------------------------------------------ the tester's console

/** `/glory`, `/mastery`, `/trial` (admin.ts). */
export function throneAdmin(game: Game, s: PlayerSession, cmd: string, args: string[]): string {
  const p = s.profile!;
  const t = throneOf(p);
  const lift = (): void => {
    if (p.level < MAX_LEVEL) {
      p.level = MAX_LEVEL;
      p.xp = 0;
      if (s.ship) s.ship.level = p.level;
      heroOf(p);
    }
  };
  switch (cmd) {
    case 'glory': {
      if (args[0] === 'xp') {
        lift();
        game.grantXp(s, Math.max(0, Number(args[1]) || gloryXp(t.rank)), null);
      } else if (args[0] === 'reset') {
        p.throne = undefined;
        throneOf(p);
      } else if (args[0] !== undefined) {
        const n = Math.max(0, Math.min(10000, Math.round(Number(args[0]))));
        if (!Number.isFinite(n)) return 'Usage: /glory [n|xp N|reset]';
        lift();
        t.rank = n;
        t.xp = 0;
        t.told = n;
        // Boons past the ranks go back.
        for (const k of PRIMS) t.picks[k] = Math.min(t.picks[k] ?? 0, GLORY_CAP);
        while (gloryPending(t.rank, t.picks) < 0 || PRIMS.reduce((x, k) => x + (t.picks[k] ?? 0), 0) > Math.min(n, 4 * GLORY_CAP)) {
          const k = PRIMS.find((x) => (t.picks[x] ?? 0) > 0);
          if (!k) break;
          t.picks[k]!--;
        }
      }
      applyHero(game, s);
      game.pushSelf(s, true);
      return `Glory ${t.rank} (${Math.floor(t.xp)}/${gloryXp(t.rank)}) · boons ${PRIMS.map((k) => t.picks[k] ?? 0).join('/')} · to choose ${gloryPending(t.rank, t.picks)} · mastery ${masterySpent(t.nodes)}/${masteryPoints(t.rank)}.`;
    }
    case 'mastery': {
      if (args[0] === 'reset') t.nodes = {};
      else if (args[0] === 'all') for (const n of MASTERY) t.nodes[n.id] = n.max;
      else if (args[0] && MASTERY_BY_ID[args[0]]) {
        // The tester's rank: past the points and the tiers.
        const n = MASTERY_BY_ID[args[0]];
        t.nodes[n.id] = Math.min(n.max, (t.nodes[n.id] ?? 0) + 1);
      } else if (args[0] && (BRANCHES as string[]).includes(args[0])) {
        for (const n of MASTERY) if (n.branch === args[0]) t.nodes[n.id] = n.max;
      } else if (args.length) return `Usage: /mastery [node|branch|all|reset] · ${MASTERY.map((n) => n.id).join(' ')}`;
      applyHero(game, s);
      game.pushSelf(s, true);
      return `Mastery: ${Object.entries(t.nodes).map(([id, r]) => `${id} ${r}`).join(', ') || 'none'} (${masterySpent(t.nodes)}/${masteryPoints(t.rank)}).`;
    }
    case 'trial': {
      const id = (args[0] && SKILLS[args[0] as SkillId] ? args[0] : heroOf(p).skills.find((x) => x.r === SKILL_MAX)?.id ?? heroOf(p).skills[0]?.id ?? 'boarding') as SkillId;
      const verb = args.find((x) => ['go', 'win', 'lose', 'reset'].includes(x));
      if (verb === 'reset') {
        t.trials = {};
        game.pushSelf(s, true);
        return 'Trials: none tried.';
      }
      if (verb === 'go' || verb === 'win') {
        lift();
        const h = heroOf(p);
        const had = h.skills.find((x) => x.id === id);
        if (had && had.r < SKILL_MAX) had.r = SKILL_MAX;
        else if (!had && h.skills.length < SKILL_SLOTS) h.skills.push({ id, r: SKILL_MAX });
        else if (!had) return 'All eight slots are taken.';
      }
      if (verb === 'win') {
        grantGrandmaster(game, s, id);
        game.pushSelf(s, true);
        return `Grandmaster of ${SKILLS[id].name[0]}.`;
      }
      if (verb === 'lose') {
        (t.trials[id] ??= { tries: 1 }).next = game.now + TRIAL_WAIT;
        game.pushSelf(s, true);
        return `The legend of ${SKILLS[id].name[0]} waits ${TRIAL_WAIT / 3600} h.`;
      }
      if (verb === 'go') {
        const h = heroOf(p);
        const had = h.skills.find((x) => x.id === id);
        if (had && had.r >= GM_RANK) had.r = SKILL_MAX;
        const why = startTrial(game, s, id, true);
        return why ?? `The trial of ${SKILLS[id].name[0]}: ${LEGENDS[id].name[0]} alongside.`;
      }
      return trialViews(game.now, p).map((v) => `${v.skill} ${v.state}${v.wait ? ` ${Math.ceil(v.wait / 60)}m` : ''}`).join(' · ');
    }
  }
  return 'Unknown command.';
}

/** The skills she would face a legend for now (the tests). */
export const readySkills = (game: Game, p: Profile): SkillId[] => trialViews(game.now, p).filter((v) => v.state === 'ready').map((v) => v.skill);
