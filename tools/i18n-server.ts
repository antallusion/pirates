// Localization helper: every sentence the server can say to a player, as a pattern. String and template literals
// in server/src/game that read as prose ("The yard is closed.", `Sold ${n} ${good}.`) become "Sold {0} {1}."; the
// client (client/src/lang/server.ts) matches incoming toasts against these patterns and fills the Russian twin
// (client/src/lang/server.ru.ts). Log lines ("[world] …") and identifiers are skipped.
//   node tools/i18n-server.ts        (prints the JSON list of patterns)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
// The compiler from the project, or the global install when node_modules is absent (typed loosely: the tool must
// run where the type declarations are not installed).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const require = createRequire(import.meta.url);
let ts: Any;
try {
  ts = require('typescript');
} catch {
  ts = require('/opt/node22/lib/node_modules/typescript');
}

export function looksLikeProse(s: string): boolean {
  const bare = s.replace(/\{\d+\}/g, '').trim();
  if (bare.length < 4 || !/[a-z]/.test(bare)) return false;
  if (/^\[/.test(bare) || /^[a-z_]+(\.[a-z_]+)*$/.test(bare) || /^[a-z]+[A-Z]\w*$/.test(bare)) return false; // log tags, ids, camelCase
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE)\b/.test(bare)) return false;
  if (/^[\w-]+$/.test(bare) && !/^[A-Z]/.test(bare)) return false; // a single lower-case token
  // A word between the holes of a sentence ("{0} rises! {1}", "+{0} XP — {1}") is prose too.
  if (/\{\d+\}.*\{\d+\}/.test(s) && /[A-Za-z]{2,}[.!?]?/.test(bare) && /\s/.test(s.replace(/\{\d+\}/g, 'x'))) return true;
  return /\s/.test(bare) || /^[A-Z][a-z]+[.!?]?$/.test(bare);
}

export function extract(root = 'server/src'): string[] {
  const found = new Set<string>();
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(join(d, f.name));
      // The admin console speaks the tester's language too (the owner plays with it).
      else if (f.name.endsWith('.ts')) files.push(join(d, f.name));
    }
  };
  walk(root);
  for (const file of files) {
    const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (n: Any): void => {
      // Skip the log calls: they are for operators, not players.
      if (ts.isCallExpression(n) && /\.log$|^console\./.test(n.expression.getText(src))) return;
      let pat: string | null = null;
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) pat = n.text;
      else if (ts.isTemplateExpression(n)) {
        pat = n.head.text;
        n.templateSpans.forEach((sp: Any, i: number) => (pat += `{${i}}` + sp.literal.text));
      }
      if (pat !== null && looksLikeProse(pat)) found.add(pat);
      ts.forEachChild(n, visit);
    };
    visit(src);
  }
  return [...found].sort();
}

if (import.meta.main) console.log(JSON.stringify(extract(), null, 1));
