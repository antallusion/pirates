// docs/19 E15 on the server: the Admiralty's contracts (shared/src/data/admiralty.ts — the week's three, their words and
// their pay). Here:
//  - the board: a captain of the cap takes a contract at an Admiralty board (a great harbour's), into her journal as a
//    quest of its own (quests.ts carries its steps; the three stand beside the five quests she may hold);
//  - the legend: within its mark a contract-holder's call brings the rogue legend's ship alongside, grappled at once
//    (as the Abyss's legends: abyssraid.ts) — her army and hero a tier of the Abyss's, on the legend's own path; what the
//    captain cuts stays cut for her next boarding all week; struck, the contract is hers and her groupmates' in company
//    who hold it too. Real steel: her men are hers to lose, and no prize either way;
//  - the hooks the endgame calls: a seal's depth won in time (seals.ts), the citadels' watches — an hour of her men in
//    her guild's garrison, an assault, a citadel taken, a siege held (citadels.ts) — kept by account for the week, so a
//    captain away from the sea when her men stand guard still has her watches;
//  - the cargo run: the Admiralty's bands of raiders at her level, three on the way while the cargo is aboard;
//  - the pay (quests.ts completeQuest): silver, glory (experience past the cap), a chance at a relic's part;
//  - the week: a contract lapses with it; the tester may turn it (`/contract week`).
// Every roll here is on this system's own Rng.

import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { RAID, raidArmy } from '../../../shared/src/data/abyssraid.ts';
import {
  ADM_BAND_SHIPS, ADM_GARRISON_MEN, ADM_KIND_NAMES, ADM_LEGEND_R, ADM_WATCH, admWeekEnd, admWeekOf, admiraltyPorts, admiraltyWeek, isAdmId, isAdmiraltyPort,
} from '../../../shared/src/data/admiralty.ts';
import type { AdmContract, AdmRow, AdmView } from '../../../shared/src/data/admiralty.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { citWeek } from '../../../shared/src/data/citadels.ts';
import type { CitView } from '../../../shared/src/data/citadels.ts';
import { ORDER_IDS, SKILL_IDS, heroBattle, manaMaxOf, startingOrders } from '../../../shared/src/data/hero.ts';
import type { HeroBattle, OrderId, SkillSlot } from '../../../shared/src/data/hero.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import type { QuestDef } from '../../../shared/src/data/quests.ts';
import type { SealView } from '../../../shared/src/data/seals.ts';
import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import { LEGENDS } from '../../../shared/src/data/throne.ts';
import { dist, headingOf, headingVec } from '../../../shared/src/math.ts';
import { Rng, hashString } from '../../../shared/src/rng.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { parkNear } from './advmap.ts';
import { startBoarding } from './boarding.ts';
import type { Game } from './Game.ts';
import { openSea, planWander } from './npc.ts';
import { CONVOY_RANGE, groupOfAccount } from './party.ts';
import type { PlayerSession } from './player.ts';
import { completeQuest, questEvent, stepProgress } from './quests.ts';
import type { QuestState } from './quests.ts';
import { relicPartDrop } from './relics.ts';
import { chronicle } from './renown.ts';
import type { ShipEntity } from './ship.ts';

const KEY = 'admiralty';

interface Store {
  v: 1;
  /** Weeks the tester has turned ahead of the calendar. */
  shift: number;
  week: number;
  /** Each captain's watches on the citadels' walls this week (by account). */
  watch: Record<string, number>;
  /** What is left of each hunt's legend this week: a captain's own (`s<account>`) or her group's (`g<leader>`). */
  legend: Record<string, ArmyStack[]>;
  /** The captains who have boarded each hunt's legend this week (her warrant is theirs when she strikes). */
  who: Record<string, number[]>;
  /** The places on the board each captain has fulfilled this week (by account). */
  done: Record<string, number[]>;
}

const rngs = new WeakMap<Game, Rng>();
function ar(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0xad31a1)));
  return r;
}

