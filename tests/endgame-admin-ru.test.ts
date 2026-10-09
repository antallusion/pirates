// docs/19 E19: every answer of the endgame's admin commands in Russian (the owner: «ни одной непереведённой строки,
// включая ответы админ-команд»). Each command of the Throne, the seals, the titans, the Abyss, the relics, the
// invasions, the citadels, the contracts and the Colosseum — its usage, its working answers, before the cap and at
// it — through the client's table (client/src/lang/server.ts): no English word is left but the command's own words
// (its name, its arguments, the ids it takes). The check found «Usage: /maw|/relic|/cit …» and the /trial list
// («navigation locked · luck won …») in English.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAdmin } from '../server/src/game/admin.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import '../client/src/lang/names.ts';
import { SKILL_IDS } from '../shared/src/data/hero.ts';
import { RELIC_IDS } from '../shared/src/data/artifacts.ts';
import { join, makeGame, steps } from './helpers.ts';

const CMDS = [
  '/glory', '/glory 5', '/glory xp 1000', '/glory zz', '/mastery', '/mastery zz', '/mastery all', '/mastery reset',
  '/trial', '/trial zz', '/trial boarding', '/trial boarding win', '/trial luck lose', '/trial reset',
  '/seal', '/seal lv 99', '/seal kind zz', '/seal go', '/seal win', '/seal lose', '/seal reset', '/seal board', '/seal zz',
  '/titan', '/titan zz', '/titan titan_kraken', '/titan titan_kraken', '/titan grail', '/titan reset',
  '/maw', '/maw tier 9', '/maw tier 2', '/maw win', '/maw lose', '/maw go', '/maw reset', '/maw board', '/maw zz',
  '/relic', '/relic zz', '/relic crown_of_the_deep', '/relic parts storm_orb', '/relic drop 3', '/relic all', '/relic clear',
  '/invasion', '/invasion zz', '/invasion start', '/invasion wave', '/invasion win', '/invasion fail', '/invasion clear', '/invasion gravewater',
  '/cit', '/cit go', '/cit guild', '/cit window', '/cit win', '/cit lose', '/cit free', '/cit points 50', '/cit season', '/cit zz', '/cit reset',
  '/contract', '/contract take 9', '/contract take 1', '/contract done 2', '/contract go 9', '/contract go 1', '/contract week', '/contract reset', '/contract zz',
  '/arena', '/arena queue', '/arena win', '/arena lose', '/arena rating x', '/arena rating 1200', '/arena season', '/arena reset', '/arena zz',
];
/** The command's own words: its arguments and the ids it takes (they are typed as they stand). */
const OWN = new Set([
  'N', 'K', 'id', 'lv', 'kind', 'go', 'win', 'lose', 'reset', 'board', 'tier', 'list', 'take', 'done', 'week', 'queue', 'bot', 'rating',
  'season', 'start', 'wave', 'fail', 'clear', 'guild', 'window', 'siege', 'own', 'free', 'points', 'grail', 'parts', 'all', 'drop', 'xp',
  ...SKILL_IDS, ...RELIC_IDS,
]);

test('the endgame admin commands answer in Russian (docs/19 E19)', () => {
  setLang('ru');
  applyDataLocale('ru');
  try {
    const { game } = makeGame();
    join(game, 'Проверка');
    const s = game.sessionByName('Проверка')!;
    const left: string[] = [];
    for (const lv of [1, 60]) {
      if (lv === 60) runAdmin(game, s, '/level 60');
      for (const c of CMDS) {
        const en = runAdmin(game, s, c) ?? '';
        steps(game, 3);
        const ru = serverText(en);
        // past the command lines quoted in it («/maw tier 1-7») and the bracketed lists of its arguments
        const bare = ru.replace(/\/[a-z]+(?: [^\s·.,:;()«»]+)*/g, ' ').replace(/\[[^\]]*\]/g, ' ');
        const words = (bare.match(/[A-Za-z][A-Za-z_'’]{2,}/g) ?? []).filter((w) => !OWN.has(w) && !w.includes('_')); // (snake_case: an id)
        if (words.length) left.push(`${lv} ${c} → ${ru} [${words.join(' ')}]`);
      }
    }
    assert.deepEqual(left, [], 'English left in the Russian answers');
  } finally {
    setLang('en');
    applyDataLocale('en');
  }
});
