// The guild finder (docs/11 P6): a guild's officers open recruiting with a note; captains with no guild see it and
// ask to join; the officers take them in on probation or turn them down.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

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
