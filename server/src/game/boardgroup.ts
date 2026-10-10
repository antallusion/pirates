// docs/25 block Е on the server (items 64–67, owner 2026-10-09: «Абордаж должен быть интересный, чтобы капитанские
// навыки, группа и умения решали … делай все пункты»): a group's boarding.
//  - 64: the mates of a captain's group within TAC_GROUP.range of the grapple — at sea, alive, in no other fight — come
//    aboard her side with the grapples (or, asked, as a round opens up to round TAC_GROUP.late): each brings one or two
//    stacks of her own army (her choice, else her strongest), plays them herself on her own chess clock and gives her
//    own orders from her own book, once a round. Her ship lies to beside the fight while it lasts. The captain on the
//    other side of a boarding between captains gets her group's the same way.
//  - 66: the sea's ships, legends, the raid's tiers and citadels grow against a group (tacbattle.ts addAlly, foeGrowth);
//    between captains nobody is grown.
//  - 67: what each captain's men and moves cut down shares the battle's lesson, the silver and the spoils (as the Abyss
//    raid shares a tier's pay); each captain's losses come off her own stacks (tactical.ts sync).
// No bout of the Colosseum, no trial of mastery (her own test), no jolly-boat raid and no old deck fight takes allies.

import { UNITS } from '../../../shared/src/data/army.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { TAC_GROUP, tacBring } from '../../../shared/src/data/tactical.ts';
import type { BoardOffer } from '../../../shared/src/protocol.ts';
import { battleXp } from '../../../shared/src/data/xpcurve.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { BoardAlly, BoardFight, ShipEntity } from './ship.ts';
import { groupOfAccount } from './party.ts';
import { inDuel } from './pvp.ts';
import { isArenaFight } from './arena.ts';
import { isTrialShip } from './throne.ts';
import { raidSpellHp } from './abyssraid.ts';
import { isCastellan } from './citadels.ts';
import { contractSpellHp } from './admiralty.ts';
import { maybeArtifact } from './hero.ts';
import { killedHp, queueAlly, sharesOf } from './tacbattle.ts';
import type { TacBattle, TacSideInput } from './tacbattle.ts';
import { TAC_XP_SHARE, pickBring, sendTac, sideOf } from './tactical.ts';

/** A trial of mastery (her own test: no help), as against the raid's, a citadel's or the Admiralty's legends. */
function ownTrial(ship: ShipEntity): boolean {
  return isTrialShip(ship) && raidSpellHp(ship) === undefined && !isCastellan(ship) && contractSpellHp(ship) === undefined;
}

/** docs/25 item 64: a boarding that takes allies — on the hexes, not a bout, not a trial, not a jolly-boat raid. */
export function groupable(fight: BoardFight, a: ShipEntity, b: ShipEntity): boolean {
  return !isArenaFight(fight) && !a.boarding?.remote && !ownTrial(a) && !ownTrial(b) && !fight.tac?.land;
}

/** Why a mate of the group may not come aboard (null: she may) — her ship at sea, alive, in no other fight, her men
 *  aboard, within TAC_GROUP.range of the grapple (`at`). */
export function mateWhy(game: Game, ms: PlayerSession, at: ShipEntity): string | null {
  const ship = ms.ship;
  if (!ship || !ship.alive || !ms.profile) return 'Put to sea first';
  if (ship.docked) return 'Not at sea';
  if (ship.boarding || ship.boardAlly !== null) return 'Already in a boarding';
  if (ship.landing) return 'Your party is ashore';
  if (ship.surrendered) return 'You struck your colours';
  if (inDuel(game, ship)) return 'Not in a duel';
  if (!ship.army.some((x) => x.n > 0)) return 'No men aboard to bring';
  if (dist(ship.state.x, ship.state.y, at.state.x, at.state.y) > TAC_GROUP.range) return `Come within ${TAC_GROUP.range} m of the grapple`;
  return null;
}

/** The mates of the captain of `ship` who may come aboard her fight now, the nearest first. */
function matesFor(game: Game, ship: ShipEntity, at: ShipEntity, skip: ReadonlySet<number>): PlayerSession[] {
  const s = game.sessionOf(ship);
  const g = s ? groupOfAccount(game, s.accountId) : null;
  if (!s || !g) return [];
  const out: PlayerSession[] = [];
  for (const acc of g.members) {
    if (acc === s.accountId || skip.has(acc)) continue;
    const ms = game.sessionByAccount(acc);
    if (ms && !mateWhy(game, ms, at)) out.push(ms);
  }
  return out.sort((p, q) => dist(p.ship!.state.x, p.ship!.state.y, at.state.x, at.state.y) - dist(q.ship!.state.x, q.ship!.state.y, at.state.x, at.state.y));
}

