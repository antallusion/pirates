// QA for «в сети» (owner, 2026-10-29): a fresh database of saved captains for the local server (node this <db path>),
// then, with the server up, two game clients that stay connected and post on the forum as members
// (node this <db path> clients <port>). The offline captains fill the rating; the two live ones are the «в сети».
import { PROTOCOL_VERSION } from '../../../shared/src/constants.ts';
import { Database } from '../../../server/src/persistence/db.ts';

const [dbPath, mode, port] = process.argv.slice(2);
const NAMES = ['Чёрный Барт', 'Elordaert', 'Морская Ведьма', 'Капитан Крюк', 'Нефигугум', 'Grace O’Malley', 'Сайлас Грей', 'Old Gunner', 'Рыжая Мэри', 'Iron Jaw', 'Тихий Ветер', 'Salt Wraith'];
const CAPS = ['corsair', 'reaver', 'smuggler', 'navigator', 'drowned', 'admiral'];

if (mode !== 'clients') {
  const db = new Database(dbPath);
  NAMES.forEach((n, i) => {
    const id = db.createAccount(n, `qa-${i}-${Math.random()}`);
    db.saveCaptain(id, { captain: CAPS[i % CAPS.length], level: 30 - i * 2, xp: 0, stats: { boarded: 40 - i * 3 }, throne: { rank: i < 3 ? 5 - i : 0 } }, 0, 0, 0);
  });
  console.log(`seeded ${NAMES.length} captains in ${dbPath}`);
  process.exit(0);
}

const LIVE = [['Анна Бонни', 'smuggler'], ['Jack Rackham', 'reaver']] as const;
const url = `ws://127.0.0.1:${port}/ws`;
for (const [name, captain] of LIVE) {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name }));
  ws.onmessage = async (ev) => {
    if (ev.data instanceof ArrayBuffer) return;
    const m = JSON.parse(String(ev.data));
    if (m.t !== 'welcome') return;
    if (!m.hasCaptain) ws.send(JSON.stringify({ t: 'create_captain', captain, shipName: 'Wake' }));
    await new Promise((r) => setTimeout(r, 1500));
    // a topic on the forum, so the member and her online dot show
    const r = await fetch(`http://127.0.0.1:${port}/api/forum/topic`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${m.token}` },
      body: JSON.stringify({ section: 'general', title: `${name}: кто со мной в рейд?`, body: 'Собираю команду на вечер, пишите в игре.', website: '', t: 9000 }),
    });
    console.log(`${name}: in the game (#${m.accountId}), forum topic ${r.status}`);
  };
  ws.onclose = () => console.log(`${name}: closed`);
}
setInterval(() => {}, 60_000);
