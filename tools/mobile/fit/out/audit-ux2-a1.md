# Mobile fit audit — ux2-a1 (2026-10-11)

Measured by `tools/mobile/fit/audit.mjs` (the meter `measure.js` runs in the page). Phones held sideways: 480×270, 568×320, 640×360, 740×360, 812×375, 844×390, 915×412; upright 375×812 and 270×480; tablet 820×1180; desk 1500×600 and 1440×900; RU and EN; every screen and window opened afresh at every size.

- **scroll** — measurements with a scroll box that overflows (in the window or around it) or a page that scrolls;
- **out** — words or taps past the screen; **cut** — words cut, ellipsised, clamped, clipped by a box, or spilling out of their own box;
- **taps** — tap targets under 36 px (under 32 px where the short side is under 360 px); **tiny** — words under 6 px (the owner’s phone minimum, 2026-10-11; under 11/10 px before); **big** — words over 14 px on a phone outside a heading;
- **paged** — windows laid out in pages «‹ 1/3 ›» instead of a scroll (kit/fit.ts); **clean** — measurements with none of the above.
- Upright phones show the «turn your phone» prompt over everything (it is measured, the game under it is not counted).

## Totals per size

| size | measurements | scroll | out | cut | taps | tiny | big | paged | clean |
|---|---|---|---|---|---|---|---|---|---|
| 480x270 | 82 | 48 → **50** | 0 → **0** | 3 → **2** | 21 → **22** | 0 → **0** | 97 → **26** | 0 → **0** | 28 → **31** |
| 844x390 | 82 | 43 → **43** | 0 → **0** | 0 → **0** | 27 → **28** | 0 → **0** | 290 → **15** | 0 → **0** | 23 → **36** |
| 1500x600 | 81 | 48 → **48** | 0 → **0** | 9 → **9** | 344 → **343** | 0 → **0** | 0 → **0** | 0 → **0** | 19 → **18** |

**All phones held sideways** (164 measurements): scroll 91 → **93** · out 0 → **0** · cut 3 → **2** · taps 48 → **50** · tiny 0 → **0** · big 387 → **41** · clean 51 → **67**

## Per screen, phones held sideways (all seven sizes, RU + EN)

