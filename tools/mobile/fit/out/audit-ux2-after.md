# Mobile fit audit — ux2-after (2026-10-11)

Measured by `tools/mobile/fit/audit.mjs` (the meter `measure.js` runs in the page). Phones held sideways: 480×270, 568×320, 640×360, 740×360, 812×375, 844×390, 915×412; upright 375×812 and 270×480; tablet 820×1180; desk 1500×600 and 1440×900; RU and EN; every screen and window opened afresh at every size.

- **scroll** — measurements with a scroll box that overflows (in the window or around it) or a page that scrolls;
- **out** — words or taps past the screen; **cut** — words cut, ellipsised, clamped, clipped by a box, or spilling out of their own box;
- **taps** — tap targets under 36 px (under 32 px where the short side is under 360 px); **tiny** — words under 6 px (the owner’s phone minimum, 2026-10-11; under 11/10 px before); **big** — words over 14 px on a phone outside a heading;
- **paged** — windows laid out in pages «‹ 1/3 ›» instead of a scroll (kit/fit.ts); **clean** — measurements with none of the above.
- Upright phones show the «turn your phone» prompt over everything (it is measured, the game under it is not counted).

## Totals per size

| size | measurements | scroll | out | cut | taps | tiny | big | paged | clean |
|---|---|---|---|---|---|---|---|---|---|
| 480x270 | 82 | 48 → **49** | 0 → **0** | 3 → **1** | 21 → **21** | 0 → **0** | 97 → **0** | 0 → **0** | 28 → **33** |
| 844x390 | 82 | 43 → **43** | 0 → **0** | 0 → **0** | 27 → **27** | 0 → **0** | 290 → **0** | 0 → **0** | 23 → **39** |
| 1500x600 | 81 | 48 → **48** | 0 → **0** | 9 → **9** | 344 → **347** | 0 → **0** | 0 → **0** | 0 → **0** | 19 → **18** |

**All phones held sideways** (164 measurements): scroll 91 → **92** · out 0 → **0** · cut 3 → **1** · taps 48 → **48** · tiny 0 → **0** · big 387 → **0** · clean 51 → **72**

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
| port:shipyard | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 4 → 0 | – | –% → –% |
| port:tavern | 2 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
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
| depart | 2 | 1 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| hero:hero | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 11 → 0 | – | –% → –% |
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
| journal:company:law | 2 | 2 → 2 | 0 → 0 | 1 → 0 | 0 → 0 | 0 → 0 | 12 → 0 | – | –% → –% |
| journal:company:isles | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 40 → 0 | – | –% → –% |
| journal:guild | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| journal:letters | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| journal:album:album | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 14 → 0 | – | –% → –% |
| journal:album:career | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 10 → 0 | – | –% → –% |
| menu | 2 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 11 → 0 | – | –% → –% |
| ship | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 10 → 0 | – | –% → –% |
| crew | 2 | 2 → 2 | 0 → 0 | 1 → 1 | 0 → 0 | 0 → 0 | 6 → 0 | – | –% → –% |
| help | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 4 → 0 | – | –% → –% |
| research | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| look | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 26 → 26 | 0 → 0 | 2 → 0 | – | –% → –% |
| shop | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 96 → 0 | – | –% → –% |
| shop:topup | 2 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 10 → 0 | – | –% → –% |
| toasts:port | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| throne:glory | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 9 → 0 | – | –% → –% |
| throne:mastery | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 8 → 0 | – | –% → –% |
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
| lairchest | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| board-offer | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| sea:foe | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| battle | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| battle:book | 2 | 2 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | – | –% → –% |
| battle:card | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 12 → 0 | – | –% → –% |
| battle:end | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |
| land | 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 2 → 0 | – | –% → –% |

## What is left at 844x390 (RU)

