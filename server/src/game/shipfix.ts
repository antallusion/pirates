// A ship's level put right once (owner, 2026-11-19: «верни 9… команду можно чуть-чуть разжаловать, чтобы вместилось на
// 9-й корабль, и вернуть также средства за их покупку»): a hull that took a level she was never refitted to (player.ts,
// the old «one more if nearly all fitted» on a hull bought with no level written) is set back as she comes aboard; the
// men past the hammocks of her true level are paid off at what they are worth, the silver sent in a letter with the why.

import { UNITS } from '../../../shared/src/data/army.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { clampLevel } from '../../../shared/src/data/shiplevel.ts';
import type { Game } from './Game.ts';
import { deliver } from './post.ts';
import { berthFit } from './shipbuilding.ts';
import type { PlayerSession } from './player.ts';

interface ShipFix {
  ref: string;
  account: number;
  cls: ShipClassId;
  to: number;
}

export const SHIP_FIXES: ShipFix[] = [{ ref: 'xebec10:161:2026-11-19', account: 161, cls: 'great_xebec', to: 9 }];
const KEY = 'shipfix_done';

/** What one fix did: the level from and to, the men paid off and the silver for them. */
export interface ShipFixDone {
  from: number;
  to: number;
  men: number;
  silver: number;
}

/** Applies a fix to a captain aboard (her ship set back, the men over paid off, the letter sent). */
export function applyShipFix(game: Game, s: PlayerSession, f: ShipFix): ShipFixDone | null {
  const p = s.profile, ship = s.ship;
  if (!p || !ship || p.loadout.classId !== f.cls) return null;
  const from = p.loadout.level ?? 0;
  const to = clampLevel(f.cls, f.to);
  if (from <= to) return null;
  // the men past the hammocks of her true level paid off first (a recompute would cut them with nothing for them)
  const over = berthFit(s, { ...p.loadout, level: to }).menOver;
  let silver = 0;
  if (over > 0) for (const st of ship.loseMen(over)) silver += (UNITS[st.u]?.cost ?? 30) * st.n;
  silver = Math.round(silver);
  p.loadout.level = to;
  ship.loadout = p.loadout;
  ship.recompute(game.now);
  ship.hull = Math.min(ship.hull, ship.stats.hullMax);
  ship.sails = Math.min(ship.sails, ship.stats.sailHpMax);
  deliver(game, s.accountId, {
    from: 'Команда GRAVETIDE',
    subject: 'Уровень вашей «Большой шебеки»',
    body:
      `Капитан, ваша «Большая шебека» получила 10-й уровень по ошибке игры, без перестройки на верфи. После покупки корабль приходит 9-го уровня, а при перезапуске сервера старое правило для давних кораблей добавило ей уровень за полный набор модулей. Вашей вины в этом нет, ошибку мы исправили.\n\n` +
      `Чтобы всё было честно для всех капитанов, мы вернули кораблю 9-й уровень. 10-й уровень — вершина моря: перестройка на верфи стоит 62 000 серебра, доски, железо, парусину, кость левиафана, серное железо и Сердце бури из «Шторма века».\n\n` +
      (over > 0
        ? `На корабле 9-го уровня меньше коек, поэтому ${over} чел. команды списаны на берег. Их полная стоимость, ${silver} серебра, вложена в это письмо: заберите её во вкладке «Письма».\n\n`
        : 'Вся ваша команда помещается на корабль 9-го уровня, никто не списан.\n\n') +
      'Модули, пушки и снаряжение остаются на корабле. Спасибо за понимание и попутного ветра!',
    gold: silver,
    goods: null,
  });
  game.db.ledger(s.accountId, 'ship_fix', 0, `${f.cls}:${from}>${to}:men ${over}:refund ${silver}`);
  game.saveSession(s);
  game.pushSelf(s, true);
  return { from, to, men: over, silver };
}

/** Every two seconds: a fix waiting for a captain now aboard is applied, once. */
export function stepShipFix(game: Game): void {
  const done = game.db.getKv<string[]>(KEY) ?? [];
  for (const f of SHIP_FIXES) {
    if (done.includes(f.ref)) continue;
    const s = game.sessionByAccount(f.account);
    if (!s?.profile || !s.ship) continue;
    const r = applyShipFix(game, s, f);
    game.db.setKv(KEY, [...done, f.ref]);
    console.log(`[shipfix] ${f.ref}: ${r ? `⚓${r.from}→⚓${r.to}, ${r.men} men paid off, ${r.silver} silver by letter` : 'nothing to do'}`);
  }
}