| screen | measured | scroll | out | cut | taps | tiny | big | pages at 640×360 | share at 640×360 |
|---|---|---|---|---|---|---|---|---|---|
| login | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| login:account | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| captain | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| captain:drowned | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| prologue | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 1 → 0 | – | –% → –% |
| levelup | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| port:market | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| port:shipyard | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 4 → 2 | – | –% → –% |
| port:tavern | 2 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 2 | – | –% → –% |
| port:quests | 2 | 2 → 2 | 0 → 0 | 1 → 0 | 0 → 0 | 0 → 0 | 6 → 0 | – | –% → –% |
| port:harbour | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 10 → 0 | – | –% → –% |
| port:colours | 2 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 8 → 0 | – | –% → –% |
| port:holdings | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| port:exchange | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| port:auction | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 1 → 0 | – | –% → –% |
| port:dice | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 1 → 0 | – | –% → –% |
| port:rumours | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 4 → 0 | – | –% → –% |
| port:charts | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 3 → 0 | – | –% → –% |
| port:army | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 1 → 0 | – | –% → –% |
| port:pets | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| port:tattoo | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| depart | 2 | 1 → 2 | 0 → 0 | 0 → 0 | 0 → 2 | 0 → 0 | 0 → 0 | – | –% → –% |
| hero:hero | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 11 → 4 | – | –% → –% |
| hero:skills | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 10 → 0 | – | –% → –% |
| hero:book:orders | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| hero:book:path | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| hero:book:guild | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| hero:gear:captain | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| hero:gear:ship | 2 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| hero:gear:locker | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| hero:gear:shop | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| talents | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| talents:tree | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| options | 2 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| options:ui | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| options:vision | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| options:sound | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| options:controls | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| map | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| journal:quests | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| journal:company:group | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 14 → 14 | 0 → 0 | 5 → 0 | – | –% → –% |
| journal:company:law | 2 | 2 → 2 | 0 → 0 | 1 → 1 | 0 → 0 | 0 → 0 | 12 → 0 | – | –% → –% |
| journal:company:isles | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 40 → 0 | – | –% → –% |
| journal:guild | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| journal:letters | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| journal:album:album | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 14 → 0 | – | –% → –% |
| journal:album:career | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 10 → 0 | – | –% → –% |
| menu | 2 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 11 → 11 | – | –% → –% |
| ship | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 10 → 0 | – | –% → –% |
| crew | 2 | 2 → 2 | 0 → 0 | 1 → 1 | 0 → 0 | 0 → 0 | 6 → 0 | – | –% → –% |
| help | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 4 → 0 | – | –% → –% |
| research | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| look | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 26 → 26 | 0 → 0 | 2 → 0 | – | –% → –% |
| shop | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 96 → 0 | – | –% → –% |
| shop:topup | 2 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 10 → 0 | – | –% → –% |
| toasts:port | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| throne:glory | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 9 → 0 | – | –% → –% |
| throne:mastery | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 8 → 8 | – | –% → –% |
| throne:trials | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 24 → 0 | – | –% → –% |
| throne:seals | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| throne:raid | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| throne:citadels | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 24 → 0 | – | –% → –% |
| throne:war | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| throne:contracts | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 8 → 0 | – | –% → –% |
| throne:arena | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| sea | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| sea:menu | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| sea:news | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 8 → 8 | 0 → 0 | 0 → 0 | – | –% → –% |
| chat | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| chat:emotes | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| chat:card | 0 (+3 not opened) | – → – | – → – | – → – | – → – | – → – | – → – | – | –% → –% |
| chat:dm | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| toasts:sea | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| lair-card | 2 (+1 not opened) | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| roam-card | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| lairchest | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 2 | – | –% → –% |
| board-offer | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| sea:foe | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| battle | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| battle:book | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| battle:card | 2 | 0 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 12 → 12 | – | –% → –% |
| battle:end | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| land | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |

## What is left at 844x390 (RU)

