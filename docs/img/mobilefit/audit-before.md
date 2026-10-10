# Mobile fit audit — before (2026-10-10)

Measured by `tools/mobile/fit/audit.mjs` (the meter `measure.js` runs in the page). Phones held sideways: 480×270, 568×320, 640×360, 740×360, 812×375, 844×390, 915×412; upright 375×812 and 270×480; tablet 820×1180; desk 1500×600 and 1440×900; RU and EN; every screen and window opened afresh at every size.

- **scroll** — measurements with a scroll box that overflows (in the window or around it) or a page that scrolls;
- **out** — words or taps past the screen; **cut** — words cut, ellipsised, clamped, clipped by a box, or spilling out of their own box;
- **taps** — tap targets under 36 px (under 32 px where the short side is under 360 px); **tiny** — words under 11 px (10 px below 360);
- **paged** — windows laid out in pages «‹ 1/3 ›» instead of a scroll (kit/fit.ts); **clean** — measurements with none of the above.
- Upright phones show the «turn your phone» prompt over everything (it is measured, the game under it is not counted).

## Totals per size

| size | measurements | scroll | out | cut | taps | tiny | paged | clean |
|---|---|---|---|---|---|---|---|---|
| 480x270 | 157 | 136 | 7 | 108 | 91 | 90 | 0 | 18 |
| 568x320 | 158 | 126 | 3 | 32 | 93 | 70 | 0 | 28 |
| 640x360 | 158 | 106 | 2 | 11 | 140 | 244 | 0 | 33 |
| 740x360 | 158 | 106 | 2 | 43 | 140 | 238 | 0 | 35 |
| 812x375 | 157 | 104 | 2 | 9 | 140 | 258 | 0 | 34 |
| 844x390 | 158 | 104 | 1 | 8 | 140 | 262 | 0 | 34 |
| 915x412 | 158 | 104 | 0 | 5 | 136 | 262 | 0 | 34 |
| 375x812 (turn-the-phone prompt) | 157 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 270x480 (turn-the-phone prompt) | 158 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 820x1180 | 158 | 106 | 0 | 80 | 467 | 231 | 0 | 24 |
| 1500x600 | 156 | 96 | 2 | 15 | 702 | 319 | 0 | 29 |
| 1440x900 | 156 | 84 | 18 | 0 | 702 | 319 | 0 | 28 |

**All phones held sideways** (1104 measurements): scroll **786** · out **17** · cut **216** · taps **880** · tiny **1424** · clean **216**

## Per screen, phones held sideways (all seven sizes, RU + EN)

