// Forum 48 (topic 8): the gold arc round the helm shows the sail she ACTUALLY carries — the helmsman's and the
// auto-battle's too, and a shred of it when her sails are shot away (it stayed at 0 under the auto-battle and full on torn
// sails); the jury sail stands still no more under a storm or a fire with its clock run down to «0 с», and says what it
// is; the offer card's buttons in one row with its arrows on the dots' line («›» fell to a line of its own).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JURY_TO, stormSails } from '../shared/src/data/adrift.ts';
import type { AdriftView } from '../shared/src/data/adrift.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { juryRigging } from '../server/src/game/adrift.ts';
import { startPursuit } from '../server/src/game/pursuit.ts';
import { gaugeDeg, helmsmanSails, sailGauge } from '../client/src/ui/sailgauge.ts';
import { adriftFacts, adriftInfo, juryButton, juryTapText } from '../client/src/ui/adrift.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { setLang } from '../client/src/i18n.ts';
import { EN as SEN, RU as SRU } from '../client/src/lang/ui/seahud.ts';
import { EN as AEN, RU as ARU } from '../client/src/lang/ui/adrift.ts';
import { duelSea, openWater } from './balance/duel.ts';
import { seaCaptain } from './balance/seafight.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

const YOU = { sail: 1, sailT: 1, sails: 100, sailsMax: 100 };
const NONE = { autosail: null, pursuit: null, roamRun: null, helm: false, voyage: null };

// ------------------------------------------------------------------------------------------------ the arc

test('forum 48: the arc in every mode is the sail she carries (the server\'s setting × her sails), the order faint past it', () => {
  // manual, full sail ordered and set
  assert.deepEqual(sailGauge({ docked: false, you: YOU, helmsman: false, step: 4 }), { lit: 1, ordered: 1, health: 1, torn: false });
  // manual, two steps asked, the canvas still coming in (the server's setting at 0.3): lit 0.3, the order 0.5
  let g = sailGauge({ docked: false, you: { ...YOU, sail: 0.3, sailT: 0.5 }, helmsman: false, step: 2 });
  assert.ok(Math.abs(g.lit - 0.3) < 1e-9 && g.ordered === 0.5);
  // the auto-battle / a chase / a course to a mark: the captain's step stays 0, the helmsman's sail is what shows
  g = sailGauge({ docked: false, you: { ...YOU, sail: 0.92, sailT: 1 }, helmsman: true, step: 0 });
  assert.ok(Math.abs(g.lit - 0.92) < 1e-9 && g.ordered === 1, `auto-battle: ${JSON.stringify(g)}`);
  assert.ok(gaugeDeg(g.lit) > 240, 'the arc nearly round under the auto-battle');
  // overloaded: the hold slows her, not her canvas — the arc is her sail, the speed under it lower
  assert.equal(sailGauge({ docked: false, you: YOU, helmsman: false, step: 4 }).lit, 1);
  // her sails shot away (the bar at 0.4 %), full sail ordered: a sliver, never full; the order shown torn
  g = sailGauge({ docked: false, you: { ...YOU, sails: 0.4 }, helmsman: false, step: 4 });
  assert.ok(g.lit > 0 && g.lit < 0.01 && g.torn && g.ordered === 1, `torn: ${JSON.stringify(g)}`);
  assert.ok(gaugeDeg(g.lit) > 0 && gaugeDeg(g.lit) <= 5, `a sliver: ${gaugeDeg(g.lit)}°`);
  // the jury sail at a quarter: a quarter of the arc at full sail
  g = sailGauge({ docked: false, you: { ...YOU, sails: 25 }, helmsman: false, step: 4 });
  assert.ok(Math.abs(g.lit - 0.25) < 1e-9 && !g.torn);
  // anchored / hove to / an all-stop: the server's setting 0, whatever her old step
  assert.equal(sailGauge({ docked: false, you: { ...YOU, sail: 0, sailT: 0 }, helmsman: false, step: 3 }).lit, 0);
  // in port (a berth, a ferry's landing): nothing, as the speed under it is blank
  assert.deepEqual(sailGauge({ docked: true, you: YOU, helmsman: false, step: 4 }), { lit: 0, ordered: 0, health: 1, torn: false });
  assert.equal(gaugeDeg(0), 0);
  assert.equal(gaugeDeg(1), 270);
  // who sets her sails
  assert.equal(helmsmanSails(NONE), false);
  assert.equal(helmsmanSails({ ...NONE, autosail: { x: 1, y: 1 } }), true, 'a course to a mark');
  assert.equal(helmsmanSails({ ...NONE, pursuit: { target: 1, mode: 'guns' } }), true, 'a chase, the auto-battle');
  assert.equal(helmsmanSails({ ...NONE, pursuit: { target: 1, mode: 'guns' }, helm: true }), false, 'her own hand on the helm in a chase');
  assert.equal(helmsmanSails({ ...NONE, roamRun: 3 }), true);
  assert.equal(helmsmanSails({ ...NONE, voyage: { v: 1 } }), true, 'a passage, the ferry');
});