const stores = new WeakMap<Game, Store>();
function store(game: Game): Store {
  let s = stores.get(game);
  if (!s) {
    const kept = game.db.getKv<Store>(KEY);
    s = kept && kept.v === 1 ? kept : { v: 1, shift: 0, week: -1, watch: {}, legend: {}, who: {}, done: {} };
    s.watch ??= {};
    s.legend ??= {};
    s.who ??= {};
    s.done ??= {};
    s.shift = Math.max(0, Math.floor(s.shift || 0));
    stores.set(game, s);
  }
  const week = citWeek(game.wallNow()) + s.shift;
  if (s.week !== week) {
    // A new week: the watches, the legends and the board begin again.
    s.week = week;
    s.watch = {};
    s.legend = {};
    s.who = {};
    s.done = {};
    save(game);
  }
  return s;
}
const save = (game: Game) => game.db.setKv(KEY, stores.get(game)!);

/** The Admiralty's week now (the citadels' calendar, and the weeks the tester has turned). */
export const admWeek = (game: Game): number => store(game).week;
/** This week's three. */
export const contractsNow = (game: Game): AdmContract[] => admiraltyWeek(admWeek(game), game.world);
const contractOf = (game: Game, id: string): AdmContract | undefined => contractsNow(game).find((c) => c.id === id);

const hpOf = (army: readonly ArmyStack[]): number => army.reduce((a, x) => a + x.n * (UNITS[x.u]?.hp ?? 0), 0);

// ------------------------------------------------------------------ the board

/** Why she may not take a contract here and now (null: she may). `admin`: the tester's, anywhere. */
export function takeWhy(game: Game, s: PlayerSession, c: AdmContract | undefined, admin = false): string | null {
  const p = s.profile;
  if (!p) return 'Not now';
  if (!c) return 'No such contract this week.';
  if (p.level < MAX_LEVEL) return `The Admiralty gives its contracts to captains of level ${MAX_LEVEL}.`;
  if (p.quests.active.some((a) => a.id === c.id)) return 'You have that contract already.';
  if (p.quests.done.includes(c.id)) return 'That contract is done this week.';
  if (!admin && !isAdmiraltyPort(s.ship?.docked ? game.portById(s.ship.docked) : null)) return 'Contracts are taken at an Admiralty board, in a great harbour.';
  return null;
}

/** She takes a contract of the week into her journal. */
export function takeContract(game: Game, s: PlayerSession, id: string, admin = false): string | null {
  const c = contractOf(game, id);
  const why = takeWhy(game, s, c, admin);
  if (why || !c) return why ?? 'Not now';
  const p = s.profile!;
  const qs: QuestState = { id: c.id, step: 0, progress: 0, startedAt: game.now };
  if (c.kind === 'citadel') qs.base = store(game).watch[s.accountId] ?? 0;
  // (its raiders are the Admiralty's bands, below — not a courier's one: quests.ts cargoAmbush)
  if (c.kind === 'delivery') qs.ambushed = true;
  p.quests.active.push(qs);
  game.sendTo(s, { t: 'toast', msg: `The Admiralty’s contract is yours: ${c.quest.name}.`, kind: 'gold' });
  // At the depot already: the cargo comes aboard at once.
  const port = s.ship?.docked ? game.portById(s.ship.docked) : undefined;
  if (port) questEvent(game, s, { k: 'dock', port });
  game.pushSelf(s, true);
  return null;
}

/** A contract fulfilled (quests.ts completeQuest): the Admiralty's pay — silver, glory, a chance at a relic's part. */
export function contractDone(game: Game, s: PlayerSession, q: QuestDef): void {
  const p = s.profile!;
  const c = admiraltyWeek(admWeekOf(q.id), game.world).find((x) => x.id === q.id);
  const pay = c?.pay ?? { silver: q.reward.silver, glory: q.reward.xp, part: 0.3 };
  p.gold += pay.silver;
  game.db.ledger(s.accountId, 'contract', pay.silver, q.id);
  game.grantXp(s, pay.glory, null);
  const S = store(game);
  const done = (S.done[s.accountId] ??= []);
  if (c && !done.includes(c.n)) done.push(c.n);
  save(game);
  game.sendTo(s, { t: 'quest_done', name: q.name, silver: pay.silver, xp: pay.glory });
  game.sendTo(s, { t: 'toast', msg: `Contract fulfilled: ${q.name}. The Admiralty pays ${pay.silver} silver and ${pay.glory} glory.`, kind: 'gold' });
  relicPartDrop(game, s, 'contract', pay.part); // docs/19 E12: a relic's part, a chance by the contract's hours
  if (c && done.length >= contractsNow(game).length && c.week === S.week) chronicle(game, `${s.name} fulfils all three of the Admiralty’s contracts this week.`);
  game.pushSelf(s, true);
}

