// batch-pc (owner, 2026-10-26): at 1366×768 the First Watch's finger left of the market's «Купить» lay over the price
// column of «Провизия» — only buttons were looked for under it. Now prices and labels weigh most, and the finger tries
// left, above, below and right for the place that hides nothing (checked at 1366×768, 1536×864 and 1920×1080 by
// assets/raw/audit/pc/finger.mjs: «Провизия» from above, nothing covered).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COVER, coverCount, pointerSpot } from '../client/src/ui/pointer.ts';

/** A market row at 1366×768: the name 315–560, the price 955–1000, «Купить» 1008–1096, «Продать» 1106–1190; rows 52 px. */
const rowAt = (top: number) => ({ name: [315, 560, top + 6, top + 30], price: [955, 1000, top + 4, top + 34], buy: [1008, 1096, top, top + 36], sell: [1106, 1190, top, top + 36] });
function market(rows: number[], { textAbove = false } = {}) {
  const els = rows.map(rowAt);
  const inBox = (b: number[], x: number, y: number) => x >= b[0] && x <= b[1] && y >= b[2] && y <= b[3];
  return (x: number, y: number, size: number, targetTop: number): number => {
    let n = 0;
    for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) {
      const px = x + size * fx, py = y + size * fy;
      for (const r of els) {
        const own = r.buy[2] === targetTop;
        if (inBox(r.price, px, py) || inBox(r.name, px, py)) n += COVER.word;
        else if (inBox(r.buy, px, py) && !own) n += COVER.button;
        else if (inBox(r.sell, px, py)) n += own ? COVER.rowButton : COVER.button;
      }
      if (textAbove && py < rows[0] - 4 && py > rows[0] - 30 && px < 700) n += COVER.word;
    }
    return n;
  };
}

test('the finger never lies over a price or a label: «Провизия» at the top of the list is pointed at from above', () => {
  const rows = [359, 411, 463];
  const covers = market(rows, { textAbove: true });
  const r = { left: 1008, top: 359, width: 88, height: 36 };
  const s = pointerSpot(r, 44, 1366, 768, (x, y, size) => covers(x, y, size, 359));
  assert.equal(s.dir, 'down', 'from above (left of «Купить» is the price column)');
  assert.ok(s.x + 44 > r.left && s.x < r.left + r.width && s.y + 44 <= r.top, 'over the button, above it');
  assert.equal(covers(s.x, s.y, 44, 359), 0, 'hides nothing');
});

test('a row in the middle of the list: never the price; its own «Продать» rather than another row\'s «Купить»', () => {
  const rows = [359, 411, 463, 515];
  const covers = market(rows);
  const r = { left: 1008, top: 463, width: 88, height: 36 };
  const s = pointerSpot(r, 44, 1366, 768, (x, y, size) => covers(x, y, size, 463));
  assert.equal(s.dir, 'left', 'from the right, pointing left');
  const left = covers(r.left - 48, r.top - 4, 44, 463);
  assert.ok(left >= COVER.word, 'the left side lies over the price column');
  assert.ok(covers(s.x, s.y, 44, 463) < COVER.word, 'no word under it');
});

test('coverCount weighs what is under the finger: a word, a button, a picture; the target and the empty panel are nothing', () => {
  const doc = (globalThis as { document?: unknown }).document;
  const mk = (tag: string, parent: unknown = null) => ({ tag, parent, matches: (q: string) => q.split(',').some((s) => s.trim() === tag), closest(q: string) { for (let e: any = this; e; e = e.parent) if (q.split(',').some((s) => { s = s.trim(); return s === e.tag || (s === '.w-row' && e.tag === 'row') || (s === 'button' && e.tag === 'button'); })) return e; return null; }, contains(o: unknown) { for (let e: any = o; e; e = e.parent) if (e === this) return true; return false; } });
  const row = mk('row'), target = mk('button', row), sell = mk('button', row), price = mk('span', row), panel = mk('div');
  const at = (e: unknown) => () => e as Element;
  assert.equal(coverCount(0, 0, 44, target as unknown as Element, at(target)), 0);
  assert.equal(coverCount(0, 0, 44, target as unknown as Element, at(panel), () => false), 0, 'a panel with no words where the finger is');
  assert.equal(coverCount(0, 0, 44, target as unknown as Element, at(price), () => true), 9 * COVER.word);
  assert.equal(coverCount(0, 0, 44, target as unknown as Element, at(sell)), 9 * COVER.rowButton);
  assert.equal(doc, (globalThis as { document?: unknown }).document);
});

test('the finger points left from the right too (feel.css), weighed again only when its button moves', () => {
  const css = readFileSync(new URL('../client/feel.css', import.meta.url), 'utf8');
  assert.match(css, /#tut-finger\.left \.tf-hand \{ rotate: -90deg;/);
  const src = readFileSync(new URL('../client/src/ui/pointer.ts', import.meta.url), 'utf8');
  assert.match(src, /this\.el\.classList\.toggle\('left', spot\.dir === 'left'\);/);
  assert.match(src, /coverCount\(x, y, size, t, \(px, py\) => document\.elementFromPoint\(px, py\)\)/);
  assert.match(src, /if \(!this\.spot \|\| key !== this\.spotKey \|\| now - this\.spotAt > 500\)/);
});