- **port:market** — scroll: .w-pane > div.modal-body.w-body ↕1173/299
- **port:shipyard** — scroll: .w-pane > div.modal-body.w-body ↕438/299 · big: . > b 16px «Починить»
- **port:tavern** — big: . > b 16px «Матросы»
- **port:quests** — scroll: .w-pane > div.modal-body.w-body ↕807/299
- **port:harbour** — scroll: .w-pane > div.modal-body.w-body ↕1136/299
- **port:holdings** — scroll: .w-pane > div.modal-body.w-body ↕549/299
- **port:rumours** — scroll: .w-pane > div.modal-body.w-body ↕1796/299
- **port:charts** — scroll: .w-pane > div.modal-body.w-body ↕402/299
- **port:tattoo** — scroll: #modal-panel > div.modal-body.tattoos ↕1458/342
- **depart** — scroll: .k-sheet > div.k-sheet-body ↕165/155 · taps: 1
- **hero:hero** — scroll: .w-pane > div.modal-body.w-body ↕1136/342 · big: .hx-prim > b.hx-pv 24px «12»; .hx-prim > b.hx-pv 24px «10»
- **hero:skills** — scroll: .w-pane > div.modal-body.w-body ↕972/342
- **hero:book:orders** — scroll: .w-pane > div.modal-body.w-body ↕592/342
- **hero:book:path** — scroll: .w-pane > div.modal-body.w-body ↕840/342
- **hero:gear:captain** — scroll: .w-pane > div.modal-body.w-body ↕446/342
- **hero:gear:shop** — scroll: .w-pane > div.modal-body.w-body ↕431/342
- **talents** — scroll: .modal-body > div.tal-loadout ↕41/36; .tal-layout > div.tal-main ↕1850/282
- **talents:tree** — scroll: .modal-body > div.tal-loadout ↕41/36; .tal-layout > div.tal-main ↕1950/282
- **options:ui** — scroll: #modal-panel > div.modal-body.w-body ↕863/341
- **options:vision** — scroll: #modal-panel > div.modal-body.w-body ↕481/341
- **options:sound** — scroll: #modal-panel > div.modal-body.w-body ↕534/341
- **options:controls** — scroll: #modal-panel > div.modal-body.w-body ↕1902/341
- **journal:quests** — scroll: .w-pane > div.modal-body.w-body ↕1969/342
- **journal:company:group** — scroll: #company-body ↕764/299 · taps: 7
- **journal:company:law** — scroll: #company-body ↕517/299
- **journal:company:isles** — scroll: #company-body ↕2009/299
- **journal:album:album** — scroll: #company-body ↕1952/342
- **journal:album:career** — scroll: #company-body ↕1361/342
- **ship** — scroll: #modal-panel > div.modal-body ↕970/289
- **crew** — scroll: #modal-panel > div.modal-body ↕915/342
- **help** — scroll: #modal-panel > div.modal-body ↕1031/342
- **research** — scroll: #modal-panel > div.modal-body.rs-body ↕996/305
- **look** — scroll: #modal-panel > div.modal-body.looks ↕974/342 · taps: 13
- **shop** — scroll: #modal-panel > div.modal-body.pm-body ↕8835/342
- **throne:glory** — scroll: #modal-panel > div.modal-body.throne-win ↕431/337
- **throne:mastery** — scroll: #modal-panel > div.modal-body.throne-win ↕1208/337 · big: .card-h > span 17px «Адмирал»; .card-h > span 17px «Абордажник»; .card-h > span 17px «Мистик» (+1)
- **throne:trials** — scroll: #modal-panel > div.modal-body.throne-win ↕1085/337
- **throne:seals** — scroll: #modal-panel > div.modal-body.throne-win ↕501/337
- **throne:raid** — scroll: #modal-panel > div.modal-body.throne-win ↕586/337
- **throne:citadels** — scroll: #modal-panel > div.modal-body.throne-win ↕1422/337
- **throne:contracts** — scroll: #modal-panel > div.modal-body.throne-win ↕809/337
- **throne:arena** — scroll: #modal-panel > div.modal-body.throne-win ↕422/337
- **sea:news** — scroll: .k-sheet > div.k-sheet-body ↕599/224 · taps: 7
- **lairchest** — big: . > div.enc-h 15px «Логово взято: »
- **battle:book** — scroll: .k-sheet > div.k-sheet-body ↕810/282
- **battle:card** — big: . > b 15px «20 / 28»; . > b 15px «22,3»; . > b 15px «27,4 −2%» (+3)

## What is left at 640x360 (RU)

Nothing.

## What is left at 480x270 (RU)