// ------------------------------------------------------------------ the hooks of the endgame

/** docs/19 E9 (seals.ts endDepth): a mythic depth of seal `lv` won within its rounds. */
export function contractSeal(game: Game, s: PlayerSession, lv: number): void {
  questEvent(game, s, { k: 'seal', lv });
}

/** docs/19 E4–E8 (citadels.ts): a captain's watch on the citadels' walls — an assault made, a citadel taken by her
 *  assault, a siege held with her men in the garrison (kept by account: she may be away from the sea). */
export function contractCitadel(game: Game, acc: number, how: 'assault' | 'take' | 'hold'): void {
  const S = store(game);
  S.watch[acc] = (S.watch[acc] ?? 0) + ADM_WATCH[how];
  save(game);
}

/** docs/19 E6 (citadels.ts, the hours of holding): `n` hours of the men each captain left in her guild's garrison —
 *  a watch an hour for those with `ADM_GARRISON_MEN` there at least. */
export function contractGarrison(game: Game, left: Record<string, { men: number }>, n: number): void {
  const S = store(game);
  let any = false;
  for (const [acc, x] of Object.entries(left)) {
    if (x.men < ADM_GARRISON_MEN) continue;
    S.watch[acc] = (S.watch[acc] ?? 0) + ADM_WATCH.hour * n;
    any = true;
  }
  if (any) save(game);
}

// ------------------------------------------------------------------ the legend

/** The rogue legend's hero: a tier of the Abyss's (her primaries, her skills' rank, her share of the book) on her own
 *  path (abyssraid.ts raidHero, the path the legend's). */
export function legendHero(tier: number, path: CaptainId): HeroBattle {
  const t = RAID[Math.max(1, Math.min(RAID.length, tier)) - 1];
  const p = 8 + t.prim;
  const prim = { atk: p, def: p, pow: p, will: p };
  const skills: SkillSlot[] = SKILL_IDS.filter((id) => id !== 'trading' && id !== 'navigation').slice(0, 3 + Math.floor(tier / 2)).map((id) => ({ id, r: t.rank }));
  const own = startingOrders(path);
  const book: OrderId[] = [...own, ...ORDER_IDS.filter((id) => !own.includes(id))].slice(0, Math.max(own.length, Math.ceil(ORDER_IDS.length * t.book)));
  return heroBattle(prim, skills, null, book, manaMaxOf(prim.will) * 2, { path, level: MAX_LEVEL });
}

/** A captain's hunt of the legend: her group's (the group wears the same legend down, as the Abyss's raid does), or her
 *  own. */
const huntOf = (game: Game, acc: number): string => {
  const g = groupOfAccount(game, acc);
  return g ? `g${g.leader}` : `s${acc}`;
};

/** The legends alongside now: whose hunt and contract, who boarded, the army she came aboard with; heroes and faces. */
const legends = new WeakMap<ShipEntity, { acc: number; hunt: string; id: string; tier: number; before: ArmyStack[] }>();
const heroes = new WeakMap<ShipEntity, { hero: HeroBattle; face: string }>();
/** One boarding of a hunt at a time: hunt → the legend alongside. */
const boardings = new WeakMap<Game, Map<string, ShipEntity>>();
function fightingOf(game: Game): Map<string, ShipEntity> {
  let m = boardings.get(game);
  if (!m) boardings.set(game, (m = new Map()));
  for (const [k, ship] of m) if (!ship.alive || !legends.has(ship)) m.delete(k);
  return m;
}

/** A contract's legend alongside (throne.ts isTrialShip: no artifact on her, none of hers joins). */
export const isContractLegend = (ship: ShipEntity): boolean => legends.has(ship);
/** The hero she brings aboard (hero.ts heroInput), and her face (heroFace). */
export const contractHeroOf = (ship: ShipEntity): HeroBattle | undefined => heroes.get(ship)?.hero;
export const contractFaceOf = (ship: ShipEntity): string | undefined => heroes.get(ship)?.face;

/** What is left of her hunt's legend this week (the whole of its tier's army when nobody has boarded it yet). */
function legendLeft(game: Game, hunt: string, c: AdmContract): ArmyStack[] {
  const left = store(game).legend[hunt];
  return left?.length ? left.map((x) => ({ ...x })) : raidArmy(c.legend!.tier);
}

