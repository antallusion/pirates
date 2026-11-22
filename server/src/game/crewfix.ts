// The trades' practice put right once (forum 135, Эдуард, 2026-11-22): the first cook or surgeon signed after the last
// of them fell took the trade's practice down to nothing (crew.ts hireTrade thinned it by the men of the trade aboard,
// and there were none). What the lost crews had earned is not on record; the cooks' is reckoned from her hours at sea
// (they practise by every hour they feed the men), the surgeons' at most two levels — raised only where it stands
// lower, and a letter tells why.

import { PRACTICE_LEVELS, PRACTICE_GAIN, PRACTICE_MAX, practiceLevel } from '../../../shared/src/data/crewtalk.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';

interface CrewFix {
  ref: string;
  account: number;
}

export const CREW_FIXES: CrewFix[] = [{ ref: 'practice135:161:2026-11-22', account: 161 }];
const KEY = 'crewfix_done';
/** The share of her hours at sea reckoned as fed by a cook (a port's hours and an empty larder are not). */
const FED_SHARE = 0.75;

/** What the trades' practice should be, by her own record: the cooks' by her hours at sea, the surgeons' no higher than
 *  the cooks' level and never past two. */
export function practiceDue(seaHours: number): { cook: number; surgeon: number } {
  const cook = Math.min(PRACTICE_LEVELS[PRACTICE_MAX], Math.round(Math.max(0, seaHours) * PRACTICE_GAIN.cookHour * FED_SHARE));
  const surgeon = PRACTICE_LEVELS[Math.min(2, practiceLevel(cook))];
  return { cook, surgeon };
}

/** Applies a fix to a captain aboard: each trade's practice raised to what is due where it stands lower; the letter. */
export function applyCrewFix(game: Game, s: PlayerSession): { cook: [number, number]; surgeon: [number, number] } | null {
  const c = s.profile?.company;
  if (!c) return null;
  const due = practiceDue(c.seaHours ?? 0);
  const was = { cook: c.practice.cook ?? 0, surgeon: c.practice.surgeon ?? 0 };
  const up = { cook: practiceLevel(due.cook) > practiceLevel(was.cook), surgeon: practiceLevel(due.surgeon) > practiceLevel(was.surgeon) };
  if (!up.cook && !up.surgeon) return null;
  if (up.cook) c.practice.cook = due.cook;
  if (up.surgeon) c.practice.surgeon = due.surgeon;
  if (s.ship) s.ship.companyKey = '';
  const lv = (k: 'cook' | 'surgeon') => practiceLevel(c.practice[k]);
  const lines = [
    up.cook ? `сноровка коков — ${lv('cook')}-й уровень (+${lv('cook')} к морали)` : '',
    up.surgeon ? `сноровка лекарей — ${lv('surgeon')}-й уровень (+${lv('surgeon') * 10}% к лечению)` : '',
  ].filter(Boolean);
  deliver(game, s.accountId, {
    from: 'Команда GRAVETIDE',
    subject: 'Сноровка коков и лекарей возвращена',
    body:
      'Капитан, вы были правы. Когда в бою гибли последние коки или лекари, первый же нанятый после них новичок обнулял сноровку всего ремесла — всё, что заработали прежние команды. Это была ошибка игры, мы её исправили. Теперь лекари и коки гибнут последними, ведь они работают под палубой. Сноровка ремесла остаётся за кораблём, даже если на борту не осталось ни одного мастера. В окне команды пустое ремесло так и подписано: «нет на борту — наймите в таверне».\n\n' +
      `Точных цифр прежней сноровки у нас нет, поэтому мы посчитали её по вашим часам в море и вернули: ${lines.join('; ')}. Прибавка действует, пока на борту есть хотя бы один кок или лекарь — их нанимают в таверне любого порта.\n\n` +
      'Спасибо, что написали, и попутного ветра!',
    gold: 0,
    goods: null,
  });
  game.db.ledger(s.accountId, 'crew_fix', 0, `cook ${Math.round(was.cook)}>${Math.round(c.practice.cook)}:surgeon ${Math.round(was.surgeon)}>${Math.round(c.practice.surgeon)}`);
  game.saveSession(s);
  game.pushSelf(s, true);
  return { cook: [was.cook, c.practice.cook], surgeon: [was.surgeon, c.practice.surgeon] };
}

/** Every two seconds: a fix waiting for a captain now aboard is applied, once. */
export function stepCrewFix(game: Game): void {
  const done = game.db.getKv<string[]>(KEY) ?? [];
  for (const f of CREW_FIXES) {
    if (done.includes(f.ref)) continue;
    const s = game.sessionByAccount(f.account);
    if (!s?.profile || !s.ship) continue;
    const r = applyCrewFix(game, s);
    game.db.setKv(KEY, [...done, f.ref]);
    console.log(`[crewfix] ${f.ref}: ${r ? `cook ${Math.round(r.cook[0])}→${Math.round(r.cook[1])}, surgeon ${Math.round(r.surgeon[0])}→${Math.round(r.surgeon[1])}` : 'nothing to do'}`);
  }
}
