// Downloads every asset in assets/manifest.json from the Higgsfield CDN into assets/<local>, as the CDN has it.
// The committed files are baked (trimmed, resized, WebP) by `python tools/art/process.py`; this is the fallback
// for a checkout without them. Run where the network allows it: `npm run assets:fetch` (--force re-downloads).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Manifest {
  cdn: string;
  assets: Record<string, { local: string; remote: string }>;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'assets/manifest.json'), 'utf8')) as Manifest;
const force = process.argv.includes('--force');
let ok = 0, skipped = 0, failed = 0;

for (const [id, a] of Object.entries(manifest.assets)) {
  const target = resolve(root, 'assets', a.local);
  if (existsSync(target) && !force) {
    skipped++;
    continue;
  }
  try {
    const res = await fetch(manifest.cdn + a.remote);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    ok++;
    console.log(`✓ ${id} → assets/${a.local}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${id}: ${(e as Error).message}`);
  }
}
console.log(`downloaded ${ok}, already present ${skipped}, failed ${failed}`);
if (failed) process.exitCode = 1;