- **port:market** — scroll: .w-pane > div.modal-body.w-body ↕1175/299
- **port:shipyard** — scroll: .w-pane > div.modal-body.w-body ↕431/276
- **port:quests** — scroll: .w-pane > div.modal-body.w-body ↕766/299
- **port:harbour** — scroll: .w-pane > div.modal-body.w-body ↕1066/299
- **port:holdings** — scroll: .w-pane > div.modal-body.w-body ↕527/299
- **port:rumours** — scroll: .w-pane > div.modal-body.w-body ↕1709/299
- **port:charts** — scroll: .w-pane > div.modal-body.w-body ↕378/299
- **port:tattoo** — scroll: #modal-panel > div.modal-body.tattoos ↕1192/342
- **depart** — scroll: .k-sheet > div.k-sheet-body ↕150/147
- **hero:hero** — scroll: .w-pane > div.modal-body.w-body ↕1078/342
- **hero:skills** — scroll: .w-pane > div.modal-body.w-body ↕824/342
- **hero:book:orders** — scroll: .w-pane > div.modal-body.w-body ↕601/342
- **hero:book:path** — scroll: .w-pane > div.modal-body.w-body ↕837/342
- **hero:gear:captain** — scroll: .w-pane > div.modal-body.w-body ↕405/342
- **hero:gear:shop** — scroll: .w-pane > div.modal-body.w-body ↕430/342
- **talents** — scroll: .modal-body > div.tal-loadout ↕41/36; .tal-layout > div.tal-main ↕1850/282
- **talents:tree** — scroll: .modal-body > div.tal-loadout ↕41/36; .tal-layout > div.tal-main ↕1950/282
- **options:ui** — scroll: #modal-panel > div.modal-body.w-body ↕843/341
- **options:vision** — scroll: #modal-panel > div.modal-body.w-body ↕473/341
- **options:sound** — scroll: #modal-panel > div.modal-body.w-body ↕514/341
- **options:controls** — scroll: #modal-panel > div.modal-body.w-body ↕1901/341
- **journal:quests** — scroll: .w-pane > div.modal-body.w-body ↕1671/342
- **journal:company:group** — scroll: #company-body ↕741/299 · taps: 7
- **journal:company:law** — scroll: #company-body ↕504/299
- **journal:company:isles** — scroll: #company-body ↕2046/299
- **journal:album:album** — scroll: #company-body ↕1918/342
- **journal:album:career** — scroll: #company-body ↕1196/342
- **ship** — scroll: #modal-panel > div.modal-body ↕949/289
- **crew** — scroll: #modal-panel > div.modal-body ↕886/342
- **help** — scroll: #modal-panel > div.modal-body ↕891/342
- **research** — scroll: #modal-panel > div.modal-body.rs-body ↕803/305
- **look** — scroll: #modal-panel > div.modal-body.looks ↕928/342 · taps: 13
- **shop** — scroll: #modal-panel > div.modal-body.pm-body ↕9106/342
- **throne:glory** — scroll: #modal-panel > div.modal-body.throne-win ↕396/337
- **throne:mastery** — scroll: #modal-panel > div.modal-body.throne-win ↕1130/337
- **throne:trials** — scroll: #modal-panel > div.modal-body.throne-win ↕1061/314
- **throne:seals** — scroll: #modal-panel > div.modal-body.throne-win ↕465/337
- **throne:raid** — scroll: #modal-panel > div.modal-body.throne-win ↕554/337
- **throne:citadels** — scroll: #modal-panel > div.modal-body.throne-win ↕1393/337
- **throne:contracts** — scroll: #modal-panel > div.modal-body.throne-win ↕742/337
- **throne:arena** — scroll: #modal-panel > div.modal-body.throne-win ↕400/337
- **sea:news** — scroll: .k-sheet > div.k-sheet-body ↕579/224 · taps: 7
- **battle:book** — scroll: .k-sheet > div.k-sheet-body ↕812/282

## What is left at 640x360 (RU)

Nothing.

## What is left at 480x270 (RU)

