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

test('behind «⋯»: the menu, the news, the island, the offer, the gift, the emotes, the weak army — never the helm, the chart, the guns, her plate or the chat', () => {
  for (const id of ['tc-menu', 'tc-news', 'tc-isle', 'tc-offer', 'tc-daily', 'cos-qbtn', 'hud-advice']) assert.ok(MORE_ITEMS.some((s) => s.endsWith(id)), id);
  for (const id of ['tc-stick', 'hud-map', 'tc-fire', 'tc-ammo', 'tc-abil', 'tc-lock', 'hud-captain', 'chat-toggle', 'tc-act']) assert.ok(!MORE_ITEMS.some((s) => s.includes(id)), id);
  assert.match(css, /body\.hud-more:not\(\.more-open\) \.more-fold \{ display: none !important; \}/);
  // the slide is transform and opacity only
  for (const k of ['more-tray', 'more-in', 'more-pill']) assert.match(css, new RegExp(`@keyframes ${k} \\{ from \\{ opacity: 0; transform: [^}]+\\} \\}`));
  // the chat out under the chart (a wide desk keeps it by the helm)
  assert.match(css, /body\.simple\.hud-more:not\(\.more-desk\):not\(\.chat-open\):not\(\.tac\) #hud-chat > \.chat-toggle \{ top: var\(--tr-top\)/);
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
