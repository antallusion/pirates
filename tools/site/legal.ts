// The game's legal documents (owner, 2026-10-20: «реквизиты возьми с fovgame.com и сделай все юридические страницы
// которые нужны. почта игры info@ и support@gravetidegame.com»). The seller is the same as fovgame.com's — the public
// details of its pages (fovgame.com/offer/, /privacy/, /terms/); the set is what a Russian online game that takes
// payments needs: the public offer, the terms of use (the game's rules and bans), the privacy policy (152-ФЗ), the
// consent to the processing of personal data, the cookie policy, the refunds, the details and contacts. Written for
// GRAVETIDE: doubloons, the Telegram Mini App and its Stars, the website's shop through YooKassa. RU is the binding
// text; the English pages say so. tools/site/build.ts renders them at /site/<doc>/ and /site/en/<doc>/.

type Tr = [string, string];

/** The seller (ИП) as fovgame.com shows it, and the game's own addresses. */
export const SELLER = {
  name: ['Sole proprietor Dmitry Vadimovich Spiridonov', 'ИП Спиридонов Дмитрий Вадимович'] as Tr,
  short: ['SP Spiridonov D. V.', 'ИП Спиридонов Д. В.'] as Tr,
  inn: '760806658219',
  ogrnip: '324762700012347',
  phone: '+7 (916) 793-88-45',
  telegram: '@deemkend',
  info: 'info@gravetidegame.com',
  support: 'support@gravetidegame.com',
  site: 'https://gravetidegame.com',
} as const;

/** The documents' date (owner's request: dated 2026-10-20). */
export const EDITION: Tr = ['Version of 20 October 2026', 'Редакция от 20 октября 2026 года'];

export type DocId = 'offer' | 'terms' | 'privacy' | 'consent' | 'cookies' | 'refunds' | 'contacts';
export const DOC_IDS: DocId[] = ['offer', 'terms', 'privacy', 'consent', 'cookies', 'refunds', 'contacts'];
export const DOC_TITLES: Record<DocId, Tr> = {
  offer: ['Public offer', 'Публичная оферта'],
  terms: ['Terms of use', 'Пользовательское соглашение'],
  privacy: ['Privacy policy', 'Политика конфиденциальности'],
  consent: ['Consent to data processing', 'Согласие на обработку персональных данных'],
  cookies: ['Cookie policy', 'Политика cookie'],
  refunds: ['Refunds', 'Возврат средств'],
  contacts: ['Details and contacts', 'Реквизиты и контакты'],
};

/** A section: its heading and paragraphs; a paragraph that is an array is a list. */
export type Section = [string, (string | string[])[]];
export interface Doc { lead: string; sections: Section[] }

const S = SELLER;
const who = (ru: boolean) => (ru ? `${S.name[1]} (ИНН ${S.inn}, ОГРНИП ${S.ogrnip})` : `${S.name[0]} (INN ${S.inn}, OGRNIP ${S.ogrnip})`);

/** The details block, both languages. */
export const REQUISITES = (ru: boolean): [string, string][] => ru
  ? [['Продавец', S.name[1]], ['ИНН', S.inn], ['ОГРНИП', S.ogrnip], ['Телефон / WhatsApp', S.phone], ['Telegram', S.telegram], ['Общие вопросы', S.info], ['Поддержка, платежи, возвраты, персональные данные', S.support], ['Сайт', S.site]]
  : [['Seller', S.name[0]], ['INN (tax number)', S.inn], ['OGRNIP (registration)', S.ogrnip], ['Phone / WhatsApp', S.phone], ['Telegram', S.telegram], ['General questions', S.info], ['Support, payments, refunds, personal data', S.support], ['Website', S.site]];

