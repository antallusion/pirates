// docs/19 E11 on the server: the Abyss of the Throne, the week's last raid at the Descent's Stair (descent.ts gateOf).
// A captain of the cap — with her group, five at the most — takes on the seven tiers of the Maw of the World. At the
// gate a tier's legend comes alongside and grapples at once (as a trial of mastery does: throne.ts startTrial), its
// hero and its army against hers in the boarding battle; won, the tier is taken and the next legend waits; lost, what
// she cut from its army stays cut — the next boarding of her raid meets what is left, all week. A tier taken pays
// everyone of the raid by the share of it each one cut down (those away from the sea when it falls are paid when they
// come back); the seventh, the Master of the Abyss, a relic to the one who cut most, and the chronicle.
//
// A captain's raid is the week's: the first boarding binds her to it (her group's, kept by its leader's account), so
// nobody walks from raid to raid for its spoils; one boarding of a raid at a time. The men she loses are hers to lose:
// no blunted steel here, and no prize either way. Every roll is on this system's own Rng.

import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import { ARTIFACTS, abyssPartChance } from '../../../shared/src/data/artifacts.ts';
import { RAID, RAID_GATE_R, RAID_GROUP, RAID_SPELL, RAID_TIERS, raidArmy, raidPay } from '../../../shared/src/data/abyssraid.ts';
import { citSpellHp } from '../../../shared/src/data/citadels.ts';
import type { RaidView } from '../../../shared/src/data/abyssraid.ts';
import { ORDER_IDS, SKILL_IDS, heroBattle, manaMaxOf, startingOrders } from '../../../shared/src/data/hero.ts';
import type { HeroBattle, OrderId, SkillSlot } from '../../../shared/src/data/hero.ts';
import { targetXp } from '../../../shared/src/data/xpcurve.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { parkNear } from './advmap.ts';
import { startBoarding } from './boarding.ts';
import { gateOf } from './descent.ts';
import { weekOf } from './empires.ts';
import type { Game } from './Game.ts';
import { artifactFind } from './hero.ts';
import { relicPartDrop } from './relics.ts'; // docs/19 E12
import { groupOfAccount } from './party.ts';
import type { PlayerSession } from './player.ts';
import { chronicle } from './renown.ts';
import type { ShipEntity } from './ship.ts';

const KEY = 'abyss_raid';

interface Raid {
  key: string;
  members: number[];
  names: Record<number, string>;
  /** The tier its legend waits at (RAID_TIERS + 1: the Master is down), and what is left of that legend's army. */
  tier: number;
  left: ArmyStack[];
  /** Hit points of each tier's army each captain cut down (a tier's index from 0). */
  dealt: Record<number, number[]>;
  cleared: number[];
  started: number;
  /** A boarding of this raid under way (the captain's account). */
  fighting?: number;
}

interface Owed {
  tier: number;
  silver: number;
  units: number;
  art?: 'relic' | 'major';
  /** docs/19 E12: a relic's part won on this tier (rolled as it was taken, given when she is aboard). */
  part?: boolean;
}

interface Store {
  week: number;
  raids: Record<string, Raid>;
  /** Each captain's raid this week. */
  of: Record<number, string>;
  owed: Record<number, Owed[]>;
  board: { names: string[]; tiers: number; at: number }[];
}

const rngs = new WeakMap<Game, Rng>();
function ar(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0xab7551d)));
  return r;
}

const stores = new WeakMap<Game, Store>();
function store(game: Game): Store {
  const week = weekOf(game.wallNow());
  let s = stores.get(game);
  if (!s) {
    s = game.db.getKv<Store>(KEY) ?? undefined;
    if (s) stores.set(game, s);
  }
  if (!s || s.week !== week) {
    // A new week: every raid begins again (what was owed is still owed).
    s = { week, raids: {}, of: {}, owed: s?.owed ?? {}, board: [] };
    stores.set(game, s);
    save(game);
  }
  return s;
}
const save = (game: Game) => game.db.setKv(KEY, stores.get(game)!);

