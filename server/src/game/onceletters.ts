// A letter sent once to one captain, with silver in it: the small things put right by hand (forum 157, Эдуард,
// 2026-11-24: a Crown patrol took eight medicine and two rum he had bought — director.ts hotGoods read stale marks of
// plunder long since used up; the search no longer takes what the crew uses up, nor a Crown officer's prize).

import type { Game } from './Game.ts';
import { deliver } from './post.ts';

interface OnceLetter {
  ref: string;
  account: number;
  subject: string;
  body: string;
  silver: number;
}

export const ONCE_LETTERS: OnceLetter[] = [{
  ref: 'search157:161:2026-11-24',
  account: 161,
  subject: 'Лекарства и ром, изъятые патрулём',
  body:
    'Капитан, патруль забрал у вас 8 лекарств и 2 рома, которые вы купили сами. Это ошибка игры: она помнила старые метки добычи, давно израсходованной в море, и приняла за добычу честный груз.\n\n' +
    'Мы исправили правило: лекарства, ром и смолу патруль больше не трогает вовсе, а у капитана на службе Короны не забирает и добычу — для него это законный приз. Изымается только контрабанда.\n\n' +
    'За изъятое с запасом вложено 1500 серебра: заберите его во вкладке «Письма». Попутного ветра!',
  silver: 1500,
}];
const KEY = 'onceletters_done';

/** Every two seconds: a letter not yet sent goes out, once (the captain need not be aboard). */
export function stepOnceLetters(game: Game): void {
  const done = game.db.getKv<string[]>(KEY) ?? [];
  const todo = ONCE_LETTERS.filter((l) => !done.includes(l.ref));
  if (!todo.length) return;
  for (const l of todo) {
    deliver(game, l.account, { from: 'Команда GRAVETIDE', subject: l.subject, body: l.body, gold: l.silver, goods: null });
    game.db.ledger(l.account, 'once_letter', 0, `${l.ref}:${l.silver}`);
    console.log(`[onceletters] ${l.ref}: ${l.silver} silver`);
  }
  game.db.setKv(KEY, [...done, ...todo.map((l) => l.ref)]);
}