| screen | measured | scroll | out | cut | taps | tiny | pages at 640×360 | share at 640×360 |
|---|---|---|---|---|---|---|---|---|
| login | 14 | 4 | 0 | 0 | 28 | 0 | 1 | 72% |
| login:account | 14 | 4 | 0 | 0 | 58 | 0 | 1 | 93% |
| captain | 14 | 14 | 0 | 0 | 0 | 20 | 1 | 100% |
| captain:drowned | 14 | 14 | 0 | 0 | 0 | 20 | 1 | 100% |
| prologue | 14 | 0 | 0 | 0 | 0 | 0 | 1 | 100% |
| levelup | 13 (+2 not opened) | 2 | 0 | 0 | 0 | 0 | 1 | 78% |
| port:market | 14 | 14 | 0 | 53 | 0 | 0 | 1 | 90% |
| port:shipyard | 14 | 14 | 0 | 4 | 0 | 28 | 1 | 90% |
| port:tavern | 14 | 14 | 0 | 5 | 0 | 0 | 1 | 90% |
| port:quests | 14 | 14 | 0 | 21 | 0 | 0 | 1 | 90% |
| port:harbour | 14 | 14 | 0 | 4 | 0 | 0 | 1 | 90% |
| port:colours | 14 | 14 | 0 | 4 | 0 | 0 | 1 | 90% |
| port:holdings | 14 | 14 | 0 | 4 | 0 | 0 | 1 | 90% |
| port:exchange | 14 | 14 | 0 | 4 | 0 | 0 | 1 | 90% |
| port:auction | 14 | 14 | 0 | 4 | 0 | 0 | 1 | 90% |
| port:dice | 14 | 14 | 0 | 4 | 0 | 0 | 1 | 90% |
| port:rumours | 14 | 14 | 0 | 4 | 0 | 100 | 1 | 90% |
| port:charts | 14 | 14 | 0 | 4 | 0 | 0 | 1 | 90% |
| port:army | 14 | 14 | 0 | 4 | 0 | 0 | 1 | 90% |
| port:pets | 14 | 14 | 0 | 19 | 0 | 0 | 1 | 90% |
| port:tattoo | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| depart | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 59% |
| hero:hero | 14 | 14 | 0 | 17 | 0 | 70 | 1 | 90% |
| hero:skills | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| hero:book:orders | 14 | 14 | 0 | 0 | 0 | 336 | 1 | 90% |
| hero:book:path | 14 | 14 | 0 | 0 | 0 | 68 | 1 | 90% |
| hero:book:guild | 14 | 2 | 0 | 0 | 0 | 0 | 1 | 90% |
| hero:gear:captain | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| hero:gear:ship | 14 | 4 | 0 | 0 | 0 | 0 | 1 | 90% |
| hero:gear:locker | 14 | 2 | 0 | 0 | 0 | 0 | 1 | 90% |
| hero:gear:shop | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| talents | 14 | 14 | 0 | 0 | 0 | 88 | 1 | 90% |
| talents:tree | 14 | 14 | 0 | 0 | 0 | 60 | 1 | 90% |
| options | 14 | 4 | 0 | 16 | 0 | 0 | 1 | 90% |
| options:ui | 14 | 14 | 0 | 5 | 133 | 0 | 1 | 90% |
| options:vision | 14 | 14 | 0 | 5 | 98 | 0 | 1 | 90% |
| options:sound | 14 | 14 | 0 | 5 | 40 | 0 | 1 | 90% |
| options:controls | 14 | 14 | 0 | 5 | 0 | 0 | 1 | 90% |
| map | 14 | 1 | 0 | 0 | 0 | 0 | 1 | 90% |
| journal:quests | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| journal:company:group | 14 | 14 | 0 | 0 | 98 | 0 | 1 | 90% |
| journal:company:law | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| journal:company:isles | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| journal:guild | 14 | 4 | 0 | 0 | 0 | 0 | 1 | 90% |
| journal:letters | 14 | 4 | 0 | 0 | 0 | 0 | 1 | 90% |
| journal:album:album | 14 | 14 | 0 | 0 | 0 | 150 | 1 | 90% |
| journal:album:career | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| menu | 14 | 4 | 0 | 0 | 0 | 0 | 1 | 90% |
| ship | 14 | 14 | 0 | 5 | 0 | 170 | 1 | 90% |
| crew | 14 | 14 | 0 | 0 | 0 | 64 | 1 | 90% |
| help | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| research | 14 | 14 | 3 | 3 | 0 | 0 | 1 | 90% |
| look | 14 | 14 | 11 | 11 | 182 | 0 | 1 | 90% |
| shop | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| toasts:port | 14 | 0 | 0 | 0 | 0 | 0 | 1 | 0% |
| throne:glory | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| throne:mastery | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| throne:trials | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| throne:seals | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| throne:raid | 14 | 14 | 0 | 0 | 0 | 56 | 1 | 90% |
| throne:citadels | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| throne:war | 14 | 4 | 0 | 0 | 0 | 0 | 1 | 90% |
| throne:contracts | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| throne:arena | 14 | 14 | 0 | 0 | 0 | 0 | 1 | 90% |
| sea | 14 | 2 | 0 | 2 | 0 | 5 | 1 | 100% |
| sea:menu | 14 | 2 | 0 | 1 | 0 | 0 | 1 | 69% |
| sea:news | 14 | 14 | 0 | 0 | 74 | 28 | 1 | 75% |
| chat | 14 | 0 | 3 | 0 | 104 | 0 | 1 | 21% |
| toasts:sea | 14 | 0 | 0 | 0 | 0 | 0 | 1 | 3% |
| lair-card | 14 (+4 not opened) | 8 | 0 | 0 | 20 | 0 | 1 | 10% |
| roam-card | 14 | 0 | 0 | 0 | 0 | 0 | 1 | 37% |
| lairchest | 14 | 0 | 0 | 0 | 10 | 0 | 1 | 17% |
| board-offer | 14 | 1 | 0 | 0 | 34 | 38 | 1 | 14% |
| sea:foe | 14 | 4 | 0 | 3 | 0 | 10 | 1 | 100% |
| battle | 14 | 0 | 0 | 0 | 0 | 20 | 1 | 100% |
| battle:book | 14 | 14 | 0 | 0 | 0 | 48 | 1 | 90% |
| battle:card | 14 | 2 | 0 | 0 | 1 | 0 | 1 | 68% |
| battle:end | 13 (+1 not opened) | 0 | 0 | 0 | 0 | 25 | 1 | 100% |
| land | 14 | 0 | 0 | 0 | 0 | 20 | 1 | 100% |

