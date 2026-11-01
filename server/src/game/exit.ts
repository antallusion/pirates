// «Выход» and the lingering ship (forum 45, Нефигугум: «закрыл вкладку — и корабль пропал, бесплатный побег из любого
// PvP»). Server-authoritative:
//  - a dropped line, a closed tab or another account at sea: her ship stays LOGOUT_TIMER_SEC (2 min) with her last
//    order on (the helmsman's course to her mark, «Атаковать» and her gun crews' auto-fire, else the course held with
//    the sails as they were) — a mark like any other: fired on, boarded, sunk, and what befalls her is in her save; then
//    she leaves (Game.sessionSecond). Back aboard within it, the same ship is hers again (Game.onHello).
//  - in port the exit is at once;
//  - «Выход» at sea: SAFE_EXIT_SEC (30 s) of «ВЫХОД ЧЕРЕЗ 0:30» on her screen; any order of hers that does a thing (the
//    helm or the sails moved, a shot, an ability, a course, a landing…) calls it off, and so does a shot on her or a
//    battle; done, her ship leaves the sea at once (no lingering) and her screen says «Вы вышли».

import { SAFE_EXIT_SEC, SAIL_STEPS } from '../../../shared/src/constants.ts';
import { clamp } from '../../../shared/src/math.ts';
import { FERRY_COOLDOWN_SEC } from '../../../shared/src/data/ferry.ts';
import type { BoostsView, ClientMsg, ExitWhy } from '../../../shared/src/protocol.ts';
import { stopsOrder } from './allstop.ts';
import type { Game } from './Game.ts';
import { inBattle } from './inbattle.ts';
import type { PlayerSession } from './player.ts';
import { shopState } from './shop.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';

/** The orders that call a safe exit off: every one that moves, fights or does a thing at sea (the helm and the sails
 *  only when they change — her phone sends its helm four times a second). Table-tested (tests/exit.test.ts). */
export const EXIT_BREAKS: ReadonlySet<string> = new Set([
  'fire', 'attack', 'volley', 'aim', 'dash', 'cut_mast', 'chase', 'mount', 'ability', 'talent_active', 'board', 'board_join',
  'scuttle', 'scuttle_home', 'dock', 'undock', 'land', 'halt', 'autosail', 'goto', 'ferry', 'jettison', 'repair', 'tribute',
  'surrender', 'loot_take', 'encounter', 'minigame', 'trek', 'fishing', 'hunt', 'dive_move', 'dive_surface', 'abyss', 'tac',
  'hero', 'pvp', 'signal', 'way', 'seamark', 'seafind', 'lair', 'drift', 'roam', 'h4',
]);
/** …of those, the ones whose looking actions do nothing (a card's view, a quote). */
const LOOKS = new Set(['view', 'quote', 'bounties', 'list']);

/** Does this order of hers call her safe exit off? */
export function breaksExit(s: PlayerSession, msg: ClientMsg): boolean {
  if (msg.t === 'logout' || msg.t === 'ping') return false;
  if (msg.t === 'input') return msg.rudder !== 0 || (Number.isFinite(msg.sail) && Math.round(msg.sail) !== s.exitSail);
  const m = msg as { t: string; action?: string; op?: string };
  const a = m.action ?? m.op;
  if (typeof a === 'string' && LOOKS.has(a)) return false;
  return EXIT_BREAKS.has(m.t) || stopsOrder(m);
}

/** Why she may not start a safe exit now (null: she may). */
function exitBlocked(game: Game, s: PlayerSession): ExitWhy | null {
  const ship = s.ship;
  if (!ship) return null;
  if (ship.boarding || ship.grappled || s.pendingBoarding || inBattle(game, ship) || ship.boardAlly !== null) return 'fight';
  if (ship.underFire(game.now)) return 'fire';
  return null;
}

