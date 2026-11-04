// The QA world for forum posts 66 and 69 (tools/mobile/ux/forum69.mjs): a forum as it was before the fix — players'
// replies inside a news topic, a quote, the administration's answer to one of them — so the server's boot carries them
// into the news' discussion; and a game account with a coarse name from before the filter, signed in by a known token,
// for /names fix and the free rename. Never a live database.
//   node tools/mobile/ux/forum69-seed.ts data/qa-f69
//   PORT=58830 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-f69/gravetide.db node server/src/main.ts
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { ForumStore } from '../../../server/src/forum/store.ts';
import { seed, SYSTEM_ID } from '../../../server/src/forum/seed.ts';
import { postThreads28 } from '../../../server/src/forum/posts28.ts';
import { plainText } from '../../../shared/src/forum/markdown.ts';
import { Database } from '../../../server/src/persistence/db.ts';
import { hashToken } from '../../../server/src/auth.ts';

const dir = resolve(process.argv[2] ?? 'data/qa-f69');
if (!/qa-/.test(dir)) throw new Error('a QA directory only (data/qa-…)');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

// ---- the forum before: no discussions, the talk inside the news
const store = new ForumStore(resolve(dir, 'forum.db'));
const t0 = Date.UTC(2026, 10, 1, 9);
seed(store, t0);
postThreads28(store, t0 + 60_000);
const news = store.sectionTopics(store.sectionBySlug('news')!.id, true, 0, 50).find((t) => t.title.startsWith('Подарок всем капитанам'))!;
const people: [number, string][] = [[101, 'Эдуард'], [102, 'Пофигум'], [103, 'Морская Ведьма']];
for (const [id, name] of people) store.addUser(id, name, 'user', t0);
const say = (author: number, body: string, at: number, replyTo: number | null = null): number => {
  const p = store.addPost(news.id, author, body, replyTo, at);
  store.touchTopic(news.id, p.id, author, at, false);
  store.index('p', p.id, plainText(body));
  store.bump(author, 'posts', 1);
  return p.id;
};
const H = 3_600_000;
const a = say(101, 'Спасибо за подарок! Мушкетёры пришли, серебро тоже.', t0 + 2 * H);
const b = say(102, `[quote=Эдуард #${a}]Спасибо за подарок![/quote]\nА у меня письмо пришло, но мушкетёров некуда посадить — места на борту нет.`, t0 + 3 * H, a);
say(SYSTEM_ID, 'Пофигум, мушкетёры ждут в письме, пока на борту не освободится слот и койки: освободите место — и заберите их из письма.', t0 + 4 * H, b);
say(103, 'Хорошо бы такие подарки на каждый праздник :)', t0 + 5 * H);
store.close();

// ---- the game: a captain named before the filter (her token known: the shots sign her in with it)
const db = new Database(resolve(dir, 'gravetide.db'));
db.createAccount('ПИДОРАС', hashToken('qa-forum69-token-0000000000'));
db.close();
console.log(`seeded ${dir}: news topic #${news.id} with 4 replies; account «ПИДОРАС» (token qa-forum69-token-0000000000)`);
