# Mobile fit audit — ux2-before (2026-10-11)

Measured by `tools/mobile/fit/audit.mjs` (the meter `measure.js` runs in the page). Phones held sideways: 480×270, 568×320, 640×360, 740×360, 812×375, 844×390, 915×412; upright 375×812 and 270×480; tablet 820×1180; desk 1500×600 and 1440×900; RU and EN; every screen and window opened afresh at every size.

- **scroll** — measurements with a scroll box that overflows (in the window or around it) or a page that scrolls;
- **out** — words or taps past the screen; **cut** — words cut, ellipsised, clamped, clipped by a box, or spilling out of their own box;
- **taps** — tap targets under 36 px (under 32 px where the short side is under 360 px); **tiny** — words under 6 px (the owner’s phone minimum, 2026-10-11; under 11/10 px before); **big** — words over 14 px on a phone outside a heading;
- **paged** — windows laid out in pages «‹ 1/3 ›» instead of a scroll (kit/fit.ts); **clean** — measurements with none of the above.
- Upright phones show the «turn your phone» prompt over everything (it is measured, the game under it is not counted).

## Totals per size

| size | measurements | scroll | out | cut | taps | tiny | big | paged | clean |
|---|---|---|---|---|---|---|---|---|---|
| 480x270 | 82 | 48 | 0 | 3 | 21 | 0 | 97 | 0 | 28 |
| 844x390 | 82 | 43 | 0 | 0 | 27 | 0 | 290 | 0 | 23 |
| 1500x600 | 81 | 48 | 0 | 9 | 344 | 0 | 0 | 0 | 19 |

**All phones held sideways** (164 measurements): scroll **91** · out **0** · cut **3** · taps **48** · tiny **0** · big **387** · clean **51**

## Per screen, phones held sideways (all seven sizes, RU + EN)

