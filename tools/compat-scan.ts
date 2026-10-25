// The browsers' floor, checked in the code (prod 2026-10-25: the game did not start at all on an iPhone with iOS 15.8 or
// on macOS Safari 16.3 — «Invalid regular expression: invalid group specifier name»: one regex lookbehind in one module
// fails the whole start). The floor is iOS 15 / Safari 15.0: every file the browser may load — the modules reachable
// from the client's entries (their static, re-exported and dynamic imports, into shared/ too), the page's inline
// scripts and the service worker — is parsed and searched for what Safari 15 cannot parse or run:
//  - a regex lookbehind `(?<=` / `(?<!` (Safari 16.4), in a regex literal or a string a RegExp may be built from;
//  - the regex flag `v` (Safari 17); a class's `static {}` block (16.4); import attributes `with {…}` (17.2);
//  - calls newer than the floor that client/src/compat.ts does not fill in (toSorted, Object.groupBy, …), and the bare
//    calls of what Safari has not at all (requestIdleCallback, OffscreenCanvas, …: to be reached through a check).
// tests/compat-scan.test.ts runs it; tools/build-client.ts refuses to build the bundle while it finds anything.
//   node tools/compat-scan.ts — prints what it finds (exit 1 if anything).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { POLYFILLED } from '../client/src/compat.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The client's entries: the game, the forum's page, the interface kit's page. */
export const ENTRIES = ['client/src/main.ts', 'client/src/forum/main.ts', 'client/src/ui/kit/demo.ts'];

/** Calls newer than Safari 15.0 (name → the Safari that has it). Those in compat.ts's POLYFILLED are let through. */
const NEW_METHODS = new Map<string, string>(Object.entries({
  at: '15.4', findLast: '15.4', findLastIndex: '15.4', hasOwn: '15.4', randomUUID: '15.4',
  toSorted: '16', toReversed: '16', toSpliced: '16', with: '16',
  isWellFormed: '16.4', toWellFormed: '16.4', fromAsync: '16.4',
  groupBy: '17.4', withResolvers: '17.4',
  union: '17', intersection: '17', difference: '17', symmetricDifference: '17', isSubsetOf: '17', isSupersetOf: '17', isDisjointFrom: '17',
}));
/** Globals newer than the floor, never to be called or constructed bare (only behind a check). */
const NEW_GLOBALS = new Map<string, string>(Object.entries({
  structuredClone: '15.4', requestIdleCallback: 'none', cancelIdleCallback: 'none', OffscreenCanvas: '16.4',
  CompressionStream: '16.4', DecompressionStream: '16.4',
}));
/** Static calls on a global newer than the floor (AbortSignal.timeout is Safari 16, .any 17.4). */
const NEW_STATICS = new Map<string, string>(Object.entries({ 'AbortSignal.timeout': '16', 'AbortSignal.any': '17.4', 'Promise.withResolvers': '17.4', 'Object.groupBy': '17.4', 'Map.groupBy': '17.4' }));

export interface Finding {
  file: string;
  line: number;
  what: string;
}

/** Whether a regex source (or a string a RegExp may be built from) holds a lookbehind: an unescaped `(` then `?<=`/`?<!`. */
export function hasLookbehind(src: string): boolean {
  for (let i = src.indexOf('(?<'); i >= 0; i = src.indexOf('(?<', i + 1)) {
    const c = src[i + 3];
    if (c !== '=' && c !== '!') continue;
    let bs = 0;
    for (let j = i - 1; j >= 0 && src[j] === '\\'; j--) bs++;
    if (bs % 2 === 0) return true;
  }
  return false;
}

