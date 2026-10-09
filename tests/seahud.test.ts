// docs/23 phase 2: the sea HUD on a phone held sideways — the sea and five buttons (client/src/ui/seahud.ts,
// client/src/touch.ts). The pure parts: the stick's pull as the sail, the small refusals that flash instead of a
// toast, «Особое»'s pick, the count of things to touch (seven at most), the wheel that holds the fire wheel's twelve,
// the old touch buttons gone from the page, and the First Watch's phone texts naming the new buttons.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bestSpecial, minimapMode, pettyOf, SEA_TILES, seaTargets, stickSail } from '../client/src/ui/seahud.ts';
import { defaults, sanitize } from '../client/src/settings.ts';
import { EN as WEN, RU as WRU } from '../client/src/lang/ui/win.ts';
import type { SeaView } from '../client/src/ui/seahud.ts';
import { pickSector, WHEEL_MAX, wheelLayout } from '../client/src/ui/kit/radial.ts';
import { EN as SEN, RU as SRU } from '../client/src/lang/ui/seahud.ts';
import { EN } from '../client/src/lang/en.ts';
import { RU } from '../client/src/lang/ru.ts';
import { EN as FEN, RU as FRU } from '../client/src/lang/ui/seafight.ts';
import { EN as AEN, RU as ARU } from '../client/src/lang/ui/actbar.ts';

test('the stick: the dead middle keeps the sail, the pull sets 1–4 steps, full sail at the rim and past it', () => {
  assert.equal(stickSail(5, 48, 13), null);
  assert.equal(stickSail(14, 48, 13), 1);
  assert.equal(stickSail(25, 48, 13), 2);
  assert.equal(stickSail(35, 48, 13), 3);
  assert.equal(stickSail(48, 48, 13), 4);
  assert.equal(stickSail(90, 48, 13), 4);
  // monotone: a farther pull never asks for less sail
  let last = 0;
  for (let d = 13; d < 60; d++) {
    const s = stickSail(d, 48, 13)!;
    assert.ok(s >= last, `${d}`);
    last = s;
  }
});

test('the small refusals flash a button instead of a toast; the rest stay toasts', () => {
  assert.equal(pettyOf('Guns are still loading'), 'fire');
  assert.equal(pettyOf('She is not on your beam'), 'fire');
  assert.equal(pettyOf('No ship in reach of your guns'), 'fire');
  assert.equal(pettyOf('Double Shot is not ready'), 'special');
  assert.equal(pettyOf('Last Volley needs full resolve (40/100) — trade blows to build it'), 'special');
  assert.equal(pettyOf('The crew is still hauling the braces (4 s)'), 'stick');
  assert.equal(pettyOf('Take in sail before entering harbour'), null);
  assert.equal(pettyOf('Safe waters: no PvP here.'), null);
});

test('«Особое»: the ultimate when it is ready, else the strongest stroke ready, none when nothing is', () => {
  const a = (id: string, ready: boolean, cooldown: number, kind: 'active' | 'ultimate' = 'active') => ({ id, ready, cooldown, kind });
  assert.equal(bestSpecial([a('z', true, 30), a('x', true, 20), a('c', true, 40), a('v', true, 150, 'ultimate')]), 'v');
  assert.equal(bestSpecial([a('z', true, 30), a('x', true, 20), a('c', false, 40), a('v', false, 150, 'ultimate')]), 'z');
  assert.equal(bestSpecial([a('z', false, 30), a('v', false, 150, 'ultimate')]), null);
});

