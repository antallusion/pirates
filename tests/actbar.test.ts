// The context action bar over the guns (owner, 2026-10-02): every thing at hand a button in one order — the first the
// one the gamepad's A does (padContext, which runs the bar's first) — every one in sight (2026-10-18), no key chips on
// touch, the land key's share of the mast, the net and the sea marks, and «Look…» for a card closed by hand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actBarHtml, buildActs, landKeyAct, markInfo } from '../client/src/ui/actbar.ts';
import type { ActFacts, ActId, LandAction } from '../client/src/ui/actbar.ts';
import { EN, RU } from '../client/src/lang/ui/actbar.ts';
import { EN as EASE_EN, RU as EASE_RU } from '../client/src/lang/ui/ease.ts';
import { TIP_IDS } from '../client/src/ui/ease.ts';
import { MARK_KINDS } from '../shared/src/data/seamarks.ts';
import { setLang } from '../client/src/i18n.ts';
import { Rng } from '../shared/src/rng.ts';

const ALL: ActFacts = {
  grabbed: true,
  board: { name: 'Black Gull' },
  port: { name: 'Fogmouth' },
  landable: { action: 'land', feature: 'the cove', island: 'Saltmere' },
  mastWreck: true,
  cast: 'net',
  home: { name: 'Home Rock' },
  claim: { name: 'Wild Rock', price: '1 200' },
  ritual: true,
  mark: { id: 7, kind: 'wreck' },
  looks: [{ kind: 'lair', name: 'Siren lair' }],
  repair: { repairing: false, combat: false, hurt: true },
};

/** The pad's A as it was before the bar (main.ts's padContext of 2026-10-01), for the cases it knew. */
function oldPad(f: ActFacts): ActId | null {
  if (f.grabbed) return 'axes';
  if (f.docked) return f.harbourOpen ? null : 'harbour';
  if (f.board) return 'board';
  if (f.port) return 'dock';
  if (f.landable && !f.landable.blocked) return 'land';
  if (f.mastWreck) return 'cut_mast';
  if (f.cast) return 'cast';
  if (f.home) return 'base';
  if (f.claim) return 'claim';
  const r = f.repair;
  if (r && (r.repairing || (!r.combat && r.hurt))) return 'repair';
  return null;
}