const RU: Record<DocId, Doc> = {
  offer: {
    lead: 'Договор о предоставлении права использования виртуальных предметов в онлайн-игре GRAVETIDE.',
    sections: [
      ['1. Общие положения', [
        `1.1. ${who(true)} (далее — Исполнитель) предлагает любому дееспособному физическому лицу (далее — Покупатель, Пользователь) заключить договор на условиях настоящей публичной оферты в соответствии со ст. 437 Гражданского кодекса Российской Федерации.`,
        `1.2. Оферта размещена на сайте ${S.site} (далее — Сайт) и относится к онлайн-игре GRAVETIDE (далее — Игра), доступной на Сайте в разделе ${S.site}/play и в мини-приложении Telegram @gravetide_bot.`,
        '1.3. Термины:',
        [
          'Виртуальные предметы — внутриигровая валюта «дублоны», премиум-капитаны, премиум-корабли и существа, ускорители, наборы, подписка, косметические предметы (звания, плашки, рамки, эмблемы и полотнища флагов, следы, эмоции, наряды) и иное цифровое содержимое Игры, предлагаемое за плату;',
          'Аккаунт — учётная запись Пользователя в Игре, определяемая ником капитана;',
          'Заказ — выбор Виртуального предмета и Аккаунта-получателя в магазине Сайта или в Игре;',
          'Акцепт — полное и безоговорочное принятие условий Оферты, которым считается оплата Заказа.',
        ],
        '1.4. Оплачивая Заказ, Покупатель подтверждает, что ознакомился с Офертой, Пользовательским соглашением, Политикой конфиденциальности и Политикой возврата и принимает их, а также даёт согласие на обработку своих персональных данных в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».',
      ]],
      ['2. Предмет договора', [
        '2.1. Исполнитель предоставляет Покупателю право использования выбранных Виртуальных предметов в Игре на Аккаунте-получателе, а Покупатель оплачивает Заказ по цене, указанной на Сайте или в Игре.',
        '2.2. Виртуальные предметы существуют только внутри Игры, не являются вещами или денежными средствами, не обмениваются обратно на деньги и не передаются между Аккаунтами, кроме случаев, прямо предусмотренных механикой Игры.',
        '2.3. Один дублон в магазине Сайта стоит один рубль; цены Виртуальных предметов в рублях равны их цене в дублонах в Игре.',
        '2.4. Договор является договором присоединения (ст. 428 ГК РФ).',
      ]],
      ['3. Порядок оформления и оплаты', [
        '3.1. Для покупки на Сайте Покупатель указывает ник капитана-получателя, выбирает Виртуальный предмет и переходит к оплате. Если предмет недоступен этому капитану (уже куплен, не достигнут нужный уровень, закончился сезон и т. п.), Сайт сообщает об этом до оплаты.',
        '3.2. Цены указаны в рублях Российской Федерации и могут быть изменены Исполнителем в одностороннем порядке; изменение не касается уже оплаченных Заказов.',
        '3.3. Оплата на Сайте принимается через платёжный сервис ЮKassa (ООО НКО «ЮМани»): банковскими картами МИР, Visa, MasterCard, через СБП и другими способами, которые сервис предлагает на странице оплаты.',
        '3.4. Покупки в мини-приложении Telegram оплачиваются звёздами Telegram (Telegram Stars) по правилам платформы Telegram.',
        '3.5. Заказ считается оплаченным с момента получения Исполнителем подтверждения от платёжного сервиса.',
        '3.6. Покупатель отвечает за правильность указанного ника: Виртуальный предмет зачисляется на тот Аккаунт, который указан в Заказе.',
      ]],
      ['4. Безопасность платежей', [
        '4.1. Оплата производится на защищённой странице платёжного сервиса. Данные банковской карты (номер, срок, код, имя держателя) Исполнителю не передаются и им не хранятся.',
      ]],
      ['5. Предоставление Виртуальных предметов', [
        '5.1. Виртуальный предмет зачисляется на Аккаунт-получатель автоматически после подтверждения оплаты.',
        '5.2. Предметы, которые по правилам Игры вручаются капитану на борту, вручаются так же, как при покупке в Игре: корабль — в порту (прежний корабль остаётся у причала), существа и припасы корабля — вне боя. Если капитан в момент оплаты не в Игре, в море или в бою, предмет ждёт его и вручается при входе в Игру, заходе в порт или окончании боя.',
        '5.3. Если предмет не может быть вручён по правилам Игры (например, у капитана нет свободного слота для существ), его стоимость зачисляется на Аккаунт дублонами, которыми Покупатель может распорядиться в Игре.',
        '5.4. Моментом исполнения обязательства Исполнителя считается зачисление Виртуального предмета или дублонов на Аккаунт.',
        `5.5. Если Виртуальный предмет не поступил в течение 72 часов после оплаты, Покупатель сообщает об этом на ${S.support}, указав номер Заказа.`,
      ]],
      ['6. Возврат', [
        '6.1. Виртуальные предметы — цифровое содержимое, предоставляемое сразу после оплаты, поэтому после зачисления на Аккаунт возврат денежных средств не производится, за исключением случаев, предусмотренных законодательством Российской Федерации и Политикой возврата.',
        `6.2. Порядок и сроки возврата изложены в Политике возврата (${S.site}/site/refunds/).`,
      ]],
      ['7. Права и ответственность сторон', [
        '7.1. Исполнитель обязуется предоставлять оплаченные Виртуальные предметы и поддерживать работу Игры, но не гарантирует её бесперебойную работу: возможны технические работы и перерывы.',
        '7.2. Исполнитель вправе изменять баланс, внешний вид и механику Игры, в том числе Виртуальных предметов, если это не лишает Покупателя самого оплаченного предмета.',
        '7.3. Покупатель отвечает за сохранность доступа к своему Аккаунту, электронной почте и средствам связи.',
        '7.4. При блокировке Аккаунта за нарушение Пользовательского соглашения стоимость Виртуальных предметов не возвращается.',
        '7.5. Стороны освобождаются от ответственности за неисполнение обязательств вследствие обстоятельств непреодолимой силы.',
      ]],
      ['8. Интеллектуальная собственность', [
        '8.1. Игра, её код, графика, тексты, музыка и товарные обозначения принадлежат Исполнителю либо используются им на законных основаниях. Покупатель получает только право использования Виртуальных предметов внутри Игры.',
      ]],
      ['9. Споры', [
        `9.1. Споры разрешаются переговорами. Претензия направляется на ${S.support} и рассматривается в течение 10 календарных дней.`,
        '9.2. При недостижении согласия спор рассматривается в суде в соответствии с законодательством Российской Федерации.',
      ]],
      ['10. Прочие условия', [
        '10.1. Исполнитель вправе изменять Оферту, публикуя новую редакцию на Сайте. Новая редакция действует с момента публикации и не распространяется на уже оплаченные Заказы.',
        '10.2. Недействительность отдельного положения Оферты не влечёт недействительности остальных.',
      ]],
    ],
  },
  terms: {
    lead: 'Правила использования игры GRAVETIDE, аккаунта, форума и чата.',
    sections: [
      ['1. Общие положения', [
        `1.1. Настоящее Соглашение регулирует отношения между ${who(true)} (далее — Администрация) и пользователем (далее — Пользователь) игры GRAVETIDE, сайта ${S.site}, форума и мини-приложения Telegram @gravetide_bot (далее — Сервис).`,
        '1.2. Начиная пользоваться Сервисом, Пользователь принимает Соглашение полностью. При несогласии Пользователь должен прекратить использование Сервиса.',
        '1.3. Игра бесплатна. Платные Виртуальные предметы приобретаются по условиям Публичной оферты.',
      ]],
      ['2. Аккаунт', [
        '2.1. Пользователь может играть под ником без регистрации, а затем привязать к аккаунту электронную почту, вход через внешний сервис (Google, GitHub, Discord) или Telegram, чтобы не потерять прогресс.',
        '2.2. Пользователь отвечает за сохранность пароля и ключа входа и за все действия, совершённые с его аккаунта.',
        '2.3. Ник не должен быть оскорбительным, вводить в заблуждение (выдавать себя за Администрацию или другого игрока) или нарушать права третьих лиц. Администрация вправе изменить такой ник.',
        '2.4. Передача, продажа и покупка аккаунтов, дублонов и Виртуальных предметов за реальные деньги вне Сервиса запрещены.',
      ]],
      ['3. Правила игры', [
        '3.1. Запрещается:',
        [
          'использовать читы, ботов, автокликеры, модификации клиента, ошибки Игры и иные способы получить нечестное преимущество;',
          'играть несколькими аккаунтами, чтобы передавать себе ресурсы, подыгрывать себе в рейтингах, Колизее и войнах гильдий;',
          'вмешиваться в работу серверов, подбирать пароли, атаковать Сервис, перехватывать чужие данные;',
          'оскорблять других игроков, разжигать ненависть, угрожать, преследовать;',
          'размещать спам, рекламу, мошеннические ссылки, материалы, запрещённые законодательством Российской Федерации;',
          'выдавать себя за Администрацию или модераторов;',
          'оформлять возврат платежа (чарджбэк) за полученные и использованные Виртуальные предметы в обход Политики возврата.',
        ],
        '3.2. О найденных ошибках просим сообщать Администрации на форуме или по почте, а не использовать их.',
      ]],
      ['4. Форум и чат', [
        '4.1. Пользователь сам отвечает за содержание своих сообщений.',
        '4.2. Администрация и модераторы вправе удалять сообщения, нарушающие Соглашение, и ограничивать доступ к форуму и чату.',
        '4.3. Размещая сообщение, Пользователь разрешает его показ другим пользователям Сервиса.',
      ]],
      ['5. Меры за нарушения и блокировка аккаунта', [
        '5.1. За нарушение Соглашения Администрация вправе по своему выбору: предупредить Пользователя, временно ограничить доступ к чату или форуму, отменить нечестно полученные ресурсы, дублоны, предметы и места в рейтингах, временно или навсегда заблокировать аккаунт.',
        '5.2. Мера выбирается по тяжести и повторности нарушения. Использование читов и ботов, мошенничество с платежами и продажа аккаунтов могут повлечь бессрочную блокировку с первого раза.',
        '5.3. При блокировке за нарушение стоимость Виртуальных предметов и дублонов не возвращается.',
        `5.4. Пользователь может обжаловать меру, написав на ${S.support} с указанием ника; ответ — в течение 10 рабочих дней.`,
      ]],
      ['6. Сервис «как есть»', [
        '6.1. Игра предоставляется «как есть». Администрация стремится к стабильной работе, но не гарантирует отсутствие ошибок и перерывов.',
        '6.2. Администрация вправе менять механику, баланс, контент и правила Игры и проводить технические работы.',
        '6.3. Виртуальные предметы и игровой прогресс не являются имуществом Пользователя и не имеют денежной стоимости вне Игры.',
      ]],
      ['7. Возраст', [
        '7.1. Если Пользователю нет 14 лет, использовать Сервис можно только с согласия родителей или законных представителей; покупки несовершеннолетний совершает в пределах, установленных законом, а до 14 лет — только с согласия родителей.',
      ]],
      ['8. Интеллектуальная собственность', [
        '8.1. Игра, её код, графика, тексты, музыка и товарные обозначения принадлежат Администрации либо используются ею на законных основаниях. Копирование и распространение без разрешения запрещены.',
        '8.2. Пользователь может делиться скриншотами и видео Игры, в том числе в стримах и роликах.',
      ]],
      ['9. Заключительные положения', [
        '9.1. Соглашение регулируется законодательством Российской Федерации.',
        '9.2. Администрация вправе изменять Соглашение, публикуя новую редакцию на Сайте.',
        `9.3. Вопросы по Соглашению направляются на ${S.info}, по поддержке — на ${S.support}.`,
      ]],
    ],
  },
  privacy: {
    lead: 'Как мы обрабатываем и защищаем персональные данные игроков и посетителей сайта.',
    sections: [
      ['1. Общие положения', [
        `1.1. Настоящая Политика действует в отношении всей информации, которую ${who(true)} (далее — Оператор) может получить о Пользователе при использовании сайта ${S.site}, игры GRAVETIDE (в том числе в разделе /play и в мини-приложении Telegram @gravetide_bot), форума и магазина (далее вместе — Сервис).`,
        '1.2. Политика разработана в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных».',
        '1.3. Использование Сервиса означает согласие Пользователя с Политикой. При несогласии Пользователь должен прекратить использование Сервиса.',
        '1.4. Политика не распространяется на сайты третьих лиц, на которые Пользователь может перейти по ссылкам из Сервиса.',
      ]],
      ['2. Какие данные мы обрабатываем', [
        '2.1. Данные, которые Пользователь сообщает сам:',
        [
          'ник капитана (имя аккаунта);',
          'адрес электронной почты — если Пользователь привязывает его к аккаунту или указывает для чека об оплате;',
          'пароль — хранится только в виде необратимого хеша, сам пароль Оператору недоступен;',
          'идентификатор и имя пользователя Telegram — при игре в мини-приложении или привязке Telegram;',
          'идентификатор и почта во внешнем сервисе входа (Google, GitHub, Discord) — при входе через него;',
          'сообщения на форуме и в игровом чате, данные гильдий и списка друзей;',
          'обращения в поддержку.',
        ],
        '2.2. Данные, которые появляются при игре: игровой прогресс и сохранения, достижения, места в рейтингах, история покупок (номер заказа, предмет, сумма, статус, идентификатор платежа).',
        '2.3. Технические данные: IP-адрес, сведения о браузере и устройстве, дата и время доступа, адреса посещённых страниц, данные локального хранилища браузера; обезличенная телеметрия производительности (частота кадров, время загрузки, ошибки) без привязки к личности.',
        '2.4. Данные банковских карт Оператор не получает и не хранит: оплата проходит на стороне платёжного сервиса.',
      ]],
      ['3. Цели и правовые основания обработки', [
        [
          'создание и работа игрового аккаунта, сохранение прогресса, вход с разных устройств;',
          'работа многопользовательской игры, рейтинга, форума, чата, гильдий и друзей;',
          'оформление и оплата заказов, зачисление Виртуальных предметов, учёт платежей, отправка чеков (54-ФЗ);',
          'связь с Пользователем, ответы на обращения, техническая поддержка;',
          'защита от мошенничества, читерства и нарушений Пользовательского соглашения;',
          'улучшение Сервиса на основе обезличенной статистики.',
        ],
        '3.1. Основания: согласие Пользователя, исполнение договора (Оферты и Пользовательского соглашения), исполнение обязанностей, возложенных законом (учёт расчётов и чеков).',
      ]],
      ['4. Cookie и локальное хранилище', [
        `4.1. Сервис использует локальное хранилище браузера и необходимые файлы cookie, чтобы сохранять вход в аккаунт, настройки и ник для магазина. Подробно — в Политике cookie (${S.site}/site/cookies/).`,
        '4.2. Сервис не использует рекламные cookie и сторонние системы веб-аналитики.',
      ]],
      ['5. Передача данных третьим лицам', [
        '5.1. Оператор не продаёт и не передаёт персональные данные третьим лицам, кроме случаев:',
        [
          'оплаты на сайте — платёжному сервису ЮKassa (ООО НКО «ЮМани») в объёме, необходимом для проведения платежа и отправки чека;',
          'игры и оплаты в Telegram — платформе Telegram по её правилам;',
          'входа через внешний сервис — этому сервису в объёме, необходимом для входа;',
          'отправки писем (подтверждение почты, восстановление пароля) — почтовому сервису, через который они отправляются;',
          'требований уполномоченных органов государственной власти Российской Федерации по основаниям и в порядке, установленным законодательством.',
        ],
        '5.2. Ник, уровень, места в рейтингах, гильдия, надетая косметика и сообщения на форуме и в общем чате видны другим игрокам и посетителям сайта — это часть работы Сервиса.',
      ]],
      ['6. Хранение и защита', [
        '6.1. Данные хранятся на серверах, которые использует Оператор, с соблюдением требований 152-ФЗ.',
        '6.2. Данные хранятся, пока существует аккаунт Пользователя, либо до отзыва согласия на обработку, если более долгий срок не требуется законом (например, для учёта платежей).',
        '6.3. Оператор принимает организационные и технические меры для защиты данных: шифрованное соединение (HTTPS), хеширование паролей и ключей входа, ограничение доступа к серверам.',
        '6.4. При утечке персональных данных Оператор уведомляет Пользователя и уполномоченный орган в порядке, установленном законом.',
      ]],
      ['7. Права Пользователя', [
        '7.1. Пользователь вправе получить сведения о своих данных, потребовать их уточнения, блокирования или уничтожения, отозвать согласие на обработку и удалить аккаунт.',
        `7.2. Запрос направляется на ${S.support} с адреса, привязанного к аккаунту, или с указанием ника. Оператор отвечает в течение 10 рабочих дней.`,
        '7.3. Пользователь вправе обжаловать действия Оператора в уполномоченный орган по защите прав субъектов персональных данных (Роскомнадзор) или в суд.',
      ]],
      ['8. Изменение Политики', [
        '8.1. Оператор вправе изменять Политику. Новая редакция вступает в силу с момента публикации на Сайте.',
      ]],
    ],
  },
  consent: {
    lead: 'Согласие пользователя игры GRAVETIDE на обработку персональных данных (ст. 9 Федерального закона № 152-ФЗ).',
    sections: [
      ['1. Кому даётся согласие', [
        `1.1. Пользователь, регистрируясь в игре GRAVETIDE, привязывая к аккаунту почту, Telegram или внешний сервис входа, оформляя заказ в магазине на сайте ${S.site} или направляя обращение, свободно, своей волей и в своём интересе даёт согласие ${who(true)} (далее — Оператор) на обработку своих персональных данных на условиях ниже.`,
      ]],
      ['2. Какие данные', [
        [
          'ник капитана, адрес электронной почты, идентификаторы Telegram и внешних сервисов входа;',
          'данные заказов: ник получателя, предмет, сумма, дата, номер заказа и платежа, почта для чека;',
          'игровые данные, сообщения форума и чата, обращения в поддержку;',
          'технические данные: IP-адрес, сведения о браузере и устройстве.',
        ],
      ]],
      ['3. Цели', [
        '3.1. Предоставление доступа к Игре и её функциям, исполнение Публичной оферты и Пользовательского соглашения, зачисление оплаченных предметов, отправка чеков, связь с Пользователем, поддержка, защита от мошенничества и нарушений правил.',
      ]],
      ['4. Действия с данными', [
        '4.1. Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передача (предоставление, доступ) в случаях, указанных в Политике конфиденциальности, обезличивание, блокирование, удаление, уничтожение — с использованием средств автоматизации и без них.',
        '4.2. Передача допускается только лицам, указанным в разделе 5 Политики конфиденциальности (платёжный сервис ЮKassa, платформа Telegram, сервисы входа и отправки писем), и в случаях, предусмотренных законом.',
      ]],
      ['5. Срок и отзыв', [
        '5.1. Согласие действует со дня его предоставления до удаления аккаунта или отзыва согласия, а данные о платежах — в течение срока, установленного законодательством о бухгалтерском учёте и налогах.',
        `5.2. Согласие может быть отозвано письмом на ${S.support} с адреса, привязанного к аккаунту, или с указанием ника. После отзыва Оператор прекращает обработку и уничтожает данные в течение 30 дней, кроме данных, которые он обязан хранить по закону; без обработки данных пользоваться аккаунтом станет невозможно.`,
      ]],
    ],
  },
  cookies: {
    lead: 'Какие cookie и данные браузера использует сайт и игра GRAVETIDE.',
    sections: [
      ['1. Что это', [
        '1.1. Cookie — небольшие файлы, которые сайт сохраняет в браузере. Локальное хранилище (localStorage) — похожее место в браузере, где страница хранит свои настройки.',
      ]],
      ['2. Что мы храним', [
        [
          'ключ входа в аккаунт — чтобы не вводить ник и пароль каждый раз (локальное хранилище);',
          'настройки игры: язык, звук, размер интерфейса, клавиши (локальное хранилище);',
          'ник капитана и почту для чека в магазине — чтобы не вводить их заново (локальное хранилище, только на вашем устройстве);',
          'служебные cookie панели администрации — только для администраторов игры;',
          'случайный идентификатор устройства для обезличенной телеметрии производительности — без связи с аккаунтом.',
        ],
        '2.1. Все эти данные необходимы для работы Сервиса. Рекламных cookie, cookie третьих лиц и систем веб-аналитики на сайте нет.',
      ]],
      ['3. Сторонние страницы', [
        '3.1. Страница оплаты ЮKassa и платформа Telegram — сторонние сервисы со своими правилами использования cookie.',
      ]],
      ['4. Как отключить', [
        '4.1. Cookie и локальное хранилище можно очистить или запретить в настройках браузера. После этого придётся входить в аккаунт заново, а настройки игры сбросятся.',
      ]],
    ],
  },
  refunds: {
    lead: 'Когда и как возвращаются деньги за покупки в GRAVETIDE.',
    sections: [
      ['1. Цифровые товары', [
        '1.1. Дублоны и Виртуальные предметы — цифровое содержимое, которое зачисляется на аккаунт сразу после оплаты. После зачисления и использования (дублоны потрачены, капитан выбран, корабль получен, наряд надет и т. п.) их стоимость не возвращается, кроме случаев, предусмотренных законом и этой Политикой.',
      ]],
      ['2. Когда деньги возвращаются', [
        [
          'оплата прошла, а предмет или дублоны не пришли на счёт капитана в течение 72 часов, и мы не можем зачислить их повторно;',
          'деньги списаны дважды за один заказ;',
          'техническая ошибка на нашей стороне не дала воспользоваться купленным.',
        ],
      ]],
      ['3. Ошибка в нике', [
        '3.1. Если покупка ушла не тому капитану, напишите нам: пока купленное не использовано, мы перенесём его на нужный аккаунт.',
      ]],
      ['4. Как обратиться', [
        `4.1. Напишите на ${S.support} с темой «Возврат»: номер заказа (он есть на странице магазина после оплаты), ник капитана, дата, сумма и способ оплаты. Мы ответим в течение 3 рабочих дней.`,
        '4.2. Покупки в мини-приложении Telegram за звёзды Telegram возвращаются звёздами на тот же аккаунт Telegram.',
      ]],
      ['5. Сроки', [
        '5.1. Одобренный возврат отправляется тем же способом, которым была оплата, в течение 10 рабочих дней после решения. Срок зачисления денег зависит от банка — обычно от 1 до 10 рабочих дней.',
        '5.2. Вместе с возвратом с игрового аккаунта списываются возвращённые дублоны и предметы, а также подарок первого пополнения, если он был получен с этой оплатой.',
      ]],
      ['6. Блокировка', [
        '6.1. При блокировке аккаунта за нарушение Пользовательского соглашения стоимость предметов не возвращается.',
      ]],
    ],
  },
  contacts: {
    lead: 'Кто продаёт и отвечает за игру GRAVETIDE и как с нами связаться.',
    sections: [
      ['Почта', [
        `Общие вопросы, сотрудничество, пресса — ${S.info}.`,
        `Поддержка: аккаунт, ошибки, платежи, возвраты, запросы о персональных данных — ${S.support}. Отвечаем в течение 3 рабочих дней.`,
        'В письме о покупке укажите ник капитана и номер заказа.',
      ]],
      ['Где ещё', [
        `Форум игры — ${S.site}/site/forum/; Telegram-бот игры — @gravetide_bot.`,
      ]],
    ],
  },
};