/** Why the legend will not come alongside now (null: she will). */
export function legendWhy(game: Game, s: PlayerSession, c: AdmContract | undefined): string | null {
  const p = s.profile, ship = s.ship;
  if (!p || p.level < MAX_LEVEL) return `The Admiralty gives its contracts to captains of level ${MAX_LEVEL}.`;
  if (!c?.legend) return 'No such contract this week.';
  if (!p.quests.active.some((a) => a.id === c.id)) return 'Take the Admiralty’s contract first.';
  if (!ship || !ship.alive || ship.docked) return 'Put to sea first.';
  if (ship.boarding || ship.grappled || ship.landing) return 'Not in the middle of a boarding';
  if (fightingOf(game).has(huntOf(game, s.accountId))) return 'The legend is boarded already.';
  if (dist(c.legend.x, c.legend.y, ship.state.x, ship.state.y) > ADM_LEGEND_R) return 'Bring your ship to the gold mark: the legend sails there.';
  if (ship.underFire(game.now)) return 'Not while under fire';
  if (p.company.mutiny) return 'The crew holds the ship';
  return null;
}

/** The legend comes about to meet her and grapples at once: the boarding battle. */
export function boardLegend(game: Game, s: PlayerSession, id: string): string | null {
  const c = contractOf(game, id);
  const why = legendWhy(game, s, c);
  if (why || !c?.legend) return why ?? 'Not now';
  const lg = LEGENDS[c.legend.skill];
  const ship = s.ship!;
  const side = ar(game).chance(0.5) ? 1 : -1;
  const v = headingVec(ship.state.heading + (side * Math.PI) / 2);
  const o = game.spawnNpcShip('hunter', ship.loadout.classId, 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading, { ship: lg.ship[0], captain: lg.name[0] });
  game.setNpcLevel(o, 10);
  const hunt = huntOf(game, s.accountId);
  o.setArmy(legendLeft(game, hunt, c));
  o.god = true;
  o.morale = 90;
  o.purse = 0;
  o.input = { rudder: 0, sailTarget: 0 };
  o.state.speed = ship.state.speed = 0;
  const brain = game.npcs.get(o.id);
  if (brain) brain.active = true;
  game.grid.upsert(o.id, o.state.x, o.state.y);
  legends.set(o, { acc: s.accountId, hunt, id: c.id, tier: c.legend.tier, before: o.army.map((x) => ({ ...x })) });
  heroes.set(o, { hero: legendHero(c.legend.tier, lg.path), face: CAPTAINS[lg.path].portrait.replace(/^portrait\./, '') });
  fightingOf(game).set(hunt, o);
  const S = store(game);
  const who = (S.who[hunt] ??= []);
  if (!who.includes(s.accountId)) who.push(s.accountId);
  save(game);
  game.sendTo(s, { t: 'toast', msg: `${lg.name[0]} comes about to meet you aboard the ${lg.ship[0]}: the Admiralty’s warrant is served.`, kind: 'gold' });
  startBoarding(game, ship, o, 'standard');
  return null;
}

/** A boarding of a contract's legend is over (boarding.ts finishBoarding): struck — the contract is hers, and theirs
 *  who hold it and boarded this legend with her or lie in company; held — what she cut stays cut for her hunt. True
 *  when it was one (no prize, no repulse). */
