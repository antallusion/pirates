# GRAVETIDE — Технологический стек и структура проекта

## 1. Выбранный стек и обоснование

| Слой | Сейчас (Phase 1) | Цель | Почему |
|---|---|---|---|
| Язык | **TypeScript** везде (strict, `erasableSyntaxOnly`) | тот же | Один язык для клиента, сервера и общей симуляции. Модель паруса, статы и генерация мира исполняются одинаково на обеих сторонах |
| Рантайм сервера | **Node.js 22** с нативным запуском `.ts` (type stripping) | Node 22+ / выделенные сервисы, горячие места — Rust/Go по профилю | Нет шага сборки, быстрый цикл разработки, зрелый I/O |
| Транспорт | собственный **RFC 6455 WebSocket** (`server/src/net/websocket.ts`), JSON | тот же сокет + бинарный кодек, delta-снапшоты | Без зависимостей, полный контроль над фреймингом и лимитами |
| Хранилище | **`node:sqlite`** (WAL) за репозиторным API | **PostgreSQL + Redis** | Прототип без внешних сервисов; API репозитория не завязан на SQL-диалект |
| Клиент | **Canvas 2D**, DOM-UI, ES-модули без бандлера | **WebGL2** (PixiJS или свой слой) для воды и частиц; тот же DOM-UI | Canvas 2D хватает для top-down с освещением и туманом. Шейдерная вода — задача полировки (Phase 10) |
| Доставка клиента | сервер раздаёт `client/` и `shared/`, `.ts` на лету превращается в JS (`module.stripTypeScriptTypes`) | CDN + предсобранный бандл (esbuild) | Один и тот же исходник для браузера и Node |
| Тесты | **`node:test`**, интеграционные тесты сервера, Playwright e2e | + нагрузочные боты, soak-тесты зон | Встроено в Node, без зависимостей |
| Ассеты | **Higgsfield** (`gpt_image_2_5`, quality high, прозрачный фон для спрайтов) → `assets/manifest.json` | тот же пайплайн + ручная ретушь, атласы | Единый стиль по промпт-шаблонам из `06_ART_DIRECTION.md` |

> Прототип намеренно собран **без npm-зависимостей**: всё — стандартная библиотека Node 22 и браузера.
> `package.json` объявляет только dev-зависимости для проверки типов (`typescript`, `@types/node`).

### Почему не Unity/Godot/Unreal?

Требование — строго top-down камера, огромный серверно-авторитетный мир и логика, общая для клиента и сервера. Веб-клиент на TypeScript даёт мгновенный вход по ссылке, одну кодовую базу симуляции и простые обновления. Движок остаётся заменяемым: протокол и серверная симуляция от рендера не зависят, так что нативный клиент на Godot или Unity можно написать поверх того же `protocol.ts`.

## 2. Структура репозитория

```
pirates/
├── README.md                     — быстрый старт, управление, что реализовано
├── package.json                  — скрипты: start, dev, test, typecheck, check, bot, assets:fetch
├── tsconfig.json                 — strict, erasableSyntaxOnly, noEmit (проверка типов для всех слоёв)
├── assets/
│   └── manifest.json             — id ассета → локальный путь + URL Higgsfield CDN
├── docs/                         — Game Design Foundation и техдокументы (00–08)
├── shared/src/                   — общий детерминированный код (клиент + сервер)
│   ├── constants.ts              — тик, размеры мира, радиусы, кривая опыта, сутки
│   ├── math.ts, rng.ts           — геометрия, попадание в корпус-эллипс, seed-шум
│   ├── protocol.ts               — все сообщения клиент ↔ сервер
│   ├── data/                     — goods, ships (классы/орудия/ядра/модули), captains, talents, factions, stats
│   ├── sim/                      — sailing (полярная модель), wind, shipstats
│   └── world/                    — regions (регионы, ключевые порты), worldgen (острова, течения, nav-grid)
├── server/src/
│   ├── main.ts                   — HTTP + WebSocket, запуск мира, graceful shutdown
│   ├── auth.ts                   — гостевые аккаунты, токены (sha256)
│   ├── net/                      — websocket.ts (RFC 6455), static.ts (раздача клиента, strip TS)
│   ├── persistence/db.ts         — SQLite: accounts, captains, kv, ledger
│   └── game/
│       ├── Game.ts               — оркестратор: тик, сессии, interest, снапшоты, докинг, смерть, сохранение
│       ├── ship.ts               — серверная сущность корабля
│       ├── combat.ts             — залпы, баллистика, угол попадания, подсистемы, преступления
│       ├── boarding.ts           — абордаж: раунды, мораль, цена абордажа, добыча
│       ├── abilities.ts          — способности капитанов, отложенные удары
│       ├── npc.ts                — роли NPC, LOD, AI (лавировка, бой, бегство), Director, абстрактные рейды
│       ├── nav.ts                — A* + сглаживание, кэш маршрутов
│       ├── economy.ts            — рынки, цены, NPC-арбитраж
│       ├── ports.ts              — рынок, верфь, таверна, контракты, помилование, страхование
│       ├── player.ts             — сессия, профиль, прогрессия, репутация, доступ в порты
│       ├── weather.ts            — погода по регионам
│       └── spatial.ts            — пространственная хеш-сетка
├── client/
│   ├── index.html, styles.css    — оболочка и dark nautical gothic UI
│   └── src/
│       ├── main.ts               — поток экранов, ввод, модальные окна, главный цикл
│       ├── net.ts, state.ts      — соединение, реплика мира, интерполяция и экстраполяция
│       ├── assets.ts             — загрузка: локально → CDN → процедурный фолбэк
│       ├── render/               — renderer.ts (океан, острова, корабли, свет, погода), fx.ts (ядра, дым, взрывы)
│       └── ui/                   — hud, captain, port, talents, worldmap, dialogs, dom
├── tests/                        — node:test: sim, economy, game (интеграция), net (WebSocket)
└── tools/
    ├── bot.ts                    — безголовый клиент для нагрузки и смоук-тестов
    ├── e2e.mjs                   — Playwright: логин → капитан → порт → море → залп → карта → таланты
    └── fetch-assets.ts           — выкачать ассеты из CDN в assets/ (где сеть позволяет)
```

## 3. Конвенции кода

- **Только стираемый TypeScript**: без `enum`, `namespace` и parameter properties (`constructor(private x)`), потому что Node и сервер раздачи удаляют типы, не транспилируя код. Импорты пишутся с расширением `.ts`, типы импортируются через `import type`.
- Игровые данные живут в `shared/src/data/*` и не хардкодятся в системах. Системы читают модификаторы через `computeShipStats` и флаги (`Flag`).
- Каждое изменение серебра и груза идёт через серверную функцию с валидацией и записью в `ledger`.
- Новое сообщение протокола — это тип в `protocol.ts`, валидация в `Game.handle` и тест в `tests/game.test.ts`.
- Каждый новый ассет проходит вопрос из `06_ART_DIRECTION.md`: «Подходит ли это миру Pirate Gothic × Deep-Sea Horror?»

## 4. Команды

```bash
npm start            # сервер на :8080 (PORT, HOST, DB_PATH — переменные окружения)
npm run dev          # то же с --watch
npm test             # 23 теста
npm run typecheck    # tsc --noEmit по shared, server, client, tests, tools
npm run bot -- ws://localhost:8080/ws 30 reaver   # безголовый капитан на 30 с
node tools/e2e.mjs http://localhost:8080 screenshots
npm run assets:fetch # скачать спрайты из Higgsfield CDN в assets/
```
