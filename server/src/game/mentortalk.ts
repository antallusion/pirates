// What the mentors say of themselves, with no model behind them (owner, 2026-11-13: «хочу зайти чтобы там все чета
// писали, общались периодически и я видел чат»): the world chat is never left silent. Three kinds of line —
//  - a tip out of the Pilot's Book (an article's own summary, so it is always true of the game);
//  - talk among the three (a short exchange, each in his or her own voice);
//  - what the mentor is really doing (her level, the port she lies in, the ships she has sunk) —
// and the answers: a greeting, who they are (the game's helpers, an AI — never passed off as people), and a question
// answered by the article of the Pilot's Book whose words it names.

import { GUIDE } from '../../../shared/src/data/guide/index.ts';

/** A line of an exchange: who (the mentor's index) and what. */
export type TalkLine = readonly [who: 0 | 1 | 2, text: string];

/** Talk among the three: 0 Сильвер (the gruff old corsair), 1 Мэй (the cheerful navigator), 2 Гром (the loud reaver). */
export const TALKS: readonly (readonly TalkLine[])[] = [
  [[1, 'Сильвер, ты опять с утра ворчишь на ветер?'], [0, 'Ветер встречный, Мэй. Ворчу по делу: галсами идти — только время терять.'], [2, 'А я паруса убрал и жду пиратов. Сами приплывут!']],
  [[2, 'Кто видел логово тварей у ближнего острова? Хочу размяться!'], [1, 'Гром, сначала глянь на уровень логова, а то опять без команды вернёшься :)'], [0, 'Дело говорит. Раненых потом в порту неделю лечить.']],
  [[0, 'Салаги, запомните: провизия кончилась — команда разбежалась. Берите с запасом.'], [1, 'И воду не забывайте! На дальний переход я беру вдвое больше.']],
  [[1, 'Нашла сегодня бутылку с картой у рифа. Обожаю клады :chest:'], [2, 'Клады — это хорошо, а добрый абордаж лучше!'], [0, 'Одно другому не мешает. Карту — в сундук, саблю — в руку.']],
  [[2, 'Эй, наставники, кто быстрее до порта — на бочонок рома?'], [0, 'Я своё отбегал, Гром. Иду на половине парусов и всем советую: корпус целее.'], [1, 'А я согласна! Только чур по ветру :wind:']],
  [[0, 'Цены в портах меняются каждые восемь часов. Кто торгует — заглядывайте на рынки почаще.'], [1, 'Точно! Ром и жемчуг сейчас гуляют сильнее всего. Купить дёшево, продать дорого — вся наука.']],
  [[1, 'Новичкам: свой остров — это не просто дом. Лесопилка и ферма кормят корабль, пока вы в море.'], [2, 'А казарма даёт бойцов для абордажа! Стройте казарму!'], [0, 'Сначала ратушу поднимите, строители.']],
  [[2, 'Потопил пирата — а он оказался с полным трюмом! Вот это день!'], [1, 'Поздравляю, Гром! Только не вези всё разом: перегруз — корабль еле ползёт.']],
  [[0, 'Кто идёт в бой — заряжайте книппели по парусам, а ядра оставьте для корпуса.'], [2, 'А картечь — по команде, перед абордажем! Люблю картечь!'], [1, 'Вы двое как учебник по артиллерии, честное слово :)']],
  [[1, 'Туман сегодня над морем… В тумане легко проскочить мимо патруля.'], [0, 'И так же легко налететь на риф. Смотри на карту, штурман.'], [1, 'Я и есть карта, Сильвер :compass:']],
  [[2, 'Кому скучно одному — собирайте группу! Вместе и босса завалить можно.'], [0, 'И добычу делить придётся. Но на босса в одиночку идти — дурь.']],
  [[0, 'Чинитесь в порту, а не в бою. Ремкомплект в море — это на крайний случай.'], [1, 'И якорь бросайте, когда отходите от экрана. Течение унесёт!']],
  [[1, 'Сезонные испытания проверили? Там награды за самые обычные дела.'], [2, 'Я свои за день закрыл! Ну, почти.'], [0, 'Почти не считается, Гром.']],
  [[2, 'Шторм идёт! Кто смелый — в шторм рыба и обломки лучше!'], [1, 'А кто умный — паруса убавит, чтобы мачты не потерять.']],
  [[0, 'Вижу в море много новых флагов. Добро пожаловать, капитаны. Спрашивайте — подскажем.'], [1, 'Да, пишите прямо сюда или нам лично. Мы наставники, для того и ходим.']],
  [[1, 'Гром, а ты таланты распределил? У тебя три очка висят.'], [2, 'Всё в абордаж! Что тут думать!'], [0, 'А живучесть кто качать будет? Эх, молодёжь.']],
  [[2, 'Кто со мной на охоту за пиратами? Иду от порта на закат!'], [1, 'Удачи! Я пока товар развезу, догоню позже.']],
  [[0, 'Лоцманскую книгу читали? За каждый прочитанный раздел дают серебро.'], [1, 'По триста монет за раздел, между прочим. И знаний на целое плавание.']],
  [[1, 'Сегодня вытащила из воды моряков с обломков. Теперь у меня полная команда!'], [0, 'Спасённые — лучшие матросы. Помнят, кому жизнью обязаны.']],
  [[2, 'Гильдия — это сила! Вместе и торговать, и воевать веселее!'], [1, 'Мы свою зовём «Школа наставников». Как откроем — примем всех, кто попросит.']],
];