| screen | measured | scroll | out | cut | taps | tiny | big | pages at 640×360 | share at 640×360 |
|---|---|---|---|---|---|---|---|---|---|
| login | 2 | 0 | 0 | 0 | 0 | 0 | 2 | – | –% |
| login:account | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| captain | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| captain:drowned | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| prologue | 2 | 0 | 0 | 0 | 0 | 0 | 1 | – | –% |
| levelup | 2 | 0 | 0 | 0 | 0 | 0 | 2 | – | –% |
| port:market | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| port:shipyard | 2 | 2 | 0 | 0 | 0 | 0 | 4 | – | –% |
| port:tavern | 2 | 1 | 0 | 0 | 0 | 0 | 2 | – | –% |
| port:quests | 2 | 2 | 0 | 1 | 0 | 0 | 6 | – | –% |
| port:harbour | 2 | 2 | 0 | 0 | 0 | 0 | 10 | – | –% |
| port:colours | 2 | 1 | 0 | 0 | 0 | 0 | 8 | – | –% |
| port:holdings | 2 | 2 | 0 | 0 | 0 | 0 | 2 | – | –% |
| port:exchange | 2 | 0 | 0 | 0 | 0 | 0 | 2 | – | –% |
| port:auction | 2 | 0 | 0 | 0 | 0 | 0 | 1 | – | –% |
| port:dice | 2 | 0 | 0 | 0 | 0 | 0 | 1 | – | –% |
| port:rumours | 2 | 2 | 0 | 0 | 0 | 0 | 4 | – | –% |
| port:charts | 2 | 2 | 0 | 0 | 0 | 0 | 3 | – | –% |
| port:army | 2 | 0 | 0 | 0 | 0 | 0 | 1 | – | –% |
| port:pets | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| port:tattoo | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| depart | 2 | 1 | 0 | 0 | 0 | 0 | 0 | – | –% |
| hero:hero | 2 | 2 | 0 | 0 | 0 | 0 | 11 | – | –% |
| hero:skills | 2 | 2 | 0 | 0 | 0 | 0 | 10 | – | –% |
| hero:book:orders | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| hero:book:path | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| hero:book:guild | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| hero:gear:captain | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| hero:gear:ship | 2 | 1 | 0 | 0 | 0 | 0 | 0 | – | –% |
| hero:gear:locker | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| hero:gear:shop | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| talents | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| talents:tree | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| options | 2 | 1 | 0 | 0 | 0 | 0 | 0 | – | –% |
| options:ui | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| options:vision | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| options:sound | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| options:controls | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| map | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| journal:quests | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| journal:company:group | 2 | 2 | 0 | 0 | 14 | 0 | 5 | – | –% |
| journal:company:law | 2 | 2 | 0 | 1 | 0 | 0 | 12 | – | –% |
| journal:company:isles | 2 | 2 | 0 | 0 | 0 | 0 | 40 | – | –% |
| journal:guild | 2 | 0 | 0 | 0 | 0 | 0 | 2 | – | –% |
| journal:letters | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| journal:album:album | 2 | 2 | 0 | 0 | 0 | 0 | 14 | – | –% |
| journal:album:career | 2 | 2 | 0 | 0 | 0 | 0 | 10 | – | –% |
| menu | 2 | 1 | 0 | 0 | 0 | 0 | 11 | – | –% |
| ship | 2 | 2 | 0 | 0 | 0 | 0 | 10 | – | –% |
| crew | 2 | 2 | 0 | 1 | 0 | 0 | 6 | – | –% |
| help | 2 | 2 | 0 | 0 | 0 | 0 | 4 | – | –% |
| research | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| look | 2 | 2 | 0 | 0 | 26 | 0 | 2 | – | –% |
| shop | 2 | 2 | 0 | 0 | 0 | 0 | 96 | – | –% |
| shop:topup | 2 | 1 | 0 | 0 | 0 | 0 | 10 | – | –% |
| toasts:port | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| throne:glory | 2 | 2 | 0 | 0 | 0 | 0 | 9 | – | –% |
| throne:mastery | 2 | 2 | 0 | 0 | 0 | 0 | 8 | – | –% |
| throne:trials | 2 | 2 | 0 | 0 | 0 | 0 | 24 | – | –% |
| throne:seals | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| throne:raid | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| throne:citadels | 2 | 2 | 0 | 0 | 0 | 0 | 24 | – | –% |
| throne:war | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| throne:contracts | 2 | 2 | 0 | 0 | 0 | 0 | 8 | – | –% |
| throne:arena | 2 | 2 | 0 | 0 | 0 | 0 | 2 | – | –% |
| sea | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| sea:menu | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| sea:news | 2 | 2 | 0 | 0 | 8 | 0 | 0 | – | –% |
| chat | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| chat:emotes | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| chat:card | 0 (+3 not opened) | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| chat:dm | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| toasts:sea | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| lair-card | 2 (+1 not opened) | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| roam-card | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| lairchest | 2 | 0 | 0 | 0 | 0 | 0 | 2 | – | –% |
| board-offer | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| sea:foe | 2 | 0 | 0 | 0 | 0 | 0 | 0 | – | –% |
| battle | 2 | 0 | 0 | 0 | 0 | 0 | 2 | – | –% |
| battle:book | 2 | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| battle:card | 2 | 0 | 0 | 0 | 0 | 0 | 12 | – | –% |
| battle:end | 2 | 0 | 0 | 0 | 0 | 0 | 2 | – | –% |
| land | 2 | 0 | 0 | 0 | 0 | 0 | 2 | – | –% |

## What is left at 844x390 (RU)