/** The legends alongside now: whose raid, the tier, the captain, its army as it came aboard. */
const legends = new WeakMap<ShipEntity, { key: string; tier: number; acc: number; before: ArmyStack[] }>();
const heroes = new WeakMap<ShipEntity, { hero: HeroBattle; face: string }>();

// ------------------------------------------------------------------ the tiers' heroes

/** A tier's hero: her path's book and more by the tier (the Master the whole of it), primaries over the cap's, the
 *  skills of the sea at the tier's rank. */
export function raidHero(tier: number): HeroBattle {
  const t = RAID[Math.max(1, Math.min(RAID_TIERS, tier)) - 1];
  const p = 8 + t.prim;
  const prim = { atk: p, def: p, pow: p, will: p };
  const skills: SkillSlot[] = SKILL_IDS.filter((id) => id !== 'trading' && id !== 'navigation').slice(0, 3 + Math.floor(tier / 2)).map((id) => ({ id, r: t.rank }));
  const own = startingOrders(t.path);
  const book: OrderId[] = [...own, ...ORDER_IDS.filter((id) => !own.includes(id))].slice(0, Math.max(own.length, Math.ceil(ORDER_IDS.length * t.book)));
  return heroBattle(prim, skills, null, book, manaMaxOf(prim.will) * 2, { path: t.path, level: MAX_LEVEL });
}

/** A raid legend's orders as a captain's (tactical.ts sets it on her side): the ⚓10 crew's strength times her tier's
 *  RAID_SPELL — not her whole army's, which swept a deck with the first Musket Storm. */
export const raidSpellHp = (ship: ShipEntity): number | undefined => {
  const L = legends.get(ship);
  return L ? Math.round(citSpellHp(10) * (RAID_SPELL[L.tier - 1] ?? 1)) : undefined;
};

/** A legend of the raid alongside (throne.ts isTrialShip: no artifact on her, none of hers joins). */
export const isRaidLegend = (ship: ShipEntity): boolean => legends.has(ship);

/** The hero a legend of the raid brings aboard (hero.ts heroInput), and its face (heroFace). */
export const raidHeroOf = (ship: ShipEntity): HeroBattle | undefined => heroes.get(ship)?.hero;
export const raidFaceOf = (ship: ShipEntity): string | undefined => heroes.get(ship)?.face;

// ------------------------------------------------------------------ her raid

/** The raid a captain fights in this week: hers if bound, else her group's (its leader's), else her own new one. */
function raidOf(game: Game, acc: number, make: boolean): Raid | null {
  const S = store(game);
  const bound = S.of[acc];
  if (bound && S.raids[bound]) return S.raids[bound];
  const g = groupOfAccount(game, acc);
  const key = g ? (S.of[g.leader] ?? `g${g.leader}`) : `s${acc}`;
  const r = S.raids[key];
  if (r || !make) return r ?? null;
  return (S.raids[key] = { key, members: [], names: {}, tier: 1, left: raidArmy(1), dealt: {}, cleared: [], started: game.wallNow() });
}

const hpOf = (army: readonly ArmyStack[]): number => army.reduce((a, x) => a + x.n * (UNITS[x.u]?.hp ?? 0), 0);

/** Why she may not board the raid's legend now (null: she may). */
function whyNot(game: Game, s: PlayerSession, r: Raid | null): string | null {
  const p = s.profile, ship = s.ship;
  if (!p || p.level < MAX_LEVEL) return `The Abyss opens at level ${MAX_LEVEL}.`;
  if (!ship || !ship.alive || ship.docked) return 'Put to sea first.';
  if (ship.boarding || ship.grappled || ship.landing) return 'Not in the middle of a boarding';
  if (r && r.tier > RAID_TIERS) return 'The Master of the Abyss is down: the Maw opens again next week.';
  if (r?.fighting !== undefined && r.fighting !== s.accountId) return 'Another captain of your raid is aboard the legend now.';
  if (r && !r.members.includes(s.accountId) && r.members.length >= RAID_GROUP) return 'Five captains at the most in one raid.';
  const g = gateOf(game);
  if (dist(g.x, g.y, ship.state.x, ship.state.y) > RAID_GATE_R) return 'Come to the gate of the Stair: the Maw opens there.';
  if (ship.underFire(game.now)) return 'Not while under fire';
  return null;
}

