# Mobile fit audit — seaux (2026-10-11)

Measured by `tools/mobile/fit/audit.mjs` (the meter `measure.js` runs in the page). Phones held sideways: 480×270, 568×320, 640×360, 740×360, 812×375, 844×390, 915×412; upright 375×812 and 270×480; tablet 820×1180; desk 1500×600 and 1440×900; RU and EN; every screen and window opened afresh at every size.

- **scroll** — measurements with a scroll box that overflows (in the window or around it) or a page that scrolls;
- **out** — words or taps past the screen; **cut** — words cut, ellipsised, clamped, clipped by a box, or spilling out of their own box;
- **taps** — tap targets under 36 px (under 32 px where the short side is under 360 px); **tiny** — words under 11 px (10 px below 360);
- **paged** — windows laid out in pages «‹ 1/3 ›» instead of a scroll (kit/fit.ts); **clean** — measurements with none of the above.
- Upright phones show the «turn your phone» prompt over everything (it is measured, the game under it is not counted).

## Totals per size

| size | measurements | scroll | out | cut | taps | tiny | paged | clean |
|---|---|---|---|---|---|---|---|---|
| 480x270 | 15 | 12 | 0 | 0 | 8 | 0 | 0 | 3 |
| 844x390 | 15 | 11 | 0 | 0 | 8 | 2 | 0 | 4 |

**All phones held sideways** (30 measurements): scroll **23** · out **0** · cut **0** · taps **16** · tiny **2** · clean **7**

## Per screen, phones held sideways (all seven sizes, RU + EN)

| screen | measured | scroll | out | cut | taps | tiny | pages at 640×360 | share at 640×360 |
|---|---|---|---|---|---|---|---|---|
| hero:skills | 2 | 2 | 0 | 0 | 0 | 0 | – | –% |
| talents | 2 | 2 | 0 | 0 | 0 | 0 | – | –% |
| talents:tree | 2 | 2 | 0 | 0 | 0 | 0 | – | –% |
| options | 2 | 1 | 0 | 0 | 0 | 0 | – | –% |
| options:ui | 2 | 2 | 0 | 0 | 0 | 0 | – | –% |
| options:vision | 2 | 2 | 0 | 0 | 0 | 0 | – | –% |
| options:sound | 2 | 2 | 0 | 0 | 0 | 0 | – | –% |
| options:controls | 2 | 2 | 0 | 0 | 0 | 0 | – | –% |
| journal:quests | 2 | 2 | 0 | 0 | 0 | 0 | – | –% |
| journal:company:group | 2 | 2 | 0 | 0 | 14 | 0 | – | –% |
| journal:company:isles | 2 | 2 | 0 | 0 | 0 | 0 | – | –% |
| sea | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| sea:menu | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |
| sea:news | 2 | 2 | 0 | 0 | 2 | 2 | – | –% |
| sea:foe | 2 | 0 | 0 | 0 | 0 | 0 | – | –% |

## What is left at 640x360 (RU)

Nothing.

## What is left at 480x270 (RU)

- **hero:skills** — scroll: .w-pane > div.modal-body.w-body ↕1383/233
- **talents** — scroll: .tal-layout > div.tal-main ↕1779/189
- **talents:tree** — scroll: .tal-layout > div.tal-main ↕1886/189
- **options** — scroll: #modal-panel > div.modal-body.w-body ↕259/233
- **options:ui** — scroll: #modal-panel > div.modal-body.w-body ↕820/228
- **options:vision** — scroll: #modal-panel > div.modal-body.w-body ↕447/228
- **options:sound** — scroll: #modal-panel > div.modal-body.w-body ↕525/228
- **options:controls** — scroll: #modal-panel > div.modal-body.w-body ↕1843/228
- **journal:quests** — scroll: .w-pane > div.modal-body.w-body ↕1665/233
- **journal:company:group** — scroll: #company-body ↕1071/196 · taps: 7
- **journal:company:isles** — scroll: #company-body ↕1964/196
- **sea:news** — scroll: .k-sheet > div.k-sheet-body ↕241/156 · taps: 1