export function contractOver(game: Game, a: ShipEntity, b: ShipEntity, attackerWins: boolean): boolean {
  const legend = legends.has(b) ? b : legends.has(a) ? a : null;
  if (!legend) return false;
  const L = legends.get(legend)!;
  const mine = legend === b ? a : b;
  const won = legend === b ? attackerWins : !attackerWins;
  legends.delete(legend);
  heroes.delete(legend);
  boardings.get(game)?.delete(L.hunt);
  const after = legend.army.filter((x) => x.n > 0).map((x) => ({ ...x }));
  const shipName = legend.name;
  game.removeShip(legend.id);
  if (mine.alive) mine.state.speed = 0;
  const S = store(game);
  const s = game.sessionOf(mine);
  if (won) {
    const boarded = S.who[L.hunt] ?? [];
    delete S.legend[L.hunt];
    delete S.who[L.hunt];
    save(game);
    if (s) {
      game.toastShip(mine, `The ${shipName} strikes her colours: the Admiralty’s warrant is served.`, 'gold');
      questEvent(game, s, { k: 'legend' });
      // Her groupmates who hold the same warrant and boarded this legend, or lie in company: theirs is served too.
      const g = groupOfAccount(game, s.accountId);
      for (const acc of new Set([...(g?.members ?? []), ...boarded])) {
        if (acc === s.accountId) continue;
        const m = game.sessionByAccount(acc);
        if (!m?.ship || !m.profile?.quests.active.some((x) => x.id === L.id)) continue;
        if (!boarded.includes(acc) && (!m.ship.alive || dist(m.ship.state.x, m.ship.state.y, mine.state.x, mine.state.y) > CONVOY_RANGE)) continue;
        game.toastShip(m.ship, `The ${shipName} struck to ${s.name}: your warrant is served too.`, 'gold');
        questEvent(game, m, { k: 'legend' });
      }
      game.pushSelf(s, true);
    }
    return true;
  }
  const whole = raidArmy(L.tier);
  S.legend[L.hunt] = after.length ? after : whole;
  save(game);
  if (s) {
    const cut = Math.round((1 - hpOf(S.legend[L.hunt]) / Math.max(1, hpOf(whole))) * 100);
    game.toastShip(mine, `The ${shipName} holds her deck. You have cut ${cut}% of her army; what is left of it waits for your next boarding.`, 'bad');
    game.pushSelf(s, true);
  }
  return true;
}

// ------------------------------------------------------------------ every second

/** The Admiralty's bands of raiders on a cargo run: when the next comes and how many have. */
const runs = new WeakMap<Game, Map<string, { next: number; made: number }>>();

/** A band of raiders put out after her cargo: of her level, a little beyond her sight, hunting her ten minutes. */
function spawnBand(game: Game, prey: ShipEntity, acc: number): number {
  const rng = ar(game);
  const lv = Math.max(1, Math.min(10, prey.combatLevel));
  let made = 0;
  for (let i = 0; i < ADM_BAND_SHIPS * 4 && made < ADM_BAND_SHIPS; i++) {
    const a = rng.float() * Math.PI * 2;
    const x = prey.state.x + Math.sin(a) * 2400, y = prey.state.y - Math.cos(a) * 2400;
    if (!openSea(game, x, y) || !game.inZone(x, y)) continue;
    const ship = game.spawnNpcShip('pirate', rng.pick(hullsFor('pirate', lv)), 'confederacy', x, y, headingOf(prey.state.x - x, prey.state.y - y));
    game.setNpcLevel(ship, lv);
    const brain = game.npcs.get(ship.id)!;
    brain.huntAccount = acc;
    brain.area = { x: prey.state.x, y: prey.state.y, r: 6000 };
    brain.expiresAt = game.now + 600;
    planWander(game, ship, brain);
    made++;
  }
  return made;
}

function cargoBands(game: Game, s: PlayerSession, qs: QuestState, c: AdmContract): void {
  const ship = s.ship!;
  if (ship.docked || REGIONS[ship.region].safety === 'safe') return;
  let map = runs.get(game);
  if (!map) runs.set(game, (map = new Map()));
  const key = `${s.accountId}:${qs.id}`;
  let r = map.get(key);
  if (!r) {
    map.set(key, (r = { next: game.now + 60 + (hashString(key) % 60), made: 0 }));
    return;
  }
  if (r.made >= (c.delivery?.bands ?? 0) || game.now < r.next) return;
  if (spawnBand(game, ship, s.accountId) <= 0) {
    r.next = game.now + 20;
    return;
  }
  r.made++;
  r.next = game.now + 240 + ar(game).int(0, 120);
  game.sendTo(s, { t: 'toast', msg: 'Raiders close in: they have word of the Admiralty’s cargo.', kind: 'bad' });
}

/** Every second for a captain with contracts: a contract of a week gone lapses; her watches on the walls counted in;
 *  the raiders sent after her cargo. */