/** Her raid's legend comes alongside at the gate and grapples at once. */
export function boardRaid(game: Game, s: PlayerSession): string | null {
  const why = whyNot(game, s, raidOf(game, s.accountId, false));
  if (why) return why;
  const S = store(game);
  const r = raidOf(game, s.accountId, true)!;
  if (!r.members.includes(s.accountId)) r.members.push(s.accountId);
  r.names[s.accountId] = s.name;
  S.of[s.accountId] = r.key;
  const ship = s.ship!;
  const t = RAID[r.tier - 1];
  const side = ar(game).chance(0.5) ? 1 : -1;
  const v = headingVec(ship.state.heading + (side * Math.PI) / 2);
  const o = game.spawnNpcShip('hunter', ship.loadout.classId, 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading, { ship: t.ship[0], captain: t.name[0] });
  game.setNpcLevel(o, 10);
  o.setArmy(r.left.map((x) => ({ ...x })));
  o.god = true;
  o.morale = 90;
  o.purse = 0;
  o.input = { rudder: 0, sailTarget: 0 };
  o.state.speed = ship.state.speed = 0;
  const brain = game.npcs.get(o.id);
  if (brain) brain.active = true;
  game.grid.upsert(o.id, o.state.x, o.state.y);
  legends.set(o, { key: r.key, tier: r.tier, acc: s.accountId, before: o.army.map((x) => ({ ...x })) });
  heroes.set(o, { hero: raidHero(r.tier), face: `portrait.${t.path}` });
  r.fighting = s.accountId;
  save(game);
  game.sendTo(s, { t: 'toast', msg: `${t.name[0]} comes up out of the Maw aboard the ${t.ship[0]}: tier ${r.tier} of the Abyss.`, kind: 'gold' });
  startBoarding(game, ship, o, 'standard');
  return null;
}

/** A boarding of the raid is over (boarding.ts finishBoarding): what she cut down, the tier taken or what is left of it.
 *  True when it was one (no prize, no repulse, nobody sent home). */
export function raidOver(game: Game, a: ShipEntity, b: ShipEntity, attackerWins: boolean): boolean {
  const legend = legends.has(b) ? b : legends.has(a) ? a : null;
  if (!legend) return false;
  const L = legends.get(legend)!;
  const mine = legend === b ? a : b;
  const won = legend === b ? attackerWins : !attackerWins;
  legends.delete(legend);
  heroes.delete(legend);
  const after = legend.army.filter((x) => x.n > 0).map((x) => ({ ...x }));
  game.removeShip(legend.id);
  const S = store(game);
  const r = S.raids[L.key];
  if (!r) return true;
  r.fighting = undefined;
  if (r.tier !== L.tier) {
    save(game);
    return true;
  }
  // What she cut down (the legend struck: all of it, its last men too).
  const cut = Math.max(0, hpOf(L.before) - (won ? 0 : hpOf(after)));
  const row = (r.dealt[L.acc] ??= Array(RAID_TIERS).fill(0));
  row[L.tier - 1] += cut;
  const s = game.sessionOf(mine);
  const name = RAID[L.tier - 1].name[0];
  if (won) takeTier(game, r, L.tier);
  else {
    r.left = after.length ? after : raidArmy(r.tier);
    const share = Math.round((1 - hpOf(r.left) / Math.max(1, hpOf(raidArmy(r.tier)))) * 100);
    if (s) game.toastShip(mine, `${name} holds the Maw. Your raid has cut ${share}% of the tier; what is left of it waits for the next boarding.`, 'bad');
  }
  if (mine.alive) mine.state.speed = 0;
  save(game);
  if (s) game.pushSelf(s, true);
  return true;
}