/** What an ally brings (item 64): her ship as a side (her ladder against the foe, her power, her hero), the stacks she
 *  chose (else her strongest; tacBring at the battle's level), her captain's orders reckoned from her whole crew (her
 *  orders are a captain's), no officers, no deck of hers on the field. */
export function allyInput(game: Game, ms: PlayerSession, enemy: ShipEntity, attacker: boolean, level: number): TacSideInput {
  const base = sideOf(game, ms.ship!, enemy, attacker);
  const all = base.army ?? [];
  const army = pickBring(all, tacBring(level), prefOf(game, ms.accountId).bring);
  const spellHp = all.reduce((n, x) => n + x.n * (UNITS[x.u]?.hp ?? 0), 0);
  const { gift: _gift, ...rest } = base;
  return { ...rest, army, officers: [], holes: 0, gunsOut: 0, fire: false, spellHp: Math.max(1, Math.round(spellHp)) };
}

/** Item 66: the other side grows against her group when it is the sea's (a ship, a legend, the raid, a citadel). */
const grows = (game: Game, foe: ShipEntity): boolean => !game.sessionOf(foe) && !foe.isPlayer;

/** The ship of a side's own captain, and the other side's. */
const own = (a: ShipEntity, b: ShipEntity, x: 0 | 1): [ShipEntity, ShipEntity] => (x ? [b, a] : [a, b]);

function hold(ship: ShipEntity, a: ShipEntity): void {
  ship.boardAlly = a.id;
  ship.repairing = false;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.state.speed = 0;
}

function offerOf(game: Game, ms: PlayerSession, a: ShipEntity, b: ShipEntity, x: 0 | 1, bt: TacBattle | null, level: number): BoardOffer {
  const [mine, foe] = own(a, b, x);
  const army = ms.ship!.army.filter((y) => y.n > 0).map((y) => ({ u: y.u, n: y.n }));
  return {
    with: a.id, side: x, mate: game.sessionOf(mine)?.name ?? mine.captainName, foe: foe.name, round: bt?.round ?? 0, last: TAC_GROUP.late,
    army, bring: pickBring(army, tacBring(level), prefOf(game, ms.accountId).bring).map((y) => y.u), n: tacBring(level), auto: prefOf(game, ms.accountId).auto,
  };
}

/** docs/25 item 64: the mates who come aboard with the grapples — those who come at once (prefOf); the others are
 *  asked (the offer card). The battle lays them out (newBattle's `allies`); `link` ties their slots after. */
export function alliesAtStart(game: Game, a: ShipEntity, b: ShipEntity, aIn: TacSideInput, bIn: TacSideInput, level: number): { side: 0 | 1; input: TacSideInput; grow: boolean; tag: number }[] {
  const fight = a.boarding!.fight;
  fight.tacAllies = [];
  fight.tacOffered = new Set();
  fight.tacScanAt = game.now + 1;
  const out: { side: 0 | 1; input: TacSideInput; grow: boolean; tag: number }[] = [];
  for (const x of [0, 1] as const) {
    const [mine, foe] = own(a, b, x);
    let n = 0;
    for (const ms of matesFor(game, mine, a, fight.tacOffered)) {
      if (n >= TAC_GROUP.side - 1) break;
      fight.tacOffered.add(ms.accountId);
      if (!prefOf(game, ms.accountId).auto) {
        game.sendTo(ms, { t: 'board_offer', offer: offerOf(game, ms, a, b, x, null, level) });
        continue;
      }
      out.push({ side: x, input: { ...allyInput(game, ms, foe, x === 0, level), name: ms.name }, grow: grows(game, foe), tag: ms.accountId });
      fight.tacAllies.push({ acc: ms.accountId, ship: ms.ship!.id, side: x, name: ms.name, startCrew: ms.ship!.crew, lost: 0 });
      hold(ms.ship!, a);
      game.toastShip(ms.ship!, `You come aboard ${game.sessionOf(mine)?.name ?? mine.name}'s boarding of the ${foe.name}.`, 'info');
      n++;
    }
  }
  return out;
}

/** The battle's slots for her allies who came aboard (by their accounts). */
export function linkAllies(fight: BoardFight, bt: TacBattle): void {
  for (const e of fight.tacAllies ?? []) if (e.slot === undefined) {
    const t = bt.allies?.find((x) => x.tag === e.acc);
    if (t) e.slot = t.slot;
  }
}

