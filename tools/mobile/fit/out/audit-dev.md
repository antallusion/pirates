# Mobile fit audit — dev (2026-10-10)

Measured by `tools/mobile/fit/audit.mjs` (`measure.js` in the page). Landscape phones: 640×360, 740×360, 812×375, 844×390, 915×412; also 375×812, 820×1180, 1500×600, 1440×900; RU and EN.

- **scroll** — measurements (screen × size × language) at the phone sizes with a scroll box that overflows or a page that scrolls;
- **out / cut / <40 / <36 / tiny** — sums over the phone sizes: elements past the screen, cut or ellipsised text, tap targets under 40 and 36 px, text under 11 px;
- **share** — the window's share of the screen at 640×360; **desk** — measurements at the other sizes with something out or cut.

**Totals at the phone sizes** (78 measurements): scroll 10 · out 7 · cut 12 · <40 px 522 · <36 px 27 · text <11 px 55

| screen | measured | scroll (phones) | out | cut | <40 px | <36 px | tiny | share 640 | desk out/cut | 640×360 scroll |
|---|---|---|---|---|---|---|---|---|---|---|
| login | 1 | 0 | 0 | 0 | 4 | 3 | 0 | 58% | 0 | — |
| login:account | 1 | 0 | 0 | 0 | 8 | 6 | 0 | 84% | 0 | — |
| captain | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 100% | 0 | — |
| captain:drowned | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 100% | 0 | — |
| prologue | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 100% | 0 | — |
| levelup | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 77% | 0 | — |
| port:market | 1 | 0 | 0 | 0 | 17 | 0 | 0 | 100% | 0 | — |
| port:shipyard | 1 | 0 | 0 | 0 | 13 | 0 | 3 | 100% | 0 | — |
| port:tavern | 1 | 0 | 0 | 0 | 14 | 0 | 1 | 100% | 0 | — |
| port:quests | 1 | 0 | 0 | 0 | 15 | 0 | 0 | 100% | 0 | — |
| port:harbour | 1 | 0 | 0 | 0 | 13 | 0 | 0 | 100% | 0 | — |
| port:colours | 1 | 1 | 0 | 0 | 12 | 0 | 0 | 100% | 0 | ↕274/269 |
| port:holdings | 1 | 0 | 0 | 0 | 13 | 0 | 0 | 100% | 0 | — |
| port:exchange | 1 | 0 | 0 | 0 | 12 | 0 | 0 | 100% | 0 | — |
| port:auction | 1 | 0 | 0 | 0 | 13 | 0 | 0 | 100% | 0 | — |
| port:dice | 1 | 0 | 0 | 0 | 15 | 0 | 0 | 100% | 0 | — |
| port:rumours | 1 | 0 | 0 | 0 | 13 | 0 | 0 | 100% | 0 | — |
| port:charts | 1 | 0 | 0 | 0 | 14 | 0 | 0 | 100% | 0 | — |
| port:army | 1 | 0 | 0 | 0 | 13 | 0 | 0 | 100% | 0 | — |
| port:pets | 1 | 0 | 0 | 0 | 16 | 0 | 0 | 100% | 0 | — |
| port:tattoo | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 100% | 0 | — |
| depart | 1 | 1 | 0 | 0 | 3 | 0 | 0 | 57% | 0 | ↕100/97 |
| hero:hero | 1 | 0 | 0 | 3 | 5 | 0 | 0 | 100% | 0 | — |
| hero:skills | 1 | 0 | 0 | 1 | 6 | 0 | 0 | 100% | 0 | — |
| hero:book:orders | 1 | 1 | 0 | 1 | 10 | 0 | 6 | 100% | 0 | ↔738/540 |
| hero:book:path | 1 | 0 | 0 | 1 | 5 | 0 | 8 | 100% | 0 | — |
| hero:book:guild | 1 | 0 | 0 | 1 | 4 | 0 | 0 | 100% | 0 | — |
| hero:gear:captain | 1 | 0 | 0 | 1 | 6 | 0 | 0 | 100% | 0 | — |
| hero:gear:ship | 1 | 0 | 0 | 1 | 5 | 0 | 0 | 100% | 0 | — |
| hero:gear:locker | 1 | 0 | 0 | 1 | 5 | 0 | 0 | 100% | 0 | — |
| hero:gear:shop | 1 | 0 | 0 | 1 | 6 | 0 | 0 | 100% | 0 | — |
| talents | 1 | 0 | 3 | 0 | 4 | 0 | 0 | 100% | 0 | — |
| talents:tree | 1 | 0 | 3 | 0 | 4 | 0 | 0 | 100% | 0 | — |
| options | 1 | 0 | 0 | 0 | 12 | 0 | 0 | 100% | 0 | — |
| options:ui | 1 | 1 | 0 | 0 | 9 | 0 | 0 | 100% | 0 | ↔625/539 |
| options:vision | 1 | 1 | 0 | 0 | 14 | 6 | 0 | 100% | 0 | ↔625/539 |
| options:sound | 1 | 1 | 0 | 0 | 7 | 0 | 0 | 100% | 0 | ↔625/539 |
| options:controls | 1 | 1 | 0 | 0 | 11 | 0 | 0 | 100% | 0 | ↔625/539 |
| map | 1 | 0 | 0 | 0 | 6 | 0 | 0 | 100% | 0 | — |
| journal:quests | 1 | 0 | 0 | 0 | 5 | 0 | 0 | 100% | 0 | — |
| journal:company:group | 1 | 1 | 0 | 0 | 9 | 0 | 0 | 100% | 0 | ↔567/548 |
| journal:company:law | 1 | 1 | 0 | 0 | 7 | 0 | 0 | 100% | 0 | ↔567/548 |
| journal:company:isles | 1 | 1 | 0 | 0 | 7 | 0 | 0 | 100% | 0 | ↔567/548 |
| journal:guild | 1 | 0 | 0 | 0 | 4 | 0 | 0 | 100% | 0 | — |
| journal:letters | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 100% | 0 | — |
| journal:album:album | 1 | 0 | 0 | 0 | 5 | 0 | 0 | 100% | 0 | — |
| journal:album:career | 1 | 0 | 0 | 0 | 5 | 0 | 0 | 100% | 0 | — |
| menu | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 100% | 0 | — |
| ship | 1 | 0 | 0 | 0 | 4 | 0 | 9 | 100% | 0 | — |
| crew | 1 | 0 | 0 | 0 | 2 | 0 | 5 | 100% | 0 | — |
| help | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 100% | 0 | — |
| research | 1 | 0 | 0 | 0 | 6 | 0 | 0 | 100% | 0 | — |
| look | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 100% | 0 | — |
| shop | 1 | 0 | 0 | 0 | 5 | 0 | 0 | 100% | 0 | — |
| toasts:port | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 6% | 0 | — |
| throne:glory | 1 | 0 | 0 | 0 | 11 | 0 | 2 | 94% | 0 | — |
| throne:mastery | 1 | 0 | 0 | 0 | 12 | 0 | 0 | 100% | 0 | — |
| throne:trials | 1 | 0 | 0 | 0 | 11 | 0 | 0 | 100% | 0 | — |
| throne:seals | 1 | 0 | 0 | 0 | 12 | 0 | 0 | 100% | 0 | — |
| throne:raid | 1 | 0 | 0 | 0 | 12 | 0 | 0 | 100% | 0 | — |
| throne:citadels | 1 | 0 | 0 | 0 | 11 | 0 | 0 | 100% | 0 | — |
| throne:war | 1 | 0 | 0 | 0 | 10 | 0 | 1 | 100% | 0 | — |
| throne:contracts | 1 | 0 | 0 | 0 | 11 | 0 | 1 | 100% | 0 | — |
| throne:arena | 1 | 0 | 0 | 0 | 11 | 0 | 1 | 100% | 0 | — |
| sea | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 100% | 0 | — |
| sea:menu | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 67% | 0 | — |
| sea:news | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 75% | 0 | — |
| chat | 1 | 0 | 0 | 0 | 8 | 8 | 0 | 20% | 0 | — |
| toasts:sea | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 2% | 0 | — |
| lair-card | 0 (+1 not opened) | 0 | 0 | 0 | 0 | 0 | 0 | –% | 0 | — |
| roam-card | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 35% | 0 | — |
| lairchest | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 17% | 0 | — |
| board-offer | 1 | 0 | 0 | 0 | 3 | 3 | 3 | 14% | 0 | — |
| sea:foe | 1 | 0 | 1 | 1 | 1 | 0 | 3 | 100% | 0 | — |
| battle | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 100% | 0 | — |
| battle:book | 1 | 0 | 0 | 0 | 2 | 0 | 4 | 90% | 0 | — |
| battle:card | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 66% | 0 | — |
| battle:end | 1 | 0 | 0 | 0 | 0 | 0 | 4 | 100% | 0 | — |
| land | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 100% | 0 | — |

