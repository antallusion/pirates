// The production bundle of the browser client (prod 2026-10-25: phones on a weak mobile network could not start the game
// — «Failed to fetch dynamically imported module: …/src/main.ts»: the page asked for some 560 modules one by one, and one
// lost on the way failed them all). Built at deploy time (tools/deploy.sh) into client/dist/ — a few files, named by
// their content's hash (kept by the browser for good), minified and brought down to the browsers' floor (iOS 15 / Safari
// 15, Chrome 80); the server (server/src/net/static.ts) points the page at them when client/dist/bundle.json is there and
// its sources have not changed since. Without it — the local game — the modules are served one by one as before.
//   node tools/build-client.ts            — builds into client/dist (delete that folder to go back to the modules)
//   node tools/build-client.ts <root>     — builds the copy of the repository at <root> (deploy.sh: the archived commit)

import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { brotliCompressSync, constants as zc, gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { hasLookbehind, ROOT, scanClient } from './compat-scan.ts';

/** esbuild's targets: the floor (tests/compat-scan.test.ts keeps the code's syntax and calls to it too). */
export const TARGET = ['safari15', 'ios15', 'chrome80', 'firefox90', 'edge88'];

/** The bundle's entries: the game and the forum's page (the interface kit's page, /?kit, stays on the modules). */
const ENTRY_POINTS: Record<string, string> = { main: 'client/src/main.ts', forum: 'client/src/forum/main.ts' };

/** What the server reads (client/dist/bundle.json). */
export interface BundleInfo {
  /** The build's id: its entries' hashes. */
  build: string;
  /** When it was made (ms): a source changed after it makes the bundle stale. */
  made: number;
  /** Per entry: the files to load before it runs (itself first, then its static chunks) and its lazy chunks. */
  entries: Record<string, { file: string; boot: string[]; lazy: string[] }>;
  /** Per file: its bytes raw and brotli'd. */
  sizes: Record<string, { raw: number; br: number; gz: number }>;
  /** The sources it was made of (path from the root → size). */
  inputs: Record<string, number>;
}

/** Builds the client of the repository at `root` into `out` (its client/dist by default). */
export async function buildClient(root = ROOT, opts: { out?: string; quiet?: boolean } = {}): Promise<BundleInfo> {
  const say = (s: string) => opts.quiet || console.log(s);
  const found = scanClient(root);
  if (found.length) throw new Error(`below the browsers' floor (iOS 15 / Safari 15):\n${found.map((f) => `  ${f.file}:${f.line} ${f.what}`).join('\n')}`);
  const out = resolve(opts.out ?? join(root, 'client', 'dist'));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const r = await build({
    absWorkingDir: root,
    entryPoints: ENTRY_POINTS,
    bundle: true,
    splitting: true,
    format: 'esm',
    target: TARGET,
    minify: true,
    legalComments: 'none',
    charset: 'utf8',
    outdir: out,
    entryNames: '[name]-[hash]',
    chunkNames: 'c-[hash]',
    metafile: true,
    write: true,
    logLevel: 'warning',
  });
  const meta = r.metafile!;
  const name = (p: string) => p.split('/').pop()!;
  const outs = new Map(Object.entries(meta.outputs).map(([p, o]) => [name(p), o]));
  const entries: BundleInfo['entries'] = {};
  for (const [file, o] of outs) {
    // (a lazy chunk is one of esbuild's «entries» too: only ours are kept)
    const key = Object.keys(ENTRY_POINTS).find((k) => ENTRY_POINTS[k] === o.entryPoint?.replace(/\\/g, '/'));
    if (!key) continue;
    const boot: string[] = [];
    const lazy: string[] = [];
    const walk = (f: string, into: string[]) => {
      if (boot.includes(f) || lazy.includes(f)) return;
      into.push(f);
      for (const i of outs.get(f)?.imports ?? []) {
        if (i.external) continue;
        walk(name(i.path), i.kind === 'dynamic-import' ? lazy : into);
      }
    };
    walk(file, boot);
    entries[key] = { file, boot, lazy: lazy.filter((f) => !boot.includes(f)) };
  }
  const sizes: BundleInfo['sizes'] = {};
  for (const file of readdirSync(out)) {
    if (!file.endsWith('.js')) continue;
    const body = readFileSync(join(out, file));
    if (hasLookbehind(body.toString('utf8'))) throw new Error(`${file}: a regex lookbehind in the bundle (Safari before 16.4 cannot parse it)`);
    const br = brotliCompressSync(body, { params: { [zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_SIZE_HINT]: body.length } });
    const gz = gzipSync(body, { level: 9 });
    writeFileSync(join(out, `${file}.br`), br);
    writeFileSync(join(out, `${file}.gz`), gz);
    sizes[file] = { raw: body.length, br: br.length, gz: gz.length };
  }
  const inputs: Record<string, number> = {};
  for (const p of Object.keys(meta.inputs)) inputs[p.replace(/\\/g, '/')] = statSync(join(root, p)).size;
  const info: BundleInfo = {
    build: hashOf(Object.values(entries).map((e) => e.file).sort().join('|')),
    made: Date.now(),
    entries,
    sizes,
    inputs,
  };
  writeFileSync(join(out, 'bundle.json'), JSON.stringify(info));
  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
  for (const [k, e] of Object.entries(entries)) {
    const b = e.boot.reduce((s, f) => s + sizes[f].br, 0);
    const l = e.lazy.reduce((s, f) => s + sizes[f].br, 0);
    say(`  ${k}: ${e.boot.length} file(s) to start, ${kb(b)} brotli (${kb(e.boot.reduce((s, f) => s + sizes[f].raw, 0))} raw); ${e.lazy.length} lazy, ${kb(l)}`);
  }
  say(`client bundle ${info.build}: ${Object.keys(sizes).length} files in ${relative(process.cwd(), out) || out}, from ${Object.keys(inputs).length} sources`);
  return info;
}

/** A short hash (FNV-1a). */
function hashOf(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, 'tools', 'build-client.ts')) {
  const root = process.argv[2] ? resolve(process.argv[2]) : ROOT;
  buildClient(root).catch((e: unknown) => {
    console.error(String((e as Error)?.message ?? e));
    process.exit(1);
  });
}