test('seven things to touch at most on a touch screen’s sea, in every state of the HUD (eight in a fight only when she brings the chart back herself); a desk’s drawn controls nine at most', () => {
  const tg = { name: 'Covenant', level: 1, hull: 1, crew: 0.7, chance: 0.6 };
  for (const touch of [true, false, undefined]) for (const docked of [false, true]) for (const fight of [false, true, undefined]) for (const act of [null, { id: 'attack', icon: 'x', label: 'Атаковать', more: 3 }]) for (const special of [null, { id: 'v', icon: 'ab_v', name: 'V' }]) for (const target of [null, tg]) for (const news of [0, 5]) for (const mm of ['default', 'tapped', 'setting'] as const) {
    const v: SeaView = { docked, touch, fight: fight === undefined ? undefined : fight || !!target, act, special, target, ammo: 'round', ammoN: 60, reload: 1, news, unread: 2, markId: target ? 7 : null, ...(mm === 'tapped' ? { mmOut: true } : mm === 'setting' ? { mmShow: true } : {}) };
    const t = seaTargets(v);
    const mode = minimapMode(v);
    if (touch === false) {
      // the desk plays by its keys and shows what they drive (owner, 2026-10-07: «возвращай управление… штурвал»): the
      // helm, «Огонь», «Цель» and the gun deck at sea in every state, «В море» in port — nine things at most; its chart
      // never steps aside
      assert.ok(t.length <= 9, `${JSON.stringify(v)} → ${t.join(',')}`);
      assert.equal(mode, 'shown');
      if (docked) assert.ok(t.includes('cast') && !t.includes('stick') && !t.includes('fire'), t.join(','));
      else assert.ok(t.includes('stick') && t.includes('fire') && t.includes('lock') && t.includes('deck') && !t.includes('ammo'), t.join(','));
      continue;
    }
    const inFight = !docked && (v.fight ?? !!target);
    // The default (owner, 2026-10-09): seven at most, the chart's tab one of them; she may ask for the chart back (the
    // tab's tap, the setting): eight then.
    assert.ok(t.length <= (mm === 'default' || !inFight ? 7 : 8), `${JSON.stringify(v)} → ${t.join(',')}`);
    if (inFight) {
      assert.ok(!t.includes('news'), 'a fight puts the counter away');
      assert.ok(t.includes('fire') && t.includes('stick') && t.includes('ammo') && t.includes('lock'), 'a fight: «Огонь», «Снаряд», «Цель» and the helm');
      if (mm === 'default') {
        assert.equal(mode, 'peek');
        assert.ok(t.includes('mmtab') && !t.includes('minimap') && !t.includes('menu'), 'the chart and the menu up behind one tab');
      } else {
        assert.equal(mode, 'out');
        assert.ok(t.includes('minimap') && t.includes('menu') && !t.includes('mmtab'), 'the chart and the menu back');
      }
    } else {
      assert.equal(mode, 'shown');
      assert.ok(t.includes('minimap') && t.includes('menu') && !t.includes('mmtab'));
      if (!docked) assert.ok(t.includes('stick') && !t.includes('fire') && !t.includes('special'), t.join(',')); // leaving port: the helm, no guns
      else assert.ok(t.includes('cast') && !t.includes('stick'), 'in port: «В море», no helm');
    }
  }
});

