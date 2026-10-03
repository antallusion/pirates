// A captain's saga (docs/12 P10 #20): the journal notes a chapter for the deeds worth the telling (the day of her
// voyages, or of the holiday then on); a chapter shared in the chat is a postcard for everyone, once a minute; each
// reader's client tells it in its tongue.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHARE_EVERY_SEC } from '../shared/src/data/saga.ts';
import type { SagaEntry } from '../shared/src/data/saga.ts';
import { sagaNote, shareSaga } from '../server/src/game/saga.ts';
import { buyIsland } from '../server/src/game/estate.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import { setLang } from '../client/src/i18n.ts';
import { tellSaga } from '../client/src/ui/saga.ts';
import { join, makeGame, onWeekday } from './helpers.ts';

test('a chapter for a deed: the day of her voyages; on a holiday, the holiday’s day', () => {
  const { game } = makeGame();
  onWeekday(game); // the first chapter is a weekday's
  const c = join(game, 'Chronicle Cara');
  const s = game.sessionByName('Chronicle Cara')!;
  sagaNote(game, s, 'storm_heart', ['Gravewater Sea']);
  const e = s.profile!.saga!.at(-1)!;
  assert.equal(e.kind, 'storm_heart');
  assert.ok(e.day >= 1 && e.holiday === null);
  assert.ok(c.all('toast').some((t) => t.msg === 'A new chapter of your saga.'));
  game.db.setKv('holiday_force', { id: 'herring_run', until: game.wallNow() + 2 * 3600_000 });
  sagaNote(game, s, 'record_fish', ['Bluefin Tuna'], 212.5);
  const h = s.profile!.saga!.at(-1)!;
  assert.equal(h.holiday, 'herring_run');
  assert.equal(h.n, 212.5);
});

test('deeds write themselves: an island bought is a chapter', () => {
  const { game } = makeGame();
  join(game, 'Owner Oona');
  const s = game.sessionByName('Owner Oona')!;
  s.profile!.gold = 2_000_000;
  const is = game.world.islands.find((i) => !i.portId && i.region === 'black_coast' && i.radius > 150 && !game.holdings.get(game, i.id))!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 150), y = is.y - Math.cos(a) * (is.radius + 150);
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.region = is.region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.equal(buyIsland(game, s, is.id), null);
  const e = s.profile!.saga!.at(-1)!;
  assert.equal(e.kind, 'island');
  assert.deepEqual(e.a, [is.name]);
});

test('a chapter shared: a postcard in everyone’s chat, once a minute', () => {
  const { game } = makeGame();
  join(game, 'Teller Tom');
  const s = game.sessionByName('Teller Tom')!;
  const other = join(game, 'Listener Lu');
  sagaNote(game, s, 'dutchman');
  const id = s.profile!.saga!.at(-1)!.id;
  assert.equal(shareSaga(game, s, 999), 'No such chapter.');
  assert.equal(shareSaga(game, s, id), null);
  const msg = other.last('chat') as { from: string; card: { name: string; entry: SagaEntry } };
  assert.equal(msg.from, 'Teller Tom');
  assert.equal(msg.card.entry.kind, 'dutchman');
  assert.equal(shareSaga(game, s, id), 'Wait a little before sharing another chapter.');
  game.now += SHARE_EVERY_SEC + 1;
  assert.equal(shareSaga(game, s, id), null);
});

test('the reader’s tongue tells the chapter', () => {
  const e: SagaEntry = { id: 1, at: 0, day: 3, holiday: 'herring_run', kind: 'beast', a: ['Sperm Whale', 'Whale Bay'] };
  setLang('en');
  assert.equal(tellSaga(e, 'Ada'), 'On the 3rd day of The Herring Run, Captain Ada took a Sperm Whale off Whale Bay.');
  setLang('ru');
  const ru = tellSaga({ ...e, kind: 'dutchman', a: [] }, 'Ada').replace(/\u00a0/g, ' ');
  assert.ok(ru.startsWith('В 3-й день праздника «Сельдяной ход» капитан'), ru);
  assert.ok(ru.endsWith('упокаивает Летучего Голландца.'), ru);
  setLang('en');
});
