// The forum's first day (docs/32_FORUM.md §5): the categories and sections in both tongues, and the pinned official
// welcome from the administration (account 0, «GRAVETIDE»). Written once, into an empty store.

import type { ForumStore } from './store.ts';

export const SYSTEM_ID = 0;
export const SYSTEM_NAME = 'GRAVETIDE';

type Tr = [string, string]; // [ru, en]

interface SeedSection { slug: string; icon: string; title: Tr; desc: Tr; staff?: boolean }
export const SEED: { slug: string; title: Tr; sections: SeedSection[] }[] = [
  {
    slug: 'news', title: ['Новости и обновления', 'News and updates'], sections: [
      { slug: 'news', icon: 'news', staff: true, title: ['Новости', 'News'], desc: ['Объявления команды GRAVETIDE: события, планы, важное.', 'Announcements from the GRAVETIDE team: events, plans, what matters.'] },
      { slug: 'patches', icon: 'scroll', staff: true, title: ['Списки изменений', 'Patch notes'], desc: ['Что изменилось в каждом обновлении игры.', 'What changed in every update of the game.'] },
    ],
  },
  {
    slug: 'guides', title: ['Гайды', 'Guides'], sections: [
      { slug: 'start', icon: 'guides', title: ['Новым капитанам', 'For new captains'], desc: ['Первые шаги: порт, команда, первый абордаж.', 'First steps: the port, the crew, the first boarding.'] },
      { slug: 'captains', icon: 'captains', title: ['Капитаны и навыки', 'Captains and skills'], desc: ['Классы, пути, книга приказов и артефакты.', 'Classes, paths, the order book and artifacts.'] },
      { slug: 'boarding', icon: 'boarding', title: ['Абордаж и армия', 'Boarding and the army'], desc: ['Отряды, тактика боя на гексах, логова и боссы.', 'Troops, tactics on the hexes, lairs and bosses.'] },
    ],
  },
  {
    slug: 'talk', title: ['Обсуждения', 'Discussions'], sections: [
      { slug: 'general', icon: 'forum', title: ['Общее обсуждение', 'General discussion'], desc: ['Всё об игре, что не уместилось в другие разделы.', 'Everything about the game that fits nowhere else.'] },
      { slug: 'ships', icon: 'ships', title: ['Корабли и верфь', 'Ships and the shipyard'], desc: ['Корпуса, пушки, исследования и сборки.', 'Hulls, guns, research and builds.'] },
      { slug: 'sea', icon: 'world', title: ['Море и острова', 'The sea and the islands'], desc: ['Карта приключений, дрейфы, личный остров.', 'The adventure map, drifts, your own island.'] },
      { slug: 'guilds', icon: 'anchor', title: ['Гильдии', 'Guilds'], desc: ['Набор в гильдии, союзы и войны.', 'Recruiting, alliances and wars.'] },
    ],
  },
  {
    slug: 'support', title: ['Ошибки и предложения', 'Bugs and suggestions'], sections: [
      { slug: 'bugs', icon: 'bugs', title: ['Ошибки', 'Bug reports'], desc: ['Нашли ошибку? Опишите, как её повторить, и приложите снимок экрана.', 'Found a bug? Tell us how to repeat it and attach a screenshot.'] },
      { slug: 'ideas', icon: 'quest', title: ['Предложения', 'Suggestions'], desc: ['Идеи для игры: что добавить и что улучшить.', 'Ideas for the game: what to add and what to improve.'] },
    ],
  },
  {
    slug: 'market', title: ['Торговля', 'Trade'], sections: [
      { slug: 'trade', icon: 'trade', title: ['Рынок', 'Market'], desc: ['Куплю, продам, обменяю: товары, корабли, услуги.', 'Buy, sell, swap: goods, ships, services.'] },
    ],
  },
  {
    slug: 'tavern', title: ['Таверна', 'Tavern'], sections: [
      { slug: 'offtopic', icon: 'offtopic', title: ['Флуд', 'Off-topic'], desc: ['Разговоры у очага обо всём на свете.', 'Talk by the hearth about anything at all.'] },
      { slug: 'art', icon: 'edit', title: ['Творчество', 'Fan art'], desc: ['Рисунки, рассказы, снимки и видео игроков.', 'Players’ drawings, stories, screenshots and videos.'] },
    ],
  },
];

export const WELCOME: { title: Tr; body: Tr } = {
  title: ['Добро пожаловать в таверну GRAVETIDE', 'Welcome to the GRAVETIDE tavern'],
  body: [
    `Капитаны, это **форум GRAVETIDE**: здесь говорят о море, кораблях, абордажах и о том, как сделать игру лучше.

### Как здесь всё устроено
- Входите тем же аккаунтом, что и в игре: подпись под сообщениями покажет вашего капитана, уровень и гильдию.
- Ранг на форуме растёт от сообщений и репутации — от юнги до адмирала.
- Нашли ошибку? Раздел «Ошибки»: что делали, что ждали, что случилось, и снимок экрана.

### Правила палубы
1. Уважайте друг друга: без оскорблений и травли.
2. Без рекламы и чужих ссылок.
3. Одна тема — один вопрос; ищите, прежде чем спрашивать.

Попутного ветра!`,
    `Captains, this is the **GRAVETIDE forum**: here we talk about the sea, ships, boardings and how to make the game better.

### How it works
- Sign in with your game account: the signature under your posts shows your captain, level and guild.
- Your forum rank grows with posts and reputation — from cabin boy to admiral.
- Found a bug? The «Bug reports» section: what you did, what you expected, what happened, and a screenshot.

### Rules of the deck
1. Respect each other: no insults, no harassment.
2. No advertising or links to other sites.
3. One topic, one question; search before you ask.

Fair winds!`,
  ],
};

/** Fills an empty store: the administration's account, the categories, the sections and the two welcomes (RU and EN). */
export function seed(store: ForumStore, now: number): boolean {
  if (store.categories().length) return false;
  store.tx(() => {
    store.addUser(SYSTEM_ID, SYSTEM_NAME, 'admin', now);
    let sort = 0;
    for (const c of SEED) {
      const cid = store.addCategory(c.slug, c.title[0], c.title[1], sort++);
      for (const s of c.sections) store.addSection(cid, s.slug, s.title, s.desc, s.icon, sort++, !!s.staff);
    }
    const news = store.sectionBySlug('news')!;
    for (const i of [1, 0]) {
      const tid = store.addTopic(news.id, SYSTEM_ID, WELCOME.title[i], now + (i === 0 ? 1 : 0));
      const p = store.addPost(tid, SYSTEM_ID, WELCOME.body[i], null, now + (i === 0 ? 1 : 0));
      store.touchTopic(tid, p.id, SYSTEM_ID, now + (i === 0 ? 1 : 0), true);
      store.setTopic(tid, { pinned: 1, official: 1 });
      store.setPost(p.id, { official: 1 });
      store.index('t', tid, WELCOME.title[i]);
      store.index('p', p.id, WELCOME.body[i]);
      store.bump(SYSTEM_ID, 'posts', 1);
      store.bump(SYSTEM_ID, 'topics', 1);
      store.bump(SYSTEM_ID, 'official', 1);
    }
  });
  return true;
}
