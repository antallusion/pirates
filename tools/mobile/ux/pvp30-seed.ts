// QA for the PvP points (owner, 2026-10-30; server/src/game/pvprank.ts): a fresh database of saved captains with this
// month's PvP tallies and a closed season (last month's top ten) for the local server. Usage:
//   node tools/mobile/ux/pvp30-seed.ts data/qa-pvp30.db
//   PORT=58820 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-pvp30.db node server/src/main.ts
//   GPORT=58820 node tools/mobile/ux/pvp30.mjs
import { Database } from '../../../server/src/persistence/db.ts';
import { monthOf } from '../../../shared/src/data/pvprank.ts';

const [dbPath] = process.argv.slice(2);
const NAMES = ['Чёрный Барт', 'Elordaert', 'Морская Ведьма', 'Капитан Крюк', 'Нефигугум', 'Grace O’Malley', 'Сайлас Грей', 'Old Gunner', 'Рыжая Мэри', 'Iron Jaw', 'Тихий Ветер', 'Salt Wraith'];
const CAPS = ['corsair', 'reaver', 'smuggler', 'navigator', 'drowned', 'admiral'];
const db = new Database(dbPath);
const m = monthOf(Date.now());
const tally = (pts: number, kills: number, deaths: number) => ({ pts, kills, sunk: Math.ceil(kills * 0.6), boarded: Math.floor(kills * 0.4), deaths, duels: Math.floor(kills / 3), assists: Math.floor(kills / 2) });
const ids: number[] = [];
NAMES.forEach((n, i) => {
  const id = db.createAccount(n, `qa-${i}-${Math.random()}`);
  ids.push(id);
  const pts = Math.max(0, 520 - i * 47), kills = Math.max(0, 34 - i * 3), deaths = 4 + ((i * 5) % 11);
  db.saveCaptain(id, {
    captain: CAPS[i % CAPS.length], level: 32 - i * 2, xp: 0, stats: { boarded: 40 - i * 3 },
    pvpr: { m, season: tally(pts, kills, deaths), all: tally(pts * 3 + 40, kills * 3 + 2, deaths * 2), streak: i % 4, best: 9 - (i % 5), recent: [] },
  }, 0, 0, 0);
});
const top = ids.slice(0, 10).map((acc, i) => ({ rank: i + 1, acc, name: NAMES[(i + 3) % NAMES.length], captain: CAPS[(i + 3) % CAPS.length], level: 30 - i, pts: 610 - i * 55, kills: 40 - i * 3, deaths: 5 + i, guild: null, ...(i < 3 ? { title: `pvp${i + 1}` } : {}) }));
db.setKv('pvprank', { v: 1, open: m, seasons: [{ m: m - 1, top, announced: true, done: true }] });
console.log(`seeded ${NAMES.length} captains and the season ${m - 1} in ${dbPath}`);