export function stepContracts(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p || !s.ship || !p.quests.active.some((a) => isAdmId(a.id))) return;
  const S = store(game);
  for (const qs of [...p.quests.active]) {
    if (!isAdmId(qs.id)) continue;
    const q = QUESTS_BY_ID[qs.id];
    if (!q || admWeekOf(qs.id) !== S.week) {
      p.quests.active = p.quests.active.filter((a) => a.id !== qs.id);
      runs.get(game)?.delete(`${s.accountId}:${qs.id}`);
      game.sendTo(s, { t: 'toast', msg: `The week is out: the Admiralty’s contract ${q?.name ?? qs.id} has lapsed.`, kind: 'info' });
      continue;
    }
    const st = q.steps[qs.step];
    if (st?.type === 'citadel') {
      const have = Math.min(st.count, (S.watch[s.accountId] ?? 0) - (qs.base ?? 0));
      if (have > qs.progress) questEvent(game, s, { k: 'citadel', n: have - qs.progress });
    } else if (st?.type === 'deliver') {
      const c = contractOf(game, qs.id);
      if (c) cargoBands(game, s, qs, c);
    }
  }
}

// ------------------------------------------------------------------ what she sees

/** Where a contract's course leads her now. */
function targetOf(game: Game, c: AdmContract, qs: QuestState | undefined, cit?: CitView, seal?: SealView): { x: number; y: number } | null {
  if (c.legend) return { x: c.legend.x, y: c.legend.y };
  if (c.delivery) {
    const port = game.portById(qs && qs.step >= 1 ? c.delivery.to : c.delivery.from);
    return port ? { x: port.x, y: port.y } : null;
  }
  if (c.seal) return seal?.near ? { x: seal.near.x, y: seal.near.y } : null;
  const rows = cit?.rows ?? [];
  const best = [...rows].sort((a, b) => Number(!!b.mine || !!b.siegeOf?.mine) - Number(!!a.mine || !!a.siegeOf?.mine) || a.d - b.d)[0];
  return best ? { x: best.x, y: best.y } : null;
}

/** The pointer of a contract's step on the charts (Game.questTargets): the legend's mark. */
export function contractPointer(game: Game, id: string): { x: number; y: number; r: number } | null {
  const c = admiraltyWeek(admWeekOf(id), game.world).find((x) => x.id === id);
  return c?.legend ? { x: c.legend.x, y: c.legend.y, r: ADM_LEGEND_R } : null;
}

/** The week's three as the Throne's tab and the board show them (from five levels short of the cap). */
export function admView(game: Game, s: PlayerSession, cit?: CitView, seal?: SealView): AdmView | undefined {
  const p = s.profile;
  if (!p || p.level < MAX_LEVEL - 5) return undefined;
  const S = store(game);
  const ship = s.ship;
  const port = ship?.docked ? game.portById(ship.docked) : undefined;
  const rows: AdmRow[] = contractsNow(game).map((c) => {
    const qs = p.quests.active.find((a) => a.id === c.id);
    const state: AdmRow['state'] = p.quests.done.includes(c.id) ? 'done' : qs ? 'taken' : 'open';
    const pr = qs ? stepProgress(qs) : null;
    const first = c.quest.steps[0];
    const need = pr?.need ?? ('count' in first ? first.count : 1);
    const at = state === 'done' ? null : targetOf(game, c, qs, cit, seal);
    const row: AdmRow = {
      id: c.id, n: c.n, kind: c.kind, name: c.quest.name, mentor: c.quest.mentor, summary: c.quest.summary, ...(c.quest.portrait ? { portrait: c.quest.portrait } : {}),
      steps: c.quest.steps.map((x) => x.text), state, step: qs ? qs.step : state === 'done' ? c.quest.steps.length : 0, progress: pr?.progress ?? (state === 'done' ? need : 0), need,
      hours: c.hours, pay: c.pay, why: state === 'open' ? takeWhy(game, s, c) : null,
      ...(at && ship ? { at: { x: Math.round(at.x), y: Math.round(at.y), d: Math.round(dist(at.x, at.y, ship.state.x, ship.state.y)) } } : {}),
    };
    if (c.legend) {
      const lg = LEGENDS[c.legend.skill];
      const hunt = huntOf(game, s.accountId);
      const left = legendLeft(game, hunt, c);
      row.legend = {
        skill: c.legend.skill, name: lg.name[0], ship: lg.ship[0], path: lg.path, tier: c.legend.tier, left, share: Math.round((hpOf(left) / Math.max(1, hpOf(raidArmy(c.legend.tier)))) * 100),
        why: state === 'taken' ? legendWhy(game, s, c) : null, ...(fightingOf(game).has(hunt) ? { fighting: true } : {}),
      };
    }
    if (c.seal) row.seal = { ...c.seal, mine: p.seal?.lv ?? 0 };
    if (c.delivery) row.delivery = { ...c.delivery };
    return row;
  });
  return {
    week: S.week, endsIn: Math.max(0, Math.round((admWeekEnd(S.week - S.shift) - game.wallNow()) / 1000)), board: isAdmiraltyPort(port), ports: admiraltyPorts(game.world).map((x) => x.id), rows,
    done: rows.filter((r) => r.state === 'done').length,
  };
}