test('forum 48: under a chase by the helmsman the arc comes from the server\'s sail (the captain\'s step stays 0)', () => {
  const game = duelSea();
  const at = openWater(game, 7);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const foe = game.spawnNpcShip('pirate', 'sloop', 'free', at.x, at.y - 1400, 0);
  assert.equal(startPursuit(game, s, foe.id, 'guns'), null);
  steps(game, 20 * 4);
  const c = s.conn as unknown as FakeConn;
  const snap = [...c.inbox].reverse().find((m) => m.t === 'snap' && (m as { you?: unknown }).you) as { you: { sail: number; sailT: number; sails: number; sailsMax: number } } | undefined;
  assert.ok(snap, 'a snapshot with her');
  assert.ok(snap.you.sail > 0.3, `the helmsman made sail: ${snap.you.sail}`);
  const g = sailGauge({ docked: false, you: snap.you, helmsman: true, step: 0 });
  assert.ok(Math.abs(g.lit - snap.you.sail * (snap.you.sails / snap.you.sailsMax)) < 1e-9 && g.lit > 0.3, `lit ${g.lit}`);
});

test('forum 48: the speed\'s words name the sails drawing; both languages', () => {
  for (const k of ['speedAria', 'speedAriaTorn'] as const) {
    assert.ok(SEN[k].includes('{p}') && SRU[k].includes('{p}') && SRU[k].includes('{n}'), k);
    assert.ok(!/[a-z]/i.test(SRU[k].replace(/\{[a-z]+\}/g, '')), `no Latin: ${k}`);
  }
});

// ------------------------------------------------------------------------------------------------ the jury sail

function atSea(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.ship!.docked = null;
  s.profile!.docked = null;
  s.ship!.state.x = 30000;
  s.ship!.state.y = 80000;
  s.ship!.crew = s.ship!.stats.crewMax;
  return { c, s };
}
const frac = (s: PlayerSession) => s.ship!.sails / s.ship!.stats.sailHpMax;

test('forum 48: a storm on full sail never tears the jury rig — it goes up to a quarter in a minute', () => {
  assert.equal(stormSails(0.5, 1.2, 100, 0), 0.5, 'no lower than she is, under a quarter');
  assert.equal(stormSails(30, 1.2, 100, 0), 28.8, 'above a quarter the storm bites');
  assert.equal(stormSails(25.5, 1.2, 100, 0), 25, 'down to a quarter and no lower');
  assert.equal(stormSails(10, 1.2, 100, 1), 8.8, 'sailcloth aboard: the storm bites as ever');
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Storm Sue');
  const ship = s.ship!;
  ship.cargo = {};
  ship.sails = 0;
  (game as unknown as { weatherAt: () => string }).weatherAt = () => 'storm';
  for (let i = 0; i < 62; i++) {
    ship.input = { rudder: 0, sailTarget: 1 };
    steps(game, 20);
  }
  assert.ok(Math.abs(frac(s) - JURY_TO) < 0.005, `a quarter in a storm: ${frac(s).toFixed(3)}`);
  assert.equal(juryRigging(ship), false);
  assert.equal(c.last('adrift')?.v ?? null, null);
});

