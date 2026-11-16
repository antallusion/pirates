# GRAVETIDE — флаги, которые сейчас рисует код (аудит 2026-11-16)

Остальные семейства закрыты: все id в манифесте (4022) существуют на диске, `art_cover.ts` — 0 дыр у иконок, юнитов,
боссов, карточек; таблицы `ICON_STAND_IN`, `FLEET_STAND_IN`, `BOSS_*_STAND_IN`, `TITAN_STAND_IN` пусты. Всё, что рисуется
кодом без картинки, — это флаги.

## Что рисует код и где это видно

| что | где видно | чем нарисовано сейчас |
|---|---|---|
| Флаги «цветов» капитана: нейтральный, пиратский, Зелёный вымпел, флаг города ×7 | флажок у имени каждого корабля в море (`renderer.ts colourFlag`), карточка цели, строка цели, выбор флага в порту (`ui/flags.ts`, `flags.css`) | CSS / canvas: прямоугольник цвета фракции с полоской |
| Флаг на мачте у NPC и у капитанов без своего флага | каждый корабль фракции в море | общий вымпел `part.pennant`, перекрашенный в цвет фракции (просто цветная ленточка) |
| Флаг №64 «Печать Лиги» (`FLAGS[64]`, `flag.f64`) | редактор облика, мачта, сага | процедурная заглушка: поле + глиф (`render/flag.ts`) |
| Флаг гильдии над цитаделью | цитадели на море и на карте мира, рейтинг войны | canvas: треугольник цвета гильдии; в окне — цветной квадрат и «♛» |
| Сигнальные флаги мини-игры «Флажный сигнал» (5 шт.) | кнопки мини-игры | цветные квадраты CSS |

## Как генерировать