/** Her «Выход»: in port (or with no ship at sea) she leaves at once; at sea the safe exit begins, or is called off. */
export function askExit(game: Game, s: PlayerSession, cancel = false): void {
  if (cancel) return dropExit(game, s, 'cancel');
  const ship = s.ship;
  if (!ship || !ship.alive || ship.docked) return game.leaveWorld(s);
  if (s.exitAt) return game.sendTo(s, { t: 'exit', until: s.exitAt });
  const why = exitBlocked(game, s);
  if (why) return game.sendTo(s, { t: 'exit', until: 0, why });
  s.exitAt = game.now + SAFE_EXIT_SEC;
  s.exitSail = s.lastSail >= 0 ? s.lastSail : Math.round(clamp(ship.input.sailTarget, 0, 1) * (SAIL_STEPS.length - 1));
  game.sendTo(s, { t: 'exit', until: s.exitAt });
}

/** Her safe exit called off (told to her screen). */
export function dropExit(game: Game, s: PlayerSession, why: ExitWhy): void {
  if (!s.exitAt) return;
  s.exitAt = 0;
  s.exitSail = -1;
  game.sendTo(s, { t: 'exit', until: 0, why });
}

/** Each order of hers (Game.handle), before it is done: one that does a thing calls her exit off. */
export function exitOnOrder(game: Game, s: PlayerSession, msg: ClientMsg): void {
  if (s.exitAt && breaksExit(s, msg)) dropExit(game, s, 'action');
}

/** Each second (Game.sessionSecond): shot at or in a battle — off; her moment come — she leaves the sea. */
export function exitSecond(game: Game, s: PlayerSession): void {
  if (!s.exitAt) return;
  const ship = s.ship;
  if (ship && ship.docked) return game.leaveWorld(s);
  const why = exitBlocked(game, s);
  if (why) return dropExit(game, s, why);
  if (game.now >= s.exitAt) game.leaveWorld(s);
}

/** Her account's boosts for the HUD's row of effects (wall ms; 0 none). */
export function boostsView(game: Game, s: PlayerSession): BoostsView {
  const st = shopState(game, s.accountId);
  const now = game.wallNow();
  const at = (t: number) => (t > now ? t : 0);
  const ferry = s.profile?.ferryAt ? s.profile.ferryAt + FERRY_COOLDOWN_SEC * 1000 : 0;
  return { xp: at(st.xp), wind: at(st.wind), prod: at(st.prod), ferry: at(ferry) };
}

/** The tester's sample of the effects' row (forum 45 QA): /fx [all|clear] — a bane and a boon of each kind on her ship
 *  and her account for a few minutes, or all of them taken off. */
export function adminFx(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship, p = s.profile;
  if (!ship || !p) return 'No captain.';
  const now = game.now, wall = game.wallNow();
  const st = shopState(game, s.accountId);
  if (args[0] === 'clear') {
    ship.effects = [];
    ship.protectedUntil = 0;
    ship.rudderHp = 1;
    st.xp = st.wind = st.prod = 0;
    game.pushSelf(s, true);
    return 'Effects cleared.';
  }
  const add = (id: string, sec: number, mods?: Record<string, number>) => ship.addEffect({ id, until: now + sec, ...(mods ? { mods } : {}) }, now);
  add('torn_rigging', 90, { maxSpeed: -0.35 });
  add('fire', 60);
  add('marked', 45, { incomingDamageMul: 0.15 });
  add('order_fair_wind', 120, { maxSpeed: 0.15 });
  add('omen_fortune', 600);
  const ab = ship.captain ? (CAPTAINS[ship.captain]?.abilities[0]?.id ?? null) : null;
  if (ab) add(ab, 40);
  ship.protectedUntil = now + 300;
  ship.rudderHp = 0.6;
  st.xp = wall + 3_600_000;
  st.wind = wall + 1_800_000;
  game.pushSelf(s, true);
  return 'Effects on you: a sample of each kind.';
}
