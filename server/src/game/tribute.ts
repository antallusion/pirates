// «Дань» to the players who help the game (owner, 2026-11-02: «платить … какую-то дань дублонами … закинь Пофигуму 500
// дублонов и Нефигугуму тоже 500 за идеи»): doubloons credited once each, on boot, with a letter of thanks. Each grant is
// a ref of its own in the ledger (the two players are Russian: the letter is written in Russian), so a restart never pays twice; add a line here for the next one.

import type { Game } from './Game.ts';
import { creditPremium } from './premium.ts';
import { deliver } from './post.ts';

interface Tribute { acc: number; n: number; ref: string; why: string }

export const TRIBUTES: readonly Tribute[] = [
  { acc: 214, n: 500, ref: 'tribute:2026-11-02:ideas', why: 'за идеи на форуме' },
  { acc: 248, n: 500, ref: 'tribute:2026-11-02:tests', why: 'за тесты игры и отчёты на форуме' },
];

export function tributeBoot(game: Game): void {
  for (const t of TRIBUTES) {
    try {
      if (!game.db.accountById(t.acc) || game.db.doubloonRef(t.acc, 'doubloons_gift', t.ref)) continue;
      const bal = creditPremium(game, t.acc, t.n, 'gift', t.ref, true);
      if (bal === null) continue;
      deliver(game, t.acc, { from: 'Команда GRAVETIDE', subject: 'Дань от команды', body: `Спасибо ${t.why}! На ваш счёт зачислено ${t.n} дублонов.`, gold: 0, goods: null });
      console.log(`[tribute] ${t.n} doubloons to account ${t.acc}`);
    } catch (e) {
      console.log(`[tribute] ${(e as Error).message}`);
    }
  }
}
