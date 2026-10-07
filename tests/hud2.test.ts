// The painted HUD's return (owner, 2026-10-07: «ты испортил всё вообще… возвращай иконки, обводки графические…
// штурвал на мобилах… сделать круче»; «при наведении на цель показывать иконку атаки»; «наводя на кого-то пальцем или
// на десктопе мышкой, надо предлагать захват цели и преследование и бой»): the attack cursor's kinds and its art from the
// tattoo set (its skin cleared in a canvas), the target's choices standing clear of her and on the screen, every art id
// the controls use present among the game's own assets (nothing painted anew), the painted rims in the stylesheet.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attackKind, CURSOR_ART, keySkin } from '../client/src/ui/cursor.ts';
import { menuLayout, TM_ARM_MS } from '../client/src/ui/targetmenu.ts';
import { SEA_ART } from '../client/src/ui/seahud.ts';
import { EN as SEN, RU as SRU } from '../client/src/lang/ui/seahud.ts';

const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: Record<string, { local: string }> };

test('the attack cursor: the hook when the grapples reach her, the gun when no grapple takes her, the sabres for any other foe', () => {
  assert.equal(attackKind({ ship: { attackable: true, boardable: true, inReach: true } }), 'board');
  assert.equal(attackKind({ ship: { attackable: true, boardable: true, inReach: false } }), 'attack');
  assert.equal(attackKind({ ship: { attackable: true, boardable: false, inReach: true } }), 'guns', 'a beast, a zone boss, «Абордаж: выкл»');
  assert.equal(attackKind({ ship: { attackable: false, boardable: true, inReach: true } }), null, 'a friend: the plain arrow');
  assert.equal(attackKind({ stack: true }), 'attack');
  assert.equal(attackKind({ stack: false }), null, 'another captain\'s fight');
  assert.equal(attackKind({ lair: { battery: true } }), 'guns', 'a fort whose battery still fires');
  assert.equal(attackKind({ lair: { battery: false } }), 'attack');
  assert.equal(attackKind({}), null);
});

test('the cursor\'s art is the tattoo set\'s own (sabres, hook, gun): its skin cleared, the ink kept', () => {
  for (const id of Object.values(CURSOR_ART)) assert.ok(manifest.assets[id], `${id} in the manifest`);
  // a made-up tattoo: warm skin (with a darker vignette to the edge) and a grey-steel cross with a black line round it
  const W = 40, px = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const edge = Math.min(x, y, W - 1 - x, W - 1 - y);
    const ink = Math.abs(x - y) <= 3 || Math.abs(x + y - (W - 1)) <= 3;
    const line = !ink && (Math.abs(x - y) <= 4 || Math.abs(x + y - (W - 1)) <= 4);
    const skin = [Math.min(235, 150 + edge * 5), Math.min(170, 105 + edge * 4), Math.min(125, 85 + edge * 3)];
    const [r, g, b] = ink ? [150, 152, 158] : line ? [25, 22, 20] : skin;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  }
  const kept = keySkin(px, W, W);
  const a = (x: number, y: number) => px[(y * W + x) * 4 + 3];
  assert.equal(a(0, 20), 0, 'the skin at the edge cleared');
  assert.equal(a(20, 4), 0, 'the skin between the arms cleared');
  assert.ok(a(20, 20) > 200 && a(10, 10) > 200 && a(30, 9) > 200, 'the ink kept');
  assert.ok(kept > 150 && kept < W * W * 0.6, `${kept} pixels kept`);
});

test('the target\'s choices stand beside her on an arc: never over her, a finger apart, on the screen, on the free side', () => {
  for (const [vw, vh, item] of [[812, 375, 48], [640, 360, 48], [1500, 600, 44], [1024, 768, 48]]) {
    for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.15], [0.85, 0.9], [0.9, 0.1], [0.05, 0.5]]) {
      const x = vw * fx, y = vh * fy, r = 26;
      const g = menuLayout(3, x, y, r, vw, vh, item);
      assert.equal(g.side, x > vw * 0.66 ? 'left' : 'right');
      for (const p of g.items) {
        assert.ok(p.x - item / 2 >= 0 && p.x + item / 2 <= vw && p.y - item / 2 >= 0 && p.y + item / 2 <= vh, `${vw}×${vh} at ${fx},${fy}: ${p.x},${p.y} on the screen`);
        // clear of her picture unless the screen's edge pressed the arc onto her (then still not on her middle)
        const d = Math.hypot(p.x - x, p.y - y);
        if (fx > 0.1 && fx < 0.9 && fy > 0.2 && fy < 0.8) assert.ok(d >= r + item / 2, `${vw}×${vh}: a choice ${d.toFixed(0)} px from her middle`);
        else assert.ok(d >= item / 2, `${vw}×${vh} at the edge: off her middle`);
      }
      for (let i = 1; i < g.items.length; i++) assert.ok(Math.hypot(g.items[i].x - g.items[i - 1].x, g.items[i].y - g.items[i - 1].y) >= item, 'a finger apart');
      // never above her: her name and bars are drawn there
      if (fy > 0.2 && fy < 0.75) for (const p of g.items) assert.ok(p.y >= y - item * 0.6, 'not over her name');
    }
  }
  assert.ok(TM_ARM_MS >= 250, 'the tap that opened them cannot pick one');
});