- **port:market** — scroll: .w-pane > div.modal-body.w-body ↕1023/196
- **port:shipyard** — scroll: .w-pane > div.modal-body.w-body ↕530/196 · big: . > b 16px «Починить»
- **port:tavern** — scroll: .w-pane > div.modal-body.w-body ↕258/196 · big: . > b 16px «Матросы»
- **port:quests** — scroll: .w-pane > div.modal-body.w-body ↕795/196
- **port:harbour** — scroll: .w-pane > div.modal-body.w-body ↕1040/196; .card > table.grid ↔201/183
- **port:colours** — scroll: .w-pane > div.modal-body.w-body ↕246/196
- **port:holdings** — scroll: .w-pane > div.modal-body.w-body ↕920/196
- **port:rumours** — scroll: .w-pane > div.modal-body.w-body ↕2170/196
- **port:charts** — scroll: .w-pane > div.modal-body.w-body ↕351/196
- **port:tattoo** — scroll: #modal-panel > div.modal-body.tattoos ↕2503/233
- **depart** — scroll: .k-sheet > div.k-sheet-body ↕155/145 · taps: 1
- **hero:hero** — scroll: .w-pane > div.modal-body.w-body ↕1503/233 · big: .hx-prim > b.hx-pv 18px «12»; .hx-prim > b.hx-pv 18px «10»
- **hero:skills** — scroll: .w-pane > div.modal-body.w-body ↕1311/233
- **hero:book:orders** — scroll: .w-pane > div.modal-body.w-body ↕614/233
- **hero:book:path** — scroll: .w-pane > div.modal-body.w-body ↕1152/233
- **hero:gear:captain** — scroll: .w-pane > div.modal-body.w-body ↕508/233
- **hero:gear:ship** — scroll: .w-pane > div.modal-body.w-body ↕264/232
- **hero:gear:shop** — scroll: .w-pane > div.modal-body.w-body ↕422/233
- **talents** — scroll: .modal-body > div.tal-loadout ↕37/32; .tal-layout > div.tal-main ↕1874/186
- **talents:tree** — scroll: .modal-body > div.tal-loadout ↕37/32; .tal-layout > div.tal-main ↕1958/186
- **options** — scroll: #modal-panel > div.modal-body.w-body ↕299/233
- **options:ui** — scroll: #modal-panel > div.modal-body.w-body ↕819/228
- **options:vision** — scroll: #modal-panel > div.modal-body.w-body ↕447/228
- **options:sound** — scroll: #modal-panel > div.modal-body.w-body ↕525/228
- **options:controls** — scroll: #modal-panel > div.modal-body.w-body ↕1841/228
- **journal:quests** — scroll: .w-pane > div.modal-body.w-body ↕1661/233
- **journal:company:group** — scroll: #company-body ↕953/196 · taps: 7
- **journal:company:law** — scroll: #company-body ↕541/196 · cut: .fl-t > span.fl-whose «Флаг: Корона» …79/58
- **journal:company:isles** — scroll: #company-body ↕1856/196
- **journal:album:album** — scroll: #company-body ↕2530/233
- **journal:album:career** — scroll: #company-body ↕2101/233
- **menu** — scroll: #modal-panel > div.modal-body ↕790/233 · big: .menu-tile > span 15px «Карта»; .menu-tile > span 15px «Журнал»; .menu-tile > span 15px «Корабль» (+8)
- **ship** — scroll: #modal-panel > div.modal-body ↕971/178
- **crew** — scroll: #modal-panel > div.modal-body ↕851/233 · cut: .pr-row > span.pr-name «Морские пехотинцы» …129/64
- **help** — scroll: #modal-panel > div.modal-body ↕1241/233
- **research** — scroll: #modal-panel > div.modal-body.rs-body ↕1359/200
- **look** — scroll: #modal-panel > div.modal-body.looks ↕1302/233 · taps: 13
- **shop** — scroll: #modal-panel > div.modal-body.pm-body ↕8199/232
- **shop:topup** — scroll: #modal-panel > div.modal-body.pm-body ↕498/232
- **throne:glory** — scroll: #modal-panel > div.modal-body.throne-win ↕492/220
- **throne:mastery** — scroll: #modal-panel > div.modal-body.throne-win ↕2193/220 · big: .card-h > span 17px «Адмирал»; .card-h > span 17px «Абордажник»; .card-h > span 17px «Мистик» (+1)
- **throne:trials** — scroll: #modal-panel > div.modal-body.throne-win ↕1366/220
- **throne:seals** — scroll: #modal-panel > div.modal-body.throne-win ↕523/220
- **throne:raid** — scroll: #modal-panel > div.modal-body.throne-win ↕595/220
- **throne:citadels** — scroll: #modal-panel > div.modal-body.throne-win ↕1686/220
- **throne:contracts** — scroll: #modal-panel > div.modal-body.throne-win ↕857/220
- **throne:arena** — scroll: #modal-panel > div.modal-body.throne-win ↕465/220
- **sea:news** — scroll: .k-sheet > div.k-sheet-body ↕549/156 · taps: 1
- **lairchest** — big: . > div.enc-h 15px «Логово взято: »
- **battle:book** — scroll: .k-sheet > div.k-sheet-body ↕1602/196
- **battle:card** — scroll: .k-sheet > div.k-sheet-body ↕236/223 · big: . > b 15px «20 / 28»; . > b 15px «22,3»; . > b 15px «27,4 −2%» (+3)