- **login** — big: #login-form > button.btn.btn-primary 15px «Отчалить госте»
- **prologue** — big: #prologue > p 20px «Солтмарроу. Ту»
- **levelup** — big: .lu-t > b 16.5px «Тактика»; .lu-t > b 16.5px «Логистика»
- **port:market** — scroll: .w-pane > div.modal-body.w-body ↕1182/299
- **port:shipyard** — scroll: .w-pane > div.modal-body.w-body ↕466/299 · big: . > b 16px «Починить»; .w-wb-t > b 16px «Канонерка»
- **port:tavern** — big: . > b 16px «Матросы»
- **port:quests** — scroll: .w-pane > div.modal-body.w-body ↕829/299 · big: .q-t > b 15px «Запечатанные п»; .q-t > b 15px «Очистить остро»; .q-t > b 15px «Рыбный день»
- **port:harbour** — scroll: .w-pane > div.modal-body.w-body ↕1211/299 · big: .card > h4.card-h 15px «Пороховая ночь»; .card > h4.card-h 15px «Грамоты о поми»; .card > h4.card-h 15px «Торговая лицен» (+7)
- **port:colours** — big: .fl-t > b 17px «Нейтральный»; .fl-t > b 17px «Город или гиль»; .fl-t > b 17px «Пиратский» (+1)
- **port:holdings** — scroll: .w-pane > div.modal-body.w-body ↕628/299 · big: .card > h4.card-h 15px «Права на промы»; .card > h4.card-h 15px «Склад»
- **port:exchange** — big: .card > h4.card-h 15px «Форвардные кон»; .card > h4.card-h 15px ««Золочёная кни»
- **port:auction** — big: .card > h4.card-h 15px «Плавучий базар»
- **port:dice** — big: .card > h4.card-h 15px «Кости мертвеца»
- **port:rumours** — scroll: .w-pane > div.modal-body.w-body ↕1849/299 · big: .card > h4.card-h 15px «Слухи за ромом»; .card > h4.card-h 15px «Слухи за сереб»; .card > h4.card-h 15px «Наводки и писа» (+1)
- **port:charts** — scroll: .w-pane > div.modal-body.w-body ↕418/299 · big: .card > h4.card-h 15px «Картограф»; .card > h4.card-h 15px «Карты сокровищ»; .card > h4.card-h 15px «Доска карт»
- **port:army** — big: .card > h4.card-h 15px «Жилища»
- **port:tattoo** — scroll: #modal-panel > div.modal-body.tattoos ↕1458/342
- **depart** — scroll: .k-sheet > div.k-sheet-body ↕132/129
- **hero:hero** — scroll: .w-pane > div.modal-body.w-body ↕1172/342 · big: .hx-offer > h4.card-h 15px «Новый уровень:»; .hx-pick-t > b 15px «Тактика»; .hx-pick-t > b 15px «Логистика» (+3)
- **hero:skills** — scroll: .w-pane > div.modal-body.w-body ↕1051/342 · big: .sk-head > b 16px «Дисциплина бор»; .sk-head > b 16px «Двойной заряд»; .sk-head > b 16px «Руль на борт» (+2)
- **hero:book:orders** — scroll: .w-pane > div.modal-body.w-body ↕716/342
- **hero:book:path** — scroll: .w-pane > div.modal-body.w-body ↕978/342
- **hero:gear:captain** — scroll: .w-pane > div.modal-body.w-body ↕449/342
- **hero:gear:shop** — scroll: .w-pane > div.modal-body.w-body ↕435/342
- **talents** — scroll: .modal-body > div.tal-loadout ↕43/38; .tal-layout > div.tal-main ↕2060/280
- **talents:tree** — scroll: .modal-body > div.tal-loadout ↕43/38; .tal-layout > div.tal-main ↕2133/280
- **options:ui** — scroll: #modal-panel > div.modal-body.w-body ↕866/341
- **options:vision** — scroll: #modal-panel > div.modal-body.w-body ↕481/341
- **options:sound** — scroll: #modal-panel > div.modal-body.w-body ↕534/341
- **options:controls** — scroll: #modal-panel > div.modal-body.w-body ↕1906/341
- **journal:quests** — scroll: .w-pane > div.modal-body.w-body ↕1979/342
- **journal:company:group** — scroll: #company-body ↕851/299 · taps: 7 · big: .card > h4.card-h 15px «Пригласить кап»; .card > h4.card-h 15px «Ищу компанию»; .card > h4.card-h 15px «Друзья» (+2)
- **journal:company:law** — scroll: #company-body ↕588/299 · big: .card > h4.card-h 15px «Флаг»; .fl-t > b 16px «Нейтральный»; .fl-t > b 16px «Город или гиль» (+5)
- **journal:company:isles** — scroll: #company-body ↕2148/299 · big: .card-h > span 15px «Лантернхейвен »; . > span.muted 15px «— малый, 1 мес»; .card-h > span 15px «Лантернрич» (+37)
- **journal:guild** — big: .card > h4.card-h 15px «Основать гильд»; .card > h4.card-h 15px «Гильдии набира»
- **journal:album:album** — scroll: #company-body ↕1975/342 · big: .card-h > span 15px «Рыбы морей»; . > span.muted 15px «0 из 14»; .card-h > span 15px «Чудеса моря» (+11)
- **journal:album:career** — scroll: #company-body ↕1383/342 · big: .card-h > span 15px «Корона»; .card > div.rn-rank 17px «Звания пока не»; .card-h > span 15px «Лига» (+4)
- **ship** — scroll: #modal-panel > div.modal-body ↕1054/289 · big: .card > h4.card-h 15px «Флаг»; .fl-t > b 16px «Нейтральный»; .fl-t > b 16px «Город или гиль» (+3)
- **crew** — scroll: #modal-panel > div.modal-body ↕939/342 · big: .card > h4.card-h 15px «Армия»; .prof-row > b.prof-n 18px «18»; .card > h4.card-h 15px «Кодекс: доля к» (+2)
- **help** — scroll: #modal-panel > div.modal-body ↕1197/342 · big: .card > h4.card-h 15px «Первое плавани»; .card > h4.card-h 15px «Закон»; .card > h4.card-h 15px «Опасность» (+1)
- **research** — scroll: #modal-panel > div.modal-body.rs-body ↕996/305
- **look** — scroll: #modal-panel > div.modal-body.looks ↕974/342 · taps: 13 · big: .lk-preview > div.lk-name 16px «Весёлый Роджер»
- **shop** — scroll: #modal-panel > div.modal-body.pm-body ↕9662/342 · big: .pm-text > b.pm-name 16.5px «Бульдог»; .pm-price > span.dbl 16.5px «500»; .pm-text > b.pm-name 16.5px «Святой Эльм» (+93)
- **shop:topup** — big: .card > b.pm-pack-n 28px «100»; .card > b.pm-pack-n 28px «550»; .card > b.pm-pack-n 28px «1 200» (+2)
- **throne:glory** — scroll: #modal-panel > div.modal-body.throne-win ↕443/313 · big: .hx-offer > h4.card-h 15px «Ранг славы: вы»; .th-bt > b 15px «Атака»; .th-bt > b 15px «Защита» (+2)
- **throne:mastery** — scroll: #modal-panel > div.modal-body.throne-win ↕1298/336 · big: .card-h > span 17px «Адмирал»; .card-h > span 17px «Абордажник»; .card-h > span 17px «Мистик» (+1)
- **throne:trials** — scroll: #modal-panel > div.modal-body.throne-win ↕1189/336 · big: .th-tt > b 16px «Навигация»; .th-tt > b 16px «Артиллерия»; .th-tt > b 16px «Абордаж» (+9)
- **throne:seals** — scroll: #modal-panel > div.modal-body.throne-win ↕532/336
- **throne:raid** — scroll: #modal-panel > div.modal-body.throne-win ↕626/336
- **throne:citadels** — scroll: #modal-panel > div.modal-body.throne-win ↕1432/336 · big: .cit-name > b 16px «Форт Дрифтбэнк»; .cit-name > b 16px «Цитадель Силтх»; .cit-name > b 16px «Цитадель Галлр» (+9)
- **throne:contracts** — scroll: #modal-panel > div.modal-body.throne-win ↕854/336 · big: .th-medal > b 20px «0/3»; .adm-tt > b 15px «Спустить её фл»; .adm-tt > b 15px «Стены Престола» (+1)
- **throne:arena** — scroll: #modal-panel > div.modal-body.throne-win ↕444/336 · big: .th-medal > b 20px «1000»
- **sea:news** — scroll: .k-sheet > div.k-sheet-body ↕602/224 · taps: 7
- **lairchest** — big: . > div.enc-h 15px «Логово взято: »
- **battle** — big: .tb-rb > i.tb-x2 15px «×2»
- **battle:book** — scroll: .k-sheet > div.k-sheet-body ↕812/282
- **battle:card** — big: . > b 15px «22 / 28»; . > b 15px «23,3»; . > b 15px «22,4 −2%» (+3)
- **battle:end** — big: .tb-bsc > b 20px «Поражение»
- **land** — big: .tb-rb > i.tb-x2 15px «×2»

