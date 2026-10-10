# Mobile fit audit — dev2 (2026-10-10)

Measured by `tools/mobile/fit/audit.mjs` (`measure.js` in the page). Landscape phones: 640×360, 740×360, 812×375, 844×390, 915×412; also 375×812, 820×1180, 1500×600, 1440×900; RU and EN.

- **scroll** — measurements (screen × size × language) at the phone sizes with a scroll box that overflows or a page that scrolls;
- **out / cut / <40 / <36 / tiny** — sums over the phone sizes: elements past the screen, cut or ellipsised text, tap targets under 40 and 36 px, text under 11 px;
- **share** — the window's share of the screen at 640×360; **desk** — measurements at the other sizes with something out or cut.

**Totals at the phone sizes** (18 measurements): scroll 0 · out 0 · cut 0 · <40 px 140 · <36 px 43 · text <11 px 0

| screen | measured | scroll (phones) | out | cut | <40 px | <36 px | tiny | share 640 | desk out/cut | 640×360 scroll |
|---|---|---|---|---|---|---|---|---|---|---|
| port:quests | 3 | 0 | 0 | 0 | 50 | 15 | 0 | 100% | 0 | — |
| depart | 3 | 0 | 0 | 0 | 15 | 5 | 0 | 55% | 0 | — |
| throne:glory | 3 | 0 | 0 | 0 | 37 | 11 | 0 | 100% | 0 | — |
| throne:arena | 3 | 0 | 0 | 0 | 33 | 11 | 0 | 100% | 0 | — |
| lair-card | 3 | 0 | 0 | 0 | 5 | 1 | 0 | 8% | 0 | — |
| sea:foe | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 100% | 0 | — |
| battle:card | 0 (+3 not opened) | 0 | 0 | 0 | 0 | 0 | 0 | –% | 0 | — |

## Details at 640×360 (RU)

- **port:quests** — <40: .w-chips > button.w-chip 36×36; .w-chips > button.w-chip 36×36; .w-chips > button.w-chip 36×36 (+12)
- **depart** — <40: .dp-row > button.btn.btn-small 138×36; .dp-row > button.btn.btn-small 208×36; .k-sheet-foot > button.k-btn.k-btn--primary 226×38 (+2)
- **throne:glory** — <40: .tabs > button.tab.active 108×36; .tabs > button.tab 46×36; .tabs > button.tab 46×36 (+8)
- **throne:arena** — <40: .tabs > button.tab 65×36; .tabs > button.tab 46×36; .tabs > button.tab 46×36 (+8)
- **lair-card** — <40: .enc-card > div.ac-head 200×36; .ac-head > button.ac-x 36×36