test('the chart with a mark on a touch screen (owner, 2026-10-09): stepped up behind its tab, back by a tap until the next mark, or always by the setting', () => {
  const css = readFileSync(new URL('../client/seahud.css', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8');
  // No longer hidden outright with a mark or in a fight: it slides (a transform), its tab stays to tap.
  assert.ok(!/sea-(target|fight) #hud-map[^{]*\{ display: none/.test(css + styles), 'not display: none');
  assert.match(css, /body\.touch\.mm-peek #hud-map \{ transform: translateY\(/);
  assert.match(css, /body\.touch\.mm-peek #touch > #mm-tab \{ display: block;[^}]*height: calc\(var\(--sa-t\) \+ 44px\)/);
  assert.match(css, /transition: transform var\(--k-dur-3/);
  // The setting, its words in both tongues, and the tab's.
  assert.equal(defaults().mmTarget, 'hide');
  assert.equal(sanitize({ mmTarget: 'show' }).mmTarget, 'show');
  assert.equal(sanitize({ mmTarget: 'sideways' as never }).mmTarget, 'hide');
  assert.equal(WRU['opt.mmTarget'], 'Мини-карта при цели');
  assert.deepEqual([WRU['opt.mmHide'], WRU['opt.mmShow']], ['Прятать', 'Всегда показывать']);
  for (const k of ['opt.mmTarget', 'opt.mmHide', 'opt.mmShow', 'opt.mmTargetHint'] as const) assert.ok(WEN[k] && !/[А-Яа-я]/.test(WEN[k]) && !/[A-Za-z]{2,}/.test(WRU[k]), k);
  assert.ok(SRU.mmShow && SEN.mmShow && !/[A-Za-z]{2,}/.test(SRU.mmShow));
  // Her tap is held for the mark she tapped it on (seahud.ts), the chart's own tap first asks it (main.ts).
  const hud = readFileSync(new URL('../client/src/ui/seahud.ts', import.meta.url), 'utf8');
  assert.ok(hud.includes('if (!fight || (mark !== null && mark !== this.mmMark)) this.mmOut = false;'));
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.ok(main.includes("if (seaHud.mapTap()) return;") && main.includes("mmShow: settings().mmTarget === 'show'") && main.includes('markId: targetId'));
});

test('the menu: eight big tiles, «Ещё» among them', () => {
  assert.equal(SEA_TILES.length, 8);
  assert.ok(SEA_TILES.some((x) => x.id === 'more'));
  assert.ok(SEA_TILES.some((x) => x.id === 'map'));
});

test('the wheel holds twelve and keeps every choice on a phone held sideways', () => {
  assert.equal(WHEEL_MAX, 12);
  for (const [W, H] of [[812, 375], [640, 360]]) for (const [x, y] of [[W - 40, H - 40], [W / 2, H / 2], [40, 40]]) {
    const g = wheelLayout(12, x, y, W, H, 82, 44, 6);
    for (const it of g.items) assert.ok(it.x - 22 >= 0 && it.x + 22 <= W && it.y - 22 >= 0 && it.y + 22 <= H, `${W}×${H} at ${x},${y}: ${it.x},${it.y}`);
    // neighbours a finger's width apart
    const d = Math.hypot(g.items[0].x - g.items[1].x, g.items[0].y - g.items[1].y);
    assert.ok(d >= 50, `${d}`);
  }
  assert.equal(pickSector(0, -60, 12), 0);
});

test('the old touch buttons are gone from the page and the stylesheet', () => {
  const html = readFileSync('client/index.html', 'utf8');
  const css = readFileSync('client/styles.css', 'utf8');
  for (const id of ['tc-sail', 'tc-sail-up', 'tc-sail-down', 'tc-port', 'tc-starboard', 'tc-chasers', 'tc-dash', 'tc-mount', 'tc-context', 'tc-ctx-row']) {
    assert.ok(!html.includes(`id="${id}"`), `${id} in index.html`);
    assert.ok(!new RegExp(`#${id}\\b`).test(css), `#${id} in styles.css`);
  }
  assert.ok(html.includes('id="tc-stick"'));
});

test('the sea HUD speaks both languages, the Russian without Latin', () => {
  assert.deepEqual(Object.keys(SRU).sort(), Object.keys(SEN).sort());
  for (const [k, v] of Object.entries(SRU)) assert.ok(!/[A-Za-z]{2,}/.test(v.replace(/\{\w+\}/g, '')), `${k}: ${v}`);
});

test('the First Watch on a phone names the new buttons, not the old ones (docs/23 item 79: the very words on them)', () => {
  const ru = RU as Record<string, string>, en = EN as Record<string, string>;
  const word = (d: Record<string, string>, k: string) => `«${d[k].replace(/\s*\[.*\]$/, '')}»`;
  assert.ok(ru['stage.attack.touch'].includes(word(FRU, 'a.attack')) && en['stage.attack.touch'].includes(word(FEN, 'a.attack')));
  assert.ok(ru['stage.fire.touch'].includes(word(SRU, 'fire')) && en['stage.fire.touch'].includes(word(SEN, 'fire')));
  assert.ok(ru['stage.board.touch'].includes(word(ARU, 'a.board')) && en['stage.board.touch'].includes(word(AEN, 'a.board')));
  assert.ok(ru['stage.port.touch'].includes(word(ARU, 'a.dock')) && en['stage.port.touch'].includes(word(AEN, 'a.dock')));
  assert.match(ru['stage.sail.touch'], /штурвал/i);
  // One action each, no paragraphs: a step's line is a short sentence.
  for (const id of ['sail', 'attack', 'fire', 'board', 'port']) for (const d of [ru, en]) for (const k of [`stage.${id}`, `stage.${id}.touch`, `stage.${id}.body`]) assert.ok(d[k].length <= 48, `${k}: ${d[k]}`);
  for (const k of ['hint.repair.touch', 'hint.docking.touch']) {
    assert.match(ru[k], /«Действие»/, k);
    assert.match(en[k], /«Action»/, k);
  }
  for (const [k, v] of Object.entries(ru)) if (k.endsWith('.touch')) assert.ok(!/Стрелки у штурвала|Две кнопки с пушками|Бортовые кнопки|кнопки бортов/.test(v), `${k}: an old button`);
  for (const [k, v] of Object.entries(en)) if (k.endsWith('.touch')) assert.ok(!/The arrows by the wheel|two gun buttons|broadside buttons/.test(v), `${k}: an old button`);
});

test('the fire wheel of twelve at the screen corner is a grid over the finger: on the screen, a finger apart, the lit choice the one under the finger', async () => {
  const { wheelGrid, nearestChoice } = await import('../client/src/ui/kit/radial.ts');
  for (const [W, H] of [[812, 375], [640, 360]]) {
    const x = W - 50, y = H - 50; // «Огонь» in the corner
    const g = wheelGrid(12, x, y, W, H, 44);
    for (const it of g.items) {
      assert.ok(it.x - 22 >= 0 && it.x + 22 <= W && it.y - 22 >= 0 && it.y + 22 <= H, `${W}×${H}: ${it.x},${it.y}`);
      assert.ok(it.y + 22 <= y - 18, 'every choice above the finger, none under the thumb');
    }
    for (let i = 0; i < g.items.length; i++) for (let j = i + 1; j < g.items.length; j++) {
      assert.ok(Math.hypot(g.items[i].x - g.items[j].x, g.items[i].y - g.items[j].y) >= 50, 'a finger apart');
    }
    for (let i = 0; i < g.items.length; i++) assert.equal(nearestChoice(g.items, g.items[i].x + 6, g.items[i].y - 5, 44 * 0.85), i);
    assert.equal(nearestChoice(g.items, x, y, 44 * 0.85), -1, 'still on the button: nothing taken');
  }
});