const EN: Record<DocId, Doc> = {
  offer: {
    lead: 'The agreement granting the right to use virtual items in the online game GRAVETIDE. The Russian text is binding; this is a translation.',
    sections: [
      ['1. General', [
        `1.1. ${who(false)} (the Seller) offers any legally capable individual (the Buyer, the User) to enter into an agreement on the terms of this public offer under Article 437 of the Civil Code of the Russian Federation.`,
        `1.2. The offer is published on ${S.site} (the Site) and concerns the online game GRAVETIDE (the Game), available at ${S.site}/play and in the Telegram mini app @gravetide_bot.`,
        '1.3. Terms:',
        [
          'Virtual items — the in-game currency «doubloons», premium captains, premium ships and creatures, boosters, bundles, the subscription, cosmetics (titles, plates, frames, flag emblems and cloths, trails, emotes, outfits) and other digital content of the Game offered for payment;',
          'Account — the User’s account in the Game, identified by the captain’s name;',
          'Order — a choice of a virtual item and of the recipient account in the Site’s shop or in the Game;',
          'Acceptance — the full and unconditional acceptance of the offer, which is the payment of an Order.',
        ],
        '1.4. By paying an Order the Buyer confirms having read and accepted this offer, the Terms of use, the Privacy policy and the Refund policy, and consents to the processing of personal data under Federal Law No. 152-FZ.',
      ]],
      ['2. Subject', [
        '2.1. The Seller grants the Buyer the right to use the chosen virtual items in the Game on the recipient account; the Buyer pays the Order at the price shown on the Site or in the Game.',
        '2.2. Virtual items exist only inside the Game, are neither goods nor money, are not exchanged back for money and are not transferred between accounts except where the Game’s mechanics provide for it.',
        '2.3. One doubloon costs one rouble in the Site’s shop; the rouble prices of virtual items equal their doubloon prices in the Game.',
        '2.4. This is a contract of adhesion (Article 428 of the Civil Code).',
      ]],
      ['3. Ordering and payment', [
        '3.1. To buy on the Site the Buyer enters the recipient captain’s name, chooses an item and proceeds to payment. If the item is not available to that captain (already owned, level not reached, season over, etc.), the Site says so before payment.',
        '3.2. Prices are in Russian roubles and may be changed by the Seller unilaterally; a change does not affect paid Orders.',
        '3.3. Payment on the Site is taken by the YooKassa payment service (YooMoney): by MIR, Visa and MasterCard cards, through the SBP and by other methods the service offers on its payment page.',
        '3.4. Purchases in the Telegram mini app are paid with Telegram Stars under Telegram’s rules.',
        '3.5. An Order is paid when the Seller receives the payment service’s confirmation.',
        '3.6. The Buyer is responsible for the name given: the item is credited to the account named in the Order.',
      ]],
      ['4. Payment security', [
        '4.1. Payment is made on the payment service’s secure page. Card details are never passed to or stored by the Seller.',
      ]],
      ['5. Delivery', [
        '5.1. A virtual item is credited to the recipient account automatically once the payment is confirmed.',
        '5.2. Items the Game hands to a captain aboard are handed over as an in-game purchase is: a ship in port (the old ship stays berthed there), creatures and ship’s supplies out of a fight. If the captain is offline, at sea or in a fight at the time of payment, the item waits and is delivered on the next login, on making port or when the fight is over.',
        '5.3. If an item cannot be handed over under the Game’s rules (e.g. no free slot for creatures), its price is credited to the account in doubloons for the Buyer to spend in the Game.',
        '5.4. The Seller’s obligation is fulfilled when the item or the doubloons are credited to the account.',
        `5.5. If an item has not arrived within 72 hours of payment, the Buyer writes to ${S.support} with the order number.`,
      ]],
      ['6. Refunds', [
        '6.1. Virtual items are digital content delivered right after payment; once credited, money is not refunded except as provided by Russian law and the Refund policy.',
        `6.2. See the Refund policy (${S.site}/site/en/refunds/).`,
      ]],
      ['7. Rights and liability', [
        '7.1. The Seller provides paid items and keeps the Game running but does not guarantee uninterrupted operation: maintenance and interruptions are possible.',
        '7.2. The Seller may change the Game’s balance, looks and mechanics, including those of virtual items, as long as the Buyer keeps the item paid for.',
        '7.3. The Buyer is responsible for keeping access to the account, e-mail and means of communication safe.',
        '7.4. If an account is banned for breaking the Terms of use, the price of virtual items is not refunded.',
        '7.5. The parties are not liable for failures caused by force majeure.',
      ]],
      ['8. Intellectual property', [
        '8.1. The Game, its code, art, texts, music and trademarks belong to the Seller or are used lawfully. The Buyer receives only the right to use virtual items inside the Game.',
      ]],
      ['9. Disputes', [
        `9.1. Disputes are settled by negotiation; a claim is sent to ${S.support} and answered within 10 calendar days.`,
        '9.2. Failing agreement, disputes go to court under the laws of the Russian Federation.',
      ]],
      ['10. Other', [
        '10.1. The Seller may change this offer by publishing a new version on the Site; it applies from publication and not to paid Orders.',
        '10.2. If one provision is invalid, the rest remain in force.',
      ]],
    ],
  },
  terms: {
    lead: 'The rules of the game GRAVETIDE, its accounts, forum and chat. The Russian text is binding; this is a translation.',
    sections: [
      ['1. General', [
        `1.1. These Terms govern the relations between ${who(false)} (the Administration) and a user (the User) of the game GRAVETIDE, the site ${S.site}, its forum and the Telegram mini app @gravetide_bot (the Service).`,
        '1.2. By using the Service the User accepts these Terms in full; a User who disagrees must stop using the Service.',
        '1.3. The Game is free to play. Paid virtual items are bought under the Public offer.',
      ]],
      ['2. Account', [
        '2.1. A User may play under a name without registration and later link an e-mail, an external sign-in (Google, GitHub, Discord) or Telegram to keep the progress.',
        '2.2. The User keeps the password and sign-in key safe and is responsible for everything done from the account.',
        '2.3. A name must not be offensive, misleading (posing as the Administration or another player) or infringe others’ rights; the Administration may change such a name.',
        '2.4. Selling or buying accounts, doubloons or virtual items for real money outside the Service is forbidden.',
      ]],
      ['3. Game rules', [
        '3.1. It is forbidden to:',
        [
          'use cheats, bots, auto-clickers, client modifications, the Game’s bugs or any other unfair advantage;',
          'play several accounts to pass resources to oneself or to boost one’s ratings, Colosseum or guild wars;',
          'interfere with the servers, guess passwords, attack the Service or intercept others’ data;',
          'insult other players, incite hatred, threaten or harass;',
          'post spam, advertising, scam links or material prohibited by Russian law;',
          'pose as the Administration or moderators;',
          'charge back a payment for virtual items received and used, bypassing the Refund policy.',
        ],
        '3.2. Please report bugs to the Administration on the forum or by e-mail instead of exploiting them.',
      ]],
      ['4. Forum and chat', [
        '4.1. Users are responsible for what they post.',
        '4.2. The Administration and moderators may delete messages breaking these Terms and restrict access to the forum and chat.',
        '4.3. By posting, the User allows the message to be shown to other users of the Service.',
      ]],
      ['5. Sanctions and account bans', [
        '5.1. For a breach the Administration may, at its choice: warn the User, temporarily restrict chat or forum access, cancel unfairly gained resources, doubloons, items and rating places, ban the account temporarily or permanently.',
        '5.2. The sanction depends on the severity and repetition. Cheats and bots, payment fraud and account trading may lead to a permanent ban on the first offence.',
        '5.3. On a ban for a breach, the price of virtual items and doubloons is not refunded.',
        `5.4. A User may appeal by writing to ${S.support} with the captain’s name; we answer within 10 working days.`,
      ]],
      ['6. The Service «as is»', [
        '6.1. The Game is provided «as is». The Administration strives for stable operation but does not guarantee the absence of errors and interruptions.',
        '6.2. The Administration may change the Game’s mechanics, balance, content and rules and carry out maintenance.',
        '6.3. Virtual items and progress are not the User’s property and have no monetary value outside the Game.',
      ]],
      ['7. Age', [
        '7.1. Users under 14 may use the Service only with the consent of their parents or guardians; minors make purchases within the limits set by law, and under 14 only with parental consent.',
      ]],
      ['8. Intellectual property', [
        '8.1. The Game, its code, art, texts, music and trademarks belong to the Administration or are used lawfully; copying and distribution without permission are forbidden.',
        '8.2. Users may share screenshots and videos of the Game, including streams.',
      ]],
      ['9. Final provisions', [
        '9.1. These Terms are governed by the laws of the Russian Federation.',
        '9.2. The Administration may change these Terms by publishing a new version on the Site.',
        `9.3. Questions about these Terms: ${S.info}; support: ${S.support}.`,
      ]],
    ],
  },
  privacy: {
    lead: 'How we process and protect the personal data of players and visitors. The Russian text is binding; this is a translation.',
    sections: [
      ['1. General', [
        `1.1. This policy covers all information ${who(false)} (the Operator) may receive about a User of ${S.site}, the game GRAVETIDE (including /play and the Telegram mini app @gravetide_bot), its forum and shop (together, the Service).`,
        '1.2. It is written under Federal Law No. 152-FZ of 27.07.2006 «On personal data».',
        '1.3. Using the Service means agreeing to this policy; a User who disagrees must stop using it.',
        '1.4. The policy does not cover third-party sites linked from the Service.',
      ]],
      ['2. What data we process', [
        '2.1. Data the User gives:',
        [
          'the captain’s name (account name);',
          'an e-mail address — if linked to the account or given for a payment receipt;',
          'a password — stored only as an irreversible hash;',
          'the Telegram user id and name — when playing in the mini app or linking Telegram;',
          'the id and e-mail at an external sign-in service (Google, GitHub, Discord) — when signing in with it;',
          'forum and chat messages, guild and friends data;',
          'support requests.',
        ],
        '2.2. Data that arises in play: progress and saves, achievements, rating places, purchase history (order number, item, amount, status, payment id).',
        '2.3. Technical data: IP address, browser and device details, access times, pages visited, browser local storage; anonymous performance telemetry (frame rate, loading times, errors) not tied to a person.',
        '2.4. The Operator neither receives nor stores card details: payment happens on the payment service’s side.',
      ]],
      ['3. Purposes and legal grounds', [
        [
          'creating and running the account, keeping progress, signing in from different devices;',
          'running the multiplayer game, ratings, forum, chat, guilds and friends;',
          'taking and paying orders, crediting virtual items, accounting for payments, sending receipts (54-FZ);',
          'contacting the User, answering requests, support;',
          'protection against fraud, cheating and breaches of the Terms of use;',
          'improving the Service with anonymous statistics.',
        ],
        '3.1. Grounds: the User’s consent, the performance of a contract (the Public offer and the Terms of use), legal obligations (accounting and receipts).',
      ]],
      ['4. Cookies and local storage', [
        `4.1. The Service uses browser local storage and necessary cookies to keep the sign-in, settings and the shop’s name field. See the Cookie policy (${S.site}/site/en/cookies/).`,
        '4.2. The Service uses no advertising cookies and no third-party web analytics.',
      ]],
      ['5. Sharing with third parties', [
        '5.1. The Operator does not sell or share personal data except:',
        [
          'for payments on the Site — with YooKassa (YooMoney) as needed for the payment and the receipt;',
          'for play and payments in Telegram — with Telegram under its rules;',
          'for an external sign-in — with that service as needed to sign in;',
          'for e-mails (address confirmation, password reset) — with the mail service that sends them;',
          'on lawful requests of the authorities of the Russian Federation.',
        ],
        '5.2. The name, level, rating places, guild, worn cosmetics and forum and public chat messages are visible to other players and site visitors as part of the Service.',
      ]],
      ['6. Storage and protection', [
        '6.1. Data is stored on servers the Operator uses, in line with 152-FZ.',
        '6.2. Data is kept while the account exists or until consent is withdrawn, unless the law requires longer (e.g. payment records).',
        '6.3. Protection measures: HTTPS, hashing of passwords and sign-in keys, restricted server access.',
        '6.4. In case of a data leak the Operator notifies the User and the authority as the law requires.',
      ]],
      ['7. The User’s rights', [
        '7.1. The User may obtain information on their data, demand its correction, blocking or destruction, withdraw consent and delete the account.',
        `7.2. Requests go to ${S.support} from the account’s e-mail or with the captain’s name; we answer within 10 working days.`,
        '7.3. The User may appeal to Roskomnadzor or to a court.',
      ]],
      ['8. Changes', [
        '8.1. The Operator may change this policy; a new version applies from publication on the Site.',
      ]],
    ],
  },
  consent: {
    lead: 'A GRAVETIDE user’s consent to the processing of personal data (Article 9 of Federal Law No. 152-FZ). The Russian text is binding; this is a translation.',
    sections: [
      ['1. To whom', [
        `1.1. By registering in GRAVETIDE, linking an e-mail, Telegram or an external sign-in, placing an order in the shop at ${S.site} or writing to support, the User freely, by their own will and in their own interest consents to ${who(false)} (the Operator) processing their personal data on the terms below.`,
      ]],
      ['2. What data', [
        [
          'the captain’s name, e-mail, Telegram and external sign-in ids;',
          'order data: recipient name, item, amount, date, order and payment numbers, e-mail for the receipt;',
          'game data, forum and chat messages, support requests;',
          'technical data: IP address, browser and device details.',
        ],
      ]],
      ['3. Purposes', [
        '3.1. Access to the Game and its features, performing the Public offer and the Terms of use, crediting paid items, sending receipts, contacting the User, support, protection against fraud and rule breaches.',
      ]],
      ['4. Actions', [
        '4.1. Collection, recording, systematisation, accumulation, storage, updating, retrieval, use, transfer (in the cases listed in the Privacy policy), anonymisation, blocking, deletion and destruction, automated or not.',
        '4.2. Transfer only to the parties named in section 5 of the Privacy policy (YooKassa, Telegram, sign-in and mail services) and where the law requires.',
      ]],
      ['5. Term and withdrawal', [
        '5.1. The consent is valid from when it is given until the account is deleted or the consent withdrawn; payment data is kept for the term required by accounting and tax law.',
        `5.2. To withdraw, write to ${S.support} from the account’s e-mail or with the captain’s name. The Operator then stops processing and destroys the data within 30 days, except data it must keep by law; without processing the account can no longer be used.`,
      ]],
    ],
  },
  cookies: {
    lead: 'Which cookies and browser data the GRAVETIDE site and game use. The Russian text is binding; this is a translation.',
    sections: [
      ['1. What they are', [
        '1.1. Cookies are small files a site stores in the browser. Local storage is a similar place where a page keeps its settings.',
      ]],
      ['2. What we keep', [
        [
          'the account sign-in key, so you need not sign in every time (local storage);',
          'game settings: language, sound, interface size, keys (local storage);',
          'the captain’s name and receipt e-mail in the shop, so you need not type them again (local storage, on your device only);',
          'service cookies of the admin panels — for the game’s administrators only;',
          'a random device id for anonymous performance telemetry, not linked to the account.',
        ],
        '2.1. All of this is necessary for the Service. There are no advertising cookies, third-party cookies or web analytics on the site.',
      ]],
      ['3. Third-party pages', [
        '3.1. The YooKassa payment page and Telegram are third-party services with their own cookie rules.',
      ]],
      ['4. How to turn them off', [
        '4.1. Cookies and local storage can be cleared or blocked in the browser settings; you will then have to sign in again and the game’s settings will reset.',
      ]],
    ],
  },
  refunds: {
    lead: 'When and how GRAVETIDE purchases are refunded. The Russian text is binding; this is a translation.',
    sections: [
      ['1. Digital goods', [
        '1.1. Doubloons and virtual items are digital content credited right after payment. Once credited and used (doubloons spent, a captain chosen, a ship received, an outfit worn, etc.) they are not refunded except as the law and this policy provide.',
      ]],
      ['2. When money is refunded', [
        [
          'the payment went through but the item or doubloons did not reach the captain within 72 hours and we cannot credit them again;',
          'one order was charged twice;',
          'a technical fault on our side kept the purchase from being used.',
        ],
      ]],
      ['3. A wrong name', [
        '3.1. If a purchase went to the wrong captain, write to us: while it is unused we move it to the right account.',
      ]],
      ['4. How to ask', [
        `4.1. Write to ${S.support} with the subject «Refund»: the order number (shown on the shop page after payment), the captain’s name, the date, the amount and the payment method. We answer within 3 working days.`,
        '4.2. Purchases in the Telegram mini app paid with Telegram Stars are refunded in Stars to the same Telegram account.',
      ]],
      ['5. How long it takes', [
        '5.1. An approved refund goes back the way the payment came within 10 working days of the decision; the bank usually takes 1 to 10 working days.',
        '5.2. The refunded doubloons and items are taken off the game account with it, and so is the first top-up’s gift if it came with that payment.',
      ]],
      ['6. Bans', [
        '6.1. If an account is banned for breaking the Terms of use, purchases are not refunded.',
      ]],
    ],
  },
  contacts: {
    lead: 'Who sells and runs GRAVETIDE and how to reach us.',
    sections: [
      ['E-mail', [
        `General questions, partnership, press — ${S.info}.`,
        `Support: account, bugs, payments, refunds, personal data requests — ${S.support}. We answer within 3 working days.`,
        'When writing about a purchase, give the captain’s name and the order number.',
      ]],
      ['Elsewhere', [
        `The game’s forum — ${S.site}/site/en/forum/; the game’s Telegram bot — @gravetide_bot.`,
      ]],
    ],
  },
};

export const LEGAL: Record<'ru' | 'en', Record<DocId, Doc>> = { ru: RU, en: EN };
