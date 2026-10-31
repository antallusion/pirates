// The sound design's build (tools/audio/recipe.ts): downloads the sources it lacks, cuts, normalises and encodes every
// variant into assets/audio/, and writes assets/audio/index.json (the client's map), sources.json (file → source,
// author, licence) and CREDITS.md. Needs ffmpeg with libopus on the PATH (or FFMPEG=<path>); never in the repo.
//   node tools/audio/build.ts            — builds what changed (a cache by the clip's recipe)
//   node tools/audio/build.ts --force    — builds everything again
//   node tools/audio/build.ts --only=cannon,hull

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { SOUNDS } from './recipe.ts';
import type { Clip, SoundDef } from './recipe.ts';

const ROOT = resolve(import.meta.dirname, '..', '..');
const RAW = join(ROOT, 'assets', 'raw', 'audio-src');
const OUT = join(ROOT, 'assets', 'audio');
const TMP = join(RAW, '_tmp');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const force = process.argv.includes('--force');
const only = (process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',') ?? null);

/** Who made what (OpenGameArt and Kenney: per pack; Freesound: read off each sound's page). */
export interface Source {
  title: string;
  author: string;
  license: 'CC0-1.0' | 'CC-BY-3.0' | 'CC-BY-4.0';
  url: string;
  /** The line the licence asks for (CC-BY). */
  credit?: string;
}

const LICENSE_URL: Record<Source['license'], string> = {
  'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC-BY-3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
};

const OGA: Record<string, Omit<Source, 'url'>> = {
  'ocean-music-pack': { title: 'Ocean Music Pack', author: 'Leonardo Paz (leohpaz)', license: 'CC-BY-4.0', credit: 'Music: «Ocean Music Pack» by Leonardo Paz (leohpaz), CC BY 4.0 — opengameart.org/content/ocean-music-pack' },
  'blackmoor-tides-epic-pirate-battle-theme': { title: 'Blackmoor Tides (Epic Pirate Battle Theme)', author: 'Matthew Pablo', license: 'CC-BY-3.0', credit: 'Music: «Blackmoor Tides» by Matthew Pablo — www.matthewpablo.com, CC BY 3.0' },
  'a-sailors-chant': { title: "A sailor's chant", author: 'Thimras', license: 'CC0-1.0' },
  'medieval-the-old-tower-inn': { title: 'Medieval: The Old Tower Inn', author: 'RandomMind', license: 'CC0-1.0' },
  'medieval-kings-feast': { title: "Medieval: King's Feast", author: 'RandomMind', license: 'CC0-1.0' },
  'victory-fanfare-short': { title: 'Victory Fanfare Short', author: 'cynicmusic', license: 'CC0-1.0' },
};
const KENNEY: Record<string, string> = {
  'rpg-audio': 'RPG Audio',
  'interface-sounds': 'Interface Sounds',
  'impact-sounds': 'Impact Sounds',
  'casino-audio': 'Casino Audio',
  'ui-audio': 'UI Audio',
};

function run(args: string[]): string {
  // ffmpeg's report (loudnorm's json) goes to stderr: spawnSync keeps both.
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostdin', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}\n${r.stderr.slice(-1500)}`);
  return r.stderr;
}

const UA = { 'User-Agent': 'Mozilla/5.0 (GRAVETIDE audio build)' };

async function fetchRetry(url: string): Promise<{ url: string; body: Buffer }> {
  let last: unknown;
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(300_000) });
      if (r.ok) return { url: r.url, body: Buffer.from(await r.arrayBuffer()) };
      await r.arrayBuffer().catch(() => null);
      last = new Error(`${r.status} ${url}`);
      console.log(`  (${r.status} on ${url}, again)`);
    } catch (e) {
      last = e;
      console.log(`  (${String(e)} on ${url}, again)`);
    }
    await new Promise((ok) => setTimeout(ok, 4000 * (i + 1)));
  }
  throw last;
}

