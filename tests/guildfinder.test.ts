// The guild finder (docs/11 P6): a guild's officers open recruiting with a note; captains with no guild see it and
// ask to join; the officers take them in on probation or turn them down.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { FakeConn, join, makeGame } from './helpers.ts';

const bad = (c: ReturnType<typeof join>) => c.all('toast').filter((t) => t.kind === 'bad').map((t) => t.msg);

test('recruiting: seen by those with no guild, asked, taken in on probation — or turned down, or closed', () => {
  const { game } = makeGame();
  const a = join(game, 'Admiral Ada');
  const b = join(game, 'Seeker Sam');
  const c = join(game, 'Other Olga');
  const A = game.sessionByName('Admiral Ada')!;
  A.profile!.gold = 50_000;
  a.push({ t: 'guild', action: 'found', name: 'Salt Owls', tag: 'OWL' });
  const g = game.guilds.of(game, A.accountId)!;
  assert.ok(g);
  // Not recruiting yet: nothing to ask.
  b.push({ t: 'guild', action: 'view' });
  assert.deepEqual(b.last('guild')!.recruiting, []);
  b.push({ t: 'guild', action: 'apply', id: g.id, note: '' });
  assert.equal(bad(b).at(-1), 'That guild is not recruiting');
  // Open: seen, asked.
  a.push({ t: 'guild', action: 'recruit', note: 'Hunters for the Kraken' });
  b.push({ t: 'guild', action: 'view' });
  const r = b.last('guild')!.recruiting!;
  assert.deepEqual(r.map((x) => [x.tag, x.note, x.applied]), [['OWL', 'Hunters for the Kraken', false]]);
  b.push({ t: 'guild', action: 'apply', id: g.id, note: 'I sail at night' });
  assert.ok(a.all('toast').some((t) => t.msg === 'Seeker Sam (level 1) asks to join Salt Owls [OWL]: “I sail at night”. See the Guild tab [Y].'));
  assert.equal(b.last('guild')!.recruiting![0].applied, true);
  c.push({ t: 'guild', action: 'apply', id: g.id, note: '' });
  a.push({ t: 'guild', action: 'view' });
  const reqs = a.last('guild')!.guild!.requests!;
  assert.deepEqual(reqs.map((x) => x.name), ['Seeker Sam', 'Other Olga']);
  // Sam in, Olga turned down.
  const S = game.sessionByName('Seeker Sam')!, O = game.sessionByName('Other Olga')!;
  a.push({ t: 'guild', action: 'request', account: S.accountId, accept: true });
  assert.equal(game.guilds.of(game, S.accountId)?.id, g.id);
  assert.equal(g.members.find((m) => m.account === S.accountId)?.rank, 'cabin_boy', 'on probation');
  assert.ok(b.all('toast').some((t) => t.msg === 'Welcome aboard Salt Owls [OWL]: your request is granted.'));
  a.push({ t: 'guild', action: 'request', account: O.accountId, accept: false });
  assert.equal(game.guilds.of(game, O.accountId), null);
  assert.ok(c.all('toast').some((t) => t.msg === 'Salt Owls [OWL] has turned down your request.'));
  // A cabin boy does not see to recruiting; closed, the guild is gone from the list.
  b.push({ t: 'guild', action: 'recruit', note: 'anyone' });
  assert.equal(bad(b).at(-1), 'Commodores and up see to recruiting');
  a.push({ t: 'guild', action: 'recruit', note: null });
  c.push({ t: 'guild', action: 'view' });
  assert.deepEqual(c.last('guild')!.recruiting, []);
});

test('the guild finder reads in Russian', () => {
  setLang('ru');
  const lines = [
    'Commodores and up see to recruiting', 'Recruiting is closed.', 'Recruiting is open.', 'You already have a guild', 'That guild is not recruiting',
    'Seeker Sam (level 1) asks to join Salt Owls [OWL]: “I sail at night”. See the Guild tab [Y].', 'Seeker Sam (level 1) asks to join Salt Owls [OWL]. See the Guild tab [Y].',
    'Your request to join Salt Owls [OWL] is sent.', 'That request has lapsed', 'Salt Owls [OWL] has turned down your request.', 'Welcome aboard Salt Owls [OWL]: your request is granted.',
  ].map((l) => serverText(l));
  setLang('en');
  assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l.replace(/Seeker Sam|Salt Owls|I sail at night|OWL/g, ''))), []);
});

test('the guild’s word of the day: given by a vice-admiral and up, heard at once and on coming aboard', () => {
  const { game } = makeGame();
  const a = join(game, 'Motd Admiral');
  const b = join(game, 'Motd Sailor');
  const A = game.sessionByName('Motd Admiral')!;
  A.profile!.gold = 50_000;
  a.push({ t: 'guild', action: 'found', name: 'Word Keepers', tag: 'WK' });
  const g = game.guilds.of(game, A.accountId)!;
  a.push({ t: 'guild', action: 'invite', name: 'Motd Sailor' });
  b.push({ t: 'guild', action: 'answer', id: g.id, accept: true });
  b.push({ t: 'guild', action: 'motd', text: 'mutiny!' });
  assert.equal(bad(b).at(-1), 'Vice-admirals and up give the guild its word');
  a.push({ t: 'guild', action: 'motd', text: 'Muster at Saltmarrow at dusk' });
  assert.ok(b.all('toast').some((t) => t.msg === 'Motd Admiral gives the guild its word: “Muster at Saltmarrow at dusk”'));
  a.push({ t: 'guild', action: 'view' });
  assert.equal(a.last('guild')!.guild!.motd, 'Muster at Saltmarrow at dusk');
  // Coming aboard again, the sailor hears it.
  const token = b.last('welcome')!.token;
  b.close();
  for (let i = 0; i < 800 && game.sessionByName('Motd Sailor'); i++) game.step();
  const b2 = new FakeConn();
  game.attach(b2 as unknown as WsConnection);
  b2.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  assert.ok(b2.all('toast').some((t) => t.msg === 'Guild: “Muster at Saltmarrow at dusk”'));
  setLang('ru');
  const ru = [serverText('Guild: “Muster at dusk”'), serverText('Motd Admiral gives the guild its word: “Muster at dusk”'), serverText('Vice-admirals and up give the guild its word')];
  setLang('en');
  assert.deepEqual(ru.filter((l) => /[A-Za-z]{3,}/.test(l.replace(/Motd Admiral|Muster at dusk/g, ''))), []);
});
