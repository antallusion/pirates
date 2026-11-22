// The Stair's prize given back once (forum 140, Эдуард, 2026-11-23): he went down five tiers of the Maelstrom Stair
// with his locker full, and the descent's piece of gear (and the finds before it) went into the water (gear.ts
// takeItem). Now a find with the locker full waits in the letters (keepItem); this gives him the five tiers' piece —
// one rarity up, for the wait — and an artifact for the finds lost on the way, by the same road (locker or letter).

import { makeItem } from '../../../shared/src/data/items.ts';
import type { Game } from './Game.ts';
import { keepItem } from './gear.ts';
import { artifactFind } from './hero.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';

interface DescentFix {
  ref: string;
  account: number;
  depth: number;
}

export const DESCENT_FIXES: DescentFix[] = [{ ref: 'stair140:161:2026-11-23', account: 161, depth: 5 }];
const KEY = 'descentfix_done';

/** Applies a fix to a captain aboard: the piece and the artifact, then the letter with the why. */
export function applyDescentFix(game: Game, s: PlayerSession, f: DescentFix): string[] | null {
  const p = s.profile;
  if (!p || !s.ship) return null;
  const ilvl = s.ship.shipLevel;
  const piece = makeItem(game.rng, p.itemSeq++, { ilvl, rarity: (f.depth >= 6 ? 4 : 3) as 3 });
  keepItem(game, s, piece);
  const art = artifactFind(game, s, 'chest');
  const got = art ? 2 : 1;
  deliver(game, s.accountId, {
    from: 'Команда GRAVETIDE',
    subject: 'Награда Лестницы Мальстрёма',
    body:
      'Капитан, вы спустились по Лестнице Мальстрёма на пять ярусов, но награда за спуск пропала: рундук был полон, и игра просто роняла находку в воду. Это была наша ошибка, мы её исправили. Теперь всё, что вы находите при полном рундуке, не пропадает, а ждёт вас в письме «Ваш рундук был полон» — забрать можно в любом порту, когда освободится место. А при выходе из порта с полным рундуком игра теперь об этом напоминает.\n\n' +
      `Награду за пять ярусов мы вернули, на ступень лучше обычной, и добавили артефакт за то, что пропало по пути (всего предметов: ${got}). Если в рундуке нет места, они лежат в письме «Ваш рундук был полон».\n\n` +
      'Про благословения Лестницы: они действуют только во время спуска и уходят, когда спуск кончается — так задумано. Посмотреть их можно в окне Лестницы, пока вы внизу.\n\n' +
      'Спасибо, что написали, и попутного ветра!',
    gold: 0,
    goods: null,
  });
  game.db.ledger(s.accountId, 'descent_fix', 0, `${f.ref}:${got}`);
  game.saveSession(s);
  game.pushSelf(s, true);
  return [piece.base, ...(art ? [art.art ?? art.base] : [])];
}

/** Every two seconds: a fix waiting for a captain now aboard is applied, once. */
export function stepDescentFix(game: Game): void {
  const done = game.db.getKv<string[]>(KEY) ?? [];
  for (const f of DESCENT_FIXES) {
    if (done.includes(f.ref)) continue;
    const s = game.sessionByAccount(f.account);
    if (!s?.profile || !s.ship) continue;
    const r = applyDescentFix(game, s, f);
    game.db.setKv(KEY, [...done, f.ref]);
    console.log(`[descentfix] ${f.ref}: ${r ? r.join(', ') : 'nothing to do'}`);
  }
}