/** What a mentor says of the day's real doings (the words in {} filled in mentors.ts). */
export const DOINGS = {
  level: [
    ['Новый уровень — {lv}-й! Старый пёс ещё на что-то годен.', 'Взял {lv}-й уровень. Медленно, зато корпус цел.'],
    ['Ура, у меня {lv}-й уровень! Плыву дальше :star:', '{lv}-й уровень! Спасибо попутному ветру.'],
    ['{lv}-й уровень! Кто следующий на абордаж?!', 'Есть {lv}-й! Гром растёт!'],
  ],
  dock: [
    ['Зашёл в порт. Чинюсь, беру провизию и ядра.', 'Стою в порту. Кому совет нужен — пишите.'],
    ['Причалила — пополню запасы и снова в море.', 'Я в порту. Заодно гляну цены на рынке.'],
    ['Гром в порту! Чинюсь — и обратно в драку.', 'Стою у причала, латаю борта. Досталось сегодня!'],
  ],
  sea: [
    ['Вышел из порта. Иду не спеша, смотрю, кто балует в наших водах.', 'Снова в море. Половина парусов — и хватит.'],
    ['Вышла в море, ветер хороший! Иду вдоль берега.', 'Я снова в море. Если найду что интересное — расскажу.'],
    ['Отчалил! Пираты, берегитесь!', 'Я в море. Ищу, с кем подраться!'],
  ],
  sunk: [
    ['Ещё один пират на дне. Всего на моём счету {n}.', 'Потопил разбойника. Счёт — {n}.'],
    ['Отбилась от пирата! Уже {n} на счету.', 'Пират хотел мой груз, а пошёл ко дну. Счёт — {n} :cannon:'],
    ['На дно его! Уже {n}! Кто больше?!', 'Потопил ещё одного! Счёт — {n}!'],
  ],
} as const;

/** How each of them hands on a tip of the Pilot's Book. */
const TIP_LEAD = [
  ['Совет от старика:', 'Запомните, салаги:', 'Из Лоцманской книги:'],
  ['Подсказка дня:', 'А вы знали?', 'Из Лоцманской книги:'],
  ['Слушай сюда!', 'Совет от Грома:', 'Из Лоцманской книги:'],
] as const;

const pick = <T>(list: readonly T[], rnd: () => number): T => list[Math.floor(rnd() * list.length) % list.length];

/** The articles a line can carry whole. */
const TIPS = GUIDE.filter((a) => a.summary[1].length <= 190);

/** A tip: an article's summary under its title, in the mentor's voice. `skip`: the articles said lately. */
export function tipLine(who: number, rnd: () => number, skip: Set<string> = new Set()): { id: string; text: string } {
  const open = TIPS.filter((a) => !skip.has(a.id));
  const a = pick(open.length ? open : TIPS, rnd);
  return { id: a.id, text: `${pick(TIP_LEAD[who % 3], rnd)} ${a.summary[1]}` };
}

const words = (s: string): string[] => s.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/).filter((w) => w.length >= 3);
/** A word's stem, roughly: its first five letters (порт/порту/порты, абордаж/абордажа). */
const stem = (w: string): string => (w.length > 5 ? w.slice(0, 5) : w.length > 4 ? w.slice(0, 4) : w);