## Details at 640×360 (RU)

- **login** — <40: .row > button.btn.btn-small 34×34; .row > button.btn.btn-small 34×34; #login-name 271×36 (+1)
- **login:account** — <40: .row > button.btn.btn-small 34×30; .row > button.btn.btn-small 34×30; #login-account > summary 271×30 (+5)
- **captain** — <40: #ship-name 196×36; #pick-captain 206×38
- **captain:drowned** — <40: #ship-name 196×36; #pick-captain 206×38
- **levelup** — <40: .k-sheet-head > button.k-btn.k-btn--icon 38×38; .k-sheet-foot > button.k-btn.k-btn--secondary 280×38
- **port:market** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+14)
- **port:shipyard** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+10) · tiny: . > small.muted 10.4167px «Корпус 900 из »; .rep-h > span.tag 9px «медленно · поч» (+1)
- **port:tavern** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+11) · tiny: . > small.muted 10.4167px «Свободно мест:»
- **port:quests** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+12)
- **port:harbour** — <40: .w-chips > button.w-chip.on 82×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+10)
- **port:colours** — scroll: .w-pane > div.modal-body.w-body ↕274/269 · <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip.on 70×36; .w-chips > button.w-chip 38×36 (+9)
- **port:holdings** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip.on 99×36 (+10)
- **port:exchange** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+9)
- **port:auction** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+10)
- **port:dice** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+12)
- **port:rumours** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+10)
- **port:charts** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+11)
- **port:army** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+10)
- **port:pets** — <40: .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36; .w-chips > button.w-chip 38×36 (+13)
- **port:tattoo** — <40: .fit-pager > button.fit-pg-b 56×36; #modal-panel > button.x-btn 38×38
- **depart** — scroll: .k-sheet-body > div.dp-list ↕100/97 · <40: .k-sheet-foot > button.k-btn.k-btn--primary 218×38; .k-sheet-foot > button.k-btn.k-btn--secondary 159×38; .k-sheet-foot > button.k-btn.k-btn--secondary 159×38
- **hero:hero** — cut: .w-tab > span.w-tab-l «Снаряжение» …70/65; .hx-pick-t > small «Покупка на 2% дешевле, п» 112×43/112×29; .hx-pick-t > small «Ваш строй стоит на гекс » 112×100/112×29 · <40: .w-chips > button.w-chip 92×36; .hx-pick > button.btn.btn-small 66×38; .hx-pick > button.btn.btn-small 66×38 (+2)
- **hero:skills** — cut: .w-tab > span.w-tab-l «Снаряжение» …70/65 · <40: .w-chips > button.w-chip.on 91×36; .w-chips > button.w-chip 92×36; .w-chips > button.w-chip 116×36 (+3)
- **hero:book:orders** — scroll: .modal-body > div.w-chips.hx-schools ↔738/540 · cut: .w-tab > span.w-tab-l «Снаряжение» …70/65 · <40: .w-chips > button.w-chip.on 94×36; .w-chips > button.w-chip 70×36; .w-chips > button.w-chip 91×36 (+7) · tiny: .hx-otag > span.tag 9px «Уровень 1»; .hx-otag > span.tag.battle 9px «В бою» (+4)
- **hero:book:path** — cut: .w-tab > span.w-tab-l «Снаряжение» …70/65 · <40: .w-chips > button.w-chip 94×36; .w-chips > button.w-chip.on 70×36; .w-chips > button.w-chip 91×36 (+2) · tiny: .tb-store > span 10px «Воля»; .tb-store > b 10px «10» (+6)
- **hero:book:guild** — cut: .w-tab > span.w-tab-l «Снаряжение» …70/65 · <40: .w-chips > button.w-chip 94×36; .w-chips > button.w-chip 70×36; .w-chips > button.w-chip.on 91×36 (+1)
- **hero:gear:captain** — cut: .w-tab > span.w-tab-l «Снаряжение» …70/65 · <40: .w-chips > button.w-chip.on 91×36; .w-chips > button.w-chip 92×36; .w-chips > button.w-chip 116×36 (+3)
- **hero:gear:ship** — cut: .w-tab > span.w-tab-l «Снаряжение» …70/65 · <40: .w-chips > button.w-chip 91×36; .w-chips > button.w-chip.on 92×36; .w-chips > button.w-chip 116×36 (+2)
- **hero:gear:locker** — cut: .w-tab > span.w-tab-l «Снаряжение» …70/65 · <40: .w-chips > button.w-chip 91×36; .w-chips > button.w-chip 92×36; .w-chips > button.w-chip.on 116×36 (+2)
- **hero:gear:shop** — cut: .w-tab > span.w-tab-l «Снаряжение» …70/65 · <40: .w-chips > button.w-chip 91×36; .w-chips > button.w-chip 92×36; .w-chips > button.w-chip 116×36 (+3)
- **talents** — out: .rose > button.rose-node [357,355,407,405]; .rose > button.rose-node [295,375,345,425]; .rose > button.rose-node [233,355,283,405] · <40: .tal-loadout > button.btn.btn-small 268×38; .tal-loadout > button.btn.btn-small 268×38; .fit-pager > button.fit-pg-b 56×36 (+1)
- **talents:tree** — out: .rose > button.rose-node [357,355,407,405]; .rose > button.rose-node [295,375,345,425]; .rose > button.rose-node.active [233,355,283,405] · <40: .tal-loadout > button.btn.btn-small 268×38; .tal-loadout > button.btn.btn-small 268×38; .fit-pager > button.fit-pg-b 56×36 (+1)
- **options** — <40: .w-seg > button.w-chip.on 62×36; .w-seg > button.w-chip.no-tr 54×36; .opt-row > button.w-switch 92×38 (+9)
- **options:ui** — scroll: .modal-head > div.w-chips ↔625/539 · <40: .w-chips > button.w-chip 159×36; .w-chips > button.w-chip.on 108×36; .w-chips > button.w-chip 159×36 (+6)
- **options:vision** — scroll: .modal-head > div.w-chips ↔625/539 · <40: .w-chips > button.w-chip 159×36; .w-chips > button.w-chip 108×36; .w-chips > button.w-chip.on 159×36 (+11)
- **options:sound** — scroll: .modal-head > div.w-chips ↔625/539 · <40: .w-chips > button.w-chip 159×36; .w-chips > button.w-chip 108×36; .w-chips > button.w-chip 159×36 (+4)
- **options:controls** — scroll: .modal-head > div.w-chips ↔625/539 · <40: .w-chips > button.w-chip 159×36; .w-chips > button.w-chip 108×36; .w-chips > button.w-chip 159×36 (+8)
- **map** — <40: .w-chips > button.w-chip.on 80×36; .w-chips > button.w-chip.on 72×36; .w-chips > button.w-chip.on 83×36 (+3)
- **journal:quests** — <40: .w-chips > button.w-chip 114×36; .w-chips > button.w-chip 69×36; .w-chips > button.w-chip 111×36 (+2)
- **journal:company:group** — scroll: .w-pane > div.w-chips ↔567/548 · <40: .w-chips > button.w-chip.on 78×36; .w-chips > button.w-chip 118×36; .w-chips > button.w-chip 92×36 (+6)
- **journal:company:law** — scroll: .w-pane > div.w-chips ↔567/548 · <40: .w-chips > button.w-chip 78×36; .w-chips > button.w-chip.on 118×36; .w-chips > button.w-chip 92×36 (+4)
- **journal:company:isles** — scroll: .w-pane > div.w-chips ↔567/548 · <40: .w-chips > button.w-chip 78×36; .w-chips > button.w-chip 118×36; .w-chips > button.w-chip.on 92×36 (+4)
- **journal:guild** — <40: #g-name 194×38; #g-tag 194×38; #g-found 102×38 (+1)
- **journal:letters** — <40: #modal-panel > button.x-btn 38×38
- **journal:album:album** — <40: .w-chips > button.w-chip.on 88×36; .w-chips > button.w-chip 92×36; .w-chips > button.w-chip 94×36 (+2)
- **journal:album:career** — <40: .w-chips > button.w-chip 88×36; .w-chips > button.w-chip.on 92×36; .w-chips > button.w-chip 94×36 (+2)
- **menu** — <40: #modal-panel > button.x-btn 38×38
- **ship** — <40: .ship-head-r > button.btn.btn-small 131×38; .ship-head-r > button.btn.btn-small 88×38; .fit-pager > button.fit-pg-b 56×36 (+1) · tiny: .stat-tile > span.stat-l 10px «Наибольшая ско»; .stat-tile > span.stat-l 10px «Скорость повор» (+7)
- **crew** — <40: .fit-pager > button.fit-pg-b 56×36; #modal-panel > button.x-btn 38×38 · tiny: .stat-tile > span.stat-l 10px «На борту»; .stat-tile > span.stat-l 10px «Выучка» (+3)
- **help** — <40: .fit-pager > button.fit-pg-b 56×36; #modal-panel > button.x-btn 38×38
- **research** — <40: .tabs > button.tab 106×36; .tabs > button.tab 122×36; .tabs > button.tab.active 116×36 (+3)
- **look** — <40: .fit-pager > button.fit-pg-b 56×36; #modal-panel > button.x-btn 38×38
- **shop** — <40: .rc-chips > button.btn.btn-small 101×38; .tabs > button.tab.active 131×36; .tabs > button.tab 141×36 (+2)
- **throne:glory** — <40: .tabs > button.tab.active 116×36; .tabs > button.tab 52×36; .tabs > button.tab 52×36 (+8) · tiny: .th-hside > small.muted 10.4167px «0 из 190 550 д»; .th-hside > small.gold 10.4167px «Очки мастерств»
- **throne:mastery** — <40: .tabs > button.tab 71×36; .tabs > button.tab.active 139×36; .tabs > button.tab 52×36 (+9)
- **throne:trials** — <40: .tabs > button.tab 71×36; .tabs > button.tab 52×36; .tabs > button.tab.active 133×36 (+8)
- **throne:seals** — <40: .tabs > button.tab 71×36; .tabs > button.tab 52×36; .tabs > button.tab 52×36 (+9)
- **throne:raid** — <40: .tabs > button.tab 71×36; .tabs > button.tab 52×36; .tabs > button.tab 52×36 (+9)
- **throne:citadels** — <40: .tabs > button.tab 71×36; .tabs > button.tab 52×36; .tabs > button.tab 52×36 (+8)
- **throne:war** — <40: .tabs > button.tab 71×36; .tabs > button.tab 52×36; .tabs > button.tab 52×36 (+7) · tiny: .th-hside > small.muted 10.4167px «До конца сезон»
- **throne:contracts** — <40: .tabs > button.tab 71×36; .tabs > button.tab 52×36; .tabs > button.tab 52×36 (+8) · tiny: .th-hside > small.muted 10.4167px «Неделя 39 · до»
- **throne:arena** — <40: .tabs > button.tab 71×36; .tabs > button.tab 52×36; .tabs > button.tab 52×36 (+8) · tiny: .th-hside > small.muted 10.4167px «Сезон закончит»
- **sea:menu** — <40: .k-sheet-head > button.k-btn.k-btn--icon 38×38
- **sea:news** — <40: .k-sheet-head > button.k-btn.k-btn--icon 38×38; .fit-pager > button.fit-pg-b 56×36
- **chat** — <40: #chat-tabs > button.ct.on 25×22; #chat-tabs > button.ct 17×22; #chat-tabs > button.ct 17×22 (+5)
- **roam-card** — <40: .confirm-row > button.k-btn.k-btn--secondary 161×38; .confirm-row > button.k-btn.k-btn--primary 161×38
- **lairchest** — <40: .lc-foot > button.btn.btn-primary 125×33
- **board-offer** — <40: .bo-h > button.bo-x 24×24; .bo-sts > button.bo-st.on 32×32; .bo-sts > button.bo-st 32×32 · tiny: .bo-st > b 9px «20»; .bo-st > b 9px «10» (+1)
- **sea:foe** — out: #hud-map [546,-73,632,13] · cut: .k-target > span.k-target-name ««Портовый волк»» …116/85 · <40: #tc-target > button.k-target.k-threat-even 288×36 · tiny: .k-target > span.k-target-range 0px «далеко»; #tc-act > b.tc-act-more 10px «+1» (+1)
- **battle** — tiny: .tb-chip > b.tb-chip-men 10px «24»; .tb-chip > b.tb-chip-men 10px «22»
- **battle:book** — <40: .k-sheet-head > button.k-btn.k-btn--icon 38×38; .fit-pager > button.fit-pg-b 56×36 · tiny: .tb-store > b 10px «154»; .tb-store > small 8.33333px «/154» (+2)
- **battle:card** — <40: .k-sheet-head > button.k-btn.k-btn--icon 38×38
- **battle:end** — tiny: .tb-rs > i 10px «−28»; .tb-rs > i 10px «−2» (+2)
- **land** — tiny: .tb-chip > b.tb-chip-men 10px «24»; .tb-chip > b.tb-chip-men 10px «25»