test('every control\'s art is the game\'s own: the sea HUD\'s pictures, the target\'s choices, the rims', () => {
  for (const id of Object.values(SEA_ART)) assert.ok(manifest.assets[`icon.${id}`], `icon.${id}`);
  for (const id of ['item_ranging_glass', 'talent_nav_wake_rider', 'ab_red_hook_boarding', 'talent_gun_rolling_broadside', 'bt_charge']) assert.ok(manifest.assets[`icon.${id}`], `icon.${id}`);
  for (const id of ['ui.ring', 'ui.slot', 'ui.bar', 'ui.helm', 'ui.stick_base', 'ui.minimap_ring']) assert.ok(manifest.assets[id], id);
  const main = readFileSync('client/src/main.ts', 'utf8');
  for (const id of ['item_ranging_glass', 'talent_nav_wake_rider', 'ab_red_hook_boarding', 'talent_gun_rolling_broadside', 'bt_charge']) assert.ok(main.includes(`'${id}'`), `${id} used by the choices`);
});

test('the stylesheet: the painted rims on every control of the sea, the attack cursor, the choices in their rings', () => {
  const css = readFileSync('client/seahud.css', 'utf8');
  for (const sel of ['.sea-round::after', '.tc-big::after', '.cs-frame::after', '.tm-pic::after']) assert.ok(new RegExp(`${sel.replace(/[.()]/g, '\\$&')}[^{]*\\{[^}]*var\\(--ui-ring\\)`).test(css), `${sel}: the porthole ring`);
  assert.match(css, /\.dk-slot::after \{[^}]*var\(--ui-slot\)/);
  assert.match(css, /\.cs-bar \{[^}]*border-image: var\(--ui-bar\)/);
  assert.match(css, /#world\[data-cur='attack'\] \{ cursor: var\(--cur-attack, crosshair\), crosshair; \}/);
  assert.match(css, /#world\[data-cur='board'\] \{ cursor: var\(--cur-board/);
  assert.match(css, /#world\[data-cur='guns'\] \{ cursor: var\(--cur-guns/);
  assert.match(css, /#board-tac canvas\[data-cur='attack'\]/);
  // the touch screen's fight buttons keep 44 px at the least (accessibility), the choices 48 px
  assert.match(css, /body\.simple \{ --sea-pad: 10px; --sea-fire: 80px; --sea-btn: 48px;/);
  assert.match(css, /body\.touch \.tm-item \{ width: 48px; height: 48px; \}/);
  // the hex battle's cursor is set by the field (tactical.ts), from the same three kinds
  const tac = readFileSync('client/src/ui/tactical.ts', 'utf8');
  assert.match(tac, /v\.melee\.includes\(s\.id\) \? 'attack' : v\.shoot\.includes\(s\.id\) \? 'guns'/);
});

test('the choices\' words in both languages, the Russian without Latin', () => {
  for (const k of ['tm.lock', 'tm.pursue', 'tm.fight', 'tm.lockT', 'tm.pursueT', 'tm.pursueGuns', 'tm.pursueStack', 'tm.fightBoard', 'tm.fightGuns', 'tm.fightStack', 'tm.aria', 'helmDesk', 'deck'] as const) {
    assert.ok(SEN[k] && SRU[k], k);
    assert.ok(!/[A-Za-z]{2,}/.test(SRU[k].replace(/\{\w+\}/g, '')), `${k}: ${SRU[k]}`);
  }
  assert.equal(SRU['tm.lock'], 'Захват цели');
  assert.equal(SRU['tm.pursue'], 'Преследовать');
  assert.equal(SRU['tm.fight'], 'Бой');
});