/** docs/25 item 64: whether a captain comes aboard her group's boardings at once (else — as she starts — she is asked:
 *  the card on the sea, whose «В следующий раз — сразу» sets it), and the kinds of her army she brings (none chosen: her
 *  strongest). Kept by her account for the server's life (a reload keeps them). */
const PREFS = new WeakMap<Game, Map<number, { auto: boolean; bring: string[] }>>();
export function prefOf(game: Game, acc: number): { auto: boolean; bring: string[] } {
  let m = PREFS.get(game);
  if (!m) PREFS.set(game, (m = new Map()));
  let p = m.get(acc);
  if (!p) m.set(acc, (p = { auto: false, bring: [] }));
  return p;
}
const kinds = (bring: readonly unknown[]): string[] => bring.filter((u): u is string => typeof u === 'string' && u in UNITS).slice(0, TAC_GROUP.bring);

/** docs/25 item 64: whether she comes aboard her group's boardings at once, and the kinds of her army she brings. */
export function assistPref(game: Game, ms: PlayerSession, auto: boolean, bring?: string[]): void {
  const p = prefOf(game, ms.accountId);
  p.auto = auto;
  if (bring) p.bring = kinds(bring);
}

/** docs/25 item 64: she asks to come aboard a group mate's boarding (the offer card), or lets it be (`no`). */
export function joinBoarding(game: Game, ms: PlayerSession, withId: number, bring?: string[], no?: boolean): string | null {
  if (Array.isArray(bring)) prefOf(game, ms.accountId).bring = kinds(bring);
  if (no) {
    game.sendTo(ms, { t: 'board_offer', offer: null });
    return null;
  }
  const a = game.ships.get(Number(withId));
  const st = a?.boarding;
  const bt = st?.fight.tac;
  if (!a || !st || !st.attacker || !bt || bt.over || !st.fight.tacAllies) {
    game.sendTo(ms, { t: 'board_offer', offer: null });
    return 'That boarding is over';
  }
  const b = game.ships.get(st.with);
  if (!b) return 'That boarding is over';
  if (!groupable(st.fight, a, b)) return 'No allies in this fight';
  const g = groupOfAccount(game, ms.accountId);
  const x: 0 | 1 | null = g && a.accountId !== null && g.members.includes(a.accountId) && game.sessionOf(a) ? 0 : g && b.accountId !== null && g.members.includes(b.accountId) && game.sessionOf(b) ? 1 : null;
  if (x === null) return 'Only a mate of the group comes aboard';
  const why = mateWhy(game, ms, a);
  if (why) return why;
  return queueJoin(game, ms, a, b, x);
}

function queueJoin(game: Game, ms: PlayerSession, a: ShipEntity, b: ShipEntity, x: 0 | 1): string | null {
  const fight = a.boarding!.fight;
  const bt = fight.tac!;
  const [mine, foe] = own(a, b, x);
  const why = queueAlly(bt, x, { ...allyInput(game, ms, foe, x === 0, bt.level), name: ms.name }, grows(game, foe), ms.accountId);
  if (why) return why;
  (fight.tacAllies ??= []).push({ acc: ms.accountId, ship: ms.ship!.id, side: x, name: ms.name, startCrew: ms.ship!.crew, lost: 0 });
  (fight.tacOffered ??= new Set()).add(ms.accountId);
  hold(ms.ship!, a);
  game.sendTo(ms, { t: 'board_offer', offer: null });
  game.toastShip(ms.ship!, `You come aboard ${game.sessionOf(mine)?.name ?? mine.name}'s boarding as round ${bt.round + 1} opens.`, 'info');
  sendTac(game, a, b);
  return null;
}

/** The battle's step for its group: her allies' ships held alongside, a captain gone from the helm played for, the
 *  slots of those come aboard, those who could not (past round TAC_GROUP.late) let go; and every second, the mates come
 *  within reach asked (or brought aboard, as they wish) while a round to come is still open to them. */