/** A captain's word in the Throne's tab or at the board (throne.ts throneMessage). */
export function contractMessage(game: Game, s: PlayerSession, op: string | undefined, id: string): string | null {
  if (op === 'take') return takeContract(game, s, id);
  if (op === 'board') return boardLegend(game, s, id);
  return 'No such order';
}

// ------------------------------------------------------------------ the tester's command

/** `/contract [list|take N|done N|week|reset|go N]` (admin.ts). */
export function adminContract(game: Game, s: PlayerSession, args: string[]): string {
  const p = s.profile!;
  const S = store(game);
  const list = contractsNow(game);
  const pick = (): AdmContract | undefined => list[Math.max(1, Math.floor(Number(args[1]) || 1)) - 1];
  // (each contract a sentence of its own, its words whole for the Russian table: the kind's name, its state)
  const say = (): string => `Admiralty week ${S.week}, ${Math.ceil(Math.max(0, admWeekEnd(S.week - S.shift) - game.wallNow()) / 3_600_000)} h left.${list.map((c, i) => {
    const qs = p.quests.active.find((a) => a.id === c.id);
    const st = p.quests.done.includes(c.id) ? 'done' : qs ? `taken ${stepProgress(qs)?.progress ?? 0}/${stepProgress(qs)?.need ?? 1}` : 'open';
    return ` ${i + 1}: ${ADM_KIND_NAMES[c.kind][0]}, ${c.pay.silver} silver, ${c.pay.glory} glory — ${st}.`;
  }).join('')}`;
  const lift = (): void => {
    if (p.level >= MAX_LEVEL) return;
    p.level = MAX_LEVEL;
    p.xp = 0;
    if (s.ship) s.ship.level = p.level;
  };
  switch (args[0]) {
    case undefined:
    case 'list':
      return say();
    case 'take': {
      const c = pick();
      if (!c) return 'Usage: /contract take 1-3';
      lift();
      return takeContract(game, s, c.id, true) ?? `Taken: ${c.quest.name}.`;
    }
    case 'done': {
      const c = pick();
      if (!c) return 'Usage: /contract done 1-3';
      lift();
      if (p.quests.done.includes(c.id)) return 'That contract is done this week.';
      if (!p.quests.active.some((a) => a.id === c.id)) {
        const e = takeContract(game, s, c.id, true);
        if (e) return e;
      }
      // (the delivery's cargo, if it was taken on, stays aboard: the tester's)
      completeQuest(game, s, c.quest);
      return `Fulfilled: ${c.quest.name}.`;
    }
    case 'week':
      S.shift++;
      store(game);
      stepContracts(game, s);
      game.pushSelf(s, true);
      return say();
    case 'reset':
      p.quests.active = p.quests.active.filter((a) => !isAdmId(a.id));
      p.quests.done = p.quests.done.filter((id) => !isAdmId(id));
      delete S.watch[s.accountId];
      delete S.legend[huntOf(game, s.accountId)];
      delete S.who[huntOf(game, s.accountId)];
      delete S.done[s.accountId];
      save(game);
      game.pushSelf(s, true);
      return 'Your Admiralty contracts are forgotten.';
    case 'go': {
      const c = pick();
      if (!c) return 'Usage: /contract go 1-3';
      const qs = p.quests.active.find((a) => a.id === c.id);
      const at = targetOf(game, c, qs);
      if (!at) return 'Nowhere to sail for it.';
      parkNear(game, s, at.x, at.y, c.legend ? 300 : 700);
      return `Off the mark of ${c.quest.name}.`;
    }
    default:
      return 'Usage: /contract [list|take N|done N|week|reset|go N]';
  }
}
