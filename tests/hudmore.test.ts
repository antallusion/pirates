// The sea HUD decluttered (owner, 2026-10-29: «на мобиле лютый графический перегруз, надо все как-то прятать в
// подменюшки»; «скрывать плашки с хп… если бой не начат или цель не выбрана»; «в браузерной версии ты сильно сместил
// аватар и колесо вправо… поменьше это расстояние»): one «⋯» for the rest of the round buttons, a clean top on a calm
// sea, the HUD's safe area capped. Proof shots: tools/mobile/declutter/shots.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MORE_ITEMS, moreBadge } from '../client/src/ui/hudmore.ts';

const css = readFileSync('client/seahud.css', 'utf8');
const styles = readFileSync('client/styles.css', 'utf8');

test('«⋯» gathers what is folded behind it as one badge: the counts summed, else «!»', () => {
  assert.equal(moreBadge([]), '');
  assert.equal(moreBadge(['7', '+', '!']), '7');
  assert.equal(moreBadge(['3', '4']), '7');
  assert.equal(moreBadge(['9', '5']), '9+');
  assert.equal(moreBadge(['+']), '!');
  assert.equal(moreBadge(['!', '']), '!');
});

test('behind «⋯»: the menu, the chat, the island, the offer, the gift, the emotes, the weak army — never the helm, the chart, the guns, her plate or the quests', () => {
  for (const id of ['tc-menu', 'chat-toggle', 'tc-isle', 'tc-offer', 'tc-daily', 'cos-qbtn', 'hud-advice']) assert.ok(MORE_ITEMS.some((s) => s.endsWith(id)), id);
  for (const id of ['tc-stick', 'hud-map', 'tc-fire', 'tc-ammo', 'tc-abil', 'tc-lock', 'hud-captain', 'tc-news', 'tc-act']) assert.ok(!MORE_ITEMS.some((s) => s.includes(id)), id);
  assert.match(css, /body\.hud-more:not\(\.more-open\) \.more-fold \{ display: none !important; \}/);
  // the slide is transform and opacity only
  for (const k of ['more-tray', 'more-in', 'more-pill']) assert.match(css, new RegExp(`@keyframes ${k} \\{ from \\{ opacity: 0; transform: [^}]+\\} \\}`));
  // (owner, 2026-10-29: «иконка квеста должна быть вместо иконки чата») the quests out under the chart, the chat folded
  // (never while it is open or in a boarding), its unread on «⋯»
  assert.match(css, /body\.simple\.hud-more:not\(\.more-desk\) #hud #touch > #tc-news \{ right: calc\(var\(--sa-r\) \+ 8px \+ \(var\(--mm\) - var\(--tr-b\)\) \/ 2\); \}/);
  assert.match(css, /body\.simple\.hud-more:not\(\.more-open\):not\(\.chat-open\):not\(\.tac\) #hud-chat > #chat-toggle\.more-fold \{ display: none !important; \}/);
  assert.match(readFileSync('client/src/ui/hudmore.ts', 'utf8'), /querySelectorAll<HTMLElement>\('\.k-badge, \.chat-unread'\)/);
  // «чуть больше расстояние иконкам»: the tray's gap wider than the row's, so a corner's count keeps off the next button
  assert.match(css, /body\.simple \{ --mg: calc\(var\(--tr-g\) \+ 10px\); \}/);
  assert.match(css, /left: calc\(var\(--sa-l\) \+ 8px \+ var\(--mi, 1\) \* \(var\(--tr-b\) \+ var\(--mg\)\)\) !important;/);
});

test('a calm sea keeps its top clean: no boss bar, no hint line on a touch screen, the autosail a pill; ships whole and unmarked carry no bars', () => {
  assert.match(css, /body\.simple:not\(\.sea-target\):not\(\.sea-fight\) #hud-stack > #hud-boss:not\(:has\(\.balert\)\) \{ display: none !important; \}/);
  assert.match(css, /body\.simple\.touch:not\(\.sea-target\):not\(\.sea-fight\) #hud-bottom > #hud-prompt \{ display: none; \}/);
  assert.match(css, /body\.simple #hud-autosail \.as-lbl \{ display: none; \}/);
  const r = readFileSync('client/src/render/renderer.ts', 'utf8');
  assert.match(r, /if \(isTarget \|\| boardTarget \|\| this\.seaFight \|\| s\.hull < 0\.995 \|\| s\.sails < 0\.995 \|\| s\.flags & SF\.IN_BATTLE\) \{/);
});

test('the HUD takes a notch’s inset capped (22 px a side, 12 below), Telegram’s the same way; the windows keep the full inset', () => {
  assert.match(styles, /#hud, #hud-chat, #hud-toasts \{ --sa-l: min\(max\(env\(safe-area-inset-left, 0px\), var\(--tg-left, 0px\)\), 22px\); --sa-r: min\(max\(env\(safe-area-inset-right, 0px\), var\(--tg-right, 0px\)\), 22px\);/);
  assert.match(styles, /--sa-b: min\(max\(env\(safe-area-inset-bottom, 0px\), var\(--tg-bottom, 0px\)\), 12px\); \}/);
  assert.match(styles, /:root \{\s*--sa-t: env\(safe-area-inset-top, 0px\); --sa-b: env\(safe-area-inset-bottom, 0px\);\s*--sa-l: env\(safe-area-inset-left, 0px\); --sa-r: env\(safe-area-inset-right, 0px\);/);
});

test('«Огонь» with four round it on a phone (owner, 2026-10-29: «4 вокруг иконки… расстояние небольшое»): «Умения», «Приёмы», «Снаряд», «Цель» on one arc, the shot\'s wheel shots only', async () => {
  for (const id of ['tc-skill', 'tc-abil', 'tc-ammo', 'tc-lock']) assert.match(css, new RegExp(String.raw`body\.simple\.touch\.sea-fight #touch > #${id} \{ right: calc\(var\(--sa-r\) \+ var\(--fc\)`), id);
  // the radius: the painted rings (11 % past each button) ~10 px apart
  assert.match(css, /--fR: calc\(var\(--sea-fire\) \* 0\.61 \+ var\(--sat\) \* 0\.61 \+ 12px\);/);
  const { SKILL_IDS, ABIL_IDS } = await import('../client/src/ui/seaabil.ts');
  assert.equal(SKILL_IDS.id, 'tc-skill');
  assert.notEqual(SKILL_IDS.body, ABIL_IDS.body);
  const main = readFileSync('client/src/main.ts', 'utf8');
  assert.match(main, /const seaSkill = new SeaAbil\(\$\('touch'\), \(id\) => \{\s+if \(id !== 'none'\) pickFireWheel\(id\);\s+\}, SKILL_IDS\);/);
  assert.match(readFileSync('client/src/ui/seahud.ts', 'utf8'), /attachWheel\(this\.ammoEl, \{ options: \(\) => hooks\.fireOptions\(\)\.filter\(\(o\) => o\.id\.startsWith\('a:'\)\)/);
  // the dash's chip off the wheel and its gold arc
  assert.match(css, /body\.simple\.touch #tc-dashchip \{ top: calc\(var\(--stick\) \* 0\.067 - 45\.3px\); right: calc\(var\(--stick\) \/ 4 - 32\.5px\); \}/);
});

test('no mark by itself (owner, 2026-10-29: «автофокусов быть не должно»): the frame, the rim\'s arrows and the gunners keep to her own mark', () => {
  const main = readFileSync('client/src/main.ts', 'utf8');
  assert.ok(!/function shipStep\(/.test(main));
  const r = readFileSync('client/src/render/renderer.ts', 'utf8');
  assert.match(r, /if \(s\.id !== mark && s\.id !== board\) continue;/);
  assert.match(readFileSync('server/src/game/pursuit.ts', 'utf8'), /const t = gunneryMark\(game, ship, false\);/);
});