/** A tier taken: its pay shared by what each cut, the next legend raised, and the Master's fall told. */
function takeTier(game: Game, r: Raid, tier: number): void {
  const S = store(game);
  const pay = raidPay(tier);
  const cut = r.members.map((acc) => ({ acc, hp: r.dealt[acc]?.[tier - 1] ?? 0 })).filter((x) => x.hp > 0);
  const total = cut.reduce((a, x) => a + x.hp, 0) || 1;
  const top = cut.reduce((a, x) => (x.hp > a.hp ? x : a), cut[0] ?? { acc: -1, hp: 0 });
  for (const x of cut) {
    const share = x.hp / total;
    const o: Owed = { tier, silver: Math.round(pay.silver * share), units: pay.units * share };
    if (tier === RAID_TIERS) {
      if (x.acc === top.acc) o.art = 'relic';
      else if (ar(game).chance(Math.min(0.6, share * 2))) o.art = 'major';
    }
    // docs/19 E12: a relic's part by her share of the tier (the Master's top hand one for sure).
    if ((tier === RAID_TIERS && x.acc === top.acc) || ar(game).chance(abyssPartChance(tier, share))) o.part = true;
    (S.owed[x.acc] ??= []).push(o);
  }
  r.cleared.push(tier);
  r.tier = tier + 1;
  r.left = r.tier <= RAID_TIERS ? raidArmy(r.tier) : [];
  const names = r.members.map((acc) => r.names[acc]).filter(Boolean);
  if (r.tier > RAID_TIERS) {
    S.board.push({ names, tiers: RAID_TIERS, at: game.wallNow() });
    chronicle(game, `The Master of the Abyss falls to ${names.join(', ')}.`);
  }
  for (const acc of r.members) {
    const s = game.sessionByAccount(acc);
    if (s?.ship) game.toastShip(s.ship, `Tier ${tier} of the Abyss is taken: ${RAID[tier - 1].name[0]} is down.`, 'gold');
  }
  payOwed(game);
}

/** What the raids owe the captains on the sea now, paid. */
function payOwed(game: Game): void {
  const S = store(game);
  let any = false;
  for (const [k, list] of Object.entries(S.owed)) {
    const acc = Number(k);
    const s = game.sessionByAccount(acc);
    if (!s?.profile || !s.ship || !list.length) continue;
    for (const o of list) {
      s.profile.gold += o.silver;
      game.db.ledger(acc, 'abyss', o.silver, `tier ${o.tier}`);
      const xp = targetXp(s.profile.level, 10, o.units);
      if (xp > 0) game.grantXp(s, xp, `Tier ${o.tier} of the Abyss`, true);
      if (o.art === 'relic') {
        const relics = Object.values(ARTIFACTS).filter((a) => a.cls === 'relic').map((a) => a.id);
        artifactFind(game, s, 'boss', relics[ar(game).int(0, relics.length - 1)]);
      } else if (o.art === 'major') artifactFind(game, s, 'boss');
      if (o.part) relicPartDrop(game, s, 'abyss', 1);
      game.toastShip(s.ship, `Your share of tier ${o.tier} of the Abyss: ${o.silver} silver.`, 'gold');
    }
    delete S.owed[acc];
    any = true;
  }
  if (any) save(game);
}

/** Every few seconds: the owed paid to those who came back; a boarding whose captain is no longer aboard forgotten. */
export function stepAbyssRaid(game: Game): void {
  if (game.now % 5 > 0.06) return;
  const S = store(game);
  if (Object.keys(S.owed).length) payOwed(game);
  for (const r of Object.values(S.raids)) {
    if (r.fighting === undefined) continue;
    const s = game.sessionByAccount(r.fighting);
    if (!s?.ship?.boarding) r.fighting = undefined;
  }
}

