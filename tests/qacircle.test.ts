// The QA circle (owner, 2026-10-04: «QA-проход по кругу»): the fixes it found, each held by a test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CENTRE, fitTransient } from '../client/src/ui/hud.ts';

const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8');

/** A stub page: the stack's transient blocks at the heights each step of terseness leaves them. */
function page(W: number, H: number, rects: (cls: Set<string>) => Record<string, [number, number, number, number] | null>) {
  const cls = new Set<string>();
  const body = { classList: { add: (...c: string[]) => c.forEach((x) => cls.add(x)), remove: (...c: string[]) => c.forEach((x) => cls.delete(x)), contains: (c: string) => cls.has(c) } };
  const g = globalThis as unknown as Record<string, unknown>;
  g.innerWidth = W;
  g.innerHeight = H;
  g.document = {
    body,
    getElementById: (id: string) => {
      const r = rects(cls)[id];
      if (r === undefined) return null;
      return {
        classList: { contains: (c: string) => c === 'hidden' && r === null },
        getBoundingClientRect: () => (r ? { left: r[0], top: r[1], right: r[2], bottom: r[3], width: r[2] - r[0], height: r[3] - r[1] } : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
      };
    },
  };
  return cls;
}

test('popup budget: the sea\'s news, a hint and a boss\'s card keep out of the screen\'s centre (1280×720 unfolded)', () => {
  // QA, 2026-10-04: unfolded at 1280×720 the news sat at the bottom of the top stack, 455–511 px — in the centre.
  assert.deepEqual(CENTRE, { from: 0.3, to: 0.7 });
  // styles.css puts them at the stack's head, ahead of the standing plates (the target, the goals).
  assert.match(css, /#hud-stack > #hud-tip, #hud-stack > #hud-feed, #hud-stack > #hud-boss \{ order: -2; \}/);
  // Alone at the head: nothing to do.
  let cls = page(1280, 720, () => ({ 'hud-tip': [480, 56, 800, 119], 'hud-feed': [480, 123, 800, 180], 'hud-boss': null }));
  fitTransient();
  assert.equal(cls.size, 0);
  // Under a boss's card the news reaches the centre: terser first (pb-1), and that is enough.
  cls = page(1280, 720, (c) => ({ 'hud-tip': [480, 56, 800, c.has('pb-1') ? 98 : 119], 'hud-boss': [480, 123, 800, c.has('pb-1') ? 180 : 243], 'hud-feed': c.has('pb-1') ? [480, 184, 800, 206] : [480, 247, 800, 303] }));
  fitTransient();
  assert.deepEqual([...cls], ['pb-1']);
  // Not enough: the news steps out (it is in the chat's log).
  cls = page(1280, 720, (c) => ({ 'hud-tip': [480, 56, 800, 98], 'hud-boss': [480, 102, 800, 174], 'hud-feed': c.has('pb-2') ? null : [480, 178, 800, 232] }));
  fitTransient();
  assert.deepEqual([...cls].sort(), ['pb-1', 'pb-2']);
  // Out of the centre sideways (a phone's stack at the left edge): left alone.
  cls = page(1280, 720, () => ({ 'hud-feed': [8, 300, 300, 330] }));
  fitTransient();
  assert.equal(cls.size, 0);
  // The steps exist in the stylesheet.
  assert.ok(css.includes('body.pb-2 #hud-stack > #hud-feed { display: none !important; }'));
  assert.ok(css.includes('body.pb-1 #hud-feed .feed-h'));
});

test('not a word of Latin in a Russian line a player reads (QA circle: NPC, PvP, HUD, WebGL, e-mail, UTC, MMORPG)', async () => {
  const { readdirSync } = await import('node:fs');
  // Key names, roman numerals, the game's name, ship names (HMS …), the gamepad's own button names, chat commands.
  const OK = /^(Tab|Shift|Ctrl|Alt|Esc|Enter|Space|Backspace|Del|Ins|Home|End|PgUp|PgDn|Caps|LMB|RMB|MMB|WASD|F\d{1,2}|[A-Za-z]|[IVX]+|GRAVETIDE|HMS|Menu|View|gc|nbsp|px)$/;
  const dir = new URL('../client/src/lang/', import.meta.url);
  const tables: [string, Record<string, unknown>][] = [];
  for (const f of readdirSync(dir)) if (f.endsWith('.ts') && /ru/.test(f) && !/admin/.test(f)) for (const v of Object.values(await import(new URL(f, dir).href) as Record<string, unknown>)) if (v && typeof v === 'object') tables.push([f, v as Record<string, unknown>]);
  for (const f of readdirSync(new URL('ui/', dir))) { const m = await import(new URL(`ui/${f}`, dir).href) as { RU?: Record<string, unknown> }; if (m.RU) tables.push([f, m.RU]); }
  const bad: string[] = [];
  for (const [f, t] of tables) for (const [k, v] of Object.entries(t)) {
    if (typeof v !== 'string' || !/[А-Яа-яЁё]/.test(v)) continue;
    // The admin's usage lines and the server's own setup notes are for the tester, not the player.
    if (/^Usage|Usage:|LINK_SECRET|\/auth\/|\/reset|#reset=|(^|[\s(«])\/[a-z]{2,}\b/.test(k + ' ' + v)) continue;
    const words = (v.replace(/\{\w+\}|<[^>]+>|&\w+;/g, ' ').match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).filter((w) => !OK.test(w));
    if (words.length) bad.push(`${f} ${k.slice(0, 40)}: ${words.join(' ')}`);
  }
  assert.deepEqual(bad, []);
});

test('every deed\'s condition and every legendary ship\'s gift and price have Russian (they reached the screen in English)', async () => {
  const { TEXT_FIELDS, textPaths } = await import('../tools/i18n-data.ts');
  const { DATA_RU } = await import('../client/src/lang/data.ts');
  for (const f of ['condition', 'gift', 'price']) assert.ok(TEXT_FIELDS.has(f), f);
  const p = textPaths();
  const ours = Object.keys(p).filter((k) => /\.(condition|gift|price)$/.test(k));
  assert.ok(ours.length >= 34);
  assert.deepEqual(ours.filter((k) => !DATA_RU[k]), []);
});