export function stepGroup(game: Game, a: ShipEntity, b: ShipEntity, bt: TacBattle): void {
  const fight = a.boarding!.fight;
  if (!fight.tacAllies) return;
  linkAllies(fight, bt);
  for (const e of [...fight.tacAllies]) {
    const ship = game.ships.get(e.ship);
    if (ship?.alive) ship.state.speed *= 0.8;
    const ms = game.sessionByAccount(e.acc);
    if (e.slot === undefined) {
      if (!bt.joinQ?.some((q) => q.tag === e.acc)) {
        fight.tacAllies.splice(fight.tacAllies.indexOf(e), 1);
        if (ship) ship.boardAlly = null;
        if (ms?.ship) game.toastShip(ms.ship, 'Too late to come aboard: the fight is past its third round.', 'bad');
      }
      continue;
    }
    const h = bt.allies?.find((t) => t.slot === e.slot && t.side === e.side)?.hero;
    if (h && h.input.human && !h.auto && ms?.ship?.id !== e.ship) h.auto = true;
  }
  if (bt.over || bt.round + 1 > TAC_GROUP.late || (fight.tacScanAt ?? 0) > game.now) return;
  fight.tacScanAt = game.now + 1;
  const offered = (fight.tacOffered ??= new Set());
  for (const x of [0, 1] as const) {
    const [mine] = own(a, b, x);
    if (!game.sessionOf(mine)) continue;
    for (const ms of matesFor(game, mine, a, offered)) {
      if (1 + fight.tacAllies.filter((e) => e.side === x).length >= TAC_GROUP.side) break;
      offered.add(ms.accountId);
      if (prefOf(game, ms.accountId).auto) queueJoin(game, ms, a, b, x);
      else game.sendTo(ms, { t: 'board_offer', offer: offerOf(game, ms, a, b, x, bt, bt.level) });
    }
  }
}

/** docs/25 item 67: each captain of a side by account, with her share of what her side cut down. */
export function sharesByAcc(game: Game, fight: BoardFight, a: ShipEntity, b: ShipEntity, x: 0 | 1): Map<number, number> {
  const bt = fight.tac;
  const out = new Map<number, number>();
  if (!bt) return out;
  const sh = sharesOf(bt, x);
  const main = x ? b : a;
  const acc = game.sessionOf(main)?.accountId ?? main.accountId;
  if (acc !== null) out.set(acc, sh.get(0) ?? 1);
  for (const e of fight.tacAllies ?? []) if (e.side === x && e.slot !== undefined) out.set(e.acc, sh.get(e.slot) ?? 0);
  return out;
}

/** docs/25 item 67: the battle is over — each winning captain's lesson by her share (the men her side cut down, the
 *  foe as it came before it grew), the spoils of a prize (the purse and the hold) and the guard's artifact by the
 *  shares; the allies' will, stamina and patched-up men. Returns the side's own captain's lesson. */
export function settleGroup(game: Game, a: ShipEntity, b: ShipEntity, bt: TacBattle, w: 0 | 1, prize: boolean, mainXp: (share: number) => number): number {
  const fight = a.boarding!.fight;
  const allies = (fight.tacAllies ?? []).filter((e) => e.slot !== undefined);
  const sh = sharesOf(bt, w);
  const shares = new Map<number, number>(sh);
  const loser = w ? a : b;
  const foeLv = loser.onLadder ? loser.combatLevel : null;
  const killed = killedHp(bt, w);
  const total = bt.stacks.reduce((n, x) => n + (x.side !== w ? (x.start - (x.boost ?? 0)) * x.hpMax : 0), 0);
  for (const e of allies) {
    e.share = e.side === w ? shares.get(e.slot!) ?? 0 : 0;
    const ms = game.sessionByAccount(e.acc);
    if (!ms?.profile || e.side !== w) continue;
    const xp = battleXp(ms.profile.level, foeLv, killed * e.share, total, TAC_XP_SHARE);
    e.xp = xp;
    if (xp > 0) game.grantXp(ms, xp, `Won the boarding battle with ${loser.name}`, true);
  }
  // The spoils of a prize (a ship of the sea taken, or a captain's): the purse and the hold by the shares — each ally's
  // part in silver, the rest the boarder's prize as before.
  if (prize && w === 0) {
    const part = allies.filter((e) => e.side === 0).reduce((n, e) => n + (e.share ?? 0), 0);
    if (part > 0) {
      let pot = 0;
      if (!loser.isPlayer) {
        const cut = Math.floor(loser.purse * part);
        loser.purse -= cut;
        pot += cut;
      } else {
        const lp = game.profileOf(loser);
        if (lp) {
          const cut = Math.floor(lp.gold * 0.08 * part);
          lp.gold -= cut;
          pot += cut;
        }
      }
      for (const id of Object.keys(loser.cargo) as GoodId[]) {
        const n = loser.cargo[id] ?? 0;
        const take = Math.floor(n * part);
        if (take <= 0) continue;
        loser.cargo[id] = n - take;
        if (!loser.cargo[id]) delete loser.cargo[id];
        pot += take * (GOODS[id]?.basePrice ?? 0);
      }
      for (const e of allies) if (e.side === 0 && (e.share ?? 0) > 0) {
        const ms = game.sessionByAccount(e.acc);
        const silver = Math.round((pot * (e.share ?? 0)) / part);
        e.silver = silver;
        if (ms?.profile && silver > 0) {
          ms.profile.gold += silver;
          game.db.ledger(e.acc, 'boarding', silver, loser.name);
        }
      }
    }
  }
  // A guard's artifact (a ship of the sea): the chance shared as the cut is.
  if (!game.sessionOf(loser) && w === 0) {
    const p = loser.elite ? 0.6 : Math.min(0.3, (bt.heroes[1].startMen - bt.stacks.reduce((n, x) => n + (x.side === 1 ? x.boost ?? 0 : 0), 0)) / 400);
    for (const e of allies) if (e.side === 0 && (e.share ?? 0) > 0) {
      const ms = game.sessionByAccount(e.acc);
      if (ms?.profile) maybeArtifact(game, ms, 'guard', p * (e.share ?? 0));
    }
  }
  for (const e of allies) {
    const ms = game.sessionByAccount(e.acc);
    if (!ms?.ship) continue;
    const pc = Math.round((e.share ?? 0) * 100);
    if (e.side === w) game.toastShip(ms.ship, `Your share of the boarding: ${pc}% of what was cut down — ${e.silver ?? 0} silver, ${e.xp ?? 0} experience.`, 'gold');
  }
  return mainXp(sh.get(0) ?? 1);
}

