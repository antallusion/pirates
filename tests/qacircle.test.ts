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
    querySelectorAll: () => [],
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
  delete (globalThis as { document?: unknown }).document; // the stub page goes (the next tests set the language)
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
    // (a screen's own line is Russian through and through — «e-mail» stood alone as a placeholder; server and data lines
    // without a Russian letter are names)
    if (typeof v !== 'string' || (!/[А-Яа-яЁё]/.test(v) && !(f === 'ru.ts' || !/^(server|data)/.test(f)))) continue;
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

test('the chart\'s folded legend lays out nothing (QA: «you» 6px past a 38px-wide hidden column in English)', () => {
  assert.ok(css.includes('.map-legend:not([open]) .lg-items { display: none; }'));
});

test('a shipyard hull\'s «Research her first» wraps inside its 104px column (it ran 7px out in English, 16px in Russian)', () => {
  assert.ok(css.includes('.hull-card .item-btn { white-space: normal; text-align: center; line-height: 1.15; overflow-wrap: anywhere; }'));
});

test('other ships are drawn smoothly: a ship whose word of her speed is three times her way never steps back (QA circle)', async () => {
  const { ClientState } = await import('../client/src/state.ts');
  const st = new ClientState();
  // A great one swims 11 m/s and says «11» (a ship saying 11 would make 33): ten samples a second, along x.
  let now = 100;
  const realNow = performance.now.bind(performance);
  performance.now = () => now * 1000;
  try {
    st.serverTime = 50;
    st.serverTimeArrival = now;
    const buf = Array.from({ length: 40 }, (_, i) => ({ t: 47 + i * 0.1, x: 1000 + 11 * i * 0.1, y: 500, h: Math.PI / 2, spd: 11, sail: 1, hull: 1, sails: 1, flags: 0, crew: 1 }));
    st.ships.set(7, { id: 7, info: null, buf, cur: buf[0], wake: [], sinkStart: 0, gap: 0.1 } as never);
    const xs: number[] = [];
    for (let f = 0; f < 60; f++) {
      now += 1 / 60;
      st.updateRemote();
      xs.push(st.ships.get(7)!.cur.x);
    }
    const steps = xs.slice(1).map((x, i) => x - xs[i]);
    assert.ok(steps.every((d) => d > 0), `no step back: ${steps.map((d) => d.toFixed(2)).join(' ')}`);
    // Every frame's way within a third of her true 11/60 m.
    for (const d of steps) assert.ok(Math.abs(d - 11 / 60) < (11 / 60) / 3, `a frame's way ${d.toFixed(3)}`);
  } finally {
    performance.now = realNow;
  }
});

test('every master of an NPC ship reads in Russian on the deck battle\'s plate («the Deep» came through in English)', async () => {
  const { setLang } = await import('../client/src/i18n.ts');
  const { personName } = await import('../client/src/lang/names.ts');
  await import('../client/src/lang/server.ts');
  const { readFileSync, readdirSync } = await import('node:fs');
  // Every literal captain the server gives a ship of its own.
  const dir = new URL('../server/src/game/', import.meta.url);
  const names = new Set<string>();
  for (const f of readdirSync(dir)) for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/captain: '([^']{3,})'/g)) if (m[1] !== 'corsair' && !m[1].endsWith(' ')) names.add(m[1]);
  assert.ok(names.size >= 15);
  setLang('ru');
  try {
    const bad = [...names].filter((n) => /[A-Za-z]{2,}/.test(personName(n)));
    assert.deepEqual(bad, []);
    assert.equal(personName('Bounty Hunter Morrow Ickes'), 'Охотник за головами Морроу Икс');
    assert.equal(personName('Qa d3ml'), 'Qa d3ml', 'a player\'s name stays');
  } finally {
    setLang('en');
  }
});

test('a boarding\'s end keeps to a band, not the field\'s middle (popup budget)', () => {
  assert.ok(css.includes('.tb-banner:not(:has(.tb-landclose)) { top: auto; bottom: 8px; transform: translateX(-50%); max-height: calc(30vh - 16px);'));
  assert.ok(css.includes('.tb-banner:not(:has(.tb-landclose)) { top: 4px; bottom: auto;'));
});