test('forum 48: a fire aboard holds the rig (its clock does not run), canvas torn as fast as rigged says so', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Fire Fay');
  const ship = s.ship!;
  ship.cargo = {};
  ship.sails = 0;
  ship.addEffect({ id: 'fire', until: game.now + 5 } as never, game.now);
  steps(game, 20 * 3);
  let v = c.last('adrift')?.v as AdriftView;
  assert.ok(v && v.paused && v.hold === 'fire', `fire: ${JSON.stringify(v)}`);
  // the client's clock holds while it waits: 40 s later still the server's seconds, never «0 с»
  setLang('ru');
  const f = adriftFacts(v, 40)!;
  assert.equal(f.left, v.left);
  assert.equal(adriftInfo(f).replace(/\s/g, ' '), 'Корабль без парусов · аварийный парус ждёт: пожар на борту');
  assert.match(juryTapText(f), /пожар/);
  // the fire out: it goes up
  ship.effects = ship.effects.filter((e) => e.id !== 'fire');
  steps(game, 20 * 5);
  v = c.last('adrift')?.v as AdriftView;
  assert.ok(v && !v.paused && v.hold === null && (v.sails ?? 0) > 0.01, `rigging: ${JSON.stringify(v)}`);
  // torn every second faster than rigged (anything else): it says it stalls
  for (let i = 0; i < 4; i++) {
    steps(game, 20);
    ship.sails = Math.max(0, ship.sails - ship.stats.sailHpMax * 0.01);
  }
  steps(game, 20);
  v = c.last('adrift')?.v as AdriftView;
  assert.ok(v && v.paused && v.hold === 'torn', `torn: ${JSON.stringify(v)}`);
  assert.match(adriftInfo(adriftFacts(v, 30)!).replace(/\s/g, ' '), /не растёт/);
  setLang('en');
});

test('forum 48: the jury sail\'s words — her sails of a quarter and the seconds, never «0 с»; the button says what it does', () => {
  setLang('ru');
  const v: AdriftView = { jury: 0.4, left: 36, stranded: true, paused: false, hold: null, sails: 0.1, cd: 0, port: 'p' };
  const f = adriftFacts(v, 0)!;
  assert.equal(adriftInfo(f).replace(/\s/g, ' '), 'Корабль без парусов · аварийный парус: 10 из 25 % парусов · ещё 36 с');
  // the clock run out before the next word from the server: «почти готов», not «0 с»
  const late = adriftFacts(v, 50)!;
  assert.equal(late.left, 0);
  assert.ok(!/\b0 с/.test(adriftInfo(late)) && /почти готов/.test(adriftInfo(late)), adriftInfo(late));
  const b = juryButton(f);
  assert.equal(b.label.replace(/\s/g, ' '), 'Аварийный парус');
  assert.equal(b.sub.replace(/\s/g, ' '), '36 с');
  assert.equal(juryButton(late).sub, 'почти');
  const t = b.title.replace(/\s/g, ' ');
  assert.match(t, /сама и бесплатно/);
  assert.match(t, /нажимать ничего не нужно/);
  assert.match(t, /до 25 %/);
  assert.match(t, /парусиной из трюма/);
  const acts = buildActs({ adrift: f });
  const j = acts.find((a) => a.id === 'jury')!;
  assert.equal(j.label.replace(/\s/g, ' '), 'Аварийный парус');
  assert.ok(!/\d+%$/.test(j.label), 'no bare «2%» on the button');
  // an older view (no `sails`): her sails from the rig's progress
  assert.equal(adriftFacts({ jury: 0.4, left: 36, stranded: false, paused: false, cd: 0, port: null }, 0)!.now, 10);
  setLang('en');
  for (const k of Object.keys(AEN) as (keyof typeof AEN)[]) {
    assert.ok(ARU[k] && /[а-яё]/i.test(ARU[k]) && !/[a-z]/i.test(ARU[k].replace(/\{[a-z]+\}/g, '')), k);
  }
});

// ------------------------------------------------------------------------------------------------ the offer card

test('forum 48: the offer card\'s buttons in one row that never wraps; «‹ ›» at the ends of the dots\' line', () => {
  const src = readFileSync('client/src/ui/promo.ts', 'utf8');
  const acts = src.slice(src.indexOf('<div class="po-acts">'), src.indexOf('<div class="po-dots">'));
  assert.ok(acts.includes('data-poshop') && acts.includes('data-polater') && acts.includes('data-pomore') && acts.includes('data-pobuy'));
  assert.ok(!acts.includes('data-poprev') && !acts.includes('data-ponext'), 'no arrows in the buttons\' row');
  const dots = src.slice(src.indexOf('<div class="po-dots">'), src.indexOf('this.tell(live'));
  assert.ok(dots.indexOf('data-poprev') >= 0 && dots.indexOf('data-poprev') < dots.indexOf('this.list.map') && dots.indexOf('data-ponext') > dots.indexOf('this.list.map'), 'the arrows at the dots\' ends');
  const css = readFileSync('client/promo.css', 'utf8');
  assert.match(css, /\.po-acts \{[^}]*flex-wrap: nowrap/);
  assert.match(css, /\.po-acts \.btn \{[^}]*min-width: 0[^}]*white-space: nowrap[^}]*text-overflow: ellipsis/);
  assert.ok(!/\.po-acts \{[^}]*flex-wrap: wrap/.test(css), 'no wrap anywhere');
});
