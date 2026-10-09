// The films' places (owner, 2026-10-05: «ролик можно оставить при выходе и заходе в порт или на острова, при
// успешном абордаже или проигрыше. внутри всяких вкладок типа при переходе в таверну не нужно ниче делать»): into and
// out of a port, a landing ashore, a fight won or lost (a boarding, a lair, a world boss brought down), the great ones
// rising out of the sea (a world boss, a zone boss's first rising) and the prologue — nothing at a window, a tab or a
// battle's start. A ship gone down to the guns has no film (owner, 2026-10-09); a boarding lost keeps the defeat's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('films play only at the sea\'s own moments, never at a window or a tab', () => {
  const ui = readdirSync(new URL('../client/src/ui/', import.meta.url)).filter((f) => f.endsWith('.ts') && f !== 'cutscene.ts');
  for (const f of ui) assert.ok(!/playFilm\(/.test(src(`client/src/ui/${f}`)), `no film in ${f} (the tavern's, a window's)`);
  const main = src('client/src/main.ts');
  const calls = [...main.matchAll(/playFilm\(([^\n]*)/g)].map((m) => m[1]);
  // The prologue, the zone boss's rising (by the server), a boarding lost at sea; the end of a fight; into port and out;
  // a world boss rising and brought down; a landing.
  assert.equal(calls.length, 10, calls.join('\n'));
  const ids = ['tavern', 'tattoo', 'saga', 'tame', 'throne', 'shop', 'barter', 'crew', 'dice', 'quest', 'trek', 'descent', 'mutiny', 'research', 'boarding', 'raid', 'lair', 'storm', 'fog', 'night_watch', 'strike_colours', 'trophy_hall', 'nethaul', 'repair', 'wanted', 'party', 'sunk'].map((x) => `'cut_${x}'`);
  for (const gone of [...ids, '`cut_sea_', '`cut_pet_', 'MODAL_FILM', 'LEGEND_FILM', 'ROSTER_FILM', 'LAIR_FILM']) {
    assert.ok(!main.includes(gone), `no ${gone}`);
  }
  assert.ok(!main.includes("act: { a: 'film'"), 'nothing at a battle\'s start, so nothing holds its clock');
  for (const kept of ["'cut_victory'", "'cut_defeat'", "'cut_port'", "'cut_launch'", 'LANDING_FILM', 'BOSS_FILM']) assert.ok(main.includes(kept), kept);
  // Sunk by the guns: the shipwreck's account, no film; boarded and lost: the defeat's.
  assert.ok(main.includes("if (m.boarded) playFilm('cut_defeat', undefined, { over: true });"));
  // The server's films: the zone bosses' risings only.
  const server = readdirSync(new URL('../server/src/game/', import.meta.url)).filter((f) => f.endsWith('.ts'));
  const sends = server.flatMap((f) => [...src(`server/src/game/${f}`).matchAll(/t: 'film', id: ([^}]*)/g)].map((m) => `${f}: ${m[1]}`));
  assert.deepEqual(sends, ['zonebosses.ts: `cut_zboss_${region'], 'the zone bosses\' risings');
});
