# Mobile fit audit — chat (2026-10-11)

Measured by `tools/mobile/fit/audit.mjs` (the meter `measure.js` runs in the page). Phones held sideways: 480×270, 568×320, 640×360, 740×360, 812×375, 844×390, 915×412; upright 375×812 and 270×480; tablet 820×1180; desk 1500×600 and 1440×900; RU and EN; every screen and window opened afresh at every size.

- **scroll** — measurements with a scroll box that overflows (in the window or around it) or a page that scrolls;
- **out** — words or taps past the screen; **cut** — words cut, ellipsised, clamped, clipped by a box, or spilling out of their own box;
- **taps** — tap targets under 36 px (under 32 px where the short side is under 360 px); **tiny** — words under 11 px (10 px below 360);
- **paged** — windows laid out in pages «‹ 1/3 ›» instead of a scroll (kit/fit.ts); **clean** — measurements with none of the above.
- Upright phones show the «turn your phone» prompt over everything (it is measured, the game under it is not counted).

## Totals per size

| size | measurements | scroll | out | cut | taps | tiny | paged | clean |
|---|---|---|---|---|---|---|---|---|
| 480x270 | 7 | 5 | 0 | 0 | 0 | 0 | 0 | 2 |
| 640x360 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 7 |
| 812x375 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 6 |
| 1500x600 | 6 | 4 | 0 | 0 | 0 | 0 | 0 | 2 |

**All phones held sideways** (20 measurements): scroll **5** · out **0** · cut **0** · taps **0** · tiny **0** · clean **15**

## Per screen, phones held sideways (all seven sizes, RU + EN)

| screen | measured | scroll | out | cut | taps | tiny | pages at 640×360 | share at 640×360 |
|---|---|---|---|---|---|---|---|---|
| chat | 6 | 2 | 0 | 0 | 0 | 0 | 1 | 100% |
| chat:card | 6 | 2 | 0 | 0 | 0 | 0 | 1 | 100% |
| chat:dm | 6 | 0 | 0 | 0 | 0 | 0 | 1 | 100% |
| chat:emotes | 2 | 1 | 0 | 0 | 0 | 0 | 1 | 100% |

## What is left at 640x360 (RU)

Nothing.

## What is left at 480x270 (RU)

- **chat** — scroll: #chat-log ↕285/177
- **chat:card** — scroll: #chat-log ↕285/177
- **chat:emotes** — scroll: #chat-log ↕239/177