- **port:market** — scroll: .w-pane > div.modal-body.w-body ↕1024/196
- **port:shipyard** — scroll: .w-pane > div.modal-body.w-body ↕507/196
- **port:tavern** — scroll: .w-pane > div.modal-body.w-body ↕211/196
- **port:quests** — scroll: .w-pane > div.modal-body.w-body ↕747/196
- **port:harbour** — scroll: .w-pane > div.modal-body.w-body ↕949/196; .card > table.grid ↔201/183
- **port:colours** — scroll: .w-pane > div.modal-body.w-body ↕242/196
- **port:holdings** — scroll: .w-pane > div.modal-body.w-body ↕902/196
- **port:rumours** — scroll: .w-pane > div.modal-body.w-body ↕2041/196
- **port:charts** — scroll: .w-pane > div.modal-body.w-body ↕331/196
- **port:tattoo** — scroll: #modal-panel > div.modal-body.tattoos ↕2220/233
- **depart** — scroll: .k-sheet > div.k-sheet-body ↕138/135
- **hero:hero** — scroll: .w-pane > div.modal-body.w-body ↕1341/233
- **hero:skills** — scroll: .w-pane > div.modal-body.w-body ↕1096/233
- **hero:book:orders** — scroll: .w-pane > div.modal-body.w-body ↕616/233
- **hero:book:path** — scroll: .w-pane > div.modal-body.w-body ↕1116/233
- **hero:gear:captain** — scroll: .w-pane > div.modal-body.w-body ↕394/233
- **hero:gear:ship** — scroll: .w-pane > div.modal-body.w-body ↕264/232
- **hero:gear:shop** — scroll: .w-pane > div.modal-body.w-body ↕421/233
- **talents** — scroll: .modal-body > div.tal-loadout ↕37/32; .tal-layout > div.tal-main ↕1874/186
- **talents:tree** — scroll: .modal-body > div.tal-loadout ↕37/32; .tal-layout > div.tal-main ↕1958/186
- **options** — scroll: #modal-panel > div.modal-body.w-body ↕299/233
- **options:ui** — scroll: #modal-panel > div.modal-body.w-body ↕783/228
- **options:vision** — scroll: #modal-panel > div.modal-body.w-body ↕430/228
- **options:sound** — scroll: #modal-panel > div.modal-body.w-body ↕496/228
- **options:controls** — scroll: #modal-panel > div.modal-body.w-body ↕1840/228
- **journal:quests** — scroll: .w-pane > div.modal-body.w-body ↕1383/233
- **journal:company:group** — scroll: #company-body ↕842/196 · taps: 7
- **journal:company:law** — scroll: #company-body ↕524/196
- **journal:company:isles** — scroll: #company-body ↕1701/196
- **journal:album:album** — scroll: #company-body ↕2484/233
- **journal:album:career** — scroll: #company-body ↕1656/233
- **menu** — scroll: #modal-panel > div.modal-body ↕748/233
- **ship** — scroll: #modal-panel > div.modal-body ↕927/178
- **crew** — scroll: #modal-panel > div.modal-body ↕808/233 · cut: .pr-row > span.pr-name «Морские пехотинцы» …90/64
- **help** — scroll: #modal-panel > div.modal-body ↕972/233
- **research** — scroll: #modal-panel > div.modal-body.rs-body ↕1037/200
- **look** — scroll: #modal-panel > div.modal-body.looks ↕1210/233 · taps: 13
- **shop** — scroll: #modal-panel > div.modal-body.pm-body ↕8456/232
- **shop:topup** — scroll: #modal-panel > div.modal-body.pm-body ↕421/232
- **throne:glory** — scroll: #modal-panel > div.modal-body.throne-win ↕398/220
- **throne:mastery** — scroll: #modal-panel > div.modal-body.throne-win ↕1934/220
- **throne:trials** — scroll: #modal-panel > div.modal-body.throne-win ↕1165/220
- **throne:seals** — scroll: #modal-panel > div.modal-body.throne-win ↕440/220
- **throne:raid** — scroll: #modal-panel > div.modal-body.throne-win ↕512/220
- **throne:citadels** — scroll: #modal-panel > div.modal-body.throne-win ↕1540/220
- **throne:contracts** — scroll: #modal-panel > div.modal-body.throne-win ↕793/220
- **throne:arena** — scroll: #modal-panel > div.modal-body.throne-win ↕380/220
- **sea:news** — scroll: .k-sheet > div.k-sheet-body ↕521/156 · taps: 1
- **battle:book** — scroll: .k-sheet > div.k-sheet-body ↕1602/196