## What is left at 640x360 (RU)

Nothing.

## What is left at 480x270 (RU)

- **login** — big: #login-form > button.btn.btn-primary 15px «Отчалить госте»
- **port:market** — scroll: .w-pane > div.modal-body.w-body ↕1066/196
- **port:shipyard** — scroll: .w-pane > div.modal-body.w-body ↕542/196 · big: . > b 16px «Починить»; .w-wb-t > b 16px «Канонерка»
- **port:tavern** — scroll: .w-pane > div.modal-body.w-body ↕219/196 · big: . > b 16px «Матросы»
- **port:quests** — scroll: .w-pane > div.modal-body.w-body ↕830/196 · cut: .w-row-t > b «Срочно: запечатанные пис» …255/246 · big: .q-t > b 15px «Запечатанные п»; .q-t > b 15px «Очистить остро»; .q-t > b 15px «Рыбный день»
- **port:harbour** — scroll: .w-pane > div.modal-body.w-body ↕1184/196; .card > table.grid ↔230/183
- **port:colours** — scroll: .w-pane > div.modal-body.w-body ↕305/196 · big: .fl-t > b 16px «Нейтральный»; .fl-t > b 16px «Город или гиль»; .fl-t > b 16px «Пиратский» (+1)
- **port:holdings** — scroll: .w-pane > div.modal-body.w-body ↕993/196
- **port:rumours** — scroll: .w-pane > div.modal-body.w-body ↕2284/196
- **port:charts** — scroll: .w-pane > div.modal-body.w-body ↕369/196
- **port:tattoo** — scroll: #modal-panel > div.modal-body.tattoos ↕2503/233
- **hero:hero** — scroll: .w-pane > div.modal-body.w-body ↕1530/233 · big: .hx-pick-t > b 15px «Тактика»; .hx-pick-t > b 15px «Логистика»; .hx-face > span.hx-lv 15px «30» (+2)
- **hero:skills** — scroll: .w-pane > div.modal-body.w-body ↕1383/233 · big: .sk-head > b 16px «Дисциплина бор»; .sk-head > b 16px «Двойной заряд»; .sk-head > b 16px «Руль на борт» (+2)
- **hero:book:orders** — scroll: .w-pane > div.modal-body.w-body ↕744/233
- **hero:book:path** — scroll: .w-pane > div.modal-body.w-body ↕1314/233
- **hero:gear:captain** — scroll: .w-pane > div.modal-body.w-body ↕526/233
- **hero:gear:ship** — scroll: .w-pane > div.modal-body.w-body ↕264/232
- **hero:gear:shop** — scroll: .w-pane > div.modal-body.w-body ↕424/233
- **talents** — scroll: .modal-body > div.tal-loadout ↕39/34; .tal-layout > div.tal-main ↕2115/183
- **talents:tree** — scroll: .modal-body > div.tal-loadout ↕39/34; .tal-layout > div.tal-main ↕2222/183
- **options** — scroll: #modal-panel > div.modal-body.w-body ↕259/233
- **options:ui** — scroll: #modal-panel > div.modal-body.w-body ↕820/228
- **options:vision** — scroll: #modal-panel > div.modal-body.w-body ↕447/228
- **options:sound** — scroll: #modal-panel > div.modal-body.w-body ↕525/228
- **options:controls** — scroll: #modal-panel > div.modal-body.w-body ↕1843/228
- **journal:quests** — scroll: .w-pane > div.modal-body.w-body ↕1665/233
- **journal:company:group** — scroll: #company-body ↕1071/196 · taps: 7
- **journal:company:law** — scroll: #company-body ↕754/196 · cut: .fl-t > span.fl-whose «Флаг: Корона» …79/58 · big: .fl-t > b 16px «Нейтральный»; .fl-t > b 16px «Город или гиль»; .fl-t > b 16px «Пиратский» (+1)
- **journal:company:isles** — scroll: #company-body ↕1964/196
- **journal:album:album** — scroll: #company-body ↕2568/233
- **journal:album:career** — scroll: #company-body ↕2133/233 · big: .card > div.rn-rank 17px «Звания пока не»; .card > div.rn-rank 17px «Звания пока не»; .card > div.rn-rank 17px «Звания пока не»
- **menu** — scroll: #modal-panel > div.modal-body ↕790/233 · big: .menu-tile > span 15px «Карта»; .menu-tile > span 15px «Журнал»; .menu-tile > span 15px «Корабль» (+8)
- **ship** — scroll: #modal-panel > div.modal-body ↕1107/178 · big: .fl-t > b 16px «Нейтральный»; .fl-t > b 16px «Город или гиль»; .fl-t > b 16px «Пиратский» (+1)
- **crew** — scroll: #modal-panel > div.modal-body ↕871/233 · cut: .pr-row > span.pr-name «Морские пехотинцы» …129/64 · big: .prof-row > b.prof-n 18px «18»
- **help** — scroll: #modal-panel > div.modal-body ↕1436/233
- **research** — scroll: #modal-panel > div.modal-body.rs-body ↕1359/200
- **look** — scroll: #modal-panel > div.modal-body.looks ↕1312/233 · taps: 13 · big: .lk-preview > div.lk-name 16px «Весёлый Роджер»
- **shop** — scroll: #modal-panel > div.modal-body.pm-body ↕9101/232
- **shop:topup** — scroll: #modal-panel > div.modal-body.pm-body ↕525/232 · big: .card > b.pm-pack-n 24px «100»; .card > b.pm-pack-n 24px «550»; .card > b.pm-pack-n 24px «1 200» (+2)
- **throne:glory** — scroll: #modal-panel > div.modal-body.throne-win ↕547/219 · big: .th-bt > b 15px «Атака»; .th-bt > b 15px «Защита»; .th-bt > b 15px «Сила приказов» (+1)
- **throne:mastery** — scroll: #modal-panel > div.modal-body.throne-win ↕2316/219 · big: .card-h > span 17px «Адмирал»; .card-h > span 17px «Абордажник»; .card-h > span 17px «Мистик» (+1)
- **throne:trials** — scroll: #modal-panel > div.modal-body.throne-win ↕1585/219 · big: .th-tt > b 16px «Навигация»; .th-tt > b 16px «Артиллерия»; .th-tt > b 16px «Абордаж» (+9)
- **throne:seals** — scroll: #modal-panel > div.modal-body.throne-win ↕541/219
- **throne:raid** — scroll: #modal-panel > div.modal-body.throne-win ↕600/219
- **throne:citadels** — scroll: #modal-panel > div.modal-body.throne-win ↕1825/219 · big: .cit-name > b 16px «Форт Дрифтбэнк»; .cit-name > b 16px «Цитадель Силтх»; .cit-name > b 16px «Цитадель Галлр» (+9)
- **throne:contracts** — scroll: #modal-panel > div.modal-body.throne-win ↕905/219 · big: .th-medal > b 20px «0/3»; .adm-tt > b 15px «Спустить её фл»; .adm-tt > b 15px «Стены Престола» (+1)
- **throne:arena** — scroll: #modal-panel > div.modal-body.throne-win ↕469/219 · big: .th-medal > b 20px «1000»
- **sea:news** — scroll: .k-sheet > div.k-sheet-body ↕550/156 · taps: 1
- **lairchest** — big: . > div.enc-h 15px «Логово взято: »
- **battle** — big: .tb-rb > i.tb-x2 15px «×2»
- **battle:book** — scroll: .k-sheet > div.k-sheet-body ↕1603/196
- **battle:card** — big: . > b 15px «22 / 28»; . > b 15px «23,3»; . > b 15px «22,4 −2%» (+3)
- **battle:end** — big: .tb-bsc > b 15px «Поражение»
- **land** — big: .tb-rb > i.tb-x2 15px «×2»