const decode = (s: string) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** A Freesound sound: its HQ preview and page, cached; CC0 only (anything else stops the build). */
async function freesound(id: string): Promise<{ file: string; src: Source }> {
  const dir = join(RAW, 'fs');
  mkdirSync(dir, { recursive: true });
  const metaPath = join(dir, `${id}.json`);
  const file = join(dir, `${id}.mp3`);
  if (existsSync(metaPath) && existsSync(file)) return { file, src: JSON.parse(readFileSync(metaPath, 'utf8')) as Source };
  console.log(`  fetching freesound ${id}`);
  const page = await fetchRetry(`https://freesound.org/s/${id}/`);
  const html = page.body.toString('utf8');
  const url = page.url;
  const lic = /creativecommons\.org\/(publicdomain\/zero\/1\.0|licenses\/by\/[34]\.0)\//.exec(html);
  if (!lic || !lic[1].startsWith('publicdomain/zero')) throw new Error(`freesound ${id}: not CC0 (${lic?.[1] ?? 'no licence found'}) — pick another`);
  const mp3 = /data-mp3="([^"]+)"/.exec(html)?.[1]?.replace('-lq.mp3', '-hq.mp3');
  const title = decode(/<title>Freesound - (.*) by ([^<]*)<\/title>/.exec(html)?.[1] ?? id);
  const author = decode(/<title>Freesound - .* by ([^<]*)<\/title>/.exec(html)?.[1] ?? '?');
  if (!mp3) throw new Error(`freesound ${id}: no preview`);
  const body = (await fetchRetry(mp3)).body;
  writeFileSync(file, body);
  const src: Source = { title, author, license: 'CC0-1.0', url };
  writeFileSync(metaPath, JSON.stringify(src, null, 1));
  return { file, src };
}

async function resolveClip(c: Clip): Promise<{ file: string; src: Source }> {
  const [scheme, rest] = [c.src.slice(0, c.src.indexOf(':')), c.src.slice(c.src.indexOf(':') + 1)];
  if (scheme === 'fs') return freesound(rest);
  if (scheme === 'kenney') {
    const pack = rest.split('/')[0];
    const file = join(RAW, 'kenney', rest);
    if (!existsSync(file)) throw new Error(`missing ${file} (download kenney.nl/assets/${pack} into assets/raw/audio-src/kenney/${pack})`);
    return { file, src: { title: `${KENNEY[pack] ?? pack} — ${rest.split('/').pop()}`, author: 'Kenney (kenney.nl)', license: 'CC0-1.0', url: `https://kenney.nl/assets/${pack}` } };
  }
  if (scheme === 'oga') {
    const slug = rest.split('/')[0];
    const file = join(RAW, 'oga', rest);
    const meta = OGA[slug];
    if (!meta) throw new Error(`oga ${slug}: no licence recorded in build.ts`);
    if (!existsSync(file)) throw new Error(`missing ${file} (download opengameart.org/content/${slug})`);
    return { file, src: { ...meta, url: `https://opengameart.org/content/${slug}` } };
  }
  throw new Error(`unknown source ${c.src}`);
}

const clipOf = (c: Clip | string): Clip => (typeof c === 'string' ? { src: c } : c);

function dur(file: string): number {
  const err = run(['-i', file, '-f', 'null', '-']);
  const m = /time=(\d+):(\d+):([\d.]+)/g;
  let last = 0, x: RegExpExecArray | null;
  while ((x = m.exec(err))) last = +x[1] * 3600 + +x[2] * 60 + +x[3];
  return last;
}

/** Cut and shape one clip into a 48 kHz WAV. */
function shape(def: SoundDef, c: Clip, input: string, out: string): void {
  const ch = def.stereo ? 2 : 1;
  const f: string[] = [];
  if (c.rate && c.rate !== 1) f.push(`asetrate=${Math.round(48000 * c.rate)}`, 'aresample=48000');
  // (Kenney's files are cut tight already: a click is a few milliseconds the trim would eat)
  const tight = c.src.startsWith('kenney:');
  if (def.kind === 'sfx' && !c.keepHead && !tight) f.push('silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.004');
  if (def.kind === 'sfx' && !tight) f.push('areverse', 'silenceremove=start_periods=1:start_threshold=-60dB', 'areverse');
  f.push('highpass=f=28');
  const pre = ['-i', input];
  if (c.at) pre.unshift('-ss', String(c.at));
  const args = [...pre, '-ac', String(ch), '-ar', '48000'];
  if (c.dur) args.push('-t', String(c.dur / (c.rate ?? 1) + 0.0));
  // the fade after the trims: on the clip's own length
  args.push('-af', f.join(','), '-c:a', 'pcm_f32le', `${out}.cut.wav`);
  run(args);
  const len = dur(`${out}.cut.wav`);
  const fade = Math.min(len * 0.5, c.fade ?? (def.kind === 'sfx' ? 0.04 : 0));
  const g: string[] = ['afade=t=in:d=0.003'];
  if (fade > 0 && !(def.loop && def.xfade !== undefined)) g.push(`afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade.toFixed(3)}`);
  run(['-i', `${out}.cut.wav`, '-af', g.join(','), '-c:a', 'pcm_f32le', out]);
  rmSync(`${out}.cut.wav`);
  // A loop's seam: the tail crossfaded into the head (the loop starts where the head's fade-in ended).
  if (def.loop && def.xfade) {
    const x = def.xfade;
    const L = dur(out);
    const fc = `[0]atrim=0:${x},asetpts=PTS-STARTPTS,afade=t=in:d=${x}[h];[0]atrim=${x}:${L - x},asetpts=PTS-STARTPTS[m];[0]atrim=${L - x}:${L},asetpts=PTS-STARTPTS,afade=t=out:d=${x}[t];[t][h]amix=inputs=2:normalize=0[s];[m][s]concat=n=2:v=0:a=1[o]`;
    run(['-i', out, '-filter_complex', fc, '-map', '[o]', '-c:a', 'pcm_f32le', `${out}.loop.wav`]);
    rmSync(out);
    run(['-i', `${out}.loop.wav`, '-c:a', 'pcm_f32le', out]);
    rmSync(`${out}.loop.wav`);
  }
}