## What is left at 640x360 (RU)

- **login** — taps: 3
- **login:account** — taps: 6
- **captain** — scroll: #captain-list ↕533/247; #captain-detail ↕1372/247 · tiny: . > div.premium 10px «ПРЕМИУМ · РАВН»; . > div.premium 10px «ПРЕМИУМ · РАВН»
- **captain:drowned** — scroll: #captain-list ↕533/247; #captain-detail ↕1684/247 · tiny: . > div.premium 10px «ПРЕМИУМ · РАВН»; . > div.premium 10px «ПРЕМИУМ · РАВН»
- **port:market** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕1503/215
- **port:shipyard** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕570/215 · tiny: .rep-h > span.tag 9px «медленно · поч»; .rep-h > span.tag.tag-gold 9px «сразу · за сер»
- **port:tavern** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕297/215
- **port:quests** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕1107/215
- **port:harbour** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕1872/215
- **port:colours** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕289/215
- **port:holdings** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕1549/215
- **port:exchange** — scroll: .w-pane > div.w-chips ↔1119/528
- **port:auction** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕234/215
- **port:dice** — scroll: .w-pane > div.w-chips ↔1119/528
- **port:rumours** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕2511/215 · tiny: .poster > div.po-head 8.89619px «РАЗЫСКИВАЕТСЯ»; .poster > div.po-head 8.89734px «РАЗЫСКИВАЕТСЯ» (+8)
- **port:charts** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕589/215
- **port:army** — scroll: .w-pane > div.w-chips ↔1119/528
- **port:pets** — scroll: .w-pane > div.w-chips ↔1119/528; .w-pane > div.modal-body.w-body ↕228/215 · cut: .w-row-t > small «Ловит крыс: товары портя» …377/367; .w-row-t > small «Кричит, когда к вам пово» …390/367
- **port:tattoo** — scroll: #modal-panel > div.modal-body.tattoos ↕2382/258
- **depart** — scroll: .k-sheet-body > div.dp-list ↕100/97
- **hero:hero** — scroll: .w-pane > div.modal-body.w-body ↕1233/268 · cut: .hx-pick-t > small «Орудия +4%, перезарядка » 107×86/107×29 · tiny: .hx-set > small 10px «Все регалии: В»; .hx-set > small 10px «Все три: Атака» (+5)
- **hero:skills** — scroll: .w-pane > div.modal-body.w-body ↕1252/268
- **hero:book:orders** — scroll: .w-pane > div.modal-body.w-body ↕698/268; .modal-body > div.w-chips.hx-schools ↔935/520 · tiny: .hx-otag > span.tag 9px «Уровень 1»; .hx-otag > span.tag.battle 9px «В бою» (+22)
- **hero:book:path** — scroll: .w-pane > div.modal-body.w-body ↕1199/268 · tiny: .tb-store > span 10px «Воля»; .tb-store > b 10px «10» (+4)
- **hero:gear:captain** — scroll: .w-pane > div.modal-body.w-body ↕462/268
- **hero:gear:shop** — scroll: .w-pane > div.modal-body.w-body ↕461/268
- **talents** — scroll: #modal-panel > div.modal-body ↕2849/268 · tiny: .tal-main > div.tier-label 10px «Ярус 1 · 0 очк»; .tal-main > div.tier-label 10px «Ярус 2 · 5 очк» (+6)
- **talents:tree** — scroll: #modal-panel > div.modal-body ↕2974/268 · tiny: .tal-main > div.tier-label 10px «Ярус 1 · 0 очк»; .tal-main > div.tier-label 10px «Ярус 2 · 5 очк» (+4)
- **options:ui** — scroll: .modal-head > div.w-chips ↔714/526; #modal-panel > div.modal-body.w-body ↕732/263 · taps: 10
- **options:vision** — scroll: .modal-head > div.w-chips ↔714/526; #modal-panel > div.modal-body.w-body ↕378/263 · taps: 7
- **options:sound** — scroll: .modal-head > div.w-chips ↔714/526; #modal-panel > div.modal-body.w-body ↕480/263 · taps: 3
- **options:controls** — scroll: .modal-head > div.w-chips ↔714/526; #modal-panel > div.modal-body.w-body ↕2340/263
- **journal:quests** — scroll: .w-pane > div.modal-body.w-body ↕1560/268
- **journal:company:group** — scroll: .w-pane > div.w-chips ↔654/528; #company-body ↕988/215 · taps: 7
- **journal:company:law** — scroll: .w-pane > div.w-chips ↔654/528; #company-body ↕719/215
- **journal:company:isles** — scroll: .w-pane > div.w-chips ↔654/528; #company-body ↕2579/215
- **journal:album:album** — scroll: #company-body ↕2242/268 · tiny: .rn-piece > b.rn-n 10px «10»; .rn-piece > b.rn-n 10px «11» (+13)
- **journal:album:career** — scroll: #company-body ↕2117/268
- **ship** — scroll: #modal-panel > div.modal-body ↕1328/196 · cut: . > div.sub.ship-passive «Особенность: Мелководный» …520/492 · tiny: .stat-tile > span.stat-l 10px «Наибольшая ско»; .stat-tile > span.stat-l 10px «Скорость повор» (+15)
- **crew** — scroll: #modal-panel > div.modal-body ↕1494/268 · tiny: .stat-tile > span.stat-l 10px «На борту»; .stat-tile > span.stat-l 10px «Выучка» (+4)
- **help** — scroll: #modal-panel > div.modal-body ↕1635/258
- **research** — scroll: #modal-panel > div.modal-body.rs-body ↕1197/180
- **look** — scroll: #modal-panel > div.modal-body.looks ↕1051/258 · out: . > div.sub [20,67,844,81] · cut: . > div.sub «Ваш флаг виден над кораб» clipped by #modal-panel · taps: 13
- **shop** — scroll: #modal-panel > div.modal-body.pm-body ↕12498/257
- **throne:glory** — scroll: #modal-panel > div.modal-body.throne-win ↕531/238
- **throne:mastery** — scroll: #modal-panel > div.modal-body.throne-win ↕1454/238
- **throne:trials** — scroll: #modal-panel > div.modal-body.throne-win ↕1488/238
- **throne:seals** — scroll: #modal-panel > div.modal-body.throne-win ↕608/238
- **throne:raid** — scroll: #modal-panel > div.modal-body.throne-win ↕645/238
- **throne:citadels** — scroll: #modal-panel > div.modal-body.throne-win ↕1626/238
- **throne:contracts** — scroll: #modal-panel > div.modal-body.throne-win ↕1022/238
- **throne:arena** — scroll: #modal-panel > div.modal-body.throne-win ↕480/238
- **sea:news** — scroll: .k-sheet > div.k-sheet-body ↕605/190 · taps: 7 · tiny: .wp-top > b.wp-lbl 9.5px «Цель моря»; .so-btn > small 10px «14»
- **chat** — taps: 8
- **lair-card** — scroll: #advcard ↕86/82 · taps: 2
- **lairchest** — taps: 1
- **board-offer** — taps: 3 · tiny: .bo-st > b 9px «20»; .bo-st > b 9px «10» (+1)
- **sea:foe** — cut: .k-target > span.k-target-name ««Портовый волк»» …116/85
- **battle** — tiny: .tb-chip > b.tb-chip-men 10px «21»; .tb-chip > b.tb-chip-men 10px «20»
- **battle:book** — scroll: .k-sheet > div.k-sheet-body ↕1114/244 · tiny: .tb-store > b 10px «143»; .tb-store > small 8.33333px «/143» (+2)
- **land** — tiny: .tb-chip > b.tb-chip-men 10px «24»; .tb-chip > b.tb-chip-men 10px «25»