// ------------------------------------------------------------------ the view

/** Her raid for the Throne's tab (undefined below the cap). */
export function raidView(game: Game, s: PlayerSession): RaidView | undefined {
  const p = s.profile;
  if (!p || p.level < MAX_LEVEL) return undefined;
  const S = store(game);
  const r = raidOf(game, s.accountId, false);
  const tier = r?.tier ?? 1;
  const left = r?.left ?? raidArmy(1);
  const g = gateOf(game);
  const d = s.ship ? Math.round(dist(g.x, g.y, s.ship.state.x, s.ship.state.y)) : 0;
  const full = tier <= RAID_TIERS ? hpOf(raidArmy(tier)) : 1;
  const members = (r?.members ?? []).map((acc) => ({ name: r!.names[acc] ?? '?', cut: (r!.dealt[acc] ?? []).reduce((a, x) => a + x, 0), ...(acc === s.accountId ? { you: true } : {}) }));
  return {
    week: S.week, tier, cleared: r?.cleared ?? [], left: left.map((x) => ({ u: x.u, n: x.n })), share: tier <= RAID_TIERS ? Math.round((hpOf(left) / full) * 100) : 0,
    gate: { x: Math.round(g.x), y: Math.round(g.y), d }, why: whyNot(game, s, r), members, board: S.board.slice(0, 10).map((b) => ({ names: b.names, tiers: b.tiers })),
    ...(r?.fighting !== undefined ? { fighting: r.names[r.fighting] ?? '' } : {}),
  };
}

// ------------------------------------------------------------------ the tester's command

/** `/maw [tier N|win|lose|go|reset|board]` (admin.ts): her raid's tier set, taken or worn down at once, the gate. */
export function adminMaw(game: Game, s: PlayerSession, args: string[]): string {
  if ((s.profile?.level ?? 0) < MAX_LEVEL) return `The Abyss opens at level ${MAX_LEVEL} (/level ${MAX_LEVEL}).`;
  const S = store(game);
  if (args[0] === 'go') {
    const g = gateOf(game);
    parkNear(game, s, g.x, g.y, 300);
    return 'At the gate of the Stair.';
  }
  if (args[0] === 'board') return S.board.map((b, i) => `${i + 1}. ${b.names.join(', ')}`).join(' · ') || 'Nobody has brought the Master down this week.';
  const r = raidOf(game, s.accountId, true)!;
  if (!r.members.includes(s.accountId)) r.members.push(s.accountId);
  r.names[s.accountId] = s.name;
  S.of[s.accountId] = r.key;
  switch (args[0]) {
    case undefined:
      break;
    case 'tier': {
      const n = Number(args[1]);
      if (!(n >= 1 && n <= RAID_TIERS)) return `Usage: /maw tier 1-${RAID_TIERS}`;
      r.tier = n;
      r.left = raidArmy(n);
      break;
    }
    case 'win':
      if (r.tier > RAID_TIERS) break;
      (r.dealt[s.accountId] ??= Array(RAID_TIERS).fill(0))[r.tier - 1] += hpOf(r.left);
      takeTier(game, r, r.tier);
      break;
    case 'lose':
      if (r.tier > RAID_TIERS) break;
      r.left = r.left.map((x) => ({ ...x, n: Math.max(1, Math.round(x.n / 2)) }));
      break;
    case 'reset':
      delete S.raids[r.key];
      for (const acc of r.members) delete S.of[acc];
      save(game);
      return 'The raid begins again.';
    default:
      return 'Usage: /maw [tier N|win|lose|go|reset|board]';
  }
  save(game);
  return r.tier > RAID_TIERS ? 'The Master of the Abyss is down.' : `Tier ${r.tier}: ${RAID[r.tier - 1].name[0]}, ${Math.round((hpOf(r.left) / hpOf(raidArmy(r.tier))) * 100)}% of its army.`;
}