test('every thing at hand is a button, each with its icon, word, title and key', () => {
  const acts = buildActs(ALL);
  assert.deepEqual(acts.map((a) => a.id), ['axes', 'board', 'dock', 'land', 'cut_mast', 'cast', 'base', 'ritual', 'mark', 'look', 'repair']);
  for (const a of acts) assert.ok(a.icon && a.label && a.title, a.id);
  const key = Object.fromEntries(acts.map((a) => [a.id, a.key ?? null]));
  assert.deepEqual(key, { axes: 'board', board: 'board', dock: 'dock', land: 'land', cut_mast: 'land', cast: 'land', base: null, ritual: null, mark: 'land', look: null, repair: 'repair' });
  // A claim only where she has no island of her own at hand; every landing's kind its own word.
  assert.ok(buildActs({ claim: { name: 'Wild Rock', price: '900' } }).some((a) => a.id === 'claim'));
  const words = new Set<string>();
  for (const action of ['land', 'dig', 'raise', 'expedition', 'descent', 'keeper', 'escort', 'dive', 'lair'] as LandAction[]) {
    const [a] = buildActs({ landable: { action, feature: 'the reef', island: 'Saltmere' } });
    assert.equal(a.id, 'land');
    words.add(a.label);
  }
  assert.equal(words.size, 9, 'nine landings, nine words');
  assert.deepEqual(buildActs({ landable: { action: 'dig', feature: 'x', island: 'y', blocked: true } }), [], 'a blocked landing is the info line, not a button');
  assert.deepEqual(buildActs({ docked: true }).map((a) => a.id), ['harbour']);
  assert.deepEqual(buildActs({ docked: true, harbourOpen: true }), []);
  assert.deepEqual(buildActs({ cast: 'lamp' }).map((a) => a.icon), ['item_squid_lamp']);
  // The carpenters: not while fighting, not with nothing to mend, not short of planks; always to stop them.
  assert.deepEqual(buildActs({ repair: { repairing: false, combat: true, hurt: true } }), []);
  assert.deepEqual(buildActs({ repair: { repairing: false, combat: false, hurt: false } }), []);
  // short of planks or sailcloth: the button stays, its press says what is wanted (owner, 2026-10-19)
  assert.equal(buildActs({ repair: { repairing: false, combat: false, hurt: true, short: true } })[0].id, 'repair');
  assert.equal(buildActs({ repair: { repairing: true, combat: true, hurt: true } })[0].id, 'repair');
  // Each mark kind its own word and icon; worked today or at work: no button (the info line says so).
  for (const k of MARK_KINDS) {
    const [a] = buildActs({ mark: { id: 1, kind: k } });
    assert.equal(a.id, 'mark');
    assert.equal(a.arg, '1');
    assert.equal(buildActs({ mark: { id: 1, kind: k, done: true } }).length, 0);
    assert.equal(buildActs({ mark: { id: 1, kind: k, busy: true } }).length, 0);
  }
  // Her island's window or the claim's terms open: their buttons step aside.
  assert.deepEqual(buildActs({ home: { name: 'H' }, homeOpen: true }), []);
  assert.deepEqual(buildActs({ claim: { name: 'W', price: '1' }, claimOpen: true }), []);
  // Each card closed by hand its «Look».
  const looks = buildActs({ looks: [{ kind: 'obj', name: 'Altar' }, { kind: 'guard', name: 'Hulk' }, { kind: 'lair', name: 'Den' }, { kind: 'drift', name: 'Seals' }] });
  assert.deepEqual(looks.map((a) => [a.id, a.arg]), [['look', 'obj'], ['look', 'guard'], ['look', 'lair'], ['look', 'drift']]);
  // A struck ship's terms put off by «Later»: her «Look…» too (main.ts asks the surrender card).
  assert.equal(buildActs({ looks: [{ kind: 'struck', name: 'Red Shrike' }] })[0].icon, 'talent_brd_surrender_terms');
  assert.match(readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8'), /surrenderCard\.laterName\(\)/);
});

test('the gold button is the one the pad\'s A always took, and padContext runs the bar\'s first', () => {
  const rng = new Rng(4711);
  const pick = <T>(v: T): T | undefined => (rng.chance(0.4) ? v : undefined);
  for (let i = 0; i < 4000; i++) {
    const f: ActFacts = {
      grabbed: rng.chance(0.08),
      docked: rng.chance(0.08),
      harbourOpen: rng.chance(0.5),
      board: pick({ name: 'B' }) ?? null,
      port: pick({ name: 'P' }) ?? null,
      landable: pick({ action: rng.pick(['land', 'dig', 'lair', 'keeper'] as LandAction[]), feature: 'f', island: 'i', blocked: rng.chance(0.3) }) ?? null,
      mastWreck: rng.chance(0.3),
      cast: rng.chance(0.3) ? rng.pick(['net', 'lamp'] as const) : null,
      home: pick({ name: 'H' }) ?? null,
      claim: pick({ name: 'C', price: '1' }) ?? null,
      repair: pick({ repairing: rng.chance(0.3), combat: rng.chance(0.4), hurt: rng.chance(0.6) }) ?? null,
    };
    // The cases the old pad knew: the same first. (Off her own island the claim waits behind it, as the prompt had.)
    const want = oldPad(f);
    const first = buildActs(f)[0]?.id ?? null;
    if (want === 'claim' && f.home) continue;
    assert.equal(first, want, JSON.stringify(f));
  }
  // The new ones come after everything the pad knew and before the carpenters.
  assert.equal(buildActs({ mark: { id: 1, kind: 'drift' }, repair: { repairing: false, combat: false, hurt: true } })[0].id, 'mark');
  assert.equal(buildActs({ mark: { id: 1, kind: 'drift' }, cast: 'net' })[0].id, 'cast');
  assert.equal(buildActs({ looks: [{ kind: 'lair', name: 'Den' }], repair: { repairing: true, combat: false, hurt: true } })[0].id, 'look');
  // main.ts: the pad's A (and every key that shares the bar's button) runs the bar's own list.
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  // (QA 2026-10-22: the gold button's own act first, by its id — liveAct — else the bar's first)
  const pad = main.slice(main.indexOf('function padContext(id?: string): void {'), main.indexOf('/** Lying off one\'s own island'));
  assert.match(pad, /liveAct\(id\) \?\? gatherActs\(\)\.acts\[0\]/);
  assert.match(pad, /gatherActs\(\)\.acts\[0\]/);
  assert.match(pad, /runAct\(first\)/);
  assert.match(main, /landKeyAct\(gatherActs\(\)\.acts\)/, 'the land key');
  assert.match(main, /const a = b \? curActs\[Number\(b\.dataset\.act\)\] : down && performance\.now\(\) - down\.at < 800 \? curActs\.find\(\(x\) => x\.id === down\.id\) : undefined;\r?\n {2}if \(a\) runAct\(a\);/, 'a click (the pressed button kept across a redraw)');
});

test('the land key takes the mast, the net, the sea mark in the bar\'s order', () => {
  assert.equal(landKeyAct(buildActs({ mastWreck: true, cast: 'net', mark: { id: 2, kind: 'buoy' } }))?.id, 'cut_mast');
  assert.equal(landKeyAct(buildActs({ cast: 'net', mark: { id: 2, kind: 'buoy' } }))?.id, 'cast');
  assert.equal(landKeyAct(buildActs({ mark: { id: 2, kind: 'buoy' }, board: { name: 'X' } }))?.id, 'mark');
  assert.equal(landKeyAct(buildActs({ board: { name: 'X' } })), null);
});

test('every button in sight at once, none behind «⋯ N more» (owner, 2026-10-18); one gold one; no key chips on touch', () => {
  setLang('ru');
  try {
    const acts = buildActs(ALL);
    assert.ok(acts.length >= 10, `${acts.length}`);
    const all = actBarHtml(acts, ['Защищены — выстрел снимет защиту'], (a) => a.toUpperCase());
    const btns = (h: string) => (h.match(/<button /g) ?? []).length;
    assert.equal(btns(all), acts.length, 'every one');
    assert.ok(!/data-act-more|⋯|act-more-row/.test(all), 'no toggle, no hidden row');
    acts.forEach((_, i) => assert.ok(all.includes(`data-act="${i}"`), `#${i}`));
    assert.match(all, /act-btn act-axes primary" data-act="0"/);
    assert.equal((all.match(/ primary/g) ?? []).length, 1, 'one gold button');
    assert.match(all, /<div class="act-info">Защищены/);
    assert.match(all, /<kbd class="act-k">BOARD<\/kbd>/);
    assert.match(all, /class="act-row act-many"/);
    const touch = actBarHtml(acts, [], null);
    assert.ok(!/<kbd/.test(touch), 'no keys on touch');
    const three = actBarHtml(buildActs({ board: { name: 'B' }, port: { name: 'P' }, cast: 'net' }), [], null);
    assert.equal(btns(three), 3);
    assert.equal(actBarHtml([], [], null), '');
    assert.match(markInfo('wreck', 'done'), /^Поле обломков: на сегодня всё$/);
    assert.match(markInfo('drift', 'busy', 2.2), /Плавник: шлюпки за работой… 3[\s ]с/);
    // Every word in Russian.
    for (const a of acts) assert.ok(/[А-Яа-я]/.test(a.label) && !/[A-Za-z]{2,}/.test(a.label), a.label);
  } finally {
    setLang('en');
  }
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  // The stylesheet keeps every button one height.
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.act-btn \{ --h: 34px; box-sizing: border-box; height: var\(--h\);/);
});

test('the first time the bar shows something, a hint says what it is', () => {
  assert.ok(TIP_IDS.includes('actions'));
  assert.ok(EASE_EN['tip.actions'] && EASE_RU['tip.actions']);
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /firstTips\.offer\('actions', true\)/);
});

test('«Атаковать» only within her guns’ real reach of a ship on her screen (owner, 2026-10-22); the row pops up and sinks away', async () => {
  const { attackRelevant } = await import('../client/src/ui/actbar.ts');
  // beyond her guns, or off her screen (or under the fog): no button — her mark however pinned is sailed to from its menu
  assert.equal(attackRelevant(false, true), false);
  assert.equal(attackRelevant(true, false), false);
  assert.equal(attackRelevant(false, false), false);
  assert.equal(attackRelevant(true, true), true);
  const { readFileSync } = await import('node:fs');
  const main = readFileSync('client/src/main.ts', 'utf8');
  assert.ok(main.includes('attackable(targetId) && !roamLead && attackRelevant(gunLeft <= 0, tgtSeen, '), 'the bar asks it');
  const hud = readFileSync('client/src/ui/seahud.ts', 'utf8'), css = readFileSync('client/seahud.css', 'utf8');
  assert.ok(hud.includes("' tc-pop'") && hud.includes("classList.add('tc-out')"), 'a new button pops up, an empty row sinks away');
  assert.ok(/@keyframes tc-pop/.test(css) && /@keyframes tc-out/.test(css) && /prefers-reduced-motion: reduce\) \{ #touch > \.tc-actrow/.test(css));
  // the unified design kept: the same class for every button
  assert.ok(hud.includes('class="${actBtnClass(false)}${was.has(x.id)'));
});
