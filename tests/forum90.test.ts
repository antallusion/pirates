// Forum, Эдуард, post 90 (topic 7, 2026-11-04): «пробовал сделать переход Холлоумир — Грейвсенд, а приехал на
// Тайдрэк». The server carried her where the button asked (the log: ferry→tidewrack); the list is drawn anew every few
// seconds and the passage went on the first tap. Now every «Переход» button asks first, naming the port and the price,
// and the order carries the port the question named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EN, RU } from '../client/src/lang/ui/ferry.ts';

const ferry = readFileSync(new URL('../client/src/ui/ferry.ts', import.meta.url), 'utf8');
const card = readFileSync(new URL('../client/src/ui/portcard.ts', import.meta.url), 'utf8');

test('post 90: the passage button names its port and price, and asks before the order goes', () => {
  assert.match(ferry, /data-ferry="\$\{esc\(r\.to\)\}" data-ferry-name="\$\{esc\(placeName\(p\.name\)\)\}" data-ferry-price="\$\{r\.price\}"/);
  assert.match(ferry, /export async function askFerry[\s\S]{0,400}await ask\(LF\('ask'[\s\S]{0,200}send\(\{ t: 'ferry', to \}\)/);
  assert.match(ferry, /export function bindFerry[\s\S]{0,200}askFerry\(b, send\)/);
  assert.doesNotMatch(card, /deps\?\.send\(\{ t: 'ferry'/);
  assert.match(card, /askFerry\(b, send\)/);
});

test('post 90: the question in both tongues', () => {
  assert.equal(RU.ask, 'Переход в {to} за {price} серебра?');
  assert.ok(EN.ask.includes('{to}') && EN.ask.includes('{price}'));
  assert.equal(RU.askYes, 'Отправиться');
});