test('a Wanted toast reads whole in Russian: the level\'s name and the crime («Suspect (attacked …)» came through)', async () => {
  const { setLang } = await import('../client/src/i18n.ts');
  const { applyDataLocale } = await import('../client/src/lang/data.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  const { WANTED_TITLES } = await import('../shared/src/data/factions.ts');
  setLang('ru');
  applyDataLocale('ru');
  try {
    for (const t of WANTED_TITLES) for (const why of ['attacked Iron Verdict', 'boarded Iron Verdict', 'sank Iron Verdict', 'took Iron Verdict', 'smuggling', 'ran from a Crown patrol', 'harboured a convict', 'offered a bribe to the Crown', 'gave no quarter', 'selling stolen goods']) {
      const ru = serverText(`Wanted 1: ${t} (${why}).`);
      assert.doesNotMatch(ru.replace('Iron Verdict', ''), /[A-Za-z]{2,}/, ru);
    }
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});

test('a short screen: the adventure card in the top row, the toasts in a side column, the bar\'s hint in the bar (popup budget)', () => {
  assert.ok(css.includes('#advcard { top: var(--ts-top, 8px); left: calc(var(--ts-left, 408px) - 48px);'));
  assert.ok(css.includes('body:has(#advcard:not(.hidden)) #toasts { top: var(--tq-top, var(--ts-top)); left: var(--tq-left, var(--ts-left)); width: var(--tq-w, var(--ts-w)); }'));
  assert.ok(css.includes('body.ai-low #hud-prompt .act-info { position: fixed;'));
  assert.ok(css.includes('body.pb-3 #hud-stack > #hud-tip { display: none !important; }'));
  const card = readFileSync(new URL('../client/src/ui/advcard.ts', import.meta.url), 'utf8');
  assert.match(card, /if \(innerHeight <= 520\) max = Math\.max\(60, Math\.floor\(innerHeight \* 0\.25 - top\)\);/);
});

test('the island\'s defence line wraps in a narrow column; a hovered piece\'s card goes with the gear window', () => {
  assert.ok(css.includes('.base-def .bmeta { white-space: normal; max-width: 100%; min-width: 0; }'));
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.ok(main.includes("if (modal !== 'gear') document.querySelectorAll('.gear-tip').forEach((e) => e.remove());"));
});

test('toasts that cannot stand under the middle go to a side band, as compact as on a phone; the action buttons are centred', () => {
  assert.ok(css.includes('body.tq-side #toasts { top: var(--tq-top) !important;'));
  assert.ok(css.includes('body.tq-side #toasts .toast.herald b { font-size: 15px; line-height: 18px; white-space: nowrap;'));
  const hud = readFileSync(new URL('../client/src/ui/hud.ts', import.meta.url), 'utf8');
  assert.match(hud, /private placeDeskStrip\(z: number\): void/);
  assert.match(css, /\.act-btn \{ --h: 34px; box-sizing: border-box; height: var\(--h\); display: inline-flex; align-items: center; gap: 5px; padding: 0 8px;/);
});

test('a salvage with silver in it reads in Russian («1 Provisions, 6 Planks & Pitch, …, 296 silver» stayed English)', async () => {
  const { setLang } = await import('../client/src/i18n.ts');
  const { applyDataLocale } = await import('../client/src/lang/data.ts');
  const { serverText } = await import('../client/src/lang/server.ts');
  setLang('ru');
  applyDataLocale('ru');
  try {
    assert.equal(serverText('Salvaged: 1 Provisions, 6 Planks & Pitch, 1 Sailcloth, 296 silver.').replace(/ /g, ' '), 'Поднято со дна: провизия — 1, доски и смола — 6, парусина — 1, серебро — 296.');
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});

test('/board alongside grapples the /foe ship, not a great one swimming at the same spot (the test battle\'s link)', async () => {
  const { runAdmin } = await import('../server/src/game/admin.ts');
  const { join, makeGame } = await import('./helpers.ts');
  const { game } = makeGame();
  const conn = join(game, 'Linker');
  conn.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => (x.conn as unknown) === conn)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  runAdmin(game, s, '/foe pirate sloop 18');
  const foe = [...game.ships.values()].find((o) => o !== ship && o.npcRole === 'pirate' && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 30)!;
  // A great one right on top of her, nearer than the foe.
  const boss = game.spawnNpcShip('ghost', 'brig', 'choir', ship.state.x + 2, ship.state.y + 2, 0);
  boss.npcRole = 'boss';
  assert.match(runAdmin(game, s, '/board') ?? '', /Grappled/);
  assert.equal(ship.boarding?.with, foe.id);
});

test('English titles sit in their plates\' middle (IM Fell English SC rode 1.9px high)', () => {
  assert.ok(css.includes('html[lang=en] .skinned .modal-head h2 { padding: 3px 6px 0; }'));
  assert.ok(css.includes('html[lang=en] .skinned .title-sm { padding: 2px 6px 0; }'));
});