/** The shares for the end screen (item 67): every captain of both sides, her share of her side's cut and what it paid. */
export function sharesView(game: Game, fight: BoardFight, a: ShipEntity, b: ShipEntity, you: number): NonNullable<NonNullable<import('../../../shared/src/protocol.ts').TacView['result']>['shares']> {
  const bt = fight.tac;
  if (!bt?.allies?.length) return [];
  const out: NonNullable<NonNullable<import('../../../shared/src/protocol.ts').TacView['result']>['shares']> = [];
  for (const x of [0, 1] as const) {
    const sh = sharesOf(bt, x);
    const main = x ? b : a;
    const ms = game.sessionOf(main);
    out.push({ side: x, slot: 0, name: ms?.name ?? main.captainName, share: Math.round((sh.get(0) ?? 0) * 100) / 100, ...(fight.tacXp?.[x] ? { xp: fight.tacXp[x] } : {}), ...(ms?.accountId === you ? { you: true } : {}) });
    for (const e of fight.tacAllies ?? []) if (e.side === x && e.slot !== undefined) out.push({ side: x, slot: e.slot, name: e.name, share: Math.round((sh.get(e.slot) ?? 0) * 100) / 100, ...(e.xp ? { xp: e.xp } : {}), ...(e.silver ? { silver: e.silver } : {}), ...(e.acc === you ? { you: true } : {}) });
  }
  return out;
}

/** The fight is over (or gone): her allies' ships are let go, their screens closed, the asked told it is past. */
export function releaseAllies(game: Game, fight: BoardFight): void {
  for (const e of fight.tacAllies ?? []) {
    const ship = game.ships.get(e.ship);
    if (ship && ship.boardAlly !== null) ship.boardAlly = null;
    const ms = game.sessionByAccount(e.acc);
    if (ms) game.sendTo(ms, { t: 'board_tac', view: null });
  }
  for (const acc of fight.tacOffered ?? []) {
    const ms = game.sessionByAccount(acc);
    if (ms && !(fight.tacAllies ?? []).some((e) => e.acc === acc)) game.sendTo(ms, { t: 'board_offer', offer: null });
  }
  fight.tacAllies = [];
}

/** The ally entry of a ship that fights another's boarding, with the fight's own two ships. */
export function allyFight(game: Game, ship: ShipEntity): { a: ShipEntity; b: ShipEntity; e: BoardAlly } | null {
  if (ship.boardAlly === null) return null;
  const a = game.ships.get(ship.boardAlly);
  const st = a?.boarding;
  const b = st ? game.ships.get(st.with) : undefined;
  const e = st?.fight.tacAllies?.find((x) => x.ship === ship.id);
  if (!a || !b || !st || !e) {
    ship.boardAlly = null;
    return null;
  }
  return { a, b, e };
}