## What is left at 480x270 (RU)

- **login** — scroll: #screen-login ↕406/270 (around)
- **login:account** — scroll: #screen-login ↕660/270 (around)
- **captain** — scroll: #captain-list ↔1303/416
- **captain:drowned** — scroll: #captain-list ↔1303/416
- **port:market** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕1530/134 · cut: .w-title > span «Солтмарроу» …93/75; .w-row-t > b «Провизия» …60/33; .w-row-t > small «в трюме 10 · скоропортящ» …169/33 (+34)
- **port:shipyard** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕725/134 · cut: .w-title > span «Солтмарроу» …93/75 · tiny: .rep-h > span.tag 9px «медленно · поч»; .rep-h > span.tag.tag-gold 9px «сразу · за сер»
- **port:tavern** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕322/134 · cut: .w-title > span «Солтмарроу» …93/75
- **port:quests** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕1223/134 · cut: .w-title > span «Солтмарроу» …93/75; .w-row-t > b «Нехватка в порту Порто-Б» …217/162; .w-row-t > b «Подаяние для порта Рейве» …211/162 (+4)
- **port:harbour** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕2015/134 · cut: .w-title > span «Солтмарроу» …93/75
- **port:colours** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕352/134 · cut: .w-title > span «Солтмарроу» …93/75
- **port:holdings** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕1585/134 · cut: .w-title > span «Солтмарроу» …93/75
- **port:exchange** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕194/134 · cut: .w-title > span «Солтмарроу» …93/75
- **port:auction** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕252/134 · cut: .w-title > span «Солтмарроу» …93/75
- **port:dice** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕224/134 · cut: .w-title > span «Солтмарроу» …93/75
- **port:rumours** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕2732/134 · cut: .w-title > span «Солтмарроу» …93/75 · tiny: .poster > div.po-head 9.08813px «РАЗЫСКИВАЕТСЯ»; .poster > div.po-head 9.08813px «РАЗЫСКИВАЕТСЯ» (+8)
- **port:charts** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕647/134 · cut: .w-title > span «Солтмарроу» …93/75
- **port:army** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕168/134 · cut: .w-title > span «Солтмарроу» …93/75
- **port:pets** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔1119/368; .w-pane > div.modal-body.w-body ↕228/134 · cut: .w-title > span «Солтмарроу» …93/75; .w-row-t > small «Ловит крыс: товары портя» …377/207; .w-row-t > small «Кричит, когда к вам пово» …390/207 (+1)
- **port:tattoo** — scroll: #modal-panel > div.modal-body.tattoos ↕2412/177
- **depart** — scroll: .k-sheet > div.k-sheet-body ↕236/154; .k-sheet-body > div.dp-list ↕177/173
- **hero:hero** — scroll: .w-frame > nav.w-rail ↕214/187; .w-pane > div.modal-body.w-body ↕1466/187 · cut: .hx-pick-t > small «Ход в море +3%.» 28×57/28×29; .hx-pick-t > small «Орудия +4%, перезарядка » 69×129/69×29
- **hero:skills** — scroll: .modal-head > div.w-chips ↔450/365; .w-frame > nav.w-rail ↕214/187; .w-pane > div.modal-body.w-body ↕1573/187
- **hero:book:orders** — scroll: .w-frame > nav.w-rail ↕214/187; .w-pane > div.modal-body.w-body ↕792/187; .modal-body > div.w-chips.hx-schools ↔935/360 · tiny: .hx-otag > span.tag 9px «Уровень 1»; .hx-otag > span.tag.battle 9px «В бою» (+22)
- **hero:book:path** — scroll: .w-frame > nav.w-rail ↕214/187; .w-pane > div.modal-body.w-body ↕1512/187 · tiny: .tb-store > small 8.33333px «/50»; .tb-store > small 8.33333px «/82»
- **hero:book:guild** — scroll: .w-frame > nav.w-rail ↕214/187
- **hero:gear:captain** — scroll: .modal-head > div.w-chips ↔450/365; .w-frame > nav.w-rail ↕214/187; .w-pane > div.modal-body.w-body ↕590/187
- **hero:gear:ship** — scroll: .modal-head > div.w-chips ↔450/365; .w-frame > nav.w-rail ↕214/187; .w-pane > div.modal-body.w-body ↕299/187
- **hero:gear:locker** — scroll: .modal-head > div.w-chips ↔450/365; .w-frame > nav.w-rail ↕214/187
- **hero:gear:shop** — scroll: .modal-head > div.w-chips ↔450/365; .w-frame > nav.w-rail ↕214/187; .w-pane > div.modal-body.w-body ↕477/187
- **talents** — scroll: #modal-panel > div.modal-body ↕3041/187 · tiny: .talent-top > span.tag 9px «активный»; .talent-top > span.tag 9px «активный»
- **talents:tree** — scroll: #modal-panel > div.modal-body ↕3184/187
- **options** — scroll: #modal-panel > div.modal-body.w-body ↕268/187 · cut: .opt-row > span.opt-name «Звук» …31/22; .opt-row > span.opt-name «Музыка» …51/32; .opt-row > span.opt-name «Автоогонь» …68/66 (+1)
- **options:ui** — scroll: .modal-head > div.w-chips ↔714/372; #modal-panel > div.modal-body.w-body ↕768/182 · taps: 7
- **options:vision** — scroll: .modal-head > div.w-chips ↔714/372; #modal-panel > div.modal-body.w-body ↕378/182 · taps: 7
- **options:sound** — scroll: .modal-head > div.w-chips ↔714/372; #modal-panel > div.modal-body.w-body ↕492/182 · taps: 2
- **options:controls** — scroll: .modal-head > div.w-chips ↔714/372; #modal-panel > div.modal-body.w-body ↕2384/182
- **map** — scroll: .modal-head > div.w-chips ↔365/360
- **journal:quests** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.modal-body.w-body ↕1669/187
- **journal:company:group** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔654/368; #company-body ↕1198/134 · taps: 7
- **journal:company:law** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔654/368; #company-body ↕836/134
- **journal:company:isles** — scroll: .w-frame > nav.w-rail ↕266/187; .w-pane > div.w-chips ↔654/368; #company-body ↕2853/134
- **journal:guild** — scroll: .w-frame > nav.w-rail ↕266/187; #company-body ↕287/187
- **journal:letters** — scroll: .w-frame > nav.w-rail ↕266/187
- **journal:album:album** — scroll: .w-frame > nav.w-rail ↕266/187; #company-body ↕2726/187
- **journal:album:career** — scroll: .w-frame > nav.w-rail ↕266/187; #company-body ↕2262/187
- **menu** — scroll: #modal-panel > div.modal-body ↕790/187
- **ship** — scroll: #modal-panel > div.modal-body ↕1435/115 · cut: . > div.sub.ship-passive «Особенность: Мелководный» …520/332
- **crew** — scroll: #modal-panel > div.modal-body ↕1474/187 · tiny: .army-slot > i.army-tier 9px «••»
- **help** — scroll: #modal-panel > div.modal-body ↕1830/177
- **research** — scroll: #modal-panel > div.modal-body.rs-body ↕1375/53 · out: . > div.sub [20,64,581,78] · cut: . > div.sub «Опыт корабля открывает с» clipped by #modal-panel
- **look** — scroll: #modal-panel > div.modal-body.looks ↕1300/177 · out: . > div.sub [20,63,844,77] · cut: . > div.sub «Ваш флаг виден над кораб» clipped by #modal-panel · taps: 13
- **shop** — scroll: #modal-panel > div.modal-body.pm-body ↕13905/130
- **throne:glory** — scroll: #modal-panel > div.modal-body.throne-win ↕652/157
- **throne:mastery** — scroll: #modal-panel > div.modal-body.throne-win ↕2446/157
- **throne:trials** — scroll: #modal-panel > div.modal-body.throne-win ↕1692/157
- **throne:seals** — scroll: #modal-panel > div.modal-body.throne-win ↕723/157
- **throne:raid** — scroll: #modal-panel > div.modal-body.throne-win ↕692/157
- **throne:citadels** — scroll: #modal-panel > div.modal-body.throne-win ↕1996/157
- **throne:war** — scroll: #modal-panel > div.modal-body.throne-win ↕238/157
- **throne:contracts** — scroll: #modal-panel > div.modal-body.throne-win ↕1162/157
- **throne:arena** — scroll: #modal-panel > div.modal-body.throne-win ↕525/157
- **sea:menu** — scroll: .k-sheet > div.k-sheet-body ↕170/163 · cut: .k-btn > span.k-btn-l «Настройки» …73/60
- **sea:news** — scroll: .k-sheet > div.k-sheet-body ↕605/123 · taps: 1
- **chat** — out: #chat-send [420,140,517,174]; #chat-send > span [438,150,499,164] · taps: 6
- **lair-card** — scroll: #advcard ↕86/60
- **board-offer** — taps: 1 · tiny: .bo-st > b 9px «20»; .bo-st > b 9px «10»
- **sea:foe** — scroll: #hud-stack ↔277/150 · cut: .k-target > span.k-target-name ««Портовый волк»» …116/85
- **battle:book** — scroll: .k-sheet > div.k-sheet-body ↕1614/163 · tiny: .tb-store > small 8.33333px «/143»; .tb-store > small 8.33333px «/160»
- **battle:card** — scroll: .k-sheet > div.k-sheet-body ↕272/163 · taps: 1
