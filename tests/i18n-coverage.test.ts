import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { textPaths } from '../tools/i18n-data.ts';
import { extract } from '../tools/i18n-server.ts';
import { DATA_RU } from '../client/src/lang/data.ts';
import { SERVER_RU_A } from '../client/src/lang/server.ru.a.ts';
import { SERVER_RU_B } from '../client/src/lang/server.ru.b.ts';
import { serverTable } from '../client/src/lang/server.ts';

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const digits = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join(' ');

test('every text field of the shared data has a Russian twin that keeps its numbers', () => {
  const paths = textPaths();
  const missing = Object.keys(paths).filter((p) => !DATA_RU[p]);
  assert.deepEqual(missing.slice(0, 20), [], `${missing.length} data strings untranslated`);
  for (const [p, en] of Object.entries(paths)) assert.equal(holes(DATA_RU[p]), holes(en), `placeholders of ${p}`);
  let kept = 0;
  for (const [p, en] of Object.entries(paths)) if (digits(DATA_RU[p]) === digits(en)) kept++;
  assert.ok(kept / Object.keys(paths).length > 0.97, 'numbers survive translation');
});

test('every sentence the server can say has a Russian pattern with the same placeholders', () => {
  const table = { ...serverTable(), ...SERVER_RU_A, ...SERVER_RU_B };
  const all = extract();
  const missing = all.filter((p) => table[p] === undefined);
  assert.ok(missing.length / all.length < 0.02, `${missing.length} of ${all.length} server sentences untranslated, e.g. ${JSON.stringify(missing.slice(0, 5))}`);
  for (const p of all) if (table[p] !== undefined) assert.equal(holes(table[p]), holes(p), `placeholders of ${JSON.stringify(p)}`);
});

test('every screen dictionary is complete in both languages', async () => {
  const dir = new URL('../client/src/lang/ui/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length >= 8, 'the screens have their dictionaries');
  for (const f of files) {
    const m = (await import(new URL(f, dir).href)) as { EN: Record<string, string>; RU: Record<string, string> };
    assert.deepEqual(Object.keys(m.RU).sort(), Object.keys(m.EN).sort(), f);
    for (const k of Object.keys(m.EN)) {
      assert.ok(m.RU[k], `${f}: ${k}`);
      assert.equal(holes(m.RU[k]), holes(m.EN[k]), `${f}: placeholders of ${k}`);
    }
  }
});