/** The gain (dB) to bring it to its loudness target, its true peak kept under the ceiling. */
function gainFor(def: SoundDef, c: Clip, wav: string): number {
  const target = def.lufs ?? (def.kind === 'music' ? -16 : def.kind === 'amb' ? -22 : -16);
  const ceiling = def.kind === 'music' ? -1.5 : -1;
  const err = run(['-i', wav, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const j = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1)) as { input_i: string; input_tp: string };
  const I = Number(j.input_i), TP = Number(j.input_tp);
  const byLoud = Number.isFinite(I) && I > -70 ? target - I : 0;
  const byPeak = Number.isFinite(TP) ? ceiling - TP : 0;
  return Math.min(byLoud, byPeak) + (c.gain ?? 0);
}

function encode(def: SoundDef, wav: string, gain: number, base: string): void {
  const music = def.kind === 'music';
  const ob = music ? '96k' : def.kind === 'amb' ? '48k' : '56k';
  const ab = music ? '112k' : def.kind === 'amb' ? '56k' : '64k';
  const vol = `volume=${gain.toFixed(2)}dB`;
  // A limiter after the gain: the peak can never clip, whatever the loudness asked (a −1 dBFS ceiling).
  const af = `${vol},alimiter=limit=${music ? 0.84 : 0.89}:attack=1:release=40:level=disabled`;
  run(['-i', wav, '-af', af, '-c:a', 'libopus', '-b:a', ob, '-vbr', 'on', '-application', 'audio', '-map_metadata', '-1', `${base}.ogg`]);
  run(['-i', wav, '-af', af, '-c:a', 'aac', '-b:a', ab, '-movflags', '+faststart', '-map_metadata', '-1', `${base}.m4a`]);
}

interface IndexEntry {
  kind: SoundDef['kind'];
  bus: SoundDef['bus'];
  files: string[];
  /** Seconds per variant. */
  dur: number[];
  /** Bytes per variant (opus, aac). */
  bytes: [number, number][];
  loop?: true;
  preload?: true;
}