Тот же «домашний» стиль, что у 64 готовых флагов (`assets/flags/f00…f63`): плоская ткань 3:2 анфас, без древка, на
**чистом пурпурном фоне #FF00FF** (его вырежет `tools/art/slice_flags.py`).
Сохранять в `C:\Users\enosi\Downloads\gravetide_art\flags2\` под именами `sheet_a.png`, `sheet_b.png`.
Порядок ячеек — слева направо, сверху вниз.

---

### Лист A — 12 флагов, сетка 4×3, формат 16:9 → `sheet_a.png`

Ячейки → id: 1 `flag.c_neutral`, 2 `flag.c_pirate`, 3 `flag.c_green`, 4 `flag.c_crown`, 5 `flag.c_league`,
6 `flag.c_confederacy`, 7 `flag.c_harpoon`, 8 `flag.c_brokers`, 9 `flag.c_choir`, 10 `flag.c_free`, 11 `flag.f64`,
12 `flag.guild` (белёная ткань без рисунка, код её перекрасит в цвет гильдии).

```
Game UI asset sheet for a dark Pirate Gothic naval MMORPG: twelve ship flags laid out in a strict grid of 4 columns and 3 rows, all flags exactly the same size and the same rectangular 3:2 shape, each seen flat and straight front-on, centred in its grid cell with wide even gaps between the cells. Every flag is heavy weathered sailcloth with a hand-painted design, faded and salt-stained, slightly frayed at the fly edge, gentle cloth folds, the same soft even light on all twelve, painted realistic style, rich detail, one consistent style across the whole set. The flags, left to right and top to bottom: 1. a flag of peaceful trade: plain undyed bone-white sailcloth with a narrow slate-grey border and no emblem at all. 2. the black flag of a pirate: plain charcoal-black cloth crossed by one broad dried-blood red diagonal band from the lower hoist corner to the upper fly corner, no skull, no bones. 3. a young captain's protection flag: muted moss-green cloth with a small bone-white anchor in the centre and a thin bone-white stripe along the bottom edge. 4. the Crown Admiralty: a slate-navy field with a bone-white fouled anchor crossed by a naval sword, a small tarnished gold crown above them. 5. the Gilded Ledger merchant league: a dull old-gold field with dark brown merchant balance scales standing on an open ledger book. 6. the Red Tide Confederacy of pirate havens: a very dark blood-red field with two crossed cutlasses over a curling crimson wave, a small bone-white skull above them. 7. the Order of the Harpoon, monster hunters of the north: a dark olive-green field with two crossed iron harpoons over a bone-white whale's tail fluke. 8. the Fog Brokers, smugglers and forgers: a dark grey-green field with a pale porcelain half-mask wreathed in grey fog, an old iron key hanging below it. 9. the Choir of the Deep, a cult that prays downward: a deep dark teal field with a verdigris bronze bell wrapped by thin tentacles, a faint turquoise glow inside the bell. 10. the Free Harbors: a weathered ash-grey field with a black iron anchor wound with rope, a small lit brass lantern hanging from its stock. 11. a large tarnished gold wax seal stamped with merchant scales on a field halved black and dull gold. 12. a completely plain flag of undyed very light grey, almost white sailcloth, swallow-tailed at the fly, no emblem, no stripes, no pattern. Muted palette: charcoal black, bone white, dried-blood red, tarnished old gold, slate grey, cold sea blue; low saturation, no bright colours. Background: flat solid pure magenta #FF00FF everywhere between and around the flags, no gradient, no shadow on the background. NO flagpoles, NO ropes, NO text, NO letters, NO numbers, NO labels, NO watermark, NO frame. Avoid: cartoon, flat vector, emoji, cel shading, thick outlines, glossy 3D render, perspective.
```

### Лист B — 6 флагов, сетка 3×2, формат 3:2 → `sheet_b.png`

Ячейки → id: 1 `flag.guild_crown` (белёная ткань с короной — флаг Хозяев Престола, перекрашивается),
2 `flag.sig_red`, 3 `flag.sig_yellow`, 4 `flag.sig_blue`, 5 `flag.sig_white`, 6 `flag.sig_black`.

```
Game UI asset sheet for a dark Pirate Gothic naval MMORPG: six ship flags laid out in a strict grid of 3 columns and 2 rows, all flags exactly the same size and the same rectangular 3:2 shape, each seen flat and straight front-on, centred in its grid cell with wide even gaps between the cells. Every flag is heavy weathered sailcloth, faded and salt-stained, slightly frayed at the fly edge, gentle cloth folds, the same soft even light on all six, painted realistic style, rich detail, one consistent style across the whole set. The flags, left to right and top to bottom: 1. a plain flag of undyed very light grey, almost white sailcloth, swallow-tailed at the fly, with a small tarnished old-gold crown painted near the hoist, nothing else. 2. a plain naval signal flag of faded brick red cloth with a narrow darker hem, no emblem. 3. a plain naval signal flag of faded ochre yellow cloth with a narrow darker hem, no emblem. 4. a plain naval signal flag of faded cold sea blue cloth with a narrow darker hem, no emblem. 5. a plain naval signal flag of bone-white cloth with a narrow grey hem, no emblem. 6. a plain naval signal flag of charcoal black cloth with a narrow grey hem, no emblem. Muted palette, low saturation, no bright colours. Background: flat solid pure magenta #FF00FF everywhere between and around the flags, no gradient, no shadow on the background. NO flagpoles, NO ropes, NO text, NO letters, NO numbers, NO labels, NO watermark, NO frame. Avoid: cartoon, flat vector, emoji, cel shading, thick outlines, glossy 3D render, perspective.
```

---

## Подключение (после генерации)

- Нарезка: `slice_flags.py` (магента, 240×160) — дописать раскладки 4×3 и 3×2 и новые id.
- `colourFlag` (renderer.ts) и `.fl-mark` (flags.css) — картинка `flag.c_*` вместо CSS; `drawPennant` — NPC фракции несут
  `flag.c_<фракция>`, пираты-NPC — `flag.c_pirate`; капитаны — свой цвет как сейчас.
- Цитадели: `flag.guild` / `flag.guild_crown`, перекрашенные в цвет гильдии (как `pennantArt`).
- Мини-игра `flag_hoist`: `flag.sig_*` вместо цветных квадратов.
- Без генерации, только код: значок «в бою» у капитана (`crossedSwords`) → готовая иконка `icon.ui_cutlasses`;
  вымпел на смотровых мысах (`isles.ts`) → готовый `part.pennant`.
