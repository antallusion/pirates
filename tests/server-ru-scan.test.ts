// QA, 2026-10-04: every refusal and toast the server words in its own lines reads in Russian on a Russian screen —
// a refit's «Needs 5 timber (in the hold or your warehouse here)», a new season's news and the half-read «WORLD:»
// lines once came through in English. The admin's «Usage: /…» lines keep their commands as typed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';

const english = (ru: string) => (ru.match(/[A-Za-z]{3,}/g) ?? []).length >= 2;

test('every refusal and toast of the server reads in Russian', () => {
  const lines = new Map<string, string>();
  for (const dir of ['server/src/game/', 'server/src/']) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const src = readFileSync(dir + f, 'utf8');
      const found = [
        ...[...src.matchAll(/return '([A-Z][^']{6,})';/g)].map((m) => m[1]),
        ...[...src.matchAll(/return `([A-Z][^`]{6,})`;/g)].map((m) => m[1]),
        ...[...src.matchAll(/msg: '([A-Z][^']{6,})'/g)].map((m) => m[1]),
        ...[...src.matchAll(/msg: `([A-Z][^`]{6,})`/g)].map((m) => m[1]),
      ];
      for (const raw of found) {
        // A choice inside (`${a ? 'x' : 'y'}`) or a list joined in place: its lines are read where they are written.
        if (/\$\{[^}]*\?/.test(raw) || raw.includes('=>') || raw.includes("'{") || raw.endsWith('\\') || raw.includes('Usage: /')) continue;
        lines.set(raw.replace(/\$\{[^}]*\}/g, '7'), `${f}: ${raw}`);
      }
    }
  }
  assert.ok(lines.size > 1200, `${lines.size} lines read`);
  setLang('ru');
  applyDataLocale('ru');
  try {
    const left = [...lines].filter(([s]) => english(serverText(s))).map(([, where]) => where);
    assert.deepEqual(left, [], 'every line in Russian');
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});