async function main(): Promise<void> {
  mkdirSync(TMP, { recursive: true });
  const cachePath = join(RAW, 'build-cache.json');
  const cache: Record<string, string> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  const oldIndex = existsSync(join(OUT, 'index.json')) ? (JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')) as { sounds: Record<string, IndexEntry> }).sounds : {};
  const index: Record<string, IndexEntry> = {};
  const sources: Record<string, Source & { licenseUrl: string; from: string; at?: number; dur?: number }> = {};
  const keep = new Set<string>();
  for (const [key, def] of Object.entries(SOUNDS)) {
    const files: string[] = [], durs: number[] = [], bytes: [number, number][] = [];
    for (const [i, raw] of def.clips.entries()) {
      const c = clipOf(raw);
      const rel = `${def.kind}/${key}${def.clips.length > 1 ? `-${i + 1}` : ''}`;
      const base = join(OUT, rel);
      mkdirSync(dirname(base), { recursive: true });
      const { file, src } = await resolveClip(c);
      const sig = createHash('sha1').update(JSON.stringify([def.kind, def.stereo, def.loop, def.xfade, def.lufs, c, statSync(file).size, 3])).digest('hex');
      const fresh = !force && cache[rel] === sig && existsSync(`${base}.ogg`) && existsSync(`${base}.m4a`) && (!only || !only.includes(key));
      if (!fresh && (!only || only.includes(key))) {
        const wav = join(TMP, `${rel.replace(/\//g, '_')}.wav`);
        shape(def, c, file, wav);
        const g = gainFor(def, c, wav);
        encode(def, wav, g, base);
        rmSync(wav);
        cache[rel] = sig;
        writeFileSync(cachePath, JSON.stringify(cache, null, 1));
        console.log(`  ${rel}  ${g >= 0 ? '+' : ''}${g.toFixed(1)} dB  ${(statSync(`${base}.ogg`).size / 1024).toFixed(0)} KB`);
      }
      files.push(rel);
      keep.add(`${rel}.ogg`).add(`${rel}.m4a`);
      const old = oldIndex[key]?.files.indexOf(rel) ?? -1;
      durs.push(fresh && old >= 0 ? oldIndex[key].dur[old] : Math.round(dur(`${base}.ogg`) * 1000) / 1000);
      bytes.push([statSync(`${base}.ogg`).size, statSync(`${base}.m4a`).size]);
      sources[rel] = { ...src, licenseUrl: LICENSE_URL[src.license], from: c.src, ...(c.at ? { at: c.at } : {}), ...(c.dur ? { dur: c.dur } : {}) };
    }
    index[key] = { kind: def.kind, bus: def.bus, files, dur: durs, bytes, ...(def.loop ? { loop: true as const } : {}), ...(def.preload ? { preload: true as const } : {}) };
  }
  // Files no recipe makes any more go.
  for (const sub of ['sfx', 'amb', 'music']) {
    const d = join(OUT, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) if (!keep.has(`${sub}/${f}`)) rmSync(join(d, f));
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 1));
  const v = createHash('sha1').update(JSON.stringify(index)).digest('hex').slice(0, 10);
  writeFileSync(join(OUT, 'index.json'), `${JSON.stringify({ $comment: 'Generated by tools/audio/build.ts from tools/audio/recipe.ts — do not edit.', v, sounds: index }, null, 1)}\n`);
  writeFileSync(join(OUT, 'sources.json'), `${JSON.stringify(sources, null, 1)}\n`);
  writeFileSync(join(OUT, 'CREDITS.md'), credits(sources));
  const sum = (pred: (e: IndexEntry) => boolean, j: 0 | 1) => Object.values(index).filter(pred).reduce((s, e) => s + e.bytes.reduce((a, b) => a + b[j], 0), 0);
  const mb = (n: number) => `${(n / 1048576).toFixed(2)} MB`;
  console.log(`preload: ${mb(sum((e) => !!e.preload, 0))} opus / ${mb(sum((e) => !!e.preload, 1))} aac; sfx lazy ${mb(sum((e) => e.kind === 'sfx' && !e.preload, 0))}; ambience ${mb(sum((e) => e.kind === 'amb', 0))}; music ${mb(sum((e) => e.kind === 'music', 0))} opus / ${mb(sum((e) => e.kind === 'music', 1))} aac`);
}

/** The human list: CC-BY first (their credit is owed), then every CC0 source by author (a courtesy). */
function credits(sources: Record<string, Source & { licenseUrl: string }>): string {
  const by = new Map<string, { s: Source; files: string[] }>();
  for (const [f, s] of Object.entries(sources)) {
    const k = `${s.url}|${s.title}`;
    if (!by.has(k)) by.set(k, { s, files: [] });
    by.get(k)!.files.push(f);
  }
  const all = [...by.values()];
  const owed = all.filter((x) => x.s.license !== 'CC0-1.0');
  const cc0 = all.filter((x) => x.s.license === 'CC0-1.0').sort((a, b) => a.s.author.localeCompare(b.s.author));
  const lines = [
    '# GRAVETIDE — music and sound credits',
    '',
    'Generated by `tools/audio/build.ts` from `tools/audio/recipe.ts`; the machine-readable list is `sources.json`.',
    'Every sound is either public domain (CC0) or licensed CC BY with the credit below. No AI-generated audio.',
    '',
    '## Music (CC BY — attribution required)',
    '',
    ...owed.map((x) => `- ${x.s.credit ?? `«${x.s.title}» by ${x.s.author}`} — ${x.s.url} — [${x.s.license}](${LICENSE_URL[x.s.license]}) — ${x.files.join(', ')}`),
    '',
    '## Public domain (CC0) — thanks to',
    '',
    ...cc0.map((x) => `- «${x.s.title}» by ${x.s.author} — ${x.s.url} — ${x.files.join(', ')}`),
    '',
  ];
  return lines.join('\n');
}

await main();