/** The article of the Pilot's Book a question is about: the most of its words among the article's tags and title. */
export function guideFor(question: string): { title: string; summary: string } | null {
  const q = new Set(words(question).map(stem));
  if (!q.size) return null;
  let best: (typeof GUIDE)[number] | null = null, top = 0;
  for (const a of GUIDE) {
    let n = 0;
    const tags = new Set(a.tags.flatMap(words).map(stem));
    for (const t of tags) if (q.has(t)) n += 2;
    for (const t of new Set(words(a.title[1]).map(stem))) if (q.has(t) && !tags.has(t)) n += 1;
    if (n > top) {
      top = n;
      best = a;
    }
  }
  return best && top >= 2 ? { title: best.title[1], summary: best.summary[1] } : null;
}

const HELLO = /(^|[^а-яa-z])(привет|здравств|здаров|здоров|хай|ку|добрый|доброе|доброй|hello|hi|hey)([^а-яa-z]|$)/i;
const THANKS = /(спасиб|благодар|спс|thanks|thank you)/i;
const WHO = /(ты бот|вы боты|ты живой|ты человек|вы люди|ты ии|ты ai|нейросет|ты кто|вы кто|кто ты|кто вы|are you (a )?(bot|human|real))/i;
const GUILD = /(гильди|guild)/i;
const GROUP = /(в группу|в пати|в поход|вместе|возьми меня|party|group)/i;
const BYE = /(^|[^а-я])(пока|до свидан|удачи всем|спокойной)([^а-я]|$)/i;

/** Is a line of the world chat one a mentor should answer with no model to judge it? A question, a greeting, a word of
 *  thanks, or one that names the mentors. */
export function forMentor(text: string): boolean {
  return text.includes('?') || HELLO.test(text) || THANKS.test(text) || WHO.test(text) || /наставни|сильвер|мэй|гром/i.test(text);
}

/** The answer with no model: who they are, a greeting, the guild and the group (the marks mentors.ts acts on), else
 *  the Pilot's Book's article. `dm`: a private line is always answered. Null: nothing to say. */
export function scriptedAnswer(who: number, name: string, text: string, rnd: () => number, dm = false): string | null {
  const i = who % 3;
  if (WHO.test(text)) return `${name}, я Наставник — помощник игры на основе ИИ, не человек. Хожу по морю, как все, и подсказываю. Живые капитаны тут рядом, в чате.`;
  if (GUILD.test(text) && /(прими|возьми|вступ|хочу|можно|позови|пригласи|join|invite)/i.test(text)) return `${name}, зову в «Школу наставников» — лови приглашение, как только гильдия будет открыта. [ГИЛЬДИЯ]`;
  if (GROUP.test(text) && /(прими|возьми|хочу|можно|позови|пригласи|пойд|го|join|invite)/i.test(text)) return `${name}, идём вместе — приглашение в группу отправил${i === 1 ? 'а' : ''}. [ГРУППА]`;
  const hit = text.replace(/[^а-яёa-z ]/gi, ' ').trim().split(/\s+/).length >= 2 ? guideFor(text) : null;
  if (hit) return `${name}, ${hit.summary.length <= 170 ? hit.summary : `${hit.summary.slice(0, 167)}…`} Подробнее — Лоцманская книга, «${hit.title}».`;
  if (THANKS.test(text)) return pick([[`${name}, не за что. Семь футов под килем.`], [`${name}, всегда рада помочь :)`], [`${name}, обращайся! Для того и ходим!`]][i], rnd);
  if (HELLO.test(text)) return pick([[`Здорово, ${name}. Спрашивай, если что неясно.`, `${name}, приветствую на борту.`], [`Привет, ${name}! Рада видеть в море :)`, `${name}, привет! Если нужна подсказка — пиши.`], [`${name}, здорово! Пошли пиратов бить!`, `Привет, ${name}! Гром на связи!`]][i], rnd);
  if (BYE.test(text)) return pick([[`${name}, попутного ветра.`], [`${name}, до встречи в море!`], [`${name}, бывай! Возвращайся с добычей!`]][i], rnd);
  if (text.includes('?') || dm) return `${name}, тут я точно не скажу. Загляни в Лоцманскую книгу (кнопка «?» в меню) или спроси на форуме игры — там отвечают разработчики.`;
  return null;
}