/** What one file's code holds below the floor. */
export function scanSource(file: string, text: string): Finding[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const out: Finding[] = [];
  const add = (n: ts.Node, what: string) => out.push({ file, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, what });
  const visit = (n: ts.Node): void => {
    if (ts.isRegularExpressionLiteral(n)) {
      const t = n.text;
      const cut = t.lastIndexOf('/');
      const body = t.slice(1, cut);
      const flags = t.slice(cut + 1);
      if (hasLookbehind(body)) add(n, `regex lookbehind (Safari 16.4): ${t.slice(0, 80)}`);
      if (flags.includes('v')) add(n, `regex flag v (Safari 17): ${t.slice(0, 80)}`);
    } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      if (hasLookbehind(n.text)) add(n, `regex lookbehind in a string (Safari 16.4): ${n.text.slice(0, 80)}`);
    } else if (ts.isClassStaticBlockDeclaration(n)) {
      add(n, 'class static block (Safari 16.4)');
    } else if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.attributes) {
      add(n, 'import attributes (Safari 17.2)');
    } else if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'RegExp') {
      const f = n.arguments?.[1];
      if (f && ts.isStringLiteralLike(f) && f.text.includes('v')) add(n, 'RegExp flag v (Safari 17)');
    }
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const e = n.expression;
      if (ts.isIdentifier(e) && NEW_GLOBALS.has(e.text) && !(POLYFILLED as readonly string[]).includes(e.text)) add(n, `${e.text}() bare (Safari ${NEW_GLOBALS.get(e.text)}): reach it through a check`);
      if (ts.isPropertyAccessExpression(e)) {
        const name = e.name.text;
        const full = ts.isIdentifier(e.expression) ? `${e.expression.text}.${name}` : '';
        if (NEW_STATICS.has(full)) add(n, `${full}() (Safari ${NEW_STATICS.get(full)})`);
        else if (NEW_METHODS.has(name) && !(POLYFILLED as readonly string[]).includes(name)) add(n, `.${name}() (Safari ${NEW_METHODS.get(name)}, not in client/src/compat.ts)`);
      }
    }
    if (ts.isMetaProperty(n) && ts.isPropertyAccessExpression(n.parent) && n.parent.name.text === 'resolve') add(n, 'import.meta.resolve (Safari 16.4)');
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** The modules a module brings in at run time (static imports, re-exports, side-effect and dynamic imports — not types). */
export function importsOf(file: string, text: string): string[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: string[] = [];
  const add = (spec: string) => {
    if (spec.startsWith('.')) out.push(resolve(dirname(file), spec));
  };
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause;
      const typeOnly = c?.isTypeOnly || (c && !c.name && c.namedBindings && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly));
      if (!typeOnly) add(n.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) {
      add(n.moduleSpecifier.text);
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) {
      add(n.arguments[0].text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Every module the browser may load: reachable from the entries. */
export function clientFiles(root = ROOT): string[] {
  const seen = new Set<string>();
  const stack = ENTRIES.map((e) => resolve(root, e));
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    stack.push(...importsOf(f, readFileSync(f, 'utf8')));
  }
  return [...seen].sort();
}

/** The page's own inline classic scripts (client/index.html), each as a source of its own. */
export function pageScripts(root = ROOT): { name: string; text: string }[] {
  const html = readFileSync(join(root, 'client/index.html'), 'utf8');
  const out: { name: string; text: string }[] = [];
  let i = 0;
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(m[1])) continue;
    out.push({ name: `client/index.html#script${++i}`, text: m[2] });
  }
  return out;
}

/** Everything below the floor in what the browser may load. */
export function scanClient(root = ROOT): Finding[] {
  const out: Finding[] = [];
  for (const f of clientFiles(root)) out.push(...scanSource(relative(root, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')));
  for (const s of pageScripts(root)) out.push(...scanSource(`${s.name}.js`, s.text));
  out.push(...scanSource('client/sw.js', readFileSync(join(root, 'client/sw.js'), 'utf8')));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const found = scanClient();
  for (const f of found) console.log(`${f.file}:${f.line}  ${f.what}`);
  console.log(`${clientFiles().length} modules scanned, ${found.length} below the floor (iOS 15 / Safari 15)`);
  process.exit(found.length ? 1 : 0);
}
